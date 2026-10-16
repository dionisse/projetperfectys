/**
 * Rapprochement bancaire.
 *
 * Le rapprochement confronte deux documents qui décrivent la même caisse sans se connaître : le
 * compte 521100 tel que la comptabilité le tient, et le relevé tel que la banque le donne. L'état de
 * rapprochement n'écrit rien : il dit ce qui est pointé, ce qui ne l'est pas, et **ce qui reste
 * inexpliqué** une fois les suspens identifiés.
 *
 * Deux conventions, explicites parce qu'elles sont la source classique des erreurs :
 *
 * - Le montant d'une ligne de relevé est porté **comme la banque l'écrit** : positif quand l'argent
 *   entre (crédit du relevé), négatif quand il sort. Côté comptabilité, le compte 521100 est débiteur
 *   positif : les deux sens sont donc inversés, et la conversion se fait ici, une seule fois.
 * - Un pointage ne rapproche que des montants **égaux**. Un relevé dont la banque a retenu les frais
 *   ne se pointe pas avec le mouvement comptable correspondant : les frais se comptabilisent d'abord,
 *   puis se pointent. Rapprocher deux montants différents reviendrait à masquer une écriture manquante.
 */

import {
  ErreurRegle,
  ZERO,
  additionner,
  analyserMontant,
  formatMontant,
  oppose,
  type Devise,
  type Montant
} from "./montants";
import { comptePrincipalDe, type Mouvement } from "./grand-livre";
import { formaterDateFr, type DateCivile } from "./calendrier";

/** Une ligne de relevé bancaire, telle que la banque la donne. */
export interface LigneDeReleve {
  id: string;
  date: DateCivile;
  libelle: string;
  /** Numéro de chèque, de virement, de remise : ce qui permet un pointage par référence. */
  reference: string;
  /** Positif quand l'argent entre, négatif quand il sort — le sens du relevé, pas celui du compte. */
  montant: Montant;
}

/**
 * Le format du fichier d'où vient un relevé importé.
 *
 * `xlsx` et `pdf` sont des contenants, pas des mises en page : une banque donne le même relevé en
 * classeur ou en document, et ce qu'on y cherche est toujours la date, la référence, le libellé, le
 * montant et le solde. La lecture de ces deux formats passe par une grille de cellules, comme le CSV.
 */
export type FormatDeReleve = "csv" | "ofx" | "camt053" | "xlsx" | "pdf";

/**
 * D'où vient un relevé.
 *
 * Le champ est absent d'un relevé saisi ligne à ligne, et facultatif pour que les relevés et les
 * sauvegardes produits avant l'import demeurent lisibles. Aucun montant n'y figure en `bigint` : la
 * provenance se sérialise telle quelle.
 */
export interface SourceDeReleve {
  format: FormatDeReleve;
  nomFichier: string | null;
  importeLe: string;
  /** IBAN ou numéro de compte annoncé par le fichier. */
  compteBancaire: string | null;
  deviseDuFichier: string | null;
  /** Solde de fin annoncé par le fichier, formaté dans la devise du dossier. */
  soldeDeFin: string | null;
  /** Lignes du fichier écartées parce que déjà présentes dans un relevé du même compte. */
  doublonsEcartes: number;
}

/** Un relevé bancaire, rattaché à un compte de trésorerie du dossier. */
export interface ReleveBancaire {
  id: string;
  compte: string;
  journalCode: string;
  libelle: string;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  /** Solde indiqué par la banque à l'ouverture du relevé. */
  soldeDOuverture: Montant;
  lignes: LigneDeReleve[];
  saisiLe: string;
  saisiPar: string;
  /** Absent d'un relevé saisi ligne à ligne. */
  source?: SourceDeReleve;
}

/** Un pointage : une ligne de relevé rapprochée d'un mouvement du compte. */
export interface Pointage {
  id: string;
  releveId: string;
  ligneDeReleve: string;
  /** `ligneId` du mouvement de grand livre. */
  mouvement: string;
  montant: Montant;
  date: DateCivile;
  acteur: string;
  horodate: string;
  /** Date de dépointage, ou `null` tant que le pointage tient. */
  defaitLe: string | null;
}

export interface DemandeDeReleve {
  compte: string;
  journalCode?: string;
  libelle: string;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  soldeDOuverture: string | Montant;
  lignes: {
    date: DateCivile;
    libelle: string;
    reference?: string;
    montant: string | Montant;
  }[];
}

export interface ElementPointe {
  pointage: string;
  ligneDeReleve: string;
  mouvement: string;
  piece: string;
  date: DateCivile;
  libelle: string;
  reference: string;
  montant: Montant;
}

