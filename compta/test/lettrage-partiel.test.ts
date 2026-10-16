/**
 * Lettrage partiel — le règlement à-compte.
 *
 * Ce qui est vérifié : qu'un acompte crée une marque qui porte ses imputations, que la ligne entamée
 * revient à lettrer avec son reste et son état, qu'on ne peut imputer ni plus qu'il n'est dû ni en
 * oubliant une ligne choisie, qu'une même dette peut recevoir plusieurs acomptes, qu'un délettrage
 * rend l'imputation, que la proposition automatique impute du plus ancien au plus récent, que la
 * situation du lettrage et l'interrogation de compte somment les restes, et qu'une marque produite
 * avant le lettrage partiel — sans champ `portions` — se lit encore.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ZERO,
  consommeSurLigne,
  deserialiserEtat,
  etatDeLettrage,
  proposerLettrageAutomatique,
  resteDeLigne,
  serialiserEtat,
  verifierImputations,
  type DateCivile,
  type Lettrage,
  type LigneALettrer,
  type Montant,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot, xof } from "./aide";

let service: ServiceComptable;

const TIERS = "FOU02";
const COMPTE = "401100";

beforeEach(() => {
  service = nouveauService().service;
});

/** Ce qu'une facture laisse au crédit du fournisseur : hors-taxe + TVA 18 %. */
const totalFacture = (horsTaxe: string): Montant => (BigInt(horsTaxe) * 117n) / 100n;

async function facturer(demande: { piece: string; montant: string; date: DateCivile }): Promise<void> {
  await posterAchat(service, {
    date: demande.date,
    piece: demande.piece,
    montant: demande.montant,
    tiers: TIERS
  });
}

/** Un règlement, partiel ou total : le montant est dit en unités de la devise. */
async function regler(demande: { piece: string; montant: Montant; date: DateCivile }): Promise<void> {
  await posterLot(service, {
    journalCode: "BQ",
    date: demande.date,
    piece: demande.piece,
    libelle: `Règlement fournisseur ${demande.piece}`,
    lignes: [
      {
        compte: `${COMPTE}-${TIERS}`,
        libelle: `Règlement ${demande.piece}`,
        debit: demande.montant.toString()
      },
      { compte: "521100", libelle: "Banque — règlement fournisseur", credit: demande.montant.toString() }
    ],
    contrepartie: ""
  });
}

/** Une facture de 1 170 000 due au fournisseur, et un acompte de 500 000 : le cas d'école. */
async function factureEtAcompte(): Promise<{ facture: LigneALettrer; acompte: LigneALettrer }> {
  await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
  await regler({ piece: "RG-2026-007", montant: xof("500000"), date: "2026-04-02" });
  const lignes = await service.lignesALettrer({ compte: COMPTE, tiersCode: TIERS });
  const facture = lignes.find((ligne) => ligne.piece === "FA-2026-021");
  const acompte = lignes.find((ligne) => ligne.piece === "RG-2026-007");
  if (!facture || !acompte) {
    throw new Error(`lignes introuvables : ${lignes.map((ligne) => ligne.piece).join(", ")}`);
  }
  return { facture, acompte };
}

const critere = { compte: COMPTE, tiersCode: TIERS };

