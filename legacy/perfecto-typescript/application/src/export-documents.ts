/**
 * Construction des documents éditables.
 *
 * Reprise du menu « Éditions » de PERFECTO WinDev (`menu_entries_reports_findings.md`,
 * `menu_file_definitions_findings.md`) : journal, grand livre, balance, pièce, relevé
 * auxiliaire, plan comptable, fichier des tiers et piste d'audit.
 *
 * Principe directeur de la tranche 4 — **le contenu est construit une seule fois, ici** :
 * les moteurs de `@perfecto/exports` ne font que le mettre en forme (PDF, Excel, CSV),
 * donc les trois sorties d'une même édition portent exactement les mêmes lignes, les
 * mêmes totaux et les mêmes mentions. Aucune règle comptable n'est réimplémentée côté
 * rendu, et les états s'appuient sur les mêmes sélecteurs que les écrans
 * ({@link reportableEntries}, {@link buildJournal}, {@link buildGeneralLedger}…).
 *
 * Rappels métier portés par ces documents :
 *  - une pièce extournée **reste** dans les livres ; c'est sa contre-passation qui
 *    l'annule, d'où un journal et une balance toujours équilibrés ;
 *  - seuls les mouvements de pièces validées alimentent les états (un brouillon
 *    n'apparaît que sur la pièce elle-même) ;
 *  - le solde non lettré d'un tiers est ce qui reste à rapprocher ou à relancer.
 */

import type {
  DocumentKind,
  ExportCell,
  ExportColumn,
  ExportDocument,
  ExportDocumentRequest,
  ExportField,
  ExportRow
} from "@perfecto/contracts";
import { auditActionLabel, documentKindLabels } from "@perfecto/contracts";
import {
  AMOUNT_ZERO,
  accountingEntryStatusLabel,
  amountAdd,
  amountFromDecimal,
  amountToDecimal,
  amountToNumber,
  civilYear,
  formatAmountGrouped,
  formatCivilDateFr,
  formatTimestampFr,
  organizationFooterIdentity,
  thirdPartyTypeLabel,
  DomainRuleError,
  type Amount,
  type CivilDate
} from "@perfecto/domain";
import type { AccountingState, AttachmentRecord, StoredEntry } from "./state";
import {
  buildGeneralLedger,
  buildJournal,
  buildThirdPartyStatement,
  buildTrialBalance,
  exerciseYear,
  reportableEntries,
  thirdPartyUsage,
  type LineReconciliation
} from "./reports";

/** Devise du référentiel SYSCOHADA porté par le Lot 1. */
export const EXPORT_CURRENCY = "XOF";

/** Instant et acteur de la génération : ils figurent sur chaque document. */
export interface ExportContext {
  readonly now: Date;
  readonly actor: string;
}

/* ------------------------------------------------------------------ */
/* Cellules et colonnes                                                */
/* ------------------------------------------------------------------ */

function textCell(text: string): ExportCell {
  return { text };
}

/** Cellule de montant : texte français affiché + valeur numérique pour un tableur. */
function amountCell(amount: Amount): ExportCell {
  return { text: formatAmountGrouped(amount), value: amountToNumber(amount) };
}

/** Cellule de montant à partir d'un DTO (chaîne décimale exacte). */
function decimalCell(decimal: string): ExportCell {
  return amountCell(amountFromDecimal(decimal));
}

/** Cellule de date : texte français + valeur ISO pour un tableur. */
function dateCell(date: CivilDate): ExportCell {
  return { text: formatCivilDateFr(date), value: date };
}

/** Cellule d'horodatage : texte français + valeur ISO. */
function timestampCell(iso: string): ExportCell {
  return { text: formatTimestampFr(iso), value: iso };
}

function booleanCell(value: boolean): ExportCell {
  return { text: value ? "Oui" : "Non" };
}

function column(
  key: string,
  label: string,
  kind: ExportColumn["kind"],
  width: number,
  align: ExportColumn["align"] = "left"
): ExportColumn {
  return { key, label, align, kind, width };
}

const AMOUNT_COLUMNS = { debit: "Débit", credit: "Crédit" } as const;

/* ------------------------------------------------------------------ */
/* Assemblage commun                                                   */
/* ------------------------------------------------------------------ */

/**
 * Nom de fichier sans extension : `PERFECTO_<document>_<contexte>_<jour>`.
 * Le jour de génération distingue deux éditions du même document.
 */
