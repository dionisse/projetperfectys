/**
 * Le tableau des flux de trésorerie, produit depuis la balance et les mouvements.
 *
 * Ce qui est vérifié tient en une exigence : **l'état se contrôle lui-même**. La trésorerie de clôture
 * qu'il présente doit égaler la trésorerie réelle lue dans les comptes de classe 5 — c'est le contrôle
 * que l'imprimé officiel porte en bas de page, et c'est ce qui distingue un tableau de flux d'un
 * rapprochement de chiffres. Sont vérifiés aussi le classement par activité (une immobilisation n'est
 * pas un achat courant, un emprunt n'est pas une vente), la neutralisation des charges calculées dans
 * la capacité d'autofinancement, le virement interne qui n'est pas un flux, et l'annonce d'un compte
 * que le modèle ne connaît pas : l'écart est alors montré, avec sa cause, jamais absorbé.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ZERO, type ServiceComptable, type TableauDesFluxDeTresorerie } from "../src/noyau/index";
import { nouveauService, posterLot, xof } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

/** La ligne d'un tableau, par son code d'imprimé. */
function ligne(tableau: TableauDesFluxDeTresorerie, code: string) {
  const trouve = tableau.lignes.find((item) => item.code === code);
  if (!trouve) {
    throw new Error(`ligne ${code} introuvable dans le tableau`);
  }
  return trouve;
}

