/* PERFECTO · Transcription fidèle du PDF joint, sans compléter les cellules vides. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoAssociatedAccountItems = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var metadata = Object.freeze({
  "title": "Postes associés aux comptes",
  "sourceFile": "poste associés aux comptes.pdf",
  "sourcePdfSha256": "830bfe4df85a74944cd435a707259d3d45ec9ea6d044e176bbeb421708064e70",
  "sourcePages": 4,
  "sourceRowCount": 193,
  "rowsWithAtLeastOnePost": 161,
  "rowsWithBothPostsBlank": 32,
  "sourceReportTitle": "Anomalie sur le plan comptable au 24/10/2026",
  "sourceOrganization": "HERALD EXPERTISE ET CONSEIL",
  "sourceEntity": "Dares Services Sarl"
});
  var records = [
  {
    "code": "101000",
    "label": "Capital Social",
    "debit": "CA",
    "credit": "CA",
    "page": 1
  },
  {
    "code": "102",
    "label": "Capital par Dotation",
    "debit": "CA",
    "credit": "CA",
    "page": 1
  },
  {
    "code": "103",
    "label": "Capital Personnel",
    "debit": "CA",
    "credit": "CA",
    "page": 1
  },
  {
    "code": "104",
    "label": "Compte de l'Exploitant",
    "debit": "CA",
    "credit": "CA",
    "page": 1
  },
  {
    "code": "105",
    "label": "Primes Liées au Capital Social",
    "debit": "CD",
    "credit": "CD",
    "page": 1
  },
  {
    "code": "106",
    "label": "Écarts de Réévaluation",
    "debit": "CE",
    "credit": "CE",
    "page": 1
  },
  {
    "code": "109",
    "label": "Apporteurs, Capital Souscrit, non Appel",
    "debit": "CB",
    "credit": "CB",
    "page": 1
  },
  {
    "code": "111",
    "label": "Réserve légale",
    "debit": "CF",
    "credit": "CF",
    "page": 1
  },
  {
    "code": "112",
    "label": "Réserves Statutaires ou Contractuelles",
    "debit": "CF",
    "credit": "CF",
    "page": 1
  },
  {
    "code": "113",
    "label": "Réserves Réglementées",
    "debit": "CF",
    "credit": "CF",
    "page": 1
  },
  {
    "code": "118",
    "label": "Autres Réserves",
    "debit": "CG",
    "credit": "CG",
    "page": 1
  },
  {
    "code": "12",
    "label": "Report a Nouveau",
    "debit": "CH",
    "credit": "CH",
    "page": 1
  },
  {
    "code": "130",
    "label": "Résultat en Instance d’affectation",
    "debit": "CH",
    "credit": "CH",
    "page": 1
  },
  {
    "code": "131",
    "label": "Résultat Net : Bénéfice",
    "debit": "CJ",
    "credit": "CJ",
    "page": 1
  },
  {
    "code": "132",
    "label": "Marge Commerciale",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "133",
    "label": "Valeur Ajoutée",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "134",
    "label": "Excédent Brut d'Exploitation",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "135",
    "label": "Résultat d'Exploitation",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "136",
    "label": "Résultat Financier",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "137",
    "label": "Résultat des Activités Ordinaires",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "138",
    "label": "Résultat hors Activités Ordinaires",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "139",
    "label": "Résultat Net : Perte",
    "debit": "CJ",
    "credit": "CJ",
    "page": 1
  },
  {
    "code": "14",
    "label": "Subventions d'Investissement",
    "debit": "CL",
    "credit": "CL",
    "page": 1
  },
  {
    "code": "15",
    "label": "Provisions Réglementées et Fonds Assimilé",
    "debit": "CM",
    "credit": "CM",
    "page": 1
  },
  {
    "code": "16",
    "label": "Emprunts et Dettes assimilées",
    "debit": "DA",
    "credit": "DA",
    "page": 1
  },
  {
    "code": "17",
    "label": "Dettes de Location Acquisition",
    "debit": "DB",
    "credit": "DB",
    "page": 1
  },
  {
    "code": "181",
    "label": "Dettes Liées à des Participations",
    "debit": "DA",
    "credit": "DA",
    "page": 1
  },
  {
    "code": "182",
    "label": "Dettes Liées à des Sociétés en Participatio",
    "debit": "DA",
    "credit": "DA",
    "page": 1
  },
  {
    "code": "183",
    "label": "Intérêts Courus/Dettes participation",
    "debit": "DA",
    "credit": "DA",
    "page": 1
  },
  {
    "code": "184",
    "label": "Comptes Permanents Bloqués des Établiss",
    "debit": "BJ",
    "credit": "DM",
    "page": 1
  },
  {
    "code": "185",
    "label": "Comptes non Bloqués des Succursales",
    "debit": "BJ",
    "credit": "DM",
    "page": 1
  },
  {
    "code": "186",
    "label": "Comptes de Liaison Charges",
    "debit": "BJ",
    "credit": "DM",
    "page": 1
  },
  {
    "code": "187",
    "label": "Comptes de Liaison Produits",
    "debit": "BJ",
    "credit": "DM",
    "page": 1
  },
  {
    "code": "188",
    "label": "Comptes de Liaison/Sociétés en Particip.",
    "debit": "BJ",
    "credit": "DM",
    "page": 1
  },
  {
    "code": "19",
    "label": "Provisions pour Risques et Charges",
    "debit": "DC",
    "credit": "DC",
    "page": 1
  },
  {
    "code": "211",
    "label": "Frais de Développement",
    "debit": "AE",
    "credit": "AE",
    "page": 1
  },
  {
    "code": "212",
    "label": "Brevets, Licences, Concessions, Droits simi",
    "debit": "AF",
    "credit": "AF",
    "page": 1
  },
  {
    "code": "213",
    "label": "Logiciels et Sites Internet",
    "debit": "AF",
    "credit": "AF",
    "page": 1
  },
  {
    "code": "214",
    "label": "Marques",
    "debit": "AF",
    "credit": "AF",
    "page": 1
  },
  {
    "code": "215",
    "label": "Fonds Commercial",
    "debit": "AG",
    "credit": "AG",
    "page": 1
  },
  {
    "code": "216",
    "label": "Droit au Bail",
    "debit": "AG",
    "credit": "AG",
    "page": 1
  },
  {
    "code": "217",
    "label": "Investissements de Création",
    "debit": "AH",
    "credit": "AH",
    "page": 1
  },
  {
    "code": "218",
    "label": "Autres Droits et Valeurs Incorporels",
    "debit": "AH",
    "credit": "AH",
    "page": 1
  },
  {
    "code": "219",
    "label": "Immobilisations Incorporelles en Cours",
    "debit": "",
    "credit": "",
    "page": 1
  },
  {
    "code": "22",
    "label": "Terrains",
    "debit": "AJ",
    "credit": "AJ",
    "page": 1
  },
  {
    "code": "231",
    "label": "Bâtiments sur sols propres",
    "debit": "AK",
    "credit": "AK",
    "page": 1
  },
  {
    "code": "232",
    "label": "Bâtiments sur sol d'autrui",
    "debit": "AK",
    "credit": "AK",
    "page": 1
  },
  {
    "code": "233",
    "label": "Ouvrages D’infrastructure",
    "debit": "AK",
    "credit": "AK",
    "page": 1
  },
  {
    "code": "234",
    "label": "Agencements et Installatipns techniques",
    "debit": "AL",
    "credit": "AL",
    "page": 1
  },
  {
    "code": "235",
    "label": "Amenagements de Bureaux",
    "debit": "AL",
    "credit": "AL",
    "page": 1
  },
  {
    "code": "237",
    "label": "Bâtiments mis en concession",
    "debit": "AK",
    "credit": "AK",
    "page": 1
  },
  {
    "code": "238",
    "label": "Autres Installations et Agencements",
    "debit": "AL",
    "credit": "AL",
    "page": 1
  },
  {
    "code": "239",
    "label": "Bâtiments,Agencements en cours",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "24",
    "label": "Materiel, Mobilier et Actifs Biologique",
    "debit": "AM",
    "credit": "AM",
    "page": 2
  },
  {
    "code": "251",
    "label": "Avances et Acomptes/Immobilions incorpor",
    "debit": "AP",
    "credit": "AP",
    "page": 2
  },
  {
    "code": "252",
    "label": "Avances et Acomptes/Immobilions corporell",
    "debit": "AP",
    "credit": "AP",
    "page": 2
  },
  {
    "code": "26",
    "label": "Titres de Participation",
    "debit": "AR",
    "credit": "AR",
    "page": 2
  },
  {
    "code": "27",
    "label": "Autres Immoblisations Financières",
    "debit": "AS",
    "credit": "AS",
    "page": 2
  },
  {
    "code": "2811",
    "label": "Frais de Développement",
    "debit": "AE",
    "credit": "AE",
    "page": 2
  },
  {
    "code": "2812",
    "label": "Brevets, Licences, Concessions, Droits simi",
    "debit": "AF",
    "credit": "AF",
    "page": 2
  },
  {
    "code": "2813",
    "label": "Logiciels et Sites Internet",
    "debit": "AF",
    "credit": "AF",
    "page": 2
  },
  {
    "code": "2814",
    "label": "Marques",
    "debit": "AF",
    "credit": "AF",
    "page": 2
  },
  {
    "code": "2815",
    "label": "Fonds Commercial",
    "debit": "AG",
    "credit": "AG",
    "page": 2
  },
  {
    "code": "2816",
    "label": "Droit au Bail",
    "debit": "AG",
    "credit": "AG",
    "page": 2
  },
  {
    "code": "2817",
    "label": "Investissements de Création",
    "debit": "AH",
    "credit": "AH",
    "page": 2
  },
  {
    "code": "2818",
    "label": "Autres Droits et Valeurs Incorporels",
    "debit": "AH",
    "credit": "AH",
    "page": 2
  },
  {
    "code": "282",
    "label": "Amortissements des Terrains",
    "debit": "AJ",
    "credit": "AJ",
    "page": 2
  },
  {
    "code": "2831",
    "label": "Bâtiments sur sols propres",
    "debit": "AK",
    "credit": "AK",
    "page": 2
  },
  {
    "code": "2832",
    "label": "Bâtiments sur sol d'autrui",
    "debit": "AK",
    "credit": "AK",
    "page": 2
  },
  {
    "code": "2833",
    "label": "Ouvrages D’infrastructure",
    "debit": "AK",
    "credit": "AK",
    "page": 2
  },
  {
    "code": "2834",
    "label": "Agencements et Installatipns techniques",
    "debit": "AL",
    "credit": "AL",
    "page": 2
  },
  {
    "code": "2835100",
    "label": "Installation générale",
    "debit": "AL",
    "credit": "AL",
    "page": 2
  },
  {
    "code": "2837",
    "label": "Bâtiments mis en concession",
    "debit": "AK",
    "credit": "AK",
    "page": 2
  },
  {
    "code": "2838",
    "label": "Autres Installations et Agencements",
    "debit": "AL",
    "credit": "AL",
    "page": 2
  },
  {
    "code": "284",
    "label": "Amortissements du Matériel",
    "debit": "AM",
    "credit": "AM",
    "page": 2
  },
  {
    "code": "291",
    "label": "Dépréciations des Immobilisations Incor",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "292",
    "label": "Dépréciations des Terrains",
    "debit": "AJ",
    "credit": "AJ",
    "page": 2
  },
  {
    "code": "293",
    "label": "Dépréciations des Bâtiments, Installati",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "294",
    "label": "Dépréciations de Matériel, du Mobilier",
    "debit": "AM",
    "credit": "AM",
    "page": 2
  },
  {
    "code": "295",
    "label": "Dépréciations des Avances et Acomptes V",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "296",
    "label": "Dépréciations des Titres de Participati",
    "debit": "AR",
    "credit": "AR",
    "page": 2
  },
  {
    "code": "297",
    "label": "Dépréciations des Autres Immobilisation",
    "debit": "AS",
    "credit": "AS",
    "page": 2
  },
  {
    "code": "31",
    "label": "Marchandises",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "32",
    "label": "Matières Premières et Fournitures Liées",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "33",
    "label": "Autres Approvisionnements",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "34",
    "label": "Produits en Cours",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "35",
    "label": "Services en Cours",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "36",
    "label": "Produits Finis",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "37",
    "label": "Produits Intermediaires et Résiduels",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "38",
    "label": "Stocks en Cours de Route, Consignation, d",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "39",
    "label": "Dépréciations/Stocks et Encours de product",
    "debit": "BB",
    "credit": "BB",
    "page": 2
  },
  {
    "code": "40",
    "label": "Fournisseurs et Comptes Rattachés",
    "debit": "BH",
    "credit": "DJ",
    "page": 2
  },
  {
    "code": "41",
    "label": "Clients et Comptes Rattachés",
    "debit": "BI",
    "credit": "DI",
    "page": 2
  },
  {
    "code": "42",
    "label": "Personnel",
    "debit": "BJ",
    "credit": "DK",
    "page": 2
  },
  {
    "code": "43",
    "label": "Organismes Sociaux",
    "debit": "BJ",
    "credit": "DK",
    "page": 2
  },
  {
    "code": "44",
    "label": "État et Collectivités Publiques",
    "debit": "BJ",
    "credit": "DK",
    "page": 2
  },
  {
    "code": "45",
    "label": "Organismes Internationaux",
    "debit": "BJ",
    "credit": "DM",
    "page": 2
  },
  {
    "code": "46",
    "label": "Apporteurs, Associés et Groupe",
    "debit": "BJ",
    "credit": "DM",
    "page": 2
  },
  {
    "code": "47",
    "label": "Débiteurs et Créditeurs Divers",
    "debit": "BJ",
    "credit": "DM",
    "page": 2
  },
  {
    "code": "4811",
    "label": "Immobilisations incorporelles",
    "debit": "DH",
    "credit": "DH",
    "page": 2
  },
  {
    "code": "4812",
    "label": "Immobilisations corporelles",
    "debit": "DH",
    "credit": "DH",
    "page": 2
  },
  {
    "code": "4813",
    "label": "Versements restant à effectuer sur titres",
    "debit": "DH",
    "credit": "DH",
    "page": 2
  },
  {
    "code": "482",
    "label": "Fournisseurs d'Investissements, Effets à pa",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "484",
    "label": "Autres Dettes hors Activites Ordinaires",
    "debit": "",
    "credit": "",
    "page": 2
  },
  {
    "code": "485",
    "label": "Créances sur Cessions d'Immobilisations",
    "debit": "",
    "credit": "",
    "page": 3
  },
  {
    "code": "488",
    "label": "Autres Créances hors Activités Ordinaires",
    "debit": "BA",
    "credit": "",
    "page": 3
  },
  {
    "code": "490",
    "label": "Dépréciations des Comptes Fournisseurs",
    "debit": "BH",
    "credit": "BH",
    "page": 3
  },
  {
    "code": "491",
    "label": "Dépréciations des Comptes Clients",
    "debit": "BI",
    "credit": "BI",
    "page": 3
  },
  {
    "code": "492",
    "label": "Dépréciations des Comptes Personnel",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "493",
    "label": "Dépréciations des Comptes Organismes So",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "494",
    "label": "Dépréciations/État et Collectivités publiques",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "495",
    "label": "Dépréciations/Comptes Organismes Interna",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "496",
    "label": "Dépréciations/Comptes Associés et Groupe",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "497",
    "label": "Dépréciations des Comptes Débiteurs Diver",
    "debit": "BJ",
    "credit": "BJ",
    "page": 3
  },
  {
    "code": "498",
    "label": "Dépréciations des Comptes de Créances H",
    "debit": "BA",
    "credit": "BA",
    "page": 3
  },
  {
    "code": "499",
    "label": "Provisions pour Risques à Court Terme",
    "debit": "DN",
    "credit": "DN",
    "page": 3
  },
  {
    "code": "50",
    "label": "Titres de Placement",
    "debit": "BQ",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "51",
    "label": "Valeurs à Encaisser",
    "debit": "BR",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "52",
    "label": "Banques",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "53",
    "label": "Établissements Financiers et Assimilés",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "54",
    "label": "Instruments de Trésorerie",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "55",
    "label": "Instruments de Monnaie Electronique",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "56",
    "label": "Banques, Crédits de Trésorerie et d'Escom",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "57",
    "label": "Caisse",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "58",
    "label": "Régies d'avances, accréditifs et Vir. intenes",
    "debit": "BS",
    "credit": "DR",
    "page": 3
  },
  {
    "code": "590",
    "label": "Dépréciations des Titres de Placement",
    "debit": "BQ",
    "credit": "BQ",
    "page": 3
  },
  {
    "code": "591",
    "label": "Dépréciations des Titres et Valeurs",
    "debit": "BR",
    "credit": "BR",
    "page": 3
  },
  {
    "code": "592",
    "label": "Dépréciations des Comptes Banques",
    "debit": "BS",
    "credit": "BS",
    "page": 3
  },
  {
    "code": "593",
    "label": "Dépréciations des Comptes Établissement",
    "debit": "BS",
    "credit": "BS",
    "page": 3
  },
  {
    "code": "594",
    "label": "Dépréciations/Instruments de trsorerie",
    "debit": "BS",
    "credit": "BS",
    "page": 3
  },
  {
    "code": "599",
    "label": "Provisions pour Risque à Court Terme",
    "debit": "DN",
    "credit": "DN",
    "page": 3
  },
  {
    "code": "601",
    "label": "Achats de Marchandises",
    "debit": "RA",
    "credit": "RA",
    "page": 3
  },
  {
    "code": "602",
    "label": "Achats de Matières Premières et Fourniture",
    "debit": "RC",
    "credit": "RC",
    "page": 3
  },
  {
    "code": "6031",
    "label": "Marchandises",
    "debit": "RB",
    "credit": "RB",
    "page": 3
  },
  {
    "code": "6032",
    "label": "Matières premières",
    "debit": "RD",
    "credit": "RD",
    "page": 3
  },
  {
    "code": "6033",
    "label": "Autres approvisionnements",
    "debit": "RF",
    "credit": "RF",
    "page": 3
  },
  {
    "code": "604",
    "label": "Achats Stockés de Matières et Fournitures",
    "debit": "RE",
    "credit": "RE",
    "page": 3
  },
  {
    "code": "605",
    "label": "Autres Achats",
    "debit": "RE",
    "credit": "RE",
    "page": 3
  },
  {
    "code": "608",
    "label": "Achats d'Emballages",
    "debit": "RE",
    "credit": "RE",
    "page": 3
  },
  {
    "code": "61",
    "label": "Transports",
    "debit": "RG",
    "credit": "RG",
    "page": 3
  },
  {
    "code": "62",
    "label": "Services Extérieurs",
    "debit": "RH",
    "credit": "RH",
    "page": 3
  },
  {
    "code": "63",
    "label": "Autres Services Extérieurs",
    "debit": "RH",
    "credit": "RH",
    "page": 3
  },
  {
    "code": "64",
    "label": "Impôts et Taxes",
    "debit": "RI",
    "credit": "RI",
    "page": 3
  },
  {
    "code": "65",
    "label": "Autres Charges",
    "debit": "RJ",
    "credit": "RJ",
    "page": 3
  },
  {
    "code": "66",
    "label": "Charges de Personnel",
    "debit": "RK",
    "credit": "RK",
    "page": 3
  },
  {
    "code": "67",
    "label": "Frais Financiers et Charges Assimilées",
    "debit": "RM",
    "credit": "RM",
    "page": 3
  },
  {
    "code": "681",
    "label": "Dotations aux Amortissements d'Exploitatio",
    "debit": "RL",
    "credit": "RL",
    "page": 3
  },
  {
    "code": "691",
    "label": "Dotations/Provisions et Deprecitions Exploit",
    "debit": "RL",
    "credit": "RL",
    "page": 3
  },
  {
    "code": "697",
    "label": "Dotations/Provisions et Déprécitions financi",
    "debit": "RN",
    "credit": "RN",
    "page": 3
  },
  {
    "code": "701",
    "label": "Ventes de Marchandises",
    "debit": "TA",
    "credit": "TA",
    "page": 3
  },
  {
    "code": "702",
    "label": "Ventes de Produits Finis",
    "debit": "TB",
    "credit": "TB",
    "page": 3
  },
  {
    "code": "703",
    "label": "Ventes de Produits Intermédiaires",
    "debit": "TB",
    "credit": "TB",
    "page": 3
  },
  {
    "code": "704",
    "label": "Ventes de Produits Résiduels",
    "debit": "TB",
    "credit": "TB",
    "page": 3
  },
  {
    "code": "705",
    "label": "Travaux Facturés",
    "debit": "TC",
    "credit": "TC",
    "page": 3
  },
  {
    "code": "706",
    "label": "Services Vendus",
    "debit": "TC",
    "credit": "TC",
    "page": 3
  },
  {
    "code": "707",
    "label": "Produits Accessoires",
    "debit": "TD",
    "credit": "TD",
    "page": 3
  },
  {
    "code": "71",
    "label": "Subventions d'Exploitation",
    "debit": "TG",
    "credit": "TG",
    "page": 4
  },
  {
    "code": "72",
    "label": "Production Immobilisée",
    "debit": "TF",
    "credit": "TF",
    "page": 4
  },
  {
    "code": "73",
    "label": "Variations des Stocks de Biens et Services",
    "debit": "TE",
    "credit": "TE",
    "page": 4
  },
  {
    "code": "75",
    "label": "Autres Produits",
    "debit": "TH",
    "credit": "TH",
    "page": 4
  },
  {
    "code": "77",
    "label": "Revenus Financiers et Produits Assimilé",
    "debit": "TK",
    "credit": "TK",
    "page": 4
  },
  {
    "code": "781",
    "label": "Transferts de Charges d'Exploitation",
    "debit": "TI",
    "credit": "TI",
    "page": 4
  },
  {
    "code": "787",
    "label": "Transferts de Charges Financieres",
    "debit": "TM",
    "credit": "TM",
    "page": 4
  },
  {
    "code": "791",
    "label": "Reprises de Provisions et Depreciations",
    "debit": "TJ",
    "credit": "TJ",
    "page": 4
  },
  {
    "code": "797",
    "label": "Reprises/Provisions et Depreciations financi",
    "debit": "TL",
    "credit": "TL",
    "page": 4
  },
  {
    "code": "798",
    "label": "Reprises d'Amortissements",
    "debit": "TJ",
    "credit": "TJ",
    "page": 4
  },
  {
    "code": "799",
    "label": "Reprises de Subventions d’investissement",
    "debit": "TJ",
    "credit": "TJ",
    "page": 4
  },
  {
    "code": "81",
    "label": "Valeurs Comptables/Cessions d'Immobilisat",
    "debit": "RO",
    "credit": "RO",
    "page": 4
  },
  {
    "code": "82",
    "label": "Produits des Cessions d'Immobilisations",
    "debit": "TN",
    "credit": "TN",
    "page": 4
  },
  {
    "code": "83",
    "label": "Charges hors Activités Ordinaires",
    "debit": "RP",
    "credit": "RP",
    "page": 4
  },
  {
    "code": "84",
    "label": "Produits hors Activités Ordinaires",
    "debit": "TO",
    "credit": "TO",
    "page": 4
  },
  {
    "code": "85",
    "label": "Dotations hors Activités Ordinaires",
    "debit": "RP",
    "credit": "RP",
    "page": 4
  },
  {
    "code": "86",
    "label": "Reprises de Charges, Provisions Deprec.",
    "debit": "TO",
    "credit": "TO",
    "page": 4
  },
  {
    "code": "87",
    "label": "Participation des Travailleurs",
    "debit": "RQ",
    "credit": "RQ",
    "page": 4
  },
  {
    "code": "88",
    "label": "Subventions d'Équilibre",
    "debit": "TO",
    "credit": "TO",
    "page": 4
  },
  {
    "code": "89",
    "label": "Impôts sur le Résultat",
    "debit": "RS",
    "credit": "RS",
    "page": 4
  },
  {
    "code": "901",
    "label": "Engagements de Financement Obtenus",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "902",
    "label": "Engagements de Garantie Obtenus",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "903",
    "label": "Engagements Réciproques",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "904",
    "label": "Autres Engagements Obtenus",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "905",
    "label": "Engagements de Financement Accordés",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "906",
    "label": "Engagements de Garantie Accordés",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "907",
    "label": "Engagements Réciproques",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "908",
    "label": "Autres Engagements Accordés",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "91",
    "label": "Contreparties des Engagements",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "92",
    "label": "Comptes Reflechis",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "93",
    "label": "Comptes de Reclassements",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "94",
    "label": "Comptes de Coûts",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "95",
    "label": "Comptes de Stocks",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "96",
    "label": "Comptes d'Ecarts sur Couts Preetablis",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "97",
    "label": "Comptes de Differences de Traitement",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "98",
    "label": "Comptes de Resultats",
    "debit": "",
    "credit": "",
    "page": 4
  },
  {
    "code": "99",
    "label": "Comptes de Liaisons Internes",
    "debit": "",
    "credit": "",
    "page": 4
  }
];
  records.forEach(function (record) { Object.freeze(record); });
  Object.freeze(records);
  return Object.freeze({ metadata: metadata, all: function () { return records; }, getByCode: function (code) {
    return records.find(function (record) { return record.code === String(code); }) || null;
  } });
});