function slugFor(document: string, context: readonly string[], ctx: ExportContext): string {
  const day = ctx.now.toISOString().slice(0, 10);
  return ["PERFECTO", document, ...context.filter((part) => part.length > 0), day].join("_");
}

function footerFor(state: AccountingState, ctx: ExportContext, mention: string): string {
  const identity = organizationFooterIdentity(state.organization);
  const year = exerciseYear(state);
  const stamp = `document généré le ${formatTimestampFr(ctx.now.toISOString())} par ${ctx.actor}`;
  return `${identity} · Exercice ${year} · montants en ${EXPORT_CURRENCY} · ${stamp}. ${mention}`;
}

/** Période couverte, en toutes lettres, pour le sous-titre et les champs d'identité. */
function rangeLabel(request: ExportDocumentRequest, year: number): string {
  const from = request.from ?? `${year}-01-01`;
  const to = request.to ?? `${year}-12-31`;
  return `Du ${formatCivilDateFr(from)} au ${formatCivilDateFr(to)}`;
}

function withinRange(date: CivilDate, from?: CivilDate, to?: CivilDate): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/** Pièces de l'état dans la période demandée (le filtrage par date précède les états). */
function entriesInRange(state: AccountingState, request: ExportDocumentRequest): StoredEntry[] {
  return state.entries.filter((entry) => withinRange(entry.entryDate, request.from, request.to));
}

function plural(count: number, singular: string, pluralForm?: string): string {
  return count > 1 ? `${count} ${pluralForm ?? `${singular}s`}` : `${count} ${singular}`;
}

interface DocumentDraft {
  kind: DocumentKind;
  title: string;
  subtitle: string;
  slug: string;
  fields: ExportField[];
  columns: ExportColumn[];
  rows: ExportRow[];
  totals?: ExportRow | undefined;
  mention: string;
}

/** Complète un brouillon avec l'identité commune à tous les documents. */
function compose(state: AccountingState, ctx: ExportContext, draft: DocumentDraft): ExportDocument {
  return {
    kind: draft.kind,
    title: draft.title,
    subtitle: draft.subtitle,
    organization: state.organization,
    organizationId: state.organizationId,
    fiscalYear: `Exercice ${exerciseYear(state)}`,
    currency: EXPORT_CURRENCY,
    generatedAt: ctx.now.toISOString(),
    generatedBy: ctx.actor,
    slug: draft.slug,
    fields: draft.fields,
    columns: draft.columns,
    rows: draft.rows,
    ...(draft.totals ? { totals: draft.totals } : {}),
    footer: footerFor(state, ctx, draft.mention)
  };
}

/** Nombre de pièces qui alimentent les états (validées et extournées). */
export function reportableEntryCount(state: AccountingState): number {
  return reportableEntries(state.entries).length;
}

function journalLabel(state: AccountingState, code: string): string {
  const journal = state.journals.find((item) => item.code.toUpperCase() === code.toUpperCase());
  return journal ? `${journal.code} — ${journal.label}` : code;
}

/* ------------------------------------------------------------------ */
/* Journal des écritures                                               */
/* ------------------------------------------------------------------ */

/**
 * Journal des écritures : toutes les imputations des pièces qui alimentent les états,
 * dans l'ordre chronologique, avec totaux équilibrés.
 */