export interface EtatDeRapprochement {
  releveId: string;
  compte: string;
  journalCode: string;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  /** Solde du compte à la fin du relevé, exercice courant compris. */
  soldeComptable: Montant;
  /** Solde d'ouverture du relevé plus toutes ses lignes. */
  soldeDuReleve: Montant;
  /** Solde comptable − solde du relevé. */
  ecart: Montant;
  pointes: ElementPointe[];
  mouvementsNonPointes: Mouvement[];
  lignesNonPointees: LigneDeReleve[];
  /**
   * Part de l'écart que les suspens **de la période** expliquent : ce que la comptabilité a passé et
   * que la banque n'a pas encore enregistré (un chèque émis), moins ce que la banque a enregistré et
   * que la comptabilité n'a pas passé (des frais prélevés).
   */
  ecartExplique: Montant;
  /** Ce qui reste inexpliqué une fois les suspens de la période et l'écart d'ouverture comptés. */
  ecartRestant: Montant;
  conforme: boolean;
  /** Solde du compte à la veille du relevé, pour vérifier le solde d'ouverture annoncé par la banque. */
  soldeComptableAvantReleve: Montant;
  /**
   * Écart entre le solde d'ouverture du relevé et le solde comptable à la veille, diminué des
   * mouvements antérieurs que ce relevé explique déjà : ce que les périodes précédentes ont laissé en
   * suspens (un chèque émis en mars et jamais présenté).
   */
  ecartDOuverture: Montant;
}

/**
 * Construit un relevé à partir d'une demande de saisie.
 *
 * Les identifiants de lignes sont attribués ici, dans l'ordre : un pointage désigne une ligne par son
 * identifiant, qui ne doit pas dépendre de ce que l'utilisateur a tapé.
 */
export function construireReleve(
  demande: DemandeDeReleve,
  options: { identifiant: string; horodate: string; acteur: string; devise: Devise }
): ReleveBancaire {
  if (demande.dateFin < demande.dateDebut) {
    throw new ErreurRegle(
      `Le relevé se termine le ${formaterDateFr(demande.dateFin)}, avant son ouverture du ${formaterDateFr(
        demande.dateDebut
      )}.`
    );
  }
  if (comptePrincipalDe(demande.compte).charAt(0) !== "5") {
    throw new ErreurRegle(
      `Le compte « ${demande.compte} » n'est pas un compte de trésorerie : un relevé bancaire se rapproche d'un compte de classe 5.`
    );
  }
  if (demande.lignes.length === 0) {
    throw new ErreurRegle("Un relevé sans ligne ne rapproche rien : saisissez au moins une ligne.");
  }

  const lignes = demande.lignes.map((ligne, index) => {
    const montant = typeof ligne.montant === "bigint" ? ligne.montant : analyserMontantSigne(ligne.montant, options.devise);
    if (montant === ZERO) {
      throw new ErreurRegle(`La ligne ${index + 1} du relevé est à zéro : une ligne de relevé porte un montant.`);
    }
    return {
      id: `${options.identifiant}-L${index + 1}`,
      date: ligne.date,
      libelle: ligne.libelle.trim(),
      reference: (ligne.reference ?? "").trim(),
      montant
    };
  });

  for (const ligne of lignes) {
    if (ligne.date < demande.dateDebut || ligne.date > demande.dateFin) {
      throw new ErreurRegle(
        `La ligne « ${ligne.libelle} » du ${formaterDateFr(
          ligne.date
        )} est hors du relevé (${formaterDateFr(demande.dateDebut)} – ${formaterDateFr(demande.dateFin)}).`
      );
    }
  }

  return {
    id: options.identifiant,
    compte: demande.compte,
    journalCode: (demande.journalCode ?? "BQ").toUpperCase(),
    libelle: demande.libelle.trim(),
    dateDebut: demande.dateDebut,
    dateFin: demande.dateFin,
    soldeDOuverture:
      typeof demande.soldeDOuverture === "bigint"
        ? demande.soldeDOuverture
        : analyserMontantSigne(demande.soldeDOuverture, options.devise),
    lignes,
    saisiLe: options.horodate,
    saisiPar: options.acteur
  };
}

/**
 * Montant signé d'une ligne de relevé.
 *
 * Un montant de relevé peut être négatif (un chèque payé) : la saisie comptable, elle, refuse les
 * montants négatifs parce qu'une écriture a un sens. Ici le signe porte l'information, donc il est
 * accepté — mais un montant illisible reste refusé.
 */
export function analyserMontantSigne(texte: string, devise: Devise): Montant {
  const propre = texte.trim().replace(/\u2212/gu, "-");
  const negatif = propre.startsWith("-");
  const corps = negatif ? propre.slice(1) : propre;
  // Le parseur du noyau est exact : aucun flottant, et une décimale en XOF est refusée.
  const montant = analyserMontant(corps, devise);
  return negatif ? oppose(montant) : montant;
}

