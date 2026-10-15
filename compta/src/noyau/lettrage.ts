/**
 * Lettrage des comptes de tiers.
 *
 * Le lettrage est la marque qui dit qu'une facture et son règlement se correspondent. Chez Sage,
 * c'est un code de deux lettres porté sur les lignes du grand livre ; c'est aussi la seule façon de
 * connaître le solde **échu** d'un tiers, distinct de son solde comptable.
 *
 * Deux règles structurent ce module :
 *
 * 1. **Un groupe lettré est équilibré.** La somme des débits égale la somme des crédits, au centime
 *    près. Un lettrage qui ne tombe pas juste n'est pas un lettrage approximatif : c'est une erreur,
 *    et elle est refusée plutôt que tolérée.
 * 2. **Un délettrage ne supprime rien.** La marque passée reste lisible, avec sa date de défection :
 *    l'historique d'un compte de tiers doit pouvoir être reconstitué.
 *
 * Ce qui n'est pas produit : le lettrage partiel (un règlement qui ne couvre qu'une partie d'une
 * facture). Il suppose un suivi des imputations ligne à ligne, et l'annoncer sans le faire serait
 * pire que de ne pas l'annoncer.
 */

import { ErreurRegle, ZERO, formatMontant, type Devise, type Montant } from "./montants";
import { comptePrincipalDe, type Mouvement } from "./grand-livre";
import type { DateCivile } from "./calendrier";

/** Marque de lettrage : un code, les lignes qu'il rapproche, et son devenir. */
export interface Lettrage {
  /** Code de lettrage — « AA », « AB », … puis « AAA » au-delà. Attribué par le dossier. */
  code: string;
  /** Compte principal du tiers : `401100`, même si les lignes portent `401100-FOU01`. */
  compte: string;
  tiersCode: string | null;
  /** Identifiants des lignes de grand livre lettrées. */
  lignes: string[];
  /** Montant lettré : total des débits du groupe, égal au total de ses crédits. */
  montant: Montant;
  /** Date de l'opération de lettrage. */
  date: DateCivile;
  acteur: string;
  horodate: string;
  /** Date de délettrage, ou `null` tant que la marque tient. */
  defaitLe: string | null;
}

/** Un groupe proposé au lettrage, avant que l'utilisateur ou le dossier ne l'accepte. */
export interface PropositionLettrage {
  lignes: string[];
  montant: Montant;
  /** « exact » : un débit pour un crédit. « compose » : plusieurs lignes d'un même sens. */
  nature: "exact" | "compose";
  dateLaPlusAncienne: DateCivile;
  pieces: string[];
}

export interface CritereDeLettrage {
  compte: string;
  tiersCode?: string | null;
  du?: DateCivile;
  au?: DateCivile;
}

export interface FiltreLignesALettrer extends CritereDeLettrage {
  /** Ne retenir que les lignes dont l'échéance est dépassée à cette date. */
  echeanceAu?: DateCivile;
}

/** Lignes déjà lettrées par une marque encore en vigueur. */
export function lignesLettrees(lettrages: readonly Lettrage[]): Set<string> {
  const lettres = new Set<string>();
  for (const lettrage of lettrages) {
    if (lettrage.defaitLe === null) {
      for (const ligne of lettrage.lignes) {
        lettres.add(ligne);
      }
    }
  }
  return lettres;
}

/** Code de lettrage suivant : AA … ZZ, puis AAA … ZZZ. Au-delà, l'opération est refusée. */
export function codeDeLettrageSuivant(lettrages: readonly Lettrage[]): string {
  const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  // Un code déjà attribué ne se réutilise pas, même après délettrage : la marque reste dans
  // l'historique du compte, et deux marques homonymes rendraient cet historique illisible.
  const utilises = new Set(lettrages.map((lettrage) => lettrage.code));
  for (const premier of lettres) {
    for (const second of lettres) {
      const code = `${premier}${second}`;
      if (!utilises.has(code)) {
        return code;
      }
    }
  }
  for (const premier of lettres) {
    for (const second of lettres) {
      for (const troisieme of lettres) {
        const code = `${premier}${second}${troisieme}`;
        if (!utilises.has(code)) {
          return code;
        }
      }
    }
  }
  throw new ErreurRegle(
    "Tous les codes de lettrage sont attribués. Délettrez des marques anciennes avant d'en créer de nouvelles."
  );
}

