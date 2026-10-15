/**
 * Éditions et exports côté noyau : le contenu des documents, leurs règles et l'identité
 * de la société qui les signe. Les moteurs de rendu (`@perfecto/exports`) sont testés à
 * part ; ce qui est vérifié ici, c'est que le noyau produit **le bon document**.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { DocumentKind, ExportDocument, ExportDocumentRequest } from "@perfecto/contracts";
import {
  amountFromDecimal,
  civilDate,
  emptyOrganizationProfile,
  formatTimestampFr
} from "@perfecto/domain";
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

function request(kind: DocumentKind, extra: Partial<ExportDocumentRequest> = {}): ExportDocumentRequest {
  return { organizationId: ORG, kind, ...extra };
}

function field(document: ExportDocument, label: string): string {
  return document.fields.find((item) => item.label === label)?.text ?? "";
}

/** Toutes les éditions disponibles, avec les paramètres qu'elles exigent. */
const ALL_DOCUMENTS: [string, ExportDocumentRequest][] = [
  ["journal général", request("journal")],
  ["journal ACH", request("journal", { journalCode: "ACH" })],
  ["grand livre général", request("general-ledger")],
  ["grand livre 411100", request("general-ledger", { accountCode: "411100" })],
  ["balance générale", request("trial-balance")],
  ["plan comptable", request("chart-of-accounts")],
  ["fichier des tiers", request("third-parties")],
  ["piste d'audit", request("audit-trail")],
  ["piste d'audit filtrée", request("audit-trail", { entityType: "AccountingEntry", limit: 3 })]
];

describe("modèle neutre de document (garanties structurelles)", () => {
  it.each(ALL_DOCUMENTS)("construit l'édition %s dans les règles", async (_label, item) => {
    const document = await kernel.getExportDocument(item);

    expect(document.kind).toBe(item.kind);
    expect(document.title.length).toBeGreaterThan(3);
    expect(document.organization.name).toBe("PERFECTO Négoce Abidjan");
    expect(document.organizationId).toBe(ORG);
    expect(document.fiscalYear).toBe("Exercice 2026");
    expect(document.currency).toBe("XOF");
    expect(document.generatedAt).toBe(NOW.toISOString());
    expect(document.generatedBy).toBe("superviseur");
    expect(document.slug.startsWith("PERFECTO_")).toBe(true);
    expect(document.slug.endsWith("2026-03-01")).toBe(true);
    expect(document.footer).toContain("montants en XOF");
    expect(document.footer).toContain("IFU CI-2024-B-1187");
    expect(document.footer).toContain("par superviseur");
    expect(document.columns.length).toBeGreaterThan(2);

    // Chaque ligne porte exactement une cellule par colonne : aucun rendu ne peut
    // se retrouver avec un tableau boiteux.
    for (const row of [...document.rows, ...(document.totals ? [document.totals] : [])]) {
      expect(row.cells).toHaveLength(document.columns.length);
    }

    // Aucune espace insécable : ces caractères invisibles cassent les comparaisons de
    // chaînes et ne sont pas contenus par les polices PDF standard. Le tiret cadratin
    // (« ACH — Journal des achats ») est admis : le rendu PDF le normalise en trait
    // d'union, et le CSV/Excel en UTF-8 le conservent tel quel.
    expect(JSON.stringify(document)).not.toMatch(/[\u202F\u00A0\u2009]/);
  });

  it("refuse un document inconnu et une autre organisation", async () => {
    await expect(kernel.getExportDocument(request("bilan" as DocumentKind))).rejects.toThrow(
      "Document inconnu : « bilan »"
    );
    await expect(kernel.getExportDocument(request("bilan" as DocumentKind))).rejects.toThrow(
      "Documents disponibles : Journal des écritures"
    );
    await expect(
      kernel.getExportDocument({ ...request("trial-balance"), organizationId: "autre-org" })
    ).rejects.toThrow("Cette opération ne concerne pas l'organisation de l'espace courant.");
  });

  it("double chaque montant d'une valeur numérique exacte", async () => {
    const document = await kernel.getExportDocument(request("trial-balance"));
    const debitColumn = document.columns.findIndex((column) => column.key === "debitMovements");
    const creditColumn = document.columns.findIndex((column) => column.key === "creditMovements");
    const purchases = document.rows.find((row) => row.cells[0]?.text === "601100");
    const suppliers = document.rows.find((row) => row.cells[0]?.text === "401100");

    // Le texte est français, la valeur est le nombre exact qu'un tableur saura sommer.
    expect(purchases?.cells[debitColumn]).toEqual({ text: "400 000", value: 400000 });
    expect(suppliers?.cells[creditColumn]).toEqual({ text: "472 000", value: 472000 });
    expect(suppliers?.cells[debitColumn]).toEqual({ text: "0", value: 0 });
    expect(amountFromDecimal(String(suppliers?.cells[creditColumn]?.value ?? 0))).toBe(
      amountFromDecimal("472000")
    );
  });
});

