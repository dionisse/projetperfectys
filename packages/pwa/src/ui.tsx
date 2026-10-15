import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type {
  AuditEventDto,
  ExportDocumentRequest,
  ExportFormat,
  ExportedFile
} from "@perfecto/contracts";
import { exportFormatExtensions, exportFormatLabels, exportFormatShortLabels } from "@perfecto/contracts";
import { EXPORT_FORMATS } from "@perfecto/exports";
import {
  accountingEntryStatusLabel,
  amountFromDecimal,
  formatAmount,
  formatCivilDateFr,
  formatTimestampFr,
  type AccountingEntryStatus
} from "@perfecto/domain";
import { downloadFile, exportDocument, exportOutcomeMessage } from "./downloads";
import { getKernel } from "./kernel";

/** Formatage français des montants sérialisés (« 2 832 000 XOF »). */
export function money(value: string): string {
  return formatAmount(amountFromDecimal(value));
}

export function signedMoney(value: string): string {
  const amount = amountFromDecimal(value);
  if (amount === 0n) return "0";
  return amount > 0n ? `${formatAmount(amount)} D` : `${formatAmount(-amount)} C`;
}

/** « 02/03/2026 11:30 » — délégué au domaine : mêmes horodatages à l'écran et sur les documents. */
export function formatTimestamp(iso: string): string {
  return formatTimestampFr(iso);
}

export const entityTypeLabels: Record<string, string> = {
  AccountingEntry: "Pièce comptable",
  ThirdParty: "Tiers",
  GeneralAccount: "Compte général",
  AccountingPeriod: "Période comptable"
};

export function entityTypeLabel(value: string): string {
  return entityTypeLabels[value] ?? value;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(null);
    fn()
      .then((result) => {
        if (alive) setData(result);
      })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, reload: () => setTick((value) => value + 1) };
}

