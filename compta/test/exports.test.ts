/**
 * Les trois formats d'export, à partir d'une même description.
 *
 * Ce qui est vérifié : que la description reconstruite depuis les lignes d'un écran retrouve les
 * sections, les paramètres, les colonnes de montants et les totaux ; qu'un montant reste un **nombre**
 * dans Excel (un état qu'il faut ressaisir pour le sommer ne sert à rien) ; que le PDF est un PDF,
 * paginé, portant l'identité de la société, et que les caractères que ses polices standard feraient
 * disparaître sont normalisés ; et que le nom de fichier survit à un système de fichiers.
 */

import { describe, expect, it } from "vitest";
import Excel from "exceljs";
import {
  MIME_EXCEL,
  MIME_PDF,
  documentDepuisLignes,
  horodatageFr,
  texteDeCellule,
  valeurDeCellule,
  type ChampAExporter,
  type ColonneAExporter,
  type DocumentAExporter,
  type LigneAExporter,
  type SectionAExporter,
  type SocieteAExporter
} from "../src/web/exports/document";
import { rendreExcel } from "../src/web/exports/excel";
import { rendrePdf } from "../src/web/exports/pdf";
import {
  MARGES_PDF_MM,
  largeurTotaleEnMm,
  nettoyerPourPdf,
  nomDOnglet,
  orientationPreferree
} from "../src/web/exports/texte";
import { nomDeFichier } from "../src/web/telechargement";
import type { CelluleCsv } from "../src/web/telechargement";

const SOCIETE: SocieteAExporter = {
  raisonSociale: "BÉNIN NÉGOCE DISTRIBUTION",
  formeJuridique: "SARL",
  identifiantFiscal: "0020151234567",
  adresse: "Lot 214, quartier Ganhi, BP 1234",
  ville: "Cotonou",
  pays: "Bénin",
  telephone: "+229 21 30 45 67"
};

const BASE_DOCUMENT = {
  societe: SOCIETE,
  dossier: "CG000-26",
  exercice: "Exercice 2026 (01/01/2026 - 31/12/2026)",
  devise: "XOF",
  genereLe: "2026-04-30T09:41:00.000Z",
  generePar: "superviseur",
  pied: "Perfectys Compta — plan SYSCOHADA révisé, paquet pays Bénin.",
  date: "2026-04-30"
} as const;

/**
 * Les lignes d'une balance, dans la convention qu'un écran prépare pour son export : titre,
 * paramètres de l'édition, ligne de titres, données, ligne de totaux.
 */
function lignesDUneBalance(): (readonly CelluleCsv[])[] {
  return [
    ["Dossier", "CG000-26"],
    ["Société", "BÉNIN NÉGOCE DISTRIBUTION"],
    ["Édition", "période 4", "cumulée"],
    [],
    ["Compte", "Libellé", "Classe", "Débit", "Crédit", "Solde", "Sens", "Date d'ouverture"],
    ["401100", "Fournisseurs d'exploitation", "4", 1170000n, 11170000n, -10000000n, "crediteur", "2026-01-01"],
    ["521100", "Banque principale", "5", 58500000n, 3500000n, 55000000n, "debiteur", "2026-01-01"],
    ["701100", "Ventes de marchandises", "7", 0n, 2000000n, -2000000n, "crediteur", "2026-01-01"],
    [],
    ["Totaux", null, null, 60670000n, 16670000n, 43000000n, null, null]
  ];
}

function documentBalance(): DocumentAExporter {
  return documentDepuisLignes({
    titre: "Balance générale",
    sousTitre: "Seuls les mouvements comptabilisés apparaissent",
    tige: "balance",
    contexte: "2026-periode-4",
    lignes: lignesDUneBalance(),
    champs: [{ libelle: "Édition", valeur: "période 4 · cumulée" }],
    ...BASE_DOCUMENT
  });
}

/** Un document dont les sections sont écrites à la main, pour les cas que l'inférence ne couvre pas. */
function documentAvecSections(sections: SectionAExporter[]): DocumentAExporter {
  return {
    titre: "Balance générale",
    sousTitre: "Seuls les mouvements comptabilisés apparaissent",
    tige: "balance",
    contexte: "2026-periode-4",
    champs: [],
    sections,
    ...BASE_DOCUMENT
  };
}

function colonne(titre: string, genre: ColonneAExporter["genre"], cle = titre): ColonneAExporter {
  const alignement =
    genre === "montant" || genre === "nombre" ? "droite" : genre === "date" ? "centre" : "gauche";
  return { cle, titre, alignement, genre };
}

