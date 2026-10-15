/**
 * Noyau transactionnel de la comptabilité générale.
 *
 * Une SEULE implémentation des règles métier, quel que soit l'hôte (PWA, desktop,
 * API) : les adaptateurs ne fournissent que le {@link StoragePort}. La validation
 * d'une pièce repasse TOUJOURS par l'agrégat {@link AccountingEntry}, ce qui rend
 * l'immutabilité et l'équilibre réellement garanties sur tous les chemins
 * (défaut n°3 de l'analyse de l'existant C#).
 *
 * Tranche 2 :
 *  - numérotation automatique `JOURNAL-AAAA-NNNN`, séquence par journal + exercice,
 *    attribuée en fin de transaction : une pièce refusée ne consomme aucun numéro ;
 *  - révision contrôlée des BROUILLONS (les pièces validées restent immuables) ;
 *  - fichier unique des tiers et contrôle EFFECTIF de `requiresThirdParty` à la
 *    saisie, à la révision et à la validation.
 */

import type {
  AccountingEntryDto,
  AccountingEntryLineDto,
  AccountingJournalDto,
  AccountingPeriodDto,
  AccountingSnapshot,
  AttachmentDto,
  AttachDocumentRequest,
  AuditEventDto,
  CreateAccountingEntryRequest,
  CreateGeneralAccountRequest,
  AccountingEntryLineInput,
  CreateThirdPartyRequest,
  GeneralAccountDto,
  JournalNumberingDto,
  ReconciliationDto,
  ReconcileThirdPartyRequest,
  ReverseAccountingEntryRequest,
  ReversalResultDto,
  ThirdPartyDto,
  ThirdPartyStatementDto,
  ThirdPartyUsageDto,
  UpdateAccountingEntryRequest,
  UpdateOrganizationRequest,
  DossierContextDto,
  ExportDocument,
  ExportDocumentRequest,
  UpdateThirdPartyRequest
} from "@perfecto/contracts";
import { auditActionLabel } from "@perfecto/contracts";
import {
  AMOUNT_ZERO,
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  ReconciliationScope,
  allocateEntryNumber,
  amountAdd,
  amountFromDecimal,
  amountToDecimal,
  civilDate,
  civilMonth,
  civilYear,
  formatCivilDateFr,
  assertAttachmentSize,
  createAttachment,
  createThirdParty,
  normalizeOrganizationProfile,
  type OrganizationProfile,
  formatByteSize,
  nextReconciliationLabel,
  normalizeMimeType,
  parseThirdPartyType,
  peekEntryNumber as peekEntryNumberFor,
  recordAuditEvent,
  shortFingerprint,
  suggestThirdPartyCode,
  thirdPartyIdentityKey,
  thirdPartyTypeLabel,
  updateThirdParty,
  validateReconcilableLines,
  type Amount,
  type EntryLineInput
} from "@perfecto/domain";
import {
  buildGeneralLedger,
  buildJournal,
  buildThirdPartyStatement,
  buildTrialBalance,
  countPostedLines,
  exerciseYear,
  postedEntries,
  reportableEntries,
  thirdPartyNames,
  thirdPartyUsage
} from "./reports";
import { EXPORT_CURRENCY, buildExportDocument } from "./export-documents";
import { activeModuleProfile, dossierCode } from "./catalog";
import { sha256Hex } from "./crypto";
import type {
  AccountingState,
  AttachmentBytesPort,
  AuditRecord,
  ReconciliationRecord,
  StoragePort,
  StoredEntry,
  StoredEntryLine
} from "./state";

export interface KernelOptions {
  clock?: () => Date;
  actor?: string;
  storageMode?: string;
  /**
   * Stockage des justificatifs. Sans lui, le noyau refuse le rattachement de
   * fichiers (il n'acceptera jamais d'enregistrer une empreinte dont le contenu
   * serait perdu) mais tout le reste fonctionne.
   */
  fileStorage?: AttachmentBytesPort | undefined;
}

export interface AuditLogQuery {
  /** Filtre sur une entité précise (identifiant de pièce, code tiers…). */
  entityId?: string | undefined;
  /** Filtre sur un type d'entité (`AccountingEntry`, `ThirdParty`…). */
  entityType?: string | undefined;
  /** Nombre maximum d'événements retournés, les plus récents d'abord. */
  limit?: number | undefined;
}

interface LineDraft {
  accountCode: string;
  label: string;
  debit: Amount;
  credit: Amount;
  thirdPartyCode: string | null;
}

export class AccountingKernel {
  readonly #storage: StoragePort;
  readonly #clock: () => Date;
  readonly #actor: string;
  readonly #storageMode: string;
  readonly #fileStorage: AttachmentBytesPort | null;
  #chain: Promise<unknown> = Promise.resolve();

  constructor(storage: StoragePort, options: KernelOptions = {}) {
    this.#storage = storage;
    this.#clock = options.clock ?? (() => new Date());
    this.#actor = options.actor ?? "utilisateur";
    this.#storageMode = options.storageMode ?? "Noyau partagé";
    this.#fileStorage = options.fileStorage ?? null;
  }

  /* --------------------------- Lectures --------------------------- */

