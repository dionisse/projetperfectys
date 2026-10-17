using Perfecto.Contracts.Accounting;

namespace Perfecto.Application.Accounting;

public interface IAccountingService
{
    Task<AccountingSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GeneralAccountDto>> GetAccountsAsync(string? search = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountingJournalDto>> GetJournalsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountingEntryDto>> GetEntriesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<JournalLineDto>> GetJournalLinesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<LedgerAccountDto>> GetGeneralLedgerAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AccountingPeriodDto>> GetPeriodsAsync(CancellationToken cancellationToken = default);
    Task<AccountingEntryDto> SaveEntryAsync(CreateAccountingEntryRequest request, CancellationToken cancellationToken = default);
    Task<AccountingEntryDto> PostEntryAsync(Guid entryId, CancellationToken cancellationToken = default);
    Task<GeneralAccountDto> CreateAccountAsync(CreateGeneralAccountRequest request, CancellationToken cancellationToken = default);
    Task<AccountingPeriodDto> SetPeriodClosedAsync(int month, bool isClosed, CancellationToken cancellationToken = default);
}
