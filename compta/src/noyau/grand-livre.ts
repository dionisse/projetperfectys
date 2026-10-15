/**
 * Grand livre : mouvements comptabilisés, balance, journal, compte.
 *
 * Ce module ne connaît ni le stockage ni la saisie. Il reçoit des **mouvements comptabilisés**
 * (ajout-seulement) et des comptes, et produit les états. Séparer les deux garantit qu'un état ne
 * puisse jamais afficher une écriture non comptabilisée — erreur classique des applications qui
 * recomposent leurs totaux à partir des brouillons.
 */

import type { Compte } from "./comptes";
import type { GroupeDeComptes } from "./comptes";
import {
  ZERO,
  additionner,
  comparer,
  estNegatif,
  formatMontant,
  type Montant
} from "./montants";
import type { DateCivile } from "./calendrier";

export interface Mouvement {
  lotId: string;
  lotNumero: string;
  journalCode: string;
  ecritureId: string;
  ecritureNumero: string;
  piece: string;
  date: DateCivile;
  /** Numéro de période de l'exercice. */
  periode: number;
  compte: string;
  tiersCode: string | null;
  libelle: string;
  debit: Montant;
  credit: Montant;
  codesTaxe: string[];
  /** Horodatage de la comptabilisation : la piste d'audit s'y appuie. */
  comptabiliseLe: string;
}

export type SensSolde = "debiteur" | "crediteur" | "nul";

/**
 * Compte principal d'un numéro segmenté : `401100-CLI01` → `401100`.
 *
 * La balance et le grand livre raisonnent par compte du plan ; le détail par tiers reste
 * accessible en filtrant les mouvements. Sans ce regroupement, une écriture sur un compte
 * auxiliaire disparaîtrait de la balance — et une balance qui oublie un mouvement n'est pas
 * seulement fausse, elle est dangereuse.
 */
export function comptePrincipalDe(numero: string, separateur = "-"): string {
  const index = numero.indexOf(separateur);
  return index === -1 ? numero : numero.slice(0, index);
}

export function sensDe(solde: Montant): SensSolde {
  if (solde === ZERO) return "nul";
  return estNegatif(solde) ? "crediteur" : "debiteur";
}

export const LIBELLES_SENS: Record<SensSolde, string> = {
  debiteur: "Débiteur",
  crediteur: "Créditeur",
  nul: "Soldé"
};

export interface LigneBalance {
  compte: string;
  libelle: string;
  classe: string;
  groupe: string;
  soldeInitial: Montant;
  totalDebit: Montant;
  totalCredit: Montant;
  /** Débit − crédit, solde initial compris. */
  solde: Montant;
  sens: SensSolde;
}

export interface FiltreMouvements {
  du?: DateCivile;
  au?: DateCivile;
  journalCode?: string;
  periode?: number;
  tiersCode?: string;
}

export function filtrerMouvements(
  mouvements: readonly Mouvement[],
  filtre: FiltreMouvements = {}
): Mouvement[] {
  return mouvements.filter((mouvement) => {
    if (filtre.du && mouvement.date < filtre.du) return false;
    if (filtre.au && mouvement.date > filtre.au) return false;
    if (filtre.journalCode && mouvement.journalCode !== filtre.journalCode) return false;
    if (filtre.periode !== undefined && mouvement.periode !== filtre.periode) return false;
    if (filtre.tiersCode && mouvement.tiersCode !== filtre.tiersCode) return false;
    return true;
  });
}

/** Contrôle fondamental : le grand livre doit être équilibré, sans exception. */
export function verifierEquilibre(mouvements: readonly Mouvement[]): {
  totalDebit: Montant;
  totalCredit: Montant;
  equilibre: boolean;
} {
  const totalDebit = additionner(...mouvements.map((mouvement) => mouvement.debit));
  const totalCredit = additionner(...mouvements.map((mouvement) => mouvement.credit));
  return { totalDebit, totalCredit, equilibre: comparer(totalDebit, totalCredit) === 0 };
}

export function construireBalance(
  mouvements: readonly Mouvement[],
  comptes: readonly Compte[],
  filtre: FiltreMouvements = {}
): LigneBalance[] {
  const parCompte = new Map<string, { debit: Montant; credit: Montant }>();
  for (const mouvement of filtrerMouvements(mouvements, filtre)) {
    const cle = comptePrincipalDe(mouvement.compte);
    const courant = parCompte.get(cle) ?? { debit: ZERO, credit: ZERO };
    parCompte.set(cle, {
      debit: courant.debit + mouvement.debit,
      credit: courant.credit + mouvement.credit
    });
  }

  const lignes: LigneBalance[] = [];
  for (const compte of comptes) {
    const cumuls = parCompte.get(compte.numero);
    const totalDebit = cumuls?.debit ?? ZERO;
    const totalCredit = cumuls?.credit ?? ZERO;
    if (totalDebit === ZERO && totalCredit === ZERO && compte.soldeInitial === ZERO) {
      // Une balance n'affiche pas les comptes sans mouvement ni solde : ce serait du bruit.
      continue;
    }
    const solde = compte.soldeInitial + totalDebit - totalCredit;
    lignes.push({
      compte: compte.numero,
      libelle: compte.libelle,
      classe: compte.classe,
      groupe: compte.groupe,
      soldeInitial: compte.soldeInitial,
      totalDebit,
      totalCredit,
      solde,
      sens: sensDe(solde)
    });
  }
  lignes.sort((gauche, droite) => gauche.compte.localeCompare(droite.compte));
  return lignes;
}

