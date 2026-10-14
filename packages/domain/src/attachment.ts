/**
 * Pièces jointes (justificatifs) à empreinte contrôlée.
 *
 * Cadrage produit v2 : une facture fournisseur n'est complète que si son
 * justificatif est rattaché, et ce justificatif doit être identifiable de façon
 * certaine — d'où l'empreinte SHA-256 stockée avec la métadonnée. Le contenu
 * binaire n'entre jamais dans l'état comptable sérialisable : il reste dans le
 * stockage contrôlé de l'hôte (IndexedDB côté PWA), l'état ne porte que la
 * métadonnée tracée.
 */

import { DomainRuleError } from "./core";

export const SHA256_HEX_LENGTH = 64;

/** Garde-fou local : au-delà, le justificatif doit passer par un stockage serveur. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const SHA256_RE = /^[0-9a-f]{64}$/;

/** Familles acceptées : documents, images, données tabulaires, archives. */
const ACCEPTED_MIME_PREFIXES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "text/plain",
  "text/csv",
  "application/vnd.oasis.opendocument",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument",
  "application/zip"
];

export interface AttachmentData {
  readonly id: string;
  readonly organizationId: string;
  /** Pièce à laquelle le justificatif est rattaché. */
  readonly entryId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** Empreinte SHA-256 hexadécimale minuscule du contenu. */
  readonly sha256: string;
  readonly notes: string;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
}

export interface AttachmentInput {
  readonly id?: string | undefined;
  readonly organizationId: string;
  readonly entryId: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly notes?: string | null | undefined;
  readonly uploadedAt?: string | undefined;
  readonly uploadedBy: string;
}

export function normalizeSha256(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!SHA256_RE.test(normalized)) {
    throw new DomainRuleError(
      `Empreinte SHA-256 invalide : ${SHA256_HEX_LENGTH} caractères hexadécimaux attendus.`
    );
  }
  return normalized;
}

/** « sha256:9f3ab21c…e4d07f » pour les écrans : lisible sans être copiable. */
export function shortFingerprint(sha256: string): string {
  const hash = normalizeSha256(sha256);
  return `sha256:${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function normalizeMimeType(value: string): string {
  const normalized = value.trim().toLowerCase() || "application/octet-stream";
  if (!ACCEPTED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new DomainRuleError(
      `Type de fichier refusé : « ${normalized} ». Formats acceptés : PDF, images (PNG, JPEG, WEBP, GIF), textes et CSV, documents bureautiques ouverts, ZIP.`
    );
  }
  return normalized;
}

export function normalizeFileName(value: string): string {
  const name = value.trim().replace(/[/\\]/g, "-");
  if (name.length === 0) {
    throw new DomainRuleError("Le nom du fichier est obligatoire.");
  }
  if (name.length > 180) {
    throw new DomainRuleError("Le nom du fichier ne peut pas dépasser 180 caractères.");
  }
  return name;
}

export function assertAttachmentSize(sizeBytes: number): number {
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
    throw new DomainRuleError(`Taille de fichier invalide : ${sizeBytes} octets.`);
  }
  if (sizeBytes === 0) {
    throw new DomainRuleError("Le fichier est vide.");
  }
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new DomainRuleError(
      `Fichier trop volumineux : ${formatByteSize(sizeBytes)} pour un maximum de ${formatByteSize(
        MAX_ATTACHMENT_BYTES
      )}.`
    );
  }
  return sizeBytes;
}

export function createAttachment(input: AttachmentInput): AttachmentData {
  if (input.organizationId.trim().length === 0) {
    throw new DomainRuleError("L'organisation est obligatoire.");
  }
  if (input.entryId.trim().length === 0) {
    throw new DomainRuleError("La pièce à laquelle rattacher le justificatif est obligatoire.");
  }
  return {
    id: input.id ?? crypto.randomUUID(),
    organizationId: input.organizationId,
    entryId: input.entryId,
    fileName: normalizeFileName(input.fileName),
    mimeType: normalizeMimeType(input.mimeType),
    sizeBytes: assertAttachmentSize(input.sizeBytes),
    sha256: normalizeSha256(input.sha256),
    notes: input.notes?.trim() ?? "",
    uploadedAt: input.uploadedAt ?? new Date().toISOString(),
    uploadedBy: input.uploadedBy.trim() || "utilisateur"
  };
}

/** « 1,2 Mo » — formatage français construit à la main (pas d'espace insécable U+202F). */
export function formatByteSize(sizeBytes: number): string {
  const units = ["o", "Ko", "Mo", "Go"] as const;
  const digits = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  let value = Math.abs(sizeBytes);
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = units[unitIndex] ?? "o";
  return `${digits.format(value)} ${unit}`;
}
