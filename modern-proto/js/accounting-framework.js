/*
 * PERFECTO · Référentiel de cadre comptable SYSCOHADA révisé.
 * Transcription structurée du PDF fourni : conserver les libellés source et les cases vides.
 * Ce référentiel est consultatif et ne génère aucun calcul ni aucune écriture.
 */
(function (root) {
  'use strict';

  var metadata = Object.freeze({
    "standard": "SYSCOHADA révisé",
    "sourceFile": "cadre comptable syscohada révisé.pdf",
    "sourcePdfSha256": "85c7ea8735d2939b901460dd3eb4929a3892a0c0bf8695d3449cfa5e7e53b604",
    "sourcePages": 11,
    "pageRowCounts": [
      51,
      52,
      51,
      51,
      52,
      51,
      51,
      51,
      51,
      51,
      20
    ],
    "rowCount": 532,
    "mappedRowCount": 409,
    "unmappedRowCount": 123,
    "dataSha256": "8d03d790ab78ed1075cd6eccc8868e6775134ef0849f469f991589e52e0d4b97",
    "note": "Libellés et rattachements reproduits depuis le PDF fourni. Les cellules sans rattachement restent vides ; les libellés tronqués dans la source ne sont pas complétés."
  });
  Object.freeze(metadata.pageRowCounts);
  var ROWS = [
    {
      "code": "1",
      "label": "Ressources Durables",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "10",
      "label": "Capital",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "101",
      "label": "Capital Social",
      "debit": {
        "code": "CA",
        "label": "Capital"
      },
      "credit": {
        "code": "CA",
        "label": "Capital"
      },
      "page": 1
    },
    {
      "code": "102",
      "label": "Capital par Dotation",
      "debit": {
        "code": "CA",
        "label": "Capital"
      },
      "credit": {
        "code": "CA",
        "label": "Capital"
      },
      "page": 1
    },
    {
      "code": "103",
      "label": "Capital Personnel",
      "debit": {
        "code": "CA",
        "label": "Capital"
      },
      "credit": {
        "code": "CA",
        "label": "Capital"
      },
      "page": 1
    },
    {
      "code": "104",
      "label": "Compte de l'Exploitant",
      "debit": {
        "code": "CA",
        "label": "Capital"
      },
      "credit": {
        "code": "CA",
        "label": "Capital"
      },
      "page": 1
    },
    {
      "code": "105",
      "label": "Primes Liées au Capital Social",
      "debit": {
        "code": "CD",
        "label": "Primes d'apports, ..."
      },
      "credit": {
        "code": "CD",
        "label": "Primes d'apports, ..."
      },
      "page": 1
    },
    {
      "code": "106",
      "label": "Écarts de Réévaluation",
      "debit": {
        "code": "CE",
        "label": "Ecarts de réévaluation"
      },
      "credit": {
        "code": "CE",
        "label": "Ecarts de réévaluation"
      },
      "page": 1
    },
    {
      "code": "109",
      "label": "Apporteurs, Capital Souscrit, non Appel",
      "debit": {
        "code": "CB",
        "label": "Capital souscrit, non appelé"
      },
      "credit": {
        "code": "CB",
        "label": "Capital souscrit, non appelé"
      },
      "page": 1
    },
    {
      "code": "11",
      "label": "Réserves",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "111",
      "label": "Réserve légale",
      "debit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "credit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "page": 1
    },
    {
      "code": "112",
      "label": "Réserves Statutaires ou Contractuelles",
      "debit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "credit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "page": 1
    },
    {
      "code": "113",
      "label": "Réserves Réglementées",
      "debit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "credit": {
        "code": "CF",
        "label": "Réserves indisponibles"
      },
      "page": 1
    },
    {
      "code": "118",
      "label": "Autres Réserves",
      "debit": {
        "code": "CG",
        "label": "Réserves libres"
      },
      "credit": {
        "code": "CG",
        "label": "Réserves libres"
      },
      "page": 1
    },
    {
      "code": "12",
      "label": "Report a Nouveau",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "121",
      "label": "Report à Nouveau Créditeur",
      "debit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "credit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "page": 1
    },
    {
      "code": "129",
      "label": "Report à Nouveau Débiteur",
      "debit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "credit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "page": 1
    },
    {
      "code": "13",
      "label": "Résultat Net de l'Exercice",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "130",
      "label": "Résultat en Instance d’affectation",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "1301",
      "label": "Bénéfice en Instance d’affectation",
      "debit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "credit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "page": 1
    },
    {
      "code": "1309",
      "label": "Perte en Instance d’affectation",
      "debit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "credit": {
        "code": "CH",
        "label": "Report à nouveau"
      },
      "page": 1
    },
    {
      "code": "131",
      "label": "Résultat Net : Bénéfice",
      "debit": {
        "code": "CJ",
        "label": "Résultat net de l'exercice"
      },
      "credit": {
        "code": "CJ",
        "label": "Résultat net de l'exercice"
      },
      "page": 1
    },
    {
      "code": "132",
      "label": "Marge Commerciale",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "133",
      "label": "Valeur Ajoutée",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "134",
      "label": "Excédent Brut d'Exploitation",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "135",
      "label": "Résultat d'Exploitation",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "136",
      "label": "Résultat Financier",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "137",
      "label": "Résultat des Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "138",
      "label": "Résultat hors Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "139",
      "label": "Résultat Net : Perte",
      "debit": {
        "code": "CJ",
        "label": "Résultat net de l'exercice"
      },
      "credit": {
        "code": "CJ",
        "label": "Résultat net de l'exercice"
      },
      "page": 1
    },
    {
      "code": "14",
      "label": "Subventions d'Investissement",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "141",
      "label": "Subventions d'Equipement",
      "debit": {
        "code": "CL",
        "label": "Subventions d'investissement"
      },
      "credit": {
        "code": "CL",
        "label": "Subventions d'investissement"
      },
      "page": 1
    },
    {
      "code": "148",
      "label": "Autres Subventions d'Investissement",
      "debit": {
        "code": "CL",
        "label": "Subventions d'investissement"
      },
      "credit": {
        "code": "CL",
        "label": "Subventions d'investissement"
      },
      "page": 1
    },
    {
      "code": "15",
      "label": "Provisions Réglementées et Fonds Assi",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "151",
      "label": "Amortissements Dérogatoires",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "152",
      "label": "Plus-vlues de Cession à Réinvestir",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "153",
      "label": "Fonds Réglementés",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "154",
      "label": "Provisions Spéciales de Réévaluation",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "155",
      "label": "Provisions Réglementées/Immobilisations",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "156",
      "label": "Provisions Réglementées/Stocks",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "157",
      "label": "Provisions pour Investissement",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "158",
      "label": "Autres Provisions et Fonds Réglementes",
      "debit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "credit": {
        "code": "CM",
        "label": "Provisions réglementées"
      },
      "page": 1
    },
    {
      "code": "16",
      "label": "Emprunts et Dettes assimilées",
      "debit": null,
      "credit": null,
      "page": 1
    },
    {
      "code": "161",
      "label": "Emprunts Obligataires",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "162",
      "label": "Emprunts et Dettes/Établisseùents de crédit",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "163",
      "label": "Avances Reçues de l'État",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "164",
      "label": "Avances Reçues et Comptes Courants Bloq",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "165",
      "label": "Dépôts et Cautionnements Recus",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "166",
      "label": "IntérêtS Courus",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "167",
      "label": "Avances assorties de cond particulières",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "168",
      "label": "Autres Emprunts et Dettes",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 1
    },
    {
      "code": "17",
      "label": "Dettes de Location Acquisition",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "172",
      "label": "Dettes Location Acquis./ Crédit bail Immobil",
      "debit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "credit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "page": 2
    },
    {
      "code": "173",
      "label": "Dettes Location Acquis./ Crédit bail Mobilier",
      "debit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "credit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "page": 2
    },
    {
      "code": "174",
      "label": "Dettes Location Acquisition/Location de ven",
      "debit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "credit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "page": 2
    },
    {
      "code": "176",
      "label": "IntérêtS Courus",
      "debit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "credit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "page": 2
    },
    {
      "code": "178",
      "label": "Autres Dettes de Location Acquisition",
      "debit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "credit": {
        "code": "DB",
        "label": "Dettes de crédit-bail"
      },
      "page": 2
    },
    {
      "code": "18",
      "label": "Dettes/Participations et Comptes de liais",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "181",
      "label": "Dettes Liées à des Participations",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 2
    },
    {
      "code": "182",
      "label": "Dettes Liées à des Sociétés en Participatio",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 2
    },
    {
      "code": "183",
      "label": "Intérêts Courus/Dettes participation",
      "debit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "credit": {
        "code": "DA",
        "label": "Emprunts"
      },
      "page": 2
    },
    {
      "code": "184",
      "label": "Comptes Permanents Bloqués des Établiss",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 2
    },
    {
      "code": "185",
      "label": "Comptes non Bloqués des Succursales",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 2
    },
    {
      "code": "186",
      "label": "Comptes de Liaison Charges",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 2
    },
    {
      "code": "187",
      "label": "Comptes de Liaison Produits",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 2
    },
    {
      "code": "188",
      "label": "Comptes de Liaison/Sociétés en Particip.",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 2
    },
    {
      "code": "19",
      "label": "Provisions pour Risques et Charges",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "191",
      "label": "Provisions pour Litiges",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "192",
      "label": "Provisions pour Garanties Données aux Cli",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "193",
      "label": "Provisions/Pertes sur Marchés en cours",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "194",
      "label": "Provisions pour Pertes de Change",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "195",
      "label": "Provisions pour Impôts",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "196",
      "label": "Provisions pour Pensions et Obligations",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "197",
      "label": "Provisions pour Restructuration",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "198",
      "label": "Autres Provisions pour Risques et Charges",
      "debit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "credit": {
        "code": "DC",
        "label": "Provision pour risques et charges"
      },
      "page": 2
    },
    {
      "code": "2",
      "label": "Actif Immobilisé",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "21",
      "label": "Immobilisations Incorporelles",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "211",
      "label": "Frais de Développement",
      "debit": {
        "code": "AE",
        "label": "Frais de R & D"
      },
      "credit": {
        "code": "AE",
        "label": "Frais de R & D"
      },
      "page": 2
    },
    {
      "code": "212",
      "label": "Brevets, Licences, Concessions, Droits simi",
      "debit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "credit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "page": 2
    },
    {
      "code": "213",
      "label": "Logiciels et Sites Internet",
      "debit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "credit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "page": 2
    },
    {
      "code": "214",
      "label": "Marques",
      "debit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "credit": {
        "code": "AF",
        "label": "Brevets, licences, logiciels"
      },
      "page": 2
    },
    {
      "code": "215",
      "label": "Fonds Commercial",
      "debit": {
        "code": "AG",
        "label": "Fonds commercial"
      },
      "credit": {
        "code": "AG",
        "label": "Fonds commercial"
      },
      "page": 2
    },
    {
      "code": "216",
      "label": "Droit au Bail",
      "debit": {
        "code": "AG",
        "label": "Fonds commercial"
      },
      "credit": {
        "code": "AG",
        "label": "Fonds commercial"
      },
      "page": 2
    },
    {
      "code": "217",
      "label": "Investissements de Création",
      "debit": {
        "code": "AH",
        "label": "Autres immobilisations incorp."
      },
      "credit": {
        "code": "AH",
        "label": "Autres immobilisations incorp."
      },
      "page": 2
    },
    {
      "code": "218",
      "label": "Autres Droits et Valeurs Incorporels",
      "debit": {
        "code": "AH",
        "label": "Autres immobilisations incorp."
      },
      "credit": {
        "code": "AH",
        "label": "Autres immobilisations incorp."
      },
      "page": 2
    },
    {
      "code": "219",
      "label": "Immobilisations Incorporelles en Cours",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "22",
      "label": "Terrains",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "221",
      "label": "Terrains Agricoles et Forestiers",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "222",
      "label": "Terrains Nus",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "223",
      "label": "Terrains Bâtis",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "224",
      "label": "Travaux de Mise en Valeur des Terrains",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "225",
      "label": "Terrains de Carrieres-Trefonds",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "226",
      "label": "Terrains Aménagés",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "227",
      "label": "Terrains Mis en Concession",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "228",
      "label": "Autres Terrains",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "229",
      "label": "Aménagements de Terrains en Cours",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 2
    },
    {
      "code": "23",
      "label": "Bâtiments, Installations Techniques, Age",
      "debit": null,
      "credit": null,
      "page": 2
    },
    {
      "code": "231",
      "label": "Bâtiments sur sols propres",
      "debit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "credit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "page": 2
    },
    {
      "code": "232",
      "label": "Bâtiments sur sol d'autrui",
      "debit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "credit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "page": 2
    },
    {
      "code": "233",
      "label": "Ouvrages D’infrastructure",
      "debit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "credit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "page": 2
    },
    {
      "code": "234",
      "label": "Agencements et Installatipns techniques",
      "debit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "credit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "page": 2
    },
    {
      "code": "235",
      "label": "Amenagements de Bureaux",
      "debit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "credit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "page": 2
    },
    {
      "code": "237",
      "label": "Bâtiments mis en concession",
      "debit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "credit": {
        "code": "AK",
        "label": "Bâtiments"
      },
      "page": 2
    },
    {
      "code": "238",
      "label": "Autres Installations et Agencements",
      "debit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "credit": {
        "code": "AL",
        "label": "Installations & Agencements"
      },
      "page": 3
    },
    {
      "code": "239",
      "label": "Bâtiments,Agencements  en cours",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "24",
      "label": "Materiel, Mobilier et Actifs Biologique",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "241",
      "label": "Matériel et Outillage Industriel et Commerci",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "242",
      "label": "Matériel et Outillage Agricole",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "243",
      "label": "Matériel d’emballage Récupérable et Identifi",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "244",
      "label": "Matériel et Mobilier",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "245",
      "label": "Matériel de Transport",
      "debit": {
        "code": "AN",
        "label": "Matériel de transport"
      },
      "credit": {
        "code": "AN",
        "label": "Matériel de transport"
      },
      "page": 3
    },
    {
      "code": "246",
      "label": "Actifs Biologiques",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "247",
      "label": "Agencements du Matériel et Actifs biologiqu",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "248",
      "label": "Autres Matériels et Mobiliers",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "249",
      "label": "Matériels et Actifs Biologiques en Cours",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "25",
      "label": "Avances et Acomptes/Immobilions",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "251",
      "label": "Avances et Acomptes/Immobilions incorpor",
      "debit": {
        "code": "AP",
        "label": "Av & Ac sur immobilisations"
      },
      "credit": {
        "code": "AP",
        "label": "Av & Ac sur immobilisations"
      },
      "page": 3
    },
    {
      "code": "252",
      "label": "Avances et Acomptes/Immobilions corporell",
      "debit": {
        "code": "AP",
        "label": "Av & Ac sur immobilisations"
      },
      "credit": {
        "code": "AP",
        "label": "Av & Ac sur immobilisations"
      },
      "page": 3
    },
    {
      "code": "26",
      "label": "Titres de Participation",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "261",
      "label": "Titres /Sociétés sous contrôle exclusif",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "262",
      "label": "Titres/Sociétés sous contrôle conjoint",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "263",
      "label": "Titres/Sociétés conférant une influence nota",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "265",
      "label": "Participations/Organismes Professionnels",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "266",
      "label": "Parts dans des GIE",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "268",
      "label": "Autres Titres de Participation",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "27",
      "label": "Autres Immoblisations Financières",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "271",
      "label": "Prêts et Créances",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "272",
      "label": "Prêts au Personnel",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "273",
      "label": "Créances sur l’état",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "274",
      "label": "Titres Immobilisés",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "275",
      "label": "Dépôts et Cautionnements Versés",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "276",
      "label": "IntérêtS Courus",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "277",
      "label": "Créances Rattachées à des Participations",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "278",
      "label": "Immobilisations Financières Diverses",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "28",
      "label": "Amortissements",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "281",
      "label": "Amortissements/Immobilisations Incorporell",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "282",
      "label": "Amortissements des Terrains",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 3
    },
    {
      "code": "283",
      "label": "Amortissements des Bâtiments, Installat",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "284",
      "label": "Amortissements du Matériel",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "29",
      "label": "Depreciations des Immobilisations",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "291",
      "label": "Dépréciations des Immobilisations Incor",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "292",
      "label": "Dépréciations des Terrains",
      "debit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "credit": {
        "code": "AJ",
        "label": "Terrains"
      },
      "page": 3
    },
    {
      "code": "293",
      "label": "Dépréciations des Bâtiments, Installati",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "294",
      "label": "Dépréciations de Matériel, du Mobilier",
      "debit": {
        "code": "AM",
        "label": "Matériel"
      },
      "credit": {
        "code": "AM",
        "label": "Matériel"
      },
      "page": 3
    },
    {
      "code": "295",
      "label": "Dépréciations des Avances et Acomptes V",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "296",
      "label": "Dépréciations des Titres de Participati",
      "debit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "credit": {
        "code": "AR",
        "label": "Titres de participation"
      },
      "page": 3
    },
    {
      "code": "297",
      "label": "Dépréciations des Autres Immobilisation",
      "debit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "credit": {
        "code": "AS",
        "label": "Autres immo financières"
      },
      "page": 3
    },
    {
      "code": "3",
      "label": "Stocks",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "31",
      "label": "Marchandises",
      "debit": null,
      "credit": null,
      "page": 3
    },
    {
      "code": "311",
      "label": "Marchandises a",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 3
    },
    {
      "code": "312",
      "label": "Marchandises B",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 3
    },
    {
      "code": "313",
      "label": "Actifs Biologiques",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 3
    },
    {
      "code": "318",
      "label": "Marchandises hors Activités Ordinaires",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 3
    },
    {
      "code": "32",
      "label": "Matières Premières et Fournitures Liées",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 3
    },
    {
      "code": "33",
      "label": "Autres Approvisionnements",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "331",
      "label": "Matières Consommables",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "332",
      "label": "Fournitures d'Atelier et d'Usine",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "333",
      "label": "Fournitures de Magasin",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "334",
      "label": "Fournitures de Bureau",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "335",
      "label": "Emballages",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "338",
      "label": "Autres Matières",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "34",
      "label": "Produits en Cours",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "341",
      "label": "Produits en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "342",
      "label": "Travaux en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "343",
      "label": "Produits Intermédiaires en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "344",
      "label": "Produits Résiduels en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "345",
      "label": "Actifs Biologiques en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "35",
      "label": "Services en Cours",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "351",
      "label": "Études en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "352",
      "label": "Prestations de Services en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "36",
      "label": "Produits Finis",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "361",
      "label": "Produits Finis a",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "362",
      "label": "Produits Finis B",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "363",
      "label": "Actifs Biologiques",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "37",
      "label": "Produits Intermediaires et Résiduels",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "371",
      "label": "Produits Intermédiaires",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "372",
      "label": "Produits Résiduels",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "373",
      "label": "Actifs Biologiques",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "38",
      "label": "Stocks en Cours de Route, Consignation",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "381",
      "label": "Marchandises en Cours de Route",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "382",
      "label": "Matières Premières et Fournitures Liées",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "383",
      "label": "Autres Approvisionnements en Cours de Ro",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "386",
      "label": "Produits Finis en Cours de Route",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "387",
      "label": "Stock en Consignation ou en Dépôt",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "388",
      "label": "Stock Provenant d'Immobilisations",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "39",
      "label": "Dépréciations/Stocks et Encours de pro",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "391",
      "label": "Dépréciations des Stocks de Marchandise",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "392",
      "label": "Dépréciations des Stocks de Matières Prem",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "393",
      "label": "Dépréciations des Stocks d'Autres Approv.",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "394",
      "label": "Dépréciations des Productions en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "395",
      "label": "Dépréciations des Services en Cours",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "396",
      "label": "Dépréciations des Stocks de Produits Finis",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "397",
      "label": "Dépréciations/Produits Intermédiaires, résid",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "398",
      "label": "Dépréciations des Stocks en Cours de Rout",
      "debit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "credit": {
        "code": "BB",
        "label": "Stocks et encours"
      },
      "page": 4
    },
    {
      "code": "4",
      "label": "Tiers",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "40",
      "label": "Fournisseurs et Comptes Rattachés",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "401",
      "label": "Fournisseurs, Dettes en Compte",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "DJ",
        "label": "Fournisseurs d'exploitation"
      },
      "page": 4
    },
    {
      "code": "402",
      "label": "Fournisseurs, Effets à Payer",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "DJ",
        "label": "Fournisseurs d'exploitation"
      },
      "page": 4
    },
    {
      "code": "404",
      "label": "Fournisseurs, Acquis. Courantes immobilisa",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "DJ",
        "label": "Fournisseurs d'exploitation"
      },
      "page": 4
    },
    {
      "code": "408",
      "label": "Fournisseurs, Factures non Parvenues",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "DJ",
        "label": "Fournisseurs d'exploitation"
      },
      "page": 4
    },
    {
      "code": "409",
      "label": "Fournisseurs Débiteurs",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "DJ",
        "label": "Fournisseurs d'exploitation"
      },
      "page": 4
    },
    {
      "code": "41",
      "label": "Clients et Comptes Rattachés",
      "debit": null,
      "credit": null,
      "page": 4
    },
    {
      "code": "411",
      "label": "Clients",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 4
    },
    {
      "code": "412",
      "label": "Clients, Éffets à Recevoir en Portefeui",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 4
    },
    {
      "code": "413",
      "label": "Clients, Cheques, Effets et Autres Vale",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 4
    },
    {
      "code": "414",
      "label": "Créances/Cessions Courantes d'Immobilisa",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 5
    },
    {
      "code": "415",
      "label": "Clients, Effets Escomptés non Échus",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 5
    },
    {
      "code": "416",
      "label": "Créances Clients Litigieuses ou Douteuses",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 5
    },
    {
      "code": "418",
      "label": "Clients, Produits à Recevoir",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 5
    },
    {
      "code": "419",
      "label": "Clients Créditeurs",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "DI",
        "label": "Clients, avances reçues"
      },
      "page": 5
    },
    {
      "code": "42",
      "label": "Personnel",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "421",
      "label": "Personnel, Avances et Acomptes",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "422",
      "label": "Personnel, Rémunérations Dues",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "423",
      "label": "Personnel, Oppositions, saisie-arrêts",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "424",
      "label": "Personnel, Oeuvres Sociales Internes",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "425",
      "label": "Représentants du Personnel",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "426",
      "label": "Personnel, Participation aux Bénéfices",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "427",
      "label": "Personnel – Dépôts",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "428",
      "label": "Personnel, Charges à Payer et Produits",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "43",
      "label": "Organismes Sociaux",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "431",
      "label": "Sécurité Sociale",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "432",
      "label": "Caisses de Retraite Complémentaire",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "433",
      "label": "Autres Organismes Sociaux",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "438",
      "label": "Org. Sociaux, Ch. à Payer et Prod. à recevo",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "44",
      "label": "État et Collectivités Publiques",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "441",
      "label": "État, Impôt sur les Bénéfices",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "442",
      "label": "État, Autres Impôts et Taxes",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "443",
      "label": "État, T.V.A. Facturée",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "444",
      "label": "État, T.V.A. Due ou Crédit de T.V.A.",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "445",
      "label": "État, T.V.A. Récupérable",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "446",
      "label": "État, Autres Taxes sur le Chiffre d'Affaires",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "447",
      "label": "État, Impôts Retenus à la Source",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "448",
      "label": "État, Charges à Payer et Produits à Recevo",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "449",
      "label": "État, Créances et Dettes Diverses",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DK",
        "label": "Dettes fiscales et sociales"
      },
      "page": 5
    },
    {
      "code": "45",
      "label": "Organismes Internationaux",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "451",
      "label": "Opérations Avec les Organismes Africains",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "452",
      "label": "Opérations/Autres Organismes Intenationau",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "458",
      "label": "Organismes Internationaux, Fonds de Dotat",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "46",
      "label": "Apporteurs, Associés et Groupe",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "461",
      "label": "Apporteurs, Opérations sur le Capital",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "462",
      "label": "Associés ,  Comptes Courants",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "463",
      "label": "Associés , Opérations Faites en Commun",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "465",
      "label": "Associés , Dividendes à Payer",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "466",
      "label": "Groupe, Comptes Courants",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "467",
      "label": "Apporteurs Restant dû sur Capital Appelé",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "47",
      "label": "Débiteurs et Créditeurs Divers",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "471",
      "label": "Debiteurs et Crediteurs Divers",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "472",
      "label": "Creances et Dettes sur Titres de Placem",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "473",
      "label": "Operations Faites pour compte de tiers",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "474",
      "label": "Répartition Periodique des Charges et Prod",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "475",
      "label": "Compte Transitoire, Ajustement Special",
      "debit": null,
      "credit": null,
      "page": 5
    },
    {
      "code": "4751",
      "label": "Comptes d'actif",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "4752",
      "label": "Comptes de passif",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "476",
      "label": "Charges Constatées d'Avance",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "477",
      "label": "Produits Constatés d'Avance",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "478",
      "label": "Écarts de Conversion - Actif",
      "debit": {
        "code": "BU",
        "label": "Ecarts de conversion-actif"
      },
      "credit": {
        "code": "BU",
        "label": "Ecarts de conversion-actif"
      },
      "page": 5
    },
    {
      "code": "479",
      "label": "Écarts de Conversion - Passif",
      "debit": {
        "code": "DV",
        "label": "Ecart de conversion-passif"
      },
      "credit": {
        "code": "DM",
        "label": "Autres dettes"
      },
      "page": 5
    },
    {
      "code": "48",
      "label": "Créances et Dettes hors Activités Ordina",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "481",
      "label": "Fournisseurs d'Investissements",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "4811",
      "label": "Immobilisations incorporelles",
      "debit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "credit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "page": 6
    },
    {
      "code": "4812",
      "label": "Immobilisations corporelles",
      "debit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "credit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "page": 6
    },
    {
      "code": "4813",
      "label": "Versements restant à effectuer sur titres",
      "debit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "credit": {
        "code": "DH",
        "label": "Dettes circulantes HAO"
      },
      "page": 6
    },
    {
      "code": "482",
      "label": "Fournisseurs d'Investissements, Effets à pa",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "484",
      "label": "Autres Dettes hors Activites Ordinaires",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "485",
      "label": "Créances sur Cessions d'Immobilisations",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "488",
      "label": "Autres Créances hors Activités Ordinaires",
      "debit": {
        "code": "BA",
        "label": "Actif circulant HAO"
      },
      "credit": null,
      "page": 6
    },
    {
      "code": "49",
      "label": "Dépréciations Etprovisions pour Risque",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "490",
      "label": "Dépréciations des Comptes Fournisseurs",
      "debit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "credit": {
        "code": "BH",
        "label": "Fournisseurs, avances versées"
      },
      "page": 6
    },
    {
      "code": "491",
      "label": "Dépréciations des Comptes Clients",
      "debit": {
        "code": "BI",
        "label": "Clients"
      },
      "credit": {
        "code": "BI",
        "label": "Clients"
      },
      "page": 6
    },
    {
      "code": "492",
      "label": "Dépréciations des Comptes Personnel",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "493",
      "label": "Dépréciations des Comptes Organismes So",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "494",
      "label": "Dépréciations/État et Collectivités publiques",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "495",
      "label": "Dépréciations/Comptes Organismes Interna",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "496",
      "label": "Dépréciations/Comptes Associés et Groupe",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "497",
      "label": "Dépréciations des Comptes Débiteurs Diver",
      "debit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "credit": {
        "code": "BJ",
        "label": "Autres créances"
      },
      "page": 6
    },
    {
      "code": "498",
      "label": "Dépréciations des Comptes de Créances H",
      "debit": {
        "code": "BA",
        "label": "Actif circulant HAO"
      },
      "credit": {
        "code": "BA",
        "label": "Actif circulant HAO"
      },
      "page": 6
    },
    {
      "code": "499",
      "label": "Provisions pour Risques à Court Terme",
      "debit": {
        "code": "DN",
        "label": "Provisions pour risques à court ter"
      },
      "credit": {
        "code": "DN",
        "label": "Provisions pour risques à court ter"
      },
      "page": 6
    },
    {
      "code": "5",
      "label": "Trésorerie",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "50",
      "label": "Titres de Placement",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "501",
      "label": "Titres du Trésor et Bons de Caisse",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "502",
      "label": "Actions",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "503",
      "label": "Obligations",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "504",
      "label": "Bons de Souscription",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "505",
      "label": "Titres Négociables hors Region",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "506",
      "label": "Intérêts Courus",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "508",
      "label": "Autres Titres de Placement et Creances",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "51",
      "label": "Valeurs à Encaisser",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "511",
      "label": "Effets à Encaisser",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "512",
      "label": "Effets à l'Encaissement",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "513",
      "label": "Chèques à Encaisser",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "514",
      "label": "Chèques à l'Encaissement",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "515",
      "label": "Cartes de Crédit à Encaisser",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "518",
      "label": "Autres Valeurs à l'Encaissement",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "52",
      "label": "Banques",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "521",
      "label": "Banques Locales",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "522",
      "label": "Banques Autres États Region",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "523",
      "label": "Banques Autres Etats Zone Monetaire",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "524",
      "label": "Banques hors Zone Monetaire",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "525",
      "label": "Banques Depot a Terme",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "526",
      "label": "Banques, intérêtS Courus",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "53",
      "label": "Établissements Financiers et Assimilés",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "531",
      "label": "Chèques Postaux",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "532",
      "label": "Trésor",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "533",
      "label": "Sociétés de Gestion et d'Intermédiation",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "536",
      "label": "SGI-Intérêts Courus",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "538",
      "label": "Autres Organismes Financiers",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "54",
      "label": "Instruments de Trésorerie",
      "debit": null,
      "credit": null,
      "page": 6
    },
    {
      "code": "541",
      "label": "Options de Taux d'intérêts",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 6
    },
    {
      "code": "542",
      "label": "Options de Taux de Change",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "543",
      "label": "Options de Taux Boursiers",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "544",
      "label": "Instruments de Marchés à Terme",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "545",
      "label": "Avoirs d'Or et Autres Métaux Précieux",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "55",
      "label": "Instruments de Monnaie Electronique",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "551",
      "label": "Monnaie Electronique - Carte Carburant",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "552",
      "label": "Monnaie Electronique - Telephone Portable",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "553",
      "label": "Monnaie Electronique - Carte Peage",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "554",
      "label": "Porte-Monnaie Electronique",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "558",
      "label": "Autres Instruments Monnaies Electroniques",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "56",
      "label": "Banques, Crédits de Trésorerie et d'Esco",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "561",
      "label": "Crédits de Trésorerie",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "564",
      "label": "Escompte de Crédits de Campagne",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DQ",
        "label": "Banques, crédits d'escompte"
      },
      "page": 7
    },
    {
      "code": "565",
      "label": "Escompte de Crédits Ordinaires",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DQ",
        "label": "Banques, crédits d'escompte"
      },
      "page": 7
    },
    {
      "code": "566",
      "label": "Credits de Tresorerie - Intérêt",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "57",
      "label": "Caisse",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "571",
      "label": "Caisse principale",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "572",
      "label": "Caisse secondaire",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "58",
      "label": "Régies d'avances, accréditifs et Vir. inte",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "581",
      "label": "Régies d'Avance",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "582",
      "label": "Accréditifs",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "585",
      "label": "Virements de Fonds",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "588",
      "label": "Autres Virements Internes",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "DR",
        "label": "Banques, crédits de de tresorerie"
      },
      "page": 7
    },
    {
      "code": "59",
      "label": "Dépréciations et Provisions pour Risque",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "590",
      "label": "Dépréciations des Titres de Placement",
      "debit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "credit": {
        "code": "BQ",
        "label": "Titres de placement"
      },
      "page": 7
    },
    {
      "code": "591",
      "label": "Dépréciations des Titres et Valeurs",
      "debit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "credit": {
        "code": "BR",
        "label": "Valeurs à encaisser"
      },
      "page": 7
    },
    {
      "code": "592",
      "label": "Dépréciations des Comptes Banques",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "page": 7
    },
    {
      "code": "593",
      "label": "Dépréciations des Comptes Établissement",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "page": 7
    },
    {
      "code": "594",
      "label": "Dépréciations/Instruments de trsorerie",
      "debit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "credit": {
        "code": "BS",
        "label": "Banques,Chèques postausx Caiss"
      },
      "page": 7
    },
    {
      "code": "599",
      "label": "Provisions pour Risque à Court Terme",
      "debit": {
        "code": "DN",
        "label": "Provisions pour risques à court ter"
      },
      "credit": {
        "code": "DN",
        "label": "Provisions pour risques à court ter"
      },
      "page": 7
    },
    {
      "code": "6",
      "label": "Charges des Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "60",
      "label": "Achats et Variations de Stocks",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "601",
      "label": "Achats de Marchandises",
      "debit": {
        "code": "RA",
        "label": "Achats de marchandises"
      },
      "credit": {
        "code": "RA",
        "label": "Achats de marchandises"
      },
      "page": 7
    },
    {
      "code": "602",
      "label": "Achats de Matières Premières et Fourniture",
      "debit": {
        "code": "RC",
        "label": "Achats de matières premières"
      },
      "credit": {
        "code": "RC",
        "label": "Achats de matières premières"
      },
      "page": 7
    },
    {
      "code": "603",
      "label": "Variations des Stocks de Biens Achetés",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "6031",
      "label": "Marchandises",
      "debit": {
        "code": "RB",
        "label": "Variations de stocks de marchandi"
      },
      "credit": {
        "code": "RB",
        "label": "Variations de stocks de marchandi"
      },
      "page": 7
    },
    {
      "code": "6032",
      "label": "Matières premières",
      "debit": {
        "code": "RD",
        "label": "Variations de stocks de mat. premi"
      },
      "credit": {
        "code": "RD",
        "label": "Variations de stocks de mat. premi"
      },
      "page": 7
    },
    {
      "code": "6033",
      "label": "Autres approvisionnements",
      "debit": {
        "code": "RF",
        "label": "Variations de stocks"
      },
      "credit": {
        "code": "RF",
        "label": "Variations de stocks"
      },
      "page": 7
    },
    {
      "code": "604",
      "label": "Achats Stockés de Matières et Fournitures",
      "debit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "credit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "page": 7
    },
    {
      "code": "605",
      "label": "Autres Achats",
      "debit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "credit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "page": 7
    },
    {
      "code": "608",
      "label": "Achats d'Emballages",
      "debit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "credit": {
        "code": "RE",
        "label": "Autres achats"
      },
      "page": 7
    },
    {
      "code": "61",
      "label": "Transports",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "612",
      "label": "Transports sur Ventes",
      "debit": {
        "code": "RG",
        "label": "Transports"
      },
      "credit": {
        "code": "RG",
        "label": "Transports"
      },
      "page": 7
    },
    {
      "code": "613",
      "label": "Transports pour le Compte de Tiers",
      "debit": {
        "code": "RG",
        "label": "Transports"
      },
      "credit": {
        "code": "RG",
        "label": "Transports"
      },
      "page": 7
    },
    {
      "code": "614",
      "label": "Transports du Personnel",
      "debit": {
        "code": "RG",
        "label": "Transports"
      },
      "credit": {
        "code": "RG",
        "label": "Transports"
      },
      "page": 7
    },
    {
      "code": "616",
      "label": "Transports de Plis",
      "debit": {
        "code": "RG",
        "label": "Transports"
      },
      "credit": {
        "code": "RG",
        "label": "Transports"
      },
      "page": 7
    },
    {
      "code": "618",
      "label": "Autres Frais de Transport",
      "debit": {
        "code": "RG",
        "label": "Transports"
      },
      "credit": {
        "code": "RG",
        "label": "Transports"
      },
      "page": 7
    },
    {
      "code": "62",
      "label": "Services Extérieurs",
      "debit": null,
      "credit": null,
      "page": 7
    },
    {
      "code": "621",
      "label": "SOUS-TRAITANCE Générale",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 7
    },
    {
      "code": "622",
      "label": "Locations, Charges Locatives",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 7
    },
    {
      "code": "623",
      "label": "Redevances de Location Acquisition",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 7
    },
    {
      "code": "624",
      "label": "Entretien, Réparations, Remises en Etat",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "625",
      "label": "Primes d'Assurance",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "626",
      "label": "Études, Recherches et Documentation",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "627",
      "label": "Publicité, Publications, Relations Publiques",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "628",
      "label": "Frais de Télécommunications",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "63",
      "label": "Autres Services Extérieurs",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "631",
      "label": "Frais Bancaires",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "632",
      "label": "Rémunérations d'Intermédiaires et de Cons",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "633",
      "label": "Frais de Formation du Personnel",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "634",
      "label": "Redevances pour Brevets, Licences, Logici",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "635",
      "label": "Cotisations",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "637",
      "label": "Rémunérations de Personnel Extérieur",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "638",
      "label": "Autres Charges Externes",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "639",
      "label": "Compte transtoire",
      "debit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "credit": {
        "code": "RH",
        "label": "Services extérieurs"
      },
      "page": 8
    },
    {
      "code": "64",
      "label": "Impôts et Taxes",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "641",
      "label": "Impôts et Taxes Directs",
      "debit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "credit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "page": 8
    },
    {
      "code": "645",
      "label": "Impôts et Taxes Indirects",
      "debit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "credit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "page": 8
    },
    {
      "code": "646",
      "label": "Droits d'Enregistrement",
      "debit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "credit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "page": 8
    },
    {
      "code": "647",
      "label": "Penalites, Amendes Fiscales",
      "debit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "credit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "page": 8
    },
    {
      "code": "648",
      "label": "Autres Impôts et Taxes",
      "debit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "credit": {
        "code": "RI",
        "label": "Impôts et taxes"
      },
      "page": 8
    },
    {
      "code": "65",
      "label": "Autres Charges",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "651",
      "label": "Pertes sur Créances Clients et Autres Débit",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "652",
      "label": "Quote-part sur Résultat d'opérations comm",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "654",
      "label": "Valeurs Comptables des Cessions Courant",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "656",
      "label": "Perte de Change sur Creances et Dettes",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "657",
      "label": "Penalites et Amendes Penales",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "658",
      "label": "Charges Diverses",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "659",
      "label": "Charges pour Dépréciations et Provisions",
      "debit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "credit": {
        "code": "RJ",
        "label": "Autres charges"
      },
      "page": 8
    },
    {
      "code": "66",
      "label": "Charges de Personnel",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "661",
      "label": "Rémunérations Directes Versées au Person",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "662",
      "label": "Rémunérations Directes Versées au Person",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "663",
      "label": "Indemnités Forfaitaires Versées au Personn",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "664",
      "label": "Charges Sociales",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "666",
      "label": "Rémunérations et Charges Sociales de l'ex",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "667",
      "label": "Rémunération Transférée de Personnel Ext",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "668",
      "label": "Autres Charges Sociales",
      "debit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "credit": {
        "code": "RK",
        "label": "Charges de personnel"
      },
      "page": 8
    },
    {
      "code": "67",
      "label": "Frais Financiers et Charges Assimilées",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "671",
      "label": "Intérêts des Emprunts",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "672",
      "label": "Intérêts dans Loyers de Location Acquis",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "673",
      "label": "Escomptes Accordés",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "674",
      "label": "Autres intérêts",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "675",
      "label": "Escomptes des Effets de Commerce",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "676",
      "label": "Pertes de Change Financieres",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "677",
      "label": "Pertes sur Titres de Placement",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "678",
      "label": "Pertes et Charges sur Risques Financier",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "679",
      "label": "Charges pour Depreciations  et Provisions",
      "debit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "credit": {
        "code": "RM",
        "label": "Frais financiers et charges assimil"
      },
      "page": 8
    },
    {
      "code": "68",
      "label": "Dotations aux Amortissements",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "681",
      "label": "Dotations aux Amortissements d'Exploit",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "6812",
      "label": "Dotations/Immobilisations incorporelles",
      "debit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "credit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "page": 8
    },
    {
      "code": "6813",
      "label": "Dotations/Immobilisations corporelles",
      "debit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "credit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "page": 8
    },
    {
      "code": "69",
      "label": "Dotations aux Provisions et Dépréciation",
      "debit": null,
      "credit": null,
      "page": 8
    },
    {
      "code": "691",
      "label": "Dotations/Provisions et Deprecitions Exploit",
      "debit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "credit": {
        "code": "RL",
        "label": "Dotatations Amort & Prov"
      },
      "page": 9
    },
    {
      "code": "697",
      "label": "Dotations/Provisions et Déprécitions financi",
      "debit": {
        "code": "RN",
        "label": "Dotations aux dépréciations financi"
      },
      "credit": {
        "code": "RN",
        "label": "Dotations aux dépréciations financi"
      },
      "page": 9
    },
    {
      "code": "7",
      "label": "Produits des Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "70",
      "label": "Ventes",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "701",
      "label": "Ventes de Marchandises",
      "debit": {
        "code": "TA",
        "label": "Ventes de marchandises"
      },
      "credit": {
        "code": "TA",
        "label": "Ventes de marchandises"
      },
      "page": 9
    },
    {
      "code": "702",
      "label": "Ventes de Produits Finis",
      "debit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "credit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "page": 9
    },
    {
      "code": "703",
      "label": "Ventes de Produits Intermédiaires",
      "debit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "credit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "page": 9
    },
    {
      "code": "704",
      "label": "Ventes de Produits Résiduels",
      "debit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "credit": {
        "code": "TB",
        "label": "Ventes de produits fabriqués"
      },
      "page": 9
    },
    {
      "code": "705",
      "label": "Travaux Facturés",
      "debit": {
        "code": "TC",
        "label": "Travaux, sevices vendus"
      },
      "credit": {
        "code": "TC",
        "label": "Travaux, sevices vendus"
      },
      "page": 9
    },
    {
      "code": "706",
      "label": "Services Vendus",
      "debit": {
        "code": "TC",
        "label": "Travaux, sevices vendus"
      },
      "credit": {
        "code": "TC",
        "label": "Travaux, sevices vendus"
      },
      "page": 9
    },
    {
      "code": "707",
      "label": "Produits Accessoires",
      "debit": {
        "code": "TD",
        "label": "Produits accessoires"
      },
      "credit": {
        "code": "TD",
        "label": "Produits accessoires"
      },
      "page": 9
    },
    {
      "code": "71",
      "label": "Subventions d'Exploitation",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "711",
      "label": "Sur Produits à l'Exportation",
      "debit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "credit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "page": 9
    },
    {
      "code": "712",
      "label": "Sur Produits à l'Importation",
      "debit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "credit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "page": 9
    },
    {
      "code": "713",
      "label": "Sur Produits de Péréquation",
      "debit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "credit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "page": 9
    },
    {
      "code": "714",
      "label": "Indemnités et Subventions d’exploitation",
      "debit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "credit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "page": 9
    },
    {
      "code": "718",
      "label": "Autres Subventions d'Exploitation",
      "debit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "credit": {
        "code": "TG",
        "label": "Subventions d'exploitation"
      },
      "page": 9
    },
    {
      "code": "72",
      "label": "Production Immobilisée",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "721",
      "label": "Immobilisations Incorporelles",
      "debit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "credit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "page": 9
    },
    {
      "code": "722",
      "label": "Immobilisations Corporelles",
      "debit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "credit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "page": 9
    },
    {
      "code": "724",
      "label": "Production auto-consommée",
      "debit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "credit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "page": 9
    },
    {
      "code": "726",
      "label": "Immobilisations Financières",
      "debit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "credit": {
        "code": "TF",
        "label": "Production immobilisée"
      },
      "page": 9
    },
    {
      "code": "73",
      "label": "Variations des Stocks de Biens et Servic",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "734",
      "label": "Variations des Stocks de Produits en Cours",
      "debit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "credit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "page": 9
    },
    {
      "code": "735",
      "label": "Variations des EN-COURS de Services",
      "debit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "credit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "page": 9
    },
    {
      "code": "736",
      "label": "Variations des Stocks de Produits Finis",
      "debit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "credit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "page": 9
    },
    {
      "code": "737",
      "label": "Variations des Stocks de Produits Intermédi",
      "debit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "credit": {
        "code": "TE",
        "label": "Production stockée"
      },
      "page": 9
    },
    {
      "code": "75",
      "label": "Autres Produits",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "751",
      "label": "Profits sur Creances Clients et Autres débit",
      "debit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "credit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "page": 9
    },
    {
      "code": "752",
      "label": "Quote-part sur Résultat d'Opérations Finan",
      "debit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "credit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "page": 9
    },
    {
      "code": "754",
      "label": "Produits des Cessions Courantes d’immobil",
      "debit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "credit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "page": 9
    },
    {
      "code": "756",
      "label": "Gains de Change sur Creances et Dettes",
      "debit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "credit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "page": 9
    },
    {
      "code": "759",
      "label": "Reprises de Charges pour Depreciations",
      "debit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "credit": {
        "code": "TH",
        "label": "Autres produits"
      },
      "page": 9
    },
    {
      "code": "77",
      "label": "Revenus Financiers et Produits Assimilé",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "771",
      "label": "Intérêts de Prêts et Creances Diverses",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "772",
      "label": "Revenus de Participations et Autres Titres",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "773",
      "label": "Escomptes Obtenus",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "774",
      "label": "Revenus de Placement",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "775",
      "label": "Intérêts dans Loyers de Location Acquisitio",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "776",
      "label": "Gains de Change Financiers",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "777",
      "label": "Gains sur Cessions de Titres de Placement",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "778",
      "label": "Gains sur Risques Financiers",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "779",
      "label": "Reprises de Charges pour Depreciations",
      "debit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "credit": {
        "code": "TK",
        "label": "Revenus financiers et assimilés"
      },
      "page": 9
    },
    {
      "code": "78",
      "label": "Transferts de Charges",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "781",
      "label": "Transferts de Charges d'Exploitation",
      "debit": {
        "code": "TI",
        "label": "Transfert de charges"
      },
      "credit": {
        "code": "TI",
        "label": "Transfert de charges"
      },
      "page": 9
    },
    {
      "code": "787",
      "label": "Transferts de Charges Financieres",
      "debit": {
        "code": "TM",
        "label": "Transfert de charges financières"
      },
      "credit": {
        "code": "TM",
        "label": "Transfert de charges financières"
      },
      "page": 9
    },
    {
      "code": "79",
      "label": "Reprises de Provisions et Depreciations",
      "debit": null,
      "credit": null,
      "page": 9
    },
    {
      "code": "791",
      "label": "Reprises de Provisions et Depreciations",
      "debit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "credit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "page": 9
    },
    {
      "code": "797",
      "label": "Reprises/Provisions et Depreciations financi",
      "debit": {
        "code": "TL",
        "label": "Reprises sur dépréciatios financièr"
      },
      "credit": {
        "code": "TL",
        "label": "Reprises sur dépréciatios financièr"
      },
      "page": 9
    },
    {
      "code": "798",
      "label": "Reprises d'Amortissements",
      "debit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "credit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "page": 9
    },
    {
      "code": "799",
      "label": "Reprises de Subventions d’investissement",
      "debit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "credit": {
        "code": "TJ",
        "label": "Reprises/Amort., Prov. et dépréciati"
      },
      "page": 9
    },
    {
      "code": "8",
      "label": "Autres Charges et Produits",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "81",
      "label": "Valeurs Comptables/Cessions d'Immobil",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "811",
      "label": "Immobilisations Incorporelles",
      "debit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "credit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "page": 10
    },
    {
      "code": "812",
      "label": "Immobilisations Corporelles",
      "debit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "credit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "page": 10
    },
    {
      "code": "816",
      "label": "Immobilisations Financières",
      "debit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "credit": {
        "code": "RO",
        "label": "Valeurs comptables des cessions"
      },
      "page": 10
    },
    {
      "code": "82",
      "label": "Produits des Cessions d'Immobilisation",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "821",
      "label": "Immobilisations Incorporelles",
      "debit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "credit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "page": 10
    },
    {
      "code": "822",
      "label": "Immobilisations Corporelles",
      "debit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "credit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "page": 10
    },
    {
      "code": "826",
      "label": "Immobilisations Financières",
      "debit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "credit": {
        "code": "TN",
        "label": "Produits de cessions d'immobilisati"
      },
      "page": 10
    },
    {
      "code": "83",
      "label": "Charges hors Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "831",
      "label": "Charges H.A.O. Constatées",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "833",
      "label": "Charges/Operations de Restructuration",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "834",
      "label": "Pertes sur Créances H.A.O.",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "835",
      "label": "Dons et Libéralités Accordés",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "836",
      "label": "Abandons de Créances Consentis",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "837",
      "label": "Charges/Operations de Liquidation",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "839",
      "label": "Charges  pour Dépréciations et Provisions",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "84",
      "label": "Produits hors Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "841",
      "label": "Produits H.A.O Constatés",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "843",
      "label": "Produits Lies aux Operations de Restructur",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "844",
      "label": "Indemnites et Subventions H.A.O.",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "845",
      "label": "Dons et Libéralités Obtenus",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "846",
      "label": "Abandons de Créances Obtenus",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "847",
      "label": "Produits Lies aux Operations de Liquidation",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "848",
      "label": "Transferts de Charges H.A.O",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "849",
      "label": "Reprises de Charges pour Depreciations",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "85",
      "label": "Dotations hors Activités Ordinaires",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "851",
      "label": "Dotations aux Provisions Réglementées",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "852",
      "label": "Dotations aux Amortissements H.A.O.",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "853",
      "label": "Dotations aux Dépréciations H.A.O.",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "854",
      "label": "Dotations aux Provisions pour Risques",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "858",
      "label": "Autres Dotations H.A.O.",
      "debit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "credit": {
        "code": "RP",
        "label": "Autres charges HAO"
      },
      "page": 10
    },
    {
      "code": "86",
      "label": "Reprises de Charges, Provisions Deprec",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "861",
      "label": "Reprises de Provisions Réglementées",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "862",
      "label": "Reprisesd’amortissements HAO",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "863",
      "label": "Reprisesde Dépréciations H.A.O.",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "864",
      "label": "Reprises/Provisions, Risques et Charges H",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "868",
      "label": "Autres Reprises H.A.O.",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "87",
      "label": "Participation des Travailleurs",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "871",
      "label": "Participation Légale aux Bénéfices",
      "debit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "credit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "page": 10
    },
    {
      "code": "874",
      "label": "Participation Contractuelle/Bénéfices",
      "debit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "credit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "page": 10
    },
    {
      "code": "878",
      "label": "Autres Participations",
      "debit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "credit": {
        "code": "RQ",
        "label": "Participation des travailleurs"
      },
      "page": 10
    },
    {
      "code": "88",
      "label": "Subventions d'Équilibre",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "881",
      "label": "État",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "884",
      "label": "Collectivités Publiques",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "886",
      "label": "Groupe",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "888",
      "label": "Autres",
      "debit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "credit": {
        "code": "TO",
        "label": "Autrs produits HAO"
      },
      "page": 10
    },
    {
      "code": "89",
      "label": "Impôts sur le Résultat",
      "debit": null,
      "credit": null,
      "page": 10
    },
    {
      "code": "891",
      "label": "Impôts sur les Bénéfices de l'Exercice",
      "debit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "credit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "page": 10
    },
    {
      "code": "892",
      "label": "Rappel d'Impôts sur Résultats Antérieur",
      "debit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "credit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "page": 10
    },
    {
      "code": "895",
      "label": "Impôt Minimum Forfaitaire (I.M.F.)",
      "debit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "credit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "page": 10
    },
    {
      "code": "899",
      "label": "Annulations d’impôts/Résultats antérieurs",
      "debit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "credit": {
        "code": "RS",
        "label": "Impôt sur le résultat"
      },
      "page": 11
    },
    {
      "code": "9",
      "label": "Engagements hors bilan",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "90",
      "label": "Engagements Obtenus et Accordés",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "901",
      "label": "Engagements de Financement Obtenus",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "902",
      "label": "Engagements de Garantie Obtenus",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "903",
      "label": "Engagements Réciproques",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "904",
      "label": "Autres Engagements Obtenus",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "905",
      "label": "Engagements de Financement Accordés",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "906",
      "label": "Engagements de Garantie Accordés",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "907",
      "label": "Engagements Réciproques",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "908",
      "label": "Autres Engagements Accordés",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "91",
      "label": "Contreparties des Engagements",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "92",
      "label": "Comptes Reflechis",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "93",
      "label": "Comptes de Reclassements",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "94",
      "label": "Comptes de Coûts",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "95",
      "label": "Comptes de Stocks",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "96",
      "label": "Comptes d'Ecarts sur Couts Preetablis",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "97",
      "label": "Comptes de Differences de Traitement",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "98",
      "label": "Comptes de Resultats",
      "debit": null,
      "credit": null,
      "page": 11
    },
    {
      "code": "99",
      "label": "Comptes de Liaisons Internes",
      "debit": null,
      "credit": null,
      "page": 11
    }
  ];

  var byCode = Object.create(null);
  ROWS.forEach(function (row) {
    if (row.debit) Object.freeze(row.debit);
    if (row.credit) Object.freeze(row.credit);
    Object.freeze(row);
    byCode[row.code] = row;
  });
  Object.freeze(ROWS);

  function all() { return ROWS; }

  function getByCode(code) {
    return byCode[String(code == null ? '' : code)] || null;
  }

  function normalize(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  }

  function search(query) {
    var needle = normalize(query).trim();
    if (!needle) return ROWS;
    return ROWS.filter(function (row) {
      var fields = [row.code, row.label];
      if (row.debit) fields.push(row.debit.code, row.debit.label);
      if (row.credit) fields.push(row.credit.code, row.credit.label);
      return normalize(fields.join(' ')).indexOf(needle) !== -1;
    });
  }

  var api = Object.freeze({
    metadata: metadata,
    all: all,
    getByCode: getByCode,
    search: search
  });
  root.PerfectoAccountingFramework = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