describe("journal des écritures", () => {
  it("liste les imputations des pièces validées et totalise à l'équilibre", async () => {
    const document = await kernel.getExportDocument(request("journal"));

    // Trois pièces validées de démonstration : 3 + 3 + 2 imputations. Le brouillon OD
    // n'alimente aucun état.
    expect(document.rows).toHaveLength(8);
    expect(field(document, "Pièces")).toBe("3 pièces");
    expect(field(document, "Lignes")).toBe("8 imputations");
    expect(field(document, "Période")).toBe("Du 01/01/2026 au 31/12/2026");
    expect(document.title).toBe("Journal des écritures");
    expect(document.totals?.cells[8]?.value).toBe(2832000);
    expect(document.totals?.cells[9]?.value).toBe(2832000);
    expect(document.slug).toBe("PERFECTO_journal_2026-03-01");
  });

  it("filtre par journal et par période", async () => {
    const purchases = await kernel.getExportDocument(request("journal", { journalCode: "ACH" }));
    expect(purchases.rows).toHaveLength(3);
    expect(purchases.title).toBe("Journal ACH");
    expect(field(purchases, "Journal")).toBe("ACH — Journal des achats");
    expect(purchases.slug).toBe("PERFECTO_journal_ACH_2026-03-01");

    const february = await kernel.getExportDocument(
      request("journal", { from: "2026-02-01", to: "2026-02-28" })
    );
    // Février 2026 ne contient que le brouillon OD : aucun état ne le reprend.
    expect(february.rows).toHaveLength(0);
    expect(february.subtitle).toContain("Du 01/02/2026 au 28/02/2026");

    await expect(kernel.getExportDocument(request("journal", { journalCode: "XXX" }))).rejects.toThrow(
      "Le journal sélectionné n'existe pas."
    );
  });

  it("conserve la pièce extournée et sa contre-passation : le journal reste équilibré", async () => {
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001");
    await kernel.reverseEntry(purchase!.id, {
      organizationId: ORG,
      reversalDate: civilDate(2026, 2, 20)
    });

    const document = await kernel.getExportDocument(request("journal", { journalCode: "ACH" }));
    const numbers = document.rows.map((row) => row.cells[1]?.text);

    expect(document.rows).toHaveLength(6);
    expect(numbers).toContain("ACH-2026-0001");
    expect(numbers).toContain("ACH-2026-0002");
    expect(document.totals?.cells[8]?.value).toBe(document.totals?.cells[9]?.value);
    expect(document.footer).toContain("leur somme");
    expect(document.footer).toContain("est nulle");
  });
});

