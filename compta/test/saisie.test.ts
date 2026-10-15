/**
 * La saisie, du point de vue de l'écran qui la porte.
 *
 * Ces tests suivent le chemin exact de la table de détail : l'utilisateur tape un montant hors
 * taxe et des codes de taxe, le noyau propose les lignes de taxe correspondantes, l'écriture est
 * enregistrée dans le lot, puis comptabilisée. Ce qui est vérifié ici n'est pas l'affichage mais
 * que les lignes proposées par le noyau sont bien celles que le noyau exigera ensuite.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  ServiceComptable,
  StockageMemoire,
  ZERO,
  analyserMontant,
  creerDossierDemonstration,
  formatMontant,
  proposerLignesDeTaxe,
  verifierEquilibre,
  type DemandeLigne,
  type EtatDossier
} from "../src/noyau/index";

const MAINTENANT = new Date("2026-04-15T08:00:00.000Z");
const ANNEE = 2026;

let stockage: StockageMemoire<EtatDossier>;
let service: ServiceComptable;

beforeEach(() => {
  stockage = new StockageMemoire(creerDossierDemonstration({ annee: ANNEE }));
  service = new ServiceComptable(stockage, {
    utilisateur: "superviseur",
    horloge: () => MAINTENANT,
    paquetPays: BENIN
  });
});

const xof = (texte: string) => analyserMontant(texte, BENIN.devise);

/** Une ligne telle que l'écran la transmet au générateur : montant hors taxe et codes cochés. */
function baseAchat(montant: string, codesTaxe: string[]) {
  return {
    compte: "601100",
    libelle: "Achat de marchandises — Grossiste Port Autonome",
    debit: xof(montant),
    credit: ZERO,
    codesTaxe
  };
}

describe("lignes de taxe proposées à la saisie", () => {
  it("un achat béninois appelle la TVA déductible et l'acompte retenu", () => {
    const proposees = proposerLignesDeTaxe(baseAchat("1000000", ["TVA-A18", "ACHT-1"]), BENIN.codesTaxe);

    expect(proposees).toHaveLength(2);
    const [tva, acompte] = proposees as [typeof proposees[number], typeof proposees[number]];
    expect(tva.compte).toBe("445200");
    expect(tva.sens).toBe("debit");
    expect(formatMontant(tva.debit)).toBe(formatMontant(180_000n));
    expect(acompte.compte).toBe("442100");
    // Une retenue à la source va dans le sens inverse de la charge.
    expect(acompte.sens).toBe("credit");
    expect(formatMontant(acompte.credit)).toBe(formatMontant(10_000n));
    expect(acompte.debit).toBe(ZERO);
    // Le libellé relie la taxe à l'opération : le journal doit se lire seul.
    expect(tva.libelle).toContain("TVA récupérable 18 %");
    expect(tva.libelle).toContain("Achat de marchandises");
  });

  it("un fournisseur non immatriculé à l'IFU supporte la retenue de 5 %", () => {
    const proposees = proposerLignesDeTaxe(baseAchat("1000000", ["TVA-A18", "NONIFU-5"]), BENIN.codesTaxe);
    const retenue = proposees.find((ligne) => ligne.codeTaxe === "NONIFU-5");
    expect(retenue?.sens).toBe("credit");
    expect(retenue?.credit).toBe(50_000n);
  });

  it("une vente intérieure appelle la TVA collectée au crédit", () => {
    const proposees = proposerLignesDeTaxe(
      {
        compte: "701100",
        libelle: "Vente de marchandises à Cotonou",
        debit: ZERO,
        credit: xof("2000000"),
        codesTaxe: ["TVA-V18"]
      },
      BENIN.codesTaxe
    );
    expect(proposees).toHaveLength(1);
    expect(proposees[0]?.compte).toBe("443100");
    expect(proposees[0]?.sens).toBe("credit");
    expect(proposees[0]?.credit).toBe(360_000n);
  });

  it("une exportation à taux nul ne produit aucune ligne", () => {
    const proposees = proposerLignesDeTaxe(baseAchat("5000000", ["TVA-V0"]), BENIN.codesTaxe);
    expect(proposees).toHaveLength(0);
  });

  it("la taxe pour le sport est une charge constatée par une écriture propre", () => {
    const proposees = proposerLignesDeTaxe(
      { ...baseAchat("50000000", ["SPORT"]), compte: "701100", debit: ZERO, credit: xof("50000000") },
      BENIN.codesTaxe
    );
    expect(proposees).toHaveLength(0);
  });

  it("un code de taxe inconnu est refusé, pas ignoré", () => {
    expect(() => proposerLignesDeTaxe(baseAchat("1000", ["TVA-99"]), BENIN.codesTaxe)).toThrow(ErreurRegle);
  });
});