describe("un acompte sur une facture", () => {
  it("crée une marque partielle et laisse la facture ouverte pour son reste", async () => {
    const { facture, acompte } = await factureEtAcompte();

    const marque = await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, acompte.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: acompte.ligneId, montant: "500000" }
      ]
    });

    // La marque dit ce qui a été rapproché, pas ce qui était dû.
    expect(marque.code).toBe("AA");
    expect(marque.montant).toBe(xof("500000"));
    expect(marque.portions).toEqual([
      { ligneId: facture.ligneId, montant: xof("500000") },
      { ligneId: acompte.ligneId, montant: xof("500000") }
    ]);

    const apres = await service.lignesALettrer(critere);
    const entamee = apres.find((ligne) => ligne.ligneId === facture.ligneId);
    expect(entamee?.reste).toBe(xof("670000"));
    expect(entamee?.consomme).toBe(xof("500000"));
    expect(entamee?.etat).toBe("partielle");
    expect(entamee?.marques).toEqual(["AA"]);
    // L'acompte est entièrement imputé : il n'est plus à lettrer.
    expect(apres.some((ligne) => ligne.ligneId === acompte.ligneId)).toBe(false);
  });

  it("refuse d'imputer plus qu'il reste dû", async () => {
    const { facture, acompte } = await factureEtAcompte();

    await expect(
      service.lettrer({
        compte: COMPTE,
        lignes: [facture.ligneId, acompte.ligneId],
        imputations: [
          { ligneId: facture.ligneId, montant: "1200000" },
          { ligneId: acompte.ligneId, montant: "1200000" }
        ]
      })
    ).rejects.toThrow(/On ne lettre pas plus qu'il n'est dû/i);
  });

  it("refuse des imputations qui ne couvrent pas toutes les lignes choisies", async () => {
    const { facture, acompte } = await factureEtAcompte();

    await expect(
      service.lettrer({
        compte: COMPTE,
        lignes: [facture.ligneId, acompte.ligneId],
        imputations: [{ ligneId: acompte.ligneId, montant: "500000" }]
      })
    ).rejects.toThrow(/doivent couvrir toutes les lignes choisies/i);
  });

  it("refuse une imputation qui porte sur une ligne non choisie", async () => {
    const { facture, acompte } = await factureEtAcompte();
    const autre = (await service.lignesALettrer({ compte: COMPTE })).find(
      (ligne) => ligne.ligneId !== facture.ligneId && ligne.ligneId !== acompte.ligneId
    );

    await expect(
      service.lettrer({
        compte: COMPTE,
        lignes: [facture.ligneId, acompte.ligneId],
        imputations: [
          { ligneId: facture.ligneId, montant: "500000" },
          { ligneId: autre!.ligneId, montant: "500000" }
        ]
      })
    ).rejects.toThrow(/lignes non choisies/i);
  });

  it("refuse des imputations qui ne s'équilibrent pas", async () => {
    const { facture, acompte } = await factureEtAcompte();

    await expect(
      service.lettrer({
        compte: COMPTE,
        lignes: [facture.ligneId, acompte.ligneId],
        imputations: [
          { ligneId: facture.ligneId, montant: "500000" },
          { ligneId: acompte.ligneId, montant: "400000" }
        ]
      })
    ).rejects.toThrow(/un à-compte se lettre au montant du règlement/i);
  });

  it("sans imputations, lettre tout le reste : le comportement ordinaire ne change pas", async () => {
    await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
    await regler({ piece: "RG-2026-007", montant: totalFacture("1000000"), date: "2026-04-02" });
    const lignes = await service.lignesALettrer(critere);

    const marque = await service.lettrer({
      compte: COMPTE,
      lignes: lignes.map((ligne) => ligne.ligneId)
    });
    // Une marque totale n'a pas d'imputations à porter : chaque ligne est prise pour son reste.
    expect(marque.portions).toBeUndefined();
    expect(marque.montant).toBe(xof("1170000"));
    expect(await service.lignesALettrer(critere)).toHaveLength(0);
  });

  it("sans imputations, refuse une sélection qui ne tombe pas juste", async () => {
    const { facture, acompte } = await factureEtAcompte();

    await expect(
      service.lettrer({ compte: COMPTE, lignes: [facture.ligneId, acompte.ligneId] })
    ).rejects.toThrow(/n'est pas équilibré/i);
  });
});

describe("plusieurs acomptes sur une même dette", () => {
  it("additionne les marques et solde la dette au dernier acompte", async () => {
    await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
    await regler({ piece: "RG-2026-007", montant: xof("500000"), date: "2026-04-02" });
    await regler({ piece: "RG-2026-011", montant: xof("670000"), date: "2026-05-06" });

    let lignes = await service.lignesALettrer(critere);
    const facture = lignes.find((ligne) => ligne.piece === "FA-2026-021")!;
    const premier = lignes.find((ligne) => ligne.piece === "RG-2026-007")!;
    const second = lignes.find((ligne) => ligne.piece === "RG-2026-011")!;

    await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, premier.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: premier.ligneId, montant: "500000" }
      ]
    });

    lignes = await service.lignesALettrer(critere);
    expect(lignes.find((ligne) => ligne.ligneId === facture.ligneId)?.reste).toBe(xof("670000"));

    const seconde = await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, second.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "670000" },
        { ligneId: second.ligneId, montant: "670000" }
      ]
    });
    // Deux marques sur la même ligne : la seconde n'efface pas la première.
    expect(seconde.code).toBe("AB");

    lignes = await service.lignesALettrer(critere);
    expect(lignes.some((ligne) => ligne.ligneId === facture.ligneId)).toBe(false);
    const marques = await service.lettrages(COMPTE);
    expect(marques.filter((marque) => marque.lignes.includes(facture.ligneId))).toHaveLength(2);
  });
});

