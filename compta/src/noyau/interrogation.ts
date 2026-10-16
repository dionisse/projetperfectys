/**
 * Interrogation d'un compte, et historique.
 *
 * Ce que fait un comptable plusieurs fois par jour : ouvrir un compte, voir ce qui s'y est passé,
 * avec le **solde après chaque ligne**, et savoir ce qui reste en suspens. Le grand livre liste les
 * mouvements ; l'interrogation les met en perspective — solde d'ouverture de la fenêtre, solde
 * progressif, part lettrée et part pointée en banque, et comparaison d'un exercice à l'autre.
 *
 * Deux règles de fond :
 *
 * - Le solde progressif part du **solde réel à l'ouverture de la fenêtre**, pas de zéro. Un compte
 *   interrogé du 1er avril au 30 juin commence avec tout ce qui précède, à-nouveaux compris, sinon le
 *   solde affiché ne correspond à rien de ce que l'utilisateur connaît.
 * - Une ligne issue d'un **exercice clos** est marquée comme telle : elle ne bougera plus, et le dire
 *   évite de chercher une écriture corrective qui n'a pas à exister.
 */

import { ZERO, additionner, formatMontant, type Devise, type Montant } from "./montants";
import {
  comptePrincipalDe,
  sensDe,
  type FiltreMouvements,
  type Mouvement,
  type SensSolde
} from "./grand-livre";
import type { Compte } from "./comptes";
import { formaterDateFr, type DateCivile } from "./calendrier";
import { etatDeLettrage, resteDeLigne, type Lettrage } from "./lettrage";
import type { Pointage, ReleveBancaire } from "./rapprochement";

/**
 * Ce dont l'interrogation a besoin d'un exercice clos : son année.
 *
 * Déclaré ici plutôt qu'importé du dossier, pour que le noyau reste acyclique — c'est le dossier qui
 * appelle l'interrogation, pas l'inverse.
 */
export interface ExerciceClosSommaire {
  exercice: { annee: number };
}

/** Ce que l'utilisateur demande : un compte, une fenêtre, éventuellement un tiers ou un journal. */
export interface DemandeInterrogation {
  /** Numéro du compte, segmenté ou non : `401100` et `401100-FOU01` sont deux interrogations. */
  compte: string;
  tiersCode?: string;
  journalCode?: string;
  du?: DateCivile;
  au?: DateCivile;
  /** Exercice interrogé. Sans lui, l'exercice courant du dossier. */
  exercice?: number;
  /**
   * Étendre l'interrogation à l'exercice précédent, clos ou non : c'est ce qui permet de comparer, et
   * de retrouver en début d'année ce que l'exercice clos a reporté.
   */
  inclureExercicePrecedent?: boolean;
}

export interface LigneInterrogation {
  ligneId: string;
  exercice: number;
  periode: number;
  date: DateCivile;
  piece: string;
  journalCode: string;
  lotNumero: string;
  libelle: string;
  tiersCode: string | null;
  debit: Montant;
  credit: Montant;
  codesTaxe: string[];
  /** Solde du compte après cette ligne, débiteur positif. */
  soldeProgressif: Montant;
  sens: SensSolde;
  /** Code de lettrage, ou `null` si la ligne ne porte pas de marque en vigueur. */
  lettrage: string | null;
  /**
   * Ce qui reste à rapprocher sur cette ligne.
   *
   * Nul pour une ligne entièrement lettrée ou jamais entamée. Un à-compte laisse un reste : c'est ce
   * reste, et non la seule absence de marque, qui dit ce qui est encore dû sans règlement.
   */
  resteALettrer: Montant;
  /** La ligne porte une marque qui ne la solde pas : un règlement partiel l'a entamée. */
  lettragePartiel: boolean;
  /** Relevé qui a pointé cette ligne, ou `null`. */
  pointage: string | null;
  /** La ligne vient d'un exercice clos : elle ne bougera plus. */
  exerciceClos: boolean;
}

/** Un exercice, résumé pour ce compte : c'est la comparaison d'exercices. */
/** Le sens d'un solde, en français : la valeur technique ne doit pas se lire telle quelle. */
export function formaterSens(sens: SensSolde): string {
  return sens === "debiteur" ? "débiteur" : "créditeur";
}

export interface ReportExercice {
  exercice: number;
  dateDebut: DateCivile | null;
  dateFin: DateCivile | null;
  totalDebit: Montant;
  totalCredit: Montant;
  /** Solde à la clôture de l'exercice, débiteur positif. */
  solde: Montant;
  mouvements: number;
  clos: boolean;
}

