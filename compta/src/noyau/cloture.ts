/**
 * Clôture d'exercice — le « Create New Year » de Sage.
 *
 * Clôturer un exercice, ce sont deux écritures et un calendrier :
 *
 * 1. **Le solde des comptes de gestion.** Chaque compte de produit et de charge est ramené à zéro,
 *    la contrepartie étant le compte 121000 — Résultat de l'exercice. Après cette écriture, plus
 *    aucun compte de gestion ne porte de solde : le bilan n'a plus besoin de les résumer.
 * 2. **Les à-nouveaux de l'exercice suivant.** Chaque compte de bilan dont le solde n'est pas nul est
 *    reporté, segment de tiers compris, au premier jour du nouvel exercice.
 * 3. **Le nouvel exercice**, avec ses périodes ouvertes, et l'ancien archivé avec toutes ses
 *    périodes clôturées.
 *
 * La préparation est séparée de l'exécution : `preparerCloture` ne produit aucune écriture, il dit ce
 * qui serait écrit et ce qui s'y oppose. Une clôture qu'on ne peut pas examiner avant de la lancer
 * n'est pas vérifiable — et elle est définitive.
 */

import { ErreurRegle, ZERO, additionner, formatMontant, oppose, type Devise, type Montant } from "./montants";
import {
  comptePrincipalDe,
  construireBalance,
  verifierEquilibre,
  type LigneBalance,
  type Mouvement
} from "./grand-livre";
import { formaterDateFr, type DateCivile, type Exercice, type Periode } from "./calendrier";
import { composerNumero, type Compte, type GroupeDeComptes, type StructureDeComptes } from "./comptes";
import type { EtatLot, Lot } from "./lots";

/** Une ligne que la clôture écrirait. Même forme qu'une demande de saisie, montants exacts. */
export interface LignePrevue {
  /** Numéro complet, segment de tiers compris : les à-nouveaux conservent le détail par tiers. */
  compte: string;
  tiersCode: string | null;
  libelle: string;
  debit: Montant;
  credit: Montant;
}

/** Solde d'un compte segmenté — un compte et son tiers, tels que le grand livre les porte. */
export interface SoldeSegment {
  compte: string;
  tiersCode: string | null;
  debit: Montant;
  credit: Montant;
  solde: Montant;
}

export interface DemandeDePreparation {
  exercice: Exercice;
  mouvements: readonly Mouvement[];
  comptes: readonly Compte[];
  groupes: readonly GroupeDeComptes[];
  lots: readonly Lot[];
  /** Structure de numérotation : elle sert à recomposer un numéro segmenté dans les à-nouveaux. */
  structure: StructureDeComptes;
  /** Compte du résultat de l'exercice — 121000 dans le plan SYSCOHADA révisé. */
  compteDeResultat: string;
  devise: Devise;
  /** Exercices déjà clos du dossier : une seconde clôture du même exercice est refusée. */
  exercicesClos?: readonly number[];
}

export interface RapportDeCloture {
  exercice: number;
  dateCloture: DateCivile;
  /** Période supplémentaire qui reçoit l'écriture de clôture. */
  periodeDeCloture: Periode | null;
  /** Numéros des périodes normales et d'ajustement encore ouvertes. */
  periodesOuvertes: number[];
  lotsEnAttente: { numero: string; journalCode: string; etat: EtatLot; date: DateCivile }[];
  /** Comptes du plan portant un solde initial : il doit passer par un lot d'à-nouveaux. */
  soldesInitiauxDuPlan: string[];
  equilibreGrandLivre: boolean;
  mouvementsDeLexercice: number;
  /** Résultat de l'exercice, positif pour un bénéfice. */
  resultat: Montant;
  /** Écriture de solde des comptes de gestion. */
  lignesDeCloture: LignePrevue[];
  /** Écriture d'à-nouveaux du nouvel exercice. */
  lignesDANouveaux: LignePrevue[];
  /** Soldes hors bilan (engagements) : ils ne se reportent pas, ils se ressaisissent. */
  comptesHorsEtat: SoldeSegment[];
  /** Somme des soldes débiteurs des comptes de bilan — la masse de l'actif. */
  totalActif: Montant;
  /** Somme des soldes créditeurs des comptes de bilan — la masse du passif. */
  totalPassif: Montant;
  /** Ce qui interdit la clôture, dans l'ordre où il faut le corriger. */
  obstacles: string[];
  /** Ce qui ne l'interdit pas mais doit se savoir. */
  avertissements: string[];
  prete: boolean;
}

