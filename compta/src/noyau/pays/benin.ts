/**
 * Paquet pays : Bénin (pilote).
 *
 * Le SYSCOHADA révisé est commun aux États de l'OHADA ; ce qui est béninois, ce sont la devise,
 * l'identifiant fiscal, les taux, les régimes et le calendrier déclaratif. Tout cela vit ici et
 * nulle part ailleurs : **aucun taux n'est codé dans le noyau**. Un autre pays de l'UEMOA sera un
 * autre paquet, pas une modification de celui-ci.
 *
 * Sources des paramètres (relevées le 15/10/2026, détaillées dans
 * `docs/specs/SPEC-MODELE-SAGE-BENIN.md` §4) : tableaux de la DGI Bénin (`api.impots.bj`) et
 * guides fiscaux croisés. Les lignes dont la source est un guide et non le texte du Code général
 * des impôts portent `aVerifier: true` et sont présentées comme telles à l'utilisateur.
 */

import type { Devise } from "../montants";
import { XOF } from "../montants";
import { SYSCOHADA_REVISE, type Referentiel } from "../referentiels/syscohada";
import type { CodeTaxe, ImpotAnnuel } from "../taxes";

export interface RegleIdentifiantFiscal {
  nom: string;
  nomLong: string;
  exemple: string;
  motif: RegExp;
  messageErreur: string;
  /** Le format officiel doit être confirmé par la DGI avant mise en production. */
  aVerifier: boolean;
}

export interface ObligationDeclarative {
  code: string;
  libelle: string;
  periodicite: "mensuelle" | "trimestrielle" | "annuelle" | "evenementielle";
  echeance: string;
  referenceLegale: string;
  aVerifier: boolean;
}

export interface FormeJuridique {
  code: string;
  libelle: string;
}

export interface PaquetPays {
  code: string;
  nom: string;
  version: string;
  devise: Devise;
  referentiel: Referentiel;
  regleIdentifiantFiscal: RegleIdentifiantFiscal;
  formesJuridiques: FormeJuridique[];
  codesTaxe: CodeTaxe[];
  impotsAnnuel: ImpotAnnuel[];
  calendrierDeclaratif: ObligationDeclarative[];
  /** Indique que des paramètres du paquet attendent une confirmation officielle. */
  comporteDesParametresAVerifier: boolean;
}

/** TVA : 18 % en régime intérieur, 0 % à l'exportation. */
const TVA_VENTE_18: CodeTaxe = {
  code: "TVA-V18",
  libelle: "TVA collectée 18 % (régime intérieur)",
  pointsDeBase: 1800n,
  base: "hors-taxe",
  sens: "collectee",
  compteTaxe: "443100",
  exigibleSur: "vente",
  condition: "interieur",
  referenceLegale: "CGI Bénin, art. 232 : 18 % en régime intérieur",
  aVerifier: false
};

const TVA_VENTE_0: CodeTaxe = {
  code: "TVA-V0",
  libelle: "Exportations et opérations assimilées (0 %)",
  pointsDeBase: 0n,
  base: "hors-taxe",
  sens: "collectee",
  compteTaxe: "443100",
  exigibleSur: "vente",
  condition: "exportation",
  referenceLegale: "CGI Bénin, art. 232 : taux 0 % à l'exportation",
  aVerifier: false
};

const TVA_ACHAT_18: CodeTaxe = {
  code: "TVA-A18",
  libelle: "TVA récupérable 18 % sur achats",
  pointsDeBase: 1800n,
  base: "hors-taxe",
  sens: "deductible",
  compteTaxe: "445200",
  exigibleSur: "achat",
  condition: "aucune",
  referenceLegale: "CGI Bénin : déduction de la TVA ayant grevé les achats",
  aVerifier: false
};

/**
 * Acomptes et retenues à la source (l'« AIRSI » dans l'usage des cabinets) :
 * 1 % sur les importations, achats commerciaux et fournitures par des personnes immatriculées à
 * l'IFU ; 1 % sur les fournitures de travaux, biens et services à l'État et aux collectivités ;
 * 3 % sur les prestations de services par des personnes immatriculées à l'IFU ; 5 % dans les
 * autres cas.
 */
