// @vitest-environment jsdom
/**
 * L'écran de sauvegarde et restauration, monté pour de vrai.
 *
 * Ce qui est vérifié : le fichier téléchargé est bien une sauvegarde lisible, la restauration est
 * refusée tant qu'aucun fichier n'est choisi ou tant que la marche arrière n'a pas été téléchargée,
 * un fichier qui n'est pas une sauvegarde donne sa raison plutôt qu'un échec muet, et un fichier
 * valide montre ce qu'il contient **avant** d'être restauré.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { FORMAT_SAUVEGARDE } from "../src/noyau/index";
import { getService, reinitialiserPourTest } from "../src/web/noyau";

let conteneur: HTMLDivElement;
let compteurBase = 940;
let nomsTelecharges: string[] = [];
let dernierBlob: Blob | null = null;

async function flush(fois = 14): Promise<void> {
  for (let i = 0; i < fois; i++) {
    await act(async () => {
      await new Promise((resolution) => setTimeout(resolution, 0));
    });
  }
}

async function ouvrir(route = "/outils/sauvegarde"): Promise<HTMLElement> {
  location.hash = `#${route}`;
  await act(async () => {
    render(<Coquille />, conteneur);
  });
  await flush();
  return conteneur;
}

const texte = (racine: HTMLElement | null): string => (racine?.textContent ?? "").replace(/\s+/gu, " ").trim();

function bouton(libelle: string): HTMLButtonElement {
  const trouve = [...conteneur.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => texte(item) === libelle
  );
  if (!trouve) {
    throw new Error(`bouton introuvable : ${libelle}`);
  }
  return trouve;
}

async function cliquer(cible: HTMLElement, fois = 16): Promise<void> {
  await act(async () => {
    cible.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(fois);
}

/** Donne un fichier à l'entrée de restauration, comme le ferait l'utilisateur. */
async function choisirFichier(nom: string, contenu: string): Promise<void> {
  const entree = conteneur.querySelector<HTMLInputElement>('input[type="file"]');
  if (!entree) {
    throw new Error("entrée de fichier introuvable");
  }
  const fichier = new File([contenu], nom, { type: "application/json" });
  Object.defineProperty(entree, "files", { value: [fichier], configurable: true });
  await act(async () => {
    entree.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(16);
}

async function cocher(libelle: string, valeur: boolean): Promise<void> {
  const cible = [...conteneur.querySelectorAll<HTMLLabelElement>("label.case-a-cocher")].find((item) =>
    texte(item).includes(libelle)
  );
  const entree = cible?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!entree) {
    throw new Error(`case introuvable : ${libelle}`);
  }
  await act(async () => {
    entree.checked = valeur;
    entree.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush();
}

beforeEach(() => {
  compteurBase += 1;
  nomsTelecharges = [];
  dernierBlob = null;
  reinitialiserPourTest(`perfectys-sauvegarde-${compteurBase}`);
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  // Le déclenchement du téléchargement est intercepté : on vérifie le nom et le contenu du fichier.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    if (this.download) {
      nomsTelecharges.push(this.download);
    }
  });
  // L'URL d'objet est capturée au passage : c'est le seul endroit où le contenu du fichier passe.
  (URL as unknown as { createObjectURL: (blob: Blob) => string }).createObjectURL = (blob: Blob) => {
    dernierBlob = blob;
    return `blob:perfectys/${Math.random().toString(16).slice(2)}`;
  };
  (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
});

afterEach(() => {
  conteneur.remove();
  location.hash = "";
  vi.restoreAllMocks();
});

describe("Écran de sauvegarde et restauration", () => {
  it("s'atteint par Fichier › Sauvegarde du dossier, qui n'est plus une entrée annoncée", async () => {
    await ouvrir("/");
    await cliquer(bouton("Fichier"));
    const panneau = conteneur.querySelector<HTMLElement>('.menu-panneau[aria-label="Menu Fichier"]');
    expect(panneau).not.toBeNull();

    const entrees = [...panneau!.querySelectorAll<HTMLElement>(".menu-entree")];
    const sauvegarde = entrees.find((entree) => texte(entree).includes("Sauvegarde du dossier"));
    // Livrée : c'est un bouton qui mène à l'écran, plus une entrée grisée qui l'annonce.
    expect(sauvegarde?.tagName).toBe("BUTTON");
    expect(sauvegarde?.classList.contains("indisponible")).toBe(false);

    const restauration = entrees.find((entree) => texte(entree).includes("Restauration"));
    expect(restauration?.tagName).toBe("BUTTON");

    await cliquer(sauvegarde!);
    expect(location.hash).toBe("#/outils/sauvegarde");
    expect(texte(conteneur)).toMatch(/Outils › Sauvegarde du dossier/u);
  });

  it("montre le dossier en cours et télécharge une sauvegarde lisible", async () => {
    const racine = await ouvrir();
    const affiche = texte(racine);
    expect(affiche).toMatch(/Sauvegarde du dossier/);
    expect(affiche).toMatch(/BÉNIN NÉGOCE DISTRIBUTION/);
    expect(affiche).toMatch(/Comptes au plan :\s*55/u);
    expect(affiche).toMatch(/Codes de taxe :\s*14/u);
    expect(affiche).toMatch(/perfectys-compta\/sauvegarde/u);

    // Sans sauvegarde téléchargée, la restauration est impossible et le bouton dit pourquoi.
    const restaurer = bouton("Restaurer ce fichier");
    expect(restaurer.disabled).toBe(true);
    expect(restaurer.getAttribute("title")).toMatch(/Choisissez d'abord un fichier/u);

    await cliquer(bouton("Télécharger la sauvegarde (.json)"));

    expect(nomsTelecharges.length).toBe(1);
    expect(nomsTelecharges[0]).toMatch(/^perfectys_sauvegarde_cg000-26-2026_\d{4}-\d{2}-\d{2}\.json$/);
    expect(texte(racine)).toMatch(/Sauvegarde téléchargée/u);

    // Le fichier téléchargé est une vraie sauvegarde : elle se relit et se vérifie.
    expect(dernierBlob).not.toBeNull();
    expect(dernierBlob!.type).toBe("application/json;charset=utf-8");
    const brut = JSON.parse(await dernierBlob!.text()) as Record<string, unknown>;
    expect(brut.format).toBe(FORMAT_SAUVEGARDE);
    expect(brut.version).toBe(1);
    const contenu = brut.contenu as Record<string, number>;
    expect(contenu.comptes).toBe(55);
    expect(contenu.codesTaxe).toBe(14);
    expect((brut.societe as Record<string, string>).raisonSociale).toBe("BÉNIN NÉGOCE DISTRIBUTION");
  });

  it("refuse un fichier qui n'est pas une sauvegarde, avec la raison", async () => {
    const racine = await ouvrir();
    await cliquer(bouton("Télécharger la sauvegarde (.json)"));

    await choisirFichier("comptes.json", JSON.stringify({ societe: "autre chose" }));
    const refus = texte(racine);
    expect(refus).toMatch(/comptes\.json/);
    expect(refus).toMatch(/n'est pas une sauvegarde Perfectys Compta/u);
    expect(bouton("Restaurer ce fichier").disabled).toBe(true);
    expect(bouton("Restaurer ce fichier").getAttribute("title")).toMatch(/pas restaurable/u);

    // Un JSON invalide n'est pas pris pour une sauvegarde corrompue : il est dit illisible.
    await choisirFichier("casse.json", "{ ce n'est pas du JSON");
    expect(texte(racine)).toMatch(/n'est pas un JSON valide/u);
  });

  it("montre ce qu'une sauvegarde contient avant de la restaurer, et exige la marche arrière", async () => {
    const racine = await ouvrir();
    const service = getService();
    const sauvegarde = await service.produireSauvegarde();

    await choisirFichier("perfectys_sauvegarde.json", JSON.stringify(sauvegarde));
    const annonce = texte(racine);
    // Le service de l'interface tourne sur l'horloge réelle : la date est celle du jour.
    expect(annonce).toMatch(/sauvegarde du \d{4}-\d{2}-\d{2}/u);
    expect(annonce).toMatch(/produite par superviseur/u);
    expect(annonce).toMatch(/BÉNIN NÉGOCE DISTRIBUTION/);
    expect(annonce).toMatch(/55 comptes/u);
    expect(annonce).toMatch(/Mêmes société et exercice que le dossier en cours \?\s*oui/u);

    // Le fichier est bon, mais rien n'a encore été téléchargé comme marche arrière : la restauration
    // reste grisée, et dit ce qui manque.
    const restaurer = bouton("Restaurer ce fichier");
    expect(restaurer.disabled).toBe(true);
    expect(restaurer.getAttribute("title")).toMatch(/seule marche arrière/u);

    await cocher("J'ai téléchargé une sauvegarde du dossier en cours", true);
    expect(bouton("Restaurer ce fichier").disabled).toBe(false);

    await cliquer(bouton("Restaurer ce fichier"), 24);
    const apres = texte(racine);
    expect(apres).toMatch(/Dossier restauré : BÉNIN NÉGOCE DISTRIBUTION, exercice 2026/u);
    expect(apres).toMatch(/Le dossier précédent .* a été remplacé/u);
    expect(apres).toMatch(/tracé dans la piste d'audit/u);
    // Le tableau avant/après montre ce que le remplacement a changé.
    expect(apres).toMatch(/Mouvements comptabilisés/);
    expect(apres).toMatch(/Avant/);
    expect(apres).toMatch(/Après/);

    const audit = await service.pisteAudit();
    expect(audit.at(-1)!.action).toBe("Restauration du dossier");
  });
});
