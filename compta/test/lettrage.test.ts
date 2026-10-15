/**
 * Lettrage des comptes de tiers.
 *
 * Ce qui est vérifié : qu'un groupe lettré est nécessairement équilibré, qu'une ligne ne peut pas
 * porter deux marques, qu'un lettrage ne mélange ni deux comptes ni deux tiers, que la proposition
 * automatique précède l'écriture et rapproche aussi un règlement groupé de plusieurs factures, qu'un
 * délettrage rend les lignes à lettrer sans effacer la marque, et que le solde non lettré reste
 * distinct du solde comptable.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  ZERO,
  chercherCombinaison,
  codeDeLettrageSuivant,
  verifierGroupeALettrer,
  type DateCivile,
  type Lettrage,
  type Montant,
  type Mouvement,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

/** Une facture d'achat, puis son règlement par banque : le couple à lettrer le plus ordinaire. */
async function facturerEtRegler(demande: {
  tiers?: string;
  montant: string;
  pieceFacture: string;
  pieceReglement: string;
  dateFacture?: DateCivile;
  dateReglement?: DateCivile;
}): Promise<void> {
  const tiers = demande.tiers ?? "FOU01";
  await posterAchat(service, {
    date: demande.dateFacture ?? "2026-04-12",
    piece: demande.pieceFacture,
    montant: demande.montant,
    tiers
  });
  // Ce que la facture laisse au crédit du fournisseur : hors-taxe + TVA 18 % − acompte de 1 % retenu.
  const total = (BigInt(demande.montant) * 117n) / 100n;
  await posterLot(service, {
    journalCode: "BQ",
    date: demande.dateReglement ?? "2026-04-28",
    piece: demande.pieceReglement,
    libelle: `Règlement de la facture ${demande.pieceFacture}`,
    lignes: [
      { compte: `401100-${tiers}`, libelle: `Règlement ${demande.pieceFacture}`, debit: total.toString() },
      { compte: "521100", libelle: "Banque — règlement fournisseur", credit: total.toString() }
    ],
    contrepartie: ""
  });
}

const ligne = (montant: Montant, sens: "debit" | "credit"): Mouvement => ({
  lotId: "LOT-1",
  lotNumero: "ACH0001",
  journalCode: "ACH",
  ecritureId: "LOT-1-E1",
  ecritureNumero: "AC-00001",
  ligneId: sens === "debit" ? "L1" : "L2",
  piece: sens === "debit" ? "FA-2026-001" : "RG-2026-001",
  date: "2026-04-12",
  periode: 4,
  compte: "401100-FOU01",
  tiersCode: "FOU01",
  libelle: "Ligne de test",
  debit: sens === "debit" ? montant : ZERO,
  credit: sens === "credit" ? montant : ZERO,
  codesTaxe: [],
  comptabiliseLe: "2026-04-12T08:00:00.000Z"
});

const marque = (code: string): Lettrage => ({
  code,
  compte: "401100",
  tiersCode: "FOU01",
  lignes: [`LOT-2026-ACH-${code}-E1-L1`],
  montant: 1000n,
  date: "2026-04-30",
  acteur: "superviseur",
  horodate: "2026-04-30T08:00:00.000Z",
  defaitLe: null
});

describe("codes de lettrage", () => {
  it("commence à AA, puis suit l'alphabet", () => {
    expect(codeDeLettrageSuivant([])).toBe("AA");
    expect(codeDeLettrageSuivant([marque("AA")])).toBe("AB");
    expect(codeDeLettrageSuivant([marque("AA"), marque("AB")])).toBe("AC");
  });

  it("passe à trois lettres une fois les 676 combinaisons de deux lettres attribuées", () => {
    const lettres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const tous: Lettrage[] = [];
    for (const premier of lettres) {
      for (const second of lettres) {
        tous.push(marque(`${premier}${second}`));
      }
    }
    expect(tous.length).toBe(676);
    expect(codeDeLettrageSuivant(tous)).toBe("AAA");
  });

  it("ne réutilise pas un code défait : la marque reste dans l'historique", () => {
    const defaite: Lettrage = { ...marque("AA"), defaitLe: "2026-05-02T08:00:00.000Z" };
    expect(codeDeLettrageSuivant([defaite])).toBe("AB");
  });
});