export interface InterrogationDeCompte {
  compte: string;
  comptePrincipal: string;
  libelle: string;
  classe: string;
  groupe: string;
  tiersCode: string | null;
  du: DateCivile | null;
  au: DateCivile | null;
  /** Exercices couverts par l'interrogation, dans l'ordre. */
  exercices: number[];
  /** Solde à l'ouverture de la fenêtre : tout ce qui précède, à-nouveaux compris. */
  soldeInitial: Montant;
  sensInitial: SensSolde;
  /** Part du solde initial qui vient du solde inscrit au plan (rare, et la clôture le refuse). */
  soldeDuPlan: Montant;
  lignes: LigneInterrogation[];
  totalDebit: Montant;
  totalCredit: Montant;
  soldeFinal: Montant;
  sensFinal: SensSolde;
  /** Ce qui reste à lettrer dans la fenêtre, pour un compte de tiers. */
  nonLettre: Montant;
  /** Ce que le rapprochement bancaire n'a pas encore pointé, pour un compte de trésorerie. */
  nonPointe: Montant;
  reports: ReportExercice[];
  avertissements: string[];
}

export interface ContexteInterrogation {
  /** Lettrages du dossier, y compris ceux qui ont été défaits. */
  lettrages?: readonly Lettrage[];
  releves?: readonly ReleveBancaire[];
  pointages?: readonly Pointage[];
  exercicesClos?: readonly ExerciceClosSommaire[];
  /** Devise du dossier : les montants cités dans un avertissement sont formatés, pas crus. */
  devise: Devise;
  /** Exercice du dossier, pour borner l'interrogation par défaut. */
  exerciceCourant: number;
  /** Bornes des exercices connus, pour dater les reports. */
  bornes?: Record<number, { dateDebut: DateCivile; dateFin: DateCivile }>;
}

/** Codes de lettrage en vigueur, par ligne de grand livre. */
function lettragesParLigne(lettrages: readonly Lettrage[]): Map<string, string> {
  const parLigne = new Map<string, string>();
  for (const lettrage of lettrages) {
    if (lettrage.defaitLe !== null) {
      continue;
    }
    for (const ligneId of lettrage.lignes) {
      parLigne.set(ligneId, lettrage.code);
    }
  }
  return parLigne;
}

/** Relevés qui ont pointé chaque ligne, par ligne de grand livre. */
function pointagesParLigne(
  pointages: readonly Pointage[],
  releves: readonly ReleveBancaire[]
): Map<string, string> {
  const parLigne = new Map<string, string>();
  const parId = new Map(releves.map((releve) => [releve.id, releve] as const));
  for (const pointage of pointages) {
    if (pointage.defaitLe !== null) {
      continue;
    }
    const releve = parId.get(pointage.releveId);
    parLigne.set(pointage.mouvement, releve ? releve.libelle : pointage.releveId);
  }
  return parLigne;
}

/**
 * Interroge un compte sur une fenêtre.
 *
 * Le compte peut être demandé segmenté (`401100-FOU01`) : l'interrogation porte alors sur ce segment
 * seul, ce qui est la question posée quand on appelle un fournisseur. Demandé principal (`401100`),
 * elle rassemble tous les segments, comme la balance.
 */
