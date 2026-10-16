/**
 * Import d'un relevé bancaire.
 *
 * Un relevé se saisit ligne à ligne dans l'écran de rapprochement : c'est exact, mais long, et la
 * banque donne de toute façon un fichier. Ce module lit ce fichier — CSV, OFX ou CAMT.053 — et le
 * rend sous la forme que le rapprochement attend, sans rien écrire dans le dossier : la lecture est
 * pure, l'aperçu précède l'import, et c'est le service qui décide d'en faire un relevé.
 *
 * Trois difficultés, traitées explicitement parce qu'elles font échouer les imports naïfs :
 *
 * - **Le fichier ne dit pas sa forme.** Séparateur point-virgule ou virgule, décimale virgule ou
 *   point, colonnes nommées ou non, montant signé ou porté sur deux colonnes débit/crédit, sens
 *   marqué par une lettre D/C : tout est détecté, et ce qui est reconnu est **rendu visible** dans
 *   `correspondances`, pour que l'utilisateur contrôle le mappage avant d'écrire.
 * - **Le sens du montant est celui de la banque.** Positif quand l'argent entre. C'est la convention
 *   de `LigneDeReleve`, elle n'est pas renversée ici.
 * - **Une décimale n'est pas une approximation.** Le montant est lu en unités exactes de la devise du
 *   dossier : un fichier qui porte « 1 234,00 » en XOF est accepté, « 1 234,56 » est refusé plutôt
 *   que d'être arrondi en silence.
 *
 * Un fichier illisible ne produit jamais un relevé partiel : la première ligne douteuse arrête la
 * lecture et son numéro est cité. Les lignes qui ne sont pas des opérations (ligne vide, total de
 * fin de fichier) sont écartées et annoncées dans `avertissements`.
 */

import { ErreurRegle, ZERO, formatMontant, type Devise, type Montant } from "./montants";
import { type DateCivile } from "./calendrier";
import { comptePrincipalDe, type Mouvement } from "./grand-livre";
import { analyserMontantSigne, type DemandeDeReleve, type FormatDeReleve } from "./rapprochement";

export type { FormatDeReleve };

export const FORMATS_DE_RELEVE: readonly FormatDeReleve[] = ["csv", "ofx", "camt053"];

/** Ce qu'un format de relevé porte comme nom, pour les messages et les menus. */
export const NOM_DE_FORMAT: Record<FormatDeReleve, string> = {
  csv: "CSV (texte séparé)",
  ofx: "OFX / QFX",
  camt053: "CAMT.053 (ISO 20022)"
};

/** Une opération lue dans le fichier, avant toute écriture dans le dossier. */
export interface LigneDeReleveLue {
  /** Rang de la ligne dans le fichier : cité dans les messages d'erreur. */
  numero: number;
  date: DateCivile;
  libelle: string;
  reference: string;
  /** Signé au sens de la banque : positif quand l'argent entre. */
  montant: Montant;
  /** Solde après l'opération, si le fichier le donne. */
  solde: Montant | null;
}

/** Une colonne reconnue, pour que l'utilisateur voie ce que le lecteur a compris. */
export interface Correspondance {
  role: string;
  colonne: string;
}

/** Le contenu d'un fichier de relevé, lu et vérifié. */
export interface ReleveImporte {
  format: FormatDeReleve;
  nomFichier: string | null;
  /** IBAN ou numéro de compte porté par le fichier, quand il l'est. */
  compteBancaire: string | null;
  /** Devise annoncée par le fichier, quand elle l'est. */
  deviseDuFichier: string | null;
  soldeDOuverture: Montant | null;
  soldeDeFin: Montant | null;
  dateDebut: DateCivile | null;
  dateFin: DateCivile | null;
  lignes: LigneDeReleveLue[];
  /** Lignes écartées, colonnes ignorées, incohérences : ce qui mérite d'être lu avant d'importer. */
  avertissements: string[];
  correspondances: Correspondance[];
}