describe("enregistrement d'une écriture saisie", () => {
  /** Ce que l'écran envoie : ligne saisie, lignes de taxe proposées, contrepartie équilibrante. */
  async function enregistrerAchatImmatricule(): Promise<string> {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-04-15", libelle: "Achats avril" });
    const ligne = baseAchat("1000000", ["TVA-A18", "ACHT-1"]);
    const taxe = proposerLignesDeTaxe(ligne, BENIN.codesTaxe);
    const demandes: DemandeLigne[] = [
      { compte: ligne.compte, libelle: ligne.libelle, debit: ligne.debit, codesTaxe: ligne.codesTaxe },
      ...taxe.map((item) => ({
        compte: item.compte,
        libelle: item.libelle,
        ...(item.sens === "debit" ? { debit: item.debit } : { credit: item.credit })
      })),
      {
        compte: "401100-FOU01",
        libelle: "Net à payer au fournisseur",
        credit: 1_170_000n,
        tiersCode: "FOU01"
      }
    ];
    await service.ajouterEcriture(lot.id, {
      piece: "FA-2026-018",
      date: "2026-04-15",
      libelle: "Facture fournisseur",
      lignes: demandes
    });
    return lot.id;
  }

  it("les lignes proposées satisfont le contrôle du noyau", async () => {
    const lotId = await enregistrerAchatImmatricule();
    const [lot] = (await service.lots()).filter((item) => item.id === lotId);
    const ecriture = lot!.ecritures[0]!;

    expect(ecriture.lignes).toHaveLength(4);
    expect(ecriture.numero).toBe("ACH-00001");
    expect(ecriture.etat).toBe("brouillon");
    const debit = ecriture.lignes.reduce((total, item) => total + item.debit, ZERO);
    const credit = ecriture.lignes.reduce((total, item) => total + item.credit, ZERO);
    expect(debit).toBe(1_180_000n);
    expect(credit).toBe(1_180_000n);
  });

  it("une ligne taxée sans sa ligne de taxe est refusée à l'enregistrement", async () => {
    const lot = await service.creerLot({ journalCode: "ACH", date: "2026-04-15", libelle: "Achats avril" });
    await expect(
      service.ajouterEcriture(lot.id, {
        piece: "FA-2026-019",
        date: "2026-04-15",
        libelle: "Facture fournisseur",
        lignes: [
          { compte: "601100", libelle: "Achat", debit: "1000000", codesTaxe: ["TVA-A18"] },
          { compte: "401100-FOU01", libelle: "Net à payer", credit: "1000000", tiersCode: "FOU01" }
        ]
      })
    ).rejects.toThrow(/code de taxe TVA-A18/);
    expect((await service.lots()).find((item) => item.id === lot.id)!.ecritures).toHaveLength(0);
  });

  it("le lot saisi, marqué prêt puis comptabilisé, alimente la balance", async () => {
    const lotId = await enregistrerAchatImmatricule();
    await service.marquerPret(lotId);
    const resultat = await service.comptabiliserLot(lotId);

    expect(resultat.mouvements.length).toBeGreaterThan(0);
    expect(verifierEquilibre(resultat.mouvements)).toEqual({
      totalDebit: 1_180_000n,
      totalCredit: 1_180_000n,
      equilibre: true
    });

    const balance = await service.balance({ periode: 4 });
    const parCompte = new Map(balance.map((ligne) => [ligne.compte, ligne] as const));
    expect(parCompte.get("601100")?.totalDebit).toBe(1_000_000n);
    expect(parCompte.get("445200")?.totalDebit).toBe(180_000n);
    expect(parCompte.get("442100")?.totalCredit).toBe(10_000n);
    expect(parCompte.get("401100")?.totalCredit).toBe(1_170_000n);
    // Le compte de charge reste débiteur, le fournisseur créditeur : le sens se lit dans la balance.
    expect(parCompte.get("601100")?.sens).toBe("debiteur");
    expect(parCompte.get("401100")?.sens).toBe("crediteur");
    expect((await service.contexte()).equilibre).toBe(true);
  });
});

