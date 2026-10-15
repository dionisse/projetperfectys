import { describe, expect, it } from "vitest";
import { renderExcel } from "../src/excel";
import { EMPTY_DOCUMENT_LABEL, toSheetName } from "../src/text";
import { balanceDocument, emptyDocument, longDocument, wideDocument } from "./fixtures";

type ExcelNamespace = typeof import("exceljs");
type Workbook = InstanceType<ExcelNamespace["Workbook"]>;
type Worksheet = ReturnType<Workbook["addWorksheet"]>;

/**
 * `exceljs` déclare sa propre interface globale `Buffer`, incompatible avec celle de
 * `@types/node` : le chargement d'octets passe par un helper explicitement typé.
 */
async function loadWorkbook(bytes: Uint8Array): Promise<Workbook> {
  const loaded = (await import("exceljs")) as ExcelNamespace & { default?: ExcelNamespace };
  const Excel = loaded.Workbook ? loaded : (loaded.default as ExcelNamespace);
  const workbook = new Excel.Workbook();
  const load = workbook.xlsx.load.bind(workbook.xlsx) as unknown as (
    data: ArrayBuffer | Uint8Array
  ) => Promise<void>;
  await load(bytes);
  return workbook;
}

function firstSheet(workbook: Workbook): Worksheet {
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Aucune feuille dans le classeur produit.");
  return sheet;
}

/** Ligne de titres du tableau : celle dont la première cellule est le premier intitulé. */
function findHeaderRow(sheet: Worksheet, firstLabel: string): number {
  for (let index = 1; index <= sheet.rowCount; index += 1) {
    if (sheet.getRow(index).getCell(1).value === firstLabel) return index;
  }
  throw new Error(`Ligne de titres « ${firstLabel} » introuvable.`);
}

function argb(cell: { fill?: unknown }): string | undefined {
  const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
  return fill?.fgColor?.argb;
}

