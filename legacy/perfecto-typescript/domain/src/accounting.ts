/**
 * Pièce comptable et lignes : cœur des invariants du Lot 1.
 * Portage TypeScript de Perfecto.Domain/Accounting (AccountingEntry.cs, AccountingEntryLine.cs).
 *
 * Invariants conservés :
 *  - une ligne porte un débit OU un crédit, strictement positif ;
 *  - une pièce valide compte au moins deux lignes et débits == crédits ;
 *  - une pièce validée est immuable (toute correction passera par une extourne) ;
 *  - les montants sont des {@link Amount} exacts, arrondis au plus pair à 2 décimales.
 *
 * Ajouts tranche 2 :
 *  - la pièce porte son NUMÉRO automatique (séquence par journal et par exercice) ;
 *  - un brouillon est RÉVISABLE (en-tête et lignes) tant qu'il n'est pas validé,
 *    avec horodatage `updatedAt` pour l'audit ;
 *  - une ligne peut porter un tiers (comptes auxiliaires 4011xx / 4111xx).
 */

import { DomainRuleError, type CivilDate } from "./core";
import { AMOUNT_ZERO, amountAdd, amountCompare, type Amount } from "./money";

export const AccountingEntryStatus = {
  Draft: "draft",
  Posted: "posted",
  Reversed: "reversed"
} as const;
export type AccountingEntryStatus = (typeof AccountingEntryStatus)[keyof typeof AccountingEntryStatus];

/** Libellés métier affichés par les écrans (français). */
export const accountingEntryStatusLabel: Record<AccountingEntryStatus, string> = {
  draft: "Brouillon",
  posted: "Validée",
  reversed: "Extournée"
};

export interface AccountingEntryLineData {
  readonly id: string;
  readonly accountCode: string;
  readonly label: string;
  readonly debit: Amount;
  readonly credit: Amount;
  /** Code tiers rattaché à la ligne, ou `null` si la ligne n'en porte pas. */
  readonly thirdPartyCode: string | null;
}

export interface EntryLineInput {
  readonly accountCode: string;
  readonly label: string;
  readonly debit: Amount;
  readonly credit: Amount;
  readonly thirdPartyCode?: string | null | undefined;
}

export function createEntryLine(
  accountCode: string,
  label: string,
  debit: Amount,
  credit: Amount,
  thirdPartyCode?: string | null
): AccountingEntryLineData {
  const code = accountCode.trim();
  if (code.length === 0) {
    throw new DomainRuleError("Le compte est obligatoire.");
  }
  const lineLabel = label.trim();
  if (lineLabel.length === 0) {
    throw new DomainRuleError("Le libellé de ligne est obligatoire.");
  }
  if (debit < 0n || credit < 0n) {
    throw new DomainRuleError("Les montants ne peuvent pas être négatifs.");
  }
  if ((debit === 0n && credit === 0n) || (debit > 0n && credit > 0n)) {
    throw new DomainRuleError("Une ligne doit porter un débit ou un crédit, exclusivement.");
  }
  const tier = thirdPartyCode?.trim() ?? "";
  return {
    id: crypto.randomUUID(),
    accountCode: code,
    label: lineLabel,
    debit,
    credit,
    thirdPartyCode: tier.length > 0 ? tier.toUpperCase() : null
  };
}

export interface AccountingEntryInput {
  readonly fiscalYearId: string;
  readonly organizationId: string;
  readonly journalCode: string;
  readonly entryDate: CivilDate;
  readonly reference: string;
  /** Numéro automatique attribué par le noyau (ex. `ACH-2026-0001`). */
  readonly number: string;
  readonly now: Date;
}

export interface AccountingEntryRevision {
  readonly entryDate?: CivilDate | undefined;
  readonly reference?: string | undefined;
  readonly lines?: readonly EntryLineInput[] | undefined;
}

export class AccountingEntry {
  readonly id: string;
  readonly fiscalYearId: string;
  readonly organizationId: string;
  readonly number: string;
  #journalCode: string;
  #entryDate: CivilDate;
  #reference: string;
  readonly createdAt: Date;
  #updatedAt: Date;
  #status: AccountingEntryStatus;
  #postedAt: Date | null = null;
  #reversedAt: Date | null = null;
  #lines: AccountingEntryLineData[] = [];

  private constructor(input: AccountingEntryInput, lines: readonly AccountingEntryLineData[] = []) {
    if (input.fiscalYearId.trim().length === 0) {
      throw new DomainRuleError("L'exercice est obligatoire.");
    }
    if (input.organizationId.trim().length === 0) {
      throw new DomainRuleError("L'organisation est obligatoire.");
    }
    this.id = crypto.randomUUID();
    this.fiscalYearId = input.fiscalYearId;
    this.organizationId = input.organizationId;
    this.number = requireText(input.number, "Le numéro de pièce est obligatoire.");
    this.#journalCode = requireText(input.journalCode, "Le journal est obligatoire.").toUpperCase();
    this.#entryDate = input.entryDate;
    this.#reference = requireText(input.reference, "La référence de pièce est obligatoire.");
    this.#status = AccountingEntryStatus.Draft;
    this.createdAt = input.now;
    this.#updatedAt = input.now;
    this.#lines = [...lines];
  }

