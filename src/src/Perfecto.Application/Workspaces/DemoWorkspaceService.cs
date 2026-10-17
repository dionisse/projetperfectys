using Perfecto.Contracts;

namespace Perfecto.Application.Workspaces;

public sealed class DemoWorkspaceService(string runtimeMode) : IWorkspaceService
{
    private static readonly Guid OrganizationId = Guid.Parse("3e6f6391-60a5-473f-b85a-2edbc44e93ef");
    private static readonly Guid FiscalYearId = Guid.Parse("5f3accb0-dc6d-46a2-9c3c-f805fbab77a9");

    public Task<WorkspaceSnapshot> GetSnapshotAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var snapshot = new WorkspaceSnapshot(
            new OrganizationSummary(OrganizationId, "000", "SOCIÉTÉ DÉMO", "XOF"),
            new FiscalYearSummary(
                FiscalYearId,
                "Exercice 2026",
                new DateOnly(2026, 1, 1),
                new DateOnly(2026, 12, 31),
                "SYSCOHADA révisé",
                "Ouvert"),
            [
                new("CG", "Comptabilité générale", "Plan, journaux, pièces et balance SYSCOHADA.", "Lot 1 en cours", "/comptabilite", 52),
                new("AN", "Comptabilité analytique", "Axes, sections, budgets et clés de répartition.", "Planifié", "/analytique", 8),
                new("VS", "Ventes, stocks & facturation", "Cycle commercial, inventaire et factures.", "Planifié", "/ventes-stocks", 4),
                new("CO", "Gestion des courriers", "Registres entrants et sortants, affectations et suivi.", "Planifié", "/courriers", 3),
                new("PA", "Paie", "Salariés, bulletins, déclarations et écritures automatiques.", "Cadrage pays requis", "/paie", 1)
            ],
            [
                new("Socle partagé initialisé", "Domaine, contrats et interfaces Windows/PWA prêts.", DateTimeOffset.UtcNow.AddMinutes(-12), "success"),
                new("Référentiel sélectionné", "SYSCOHADA révisé — profil CR.", DateTimeOffset.UtcNow.AddMinutes(-28), "info"),
                new("Mode hors ligne disponible", "Les ressources de la PWA sont mises en cache après publication.", DateTimeOffset.UtcNow.AddMinutes(-45), "warning")
            ],
            DraftEntries: 7,
            PendingSyncOperations: runtimeMode.Contains("hors ligne", StringComparison.OrdinalIgnoreCase) ? 3 : 0,
            OpenPeriods: 12,
            RuntimeMode: runtimeMode,
            IsOnline: !runtimeMode.Contains("hors ligne", StringComparison.OrdinalIgnoreCase));

        return Task.FromResult(snapshot);
    }
}