describe("délettrage d'un à-compte", () => {
  it("rend l'imputation : la ligne revient pour son montant entier", async () => {
    const { facture, acompte } = await factureEtAcompte();
    await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, acompte.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: acompte.ligneId, montant: "500000" }
      ]
    });

    const défaite = await service.delettrer("AA");
    expect(défaite.defaitLe).not.toBeNull();

    const apres = await service.lignesALettrer(critere);
    const rendue = apres.find((ligne) => ligne.ligneId === facture.ligneId);
    expect(rendue?.reste).toBe(xof("1170000"));
    expect(rendue?.consomme).toBe(ZERO);
    expect(rendue?.etat).toBe("nonLettree");
    expect(rendue?.marques).toEqual([]);
    // L'acompte rendu revient aussi, pour son montant entier.
    expect(apres.find((ligne) => ligne.ligneId === acompte.ligneId)?.reste).toBe(xof("500000"));
  });
});

describe("proposition automatique d'un à-compte", () => {
  it("impute le règlement le plus ancien sur la dette la plus ancienne", async () => {
    await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
    await facturer({ piece: "FA-2026-022", montant: "2000000", date: "2026-03-20" });
    await regler({ piece: "RG-2026-007", montant: xof("2000000"), date: "2026-04-02" });

    const propositions = await service.proposerLettrageAutomatique(critere);
    expect(propositions).toHaveLength(2);
    // Rien ne tombe juste : les deux rapprochements sont des à-comptes.
    expect(propositions.map((proposition) => proposition.nature)).toEqual(["partiel", "partiel"]);
    expect(propositions[0]!.montant).toBe(xof("1170000"));
    expect(propositions[0]!.pieces).toEqual(["FA-2026-021", "RG-2026-007"]);
    expect(propositions[1]!.montant).toBe(xof("830000"));
    expect(propositions[1]!.pieces).toEqual(["FA-2026-022", "RG-2026-007"]);
    // Chaque proposition dit ce qu'elle impute sur chaque ligne.
    expect(propositions[1]!.portions.map((portion) => portion.montant)).toEqual([xof("830000"), xof("830000")]);
  });

  it("appliqué, impute les portions proposées et non les lignes entières", async () => {
    await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
    await facturer({ piece: "FA-2026-022", montant: "2000000", date: "2026-03-20" });
    await regler({ piece: "RG-2026-007", montant: xof("2000000"), date: "2026-04-02" });

    const crees = await service.lettrerAutomatiquement(critere);
    expect(crees.map((marque) => marque.code)).toEqual(["AA", "AB"]);
    expect(crees.every((marque) => marque.portions !== undefined)).toBe(true);

    const lignes = await service.lignesALettrer(critere);
    // La première facture est soldée, le règlement est épuisé, la seconde reste entamée.
    expect(lignes.map((ligne) => ligne.piece)).toEqual(["FA-2026-022"]);
    expect(lignes[0]!.reste).toBe(xof("1510000"));
    expect(lignes[0]!.etat).toBe("partielle");
    expect(lignes[0]!.marques).toEqual(["AB"]);
  });

  it("se passe d'à-compte quand on le demande", async () => {
    await facturer({ piece: "FA-2026-021", montant: "1000000", date: "2026-03-05" });
    await regler({ piece: "RG-2026-007", montant: xof("500000"), date: "2026-04-02" });

    const etat = await service.lire();
    const sans = proposerLettrageAutomatique(etat.mouvements, etat.lettrages, critere, { partiel: false });
    expect(sans).toHaveLength(0);
    const avec = proposerLettrageAutomatique(etat.mouvements, etat.lettrages, critere);
    expect(avec).toHaveLength(1);
    expect(avec[0]!.nature).toBe("partiel");
  });
});

describe("ce que disent les états", () => {
  it("la situation du lettrage somme les restes et compte les lignes entamées", async () => {
    const { facture, acompte } = await factureEtAcompte();
    await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, acompte.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: acompte.ligneId, montant: "500000" }
      ]
    });

    const situation = (await service.situationDuLettrage()).find(
      (item) => item.compte === COMPTE && item.tiersCode === TIERS
    )!;
    expect(situation.lettre).toBe(xof("1000000"));
    // Ce qui reste dû : 670 000 sur la facture, plus rien sur l'acompte.
    expect(situation.nonLettre).toBe(xof("670000"));
    expect(situation.lignesALettrer).toBe(1);
    expect(situation.lignesPartielles).toBe(1);
    expect(situation.lettrages).toBe(1);
  });

  it("l'interrogation de compte donne le reste à lettrer ligne à ligne", async () => {
    const { facture, acompte } = await factureEtAcompte();
    await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, acompte.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: acompte.ligneId, montant: "500000" }
      ]
    });

    const interrogation = await service.interrogerCompte(`${COMPTE}-${TIERS}`, { tiersCode: TIERS });
    const entamee = interrogation.lignes.find((ligne) => ligne.piece === "FA-2026-021")!;
    expect(entamee.lettrage).toBe("AA");
    expect(entamee.lettragePartiel).toBe(true);
    expect(entamee.resteALettrer).toBe(xof("670000"));

    const soldee = interrogation.lignes.find((ligne) => ligne.piece === "RG-2026-007")!;
    expect(soldee.lettragePartiel).toBe(false);
    expect(soldee.resteALettrer).toBe(ZERO);
    // Le solde non lettré suit les restes, signé comme le compte : une dette au crédit se lit
    // négative, un règlement non imputé positif.
    expect(interrogation.nonLettre).toBe(-xof("670000"));
  });
});

