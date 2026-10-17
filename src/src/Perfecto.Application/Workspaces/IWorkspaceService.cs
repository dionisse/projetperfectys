using Perfecto.Contracts;

namespace Perfecto.Application.Workspaces;

public interface IWorkspaceService
{
    Task<WorkspaceSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default);
}
