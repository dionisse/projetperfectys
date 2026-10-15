import { beforeEach, describe, expect, it } from "vitest";
import type { AccountingEntryDto } from "@perfecto/contracts";
import { civilDate } from "@perfecto/domain";
import { AccountingKernel, InMemoryStorage, createDemoState } from "../src/index";

const ORG = "org-demo";
const FY = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");
/** Février 2026 : période ouverte postérieure aux pièces de démonstration. */
const REVERSAL_DATE = civilDate(2026, 2, 20);

let kernel: AccountingKernel;

beforeEach(() => {
  kernel = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FY)), {
    clock: () => NOW,
    actor: "superviseur",
    storageMode: "Mémoire · test"
  });
});

async function entryByNumber(number: string): Promise<AccountingEntryDto> {
  const entries = await kernel.getEntries();
  const found = entries.find((entry) => entry.number === number);
  if (!found) {
    throw new Error(`Pièce ${number} introuvable`);
  }
  return found;
}

describe("extourne d'une pièce validée (contre-passation automatique)", () => {
  it("génère l'inverse exact et relie les deux pièces", async () => {
    const purchase = await entryByNumber("ACH-2026-0001");

    const result = await kernel.reverseEntry(purchase.id, {
      organizationId: ORG,
      reversalDate: REVERSAL_DATE
    });

    expect(result.reversal.number).toBe("ACH-2026-0002");
    expect(result.reversal.journalCode).toBe("ACH");
    expect(result.reversal.entryDate).toBe(REVERSAL_DATE);
    expect(result.reversal.reference).toBe("EXT-FA-2026-004");
    expect(result.reversal.status).toBe("posted");
    expect(result.reversal.description).toBe("Extourne de ACH-2026-0001 (FA-2026-004)");
    expect(result.reversal.totalDebit).toBe(purchase.totalCredit);
    expect(result.reversal.totalCredit).toBe(purchase.totalDebit);
    expect(result.reversal.reversalOfEntryId).toBe(purchase.id);
    expect(result.reversal.reversalOfNumber).toBe("ACH-2026-0001");
    expect(result.reversal.reversedByEntryId).toBeNull();

    // Chaque ligne est inversée, comptes / libellés / tiers conservés.
    expect(
      result.reversal.lines.map((line) => [line.accountCode, line.debit, line.credit, line.thirdPartyCode])
    ).toEqual([
      ["601100", "0", "400000", null],
      ["445200", "0", "72000", null],
      ["401100", "472000", "0", "FOU001"]
    ]);

    expect(result.original.status).toBe("reversed");
    expect(result.original.reversedAt).toBe(NOW.toISOString());
    expect(result.original.postedAt).not.toBeNull();
    expect(result.original.reversedByEntryId).toBe(result.reversal.id);
    expect(result.original.reversedByNumber).toBe("ACH-2026-0002");

    expect((await kernel.getSnapshot()).reversedEntryCount).toBe(1);
    expect((await kernel.getEntry(purchase.id)).reversedByNumber).toBe("ACH-2026-0002");
  });

  it("garde les livres équilibrés : la pièce extournée reste dans les états", async () => {
    const purchase = await entryByNumber("ACH-2026-0001");
    const before = await kernel.getSnapshot();
    const accountBefore = before.trialBalance.find((row) => row.accountCode === "601100");
    expect(accountBefore?.debitMovements).toBe("400000");
    expect(accountBefore?.creditMovements).toBe("0");

    await kernel.reverseEntry(purchase.id, { organizationId: ORG, reversalDate: REVERSAL_DATE });

    const after = await kernel.getSnapshot();
    const account = after.trialBalance.find((row) => row.accountCode === "601100");
    expect(account?.debitMovements).toBe("400000");
    expect(account?.creditMovements).toBe("400000");
    expect(account?.debitBalance).toBe("0");
    expect(account?.creditBalance).toBe("0");
    expect(after.totalDebitMovements).toBe(after.totalCreditMovements);
    // Le compteur de pièces validées ne double pas : l'origine est extournée.
    expect(after.postedEntryCount).toBe(3);
    expect(after.reversedEntryCount).toBe(1);

    // Journal et grand livre conservent l'historique complet (origine + inverse).
    const journal = (await kernel.getJournalLines()).filter((line) => line.journalCode === "ACH");
    expect([...new Set(journal.map((line) => line.entryNumber))]).toEqual([
      "ACH-2026-0001",
      "ACH-2026-0002"
    ]);
    const ledger = (await kernel.getGeneralLedger()).find((row) => row.accountCode === "601100");
    expect(ledger?.closingBalance).toBe("0");
    expect(ledger?.lines).toHaveLength(2);
  });

  it("accepte une description et une date propres à la contre-passation", async () => {
    const sale = await entryByNumber("VTE-2026-0001");

    const result = await kernel.reverseEntry(sale.id, {
      organizationId: ORG,
      reversalDate: civilDate(2026, 3, 1),
      description: "Annulation : avoir n° AV-2026-002"
    });

    expect(result.reversal.entryDate).toBe("2026-03-01");
    expect(result.reversal.description).toBe("Annulation : avoir n° AV-2026-002");
    expect(result.reversal.number).toBe("VTE-2026-0002");
  });

  it("trace la contre-passation et l'extourne dans la piste d'audit", async () => {
    const purchase = await entryByNumber("ACH-2026-0001");
    await kernel.reverseEntry(purchase.id, { organizationId: ORG, reversalDate: REVERSAL_DATE });

    const events = await kernel.getAuditLog({ entityType: "AccountingEntry" });
    expect(events.map((event) => event.actionLabel)).toContain("Contre-passation créée");
    expect(events.map((event) => event.actionLabel)).toContain("Pièce extournée");

    const created = events.find((event) => event.action === "accounting.entry.reversal");
    expect(created?.details).toBe("ACH-2026-0002 · contre-passation de ACH-2026-0001");
    expect(created?.actor).toBe("superviseur");

    const marked = events.find((event) => event.action === "accounting.entry.reversed");
    expect(marked?.details).toBe("ACH-2026-0001 · extournée par ACH-2026-0002");
  });

  it("refuse une seconde extourne, un brouillon, une période clôturée et une pièce inconnue", async () => {
    const purchase = await entryByNumber("ACH-2026-0001");
    await kernel.reverseEntry(purchase.id, { organizationId: ORG, reversalDate: REVERSAL_DATE });

    await expect(
      kernel.reverseEntry(purchase.id, { organizationId: ORG, reversalDate: REVERSAL_DATE })
    ).rejects.toThrow("Cette pièce a déjà été extournée par ACH-2026-0002.");

    const draft = await entryByNumber("OD-2026-0001");
    await expect(
      kernel.reverseEntry(draft.id, { organizationId: ORG, reversalDate: REVERSAL_DATE })
    ).rejects.toThrow("Seule une pièce validée peut être extournée.");

    const sale = await entryByNumber("VTE-2026-0001");
    await kernel.setPeriodClosed(2, true);
    await expect(
      kernel.reverseEntry(sale.id, { organizationId: ORG, reversalDate: REVERSAL_DATE })
    ).rejects.toThrow("La période février 2026 est clôturée.");

    await expect(
      kernel.reverseEntry("id-inconnu", { organizationId: ORG, reversalDate: REVERSAL_DATE })
    ).rejects.toThrow("La pièce demandée n'existe pas.");

    await expect(
      kernel.reverseEntry(sale.id, { organizationId: "autre-org", reversalDate: REVERSAL_DATE })
    ).rejects.toThrow("Cette opération ne concerne pas l'organisation de l'espace courant.");
  });

  it("contre-passe même si le tiers d'origine a été désactivé depuis", async () => {
    await kernel.setThirdPartyActive("FOU001", false);
    const purchase = await entryByNumber("ACH-2026-0001");

    const result = await kernel.reverseEntry(purchase.id, {
      organizationId: ORG,
      reversalDate: REVERSAL_DATE
    });

    expect(result.reversal.lines[2]?.thirdPartyCode).toBe("FOU001");
    expect(result.reversal.status).toBe("posted");
  });

  it("suffixe la référence générée si elle est prise et refuse une référence explicite déjà utilisée", async () => {
    // Une pièce occupe déjà `EXT-FA-2026-004`.
    const occupier = await kernel.saveEntry({
      organizationId: ORG,
      journalCode: "OD",
      entryDate: civilDate(2026, 2, 15),
      reference: "EXT-FA-2026-004",
      description: "Régularisation diverse",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "1000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "1000" }
      ]
    });
    expect(occupier.reference).toBe("EXT-FA-2026-004");

    const purchase = await entryByNumber("ACH-2026-0001");
    const result = await kernel.reverseEntry(purchase.id, {
      organizationId: ORG,
      reversalDate: REVERSAL_DATE
    });
    expect(result.reversal.reference).toBe("EXT-FA-2026-004-2");

    await expect(
      kernel.reverseEntry(result.reversal.id, {
        organizationId: ORG,
        reversalDate: civilDate(2026, 2, 25),
        reference: "EXT-FA-2026-004"
      })
    ).rejects.toThrow("Cette référence de pièce existe déjà.");

    // Une référence explicite libre est reprise telle quelle.
    const free = await kernel.reverseEntry(result.reversal.id, {
      organizationId: ORG,
      reversalDate: civilDate(2026, 2, 25),
      reference: "ANN-FA-2026-004"
    });
    expect(free.reversal.reference).toBe("ANN-FA-2026-004");
  });
});
