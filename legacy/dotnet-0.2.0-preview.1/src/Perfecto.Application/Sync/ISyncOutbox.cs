namespace Perfecto.Application.Sync;

public sealed record PendingOperation(
    Guid Id,
    Guid OrganizationId,
    string OperationType,
    string Payload,
    DateTimeOffset CreatedAt,
    int AttemptCount);

public interface ISyncOutbox
{
    Task EnqueueAsync(PendingOperation operation, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PendingOperation>> GetPendingAsync(CancellationToken cancellationToken = default);
    Task MarkCompletedAsync(Guid operationId, CancellationToken cancellationToken = default);
}
