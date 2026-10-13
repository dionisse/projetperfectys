/**
 * Numérotation automatique des pièces comptables.
 *
 * Règle métier reprise du logiciel d'origine (menu CR → Saisies → « numéroter ») :
 * chaque journal tient SA propre séquence, par exercice. Le numéro est attribué au
 * moment de l'enregistrement, jamais avant : une pièce refusée ne consomme pas de
 * numéro, donc la suite ne présente pas de trou (exigence d'auditabilité OHADA).
 *
 * Format retenu : `JOURNAL-AAAA-NNNN` (ex. `ACH-2026-0001`). L'année provient de la
 * date de pièce, ce qui reste correct pour un exercice à cheval sur deux années.
 */

import { DomainRuleError } from "./core";

/** Séquence courante d'un couple journal + exercice. */
export interface EntryNumberSequence {
  readonly journalCode: string;
  readonly fiscalYearId: string;
  readonly lastNumber: number;
}

/** Nombre de chiffres du compteur (au-delà, le numéro s'allonge sans se réinitialiser). */
export const ENTRY_NUMBER_WIDTH = 4;

export interface AllocatedEntryNumber {
  readonly number: string;
  readonly sequences: readonly EntryNumberSequence[];
}

function normalizeJournal(journalCode: string): string {
  const normalized = journalCode.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new DomainRuleError("Le journal est obligatoire pour numéroter une pièce.");
  }
  return normalized;
}

function checkYear(year: number): number {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new DomainRuleError(`Année de numérotation invalide : ${year}.`);
  }
  return year;
}

function checkSequence(sequence: number): number {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new DomainRuleError("La séquence de numérotation doit être un entier positif.");
  }
  return sequence;
}

/** Construit le numéro affiché et stocké. */
export function formatEntryNumber(journalCode: string, year: number, sequence: number): string {
  return `${normalizeJournal(journalCode)}-${checkYear(year)}-${String(checkSequence(sequence)).padStart(
    ENTRY_NUMBER_WIDTH,
    "0"
  )}`;
}

function findSequence(
  sequences: readonly EntryNumberSequence[],
  journalCode: string,
  fiscalYearId: string
): EntryNumberSequence | undefined {
  const journal = normalizeJournal(journalCode);
  const year = fiscalYearId.trim();
  if (year.length === 0) {
    throw new DomainRuleError("L'exercice est obligatoire pour numéroter une pièce.");
  }
  return sequences.find(
    (sequence) => sequence.journalCode.toUpperCase() === journal && sequence.fiscalYearId === year
  );
}

/** Numéro qui SERA attribué à la prochaine pièce : lecture seule, utile aux écrans. */
export function peekEntryNumber(
  sequences: readonly EntryNumberSequence[],
  journalCode: string,
  fiscalYearId: string,
  year: number
): string {
  const current = findSequence(sequences, journalCode, fiscalYearId)?.lastNumber ?? 0;
  return formatEntryNumber(journalCode, year, current + 1);
}

/**
 * Attribue le numéro suivant et retourne la liste des séquences mise à jour.
 * Fonction pure : l'appelant (noyau applicatif) décide d'écrire ou d'abandonner.
 */
export function allocateEntryNumber(
  sequences: readonly EntryNumberSequence[],
  journalCode: string,
  fiscalYearId: string,
  year: number
): AllocatedEntryNumber {
  const existing = findSequence(sequences, journalCode, fiscalYearId);
  const next = (existing?.lastNumber ?? 0) + 1;
  const updated: EntryNumberSequence = {
    journalCode: normalizeJournal(journalCode),
    fiscalYearId: fiscalYearId.trim(),
    lastNumber: next
  };
  const remaining = existing
    ? sequences.map((sequence) => (sequence === existing ? updated : sequence))
    : [...sequences, updated];
  return { number: formatEntryNumber(journalCode, year, next), sequences: remaining };
}
