/**
 * Préparations de texte partagées par les trois moteurs de rendu.
 *
 * Un document PERFECTO est lu par des outils très différents : Excel, un lecteur PDF,
 * un logiciel comptable tiers qui importe du CSV. Ces helpers garantissent que le même
 * contenu passe partout sans caractère perdu ni mise en page cassée.
 *
 * Point d'attention vérifié à la sonde : les polices standard d'un PDF (Helvetica,
 * encodage WinAnsi) **silencent** les caractères hors latin1 — le tiret cadratin « — »,
 * la ligature « Œ » et le symbole « € » disparaissent du texte extrait. D'où la
 * normalisation explicite de {@link sanitizeForPdf}.
 */

import type { ExportColumn, ExportDocument } from "@perfecto/contracts";

/** Espaces insécables et tirets typographiques : absents ou instables en WinAnsi. */
const PDF_REPLACEMENTS: readonly (readonly [RegExp, string])[] = [
  [/[\u202F\u00A0\u2009\u2002\u2003\u2007\u200A]/g, " "],
  [/[\u2013\u2014\u2015\u2212]/g, "-"],
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/\u2026/g, "..."],
  [/\u0152/g, "OE"],
  [/\u0153/g, "oe"],
  [/\u20AC/g, "EUR"],
  [/\u2022/g, "-"],
  [/\u2192/g, "->"],
  [/\u2260/g, "!="],
  [/\u2264/g, "<="],
  [/\u2265/g, ">="]
];

/**
 * Rend un texte imprimable avec les polices PDF standard.
 *
 * Les espaces insécables deviennent des espaces simples (les comparaisons de chaînes et
 * les rendus ne cassent plus), les caractères typographiques sont translittérés, et tout
 * ce qui resterait hors latin1 est supprimé plutôt que perdu silencieusement.
 */
export function sanitizeForPdf(text: string): string {
  let out = text;
  for (const [pattern, replacement] of PDF_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  // Latin1 imprimable uniquement : 0x20-0x7E (ASCII) et 0xA1-0xFF (accents, « » , ·).
  return out.replace(/[^\u0020-\u007E\u00A1-\u00FF]/g, "");
}

export const MIN_COLUMN_WIDTH_MM = 12;
export const MAX_COLUMN_WIDTH_MM = 90;

/** Largeur indicative d'une colonne, en caractères, à défaut d'être précisée. */
export function columnWidthChars(column: ExportColumn): number {
  if (typeof column.width === "number" && column.width > 0) {
    return column.width;
  }
  if (column.kind === "amount") return 14;
  if (column.kind === "date") return 11;
  return Math.max(column.label.length + 4, 10);
}

/**
 * Largeur de colonne en millimètres, bornée pour rester lisible sur une page A4.
 *
 * Le facteur est calibré sur le corps du tableau PDF (Helvetica 7,5 pt, soit ≈ 1,4 mm
 * par caractère) plus le rembourrage de cellule : une balance à six colonnes tient en
 * portrait (163 mm pour 186 mm utiles), un grand livre détaillé à treize colonnes passe
 * en paysage. Un facteur plus généreux ferait basculer des documents étroits en paysage
 * sans raison, et l'impression deviendrait illisible.
 */
export function columnWidthMm(column: ExportColumn): number {
  const raw = Math.round(columnWidthChars(column) * 1.4 + 3);
  return Math.min(MAX_COLUMN_WIDTH_MM, Math.max(MIN_COLUMN_WIDTH_MM, raw));
}

/** Marges PDF, en millimètres : gauche/droite, haut, bas. */
export const PDF_MARGIN_MM = { left: 12, right: 12, top: 14, bottom: 18 } as const;

export const PDF_PAGE_WIDTH_MM = 210;
export const PDF_PAGE_HEIGHT_MM = 297;

/** Largeur réellement utilisable en portrait, une fois les marges posées. */
export const PDF_USABLE_WIDTH_MM = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM.left - PDF_MARGIN_MM.right;

/** Somme des largeurs de colonnes, en millimètres. */
export function totalWidthMm(columns: readonly ExportColumn[]): number {
  return columns.reduce((total, column) => total + columnWidthMm(column), 0);
}

/**
 * Orientation de la page : paysage dès que le tableau ne tient pas en portrait.
 * Le seuil est la largeur A4 utile (186 mm), pas la largeur brute du papier.
 */
export function preferredOrientation(document: ExportDocument): "portrait" | "landscape" {
  return totalWidthMm(document.columns) > PDF_USABLE_WIDTH_MM ? "landscape" : "portrait";
}

/**
 * Largeurs de colonnes mises à l'échelle de la page.
 *
 * `jspdf-autotable` avertit en console et déborde quand la somme dépasse la largeur
 * utile : on répartit proportionnellement au lieu de laisser le moteur tronquer.
 */
export function scaledWidthsMm(
  columns: readonly ExportColumn[],
  usableWidthMm: number
): number[] {
  const widths = columns.map((column) => columnWidthMm(column));
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= usableWidthMm || total === 0) return widths;
  const ratio = usableWidthMm / total;
  return widths.map((width) => Math.max(10, Math.round(width * ratio * 100) / 100));
}

/** Nombre décimal à la française : virgule décimale, pas de séparateur de milliers. */
export function toCsvNumber(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(decimals).replace(".", ",");
}

const SHEET_FORBIDDEN = /[[\]:*?/\\]/g;

/**
 * Nom d'onglet Excel : 31 caractères maximum, sans `[]:*?/\`.
 * `"Grand livre : 401/411 [détail]"` -> `"Grand livre - 401-411 -détail-"`.
 */
export function toSheetName(title: string): string {
  const cleaned = title.replace(SHEET_FORBIDDEN, "-").replace(/\s+/g, " ").trim();
  return (cleaned.length > 0 ? cleaned : "Document").slice(0, 31);
}

const FILENAME_FORBIDDEN = /[/\\:*?"<>|]/g;

/**
 * Nom de fichier sûr, accents conservés :
 * `"PERFECTO/balance:générale?"` + `"pdf"` -> `"PERFECTO-balance-générale.pdf"`.
 */
export function toSafeFileName(slug: string, extension: string): string {
  const cleaned = slug
    .replace(FILENAME_FORBIDDEN, "-")
    .replace(/\s+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = extension.replace(/^\.+/, "");
  return `${cleaned.length > 0 ? cleaned : "document"}.${suffix}`;
}

/** Mention d'un document sans donnée : jamais de fichier vide ni ambigu. */
export const EMPTY_DOCUMENT_LABEL = "Néant : aucun mouvement ne correspond aux critères.";
