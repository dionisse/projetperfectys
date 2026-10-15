/**
 * Rendu Excel (.xlsx) : le document reste **calculable**.
 *
 * Ce qu'un comptable attend d'une sortie Excel et que le PDF ne peut pas donner :
 *
 * - des montants en **nombres entiers** (format `#,##0`), pas en texte formaté, pour pouvoir sommer,
 *   filtrer et retraiter sans ressaisie. Le franc CFA n'a pas de subdivision : un format à deux
 *   décimales inventerait des centimes qui n'existent pas ;
 * - un **onglet par section** du document, chacun avec son volet figé sous la ligne de titres, son
 *   filtre automatique et sa mise en page imprimable ;
 * - l'identité de la société et les paramètres de l'édition en bandeau, pour qu'une feuille isolée
 *   reste identifiable ;
 * - les lignes de rubrique et de total en gras et surlignées.
 *
 * `exceljs` est chargé à la demande : son poids ne pèse pas sur le démarrage de l'application,
 * seulement sur le premier export Excel.
 */

import { nomDeFichier } from "../telechargement";
import {
  MIME_EXCEL,
  champsDuDocument,
  horodatageFr,
  lignesDIdentite,
  valeurDeCellule,
  type Cellule,
  type ColonneAExporter,
  type DocumentAExporter,
  type FichierExporte,
  type LigneAExporter
} from "./document";
import {
  MENTION_DOCUMENT_VIDE,
  largeurColonneEnCaracteres,
  nomDOnglet,
  orientationPreferree
} from "./texte";

type EspaceExcel = typeof import("exceljs");
type ValeurCellule = import("exceljs").CellValue;

const POLICE = "Calibri";
const ENCRE = "FF1F2937";
const DISCRET = "FF6B7280";
const FOND_ENTETE = "FFEFF3F8";
const FOND_EMPHASE = "FFF6F7F9";
const TRAIT = "FFCBD6E6";
/** Le franc CFA n'a pas de centimes : aucun format ne doit en inventer. */
const FORMAT_MONTANT = "#,##0";

/** `exceljs` n'a pas d'export nommé à l'exécution : les deux formes sont acceptées. */
async function chargerExcel(): Promise<EspaceExcel> {
  const charge = (await import("exceljs")) as EspaceExcel & { default?: EspaceExcel };
  return charge.Workbook ? charge : (charge.default as EspaceExcel);
}

function horizontal(colonne: ColonneAExporter): "left" | "right" | "center" {
  return colonne.alignement === "droite" ? "right" : colonne.alignement === "centre" ? "center" : "left";
}

/** Nom d'onglet unique : deux sections homonymes ne peuvent pas partager un onglet. */
function ongletUnique(titre: string, dejaPris: Set<string>): string {
  const base = nomDOnglet(titre);
  if (!dejaPris.has(base)) {
    dejaPris.add(base);
    return base;
  }
  for (let index = 2; index < 100; index += 1) {
    const suffixe = ` (${index})`;
    const candidat = base.slice(0, 31 - suffixe.length) + suffixe;
    if (!dejaPris.has(candidat)) {
      dejaPris.add(candidat);
      return candidat;
    }
  }
  dejaPris.add(base);
  return base;
}

