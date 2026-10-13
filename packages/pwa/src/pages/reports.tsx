import { useState } from "preact/hooks";
import { amountFromDecimal, amountToDecimal } from "@perfecto/domain";
import { getKernel } from "../kernel";
import { EntryNumber, ErrorNote, Loading, PageHero, TierChip, money, signedMoney, useAsync } from "../ui";

export function Balance() {
  const { data, error } = useAsync(() => getKernel().getSnapshot());
  if (error) return <ErrorNote message={error} />;
  if (!data) return <Loading />;

  return (
    <>
      <PageHero eyebrow="États comptables" title="Balance générale" subtitle="Mouvements et soldes des comptes sur l'exercice 2026.">
        <span class="phase-badge">Au 31/12/2026</span>
      </PageHero>
      <section class="panel data-panel">
        <div class="panel-heading">
          <div><span class="eyebrow">Contrôle d'égalité</span><h2>Balance des comptes actifs</h2></div>
          <span class="status-badge success">Équilibrée</span>
        </div>
        <div class="responsive-table">
          <table class="data-table balance-table">
            <thead><tr><th>Compte</th><th>Intitulé</th><th class="number">Mouvements débit</th><th class="number">Mouvements crédit</th><th class="number">Solde débiteur</th><th class="number">Solde créditeur</th></tr></thead>
            <tbody>
              {data.trialBalance.map((line) => (
                <tr key={line.accountCode}>
                  <td><strong>{line.accountCode}</strong></td>
                  <td>{line.accountLabel}</td>
                  <td class="number">{money(line.debitMovements)}</td>
                  <td class="number">{money(line.creditMovements)}</td>
                  <td class="number">{money(line.debitBalance)}</td>
                  <td class="number">{money(line.creditBalance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colspan={2}>Totaux</th>
                <th class="number">{money(data.totalDebitMovements)}</th>
                <th class="number">{money(data.totalCreditMovements)}</th>
                <th class="number">{sum(data.trialBalance.map((line) => line.debitBalance))}</th>
                <th class="number">{sum(data.trialBalance.map((line) => line.creditBalance))}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
}

/** Somme exacte de montants sérialisés, reformatée pour l'affichage. */
function sum(values: string[]): string {
  return money(amountToDecimal(values.reduce((total, value) => total + amountFromDecimal(value), 0n)));
}

export function JournalReport() {
  const [journal, setJournal] = useState("");
  const { data, error } = useAsync(async () => {
    const kernel = getKernel();
    const [lines, journals] = await Promise.all([kernel.getJournalLines(), kernel.getJournals()]);
    return { lines, journals };
  });

  const lines = (data?.lines ?? []).filter((line) => journal === "" || line.journalCode === journal);

  return (
    <>
      <PageHero eyebrow="États comptables" title="Journal des écritures" subtitle="Détail chronologique des seules pièces validées." />
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <section class="panel data-panel">
          <div class="table-toolbar">
            <label class="inline-filter"><span>Journal</span>
              <select value={journal} onChange={(event) => setJournal(event.currentTarget.value)}>
                <option value="">Tous les journaux</option>
                {data.journals.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.label}</option>)}
              </select>
            </label>
            <span class="result-count">{lines.length} ligne(s)</span>
          </div>
          <div class="responsive-table">
            <table class="data-table balance-table">
              <thead><tr><th>Date</th><th>N° pièce</th><th>Journal</th><th>Référence</th><th>Compte</th><th>Intitulé</th><th>Libellé</th><th>Tiers</th><th class="number">Débit</th><th class="number">Crédit</th></tr></thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>{line.entryDate.split("-").reverse().join("/")}</td>
                    <td><EntryNumber value={line.entryNumber} /></td>
                    <td><span class="code-badge">{line.journalCode}</span></td>
                    <td><strong>{line.reference}</strong></td>
                    <td>{line.accountCode}</td>
                    <td>{line.accountLabel}</td>
                    <td>{line.label}</td>
                    <td><TierChip code={line.thirdPartyCode} /></td>
                    <td class="number">{money(line.debit)}</td>
                    <td class="number">{money(line.credit)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan={8}>Totaux</th>
                  <th class="number">{money(amountToDecimal(lines.reduce((total, line) => total + amountFromDecimal(line.debit), 0n)))}</th>
                  <th class="number">{money(amountToDecimal(lines.reduce((total, line) => total + amountFromDecimal(line.credit), 0n)))}</th>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export function GeneralLedger() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const { data, error } = useAsync(() => getKernel().getGeneralLedger());
  const code = selectedCode ?? data?.[0]?.accountCode ?? "";
  const account = (data ?? []).find((item) => item.accountCode === code) ?? null;

  return (
    <>
      <PageHero eyebrow="États comptables" title="Grand livre général" subtitle="Mouvements validés et solde progressif compte par compte." />
      <ErrorNote message={error} />
      {!data ? (
        <Loading />
      ) : (
        <section class="panel data-panel">
          <div class="table-toolbar">
            <label class="inline-filter wide"><span>Compte</span>
              <select value={code} onChange={(event) => setSelectedCode(event.currentTarget.value)}>
                {data.map((item) => <option key={item.accountCode} value={item.accountCode}>{item.accountCode} · {item.accountLabel}</option>)}
              </select>
            </label>
            {account ? <span class="balance-pill">Solde : {signedMoney(account.closingBalance)}</span> : null}
          </div>
          {account ? (
            <>
              <div class="ledger-heading">
                <strong>{account.accountCode} · {account.accountLabel}</strong>
                <span>Débit {money(account.totalDebit)} · Crédit {money(account.totalCredit)}</span>
              </div>
              <div class="responsive-table">
                <table class="data-table">
                  <thead><tr><th>Date</th><th>N° pièce</th><th>Journal</th><th>Référence</th><th>Libellé</th><th>Tiers</th><th class="number">Débit</th><th class="number">Crédit</th><th class="number">Solde cumulé</th></tr></thead>
                  <tbody>
                    {account.lines.map((line, index) => (
                      <tr key={index}>
                        <td>{line.entryDate.split("-").reverse().join("/")}</td>
                        <td><EntryNumber value={line.entryNumber} /></td>
                        <td><span class="code-badge">{line.journalCode}</span></td>
                        <td>{line.reference}</td>
                        <td>{line.label}</td>
                        <td><TierChip code={line.thirdPartyCode} /></td>
                        <td class="number">{money(line.debit)}</td>
                        <td class="number">{money(line.credit)}</td>
                        <td class="number"><strong>{signedMoney(line.runningBalance)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      )}
    </>
  );
}
