import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  ServiceComptable,
  StockageMemoire,
  SOCIETE_DEMONSTRATION_BENIN,
  creerDossierDemonstration,
  numeroDeDossier,
  verifierEquilibre,
  type EtatDossier,
  type DemandeLigne
} from "../src/noyau/index";

const MAINTENANT = new Date("2026-03-01T08:00:00.000Z");
const ANNEE = 2026;

let stockage: StockageMemoire<EtatDossier>;
let service: ServiceComptable;

function nouveauService(): ServiceComptable {
  stockage = new StockageMemoire(creerDossierDemonstration({ annee: ANNEE }));
  return new ServiceComptable(stockage, {
    utilisateur: "superviseur",
    horloge: () => MAINTENANT,
    paquetPays: BENIN
  });
}

/** Achat de marchandises 1 000 000 HT à un fournisseur immatriculé : TVA 18 % + acompte 1 %. */
function lignesAchatBeninois(): DemandeLigne[] {
  return [
    {
      compte: "601100",
      libelle: "Achat de marchandises — Grossiste Port Autonome",
      debit: "1000000",
      codesTaxe: ["TVA-A18", "ACHT-1"]
    },
    { compte: "445200", libelle: "TVA récupérable 18 %", debit: "180000" },
    { compte: "442100", libelle: "Acompte 1 % retenu au fournisseur", credit: "10000" },
    {
      compte: "401100-FOU01",
      libelle: "Net à payer au fournisseur",
      credit: "1170000",
      tiersCode: "FOU01"
    }
  ];
}

beforeEach(() => {
  service = nouveauService();
});

describe("dossier de démonstration Bénin", () => {
  it("ouvre un dossier identifié comme le font les cabinets", async () => {
    const contexte = await service.contexte();

    expect(contexte.numero).toBe("CG000-26");
    expect(numeroDeDossier("CG", "000", 2026)).toBe("CG000-26");
    // Pas de code société fictif : un dossier sans société n'invente pas de segment.
    expect(numeroDeDossier("CG", "", 2026)).toBe("CG-26");
    expect(contexte.societe.raisonSociale).toBe(SOCIETE_DEMONSTRATION_BENIN.raisonSociale);
    expect(contexte.societe.ville).toBe("Cotonou");
    expect(contexte.societe.identifiantFiscal).toBe("0020151234567");
    expect(contexte.devise).toBe("XOF");
    expect(contexte.referentiel).toContain("SYSCOHADA révisé");
    expect(contexte.paquetPays).toContain("Bénin");
    expect(contexte.exercice).toBe(ANNEE);
    expect(contexte.periodeLabel).toBe("01/01/2026 - 31/12/2026");
    expect(contexte.periodeCourante).toBe(3);
    expect(contexte.utilisateur).toBe("superviseur");
    expect(contexte.stockage).toContain("mémoire");
    expect(contexte.derniereModification).toContain("Dossier de démonstration créé");
    expect(contexte.comptes).toBeGreaterThan(40);
    expect(contexte.journaux).toBe(7);
    expect(contexte.tiers).toBe(8);
    expect(contexte.lots).toBe(1);
    expect(contexte.lotsComptabilises).toBe(1);
    expect(contexte.mouvements).toBe(6);
    expect(contexte.equilibre).toBe(true);
  });

  it("refuse une société sans IFU valide, préalable de toute déclaration béninoise", () => {
    expect(() => creerDossierDemonstration({ societe: { identifiantFiscal: "123" } })).toThrow(
      /IFU invalide/
    );
    const sansIfu = creerDossierDemonstration({ societe: { identifiantFiscal: "" } });
    expect(sansIfu.societe.identifiantFiscal).toBe("");
  });

  it("porte les à-nouveaux dans une balance équilibrée", async () => {
    const balance = await service.balance();
    const parCompte = new Map(balance.map((ligne) => [ligne.compte, ligne] as const));

    expect(balance).toHaveLength(6);
    expect(parCompte.get("101000")?.solde).toBe(-60_000_000n);
    expect(parCompte.get("101000")?.sens).toBe("crediteur");
    expect(parCompte.get("521100")?.solde).toBe(55_000_000n);
    expect(parCompte.get("521100")?.sens).toBe("debiteur");
    // Le mouvement du compte auxiliaire remonte bien sur son compte principal.
    expect(parCompte.get("401100")?.solde).toBe(-10_000_000n);
    expect(verifierEquilibre((await service.lire()).mouvements).equilibre).toBe(true);

    const totaux = balance.reduce(
      (cumul, ligne) => ({
        debit: cumul.debit + ligne.totalDebit,
        credit: cumul.credit + ligne.totalCredit
      }),
      { debit: 0n, credit: 0n }
    );
    expect(totaux.debit).toBe(80_000_000n);
    expect(totaux.credit).toBe(80_000_000n);
  });
});

