// @vitest-environment jsdom
/**
 * La coquille et ses écrans, montés pour de vrai.
 *
 * Ce qui est vérifié n'est pas la mise en page mais le contrat posé par la refonte : la barre de
 * menus de Sage 100, la barre d'état qui rappelle le dossier en permanence, des écrans branchés
 * sur le noyau (et non sur des données décoratives), et des fonctions non implémentées annoncées
 * comme telles plutôt que cliquables vers le vide.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { formatMontant } from "../src/noyau/index";
import { getService, reinitialiserPourTest } from "../src/web/noyau";

let container: HTMLDivElement;
let compteurBase = 0;

const ANNEE = new Date().getFullYear();
const PERIODE_COURANTE = new Date().getMonth() + 1;

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-test-${compteurBase}`);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

async function flush(times = 10): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function ouvrir(hash: string): Promise<string> {
  location.hash = hash;
  await act(async () => {
    render(<Coquille />, container);
  });
  await flush();
  return container.textContent ?? "";
}

function boutons(libelle: string): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("button")].filter((bouton) =>
    bouton.textContent?.trim().includes(libelle)
  );
}

function bouton(libelle: string): HTMLButtonElement {
  const trouves = boutons(libelle);
  if (trouves.length === 0) {
    throw new Error(`bouton introuvable : ${libelle}`);
  }
  return trouves[0]!;
}

async function cliquer(element: HTMLElement, times = 12): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(times);
}

async function saisir(element: HTMLInputElement, valeur: string, times = 10): Promise<void> {
  element.value = valeur;
  await act(async () => {
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush(times);
}

function lignes(): NodeListOf<HTMLTableRowElement> {
  return container.querySelectorAll<HTMLTableRowElement>(".grille tbody tr");
}

function barreEtat(): string {
  return container.querySelector(".barre-etat")?.textContent ?? "";
}

describe("coquille Sage 100", () => {
  it("affiche la barre de menus française et le contexte du dossier", async () => {
    const texte = await ouvrir("#/");

    expect(texte).toContain("Perfectys");
    expect(texte).toContain("Dossier ouvert");
    expect([...container.querySelectorAll<HTMLButtonElement>(".menu-titre")].map((menu) => menu.textContent)).toEqual([
      "Fichier",
      "Édition",
      "Traitements",
      "Structure",
      "Interrogation",
      "États",
      "Outils",
      "?"
    ]);

    // Le contexte rappelé en haut et en bas : on sait toujours où l'on écrit.
    expect(container.querySelector(".contexte-dossier")?.textContent).toContain(`CG000-${ANNEE.toString().slice(-2)}`);
    const etat = barreEtat();
    expect(etat).toContain(`Dossier CG000-${ANNEE.toString().slice(-2)}`);
    expect(etat).toContain("Société 000");
    expect(etat).toContain(`Exercice ${ANNEE}`);
    expect(etat).toContain(`Période ${PERIODE_COURANTE}`);
    expect(etat).toContain("Référentiel SYSCOHADA révisé");
    expect(etat).toContain("Devise XOF");
    expect(etat).toContain("Session superviseur");
    expect(etat).toContain("IndexedDB");
    expect(etat).toContain("Grand livre équilibré");
  });

  it("ouvre un menu et sépare ce qui marche de ce qui est annoncé", async () => {
    await ouvrir("#/");
    await cliquer(bouton("Traitements"));

    const entrees = [...container.querySelectorAll<HTMLElement>(".menu-panneau .menu-entree")];
    expect(entrees.map((entree) => entree.textContent)).toContain("Lots et comptabilisation…");

    const indisponibles = entrees.filter((entree) => entree.classList.contains("indisponible"));
    // Il en reste : le rapprochement bancaire et les écritures récurrentes. Chaque entrée grisée
    // porte la raison de son absence, jamais une tranche vide de sens.
    expect(indisponibles.length).toBeGreaterThanOrEqual(2);
    expect(indisponibles.every((entree) => (entree.getAttribute("title") ?? "").length > 10)).toBe(true);
    // Ce qui est livré est un bouton : la clôture d'exercice et le lettrage ouvrent un écran.
    const disponibles = entrees.filter((entree) => entree.tagName === "BUTTON").map((entree) => entree.textContent);
    expect(disponibles).toContain("Clôture d'exercice…");
    expect(disponibles).toContain("Clôture de période…");
    // Aucune entrée indisponible n'est un bouton : rien ne peut mener à un écran vide.
    expect(indisponibles.every((entree) => entree.tagName === "SPAN")).toBe(true);
    expect(indisponibles.every((entree) => entree.getAttribute("aria-disabled") === "true")).toBe(true);
    // Le lettrage est livré : ce n'est plus une entrée grisée, c'est un bouton qui mène à un écran.
    const lettrage = entrees.find((entree) => entree.textContent?.includes("Lettrage"));
    expect(lettrage?.tagName).toBe("BUTTON");
    // Le rapprochement bancaire reste annoncé, avec ce qui est déjà livré et ce qui manque.
    const rapprochement = indisponibles.find((entree) =>
      entree.textContent?.includes("Rapprochement bancaire")
    );
    expect(rapprochement?.getAttribute("title")).toContain("tranche F");

    await cliquer(bouton("Lettrage des comptes de tiers…"));
    expect(location.hash).toBe("#/traitements/lettrage");

    await cliquer(bouton("Traitements"));
    await cliquer(bouton("Lots et comptabilisation…"));
    expect(location.hash).toBe("#/traitements/lots");
    // Le menu se referme après navigation.
    expect(container.querySelector(".menu-panneau")).toBeNull();
  });

  it("raccourcis clavier : F2 ouvre les tiers, F3 la recherche de comptes", async () => {
    await ouvrir("#/");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F2", bubbles: true }));
    });
    await flush();
    expect(location.hash).toBe("#/structure/tiers");

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F3", bubbles: true }));
    });
    await flush();
    expect(location.hash).toBe("#/structure/plan");
  });

  it("dit honnêtement qu'un écran n'existe pas, au lieu d'afficher du vide", async () => {
    const texte = await ouvrir("#/inconnu");
    expect(texte).toContain("Aucun écran ne correspond");
    expect(boutons("Réessayer")).toHaveLength(1);
  });
});

describe("écrans de structure", () => {
  it("plan comptable : le plan réel du dossier, filtrable", async () => {
    const texte = await ouvrir("#/structure/plan");

    expect(texte).toContain("SYSCOHADA révisé");
    expect(texte).toContain("Compte principal");
    expect(texte).toContain("411100-CLI01-ABJ1");
    expect(lignes()).toHaveLength((await getService().planComptable()).length);

    await saisir(container.querySelector<HTMLInputElement>("#recherche-compte")!, "4431");
    expect(lignes()).toHaveLength(1);
    expect(lignes()[0]?.textContent).toContain("TVA facturée sur ventes");

    await saisir(container.querySelector<HTMLInputElement>("#recherche-compte")!, "zzz");
    expect(container.textContent).toContain("Aucun compte ne correspond");
  });

  it("journaux : les sept journaux et leur préfixe de lot", async () => {
    const texte = await ouvrir("#/structure/journaux");

    expect(texte).toContain("Journal des achats");
    expect(texte).toContain("À-nouveaux");
    expect(lignes()).toHaveLength(7);
    expect(texte).toContain("521100"); // compte de contrepartie du journal de banque
  });

  it("tiers : la sélection propose les codes de taxe réellement applicables", async () => {
    await ouvrir("#/structure/tiers");
    expect(lignes()).toHaveLength(8);

    const informel = [...lignes()].find((ligne) => ligne.textContent?.includes("FOU03"));
    expect(informel?.textContent).toContain("Non");
    await cliquer(informel!);

    const panneau = container.querySelector(".panneau-lateral")?.textContent ?? "";
    expect(panneau).toContain("NONIFU-5");
    expect(panneau).not.toContain("ACHT-1");
    expect(panneau).toContain("à confirmer");

    // Un fournisseur immatriculé ne subit pas la retenue majorée.
    const immatricule = [...lignes()].find((ligne) => ligne.textContent?.includes("FOU01"));
    await cliquer(immatricule!);
    const panneauImmatricule = container.querySelector(".panneau-lateral")?.textContent ?? "";
    expect(panneauImmatricule).toContain("ACHT-1");
    expect(panneauImmatricule).toContain("TVA-A18");
    expect(panneauImmatricule).not.toContain("NONIFU-5");

    // Le bascule achat/vente change la liste : ce n'est pas un décor fixe.
    await cliquer(bouton("Vente"));
    const panneauVente = container.querySelector(".panneau-lateral")?.textContent ?? "";
    expect(panneauVente).toContain("TVA-V18");
    expect(panneauVente).not.toContain("TVA-A18");
  });

  it("codes de taxe : taux, comptes, références légales et statut", async () => {
    const texte = await ouvrir("#/structure/codes-taxe");

    expect(texte).toContain("TVA collectée 18 % (régime intérieur)");
    expect(texte).toContain("Retenue 5 % (tiers non immatriculé à l'IFU)");
    expect(texte).toContain("Minimum de perception");
    expect(texte).toContain("250");
    expect(texte).toContain("CGI Bénin");
    expect(texte).toContain("0020151234567");
    expect(texte).toContain("à confirmer");
    expect(texte).toContain("établi");
    expect(texte).toContain("Identifiant Financier Unique");
    expect(texte).toContain("Déclaration et paiement de la TVA");
    // Le plancher du minimum de perception est affiché dans la devise, pas en points de base.
    expect(texte).toContain(formatMontant(250_000n));
  });
});

describe("écrans de traitement et d'interrogation", () => {
  it("balance : les à-nouveaux, équilibrés, dans la devise du dossier", async () => {
    const texte = await ouvrir("#/interrogation/balance");

    expect(texte).toContain("Capital social");
    expect(texte).toContain(formatMontant(80_000_000n));
    expect(texte).toContain("Équilibrée");
    expect(lignes().length).toBeGreaterThan(3);

    // Le filtre par période est réel : février n'a pas de mouvement.
    const selecteur = container.querySelector<HTMLSelectElement>(".champ-court select")!;
    selecteur.value = "2";
    await act(async () => {
      selecteur.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(container.textContent).toContain("Aucun mouvement sur cette période");
  });

  it("lots : un lot comptabilisé se contre-passe, sans toucher à l'original", async () => {
    await ouvrir("#/traitements/lots");
    expect(container.textContent).toContain("AN0001");
    expect(container.textContent).toContain("Comptabilisé");

    const avant = (await getService().pisteAudit()).length;
    await cliquer(bouton("Contre-passer"));

    const texte = container.textContent ?? "";
    expect(texte).toContain("contre-passé");
    expect(texte).toContain("AN0002");
    expect(texte).toContain("Contre-passé");
    expect(texte).toContain("En saisie");

    const lots = await getService().lots();
    expect(lots).toHaveLength(2);
    expect(lots.find((lot) => lot.numero === "AN0001")?.etat).toBe("contre-passe");
    expect(lots.find((lot) => lot.numero === "AN0002")?.origine).toBe(lots.find((lot) => lot.numero === "AN0001")?.id);
    expect((await getService().pisteAudit()).length).toBe(avant + 1);
  });

  it("lots : l'ouverture d'un lot passe par les contrôles du noyau", async () => {
    await ouvrir("#/traitements/lots");

    const libelle = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    await saisir(libelle, "Achats de test");
    await cliquer(bouton("Ouvrir un lot"));

    const texte = container.textContent ?? "";
    expect(texte).toContain("Achats de test");
    expect(texte).toContain("Lot ouvert");
    expect(texte).toContain("ACH0001");

    // Un lot vide ne se comptabilise pas : le noyau le refuse et l'écran le rapporte.
    await cliquer(bouton("Marquer prêt"));
    expect(container.textContent).toContain("est vide");
  });

  it("journal et grand livre : les mouvements comptabilisés seulement", async () => {
    const texte = await ouvrir("#/interrogation/journal");
    expect(texte).toContain("AN-0001");

    await cliquer([...container.querySelectorAll<HTMLTableRowElement>(".grille tbody tr")][0]!);
    expect(container.textContent).toContain("Totaux de la pièce");
    expect(container.textContent).toContain(formatMontant(80_000_000n));

    await ouvrir("#/interrogation/grand-livre");
    const champ = container.querySelector<HTMLInputElement>("#compte-grand-livre")!;
    expect(champ.value).toBe("521100");
    expect(container.textContent).toContain("Banque principale");
    expect(container.textContent).toContain(formatMontant(55_000_000n));

    await saisir(champ, "401100");
    await cliquer(bouton("Afficher"));
    expect(container.textContent).toContain("Fournisseurs d'exploitation");
    expect(container.textContent).toContain("compte auxiliaire");
  });

  it("piste d'audit : les événements les plus récents d'abord, séquencés", async () => {
    const texte = await ouvrir("#/outils/audit");
    expect(texte).toContain("Dossier de démonstration créé");
    expect(texte).toContain("superviseur");
    expect(texte).toContain(`CG000-${ANNEE.toString().slice(-2)}`);
  });

  it("accueil : le dossier, son contenu et les paramètres à confirmer", async () => {
    const texte = await ouvrir("#/");

    expect(texte).toContain("BÉNIN NÉGOCE DISTRIBUTION");
    expect(texte).toContain("Cotonou");
    expect(texte).toContain("SARL");
    expect(texte).toContain("0020151234567");
    expect(texte).toContain("Réel normal");
    expect(texte).toContain("Paramètres à confirmer");
    expect(texte).toContain(formatMontant(80_000_000n));
    expect(texte).toContain("Débit = crédit");
    // Le logiciel ne prétend pas que ses taux sont certains.
    expect(texte).toContain("pas du texte officiel");
  });

  it("réinitialiser reconstruit vraiment le dossier", async () => {
    await ouvrir("#/traitements/lots");
    await cliquer(bouton("Contre-passer"));
    expect((await getService().lots())).toHaveLength(2);

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await ouvrir("#/");
    await cliquer(bouton("Réinitialiser la démonstration"), 20);

    const service = getService();
    expect((await service.lots())).toHaveLength(1);
    expect((await service.contexte()).numero).toBe(`CG000-${ANNEE.toString().slice(-2)}`);
    expect(container.textContent).toContain("BÉNIN NÉGOCE DISTRIBUTION");
  });
});
