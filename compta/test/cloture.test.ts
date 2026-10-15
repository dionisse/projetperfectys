/**
 * Clôture d'exercice et multi-exercices.
 *
 * Ce qui est vérifié : que la préparation n'écrit rien et cite les obstacles, que la clôture solde
 * les comptes de gestion vers le 121000 et reporte les comptes de bilan segment par segment, que le
 * nouvel exercice s'ouvre avec ses périodes, que les lectures d'un exercice ignorent les autres, et
 * qu'un exercice clos ne reçoit plus d'écriture.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  COMPTE_RESULTAT_EXERCICE,
  ZERO,
  type RapportDeCloture,
  type ServiceComptable
} from "../src/noyau/index";
import { nouveauService, posterAchat, posterLot, posterVente } from "./aide";

let service: ServiceComptable;

beforeEach(() => {
  service = nouveauService().service;
});

/** Un mois d'activité : une vente de 2 000 000 et un achat de 1 000 000, résultat 1 000 000. */
async function moisDActivite(): Promise<void> {
  await posterVente(service, { date: "2026-04-05", piece: "FV-2026-001", montant: "2000000" });
  await posterAchat(service, { date: "2026-04-12", piece: "FA-2026-018", montant: "1000000" });
}

/** Clôture les périodes normales et d'ajustement, en laissant ouverte la période de clôture. */
async function cloturerJusquA(derniere: number): Promise<void> {
  for (let numero = 1; numero <= derniere; numero += 1) {
    await service.cloturerPeriode(numero);
  }
}

const totalDebit = (rapport: RapportDeCloture, lignes: "cloture" | "anouveaux"): bigint =>
  (lignes === "cloture" ? rapport.lignesDeCloture : rapport.lignesDANouveaux).reduce(
    (total, ligne) => total + ligne.debit,
    ZERO
  );
const totalCredit = (rapport: RapportDeCloture, lignes: "cloture" | "anouveaux"): bigint =>
  (lignes === "cloture" ? rapport.lignesDeCloture : rapport.lignesDANouveaux).reduce(
    (total, ligne) => total + ligne.credit,
    ZERO
  );

