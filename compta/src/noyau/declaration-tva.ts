/**
 * Déclaration de TVA — un produit du grand livre et des codes de taxe, jamais une ressaisie.
 *
 * Le principe tient en une phrase : **la déclaration est recalculée à partir des bases taxées et
 * des taux du paquet pays, puis confrontée à ce que le grand livre contient réellement.** Les deux
 * doivent coïncider. Quand ils diffèrent — parce qu'une ligne de taxe a été saisie à la main, ou
 * parce qu'un code a été oublié sur une base — l'écart est affiché, compte par compte, au lieu
 * d'être noyé dans un total.
 *
 * Ce fichier ne contient ni formulaire officiel ni numéro de case : la mise en page du formulaire
 * béninois n'a pas été relevée dans le texte officiel, et l'inventer produirait un document qui a
 * l'air juste. La déclaration est donc présentée comme un **état de contrôle** : bases, taux,
 * taxes, crédit antérieur, net à payer, et le rapprochement avec la comptabilité. Chaque ligne
 * porte sa référence légale et son statut « à confirmer » quand le taux ne vient pas du texte
 * officiel.
 */

import { ZERO, additionner, comparer, oppose, type Montant } from "./montants";
import { periodeParNumero, type DateCivile, type Exercice } from "./calendrier";
import { comptePrincipalDe, type Mouvement } from "./grand-livre";
import { calculerTaxe, type CodeTaxe, type SensTaxe } from "./taxes";
import type { Compte } from "./comptes";
import type { ObligationDeclarative, PaquetPays } from "./pays/benin";

export type SensLigneDeclaration = "collectee" | "deductible" | "retenue" | "exoneree";

export interface LigneDeclarationTva {
  code: string;
  libelle: string;
  /** Compte de taxe du paquet pays où la taxe est comptabilisée. */
  compte: string;
  /** Somme des bases portant ce code dans la période. */
  base: Montant;
  /** Taxe recalculée : base × taux du code. */
  montant: Montant;
  sens: SensLigneDeclaration;
  pointsDeBase: bigint;
  referenceLegale: string;
  aVerifier: boolean;
}

/** Rapprochement, pour un compte de taxe, entre le recalcul et le grand livre. */
export interface ControleDeDeclaration {
  compte: string;
  libelle: string;
  /** Ce que les bases taxées et les taux produisent. */
  attendu: Montant;
  /** Ce que les mouvements de la période contiennent. */
  comptabilise: Montant;
  ecart: Montant;
}

export interface DeclarationTva {
  exercice: number;
  periode: number;
  periodeLabel: string;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  echeance: string;
  referenceLegale: string;
  lignes: LigneDeclarationTva[];
  baseCollectee: Montant;
  baseDeductible: Montant;
  baseExoneree: Montant;
  taxeCollectee: Montant;
  taxeDeductible: Montant;
  retenueDeTva: Montant;
  /** Solde débiteur des comptes de TVA déductible avant la période : il s'impute sur la taxe due. */
  creditAnterieur: Montant;
  /** Taxe à payer après imputation. Nulle quand un crédit reste à reporter. */
  netteAPayer: Montant;
  creditAReporter: Montant;
  controles: ControleDeDeclaration[];
  /** Vrai si au moins un contrôle présente un écart : la déclaration n'est pas fiable en l'état. */
  comporteUnEcart: boolean;
  mouvementsDeLaPeriode: number;
  aVerifier: boolean;
}

/**
 * Un code de taxe participe à la déclaration de TVA s'il porte sur un compte de TVA.
 *
 * Le test est structurel et non codé en dur : un code est une retenue de TVA s'il est une retenue
 * à la source dont le compte est aussi celui d'une taxe collectée. Les acomptes et retenues
 * d'impôt sur le résultat, eux, relèvent d'une autre déclaration et restent dehors.
 */
