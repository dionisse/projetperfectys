import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDemoState, createEmptyState } from "@perfecto/application";
import { amountFromDecimal } from "@perfecto/domain";
import { IndexedDbStorage, deleteLocalDatabase } from "../src/adapters/indexeddb-storage";
import { deserializeState, serializeState } from "../src/adapters/state-codec";

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
});

describe("IndexedDbStorage", () => {
  it("amorce le jeu de démonstration au premier lancement puis le conserve", async () => {
    const storage = new IndexedDbStorage(() => createDemoState(ORG, FY));

    const first = await storage.read();
    expect(first.entries).toHaveLength(4);

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
      journalCode: "OD",
      entryDate: "2026-04-01",
      reference: "OD-PWA-001",
      description: "Pièce persistée",
      status: "draft",
      createdAt: new Date().toISOString(),
      postedAt: null,
      lines: [
        {
          id: "line-1",
          accountCode: "601100",
          accountLabel: "Achats de marchandises",
          label: "Débit",
          debit: amountFromDecimal("150000.55"),
          credit: 0n
        },
        {
          id: "line-2",
          accountCode: "401100",
          accountLabel: "Fournisseurs",
          label: "Crédit",
          debit: 0n,
          credit: amountFromDecimal("150000.55")
        }
      ]
    });
    await storage.write(state);

    const reopened = new IndexedDbStorage(() => createEmptyState(ORG, FY));
    const reloaded = await reopened.read();
    expect(reloaded.entries).toHaveLength(1);
    expect(reloaded.entries[0]?.lines[0]?.debit).toBe(amountFromDecimal("150000.55"));
  });
});