/**
 * Lignes candidates au lettrage sur un compte de tiers.
 *
 * Une ligne candidate est une ligne non lettrée, du compte demandé (segment tiers compris), dans la
 * plage de dates retenue. Les lignes à zéro sont écartées : elles ne rapprochent rien.
 */
export function mouvementsALettrer(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  critere: CritereDeLettrage
): Mouvement[] {
  const lettres = lignesLettrees(lettrages);
  const compte = comptePrincipalDe(critere.compte);
  const tiersCode = critere.tiersCode ?? null;

  return mouvements
    .filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte)
    .filter((mouvement) => (tiersCode === null ? true : mouvement.tiersCode === tiersCode))
    .filter((mouvement) => (critere.du === undefined ? true : mouvement.date >= critere.du))
    .filter((mouvement) => (critere.au === undefined ? true : mouvement.date <= critere.au))
    .filter((mouvement) => mouvement.debit !== ZERO || mouvement.credit !== ZERO)
    .filter((mouvement) => !lettres.has(mouvement.ligneId))
    .sort(comparerLignesALettrer);
}

/** Ordre de présentation : date, puis pièce, puis sens. Déterministe, donc reproductible. */
export function comparerLignesALettrer(a: Mouvement, b: Mouvement): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1;
  }
  if (a.piece !== b.piece) {
    return a.piece < b.piece ? -1 : 1;
  }
  if (a.ligneId !== b.ligneId) {
    return a.ligneId < b.ligneId ? -1 : 1;
  }
  return 0;
}

const montantDe = (mouvement: Mouvement): Montant =>
  mouvement.debit !== ZERO ? mouvement.debit : mouvement.credit;

const estDebit = (mouvement: Mouvement): boolean => mouvement.debit !== ZERO;

/**
 * Vérifie qu'un groupe de lignes peut être lettré.
 *
 * Refusé : un groupe vide, une seule ligne (rien à rapprocher), un groupe qui ne contient qu'un
 * seul sens, et surtout un groupe dont les débits ne somment pas les crédits.
 */
export function verifierGroupeALettrer(
  groupe: readonly Mouvement[],
  devise: Devise
): { montant: Montant; totalDebit: Montant; totalCredit: Montant } {
  if (groupe.length < 2) {
    throw new ErreurRegle(
      `Le lettrage rapproche au moins deux lignes : ${groupe.length} ligne${groupe.length > 1 ? "s" : ""} demandée${
        groupe.length > 1 ? "s" : ""
      }.`
    );
  }

  const totalDebit = groupe.reduce<Montant>((total, mouvement) => total + mouvement.debit, ZERO);
  const totalCredit = groupe.reduce<Montant>((total, mouvement) => total + mouvement.credit, ZERO);

  if (totalDebit === ZERO || totalCredit === ZERO) {
    throw new ErreurRegle(
      `Le groupe ne contient que des ${
        totalCredit === ZERO ? "débits" : "crédits"
      } : un lettrage rapproche une dette et son règlement.`
    );
  }
  if (totalDebit !== totalCredit) {
    throw new ErreurRegle(
      `Le groupe n'est pas équilibré : débit ${formatMontant(totalDebit, devise)}, crédit ${formatMontant(
        totalCredit,
        devise
      )}, écart ${formatMontant(totalDebit - totalCredit, devise)}. Un lettrage partiel n'est pas produit : retirez une ligne, ou lettrez-la avec son complément.`
    );
  }
  return { montant: totalDebit, totalDebit, totalCredit };
}

