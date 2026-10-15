/**
 * Point d'entrée applicatif : noyau unique + adaptateurs IndexedDB.
 * Identifiants de démonstration alignés sur le jeu de données du Lot 1.
 */

import { AccountingKernel, createDemoState } from "@perfecto/application";
import { IndexedDbFileStorage, IndexedDbStorage, deleteLocalDatabase } from "./adapters/indexeddb-storage";

export const DEMO_ORGANIZATION_ID = "3e6f6391-60a5-473f-b85a-2edbc44e93ef";
export const DEMO_FISCAL_YEAR_ID = "5f3accb0-dc6d-46a2-9c3c-f805fbab77a9";

let kernel: AccountingKernel | null = null;

export function getKernel(): AccountingKernel {
  kernel ??= new AccountingKernel(
    new IndexedDbStorage(() => createDemoState(DEMO_ORGANIZATION_ID, DEMO_FISCAL_YEAR_ID)),
    {
      storageMode: "IndexedDB · disponible hors ligne",
      actor: "superviseur",
      // Justificatifs : octets dans le magasin `files`, empreinte dans l'état.
      fileStorage: new IndexedDbFileStorage()
    }
  );
  return kernel;
}

/** Efface la base locale et reconstruit le jeu de démonstration. */
export async function resetDemoData(): Promise<void> {
  await deleteLocalDatabase();
  kernel = null;
}
