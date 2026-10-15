import { beforeEach, describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, formatByteSize, shortFingerprint } from "@perfecto/domain";
import {
  AccountingKernel,
  InMemoryStorage,
  createDemoState,
  sha256Hex,
  type AttachmentBytesPort
} from "../src/index";

const ORG = "org-demo";
const FY = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");

/** Hôte de test : remplace le magasin IndexedDB `files` de la PWA. */
class MemoryFileStorage implements AttachmentBytesPort {
  readonly files = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  readonly deleted: string[] = [];

  async put(attachmentId: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    this.files.set(attachmentId, { bytes: new Uint8Array(bytes), mimeType });
  }

  async get(attachmentId: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
    return this.files.get(attachmentId) ?? null;
  }

  async delete(attachmentId: string): Promise<void> {
    this.deleted.push(attachmentId);
    this.files.delete(attachmentId);
  }
}

let files: MemoryFileStorage;
let kernel: AccountingKernel;

beforeEach(() => {
  files = new MemoryFileStorage();
  kernel = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FY)), {
    clock: () => NOW,
    actor: "superviseur",
    storageMode: "Mémoire · test",
    fileStorage: files
  });
});

function pdf(content = "Facture FA-2026-004 · 472 000 XOF"): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4\n${content}\n%%EOF`);
}

async function purchaseId(): Promise<string> {
  const entries = await kernel.getEntries();
  const found = entries.find((entry) => entry.number === "ACH-2026-0001");
  if (!found) {
    throw new Error("Pièce de démonstration introuvable");
  }
  return found.id;
}

describe("justificatifs rattachés avec empreinte", () => {
  it("hache le contenu, conserve les octets et trace le rattachement", async () => {
    const entryId = await purchaseId();
    const bytes = pdf();

    const attachment = await kernel.attachDocument(entryId, {
      organizationId: ORG,
      fileName: "  FA-2026-004.pdf  ",
      mimeType: " APPLICATION/PDF ",
      sizeBytes: bytes.byteLength,
      bytes,
      notes: "  Reçu par courriel du fournisseur  "
    });

    expect(attachment.sha256).toBe(await sha256Hex(bytes));
    expect(attachment.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(attachment.fileName).toBe("FA-2026-004.pdf");
    expect(attachment.mimeType).toBe("application/pdf");
    expect(attachment.sizeBytes).toBe(bytes.byteLength);
    expect(attachment.notes).toBe("Reçu par courriel du fournisseur");
    expect(attachment.entryId).toBe(entryId);
    expect(attachment.uploadedAt).toBe(NOW.toISOString());
    expect(attachment.uploadedBy).toBe("superviseur");

    // Les octets vivent chez l'hôte, jamais dans l'état sérialisable.
    const stored = files.files.get(attachment.id);
    expect(stored?.mimeType).toBe("application/pdf");
    expect(stored?.bytes).toEqual(bytes);

    const listed = await kernel.getAttachments(entryId);
    expect(listed.map((item) => item.id)).toEqual([attachment.id]);
    expect((await kernel.getEntry(entryId)).attachmentCount).toBe(1);
    expect((await kernel.getSnapshot()).attachmentCount).toBe(1);

    const events = await kernel.getAuditLog({ entityId: entryId });
    expect(events[0]?.actionLabel).toBe("Justificatif rattaché");
    expect(events[0]?.details).toBe(
      `ACH-2026-0001 · FA-2026-004.pdf · ${formatByteSize(bytes.byteLength)} · ${shortFingerprint(
        attachment.sha256
      )}`
    );
  });

  it("restitue le contenu octet pour octet", async () => {
    const entryId = await purchaseId();
    const bytes = pdf("Scan de la facture originale");
    const attachment = await kernel.attachDocument(entryId, {
      organizationId: ORG,
      fileName: "scan-facture.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes
    });

    const content = await kernel.getAttachmentContent(attachment.id);
    expect(content.attachment.fileName).toBe("scan-facture.pdf");
    expect(content.bytes).toEqual(bytes);
    expect(new TextDecoder().decode(content.bytes)).toContain("Scan de la facture originale");
  });

  it("accepte les images et les classeurs, refuse les exécutables", async () => {
    const entryId = await purchaseId();
    const image = new TextEncoder().encode("PNG-factice");

    const png = await kernel.attachDocument(entryId, {
      organizationId: ORG,
      fileName: "bon-livraison.png",
      mimeType: "image/png",
      sizeBytes: image.byteLength,
      bytes: image
    });
    expect(png.mimeType).toBe("image/png");

    await expect(
      kernel.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "installeur.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: image.byteLength,
        bytes: image
      })
    ).rejects.toThrow(/Type de fichier refusé/);
  });

  it("refuse doublon, taille incohérente, fichier vide et fichier trop volumineux", async () => {
    const entryId = await purchaseId();
    const bytes = pdf();

    await kernel.attachDocument(entryId, {
      organizationId: ORG,
      fileName: "FA-2026-004.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes
    });

    // Même contenu sous un autre nom : l'empreinte révèle le doublon.
    await expect(
      kernel.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "copie.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        bytes
      })
    ).rejects.toThrow(/Ce fichier est déjà rattaché à la pièce : FA-2026-004.pdf/);

    await expect(
      kernel.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "autre.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength + 10,
        bytes
      })
    ).rejects.toThrow("La taille déclarée ne correspond pas au contenu transmis.");

    await expect(
      kernel.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "vide.pdf",
        mimeType: "application/pdf",
        sizeBytes: 0,
        bytes: new Uint8Array(0)
      })
    ).rejects.toThrow("Le fichier est vide.");

    const oversized = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    await expect(
      kernel.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "archive-trop-lourde.pdf",
        mimeType: "application/pdf",
        sizeBytes: oversized.byteLength,
        bytes: oversized
      })
    ).rejects.toThrow(/Fichier trop volumineux/);

    // Aucun de ces refus n'a écrit d'octets supplémentaires.
    expect(files.files.size).toBe(1);
    expect((await kernel.getAttachments(entryId))).toHaveLength(1);
  });

  it("détache un justificatif : octets supprimés, compteur remis à zéro, acte tracé", async () => {
    const entryId = await purchaseId();
    const bytes = pdf();
    const attachment = await kernel.attachDocument(entryId, {
      organizationId: ORG,
      fileName: "FA-2026-004.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes
    });

    await kernel.removeAttachment(attachment.id);

    expect(files.files.has(attachment.id)).toBe(false);
    expect(files.deleted).toEqual([attachment.id]);
    expect(await kernel.getAttachments(entryId)).toHaveLength(0);
    expect((await kernel.getEntry(entryId)).attachmentCount).toBe(0);
    expect((await kernel.getSnapshot()).attachmentCount).toBe(0);
    expect((await kernel.getAuditLog({ entityId: entryId }))[0]?.actionLabel).toBe(
      "Justificatif détaché"
    );

    await expect(kernel.getAttachmentContent(attachment.id)).rejects.toThrow(
      "Le justificatif demandé n'existe pas."
    );
    await expect(kernel.removeAttachment(attachment.id)).rejects.toThrow(
      "Le justificatif demandé n'existe pas."
    );
  });

  it("rattache aussi à un brouillon : le scan précède la validation", async () => {
    const entries = await kernel.getEntries();
    const draft = entries.find((entry) => entry.status === "draft");
    if (!draft) {
      throw new Error("Brouillon de démonstration introuvable");
    }
    const bytes = pdf("Justificatif du brouillon");

    const attachment = await kernel.attachDocument(draft.id, {
      organizationId: ORG,
      fileName: "od-2026-001.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes
    });

    expect(attachment.entryId).toBe(draft.id);
    expect((await kernel.getEntry(draft.id)).attachmentCount).toBe(1);
  });

  it("refuse une pièce inconnue ou une autre organisation", async () => {
    const bytes = pdf();
    await expect(
      kernel.attachDocument("id-inconnu", {
        organizationId: ORG,
        fileName: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        bytes
      })
    ).rejects.toThrow("La pièce demandée n'existe pas.");

    const entryId = await purchaseId();
    await expect(
      kernel.attachDocument(entryId, {
        organizationId: "autre-org",
        fileName: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        bytes
      })
    ).rejects.toThrow("Cette opération ne concerne pas l'organisation de l'espace courant.");
  });

  it("refuse tout rattachement quand l'hôte n'a pas de stockage de fichiers", async () => {
    const hosteless = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FY)), {
      clock: () => NOW,
      actor: "superviseur",
      storageMode: "Mémoire · test"
    });
    const entries = await hosteless.getEntries();
    const entryId = entries.find((entry) => entry.number === "ACH-2026-0001")?.id ?? "";
    const bytes = pdf();

    await expect(
      hosteless.attachDocument(entryId, {
        organizationId: ORG,
        fileName: "FA-2026-004.pdf",
        mimeType: "application/pdf",
        sizeBytes: bytes.byteLength,
        bytes
      })
    ).rejects.toThrow("Aucun stockage de fichiers n'est disponible sur cet hôte");

    // Rien n'est enregistré : pas d'empreinte sans contenu conservé.
    expect((await hosteless.getSnapshot()).attachmentCount).toBe(0);
  });
});