/**
 * Lettrage automatique : rapproche les lignes de même montant.
 *
 * La recherche est bornée et déterministe — un débit contre un crédit d'abord, puis un débit contre
 * deux ou trois crédits, puis l'inverse. Au-delà, les combinaisons explosent et un utilisateur ne
 * peut plus vérifier ce qu'on lui propose : ce qui n'est pas rapproché reste à lettrer à la main.
 */
export function proposerLettrageAutomatique(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  critere: CritereDeLettrage,
  options?: { tailleMaximaleDuGroupe?: number }
): PropositionLettrage[] {
  const taille = Math.max(2, options?.tailleMaximaleDuGroupe ?? 4);
  const candidats = mouvementsALettrer(mouvements, lettrages, critere);
  const debits = candidats.filter(estDebit);
  const credits = candidats.filter((mouvement) => !estDebit(mouvement));

  const pris = new Set<string>();
  const propositions: PropositionLettrage[] = [];

  const proposer = (groupe: readonly Mouvement[], nature: "exact" | "compose"): void => {
    for (const mouvement of groupe) {
      pris.add(mouvement.ligneId);
    }
    propositions.push({
      lignes: groupe.map((mouvement) => mouvement.ligneId),
      // Le groupe est équilibré par construction : le montant lettré est celui du sens débiteur,
      // ou celui du sens créditeur quand le groupe ne contient que des crédits face à un débit.
      montant: groupe.reduce<Montant>(
        (total, mouvement) => total + (estDebit(mouvement) ? mouvement.debit : ZERO),
        ZERO
      ) ||
        groupe.reduce<Montant>((total, mouvement) => total + montantDe(mouvement), ZERO) / 2n,
      nature,
      dateLaPlusAncienne: groupe.reduce(
        (plusAncienne, mouvement) => (mouvement.date < plusAncienne ? mouvement.date : plusAncienne),
        groupe[0]!.date
      ),
      pieces: [...new Set(groupe.map((mouvement) => mouvement.piece))].sort()
    });
  };

  // 1. Un débit pour un crédit de même montant : le cas ordinaire, une facture et son règlement.
  for (const debit of debits) {
    if (pris.has(debit.ligneId)) {
      continue;
    }
    const contrepartie = credits.find(
      (credit) => !pris.has(credit.ligneId) && montantDe(credit) === montantDe(debit)
    );
    if (contrepartie) {
      proposer([debit, contrepartie], "exact");
    }
  }

  // 2. Un débit contre plusieurs crédits, puis l'inverse : un règlement groupé, plusieurs acomptes.
  for (const sens of ["debit", "credit"] as const) {
    const principales = sens === "debit" ? debits : credits;
    const complementaires = sens === "debit" ? credits : debits;
    for (const principale of principales) {
      if (pris.has(principale.ligneId)) {
        continue;
      }
      const cible = montantDe(principale);
      const disponibles = complementaires.filter((mouvement) => !pris.has(mouvement.ligneId));
      const combinaison = chercherCombinaison(disponibles, cible, taille - 1);
      if (combinaison) {
        proposer([principale, ...combinaison], "compose");
      }
    }
  }

  return propositions;
}

/**
 * Cherche un sous-ensemble de lignes dont les montants somment exactement la cible.
 *
 * Récursion bornée par `tailleMaximale`, sur des lignes triées : le résultat ne dépend pas de
 * l'ordre d'arrivée des mouvements, et un compte de tiers très mouvementé ne fige pas l'écran.
 */
