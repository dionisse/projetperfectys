// @vitest-environment jsdom
/**
 * L'écran de déclaration de TVA, monté pour de vrai.
 *
 * Ce qui est vérifié : que l'écran ne ressaisit rien et affiche le recalcul du noyau, qu'il
 * rapproche ce recalcul du grand livre et **signale un écart** au lieu de l'absorber dans un total,
 * qu'il annonce ses réserves quand le paquet pays porte des paramètres à confirmer, et que le
 * téléchargement produit un fichier nommé selon la convention.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import {
  BENIN,
  ZERO,
  analyserMontant,
  formatMontant,
  oppose,
  proposerLignesDeTaxe,
  type DateCivile,
  type DemandeLigne,
  type Montant
} from "../src/noyau/index";
import { getService, reinitialiserPourTest } from "../src/web/noyau";

let container: HTMLDivElement;
let compteurBase = 200;

const AUJOURDHUI = new Date().toISOString().slice(0, 10) as DateCivile;
const PERIODE = new Date().getMonth() + 1;
const xof = (texte: string): Montant => analyserMontant(texte, BENIN.devise);

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-declaration-${compteurBase}`);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

async function flush(times = 14): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function ouvrir(): Promise<string> {
  location.hash = "#/etats/declaration-tva";
  await act(async () => {
    render(<Coquille />, container);
  });
  await flush();
  return container.textContent ?? "";
}

function bouton(libelle: string): HTMLButtonElement {
  const trouve = [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) =>
    item.textContent?.trim().includes(libelle)
  );
  if (!trouve) {
    throw new Error(`bouton introuvable : ${libelle}`);
  }
  return trouve;
}

async function cliquer(element: HTMLElement): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

/** Saisit et comptabilise une écriture par le noyau, comme le ferait l'écran de saisie. */
async function poster(demande: {
  journalCode: string;
  piece: string;
  libelle: string;
  ligne: { compte: string; debit?: string; credit?: string; codesTaxe?: string[] };
  contrepartie: string;
  tiers?: string;
}): Promise<void> {
  const service = getService();
  const lot = await service.creerLot({
    journalCode: demande.journalCode,
    date: AUJOURDHUI,
    libelle: demande.libelle
  });
  const debit = demande.ligne.debit !== undefined ? xof(demande.ligne.debit) : ZERO;
  const credit = demande.ligne.credit !== undefined ? xof(demande.ligne.credit) : ZERO;
  const codes = demande.ligne.codesTaxe ?? [];

  const lignes: DemandeLigne[] = [{ compte: demande.ligne.compte, libelle: demande.libelle, codesTaxe: codes }];
  if (debit !== ZERO) {
    lignes[0]!.debit = debit;
  }
  if (credit !== ZERO) {
    lignes[0]!.credit = credit;
  }
  for (const taxe of proposerLignesDeTaxe(
    { compte: demande.ligne.compte, libelle: demande.libelle, debit, credit, codesTaxe: codes },
    BENIN.codesTaxe
  )) {
    lignes.push({
      compte: taxe.compte,
      libelle: taxe.libelle,
      ...(taxe.sens === "debit" ? { debit: taxe.debit } : { credit: taxe.credit })
    });
  }
  const entier = (valeur: string | Montant | undefined): Montant => (typeof valeur === "bigint" ? valeur : ZERO);
  const totalDebit = lignes.reduce<Montant>((total, ligne) => total + entier(ligne.debit), ZERO);
  const totalCredit = lignes.reduce<Montant>((total, ligne) => total + entier(ligne.credit), ZERO);
  const ecart = totalDebit - totalCredit;
  lignes.push({
    compte: demande.tiers ? `${demande.contrepartie}-${demande.tiers}` : demande.contrepartie,
    libelle: "Contrepartie",
    ...(demande.tiers ? { tiersCode: demande.tiers } : {}),
    ...(ecart > ZERO ? { credit: ecart } : { debit: oppose(ecart) })
  });

  await service.ajouterEcriture(lot.id, {
    piece: demande.piece,
    date: AUJOURDHUI,
    libelle: demande.libelle,
    lignes
  });
  await service.marquerPret(lot.id);
  await service.comptabiliserLot(lot.id);
}

