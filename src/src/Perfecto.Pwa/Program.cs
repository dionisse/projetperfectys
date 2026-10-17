using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Perfecto.Application.Accounting;
using Perfecto.Application.Workspaces;
using Perfecto.Pwa;
using Perfecto.Pwa.Services;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(builder.HostEnvironment.BaseAddress) });
builder.Services.AddScoped<IWorkspaceService, BrowserWorkspaceService>();
builder.Services.AddScoped<IAccountingService, IndexedDbAccountingService>();

await builder.Build().RunAsync();