describe("compatibilité et persistance", () => {
  it("une marque sans imputations consomme chaque ligne en entier", () => {
    const mouvement = {
      lotId: "LOT-1",
      lotNumero: "ACH0001",
      journalCode: "ACH",
      ecritureId: "LOT-1-E1",
      ecritureNumero: "AC-00001",
      ligneId: "L1",
      piece: "FA-2026-021",
      date: "2026-03-05" as DateCivile,
      exercice: 2026,
      periode: 3,
      compte: `${COMPTE}-${TIERS}`,
      tiersCode: TIERS,
      libelle: "Facture",
      debit: ZERO,
      credit: xof("1170000"),
      codesTaxe: [],
      comptabiliseLe: "2026-03-05T08:00:00.000Z"
    };
    // Une marque écrite avant le lettrage partiel : pas de champ `portions`.
    const ancienne: Lettrage = {
      code: "AA",
      compte: COMPTE,
      tiersCode: TIERS,
      lignes: ["L1"],
      montant: xof("1170000"),
      date: "2026-04-30",
      acteur: "superviseur",
      horodate: "2026-04-30T08:00:00.000Z",
      defaitLe: null
    };

    expect(ancienne.portions).toBeUndefined();
    expect(consommeSurLigne(mouvement, [ancienne])).toBe(xof("1170000"));
    expect(resteDeLigne(mouvement, [ancienne])).toBe(ZERO);
    expect(etatDeLettrage(mouvement, [ancienne])).toBe("lettree");
  });

  it("la sauvegarde conserve les imputations", async () => {
    const { facture, acompte } = await factureEtAcompte();
    await service.lettrer({
      compte: COMPTE,
      lignes: [facture.ligneId, acompte.ligneId],
      imputations: [
        { ligneId: facture.ligneId, montant: "500000" },
        { ligneId: acompte.ligneId, montant: "500000" }
      ]
    });

    const brut = JSON.parse(JSON.stringify(serialiserEtat(await service.lire()))) as ReturnType<
      typeof serialiserEtat
    >;
    const restaure = deserialiserEtat(brut);
    const marque = restaure.lettrages.find((item) => item.code === "AA")!;
    expect(marque.portions).toEqual([
      { ligneId: facture.ligneId, montant: xof("500000") },
      { ligneId: acompte.ligneId, montant: xof("500000") }
    ]);

    const mouvement = restaure.mouvements.find((item) => item.ligneId === facture.ligneId)!;
    expect(resteDeLigne(mouvement, restaure.lettrages)).toBe(xof("670000"));
  });

  it("vérifierImputations dit le montant rapproché et si le groupe est partiel", () => {
    const mouvement = (ligneId: string, sens: "debit" | "credit", montant: Montant) => ({
      lotId: "LOT-1",
      lotNumero: "ACH0001",
      journalCode: "ACH",
      ecritureId: "LOT-1-E1",
      ecritureNumero: "AC-00001",
      ligneId,
      piece: ligneId === "L1" ? "FA-2026-021" : "RG-2026-007",
      date: "2026-03-05" as DateCivile,
      exercice: 2026,
      periode: 3,
      compte: `${COMPTE}-${TIERS}`,
      tiersCode: TIERS,
      libelle: "Ligne",
      debit: sens === "debit" ? montant : ZERO,
      credit: sens === "credit" ? montant : ZERO,
      codesTaxe: [],
      comptabiliseLe: "2026-03-05T08:00:00.000Z"
    });

    const verifie = verifierImputations(
      [
        { mouvement: mouvement("L1", "credit", xof("1170000")), montant: xof("500000") },
        { mouvement: mouvement("L2", "debit", xof("500000")), montant: xof("500000") }
      ],
      [],
      BENIN.devise
    );
    expect(verifie.montant).toBe(xof("500000"));
    expect(verifie.partiel).toBe(true);
    expect(verifie.portions).toHaveLength(2);

    const total = verifierImputations(
      [
        { mouvement: mouvement("L1", "credit", xof("1170000")), montant: xof("1170000") },
        { mouvement: mouvement("L2", "debit", xof("1170000")), montant: xof("1170000") }
      ],
      [],
      BENIN.devise
    );
    expect(total.partiel).toBe(false);
  });
});
