/**
 * État comptable persistable et port de stockage.
 *
 * Le noyau ({@link AccountingKernel}) ne connaît QUE ce port : IndexedDB (PWA),
 * SQLite/HTTP (API, desktop) ou mémoire (tests, démo) s'y branchent sans toucher
 * aux règles métier. Corrige la duplication constatée entre DemoAccountingService,
 * IndexedDbAccountingService et perfecto-db.js.
 *
 * Tranche 2 : l'état porte le fichier unique des tiers et les séquences de
 * numérotation par journal + exercice.
 */

import type {
  AccountingJournalDto,
  AccountingPeriodDto,
  GeneralAccountDto,
  ThirdPartyDto
} from "@perfecto/contracts";
import {
  frenchMonthLabel,
  type AccountingEntryStatus,
  type Amount,
  type AttachmentData,
  type CivilDate,
  type EntryNumberSequence,
  type ReconciliationScope
} from "@perfecto/domain";
import { SYSCOHADA_STARTER_ACCOUNTS, STARTER_JOURNALS } from "./catalog";

export interface StoredEntryLine {
  id: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: Amount;
  credit: Amount;
  thirdPartyCode: string | null;
}

export interface StoredEntry {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  /** Numéro automatique : `JOURNAL-AAAA-NNNN`, attribué à l'enregistrement. */
  number: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description: string;
  status: AccountingEntryStatus;
  createdAt: string;
  /** ISO 8601, ou `null` tant que la pièce n'a jamais été révisée. */
  updatedAt: string | null;
  postedAt: string | null;
  /** Date de contre-passation, `null` si la pièce n'a pas été extournée. */
  reversedAt: string | null;
  /** Pièce d'origine lorsque celle-ci est une contre-passation. */
  reversalOfEntryId: string | null;
  /** Pièce d'extourne lorsque celle-ci a été contre-passée. */
  reversedByEntryId: string | null;
  lines: StoredEntryLine[];
}

/** Lettrage : rapprochement équilibré de mouvements d'un même tiers. */
export interface ReconciliationRecord {
  id: string;
  organizationId: string;
  /** Lettre attribuée : A, B, … Z, AA… */
  label: string;
  scope: ReconciliationScope;
  /** Code tiers (périmètre `thirdParty`) ou numéro de compte (périmètre `account`). */
  key: string;
  /** Identifiants des lignes de pièces lettrées : une ligne n'appartient qu'à un lettrage. */
  lineIds: string[];
  totalDebit: Amount;
  totalCredit: Amount;
  comment: string;
  createdAt: string;
  createdBy: string;
}

/** Métadonnée d'un justificatif : le contenu binaire reste dans le stockage hôte. */
export type AttachmentRecord = AttachmentData;

export interface AuditRecord {
  /**
   * Rang d'écriture dans la piste d'audit, strictement croissant. Indispensable
   * pour ordonner deux événements horodatés dans la même milliseconde.
   */
  sequence: number;
  id: string;
  organizationId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  details: string;
}

export interface AccountingState {
  organizationId: string;
  fiscalYearId: string;
  accounts: GeneralAccountDto[];
  journals: AccountingJournalDto[];
  /** Fichier unique des tiers, partagé par tous les modules. */
  thirdParties: ThirdPartyDto[];
  /** Dernier numéro attribué par journal et par exercice. */
  entrySequences: EntryNumberSequence[];
  entries: StoredEntry[];
  /** Lettrages et rapprochements en cours. */
  reconciliations: ReconciliationRecord[];
  /** Justificatifs rattachés aux pièces (métadonnées seulement). */
  attachments: AttachmentRecord[];
  periods: AccountingPeriodDto[];
  audit: AuditRecord[];
}

/** Port de persistance : lecture/écriture atomique de l'état comptable. */
export interface StoragePort {
  read(): Promise<AccountingState>;
  write(state: AccountingState): Promise<void>;
}

/**
 * Port de stockage des BINAIRES (justificatifs). Volontairement séparé de
 * {@link StoragePort} : l'état comptable reste sérialisable et synchronisable,
 * les octets vivent dans le stockage contrôlé de l'hôte (IndexedDB côté PWA,
 * système de fichiers ou objet côté serveur).
 */
export interface AttachmentBytesPort {
  put(attachmentId: string, bytes: Uint8Array, mimeType: string): Promise<void>;
  get(attachmentId: string): Promise<{ bytes: Uint8Array; mimeType: string } | null>;
  delete(attachmentId: string): Promise<void>;
}

export function createOpenPeriods(year: number): AccountingPeriodDto[] {
  return Array.from({ length: 12 }, (_, index) => ({
    year,
    month: index + 1,
    label: frenchMonthLabel(year, index + 1),
    isClosed: false,
    closedAt: null
  }));
}

/** État initial : plan SYSCOHADA, journaux, périodes ouvertes. Aucune écriture. */
export function createEmptyState(organizationId: string, fiscalYearId: string, year = 2026): AccountingState {
  return {
    organizationId,
    fiscalYearId,
    accounts: SYSCOHADA_STARTER_ACCOUNTS.map((account) => ({ ...account })),
    journals: STARTER_JOURNALS.map((journal) => ({ ...journal })),
    thirdParties: [],
    entrySequences: [],
    entries: [],
    reconciliations: [],
    attachments: [],
    periods: createOpenPeriods(year),
    audit: []
  };
}

/** Adaptateur mémoire : référence pour les tests et le mode démonstration. */
export class InMemoryStorage implements StoragePort {
  #state: AccountingState;

  constructor(initial: AccountingState) {
    this.#state = structuredClone(initial);
  }

  async read(): Promise<AccountingState> {
    return structuredClone(this.#state);
  }

  async write(state: AccountingState): Promise<void> {
    this.#state = structuredClone(state);
  }
}