const ACOMPTE_ACHAT_1: CodeTaxe = {
  code: "ACHT-1",
  libelle: "Acompte 1 % sur achats (tiers immatriculé à l'IFU)",
  pointsDeBase: 100n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "achat",
  condition: "tiers-immatricule",
  referenceLegale: "Acompte sur impôt assis sur les bénéfices — DGI Bénin, tableau des taux",
  aVerifier: true
};

const ACOMPTE_SERVICE_3: CodeTaxe = {
  code: "SRV-3",
  libelle: "Acompte 3 % sur prestations de services (tiers immatriculé à l'IFU)",
  pointsDeBase: 300n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "achat",
  condition: "tiers-immatricule",
  referenceLegale: "Acompte sur prestations de services — DGI Bénin, tableau des taux",
  aVerifier: true
};

const ACOMPTE_NON_IMMATRICULE_5: CodeTaxe = {
  code: "NONIFU-5",
  libelle: "Retenue 5 % (tiers non immatriculé à l'IFU)",
  pointsDeBase: 500n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "achat",
  condition: "tiers-non-immatricule",
  referenceLegale: "Autres cas d'acompte — DGI Bénin, tableau des taux",
  aVerifier: true
};

const RETENUE_MARCHE_PUBLIC_1: CodeTaxe = {
  code: "MP-1",
  libelle: "Retenue 1 % sur fournitures à l'État et aux collectivités",
  pointsDeBase: 100n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "vente",
  condition: "tiers-public",
  referenceLegale: "Fournitures de travaux, biens et services à l'État — DGI Bénin",
  aVerifier: true
};

/** Loi de finances 2026 : retenue de TVA sur les marchés publics supérieurs à 50 M FCFA. */
const RETENUE_TVA_MARCHE_PUBLIC: CodeTaxe = {
  code: "TVA-MP",
  libelle: "Retenue de TVA sur marchés publics > 50 000 000 FCFA",
  pointsDeBase: 1800n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "443100",
  exigibleSur: "vente",
  condition: "tiers-public",
  referenceLegale: "LF 2026, CGI art. 248 bis",
  aVerifier: true
};

const TAXE_SPORT: CodeTaxe = {
  code: "SPORT",
  libelle: "Taxe pour le développement du sport (1 ‰ du CA des grandes entreprises)",
  pointsDeBase: 10n,
  base: "hors-taxe",
  sens: "charge",
  compteTaxe: "641000",
  exigibleSur: "vente",
  condition: "aucune",
  referenceLegale: "CGI Bénin, art. 293-14 et 293-15",
  aVerifier: true
};

/** Cordon douanier : prélèvements communautaires et redevance statistique à l'importation. */
const PRELEVEMENT_COMMUNAUTAIRE: CodeTaxe = {
  code: "PC-UEMOA",
  libelle: "Prélèvement communautaire UEMOA (0,5 %)",
  pointsDeBase: 50n,
  base: "hors-taxe",
  sens: "charge",
  compteTaxe: "646000",
  exigibleSur: "achat",
  condition: "exportation",
  referenceLegale: "Prélèvement communautaire à l'importation",
  aVerifier: true
};

const PRELEVEMENT_SOLIDARITE: CodeTaxe = {
  code: "PCS-UEMOA",
  libelle: "Prélèvement communautaire de solidarité (0,8 %)",
  pointsDeBase: 80n,
  base: "hors-taxe",
  sens: "charge",
  compteTaxe: "646000",
  exigibleSur: "achat",
  condition: "exportation",
  referenceLegale: "Prélèvement communautaire de solidarité à l'importation",
  aVerifier: true
};