export function buildJournalDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const journalCode = request.journalCode?.trim().toUpperCase() ?? "";
  if (
    journalCode !== "" &&
    !state.journals.some((journal) => journal.code.toUpperCase() === journalCode)
  ) {
    throw new DomainRuleError("Le journal sélectionné n'existe pas.");
  }

  const scoped = entriesInRange(state, request);
  const lines = buildJournal(reportableEntries(scoped)).filter(
    (line) => journalCode === "" || line.journalCode.toUpperCase() === journalCode
  );

  const columns: ExportColumn[] = [
    column("entryDate", "Date", "date", 11),
    column("entryNumber", "N° pièce", "text", 16),
    column("journalCode", "Journal", "text", 9),
    column("reference", "Référence", "text", 16),
    column("accountCode", "Compte", "text", 10),
    column("accountLabel", "Intitulé", "text", 30),
    column("label", "Libellé", "text", 34),
    column("thirdPartyCode", "Tiers", "text", 10),
    column("debit", AMOUNT_COLUMNS.debit, "amount", 14, "right"),
    column("credit", AMOUNT_COLUMNS.credit, "amount", 14, "right")
  ];

  const rows: ExportRow[] = lines.map((line) => ({
    cells: [
      dateCell(line.entryDate),
      textCell(line.entryNumber),
      textCell(line.journalCode),
      textCell(line.reference),
      textCell(line.accountCode),
      textCell(line.accountLabel),
      textCell(line.label),
      textCell(line.thirdPartyCode ?? ""),
      decimalCell(line.debit),
      decimalCell(line.credit)
    ]
  }));

  const totalDebit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.debit)), AMOUNT_ZERO);
  const totalCredit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.credit)), AMOUNT_ZERO);
  const entryCount = new Set(lines.map((line) => line.entryNumber)).size;
  const hasReversal = reportableEntries(scoped).some((entry) => entry.reversedAt !== null);

  const fields: ExportField[] = [
    { label: "Période", text: rangeLabel(request, exerciseYear(state)) },
    { label: "Pièces", text: plural(entryCount, "pièce", "pièces") },
    { label: "Lignes", text: plural(lines.length, "imputation") }
  ];
  if (journalCode !== "") {
    fields.unshift({ label: "Journal", text: journalLabel(state, journalCode) });
  }

  const year = civilYear(request.from ?? ctx.now.toISOString().slice(0, 10));
  const endDate = request.to ?? `${year}-12-31`;
  return compose(state, ctx, {
    kind: "journal",
    title: journalCode === "" ? "Journal des écritures" : `Journal ${journalCode}`,
    subtitle: journalCode === ""
      ? rangeLabel(request, exerciseYear(state))
      : `${journalLabel(state, journalCode)} · ${rangeLabel(request, exerciseYear(state))}`,
    slug: slugFor("journal", [journalCode], ctx),
    fields,
    columns,
    rows,
    totals: {
      cells: [
        textCell("Totaux"),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(`${plural(lines.length, "imputation")}`),
        textCell(""),
        amountCell(totalDebit),
        amountCell(totalCredit)
      ],
      emphasis: "total"
    },
    mention: hasReversal
      ? "Les pièces extournées restent dans les livres : leur somme avec leur contre-passation est nulle."
      : `Journal arrêté au ${formatCivilDateFr(endDate)} ; total des débits égal au total des crédits.`
  });
}

/* ------------------------------------------------------------------ */
/* Grand livre                                                         */
/* ------------------------------------------------------------------ */

/**
 * Grand livre : mouvements par compte, avec solde progressif et solde de clôture.
 * Chaque compte ouvre une ligne de section (intitulé et totaux), puis détaille ses
 * mouvements — la forme attendue par un réviseur.
 */
export function buildGeneralLedgerDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const wanted = request.accountCode?.trim().toUpperCase() ?? "";
  if (wanted !== "" && !state.accounts.some((account) => account.code.toUpperCase() === wanted)) {
    throw new DomainRuleError(`Le compte ${wanted} n'existe pas.`);
  }

  const scoped = entriesInRange(state, request);
  const accounts = buildGeneralLedger(reportableEntries(scoped)).filter(
    (account) => wanted === "" || account.accountCode.toUpperCase() === wanted
  );

  const columns: ExportColumn[] = [
    column("entryDate", "Date / compte", "date", 12),
    column("entryNumber", "N° pièce / intitulé", "text", 26),
    column("journalCode", "Journal", "text", 9),
    column("reference", "Référence", "text", 16),
    column("label", "Libellé", "text", 34),
    column("thirdPartyCode", "Tiers", "text", 10),
    column("debit", AMOUNT_COLUMNS.debit, "amount", 14, "right"),
    column("credit", AMOUNT_COLUMNS.credit, "amount", 14, "right"),
    column("runningBalance", "Solde", "amount", 15, "right")
  ];

  const rows: ExportRow[] = [];
  for (const account of accounts) {
    rows.push({
      cells: [
        textCell(account.accountCode),
        textCell(account.accountLabel),
        textCell(""),
        textCell(""),
        textCell(`${plural(account.lines.length, "mouvement")}`),
        textCell(""),
        decimalCell(account.totalDebit),
        decimalCell(account.totalCredit),
        decimalCell(account.closingBalance)
      ],
      emphasis: "section"
    });
    for (const line of account.lines) {
      rows.push({
        cells: [
          dateCell(line.entryDate),
          textCell(line.entryNumber),
          textCell(line.journalCode),
          textCell(line.reference),
          textCell(line.label),
          textCell(line.thirdPartyCode ?? ""),
          decimalCell(line.debit),
          decimalCell(line.credit),
          decimalCell(line.runningBalance)
        ]
      });
    }
  }

  const totalDebit = accounts.reduce(
    (sum, account) => amountAdd(sum, amountFromDecimal(account.totalDebit)),
    AMOUNT_ZERO
  );
  const totalCredit = accounts.reduce(
    (sum, account) => amountAdd(sum, amountFromDecimal(account.totalCredit)),
    AMOUNT_ZERO
  );

  return compose(state, ctx, {
    kind: "general-ledger",
    title: wanted === "" ? "Grand livre" : `Grand livre du compte ${wanted}`,
    subtitle: rangeLabel(request, exerciseYear(state)),
    slug: slugFor("general-ledger", [wanted], ctx),
    fields: [
      { label: "Période", text: rangeLabel(request, exerciseYear(state)) },
      {
        label: wanted === "" ? "Comptes mouvementés" : "Compte",
        text:
          wanted === ""
            ? plural(accounts.length, "compte mouvementé", "comptes mouvementés")
            : `${wanted} — ${accounts[0]?.accountLabel ?? ""}`.trim()
      },
      { label: "Mouvements", text: plural(accounts.reduce((sum, account) => sum + account.lines.length, 0), "mouvement") }
    ],
    columns,
    rows,
    totals: {
      cells: [
        textCell("Totaux"),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        amountCell(totalDebit),
        amountCell(totalCredit),
        amountCell(totalDebit - totalCredit)
      ],
      emphasis: "total"
    },
    mention:
      "Le solde d'un compte est la somme algébrique de ses mouvements ; un grand livre arrêté en cours d'exercice ne préjuge pas de la clôture."
  });
}

