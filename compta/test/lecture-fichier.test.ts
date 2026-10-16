/**
 * La lecture des fichiers de relevé binaires : classeur Excel et PDF.
 *
 * Ce qui est vérifié, en faisant vraiment le trajet : un classeur écrit par exceljs est relu, une
 * page écrite par jsPDF est relue, et dans les deux cas le lecteur du noyau retrouve les dates, les
 * références, les montants et le solde. Sont vérifiés aussi les cas qui doivent refuser net — un
 * fichier qui n'est pas un classeur, un PDF sans texte (un relevé scanné), une colonne introuvable —
 * parce qu'un montant deviné vaut moins qu'un import refusé.
 */

import { beforeEach, describe, expect, it } from "vitest";
import Excel from "exceljs";
import { jsPDF } from "jspdf";
import {
  BENIN,
  champsALaForme,
  grilleDepuisTexteDePdf,
  lireReleve,
  lireReleveDepuisGrille,
  type DateCivile,
  type LigneDeGrille,
  type ServiceComptable,
  type TextePositionne
} from "../src/noyau/index";
import { estFichierBinaire, formatDeFichier, lireFichierDeReleve } from "../src/web/lecture-fichier";
import { nouveauService, xof } from "./aide";

const devise = BENIN.devise;

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

/* ------------------------------------------------------------------ */
/* Classeur Excel                                                      */
/* ------------------------------------------------------------------ */

/** Un relevé tel qu'une banque l'exporte en Excel : de vraies dates, de vrais nombres. */
async function classeurDeReleve(options?: {
  deuxColonnes?: boolean;
  montantsEnTexte?: boolean;
  feuilles?: number;
}): Promise<ArrayBuffer> {
  const classeur = new Excel.Workbook();
  if ((options?.feuilles ?? 1) > 1) {
    // Une feuille de garde, comme en produisent les exports bancaires : elle n'a ni date ni montant.
    classeur.addWorksheet("Notice").getCell("A1").value = "Relevé édité le 30/04/2026";
  }
  const feuille = classeur.addWorksheet("Relevé");
  feuille.getCell("A1").value = "BOA BÉNIN — RELEVÉ DE COMPTE 521100";
  if (options?.deuxColonnes) {
    feuille.getCell("A3").value = "Date";
    feuille.getCell("B3").value = "Libellé";
    feuille.getCell("C3").value = "Débit";
    feuille.getCell("D3").value = "Crédit";
  } else {
    feuille.getCell("A3").value = "Date opération";
    feuille.getCell("B3").value = "Référence";
    feuille.getCell("C3").value = "Libellé";
    feuille.getCell("D3").value = "Montant";
    feuille.getCell("E3").value = "Solde";
  }

  const operations: { date: Date; reference: string; libelle: string; montant: number; solde: number }[] = [
    { date: new Date(2026, 3, 2), reference: "RG-2026-004", libelle: "VIREMENT EMIS FRS PORT AUTONOME", montant: -1170000, solde: 53830000 },
    { date: new Date(2026, 3, 5), reference: "CHQ-100234", libelle: "REMISE CHEQUE CLIENT SOGEMA", montant: 2500000, solde: 56330000 },
    { date: new Date(2026, 3, 10), reference: "FRAIS-04", libelle: "FRAIS DE TENUE DE COMPTE", montant: -15000, solde: 56315000 }
  ];

  let rang = 4;
  for (const operation of operations) {
    feuille.getCell(`A${rang}`).value = operation.date;
    if (options?.deuxColonnes) {
      feuille.getCell(`B${rang}`).value = operation.libelle;
      feuille.getCell(`C${rang}`).value = operation.montant < 0 ? -operation.montant : null;
      feuille.getCell(`D${rang}`).value = operation.montant > 0 ? operation.montant : null;
    } else {
      feuille.getCell(`B${rang}`).value = operation.reference;
      feuille.getCell(`C${rang}`).value = operation.libelle;
      feuille.getCell(`D${rang}`).value = options?.montantsEnTexte
        ? operation.montant.toLocaleString("fr-FR").replace(/\u202f|\u00a0/gu, " ")
        : operation.montant;
      feuille.getCell(`E${rang}`).value = options?.montantsEnTexte
        ? operation.solde.toLocaleString("fr-FR").replace(/\u202f|\u00a0/gu, " ")
        : operation.solde;
    }
    rang += 1;
  }
  feuille.getCell(`C${rang}`).value = "Total des opérations";
  feuille.getCell(`D${rang}`).value = 1315000;

  return classeur.xlsx.writeBuffer();
}

