/**
 * Lettrage des comptes de tiers.
 *
 * Le lettrage est la marque qui dit qu'une facture et son règlement se correspondent. Chez Sage,
 * c'est un code de deux lettres porté sur les lignes du grand livre ; c'est aussi la seule façon de
 * connaître le solde **échu** d'un tiers, distinct de son solde comptable.
 *
 * Trois règles structurent ce module :
 *
 * 1. **Un groupe lettré est équilibré.** La somme des débits imputés égale la somme des crédits
 *    imputés. Un lettrage qui ne tombe pas juste n'est pas un lettrage approximatif : c'est une
 *    erreur, et elle est refusée plutôt que tolérée.
 * 2. **Une ligne peut n'être lettrée qu'en partie.** Un règlement à-compte ne solde pas une facture :
 *    il en consomme une portion, et le reste demeure à lettrer. Les écritures sont immuables — on ne
 *    scinde jamais une ligne pour la faire tomber juste — donc la marque porte ses **imputations**,
 *    ligne par ligne. Une marque sans imputations consomme chaque ligne en entier : c'est le lettrage
 *    ordinaire, et les marques déjà produites restent lisibles telles quelles.
 * 3. **Un délettrage ne supprime rien.** La marque passée reste lisible, avec sa date de défection :
 *    l'historique d'un compte de tiers doit pouvoir être reconstitué. Délettrer une marque partielle
 *    rend à chaque ligne la portion qu'elle avait consommée, pas plus.
 */

import { ErreurRegle, ZERO, formatMontant, type Devise, type Montant } from "./montants";
import { comptePrincipalDe, type Mouvement } from "./grand-livre";
import { formaterDateFr, type DateCivile } from "./calendrier";

/** Ce qu'une marque impute à une ligne : la portion de cette ligne que la marque consomme. */
export interface Imputation {
  ligneId: string;
  montant: Montant;
}