/**
 * Le texte réellement imprimé dans un PDF non compressé.
 *
 * jsPDF écrit les caractères au-delà de l'ASCII en échappements octaux dans ses littéraux : sans
 * cette lecture, « générale » serait introuvable alors qu'il est bien imprimé. Le décodage suit
 * l'encodage WinAnsi, qui est celui des polices PDF standard.
 */
function texteImprime(octets: Uint8Array): string {
  const brut = new TextDecoder("latin1").decode(octets);
  return brut.replace(/\\([0-7]{1,3})/gu, (_tout, groupe: string) =>
    String.fromCharCode(Number.parseInt(groupe, 8))
  );
}

function texteDeLaFeuille(feuille: Excel.Worksheet): string {
  const morceaux: string[] = [];
  feuille.eachRow({ includeEmpty: false }, (ligne) => {
    ligne.eachCell({ includeEmpty: false }, (cellule) => {
      morceaux.push(String(cellule.value ?? ""));
    });
  });
  return morceaux.join(" | ");
}

describe("Description du document", () => {
  it("retrouve les sections, les paramètres, les colonnes et les totaux", () => {
    const document = documentBalance();
    expect(document.titre).toBe("Balance générale");
    expect(document.sections.length).toBe(1);

    const section = document.sections[0]!;
    expect(section.titre).toBe("Balance générale");
    // Le bloc de paramètres qui précède le tableau n'est pas une section : il monte au niveau du
    // document, et s'imprime dans l'en-tête de la première page.
    expect(section.champs).toEqual([]);
    expect(document.champs).toEqual([
      { libelle: "Édition", valeur: "période 4 · cumulée" },
      { libelle: "Dossier", valeur: "CG000-26" },
      { libelle: "Société", valeur: "BÉNIN NÉGOCE DISTRIBUTION" },
      // Une ligne de trois cellules donne un libellé et une valeur composée.
      { libelle: "Édition", valeur: "période 4 · cumulée" }
    ]);
    expect(section.colonnes.map((item) => item.titre)).toEqual([
      "Compte",
      "Libellé",
      "Classe",
      "Débit",
      "Crédit",
      "Solde",
      "Sens",
      "Date d'ouverture"
    ]);
    expect(section.lignes.length).toBe(3);
    // Les totaux sont écrits après une ligne vide, dans un bloc à part : ils sont rattachés au
    // tableau qu'ils concluent, pas rendus comme une section orpheline.
    expect(section.totaux?.emphase).toBe("total");
    expect(section.totaux?.cellules[3]).toBe(60670000n);
  });

  it("devine le genre et l'alignement d'une colonne d'après ce qu'elle contient", () => {
    const section = documentBalance().sections[0]!;
    const genres = Object.fromEntries(section.colonnes.map((item) => [item.titre, item.genre]));
    expect(genres["Débit"]).toBe("montant");
    expect(genres["Solde"]).toBe("montant");
    expect(genres["Date d'ouverture"]).toBe("date");
    expect(genres["Libellé"]).toBe("texte");

    // Une colonne alignée à droite pour un montant, au centre pour une date : la lecture d'un état
    // comptable passe par là.
    const alignements = Object.fromEntries(section.colonnes.map((item) => [item.titre, item.alignement]));
    expect(alignements["Débit"]).toBe("droite");
    expect(alignements["Date d'ouverture"]).toBe("centre");
    expect(alignements["Libellé"]).toBe("gauche");
  });

  it("nomme une section d'après sa colonne de nature, et sépare plusieurs sections", () => {
    const document = documentDepuisLignes({
      titre: "Lettrage des comptes de tiers",
      tige: "lettrage",
      contexte: "401100-tous",
      champs: [],
      lignes: [
        ["Compte", "401100"],
        [],
        ["Situation", "Compte", "Solde", "Non lettré"],
        ["situation", "401100", 1170000n, 1170000n],
        ["situation", "411100", -2360000n, -2360000n],
        [],
        ["Marques", "Code", "Montant", "Lignes"],
        ["marque", "AA", 1170000n, 2]
      ],
      ...BASE_DOCUMENT
    });

    expect(document.sections.length).toBe(2);
    expect(document.sections[0]!.titre).toBe("Situation");
    expect(document.sections[0]!.lignes.length).toBe(2);
    expect(document.champs).toEqual([{ libelle: "Compte", valeur: "401100" }]);
    expect(document.sections[0]!.champs).toEqual([]);
    expect(document.sections[1]!.titre).toBe("Marques");
    expect(document.sections[1]!.colonnes[0]!.titre).toBe("Marques");
    expect(document.sections[1]!.champs).toEqual([]);
  });

  it("donne deux faces à chaque cellule : le texte français et la valeur exacte", () => {
    const montant = colonne("Débit", "montant");
    const date = colonne("Date", "date");
    const texte = colonne("Sens", "texte");

    // Le texte porte l'espace insécable étroite de formatMontant ; la valeur est un nombre entier.
    expect(texteDeCellule(2360000n, montant)).toMatch(/^2\s360\s000$/u);
    expect(valeurDeCellule(2360000n, montant)).toBe(2360000);
    expect(texteDeCellule(-10000000n, montant)).toMatch(/^-10\s000\s000$/u);
    expect(valeurDeCellule(-10000000n, montant)).toBe(-10000000);

    expect(texteDeCellule("2026-04-30", date)).toBe("30/04/2026");
    expect(valeurDeCellule("2026-04-30", date)).toBe("2026-04-30");

    // Personne ne doit lire la valeur technique du noyau.
    expect(texteDeCellule("debiteur", texte)).toBe("débiteur");
    expect(texteDeCellule("crediteur", texte)).toBe("créditeur");
    expect(valeurDeCellule("debiteur", texte)).toBe("debiteur");

    expect(texteDeCellule(null, montant)).toBe("");
    expect(valeurDeCellule(null, montant)).toBe("");

    // Au-delà de ce qu'un nombre JavaScript représente exactement, la valeur bascule en texte
    // plutôt que de devenir un montant faux.
    const enorme = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
    expect(valeurDeCellule(enorme, montant)).toBe(enorme.toString());
  });

  it("choisit l'orientation d'après la largeur du tableau, pas d'après son titre", () => {
    const etroit = documentBalance();
    expect(orientationPreferree(etroit)).toBe("portrait");
    expect(largeurTotaleEnMm(etroit.sections[0]!.colonnes)).toBeLessThanOrEqual(
      210 - MARGES_PDF_MM.gauche - MARGES_PDF_MM.droite
    );

    const large = documentAvecSections([
      {
        titre: "Grand livre détaillé",
        champs: [] as ChampAExporter[],
        colonnes: Array.from({ length: 14 }, (_inconnu, index) =>
          colonne(`Colonne assez longue ${index + 1}`, "texte", `c${index}`)
        ),
        lignes: [] as LigneAExporter[]
      }
    ]);
    expect(orientationPreferree(large)).toBe("paysage");
  });
});

