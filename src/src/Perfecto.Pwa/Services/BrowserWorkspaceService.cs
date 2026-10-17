using Microsoft.JSInterop;
using Perfecto.Application.Workspaces;
using Perfecto.Contracts;

namespace Perfecto.Pwa.Services;

public sealed class BrowserWorkspaceService(IJSRuntime jsRuntime) : IWorkspaceService
{
    public async Task<WorkspaceSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        var isOnline = await jsRuntime.InvokeAsync<bool>("perfectoConnectivity.isOnline", cancellationToken);
        var demo = new DemoWorkspaceService(isOnline ? "PWA · synchronisation cloud" : "PWA · cache hors ligne");
        var snapshot = await demo.GetSnapshotAsync(cancellationToken);
        return snapshot with
        {
            IsOnline = isOnline,
            PendingSyncOperations = isOnline ? 0 : Math.Max(3, snapshot.PendingSyncOperations)
        };
    }
}