/* ------------------------------------------------------------------ */
/* Balance générale                                                    */
/* ------------------------------------------------------------------ */

/** Balance générale : mouvements et soldes, avec contrôle d'égalité débit/crédit. */
export function buildTrialBalanceDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const scoped = entriesInRange(state, request);
  const lines = buildTrialBalance(state.accounts, scoped);

  const columns: ExportColumn[] = [
    column("accountCode", "Compte", "text", 10),
    column("accountLabel", "Intitulé", "text", 34),
    column("accountClass", "Classe", "text", 8, "center"),
    column("debitMovements", "Mouvements débit", "amount", 16, "right"),
    column("creditMovements", "Mouvements crédit", "amount", 16, "right"),
    column("debitBalance", "Solde débiteur", "amount", 15, "right"),
    column("creditBalance", "Solde créditeur", "amount", 15, "right")
  ];

  const classOf = new Map(state.accounts.map((account) => [account.code, account.accountClass]));
  const rows: ExportRow[] = lines.map((line) => ({
    cells: [
      textCell(line.accountCode),
      textCell(line.accountLabel),
      textCell(classOf.get(line.accountCode) ?? ""),
      decimalCell(line.debitMovements),
      decimalCell(line.creditMovements),
      decimalCell(line.debitBalance),
      decimalCell(line.creditBalance)
    ]
  }));

  const total = (pick: (line: (typeof lines)[number]) => string): Amount =>
    lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(pick(line))), AMOUNT_ZERO);
  const debitMovements = total((line) => line.debitMovements);
  const creditMovements = total((line) => line.creditMovements);
  const debitBalance = total((line) => line.debitBalance);
  const creditBalance = total((line) => line.creditBalance);
  const balanced = debitMovements === creditMovements;

  return compose(state, ctx, {
    kind: "trial-balance",
    title: "Balance générale",
    subtitle: request.to
      ? `Arrêtée au ${formatCivilDateFr(request.to)}`
      : rangeLabel(request, exerciseYear(state)),
    slug: slugFor("trial-balance", request.to ? [request.to] : [], ctx),
    fields: [
      { label: "Période", text: rangeLabel(request, exerciseYear(state)) },
      { label: "Comptes", text: plural(lines.length, "compte mouvementé", "comptes mouvementés") },
      {
        label: "Équilibre",
        text: balanced
          ? "Débit = crédit"
          : `Écart de ${formatAmountGrouped(debitMovements - creditMovements)}`
      }
    ],
    columns,
    rows,
    totals: {
      cells: [
        textCell("Totaux"),
        textCell(""),
        textCell(""),
        amountCell(debitMovements),
        amountCell(creditMovements),
        amountCell(debitBalance),
        amountCell(creditBalance)
      ],
      emphasis: "total"
    },
    mention: balanced
      ? "La balance est équilibrée : total des débits égal au total des crédits, et soldes débiteurs égaux aux soldes créditeurs."
      : "ATTENTION : la balance n'est pas équilibrée. Aucune pièce validée ne peut produire cet écart — vérifier les reports à nouveau."
  });
}

