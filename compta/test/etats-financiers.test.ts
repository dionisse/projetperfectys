/**
 * Les états financiers, produits depuis la balance.
 *
 * Ce qui est vérifié : l'équilibre du bilan (résultat de l'exercice compris dans les capitaux
 * propres), la cohérence entre le résultat présenté et la somme des comptes de gestion, le cumul
 * d'un état intermédiaire depuis l'ouverture de l'exercice, la présentation des amortissements en
 * déduction de l'actif brut, et l'annonce des groupes qu'aucun compte du plan n'alimente.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ZERO, type ServiceComptable } from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot, posterVente } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

describe("bilan", () => {
  it("à l'ouverture, l'actif égale le passif et le résultat est nul", async () => {
    const bilan = await service.bilan();

    // Les à-nouveaux de la démonstration : stocks 20 000 000, banque 55 000 000, caisse 5 000 000.
    expect(bilan.totalActifNet).toBe(80_000_000n);
    expect(bilan.totalActifBrut).toBe(80_000_000n);
    expect(bilan.totalActifAmortissements).toBe(ZERO);
    expect(bilan.totalPassif).toBe(80_000_000n);
    expect(bilan.ecart).toBe(ZERO);
    expect(bilan.resultatExercice).toBe(ZERO);
    expect(bilan.exercice).toBe(2026);
    expect(bilan.dateCloture).toBe("2026-12-31");

    const parCode = new Map(bilan.actif.map((ligne) => [ligne.code, ligne] as const));
    expect(parCode.get("STOCK")?.net).toBe(20_000_000n);
    expect(parCode.get("TRES-ACT")?.net).toBe(60_000_000n);
    expect(parCode.get("TOTAL-IMMO")?.net).toBe(ZERO);
    expect(parCode.get("TOTAL-ACTIF")?.net).toBe(80_000_000n);

    const passifParCode = new Map(bilan.passif.map((ligne) => [ligne.code, ligne] as const));
    expect(passifParCode.get("CAP")?.net).toBe(70_000_000n);
    expect(passifParCode.get("DETTE-CIRC")?.net).toBe(10_000_000n);
    expect(passifParCode.get("RESULTAT")?.net).toBe(ZERO);
    expect(passifParCode.get("TOTAL-PASSIF")?.net).toBe(80_000_000n);

    // Le détail est présent : une rubrique n'est pas un nombre sorti de nulle part.
    expect(parCode.get("TRES-ACT")?.comptes.map((compte) => compte.numero)).toEqual(["521100", "571100"]);
    expect(bilan.aVerifier).toBe(true);
  });

  it("reste équilibré après une vente et un achat, résultat compris", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const bilan = await service.bilan();

    // Actif : 80 000 000 + créance client 2 360 000 + TVA récupérable 180 000.
    expect(bilan.totalActifNet).toBe(82_540_000n);
    // Passif : 80 000 000 + TVA facturée 360 000 + fournisseur 1 170 000 + retenue 10 000 + résultat 1 000 000.
    expect(bilan.totalPassif).toBe(82_540_000n);
    expect(bilan.ecart).toBe(ZERO);
    expect(bilan.resultatExercice).toBe(1_000_000n);

    const passifParCode = new Map(bilan.passif.map((ligne) => [ligne.code, ligne] as const));
    expect(passifParCode.get("CAP")?.net).toBe(70_000_000n);
    expect(passifParCode.get("RESULTAT")?.net).toBe(1_000_000n);
    // Fournisseurs à l'ouverture 10 000 000 + achat 1 170 000 + TVA facturée 360 000 + retenue 10 000.
    expect(passifParCode.get("DETTE-CIRC")?.net).toBe(11_540_000n);

    const actifParCode = new Map(bilan.actif.map((ligne) => [ligne.code, ligne] as const));
    expect(actifParCode.get("CREANCE")?.net).toBe(2_540_000n);
  });

  it("un état intermédiaire est cumulé depuis l'ouverture de l'exercice", async () => {
    await posterVente(service, { date: "2026-03-10", piece: "FV-2026-011", montant: "1000000" });
    await posterVente(service, { date: "2026-04-10", piece: "FV-2026-012", montant: "2000000" });

    const mars = await service.bilan(3);
    const avril = await service.bilan(4);
    const exercice = await service.bilan();

    expect(mars.dateCloture).toBe("2026-03-31");
    expect(mars.totalActifNet).toBe(81_180_000n);
    expect(mars.resultatExercice).toBe(1_000_000n);

    expect(avril.dateCloture).toBe("2026-04-30");
    expect(avril.totalActifNet).toBe(83_540_000n);
    expect(avril.resultatExercice).toBe(3_000_000n);

    expect(exercice.totalActifNet).toBe(avril.totalActifNet);
    expect(exercice.ecart).toBe(ZERO);
  });

  it("les amortissements viennent en déduction de l'actif brut", async () => {
    await service.ajouterCompte({
      numero: "281100",
      libelle: "Amortissements des bâtiments",
      groupe: "IMMO-AM"
    });
    await posterLot(service, {
      journalCode: "OD",
      date: "2026-04-30",
      piece: "OD-2026-030",
      libelle: "Dotation aux amortissements d'avril",
      lignes: [
        { compte: "681000", libelle: "Dotation aux amortissements", debit: "500000" },
        { compte: "281100", libelle: "Amortissements des bâtiments", credit: "500000" }
      ],
      contrepartie: ""
    });

    const bilan = await service.bilan();
    const amortissements = bilan.actif.find((ligne) => ligne.code === "IMMO-AM");

    expect(amortissements?.brut).toBe(ZERO);
    expect(amortissements?.amortissements).toBe(500_000n);
    expect(amortissements?.net).toBe(-500_000n);
    expect(bilan.totalActifBrut).toBe(80_000_000n);
    expect(bilan.totalActifAmortissements).toBe(500_000n);
    expect(bilan.totalActifNet).toBe(79_500_000n);
    // La dotation réduit le résultat, donc le passif : le bilan reste équilibré.
    expect(bilan.resultatExercice).toBe(-500_000n);
    expect(bilan.totalPassif).toBe(79_500_000n);
    expect(bilan.ecart).toBe(ZERO);
  });

  it("annonce les rubriques qu'aucun solde n'alimente", async () => {
    const avant = await service.bilan();
    expect(avant.groupesSansSolde).toContain("IMMO-AM");
    expect(avant.groupesSansSolde).toContain("TRES-PAS");
    expect(avant.groupesSansSolde).toContain("IS");
    expect(avant.groupesSansSolde).not.toContain("CAP");
    expect(avant.groupesSansSolde).not.toContain("TRES-ACT");

    // Un compte ajouté mais sans mouvement ne suffit pas : la rubrique reste annoncée vide.
    await service.ajouterCompte({ numero: "281100", libelle: "Amortissements des bâtiments", groupe: "IMMO-AM" });
    const sansMouvement = await service.bilan();
    expect(sansMouvement.groupesSansSolde).toContain("IMMO-AM");

    await posterLot(service, {
      journalCode: "OD",
      date: "2026-04-30",
      piece: "OD-2026-032",
      libelle: "Dotation aux amortissements",
      lignes: [
        { compte: "681000", libelle: "Dotation aux amortissements", debit: "500000" },
        { compte: "281100", libelle: "Amortissements des bâtiments", credit: "500000" }
      ],
      contrepartie: ""
    });
    const apres = await service.bilan();
    expect(apres.groupesSansSolde).not.toContain("IMMO-AM");
  });

  it("une période inexistante est refusée", async () => {
    await expect(service.bilan(99)).rejects.toThrow(/période 99/i);
  });
});

describe("compte de résultat", () => {
  it("à l'ouverture, il est néant mais lisible", async () => {
    const resultat = await service.compteDeResultat();

    expect(resultat.resultatNet).toBe(ZERO);
    expect(resultat.resultatExploitation).toBe(ZERO);
    expect(resultat.resultatAvantImpots).toBe(ZERO);
    expect(resultat.impotsSurLesResultats).toBe(ZERO);
    expect(resultat.dateDebut).toBe("2026-01-01");
    expect(resultat.dateFin).toBe("2026-12-31");
    expect(resultat.controle.ecart).toBe(ZERO);
    // L'ordre du modèle est conservé : le résultat net vient après l'impôt.
    const codes = resultat.lignes.map((ligne) => ligne.code);
    expect(codes.indexOf("RESULTAT-AI")).toBeLessThan(codes.indexOf("IS"));
    expect(codes.indexOf("IS")).toBeLessThan(codes.indexOf("RESULTAT-NET"));
    expect(codes.indexOf("RESULTAT-EXP")).toBeLessThan(codes.indexOf("RESULTAT-FIN"));
  });

  it("présente les produits, les charges et le résultat net d'un mois d'activité", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const resultat = await service.compteDeResultat(4);
    const parCode = new Map(resultat.lignes.map((ligne) => [ligne.code, ligne] as const));

    expect(parCode.get("PRD-EXP")?.net).toBe(2_000_000n);
    expect(parCode.get("CHG-EXP")?.net).toBe(1_000_000n);
    expect(resultat.resultatExploitation).toBe(1_000_000n);
    expect(resultat.resultatFinancier).toBe(ZERO);
    expect(resultat.resultatActivitesOrdinaires).toBe(1_000_000n);
    expect(resultat.resultatHorsActivitesOrdinaires).toBe(ZERO);
    expect(resultat.resultatAvantImpots).toBe(1_000_000n);
    expect(resultat.impotsSurLesResultats).toBe(ZERO);
    expect(resultat.resultatNet).toBe(1_000_000n);
    expect(resultat.dateFin).toBe("2026-04-30");

    // Le résultat présenté est bien la somme algébrique des comptes de gestion.
    expect(resultat.controle.attendu).toBe(1_000_000n);
    expect(resultat.controle.presente).toBe(1_000_000n);
    expect(resultat.controle.ecart).toBe(ZERO);

    // Et le bilan porte le même résultat : les deux états ne peuvent pas se contredire.
    const bilan = await service.bilan(4);
    expect(bilan.resultatExercice).toBe(resultat.resultatNet);
    expect(bilan.ecart).toBe(ZERO);
  });

  it("une perte est présentée négativement, sans bascule de sens", async () => {
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "3000000" });

    const resultat = await service.compteDeResultat(4);
    expect(resultat.resultatNet).toBe(-3_000_000n);
    expect(resultat.controle.ecart).toBe(ZERO);

    const bilan = await service.bilan(4);
    expect(bilan.resultatExercice).toBe(-3_000_000n);
    // Actif : 80 000 000 d'à-nouveaux + 540 000 de TVA récupérable sur l'achat.
    expect(bilan.totalActifNet).toBe(80_540_000n);
    expect(bilan.totalPassif).toBe(80_540_000n);
    expect(bilan.ecart).toBe(ZERO);
  });

  it("une dotation et un intérêt sont présentés sur leurs propres rubriques", async () => {
    await posterLot(service, {
      journalCode: "OD",
      date: "2026-04-30",
      piece: "OD-2026-031",
      libelle: "Dotation et intérêts d'avril",
      lignes: [
        { compte: "681000", libelle: "Dotation aux amortissements", debit: "400000" },
        { compte: "671000", libelle: "Intérêts de l'emprunt", debit: "150000" },
        { compte: "521100", libelle: "Banque", credit: "150000" },
        { compte: "244000", libelle: "Matériel et mobilier", credit: "400000" }
      ],
      contrepartie: ""
    });

    const resultat = await service.compteDeResultat(4);
    const parCode = new Map(resultat.lignes.map((ligne) => [ligne.code, ligne] as const));

    expect(parCode.get("CHG-DOT")?.net).toBe(400_000n);
    expect(parCode.get("CHG-FIN")?.net).toBe(150_000n);
    expect(resultat.resultatExploitation).toBe(-400_000n);
    expect(resultat.resultatFinancier).toBe(-150_000n);
    expect(resultat.resultatNet).toBe(-550_000n);
    expect(resultat.controle.ecart).toBe(ZERO);
  });
});
