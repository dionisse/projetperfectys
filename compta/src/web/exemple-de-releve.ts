/**
 * Un relevé d'exemple dans les contenants binaires : classeur Excel et page imprimée.
 *
 * L'import d'un relevé se règle sur le fichier que la banque donne, et tout le monde n'a pas le sien
 * sous la main — surtout pas pour un format qu'il n'a jamais reçu. Ces deux fonctions construisent donc
 * un **vrai fichier**, écrit par les mêmes bibliothèques que les exports de l'application, puis le font
 * relire par le lecteur : le chemin parcouru est exactement celui d'un fichier de banque, jusqu'aux
 * dates qui sont de vraies dates de classeur et aux montants qui sont de vrais nombres, ou de l'encre
 * posée à des coordonnées sur une page.
 *
 * Les opérations viennent du grand livre du dossier ; ce qui les complète — deux frais que seule la
 * banque a passés — vient du noyau, comme pour l'exemple en CSV.
 */

import {
  ZERO,
  formatMontant,
  operationsDExempleDeReleve,
  type Devise,
  type OperationDExempleDeReleve,
  type OptionsDExempleDeReleve
} from "../noyau/index";

type EspaceExcel = typeof import("exceljs");
type EspacePdf = typeof import("jspdf");

/** Les colonnes d'un relevé, dans l'ordre où une banque les imprime. */
const ENTETES: readonly string[] = ["Date opération", "Date valeur", "Référence", "Libellé", "Montant", "Solde"];

/** Un classeur d'exemple : une feuille de garde, puis le relevé en vraies dates et vrais nombres. */
export async function classeurDExemple(options: OptionsDExempleDeReleve): Promise<ArrayBuffer> {
  const charge = (await import("exceljs")) as EspaceExcel & { default?: EspaceExcel };
  const espace = charge.default ?? charge;
  const operations = operationsDExempleDeReleve(options);
  const classeur = new espace.Workbook();
  classeur.creator = "PERFECTYS Compta — relevé d'exemple";

  // Une feuille de garde, comme en produisent les exports bancaires : elle ne porte ni date ni nombre,
  // et c'est précisément pour cela que le lecteur doit passer à la suivante.
  const garde = classeur.addWorksheet("Notice");
  garde.getCell("A1").value = `Résumé de compte ${options.compte}`;
  garde.getCell("A2").value = `Période du ${options.du} au ${options.au}`;
  garde.getCell("A3").value = "Document d'exemple produit par l'application : aucune opération réelle.";

  const feuille = classeur.addWorksheet("Relevé");
  feuille.getCell("A1").value = `Résumé de compte ${options.compte} — du ${options.du} au ${options.au}`;
  feuille.getRow(1).font = { bold: true };
  ENTETES.forEach((entete, index) => {
    feuille.getCell(3, index + 1).value = entete;
  });
  feuille.getRow(3).font = { bold: true };

  let rang = 4;
  for (const operation of operations) {
    feuille.getCell(rang, 1).value = dateDeClasseur(operation.date);
    feuille.getCell(rang, 2).value = dateDeClasseur(operation.date);
    feuille.getCell(rang, 3).value = operation.reference;
    feuille.getCell(rang, 4).value = operation.libelle;
    // Un montant de classeur est un nombre : c'est ce qu'une banque exporte, et c'est ce que le lecteur
    // doit rendre sans arrondi. Le franc CFA n'a pas de décimale.
    feuille.getCell(rang, 5).value = Number(operation.montant);
    feuille.getCell(rang, 6).value = Number(operation.solde);
    rang += 1;
  }
  // Une ligne de total, comme en portent les relevés : elle n'a pas de date, elle doit être écartée.
  feuille.getCell(rang, 4).value = "Total des opérations";
  feuille.getCell(rang, 5).value = operations.length;
  feuille.columns.forEach((colonne) => {
    colonne.width = 20;
  });

  return classeur.xlsx.writeBuffer();
}

/** Une date de classeur : exceljs attend une Date, posée à minuit dans le fuseau local. */
function dateDeClasseur(date: string): Date {
  return new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)));
}

