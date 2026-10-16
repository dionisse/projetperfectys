/**
 * Lecture des fichiers de relevé qui ne sont pas du texte : classeur Excel et PDF.
 *
 * Le noyau reste pur : il ne sait pas ouvrir un fichier. C'est ici que les octets deviennent ce qu'il
 * sait lire — une grille de cellules en texte, la même pour un CSV découpé, une feuille de classeur et
 * une page de PDF remise en colonnes. Les deux lecteurs lourds (exceljs, pdfjs) sont chargés à la
 * demande : un utilisateur qui importe un CSV ne télécharge ni l'un ni l'autre.
 *
 * Deux honnêtetés à garder en tête :
 *
 * - Un classeur Excel porte des **nombres** et des **dates**, pas du texte. Une date est rendue au
 *   format ISO, un nombre sans notation exponentielle : ce sont les deux formes que le lecteur du
 *   noyau reconnaît sans ambiguïté.
 * - Un PDF porte de l'encre à des coordonnées. S'il est scanné, il ne porte aucun texte et le refus le
 *   dit : aucun chiffre n'est inventé, aucun OCR n'est tenté.
 */

import {
  ErreurRegle,
  grilleDepuisTexteDePdf,
  type FormatDeReleve,
  type LigneDeGrille,
  type TextePositionne
} from "../noyau/index";

type EspaceExcel = typeof import("exceljs");
type ValeurCellule = import("exceljs").CellValue;

/** Ce que rend la lecture d'un fichier binaire : une grille, et ce qu'il faut en dire. */
export interface FichierDeReleveLu {
  format: FormatDeReleve;
  grille: LigneDeGrille[];
  notes: string[];
}

/** Le format qu'annonce l'extension d'un fichier, ou `null` quand c'est du texte à détecter. */
export function formatDeFichier(nom: string): FormatDeReleve | null {
  const extension = nom.toLowerCase().match(/\.(xlsx|xlsm|pdf)$/u)?.[1] ?? null;
  if (extension === "xlsx" || extension === "xlsm") {
    return "xlsx";
  }
  return extension === "pdf" ? "pdf" : null;
}

/** Un fichier est-il binaire, d'après son nom ? */
export function estFichierBinaire(nom: string): boolean {
  return formatDeFichier(nom) !== null;
}

/** Lit un fichier de relevé binaire. Le CSV, l'OFX et le CAMT se lisent comme du texte, pas ici. */
export async function lireFichierDeReleve(nom: string, octets: ArrayBuffer): Promise<FichierDeReleveLu> {
  const format = formatDeFichier(nom);
  if (format === null) {
    throw new ErreurRegle(
      `« ${nom} » n'est ni un classeur Excel (.xlsx) ni un PDF : un fichier texte se lit directement, sans passer par ici.`
    );
  }
  if (octets.byteLength === 0) {
    throw new ErreurRegle(`« ${nom} » est vide : rien à importer.`);
  }
  return format === "xlsx" ? lireClasseur(octets) : lireDocument(octets);
}

/* ------------------------------------------------------------------ */
/* Classeur Excel                                                      */
/* ------------------------------------------------------------------ */

async function lireClasseur(octets: ArrayBuffer): Promise<FichierDeReleveLu> {
  const charge = (await import("exceljs")) as EspaceExcel & { default?: EspaceExcel };
  const espace = charge.default ?? charge;
  const classeur = new espace.Workbook();
  try {
    await classeur.xlsx.load(octets);
  } catch (erreur) {
    throw new ErreurRegle(
      `Ce fichier n'a pas pu être ouvert comme un classeur Excel : ${
        erreur instanceof Error ? erreur.message : String(erreur)
      }. Un .xls ancien (binaire) ne se lit pas ici — enregistrez-le en .xlsx, ou exportez-le en CSV.`
    );
  }

  const notes: string[] = [];
  const feuille = choisirFeuille(classeur);
  if (!feuille) {
    throw new ErreurRegle(
      "Ce classeur ne contient aucune feuille lisible. Un relevé bancaire exporté en Excel porte ses opérations dans une feuille."
    );
  }
  if (classeur.worksheets.length > 1) {
    notes.push(
      `Le classeur porte ${classeur.worksheets.length} feuilles : « ${feuille.name} » a été retenue, c'est la première qui contient des dates et des montants.`
    );
  }

  const grille: LigneDeGrille[] = [];
  let vides = 0;
  feuille.eachRow({ includeEmpty: false }, (ligne, numero) => {
    const cellules: string[] = [];
    for (let colonne = 1; colonne <= ligne.cellCount; colonne += 1) {
      cellules.push(texteDeCellule(ligne.getCell(colonne).value));
    }
    if (cellules.every((cellule) => cellule.trim() === "")) {
      vides += 1;
      return;
    }
    grille.push({ numero, cellules });
  });
  if (vides > 0) {
    notes.push(`${vides} ligne${vides > 1 ? "s" : ""} vide${vides > 1 ? "s" : ""} du classeur ignorée${vides > 1 ? "s" : ""}.`);
  }
  if (grille.length === 0) {
    throw new ErreurRegle(`La feuille « ${feuille.name} » est vide : aucune cellule à lire.`);
  }
  notes.push(`Feuille lue : « ${feuille.name} », ${grille.length} lignes.`);
  return { format: "xlsx", grille, notes };
}