describe("rendu Excel", () => {
  it("produit un classeur .xlsx rechargeable, nommé d'après le document", async () => {
    const file = await renderExcel(balanceDocument());

    expect(file.format).toBe("excel");
    expect(file.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(file.fileName).toBe("PERFECTO_trial-balance_2026-03-01.xlsx");
    expect(file.sizeBytes).toBe(file.bytes.byteLength);
    // Un .xlsx est un zip : la signature ne trompe pas.
    expect(new TextDecoder("latin1").decode(file.bytes.slice(0, 2))).toBe("PK");

    const workbook = await loadWorkbook(file.bytes);
    const sheet = firstSheet(workbook);
    expect(sheet.name).toBe("Balance générale");
    expect(workbook.creator).toContain("PERFECTO");
    expect(workbook.company).toBe("PERFECTO Négoce Abidjan");
  });

  it("pose le bandeau d'identité fusionné puis les paramètres de l'édition", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(balanceDocument())).bytes));

    expect(sheet.getCell("A1").value).toBe("Balance générale");
    expect(sheet.getCell("A1").font?.bold).toBe(true);
    expect(sheet.getCell("A2").value).toBe("Arrêtée au 28/02/2026");
    expect(sheet.getCell("A3").value).toBe("PERFECTO Négoce Abidjan (SARL)");
    expect(sheet.getCell("A4").value).toBe("IFU : CI-2024-B-1187");
    // Le bandeau occupe toute la largeur : une feuille imprimée ne se coupe pas.
    const merges = (sheet.model as { merges?: string[] }).merges ?? [];
    expect(merges.some((range) => range === "A1:F1")).toBe(true);

    const values = sheet.getColumn(1).values as unknown[];
    expect(values).toContain("Période");
    expect(values).toContain("Équilibre");
  });

  it("rend les montants calculables, pas du texte formaté", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(balanceDocument())).bytes));
    const headerRow = findHeaderRow(sheet, "Compte");

    // Ligne du compte 401100 : crédit de 472 000.
    let target = 0;
    for (let index = headerRow + 1; index <= sheet.rowCount; index += 1) {
      if (sheet.getRow(index).getCell(1).value === "401100") target = index;
    }
    expect(target).toBeGreaterThan(headerRow);

    const credit = sheet.getRow(target).getCell(4);
    expect(credit.value).toBe(472000);
    expect(typeof credit.value).toBe("number");
    expect(credit.numFmt).toBe("#,##0.00");
    expect(credit.alignment?.horizontal).toBe("right");

    // Une somme Excel sur cette colonne donnera le vrai total.
    const debitColumn = sheet.getRow(target).getCell(3);
    expect(debitColumn.value).toBe(0);
  });

  it("met en forme les titres, les sections et les totaux", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(balanceDocument())).bytes));
    const headerRow = findHeaderRow(sheet, "Compte");

    const header = sheet.getRow(headerRow).getCell(1);
    expect(header.font?.bold).toBe(true);
    expect(argb(header)).toBe("FFEFF3F8");

    const totals = sheet.getRow(headerRow + 8).getCell(1);
    expect(totals.value).toBe("Totaux");
    expect(totals.font?.bold).toBe(true);
    expect(argb(totals)).toBe("FFF6F7F9");
    // Le total de débit reste un nombre.
    expect(sheet.getRow(headerRow + 8).getCell(3).value).toBe(2832000);
  });

  it("fige les titres et filtre le tableau pour les longues lectures", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(longDocument(240))).bytes));
    const headerRow = findHeaderRow(sheet, "Compte");

    // Volet figé sous la ligne de titres : les intitulés restent visibles au défilement.
    expect((sheet.views[0] as { state?: string }).state).toBe("frozen");
    expect((sheet.views[0] as { ySplit?: number }).ySplit).toBe(headerRow);

    // Filtre automatique de la ligne de titres à la dernière ligne de données.
    expect(String(sheet.autoFilter)).toBe(`A${headerRow}:F${headerRow + 240}`);
    expect(sheet.rowCount).toBeGreaterThan(250);
  });

  it("règle la mise en page : A4, ajustée en largeur, orientation selon la largeur", async () => {
    const portrait = firstSheet(await loadWorkbook((await renderExcel(balanceDocument())).bytes));
    const setup = portrait.pageSetup as unknown as {
      paperSize?: number;
      orientation?: string;
      fitToPage?: boolean;
      fitToWidth?: number;
      fitToHeight?: number;
      printTitlesRow?: string;
    };
    expect(setup.paperSize).toBe(9); // A4
    expect(setup.orientation).toBe("portrait");
    expect(setup.fitToPage).toBe(true);
    expect(setup.fitToWidth).toBe(1);
    expect(setup.fitToHeight).toBe(0);

    const headerRow = findHeaderRow(portrait, "Compte");
    expect(setup.printTitlesRow).toBe(`${headerRow}:${headerRow}`);

    // Treize colonnes ne tiennent pas en A4 portrait : la feuille passe en paysage.
    const landscape = firstSheet(await loadWorkbook((await renderExcel(wideDocument())).bytes));
    const wideSetup = landscape.pageSetup as unknown as { orientation?: string };
    expect(wideSetup.orientation).toBe("landscape");
    expect(landscape.name).toBe(toSheetName(wideDocument().title));
    expect(landscape.name.length).toBeLessThanOrEqual(31);
  });

  it("écrit explicitement l'absence de donnée", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(emptyDocument())).bytes));
    const values = sheet.getColumn(1).values as unknown[];

    expect(values).toContain(EMPTY_DOCUMENT_LABEL);
    // Aucun filtre automatique sur un tableau vide : ce serait un filtre sans données.
    expect(sheet.autoFilter).toBeUndefined();
  });

  it("donne une largeur lisible à chaque colonne", async () => {
    const sheet = firstSheet(await loadWorkbook((await renderExcel(balanceDocument())).bytes));

    expect(sheet.getColumn(1).width).toBe(10);
    expect(sheet.getColumn(2).width).toBe(32);
    expect(sheet.getColumn(3).width).toBe(16);
  });
});