describe("un relevé en classeur Excel", () => {
  it("relit de vraies dates et de vrais nombres, et reconnaît les colonnes nommées", async () => {
    const octets = await classeurDeReleve();
    const fichier = await lireFichierDeReleve("boa-2026-04.xlsx", octets);

    expect(fichier.format).toBe("xlsx");
    expect(fichier.notes.join(" ")).toMatch(/Feuille lue : « Relevé »/);

    const lu = lireReleveDepuisGrille(fichier.grille, {
      devise,
      format: "xlsx",
      nomFichier: "boa-2026-04.xlsx",
      notes: fichier.notes
    });

    expect(lu.lignes).toHaveLength(3);
    expect(lu.lignes.map((ligne) => ligne.date)).toEqual([
      "2026-04-02" as DateCivile,
      "2026-04-05" as DateCivile,
      "2026-04-10" as DateCivile
    ]);
    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    expect(lu.lignes[1]!.libelle).toBe("REMISE CHEQUE CLIENT SOGEMA");
    // Le solde d'ouverture se déduit du premier solde porté, moins l'opération qu'il suit.
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    expect(lu.soldeDeFin).toBe(xof("56315000"));
    expect(lu.dateDebut).toBe("2026-04-02" as DateCivile);
    expect(lu.dateFin).toBe("2026-04-10" as DateCivile);
    // La ligne de total n'est pas une opération : écartée et annoncée.
    expect(lu.avertissements.join(" ")).toMatch(/Total des opérations/i);
  });

  it("relit deux colonnes débit et crédit, et prend la feuille qui ressemble à un relevé", async () => {
    const octets = await classeurDeReleve({ deuxColonnes: true, feuilles: 2 });
    const fichier = await lireFichierDeReleve("boa.xlsx", octets);
    const lu = lireReleveDepuisGrille(fichier.grille, { devise, format: "xlsx", notes: fichier.notes });

    expect(fichier.notes.join(" ")).toMatch(/2 feuilles/);
    expect(lu.lignes).toHaveLength(3);
    // Une sortie portée en débit devient un montant négatif au sens de la banque.
    expect(lu.lignes[0]!.montant).toBe(-xof("1170000"));
    expect(lu.lignes[1]!.montant).toBe(xof("2500000"));
    expect(lu.lignes[2]!.montant).toBe(-xof("15000"));
  });

  it("relit des montants écrits en texte, espaces de milliers et décimale virgule compris", async () => {
    const octets = await classeurDeReleve({ montantsEnTexte: true });
    const fichier = await lireFichierDeReleve("boa.xlsx", octets);
    const lu = lireReleveDepuisGrille(fichier.grille, { devise, format: "xlsx", notes: fichier.notes });

    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
  });

  it("refuse un fichier qui n'est pas un classeur, en le disant", async () => {
    const pasUnClasseur = new TextEncoder().encode("Date;Montant\n02/04/2026;-1170000\n").buffer;
    await expect(lireFichierDeReleve("releve.xlsx", pasUnClasseur)).rejects.toThrow(
      /pas pu être ouvert comme un classeur Excel/i
    );
  });

  it("refuse un classeur dont la feuille est vide", async () => {
    const classeur = new Excel.Workbook();
    classeur.addWorksheet("Vide");
    const octets = await classeur.xlsx.writeBuffer();
    await expect(lireFichierDeReleve("vide.xlsx", octets)).rejects.toThrow(
      /La feuille « Vide » est vide : aucune cellule à lire/i
    );
  });
});

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Un relevé imprimé cellule par cellule, comme le fait un état bancaire : chaque champ a son abscisse,
 * les montants sont alignés à droite, et l'ordre du flux de contenu n'est pas celui de la lecture.
 * Le texte est écrit sans accent parce que jsPDF découpe les mots dès qu'un caractère sort de son
 * encodage — les accents, eux, sont couverts par les tests de remise en grille ci-dessous.
 */