export function interrogerCompte(
  mouvements: readonly Mouvement[],
  compte: Compte,
  demande: DemandeInterrogation,
  contexte: ContexteInterrogation
): InterrogationDeCompte {
  const principal = comptePrincipalDe(demande.compte);
  const demandeTiers = demande.tiersCode?.trim().toUpperCase() || null;
  // Un numéro segmenté porte son tiers : `401100-FOU01` interroge FOU01, même sans filtre explicite.
  const tiersDuNumero = demande.compte.includes("-") ? demande.compte.split("-").slice(1).join("-") : "";
  const tiers = demandeTiers ?? (tiersDuNumero === "" ? null : tiersDuNumero.toUpperCase());

  const exercicesClos = new Set((contexte.exercicesClos ?? []).map((clos) => clos.exercice.annee));
  const exerciceDemande = demande.exercice ?? contexte.exerciceCourant;
  const exercicesVoulus = new Set<number>([exerciceDemande]);
  if (demande.inclureExercicePrecedent) {
    exercicesVoulus.add(exerciceDemande - 1);
  }

  const duCompte = mouvements.filter((mouvement) => comptePrincipalDe(mouvement.compte) === principal);
  const correspond = (mouvement: Mouvement): boolean => {
    if (demande.journalCode && mouvement.journalCode !== demande.journalCode.toUpperCase()) {
      return false;
    }
    if (tiers !== null && mouvement.tiersCode !== tiers) {
      return false;
    }
    return true;
  };

  const duCompteFiltre = duCompte.filter(correspond);
  const dansLaFenetre = duCompteFiltre.filter((mouvement) => {
    if (!exercicesVoulus.has(mouvement.exercice)) {
      return false;
    }
    if (demande.du && mouvement.date < demande.du) {
      return false;
    }
    if (demande.au && mouvement.date > demande.au) {
      return false;
    }
    return true;
  });

  // Le solde d'ouverture de la fenêtre : le solde inscrit au plan, plus tout ce qui précède — tous
  // exercices compris, pas seulement ceux de la fenêtre. Un solde progressif qui partirait de zéro ne
  // correspondrait à rien de connu.
  const avant = duCompteFiltre.filter((mouvement) => {
    if (demande.du) {
      return mouvement.date < demande.du;
    }
    // Sans date de début, la fenêtre s'ouvre au premier jour du plus ancien exercice demandé.
    const plusAncien = Math.min(...exercicesVoulus);
    return mouvement.exercice < plusAncien;
  });
  const soldeDuPlan = compte.soldeInitial;
  const soldeInitial = additionner(
    soldeDuPlan,
    ...avant.map((mouvement) => mouvement.debit - mouvement.credit)
  );

  dansLaFenetre.sort(
    (gauche, droite) =>
      gauche.date.localeCompare(droite.date) ||
      gauche.piece.localeCompare(droite.piece) ||
      gauche.ligneId.localeCompare(droite.ligneId)
  );

  const marques = contexte.lettrages ?? [];
  const parLigneLettrage = lettragesParLigne(marques);
  const parLignePointage = pointagesParLigne(contexte.pointages ?? [], contexte.releves ?? []);

  let solde = soldeInitial;
  const lignes: LigneInterrogation[] = dansLaFenetre.map((mouvement) => {
    solde = solde + mouvement.debit - mouvement.credit;
    return {
      ligneId: mouvement.ligneId,
      exercice: mouvement.exercice,
      periode: mouvement.periode,
      date: mouvement.date,
      piece: mouvement.piece,
      journalCode: mouvement.journalCode,
      lotNumero: mouvement.lotNumero,
      libelle: mouvement.libelle,
      tiersCode: mouvement.tiersCode,
      debit: mouvement.debit,
      credit: mouvement.credit,
      codesTaxe: [...mouvement.codesTaxe],
      soldeProgressif: solde,
      sens: sensDe(solde),
      lettrage: parLigneLettrage.get(mouvement.ligneId) ?? null,
      resteALettrer: resteDeLigne(mouvement, marques),
      lettragePartiel: etatDeLettrage(mouvement, marques) === "partielle",
      pointage: parLignePointage.get(mouvement.ligneId) ?? null,
      exerciceClos: exercicesClos.has(mouvement.exercice)
    };
  });

  const totalDebit = additionner(...lignes.map((ligne) => ligne.debit));
  const totalCredit = additionner(...lignes.map((ligne) => ligne.credit));
  const soldeFinal = solde;
  // Ce qui reste à lettrer, pas ce qui n'a jamais été lettré : une ligne entamée par un à-compte
  // porte une marque et reste due pour son solde.
  const nonLettre = additionner(
    ...lignes.map((ligne) => (ligne.debit !== ZERO ? ligne.resteALettrer : -ligne.resteALettrer))
  );
  const nonPointe = additionner(
    ...lignes.filter((ligne) => ligne.pointage === null).map((ligne) => ligne.debit - ligne.credit)
  );

  // La comparaison d'exercices porte sur tous les exercices où ce compte a bougé, plus ceux demandés :
  // un exercice sans mouvement est une information, pas un trou à masquer.
  const exercicesVus = new Set<number>([...exercicesVoulus, ...duCompteFiltre.map((mouvement) => mouvement.exercice)]);
  const reports: ReportExercice[] = [...exercicesVus]
    .sort((gauche, droite) => gauche - droite)
    .map((exercice) => {
      const duExercice = duCompteFiltre.filter((mouvement) => mouvement.exercice === exercice);
      const debut = duExercice
        .map((mouvement) => mouvement.date)
        .sort((gauche, droite) => gauche.localeCompare(droite))[0];
      const fin = duExercice
        .map((mouvement) => mouvement.date)
        .sort((gauche, droite) => droite.localeCompare(gauche))[0];
      // Le solde de fin d'exercice cumule tout ce qui précède : c'est ce qui se reporte.
      const cumul = additionner(
        soldeDuPlan,
        ...duCompteFiltre
          .filter((mouvement) => mouvement.exercice <= exercice)
          .map((mouvement) => mouvement.debit - mouvement.credit)
      );
      const bornes = contexte.bornes?.[exercice];
      return {
        exercice,
        dateDebut: bornes?.dateDebut ?? (debut ?? null),
        dateFin: bornes?.dateFin ?? (fin ?? null),
        totalDebit: additionner(...duExercice.map((mouvement) => mouvement.debit)),
        totalCredit: additionner(...duExercice.map((mouvement) => mouvement.credit)),
        solde: cumul,
        mouvements: duExercice.length,
        clos: exercicesClos.has(exercice)
      };
    });

  const avertissements: string[] = [];
  if (lignes.length === 0) {
    avertissements.push(
      `Néant : aucun mouvement sur ${principal}${tiers ? ` · ${tiers}` : ""} pour cette fenêtre.`
    );
  }
  if (!compte.actif) {
    avertissements.push(`Le compte ${principal} est désactivé : il n'accepte plus de saisie.`);
  }
  if (soldeDuPlan !== ZERO) {
    avertissements.push(
      `Le plan porte un solde initial de ${formatMontant(
        soldeDuPlan,
        contexte.devise
      )} sur ce compte : il entre dans le solde d'ouverture. Les à-nouveaux passent normalement par un lot, et la clôture d'exercice refuse un plan qui porte des soldes.`
    );
  }
  if (lignes.some((ligne) => ligne.exerciceClos)) {
    const closVus = [...new Set(lignes.filter((ligne) => ligne.exerciceClos).map((ligne) => ligne.exercice))];
    avertissements.push(
      `${lignes.filter((ligne) => ligne.exerciceClos).length} ligne(s) proviennent d'un exercice clos (${closVus.join(
        ", "
      )}) : elles ne bougeront plus, toute correction passe par l'exercice en cours.`
    );
  }
  if (tiers === null && compte.exigeTiers) {
    avertissements.push(
      `Le compte ${principal} est auxiliaire : interrogé sans tiers, il rassemble tous les segments. Choisissez un tiers pour un relevé de compte.`
    );
  }
  if (demande.du && demande.au && demande.du > demande.au) {
    avertissements.push(
      `La fenêtre demandée se termine le ${formaterDateFr(demande.au)} avant de commencer le ${formaterDateFr(
        demande.du
      )} : aucun mouvement ne peut y entrer.`
    );
  }

  return {
    compte: demande.compte,
    comptePrincipal: principal,
    libelle: compte.libelle,
    classe: compte.classe,
    groupe: compte.groupe,
    tiersCode: tiers,
    du: demande.du ?? null,
    au: demande.au ?? null,
    exercices: reports.map((report) => report.exercice),
    soldeInitial,
    sensInitial: sensDe(soldeInitial),
    soldeDuPlan,
    lignes,
    totalDebit,
    totalCredit,
    soldeFinal,
    sensFinal: sensDe(soldeFinal),
    nonLettre,
    nonPointe,
    reports,
    avertissements
  };
}