/** Solde du relevé : solde d'ouverture plus toutes ses lignes. */
export function soldeDuReleve(releve: ReleveBancaire): Montant {
  return additionner(releve.soldeDOuverture, ...releve.lignes.map((ligne) => ligne.montant));
}

/** Pointages en vigueur d'un relevé. */
export function pointagesEnVigueur(pointages: readonly Pointage[], releveId: string): Pointage[] {
  return pointages.filter((pointage) => pointage.releveId === releveId && pointage.defaitLe === null);
}

/**
 * État de rapprochement d'un relevé.
 *
 * Le contrôle porte sur ce qui reste inexpliqué : un écart entre le solde comptable et le solde du
 * relevé est normal (des chèques émis ne sont pas encore présentés), mais il doit être entièrement
 * composé de lignes identifiées de part et d'autre. Ce qui ne s'explique pas est affiché, jamais
 * absorbé.
 */
export function etatDeRapprochement(
  mouvements: readonly Mouvement[],
  releve: ReleveBancaire,
  pointages: readonly Pointage[],
  devise: Devise
): EtatDeRapprochement {
  const compte = comptePrincipalDe(releve.compte);
  const duCompte = mouvements.filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte);

  const soldeComptable = duCompte
    .filter((mouvement) => mouvement.date <= releve.dateFin)
    .reduce<Montant>((total, mouvement) => total + mouvement.debit - mouvement.credit, ZERO);
  const soldeComptableAvantReleve = duCompte
    .filter((mouvement) => mouvement.date < releve.dateDebut)
    .reduce<Montant>((total, mouvement) => total + mouvement.debit - mouvement.credit, ZERO);

  const enVigueur = pointagesEnVigueur(pointages, releve.id);
  const mouvementsPointes = new Set(enVigueur.map((pointage) => pointage.mouvement));
  const lignesPointees = new Set(enVigueur.map((pointage) => pointage.ligneDeReleve));

  const pointes: ElementPointe[] = [];
  for (const pointage of enVigueur) {
    const mouvement = duCompte.find((item) => item.ligneId === pointage.mouvement);
    const ligne = releve.lignes.find((item) => item.id === pointage.ligneDeReleve);
    if (!mouvement || !ligne) {
      // Un pointage orphelin est une anomalie du dossier, pas un solde : il est ignoré mais l'écart
      // restant le révélera.
      continue;
    }
    pointes.push({
      pointage: pointage.id,
      ligneDeReleve: ligne.id,
      mouvement: mouvement.ligneId,
      piece: mouvement.piece,
      date: mouvement.date,
      libelle: mouvement.libelle,
      reference: ligne.reference,
      montant: pointage.montant
    });
  }

  // Le périmètre comptable du rapprochement est la période du relevé : ce qui précède est déjà dans
  // le solde d'ouverture, que l'on compare séparément au solde annoncé par la banque.
  const mouvementsNonPointes = duCompte
    .filter((mouvement) => mouvement.date >= releve.dateDebut && mouvement.date <= releve.dateFin)
    .filter((mouvement) => !mouvementsPointes.has(mouvement.ligneId))
    .filter((mouvement) => mouvement.debit !== ZERO || mouvement.credit !== ZERO);
  const lignesNonPointees = releve.lignes.filter((ligne) => !lignesPointees.has(ligne.id));

  const soldeDuReleveCalcule = soldeDuReleve(releve);
  const ecart = soldeComptable - soldeDuReleveCalcule;

  // L'écart d'ouverture compare le solde comptable de la veille au solde annoncé par la banque. Un
  // mouvement antérieur que ce relevé pointe déjà (un chèque émis en février, présenté en mars)
  // explique une part de cet écart : il est retiré ici, sinon il serait compté deux fois — une fois
  // dans l'ouverture, une fois dans les suspens.
  const pointesAvantPeriode = pointes
    .filter((element) => element.date < releve.dateDebut)
    .reduce<Montant>((total, element) => total + element.montant, ZERO);
  const ecartDOuverture = soldeComptableAvantReleve - pointesAvantPeriode - releve.soldeDOuverture;

  // Les pointages s'annulent : un mouvement pointé vaut exactement la ligne qu'il rapproche. Reste
  // l'écart, qui se décompose en suspens de la période et en ce que les périodes antérieures ont
  // laissé. Un mouvement pointé hors période (un chèque émis en mars, présenté en avril) s'annule
  // aussi : il n'entre dans aucun des deux termes.
  const explique = additionner(
    ...mouvementsNonPointes.map((mouvement) => mouvement.debit - mouvement.credit),
    ...lignesNonPointees.map((ligne) => oppose(ligne.montant))
  );

  const ecartRestant = ecart - explique - ecartDOuverture;

  return {
    releveId: releve.id,
    compte,
    journalCode: releve.journalCode,
    dateDebut: releve.dateDebut,
    dateFin: releve.dateFin,
    soldeComptable,
    soldeDuReleve: soldeDuReleveCalcule,
    ecart,
    pointes,
    mouvementsNonPointes,
    lignesNonPointees,
    ecartExplique: explique,
    ecartRestant,
    conforme: ecartRestant === ZERO,
    soldeComptableAvantReleve,
    ecartDOuverture
  };
}

