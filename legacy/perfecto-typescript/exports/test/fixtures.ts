/**
 * Fabriques de documents pour les tests de rendu.
 *
 * Les trois moteurs doivent produire le même contenu à partir du même modèle neutre :
 * ces fabriques couvrent les formes qui cassent le plus souvent un rendu — beaucoup de
 * colonnes (paysage), beaucoup de lignes (pagination), aucune ligne (néant), des
 * caractères que les polices PDF standard ne savent pas encoder, des montants négatifs.
 */

import type { ExportColumn, ExportDocument, ExportRow } from "@perfecto/contracts";
import type { OrganizationProfile } from "@perfecto/domain";
import { inflateSync } from "node:zlib";

export const SOCIETY: OrganizationProfile = {
  code: "000",
  name: "PERFECTO Négoce Abidjan",
  legalForm: "SARL",
  taxIdentifier: "CI-2024-B-1187",
  address: "Boulevard Latrille, Cocody Danga",
  city: "Abidjan",
  country: "Côte d'Ivoire",
  phone: "+225 27 22 44 55 66",
  email: "compta@perfecto-negoce.ci"
};

export const GENERATED_AT = "2026-03-01T08:00:00.000Z";
export const GENERATED_BY = "superviseur";

const BALANCE_COLUMNS: ExportColumn[] = [
  { key: "accountCode", label: "Compte", align: "left", kind: "text", width: 10 },
  { key: "accountLabel", label: "Intitulé", align: "left", kind: "text", width: 32 },
  { key: "debitMovements", label: "Mouvements débit", align: "right", kind: "amount", width: 16 },
  { key: "creditMovements", label: "Mouvements crédit", align: "right", kind: "amount", width: 16 },
  { key: "debitBalance", label: "Solde débiteur", align: "right", kind: "amount", width: 15 },
  { key: "creditBalance", label: "Solde créditeur", align: "right", kind: "amount", width: 15 }
];

function amountCell(text: string, value: number): { text: string; value: number } {
  return { text, value };
}

/** Ligne de balance réaliste : un compte et ses quatre montants. */
function balanceRow(code: string, label: string, debit: number, credit: number): ExportRow {
  const net = debit - credit;
  return {
    cells: [
      { text: code },
      { text: label },
      amountCell(group(debit), debit),
      amountCell(group(credit), credit),
      amountCell(group(net > 0 ? net : 0), net > 0 ? net : 0),
      amountCell(group(net < 0 ? -net : 0), net < 0 ? -net : 0)
    ]
  };
}

/** Groupement français à l'espace simple, comme `formatAmountGrouped`. */
export function group(value: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.abs(value)
  );
  const spaced = formatted.replace(/[\u202F\u00A0\u2009]/g, " ");
  return value < 0 ? `-${spaced}` : spaced;
}

const SAMPLE_ACCOUNTS: [string, string, number, number][] = [
  ["401100", "Fournisseurs", 0, 472000],
  ["411100", "Clients", 1180000, 0],
  ["443100", "TVA facturée", 0, 180000],
  ["445200", "TVA récupérable", 72000, 0],
  ["521100", "Banque Atlantique CI", 1180000, 0],
  ["601100", "Achats de marchandises", 400000, 0],
  ["701100", "Ventes de marchandises", 0, 1000000]
];

/** Balance générale de `rows` lignes (les comptes d'exemple se répètent au besoin). */
export function balanceDocument(rows = SAMPLE_ACCOUNTS.length): ExportDocument {
  const lines: ExportRow[] = [];
  for (let index = 0; index < rows; index += 1) {
    const account = SAMPLE_ACCOUNTS[index % SAMPLE_ACCOUNTS.length]!;
    const suffix = index < SAMPLE_ACCOUNTS.length ? "" : ` (copie ${Math.floor(index / SAMPLE_ACCOUNTS.length) + 1})`;
    lines.push(balanceRow(account[0], `${account[1]}${suffix}`, account[2], account[3]));
  }
  const totalDebit = 2832000;
  const totalCredit = 2832000;

  return {
    kind: "trial-balance",
    title: "Balance générale",
    subtitle: "Arrêtée au 28/02/2026",
    organization: SOCIETY,
    organizationId: "org-demo",
    fiscalYear: "Exercice 2026",
    currency: "XOF",
    generatedAt: GENERATED_AT,
    generatedBy: GENERATED_BY,
    slug: "PERFECTO_trial-balance_2026-03-01",
    fields: [
      { label: "Période", text: "Du 01/01/2026 au 28/02/2026" },
      { label: "Comptes", text: `${lines.length} compte(s) mouvementé(s)` },
      { label: "Équilibre", text: "Débit = crédit" }
    ],
    columns: BALANCE_COLUMNS,
    rows: lines,
    totals: {
      cells: [
        { text: "Totaux" },
        { text: "" },
        amountCell(group(totalDebit), totalDebit),
        amountCell(group(totalCredit), totalCredit),
        amountCell(group(0), 0),
        amountCell(group(0), 0)
      ],
      emphasis: "total"
    },
    footer:
      "PERFECTO Négoce Abidjan · IFU CI-2024-B-1187 · Exercice 2026 · montants en XOF. " +
      "La balance est équilibrée : total des débits égal au total des crédits."
  };
}

