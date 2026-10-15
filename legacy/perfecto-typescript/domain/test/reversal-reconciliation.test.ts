import { describe, expect, it } from "vitest";
import {
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  amountFromDecimal,
  civilDate,
  nextReconciliationLabel,
  reconciliationLabel,
  validateReconcilableLines
} from "../src/index";

const NOW = new Date("2026-03-01T09:00:00.000Z");
const LATER = new Date("2026-03-20T16:00:00.000Z");

function postedPurchase(): AccountingEntry {
  const entry = AccountingEntry.create({
    fiscalYearId: "fy-2026",
    organizationId: "org-1",
    journalCode: "ACH",
    entryDate: civilDate(2026, 3, 1),
    reference: "FA-2026-004",
    number: "ACH-2026-0001",
    now: NOW
  });
  entry.addLine("601100", "Achats de marchandises", amountFromDecimal("400000"), 0n);
  entry.addLine("445200", "TVA récupérable", amountFromDecimal("72000"), 0n);
  entry.addLine("401100", "Fournisseur", 0n, amountFromDecimal("472000"), "FOU001");
  entry.post(NOW);
  return entry;
}

describe("contre-passation (agrégat pièce)", () => {
  it("inverse débits et crédits en conservant comptes, libellés et tiers", () => {
    const entry = postedPurchase();
    const reversed = entry.reversalLineInputs();

    expect(reversed).toHaveLength(3);
    expect(reversed[0]).toMatchObject({
      accountCode: "601100",
      label: "Achats de marchandises",
      debit: 0n,
      credit: amountFromDecimal("400000")
    });
    // La TVA, débitée à l'origine, devient un crédit de la contre-passation.
    expect(reversed[1]).toMatchObject({ debit: 0n, credit: amountFromDecimal("72000") });
    expect(reversed[2]).toMatchObject({ debit: amountFromDecimal("472000"), credit: 0n });
    expect(reversed[2]?.thirdPartyCode).toBe("FOU001");
    // La somme de l'origine et de son inverse est nulle.
    const netDebit = reversed.reduce((sum, line) => sum + line.debit, 0n);
    expect(netDebit).toBe(entry.totalCredit);
  });

  it("marque extournée sans effacer la date de validation", () => {
    const entry = postedPurchase();
    expect(entry.postedAt?.toISOString()).toBe(NOW.toISOString());

    entry.markReversed(LATER);

    expect(entry.status).toBe(AccountingEntryStatus.Reversed);
    expect(entry.postedAt?.toISOString()).toBe(NOW.toISOString());
    expect(entry.reversedAt?.toISOString()).toBe(LATER.toISOString());
  });

  it("refuse une double extourne et l'extourne d'un brouillon", () => {
    const entry = postedPurchase();
    entry.markReversed(LATER);
    expect(() => entry.markReversed(LATER)).toThrow("Cette pièce a déjà été extournée.");

    const draft = AccountingEntry.create({
      fiscalYearId: "fy-2026",
      organizationId: "org-1",
      journalCode: "OD",
      entryDate: civilDate(2026, 3, 1),
      reference: "OD-BROUILLON",
      number: "OD-2026-0001",
      now: NOW
    });
    expect(() => draft.markReversed(LATER)).toThrow("Seule une pièce validée peut être extournée.");
  });
});

describe("lettrage (rapprochement de tiers)", () => {
  it("génère les lettres A…Z puis AA, AB, BA", () => {
    expect(reconciliationLabel(0)).toBe("A");
    expect(reconciliationLabel(1)).toBe("B");
    expect(reconciliationLabel(25)).toBe("Z");
    expect(reconciliationLabel(26)).toBe("AA");
    expect(reconciliationLabel(27)).toBe("AB");
    expect(reconciliationLabel(51)).toBe("AZ");
    expect(reconciliationLabel(52)).toBe("BA");
    expect(() => reconciliationLabel(-1)).toThrow(DomainRuleError);
  });

  it("propose la première lettre libre", () => {
    expect(nextReconciliationLabel([])).toBe("A");
    expect(nextReconciliationLabel(["A", "B"])).toBe("C");
    expect(nextReconciliationLabel(["A", "C"])).toBe("B");
    expect(nextReconciliationLabel(["a", "b"])).toBe("C");
  });

  it("exige au moins deux mouvements équilibrés et distincts", () => {
    const invoice = { id: "l1", debit: 0n, credit: amountFromDecimal("472000") };
    const payment = { id: "l2", debit: amountFromDecimal("472000"), credit: 0n };

    expect(validateReconcilableLines([invoice, payment])).toEqual({
      totalDebit: amountFromDecimal("472000"),
      totalCredit: amountFromDecimal("472000")
    });
    expect(() => validateReconcilableLines([invoice])).toThrow(
      "Un lettrage doit rapprocher au moins deux mouvements."
    );
    expect(() => validateReconcilableLines([invoice, invoice])).toThrow(
      "Un mouvement est présent deux fois dans la sélection."
    );
    expect(() =>
      validateReconcilableLines([invoice, { id: "l3", debit: amountFromDecimal("400000"), credit: 0n }])
    ).toThrow(/Lettrage déséquilibré/);
    expect(() =>
      validateReconcilableLines([
        { id: "l4", debit: 0n, credit: 0n },
        { id: "l5", debit: 0n, credit: 0n }
      ])
    ).toThrow("Un lettrage doit porter un montant non nul.");
  });
});