describe("grand livre et balance", () => {
  it("groupe le grand livre par compte, avec soldes de section et totaux", async () => {
    const document = await kernel.getExportDocument(request("general-ledger"));
    const sections = document.rows.filter((row) => row.emphasis === "section");

    // Sept comptes mouvementés par les trois pièces de démonstration.
    expect(sections).toHaveLength(7);
    expect(sections[0]?.cells[0]?.text).toBe("401100");
    expect(sections[0]?.cells[1]?.text).toBe("Fournisseurs");
    expect(sections[0]?.cells[7]?.value).toBe(472000);
    // Les mouvements détaillés citent leur pièce.
    expect(document.rows.some((row) => row.cells[1]?.text === "ACH-2026-0001")).toBe(true);
    expect(document.totals?.cells[6]?.value).toBe(document.totals?.cells[7]?.value);
    expect(document.totals?.cells[6]?.value).toBe(2832000);
  });

  it("édite le grand livre d'un seul compte", async () => {
    const document = await kernel.getExportDocument(
      request("general-ledger", { accountCode: "411100" })
    );
    const sections = document.rows.filter((row) => row.emphasis === "section");

    expect(document.title).toBe("Grand livre du compte 411100");
    expect(field(document, "Compte")).toBe("411100 — Clients");
    expect(sections).toHaveLength(1);
    expect(sections[0]?.cells[0]?.text).toBe("411100");
    // Le client : 1 180 000 facturé puis encaissé, solde de clôture nul.
    expect(sections[0]?.cells[8]?.text).toBe("0");
    expect(document.slug).toBe("PERFECTO_general-ledger_411100_2026-03-01");

    await expect(
      kernel.getExportDocument(request("general-ledger", { accountCode: "999999" }))
    ).rejects.toThrow("Le compte 999999 n'existe pas.");
  });

  it("arrête la balance à la date demandée et prouve l'équilibre", async () => {
    const document = await kernel.getExportDocument(request("trial-balance", { to: "2026-01-31" }));

    expect(document.title).toBe("Balance générale");
    expect(document.subtitle).toBe("Arrêtée au 31/01/2026");
    expect(field(document, "Équilibre")).toBe("Débit = crédit");
    expect(field(document, "Comptes")).toBe("7 comptes mouvementés");
    expect(document.rows).toHaveLength(7);
    expect(document.rows.map((row) => row.cells[0]?.text)).toContain("601100");
    expect(document.totals?.cells[3]?.value).toBe(2832000);
    expect(document.totals?.cells[4]?.value).toBe(2832000);
    // Soldes débiteurs = soldes créditeurs.
    expect(document.totals?.cells[5]?.value).toBe(document.totals?.cells[6]?.value);
    expect(document.footer).toContain("La balance est équilibrée");
    expect(document.slug).toBe("PERFECTO_trial-balance_2026-01-31_2026-03-01");
  });
});

