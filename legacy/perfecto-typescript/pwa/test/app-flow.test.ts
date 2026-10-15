/**
 * Intégration PWA : noyau + adaptateur IndexedDB, exactement comme dans le
 * navigateur (mêmes identifiants de démonstration, même base `perfecto-next`).
 * Vérifie la numérotation, le contrôle des tiers, la révision tracée et la
 * migration transparente d'une base écrite par la tranche 1.
 */

import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDemoState } from "@perfecto/application";
import { DEMO_FISCAL_YEAR_ID, DEMO_ORGANIZATION_ID, getKernel, resetDemoData } from "../src/kernel";
import { IndexedDbStorage } from "../src/adapters/indexeddb-storage";
import { deserializeState, serializeState } from "../src/adapters/state-codec";

beforeEach(async () => {
  await resetDemoData();
});

describe("câblage PWA du noyau", () => {
  it("numérote la pièce suivante dans la séquence du journal de démonstration", async () => {
    const kernel = getKernel();
    expect(await kernel.peekEntryNumber("ACH", "2026-03-01")).toBe("ACH-2026-0002");
    expect(await kernel.peekEntryNumber("OD", "2026-03-01")).toBe("OD-2026-0002");

    const saved = await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "ACH",
      entryDate: "2026-03-01",
      reference: "FA-2026-018",
      description: "Achat de marchandises mars",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "350000", credit: 0 },
        { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "350000", thirdPartyCode: "FOU001" }
      ]
    });

    expect(saved.number).toBe("ACH-2026-0002");
    expect(saved.status).toBe("posted");
    expect(await kernel.peekEntryNumber("ACH", "2026-03-01")).toBe("ACH-2026-0003");
  });

  it("persiste la pièce dans IndexedDB, tiers et numéro compris", async () => {
    const kernel = getKernel();
    await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "OD",
      entryDate: "2026-03-05",
      reference: "OD-2026-009",
      postImmediately: false,
      lines: [
        { accountCode: "601100", label: "Charge", debit: "15000", credit: 0 },
        { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "15000", thirdPartyCode: "FOU002" }
      ]
    });

    const storage = new IndexedDbStorage(() => createDemoState(DEMO_ORGANIZATION_ID, DEMO_FISCAL_YEAR_ID));
    const persisted = await storage.read();
    const stored = persisted.entries.find((entry) => entry.reference === "OD-2026-009");

    expect(stored?.number).toBe("OD-2026-0002");
    expect(stored?.lines[1]?.thirdPartyCode).toBe("FOU002");
    expect(persisted.entrySequences.find((item) => item.journalCode === "OD")?.lastNumber).toBe(2);
  });

  it("refuse une ligne sur compte auxiliaire sans tiers et le signale en français", async () => {
    const kernel = getKernel();
    await expect(
      kernel.saveEntry({
        organizationId: DEMO_ORGANIZATION_ID,
        journalCode: "ACH",
        entryDate: "2026-03-02",
        reference: "FA-SANS-TIERS",
        postImmediately: false,
        lines: [
          { accountCode: "601100", label: "Achats", debit: "1000", credit: 0 },
          { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "1000" }
        ]
      })
    ).rejects.toThrow("qui exige un tiers");

    // Le refus ne consomme pas de numéro.
    expect(await kernel.peekEntryNumber("ACH", "2026-03-02")).toBe("ACH-2026-0002");
  });

  it("révise un brouillon, le trace et expose la piste d'audit à l'écran", async () => {
    const kernel = getKernel();
    const draft = await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "OD",
      entryDate: "2026-04-01",
      reference: "OD-2026-020",
      description: "Régularisation",
      postImmediately: false,
      lines: [
        { accountCode: "601100", label: "Charge", debit: "50000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "50000" }
      ]
    });

    const revised = await kernel.updateEntry(draft.id, {
      organizationId: DEMO_ORGANIZATION_ID,
      entryDate: "2026-04-01",
      reference: "OD-2026-020",
      description: "Régularisation corrigée",
      lines: [
        { accountCode: "601100", label: "Charge", debit: "62000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "62000" }
      ]
    });

    expect(revised.number).toBe(draft.number);
    expect(revised.totalDebit).toBe("62000");
    expect(revised.updatedAt).not.toBeNull();

    const trail = await kernel.getAuditLog({ entityId: draft.id });
    expect(trail.map((event) => event.actionLabel)).toEqual(["Brouillon modifié", "Pièce enregistrée en brouillon"]);
    expect(trail[0]?.details).toContain(draft.number);
  });

  it("crée un tiers depuis l'écran et le propose aux lignes suivantes", async () => {
    const kernel = getKernel();
    const created = await kernel.createThirdParty({
      organizationId: DEMO_ORGANIZATION_ID,
      name: "Quincaillerie de Treichville",
      type: "supplier"
    });
    expect(created.code).toBe("FOU003");

    const saved = await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "ACH",
      entryDate: "2026-05-04",
      reference: "FA-2026-077",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "90000", credit: 0 },
        { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "90000", thirdPartyCode: created.code }
      ]
    });
    expect(saved.lines[1]?.thirdPartyName).toBe("Quincaillerie de Treichville");

    const statement = await kernel.getThirdPartyStatement(created.code);
    expect(statement.lines).toHaveLength(1);
    expect(statement.closingBalance).toBe("-90000");
  });

  it("reprend une base écrite par la tranche 1 sans intervention de l'utilisateur", async () => {
    // Écrit directement en base un état au format tranche 1 (ni numéro, ni tiers).
    const legacy = serializeState(createDemoState(DEMO_ORGANIZATION_ID, DEMO_FISCAL_YEAR_ID));
    delete legacy.thirdParties;
    delete legacy.entrySequences;
    legacy.entries = legacy.entries.map((entry) => {
      const { number: _number, updatedAt: _updatedAt, ...rest } = entry;
      return {
        ...rest,
        lines: entry.lines.map(({ thirdPartyCode: _tier, ...line }) => line)
      };
    });
    await new IndexedDbStorage(() => createDemoState(DEMO_ORGANIZATION_ID, DEMO_FISCAL_YEAR_ID)).write(
      deserializeState(legacy)
    );

    const kernel = getKernel();
    const entries = await kernel.getEntries();

    expect(entries.map((entry) => entry.number).sort()).toEqual([
      "ACH-2026-0001",
      "BQ1-2026-0001",
      "OD-2026-0001",
      "VTE-2026-0001"
    ]);
    // Les tiers absents de l'ancienne base ne bloquent pas la lecture ; la saisie
    // suivante sur un compte auxiliaire exigera d'abord la création d'un tiers.
    expect(await kernel.getThirdParties()).toEqual([]);
    await expect(
      kernel.saveEntry({
        organizationId: DEMO_ORGANIZATION_ID,
        journalCode: "ACH",
        entryDate: "2026-06-01",
        reference: "FA-APRES-MIGRATION",
        postImmediately: false,
        lines: [
          { accountCode: "601100", label: "Achats", debit: "1000", credit: 0 },
          { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "1000" }
        ]
      })
    ).rejects.toThrow("qui exige un tiers");
  });
});