export async function rendreExcel(document: DocumentAExporter): Promise<FichierExporte> {
  const Excel = await chargerExcel();
  const classeur = new Excel.Workbook();
  classeur.creator = `Perfectys Compta · ${document.generePar}`;
  classeur.created = new Date(document.genereLe);
  classeur.title = document.titre;
  classeur.subject = document.sousTitre;
  classeur.company = document.societe.raisonSociale;

  const orientation = orientationPreferree(document) === "paysage" ? "landscape" : "portrait";
  const dejaPris = new Set<string>();

  document.sections.forEach((section, indexSection) => {
    const colonnes = section.colonnes;
    const largeur = Math.max(colonnes.length, 2);
    const feuille = classeur.addWorksheet(ongletUnique(section.titre, dejaPris), {
      views: [{ state: "frozen", ySplit: 0 }]
    });

    for (let index = 0; index < colonnes.length; index += 1) {
      feuille.getColumn(index + 1).width = largeurColonneEnCaracteres(colonnes[index]!);
    }

    /** Ligne de texte pleine largeur, mise en forme en une fois. */
    const bandeau = (
      numero: number,
      texte: string,
      style: { taille?: number; gras?: boolean; italique?: boolean; couleur?: string }
    ) => {
      const ligne = feuille.getRow(numero);
      ligne.getCell(1).value = texte;
      feuille.mergeCells(numero, 1, numero, largeur);
      const cellule = ligne.getCell(1);
      cellule.font = {
        name: POLICE,
        size: style.taille ?? 9,
        bold: style.gras ?? false,
        italic: style.italique ?? false,
        color: { argb: style.couleur ?? ENCRE }
      };
      cellule.alignment = { vertical: "middle", horizontal: "left", wrapText: false };
      return ligne;
    };

    let curseur = 1;
    if (indexSection === 0) {
      // Le premier onglet porte l'identité complète ; les suivants la rappellent en une ligne, pour
      // qu'une feuille imprimée seule reste attributable.
      bandeau(curseur, document.titre, { taille: 15, gras: true });
      feuille.getRow(curseur).height = 22;
      curseur += 1;
      if (document.sousTitre.length > 0) {
        bandeau(curseur, document.sousTitre, { taille: 10, italique: true, couleur: DISCRET });
        curseur += 1;
      }
      for (const ligne of lignesDIdentite(document)) {
        bandeau(curseur, ligne, { taille: 9, couleur: DISCRET });
        curseur += 1;
      }
      bandeau(curseur, `${document.exercice} · montants en ${document.devise}`, { taille: 9, couleur: DISCRET });
      curseur += 1;
      bandeau(
        curseur,
        `Document généré le ${horodatageFr(document.genereLe)} par ${document.generePar}`,
        { taille: 9, italique: true, couleur: DISCRET }
      );
      curseur += 2;
    } else {
      bandeau(curseur, `${document.societe.raisonSociale} — ${document.titre}`, { taille: 11, gras: true });
      curseur += 1;
      bandeau(curseur, section.titre, { taille: 10, italique: true, couleur: DISCRET });
      curseur += 1;
      bandeau(curseur, `${document.exercice} · montants en ${document.devise}`, { taille: 9, couleur: DISCRET });
      curseur += 2;
    }

    // Les paramètres de l'édition, puis ceux de la section.
    const champs = indexSection === 0 ? [...champsDuDocument(document), ...section.champs] : section.champs;
    for (const champ of champs) {
      const ligne = feuille.getRow(curseur);
      ligne.getCell(1).value = champ.libelle;
      ligne.getCell(1).font = { name: POLICE, size: 9, bold: true, color: { argb: ENCRE } };
      ligne.getCell(2).value = champ.valeur;
      ligne.getCell(2).font = { name: POLICE, size: 9, color: { argb: ENCRE } };
      ligne.getCell(2).alignment = { wrapText: true, vertical: "top" };
      if (largeur > 2) {
        feuille.mergeCells(curseur, 2, curseur, largeur);
      }
      curseur += 1;
    }
    if (champs.length > 0) {
      curseur += 1;
    }

    // Ligne de titres du tableau.
    const ligneDEntete = curseur;
    const entete = feuille.getRow(ligneDEntete);
    colonnes.forEach((colonne, index) => {
      const cellule = entete.getCell(index + 1);
      cellule.value = colonne.titre;
      cellule.font = { name: POLICE, size: 9.5, bold: true, color: { argb: ENCRE } };
      cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_ENTETE } };
      cellule.alignment = { horizontal: horizontal(colonne), vertical: "middle", wrapText: true };
      cellule.border = { bottom: { style: "thin", color: { argb: TRAIT } } };
    });
    entete.height = 20;
    curseur += 1;

    const ecrireLigne = (ligne: LigneAExporter, numero: number) => {
      const cible = feuille.getRow(numero);
      const emphase = ligne.emphase === "section" || ligne.emphase === "total";
      colonnes.forEach((colonne, index) => {
        const cellule = cible.getCell(index + 1);
        const source: Cellule = ligne.cellules[index] ?? null;
        cellule.value = valeurDeCellule(source, colonne) as ValeurCellule;
        cellule.font = { name: POLICE, size: 9.5, bold: emphase, color: { argb: ENCRE } };
        cellule.alignment = {
          horizontal: horizontal(colonne),
          vertical: "top",
          wrapText: colonne.genre === "texte" && largeurColonneEnCaracteres(colonne) < 24
        };
        if (colonne.genre === "montant" && typeof cellule.value === "number") {
          cellule.numFmt = FORMAT_MONTANT;
        }
        if (emphase) {
          cellule.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FOND_EMPHASE } };
        }
        cellule.border = { bottom: { style: "hair", color: { argb: TRAIT } } };
      });
      return cible;
    };

    if (section.lignes.length === 0 && !section.totaux) {
      const vide = feuille.getRow(curseur);
      vide.getCell(1).value = MENTION_DOCUMENT_VIDE;
      vide.getCell(1).font = { name: POLICE, size: 9.5, italic: true, color: { argb: DISCRET } };
      feuille.mergeCells(curseur, 1, curseur, largeur);
      curseur += 1;
    } else {
      for (const ligne of section.lignes) {
        ecrireLigne(ligne, curseur);
        curseur += 1;
      }
    }

    const derniereLigne = curseur - 1;
    if (section.totaux) {
      const totaux = ecrireLigne({ ...section.totaux, emphase: "total" }, curseur);
      totaux.eachCell((cellule) => {
        cellule.border = { top: { style: "thin", color: { argb: TRAIT } } };
      });
      curseur += 1;
    }

    // Volet figé sous les titres : la lecture d'un grand livre de 500 lignes reste possible.
    feuille.views = [{ state: "frozen", ySplit: ligneDEntete }];
    if (section.lignes.length > 0) {
      feuille.autoFilter = {
        from: { row: ligneDEntete, column: 1 },
        to: { row: derniereLigne, column: colonnes.length }
      };
    }

    if (section.note && section.note.length > 0) {
      curseur += 1;
      bandeau(curseur, section.note, { taille: 8.5, italique: true, couleur: DISCRET });
      feuille.getRow(curseur).alignment = { wrapText: true, vertical: "top" };
      curseur += 1;
    }

    curseur += 1;
    const pied = feuille.getRow(curseur);
    pied.getCell(1).value = document.pied;
    pied.getCell(1).font = { name: POLICE, size: 8.5, italic: true, color: { argb: DISCRET } };
    pied.getCell(1).alignment = { wrapText: true, vertical: "top" };
    feuille.mergeCells(curseur, 1, curseur, largeur);
    pied.height = 26;

    // Mise en page imprimable : A4, ajustée en largeur, titres répétés sur chaque page.
    Object.assign(feuille.pageSetup, {
      paperSize: 9, // A4
      orientation,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: `${ligneDEntete}:${ligneDEntete}`
    });
  });

  if (document.sections.length === 0) {
    const feuille = classeur.addWorksheet(nomDOnglet(document.titre));
    feuille.getCell("A1").value = MENTION_DOCUMENT_VIDE;
  }

  const tampon = (await classeur.xlsx.writeBuffer()) as unknown as ArrayBuffer;
  const octets = new Uint8Array(tampon);

  return {
    nom: nomDeFichier("xlsx", document.tige, document.contexte, document.date),
    mime: MIME_EXCEL,
    format: "excel",
    taille: octets.byteLength,
    octets
  };
}