/* ------------------------------------------------------------------ */
/* Pièce comptable                                                     */
/* ------------------------------------------------------------------ */

/**
 * Pièce comptable : document unitaire opposable. Une pièce validée est immuable ;
 * le document le rappelle, et cite la contre-passation le cas échéant.
 */
export function buildEntryDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const entryId = request.entryId?.trim() ?? "";
  if (entryId === "") {
    throw new DomainRuleError("La pièce à éditer est obligatoire.");
  }
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) {
    throw new DomainRuleError("La pièce demandée n'existe pas.");
  }

  const columns: ExportColumn[] = [
    column("accountCode", "Compte", "text", 10),
    column("accountLabel", "Intitulé", "text", 30),
    column("label", "Libellé", "text", 34),
    column("thirdPartyCode", "Tiers", "text", 12),
    column("debit", AMOUNT_COLUMNS.debit, "amount", 14, "right"),
    column("credit", AMOUNT_COLUMNS.credit, "amount", 14, "right")
  ];

  const names = new Map(state.thirdParties.map((item) => [item.code.toUpperCase(), item.name]));
  const rows: ExportRow[] = entry.lines.map((line) => ({
    cells: [
      textCell(line.accountCode),
      textCell(line.accountLabel),
      textCell(line.label),
      textCell(
        line.thirdPartyCode
          ? `${line.thirdPartyCode}${names.has(line.thirdPartyCode.toUpperCase()) ? ` — ${names.get(line.thirdPartyCode.toUpperCase())}` : ""}`
          : ""
      ),
      amountCell(line.debit),
      amountCell(line.credit)
    ]
  }));

  const totalDebit = entry.lines.reduce((sum, line) => amountAdd(sum, line.debit), AMOUNT_ZERO);
  const totalCredit = entry.lines.reduce((sum, line) => amountAdd(sum, line.credit), AMOUNT_ZERO);
  const attachments = state.attachments.filter((item: AttachmentRecord) => item.entryId === entry.id);
  const reversalOf = entry.reversalOfEntryId
    ? state.entries.find((item) => item.id === entry.reversalOfEntryId)
    : undefined;
  const reversedBy = entry.reversedByEntryId
    ? state.entries.find((item) => item.id === entry.reversedByEntryId)
    : undefined;

  const fields: ExportField[] = [
    { label: "Numéro", text: entry.number },
    { label: "Référence", text: entry.reference },
    { label: "Journal", text: journalLabel(state, entry.journalCode) },
    { label: "Date", text: formatCivilDateFr(entry.entryDate) },
    { label: "Description", text: entry.description },
    { label: "Statut", text: accountingEntryStatusLabel[entry.status] },
    { label: "Lignes", text: plural(entry.lines.length, "imputation") }
  ];
  if (entry.postedAt) fields.push({ label: "Validée le", text: formatTimestampFr(entry.postedAt) });
  if (entry.updatedAt) fields.push({ label: "Révisée le", text: formatTimestampFr(entry.updatedAt) });
  if (reversedBy) {
    fields.push({ label: "Extournée par", text: reversedBy.number });
    fields.push({ label: "Extourne du", text: formatCivilDateFr(reversedBy.entryDate) });
  }
  if (reversalOf) {
    fields.push({ label: "Contre-passation de", text: reversalOf.number });
  }
  fields.push({
    label: "Justificatifs",
    text:
      attachments.length === 0
        ? "Aucun justificatif rattaché"
        : attachments
            .map(
              (item) =>
                `${item.fileName} · ${item.sizeBytes} octets · sha256:${item.sha256.slice(0, 8)}…`
            )
            .join(" ; ")
  });

  const mention = reversedBy
    ? `Pièce extournée par ${reversedBy.number} : elle reste dans les livres, sa contre-passation l'annule.`
    : entry.status === "draft"
      ? "Pièce en brouillon : elle n'alimente ni le journal, ni le grand livre, ni la balance."
      : "Pièce validée, donc immuable : toute correction passe par une contre-passation datée et tracée.";

  return compose(state, ctx, {
    kind: "entry",
    title: `Pièce comptable ${entry.number}`,
    subtitle: `${entry.reference} · ${entry.description}`,
    slug: slugFor("piece", [entry.number], ctx),
    fields,
    columns,
    rows,
    totals: {
      cells: [
        textCell("Totaux"),
        textCell(""),
        textCell(""),
        textCell(""),
        amountCell(totalDebit),
        amountCell(totalCredit)
      ],
      emphasis: "total"
    },
    mention
  });
}

