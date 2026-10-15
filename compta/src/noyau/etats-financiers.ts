/**
 * États financiers — la présentation OHADA révisé, produite depuis la balance.
 *
 * Le principe est le même que pour la déclaration de TVA : **la présentation est une donnée, pas
 * du code.** Les rubriques du bilan et du compte de résultat sont décrites dans des tableaux
 * (`MODELE_BILAN_ACTIF`, `MODELE_BILAN_PASSIF`, `MODELE_COMPTE_RESULTAT`) : chaque rubrique nomme
 * les groupes de comptes qu'elle agrège, son sens de présentation, et pour un total les lignes
 * qu'elle somme. Un autre référentiel, ou une autre présentation nationale, est un autre modèle —
 * pas une réécriture du moteur.
 *
 * Deux contrôles accompagnent chaque état, parce qu'un état financier non contrôlé est un décor :
 *
 *  - au **bilan**, le total de l'actif doit égaler celui du passif, résultat de l'exercice compris
 *    dans les capitaux propres. Un écart est affiché, pas absorbé ;
 *  - au **compte de résultat**, le résultat net présenté doit égaler la somme algébrique des
 *    comptes de gestion de la balance, et l'écran dit qu'il ne sera porté au compte de résultat de
 *    l'exercice (121000) qu'à la clôture.
 *
 * Limite assumée : la mise en page de l'imprimé officiel n'a pas été relevée dans le texte de
 * l'Acte uniforme. Les rubriques ci-dessous suivent la logique du modèle révisé (actif immobilisé,
 * actif circulant, trésorerie-actif ; capitaux propres, dettes stables, passif circulant,
 * trésorerie-passif ; résultat d'exploitation, financier, HAO, avant impôts, net) et sont
 * signalées comme à vérifier avant tout dépôt légal.
 */

import { ZERO, additionner, oppose, type Montant } from "./montants";
import type { DateCivile } from "./calendrier";
import type { GroupeDeComptes } from "./comptes";
import type { LigneBalance } from "./grand-livre";

/** Sens de présentation d'une rubrique : décide si un solde débiteur est affiché positif. */
export type SensPresentation =
  /** Solde débiteur présenté positif : actif, charges. */
  | "actif"
  /** Solde créditeur présenté positif : passif, produits. */
  | "passif"
  /** Déduction de l'actif brut : amortissements et dépréciations. */
  | "amortissement";

export type NiveauRubrique = "detail" | "total" | "resultat";

export interface Rubrique {
  code: string;
  libelle: string;
  niveau: NiveauRubrique;
  /** Groupes de comptes agrégés. Vide pour un total ou un résultat. */
  groupes: string[];
  sens: SensPresentation;
  /** Pour un total : les codes de rubriques à sommer. */
  totalDe?: string[];
  /** Pour un résultat : les rubriques ajoutées et celles retranchées. */
  expression?: { positif: string[]; negatif: string[] };
  /** Une rubrique vide (aucun compte du plan ne l'alimente) reste affichée, à zéro. */
  facultative?: boolean;
}

export interface DetailCompte {
  numero: string;
  libelle: string;
  groupe: string;
  solde: Montant;
  presente: Montant;
}

export interface LigneEtat {
  code: string;
  libelle: string;
  niveau: NiveauRubrique;
  brut: Montant;
  amortissements: Montant;
  net: Montant;
  comptes: DetailCompte[];
}

export interface Bilan {
  exercice: number;
  dateCloture: DateCivile;
  actif: LigneEtat[];
  passif: LigneEtat[];
  totalActifBrut: Montant;
  totalActifAmortissements: Montant;
  totalActifNet: Montant;
  totalPassif: Montant;
  /** Résultat de l'exercice, porté dans les capitaux propres du passif. */
  resultatExercice: Montant;
  /** Total actif net − total passif : nul si la comptabilité est cohérente. */
  ecart: Montant;
  /**
   * Groupes du référentiel qu'aucun solde n'alimente dans cet état.
   *
   * Une rubrique vide n'est pas une erreur : un plan de démarrage peut ne pas encore porter de
   * compte d'amortissement. Mais un état qui affiche zéro sans dire pourquoi serait trompeur.
   */
  groupesSansSolde: string[];
  /** Comptes dont le groupe ne participe à aucun état (engagements hors bilan). */
  comptesHorsEtat: DetailCompte[];
  /** Colonne N-1, présente seulement si un exercice est clos dans le dossier. */
  precedent: ColonnePrecedente | null;
  aVerifier: boolean;
}

