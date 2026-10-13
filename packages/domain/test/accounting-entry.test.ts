import { describe, expect, it } from "vitest";
import {
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  accountingEntryStatusLabel,
  amountFromDecimal,
  civilDate
} from "../src/index";

const NOW = new Date("2026-01-15T09:00:00.000Z");

function balancedEntry(reference = "FAC-001"): AccountingEntry {
  const entry = AccountingEntry.create("fy-1", "org-1", "ACH", civilDate(2026, 1, 15), reference, NOW);
  entry.addLine("601100", "Achat de marchandises", amountFromDecimal("100000"), 0n);
  entry.addLine("401100", "Fournisseur", 0n, amountFromDecimal("100000"));
  return entry;
}

describe("AccountingEntry (portage de AccountingEntryTests.cs)", () => {
  it("valide une pièce équilibrée puis la rend immuable", () => {
    const entry = balancedEntry();
    entry.post(NOW);

    expect(entry.status).toBe(AccountingEntryStatus.Posted);
    expect(entry.isBalanced).toBe(true);
    expect(entry.totalDebit).toBe(amountFromDecimal("100000"));
    expect(() => entry.addLine("445100", "Taxe", 0n, 1n)).toThrow(DomainRuleError);
    expect(() => entry.post(NOW)).toThrow("Une pièce validée est immuable. Utilisez une extourne pour la corriger.");
  });

  it("refuse la validation d'une pièce déséquilibrée", () => {
    const entry = AccountingEntry.create("fy-1", "org-1", "OD", civilDate(2026, 2, 1), "OD-001", NOW);
    entry.addLine("601100", "Charge", amountFromDecimal("25000"), 0n);
    entry.addLine("401100", "Fournisseur", 0n, amountFromDecimal("20000"));

    expect(() => entry.post(NOW)).toThrow(DomainRuleError);
    expect(entry.status).toBe(AccountingEntryStatus.Draft);
  });

  it.each([
    ["100", "100"],
    ["0", "0"],
    ["-1", "0"]
  ])("rejette la paire débit/crédit (%s, %s)", (debit, credit) => {
    const entry = AccountingEntry.create("fy-1", "org-1", "OD", civilDate(2026, 2, 1), "OD-002", NOW);
    expect(() => entry.addLine("601100", "Ligne", amountFromDecimal(debit), amountFromDecimal(credit))).toThrow(
      DomainRuleError
    );
  });

  it("n'autorise l'extourne que d'une pièce validée", () => {
    const draft = balancedEntry("OD-EXT");
    expect(() => draft.markReversed(NOW)).toThrow("Seule une pièce validée peut être extournée.");
    draft.post(NOW);
    draft.markReversed(NOW);
    expect(draft.status).toBe(AccountingEntryStatus.Reversed);
    expect(accountingEntryStatusLabel[AccountingEntryStatus.Reversed]).toBe("Extournée");
    expect(accountingEntryStatusLabel[AccountingEntryStatus.Posted]).toBe("Validée");
    expect(accountingEntryStatusLabel[AccountingEntryStatus.Draft]).toBe("Brouillon");
  });
});
