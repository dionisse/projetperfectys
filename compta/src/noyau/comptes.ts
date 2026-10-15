/**
 * Comptes segmentés et structure de comptes.
 *
 * Sage 300 sépare le **format** du numéro de compte (*Account Structures*) des **valeurs
 * autorisées** par segment (*Segment Codes*). Nous faisons de même, parce que c'est ce qui permet
 * d'ajouter l'analytique sans reconstruire le plan : le segment 1 porte le compte du référentiel,
 * le segment 2 le tiers, le segment 3 l'axe analytique.
 *
 * ```
 * 411100-CLI01-ABJ1
 * └──┬──┘ └─┬─┘ └┬─┘
 *  compte   tiers  axe
 * ```
 */

import { ErreurRegle, type Montant, ZERO } from "./montants";

export interface SegmentDeCompte {
  code: string;
  libelle: string;
  longueur: number;
  obligatoire: boolean;
}

export interface StructureDeComptes {
  code: string;
  libelle: string;
  separateur: string;
  segments: SegmentDeCompte[];
}

export type NatureCompte =
  | "ressources-durables"
  | "actif-immobilise"
  | "actif-circulant"
  | "tiers"
  | "tresorerie"
  | "charge"
  | "produit"
  | "autres"
  | "speciaux";

export interface ClasseDeCompte {
  code: string;
  libelle: string;
  nature: NatureCompte;
}

/** Groupe de comptes servant de base aux états financiers (équivalent des *Account Groups* Sage). */
export interface GroupeDeComptes {
  code: string;
  libelle: string;
  /** État financier auquel le groupe contribue. */
  etat: "bilan" | "resultat" | "tft" | "tvap" | "hors-etat";
}

export interface Compte {
  /** Numéro complet, segments compris. */
  numero: string;
  /** Segment 1 seul : le compte du référentiel. */
  comptePrincipal: string;
  auxiliaire: string | null;
  axe: string | null;
  libelle: string;
  classe: string;
  groupe: string;
  /** Un compte auxiliaire n'accepte d'écriture qu'avec un tiers existant. */
  exigeTiers: boolean;
  /** Un compte de regroupement (`411`) ne reçoit pas d'écriture directe. */
  autoriseSaisie: boolean;
  actif: boolean;
  soldeInitial: Montant;
}

export const LIBELLES_NATURE: Record<NatureCompte, string> = {
  "ressources-durables": "Ressources durables",
  "actif-immobilise": "Actif immobilisé",
  "actif-circulant": "Actif circulant",
  tiers: "Tiers",
  tresorerie: "Trésorerie",
  charge: "Charge des activités ordinaires",
  produit: "Produit des activités ordinaires",
  autres: "Autres charges et produits",
  speciaux: "Comptes spéciaux"
};

/**
 * Découpe un numéro de compte selon la structure. Refuse tout ce qui n'y conforme pas : un
 * numéro mal segmenté rend l'analytique et le lettrage impossibles à rétablir ensuite.
 */
