import { beforeEach, describe, expect, it } from "vitest";
import type { CreateAccountingEntryRequest } from "@perfecto/contracts";
import { AccountingEntryStatus, civilDate } from "@perfecto/domain";
import {
  AccountingKernel,
  InMemoryStorage,
  createDemoState,
  createEmptyState,
  type AccountingState
} from "../src/index";

const ORG = "org-demo";
const FY = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");

function kernelOn(state: AccountingState): AccountingKernel {
  return new AccountingKernel(new InMemoryStorage(state), {
    clock: () => NOW,
    actor: "test",
    storageMode: "Mémoire · test"
  });
}

/** Facture d'achat : charge + fournisseur (compte auxiliaire 401100). */
function purchase(reference: string, thirdPartyCode?: string | null): CreateAccountingEntryRequest {
  return {
    organizationId: ORG,
    journalCode: "ACH",
    entryDate: civilDate(2026, 3, 1),
    reference,
    description: "Achat de marchandises",
    postImmediately: false,
    lines: [
      { accountCode: "601100", label: "Achats", debit: "200000", credit: 0 },
      thirdPartyCode === undefined
        ? { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "200000" }
        : { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "200000", thirdPartyCode }
    ]
  };
}

describe("fichier unique des tiers (noyau)", () => {
  let kernel: AccountingKernel;

  beforeEach(() => {
    kernel = kernelOn(createDemoState(ORG, FY));
  });

  it("expose les tiers de démonstration avec leur consommation", async () => {
    const tiers = await kernel.getThirdParties();
    expect(tiers.map((item) => item.code)).toEqual(["CLI001", "CLI002", "ETA001", "FOU001", "FOU002", "SAL001"]);

    const client = tiers.find((item) => item.code === "CLI001");
    expect(client?.postedLineCount).toBe(2);
    expect(client?.netBalance).toBe("0");

    const fournisseur = tiers.find((item) => item.code === "FOU001");
    expect(fournisseur?.totalCredit).toBe("472000");
    expect(fournisseur?.netBalance).toBe("-472000");
    expect((await kernel.getSnapshot()).thirdPartyCount).toBe(6);
  });

  it("recherche un tiers par code ou par nom", async () => {
    expect(await kernel.getThirdParties("sahel")).toHaveLength(1);
    expect((await kernel.getThirdParties("cli"))[0]?.code).toBe("CLI001");
    await expect(kernel.getThirdParty("INCONNU")).rejects.toThrow("Le tiers INCONNU n'existe pas.");
  });

  it("propose le code suivant du type à la création", async () => {
    const tier = await kernel.createThirdParty({
      organizationId: ORG,
      name: "Nouvelle Régie Ivoirienne",
      type: "supplier"
    });
    expect(tier.code).toBe("FOU003");
    expect(tier.isActive).toBe(true);

    const client = await kernel.createThirdParty({
      organizationId: ORG,
      name: "Boutique de Marcory",
      type: "customer",
      email: "contact@marcory.ci"
    });
    expect(client.code).toBe("CLI003");
  });

  it("refuse le doublon de code et garantit la fiche unique par nom + type", async () => {
    await expect(
      kernel.createThirdParty({ organizationId: ORG, code: "FOU001", name: "Autre fournisseur", type: "supplier" })
    ).rejects.toThrow("Ce code tiers existe déjà : Grossiste Abidjan Nord (FOU001).");

    // Même nom, casse et accents différents : c'est le même tiers.
    await expect(
      kernel.createThirdParty({
        organizationId: ORG,
        name: "  grossiste abidjan-nord ",
        type: "supplier"
      })
    ).rejects.toThrow(/fichier unique/);

    // Un même nom avec un autre type reste autorisé (client et fournisseur homonymes).
    await expect(
      kernel.createThirdParty({ organizationId: ORG, name: "Grossiste Abidjan Nord", type: "customer" })
    ).resolves.toMatchObject({ code: "CLI003" });
  });

  it("met à jour une fiche, verrouille le type dès qu'il est utilisé et trace l'audit", async () => {
    const revised = await kernel.updateThirdParty("FOU002", {
      organizationId: ORG,
      name: "Transports Sahel SARL",
      type: "supplier",
      phone: "+225 07 07 07 07"
    });
    expect(revised.phone).toBe("+225 07 07 07 07");
    expect(revised.code).toBe("FOU002");

    // FOU001 porte une ligne VALIDÉE : son type fait partie de l'histoire comptable.
    await expect(
      kernel.updateThirdParty("FOU001", { organizationId: ORG, name: "Grossiste Abidjan Nord", type: "customer" })
    ).rejects.toThrow(/ligne\(s\) validée\(s\)/);

    const audit = await kernel.getAuditLog({ entityType: "ThirdParty" });
    expect(audit.map((event) => event.action)).toContain("accounting.thirdparty.updated");
    expect(audit[0]?.actionLabel).toBe("Fiche tiers modifiée");
  });

  it("désactive sans supprimer, et refuse alors toute nouvelle imputation", async () => {
    const disabled = await kernel.setThirdPartyActive("FOU002", false);
    expect(disabled.isActive).toBe(false);

    await expect(kernel.saveEntry(purchase("FA-DESACTIVE", "FOU002"))).rejects.toThrow(
      "Le tiers Transports Sahel SARL (FOU002) est désactivé : réactivez-le ou choisissez un autre tiers."
    );

    await kernel.setThirdPartyActive("FOU002", true);
    await expect(kernel.saveEntry(purchase("FA-REACTIVE", "FOU002"))).resolves.toMatchObject({
      status: AccountingEntryStatus.Draft
    });

    const audit = await kernel.getAuditLog({ entityId: "FOU002" });
    // Horodatages identiques à l'horloge fixe : on vérifie le contenu, pas l'ordre.
    expect([...audit.map((event) => event.action)].sort()).toEqual([
      "accounting.thirdparty.deactivated",
      "accounting.thirdparty.reactivated"
    ]);
  });

  it("produit le relevé auxiliaire d'un tiers à partir des pièces validées", async () => {
    const statement = await kernel.getThirdPartyStatement("CLI001");
    expect(statement.thirdParty.name).toBe("Supermarché Cocody");
    expect(statement.lines).toHaveLength(2);
    expect(statement.lines[0]?.entryNumber).toBe("VTE-2026-0001");
    expect(statement.lines[1]?.runningBalance).toBe("0");
    expect(statement.totalDebit).toBe("1180000");
    expect(statement.totalCredit).toBe("1180000");
    expect(statement.closingBalance).toBe("0");

    // Le brouillon OD-2026-001 n'alimente pas le relevé de FOU002.
    const brouillon = await kernel.getThirdPartyStatement("FOU002");
    expect(brouillon.lines).toHaveLength(0);
    expect(brouillon.closingBalance).toBe("0");
  });
});

