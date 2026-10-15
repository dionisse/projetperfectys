/**
 * Codes de taxe, à la manière de Sage *Tax Services*.
 *
 * Une ligne d'écriture porte un **code de taxe**, pas un montant de taxe saisi à la main : le
 * noyau calcule la taxe et génère les lignes correspondantes. C'est ce qui rend une déclaration
 * TVA fiable — si le montant de taxe est recopié par l'utilisateur, rien ne garantit qu'il
 * corresponde à la base.
 *
 * Les taux sont des **points de base** entiers (18 % = 1800, 1 % = 100, 1 ‰ = 10). Aucun taux ne
 * vit dans ce fichier : ils viennent du paquet pays.
 */

import { ErreurRegle, appliquerTaux, type Montant, ZERO, taxeSurTTC } from "./montants";

export type SensTaxe =
  /** Taxe collectée sur une vente : due à l'État. */
  | "collectee"
  /** Taxe récupérable sur un achat : créance sur l'État. */
  | "deductible"
  /** Retenue opérée à la source pour le compte de l'État. */
  | "retenue-a-la-source"
  /** Taxe à la charge de l'entreprise, sans collecte pour un tiers. */
  | "charge";

export type BaseTaxe = "hors-taxe" | "toutes-taxes-comprises";

/** Condition d'application liée au tiers : c'est elle qui distingue 1 % et 5 % au Bénin. */
export type ConditionTaxe =
  | "aucune"
  /** Régime intérieur : ne s'applique pas aux exportations, qui relèvent du taux 0 %. */
  | "interieur"
  | "tiers-immatricule"
  | "tiers-non-immatricule"
  | "tiers-public"
  | "exportation";

export interface CodeTaxe {
  code: string;
  libelle: string;
  /** Taux en points de base. */
  pointsDeBase: bigint;
  base: BaseTaxe;
  sens: SensTaxe;
  /** Compte du plan qui enregistre la taxe (443100, 445200, 442100…). */
  compteTaxe: string;
  /** Opération concernée : les codes de taxe sont orientés achat ou vente, jamais les deux. */
  exigibleSur: "achat" | "vente";
  condition: ConditionTaxe;
  /** Référence légale : un taux sans article n'est pas défendable. */
  referenceLegale: string;
  /**
   * Le paramètre est relevé dans une source publiée mais pas confirmé dans le texte officiel :
   * il est affiché comme tel à l'utilisateur, jamais présenté comme certain.
   */
  aVerifier: boolean;
}

export interface CalculTaxe {
  code: string;
  base: Montant;
  taxe: Montant;
  /** Base + taxe quand le code porte un montant hors taxe. */
  total: Montant;
}

/**
 * Calcule la taxe d'un montant selon le code.
 *
 * - base **hors taxe** : `taxe = montant × taux` ;
 * - base **toutes taxes comprises** : `taxe = montant × taux / (10000 + taux)`.
 *
 * L'arrondi est au franc le plus proche, parce que le franc CFA n'a pas de subdivision.
 */
export function calculerTaxe(montant: Montant, code: CodeTaxe): CalculTaxe {
  if (montant === ZERO) {
    return { code: code.code, base: ZERO, taxe: ZERO, total: ZERO };
  }
  if (code.base === "toutes-taxes-comprises") {
    // Le montant saisi inclut déjà la taxe : on en extrait la part, et base + taxe = montant saisi.
    const taxe = taxeSurTTC(montant, code.pointsDeBase);
    const base = montant - taxe;
    return { code: code.code, base, taxe, total: montant };
  }
  const taxe = appliquerTaux(montant, code.pointsDeBase);
  return { code: code.code, base: montant, taxe, total: montant + taxe };
}

/** Le code de taxe est-il applicable à cette opération, compte tenu du tiers ? */
export function codeTaxeApplicable(
  code: CodeTaxe,
  contexte: { operation: "achat" | "vente"; tiersImmatricule: boolean; tiersPublic: boolean; exportation: boolean }
): boolean {
  if (code.exigibleSur !== contexte.operation) {
    return false;
  }
  switch (code.condition) {
    case "aucune":
      return true;
    case "interieur":
      return !contexte.exportation;
    case "tiers-immatricule":
      return contexte.tiersImmatricule && !contexte.exportation;
    case "tiers-non-immatricule":
      return !contexte.tiersImmatricule && !contexte.exportation;
    case "tiers-public":
      return contexte.tiersPublic;
    case "exportation":
      return contexte.exportation;
    default:
      return false;
  }
}

