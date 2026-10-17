using Microsoft.EntityFrameworkCore;
using Perfecto.Domain.Accounting;
using Perfecto.Domain.Auditing;
using Perfecto.Domain.Organizations;

namespace Perfecto.Infrastructure.Persistence;

public sealed class DatabaseInitializer(IDbContextFactory<PerfectoDbContext> contextFactory)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var db = await contextFactory.CreateDbContextAsync(cancellationToken);
        await db.Database.EnsureCreatedAsync(cancellationToken);

        if (await db.Organizations.AnyAsync(cancellationToken))
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var organization = Organization.Create("000", "SOCIÉTÉ DÉMO", "XOF", now);
        organization.UpdateIdentity("SOCIÉTÉ DÉMO", "IFU-DEMO", "XOF", now);
        var fiscalYear = FiscalYear.Create(
            organization.Id,
            "Exercice 2026",
            new DateOnly(2026, 1, 1),
            new DateOnly(2026, 12, 31),
            "SYSCOHADA-R",
            now);
        fiscalYear.Open(now);

        db.Organizations.Add(organization);
        db.FiscalYears.Add(fiscalYear);
        db.AuditEvents.Add(AuditEvent.Record(
            organization.Id,
            "system",
            "workspace.initialized",
            nameof(Organization),
            organization.Id.ToString(),
            now,
            "Initialisation du socle Lot 0."));

        await db.SaveChangesAsync(cancellationToken);
    }
}
