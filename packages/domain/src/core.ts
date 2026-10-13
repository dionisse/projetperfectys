/**
 * Noyau partagé : erreurs métier, dates civiles, organisation, exercice, audit.
 * Portage TypeScript de Perfecto.Domain (Organization.cs, FiscalYear.cs, AuditEvent.cs).
 * Les messages d'erreur sont conservés à l'identique : ils sont lus par des comptables.
 */

/** Violation d'une règle de gestion (équivalent de DomainRuleException côté C#). */
export class DomainRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainRuleError";
  }
}

/* ------------------------------------------------------------------ */
/* Dates civiles (équivalent DateOnly : année, mois, jour sans heure)  */
/* ------------------------------------------------------------------ */

/** Date ISO `AAAA-MM-JJ`, seule représentation acceptée dans le noyau. */
export type CivilDate = string;

const CIVIL_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function civilDate(year: number, month: number, day: number): CivilDate {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return parseCivilDate(value);
}

export function parseCivilDate(value: string): CivilDate {
  const match = CIVIL_RE.exec(value);
  if (!match) {
    throw new DomainRuleError(`Date invalide : « ${value} » (format attendu AAAA-MM-JJ).`);
  }
  const [, y, m, d] = match as unknown as [string, string, string, string];
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new DomainRuleError(`Date invalide : « ${value} ».`);
  }
  return value;
}

export function civilYear(date: CivilDate): number {
  return Number(date.slice(0, 4));
}

export function civilMonth(date: CivilDate): number {
  return Number(date.slice(5, 7));
}

const FRENCH_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre"
];

export function frenchMonthLabel(year: number, month: number): string {
  const label = FRENCH_MONTHS[month - 1];
  if (!label) {
    throw new DomainRuleError(`Mois invalide : ${month}.`);
  }
  return `${label} ${year}`;
}

/** `AAAA-MM-JJ` -> `JJ/MM/AAAA` pour les écrans. */
export function formatCivilDateFr(date: CivilDate): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

function requireText(value: string | null | undefined, message: string): string {
  const normalized = value?.trim() ?? "";
  if (normalized.length === 0) {
    throw new DomainRuleError(message);
  }
  return normalized;
}

/* ------------------------------------------------------------------ */
/* Organisation                                                        */
/* ------------------------------------------------------------------ */

export class Organization {
  readonly id: string;
  #code: string;
  #name: string;
  #taxIdentifier = "";
  #baseCurrency: string;
  #isActive = true;
  readonly createdAt: Date;
  #updatedAt: Date;

  private constructor(id: string, code: string, name: string, baseCurrency: string, now: Date) {
    this.id = id;
    this.#code = Organization.normalizeCode(code);
    this.#name = requireText(name, "La raison sociale est obligatoire.");
    this.#baseCurrency = Organization.normalizeCurrency(baseCurrency);
    this.createdAt = now;
    this.#updatedAt = now;
  }

  get code(): string {
    return this.#code;
  }
  get name(): string {
    return this.#name;
  }
  get taxIdentifier(): string {
    return this.#taxIdentifier;
  }
  get baseCurrency(): string {
    return this.#baseCurrency;
  }
  get isActive(): boolean {
    return this.#isActive;
  }
  get updatedAt(): Date {
    return this.#updatedAt;
  }

  static create(code: string, name: string, baseCurrency: string, now: Date): Organization {
    return new Organization(crypto.randomUUID(), code, name, baseCurrency, now);
  }

  updateIdentity(name: string, taxIdentifier: string | null, baseCurrency: string, now: Date): void {
    this.#name = requireText(name, "La raison sociale est obligatoire.");
    this.#taxIdentifier = taxIdentifier?.trim() ?? "";
    this.#baseCurrency = Organization.normalizeCurrency(baseCurrency);
    this.#updatedAt = now;
  }

  deactivate(now: Date): void {
    this.#isActive = false;
    this.#updatedAt = now;
  }

  private static normalizeCode(value: string): string {
    const normalized = requireText(value, "Le code société est obligatoire.").toUpperCase();
    if (normalized.length < 2 || normalized.length > 12) {
      throw new DomainRuleError("Le code société doit contenir entre 2 et 12 caractères.");
    }
    return normalized;
  }

