using Microsoft.JSInterop;
using Perfecto.Application.Accounting;
using Perfecto.Contracts.Accounting;
using Perfecto.Domain.Accounting;
using Perfecto.Domain.Common;

namespace Perfecto.Pwa.Services;

public sealed class IndexedDbAccountingService(IJSRuntime jsRuntime) : IAccountingService
{
    private readonly SemaphoreSlim _initializationGate = new(1, 1);
    private readonly Guid _fiscalYearId = Guid.Parse("5f3accb0-dc6d-46a2-9c3c-f805fbab77a9");
    private bool _initialized;

    public async Task<AccountingSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var accounts = await GetAccountsAsync(cancellationToken: cancellationToken);
        var journals = await GetJournalsAsync(cancellationToken);
        var entries = await GetEntriesAsync(cancellationToken);
        var balance = DemoAccountingService.BuildTrialBalance(accounts, entries);
        return new AccountingSnapshot(
            accounts.Count,
            journals.Count,
            entries.Count(entry => entry.Status == "Brouillon"),
            entries.Count(entry => entry.Status == "Validée"),
            balance.Sum(line => line.DebitMovements),
            balance.Sum(line => line.CreditMovements),
            entries.OrderByDescending(entry => entry.EntryDate).Take(5).ToList(),
            balance,
            "IndexedDB · disponible hors ligne");
    }

    public async Task<IReadOnlyList<GeneralAccountDto>> GetAccountsAsync(string? search = null, CancellationToken cancellationToken = default)
    {
        await EnsureInitializedAsync(cancellationToken);
        var accounts = await jsRuntime.InvokeAsync<GeneralAccountDto[]>("perfectoDb.getAll", cancellationToken, "accounts");
        var query = accounts.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(account =>
                account.Code.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) ||
                account.Label.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        return query.OrderBy(account => account.Code).ToList();
    }

    public async Task<IReadOnlyList<AccountingJournalDto>> GetJournalsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureInitializedAsync(cancellationToken);
        var journals = await jsRuntime.InvokeAsync<AccountingJournalDto[]>("perfectoDb.getAll", cancellationToken, "journals");
        return journals.OrderBy(journal => journal.Code).ToList();
    }

    public async Task<IReadOnlyList<AccountingEntryDto>> GetEntriesAsync(CancellationToken cancellationToken = default)
    {
        await EnsureInitializedAsync(cancellationToken);
        var entries = await jsRuntime.InvokeAsync<AccountingEntryDto[]>("perfectoDb.getAll", cancellationToken, "entries");
        return entries.OrderByDescending(entry => entry.EntryDate).ThenByDescending(entry => entry.CreatedAt).ToList();
    }

    public async Task<IReadOnlyList<JournalLineDto>> GetJournalLinesAsync(CancellationToken cancellationToken = default) =>
        AccountingReportBuilder.BuildJournal(await GetEntriesAsync(cancellationToken));

    public async Task<IReadOnlyList<LedgerAccountDto>> GetGeneralLedgerAsync(CancellationToken cancellationToken = default) =>
        AccountingReportBuilder.BuildGeneralLedger(await GetEntriesAsync(cancellationToken));

    public async Task<IReadOnlyList<AccountingPeriodDto>> GetPeriodsAsync(CancellationToken cancellationToken = default)
    {
        await EnsureInitializedAsync(cancellationToken);
        var periods = await jsRuntime.InvokeAsync<AccountingPeriodDto[]>("perfectoDb.getAll", cancellationToken, "periods");
        return periods.OrderBy(period => period.Month).ToList();
    }

    public async Task<AccountingEntryDto> SaveEntryAsync(CreateAccountingEntryRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var accounts = await GetAccountsAsync(cancellationToken: cancellationToken);
        var journals = await GetJournalsAsync(cancellationToken);
        var entries = await GetEntriesAsync(cancellationToken);
        await EnsurePeriodOpenAsync(request.EntryDate, cancellationToken);

        if (journals.All(journal => !string.Equals(journal.Code, request.JournalCode, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainRuleException("Le journal sélectionné n'existe pas.");
        }

        if (entries.Any(entry => string.Equals(entry.Reference, request.Reference, StringComparison.OrdinalIgnoreCase)))
        {
            throw new DomainRuleException("Cette référence de pièce existe déjà.");
        }

        var entry = AccountingEntry.Create(
            _fiscalYearId,
            request.JournalCode,
            request.EntryDate,
            request.Reference,
            DateTimeOffset.UtcNow);

        foreach (var line in request.Lines)
        {
            if (accounts.All(account => account.Code != line.AccountCode))
            {
                throw new DomainRuleException($"Le compte {line.AccountCode} n'existe pas.");
            }

            entry.AddLine(line.AccountCode, line.Label, line.Debit, line.Credit);
        }

        if (request.PostImmediately)
        {
            entry.Post(DateTimeOffset.UtcNow);
        }

        var lines = entry.Lines.Select(line => new AccountingEntryLineDto(
            line.Id,
            line.AccountCode,
            accounts.Single(account => account.Code == line.AccountCode).Label,
            line.Label,
            line.Debit,
            line.Credit)).ToList();

        var dto = new AccountingEntryDto(
            entry.Id,
            entry.JournalCode,
            entry.EntryDate,
            entry.Reference,
            string.IsNullOrWhiteSpace(request.Description) ? lines[0].Label : request.Description.Trim(),
            entry.Status == AccountingEntryStatus.Posted ? "Validée" : "Brouillon",
            entry.TotalDebit,
            entry.TotalCredit,
            entry.CreatedAt,
            entry.PostedAt,
            lines);

        await jsRuntime.InvokeVoidAsync("perfectoDb.put", cancellationToken, "entries", dto);
        return dto;
    }

    public async Task<AccountingEntryDto> PostEntryAsync(Guid entryId, CancellationToken cancellationToken = default)
    {
        var entries = await GetEntriesAsync(cancellationToken);
        var current = entries.SingleOrDefault(entry => entry.Id == entryId)
            ?? throw new DomainRuleException("La pièce demandée n'existe pas.");
        if (current.Status == "Validée")
        {
            return current;
        }

        await EnsurePeriodOpenAsync(current.EntryDate, cancellationToken);
        if (current.Lines.Count < 2 || current.TotalDebit != current.TotalCredit || current.TotalDebit <= 0)
        {
            throw new DomainRuleException("La pièce doit être équilibrée avant validation.");
        }

        var posted = current with { Status = "Validée", PostedAt = DateTimeOffset.UtcNow };
        await jsRuntime.InvokeVoidAsync("perfectoDb.put", cancellationToken, "entries", posted);
        return posted;
    }

    public async Task<GeneralAccountDto> CreateAccountAsync(CreateGeneralAccountRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        var accounts = await GetAccountsAsync(cancellationToken: cancellationToken);
        var code = request.Code.Trim();
        if (code.Length is < 2 or > 12 || code.Any(character => !char.IsDigit(character)))
        {
            throw new DomainRuleException("Le numéro de compte doit contenir entre 2 et 12 chiffres.");
        }

        if (string.IsNullOrWhiteSpace(request.Label))
        {
            throw new DomainRuleException("L'intitulé du compte est obligatoire.");
        }

        if (accounts.Any(account => account.Code == code))
        {
            throw new DomainRuleException("Ce numéro de compte existe déjà.");
        }

        var account = new GeneralAccountDto(
            code,
            request.Label.Trim(),
            code[..1],
            request.AccountType.Trim(),
            true,
            request.RequiresThirdParty,
            true);
        await jsRuntime.InvokeVoidAsync("perfectoDb.put", cancellationToken, "accounts", account);
        return account;
    }

    public async Task<AccountingPeriodDto> SetPeriodClosedAsync(int month, bool isClosed, CancellationToken cancellationToken = default)
    {
        var periods = await GetPeriodsAsync(cancellationToken);
        var current = periods.SingleOrDefault(period => period.Month == month)
            ?? throw new DomainRuleException("La période demandée n'existe pas.");
        var updated = current with
        {
            IsClosed = isClosed,
            ClosedAt = isClosed ? DateTimeOffset.UtcNow : null
        };
        await jsRuntime.InvokeVoidAsync("perfectoDb.put", cancellationToken, "periods", updated);
        return updated;
    }

    private async Task EnsurePeriodOpenAsync(DateOnly entryDate, CancellationToken cancellationToken)
    {
        var period = (await GetPeriodsAsync(cancellationToken))
            .SingleOrDefault(item => item.Year == entryDate.Year && item.Month == entryDate.Month);
        if (period is null)
        {
            throw new DomainRuleException("La date de la pièce n'appartient pas à l'exercice courant.");
        }

        if (period.IsClosed)
        {
            throw new DomainRuleException($"La période {period.Label} est clôturée.");
        }
    }

    private async Task EnsureInitializedAsync(CancellationToken cancellationToken)
    {
        if (_initialized)
        {
            return;
        }

        await _initializationGate.WaitAsync(cancellationToken);
        try
        {
            if (_initialized)
            {
                return;
            }

            await jsRuntime.InvokeAsync<bool>("perfectoDb.initialize", cancellationToken);
            _initialized = true;
        }
        finally
        {
            _initializationGate.Release();
        }
    }
}
