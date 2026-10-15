/**
 * Stockage IndexedDB du dossier.
 *
 * Hors ligne d'abord : un cabinet dont la connexion tombe ne doit pas perdre une saisie en
 * cours. Les montants sont des `bigint`, que `JSON` et le clonage structuré ne portent pas de
 * façon fiable selon les navigateurs : l'état est donc sérialisé en chaînes à l'aller et
 * reconstitué au retour (`serialiserEtat` / `deserialiserEtat`).
 *
 * **Amorçage à vol unique** : la première lecture crée le dossier de démonstration s'il n'existe
 * pas. Deux lectures parallèles au démarrage produiraient sinon deux états différents, et la
 * seconde écraserait la première — bug réel observé sur la version précédente.
 */

import {
  creerDossierDemonstration,
  deserialiserEtat,
  serialiserEtat,
  type EtatDossier,
  type EtatDossierSerialise
} from "../noyau/index";
import type { PortStockage } from "../noyau/index";

const CLE = "courant";

export class StockageIndexedDB implements PortStockage<EtatDossier> {
  readonly mode = "IndexedDB · disponible hors ligne";
  readonly #nomBase: string;
  readonly #magasin: string;
  #base: Promise<IDBDatabase> | null = null;
  #amorce: Promise<EtatDossier> | null = null;

  constructor(nomBase = "perfectys-compta", magasin = "dossier") {
    this.#nomBase = nomBase;
    this.#magasin = magasin;
  }

  #ouvrir(): Promise<IDBDatabase> {
    this.#base ??= new Promise<IDBDatabase>((resoudre, rejeter) => {
      const requete = indexedDB.open(this.#nomBase, 1);
      requete.onupgradeneeded = () => {
        const base = requete.result;
        if (!base.objectStoreNames.contains(this.#magasin)) {
          base.createObjectStore(this.#magasin);
        }
      };
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error ?? new Error("Ouverture d'IndexedDB refusée."));
      requete.onblocked = () => rejeter(new Error("Ouverture d'IndexedDB bloquée par un autre onglet."));
    });
    return this.#base;
  }

  async #transaction<Lecture>(
    mode: IDBTransactionMode,
    operation: (magasin: IDBObjectStore) => IDBRequest<Lecture>
  ): Promise<Lecture> {
    const base = await this.#ouvrir();
    return new Promise<Lecture>((resoudre, rejeter) => {
      const transaction = base.transaction(this.#magasin, mode);
      const requete = operation(transaction.objectStore(this.#magasin));
      requete.onsuccess = () => resoudre(requete.result);
      requete.onerror = () => rejeter(requete.error ?? new Error("Opération IndexedDB refusée."));
    });
  }

  async lire(): Promise<EtatDossier> {
    this.#amorce ??= (async () => {
      const brut = await this.#transaction<EtatDossierSerialise | undefined>("readonly", (magasin) =>
        magasin.get(CLE)
      );
      if (brut) {
        return deserialiserEtat(brut);
      }
      const initial = creerDossierDemonstration({ annee: new Date().getFullYear() });
      await this.ecrire(initial);
      return initial;
    })();
    return this.#amorce;
  }

  async ecrire(etat: EtatDossier): Promise<void> {
    const brut = serialiserEtat(etat);
    await this.#transaction("readwrite", (magasin) => magasin.put(brut, CLE));
    // Une écriture rend l'amorçage caduc : la prochaine lecture voit l'état enregistré.
    this.#amorce = Promise.resolve(etat);
  }

  /** Efface le dossier enregistré : utilisé par « Réinitialiser la démonstration ». */
  async reinitialiser(): Promise<EtatDossier> {
    const neuf = creerDossierDemonstration({ annee: new Date().getFullYear() });
    await this.ecrire(neuf);
    return neuf;
  }
}
