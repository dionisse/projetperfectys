/**
 * Référentiel SYSCOHADA révisé.
 *
 * Le SYSCOHADA révisé est le plan comptable obligatoire des États membres de l'OHADA depuis le
 * 1ᵉʳ janvier 2018. Il est **commun à tous ces États** : le Bénin n'y ajoute pas de comptes
 * nationaux. Ce qui varie d'un pays à l'autre, ce sont les taux, les identifiants fiscaux et les
 * obligations déclaratives — cela relève du paquet pays (`pays/benin.ts`), pas du référentiel.
 *
 * **Honnêteté sur l'étendue** : ce fichier est un **jeu de démarrage v1**. Les classes, leurs
 * divisions à deux chiffres et les comptes repris du catalogue fourni par l'utilisateur
 * (`SyscohadaStarterCatalog.cs`) sont solides ; les subdivisions les plus fines doivent être
 * revues sur l'annexe de l'Acte uniforme avant d'être proposées à un cabinet. Chaque compte porte
 * donc son groupe d'état, et rien n'est deviné sur les soldes.
 */

import type { ClasseDeCompte, CompteDuPlan, GroupeDeComptes, StructureDeComptes } from "../comptes";

export const CODE_REFERENTIEL = "SYSCOHADA-R";

export const NOM_REFERENTIEL = "SYSCOHADA révisé";

export const VERSION_REFERENTIEL = "Acte uniforme OHADA relatif au droit comptable et à l'information financière, applicable au 01/01/2018";

/**
 * Structure de comptes par défaut : compte principal du plan, tiers, axe analytique.
 * Les deux derniers segments sont facultatifs, pour qu'un cabinet sans analytique ne soit pas
 * obligé de saisir des zéros.
 */
export const STRUCTURE_SYSCOHADA: StructureDeComptes = {
  code: "SYSCOHADA-3",
  libelle: "Compte principal, tiers, axe analytique",
  separateur: "-",
  segments: [
    { code: "COMPTE", libelle: "Compte principal", longueur: 6, obligatoire: true },
    { code: "TIERS", libelle: "Tiers", longueur: 10, obligatoire: false },
    { code: "AXE", libelle: "Axe analytique", longueur: 8, obligatoire: false }
  ]
};

export const CLASSES_SYSCOHADA: ClasseDeCompte[] = [
  { code: "1", libelle: "Comptes de ressources durables", nature: "ressources-durables" },
  { code: "2", libelle: "Comptes d'actif immobilisé", nature: "actif-immobilise" },
  { code: "3", libelle: "Comptes de stocks", nature: "actif-circulant" },
  { code: "4", libelle: "Comptes de tiers", nature: "tiers" },
  { code: "5", libelle: "Comptes de trésorerie", nature: "tresorerie" },
  { code: "6", libelle: "Comptes de charges des activités ordinaires", nature: "charge" },
  { code: "7", libelle: "Comptes de produits des activités ordinaires", nature: "produit" },
  { code: "8", libelle: "Comptes des autres charges et des autres produits", nature: "autres" },
  { code: "9", libelle: "Comptes analytiques", nature: "speciaux" },
  { code: "0", libelle: "Comptes spéciaux et engagements", nature: "speciaux" }
];

/**
 * Groupes de comptes : ce sont eux qui alimentent les états financiers OHADA révisé, exactement
 * comme les *Account Groups* de Sage alimentent Financial Reporter. Un compte appartient à un
 * groupe, et un groupe appartient à un état.
 */
