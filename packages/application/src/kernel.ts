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
  AuditEventDto,
  CreateAccountingEntryRequest,
  CreateGeneralAccountRequest,
  AccountingEntryLineInput,
  CreateThirdPartyRequest,
  GeneralAccountDto,
  JournalNumberingDto,
  ThirdPartyDto,
  ThirdPartyStatementDto,
  ThirdPartyUsageDto,
  UpdateAccountingEntryRequest,
  UpdateThirdPartyRequest
} from "@perfecto/contracts";
import { auditActionLabel } from "@perfecto/contracts";
import {
  AMOUNT_ZERO,
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  allocateEntryNumber,
  amountAdd,
  amountFromDecimal,
  amountToDecimal,
  civilMonth,
  civilYear,
  createThirdParty,
  parseThirdPartyType,
  peekEntryNumber as peekEntryNumberFor,
  recordAuditEvent,
  suggestThirdPartyCode,
  thirdPartyIdentityKey,
  thirdPartyTypeLabel,
  updateThirdParty,
  type Amount,
  type EntryLineInput
} from "@perfecto/domain";
import {
  buildGeneralLedger,
  buildJournal,
  buildThirdPartyStatement,
  buildTrialBalance,
  postedEntries
} from "./reports";
import type { AccountingState, AuditRecord, StoragePort, StoredEntry, StoredEntryLine } from "./state";

export interface KernelOptions {
  clock?: () => Date;
  actor?: string;
  storageMode?: string;
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
  #chain: Promise<unknown> = Promise.resolve();

  constructor(storage: StoragePort, options: KernelOptions = {}) {
    this.#storage = storage;
    this.#clock = options.clock ?? (() => new Date());
    this.#actor = options.actor ?? "utilisateur";
    this.#storageMode = options.storageMode ?? "Noyau partagé";
  }

  /* --------------------------- Lectures --------------------------- */

  async getSnapshot(): Promise<AccountingSnapshot> {
    const state = await this.#storage.read();
    const balance = buildTrialBalance(state.accounts, state.entries);
    const totalDebit = balance.reduce((sum, line) => sum + amountFromDecimal(line.debitMovements), 0n);
    const totalCredit = balance.reduce((sum, line) => sum + amountFromDecimal(line.creditMovements), 0n);
    const posted = postedEntries(state.entries);
    const tiers = thirdPartyNames(state);

    return {
      organizationId: state.organizationId,
      accountCount: state.accounts.length,
      journalCount: state.journals.length,
      thirdPartyCount: state.thirdParties.length,
      draftEntryCount: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Draft).length,
      postedEntryCount: posted.length,
      totalDebitMovements: amountToDecimal(totalDebit),
      totalCreditMovements: amountToDecimal(totalCredit),
      recentEntries: sortEntries(state.entries).slice(0, 5).map((entry) => toEntryDto(entry, tiers)),
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
    const tiers = thirdPartyNames(state);
    return sortEntries(state.entries).map((entry) => toEntryDto(entry, tiers));
  }

  async getEntry(entryId: string): Promise<AccountingEntryDto> {
    const state = await this.#storage.read();
    const stored = state.entries.find((entry) => entry.id === entryId);
    if (!stored) {
      throw new DomainRuleError("La pièce demandée n'existe pas.");
    }
    return toEntryDto(stored, thirdPartyNames(state));
  }

  async getJournalLines() {
    const state = await this.#storage.read();
    return buildJournal(state.entries);
  }

  async getGeneralLedger() {
    const state = await this.#storage.read();
    return buildGeneralLedger(state.entries);
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

  /** Fiche tiers complète : coordonnées + relevé des mouvements validés. */
  async getThirdPartyStatement(code: string): Promise<ThirdPartyStatementDto> {
    const state = await this.#storage.read();
    const thirdParty = await this.getThirdParty(code);
    const lines = buildThirdPartyStatement(state.entries, thirdParty.code);
    const totalDebit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.debit)), AMOUNT_ZERO);
    const totalCredit = lines.reduce((sum, line) => amountAdd(sum, amountFromDecimal(line.credit)), AMOUNT_ZERO);
    const closing = totalDebit - totalCredit;
    return {
      thirdParty,
      lines,
      totalDebit: amountToDecimal(totalDebit),
      totalCredit: amountToDecimal(totalCredit),
      closingBalance: amountToDecimal(closing)
    };
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
      return toEntryDto(stored, thirdPartyNames(state));
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
      return toEntryDto(stored, thirdPartyNames(state));
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
        return toEntryDto(stored, thirdPartyNames(state));
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
      return toEntryDto(stored, thirdPartyNames(state));
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
  #resolveLines(state: AccountingState, lines: readonly AccountingEntryLineInput[]): LineDraft[] {
    if (lines.length === 0) {
      throw new DomainRuleError("Une pièce doit contenir au moins une ligne.");
    }
    return lines.map((line, index) => {
      this.#ensureAccountExists(state, line.accountCode);
      const account = state.accounts.find((item) => item.code === line.accountCode.trim());
      const requested = line.thirdPartyCode?.trim() ?? "";
      if (requested.length > 0) {
        const tier = this.#findThirdParty(state, requested);
        if (!tier.isActive) {
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

/** Année de l'exercice courant, déduite des périodes (à défaut, année du jour). */
function exerciseYear(state: AccountingState): number {
  return state.periods[0]?.year ?? new Date().getFullYear();
}

function countPostedLines(state: AccountingState, thirdPartyCode: string): number {
  const code = thirdPartyCode.toUpperCase();
  return postedEntries(state.entries).flatMap((entry) => entry.lines)
    .filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === code).length;
}

function thirdPartyNames(state: AccountingState): Map<string, string> {
  return new Map(state.thirdParties.map((item) => [item.code.toUpperCase(), item.name] as const));
}

function thirdPartyUsage(state: AccountingState, search?: string): ThirdPartyUsageDto[] {
  const needle = search?.trim().toLowerCase();
  const postedLines = postedEntries(state.entries).flatMap((entry) => entry.lines);

  return state.thirdParties
    .filter((item) =>
      needle
        ? item.code.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)
        : true
    )
    .map((item) => {
      const own = postedLines.filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === item.code.toUpperCase());
      const all = state.entries
        .flatMap((entry) => entry.lines)
        .filter((line) => (line.thirdPartyCode ?? "").toUpperCase() === item.code.toUpperCase());
      const totalDebit = own.reduce((sum, line) => amountAdd(sum, line.debit), AMOUNT_ZERO);
      const totalCredit = own.reduce((sum, line) => amountAdd(sum, line.credit), AMOUNT_ZERO);
      return {
        ...item,
        lineCount: all.length,
        postedLineCount: own.length,
        totalDebit: amountToDecimal(totalDebit),
        totalCredit: amountToDecimal(totalCredit),
        netBalance: amountToDecimal(totalDebit - totalCredit)
      };
    })
    .sort((left, right) => left.code.localeCompare(right.code));
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
    lines
  };
}

function toEntryDto(stored: StoredEntry, tiers: ReadonlyMap<string, string> = new Map()): AccountingEntryDto {
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
    lines
  };
}