/** Document long : vérifie la pagination et la répétition des titres. */
export function longDocument(rows = 240): ExportDocument {
  return balanceDocument(rows);
}

/** Document large : plus de colonnes que la largeur A4 utile, donc paysage. */
export function wideDocument(): ExportDocument {
  const columns: ExportColumn[] = [
    { key: "date", label: "Date", align: "left", kind: "date", width: 11 },
    { key: "journalCode", label: "Journal", align: "left", kind: "text", width: 8 },
    { key: "entryNumber", label: "N° pièce", align: "left", kind: "text", width: 15 },
    { key: "reference", label: "Référence", align: "left", kind: "text", width: 16 },
    { key: "accountCode", label: "Compte", align: "left", kind: "text", width: 10 },
    { key: "accountLabel", label: "Intitulé du compte", align: "left", kind: "text", width: 34 },
    { key: "label", label: "Libellé de l'opération", align: "left", kind: "text", width: 40 },
    { key: "thirdPartyCode", label: "Tiers", align: "left", kind: "text", width: 9 },
    { key: "thirdPartyName", label: "Nom du tiers", align: "left", kind: "text", width: 28 },
    { key: "debit", label: "Débit", align: "right", kind: "amount", width: 14 },
    { key: "credit", label: "Crédit", align: "right", kind: "amount", width: 14 },
    { key: "letter", label: "Lettre", align: "center", kind: "text", width: 7 },
    { key: "runningBalance", label: "Solde cumulé", align: "right", kind: "amount", width: 15 }
  ];

  return {
    kind: "general-ledger",
    title: "Grand livre : 401/411 [détail]",
    subtitle: "Tous les comptes de tiers, du 01/01/2026 au 28/02/2026",
    organization: SOCIETY,
    organizationId: "org-demo",
    fiscalYear: "Exercice 2026",
    currency: "XOF",
    generatedAt: GENERATED_AT,
    generatedBy: GENERATED_BY,
    slug: "PERFECTO_general-ledger_2026-03-01",
    fields: [{ label: "Comptes", text: "Classes 401 et 411" }],
    columns,
    rows: [
      {
        cells: [
          { text: "12/01/2026", value: "2026-01-12" },
          { text: "ACH" },
          { text: "ACH-2026-0001" },
          { text: "FA-2026-004" },
          { text: "401100" },
          { text: "Fournisseurs" },
          { text: "Achat de marchandises — lot Œuvre 1" },
          { text: "FOU001" },
          { text: "Grossiste Abidjan Nord" },
          amountCell("0", 0),
          amountCell(group(472000), 472000),
          { text: "" },
          amountCell(group(-472000), -472000)
        ]
      },
      {
        cells: [
          { text: "18/01/2026", value: "2026-01-18" },
          { text: "VTE" },
          { text: "VTE-2026-0001" },
          { text: "FV-2026-001" },
          { text: "411100" },
          { text: "Clients" },
          { text: "Vente de marchandises" },
          { text: "CLI001" },
          { text: "Supermarché Cocody" },
          amountCell(group(1180000), 1180000),
          amountCell("0", 0),
          { text: "A" },
          amountCell(group(708000), 708000)
        ]
      }
    ],
    totals: {
      cells: columns.map((column, index) =>
        index === 0
          ? { text: "Totaux" }
          : index === 9
            ? amountCell(group(1180000), 1180000)
            : index === 10
              ? amountCell(group(472000), 472000)
              : { text: "" }
      ),
      emphasis: "total"
    },
    footer:
      "PERFECTO Négoce Abidjan · IFU CI-2024-B-1187 · Exercice 2026 · montants en XOF. " +
      "Document généré le 01/03/2026 08:00 par superviseur."
  };
}