describe("le tableau des flux de trésorerie", () => {
  it("à l'ouverture, présente la trésorerie réelle et aucun flux", async () => {
    const tableau = await service.tableauDesFluxDeTresorerie();

    // Les à-nouveaux de la démonstration : banque 55 000 000, caisse 5 000 000.
    expect(ligne(tableau, "ZA").montant).toBe(xof("60000000"));
    expect(tableau.tresorerieOuverture).toBe(xof("60000000"));
    expect(tableau.capaciteAutofinancement).toBe(ZERO);
    expect(tableau.fluxOperationnels).toBe(ZERO);
    expect(tableau.fluxInvestissement).toBe(ZERO);
    expect(tableau.fluxFinancement).toBe(ZERO);
    expect(tableau.variationPresentee).toBe(ZERO);
    expect(tableau.tresoreriePresentee).toBe(xof("60000000"));
    expect(tableau.tresorerieReelle).toBe(xof("60000000"));
    expect(tableau.ecart).toBe(ZERO);
    expect(tableau.comptesNonCouverts).toEqual([]);
    expect(tableau.aVerifier).toBe(true);

    // Le détail est là : une ligne n'est pas un nombre sorti de nulle part.
    expect(ligne(tableau, "ZA").comptes.map((compte) => compte.compte)).toEqual(["521100", "571100"]);
  });

  it("classe un encaissement de vente en activité, TVA comprise, et se contrôle", async () => {
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-05",
      piece: "REC-2026-001",
      libelle: "Encaissement client au comptant",
      lignes: [{ compte: "701100", libelle: "Vente de marchandises", credit: "2000000", codesTaxe: ["TVA-V18"] }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    // La vente est encaisée : le résultat et la TVA collectée expliquent ensemble l'argent entré.
    expect(tableau.resultatNet).toBe(xof("2000000"));
    expect(tableau.capaciteAutofinancement).toBe(xof("2000000"));
    expect(ligne(tableau, "FE").montant).toBe(xof("360000"));
    expect(tableau.fluxOperationnels).toBe(xof("2360000"));
    expect(tableau.variationPresentee).toBe(xof("2360000"));
    expect(tableau.tresorerieReelle).toBe(xof("62360000"));
    expect(tableau.tresoreriePresentee).toBe(tableau.tresorerieReelle);
    expect(tableau.ecart).toBe(ZERO);
    // Le détail de la variation du passif circulant nomme le compte de TVA.
    expect(ligne(tableau, "FE").comptes.map((compte) => compte.compte)).toContain("443100");
  });

  it("classe une immobilisation payée comptant en investissement, pas en activité", async () => {
    await posterLot(service, {
      journalCode: "ACH",
      date: "2026-04-08",
      piece: "FA-2026-031",
      libelle: "Achat d'un véhicule de livraison",
      lignes: [{ compte: "245000", libelle: "Matériel de transport", debit: "8000000" }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    expect(ligne(tableau, "FG").montant).toBe(-xof("8000000"));
    expect(ligne(tableau, "FG").comptes[0]?.compte).toBe("245000");
    expect(tableau.fluxInvestissement).toBe(-xof("8000000"));
    expect(tableau.fluxOperationnels).toBe(ZERO);
    expect(tableau.variationPresentee).toBe(-xof("8000000"));
    expect(tableau.ecart).toBe(ZERO);
  });

  it("classe la TVA récupérable d'une immobilisation là où l'argent est sorti, et continue de se contrôler", async () => {
    await posterLot(service, {
      journalCode: "ACH",
      date: "2026-04-08",
      piece: "FA-2026-032",
      libelle: "Achat de matériel, TVA comprise",
      lignes: [{ compte: "244000", libelle: "Matériel et mobilier", debit: "1000000", codesTaxe: ["TVA-A18"] }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    // L'immobilisation est en investissement, la TVA qui l'accompagne en variation de créance : la
    // somme des deux est exactement l'argent sorti.
    expect(ligne(tableau, "FG").montant).toBe(-xof("1000000"));
    expect(ligne(tableau, "FD").montant).toBe(-xof("180000"));
    expect(tableau.variationPresentee).toBe(-xof("1180000"));
    expect(tableau.tresorerieReelle).toBe(xof("58820000"));
    expect(tableau.ecart).toBe(ZERO);
  });

  it("classe un emprunt encaissé puis remboursé en financement", async () => {
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-02",
      piece: "EMP-2026-001",
      libelle: "Mise en place d'un emprunt",
      lignes: [{ compte: "161000", libelle: "Emprunt bancaire", credit: "20000000" }],
      contrepartie: "521100"
    });
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-30",
      piece: "EMP-2026-002",
      libelle: "Première échéance d'emprunt",
      lignes: [{ compte: "161000", libelle: "Emprunt bancaire", debit: "2000000" }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    expect(ligne(tableau, "FO").montant).toBe(xof("20000000"));
    expect(ligne(tableau, "FP").montant).toBe(-xof("2000000"));
    expect(ligne(tableau, "ZE").montant).toBe(xof("18000000"));
    expect(tableau.fluxFinancement).toBe(xof("18000000"));
    expect(tableau.variationPresentee).toBe(xof("18000000"));
    expect(tableau.ecart).toBe(ZERO);
  });

  it("classe une augmentation de capital en financement par les capitaux propres", async () => {
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-03",
      piece: "CAP-2026-001",
      libelle: "Apport en numéraire",
      lignes: [{ compte: "101000", libelle: "Capital social", credit: "5000000" }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    expect(ligne(tableau, "FK").montant).toBe(xof("5000000"));
    expect(ligne(tableau, "ZD").montant).toBe(xof("5000000"));
    expect(tableau.fluxFinancement).toBe(xof("5000000"));
    expect(tableau.ecart).toBe(ZERO);
  });

  it("ne compte pas un virement de caisse à banque comme un flux, et le dit", async () => {
    await posterLot(service, {
      journalCode: "CAI",
      date: "2026-04-10",
      piece: "VI-2026-004",
      libelle: "Remise d'espèces en banque",
      lignes: [{ compte: "521100", libelle: "Banque principale", debit: "1500000" }],
      contrepartie: "571100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    // L'argent a changé de poche : la trésorerie nette n'a pas bougé.
    expect(tableau.virementsInternes).toBe(1);
    expect(tableau.variationPresentee).toBe(ZERO);
    expect(tableau.tresorerieReelle).toBe(xof("60000000"));
    expect(tableau.ecart).toBe(ZERO);
  });

  it("neutralise une dotation provisionnée : une charge calculée ne sort pas d'argent", async () => {
    await posterLot(service, {
      journalCode: "ACH",
      date: "2026-04-30",
      piece: "OD-2026-011",
      libelle: "Dotation aux provisions pour risques",
      lignes: [{ compte: "697000", libelle: "Dotation aux provisions pour dépréciation", debit: "750000" }],
      contrepartie: "151000"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    expect(tableau.resultatNet).toBe(-xof("750000"));
    // La dotation est ajoutée au résultat : la capacité d'autofinancement reste nulle.
    expect(tableau.capaciteAutofinancement).toBe(ZERO);
    expect(tableau.variationPresentee).toBe(ZERO);
    expect(tableau.tresorerieReelle).toBe(xof("60000000"));
    expect(tableau.ecart).toBe(ZERO);
    // La provision n'est pas une dette d'exploitation : elle ne passe pas dans les variations.
    expect(tableau.comptesNonCouverts).toEqual([]);
  });

  it("montre l'écart et sa cause quand un compte n'entre dans aucune ligne", async () => {
    // Une distribution passée directement au compte de résultat, sans le compte de dividendes à payer :
    // l'argent est sorti, et le modèle ne sait pas où le classer.
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-20",
      piece: "DIV-2026-001",
      libelle: "Distribution passée au résultat",
      lignes: [{ compte: "121000", libelle: "Résultat de l'exercice", debit: "3000000" }],
      contrepartie: "521100"
    });

    const tableau = await service.tableauDesFluxDeTresorerie();

    expect(tableau.tresorerieReelle).toBe(xof("57000000"));
    expect(tableau.variationPresentee).toBe(ZERO);
    // L'écart n'est pas absorbé : il est montré, et le compte en cause est nommé.
    // L'écart est présenté moins réel : le tableau présente 3 000 000 de plus qu'il n'en explique.
    expect(tableau.ecart).toBe(xof("3000000"));
    expect(tableau.comptesNonCouverts.map((compte) => compte.compte)).toEqual(["121000"]);
    expect(tableau.comptesNonCouverts[0]?.variation).toBe(xof("3000000"));
  });

  it("cumule depuis l'ouverture de l'exercice quand l'état est arrêté à une période", async () => {
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-02-10",
      piece: "REC-2026-014",
      libelle: "Encaissement de février",
      lignes: [{ compte: "706100", libelle: "Prestation de service", credit: "900000" }],
      contrepartie: "521100"
    });
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-05",
      piece: "REC-2026-040",
      libelle: "Encaissement d'avril",
      lignes: [{ compte: "706100", libelle: "Prestation de service", credit: "400000" }],
      contrepartie: "521100"
    });

    const arreteEnMars = await service.tableauDesFluxDeTresorerie(3);
    const exercice = await service.tableauDesFluxDeTresorerie();

    expect(arreteEnMars.variationPresentee).toBe(xof("900000"));
    expect(arreteEnMars.tresorerieReelle).toBe(xof("60900000"));
    expect(arreteEnMars.ecart).toBe(ZERO);
    expect(arreteEnMars.dateFin).toBe("2026-03-31");
    expect(exercice.variationPresentee).toBe(xof("1300000"));
    expect(exercice.ecart).toBe(ZERO);
  });

  it("refuse une période qui n'existe pas, comme les autres états", async () => {
    // 13 et 14 existent : ce sont les périodes d'ajustements et d'écritures de clôture.
    await expect(service.tableauDesFluxDeTresorerie(99)).rejects.toThrow(/période/i);
    await expect(service.tableauDesFluxDeTresorerie(undefined, 1999)).rejects.toThrow(/exercice/i);
  });
});