/** La première feuille qui ressemble à un relevé : des dates et des nombres. Sinon, la première. */
function choisirFeuille(classeur: import("exceljs").Workbook): import("exceljs").Worksheet | null {
  const feuilles = classeur.worksheets;
  if (feuilles.length === 0) {
    return null;
  }
  const ressemblante = feuilles.find((feuille) => {
    let dates = 0;
    let nombres = 0;
    feuille.eachRow({ includeEmpty: false }, (ligne) => {
      ligne.eachCell({ includeEmpty: false }, (cellule) => {
        if (cellule.value instanceof Date) {
          dates += 1;
        } else if (typeof cellule.value === "number") {
          nombres += 1;
        } else if (typeof cellule.value === "string" && /\d/u.test(cellule.value)) {
          nombres += 1;
        }
      });
    });
    return dates > 0 && nombres > 0;
  });
  return ressemblante ?? feuilles[0]!;
}

/**
 * La cellule d'un classeur, en texte.
 *
 * Une date est rendue en ISO (`2026-04-02`), un nombre sans exposant, un résultat de formule pour sa
 * valeur : c'est ce que le lecteur du noyau reconnaît sans deviner.
 */
function texteDeCellule(valeur: ValeurCellule | null | undefined): string {
  if (valeur === null || valeur === undefined) {
    return "";
  }
  if (valeur instanceof Date) {
    // exceljs construit ses dates dans le fuseau local : les composants locaux sont ceux qu'Excel
    // affiche, et ce sont eux qu'il faut rendre.
    const annee = valeur.getFullYear().toString().padStart(4, "0");
    const mois = (valeur.getMonth() + 1).toString().padStart(2, "0");
    const jour = valeur.getDate().toString().padStart(2, "0");
    return `${annee}-${mois}-${jour}`;
  }
  if (typeof valeur === "number") {
    if (Number.isInteger(valeur)) {
      return valeur.toString();
    }
    const texte = valeur.toString();
    // Une notation exponentielle ne se lit pas comme un montant : elle est évitée.
    return /e/iu.test(texte) ? valeur.toFixed(2) : texte;
  }
  if (typeof valeur === "string") {
    return valeur.trim();
  }
  if (typeof valeur === "boolean") {
    return valeur ? "oui" : "non";
  }
  if (Array.isArray(valeur)) {
    // Une cellule de formule renvoie un tableau partagé : la première valeur est le résultat.
    return valeur.length > 0 ? texteDeCellule(valeur[0] as ValeurCellule) : "";
  }
  const objet = valeur as unknown as Record<string, unknown>;
  if (typeof objet.richText === "object" && objet.richText !== null) {
    return (objet.richText as { text?: unknown }[])
      .map((partie) => (typeof partie.text === "string" ? partie.text : ""))
      .join("")
      .trim();
  }
  if (typeof objet.text === "string") {
    // Un hyperlien, ou le résultat d'une formule déjà évalué.
    return objet.text.trim();
  }
  if ("result" in objet) {
    return texteDeCellule(objet.result as ValeurCellule);
  }
  if ("error" in objet) {
    return "";
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

async function lireDocument(octets: ArrayBuffer): Promise<FichierDeReleveLu> {
  // Un relevé tient en une ou deux pages : l'analyse se fait sur le fil principal, sans `new Worker`
  // ni fichier à servir à part. Importer le worker pose `globalThis.pdfjsWorker`, que pdf.js lit pour
  // faire tourner son worker simulé — sans cet import, Node résout le worker sur disque et réussit,
  // tandis qu'un navigateur n'a rien à charger et échoue.
  const [pdfjs] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
  ]);
  const chargement = pdfjs.getDocument({
    data: new Uint8Array(octets),
    useWorkerFetch: false,
    disableFontFace: true,
    verbosity: 0
  });
  let document: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    document = await chargement.promise;
  } catch (erreur) {
    await chargement.destroy().catch(() => undefined);
    throw new ErreurRegle(
      `Ce fichier n'a pas pu être ouvert comme un PDF : ${
        erreur instanceof Error ? erreur.message : String(erreur)
      }. S'il est protégé par un mot de passe, ouvrez-le d'abord.`
    );
  }

  const elements: TextePositionne[] = [];
  try {
    for (let numero = 1; numero <= document.numPages; numero += 1) {
      const page = await document.getPage(numero);
      const contenu = await page.getTextContent();
      // pdfjs compte l'ordonnée depuis le bas de la page ; une grille se lit depuis le haut.
      const hauteur = (page.view[3] ?? 0) - (page.view[1] ?? 0);
      for (const item of contenu.items) {
        if (!("str" in item) || typeof item.str !== "string" || item.str.trim() === "") {
          continue;
        }
        elements.push({
          page: numero,
          texte: item.str,
          x: item.transform[4] ?? 0,
          y: hauteur - (item.transform[5] ?? 0),
          largeur: "width" in item && typeof item.width === "number" ? item.width : 0
        });
      }
    }
  } finally {
    await chargement.destroy().catch(() => undefined);
  }
  const pages = document.numPages;

  const grille = grilleDepuisTexteDePdf(elements);
  return {
    format: "pdf",
    grille: grille.lignes,
    notes: [`Document lu : ${pages} page${pages > 1 ? "s" : ""}, ${elements.length} morceaux de texte.`, ...grille.notes]
  };
}
