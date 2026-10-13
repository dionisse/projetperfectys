/**
 * Adaptateur IndexedDB du port {@link StoragePort}.
 * Une seule clé d'état par base : lecture/écriture atomiques, migration versionnée,
 * amorçage automatique du jeu de démonstration au premier lancement.
 * Testé sous `fake-indexeddb` (packages/pwa/test).
 */

import type { AccountingState, StoragePort } from "@perfecto/application";
import { deserializeState, serializeState, type SerializedState } from "./state-codec";

export const DATABASE_NAME = "perfecto-next";
export const DATABASE_VERSION = 1;
const STORE = "state";
const STATE_KEY = "accounting";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export class IndexedDbStorage implements StoragePort {
  constructor(private readonly seed: () => AccountingState) {}

  async read(): Promise<AccountingState> {
    const db = await openDatabase();
    try {
      const existing = await transaction<SerializedState | undefined>(db, "readonly", (store) =>
        store.get(STATE_KEY)
      );
      if (existing) {
        return deserializeState(existing);
      }
      const state = this.seed();
      await transaction(db, "readwrite", (store) => store.put(serializeState(state), STATE_KEY));
      return state;
    } finally {
      db.close();
    }
  }

  async write(state: AccountingState): Promise<void> {
    const db = await openDatabase();
    try {
      await transaction(db, "readwrite", (store) => store.put(serializeState(state), STATE_KEY));
    } finally {
      db.close();
    }
  }
}

/** Efface complètement la base locale (bouton « réinitialiser la démonstration »). */
export function deleteLocalDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