export interface OptionsDeLecture {
  devise: Devise;
  /** Force un format ; à défaut, il est détecté depuis le contenu et le nom du fichier. */
  format?: FormatDeReleve;
  nomFichier?: string | null;
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Lit un fichier de relevé. N'écrit rien : le résultat se montre avant d'être importé. */
export function lireReleve(texte: string, options: OptionsDeLecture): ReleveImporte {
  const format = options.format ?? detecterFormatDeReleve(texte, options.nomFichier ?? null);
  const nomFichier = options.nomFichier ?? null;
  switch (format) {
    case "csv":
      return { ...lireReleveCsv(texte, options), format, nomFichier };
    case "ofx":
      return { ...lireReleveOfx(texte, options), format, nomFichier };
    case "camt053":
      return { ...lireReleveCamt053(texte, options), format, nomFichier };
  }
}

/**
 * Devine le format d'un fichier.
 *
 * Le contenu prime sur l'extension : un `.csv` qui porte du XML est un CAMT mal nommé, et c'est le
 * contenu qui se lit.
 */
export function detecterFormatDeReleve(texte: string, nomFichier: string | null): FormatDeReleve {
  const propre = texte.replace(/^\uFEFF/u, "").trim();
  if (propre === "") {
    throw new ErreurRegle("Le fichier est vide : rien à importer.");
  }
  if (/<OFX[\s>]/iu.test(propre) || /<STMTTRNRS[\s>]/iu.test(propre)) {
    return "ofx";
  }
  if (/<\?xml/iu.test(propre) || /<Document[\s>]/iu.test(propre) || /camt\.053/iu.test(propre)) {
    if (/<Ntry[\s>]/iu.test(propre) || /camt\.053/iu.test(propre)) {
      return "camt053";
    }
    throw new ErreurRegle(
      "Ce fichier XML n'est pas un relevé CAMT.053 : aucune entrée <Ntry> n'y figure. Un relevé CAMT.052 ou un MT940 ne se lit pas ici."
    );
  }
  const extension = nomFichier?.toLowerCase().match(/\.(csv|txt|ofx|qfx|xml|camt)$/u)?.[1] ?? null;
  if (extension === "ofx" || extension === "qfx") {
    throw new ErreurRegle(
      "Le fichier porte l'extension d'un OFX mais n'en contient pas la structure : aucune balise <OFX> ni <STMTTRNRS>."
    );
  }
  return "csv";
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

type Role = "date" | "dateValeur" | "libelle" | "reference" | "montant" | "debit" | "credit" | "solde" | "sens";

const NOM_DE_ROLE: Record<Role, string> = {
  date: "Date d'opération",
  dateValeur: "Date de valeur",
  libelle: "Libellé",
  reference: "Référence",
  montant: "Montant",
  debit: "Débit (sortie)",
  credit: "Crédit (entrée)",
  solde: "Solde",
  sens: "Sens (D/C)"
};

/** En-têtes reconnus, dans l'ordre : le premier motif qui prend, prend. */
const MOTIFS_DE_ROLE: readonly { role: Role; motif: RegExp }[] = [
  { role: "dateValeur", motif: /^(date\s*)?(de\s*)?valeur$/iu },
  { role: "dateValeur", motif: /valeur|value\s*date|val\.?/iu },
  { role: "date", motif: /^date$/iu },
  { role: "date", motif: /date|jour|posting|book(?:ing)?\s*date|ecriture|opération|operation/iu },
  { role: "reference", motif: /reference|référence|ref\b|numero|numéro|num\b|n°|cheque|chèque|check|fitid|piece|pièce/iu },
  { role: "libelle", motif: /libelle|libellé|intitule|intitulé|designation|désignation|description|motif|detail|détail|operation|opération|label|name|texte|commentaire/iu },
  { role: "debit", motif: /debit|débit|sortie|withdrawal|paid|paye|payé/iu },
  { role: "credit", motif: /credit|crédit|entree|entrée|deposit|received|recu|reçu|encaisse/iu },
  { role: "solde", motif: /solde|balance|avoir/iu },
  { role: "sens", motif: /^sens$|^d\/?c$|^c\/?d$|^signe$|^dc$/iu },
  { role: "montant", motif: /montant|amount|somme|valeur|total/iu }
];

interface LigneCsv {
  numero: number;
  cellules: string[];
}

interface LectureCsv {
  soldeDOuverture: Montant | null;
  soldeDeFin: Montant | null;
  dateDebut: DateCivile | null;
  dateFin: DateCivile | null;
  lignes: LigneDeReleveLue[];
  avertissements: string[];
  correspondances: Correspondance[];
  compteBancaire: string | null;
  deviseDuFichier: string | null;
}

function lireReleveCsv(texte: string, options: OptionsDeLecture): LectureCsv {
  const brut = texte.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  if (brut.trim() === "") {
    throw new ErreurRegle("Le fichier est vide : rien à importer.");
  }

  const separateur = detecterSeparateur(brut);
  const lignes = decouperCsv(brut, separateur).filter((ligne) => ligne.cellules.some((cellule) => cellule.trim() !== ""));
  if (lignes.length === 0) {
    throw new ErreurRegle("Le fichier ne contient aucune ligne lisible.");
  }

  const premierIndex = indexDeLaPremiereOperation(lignes, separateur);
  const entetes =
    premierIndex > 0
      ? lignes[premierIndex - 1]!.cellules.map((cellule) => nettoyerEnTete(cellule))
      : null;
  const roles = entetes ? mapperColonnes(entetes) : mapperSansEntete(lignes.slice(premierIndex));

  const avertissements: string[] = [];
  if (entetes) {
    const nonReconnues = entetes
      .map((entete, index) => ({ entete, index }))
      .filter(({ index }) => roles.get(index) === undefined)
      .map(({ entete }) => entete)
      .filter((entete) => entete !== "");
    if (nonReconnues.length > 0) {
      avertissements.push(
        `Colonne${nonReconnues.length > 1 ? "s" : ""} non reconnue${
          nonReconnues.length > 1 ? "s" : ""
        } et ignorée${nonReconnues.length > 1 ? "s" : ""} : ${nonReconnues.join(", ")}.`
      );
    }
  } else {
    const deuxColonnesDeMontant = [...roles.values()].includes("debit") && [...roles.values()].includes("credit");
    avertissements.push(
      deuxColonnesDeMontant
        ? "Aucune ligne d'en-tête reconnue : deux colonnes de montants ont été lues comme « débit puis crédit », la disposition la plus courante. Vérifiez l'aperçu avant d'importer."
        : "Aucune ligne d'en-tête reconnue : les colonnes ont été déduites de leur contenu. Vérifiez l'aperçu avant d'importer."
    );
  }

  const colonneDe = (role: Role): number | undefined => [...roles.entries()].find(([, valeur]) => valeur === role)?.[0];
  const dateColonne = colonneDe("date");
  if (dateColonne === undefined) {
    throw new ErreurRegle(
      "Aucune colonne de date n'a été reconnue. Un relevé date chaque opération : renommez la colonne « Date », ou saisissez le relevé ligne à ligne."
    );
  }
  const montantColonne = colonneDe("montant");
  const debitColonne = colonneDe("debit");
  const creditColonne = colonneDe("credit");
  if (montantColonne === undefined && debitColonne === undefined && creditColonne === undefined) {
    throw new ErreurRegle(
      "Aucune colonne de montant n'a été reconnue. Le relevé doit porter « Montant », ou « Débit » et « Crédit »."
    );
  }

  const decimale = detecterDecimale(
    lignes.slice(premierIndex).flatMap((ligne) => ligne.cellules),
    separateur
  );
  const ordreDesDates = detecterOrdreDesDates(lignes.slice(premierIndex).map((ligne) => ligne.cellules[dateColonne]!));

  const lire = {
    montant: (cellule: string, numero: number, colonne: string): Montant =>
      lireMontantDeReleve(cellule, { decimale, devise: options.devise, numero, colonne }),
    date: (cellule: string, numero: number): DateCivile => lireDateDeReleve(cellule, ordreDesDates, numero)
  };

  const lues: LigneDeReleveLue[] = [];
  const libelleColonne = colonneDe("libelle");
  const referenceColonne = colonneDe("reference");
  const soldeColonne = colonneDe("solde");
  const sensColonne = colonneDe("sens");

  for (const ligne of lignes.slice(premierIndex)) {
    const celluleDate = ligne.cellules[dateColonne] ?? "";
    if (celluleDate.trim() === "" || !estDate(celluleDate)) {
      // Une ligne de total, un pied de fichier, une note : pas une opération.
      const apercu = ligne.cellules.filter((cellule) => cellule.trim() !== "").join(" ");
      if (apercu.trim() !== "") {
        avertissements.push(
          `Ligne ${ligne.numero} écartée, aucune date d'opération n'y est lisible : « ${tronquer(apercu, 60)} ».`
        );
      }
      continue;
    }

    let montant: Montant;
    if (montantColonne !== undefined && debitColonne === undefined && creditColonne === undefined) {
      montant = lire.montant(ligne.cellules[montantColonne] ?? "", ligne.numero, NOM_DE_ROLE.montant);
      const sens = sensColonne !== undefined ? (ligne.cellules[sensColonne] ?? "").trim().toUpperCase() : "";
      if (sens !== "") {
        montant = appliquerSens(montant, sens, ligne.numero);
      }
    } else {
      const debit =
        debitColonne !== undefined ? lire.montant(ligne.cellules[debitColonne] ?? "", ligne.numero, NOM_DE_ROLE.debit) : ZERO;
      const credit =
        creditColonne !== undefined
          ? lire.montant(ligne.cellules[creditColonne] ?? "", ligne.numero, NOM_DE_ROLE.credit)
          : ZERO;
      if (debitColonne !== undefined && creditColonne !== undefined && debit !== ZERO && credit !== ZERO) {
        throw new ErreurRegle(
          `Ligne ${ligne.numero} : le débit (${debit}) et le crédit (${credit}) sont tous deux renseignés. Un relevé porte l'opération d'un seul côté.`
        );
      }
      if (debit === ZERO && credit === ZERO) {
        avertissements.push(`Ligne ${ligne.numero} écartée : aucun montant.`);
        continue;
      }
      // Sortie d'argent = montant négatif au sens de la banque.
      montant = credit !== ZERO ? credit : -debit;
    }

    if (montant === ZERO) {
      avertissements.push(`Ligne ${ligne.numero} écartée : montant nul.`);
      continue;
    }

    lues.push({
      numero: ligne.numero,
      date: lire.date(celluleDate, ligne.numero),
      libelle: libelleColonne !== undefined ? (ligne.cellules[libelleColonne] ?? "").trim() : "",
      reference: referenceColonne !== undefined ? (ligne.cellules[referenceColonne] ?? "").trim() : "",
      montant,
      solde:
        soldeColonne !== undefined && (ligne.cellules[soldeColonne] ?? "").trim() !== ""
          ? lire.montant(ligne.cellules[soldeColonne]!, ligne.numero, NOM_DE_ROLE.solde)
          : null
    });
  }

  if (lues.length === 0) {
    throw new ErreurRegle(
      "Aucune opération lisible dans ce fichier. Vérifiez le séparateur et les en-têtes, ou saisissez le relevé ligne à ligne."
    );
  }

  // Le solde d'ouverture se déduit du premier solde porté, à défaut il est laissé à l'utilisateur.
  const premierAvecSolde = lues.find((ligne) => ligne.solde !== null);
  const soldeDOuverture = premierAvecSolde ? premierAvecSolde.solde! - premierAvecSolde.montant : null;
  const dernierAvecSolde = [...lues].reverse().find((ligne) => ligne.solde !== null);
  const soldeDeFin = dernierAvecSolde ? dernierAvecSolde.solde : null;

  const dates = lues.map((ligne) => ligne.date).sort();
  const correspondances: Correspondance[] = [...roles.entries()]
    .sort(([gauche], [droite]) => gauche - droite)
    .map(([index, role]) => ({
      role: NOM_DE_ROLE[role],
      colonne: entetes?.[index] ?? `colonne ${index + 1}`
    }));
  correspondances.push({ role: "Séparateur", colonne: separateur === "\t" ? "tabulation" : `« ${separateur} »` });
  correspondances.push({ role: "Décimale", colonne: decimale === "." ? "point" : "virgule" });
  if (premierAvecSolde) {
    correspondances.push({
      role: "Solde d'ouverture déduit",
      colonne: formatMontant(soldeDOuverture!, options.devise)
    });
  }

  return {
    soldeDOuverture,
    soldeDeFin,
    dateDebut: dates[0] ?? null,
    dateFin: dates[dates.length - 1] ?? null,
    lignes: lues,
    avertissements,
    correspondances,
    compteBancaire: null,
    deviseDuFichier: null
  };
}

/** Le séparateur le plus fréquent et le plus régulier des premières lignes. */
function detecterSeparateur(brut: string): string {
  const echantillon = brut.split("\n").slice(0, 12).join("\n");
  const candidats = [";", ",", "\t", "|"];
  let meilleur = ";";
  let meilleurScore = -1;
  for (const candidat of candidats) {
    const parLigne = echantillon
      .split("\n")
      .filter((ligne) => ligne.trim() !== "")
      .map((ligne) => compterHorsGuillemets(ligne, candidat));
    if (parLigne.length === 0) {
      continue;
      }
    const minimum = Math.min(...parLigne);
    // Un séparateur régulier vaut mieux qu'un séparateur fréquent : le virgule des milliers piège.
    const score = minimum > 0 ? minimum * 100 + parLigne.reduce((total, nombre) => total + nombre, 0) : 0;
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = candidat;
    }
  }
  return meilleurScore <= 0 ? ";" : meilleur;
}

function compterHorsGuillemets(ligne: string, caractere: string): number {
  let compte = 0;
  let dansGuillemets = false;
  for (const element of ligne) {
    if (element === '"') {
      dansGuillemets = !dansGuillemets;
    } else if (element === caractere && !dansGuillemets) {
      compte += 1;
    }
  }
  return compte;
}

/** Découpe un CSV en respectant les guillemets, y compris quand un champ porte un retour à la ligne. */
function decouperCsv(brut: string, separateur: string): LigneCsv[] {
  const lignes: LigneCsv[] = [];
  let cellules: string[] = [];
  let cellule = "";
  let dansGuillemets = false;
  let numero = 1;

  const cloreLigne = (): void => {
    cellules.push(cellule);
    lignes.push({ numero, cellules });
    cellules = [];
    cellule = "";
    numero += 1;
  };

  for (let index = 0; index < brut.length; index += 1) {
    const caractere = brut[index]!;
    if (dansGuillemets) {
      if (caractere === '"') {
        if (brut[index + 1] === '"') {
          cellule += '"';
          index += 1;
        } else {
          dansGuillemets = false;
        }
      } else {
        cellule += caractere;
      }
      continue;
    }
    if (caractere === '"' && cellule === "") {
      // Un guillemet n'ouvre un champ cité que s'il le commence : les banques écrivent parfois
      // `REMISE CHEQUE "SOGEMA"` sans citer le champ, et ces guillemets-là sont du texte.
      dansGuillemets = true;
    } else if (caractere === separateur) {
      cellules.push(cellule);
      cellule = "";
    } else if (caractere === "\n") {
      cloreLigne();
    } else {
      cellule += caractere;
    }
  }
  if (cellule !== "" || cellules.length > 0) {
    cloreLigne();
  }
  return lignes;
}

/** La première ligne qui porte à la fois une date et un montant : les lignes d'avant sont l'en-tête. */
function indexDeLaPremiereOperation(lignes: readonly LigneCsv[], separateur: string): number {
  void separateur;
  for (let index = 0; index < lignes.length; index += 1) {
    const cellules = lignes[index]!.cellules;
    const aUneDate = cellules.some((cellule) => estDate(cellule));
    const aUnMontant = cellules.some((cellule) => estMontant(cellule));
    if (aUneDate && aUnMontant) {
      return index;
    }
  }
  // Aucune ligne ne cumule date et montant : on tente la première ligne qui porte une date.
  const repli = lignes.findIndex((ligne) => ligne.cellules.some((cellule) => estDate(cellule)));
  if (repli < 0) {
    throw new ErreurRegle(
      "Aucune date d'opération n'a été trouvée dans ce fichier. Les dates attendues sont du type 05/04/2026, 2026-04-05 ou 05.04.2026."
    );
  }
  return repli;
}

function nettoyerEnTete(cellule: string): string {
  return cellule
    .replace(/^\uFEFF/u, "")
    .trim()
    .replace(/^"(.*)"$/u, "$1")
    .replace(/\s+/gu, " ")
    .replace(/\(.*\)$/u, "")
    .trim();
}

function mapperColonnes(entetes: readonly string[]): Map<number, Role> {
  const roles = new Map<number, Role>();
  const pris = new Set<Role>();
  for (const { role, motif } of MOTIFS_DE_ROLE) {
    if (pris.has(role) && role !== "dateValeur") {
      continue;
    }
    // La première colonne **libre** qui correspond : « Date opération » contient « opération », et
    // sans cette précaution le libellé s'y arrêterait au lieu d'aller à la colonne « Libellé ».
    const index = entetes.findIndex(
      (entete, position) => entete !== "" && !roles.has(position) && motif.test(entete)
    );
    if (index >= 0) {
      roles.set(index, role);
      pris.add(role);
    }
  }
  return roles;
}

/** Sans en-tête : la colonne des dates, celle des montants, le texte le plus long, le code le plus court. */
function mapperSansEntete(lignes: readonly LigneCsv[]): Map<number, Role> {
  const largeur = Math.max(0, ...lignes.map((ligne) => ligne.cellules.length));
  const roles = new Map<number, Role>();
  const colonnes = Array.from({ length: largeur }, (_, index) => index);

  const date = colonnes.find((index) => lignes.every((ligne) => estDate(ligne.cellules[index] ?? "")));
  if (date !== undefined) {
    roles.set(date, "date");
  }
  const restants = colonnes.filter((index) => !roles.has(index));

  const numeriques = restants.filter((index) =>
    lignes.every((ligne) => estMontant(ligne.cellules[index] ?? ""))
  );
  if (numeriques.length >= 2) {
    // Deux colonnes numériques : un débit et un crédit. Lequel est lequel ne se devine pas — les
    // deux portent des montants positifs. La disposition « débit puis crédit » est de loin la plus
    // courante, elle est retenue et l'aperçu le dit : l'utilisateur vérifie avant d'importer.
    roles.set(numeriques[0]!, "debit");
    roles.set(numeriques[1]!, "credit");
  } else if (numeriques.length === 1) {
    roles.set(numeriques[0]!, "montant");
  }

  const libres = restants.filter((index) => !roles.has(index));
  if (libres.length > 0) {
    const longueurMoyenne = (index: number): number =>
      lignes.reduce((total, ligne) => total + (ligne.cellules[index] ?? "").trim().length, 0) /
      Math.max(1, lignes.length);
    const plusLongue = libres.reduce((meilleure, index) =>
      longueurMoyenne(index) > longueurMoyenne(meilleure) ? index : meilleure
    );
    roles.set(plusLongue, "libelle");
    const apres = libres.filter((index) => index !== plusLongue);
    if (apres.length > 0) {
      roles.set(apres[0]!, "reference");
    }
  }
  return roles;
}

/** La décimale du fichier : virgule en France, point ailleurs. */
function detecterDecimale(cellules: readonly string[], separateur: string): "," | "." {
  void separateur;
  let virgule = 0;
  let point = 0;
  for (const cellule of cellules) {
    const propre = cellule.trim().replace(/\s|\u00a0|\u202f/gu, "");
    if (!/^\(?\d/iu.test(propre)) {
      continue;
    }
    if (propre.includes(",") && propre.includes(".")) {
      // Le dernier des deux est la décimale, l'autre sépare les milliers.
      if (propre.lastIndexOf(",") > propre.lastIndexOf(".")) {
        virgule += 1;
      } else {
        point += 1;
      }
      continue;
    }
    if (/^-?\(?\d{1,3}(\.\d{3})+\)?$/u.test(propre)) {
      // Des milliers séparés par un point : le point n'est pas la décimale.
      virgule += 1;
    } else if (/^-?\(?\d{1,3}(,\d{3})+\)?$/u.test(propre)) {
      point += 1;
    } else if (propre.includes(",")) {
      virgule += 1;
    } else if (/\.\d{1,2}$/u.test(propre)) {
      point += 1;
    }
  }
  return point > virgule ? "." : ",";
}

/** Jour/mois ou mois/jour : le fichier le dit dès qu'une seule de ses dates tranche. */
function detecterOrdreDesDates(cellules: readonly string[]): "jm" | "mj" {
  let premierTropGrand = false;
  let secondTropGrand = false;
  for (const cellule of cellules) {
    const groupes = groupesDeDate(cellule);
    if (!groupes || groupes.length < 2) {
      continue;
    }
    if (Number(groupes[0]) > 12) {
      premierTropGrand = true;
    }
    if (Number(groupes[1]) > 12) {
      secondTropGrand = true;
    }
  }
  return !premierTropGrand && secondTropGrand ? "mj" : "jm";
}

/* ------------------------------------------------------------------ */
/* OFX                                                                 */
/* ------------------------------------------------------------------ */

interface LectureStructuree {
  soldeDOuverture: Montant | null;
  soldeDeFin: Montant | null;
  dateDebut: DateCivile | null;
  dateFin: DateCivile | null;
  lignes: LigneDeReleveLue[];
  avertissements: string[];
  correspondances: Correspondance[];
  compteBancaire: string | null;
  deviseDuFichier: string | null;
}

/**
 * OFX 1.x est du SGML : les balises ne sont pas fermées. La lecture se fait donc par blocs, sans
 * parseur XML — ce format n'a pas la profondeur qui rendrait l'exercice douteux.
 */
function lireReleveOfx(texte: string, options: OptionsDeLecture): LectureStructuree {
  const brut = texte.replace(/^\uFEFF/u, "");
  const avertissements: string[] = [];
  const blocs = blocsSgml(brut, "STMTTRN");
  if (blocs.length === 0) {
    throw new ErreurRegle(
      "Ce fichier OFX ne porte aucune opération : aucune balise <STMTTRN>. Un OFX de solde seul ne se rapproche pas."
    );
  }

  const lignes: LigneDeReleveLue[] = [];
  blocs.forEach((bloc, index) => {
    const numero = index + 1;
    const dateBrute = valeurSgml(bloc, "DTPOSTED") ?? valeurSgml(bloc, "DTUSER") ?? valeurSgml(bloc, "DTAVAIL");
    if (!dateBrute) {
      avertissements.push(`Opération ${numero} écartée : aucune date (<DTPOSTED>).`);
      return;
    }
    const montantBrut = valeurSgml(bloc, "TRNAMT");
    if (!montantBrut) {
      avertissements.push(`Opération ${numero} écartée : aucun montant (<TRNAMT>).`);
      return;
    }
    const nom = (valeurSgml(bloc, "NAME") ?? "").trim();
    const memo = (valeurSgml(bloc, "MEMO") ?? "").trim();
    // Le mémo porte souvent la pièce comptable (un numéro de règlement) : il rejoint le libellé
    // plutôt que d'être perdu. La référence, elle, reste celle de la banque — un numéro de chèque
    // d'abord, parce que c'est le seul qui pointe sans ambiguïté.
    lignes.push({
      numero,
      date: lireDateOfx(dateBrute, numero),
      libelle: nom === "" ? memo : memo === "" || nom.includes(memo) ? nom : `${nom} — ${memo}`,
      reference: (
        valeurSgml(bloc, "CHECKNUM") ??
        valeurSgml(bloc, "REFNUM") ??
        valeurSgml(bloc, "FITID") ??
        valeurSgml(bloc, "SRVRTID") ??
        ""
      ).trim(),
      // <TRNAMT> est signé au sens de la banque : négatif quand l'argent sort.
      montant: lireMontantIso(montantBrut, options.devise, numero, "TRNAMT"),
      solde: null
    });
  });

  if (lignes.length === 0) {
    throw new ErreurRegle("Aucune opération OFX lisible.");
  }

  const solde = blocSgml(brut, "LEDGERBAL");
  const soldeDeFin = solde ? lireMontantIso(valeurSgml(solde, "BALAMT") ?? "", options.devise, 0, "LEDGERBAL") : null;
  const dates = lignes.map((ligne) => ligne.date).sort();
  return {
    soldeDOuverture: null,
    soldeDeFin,
    dateDebut: dates[0] ?? null,
    dateFin: dates[dates.length - 1] ?? null,
    lignes,
    avertissements,
    correspondances: [
      { role: "Date d'opération", colonne: "DTPOSTED" },
      { role: "Montant", colonne: "TRNAMT (signé)" },
      { role: "Libellé", colonne: "NAME, MEMO à la suite" },
      { role: "Référence", colonne: "CHECKNUM puis REFNUM puis FITID" }
    ],
    compteBancaire: (valeurSgml(brut, "ACCTID") ?? null)?.trim() || null,
    deviseDuFichier: null
  };
}

/* ------------------------------------------------------------------ */
/* CAMT.053                                                            */
/* ------------------------------------------------------------------ */

function lireReleveCamt053(texte: string, options: OptionsDeLecture): LectureStructuree {
  const brut = texte.replace(/^\uFEFF/u, "");
  const avertissements: string[] = [];
  const entrees = blocsXml(brut, "Ntry");
  if (entrees.length === 0) {
    throw new ErreurRegle(
      "Ce fichier CAMT.053 ne porte aucune entrée <Ntry>. Un CAMT.052 (intraday) ou un CAMT.054 (avis d'opéré) ne se lit pas ici."
    );
  }

  const lignes: LigneDeReleveLue[] = [];
  entrees.forEach((entree, index) => {
    const numero = index + 1;
    const montantBrut = valeurXml(entree, "Amt");
    if (!montantBrut) {
      avertissements.push(`Entrée ${numero} écartée : aucun montant <Amt>.`);
      return;
    }
    const dateBrute =
      valeurXml(blocXml(entree, "BookgDt") ?? "", "Dt") ??
      valeurXml(blocXml(entree, "ValDt") ?? "", "Dt") ??
      valeurXml(blocXml(entree, "BookgDt") ?? "", "DtTm") ??
      valeurXml(entree, "Dt");
    if (!dateBrute) {
      avertissements.push(`Entrée ${numero} écartée : aucune date de comptabilisation <BookgDt><Dt>.`);
      return;
    }
    const sens = (valeurXml(entree, "CdtDbtInd") ?? "").trim().toUpperCase();
    if (sens !== "CRDT" && sens !== "DBIT") {
      throw new ErreurRegle(
        `Entrée ${numero} : le sens <CdtDbtInd> vaut « ${sens || "vide"} », ni CRDT ni DBIT. Le fichier est-il un CAMT.053 ?`
      );
    }
    const montant = lireMontantIso(montantBrut, options.devise, numero, "Amt");
    const details = blocXml(entree, "NtryDtls") ?? "";
    const detail = blocXml(details, "TxDtls") ?? details;
    const libelle =
      valeurXml(blocXml(detail, "RmtInf") ?? "", "Ustrd") ??
      valeurXml(blocXml(detail, "RmtInf") ?? "", "Strd") ??
      valeurXml(blocXml(detail, "AddtlNtryInf") ?? "", "Ustrd") ??
      valeurXml(entree, "AddtlNtryInf") ??
      (valeurXml(blocXml(detail, "Cd") ?? "", "Prtry") ?? "");
    const reference =
      valeurXml(blocXml(detail, "Refs") ?? "", "EndToEndId") ??
      valeurXml(blocXml(detail, "Refs") ?? "", "InstrId") ??
      valeurXml(blocXml(detail, "Refs") ?? "", "ChqNb") ??
      valeurXml(detail, "NtryRef") ??
      valeurXml(entree, "NtryRef") ??
      "";

    lignes.push({
      numero,
      date: lireDateIso(dateBrute, numero),
      libelle: nettoyerLibelleXml(libelle),
      reference: nettoyerLibelleXml(reference),
      montant: sens === "CRDT" ? montant : -montant,
      solde: null
    });
  });

  if (lignes.length === 0) {
    throw new ErreurRegle("Aucune entrée CAMT.053 lisible.");
  }

  const soldes = blocsXml(brut, "Bal");
  const soldeDe = (codes: readonly string[]): Montant | null => {
    for (const bloc of soldes) {
      const code = codeDeSolde(bloc);
      if (code !== null && codes.includes(code)) {
        const brutSolde = valeurXml(bloc, "Amt");
        if (!brutSolde) {
          continue;
        }
        const sens = (valeurXml(bloc, "CdtDbtInd") ?? "").trim().toUpperCase();
        const valeur = lireMontantIso(brutSolde, options.devise, 0, "Amt");
        return sens === "DBIT" ? -valeur : valeur;
      }
    }
    return null;
  };
  // PRCD = solde de clôture précédent (l'ouverture de ce relevé), OPBK = solde d'ouverture.
  const soldeDOuverture = soldeDe(["PRCD", "OPBK"]);
  const soldeDeFin = soldeDe(["CLBD", "ITBD"]);

  const dates = lignes.map((ligne) => ligne.date).sort();
  return {
    soldeDOuverture,
    soldeDeFin,
    dateDebut: dates[0] ?? null,
    dateFin: dates[dates.length - 1] ?? null,
    lignes,
    avertissements,
    correspondances: [
      { role: "Date d'opération", colonne: "BookgDt/Dt, à défaut ValDt/Dt" },
      { role: "Montant", colonne: "Amt avec CdtDbtInd (CRDT/DBIT)" },
      { role: "Libellé", colonne: "RmtInf/Ustrd" },
      { role: "Référence", colonne: "Refs/EndToEndId puis InstrId puis ChqNb" },
      { role: "Solde d'ouverture", colonne: soldeDOuverture === null ? "non porté par le fichier" : "Bal PRCD ou OPBK" }
    ],
    compteBancaire: valeurXml(blocXml(blocXml(brut, "Acct") ?? "", "Id") ?? "", "IBAN") ?? null,
    deviseDuFichier: attributXml(premiereBalise(brut, "Amt") ?? "", "Ccy")
  };
}

/** Codes de solde de l'ISO 20022, cherchés parmi tous les `<Cd>` du type de solde. */
const CODES_DE_SOLDE: readonly string[] = ["OPBK", "PRCD", "CLBD", "ITBD", "XOPK", "XCLD", "FWDA", "OTHR"];

function codeDeSolde(blocDeSolde: string): string | null {
  const type = blocXml(blocDeSolde, "Tp") ?? blocDeSolde;
  const codes = blocsXml(type, "Cd")
    .map((bloc) => bloc.replace(/<[^>]*>/gu, "").trim().toUpperCase())
    .filter((code) => code !== "");
  return codes.find((code) => CODES_DE_SOLDE.includes(code)) ?? codes[codes.length - 1] ?? null;
}

function nettoyerLibelleXml(brut: string | null): string {
  return (brut ?? "")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Extraction XML et SGML                                              */
/* ------------------------------------------------------------------ */

/** Contenu intérieur de chaque bloc `<nom>…</nom>`, imbrications comprises. */
function blocsXml(xml: string, nom: string): string[] {
  const motif = new RegExp(`<(/?)${nom}(?=[\\s/>])`, "giu");
  const resultat: string[] = [];
  let profondeur = 0;
  let debutContenu = -1;
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(xml)) !== null) {
    const ferme = correspondance[1] === "/";
    const finDeBalise = xml.indexOf(">", correspondance.index);
    if (finDeBalise < 0) {
      break;
    }
    const autoFermante = xml[finDeBalise - 1] === "/";
    if (!ferme) {
      if (profondeur === 0) {
        debutContenu = finDeBalise + 1;
      }
      if (!autoFermante) {
        profondeur += 1;
      } else if (profondeur === 0) {
        resultat.push("");
        debutContenu = -1;
      }
    } else {
      profondeur -= 1;
      if (profondeur === 0 && debutContenu >= 0) {
        resultat.push(xml.slice(debutContenu, correspondance.index));
        debutContenu = -1;
      }
    }
    motif.lastIndex = finDeBalise + 1;
  }
  return resultat;
}

function blocXml(xml: string, nom: string): string | null {
  return blocsXml(xml, nom)[0] ?? null;
}

function valeurXml(xml: string, nom: string): string | null {
  const bloc = blocXml(xml, nom);
  if (bloc === null) {
    return null;
  }
  const texte = bloc.replace(/<[^>]*>/gu, "").trim();
  return texte === "" ? null : texte;
}

function premiereBalise(xml: string, nom: string): string | null {
  const motif = new RegExp(`<${nom}(?=[\\s/>])[^>]*>`, "iu");
  return xml.match(motif)?.[0] ?? null;
}

function attributXml(balise: string, nom: string): string | null {
  const motif = new RegExp(`${nom}\\s*=\\s*"([^"]*)"`, "iu");
  return balise.match(motif)?.[1]?.trim() || null;
}

/**
 * OFX 1.x n'a pas de balises fermantes : un bloc va d'une balise ouvrante à la suivante du même
 * rang. On découpe donc sur la balise ouvrante, ce qui suffit à un relevé.
 */
function blocsSgml(texte: string, nom: string): string[] {
  const motif = new RegExp(`<${nom}(?=[\\s>])`, "giu");
  const positions: number[] = [];
  let correspondance: RegExpExecArray | null;
  while ((correspondance = motif.exec(texte)) !== null) {
    positions.push(correspondance.index);
    motif.lastIndex = correspondance.index + 1;
  }
  return positions.map((position, index) => {
    const fin = index + 1 < positions.length ? positions[index + 1]! : texte.length;
    const bloc = texte.slice(position, fin);
    const fermeture = bloc.search(new RegExp(`</${nom}>|<${nom}(?=[\\s>])`, "iu"));
    return fermeture > 0 ? bloc.slice(0, fermeture) : bloc;
  });
}

function blocSgml(texte: string, nom: string): string | null {
  return blocsSgml(texte, nom)[0] ?? null;
}

function valeurSgml(bloc: string, nom: string): string | null {
  const motif = new RegExp(`<${nom}>([^<\\r\\n]*)`, "iu");
  const trouve = bloc.match(motif)?.[1]?.trim();
  return trouve === undefined || trouve === "" ? null : trouve;
}

/* ------------------------------------------------------------------ */
/* Dates et montants                                                   */
/* ------------------------------------------------------------------ */

function groupesDeDate(cellule: string): string[] | null {
  const propre = cellule.trim().replace(/^\uFEFF/u, "");
  const iso = propre.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (iso) {
    // Rendu dans l'ordre jour, mois, année, comme les dates européennes : l'ISO ne se devine pas.
    return [iso[3]!, iso[2]!, iso[1]!];
  }
  const europeen = propre.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/u);
  if (europeen) {
    return [europeen[1]!, europeen[2]!, europeen[3]!];
  }
  return null;
}

