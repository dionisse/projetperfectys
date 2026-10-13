/**
 * Contrats d'échange UI / noyau / API.
 * Portage TypeScript de Perfecto.Contracts/Accounting/AccountingContracts.cs.
 *
 * Décisions « meilleure version » :
 *  - les statuts sont des unions typées (`EntryStatus`), plus des chaînes françaises
 *    comparées à la main ; les libellés affichés viennent de `entryStatusLabel` ;
 *  - chaque agrégat comptable porte son `organizationId` (cloisonnement multi-sociétés) ;
 *  - les montants voyagent en chaînes décimales exactes (`amountToDecimal`), jamais en
 *    flottants JSON.
 */

import type { AccountingEntryStatus, CivilDate } from "@perfecto/domain";

export type EntryStatus = AccountingEntryStatus;

export interface GeneralAccountDto {
  code: string;
  label: string;
  accountClass: string;
  accountType: string;
  allowsPosting: boolean;
  requiresThirdParty: boolean;
  isActive: boolean;
}

export interface AccountingJournalDto {
  code: string;
  label: string;
  journalType: string;
  counterpartAccount: string | null;
  isActive: boolean;
}

export interface AccountingEntryLineDto {
  id: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  /** Montant décimal exact (chaîne), unités minoritaires sérialisées. */
  debit: string;
  credit: string;
}

export interface AccountingEntryDto {
  id: string;
  organizationId: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description: string;
  status: EntryStatus;
  totalDebit: string;
  totalCredit: string;
  createdAt: string;
  postedAt: string | null;
  lines: AccountingEntryLineDto[];
}

export interface TrialBalanceLineDto {
  accountCode: string;
  accountLabel: string;
  debitMovements: string;
  creditMovements: string;
  debitBalance: string;
  creditBalance: string;
}

export interface JournalLineDto {
  entryDate: CivilDate;
  journalCode: string;
  reference: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: string;
  credit: string;
}

export interface LedgerLineDto {
  entryDate: CivilDate;
  journalCode: string;
  reference: string;
  label: string;
  debit: string;
  credit: string;
  runningBalance: string;
}

export interface LedgerAccountDto {
  accountCode: string;
  accountLabel: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: LedgerLineDto[];
}

export interface AccountingPeriodDto {
  year: number;
  month: number;
  label: string;
  isClosed: boolean;
  closedAt: string | null;
}

export interface AccountingSnapshot {
  organizationId: string;
  accountCount: number;
  journalCount: number;
  draftEntryCount: number;
  postedEntryCount: number;
  totalDebitMovements: string;
  totalCreditMovements: string;
  recentEntries: AccountingEntryDto[];
  trialBalance: TrialBalanceLineDto[];
  storageMode: string;
}

/* ---------------------------- Entrées ---------------------------- */

/** Montant accepté en entrée : chaîne décimale ou number (converti au plus pair). */
export type AmountInput = string | number;

export interface AccountingEntryLineInput {
  accountCode: string;
  label: string;
  debit: AmountInput;
  credit: AmountInput;
}

export interface CreateAccountingEntryRequest {
  organizationId: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description?: string;
  postImmediately: boolean;
  lines: AccountingEntryLineInput[];
}

export interface CreateGeneralAccountRequest {
  organizationId: string;
  code: string;
  label: string;
  accountType?: string;
  requiresThirdParty?: boolean;
}
