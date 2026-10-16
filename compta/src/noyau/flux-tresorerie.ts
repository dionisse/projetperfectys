/**
 * Tableau des flux de trésorerie — le troisième état obligatoire du SYSCOHADA révisé.
 *
 * Le bilan dit ce que l'entreprise possède et doit à une date ; le compte de résultat dit ce qu'elle a
 * gagné ou perdu sur une période ; **le tableau des flux de trésorerie dit d'où vient l'argent et où il
 * est allé**. Une entreprise peut être bénéficiaire et à court de liquidités : c'est précisément ce
 * que cet état montre.
 *
 * Le modèle OHADA révisé est en **méthode indirecte** pour l'activité — il part de la capacité
 * d'autofinancement globale et la corrige des variations du besoin de financement — et en **méthode
 * directe** pour l'investissement et le financement, qui retracent les décaissements et encaissements
 * réels. Les codes de l'imprimé (ZA, FA à FP, ZB à ZH) sont portés tels quels, comme données.
 *
 * Trois disciplines, les mêmes que pour le bilan :
 *
 *  - **La présentation est une donnée, pas du code.** `MODELE_TFT` nomme, pour chaque ligne, ce qui
 *    l'alimente : des groupes de comptes pour une variation, des groupes et des préfixes de comptes
 *    pour un flux, des codes de comptes pour la capacité d'autofinancement. Un autre référentiel est
 *    un autre modèle.
 *  - **L'état se contrôle lui-même.** La trésorerie de clôture présentée (ZA + ZG) doit égaler la
 *    trésorerie réelle lue dans les comptes (trésorerie actif − trésorerie passif). C'est le contrôle
 *    que l'imprimé officiel porte lui-même en bas de page. Un écart est affiché, jamais absorbé.
 *  - **Ce qui n'est pas classé est dit.** Un compte dont la variation n'entre dans aucune ligne — un
 *    compte de liaison, un groupe ajouté au plan sans être rattaché — est listé avec son montant :
 *    c'est la cause ordinaire d'un écart, et la cacher rendrait l'état indéchiffrable.
 *
 * Limite assumée, la même que pour le bilan : les libellés suivent le modèle révisé, mais la mise en
 * page de l'imprimé officiel et le rattachement exact de quelques comptes (intérêts payés, impôt sur
 * les plus-values) relèvent d'un choix de présentation. `aVerifier` le dit, et le détail des comptes
 * derrière chaque ligne permet de le contrôler.
 */

import { ZERO, somme, type Montant } from "./montants";
import type { DateCivile } from "./calendrier";
import type { GroupeDeComptes } from "./comptes";
import { construireCompteDeResultat } from "./etats-financiers";
import { comptePrincipalDe, type LigneBalance, type Mouvement } from "./grand-livre";

/** Les grandes masses de l'imprimé, dans leur ordre. */
export type SectionDeFlux =
  | "ouverture"
  | "operationnel"
  | "investissement"
  | "capitaux-propres"
  | "capitaux-etrangers"
  | "financement"
  | "variation"
  | "cloture";

export const LIBELLE_DE_SECTION: Record<SectionDeFlux, string> = {
  ouverture: "Trésorerie d'ouverture",
  operationnel: "Flux de trésorerie provenant des activités opérationnelles",
  investissement: "Flux de trésorerie provenant des activités d'investissement",
  "capitaux-propres": "Flux de trésorerie provenant du financement par les capitaux propres",
  "capitaux-etrangers": "Flux de trésorerie provenant du financement par les capitaux étrangers",
  financement: "Flux de trésorerie provenant des activités de financement",
  variation: "Variation de la trésorerie nette de la période",
  cloture: "Trésorerie nette à la clôture"
};