export interface CompteDeResultat {
  exercice: number;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  lignes: LigneEtat[];
  resultatExploitation: Montant;
  resultatFinancier: Montant;
  resultatActivitesOrdinaires: Montant;
  resultatHorsActivitesOrdinaires: Montant;
  resultatAvantImpots: Montant;
  impotsSurLesResultats: Montant;
  resultatNet: Montant;
  /** Somme algébrique des comptes de gestion dans la balance : doit égaler le résultat net. */
  controle: { attendu: Montant; presente: Montant; ecart: Montant };
  aVerifier: boolean;
}

/** Actif du bilan, dans l'ordre du modèle OHADA révisé. */
export const MODELE_BILAN_ACTIF: Rubrique[] = [
  {
    code: "IMMO-INC",
    libelle: "Immobilisations incorporelles",
    niveau: "detail",
    groupes: ["IMMO-INC"],
    sens: "actif"
  },
  {
    code: "IMMO-COR",
    libelle: "Immobilisations corporelles",
    niveau: "detail",
    groupes: ["IMMO-COR"],
    sens: "actif"
  },
  {
    code: "IMMO-FIN",
    libelle: "Immobilisations financières",
    niveau: "detail",
    groupes: ["IMMO-FIN"],
    sens: "actif"
  },
  {
    code: "IMMO-AM",
    libelle: "Amortissements et dépréciations des immobilisations",
    niveau: "detail",
    groupes: ["IMMO-AM"],
    sens: "amortissement"
  },
  {
    code: "TOTAL-IMMO",
    libelle: "Total actif immobilisé",
    niveau: "total",
    groupes: [],
    sens: "actif",
    totalDe: ["IMMO-INC", "IMMO-COR", "IMMO-FIN", "IMMO-AM"]
  },
  {
    code: "STOCK",
    libelle: "Stocks et en-cours",
    niveau: "detail",
    groupes: ["STOCK"],
    sens: "actif"
  },
  {
    code: "CREANCE",
    libelle: "Créances et emplois assimilés",
    niveau: "detail",
    groupes: ["CREANCE"],
    sens: "actif"
  },
  {
    code: "TOTAL-CIRC",
    libelle: "Total actif circulant",
    niveau: "total",
    groupes: [],
    sens: "actif",
    totalDe: ["STOCK", "CREANCE"]
  },
  {
    code: "TRES-ACT",
    libelle: "Trésorerie-actif (banque, caisse, placements)",
    niveau: "detail",
    groupes: ["TRES-ACT"],
    sens: "actif"
  },
  {
    code: "TOTAL-TRES-ACT",
    libelle: "Total trésorerie-actif",
    niveau: "total",
    groupes: [],
    sens: "actif",
    totalDe: ["TRES-ACT"]
  },
  {
    code: "TOTAL-ACTIF",
    libelle: "Total général de l'actif",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    totalDe: ["TOTAL-IMMO", "TOTAL-CIRC", "TOTAL-TRES-ACT"]
  }
];

