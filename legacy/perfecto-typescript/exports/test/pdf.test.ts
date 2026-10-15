import { describe, expect, it } from "vitest";
import { renderPdf } from "../src/pdf";
import { EMPTY_DOCUMENT_LABEL, preferredOrientation, sanitizeForPdf } from "../src/text";
import { balanceDocument, emptyDocument, longDocument, pdfMediaBox, pdfPageCount, pdfTexts, wideDocument } from "./fixtures";

/** Texte extrait, normalisé : les sauts de ligne internes au PDF ne comptent pas. */
function joined(bytes: Uint8Array): string {
  return pdfTexts(bytes).join(" ");
}

describe("rendu PDF", () => {
  it("produit un PDF A4 portrait, signé et nommé d'après le document", async () => {
    const file = await renderPdf(balanceDocument());

    expect(file.format).toBe("pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.fileName).toBe("PERFECTO_trial-balance_2026-03-01.pdf");
    expect(file.sizeBytes).toBe(file.bytes.byteLength);
    expect(new TextDecoder("latin1").decode(file.bytes.slice(0, 5))).toBe("%PDF-");

    const box = pdfMediaBox(file.bytes);
    expect(box).not.toBeNull();
    // A4 portrait : 595 × 842 points.
    expect(Math.round(box![0])).toBe(595);
    expect(Math.round(box![1])).toBe(842);
    expect(pdfPageCount(file.bytes)).toBe(1);
  });

  it("imprime l'identité de la société, le titre et les paramètres", async () => {
    const text = joined((await renderPdf(balanceDocument())).bytes);

    expect(text).toContain("PERFECTO Negoce Abidjan".replace("Negoce", "Négoce"));
    expect(text).toContain("(SARL)");
    expect(text).toContain("IFU : CI-2024-B-1187");
    expect(text).toContain("Abidjan, Côte d'Ivoire");
    expect(text).toContain("Balance générale");
    expect(text).toContain("Arrêtée au 28/02/2026");
    expect(text).toContain("Exercice 2026");
    expect(text).toContain("Période :");
    expect(text).toContain("Débit = crédit");
  });

  it("reprend les lignes, les totaux et la mention finale", async () => {
    const text = joined((await renderPdf(balanceDocument())).bytes);

    expect(text).toContain("Fournisseurs");
    expect(text).toContain("Ventes de marchandises");
    expect(text).toContain("472 000");
    expect(text).toContain("2 832 000");
    expect(text).toContain("Totaux");
    expect(text).toContain("La balance est équilibrée");
    expect(text).toContain("Page 1/1");
    expect(text).toContain("PERFECTO_trial-balance_2026-03-01");
  });

  it("paginate un grand livre de 240 lignes avec en-tête courant", async () => {
    const file = await renderPdf(longDocument(240));
    const pages = pdfPageCount(file.bytes);

    expect(pages).toBeGreaterThan(3);
    const text = joined(file.bytes);
    expect(text).toContain(`Page ${pages}/${pages}`);
    expect(text).toContain("Page 2/");
    // L'en-tête courant des pages suivantes rappelle la société et le document.
    expect(text.match(/PERFECTO Négoce Abidjan - Balance générale/g)?.length ?? 0).toBeGreaterThan(
      pages - 2
    );
  });

  it("normalise les caractères que les polices PDF standard perdent", async () => {
    // La sonde l'a montré : sans normalisation, « — », « Œ » et « € » disparaissent du texte.
    expect(sanitizeForPdf("Achat — lot Œuvre 1 · 1 500 €")).toBe("Achat - lot OEuvre 1 · 1 500 EUR");
    expect(sanitizeForPdf("Total\u202F: 1\u00A0500")).toBe("Total : 1 500");
    expect(sanitizeForPdf("« cité » — déjà réglé…")).toBe("« cité » - deja reglé...".replace("deja reglé", "déjà réglé"));

    const text = joined((await renderPdf(wideDocument())).bytes);
    expect(text).toContain("Achat de marchandises - lot OEuvre 1");
    expect(text).not.toMatch(/[\u202F\u00A0\u2014\u0152]/);
  });

  it("passe en paysage quand le tableau dépasse la largeur utile", async () => {
    const document = wideDocument();
    expect(preferredOrientation(document)).toBe("landscape");

    const file = await renderPdf(document);
    const box = pdfMediaBox(file.bytes);
    // A4 paysage : 842 × 595 points.
    expect(Math.round(box![0])).toBe(842);
    expect(Math.round(box![1])).toBe(595);
    expect(joined(file.bytes)).toContain("Solde cumulé");
  });

  it("écrit explicitement l'absence de donnée, sur une seule page", async () => {
    const file = await renderPdf(emptyDocument());

    expect(pdfPageCount(file.bytes)).toBe(1);
    expect(joined(file.bytes)).toContain(EMPTY_DOCUMENT_LABEL);
  });

  it("édite une pièce avec ses champs d'identité et ses trois lignes", async () => {
    const { entryDocument } = await import("./fixtures");
    const text = joined((await renderPdf(entryDocument())).bytes);

    expect(text).toContain("Pièce comptable ACH-2026-0001");
    expect(text).toContain("FA-2026-004");
    expect(text).toContain("ACH — Journal des achats".replace("—", "-"));
    expect(text).toContain("sha256:9f2c1ab7");
    expect(text).toContain("Achats de marchandises");
    expect(text).toContain("toute correction passe par une contre-passation");
  });
});