describe("préparation de la clôture", () => {
  it("n'écrit rien et cite les périodes ouvertes comme obstacle", async () => {
    await moisDActivite();
    const rapport = await service.preparerCloture();

    expect(rapport.exercice).toBe(2026);
    expect(rapport.prete).toBe(false);
    expect(rapport.periodesOuvertes).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(rapport.obstacles.join(" ")).toMatch(/ne sont pas clôturées/i);
    // Le résultat est connu avant la clôture : c'est lui que l'utilisateur doit voir.
    expect(rapport.resultat).toBe(1_000_000n);
    // 6 à-nouveaux + 3 lignes de vente + 4 lignes d'achat.
    expect(rapport.mouvementsDeLexercice).toBe(13);

    // Rien n'a été écrit.
    const etat = await service.lire();
    expect(etat.exercicesClos.length).toBe(0);
    expect(etat.exercice.annee).toBe(2026);
    expect(etat.lots.some((lot) => lot.codeSource === "CLOTURE")).toBe(false);
  });

  it("refuse tant qu'un lot de l'exercice n'est pas comptabilisé", async () => {
    await moisDActivite();
    // Le lot est ouvert avant la clôture des périodes : une fois closes, plus rien ne peut y entrer.
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-04-20", libelle: "Ajustement en attente" });
    await cloturerJusquA(13);

    const rapport = await service.preparerCloture();
    expect(rapport.prete).toBe(false);
    expect(rapport.lotsEnAttente.map((item) => item.numero)).toEqual([lot.numero]);
    expect(rapport.obstacles.join(" ")).toMatch(/pas comptabilisé/i);
    expect(rapport.obstacles.join(" ")).toContain(lot.numero);

    await expect(service.cloturerExercice()).rejects.toThrow(/clôture de l'exercice 2026 est refusée/i);
    // Rien n'a été écrit malgré le refus.
    expect((await service.lire()).exercicesClos.length).toBe(0);

    // Un lot en attente dont les périodes sont closes ne se comptabilise plus : il se retire.
    await service.supprimerLot(lot.id);
    const apres = await service.preparerCloture();
    expect(apres.lotsEnAttente).toEqual([]);
    expect(apres.prete).toBe(true);
  });

  it("refuse un plan qui porte des soldes initiaux", async () => {
    await cloturerJusquA(13);
    await service.ajouterCompte({
      numero: "244100",
      libelle: "Matériel informatique",
      groupe: "IMMO-COR",
      soldeInitial: 500_000n
    });

    const rapport = await service.preparerCloture();
    expect(rapport.prete).toBe(false);
    expect(rapport.soldesInitiauxDuPlan).toEqual(["244100"]);
    expect(rapport.obstacles.join(" ")).toMatch(/soldes initiaux/i);
  });

  it("décrit les deux écritures que la clôture passerait", async () => {
    await moisDActivite();
    await cloturerJusquA(13);

    const rapport = await service.preparerCloture();
    expect(rapport.prete).toBe(true);
    expect(rapport.obstacles).toEqual([]);
    expect(rapport.periodeDeCloture?.numero).toBe(14);
    expect(rapport.periodeDeCloture?.type).toBe("cloture");
    expect(rapport.dateCloture).toBe("2026-12-31");
    expect(rapport.equilibreGrandLivre).toBe(true);

    // 1. Solde des comptes de gestion : le produit est débité, la charge créditée, le résultat porté
    //    au compte 121000.
    const cloture = new Map(rapport.lignesDeCloture.map((ligne) => [ligne.compte, ligne] as const));
    expect(cloture.get("701100")?.debit).toBe(2_000_000n);
    expect(cloture.get("601100")?.credit).toBe(1_000_000n);
    expect(cloture.get(COMPTE_RESULTAT_EXERCICE)?.credit).toBe(1_000_000n);
    expect(totalDebit(rapport, "cloture")).toBe(totalCredit(rapport, "cloture"));

    // 2. À-nouveaux : les comptes de bilan, segment de tiers compris.
    const anouveaux = new Map(
      rapport.lignesDANouveaux.map((ligne) => [`${ligne.compte}|${ligne.tiersCode ?? ""}`, ligne] as const)
    );
    expect(anouveaux.get("311000|")?.debit).toBe(20_000_000n);
    expect(anouveaux.get("521100|")?.debit).toBe(55_000_000n);
    expect(anouveaux.get("101000|")?.credit).toBe(60_000_000n);
    expect(anouveaux.get("401100-FOU01|FOU01")?.credit).toBe(11_170_000n);
    expect(anouveaux.get("411100-CLI01|CLI01")?.debit).toBe(2_360_000n);
    expect(anouveaux.get(`${COMPTE_RESULTAT_EXERCICE}|`)?.credit).toBe(1_000_000n);
    expect(totalDebit(rapport, "anouveaux")).toBe(82_540_000n);
    expect(totalCredit(rapport, "anouveaux")).toBe(82_540_000n);
    // Aucun compte de gestion ne se reporte.
    expect(rapport.lignesDANouveaux.some((ligne) => ligne.compte.startsWith("7"))).toBe(false);
    expect(rapport.lignesDANouveaux.some((ligne) => ligne.compte.startsWith("6"))).toBe(false);
  });

  it("annonce les engagements hors bilan sans les reporter", async () => {
    await service.ajouterCompte({ numero: "011000", libelle: "Engagements donnés", groupe: "ENG" });
    await service.ajouterCompte({ numero: "011100", libelle: "Contrepartie des engagements", groupe: "ENG" });
    await posterLot(service, {
      journalCode: "OD",
      date: "2026-06-30",
      piece: "OD-2026-040",
      libelle: "Engagement de crédit-bail",
      lignes: [
        { compte: "011000", libelle: "Engagements donnés", debit: "5000000" },
        { compte: "011100", libelle: "Contrepartie", credit: "5000000" }
      ],
      contrepartie: ""
    });
    await cloturerJusquA(13);

    const rapport = await service.preparerCloture();
    expect(rapport.prete).toBe(true);
    expect(rapport.comptesHorsEtat.map((segment) => segment.compte)).toEqual(["011000", "011100"]);
    expect(rapport.avertissements.join(" ")).toMatch(/hors bilan/i);
    expect(rapport.avertissements.join(" ")).toMatch(/se ressaisissent/i);
    expect(rapport.lignesDANouveaux.some((ligne) => ligne.compte.startsWith("0"))).toBe(false);
  });
});

describe("clôture d'exercice", () => {
  it("solde les comptes de gestion, reporte le bilan et ouvre l'exercice suivant", async () => {
    await moisDActivite();
    await cloturerJusquA(13);

    const { clos, suivant } = await service.cloturerExercice();

    expect(clos.exercice.annee).toBe(2026);
    expect(clos.resultat).toBe(1_000_000n);
    expect(clos.nombreDANouveaux).toBe(11);
    expect(clos.cloturePar).toBe("superviseur");
    expect(clos.exercice.periodes.every((periode) => periode.clots)).toBe(true);
    expect(suivant.annee).toBe(2027);
    expect(suivant.dateDebut).toBe("2027-01-01");
    expect(suivant.dateFin).toBe("2027-12-31");
    expect(suivant.periodes.every((periode) => !periode.clots)).toBe(true);

    const etat = await service.lire();
    expect(etat.exercice.annee).toBe(2027);
    expect(etat.exercicesClos.length).toBe(1);

    const pieceDe = (lot: (typeof etat.lots)[number]): string => lot.ecritures[0]?.piece ?? "";
    const lots = etat.lots.filter(
      (lot) => lot.codeSource === "CLOTURE" || pieceDe(lot) === "AN-2027-0001"
    );
    expect(lots.length).toBe(2);
    expect(lots.every((lot) => lot.etat === "comptabilise")).toBe(true);
    const cloture = lots.find((lot) => lot.codeSource === "CLOTURE")!;
    expect(cloture.journalCode).toBe("OD");
    expect(cloture.date).toBe("2026-12-31");
    expect(cloture.id).toBe(clos.lotClotureId);
    const anouveaux = lots.find((lot) => pieceDe(lot) === "AN-2027-0001")!;
    expect(anouveaux.journalCode).toBe("AN");
    expect(anouveaux.codeSource).toBe("ANOUVEAU");
    expect(anouveaux.date).toBe("2027-01-01");
    expect(anouveaux.id).toBe(clos.lotANouveauxId);

    // Les mouvements portent l'exercice auquel ils appartiennent.
    expect(etat.mouvements.filter((mouvement) => mouvement.exercice === 2027).length).toBe(11);
    expect(
      etat.mouvements.filter((mouvement) => mouvement.exercice === 2026 && mouvement.periode === 14).length
    ).toBe(3);

    const audit = await service.pisteAudit();
    expect(audit.some((item) => item.action === "Exercice clôturé")).toBe(true);
    expect(audit.some((item) => item.action === "À-nouveaux créés")).toBe(true);

    const exercices = await service.exercices();
    expect(exercices.map((item) => [item.exercice.annee, item.clos])).toEqual([
      [2026, true],
      [2027, false]
    ]);
  });

  it("le bilan clos présente le résultat au compte 121000, et le suivant sa colonne N-1", async () => {
    await moisDActivite();
    await cloturerJusquA(13);
    await service.cloturerExercice();

    const clos = await service.bilan(undefined, 2026);
    expect(clos.exercice).toBe(2026);
    expect(clos.totalActifNet).toBe(82_540_000n);
    expect(clos.totalPassif).toBe(82_540_000n);
    expect(clos.ecart).toBe(ZERO);
    expect(clos.resultatExercice).toBe(1_000_000n);
    const passif = new Map(clos.passif.map((ligne) => [ligne.code, ligne] as const));
    // Le résultat vient désormais du compte 121000, plus des comptes de gestion soldés.
    expect(passif.get("RESULTAT")?.net).toBe(1_000_000n);
    expect(passif.get("RESULTAT")?.comptes.map((compte) => compte.numero)).toEqual([COMPTE_RESULTAT_EXERCICE]);
    expect(passif.get("CAP")?.net).toBe(70_000_000n);
    expect(passif.get("TOTAL-CAP")?.net).toBe(71_000_000n);

    const suivant = await service.bilan();
    expect(suivant.exercice).toBe(2027);
    expect(suivant.dateCloture).toBe("2027-12-31");
    // Les à-nouveaux reportent exactement le bilan clos.
    expect(suivant.totalActifNet).toBe(82_540_000n);
    expect(suivant.totalPassif).toBe(82_540_000n);
    expect(suivant.ecart).toBe(ZERO);
    expect(suivant.resultatExercice).toBe(1_000_000n);
    expect(suivant.precedent?.exercice).toBe(2026);
    expect(suivant.precedent?.totalActifNet).toBe(clos.totalActifNet);
    expect(suivant.precedent?.resultatExercice).toBe(clos.resultatExercice);
    expect(suivant.precedent?.dateCloture).toBe("2026-12-31");
  });

  it("le compte de résultat du nouvel exercice est néant, celui de l'exercice clos reste lisible", async () => {
    await moisDActivite();
    await cloturerJusquA(13);
    await service.cloturerExercice();

    const clos = await service.compteDeResultat(undefined, 2026);
    expect(clos.resultatNet).toBe(1_000_000n);
    expect(clos.controle.ecart).toBe(ZERO);

    const courant = await service.compteDeResultat();
    expect(courant.exercice).toBe(2027);
    expect(courant.resultatNet).toBe(ZERO);
    expect(courant.controle.ecart).toBe(ZERO);

    await expect(service.compteDeResultat(undefined, 2025)).rejects.toThrow(/n'existe pas dans ce dossier/i);
    await expect(service.bilan(3, 2025)).rejects.toThrow(/n'existe pas dans ce dossier/i);
  });

  it("les lectures du nouvel exercice ignorent l'exercice clos", async () => {
    await moisDActivite();
    await cloturerJusquA(13);
    await service.cloturerExercice();

    const balance = await service.balance();
    expect(balance.some((ligne) => ligne.compte === "701100")).toBe(false);
    expect(balance.some((ligne) => ligne.compte === "601100")).toBe(false);
    const parCompte = new Map(balance.map((ligne) => [ligne.compte, ligne] as const));
    expect(parCompte.get("101000")?.solde).toBe(-60_000_000n);
    expect(parCompte.get("401100")?.solde).toBe(-11_170_000n);
    expect(parCompte.get(COMPTE_RESULTAT_EXERCICE)?.solde).toBe(-1_000_000n);

    // L'exercice clos reste consultable, période de clôture comprise.
    const journal = await service.journal({ exercice: 2026, periode: 14 });
    expect(journal.length).toBe(1);
    expect(journal[0]!.piece).toBe("CL-2026-0001");
    const journalAN = await service.journal({ exercice: 2027, periode: 1 });
    expect(journalAN.map((piece) => piece.piece)).toEqual(["AN-2027-0001"]);
  });

  it("un exercice clos ne reçoit plus d'écriture, et le suivant exige ses propres clôtures", async () => {
    await moisDActivite();
    await cloturerJusquA(13);
    await service.cloturerExercice();

    await expect(
      service.creerLot({ journalCode: "OD", date: "2026-11-30", libelle: "Retard de saisie" })
    ).rejects.toThrow(/hors de l'exercice 2027/i);

    await expect(service.cloturerExercice()).rejects.toThrow(/ne sont pas clôturées/i);

    // Une écriture du nouvel exercice passe, et n'apparaît pas dans l'exercice clos.
    await posterVente(service, { date: "2027-02-10", piece: "FV-2027-001", montant: "3000000" });
    const courant = await service.compteDeResultat(undefined, 2027);
    expect(courant.resultatNet).toBe(3_000_000n);
    const clos = await service.compteDeResultat(undefined, 2026);
    expect(clos.resultatNet).toBe(1_000_000n);

    const bilan2027 = await service.bilan(undefined, 2027);
    expect(bilan2027.precedent?.exercice).toBe(2026);
    expect(bilan2027.precedent?.resultatExercice).toBe(1_000_000n);
    expect(bilan2027.totalActifNet).toBe(86_080_000n);
    expect(bilan2027.ecart).toBe(ZERO);
  });

  it("un exercice sans activité se clôture sans écriture de gestion", async () => {
    const { service: vierge } = nouveauService({ annee: 2026 });
    for (let numero = 1; numero <= 13; numero += 1) {
      await vierge.cloturerPeriode(numero);
    }
    const rapport = await vierge.preparerCloture();
    expect(rapport.prete).toBe(true);
    expect(rapport.resultat).toBe(ZERO);
    expect(rapport.lignesDeCloture).toEqual([]);
    expect(rapport.avertissements.join(" ")).toMatch(/résultat de l'exercice est nul/i);
    // Les à-nouveaux reportent les seuls comptes de bilan des à-nouveaux d'ouverture.
    expect(rapport.lignesDANouveaux.length).toBe(6);

    const { clos, suivant } = await vierge.cloturerExercice();
    expect(clos.lotClotureId).toBeNull();
    expect(clos.lotANouveauxId).not.toBeNull();
    expect(clos.resultat).toBe(ZERO);
    expect(suivant.annee).toBe(2027);

    const bilan = await vierge.bilan(undefined, 2027);
    expect(bilan.totalActifNet).toBe(80_000_000n);
    expect(bilan.ecart).toBe(ZERO);
    expect(bilan.precedent?.totalActifNet).toBe(80_000_000n);
    expect(bilan.precedent?.resultatExercice).toBe(ZERO);
  });
});
