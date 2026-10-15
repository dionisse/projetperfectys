/**
 * La déclaration de TVA, calculée depuis le grand livre.
 *
 * Ces tests vérifient trois choses distinctes : que la déclaration est **produite** par les codes
 * de taxe du paquet pays et non ressaisie ; qu'elle **rapproche** ce qu'elle calcule de ce que la
 * comptabilité contient, et signale tout écart ; et qu'elle laisse dehors ce qui n'est pas de la
 * TVA — les acomptes et retenues d'impôt sur le résultat relèvent d'une autre déclaration.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  ServiceComptable,
  StockageMemoire,
  ZERO,
  analyserMontant,
  codesDeTva,
  creerDossierDemonstration,
  oppose,
  proposerLignesDeTaxe,
  type DateCivile,
  type DemandeLigne,
  type EtatDossier,
  type Montant
} from "../src/noyau/index";

const MAINTENANT = new Date("2026-04-15T08:00:00.000Z");
const ANNEE = 2026;

let service: ServiceComptable;

beforeEach(() => {
  const stockage = new StockageMemoire<EtatDossier>(creerDossierDemonstration({ annee: ANNEE }));
  service = new ServiceComptable(stockage, {
    utilisateur: "superviseur",
    horloge: () => MAINTENANT,
    paquetPays: BENIN
  });
});

interface LigneSaisie {
  compte: string;
  libelle: string;
  debit?: string;
  credit?: string;
  codesTaxe?: string[];
}

/**
 * Saisit et comptabilise une écriture complète : lignes de base, lignes de taxe produites par le
 * noyau, contrepartie équilibrante. C'est le chemin exact de l'écran de saisie.
 */
async function posterLot(demande: {
  journalCode: string;
  date: DateCivile;
  piece: string;
  libelle: string;
  lignes: LigneSaisie[];
  contrepartie: string;
  tiers?: string;
}): Promise<void> {
  const lot = await service.creerLot({
    journalCode: demande.journalCode,
    date: demande.date,
    libelle: demande.libelle
  });

  const demandes: DemandeLigne[] = [];
  for (const ligne of demande.lignes) {
    const debit = ligne.debit !== undefined ? analyserMontant(ligne.debit, BENIN.devise) : ZERO;
    const credit = ligne.credit !== undefined ? analyserMontant(ligne.credit, BENIN.devise) : ZERO;
    const codes = ligne.codesTaxe ?? [];
    const base: DemandeLigne = { compte: ligne.compte, libelle: ligne.libelle, codesTaxe: codes };
    if (debit !== ZERO) {
      base.debit = debit;
    }
    if (credit !== ZERO) {
      base.credit = credit;
    }
    demandes.push(base);
    for (const taxe of proposerLignesDeTaxe(
      { compte: ligne.compte, libelle: ligne.libelle, debit, credit, codesTaxe: codes },
      BENIN.codesTaxe
    )) {
      const ligneDeTaxe: DemandeLigne = { compte: taxe.compte, libelle: taxe.libelle };
      if (taxe.sens === "debit") {
        ligneDeTaxe.debit = taxe.debit;
      } else {
        ligneDeTaxe.credit = taxe.credit;
      }
      demandes.push(ligneDeTaxe);
    }
  }

  const entier = (valeur: string | Montant | undefined): Montant =>
    typeof valeur === "bigint" ? valeur : ZERO;
  const totalDebit = demandes.reduce<Montant>((total, ligne) => total + entier(ligne.debit), ZERO);
  const totalCredit = demandes.reduce<Montant>((total, ligne) => total + entier(ligne.credit), ZERO);
  const ecart = totalDebit - totalCredit;
  const contrepartie: DemandeLigne = { compte: demande.contrepartie, libelle: "Contrepartie" };
  if (ecart > ZERO) {
    contrepartie.credit = ecart;
  } else {
    contrepartie.debit = oppose(ecart);
  }
  if (demande.tiers) {
    contrepartie.tiersCode = demande.tiers;
    contrepartie.compte = `${demande.contrepartie}-${demande.tiers}`;
  }
  demandes.push(contrepartie);

  await service.ajouterEcriture(lot.id, {
    piece: demande.piece,
    date: demande.date,
    libelle: demande.libelle,
    lignes: demandes
  });
  await service.marquerPret(lot.id);
  await service.comptabiliserLot(lot.id);
}

