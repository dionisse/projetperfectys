/**
 * États comptables : journal, grand livre, balance, relevé par tiers.
 * Portage de Perfecto.Application/Accounting/AccountingReportBuilder.cs.
 * Seules les pièces VALIDÉES alimentent les états ; les montants sortants sont
 * sérialisés en décimal exact.
 *
 * Tranche 2 : les lignes d'états portent le numéro de pièce et le tiers, ce qui
 * rend possible le relevé auxiliaire par tiers (écran « Tiers » → fiche).
 */

import type {
  GeneralAccountDto,
  JournalLineDto,
  LedgerAccountDto,
  LedgerLineDto,
  ThirdPartyStatementLineDto,
  ThirdPartyUsageDto,
  TrialBalanceLineDto
} from "@perfecto/contracts";
import {
  AMOUNT_ZERO,
  AccountingEntryStatus,
  amountAdd,
  amountFromDecimal,
  amountToDecimal,
  type Amount
} from "@perfecto/domain";
import type { AccountingState, StoredEntry } from "./state";

/** Pièces validées : servent aux compteurs (validées, extournées…). */
export function postedEntries(entries: readonly StoredEntry[]): StoredEntry[] {
  return entries.filter((entry) => entry.status === AccountingEntryStatus.Posted);
}

/**
 * Pièces qui alimentent les états comptables : validées ET extournées.
 * Une pièce extournée reste dans les livres — c'est sa contre-passation, elle
 * aussi validée, qui l'annule. Exclure l'origine déséquilibrerait le journal,
 * la balance et le grand livre.
 */
export function reportableEntries(entries: readonly StoredEntry[]): StoredEntry[] {
  return entries.filter(
    (entry) =>
      entry.status === AccountingEntryStatus.Posted || entry.status === AccountingEntryStatus.Reversed
  );
}

export function buildJournal(entries: readonly StoredEntry[]): JournalLineDto[] {
  return reportableEntries(entries)
    .slice()
    .sort(
      (left, right) =>
        left.entryDate.localeCompare(right.entryDate) ||
        left.journalCode.localeCompare(right.journalCode) ||
        left.number.localeCompare(right.number) ||
        left.reference.localeCompare(right.reference)
    )
    .flatMap((entry) =>
      entry.lines.map((line) => ({
        entryDate: entry.entryDate,
        journalCode: entry.journalCode,
        entryNumber: entry.number,
        reference: entry.reference,
        accountCode: line.accountCode,
        accountLabel: line.accountLabel,
        label: line.label,
        debit: amountToDecimal(line.debit),
        credit: amountToDecimal(line.credit),
        thirdPartyCode: line.thirdPartyCode
      }))
    );
}