/**
 * Solde de chaque compte segmenté de l'exercice.
 *
 * La balance regroupe les segments sur leur compte principal, ce qui est juste pour un état et faux
 * pour des à-nouveaux : reporter 401100 sans ses tiers ferait perdre le détail que le lettrage
 * exploite. Le regroupement se fait sur le compte principal et le tiers, puis le numéro est
 * recomposé dans la forme du référentiel : un mouvement saisi « 401100 » avec le tiers FOU01 et un
 * mouvement saisi « 401100-FOU01 » sont le même segment.
 */
export function soldesSegmentes(
  mouvements: readonly Mouvement[],
  structure?: StructureDeComptes
): SoldeSegment[] {
  const parCle = new Map<string, SoldeSegment>();
  for (const mouvement of mouvements) {
    const principal = comptePrincipalDe(mouvement.compte);
    const cle = `${principal}|${mouvement.tiersCode ?? ""}`;
    let solde = parCle.get(cle);
    if (!solde) {
      solde = {
        compte: structure
          ? composerNumero(principal, structure, mouvement.tiersCode)
          : mouvement.compte,
        tiersCode: mouvement.tiersCode,
        debit: ZERO,
        credit: ZERO,
        solde: ZERO
      };
      parCle.set(cle, solde);
    }
    solde.debit += mouvement.debit;
    solde.credit += mouvement.credit;
    solde.solde = solde.debit - solde.credit;
  }
  return [...parCle.values()];
}

/**
 * Prépare la clôture : examine l'exercice, dit ce qui serait écrit, liste ce qui s'y oppose.
 *
 * Rien n'est écrit. C'est la même règle que pour le lettrage automatique : la proposition précède
 * l'écriture.
 */
