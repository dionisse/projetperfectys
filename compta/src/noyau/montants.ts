/**
 * Montants exacts.
 *
 * Aucune valeur monétaire n'est représentée par un nombre flottant : `0.1 + 0.2 !== 0.3` en
 * IEEE-754, et une comptabilité qui arrondit mal n'est pas opposable. Un montant est un
 * **entier de unités mineures** (`bigint`), la devise disant combien de décimales elle affiche.
 * Pour le franc CFA (`XOF`), la décimale d'usage est nulle : l'unité mineure est le franc.
 */

export interface Devise {
  /** Code ISO 4217 (`XOF`). */
  code: string;
  nom: string;
  symbole: string;
  /** Nombre de décimales affichées et stockées : 0 pour le XOF, 2 pour l'euro. */
  decimales: number;
}

export const XOF: Devise = { code: "XOF", nom: "franc CFA", symbole: "FCFA", decimales: 0 };

/** Montant en unités mineures de la devise. */
export type Montant = bigint;

export const ZERO: Montant = 0n;

/** Séparateur de milliers français : espace insécable fine, comme dans les documents fiscaux. */
export const SEPARATEUR_MILLIERS = "\u202f";

/** Erreur de règle métier, au message français destiné à l'utilisateur. */
export class ErreurRegle extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurRegle";
  }
}

/** Division entière avec arrondi au plus proche, à mi-chemin vers le haut en valeur absolue. */
export function diviserArrondi(numerateur: bigint, denominateur: bigint): bigint {
  if (denominateur === 0n) {
    throw new ErreurRegle("Division par zéro.");
  }
  const negatif = (numerateur < 0n) !== (denominateur < 0n);
  const nombre = numerateur < 0n ? -numerateur : numerateur;
  const diviseur = denominateur < 0n ? -denominateur : denominateur;
  const quotient = nombre / diviseur;
  const reste = nombre % diviseur;
  const arrondi = reste * 2n >= diviseur ? quotient + 1n : quotient;
  return negatif ? -arrondi : arrondi;
}

/**
 * Lit une saisie utilisateur : `1 234 567`, `1234567.50`, `1234567,50`, `-100`.
 * Les espaces (y compris insécables) sont ignorés ; la virgule et le point décimal sont
 * acceptés, parce que le comptable utilise l'un ou l'autre selon son clavier.
 */
export function analyserMontant(texte: string, devise: Devise = XOF): Montant {
  const nettoye = texte
    .replace(/[\s\u00a0\u202f\u2009]/g, "")
    .replace(/(FCFA|XOF)$/i, "")
    .trim();
  if (nettoye === "" || nettoye === "-") {
    throw new ErreurRegle("Le montant est obligatoire.");
  }
  const negatif = nettoye.startsWith("-");
  const corps = negatif ? nettoye.slice(1) : nettoye;
  const [partieEntiere, partieDecimale = ""] = corps.split(/[.,]/);
  if (!/^\d+$/.test(partieEntiere ?? "") || (corps.includes(".") && corps.includes(","))) {
    throw new ErreurRegle(`Montant illisible : « ${texte} ». Utilisez des chiffres, sans lettre.`);
  }
  if (partieDecimale.length > devise.decimales) {
    throw new ErreurRegle(
      `Le ${devise.nom} ne comporte pas plus de ${devise.decimales} décimale(s) : « ${texte} » est refusé.`
    );
  }
  const facteur = 10n ** BigInt(devise.decimales);
  const decimalesNormalisees = partieDecimale.padEnd(devise.decimales, "0");
  const valeur = BigInt(partieEntiere ?? "0") * facteur + BigInt(decimalesNormalisees || "0");
  return negatif ? -valeur : valeur;
}

/** Formate pour l'affichage et pour les documents : `1 234 567` en XOF. */
export function formatMontant(montant: Montant, devise: Devise = XOF): string {
  const negatif = montant < 0n;
  const facteur = 10n ** BigInt(devise.decimales);
  const absolu = negatif ? -montant : montant;
  const partieEntiere = (absolu / facteur).toString();
  const partieDecimale = (absolu % facteur).toString().padStart(devise.decimales, "0");
  const groupes = partieEntiere.replace(/\B(?=(\d{3})+(?!\d))/g, SEPARATEUR_MILLIERS);
  const corps = devise.decimales > 0 ? `${groupes},${partieDecimale}` : groupes;
  return negatif ? `-${corps}` : corps;
}

export function additionner(...montants: Montant[]): Montant {
  return montants.reduce<Montant>((total, montant) => total + montant, ZERO);
}

export function somme(montants: readonly Montant[]): Montant {
  return additionner(...montants);
}

export function soustraire(gauche: Montant, droite: Montant): Montant {
  return gauche - droite;
}

export function oppose(montant: Montant): Montant {
  return -montant;
}

export function absolu(montant: Montant): Montant {
  return montant < ZERO ? -montant : montant;
}

export function estNul(montant: Montant): boolean {
  return montant === ZERO;
}

export function estPositif(montant: Montant): boolean {
  return montant > ZERO;
}

export function estNegatif(montant: Montant): boolean {
  return montant < ZERO;
}

export function comparer(gauche: Montant, droite: Montant): number {
  if (gauche < droite) return -1;
  if (gauche > droite) return 1;
  return 0;
}

/**
 * Applique un taux exprimé en **points de base** (18 % = 1800, 1 % = 100, 1 ‰ = 10).
 * Le taux entier évite toute dérive flottante dans un calcul de taxe.
 */
export function appliquerTaux(montant: Montant, pointsDeBase: bigint | number): Montant {
  const taux = BigInt(pointsDeBase);
  return diviserArrondi(montant * taux, 10_000n);
}

/**
 * Extrait la part de taxe d'un montant toutes taxes comprises.
 * `TTC = HT × (1 + taux)` ⇒ `taxe = TTC × taux / (10000 + taux)`.
 */
export function taxeSurTTC(montantTTC: Montant, pointsDeBase: bigint | number): Montant {
  const taux = BigInt(pointsDeBase);
  return diviserArrondi(montantTTC * taux, 10_000n + taux);
}

/** Montant hors taxe correspondant à un montant toutes taxes comprises. */
export function horsTaxeDepuisTTC(montantTTC: Montant, pointsDeBase: bigint | number): Montant {
  return montantTTC - taxeSurTTC(montantTTC, pointsDeBase);
}

/** Sérialisation stable : les `bigint` ne passent pas en JSON. */
export function montantVersChaine(montant: Montant): string {
  return montant.toString();
}

export function montantDepuisChaine(texte: string): Montant {
  if (!/^-?\d+$/.test(texte)) {
    throw new ErreurRegle(`Montant stocké illisible : « ${texte} ».`);
  }
  return BigInt(texte);
}
