/**
 * Lots et écritures — l'unité de travail de la saisie.
 *
 * C'est le changement de modèle le plus structurant par rapport à l'ancienne application : chez
 * Sage, **on n'écrit pas une pièce isolée, on ouvre un lot**, on y saisit des écritures, on le
 * marque « prêt », puis on le comptabilise d'un seul mouvement. Un lot se liste, s'imprime, se
 * comptabilise et se contre-passe **en bloc** : c'est ce qui rend la piste de contrôle exploitable
 * par un réviseur, et ce qui permet de refuser une comptabilisation partielle.
 *
 * Vocabulaire retenu : `Lot` (batch Sage) → `Ecriture` (journal entry) → `Ligne` (detail line).
 */

import {
  ErreurRegle,
  ZERO,
  additionner,
  comparer,
  estNegatif,
  estNul,
  type Montant
} from "./montants";
import type { DateCivile } from "./calendrier";

export type EtatLot = "ouvert" | "pret" | "comptabilise" | "contre-passe";

export type EtatEcriture = "brouillon" | "comptabilisee" | "contre-passee";

export type NatureJournal =
  | "achats"
  | "ventes"
  | "banque"
  | "caisse"
  | "operations-diverses"
  | "a-nouveaux"
  | "salaires";

export interface Journal {
  code: string;
  libelle: string;
  nature: NatureJournal;
  /** Compte de contrepartie automatique (trésorerie) : `null` si le journal n'en a pas. */
  compteContrepartie: string | null;
  /** Préfixe des numéros de lot de ce journal (`ACH`, `VTE`…). */
  prefixeLot: string;
  actif: boolean;
}

export const LIBELLES_NATURE_JOURNAL: Record<NatureJournal, string> = {
  achats: "Achats",
  ventes: "Ventes",
  banque: "Banque",
  caisse: "Caisse",
  "operations-diverses": "Opérations diverses",
  "a-nouveaux": "À-nouveaux",
  salaires: "Salaires"
};

export interface LigneEcriture {
  id: string;
  /** Numéro de compte complet, segments compris. */
  compte: string;
  libelle: string;
  debit: Montant;
  credit: Montant;
  /**
   * Codes de taxe du paquet pays. Une même ligne peut en porter plusieurs : un achat béninois
   * supporte à la fois la TVA déductible et l'acompte de 1 %.
   */
  codesTaxe: string[];
  tiersCode: string | null;
  echeance: DateCivile | null;
}

export interface Ecriture {
  id: string;
  /** Numéro d'écriture dans le journal, attribué par la séquence du dossier. */
  numero: string;
  piece: string;
  date: DateCivile;
  libelle: string;
  etat: EtatEcriture;
  lignes: LigneEcriture[];
  /** Écriture d'origine quand celle-ci est une contre-passation. */
  origine: string | null;
}

export interface Lot {
  id: string;
  numero: string;
  journalCode: string;
  date: DateCivile;
  libelle: string;
  /** Code source : provenance de la saisie (manuelle, import, récurrence). */
  codeSource: string;
  etat: EtatLot;
  ecritures: Ecriture[];
  comptabiliseLe: string | null;
  comptabilisePar: string | null;
  contrePasseLe: string | null;
  /** Lot d'origine, quand celui-ci est une contre-passation. */
  origine: string | null;
}

export const CODES_SOURCE = [
  { code: "SAISIE", libelle: "Saisie manuelle" },
  { code: "IMPORT", libelle: "Import de données" },
  { code: "RECURRENCE", libelle: "Écritures récurrentes" },
  { code: "VENTILATION", libelle: "Lot de ventilation" },
  { code: "ANOUVEAU", libelle: "À-nouveaux" },
  { code: "CONTREPASSATION", libelle: "Contre-passation" }
] as const;

export function totalDebit(lignes: readonly LigneEcriture[]): Montant {
  return additionner(...lignes.map((ligne) => ligne.debit));
}

export function totalCredit(lignes: readonly LigneEcriture[]): Montant {
  return additionner(...lignes.map((ligne) => ligne.credit));
}

export function totalLot(lot: Lot): { debit: Montant; credit: Montant } {
  const lignes = lot.ecritures.flatMap((ecriture) => ecriture.lignes);
  return { debit: totalDebit(lignes), credit: totalCredit(lignes) };
}

export interface ContexteValidation {
  /**
   * Résout un numéro de compte, segments compris. Pour un compte segmenté (`401100-CLI01`),
   * renvoie le compte du plan complété de son auxiliaire : le tiers se lit dans le numéro, il
   * n'est jamais deviné ni dupliqué ailleurs.
   */
  compteParNumero: (numero: string) => CompteResolu | null;
  tiersActif: (code: string) => boolean;
  /** Vrai si la période de la date est ouverte dans l'exercice du dossier. */
  periodeOuverte: (date: DateCivile) => boolean;
}

/** Compte du plan tel que résolu pour une ligne donnée. */
export interface CompteResolu {
  numero: string;
  comptePrincipal: string;
  auxiliaire: string | null;
  axe: string | null;
  libelle: string;
  classe: string;
  groupe: string;
  exigeTiers: boolean;
  autoriseSaisie: boolean;
}

/**
 * Vérifie une ligne : compte existant et saisissable, débit ou crédit exclusif, montants non
 * négatifs, tiers présent et actif sur un compte auxiliaire.
 */
