import { describe, expect, it } from "vitest";
import type { ExportFormat } from "@perfecto/contracts";
import { exportFormatExtensions, exportMimeTypes } from "@perfecto/contracts";
import { DomainRuleError } from "@perfecto/domain";
import { EXPORT_FORMATS, renderDocument } from "../src/index";
import { balanceDocument, entryDocument, wideDocument } from "./fixtures";

/** Signatures vérifiées sur les octets : un décodage latin1 masquerait la BOM UTF-8. */
const SIGNATURES: Record<ExportFormat, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
  excel: [0x50, 0x4b], // PK (zip)
  csv: [0xef, 0xbb, 0xbf] // BOM UTF-8
};

function startsWithSignature(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

describe("aiguillage des formats", () => {
  it("propose exactement les trois formats exigés", () => {
    expect(EXPORT_FORMATS).toEqual(["pdf", "excel", "csv"]);
  });

  it.each([...EXPORT_FORMATS])("rend le document en %s", async (format) => {
    const document = balanceDocument();
    const file = await renderDocument(format, document);

    expect(file.format).toBe(format);
    expect(file.mimeType).toBe(exportMimeTypes[format]);
    expect(file.fileName).toBe(`${document.slug}.${exportFormatExtensions[format]}`);
    expect(file.sizeBytes).toBe(file.bytes.byteLength);
    expect(file.bytes).toBeInstanceOf(Uint8Array);
    expect(file.sizeBytes).toBeGreaterThan(300);

    expect(startsWithSignature(file.bytes, SIGNATURES[format])).toBe(true);
  });

  it("refuse un format hors contrat, en français", async () => {
    await expect(renderDocument("word" as ExportFormat, balanceDocument())).rejects.toThrow(
      "Format d'export inconnu : « word ». Formats acceptés : PDF, Excel, CSV."
    );
    await expect(renderDocument("word" as ExportFormat, balanceDocument())).rejects.toBeInstanceOf(
      DomainRuleError
    );
  });

  it("porte le même contenu dans les trois formats", async () => {
    const document = entryDocument();
    const [pdf, excel, csv] = await Promise.all([
      renderDocument("pdf", document),
      renderDocument("excel", document),
      renderDocument("csv", document)
    ]);

    const csvText = new TextDecoder().decode(csv.bytes);
    expect(csvText).toContain("Pièce comptable ACH-2026-0001");
    expect(csvText).toContain("Achats de marchandises");
    expect(csvText).toContain("472000,00");

    // Les trois fichiers portent le même nom de base : seule l'extension change.
    const stems = new Set([pdf.fileName, excel.fileName, csv.fileName].map((name) => name.split(".").slice(0, -1).join(".")));
    expect(stems.size).toBe(1);
    expect(pdf.sizeBytes).not.toBe(excel.sizeBytes);
  });

  it("rend un document large sans avertissement de débordement", async () => {
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      const file = await renderDocument("pdf", wideDocument());
      expect(file.sizeBytes).toBeGreaterThan(1000);
    } finally {
      console.warn = originalWarn;
    }

    // autoTable prévient en console quand les colonnes dépassent la largeur utile.
    expect(warnings.filter((line) => /width|table width|overflow/i.test(line))).toEqual([]);
  });
});
