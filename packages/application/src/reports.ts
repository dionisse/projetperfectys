/**
 * États comptables : journal, grand livre, balance.
 * Portage de Perfecto.Application/Accounting/AccountingReportBuilder.cs.
 * Seules les pièces VALIDÉES alimentent les états ; les montants sortants sont
 * sérialisés en décimal exact.
 */

import type {
  GeneralAccountDto,
  JournalLineDto,
  LedgerAccountDto,
  LedgerLineDto,
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
import type { StoredEntry } from "./state";

export function postedEntries(entries: readonly StoredEntry[]): StoredEntry[] {
  return entries.filter((entry) => entry.status === AccountingEntryStatus.Posted);
}

export function buildJournal(entries: readonly StoredEntry[]): JournalLineDto[] {
  return postedEntries(entries)
    .slice()
    .sort(
      (left, right) =>
        left.entryDate.localeCompare(right.entryDate) ||
        left.journalCode.localeCompare(right.journalCode) ||
        left.reference.localeCompare(right.reference)
    )
    .flatMap((entry) =>
      entry.lines.map((line) => ({
        entryDate: entry.entryDate,
        journalCode: entry.journalCode,
        reference: entry.reference,
        accountCode: line.accountCode,
        accountLabel: line.accountLabel,
        label: line.label,
        debit: amountToDecimal(line.debit),
        credit: amountToDecimal(line.credit)
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
            left.entryDate.localeCompare(right.entryDate) || left.reference.localeCompare(right.reference)
        )
        .map((line) => {
          running = amountAdd(running, amountAdd(amountFromDto(line.debit), -amountFromDto(line.credit)));
          return {
            entryDate: line.entryDate,
            journalCode: line.journalCode,
            reference: line.reference,
            label: line.label,
            debit: line.debit,
            credit: line.credit,
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
  const lines = postedEntries(entries).flatMap((entry) => entry.lines);

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

/** Les montants DTO proviennent du noyau (amountToDecimal) : conversion exacte. */
function amountFromDto(value: string): Amount {
  return amountFromDecimal(value);
}