/**
 * Comment une ligne est calculée.
 *
 * - `tresorerie` lit les comptes de trésorerie à l'ouverture ou à la clôture ;
 * - `capaciteAutofinancement` part du résultat net et neutralise ce qui n'est pas un mouvement
 *   d'argent ;
 * - `variation` mesure le mouvement d'un groupe de comptes entre l'ouverture et la clôture : une
 *   hausse des stocks ou des créances consomme de la trésorerie, une hausse des dettes en apporte ;
 * - `flux` additionne les lignes **hors trésorerie** des écritures qui touchent la trésorerie, dans le
 *   sens demandé : c'est la méthode directe, et elle est exacte parce qu'une écriture équilibrée fait
 *   correspondre à chaque sortie d'argent une contrepartie de même montant ;
 * - `total` somme d'autres lignes, par leur code.
 */
export type CalculDeFlux =
  | { type: "tresorerie"; instant: "ouverture" | "cloture" }
  | { type: "capaciteAutofinancement" }
  | { type: "variation"; groupes: string[] }
  | { type: "flux"; direction: "sortie" | "entree"; groupes?: string[]; comptes?: string[] }
  | { type: "total"; de: string[] };

export interface RubriqueDeFlux {
  /** Le code de l'imprimé : ZA, FA… FP, ZB… ZH. */
  code: string;
  libelle: string;
  section: SectionDeFlux;
  niveau: "detail" | "total";
  calcul: CalculDeFlux;
  /** Une ligne que le plan de démarrage n'alimente pas reste affichée, à zéro. */
  facultative?: boolean;
}

/** Un compte derrière une ligne : ce qui permet de vérifier, pas seulement de lire. */
export interface DetailDeFlux {
  compte: string;
  libelle: string;
  groupe: string;
  /** Signé : positif quand l'argent entre. */
  montant: Montant;
}

export interface LigneDeFlux {
  code: string;
  libelle: string;
  section: SectionDeFlux;
  niveau: "detail" | "total";
  /** Signé : positif quand l'argent entre, négatif quand il sort. */
  montant: Montant;
  comptes: DetailDeFlux[];
  facultative: boolean;
}

/** Un compte dont la variation n'entre dans aucune ligne : la cause ordinaire d'un écart. */
export interface CompteNonCouvert {
  compte: string;
  libelle: string;
  groupe: string;
  variation: Montant;
}

export interface TableauDesFluxDeTresorerie {
  exercice: number;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  lignes: LigneDeFlux[];
  /** ZA : trésorerie actif − trésorerie passif à l'ouverture de l'exercice. */
  tresorerieOuverture: Montant;
  /** ZG : la variation expliquée par les trois activités. */
  variationPresentee: Montant;
  /** ZH : ZA + ZG, ce que le tableau présente comme trésorerie de clôture. */
  tresoreriePresentee: Montant;
  /** La trésorerie réelle à la clôture, lue dans les comptes de classe 5. */
  tresorerieReelle: Montant;
  /** ZH − trésorerie réelle. Nul quand tout le plan est classé. */
  ecart: Montant;
  capaciteAutofinancement: Montant;
  resultatNet: Montant;
  fluxOperationnels: Montant;
  fluxInvestissement: Montant;
  fluxFinancement: Montant;
  /** Comptes dont la variation n'entre dans aucune ligne, avec leur montant : l'écart s'explique là. */
  comptesNonCouverts: CompteNonCouvert[];
  /** Écritures entre comptes de trésorerie (virements internes) : elles ne sont pas des flux. */
  virementsInternes: number;
  /** Le modèle suit l'imprimé révisé ; sa mise en page officielle reste à valider. */
  aVerifier: boolean;
}

/* ------------------------------------------------------------------ */
/* Le modèle                                                           */
/* ------------------------------------------------------------------ */

/**
 * Comptes de charges et produits calculés : ils entrent dans le résultat sans mouvement d'argent, la
 * capacité d'autofinancement les neutralise. `682` et `782` — les cessions d'immobilisations — sont
 * traités à part, parce qu'ils appartiennent à l'investissement.
 */
const PREFIXES_DOTATIONS: readonly string[] = ["68", "69"];
const PREFIXES_REPRISES: readonly string[] = ["78"];
const COMPTE_VNC_CEDEES = "682";
const COMPTE_PRODUITS_CESSIONS = "782";

