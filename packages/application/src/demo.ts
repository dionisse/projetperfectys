/**
 * Jeu de données de démonstration du Lot 1 (3 pièces validées, 1 brouillon),
 * identique aux seeds C# / perfecto-db.js mais produit ICI, une seule fois,
 * à partir du noyau : plus aucune divergence de catalogue entre hôtes.
 *
 * Tranche 2 : le jeu de démo illustre le fichier unique des tiers, la
 * numérotation automatique par journal et l'affectation des tiers aux lignes
 * des comptes auxiliaires (401100 fournisseurs, 411100 clients).
 */

import {
  AccountingEntryStatus,
  amountFromDecimal,
  civilDate,
  civilYear,
  createThirdParty,
  formatEntryNumber,
  type CivilDate,
  type EntryNumberSequence,
  type ThirdPartyData
} from "@perfecto/domain";
import type { AccountingState, StoredEntry } from "./state";
import { createEmptyState } from "./state";

interface DemoLineSpec {
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
  thirdPartyCode?: string | null;
}

function demoEntry(
  organizationId: string,
  fiscalYearId: string,
  journalCode: string,
  entryDate: CivilDate,
  sequence: number,
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
    number: formatEntryNumber(journalCode, civilYear(entryDate), sequence),
    journalCode,
    entryDate,
    reference,
    description,
    status: posted ? AccountingEntryStatus.Posted : AccountingEntryStatus.Draft,
    createdAt,
    updatedAt: null,
    postedAt: posted ? createdAt : null,
    lines: lines.map((line) => ({
      id: crypto.randomUUID(),
      accountCode: line.accountCode,
      accountLabel: line.accountCode,
      label: line.label,
      debit: amountFromDecimal(line.debit),
      credit: amountFromDecimal(line.credit),
      thirdPartyCode: line.thirdPartyCode ?? null
    }))
  };
}

function demoThirdParty(
  organizationId: string,
  code: string,
  name: string,
  type: ThirdPartyData["type"],
  taxIdentifier: string,
  address: string
): ThirdPartyData {
  return createThirdParty({
    id: crypto.randomUUID(),
    organizationId,
    code,
    name,
    type,
    taxIdentifier,
    address,
    phone: "+225 27 20 30 40 50",
    email: null,
    notes: null,
    createdAt: "2026-01-02T09:00:00.000Z",
    now: new Date("2026-01-02T09:00:00.000Z")
  });
}

export function createDemoThirdParties(organizationId: string): ThirdPartyData[] {
  return [
    demoThirdParty(organizationId, "CLI001", "Supermarché Cocody", "customer", "CI-2004-B-1187", "Boulevard Latrille, Cocody, Abidjan"),
    demoThirdParty(organizationId, "CLI002", "Boutique Adjamé Center", "customer", "CI-2011-A-9932", "Marché d'Adjamé, Abidjan"),
    demoThirdParty(organizationId, "FOU001", "Grossiste Abidjan Nord", "supplier", "CI-1998-A-3421", "Zone industrielle de Yopougon, Abidjan"),
    demoThirdParty(organizationId, "FOU002", "Transports Sahel SARL", "supplier", "CI-2009-C-0455", "Route du Nord, Korhogo"),
    demoThirdParty(organizationId, "ETA001", "Direction générale des impôts", "state", "CI-ETAT-DGI", "Plateau, Abidjan"),
    demoThirdParty(organizationId, "SAL001", "Personnel permanent", "employee", "", "Siège social")
  ];
}

export function createDemoState(organizationId: string, fiscalYearId: string): AccountingState {
  const state = createEmptyState(organizationId, fiscalYearId, 2026);
  const labels = new Map(state.accounts.map((account) => [account.code, account.label] as const));
  const relabel = (entry: StoredEntry): StoredEntry => ({
    ...entry,
    lines: entry.lines.map((line) => ({ ...line, accountLabel: labels.get(line.accountCode) ?? line.accountLabel }))
  });

  state.thirdParties = createDemoThirdParties(organizationId);

  state.entries = [
    relabel(
      demoEntry(organizationId, fiscalYearId, "VTE", civilDate(2026, 1, 8), 1, "FV-2026-001", "Vente au comptant", true, [
        { accountCode: "411100", label: "Client comptant", debit: "1180000", credit: "0", thirdPartyCode: "CLI001" },
        { accountCode: "701100", label: "Vente de marchandises", debit: "0", credit: "1000000" },
        { accountCode: "443100", label: "TVA facturée", debit: "0", credit: "180000" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "ACH", civilDate(2026, 1, 12), 1, "FA-2026-004", "Approvisionnement", true, [
        { accountCode: "601100", label: "Achat de marchandises", debit: "400000", credit: "0" },
        { accountCode: "445200", label: "TVA récupérable", debit: "72000", credit: "0" },
        { accountCode: "401100", label: "Fournisseur", debit: "0", credit: "472000", thirdPartyCode: "FOU001" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "BQ1", civilDate(2026, 1, 18), 1, "BQ-2026-003", "Règlement client", true, [
        { accountCode: "521100", label: "Encaissement bancaire", debit: "1180000", credit: "0" },
        { accountCode: "411100", label: "Règlement client", debit: "0", credit: "1180000", thirdPartyCode: "CLI001" }
      ])
    ),
    relabel(
      demoEntry(organizationId, fiscalYearId, "OD", civilDate(2026, 2, 1), 1, "OD-2026-001", "Brouillon d'ajustement", false, [
        { accountCode: "601100", label: "Charge à régulariser", debit: "25000", credit: "0" },
        { accountCode: "401100", label: "Fournisseur à confirmer", debit: "0", credit: "25000", thirdPartyCode: "FOU002" }
      ])
    )
  ];

  const sequences = new Map<string, EntryNumberSequence>();
  for (const entry of state.entries) {
    const key = `${entry.journalCode}|${entry.fiscalYearId}`;
    const sequenceNumber = Number(entry.number.split("-").pop() ?? "0");
    const existing = sequences.get(key);
    if (!existing || existing.lastNumber < sequenceNumber) {
      sequences.set(key, {
        journalCode: entry.journalCode,
        fiscalYearId: entry.fiscalYearId,
        lastNumber: sequenceNumber
      });
    }
  }
  state.entrySequences = [...sequences.values()].sort((left, right) => left.journalCode.localeCompare(right.journalCode));

  return state;
}
