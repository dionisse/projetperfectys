import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { AuditEventDto } from "@perfecto/contracts";
import {
  accountingEntryStatusLabel,
  amountFromDecimal,
  formatAmount,
  formatCivilDateFr,
  type AccountingEntryStatus
} from "@perfecto/domain";
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

/**
 * « 02/03/2026 11:30 » — construit à la main : `Intl` en français insère des
 * espaces insécables U+202F qui cassent les comparaisons et certains rendus.
 */
export function formatTimestamp(iso: string): string {
  return `${formatCivilDateFr(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
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
export function AuditTrailFor(props: { entityId: string; entityType?: string; limit?: number; title: string }) {
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
      {!data ? <p class="muted audit-empty">Chargement de la piste d'audit…</p> : <AuditTimeline events={data} />}
    </div>
  );
}
