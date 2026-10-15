/**
 * Contrats d'échange UI / noyau / API.
 * Portage TypeScript de Perfecto.Contracts/Accounting/AccountingContracts.cs.
 *
 * Décisions « meilleure version » :
 *  - les statuts sont des unions typées (`EntryStatus`), plus des chaînes françaises
 *    comparées à la main ; les libellés affichés viennent de `entryStatusLabel` ;
 *  - chaque agrégat comptable porte son `organizationId` (cloisonnement multi-sociétés) ;
 *  - les montants voyagent en chaînes décimales exactes (`amountToDecimal`), jamais en
 *    flottants JSON.
 */

import type {
  AccountingEntryStatus,
  CivilDate,
  OrganizationProfile,
  OrganizationProfileInput,
  ThirdPartyData,
  ThirdPartyType
} from "@perfecto/domain";

export type EntryStatus = AccountingEntryStatus;
export type { ThirdPartyData as ThirdPartyDto, ThirdPartyType };

export interface GeneralAccountDto {
  code: string;
  label: string;
  accountClass: string;
  accountType: string;
  allowsPosting: boolean;
  requiresThirdParty: boolean;
  isActive: boolean;
}

export interface AccountingJournalDto {
  code: string;
  label: string;
  journalType: string;
  counterpartAccount: string | null;
  isActive: boolean;
}

export interface AccountingEntryLineDto {
  id: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  /** Montant décimal exact (chaîne), unités minoritaires sérialisées. */
  debit: string;
  credit: string;
  /** Tiers rattaché à la ligne (comptes auxiliaires), `null` sinon. */
  thirdPartyCode: string | null;
  thirdPartyName: string | null;
}

export interface AccountingEntryDto {
  id: string;
  organizationId: string;
  fiscalYearId: string;
  /** Numéro automatique attribué par le noyau : `JOURNAL-AAAA-NNNN`. */
  number: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description: string;
  status: EntryStatus;
  totalDebit: string;
  totalCredit: string;
  createdAt: string;
  updatedAt: string | null;
  postedAt: string | null;
  /** Date de contre-passation, `null` si la pièce n'a pas été extournée. */
  reversedAt: string | null;
  /** Pièce d'origine lorsque celle-ci est une extourne. */
  reversalOfEntryId: string | null;
  reversalOfNumber: string | null;
  /** Pièce d'extourne lorsque celle-ci a été contre-passée. */
  reversedByEntryId: string | null;
  reversedByNumber: string | null;
  /** Nombre de justificatifs rattachés. */
  attachmentCount: number;
  lines: AccountingEntryLineDto[];
}

export interface TrialBalanceLineDto {
  accountCode: string;
  accountLabel: string;
  debitMovements: string;
  creditMovements: string;
  debitBalance: string;
  creditBalance: string;
}

export interface JournalLineDto {
  entryDate: CivilDate;
  journalCode: string;
  entryNumber: string;
  reference: string;
  accountCode: string;
  accountLabel: string;
  label: string;
  debit: string;
  credit: string;
  thirdPartyCode: string | null;
}

export interface LedgerLineDto {
  entryDate: CivilDate;
  journalCode: string;
  entryNumber: string;
  reference: string;
  label: string;
  debit: string;
  credit: string;
  thirdPartyCode: string | null;
  runningBalance: string;
}

export interface LedgerAccountDto {
  accountCode: string;
  accountLabel: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: LedgerLineDto[];
}

export interface AccountingPeriodDto {
  year: number;
  month: number;
  label: string;
  isClosed: boolean;
  closedAt: string | null;
}

export interface AccountingSnapshot {
  organizationId: string;
  accountCount: number;
  journalCount: number;
  thirdPartyCount: number;
  draftEntryCount: number;
  postedEntryCount: number;
  reversedEntryCount: number;
  attachmentCount: number;
  reconciliationCount: number;
  totalDebitMovements: string;
  totalCreditMovements: string;
  recentEntries: AccountingEntryDto[];
  trialBalance: TrialBalanceLineDto[];
  storageMode: string;
}

