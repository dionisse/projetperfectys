/**
 * Formulaire de saisie / révision d'une pièce, partagé par la création et
 * l'édition d'un brouillon : une seule implémentation côté écran, les règles
 * restant appliquées par le noyau (équilibre, période, tiers obligatoire).
 */

import { useEffect, useState } from "preact/hooks";
import type { AccountingJournalDto, GeneralAccountDto, ThirdPartyUsageDto } from "@perfecto/contracts";
import { amountFromDecimal, type Amount } from "@perfecto/domain";
import { getKernel } from "../kernel";
import { ErrorNote, Link, Loading, PageHero, money, useAsync } from "../ui";

export interface EntryLineDraft {
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
  thirdPartyCode: string;
}

export interface EntryFormValues {
  journalCode: string;
  entryDate: string;
  reference: string;
  description: string;
  lines: EntryLineDraft[];
}

export const emptyLine = (): EntryLineDraft => ({
  accountCode: "",
  label: "",
  debit: "",
  credit: "",
  thirdPartyCode: ""
});

export function parseAmount(value: string): Amount {
  try {
    return value.trim() === "" ? 0n : amountFromDecimal(value);
  } catch {
    return 0n;
  }
}

interface FormRefs {
  accounts: GeneralAccountDto[];
  journals: AccountingJournalDto[];
  thirdParties: ThirdPartyUsageDto[];
}