export function buildGeneralLedger(entries: readonly StoredEntry[]): LedgerAccountDto[] {
  const journal = buildJournal(entries);
  const groups = new Map<string, { accountLabel: string; lines: JournalLineDto[] }>();

  for (const line of journal) {
    const group = groups.get(line.accountCode) ?? { accountLabel: line.accountLabel, lines: [] };
    group.lines.push(line);
    groups.set(line.accountCode, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([accountCode, group]) => {
      let running: Amount = AMOUNT_ZERO;
      const lines: LedgerLineDto[] = group.lines
        .slice()
        .sort(
          (left, right) =>
            left.entryDate.localeCompare(right.entryDate) ||
            left.entryNumber.localeCompare(right.entryNumber) ||
            left.reference.localeCompare(right.reference)
        )
        .map((line) => {
          running = amountAdd(running, amountAdd(amountFromDto(line.debit), -amountFromDto(line.credit)));
          return {
            entryDate: line.entryDate,
            journalCode: line.journalCode,
            entryNumber: line.entryNumber,
            reference: line.reference,
            label: line.label,
            debit: line.debit,
            credit: line.credit,
            thirdPartyCode: line.thirdPartyCode,
            runningBalance: amountToDecimal(running)
          };
        });

      const totalDebit = lines.reduce((sum, line) => amountAdd(sum, amountFromDto(line.debit)), AMOUNT_ZERO);
      const totalCredit = lines.reduce((sum, line) => amountAdd(sum, amountFromDto(line.credit)), AMOUNT_ZERO);

      return {
        accountCode,
        accountLabel: group.accountLabel,
        totalDebit: amountToDecimal(totalDebit),
        totalCredit: amountToDecimal(totalCredit),
        closingBalance: amountToDecimal(running),
        lines
      };
    });
}

export function buildTrialBalance(
  accounts: readonly GeneralAccountDto[],
  entries: readonly StoredEntry[]
): TrialBalanceLineDto[] {
  const lines = reportableEntries(entries).flatMap((entry) => entry.lines);

  return accounts
    .map((account) => {
      const own = lines.filter((line) => line.accountCode === account.code);
      const debit = own.reduce((sum, line) => amountAdd(sum, line.debit), AMOUNT_ZERO);
      const credit = own.reduce((sum, line) => amountAdd(sum, line.credit), AMOUNT_ZERO);
      const net = debit - credit;
      return {
        accountCode: account.code,
        accountLabel: account.label,
        debitMovements: amountToDecimal(debit),
        creditMovements: amountToDecimal(credit),
        debitBalance: amountToDecimal(net > 0n ? net : AMOUNT_ZERO),
        creditBalance: amountToDecimal(net < 0n ? -net : AMOUNT_ZERO)
      };
    })
    .filter((line) => line.debitMovements !== "0" || line.creditMovements !== "0")
    .sort((left, right) => left.accountCode.localeCompare(right.accountCode));
}

/**
 * Relevé auxiliaire d'un tiers : mouvements validés, solde progressif et totaux.
 * Alimente la fiche tiers de l'écran « Tiers » (fonction « éditions par tiers »
 * du menu CR de l'original).
 */
/** Rapprochement d'une ligne -> lettre attribuée. */
export interface LineReconciliation {
  readonly id: string;
  readonly label: string;
  readonly lineIds: readonly string[];
}

export function buildThirdPartyStatement(
  entries: readonly StoredEntry[],
  thirdPartyCode: string,
  reconciliations: readonly LineReconciliation[] = []
): ThirdPartyStatementLineDto[] {
  const code = thirdPartyCode.trim().toUpperCase();
  const letters = new Map<string, LineReconciliation>();
  for (const reconciliation of reconciliations) {
    for (const lineId of reconciliation.lineIds) {
      letters.set(lineId, reconciliation);
    }
  }
  let running: Amount = AMOUNT_ZERO;

  return reportableEntries(entries)
    .flatMap((entry) =>
      entry.lines
        .filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === code)
        .map((line) => ({ entry, line }))
    )
    .sort(
      (left, right) =>
        left.entry.entryDate.localeCompare(right.entry.entryDate) ||
        left.entry.number.localeCompare(right.entry.number)
    )
    .map(({ entry, line }) => {
      running = amountAdd(running, amountAdd(line.debit, -line.credit));
      const lettered = letters.get(line.id);
      return {
        lineId: line.id,
        entryId: entry.id,
        entryDate: entry.entryDate,
        entryNumber: entry.number,
        journalCode: entry.journalCode,
        reference: entry.reference,
        accountCode: line.accountCode,
        label: line.label,
        debit: amountToDecimal(line.debit),
        credit: amountToDecimal(line.credit),
        runningBalance: amountToDecimal(running),
        reconciliationLabel: lettered?.label ?? null,
        reconciliationId: lettered?.id ?? null
      };
    });
}

/** Les montants DTO proviennent du noyau (amountToDecimal) : conversion exacte. */
function amountFromDto(value: string): Amount {
  return amountFromDecimal(value);
}

/* ------------------------------------------------------------------ */
/* Sélecteurs partagés : le noyau et les éditions lisent les mêmes données */
/* ------------------------------------------------------------------ */

/** Année de l'exercice courant, déduite des périodes (à défaut, année du jour). */
export function exerciseYear(state: AccountingState): number {
  return state.periods[0]?.year ?? new Date().getFullYear();
}

/** Nombre de lignes validées imputées à un tiers. */
export function countPostedLines(state: AccountingState, thirdPartyCode: string): number {
  const code = thirdPartyCode.toUpperCase();
  return postedEntries(state.entries)
    .flatMap((entry) => entry.lines)
    .filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === code).length;
}

/** Code de tiers (en majuscules) -> nom, pour libeller les lignes d'états. */
export function thirdPartyNames(state: AccountingState): Map<string, string> {
  return new Map(state.thirdParties.map((item) => [item.code.toUpperCase(), item.name] as const));
}

/**
 * Fichier des tiers enrichi de son usage comptable.
 *
 * Deux compteurs distincts, et ce n'est pas un détail : `lineCount` compte toutes les
 * lignes (brouillons compris), `postedLineCount` seulement les lignes de pièces validées,
 * qui sont les seules à alimenter les états. Les soldes suivent la même règle.
 */
export function thirdPartyUsage(state: AccountingState, search?: string): ThirdPartyUsageDto[] {
  const needle = search?.trim().toLowerCase();
  const postedLines = postedEntries(state.entries).flatMap((entry) => entry.lines);

  return state.thirdParties
    .filter((item) =>
      needle
        ? item.code.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)
        : true
    )
    .map((item) => {
      const own = postedLines.filter(
        (line) => (line.thirdPartyCode ?? "").toUpperCase() === item.code.toUpperCase()
      );
      const all = state.entries
        .flatMap((entry) => entry.lines)
        .filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === item.code.toUpperCase());
      const totalDebit = own.reduce((sum, line) => amountAdd(sum, line.debit), AMOUNT_ZERO);
      const totalCredit = own.reduce((sum, line) => amountAdd(sum, line.credit), AMOUNT_ZERO);
      return {
        ...item,
        lineCount: all.length,
        postedLineCount: own.length,
        totalDebit: amountToDecimal(totalDebit),
        totalCredit: amountToDecimal(totalCredit),
        netBalance: amountToDecimal(totalDebit - totalCredit)
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));
}
