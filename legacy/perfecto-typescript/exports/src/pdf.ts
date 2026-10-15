/**
 * Rendu PDF : impression et archive.
 *
 * Contraintes traitées ici, toutes vérifiées à la sonde sur jsPDF 4 / autotable 5 :
 *  - les polices standard (Helvetica, WinAnsi) **silencent** les caractères hors latin1 :
 *    chaque chaîne passe par {@link sanitizeForPdf}, sinon « — », « Œ » et « € »
 *    disparaissent du texte imprimé sans aucun avertissement ;
 *  - `doc.scaleFactor()` n'existe plus : tout est calculé en millimètres ;
 *  - `jspdf-autotable` avertit en console et déborde si la somme des largeurs dépasse la
 *    largeur utile : les largeurs sont mises à l'échelle de la page ;
 *  - `lastAutoTable.pageCount` a disparu : le nombre de pages vient de
 *    `doc.getNumberOfPages()`, ce qui permet de numéroter « Page n/N » en fin de rendu.
 *
 * Mise en page : A4, marges 12/14/18 mm, en-tête complet en page 1 (société, titre,
 * paramètres de l'édition), en-tête compact dès la page 2, pied de page numéroté.
 *
 * `jspdf` et `jspdf-autotable` sont chargés à la demande : leur poids ne pèse pas sur le
 * démarrage de la PWA, seulement sur le premier export PDF.
 */

import type { ExportColumn, ExportDocument, ExportedFile } from "@perfecto/contracts";
import { exportFormatExtensions, exportMimeTypes } from "@perfecto/contracts";
import { formatTimestampFr, organizationHeaderLines } from "@perfecto/domain";
import type { jsPDF } from "jspdf";
import type { CellInput, RowInput } from "jspdf-autotable";
import {
  EMPTY_DOCUMENT_LABEL,
  PDF_MARGIN_MM,
  PDF_PAGE_HEIGHT_MM,
  PDF_PAGE_WIDTH_MM,
  preferredOrientation,
  sanitizeForPdf,
  scaledWidthsMm,
  toSafeFileName
} from "./text";

const INK: [number, number, number] = [31, 41, 55];
const MUTED: [number, number, number] = [107, 114, 128];
const RULE: [number, number, number] = [203, 214, 230];
const HEADER_FILL: [number, number, number] = [239, 243, 248];
const EMPHASIS_FILL: [number, number, number] = [246, 247, 249];

/** Largeur réellement imprimable, une fois les marges posées. */
function usableWidthMm(orientation: "portrait" | "landscape"): number {
  const pageWidth = orientation === "landscape" ? PDF_PAGE_HEIGHT_MM : PDF_PAGE_WIDTH_MM;
  return pageWidth - PDF_MARGIN_MM.left - PDF_MARGIN_MM.right;
}