describe("Rendu Excel", () => {
  it("produit une feuille de calcul lisible dont les montants sont des nombres", async () => {
    const fichier = await rendreExcel(documentBalance());
    expect(fichier.format).toBe("excel");
    expect(fichier.mime).toBe(MIME_EXCEL);
    expect(fichier.nom).toBe("perfectys_balance_2026-periode-4_2026-04-30.xlsx");
    expect(fichier.taille).toBe(fichier.octets.byteLength);
    expect(fichier.taille).toBeGreaterThan(4000);
    // Un XLSX est une archive ZIP : la signature ne trompe pas.
    expect(fichier.octets[0]).toBe(0x50);
    expect(fichier.octets[1]).toBe(0x4b);

    const classeur = new Excel.Workbook();
    await classeur.xlsx.load(fichier.octets as unknown as ArrayBuffer);
    expect(classeur.worksheets.length).toBe(1);

    const feuille = classeur.worksheets[0]!;
    expect(feuille.name).toBe("Balance générale");
    expect(feuille.getCell("A1").value).toBe("Balance générale");
    expect(String(feuille.getCell("A2").value)).toMatch(/mouvements comptabilisés/u);
    expect(String(feuille.getCell("A3").value)).toBe("BÉNIN NÉGOCE DISTRIBUTION");
    expect(String(feuille.getCell("A4").value)).toMatch(/SARL.*0020151234567/u);
    expect(String(feuille.getCell("A7").value)).toMatch(/Exercice 2026.*XOF/u);
    expect(String(feuille.getCell("A8").value)).toMatch(/généré le 30\/04\/2026 à 09:41/u);

    // Le bandeau d'identité occupe les premières lignes, puis les paramètres, puis les titres.
    const entetes = ["Compte", "Libellé", "Classe", "Débit", "Crédit", "Solde", "Sens", "Date d'ouverture"];
    let ligneDEntete = 0;
    for (let numero = 1; numero <= 24; numero += 1) {
      if (feuille.getCell(numero, 1).value === "Compte") {
        ligneDEntete = numero;
        break;
      }
    }
    expect(ligneDEntete).toBeGreaterThan(0);
    entetes.forEach((titre, index) => {
      expect(feuille.getCell(ligneDEntete, index + 1).value).toBe(titre);
    });

    // Les montants sont des nombres, pas du texte formaté : c'est tout l'intérêt d'un export Excel.
    const premiereDonnee = ligneDEntete + 1;
    const debit = feuille.getCell(premiereDonnee, 4);
    expect(typeof debit.value).toBe("number");
    expect(debit.value).toBe(1170000);
    // Le franc CFA n'a pas de centimes : aucun format ne doit en inventer.
    expect(debit.numFmt).toBe("#,##0");
    expect(feuille.getCell(premiereDonnee, 6).value).toBe(-10000000);
    // Une date reste une date ISO : aucun lecteur ne devine un format de date.
    expect(feuille.getCell(premiereDonnee, 8).value).toBe("2026-01-01");

    // Les totaux sont en gras, après les données.
    const ligneTotaux = premiereDonnee + 3;
    expect(feuille.getCell(ligneTotaux, 1).value).toBe("Totaux");
    expect(feuille.getCell(ligneTotaux, 4).value).toBe(60670000);
    expect((feuille.getCell(ligneTotaux, 4).font as { bold?: boolean }).bold).toBe(true);

    // Volet figé sous les titres, filtre automatique, mise en page A4.
    expect((feuille.views[0] as { ySplit?: number }).ySplit).toBe(ligneDEntete);
    expect(feuille.autoFilter).toBeTruthy();
    expect((feuille.pageSetup as { paperSize?: number }).paperSize).toBe(9);
    expect(texteDeLaFeuille(feuille)).toMatch(/perfectys_balance_2026-periode-4|SYSCOHADA/u);
  });

  it("donne un onglet par section, avec un nom qui respecte les limites d'Excel", async () => {
    const document = documentDepuisLignes({
      titre: "Interrogation de compte",
      tige: "interrogation",
      contexte: "521100",
      champs: [],
      titresDeSection: ["Mouvements, avec le solde après chaque ligne : un intitulé très long", "Historique"],
      lignes: [
        [],
        ["Date", "Pièce", "Débit", "Crédit", "Solde"],
        ["2026-01-01", "AN0001", 55000000n, 0n, 55000000n],
        [],
        ["Exercice", "Solde reporté", "État"],
        [2026, 55000000n, "en cours"]
      ],
      ...BASE_DOCUMENT
    });

    const fichier = await rendreExcel(document);
    const classeur = new Excel.Workbook();
    await classeur.xlsx.load(fichier.octets as unknown as ArrayBuffer);
    expect(classeur.worksheets.length).toBe(2);
    // 31 caractères au plus, sans les caractères interdits : Excel refuse sinon d'ouvrir le fichier.
    expect(classeur.worksheets[0]!.name.length).toBeLessThanOrEqual(31);
    expect(classeur.worksheets[1]!.name).toBe("Historique");
    expect(nomDOnglet("Grand livre : 401/411 [détail]")).toBe("Grand livre - 401-411 -détail-");
  });

  it("dit qu'un document est vide au lieu de produire une feuille blanche", async () => {
    const fichier = await rendreExcel(
      documentAvecSections([{ titre: "Grand livre", champs: [], colonnes: [], lignes: [] }])
    );
    const classeur = new Excel.Workbook();
    await classeur.xlsx.load(fichier.octets as unknown as ArrayBuffer);
    expect(texteDeLaFeuille(classeur.worksheets[0]!)).toMatch(/Néant/u);
  });
});

