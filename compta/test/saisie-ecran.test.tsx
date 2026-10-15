// @vitest-environment jsdom
/**
 * La table de détail, saisie pour de vrai.
 *
 * Ce test rejoue la journée d'un comptable : ouvrir un lot, taper une ligne d'achat, cocher les
 * codes de taxe, laisser le noyau générer les lignes de taxe, équilibrer, désigner le fournisseur,
 * enregistrer, déclarer le lot prêt, le comptabiliser — puis vérifier que la balance en porte la
 * trace. Il vérifie aussi les refus : une ligne taxée dont la taxe a été retirée ne passe pas, un
 * montant à décimales en francs CFA ne passe pas.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Coquille } from "../src/ui/coquille";
import { getService, reinitialiserPourTest } from "../src/web/noyau";

let container: HTMLDivElement;
let compteurBase = 100;

const ANNEE = new Date().getFullYear();
const PERIODE = new Date().getMonth() + 1;

beforeEach(() => {
  compteurBase += 1;
  reinitialiserPourTest(`perfectys-saisie-${compteurBase}`);
  sessionStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  location.hash = "";
});

async function flush(times = 14): Promise<void> {
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

/** Bouton dont le libellé est exactement celui-ci : évite « Retirer la ligne » pour « Retirer ». */
function boutonExact(libelle: string): HTMLButtonElement {
  const trouve = [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (bouton) => bouton.textContent?.trim() === libelle
  );
  if (!trouve) {
    throw new Error(`bouton introuvable (libellé exact) : ${libelle}`);
  }
  return trouve;
}

function bouton(libelle: string): HTMLButtonElement {
  const trouves = boutons(libelle);
  if (trouves.length === 0) {
    throw new Error(`bouton introuvable : ${libelle}`);
  }
  return trouves[0]!;
}

async function cliquer(element: HTMLElement, times = 16): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush(times);
}

async function saisir(element: HTMLInputElement | HTMLSelectElement, valeur: string): Promise<void> {
  element.value = valeur;
  await act(async () => {
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
  await flush(6);
}

async function touche(element: HTMLElement, key: string, ctrlKey = false): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, ctrlKey, bubbles: true }));
  });
  await flush(6);
}

/** Champ de la grille de saisie, désigné comme le ferait un lecteur d'écran. */
function cellule(colonne: string, ligne: number): HTMLInputElement {
  const trouve = container.querySelector<HTMLInputElement>(`[aria-label="${colonne}, ligne ${ligne}"]`);
  if (!trouve) {
    throw new Error(`cellule introuvable : ${colonne}, ligne ${ligne}`);
  }
  return trouve;
}

/**
 * Champ d'un formulaire, retrouvé par son intitulé exact.
 *
 * Seul le texte direct de l'étiquette compte : une liste déroulante contient le texte de ses
 * options, qui ne fait pas partie de l'intitulé.
 */
function champ(intitule: string): HTMLInputElement {
  const etiquette = [...container.querySelectorAll("label")].find((item) => {
    const texte = [...item.childNodes]
      .filter((noeud) => noeud.nodeType === 3)
      .map((noeud) => noeud.textContent ?? "")
      .join("")
      .trim();
    return texte === intitule;
  });
  const trouve = etiquette?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
  if (!trouve) {
    throw new Error(`champ introuvable : ${intitule}`);
  }
  return trouve as HTMLInputElement;
}

function lignesDeSaisie(): NodeListOf<HTMLTableRowElement> {
  return container.querySelectorAll<HTMLTableRowElement>(".grille-saisie tbody tr");
}

