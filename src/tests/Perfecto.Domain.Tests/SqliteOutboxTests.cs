using Microsoft.Extensions.DependencyInjection;
using Perfecto.Application.Sync;
using Perfecto.Infrastructure;
using Perfecto.Infrastructure.Persistence;

namespace Perfecto.Domain.Tests;

public sealed class SqliteOutboxTests
{
    [Fact]
    public async Task Enqueue_IsIdempotentAndCompletionRemovesPendingOperation()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"perfecto-{Guid.NewGuid():N}.db");
        try
        {
            var services = new ServiceCollection();
            services.AddPerfectoLocalInfrastructure(databasePath);
            await using var provider = services.BuildServiceProvider();
            await using var scope = provider.CreateAsyncScope();
            await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
            var outbox = scope.ServiceProvider.GetRequiredService<ISyncOutbox>();
            var operation = new PendingOperation(
                Guid.NewGuid(),
                Guid.NewGuid(),
                "accounting.entry.created",
                "{}",
                DateTimeOffset.UtcNow,
                0);

            await outbox.EnqueueAsync(operation);
            await outbox.EnqueueAsync(operation);

            var pending = await outbox.GetPendingAsync();
            Assert.Single(pending);
            await outbox.MarkCompletedAsync(operation.Id);
            Assert.Empty(await outbox.GetPendingAsync());
        }
        finally
        {
            if (File.Exists(databasePath))
            {
                File.Delete(databasePath);
            }
        }
    }
}
