import { describe, expect, it } from "vitest";
import {
  DomainRuleError,
  MAX_ATTACHMENT_BYTES,
  assertAttachmentSize,
  createAttachment,
  formatByteSize,
  normalizeMimeType,
  normalizeSha256,
  shortFingerprint
} from "../src/index";

const HASH = "9f3ab21cd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f";

describe("justificatifs à empreinte contrôlée", () => {
  it("valide et raccourcit une empreinte SHA-256", () => {
    expect(normalizeSha256(` ${HASH.toUpperCase()} `)).toBe(HASH);
    expect(shortFingerprint(HASH)).toBe("sha256:9f3ab21c…6d7e8f");
    expect(() => normalizeSha256("abc123")).toThrow(
      "Empreinte SHA-256 invalide : 64 caractères hexadécimaux attendus."
    );
  });

  it("accepte les familles de documents et refuse les exécutables", () => {
    expect(normalizeMimeType(" application/pdf ")).toBe("application/pdf");
    expect(normalizeMimeType("image/png")).toBe("image/png");
    expect(normalizeMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(() => normalizeMimeType("application/x-msdownload")).toThrow(/Type de fichier refusé/);
    expect(() => normalizeMimeType("")).toThrow(/Type de fichier refusé/);
  });

  it("borne la taille et refuse un fichier vide", () => {
    expect(assertAttachmentSize(2048)).toBe(2048);
    expect(assertAttachmentSize(MAX_ATTACHMENT_BYTES)).toBe(MAX_ATTACHMENT_BYTES);
    expect(() => assertAttachmentSize(0)).toThrow("Le fichier est vide.");
    expect(() => assertAttachmentSize(-5)).toThrow(DomainRuleError);
    expect(() => assertAttachmentSize(1.5)).toThrow(DomainRuleError);
    expect(() => assertAttachmentSize(MAX_ATTACHMENT_BYTES + 1)).toThrow(/Fichier trop volumineux/);
  });

  it("formate les tailles en français", () => {
    expect(formatByteSize(0)).toBe("0 o");
    expect(formatByteSize(900)).toBe("900 o");
    expect(formatByteSize(1024)).toBe("1 Ko");
    expect(formatByteSize(1536)).toBe("1,5 Ko");
    expect(formatByteSize(5 * 1024 * 1024)).toBe("5 Mo");
  });

  it("crée la métadonnée d'un justificatif en nettoyant le nom de fichier", () => {
    const attachment = createAttachment({
      organizationId: "org-1",
      entryId: "entry-1",
      fileName: "  factures/FA-2026-004.pdf  ",
      mimeType: "application/pdf",
      sizeBytes: 20480,
      sha256: HASH,
      notes: "  Reçu par courriel  ",
      uploadedAt: "2026-03-02T10:00:00.000Z",
      uploadedBy: "superviseur"
    });

    expect(attachment.fileName).toBe("factures-FA-2026-004.pdf");
    expect(attachment.notes).toBe("Reçu par courriel");
    expect(attachment.sha256).toBe(HASH);
    expect(attachment.uploadedAt).toBe("2026-03-02T10:00:00.000Z");
    expect(attachment.id.length).toBeGreaterThan(10);
  });

  it("refuse un rattachement sans pièce ni organisation", () => {
    expect(() =>
      createAttachment({
        organizationId: "org-1",
        entryId: "  ",
        fileName: "x.pdf",
        mimeType: "application/pdf",
        sizeBytes: 10,
        sha256: HASH,
        uploadedBy: "test"
      })
    ).toThrow("La pièce à laquelle rattacher le justificatif est obligatoire.");
  });
});
