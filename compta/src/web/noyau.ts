/**
 * Service comptable partagé par l'interface.
 *
 * Un seul service, un seul état : deux instances liraient chacune leur version du dossier et
 * afficheraient des totaux différents. Le noyau sérialise déjà ses mutations, l'interface n'a
 * qu'à appeler.
 */

import { BENIN, ServiceComptable, type PaquetPays } from "../noyau/index";
import { StockageIndexedDB } from "./stockage-indexeddb";

export const ACTEUR = "superviseur";

let stockage: StockageIndexedDB | null = null;
let service: ServiceComptable | null = null;

export function getStockage(): StockageIndexedDB {
  stockage ??= new StockageIndexedDB();
  return stockage;
}

export function getService(paquetPays: PaquetPays = BENIN): ServiceComptable {
  service ??= new ServiceComptable(getStockage(), {
    utilisateur: ACTEUR,
    paquetPays
  });
  return service;
}

/** Reconstruit le dossier de démonstration et invalide le service en cours. */
export async function reinitialiserDemonstration(): Promise<void> {
  await getStockage().reinitialiser();
  service = null;
  getService();
}

/** Pour les tests : repart d'un service neuf sur un stockage isolé. */
export function reinitialiserPourTest(nomBase: string): ServiceComptable {
  stockage = new StockageIndexedDB(nomBase);
  service = new ServiceComptable(stockage, { utilisateur: ACTEUR, paquetPays: BENIN });
  return service;
}