/* ---------------------------- Tiers ---------------------------- */

/** Fiche tiers telle que stockée : le domaine ({@link ThirdPartyData}) fait foi. */
export interface ThirdPartyUsageDto extends ThirdPartyData {
  /** Nombre de lignes de pièces rattachées à ce tiers (brouillons compris). */
  lineCount: number;
  /** Nombre de lignes issues de pièces VALIDÉES : verrouille la suppression. */
  postedLineCount: number;
  totalDebit: string;
  totalCredit: string;
  /** Solde débiteur net (débit − crédit) des pièces validées, en décimal exact. */
  netBalance: string;
}

export interface CreateThirdPartyRequest {
  organizationId: string;
  /** Laisser vide pour que le noyau propose le code suivant du type (FOU007…). */
  code?: string | undefined;
  name: string;
  type: ThirdPartyType | string;
  taxIdentifier?: string | null | undefined;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  email?: string | null | undefined;
  notes?: string | null | undefined;
}

export interface UpdateThirdPartyRequest {
  organizationId: string;
  name: string;
  type: ThirdPartyType | string;
  taxIdentifier?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null | undefined;
  isActive?: boolean | undefined;
}

export interface ThirdPartyStatementLineDto {
  /** Identifiant de la ligne : sert à la sélection pour le lettrage. */
  lineId: string;
  entryId: string;
  entryDate: CivilDate;
  entryNumber: string;
  journalCode: string;
  reference: string;
  accountCode: string;
  label: string;
  debit: string;
  credit: string;
  runningBalance: string;
  /** Lettre de rapprochement, `null` si le mouvement n'est pas lettré. */
  reconciliationLabel: string | null;
  reconciliationId: string | null;
}

export interface ReconciliationDto {
  id: string;
  label: string;
  scope: string;
  key: string;
  keyLabel: string;
  lineIds: string[];
  totalDebit: string;
  totalCredit: string;
  comment: string;
  createdAt: string;
  createdBy: string;
}

export interface ThirdPartyStatementDto {
  thirdParty: ThirdPartyUsageDto;
  lines: ThirdPartyStatementLineDto[];
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  reconciliations: ReconciliationDto[];
  letteredLineCount: number;
  unletteredLineCount: number;
  /** Solde des mouvements non lettrés : reste à rapprocher ou à relancer. */
  unreconciledBalance: string;
}

/* ------------------------- Justificatifs ------------------------- */

export type AttachmentDto = import("@perfecto/domain").AttachmentData;

export interface AttachDocumentRequest {
  organizationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Contenu binaire : haché par le noyau, stocké par l'hôte, jamais sérialisé. */
  bytes: Uint8Array;
  notes?: string | null | undefined;
}

/* ---------------------------- Audit ---------------------------- */

export interface AuditEventDto {
  /** Rang d'écriture : ordre fiable même à horodatage identique. */
  sequence: number;
  id: string;
  organizationId: string;
  actor: string;
  action: string;
  /** Libellé français de l'action, prêt à afficher. */
  actionLabel: string;
  entityType: string;
  entityId: string;
  /** Horodatage ISO 8601. */
  occurredAt: string;
  details: string;
}

/** Libellés français des actions tracées par le noyau. */
export const auditActionLabels: Record<string, string> = {
  "accounting.entry.saved": "Pièce enregistrée en brouillon",
  "accounting.entry.updated": "Brouillon modifié",
  "accounting.entry.posted": "Pièce validée",
  "accounting.entry.reversed": "Pièce extournée",
  "accounting.entry.reversal": "Contre-passation créée",
  "accounting.attachment.added": "Justificatif rattaché",
  "accounting.attachment.removed": "Justificatif détaché",
  "accounting.reconciliation.created": "Lettrage créé",
  "accounting.reconciliation.cancelled": "Lettrage annulé",
  "accounting.account.created": "Compte général créé",
  "accounting.period.closed": "Période clôturée",
  "accounting.period.reopened": "Période rouverte",
  "accounting.thirdparty.created": "Fiche tiers créée",
  "accounting.thirdparty.updated": "Fiche tiers modifiée",
  "accounting.thirdparty.deactivated": "Tiers désactivé",
  "accounting.thirdparty.reactivated": "Tiers réactivé",
  "accounting.organization.updated": "Identité de la société mise à jour"
};