function documentDeReleve(options?: { uneSeuleLigne?: boolean; sansTexte?: boolean }): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  if (options?.sansTexte) {
    // Un relevé scanné : une image, aucun texte.
    doc.setDrawColor(180);
    doc.rect(40, 40, 500, 700);
    return doc.output("arraybuffer");
  }
  const entetes = ["Date", "Reference", "Libelle", "Montant", "Solde"];
  const gauches = [40, 110, 200, 400, 480];
  const operations = [
    ["02/04/2026", "RG-2026-004", "VIREMENT EMIS FRS PORT", "-1 170 000", "53 830 000"],
    ["05/04/2026", "CHQ-100234", "REMISE CHEQUE SOGEMA", "2 500 000", "56 330 000"],
    ["10/04/2026", "FRAIS-04", "FRAIS DE TENUE DE COMPTE", "-15 000", "56 315 000"]
  ];

  doc.setFont("helvetica", "bold");
  doc.text("BOA BENIN - RELEVE DE COMPTE 521100", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.text("Page 1/1", 40, 780);
  if (options?.uneSeuleLigne) {
    // Une ligne d'un bloc par opération : aucun repère de colonne à trouver.
    operations.forEach((operation, index) => {
      doc.text(operation.join(" "), 40, 100 + index * 16);
    });
    return doc.output("arraybuffer");
  }

  // Les droites des colonnes de nombres sont celles de leur en-tête : c'est là que le montant borde.
  const droites = gauches.map((gauche, index) => gauche + doc.getTextWidth(entetes[index]!));
  entetes.forEach((entete, index) => {
    doc.text(entete, gauches[index]!, 80);
  });
  for (let colonne = 0; colonne < entetes.length; colonne += 1) {
    operations.forEach((operation, rang) => {
      const cellule = operation[colonne]!;
      const x = colonne >= 3 ? droites[colonne]! - doc.getTextWidth(cellule) : gauches[colonne]!;
      doc.text(cellule, x, 100 + rang * 16);
    });
  }
  return doc.output("arraybuffer");
}