describe("vérification d'un groupe à lettrer", () => {
  it("accepte une facture et son règlement de même montant", () => {
    const verifie = verifierGroupeALettrer([ligne(1_170_000n, "debit"), ligne(1_170_000n, "credit")], BENIN.devise);
    expect(verifie.montant).toBe(1_170_000n);
    expect(verifie.totalDebit).toBe(1_170_000n);
    expect(verifie.totalCredit).toBe(1_170_000n);
  });

  it("refuse une ligne seule, un groupe d'un seul sens, et un groupe déséquilibré", () => {
    expect(() => verifierGroupeALettrer([ligne(1000n, "debit")], BENIN.devise)).toThrow(
      /au moins deux lignes/i
    );
    expect(() =>
      verifierGroupeALettrer([ligne(1000n, "debit"), ligne(500n, "debit")], BENIN.devise)
    ).toThrow(/ne contient que des débits/i);
    try {
      verifierGroupeALettrer([ligne(1_000_000n, "debit"), ligne(900_000n, "credit")], BENIN.devise);
      throw new Error("un groupe déséquilibré aurait dû être refusé");
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurRegle);
      expect((erreur as Error).message).toMatch(/n'est pas équilibré/i);
      expect((erreur as Error).message).toMatch(/écart\s+100\s000/u);
      expect((erreur as Error).message).toMatch(/lettrage partiel n'est pas produit/i);
    }
  });
});

describe("recherche d'une combinaison de montants", () => {
  const montants = (valeurs: number[]): Mouvement[] =>
    valeurs.map((valeur, index) => ({ ...ligne(BigInt(valeur), "credit"), ligneId: `L${index}` }));

  it("trouve un complément exact, dans la limite de taille demandée", () => {
    const lignes = montants([100_000, 200_000, 300_000]);
    expect(chercherCombinaison(lignes, 300_000n, 3)?.map((item) => item.ligneId)).toEqual(["L0", "L1"]);
    expect(chercherCombinaison(lignes, 600_000n, 3)?.map((item) => item.ligneId)).toEqual(["L0", "L1", "L2"]);
  });

  it("renonce quand aucune combinaison n'atteint la cible, ou quand elle dépasse la taille", () => {
    const lignes = montants([100_000, 200_000, 300_000]);
    expect(chercherCombinaison(lignes, 250_000n, 3)).toBeNull();
    expect(chercherCombinaison(lignes, 600_000n, 2)).toBeNull();
    expect(chercherCombinaison(lignes, ZERO, 3)).toBeNull();
  });
});

describe("lettrage manuel", () => {
  it("rapproche une facture de son règlement et vide la liste des lignes à lettrer", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });

    // L'à-nouveau du fournisseur est déjà là : trois lignes à lettrer sur 401100-FOU01.
    const avant = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    expect(avant.length).toBe(3);
    expect(avant.map((mouvement) => mouvement.piece)).toEqual(["AN-0001", "FA-2026-018", "RG-2026-004"]);

    const facture = avant.find((mouvement) => mouvement.piece === "FA-2026-018")!;
    const reglement = avant.find((mouvement) => mouvement.piece === "RG-2026-004")!;
    const lettrage = await service.lettrer({
      compte: "401100",
      lignes: [facture.ligneId, reglement.ligneId]
    });

    expect(lettrage.code).toBe("AA");
    expect(lettrage.compte).toBe("401100");
    expect(lettrage.tiersCode).toBe("FOU01");
    expect(lettrage.montant).toBe(1_170_000n);
    expect(lettrage.lignes).toEqual([facture.ligneId, reglement.ligneId]);
    expect(lettrage.acteur).toBe("superviseur");
    expect(lettrage.defaitLe).toBeNull();

    const apres = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    expect(apres.map((mouvement) => mouvement.piece)).toEqual(["AN-0001"]);
  });

  it("refuse un groupe déséquilibré, une ligne déjà lettrée, deux tiers, un compte inconnu", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    await facturerEtRegler({
      montant: "1000000",
      pieceFacture: "FA-2026-019",
      pieceReglement: "RG-2026-005",
      tiers: "FOU02",
      dateFacture: "2026-04-14",
      dateReglement: "2026-04-29"
    });
    const lignes = await service.lignesALettrer({ compte: "401100" });
    const parPiece = (piece: string): Mouvement => lignes.find((item) => item.piece === piece)!;

    // Deux lignes d'un même sens : rien n'est rapproché.
    await expect(
      service.lettrer({ compte: "401100", lignes: [parPiece("FA-2026-018").ligneId, parPiece("FA-2026-019").ligneId] })
    ).rejects.toThrow(/ne contient que des crédits/i);

    // Deux tiers différents.
    await expect(
      service.lettrer({ compte: "401100", lignes: [parPiece("FA-2026-018").ligneId, parPiece("RG-2026-005").ligneId] })
    ).rejects.toThrow(/ne mélange pas deux tiers/i);

    // Compte absent du plan.
    await expect(service.lettrer({ compte: "401999", lignes: [parPiece("FA-2026-018").ligneId] })).rejects.toThrow(
      /n'existe pas dans le plan du dossier/i
    );

    // Ligne inconnue du grand livre.
    await expect(
      service.lettrer({ compte: "401100", lignes: ["LOT-2026-ACH-1-E1-L9", parPiece("RG-2026-004").ligneId] })
    ).rejects.toThrow(/n'existe pas dans le grand livre/i);

    // Même ligne demandée deux fois.
    await expect(
      service.lettrer({
        compte: "401100",
        lignes: [parPiece("FA-2026-018").ligneId, parPiece("FA-2026-018").ligneId]
      })
    ).rejects.toThrow(/demandée deux fois/i);

    // Lettrage correct, puis seconde marque sur la même ligne.
    const premier = await service.lettrer({
      compte: "401100",
      lignes: [parPiece("FA-2026-018").ligneId, parPiece("RG-2026-004").ligneId]
    });
    expect(premier.code).toBe("AA");
    await expect(
      service.lettrer({
        compte: "401100",
        lignes: [parPiece("FA-2026-018").ligneId, parPiece("RG-2026-005").ligneId]
      })
    ).rejects.toThrow(/déjà lettrée sous le code AA/i);
  });

  it("trace le lettrage dans la piste d'audit", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const lignes = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    const facture = lignes.find((item) => item.piece === "FA-2026-018")!;
    const reglement = lignes.find((item) => item.piece === "RG-2026-004")!;
    await service.lettrer({ compte: "401100", lignes: [facture.ligneId, reglement.ligneId] });

    const audit = await service.pisteAudit();
    const evenement = audit.find((item) => item.action === "Lettrage");
    expect(evenement).toBeDefined();
    expect(evenement!.entiteIdentifiant).toBe("AA");
    expect(evenement!.detail).toMatch(/401100 · FOU01/);
    expect(evenement!.detail).toMatch(/1\s170\s000/u);
    expect(evenement!.utilisateur).toBe("superviseur");
  });
});

