/**
 * Intégration PWA de la tranche 3 : magasin IndexedDB `files` des justificatifs,
 * mise à niveau d'une base tranche 2 (v1 → v2), migration du codec et parcours
 * complet extourne + pièce jointe via le noyau câblé dans le navigateur.
 */

import { beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createDemoState } from "@perfecto/application";
import {
  DATABASE_NAME,
  IndexedDbFileStorage,
  IndexedDbStorage,
  deleteLocalDatabase
} from "../src/adapters/indexeddb-storage";
import { deserializeState, serializeState, type SerializedEntry } from "../src/adapters/state-codec";
import { DEMO_ORGANIZATION_ID, getKernel, resetDemoData } from "../src/kernel";

const ORG = "org-pwa";
const FY = "fy-pwa";

beforeEach(async () => {
  await deleteLocalDatabase();
});

function inspectDatabase(): Promise<{ version: number; stores: string[] }> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => {
      const db = request.result;
      const info = { version: db.version, stores: [...db.objectStoreNames] };
      db.close();
      resolve(info);
    };
    request.onerror = () => reject(request.error);
  });
}

function readRawState(): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction("state", "readonly").objectStore("state").get("accounting");
      get.onsuccess = () => {
        db.close();
        resolve(get.result);
      };
      get.onerror = () => {
        db.close();
        reject(get.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

/** Base telle que la tranche 2 l'écrivait : version 1, un seul magasin `state`. */
function writeLegacyV1(payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("state");
    };
    request.onsuccess = () => {
      const db = request.result;
      const put = db.transaction("state", "readwrite").objectStore("state").put(payload, "accounting");
      put.onsuccess = () => {
        db.close();
        resolve();
      };
      put.onerror = () => {
        db.close();
        reject(put.error);
      };
    };
    request.onerror = () => reject(request.error);
  });
}

/** État sérialisé « tranche 2 » : ni lettrage, ni justificatif, ni champ d'extourne. */
function tranche2Payload(): unknown {
  const raw = serializeState(createDemoState(ORG, FY));
  delete raw.reconciliations;
  delete raw.attachments;
  raw.entries = raw.entries.map((entry) => {
    const copy: SerializedEntry = { ...entry };
    delete copy.reversedAt;
    delete copy.reversalOfEntryId;
    delete copy.reversedByEntryId;
    return copy;
  });
  return raw;
}

describe("magasin des justificatifs (IndexedDB `files`)", () => {
  it("conserve les octets et le type MIME, et rend une copie indépendante", async () => {
    const files = new IndexedDbFileStorage();
    const bytes = new TextEncoder().encode("%PDF-1.4\nfacture scannée\n%%EOF");

    await files.put("att-1", bytes, "application/pdf");
    const stored = await files.get("att-1");
    expect(stored?.mimeType).toBe("application/pdf");
    expect(stored?.bytes).toEqual(bytes);

    // La copie rendue ne doit pas permettre de corrompre le magasin.
    stored?.bytes.fill(0);
    expect((await files.get("att-1"))?.bytes).toEqual(bytes);

    expect(await files.get("inconnu")).toBeNull();
    await files.delete("att-1");
    expect(await files.get("att-1")).toBeNull();
  });

  it("ouvre la base en version 2 avec les deux magasins", async () => {
    await new IndexedDbStorage(() => createDemoState(ORG, FY)).read();
    expect(await inspectDatabase()).toEqual({ version: 2, stores: ["files", "state"] });
  });

  it("met à niveau une base tranche 2 sans perdre l'état comptable", async () => {
    await writeLegacyV1(tranche2Payload());
    expect(await inspectDatabase()).toEqual({ version: 1, stores: ["state"] });

    const migrated = await new IndexedDbStorage(() => createDemoState(ORG, FY)).read();

    expect(await inspectDatabase()).toEqual({ version: 2, stores: ["files", "state"] });
    expect(migrated.entries.map((entry) => entry.number)).toEqual([
      "VTE-2026-0001",
      "ACH-2026-0001",
      "BQ1-2026-0001",
      "OD-2026-0001"
    ]);
    expect(migrated.reconciliations).toEqual([]);
    expect(migrated.attachments).toEqual([]);
    expect(migrated.entries[0]).toMatchObject({
      status: "posted",
      reversedAt: null,
      reversalOfEntryId: null,
      reversedByEntryId: null
    });

    // Le magasin des justificatifs est immédiatement utilisable après migration.
    await new IndexedDbFileStorage().put("att-migreee", new Uint8Array([1, 2, 3]), "image/png");
    expect((await new IndexedDbFileStorage().get("att-migreee"))?.bytes).toEqual(
      new Uint8Array([1, 2, 3])
    );
  });
});

