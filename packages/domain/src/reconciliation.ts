/**
 * Lettrage / rapprochement des comptes de tiers.
 *
 * Pratique comptable francophone reprise de l'original (menu CR → Éditions →
 * « lettrage ») : on rapproche un ensemble de mouvements débit et crédit d'un
 * même tiers, on leur attribue une LETTRE (A, B, … Z, AA, AB…), et ce qui n'est
 * pas lettré constitue le solde en suspens à relancer.
 *
 * Invariants :
 *  - un lettrage compte au moins deux lignes ;
 *  - un lettrage est équilibré (total débit == total crédit) ;
 *  - une ligne ne peut appartenir qu'à UN seul lettrage ;
 *  - seules les lignes de pièces comptabilisées (validées ou extournées) sont
 *    lettrables : un brouillon peut encore changer.
 */

import { DomainRuleError } from "./core";
import { AMOUNT_ZERO, amountAdd, amountToDecimal, type Amount } from "./money";

export const ReconciliationScope = {
  ThirdParty: "thirdParty",
  Account: "account"
} as const;
export type ReconciliationScope = (typeof ReconciliationScope)[keyof typeof ReconciliationScope];

export interface ReconcilableLine {
  readonly id: string;
  readonly debit: Amount;
  readonly credit: Amount;
}

export interface ReconciliationTotals {
  readonly totalDebit: Amount;
  readonly totalCredit: Amount;
}

const ALPHABET = 26;

/** 0 -> « A », 25 -> « Z », 26 -> « AA », 52 -> « BA ». */
export function reconciliationLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new DomainRuleError(`Rang de lettrage invalide : ${index}.`);
  }
  let label = "";
  let rank = index;
  do {
    label = String.fromCharCode(65 + (rank % ALPHABET)) + label;
    rank = Math.floor(rank / ALPHABET) - 1;
  } while (rank >= 0);
  return label;
}

/** Première lettre encore libre compte tenu des lettrages existants. */
export function nextReconciliationLabel(existingLabels: readonly string[]): string {
  const taken = new Set(existingLabels.map((label) => label.trim().toUpperCase()));
  for (let index = 0; index < taken.size + ALPHABET * 2; index += 1) {
    const label = reconciliationLabel(index);
    if (!taken.has(label)) {
      return label;
    }
  }
  throw new DomainRuleError("Toutes les combinaisons de lettrage sont utilisées.");
}

/**
 * Vérifie qu'un ensemble de lignes peut être lettré et retourne ses totaux.
 * Fonction pure : le noyau applicatif l'utilise avant d'écrire.
 */
export function validateReconcilableLines(lines: readonly ReconcilableLine[]): ReconciliationTotals {
  if (lines.length < 2) {
    throw new DomainRuleError("Un lettrage doit rapprocher au moins deux mouvements.");
  }
  const ids = new Set(lines.map((line) => line.id));
  if (ids.size !== lines.length) {
    throw new DomainRuleError("Un mouvement est présent deux fois dans la sélection.");
  }

  let totalDebit: Amount = AMOUNT_ZERO;
  let totalCredit: Amount = AMOUNT_ZERO;
  for (const line of lines) {
    totalDebit = amountAdd(totalDebit, line.debit);
    totalCredit = amountAdd(totalCredit, line.credit);
  }
  if (totalDebit !== totalCredit) {
    throw new DomainRuleError(
      `Lettrage déséquilibré : ${amountToDecimal(totalDebit)} au débit pour ${amountToDecimal(
        totalCredit
      )} au crédit. Sélectionnez des mouvements de même total.`
    );
  }
  if (totalDebit === AMOUNT_ZERO) {
    throw new DomainRuleError("Un lettrage doit porter un montant non nul.");
  }
  return { totalDebit, totalCredit };
}