/** Marque de lettrage : un code, les lignes qu'il rapproche, et son devenir. */
export interface Lettrage {
  /** Code de lettrage — « AA », « AB », … puis « AAA » au-delà. Attribué par le dossier. */
  code: string;
  /** Compte principal du tiers : `401100`, même si les lignes portent `401100-FOU01`. */
  compte: string;
  tiersCode: string | null;
  /** Identifiants des lignes de grand livre lettrées. */
  lignes: string[];
  /** Montant lettré : total des débits imputés, égal au total des crédits imputés. */
  montant: Montant;
  /**
   * Imputations ligne à ligne, quand la marque ne consomme pas chaque ligne en entier.
   *
   * Absent pour un lettrage total : chaque ligne est alors consommée pour son propre montant. Le
   * champ reste facultatif pour que les marques produites avant le lettrage partiel demeurent
   * valides, et pour ne pas alourdir ce qui n'en a pas besoin.
   */
  portions?: Imputation[] | undefined;
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
  /** Les imputations que la proposition appliquera : c'est ce qui distingue un lettrage partiel. */
  portions: Imputation[];
  montant: Montant;
  /**
   * « exact » : un débit pour un crédit de même montant. « compose » : plusieurs lignes d'un même
   * sens face à une ligne de l'autre. « partiel » : la marque ne consomme pas au moins une ligne en
   * entier — un règlement à-compte sur une facture plus lourde.
   */
  nature: "exact" | "compose" | "partiel";
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

/** Une ligne de grand livre et ce qu'il en reste à lettrer. */
export interface LigneALettrer extends Mouvement {
  /** Ce que les marques en vigueur ont déjà consommé de cette ligne. */
  consomme: Montant;
  /** Ce qui reste à rapprocher : c'est le montant maximal d'une nouvelle imputation. */
  reste: Montant;
  /** Codes des marques en vigueur qui touchent cette ligne. */
  marques: string[];
  etat: EtatDeLettrage;
}

export type EtatDeLettrage = "nonLettree" | "partielle" | "lettree";

/** Le montant d'une ligne, au débit ou au crédit : une ligne d'à-compte ne porte jamais les deux. */
export function montantDeLigne(mouvement: Mouvement): Montant {
  return mouvement.debit !== ZERO ? mouvement.debit : mouvement.credit;
}

const estDebit = (mouvement: Mouvement): boolean => mouvement.debit !== ZERO;

/**
 * Ce qu'une marque consomme d'une ligne.
 *
 * Une marque sans imputations consomme la ligne en entier — c'est le lettrage ordinaire, et c'est ce
 * que disent toutes les marques produites avant le lettrage partiel. Une marque défait ne consomme
 * plus rien : délettrer rend la portion à la ligne.
 */
export function portionDeLigne(lettrage: Lettrage, mouvement: Mouvement): Montant {
  if (lettrage.defaitLe !== null) {
    return ZERO;
  }
  if (!lettrage.lignes.includes(mouvement.ligneId)) {
    return ZERO;
  }
  if (!lettrage.portions) {
    return montantDeLigne(mouvement);
  }
  return lettrage.portions.find((imputation) => imputation.ligneId === mouvement.ligneId)?.montant ?? ZERO;
}

/** Ce que l'ensemble des marques en vigueur a consommé d'une ligne. */
export function consommeSurLigne(mouvement: Mouvement, lettrages: readonly Lettrage[]): Montant {
  return lettrages.reduce<Montant>((total, lettrage) => total + portionDeLigne(lettrage, mouvement), ZERO);
}

/**
 * Ce qui reste à lettrer d'une ligne.
 *
 * Le reste n'est jamais négatif : une sur-imputation serait une écriture fausse, et elle est refusée
 * à la création de la marque plutôt que corrigée ici en silence.
 */
export function resteDeLigne(mouvement: Mouvement, lettrages: readonly Lettrage[]): Montant {
  const reste = montantDeLigne(mouvement) - consommeSurLigne(mouvement, lettrages);
  return reste > ZERO ? reste : ZERO;
}

/** L'état d'une ligne au regard du lettrage : rien, une partie, ou tout. */
export function etatDeLettrage(mouvement: Mouvement, lettrages: readonly Lettrage[]): EtatDeLettrage {
  const consomme = consommeSurLigne(mouvement, lettrages);
  if (consomme === ZERO) {
    return "nonLettree";
  }
  return resteDeLigne(mouvement, lettrages) === ZERO ? "lettree" : "partielle";
}

/** Les codes des marques en vigueur qui touchent une ligne, dans l'ordre de leur création. */
export function marquesSurLigne(mouvement: Mouvement, lettrages: readonly Lettrage[]): string[] {
  return lettrages
    .filter((lettrage) => lettrage.defaitLe === null && lettrage.lignes.includes(mouvement.ligneId))
    .map((lettrage) => lettrage.code);
}

/**
 * Lignes touchées par une marque encore en vigueur.
 *
 * Depuis le lettrage partiel, figurer ici ne veut plus dire « entièrement lettrée » : une ligne peut
 * être entamée et garder un reste. C'est `resteDeLigne` qui le dit. Cette fonction reste utile pour
 * savoir quelles lignes une marque concerne, pas pour savoir ce qui reste à rapprocher.
 */
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
 * Lignes candidates au lettrage sur un compte de tiers, avec ce qu'il en reste à rapprocher.
 *
 * Une ligne candidate porte encore un reste : une ligne entièrement lettrée ne se rapproche plus de
 * rien, et une ligne entamée par un à-compte reste candidate pour son solde. Les lignes à zéro sont
 * écartées : elles ne rapprochent rien.
 */
export function mouvementsALettrer(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  critere: CritereDeLettrage
): LigneALettrer[] {
  const compte = comptePrincipalDe(critere.compte);
  const tiersCode = critere.tiersCode ?? null;

  return mouvements
    .filter((mouvement) => comptePrincipalDe(mouvement.compte) === compte)
    .filter((mouvement) => (tiersCode === null ? true : mouvement.tiersCode === tiersCode))
    .filter((mouvement) => (critere.du === undefined ? true : mouvement.date >= critere.du))
    .filter((mouvement) => (critere.au === undefined ? true : mouvement.date <= critere.au))
    .filter((mouvement) => mouvement.debit !== ZERO || mouvement.credit !== ZERO)
    .map((mouvement) => ({
      ...mouvement,
      consomme: consommeSurLigne(mouvement, lettrages),
      reste: resteDeLigne(mouvement, lettrages),
      marques: marquesSurLigne(mouvement, lettrages),
      etat: etatDeLettrage(mouvement, lettrages)
    }))
    .filter((ligne) => ligne.reste > ZERO)
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

/**
 * Vérifie qu'un groupe de lignes peut être lettré **en entier**.
 *
 * Refusé : un groupe vide, une seule ligne (rien à rapprocher), un groupe qui ne contient qu'un
 * seul sens, et surtout un groupe dont les débits ne somment pas les crédits. Le lettrage partiel
 * passe par {@link verifierImputations}, qui accepte qu'une ligne ne soit consommée qu'en partie.
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
      )}, écart ${formatMontant(totalDebit - totalCredit, devise)}. Retirez une ligne, lettrez-la avec son complément, ou imputez un montant partiel sur la ligne la plus lourde.`
    );
  }
  return { montant: totalDebit, totalDebit, totalCredit };
}

/** Une ligne choisie, et la portion que la marque en consommera. */
export interface LigneAImputer {
  mouvement: Mouvement;
  montant: Montant;
}

export interface GroupeVerifie {
  montant: Montant;
  totalDebit: Montant;
  totalCredit: Montant;
  /** Vrai dès qu'une ligne n'est pas consommée en entier : la marque portera ses imputations. */
  partiel: boolean;
  portions: Imputation[];
}

/**
 * Vérifie un groupe de lignes **et** les portions imputées.
 *
 * Quatre refus, tous motivés :
 *
 * - moins de deux lignes : rien à rapprocher ;
 * - une imputation nulle ou négative : un lettrage rapproche des montants positifs ;
 * - une ligne déjà entièrement lettrée : il n'y a plus rien à en prendre ;
 * - une imputation qui dépasse ce qui reste : on ne lettre pas plus qu'il n'est dû.
 *
 * Puis le contrôle qui compte : les débits imputés doivent sommer les crédits imputés. Un à-compte de
 * 500 000 sur une facture de 1 180 000 rapproche 500 000 de chaque côté, et laisse 680 000 à lettrer
 * sur la facture — c'est ce reste, et pas un écart absorbé, qui dit la vérité.
 */
export function verifierImputations(
  groupe: readonly LigneAImputer[],
  lettrages: readonly Lettrage[],
  devise: Devise
): GroupeVerifie {
  if (groupe.length < 2) {
    throw new ErreurRegle(
      `Le lettrage rapproche au moins deux lignes : ${groupe.length} ligne${groupe.length > 1 ? "s" : ""} demandée${
        groupe.length > 1 ? "s" : ""
      }.`
    );
  }

  let totalDebit = ZERO;
  let totalCredit = ZERO;
  let partiel = false;
  const portions: Imputation[] = [];
  const vus = new Set<string>();

  for (const { mouvement, montant } of groupe) {
    if (vus.has(mouvement.ligneId)) {
      throw new ErreurRegle(
        `La ligne ${mouvement.piece} · ${mouvement.compte} du ${mouvement.date} est imputée deux fois dans le même lettrage.`
      );
    }
    vus.add(mouvement.ligneId);

    const reste = resteDeLigne(mouvement, lettrages);
    if (reste === ZERO) {
      // Dire « déjà lettrée » plutôt que « montant nul » : la cause est la marque existante, pas la
      // saisie, et c'est elle qu'il faut défaire.
      const marques = marquesSurLigne(mouvement, lettrages);
      throw new ErreurRegle(
        `La ligne ${mouvement.piece} · ${mouvement.compte} du ${formaterDateFr(
          mouvement.date
        )} est déjà entièrement lettrée${
          marques.length > 0 ? ` sous le code ${marques.join(", ")}` : ""
        }. Délettrez-la avant de la rapprocher d'une autre ligne.`
      );
    }
    if (montant <= ZERO) {
      throw new ErreurRegle(
        `L'imputation de la ligne ${mouvement.piece} · ${mouvement.compte} du ${formaterDateFr(
          mouvement.date
        )} est nulle ou négative : un lettrage rapproche des montants positifs.`
      );
    }
    if (montant > reste) {
      throw new ErreurRegle(
        `L'imputation demandée sur la ligne ${mouvement.piece} · ${mouvement.compte} du ${formaterDateFr(
          mouvement.date
        )} (${formatMontant(montant, devise)}) dépasse ce qui reste à lettrer (${formatMontant(
          reste,
          devise
        )}). On ne lettre pas plus qu'il n'est dû.`
      );
    }
    if (montant < reste) {
      partiel = true;
    }

    if (estDebit(mouvement)) {
      totalDebit += montant;
    } else {
      totalCredit += montant;
    }
    portions.push({ ligneId: mouvement.ligneId, montant });
  }

  if (totalDebit === ZERO || totalCredit === ZERO) {
    throw new ErreurRegle(
      `Le groupe ne contient que des ${
        totalCredit === ZERO ? "débits" : "crédits"
      } : un lettrage rapproche une dette et son règlement.`
    );
  }
  if (totalDebit !== totalCredit) {
    throw new ErreurRegle(
      `Le lettrage n'est pas équilibré : débit ${formatMontant(totalDebit, devise)}, crédit ${formatMontant(
        totalCredit,
        devise
      )}, écart ${formatMontant(
        totalDebit - totalCredit,
        devise
      )}. Ajustez les portions imputées : un à-compte se lettre au montant du règlement, pas à celui de la facture.`
    );
  }

  return { montant: totalDebit, totalDebit, totalCredit, partiel, portions };
}

/**
 * Lettrage automatique : rapproche les lignes par montant, puis par à-compte.
 *
 * Trois passes, dans cet ordre, sur ce qui reste à lettrer :
 *
 * 1. un débit contre un crédit de même montant — le cas ordinaire, une facture et son règlement ;
 * 2. une ligne contre plusieurs de l'autre sens, dont les montants somment exactement — un règlement
 *    groupé, plusieurs acomptes déjà rapprochés ;
 * 3. ce qui n'est pas tombé juste : le règlement le plus ancien est imputé sur la dette la plus
 *    ancienne, à hauteur du plus petit des deux restes. C'est le lettrage partiel, et c'est un choix
 *    assumé : un premier entré, premier imputé se vérifie, se raconte, et ne dépend pas de l'ordre
 *    d'arrivée des écritures.
 *
 * La recherche est bornée et déterministe. Au-delà de la taille de groupe demandée, les combinaisons
 * explosent et un utilisateur ne peut plus vérifier ce qu'on lui propose : ce qui n'est pas rapproché
 * reste à lettrer à la main.
 */
export function proposerLettrageAutomatique(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  critere: CritereDeLettrage,
  options?: { tailleMaximaleDuGroupe?: number; partiel?: boolean }
): PropositionLettrage[] {
  const taille = Math.max(2, options?.tailleMaximaleDuGroupe ?? 4);
  const avecPartiel = options?.partiel ?? true;
  const candidats = mouvementsALettrer(mouvements, lettrages, critere);
  const restes = new Map<string, Montant>(candidats.map((ligne) => [ligne.ligneId, ligne.reste]));
  const propositions: PropositionLettrage[] = [];

  const resteDe = (ligneId: string): Montant => restes.get(ligneId) ?? ZERO;

  const consommer = (groupe: readonly LigneAImputer[], nature: PropositionLettrage["nature"]): void => {
    for (const imputation of groupe) {
      restes.set(imputation.mouvement.ligneId, resteDe(imputation.mouvement.ligneId) - imputation.montant);
    }
    propositions.push({
      lignes: groupe.map((imputation) => imputation.mouvement.ligneId),
      portions: groupe.map((imputation) => ({
        ligneId: imputation.mouvement.ligneId,
        montant: imputation.montant
      })),
      montant: groupe.reduce<Montant>(
        (total, imputation) => total + (estDebit(imputation.mouvement) ? imputation.montant : ZERO),
        ZERO
      ),
      nature,
      dateLaPlusAncienne: groupe.reduce(
        (plusAncienne, imputation) =>
          imputation.mouvement.date < plusAncienne ? imputation.mouvement.date : plusAncienne,
        groupe[0]!.mouvement.date
      ),
      pieces: [...new Set(groupe.map((imputation) => imputation.mouvement.piece))].sort()
    });
  };

  const debits = candidats.filter((ligne) => estDebit(ligne));
  const credits = candidats.filter((ligne) => !estDebit(ligne));

  // 1. Un débit pour un crédit de même montant.
  for (const debit of debits) {
    const cible = resteDe(debit.ligneId);
    if (cible === ZERO) {
      continue;
    }
    const contrepartie = credits.find((credit) => resteDe(credit.ligneId) === cible);
    if (contrepartie) {
      consommer(
        [
          { mouvement: debit, montant: cible },
          { mouvement: contrepartie, montant: cible }
        ],
        "exact"
      );
    }
  }

  // 2. Une ligne contre plusieurs de l'autre sens, dont les montants somment exactement.
  for (const sens of ["debit", "credit"] as const) {
    const principales = sens === "debit" ? debits : credits;
    const complementaires = sens === "debit" ? credits : debits;
    for (const principale of principales) {
      const cible = resteDe(principale.ligneId);
      if (cible === ZERO) {
        continue;
      }
      const disponibles = complementaires
        .filter((ligne) => resteDe(ligne.ligneId) > ZERO)
        .map((ligne) => ({ mouvement: ligne, montant: resteDe(ligne.ligneId) }));
      const combinaison = chercherCombinaisonImputee(disponibles, cible, taille - 1);
      if (combinaison) {
        consommer([{ mouvement: principale, montant: cible }, ...combinaison], "compose");
      }
    }
  }

  // 3. Ce qui ne tombe pas juste : à-compte, ligne par ligne, du plus ancien au plus récent.
  if (avecPartiel) {
    for (const debit of debits) {
      while (resteDe(debit.ligneId) > ZERO) {
        const credit = credits.find((ligne) => resteDe(ligne.ligneId) > ZERO);
        if (!credit) {
          break;
        }
        const resteDebit = resteDe(debit.ligneId);
        const resteCredit = resteDe(credit.ligneId);
        const montant = resteDebit < resteCredit ? resteDebit : resteCredit;
        if (montant <= ZERO) {
          break;
        }
        consommer(
          [
            { mouvement: debit, montant },
            { mouvement: credit, montant }
          ],
          montant === resteDebit && montant === resteCredit ? "exact" : "partiel"
        );
      }
    }
  }

  return propositions;
}

/**
 * Cherche un sous-ensemble d'imputations dont les montants somment exactement la cible.
 *
 * Récursion bornée par `tailleMaximale`, sur des lignes triées : le résultat ne dépend pas de
 * l'ordre d'arrivée des mouvements, et un compte de tiers très mouvementé ne fige pas l'écran.
 */
export function chercherCombinaisonImputee(
  lignes: readonly LigneAImputer[],
  cible: Montant,
  tailleMaximale: number
): LigneAImputer[] | null {
  if (tailleMaximale < 1 || cible <= ZERO) {
    return null;
  }
  const triees = [...lignes].sort((a, b) => (a.montant < b.montant ? -1 : a.montant > b.montant ? 1 : 0));

  const chercher = (index: number, reste: Montant, acc: LigneAImputer[]): LigneAImputer[] | null => {
    if (reste === ZERO && acc.length > 0) {
      return [...acc];
    }
    if (acc.length >= tailleMaximale) {
      return null;
    }
    for (let i = index; i < triees.length; i += 1) {
      const candidat = triees[i]!;
      if (candidat.montant > reste) {
        // Les lignes sont triées par montant croissant : aucune des suivantes ne peut convenir.
        return null;
      }
      const trouve = chercher(i + 1, reste - candidat.montant, [...acc, candidat]);
      if (trouve) {
        return trouve;
      }
    }
    return null;
  };

  return chercher(0, cible, []);
}

/**
 * Cherche un sous-ensemble de lignes dont les montants entiers somment exactement la cible.
 *
 * Forme historique, conservée pour les appelants qui raisonnent en lignes complètes.
 */
export function chercherCombinaison(
  lignes: readonly Mouvement[],
  cible: Montant,
  tailleMaximale: number
): Mouvement[] | null {
  const trouve = chercherCombinaisonImputee(
    lignes.map((mouvement) => ({ mouvement, montant: montantDeLigne(mouvement) })),
    cible,
    tailleMaximale
  );
  return trouve ? trouve.map((imputation) => imputation.mouvement) : null;
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
  /** Lignes entamées par un à-compte sans être soldées : elles portent une marque et un reste. */
  lignesPartielles: number;
  lettrages: number;
  /** Plus ancienne échéance non lettrée — ce que regarde un trésorier avant le solde. */
  plusAncienneLigne: DateCivile | null;
}

/**
 * Situation du lettrage, compte par compte de tiers.
 *
 * Le solde comptable et le solde non lettré sont deux nombres distincts : le premier dit ce qui est
 * dû, le second ce qui est dû **sans qu'aucun règlement ne l'explique**. Les confondre revient à
 * perdre l'information que le lettrage apporte. Avec le lettrage partiel, le solde non lettré somme
 * les **restes** : une facture entamée par un à-compte n'y figure plus que pour ce qui reste dû.
 */
export function situationsDeLettrage(
  mouvements: readonly Mouvement[],
  lettrages: readonly Lettrage[],
  options?: { du?: DateCivile; au?: DateCivile }
): SituationDeLettrage[] {
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
        lignesPartielles: 0,
        lettrages: 0,
        plusAncienneLigne: null
      };
      parCle.set(cle, situation);
    }

    situation.totalDebit += mouvement.debit;
    situation.totalCredit += mouvement.credit;
    situation.solde = situation.totalDebit - situation.totalCredit;

    if (mouvement.debit === ZERO && mouvement.credit === ZERO) {
      continue;
    }

    const consomme = consommeSurLigne(mouvement, lettrages);
    const reste = resteDeLigne(mouvement, lettrages);
    situation.lettre += consomme;
    situation.nonLettre += reste;
    if (reste > ZERO) {
      situation.lignesALettrer += 1;
      if (consomme > ZERO) {
        situation.lignesPartielles += 1;
      }
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
