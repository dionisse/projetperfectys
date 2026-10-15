/**
 * Interrogation d'un compte, et historique.
 *
 * Ce qui est vérifié : que le solde progressif part du solde réel à l'ouverture de la fenêtre et pas de
 * zéro, qu'un compte segmenté s'interroge seul, que le lettrage et le pointage bancaire apparaissent
 * sur les lignes qu'ils concernent, que les lignes d'un exercice clos sont dites telles, et que la
 * comparaison d'exercices refuse un exercice qui n'existe pas au lieu de rendre un compte vide.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { ServiceComptable } from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot, posterVente, xof } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  ({ service } = nouveauService());
});

/** Ferme les treize périodes puis clôture l'exercice : le chemin réel, sans raccourci. */
async function cloturerExercice(cible: ServiceComptable): Promise<void> {
  for (let periode = 1; periode <= 13; periode++) {
    await cible.cloturerPeriode(periode);
  }
  await cible.cloturerExercice();
}

describe("Interrogation d'un compte", () => {
  it("part du solde réel à l'ouverture de la fenêtre, pas de zéro", async () => {
    // Le compte de banque n'a qu'une ligne : l'à-nouveau du 1er janvier, 55 000 000 au débit.
    const annee = await service.interrogerCompte("521100");
    expect(annee.comptePrincipal).toBe("521100");
    expect(annee.lignes.length).toBe(1);
    expect(annee.soldeInitial).toBe(xof("0"));
    expect(annee.lignes[0]!.soldeProgressif).toBe(xof("55000000"));
    expect(annee.soldeFinal).toBe(xof("55000000"));
    expect(annee.sensFinal).toBe("debiteur");
    expect(annee.reports.length).toBe(1);
    expect(annee.reports[0]!.exercice).toBe(2026);
    expect(annee.reports[0]!.solde).toBe(xof("55000000"));
    expect(annee.reports[0]!.clos).toBe(false);

    // Interrogé à partir d'avril : l'à-nouveau précède la fenêtre, il entre dans le solde d'ouverture.
    const avril = await service.interrogerCompte("521100", { du: "2026-04-01", au: "2026-04-30" });
    expect(avril.soldeInitial).toBe(xof("55000000"));
    expect(avril.lignes.length).toBe(0);
    expect(avril.soldeFinal).toBe(xof("55000000"));
    expect(avril.avertissements.join(" ")).toMatch(/Néant/u);
  });

  it("interroge un segment de tiers seul, et dit quand un compte auxiliaire est lu sans tiers", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterVente(service, { date: "2026-04-18", piece: "FV-2026-002", montant: "1000000", tiers: "CLI02" });

    const segment = await service.interrogerCompte("411100-CLI01");
    expect(segment.tiersCode).toBe("CLI01");
    expect(segment.lignes.length).toBe(1);
    expect(segment.lignes[0]!.debit).toBe(xof("2360000"));
    expect(segment.lignes[0]!.soldeProgressif).toBe(xof("2360000"));
    expect(segment.nonLettre).toBe(xof("2360000"));

    // Le compte principal rassemble les deux segments, et le dit.
    const principal = await service.interrogerCompte("411100");
    expect(principal.tiersCode).toBeNull();
    expect(principal.lignes.length).toBe(2);
    expect(principal.soldeFinal).toBe(xof("2360000") + xof("1180000"));
    expect(principal.avertissements.join(" ")).toMatch(/rassemble tous les segments/u);
  });

  it("montre le code de lettrage sur les lignes lettrées", async () => {
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-04-28",
      piece: "BQ-2026-004",
      libelle: "Règlement fournisseur",
      // Un règlement de fournisseur diminue la dette et la trésorerie : débit 401100, crédit 521100.
      lignes: [
        { compte: "401100-FOU01", libelle: "Règlement FA-2026-018", debit: "1170000" },
        { compte: "521100", libelle: "Règlement FA-2026-018", credit: "1170000" }
      ],
      contrepartie: "521100"
    });

    // Trois lignes sur ce segment : l'à-nouveau du fournisseur (10 000 000 au crédit), la facture
    // d'avril, et son règlement. Le solde n'est pas nul, et c'est normal : l'à-nouveau reste dû.
    const avant = await service.interrogerCompte("401100-FOU01");
    expect(avant.lignes.length).toBe(3);
    expect(avant.lignes.every((ligne) => ligne.lettrage === null)).toBe(true);
    expect(avant.soldeFinal).toBe(-xof("10000000"));
    expect(avant.sensFinal).toBe("crediteur");
    expect(avant.nonLettre).toBe(-xof("10000000"));

    await service.lettrerAutomatiquement({ compte: "401100", tiersCode: "FOU01" });
    const apres = await service.interrogerCompte("401100-FOU01");
    const lettrees = apres.lignes.filter((ligne) => ligne.lettrage !== null);
    const nonLettrees = apres.lignes.filter((ligne) => ligne.lettrage === null);
    // La facture et son règlement portent la même marque ; l'à-nouveau, que rien ne solde, reste à
    // lettrer — et l'interrogation le montre comme tel.
    expect(lettrees.length).toBe(2);
    expect(new Set(lettrees.map((ligne) => ligne.lettrage)).size).toBe(1);
    expect(nonLettrees.length).toBe(1);
    expect(nonLettrees[0]!.credit).toBe(xof("10000000"));
    expect(apres.nonLettre).toBe(-xof("10000000"));
  });

  it("montre le relevé qui a pointé une ligne de trésorerie", async () => {
    const [releve] = await service.releves();
    await posterLot(service, {
      journalCode: "BQ",
      date: "2026-03-05",
      piece: "BQ-2026-001",
      libelle: "Virement SUPERMARCHÉ CADJEHOUN",
      lignes: [
        { compte: "521100", libelle: "Virement client", debit: "3500000" },
        { compte: "411100-CLI01", libelle: "Virement client", credit: "3500000" }
      ],
      contrepartie: "521100"
    });

    const avantPointage = await service.interrogerCompte("521100", { du: "2026-03-01", au: "2026-03-31" });
    expect(avantPointage.lignes.length).toBe(1);
    expect(avantPointage.lignes[0]!.pointage).toBeNull();
    expect(avantPointage.nonPointe).toBe(xof("3500000"));
    // Le solde d'ouverture tient l'à-nouveau de janvier : on ne repart pas de zéro en mars.
    expect(avantPointage.soldeInitial).toBe(xof("55000000"));

    const { pointages } = await service.pointerAutomatiquement(releve!.id);
    expect(pointages.length).toBe(1);

    const apresPointage = await service.interrogerCompte("521100", { du: "2026-03-01", au: "2026-03-31" });
    expect(apresPointage.lignes[0]!.pointage).toBe(releve!.libelle);
    expect(apresPointage.nonPointe).toBe(xof("0"));
  });

  it("marque les lignes d'un exercice clos et compare les exercices", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });
    await cloturerExercice(service);

    // L'exercice courant est 2027 ; l'interrogation du compte client avec l'exercice précédent montre
    // les à-nouveaux reportés et les lignes de l'exercice clos.
    const comparaison = await service.interrogerCompte("411100-CLI01", {
      exercice: 2027,
      inclureExercicePrecedent: true
    });
    expect(comparaison.exercices).toEqual([2026, 2027]);
    expect(comparaison.lignes.length).toBe(2);
    const de2026 = comparaison.lignes.filter((ligne) => ligne.exercice === 2026);
    const de2027 = comparaison.lignes.filter((ligne) => ligne.exercice === 2027);
    expect(de2026.length).toBe(1);
    expect(de2026[0]!.exerciceClos).toBe(true);
    expect(de2026[0]!.debit).toBe(xof("2360000"));
    expect(de2027.length).toBe(1);
    expect(de2027[0]!.exerciceClos).toBe(false);
    expect(de2027[0]!.soldeProgressif).toBe(xof("2360000") * 2n);

    const reports = comparaison.reports;
    expect(reports.length).toBe(2);
    expect(reports[0]!).toMatchObject({ exercice: 2026, clos: true });
    expect(reports[0]!.solde).toBe(xof("2360000"));
    expect(reports[1]!).toMatchObject({ exercice: 2027, clos: false });
    expect(reports[1]!.solde).toBe(xof("4720000"));
    expect(reports[1]!.dateDebut).toBe("2027-01-01");

    expect(comparaison.avertissements.join(" ")).toMatch(/exercice clos/u);
    expect(comparaison.avertissements.join(" ")).toMatch(/correction passe par l'exercice en cours/u);

    // Interrogé seul, l'exercice clos ne montre que ses propres lignes.
    const clos = await service.interrogerCompte("411100-CLI01", { exercice: 2026 });
    expect(clos.lignes.length).toBe(1);
    expect(clos.soldeFinal).toBe(xof("2360000"));
  });

  it("refuse un compte ou un exercice qui n'existe pas, plutôt que de rendre un état vide", async () => {
    await expect(service.interrogerCompte("999999")).rejects.toThrow(/n'existe pas dans le plan/u);
    await expect(service.interrogerCompte("411100", { exercice: 2030 })).rejects.toThrow(
      /L'exercice 2030 n'existe pas dans ce dossier/u
    );
    await expect(
      service.interrogerCompte("411100", { exercice: 2026, inclureExercicePrecedent: true })
    ).rejects.toThrow(/la comparaison d'exercices s'arrête là/u);

    // Une fenêtre à l'envers ne rend rien, et le dit.
    const inversee = await service.interrogerCompte("521100", { du: "2026-06-30", au: "2026-01-01" });
    expect(inversee.lignes.length).toBe(0);
    expect(inversee.avertissements.join(" ")).toMatch(/avant de commencer/u);
  });

  it("signale un compte désactivé et un solde inscrit au plan", async () => {
    await service.ajouterCompte({ numero: "674100", libelle: "Services bancaires", groupe: "CHG-FIN" });
    await service.modifierCompte("674100", { soldeInitial: "25000", actif: false });

    const compte = await service.interrogerCompte("674100");
    expect(compte.soldeDuPlan).toBe(xof("25000"));
    expect(compte.soldeInitial).toBe(xof("25000"));
    expect(compte.avertissements.join(" ")).toMatch(/désactivé/u);
    expect(compte.avertissements.join(" ")).toMatch(/25\s000/u);
    expect(compte.avertissements.join(" ")).toMatch(/clôture d'exercice refuse un plan qui porte des soldes/u);
  });

  it("liste les comptes qui ont bougé, avec leurs tiers", async () => {
    await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
    await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });

    const comptes = await service.comptesInterrogeables();
    const client = comptes.find((item) => item.compte === "411100")!;
    expect(client).toBeDefined();
    expect(client.tiers).toEqual(["CLI01"]);
    expect(client.mouvements).toBe(1);
    expect(client.solde).toBe(xof("2360000"));

    const fournisseur = comptes.find((item) => item.compte === "401100")!;
    expect(fournisseur.tiers).toEqual(["FOU01"]);
    // Le compte de vente porte le hors taxe, pas le toutes taxes comprises.
    const vente = comptes.find((item) => item.compte === "701100")!;
    expect(vente.solde).toBe(-xof("2000000"));
    expect(comptes.some((item) => item.compte === "674100")).toBe(false);
  });
});