/**
 * Comptes d'amortissements et de dépréciations d'actif : leur variation est la contrepartie des
 * dotations, déjà neutralisées dans la capacité d'autofinancement. Les compter aussi dans une
 * variation les ferait passer deux fois.
 */
const PREFIXES_NEUTRALISES: readonly string[] = ["28", "29", "39", "49", "59"];

/** Le tableau des flux de trésorerie du SYSCOHADA révisé, dans l'ordre de l'imprimé. */
export const MODELE_TFT: readonly RubriqueDeFlux[] = [
  {
    code: "ZA",
    libelle: "Trésorerie nette au début de l'exercice (trésorerie actif − trésorerie passif)",
    section: "ouverture",
    niveau: "detail",
    calcul: { type: "tresorerie", instant: "ouverture" }
  },

  {
    code: "FA",
    libelle: "Capacité d'autofinancement globale",
    section: "operationnel",
    niveau: "detail",
    calcul: { type: "capaciteAutofinancement" }
  },
  {
    code: "FB",
    libelle: "Variation de l'actif circulant hors activités ordinaires",
    section: "operationnel",
    niveau: "detail",
    calcul: { type: "variation", groupes: ["ACT-CIRC-HAO"] },
    facultative: true
  },
  {
    code: "FC",
    libelle: "Variation des stocks",
    section: "operationnel",
    niveau: "detail",
    calcul: { type: "variation", groupes: ["STOCK"] }
  },
  {
    code: "FD",
    libelle: "Variation des créances et autres débiteurs",
    section: "operationnel",
    niveau: "detail",
    calcul: { type: "variation", groupes: ["CREANCE"] }
  },
  {
    code: "FE",
    libelle: "Variation du passif circulant et autres créditeurs",
    section: "operationnel",
    niveau: "detail",
    calcul: { type: "variation", groupes: ["DETTE-CIRC"] }
  },
  {
    code: "ZB",
    libelle: "Flux de trésorerie provenant des activités opérationnelles (FA à FE)",
    section: "operationnel",
    niveau: "total",
    calcul: { type: "total", de: ["FA", "FB", "FC", "FD", "FE"] }
  },

  {
    code: "FF",
    libelle: "Décaissements liés aux acquisitions d'immobilisations incorporelles",
    section: "investissement",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", groupes: ["IMMO-INC"] },
    facultative: true
  },
  {
    code: "FG",
    libelle: "Décaissements liés aux acquisitions d'immobilisations corporelles",
    section: "investissement",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", groupes: ["IMMO-COR"] }
  },
  {
    code: "FH",
    libelle: "Décaissements liés aux acquisitions d'immobilisations financières",
    section: "investissement",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", groupes: ["IMMO-FIN"] },
    facultative: true
  },
  {
    code: "FI",
    libelle: "Encaissements liés aux cessions d'immobilisations incorporelles et corporelles",
    section: "investissement",
    niveau: "detail",
    calcul: {
      type: "flux",
      direction: "entree",
      groupes: ["IMMO-INC", "IMMO-COR"],
      comptes: [COMPTE_PRODUITS_CESSIONS]
    },
    facultative: true
  },
  {
    code: "FJ",
    libelle: "Encaissements liés aux cessions d'immobilisations financières",
    section: "investissement",
    niveau: "detail",
    calcul: { type: "flux", direction: "entree", groupes: ["IMMO-FIN"] },
    facultative: true
  },
  {
    code: "ZC",
    libelle: "Flux de trésorerie provenant des activités d'investissement (FF à FJ)",
    section: "investissement",
    niveau: "total",
    calcul: { type: "total", de: ["FF", "FG", "FH", "FI", "FJ"] }
  },

  {
    code: "FK",
    libelle: "Encaissements provenant des augmentations de capital par apports nouveaux",
    section: "capitaux-propres",
    niveau: "detail",
    calcul: { type: "flux", direction: "entree", groupes: ["CAP"] },
    facultative: true
  },
  {
    code: "FL",
    libelle: "Encaissements provenant des subventions d'investissement reçues",
    section: "capitaux-propres",
    niveau: "detail",
    calcul: { type: "flux", direction: "entree", comptes: ["13"] },
    facultative: true
  },
  {
    code: "FM",
    libelle: "Décaissements provenant des prélèvements sur le capital",
    section: "capitaux-propres",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", groupes: ["CAP"] },
    facultative: true
  },
  {
    code: "FN",
    libelle: "Décaissements provenant des dividendes versés",
    section: "capitaux-propres",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", comptes: ["457"] },
    facultative: true
  },
  {
    code: "ZD",
    libelle: "Flux de trésorerie provenant du financement par les capitaux propres (FK à FN)",
    section: "capitaux-propres",
    niveau: "total",
    calcul: { type: "total", de: ["FK", "FL", "FM", "FN"] }
  },

  {
    code: "FO",
    libelle: "Encaissements provenant des emprunts et autres dettes financières",
    section: "capitaux-etrangers",
    niveau: "detail",
    calcul: { type: "flux", direction: "entree", groupes: ["DET-ST"] },
    facultative: true
  },
  {
    code: "FP",
    libelle: "Décaissements provenant des remboursements des emprunts et autres dettes financières",
    section: "capitaux-etrangers",
    niveau: "detail",
    calcul: { type: "flux", direction: "sortie", groupes: ["DET-ST"] },
    facultative: true
  },
  {
    code: "ZE",
    libelle: "Flux de trésorerie provenant du financement par les capitaux étrangers (FO à FP)",
    section: "capitaux-etrangers",
    niveau: "total",
    calcul: { type: "total", de: ["FO", "FP"] }
  },

  {
    code: "ZF",
    libelle: "Flux de trésorerie provenant des activités de financement (ZD + ZE)",
    section: "financement",
    niveau: "total",
    calcul: { type: "total", de: ["ZD", "ZE"] }
  },
  {
    code: "ZG",
    libelle: "Variation de la trésorerie nette de la période (ZB + ZC + ZF)",
    section: "variation",
    niveau: "total",
    calcul: { type: "total", de: ["ZB", "ZC", "ZF"] }
  },
  {
    code: "ZH",
    libelle: "Trésorerie nette à la clôture (ZA + ZG)",
    section: "cloture",
    niveau: "total",
    calcul: { type: "total", de: ["ZA", "ZG"] }
  }
];