export async function renderPdf(document: ExportDocument): Promise<ExportedFile> {
  const [{ jsPDF: JsPdf }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  const autoTable = (autoTableModule.default ?? autoTableModule.autoTable) as typeof autoTableModule.autoTable;

  const orientation = preferredOrientation(document);
  const doc: jsPDF = new JsPdf({
    unit: "mm",
    format: "a4",
    orientation,
    compress: true
  });

  const usable = usableWidthMm(orientation);
  const widths = scaledWidthsMm(document.columns, usable);
  const left = PDF_MARGIN_MM.left;

  const write = (
    text: string,
    y: number,
    style: { size: number; bold?: boolean; italic?: boolean; color?: [number, number, number]; maxWidth?: number }
  ): number => {
    doc.setFont("helvetica", style.bold ? "bold" : style.italic ? "italic" : "normal");
    doc.setFontSize(style.size);
    doc.setTextColor(...(style.color ?? INK));
    const content = sanitizeForPdf(text);
    const lines = style.maxWidth ? doc.splitTextToSize(content, style.maxWidth) : [content];
    doc.text(lines, left, y);
    return y + lines.length * style.size * 0.42;
  };

  /** En-tête compact des pages suivantes : société et titre sur une ligne. */
  const drawRunningHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const head = sanitizeForPdf(`${document.organization.name} — ${document.title}`);
    doc.text(head, left, 9);
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(left, 11, left + usable, 11);
  };

  // ---- Page 1 : en-tête complet ----
  let cursor: number = PDF_MARGIN_MM.top;
  const headerLines = organizationHeaderLines(document.organization);
  headerLines.forEach((line, index) => {
    cursor = write(line, cursor, {
      size: index === 0 ? 9.5 : 8,
      bold: index === 0,
      color: index === 0 ? INK : MUTED
    });
  });
  cursor += 2;
  cursor = write(document.title, cursor, { size: 14, bold: true });
  if (document.subtitle.length > 0) {
    cursor = write(document.subtitle, cursor, { size: 9.5, italic: true, color: MUTED });
  }
  cursor += 1;

  // Paramètres de l'édition, sur deux colonnes pour tenir en hauteur.
  if (document.fields.length > 0) {
    const labelWidth = Math.min(38, usable * 0.28);
    const valueWidth = usable - labelWidth;
    const half = Math.ceil(document.fields.length / 2);
    let y = cursor;
    for (let index = 0; index < half; index += 1) {
      const pair = [document.fields[index], document.fields[index + half]];
      let rowHeight = 0;
      pair.forEach((field, slot) => {
        if (!field) return;
        const x = left + slot * (usable / 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(sanitizeForPdf(`${field.label} :`), x, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...INK);
        const available = slot === 0 ? usable / 2 - labelWidth - 2 : valueWidth / 2;
        const value = doc.splitTextToSize(sanitizeForPdf(field.text), Math.max(20, available));
        doc.text(value, x + labelWidth * (slot === 0 ? 1 : 0.55), y);
        rowHeight = Math.max(rowHeight, value.length * 3.4);
      });
      y += Math.max(rowHeight, 3.8);
    }
    cursor = y + 1;
    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.2);
    doc.line(left, cursor, left + usable, cursor);
    cursor += 3;
  }

  // ---- Tableau ----
  type BodyRow = { cells: string[]; emphasis: string | undefined };
  const bodyRows: BodyRow[] = document.rows.map((row) => ({
    cells: document.columns.map((_column, index) => sanitizeForPdf(row.cells[index]?.text ?? "")),
    emphasis: row.emphasis
  }));
  if (document.totals) {
    bodyRows.push({
      cells: document.columns.map(
        (_column, index) => sanitizeForPdf(document.totals?.cells[index]?.text ?? "")
      ),
      emphasis: "total"
    });
  }

  const columnStyles: Record<number, { cellWidth: number; halign: "left" | "right" | "center" }> = {};
  document.columns.forEach((column: ExportColumn, index: number) => {
    columnStyles[index] = {
      cellWidth: widths[index] ?? 20,
      halign: column.align === "right" ? "right" : column.align === "center" ? "center" : "left"
    };
  });

  const body: RowInput[] =
    bodyRows.length > 0
      ? bodyRows.map((row) => row.cells as CellInput[])
      : [
          [
            {
              content: sanitizeForPdf(EMPTY_DOCUMENT_LABEL),
              colSpan: Math.max(document.columns.length, 1),
              styles: { fontStyle: "italic", halign: "center", textColor: MUTED }
            } satisfies CellInput
          ]
        ];

  autoTable(doc, {
    startY: cursor,
    head: [document.columns.map((column) => sanitizeForPdf(column.label))],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 1.2,
      lineColor: RULE,
      lineWidth: 0.1,
      textColor: INK,
      overflow: "linebreak",
      valign: "top"
    },
    headStyles: {
      fillColor: HEADER_FILL,
      textColor: [23, 37, 84],
      fontStyle: "bold",
      fontSize: 7.5,
      cellPadding: 1.4
    },
    columnStyles,
    margin: {
      top: PDF_MARGIN_MM.top,
      right: PDF_MARGIN_MM.right,
      bottom: PDF_MARGIN_MM.bottom,
      left: PDF_MARGIN_MM.left
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) drawRunningHeader();
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = bodyRows[data.row.index];
      if (row?.emphasis === "section" || row?.emphasis === "total") {
        data.cell.styles.fillColor = EMPHASIS_FILL;
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let footerY = (table?.finalY ?? cursor) + 5;

  // ---- Mention finale : elle suit le tableau, jamais en chevauchement ----
  const pageCount = doc.getNumberOfPages();
  doc.setPage(pageCount);
  const footerLines = doc.splitTextToSize(sanitizeForPdf(document.footer), usable);
  const pageHeight = orientation === "landscape" ? PDF_PAGE_WIDTH_MM : PDF_PAGE_HEIGHT_MM;
  if (footerY + footerLines.length * 3.4 > pageHeight - PDF_MARGIN_MM.bottom) {
    doc.addPage();
    drawRunningHeader();
    footerY = PDF_MARGIN_MM.top + 6;
  }
  write(footerLines.length > 0 ? document.footer : "", footerY, {
    size: 7.5,
    italic: true,
    color: MUTED,
    maxWidth: usable
  });

  // ---- Numérotation « Page n/N » sur toutes les pages ----
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(sanitizeForPdf(document.slug), left, pageHeight - 8);
    doc.text(`Page ${page}/${total}`, left + usable, pageHeight - 8, { align: "right" });
  }

  const bytes = new Uint8Array(doc.output("arraybuffer"));

  return {
    fileName: toSafeFileName(document.slug, exportFormatExtensions.pdf),
    mimeType: exportMimeTypes.pdf,
    format: "pdf",
    sizeBytes: bytes.byteLength,
    bytes
  };
}