  get journalCode(): string {
    return this.#journalCode;
  }
  get entryDate(): CivilDate {
    return this.#entryDate;
  }
  get reference(): string {
    return this.#reference;
  }
  get updatedAt(): Date {
    return this.#updatedAt;
  }
  get status(): AccountingEntryStatus {
    return this.#status;
  }
  get postedAt(): Date | null {
    return this.#postedAt;
  }
  get reversedAt(): Date | null {
    return this.#reversedAt;
  }
  get lines(): readonly AccountingEntryLineData[] {
    return this.#lines;
  }

  get totalDebit(): Amount {
    return this.#lines.reduce((sum, line) => amountAdd(sum, line.debit), AMOUNT_ZERO);
  }

  get totalCredit(): Amount {
    return this.#lines.reduce((sum, line) => amountAdd(sum, line.credit), AMOUNT_ZERO);
  }

  get isBalanced(): boolean {
    return this.#lines.length >= 2 && amountCompare(this.totalDebit, this.totalCredit) === 0;
  }

  static create(input: AccountingEntryInput): AccountingEntry {
    return new AccountingEntry(input);
  }

  /**
   * Reconstruit un agrégat à partir de données persistées (statut, validation,
   * lignes et horodatages compris). Utilisé par le noyau pour repasser par les
   * règles du domaine avant toute mutation d'une pièce existante.
   */
  static restore(input: {
    entry: AccountingEntryInput;
    status: AccountingEntryStatus;
    postedAt: Date | null;
    reversedAt?: Date | null | undefined;
    updatedAt?: Date | undefined;
    lines: readonly AccountingEntryLineData[];
  }): AccountingEntry {
    const restored = new AccountingEntry(input.entry, input.lines);
    restored.#status = input.status;
    restored.#postedAt = input.postedAt;
    restored.#reversedAt = input.reversedAt ?? null;
    restored.#updatedAt = input.updatedAt ?? input.entry.now;
    return restored;
  }

  /**
   * Lignes de la contre-passation : mêmes comptes, mêmes libellés, mêmes tiers,
   * débits et crédits permutés. La pièce d'origine n'est jamais modifiée.
   */
  reversalLineInputs(): EntryLineInput[] {
    return this.#lines.map((line) => ({
      accountCode: line.accountCode,
      label: line.label,
      debit: line.credit,
      credit: line.debit,
      thirdPartyCode: line.thirdPartyCode
    }));
  }

  addLine(
    accountCode: string,
    label: string,
    debit: Amount,
    credit: Amount,
    thirdPartyCode?: string | null,
    now?: Date
  ): void {
    this.ensureDraft();
    this.#lines.push(createEntryLine(accountCode, label, debit, credit, thirdPartyCode));
    if (now) {
      this.touch(now);
    }
  }

  /**
   * Révise un brouillon : date, référence et/ou remplacement complet des lignes.
   * Refusée sur toute pièce validée ou extournée (immutabilité garantie).
   */
  revise(revision: AccountingEntryRevision, now: Date): void {
    this.ensureDraft();
    if (revision.entryDate !== undefined) {
      this.#entryDate = revision.entryDate;
    }
    if (revision.reference !== undefined) {
      this.#reference = requireText(revision.reference, "La référence de pièce est obligatoire.");
    }
    if (revision.lines !== undefined) {
      if (revision.lines.length === 0) {
        throw new DomainRuleError("Une pièce doit contenir au moins une ligne.");
      }
      this.#lines = revision.lines.map((line) =>
        createEntryLine(line.accountCode, line.label, line.debit, line.credit, line.thirdPartyCode ?? null)
      );
    }
    this.touch(now);
  }

  post(now: Date): void {
    this.ensureDraft();
    if (!this.isBalanced) {
      throw new DomainRuleError("La pièce doit contenir au moins deux lignes et être équilibrée avant validation.");
    }
    this.#status = AccountingEntryStatus.Posted;
    this.#postedAt = now;
    this.touch(now);
  }

  /**
   * Marque la pièce comme extournée (contre-passation). Réservé au parcours
   * d'extourne : la pièce d'origine n'est jamais modifiée, une pièce inverse
   * est créée par le noyau applicatif.
   */
  markReversed(now: Date): void {
    if (this.#status === AccountingEntryStatus.Reversed) {
      throw new DomainRuleError("Cette pièce a déjà été extournée.");
    }
    if (this.#status !== AccountingEntryStatus.Posted) {
      throw new DomainRuleError("Seule une pièce validée peut être extournée.");
    }
    this.#status = AccountingEntryStatus.Reversed;
    // postedAt est conservé : la date de validation appartient à l'histoire de la pièce.
    this.#reversedAt = now;
    this.touch(now);
  }

  private touch(now: Date): void {
    this.#updatedAt = now;
  }

  private ensureDraft(): void {
    if (this.#status !== AccountingEntryStatus.Draft) {
      throw new DomainRuleError("Une pièce validée est immuable. Utilisez une extourne pour la corriger.");
    }
  }
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new DomainRuleError(message);
  }
  return normalized;
}
