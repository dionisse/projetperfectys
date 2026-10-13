import { useState } from "preact/hooks";
import type { AccountingEntryDto } from "@perfecto/contracts";
import { amountFromDecimal, type Amount } from "@perfecto/domain";
import { DEMO_ORGANIZATION_ID, getKernel } from "../kernel";
import { ErrorNote, Link, Loading, PageHero, StatusBadge, money, navigate, useAsync } from "../ui";

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
      setMessage(`La pièce ${posted.reference} a été validée.`);
      setSelectedId(posted.id);
      reload();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <>
      <PageHero eyebrow="Comptabilité générale" title="Pièces comptables" subtitle="Écritures de l'exercice 2026, brouillons et pièces validées.">
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
                  <button key={value} type="button" class={filter === value ? "active" : undefined} onClick={() => setFilter(value)}>
                    {FILTER_LABELS[value]}
                  </button>
                ))}
              </div>
              <span class="result-count">{entries.length} pièce(s)</span>
            </div>
            <div class="responsive-table">
              <table class="data-table selectable-table">
                <thead><tr><th>Date</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Statut</th><th class="number">Débit</th><th class="number">Crédit</th></tr></thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} class={selectedId === entry.id ? "selected" : undefined} onClick={() => setSelectedId(entry.id)}>
                      <td>{entry.entryDate.split("-").reverse().join("/")}</td>
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

          {selected ? <EntryDetail entry={selected} onPost={postSelected} /> : null}
        </>
      )}
    </>
  );
}

