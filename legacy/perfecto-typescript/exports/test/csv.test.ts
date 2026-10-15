import { describe, expect, it } from "vitest";
import type { ExportDocument } from "@perfecto/contracts";
import { renderCsv } from "../src/csv";
import { EMPTY_DOCUMENT_LABEL } from "../src/text";
import { SOCIETY, balanceDocument, emptyDocument, wideDocument } from "./fixtures";

function decode(file: { bytes: Uint8Array }): string {
  return new TextDecoder().decode(file.bytes);
}

function lines(file: { bytes: Uint8Array }): string[] {
  return decode(file).split("\r\n");
}

describe("rendu CSV", () => {
  it("produit un fichier UTF-8 BOM, CRLF, séparé par des points-virgules", () => {
    const file = renderCsv(balanceDocument());

    expect(file.format).toBe("csv");
    expect(file.mimeType).toBe("text/csv;charset=utf-8");
    expect(file.fileName).toBe("PERFECTO_trial-balance_2026-03-01.csv");
    expect(file.sizeBytes).toBe(file.bytes.byteLength);

    // Sans BOM, Excel affiche « NÃ©goce » au lieu de « Négoce ».
    expect(file.bytes[0]).toBe(0xef);
    expect(file.bytes[1]).toBe(0xbb);
    expect(file.bytes[2]).toBe(0xbf);

    const raw = new TextDecoder("latin1").decode(file.bytes);
    expect(raw.includes("\n")).toBe(true);
    // Chaque fin de ligne est CRLF : aucun « \n » orphelin.
    expect(raw.replace(/\r\n/g, "").includes("\n")).toBe(false);
    expect(decode(file)).toContain("Balance générale;".slice(0, 0) + "Compte;Intitulé");
  });

  it("ouvre le fichier par l'identité de la société et les paramètres de l'édition", () => {
    const rows = lines(renderCsv(balanceDocument()));

    expect(rows[0]).toBe("Balance générale");
    expect(rows[1]).toBe("Arrêtée au 28/02/2026");
    expect(rows[2]).toBe("PERFECTO Négoce Abidjan (SARL)");
    expect(rows[3]).toBe("IFU : CI-2024-B-1187");
    expect(rows).toContain("Abidjan, Côte d'Ivoire");
    expect(rows).toContain("Exercice 2026 · montants en XOF");
    expect(rows.some((line) => line.startsWith("Document généré le ") && line.endsWith("par superviseur"))).toBe(
      true
    );
    // Les paramètres suivent, en « libellé;valeur ».
    expect(rows).toContain("Période;Du 01/01/2026 au 28/02/2026");
    expect(rows).toContain("Équilibre;Débit = crédit");
    expect(rows).toContain(`${SOCIETY.email}`);
  });

  it("écrit les montants en convention française et les dates en ISO", () => {
    const text = decode(renderCsv(wideDocument()));

    // Montant : virgule décimale, pas de séparateur de milliers (un tableur le relit).
    expect(text).toContain("1180000,00");
    expect(text).toContain("472000,00");
    expect(text).not.toContain("1 180 000;");
    // Date : la valeur ISO l'emporte sur le texte affiché.
    expect(text).toContain("2026-01-12;ACH;ACH-2026-0001");
    // Montant négatif : le signe précède, sans espace.
    expect(text).toContain("-472000,00");
  });

  it("termine par les totaux et la mention de bas de page", () => {
    const rows = lines(renderCsv(balanceDocument())).filter((line) => line.length > 0);
    const totals = rows[rows.length - 2]!;
    const footer = rows[rows.length - 1]!;

    expect(totals.startsWith("Totaux;;2832000,00;2832000,00")).toBe(true);
    expect(footer).toContain("La balance est équilibrée");
    expect(footer).toContain("IFU CI-2024-B-1187");
  });

  it("écrit explicitement l'absence de donnée", () => {
    const rows = lines(renderCsv(emptyDocument()));

    expect(rows).toContain("Date;N° pièce;Débit;Crédit");
    expect(rows).toContain(EMPTY_DOCUMENT_LABEL);
    expect(rows.filter((line) => line.startsWith("Néant"))).toHaveLength(1);
  });

  it("protège les valeurs qui casseraient la lecture en colonnes", () => {
    const document: ExportDocument = {
      ...balanceDocument(),
      rows: [
        {
          cells: [
            { text: 'Compte;piège' },
            { text: 'Fournisseur "Sud" & Co' },
            { text: "Retour\r\nà la ligne" },
            { text: "" },
            { text: "0", value: 0 },
            { text: "0", value: 0 }
          ]
        }
      ]
    };
    const rows = lines(renderCsv(document));
    const data = rows.find((line) => line.includes("piège"))!;

    // Champs entourés de guillemets, guillemets internes doublés, séparateurs neutralisés.
    expect(data.startsWith('"Compte;piège";')).toBe(true);
    expect(data).toContain('"Fournisseur ""Sud"" & Co"');
    // Le retour à la ligne est dans le champ : la ligne CSV reste unique une fois reliée.
    expect(data).toContain('"Retour');
    expect(data.split(";").length).toBeGreaterThan(3);
  });

  it("n'invente aucune colonne : une cellule manquante reste vide", () => {
    const document: ExportDocument = {
      ...balanceDocument(),
      rows: [{ cells: [{ text: "401100" }, { text: "Fournisseurs" }] }]
    };
    const data = lines(renderCsv(document)).find((line) => line.startsWith("401100;"))!;

    expect(data).toBe("401100;Fournisseurs;;;;");
  });
});