describe("périmètre de la déclaration", () => {
  it("ne retient que les codes portant sur un compte de TVA", () => {
    const codes = codesDeTva(BENIN.codesTaxe).map((code) => code.code);
    expect(codes).toContain("TVA-V18");
    expect(codes).toContain("TVA-A18");
    expect(codes).toContain("TVA-V0");
    // La retenue de TVA sur marchés publics partage le compte de la taxe collectée.
    expect(codes).toContain("TVA-MP");
    // Les acomptes et retenues d'impôt sur le résultat relèvent d'une autre déclaration.
    expect(codes).not.toContain("ACHT-1");
    expect(codes).not.toContain("NONIFU-5");
    expect(codes).not.toContain("SRV-3");
    expect(codes).not.toContain("RCM-DIV");
    // La taxe pour le sport est une charge, pas de la TVA.
    expect(codes).not.toContain("SPORT");
  });

  it("une période sans opération donne une déclaration vide, lisible et datée", async () => {
    const declaration = await service.declarationTva(4);

    expect(declaration.periode).toBe(4);
    expect(declaration.exercice).toBe(ANNEE);
    expect(declaration.dateDebut).toBe("2026-04-01");
    expect(declaration.dateFin).toBe("2026-04-30");
    expect(declaration.mouvementsDeLaPeriode).toBe(0);
    expect(declaration.lignes).toHaveLength(0);
    expect(declaration.netteAPayer).toBe(ZERO);
    expect(declaration.creditAReporter).toBe(ZERO);
    expect(declaration.comporteUnEcart).toBe(false);
    // L'échéance vient du paquet pays, pas d'une invention de l'écran.
    expect(declaration.echeance).toContain("20 du mois suivant");
    expect(declaration.aVerifier).toBe(true);
  });

  it("une période inconnue est refusée", async () => {
    await expect(service.declarationTva(99)).rejects.toThrow(ErreurRegle);
  });
});

