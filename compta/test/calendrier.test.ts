import { describe, expect, it } from "vitest";
import {
  ajouterMois,
  cloturerPeriode,
  creerExercice,
  dateCivile,
  estBissextile,
  formaterDateFr,
  joursDuMois,
  ouvrirPeriode,
  periodeDeDate,
  periodeParNumero
} from "../src/noyau/index";

describe("calendrier fiscal", () => {
  it("construit un exercice civil de douze périodes plus ajustement et clôture", () => {
    const exercice = creerExercice(2026);

    expect(exercice.dateDebut).toBe("2026-01-01");
    expect(exercice.dateFin).toBe("2026-12-31");
    // Comme Sage : les deux périodes supplémentaires existent avant qu'on en ait besoin.
    expect(exercice.periodes).toHaveLength(14);
    expect(exercice.periodes[12]?.type).toBe("ajustement");
    expect(exercice.periodes[12]?.libelle).toBe("Ajustements de fin d'exercice");
    expect(exercice.periodes[13]?.type).toBe("cloture");
    expect(exercice.periodes.filter((periode) => periode.clots)).toHaveLength(0);
  });

  it("accepte un exercice décalé et refuse un nombre de périodes fantaisiste", () => {
    const exercice = creerExercice(2026, 4, 12);
    expect(exercice.dateDebut).toBe("2026-04-01");
    expect(exercice.dateFin).toBe("2027-03-31");
    expect(exercice.periodes[0]?.mois).toBe(4);

    expect(() => creerExercice(2026, 1, 11)).toThrow(/12 ou 13 périodes/);
    expect(() => creerExercice(2026, 1, 13)).not.toThrow();
  });

  it("retrouve la période d'une date et refuse une date hors exercice", () => {
    const exercice = creerExercice(2026);
    expect(periodeDeDate(exercice, "2026-03-15").numero).toBe(3);
    expect(periodeDeDate(exercice, "2026-03-15").libelle).toBe("Mars");
    expect(periodeParNumero(exercice, 12).dateFin).toBe("2026-12-31");
    expect(() => periodeDeDate(exercice, "2027-01-01")).toThrow(/hors de l'exercice 2026/);
    expect(() => periodeParNumero(exercice, 99)).toThrow(/n'existe pas/);
  });

  it("verrouille et déverrouille une période explicitement", () => {
    let exercice = creerExercice(2026);
    exercice = cloturerPeriode(exercice, 1);
    expect(exercice.periodes[0]?.clots).toBe(true);
    expect(exercice.periodes[1]?.clots).toBe(false);

    exercice = ouvrirPeriode(exercice, 1);
    expect(exercice.periodes[0]?.clots).toBe(false);
    expect(() => cloturerPeriode(exercice, 42)).toThrow(/n'existe pas/);
  });

  it("manie les dates civiles sans fuseau horaire", () => {
    expect(dateCivile(2026, 1, 1)).toBe("2026-01-01");
    expect(formaterDateFr("2026-01-01")).toBe("01/01/2026");
    expect(() => dateCivile(2026, 2, 30)).toThrow(/invalide/);
    expect(() => dateCivile(2026, 13, 1)).toThrow(/invalide/);
    expect(joursDuMois(2024, 2)).toBe(29);
    expect(joursDuMois(2026, 2)).toBe(28);
    expect(estBissextile(2000)).toBe(true);
    expect(estBissextile(1900)).toBe(false);
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2026-12-15", 1)).toBe("2027-01-15");
  });
});