describe("contrôle effectif de requiresThirdParty", () => {
  it("refuse une ligne sur compte auxiliaire sans tiers, à la saisie", async () => {
    const kernel = kernelOn(createDemoState(ORG, FY));
    await expect(kernel.saveEntry(purchase("FA-SANS-TIERS"))).rejects.toThrow(
      "La ligne 2 impute le compte 401100 (Fournisseurs) qui exige un tiers. Sélectionnez un tiers pour cette ligne."
    );
    await expect(kernel.saveEntry(purchase("FA-TIERS-VIDE", null))).rejects.toThrow(/exige un tiers/);
  });

  it("refuse un tiers inexistant", async () => {
    const kernel = kernelOn(createDemoState(ORG, FY));
    await expect(kernel.saveEntry(purchase("FA-TIERS-INCONNU", "FOU999"))).rejects.toThrow(
      "Le tiers FOU999 n'existe pas dans le fichier des tiers."
    );
  });

  it("accepte le tiers et le conserve sur la ligne", async () => {
    const kernel = kernelOn(createDemoState(ORG, FY));
    const saved = await kernel.saveEntry(purchase("FA-OK", "FOU001"));
    expect(saved.lines[1]?.thirdPartyCode).toBe("FOU001");
    expect(saved.lines[1]?.thirdPartyName).toBe("Grossiste Abidjan Nord");
    expect(saved.lines[0]?.thirdPartyCode).toBeNull();
  });

  it("bloque la validation d'un brouillon hérité sans tiers (piste d'audit)", async () => {
    const state = createDemoState(ORG, FY);
    const draft = state.entries.find((entry) => entry.status === AccountingEntryStatus.Draft);
    expect(draft).toBeDefined();
    draft!.lines = draft!.lines.map((line) => ({ ...line, thirdPartyCode: null }));

    const kernel = kernelOn(state);
    await expect(kernel.postEntry(draft!.id)).rejects.toThrow(/exige un tiers/);
    expect((await kernel.getEntry(draft!.id)).status).toBe(AccountingEntryStatus.Draft);
  });

  it("interdit la révision d'un brouillon qui perdrait son tiers obligatoire", async () => {
    const kernel = kernelOn(createDemoState(ORG, FY));
    const draft = await kernel.saveEntry(purchase("FA-REVISION", "FOU001"));

    await expect(
      kernel.updateEntry(draft.id, {
        organizationId: ORG,
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-REVISION",
        lines: [
          { accountCode: "601100", label: "Achats", debit: "200000", credit: 0 },
          { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "200000" }
        ]
      })
    ).rejects.toThrow(/exige un tiers/);
  });

  it("n'exige aucun tiers quand l'état n'a pas de fichier tiers et que le compte est général", async () => {
    const kernel = kernelOn(createEmptyState(ORG, FY));
    const saved = await kernel.saveEntry({
      organizationId: ORG,
      journalCode: "OD",
      entryDate: civilDate(2026, 4, 1),
      reference: "OD-SANS-TIERS",
      postImmediately: true,
      lines: [
        { accountCode: "601100", label: "Charge", debit: "1000", credit: 0 },
        { accountCode: "571100", label: "Caisse", debit: 0, credit: "1000" }
      ]
    });
    expect(saved.status).toBe(AccountingEntryStatus.Posted);
    expect(saved.lines.every((line) => line.thirdPartyCode === null)).toBe(true);
  });
});