export interface LigneGrandLivre {
  date: DateCivile;
  piece: string;
  journalCode: string;
  lotNumero: string;
  libelle: string;
  tiersCode: string | null;
  debit: Montant;
  credit: Montant;
  soldeProgressif: Montant;
  sens: SensSolde;
}

export function construireGrandLivre(
  compte: Compte,
  mouvements: readonly Mouvement[],
  filtre: FiltreMouvements = {}
): LigneGrandLivre[] {
  const retenus = filtrerMouvements(mouvements, filtre).filter(
    (mouvement) => comptePrincipalDe(mouvement.compte) === compte.comptePrincipal
  );
  retenus.sort(
    (gauche, droite) => gauche.date.localeCompare(droite.date) || gauche.piece.localeCompare(droite.piece)
  );

  let solde = compte.soldeInitial;
  return retenus.map((mouvement) => {
    solde = solde + mouvement.debit - mouvement.credit;
    return {
      date: mouvement.date,
      piece: mouvement.piece,
      journalCode: mouvement.journalCode,
      lotNumero: mouvement.lotNumero,
      libelle: mouvement.libelle,
      tiersCode: mouvement.tiersCode,
      debit: mouvement.debit,
      credit: mouvement.credit,
      soldeProgressif: solde,
      sens: sensDe(solde)
    };
  });
}

export interface PieceDeJournal {
  date: DateCivile;
  piece: string;
  journalCode: string;
  lotNumero: string;
  ecritureNumero: string;
  lignes: { compte: string; libelle: string; tiersCode: string | null; debit: Montant; credit: Montant }[];
  totalDebit: Montant;
  totalCredit: Montant;
}

export function construireJournal(
  mouvements: readonly Mouvement[],
  filtre: FiltreMouvements = {}
): PieceDeJournal[] {
  const parPiece = new Map<string, Mouvement[]>();
  for (const mouvement of filtrerMouvements(mouvements, filtre)) {
    const cle = `${mouvement.journalCode}|${mouvement.date}|${mouvement.piece}`;
    const liste = parPiece.get(cle) ?? [];
    liste.push(mouvement);
    parPiece.set(cle, liste);
  }

  const pieces: PieceDeJournal[] = [];
  for (const [, liste] of parPiece) {
    const premier = liste[0];
    if (!premier) continue;
    pieces.push({
      date: premier.date,
      piece: premier.piece,
      journalCode: premier.journalCode,
      lotNumero: premier.lotNumero,
      ecritureNumero: premier.ecritureNumero,
      lignes: liste.map((mouvement) => ({
        compte: mouvement.compte,
        libelle: mouvement.libelle,
        tiersCode: mouvement.tiersCode,
        debit: mouvement.debit,
        credit: mouvement.credit
      })),
      totalDebit: additionner(...liste.map((mouvement) => mouvement.debit)),
      totalCredit: additionner(...liste.map((mouvement) => mouvement.credit))
    });
  }
  pieces.sort((gauche, droite) => gauche.date.localeCompare(droite.date) || gauche.piece.localeCompare(droite.piece));
  return pieces;
}

export interface TotalParGroupe {
  groupe: string;
  libelle: string;
  etat: GroupeDeComptes["etat"];
  total: Montant;
  /** Total présenté comme il doit l'être dans un état : positif pour l'actif, etc. */
  presentation: string;
}

/**
 * Totaux par groupe de comptes : c'est la matière des états financiers OHADA révisé, comme les
 * *Account Groups* le sont chez Sage. Le groupe porte l'état auquel il contribue.
 */
export function totauxParGroupe(
  balance: readonly LigneBalance[],
  groupes: readonly GroupeDeComptes[],
  montantEnTexte: (montant: Montant) => string = (montant) => formatMontant(montant)
): TotalParGroupe[] {
  return groupes.map((groupe) => {
    const total = additionner(
      ...balance.filter((ligne) => ligne.groupe === groupe.code).map((ligne) => ligne.solde)
    );
    return {
      groupe: groupe.code,
      libelle: groupe.libelle,
      etat: groupe.etat,
      total,
      presentation: montantEnTexte(total)
    };
  });
}