/** Passif du bilan. Les trois colonnes brut/amortissements/net y sont laissées à zéro. */
export const MODELE_BILAN_PASSIF: Rubrique[] = [
  {
    code: "CAP",
    libelle: "Capitaux propres (capital, report à nouveau, subventions)",
    niveau: "detail",
    groupes: ["CAP"],
    sens: "passif"
  },
  {
    code: "RESULTAT",
    libelle: "Résultat de l'exercice",
    niveau: "detail",
    // Les dix groupes de gestion tant que l'exercice est ouvert, plus le compte 121000 une fois
    // clos : la ligne présente le résultat dans les deux cas, sans changer de place au passif.
    groupes: [
      "CHG-EXP",
      "CHG-PERS",
      "CHG-IMP",
      "CHG-FIN",
      "CHG-DOT",
      "CHG-HAO",
      "PRD-EXP",
      "PRD-FIN",
      "PRD-HAO",
      "IS",
      "RESULTAT-CLOS"
    ],
    sens: "passif"
  },
  {
    code: "TOTAL-CAP",
    libelle: "Total capitaux propres et ressources assimilées",
    niveau: "total",
    groupes: [],
    sens: "passif",
    totalDe: ["CAP", "RESULTAT"]
  },
  {
    code: "DET-ST",
    libelle: "Dettes stables (emprunts, provisions pour risques)",
    niveau: "detail",
    groupes: ["DET-ST"],
    sens: "passif"
  },
  {
    code: "TOTAL-DET-ST",
    libelle: "Total dettes stables",
    niveau: "total",
    groupes: [],
    sens: "passif",
    totalDe: ["DET-ST"]
  },
  {
    code: "DETTE-CIRC",
    libelle: "Passif circulant (fournisseurs, État, personnel, autres dettes)",
    niveau: "detail",
    groupes: ["DETTE-CIRC"],
    sens: "passif"
  },
  {
    code: "TOTAL-DETTE-CIRC",
    libelle: "Total passif circulant",
    niveau: "total",
    groupes: [],
    sens: "passif",
    totalDe: ["DETTE-CIRC"]
  },
  {
    code: "TRES-PAS",
    libelle: "Trésorerie-passif (banques créditeurs, concours à court terme)",
    niveau: "detail",
    groupes: ["TRES-PAS"],
    sens: "passif"
  },
  {
    code: "TOTAL-TRES-PAS",
    libelle: "Total trésorerie-passif",
    niveau: "total",
    groupes: [],
    sens: "passif",
    totalDe: ["TRES-PAS"]
  },
  {
    code: "TOTAL-PASSIF",
    libelle: "Total général du passif",
    niveau: "resultat",
    groupes: [],
    sens: "passif",
    totalDe: ["TOTAL-CAP", "TOTAL-DET-ST", "TOTAL-DETTE-CIRC", "TOTAL-TRES-PAS"]
  }
];

/** Compte de résultat, dans l'ordre du modèle OHADA révisé. */
export const MODELE_COMPTE_RESULTAT: Rubrique[] = [
  {
    code: "PRD-EXP",
    libelle: "Produits d'exploitation",
    niveau: "detail",
    groupes: ["PRD-EXP"],
    sens: "passif"
  },
  {
    code: "CHG-EXP",
    libelle: "Achats, ventes et services extérieurs",
    niveau: "detail",
    groupes: ["CHG-EXP"],
    sens: "actif"
  },
  {
    code: "CHG-IMP",
    libelle: "Impôts et taxes",
    niveau: "detail",
    groupes: ["CHG-IMP"],
    sens: "actif"
  },
  {
    code: "CHG-PERS",
    libelle: "Charges de personnel",
    niveau: "detail",
    groupes: ["CHG-PERS"],
    sens: "actif"
  },
  {
    code: "CHG-DOT",
    libelle: "Dotations aux amortissements et aux provisions",
    niveau: "detail",
    groupes: ["CHG-DOT"],
    sens: "actif"
  },
  {
    code: "RESULTAT-EXP",
    libelle: "1. Résultat d'exploitation",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: {
      positif: ["PRD-EXP"],
      negatif: ["CHG-EXP", "CHG-IMP", "CHG-PERS", "CHG-DOT"]
    }
  },
  {
    code: "PRD-FIN",
    libelle: "Produits financiers",
    niveau: "detail",
    groupes: ["PRD-FIN"],
    sens: "passif"
  },
  {
    code: "CHG-FIN",
    libelle: "Charges financières",
    niveau: "detail",
    groupes: ["CHG-FIN"],
    sens: "actif"
  },
  {
    code: "RESULTAT-FIN",
    libelle: "2. Résultat financier",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: { positif: ["PRD-FIN"], negatif: ["CHG-FIN"] }
  },
  {
    code: "RESULTAT-AO",
    libelle: "3. Résultat des activités ordinaires",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: { positif: ["RESULTAT-EXP", "RESULTAT-FIN"], negatif: [] }
  },
  {
    code: "PRD-HAO",
    libelle: "Produits hors activités ordinaires",
    niveau: "detail",
    groupes: ["PRD-HAO"],
    sens: "passif"
  },
  {
    code: "CHG-HAO",
    libelle: "Charges hors activités ordinaires",
    niveau: "detail",
    groupes: ["CHG-HAO"],
    sens: "actif"
  },
  {
    code: "RESULTAT-HAO",
    libelle: "4. Résultat hors activités ordinaires",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: { positif: ["PRD-HAO"], negatif: ["CHG-HAO"] }
  },
  {
    code: "RESULTAT-AI",
    libelle: "5. Résultat avant impôts",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: { positif: ["RESULTAT-AO", "RESULTAT-HAO"], negatif: [] }
  },
  {
    code: "IS",
    libelle: "Impôts sur les résultats",
    niveau: "detail",
    groupes: ["IS"],
    sens: "actif"
  },
  {
    code: "RESULTAT-NET",
    libelle: "6. Résultat net",
    niveau: "resultat",
    groupes: [],
    sens: "actif",
    expression: { positif: ["RESULTAT-AI"], negatif: ["IS"] }
  }
];