function EntryDetail(props: { entry: AccountingEntryDto; onPost: () => void }) {
  const { entry } = props;
  return (
    <section class="panel entry-detail">
      <div class="panel-heading">
        <div><span class="eyebrow">Détail de la pièce</span><h2>{entry.reference} · {entry.description}</h2></div>
        <div class="accounting-actions">
          <StatusBadge status={entry.status} />
          {entry.status === "draft" ? (
            <button class="button button-primary" type="button" onClick={props.onPost}>Valider la pièce</button>
          ) : null}
        </div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead><tr><th>Compte</th><th>Intitulé</th><th>Libellé</th><th class="number">Débit</th><th class="number">Crédit</th></tr></thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id}>
                <td><strong>{line.accountCode}</strong></td>
                <td>{line.accountLabel}</td>
                <td>{line.label}</td>
                <td class="number">{money(line.debit)}</td>
                <td class="number">{money(line.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><th colspan={3}>Totaux</th><th class="number">{money(entry.totalDebit)}</th><th class="number">{money(entry.totalCredit)}</th></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

interface LineDraft {
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
}

const emptyLine = (): LineDraft => ({ accountCode: "", label: "", debit: "", credit: "" });

function parseAmount(value: string): Amount {
  try {
    return value.trim() === "" ? 0n : amountFromDecimal(value);
  } catch {
    return 0n;
  }
}

export function NewEntry() {
  const { data: refs, error } = useAsync(async () => {
    const kernel = getKernel();
    const [accounts, journals] = await Promise.all([kernel.getAccounts(), kernel.getJournals()]);
    return { accounts, journals };
  });

  const [journalCode, setJournalCode] = useState("OD");
  const [entryDate, setEntryDate] = useState("2026-02-15");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const totalDebit = lines.reduce((sum, line) => sum + parseAmount(line.debit), 0n);
  const totalCredit = lines.reduce((sum, line) => sum + parseAmount(line.credit), 0n);
  const isBalanced = lines.length >= 2 && totalDebit > 0n && totalDebit === totalCredit;

  const updateLine = (index: number, patch: Partial<LineDraft>) =>
    setLines(lines.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  const save = async (post: boolean) => {
    try {
      const saved = await getKernel().saveEntry({
        organizationId: DEMO_ORGANIZATION_ID,
        journalCode,
        entryDate,
        reference,
        description,
        postImmediately: post,
        lines: lines.map((line) => ({
          accountCode: line.accountCode,
          label: line.label,
          debit: line.debit === "" ? 0 : line.debit,
          credit: line.credit === "" ? 0 : line.credit
        }))
      });
      setMessage({ text: `La pièce ${saved.reference} a été ${post ? "validée" : "enregistrée en brouillon"}.`, isError: false });
      window.setTimeout(() => navigate("/comptabilite/pieces"), 400);
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    }
  };

  return (
    <>
      <PageHero eyebrow="Saisie des écritures" title="Nouvelle pièce comptable" subtitle="La validation est impossible tant que les débits et crédits ne sont pas équilibrés.">
        <Link href="/comptabilite/pieces" class="button button-secondary">Annuler</Link>
      </PageHero>
      {message ? <div class={`form-message ${message.isError ? "error" : "success"} wide-message`}>{message.text}</div> : null}
      <ErrorNote message={error} />
      {refs ? (
        <section class="panel entry-form-panel">
          <div class="entry-header-fields">
            <label class="field"><span>Journal</span>
              <select value={journalCode} onChange={(event) => setJournalCode(event.currentTarget.value)}>
                {refs.journals.map((journal) => <option key={journal.code} value={journal.code}>{journal.code} · {journal.label}</option>)}
              </select>
            </label>
            <label class="field"><span>Date</span><input type="date" value={entryDate} onInput={(event) => setEntryDate(event.currentTarget.value)} /></label>
            <label class="field"><span>Référence</span><input maxlength={80} placeholder="Ex. OD-2026-002" value={reference} onInput={(event) => setReference(event.currentTarget.value)} /></label>
            <label class="field field-wide"><span>Libellé de la pièce</span><input maxlength={180} placeholder="Objet de l'opération" value={description} onInput={(event) => setDescription(event.currentTarget.value)} /></label>
          </div>

          <div class="entry-lines-heading">
            <div><span class="eyebrow">Mouvements</span><h2>Lignes comptables</h2></div>
            <button class="button button-secondary" type="button" onClick={() => setLines([...lines, emptyLine()])}>Ajouter une ligne</button>
          </div>

          <div class="responsive-table">
            <table class="data-table entry-lines-table">
              <thead><tr><th>Compte général</th><th>Libellé de ligne</th><th class="number">Débit</th><th class="number">Crédit</th><th></th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      <select value={line.accountCode} onChange={(event) => updateLine(index, { accountCode: event.currentTarget.value })}>
                        <option value="">Sélectionner…</option>
                        {refs.accounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.label}</option>)}
                      </select>
                    </td>
                    <td><input maxlength={160} placeholder="Libellé" value={line.label} onInput={(event) => updateLine(index, { label: event.currentTarget.value })} /></td>
                    <td><input class="amount-input" inputmode="decimal" placeholder="0" value={line.debit} onInput={(event) => updateLine(index, { debit: event.currentTarget.value })} /></td>
                    <td><input class="amount-input" inputmode="decimal" placeholder="0" value={line.credit} onInput={(event) => updateLine(index, { credit: event.currentTarget.value })} /></td>
                    <td>
                      <button class="icon-button danger" type="button" title="Supprimer" disabled={lines.length <= 2} onClick={() => setLines(lines.filter((_, position) => position !== index))}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><th colspan={2}>Totaux de la pièce</th><th class="number">{money(totalDebit.toString())}</th><th class="number">{money(totalCredit.toString())}</th><th></th></tr></tfoot>
            </table>
          </div>

          <div class="entry-footer">
            <div class={`balance-indicator ${isBalanced ? "balanced" : "unbalanced"}`}>
              <span>{isBalanced ? "Pièce équilibrée" : "Écart à corriger"}</span>
              <strong>{money((totalDebit > totalCredit ? totalDebit - totalCredit : totalCredit - totalDebit).toString())}</strong>
            </div>
            <div class="action-row">
              <button class="button button-secondary" type="button" onClick={() => save(false)}>Enregistrer le brouillon</button>
              <button class="button button-primary" type="button" disabled={!isBalanced} onClick={() => save(true)}>Valider la pièce</button>
            </div>
          </div>
        </section>
      ) : (
        <Loading />
      )}
    </>
  );
}