/**
 * Les comptes qui ont bougé, avec leur solde : c'est la liste de départ d'une interrogation.
 *
 * Un utilisateur qui cherche un compte ne connaît pas toujours son numéro ; il connaît son solde, ou
 * le fait qu'il a bougé. Cette lecture répond aux deux.
 */
export interface CompteInterrogeable {
  compte: string;
  libelle: string;
  groupe: string;
  mouvements: number;
  solde: Montant;
  /** Tiers vus sur ce compte : c'est la liste des segments à interroger. */
  tiers: string[];
}

export function comptesInterrogeables(
  mouvements: readonly Mouvement[],
  comptes: readonly Compte[],
  filtre: FiltreMouvements = {}
): CompteInterrogeable[] {
  const parCompte = new Map<string, { mouvements: number; solde: Montant; tiers: Set<string> }>();
  for (const mouvement of mouvements) {
    if (filtre.exercice !== undefined && mouvement.exercice !== filtre.exercice) {
      continue;
    }
    if (filtre.du && mouvement.date < filtre.du) {
      continue;
    }
    if (filtre.au && mouvement.date > filtre.au) {
      continue;
    }
    const principal = comptePrincipalDe(mouvement.compte);
    const entree = parCompte.get(principal) ?? { mouvements: 0, solde: ZERO, tiers: new Set<string>() };
    entree.mouvements += 1;
    entree.solde += mouvement.debit - mouvement.credit;
    if (mouvement.tiersCode) {
      entree.tiers.add(mouvement.tiersCode);
    }
    parCompte.set(principal, entree);
  }

  return comptes
    .filter((compte) => parCompte.has(compte.comptePrincipal))
    .map((compte) => {
      const entree = parCompte.get(compte.comptePrincipal)!;
      return {
        compte: compte.comptePrincipal,
        libelle: compte.libelle,
        groupe: compte.groupe,
        mouvements: entree.mouvements,
        solde: entree.solde,
        tiers: [...entree.tiers].sort()
      };
    })
    .sort((gauche, droite) => gauche.compte.localeCompare(droite.compte));
}
