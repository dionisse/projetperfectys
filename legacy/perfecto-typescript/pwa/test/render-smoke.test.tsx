// @vitest-environment jsdom
/**
 * Fumée de rendu : monte réellement l'application Preact sur chaque route, dans
 * un DOM, avec la base IndexedDB de démonstration. Garantit qu'aucun écran ne
 * s'ouvre sur une page blanche (erreur de rendu, donnée absente, DTO incomplet).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

// jsdom n'expose pas SubtleCrypto : le noyau hache les justificatifs avec WebCrypto.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
import { render } from "preact";
import { act } from "preact/test-utils";
import { App } from "../src/app";
import { DEMO_ORGANIZATION_ID, getKernel, resetDemoData } from "../src/kernel";

/**
 * Un conteneur NEUF par test : vider `innerHTML` derrière le dos de Preact
 * laisserait le diff suivant réutiliser des nœuds détachés (écran vide).
 */
let container: HTMLDivElement;

async function flush(times = 8): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    // Chaque tour laisse les promesses IndexedDB et les effets Preact avancer.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

/** Premier bouton visible portant exactement ce libellé. */
function findButton(label: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === label
  );
}

async function openRoute(hash: string): Promise<string> {
  location.hash = hash;
  await act(async () => {
    render(<App />, container);
  });
  await flush();
  return container.textContent ?? "";
}

beforeEach(async () => {
  await resetDemoData();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => {
    render(null, container);
  });
  container.remove();
});

const ROUTES: [string, string[]][] = [
  ["#/", ["Ouverture des dossiers", "CR000-26", "Comptabilité SYSCOHADA révisé", "PERFECTO Négoce Abidjan", "01/01/2026 - 31/12/2026", "Catalogue des modules", "Sociétés…"]],
  ["#/comptabilite", ["Comptabilité générale", "Fichier des tiers", "Piste d'audit", "Équilibre de la période", "Pièces extournées", "Lettrages de tiers", "Justificatifs rattachés"]],
  ["#/comptabilite/plan", ["Plan comptable", "401100", "Requis"]],
  ["#/comptabilite/journaux", ["Journaux comptables", "Numérotation automatique", "ACH-2026-0002"]],
  ["#/comptabilite/tiers", ["Fichier des tiers", "Grossiste Abidjan Nord", "FOU001", "Créer une fiche"]],
  ["#/comptabilite/pieces", ["Pièces comptables", "ACH-2026-0001", "FA-2026-004", "Brouillons", "Extournées", "Justif."]],
  ["#/comptabilite/pieces/nouvelle", ["Nouvelle pièce comptable", "OD-2026-0002", "Tiers", "Écart à corriger", "Avant enregistrement, corrigez"]],
  ["#/comptabilite/balance", ["Balance générale", "411100"]],
  ["#/comptabilite/etats/journal", ["Journal des écritures", "VTE-2026-0001", "CLI001"]],
  ["#/comptabilite/etats/grand-livre", ["Grand livre général", "Solde cumulé"]],
  ["#/comptabilite/periodes", ["Périodes comptables", "Janvier 2026"]],
  ["#/comptabilite/audit", ["Piste d'audit", "Tout l'historique"]]
];