/* ------------------------------------------------------------------ */
/* Relevé auxiliaire d'un tiers                                        */
/* ------------------------------------------------------------------ */

/**
 * Relevé auxiliaire : mouvements d'un tiers, lettres de rapprochement et solde non
 * lettré — ce qui reste à rapprocher ou à relancer.
 */
export function buildThirdPartyStatementDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const code = request.thirdPartyCode?.trim().toUpperCase() ?? "";
  if (code === "") {
    throw new DomainRuleError("Le tiers à éditer est obligatoire.");
  }
  const thirdParty = thirdPartyUsage(state).find((item) => item.code.toUpperCase() === code);
  if (!thirdParty) {
    throw new DomainRuleError(`Le tiers ${code} n'existe pas.`);
  }

  const reconciliations: LineReconciliation[] = state.reconciliations
    .filter(
      (record) =>
        record.scope === "thirdParty" && record.key.toUpperCase() === thirdParty.code.toUpperCase()
    )
    .map((record) => ({ id: record.id, label: record.label, lineIds: record.lineIds }));

  const lines = buildThirdPartyStatement(state.entries, thirdParty.code, reconciliations).filter(
    (line) => withinRange(line.entryDate, request.from, request.to)
  );

  const columns: ExportColumn[] = [
    column("reconciliationLabel", "Lettre", "text", 7, "center"),
    column("entryDate", "Date", "date", 11),
    column("entryNumber", "N° pièce", "text", 16),
    column("journalCode", "Journal", "text", 9),
    column("reference", "Référence", "text", 16),
    column("accountCode", "Compte", "text", 10),
    column("label", "Libellé", "text", 32),
    column("debit", AMOUNT_COLUMNS.debit, "amount", 14, "right"),
    column("credit", AMOUNT_COLUMNS.credit, "amount", 14, "right"),
    column("runningBalance", "Solde", "amount", 15, "right")
  ];

  const rows: ExportRow[] = lines.map((line) => ({
    cells: [
      textCell(line.reconciliationLabel ?? ""),
      dateCell(line.entryDate),
      textCell(line.entryNumber),
      textCell(line.journalCode),
      textCell(line.reference),
      textCell(line.accountCode),
      textCell(line.label),
      decimalCell(line.debit),
      decimalCell(line.credit),
      decimalCell(line.runningBalance)
    ]
  }));

  const totalDebit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.debit)), AMOUNT_ZERO);
  const totalCredit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.credit)), AMOUNT_ZERO);
  const closing = totalDebit - totalCredit;
  const unreconciled = lines
    .filter((line) => line.reconciliationLabel === null)
    .reduce(
      (sum, line) => amountAdd(sum, amountAdd(amountFromDecimal(line.debit), -amountFromDecimal(line.credit))),
      AMOUNT_ZERO
    );
  const lettered = lines.filter((line) => line.reconciliationLabel !== null).length;

  const fields: ExportField[] = [
    { label: "Tiers", text: `${thirdParty.code} — ${thirdParty.name}` },
    { label: "Type", text: thirdPartyTypeLabel[thirdParty.type] },
    { label: "État", text: thirdParty.isActive ? "Actif" : "Désactivé" },
    { label: "Période", text: rangeLabel(request, exerciseYear(state)) },
    { label: "Mouvements", text: plural(lines.length, "mouvement") },
    { label: "Mouvements lettrés", text: `${lettered} sur ${lines.length}` },
    { label: "Solde", text: formatAmountGrouped(closing) },
    { label: "Solde non lettré", text: formatAmountGrouped(unreconciled) }
  ];
  // Chaque lettre présente sur le relevé est expliquée : un lettrage sans commentaire
  // n'est pas contrôlable par un tiers.
  for (const record of state.reconciliations.filter(
    (item) => item.scope === "thirdParty" && item.key.toUpperCase() === thirdParty.code.toUpperCase()
  )) {
    const used = lines.some((line) => record.lineIds.includes(line.lineId));
    if (!used) continue;
    fields.push({
      label: `Lettrage ${record.label}`,
      text: `${plural(record.lineIds.length, "mouvement")} · ${amountToDecimal(record.totalDebit)} ${EXPORT_CURRENCY} · ${formatTimestampFr(record.createdAt)} par ${record.createdBy}${record.comment ? ` · ${record.comment}` : ""}`
    });
  }

  return compose(state, ctx, {
    kind: "third-party-statement",
    title: `Relevé auxiliaire ${thirdParty.code}`,
    subtitle: `${thirdParty.name} · ${rangeLabel(request, exerciseYear(state))}`,
    slug: slugFor("releve-tiers", [thirdParty.code], ctx),
    fields,
    columns,
    rows,
    totals: {
      cells: [
        textCell("Totaux"),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(""),
        textCell(`${lettered} mouvement(s) lettré(s)`),
        amountCell(totalDebit),
        amountCell(totalCredit),
        amountCell(closing)
      ],
      emphasis: "total"
    },
    mention:
      unreconciled === AMOUNT_ZERO
        ? "Tous les mouvements du relevé sont lettrés : le solde est rapproché."
        : `Un solde de ${formatAmountGrouped(unreconciled)} reste à rapprocher ou à relancer.`
  });
}

