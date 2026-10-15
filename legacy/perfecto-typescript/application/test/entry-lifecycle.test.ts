import { beforeEach, describe, expect, it } from "vitest";
import type { CreateAccountingEntryRequest } from "@perfecto/contracts";
import { AccountingEntryStatus, DomainRuleError, civilDate } from "@perfecto/domain";
import { AccountingKernel, InMemoryStorage, createEmptyState } from "../src/index";

const ORG = "org-demo";
const FY = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");
const LATER = new Date("2026-03-02T11:30:00.000Z");
const AFTER = new Date("2026-03-03T09:15:00.000Z");

let clock = NOW;

/** Pièce équilibrée sur des comptes non auxiliaires : isole numérotation et révision. */
function request(reference: string, journalCode = "ACH"): CreateAccountingEntryRequest {
  return {
    organizationId: ORG,
    journalCode,
    entryDate: civilDate(2026, 3, 1),
    reference,
    description: "Facture fournisseur",
    postImmediately: false,
    lines: [
      { accountCode: "601100", label: "Achats de marchandises", debit: "250000", credit: 0 },
      { accountCode: "571100", label: "Règlement caisse", debit: 0, credit: "250000" }
    ]
  };
}

describe("numérotation automatique par journal et par exercice", () => {
  let kernel: AccountingKernel;

  beforeEach(() => {
    clock = NOW;
    kernel = new AccountingKernel(new InMemoryStorage(createEmptyState(ORG, FY)), {
      clock: () => clock,
      actor: "test",
      storageMode: "Mémoire · test"
    });
  });

  it("numérote chaque journal dans sa propre suite", async () => {
    const achat1 = await kernel.saveEntry(request("FA-001"));
    const achat2 = await kernel.saveEntry(request("FA-002"));
    const vente1 = await kernel.saveEntry(request("FV-001", "VTE"));

    expect(achat1.number).toBe("ACH-2026-0001");
    expect(achat2.number).toBe("ACH-2026-0002");
    expect(vente1.number).toBe("VTE-2026-0001");
  });

  it("annonce le numéro suivant sans le consommer", async () => {
    expect(await kernel.peekEntryNumber("ACH", civilDate(2026, 3, 1))).toBe("ACH-2026-0001");
    await kernel.saveEntry(request("FA-001"));
    expect(await kernel.peekEntryNumber("ACH", civilDate(2026, 3, 1))).toBe("ACH-2026-0002");

    const numbering = await kernel.getJournalNumbering();
    const achats = numbering.find((item) => item.journalCode === "ACH");
    expect(achats?.lastNumber).toBe(1);
    expect(achats?.nextNumber).toBe("ACH-2026-0002");
    expect(numbering.find((item) => item.journalCode === "OD")?.nextNumber).toBe("OD-2026-0001");
  });

  it("ne consomme aucun numéro quand la pièce est refusée (pas de trou)", async () => {
    const doublon = request("FA-DOUBLON");
    await kernel.saveEntry(doublon);
    await expect(kernel.saveEntry(request("FA-DOUBLON"))).rejects.toThrow(
      "Cette référence de pièce existe déjà."
    );

    const mauvaisCompte = request("FA-MAUVAIS");
    mauvaisCompte.lines[0]!.accountCode = "999999";
    await expect(kernel.saveEntry(mauvaisCompte)).rejects.toThrow("Le compte 999999 n'existe pas.");

    expect(await kernel.peekEntryNumber("ACH")).toBe("ACH-2026-0002");
    const entries = await kernel.getEntries();
    expect(entries).toHaveLength(1);
  });

  it("refuse de numéroter pour un journal inconnu", async () => {
    await expect(kernel.peekEntryNumber("ZZZ")).rejects.toThrow("Le journal sélectionné n'existe pas.");
  });

  it("suit l'année de la date de pièce", async () => {
    const fin2026 = request("FA-2026-100");
    const saved = await kernel.saveEntry(fin2026);
    expect(saved.number).toBe("ACH-2026-0001");
  });
});

