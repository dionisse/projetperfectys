/**
 * Rendu PDF : impression et archive.
 *
 * Contraintes traitées ici, toutes vérifiées à la sonde sur jsPDF 4 / jspdf-autotable 5 :
 *
 * - les polices standard (Helvetica, WinAnsi) **silencent** les caractères hors latin1 : chaque
 *   chaîne passe par `nettoyerPourPdf`, sinon l'espace insécable étroite des montants, le tiret
 *   cadratin et la ligature « Œ » disparaissent du texte imprimé sans aucun avertissement ;
 * - `doc.scaleFactor()` n'existe plus : tout est calculé en millimètres ;
 * - `jspdf-autotable` avertit en console et déborde si la somme des largeurs dépasse la largeur
 *   utile : les largeurs sont mises à l'échelle de la page ;
 * - `lastAutoTable.pageCount` a disparu : le nombre de pages vient de `doc.getNumberOfPages()`, ce
 *   qui permet de numéroter « Page n/N » en fin de rendu.
 *
 * Mise en page : A4, marges 12/14/18 mm, en-tête complet en page 1 (société, titre, paramètres de
 * l'édition), en-tête compact dès la page 2, une section par tableau, pied de page numéroté.
 *
 * `jspdf` et `jspdf-autotable` sont chargés à la demande : leur poids ne pèse pas sur le démarrage
 * de l'application, seulement sur le premier export PDF.
 */

import { nomDeFichier } from "../telechargement";
import {
  MIME_PDF,
  champsDuDocument,
  horodatageFr,
  lignesDIdentite,
  texteDeCellule,
  type ChampAExporter,
  type ColonneAExporter,
  type DocumentAExporter,
  type FichierExporte,
  type LigneAExporter
} from "./document";
import {
  HAUTEUR_PAGE_MM,
  LARGEUR_PAGE_MM,
  MARGES_PDF_MM,
  MENTION_DOCUMENT_VIDE,
  largeursMiseAEchelleEnMm,
  nettoyerPourPdf,
  orientationPreferree
} from "./texte";

import type { jsPDF } from "jspdf";
import type { CellInput, RowInput } from "jspdf-autotable";

const ENCRE: [number, number, number] = [31, 41, 55];
const DISCRET: [number, number, number] = [107, 114, 128];
const TITRE_ENCRE: [number, number, number] = [23, 37, 84];
const TRAIT: [number, number, number] = [203, 214, 230];
const FOND_ENTETE: [number, number, number] = [239, 243, 248];
const FOND_EMPHASE: [number, number, number] = [246, 247, 249];

/** Largeur réellement imprimable, une fois les marges posées. */
function largeurUtile(orientation: "portrait" | "paysage"): number {
  const largeurPage = orientation === "paysage" ? HAUTEUR_PAGE_MM : LARGEUR_PAGE_MM;
  return largeurPage - MARGES_PDF_MM.gauche - MARGES_PDF_MM.droite;
}

function hauteurPage(orientation: "portrait" | "paysage"): number {
  return orientation === "paysage" ? LARGEUR_PAGE_MM : HAUTEUR_PAGE_MM;
}

function aligner(colonne: ColonneAExporter): "left" | "right" | "center" {
  return colonne.alignement === "droite" ? "right" : colonne.alignement === "centre" ? "center" : "left";
}

export interface OptionsPdf {
  /**
   * Compresser les flux de contenu. Vrai en production (le fichier part par courriel) ; faux dans
   * les tests, pour que le texte imprimé reste vérifiable octet par octet.
   */
  compression?: boolean | undefined;
}