/** Une cellule a la forme d'une date, sans préjuger de ce qu'elle vaut. */
export function estDate(cellule: string): boolean {
  return groupesDeDate(cellule) !== null;
}

function lireDateDeReleve(cellule: string, ordre: "jm" | "mj", numero: number): DateCivile {
  const groupes = groupesDeDate(cellule);
  if (!groupes) {
    throw new ErreurRegle(`Ligne ${numero} : la date « ${tronquer(cellule.trim(), 30)} » n'est pas lisible.`);
  }
  // `groupesDeDate` rend toujours jour, mois, année — pour l'ISO, il permute déjà.
  // `groupes` rend toujours jour, mois, année ; l'ordre américain inverse les deux premiers.
  let [premier, second, annee] = groupes;
  if (ordre === "mj") {
    [premier, second] = [second!, premier!];
  }
  return composerDate(Number(annee), Number(second), Number(premier), numero, cellule);
}

function lireDateIso(brute: string, numero: number): DateCivile {
  const trouve = brute.trim().match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (!trouve) {
    throw new ErreurRegle(`Entrée ${numero} : la date « ${tronquer(brute, 30)} » n'est pas au format ISO.`);
  }
  return composerDate(Number(trouve[1]), Number(trouve[2]), Number(trouve[3]), numero, brute);
}

