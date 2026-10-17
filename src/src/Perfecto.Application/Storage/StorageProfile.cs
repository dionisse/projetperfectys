namespace Perfecto.Application.Storage;

public enum DeploymentMode
{
    LocalSolo,
    LocalTeam,
    Cloud
}

public sealed record StorageProfile(
    DeploymentMode DeploymentMode,
    string Provider,
    string Location,
    bool OfflineEnabled,
    bool SynchronizationEnabled);

public interface IStorageProfileProvider
{
    StorageProfile Current { get; }
}
