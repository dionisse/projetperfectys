/**
 * Sérialisation de l'état comptable pour IndexedDB / JSON.
 * Les montants `bigint` deviennent des chaînes décimales exactes
 * (aucun flottant ne traverse la persistance), conformément aux contrats.
 *
 * MIGRATION : une base écrite par une tranche antérieure est complétée à la
 * lecture — tranche 1 (sans numéro de pièce, sans fichier tiers, sans séquences),
 * tranche 2 (sans extourne, sans lettrage, sans justificatifs), tranche 3 (sans
 * fiche société : un profil vide est amorcé, à compléter dans l'écran « Société »). Les numéros
 * manquants sont attribués dans l'ordre chronologique par la même règle du
 * domaine ({@link allocateEntryNumber}) que celle utilisée en saisie : la
 * numérotation d'une base existante reste continue, sans reset utilisateur.
 */

import type { AccountingState, AttachmentRecord, ReconciliationRecord, StoredEntry, StoredEntryLine } from "@perfecto/application";
import type { ThirdPartyDto } from "@perfecto/contracts";
import {
  allocateEntryNumber,
  amountFromDecimal,
  amountToDecimal,
  civilYear,
  emptyOrganizationProfile,
  normalizeOrganizationProfile,
  type AccountingEntryStatus,
  type CivilDate,
  type EntryNumberSequence,
  type ReconciliationScope
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
  /** Absents des bases écrites avant la tranche 3. */
  reversedAt?: string | null;
  reversalOfEntryId?: string | null;
  reversedByEntryId?: string | null;
  lines: SerializedEntryLine[];
}

export interface SerializedReconciliation {
  id: string;
  organizationId: string;
  label: string;
  scope: ReconciliationScope;
  key: string;
  lineIds: string[];
  totalDebit: string;
  totalCredit: string;
  comment: string;
  createdAt: string;
  createdBy: string;
}

export interface SerializedAuditRecord extends Omit<AccountingState["audit"][number], "sequence"> {
  /** Absent des bases écrites avant la tranche 2 : reconstitué à la lecture. */
  sequence?: number | undefined;
}

export interface SerializedState {
  organizationId: string;
  /** Absente des bases écrites avant la tranche 4 : amorcée par la migration. */
  organization?: AccountingState["organization"] | undefined;
  fiscalYearId: string;
  accounts: AccountingState["accounts"];
  journals: AccountingState["journals"];
  /** Absent des bases écrites avant la tranche 2. */
  thirdParties?: ThirdPartyDto[];
  entrySequences?: EntryNumberSequence[];
  entries: SerializedEntry[];
  /** Absents des bases écrites avant la tranche 3. */
  reconciliations?: SerializedReconciliation[];
  attachments?: AttachmentRecord[];
  periods: AccountingState["periods"];
  audit?: SerializedAuditRecord[] | undefined;
}

export function serializeState(state: AccountingState): SerializedState {
  return {
    ...state,
    entries: state.entries.map(serializeEntry),
    reconciliations: state.reconciliations.map(serializeReconciliation),
    audit: state.audit.map((event) => ({ ...event }))
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

function serializeReconciliation(record: ReconciliationRecord): SerializedReconciliation {
  return {
    ...record,
    totalDebit: amountToDecimal(record.totalDebit),
    totalCredit: amountToDecimal(record.totalCredit)
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
    reversedAt: entry.reversedAt ?? null,
    reversalOfEntryId: entry.reversalOfEntryId ?? null,
    reversedByEntryId: entry.reversedByEntryId ?? null,
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
  const reconciliations = (raw.reconciliations ?? []).map((record) => ({
    ...record,
    totalDebit: amountFromDecimal(record.totalDebit),
    totalCredit: amountFromDecimal(record.totalCredit)
  }));
  // Un lettrage ne peut survivre à la disparition des lignes qu'il rapproche.
  const knownLineIds = new Set(
    numbered.entries.flatMap((entry) => entry.lines.map((line) => line.id))
  );
  const surviving = reconciliations.filter((record) => record.lineIds.every((id) => knownLineIds.has(id)));

  return {
    organizationId: raw.organizationId,
    // Une base antérieure à la tranche 4 n'a pas de fiche société : on amorce un
    // profil vide, que l'écran « Société » complétera. Aucune donnée n'est inventée.
    organization: raw.organization
      ? normalizeOrganizationProfile(raw.organization, emptyOrganizationProfile())
      : emptyOrganizationProfile(),
    fiscalYearId: raw.fiscalYearId,
    accounts: raw.accounts,
    journals: raw.journals,
    thirdParties: raw.thirdParties ?? [],
    entrySequences: numbered.sequences,
    entries: numbered.entries,
    reconciliations: surviving,
    attachments: raw.attachments ?? [],
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
    reversedAt: entry.reversedAt ?? null,
    reversalOfEntryId: entry.reversalOfEntryId ?? null,
    reversedByEntryId: entry.reversedByEntryId ?? null,
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
 * Complète les numéros manquants (bases antérieures à la tranche 2) dans l'ordre
 * chronologique et reconstruit les séquences par journal + exercice.
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
