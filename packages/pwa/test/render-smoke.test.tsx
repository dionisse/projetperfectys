// @vitest-environment jsdom
/**
 * Fumée de rendu : monte réellement l'application Preact sur chaque route, dans
 * un DOM, avec la base IndexedDB de démonstration. Garantit qu'aucun écran ne
 * s'ouvre sur une page blanche (erreur de rendu, donnée absente, DTO incomplet).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { App } from "../src/app";
import { getKernel, resetDemoData } from "../src/kernel";

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
  ["#/", ["Bonjour, Superviseur", "Fichier tiers", "Pièces récentes"]],
  ["#/comptabilite", ["Comptabilité générale", "Fichier des tiers", "Piste d'audit", "Équilibre de la période"]],
  ["#/comptabilite/plan", ["Plan comptable", "401100", "Requis"]],
  ["#/comptabilite/journaux", ["Journaux comptables", "Numérotation automatique", "ACH-2026-0002"]],
  ["#/comptabilite/tiers", ["Fichier des tiers", "Grossiste Abidjan Nord", "FOU001", "Créer une fiche"]],
  ["#/comptabilite/pieces", ["Pièces comptables", "ACH-2026-0001", "FA-2026-004", "Brouillons"]],
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

  it("signale une adresse inconnue au lieu de planter", async () => {
    const text = await openRoute("#/comptabilite/inexistant");
    expect(text).toContain("Page introuvable");
  });
});