/* ------------------------------------------------------------------ */
/* Le producteur                                                       */
/* ------------------------------------------------------------------ */

const GROUPES_DE_TRESORERIE: readonly string[] = ["TRES-ACT", "TRES-PAS"];

/**
 * Le journal des à-nouveaux, tel que le dossier de démonstration et la clôture le nomment. Le service
 * le transmet depuis les journaux du dossier, dont la nature fait foi : un dossier qui l'a renommé
 * reste correctement lu.
 */
const JOURNAUX_D_OUVERTURE: readonly string[] = ["AN"];

const commencePar = (compte: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefixe) => compte.startsWith(prefixe));

/**
 * Construit le tableau des flux de trésorerie d'un exercice, arrêté à une date.
 *
 * La balance donne les soldes — trésorerie d'ouverture et de clôture, variations des groupes —, les
 * mouvements donnent les flux réels. Les deux viennent de la même fenêtre de lecture : un tableau dont
 * les flux ne couvrent pas la même période que ses variations ne se contrôlerait pas.
 */
export function construireTableauDesFluxDeTresorerie(
  balance: readonly LigneBalance[],
  mouvements: readonly Mouvement[],
  groupes: readonly GroupeDeComptes[],
  options: {
    exercice: number;
    dateDebut: DateCivile;
    dateFin: DateCivile;
    /**
     * Journaux dont les écritures portent l'ouverture de l'exercice, et non un flux de la période.
     *
     * Les à-nouveaux — ceux d'une première ouverture comme ceux qu'écrit une clôture — décrivent la
     * position de départ. Les compter en flux ferait apparaître le capital et les dettes de l'an
     * dernier comme de l'argent reçu cette année, et la trésorerie d'ouverture serait lue à zéro sur un
     * premier exercice.
     */
    journauxDOuverture?: readonly string[];
  }
): TableauDesFluxDeTresorerie {
  const journauxDOuverture = options.journauxDOuverture ?? JOURNAUX_D_OUVERTURE;
  const mouvementsDOuverture = mouvements.filter((mouvement) =>
    journauxDOuverture.includes(mouvement.journalCode)
  );
  const mouvementsDeFlux = mouvements.filter(
    (mouvement) => !journauxDOuverture.includes(mouvement.journalCode)
  );
  const ouvertures = soldesDOuverture(balance, mouvementsDOuverture);

  const resultat = construireCompteDeResultat(balance, options);
  const tresorerie = tresorerieDe(balance, ouvertures);
  const variations = variationsDe(balance, ouvertures);
  const flux = fluxDeTresorerie(mouvementsDeFlux, balance);

  // La capacité d'autofinancement globale : le résultat, corrigé de ce qui n'est pas un mouvement
  // d'argent et de ce qui appartient à l'investissement. Chaque terme est lu en débit − crédit : une
  // dotation a un solde débiteur et s'ajoute, un produit de cession un solde créditeur et se retire —
  // le même signe, dans les deux cas, fait le bon calcul.
  let dotations = ZERO;
  let reprises = ZERO;
  let valeurComptableCessions = ZERO;
  let produitsDeCessions = ZERO;
  for (const ligne of balance) {
    const solde = ligne.totalDebit - ligne.totalCredit;
    if (solde === ZERO) {
      continue;
    }
    // 682 et 782 commencent comme les dotations et les reprises : ils sont écartés d'abord.
    if (ligne.compte.startsWith(COMPTE_VNC_CEDEES)) {
      valeurComptableCessions += solde;
    } else if (ligne.compte.startsWith(COMPTE_PRODUITS_CESSIONS)) {
      produitsDeCessions += solde;
    } else if (commencePar(ligne.compte, PREFIXES_DOTATIONS)) {
      dotations += solde;
    } else if (commencePar(ligne.compte, PREFIXES_REPRISES)) {
      reprises += solde;
    }
  }
  const capaciteAutofinancement =
    resultat.resultatNet + dotations + reprises + valeurComptableCessions + produitsDeCessions;

  const valeurs = new Map<string, { montant: Montant; comptes: DetailDeFlux[] }>();
  for (const rubrique of MODELE_TFT) {
    valeurs.set(
      rubrique.code,
      evaluerRubrique(rubrique, {
        balance,
        variations,
        flux,
        capaciteAutofinancement,
        tresorerie,
        ouvertures,
        valeurs
      })
    );
  }

  const ligneDe = (rubrique: RubriqueDeFlux): LigneDeFlux => {
    const evaluee = valeurs.get(rubrique.code)!;
    return {
      code: rubrique.code,
      libelle: rubrique.libelle,
      section: rubrique.section,
      niveau: rubrique.niveau,
      montant: evaluee.montant,
      comptes: evaluee.comptes,
      facultative: rubrique.facultative ?? false
    };
  };
  const lignes = MODELE_TFT.map(ligneDe);
  const montantDe = (code: string): Montant => valeurs.get(code)?.montant ?? ZERO;

  const tresorerieOuverture = montantDe("ZA");
  const variationPresentee = montantDe("ZG");
  const tresoreriePresentee = montantDe("ZH");
  const comptesNonCouverts = comptesNonCouvertsDe(balance, groupes);

  return {
    exercice: options.exercice,
    dateDebut: options.dateDebut,
    dateFin: options.dateFin,
    lignes,
    tresorerieOuverture,
    variationPresentee,
    tresoreriePresentee,
    tresorerieReelle: tresorerie.cloture,
    ecart: tresoreriePresentee - tresorerie.cloture,
    capaciteAutofinancement,
    resultatNet: resultat.resultatNet,
    fluxOperationnels: montantDe("ZB"),
    fluxInvestissement: montantDe("ZC"),
    fluxFinancement: montantDe("ZF"),
    comptesNonCouverts,
    virementsInternes: flux.virementsInternes,
    aVerifier: true
  };
}

