// @vitest-environment jsdom
/**
 * L'écran étalon de la refonte : ouverture des dossiers (module → société → exercice).
 *
 * Ce qui est vérifié n'est pas le goût mais la structure promise le 15/10/2026 : le
 * contexte du dossier porté en permanence (titre de fenêtre de l'original), le code dossier
 * `CR000-26`, le catalogue des référentiels, la fiche société à onglets et la barre d'état.
 * On vérifie aussi l'honnêteté : une fonction non implémentée est annoncée, jamais
 * cliquable vers un écran vide.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";

// jsdom n'expose pas SubtleCrypto : le noyau hache les justificatifs avec WebCrypto.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
import { render } from "preact";
import { act } from "preact/test-utils";
import { App } from "../src/app";
import { getKernel, resetDemoData } from "../src/kernel";

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

async function click(element: HTMLElement, times = 10): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(times);
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.trim().includes(label)
  );
  if (!found) throw new Error(`bouton introuvable : ${label}`);
  return found;
}

function tab(label: string): HTMLElement {
  const found = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find((item) =>
    item.textContent?.trim().includes(label)
  );
  if (!found) throw new Error(`onglet introuvable : ${label}`);
  return found;
}

beforeEach(() => {
  resetDemoData();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

describe("ouverture des dossiers", () => {
  it("porte le contexte du dossier comme le titre de fenêtre de l'original", async () => {
    const text = await openRoute("#/");

    expect(text).toContain("Ouverture des dossiers");
    // Code dossier = module + code société + année, à la manière de PERFECTO.
    expect(text).toContain("CR000-26 : Comptabilité SYSCOHADA révisé PERFECTO Négoce Abidjan");
    expect(text).toContain("01/01/2026 - 31/12/2026");

    // La barre supérieure le rappelle sous forme condensée, cliquable vers le module.
    expect(container.querySelector(".topbar .dossier-code")?.textContent).toBe("CR000-26");
    expect(container.querySelector(".topbar .dossier-society")?.textContent).toBe(
      "PERFECTO Négoce Abidjan"
    );
    expect(container.querySelector(".topbar .dossier-period")?.textContent).toBe(
      "01/01/2026 - 31/12/2026"
    );
    expect(
      container.querySelector<HTMLAnchorElement>(".topbar a.dossier-context")?.getAttribute("href")
    ).toBe("#/comptabilite");
  });

  it("affiche la barre d'état sur un écran profond, pas seulement à l'accueil", async () => {
    await openRoute("#/comptabilite/plan");
    const status = container.querySelector(".statusbar")?.textContent ?? "";

    expect(status).toContain("Dossier CR000-26");
    expect(status).toContain("Société 000");
    expect(status).toContain("Exercice 2026");
    expect(status).toContain("01/01/2026 - 31/12/2026");
    expect(status).toContain("Session superviseur");
    expect(status).toContain("IndexedDB · disponible hors ligne");
    expect(status).toContain("Réinitialiser la démonstration");
  });

  it("catalogue les référentiels et n'en rend qu'un seul utilisable", async () => {
    await openRoute("#/");
    const cards = [...container.querySelectorAll<HTMLButtonElement>(".module-card")];

    expect(cards).toHaveLength(14);
    expect(cards.filter((card) => !card.disabled)).toHaveLength(1);
    const active = cards.find((card) => !card.disabled);
    expect(active?.classList.contains("selected")).toBe(true);
    expect(active?.querySelector(".module-code")?.textContent).toBe("CR");
    // Les autres profils sont annoncés comme prévus, avec la raison en infobulle.
    const planned = cards.find((card) => card.textContent?.includes("Comptabilité OHADA"))?.title;
    expect(planned).toContain("Profil prévu");
  });

  it("retrouve la fiche société à quatre onglets, IFU compris", async () => {
    await openRoute("#/");

    expect([...container.querySelectorAll('[role="tab"]')].map((item) => item.textContent)).toEqual([
      "Définition",
      "Adresse",
      "Contact",
      "IFU"
    ]);
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain("000");
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain("SARL");

    await click(tab("Adresse"));
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain("Abidjan");

    await click(tab("Contact"));
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toContain(
      "compta@perfecto-negoce.ci"
    );

    await click(tab("IFU"));
    const panel = container.querySelector('[role="tabpanel"]')?.textContent ?? "";
    expect(panel).toContain("CI-2024-B-1187");
    expect(panel).toContain("opposable");
    // L'accessibilité de l'onglet actif est annoncée aux lecteurs d'écran.
    expect(tab("IFU").getAttribute("aria-selected")).toBe("true");
    expect(tab("Contact").getAttribute("aria-selected")).toBe("false");
  });

  it("décrit le contenu réel du dossier, au lieu de chiffres décoratifs", async () => {
    const text = await openRoute("#/");
    const context = await getKernel().getDossierContext();

    const operations = [...container.querySelectorAll<HTMLElement>(".operation-item")].map((item) => ({
      label: item.querySelector("strong")?.textContent ?? "",
      value: item.querySelector(".operation-state")?.textContent ?? ""
    }));
    expect(operations).toEqual(
      expect.arrayContaining([
        { label: "Comptes généraux", value: String(context.counts.accounts) },
        { label: "Journaux", value: String(context.counts.journals) },
        { label: "Tiers", value: String(context.counts.thirdParties) },
        { label: "Pièces comptables", value: String(context.counts.entries) },
        { label: "Événements d'audit", value: String(context.counts.auditEvents) }
      ])
    );
    expect(context.counts.accounts).toBeGreaterThan(10);
    expect(text).toContain("une base transactionnelle unique");
  });

  it("ouvre le module comptable depuis l'écran d'ouverture", async () => {
    await openRoute("#/");
    await click(button("Ouvrir le module comptable"));

    expect(location.hash).toBe("#/comptabilite");
    expect(container.textContent).toContain("Comptabilité générale");
  });

  it("conserve le raccourci clavier Sociétés… <F2> de l'original", async () => {
    await openRoute("#/");
    expect(container.textContent).toContain("Sociétés…");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    });
    await flush();

    expect(location.hash).toBe("#/parametres/societe");
    expect(container.textContent).toContain("Fiche société");
    expect(container.textContent).toContain("CI-2024-B-1187");
  });
});