  async getSnapshot(): Promise<AccountingSnapshot> {
    const state = await this.#storage.read();
    const balance = buildTrialBalance(state.accounts, state.entries);
    const totalDebit = balance.reduce((sum, line) => sum + amountFromDecimal(line.debitMovements), 0n);
    const totalCredit = balance.reduce((sum, line) => sum + amountFromDecimal(line.creditMovements), 0n);
    const posted = postedEntries(state.entries);
    const ctx = entryContext(state);

    return {
      organizationId: state.organizationId,
      accountCount: state.accounts.length,
      journalCount: state.journals.length,
      thirdPartyCount: state.thirdParties.length,
      draftEntryCount: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Draft).length,
      postedEntryCount: posted.length,
      reversedEntryCount: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Reversed).length,
      attachmentCount: state.attachments.length,
      reconciliationCount: state.reconciliations.length,
      totalDebitMovements: amountToDecimal(totalDebit),
      totalCreditMovements: amountToDecimal(totalCredit),
      recentEntries: sortEntries(state.entries).slice(0, 5).map((entry) => toEntryDto(entry, ctx)),
      trialBalance: balance,
      storageMode: this.#storageMode
    };
  }

  async getAccounts(search?: string): Promise<GeneralAccountDto[]> {
    const state = await this.#storage.read();
    const needle = search?.trim().toLowerCase();
    const query = needle
      ? state.accounts.filter(
          (account) =>
            account.code.toLowerCase().includes(needle) || account.label.toLowerCase().includes(needle)
        )
      : state.accounts;
    return query.slice().sort((left, right) => left.code.localeCompare(right.code));
  }

  async getJournals(): Promise<AccountingJournalDto[]> {
    const state = await this.#storage.read();
    return state.journals.slice().sort((left, right) => left.code.localeCompare(right.code));
  }

  async getEntries(): Promise<AccountingEntryDto[]> {
    const state = await this.#storage.read();
    return sortEntries(state.entries).map((entry) => toEntryDto(entry, entryContext(state)));
  }

  async getEntry(entryId: string): Promise<AccountingEntryDto> {
    const state = await this.#storage.read();
    const stored = state.entries.find((entry) => entry.id === entryId);
    if (!stored) {
      throw new DomainRuleError("La pièce demandée n'existe pas.");
    }
    return toEntryDto(stored, entryContext(state));
  }

  async getJournalLines() {
    const state = await this.#storage.read();
    return buildJournal(state.entries);
  }

  async getGeneralLedger() {
    const state = await this.#storage.read();
    return buildGeneralLedger(state.entries);
  }

  /* --------------------------- Dossier ouvert --------------------------- */

  /**
   * Contexte affiché en permanence par la coquille : module, société, dossier, période,
   * session, stockage et dernière modification tracée.
   *
   * Une seule lecture de l'état, donc un contexte impossible à recomposer à partir de
   * plusieurs versions des données.
   */
  async getDossierContext(): Promise<DossierContextDto> {
    const state = await this.#storage.read();
    const moduleProfile = activeModuleProfile();
    const profile = state.organization;

    const years = state.periods.map((period) => period.year);
    const fiscalYear = years.length > 0 ? Math.min(...years) : civilYear(this.#clock().toISOString().slice(0, 10));
    const yearPeriods = state.periods.filter((period) => period.year === fiscalYear);
    const months = yearPeriods.map((period) => period.month);
    const firstMonth = months.length > 0 ? Math.min(...months) : 1;
    const lastMonth = months.length > 0 ? Math.max(...months) : 12;
    const lastDay = new Date(Date.UTC(fiscalYear, lastMonth, 0)).getUTCDate();
    const periodFrom = civilDate(fiscalYear, firstMonth, 1);
    const periodTo = civilDate(fiscalYear, lastMonth, lastDay);

    const lastEvent = state.audit.at(-1) ?? null;

    return {
      dossierCode: dossierCode(moduleProfile.code, profile.code, fiscalYear),
      moduleCode: moduleProfile.code,
      moduleLabel: moduleProfile.label,
      referential: moduleProfile.referential,
      organizationId: state.organizationId,
      societyCode: profile.code,
      societyName: profile.name,
      currency: EXPORT_CURRENCY,
      fiscalYear,
      periodFrom,
      periodTo,
      periodLabel: `${formatCivilDateFr(periodFrom)} - ${formatCivilDateFr(periodTo)}`,
      closedPeriodCount: yearPeriods.filter((period) => period.isClosed).length,
      actor: this.#actor,
      storageMode: this.#storageMode,
      lastModifiedAt: lastEvent?.occurredAt ?? null,
      lastModifiedLabel: lastEvent ? auditActionLabel(lastEvent.action) : null,
      counts: {
        accounts: state.accounts.length,
        journals: state.journals.length,
        thirdParties: state.thirdParties.length,
        entries: state.entries.length,
        postedEntries: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Posted).length,
        draftEntries: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Draft).length,
        attachments: state.attachments.length,
        reconciliations: state.reconciliations.length,
        auditEvents: state.audit.length
      }
    };
  }

  /* ------------------------- Éditions et exports ------------------------- */

  /**
   * Document prêt à être mis en forme : le noyau en construit le contenu, les moteurs de
   * `@perfecto/exports` le rendent en PDF, en Excel ou en CSV au choix de l'utilisateur.
   *
   * Éditer un document ne modifie aucune donnée : la lecture n'est pas auditée (seuls les
   * actes de gestion le sont), mais elle est bornée à l'organisation de l'espace courant.
   */
  async getExportDocument(request: ExportDocumentRequest): Promise<ExportDocument> {
    const state = await this.#storage.read();
    this.#ensureOrganization(request.organizationId, state);
    return buildExportDocument(state, request, { now: this.#clock(), actor: this.#actor });
  }

  /* ------------------------------ Société ------------------------------ */

  /** Identité imprimée en en-tête et en pied de chaque document exporté. */
  async getOrganization(): Promise<OrganizationProfile> {
    const state = await this.#storage.read();
    return state.organization;
  }

  /**
   * Met à jour la fiche société.
   *
   * La normalisation passe par le domaine ({@link normalizeOrganizationProfile}) : espaces
   * superflus supprimés, IFU en majuscules, raison sociale obligatoire, courriel vérifié,
   * champs absents conservés. Le cadrage v2 prévoit qu'un abonnement expiré laisse au moins
   * la lecture et **l'export** — cette fiche conditionne donc la valeur légale des documents.
   */
  async updateOrganization(request: UpdateOrganizationRequest): Promise<OrganizationProfile> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      this.#ensureOrganization(request.organizationId, state);

      const previous = state.organization;
      const { organizationId: _organizationId, ...profile } = request;
      const updated = normalizeOrganizationProfile(profile, previous);
      state.organization = updated;

      this.#audit(
        state,
        now,
        "accounting.organization.updated",
        "Organization",
        state.organizationId,
        `${previous.name} -> ${updated.name} · IFU ${updated.taxIdentifier || "non renseigné"}`
      );
      await this.#storage.write(state);
      return updated;
    });
  }

  async getPeriods(): Promise<AccountingPeriodDto[]> {
    const state = await this.#storage.read();
    return state.periods.slice().sort((left, right) => left.month - right.month);
  }

  async getAudit(): Promise<AuditRecord[]> {
    const state = await this.#storage.read();
    return state.audit.slice();
  }

  /** Journal d'audit prêt à afficher : libellés français, plus récent en tête. */
  async getAuditLog(query: AuditLogQuery = {}): Promise<AuditEventDto[]> {
    const state = await this.#storage.read();
    const entityId = query.entityId?.trim();
    const entityType = query.entityType?.trim();
    const filtered = state.audit
      .filter((event) => (entityId ? event.entityId === entityId : true))
      .filter((event) => (entityType ? event.entityType === entityType : true))
      .map((event) => ({ ...event, actionLabel: auditActionLabel(event.action) }))
      .sort(
        (left, right) =>
          right.sequence - left.sequence ||
          right.occurredAt.localeCompare(left.occurredAt)
      );
    return query.limit && query.limit > 0 ? filtered.slice(0, query.limit) : filtered;
  }

  /* ---------------------- Numérotation ---------------------- */

  /** Séquence courante de chaque journal et numéro qui sera attribué ensuite. */
  async getJournalNumbering(): Promise<JournalNumberingDto[]> {
    const state = await this.#storage.read();
    const year = exerciseYear(state);
    return state.journals
      .slice()
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((journal) => {
        const sequence = state.entrySequences.find(
          (item) => item.journalCode.toUpperCase() === journal.code.toUpperCase()
        );
        return {
          journalCode: journal.code,
          journalLabel: journal.label,
          lastNumber: sequence?.lastNumber ?? 0,
          nextNumber: peekEntryNumberFor(state.entrySequences, journal.code, state.fiscalYearId, year)
        };
      });
  }

  /**
   * Numéro qui sera attribué à la prochaine pièce du journal, pour l'afficher
   * AVANT enregistrement. Lecture seule : aucun numéro n'est consommé.
   */
  async peekEntryNumber(journalCode: string, entryDate?: string): Promise<string> {
    const state = await this.#storage.read();
    if (!state.journals.some((journal) => journal.code.toLowerCase() === journalCode.trim().toLowerCase())) {
      throw new DomainRuleError("Le journal sélectionné n'existe pas.");
    }
    const year = entryDate ? civilYear(entryDate) : exerciseYear(state);
    return peekEntryNumberFor(state.entrySequences, journalCode, state.fiscalYearId, year);
  }

  /* --------------------------- Tiers --------------------------- */

  async getThirdParties(search?: string): Promise<ThirdPartyUsageDto[]> {
    const state = await this.#storage.read();
    return thirdPartyUsage(state, search);
  }

  async getThirdParty(code: string): Promise<ThirdPartyUsageDto> {
    const state = await this.#storage.read();
    const normalized = code.trim().toUpperCase();
    const usage = thirdPartyUsage(state).find((item) => item.code === normalized);
    if (!usage) {
      throw new DomainRuleError(`Le tiers ${normalized} n'existe pas.`);
    }
    return usage;
  }

  /**
   * Fiche tiers complète : coordonnées, relevé des mouvements comptabilisés,
   * lettres de rapprochement et solde non lettré (reste à relancer).
   */
  async getThirdPartyStatement(code: string): Promise<ThirdPartyStatementDto> {
    const state = await this.#storage.read();
    const thirdParty = await this.getThirdParty(code);
    const own = state.reconciliations.filter(
      (item) => item.scope === ReconciliationScope.ThirdParty && item.key === thirdParty.code
    );
    const lines = buildThirdPartyStatement(state.entries, thirdParty.code, own);

    const totalDebit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.debit)), AMOUNT_ZERO);
    const totalCredit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.credit)), AMOUNT_ZERO);
    const unreconciled = lines
      .filter((line) => line.reconciliationLabel === null)
      .reduce(
        (sum, line) => amountAdd(sum, amountFromDecimal(line.debit) - amountFromDecimal(line.credit)),
        AMOUNT_ZERO
      );

    return {
      thirdParty,
      lines,
      totalDebit: amountToDecimal(totalDebit),
      totalCredit: amountToDecimal(totalCredit),
      closingBalance: amountToDecimal(totalDebit - totalCredit),
      reconciliations: own
        .slice()
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((item) => toReconciliationDto(item, thirdParty.name)),
      letteredLineCount: lines.filter((line) => line.reconciliationLabel !== null).length,
      unletteredLineCount: lines.filter((line) => line.reconciliationLabel === null).length,
      unreconciledBalance: amountToDecimal(unreconciled)
    };
  }

  /* ------------------------- Lettrage / rapprochement ------------------------- */

  async getReconciliations(thirdPartyCode?: string): Promise<ReconciliationDto[]> {
    const state = await this.#storage.read();
    const key = thirdPartyCode?.trim().toUpperCase();
    const names = thirdPartyNames(state);
    return state.reconciliations
      .filter((item) => (key ? item.key === key : true))
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((item) => toReconciliationDto(item, names.get(item.key) ?? item.key));
  }

  /**
   * Rapproche des mouvements d'un même tiers et leur attribue la lettre suivante.
   * Règles : au moins deux mouvements, totaux débit/crédit égaux, mouvements du
   * tiers, non déjà lettrés, issus de pièces comptabilisées.
   */
  async reconcileThirdParty(request: ReconcileThirdPartyRequest): Promise<ReconciliationDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();
      const tier = this.#findThirdParty(state, request.thirdPartyCode);

      const wanted = new Set(request.lineIds.map((id) => id.trim()));
      if (wanted.size < 2) {
        throw new DomainRuleError("Un lettrage doit rapprocher au moins deux mouvements.");
      }

      const candidates = new Map<string, StoredEntryLine>();
      for (const entry of reportableEntries(state.entries)) {
        for (const line of entry.lines) {
          if ((line.thirdPartyCode ?? "").toUpperCase() === tier.code.toUpperCase()) {
            candidates.set(line.id, line);
          }
        }
      }
      for (const lineId of wanted) {
        if (!candidates.has(lineId)) {
          throw new DomainRuleError(
            "Le mouvement sélectionné n'appartient pas au relevé comptabilisé de ce tiers."
          );
        }
      }

      const already = state.reconciliations.find((item) => item.lineIds.some((id) => wanted.has(id)));
      if (already) {
        throw new DomainRuleError(
          `Un des mouvements sélectionnés est déjà lettré (lettre ${already.label}). Annulez ce lettrage avant de le refaire.`
        );
      }

      const selected = [...wanted].map((id) => candidates.get(id)!);
      const totals = validateReconcilableLines(selected);

      const label = nextReconciliationLabel(
        state.reconciliations
          .filter((item) => item.scope === ReconciliationScope.ThirdParty && item.key === tier.code)
          .map((item) => item.label)
      );
      const record: ReconciliationRecord = {
        id: crypto.randomUUID(),
        organizationId: state.organizationId,
        label,
        scope: ReconciliationScope.ThirdParty,
        key: tier.code,
        lineIds: [...wanted],
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        comment: request.comment?.trim() ?? "",
        createdAt: now.toISOString(),
        createdBy: this.#actor
      };
      state.reconciliations.push(record);
      this.#audit(
        state,
        now,
        "accounting.reconciliation.created",
        "ThirdParty",
        tier.code,
        `Lettre ${label} · ${record.lineIds.length} mouvement(s) · ${amountToDecimal(totals.totalDebit)}`
      );
      await this.#storage.write(state);
      return toReconciliationDto(record, tier.name);
    });
  }

  /** Annule un lettrage : les mouvements redeviennent disponibles, l'acte est tracé. */
  async cancelReconciliation(reconciliationId: string): Promise<void> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      const record = state.reconciliations.find((item) => item.id === reconciliationId);
      if (!record) {
        throw new DomainRuleError("Le lettrage demandé n'existe pas.");
      }
      state.reconciliations = state.reconciliations.filter((item) => item.id !== reconciliationId);
      this.#audit(
        state,
        now,
        "accounting.reconciliation.cancelled",
        "ThirdParty",
        record.key,
        `Lettre ${record.label} · ${record.lineIds.length} mouvement(s)`
      );
      await this.#storage.write(state);
    });
  }

  /* --------------------------- Justificatifs --------------------------- */

  async getAttachments(entryId: string): Promise<AttachmentDto[]> {
    const state = await this.#storage.read();
    return state.attachments
      .filter((item) => item.entryId === entryId)
      .slice()
      .sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));
  }

  /**
   * Rattache un justificatif à une pièce : l'empreinte SHA-256 est calculée par
   * le noyau, les octets vont au stockage contrôlé de l'hôte, la métadonnée est
   * tracée dans l'état comptable. Un même fichier ne peut pas être rattaché
   * deux fois à la même pièce.
   */
  async attachDocument(entryId: string, request: AttachDocumentRequest): Promise<AttachmentDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const entry = state.entries.find((item) => item.id === entryId);
      if (!entry) {
        throw new DomainRuleError("La pièce demandée n'existe pas.");
      }
      this.#ensureOrganization(request.organizationId, state);
      if (!this.#fileStorage) {
        throw new DomainRuleError(
          "Aucun stockage de fichiers n'est disponible sur cet hôte : le justificatif ne peut pas être conservé."
        );
      }
      // Les métadonnées sont contrôlées AVANT le hachage : un type refusé ou une
      // taille hors bornes ne mérite pas un calcul d'empreinte (jusqu'à 15 Mo).
      normalizeMimeType(request.mimeType);
      assertAttachmentSize(request.sizeBytes);
      if (request.bytes.byteLength !== request.sizeBytes) {
        throw new DomainRuleError("La taille déclarée ne correspond pas au contenu transmis.");
      }
      const now = this.#clock();
      const sha256 = await sha256Hex(request.bytes);
      const duplicate = state.attachments.find((item) => item.entryId === entryId && item.sha256 === sha256);
      if (duplicate) {
        throw new DomainRuleError(
          `Ce fichier est déjà rattaché à la pièce : ${duplicate.fileName} (empreinte identique).`
        );
      }

      const attachment = createAttachment({
        organizationId: state.organizationId,
        entryId,
        fileName: request.fileName,
        mimeType: request.mimeType,
        sizeBytes: request.sizeBytes,
        sha256,
        notes: request.notes ?? null,
        uploadedAt: now.toISOString(),
        uploadedBy: this.#actor
      });

      await this.#fileStorage.put(attachment.id, request.bytes, attachment.mimeType);
      state.attachments.push(attachment);
      this.#audit(
        state,
        now,
        "accounting.attachment.added",
        "AccountingEntry",
        entryId,
        `${entry.number} · ${attachment.fileName} · ${formatByteSize(attachment.sizeBytes)} · ${shortFingerprint(
          attachment.sha256
        )}`
      );
      await this.#storage.write(state);
      return attachment;
    });
  }

  /** Contenu d'un justificatif, pour consultation ou téléchargement. */
  async getAttachmentContent(attachmentId: string): Promise<{ attachment: AttachmentDto; bytes: Uint8Array }> {
    const state = await this.#storage.read();
    const attachment = state.attachments.find((item) => item.id === attachmentId);
    if (!attachment) {
      throw new DomainRuleError("Le justificatif demandé n'existe pas.");
    }
    if (!this.#fileStorage) {
      throw new DomainRuleError("Aucun stockage de fichiers n'est disponible sur cet hôte.");
    }
    const stored = await this.#fileStorage.get(attachmentId);
    if (!stored) {
      throw new DomainRuleError(
        `Le contenu du justificatif ${attachment.fileName} est introuvable dans le stockage local.`
      );
    }
    return { attachment, bytes: stored.bytes };
  }

  /** Détache un justificatif : métadonnée et contenu sont supprimés, l'acte est tracé. */
  async removeAttachment(attachmentId: string): Promise<void> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      const attachment = state.attachments.find((item) => item.id === attachmentId);
      if (!attachment) {
        throw new DomainRuleError("Le justificatif demandé n'existe pas.");
      }
      if (this.#fileStorage) {
        await this.#fileStorage.delete(attachmentId);
      }
      state.attachments = state.attachments.filter((item) => item.id !== attachmentId);
      this.#audit(
        state,
        now,
        "accounting.attachment.removed",
        "AccountingEntry",
        attachment.entryId,
        `${attachment.fileName} · ${shortFingerprint(attachment.sha256)}`
      );
      await this.#storage.write(state);
    });
  }

  /* --------------------------- Écritures -------------------------- */

  async saveEntry(request: CreateAccountingEntryRequest): Promise<AccountingEntryDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();

      this.#ensureJournalExists(state, request.journalCode);
      if (state.entries.some((entry) => entry.reference.toLowerCase() === request.reference.trim().toLowerCase())) {
        throw new DomainRuleError("Cette référence de pièce existe déjà.");
      }
      this.#ensurePeriodOpen(state, request.entryDate);

      const lines = this.#resolveLines(state, request.lines);
      const year = civilYear(request.entryDate);
      const allocated = allocateEntryNumber(state.entrySequences, request.journalCode, state.fiscalYearId, year);

      const entry = AccountingEntry.create({
        fiscalYearId: state.fiscalYearId,
        organizationId: state.organizationId,
        journalCode: request.journalCode,
        entryDate: request.entryDate,
        reference: request.reference,
        number: allocated.number,
        now
      });
      for (const line of lines) {
        entry.addLine(line.accountCode, line.label, line.debit, line.credit, line.thirdPartyCode, now);
      }
      if (request.postImmediately) {
        entry.post(now);
      }

      // La séquence n'est consommée qu'une fois toutes les règles respectées :
      // aucune pièce rejetée ne laisse de trou dans la numérotation du journal.
      state.entrySequences = [...allocated.sequences];
      const stored = toStoredEntry(entry, state, request.description ?? "");
      state.entries.push(stored);
      this.#audit(
        state,
        now,
        request.postImmediately ? "accounting.entry.posted" : "accounting.entry.saved",
        "AccountingEntry",
        stored.id,
        `${stored.number} · ${stored.reference}`
      );
      await this.#storage.write(state);
      return toEntryDto(stored, entryContext(state));
    });
  }

  /**
   * Révise un brouillon (en-tête et lignes). Toute pièce validée est refusée :
   * la correction d'une écriture validée passera par l'extourne (tranche 3).
   */
  async updateEntry(entryId: string, request: UpdateAccountingEntryRequest): Promise<AccountingEntryDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const stored = state.entries.find((entry) => entry.id === entryId);
      if (!stored) {
        throw new DomainRuleError("La pièce demandée n'existe pas.");
      }
      this.#ensureOrganization(request.organizationId, state);
      this.#ensureOrganization(stored.organizationId, state);
      const now = this.#clock();

      if (state.entries.some(
        (entry) => entry.id !== stored.id && entry.reference.toLowerCase() === request.reference.trim().toLowerCase()
      )) {
        throw new DomainRuleError("Cette référence de pièce existe déjà.");
      }
      this.#ensurePeriodOpen(state, request.entryDate);

      const lines = this.#resolveLines(state, request.lines);
      const aggregate = restoreAggregate(stored);
      aggregate.revise(
        {
          entryDate: request.entryDate,
          reference: request.reference,
          lines: lines.map((line): EntryLineInput => ({ ...line }))
        },
        now
      );
      if (request.postImmediately ?? false) {
        aggregate.post(now);
      }

      stored.entryDate = aggregate.entryDate;
      stored.reference = aggregate.reference;
      stored.description = request.description?.trim() || aggregate.lines[0]?.label || stored.description;
      stored.lines = toStoredLines(aggregate, state);
      stored.status = aggregate.status;
      stored.updatedAt = aggregate.updatedAt.toISOString();
      stored.postedAt = aggregate.postedAt ? aggregate.postedAt.toISOString() : null;

      this.#audit(
        state,
        now,
        "accounting.entry.updated",
        "AccountingEntry",
        stored.id,
        `${stored.number} · ${stored.lines.length} ligne(s) · total ${amountToDecimal(aggregate.totalDebit)}`
      );
      if (request.postImmediately ?? false) {
        this.#audit(state, now, "accounting.entry.posted", "AccountingEntry", stored.id, `${stored.number} · ${stored.reference}`);
      }
      await this.#storage.write(state);
      return toEntryDto(stored, entryContext(state));
    });
  }

  async postEntry(entryId: string): Promise<AccountingEntryDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      const stored = state.entries.find((entry) => entry.id === entryId);
      if (!stored) {
        throw new DomainRuleError("La pièce demandée n'existe pas.");
      }
      if (stored.status === AccountingEntryStatus.Posted) {
        return toEntryDto(stored, entryContext(state));
      }
      this.#ensureOrganization(stored.organizationId, state);
      this.#ensurePeriodOpen(state, stored.entryDate);

      // Repasse par l'agrégat : équilibre, nombre de lignes, tiers obligatoires
      // et immutabilité sont garantis par le domaine, pas par une copie de règles.
      this.#ensureStoredLinesValid(state, stored.lines);
      const aggregate = restoreAggregate(stored);
      aggregate.post(now);

      stored.status = AccountingEntryStatus.Posted;
      stored.postedAt = now.toISOString();
      stored.updatedAt = now.toISOString();
      this.#audit(state, now, "accounting.entry.posted", "AccountingEntry", stored.id, `${stored.number} · ${stored.reference}`);
      await this.#storage.write(state);
      return toEntryDto(stored, entryContext(state));
    });
  }

  /**
   * Contre-passe une pièce validée : crée la pièce inverse (débits et crédits
   * permutés, mêmes comptes et mêmes tiers), la valide, puis marque l'origine
   * comme extournée. Les deux pièces restent dans les livres : leur somme est
   * nulle, l'histoire comptable est préservée.
   */
  async reverseEntry(entryId: string, request: ReverseAccountingEntryRequest): Promise<ReversalResultDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const original = state.entries.find((entry) => entry.id === entryId);
      if (!original) {
        throw new DomainRuleError("La pièce demandée n'existe pas.");
      }
      this.#ensureOrganization(request.organizationId, state);
      this.#ensureOrganization(original.organizationId, state);
      const now = this.#clock();

      if (original.status === AccountingEntryStatus.Reversed) {
        const previous = state.entries.find((entry) => entry.id === original.reversedByEntryId);
        throw new DomainRuleError(
          `Cette pièce a déjà été extournée par ${previous?.number ?? "une autre pièce"}.`
        );
      }
      if (original.status !== AccountingEntryStatus.Posted) {
        throw new DomainRuleError(
          "Seule une pièce validée peut être extournée. Corrigez le brouillon avant validation."
        );
      }
      this.#ensurePeriodOpen(state, request.reversalDate);

      // Un tiers désactivé depuis ne bloque pas la contre-passation : on corrige
      // une écriture passée, on n'ouvre pas de nouvel engagement.
      const resolved = this.#resolveLines(
        state,
        original.lines.map((line) => ({
          accountCode: line.accountCode,
          label: line.label,
          debit: amountToDecimal(line.credit),
          credit: amountToDecimal(line.debit),
          thirdPartyCode: line.thirdPartyCode
        })),
        { allowInactiveThirdParty: true }
      );

      const reference = this.#reversalReference(state, original.reference, request.reference);
      const allocated = allocateEntryNumber(
        state.entrySequences,
        original.journalCode,
        state.fiscalYearId,
        civilYear(request.reversalDate)
      );

      const reversal = AccountingEntry.create({
        fiscalYearId: state.fiscalYearId,
        organizationId: state.organizationId,
        journalCode: original.journalCode,
        entryDate: request.reversalDate,
        reference,
        number: allocated.number,
        now
      });
      for (const line of resolved) {
        reversal.addLine(line.accountCode, line.label, line.debit, line.credit, line.thirdPartyCode, now);
      }
      reversal.post(now);

      // L'origine repasse par l'agrégat : le domaine refuse une double extourne.
      restoreAggregate(original).markReversed(now);

      state.entrySequences = [...allocated.sequences];
      const storedReversal = toStoredEntry(
        reversal,
        state,
        request.description?.trim() || `Extourne de ${original.number} (${original.reference})`
      );
      storedReversal.reversalOfEntryId = original.id;
      state.entries.push(storedReversal);

      original.status = AccountingEntryStatus.Reversed;
      original.reversedAt = now.toISOString();
      original.reversedByEntryId = storedReversal.id;
      original.updatedAt = now.toISOString();

      this.#audit(
        state,
        now,
        "accounting.entry.reversal",
        "AccountingEntry",
        storedReversal.id,
        `${storedReversal.number} · contre-passation de ${original.number}`
      );
      this.#audit(
        state,
        now,
        "accounting.entry.reversed",
        "AccountingEntry",
        original.id,
        `${original.number} · extournée par ${storedReversal.number}`
      );
      await this.#storage.write(state);

      const ctx = entryContext(state);
      return {
        original: toEntryDto(original, ctx),
        reversal: toEntryDto(storedReversal, ctx)
      };
    });
  }

  async createAccount(request: CreateGeneralAccountRequest): Promise<GeneralAccountDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();

      const code = request.code.trim();
      if (code.length < 2 || code.length > 12 || code.split("").some((character) => !/\d/.test(character))) {
        throw new DomainRuleError("Le numéro de compte doit contenir entre 2 et 12 chiffres.");
      }
      if (!request.label.trim()) {
        throw new DomainRuleError("L'intitulé du compte est obligatoire.");
      }
      if (state.accounts.some((account) => account.code === code)) {
        throw new DomainRuleError("Ce numéro de compte existe déjà.");
      }

      const account: GeneralAccountDto = {
        code,
        label: request.label.trim(),
        accountClass: code.slice(0, 1),
        accountType: request.accountType?.trim() || "Général",
        allowsPosting: true,
        requiresThirdParty: request.requiresThirdParty ?? false,
        isActive: true
      };
      state.accounts.push(account);
      this.#audit(state, now, "accounting.account.created", "GeneralAccount", code, account.label);
      await this.#storage.write(state);
      return account;
    });
  }

  async createThirdParty(request: CreateThirdPartyRequest): Promise<ThirdPartyDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();

      const code = request.code?.trim()
        ? request.code.trim().toUpperCase()
        : suggestThirdPartyCode(
            parseTypeOrThrow(request.type),
            state.thirdParties.map((item) => item.code)
          );
      if (state.thirdParties.some((item) => item.code.toUpperCase() === code.toUpperCase())) {
        const existing = state.thirdParties.find((item) => item.code.toUpperCase() === code.toUpperCase());
        throw new DomainRuleError(`Ce code tiers existe déjà : ${existing?.name ?? code} (${code}).`);
      }
      this.#ensureThirdPartyIdentityFree(state, request.name, request.type, null);

      const created = createThirdParty({ ...request, code, now });
      state.thirdParties.push(created);
      this.#audit(
        state,
        now,
        "accounting.thirdparty.created",
        "ThirdParty",
        created.code,
        `${created.name} · ${thirdPartyTypeLabel[created.type]}`
      );
      await this.#storage.write(state);
      return created;
    });
  }

  async updateThirdParty(code: string, request: UpdateThirdPartyRequest): Promise<ThirdPartyDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();
      const existing = this.#findThirdParty(state, code);

      const type = parseTypeOrThrow(request.type);
      if (type !== existing.type) {
        const posted = countPostedLines(state, existing.code);
        if (posted > 0) {
          throw new DomainRuleError(
            `Le tiers ${existing.code} est utilisé par ${posted} ligne(s) validée(s) : son type ne peut plus être modifié.`
          );
        }
      }
      this.#ensureThirdPartyIdentityFree(state, request.name, request.type, existing.code);

      const revised = updateThirdParty(existing, {
        ...request,
        code: existing.code,
        type,
        isActive: request.isActive ?? existing.isActive,
        createdAt: existing.createdAt,
        now
      });
      state.thirdParties = state.thirdParties.map((item) => (item.code === existing.code ? revised : item));
      this.#audit(
        state,
        now,
        "accounting.thirdparty.updated",
        "ThirdParty",
        revised.code,
        `${revised.name} · ${thirdPartyTypeLabel[revised.type]}`
      );
      await this.#storage.write(state);
      return revised;
    });
  }

  /**
   * Active ou désactive une fiche tiers. Aucune suppression : un tiers référencé
   * par des écritures fait partie de l'histoire comptable (piste d'audit OHADA).
   */
  async setThirdPartyActive(code: string, isActive: boolean): Promise<ThirdPartyDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      const existing = this.#findThirdParty(state, code);
      if (existing.isActive === isActive) {
        return existing;
      }
      const revised: ThirdPartyDto = { ...existing, isActive, updatedAt: now.toISOString() };
      state.thirdParties = state.thirdParties.map((item) => (item.code === existing.code ? revised : item));
      this.#audit(
        state,
        now,
        isActive ? "accounting.thirdparty.reactivated" : "accounting.thirdparty.deactivated",
        "ThirdParty",
        revised.code,
        revised.name
      );
      await this.#storage.write(state);
      return revised;
    });
  }

  async setPeriodClosed(month: number, isClosed: boolean): Promise<AccountingPeriodDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      const now = this.#clock();
      const period = state.periods.find((item) => item.month === month);
      if (!period) {
        throw new DomainRuleError("La période demandée n'existe pas.");
      }
      period.isClosed = isClosed;
      period.closedAt = isClosed ? now.toISOString() : null;
      this.#audit(
        state,
        now,
        isClosed ? "accounting.period.closed" : "accounting.period.reopened",
        "AccountingPeriod",
        `${period.year}-${String(period.month).padStart(2, "0")}`,
        period.label
      );
      await this.#storage.write(state);
      return { ...period };
    });
  }

  /* --------------------------- Internes --------------------------- */

  #run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.#chain.then(task, task);
    this.#chain = next.catch(() => undefined);
    return next;
  }

  #ensureOrganization(organizationId: string, state: AccountingState): void {
    if (organizationId !== state.organizationId) {
      throw new DomainRuleError("Cette opération ne concerne pas l'organisation de l'espace courant.");
    }
  }

  #ensureJournalExists(state: AccountingState, journalCode: string): void {
    if (!state.journals.some((journal) => journal.code.toLowerCase() === journalCode.trim().toLowerCase())) {
      throw new DomainRuleError("Le journal sélectionné n'existe pas.");
    }
  }

  #ensureAccountExists(state: AccountingState, accountCode: string): void {
    const code = accountCode.trim();
    if (!state.accounts.some((account) => account.code === code)) {
      throw new DomainRuleError(`Le compte ${code} n'existe pas.`);
    }
  }

  #ensurePeriodOpen(state: AccountingState, entryDate: string): void {
    const period = state.periods.find(
      (item) => item.year === civilYear(entryDate) && item.month === civilMonth(entryDate)
    );
    if (!period) {
      throw new DomainRuleError("La date de la pièce n'appartient pas à l'exercice courant.");
    }
    if (period.isClosed) {
      throw new DomainRuleError(`La période ${period.label} est clôturée.`);
    }
  }

  /**
   * Référence de la contre-passation : `EXT-<origine>` par défaut, suffixée si
   * nécessaire. Une référence explicitement demandée doit être libre.
   */
  #reversalReference(state: AccountingState, originalReference: string, requested?: string): string {
    const taken = (candidate: string) =>
      state.entries.some((entry) => entry.reference.toLowerCase() === candidate.trim().toLowerCase());

    const explicit = requested?.trim() ?? "";
    if (explicit.length > 0) {
      if (taken(explicit)) {
        throw new DomainRuleError("Cette référence de pièce existe déjà.");
      }
      return explicit;
    }
    const base = `EXT-${originalReference}`;
    if (!taken(base)) {
      return base;
    }
    for (let suffix = 2; suffix < 100; suffix += 1) {
      const candidate = `${base}-${suffix}`;
      if (!taken(candidate)) {
        return candidate;
      }
    }
    throw new DomainRuleError("Impossible de générer une référence d'extourne unique pour cette pièce.");
  }

  #findThirdParty(state: AccountingState, code: string): ThirdPartyDto {
    const normalized = code.trim().toUpperCase();
    const found = state.thirdParties.find((item) => item.code.toUpperCase() === normalized);
    if (!found) {
      throw new DomainRuleError(`Le tiers ${normalized || "(vide)"} n'existe pas dans le fichier des tiers.`);
    }
    return found;
  }

  /** Fiche unique : un même nom avec un même type ne peut pas exister deux fois. */
  #ensureThirdPartyIdentityFree(
    state: AccountingState,
    name: string,
    type: string,
    ignoreCode: string | null
  ): void {
    const key = thirdPartyIdentityKey(name, parseTypeOrThrow(type));
    const duplicate = state.thirdParties.find(
      (item) =>
        item.code.toUpperCase() !== (ignoreCode ?? "").toUpperCase() &&
        thirdPartyIdentityKey(item.name, item.type) === key
    );
    if (duplicate) {
      throw new DomainRuleError(
        `Ce tiers existe déjà dans le fichier unique : ${duplicate.name} (${duplicate.code}). ` +
          "Modifiez cette fiche au lieu d'en créer une seconde."
      );
    }
  }

  /**
   * Convertit les lignes demandées en montants exacts et applique le contrôle
   * des tiers : compte auxiliaire => tiers obligatoire, actif et existant.
   */
  #resolveLines(
    state: AccountingState,
    lines: readonly AccountingEntryLineInput[],
    options: { allowInactiveThirdParty?: boolean } = {}
  ): LineDraft[] {
    if (lines.length === 0) {
      throw new DomainRuleError("Une pièce doit contenir au moins une ligne.");
    }
    return lines.map((line, index) => {
      this.#ensureAccountExists(state, line.accountCode);
      const account = state.accounts.find((item) => item.code === line.accountCode.trim());
      const requested = line.thirdPartyCode?.trim() ?? "";
      if (requested.length > 0) {
        const tier = this.#findThirdParty(state, requested);
        if (!tier.isActive && !options.allowInactiveThirdParty) {
          throw new DomainRuleError(
            `Le tiers ${tier.name} (${tier.code}) est désactivé : réactivez-le ou choisissez un autre tiers.`
          );
        }
      } else if (account?.requiresThirdParty) {
        throw new DomainRuleError(
          `La ligne ${index + 1} impute le compte ${account.code} (${account.label}) qui exige un tiers. ` +
            "Sélectionnez un tiers pour cette ligne."
        );
      }
      return {
        accountCode: line.accountCode,
        label: line.label,
        debit: amountFromDecimal(line.debit),
        credit: amountFromDecimal(line.credit),
        thirdPartyCode: requested.length > 0 ? requested.toUpperCase() : null
      };
    });
  }

  /** Même contrôle appliqué aux lignes déjà stockées (validation d'un brouillon). */
  #ensureStoredLinesValid(state: AccountingState, lines: readonly StoredEntryLine[]): void {
    this.#resolveLines(
      state,
      lines.map((line) => ({
        accountCode: line.accountCode,
        label: line.label,
        debit: amountToDecimal(line.debit),
        credit: amountToDecimal(line.credit),
        thirdPartyCode: line.thirdPartyCode
      }))
    );
  }

  #audit(
    state: AccountingState,
    now: Date,
    action: string,
    entityType: string,
    entityId: string,
    details: string
  ): void {
    const event = recordAuditEvent({
      organizationId: state.organizationId,
      actor: this.#actor,
      action,
      entityType,
      entityId,
      occurredAt: now,
      details
    });
    const sequence = (state.audit.at(-1)?.sequence ?? 0) + 1;
    state.audit.push({ ...event, occurredAt: event.occurredAt.toISOString(), sequence });
  }
}