describe("saisie par lots", () => {
  it("ouvre un lot numéroté par journal, dans l'état « ouvert »", async () => {
    const lot = await service.creerLot({
      journalCode: "ach",
      date: "2026-02-10",
      libelle: "Achats de février 2026"
    });

    expect(lot.numero).toBe("ACH0001");
    expect(lot.journalCode).toBe("ACH");
    expect(lot.etat).toBe("ouvert");
    expect(lot.codeSource).toBe("SAISIE");
    expect(lot.ecritures).toHaveLength(0);

    const second = await service.creerLot({ journalCode: "VTE", date: "2026-02-11", libelle: "Ventes" });
    expect(second.numero).toBe("VTE0001");

    await expect(service.creerLot({ journalCode: "ZZZ", date: "2026-02-11", libelle: "x" })).rejects.toThrow(
      /journal « ZZZ » n'existe pas/
    );
    await expect(
      service.creerLot({ journalCode: "ACH", date: "2027-05-01", libelle: "hors exercice" })
    ).rejects.toThrow(/hors de l'exercice 2026/);
    await expect(
      service.creerLot({ journalCode: "ACH", date: "2026-02-11", libelle: "x", codeSource: "INCONNU" })
    ).rejects.toThrow(/Code source inconnu/);
  });

  it("contrôle chaque écriture au moment de la saisie, pas à la comptabilisation", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Achats" });

    const ecriture = await service.ajouterEcriture(lot.id, {
      piece: "FV-2026-001",
      date: "2026-02-10",
      libelle: "Facture fournisseur",
      lignes: lignesAchatBeninois()
    });

    expect(ecriture.numero).toBe("ACH-00001");
    expect(ecriture.etat).toBe("brouillon");
    expect(ecriture.lignes).toHaveLength(4);
    // Le tiers se lit dans le segment du compte auxiliaire.
    expect(ecriture.lignes[3]?.tiersCode).toBe("FOU01");
    expect(ecriture.lignes[0]?.codesTaxe).toEqual(["TVA-A18", "ACHT-1"]);

    const etat = await service.lire();
    expect(etat.mouvements).toHaveLength(6); // rien n'est comptabilisé tant que le lot est ouvert
  });

  it("refuse une écriture déséquilibrée, un compte inconnu ou un tiers manquant", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-02-10", libelle: "OD" });

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-1",
        date: "2026-02-10",
        libelle: "Déséquilibrée",
        lignes: [
          { compte: "601100", libelle: "Charge", debit: "1000" },
          { compte: "521100", libelle: "Banque", credit: "999" }
        ]
      })
    ).rejects.toThrow(/n'est pas équilibrée/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-2",
        date: "2026-02-10",
        libelle: "Compte inconnu",
        lignes: [{ compte: "999999", libelle: "x", debit: "1000" }]
      })
    ).rejects.toThrow(/n'existe pas dans le plan/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-3",
        date: "2026-02-10",
        libelle: "Auxiliaire sans tiers",
        lignes: [
          { compte: "411100", libelle: "Client", debit: "1000" },
          { compte: "701100", libelle: "Vente", credit: "1000" }
        ]
      })
    ).rejects.toThrow(/le tiers est obligatoire/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-4",
        date: "2026-02-10",
        libelle: "Tiers inconnu",
        lignes: [
          { compte: "411100-INCONNU", libelle: "Client", debit: "1000" },
          { compte: "701100", libelle: "Vente", credit: "1000" }
        ]
      })
    ).rejects.toThrow(/n'existe pas ou est inactif/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-5",
        date: "2026-02-10",
        libelle: "Deux sens sur une ligne",
        lignes: [{ compte: "521100", libelle: "Banque", debit: "1000", credit: "1000" }]
      })
    ).rejects.toThrow(/jamais les deux/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-6",
        date: "2026-02-10",
        libelle: "Taxe sans sa ligne",
        lignes: [
          { compte: "601100", libelle: "Achat", debit: "1000000", codesTaxe: ["TVA-A18"] },
          { compte: "401100-FOU01", libelle: "Fournisseur", credit: "1000000", tiersCode: "FOU01" }
        ]
      })
    ).rejects.toThrow(/445200/);

    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "OD-7",
        date: "2026-02-10",
        libelle: "Code de taxe inconnu",
        lignes: [{ compte: "601100", libelle: "Achat", debit: "1000", codesTaxe: ["TVA-99"] }]
      })
    ).rejects.toThrow(/n'existe pas dans le paquet pays/);

    // Rien de tout cela n'a été ajouté au lot.
    const apres = await service.lots();
    expect(apres.find((item) => item.id === lot.id)?.ecritures).toHaveLength(0);
  });

  it("refuse deux fois la même référence de pièce dans un lot", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-02-10", libelle: "OD" });
    const lignes: DemandeLigne[] = [
      { compte: "521100", libelle: "Banque", debit: "1000" },
      { compte: "571100", libelle: "Caisse", credit: "1000" }
    ];
    await service.ajouterEcriture(lot.id, { piece: "VIR-1", date: "2026-02-10", libelle: "Virement", lignes });
    await expect(
      service.ajouterEcriture(lot.id, { piece: "vir-1", date: "2026-02-11", libelle: "Doublon", lignes })
    ).rejects.toThrow(/apparaît deux fois/);
  });

  it("comptabilise un lot d'un seul mouvement, de façon atomique", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Achats" });
    await service.ajouterEcriture(lot.id, {
      piece: "FV-2026-001",
      date: "2026-02-10",
      libelle: "Facture fournisseur",
      lignes: lignesAchatBeninois()
    });

    // Un lot en saisie ne se comptabilise pas : il faut d'abord le déclarer prêt.
    await expect(service.comptabiliserLot(lot.id)).rejects.toThrow(/prêt à comptabiliser/);

    const pret = await service.marquerPret(lot.id);
    expect(pret.etat).toBe("pret");

    const resultat = await service.comptabiliserLot(lot.id);
    expect(resultat.lot.etat).toBe("comptabilise");
    expect(resultat.lot.comptabilisePar).toBe("superviseur");
    expect(resultat.lot.comptabiliseLe).toBe(MAINTENANT.toISOString());
    expect(resultat.mouvements).toHaveLength(4);
    expect(verifierEquilibre(resultat.mouvements).equilibre).toBe(true);
    expect(resultat.mouvements[0]?.periode).toBe(2);
    expect(resultat.mouvements.find((item) => item.compte === "401100-FOU01")?.tiersCode).toBe("FOU01");
    expect(resultat.mouvements.find((item) => item.compte === "445200")?.codesTaxe).toEqual([]);
    expect(resultat.mouvements.find((item) => item.compte === "601100")?.codesTaxe).toEqual([
      "TVA-A18",
      "ACHT-1"
    ]);

    await expect(service.comptabiliserLot(lot.id)).rejects.toThrow(/déjà comptabilisé/);
    await expect(service.marquerPret(lot.id)).rejects.toThrow(/n'est pas en saisie/);
    await expect(service.supprimerLot(lot.id)).rejects.toThrow(/contre-passation/);
    expect(stockage.nombreEcritures).toBeGreaterThan(3);
  });

  it("alimente la balance, le journal et le grand livre depuis les mouvements comptabilisés", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Achats" });
    await service.ajouterEcriture(lot.id, {
      piece: "FV-2026-001",
      date: "2026-02-10",
      libelle: "Facture fournisseur",
      lignes: lignesAchatBeninois()
    });
    await service.marquerPret(lot.id);
    await service.comptabiliserLot(lot.id);

    const balance = await service.balance();
    const parCompte = new Map(balance.map((ligne) => [ligne.compte, ligne] as const));
    expect(parCompte.get("445200")?.totalDebit).toBe(180_000n);
    expect(parCompte.get("445200")?.sens).toBe("debiteur");
    expect(parCompte.get("601100")?.solde).toBe(1_000_000n);
    expect(parCompte.get("442100")?.solde).toBe(-10_000n);
    expect(parCompte.get("401100")?.solde).toBe(-11_170_000n); // 10 000 000 d'à-nouveau + 1 170 000

    const journal = await service.journal({ journalCode: "ACH" });
    expect(journal).toHaveLength(1);
    expect(journal[0]?.piece).toBe("FV-2026-001");
    expect(journal[0]?.lignes).toHaveLength(4);
    expect(journal[0]?.totalDebit).toBe(1_180_000n);
    expect(journal[0]?.totalCredit).toBe(1_180_000n);

    const grandLivre = await service.grandLivre("401100");
    expect(grandLivre).toHaveLength(2); // à-nouveau + achat
    expect(grandLivre[1]?.piece).toBe("FV-2026-001");
    expect(grandLivre[1]?.soldeProgressif).toBe(-11_170_000n);

    // Le détail par tiers reste accessible, sans perdre la vue par compte : l'à-nouveau du
    // fournisseur et la facture du mois ressortent tous les deux, et rien d'autre.
    const parTiers = await service.journal({ tiersCode: "FOU01" });
    expect(parTiers.map((piece) => piece.piece)).toEqual(["AN-0001", "FV-2026-001"]);
    expect(
      parTiers.every((piece) => piece.lignes.every((ligne) => ligne.tiersCode === "FOU01"))
    ).toBe(true);
    await expect(service.grandLivre("999999")).rejects.toThrow(/n'existe pas dans le plan/);
  });

  it("contre-passe sans jamais modifier l'écriture d'origine", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Achats" });
    await service.ajouterEcriture(lot.id, {
      piece: "FV-2026-001",
      date: "2026-02-10",
      libelle: "Facture fournisseur",
      lignes: lignesAchatBeninois()
    });
    await service.marquerPret(lot.id);
    await service.comptabiliserLot(lot.id);
    const soldeAvant = (await service.balance()).find((ligne) => ligne.compte === "601100")?.solde;
    expect(soldeAvant).toBe(1_000_000n);

    await expect(service.contrePasserLot("LOT-INCONNU")).rejects.toThrow(/n'existe pas dans ce dossier/);

    const contrePassation = await service.contrePasserLot(lot.id);
    expect(contrePassation.numero).toBe("ACH0002");
    expect(contrePassation.etat).toBe("ouvert");
    expect(contrePassation.origine).toBe(lot.id);
    expect(contrePassation.codeSource).toBe("CONTREPASSATION");
    expect(contrePassation.date).toBe("2026-03-01"); // datée du jour, pas de l'écriture d'origine
    expect(contrePassation.ecritures[0]?.piece).toBe("CP-FV-2026-001");
    expect(contrePassation.ecritures[0]?.origine).toBe(lot.ecritures[0]?.id);

    const ligneCharge = contrePassation.ecritures[0]?.lignes[0];
    expect(ligneCharge?.compte).toBe("601100");
    expect(ligneCharge?.debit).toBe(0n);
    expect(ligneCharge?.credit).toBe(1_000_000n); // inversée, pas modifiée

    const lots = await service.lots();
    expect(lots.find((item) => item.id === lot.id)?.etat).toBe("contre-passe");

    // La contre-passation reste un lot : elle passe par le même circuit de validation.
    await service.marquerPret(contrePassation.id);
    await service.comptabiliserLot(contrePassation.id);

    const apres = await service.balance();
    const parCompte = new Map(apres.map((ligne) => [ligne.compte, ligne] as const));
    expect(parCompte.get("601100")?.solde).toBe(0n);
    expect(parCompte.get("601100")?.sens).toBe("nul");
    expect(parCompte.get("445200")?.solde).toBe(0n);
    expect(parCompte.get("401100")?.solde).toBe(-10_000_000n); // retour à l'à-nouveau
    expect(verifierEquilibre((await service.lire()).mouvements).equilibre).toBe(true);

    await expect(service.contrePasserLot(lot.id)).rejects.toThrow(/Seul un lot comptabilisé/);
  });

  it("supprime un lot en saisie et refuse de supprimer un lot comptabilisé", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-02-10", libelle: "Brouillon" });
    await service.supprimerLot(lot.id);
    expect((await service.lots()).some((item) => item.id === lot.id)).toBe(false);

    const garde = await service.creerLot({ journalCode: "ACH", date: "2026-02-12", libelle: "Achats" });
    await service.ajouterEcriture(garde.id, {
      piece: "FV-2",
      date: "2026-02-12",
      libelle: "Facture",
      lignes: lignesAchatBeninois()
    });
    await service.marquerPret(garde.id);
    await service.comptabiliserLot(garde.id);
    await expect(service.supprimerLot(garde.id)).rejects.toThrow(ErreurRegle);
  });

  it("verrouille une période : plus aucun lot, plus aucune écriture", async () => {
    await service.cloturerPeriode(2);

    await expect(
      service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Février" })
    ).rejects.toThrow(/clôturée/);

    // Une période ouverte continue d'accepter la saisie.
    const mars = await service.creerLot({ journalCode: "ACH", date: "2026-03-10", libelle: "Mars" });
    expect(mars.etat).toBe("ouvert");

    await service.ouvrirPeriode(2);
    const fevrier = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Février" });
    expect(fevrier.etat).toBe("ouvert");

    const exercice = (await service.lire()).exercice;
    expect(exercice.periodes.find((periode) => periode.numero === 2)?.clots).toBe(false);
  });

  it("tient une piste d'audit ajout-seulement, attribuée et horodatée", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-02-10", libelle: "Achats" });
    await service.ajouterEcriture(lot.id, {
      piece: "FV-1",
      date: "2026-02-10",
      libelle: "Facture",
      lignes: lignesAchatBeninois()
    });
    await service.marquerPret(lot.id);
    await service.comptabiliserLot(lot.id);

    const piste = await service.pisteAudit();
    const actions = piste.map((evenement) => evenement.action);
    expect(actions).toEqual([
      "Dossier de démonstration créé",
      "Lot créé",
      "Écriture ajoutée au lot",
      "Lot marqué prêt à comptabiliser",
      "Lot comptabilisé"
    ]);
    expect(piste.map((evenement) => evenement.sequence)).toEqual([1, 2, 3, 4, 5]);
    for (const evenement of piste) {
      expect(evenement.utilisateur).toBe("superviseur");
      expect(evenement.horodate).toBeTruthy();
      expect(evenement.entiteIdentifiant).toBeTruthy();
    }
    expect(actions.at(-1)).toBe("Lot comptabilisé");
    expect(piste.at(-1)?.detail).toContain("4 mouvements");
  });

  it("persiste l'état derrière son port de stockage", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-02-10", libelle: "Persistant" });
    const relu = await service.lire();
    expect(relu.lots.some((item) => item.id === lot.id)).toBe(true);
    expect(stockage.nombreEcritures).toBeGreaterThan(0);

    // Un second service sur le même stockage retrouve le dossier : c'est ce que fait un rechargement.
    const second = new ServiceComptable(stockage, { horloge: () => MAINTENANT });
    expect((await second.lots()).some((item) => item.id === lot.id)).toBe(true);
    expect((await second.contexte()).numero).toBe("CG000-26");
  });
});