describe("un relevé en PDF", () => {
  it("relit un relevé imprimé en colonnes, montants alignés à droite compris", async () => {
    const fichier = await lireFichierDeReleve("boa-2026-04.pdf", documentDeReleve());

    expect(fichier.format).toBe("pdf");
    expect(fichier.notes.join(" ")).toMatch(/Document lu : 1 page/);
    expect(fichier.notes.join(" ")).toMatch(/mise en page du PDF/);

    const lu = lireReleveDepuisGrille(fichier.grille, {
      devise,
      format: "pdf",
      nomFichier: "boa-2026-04.pdf",
      notes: fichier.notes
    });

    expect(lu.lignes).toHaveLength(3);
    expect(lu.lignes.map((ligne) => ligne.date)).toEqual([
      "2026-04-02" as DateCivile,
      "2026-04-05" as DateCivile,
      "2026-04-10" as DateCivile
    ]);
    expect(lu.lignes.map((ligne) => ligne.montant)).toEqual([
      -xof("1170000"),
      xof("2500000"),
      -xof("15000")
    ]);
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    expect(lu.lignes[2]!.libelle).toBe("FRAIS DE TENUE DE COMPTE");
    expect(lu.lignes.map((ligne) => ligne.solde)).toEqual([
      xof("53830000"),
      xof("56330000"),
      xof("56315000")
    ]);
    expect(lu.soldeDOuverture).toBe(xof("55000000"));
    // Le titre et le numéro de page ne sont pas des opérations.
    expect(lu.avertissements.join(" ")).toMatch(/écartée/i);
  });

  it("relit un PDF qui ne pose qu'une ligne de texte par opération, en reconnaissant les champs à leur forme", async () => {
    const fichier = await lireFichierDeReleve("boa.pdf", documentDeReleve({ uneSeuleLigne: true }));
    const lu = lireReleveDepuisGrille(fichier.grille, { devise, format: "pdf", notes: fichier.notes });

    expect(fichier.notes.join(" ")).toMatch(/reconnus à leur forme/i);
    expect(lu.lignes).toHaveLength(3);
    expect(lu.lignes[0]!.date).toBe("2026-04-02" as DateCivile);
    expect(lu.lignes[0]!.reference).toBe("RG-2026-004");
    expect(lu.lignes[0]!.libelle).toBe("VIREMENT EMIS FRS PORT");
    expect(lu.lignes[0]!.montant).toBe(-xof("1170000"));
    expect(lu.lignes[0]!.solde).toBe(xof("53830000"));
    expect(lu.lignes[2]!.montant).toBe(-xof("15000"));
  });

  it("refuse un PDF sans texte : un relevé scanné ne se devine pas", async () => {
    await expect(lireFichierDeReleve("scan.pdf", documentDeReleve({ sansTexte: true }))).rejects.toThrow(
      /relevé scanné/i
    );
  });

  it("refuse un fichier qui n'est pas un PDF", async () => {
    const pasUnPdf = new TextEncoder().encode("Date;Montant\n02/04/2026;-1170000\n").buffer;
    await expect(lireFichierDeReleve("releve.pdf", pasUnPdf)).rejects.toThrow(/pas pu être ouvert comme un PDF/i);
  });
});

/* ------------------------------------------------------------------ */
/* La remise en grille, seule                                          */
/* ------------------------------------------------------------------ */

