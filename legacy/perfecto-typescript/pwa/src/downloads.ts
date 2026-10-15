/**
 * Téléchargement des éditions dans le navigateur.
 *
 * Le noyau construit le document, `@perfecto/exports` le rend dans le format demandé, et
 * ce module ne fait que le remettre au navigateur : un `Blob`, un objet-URL, une ancre
 * cliquée, puis la révocation de l'URL. Aucune donnée ne quitte le poste — la génération
 * reste locale et hors ligne, comme le reste de l'application.
 *
 * Pourquoi une ancre plutôt que `window.open` : un document PDF ouvert dans un onglet
 * dépend des réglages du navigateur (lecteur intégré ou téléchargement forcé), et les
 * navigateurs mobiles bloquent souvent l'ouverture différée. Le téléchargement, lui, est
 * explicite et identique sur tous les formats — la spécification d'origine posait déjà
 * ce principe : pas de dépendance à une imprimante.
 */

import type { ExportDocumentRequest, ExportFormat, ExportedFile } from "@perfecto/contracts";
import { exportFormatShortLabels } from "@perfecto/contracts";
import { renderDocument } from "@perfecto/exports";
import { formatByteSize } from "@perfecto/domain";
import { getKernel } from "./kernel";

/** Construit le fichier sans le télécharger : utile pour l'aperçu et les tests. */
export async function exportDocument(
  request: ExportDocumentRequest,
  format: ExportFormat
): Promise<ExportedFile> {
  const document = await getKernel().getExportDocument(request);
  return renderDocument(format, document);
}

/**
 * Remet le fichier au navigateur.
 *
 * @returns `false` quand l'environnement n'expose pas les objets-URL (tests sous jsdom) :
 * le fichier est bien construit, seule la remise au navigateur est impossible.
 */
export function downloadFile(file: ExportedFile): boolean {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return false;
  }

  // Copie : le Blob attend un tampon au type sûr, pas un Uint8Array<ArrayBufferLike>.
  const bytes = new Uint8Array(file.bytes);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // L'URL reste nécessaire jusqu'à ce que le navigateur ait lu le Blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

/** « balance_2026-03-01.xlsx · Excel · 14,3 ko » : ce que l'utilisateur vient d'obtenir. */
export function describeFile(file: ExportedFile): string {
  return `${file.fileName} · ${exportFormatShortLabels[file.format]} · ${formatByteSize(file.sizeBytes)}`;
}

/** Message affiché après un téléchargement, succès comme échec. */
export function exportOutcomeMessage(file: ExportedFile, downloaded: boolean): string {
  return downloaded
    ? `${describeFile(file)} téléchargé.`
    : `${describeFile(file)} généré (téléchargement indisponible dans cet environnement).`;
}
