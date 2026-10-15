/**
 * Tiers à fiche unique (clients, fournisseurs, salariés, État…).
 *
 * Cadrage produit v2 (§7 de la spec) : UN seul fichier tiers partagé par tous les
 * modules, là où l'original fragmentait les fiches par dossier et par module.
 * Les horodatages sont des chaînes ISO 8601, comme {@link StoredEntry} : le tiers
 * est stocké tel quel dans l'état persistable, sans double représentation.
 */

import { DomainRuleError } from "./core";

export const ThirdPartyType = {
  Customer: "customer",
  Supplier: "supplier",
  Employee: "employee",
  State: "state",
  Other: "other"
} as const;
export type ThirdPartyType = (typeof ThirdPartyType)[keyof typeof ThirdPartyType];

export const THIRD_PARTY_TYPES: readonly ThirdPartyType[] = [
  ThirdPartyType.Customer,
  ThirdPartyType.Supplier,
  ThirdPartyType.Employee,
  ThirdPartyType.State,
  ThirdPartyType.Other
];

export const thirdPartyTypeLabel: Record<ThirdPartyType, string> = {
  customer: "Client",
  supplier: "Fournisseur",
  employee: "Salarié",
  state: "État / organisme",
  other: "Autre tiers"
};

/** Préfixe de code proposé à la création (CLI001, FOU001…). */
export const thirdPartyTypeCodePrefix: Record<ThirdPartyType, string> = {
  customer: "CLI",
  supplier: "FOU",
  employee: "SAL",
  state: "ETA",
  other: "DIV"
};

export interface ThirdPartyData {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly type: ThirdPartyType;
  readonly taxIdentifier: string;
  readonly address: string;
  readonly phone: string;
  readonly email: string;
  readonly notes: string;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ThirdPartyInput {
  id?: string | undefined;
  organizationId: string;
  /** Absent ou vide : le code est proposé d'après le type (FOU007…). */
  code?: string | undefined;
  name: string;
  type: ThirdPartyType | string;
  taxIdentifier?: string | null | undefined;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
  createdAt?: string | undefined;
  now: Date;
}

const CODE_RE = /^[A-Z0-9._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `FOU-001`, ` fou001 ` -> `FOU-001`. */
export function normalizeThirdPartyCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new DomainRuleError("Le code tiers est obligatoire.");
  }
  if (normalized.length < 2 || normalized.length > 12) {
    throw new DomainRuleError("Le code tiers doit contenir entre 2 et 12 caractères.");
  }
  if (!CODE_RE.test(normalized)) {
    throw new DomainRuleError("Le code tiers ne peut contenir que des lettres, chiffres, points, tirets ou soulignés.");
  }
  return normalized;
}

export function normalizeThirdPartyName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    throw new DomainRuleError("Le nom du tiers est obligatoire.");
  }
  if (normalized.length > 160) {
    throw new DomainRuleError("Le nom du tiers ne peut pas dépasser 160 caractères.");
  }
  return normalized;
}

export function parseThirdPartyType(value: ThirdPartyType | string): ThirdPartyType {
  const candidate = String(value).trim().toLowerCase();
  const match = THIRD_PARTY_TYPES.find((type) => type === candidate);
  if (!match) {
    throw new DomainRuleError(
      `Type de tiers inconnu : « ${value} ». Valeurs acceptées : ${THIRD_PARTY_TYPES
        .map((type) => thirdPartyTypeLabel[type])
        .join(", ")}.`
    );
  }
  return match;
}

/**
 * Clé d'unicité « fiche unique » : même nom (sans accent, sans casse, la
 * ponctuation valant séparateur) et même type désignent le même tiers, quel que
 * soit le module qui l'a créé.
 */
export function thirdPartyIdentityKey(name: string, type: ThirdPartyType): string {
  const folded = name
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  return `${folded}|${type}`;
}

/** Propose `FOU007` en évitant les codes déjà attribués. */
export function suggestThirdPartyCode(type: ThirdPartyType, existingCodes: readonly string[]): string {
  const prefix = thirdPartyTypeCodePrefix[type];
  const taken = new Set(existingCodes.map((code) => code.trim().toUpperCase()));
  for (let sequence = 1; sequence < 1000; sequence += 1) {
    const candidate = `${prefix}${String(sequence).padStart(3, "0")}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  throw new DomainRuleError(`Impossible de proposer un code tiers pour le préfixe ${prefix}.`);
}

function optionalText(value: string | null | undefined, limit: number, field: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length > limit) {
    throw new DomainRuleError(`${field} ne peut pas dépasser ${limit} caractères.`);
  }
  return normalized;
}

/** Crée la fiche tiers (validations comprises). Le code est fourni ou proposé. */
export function createThirdParty(input: ThirdPartyInput): ThirdPartyData {
  if (input.organizationId.trim().length === 0) {
    throw new DomainRuleError("L'organisation est obligatoire.");
  }
  const type = parseThirdPartyType(input.type);
  const name = normalizeThirdPartyName(input.name);
  const email = optionalText(input.email, 160, "L'adresse électronique");
  if (email.length > 0 && !EMAIL_RE.test(email)) {
    throw new DomainRuleError(`Adresse électronique invalide : « ${email} ».`);
  }
  const nowIso = input.now.toISOString();
  return {
    id: input.id ?? crypto.randomUUID(),
    organizationId: input.organizationId,
    code: normalizeThirdPartyCode(input.code ?? suggestThirdPartyCode(type, [])),
    name,
    type,
    taxIdentifier: optionalText(input.taxIdentifier, 30, "L'identifiant fiscal").toUpperCase(),
    address: optionalText(input.address, 240, "L'adresse"),
    phone: optionalText(input.phone, 40, "Le téléphone"),
    email,
    notes: optionalText(input.notes, 600, "La note"),
    isActive: input.isActive ?? true,
    createdAt: input.createdAt ?? nowIso,
    updatedAt: nowIso
  };
}

/** Met à jour une fiche existante sans changer son identifiant ni sa date de création. */
export function updateThirdParty(existing: ThirdPartyData, input: ThirdPartyInput): ThirdPartyData {
  const revised = createThirdParty({
    ...input,
    id: existing.id,
    organizationId: existing.organizationId,
    code: input.code ?? existing.code,
    createdAt: existing.createdAt
  });
  return revised;
}
