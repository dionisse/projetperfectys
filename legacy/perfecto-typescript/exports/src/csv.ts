/**
 * Rendu CSV : échange de données avec un autre logiciel comptable.
 *
 * Conventions retenues, vérifiées avec Excel en français :
 *  - séparateur **point-virgule** (le réglage par défaut des Excel locaux en `fr-FR`,
 *    où la virgule est déjà le séparateur décimal) ;
 *  - **BOM UTF-8** en tête, sans quoi Excel affiche « NÃ©goce » au lieu de « Négoce » ;
 *  - fins de ligne **CRLF** ;
 *  - montants en convention française (`472000,00`), dates en ISO (`2026-01-12`) :
 *    un tableur les reconnaît comme nombres et dates, pas comme du texte ;
 *  - un document sans donnée l'écrit explicitement plutôt que de produire un fichier
 *    vide qu'un comptable pourrait croire complet.
 */

import type { ExportCell, ExportColumn, ExportDocument, ExportRow, ExportedFile } from "@perfecto/contracts";
import { exportFormatExtensions, exportMimeTypes } from "@perfecto/contracts";
import { formatTimestampFr, organizationHeaderLines } from "@perfecto/domain";
import { EMPTY_DOCUMENT_LABEL, toCsvNumber, toSafeFileName } from "./text";

/** Entoure de guillemets si le contenu peut casser la lecture en colonnes. */
function quote(value: string): string {
  if (value === "") return "";
  if (/[";\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Valeur d'une cellule dans la convention CSV : nombre pour un tableur, texte sinon. */
function cellValue(column: ExportColumn, cell: ExportCell | undefined): string {
  const value = cell?.value;
  if (column.kind === "amount" && typeof value === "number") {
    return toCsvNumber(value, 2);
  }
  if (column.kind === "number" && typeof value === "number") {
    return toCsvNumber(value, Number.isInteger(value) ? 0 : 2);
  }
  if (column.kind === "date" && typeof value === "string" && value.length > 0) {
    return value;
  }
  return cell?.text ?? "";
}

function rowToCsv(columns: readonly ExportColumn[], row: ExportRow): string {
  return columns.map((column, index) => quote(cellValue(column, row.cells[index]))).join(";");
}

export function renderCsv(document: ExportDocument): ExportedFile {
  const lines: string[] = [];

  // Bandeau d'identité : le fichier reste identifiable hors de son contexte.
  lines.push(quote(document.title));
  if (document.subtitle.length > 0) lines.push(quote(document.subtitle));
  for (const line of organizationHeaderLines(document.organization)) {
    lines.push(quote(line));
  }
  lines.push(quote(`${document.fiscalYear} · montants en ${document.currency}`));
  lines.push(
    quote(
      `Document généré le ${formatTimestampFr(document.generatedAt)} par ${document.generatedBy}`
    )
  );
  lines.push("");

  // Paramètres de l'édition : un importateur sait ce qu'il reçoit.
  for (const field of document.fields) {
    lines.push(`${quote(field.label)};${quote(field.text)}`);
  }
  if (document.fields.length > 0) lines.push("");

  // Tableau.
  lines.push(document.columns.map((column) => quote(column.label)).join(";"));
  if (document.rows.length === 0) {
    lines.push(quote(EMPTY_DOCUMENT_LABEL));
  } else {
    for (const row of document.rows) {
      lines.push(rowToCsv(document.columns, row));
    }
  }
  if (document.totals) {
    lines.push(rowToCsv(document.columns, document.totals));
  }

  lines.push("");
  lines.push(quote(document.footer));

  const body = `\uFEFF${lines.join("\r\n")}\r\n`;
  const bytes = new TextEncoder().encode(body);

  return {
    fileName: toSafeFileName(document.slug, exportFormatExtensions.csv),
    mimeType: exportMimeTypes.csv,
    format: "csv",
    sizeBytes: bytes.byteLength,
    bytes
  };
}