/** Pièce comptable : beaucoup de champs d'identité, peu de lignes. */
export function entryDocument(): ExportDocument {
  return {
    kind: "entry",
    title: "Pièce comptable ACH-2026-0001",
    subtitle: "FA-2026-004 · Achat de marchandises janvier",
    organization: SOCIETY,
    organizationId: "org-demo",
    fiscalYear: "Exercice 2026",
    currency: "XOF",
    generatedAt: GENERATED_AT,
    generatedBy: GENERATED_BY,
    slug: "PERFECTO_piece_ACH-2026-0001_2026-03-01",
    fields: [
      { label: "Journal", text: "ACH — Journal des achats" },
      { label: "Date", text: "12/01/2026" },
      { label: "Statut", text: "Validée" },
      { label: "Validée le", text: "12/01/2026 09:15" },
      { label: "Justificatifs", text: "FA-2026-004.pdf · 18 432 octets · sha256:9f2c1ab7…" }
    ],
    columns: [
      { key: "accountCode", label: "Compte", align: "left", kind: "text", width: 10 },
      { key: "accountLabel", label: "Intitulé", align: "left", kind: "text", width: 28 },
      { key: "label", label: "Libellé", align: "left", kind: "text", width: 30 },
      { key: "thirdParty", label: "Tiers", align: "left", kind: "text", width: 12 },
      { key: "debit", label: "Débit", align: "right", kind: "amount", width: 14 },
      { key: "credit", label: "Crédit", align: "right", kind: "amount", width: 14 }
    ],
    rows: [
      {
        cells: [
          { text: "601100" },
          { text: "Achats de marchandises" },
          { text: "Achat lot 04" },
          { text: "" },
          amountCell(group(400000), 400000),
          amountCell("0", 0)
        ]
      },
      {
        cells: [
          { text: "445200" },
          { text: "TVA récupérable" },
          { text: "TVA 18 %" },
          { text: "" },
          amountCell(group(72000), 72000),
          amountCell("0", 0)
        ]
      },
      {
        cells: [
          { text: "401100" },
          { text: "Fournisseurs" },
          { text: "FA-2026-004" },
          { text: "FOU001" },
          amountCell("0", 0),
          amountCell(group(472000), 472000)
        ]
      }
    ],
    totals: {
      cells: [
        { text: "Totaux" },
        { text: "" },
        { text: "" },
        { text: "" },
        amountCell(group(472000), 472000),
        amountCell(group(472000), 472000)
      ],
      emphasis: "total"
    },
    footer:
      "PERFECTO Négoce Abidjan · IFU CI-2024-B-1187 · Exercice 2026 · montants en XOF. " +
      "Une pièce validée est immuable : toute correction passe par une contre-passation."
  };
}

/** Aucune ligne : les trois formats doivent l'écrire explicitement. */
export function emptyDocument(): ExportDocument {
  return {
    kind: "journal",
    title: "Journal BQ1",
    subtitle: "Du 01/02/2026 au 28/02/2026",
    organization: SOCIETY,
    organizationId: "org-demo",
    fiscalYear: "Exercice 2026",
    currency: "XOF",
    generatedAt: GENERATED_AT,
    generatedBy: GENERATED_BY,
    slug: "PERFECTO_journal_BQ1_2026-03-01",
    fields: [{ label: "Journal", text: "BQ1 — Banque Atlantique" }],
    columns: [
      { key: "date", label: "Date", align: "left", kind: "date", width: 11 },
      { key: "entryNumber", label: "N° pièce", align: "left", kind: "text", width: 15 },
      { key: "debit", label: "Débit", align: "right", kind: "amount", width: 14 },
      { key: "credit", label: "Crédit", align: "right", kind: "amount", width: 14 }
    ],
    rows: [],
    footer: "PERFECTO Négoce Abidjan · Exercice 2026 · montants en XOF."
  };
}

/** Texte d'un flux PDF : décompresse les `stream` et rend leur contenu lisible. */
export function pdfContent(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const latin = raw.toString("latin1");
  const chunks: string[] = [];
  const pattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match = pattern.exec(latin);
  while (match !== null) {
    const body = Buffer.from(match[1]!, "latin1");
    try {
      chunks.push(inflateSync(body).toString("latin1"));
    } catch {
      chunks.push(body.toString("latin1"));
    }
    match = pattern.exec(latin);
  }
  return chunks.join("\n");
}

/** Chaînes dessinées par jsPDF (`(texte) Tj`), parenthèses échappées rétablies. */
export function pdfTexts(bytes: Uint8Array): string[] {
  const content = pdfContent(bytes);
  return [...content.matchAll(/\(((?:\\.|[^\\()])*)\)\s*Tj/g)].map((match) =>
    match[1]!.replace(/\\([()\\])/g, "$1")
  );
}

/**
 * Nombre de pages d'un PDF produit par jsPDF.
 *
 * Les dictionnaires de page ne sont pas dans un flux compressé : on compte dans le
 * fichier entier, pas seulement dans les `stream` décompressés par {@link pdfContent}.
 */
export function pdfPageCount(bytes: Uint8Array): number {
  const raw = Buffer.from(bytes).toString("latin1");
  return (raw.match(/\/Type\s*\/Page\b(?!s)/g) ?? []).length;
}

/** Dimensions de la première page, en points : utile pour vérifier l'orientation. */
export function pdfMediaBox(bytes: Uint8Array): [number, number] | null {
  const raw = Buffer.from(bytes).toString("latin1");
  const match = /\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(raw);
  if (!match) return null;
  return [Number(match[3]), Number(match[4])];
}