/* ------------------------------------------------------------------ */
/* Référentiels : plan comptable et fichier des tiers                  */
/* ------------------------------------------------------------------ */

/** Plan comptable paramétré par la société (profil SYSCOHADA révisé). */
export function buildChartOfAccountsDocument(
  state: AccountingState,
  _request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const accounts = [...state.accounts].sort((left, right) => left.code.localeCompare(right.code));
  const columns: ExportColumn[] = [
    column("code", "Compte", "text", 10),
    column("label", "Intitulé", "text", 40),
    column("accountClass", "Classe", "text", 8, "center"),
    column("accountType", "Nature", "text", 16),
    column("allowsPosting", "Imputation", "text", 11, "center"),
    column("requiresThirdParty", "Tiers requis", "text", 12, "center"),
    column("isActive", "État", "text", 10, "center")
  ];

  const rows: ExportRow[] = accounts.map((account) => ({
    cells: [
      textCell(account.code),
      textCell(account.label),
      textCell(account.accountClass),
      textCell(account.accountType),
      booleanCell(account.allowsPosting),
      booleanCell(account.requiresThirdParty),
      textCell(account.isActive ? "Actif" : "Inactif")
    ]
  }));

  const auxiliary = accounts.filter((account) => account.requiresThirdParty).length;
  return compose(state, ctx, {
    kind: "chart-of-accounts",
    title: "Plan comptable",
    subtitle: `Référentiel SYSCOHADA révisé · Exercice ${exerciseYear(state)}`,
    slug: slugFor("plan-comptable", [], ctx),
    fields: [
      { label: "Comptes", text: plural(accounts.length, "compte") },
      { label: "Comptes auxiliaires", text: String(auxiliary) },
      {
        label: "Classes",
        text: [...new Set(accounts.map((account) => account.accountClass))].sort().join(", ")
      }
    ],
    columns,
    rows,
    mention:
      "Un compte marqué « Tiers requis » refuse une imputation sans tiers : c'est la condition d'un relevé auxiliaire lettrable."
  });
}

/** Fichier des tiers : fiche unique partagée par tous les modules, usage comptable inclus. */
export function buildThirdPartiesDocument(
  state: AccountingState,
  _request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const usage = thirdPartyUsage(state);
  const columns: ExportColumn[] = [
    column("code", "Code", "text", 9),
    column("name", "Nom", "text", 30),
    column("type", "Type", "text", 13),
    column("taxIdentifier", "IFU / N° compte contribuable", "text", 20),
    column("address", "Adresse", "text", 28),
    column("phone", "Téléphone", "text", 17),
    column("email", "Courriel", "text", 26),
    column("isActive", "État", "text", 10, "center"),
    column("postedLineCount", "Lignes validées", "number", 13, "right"),
    column("netBalance", "Solde net", "amount", 15, "right")
  ];

  const rows: ExportRow[] = usage.map((item) => ({
    cells: [
      textCell(item.code),
      textCell(item.name),
      textCell(thirdPartyTypeLabel[item.type]),
      textCell(item.taxIdentifier),
      textCell(item.address),
      textCell(item.phone),
      textCell(item.email),
      textCell(item.isActive ? "Actif" : "Désactivé"),
      { text: String(item.postedLineCount), value: item.postedLineCount },
      decimalCell(item.netBalance)
    ]
  }));

  const active = usage.filter((item) => item.isActive).length;
  return compose(state, ctx, {
    kind: "third-parties",
    title: "Fichier des tiers",
    subtitle: `Fiche unique partagée par les modules · Exercice ${exerciseYear(state)}`,
    slug: slugFor("fichier-tiers", [], ctx),
    fields: [
      { label: "Fiches", text: plural(usage.length, "fiche") },
      { label: "Fiches actives", text: String(active) },
      { label: "Fiches désactivées", text: String(usage.length - active) }
    ],
    columns,
    rows,
    mention:
      "Un tiers désactivé reste consultable et continue d'alimenter ses relevés ; il ne peut plus être imputé."
  });
}

