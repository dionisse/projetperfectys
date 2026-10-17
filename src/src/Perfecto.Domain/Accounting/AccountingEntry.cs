using Perfecto.Domain.Common;

namespace Perfecto.Domain.Accounting;

public enum AccountingEntryStatus
{
    Draft,
    Posted,
    Reversed
}

public sealed class AccountingEntry
{
    private readonly List<AccountingEntryLine> _lines = [];

    private AccountingEntry()
    {
    }

    private AccountingEntry(Guid fiscalYearId, string journalCode, DateOnly entryDate, string reference, DateTimeOffset createdAt)
    {
        if (fiscalYearId == Guid.Empty)
        {
            throw new DomainRuleException("L'exercice est obligatoire.");
        }

        Id = Guid.NewGuid();
        FiscalYearId = fiscalYearId;
        JournalCode = Require(journalCode, "Le journal est obligatoire.").ToUpperInvariant();
        EntryDate = entryDate;
        Reference = Require(reference, "La référence de pièce est obligatoire.");
        Status = AccountingEntryStatus.Draft;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid FiscalYearId { get; private set; }
    public string JournalCode { get; private set; } = string.Empty;
    public DateOnly EntryDate { get; private set; }
    public string Reference { get; private set; } = string.Empty;
    public AccountingEntryStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? PostedAt { get; private set; }
    public IReadOnlyCollection<AccountingEntryLine> Lines => _lines.AsReadOnly();
    public decimal TotalDebit => _lines.Sum(line => line.Debit);
    public decimal TotalCredit => _lines.Sum(line => line.Credit);
    public bool IsBalanced => _lines.Count >= 2 && TotalDebit == TotalCredit;

    public static AccountingEntry Create(
        Guid fiscalYearId,
        string journalCode,
        DateOnly entryDate,
        string reference,
        DateTimeOffset now) =>
        new(fiscalYearId, journalCode, entryDate, reference, now);

    public void AddLine(string accountCode, string label, decimal debit, decimal credit)
    {
        EnsureDraft();
        _lines.Add(new AccountingEntryLine(accountCode, label, debit, credit));
    }

    public void Post(DateTimeOffset now)
    {
        EnsureDraft();
        if (!IsBalanced)
        {
            throw new DomainRuleException("La pièce doit contenir au moins deux lignes et être équilibrée avant validation.");
        }

        Status = AccountingEntryStatus.Posted;
        PostedAt = now;
    }

    private void EnsureDraft()
    {
        if (Status != AccountingEntryStatus.Draft)
        {
            throw new DomainRuleException("Une pièce validée est immuable. Utilisez une extourne pour la corriger.");
        }
    }

    private static string Require(string value, string message)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized.Length == 0 ? throw new DomainRuleException(message) : normalized;
    }
}