export function codesDeTva(codes: readonly CodeTaxe[]): CodeTaxe[] {
  const comptesCollectes = new Set(
    codes.filter((code) => code.sens === "collectee").map((code) => code.compteTaxe)
  );
  const comptesDeductibles = new Set(
    codes.filter((code) => code.sens === "deductible").map((code) => code.compteTaxe)
  );
  return codes.filter(
    (code) =>
      comptesCollectes.has(code.compteTaxe) ||
      comptesDeductibles.has(code.compteTaxe) ||
      (code.sens === "retenue-a-la-source" &&
        [...comptesCollectes, ...comptesDeductibles].some((compte) => compte === code.compteTaxe))
  );
}

function sensDe(sens: SensTaxe, pointsDeBase: bigint): SensLigneDeclaration {
  if (sens === "retenue-a-la-source") {
    return "retenue";
  }
  if (sens === "deductible") {
    return "deductible";
  }
  return pointsDeBase === ZERO ? "exoneree" : "collectee";
}

/** Somme des bases portant un code, dans la période : le côté non nul de chaque mouvement. */
function baseDe(code: string, mouvements: readonly Mouvement[]): Montant {
  return additionner(
    ...mouvements
      .filter((mouvement) => mouvement.codesTaxe.includes(code))
      .map((mouvement) => (mouvement.debit > ZERO ? mouvement.debit : mouvement.credit))
  );
}

/** Solde antérieur d'un compte, mouvements datés avant la période et solde initial compris. */
function soldeAnterieur(
  compte: string,
  mouvements: readonly Mouvement[],
  comptes: readonly Compte[],
  avant: DateCivile
): Montant {
  const initial = comptes.find((item) => item.numero === compte)?.soldeInitial ?? ZERO;
  const cumule = additionner(
    ...mouvements
      .filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte && mouvement.date < avant)
      .map((mouvement) => mouvement.debit - mouvement.credit)
  );
  return initial + cumule;
}