/** Somme des soldes d'un ensemble de groupes, présentée selon le sens retenu. */
function soldeDe(
  balance: readonly LigneBalance[],
  groupes: readonly string[],
  sens: SensPresentation
): Montant {
  if (groupes.length === 0) {
    return ZERO;
  }
  const retenu = new Set(groupes);
  return additionner(
    ...balance
      .filter((ligne) => retenu.has(ligne.groupe))
      .map((ligne) => (sens === "actif" ? ligne.solde : oppose(ligne.solde)))
  );
}

function comptesDe(balance: readonly LigneBalance[], groupes: readonly string[], sens: SensPresentation): DetailCompte[] {
  const retenu = new Set(groupes);
  return balance
    .filter((ligne) => retenu.has(ligne.groupe) && ligne.solde !== ZERO)
    .map((ligne) => ({
      numero: ligne.compte,
      libelle: ligne.libelle,
      groupe: ligne.groupe,
      solde: ligne.solde,
      presente: sens === "actif" ? ligne.solde : oppose(ligne.solde)
    }));
}

/**
 * Évalue un modèle de rubrique par rubrique.
 *
 * Une rubrique peut sommer des rubriques déjà évaluées (`totalDe`) ou en combiner
 * (`expression`) : l'ordre du modèle est donc significatif, et le moteur reste un simple pli.
 */
function evaluerModele(
  modele: readonly Rubrique[],
  balance: readonly LigneBalance[]
): { lignes: LigneEtat[]; valeurs: Map<string, { brut: Montant; amortissements: Montant; net: Montant }> } {
  const valeurs = new Map<string, { brut: Montant; amortissements: Montant; net: Montant }>();
  const lignes: LigneEtat[] = [];

  for (const rubrique of modele) {
    let brut = ZERO;
    let amortissements = ZERO;
    let net = ZERO;
    let comptes: DetailCompte[] = [];

    if (rubrique.groupes.length > 0) {
      const solde = soldeDe(balance, rubrique.groupes, rubrique.sens);
      comptes = comptesDe(balance, rubrique.groupes, rubrique.sens);
      if (rubrique.sens === "amortissement") {
        // `soldeDe` présente déjà un solde créditeur en positif : l'amortissement est la valeur à
        // déduire du brut, il ne doit pas être inversé une seconde fois.
        amortissements = solde;
      } else {
        brut = solde;
      }
      net = brut - amortissements;
    } else if (rubrique.totalDe) {
      for (const code of rubrique.totalDe) {
        const precedent = valeurs.get(code) ?? { brut: ZERO, amortissements: ZERO, net: ZERO };
        brut += precedent.brut;
        amortissements += precedent.amortissements;
        net += precedent.net;
      }
    } else if (rubrique.expression) {
      for (const code of rubrique.expression.positif) {
        net += valeurs.get(code)?.net ?? ZERO;
      }
      for (const code of rubrique.expression.negatif) {
        net -= valeurs.get(code)?.net ?? ZERO;
      }
      brut = net;
    }

    valeurs.set(rubrique.code, { brut, amortissements, net });
    lignes.push({
      code: rubrique.code,
      libelle: rubrique.libelle,
      niveau: rubrique.niveau,
      brut,
      amortissements,
      net,
      comptes
    });
  }

  return { lignes, valeurs };
}

/**
 * Colonne « exercice précédent » d'un bilan.
 *
 * Elle n'existe que si un exercice est clos dans le dossier : un N-1 inventé, ou repris d'un
 * exercice jamais clôturé, serait une fausse comparaison.
 */
export interface ColonnePrecedente {
  exercice: number;
  dateCloture: DateCivile;
  actif: LigneEtat[];
  passif: LigneEtat[];
  totalActifNet: Montant;
  totalPassif: Montant;
  resultatExercice: Montant;
}

/** Balance de l'exercice précédent, déjà bornée à sa clôture. */
export interface ExercicePrecedent {
  exercice: number;
  dateCloture: DateCivile;
  balance: readonly LigneBalance[];
}

