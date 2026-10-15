import { useState } from "preact/hooks";
import { DocumentKind } from "@perfecto/contracts";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import { ErrorNote, ExportBar, Loading, PageHero, entityTypeLabel, formatTimestamp, useAsync } from "../ui";

const SCOPES = [
  { id: "", label: "Tout l'historique", entityType: undefined as string | undefined },
  { id: "AccountingEntry", label: "Pièces", entityType: "AccountingEntry" },
  { id: "ThirdParty", label: "Tiers", entityType: "ThirdParty" },
  { id: "GeneralAccount", label: "Comptes", entityType: "GeneralAccount" },
  { id: "AccountingPeriod", label: "Périodes", entityType: "AccountingPeriod" }
] as const;

const LIMITS = [50, 200, 1000] as const;

/**
 * Piste d'audit exposée à l'écran : chaque mutation du noyau est tracée
 * (acteur, action, entité, horodatage, détails). Exigence du cadrage v2 —
 * aucune écriture comptable ne doit être modifiable sans laisser de trace.
 */
export function AuditLog() {
  const [scope, setScope] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);

  const active = SCOPES.find((item) => item.id === scope) ?? SCOPES[0]!;
  const { data, error } = useAsync(
    () => getKernel().getAuditLog({ entityType: active.entityType, limit }),
    [scope, limit]
  );

  return (
    <>
      <PageHero
        eyebrow="Contrôle interne"
        title="Piste d'audit"
        subtitle="Historique horodaté des opérations réalisées sur cet espace, conservé dans la base locale."
      >
        <label class="field inline-field">
          <span>Afficher</span>
          <select value={String(limit)} onChange={(event) => setLimit(Number(event.currentTarget.value))}>
            {LIMITS.map((value) => (
              <option key={value} value={value}>
                {value} derniers événements
              </option>
            ))}
          </select>
        </label>
      </PageHero>

      <ErrorNote message={error} />

      <section class="panel data-panel">
        <div class="table-toolbar">
          <div class="filter-tabs">
            {SCOPES.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                class={scope === item.id ? "active" : undefined}
                onClick={() => setScope(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <span class="result-count">{data ? `${data.length} événement(s)` : "…"}</span>
        </div>

        <ExportBar
          request={{
            organizationId: DEMO_ORGANIZATION_ID,
            kind: DocumentKind.auditTrail,
            ...(active.entityType ? { entityType: active.entityType } : {}),
            limit
          }}
          label="Exporter la piste d'audit"
        />

        {!data ? (
          <Loading label="Chargement de l'historique…" />
        ) : data.length === 0 ? (
          <p class="muted">Aucun événement pour ce filtre.</p>
        ) : (
          <div class="responsive-table tall-table">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Horodatage</th>
                  <th>Opération</th>
                  <th>Entité</th>
                  <th>Identifiant</th>
                  <th>Détails</th>
                  <th>Acteur</th>
                </tr>
              </thead>
              <tbody>
                {data.map((event) => (
                  <tr key={event.id}>
                    <td class="audit-time">{formatTimestamp(event.occurredAt)}</td>
                    <td><strong>{event.actionLabel}</strong><br /><small class="muted">{event.action}</small></td>
                    <td>{entityTypeLabel(event.entityType)}</td>
                    <td><span class="code-badge">{event.entityId}</span></td>
                    <td>{event.details || "—"}</td>
                    <td>{event.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section class="panel info-panel">
        <strong>Ce que garantit le noyau</strong>
        <p>
          Une pièce validée est immuable : sa correction passera par une extourne. Un brouillon révisé conserve son
          numéro et horodate la révision. Un tiers désactivé reste consultable et continue d'alimenter les relevés,
          mais ne peut plus être imputé. Chaque opération ci-dessus est écrite dans la base locale avant la réponse à
          l'écran.
        </p>
      </section>
    </>
  );
}
