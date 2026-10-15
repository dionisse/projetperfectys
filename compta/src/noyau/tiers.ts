/**
 * Fichier des tiers.
 *
 * Sage distingue les tiers par type (clients, fournisseurs, personnel, organismes sociaux, État).
 * Le fichier est unique et le type est un attribut : un même acteur peut être client et
 * fournisseur, ce que deux fichiers séparés rendraient impossible à suivre.
 */

import { ErreurRegle } from "./montants";

export type TypeTiers = "client" | "fournisseur" | "personnel" | "organisme-social" | "etat" | "associe";

export interface Tiers {
  code: string;
  nom: string;
  type: TypeTiers;
  /** Identifiant fiscal du tiers : IFU au Bénin, autre ailleurs. Facultatif mais tracé. */
  identifiantFiscal: string;
  /**
   * Un tiers non immatriculé à l'IFU déclenche une retenue majorée : cette information est
   * comptable, pas décorative.
   */
  immatricule: boolean;
  adresse: string;
  ville: string;
  pays: string;
  telephone: string;
  courriel: string;
  actif: boolean;
}

export const LIBELLES_TYPE_TIERS: Record<TypeTiers, string> = {
  client: "Client",
  fournisseur: "Fournisseur",
  personnel: "Personnel",
  "organisme-social": "Organisme social",
  etat: "État et administrations",
  associe: "Associé"
};

export function tiersVide(code: string, type: TypeTiers): Tiers {
  return {
    code,
    nom: "",
    type,
    identifiantFiscal: "",
    immatricule: false,
    adresse: "",
    ville: "",
    pays: "",
    telephone: "",
    courriel: "",
    actif: true
  };
}

export function normaliserTiers(tiers: Tiers): Tiers {
  const code = tiers.code.trim().toUpperCase();
  if (code === "") {
    throw new ErreurRegle("Le code tiers est obligatoire.");
  }
  if (!/^[A-Z0-9]{1,10}$/.test(code)) {
    throw new ErreurRegle(`Code tiers invalide : « ${tiers.code} ». 10 caractères maximum, lettres et chiffres.`);
  }
  const nom = tiers.nom.trim();
  if (nom === "") {
    throw new ErreurRegle("Le nom du tiers est obligatoire.");
  }
  if (nom.length > 120) {
    throw new ErreurRegle("Le nom du tiers dépasse 120 caractères.");
  }
  if (tiers.courriel !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tiers.courriel)) {
    throw new ErreurRegle("Le courriel du tiers n'a pas un format valide.");
  }
  return {
    ...tiers,
    code,
    nom,
    identifiantFiscal: tiers.identifiantFiscal.trim().toUpperCase(),
    adresse: tiers.adresse.trim(),
    ville: tiers.ville.trim(),
    pays: tiers.pays.trim(),
    telephone: tiers.telephone.trim(),
    courriel: tiers.courriel.trim().toLowerCase()
  };
}