describe("lettrage automatique", () => {
  it("propose avant d'écrire, et rapproche un règlement groupé de plusieurs factures", async () => {
    await posterAchat(service, { date: "2026-04-02", piece: "FA-2026-021", montant: "400000", tiers: "FOU02" });
    await posterAchat(service, { date: "2026-04-05", piece: "FA-2026-022", montant: "600000", tiers: "FOU02" });
    await posterAchat(service, { date: "2026-04-08", piece: "FA-2026-023", montant: "250000", tiers: "FOU02" });
    // Un règlement groupé couvre les deux premières factures : 468 000 + 702 000.
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-28",
      piece: "RG-2026-006",
      libelle: "Règlement groupé FOU02",
      lignes: [
        { compte: "401100-FOU02", libelle: "Règlement groupé", debit: "1170000" },
        { compte: "521100", libelle: "Banque", credit: "1170000" }
      ],
      contrepartie: ""
    });

    const propositions = await service.proposerLettrageAutomatique({ compte: "401100", tiersCode: "FOU02" });
    // Aucune écriture n'a eu lieu : les lignes restent à lettrer.
    expect((await service.lignesALettrer({ compte: "401100", tiersCode: "FOU02" })).length).toBe(4);
    expect(propositions.length).toBe(1);
    expect(propositions[0]!.nature).toBe("compose");
    expect(propositions[0]!.montant).toBe(1_170_000n);
    expect(propositions[0]!.pieces).toEqual(["FA-2026-021", "FA-2026-022", "RG-2026-006"]);

    const crees = await service.lettrerAutomatiquement({ compte: "401100", tiersCode: "FOU02" });
    expect(crees.length).toBe(1);
    expect(crees[0]!.code).toBe("AA");

    const reste = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU02" });
    expect(reste.map((mouvement) => mouvement.piece)).toEqual(["FA-2026-023"]);

    const audit = await service.pisteAudit();
    expect(audit.some((item) => item.action === "Lettrage automatique")).toBe(true);
  });

  it("rapproche d'abord les montants exactement égaux", async () => {
    await facturerEtRegler({ montant: "300000", pieceFacture: "FA-2026-031", pieceReglement: "RG-2026-011" });
    await facturerEtRegler({
      montant: "700000",
      pieceFacture: "FA-2026-032",
      pieceReglement: "RG-2026-012",
      dateFacture: "2026-04-15",
      dateReglement: "2026-04-29"
    });

    const crees = await service.lettrerAutomatiquement({ compte: "401100", tiersCode: "FOU01" });
    expect(crees.length).toBe(2);
    expect(crees.every((lettrage) => lettrage.tiersCode === "FOU01")).toBe(true);
    // Chaque marque rapproche exactement deux lignes : la facture et son règlement.
    expect(crees.every((lettrage) => lettrage.lignes.length === 2)).toBe(true);
    expect(crees.map((lettrage) => lettrage.montant).sort((a, b) => (a < b ? -1 : 1))).toEqual([
      351_000n,
      819_000n
    ]);
    expect(crees.map((lettrage) => lettrage.code)).toEqual(["AA", "AB"]);

    // L'à-nouveau du fournisseur ne correspond à aucun règlement : il reste à lettrer.
    const reste = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    expect(reste.map((mouvement) => mouvement.piece)).toEqual(["AN-0001"]);
  });
});

