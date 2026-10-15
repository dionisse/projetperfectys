/**
 * Montants monétaires exacts.
 *
 * Décision « meilleure version » : toutes les valeurs monétaires du noyau sont des
 * entiers `bigint` exprimés en centièmes d'unité (unités minoritaires), jamais des
 * `number` flottants. La sérialisation (IndexedDB, JSON, API) se fait en chaînes
 * décimales via {@link amountToDecimal} / {@link amountFromDecimal}.
 *
 * Source C# d'origine : Perfecto.Domain/Accounting/AccountingEntryLine.cs
 * (decimal.Round(debit, 2, MidpointRounding.ToEven)).
 */

/** Centièmes d'unité monétaire (ex. 1 500 000 XOF = 150000000n). */
export type Amount = bigint;

export const AMOUNT_ZERO: Amount = 0n;

const DIGITS_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/;

function numberToText(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Montant non numérique : ${value}`);
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(10);
}

/**
 * Convertit une valeur décimale (chaîne ou number) en unités minoritaires,
 * avec arrondi « au plus pair » (banker's rounding) à 2 décimales, comme le
 * faisait `MidpointRounding.ToEven` côté C#.
 */
export function amountFromDecimal(input: string | number): Amount {
  const text = typeof input === "number" ? numberToText(input) : input.trim();
  const match = DIGITS_RE.exec(text);
  if (!match) {
    throw new RangeError(`Montant invalide : « ${input} »`);
  }

  const [, sign, intPart, fracPart = ""] = match;
  const kept = (fracPart + "00").slice(0, 2);
  const rest = fracPart.slice(2);
  let minor = BigInt(intPart + kept);

  const firstDropped = rest.length > 0 ? Number(rest[0]) : 0;
  const beyond = rest.slice(1).split("").some((digit) => digit !== "0");
  if (firstDropped > 5 || (firstDropped === 5 && beyond)) {
    minor += 1n;
  } else if (firstDropped === 5 && !beyond && minor % 2n === 1n) {
    minor += 1n;
  }

  return sign === "-" ? -minor : minor;
}

/** Représentation décimale stable pour stockage et échanges (« 1500000 », « 12.35 »). */
export function amountToDecimal(amount: Amount): string {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const int = abs / 100n;
  const frac = abs % 100n;
  const text = frac === 0n ? int.toString() : `${int.toString()}.${frac.toString().padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

export function amountAdd(left: Amount, right: Amount): Amount {
  return left + right;
}

export function amountSubtract(left: Amount, right: Amount): Amount {
  return left - right;
}

export function amountAbs(amount: Amount): Amount {
  return amount < 0n ? -amount : amount;
}

export function amountIsZero(amount: Amount): boolean {
  return amount === 0n;
}

export function amountCompare(left: Amount, right: Amount): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Formatage français. Le XOF n'a pas de subdivision usuelle à l'affichage :
 * on présente des unités entières, comme les écrans du Lot 1 (« 2 832 000 XOF »).
 */
export function formatAmount(amount: Amount, currency = "XOF"): string {
  const units = Number(amount / 100n);
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(units);
  return `${formatted} ${currency}`;
}

/**
 * Montant groupé à la française, sans devise (« 2 832 000 », « -472 000 »).
 *
 * Destiné aux documents exportés : le séparateur de milliers est une **espace simple**,
 * jamais l'espace insécable étroite (U+202F) produite par `Intl` en `fr-FR`, que les
 * polices standard des PDF (encodage WinAnsi) ne contiennent pas.
 */
export function formatAmountGrouped(amount: Amount): string {
  const units = amount < 0n ? -Number(-amount / 100n) : Number(amount / 100n);
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(units);
  return formatted.replace(/[\u202F\u00A0\u2009]/g, " ");
}

/**
 * Valeur numérique en unités monétaires, pour les cellules calculables d'un tableur.
 *
 * Le XOF n'a pas de subdivision usuelle ; les deux décimales du noyau sont conservées
 * (un format de cellule `#,##0.00` les affiche si besoin).
 */
export function amountToNumber(amount: Amount): number {
  return Number(amount) / 100;
}