async function cocher(code: string): Promise<void> {
  const ligne = [...container.querySelectorAll<HTMLElement>(".codes-choix li")].find((item) =>
    item.textContent?.includes(code)
  );
  const caseACocher = ligne?.querySelector<HTMLInputElement>("input[type=checkbox]");
  if (!caseACocher) {
    throw new Error(`code de taxe introuvable dans le panneau : ${code}`);
  }
  caseACocher.checked = !caseACocher.checked;
  await act(async () => {
    caseACocher.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await flush(6);
}

/** Ouvre un lot d'achats et saisit une ligne d'achat de 1 000 000. */
async function preparerAchat(): Promise<void> {
  await ouvrir("#/traitements/saisie");
  await saisir(champ("Libellé du lot"), "Achats du mois");
  await cliquer(bouton("Ouvrir un lot"));
  await saisir(cellule("Compte", 1), "601100");
  await saisir(cellule("Libellé", 1), "Achat de marchandises — Grossiste Port Autonome");
  await saisir(cellule("Débit", 1), "1 000 000");
}

describe("table de détail", () => {
  it("ouvre un lot, génère les taxes, équilibre, enregistre et comptabilise", async () => {
    await ouvrir("#/traitements/saisie");
    expect(container.textContent).toContain("Aucun lot sélectionné");

    await saisir(champ("Libellé du lot"), "Achats du mois");
    await cliquer(bouton("Ouvrir un lot"));
    expect(container.textContent).toContain("Lot ouvert : vous pouvez saisir.");
    expect(container.textContent).toContain("ACH0001");
    // La pièce suivante est proposée : la saisie enchaîne sans ressaisir le format.
    expect(champ("Pièce").value).toBe(`FA-${ANNEE}-001`);
    expect(champ("Compte de contrepartie").value).toBe("401100");

    await saisir(cellule("Compte", 1), "601100");
    await saisir(cellule("Libellé", 1), "Achat de marchandises — Grossiste Port Autonome");
    await saisir(cellule("Débit", 1), "1 000 000");

    // Le paquet pays propose les codes applicables à un achat intérieur.
    const panneau = container.querySelector("#panneau-taxe")!;
    expect(panneau.textContent).toContain("TVA-A18");
    expect(panneau.textContent).toContain("ACHT-1");
    expect(panneau.textContent).not.toContain("TVA-V18");

    await cocher("TVA-A18");
    await cocher("ACHT-1");
    await cliquer(bouton("Générer les lignes de taxe"));

    expect(container.textContent).toContain("2 lignes de taxe générées");
    expect(lignesDeSaisie()).toHaveLength(3);
    // La TVA déductible au débit, l'acompte retenu au crédit : le sens n'est pas laissé au hasard.
    expect(cellule("Compte", 2).value).toBe("445200");
    expect(cellule("Débit", 2).value).toBe("180000");
    expect(cellule("Compte", 3).value).toBe("442100");
    expect(cellule("Crédit", 3).value).toBe("10000");
    // Les lignes produites par la machine sont marquées comme telles.
    expect(container.querySelectorAll(".grille-saisie tr.generee")).toHaveLength(2);

    await cliquer(bouton("Équilibrer"));
    expect(lignesDeSaisie()).toHaveLength(4);
    expect(cellule("Crédit", 4).value).toBe("1170000");
    expect(container.textContent).toContain("compte auxiliaire");

    // Le tiers se lit dans le compte segmenté : le choisir réécrit le numéro.
    await saisir(cellule("Tiers", 4), "FOU01");
    expect(cellule("Compte", 4).value).toBe("401100-FOU01");
    expect(container.textContent).toContain("équilibrée");

    await cliquer(bouton("Enregistrer l'écriture"));
    expect(container.textContent).toContain("enregistrée dans le lot ACH0001");
    expect(container.textContent).toContain(`FA-${ANNEE}-001`);
    expect(container.textContent).toContain("ACH-00001");
    // La pièce suivante est proposée, la grille est vidée.
    expect(champ("Pièce").value).toBe(`FA-${ANNEE}-002`);
    expect(lignesDeSaisie()).toHaveLength(1);

    await cliquer(bouton("Marquer prêt à comptabiliser"));
    expect(container.textContent).toContain("prêt à comptabiliser");
    await cliquer(bouton("Comptabiliser le lot"));
    expect(container.textContent).toContain("comptabilisé");

    // Ce qui est affiché est ce qui est écrit : la balance porte les quatre comptes.
    const balance = await getService().balance({ periode: PERIODE });
    const parCompte = new Map(balance.map((ligne) => [ligne.compte, ligne] as const));
    expect(parCompte.get("601100")?.totalDebit).toBe(1_000_000n);
    expect(parCompte.get("445200")?.totalDebit).toBe(180_000n);
    expect(parCompte.get("442100")?.totalCredit).toBe(10_000n);
    expect(parCompte.get("401100")?.totalCredit).toBe(1_170_000n);
    expect((await getService().contexte()).equilibre).toBe(true);
  });

  it("refuse une ligne taxée dont la ligne de taxe a été retirée", async () => {
    await preparerAchat();
    await cocher("TVA-A18");
    await cliquer(bouton("Générer les lignes de taxe"));
    expect(lignesDeSaisie()).toHaveLength(2);

    // L'utilisateur retire la taxe : le noyau refuse, l'écran rapporte sa raison exacte.
    await cliquer(container.querySelector<HTMLButtonElement>('[aria-label="Retirer la ligne 2"]')!);
    expect(lignesDeSaisie()).toHaveLength(1);
    expect(cellule("Codes taxe", 1).textContent).toContain("TVA-A18");

    await saisir(champ("Compte de contrepartie"), "521100");
    await cliquer(bouton("Équilibrer"));
    await cliquer(bouton("Enregistrer l'écriture"));

    const retour = container.querySelector('[role="alert"]');
    expect(retour?.textContent).toContain("TVA-A18");
    expect(retour?.textContent).toContain("445200");
    const lots = await getService().lots();
    expect(lots.find((lot) => lot.numero === "ACH0001")!.ecritures).toHaveLength(0);
  });

  it("refuse un montant à décimales : le franc CFA n'en a pas", async () => {
    await preparerAchat();
    await saisir(cellule("Débit", 1), "1000,50");

    expect(container.querySelector(".grille-saisie input.illisible")).not.toBeNull();
    expect(container.textContent).toContain("montant illisible");
    expect(bouton("Équilibrer").disabled).toBe(true);

    await cliquer(bouton("Enregistrer l'écriture"));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("illisible");
  });

  it("le brouillon survit à un changement d'écran", async () => {
    await preparerAchat();
    expect(cellule("Débit", 1).value).toBe("1 000 000");

    await ouvrir("#/structure/tiers");
    expect(container.textContent).toContain("FOU03");

    await ouvrir("#/traitements/saisie");
    expect(container.textContent).toContain("Saisie en cours reprise sur le lot ACH0001");
    expect(cellule("Compte", 1).value).toBe("601100");
    expect(cellule("Débit", 1).value).toBe("1 000 000");
    expect(cellule("Libellé", 1).value).toContain("Grossiste Port Autonome");
  });

  it("le clavier déplace la sélection et ajoute une ligne en bas de table", async () => {
    await preparerAchat();

    await touche(cellule("Débit", 1), "ArrowDown");
    expect(lignesDeSaisie()).toHaveLength(2);
    expect(lignesDeSaisie()[1]?.className).toContain("selection");

    await touche(cellule("Débit", 2), "Enter");
    expect(lignesDeSaisie()).toHaveLength(3);
    expect(lignesDeSaisie()[2]?.className).toContain("selection");

    await touche(cellule("Libellé", 3), "ArrowUp");
    expect(lignesDeSaisie()[1]?.className).toContain("selection");
  });

  it("une écriture enregistrée se retire tant que le lot est en saisie", async () => {
    await preparerAchat();
    await saisir(champ("Compte de contrepartie"), "521100");
    await cliquer(bouton("Équilibrer"));
    await cliquer(bouton("Enregistrer l'écriture"));
    expect(container.textContent).toContain("ACH-00001");

    await cliquer(boutonExact("Retirer"));
    expect(container.textContent).toContain("retirée du lot");
    expect(container.textContent).toContain("Aucune écriture dans ce lot");
    expect((await getService().lots()).find((lot) => lot.numero === "ACH0001")!.ecritures).toHaveLength(0);
    expect((await getService().pisteAudit()).some((item) => item.action === "Écriture retirée du lot")).toBe(true);
  });

  it("un journal qui n'est ni achats ni ventes ne propose pas de code de taxe", async () => {
    await ouvrir("#/traitements/saisie");
    await saisir(container.querySelector<HTMLSelectElement>('select[aria-label="Journal"]') ?? champ("Journal"), "OD");
    await saisir(champ("Libellé du lot"), "Opérations diverses");
    await cliquer(bouton("Ouvrir un lot"));

    expect(container.textContent).toContain("OD0001");
    expect(container.textContent).toContain("ne s'y appliquent pas");
    expect(cellule("Codes taxe", 1).disabled).toBe(true);
    // Le compte de contrepartie proposé suit le journal.
    expect(champ("Compte de contrepartie").value).toBe("");
  });

  it("un journal de ventes propose la TVA collectée, et l'exportation change la liste", async () => {
    await ouvrir("#/traitements/saisie");
    await saisir(champ("Journal"), "VTE");
    await saisir(champ("Libellé du lot"), "Ventes du mois");
    await cliquer(bouton("Ouvrir un lot"));

    expect(container.textContent).toContain("VTE0001");
    const panneau = container.querySelector("#panneau-taxe")!;
    expect(panneau.textContent).toContain("TVA-V18");
    expect(panneau.textContent).not.toContain("ACHT-1");

    const exportation = panneau.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    exportation.checked = true;
    await act(async () => {
      exportation.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await flush();
    expect(container.querySelector("#panneau-taxe")?.textContent).toContain("TVA-V0");
  });

  it("un lot comptabilisé ne reçoit plus de saisie", async () => {
    await ouvrir("#/traitements/saisie");
    await saisir(champ("Journal"), "AN");

    // Le lot d'à-nouveaux de la démonstration est déjà comptabilisé.
    const selecteurLot = champ("Lot") as unknown as HTMLSelectElement;
    const comptabilise = [...selecteurLot.options].find((option) => option.textContent?.includes("Comptabilisé"));
    expect(comptabilise).toBeDefined();
    await saisir(selecteurLot, comptabilise!.value);

    expect(container.textContent).toContain("AN0001");
    expect(container.textContent).toContain("Comptabilisé");
    // Aucune action de comptabilisation n'est proposée sur un lot déjà passé au grand livre.
    expect(boutons("Marquer prêt à comptabiliser")).toHaveLength(0);
    expect(boutons("Comptabiliser le lot")).toHaveLength(0);
    expect(boutons("Supprimer le lot")).toHaveLength(0);

    await cliquer(bouton("Enregistrer l'écriture"));
    const alerte = container.querySelector('[role="alert"]');
    expect(alerte?.textContent).toContain("ne reçoit plus de saisie");
    expect(alerte?.textContent).toContain("comptabilisé");
  });
});
