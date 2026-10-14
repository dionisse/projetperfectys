import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDemoState, createEmptyState } from "@perfecto/application";
import { amountFromDecimal } from "@perfecto/domain";
import { IndexedDbStorage, deleteLocalDatabase } from "../src/adapters/indexeddb-storage";
import { deserializeState, serializeState, type SerializedState } from "../src/adapters/state-codec";

const ORG = "org-pwa";
const FY = "fy-pwa";

beforeEach(async () => {
  await deleteLocalDatabase();
});

describe("codec d'état (montants exacts)", () => {
  it("fait un aller-retour sans perte ni flottant", () => {
    const state = createDemoState(ORG, FY);
    const raw = serializeState(state);
    expect(typeof raw.entries[0]?.lines[0]?.debit).toBe("string");
    const back = deserializeState(raw);
    expect(back).toEqual(state);
  });

  it("conserve les numéros de pièce, les tiers et les séquences", () => {
    const state = createDemoState(ORG, FY);
    const back = deserializeState(serializeState(state));
    expect(back.entries.map((entry) => entry.number)).toEqual([
      "VTE-2026-0001",
      "ACH-2026-0001",
      "BQ1-2026-0001",
      "OD-2026-0001"
    ]);
    expect(back.thirdParties.map((item) => item.code)).toContain("FOU001");
    expect(back.entrySequences.find((item) => item.journalCode === "ACH")?.lastNumber).toBe(1);
  });
});

describe("migration d'une base écrite avant la tranche 2", () => {
  /** État tel que la tranche 1 le sérialisait : ni numéro, ni tiers, ni séquences. */
  function legacyState(): SerializedState {
    const base = serializeState(createEmptyState(ORG, FY));
    const lines = (amount: string) => [
      { id: "l1", accountCode: "601100", accountLabel: "Achats", label: "Charge", debit: amount, credit: "0" },
      { id: "l2", accountCode: "401100", accountLabel: "Fournisseurs", label: "Fournisseur", debit: "0", credit: amount }
    ];
    const entry = (id: string, journalCode: string, entryDate: string, reference: string, createdAt: string) => ({
      id,
      organizationId: ORG,
      fiscalYearId: FY,
      journalCode,
      entryDate,
      reference,
      description: reference,
      status: "posted" as const,
      createdAt,
      postedAt: createdAt,
      lines: lines("100000")
    });

    delete base.thirdParties;
    delete base.entrySequences;
    base.entries = [
      entry("e2", "ACH", "2026-01-20", "FA-002", "2026-01-20T09:00:00.000Z"),
      entry("e1", "ACH", "2026-01-10", "FA-001", "2026-01-10T09:00:00.000Z"),
      entry("e3", "VTE", "2026-01-15", "FV-001", "2026-01-15T09:00:00.000Z")
    ];
    return base;
  }

  it("attribue les numéros manquants dans l'ordre chronologique, par journal", () => {
    const migrated = deserializeState(legacyState());
    const byId = new Map(migrated.entries.map((entry) => [entry.id, entry.number]));

    expect(byId.get("e1")).toBe("ACH-2026-0001");
    expect(byId.get("e2")).toBe("ACH-2026-0002");
    expect(byId.get("e3")).toBe("VTE-2026-0001");
    expect(migrated.entrySequences).toEqual([
      { journalCode: "ACH", fiscalYearId: FY, lastNumber: 2 },
      { journalCode: "VTE", fiscalYearId: FY, lastNumber: 1 }
    ]);
  });

  it("complète les champs absents sans réinventer les numéros existants", () => {
    const raw = legacyState();
    raw.entries[1] = { ...raw.entries[1]!, number: "ACH-2026-0007" };

    const migrated = deserializeState(raw);
    const byId = new Map(migrated.entries.map((entry) => [entry.id, entry]));

    expect(byId.get("e1")?.number).toBe("ACH-2026-0007");
    // Le numéro déjà attribué fait foi : la pièce suivante continue la séquence.
    expect(byId.get("e2")?.number).toBe("ACH-2026-0008");
    expect(migrated.entrySequences.find((item) => item.journalCode === "ACH")?.lastNumber).toBe(8);
    expect(migrated.thirdParties).toEqual([]);
    expect(migrated.entries[0]?.lines[0]?.thirdPartyCode).toBeNull();
    expect(migrated.entries[0]?.updatedAt).toBeNull();
  });
});