describe("pièce comptable", () => {
  it("édite une pièce avec son identité, ses lignes et ses justificatifs", async () => {
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001")!;
    const document = await kernel.getExportDocument(request("entry", { entryId: purchase.id }));

    expect(document.title).toBe("Pièce comptable ACH-2026-0001");
    expect(document.subtitle).toContain("FA-2026-004");
    expect(field(document, "Journal")).toBe("ACH — Journal des achats");
    expect(field(document, "Date")).toBe("12/01/2026");
    expect(field(document, "Statut")).toBe("Validée");
    expect(field(document, "Lignes")).toBe("3 imputations");
    expect(field(document, "Justificatifs")).toBe("Aucun justificatif rattaché");
    expect(document.rows).toHaveLength(3);
    expect(document.totals?.cells[4]?.value).toBe(472000);
    expect(document.totals?.cells[5]?.value).toBe(472000);
    expect(document.footer).toContain("toute correction passe par une contre-passation");
    expect(document.slug).toBe("PERFECTO_piece_ACH-2026-0001_2026-03-01");
  });

  it("nomme le tiers de chaque ligne auxiliaire", async () => {
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001")!;
    const document = await kernel.getExportDocument(request("entry", { entryId: purchase.id }));
    const supplierLine = document.rows.find((row) => row.cells[0]?.text === "401100");

    expect(supplierLine?.cells[3]?.text).toBe("FOU001 — Grossiste Abidjan Nord");
  });

  it("mentionne le justificatif, sa taille et son empreinte raccourcie", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 facture FA-2026-004");
    const storage = new Map<string, { bytes: Uint8Array; mimeType: string }>();
    const withFiles = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FY)), {
      clock: () => NOW,
      actor: "superviseur",
      fileStorage: {
        async put(id, content, mimeType) {
          storage.set(id, { bytes: content, mimeType });
        },
        async get(id) {
          return storage.get(id) ?? null;
        },
        async delete(id) {
          storage.delete(id);
        }
      }
    });
    // Autre noyau, autre état : la pièce est relue ici, pas depuis l'autre instance.
    const hosted = await withFiles.getEntries();
    const purchase = hosted.find((entry) => entry.number === "ACH-2026-0001")!;

    const attachment = await withFiles.attachDocument(purchase.id, {
      organizationId: ORG,
      fileName: "FA-2026-004.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.byteLength,
      bytes
    });

    const document = await withFiles.getExportDocument(request("entry", { entryId: purchase.id }));
    const justificatifs = field(document, "Justificatifs");

    expect(justificatifs).toContain("FA-2026-004.pdf");
    expect(justificatifs).toContain(`${bytes.byteLength} octets`);
    expect(justificatifs).toContain(`sha256:${attachment.sha256.slice(0, 8)}…`);
  });

  it("relie la pièce extournée à sa contre-passation dans le document", async () => {
    const entries = await kernel.getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001")!;
    const result = await kernel.reverseEntry(purchase.id, {
      organizationId: ORG,
      reversalDate: civilDate(2026, 2, 20)
    });

    const original = await kernel.getExportDocument(request("entry", { entryId: purchase.id }));
    expect(field(original, "Statut")).toBe("Extournée");
    expect(field(original, "Extournée par")).toBe("ACH-2026-0002");
    expect(field(original, "Extourne du")).toBe("20/02/2026");
    expect(original.footer).toContain("sa contre-passation l'annule");

    const reversal = await kernel.getExportDocument(request("entry", { entryId: result.reversal.id }));
    expect(field(reversal, "Contre-passation de")).toBe("ACH-2026-0001");
    // Débits et crédits permutés : la première ligne créditait 400 000 au lieu de débiter.
    expect(reversal.rows[0]?.cells[4]?.text).toBe("0");
    expect(reversal.rows[0]?.cells[5]?.text).toBe("400 000");
    expect(field(reversal, "Statut")).toBe("Validée");
  });

  it("signale qu'un brouillon n'alimente aucun état", async () => {
    const entries = await kernel.getEntries();
    const draft = entries.find((entry) => entry.status === "draft")!;
    const document = await kernel.getExportDocument(request("entry", { entryId: draft.id }));

    expect(field(document, "Statut")).toBe("Brouillon");
    expect(document.footer).toContain("n'alimente ni le journal");
  });

  it("refuse une édition de pièce sans pièce", async () => {
    await expect(kernel.getExportDocument(request("entry"))).rejects.toThrow(
      "La pièce à éditer est obligatoire."
    );
    await expect(kernel.getExportDocument(request("entry", { entryId: "inconnue" }))).rejects.toThrow(
      "La pièce demandée n'existe pas."
    );
  });
});