describe("situation et délettrage", () => {
  it("sépare le solde comptable du solde non lettré", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });

    const avant = await service.situationDuLettrage();
    const fou01 = avant.find((item) => item.tiersCode === "FOU01")!;
    // À-nouveau créditeur de 10 000 000, facture de 1 170 000 au crédit, règlement de 1 170 000 au débit.
    expect(fou01.compte).toBe("401100");
    expect(fou01.solde).toBe(-10_000_000n);
    expect(fou01.lettre).toBe(ZERO);
    expect(fou01.nonLettre).toBe(12_340_000n);
    expect(fou01.lignesALettrer).toBe(3);
    expect(fou01.plusAncienneLigne).toBe("2026-01-01");

    const lignes = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    await service.lettrer({
      compte: "401100",
      lignes: [
        lignes.find((item) => item.piece === "FA-2026-018")!.ligneId,
        lignes.find((item) => item.piece === "RG-2026-004")!.ligneId
      ]
    });

    const apres = await service.situationDuLettrage();
    const fou01Apres = apres.find((item) => item.tiersCode === "FOU01")!;
    // Le solde comptable ne bouge pas : le lettrage n'écrit aucune écriture.
    expect(fou01Apres.solde).toBe(-10_000_000n);
    expect(fou01Apres.lettre).toBe(2_340_000n);
    expect(fou01Apres.nonLettre).toBe(10_000_000n);
    expect(fou01Apres.lignesALettrer).toBe(1);
    expect(fou01Apres.lettrages).toBe(1);
  });

  it("un délettrage rend les lignes à lettrer et conserve la marque datée", async () => {
    await facturerEtRegler({ montant: "1000000", pieceFacture: "FA-2026-018", pieceReglement: "RG-2026-004" });
    const lignes = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    await service.lettrer({
      compte: "401100",
      lignes: [
        lignes.find((item) => item.piece === "FA-2026-018")!.ligneId,
        lignes.find((item) => item.piece === "RG-2026-004")!.ligneId
      ]
    });

    const defait = await service.delettrer("AA");
    expect(defait.defaitLe).toMatch(/^2026-04-15T/);

    const marques = await service.lettrages("401100");
    expect(marques.length).toBe(1);
    expect(marques[0]!.defaitLe).not.toBeNull();

    const aLettrer = await service.lignesALettrer({ compte: "401100", tiersCode: "FOU01" });
    expect(aLettrer.map((mouvement) => mouvement.piece)).toEqual(["AN-0001", "FA-2026-018", "RG-2026-004"]);

    // Le code AA n'est pas recyclé : la prochaine marque s'appelle AB.
    const suivant = await service.lettrer({
      compte: "401100",
      lignes: [
        aLettrer.find((item) => item.piece === "FA-2026-018")!.ligneId,
        aLettrer.find((item) => item.piece === "RG-2026-004")!.ligneId
      ]
    });
    expect(suivant.code).toBe("AB");

    await expect(service.delettrer("AB")).resolves.toBeDefined();
    await expect(service.delettrer("AB")).rejects.toThrow(/déjà défait/i);
    await expect(service.delettrer("ZZ")).rejects.toThrow(/n'existe pas dans ce dossier/i);

    // Deux marques défaites dans ce parcours : AA au début, AB après son recreé.
    const audit = await service.pisteAudit();
    const defaites = audit.filter((item) => item.action === "Lettrage défait");
    expect(defaites.map((item) => item.entiteIdentifiant)).toEqual(["AA", "AB"]);
  });
});