describe("IndexedDbStorage", () => {
  it("amorce le jeu de démonstration au premier lancement puis le conserve", async () => {
    const storage = new IndexedDbStorage(() => createDemoState(ORG, FY));

    const first = await storage.read();
    expect(first.entries).toHaveLength(4);
    expect(first.thirdParties.length).toBeGreaterThan(0);

    const second = await storage.read();
    expect(second).toEqual(first);
  });

  it("persiste les écritures du noyau après réouverture de la base", async () => {
    const storage = new IndexedDbStorage(() => createEmptyState(ORG, FY));
    const state = await storage.read();
    state.entries.push({
      id: "entry-1",
      organizationId: ORG,
      fiscalYearId: FY,
      number: "OD-2026-0001",
      journalCode: "OD",
      entryDate: "2026-04-01",
      reference: "OD-PWA-001",
      description: "Pièce persistée",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: null,
      postedAt: null,
      reversedAt: null,
      reversalOfEntryId: null,
      reversedByEntryId: null,
      lines: [
        {
          id: "line-1",
          accountCode: "601100",
          accountLabel: "Achats de marchandises",
          label: "Débit",
          debit: amountFromDecimal("150000.55"),
          credit: 0n,
          thirdPartyCode: null
        },
        {
          id: "line-2",
          accountCode: "401100",
          accountLabel: "Fournisseurs",
          label: "Crédit",
          debit: 0n,
          credit: amountFromDecimal("150000.55"),
          thirdPartyCode: "FOU001"
        }
      ]
    });
    await storage.write(state);

    const reopened = new IndexedDbStorage(() => createEmptyState(ORG, FY));
    const reloaded = await reopened.read();
    expect(reloaded.entries).toHaveLength(1);
    expect(reloaded.entries[0]?.lines[0]?.debit).toBe(amountFromDecimal("150000.55"));
    expect(reloaded.entries[0]?.lines[1]?.thirdPartyCode).toBe("FOU001");
    expect(reloaded.entries[0]?.number).toBe("OD-2026-0001");
  });

  it("relit une base tranche 1 stockée puis la réécrit complète", async () => {
    const storage = new IndexedDbStorage(() => createEmptyState(ORG, FY));
    const legacy = serializeState(createEmptyState(ORG, FY));
    delete legacy.thirdParties;
    delete legacy.entrySequences;
    legacy.entries = [
      {
        id: "legacy-1",
        organizationId: ORG,
        fiscalYearId: FY,
        journalCode: "OD",
        entryDate: "2026-03-05",
        reference: "OD-LEGACY",
        description: "Héritage tranche 1",
        status: "draft",
        createdAt: "2026-03-05T08:00:00.000Z",
        postedAt: null,
        lines: [
          { id: "a", accountCode: "601100", accountLabel: "Achats", label: "Débit", debit: "1000", credit: "0" },
          { id: "b", accountCode: "571100", accountLabel: "Caisse", label: "Crédit", debit: "0", credit: "1000" }
        ]
      }
    ];
    await storage.write(deserializeState(legacy));

    const reloaded = await new IndexedDbStorage(() => createEmptyState(ORG, FY)).read();
    expect(reloaded.entries[0]?.number).toBe("OD-2026-0001");
    expect(reloaded.entrySequences).toHaveLength(1);
    expect(Array.isArray(reloaded.thirdParties)).toBe(true);
  });
});
