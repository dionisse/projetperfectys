using Perfecto.Contracts.Accounting;
using Perfecto.Domain.Accounting;
using Perfecto.Domain.Common;

namespace Perfecto.Application.Accounting;

public sealed class DemoAccountingService : IAccountingService
{
    private readonly List<GeneralAccountDto> _accounts = [.. SyscohadaStarterCatalog.Accounts];
    private readonly List<AccountingJournalDto> _journals = [.. SyscohadaStarterCatalog.Journals];
    private readonly List<AccountingEntryDto> _entries = [];
    private readonly List<AccountingPeriodDto> _periods = [.. AccountingReportBuilder.CreateOpenPeriods(2026)];
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly Guid _fiscalYearId = Guid.Parse("5f3accb0-dc6d-46a2-9c3c-f805fbab77a9");

    public DemoAccountingService()
    {
        SeedEntries();
    }

    public async Task<AccountingSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return BuildSnapshot();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<GeneralAccountDto>> GetAccountsAsync(string? search = null, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var query = _accounts.AsEnumerable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(account =>
                    account.Code.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase) ||
                    account.Label.Contains(search.Trim(), StringComparison.OrdinalIgnoreCase));
            }

            return query.OrderBy(account => account.Code).ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    public Task<IReadOnlyList<AccountingJournalDto>> GetJournalsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<AccountingJournalDto>>(_journals.OrderBy(journal => journal.Code).ToList());

    public async Task<IReadOnlyList<AccountingEntryDto>> GetEntriesAsync(CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return _entries.OrderByDescending(entry => entry.EntryDate).ThenByDescending(entry => entry.CreatedAt).ToList();
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<JournalLineDto>> GetJournalLinesAsync(CancellationToken cancellationToken = default) =>
        AccountingReportBuilder.BuildJournal(await GetEntriesAsync(cancellationToken));

    public async Task<IReadOnlyList<LedgerAccountDto>> GetGeneralLedgerAsync(CancellationToken cancellationToken = default) =>
        AccountingReportBuilder.BuildGeneralLedger(await GetEntriesAsync(cancellationToken));

    public Task<IReadOnlyList<AccountingPeriodDto>> GetPeriodsAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<AccountingPeriodDto>>(_periods.OrderBy(period => period.Month).ToList());

    public async Task<AccountingEntryDto> SaveEntryAsync(CreateAccountingEntryRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            if (_journals.All(journal => !string.Equals(journal.Code, request.JournalCode, StringComparison.OrdinalIgnoreCase)))
            {
                throw new DomainRuleException("Le journal sélectionné n'existe pas.");
            }

            if (_entries.Any(entry => string.Equals(entry.Reference, request.Reference, StringComparison.OrdinalIgnoreCase)))
            {
                throw new DomainRuleException("Cette référence de pièce existe déjà.");
            }

            EnsurePeriodOpen(request.EntryDate);
            var entry = AccountingEntry.Create(
                _fiscalYearId,
                request.JournalCode,
                request.EntryDate,
                request.Reference,
                DateTimeOffset.UtcNow);

            foreach (var line in request.Lines)
            {
                if (_accounts.All(account => !string.Equals(account.Code, line.AccountCode, StringComparison.Ordinal)))
                {
                    throw new DomainRuleException($"Le compte {line.AccountCode} n'existe pas.");
                }

                entry.AddLine(line.AccountCode, line.Label, line.Debit, line.Credit);
            }

            if (request.PostImmediately)
            {
                entry.Post(DateTimeOffset.UtcNow);
            }

            var dto = Map(entry, request.Description);
            _entries.Add(dto);
            return dto;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AccountingEntryDto> PostEntryAsync(Guid entryId, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var index = _entries.FindIndex(entry => entry.Id == entryId);
            if (index < 0)
            {
                throw new DomainRuleException("La pièce demandée n'existe pas.");
            }

            var current = _entries[index];
            if (current.Status == "Validée")
            {
                return current;
            }

            EnsurePeriodOpen(current.EntryDate);
            if (current.Lines.Count < 2 || current.TotalDebit != current.TotalCredit || current.TotalDebit <= 0)
            {
                throw new DomainRuleException("La pièce doit être équilibrée avant validation.");
            }

            var posted = current with { Status = "Validée", PostedAt = DateTimeOffset.UtcNow };
            _entries[index] = posted;
            return posted;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<GeneralAccountDto> CreateAccountAsync(CreateGeneralAccountRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var code = request.Code.Trim();
            if (code.Length is < 2 or > 12 || code.Any(character => !char.IsDigit(character)))
            {
                throw new DomainRuleException("Le numéro de compte doit contenir entre 2 et 12 chiffres.");
            }

            if (string.IsNullOrWhiteSpace(request.Label))
            {
                throw new DomainRuleException("L'intitulé du compte est obligatoire.");
            }

            if (_accounts.Any(account => account.Code == code))
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
            _accounts.Add(account);
            return account;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<AccountingPeriodDto> SetPeriodClosedAsync(int month, bool isClosed, CancellationToken cancellationToken = default)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var index = _periods.FindIndex(period => period.Month == month);
            if (index < 0)
            {
                throw new DomainRuleException("La période demandée n'existe pas.");
            }

            var updated = _periods[index] with
            {
                IsClosed = isClosed,
                ClosedAt = isClosed ? DateTimeOffset.UtcNow : null
            };
            _periods[index] = updated;
            return updated;
        }
        finally
        {
            _gate.Release();
        }
    }

    private AccountingSnapshot BuildSnapshot()
    {
        var balance = BuildTrialBalance(_accounts, _entries);
        return new AccountingSnapshot(
            _accounts.Count,
            _journals.Count,
            _entries.Count(entry => entry.Status == "Brouillon"),
            _entries.Count(entry => entry.Status == "Validée"),
            balance.Sum(line => line.DebitMovements),
            balance.Sum(line => line.CreditMovements),
            _entries.OrderByDescending(entry => entry.EntryDate).Take(5).ToList(),
            balance,
            "Mémoire partagée · hôte Windows");
    }

    public static IReadOnlyList<TrialBalanceLineDto> BuildTrialBalance(
        IReadOnlyList<GeneralAccountDto> accounts,
        IReadOnlyList<AccountingEntryDto> entries)
    {
        var postedLines = entries.Where(entry => entry.Status == "Validée").SelectMany(entry => entry.Lines).ToList();
        return accounts
            .Select(account =>
            {
                var debit = postedLines.Where(line => line.AccountCode == account.Code).Sum(line => line.Debit);
                var credit = postedLines.Where(line => line.AccountCode == account.Code).Sum(line => line.Credit);
                var net = debit - credit;
                return new TrialBalanceLineDto(
                    account.Code,
                    account.Label,
                    debit,
                    credit,
                    net > 0 ? net : 0,
                    net < 0 ? -net : 0);
            })
            .Where(line => line.DebitMovements != 0 || line.CreditMovements != 0)
            .OrderBy(line => line.AccountCode)
            .ToList();
    }

    private AccountingEntryDto Map(AccountingEntry entry, string description)
    {
        var lines = entry.Lines.Select(line => new AccountingEntryLineDto(
            line.Id,
            line.AccountCode,
            _accounts.Single(account => account.Code == line.AccountCode).Label,
            line.Label,
            line.Debit,
            line.Credit)).ToList();

        return new AccountingEntryDto(
            entry.Id,
            entry.JournalCode,
            entry.EntryDate,
            entry.Reference,
            string.IsNullOrWhiteSpace(description) ? lines[0].Label : description.Trim(),
            entry.Status == AccountingEntryStatus.Posted ? "Validée" : "Brouillon",
            entry.TotalDebit,
            entry.TotalCredit,
            entry.CreatedAt,
            entry.PostedAt,
            lines);
    }

    private void EnsurePeriodOpen(DateOnly entryDate)
    {
        var period = _periods.SingleOrDefault(item => item.Year == entryDate.Year && item.Month == entryDate.Month);
        if (period is null)
        {
            throw new DomainRuleException("La date de la pièce n'appartient pas à l'exercice courant.");
        }

        if (period.IsClosed)
        {
            throw new DomainRuleException($"La période {period.Label} est clôturée.");
        }
    }

    private void SeedEntries()
    {
        AddSeed("VTE", new DateOnly(2026, 1, 8), "FV-2026-001", "Vente au comptant", true,
            ("411100", "Client comptant", 1_180_000m, 0m),
            ("701100", "Vente de marchandises", 0m, 1_000_000m),
            ("443100", "TVA facturée", 0m, 180_000m));
        AddSeed("ACH", new DateOnly(2026, 1, 12), "FA-2026-004", "Approvisionnement", true,
            ("601100", "Achat de marchandises", 400_000m, 0m),
            ("445200", "TVA récupérable", 72_000m, 0m),
            ("401100", "Fournisseur", 0m, 472_000m));
        AddSeed("BQ1", new DateOnly(2026, 1, 18), "BQ-2026-003", "Règlement client", true,
            ("521100", "Encaissement bancaire", 1_180_000m, 0m),
            ("411100", "Règlement client", 0m, 1_180_000m));
        AddSeed("OD", new DateOnly(2026, 2, 1), "OD-2026-001", "Brouillon d'ajustement", false,
            ("601100", "Charge à régulariser", 25_000m, 0m),
            ("401100", "Fournisseur à confirmer", 0m, 25_000m));
    }

    private void AddSeed(
        string journal,
        DateOnly date,
        string reference,
        string description,
        bool post,
        params (string Account, string Label, decimal Debit, decimal Credit)[] lines)
    {
        var entry = AccountingEntry.Create(_fiscalYearId, journal, date, reference, DateTimeOffset.UtcNow.AddDays(-10));
        foreach (var line in lines)
        {
            entry.AddLine(line.Account, line.Label, line.Debit, line.Credit);
        }

        if (post)
        {
            entry.Post(DateTimeOffset.UtcNow.AddDays(-10));
        }

        _entries.Add(Map(entry, description));
    }
}