describe("codec : lettrages et justificatifs", () => {
  it("écarte un lettrage dont une ligne a disparu", () => {
    const raw = serializeState(createDemoState(ORG, FY));
    const seeded = raw.reconciliations ?? [];
    expect(seeded).toHaveLength(1);

    // Les lignes rapprochées n'existent plus (brouillon révisé, pièce supprimée…).
    raw.reconciliations = [
      { ...seeded[0]!, lineIds: ["ligne-inconnue", "autre-ligne-inconnue"] }
    ];
    expect(deserializeState(raw).reconciliations).toEqual([]);
  });

  it("fait un aller-retour exact des lettrages, montants compris", () => {
    const state = createDemoState(ORG, FY);
    const back = deserializeState(serializeState(state));

    expect(back.reconciliations).toHaveLength(1);
    expect(back.reconciliations[0]?.label).toBe("A");
    expect(back.reconciliations[0]?.totalDebit).toBe(state.reconciliations[0]?.totalDebit);
    expect(back).toEqual(state);
  });

  it("reprend les justificatifs d'une base antérieure et complète une base sans eux", () => {
    const state = createDemoState(ORG, FY);
    const raw = serializeState(state);
    delete raw.attachments;
    expect(deserializeState(raw).attachments).toEqual([]);

    raw.attachments = [
      {
        id: "att-1",
        organizationId: ORG,
        entryId: state.entries[0]!.id,
        fileName: "facture.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        sha256: "a".repeat(64),
        notes: "",
        uploadedAt: "2026-03-01T08:00:00.000Z",
        uploadedBy: "superviseur"
      }
    ];
    expect(deserializeState(raw).attachments).toHaveLength(1);
  });
});

