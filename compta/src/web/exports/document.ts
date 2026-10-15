/**
 * Le document à exporter : ce que les trois formats ont en commun.
 *
 * Trois formats, trois lecteurs, **les mêmes chiffres**. Un état comptable qui dirait autre chose
 * en PDF qu'en Excel ne serait pas un état comptable. Le document est donc décrit une fois, puis
 * rendu par chaque moteur à partir de la même description.
 *
 * Chaque cellule a deux faces :
 *
 * - la **valeur**, exacte : un montant entier en francs CFA, une date ISO, un code technique. C'est
 *   ce que reçoivent le CSV et Excel, pour que le fichier reste **calculable** — sommer, filtrer,
 *   retraiter sans ressaisie. Un montant écrit « 2 360 000 » avec une espace insécable étroite est
 *   du texte pour Excel : la face valeur évite ce piège ;
 * - le **texte**, français : ce que l'œil lit, et ce que le PDF imprime (ses polices standard ne
 *   connaissent pas l'espace insécable étroite).
 *
 * `documentDepuisLignes` reconstruit cette description à partir des lignes qu'un écran prépare déjà
 * pour son export CSV : la structure de ces lignes est une convention de l'application (titre,
 * paramètres, ligne de titres, données, totaux, sections séparées par une ligne vide), et la
 * reconnaître ici évite d'écrire treize fois la même description.
 */

import { SEPARATEUR_MILLIERS, XOF, formatMontant, formaterDateFr, type DateCivile } from "../../noyau/index";
import type { CelluleCsv } from "../telechargement";

export type Cellule = CelluleCsv;

export type AlignementExport = "gauche" | "centre" | "droite";
export type GenreColonne = "texte" | "montant" | "date" | "nombre";

export interface ColonneAExporter {
  cle: string;
  titre: string;
  alignement: AlignementExport;
  genre: GenreColonne;
  /** Largeur indicative en caractères ; chaque moteur la convertit dans son unité. */
  largeur?: number | undefined;
}

export interface ChampAExporter {
  libelle: string;
  valeur: string;
}

export interface LigneAExporter {
  cellules: Cellule[];
  /**
   * `section` : un intitulé de rubrique. `total` : une ligne de total.
   * Les deux sont mis en gras et surlignés — un total qui ne se distingue pas des lignes qui le
   * composent se relit mal, et se recopie mal.
   */
  emphase?: "section" | "total" | undefined;
}

export interface SectionAExporter {
  titre: string;
  note?: string | undefined;
  champs: ChampAExporter[];
  colonnes: ColonneAExporter[];
  lignes: LigneAExporter[];
  totaux?: LigneAExporter | undefined;
}

export interface SocieteAExporter {
  raisonSociale: string;
  formeJuridique?: string | undefined;
  identifiantFiscal?: string | undefined;
  adresse?: string | undefined;
  ville?: string | undefined;
  pays?: string | undefined;
  telephone?: string | undefined;
}

export interface DocumentAExporter {
  titre: string;
  sousTitre: string;
  societe: SocieteAExporter;
  /** Numéro du dossier, tel que l'application le montre : `CG000-26`. */
  dossier: string;
  /** Libellé déjà composé pour l'impression : « Exercice 2026 ». */
  exercice: string;
  devise: string;
  /** Horodatage ISO de la génération. */
  genereLe: string;
  generePar: string;
  /** Racine du nom de fichier, sans extension. */
  tige: string;
  /** Ce qui distingue deux éditions du même document : période, compte, exercice. */
  contexte: string;
  date: DateCivile;
  /** Paramètres de l'édition communs à tout le document, en plus du dossier et de l'exercice. */
  champs: ChampAExporter[];
  pied: string;
  sections: SectionAExporter[];
}

export interface FichierExporte {
  nom: string;
  mime: string;
  format: "csv" | "excel" | "pdf";
  taille: number;
  octets: Uint8Array;
}

export const MIME_EXCEL = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MIME_PDF = "application/pdf";
export const MIME_CSV = "text/csv;charset=utf-8";

/** Les valeurs techniques que le noyau rend et que personne ne doit lire telles quelles. */
const VOCABULAIRE: Readonly<Record<string, string>> = {
  debiteur: "débiteur",
  crediteur: "créditeur",
  oui: "oui",
  non: "non",
  ouvert: "ouvert",
  pret: "prêt",
  comptabilise: "comptabilisé",
  "contre-passe": "contre-passé",
  normale: "normale",
  ajustement: "ajustement",
  cloture: "clôture"
};

const MOTIF_DATE_ISO = /^\d{4}-\d{2}-\d{2}$/u;

