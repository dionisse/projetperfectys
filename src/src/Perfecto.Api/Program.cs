using Perfecto.Application.Sync;
using Perfecto.Application.Workspaces;
using Perfecto.Infrastructure;
using Perfecto.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);

var configuredPath = builder.Configuration["Storage:DatabasePath"];
var databasePath = string.IsNullOrWhiteSpace(configuredPath)
    ? Path.Combine(builder.Environment.ContentRootPath, "data", "perfecto-api.db")
    : Path.GetFullPath(configuredPath, builder.Environment.ContentRootPath);

builder.Services.AddPerfectoLocalInfrastructure(databasePath);
builder.Services.AddScoped<IWorkspaceService>(_ => new DemoWorkspaceService("API · stockage local de développement"));
builder.Services.AddCors(options => options.AddPolicy("development", policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseCors("development");
}

await using (var scope = app.Services.CreateAsyncScope())
{
    await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync();
}

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    product = "PERFECTO Nouvelle Génération",
    version = "0.1.0-lot0",
    utc = DateTimeOffset.UtcNow
}));

app.MapGet("/api/workspace", async (IWorkspaceService workspace, CancellationToken cancellationToken) =>
    Results.Ok(await workspace.GetSnapshotAsync(cancellationToken)));

app.MapGet("/api/sync/pending", async (ISyncOutbox outbox, CancellationToken cancellationToken) =>
    Results.Ok(await outbox.GetPendingAsync(cancellationToken)));

app.Run();

public partial class Program;
