import { useState } from "preact/hooks";
import type { AccountingPeriodDto } from "@perfecto/contracts";
import { getKernel } from "../kernel";
import { ErrorNote, Loading, PageHero, useAsync } from "../ui";

export function Periods() {
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, reload } = useAsync(() => getKernel().getPeriods());

  const toggle = async (period: AccountingPeriodDto) => {
    try {
      const updated = await getKernel().setPeriodClosed(period.month, !period.isClosed);
      setMessage(`La période ${updated.label} est maintenant ${updated.isClosed ? "clôturée" : "ouverte"}.`);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const upperFirst = (value: string) => (value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1));

  return (
    <>
      <PageHero eyebrow="Contrôles de l'exercice" title="Périodes comptables" subtitle="Ouvrir ou clôturer la saisie mois par mois pour l'exercice 2026." />
      {message ? <div class="form-message success wide-message">{message}</div> : null}
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section class="period-grid">
            {data.map((period) => (
              <article key={period.month} class={`panel period-card ${period.isClosed ? "closed" : "open"}`}>
                <div>
                  <span class="period-number">{String(period.month).padStart(2, "0")}</span>
                  <h2>{upperFirst(period.label)}</h2>
                </div>
                <span class={`status-badge ${period.isClosed ? "draft" : "success"}`}>{period.isClosed ? "Clôturée" : "Ouverte"}</span>
                <button class="button button-secondary full-width" type="button" onClick={() => toggle(period)}>
                  {period.isClosed ? "Rouvrir la période" : "Clôturer la période"}
                </button>
              </article>
            ))}
          </section>
          <section class="panel info-panel">
            <strong>Protection active</strong>
            <p>Une période clôturée refuse toute nouvelle pièce et toute validation d'un brouillon daté dans ce mois, y compris pour un poste qui reprendrait la connexion plus tard.</p>
          </section>
        </>
      )}
    </>
  );
}
