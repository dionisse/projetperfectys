import { useState } from "preact/hooks";
import type { AccountingEntryDto } from "@perfecto/contracts";
import { formatCivilDateFr } from "@perfecto/domain";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import {
  AuditTrailFor,
  EntryNumber,
  ErrorNote,
  Link,
  Loading,
  PageHero,
  StatusBadge,
  TierChip,
  money,
  navigate,
  useAsync
} from "../ui";
import { EntryForm, emptyLine, type EntryFormValues } from "./entry-form";

const FILTERS = ["Toutes", "posted", "draft"] as const;
const FILTER_LABELS: Record<(typeof FILTERS)[number], string> = {
  Toutes: "Toutes",
  posted: "Validées",
  draft: "Brouillons"
};

export function Entries() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Toutes");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { data, error, reload } = useAsync(() => getKernel().getEntries());

  const entries = (data ?? []).filter((entry) => filter === "Toutes" || entry.status === filter);
  const selected = (data ?? []).find((entry) => entry.id === selectedId) ?? null;

  const postSelected = async () => {
    if (!selected) return;
    try {
      const posted = await getKernel().postEntry(selected.id);
      setMessage(`La pièce ${posted.number} (${posted.reference}) a été validée.`);
      setSelectedId(posted.id);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Comptabilité générale"
        title="Pièces comptables"
        subtitle="Écritures de l'exercice 2026, numérotées automatiquement par journal."
      >
        <Link href="/comptabilite/pieces/nouvelle" class="button button-primary">Nouvelle pièce</Link>
      </PageHero>
      {message ? <div class="form-message success wide-message">{message}</div> : null}
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <>
          <section class="panel data-panel">
            <div class="table-toolbar">
              <div class="filter-tabs">
                {FILTERS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    class={filter === value ? "active" : undefined}
                    onClick={() => setFilter(value)}
                  >
                    {FILTER_LABELS[value]}
                  </button>
                ))}
              </div>
              <span class="result-count">{entries.length} pièce(s)</span>
            </div>
            <div class="responsive-table">
              <table class="data-table selectable-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Date</th>
                    <th>Journal</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th>Statut</th>
                    <th class="number">Débit</th>
                    <th class="number">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      class={selectedId === entry.id ? "selected" : undefined}
                      onClick={() => setSelectedId(entry.id)}
                    >
                      <td><EntryNumber value={entry.number} /></td>
                      <td>{formatCivilDateFr(entry.entryDate)}</td>
                      <td><span class="code-badge">{entry.journalCode}</span></td>
                      <td><strong>{entry.reference}</strong></td>
                      <td>{entry.description}</td>
                      <td><StatusBadge status={entry.status} /></td>
                      <td class="number">{money(entry.totalDebit)}</td>
                      <td class="number">{money(entry.totalCredit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? <EntryDetail key={selected.id} entry={selected} onPost={postSelected} /> : null}
        </>
      )}
    </>
  );
}

