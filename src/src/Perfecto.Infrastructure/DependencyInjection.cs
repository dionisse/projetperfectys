using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Perfecto.Application.Storage;
using Perfecto.Application.Sync;
using Perfecto.Infrastructure.Persistence;
using Perfecto.Infrastructure.Storage;
using Perfecto.Infrastructure.Sync;

namespace Perfecto.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddPerfectoLocalInfrastructure(
        this IServiceCollection services,
        string databasePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(databasePath);

        var directory = Path.GetDirectoryName(databasePath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        services.AddDbContextFactory<PerfectoDbContext>(options =>
            options.UseSqlite($"Data Source={databasePath}"));
        services.AddSingleton<IStorageProfileProvider>(new LocalStorageProfileProvider(databasePath));
        services.AddScoped<ISyncOutbox, SqliteSyncOutbox>();
        services.AddScoped<DatabaseInitializer>();
        return services;
    }
}
