// @vitest-environment jsdom
/**
 * Éditions et exports, de l'écran jusqu'au fichier.
 *
 * Ce qui est vérifié ici n'est pas la mise en page (testée dans `packages/exports`) mais
 * le contrat posé par la décision du 14/10/2026 : **chaque document est disponible en
 * PDF, en Excel et en CSV, et c'est l'utilisateur qui choisit**. On monte donc réellement
 * l'application, on clique sur les trois boutons, et on vérifie le fichier remis au
 * navigateur — nom, type MIME, contenu.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

// jsdom n'expose pas SubtleCrypto : le noyau hache les justificatifs avec WebCrypto.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
import { render } from "preact";
import { act } from "preact/test-utils";
import { DocumentKind } from "@perfecto/contracts";
import { App } from "../src/app";
import { describeFile, downloadFile, exportDocument } from "../src/downloads";
import { DEMO_ORGANIZATION_ID, getKernel, resetDemoData } from "../src/kernel";

let container: HTMLDivElement;

async function flush(times = 8): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function openRoute(hash: string): Promise<string> {
  location.hash = hash;
  await act(async () => {
    render(<App />, container);
  });
  await flush();
  return container.textContent ?? "";
}

/** Bouton d'export d'un format, repéré par son attribut `data-format`. */
function formatButton(format: string, within: ParentNode = container): HTMLButtonElement | undefined {
  return [...within.querySelectorAll<HTMLButtonElement>(`button[data-format="${format}"]`)].at(0);
}

/** Carte de document de la page Éditions. */
function editionCard(title: string): HTMLButtonElement {
  const card = [...container.querySelectorAll<HTMLButtonElement>(".edition-card")].find((item) =>
    item.textContent?.includes(title)
  );
  if (!card) throw new Error(`carte d'édition introuvable : ${title}`);
  return card;
}

async function click(element: HTMLElement, times = 10): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(times);
}

/**
 * Clique sur un format et attend le fichier : le PDF et l'Excel chargent leur moteur à la
 * demande, la barre désactive ses boutons pendant ce temps. Un nombre de ticks fixe ferait
 * cliquer des boutons encore occupés — on attend donc le téléchargement lui-même.
 */