describe("relevé auxiliaire, référentiels et piste d'audit", () => {
  it("édite le relevé d'un tiers avec ses lettres de rapprochement", async () => {
    const document = await kernel.getExportDocument(
      request("third-party-statement", { thirdPartyCode: "CLI001" })
    );

    expect(document.title).toBe("Relevé auxiliaire CLI001");
    expect(document.subtitle).toContain("Supermarché Cocody");
    expect(document.rows).toHaveLength(2);
    expect(document.rows.map((row) => row.cells[0]?.text)).toEqual(["A", "A"]);
    expect(field(document, "État")).toBe("Actif");
    expect(field(document, "Mouvements lettrés")).toBe("2 sur 2");
    expect(field(document, "Solde non lettré")).toBe("0");
    expect(field(document, "Lettrage A")).toContain("Règlement bancaire de la facture FV-2026-001");
    expect(field(document, "Lettrage A")).toContain("2 mouvements");
    expect(document.totals?.cells[9]?.text).toBe("0");
    expect(document.slug).toBe("PERFECTO_releve-tiers_CLI001_2026-03-01");
    expect(document.footer).toContain("Tous les mouvements du relevé sont lettrés");
  });

  it("signale le solde non lettré d'un tiers en suspens", async () => {
    const document = await kernel.getExportDocument(
      request("third-party-statement", { thirdPartyCode: "FOU001" })
    );

    expect(document.rows).toHaveLength(1);
    expect(field(document, "Solde non lettré")).toBe("-472 000");
    expect(field(document, "Mouvements lettrés")).toBe("0 sur 1");
    expect(field(document, "Type")).toBe("Fournisseur");
    expect(document.footer).toContain("reste à rapprocher ou à relancer");
  });

  it("refuse un relevé sans tiers ou sur un tiers inconnu", async () => {
    await expect(kernel.getExportDocument(request("third-party-statement"))).rejects.toThrow(
      "Le tiers à éditer est obligatoire."
    );
    await expect(
      kernel.getExportDocument(request("third-party-statement", { thirdPartyCode: "FOU999" }))
    ).rejects.toThrow("Le tiers FOU999 n'existe pas.");
  });

  it("édite le plan comptable et le fichier des tiers", async () => {
    const chart = await kernel.getExportDocument(request("chart-of-accounts"));
    expect(chart.rows).toHaveLength(18);
    expect(chart.rows[0]?.cells[0]?.text).toBe("101000");
    expect(field(chart, "Comptes")).toBe("18 comptes");
    expect(field(chart, "Comptes auxiliaires")).toBe("2");
    const auxiliary = chart.rows.find((row) => row.cells[0]?.text === "401100");
    expect(auxiliary?.cells[5]?.text).toBe("Oui");
    expect(auxiliary?.cells[4]?.text).toBe("Oui");
    expect(chart.slug).toBe("PERFECTO_plan-comptable_2026-03-01");

    const parties = await kernel.getExportDocument(request("third-parties"));
    expect(parties.rows).toHaveLength(6);
    expect(field(parties, "Fiches")).toBe("6 fiches");
    expect(field(parties, "Fiches actives")).toBe("6");
    expect(field(parties, "Fiches désactivées")).toBe("0");
    const supplier = parties.rows.find((row) => row.cells[0]?.text === "FOU001");
    expect(supplier?.cells[2]?.text).toBe("Fournisseur");
    expect(supplier?.cells[7]?.text).toBe("Actif");
    expect(supplier?.cells[9]?.text).toBe("-472 000");
    expect(parties.slug).toBe("PERFECTO_fichier-tiers_2026-03-01");
  });

  it("édite la piste d'audit avec les libellés français et ses filtres", async () => {
    // Le jeu de démonstration n'amorce aucun événement : l'audit ne ment jamais.
    const pristine = await kernel.getExportDocument(request("audit-trail"));
    expect(pristine.rows).toHaveLength(0);
    expect(field(pristine, "Événements")).toBe("0 événement");

    await kernel.setPeriodClosed(5, true);
    await kernel.setThirdPartyActive("FOU002", false);

    const all = await kernel.getExportDocument(request("audit-trail"));
    expect(all.rows).toHaveLength(2);
    expect(all.rows[0]?.cells[0]?.text).toBe("1");
    expect(all.rows[0]?.cells[2]?.text).toBe("superviseur");
    expect(all.rows[0]?.cells[3]?.text).toBe("Période clôturée (accounting.period.closed)");
    expect(all.rows[0]?.cells[4]?.text).toBe("AccountingPeriod");
    expect(all.rows[0]?.cells[1]?.value).toBe(NOW.toISOString());
    expect(all.rows[0]?.cells[1]?.text).toBe(formatTimestampFr(NOW.toISOString()));
    expect(field(all, "Acteurs")).toBe("superviseur");

    const filtered = await kernel.getExportDocument(
      request("audit-trail", { entityType: "ThirdParty" })
    );
    expect(filtered.rows).toHaveLength(1);
    expect(filtered.rows[0]?.cells[3]?.text).toBe(
      "Tiers désactivé (accounting.thirdparty.deactivated)"
    );
    expect(filtered.slug).toBe("PERFECTO_piste-audit_ThirdParty_2026-03-01");

    const limited = await kernel.getExportDocument(request("audit-trail", { limit: 1 }));
    expect(limited.rows).toHaveLength(1);
    // Le filtre conserve le dernier événement, donc le rang le plus élevé.
    expect(limited.rows[0]?.cells[0]?.text).toBe("2");
  });
});

