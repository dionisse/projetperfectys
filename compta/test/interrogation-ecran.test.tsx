// @vitest-environment jsdom
/**
 * L'écran d'interrogation de compte, monté pour de vrai.
 *
 * Ce qui est vérifié : le solde après chaque ligne, la lecture d'un segment de tiers, l'avertissement
 * quand un compte auxiliaire est lu sans tiers, l'historique par exercice, et le fait qu'un compte ou
 * un exercice inexistant rende une réponse lisible plutôt qu'un écran vide ou une panne.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { posterAchat, posterVente } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 970;

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(route = "/interrogation/compte"): Promise<HTMLElement> {
  location.hash = `#${route}`;
  await act(async () => {
    render(<Coquille />, conteneur);
  });
  await flush();
  return conteneur;
}

const texte = (racine: HTMLElement | null): string => (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

async function saisir(etiquette: string, valeur: string): Promise<void> {
  const champ = [...conteneur.querySelectorAll<HTMLLabelElement>("label")].find((item) =>
    texte(item).startsWith(etiquette)
  );
  const entree = champ?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if (!entree) {
    throw new Error(`champ introuvable : ${etiquette}`);
  }
  await act(async () => {
    entree.value = valeur;
    entree.dispatchEvent(new Event("input", { bubbles: true }));
    entree.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(12);
}

async function cocher(libelle: string, valeur: boolean): Promise<void> {
  const caseCible = [...conteneur.querySelectorAll<HTMLLabelElement>("label.case-a-cocher")].find((item) =>
    texte(item).includes(libelle)
  );
  const entree = caseCible?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!entree) {
    throw new Error(`case introuvable : ${libelle}`);
  }
  await act(async () => {
    entree.checked = valeur;
    entree.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(12);
}

/** Les lignes de la grille des mouvements, sans l'en-tête ni le pied. */
function lignesDeMouvements(): string[] {
  const tables = [...conteneur.querySelectorAll<HTMLTableElement>("table.grille")];
  const premiere = tables[0];
  return [...(premiere?.querySelectorAll("tbody tr") ?? [])].map((ligne) => texte(ligne as HTMLElement));
}

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-interrogation-${compteurBase}`);
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

describe("Écran d'interrogation de compte", () => {
  it("montre le solde après chaque ligne et l'historique par exercice", async () => {
    const racine = await ouvrir();
    expect(texte(racine)).toMatch(/Interrogation de compte/);
    expect(texte(racine)).toMatch(/521100 — Banque/u);

    // L'à-nouveau de janvier est la seule ligne : le solde progressif le suit.
    const lignes = lignesDeMouvements();
    expect(lignes.length).toBe(1);
    expect(lignes[0]).toMatch(/01\/01\/2026/);
    expect(lignes[0]).toMatch(/55\s000\s000/u);

    expect(texte(racine)).toMatch(/Solde d'ouverture de la fenêtre\s*0/u);
    expect(texte(racine)).toMatch(/Solde à la fin de la fenêtre\s*55\s000\s000/u);
    expect(texte(racine)).toMatch(/débiteur/u);
    expect(texte(racine)).toMatch(/Historique par exercice/);
    expect(texte(racine)).toMatch(/en cours/);
    expect(texte(racine)).toMatch(/Néant|À nouveau/u);
  });

  it("lit un segment de tiers seul, et dit quand un compte auxiliaire est lu sans tiers", async () => {
    const service = getService();
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterVente(service, { date: "2026-04-18", piece: "FV-2026-002", montant: "1000000", tiers: "CLI02" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const racine = await ouvrir();

    // Le compte fournisseur segmenté : l'à-nouveau du fournisseur, la facture, et rien d'autre.
    await saisir("Compte", "401100-FOU01");
    const fournisseur = texte(racine);
    expect(fournisseur).toMatch(/401100 — Fournisseurs d'exploitation · FOU01/u);
    expect(fournisseur).toMatch(/10\s000\s000/u);
    expect(fournisseur).toMatch(/1\s170\s000/u);
    expect(lignesDeMouvements().length).toBe(2);
    // Un segment interrogé nommément n'appelle pas l'avertissement sur les tiers.
    expect(fournisseur).not.toMatch(/rassemble tous les segments/u);

    // Le compte client sans tiers rassemble les deux segments, et l'écran le dit.
    await saisir("Compte", "411100");
    const clients = texte(racine);
    expect(clients).toMatch(/rassemble tous les segments/u);
    expect(lignesDeMouvements().length).toBe(2);
    expect(clients).toMatch(/2\s360\s000/u);
    expect(clients).toMatch(/1\s180\s000/u);

    // Restreindre à un tiers depuis le sélecteur.
    await saisir("Tiers", "CLI02");
    const cli02 = texte(racine);
    expect(cli02).toMatch(/411100 — Clients · CLI02/u);
    expect(lignesDeMouvements().length).toBe(1);
    expect(cli02).toMatch(/1\s180\s000/u);
    expect(cli02).not.toMatch(/2\s360\s000/u);
  });

  it("répond à un compte ou à un exercice inexistant au lieu de rendre un écran vide", async () => {
    const racine = await ouvrir();

    await saisir("Compte", "999999");
    expect(texte(racine)).toMatch(/Interrogation impossible/);
    expect(texte(racine)).toMatch(/n'existe pas dans le plan du dossier/u);
    // Les sélecteurs restent utilisables : ce n'est pas une panne.
    await saisir("Compte", "521100");
    expect(texte(racine)).toMatch(/521100 — Banque/u);

    // Comparer à un exercice précédent qui n'existe pas est refusé, avec la liste de ce qui existe.
    await cocher("Comparer à l'exercice précédent", true);
    const refus = texte(racine);
    expect(refus).toMatch(/Interrogation impossible/);
    expect(refus).toMatch(/la comparaison d'exercices s'arrête là/u);
    expect(refus).toMatch(/Exercices disponibles : 2026/u);
  });
});