/** OFX date en `AAAAMMJJ` suivi d'une heure facultative. */
function lireDateOfx(brute: string, numero: number): DateCivile {
  const trouve = brute.trim().match(/^(\d{4})(\d{2})(\d{2})/u);
  if (!trouve) {
    throw new ErreurRegle(`Opération ${numero} : la date OFX « ${tronquer(brute, 30)} » n'est pas lisible.`);
  }
  return composerDate(Number(trouve[1]), Number(trouve[2]), Number(trouve[3]), numero, brute);
}

function composerDate(annee: number, mois: number, jour: number, numero: number, brut: string): DateCivile {
  const anneeComplete = annee < 100 ? (annee < 70 ? 2000 + annee : 1900 + annee) : annee;
  if (mois < 1 || mois > 12 || jour < 1 || jour > 31) {
    throw new ErreurRegle(
      `Ligne ${numero} : la date « ${tronquer(
        brut.trim(),
        30
      )} » ne tient pas debout (mois ${mois}, jour ${jour}). Un relevé porte des dates civiles.`
    );
  }
  const date = `${anneeComplete.toString().padStart(4, "0")}-${mois.toString().padStart(2, "0")}-${jour
    .toString()
    .padStart(2, "0")}` as DateCivile;
  // Contrôle du calendrier réel : le 31 février n'existe pas, et une banque ne le date pas.
  const verifie = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(verifie.getTime()) || verifie.getUTCDate() !== jour || verifie.getUTCMonth() + 1 !== mois) {
    throw new ErreurRegle(`Ligne ${numero} : la date « ${tronquer(brut.trim(), 30)} » n'existe pas.`);
  }
  return date;
}

