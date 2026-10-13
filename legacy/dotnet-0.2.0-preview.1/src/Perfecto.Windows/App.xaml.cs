using System.IO;
using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Perfecto.Application.Accounting;
using Perfecto.Application.Workspaces;
using Perfecto.Infrastructure;
using Perfecto.Infrastructure.Persistence;

namespace Perfecto.Windows;

public partial class App : System.Windows.Application
{
    private ServiceProvider? _services;

    protected override async void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var services = new ServiceCollection();
        services.AddWpfBlazorWebView();
#if DEBUG
        services.AddBlazorWebViewDeveloperTools();
#endif
        services.AddSingleton<IWorkspaceService>(new DemoWorkspaceService("Windows · SQLite local · hors ligne"));
        services.AddSingleton<IAccountingService, DemoAccountingService>();

        var applicationData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "PerfectoNext");
        services.AddPerfectoLocalInfrastructure(Path.Combine(applicationData, "perfecto.db"));

        _services = services.BuildServiceProvider();

        await using (var scope = _services.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
        }

        var window = new MainWindow(_services);
        MainWindow = window;
        window.Show();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _services?.Dispose();
        base.OnExit(e);
    }
}
