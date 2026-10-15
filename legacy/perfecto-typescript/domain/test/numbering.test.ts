import { describe, expect, it } from "vitest";
import {
  DomainRuleError,
  ENTRY_NUMBER_WIDTH,
  allocateEntryNumber,
  formatEntryNumber,
  peekEntryNumber,
  type EntryNumberSequence
} from "../src/index";

const FY = "fy-2026";

describe("numérotation automatique des pièces", () => {
  it("formate le numéro JOURNAL-AAAA-NNNN en normalisant le journal", () => {
    expect(formatEntryNumber(" ach ", 2026, 1)).toBe("ACH-2026-0001");
    expect(formatEntryNumber("OD", 2026, 42)).toBe("OD-2026-0042");
    expect(ENTRY_NUMBER_WIDTH).toBe(4);
  });

  it("allonge le numéro au-delà du palier sans jamais réinitialiser", () => {
    expect(formatEntryNumber("ACH", 2026, 10000)).toBe("ACH-2026-10000");
    expect(formatEntryNumber("ACH", 2026, 123456)).toBe("ACH-2026-123456");
  });

  it("refuse un journal vide, une année ou une séquence invalide", () => {
    expect(() => formatEntryNumber("", 2026, 1)).toThrow(DomainRuleError);
    expect(() => formatEntryNumber("ACH", 26, 1)).toThrow("Année de numérotation invalide : 26.");
    expect(() => formatEntryNumber("ACH", 2026, 0)).toThrow(
      "La séquence de numérotation doit être un entier positif."
    );
  });

  it("annonce le numéro suivant sans le consommer", () => {
    const sequences: EntryNumberSequence[] = [{ journalCode: "ACH", fiscalYearId: FY, lastNumber: 3 }];
    expect(peekEntryNumber(sequences, "ACH", FY, 2026)).toBe("ACH-2026-0004");
    expect(peekEntryNumber(sequences, "ACH", FY, 2026)).toBe("ACH-2026-0004");
    expect(sequences[0]?.lastNumber).toBe(3);
  });

  it("tient une séquence distincte par journal et par exercice", () => {
    let sequences: readonly EntryNumberSequence[] = [];

    const first = allocateEntryNumber(sequences, "ACH", FY, 2026);
    expect(first.number).toBe("ACH-2026-0001");
    sequences = first.sequences;

    const second = allocateEntryNumber(sequences, "VTE", FY, 2026);
    expect(second.number).toBe("VTE-2026-0001");
    sequences = second.sequences;

    const third = allocateEntryNumber(sequences, "ACH", FY, 2026);
    expect(third.number).toBe("ACH-2026-0002");
    sequences = third.sequences;

    // Même journal, autre exercice : la suite repart à 1 sans écraser 2026.
    const nextYear = allocateEntryNumber(sequences, "ACH", "fy-2027", 2027);
    expect(nextYear.number).toBe("ACH-2027-0001");
    expect(nextYear.sequences).toHaveLength(3);
    expect(nextYear.sequences.find((item) => item.fiscalYearId === FY && item.journalCode === "ACH")?.lastNumber).toBe(2);
  });

  it("ne modifie pas la liste reçue (fonction pure)", () => {
    const sequences: EntryNumberSequence[] = [{ journalCode: "OD", fiscalYearId: FY, lastNumber: 1 }];
    const allocated = allocateEntryNumber(sequences, "OD", FY, 2026);
    expect(allocated.number).toBe("OD-2026-0002");
    expect(sequences[0]?.lastNumber).toBe(1);
    expect(allocated.sequences[0]?.lastNumber).toBe(2);
  });
});