async function clickFormat(format: string): Promise<void> {
  const before = downloads.length;
  const button = formatButton(format);
  if (!button) throw new Error(`bouton d'export absent : ${format}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  for (let tour = 0; tour < 60 && downloads.length === before; tour += 1) {
    await flush(2);
  }
  expect(downloads.length, `téléchargement ${format}`).toBe(before + 1);
}

/** Téléchargements interceptés : jsdom ne sait pas ouvrir un fichier. */
let downloads: { name: string; url: string; type: string }[] = [];

beforeAll(() => {
  // Un objet-URL factice, sinon jsdom lève « Not implemented ».
  Object.defineProperty(URL, "createObjectURL", {
    value: (blob: Blob) => `blob:perfecto/${blob.type || "fichier"}`,
    configurable: true
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download, url: this.href, type: this.rel });
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await resetDemoData();
  downloads = [];
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => {
    render(null, container);
  });
  container.remove();
});

describe("barre d'export : le format appartient à l'utilisateur", () => {
  it("propose les trois formats sur chaque écran qui affiche un document", async () => {
    const screens: [string, string][] = [
      ["#/comptabilite/balance", "Exporter la balance"],
      ["#/comptabilite/etats/journal", "Exporter le journal"],
      ["#/comptabilite/etats/grand-livre", "Exporter le grand livre"],
      ["#/comptabilite/plan", "Exporter le plan comptable"],
      ["#/comptabilite/audit", "Exporter la piste d'audit"],
      ["#/comptabilite/editions", "Balance générale"]
    ];

    for (const [hash, needle] of screens) {
      downloads = [];
      const text = await openRoute(hash);
      expect(text, hash).toContain(needle);
      for (const format of ["pdf", "excel", "csv"]) {
        expect(formatButton(format), `${hash} · ${format}`).toBeDefined();
      }
      // Infobulle : chaque format dit à quoi il sert.
      expect(formatButton("pdf")!.title).toContain("impression et archive");
      expect(formatButton("excel")!.title).toContain("calculable");
      expect(formatButton("csv")!.title).toContain("échange de données");
    }
  });

  it("remet au navigateur le fichier choisi, avec son nom et son type", async () => {
    await openRoute("#/comptabilite/balance");

    await clickFormat("pdf");
    await clickFormat("excel");
    await clickFormat("csv");

    expect(downloads).toHaveLength(3);
    const [pdf, excel, csv] = downloads;

    expect(pdf!.name).toMatch(/^PERFECTO_trial-balance_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(pdf!.url).toContain("application/pdf");
    expect(excel!.name).toMatch(/^PERFECTO_trial-balance_\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(excel!.url).toContain("spreadsheetml");
    expect(csv!.name).toMatch(/^PERFECTO_trial-balance_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(csv!.url).toContain("text/csv");

    // Le résultat est annoncé à l'écran : nom, format, poids.
    const message = container.querySelector(".export-message")?.textContent ?? "";
    expect(message).toMatch(
      /^PERFECTO_trial-balance_\d{4}-\d{2}-\d{2}\.csv · CSV · [\d,.]+ (o|Ko|Mo) téléchargé\.$/
    );
  });

  it("exporte le journal filtré depuis l'écran, avec le filtre choisi", async () => {
    await openRoute("#/comptabilite/etats/journal");

    const select = container.querySelector<HTMLSelectElement>(".inline-filter select");
    expect(select).not.toBeNull();
    await act(async () => {
      select!.value = "ACH";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    await clickFormat("csv");
    expect(downloads).toHaveLength(1);
    expect(downloads[0]!.name).toMatch(/^PERFECTO_journal_ACH_\d{4}-\d{2}-\d{2}\.csv$/);

    // Le fichier porte bien le périmètre choisi à l'écran.
    const file = await exportDocument(
      { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.journal, journalCode: "ACH" },
      "csv"
    );
    const text = new TextDecoder().decode(file.bytes);
    expect(text).toContain("ACH-2026-0001");
    expect(text).not.toContain("VTE-2026-0001");
    expect(text).toContain("PERFECTO Négoce Abidjan");
    expect(text).toContain("XOF");
    expect(file.sizeBytes).toBe(file.bytes.byteLength);
    expect(describeFile(file)).toContain("CSV");
  });

  it("construit les trois formats d'un même document avec le même contenu", async () => {
    const request = {
      organizationId: DEMO_ORGANIZATION_ID,
      kind: DocumentKind.trialBalance,
      to: "2026-01-31"
    };
    const [pdf, excel, csv] = await Promise.all([
      exportDocument(request, "pdf"),
      exportDocument(request, "excel"),
      exportDocument(request, "csv")
    ]);

    // Signatures réelles, pas seulement des noms de fichiers.
    expect([...pdf.bytes.slice(0, 5)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    expect([...excel.bytes.slice(0, 2)]).toEqual([0x50, 0x4b]); // ZIP = xlsx
    expect([...csv.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8

    const csvText = new TextDecoder().decode(csv.bytes);
    expect(csvText).toContain("Balance générale");
    expect(csvText).toContain("Arrêtée au 31/01/2026");
    // CSV : notation décimale française, sans séparateur de milliers — c'est un fichier
    // destiné à être relu par un tableur, pas imprimé.
    expect(csvText).toContain("2832000,00");
    expect(pdf.fileName).toBe(csv.fileName.replace(/\.csv$/, ".pdf"));
    expect(excel.fileName).toBe(csv.fileName.replace(/\.csv$/, ".xlsx"));
  });

  it("refuse un format hors contrat, en français", async () => {
    const request = { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.chartOfAccounts };
    await expect(exportDocument(request, "word" as never)).rejects.toThrow(
      "Format d'export inconnu : « word ». Formats acceptés : PDF, Excel, CSV."
    );
  });

  it("signale l'échec au lieu de laisser l'écran muet", async () => {
    await openRoute("#/comptabilite/balance");
    const kernel = getKernel();
    const spy = vi
      .spyOn(kernel, "getExportDocument")
      .mockRejectedValue(new Error("Base locale illisible."));

    await click(formatButton("pdf")!, 4);
    expect(container.querySelector(".export-failure")?.textContent).toBe("Base locale illisible.");
    expect(downloads).toHaveLength(0);

    spy.mockRestore();
  });

  it("décrit le fichier et ne télécharge rien sans objet-URL", async () => {
    const file = await exportDocument(
      { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.chartOfAccounts },
      "csv"
    );
    expect(describeFile(file)).toMatch(/^PERFECTO_plan-comptable_\d{4}-\d{2}-\d{2}\.csv · CSV · /);

    const createObjectURL = URL.createObjectURL;
    Object.defineProperty(URL, "createObjectURL", { value: undefined, configurable: true });
    downloads = [];
    expect(downloadFile(file)).toBe(false);
    expect(downloads).toHaveLength(0);
    Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });

    expect(downloadFile(file)).toBe(true);
    expect(downloads).toHaveLength(1);
  });
});

describe("page Éditions", () => {
  it("ouvre sur la balance et liste les huit documents du dossier", async () => {
    const text = await openRoute("#/comptabilite/editions");

    expect(text).toContain("Éditions et exports");
    expect(text).toContain("PERFECTO Négoce Abidjan");
    expect(text).toContain("Balance générale");
    expect(text).toContain("Journal des écritures");
    expect(text).toContain("Grand livre");
    expect(text).toContain("Pièce comptable");
    expect(text).toContain("Relevé de tiers");
    expect(text).toContain("Plan comptable");
    expect(text).toContain("Fichier des tiers");
    expect(text).toContain("Piste d'audit");
    expect(container.querySelectorAll(".edition-card")).toHaveLength(8);

    // L'aperçu montre le document réel : champs d'identité, lignes, totaux, pied de page.
    expect(text).toContain("Équilibre");
    expect(text).toContain("Débit = crédit");
    expect(container.querySelectorAll(".document-preview tbody tr")).toHaveLength(7);
    expect(container.querySelector(".document-footer")?.textContent).toContain("montants en XOF");
    expect(container.querySelector(".document-preview tfoot")?.textContent).toContain("2 832 000");
  });

  it("change de document, de filtre et de format sans rechargement", async () => {
    await openRoute("#/comptabilite/editions");

    // Journal, restreint au journal des achats.
    await click(editionCard("Journal des écritures"));
    expect(container.textContent).toContain("Journal des écritures");
    expect(container.querySelectorAll(".document-preview tbody tr")).toHaveLength(8);

    const journalSelect = container.querySelector<HTMLSelectElement>(".form-panel select");
    expect(journalSelect).not.toBeNull();
    await act(async () => {
      journalSelect!.value = "ACH";
      journalSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Journal ACH");
    expect(container.textContent).toContain("ACH — Journal des achats");
    expect(container.querySelectorAll(".document-preview tbody tr")).toHaveLength(3);

    await clickFormat("csv");
    expect(downloads.at(-1)!.name).toMatch(/^PERFECTO_journal_ACH_\d{4}-\d{2}-\d{2}\.csv$/);

    // Un autre document repart de paramètres propres : la première pièce VALIDÉE est
    // proposée, le brouillon de démonstration ne l'est pas.
    await click(editionCard("Pièce comptable"));
    expect(container.textContent).toContain("Pièce BQ1-2026-0001");

    const entrySelect = container.querySelector<HTMLSelectElement>(".form-panel select");
    const entries = await getKernel().getEntries();
    const purchase = entries.find((entry) => entry.number === "ACH-2026-0001")!;
    await act(async () => {
      entrySelect!.value = purchase.id;
      entrySelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Pièce ACH-2026-0001");
    expect(container.textContent).toContain("FA-2026-004");
    expect(container.textContent).toContain("Aucun justificatif rattaché");

    await clickFormat("pdf");
    expect(downloads.at(-1)!.name).toMatch(/^PERFECTO_piece_ACH-2026-0001_\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it("édite un relevé de tiers et annonce le solde non lettré", async () => {
    await openRoute("#/comptabilite/editions");
    await click(editionCard("Relevé de tiers"));

    const text = container.textContent ?? "";
    expect(text).toContain("Relevé auxiliaire CLI001");
    expect(text).toContain("Supermarché Cocody");
    expect(text).toContain("Lettrage A");
    expect(text).toContain("2 sur 2");

    const tiers = container.querySelectorAll<HTMLSelectElement>(".form-panel select");
    await act(async () => {
      tiers[0]!.value = "FOU001";
      tiers[0]!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    expect(container.textContent).toContain("Relevé auxiliaire FOU001");
    expect(container.textContent).toContain("-472 000");
    expect(container.querySelector(".document-footer")?.textContent).toContain(
      "reste à rapprocher ou à relancer"
    );

    await clickFormat("excel");
    expect(downloads.at(-1)!.name).toMatch(
      /^PERFECTO_releve-tiers_FOU001_\d{4}-\d{2}-\d{2}\.xlsx$/
    );
  });

  it("borne l'aperçu à l'écran sans tronquer le fichier", async () => {
    await openRoute("#/comptabilite/editions");
    await click(editionCard("Plan comptable"));

    // 18 comptes au plan, 8 lignes à l'écran, 18 dans le fichier.
    expect(container.querySelectorAll(".document-preview tbody tr")).toHaveLength(8);
    expect(container.querySelector(".document-more")?.textContent).toContain(
      "le document téléchargé en compte 18"
    );

    const file = await exportDocument(
      { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.chartOfAccounts },
      "csv"
    );
    const text = new TextDecoder().decode(file.bytes);
    expect(text.split("\r\n").filter((line) => line.match(/^\d{6};/))).toHaveLength(18);
  });

  it("exporte la piste d'audit après un acte de gestion", async () => {
    await getKernel().setPeriodClosed(5, true);
    await openRoute("#/comptabilite/editions");
    await click(editionCard("Piste d'audit"));

    expect(container.textContent).toContain("Période clôturée (accounting.period.closed)");
    expect(container.textContent).toContain("superviseur");

    await clickFormat("csv");
    const file = await exportDocument(
      { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.auditTrail },
      "csv"
    );
    const text = new TextDecoder().decode(file.bytes);
    expect(text).toContain("Piste d'audit");
    expect(text).toContain("accounting.period.closed");
    expect(downloads.at(-1)!.name).toMatch(/^PERFECTO_piste-audit_\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe("fiche société", () => {
  it("affiche l'identité, son aperçu imprimé et son historique", async () => {
    const text = await openRoute("#/parametres/societe");

    expect(text).toContain("Fiche société");
    expect(text).toContain("Raison sociale");
    expect(text).toContain("Identifiant fiscal (IFU)");
    expect(text).toContain("Ce qui s'imprimera");
    expect(text).toContain("PERFECTO Négoce Abidjan (SARL)");
    expect(text).toContain("IFU : CI-2024-B-1187");
    expect(text).toContain("Cocody Danga");
    expect(text).toContain("Abidjan, Côte d'Ivoire");
    expect(text).toContain("Tél. +225 27 22 44 55 66");
    expect(text).toContain("Historique de la fiche société");

    const name = container.querySelector<HTMLInputElement>(".form-grid input");
    expect(name?.value).toBe("PERFECTO Négoce Abidjan");
    // Rien à enregistrer tant que rien n'a changé.
    expect(container.querySelector<HTMLButtonElement>(".button-primary")?.disabled).toBe(true);
  });

  it("enregistre une nouvelle identité, la trace et l'imprime sur les documents", async () => {
    await openRoute("#/parametres/societe");

    const inputs = container.querySelectorAll<HTMLInputElement>(".form-grid input");
    await act(async () => {
      inputs[0]!.value = "  ivoire  négoce  ";
      inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    inputs[2]!.value = " ci-2024-b-9999 ";
    await act(async () => {
      inputs[2]!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();

    // L'aperçu suit la saisie en direct, avant même l'enregistrement.
    expect(container.querySelector(".document-letterhead")?.textContent).toContain(
      "ivoire négoce (SARL)"
    );

    const save = container.querySelector<HTMLButtonElement>(".button-primary");
    expect(save?.disabled).toBe(false);
    await click(save!, 10);

    const text = container.textContent ?? "";
    expect(text).toContain("Identité enregistrée : ivoire négoce");
    expect(text).toContain("Identité de la société mise à jour");

    // La normalisation est passée par le domaine.
    const organization = await getKernel().getOrganization();
    expect(organization.name).toBe("ivoire négoce");
    expect(organization.taxIdentifier).toBe("CI-2024-B-9999");
    expect(organization.legalForm).toBe("SARL");

    // Et les documents suivants portent la nouvelle identité.
    const file = await exportDocument(
      { organizationId: DEMO_ORGANIZATION_ID, kind: DocumentKind.trialBalance },
      "csv"
    );
    const csvText = new TextDecoder().decode(file.bytes);
    expect(csvText).toContain("ivoire négoce");
    expect(csvText).toContain("CI-2024-B-9999");
    expect(csvText).not.toContain("PERFECTO Négoce Abidjan");
  });

  it("refuse un courriel invalide et laisse annuler la saisie", async () => {
    await openRoute("#/parametres/societe");
    const inputs = container.querySelectorAll<HTMLInputElement>(".form-grid input");

    await act(async () => {
      inputs[7]!.value = "pas-un-courriel";
      inputs[7]!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    await click(container.querySelector<HTMLButtonElement>(".button-primary")!, 10);

    expect(container.textContent).toContain("Le courriel de la société n'a pas un format valide.");
    expect(await getKernel().getOrganization()).toMatchObject({
      email: "compta@perfecto-negoce.ci"
    });

    // Annuler revient aux valeurs enregistrées.
    await click([...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Annuler les modifications"
    )!);
    expect(container.querySelector<HTMLInputElement>(".form-grid input")?.value).toBe(
      "PERFECTO Négoce Abidjan"
    );

    // Une raison sociale vide bloque l'enregistrement à l'écran déjà.
    await act(async () => {
      const name = container.querySelectorAll<HTMLInputElement>(".form-grid input")[0]!;
      name.value = "   ";
      name.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    expect(container.querySelector<HTMLButtonElement>(".button-primary")?.disabled).toBe(true);
    expect(container.textContent).toContain(
      "Les valeurs saisies ne sont pas encore valides"
    );
  });
});

describe("navigation", () => {
  it("groupe le menu et atteint les deux nouveaux écrans", async () => {
    await openRoute("#/");
    const headings = [...container.querySelectorAll(".nav-heading")].map((item) => item.textContent);

    expect(headings).toEqual(["Pilotage", "Comptabilité SYSCOHADA", "Éditions", "Paramètres"]);
    expect(container.querySelectorAll(".nav-group")).toHaveLength(4);

    const editionsLink = [...container.querySelectorAll<HTMLAnchorElement>(".sidebar nav a")].find(
      (link) => link.textContent?.includes("Éditions et exports")
    );
    const societyLink = [...container.querySelectorAll<HTMLAnchorElement>(".sidebar nav a")].find(
      (link) => link.textContent?.includes("Fiche société")
    );
    expect(editionsLink?.getAttribute("href")).toBe("#/comptabilite/editions");
    expect(societyLink?.getAttribute("href")).toBe("#/parametres/societe");

    await act(async () => {
      editionsLink!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(location.hash).toBe("#/comptabilite/editions");
    expect(container.querySelector(".edition-card.selected")?.textContent).toContain(
      "Balance générale"
    );
  });
});
