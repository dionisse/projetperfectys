/**
 * Adaptateur IndexedDB du port {@link StoragePort} et du port
 * {@link AttachmentBytesPort}.
 *
 * Deux magasins dans la même base :
 *  - `state` : l'état comptable sérialisable (une clé), lecture/écriture atomiques,
 *    migration versionnée, amorçage automatique du jeu de démonstration ;
 *  - `files` : les octets des justificatifs, hors de l'état comptable — l'état ne
 *    porte que la métadonnée et l'empreinte SHA-256.
 *
 * Testé sous `fake-indexeddb` (packages/pwa/test).
 */

import type { AccountingState, AttachmentBytesPort, StoragePort } from "@perfecto/application";
import { deserializeState, serializeState, type SerializedState } from "./state-codec";

export const DATABASE_NAME = "perfecto-next";
/** v2 : ajout du magasin des justificatifs (une base v1 est mise à niveau). */
export const DATABASE_VERSION = 2;
const STORE = "state";
const FILE_STORE = "files";
const STATE_KEY = "accounting";

export interface StoredFile {
  bytes: Uint8Array;
  mimeType: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = run(tx.objectStore(storeName));
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

export class IndexedDbStorage implements StoragePort {
  /**
   * Amorçage à vol unique.
   *
   * Un écran ouvre plusieurs lectures parallèles (journaux, comptes, tiers, pièces…). Sur
   * une base vide — premier lancement, profil navigateur neuf, réinitialisation — chacune
   * de ces lectures amorçait son propre jeu de démonstration, avec ses propres identifiants,
   * et la dernière écriture écrasait les autres : l'écran affichait alors des pièces dont
   * l'identifiant n'existait plus en base. Une seule promesse d'amorçage, partagée, supprime
   * la course ; toute lecture et toute écriture l'attend.
   */
  #bootstrapped: Promise<void> | null = null;

  constructor(private readonly seed: () => AccountingState) {}

  #bootstrap(): Promise<void> {
    this.#bootstrapped ??= (async () => {
      const db = await openDatabase();
      try {
        const existing = await transaction<SerializedState | undefined>(
          db,
          STORE,
          "readonly",
          (store) => store.get(STATE_KEY)
        );
        if (existing) {
          return;
        }
        await transaction(db, STORE, "readwrite", (store) =>
          store.put(serializeState(this.seed()), STATE_KEY)
        );
      } finally {
        db.close();
      }
    })();
    return this.#bootstrapped;
  }

  async read(): Promise<AccountingState> {
    await this.#bootstrap();
    const db = await openDatabase();
    try {
      const existing = await transaction<SerializedState | undefined>(db, STORE, "readonly", (store) =>
        store.get(STATE_KEY)
      );
      if (existing) {
        return deserializeState(existing);
      }
      // Repli : base effacée pendant l'exécution. On réamorce et on persiste aussitôt,
      // pour que la base contienne toujours exactement ce que l'écran affiche.
      const state = this.seed();
      await transaction(db, STORE, "readwrite", (store) => store.put(serializeState(state), STATE_KEY));
      return state;
    } finally {
      db.close();
    }
  }

  async write(state: AccountingState): Promise<void> {
    await this.#bootstrap();
    const db = await openDatabase();
    try {
      await transaction(db, STORE, "readwrite", (store) => store.put(serializeState(state), STATE_KEY));
    } finally {
      db.close();
    }
  }
}

/** Stockage contrôlé des justificatifs : les octets ne quittent jamais le poste. */
export class IndexedDbFileStorage implements AttachmentBytesPort {
  async put(attachmentId: string, bytes: Uint8Array, mimeType: string): Promise<void> {
    const db = await openDatabase();
    try {
      const file: StoredFile = { bytes: new Uint8Array(bytes), mimeType };
      await transaction(db, FILE_STORE, "readwrite", (store) => store.put(file, attachmentId));
    } finally {
      db.close();
    }
  }

  async get(attachmentId: string): Promise<StoredFile | null> {
    const db = await openDatabase();
    try {
      const found = await transaction<StoredFile | undefined>(db, FILE_STORE, "readonly", (store) =>
        store.get(attachmentId)
      );
      return found ?? null;
    } finally {
      db.close();
    }
  }

  async delete(attachmentId: string): Promise<void> {
    const db = await openDatabase();
    try {
      await transaction(db, FILE_STORE, "readwrite", (store) => store.delete(attachmentId));
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
