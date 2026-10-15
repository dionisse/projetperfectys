import { beforeEach, describe, expect, it } from "vitest";
import { ReconciliationScope, civilDate } from "@perfecto/domain";
import { AccountingKernel, InMemoryStorage, createDemoState } from "../src/index";

const ORG = "org-demo";
const FY = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");

let kernel: AccountingKernel;

beforeEach(() => {
  kernel = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FY)), {
    clock: () => NOW,
    actor: "superviseur",
    storageMode: "Mémoire · test"
  });
});

/** Règlement fournisseur : solde la facture de démonstration FOU001 (472 000). */
async function paySupplier(): Promise<void> {
  await kernel.saveEntry({
    organizationId: ORG,
    journalCode: "BQ1",
    entryDate: civilDate(2026, 2, 10),
    reference: "BQ-2026-011",
    description: "Règlement fournisseur",
    postImmediately: true,
    lines: [
      { accountCode: "401100", label: "Fournisseur", debit: "472000", credit: 0, thirdPartyCode: "FOU001" },
      { accountCode: "521100", label: "Banque", debit: 0, credit: "472000" }
    ]
  });
}

describe("lettrage des comptes de tiers", () => {
  it("expose le lettrage de démonstration et le solde non lettré", async () => {
    const statement = await kernel.getThirdPartyStatement("CLI001");

    expect(statement.letteredLineCount).toBe(2);
    expect(statement.unletteredLineCount).toBe(0);
    expect(statement.unreconciledBalance).toBe("0");
    expect(statement.lines.map((line) => line.reconciliationLabel)).toEqual(["A", "A"]);
    expect(statement.reconciliations).toHaveLength(1);
    expect(statement.reconciliations[0]).toMatchObject({
      label: "A",
      scope: ReconciliationScope.ThirdParty,
      key: "CLI001",
      keyLabel: "Supermarché Cocody",
      totalDebit: "1180000",
      totalCredit: "1180000",
      comment: "Règlement bancaire de la facture FV-2026-001"
    });

    const all = await kernel.getReconciliations();
    expect(all).toHaveLength(1);
    expect((await kernel.getReconciliations("CLI001"))[0]?.id).toBe(statement.reconciliations[0]?.id);
    expect(await kernel.getReconciliations("FOU001")).toHaveLength(0);
  });

  it("lettre une facture et son règlement, puis libère la lettre à l'annulation", async () => {
    const unpaid = await kernel.getThirdPartyStatement("FOU001");
    expect(unpaid.lines).toHaveLength(1);
    expect(unpaid.unletteredLineCount).toBe(1);
    expect(unpaid.unreconciledBalance).toBe("-472000");

    // Un seul mouvement : rien à rapprocher.
    await expect(
      kernel.reconcileThirdParty({
        organizationId: ORG,
        thirdPartyCode: "FOU001",
        lineIds: unpaid.lines.map((line) => line.lineId)
      })
    ).rejects.toThrow("Un lettrage doit rapprocher au moins deux mouvements.");

    await paySupplier();
    const statement = await kernel.getThirdPartyStatement("FOU001");
    expect(statement.lines).toHaveLength(2);
    expect(statement.unreconciledBalance).toBe("0");
    expect(statement.unletteredLineCount).toBe(2);

    const lettered = await kernel.reconcileThirdParty({
      organizationId: ORG,
      thirdPartyCode: "FOU001",
      lineIds: statement.lines.map((line) => line.lineId),
      comment: "Règlement bancaire du 10/02/2026"
    });
    expect(lettered.label).toBe("A");
    expect(lettered.key).toBe("FOU001");
    expect(lettered.keyLabel).toBe("Grossiste Abidjan Nord");
    expect(lettered.lineIds).toHaveLength(2);
    expect(lettered.totalDebit).toBe("472000");
    expect(lettered.createdBy).toBe("superviseur");

    const after = await kernel.getThirdPartyStatement("FOU001");
    expect(after.letteredLineCount).toBe(2);
    expect(after.unletteredLineCount).toBe(0);
    expect(after.lines.map((line) => line.reconciliationLabel)).toEqual(["A", "A"]);

    const events = await kernel.getAuditLog({ entityType: "ThirdParty" });
    expect(events.map((event) => event.actionLabel)).toContain("Lettrage créé");
    expect(events[0]?.details).toContain("Lettre A · 2 mouvement(s)");

    // Annulation : les mouvements redeviennent disponibles, la lettre est libérée.
    await kernel.cancelReconciliation(lettered.id);
    const cancelled = await kernel.getThirdPartyStatement("FOU001");
    expect(cancelled.reconciliations).toHaveLength(0);
    expect(cancelled.letteredLineCount).toBe(0);
    expect(cancelled.unletteredLineCount).toBe(2);
    expect((await kernel.getAuditLog({ entityType: "ThirdParty" }))[0]?.actionLabel).toBe(
      "Lettrage annulé"
    );

    const again = await kernel.reconcileThirdParty({
      organizationId: ORG,
      thirdPartyCode: "FOU001",
      lineIds: cancelled.lines.map((line) => line.lineId)
    });
    expect(again.label).toBe("A");
  });

  it("enchaîne les lettres A, B, AA sans réutiliser une lettre active", async () => {
    await paySupplier();
    const first = await kernel.getThirdPartyStatement("FOU001");
    const a = await kernel.reconcileThirdParty({
      organizationId: ORG,
      thirdPartyCode: "FOU001",
      lineIds: first.lines.map((line) => line.lineId)
    });

    // Nouvelle facture puis nouveau règlement : deuxième lettre pour le même tiers.
    await kernel.saveEntry({
      organizationId: ORG,
      journalCode: "ACH",
      entryDate: civilDate(2026, 2, 12),
      reference: "FA-2026-009",
      description: "Seconde livraison",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Achats", debit: "300000", credit: 0 },
        { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "300000", thirdPartyCode: "FOU001" }
      ]
    });
    await kernel.saveEntry({
      organizationId: ORG,
      journalCode: "BQ1",
      entryDate: civilDate(2026, 2, 18),
      reference: "BQ-2026-012",
      description: "Règlement seconde livraison",
      postImmediately: true,
      lines: [
        { accountCode: "401100", label: "Fournisseur", debit: "300000", credit: 0, thirdPartyCode: "FOU001" },
        { accountCode: "521100", label: "Banque", debit: 0, credit: "300000" }
      ]
    });

    const statement = await kernel.getThirdPartyStatement("FOU001");
    const free = statement.lines.filter((line) => line.reconciliationLabel === null);
    expect(free).toHaveLength(2);

    const b = await kernel.reconcileThirdParty({
      organizationId: ORG,
      thirdPartyCode: "FOU001",
      lineIds: free.map((line) => line.lineId)
    });
    expect(b.label).toBe("B");

    expect((await kernel.getReconciliations("FOU001")).map((item) => item.label).sort()).toEqual([
      "A",
      "B"
    ]);
    expect(a.id).not.toBe(b.id);
  });

  it("refuse un lettrage déséquilibré, un mouvement d'un autre tiers ou un brouillon", async () => {
    await paySupplier();
    const supplier = await kernel.getThirdPartyStatement("FOU001");
    const customer = await kernel.getThirdPartyStatement("CLI001");

    // Sélection déséquilibrée : la facture seule face au règlement partiel.
    await kernel.saveEntry({
      organizationId: ORG,
      journalCode: "BQ1",
      entryDate: civilDate(2026, 2, 20),
      reference: "BQ-2026-013",
      description: "Acompte partiel",
      postImmediately: true,
      lines: [
        { accountCode: "401100", label: "Fournisseur", debit: "100000", credit: 0, thirdPartyCode: "FOU001" },
        { accountCode: "521100", label: "Banque", debit: 0, credit: "100000" }
      ]
    });
    const partial = await kernel.getThirdPartyStatement("FOU001");
    const invoice = partial.lines.find((line) => line.credit === "472000");
    const acompte = partial.lines.find((line) => line.debit === "100000" && line.reference === "BQ-2026-013");
    await expect(
      kernel.reconcileThirdParty({
        organizationId: ORG,
        thirdPartyCode: "FOU001",
        lineIds: [invoice?.lineId ?? "", acompte?.lineId ?? ""]
      })
    ).rejects.toThrow(/Lettrage déséquilibré/);

    // Un mouvement d'un autre tiers n'est pas dans le relevé du tiers demandé.
    await expect(
      kernel.reconcileThirdParty({
        organizationId: ORG,
        thirdPartyCode: "FOU001",
        lineIds: [supplier.lines[0]?.lineId ?? "", customer.lines[0]?.lineId ?? ""]
      })
    ).rejects.toThrow("Le mouvement sélectionné n'appartient pas au relevé comptabilisé de ce tiers.");

    // Les brouillons ne sont pas lettrables : FOU002 n'a qu'une pièce non validée.
    const draftOnly = await kernel.getThirdPartyStatement("FOU002");
    expect(draftOnly.lines).toHaveLength(0);
    expect(draftOnly.unletteredLineCount).toBe(0);

    // Un mouvement déjà lettré ne peut pas l'être deux fois : CLI001 porte la lettre A.
    await expect(
      kernel.reconcileThirdParty({
        organizationId: ORG,
        thirdPartyCode: "CLI001",
        lineIds: customer.lines.map((line) => line.lineId)
      })
    ).rejects.toThrow(/déjà lettré \(lettre A\)/);

    await expect(kernel.cancelReconciliation("lettrage-inconnu")).rejects.toThrow(
      "Le lettrage demandé n'existe pas."
    );
    await expect(
      kernel.reconcileThirdParty({
        organizationId: "autre-org",
        thirdPartyCode: "CLI001",
        lineIds: customer.lines.map((line) => line.lineId)
      })
    ).rejects.toThrow("Cette opération ne concerne pas l'organisation de l'espace courant.");
    await expect(
      kernel.reconcileThirdParty({ organizationId: ORG, thirdPartyCode: "FOU999", lineIds: ["x", "y"] })
    ).rejects.toThrow("Le tiers FOU999 n'existe pas dans le fichier des tiers.");
  });
});