describe("révision contrôlée des brouillons", () => {
  let kernel: AccountingKernel;

  beforeEach(() => {
    clock = NOW;
    kernel = new AccountingKernel(new InMemoryStorage(createEmptyState(ORG, FY)), {
      clock: () => clock,
      actor: "superviseur",
      storageMode: "Mémoire · test"
    });
  });

  it("modifie un brouillon en conservant son numéro et en horodatant la révision", async () => {
    const draft = await kernel.saveEntry(request("FA-001"));
    expect(draft.updatedAt).toBeNull();

    clock = LATER;
    const revised = await kernel.updateEntry(draft.id, {
      organizationId: ORG,
      entryDate: civilDate(2026, 3, 2),
      reference: "FA-001-CORRIGEE",
      description: "Facture corrigée",
      lines: [
        { accountCode: "601100", label: "Achats de marchandises", debit: "300000", credit: 0 },
        { accountCode: "571100", label: "Règlement caisse", debit: 0, credit: "300000" }
      ]
    });

    expect(revised.id).toBe(draft.id);
    expect(revised.number).toBe("ACH-2026-0001");
    expect(revised.reference).toBe("FA-001-CORRIGEE");
    expect(revised.entryDate).toBe("2026-03-02");
    expect(revised.totalDebit).toBe("300000");
    expect(revised.updatedAt).toBe(LATER.toISOString());
    expect(revised.status).toBe(AccountingEntryStatus.Draft);
  });

  it("révise puis valide dans la même transaction", async () => {
    const draft = await kernel.saveEntry(request("FA-002"));
    const posted = await kernel.updateEntry(draft.id, {
      organizationId: ORG,
      entryDate: civilDate(2026, 3, 1),
      reference: "FA-002",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "50000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "50000" }
      ]
    });

    expect(posted.status).toBe(AccountingEntryStatus.Posted);
    expect(posted.postedAt).not.toBeNull();
    expect((await kernel.getSnapshot()).postedEntryCount).toBe(1);
  });

  it("interdit toute modification d'une pièce validée", async () => {
    const posted = await kernel.saveEntry({ ...request("FA-003"), postImmediately: true });

    await expect(
      kernel.updateEntry(posted.id, {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-003",
        lines: [
          { accountCode: "601100", label: "Achats", debit: "1", credit: 0 },
          { accountCode: "571100", label: "Caisse", debit: 0, credit: "1" }
        ]
      })
    ).rejects.toThrow("Une pièce validée est immuable. Utilisez une extourne pour la corriger.");
  });

  it("refuse une révision qui reprend la référence d'une autre pièce", async () => {
    await kernel.saveEntry(request("FA-010"));
    const autre = await kernel.saveEntry(request("FA-011"));

    await expect(
      kernel.updateEntry(autre.id, {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-010",
        lines: autre.lines.map((line) => ({
          accountCode: line.accountCode,
          label: line.label,
          debit: line.debit,
          credit: line.credit
        }))
      })
    ).rejects.toThrow("Cette référence de pièce existe déjà.");
  });

  it("refuse la révision sur une période clôturée", async () => {
    const draft = await kernel.saveEntry(request("FA-020"));
    await kernel.setPeriodClosed(3, true);

    await expect(
      kernel.updateEntry(draft.id, {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 5),
        reference: "FA-020",
        lines: [
          { accountCode: "601100", label: "Achats", debit: "10", credit: 0 },
          { accountCode: "571100", label: "Caisse", debit: 0, credit: "10" }
        ]
      })
    ).rejects.toThrow("La période mars 2026 est clôturée.");
  });

  it("refuse une révision sans ligne et une pièce inconnue", async () => {
    const draft = await kernel.saveEntry(request("FA-030"));
    await expect(
      kernel.updateEntry(draft.id, {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-030",
        lines: []
      })
    ).rejects.toThrow("Une pièce doit contenir au moins une ligne.");

    await expect(
      kernel.updateEntry("inconnu", {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-X",
        lines: []
      })
    ).rejects.toThrow(DomainRuleError);
  });

  it("expose à l'écran la piste d'audit de la pièce, libellés compris", async () => {
    const draft = await kernel.saveEntry(request("FA-040"));
    clock = LATER;
    await kernel.updateEntry(draft.id, {
      organizationId: ORG,
      entryDate: civilDate(2026, 3, 1),
      reference: "FA-040-BIS",
      lines: [
        { accountCode: "601100", label: "Achats", debit: "90000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "90000" }
      ]
    });
    clock = AFTER;
    await kernel.postEntry(draft.id);

    const trail = await kernel.getAuditLog({ entityId: draft.id });
    expect(trail.map((event) => event.action)).toEqual([
      "accounting.entry.posted",
      "accounting.entry.updated",
      "accounting.entry.saved"
    ]);
    expect(trail[0]?.actionLabel).toBe("Pièce validée");
    expect(trail[1]?.actionLabel).toBe("Brouillon modifié");
    expect(trail[1]?.details).toContain("ACH-2026-0001");
    expect(trail.every((event) => event.actor === "superviseur")).toBe(true);
    expect(trail.map((event) => event.occurredAt)).toEqual([
      AFTER.toISOString(),
      LATER.toISOString(),
      NOW.toISOString()
    ]);

    const global = await kernel.getAuditLog({ limit: 2 });
    expect(global).toHaveLength(2);
  });

  it("ordonne la piste d'audit même quand tout se joue dans la même milliseconde", async () => {
    // Horloge figée : les trois événements portent exactement le même horodatage.
    clock = NOW;
    const draft = await kernel.saveEntry(request("FA-050"));
    await kernel.updateEntry(draft.id, {
      organizationId: ORG,
      entryDate: civilDate(2026, 3, 1),
      reference: "FA-050",
      lines: [
        { accountCode: "601100", label: "Achats", debit: "250000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "250000" }
      ]
    });
    await kernel.postEntry(draft.id);

    const trail = await kernel.getAuditLog({ entityId: draft.id });
    expect(trail.map((event) => event.occurredAt)).toEqual([NOW.toISOString(), NOW.toISOString(), NOW.toISOString()]);
    expect(trail.map((event) => event.actionLabel)).toEqual([
      "Pièce validée",
      "Brouillon modifié",
      "Pièce enregistrée en brouillon"
    ]);
    expect(trail.map((event) => event.sequence)).toEqual([3, 2, 1]);
  });
});
