/**
 * Noyau transactionnel de la comptabilité générale.
 *
 * Une SEULE implémentation des règles métier, quel que soit l'hôte (PWA, desktop,
 * API) : les adaptateurs ne fournissent que le {@link StoragePort}. La validation
 * d'une pièce repasse TOUJOURS par l'agrégat {@link AccountingEntry}, ce qui rend
 * l'immutabilité et l'équilibre réellement garanties sur tous les chemins
 * (défaut n°3 de l'analyse de l'existant C#).
 */

import type {
  AccountingEntryDto,
  AccountingEntryLineDto,
  AccountingJournalDto,
  AccountingPeriodDto,
  AccountingSnapshot,
  CreateAccountingEntryRequest,
  CreateGeneralAccountRequest,
  GeneralAccountDto
} from "@perfecto/contracts";
import {
  AccountingEntry,
  AccountingEntryStatus,
  DomainRuleError,
  amountFromDecimal,
  amountToDecimal,
  civilMonth,
  civilYear,
  recordAuditEvent,
  type Amount
} from "@perfecto/domain";
import { buildGeneralLedger, buildJournal, buildTrialBalance, postedEntries } from "./reports";
import type { AccountingState, AuditRecord, StoragePort, StoredEntry, StoredEntryLine } from "./state";

export interface KernelOptions {
  clock?: () => Date;
  actor?: string;
  storageMode?: string;
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

    return {
      organizationId: state.organizationId,
      accountCount: state.accounts.length,
      journalCount: state.journals.length,
      draftEntryCount: state.entries.filter((entry) => entry.status === AccountingEntryStatus.Draft).length,
      postedEntryCount: posted.length,
      totalDebitMovements: amountToDecimal(totalDebit),
      totalCreditMovements: amountToDecimal(totalCredit),
      recentEntries: sortEntries(state.entries).slice(0, 5).map(toEntryDto),
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
    return sortEntries(state.entries).map(toEntryDto);
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

  /* --------------------------- Écritures -------------------------- */

  async saveEntry(request: CreateAccountingEntryRequest): Promise<AccountingEntryDto> {
    return this.#run(async () => {
      const state = await this.#storage.read();
      this.#ensureOrganization(request.organizationId, state);
      const now = this.#clock();

      if (!state.journals.some((journal) => journal.code.toLowerCase() === request.journalCode.trim().toLowerCase())) {
        throw new DomainRuleError("Le journal sélectionné n'existe pas.");
      }
      if (state.entries.some((entry) => entry.reference.toLowerCase() === request.reference.trim().toLowerCase())) {
        throw new DomainRuleError("Cette référence de pièce existe déjà.");
      }
      this.#ensurePeriodOpen(state, request.entryDate);

      const entry = AccountingEntry.create(
        state.fiscalYearId,
        state.organizationId,
        request.journalCode,
        request.entryDate,
        request.reference,
        now
      );
      for (const line of request.lines) {
        this.#ensureAccountExists(state, line.accountCode);
        entry.addLine(line.accountCode, line.label, amountFromDecimal(line.debit), amountFromDecimal(line.credit));
      }
      if (request.postImmediately) {
        entry.post(now);
      }

      const stored = toStoredEntry(entry, state, request.description ?? "");
      state.entries.push(stored);
      this.#audit(state, now, request.postImmediately ? "accounting.entry.posted" : "accounting.entry.saved", "AccountingEntry", stored.id, stored.reference);
      await this.#storage.write(state);
      return toEntryDto(stored);
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
        return toEntryDto(stored);
      }
      this.#ensureOrganization(stored.organizationId, state);
      this.#ensurePeriodOpen(state, stored.entryDate);

      // Repasse par l'agrégat : équilibre, nombre de lignes et immutabilité
      // sont garantie par le domaine, pas par une vérification recopiée.
      const aggregate = AccountingEntry.create(
        stored.fiscalYearId,
        stored.organizationId,
        stored.journalCode,
        stored.entryDate,
        stored.reference,
        new Date(stored.createdAt)
      );
      for (const line of stored.lines) {
        aggregate.addLine(line.accountCode, line.label, line.debit, line.credit);
      }
      aggregate.post(now);

      stored.status = AccountingEntryStatus.Posted;
      stored.postedAt = now.toISOString();
      this.#audit(state, now, "accounting.entry.posted", "AccountingEntry", stored.id, stored.reference);
      await this.#storage.write(state);
      return toEntryDto(stored);
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
    state.audit.push({ ...event, occurredAt: event.occurredAt.toISOString() });
  }
}

/* --------------------------- Mappages --------------------------- */

function sortEntries(entries: readonly StoredEntry[]): StoredEntry[] {
  return entries
    .slice()
    .sort(
      (left, right) =>
        right.entryDate.localeCompare(left.entryDate) || right.createdAt.localeCompare(left.createdAt)
    );
}

function toStoredEntry(entry: AccountingEntry, state: AccountingState, description: string): StoredEntry {
  const labels = new Map(state.accounts.map((account) => [account.code, account.label] as const));
  const lines: StoredEntryLine[] = entry.lines.map((line) => ({
    id: line.id,
    accountCode: line.accountCode,
    accountLabel: labels.get(line.accountCode) ?? line.accountCode,
    label: line.label,
    debit: line.debit,
    credit: line.credit
  }));
  return {
    id: entry.id,
    organizationId: entry.organizationId,
    fiscalYearId: entry.fiscalYearId,
    journalCode: entry.journalCode,
    entryDate: entry.entryDate,
    reference: entry.reference,
    description: description.trim() || (lines[0]?.label ?? ""),
    status: entry.status,
    createdAt: entry.createdAt.toISOString(),
    postedAt: entry.postedAt ? entry.postedAt.toISOString() : null,
    lines
  };
}

function toEntryDto(stored: StoredEntry): AccountingEntryDto {
  const lines: AccountingEntryLineDto[] = stored.lines.map((line) => ({
    id: line.id,
    accountCode: line.accountCode,
    accountLabel: line.accountLabel,
    label: line.label,
    debit: amountToDecimal(line.debit),
    credit: amountToDecimal(line.credit)
  }));
  const totalDebit: Amount = lines.reduce((sum, line) => sum + amountFromDecimal(line.debit), 0n);
  const totalCredit: Amount = lines.reduce((sum, line) => sum + amountFromDecimal(line.credit), 0n);
  return {
    id: stored.id,
    organizationId: stored.organizationId,
    journalCode: stored.journalCode,
    entryDate: stored.entryDate,
    reference: stored.reference,
    description: stored.description,
    status: stored.status,
    totalDebit: amountToDecimal(totalDebit),
    totalCredit: amountToDecimal(totalCredit),
    createdAt: stored.createdAt,
    postedAt: stored.postedAt,
    lines
  };
}
