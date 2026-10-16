/**
 * @vitest-environment jsdom
 *
 * Les états financiers à l'écran.
 *
 * Vérifiés : l'ouverture par le menu, l'équilibre affiché en tête, le résultat porté au passif, le
 * cumul d'un état intermédiaire quand on change l'arrêté, le contrôle du compte de résultat, et le
 * tableau des flux de trésorerie — son contrôle, le classement par activité, les virements internes
 * écartés, et l'écart montré avec le compte qui l'explique.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { posterAchat, posterLot, posterVente } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 400;

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(route: string): Promise<HTMLElement> {
  location.hash = `#${route}`;
  await act(async () => {
    render(<Coquille />, conteneur);
  });
  await flush();
  return conteneur;
}

const texte = (racine: HTMLElement | null): string =>
  (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-etats-${compteurBase}`);
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
});

afterEach(() => {
  conteneur.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

describe("États › Bilan OHADA révisé", () => {
  it("ouvre un bilan équilibré sur les à-nouveaux", async () => {
    const racine = await ouvrir("/etats/bilan");
    const retour = racine.querySelector('[role="status"]');

    expect(retour?.classList.contains("succes")).toBe(true);
    expect(texte(retour as HTMLElement | null)).toMatch(/bilan est équilibré/i);
    expect(texte(racine)).toMatch(/80\s000\s000/u);
    // Les trois colonnes de l'actif et les titres des deux masses.
    const entetes = [...racine.querySelectorAll<HTMLElement>("table.grille-etat th")].map(texte);
    expect(entetes).toContain("Amort. et dépréc.");
    expect(texte(racine)).toMatch(/Actif/);
    expect(texte(racine)).toMatch(/Passif/);
    expect(texte(racine)).toMatch(/arrêté au 31\/12\/2026/);
  });

  it("porte le résultat de l'exercice au passif", async () => {
    const service = getService();
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const racine = await ouvrir("/etats/bilan");

    expect(texte(racine)).toMatch(/82\s540\s000/u);
    expect(texte(racine)).toMatch(/résultat de l'exercice\s+1\s000\s000/u);
    expect(texte(racine)).not.toMatch(/déséquilibré/i);
  });

  it("un arrêté en cours d'exercice est cumulé depuis le 1er janvier", async () => {
    const service = getService();
    await posterVente(service, { date: "2026-03-10", piece: "FV-2026-011", montant: "1000000" });
    await posterVente(service, { date: "2026-04-10", piece: "FV-2026-012", montant: "2000000" });

    const racine = await ouvrir("/etats/bilan");
    expect(texte(racine)).toMatch(/83\s540\s000/u);

    const arrete = racine.querySelector("select");
    expect(arrete).not.toBeNull();
    arrete!.value = "3";
    arrete!.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(texte(racine)).toMatch(/81\s180\s000/u);
    expect(texte(racine)).toMatch(/arrêté au 31\/03\/2026/);
    expect(texte(racine)).not.toMatch(/83\s540\s000/u);
  });

  it("annonce les rubriques qu'aucun solde n'alimente", async () => {
    const racine = await ouvrir("/etats/bilan");

    expect(texte(racine)).toMatch(/Rubriques sans solde/i);
    expect(texte(racine)).toMatch(/IMMO-AM/);
  });
});

describe("États › Compte de résultat OHADA révisé", () => {
  it("présente les rubriques dans l'ordre du modèle et un contrôle conforme", async () => {
    const racine = await ouvrir("/etats/compte-resultat");
    const retour = texte(racine);

    expect(retour).toMatch(/Contrôle conforme/i);
    expect(retour).toMatch(/121000/);
    const lignes = [...racine.querySelectorAll<HTMLElement>("table.grille-etat tbody tr td:first-child")].map(texte);
    const ordre = [
      "Produits d'exploitation",
      "1. Résultat d'exploitation",
      "2. Résultat financier",
      "3. Résultat des activités ordinaires",
      "5. Résultat avant impôts",
      "Impôts sur les résultats",
      "6. Résultat net"
    ].map((libelle) => lignes.findIndex((item) => item === libelle));
    expect(ordre.every((index) => index >= 0)).toBe(true);
    expect(ordre).toEqual([...ordre].sort((a, b) => a - b));
  });

  it("calcule le résultat net d'un mois et le détaille par compte", async () => {
    const service = getService();
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const racine = await ouvrir("/etats/compte-resultat");
    const arrete = racine.querySelector("select")!;
    arrete.value = "4";
    arrete.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const retour = texte(racine);
    expect(retour).toMatch(/Résultat net de l'exercice\s*1\s000\s000/u);
    expect(retour).toMatch(/cumul à fin de période 4/i);
    // Le détail par compte cite les deux comptes de gestion mouvementés.
    expect(retour).toMatch(/701100/);
    expect(retour).toMatch(/601100/);
  });

  it("un compte de résultat néant le dit", async () => {
    const racine = await ouvrir("/etats/compte-resultat");
    const arrete = racine.querySelector("select")!;
    arrete.value = "2";
    arrete.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(texte(racine)).toMatch(/compte de résultat est néant/i);
  });
});

describe("États › Tableau des flux de trésorerie", () => {
  it("ouvre un tableau qui se contrôle sur les à-nouveaux", async () => {
    const racine = await ouvrir("/etats/flux-tresorerie");
    const retour = racine.querySelector('[role="status"]');

    expect(retour?.classList.contains("succes")).toBe(true);
    expect(texte(retour as HTMLElement | null)).toMatch(/Le tableau se contrôle/i);
    // Banque 55 000 000 + caisse 5 000 000 : la trésorerie d'ouverture, et rien ne bouge.
    expect(texte(retour as HTMLElement | null)).toMatch(/60\s000\s000/u);
    expect(texte(racine)).toMatch(/du 01\/01\/2026 au 31\/12\/2026/);

    // Les grandes masses de l'imprimé, dans l'ordre, et les codes qui permettent de les retrouver.
    const sections = [...racine.querySelectorAll<HTMLElement>("table.grille-etat tr.ligne-section td")].map(texte);
    expect(sections).toEqual([
      "Trésorerie d'ouverture",
      "Flux de trésorerie provenant des activités opérationnelles",
      "Flux de trésorerie provenant des activités d'investissement",
      "Flux de trésorerie provenant du financement par les capitaux propres",
      "Flux de trésorerie provenant du financement par les capitaux étrangers",
      "Flux de trésorerie provenant des activités de financement",
      "Variation de la trésorerie nette de la période",
      "Trésorerie nette à la clôture"
    ]);
    const codes = [...racine.querySelectorAll<HTMLElement>("table.grille-etat tbody tr td:first-child")].map(texte);
    expect(codes).toContain("ZA");
    expect(codes).toContain("FA");
    expect(codes).toContain("ZH");
    expect(codes.indexOf("ZA")).toBeLessThan(codes.indexOf("FA"));
    expect(codes.indexOf("FA")).toBeLessThan(codes.indexOf("ZH"));
    expect(texte(racine)).toMatch(/Pas de colonne N-1/i);
  });

  it("classe un encaissement de vente en activité, TVA comprise", async () => {
    const service = getService();
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-05",
      piece: "REC-2026-001",
      libelle: "Encaissement client au comptant",
      lignes: [
        { compte: "701100", libelle: "Vente de marchandises", credit: "2000000", codesTaxe: ["TVA-V18"] }
      ],
      contrepartie: "521100"
    });

    const racine = await ouvrir("/etats/flux-tresorerie");
    const retour = texte(racine);

    expect(retour).toMatch(/Le tableau se contrôle/i);
    expect(retour).toMatch(/2\s360\s000/u);
    expect(retour).toMatch(/62\s360\s000/u);
    // Le détail nomme le compte de TVA qui explique la part non vendue de l'encaissement.
    expect(retour).toMatch(/443100/);
    expect(retour).toMatch(/méthode indirecte/i);
  });

  it("dit qu'un virement de caisse à banque n'est pas un flux", async () => {
    const service = getService();
    await posterLot(service, {
      journalCode: "CAI",
      date: "2026-04-10",
      piece: "VI-2026-004",
      libelle: "Remise d'espèces en banque",
      lignes: [{ compte: "521100", libelle: "Banque principale", debit: "1500000" }],
      contrepartie: "571100"
    });

    const racine = await ouvrir("/etats/flux-tresorerie");
    const retour = texte(racine);

    expect(retour).toMatch(/1 écriture entre comptes de trésorerie écartée/i);
    expect(retour).toMatch(/Le tableau se contrôle/i);
    expect(retour).toMatch(/60\s000\s000/u);
  });

  it("montre un écart avec le compte qui l'explique, au lieu de l'absorber", async () => {
    const service = getService();
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-20",
      piece: "DIV-2026-001",
      libelle: "Distribution passée au résultat",
      lignes: [{ compte: "121000", libelle: "Résultat de l'exercice", debit: "3000000" }],
      contrepartie: "521100"
    });

    const racine = await ouvrir("/etats/flux-tresorerie");
    const retour = texte(racine);

    expect(retour).toMatch(/Le tableau ne se contrôle pas/i);
    expect(racine.querySelector('[role="status"]')).toBeNull();
    expect(retour).toMatch(/Comptes que le modèle ne classe pas/);
    expect(retour).toMatch(/RESULTAT-CLOS/);
    // La trésorerie réelle a baissé de 3 000 000 ; le tableau n'explique aucun flux.
    expect(retour).toMatch(/57\s000\s000/u);
    expect(retour).toMatch(/3\s000\s000/u);
  });

  it("un arrêté en cours d'exercice cumule depuis le 1er janvier", async () => {
    const service = getService();
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-02-10",
      piece: "REC-2026-014",
      libelle: "Encaissement de février",
      lignes: [{ compte: "706100", libelle: "Services vendus", credit: "900000" }],
      contrepartie: "521100"
    });
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-05",
      piece: "REC-2026-040",
      libelle: "Encaissement d'avril",
      lignes: [{ compte: "706100", libelle: "Services vendus", credit: "400000" }],
      contrepartie: "521100"
    });

    const racine = await ouvrir("/etats/flux-tresorerie");
    expect(texte(racine)).toMatch(/61\s300\s000/u);

    const arrete = racine.querySelector("select")!;
    arrete.value = "3";
    arrete.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const retour = texte(racine);
    expect(retour).toMatch(/au 31\/03\/2026/);
    expect(retour).toMatch(/60\s900\s000/u);
    expect(retour).not.toMatch(/61\s300\s000/u);
  });
});

describe("Menu États", () => {
  it("les trois états financiers sont accessibles, le tableau de variation reste annoncé", async () => {
    const racine = await ouvrir("/");
    const boutonEtats = [...racine.querySelectorAll<HTMLButtonElement>(".barre-menus button")].find((item) =>
      texte(item).includes("États")
    );
    expect(boutonEtats).toBeDefined();
    await act(async () => {
      boutonEtats!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush(4);

    const panneau = racine.querySelector('.menu-panneau[aria-label="Menu États"]');
    expect(panneau).not.toBeNull();
    const entrees = [...panneau!.querySelectorAll<HTMLElement>(".menu-entree")];

    const etatsFinanciers = entrees.filter(
      (entree) => texte(entree).includes("OHADA") || texte(entree).includes("flux de trésorerie")
    );
    expect(etatsFinanciers.length).toBe(3);
    // Disponible = un bouton qui mène à un écran ; jamais un span grisé.
    expect(etatsFinanciers.every((entree) => entree.tagName === "BUTTON")).toBe(true);
    expect(etatsFinanciers.some((entree) => texte(entree).includes("Bilan"))).toBe(true);
    expect(etatsFinanciers.some((entree) => texte(entree).includes("Compte de résultat"))).toBe(true);

    // Le tableau des flux est livré : il ouvre son écran, et l'écran se contrôle.
    const flux = entrees.find((entree) => texte(entree).includes("Tableau des flux de trésorerie"));
    expect(flux?.tagName).toBe("BUTTON");
    await act(async () => {
      flux!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(location.hash).toBe("#/etats/flux-tresorerie");
    expect(texte(racine)).toMatch(/Le tableau se contrôle/i);

    // Le tableau de variation des activités reste annoncé, avec la raison de son absence.
    const variation = entrees.filter(
      (entree) => entree.classList.contains("indisponible") && texte(entree).includes("variation des activités")
    );
    expect(variation.length).toBe(1);
    expect(variation[0]!.getAttribute("title") ?? "").toMatch(/modèle de cet état/i);
  });
});
