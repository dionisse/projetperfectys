/**
 * Rendu Excel (.xlsx) : le document reste **calculable**.
 *
 * Ce qu'un comptable attend d'une sortie Excel et que le PDF ne peut pas donner :
 *  - des montants en **nombres** (format `#,##0.00`), pas en texte formaté, pour pouvoir
 *    sommer, filtrer et retraiter sans ressaisie ;
 *  - un volet figé sous la ligne de titres, et un filtre automatique sur le tableau ;
 *  - une mise en page imprimable (A4, ajustée en largeur, répétition des titres) ;
 *  - l'identité de la société et les paramètres de l'édition en bandeau, pour qu'une
 *    feuille isolée reste identifiable.
 *
 * `exceljs` est chargé à la demande : ses ≈ 900 Ko ne pèsent pas sur le démarrage de la
 * PWA, seulement sur le premier export Excel.
 */

import type { ExportCell, ExportColumn, ExportDocument, ExportRow, ExportedFile } from "@perfecto/contracts";
import { exportFormatExtensions, exportMimeTypes } from "@perfecto/contracts";
import { formatTimestampFr, organizationHeaderLines } from "@perfecto/domain";
import {
  EMPTY_DOCUMENT_LABEL,
  columnWidthChars,
  preferredOrientation,
  toSafeFileName,
  toSheetName
} from "./text";

type ExcelNamespace = typeof import("exceljs");
type CellValue = import("exceljs").CellValue;

const FONT = "Calibri";
const INK = "FF1F2937";
const MUTED = "FF6B7280";
const HEADER_FILL = "FFEFF3F8";
const EMPHASIS_FILL = "FFF6F7F9";
const LINE = "FFCBD6E6";
const AMOUNT_FORMAT = "#,##0.00";

/** `exceljs` n'a pas d'export nommé à l'exécution : on accepte les deux formes. */
async function loadExcel(): Promise<ExcelNamespace> {
  const loaded = (await import("exceljs")) as ExcelNamespace & { default?: ExcelNamespace };
  return loaded.Workbook ? loaded : (loaded.default as ExcelNamespace);
}

function horizontal(column: ExportColumn): "left" | "right" | "center" {
  return column.align === "right" ? "right" : column.align === "center" ? "center" : "left";
}

/** Valeur de cellule : un nombre pour les montants (calculable), du texte sinon. */
function cellValue(column: ExportColumn, cell: ExportCell): unknown {
  if ((column.kind === "amount" || column.kind === "number") && typeof cell.value === "number") {
    return cell.value;
  }
  if (column.kind === "date" && typeof cell.value === "string" && cell.value.length > 0) {
    return cell.value;
  }
  return cell.text;
}

