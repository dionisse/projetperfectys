/**
 * Pièce comptable et lignes : cœur des invariants du Lot 1.
 * Portage TypeScript de Perfecto.Domain/Accounting (AccountingEntry.cs, AccountingEntryLine.cs).
 *
 * Invariants conservés :
 *  - une ligne porte un débit OU un crédit, strictement positif ;
 *  - une pièce valide compte au moins deux lignes et débits == crédits ;
 *  - une pièce validée est immuable (toute correction passera par une extourne) ;
 *  - les montants sont des {@link Amount} exacts, arrondis au plus pair à 2 décimales.
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
}

export function createEntryLine(
  accountCode: string,
  label: string,
  debit: Amount,
  credit: Amount
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
  return { id: crypto.randomUUID(), accountCode: code, label: lineLabel, debit, credit };
}

export class AccountingEntry {
  readonly id: string;
  readonly fiscalYearId: string;
  readonly organizationId: string;
  readonly journalCode: string;
  readonly entryDate: CivilDate;
  readonly reference: string;
  readonly createdAt: Date;
  #status: AccountingEntryStatus;
  #postedAt: Date | null = null;
  readonly #lines: AccountingEntryLineData[] = [];

  private constructor(
    fiscalYearId: string,
    organizationId: string,
    journalCode: string,
    entryDate: CivilDate,
    reference: string,
    now: Date
  ) {
    if (fiscalYearId.trim().length === 0) {
      throw new DomainRuleError("L'exercice est obligatoire.");
    }
    if (organizationId.trim().length === 0) {
      throw new DomainRuleError("L'organisation est obligatoire.");
    }
    this.id = crypto.randomUUID();
    this.fiscalYearId = fiscalYearId;
    this.organizationId = organizationId;
    this.journalCode = requireText(journalCode, "Le journal est obligatoire.").toUpperCase();
    this.entryDate = entryDate;
    this.reference = requireText(reference, "La référence de pièce est obligatoire.");
    this.#status = AccountingEntryStatus.Draft;
    this.createdAt = now;
  }

  get status(): AccountingEntryStatus {
    return this.#status;
  }
  get postedAt(): Date | null {
    return this.#postedAt;
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

  static create(
    fiscalYearId: string,
    organizationId: string,
    journalCode: string,
    entryDate: CivilDate,
    reference: string,
    now: Date
  ): AccountingEntry {
    return new AccountingEntry(fiscalYearId, organizationId, journalCode, entryDate, reference, now);
  }

  addLine(accountCode: string, label: string, debit: Amount, credit: Amount): void {
    this.ensureDraft();
    this.#lines.push(createEntryLine(accountCode, label, debit, credit));
  }

  post(now: Date): void {
    this.ensureDraft();
    if (!this.isBalanced) {
      throw new DomainRuleError("La pièce doit contenir au moins deux lignes et être équilibrée avant validation.");
    }
    this.#status = AccountingEntryStatus.Posted;
    this.#postedAt = now;
  }

  /**
   * Marque la pièce comme extournée (contre-passation). Réservé au parcours
   * d'extourne : la pièce d'origine n'est jamais modifiée, une pièce inverse
   * est créée par le noyau applicatif.
   */
  markReversed(now: Date): void {
    if (this.#status !== AccountingEntryStatus.Posted) {
      throw new DomainRuleError("Seule une pièce validée peut être extournée.");
    }
    this.#status = AccountingEntryStatus.Reversed;
    this.#postedAt = now;
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