export function auditActionLabel(action: string): string {
  return auditActionLabels[action] ?? action;
}

/* ------------------------ Numérotation ------------------------ */

/** État de la séquence d'un journal pour l'exercice courant. */
export interface JournalNumberingDto {
  journalCode: string;
  journalLabel: string;
  lastNumber: number;
  /** Numéro qui sera attribué à la prochaine pièce de ce journal. */
  nextNumber: string;
}

/* ---------------------------- Entrées ---------------------------- */

/** Montant accepté en entrée : chaîne décimale ou number (converti au plus pair). */
export type AmountInput = string | number;

export interface AccountingEntryLineInput {
  accountCode: string;
  label: string;
  debit: AmountInput;
  credit: AmountInput;
  /** Tiers obligatoire si le compte est auxiliaire (`requiresThirdParty`). */
  thirdPartyCode?: string | null | undefined;
}

export interface CreateAccountingEntryRequest {
  organizationId: string;
  journalCode: string;
  entryDate: CivilDate;
  reference: string;
  description?: string | undefined;
  postImmediately: boolean;
  lines: AccountingEntryLineInput[];
}

/**
 * Révision d'un BROUILLON. Le journal et le numéro ne se changent jamais :
 * déplacer une pièce d'un journal casserait la continuité de sa séquence.
 * Une pièce validée est refusée (immutabilité), la correction passe par l'extourne.
 */
export interface UpdateAccountingEntryRequest {
  organizationId: string;
  entryDate: CivilDate;
  reference: string;
  description?: string | undefined;
  /** `true` pour enchaîner révision puis validation dans la même transaction. */
  postImmediately?: boolean | undefined;
  lines: AccountingEntryLineInput[];
}

/**
 * Contre-passation d'une pièce validée : le noyau crée la pièce inverse
 * (débits et crédits permutés), la valide, et marque l'origine comme extournée.
 * La pièce d'origine n'est jamais modifiée.
 */
export interface ReverseAccountingEntryRequest {
  organizationId: string;
  /** Date de la contre-passation ; la période correspondante doit être ouverte. */
  reversalDate: CivilDate;
  /** Référence proposée ; à défaut le noyau génère `EXT-<référence d'origine>`. */
  reference?: string | undefined;
  description?: string | undefined;
}

/** Résultat d'une contre-passation : l'origine marquée extournée et son inverse. */
export interface ReversalResultDto {
  original: AccountingEntryDto;
  reversal: AccountingEntryDto;
}

export interface ReconcileThirdPartyRequest {
  organizationId: string;
  thirdPartyCode: string;
  /** Identifiants des lignes à rapprocher (au moins deux, totaux égaux). */
  lineIds: string[];
  comment?: string | null | undefined;
}

export interface CreateGeneralAccountRequest {
  organizationId: string;
  code: string;
  label: string;
  accountType?: string | undefined;
  requiresThirdParty?: boolean | undefined;
}

/* ------------------------ Société ------------------------ */

/** Mise à jour de l'identité imprimée ; les champs absents conservent leur valeur. */
export interface UpdateOrganizationRequest extends OrganizationProfileInput {
  organizationId: string;
}

/* ------------------------ Éditions et exports ------------------------ */

/**
 * Formats de sortie proposés à l'utilisateur.
 *
 * Décision du 14/10/2026 : **tous les documents sortent en PDF, en Excel et en CSV**,
 * au choix de l'utilisateur — jamais un format unique imposé. Les trois rendus partagent
 * le même {@link ExportDocument}, donc exactement les mêmes chiffres et mentions.
 */
export const ExportFormat = {
  pdf: "pdf",
  excel: "excel",
  csv: "csv"
} as const;

export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