/** Une cellule a la forme d'un montant. */
export function estMontant(cellule: string): boolean {
  const propre = cellule
    .trim()
    .replace(/[\s\u00a0\u202f\u2009]/gu, "")
    .replace(/^\(|\)$/gu, "")
    .replace(/(FCFA|XOF|EUR|USD)$/iu, "")
    .replace(/^-|-$/gu, "");
  if (propre === "") {
    return false;
  }
  // 1234, 1234.56, 1.234,56, 1 234 (les espaces ont déjà sauté), (1234)
  return /^\d{1,3}([.,]\d{3})+([.,]\d+)?$|^\d+([.,]\d+)?$/u.test(propre);
}

function appliquerSens(montant: Montant, sens: string, numero: number): Montant {
  const lettre = sens.charAt(0).toUpperCase();
  if (lettre === "D" || sens === "DEBIT" || sens === "DÉBIT") {
    return montant > ZERO ? -montant : montant;
  }
  if (lettre === "C" || sens === "CREDIT" || sens === "CRÉDIT") {
    return montant < ZERO ? -montant : montant;
  }
  throw new ErreurRegle(
    `Ligne ${numero} : le sens « ${tronquer(sens, 12)} » n'est ni D ni C. Retirez la colonne de sens, ou corrigez le fichier.`
  );
}

