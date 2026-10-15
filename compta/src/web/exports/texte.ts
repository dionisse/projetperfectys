/**
 * Préparations de texte partagées par les moteurs de rendu.
 *
 * Un même document est lu par des outils très différents : Excel, un lecteur PDF, un logiciel
 * comptable tiers qui importe du CSV. Ces helpers garantissent que le contenu passe partout sans
 * caractère perdu ni mise en page cassée.
 *
 * Point d'attention vérifié à la sonde sur jsPDF 4 : les polices standard d'un PDF (Helvetica,
 * encodage WinAnsi) **silencent** les caractères hors latin1 — l'espace insécable étroite que
 * `formatMontant` emploie comme séparateur de milliers, le tiret cadratin, la ligature « Œ » et le
 * symbole « € » disparaissent du texte imprimé sans aucun avertissement. D'où la normalisation
 * explicite de `nettoyerPourPdf`.
 */

import type { ColonneAExporter, DocumentAExporter } from "./document";

/** Espaces insécables et tirets typographiques : absents ou instables en WinAnsi. */
const REMPLACEMENTS_PDF: readonly (readonly [RegExp, string])[] = [
  [/[\u202F\u00A0\u2009\u2002\u2003\u2007\u200A]/g, " "],
  [/[\u2013\u2014\u2015\u2212]/g, "-"],
  [/[\u2018\u2019\u201A\u201B]/g, "'"],
  [/[\u201C\u201D\u201E\u201F]/g, '"'],
  [/\u2026/g, "..."],
  [/\u0152/g, "OE"],
  [/\u0153/g, "oe"],
  [/\u2022/g, "-"],
  [/\u2192/g, "->"],
  [/\u2260/g, "!="],
  [/\u2264/g, "<="],
  [/\u2265/g, ">="]
];

/**
 * Rend un texte imprimable avec les polices PDF standard.
 *
 * Les espaces insécables deviennent des espaces simples, les caractères typographiques sont
 * translittérés, et tout ce qui resterait hors latin1 est supprimé plutôt que perdu en silence.
 */
export function nettoyerPourPdf(texte: string): string {
  let sorti = texte;
  for (const [motif, remplacement] of REMPLACEMENTS_PDF) {
    sorti = sorti.replace(motif, remplacement);
  }
  // Le symbole monétaire n'est pas en latin1 : il est remplacé par le code ISO, qui ne prête pas à
  // confusion sur un état comptable.
  sorti = sorti.replace(/\u20AC/g, "EUR").replace(/XOF/g, "XOF");
  // Latin1 imprimable uniquement : 0x20-0x7E (ASCII) et 0xA1-0xFF (accents, « », ·).
  return sorti.replace(/[^\u0020-\u007E\u00A1-\u00FF]/g, "");
}

export const LARGEUR_MINIMALE_COLONNE_MM = 12;
export const LARGEUR_MAXIMALE_COLONNE_MM = 90;

/** Largeur indicative d'une colonne, en caractères, à défaut d'être précisée. */
export function largeurColonneEnCaracteres(colonne: ColonneAExporter): number {
  if (typeof colonne.largeur === "number" && colonne.largeur > 0) {
    return colonne.largeur;
  }
  if (colonne.genre === "montant") return 15;
  if (colonne.genre === "date") return 11;
  if (colonne.genre === "nombre") return 10;
  return Math.max(colonne.titre.length + 4, 10);
}

/**
 * Largeur de colonne en millimètres, bornée pour rester lisible sur une page A4.
 *
 * Le facteur est calibré sur le corps du tableau PDF (Helvetica 7,5 pt, soit ≈ 1,4 mm par
 * caractère) plus le rembourrage de cellule : une balance à neuf colonnes tient en portrait, un
 * grand livre détaillé passe en paysage. Un facteur plus généreux ferait basculer des documents
 * étroits en paysage sans raison, et l'impression deviendrait illisible.
 */
export function largeurColonneEnMm(colonne: ColonneAExporter): number {
  const brut = Math.round(largeurColonneEnCaracteres(colonne) * 1.4 + 3);
  return Math.min(LARGEUR_MAXIMALE_COLONNE_MM, Math.max(LARGEUR_MINIMALE_COLONNE_MM, brut));
}

/** Marges PDF, en millimètres. */
export const MARGES_PDF_MM = { gauche: 12, droite: 12, haut: 14, bas: 18 } as const;

export const LARGEUR_PAGE_MM = 210;
export const HAUTEUR_PAGE_MM = 297;

/** Largeur réellement utilisable en portrait, une fois les marges posées. */
export const LARGEUR_UTILE_PORTRAIT_MM = LARGEUR_PAGE_MM - MARGES_PDF_MM.gauche - MARGES_PDF_MM.droite;

/** Somme des largeurs de colonnes d'une section, en millimètres. */
export function largeurTotaleEnMm(colonnes: readonly ColonneAExporter[]): number {
  return colonnes.reduce((total, colonne) => total + largeurColonneEnMm(colonne), 0);
}

/** La section la plus large décide de l'orientation : un document ne change pas de sens en route. */
export function sectionLaPlusLarge(document: DocumentAExporter): ColonneAExporter[] {
  let gagnante: ColonneAExporter[] = [];
  let largeur = -1;
  for (const section of document.sections) {
    const colonnes = section.colonnes ?? [];
    if (colonnes.length === 0) continue;
    const totale = largeurTotaleEnMm(colonnes);
    if (totale > largeur) {
      largeur = totale;
      gagnante = colonnes;
    }
  }
  return gagnante;
}

/**
 * Orientation de la page : paysage dès que le tableau le plus large ne tient pas en portrait.
 * Le seuil est la largeur A4 utile (186 mm), pas la largeur brute du papier.
 */
export function orientationPreferree(document: DocumentAExporter): "portrait" | "paysage" {
  return largeurTotaleEnMm(sectionLaPlusLarge(document)) > LARGEUR_UTILE_PORTRAIT_MM ? "paysage" : "portrait";
}

/**
 * Largeurs de colonnes mises à l'échelle de la page.
 *
 * `jspdf-autotable` avertit en console et déborde quand la somme dépasse la largeur utile : on
 * répartit proportionnellement au lieu de laisser le moteur tronquer.
 */
export function largeursMiseAEchelleEnMm(
  colonnes: readonly ColonneAExporter[],
  largeurUtile: number
): number[] {
  const largeurs = colonnes.map((colonne) => largeurColonneEnMm(colonne));
  const total = largeurs.reduce((somme, largeur) => somme + largeur, 0);
  if (total <= largeurUtile || total === 0) return largeurs;
  const ratio = largeurUtile / total;
  return largeurs.map((largeur) => Math.max(10, Math.round(largeur * ratio * 100) / 100));
}

const INTERDITS_ONGLET = /[[\]:*?/\\]/g;

/**
 * Nom d'onglet Excel : 31 caractères maximum, sans `[]:*?/\`.
 * `"Grand livre : 401/411 [détail]"` devient `"Grand livre - 401-411 -détail-"`.
 */
export function nomDOnglet(titre: string): string {
  const propre = titre.replace(INTERDITS_ONGLET, "-").replace(/\s+/g, " ").trim();
  return (propre.length > 0 ? propre : "Document").slice(0, 31);
}

/** Mention d'un document sans donnée : jamais de fichier vide ni ambigu. */
export const MENTION_DOCUMENT_VIDE = "Néant : aucune ligne ne correspond aux critères.";