/** Libellé long : ce à quoi sert chaque format, affiché en infobulle. */
export const exportFormatLabels: Record<ExportFormat, string> = {
  pdf: "PDF — impression et archive",
  excel: "Excel (.xlsx) — calculable",
  csv: "CSV (;) — échange de données"
};

/** Libellé court pour les boutons ; le libellé long sert d'infobulle. */
export const exportFormatShortLabels: Record<ExportFormat, string> = {
  pdf: "PDF",
  excel: "Excel",
  csv: "CSV"
};

export const exportFormatExtensions: Record<ExportFormat, string> = {
  pdf: "pdf",
  excel: "xlsx",
  csv: "csv"
};

export const exportMimeTypes: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv;charset=utf-8"
};

/** Documents éditables, reprise du menu « Éditions » de PERFECTO WinDev. */
export const DocumentKind = {
  journal: "journal",
  generalLedger: "general-ledger",
  trialBalance: "trial-balance",
  entry: "entry",
  thirdPartyStatement: "third-party-statement",
  chartOfAccounts: "chart-of-accounts",
  thirdParties: "third-parties",
  auditTrail: "audit-trail"
} as const;

export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

export const documentKindLabels: Record<DocumentKind, string> = {
  journal: "Journal des écritures",
  "general-ledger": "Grand livre",
  "trial-balance": "Balance générale",
  entry: "Pièce comptable",
  "third-party-statement": "Relevé auxiliaire",
  "chart-of-accounts": "Plan comptable",
  "third-parties": "Fichier des tiers",
  "audit-trail": "Piste d'audit"
};

export type ExportColumnAlign = "left" | "right" | "center";

/** Nature de la colonne : pilote l'alignement, le format de cellule et le type CSV. */
export type ExportColumnKind = "text" | "amount" | "date" | "number";

export interface ExportColumn {
  key: string;
  label: string;
  align: ExportColumnAlign;
  kind: ExportColumnKind;
  /** Largeur indicative en caractères ; les rendus la convertissent dans leur unité. */
  width?: number | undefined;
}

/**
 * Cellule à double face : `text` pour l'affichage français, `value` pour un tableur
 * (nombre exact, date ISO). Un export CSV ou Excel reste ainsi calculable sans
 * réinterpréter du texte formaté.
 */
export interface ExportCell {
  text: string;
  value?: number | string | null | undefined;
}

/** Ligne d'identité du document (« Journal », « Période », « Arrêté au »…). */
export interface ExportField {
  label: string;
  text: string;
}

export type ExportRowEmphasis = "section" | "total";

export interface ExportRow {
  cells: ExportCell[];
  emphasis?: ExportRowEmphasis | undefined;
}

/**
 * Modèle neutre de document : le noyau le construit, les moteurs de rendu le mettent en
 * forme. Aucun des trois formats ne recalcule quoi que ce soit.
 */
export interface ExportDocument {
  kind: DocumentKind;
  title: string;
  subtitle: string;
  organization: OrganizationProfile;
  organizationId: string;
  /** « Exercice 2026 » — libellé déjà composé pour l'impression. */
  fiscalYear: string;
  currency: string;
  /** Horodatage ISO de la génération. */
  generatedAt: string;
  generatedBy: string;
  /** Racine du nom de fichier, sans extension. */
  slug: string;
  fields: ExportField[];
  columns: ExportColumn[];
  rows: ExportRow[];
  totals?: ExportRow | undefined;
  footer: string;
}

export interface ExportedFile {
  fileName: string;
  mimeType: string;
  format: ExportFormat;
  sizeBytes: number;
  bytes: Uint8Array;
}

/** Demande d'édition : le document voulu et ses filtres, toujours bornés à la société. */
export interface ExportDocumentRequest {
  organizationId: string;
  kind: DocumentKind;
  journalCode?: string | undefined;
  accountCode?: string | undefined;
  thirdPartyCode?: string | undefined;
  entryId?: string | undefined;
  from?: CivilDate | undefined;
  to?: CivilDate | undefined;
  /** Filtres de la piste d'audit. */
  entityType?: string | undefined;
  entityId?: string | undefined;
  limit?: number | undefined;
}