/**
 * Le solde de chaque compte à l'ouverture de la fenêtre : son solde initial, augmenté des à-nouveaux.
 *
 * Une balance range les à-nouveaux dans ses totaux de période, puisqu'ils sont des écritures datées du
 * premier jour de l'exercice. Pour le tableau des flux, ils appartiennent à l'ouverture : c'est cette
 * correction qui fait que la trésorerie d'ouverture est celle d'avant le premier mouvement de l'année.
 */
function soldesDOuverture(
  balance: readonly LigneBalance[],
  mouvementsDOuverture: readonly Mouvement[]
): Map<string, Montant> {
  const aNouveaux = new Map<string, Montant>();
  for (const mouvement of mouvementsDOuverture) {
    const cle = comptePrincipalDe(mouvement.compte);
    aNouveaux.set(cle, (aNouveaux.get(cle) ?? ZERO) + mouvement.debit - mouvement.credit);
  }
  return new Map(
    balance.map(
      (ligne) =>
        [ligne.compte, ligne.soldeInitial + (aNouveaux.get(ligne.compte) ?? ZERO)] as const
    )
  );
}

/** Trésorerie à l'ouverture et à la clôture : l'actif de classe 5, diminué des découverts. */
function tresorerieDe(
  balance: readonly LigneBalance[],
  ouvertures: ReadonlyMap<string, Montant>
): { ouverture: Montant; cloture: Montant } {
  const lignes = balance.filter((ligne) => GROUPES_DE_TRESORERIE.includes(ligne.groupe));
  // Un solde est en débit − crédit : un découvert (trésorerie passif) a un solde créditeur, donc
  // négatif, et se retranche de lui-même en étant ajouté avec son signe inversé.
  const signe = (ligne: LigneBalance): Montant => (ligne.groupe === "TRES-PAS" ? -ligne.solde : ligne.solde);
  const signeOuverture = (ligne: LigneBalance): Montant => {
    const solde = ouvertures.get(ligne.compte) ?? ZERO;
    return ligne.groupe === "TRES-PAS" ? -solde : solde;
  };
  return {
    ouverture: somme(lignes.map(signeOuverture)),
    cloture: somme(lignes.map(signe))
  };
}

