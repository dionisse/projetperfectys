/**
 * Jeu de données de démonstration du Lot 1 (3 pièces validées, 1 brouillon),
 * identique aux seeds C# / perfecto-db.js mais produit ICI, une seule fois,
 * à partir du noyau : plus aucune divergence de catalogue entre hôtes.
 */

import { AccountingEntryStatus, amountFromDecimal, civilDate, type CivilDate } from "@perfecto/domain";
import type { AccountingState, StoredEntry } from "./state";
import { createEmptyState } from "./state";

interface DemoLineSpec {
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
}

function demoEntry(
  organizationId: string,
  fiscalYearId: string,
  journalCode: string,
  entryDate: CivilDate,
  reference: string,
  description: string,
  posted: boolean,
  lines: DemoLineSpec[]
): StoredEntry {
  const createdAt = "2026-01-03T09:00:00.000Z";
  return {
    id: crypto.randomUUID(),
    organizationId,
    fiscalYearId,
    journalCode,
    entryDate,
    reference,
    description,
    status: posted ? AccountingEntryStatus.Posted : AccountingEntryStatus.Draft,
    createdAt,
    postedAt: posted ? createdAt : null,
    lines: lines.map((line) => ({
      id: crypto.randomUUID(),
      accountCode: line.accountCode,
      accountLabel: line.accountCode,
      label: line.label,
      debit: amountFromDecimal(line.debit),
      credit: amountFromDecimal(line.credit)
    }))
  };
}

export function createDemoState(organizationId: string, fiscalYearId: string): AccountingState {
  const state = createEmptyState(organizationId, fiscalYearId, 2026);
  const labels = new Map(state.accounts.map((account) => [account.code, account.label] as const));
  const relabel = (entry: StoredEntry): StoredEntry => ({
    ...entry,
    lines: entry.lines.map((line) => ({ ...line, accountLabel: labels.get(line.accountCode) ?? line.accountLabel }))
  });

  state.entries = [
    relabel(
      demoEntry(organizationId, fiscalYearId, "VTE", civilDate(2026, 1, 8), "FV-2026-001", "Vente au comptant", true, [
        { accountCode: "411100", label: "Client comptant", debit: "1180000", credit: "0" },
        { accountCode: "701100", label: "Vente de marchandises", debit: "0", credit: "1000000" },
        { accountCode: "443100", label: "TVA facturée", debit: "0", credit: "180000" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "ACH", civilDate(2026, 1, 12), "FA-2026-004", "Approvisionnement", true, [
        { accountCode: "601100", label: "Achat de marchandises", debit: "400000", credit: "0" },
        { accountCode: "445200", label: "TVA récupérable", debit: "72000", credit: "0" },
        { accountCode: "401100", label: "Fournisseur", debit: "0", credit: "472000" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "BQ1", civilDate(2026, 1, 18), "BQ-2026-003", "Règlement client", true, [
        { accountCode: "521100", label: "Encaissement bancaire", debit: "1180000", credit: "0" },
        { accountCode: "411100", label: "Règlement client", debit: "0", credit: "1180000" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "OD", civilDate(2026, 2, 1), "OD-2026-001", "Brouillon d'ajustement", false, [
        { accountCode: "601100", label: "Charge à régulariser", debit: "25000", credit: "0" },
        { accountCode: "401100", label: "Fournisseur à confirmer", debit: "0", credit: "25000" }
      ])
    )
  ];
  return state;
}