describe("identité de la société", () => {
  it("expose le profil de démonstration et l'imprime sur les documents", async () => {
    const organization = await kernel.getOrganization();

    expect(organization.name).toBe("PERFECTO Négoce Abidjan");
    expect(organization.legalForm).toBe("SARL");
    expect(organization.taxIdentifier).toBe("CI-2024-B-1187");
    expect(organization.city).toBe("Abidjan");
    expect(organization.country).toBe("Côte d'Ivoire");
    expect(organization.email).toBe("compta@perfecto-negoce.ci");

    const document = await kernel.getExportDocument(request("trial-balance"));
    expect(document.organization).toEqual(organization);
    expect(document.footer).toContain("IFU CI-2024-B-1187");
    expect(document.footer).toContain("Abidjan, Côte d'Ivoire");
  });

  it("met à jour l'identité, la normalise et la trace", async () => {
    const updated = await kernel.updateOrganization({
      organizationId: ORG,
      name: "  ivoire  négoce   ",
      taxIdentifier: " ci-2024-b-9999 ",
      city: "Yamoussoukro",
      email: " contact@ivoire-negoce.ci "
    });

    expect(updated.name).toBe("ivoire négoce");
    expect(updated.taxIdentifier).toBe("CI-2024-B-9999");
    expect(updated.city).toBe("Yamoussoukro");
    expect(updated.email).toBe("contact@ivoire-negoce.ci");
    // Les champs non fournis sont conservés.
    expect(updated.legalForm).toBe("SARL");
    expect(updated.country).toBe("Côte d'Ivoire");
    expect(updated.address).toContain("Boulevard Latrille");

    const events = await kernel.getAuditLog({ entityType: "Organization" });
    expect(events).toHaveLength(1);
    expect(events[0]?.actionLabel).toBe("Identité de la société mise à jour");
    expect(events[0]?.details).toBe(
      "PERFECTO Négoce Abidjan -> ivoire négoce · IFU CI-2024-B-9999"
    );

    const document = await kernel.getExportDocument(request("journal"));
    expect(document.organization.name).toBe("ivoire négoce");
    expect(document.footer).toContain("ivoire négoce");
  });

  it("refuse une raison sociale vide, un courriel invalide et une autre organisation", async () => {
    await expect(kernel.updateOrganization({ organizationId: ORG, name: "   " })).rejects.toThrow(
      "La raison sociale est obligatoire."
    );
    await expect(
      kernel.updateOrganization({ organizationId: ORG, email: "pas-un-courriel" })
    ).rejects.toThrow("Le courriel de la société n'a pas un format valide.");
    await expect(
      kernel.updateOrganization({ organizationId: ORG, name: "X".repeat(121) })
    ).rejects.toThrow("La raison sociale ne peut pas dépasser 120 caractères.");
    await expect(
      kernel.updateOrganization({ organizationId: "autre-org", name: "Ailleurs" })
    ).rejects.toThrow("Cette opération ne concerne pas l'organisation de l'espace courant.");

    // Rien n'a été écrit, et rien n'a été tracé.
    expect((await kernel.getOrganization()).name).toBe("PERFECTO Négoce Abidjan");
    expect(await kernel.getAuditLog({ entityType: "Organization" })).toHaveLength(0);
  });

  it("amorce un profil vide pour une base sans identité", async () => {
    const state = createDemoState(ORG, FY);
    state.organization = emptyOrganizationProfile();

    const kernelWithoutProfile = new AccountingKernel(new InMemoryStorage(state), {
      clock: () => NOW,
      actor: "superviseur"
    });
    expect((await kernelWithoutProfile.getOrganization()).name).toBe("Société sans nom");

    // Un document reste éditable : l'en-tête se réduit au nom, sans ligne vide.
    const document = await kernelWithoutProfile.getExportDocument(request("chart-of-accounts"));
    expect(document.organization.legalForm).toBe("");
    expect(document.footer).toContain("Société sans nom");
    expect(document.footer).not.toContain("IFU  ·");
  });
});
