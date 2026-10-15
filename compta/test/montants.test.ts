import { describe, expect, it } from "vitest";
import {
  ErreurRegle,
  SEPARATEUR_MILLIERS,
  XOF,
  analyserMontant,
  appliquerTaux,
  diviserArrondi,
  formatMontant,
  horsTaxeDepuisTTC,
  montantDepuisChaine,
  montantVersChaine,
  somme,
  taxeSurTTC
} from "../src/noyau/index";

describe("montants exacts", () => {
  it("lit une saisie française, avec ou sans séparateurs", () => {
    expect(analyserMontant("1234567")).toBe(1_234_567n);
    expect(analyserMontant("1 234 567")).toBe(1_234_567n);
    expect(analyserMontant(`2${SEPARATEUR_MILLIERS}832${SEPARATEUR_MILLIERS}000`)).toBe(2_832_000n);
    expect(analyserMontant("-100")).toBe(-100n);
    expect(analyserMontant("1 250 000 FCFA")).toBe(1_250_000n);
  });

  it("refuse ce qui n'est pas un montant, au lieu de l'arrondir en silence", () => {
    expect(() => analyserMontant("")).toThrow(ErreurRegle);
    expect(() => analyserMontant("12a34")).toThrow(/illisible/);
    // Le franc CFA n'a pas de décimale : une saisie à deux décimales est une erreur, pas un arrondi.
    expect(() => analyserMontant("1250000,50", XOF)).toThrow(/décimale/);
  });

  it("affiche sans décimale pour le XOF, groupé par trois", () => {
    expect(formatMontant(2_832_000n)).toBe(`2${SEPARATEUR_MILLIERS}832${SEPARATEUR_MILLIERS}000`);
    expect(formatMontant(-472_000n)).toBe(`-472${SEPARATEUR_MILLIERS}000`);
    expect(formatMontant(0n)).toBe("0");
    expect(formatMontant(1_234_567n, { ...XOF, decimales: 2 })).toBe(
      `12${SEPARATEUR_MILLIERS}345,67`
    );
  });

  it("arrondit au plus proche, y compris en négatif", () => {
    expect(diviserArrondi(5n, 2n)).toBe(3n);
    expect(diviserArrondi(4n, 2n)).toBe(2n);
    expect(diviserArrondi(-5n, 2n)).toBe(-3n);
    expect(diviserArrondi(1n, 3n)).toBe(0n);
    expect(diviserArrondi(2n, 3n)).toBe(1n);
    expect(() => diviserArrondi(1n, 0n)).toThrow(/zéro/i);
  });

  it("calcule les taxes en entiers, sans dérive flottante", () => {
    expect(appliquerTaux(1_000_000n, 1800)).toBe(180_000n);
    expect(appliquerTaux(1_000_000n, 100)).toBe(10_000n);
    expect(appliquerTaux(1_000_000n, 10)).toBe(1_000n);
    expect(taxeSurTTC(1_180_000n, 1800)).toBe(180_000n);
    expect(horsTaxeDepuisTTC(1_180_000n, 1800)).toBe(1_000_000n);
    // 0.1 + 0.2 en flottant donne 0.30000000000000004 ; ici la somme est exacte.
    expect(somme([analyserMontant("0,1".replace(",", "")), 2n])).toBe(3n);
  });

  it("sérialise les montants pour un stockage JSON", () => {
    const texte = montantVersChaine(1_234_567n);
    expect(texte).toBe("1234567");
    expect(montantDepuisChaine(texte)).toBe(1_234_567n);
    expect(() => montantDepuisChaine("12,34")).toThrow(/illisible/);
    expect(JSON.parse(JSON.stringify({ montant: texte })).montant).toBe("1234567");
  });
});
