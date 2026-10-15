import { describe, expect, it } from "vitest";
import {
  DomainRuleError,
  amountFromDecimal,
  amountToNumber,
  emptyOrganizationProfile,
  formatAmountGrouped,
  formatTimestampFr,
  normalizeOrganizationProfile,
  organizationFooterIdentity,
  organizationHeaderLines
} from "../src/index";

const SAISIE = {
  name: "  PERFECTO   Négoce Abidjan ",
  legalForm: "sarl",
  taxIdentifier: " ci-2024-b-1187 ",
  address: "Boulevard Latrille, Cocody",
  city: " Abidjan ",
  country: "Côte d'Ivoire",
  phone: "+225 27 22 44 55 66",
  email: " COMPTA@PERFECTO-NEGOCE.CI "
};

describe("fiche société imprimée", () => {
  it("normalise la saisie : espaces, casse de l'IFU, courriel", () => {
    const profile = normalizeOrganizationProfile(SAISIE);

    expect(profile.name).toBe("PERFECTO Négoce Abidjan");
    expect(profile.legalForm).toBe("sarl");
    // Identifiant administratif : la casse ne doit pas créer deux fiches différentes.
    expect(profile.taxIdentifier).toBe("CI-2024-B-1187");
    expect(profile.city).toBe("Abidjan");
    expect(profile.email).toBe("COMPTA@PERFECTO-NEGOCE.CI");
    expect(profile.country).toBe("Côte d'Ivoire");
  });

  it("exige une raison sociale et un courriel plausible", () => {
    expect(() => normalizeOrganizationProfile({ name: "   " })).toThrow(
      "La raison sociale est obligatoire."
    );
    expect(() => normalizeOrganizationProfile({})).toThrow("La raison sociale est obligatoire.");
    expect(() =>
      normalizeOrganizationProfile({ name: "Ivoire Négoce", email: "pas-un-courriel" })
    ).toThrow("Le courriel de la société n'a pas un format valide.");
    expect(() =>
      normalizeOrganizationProfile({ name: "Ivoire Négoce", email: "contact@ivoire-negoce.ci" })
    ).not.toThrow();
  });

  it("borne chaque champ à sa longueur de fiche", () => {
    expect(() => normalizeOrganizationProfile({ name: "X".repeat(121) })).toThrow(
      "La raison sociale ne peut pas dépasser 120 caractères."
    );
    expect(() =>
      normalizeOrganizationProfile({ name: "Valide", address: "r".repeat(161) })
    ).toThrow("L'adresse ne peut pas dépasser 160 caractères.");
    expect(() =>
      normalizeOrganizationProfile({ name: "Valide", taxIdentifier: "I".repeat(41) })
    ).toThrow("L'identifiant fiscal (IFU) ne peut pas dépasser 40 caractères.");
    // Une règle de domaine, pas une erreur technique.
    expect(() => normalizeOrganizationProfile({ name: "" })).toThrow(DomainRuleError);
  });

  it("conserve les champs existants lors d'une mise à jour partielle", () => {
    const existante = normalizeOrganizationProfile(SAISIE);
    const miseAJour = normalizeOrganizationProfile({ city: "Yamoussoukro" }, existante);

    expect(miseAJour.city).toBe("Yamoussoukro");
    expect(miseAJour.name).toBe("PERFECTO Négoce Abidjan");
    expect(miseAJour.taxIdentifier).toBe("CI-2024-B-1187");
    expect(miseAJour.email).toBe("COMPTA@PERFECTO-NEGOCE.CI");
  });

  it("amorce un profil vide sans champ inventé", () => {
    const vide = emptyOrganizationProfile();

    expect(vide.name).toBe("Société sans nom");
    expect(vide.legalForm).toBe("");
    expect(vide.country).toBe("");
    expect(emptyOrganizationProfile("Brouillon").name).toBe("Brouillon");
  });

  it("compose l'en-tête en omettant les champs absents", () => {
    const complet = normalizeOrganizationProfile(SAISIE);
    expect(organizationHeaderLines(complet)).toEqual([
      "PERFECTO Négoce Abidjan (sarl)",
      "IFU : CI-2024-B-1187",
      "Boulevard Latrille, Cocody",
      "Abidjan, Côte d'Ivoire",
      "Tél. +225 27 22 44 55 66",
      "COMPTA@PERFECTO-NEGOCE.CI"
    ]);

    const minimal = normalizeOrganizationProfile({ name: "Ivoire Négoce", city: "Abidjan" });
    // Ni forme juridique, ni IFU, ni adresse, ni coordonnées : aucune ligne vide.
    expect(organizationHeaderLines(minimal)).toEqual(["Ivoire Négoce", "Abidjan"]);
    expect(organizationFooterIdentity(minimal)).toBe("Ivoire Négoce · Abidjan");
    expect(organizationFooterIdentity(complet)).toBe(
      "PERFECTO Négoce Abidjan · IFU CI-2024-B-1187 · Abidjan, Côte d'Ivoire"
    );
  });
});

describe("formatage pour les documents exportés", () => {
  it("groupe les montants à la française, sans espace insécable", () => {
    expect(formatAmountGrouped(amountFromDecimal("2832000"))).toBe("2 832 000");
    expect(formatAmountGrouped(amountFromDecimal("-472000"))).toBe("-472 000");
    expect(formatAmountGrouped(amountFromDecimal("0"))).toBe("0");
    expect(formatAmountGrouped(amountFromDecimal("1180000"))).toBe("1 180 000");

    // Les polices PDF standard (WinAnsi) ne contiennent ni U+202F ni U+00A0.
    for (const value of ["0", "999", "1000", "1234567", "-2832000"]) {
      expect(formatAmountGrouped(amountFromDecimal(value))).not.toMatch(/[\u202F\u00A0\u2009]/);
    }
  });

  it("donne aux tableurs une valeur numérique exacte", () => {
    expect(amountToNumber(amountFromDecimal("472000"))).toBe(472000);
    expect(amountToNumber(amountFromDecimal("-2832000"))).toBe(-2832000);
    expect(amountToNumber(amountFromDecimal("12.35"))).toBe(12.35);
    expect(amountToNumber(0n)).toBe(0);
  });

  it("horodate en français, à l'heure du poste", () => {
    const iso = new Date(2026, 0, 12, 9, 15, 0).toISOString();
    expect(formatTimestampFr(iso)).toBe("12/01/2026 09:15");
    expect(formatTimestampFr(new Date(2026, 11, 31, 23, 5).toISOString())).toBe("31/12/2026 23:05");
    // Une valeur illisible est rendue telle quelle plutôt que « NaN/NaN/NaN ».
    expect(formatTimestampFr("pas-une-date")).toBe("pas-une-date");
    expect(formatTimestampFr("2026-03-01T08:00:00.000Z")).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
});