describe("parcours tranche 3 dans la PWA", () => {
  it("extourne une pièce validée et persiste les deux écritures", async () => {
    const kernel = getKernel();
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001");

    const result = await kernel.reverseEntry(purchase!.id, {
      organizationId: DEMO_ORGANIZATION_ID,
      reversalDate: "2026-06-30"
    });
    expect(result.reversal.number).toBe("ACH-2026-0002");
    expect(result.reversal.reference).toBe("EXT-FA-2026-004");
    expect(result.original.status).toBe("reversed");

    // Relecture depuis IndexedDB : l'extourne survit au rechargement de l'onglet.
    const reloaded = await new IndexedDbStorage(() => createDemoState(ORG, FY)).read();
    const stored = reloaded.entries.find((entry) => entry.number === "ACH-2026-0002");
    expect(stored?.status).toBe("posted");
    expect(stored?.reversalOfEntryId).toBe(purchase!.id);
    expect(
      reloaded.entries.find((entry) => entry.id === purchase!.id)?.reversedByEntryId
    ).toBe(stored?.id);
  });

  it("rattache un justificatif : empreinte dans l'état, octets dans `files`", async () => {
    const kernel = getKernel();
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001")!;
    const bytes = new TextEncoder().encode("%PDF-1.4\nFACTURE-ORIGINALE-FA-2026-004\n%%EOF");

    const attachment = await kernel.attachDocument(purchase.id, {
      organizationId: DEMO_ORGANIZATION_ID,
      fileName: "FA-2026-004.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes,
      notes: "Reçu du fournisseur"
    });
    expect(attachment.sha256).toMatch(/^[0-9a-f]{64}$/);

    const stored = await new IndexedDbFileStorage().get(attachment.id);
    expect(stored?.bytes).toEqual(bytes);
    expect(stored?.mimeType).toBe("application/pdf");

    // L'état comptable sérialisé ne contient jamais le binaire du justificatif.
    const serialized = JSON.stringify(await readRawState());
    expect(serialized).toContain("FA-2026-004.pdf");
    expect(serialized).toContain(attachment.sha256);
    expect(serialized).not.toContain("FACTURE-ORIGINALE-FA-2026-004");

    const content = await kernel.getAttachmentContent(attachment.id);
    expect(content.bytes).toEqual(bytes);
    expect((await kernel.getEntry(purchase.id)).attachmentCount).toBe(1);
    expect((await kernel.getSnapshot()).attachmentCount).toBe(1);

    // La réinitialisation de la démonstration purge aussi les octets.
    await resetDemoData();
    const reset = getKernel();
    expect((await reset.getSnapshot()).attachmentCount).toBe(0);
    expect(await new IndexedDbFileStorage().get(attachment.id)).toBeNull();
  });

  it("lettre le compte d'un tiers et relit les lettres après rechargement", async () => {
    const kernel = getKernel();
    const statement = await kernel.getThirdPartyStatement("CLI001");
    expect(statement.reconciliations[0]?.label).toBe("A");
    expect(statement.unreconciledBalance).toBe("0");

    await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "ACH",
      entryDate: "2026-04-05",
      reference: "FA-2026-021",
      description: "Achat réglé par compensation",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "120000", credit: 0 },
        {
          accountCode: "401100",
          label: "Fournisseur",
          debit: 0,
          credit: "120000",
          thirdPartyCode: "FOU001"
        }
      ]
    });
    await kernel.saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "BQ1",
      entryDate: "2026-04-20",
      reference: "BQ-2026-021",
      description: "Règlement fournisseur",
      postImmediately: true,
      lines: [
        {
          accountCode: "401100",
          label: "Fournisseur",
          debit: "120000",
          credit: 0,
          thirdPartyCode: "FOU001"
        },
        { accountCode: "521100", label: "Banque", debit: 0, credit: "120000" }
      ]
    });

    const supplier = await kernel.getThirdPartyStatement("FOU001");
    const free = supplier.lines.filter((line) => line.reconciliationLabel === null);
    // La facture de janvier (472 000) reste ouverte : on ne lettre que la paire d'avril.
    expect(free.map((line) => line.entryDate)).toEqual(["2026-01-12", "2026-04-05", "2026-04-20"]);
    const pair = free.filter((line) => line.entryDate.startsWith("2026-04"));
    expect(pair.map((line) => [line.debit, line.credit])).toEqual([
      ["0", "120000"],
      ["120000", "0"]
    ]);

    const lettered = await kernel.reconcileThirdParty({
      organizationId: DEMO_ORGANIZATION_ID,
      thirdPartyCode: "FOU001",
      lineIds: pair.map((line) => line.lineId),
      comment: "Compensation avril 2026"
    });
    expect(lettered.label).toBe("A");
    expect(lettered.totalDebit).toBe("120000");

    const reloaded = await new IndexedDbStorage(() => createDemoState(ORG, FY)).read();
    expect(reloaded.reconciliations.map((item) => item.key)).toContain("FOU001");
    const after = await getKernel().getThirdPartyStatement("FOU001");
    expect(after.letteredLineCount).toBe(2);
    expect(after.unletteredLineCount).toBe(1);
    expect(after.unreconciledBalance).toBe("-472000");

    await kernel.cancelReconciliation(lettered.id);
    expect((await kernel.getThirdPartyStatement("FOU001")).letteredLineCount).toBe(0);
  });
});