/**
 * La variation de chaque groupe entre l'ouverture et la clôture, en trésorerie.
 *
 * Le solde d'une ligne de balance est en débit − crédit. Une hausse de stock ou de créance consomme de
 * la trésorerie ; une hausse de dette en apporte. Dans les deux cas, la variation présentée est
 * l'opposé de la variation du solde : c'est ce signe unique qui fait que l'état se contrôle.
 */
function variationsDe(
  balance: readonly LigneBalance[],
  ouvertures: ReadonlyMap<string, Montant>
): Map<string, { montant: Montant; comptes: DetailDeFlux[] }> {
  const parGroupe = new Map<string, { montant: Montant; comptes: DetailDeFlux[] }>();
  for (const ligne of balance) {
    const variation = ligne.solde - (ouvertures.get(ligne.compte) ?? ZERO);
    if (variation === ZERO) {
      continue;
    }
    const courant = parGroupe.get(ligne.groupe) ?? { montant: ZERO, comptes: [] };
    courant.montant += -variation;
    courant.comptes.push({
      compte: ligne.compte,
      libelle: ligne.libelle,
      groupe: ligne.groupe,
      montant: -variation
    });
    parGroupe.set(ligne.groupe, courant);
  }
  return parGroupe;
}

/** Une ligne hors trésorerie d'une écriture de trésorerie, signée : positif quand l'argent entre. */
interface FluxClasse {
  compte: string;
  libelle: string;
  groupe: string;
  /** Crédit − débit de la contrepartie : c'est le signe de la trésorerie qu'elle explique. */
  montant: Montant;
}