export function decouperNumero(
  numero: string,
  structure: StructureDeComptes
): { comptePrincipal: string; auxiliaire: string | null; axe: string | null } {
  const propre = numero.trim().toUpperCase();
  if (propre === "") {
    throw new ErreurRegle("Le numéro de compte est obligatoire.");
  }
  const morceaux = propre.split(structure.separateur);
  const resultat: (string | null)[] = [];

  for (let index = 0; index < structure.segments.length; index += 1) {
    const segment = structure.segments[index];
    const valeur = morceaux[index]?.trim() ?? "";
    if (!segment) {
      throw new ErreurRegle("Structure de comptes invalide : segment manquant.");
    }
    if (valeur === "") {
      if (segment.obligatoire) {
        throw new ErreurRegle(
          `Le segment « ${segment.libelle} » est obligatoire dans le compte « ${numero} ».`
        );
      }
      resultat.push(null);
      continue;
    }
    if (valeur.length > segment.longueur) {
      throw new ErreurRegle(
        `Le segment « ${segment.libelle} » du compte « ${numero} » dépasse ${segment.longueur} caractères.`
      );
    }
    if (!/^[A-Z0-9]+$/.test(valeur)) {
      throw new ErreurRegle(
        `Le segment « ${segment.libelle} » du compte « ${numero} » contient un caractère interdit.`
      );
    }
    resultat.push(valeur);
  }

  if (morceaux.length > structure.segments.length) {
    throw new ErreurRegle(
      `Le compte « ${numero} » comporte plus de segments que la structure ${structure.code} n'en prévoit.`
    );
  }

  const [comptePrincipal, auxiliaire, axe] = resultat;
  if (!comptePrincipal) {
    throw new ErreurRegle(`Le compte « ${numero} » n'a pas de compte principal.`);
  }
  if (!/^\d+$/.test(comptePrincipal)) {
    throw new ErreurRegle(
      `Le compte principal de « ${numero} » doit être numérique : « ${comptePrincipal} ».`
    );
  }
  return { comptePrincipal, auxiliaire: auxiliaire ?? null, axe: axe ?? null };
}

export function composerNumero(
  comptePrincipal: string,
  structure: StructureDeComptes,
  auxiliaire: string | null = null,
  axe: string | null = null
): string {
  const morceaux = [comptePrincipal, auxiliaire ?? "", axe ?? ""];
  const garde = morceaux.slice(0, structure.segments.length).filter((morceau) => morceau !== "");
  return garde.join(structure.separateur);
}

export interface CompteDuPlan {
  numero: string;
  libelle: string;
  groupe: string;
  exigeTiers?: boolean;
  autoriseSaisie?: boolean;
  actif?: boolean;
  soldeInitial?: Montant;
}

export function compteDepuisPlan(
  compteDuPlan: CompteDuPlan,
  structure: StructureDeComptes
): Compte {
  const { comptePrincipal } = decouperNumero(compteDuPlan.numero, structure);
  return {
    numero: comptePrincipal,
    comptePrincipal,
    auxiliaire: null,
    axe: null,
    libelle: compteDuPlan.libelle,
    classe: comptePrincipal.slice(0, 1),
    groupe: compteDuPlan.groupe,
    exigeTiers: compteDuPlan.exigeTiers ?? false,
    autoriseSaisie: compteDuPlan.autoriseSaisie ?? true,
    actif: compteDuPlan.actif ?? true,
    soldeInitial: compteDuPlan.soldeInitial ?? ZERO
  };
}

/** Compte auxiliaire d'un compte général, pour un tiers donné. */
export function compteAuxiliaire(
  compteGeneral: Compte,
  codeTiers: string,
  structure: StructureDeComptes
): Compte {
  if (!compteGeneral.exigeTiers) {
    throw new ErreurRegle(
      `Le compte ${compteGeneral.numero} n'est pas un compte auxiliaire : il ne reçoit pas de tiers.`
    );
  }
  const auxiliaire = codeTiers.trim().toUpperCase();
  if (auxiliaire === "") {
    throw new ErreurRegle("Un compte auxiliaire exige un code tiers.");
  }
  const numero = composerNumero(compteGeneral.comptePrincipal, structure, auxiliaire);
  return {
    ...compteGeneral,
    numero,
    auxiliaire,
    libelle: `${compteGeneral.libelle} — ${auxiliaire}`
  };
}

/** Racine hiérarchique à deux chiffres (`411100` → `41`), base des totaux par rubrique. */
export function racineDe(comptePrincipal: string): string {
  return comptePrincipal.slice(0, 2);
}

/** Vrai si `comptePrincipal` dépend de `racine` dans la hiérarchie du plan. */
export function dependDe(comptePrincipal: string, racine: string): boolean {
  return comptePrincipal.startsWith(racine);
}