export function preparerCloture(demande: DemandeDePreparation): RapportDeCloture {
  const { exercice, mouvements, comptes, groupes, lots, compteDeResultat, devise } = demande;
  const exercicesClos = demande.exercicesClos ?? [];

  const mouvementsDeLexercice = mouvements.filter((mouvement) => mouvement.exercice === exercice.annee);
  const periodesOuvertes = exercice.periodes
    .filter((periode) => periode.type !== "cloture" && !periode.clots)
    .map((periode) => periode.numero);
  const periodeDeCloture = exercice.periodes.find((periode) => periode.type === "cloture") ?? null;

  const lotsEnAttente = lots
    .filter((lot) => lot.date >= exercice.dateDebut && lot.date <= exercice.dateFin)
    .filter((lot) => lot.etat === "ouvert" || lot.etat === "pret")
    .map((lot) => ({ numero: lot.numero, journalCode: lot.journalCode, etat: lot.etat, date: lot.date }));

  const soldesInitiauxDuPlan = comptes
    .filter((compte) => compte.soldeInitial !== ZERO)
    .map((compte) => compte.numero);

  const etatDuGroupe = (code: string): string =>
    groupes.find((groupe) => groupe.code === code)?.etat ?? "hors-etat";
  const groupeDeCompte = (numero: string): string => {
    const principal = comptePrincipalDe(numero);
    return comptes.find((compte) => compte.numero === principal)?.groupe ?? "";
  };
  const libelleDeCompte = (numero: string): string => {
    const principal = comptePrincipalDe(numero);
    return comptes.find((compte) => compte.numero === principal)?.libelle ?? principal;
  };

  const equilibre = verifierEquilibre(mouvementsDeLexercice);
  const balance = construireBalance(mouvementsDeLexercice, comptes, {});

  // ---------------------------------------------------------------- comptes de gestion
  const lignesDeGestion = balance.filter(
    (ligne: LigneBalance) => etatDuGroupe(ligne.groupe) === "resultat" && ligne.solde !== ZERO
  );
  // Le solde d'une ligne de balance est débiteur positif : un produit est donc un solde négatif.
  const resultat = additionner(...lignesDeGestion.map((ligne) => oppose(ligne.solde)));

  const lignesDeCloture: LignePrevue[] = lignesDeGestion.map((ligne) => ({
    compte: ligne.compte,
    tiersCode: null,
    libelle: `Clôture — solde de ${ligne.libelle}`,
    debit: ligne.solde < ZERO ? oppose(ligne.solde) : ZERO,
    credit: ligne.solde > ZERO ? ligne.solde : ZERO
  }));
  if (resultat !== ZERO) {
    lignesDeCloture.push({
      compte: compteDeResultat,
      tiersCode: null,
      libelle: resultat > ZERO ? "Clôture — résultat de l'exercice" : "Clôture — perte de l'exercice",
      debit: resultat < ZERO ? oppose(resultat) : ZERO,
      credit: resultat > ZERO ? resultat : ZERO
    });
  }

  // ---------------------------------------------------------------- à-nouveaux
  const segments = soldesSegmentes(mouvementsDeLexercice, demande.structure);
  const lignesDANouveaux: LignePrevue[] = [];
  const comptesHorsEtat: SoldeSegment[] = [];
  let soldeDuCompteDeResultat = ZERO;

  for (const segment of segments) {
    const etat = etatDuGroupe(groupeDeCompte(segment.compte));
    if (segment.solde === ZERO) {
      continue;
    }
    if (etat === "hors-etat") {
      comptesHorsEtat.push(segment);
      continue;
    }
    if (etat !== "bilan") {
      // Un compte de gestion encore mouvementé : la clôture le solde, il ne se reporte pas.
      continue;
    }
    if (comptePrincipalDe(segment.compte) === compteDeResultat) {
      soldeDuCompteDeResultat += segment.solde;
      continue;
    }
    lignesDANouveaux.push({
      compte: segment.compte,
      tiersCode: segment.tiersCode,
      libelle: `À-nouveau — ${libelleDeCompte(segment.compte)}`,
      debit: segment.solde > ZERO ? segment.solde : ZERO,
      credit: segment.solde < ZERO ? oppose(segment.solde) : ZERO
    });
  }

  // Le compte de résultat reçoit ce que la clôture y a porté, ajouté à ce qu'il contenait déjà.
  const reporteAuResultat = soldeDuCompteDeResultat - resultat;
  if (reporteAuResultat !== ZERO) {
    lignesDANouveaux.push({
      compte: compteDeResultat,
      tiersCode: null,
      libelle: "À-nouveau — résultat de l'exercice clos",
      debit: reporteAuResultat > ZERO ? reporteAuResultat : ZERO,
      credit: reporteAuResultat < ZERO ? oppose(reporteAuResultat) : ZERO
    });
  }
  lignesDANouveaux.sort((a, b) => (a.compte === b.compte ? 0 : a.compte < b.compte ? -1 : 1));

  const totalDebitAN = additionner(...lignesDANouveaux.map((ligne) => ligne.debit));
  const totalCreditAN = additionner(...lignesDANouveaux.map((ligne) => ligne.credit));
  const totalDebitCloture = additionner(...lignesDeCloture.map((ligne) => ligne.debit));
  const totalCreditCloture = additionner(...lignesDeCloture.map((ligne) => ligne.credit));

  const totalActif = additionner(
    ...balance.filter((ligne) => etatDuGroupe(ligne.groupe) === "bilan" && ligne.solde > ZERO).map((ligne) => ligne.solde)
  );
  const totalPassif = additionner(
    ...balance
      .filter((ligne) => etatDuGroupe(ligne.groupe) === "bilan" && ligne.solde < ZERO)
      .map((ligne) => oppose(ligne.solde))
  );

  // ---------------------------------------------------------------- obstacles
  const obstacles: string[] = [];
  if (exercicesClos.includes(exercice.annee)) {
    obstacles.push(`L'exercice ${exercice.annee} est déjà clos.`);
  }
  if (!periodeDeCloture) {
    obstacles.push("L'exercice ne comporte pas de période de clôture : aucune date ne peut recevoir l'écriture.");
  } else if (periodeDeCloture.clots) {
    obstacles.push(`La période de clôture du ${formaterDateFr(periodeDeCloture.dateFin)} est déjà clôturée.`);
  }
  if (periodesOuvertes.length > 0) {
    obstacles.push(
      `Les périodes ${periodesOuvertes.join(", ")} ne sont pas clôturées. Clôturez-les avant l'exercice : une écriture passée après coup fausserait les à-nouveaux.`
    );
  }
  if (lotsEnAttente.length > 0) {
    obstacles.push(
      `${lotsEnAttente.length} lot${lotsEnAttente.length > 1 ? "s" : ""} de l'exercice ne ${
        lotsEnAttente.length > 1 ? "sont" : "est"
      } pas comptabilisé${lotsEnAttente.length > 1 ? "s" : ""} : ${lotsEnAttente
        .map((lot) => `${lot.numero} (${lot.etat})`)
        .join(", ")}.`
    );
  }
  if (!equilibre.equilibre) {
    obstacles.push(
      `Le grand livre de l'exercice n'est pas équilibré : débit ${formatMontant(
        equilibre.totalDebit,
        devise
      )}, crédit ${formatMontant(equilibre.totalCredit, devise)}.`
    );
  }
  if (soldesInitiauxDuPlan.length > 0) {
    obstacles.push(
      `Le plan porte des soldes initiaux (${soldesInitiauxDuPlan.join(", ")}). Passez-les par un lot d'à-nouveaux : un solde posé dans le plan ne se reporte pas et fausserait les à-nouveaux de l'exercice suivant.`
    );
  }
  if (totalDebitCloture !== totalCreditCloture) {
    obstacles.push(
      `L'écriture de clôture n'est pas équilibrée : écart ${formatMontant(
        totalDebitCloture - totalCreditCloture,
        devise
      )}.`
    );
  }
  if (totalDebitAN !== totalCreditAN) {
    obstacles.push(
      `Les à-nouveaux ne sont pas équilibrés : écart ${formatMontant(
        totalDebitAN - totalCreditAN,
        devise
      )}. Le bilan de l'exercice n'est pas cohérent.`
    );
  }

  // ---------------------------------------------------------------- avertissements
  const avertissements: string[] = [];
  if (comptesHorsEtat.length > 0) {
    avertissements.push(
      `${comptesHorsEtat.length} solde${comptesHorsEtat.length > 1 ? "s" : ""} hors bilan (${comptesHorsEtat
        .map((segment) => segment.compte)
        .join(", ")}) ne ${comptesHorsEtat.length > 1 ? "seront" : "sera"} pas reporté${
        comptesHorsEtat.length > 1 ? "s" : ""
      } : les engagements se ressaisissent dans le nouvel exercice.`
    );
  }
  if (resultat === ZERO) {
    avertissements.push(
      "Le résultat de l'exercice est nul : aucune ligne ne sera portée au compte 121000."
    );
  }
  if (mouvementsDeLexercice.length === 0) {
    avertissements.push("L'exercice ne contient aucun mouvement : les à-nouveaux seront vides.");
  }

  return {
    exercice: exercice.annee,
    dateCloture: periodeDeCloture?.dateFin ?? exercice.dateFin,
    periodeDeCloture,
    periodesOuvertes,
    lotsEnAttente,
    soldesInitiauxDuPlan,
    equilibreGrandLivre: equilibre.equilibre,
    mouvementsDeLexercice: mouvementsDeLexercice.length,
    resultat,
    lignesDeCloture,
    lignesDANouveaux,
    comptesHorsEtat,
    totalActif,
    totalPassif,
    obstacles,
    avertissements,
    prete: obstacles.length === 0
  };
}

/** Refuse la clôture si un obstacle subsiste, en citant tous les obstacles. */
export function verifierCloture(rapport: RapportDeCloture): void {
  if (rapport.prete) {
    return;
  }
  throw new ErreurRegle(
    `La clôture de l'exercice ${rapport.exercice} est refusée. ${rapport.obstacles.join(" ")}`
  );
}