/**
 * Montant d'un CSV : séparateurs de milliers et décimale déjà décidés pour le fichier entier, signe
 * porté par un tiret, des parenthèses ou une lettre D/C en fin de cellule.
 */
function lireMontantDeReleve(
  cellule: string,
  options: { decimale: "," | "."; devise: Devise; numero: number; colonne: string }
): Montant {
  const brut = cellule.trim();
  if (brut === "") {
    return ZERO;
  }
  const mille = options.decimale === "," ? "." : ",";
  let propre = brut.replace(/[\s\u00a0\u202f\u2009]/gu, "").replaceAll(mille, "");
  const negatif =
    (propre.startsWith("(") && propre.endsWith(")")) || propre.startsWith("-") || propre.endsWith("-");
  propre = propre
    .replace(/^\(|\)$/gu, "")
    .replace(/^-|-$/gu, "")
    .replace(/\s*(FCFA|XOF|EUR|USD)\s*$/iu, "")
    .replace(/\s*[DC]\s*$/iu, "")
    .replaceAll(options.decimale, ".");
  if (propre === "" || !/^\d*\.?\d*$/u.test(propre)) {
    throw new ErreurRegle(
      `Ligne ${options.numero} : la colonne « ${options.colonne} » porte « ${tronquer(
        brut,
        30
      )} », qui n'est pas un montant.`
    );
  }
  const signe = negatif ? "-" : "";
  return analyserMontantExact(`${signe}${propre}`, options.devise, options.numero, brut);
}