describe("en-tête et contenu d'un lot", () => {
  it("l'en-tête d'un lot en saisie se modifie", async () => {
    const lot = await service.creerLot({ journalCode: "VTE", date: "2026-04-10", libelle: "Ventes" });
    const modifie = await service.modifierLot(lot.id, { date: "2026-04-20", libelle: "  Ventes d'avril  " });
    expect(modifie.date).toBe("2026-04-20");
    expect(modifie.libelle).toBe("Ventes d'avril");
    const journal = (await service.pisteAudit()).find((item) => item.action === "Lot modifié");
    expect(journal?.utilisateur).toBe("superviseur");
  });

  it("un lot comptabilisé ne se modifie pas : la contre-passation seule corrige", async () => {
    const lot = await service.creerLot({ journalCode: "AN", date: "2026-01-01", libelle: "x" });
    await expect(service.modifierLot(lot.id, { libelle: "autre" })).resolves.toBeTruthy();

    const comptabilise = (await service.lots()).find((item) => item.etat === "comptabilise")!;
    await expect(service.modifierLot(comptabilise.id, { libelle: "autre" })).rejects.toThrow(
      /contre-passation/
    );
  });

  it("un lot ne se déplace pas vers une période clôturée", async () => {
    const lot = await service.creerLot({ journalCode: "VTE", date: "2026-04-10", libelle: "Ventes" });
    await service.cloturerPeriode(4);
    await expect(service.modifierLot(lot.id, { date: "2026-04-18" })).rejects.toThrow(/clôturée/);
  });

  it("un code source inconnu est refusé", async () => {
    const lot = await service.creerLot({ journalCode: "VTE", date: "2026-04-10", libelle: "Ventes" });
    await expect(service.modifierLot(lot.id, { codeSource: "MAGIE" })).rejects.toThrow(/Code source inconnu/);
  });

  it("une écriture en brouillon se retire d'un lot ouvert", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-04-15", libelle: "Opérations diverses" });
    const ecriture = await service.ajouterEcriture(lot.id, {
      piece: "OD-001",
      date: "2026-04-15",
      libelle: "Régularisation",
      lignes: [
        { compte: "601100", libelle: "Charge constatée d'avance", debit: "250000" },
        { compte: "401100-FOU01", libelle: "Fournisseur", credit: "250000", tiersCode: "FOU01" }
      ]
    });

    const apres = await service.supprimerEcriture(lot.id, ecriture.id);
    expect(apres.ecritures).toHaveLength(0);
    const trace = (await service.pisteAudit()).find((item) => item.action === "Écriture retirée du lot");
    expect(trace?.detail).toContain("OD-001");
  });

  it("une écriture d'un lot comptabilisé ne se retire pas", async () => {
    const comptabilise = (await service.lots()).find((item) => item.etat === "comptabilise")!;
    await expect(service.supprimerEcriture(comptabilise.id, comptabilise.ecritures[0]!.id)).rejects.toThrow(
      /aucune écriture ne peut en être retirée/
    );
  });

  it("retirer une écriture inexistante le dit clairement", async () => {
    const lot = await service.creerLot({ journalCode: "OD", date: "2026-04-15", libelle: "OD" });
    await expect(service.supprimerEcriture(lot.id, "E-INCONNUE")).rejects.toThrow(/n'existe pas/);
  });
});
