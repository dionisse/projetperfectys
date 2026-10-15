/**
 * Calendrier fiscal et périodes.
 *
 * Les dates civiles sont des chaînes `AAAA-MM-JJ`, jamais des `Date` : un `Date` porte un fuseau
 * horaire, et une date comptable n'en a pas. Le 31/12/2026 est le 31/12/2026 à Cotonou comme à
 * Paris.
 *
 * Comme Sage 300, l'exercice comporte ses périodes normales **plus deux périodes
 * supplémentaires** : l'une pour les ajustements de fin d'exercice, l'autre pour les écritures de
 * clôture. Elles existent avant d'en avoir besoin, sinon la clôture se fait hors calendrier.
 */

import { ErreurRegle } from "./montants";

export type DateCivile = string;

export type TypePeriode = "normale" | "ajustement" | "cloture";

export interface Periode {
  numero: number;
  annee: number;
  /** Mois civil pour une période normale ; `null` pour l'ajustement et la clôture. */
  mois: number | null;
  libelle: string;
  type: TypePeriode;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  clots: boolean;
}

export interface Exercice {
  annee: number;
  moisDeDepart: number;
  dateDebut: DateCivile;
  dateFin: DateCivile;
  periodes: Periode[];
}

const JOURS_PAR_MOIS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

export function joursDuMois(annee: number, mois: number): number {
  if (mois < 1 || mois > 12) {
    throw new ErreurRegle(`Mois invalide : ${mois}.`);
  }
  const base = JOURS_PAR_MOIS[mois - 1] ?? 30;
  return mois === 2 && estBissextile(annee) ? 29 : base;
}

export function dateCivile(annee: number, mois: number, jour: number): DateCivile {
  const maximum = joursDuMois(annee, mois);
  if (jour < 1 || jour > maximum) {
    throw new ErreurRegle(`Date invalide : ${jour}/${mois}/${annee}.`);
  }
  return `${annee.toString().padStart(4, "0")}-${mois.toString().padStart(2, "0")}-${jour
    .toString()
    .padStart(2, "0")}`;
}

export function decomposerDate(date: DateCivile): { annee: number; mois: number; jour: number } {
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!correspondance) {
    throw new ErreurRegle(`Date illisible : « ${date} ». Format attendu AAAA-MM-JJ.`);
  }
  const [, annee, mois, jour] = correspondance;
  return { annee: Number(annee), mois: Number(mois), jour: Number(jour) };
}

export function formaterDateFr(date: DateCivile): string {
  const { annee, mois, jour } = decomposerDate(date);
  return `${jour.toString().padStart(2, "0")}/${mois.toString().padStart(2, "0")}/${annee}`;
}

export function anneeDe(date: DateCivile): number {
  return decomposerDate(date).annee;
}

export function ajouterMois(date: DateCivile, mois: number): DateCivile {
  const { annee, mois: moisCourant, jour } = decomposerDate(date);
  const total = moisCourant - 1 + mois;
  const anneeCible = annee + Math.floor(total / 12);
  const moisCible = ((total % 12) + 12) % 12 + 1;
  const jourCible = Math.min(jour, joursDuMois(anneeCible, moisCible));
  return dateCivile(anneeCible, moisCible, jourCible);
}

/**
 * Construit un exercice : `nombrePeriodes` périodes normales (12 pour des mois civils),
 * puis la période d'ajustement et la période de clôture.
 */
export function creerExercice(annee: number, moisDeDepart = 1, nombrePeriodes = 12): Exercice {
  if (nombrePeriodes !== 12 && nombrePeriodes !== 13) {
    throw new ErreurRegle("Un exercice comporte 12 ou 13 périodes, jamais un autre nombre.");
  }
  if (moisDeDepart < 1 || moisDeDepart > 12) {
    throw new ErreurRegle(`Mois de départ invalide : ${moisDeDepart}.`);
  }

  const periodes: Periode[] = [];
  for (let index = 0; index < nombrePeriodes; index += 1) {
    const mois = ((moisDeDepart - 1 + index) % 12) + 1;
    const anneePeriode = annee + Math.floor((moisDeDepart - 1 + index) / 12);
    const debut = dateCivile(anneePeriode, mois, 1);
    const fin = dateCivile(anneePeriode, mois, joursDuMois(anneePeriode, mois));
    periodes.push({
      numero: index + 1,
      annee: anneePeriode,
      mois,
      libelle: libelleDuMois(mois),
      type: "normale",
      dateDebut: debut,
      dateFin: fin,
      clots: false
    });
  }

  const derniere = periodes[periodes.length - 1];
  if (!derniere) {
    throw new ErreurRegle("Aucune période créée : exercice invalide.");
  }
  // Les deux périodes supplémentaires couvrent la fin de l'exercice, sans mois civil propre.
  const { annee: anneeFin } = decomposerDate(derniere.dateFin);
  periodes.push({
    numero: nombrePeriodes + 1,
    annee: anneeFin,
    mois: null,
    libelle: "Ajustements de fin d'exercice",
    type: "ajustement",
    dateDebut: derniere.dateFin,
    dateFin: derniere.dateFin,
    clots: false
  });
  periodes.push({
    numero: nombrePeriodes + 2,
    annee: anneeFin,
    mois: null,
    libelle: "Écritures de clôture",
    type: "cloture",
    dateDebut: derniere.dateFin,
    dateFin: derniere.dateFin,
    clots: false
  });

  const premiere = periodes[0];
  if (!premiere) {
    throw new ErreurRegle("Aucune période créée : exercice invalide.");
  }
  return {
    annee,
    moisDeDepart,
    dateDebut: premiere.dateDebut,
    dateFin: derniere.dateFin,
    periodes
  };
}

function libelleDuMois(mois: number): string {
  const libelles = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre"
  ];
  return libelles[mois - 1] ?? `Mois ${mois}`;
}

/** Période normale contenant une date, ou échec explicite : jamais de période devinée. */
export function periodeDeDate(exercice: Exercice, date: DateCivile): Periode {
  const trouvee = exercice.periodes.find(
    (periode) => periode.type === "normale" && date >= periode.dateDebut && date <= periode.dateFin
  );
  if (!trouvee) {
    throw new ErreurRegle(
      `La date ${formaterDateFr(date)} est hors de l'exercice ${exercice.annee} ` +
        `(${formaterDateFr(exercice.dateDebut)} – ${formaterDateFr(exercice.dateFin)}).`
    );
  }
  return trouvee;
}

export function periodeParNumero(exercice: Exercice, numero: number): Periode {
  const trouvee = exercice.periodes.find((periode) => periode.numero === numero);
  if (!trouvee) {
    throw new ErreurRegle(`La période ${numero} n'existe pas dans l'exercice ${exercice.annee}.`);
  }
  return trouvee;
}

/**
 * Clôture une période. Une période clôturée refuse toute écriture : c'est le verrou qui rend la
 * comptabilité figeable, et il ne se lève qu'explicitement.
 */
export function cloturerPeriode(exercice: Exercice, numero: number): Exercice {
  periodeParNumero(exercice, numero);
  return {
    ...exercice,
    periodes: exercice.periodes.map((item) => (item.numero === numero ? { ...item, clots: true } : item))
  };
}

export function ouvrirPeriode(exercice: Exercice, numero: number): Exercice {
  periodeParNumero(exercice, numero);
  return {
    ...exercice,
    periodes: exercice.periodes.map((item) => (item.numero === numero ? { ...item, clots: false } : item))
  };
}