/** Montant d'un fichier structuré : déjà en notation décimale ISO (`1234.56`). */
function lireMontantIso(brute: string, devise: Devise, numero: number, balise: string): Montant {
  const propre = brute.trim().replace(/[\s\u00a0]/gu, "");
  if (!/^-?\d+(\.\d+)?$/u.test(propre)) {
    throw new ErreurRegle(
      `${numero > 0 ? `Entrée ${numero} : ` : ""}le montant « ${tronquer(brute, 30)} » (${balise}) n'est pas décimal.`
    );
  }
  return analyserMontantExact(propre, devise, numero, brute);
}

/**
 * Dernier contrôle avant le montant exact : la devise du dossier décide du nombre de décimales, et
 * une décimale non nulle en XOF est refusée plutôt qu'arrondie.
 */
function analyserMontantExact(propre: string, devise: Devise, numero: number, brut: string): Montant {
  const negatif = propre.startsWith("-");
  const corps = negatif ? propre.slice(1) : propre;
  const [entier = "0", decimales = ""] = corps.split(".");
  const refus = (raison: string): never => {
    throw new ErreurRegle(
      `${numero > 0 ? `Ligne ${numero} : ` : ""}le montant « ${tronquer(brut.trim(), 30)} » ${raison}`
    );
  };

  // Un fichier écrit « 1170000.00 » même en XOF : des zéros après la virgule ne portent aucune
  // information, ils sont ôtés. Des centimes réels, eux, sont refusés plutôt qu'arrondis.
  let normalise = corps;
  if (decimales.length > devise.decimales) {
    const surplus = decimales.slice(devise.decimales);
    if (!/^0+$/u.test(surplus)) {
      refus(
        `porte ${decimales.length} décimales, et le ${devise.nom} n'en admet que ${
          devise.decimales
        }. Aucun arrondi n'est appliqué : corrigez le fichier ou la devise du dossier.`
      );
    }
    normalise = devise.decimales === 0 ? entier : `${entier}.${decimales.slice(0, devise.decimales)}`;
  }

  try {
    return analyserMontantSigne(`${negatif ? "-" : ""}${normalise}`, devise);
  } catch (erreur) {
    throw new ErreurRegle(
      `${numero > 0 ? `Ligne ${numero} : ` : ""}le montant « ${tronquer(brut.trim(), 30)} » est illisible (${
        erreur instanceof Error ? erreur.message : String(erreur)
      }).`
    );
  }
}

function tronquer(texte: string, longueur: number): string {
  const propre = texte.replace(/\s+/gu, " ").trim();
  return propre.length <= longueur ? propre : `${propre.slice(0, longueur - 1)}…`;
}

/* ------------------------------------------------------------------ */
/* De la lecture au relevé                                             */
/* ------------------------------------------------------------------ */

