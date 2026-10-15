import { describe, expect, it } from "vitest";
import {
  PLAN_DEMARRAGE_SYSCOHADA,
  STRUCTURE_SYSCOHADA,
  SYSCOHADA_REVISE,
  classeDuReferentiel,
  composerNumero,
  compteAuxiliaire,
  compteDepuisPlan,
  decouperNumero,
  dependDe,
  groupeDuReferentiel,
  racineDe
} from "../src/noyau/index";

describe("comptes segmentés et plan SYSCOHADA révisé", () => {
  it("découpe un numéro en compte principal, tiers et axe", () => {
    const complet = decouperNumero("411100-CLI01-ABJ1", STRUCTURE_SYSCOHADA);
    expect(complet).toEqual({ comptePrincipal: "411100", auxiliaire: "CLI01", axe: "ABJ1" });

    const simple = decouperNumero("601100", STRUCTURE_SYSCOHADA);
    expect(simple).toEqual({ comptePrincipal: "601100", auxiliaire: null, axe: null });

    expect(decouperNumero("411100-cli01", STRUCTURE_SYSCOHADA).auxiliaire).toBe("CLI01");
  });

  it("refuse un numéro qui ne respecte pas la structure", () => {
    expect(() => decouperNumero("", STRUCTURE_SYSCOHADA)).toThrow(/obligatoire/);
    expect(() => decouperNumero("-CLI01", STRUCTURE_SYSCOHADA)).toThrow(/Compte principal/);
    expect(() => decouperNumero("1234567", STRUCTURE_SYSCOHADA)).toThrow(/dépasse 6 caractères/);
    expect(() => decouperNumero("ABC123", STRUCTURE_SYSCOHADA)).toThrow(/numérique/);
    expect(() => decouperNumero("101000-CLI01-AXE1-TROP", STRUCTURE_SYSCOHADA)).toThrow(
      /plus de segments/
    );
    expect(() => decouperNumero("101000-CLI 01", STRUCTURE_SYSCOHADA)).toThrow(/interdit/);
  });

  it("compose et dérive les comptes auxiliaires", () => {
    expect(composerNumero("411100", STRUCTURE_SYSCOHADA, "CLI01")).toBe("411100-CLI01");
    expect(composerNumero("601100", STRUCTURE_SYSCOHADA)).toBe("601100");

    const clients = compteDepuisPlan(
      { numero: "411100", libelle: "Clients", groupe: "CREANCE", exigeTiers: true },
      STRUCTURE_SYSCOHADA
    );
    const auxiliaire = compteAuxiliaire(clients, "cli01", STRUCTURE_SYSCOHADA);
    expect(auxiliaire.numero).toBe("411100-CLI01");
    expect(auxiliaire.auxiliaire).toBe("CLI01");
    expect(auxiliaire.libelle).toContain("Clients");

    const capital = compteDepuisPlan(
      { numero: "101000", libelle: "Capital social", groupe: "CAP" },
      STRUCTURE_SYSCOHADA
    );
    expect(() => compteAuxiliaire(capital, "CLI01", STRUCTURE_SYSCOHADA)).toThrow(
      /n'est pas un compte auxiliaire/
    );
  });

  it("expose la hiérarchie du plan pour les totaux par rubrique", () => {
    expect(racineDe("411100")).toBe("41");
    expect(dependDe("411100", "41")).toBe(true);
    expect(dependDe("411100", "42")).toBe(false);
    expect(dependDe("443100", "44")).toBe(true);
  });

  it("publie un référentiel cohérent : classes, groupes et plan de démarrage", () => {
    expect(SYSCOHADA_REVISE.code).toBe("SYSCOHADA-R");
    expect(SYSCOHADA_REVISE.version).toContain("01/01/2018");
    expect(SYSCOHADA_REVISE.classes.map((classe) => classe.code)).toEqual([
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"
    ]);
    expect(classeDuReferentiel(SYSCOHADA_REVISE, "4").nature).toBe("tiers");
    expect(() => classeDuReferentiel(SYSCOHADA_REVISE, "Z")).toThrow(/Classe inconnue/);
    expect(groupeDuReferentiel(SYSCOHADA_REVISE, "TRES-ACT").etat).toBe("bilan");
    expect(() => groupeDuReferentiel(SYSCOHADA_REVISE, "INCONNU")).toThrow(/inconnu/);

    // Chaque compte du plan porte un groupe existant : sinon l'état financier perdrait la ligne.
    const groupes = new Set(SYSCOHADA_REVISE.groupes.map((groupe) => groupe.code));
    for (const compte of PLAN_DEMARRAGE_SYSCOHADA) {
      expect(groupes.has(compte.groupe), `groupe manquant pour ${compte.numero}`).toBe(true);
      expect(compte.numero).toMatch(/^\d{6}$/);
    }
    const numeros = PLAN_DEMARRAGE_SYSCOHADA.map((compte) => compte.numero);
    expect(new Set(numeros).size).toBe(numeros.length);

    // Les comptes dont le paquet pays Bénin a besoin existent dans le plan.
    for (const attendu of ["443100", "445200", "442100", "444100", "444900", "891000", "641000"]) {
      expect(numeros).toContain(attendu);
    }
    expect(PLAN_DEMARRAGE_SYSCOHADA.length).toBeGreaterThan(40);
  });
});
