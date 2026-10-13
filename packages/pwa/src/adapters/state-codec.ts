/**
 * Sérialisation de l'état comptable pour IndexedDB / JSON.
 * Les montants `bigint` deviennent des chaînes décimales exactes
 * (aucun flottant ne traverse la persistance), conformément aux contrats.
 *
 * MIGRATION : une base écrite par la tranche 1 (sans numéro de pièce, sans
 * fichier tiers, sans séquences) est complétée à la lecture. Les numéros manquants
 * sont attribués dans l'ordre chronologique par la même règle du domaine
 * ({@link allocateEntryNumber}) que celle utilisée en saisie : la numérotation
 * d'une base existante reste donc continue et cohérente, sans reset utilisateur.
 */

import type { AccountingState, StoredEntry, StoredEntryLine } from "@perfecto/application";
import type { ThirdPartyDto } from "@perfecto/contracts";
import {
  allocateEntryNumber,
  amountFromDecimal,
  amountToDecimal,
  civilYear,
  type AccountingEntryStatus,
  type CivilDate,
  type EntryNumberSequence
} from "@perfecto/domain";

export interface SerializedEntryLine {
  id: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: string;
  credit: string;
  /** Absent des bases écrites avant la tranche 2. */
  thirdPartyCode?: string | null;
}

export interface SerializedEntry {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  /** Absent des bases écrites avant la tranche 2 : attribué à la migration. */
  number?: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description: string;
  status: AccountingEntryStatus;
  createdAt: string;
  updatedAt?: string | null;
  postedAt: string | null;
  lines: SerializedEntryLine[];
}

export interface SerializedAuditRecord extends Omit<AccountingState["audit"][number], "sequence"> {
  /** Absent des bases écrites avant la tranche 2 : reconstitué à la lecture. */
  sequence?: number | undefined;
}

export interface SerializedState {
  organizationId: string;
  fiscalYearId: string;
  accounts: AccountingState["accounts"];
  journals: AccountingState["journals"];
  /** Absent des bases écrites avant la tranche 2. */
  thirdParties?: ThirdPartyDto[];
  entrySequences?: EntryNumberSequence[];
  entries: SerializedEntry[];
  periods: AccountingState["periods"];
  audit?: SerializedAuditRecord[] | undefined;
}

export function serializeState(state: AccountingState): SerializedState {
  return {
    ...state,
    entries: state.entries.map(serializeEntry)
  };
}

export function serializeEntry(entry: StoredEntry): SerializedEntry {
  return {
    ...entry,
    lines: entry.lines.map(serializeLine)
  };
}

function serializeLine(line: StoredEntryLine): SerializedEntryLine {
  return {
    ...line,
    debit: amountToDecimal(line.debit),
    credit: amountToDecimal(line.credit),
    thirdPartyCode: line.thirdPartyCode ?? null
  };
}

export function deserializeState(raw: SerializedState): AccountingState {
  const entries: PendingEntry[] = raw.entries.map((entry) => ({
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalYearId: entry.fiscalYearId,
    number: entry.number,
    journalCode: entry.journalCode,
    entryDate: entry.entryDate,
    reference: entry.reference,
    description: entry.description,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt ?? null,
    postedAt: entry.postedAt,
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      label: line.label,
      debit: amountFromDecimal(line.debit),
      credit: amountFromDecimal(line.credit),
      thirdPartyCode: line.thirdPartyCode ?? null
    }))
  }));

  const numbered = assignMissingNumbers(entries, raw.entrySequences ?? []);

  return {
    organizationId: raw.organizationId,
    fiscalYearId: raw.fiscalYearId,
    accounts: raw.accounts,
    journals: raw.journals,
    thirdParties: raw.thirdParties ?? [],
    entrySequences: numbered.sequences,
    entries: numbered.entries,
    periods: raw.periods,
    audit: (raw.audit ?? []).map((event, index) => ({ ...event, sequence: event.sequence ?? index + 1 }))
  };
}

export function deserializeEntry(entry: SerializedEntry): StoredEntry {
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalYearId: entry.fiscalYearId,
    number: entry.number ?? "",
    journalCode: entry.journalCode,
    entryDate: entry.entryDate,
    reference: entry.reference,
    description: entry.description,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt ?? null,
    postedAt: entry.postedAt,
    lines: entry.lines.map((line) => ({
      id: line.id,
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      label: line.label,
      debit: amountFromDecimal(line.debit),
      credit: amountFromDecimal(line.credit),
      thirdPartyCode: line.thirdPartyCode ?? null
    }))
  };
}

type PendingEntry = Omit<StoredEntry, "number"> & { number?: string | undefined };

/**
 * Complète les numéros manquants (bases tranche 1) dans l'ordre chronologique
 * et reconstruit les séquences par journal + exercice.
 */
function assignMissingNumbers(
  entries: PendingEntry[],
  sequences: readonly EntryNumberSequence[]
): { entries: StoredEntry[]; sequences: EntryNumberSequence[] } {
  let current: readonly EntryNumberSequence[] = sequences;
  const order = entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (left, right) =>
        left.entry.entryDate.localeCompare(right.entry.entryDate) ||
        left.entry.createdAt.localeCompare(right.entry.createdAt) ||
        left.index - right.index
    );

  const resolved = new Map<PendingEntry, string>();
  for (const { entry } of order) {
    if (entry.number && entry.number.length > 0) {
      // Numéro déjà attribué : on aligne la séquence pour ne jamais régresser.
      const sequenceNumber = Number(entry.number.split("-").pop() ?? "0");
      const known = current.find(
        (item) => item.journalCode.toUpperCase() === entry.journalCode.toUpperCase()
      );
      if (Number.isFinite(sequenceNumber) && (!known || known.lastNumber < sequenceNumber)) {
        current = known
          ? current.map((item) => (item === known ? { ...known, lastNumber: sequenceNumber } : item))
          : [...current, { journalCode: entry.journalCode, fiscalYearId: entry.fiscalYearId, lastNumber: sequenceNumber }];
      }
      resolved.set(entry, entry.number);
      continue;
    }
    const allocated = allocateEntryNumber(
      current,
      entry.journalCode,
      entry.fiscalYearId,
      civilYear(entry.entryDate)
    );
    current = allocated.sequences;
    resolved.set(entry, allocated.number);
  }

  return {
    entries: entries.map((entry) => ({ ...entry, number: resolved.get(entry) ?? "" })),
    sequences: [...current]
  };
}
