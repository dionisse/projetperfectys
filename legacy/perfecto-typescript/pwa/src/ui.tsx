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

/* ------------------------------------------------------------------ */
/* Jeu d'icônes : traits de 1,6 px, grille de 24 — langage shadcn.     */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, ComponentChildren> = {
  home: (
    <>
      <path d="M3.6 10.7 12 4l8.4 6.7" />
      <path d="M5.9 9.7V20h12.2V9.7" />
    </>
  ),
  folder: (
    <path d="M3.5 7.6A2.1 2.1 0 0 1 5.6 5.5h3.1a1 1 0 0 1 .8.4l1 1.3a1 1 0 0 0 .8.4h5.1a2.1 2.1 0 0 1 2.1 2.1v7.7a2.1 2.1 0 0 1-2.1 2.1H5.6a2.1 2.1 0 0 1-2.1-2.1z" />
  ),
  book: (
    <>
      <path d="M4.5 5.6A2.1 2.1 0 0 1 6.6 3.5h12.9v13.1H6.6a2.1 2.1 0 0 0-2.1 2.1z" />
      <path d="M4.5 18.7a2.1 2.1 0 0 1 2.1-2.1h12.9v3.9H6.6a2.1 2.1 0 0 1-2.1-1.8z" />
    </>
  ),
  users: (
    <>
      <path d="M15.4 20v-1.7a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.3V20" />
      <circle cx="9.2" cy="7.6" r="3.4" />
      <path d="M21 20v-1.7a3.6 3.6 0 0 0-2.7-3.5M15.9 4.3a3.6 3.6 0 0 1 0 6.7" />
    </>
  ),
  file: (
    <>
      <path d="M13.9 3.5H7.4a1.9 1.9 0 0 0-1.9 1.9v13.2a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V8.1z" />
      <path d="M13.9 3.5v4.6h4.6M8.8 13.2h6.4M8.8 16.6h4.4" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4.2v15.6M8.2 19.8h7.6M4.6 7.8h14.8" />
      <path d="M4.6 7.8 2.4 13.4a2.4 2.4 0 0 0 4.4 0zM19.4 7.8l2.2 5.6a2.4 2.4 0 0 1-4.4 0z" />
    </>
  ),
  grid: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="1.9" />
      <path d="M3.6 9.6h16.8M9.6 9.6v10.8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.6" y="5.2" width="16.8" height="15.2" rx="1.9" />
      <path d="M8.2 3.4v3.6M15.8 3.4v3.6M3.6 10.2h16.8" />
    </>
  ),
  printer: (
    <>
      <path d="M7.2 8.6V3.6h9.6v5" />
      <rect x="3.6" y="8.6" width="16.8" height="7.4" rx="1.9" />
      <path d="M7.2 13.8h9.6v6.6H7.2z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.9v2.5M12 18.6v2.5M4.9 7.6l2.2 1.2M16.9 15.2l2.2 1.2M4.9 16.4l2.2-1.2M16.9 8.8l2.2-1.2" />
    </>
  ),
  wrench: (
    <path d="M20.2 6.2a4.6 4.6 0 0 1-6.1 6.1L7 19.4a2.2 2.2 0 0 1-3.1-3.1l7.1-7.1a4.6 4.6 0 0 1 6.1-6.1l-2.7 2.7 2 2z" />
  ),
  shield: (
    <>
      <path d="M12 20.8s7.2-3.4 7.2-9V6L12 3.2 4.8 6v5.8c0 5.6 7.2 9 7.2 9z" />
      <path d="M9.2 11.9l1.9 1.9 3.7-3.7" />
    </>
  )
};

export function Icon(props: { name: string; size?: number }) {
  const size = props.size ?? 16;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[props.name] ?? ICONS.file}
    </svg>
  );
}