/* --------------------------- Fonctions internes --------------------------- */

function parseTypeOrThrow(type: string): ThirdPartyDto["type"] {
  return parseThirdPartyType(type);
}

function sortEntries(entries: readonly StoredEntry[]): StoredEntry[] {
  return entries
    .slice()
    .sort(
      (left, right) =>
        right.entryDate.localeCompare(left.entryDate) ||
        right.number.localeCompare(left.number) ||
        right.createdAt.localeCompare(left.createdAt)
    );
}

/** Reconstruit l'agrégat domaine à partir de l'état stocké. */
function restoreAggregate(stored: StoredEntry): AccountingEntry {
  return AccountingEntry.restore({
    entry: {
      fiscalYearId: stored.fiscalYearId,
      organizationId: stored.organizationId,
      journalCode: stored.journalCode,
      entryDate: stored.entryDate,
      reference: stored.reference,
      number: stored.number,
      now: new Date(stored.createdAt)
    },
    status: stored.status,
    postedAt: stored.postedAt ? new Date(stored.postedAt) : null,
    reversedAt: stored.reversedAt ? new Date(stored.reversedAt) : null,
    updatedAt: stored.updatedAt ? new Date(stored.updatedAt) : undefined,
    lines: stored.lines.map((line) => ({
      id: line.id,
      accountCode: line.accountCode,
      label: line.label,
      debit: line.debit,
      credit: line.credit,
      thirdPartyCode: line.thirdPartyCode
    }))
  });
}