export interface DemandeDImport {
  /** Compte de trésorerie du dossier : le fichier ne le connaît pas sous cette forme. */
  compte: string;
  journalCode?: string;
  libelle?: string;
  /** Bornes du relevé ; à défaut, celles lues dans le fichier. */
  du?: DateCivile;
  au?: DateCivile;
  /** Solde d'ouverture ; à défaut, celui déduit du fichier, à défaut le solde comptable. */
  soldeDOuverture?: string | Montant;
}

/**
 * Transforme une lecture en demande de relevé.
 *
 * C'est ici que se joue l'honnêteté de l'import : ce que le fichier ne dit pas (le compte du dossier,
 * le libellé du relevé, parfois le solde d'ouverture) est demandé, jamais inventé.
 */
export function demandeDeReleveDepuisImport(
  importe: ReleveImporte,
  demande: DemandeDImport
): DemandeDeReleve {
  if (importe.lignes.length === 0) {
    throw new ErreurRegle("Le fichier ne porte aucune opération : rien à importer.");
  }
  const dates = importe.lignes.map((ligne) => ligne.date).sort();
  const du = demande.du ?? dates[0]!;
  const au = demande.au ?? dates[dates.length - 1]!;
  const horsBornes = importe.lignes.filter((ligne) => ligne.date < du || ligne.date > au);
  if (horsBornes.length > 0) {
    throw new ErreurRegle(
      `${horsBornes.length} opération${horsBornes.length > 1 ? "s" : ""} du fichier tombe${
        horsBornes.length > 1 ? "nt" : ""
      } hors de la période demandée (${du} – ${au}). Élargissez la période : un relevé amputé ne se rapproche pas.`
    );
  }
  const soldeDOuverture =
    demande.soldeDOuverture ??
    importe.soldeDOuverture ??
    (() => {
      throw new ErreurRegle(
        "Le fichier ne porte pas de solde d'ouverture, et aucun n'est saisi. Indiquez le solde du compte à la veille du relevé : c'est lui que le rapprochement vérifie."
      );
    })();

  return {
    compte: demande.compte,
    ...(demande.journalCode ? { journalCode: demande.journalCode } : {}),
    libelle:
      demande.libelle?.trim() ||
      `Relevé importé du ${dates[0]!.slice(8)}-${dates[0]!.slice(5, 7)}-${dates[0]!.slice(0, 4)} au ${dates[
        dates.length - 1
      ]!.slice(8)}-${dates[dates.length - 1]!.slice(5, 7)}-${dates[dates.length - 1]!.slice(0, 4)}`,
    dateDebut: du,
    dateFin: au,
    soldeDOuverture,
    lignes: importe.lignes.map((ligne) => ({
      date: ligne.date,
      libelle: ligne.libelle === "" ? `Opération du ${ligne.date}` : ligne.libelle,
      reference: ligne.reference,
      montant: ligne.montant
    }))
  };
}

/**
 * Empreinte d'une ligne de relevé, pour reconnaître un doublon.
 *
 * Le libellé n'y figure pas : les banques reformulent. La date, la référence et le montant signent
 * l'opération.
 */
export function cleDeDoublon(ligne: { date: DateCivile; reference: string; montant: Montant }): string {
  return `${ligne.date}|${ligne.reference.trim().toUpperCase()}|${ligne.montant.toString()}`;
}

/* ------------------------------------------------------------------ */
/* Relevé d'exemple                                                    */
/* ------------------------------------------------------------------ */

export interface OperationBancaireSeule {
  date: DateCivile;
  libelle: string;
  reference: string;
  /** Signé au sens de la banque. */
  montant: Montant;
}

/**
 * Un fichier de relevé d'exemple, au format des banques de l'UEMOA.
 *
 * Il est construit à partir du grand livre du dossier — les opérations que la comptabilité connaît —
 * plus les opérations que **seule la banque connaît** (des frais prélevés, un chèque remis mais non
 * comptabilisé). C'est ce qui rend l'exemple utile : le rapprochement a quelque chose à expliquer,
 * comme avec un vrai relevé. Un utilisateur qui n'a pas de relevé sous la main essaie l'import sur
 * celui-ci, et voit le même écran qu'avec le sien.
 */
export function exempleDeReleveCsv(options: {
  compte: string;
  mouvements: readonly Mouvement[];
  du: DateCivile;
  au: DateCivile;
  soldeDOuverture: Montant;
  devise: Devise;
  separees?: readonly OperationBancaireSeule[];
}): string {
  const retenus = options.mouvements
    .filter(
      (mouvement) =>
        comptePrincipalDe(mouvement.compte) === options.compte &&
        mouvement.date >= options.du &&
        mouvement.date <= options.au &&
        (mouvement.debit !== ZERO || mouvement.credit !== ZERO)
    )
    .map((mouvement) => ({
      date: mouvement.date,
      libelle: mouvement.libelle,
      reference: mouvement.piece,
      // Un débit du compte de trésorerie est une sortie d'argent : négatif au sens de la banque.
      montant: mouvement.debit !== ZERO ? mouvement.debit : -mouvement.credit
    }));
  const separees = (options.separees ?? []).map((operation) => ({ ...operation }));
  const toutes = [...retenus, ...separees].sort((gauche, droite) =>
    gauche.date === droite.date ? (gauche.reference < droite.reference ? -1 : 1) : gauche.date < droite.date ? -1 : 1
  );

  const entetes = ["Date opération", "Date valeur", "Libellé", "Référence", "Montant", "Solde"];
  const lignes = [`Résumé de compte — ${options.compte} — du ${options.du} au ${options.au}`];
  lignes.push(entetes.join(";"));
  let solde = options.soldeDOuverture;
  for (const operation of toutes) {
    solde += operation.montant;
    lignes.push(
      [
        dateEnCsv(operation.date),
        dateEnCsv(operation.date),
        csvCellule(operation.libelle),
        csvCellule(operation.reference),
        csvCellule(montantEnCsv(operation.montant, options.devise)),
        csvCellule(montantEnCsv(solde, options.devise))
      ].join(";")
    );
  }
  lignes.push("");
  lignes.push(`Total des opérations;${toutes.length}`);
  return `${lignes.join("\n")}\n`;
}

function dateEnCsv(date: DateCivile): string {
  return `${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

/**
 * Le CSV d'exemple est écrit comme une banque de l'UEMOA l'écrit : point-virgule, milliers séparés
 * par une espace. Un espace fine insécable ne passerait pas tous les lecteurs : elle est remplacée.
 */
function montantEnCsv(montant: Montant, devise: Devise): string {
  const format = formatMontant(montant < ZERO ? -montant : montant, devise).replaceAll("\u202f", " ");
  return montant < ZERO ? `-${format}` : format;
}

function csvCellule(texte: string): string {
  const propre = texte.replace(/\s+/gu, " ").trim();
  return /[;"\n]/u.test(propre) ? `"${propre.replaceAll('"', '""')}"` : propre;
}