const REDEVANCE_STATISTIQUE: CodeTaxe = {
  code: "RS-IMPORT",
  libelle: "Redevance statistique à l'importation (1 %)",
  pointsDeBase: 100n,
  base: "hors-taxe",
  sens: "charge",
  compteTaxe: "646000",
  exigibleSur: "achat",
  condition: "exportation",
  referenceLegale: "Redevance statistique — DGI Bénin, tableau des taux",
  aVerifier: true
};

/** Retenues sur revenus de capitaux mobiliers. */
const RCM_DIVIDENDES: CodeTaxe = {
  code: "RCM-DIV",
  libelle: "Retenue sur dividendes (15 %)",
  pointsDeBase: 1500n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "vente",
  condition: "aucune",
  referenceLegale: "Retenues à la source sur revenus de capitaux mobiliers",
  aVerifier: true
};

const RCM_INTERETS: CodeTaxe = {
  code: "RCM-INT",
  libelle: "Retenue sur intérêts (15 %)",
  pointsDeBase: 1500n,
  base: "hors-taxe",
  sens: "retenue-a-la-source",
  compteTaxe: "442100",
  exigibleSur: "vente",
  condition: "aucune",
  referenceLegale: "Retenues à la source sur revenus de capitaux mobiliers",
  aVerifier: true
};

const CODES_TAXE_BENIN: CodeTaxe[] = [
  TVA_VENTE_18,
  TVA_VENTE_0,
  TVA_ACHAT_18,
  ACOMPTE_ACHAT_1,
  ACOMPTE_SERVICE_3,
  ACOMPTE_NON_IMMATRICULE_5,
  RETENUE_MARCHE_PUBLIC_1,
  RETENUE_TVA_MARCHE_PUBLIC,
  TAXE_SPORT,
  PRELEVEMENT_COMMUNAUTAIRE,
  PRELEVEMENT_SOLIDARITE,
  REDEVANCE_STATISTIQUE,
  RCM_DIVIDENDES,
  RCM_INTERETS
];

const IMPOTS_ANNUELS_BENIN: ImpotAnnuel[] = [
  {
    code: "IS",
    libelle: "Impôt sur les sociétés",
    assiette: "Bénéfice imposable de l'exercice",
    pointsDeBase: 3000n,
    montantPlancher: null,
    variantes: [
      { condition: "activité industrielle hors extractive", pointsDeBase: 2500n },
      { condition: "école privée d'enseignement", pointsDeBase: 2500n }
    ],
    compte: "891000",
    referenceLegale: "CGI Bénin : IS 30 %, 25 % pour l'industrie hors extractives et l'enseignement privé",
    aVerifier: true
  },
  {
    code: "MIN-PERCEPTION",
    libelle: "Minimum de perception",
    assiette: "Produits encaissables de l'exercice, TVA versée par les clients exclue",
    pointsDeBase: 100n,
    montantPlancher: 250_000n,
    variantes: [
      { condition: "bénéfices d'affaires (IBA)", pointsDeBase: 150n },
      { condition: "bâtiment et travaux publics", pointsDeBase: 300n },
      { condition: "prépondérance immobilière", pointsDeBase: 1000n }
    ],
    compte: "891000",
    referenceLegale: "Minimum de perception : 1 % IS (plancher 250 000 FCFA), 1,5 % IBA (plancher 500 000 FCFA), 3 % BTP, 10 % immobilier",
    aVerifier: true
  },
  {
    code: "TPS",
    libelle: "Taxe professionnelle synthétique (petites entreprises)",
    assiette: "Chiffre d'affaires annuel inférieur à 50 000 000 FCFA",
    pointsDeBase: null,
    montantPlancher: null,
    variantes: [{ condition: "régime du forfait, CA de 20 à 50 M FCFA", pointsDeBase: 200n }],
    compte: "641000",
    referenceLegale: "CGI Bénin, art. 1084-19 et 1084-31 : 2 % (minimum 150 000 FCFA)",
    aVerifier: true
  }
];

