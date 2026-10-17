using Microsoft.EntityFrameworkCore;
using Perfecto.Application.Sync;
using Perfecto.Infrastructure.Persistence;

namespace Perfecto.Infrastructure.Sync;

public sealed class SqliteSyncOutbox(IDbContextFactory<PerfectoDbContext> contextFactory) : ISyncOutbox
{
    public async Task EnqueueAsync(PendingOperation operation, CancellationToken cancellationToken = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(cancellationToken);
        if (await db.OutboxRecords.AnyAsync(item => item.Id == operation.Id, cancellationToken))
        {
            return;
        }

        db.OutboxRecords.Add(new OutboxRecord
        {
            Id = operation.Id,
            OrganizationId = operation.OrganizationId,
            OperationType = operation.OperationType,
            Payload = operation.Payload,
            CreatedAt = operation.CreatedAt,
            AttemptCount = operation.AttemptCount
        });
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PendingOperation>> GetPendingAsync(CancellationToken cancellationToken = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(cancellationToken);
        var records = await db.OutboxRecords
            .AsNoTracking()
            .Where(item => item.CompletedAt == null)
            .ToListAsync(cancellationToken);

        return records
            .OrderBy(item => item.CreatedAt)
            .Select(item => new PendingOperation(
                item.Id,
                item.OrganizationId,
                item.OperationType,
                item.Payload,
                item.CreatedAt,
                item.AttemptCount))
            .ToList();
    }

    public async Task MarkCompletedAsync(Guid operationId, CancellationToken cancellationToken = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(cancellationToken);
        var record = await db.OutboxRecords.SingleOrDefaultAsync(item => item.Id == operationId, cancellationToken);
        if (record is null || record.CompletedAt is not null)
        {
            return;
        }

        record.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
    }
}
