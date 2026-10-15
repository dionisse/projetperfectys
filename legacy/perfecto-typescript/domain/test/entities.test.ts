import { describe, expect, it } from "vitest";
import {
  DomainRuleError,
  FiscalYear,
  FiscalYearStatus,
  Organization,
  civilDate,
  formatCivilDateFr,
  frenchMonthLabel,
  parseCivilDate
} from "../src/index";

const NOW = new Date("2026-01-05T09:00:00.000Z");

describe("Organization (portage de OrganizationTests.cs)", () => {
  it("normalise le code et la devise", () => {
    const organization = Organization.create(" demo ", "Société Test", "xof", NOW);
    expect(organization.code).toBe("DEMO");
    expect(organization.baseCurrency).toBe("XOF");
    expect(organization.isActive).toBe(true);
  });

  it.each(["", "A", "CODE-BEAUCOUP-TROP-LONG"])("rejette le code invalide « %s »", (code) => {
    expect(() => Organization.create(code, "Société Test", "XOF", NOW)).toThrow(DomainRuleError);
  });

  it("exige une devise ISO à trois caractères", () => {
    expect(() => Organization.create("DEMO", "Société Test", "EURO!", NOW)).toThrow(
      "La devise doit être un code ISO de trois caractères."
    );
  });
});

describe("FiscalYear (portage de FiscalYearTests.cs)", () => {
  it("suit le cycle préparation → ouvert → clôturé", () => {
    const year = FiscalYear.create("org-1", "Exercice 2026", civilDate(2026, 1, 1), civilDate(2026, 12, 31), "SYSCOHADA-R", NOW);
    expect(year.status).toBe(FiscalYearStatus.Draft);
    year.open(NOW);
    expect(year.status).toBe(FiscalYearStatus.Open);
    year.close(NOW);
    expect(year.status).toBe(FiscalYearStatus.Closed);
    expect(() => year.open(NOW)).toThrow("Seul un exercice en préparation peut être ouvert.");
  });

  it("rejette les dates inversées", () => {
    expect(() =>
      FiscalYear.create("org-1", "Exercice invalide", civilDate(2026, 12, 31), civilDate(2026, 1, 1), "SYSCOHADA-R", NOW)
    ).toThrow(DomainRuleError);
  });
});

describe("dates civiles", () => {
  it("valide et formate au format français", () => {
    expect(parseCivilDate("2026-02-15")).toBe("2026-02-15");
    expect(formatCivilDateFr("2026-02-15")).toBe("15/02/2026");
    expect(frenchMonthLabel(2026, 2)).toBe("février 2026");
    expect(() => parseCivilDate("2026-02-30")).toThrow(DomainRuleError);
    expect(() => parseCivilDate("15/02/2026")).toThrow(DomainRuleError);
  });
});