export function construireDeclarationTva(
  mouvements: readonly Mouvement[],
  comptes: readonly Compte[],
  paquet: PaquetPays,
  exercice: Exercice,
  periode: number
): DeclarationTva {
  const periodeDuCalendrier = periodeParNumero(exercice, periode);
  const duMois = mouvements.filter((mouvement) => mouvement.periode === periode);
  const codes = codesDeTva(paquet.codesTaxe);

  const lignes: LigneDeclarationTva[] = codes
    .map((code) => {
      const base = baseDe(code.code, duMois);
      const sens = sensDe(code.sens, code.pointsDeBase);
      return {
        code: code.code,
        libelle: code.libelle,
        compte: code.compteTaxe,
        base,
        montant: calculerTaxe(base, code).taxe,
        sens,
        pointsDeBase: code.pointsDeBase,
        referenceLegale: code.referenceLegale,
        aVerifier: code.aVerifier
      };
    })
    .filter((ligne) => ligne.base > ZERO || ligne.montant > ZERO);

  const taxeCollectee = additionner(
    ...lignes.filter((ligne) => ligne.sens === "collectee").map((ligne) => ligne.montant)
  );
  const taxeDeductible = additionner(
    ...lignes.filter((ligne) => ligne.sens === "deductible").map((ligne) => ligne.montant)
  );
  const retenueDeTva = additionner(
    ...lignes.filter((ligne) => ligne.sens === "retenue").map((ligne) => ligne.montant)
  );
  const baseCollectee = additionner(
    ...lignes.filter((ligne) => ligne.sens === "collectee").map((ligne) => ligne.base)
  );
  const baseDeductible = additionner(
    ...lignes.filter((ligne) => ligne.sens === "deductible").map((ligne) => ligne.base)
  );
  const baseExoneree = additionner(
    ...lignes.filter((ligne) => ligne.sens === "exoneree").map((ligne) => ligne.base)
  );

  // Le crédit antérieur est le solde débiteur des comptes de taxe déductible avant la période.
  const comptesDeductibles = [...new Set(codes.filter((code) => code.sens === "deductible").map((code) => code.compteTaxe))];
  const creditBrut = additionner(
    ...comptesDeductibles.map((compte) =>
      soldeAnterieur(compte, mouvements, comptes, periodeDuCalendrier.dateDebut)
    )
  );
  const creditAnterieur = creditBrut > ZERO ? creditBrut : ZERO;

  // La retenue de TVA n'est pas encaissée : elle est versée au Trésor par celui qui la retient.
  const solde = taxeCollectee - retenueDeTva - taxeDeductible - creditAnterieur;
  const netteAPayer = solde > ZERO ? solde : ZERO;
  const creditAReporter = solde < ZERO ? oppose(solde) : ZERO;

  /* ---------------------------------------------------------------- */
  /* Rapprochement avec le grand livre                                 */
  /* ---------------------------------------------------------------- */

  // Attendu par compte, signé : une taxe collectée est un crédit, une taxe déductible un débit,
  // une retenue de TVA vient en déduction du crédit du même compte — elle partage le compte de la
  // taxe collectée, et l'additionner fausserait le rapprochement.
  const attendus = new Map<string, { montant: Montant; deductible: boolean }>();
  for (const ligne of lignes) {
    const courant = attendus.get(ligne.compte) ?? { montant: ZERO, deductible: ligne.sens === "deductible" };
    const signe = ligne.sens === "retenue" ? oppose(ligne.montant) : ligne.montant;
    attendus.set(ligne.compte, {
      montant: courant.montant + signe,
      deductible: courant.deductible || ligne.sens === "deductible"
    });
  }

  // Un mouvement de la période sur un compte de TVA que les codes n'expliquent pas — une
  // régularisation saisie à la main, par exemple — doit apparaître comme un écart, pas disparaître.
  const comptesDeTva = new Set(codes.map((code) => code.compteTaxe));
  const comptesTouches = duMois
    .map((mouvement) => comptePrincipalDe(mouvement.compte))
    .filter((compte) => comptesDeTva.has(compte));
  const aControler = [...new Set([...attendus.keys(), ...comptesTouches])].sort();

  const controles: ControleDeDeclaration[] = aControler.map((compte) => {
    const attendu = attendus.get(compte);
    const deductible =
      attendu?.deductible ?? codes.some((code) => code.compteTaxe === compte && code.sens === "deductible");
    const comptabilise = additionner(
      ...duMois
        .filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte)
        .map((mouvement) => (deductible ? mouvement.debit - mouvement.credit : mouvement.credit - mouvement.debit))
    );
    return {
      compte,
      libelle: comptes.find((item) => item.numero === compte)?.libelle ?? `Compte de taxe ${compte}`,
      attendu: attendu?.montant ?? ZERO,
      comptabilise,
      ecart: (attendu?.montant ?? ZERO) - comptabilise
    };
  });

  const obligation = obligationDeTva(paquet.calendrierDeclaratif);

  return {
    exercice: exercice.annee,
    periode,
    periodeLabel: periodeDuCalendrier.libelle,
    dateDebut: periodeDuCalendrier.dateDebut,
    dateFin: periodeDuCalendrier.dateFin,
    echeance: obligation?.echeance ?? "échéance non documentée dans le paquet pays",
    referenceLegale: obligation?.referenceLegale ?? paquet.nom,
    lignes,
    baseCollectee,
    baseDeductible,
    baseExoneree,
    taxeCollectee,
    taxeDeductible,
    retenueDeTva,
    creditAnterieur,
    netteAPayer,
    creditAReporter,
    controles,
    comporteUnEcart: controles.some((controle) => comparer(controle.ecart, ZERO) !== 0),
    mouvementsDeLaPeriode: duMois.length,
    aVerifier: (obligation?.aVerifier ?? true) || lignes.some((ligne) => ligne.aVerifier)
  };
}

/**
 * L'obligation déclarative de TVA du paquet pays.
 *
 * Retrouvée par sa nature (mensuelle et portant sur la TVA) plutôt que par un code figé : un autre
 * paquet pays peut nommer son obligation autrement.
 */
export function obligationDeTva(
  calendrier: readonly ObligationDeclarative[]
): ObligationDeclarative | null {
  const mensuelle = calendrier.find(
    (obligation) =>
      obligation.periodicite === "mensuelle" && obligation.libelle.toLowerCase().includes("tva")
  );
  return mensuelle ?? calendrier.find((obligation) => obligation.libelle.toLowerCase().includes("tva")) ?? null;
}