export function chercherCombinaison(
  lignes: readonly Mouvement[],
  cible: Montant,
  tailleMaximale: number
): Mouvement[] | null {
  if (tailleMaximale < 1 || cible <= ZERO) {
    return null;
  }
  const triees = [...lignes].sort((a, b) => (montantDe(a) < montantDe(b) ? -1 : montantDe(a) > montantDe(b) ? 1 : 0));

  const chercher = (index: number, reste: Montant, acc: Mouvement[]): Mouvement[] | null => {
    if (reste === ZERO && acc.length > 0) {
      return [...acc];
    }
    if (acc.length >= tailleMaximale) {
      return null;
    }
    for (let i = index; i < triees.length; i += 1) {
      const mouvement = triees[i]!;
      const montant = montantDe(mouvement);
      if (montant > reste) {
        // Les lignes sont triées par montant croissant : aucune des suivantes ne peut convenir.
        return null;
      }
      const trouve = chercher(i + 1, reste - montant, [...acc, mouvement]);
      if (trouve) {
        return trouve;
      }
    }
    return null;
  };

  return chercher(0, cible, []);
}

/** Situation d'un compte de tiers : ce qui est lettré, ce qui ne l'est pas, et depuis quand. */
export interface SituationDeLettrage {
  compte: string;
  tiersCode: string | null;
  totalDebit: Montant;
  totalCredit: Montant;
  solde: Montant;
  lettre: Montant;
  nonLettre: Montant;
  lignesALettrer: number;
  lettrages: number;
  /** Plus ancienne échéance non lettrée — ce que regarde un trésorier avant le solde. */
  plusAncienneLigne: DateCivile | null;
}

/**
 * Situation du lettrage, compte par compte de tiers.
 *
 * Le solde comptable et le solde non lettré sont deux nombres distincts : le premier dit ce qui est
 * dû, le second ce qui est dû **sans qu'aucun règlement ne l'explique**. Les confondre revient à
 * perdre l'information que le lettrage apporte.
 */
export function situationsDeLettrage(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  options?: { du?: DateCivile; au?: DateCivile }
): SituationDeLettrage[] {
  const lettres = lignesLettrees(lettrages);
  const parCle = new Map<string, SituationDeLettrage>();

  const enVigueur = lettrages.filter((lettrage) => lettrage.defaitLe === null);

  for (const mouvement of mouvements) {
    if (mouvement.tiersCode === null) {
      continue;
    }
    if (options?.du !== undefined && mouvement.date < options.du) {
      continue;
    }
    if (options?.au !== undefined && mouvement.date > options.au) {
      continue;
    }
    const compte = comptePrincipalDe(mouvement.compte);
    const cle = `${compte}|${mouvement.tiersCode}`;
    let situation = parCle.get(cle);
    if (!situation) {
      situation = {
        compte,
        tiersCode: mouvement.tiersCode,
        totalDebit: ZERO,
        totalCredit: ZERO,
        solde: ZERO,
        lettre: ZERO,
        nonLettre: ZERO,
        lignesALettrer: 0,
        lettrages: 0,
        plusAncienneLigne: null
      };
      parCle.set(cle, situation);
    }

    situation.totalDebit += mouvement.debit;
    situation.totalCredit += mouvement.credit;
    situation.solde = situation.totalDebit - situation.totalCredit;

    if (lettres.has(mouvement.ligneId)) {
      situation.lettre += mouvement.debit !== ZERO ? mouvement.debit : mouvement.credit;
    } else if (mouvement.debit !== ZERO || mouvement.credit !== ZERO) {
      situation.lignesALettrer += 1;
      const montant = montantDe(mouvement);
      situation.nonLettre += montant;
      if (situation.plusAncienneLigne === null || mouvement.date < situation.plusAncienneLigne) {
        situation.plusAncienneLigne = mouvement.date;
      }
    }
  }

  for (const lettrage of enVigueur) {
    const cle = `${comptePrincipalDe(lettrage.compte)}|${lettrage.tiersCode ?? ""}`;
    const situation = parCle.get(cle);
    if (situation) {
      situation.lettrages += 1;
    }
  }

  return [...parCle.values()].sort((a, b) =>
    a.compte === b.compte
      ? (a.tiersCode ?? "") < (b.tiersCode ?? "")
        ? -1
        : 1
      : a.compte < b.compte
        ? -1
        : 1
  );
}
