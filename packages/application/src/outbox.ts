/**
 * File d'opérations de synchronisation (outbox) idempotente.
 * Portage de Perfecto.Application/Sync/ISyncOutbox.cs + Infrastructure/Sync/SqliteSyncOutbox.cs.
 * Base du futur mode hors-ligne synchronisé : une opération déjà présente n'est
 * jamais dupliquée et reste en attente jusqu'à son acquittement.
 */

export interface PendingOperation {
  id: string;
  organizationId: string;
  operationType: string;
  payload: string;
  createdAt: string;
  attemptCount: number;
}

export interface SyncOutbox {
  enqueue(operation: PendingOperation): Promise<void>;
  getPending(): Promise<PendingOperation[]>;
  markCompleted(operationId: string): Promise<void>;
}

interface OutboxRecord extends PendingOperation {
  completedAt: string | null;
}

export class InMemorySyncOutbox implements SyncOutbox {
  #records: OutboxRecord[] = [];

  async enqueue(operation: PendingOperation): Promise<void> {
    if (this.#records.some((record) => record.id === operation.id)) {
      return;
    }
    this.#records.push({ ...operation, completedAt: null });
  }

  async getPending(): Promise<PendingOperation[]> {
    return this.#records
      .filter((record) => record.completedAt === null)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(({ completedAt: _completedAt, ...operation }) => operation);
  }

  async markCompleted(operationId: string): Promise<void> {
    const record = this.#records.find((item) => item.id === operationId);
    if (!record || record.completedAt !== null) {
      return;
    }
    record.completedAt = new Date().toISOString();
  }
}