export function validerLigne(ligne: LigneEcriture, contexte: ContexteValidation): void {
  const numero = ligne.compte.trim().toUpperCase();
  if (numero === "") {
    throw new ErreurRegle("Le compte est obligatoire sur chaque ligne.");
  }
  const compte = contexte.compteParNumero(numero);
  if (!compte) {
    throw new ErreurRegle(`Le compte « ${ligne.compte} » n'existe pas dans le plan du dossier.`);
  }
  if (!compte.autoriseSaisie) {
    throw new ErreurRegle(
      `Le compte « ${compte.comptePrincipal} » est un compte de regroupement : saisissez sur un compte subdivisionnaire.`
    );
  }
  if (estNegatif(ligne.debit) || estNegatif(ligne.credit)) {
    throw new ErreurRegle("Un montant négatif est refusé : inversez le sens (débit ou crédit).");
  }
  if (!estNul(ligne.debit) && !estNul(ligne.credit)) {
    throw new ErreurRegle(
      `Ligne ${numero} : une ligne porte soit un débit, soit un crédit, jamais les deux.`
    );
  }
  if (estNul(ligne.debit) && estNul(ligne.credit)) {
    throw new ErreurRegle(`Ligne ${numero} : un montant est obligatoire.`);
  }
  if (compte.exigeTiers) {
    const tiers = (ligne.tiersCode ?? compte.auxiliaire ?? "").trim().toUpperCase();
    if (tiers === "") {
      throw new ErreurRegle(
        `Le compte « ${compte.comptePrincipal} » est un compte auxiliaire : le tiers est obligatoire.`
      );
    }
    if (!contexte.tiersActif(tiers)) {
      throw new ErreurRegle(`Le tiers « ${tiers} » n'existe pas ou est inactif.`);
    }
  }
  if (ligne.libelle.trim() === "") {
    throw new ErreurRegle(`Ligne ${numero} : le libellé est obligatoire.`);
  }
}

/** Vérifie une écriture : lignes valides, équilibre, date dans une période ouverte. */
export function validerEcriture(ecriture: Ecriture, contexte: ContexteValidation): void {
  if (ecriture.lignes.length === 0) {
    throw new ErreurRegle(`L'écriture ${ecriture.numero || "sans numéro"} ne comporte aucune ligne.`);
  }
  if (ecriture.piece.trim() === "") {
    throw new ErreurRegle("La référence de pièce est obligatoire.");
  }
  if (!contexte.periodeOuverte(ecriture.date)) {
    throw new ErreurRegle(
      `La période de la date ${ecriture.date} est clôturée : aucune écriture n'y est acceptée.`
    );
  }
  for (const ligne of ecriture.lignes) {
    validerLigne(ligne, contexte);
  }
  const debit = totalDebit(ecriture.lignes);
  const credit = totalCredit(ecriture.lignes);
  if (comparer(debit, credit) !== 0) {
    throw new ErreurRegle(
      `L'écriture ${ecriture.piece} n'est pas équilibrée : débit ${debit}, crédit ${credit}.`
    );
  }
}

/**
 * Vérifie un lot entier. Un lot ne se comptabilise que si toutes ses écritures sont valides :
 * la comptabilisation est atomique, tout passe ou rien ne passe.
 */
export function validerLot(lot: Lot, contexte: ContexteValidation): void {
  if (lot.ecritures.length === 0) {
    throw new ErreurRegle(`Le lot ${lot.numero} est vide : ajoutez au moins une écriture.`);
  }
  if (lot.libelle.trim() === "") {
    throw new ErreurRegle("Le libellé du lot est obligatoire.");
  }
  const numeros = new Set<string>();
  for (const ecriture of lot.ecritures) {
    validerEcriture(ecriture, contexte);
    const cle = ecriture.piece.trim().toUpperCase();
    if (numeros.has(cle)) {
      throw new ErreurRegle(
        `La référence de pièce « ${ecriture.piece} » apparaît deux fois dans le lot ${lot.numero}.`
      );
    }
    numeros.add(cle);
  }
}

/** Un lot est comptabilisable s'il est prêt et n'a jamais été comptabilisé. */
export function lotComptabilisable(lot: Lot): boolean {
  return lot.etat === "pret";
}

export function lotModifiable(lot: Lot): boolean {
  return lot.etat === "ouvert";
}

/**
 * Inverse les lignes d'une écriture pour la contre-passer.
 *
 * La contre-passation ne modifie jamais l'écriture d'origine : elle en crée une nouvelle, datée du
 * jour de l'opération, qui référence l'originale. Un écrit comptabilisé est immuable — c'est ce
 * qui rend l'historique opposable.
 */
export function inverserEcriture(
  ecriture: Ecriture,
  options: { id: string; numero: string; date: DateCivile; piece: string }
): Ecriture {
  return {
    id: options.id,
    numero: options.numero,
    piece: options.piece,
    date: options.date,
    libelle: `Contre-passation de l'écriture ${ecriture.piece}`,
    etat: "brouillon",
    origine: ecriture.id,
    lignes: ecriture.lignes.map((ligne, index) => ({
      ...ligne,
      id: `${options.id}-L${index + 1}`,
      debit: ligne.credit,
      credit: ligne.debit,
      libelle: `Contre-passation : ${ligne.libelle}`
    }))
  };
}
