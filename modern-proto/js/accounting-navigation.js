/* Menu de la comptabilité générale. Les fonctions analytiques et non implémentées
   restent visibles, mais n'exécutent aucun traitement. */
(function (root) {
  'use strict';

  var groups = [
    {
      id: 'fichier', label: 'Fichier', icon: '▤', defaultTab: 'export-other', tabs: [
        { id: 'export-other', label: 'Exportation vers d’autres logiciels', status: 'partial', reason: 'Le format commun PERFECTO-ÉCHANGE v1 en classeur Excel et CSV est disponible. Les adaptateurs directs Sage, PERFECTO historique, HYPERSOFT et ODOO restent à construire.' },
        { id: 'import-other', label: 'Importation depuis d’autres logiciels', status: 'partial', reason: 'L’import du format commun PERFECTO-ÉCHANGE v1 en classeur Excel ou CSV est disponible avec aperçu, correspondance des comptes et journaux, sauvegarde et contrôle du lot. Les profils natifs Sage, PERFECTO historique, HYPERSOFT et ODOO restent à construire.' },
        { id: 'import-balance', label: 'Importation d’une balance générale', status: 'partial', reason: 'Import du format commun PERFECTO-BALANCE v1 en CSV ou classeur Excel, par prévisualisation et création d’une pièce de reprise. Les formats natifs des logiciels et les balances de mouvements restent à construire.' },
        { id: 'centralize-auxiliary', label: 'Centralisation auxiliaire interne', status: 'planned', reason: 'À construire après les modules internes de gestion des tiers et des mouvements auxiliaires. Le pivot PERFECTO-AUXILIAIRE v1 relève des échanges de fichiers et n’alimente pas une centralisation interne.' },
        { id: 'centralize-payroll', label: 'Centralisation des salaires depuis Paie et RH', status: 'partial', reason: 'Centralisation d’un lot approuvé produit dans le module interne Paie & RH, sans import de fichier externe. Les calculs de paie complets restent à construire.' },
        { id: 'centralize-sales', label: 'Centralisation des opérations depuis Vente, Stock et Facturation', status: 'partial', reason: 'Centralise un lot approuvé issu du module maison Ventes, stock & facturation, sans fichier ni logiciel tiers. Les calculs réels de facturation, de fiscalité et de valorisation des stocks restent à construire.' },
        { id: 'cancel-centralization', label: 'Annulation d’une centralisation', status: 'partial', reason: 'Annulation des centralisations internes Paie & RH et Ventes, stock & facturation : suppression contrôlée des brouillons ou écriture inverse des pièces validées. Les fichiers et sources tierces sont exclus.' },
        { id: 'consolidate-before-result', label: 'Consolidation avant résultat', status: 'partial', reason: 'Journal groupé consultable et exportable par période, regroupé par compte avec provenance de chaque ligne source. Les écritures validées sont lues en lecture seule ; aucun mouvement n’est ajouté au grand livre.' },
        { id: 'consolidate-after-result', label: 'Consolidation après résultat', status: 'partial', reason: 'Journal groupé consultable et exportable des écritures validées de la période, regroupé par compte avec provenance de chaque ligne source. Lecture seule : le résultat, son affectation et les écritures de clôture ne sont ni calculés ni comptabilisés ici. La détection automatique de la pièce/date de résultat et les règles d’affectation restent à définir.' },
        { id: 'recalculate-balances', label: 'Recalcul du solde des comptes', status: 'partial', reason: 'Recalcule les soldes des écritures validées du cycle, contrôle l’équilibre et compare au calcul actuel de la balance générale. Lecture seule : aucun solde ni aucune écriture n’est modifié.' },
        { id: 'repair-database', label: 'Réparation complète de la base', status: 'partial', reason: 'Analyse complète du dossier actif et réparation protégée des métadonnées de périodes. Toute intervention sur les écritures, les montants, le plan ou les journaux est signalée mais jamais automatisée.' },
        { id: 'open-next-year', label: 'Ouverture de l’exercice suivant', status: 'planned', reason: 'À regrouper avec le passage à N+1 dans les opérations de fin d’exercice.' },
        { id: 'quit', label: 'Quitter', status: 'active', reason: 'Retour au launcher PERFECTO.', actions: [{ label: 'Retourner au launcher', route: 'launcher' }] }
      ]
    },
    {
      id: 'definitions', label: 'Définitions', icon: '▧', defaultTab: 'general-accounts', tabs: [
        { id: 'general-accounts', label: 'Comptes généraux', status: 'active', reason: 'Plan complet des 147 comptes fournis, classés par classe et sous-classe ; les comptes historiques sont conservés pour compatibilité.', actions: [{ label: 'Ouvrir le plan comptable', route: 'accounts' }] },
        { id: 'suppliers', label: 'Fournisseurs', status: 'partial', reason: 'Répertoire local par dossier : code FOU proposé automatiquement, modification, archivage et suppression protégée si une écriture référence la fiche. Les factures, règlements, mouvements auxiliaires, lettrage et soldes tiers restent à construire ; les centralisations sont réservées aux modules PERFECTO internes.' },
        { id: 'clients', label: 'Clients', status: 'partial', reason: 'Répertoire local des clients de l’entreprise suivie, distinct des dossiers clients du cabinet : code CLI proposé automatiquement, modification et suppression protégée si une écriture référence la fiche. Facturation, règlements et comptabilité auxiliaire complète restent à construire ; les centralisations sont réservées aux modules PERFECTO internes.' },
        { id: 'personnel', label: 'Personnel', status: 'planned', reason: 'Comptes et auxiliaires du personnel à construire dans le périmètre général.' },
        { id: 'other-debtors-creditors', label: 'Débiteurs et créditeurs divers', status: 'planned', reason: 'Comptabilité auxiliaire générale à construire.' },
        { id: 'responsibility-centers', label: 'Centre de responsabilité (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'activity-domains', label: 'Domaines d’activité (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'services', label: 'Prestations', status: 'review', reason: 'Rattachement à confirmer ; reste inactif en attendant votre décision.' },
        { id: 'expense-categories', label: 'Catégories de dépenses (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'funding-sources', label: 'Sources de financement (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'alternate-accounts', label: 'Comptes alternatifs (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        {
          id: 'diverse-analyses', label: 'Analyses diverses', status: 'inactive', reason: 'Sous-menu analytique ; ses éléments restent inactifs.',
          children: [
            { id: 'vehicle-expenses', label: 'Frais sur véhicules', status: 'inactive' },
            { id: 'mission-beneficiaries', label: 'Bénéficiaires de frais de mission', status: 'inactive' },
            { id: 'other-analyses', label: 'Autres analyses à définir', status: 'review' },
            { id: 'cash-flow-natures', label: 'Natures des flux de trésorerie', status: 'inactive' }
          ]
        },
        { id: 'fixed-asset-locations', label: 'Localisation des immobilisations corporelles', status: 'planned', reason: 'Référentiel général à construire avec la gestion des immobilisations.' },
        { id: 'fixed-assets', label: 'Éléments immobilisés', status: 'planned', reason: 'Fonction générale à construire avant le calcul des amortissements.' },
        { id: 'journals', label: 'Journaux', status: 'active', reason: 'Référentiel de journaux actuellement disponible.', actions: [{ label: 'Consulter les journaux comptables', route: 'journals' }] }
      ]
    },
    {
      id: 'saisie', label: 'Saisie', icon: '＋', defaultTab: 'journal-entry', tabs: [
        { id: 'journal-entry', label: 'Saisie dans les journaux', status: 'active', reason: 'Saisie générale avec contrôle d’équilibre actuellement disponible.', actions: [{ label: 'Saisir une écriture', route: 'entry' }, { label: 'Consulter les pièces comptables', route: 'entries' }] },
        { id: 'live-cash', label: 'Opérations de caisse en temps réel', status: 'planned', reason: 'Fonction générale à construire et à relier aux journaux de trésorerie.' },
        {
          id: 'account-movements', label: 'Mouvements des comptes généraux, tiers et analytiques', status: 'mixed', reason: 'Les saisies dédiées aux mouvements généraux et tiers restent à construire ; le volet analytique est inactif.',
          children: [
            { id: 'general-movements', label: 'Comptes généraux', status: 'planned', reason: 'Le formulaire de saisie des mouvements généraux reste à construire.' },
            { id: 'third-party-movements', label: 'Comptes tiers', status: 'planned' },
            { id: 'analytic-movements', label: 'Comptes analytiques', status: 'inactive' }
          ]
        },
        { id: 'scheduled-payments', label: 'Programmation des règlements à effectuer (analytique)', status: 'inactive', reason: 'Fonction explicitement analytique.' },
        { id: 'invoice-payment-allocation', label: 'Affectation des règlements aux factures émises (analytique)', status: 'inactive', reason: 'Fonction explicitement analytique et liée à la facturation.' },
        { id: 'matching', label: 'Lettrage', status: 'planned', reason: 'Fonction générale à construire avec les auxiliaires clients et fournisseurs.' },
        { id: 'reconciliation', label: 'Pointage', status: 'planned', reason: 'Fonction générale à construire avec les contrôles de comptes.' },
        { id: 'supplier-orders', label: 'Commandes aux fournisseurs (analytique)', status: 'inactive', reason: 'Relève des achats et/ou de la comptabilité analytique, hors du périmètre actuel.' },
        { id: 'forecast-budgets', label: 'Budgets prévisionnels', status: 'review', reason: 'Périmètre à préciser ; reste inactif jusqu’à votre décision.' },
        { id: 'opening-balances', label: 'Reports à nouveau', status: 'planned', reason: 'Fonction générale à construire et à intégrer au passage d’exercice.' }
      ]
    },
    {
      id: 'editions', label: 'Éditions', icon: '▤', defaultTab: 'journals', tabs: [
        { id: 'journals', label: 'Journaux', status: 'active', reason: 'Consultation des écritures validées.', actions: [{ label: 'Afficher le journal des écritures', route: 'journal' }] },
        { id: 'general-accounts', label: 'Comptes généraux', status: 'active', reason: 'Consultation de la balance et du grand livre.', actions: [{ label: 'Afficher la balance générale', route: 'balance' }, { label: 'Afficher le grand livre', route: 'ledger' }] },
        { id: 'third-parties', label: 'Tiers', status: 'planned', reason: 'Éditions à construire après le référentiel et les mouvements tiers.' },
        { id: 'foreign-currency', label: 'Comptes en devises', status: 'planned', reason: 'Édition générale à construire après définition de la gestion multidevise.' },
        { id: 'analytic-statements', label: 'États analytiques', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'supplier-orders', label: 'Commandes aux fournisseurs (analytique)', status: 'inactive', reason: 'Fonction analytique / achats hors du périmètre actuel.' },
        { id: 'budget', label: 'Budget', status: 'review', reason: 'Périmètre à préciser ; reste inactif jusqu’à votre décision.' },
        { id: 'accounts-payable', label: 'Comptes à payer (analytique)', status: 'inactive', reason: 'Élément fourni comme analytique dans votre nomenclature.' },
        { id: 'accounts-receivable', label: 'Comptes à recevoir (analytique)', status: 'inactive', reason: 'Élément fourni comme analytique dans votre nomenclature.' },
        { id: 'matching', label: 'Lettrage', status: 'planned', reason: 'Édition générale à construire avec le lettrage des auxiliaires.' },
        { id: 'bank-reconciliation', label: 'Pointage et rapprochement bancaire', status: 'planned', reason: 'Édition générale à construire avec les fonctions de pointage.' },
        { id: 'fixed-assets', label: 'Immobilisations', status: 'planned', reason: 'Édition générale à construire avec le référentiel des immobilisations.' },
        { id: 'definitions-and-plans', label: 'Définitions et plans', status: 'planned', reason: 'Éditions en lecture seule à séparer des écrans de paramétrage.' }
      ]
    },
    {
      id: 'declarations', label: 'Déclarations périodiques', icon: '▦', defaultTab: 'vat-difference', tabs: [
        { id: 'vat-difference', label: 'Écarts entre TVA calculée et TVA facturée aux clients', status: 'planned', reason: 'État général à construire après validation des comptes et règles fiscales.' },
        { id: 'vat-payment', label: 'État de paiement TVA', status: 'planned', reason: 'État général à construire après validation des règles et périodes déclaratives.' },
        { id: 'vat-detail', label: 'État détaillé à joindre à l’état de paiement', status: 'planned', reason: 'Dépend de l’état TVA et de ses données justificatives.' },
        { id: 'aib-suppliers', label: 'État mensuel des retenues d’AIB sur les fournisseurs', status: 'planned', reason: 'État fiscal général à construire après validation des règles et comptes tiers.' },
        { id: 'aib-wholesale-sales', label: 'État mensuel des retenues AIB sur vente en gros', status: 'planned', reason: 'État fiscal général à construire après validation des règles et données de vente.' },
        { id: 'nominative-statement', label: 'État nominatif à joindre à la déclaration', status: 'planned', reason: 'Format et données sources à valider avant réalisation.' },
        { id: 'bic-advances', label: 'Acomptes BIC sur ventes détaillés par client', status: 'planned', reason: 'État fiscal général à construire après validation des règles et données clients.' },
        { id: 'dossier-specific', label: 'États spécifiques au dossier', status: 'review', reason: 'Contenu à préciser dossier par dossier ; reste inactif jusqu’à votre décision.' },
        { id: 'ohada-statements', label: 'Tableaux financiers OHADA révisé', status: 'planned', reason: 'États financiers généraux à construire à partir des comptes validés.' }
      ]
    },
    {
      id: 'fin-exercice', label: 'Opérations de fin d’exercice', icon: '◷', defaultTab: 'balance-checks', tabs: [
        { id: 'opening-transfer', label: 'Clôture des reports à nouveau', status: 'planned', reason: 'Traitement général à construire avec contrôle et possibilité de reprise.' },
        { id: 'balance-checks', label: 'Vérification des équilibres fondamentaux', status: 'planned', reason: 'Contrôles généraux à construire avant les traitements de clôture.' },
        { id: 'depreciation', label: 'Calcul automatique des amortissements au 31/12/N', status: 'planned', reason: 'Dépend du référentiel des immobilisations et des paramètres validés.' },
        { id: 'period-close', label: 'Clôture périodique au 31/12/N', status: 'partial', reason: 'La gestion réversible des périodes mensuelles est disponible ; la clôture annuelle complète reste à construire.', actions: [{ label: 'Ouvrir la gestion des périodes', route: 'periods' }] },
        { id: 'tax-adjustments', label: 'Déductions et réintégrations fiscales', status: 'planned', reason: 'Traitement fiscal à construire après validation des règles.' },
        { id: 'supplementary-expenses', label: 'Charges supplétives avant résultat intermédiaire', status: 'inactive', reason: 'Traitement de gestion/analytique, inactif dans la comptabilité générale.' },
        { id: 'calculate-result', label: 'Calcul du résultat et génération des états financiers', status: 'planned', reason: 'Traitement général à construire après les contrôles de clôture.' },
        { id: 'definitive-close', label: 'Arrêt définitif des comptes de l’exercice', status: 'planned', irreversible: true, reason: 'Sera irréversible. Une copie exportée du dossier et une confirmation explicite seront obligatoires.' },
        { id: 'next-year', label: 'Passage automatique à N+1', status: 'planned', reason: 'À construire après la clôture et le report des soldes.' }
      ]
    },
    {
      id: 'parametres', label: 'Paramètres', icon: '⚙', defaultTab: 'dossier-configuration', tabs: [
        { id: 'dossier-configuration', label: 'Configuration du dossier', status: 'partial', reason: 'La sauvegarde/restauration locale existe ; les paramètres comptables du dossier restent à construire.', actions: [{ label: 'Ouvrir les données et sauvegardes locales', route: 'settings' }] },
        { id: 'sections-accounts', label: 'Sections et comptes analytiques', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'allocation-keys', label: 'Clés de répartition des sections', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'general-account-natures', label: 'Natures des comptes généraux', status: 'planned', reason: 'Paramétrage général à construire.' },
        { id: 'analytic-natures', label: 'Natures analytiques', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'fixed-asset-accounts', label: 'Comptes associés aux immobilisations', status: 'planned', reason: 'Paramétrage général à construire avec les immobilisations.' },
        { id: 'orders-accounts', label: 'Compte de suivi des commandes et marchés accordés', status: 'inactive', reason: 'Dépend des fonctions d’achats/commandes, hors du périmètre actuel.' },
        { id: 'order-natures', label: 'Natures des commandes', status: 'inactive', reason: 'Dépend des fonctions d’achats/commandes, hors du périmètre actuel.' },
        { id: 'account-controls', label: 'Comptes lettrables, pointables, à payer, à recevoir', status: 'planned', reason: 'Paramétrage général à construire avec les auxiliaires et le rapprochement.' },
        { id: 'financial-framework', label: 'Cadre comptable et postes des tableaux financiers', status: 'planned', reason: 'Paramétrage général à construire avec les états financiers.' },
        { id: 'accounting-bridge', label: 'Tableau de passage entre comptabilités', status: 'inactive', reason: 'Relève de l’interopérabilité avec la comptabilité analytique ; à définir séparément.' },
        { id: 'print-information', label: 'Informations communes aux états imprimés', status: 'planned', reason: 'Paramétrage général à construire avec les éditions.' },
        { id: 'currencies', label: 'Devises', status: 'planned', reason: 'Paramétrage général à construire si la gestion multidevise est retenue.' },
        { id: 'confidential-accounts', label: 'Comptes confidentiels', status: 'review', reason: 'Droits et confidentialité à cadrer avant activation.' }
      ]
    },
    {
      id: 'outils', label: 'Outils', icon: '⌕', defaultTab: 'calculator', tabs: [
        { id: 'calculator', label: 'Calculatrice', status: 'inactive', reason: 'Utilitaire non comptable ; désactivé jusqu’à votre décision.' },
        { id: 'screenshot', label: 'Capture d’écran', status: 'inactive', reason: 'Utilitaire non comptable ; désactivé jusqu’à votre décision.' }
      ]
    }
  ];

  var statusLabels = {
    active: 'Disponible',
    partial: 'Partiellement disponible',
    planned: 'À construire · Comptabilité générale',
    inactive: 'Inactif',
    review: 'À confirmer · inactif',
    mixed: 'Accès partiel'
  };

  function getGroup(id) {
    return groups.find(function (group) { return group.id === id; }) || groups[0];
  }

  function getTab(groupId, tabId) {
    var group = getGroup(groupId);
    return group.tabs.find(function (tab) { return tab.id === tabId; }) || group.tabs[0];
  }

  function all() { return groups; }

  var api = { all: all, getGroup: getGroup, getTab: getTab, statusLabels: statusLabels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfectoAccountingNavigation = api;
}(typeof window !== 'undefined' ? window : globalThis));
