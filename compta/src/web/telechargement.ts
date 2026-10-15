/**
 * Téléchargement d'un document au format CSV.
 *
 * Le CSV est le seul format qu'un navigateur produit sans dépendance : il est livré maintenant,
 * Excel et PDF suivent. Trois conventions héritées des cabinets francophones, qui ouvrent ces
 * fichiers dans Excel :
 *
 *  - le séparateur est le **point-virgule** : Excel en français ne découpe pas les virgules ;
 *  - un **BOM UTF-8** ouvre le fichier, sinon les accents et le « œ » disparaissent ;
 *  - les fins de ligne sont **CRLF**.
 *
 * La construction du contenu est une fonction pure (`lignesVersCsv`) : elle est testable sans
 * navigateur, ce que le déclenchement du téléchargement n'est pas.
 */

import type { DateCivile } from "../noyau/index";

export const SEPARATEUR_CSV = ";";
const BOM = "\uFEFF";
const FIN_DE_LIGNE = "\r\n";

export type CelluleCsv = string | number | bigint | null;

/** Une cellule est entourée de guillemets dès qu'elle contient un caractère qui casserait la colonne. */
export function celluleCsv(valeur: CelluleCsv): string {
  if (valeur === null || valeur === undefined) {
    return "";
  }
  const texte = String(valeur);
  return /[;"\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Construit le contenu d'un fichier CSV, BOM et fins de ligne compris. */
export function lignesVersCsv(lignes: readonly (readonly CelluleCsv[])[]): string {
  const corps = lignes
    .map((ligne) => ligne.map(celluleCsv).join(SEPARATEUR_CSV))
    .join(FIN_DE_LIGNE);
  return `${BOM}${corps}${FIN_DE_LIGNE}`;
}

/**
 * Nom de fichier lisible et stable : `perfectys_<document>_<contexte>_<AAAA-MM-JJ>.csv`.
 *
 * Sans accent ni espace, pour survivre à tous les systèmes de fichiers et aux envois par courriel.
 */
export function nomDeFichier(extension: string, tige: string, contexte: string, date: DateCivile): string {
  const propre = (texte: string): string =>
    texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "document";
  return `perfectys_${propre(tige)}_${propre(contexte)}_${date}.${extension}`;
}

/** Déclenche le téléchargement dans le navigateur. */
export function telecharger(nomFichier: string, contenu: string, type = "text/csv;charset=utf-8"): void {
  if (typeof document === "undefined") {
    throw new Error("Le téléchargement n'est disponible que dans un navigateur.");
  }
  const blob = new Blob([contenu], { type });
  const url =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(blob)
      : `data:${type},${encodeURIComponent(contenu)}`;
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  if (url.startsWith("blob:") && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(url);
  }
}

/**
 * Déclenche le téléchargement d'un fichier binaire (Excel, PDF).
 *
 * Les octets sont passés tels quels : aucune conversion de texte ne doit intervenir entre le moteur
 * de rendu et le fichier reçu, sinon un XLSX devient illisible sans que rien ne le signale.
 */
export function telechargerOctets(nomFichier: string, octets: Uint8Array, mime: string): void {
  if (typeof document === "undefined") {
    throw new Error("Le téléchargement n'est disponible que dans un navigateur.");
  }
  const blob = new Blob([octets as unknown as BlobPart], { type: mime });
  const url =
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(blob)
      : "";
  if (url === "") {
    throw new Error("Ce navigateur ne permet pas de créer un fichier à télécharger.");
  }
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  lien.style.display = "none";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  if (typeof URL.revokeObjectURL === "function") {
    // Libéré après le clic : le navigateur a déjà pris les octets en charge.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Télécharge des lignes au format CSV. */
export function telechargerCsv(
  noms: { tige: string; contexte: string; date: DateCivile },
  lignes: readonly (readonly CelluleCsv[])[]
): string {
  const nom = nomDeFichier("csv", noms.tige, noms.contexte, noms.date);
  telecharger(nom, lignesVersCsv(lignes));
  return nom;
}