const CALENDRIER_BENIN: ObligationDeclarative[] = [
  {
    code: "TVA-MENSUELLE",
    libelle: "Déclaration et paiement de la TVA",
    periodicite: "mensuelle",
    echeance: "avant le 20 du mois suivant",
    referenceLegale: "CGI Bénin : TVA due = collectée − déductible",
    aVerifier: true
  },
  {
    code: "ACOMPTES-MENSUELS",
    libelle: "Reversement des acomptes et retenues à la source",
    periodicite: "mensuelle",
    echeance: "avant le 20 du mois suivant",
    referenceLegale: "Acompte sur impôt assis sur les bénéfices",
    aVerifier: true
  },
  {
    code: "SALAIRES-TRIMESTRIELLE",
    libelle: "Déclaration des salaires",
    periodicite: "trimestrielle",
    echeance: "dans le mois suivant le trimestre",
    referenceLegale: "Obligations déclaratives sur les salaires",
    aVerifier: true
  },
  {
    code: "RESULTATS-ANNUELLE",
    libelle: "Déclaration des résultats et liasse fiscale OHADA",
    periodicite: "annuelle",
    echeance: "dans les quatre mois de la clôture",
    referenceLegale: "Acte uniforme OHADA et CGI Bénin",
    aVerifier: true
  }
];

const FORMES_JURIDIQUES_BENIN: FormeJuridique[] = [
  { code: "SA", libelle: "Société anonyme" },
  { code: "SARL", libelle: "Société à responsabilité limitée" },
  { code: "SAS", libelle: "Société par actions simplifiée" },
  { code: "SNC", libelle: "Société en nom collectif" },
  { code: "SCS", libelle: "Société en commandite simple" },
  { code: "GIE", libelle: "Groupement d'intérêt économique" },
  { code: "EI", libelle: "Entreprise individuelle" }
];

export const REGLE_IFU_BENIN: RegleIdentifiantFiscal = {
  nom: "IFU",
  nomLong: "Identifiant Financier Unique",
  exemple: "0020151234567",
  // Le format usuel relevé est une suite de 13 chiffres. Tolérance à 12-13 chiffres tant que la
  // DGI n'a pas confirmé le format officiel : mieux vaut accepter un IFU réel que bloquer un
  // dossier sur une règle devinée.
  motif: /^\d{12,13}$/,
  messageErreur: "IFU invalide : 13 chiffres attendus (12 acceptés en attendant confirmation DGI).",
  aVerifier: true
};

export function validerIfu(valeur: string): string {
  const propre = valeur.replace(/[\s-]/g, "").toUpperCase();
  if (propre === "") {
    throw new Error("L'IFU est obligatoire : sans lui, aucune déclaration n'est déposée au Bénin.");
  }
  if (!REGLE_IFU_BENIN.motif.test(propre)) {
    throw new Error(REGLE_IFU_BENIN.messageErreur);
  }
  return propre;
}

export const BENIN: PaquetPays = {
  code: "BJ",
  nom: "Bénin",
  version: "v1 (pilote, 15/10/2026)",
  devise: XOF,
  referentiel: SYSCOHADA_REVISE,
  regleIdentifiantFiscal: REGLE_IFU_BENIN,
  formesJuridiques: FORMES_JURIDIQUES_BENIN,
  codesTaxe: CODES_TAXE_BENIN,
  impotsAnnuel: IMPOTS_ANNUELS_BENIN,
  calendrierDeclaratif: CALENDRIER_BENIN,
  comporteDesParametresAVerifier: true
};

/** Paramètres du paquet qui attendent une confirmation officielle : affichés comme tels. */
export function parametresAVerifier(paquet: PaquetPays): string[] {
  const libelles: string[] = [];
  if (paquet.regleIdentifiantFiscal.aVerifier) {
    libelles.push(`Format de l'${paquet.regleIdentifiantFiscal.nom}`);
  }
  for (const code of paquet.codesTaxe) {
    if (code.aVerifier) {
      libelles.push(`${code.libelle} (${code.code})`);
    }
  }
  for (const impot of paquet.impotsAnnuel) {
    if (impot.aVerifier) {
      libelles.push(`${impot.libelle} (${impot.code})`);
    }
  }
  return libelles;
}