describe("rendu de la coquille PWA", () => {
  it.each(ROUTES)("affiche l'écran %s sans erreur", async (hash, expected) => {
    const text = await openRoute(hash);
    for (const needle of expected) {
      expect(text).toContain(needle);
    }
    expect(text).not.toContain("Page introuvable");
  });

  it("ouvre la piste d'audit sur les événements de démonstration", async () => {
    // Une opération réelle pour garantir un historique non vide.
    await getKernel().setPeriodClosed(5, true);
    const text = await openRoute("#/comptabilite/audit");
    expect(text).toContain("Période clôturée");
    expect(text).toContain("superviseur");
  });

  it("propose la révision d'un brouillon et refuse celle d'une pièce validée", async () => {
    const entries = await getKernel().getEntries();
    const draft = entries.find((entry) => entry.status === "draft");
    const posted = entries.find((entry) => entry.status === "posted");
    expect(draft).toBeDefined();
    expect(posted).toBeDefined();

    const draftText = await openRoute(`#/comptabilite/pieces/${draft!.id}/modifier`);
    expect(draftText).toContain("Réviser le brouillon");
    expect(draftText).toContain(draft!.number);
    expect(draftText).toContain("Enregistrer et valider");

    const postedText = await openRoute(`#/comptabilite/pieces/${posted!.id}/modifier`);
    expect(postedText).toContain("Pièce non révisable");
    expect(postedText).toContain("immuable");
  });

  it("affiche le relevé auxiliaire quand on sélectionne un tiers", async () => {
    await openRoute("#/comptabilite/tiers");

    const row = [...container.querySelectorAll("tbody tr")].find((item) =>
      (item.textContent ?? "").includes("Supermarché Cocody")
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain("Relevé auxiliaire");
    expect(text).toContain("Fiche sélectionnée");
    expect(text).toContain("VTE-2026-0001");
    // 1 180 000 encaissés puis réglés : le solde du client est nul.
    expect(text).toContain("Solde 0");
  });

  it("signale immédiatement le tiers obligatoire sur un compte auxiliaire", async () => {
    await openRoute("#/comptabilite/pieces/nouvelle");
    expect(container.textContent ?? "").not.toContain("Tiers obligatoire");

    const accountSelect = container.querySelector<HTMLSelectElement>("table.entry-lines-table tbody tr select");
    expect(accountSelect).not.toBeNull();
    await act(async () => {
      accountSelect!.value = "401100";
      accountSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const text = container.textContent ?? "";
    expect(text).toContain("Compte auxiliaire : tiers obligatoire");
    expect(text).toContain("un tiers est obligatoire pour la ligne 1");
    // Le noyau reste l'autorité, mais l'écran bloque déjà l'enregistrement.
    expect(container.querySelector<HTMLButtonElement>("button.button-primary")?.disabled).toBe(true);
  });

  it("extourne une pièce validée depuis l'écran des pièces", async () => {
    await openRoute("#/comptabilite/pieces");

    const row = [...container.querySelectorAll("tbody tr")].find((item) =>
      (item.textContent ?? "").includes("ACH-2026-0001")
    );
    expect(row).toBeDefined();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent ?? "").toContain("Détail de la pièce");
    expect(container.textContent ?? "").toContain("Justificatifs");

    const openForm = findButton("Extourner la pièce");
    expect(openForm).toBeDefined();
    await act(async () => {
      openForm!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(container.textContent ?? "").toContain("Contre-passation");
    expect(container.textContent ?? "").toContain("débits et crédits permutés");

    const confirm = findButton("Créer la contre-passation");
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush(10);

    const text = container.textContent ?? "";
    expect(text).toContain("a été extournée par ACH-2026-0002");
    expect(text).toContain("Contre-passation de");
    expect(text).toContain("EXT-FA-2026-004");

    const entries = await getKernel().getEntries();
    expect(entries.find((entry) => entry.number === "ACH-2026-0001")?.status).toBe("reversed");
    expect(entries.find((entry) => entry.number === "ACH-2026-0002")?.reversalOfNumber).toBe(
      "ACH-2026-0001"
    );

    // La pièce extournée reste visible et filtrable : l'histoire comptable est intacte.
    const reversedFilter = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent?.trim() === "Extournées"
    );
    expect(reversedFilter).toBeDefined();
  });

  it("rattache un justificatif, affiche son empreinte puis le détache", async () => {
    await openRoute("#/comptabilite/pieces");
    const row = [...container.querySelectorAll("tbody tr")].find((item) =>
      (item.textContent ?? "").includes("ACH-2026-0001")
    );
    await act(async () => {
      row!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(container.textContent ?? "").toContain("0 fichier(s) rattaché(s)");

    const input = container.querySelector<HTMLInputElement>(".attachment-picker input[type=file]");
    expect(input).not.toBeNull();
    expect(input!.accept).toContain(".pdf");

    const bytes = new TextEncoder().encode("%PDF-1.4\nFacture FA-2026-004\n%%EOF");
    const file = new File([bytes], "FA-2026-004.pdf", { type: "application/pdf" });
    Object.defineProperty(input!, "files", { value: [file], configurable: true });
    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush(10);

    const text = container.textContent ?? "";
    expect(text).toContain("1 fichier(s) rattaché(s)");
    expect(text).toContain("FA-2026-004.pdf");
    expect(text).toMatch(/sha256:[0-9a-f]{8}…[0-9a-f]{6}/);
    expect(text).toContain("Justificatif rattaché");

    // Le compteur de la liste suit, et l'empreinte est bien celle du contenu.
    expect((await getKernel().getSnapshot()).attachmentCount).toBe(1);
    const attachments = await getKernel().getAttachments(
      (await getKernel().getEntries()).find((entry) => entry.number === "ACH-2026-0001")!.id
    );
    expect(attachments[0]?.sizeBytes).toBe(bytes.byteLength);

    // Un second envoi du même fichier est refusé par l'empreinte.
    Object.defineProperty(input!, "files", { value: [file], configurable: true });
    await act(async () => {
      input!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush(10);
    expect(container.textContent ?? "").toContain("Ce fichier est déjà rattaché à la pièce");

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const detach = findButton("Détacher");
    expect(detach).toBeDefined();
    await act(async () => {
      detach!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush(10);
    expect(container.textContent ?? "").toContain("Justificatif détaché");
    expect((await getKernel().getSnapshot()).attachmentCount).toBe(0);
    confirmSpy.mockRestore();
  });

  it("lettre la facture et le règlement d'un tiers depuis son relevé", async () => {
    // Le relevé de FOU001 ne porte que la facture : on encaisse son règlement.
    await getKernel().saveEntry({
      organizationId: DEMO_ORGANIZATION_ID,
      journalCode: "BQ1",
      entryDate: "2026-02-10",
      reference: "BQ-2026-011",
      description: "Règlement fournisseur",
      postImmediately: true,
      lines: [
        { accountCode: "401100", label: "Fournisseur", debit: "472000", credit: 0, thirdPartyCode: "FOU001" },
        { accountCode: "521100", label: "Banque", debit: 0, credit: "472000" }
      ]
    });

    await openRoute("#/comptabilite/tiers");
    const tierRow = [...container.querySelectorAll("tbody tr")].find((item) =>
      (item.textContent ?? "").includes("Grossiste Abidjan Nord")
    );
    expect(tierRow).toBeDefined();
    await act(async () => {
      tierRow!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(container.textContent ?? "").toContain("Relevé auxiliaire");
    expect(container.textContent ?? "").toContain("Non lettré");
    expect(findButton("Lettrer la sélection")!.disabled).toBe(true);

    for (const reference of ["FA-2026-004", "BQ-2026-011"]) {
      const line = [...container.querySelectorAll("tbody tr")].find(
        (item) => (item.textContent ?? "").includes(reference) && item.querySelector(".letter-pending")
      );
      expect(line, `mouvement ${reference}`).toBeDefined();
      await act(async () => {
        line!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flush();
    }

    expect(container.textContent ?? "").toContain("2 mouvement(s) sélectionné(s)");
    expect(findButton("Lettrer la sélection")!.disabled).toBe(false);

    await act(async () => {
      findButton("Lettrer la sélection")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush(10);

    const text = container.textContent ?? "";
    expect(text).toContain("Lettrage A créé");
    expect(text).toContain("Lettrages en cours");
    expect(container.querySelectorAll(".letter-badge")).toHaveLength(3);
    expect((await getKernel().getThirdPartyStatement("FOU001")).unreconciledBalance).toBe("0");

    // Annulation : les mouvements redeviennent disponibles.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      findButton("Annuler")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush(10);
    expect(container.textContent ?? "").toContain("Lettrage A annulé");
    expect((await getKernel().getThirdPartyStatement("FOU001")).letteredLineCount).toBe(0);
    confirmSpy.mockRestore();
  });

  it("signale une adresse inconnue au lieu de planter", async () => {
    const text = await openRoute("#/comptabilite/inexistant");
    expect(text).toContain("Page introuvable");
  });
});
