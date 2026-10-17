using Perfecto.Application.Storage;

namespace Perfecto.Infrastructure.Storage;

public sealed class LocalStorageProfileProvider(string databasePath) : IStorageProfileProvider
{
    public StorageProfile Current { get; } = new(
        DeploymentMode.LocalSolo,
        "SQLite",
        databasePath,
        OfflineEnabled: true,
        SynchronizationEnabled: false);
}
