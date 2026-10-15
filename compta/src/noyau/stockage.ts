/**
 * Port de stockage.
 *
 * Le noyau ne sait pas où vivent les données. Un port suffit : la PWA branche IndexedDB, l'hôte
 * Windows branchera SQLite, les tests branchent la mémoire. C'est ce qui permet de tester les
 * règles métier en Node, sans navigateur.
 */

export interface PortStockage<Etat> {
  lire(): Promise<Etat>;
  ecrire(etat: Etat): Promise<void>;
  /** Identifiant technique du mode, affiché en barre d'état (`mémoire`, `IndexedDB`…). */
  readonly mode: string;
}

/** Stockage en mémoire, pour les tests et pour un démarrage sans persistance. */
export class StockageMemoire<Etat> implements PortStockage<Etat> {
  readonly mode = "mémoire (non persistant)";
  #etat: Etat;
  #ecritures = 0;

  constructor(etat: Etat) {
    this.#etat = etat;
  }

  async lire(): Promise<Etat> {
    return this.#etat;
  }

  async ecrire(etat: Etat): Promise<void> {
    this.#etat = etat;
    this.#ecritures += 1;
  }

  /** Nombre de fois que l'état a été enregistré : utile pour prouver la persistance en test. */
  get nombreEcritures(): number {
    return this.#ecritures;
  }
}