export async function renderExcel(document: ExportDocument): Promise<ExportedFile> {
  const Excel = await loadExcel();
  const workbook = new Excel.Workbook();
  workbook.creator = `PERFECTO · ${document.generatedBy}`;
  workbook.created = new Date(document.generatedAt);
  workbook.title = document.title;
  workbook.subject = document.subtitle;
  workbook.company = document.organization.name;

  const columns = document.columns;
  const width = Math.max(columns.length, 2);
  const sheet = workbook.addWorksheet(toSheetName(document.title), {
    views: [{ state: "frozen", ySplit: 0 }]
  });

  for (let index = 0; index < columns.length; index += 1) {
    sheet.getColumn(index + 1).width = columnWidthChars(columns[index]!);
  }

  /** Ligne de texte pleine largeur, mise en forme en une fois. */
  const banner = (
    rowIndex: number,
    text: string,
    style: { size?: number; bold?: boolean; italic?: boolean; color?: string }
  ) => {
    const row = sheet.getRow(rowIndex);
    row.getCell(1).value = text;
    sheet.mergeCells(rowIndex, 1, rowIndex, width);
    const cell = row.getCell(1);
    cell.font = {
      name: FONT,
      size: style.size ?? 9,
      bold: style.bold ?? false,
      italic: style.italic ?? false,
      color: { argb: style.color ?? INK }
    };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
    return row;
  };

  // Bandeau d'identité.
  let cursor = 1;
  banner(cursor, document.title, { size: 15, bold: true });
  sheet.getRow(cursor).height = 22;
  cursor += 1;
  if (document.subtitle.length > 0) {
    banner(cursor, document.subtitle, { size: 10, italic: true, color: MUTED });
    cursor += 1;
  }
  for (const line of organizationHeaderLines(document.organization)) {
    banner(cursor, line, { size: 9, color: MUTED });
    cursor += 1;
  }
  banner(cursor, `${document.fiscalYear} · montants en ${document.currency}`, {
    size: 9,
    color: MUTED
  });
  cursor += 1;
  banner(
    cursor,
    `Document généré le ${formatTimestampFr(document.generatedAt)} par ${document.generatedBy}`,
    { size: 9, italic: true, color: MUTED }
  );
  cursor += 2;

  // Paramètres de l'édition.
  for (const field of document.fields) {
    const row = sheet.getRow(cursor);
    row.getCell(1).value = field.label;
    row.getCell(1).font = { name: FONT, size: 9, bold: true, color: { argb: INK } };
    row.getCell(2).value = field.text;
    row.getCell(2).font = { name: FONT, size: 9, color: { argb: INK } };
    if (width > 2) sheet.mergeCells(cursor, 2, cursor, width);
    cursor += 1;
  }
  if (document.fields.length > 0) cursor += 1;

  // Ligne de titres du tableau.
  const headerRow = cursor;
  const header = sheet.getRow(headerRow);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.label;
    cell.font = { name: FONT, size: 9.5, bold: true, color: { argb: INK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: horizontal(column), vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: LINE } } };
  });
  header.height = 20;
  cursor += 1;

  const writeRow = (row: ExportRow, rowIndex: number) => {
    const target = sheet.getRow(rowIndex);
    const emphasized = row.emphasis === "section" || row.emphasis === "total";
    columns.forEach((column, index) => {
      const cell = target.getCell(index + 1);
      const source = row.cells[index] ?? { text: "" };
      cell.value = cellValue(column, source) as CellValue;
      cell.font = { name: FONT, size: 9.5, bold: emphasized, color: { argb: INK } };
      cell.alignment = {
        horizontal: horizontal(column),
        vertical: "top",
        wrapText: column.kind === "text" && columnWidthChars(column) < 24
      };
      if (column.kind === "amount") cell.numFmt = AMOUNT_FORMAT;
      if (emphasized) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPHASIS_FILL } };
      }
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
    });
    return target;
  };

  if (document.rows.length === 0) {
    const empty = sheet.getRow(cursor);
    empty.getCell(1).value = EMPTY_DOCUMENT_LABEL;
    empty.getCell(1).font = { name: FONT, size: 9.5, italic: true, color: { argb: MUTED } };
    sheet.mergeCells(cursor, 1, cursor, width);
    cursor += 1;
  } else {
    for (const row of document.rows) {
      writeRow(row, cursor);
      cursor += 1;
    }
  }

  const lastDataRow = cursor - 1;
  if (document.totals) {
    const totals = writeRow({ ...document.totals, emphasis: "total" }, cursor);
    totals.eachCell((cell) => {
      cell.border = { top: { style: "thin", color: { argb: LINE } } };
    });
    cursor += 1;
  }

  // Volet figé sous les titres : la lecture d'un grand livre de 500 lignes reste possible.
  sheet.views = [{ state: "frozen", ySplit: headerRow }];
  if (document.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: lastDataRow, column: columns.length }
    };
  }

  cursor += 1;
  const footer = sheet.getRow(cursor);
  footer.getCell(1).value = document.footer;
  footer.getCell(1).font = { name: FONT, size: 8.5, italic: true, color: { argb: MUTED } };
  footer.getCell(1).alignment = { wrapText: true, vertical: "top" };
  sheet.mergeCells(cursor, 1, cursor, width);
  footer.height = 26;

  // Mise en page imprimable : A4, ajustée en largeur, titres répétés sur chaque page.
  Object.assign(sheet.pageSetup, {
    paperSize: 9, // A4
    orientation: preferredOrientation(document),
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerRow}:${headerRow}`
  });

  const buffer = (await workbook.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  const bytes = new Uint8Array(buffer);

  return {
    fileName: toSafeFileName(document.slug, exportFormatExtensions.excel),
    mimeType: exportMimeTypes.excel,
    format: "excel",
    sizeBytes: bytes.byteLength,
    bytes
  };
}
