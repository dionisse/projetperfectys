// @vitest-environment jsdom
/**
 * Les écrans de paramétrage, montés pour de vrai : société, plan comptable, taux.
 *
 * Ce qui est vérifié tient à une règle : ce qui ne peut pas être modifié est **grisé avec sa raison**,
 * pas laissé à un refus. Un compte mouvementé ne change pas de groupe, un taux qui a servi ne se
 * réécrit pas — l'écran le dit avant que l'utilisateur n'essaie.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { posterVente } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 950;

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

const texte = (racine: HTMLElement | null): string => (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

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

/** Saisit une valeur dans le champ dont l'étiquette porte ce libellé. */
async function saisir(etiquette: string, valeur: string): Promise<void> {
  const champ = [...conteneur.querySelectorAll<HTMLLabelElement>("label")].find((item) =>
    texte(item).startsWith(etiquette)
  );
  const entree = champ?.querySelector<HTMLInputElement>("input, select");
  if (!entree) {
    throw new Error(`champ introuvable : ${etiquette}`);
  }
  await act(async () => {
    entree.value = valeur;
    entree.dispatchEvent(new Event("input", { bubbles: true }));
    entree.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(6);
}

/** Coche ou décoche une case à cocher d'après son libellé. */
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
  await flush(6);
}

/** Sélectionne une ligne de grille d'après son contenu. */
async function selectionnerLigne(contenu: string): Promise<void> {
  const ligne = [...conteneur.querySelectorAll<HTMLTableRowElement>("table.grille tbody tr")].find((item) =>
    texte(item).includes(contenu)
  );
  if (!ligne) {
    throw new Error(`ligne de grille introuvable : ${contenu}`);
  }
  await cliquer(ligne, 10);
}

function champDe(etiquette: string): HTMLInputElement | HTMLSelectElement {
  const champ = [...conteneur.querySelectorAll<HTMLLabelElement>("label")].find((item) =>
    texte(item).startsWith(etiquette)
  );
  const entree = champ?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if (!entree) {
    throw new Error(`champ introuvable : ${etiquette}`);
  }
  return entree;
}

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-parametres-${compteurBase}`);
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

describe("Écran Société", () => {
  it("montre la société fictive, la modifie et refuse un identifiant fiscal invalide", async () => {
    const racine = await ouvrir("/structure/societe");
    expect(texte(racine)).toMatch(/BÉNIN NÉGOCE DISTRIBUTION/);
    expect(texte(racine)).toMatch(/fictive/);
    expect(texte(racine)).toMatch(/XOF/);
    // La devise ne se change pas ici, et l'écran le dit.
    expect(texte(racine)).toMatch(/non modifiable/);

    await cliquer(bouton("Modifier la société"), 8);
    expect(champDe("Raison sociale").value).toBe("BÉNIN NÉGOCE DISTRIBUTION");

    // Un IFU manifestement faux est refusé, avec le message de la règle du paquet pays.
    await saisir("Raison sociale", "BÉNIN NÉGOCE DISTRIBUTION SARL");
    await saisir("Identifiant Financier Unique", "12");
    await cliquer(bouton("Enregistrer"), 12);
    expect(texte(racine)).toMatch(/IFU invalide/u);
    expect((await getService().lire()).societe.raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION");

    await saisir("Identifiant Financier Unique", "0020181456789");
    await cliquer(bouton("Enregistrer"), 14);
    const apres = texte(racine);
    expect(apres).toMatch(/Société enregistrée/u);
    expect(apres).toMatch(/BÉNIN NÉGOCE DISTRIBUTION SARL/);
    expect(apres).toMatch(/0020181456789/);

    const dossier = await getService().lire();
    expect(dossier.societe.raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION SARL");
    expect(dossier.audit.at(-1)!.action).toBe("Société modifiée");
    expect(dossier.audit.at(-1)!.detail).toContain("« BÉNIN NÉGOCE DISTRIBUTION » → « BÉNIN NÉGOCE DISTRIBUTION SARL »");
  });
});

describe("Écran Plan comptable", () => {
  it("fige le groupe et la suppression d'un compte mouvementé, et laisse ajouter un compte neuf", async () => {
    await posterVente(getService(), { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    const racine = await ouvrir("/structure/plan");

    // La colonne « Utilisation » dit ce qui tient à chaque compte, avant qu'on essaie de le casser.
    expect(texte(racine)).toMatch(/Utilisation/);
    await selectionnerLigne("701100");
    expect(texte(racine)).toMatch(/Modifier 701100/);
    expect(texte(racine)).toMatch(/son groupe et son solde initial sont figés/u);
    expect(champDe("Groupe d'états financiers").disabled).toBe(true);
    expect(bouton("Supprimer ce compte").disabled).toBe(true);
    expect(bouton("Supprimer ce compte").getAttribute("title")).toMatch(/il ne se supprime pas/u);
    // Le libellé, lui, reste modifiable.
    expect(champDe("Libellé").disabled).toBe(false);
    await saisir("Libellé", "Ventes de marchandises — négoce");
    await cliquer(bouton("Enregistrer"), 12);
    expect(texte(racine)).toMatch(/Compte 701100 mis à jour/u);
    expect((await getService().planComptable()).find((item) => item.comptePrincipal === "701100")!.libelle).toBe(
      "Ventes de marchandises — négoce"
    );

    // Un compte neuf s'ajoute, et il est aussitôt proposé à la saisie.
    await cliquer(bouton("Ajouter un compte"), 8);
    expect(texte(racine)).toMatch(/Ajouter un compte au plan/);
    expect(bouton("Ajouter le compte").disabled).toBe(true);
    expect(bouton("Ajouter le compte").getAttribute("title")).toMatch(/obligatoires/u);
    await saisir("Numéro", "674100");
    await saisir("Libellé", "Services bancaires");
    expect(bouton("Ajouter le compte").disabled).toBe(false);
    await cliquer(bouton("Ajouter le compte"), 14);
    expect(texte(racine)).toMatch(/Compte 674100 ajouté au plan/u);
    expect((await getService().planComptable()).some((item) => item.comptePrincipal === "674100")).toBe(true);

    // Un numéro déjà pris est refusé, et le refus est affiché plutôt que deviné.
    await cliquer(bouton("Ajouter un compte"), 8);
    await saisir("Numéro", "674100");
    await saisir("Libellé", "Doublon");
    await cliquer(bouton("Ajouter le compte"), 12);
    expect(texte(racine)).toMatch(/existe déjà dans le plan/u);
  });

  it("désactive un compte au lieu de le supprimer quand il a servi", async () => {
    const racine = await ouvrir("/structure/plan");
    await selectionnerLigne("671000");
    expect(bouton("Supprimer ce compte").disabled).toBe(false);
    await cocher("Compte actif", false);
    await cliquer(bouton("Enregistrer"), 12);
    expect(texte(racine)).toMatch(/Compte 671000 mis à jour/u);
    expect((await getService().planComptable()).find((item) => item.comptePrincipal === "671000")!.actif).toBe(false);
    expect(texte(racine)).toMatch(/désactivé/);
  });
});

describe("Écran Codes de taxe", () => {
  it("fige un taux qui a servi, corrige un taux neuf, crée un code et reprend ceux du paquet pays", async () => {
    await posterVente(getService(), { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    const racine = await ouvrir("/structure/codes-taxe");

    expect(texte(racine)).toMatch(/Codes applicables aux écritures — 14 au dossier/u);
    expect(texte(racine)).toMatch(/A servi/);

    // TVA-V18 a servi : son taux est figé, avec la raison.
    await selectionnerLigne("TVA-V18");
    expect(texte(racine)).toMatch(/Modifier TVA-V18/);
    expect(texte(racine)).toMatch(/son taux, sa base, son sens et son compte de taxe sont figés/u);
    expect(champDe("Taux (%)").disabled).toBe(true);
    expect(champDe("Taux (%)").getAttribute("title")).toMatch(/ne se réécrit pas/u);
    expect(bouton("Supprimer ce code").disabled).toBe(true);
    // Le libellé et la référence restent modifiables.
    expect(champDe("Libellé").disabled).toBe(false);

    // ACHT-1 n'a pas servi : son taux se corrige, et il cesse d'être « à confirmer ».
    await selectionnerLigne("ACHT-1");
    expect(champDe("Taux (%)").disabled).toBe(false);
    expect(champDe("Taux (%)").value).toBe("1");
    expect(texte(racine)).toMatch(/100 points de base — 1 %/u);
    await saisir("Taux (%)", "1,5");
    expect(texte(racine)).toMatch(/150 points de base — 1,50 %/u);
    await cliquer(bouton("Enregistrer"), 14);
    expect(texte(racine)).toMatch(/taux 1 % → 1,50 %/u);

    const codes = await getService().codesTaxe();
    expect(codes.find((code) => code.code === "ACHT-1")!.pointsDeBase).toBe(150n);
    expect(codes.find((code) => code.code === "ACHT-1")!.aVerifier).toBe(false);

    // Un taux illisible est refusé avant d'être écrit.
    await selectionnerLigne("ACHT-1");
    await saisir("Taux (%)", "beaucoup");
    expect(texte(racine)).toMatch(/Taux illisible/u);
    expect(bouton("Enregistrer").disabled).toBe(true);

    // Un code créé au dossier est proposé à la saisie suivante.
    await cliquer(bouton("Créer un code de taxe"), 8);
    expect(texte(racine)).toMatch(/Nouveau code de taxe/);
    await saisir("Code", "TVA-V19");
    await saisir("Libellé", "TVA collectée 19 %");
    await saisir("Taux (%)", "19");
    await saisir("Référence légale", "Loi de finances pour 2027, art. 4");
    await cliquer(bouton("Créer le code"), 14);
    expect(texte(racine)).toMatch(/Code TVA-V19 créé/u);
    expect((await getService().codesTaxe()).some((code) => code.code === "TVA-V19")).toBe(true);

    // Reprendre les taux du paquet pays remet ACHT-1 à 1 % et « à confirmer », sans toucher à ce qui
    // a servi ni supprimer le code créé au dossier.
    await cliquer(bouton("Reprendre les taux du paquet pays"), 16);
    const bilan = texte(racine);
    expect(bilan).toMatch(/Taux repris du paquet Bénin/u);
    expect(bilan).toMatch(/repris : ACHT-1/u);
    expect(bilan).toMatch(/codes créés au dossier, conservés : TVA-V19/u);

    const repris = await getService().codesTaxe();
    expect(repris.find((code) => code.code === "ACHT-1")!.pointsDeBase).toBe(100n);
    expect(repris.find((code) => code.code === "ACHT-1")!.aVerifier).toBe(true);
    expect(repris.find((code) => code.code === "TVA-V18")!.pointsDeBase).toBe(1800n);
    expect(repris.some((code) => code.code === "TVA-V19")).toBe(true);
  });
});