function toStoredLines(entry: AccountingEntry, state: AccountingState): StoredEntryLine[] {
  const labels = new Map(state.accounts.map((account) => [account.code, account.label] as const));
  return entry.lines.map((line) => ({
    id: line.id,
    accountCode: line.accountCode,
    accountLabel: labels.get(line.accountCode) ?? line.accountCode,
    label: line.label,
    debit: line.debit,
    credit: line.credit,
    thirdPartyCode: line.thirdPartyCode
  }));
}

function toStoredEntry(entry: AccountingEntry, state: AccountingState, description: string): StoredEntry {
  const lines = toStoredLines(entry, state);
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalYearId: entry.fiscalYearId,
    number: entry.number,
    journalCode: entry.journalCode,
    entryDate: entry.entryDate,
    reference: entry.reference,
    description: description.trim() || (lines[0]?.label ?? ""),
    status: entry.status,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.getTime() === entry.createdAt.getTime() ? null : entry.updatedAt.toISOString(),
    postedAt: entry.postedAt ? entry.postedAt.toISOString() : null,
    reversedAt: entry.reversedAt ? entry.reversedAt.toISOString() : null,
    reversalOfEntryId: null,
    reversedByEntryId: null,
    lines
  };
}

/** Tout ce dont le mappage DTO a besoin, préparé une fois par lecture d'état. */
interface EntryDtoContext {
  readonly tiers: ReadonlyMap<string, string>;
  readonly numbers: ReadonlyMap<string, string>;
  readonly attachmentCounts: ReadonlyMap<string, number>;
}