describe("écran de déclaration de TVA", () => {
  it("une période sans opération produit une déclaration néant, datée et réservée", async () => {
    const texte = await ouvrir();

    expect(texte).toContain("Déclaration de TVA");
    expect(texte).toContain(`Période ${PERIODE}`);
    expect(texte).toContain("Aucune opération taxée dans cette période");
    expect(texte).toContain("néant");
    expect(texte).toContain("20 du mois suivant");
    // Le paquet pays béninois porte des paramètres non confirmés : l'écran le dit.
    expect(texte).toContain("Paramètres à confirmer");
    expect(texte).toContain("pas dans le texte officiel");
    expect(texte).toContain("Rapprochement conforme");
    expect(texte).toContain("état de contrôle, pas le formulaire administratif");
    // Les acomptes d'impôt sur le résultat ne sont pas de la TVA.
    expect(texte).toContain("442100");
  });

  it("recalcule depuis le grand livre : collectée, déductible et nette à payer", async () => {
    await poster({
      journalCode: "VTE",
      piece: "FV-0001",
      libelle: "Vente de marchandises",
      ligne: { compte: "701100", credit: "2000000", codesTaxe: ["TVA-V18"] },
      contrepartie: "411100",
      tiers: "CLI01"
    });
    await poster({
      journalCode: "ACH",
      piece: "FA-0001",
      libelle: "Achat de marchandises",
      ligne: { compte: "601100", debit: "1000000", codesTaxe: ["TVA-A18", "ACHT-1"] },
      contrepartie: "401100",
      tiers: "FOU01"
    });

    await ouvrir();
    const texte = container.textContent ?? "";

    expect(texte).toContain("TVA-V18");
    expect(texte).toContain("TVA collectée 18 %");
    expect(texte).toContain("TVA-A18");
    expect(texte).toContain(formatMontant(2_000_000n));
    expect(texte).toContain(formatMontant(360_000n));
    expect(texte).toContain(formatMontant(180_000n));
    expect(texte).toContain("18 %");
    expect(texte).toContain("art. 232");
    // La retenue d'acompte reste dehors, la retenue de TVA serait dedans.
    expect(texte).not.toContain("ACHT-1");
    expect(texte).toContain("TVA nette à payer");
    expect(texte).toContain("Rapprochement conforme");
  });

  it("signale un écart entre le recalcul et le grand livre", async () => {
    await poster({
      journalCode: "OD",
      piece: "OD-0001",
      libelle: "Régularisation de TVA déductible",
      ligne: { compte: "445200", debit: "50000" },
      contrepartie: "521100"
    });

    await ouvrir();
    const texte = container.textContent ?? "";

    expect(texte).toContain("Écart avec le grand livre");
    expect(texte).toContain("ligne de taxe saisie à la main");
    expect(texte).toContain(formatMontant(-50_000n));
    expect(texte).not.toContain("Rapprochement conforme");
    expect(container.querySelector(".bloc.avertissement")).not.toBeNull();
  });

  it("change de période sans recharger le dossier", async () => {
    await poster({
      journalCode: "VTE",
      piece: "FV-0001",
      libelle: "Vente de marchandises",
      ligne: { compte: "701100", credit: "2000000", codesTaxe: ["TVA-V18"] },
      contrepartie: "411100",
      tiers: "CLI01"
    });
    await ouvrir();
    expect(container.textContent).toContain(formatMontant(360_000n));

    const autre = PERIODE === 1 ? 2 : PERIODE - 1;
    const selecteur = container.querySelector<HTMLSelectElement>(".champ-court select")!;
    selecteur.value = String(autre);
    await act(async () => {
      selecteur.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();

    const texte = container.textContent ?? "";
    expect(texte).toContain(`Période ${autre}`);
    expect(texte).toContain("néant");
    expect(texte).not.toContain(formatMontant(360_000n));
  });

  it("le bouton de téléchargement produit un fichier nommé selon la convention", async () => {
    await ouvrir();
    const noms: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      noms.push(this.download);
    });

    await cliquer(bouton("Télécharger en CSV"));

    expect(noms).toHaveLength(1);
    expect(noms[0]).toMatch(/^perfectys_declaration-tva_.+_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(bouton("Télécharger en CSV").title).toContain("Excel et PDF suivent");
  });
});