/**
 * Codes applicables à une opération, dans l'ordre du paquet pays. Plusieurs peuvent s'appliquer
 * (TVA et acompte sur un achat, par exemple) : c'est à l'utilisateur de retenir, mais le noyau
 * propose la liste complète plutôt que de choisir seul.
 */
export function codesTaxeApplicables(
  codes: readonly CodeTaxe[],
  contexte: { operation: "achat" | "vente"; tiersImmatricule: boolean; tiersPublic: boolean; exportation: boolean }
): CodeTaxe[] {
  return codes.filter((code) => codeTaxeApplicable(code, contexte));
}

/** Impôt assis sur un exercice, non pas sur une écriture : IS, minimum de perception, TPS. */
export interface ImpotAnnuel {
  code: string;
  libelle: string;
  /** Assiette et régime d'application. */
  assiette: string;
  pointsDeBase: bigint | null;
  /** Montant plancher en unités mineures, quand la loi en prévoit un. */
  montantPlancher: Montant | null;
  /** Taux alternatifs selon la nature de l'activité ou le régime. */
  variantes: { condition: string; pointsDeBase: bigint }[];
  compte: string;
  referenceLegale: string;
  aVerifier: boolean;
}

export function calculerImpotAnnuel(
  impot: ImpotAnnuel,
  assiette: Montant,
  variante?: string
): { assiette: Montant; montant: Montant; detail: string } {
  const taux = variante
    ? impot.variantes.find((item) => item.condition === variante)?.pointsDeBase ?? null
    : impot.pointsDeBase;
  if (taux === null || taux === undefined) {
    throw new ErreurRegle(
      `L'impôt ${impot.code} n'a pas de taux applicable${variante ? ` pour « ${variante} »` : ""}.`
    );
  }
  const brut = appliquerTaux(assiette, taux);
  const plancher = impot.montantPlancher ?? ZERO;
  const retenu = brut < plancher ? plancher : brut;
  return {
    assiette,
    montant: retenu,
    detail:
      retenu === plancher && plancher > ZERO
        ? `Minimum de perception appliqué : ${plancher} au lieu de ${brut}.`
        : `Taux de ${taux / 100n} % appliqué à l'assiette.`
  };
}

/* ------------------------------------------------------------------ */
/* Contrôle des lignes taxées                                           */
/* ------------------------------------------------------------------ */

import type { LigneEcriture } from "./lots";

export interface LigneTaxeAttendue {
  compteTaxe: string;
  sens: "debit" | "credit";
  montant: Montant;
  codeTaxe: string;
}

/**
 * Ligne de taxe qu'une écriture doit comporter quand une ligne porte un code de taxe.
 *
 * Le sens dépend de la **nature** de la taxe, pas seulement de celui de la ligne taxée :
 * - une TVA **collectée** sur une vente créditée est créditée au compte de TVA ;
 * - une TVA **déductible** sur un achat débité est débitée au compte de TVA ;
 * - une **retenue à la source** va en sens inverse : elle diminue ce qui est dû au tiers et crée
 *   une dette envers l'État, donc un achat débité donne une retenue **créditée**.
 *
 * Une taxe de nature `charge` (taxe sport, prélèvements communautaires) ne produit pas de ligne
 * dans la même écriture : elle est constatée par une écriture propre, le plus souvent en fin de
 * période. Le contrôle ne porte donc pas sur elle.
 */
export function ligneTaxeAttendue(
  ligne: { debit: Montant; credit: Montant },
  code: CodeTaxe
): LigneTaxeAttendue {
  const sensLigne: "debit" | "credit" = ligne.debit > ZERO ? "debit" : "credit";
  const base = sensLigne === "debit" ? ligne.debit : ligne.credit;
  const sens = code.sens === "retenue-a-la-source" ? (sensLigne === "debit" ? "credit" : "debit") : sensLigne;
  const calcule = calculerTaxe(base, code);
  return { compteTaxe: code.compteTaxe, sens, montant: calcule.taxe, codeTaxe: code.code };
}

/**
 * Un taux en points de base, lisible : 1800 → « 18 % », 10 → « 0,10 % », 0 → « 0 % ».
 *
 * Le calcul reste entier : un taux affiché n'est pas converti en flottant, comme le reste du
 * noyau. Les points de base sont l'unité de stockage, le pourcentage n'est qu'une lecture.
 */
