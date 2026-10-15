import { describe, expect, it } from "vitest";
import {
  BENIN,
  ErreurRegle,
  REGLE_IFU_BENIN,
  calculerImpotAnnuel,
  calculerTaxe,
  codesTaxeApplicables,
  ligneTaxeAttendue,
  parametresAVerifier,
  validerIfu,
  verifierLignesTaxees,
  type CodeTaxe,
  type LigneEcriture
} from "../src/noyau/index";

function code(taxe: string): CodeTaxe {
  const trouve = BENIN.codesTaxe.find((item) => item.code === taxe);
  if (!trouve) throw new Error(`code de taxe absent du paquet Bénin : ${taxe}`);
  return trouve;
}

function ligne(
  compte: string,
  debit: bigint,
  credit: bigint,
  codesTaxe: string[] = []
): LigneEcriture {
  return {
    id: `L-${compte}`,
    compte,
    libelle: "Ligne de test",
    debit,
    credit,
    codesTaxe,
    tiersCode: null,
    echeance: null
  };
}

describe("paquet pays Bénin", () => {
  it("porte la devise, le référentiel et les paramètres du pilote", () => {
    expect(BENIN.code).toBe("BJ");
    expect(BENIN.devise.code).toBe("XOF");
    expect(BENIN.devise.decimales).toBe(0);
    expect(BENIN.referentiel.code).toBe("SYSCOHADA-R");
    expect(BENIN.formesJuridiques.map((forme) => forme.code)).toContain("SARL");
    expect(BENIN.calendrierDeclaratif.some((item) => item.code === "TVA-MENSUELLE")).toBe(true);
    expect(BENIN.calendrierDeclaratif.find((item) => item.code === "TVA-MENSUELLE")?.echeance).toContain("20");
  });

  it("n'affiche aucun paramètre incertain comme s'il était certain", () => {
    const aVerifier = parametresAVerifier(BENIN);
    expect(BENIN.comporteDesParametresAVerifier).toBe(true);
    expect(aVerifier.length).toBeGreaterThan(5);
    expect(aVerifier.join(" ")).toContain("IFU");
    // La TVA 18 % est établie : elle ne doit pas être signalée comme à vérifier.
    expect(code("TVA-V18").aVerifier).toBe(false);
    expect(code("TVA-A18").aVerifier).toBe(false);
  });

  it("contrôle l'IFU, préalable à toute déclaration au Bénin", () => {
    expect(validerIfu("0020151234567")).toBe("0020151234567");
    expect(validerIfu(" 0020151234567 ")).toBe("0020151234567");
    expect(REGLE_IFU_BENIN.aVerifier).toBe(true);
    expect(() => validerIfu("")).toThrow(/obligatoire/);
    expect(() => validerIfu("12345")).toThrow(/IFU invalide/);
    expect(() => validerIfu("ABC2015123456")).toThrow(/IFU invalide/);
  });

  it("calcule la TVA à 18 % et les acomptes béninois", () => {
    const tva = calculerTaxe(1_000_000n, code("TVA-A18"));
    expect(tva.base).toBe(1_000_000n);
    expect(tva.taxe).toBe(180_000n);
    expect(tva.total).toBe(1_180_000n);

    expect(calculerTaxe(1_000_000n, code("TVA-V0")).taxe).toBe(0n);
    expect(calculerTaxe(1_000_000n, code("ACHT-1")).taxe).toBe(10_000n);
    expect(calculerTaxe(1_000_000n, code("SRV-3")).taxe).toBe(30_000n);
    expect(calculerTaxe(1_000_000n, code("NONIFU-5")).taxe).toBe(50_000n);
    expect(calculerTaxe(25_000_000n, code("SPORT")).taxe).toBe(25_000n);
    expect(calculerTaxe(10_000_000n, code("PC-UEMOA")).taxe).toBe(50_000n);
    expect(calculerTaxe(10_000_000n, code("PCS-UEMOA")).taxe).toBe(80_000n);
    expect(calculerTaxe(0n, code("TVA-A18")).taxe).toBe(0n);
  });

  it("propose les bons codes selon l'opération et le statut du tiers", () => {
    const achatImmatricule = codesTaxeApplicables(BENIN.codesTaxe, {
      operation: "achat",
      tiersImmatricule: true,
      tiersPublic: false,
      exportation: false
    }).map((item) => item.code);
    expect(achatImmatricule).toContain("TVA-A18");
    expect(achatImmatricule).toContain("ACHT-1");
    expect(achatImmatricule).toContain("SRV-3");
    // Un tiers immatriculé ne subit pas la retenue majorée.
    expect(achatImmatricule).not.toContain("NONIFU-5");

    const achatInformel = codesTaxeApplicables(BENIN.codesTaxe, {
      operation: "achat",
      tiersImmatricule: false,
      tiersPublic: false,
      exportation: false
    }).map((item) => item.code);
    expect(achatInformel).toContain("NONIFU-5");
    expect(achatInformel).not.toContain("ACHT-1");

    const venteExport = codesTaxeApplicables(BENIN.codesTaxe, {
      operation: "vente",
      tiersImmatricule: true,
      tiersPublic: false,
      exportation: true
    }).map((item) => item.code);
    expect(venteExport).toContain("TVA-V0");
    expect(venteExport).not.toContain("TVA-V18");

    const ventePublique = codesTaxeApplicables(BENIN.codesTaxe, {
      operation: "vente",
      tiersImmatricule: true,
      tiersPublic: true,
      exportation: false
    }).map((item) => item.code);
    expect(ventePublique).toContain("MP-1");
    expect(ventePublique).toContain("TVA-MP");
  });

  it("place la retenue à la source dans le sens inverse de la charge", () => {
    const achat = { debit: 1_000_000n, credit: 0n };
    expect(ligneTaxeAttendue(achat, code("TVA-A18"))).toEqual({
      compteTaxe: "445200",
      sens: "debit",
      montant: 180_000n,
      codeTaxe: "TVA-A18"
    });
    expect(ligneTaxeAttendue(achat, code("ACHT-1"))).toEqual({
      compteTaxe: "442100",
      sens: "credit",
      montant: 10_000n,
      codeTaxe: "ACHT-1"
    });
    const vente = { debit: 0n, credit: 2_000_000n };
    expect(ligneTaxeAttendue(vente, code("TVA-V18"))).toEqual({
      compteTaxe: "443100",
      sens: "credit",
      montant: 360_000n,
      codeTaxe: "TVA-V18"
    });
  });

  it("exige la ligne de taxe d'une écriture taxée, sans jamais l'inventer", () => {
    const correctes = [
      ligne("601100", 1_000_000n, 0n, ["TVA-A18", "ACHT-1"]),
      ligne("445200", 180_000n, 0n),
      ligne("442100", 0n, 10_000n),
      ligne("401100-FOU01", 0n, 1_170_000n)
    ];
    expect(() => verifierLignesTaxees(correctes, BENIN.codesTaxe)).not.toThrow();

    const sansTva = [
      ligne("601100", 1_000_000n, 0n, ["TVA-A18"]),
      ligne("401100-FOU01", 0n, 1_000_000n)
    ];
    expect(() => verifierLignesTaxees(sansTva, BENIN.codesTaxe)).toThrow(ErreurRegle);
    expect(() => verifierLignesTaxees(sansTva, BENIN.codesTaxe)).toThrow(/445200/);

    const sansRetenue = [
      ligne("601100", 1_000_000n, 0n, ["ACHT-1"]),
      ligne("401100-FOU01", 0n, 1_000_000n)
    ];
    expect(() => verifierLignesTaxees(sansRetenue, BENIN.codesTaxe)).toThrow(/crédit de 10000/);

    const montantFaux = [
      ligne("601100", 1_000_000n, 0n, ["TVA-A18"]),
      ligne("445200", 179_000n, 0n),
      ligne("401100-FOU01", 0n, 1_179_000n)
    ];
    expect(() => verifierLignesTaxees(montantFaux, BENIN.codesTaxe)).toThrow(/180000/);

    const codeInconnu = [ligne("601100", 1_000_000n, 0n, ["TVA-99"])];
    expect(() => verifierLignesTaxees(codeInconnu, BENIN.codesTaxe)).toThrow(/n'existe pas dans le paquet pays/);

    // Une taxe de nature « charge » se constate par une écriture propre : pas de ligne exigée ici.
    const taxeSport = [ligne("701100", 0n, 25_000_000n, ["SPORT"])];
    expect(() => verifierLignesTaxees(taxeSport, BENIN.codesTaxe)).not.toThrow();
  });

  it("calcule les impôts annuels avec leurs variantes et leurs planchers", () => {
    const is = BENIN.impotsAnnuel.find((item) => item.code === "IS");
    expect(is).toBeDefined();
    expect(calculerImpotAnnuel(is!, 100_000_000n).montant).toBe(30_000_000n);
    expect(
      calculerImpotAnnuel(is!, 100_000_000n, "activité industrielle hors extractive").montant
    ).toBe(25_000_000n);
    expect(() => calculerImpotAnnuel(is!, 100_000_000n, "régime inexistant")).toThrow(/pas de taux/);

    const minimum = BENIN.impotsAnnuel.find((item) => item.code === "MIN-PERCEPTION");
    const petit = calculerImpotAnnuel(minimum!, 10_000_000n);
    // 1 % de 10 000 000 = 100 000, mais le plancher légal est de 250 000 FCFA.
    expect(petit.montant).toBe(250_000n);
    expect(petit.detail).toContain("Minimum de perception appliqué");
    expect(calculerImpotAnnuel(minimum!, 100_000_000n).montant).toBe(1_000_000n);
    expect(calculerImpotAnnuel(minimum!, 100_000_000n, "bâtiment et travaux publics").montant).toBe(
      3_000_000n
    );

    const tps = BENIN.impotsAnnuel.find((item) => item.code === "TPS");
    expect(() => calculerImpotAnnuel(tps!, 30_000_000n)).toThrow(/pas de taux/);
    expect(
      calculerImpotAnnuel(tps!, 30_000_000n, "régime du forfait, CA de 20 à 50 M FCFA").montant
    ).toBe(600_000n);
  });
});
