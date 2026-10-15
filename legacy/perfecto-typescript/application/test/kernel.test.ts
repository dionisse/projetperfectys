import { beforeEach, describe, expect, it } from "vitest";
import type { CreateAccountingEntryRequest } from "@perfecto/contracts";
import { AccountingEntryStatus, DomainRuleError, amountFromDecimal, civilDate } from "@perfecto/domain";
import { AccountingKernel, InMemoryStorage, createDemoState } from "../src/index";

const ORG = "org-demo";
const FISCAL_YEAR = "fy-2026";
const NOW = new Date("2026-03-01T08:00:00.000Z");

function balancedRequest(reference: string): CreateAccountingEntryRequest {
  return {
    organizationId: ORG,
    journalCode: "OD",
    entryDate: civilDate(2026, 3, 1),
    reference,
    description: "Test de saisie",
    postImmediately: false,
    lines: [
      { accountCode: "601100", label: "Charge", debit: "100000", credit: 0 },
      // 401100 est un compte auxiliaire : le tiers est obligatoire (tranche 2).
      { accountCode: "401100", label: "Fournisseur", debit: 0, credit: "100000", thirdPartyCode: "FOU001" }
    ]
  };
}

describe("AccountingKernel (portage de AccountingServiceTests.cs)", () => {
  let kernel: AccountingKernel;

  beforeEach(() => {
    kernel = new AccountingKernel(new InMemoryStorage(createDemoState(ORG, FISCAL_YEAR)), {
      clock: () => NOW,
      actor: "test",
      storageMode: "Mémoire · test"
    });
  });

  it("fournit un instantané équilibré avec les catalogues attendus", async () => {
    const snapshot = await kernel.getSnapshot();
    expect(snapshot.accountCount).toBe(18);
    expect(snapshot.journalCount).toBe(6);
    expect(snapshot.postedEntryCount).toBe(3);
    expect(snapshot.draftEntryCount).toBe(1);
    expect(snapshot.totalDebitMovements).toBe(snapshot.totalCreditMovements);
    expect(amountFromDecimal(snapshot.totalDebitMovements)).toBe(amountFromDecimal("2832000"));
    expect(snapshot.trialBalance.length).toBeGreaterThan(0);
  });

  it("valide une pièce équilibrée et met à jour la balance", async () => {
    const before = await kernel.getSnapshot();
    const request = balancedRequest("OD-TEST-001");
    request.postImmediately = true;

    const saved = await kernel.saveEntry(request);
    const after = await kernel.getSnapshot();

    expect(saved.status).toBe(AccountingEntryStatus.Posted);
    expect(amountFromDecimal(saved.totalDebit)).toBe(amountFromDecimal("100000"));
    expect(after.postedEntryCount).toBe(before.postedEntryCount + 1);
    expect(amountFromDecimal(after.totalDebitMovements)).toBe(
      amountFromDecimal(before.totalDebitMovements) + amountFromDecimal("100000")
    );
    expect(after.totalDebitMovements).toBe(after.totalCreditMovements);
  });

  it("accepte un brouillon déséquilibré mais refuse sa validation", async () => {
    const request = balancedRequest("OD-TEST-002");
    request.lines[1]!.credit = "90000";
    const draft = await kernel.saveEntry(request);
    expect(draft.status).toBe(AccountingEntryStatus.Draft);

    const posting = balancedRequest("OD-TEST-003");
    posting.postImmediately = true;
    posting.lines[1]!.credit = "90000";
    await expect(kernel.saveEntry(posting)).rejects.toThrow(DomainRuleError);
  });

  it("refuse une référence de pièce dupliquée", async () => {
    await kernel.saveEntry(balancedRequest("OD-UNIQUE"));
    await expect(kernel.saveEntry(balancedRequest("OD-UNIQUE"))).rejects.toThrow(
      "Cette référence de pièce existe déjà."
    );
  });

  it("ajoute un compte recherchable et refuse le doublon", async () => {
    const account = await kernel.createAccount({
      organizationId: ORG,
      code: "601200",
      label: "Achats de matières premières",
      accountType: "Charge"
    });
    const results = await kernel.getAccounts("matières");
    expect(account.accountClass).toBe("6");
    expect(results).toHaveLength(1);
    await expect(
      kernel.createAccount({ organizationId: ORG, code: "601200", label: "Achats de matières premières" })
    ).rejects.toThrow("Ce numéro de compte existe déjà.");
  });

  it("n'alimente les états qu'avec les pièces validées et tient les soldes courants", async () => {
    const journal = await kernel.getJournalLines();
    const ledger = await kernel.getGeneralLedger();

    expect(journal).toHaveLength(8);
    expect(journal.some((line) => line.reference === "OD-2026-001")).toBe(false);
    const client = ledger.find((account) => account.accountCode === "411100");
    expect(client?.totalDebit).toBe("1180000");
    expect(client?.totalCredit).toBe("1180000");
    expect(client?.closingBalance).toBe("0");
  });

  it("transforme un brouillon équilibré en pièce validée immuable", async () => {
    const entries = await kernel.getEntries();
    const draft = entries.find((entry) => entry.reference === "OD-2026-001");
    expect(draft).toBeDefined();

    const posted = await kernel.postEntry(draft!.id);
    expect(posted.status).toBe(AccountingEntryStatus.Posted);
    expect(posted.postedAt).not.toBeNull();
    expect((await kernel.getSnapshot()).postedEntryCount).toBe(4);

    // Second appel idempotent, puis immutabilité garantie par le domaine.
    await expect(kernel.postEntry(draft!.id)).resolves.toMatchObject({ status: AccountingEntryStatus.Posted });
  });

  it("refuse la saisie sur une période clôturée jusqu'à sa réouverture", async () => {
    await kernel.setPeriodClosed(3, true);
    await expect(kernel.saveEntry(balancedRequest("OD-CLOSED-001"))).rejects.toThrow(
      "La période mars 2026 est clôturée."
    );

    await kernel.setPeriodClosed(3, false);
    const saved = await kernel.saveEntry(balancedRequest("OD-CLOSED-001"));
    expect(saved.status).toBe(AccountingEntryStatus.Draft);
  });

  /* ------------------- Garanties ajoutées (meilleure version) ------------------- */

  it("fait respecter l'équilibre par le domaine lors de la validation d'un brouillon", async () => {
    const request = balancedRequest("OD-UNBALANCED");
    request.lines[1]!.credit = "50000";
    const draft = await kernel.saveEntry(request);
    await expect(kernel.postEntry(draft.id)).rejects.toThrow(
      "La pièce doit contenir au moins deux lignes et être équilibrée avant validation."
    );
  });

  it("cloisonne les opérations par organisation", async () => {
    const foreign = balancedRequest("OD-OTHER-ORG");
    foreign.organizationId = "org-etrangere";
    await expect(kernel.saveEntry(foreign)).rejects.toThrow(
      "Cette opération ne concerne pas l'organisation de l'espace courant."
    );
  });

  it("trace chaque mutation dans le journal d'audit", async () => {
    const request = balancedRequest("OD-AUDIT");
    const saved = await kernel.saveEntry(request);
    await kernel.postEntry(saved.id);
    await kernel.setPeriodClosed(4, true);

    const audit = await kernel.getAudit();
    const actions = audit.map((event) => event.action);
    expect(actions).toContain("accounting.entry.saved");
    expect(actions).toContain("accounting.entry.posted");
    expect(actions).toContain("accounting.period.closed");
    expect(audit.every((event) => event.actor === "test" && event.organizationId === ORG)).toBe(true);
  });

  it("refuse un compte inexistant et un journal inconnu", async () => {
    const badAccount = balancedRequest("OD-BAD-ACCOUNT");
    badAccount.lines[0]!.accountCode = "999999";
    await expect(kernel.saveEntry(badAccount)).rejects.toThrow("Le compte 999999 n'existe pas.");

    const badJournal = balancedRequest("OD-BAD-JOURNAL");
    badJournal.journalCode = "ZZZ";
    await expect(kernel.saveEntry(badJournal)).rejects.toThrow("Le journal sélectionné n'existe pas.");
  });
});