export const GROUPES_SYSCOHADA: GroupeDeComptes[] = [
  { code: "CAP", libelle: "Capitaux propres", etat: "bilan" },
  { code: "DET-ST", libelle: "Dettes stables", etat: "bilan" },
  { code: "IMMO-INC", libelle: "Immobilisations incorporelles", etat: "bilan" },
  { code: "IMMO-COR", libelle: "Immobilisations corporelles", etat: "bilan" },
  { code: "IMMO-AM", libelle: "Amortissements et dépréciations d'immobilisations", etat: "bilan" },
  { code: "IMMO-FIN", libelle: "Immobilisations financières", etat: "bilan" },
  { code: "STOCK", libelle: "Stocks", etat: "bilan" },
  { code: "CREANCE", libelle: "Créances de l'actif circulant", etat: "bilan" },
  { code: "TRES-ACT", libelle: "Trésorerie actif", etat: "bilan" },
  { code: "DETTE-CIRC", libelle: "Dettes du passif circulant", etat: "bilan" },
  { code: "TRES-PAS", libelle: "Trésorerie passif", etat: "bilan" },
  { code: "CHG-EXP", libelle: "Charges d'exploitation", etat: "resultat" },
  { code: "CHG-PERS", libelle: "Charges de personnel", etat: "resultat" },
  { code: "CHG-IMP", libelle: "Impôts et taxes", etat: "resultat" },
  { code: "CHG-FIN", libelle: "Charges financières", etat: "resultat" },
  { code: "CHG-DOT", libelle: "Dotations aux amortissements et provisions", etat: "resultat" },
  { code: "PRD-EXP", libelle: "Produits d'exploitation", etat: "resultat" },
  { code: "PRD-FIN", libelle: "Produits financiers", etat: "resultat" },
  { code: "CHG-HAO", libelle: "Charges hors activités ordinaires", etat: "resultat" },
  { code: "PRD-HAO", libelle: "Produits hors activités ordinaires", etat: "resultat" },
  { code: "IS", libelle: "Impôts sur les résultats", etat: "resultat" },
  { code: "ENG", libelle: "Engagements hors bilan", etat: "hors-etat" }
];

/**
 * Jeu de démarrage : comptes les plus utilisés par une PME commerciale béninoise, avec les
 * comptes d'État dont les codes de taxe ont besoin.
 */
