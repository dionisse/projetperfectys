// @vitest-environment jsdom
/**
 * L'écran de clôture d'exercice, monté pour de vrai.
 *
 * Ce qui est vérifié : que le rapport de préparation est montré avant toute écriture, que les
 * obstacles grisent le bouton et portent leur raison, que la clôture des périodes est proposée, que
 * la confirmation est exigée pour une opération définitive, et que le bilan de l'exercice suivant
 * présente alors sa colonne N-1.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { posterAchat, posterVente } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 800;

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(route = "/traitements/cloture"): Promise<HTMLElement> {
  location.hash = `#${route}`;
  await act(async () => {
    render(<Coquille />, conteneur);
  });
  await flush();
  return conteneur;
}

const texte = (racine: HTMLElement | null): string =>
  (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

function bouton(libelle: string): HTMLButtonElement {
  const trouve = [...conteneur.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    texte(item).includes(libelle)
  );
  if (!trouve) {
    throw new Error(`bouton introuvable : ${libelle}`);
  }
  return trouve;
}

async function cliquer(cible: HTMLElement, fois = 14): Promise<void> {
  await act(async () => {
    cible.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(fois);
}

async function cocherCase(): Promise<void> {
  const caseConfirmation = conteneur.querySelector<HTMLInputElement>('.case-a-cocher input[type="checkbox"]');
  if (!caseConfirmation) {
    throw new Error("case de confirmation introuvable");
  }
  await act(async () => {
    caseConfirmation.checked = true;
    caseConfirmation.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(6);
}

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-cloture-${compteurBase}`);
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) {
      return;
    }
  });
});

afterEach(() => {
  conteneur.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

describe("Écran de clôture d'exercice", () => {
  it("montre le rapport et les obstacles avant toute écriture", async () => {
    const service = getService();
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const racine = await ouvrir();
    const retour = texte(racine);

    expect(retour).toMatch(/Rapport de préparation — exercice 2026/);
    expect(retour).toMatch(/Résultat de l'exercice\s*1\s000\s000/u);
    expect(retour).toMatch(/La clôture est refusée/i);
    expect(retour).toMatch(/ne sont pas clôturées/i);
    expect(retour).toMatch(/Période 14 — Écritures de clôture/);

    // Les deux écritures sont montrées ligne à ligne, avant d'exister.
    expect(retour).toMatch(/Écriture de clôture — solde des comptes de gestion/i);
    expect(retour).toMatch(/701100/);
    expect(retour).toMatch(/121000/);
    expect(retour).toMatch(/À-nouveaux de l'exercice 2027/i);
    expect(retour).toMatch(/401100-FOU01/);

    // Le bouton est grisé, et il dit pourquoi.
    const clôturer = bouton("Clôturer l'exercice 2026 et ouvrir 2027");
    expect(clôturer.disabled).toBe(true);
    expect(clôturer.getAttribute("title")).toMatch(/ne sont pas clôturées/i);
    expect(texte(racine)).toMatch(/1 obstacle/);

    // Rien n'a été écrit.
    const etat = await service.lire();
    expect(etat.exercicesClos.length).toBe(0);
    expect(etat.exercice.annee).toBe(2026);
  });

  it("clôture les périodes, exige la confirmation, puis clôture l'exercice", async () => {
    const racine = await ouvrir();

    await cliquer(bouton("Clôturer les périodes 1 à 13"), 24);
    expect(texte(racine)).toMatch(/13 périodes clôturées/i);
    expect(texte(racine)).toMatch(/Aucune règle ne s'oppose à la clôture de l'exercice 2026/i);

    // Rapport conforme, mais pas encore confirmé : le bouton reste grisé.
    const clôturer = bouton("Clôturer l'exercice 2026 et ouvrir 2027");
    expect(clôturer.disabled).toBe(true);
    expect(clôturer.getAttribute("title")).toMatch(/Confirmez avoir vérifié/i);

    await cocherCase();
    expect(bouton("Clôturer l'exercice 2026 et ouvrir 2027").disabled).toBe(false);

    await cliquer(bouton("Clôturer l'exercice 2026 et ouvrir 2027"), 20);
    const apres = texte(racine);
    expect(apres).toMatch(/Exercice 2026 clôturé/i);
    expect(apres).toMatch(/comptes reportés/i);
    expect(apres).toMatch(/L'exercice 2027 est ouvert du 01\/01\/2027 au 31\/12\/2027/);
    expect(apres).toMatch(/Rapport de préparation — exercice 2027/);

    // La liste des exercices distingue le clos du courant.
    expect(apres).toMatch(/Clos/);
    expect(apres).toMatch(/En cours/);

    const etat = await getService().lire();
    expect(etat.exercice.annee).toBe(2027);
    expect(etat.exercicesClos.length).toBe(1);
    expect(etat.exercicesClos[0]!.exercice.periodes.every((periode) => periode.clots)).toBe(true);

    // La barre d'état suit : on sait toujours dans quel exercice on écrit.
    expect(texte(racine.querySelector(".barre-etat"))).toMatch(/Exercice 2027/);
  });

  it("le bilan de l'exercice suivant présente sa colonne N-1", async () => {
    const racine = await ouvrir();
    await cliquer(bouton("Clôturer les périodes 1 à 13"), 24);
    await cocherCase();
    await cliquer(bouton("Clôturer l'exercice 2026 et ouvrir 2027"), 20);

    await act(async () => {
      location.hash = "#/etats/bilan";
    });
    await flush(16);

    const bilan = texte(racine);
    expect(bilan).toMatch(/N-1 \(2026\)/);
    expect(bilan).toMatch(/Colonne N-1 : exercice 2026, clos le 31\/12\/2026/);
    expect(bilan).toMatch(/80\s000\s000/u);
    expect(bilan).toMatch(/bilan est équilibré/i);

    // Le sélecteur d'exercice apparaît dès qu'un exercice est clos.
    const selecteurs = [...racine.querySelectorAll<HTMLSelectElement>("select")];
    const exercices = selecteurs.find((selecteur) =>
      [...selecteur.options].some((option) => option.textContent?.includes("clos"))
    );
    expect(exercices).toBeDefined();

    await act(async () => {
      exercices!.value = "2026";
      exercices!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const clos = texte(racine);
    expect(clos).toMatch(/Exercice 2026 · arrêté au 31\/12\/2026/);
    // L'exercice clos ne compare pas à un exercice qui n'existe pas.
    expect(clos).toMatch(/Pas de colonne N-1 : aucun exercice n'est clos/i);
  });
});
