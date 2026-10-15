/**
 * Identité imprimée de la société.
 *
 * PERFECTO WinDev ouvrait chaque dossier par une fiche société (`society_screen_findings.md`,
 * `CR000-26`) : raison sociale, forme juridique, identifiant fiscal, adresse, coordonnées.
 * Cette fiche n'est pas un agrégat de plus — {@link Organization} (`core.ts`, port de
 * Organization.cs) porte déjà le cycle de vie multi-sociétés (code, devise, activation).
 * `OrganizationProfile` est la **valeur imprimée** : elle alimente l'en-tête et le pied de
 * page de chaque document exporté (PDF, Excel, CSV) et l'affichage des écrans.
 *
 * Toute modification passe par {@link normalizeOrganizationProfile}, seule fonction
 * habilitée à produire un profil valide : aucune écriture directe dans l'état.
 */

import { DomainRuleError } from "./core";

export interface OrganizationProfile {
  readonly name: string;
  readonly legalForm: string;
  /** IFU (Identifiant Financier Unique) ou numéro de compte contribuable. */
  readonly taxIdentifier: string;
  readonly address: string;
  readonly city: string;
  readonly country: string;
  readonly phone: string;
  readonly email: string;
}

export type OrganizationProfileInput = Partial<OrganizationProfile>;

/** Limites alignées sur les fiches du logiciel d'origine (longueurs de champs WinDev). */
const LIMITS = {
  name: 120,
  legalForm: 40,
  taxIdentifier: 40,
  address: 160,
  city: 80,
  country: 80,
  phone: 40,
  email: 120
} as const satisfies Record<keyof OrganizationProfile, number>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Libellés français des champs, pour les messages d'erreur lisibles par l'utilisateur. */
const LABELS: Record<keyof OrganizationProfile, string> = {
  name: "La raison sociale",
  legalForm: "La forme juridique",
  taxIdentifier: "L'identifiant fiscal (IFU)",
  address: "L'adresse",
  city: "La ville",
  country: "Le pays",
  phone: "Le téléphone",
  email: "Le courriel de la société"
};

function clean(value: string | undefined | null, field: keyof OrganizationProfile): string {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  if (text.length > LIMITS[field]) {
    throw new DomainRuleError(`${LABELS[field]} ne peut pas dépasser ${LIMITS[field]} caractères.`);
  }
  return text;
}

/**
 * Profil vide mais valide : une base créée avant l'existence de la fiche société,
 * ou un dossier tout neuf, s'ouvre sur « Société sans nom » plutôt que sur une erreur.
 */
export function emptyOrganizationProfile(name = "Société sans nom"): OrganizationProfile {
  return {
    name,
    legalForm: "",
    taxIdentifier: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    email: ""
  };
}

/**
 * Normalise et valide une saisie de fiche société.
 *
 * Règles : espaces superflus supprimés, IFU en majuscules (identifiant administratif),
 * raison sociale obligatoire, courriel au format minimal si renseigné. Les champs non
 * fournis conservent la valeur existante lorsqu'un `fallback` est passé — c'est le cas
 * d'une mise à jour partielle depuis l'écran Société.
 */
export function normalizeOrganizationProfile(
  input: OrganizationProfileInput,
  fallback: OrganizationProfile = emptyOrganizationProfile("")
): OrganizationProfile {
  const name = clean(input.name ?? fallback.name, "name");
  if (name === "") {
    throw new DomainRuleError("La raison sociale est obligatoire.");
  }

  const email = clean(input.email ?? fallback.email, "email");
  if (email !== "" && !EMAIL_RE.test(email)) {
    throw new DomainRuleError("Le courriel de la société n'a pas un format valide.");
  }

  return {
    name,
    legalForm: clean(input.legalForm ?? fallback.legalForm, "legalForm"),
    // Identifiant administratif : la casse ne doit pas créer deux fiches différentes.
    taxIdentifier: clean(input.taxIdentifier ?? fallback.taxIdentifier, "taxIdentifier").toUpperCase(),
    address: clean(input.address ?? fallback.address, "address"),
    city: clean(input.city ?? fallback.city, "city"),
    country: clean(input.country ?? fallback.country, "country"),
    phone: clean(input.phone ?? fallback.phone, "phone"),
    email
  };
}

/**
 * Bloc d'en-tête de document : lignes non vides uniquement, dans l'ordre d'impression.
 * Un champ absent est simplement omis — la mise en page ne se décale pas.
 */
export function organizationHeaderLines(profile: OrganizationProfile): string[] {
  const lines = [
    profile.legalForm ? `${profile.name} (${profile.legalForm})` : profile.name,
    profile.taxIdentifier ? `IFU : ${profile.taxIdentifier}` : "",
    profile.address,
    [profile.city, profile.country].filter((part) => part.length > 0).join(", "),
    profile.phone ? `Tél. ${profile.phone}` : "",
    profile.email
  ];
  return lines.filter((line) => line.length > 0);
}

/** Mention de bas de page : identité abrégée + devise, sur une seule ligne. */
export function organizationFooterIdentity(profile: OrganizationProfile): string {
  return [
    profile.name,
    profile.taxIdentifier ? `IFU ${profile.taxIdentifier}` : "",
    [profile.city, profile.country].filter((part) => part.length > 0).join(", ")
  ]
    .filter((part) => part.length > 0)
    .join(" · ");
}