/** Le texte français d'une cellule : ce que le PDF imprime et ce que l'œil lit. */
export function texteDeCellule(cellule: Cellule, colonne: ColonneAExporter): string {
  if (cellule === null || cellule === undefined) {
    return "";
  }
  if (typeof cellule === "bigint") {
    if (colonne.genre === "nombre") {
      return cellule.toString();
    }
    return formatMontant(cellule, XOF);
  }
  if (typeof cellule === "number") {
    if (colonne.genre === "montant") {
      return formatMontant(BigInt(Math.round(cellule)), XOF);
    }
    return String(cellule);
  }
  const texte = cellule.trim();
  if (texte === "") {
    return "";
  }
  if (colonne.genre === "date" && MOTIF_DATE_ISO.test(texte)) {
    return formaterDateFr(texte as DateCivile);
  }
  const minuscule = texte.toLowerCase();
  return VOCABULAIRE[minuscule] ?? texte;
}

/**
 * La valeur exacte d'une cellule : ce que le CSV et Excel reçoivent.
 *
 * Un montant tient dans un nombre JavaScript jusqu'à 9 007 199 254 740 991 francs — très au-delà de
 * tout budget d'État. Au-dessus, la valeur bascule en texte plutôt que de devenir un nombre faux :
 * un export qui arrondit silencieusement est pire qu'un export qui dit qu'il ne peut pas.
 */
export function valeurDeCellule(cellule: Cellule, colonne: ColonneAExporter): string | number {
  if (cellule === null || cellule === undefined) {
    return "";
  }
  if (typeof cellule === "bigint") {
    if (cellule > BigInt(Number.MAX_SAFE_INTEGER) || cellule < -BigInt(Number.MAX_SAFE_INTEGER)) {
      return cellule.toString();
    }
    return Number(cellule);
  }
  if (typeof cellule === "number") {
    return colonne.genre === "montant" ? Math.round(cellule) : cellule;
  }
  return cellule;
}

/** Le genre d'une colonne, déduit de ce qu'elle contient réellement. */
function genreDeColonne(titre: string, cellules: readonly Cellule[]): GenreColonne {
  const pleines = cellules.filter((cellule) => cellule !== null && cellule !== undefined && cellule !== "");
  if (pleines.length > 0 && pleines.every((cellule) => typeof cellule === "bigint")) {
    return "montant";
  }
  if (pleines.length > 0 && pleines.every((cellule) => typeof cellule === "number")) {
    return "nombre";
  }
  if (pleines.length > 0 && pleines.every((cellule) => typeof cellule === "string" && MOTIF_DATE_ISO.test(cellule))) {
    return "date";
  }
  // Un titre suffit quand la colonne est vide : « Débit » sans montant reste une colonne de montants.
  if (/débit|crédit|solde|montant|total|net|brut|taxe|base|amortissement/iu.test(titre)) {
    return "montant";
  }
  if (/^date$|échéance/iu.test(titre)) {
    return "date";
  }
  return "texte";
}

function alignementDe(genre: GenreColonne): AlignementExport {
  if (genre === "montant" || genre === "nombre") return "droite";
  if (genre === "date") return "centre";
  return "gauche";
}

function cleDeColonne(titre: string, index: number): string {
  const propre = titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return propre.length > 0 ? propre : `colonne-${index + 1}`;
}

/** Une ligne est vide quand toutes ses cellules le sont : c'est le séparateur de sections. */
function estVide(ligne: readonly Cellule[]): boolean {
  return ligne.every((cellule) => cellule === null || cellule === undefined || String(cellule).trim() === "");
}

/** Le nombre de cellules le plus fréquent d'une section : c'est la largeur de son tableau. */
function largeurModale(section: readonly (readonly Cellule[])[]): number {
  const comptes = new Map<number, number>();
  for (const ligne of section) {
    if (estVide(ligne)) continue;
    comptes.set(ligne.length, (comptes.get(ligne.length) ?? 0) + 1);
  }
  let gagnante = 0;
  let meilleur = -1;
  for (const [longueur, fois] of comptes) {
    if (fois > meilleur || (fois === meilleur && longueur > gagnante)) {
      meilleur = fois;
      gagnante = longueur;
    }
  }
  return gagnante;
}

export interface OptionsDocumentDepuisLignes {
  titre: string;
  sousTitre?: string | undefined;
  tige: string;
  contexte: string;
  date: DateCivile;
  societe: SocieteAExporter;
  dossier: string;
  exercice: string;
  devise: string;
  genereLe: string;
  generePar: string;
  pied: string;
  lignes: readonly (readonly Cellule[])[];
  /** Titres de sections, dans l'ordre : à défaut, les sections portent le titre du document. */
  titresDeSection?: readonly string[] | undefined;
  /** Paramètres de l'édition communs à tout le document. */
  champs?: readonly ChampAExporter[] | undefined;
}