/**
 * Vérifie qu'un mouvement et une ligne de relevé peuvent être pointés ensemble.
 *
 * Le pointage exige l'égalité des montants, dans les deux sens inversés : un crédit du relevé
 * correspond à un débit du compte.
 */
export function verifierPointage(mouvement: Mouvement, ligne: LigneDeReleve, devise: Devise): Montant {
  const montantComptable = mouvement.debit !== ZERO ? mouvement.debit : oppose(mouvement.credit);
  if (montantComptable !== ligne.montant) {
    throw new ErreurRegle(
      `Le pointage est refusé : le mouvement ${mouvement.piece} du ${formaterDateFr(
        mouvement.date
      )} porte ${formatMontant(montantComptable, devise)} et la ligne de relevé « ${
        ligne.libelle
      } » porte ${formatMontant(ligne.montant, devise)}. Comptabilisez la différence, puis pointez.`
    );
  }
  return ligne.montant;
}

/** Une paire proposée au pointage. */
export interface PropositionDePointage {
  ligneDeReleve: string;
  mouvement: string;
  montant: Montant;
  /** « reference » quand la référence du relevé figure dans la pièce ou le libellé, « montant » sinon. */
  nature: "reference" | "montant";
  piece: string;
  date: DateCivile;
}

/**
 * Pointage automatique : par référence d'abord, par montant exact ensuite.
 *
 * La référence passe avant le montant parce qu'elle est plus sûre : deux règlements du même montant
 * le même jour sont courants, deux règlements portant le même numéro de chèque ne le sont pas.
 */
export function proposerPointageAutomatique(
  mouvements: readonly Mouvement[],
  releve: ReleveBancaire,
  pointages: readonly Pointage[],
  options?: { dansLaPlageDuReleve?: boolean }
): PropositionDePointage[] {
  const compte = comptePrincipalDe(releve.compte);
  const enVigueur = pointagesEnVigueur(pointages, releve.id);
  const mouvementsPointes = new Set(enVigueur.map((pointage) => pointage.mouvement));
  const lignesPointees = new Set(enVigueur.map((pointage) => pointage.ligneDeReleve));

  const candidats = mouvements
    .filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte)
    .filter((mouvement) => !mouvementsPointes.has(mouvement.ligneId))
    .filter((mouvement) => mouvement.debit !== ZERO || mouvement.credit !== ZERO)
    .filter((mouvement) =>
      options?.dansLaPlageDuReleve === false
        ? mouvement.date <= releve.dateFin
        : mouvement.date >= releve.dateDebut && mouvement.date <= releve.dateFin
    );

  const prises = new Set<string>();
  const propositions: PropositionDePointage[] = [];
  const montantDe = (mouvement: Mouvement): Montant =>
    mouvement.debit !== ZERO ? mouvement.debit : oppose(mouvement.credit);

  // 1. Par référence : le numéro porté par le relevé figure dans la pièce ou le libellé du mouvement.
  for (const ligne of releve.lignes) {
    if (lignesPointees.has(ligne.id) || prises.has(ligne.id) || ligne.reference === "") {
      continue;
    }
    const trouve = candidats.find(
      (mouvement) =>
        mouvement.piece.toUpperCase().includes(ligne.reference.toUpperCase()) ||
        mouvement.libelle.toUpperCase().includes(ligne.reference.toUpperCase())
    );
    if (trouve && montantDe(trouve) === ligne.montant) {
      prises.add(ligne.id);
      propositions.push({
        ligneDeReleve: ligne.id,
        mouvement: trouve.ligneId,
        montant: ligne.montant,
        nature: "reference",
        piece: trouve.piece,
        date: trouve.date
      });
    }
  }

  // 2. Par montant exact, dans l'ordre du relevé puis dans celui du compte.
  for (const ligne of releve.lignes) {
    if (lignesPointees.has(ligne.id) || prises.has(ligne.id)) {
      continue;
    }
    const trouve = candidats.find(
      (mouvement) => !propositions.some((item) => item.mouvement === mouvement.ligneId) && montantDe(mouvement) === ligne.montant
    );
    if (trouve) {
      prises.add(ligne.id);
      propositions.push({
        ligneDeReleve: ligne.id,
        mouvement: trouve.ligneId,
        montant: ligne.montant,
        nature: "montant",
        piece: trouve.piece,
        date: trouve.date
      });
    }
  }

  return propositions;
}