describe("calcul de la taxe due", () => {
  it("une vente et un achat du même mois donnent la taxe nette à payer", async () => {
    await posterLot({
      journalCode: "VTE",
      date: "2026-04-05",
      piece: "FV-2026-001",
      libelle: "Vente de marchandises",
      lignes: [
        { compte: "701100", libelle: "Vente de marchandises", credit: "2000000", codesTaxe: ["TVA-V18"] }
      ],
      contrepartie: "411100",
      tiers: "CLI01"
    });
    await posterLot({
      journalCode: "ACH",
      date: "2026-04-12",
      piece: "FA-2026-018",
      libelle: "Achat de marchandises",
      lignes: [
        { compte: "601100", libelle: "Achat de marchandises", debit: "1000000", codesTaxe: ["TVA-A18", "ACHT-1"] }
      ],
      contrepartie: "401100",
      tiers: "FOU01"
    });

    const declaration = await service.declarationTva(4);

    const collectee = declaration.lignes.find((ligne) => ligne.code === "TVA-V18");
    expect(collectee?.base).toBe(2_000_000n);
    expect(collectee?.montant).toBe(360_000n);
    expect(collectee?.sens).toBe("collectee");
    expect(collectee?.compte).toBe("443100");
    expect(collectee?.referenceLegale).toContain("art. 232");

    const deductible = declaration.lignes.find((ligne) => ligne.code === "TVA-A18");
    expect(deductible?.base).toBe(1_000_000n);
    expect(deductible?.montant).toBe(180_000n);
    expect(deductible?.sens).toBe("deductible");

    expect(declaration.baseCollectee).toBe(2_000_000n);
    expect(declaration.baseDeductible).toBe(1_000_000n);
    expect(declaration.taxeCollectee).toBe(360_000n);
    expect(declaration.taxeDeductible).toBe(180_000n);
    expect(declaration.creditAnterieur).toBe(ZERO);
    expect(declaration.netteAPayer).toBe(180_000n);
    expect(declaration.creditAReporter).toBe(ZERO);
    expect(declaration.comporteUnEcart).toBe(false);
  });

  it("l'acompte de 1 % retenu au fournisseur reste hors de la déclaration de TVA", async () => {
    await posterLot({
      journalCode: "ACH",
      date: "2026-04-12",
      piece: "FA-2026-018",
      libelle: "Achat de marchandises",
      lignes: [
        { compte: "601100", libelle: "Achat de marchandises", debit: "1000000", codesTaxe: ["TVA-A18", "ACHT-1"] }
      ],
      contrepartie: "401100",
      tiers: "FOU01"
    });

    const declaration = await service.declarationTva(4);
    expect(declaration.lignes.map((ligne) => ligne.code)).not.toContain("ACHT-1");
    expect(declaration.controles.map((controle) => controle.compte)).not.toContain("442100");
    // La retenue existe bien en comptabilité : elle n'est simplement pas de la TVA.
    const grandLivre = await service.grandLivre("442100", { periode: 4 });
    expect(grandLivre.length).toBeGreaterThan(0);
  });

  it("une exportation apparaît en base exonérée et ne produit pas de taxe", async () => {
    await posterLot({
      journalCode: "VTE",
      date: "2026-04-08",
      piece: "FV-2026-002",
      libelle: "Exportation vers le Togo",
      lignes: [
        { compte: "701100", libelle: "Exportation de marchandises", credit: "5000000", codesTaxe: ["TVA-V0"] }
      ],
      contrepartie: "411100",
      tiers: "CLI01"
    });

    const declaration = await service.declarationTva(4);
    const exoneree = declaration.lignes.find((ligne) => ligne.code === "TVA-V0");
    expect(exoneree?.sens).toBe("exoneree");
    expect(exoneree?.base).toBe(5_000_000n);
    expect(exoneree?.montant).toBe(ZERO);
    expect(declaration.baseExoneree).toBe(5_000_000n);
    expect(declaration.taxeCollectee).toBe(ZERO);
    expect(declaration.netteAPayer).toBe(ZERO);
    // Un taux nul ne produit pas de ligne au grand livre : rien à rapprocher.
    expect(declaration.comporteUnEcart).toBe(false);
  });

  it("une retenue de TVA sur marché public annule la taxe à payer", async () => {
    await posterLot({
      journalCode: "VTE",
      date: "2026-04-20",
      piece: "MP-2026-004",
      libelle: "Marché public — fournitures à la DGI",
      lignes: [
        {
          compte: "701100",
          libelle: "Marché public de fournitures",
          credit: "60000000",
          codesTaxe: ["TVA-V18", "TVA-MP"]
        }
      ],
      contrepartie: "411100",
      tiers: "ETAT1"
    });

    const declaration = await service.declarationTva(4);
    expect(declaration.taxeCollectee).toBe(10_800_000n);
    expect(declaration.retenueDeTva).toBe(10_800_000n);
    // Le client public verse la retenue au Trésor : l'entreprise ne la paie pas une seconde fois.
    expect(declaration.netteAPayer).toBe(ZERO);
    expect(declaration.creditAReporter).toBe(ZERO);

    // Les deux lignes se compensent sur le même compte : le rapprochement reste à zéro.
    const controle = declaration.controles.find((item) => item.compte === "443100");
    expect(controle?.attendu).toBe(ZERO);
    expect(controle?.comptabilise).toBe(ZERO);
    expect(controle?.ecart).toBe(ZERO);
    expect(declaration.comporteUnEcart).toBe(false);
    expect(declaration.lignes.find((ligne) => ligne.code === "TVA-MP")?.aVerifier).toBe(true);
  });

  it("un crédit de TVA antérieur s'impute sur la taxe due, le reste est reporté", async () => {
    // Mars : des achats taxés seulement — la taxe déductible excède la taxe collectée.
    await posterLot({
      journalCode: "ACH",
      date: "2026-03-18",
      piece: "FA-2026-011",
      libelle: "Achat de marchandises",
      lignes: [
        { compte: "601100", libelle: "Achat de marchandises", debit: "3000000", codesTaxe: ["TVA-A18"] }
      ],
      contrepartie: "401100",
      tiers: "FOU01"
    });
    const mars = await service.declarationTva(3);
    expect(mars.taxeDeductible).toBe(540_000n);
    expect(mars.taxeCollectee).toBe(ZERO);
    expect(mars.netteAPayer).toBe(ZERO);
    expect(mars.creditAReporter).toBe(540_000n);

    // Avril : une vente taxée de 2 000 000, sur laquelle le crédit de mars s'impute.
    await posterLot({
      journalCode: "VTE",
      date: "2026-04-05",
      piece: "FV-2026-001",
      libelle: "Vente de marchandises",
      lignes: [
        { compte: "701100", libelle: "Vente de marchandises", credit: "2000000", codesTaxe: ["TVA-V18"] }
      ],
      contrepartie: "411100",
      tiers: "CLI01"
    });
    const avril = await service.declarationTva(4);
    expect(avril.taxeCollectee).toBe(360_000n);
    expect(avril.taxeDeductible).toBe(ZERO);
    expect(avril.creditAnterieur).toBe(540_000n);
    expect(avril.netteAPayer).toBe(ZERO);
    expect(avril.creditAReporter).toBe(180_000n);
  });
});

