import { useEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import { accountingEntryStatusLabel, amountFromDecimal, formatAmount, type AccountingEntryStatus } from "@perfecto/domain";

/** Formatage français des montants sérialisés (« 2 832 000 XOF »). */
export function money(value: string): string {
  return formatAmount(amountFromDecimal(value));
}

export function signedMoney(value: string): string {
  const amount = amountFromDecimal(value);
  if (amount === 0n) return "0";
  return amount > 0n ? `${formatAmount(amount)} D` : `${formatAmount(-amount)} C`;
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
  const className = props.status === "posted" ? "success" : props.status === "draft" ? "draft" : "draft";
  return <span class={`status-badge ${className}`}>{accountingEntryStatusLabel[props.status]}</span>;
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
