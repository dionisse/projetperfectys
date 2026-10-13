import { describe, expect, it } from "vitest";
import { amountFromDecimal } from "@perfecto/domain";
import { buildGeneralLedger, buildJournal, buildTrialBalance, createDemoState } from "../src/index";

const ORG = "org-demo";
const FISCAL_YEAR = "fy-2026";

describe("états comptables (portage de AccountingReportBuilder.cs)", () => {
  const state = createDemoState(ORG, FISCAL_YEAR);

  it("exclut les brouillons du journal et classe chronologiquement", () => {
    const journal = buildJournal(state.entries);
    expect(journal.every((line) => line.reference !== "OD-2026-001")).toBe(true);
    const dates = journal.map((line) => line.entryDate);
    expect(dates.slice().sort()).toEqual(dates);
  });

  it("calcule un solde progressif cohérent au grand livre", () => {
    const ledger = buildGeneralLedger(state.entries);
    const suppliers = ledger.find((account) => account.accountCode === "401100");
    expect(suppliers?.lines.map((line) => line.runningBalance)).toEqual(["-472000"]);
    expect(amountFromDecimal(suppliers?.closingBalance ?? "0")).toBe(amountFromDecimal("-472000"));
  });

  it("produit une balance équilibrée limitée aux comptes mouvementés", () => {
    const balance = buildTrialBalance(state.accounts, state.entries);
    const debit = balance.reduce((sum, line) => sum + amountFromDecimal(line.debitMovements), 0n);
    const credit = balance.reduce((sum, line) => sum + amountFromDecimal(line.creditMovements), 0n);
    expect(debit).toBe(credit);
    expect(debit).toBe(amountFromDecimal("2832000"));
    expect(balance.some((line) => line.accountCode === "101000")).toBe(false);
  });
});