describe("Rendu PDF", () => {
  it("produit un PDF paginé, portant l'identité de la société et le titre du document", async () => {
    // Compression désactivée : le texte imprimé reste vérifiable octet par octet.
    const fichier = await rendrePdf(documentBalance(), { compression: false });
    expect(fichier.format).toBe("pdf");
    expect(fichier.mime).toBe(MIME_PDF);
    expect(fichier.nom).toBe("perfectys_balance_2026-periode-4_2026-04-30.pdf");
    expect(fichier.taille).toBeGreaterThan(3000);
    expect(fichier.taille).toBe(fichier.octets.byteLength);

    const brut = new TextDecoder("latin1").decode(fichier.octets);
    expect(brut.startsWith("%PDF-1.")).toBe(true);
    expect((brut.match(/\/Type\s*\/Page[^s]/gu) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(brut).toMatch(/\/MediaBox/u);

    // L'identité, le titre, les paramètres de l'édition et la numérotation des pages.
    const imprime = texteImprime(fichier.octets);
    expect(imprime).toContain("BÉNIN NÉGOCE DISTRIBUTION");
    expect(imprime).toContain("Balance générale");
    expect(imprime).toContain("SARL · IFU 0020151234567");
    expect(imprime).toContain("Dossier :");
    expect(imprime).toContain("CG000-26");
    expect(imprime).toContain("Page 1/1");
    expect(imprime).toContain("perfectys_balance");
  });

  it("imprime les montants en français et les sens en toutes lettres", async () => {
    const fichier = await rendrePdf(documentBalance(), { compression: false });
    const imprime = texteImprime(fichier.octets);
    // L'espace insécable étroite de formatMontant devient une espace simple : sinon le montant
    // disparaîtrait du texte imprimé sans aucun avertissement.
    expect(imprime).toContain("1 170 000");
    expect(imprime).toContain("-10 000 000");
    expect(imprime).not.toContain("\u202F");
    // La valeur technique du noyau n'est jamais imprimée telle quelle.
    expect(imprime).toContain("créditeur");
    expect(imprime).not.toContain("debiteur");
    expect(imprime).not.toContain("crediteur");
    // Les dates passent au format français.
    expect(imprime).toContain("01/01/2026");
    // La mention finale est imprimée.
    expect(imprime).toContain("SYSCOHADA");
  });

  it("normalise les caractères que les polices PDF standard feraient disparaître", () => {
    expect(nettoyerPourPdf("2\u202F360\u202F000")).toBe("2 360 000");
    expect(nettoyerPourPdf("total — 5\u20AC")).toBe("total - 5EUR");
    expect(nettoyerPourPdf("Œuvre")).toBe("OEuvre");
    expect(nettoyerPourPdf("…")).toBe("...");
    expect(nettoyerPourPdf("a\u00A0b")).toBe("a b");
    // Les accents français sont en latin1 : ils doivent rester.
    expect(nettoyerPourPdf("clôture d'exercice « définitive »")).toBe("clôture d'exercice « définitive »");
    // Un caractère hors latin1 est supprimé plutôt que perdu en silence.
    expect(nettoyerPourPdf("solde ✓")).toBe("solde ");
  });

  it("passe en paysage quand le tableau ne tient pas en portrait", async () => {
    const document = documentAvecSections([
      {
        titre: "Grand livre détaillé",
        champs: [],
        colonnes: Array.from({ length: 14 }, (_inconnu, index) =>
          colonne(`Colonne assez longue ${index + 1}`, "texte", `c${index}`)
        ),
        lignes: [
          { cellules: Array.from({ length: 14 }, (_inconnu, index) => `valeur ${index + 1}`) }
        ]
      }
    ]);
    expect(orientationPreferree(document)).toBe("paysage");
    const fichier = await rendrePdf(document, { compression: false });
    const brut = new TextDecoder("latin1").decode(fichier.octets);
    // A4 paysage : 841,89 x 595,28 points.
    expect(new TextDecoder("latin1").decode(fichier.octets)).toMatch(/\/MediaBox \[0 0 841[\d.]* 595[\d.]*\]/u);
  });
});

describe("Noms de fichier et mentions", () => {
  it("construit un nom de fichier qui survit à un système de fichiers", () => {
    expect(nomDeFichier("xlsx", "declaration-tva", "2026-04", "2026-04-30")).toBe(
      "perfectys_declaration-tva_2026-04_2026-04-30.xlsx"
    );
    expect(nomDeFichier("pdf", "Compte et historique", "401100-FOU01", "2026-04-30")).toBe(
      "perfectys_compte-et-historique_401100-fou01_2026-04-30.pdf"
    );
  });

  it("compose l'horodatage français de la génération", () => {
    expect(horodatageFr("2026-04-30T09:41:00.000Z")).toBe("30/04/2026 à 09:41");
    expect(horodatageFr("pas-une-date")).toBe("pas-une-date");
  });
});
