// @vitest-environment jsdom
/**
 * L'écran de lettrage, monté pour de vrai.
 *
 * Ce qui est vérifié : que l'écran lit le grand livre sans le réécrire, que le bouton « Lettrer »
 * n'est actif que sur une sélection équilibrée et dit pourquoi sinon, qu'une marque créée retire les
 * lignes de la liste, qu'un délettrage les rend sans effacer la marque, et que la proposition
 * automatique est montrée avant d'être appliquée.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { posterAchat, posterLot } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 600;
let nomsTelecharges: string[] = [];

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(): Promise<HTMLElement> {
  location.hash = "#/traitements/lettrage";
  await act(async () => {
    render(<Coquille />, conteneur);
  });
  await flush();
  return conteneur;
}

const texte = (racine: HTMLElement | null): string =>
  (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

function bouton(libelle: string): HTMLButtonElement {
  // Un <summary> déplie le choix de format : c'est un bouton pour l'utilisateur, il est cherché
  // comme tel.
  const trouve = [...conteneur.querySelectorAll<HTMLButtonElement>("button, summary")].find(
    (item) => texte(item) === libelle
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

/** Coche la ligne d'une pièce : l'étiquette accessible porte la pièce et sa date. */
async function cocher(piece: string): Promise<void> {
  const cases = [...conteneur.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
  const cible = cases.find((item) => (item.getAttribute("aria-label") ?? "").includes(piece));
  if (!cible) {
    throw new Error(`case à cocher introuvable pour la pièce ${piece} (${cases.length} cases)`);
  }
  await act(async () => {
    cible.checked = !cible.checked;
    cible.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(6);
}

/** Une facture d'achat et son règlement par banque, du même montant au crédit du fournisseur. */
async function facturerEtRegler(demande: {
  montant: string;
  pieceFacture: string;
  pieceReglement: string;
  tiers?: string;
}): Promise<void> {
  const service = getService();
  const tiers = demande.tiers ?? "FOU01";
  await posterAchat(service, {
    date: "2026-04-12",
    piece: demande.pieceFacture,
    montant: demande.montant,
    tiers
  });
  const total = (BigInt(demande.montant) * 117n) / 100n;
  await posterLot(service, {
    journalCode: "BQ",
    date: "2026-04-28",
    piece: demande.pieceReglement,
    libelle: `Règlement de ${demande.pieceFacture}`,
    lignes: [
      { compte: `401100-${tiers}`, libelle: "Règlement fournisseur", debit: total.toString() },
      { compte: "521100", libelle: "Banque", credit: total.toString() }
    ],
    contrepartie: ""
  });
}

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-lettrage-${compteurBase}`);
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  nomsTelecharges = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) {
      nomsTelecharges.push(this.download);
    }
  });
});

afterEach(() => {
  conteneur.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

describe("Écran de lettrage", () => {
  it("ouvre sur la situation des comptes de tiers et l'à-nouveau à lettrer", async () => {
    const racine = await ouvrir();
    const retour = texte(racine);

    expect(retour).toMatch(/Situation des comptes de tiers/i);
    expect(retour).toMatch(/Solde comptable/i);
    expect(retour).toMatch(/Non lettré/i);
    expect(retour).toMatch(/Lignes à lettrer — 401100/);
    // L'à-nouveau du fournisseur : 10 000 000 au crédit, non lettré.
    expect(retour).toMatch(/AN-0001/);
    expect(retour).toMatch(/10\s000\s000/u);
    expect(retour).toMatch(/solde non lettré dit ce qui est dû sans qu'aucun règlement/i);
  });

  it("n'active « Lettrer la sélection » que sur une sélection équilibrée, et dit pourquoi sinon", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const racine = await ouvrir();

    expect(bouton("Lettrer la sélection").disabled).toBe(true);
    expect(bouton("Lettrer la sélection").getAttribute("title")).toMatch(/au moins deux lignes/i);

    // Deux crédits : rien n'est rapproché, l'écart est affiché plutôt que le bouton activé.
    await cocher("AN-0001");
    await cocher("FA-2026-018");
    expect(bouton("Lettrer la sélection").disabled).toBe(true);
    expect(bouton("Lettrer la sélection").getAttribute("title")).toMatch(/n'est pas équilibrée/i);
    // `formatMontant` signe d'un tiret : l'écart se lit −11 170 000 FCFA.
    expect(texte(racine)).toMatch(/Écart -11\s170\s000/u);
    expect(texte(racine)).toMatch(/lettrage partiel n'est pas produit/i);

    // On corrige la sélection : la facture et son règlement.
    await cocher("AN-0001");
    await cocher("RG-2026-004");
    expect(bouton("Lettrer la sélection").disabled).toBe(false);
    expect(texte(racine)).toMatch(/Lettrage possible : 1\s170\s000/u);
  });

  it("une marque créée retire les lignes de la liste et s'affiche en vigueur", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const racine = await ouvrir();

    await cocher("FA-2026-018");
    await cocher("RG-2026-004");
    await cliquer(bouton("Lettrer la sélection"));

    expect(texte(racine)).toMatch(/Lettrage AA créé : 2 lignes rapprochées, 1\s170\s000/u);
    expect(texte(racine)).toMatch(/Marques de lettrage — 401100/);
    expect(texte(racine)).toMatch(/En vigueur/);
    // La facture et son règlement ne sont plus à lettrer ; l'à-nouveau reste.
    const cases = [...conteneur.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(cases.length).toBe(1);
    expect(cases[0]!.getAttribute("aria-label")).toMatch(/AN-0001/);
  });

  it("montre la proposition automatique avant d'écrire", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const racine = await ouvrir();

    const appliquer = bouton("Appliquer les propositions");
    expect(appliquer.disabled).toBe(true);
    expect(appliquer.getAttribute("title")).toMatch(/demandez d'abord une proposition/i);

    await cliquer(bouton("Proposer un lettrage automatique"));
    expect(texte(racine)).toMatch(/Propositions du lettrage automatique/i);
    expect(texte(racine)).toMatch(/Montant exact/);
    expect(texte(racine)).toMatch(/FA-2026-018, RG-2026-004/);
    expect(texte(racine)).toMatch(/Rien n'est encore écrit/i);

    await cliquer(bouton("Appliquer les propositions"));
    expect(texte(racine)).toMatch(/1 marque créée : AA \(1\s170\s000\)/u);
  });

  it("annonce l'absence de rapprochement automatique possible", async () => {
    const racine = await ouvrir();

    await cliquer(bouton("Proposer un lettrage automatique"));
    expect(texte(racine)).toMatch(/Aucun rapprochement de même montant/i);
    expect(bouton("Appliquer les propositions").disabled).toBe(true);
  });

  it("un délettrage rend les lignes à lettrer et laisse la marque datée", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const racine = await ouvrir();
    await cocher("FA-2026-018");
    await cocher("RG-2026-004");
    await cliquer(bouton("Lettrer la sélection"));

    await cliquer(bouton("Délettrer"));
    expect(texte(racine)).toMatch(/Lettrage AA défait : 2 lignes sont revenues à lettrer/);
    expect(texte(racine)).toMatch(/Défait le \d{2}\/\d{2}\/\d{4}/u);

    const cases = [...conteneur.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    expect(cases.length).toBe(3);
    // La marque défaite ne peut plus être défaite : le bouton est grisé, pas absent.
    expect(bouton("Délettrer").disabled).toBe(true);
  });

  it("télécharge l'état de lettrage dans le format choisi", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    await ouvrir();
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:perfectys";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;

    await cliquer(bouton("CSV (.csv)"));
    await cliquer(bouton("Excel (.xlsx)"), 30);
    expect(nomsTelecharges.some((nom) => /^perfectys_lettrage_401100-tous_\d{4}-\d{2}-\d{2}\.csv$/.test(nom))).toBe(
      true
    );
    expect(nomsTelecharges.some((nom) => /^perfectys_lettrage_401100-tous_\d{4}-\d{2}-\d{2}\.xlsx$/.test(nom))).toBe(
      true
    );
  });
});