export function currentRoute(): string {
  const hash = location.hash.replace(/^#/, "");
  return hash === "" ? "/" : hash;
}

export function navigate(to: string): void {
  location.hash = to;
}

export function useRoute(): string {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const onChange = () => setRoute(currentRoute());
    addEventListener("hashchange", onChange);
    return () => removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function Link(props: { href: string; class?: string | undefined; children?: ComponentChildren }) {
  return (
    <a href={`#${props.href}`} class={props.class}>
      {props.children}
    </a>
  );
}

export function StatusBadge(props: { status: AccountingEntryStatus }) {
  const className =
    props.status === "posted" ? "success" : props.status === "reversed" ? "reversed" : "draft";
  return <span class={`status-badge ${className}`}>{accountingEntryStatusLabel[props.status]}</span>;
}

/** Numéro automatique de pièce : `ACH-2026-0001`. */
export function EntryNumber(props: { value: string }) {
  return <span class="code-badge entry-number" title="Numéro attribué par le noyau">{props.value}</span>;
}

/** Pastille de tiers ; affiche un tiret quand la ligne n'en porte pas. */
export function TierChip(props: { code: string | null; name?: string | null }) {
  if (!props.code) return <span class="muted">—</span>;
  return (
    <span class="code-badge tier-chip" title={props.name ?? props.code}>
      {props.code}
    </span>
  );
}

export function Loading(props: { label?: string }) {
  return (
    <section class="loading-panel">
      <div class="loading-bar"></div>
      <p>{props.label ?? "Chargement…"}</p>
    </section>
  );
}

export function ErrorNote(props: { message: string | null }) {
  if (!props.message) return null;
  return <div class="form-message error wide-message">{props.message}</div>;
}

export function PageHero(props: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ComponentChildren;
}) {
  return (
    <section class="module-hero compact-hero">
      <div>
        <span class="eyebrow">{props.eyebrow}</span>
        <h1>{props.title}</h1>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </div>
      <div class="accounting-actions">{props.children}</div>
    </section>
  );
}

function markerClass(action: string): string {
  if (action.endsWith(".posted") || action.endsWith(".created") || action.endsWith(".reactivated")) {
    return "success";
  }
  if (
    action.endsWith(".updated") ||
    action.endsWith(".closed") ||
    action.endsWith(".deactivated") ||
    action.endsWith(".reopened")
  ) {
    return "warning";
  }
  return "";
}

/** Piste d'audit déjà chargée : simple affichage chronologique. */
export function AuditTimeline(props: { events: AuditEventDto[]; emptyLabel?: string }) {
  if (props.events.length === 0) {
    return <p class="muted audit-empty">{props.emptyLabel ?? "Aucun événement tracé pour le moment."}</p>;
  }
  return (
    <ul class="activity-list">
      {props.events.map((event) => (
        <li key={event.id}>
          <span class={`activity-marker ${markerClass(event.action)}`}></span>
          <div>
            <strong>{event.actionLabel}</strong>
            <p>{event.details || entityTypeLabel(event.entityType)}</p>
            <small>
              {formatTimestamp(event.occurredAt)} · {event.actor} · {entityTypeLabel(event.entityType)}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Charge puis affiche la piste d'audit d'une entité précise (pièce, tiers…). */
export function AuditTrailFor(props: {
  entityId: string;
  entityType?: string;
  limit?: number;
  title: string;
  /** Texte affiché quand l'entité n'a encore aucun événement. */
  emptyLabel?: string;
}) {
  const { data, error } = useAsync(
    () =>
      getKernel().getAuditLog({
        entityId: props.entityId,
        entityType: props.entityType,
        limit: props.limit ?? 20
      }),
    [props.entityId, props.entityType, props.limit]
  );

  return (
    <div class="audit-trail">
      <span class="eyebrow">{props.title}</span>
      <ErrorNote message={error} />
      {!data ? (
        <p class="muted audit-empty">Chargement de la piste d'audit…</p>
      ) : (
        // `exactOptionalPropertyTypes` : on ne transmet la prop que si elle a une valeur.
        <AuditTimeline events={data} {...(props.emptyLabel ? { emptyLabel: props.emptyLabel } : {})} />
      )}
    </div>
  );
}

/**
 * Choix du format d'export : trois boutons, un par format, devant le même document.
 *
 * C'est l'utilisateur qui décide — la spécification posée pour cette tranche est explicite :
 * tout document doit sortir en PDF, en Excel **et** en CSV. La barre est donc posée à
 * l'identique sur les états comptables, sur les fiches et sur la page des éditions, et le
 * résultat est annoncé en toutes lettres (nom, format, poids) pour qu'un contrôle interne
 * puisse retrouver le fichier produit.
 */
export function ExportBar(props: {
  request: ExportDocumentRequest;
  label?: string;
  onExported?: (file: ExportedFile) => void;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function download(format: ExportFormat) {
    setBusy(format);
    setMessage(null);
    setFailure(null);
    try {
      const file = await exportDocument(props.request, format);
      const downloaded = downloadFile(file);
      setMessage(exportOutcomeMessage(file, downloaded));
      props.onExported?.(file);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div class="export-bar">
      <span class="eyebrow">{props.label ?? "Exporter ce document"}</span>
      <div class="export-choices" role="group" aria-label="Choisir le format d'export">
        {EXPORT_FORMATS.map((format) => (
          <button
            key={format}
            type="button"
            data-format={format}
            class="button button-secondary export-choice"
            title={exportFormatLabels[format]}
            aria-label={`${exportFormatLabels[format]} — télécharger au format ${exportFormatShortLabels[format]}`}
            disabled={busy !== null}
            onClick={() => void download(format)}
          >
            <span class="export-format">{exportFormatShortLabels[format]}</span>
            <span class="export-extension">.{exportFormatExtensions[format]}</span>
          </button>
        ))}
      </div>
      {busy ? (
        <span class="export-busy" role="status">
          Génération du {exportFormatShortLabels[busy]} en cours…
        </span>
      ) : null}
      {message ? (
        <span class="export-message" role="status">
          {message}
        </span>
      ) : null}
      {failure ? (
        <span class="export-failure" role="alert">
          {failure}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Aperçu du document tel qu'il sortira, suivi de ses trois boutons d'export.
 *
 * L'aperçu lit le modèle neutre produit par le noyau : ce que l'écran montre est donc
 * exactement ce que les trois moteurs mettent en forme, sans deuxième calcul.
 */
export function ExportPanel(props: {
  request: ExportDocumentRequest;
  heading: string;
  hint?: string;
  /** Nombre de lignes affichées à l'écran ; le document téléchargé reste complet. */
  maxRows?: number;
}) {
  const key = JSON.stringify(props.request);
  const { data, error } = useAsync(() => getKernel().getExportDocument(props.request), [key]);
  const maxRows = props.maxRows ?? 12;

  return (
    <section class="panel export-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Aperçu du document</span>
          <h2>{props.heading}</h2>
          {props.hint ? <p>{props.hint}</p> : null}
        </div>
        {data ? <span class="status-badge">{data.rows.length} ligne(s)</span> : null}
      </div>

      <ErrorNote message={error} />

      {!data ? (
        error ? null : (
          <Loading />
        )
      ) : (
        <>
          <ExportBar request={props.request} />

          {data.fields.length > 0 ? (
            <dl class="document-fields">
              {data.fields.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div class="responsive-table">
            <table class="data-table document-preview">
              <caption class="visually-hidden">
                {data.title}
                {data.subtitle ? ` — ${data.subtitle}` : ""}
              </caption>
              <thead>
                <tr>
                  {data.columns.map((column) => (
                    <th key={column.key} scope="col" class={column.align === "right" ? "number" : undefined}>
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.slice(0, maxRows).map((row, index) => (
                  <tr
                    key={index}
                    class={
                      row.emphasis === "section"
                        ? "document-section"
                        : row.emphasis === "total"
                          ? "document-total"
                          : undefined
                    }
                  >
                    {row.cells.map((cell, cellIndex) => (
                      <td
                        key={data.columns[cellIndex]?.key ?? cellIndex}
                        class={data.columns[cellIndex]?.align === "right" ? "number" : undefined}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {data.totals ? (
                <tfoot>
                  <tr>
                    {data.totals.cells.map((cell, cellIndex) => (
                      <th
                        key={data.columns[cellIndex]?.key ?? cellIndex}
                        scope="col"
                        class={data.columns[cellIndex]?.align === "right" ? "number" : undefined}
                      >
                        {cell.text}
                      </th>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>

          {data.rows.length > maxRows ? (
            <p class="document-more">
              Aperçu limité aux {maxRows} premières lignes : le document téléchargé en compte{" "}
              {data.rows.length}.
            </p>
          ) : null}

          <p class="document-footer">{data.footer}</p>
        </>
      )}
    </section>
  );
}