export function EntryForm(props: {
  eyebrow: string;
  title: string;
  subtitle: string;
  initial: EntryFormValues;
  /** En révision, le journal ne change jamais (continuité de la séquence). */
  journalLocked?: boolean;
  /** Numéro déjà attribué, ou `null` tant qu'il sera calculé à l'enregistrement. */
  entryNumber: string | null;
  cancelHref: string;
  onSubmit: (values: EntryFormValues, post: boolean) => Promise<void>;
}) {
  const { data: refs, error } = useAsync<FormRefs>(async () => {
    const kernel = getKernel();
    const [accounts, journals, thirdParties] = await Promise.all([
      kernel.getAccounts(),
      kernel.getJournals(),
      kernel.getThirdParties()
    ]);
    return { accounts, journals, thirdParties };
  });

  const [values, setValues] = useState<EntryFormValues>(props.initial);
  const [preview, setPreview] = useState<string | null>(props.entryNumber);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Annonce du numéro qui sera attribué (création uniquement) : lecture seule,
  // aucun numéro n'est consommé avant l'enregistrement effectif.
  useEffect(() => {
    if (props.entryNumber) return;
    let alive = true;
    getKernel()
      .peekEntryNumber(values.journalCode, values.entryDate)
      .then((number) => {
        if (alive) setPreview(number);
      })
      .catch(() => {
        if (alive) setPreview(null);
      });
    return () => {
      alive = false;
    };
  }, [values.journalCode, values.entryDate, props.entryNumber]);

  const accounts = refs?.accounts ?? [];
  const allTiers = refs?.thirdParties ?? [];
  const activeTiers = allTiers.filter((item) => item.isActive);

  /**
   * Options de la liste déroulante : les tiers actifs, plus celui déjà affecté à
   * la ligne même s'il a été désactivé depuis (sinon la valeur devient invisible
   * alors que le noyau la refusera à l'enregistrement).
   */
  const tierOptions = (code: string) => {
    const normalized = code.trim().toUpperCase();
    const own = allTiers.find((item) => item.code.toUpperCase() === normalized);
    return own && !own.isActive ? [...activeTiers, own] : activeTiers;
  };

  const totalDebit = values.lines.reduce((sum, line) => sum + parseAmount(line.debit), 0n);
  const totalCredit = values.lines.reduce((sum, line) => sum + parseAmount(line.credit), 0n);
  const gap = totalDebit > totalCredit ? totalDebit - totalCredit : totalCredit - totalDebit;
  const isBalanced = values.lines.length >= 2 && totalDebit > 0n && gap === 0n;

  const accountOf = (code: string): GeneralAccountDto | undefined => accounts.find((item) => item.code === code);
  const missingTierIndexes = values.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => accountOf(line.accountCode)?.requiresThirdParty && line.thirdPartyCode.trim() === "")
    .map(({ index }) => index);
  const unknownTierIndexes = values.lines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line }) =>
        line.thirdPartyCode.trim() !== "" &&
        !(refs?.thirdParties ?? []).some((item) => item.code.toUpperCase() === line.thirdPartyCode.trim().toUpperCase())
    )
    .map(({ index }) => index);
  const referenceMissing = values.reference.trim().length === 0;
  const linesIncomplete = values.lines.some(
    (line) => line.accountCode === "" || line.label.trim() === "" || (parseAmount(line.debit) === 0n && parseAmount(line.credit) === 0n)
  );

  const blockers: string[] = [];
  if (referenceMissing) blockers.push("la référence de la pièce");
  if (linesIncomplete) blockers.push("chaque ligne doit porter un compte, un libellé et un montant");
  if (missingTierIndexes.length > 0) {
    blockers.push(
      `un tiers est obligatoire pour la ligne ${missingTierIndexes
        .map((index) => index + 1)
        .join(", ")} (compte auxiliaire)`
    );
  }
  if (unknownTierIndexes.length > 0) {
    blockers.push(`le tiers de la ligne ${unknownTierIndexes.map((index) => index + 1).join(", ")} n'existe pas`);
  }
  const canSaveDraft = blockers.length === 0;
  const canPost = canSaveDraft && isBalanced;

  const updateLine = (index: number, patch: Partial<EntryLineDraft>) =>
    setValues((current) => ({
      ...current,
      lines: current.lines.map((line, position) => (position === index ? { ...line, ...patch } : line))
    }));

  const submit = async (post: boolean) => {
    setBusy(true);
    setMessage(null);
    try {
      await props.onSubmit(values, post);
    } catch (cause) {
      setMessage({ text: cause instanceof Error ? cause.message : String(cause), isError: true });
    } finally {
      setBusy(false);
    }
  };

  if (!refs) {
    return (
      <>
        <PageHero eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle}>
          <Link href={props.cancelHref} class="button button-secondary">Annuler</Link>
        </PageHero>
        <Loading />
      </>
    );
  }

  return (
    <>
      <PageHero eyebrow={props.eyebrow} title={props.title} subtitle={props.subtitle}>
        {preview ? <span class="phase-badge">N° {preview}</span> : null}
        <Link href={props.cancelHref} class="button button-secondary">Annuler</Link>
      </PageHero>

      {message ? (
        <div class={`form-message ${message.isError ? "error" : "success"} wide-message`}>{message.text}</div>
      ) : null}
      <ErrorNote message={error} />

      <section class="panel entry-form-panel">
        <div class="entry-header-fields">
          <label class="field">
            <span>Journal</span>
            <select
              value={values.journalCode}
              disabled={props.journalLocked}
              onChange={(event) => setValues({ ...values, journalCode: event.currentTarget.value })}
            >
              {refs.journals.map((journal) => (
                <option key={journal.code} value={journal.code}>
                  {journal.code} · {journal.label}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span>Date de pièce</span>
            <input
              type="date"
              value={values.entryDate}
              onInput={(event) => setValues({ ...values, entryDate: event.currentTarget.value })}
            />
          </label>
          <label class="field">
            <span>Référence (facture, chèque…)</span>
            <input
              maxlength={80}
              placeholder="Ex. FA-2026-018"
              value={values.reference}
              onInput={(event) => setValues({ ...values, reference: event.currentTarget.value })}
            />
          </label>
          <label class="field field-wide">
            <span>Libellé de la pièce</span>
            <input
              maxlength={180}
              placeholder="Objet de l'opération"
              value={values.description}
              onInput={(event) => setValues({ ...values, description: event.currentTarget.value })}
            />
          </label>
        </div>

        <div class="entry-lines-heading">
          <div>
            <span class="eyebrow">Mouvements</span>
            <h2>Lignes comptables</h2>
          </div>
          <button
            class="button button-secondary"
            type="button"
            onClick={() => setValues({ ...values, lines: [...values.lines, emptyLine()] })}
          >
            Ajouter une ligne
          </button>
        </div>

        <div class="responsive-table">
          <table class="data-table entry-lines-table">
            <thead>
              <tr>
                <th>Compte général</th>
                <th>Libellé de ligne</th>
                <th>Tiers</th>
                <th class="number">Débit</th>
                <th class="number">Crédit</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {values.lines.map((line, index) => {
                const account = accountOf(line.accountCode);
                const requires = account?.requiresThirdParty ?? false;
                const missing = missingTierIndexes.includes(index);
                const unknown = unknownTierIndexes.includes(index);
                return (
                  <tr key={index} class={missing || unknown ? "line-warning" : undefined}>
                    <td>
                      <select
                        value={line.accountCode}
                        onChange={(event) => updateLine(index, { accountCode: event.currentTarget.value })}
                      >
                        <option value="">Sélectionner…</option>
                        {refs.accounts.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.code} · {item.label}
                            {item.requiresThirdParty ? " (tiers)" : ""}
                          </option>
                        ))}
                      </select>
                      {requires ? <small class="field-hint">Compte auxiliaire : tiers obligatoire</small> : null}
                    </td>
                    <td>
                      <input
                        maxlength={160}
                        placeholder="Libellé"
                        value={line.label}
                        onInput={(event) => updateLine(index, { label: event.currentTarget.value })}
                      />
                    </td>
                    <td>
                      <select
                        value={line.thirdPartyCode}
                        class={missing ? "input-warning" : undefined}
                        onChange={(event) => updateLine(index, { thirdPartyCode: event.currentTarget.value })}
                      >
                        <option value="">{requires ? "Tiers obligatoire…" : "Aucun tiers"}</option>
                        {tierOptions(line.thirdPartyCode).map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.code} · {item.name}
                            {item.isActive ? "" : " (désactivé)"}
                          </option>
                        ))}
                        {unknown && line.thirdPartyCode ? (
                          <option value={line.thirdPartyCode}>{line.thirdPartyCode} (inconnu)</option>
                        ) : null}
                      </select>
                      {missing ? <small class="field-warning">Tiers obligatoire</small> : null}
                      {unknown ? <small class="field-warning">Tiers inexistant</small> : null}
                    </td>
                    <td>
                      <input
                        class="amount-input"
                        inputmode="decimal"
                        placeholder="0"
                        value={line.debit}
                        onInput={(event) => updateLine(index, { debit: event.currentTarget.value })}
                      />
                    </td>
                    <td>
                      <input
                        class="amount-input"
                        inputmode="decimal"
                        placeholder="0"
                        value={line.credit}
                        onInput={(event) => updateLine(index, { credit: event.currentTarget.value })}
                      />
                    </td>
                    <td>
                      <button
                        class="icon-button danger"
                        type="button"
                        title="Supprimer la ligne"
                        disabled={values.lines.length <= 2}
                        onClick={() =>
                          setValues({ ...values, lines: values.lines.filter((_, position) => position !== index) })
                        }
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colspan={3}>Totaux de la pièce</th>
                <th class="number">{money(totalDebit.toString())}</th>
                <th class="number">{money(totalCredit.toString())}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="entry-footer">
          <div class={`balance-indicator ${isBalanced ? "balanced" : "unbalanced"}`}>
            <span>{isBalanced ? "Pièce équilibrée" : "Écart à corriger"}</span>
            <strong>{money(gap.toString())}</strong>
          </div>
          <div class="action-row">
            <button
              class="button button-secondary"
              type="button"
              disabled={!canSaveDraft || busy}
              onClick={() => void submit(false)}
            >
              Enregistrer le brouillon
            </button>
            <button class="button button-primary" type="button" disabled={!canPost || busy} onClick={() => void submit(true)}>
              {props.entryNumber ? "Enregistrer et valider" : "Valider la pièce"}
            </button>
          </div>
        </div>

        {blockers.length > 0 ? (
          <p class="form-blockers">
            Avant enregistrement, corrigez : {blockers.join(" ; ")}.
          </p>
        ) : (
          <p class="form-hint-wide">
            {props.entryNumber
              ? `Brouillon révisable · numéro ${props.entryNumber} conservé · journal ${values.journalCode} verrouillé.`
              : `Le numéro ${preview ?? "automatique"} sera attribué à l'enregistrement, dans la séquence du journal ${values.journalCode}.`}
          </p>
        )}
      </section>
    </>
  );
}