export function construireBilan(
  balance: readonly LigneBalance[],
  groupes: readonly GroupeDeComptes[],
  options: { exercice: number; dateCloture: DateCivile; precedent: ExercicePrecedent | null }
): Bilan {
  const actif = evaluerModele(MODELE_BILAN_ACTIF, balance);
  const passif = evaluerModele(MODELE_BILAN_PASSIF, balance);

  const totalActif = actif.valeurs.get("TOTAL-ACTIF")!;
  const totalPassif = passif.valeurs.get("TOTAL-PASSIF")!;
  const resultat = passif.valeurs.get("RESULTAT")!.net;

  const groupesUtilises = new Set([
    ...MODELE_BILAN_ACTIF.flatMap((rubrique) => rubrique.groupes),
    ...MODELE_BILAN_PASSIF.flatMap((rubrique) => rubrique.groupes)
  ]);
  const groupesDuBilan = new Set(
    groupes.filter((groupe) => groupe.etat === "bilan" || groupe.etat === "resultat").map((groupe) => groupe.code)
  );

  return {
    exercice: options.exercice,
    dateCloture: options.dateCloture,
    actif: actif.lignes,
    passif: passif.lignes,
    totalActifBrut: totalActif.brut,
    totalActifAmortissements: totalActif.amortissements,
    totalActifNet: totalActif.net,
    totalPassif: totalPassif.net,
    resultatExercice: resultat,
    ecart: totalActif.net - totalPassif.net,
    groupesSansSolde: [...groupesDuBilan].filter((code) => !balance.some((ligne) => ligne.groupe === code)),
    comptesHorsEtat: balance
      .filter((ligne) => ligne.solde !== ZERO && !groupesUtilises.has(ligne.groupe))
      .map((ligne) => ({
        numero: ligne.compte,
        libelle: ligne.libelle,
        groupe: ligne.groupe,
        solde: ligne.solde,
        presente: ligne.solde
      })),
    precedent: construireColonnePrecedente(options.precedent),
    // La mise en page de l'imprimé officiel n'a pas été relevée dans l'Acte uniforme.
    aVerifier: true
  };
}

/**
 * Évalue le même modèle sur la balance de l'exercice précédent.
 *
 * Un seul modèle, deux colonnes : si la colonne N-1 différait de la colonne N par sa composition, la
 * comparaison n'aurait aucun sens.
 */
function construireColonnePrecedente(precedent: ExercicePrecedent | null): ColonnePrecedente | null {
  if (precedent === null) {
    return null;
  }
  const actif = evaluerModele(MODELE_BILAN_ACTIF, precedent.balance);
  const passif = evaluerModele(MODELE_BILAN_PASSIF, precedent.balance);
  return {
    exercice: precedent.exercice,
    dateCloture: precedent.dateCloture,
    actif: actif.lignes,
    passif: passif.lignes,
    totalActifNet: actif.valeurs.get("TOTAL-ACTIF")!.net,
    totalPassif: passif.valeurs.get("TOTAL-PASSIF")!.net,
    resultatExercice: passif.valeurs.get("RESULTAT")!.net
  };
}

export function construireCompteDeResultat(
  balance: readonly LigneBalance[],
  options: { exercice: number; dateDebut: DateCivile; dateFin: DateCivile }
): CompteDeResultat {
  const evalue = evaluerModele(MODELE_COMPTE_RESULTAT, balance);
  const valeur = (code: string): Montant => evalue.valeurs.get(code)?.net ?? ZERO;

  const resultatNet = valeur("RESULTAT-NET");
  // Contrôle : le résultat présenté doit égaler la somme algébrique des comptes de gestion.
  const groupesDeGestion = new Set(
    MODELE_COMPTE_RESULTAT.flatMap((rubrique) => rubrique.groupes).filter((code) => code !== "")
  );
  const attendu = additionner(
    ...balance.filter((ligne) => groupesDeGestion.has(ligne.groupe)).map((ligne) => oppose(ligne.solde))
  );

  return {
    exercice: options.exercice,
    dateDebut: options.dateDebut,
    dateFin: options.dateFin,
    lignes: evalue.lignes,
    resultatExploitation: valeur("RESULTAT-EXP"),
    resultatFinancier: valeur("RESULTAT-FIN"),
    resultatActivitesOrdinaires: valeur("RESULTAT-AO"),
    resultatHorsActivitesOrdinaires: valeur("RESULTAT-HAO"),
    resultatAvantImpots: valeur("RESULTAT-AI"),
    impotsSurLesResultats: valeur("IS"),
    resultatNet,
    controle: { attendu, presente: resultatNet, ecart: attendu - resultatNet },
    aVerifier: true
  };
}
