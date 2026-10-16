// @vitest-environment jsdom
/**
 * L'écran de rapprochement bancaire, monté pour de vrai.
 *
 * Ce qui est vérifié : que l'état de rapprochement montre les deux soldes et ce qui reste inexpliqué,
 * que les boutons sont grisés tant qu'une sélection ne tombe pas juste — avec la raison, pas un
 * silence —, que le pointage automatique est proposé avant d'être appliqué, que dépointer rend la
 * ligne au rapprochement, et qu'un relevé importé d'un fichier est **lu et montré avant d'être créé**.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";
import { xof } from "./aide";

let conteneur: HTMLDivElement;
let compteurBase = 900;

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(route = "/traitements/rapprochement"): Promise<HTMLElement> {
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

/** Colle un contenu de fichier dans le champ de l'import. */
async function coller(contenu: string): Promise<void> {
  const champ = conteneur.querySelector<HTMLTextAreaElement>('textarea[aria-label="Contenu du fichier de relevé"]');
  if (!champ) {
    throw new Error("champ de contenu introuvable");
  }
  await act(async () => {
    champ.value = contenu;
    champ.dispatchEvent(new Event("input", { bubbles: true }));
    champ.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(8);
}

/**
 * Les lignes du relevé qui ne sont pas encore pointées.
 *
 * Compter les occurrences du texte « à rapprocher » ne suffit pas : la même formule apparaît dans un
 * titre et dans le récapitulatif des pointages. On compte les cellules, qui ne mentent pas.
 */
function lignesARapprocher(): number {
  return [...conteneur.querySelectorAll("td")].filter((cellule) => texte(cellule) === "à rapprocher").length;
}

/** Un encaissement de 3 500 000 passé au journal de banque, dans la période du relevé de mars. */
async function encaisserEnBanque(piece: string, montantLigne: string): Promise<void> {
  const service = getService();
  const lot = await service.creerLot({ journalCode: "BQ", date: "2026-03-05", libelle: "Encaissement client" });
  await service.ajouterEcriture(lot.id, {
    piece,
    date: "2026-03-05",
    libelle: "Virement SUPERMARCHÉ CADJEHOUN",
    lignes: [
      { compte: "521100", libelle: "Virement client", debit: xof(montantLigne) },
      { compte: "411100-CLI01", libelle: "Virement client", credit: xof(montantLigne), tiersCode: "CLI01" }
    ]
  });
  await service.marquerPret(lot.id);
  await service.comptabiliserLot(lot.id);
}

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-rapprochement-${compteurBase}`);
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

describe("Écran de rapprochement bancaire", () => {
  it("montre les deux soldes, l'écart et ce qui reste inexpliqué", async () => {
    const racine = await ouvrir();
    const rendu = texte(racine);

    expect(rendu).toMatch(/État de rapprochement/);
    expect(rendu).toMatch(/Relevé de mars 2026 — BOA Bénin/);
    expect(rendu).toMatch(/Solde comptable à la fin du relevé\s*55\s000\s000/u);
    expect(rendu).toMatch(/Solde du relevé\s*\(ouverture\s*55\s000\s000\s*\+\s*4\s*lignes\)\s*57\s381\s500/u);
    expect(rendu).toMatch(/Rapprochement conforme/);
    expect(rendu).toMatch(/Reste inexpliqué\s*0/u);

    // Les quatre lignes de la banque sont là, aucune n'est comptabilisée.
    expect(rendu).toMatch(/Virement SUPERMARCHÉ CADJEHOUN/);
    expect(rendu).toMatch(/Frais de tenue de compte et commissions/);
    expect(lignesARapprocher()).toBe(4);
    expect(rendu).toMatch(/Aucun mouvement du compte 521100 sur la période du relevé/);

    // Rien n'est pointable : le bouton le dit, au lieu de laisser deviner.
    const pointer = bouton("Pointer la sélection");
    expect(pointer.disabled).toBe(true);
    expect(pointer.getAttribute("title")).toMatch(/Cochez une ligne du relevé et un mouvement/u);

    const appliquer = bouton("Appliquer les propositions");
    expect(appliquer.disabled).toBe(true);
    expect(appliquer.getAttribute("title")).toMatch(/rien n'est écrit sans qu'elle ait été montrée/u);

    // L'import d'un fichier est livré : un bouton qui agit, plus une entrée grisée.
    void racine;
    const importer = bouton("Importer un fichier de relevé");
    expect(importer.disabled).toBe(false);
    expect(
      [...conteneur.querySelectorAll<HTMLSpanElement>("span.indisponible")].some((item) =>
        texte(item).includes("Importer")
      )
    ).toBe(false);
  });

  it("importe un relevé : le fichier est lu et montré avant d'être créé", async () => {
    const racine = await ouvrir();

    // Rien n'est écrit tant que le fichier n'a pas été lu : le bouton de création est grisé.
    await cliquer(bouton("Importer un fichier de relevé"));
    expect(texte(racine)).toMatch(/Import d'un relevé bancaire/);
    expect(bouton("Lire le fichier").disabled).toBe(true);
    const creer = bouton("Créer le relevé depuis l'import");
    expect(creer.disabled).toBe(true);
    expect(creer.getAttribute("title")).toMatch(/sans que le fichier ait été lu/i);

    // Un relevé d'exemple, construit depuis le grand livre du dossier : l'import est essayable sans
    // fichier sous la main, et il porte deux frais que la comptabilité n'a pas passés.
    await cliquer(bouton("Charger un relevé d'exemple"), 20);
    expect(bouton("Lire le fichier").disabled).toBe(false);

    await cliquer(bouton("Lire le fichier"), 20);
    const lu = texte(racine);
    expect(lu).toMatch(/opération[s]? à importer au format CSV/i);
    expect(lu).toMatch(/Format reconnu\s*CSV \(texte séparé\)/u);
    expect(lu).toMatch(/Colonnes reconnues/u);
    expect(lu).toMatch(/Date d'opération ← Date opération/u);
    expect(lu).toMatch(/FRAIS DE TENUE DE COMPTE/);
    expect(lu).toMatch(/COMMISSION DE VIREMENT/);
    expect(lu).toMatch(/à importer/);
    // Rien n'est encore écrit.
    expect((await getService().releves()).length).toBe(1);

    await cliquer(bouton("Créer le relevé depuis l'import"), 22);
    const apres = texte(racine);
    expect(apres).toMatch(/importé au format CSV \(texte séparé\) : 3 opérations/u);
    expect(apres).toMatch(/Aucune écriture n'est passée/i);
    // Le relevé importé est celui qui est montré, et le rapprochement voit les frais.
    expect(apres).toMatch(/Relevé d'exemple/);
    expect(apres).toMatch(/Frais|frais/u);
    expect((await getService().releves()).length).toBe(2);
  });

  it("refuse un fichier illisible et n'écrit rien", async () => {
    const racine = await ouvrir();
    await cliquer(bouton("Importer un fichier de relevé"));

    await coller("Libellé;Montant\nVirement;1 000\n");
    await cliquer(bouton("Lire le fichier"), 18);

    expect(texte(racine)).toMatch(/Aucune date d'opération/i);
    expect(bouton("Créer le relevé depuis l'import").disabled).toBe(true);
    expect((await getService().releves()).length).toBe(1);
  });

  it("propose le pointage, l'applique, puis dépointe", async () => {
    const racine = await ouvrir();
    await encaisserEnBanque("BQ-2026-001", "3500000");

    await cliquer(bouton("Actualiser"), 18);
    expect(texte(racine)).toMatch(/BQ-2026-001/);

    await cliquer(bouton("Proposer un pointage automatique"), 14);
    expect(texte(racine)).toMatch(/1 pointage proposé\. Rien n'est encore écrit/u);
    expect(texte(racine)).toMatch(/Propositions de pointage/);
    expect(texte(racine)).toMatch(/le montant/);

    // La proposition est montrée : le bouton d'application est actif.
    expect(bouton("Appliquer les propositions").disabled).toBe(false);
    await cliquer(bouton("Appliquer les propositions"), 18);

    const apres = texte(racine);
    expect(apres).toMatch(/1 pointage appliqué/u);
    expect(apres).toMatch(/3 500 000/u);
    // Trois lignes restent à rapprocher, la première est pointée.
    expect(lignesARapprocher()).toBe(3);
    expect(apres).toMatch(/Pointages du relevé/);
    expect(apres).toMatch(/en vigueur/);

    // Un relevé pointé ne se supprime pas.
    expect(bouton("Supprimer ce relevé").disabled).toBe(true);
    expect(bouton("Supprimer ce relevé").getAttribute("title")).toMatch(/il faut d'abord dépointer/u);

    const dossier = await getService().lire();
    expect(dossier.pointages.length).toBe(1);
    expect(dossier.pointages[0]!.montant).toBe(xof("3500000"));

    // Dépointer rend la ligne au rapprochement.
    await cliquer(bouton("Dépointer"), 18);
    const defait = texte(racine);
    expect(defait).toMatch(/Pointage .* défait/u);
    expect(lignesARapprocher()).toBe(4);
    expect(defait).toMatch(/défait/);
    expect((await getService().lire()).pointages[0]!.defaitLe).not.toBeNull();
  });

  it("refuse de pointer deux montants différents et ouvre la saisie d'un relevé", async () => {
    const racine = await ouvrir();
    await encaisserEnBanque("BQ-2026-002", "1200000");
    await cliquer(bouton("Actualiser"), 18);

    // Une ligne du relevé (les frais, 18 500) et un mouvement du compte (1 200 000) : le pointage
    // est refusé, et le bouton dit pourquoi plutôt que d'écrire une différence.
    const cases = [...conteneur.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
    const ligneDesFrais = cases.find((item) => (item.getAttribute("aria-label") ?? "").includes("FRAIS-03"));
    const mouvement = cases.find((item) => (item.getAttribute("aria-label") ?? "").includes("BQ-2026-002"));
    expect(ligneDesFrais).toBeDefined();
    expect(mouvement).toBeDefined();

    for (const cible of [ligneDesFrais!, mouvement!]) {
      await act(async () => {
        cible.checked = true;
        cible.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await flush(6);
    }

    const pointer = bouton("Pointer la sélection");
    expect(pointer.disabled).toBe(true);
    expect(pointer.getAttribute("title")).toMatch(/Les montants diffèrent/u);
    expect(pointer.getAttribute("title")).toMatch(/Comptabilisez la différence/u);
    expect((await getService().lire()).pointages.length).toBe(0);

    // La saisie d'un relevé est le chemin d'entrée, en attendant l'import d'un fichier.
    await cliquer(bouton("Saisir un relevé"), 8);
    const formulaire = texte(racine);
    expect(formulaire).toMatch(/Compte de trésorerie/);
    expect(formulaire).toMatch(/Solde d'ouverture \(sens banque\)/);
    expect(bouton("Enregistrer le relevé").disabled).toBe(false);
    expect(bouton("Ajouter une ligne").disabled).toBe(false);
  });
});