describe("structure du dossier", () => {
  it("ajoute un compte au plan et refuse les doublons ou les groupes inconnus", async () => {
    const compte = await service.ajouterCompte({
      numero: "628100",
      libelle: "Cotisations et abonnements",
      groupe: "CHG-EXP"
    });
    expect(compte.comptePrincipal).toBe("628100");
    expect(compte.classe).toBe("6");
    expect((await service.planComptable()).some((item) => item.numero === "628100")).toBe(true);
    expect((await service.planComptable("cotisations")).map((item) => item.numero)).toEqual(["628100"]);

    await expect(
      service.ajouterCompte({ numero: "628100", libelle: "Doublon", groupe: "CHG-EXP" })
    ).rejects.toThrow(/existe déjà/);
    await expect(
      service.ajouterCompte({ numero: "628200", libelle: "Groupe inconnu", groupe: "INVENTE" })
    ).rejects.toThrow(/groupe de comptes/i);
  });

  it("ajoute un tiers, le normalise et refuse un doublon", async () => {
    const tiers = await service.ajouterTiers({
      code: "fou09",
      nom: "  quincaillerie du plateau  ",
      type: "fournisseur",
      identifiantFiscal: "0020201555666",
      immatricule: true,
      adresse: "",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "",
      courriel: "Contact@Quincaillerie.BJ",
      actif: true
    });
    expect(tiers.code).toBe("FOU09");
    expect(tiers.nom).toBe("quincaillerie du plateau");
    expect(tiers.courriel).toBe("contact@quincaillerie.bj");

    await expect(
      service.ajouterTiers({ ...tiers, nom: "Doublon" })
    ).rejects.toThrow(/existe déjà/);
    await expect(
      service.ajouterTiers({ ...tiers, code: "FOU10", nom: "" })
    ).rejects.toThrow(/nom du tiers est obligatoire/);

    const codes = (await service.codesTaxePour({
      operation: "achat",
      tiersImmatricule: false,
      tiersPublic: false,
      exportation: false
    })).map((item) => item.code);
    expect(codes).toContain("NONIFU-5");
  });

  it("expose journaux, tiers et lots pour les écrans", async () => {
    const journaux = await service.journaux();
    expect(journaux.map((journal) => journal.code)).toEqual(["ACH", "VTE", "BQ", "CAI", "OD", "SAL", "AN"]);
    expect(journaux.find((journal) => journal.code === "BQ")?.compteContrepartie).toBe("521100");

    const tiers = await service.listeTiers();
    expect(tiers.filter((item) => item.type === "client")).toHaveLength(2);
    expect(tiers.some((item) => item.code === "FOU03" && !item.immatricule)).toBe(true);

    expect((await service.lots({ etat: "comptabilise" })).map((lot) => lot.numero)).toEqual(["AN0001"]);
    expect(await service.lots({ journalCode: "ACH" })).toHaveLength(0);
  });
});