describe("contexte du dossier ouvert (getDossierContext)", () => {
  /** La coquille affiche ce contexte en permanence : il doit refléter l'état, une seule lecture. */
  function kernelWith(state: ReturnType<typeof createDemoState>, options = {}) {
    return new AccountingKernel(new InMemoryStorage(state), {
      clock: () => NOW,
      actor: "superviseur",
      storageMode: "IndexedDB · disponible hors ligne",
      ...options
    });
  }

  it("compose le code dossier à la manière de l'original : module, société, année", async () => {
    const context = await kernelWith(createDemoState(ORG, FISCAL_YEAR)).getDossierContext();

    expect(context.dossierCode).toBe("CR000-26");
    expect(context.moduleCode).toBe("CR");
    expect(context.moduleLabel).toBe("Comptabilité SYSCOHADA révisé");
    expect(context.referential).toBe("SYSCOHADA révisé (OHADA)");
    expect(context.societyCode).toBe("000");
    expect(context.societyName).toBe("PERFECTO Négoce Abidjan");
    expect(context.currency).toBe("XOF");
    expect(context.actor).toBe("superviseur");
    expect(context.storageMode).toBe("IndexedDB · disponible hors ligne");
  });

  it("borne la période sur l'exercice des périodes, au format affiché par l'original", async () => {
    const context = await kernelWith(createDemoState(ORG, FISCAL_YEAR)).getDossierContext();

    expect(context.fiscalYear).toBe(2026);
    expect(context.periodFrom).toBe("2026-01-01");
    expect(context.periodTo).toBe("2026-12-31");
    expect(context.periodLabel).toBe("01/01/2026 - 31/12/2026");
    expect(context.closedPeriodCount).toBe(0);
  });

  it("ne fabrique pas de code société fictif sur une base ancienne sans code", async () => {
    const state = createDemoState(ORG, FISCAL_YEAR);
    state.organization = { ...state.organization, code: "" };

    const context = await kernelWith(state).getDossierContext();

    expect(context.societyCode).toBe("");
    expect(context.dossierCode).toBe("CR-26");
  });

  it("compte le contenu réel du dossier et suit la dernière modification tracée", async () => {
    const kernel = kernelWith(createDemoState(ORG, FISCAL_YEAR));
    const state = createDemoState(ORG, FISCAL_YEAR);
    const before = await kernel.getDossierContext();

    expect(before.counts.accounts).toBe(state.accounts.length);
    expect(before.counts.journals).toBe(state.journals.length);
    expect(before.counts.thirdParties).toBe(state.thirdParties.length);
    expect(before.counts.entries).toBe(state.entries.length);
    // Une base de démonstration régénérée n'a rien écrit : aucune modification n'est inventée.
    expect(before.lastModifiedAt).toBeNull();
    expect(before.lastModifiedLabel).toBeNull();

    await kernel.saveEntry(balancedRequest("CTX-1"));
    const after = await kernel.getDossierContext();

    expect(after.counts.entries).toBe(before.counts.entries + 1);
    expect(after.counts.draftEntries).toBe(before.counts.draftEntries + 1);
    expect(after.counts.auditEvents).toBe(before.counts.auditEvents + 1);
    expect(after.lastModifiedAt).toBe(NOW.toISOString());
    expect(after.lastModifiedLabel).toBeTruthy();
  });
});
