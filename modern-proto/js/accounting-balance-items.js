/*
 * Transcription fidèle des lignes « Poste / Intitulé / Comptes » du PDF joint.
 * Les codes, libellés, comptes et signes négatifs sont conservés tels quels.
 * SHA-256 source : e86bc39b37f6fe4cfdf3ea057117226873b8d3bcc15126478a59128665f5a283
 */
(function (root, factory) {
  'use strict';
  var AccountSearch = root.PerfectoAccountSearch;
  if (!AccountSearch && typeof require === 'function') AccountSearch = require('./account-search.js');
  var api = factory(AccountSearch);
  root.PerfectoBalanceItems = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AccountSearch) {
  'use strict';

  var metadata = Object.freeze({
    title: 'Postes du Bilan SYSCOHADA révisé',
    sourceFile: 'les postes du bilan.pdf',
    sourcePdfSha256: 'e86bc39b37f6fe4cfdf3ea057117226873b8d3bcc15126478a59128665f5a283',
    sourcePages: 4,
    postCount: 92,
    sourceLineCount: 166
  });

  var POSTS = [
  {
    "code": "AD",
    "label": "IMMOBILISATIONS INCORPORELLES",
    "accounts": [],
    "page": 1
  },
  {
    "code": "AE",
    "label": "Frais de R & D",
    "accounts": [
      "211 2181 2191",
      "<Dépréciation>",
      "2811 28181",
      "2911 29181 29191"
    ],
    "page": 1
  },
  {
    "code": "AF",
    "label": "Brevets, licences, logiciels",
    "accounts": [
      "212 213 214 2193",
      "<Dépréciation>",
      "2812 2813 2814",
      "2912 2913 2914 29193"
    ],
    "page": 1
  },
  {
    "code": "AG",
    "label": "Fonds commercial",
    "accounts": [
      "215 216",
      "<Dépréciation>",
      "2815 2816",
      "2915 2916"
    ],
    "page": 1
  },
  {
    "code": "AH",
    "label": "Autres immobilisations incorp.",
    "accounts": [
      "217 2198 218 -2181",
      "<Dépréciation>",
      "2817 2818 -28181",
      "2917 29198 2918 -29181"
    ],
    "page": 1
  },
  {
    "code": "AI",
    "label": "IMMOBILISATIONS CORPORELLES",
    "accounts": [],
    "page": 1
  },
  {
    "code": "AJ",
    "label": "Terrains",
    "accounts": [
      "22",
      "<Dépréciation>",
      "282",
      "292"
    ],
    "page": 1
  },
  {
    "code": "AK",
    "label": "Bâtiments",
    "accounts": [
      "231 232 233 237",
      "2391 2392 2393 2397",
      "<Dépréciation>",
      "2831 2832 2833 2837",
      "2931 2932 2933 2937",
      "29391 29392 29393 29397"
    ],
    "page": 1
  },
  {
    "code": "AL",
    "label": "Installations & Agencements",
    "accounts": [
      "234 235 238",
      "2394 2395 2398",
      "<Dépréciation>",
      "2834 2835 2838",
      "2934 2935 2938",
      "29394 29395 29398"
    ],
    "page": 1
  },
  {
    "code": "AM",
    "label": "Matériel",
    "accounts": [
      "24 -245",
      "249 -2495",
      "<Dépréciation>",
      "284 -2845",
      "294 -2945 -29495",
      "2949"
    ],
    "page": 1
  },
  {
    "code": "AN",
    "label": "Matériel de transport",
    "accounts": [
      "245 2495",
      "<Dépréciation>",
      "2845",
      "2945 2949"
    ],
    "page": 1
  },
  {
    "code": "AP",
    "label": "Av & Ac sur immobilisations",
    "accounts": [
      "251 252",
      "<Dépréciation>",
      "2951 2952"
    ],
    "page": 1
  },
  {
    "code": "AQ",
    "label": "IMMOBILISATIONS FINANCIERES",
    "accounts": [],
    "page": 1
  },
  {
    "code": "AR",
    "label": "Titres de participation",
    "accounts": [
      "26",
      "<Dépréciation>",
      "296"
    ],
    "page": 2
  },
  {
    "code": "AS",
    "label": "Autres immo financières",
    "accounts": [
      "27",
      "<Dépréciation>",
      "297"
    ],
    "page": 2
  },
  {
    "code": "AZ",
    "label": "TOTAL ACTIF IMMOBILISE",
    "accounts": [],
    "page": 2
  },
  {
    "code": "BA",
    "label": "Actif circulant HAO",
    "accounts": [
      "<Débiteurs>",
      "4851 4852 4853 4854 4855 4856 4857",
      "488",
      "<Dépréciation>",
      "498"
    ],
    "page": 2
  },
  {
    "code": "BB",
    "label": "Stocks et encours",
    "accounts": [
      "31 32 33 34 35 36 37 38",
      "<Dépréciation>",
      "39"
    ],
    "page": 2
  },
  {
    "code": "BG",
    "label": "CREANCES ET EMPLOIS ASSIMILIES",
    "accounts": [],
    "page": 2
  },
  {
    "code": "BH",
    "label": "Fournisseurs, avances versées",
    "accounts": [
      "<Débiteurs>",
      "40",
      "<Dépréciation>",
      "490"
    ],
    "page": 2
  },
  {
    "code": "BI",
    "label": "Clients",
    "accounts": [
      "<Débiteurs>",
      "41",
      "<Dépréciation>",
      "491"
    ],
    "page": 2
  },
  {
    "code": "BJ",
    "label": "Autres créances",
    "accounts": [
      "<Débiteurs>",
      "184 185 186 187 188",
      "42 43 44 45 46 47 -478 -479",
      "<Dépréciation>",
      "492 493 494 495 496 497"
    ],
    "page": 2
  },
  {
    "code": "BK",
    "label": "TOTAL ACTIF CIRCULANT",
    "accounts": [],
    "page": 2
  },
  {
    "code": "BQ",
    "label": "Titres de placement",
    "accounts": [
      "<Débiteurs>",
      "50",
      "<Dépréciation>",
      "590"
    ],
    "page": 2
  },
  {
    "code": "BR",
    "label": "Valeurs à encaisser",
    "accounts": [
      "<Débiteurs>",
      "51",
      "<Dépréciation>",
      "591"
    ],
    "page": 2
  },
  {
    "code": "BS",
    "label": "Banques,Chèques postausx Caisse",
    "accounts": [
      "<Débiteurs>",
      "52 53 54 55 56 57 58",
      "<Dépréciation>",
      "592 593 594"
    ],
    "page": 2
  },
  {
    "code": "BT",
    "label": "TOTAL TRESORERIE ACTIF",
    "accounts": [],
    "page": 2
  },
  {
    "code": "BU",
    "label": "Ecarts de conversion-actif",
    "accounts": [
      "478"
    ],
    "page": 2
  },
  {
    "code": "BZ",
    "label": "TOTAL GENERAL",
    "accounts": [],
    "page": 2
  },
  {
    "code": "CA",
    "label": "Capital",
    "accounts": [
      "101 102 103 104"
    ],
    "page": 2
  },
  {
    "code": "CB",
    "label": "Capital souscrit, non appelé",
    "accounts": [
      "109"
    ],
    "page": 3
  },
  {
    "code": "CD",
    "label": "Primes d'apports, ...",
    "accounts": [
      "105"
    ],
    "page": 3
  },
  {
    "code": "CE",
    "label": "Ecarts de réévaluation",
    "accounts": [
      "106"
    ],
    "page": 3
  },
  {
    "code": "CF",
    "label": "Réserves indisponibles",
    "accounts": [
      "111  112  113"
    ],
    "page": 3
  },
  {
    "code": "CG",
    "label": "Réserves libres",
    "accounts": [
      "118"
    ],
    "page": 3
  },
  {
    "code": "CH",
    "label": "Report à nouveau",
    "accounts": [
      "12 130"
    ],
    "page": 3
  },
  {
    "code": "CJ",
    "label": "Résultat net de l'exercice",
    "accounts": [
      "131 139"
    ],
    "page": 3
  },
  {
    "code": "CL",
    "label": "Subventions d'investissement",
    "accounts": [
      "14"
    ],
    "page": 3
  },
  {
    "code": "CM",
    "label": "Provisions réglementées",
    "accounts": [
      "15"
    ],
    "page": 3
  },
  {
    "code": "CP",
    "label": "TOTAL CAPITAUX PROPRES & ASSIMILE",
    "accounts": [],
    "page": 3
  },
  {
    "code": "DA",
    "label": "Emprunts",
    "accounts": [
      "16 181 182 183"
    ],
    "page": 3
  },
  {
    "code": "DB",
    "label": "Dettes de crédit-bail",
    "accounts": [
      "17"
    ],
    "page": 3
  },
  {
    "code": "DC",
    "label": "Provision pour risques et charges",
    "accounts": [
      "19"
    ],
    "page": 3
  },
  {
    "code": "DD",
    "label": "TOTAL DETTES FINANCIERES ET RESS",
    "accounts": [],
    "page": 3
  },
  {
    "code": "DF",
    "label": "TOTAL RESSOURCES STABLES",
    "accounts": [],
    "page": 3
  },
  {
    "code": "DH",
    "label": "Dettes circulantes HAO",
    "accounts": [
      "4811 4812 4813 4821 4822 1816 4817 4818",
      "<Créditeurs>",
      "4851 4852 4853 4854 4855 4856 4857 4858"
    ],
    "page": 3
  },
  {
    "code": "DI",
    "label": "Clients, avances reçues",
    "accounts": [
      "<Créditeurs>",
      "41"
    ],
    "page": 3
  },
  {
    "code": "DJ",
    "label": "Fournisseurs d'exploitation",
    "accounts": [
      "<Créditeurs>",
      "40"
    ],
    "page": 3
  },
  {
    "code": "DK",
    "label": "Dettes fiscales et sociales",
    "accounts": [
      "<Créditeurs>",
      "42 43 44"
    ],
    "page": 3
  },
  {
    "code": "DM",
    "label": "Autres dettes",
    "accounts": [
      "<Créditeurs>",
      "184 185 186 187 188",
      "45 46 47 -478 -4791"
    ],
    "page": 3
  },
  {
    "code": "DN",
    "label": "Provisions pour risques à court terme",
    "accounts": [
      "499",
      "599"
    ],
    "page": 3
  },
  {
    "code": "DP",
    "label": "TOTAL PASSIF CIRCULANT",
    "accounts": [],
    "page": 3
  },
  {
    "code": "DQ",
    "label": "Banques, crédits d'escompte",
    "accounts": [
      "<Créditeurs>",
      "564 565"
    ],
    "page": 3
  },
  {
    "code": "DR",
    "label": "Banques, crédits de de tresorerie",
    "accounts": [
      "<Créditeurs>",
      "50 51 52 53 54 55 56 -564 -565 57 58"
    ],
    "page": 3
  },
  {
    "code": "DT",
    "label": "TOTAL TRSORERIE PASSIF",
    "accounts": [],
    "page": 3
  },
  {
    "code": "DV",
    "label": "Ecart de conversion-passif",
    "accounts": [
      "479"
    ],
    "page": 3
  },
  {
    "code": "DZ",
    "label": "TOTAL GENERAL",
    "accounts": [],
    "page": 3
  },
  {
    "code": "R",
    "label": "RESULTAT - CHARGES",
    "accounts": [],
    "page": 3
  },
  {
    "code": "RA",
    "label": "Achats de marchandises",
    "accounts": [
      "601"
    ],
    "page": 3
  },
  {
    "code": "RB",
    "label": "Variations de stocks de marchandises",
    "accounts": [
      "6031"
    ],
    "page": 3
  },
  {
    "code": "RC",
    "label": "Achats de matières premières",
    "accounts": [
      "602"
    ],
    "page": 3
  },
  {
    "code": "RD",
    "label": "Variations de stocks de mat. premières",
    "accounts": [
      "6032"
    ],
    "page": 4
  },
  {
    "code": "RE",
    "label": "Autres achats",
    "accounts": [
      "604  605  608"
    ],
    "page": 4
  },
  {
    "code": "RF",
    "label": "Variations de stocks",
    "accounts": [
      "6033"
    ],
    "page": 4
  },
  {
    "code": "RG",
    "label": "Transports",
    "accounts": [
      "61"
    ],
    "page": 4
  },
  {
    "code": "RH",
    "label": "Services extérieurs",
    "accounts": [
      "62 63"
    ],
    "page": 4
  },
  {
    "code": "RI",
    "label": "Impôts et taxes",
    "accounts": [
      "64"
    ],
    "page": 4
  },
  {
    "code": "RJ",
    "label": "Autres charges",
    "accounts": [
      "65"
    ],
    "page": 4
  },
  {
    "code": "RK",
    "label": "Charges de personnel",
    "accounts": [
      "66"
    ],
    "page": 4
  },
  {
    "code": "RL",
    "label": "Dotatations Amort & Prov",
    "accounts": [
      "681  691"
    ],
    "page": 4
  },
  {
    "code": "RM",
    "label": "Frais financiers et charges assimilées",
    "accounts": [
      "67"
    ],
    "page": 4
  },
  {
    "code": "RN",
    "label": "Dotations aux dépréciations financières",
    "accounts": [
      "697"
    ],
    "page": 4
  },
  {
    "code": "RO",
    "label": "Valeurs comptables des cessions",
    "accounts": [
      "81"
    ],
    "page": 4
  },
  {
    "code": "RP",
    "label": "Autres charges HAO",
    "accounts": [
      "83 85"
    ],
    "page": 4
  },
  {
    "code": "RQ",
    "label": "Participation des travailleurs",
    "accounts": [
      "87"
    ],
    "page": 4
  },
  {
    "code": "RS",
    "label": "Impôt sur le résultat",
    "accounts": [
      "89"
    ],
    "page": 4
  },
  {
    "code": "T",
    "label": "RESULTAT-PRODUITS",
    "accounts": [],
    "page": 4
  },
  {
    "code": "TA",
    "label": "Ventes de marchandises",
    "accounts": [
      "701"
    ],
    "page": 4
  },
  {
    "code": "TB",
    "label": "Ventes de produits fabriqués",
    "accounts": [
      "702 703 704"
    ],
    "page": 4
  },
  {
    "code": "TC",
    "label": "Travaux, sevices vendus",
    "accounts": [
      "705 706"
    ],
    "page": 4
  },
  {
    "code": "TD",
    "label": "Produits accessoires",
    "accounts": [
      "707"
    ],
    "page": 4
  },
  {
    "code": "TE",
    "label": "Production stockée",
    "accounts": [
      "73"
    ],
    "page": 4
  },
  {
    "code": "TF",
    "label": "Production immobilisée",
    "accounts": [
      "72"
    ],
    "page": 4
  },
  {
    "code": "TG",
    "label": "Subventions d'exploitation",
    "accounts": [
      "71"
    ],
    "page": 4
  },
  {
    "code": "TH",
    "label": "Autres produits",
    "accounts": [
      "75"
    ],
    "page": 4
  },
  {
    "code": "TI",
    "label": "Transfert de charges",
    "accounts": [
      "781"
    ],
    "page": 4
  },
  {
    "code": "TJ",
    "label": "Reprises/Amort., Prov. et dépréciatios",
    "accounts": [
      "791 798 799"
    ],
    "page": 4
  },
  {
    "code": "TK",
    "label": "Revenus financiers et assimilés",
    "accounts": [
      "77"
    ],
    "page": 4
  },
  {
    "code": "TL",
    "label": "Reprises sur dépréciatios financières",
    "accounts": [
      "797"
    ],
    "page": 4
  },
  {
    "code": "TM",
    "label": "Transfert de charges financières",
    "accounts": [
      "787"
    ],
    "page": 4
  },
  {
    "code": "TN",
    "label": "Produits de cessions d'immobilisations",
    "accounts": [
      "82"
    ],
    "page": 4
  },
  {
    "code": "TO",
    "label": "Autrs produits HAO",
    "accounts": [
      "84 86 88"
    ],
    "page": 4
  }
];
  var byCode = Object.create(null);
  POSTS.forEach(function (post) {
    Object.freeze(post.accounts);
    Object.freeze(post);
    byCode[post.code] = post;
  });
  Object.freeze(POSTS);

  function all() { return POSTS; }
  function getByCode(code) { return byCode[String(code == null ? '' : code)] || null; }

  function search(query) {
    var needle = String(query == null ? '' : query).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').trim();
    if (!needle) return POSTS;
    var codePrefix = AccountSearch && AccountSearch.codeQuery(needle);
    return POSTS.filter(function (post) {
      if (codePrefix) {
        var codes = [post.code].concat(post.accounts || []).join(' ').split(/[\s,;]+/).filter(Boolean);
        return codes.some(function (code) { return String(code).toLocaleLowerCase('fr').indexOf(codePrefix) === 0; });
      }
      var fields = [post.code, post.label].concat(post.accounts);
      return fields.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').indexOf(needle) !== -1;
    });
  }

  return Object.freeze({
    metadata: metadata,
    all: all,
    getByCode: getByCode,
    search: search
  });
});
