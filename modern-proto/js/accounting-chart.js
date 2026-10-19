/*
 * PERFECTO · Plan comptable de référence fourni pour le prototype.
 * 147 codes, en français. Les soldes et écritures historiques ne sont pas
 * reclassés par ce référentiel : les comptes antérieurs sont conservés à part.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoAccountingChart = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var VERSION = 1;
  var CLASS_LABELS = {
    1: 'Ressources durables',
    2: 'Actif immobilisé',
    3: 'Stocks',
    4: 'Tiers',
    5: 'Trésorerie',
    6: 'Charges',
    7: 'Produits',
    8: 'SIG et comptes spéciaux'
  };

  var SUBCLASS_LABELS = {
    '10': 'Capital', '11': 'Réserves', '12': 'Report à nouveau', '13': 'Résultat net', '16': 'Emprunts et dettes assimilées',
    '20': 'Immobilisations incorporelles', '21': 'Immobilisations incorporelles', '22': 'Terrains', '23': 'Bâtiments, installations et agencements',
    '24': 'Matériel', '25': 'Avances et acomptes sur immobilisations', '27': 'Immobilisations financières', '28': 'Amortissements et dépréciations',
    '31': 'Marchandises', '32': 'Matières premières et fournitures liées', '33': 'Autres approvisionnements', '35': 'Produits',
    '36': 'Produits résiduels', '38': 'Stocks en cours de route, en consignation ou en dépôt', '39': 'Dépréciations des stocks',
    '40': 'Fournisseurs et comptes rattachés', '41': 'Clients et comptes rattachés', '42': 'Personnel', '43': 'Organismes sociaux',
    '44': 'État et collectivités publiques', '45': 'Organismes internationaux et associés', '47': 'Débiteurs et créditeurs divers',
    '48': 'Comptes de régularisation', '52': 'Banques', '53': 'Établissements financiers et assimilés', '54': 'Instruments de trésorerie',
    '57': 'Caisse', '58': 'Virements internes', '60': 'Achats et variations de stocks', '61': 'Transports', '62': 'Services extérieurs A',
    '63': 'Services extérieurs B', '64': 'Impôts et taxes', '65': 'Autres charges', '66': 'Charges financières', '67': 'Charges exceptionnelles et HAO',
    '68': 'Dotations aux amortissements', '69': 'Dotations aux provisions et dépréciations', '70': 'Ventes', '72': 'Production immobilisée',
    '73': 'Variations des stocks de biens et services produits', '75': 'Autres produits', '76': 'Produits financiers',
    '77': 'Produits exceptionnels et HAO', '79': 'Reprises de charges', '81': 'Marge commerciale', '82': 'Valeur ajoutée',
    '83': 'Excédent brut d’exploitation', '84': 'Résultat d’exploitation', '85': 'Résultat financier', '86': 'Résultat des activités ordinaires',
    '87': 'Résultat hors activités ordinaires', '88': 'Résultat net', '89': 'Engagements hors bilan'
  };

  /* code, libellé, nature / utilisation */
  var ROWS = [
    ['10', 'Capital', 'Regroupe les apports et les mouvements du capital.'],
    ['101', 'Capital social', 'Capital souscrit par les associés ou actionnaires.'],
    ['102', 'Capital par dotation', 'Capital constitué par dotation.'],
    ['104', 'Primes liées au capital', 'Primes liées aux opérations sur le capital.'],
    ['11', 'Réserves', 'Résultats antérieurs affectés en réserves.'],
    ['111', 'Réserve légale', 'Réserve constituée selon les dispositions légales.'],
    ['112', 'Réserves statutaires ou contractuelles', 'Réserves constituées selon les statuts ou les contrats.'],
    ['118', 'Autres réserves', 'Réserves autres que légales, statutaires ou contractuelles.'],
    ['12', 'Report à nouveau', 'Résultats antérieurs non encore affectés.'],
    ['121', 'Report à nouveau créditeur', 'Solde créditeur des résultats antérieurs reportés.'],
    ['129', 'Report à nouveau débiteur', 'Solde débiteur des résultats antérieurs reportés.'],
    ['13', 'Résultat net de l’exercice', 'Regroupe le résultat bénéficiaire ou déficitaire de l’exercice.'],
    ['131', 'Résultat net : bénéfice', 'Bénéfice net de l’exercice.'],
    ['139', 'Résultat net : perte', 'Perte nette de l’exercice.'],
    ['161', 'Emprunts obligataires', 'Emprunts contractés par émission d’obligations.'],
    ['162', 'Emprunts et dettes auprès des établissements de crédit', 'Emprunts et dettes contractés auprès des banques et établissements de crédit.'],
    ['163', 'Avances reçues de l’État', 'Avances et fonds reçus de l’État.'],
    ['164', 'Avances reçues et comptes courants bloqués', 'Avances reçues et comptes courants dont le remboursement est bloqué.'],
    ['165', 'Dépôts et cautionnements reçus', 'Dépôts et cautionnements reçus de tiers.'],
    ['168', 'Autres emprunts et dettes assimilées', 'Autres emprunts et dettes financières assimilées.'],

    ['20', 'Immobilisations incorporelles', 'Regroupe les immobilisations incorporelles et frais immobilisés.'],
    ['211', 'Frais de recherche et de développement', 'Dépenses de recherche et de développement immobilisées.'],
    ['212', 'Brevets, licences, logiciels, marques et droits similaires', 'Droits incorporels acquis ou développés et contrôlés par l’entité.'],
    ['213', 'Logiciels et sites internet', 'Logiciels et sites internet immobilisés.'],
    ['214', 'Marques, procédés et droits similaires', 'Marques, procédés, modèles et droits similaires immobilisés.'],
    ['215', 'Fonds commercial', 'Éléments incorporels du fonds commercial acquis.'],
    ['221', 'Terrains agricoles et forestiers', 'Terrains agricoles et forestiers détenus par l’entité.'],
    ['222', 'Terrains nus', 'Terrains nus détenus par l’entité.'],
    ['224', 'Terrains bâtis', 'Terrains bâtis détenus par l’entité.'],
    ['231', 'Bâtiments', 'Bâtiments détenus ou utilisés durablement par l’entité.'],
    ['232', 'Installations et agencements', 'Installations et agencements des bâtiments et terrains.'],
    ['234', 'Aménagements de bureaux', 'Aménagements et installations des locaux professionnels.'],
    ['241', 'Matériel et outillage industriel et commercial', 'Matériel et outillage affectés à l’activité industrielle ou commerciale.'],
    ['242', 'Matériel de transport', 'Véhicules et autres matériels de transport.'],
    ['244', 'Matériel de bureau et informatique', 'Matériel de bureau, informatique et équipements assimilés.'],
    ['245', 'Mobilier', 'Mobilier utilisé durablement par l’entité.'],
    ['246', 'Matériel d’emballage récupérable', 'Emballages récupérables immobilisés.'],
    ['251', 'Avances et acomptes versés sur immobilisations', 'Avances et acomptes versés aux fournisseurs d’immobilisations.'],
    ['271', 'Prêts et créances non commerciales', 'Prêts et créances accordés hors opérations commerciales courantes.'],
    ['281', 'Amortissements des immobilisations incorporelles', 'Amortissements cumulés des immobilisations incorporelles.'],
    ['283', 'Amortissements des immobilisations corporelles', 'Amortissements cumulés des immobilisations corporelles.'],
    ['284', 'Dépréciations des immobilisations', 'Dépréciations constatées sur les immobilisations.'],

    ['311', 'Marchandises A', 'Stock de marchandises du groupe A.'],
    ['312', 'Marchandises B', 'Stock de marchandises du groupe B.'],
    ['321', 'Matières premières A', 'Stock de matières premières du groupe A.'],
    ['322', 'Matières premières B', 'Stock de matières premières du groupe B.'],
    ['331', 'Matières et fournitures consommables', 'Stock de matières et fournitures consommables.'],
    ['335', 'Travaux en cours', 'Coût des travaux et prestations en cours de réalisation.'],
    ['351', 'Produits finis', 'Stock de produits achevés et prêts à être vendus.'],
    ['352', 'Produits intermédiaires', 'Stock de produits intermédiaires.'],
    ['361', 'Produits résiduels', 'Stock de produits résiduels et matières de récupération.'],
    ['38', 'Stocks en cours de route, en consignation ou en dépôt', 'Stocks dont le lieu ou le détenteur diffère de l’entité.'],
    ['391', 'Dépréciations des stocks de marchandises', 'Dépréciations constatées sur les stocks de marchandises.'],

    ['401', 'Fournisseurs, dettes en compte', 'Dettes fournisseurs relatives aux achats et prestations en compte.'],
    ['402', 'Fournisseurs, effets à payer', 'Dettes fournisseurs matérialisées par des effets à payer.'],
    ['404', 'Fournisseurs d’immobilisations', 'Dettes envers les fournisseurs d’immobilisations.'],
    ['408', 'Fournisseurs, factures non parvenues', 'Factures à recevoir pour biens ou services livrés avant la clôture.'],
    ['409', 'Fournisseurs débiteurs', 'Avances, acomptes et autres créances sur les fournisseurs.'],
    ['411', 'Clients', 'Créances clients relatives aux ventes et prestations en compte.'],
    ['412', 'Clients, effets à recevoir', 'Créances clients matérialisées par des effets à recevoir.'],
    ['413', 'Clients, effets à l’escompte', 'Effets remis à l’escompte non encore échus.'],
    ['416', 'Clients douteux ou litigieux', 'Créances présentant un risque de recouvrement.'],
    ['419', 'Clients créditeurs', 'Avances, acomptes et autres dettes envers les clients.'],
    ['421', 'Personnel, rémunérations dues', 'Rémunérations dues au personnel.'],
    ['422', 'Personnel, avances et acomptes', 'Avances et acomptes versés au personnel.'],
    ['425', 'Personnel, dépôts reçus', 'Dépôts et cautionnements reçus du personnel.'],
    ['427', 'Personnel, oppositions', 'Oppositions et saisies opérées sur les rémunérations.'],
    ['431', 'Organismes sociaux', 'Dettes et créances envers les organismes sociaux.'],
    ['441', 'État, impôts et taxes', 'Impôts et taxes dus à l’État et aux collectivités publiques.'],
    ['443', 'État, TVA facturée', 'Taxe sur la valeur ajoutée facturée aux clients.'],
    ['444', 'État, TVA due ou crédit de TVA', 'TVA à payer à l’État ou crédit de TVA à récupérer.'],
    ['447', 'État, impôts retenus à la source', 'Impôts et taxes retenus à la source pour le compte de l’État.'],
    ['449', 'État, obligations cautionnées', 'Dettes fiscales couvertes par des obligations cautionnées.'],
    ['451', 'Opérations avec les organismes internationaux et associés', 'Opérations financières avec les organismes internationaux, associés et groupe.'],
    ['471', 'Débiteurs et créditeurs divers', 'Créances et dettes diverses hors comptes fournisseurs et clients.'],
    ['481', 'Fournisseurs d’investissements', 'Dettes envers les fournisseurs d’investissements.'],
    ['486', 'Charges constatées d’avance', 'Charges enregistrées sur l’exercice mais concernant une période ultérieure.'],
    ['487', 'Produits constatés d’avance', 'Produits enregistrés sur l’exercice mais concernant une période ultérieure.'],
    ['488', 'Autres comptes de régularisation', 'Autres créances et dettes de régularisation à la clôture.'],

    ['521', 'Banques locales', 'Disponibilités détenues dans les banques locales.'],
    ['522', 'Banques autres États de la zone', 'Disponibilités détenues dans les banques des autres États de la zone.'],
    ['523', 'Banques hors zone', 'Disponibilités détenues dans les banques hors de la zone.'],
    ['524', 'Banques, comptes à terme', 'Dépôts bancaires à terme et placements assimilés.'],
    ['531', 'Chèques postaux', 'Disponibilités déposées auprès des services de chèques postaux.'],
    ['541', 'Instruments de trésorerie', 'Instruments financiers détenus à des fins de trésorerie.'],
    ['571', 'Caisse siège social', 'Espèces détenues à la caisse du siège social.'],
    ['572', 'Caisse succursale', 'Espèces détenues dans les caisses des succursales.'],
    ['581', 'Virements de fonds', 'Transferts internes de fonds entre comptes de trésorerie.'],

    ['601', 'Achats de marchandises', 'Achats de biens destinés à être revendus en l’état.'],
    ['602', 'Achats de matières premières et fournitures liées', 'Achats de matières premières et fournitures entrant dans la production.'],
    ['604', 'Achats stockés de matières et fournitures consommables', 'Achats stockés de matières et fournitures consommables.'],
    ['605', 'Achats non stockés de matières et fournitures', 'Achats de matières et fournitures non suivis en stock.'],
    ['608', 'Achats d’études, prestations de services et travaux', 'Études, prestations et travaux achetés à des tiers.'],
    ['609', 'Rabais, remises et ristournes obtenus', 'Réductions obtenues sur les achats.'],
    ['611', 'Transports sur achats', 'Transports relatifs aux achats de biens et approvisionnements.'],
    ['612', 'Transports sur ventes', 'Transports relatifs aux ventes de biens et marchandises.'],
    ['613', 'Transports pour le compte de tiers', 'Transports refacturés ou réalisés pour le compte de tiers.'],
    ['618', 'Autres frais de transport', 'Autres frais et services de transport.'],
    ['621', 'Sous-traitance générale', 'Travaux confiés à des sous-traitants.'],
    ['622', 'Locations et charges locatives', 'Locations, loyers et charges locatives.'],
    ['623', 'Redevances de crédit-bail et contrats assimilés', 'Redevances de crédit-bail et de contrats assimilés.'],
    ['624', 'Entretien, réparations et maintenance', 'Entretien, réparations et maintenance des biens.'],
    ['625', 'Primes d’assurance', 'Primes versées au titre des contrats d’assurance.'],
    ['626', 'Études, recherches et documentation', 'Études, recherches, documentation et abonnements professionnels.'],
    ['627', 'Publicité, publications et relations publiques', 'Publicité, publications, communication et relations publiques.'],
    ['628', 'Frais de télécommunications et services divers', 'Télécommunications et autres services extérieurs non classés ailleurs.'],
    ['631', 'Frais bancaires', 'Commissions et frais facturés par les banques.'],
    ['634', 'Taxes indirectes', 'Taxes indirectes supportées par l’entité.'],
    ['636', 'Impôts et taxes directs', 'Impôts, contributions et taxes directs à la charge de l’entité.'],
    ['641', 'Rémunérations du personnel', 'Salaires et rémunérations brutes du personnel.'],
    ['643', 'Rémunérations du travail de l’exploitant', 'Rémunération du travail de l’exploitant individuel.'],
    ['644', 'Rémunérations et indemnités des dirigeants', 'Rémunérations et indemnités attribuées aux dirigeants.'],
    ['645', 'Charges sociales', 'Charges sociales supportées par l’employeur.'],
    ['647', 'Autres charges sociales', 'Autres charges liées au personnel et à la protection sociale.'],
    ['651', 'Pertes sur créances clients', 'Pertes constatées sur les créances clients irrécouvrables.'],
    ['659', 'Charges provisionnées d’exploitation', 'Dotations et charges provisionnées liées à l’exploitation.'],
    ['661', 'Charges d’intérêts', 'Intérêts dus sur emprunts, dettes et concours financiers.'],
    ['664', 'Pertes de change', 'Pertes résultant des variations de change.'],
    ['671', 'Pertes sur cessions d’immobilisations', 'Pertes réalisées lors de la cession d’immobilisations.'],
    ['681', 'Dotations aux amortissements d’exploitation', 'Dotations d’exploitation aux amortissements.'],
    ['691', 'Dotations aux provisions et dépréciations d’exploitation', 'Dotations d’exploitation aux provisions et dépréciations.'],
    ['695', 'Impôts sur le résultat', 'Impôts dus au titre du résultat de l’exercice.'],

    ['701', 'Ventes de marchandises', 'Produits provenant de la revente de marchandises en l’état.'],
    ['702', 'Ventes de produits finis', 'Produits provenant de la vente de produits fabriqués et achevés.'],
    ['703', 'Ventes de produits intermédiaires', 'Produits provenant de la vente de produits intermédiaires.'],
    ['706', 'Services vendus', 'Produits provenant des prestations de services vendues.'],
    ['707', 'Produits accessoires', 'Produits accessoires liés à l’activité ordinaire.'],
    ['709', 'Rabais, remises et ristournes accordés', 'Réductions accordées sur les ventes.'],
    ['721', 'Production immobilisée, immobilisations incorporelles', 'Production de l’exercice immobilisée en incorporel.'],
    ['722', 'Production immobilisée, immobilisations corporelles', 'Production de l’exercice immobilisée en corporel.'],
    ['731', 'Variations des stocks de produits', 'Variation des stocks de produits fabriqués et en cours.'],
    ['752', 'Revenus des immeubles non affectés aux activités professionnelles', 'Revenus locatifs des immeubles non affectés à l’activité professionnelle.'],
    ['755', 'Quote-part de subventions d’investissement virée au résultat', 'Quote-part des subventions d’investissement transférée au résultat.'],
    ['758', 'Produits divers', 'Autres produits divers liés à l’activité ordinaire.'],
    ['761', 'Revenus financiers', 'Intérêts, produits de placements et autres revenus financiers.'],
    ['771', 'Gains de change', 'Gains résultant des variations de change.'],
    ['791', 'Reprises de charges provisionnées d’exploitation', 'Reprises de provisions et charges provisionnées d’exploitation.'],

    ['81', 'Marge commerciale', 'Indicateur de gestion : ventes de marchandises diminuées du coût d’achat des marchandises vendues.'],
    ['82', 'Valeur ajoutée', 'Indicateur de gestion : richesse créée par l’activité de l’entité.'],
    ['83', 'Excédent brut d’exploitation', 'Indicateur de gestion : performance d’exploitation avant amortissements et provisions.'],
    ['84', 'Résultat d’exploitation', 'Indicateur de gestion : résultat des opérations d’exploitation.'],
    ['85', 'Résultat financier', 'Indicateur de gestion : solde des produits et charges financiers.'],
    ['86', 'Résultat des activités ordinaires', 'Indicateur de gestion : résultat des activités ordinaires.'],
    ['87', 'Résultat hors activités ordinaires', 'Indicateur de gestion : résultat des activités hors activités ordinaires.'],
    ['88', 'Résultat net', 'Indicateur de gestion : résultat net de l’exercice.'],
    ['891', 'Engagements hors bilan donnés', 'Suivi des engagements hors bilan donnés par l’entité.'],
    ['892', 'Contrepartie des engagements hors bilan', 'Contrepartie des engagements hors bilan enregistrés.']
  ];

  var AUXILIARY_CODES = {
    '401': true, '402': true, '404': true, '408': true, '409': true,
    '411': true, '412': true, '413': true, '416': true, '419': true,
    '421': true, '422': true, '425': true, '427': true, '431': true,
    '441': true, '443': true, '444': true, '447': true, '449': true,
    '451': true, '471': true
  };
  var NON_POSTABLE_CODES = {
    '10': true, '11': true, '12': true, '13': true, '20': true, '38': true,
    '81': true, '82': true, '83': true, '84': true, '85': true, '86': true, '87': true, '88': true
  };
  var ACTIVE_NATURES = {
    '409': true, '411': true, '412': true, '413': true, '416': true, '422': true,
    '444': true, '471': true, '486': true, '488': true
  };
  var LIABILITY_NATURES = {
    '419': true, '421': true, '425': true, '427': true, '431': true, '441': true,
    '443': true, '447': true, '449': true, '481': true, '487': true
  };

  function accountNature(code) {
    var first = String(code).charAt(0);
    if (first === '1') return 'Passif';
    if (first === '2' || first === '3' || first === '5') return 'Actif';
    if (first === '4') {
      if (ACTIVE_NATURES[code]) return 'Actif';
      if (LIABILITY_NATURES[code]) return 'Passif';
      return 'Passif';
    }
    if (first === '6') return 'Charge';
    if (first === '7') return 'Produit';
    if (first === '8') return String(code).indexOf('89') === 0 ? 'Hors bilan' : 'SIG';
    return 'Actif';
  }

  function accountFromRow(row) {
    var code = row[0];
    var cls = Number(code.charAt(0));
    var subclass = code.slice(0, 2);
    return {
      code: code,
      label: row[1],
      cls: cls,
      classLabel: CLASS_LABELS[cls] || ('Classe ' + cls),
      subclass: subclass,
      subclassLabel: SUBCLASS_LABELS[subclass] || 'Autres comptes',
      nature: row[3] || accountNature(code),
      usage: row[2],
      aux: !!AUXILIARY_CODES[code],
      active: true,
      postable: !NON_POSTABLE_CODES[code],
      legacy: false,
      standard: true
    };
  }

  function accounts() {
    return ROWS.map(accountFromRow);
  }

  function codes() {
    return ROWS.map(function (row) { return row[0]; });
  }

  function classLabel(cls) {
    return CLASS_LABELS[Number(cls)] || ('Classe ' + Number(cls));
  }

  return {
    VERSION: VERSION,
    CLASS_LABELS: CLASS_LABELS,
    SUBCLASS_LABELS: SUBCLASS_LABELS,
    accounts: accounts,
    codes: codes,
    classLabel: classLabel,
    accountCount: function () { return ROWS.length; }
  };
});