function entryContext(state: AccountingState): EntryDtoContext {
  const counts = new Map<string, number>();
  for (const attachment of state.attachments) {
    counts.set(attachment.entryId, (counts.get(attachment.entryId) ?? 0) + 1);
  }
  return {
    tiers: thirdPartyNames(state),
    numbers: new Map(state.entries.map((entry) => [entry.id, entry.number] as const)),
    attachmentCounts: counts
  };
}

function toReconciliationDto(record: ReconciliationRecord, keyLabel: string): ReconciliationDto {
  return {
    id: record.id,
    label: record.label,
    scope: record.scope,
    key: record.key,
    keyLabel,
    lineIds: record.lineIds.slice(),
    totalDebit: amountToDecimal(record.totalDebit),
    totalCredit: amountToDecimal(record.totalCredit),
    comment: record.comment,
    createdAt: record.createdAt,
    createdBy: record.createdBy
  };
}

function toEntryDto(stored: StoredEntry, context: EntryDtoContext): AccountingEntryDto {
  const tiers = context.tiers;
  const lines: AccountingEntryLineDto[] = stored.lines.map((line) => {
    const code = line.thirdPartyCode;
    return {
      id: line.id,
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      label: line.label,
      debit: amountToDecimal(line.debit),
      credit: amountToDecimal(line.credit),
      thirdPartyCode: code,
      thirdPartyName: code ? (tiers.get(code.toUpperCase()) ?? null) : null
    };
  });
  const totalDebit: Amount = lines.reduce((sum, line) => sum + amountFromDecimal(line.debit), 0n);
  const totalCredit: Amount = lines.reduce((sum, line) => sum + amountFromDecimal(line.credit), 0n);
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    fiscalYearId: stored.fiscalYearId,
    number: stored.number,
    journalCode: stored.journalCode,
    entryDate: stored.entryDate,
    reference: stored.reference,
    description: stored.description,
    status: stored.status,
    totalDebit: amountToDecimal(totalDebit),
    totalCredit: amountToDecimal(totalCredit),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
    postedAt: stored.postedAt,
    reversedAt: stored.reversedAt,
    reversalOfEntryId: stored.reversalOfEntryId,
    reversalOfNumber: stored.reversalOfEntryId
      ? (context.numbers.get(stored.reversalOfEntryId) ?? null)
      : null,
    reversedByEntryId: stored.reversedByEntryId,
    reversedByNumber: stored.reversedByEntryId ? (context.numbers.get(stored.reversedByEntryId) ?? null) : null,
    attachmentCount: context.attachmentCounts.get(stored.id) ?? 0,
    lines
  };
}