export function formaterTaux(pointsDeBase: bigint): string {
  const negatif = pointsDeBase < ZERO;
  const absolu = negatif ? -pointsDeBase : pointsDeBase;
  const entiers = absolu / 100n;
  const reste = absolu % 100n;
  const texte = reste === ZERO ? entiers.toString() : `${entiers.toString()},${reste.toString().padStart(2, "0")}`;
  return `${negatif ? "-" : ""}${texte} %`;
}

/** Ligne de taxe que l'écran de saisie propose à l'utilisateur, avant qu'il ne la valide. */
export interface LigneDeTaxeProposee {
  compte: string;
  libelle: string;
  debit: Montant;
  credit: Montant;
  codeTaxe: string;
  sens: "debit" | "credit";
}

/**
 * Calcule les lignes de taxe qu'une ligne taxée appelle, pour que l'écran de saisie les propose.
 *
 * Le noyau ne les insère jamais en silence : elles sont renvoyées ici, affichées dans la grille,
 * et l'utilisateur les enregistre comme les autres lignes. Le calcul, lui, ne lui appartient pas —
 * un montant de taxe recopié à la main ne garantit rien face à la base.
 *
 * Une taxe de nature `charge` (la taxe sur le sport, par exemple) ne produit **aucune** ligne dans
 * la même écriture : elle est constatée par une écriture propre, le plus souvent périodique.
 */
export function proposerLignesDeTaxe(
  ligne: {
    compte: string;
    libelle: string;
    debit: Montant;
    credit: Montant;
    codesTaxe: readonly string[];
  },
  codes: readonly CodeTaxe[]
): LigneDeTaxeProposee[] {
  const parCode = new Map(codes.map((code) => [code.code, code] as const));
  const proposees: LigneDeTaxeProposee[] = [];
  for (const codeDemande of ligne.codesTaxe) {
    const code = parCode.get(codeDemande);
    if (!code) {
      throw new ErreurRegle(`Le code de taxe « ${codeDemande} » n'existe pas dans le paquet pays.`);
    }
    if (code.sens === "charge") {
      continue;
    }
    const attendue = ligneTaxeAttendue(ligne, code);
    if (attendue.montant === ZERO) {
      continue;
    }
    proposees.push({
      compte: attendue.compteTaxe,
      libelle: `${code.libelle} — ${ligne.libelle}`,
      debit: attendue.sens === "debit" ? attendue.montant : ZERO,
      credit: attendue.sens === "credit" ? attendue.montant : ZERO,
      codeTaxe: code.code,
      sens: attendue.sens
    });
  }
  return proposees;
}

/**
 * Vérifie qu'une écriture taxée porte bien ses lignes de taxe, sur le bon compte, dans le bon
 * sens et pour le bon montant.
 *
 * Le noyau ne génère pas de ligne en silence : une écriture dont la taxe serait ajoutée par la
 * machine sans apparaître dans la saisie ne serait plus contrôlable par l'utilisateur. En
 * revanche, une ligne taxée **sans** sa ligne de taxe est refusée.
 */
export function verifierLignesTaxees(lignes: readonly LigneEcriture[], codes: readonly CodeTaxe[]): void {
  const parCode = new Map(codes.map((code) => [code.code, code] as const));
  for (const ligne of lignes) {
    for (const codeDemande of ligne.codesTaxe) {
      const code = parCode.get(codeDemande);
      if (!code) {
        throw new ErreurRegle(`Le code de taxe « ${codeDemande} » n'existe pas dans le paquet pays.`);
      }
      if (code.sens === "charge") {
        // Constatée par une écriture propre : pas de ligne attendue ici.
        continue;
      }
      const attendue = ligneTaxeAttendue(ligne, code);
      if (attendue.montant === ZERO) {
        continue;
      }
      const trouvee = lignes.find(
        (autre) =>
          autre.compte.trim().toUpperCase().startsWith(attendue.compteTaxe) &&
          autre.codesTaxe.length === 0 &&
          (attendue.sens === "debit" ? autre.debit : autre.credit) === attendue.montant
      );
      if (!trouvee) {
        throw new ErreurRegle(
          `La ligne ${ligne.compte} porte le code de taxe ${code.code} : l'écriture doit comporter une ligne ` +
            `${attendue.sens === "debit" ? "débit" : "crédit"} de ${attendue.montant} sur le compte ${attendue.compteTaxe}.`
        );
      }
    }
  }
}