/** Ce qu'une page imprimée pose : des abscisses, en points, pour chaque colonne. */
const MISE_EN_PAGE = {
  largeur: 842,
  hauteur: 595,
  marge: 40,
  entete: 90,
  premiereLigne: 110,
  pas: 16,
  basDePage: 555,
  gauches: [40, 120, 200, 300],
  /** Les montants bordent à droite : c'est ainsi qu'un relevé les imprime. */
  droites: [700, 802],
  /** Au-delà, un libellé passerait sous la colonne des montants : une page imprimée le tronque. */
  libelleMax: 46
} as const;

/**
 * Un relevé d'exemple en PDF, imprimé cellule par cellule.
 *
 * L'ordre d'écriture est celui des colonnes, pas celui de la lecture : bien des états bancaires posent
 * leur texte ainsi, et le lecteur doit retrouver les lignes par leurs ordonnées, pas par l'ordre du
 * fichier.
 */
export async function documentDExemple(
  options: OptionsDExempleDeReleve & { devise: Devise }
): Promise<ArrayBuffer> {
  const charge = (await import("jspdf")) as EspacePdf & { default?: EspacePdf };
  const { jsPDF: JsPdf } = charge;
  const operations = operationsDExempleDeReleve(options);
  const doc = new JsPdf({ unit: "pt", format: [MISE_EN_PAGE.largeur, MISE_EN_PAGE.hauteur], orientation: "landscape" });

  /**
   * L'abscisse d'une cellule : à gauche pour le texte, à droite pour les deux colonnes de nombres.
   * Une colonne de nombres borde toujours au même endroit, quelle que soit la longueur du montant —
   * c'est ce que le lecteur retrouve, et c'est ce qu'un relevé imprimé fait.
   */
  const abscisse = (cellule: string, colonne: number): number =>
    colonne < MISE_EN_PAGE.gauches.length
      ? MISE_EN_PAGE.gauches[colonne]!
      : MISE_EN_PAGE.droites[colonne - MISE_EN_PAGE.gauches.length]! - doc.getTextWidth(cellule);

  const parPage = Math.floor((MISE_EN_PAGE.basDePage - MISE_EN_PAGE.premiereLigne) / MISE_EN_PAGE.pas) + 1;
  const pages: OperationDExempleDeReleve[][] = [];
  for (let debut = 0; debut < operations.length; debut += parPage) {
    pages.push(operations.slice(debut, debut + parPage));
  }
  if (pages.length === 0) {
    pages.push([]);
  }

  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage([MISE_EN_PAGE.largeur, MISE_EN_PAGE.hauteur], "landscape");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Résumé de compte ${options.compte}`, MISE_EN_PAGE.marge, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Période du ${options.du} au ${options.au}`, MISE_EN_PAGE.marge, 60);
    doc.text(`Page ${index + 1}/${pages.length}`, MISE_EN_PAGE.marge, MISE_EN_PAGE.basDePage + 20);

    doc.setFont("helvetica", "bold");
    ENTETES.forEach((entete, colonne) => {
      doc.text(entete, abscisse(entete, colonne), MISE_EN_PAGE.entete);
    });
    doc.setFont("helvetica", "normal");

    // Chaque colonne est écrite d'un bloc : l'ordre du flux de contenu n'est pas celui de la lecture.
    page.forEach((operation, rang) => {
      const cellules = [
        dateFr(operation.date),
        dateFr(operation.date),
        operation.reference,
        tronquer(operation.libelle, MISE_EN_PAGE.libelleMax),
        montantImprime(operation.montant, options.devise),
        montantImprime(operation.solde, options.devise)
      ];
      cellules.forEach((cellule, colonne) => {
        doc.text(cellule, abscisse(cellule, colonne), MISE_EN_PAGE.premiereLigne + rang * MISE_EN_PAGE.pas);
      });
    });
  });

  return doc.output("arraybuffer");
}

function dateFr(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function tronquer(texte: string, maximum: number): string {
  return texte.length <= maximum ? texte : `${texte.slice(0, maximum - 3)}...`;
}

/**
 * Un montant tel qu'une banque l'imprime : milliers séparés, signe devant.
 *
 * L'espace fine insécable que rend `formatMontant` ne passe pas toutes les polices de PDF : elle est
 * remplacée par une espace ordinaire, que le lecteur retire de toute façon.
 */
function montantImprime(montant: bigint, devise: Devise): string {
  const format = formatMontant(montant < ZERO ? -montant : montant, devise).replaceAll("\u202f", " ");
  return montant < ZERO ? `-${format}` : format;
}