describe("la remise en grille d'un texte positionné", () => {
  const morceau = (
    page: number,
    x: number,
    y: number,
    texte: string,
    largeur = texte.length * 5
  ): TextePositionne => ({ page, texte, x, y, largeur });

  it("range les montants alignés à droite dans leur colonne, par leur bord droit", () => {
    const elements = [
      morceau(1, 40, 80, "Date"),
      morceau(1, 120, 80, "Libelle"),
      morceau(1, 400, 80, "Montant"),
      // Deux montants de longueurs différentes, même bord droit : une seule colonne.
      morceau(1, 40, 100, "02/04/2026"),
      morceau(1, 120, 100, "VIREMENT EMIS"),
      morceau(1, 385, 100, "-1 170 000"),
      morceau(1, 40, 116, "05/04/2026"),
      morceau(1, 120, 116, "REMISE CHEQUE"),
      morceau(1, 390, 116, "2 500 000", 45)
    ];
    const grille = grilleDepuisTexteDePdf(elements);
    const operations = grille.lignes.filter((ligne) => ligne.cellules.some((cellule) => cellule.includes("2026")));

    expect(operations).toHaveLength(2);
    expect(operations[0]!.cellules.filter((cellule) => cellule !== "")).toEqual([
      "02/04/2026",
      "VIREMENT EMIS",
      "-1 170 000"
    ]);
    expect(operations[1]!.cellules.filter((cellule) => cellule !== "")).toEqual([
      "05/04/2026",
      "REMISE CHEQUE",
      "2 500 000"
    ]);
  });

  it("nomme les colonnes d'après leur contenu quand la page n'a pas d'en-tête", () => {
    const elements = [
      morceau(1, 40, 100, "02/04/2026"),
      morceau(1, 120, 100, "RG-2026-004"),
      morceau(1, 220, 100, "VIREMENT EMIS FRS"),
      morceau(1, 400, 100, "-1 170 000"),
      morceau(1, 40, 116, "05/04/2026"),
      morceau(1, 120, 116, "CHQ-100234"),
      morceau(1, 220, 116, "REMISE CHEQUE"),
      morceau(1, 400, 116, "2 500 000")
    ];
    const grille = grilleDepuisTexteDePdf(elements);

    expect(grille.lignes[0]!.cellules).toEqual(["Date opération", "Référence", "Libellé", "Montant"]);
    expect(grille.notes.join(" ")).toMatch(/nommées d'après leur contenu/i);
  });

  it("reconnaît l'en-tête de la page et le rend tel quel", () => {
    const elements = [
      morceau(1, 40, 80, "Date"),
      morceau(1, 120, 80, "Reference"),
      morceau(1, 220, 80, "Libelle"),
      morceau(1, 400, 80, "Montant"),
      morceau(1, 40, 100, "02/04/2026"),
      morceau(1, 120, 100, "RG-2026-004"),
      morceau(1, 220, 100, "VIREMENT EMIS"),
      morceau(1, 400, 100, "-1 170 000")
    ];
    const grille = grilleDepuisTexteDePdf(elements);

    expect(grille.lignes[0]!.cellules).toEqual(["Date", "Reference", "Libelle", "Montant"]);
    expect(grille.notes.join(" ")).toMatch(/en-tête de la page reconnu/i);
  });

  it("étale plusieurs pages dans une seule grille", () => {
    const elements = [
      morceau(1, 40, 100, "02/04/2026"),
      morceau(1, 200, 100, "VIREMENT"),
      morceau(1, 400, 100, "-1 170 000"),
      morceau(2, 40, 100, "05/04/2026"),
      morceau(2, 200, 100, "REMISE"),
      morceau(2, 400, 100, "2 500 000")
    ];
    const grille = grilleDepuisTexteDePdf(elements);
    const lu = lireReleveDepuisGrille(grille.lignes, { devise, format: "pdf", notes: grille.notes });

    expect(lu.lignes).toHaveLength(2);
    expect(lu.lignes[1]!.date).toBe("2026-04-05" as DateCivile);
  });

  it("refuse un document sans aucun texte", () => {
    expect(() => grilleDepuisTexteDePdf([])).toThrow(/relevé scanné/i);
    expect(() => grilleDepuisTexteDePdf([morceau(1, 40, 40, "   ")])).toThrow(/relevé scanné/i);
  });

  it("écarte un titre et un pied de page, qui ne portent ni date ni montant", () => {
    const elements = [
      morceau(1, 40, 40, "BOA BENIN — RELEVE DE COMPTE"),
      morceau(1, 40, 100, "02/04/2026"),
      morceau(1, 200, 100, "VIREMENT EMIS"),
      morceau(1, 400, 100, "-1 170 000"),
      morceau(1, 40, 780, "Page 1/1")
    ];
    const grille = grilleDepuisTexteDePdf(elements);
    const lu = lireReleveDepuisGrille(grille.lignes, { devise, format: "pdf", notes: grille.notes });

    expect(lu.lignes).toHaveLength(1);
    expect(lu.lignes[0]!.montant).toBe(-xof("1170000"));
  });
});

describe("la reconnaissance des champs à leur forme", () => {
  it("trie une ligne de texte en date, référence, libellé, montant et solde", () => {
    expect(champsALaForme("02/04/2026 VIREMENT EMIS FRS PORT AUTONOME RG-2026-004 -1 170 000 53 830 000")).toEqual([
      "02/04/2026",
      "RG-2026-004",
      "VIREMENT EMIS FRS PORT AUTONOME",
      "-1 170 000",
      "53 830 000"
    ]);
    // Un seul nombre : c'est le montant, pas de solde.
    expect(champsALaForme("05/04/2026 CHQ-100234 REMISE CHEQUE 2 500 000")?.[3]).toBe("2 500 000");
    expect(champsALaForme("05/04/2026 CHQ-100234 REMISE CHEQUE 2 500 000")?.[4]).toBe("");
  });

  it("rend null sur ce qui n'est pas une opération", () => {
    expect(champsALaForme("BOA BENIN — RELEVÉ DE COMPTE")).toBeNull();
    expect(champsALaForme("Page 1/1")).toBeNull();
    expect(champsALaForme("Total des opérations 1 315 000")).toBeNull();
    expect(champsALaForme("")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Le service, depuis une grille                                       */
/* ------------------------------------------------------------------ */

describe("l'import d'une grille par le service", () => {
  it("crée un relevé dont la provenance dit le classeur", async () => {
    const fichier = await lireFichierDeReleve("boa-2026-04.xlsx", await classeurDeReleve());
    const resultat = await service.importerReleve({
      compte: "521100",
      grille: fichier.grille,
      notes: fichier.notes,
      format: "xlsx",
      nomFichier: "boa-2026-04.xlsx"
    });

    expect(resultat.releve.lignes).toHaveLength(3);
    expect(resultat.releve.soldeDOuverture).toBe(xof("55000000"));
    expect(resultat.releve.source?.format).toBe("xlsx");
    expect(resultat.releve.source?.nomFichier).toBe("boa-2026-04.xlsx");

    const audit = await service.pisteAudit();
    const trace = audit.find((evenement) => evenement.entiteIdentifiant === resultat.releve.id);
    expect(trace?.action).toBe("Relevé importé");
    expect(trace?.detail).toMatch(/xlsx/i);
  });

  it("écarte les opérations déjà importées, quel que soit le contenant du fichier", async () => {
    const octets = await classeurDeReleve();
    await service.importerReleve({
      compte: "521100",
      grille: (await lireFichierDeReleve("boa.xlsx", octets)).grille,
      format: "xlsx",
      nomFichier: "boa.xlsx"
    });
    // Le même relevé, cette fois en PDF : les opérations sont les mêmes, elles ne repassent pas.
    const pdf = await lireFichierDeReleve("boa.pdf", documentDeReleve());
    await expect(
      service.importerReleve({ compte: "521100", grille: pdf.grille, format: "pdf", nomFichier: "boa.pdf" })
    ).rejects.toThrow(/figurent déjà dans un relevé du compte 521100/i);
  });

  it("refuse un contenu donné à la fois en texte et en grille, ou en aucun des deux", async () => {
    const grille: LigneDeGrille[] = [{ numero: 1, cellules: ["Date", "Montant"] }];
    await expect(
      service.importerReleve({ compte: "521100", texte: "a", grille })
    ).rejects.toThrow(/à la fois en texte et en grille/i);
    await expect(service.importerReleve({ compte: "521100" })).rejects.toThrow(/Aucun contenu de relevé/i);
  });

  it("refuse de lire un format binaire donné comme du texte collé", () => {
    expect(() => lireReleve("Date;Montant\n02/04/2026;-1000\n", { devise, format: "xlsx" })).toThrow(
      /fichier binaire/i
    );
    expect(() => lireReleve("%PDF-1.4 ...", { devise })).toThrow(/document PDF/i);
  });
});

describe("l'annonce du format d'après le nom du fichier", () => {
  it("reconnaît les contenants binaires et laisse les autres à la détection par le contenu", () => {
    expect(formatDeFichier("releve.xlsx")).toBe("xlsx");
    expect(formatDeFichier("RELEVE.XLSM")).toBe("xlsx");
    expect(formatDeFichier("releve.pdf")).toBe("pdf");
    expect(formatDeFichier("releve.csv")).toBeNull();
    expect(formatDeFichier("releve.ofx")).toBeNull();
    expect(estFichierBinaire("releve.pdf")).toBe(true);
    expect(estFichierBinaire("releve.csv")).toBe(false);
  });

  it("refuse un fichier texte passé par le lecteur binaire", async () => {
    const texte = new TextEncoder().encode("a").buffer;
    await expect(lireFichierDeReleve("releve.csv", texte)).rejects.toThrow(/ni un classeur Excel/i);
  });
});