export const PLAN_DEMARRAGE_SYSCOHADA: CompteDuPlan[] = [
  // ---- Classe 1 : ressources durables
  { numero: "101000", libelle: "Capital social", groupe: "CAP" },
  { numero: "111000", libelle: "Report à nouveau", groupe: "CAP" },
  { numero: "121000", libelle: "Résultat de l'exercice", groupe: "CAP" },
  { numero: "131000", libelle: "Subventions d'investissement reçues", groupe: "CAP" },
  { numero: "151000", libelle: "Provisions pour risques", groupe: "DET-ST" },
  { numero: "161000", libelle: "Emprunts et dettes auprès des établissements de crédit", groupe: "DET-ST" },

  // ---- Classe 2 : actif immobilisé
  { numero: "201000", libelle: "Frais d'établissement", groupe: "IMMO-INC" },
  { numero: "211000", libelle: "Terrains", groupe: "IMMO-COR" },
  { numero: "231000", libelle: "Bâtiments", groupe: "IMMO-COR" },
  { numero: "244000", libelle: "Matériel et mobilier", groupe: "IMMO-COR" },
  { numero: "245000", libelle: "Matériel de transport", groupe: "IMMO-COR" },
  { numero: "261000", libelle: "Titres de participation", groupe: "IMMO-FIN" },

  // ---- Classe 3 : stocks
  { numero: "311000", libelle: "Marchandises", groupe: "STOCK" },
  { numero: "321000", libelle: "Matières et fournitures", groupe: "STOCK" },

  // ---- Classe 4 : tiers (les comptes auxiliaires exigent un tiers)
  { numero: "401100", libelle: "Fournisseurs d'exploitation", groupe: "DETTE-CIRC", exigeTiers: true },
  { numero: "411100", libelle: "Clients", groupe: "CREANCE", exigeTiers: true },
  { numero: "421000", libelle: "Personnel, rémunérations dues", groupe: "DETTE-CIRC", exigeTiers: true },
  { numero: "431000", libelle: "Organismes sociaux", groupe: "DETTE-CIRC" },
  { numero: "442100", libelle: "État, impôts et taxes retenus", groupe: "DETTE-CIRC" },
  { numero: "443100", libelle: "État, TVA facturée sur ventes", groupe: "DETTE-CIRC" },
  { numero: "444100", libelle: "État, TVA due", groupe: "DETTE-CIRC" },
  { numero: "444900", libelle: "État, TVA, crédit à reporter", groupe: "CREANCE" },
  { numero: "445200", libelle: "État, TVA récupérable sur achats", groupe: "CREANCE" },
  { numero: "446000", libelle: "État, autres impôts et taxes à payer", groupe: "DETTE-CIRC" },
  { numero: "461000", libelle: "Associés, comptes courants", groupe: "DETTE-CIRC", exigeTiers: true },
  { numero: "471000", libelle: "Débiteurs divers", groupe: "CREANCE", exigeTiers: true },

  // ---- Classe 5 : trésorerie
  { numero: "521100", libelle: "Banque principale", groupe: "TRES-ACT" },
  { numero: "571100", libelle: "Caisse siège social", groupe: "TRES-ACT" },
  { numero: "581000", libelle: "Virements internes", groupe: "TRES-ACT" },

  // ---- Classe 6 : charges des activités ordinaires
  { numero: "601100", libelle: "Achats de marchandises", groupe: "CHG-EXP" },
  { numero: "604100", libelle: "Achats stockés de matières et fournitures", groupe: "CHG-EXP" },
  { numero: "611000", libelle: "Transports sur ventes", groupe: "CHG-EXP" },
  { numero: "622000", libelle: "Locations et charges locatives", groupe: "CHG-EXP" },
  { numero: "626000", libelle: "Frais postaux et de télécommunications", groupe: "CHG-EXP" },
  { numero: "631000", libelle: "Rémunérations du personnel extérieur", groupe: "CHG-EXP" },
  { numero: "635000", libelle: "Entretien, réparations et maintenance", groupe: "CHG-EXP" },
  { numero: "641000", libelle: "Impôts et taxes directs", groupe: "CHG-IMP" },
  { numero: "646000", libelle: "Droits d'enregistrement", groupe: "CHG-IMP" },
  { numero: "647000", libelle: "Pénalités et amendes fiscales", groupe: "CHG-IMP" },
  { numero: "661100", libelle: "Rémunérations directes versées au personnel", groupe: "CHG-PERS" },
  { numero: "664100", libelle: "Charges sociales sur rémunérations", groupe: "CHG-PERS" },
  { numero: "671000", libelle: "Intérêts des emprunts", groupe: "CHG-FIN" },
  { numero: "674000", libelle: "Pertes de change", groupe: "CHG-FIN" },
  { numero: "681000", libelle: "Dotations aux amortissements", groupe: "CHG-DOT" },
  { numero: "697000", libelle: "Dotations aux provisions pour dépréciation", groupe: "CHG-DOT" },

  // ---- Classe 7 : produits des activités ordinaires
  { numero: "701100", libelle: "Ventes de marchandises", groupe: "PRD-EXP" },
  { numero: "706100", libelle: "Services vendus", groupe: "PRD-EXP" },
  { numero: "711000", libelle: "Variation de stocks de marchandises", groupe: "PRD-EXP" },
  { numero: "751000", libelle: "Redevances pour concessions, brevets et licences", groupe: "PRD-EXP" },
  { numero: "758000", libelle: "Produits divers de gestion courante", groupe: "PRD-EXP" },
  { numero: "771000", libelle: "Intérêts de prêts", groupe: "PRD-FIN" },
  { numero: "776000", libelle: "Gains de change", groupe: "PRD-FIN" },

  // ---- Classe 8 : hors activités ordinaires et impôts sur les résultats
  { numero: "811000", libelle: "Charges hors activités ordinaires", groupe: "CHG-HAO" },
  { numero: "821000", libelle: "Produits hors activités ordinaires", groupe: "PRD-HAO" },
  { numero: "891000", libelle: "Impôts sur les résultats", groupe: "IS" }
];

export interface Referentiel {
  code: string;
  nom: string;
  version: string;
  structure: StructureDeComptes;
  classes: ClasseDeCompte[];
  groupes: GroupeDeComptes[];
  plan: CompteDuPlan[];
}

export const SYSCOHADA_REVISE: Referentiel = {
  code: CODE_REFERENTIEL,
  nom: NOM_REFERENTIEL,
  version: VERSION_REFERENTIEL,
  structure: STRUCTURE_SYSCOHADA,
  classes: CLASSES_SYSCOHADA,
  groupes: GROUPES_SYSCOHADA,
  plan: PLAN_DEMARRAGE_SYSCOHADA
};

export function classeDuReferentiel(referentiel: Referentiel, code: string): ClasseDeCompte {
  const trouvee = referentiel.classes.find((classe) => classe.code === code);
  if (!trouvee) {
    throw new Error(`Classe inconnue du référentiel ${referentiel.code} : ${code}.`);
  }
  return trouvee;
}

export function groupeDuReferentiel(referentiel: Referentiel, code: string): GroupeDeComptes {
  const trouve = referentiel.groupes.find((groupe) => groupe.code === code);
  if (!trouve) {
    throw new Error(`Groupe de comptes inconnu du référentiel ${referentiel.code} : ${code}.`);
  }
  return trouve;
}
