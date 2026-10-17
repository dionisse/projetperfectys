namespace Perfecto.Contracts;

public sealed record OrganizationSummary(
    Guid Id,
    string Code,
    string Name,
    string BaseCurrency);

public sealed record FiscalYearSummary(
    Guid Id,
    string Label,
    DateOnly StartsOn,
    DateOnly EndsOn,
    string AccountingProfile,
    string Status);

public sealed record ModuleSummary(
    string Code,
    string Name,
    string Description,
    string Status,
    string Route,
    int ProgressPercent);

public sealed record ActivitySummary(
    string Title,
    string Detail,
    DateTimeOffset OccurredAt,
    string Tone);

public sealed record WorkspaceSnapshot(
    OrganizationSummary Organization,
    FiscalYearSummary FiscalYear,
    IReadOnlyList<ModuleSummary> Modules,
    IReadOnlyList<ActivitySummary> Activities,
    int DraftEntries,
    int PendingSyncOperations,
    int OpenPeriods,
    string RuntimeMode,
    bool IsOnline);
