import { describe, expect, it } from "vitest";
import {
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  amountFromDecimal,
  civilDate,
  createThirdParty,
  normalizeThirdPartyCode,
  suggestThirdPartyCode,
  thirdPartyIdentityKey,
  thirdPartyTypeLabel,
  updateThirdParty
} from "../src/index";

const ORG = "org-1";
const NOW = new Date("2026-03-01T10:00:00.000Z");

function supplier(overrides: Partial<Parameters<typeof createThirdParty>[0]> = {}) {
  return createThirdParty({ organizationId: ORG, name: "Grossiste Abidjan Nord", type: "supplier", now: NOW, ...overrides });
}

describe("fichier unique des tiers", () => {
  it("crée une fiche normalisée avec code proposé et horodatages ISO", () => {
    const tier = supplier({ code: " fou-001 " });
    expect(tier.code).toBe("FOU-001");
    expect(tier.name).toBe("Grossiste Abidjan Nord");
    expect(tier.type).toBe("supplier");
    expect(thirdPartyTypeLabel[tier.type]).toBe("Fournisseur");
    expect(tier.isActive).toBe(true);
    expect(tier.createdAt).toBe(NOW.toISOString());
    expect(tier.updatedAt).toBe(NOW.toISOString());
  });

  it("propose le code suivant du type en évitant les collisions", () => {
    expect(suggestThirdPartyCode("supplier", [])).toBe("FOU001");
    expect(suggestThirdPartyCode("supplier", ["FOU001", "FOU002"])).toBe("FOU003");
    expect(suggestThirdPartyCode("customer", ["CLI001"])).toBe("CLI002");
    expect(suggestThirdPartyCode("state", [])).toBe("ETA001");
  });

  it.each(["", "A", "CODE-TIERS-TROP-LONG", "FOU 001", "FOU*"])(
    "refuse le code tiers invalide « %s »",
    (code) => {
      expect(() => normalizeThirdPartyCode(code)).toThrow(DomainRuleError);
    }
  );

  it("refuse un nom trop court, un type inconnu ou un courriel malformé", () => {
    expect(() => supplier({ name: "X" })).toThrow("Le nom du tiers est obligatoire.");
    expect(() => supplier({ type: "partenaire" })).toThrow(/Type de tiers inconnu/);
    expect(() => supplier({ email: "contact-at-ivoire.ci" })).toThrow(
      "Adresse électronique invalide : « contact-at-ivoire.ci »."
    );
  });

  it("reconnaît deux écritures du même tiers (fiche unique)", () => {
    expect(thirdPartyIdentityKey("  grossiste  abidjan-nord ", "supplier")).toBe(
      thirdPartyIdentityKey("GROSSISTE ABIDJAN NORD", "supplier")
    );
    expect(thirdPartyIdentityKey("Éts Konaté", "customer")).toBe(thirdPartyIdentityKey("ETS KONATE", "customer"));
    expect(thirdPartyIdentityKey("Ets Konaté", "customer")).not.toBe(
      thirdPartyIdentityKey("Ets Konaté", "supplier")
    );
  });

  it("met à jour la fiche sans changer son identifiant ni sa date de création", () => {
    const tier = supplier({ code: "FOU001" });
    const later = new Date("2026-04-02T08:30:00.000Z");
    const revised = updateThirdParty(tier, {
      organizationId: ORG,
      name: "Grossiste Abidjan Nord SARL",
      type: "supplier",
      phone: "+225 07 00 00 00",
      isActive: false,
      now: later
    });
    expect(revised.id).toBe(tier.id);
    expect(revised.code).toBe("FOU001");
    expect(revised.createdAt).toBe(tier.createdAt);
    expect(revised.updatedAt).toBe(later.toISOString());
    expect(revised.name).toBe("Grossiste Abidjan Nord SARL");
    expect(revised.isActive).toBe(false);
  });
});

describe("révision d'un brouillon (agrégat pièce)", () => {
  function draft() {
    const entry = AccountingEntry.create({
      fiscalYearId: "fy-1",
      organizationId: ORG,
      journalCode: "ACH",
      entryDate: civilDate(2026, 3, 1),
      reference: "FA-2026-010",
      number: "ACH-2026-0010",
      now: NOW
    });
    entry.addLine("601100", "Achats", amountFromDecimal("100000"), 0n);
    entry.addLine("401100", "Fournisseur", 0n, amountFromDecimal("100000"), "FOU001");
    return entry;
  }

  it("porte son numéro automatique", () => {
    expect(draft().number).toBe("ACH-2026-0010");
    expect(() =>
      AccountingEntry.create({
        fiscalYearId: "fy-1",
        organizationId: ORG,
        journalCode: "ACH",
        entryDate: civilDate(2026, 3, 1),
        reference: "FA-X",
        number: "  ",
        now: NOW
      })
    ).toThrow("Le numéro de pièce est obligatoire.");
  });

  it("révise en-tête et lignes d'un brouillon et horodate la révision", () => {
    const entry = draft();
    const later = new Date("2026-03-02T09:00:00.000Z");

    entry.revise(
      {
        entryDate: civilDate(2026, 3, 2),
        reference: "FA-2026-011",
        lines: [
          { accountCode: "601100", label: "Achats corrigés", debit: amountFromDecimal("150000"), credit: 0n },
          { accountCode: "401100", label: "Fournisseur", debit: 0n, credit: amountFromDecimal("150000"), thirdPartyCode: "FOU002" }
        ]
      },
      later
    );

    expect(entry.entryDate).toBe("2026-03-02");
    expect(entry.reference).toBe("FA-2026-011");
    expect(entry.number).toBe("ACH-2026-0010");
    expect(entry.totalDebit).toBe(amountFromDecimal("150000"));
    expect(entry.lines[1]?.thirdPartyCode).toBe("FOU002");
    expect(entry.updatedAt.toISOString()).toBe(later.toISOString());
    expect(entry.status).toBe(AccountingEntryStatus.Draft);
  });

  it("refuse une révision sans ligne et une révision de pièce validée", () => {
    const entry = draft();
    expect(() => entry.revise({ lines: [] }, NOW)).toThrow("Une pièce doit contenir au moins une ligne.");

    entry.post(NOW);
    expect(() => entry.revise({ reference: "FA-PIRATE" }, NOW)).toThrow(
      "Une pièce validée est immuable. Utilisez une extourne pour la corriger."
    );
  });
});