  private static normalizeCurrency(value: string): string {
    const normalized = requireText(value, "La devise de base est obligatoire.").toUpperCase();
    if (normalized.length !== 3) {
      throw new DomainRuleError("La devise doit être un code ISO de trois caractères.");
    }
    return normalized;
  }
}

/* ------------------------------------------------------------------ */
/* Exercice comptable                                                  */
/* ------------------------------------------------------------------ */

export const FiscalYearStatus = {
  Draft: "draft",
  Open: "open",
  Closed: "closed"
} as const;
export type FiscalYearStatus = (typeof FiscalYearStatus)[keyof typeof FiscalYearStatus];

export const fiscalYearStatusLabel: Record<FiscalYearStatus, string> = {
  draft: "En préparation",
  open: "Ouvert",
  closed: "Clôturé"
};

export class FiscalYear {
  readonly id: string;
  readonly organizationId: string;
  readonly label: string;
  readonly startsOn: CivilDate;
  readonly endsOn: CivilDate;
  readonly accountingProfileCode: string;
  #status: FiscalYearStatus;
  readonly createdAt: Date;
  #openedAt: Date | null = null;
  #closedAt: Date | null = null;

  private constructor(
    id: string,
    organizationId: string,
    label: string,
    startsOn: CivilDate,
    endsOn: CivilDate,
    accountingProfileCode: string,
    now: Date
  ) {
    if (organizationId.trim().length === 0) {
      throw new DomainRuleError("L'organisation est obligatoire.");
    }
    if (endsOn < startsOn) {
      throw new DomainRuleError("La date de fin doit être postérieure à la date de début.");
    }
    this.id = id;
    this.organizationId = organizationId;
    this.label = requireText(label, "Le libellé de l'exercice est obligatoire.");
    this.startsOn = startsOn;
    this.endsOn = endsOn;
    this.accountingProfileCode = requireText(
      accountingProfileCode,
      "Le référentiel comptable est obligatoire."
    ).toUpperCase();
    this.#status = FiscalYearStatus.Draft;
    this.createdAt = now;
  }

  get status(): FiscalYearStatus {
    return this.#status;
  }
  get openedAt(): Date | null {
    return this.#openedAt;
  }
  get closedAt(): Date | null {
    return this.#closedAt;
  }

  static create(
    organizationId: string,
    label: string,
    startsOn: CivilDate,
    endsOn: CivilDate,
    accountingProfileCode: string,
    now: Date
  ): FiscalYear {
    return new FiscalYear(crypto.randomUUID(), organizationId, label, startsOn, endsOn, accountingProfileCode, now);
  }

  open(now: Date): void {
    if (this.#status !== FiscalYearStatus.Draft) {
      throw new DomainRuleError("Seul un exercice en préparation peut être ouvert.");
    }
    this.#status = FiscalYearStatus.Open;
    this.#openedAt = now;
  }

  close(now: Date): void {
    if (this.#status !== FiscalYearStatus.Open) {
      throw new DomainRuleError("Seul un exercice ouvert peut être clôturé.");
    }
    this.#status = FiscalYearStatus.Closed;
    this.#closedAt = now;
  }
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditEvent {
  readonly id: string;
  readonly organizationId: string;
  readonly actor: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly occurredAt: Date;
  readonly details: string;
}

export function recordAuditEvent(input: {
  organizationId: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: Date;
  details?: string;
}): AuditEvent {
  if (input.organizationId.trim().length === 0) {
    throw new DomainRuleError("L'organisation est obligatoire pour tracer une opération.");
  }
  return {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    actor: requireText(input.actor, "L'acteur est obligatoire."),
    action: requireText(input.action, "L'action est obligatoire."),
    entityType: requireText(input.entityType, "Le type d'entité est obligatoire."),
    entityId: requireText(input.entityId, "L'identifiant de l'entité est obligatoire."),
    occurredAt: input.occurredAt,
    details: input.details?.trim() ?? ""
  };
}