/* ------------------------------------------------------------------ */
/* Piste d'audit                                                       */
/* ------------------------------------------------------------------ */

/** Piste d'audit : journal en ajout seulement, dans l'ordre d'écriture. */
export function buildAuditTrailDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  const entityType = request.entityType?.trim() ?? "";
  const entityId = request.entityId?.trim() ?? "";
  let events = [...state.audit]
    .filter((event) => entityType === "" || event.entityType === entityType)
    .filter((event) => entityId === "" || event.entityId === entityId)
    .sort((left, right) => left.sequence - right.sequence);

  // `limit` conserve les derniers événements, mais l'édition reste chronologique :
  // on veut « les N plus récents », pas « N événements dans le désordre ».
  const limit = typeof request.limit === "number" && request.limit > 0 ? request.limit : undefined;
  if (limit !== undefined && events.length > limit) {
    events = events.slice(events.length - limit);
  }

  const columns: ExportColumn[] = [
    column("sequence", "Rang", "number", 7, "right"),
    column("occurredAt", "Horodatage", "date", 17),
    column("actor", "Acteur", "text", 16),
    column("action", "Opération", "text", 38),
    column("entityType", "Entité", "text", 18),
    column("entityId", "Identifiant", "text", 24),
    column("details", "Détails", "text", 44)
  ];

  const rows: ExportRow[] = events.map((event) => ({
    cells: [
      { text: String(event.sequence), value: event.sequence },
      timestampCell(event.occurredAt),
      textCell(event.actor),
      textCell(`${auditActionLabel(event.action)} (${event.action})`),
      textCell(event.entityType),
      textCell(event.entityId),
      textCell(event.details)
    ]
  }));

  const scope = [
    entityType === "" ? "toutes entités" : entityType,
    entityId === "" ? "" : `identifiant ${entityId}`,
    limit === undefined ? "" : `${limit} dernier(s)`
  ]
    .filter((part) => part.length > 0)
    .join(" · ");

  return compose(state, ctx, {
    kind: "audit-trail",
    title: "Piste d'audit",
    subtitle: scope.length > 0 ? scope : `Exercice ${exerciseYear(state)}`,
    slug: slugFor("piste-audit", [entityType], ctx),
    fields: [
      { label: "Événements", text: plural(events.length, "événement") },
      { label: "Périmètre", text: scope.length > 0 ? scope : "Aucun filtre" },
      { label: "Acteurs", text: [...new Set(events.map((event) => event.actor))].join(", ") || "—" }
    ],
    columns,
    rows,
    mention:
      "Journal en ajout seulement : aucune opération ne peut être effacée ni modifiée après coup, et le rang d'écriture ordonne deux actes horodatés dans la même milliseconde."
  });
}

/* ------------------------------------------------------------------ */
/* Aiguillage                                                          */
/* ------------------------------------------------------------------ */

/**
 * Construit le document demandé.
 *
 * Un document inconnu est refusé en français, avec la liste des éditions disponibles :
 * l'écran affiche la raison au lieu de produire un fichier vide.
 */
export function buildExportDocument(
  state: AccountingState,
  request: ExportDocumentRequest,
  ctx: ExportContext
): ExportDocument {
  switch (request.kind) {
    case "journal":
      return buildJournalDocument(state, request, ctx);
    case "general-ledger":
      return buildGeneralLedgerDocument(state, request, ctx);
    case "trial-balance":
      return buildTrialBalanceDocument(state, request, ctx);
    case "entry":
      return buildEntryDocument(state, request, ctx);
    case "third-party-statement":
      return buildThirdPartyStatementDocument(state, request, ctx);
    case "chart-of-accounts":
      return buildChartOfAccountsDocument(state, request, ctx);
    case "third-parties":
      return buildThirdPartiesDocument(state, request, ctx);
    case "audit-trail":
      return buildAuditTrailDocument(state, request, ctx);
    default:
      throw new DomainRuleError(
        `Document inconnu : « ${String(request.kind)} ». Documents disponibles : ${Object.values(
          documentKindLabels
        ).join(", ")}.`
      );
  }
}