function EntryDetail(props: { entry: AccountingEntryDto; onPost: () => void }) {
  const { entry } = props;
  const isDraft = entry.status === "draft";
  return (
    <section class="panel entry-detail">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Détail de la pièce</span>
          <h2>
            <EntryNumber value={entry.number} /> {entry.reference} · {entry.description}
          </h2>
          <p class="detail-meta">
            Journal {entry.journalCode} · {formatCivilDateFr(entry.entryDate)}
            {entry.updatedAt ? ` · révisée le ${formatCivilDateFr(entry.updatedAt.slice(0, 10))}` : ""}
            {entry.postedAt ? ` · validée le ${formatCivilDateFr(entry.postedAt.slice(0, 10))}` : ""}
          </p>
        </div>
        <div class="accounting-actions">
          <StatusBadge status={entry.status} />
          {isDraft ? (
            <>
              <Link href={`/comptabilite/pieces/${entry.id}/modifier`} class="button button-secondary">
                Modifier le brouillon
              </Link>
              <button class="button button-primary" type="button" onClick={props.onPost}>
                Valider la pièce
              </button>
            </>
          ) : (
            <span class="muted">Pièce validée : immuable, correction par extourne.</span>
          )}
        </div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>Compte</th>
              <th>Intitulé</th>
              <th>Libellé</th>
              <th>Tiers</th>
              <th class="number">Débit</th>
              <th class="number">Crédit</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id}>
                <td><strong>{line.accountCode}</strong></td>
                <td>{line.accountLabel}</td>
                <td>{line.label}</td>
                <td><TierChip code={line.thirdPartyCode} name={line.thirdPartyName} /></td>
                <td class="number">{money(line.debit)}</td>
                <td class="number">{money(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colspan={4}>Totaux</th>
              <th class="number">{money(entry.totalDebit)}</th>
              <th class="number">{money(entry.totalCredit)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
      <AuditTrailFor entityId={entry.id} title="Piste d'audit de la pièce" limit={8} />
    </section>
  );
}

export function NewEntry() {
  const initial: EntryFormValues = {
    journalCode: "OD",
    entryDate: "2026-02-15",
    reference: "",
    description: "",
    lines: [emptyLine(), emptyLine()]
  };

  return (
    <EntryForm
      eyebrow="Saisie des écritures"
      title="Nouvelle pièce comptable"
      subtitle="Le numéro est attribué automatiquement dans la séquence du journal ; la validation exige l'équilibre et le tiers des comptes auxiliaires."
      initial={initial}
      entryNumber={null}
      cancelHref="/comptabilite/pieces"
      onSubmit={async (values, post) => {
        await getKernel().saveEntry({
          organizationId: DEMO_ORGANIZATION_ID,
          journalCode: values.journalCode,
          entryDate: values.entryDate,
          reference: values.reference,
          description: values.description,
          postImmediately: post,
          lines: values.lines.map((line) => ({
            accountCode: line.accountCode,
            label: line.label,
            debit: line.debit === "" ? 0 : line.debit,
            credit: line.credit === "" ? 0 : line.credit,
            thirdPartyCode: line.thirdPartyCode.trim() === "" ? null : line.thirdPartyCode.trim()
          }))
        });
        // La liste des pièces se recharge à la navigation : confirmation immédiate.
        window.setTimeout(() => navigate("/comptabilite/pieces"), 250);
      }}
    />
  );
}

/** Révision d'un brouillon : le numéro et le journal restent inchangés. */
export function EditEntry(props: { entryId: string }) {
  const { data, error } = useAsync(async () => {
    const kernel = getKernel();
    const entry = await kernel.getEntry(props.entryId);
    return entry;
  }, [props.entryId]);

  if (error) {
    return (
      <>
        <PageHero eyebrow="Saisie des écritures" title="Révision d'un brouillon" />
        <ErrorNote message={error} />
        <Link href="/comptabilite/pieces" class="button button-secondary">Retour aux pièces</Link>
      </>
    );
  }
  if (!data) return <Loading label="Chargement de la pièce…" />;

  if (data.status !== "draft") {
    return (
      <>
        <PageHero eyebrow="Saisie des écritures" title="Pièce non révisable" subtitle={`${data.number} · ${data.reference}`} />
        <section class="panel info-panel">
          <strong>Une pièce validée est immuable</strong>
          <p>
            La pièce {data.number} est {data.status === "posted" ? "validée" : "extournée"} : elle ne peut plus être
            modifiée. Pour la corriger, créez une écriture d'extourne (tranche 3) ou saisissez une nouvelle pièce.
          </p>
          <div class="action-row">
            <Link href="/comptabilite/pieces" class="button button-primary">Retour aux pièces</Link>
            <Link href="/comptabilite/pieces/nouvelle" class="button button-secondary">Nouvelle pièce</Link>
          </div>
        </section>
      </>
    );
  }

  const initial: EntryFormValues = {
    journalCode: data.journalCode,
    entryDate: data.entryDate,
    reference: data.reference,
    description: data.description,
    lines: data.lines.map((line) => ({
      accountCode: line.accountCode,
      label: line.label,
      debit: line.debit === "0" ? "" : line.debit,
      credit: line.credit === "0" ? "" : line.credit,
      thirdPartyCode: line.thirdPartyCode ?? ""
    }))
  };

  return (
    <EntryForm
      key={data.id}
      eyebrow="Saisie des écritures"
      title="Réviser le brouillon"
      subtitle="Le numéro et le journal sont conservés ; chaque révision est tracée dans la piste d'audit."
      initial={initial}
      journalLocked
      entryNumber={data.number}
      cancelHref="/comptabilite/pieces"
      onSubmit={async (values, post) => {
        await getKernel().updateEntry(data.id, {
          organizationId: DEMO_ORGANIZATION_ID,
          entryDate: values.entryDate,
          reference: values.reference,
          description: values.description,
          postImmediately: post,
          lines: values.lines.map((line) => ({
            accountCode: line.accountCode,
            label: line.label,
            debit: line.debit === "" ? 0 : line.debit,
            credit: line.credit === "" ? 0 : line.credit,
            thirdPartyCode: line.thirdPartyCode.trim() === "" ? null : line.thirdPartyCode.trim()
          }))
        });
        window.setTimeout(() => navigate("/comptabilite/pieces"), 250);
      }}
    />
  );
}