/**
 * Reconstruit un document à partir des lignes qu'un écran prépare pour son export CSV.
 *
 * La convention reconnue est celle de l'application : une section commence par des lignes de deux
 * cellules (les paramètres de l'édition), puis une ligne de titres, puis les données, puis
 * éventuellement une ligne de totaux. Les sections sont séparées par une ligne vide.
 */
/** Le texte d'une cellule, pour composer un paramètre ou un intitulé. */
function texteBrut(cellule: Cellule): string {
  return cellule === null || cellule === undefined ? "" : String(cellule).trim();
}

/** Une ligne courte devient un paramètre : premier mot en libellé, le reste en valeur. */
function champDepuisLigne(ligne: readonly Cellule[]): ChampAExporter {
  return {
    libelle: texteBrut(ligne[0] ?? null),
    valeur: ligne
      .slice(1)
      .map(texteBrut)
      .filter((valeur) => valeur !== "")
      .join(" · ")
  };
}

const MOTIF_TOTAUX = /^total|^totaux|^sous-total|^net à|^résultat net|^solde net/iu;

/**
 * L'index de la ligne de titres d'un bloc, ou -1.
 *
 * Une ligne de titres a la largeur du tableau, ne contient que du texte, et — c'est ce qui la
 * distingue d'une ligne de paramètres — est suivie d'au moins une ligne de la même largeur.
 */
function trouverEntete(bloc: readonly (readonly Cellule[])[], largeur: number): number {
  for (let index = 0; index < bloc.length; index += 1) {
    const ligne = bloc[index]!;
    if (ligne.length !== largeur) continue;
    if (!ligne.every((cellule) => typeof cellule === "string")) continue;
    const suivi = bloc.slice(index + 1).some((autre) => autre.length === largeur);
    if (suivi) return index;
  }
  return -1;
}

/**
 * Reconstruit un document à partir des lignes qu'un écran prépare pour son export CSV.
 *
 * La convention reconnue est celle de toute l'application : un bloc de paramètres (dossier, société,
 * édition), une ligne de titres, des données, une ligne de totaux ; les sections sont séparées par
 * une ligne vide. Reconnaître cette convention ici évite d'écrire treize fois la même description,
 * et garantit que les trois formats montrent exactement ce que le CSV montre.
 */
