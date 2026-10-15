/**
 * Moteurs de rendu des documents PERFECTO.
 *
 * Le noyau produit un {@link ExportDocument} neutre (titre, champs d'identité, colonnes,
 * lignes, totaux, pied de page) ; ce paquet le met en forme dans les trois formats exigés
 * par la décision du 14/10/2026 — **PDF, Excel et CSV, au choix de l'utilisateur** — sans
 * jamais recalculer un montant ni réinterpréter une règle métier.
 *
 * Les moteurs Excel et PDF sont chargés dynamiquement : une PWA qui n'exporte rien ne
 * télécharge ni `exceljs` ni `jspdf`.
 */

import type { ExportDocument, ExportFormat, ExportedFile } from "@perfecto/contracts";
import { DomainRuleError } from "@perfecto/domain";
import { renderCsv } from "./csv";
import { renderExcel } from "./excel";
import { renderPdf } from "./pdf";

/** Ordre d'affichage proposé à l'utilisateur : archive, calcul, échange. */
export const EXPORT_FORMATS: readonly ExportFormat[] = ["pdf", "excel", "csv"];

/**
 * Rend un document dans le format demandé.
 *
 * Un format hors contrat est refusé en français, avec les formats acceptés : l'écran
 * affiche la raison au lieu de produire un fichier illisible.
 */
export async function renderDocument(
  format: ExportFormat,
  document: ExportDocument
): Promise<ExportedFile> {
  switch (format) {
    case "csv":
      return renderCsv(document);
    case "excel":
      return renderExcel(document);
    case "pdf":
      return renderPdf(document);
    default:
      throw new DomainRuleError(
        `Format d'export inconnu : « ${String(format)} ». Formats acceptés : PDF, Excel, CSV.`
      );
  }
}

export { renderCsv } from "./csv";
export { renderExcel } from "./excel";
export { renderPdf } from "./pdf";
export * from "./text";