export async function rendrePdf(
  document: DocumentAExporter,
  options: OptionsPdf = {}
): Promise<FichierExporte> {
  const [{ jsPDF: JsPdf }, moduleAutoTable] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable")
  ]);
  const autoTable = (moduleAutoTable.default ?? moduleAutoTable.autoTable) as typeof moduleAutoTable.autoTable;

  const orientation = orientationPreferree(document);
  const doc: jsPDF = new JsPdf({
    unit: "mm",
    format: "a4",
    orientation: orientation === "paysage" ? "landscape" : "portrait",
    compress: options.compression ?? true
  });

  const utile = largeurUtile(orientation);
  const gauche = MARGES_PDF_MM.gauche;
  const pageHauteur = hauteurPage(orientation);
  const piedDePage = pageHauteur - MARGES_PDF_MM.bas;

  const ecrire = (
    texte: string,
    y: number,
    style: {
      taille: number;
      gras?: boolean;
      italique?: boolean;
      couleur?: [number, number, number];
      largeurMax?: number;
    }
  ): number => {
    doc.setFont("helvetica", style.gras ? "bold" : style.italique ? "italic" : "normal");
    doc.setFontSize(style.taille);
    doc.setTextColor(...(style.couleur ?? ENCRE));
    const contenu = nettoyerPourPdf(texte);
    const lignes = style.largeurMax ? doc.splitTextToSize(contenu, style.largeurMax) : [contenu];
    doc.text(lignes, gauche, y);
    return y + lignes.length * style.taille * 0.42;
  };

  /** En-tête compact des pages suivantes : société et titre sur une ligne. */
  const tracerEnTeteCourant = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...DISCRET);
    doc.text(nettoyerPourPdf(`${document.societe.raisonSociale} - ${document.titre}`), gauche, 9);
    doc.setDrawColor(...TRAIT);
    doc.setLineWidth(0.2);
    doc.line(gauche, 11, gauche + utile, 11);
  };

  /** Un bloc de paramètres, sur deux colonnes pour tenir en hauteur. */
  const tracerChamps = (champs: readonly ChampAExporter[], y: number): number => {
    if (champs.length === 0) {
      return y;
    }
    const largeurLibelle = Math.min(38, utile * 0.28);
    const moitie = Math.ceil(champs.length / 2);
    let curseur = y;
    for (let index = 0; index < moitie; index += 1) {
      const paire = [champs[index], champs[index + moitie]];
      let hauteur = 0;
      paire.forEach((champ, place) => {
        if (!champ) return;
        const x = gauche + place * (utile / 2);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...DISCRET);
        doc.text(nettoyerPourPdf(`${champ.libelle} :`), x, curseur);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...ENCRE);
        const disponible = Math.max(20, utile / 2 - largeurLibelle - 2);
        const valeur = doc.splitTextToSize(nettoyerPourPdf(champ.valeur), disponible);
        doc.text(valeur, x + largeurLibelle, curseur);
        hauteur = Math.max(hauteur, valeur.length * 3.4);
      });
      curseur += Math.max(hauteur, 3.8);
    }
    return curseur;
  };

  // ---- Page 1 : en-tête complet ----
  let curseur: number = MARGES_PDF_MM.haut;
  lignesDIdentite(document).forEach((ligne, index) => {
    curseur = ecrire(ligne, curseur, {
      taille: index === 0 ? 9.5 : 8,
      gras: index === 0,
      couleur: index === 0 ? ENCRE : DISCRET
    });
  });
  curseur += 2;
  curseur = ecrire(document.titre, curseur, { taille: 14, gras: true });
  if (document.sousTitre.length > 0) {
    curseur = ecrire(document.sousTitre, curseur, { taille: 9.5, italique: true, couleur: DISCRET });
  }
  curseur += 1;

  const champsGlobaux = champsDuDocument(document);
  curseur = tracerChamps(champsGlobaux, curseur);
  curseur = ecrire(
    `Document généré le ${horodatageFr(document.genereLe)} par ${document.generePar}`,
    curseur + 1,
    { taille: 7.5, italique: true, couleur: DISCRET }
  );
  curseur += 1;
  doc.setDrawColor(...TRAIT);
  doc.setLineWidth(0.2);
  doc.line(gauche, curseur, gauche + utile, curseur);
  curseur += 4;

  // ---- Une section = un tableau ----
  let lignesDeLaSection: LigneAExporter[] = [];

  document.sections.forEach((section, index) => {
    // Un titre de section ne doit jamais se retrouver seul en bas de page.
    if (curseur > piedDePage - 30) {
      doc.addPage();
      tracerEnTeteCourant();
      curseur = MARGES_PDF_MM.haut + 4;
    }

    if (document.sections.length > 1 || index === 0) {
      curseur = ecrire(section.titre, curseur, { taille: 10.5, gras: true, couleur: TITRE_ENCRE });
      curseur += 0.5;
    }
    curseur = tracerChamps(section.champs, curseur);
    if (section.champs.length > 0) {
      curseur += 1;
    }

    const colonnes = section.colonnes;
    const largeurs = largeursMiseAEchelleEnMm(colonnes, utile);
    lignesDeLaSection = [...section.lignes, ...(section.totaux ? [{ ...section.totaux, emphase: "total" as const }] : [])];

    const corps: RowInput[] =
      lignesDeLaSection.length > 0
        ? lignesDeLaSection.map(
            (ligne) =>
              colonnes.map((_colonne, position) =>
                nettoyerPourPdf(texteDeCellule(ligne.cellules[position] ?? null, _colonne))
              ) as CellInput[]
          )
        : [
            [
              {
                content: nettoyerPourPdf(MENTION_DOCUMENT_VIDE),
                colSpan: Math.max(colonnes.length, 1),
                styles: { fontStyle: "italic", halign: "center", textColor: DISCRET }
              } satisfies CellInput
            ]
          ];

    const stylesDeColonne: Record<number, { cellWidth: number; halign: "left" | "right" | "center" }> = {};
    colonnes.forEach((colonne, position) => {
      stylesDeColonne[position] = {
        cellWidth: largeurs[position] ?? 20,
        halign: aligner(colonne)
      };
    });

    autoTable(doc, {
      startY: curseur,
      head: [colonnes.map((colonne) => nettoyerPourPdf(colonne.titre))],
      body: corps,
      theme: "grid",
      styles: {
        font: "helvetica",
        fontSize: 7.5,
        cellPadding: 1.2,
        lineColor: TRAIT,
        lineWidth: 0.1,
        textColor: ENCRE,
        overflow: "linebreak",
        valign: "top"
      },
      headStyles: {
        fillColor: FOND_ENTETE,
        textColor: TITRE_ENCRE,
        fontStyle: "bold",
        fontSize: 7.5,
        cellPadding: 1.4
      },
      columnStyles: stylesDeColonne,
      margin: {
        top: MARGES_PDF_MM.haut,
        right: MARGES_PDF_MM.droite,
        bottom: MARGES_PDF_MM.bas,
        left: MARGES_PDF_MM.gauche
      },
      didDrawPage: (donnees) => {
        if (donnees.pageNumber > 1) {
          tracerEnTeteCourant();
        }
      },
      didParseCell: (donnees) => {
        if (donnees.section !== "body") return;
        const ligne = lignesDeLaSection[donnees.row.index];
        if (ligne?.emphase === "section" || ligne?.emphase === "total") {
          donnees.cell.styles.fillColor = FOND_EMPHASE;
          donnees.cell.styles.fontStyle = "bold";
        }
      }
    });

    const table = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    curseur = (table?.finalY ?? curseur) + 3;

    if (section.note && section.note.length > 0) {
      if (curseur > piedDePage - 12) {
        doc.addPage();
        tracerEnTeteCourant();
        curseur = MARGES_PDF_MM.haut + 4;
      }
      curseur = ecrire(section.note, curseur, { taille: 7.5, italique: true, couleur: DISCRET, largeurMax: utile });
      curseur += 2;
    }
  });

  // ---- Mention finale : elle suit les tableaux, jamais en chevauchement ----
  curseur += 2;
  const nombreDePages = doc.getNumberOfPages();
  doc.setPage(nombreDePages);
  const lignesDePied = doc.splitTextToSize(nettoyerPourPdf(document.pied), utile);
  if (curseur + lignesDePied.length * 3.4 > piedDePage) {
    doc.addPage();
    tracerEnTeteCourant();
    curseur = MARGES_PDF_MM.haut + 6;
  }
  ecrire(document.pied, curseur, { taille: 7.5, italique: true, couleur: DISCRET, largeurMax: utile });

  // ---- Numérotation « Page n/N » sur toutes les pages ----
  const total = doc.getNumberOfPages();
  const tige = nomDeFichier("pdf", document.tige, document.contexte, document.date).replace(/\.pdf$/u, "");
  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DISCRET);
    doc.text(nettoyerPourPdf(tige), gauche, pageHauteur - 8);
    doc.text(`Page ${page}/${total}`, gauche + utile, pageHauteur - 8, { align: "right" });
  }

  const octets = new Uint8Array(doc.output("arraybuffer"));

  return {
    nom: nomDeFichier("pdf", document.tige, document.contexte, document.date),
    mime: MIME_PDF,
    format: "pdf",
    taille: octets.byteLength,
    octets
  };
}
