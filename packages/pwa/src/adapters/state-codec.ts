/**
 * Sérialisation de l'état comptable pour IndexedDB / JSON.
 * Les montants `bigint` deviennent des chaînes décimales exactes
 * (aucun flottant ne traverse la persistance), conformément aux contrats.
 */

import type { AccountingState, StoredEntry, StoredEntryLine } from "@perfecto/application";
import { amountFromDecimal, amountToDecimal } from "@perfecto/domain";

export interface SerializedEntryLine {
  id: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: string;
  credit: string;
}

export interface SerializedEntry extends Omit<StoredEntry, "lines"> {
  lines: SerializedEntryLine[];
}

export interface SerializedState extends Omit<AccountingState, "entries"> {
  entries: SerializedEntry[];
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
  return { ...line, debit: amountToDecimal(line.debit), credit: amountToDecimal(line.credit) };
}

export function deserializeState(raw: SerializedState): AccountingState {
  return {
    ...raw,
    entries: raw.entries.map(deserializeEntry)
  };
}

export function deserializeEntry(entry: SerializedEntry): StoredEntry {
  return {
    ...entry,
    lines: entry.lines.map((line) => ({
      ...line,
      debit: amountFromDecimal(line.debit),
      credit: amountFromDecimal(line.credit)
    }))
  };
}