/**
 * Les flux réels, lus dans les écritures qui touchent la trésorerie.
 *
 * Une écriture équilibrée fait correspondre à chaque ligne de trésorerie des contreparties de même
 * montant total : la somme des contreparties signées (crédit − débit) est exactement l'argent entré ou
 * sorti. Classer les contreparties — et non les lignes de trésorerie — évite tout partage approché :
 * aucun arrondi, aucune clé de répartition.
 *
 * Une écriture qui ne porte que des comptes de trésorerie est un virement interne : l'argent change de
 * poche, ce n'est pas un flux. Elles sont comptées, pour être dites.
 */
function fluxDeTresorerie(
  mouvements: readonly Mouvement[],
  balance: readonly LigneBalance[]
): { parCompte: FluxClasse[]; virementsInternes: number } {
  const groupeDe = new Map(balance.map((ligne) => [ligne.compte, ligne.groupe] as const));
  const libelleDe = new Map(balance.map((ligne) => [ligne.compte, ligne.libelle] as const));
  const estTresorerie = (compte: string): boolean => {
    const groupe = groupeDe.get(comptePrincipalDe(compte));
    return groupe !== undefined && GROUPES_DE_TRESORERIE.includes(groupe);
  };

  const parEcriture = new Map<string, Mouvement[]>();
  for (const mouvement of mouvements) {
    const lignes = parEcriture.get(mouvement.ecritureId) ?? [];
    lignes.push(mouvement);
    parEcriture.set(mouvement.ecritureId, lignes);
  }

  const parCompte: FluxClasse[] = [];
  let virementsInternes = 0;
  for (const lignes of parEcriture.values()) {
    const tresorerie = lignes.filter((ligne) => estTresorerie(ligne.compte));
    if (tresorerie.length === 0) {
      continue;
    }
    const contreparties = lignes.filter((ligne) => !estTresorerie(ligne.compte));
    if (contreparties.length === 0) {
      // Un virement de caisse à banque : aucune contrepartie hors trésorerie, aucun flux.
      virementsInternes += 1;
      continue;
    }
    for (const contrepartie of contreparties) {
      const montant = contrepartie.credit - contrepartie.debit;
      if (montant === ZERO) {
        continue;
      }
      // Un mouvement porte un compte segmenté ; la balance, et donc le groupe, est tenue au principal.
      const principal = comptePrincipalDe(contrepartie.compte);
      parCompte.push({
        compte: principal,
        libelle: libelleDe.get(principal) ?? principal,
        groupe: groupeDe.get(principal) ?? "",
        montant
      });
    }
  }
  return { parCompte, virementsInternes };
}