export function documentDepuisLignes(options: OptionsDocumentDepuisLignes): DocumentAExporter {
  const blocs: (readonly Cellule[])[][] = [[]];
  for (const ligne of options.lignes) {
    if (estVide(ligne)) {
      if (blocs[blocs.length - 1]!.length > 0) {
        blocs.push([]);
      }
      continue;
    }
    blocs[blocs.length - 1]!.push(ligne);
  }
  while (blocs.length > 0 && blocs[blocs.length - 1]!.length === 0) {
    blocs.pop();
  }

  const sections: SectionAExporter[] = [];
  const champsDuDocument: ChampAExporter[] = [...(options.champs ?? [])];

  for (const bloc of blocs) {
    const largeur = largeurModale(bloc);

    // Un bloc d'une seule ligne de totaux se rattache au tableau qui précède : c'est ainsi que les
    // écrans écrivent leurs totaux, et un total isolé de son tableau ne veut rien dire.
    if (bloc.length === 1 && sections.length > 0 && !sections[sections.length - 1]!.totaux) {
      const seule = bloc[0]!;
      if (MOTIF_TOTAUX.test(texteBrut(seule[0] ?? null))) {
        const cellules = [...seule];
        while (cellules.length < sections[sections.length - 1]!.colonnes.length) {
          cellules.push(null);
        }
        sections[sections.length - 1]!.totaux = { cellules, emphase: "total" };
        continue;
      }
    }

    const entete = largeur >= 3 ? trouverEntete(bloc, largeur) : -1;

    if (entete < 0) {
      // Aucun tableau dans ce bloc : ce sont des paramètres de l'édition.
      const champs = bloc.filter((ligne) => ligne.every((cellule) => texteBrut(cellule) !== "")).map(champDepuisLigne);
      if (sections.length === 0) {
        champsDuDocument.push(...champs);
      } else {
        sections[sections.length - 1]!.champs.push(...champs);
      }
      continue;
    }

    const champs: ChampAExporter[] = [];
    let titreDeSection = "";
    for (const ligne of bloc.slice(0, entete)) {
      if (ligne.length === 1) {
        // Une ligne d'un seul mot avant les titres est un intitulé, pas une donnée.
        if (titreDeSection.length === 0) {
          titreDeSection = texteBrut(ligne[0] ?? null);
        } else {
          champs.push(champDepuisLigne([titreDeSection, ligne[0] ?? null]));
          titreDeSection = "";
        }
        continue;
      }
      champs.push(champDepuisLigne(ligne));
    }

    const ligneDEntete = bloc[entete]!;
    const donnees: LigneAExporter[] = [];
    let totaux: LigneAExporter | undefined;
    for (const ligne of bloc.slice(entete + 1)) {
      const cellules = [...ligne];
      while (cellules.length < largeur) {
        cellules.push(null);
      }
      if (MOTIF_TOTAUX.test(texteBrut(cellules[0] ?? null))) {
        totaux = { cellules, emphase: "total" };
        continue;
      }
      donnees.push({ cellules });
    }

    const colonnes: ColonneAExporter[] = ligneDEntete.map((cellule, position) => {
      const titre = texteBrut(cellule);
      const genre = genreDeColonne(
        titre,
        donnees.map((ligne) => ligne.cellules[position] ?? null)
      );
      return {
        cle: cleDeColonne(titre, position),
        titre: titre.length > 0 ? titre : `Colonne ${position + 1}`,
        alignement: alignementDe(genre),
        genre
      };
    });

    // Une première colonne qui répète le même mot sur toutes les lignes est une colonne de nature :
    // son intitulé sert de titre de section, ce qui vaut mieux que « partie 2 ».
    if (titreDeSection.length === 0 && donnees.length > 0) {
      const premiers = new Set(donnees.map((ligne) => texteBrut(ligne.cellules[0] ?? null).toLowerCase()));
      if (premiers.size === 1 && texteBrut(donnees[0]!.cellules[0] ?? null) !== "") {
        titreDeSection = colonnes[0]!.titre;
      }
    }

    sections.push({
      titre: titreDeSection,
      champs,
      colonnes,
      lignes: donnees,
      ...(totaux ? { totaux } : {})
    });
  }

  // Les titres explicites priment ; à défaut, la première section porte le titre du document et les
  // suivantes un numéro, ce qui est lisible à défaut d'être riche.
  sections.forEach((section, index) => {
    if (options.titresDeSection?.[index]) {
      section.titre = options.titresDeSection[index]!;
    } else if (section.titre.length === 0) {
      section.titre = index === 0 ? options.titre : `${options.titre} — partie ${index + 1}`;
    }
  });

  return {
    titre: options.titre,
    sousTitre: options.sousTitre ?? "",
    societe: options.societe,
    dossier: options.dossier,
    exercice: options.exercice,
    devise: options.devise,
    genereLe: options.genereLe,
    generePar: options.generePar,
    tige: options.tige,
    contexte: options.contexte,
    date: options.date,
    champs: champsDuDocument,
    pied: options.pied,
    sections
  };
}

/** Les lignes d'identité qui ouvrent un document imprimé : une feuille isolée reste identifiable. */
export function lignesDIdentite(document: DocumentAExporter): string[] {
  const societe = document.societe;
  const lignes: string[] = [societe.raisonSociale];
  const forme = [societe.formeJuridique, societe.identifiantFiscal ? `IFU ${societe.identifiantFiscal}` : null]
    .filter((element): element is string => typeof element === "string" && element.length > 0)
    .join(" · ");
  if (forme.length > 0) lignes.push(forme);
  const adresse = [societe.adresse, societe.ville, societe.pays]
    .filter((element): element is string => typeof element === "string" && element.length > 0)
    .join(", ");
  if (adresse.length > 0) lignes.push(adresse);
  if (societe.telephone) lignes.push(`Tél. ${societe.telephone}`);
  return lignes;
}

/** Les paramètres de l'édition, communs à tout le document. */
export function champsDuDocument(document: DocumentAExporter): ChampAExporter[] {
  return [
    { libelle: "Dossier", valeur: document.dossier },
    { libelle: "Exercice", valeur: document.exercice },
    { libelle: "Devise", valeur: document.devise },
    ...(document.contexte.length > 0 ? [{ libelle: "Référence", valeur: document.contexte }] : []),
    ...document.champs
  ];
}

/** Horodatage français de la génération : « 16/10/2026 à 09:41 ». */
export function horodatageFr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const deux = (nombre: number): string => nombre.toString().padStart(2, "0");
  return `${deux(date.getUTCDate())}/${deux(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} à ${deux(
    date.getUTCHours()
  )}:${deux(date.getUTCMinutes())}`;
}

/** Séparateur de milliers français, rappelé ici pour que les moteurs n'aient pas à le deviner. */
export const SEPARATEUR = SEPARATEUR_MILLIERS;
