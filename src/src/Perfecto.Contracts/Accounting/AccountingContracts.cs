namespace Perfecto.Contracts.Accounting;

public sealed record GeneralAccountDto(
    string Code,
    string Label,
    string AccountClass,
    string AccountType,
    bool AllowsPosting,
    bool RequiresThirdParty,
    bool IsActive);

public sealed record AccountingJournalDto(
    string Code,
    string Label,
    string JournalType,
    string? CounterpartAccount,
    bool IsActive);

public sealed record AccountingEntryLineDto(
    Guid Id,
    string AccountCode,
    string AccountLabel,
    string Label,
    decimal Debit,
    decimal Credit);

public sealed record AccountingEntryDto(
    Guid Id,
    string JournalCode,
    DateOnly EntryDate,
    string Reference,
    string Description,
    string Status,
    decimal TotalDebit,
    decimal TotalCredit,
    DateTimeOffset CreatedAt,
    DateTimeOffset? PostedAt,
    IReadOnlyList<AccountingEntryLineDto> Lines);

public sealed record TrialBalanceLineDto(
    string AccountCode,
    string AccountLabel,
    decimal DebitMovements,
    decimal CreditMovements,
    decimal DebitBalance,
    decimal CreditBalance);

public sealed record JournalLineDto(
    DateOnly EntryDate,
    string JournalCode,
    string Reference,
    string AccountCode,
    string AccountLabel,
    string Label,
    decimal Debit,
    decimal Credit);

public sealed record LedgerLineDto(
    DateOnly EntryDate,
    string JournalCode,
    string Reference,
    string Label,
    decimal Debit,
    decimal Credit,
    decimal RunningBalance);

public sealed record LedgerAccountDto(
    string AccountCode,
    string AccountLabel,
    decimal TotalDebit,
    decimal TotalCredit,
    decimal ClosingBalance,
    IReadOnlyList<LedgerLineDto> Lines);

public sealed record AccountingPeriodDto(
    int Year,
    int Month,
    string Label,
    bool IsClosed,
    DateTimeOffset? ClosedAt);

public sealed record AccountingSnapshot(
    int AccountCount,
    int JournalCount,
    int DraftEntryCount,
    int PostedEntryCount,
    decimal TotalDebitMovements,
    decimal TotalCreditMovements,
    IReadOnlyList<AccountingEntryDto> RecentEntries,
    IReadOnlyList<TrialBalanceLineDto> TrialBalance,
    string StorageMode);

public sealed class AccountingEntryLineInput
{
    public string AccountCode { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
}

public sealed class CreateAccountingEntryRequest
{
    public string JournalCode { get; set; } = "OD";
    public DateOnly EntryDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);
    public string Reference { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool PostImmediately { get; set; }
    public List<AccountingEntryLineInput> Lines { get; set; } = [];
}

public sealed class CreateGeneralAccountRequest
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string AccountType { get; set; } = "Général";
    public bool RequiresThirdParty { get; set; }
}