function evaluerRubrique(
  rubrique: RubriqueDeFlux,
  contexte: {
    balance: readonly LigneBalance[];
    variations: Map<string, { montant: Montant; comptes: DetailDeFlux[] }>;
    flux: { parCompte: FluxClasse[]; virementsInternes: number };
    capaciteAutofinancement: Montant;
    tresorerie: { ouverture: Montant; cloture: Montant };
    ouvertures: ReadonlyMap<string, Montant>;
    valeurs: Map<string, { montant: Montant; comptes: DetailDeFlux[] }>;
  }
): { montant: Montant; comptes: DetailDeFlux[] } {
  const calcul = rubrique.calcul;
  switch (calcul.type) {
    case "tresorerie":
      return {
        montant: calcul.instant === "ouverture" ? contexte.tresorerie.ouverture : contexte.tresorerie.cloture,
        comptes: contexte.balance
          .filter((ligne) => GROUPES_DE_TRESORERIE.includes(ligne.groupe))
          .map((ligne) => {
            const brut =
              calcul.instant === "ouverture" ? (contexte.ouvertures.get(ligne.compte) ?? ZERO) : ligne.solde;
            const montant = ligne.groupe === "TRES-PAS" ? -brut : brut;
            return { compte: ligne.compte, libelle: ligne.libelle, groupe: ligne.groupe, montant };
          })
      };

    case "capaciteAutofinancement":
      return { montant: contexte.capaciteAutofinancement, comptes: [] };

    case "variation": {
      const retenues = calcul.groupes
        .map((groupe) => contexte.variations.get(groupe))
        .filter((valeur): valeur is { montant: Montant; comptes: DetailDeFlux[] } => valeur !== undefined);
      return {
        montant: somme(retenues.map((retenue) => retenue.montant)),
        comptes: retenues.flatMap((retenue) => retenue.comptes)
      };
    }

    case "flux": {
      const retenus = contexte.flux.parCompte.filter((flux) => {
        const vise =
          (calcul.groupes?.includes(flux.groupe) ?? false) ||
          (calcul.comptes?.some((prefixe) => flux.compte.startsWith(prefixe)) ?? false);
        if (!vise) {
          return false;
        }
        return calcul.direction === "entree" ? flux.montant > ZERO : flux.montant < ZERO;
      });
      return {
        montant: somme(retenus.map((retenu) => retenu.montant)),
        comptes: retenus.map((retenu) => ({ ...retenu }))
      };
    }

    case "total": {
      // Un flux de trésorerie ne se détaille pas : la somme de ses lignes suffit.
      const membres = calcul.de
        .filter((code) => code !== rubrique.code)
        .map((code) => contexte.valeurs.get(code)?.montant ?? ZERO);
      return { montant: somme(membres), comptes: [] };
    }
  }
}

/**
 * Les comptes dont la variation n'entre dans aucune ligne de l'état.
 *
 * Sont couverts : les comptes de gestion, que la capacité d'autofinancement reprend ; les comptes de
 * trésorerie, qui sont l'objet de l'état ; les groupes nommés par une ligne de variation ; les groupes
 * et préfixes nommés par une ligne de flux ; et les comptes d'amortissements et de dépréciations, dont
 * la variation est la contrepartie des dotations déjà neutralisées. Tout le reste est listé, avec son
 * montant : c'est là que se lit un écart.
 */
function comptesNonCouvertsDe(
  balance: readonly LigneBalance[],
  groupes: readonly GroupeDeComptes[]
): CompteNonCouvert[] {
  const groupesDeVariation = new Set(
    MODELE_TFT.flatMap((rubrique) => (rubrique.calcul.type === "variation" ? rubrique.calcul.groupes : []))
  );
  const groupesDeFlux = new Set(
    MODELE_TFT.flatMap((rubrique) => (rubrique.calcul.type === "flux" ? rubrique.calcul.groupes ?? [] : []))
  );
  const prefixesDeFlux = MODELE_TFT.flatMap((rubrique) =>
    rubrique.calcul.type === "flux" ? rubrique.calcul.comptes ?? [] : []
  );
  const libelleDeGroupe = new Map(groupes.map((groupe) => [groupe.code, groupe.libelle] as const));
  const gestion = new Set(groupes.filter((groupe) => groupe.etat === "resultat").map((groupe) => groupe.code));

  const nonCouverts: CompteNonCouvert[] = [];
  for (const ligne of balance) {
    const variation = ligne.solde - ligne.soldeInitial;
    if (variation === ZERO) {
      continue;
    }
    const couvert =
      GROUPES_DE_TRESORERIE.includes(ligne.groupe) ||
      gestion.has(ligne.groupe) ||
      groupesDeVariation.has(ligne.groupe) ||
      groupesDeFlux.has(ligne.groupe) ||
      prefixesDeFlux.some((prefixe) => ligne.compte.startsWith(prefixe)) ||
      commencePar(ligne.compte, PREFIXES_NEUTRALISES);
    if (!couvert) {
      nonCouverts.push({
        compte: ligne.compte,
        libelle: `${ligne.libelle} — ${libelleDeGroupe.get(ligne.groupe) ?? ligne.groupe}`,
        groupe: ligne.groupe,
        variation
      });
    }
  }
  nonCouverts.sort((gauche, droite) => gauche.compte.localeCompare(droite.compte));
  return nonCouverts;
}