describe("rapprochement avec le grand livre", () => {
  it("un mouvement sur un compte de TVA que les codes n'expliquent pas est signalé", async () => {
    // Régularisation saisie à la main, sans code de taxe : 50 000 au débit de la TVA déductible.
    await posterLot({
      journalCode: "OD",
      date: "2026-04-22",
      piece: "OD-2026-003",
      libelle: "Régularisation de TVA déductible",
      lignes: [{ compte: "445200", libelle: "Régularisation de TVA déductible", debit: "50000" }],
      contrepartie: "521100"
    });

    const declaration = await service.declarationTva(4);
    const controle = declaration.controles.find((item) => item.compte === "445200");
    expect(controle).toBeDefined();
    expect(controle?.attendu).toBe(ZERO);
    expect(controle?.comptabilise).toBe(50_000n);
    expect(controle?.ecart).toBe(-50_000n);
    expect(declaration.comporteUnEcart).toBe(true);
    expect(controle?.libelle).toContain("TVA");
  });

  it("une période dont les codes expliquent tout ne présente aucun écart", async () => {
    await posterLot({
      journalCode: "VTE",
      date: "2026-04-05",
      piece: "FV-2026-001",
      libelle: "Vente de marchandises",
      lignes: [
        { compte: "701100", libelle: "Vente de marchandises", credit: "2000000", codesTaxe: ["TVA-V18"] }
      ],
      contrepartie: "411100",
      tiers: "CLI01"
    });

    const declaration = await service.declarationTva(4);
    expect(declaration.controles).toHaveLength(1);
    expect(declaration.controles[0]).toMatchObject({
      compte: "443100",
      attendu: 360_000n,
      comptabilise: 360_000n,
      ecart: ZERO
    });
    expect(declaration.comporteUnEcart).toBe(false);
  });

  it("la déclaration par défaut porte sur la période courante", async () => {
    const declaration = await service.declarationTva();
    expect(declaration.periode).toBe(4);
    expect(declaration.periodeLabel.toLowerCase()).toContain("avril");
  });
});
