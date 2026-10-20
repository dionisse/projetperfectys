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
        { id: 'personnel', label: 'Personnel', status: 'partial', reason: 'Répertoire local du dossier : code PER automatique/modifiable, fiches du personnel modifiables et suppression protégée si une pièce comptable référence la personne. Les salaires, contrats et calculs restent dans le module Paie & RH ; aucun calcul ni écriture n’est généré ici.' },
        { id: 'other-debtors-creditors', label: 'Débiteurs et créditeurs divers', status: 'partial', reason: 'Répertoire local par dossier des tiers débiteurs et créditeurs de la famille 47 : codes DEB/CRE automatiques et modifiables, fiches éditables et suppression protégée si une pièce comptable les référence. Les mouvements et règlements restent à construire ; les centralisations sont réservées aux modules PERFECTO internes.' },
        { id: 'responsibility-centers', label: 'Centres d’analyse (analytique)', status: 'partial', reason: 'Référentiel de centres librement définis et réservés à la comptabilité analytique. Les imputations, mouvements et états analytiques restent séparés et inactifs dans ce parcours.' },
        { id: 'activity-domains', label: 'Domaines d’activité (analytique)', status: 'inactive', reason: 'Relève de la comptabilité analytique, module séparé.' },
        { id: 'services', label: 'Prestations', status: 'partial', reason: 'Référentiel local des prestations par dossier (code, désignation, description et état). Aucune facture, TVA, tarification ou écriture n’est générée ; le lien au module Ventes, stock & facturation reste à construire.' },
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
        { id: 'fixed-asset-locations', label: 'Localisation des immobilisations corporelles', status: 'partial', reason: 'Référentiel hiérarchique par dossier : codes, niveaux et désignations modifiables, rattachement parent/enfant, adresse et responsable. Les lieux peuvent être affectés aux fiches du registre Éléments immobilisés ; mouvements et écritures restent à construire.' },
        { id: 'fixed-assets', label: 'Éléments immobilisés', status: 'partial', reason: 'Registre local des actifs par dossier : identification, localisation, comptes de classe 2/28/68, acquisition, valeur résiduelle et paramètres d’amortissement. Un aperçu linéaire indicatif et non comptabilisant est disponible si une convention est choisie explicitement ; méthodes dégressive/unités d’œuvre, écritures, cessions et règles validées restent à construire.' },
        { id: 'journals', label: 'Journaux', status: 'active', reason: 'Créer et paramétrer des journaux libres ; les journaux automatiques restent réservés au système.', actions: [{ label: 'Ouvrir les journaux comptables', route: 'journals' }] }
      ]
    },
    {
      id: 'saisie', label: 'Saisie', icon: '＋', defaultTab: 'journal-entry', tabs: [
        { id: 'journal-entry', label: 'Saisie dans les journaux', status: 'active', reason: 'Choisissez un journal actif dans la liste ; un double-clic ouvre la saisie d’une nouvelle pièce. Les journaux système, retirés ou inactifs restent consultables mais ne sont pas saisissables.' },
        { id: 'live-cash', label: 'Opérations de caisse en temps réel', status: 'partial', reason: 'Saisie rapide équilibrée au journal Caisse (CA), calcul immédiat des soldes des comptes de caisse 57 et liste des mouvements validés ou en brouillon. Les données restent locales à ce navigateur : aucune synchronisation multi-utilisateur ou serveur ; les transferts entre caisses passent par la saisie générale.' },
        {
          id: 'account-movements', label: 'Mouvements des comptes généraux, tiers et analytiques', status: 'mixed', reason: 'Choisissez un élément ci-dessous. Les synthèses générales et comptes tiers sont disponibles en lecture ; les lignes des tiers restent agrégées au compte collectif faute d’identifiant individuel dans les pièces. La comptabilité analytique demeure inactive et grisée.',
          children: [
            { id: 'general-movements', label: 'Comptes généraux et auxiliaires', status: 'partial', reason: 'Arborescence du plan et synthèse mensuelle des écritures validées du dossier. Les mouvements individuels auxiliaires ne sont pas encore enregistrés dans les pièces.' },
            { id: 'third-party-movements', label: 'Comptes tiers', status: 'partial', reason: 'Consultation des fournisseurs, clients, personnels et débiteurs/créditeurs divers. Les montants affichés sont ceux du compte collectif agrégé, jamais un solde individuel de tiers.' },
            { id: 'analytic-movements', label: 'Comptes analytiques', status: 'inactive', reason: 'La comptabilité analytique reste un module séparé et inactif dans ce parcours.' }
          ]
        },
        { id: 'scheduled-payments', label: 'Programmation des règlements à effectuer (analytique)', status: 'inactive', reason: 'Fonction explicitement analytique.' },
        { id: 'invoice-payment-allocation', label: 'Affectation des règlements aux factures émises (analytique)', status: 'inactive', reason: 'Fonction explicitement analytique et liée à la facturation.' },
        { id: 'matching', label: 'Lettrage', status: 'partial', reason: 'Lettrage manuel de lignes validées et équilibrées sur un même compte auxiliaire de classe 4. Le suivi est séparé des écritures et du grand livre ; aucun client ou fournisseur individuel n’est attribué faute d’identifiant auxiliaire dans les pièces.' },
        { id: 'reconciliation', label: 'Pointage', status: 'partial', reason: 'Import et lecture de relevés génériques CSV/Excel, choix des colonnes, aperçu et suggestions de correspondance avec les lignes validées de trésorerie. Chaque rapprochement exige une confirmation ; aucune écriture n’est créée ni modifiée. Le fichier reste dans le stockage local de démonstration du navigateur ; aucune intégration Google Drive organisationnelle n’est connectée dans PERFECTO.' },
        { id: 'supplier-orders', label: 'Commandes aux fournisseurs (analytique)', status: 'inactive', reason: 'Relève des achats et/ou de la comptabilité analytique, hors du périmètre actuel.' },
        { id: 'forecast-budgets', label: 'Budgets prévisionnels', status: 'review', reason: 'Périmètre à préciser ; reste inactif jusqu’à votre décision.' },
        { id: 'opening-balances', label: 'Reports à nouveau', status: 'partial', reason: 'Registre de reports distinct des écritures : lecture contrôlée d’un dossier précédent, insertion, modification, suppression, impression et audit sans correction automatique. Le transfert est relançable et préserve les lettrages/pointages courants ; les factures et l’analytique restent à contrôler séparément.' }
      ]
    },
    {
      id: 'editions', label: 'Éditions', icon: '▤', defaultTab: 'journals', tabs: [
        {
          id: 'journals', label: 'Journaux', status: 'partial', reason: 'Choisissez un état ou un contrôle. Les dix sous-éléments sont organisés en trois groupes ; la présentation et les paramètres de chaque état seront affinés à partir de vos captures.',
          children: [
            { id: 'journal-lines', label: 'Détail des lignes saisies', section: 'pieces', status: 'partial', reason: 'Vue existante des écritures validées, filtrable par journal et exercice. La présentation définitive sera ajustée à partir de votre capture.' },
            { id: 'journal-modified-pieces', label: 'Pièces modifiées après première saisie', section: 'pieces', status: 'planned', reason: 'Le prototype ne conserve pas encore l’historique des modifications de saisie ; les critères et le rendu restent à préciser à partir de votre capture.' },
            { id: 'journal-unbalanced-pieces', label: 'Pièces déséquilibrées', section: 'pieces', status: 'partial', reason: 'Première vue en lecture seule : liste les pièces du cycle dont les débits diffèrent des crédits. Les colonnes et critères finaux seront ajustés à partir de votre capture.' },
            { id: 'journal-entry-totals', label: 'Cumul des pièces saisies', section: 'cumuls', status: 'planned', reason: 'Les regroupements, filtres de période et colonnes du cumul seront définis à partir de votre capture.' },
            { id: 'journal-individual-account-totals', label: 'Cumul par comptes individuels', section: 'cumuls', status: 'planned', reason: 'État à mettre en forme sans confondre le cumul individuel avec les comptes de synthèse ; paramètres à confirmer par capture.' },
            { id: 'journal-summary-account-totals', label: 'Cumul par comptes de synthèse', section: 'cumuls', status: 'planned', reason: 'Les règles de regroupement des comptes de synthèse et les colonnes sont à préciser par capture.' },
            { id: 'journal-third-party-totals', label: 'Cumul par tiers', section: 'cumuls', status: 'planned', reason: 'Les pièces de démonstration ne portent pas encore d’identifiant individuel de tiers ; l’état attend vos captures et un modèle de données confirmé.' },
            { id: 'journal-analytic-center-totals', label: 'Cumul par centres analytiques', section: 'cumuls', status: 'inactive', reason: 'La comptabilité analytique reste un module séparé et inactive dans le parcours général.' },
            { id: 'journal-currency-totals', label: 'Cumul par devises', section: 'cumuls', status: 'planned', reason: 'Le modèle général ne gère pas encore les devises ni les conversions ; aucun taux ou montant n’est inventé.' },
            { id: 'journal-allocation-sheet', label: 'Fiche d’imputation', section: 'imputation', status: 'planned', reason: 'Le rôle de la fiche, son paramétrage et son rendu seront définis à partir de vos captures.' }
          ]
        },
        {
          id: 'general-accounts', label: 'Comptes généraux', status: 'mixed', reason: 'Balances générale et grand livre ouvrent les vues existantes. Les autres éditions restent à préciser à partir de vos captures ; les états analytiques sont désactivés dans ce parcours.',
          children: [
            { id: 'general-balance', label: 'Balance générale des comptes', section: 'balances', status: 'partial', reason: 'Ouvre la balance générale existante, calculée à partir des pièces validées du cycle. Sa présentation définitive sera ajustée après votre capture.' },
            { id: 'general-summary-balance', label: 'Balance de synthèse', section: 'balances', status: 'planned', reason: 'Niveau de regroupement, colonnes et paramètres à confirmer par capture ; aucun regroupement de comptes n’est présumé.' },
            { id: 'general-aged-balance', label: 'Balance âgée', section: 'balances', status: 'planned', reason: 'Le prototype ne possède pas de registre de factures et d’échéances soldées ; les critères d’ancienneté et le rendu attendent votre capture.' },
            { id: 'general-opening-balance', label: 'Balance d’ouverture', section: 'balances', status: 'planned', reason: 'Le registre Reports à nouveau existe séparément ; le format d’édition et ses filtres seront définis à partir de votre capture.' },
            { id: 'general-account-situation', label: 'Situation des comptes', section: 'balances', status: 'planned', reason: 'Les colonnes, période de référence et présentation de la situation restent à préciser par capture.' },
            { id: 'general-ledger', label: 'Grand livre des comptes', section: 'ledgers', status: 'partial', reason: 'Ouvre le grand livre existant par compte, à partir des écritures validées. La présentation définitive sera ajustée après votre capture.' },
            { id: 'general-multiyear-history', label: 'Historique des comptes sur plusieurs exercices', section: 'ledgers', status: 'planned', reason: 'Les exercices sont isolés dans des dossiers distincts ; la sélection et la comparaison pluriannuelles attendent une source et des règles confirmées.' },
            { id: 'general-opening-journal', label: 'Journal des reports', section: 'ledgers', status: 'planned', reason: 'Les reports sont conservés dans un registre séparé des journaux ; cette édition attend votre capture et sa définition exacte.' },
            { id: 'general-analytic-balance', label: 'Balance détaillée analytiquement', section: 'analysis', status: 'inactive', reason: 'La comptabilité analytique reste un module séparé et inactive dans le parcours général.' },
            { id: 'general-counterpart-detail', label: 'Détail des contreparties d’un compte', section: 'analysis', status: 'planned', reason: 'Le critère de contrepartie et le traitement des pièces multiligne seront définis à partir de votre capture.' },
            { id: 'general-counterpart-total', label: 'Cumul des contreparties d’un compte', section: 'analysis', status: 'planned', reason: 'Les règles de cumul des contreparties et leur présentation restent à confirmer par capture.' }
          ]
        },
        {
          id: 'third-parties', label: 'Tiers', status: 'planned', reason: 'Les éditions sont structurées ci-dessous, mais les mouvements des pièces ne sont pas encore attribués aux fiches individuelles ; les paramètres et le rendu attendent vos captures.',
          children: [
            { id: 'third-party-balance', label: 'Balance des tiers', section: 'balances', status: 'planned', reason: 'Aucun solde individuel ne sera calculé avant que les pièces portent l’identifiant du tiers.' },
            { id: 'third-party-opening-balance', label: 'Balance d’ouverture', section: 'balances', status: 'planned', reason: 'Le registre Reports à nouveau ne contient pas encore une balance auxiliaire individualisée ; format à définir après capture.' },
            { id: 'third-party-situation', label: 'Situation des comptes', section: 'balances', status: 'planned', reason: 'La période, les colonnes et le niveau de détail seront définis à partir de votre capture.' },
            { id: 'third-party-nature-breakdown', label: 'Décomposition des soldes par nature (clients/fournisseurs)', section: 'balances', status: 'planned', reason: 'Les comptes collectifs existants sont consultables ; la décomposition auxiliaire clients/fournisseurs attend des mouvements identifiés par tiers.' },
            { id: 'third-party-ledger', label: 'Grand livre', section: 'ledgers', status: 'planned', reason: 'Le grand livre par tiers attend des écritures portant un identifiant individuel ; aucun mouvement collectif ne sera attribué à une fiche.' },
            { id: 'third-party-statement', label: 'Relevé de compte des tiers', section: 'ledgers', status: 'planned', reason: 'La sélection du tiers, les dates et les colonnes du relevé attendent votre capture et des mouvements individualisés.' },
            { id: 'third-party-balance-justification', label: 'Justification de solde', section: 'controls', status: 'planned', reason: 'Les règles de rapprochement avec factures, règlements et pièces justificatives seront définies à partir de votre capture.' }
          ]
        },
        {
          id: 'foreign-currency', label: 'Comptes en devises', status: 'planned', reason: 'Les cinq états sont référencés ci-dessous. Le modèle ne gère pas encore les montants en devises, taux ni écarts de conversion ; aucun calcul n’est simulé.',
          children: [
            { id: 'currency-balance', label: 'Balance', section: 'balances', status: 'planned', reason: 'La devise, les montants d’origine et la présentation de la balance seront définis à partir de vos captures.' },
            { id: 'currency-opening-balance', label: 'Balance d’ouverture', section: 'balances', status: 'planned', reason: 'Les soldes d’ouverture en devises ne sont pas portés par le registre actuel ; aucun montant converti n’est inventé.' },
            { id: 'currency-situation', label: 'Situation des comptes', section: 'balances', status: 'planned', reason: 'La situation attend les paramètres de devise, période et valorisation à confirmer par capture.' },
            { id: 'currency-ledger', label: 'Grand livre', section: 'ledgers', status: 'planned', reason: 'Les pièces ne conservent pas de montants en devise distincts des montants comptabilisés en XOF.' },
            { id: 'currency-exchange-differences', label: 'Écarts de change', section: 'exchange', status: 'planned', reason: 'Aucun taux de change ni historique de conversion n’est disponible ; les règles et le rendu seront définis après capture.' }
          ]
        },
        {
          id: 'analytic-statements', label: 'États analytiques', status: 'inactive', reason: 'Les éléments ci-dessous conservent la nomenclature demandée, mais restent tous désactivés dans la comptabilité générale : l’analytique demeure un module séparé.',
          children: [
            { id: 'analytic-center-balance', label: 'Balance des centres', section: 'balances', status: 'inactive', reason: 'État réservé au module distinct de comptabilité analytique.' },
            { id: 'analytic-other-nature-balance', label: 'Balance détaillée par une autre nature', section: 'balances', status: 'inactive', reason: 'Autre nature analytique à définir dans le module séparé.' },
            { id: 'analytic-ledger', label: 'Grand livre', section: 'ledgers', status: 'inactive', reason: 'État réservé au module distinct de comptabilité analytique.' },
            { id: 'analytic-other-nature-ledger', label: 'Grand livre détaillé par une autre nature', section: 'ledgers', status: 'inactive', reason: 'Autre nature analytique à définir dans le module séparé.' },
            { id: 'analytic-center-situation', label: 'Situation des centres', section: 'situations', status: 'inactive', reason: 'État réservé au module distinct de comptabilité analytique.' },
            { id: 'analytic-other-nature-situation', label: 'Situation détaillée par une autre nature', section: 'situations', status: 'inactive', reason: 'Autre nature analytique à définir dans le module séparé.' },
            { id: 'analytic-general-account-balance', label: 'Balance détaillée par comptes généraux', section: 'balances', status: 'inactive', reason: 'Aucune imputation analytique n’est créée ou calculée dans ce parcours général.' }
          ]
        },
        { id: 'supplier-orders', label: 'Commandes aux fournisseurs (analytique)', status: 'inactive', reason: 'Fonction analytique / achats hors du périmètre actuel.' },
        {
          id: 'budget', label: 'Budget', status: 'planned', reason: 'Les dix états demandés sont organisés par budgets, commandes/engagements, réalisations et disponibilités. Le prototype ne possède pas encore de registre budgétaire ; règles et affichages attendent vos captures.',
          children: [
            { id: 'budget-entered', label: 'Budgets saisis', section: 'budgets', status: 'planned', reason: 'Aucun budget n’est enregistré ; l’exercice, la période, les axes et les colonnes seront définis à partir de votre capture.' },
            { id: 'budget-orders-followup', label: 'Suivi par commandes', section: 'commitments', status: 'planned', reason: 'Aucune commande fournisseur ni engagement budgétaire n’est enregistré dans ce parcours.' },
            { id: 'budget-orders-by-line', label: 'Détail des commandes sur chaque ligne budgétaire', section: 'commitments', status: 'planned', reason: 'Le rattachement commande-ligne budgétaire et son détail attendent vos captures et un modèle de données confirmé.' },
            { id: 'budget-orders-outside', label: 'Détail des commandes hors budget', section: 'commitments', status: 'planned', reason: 'La définition d’une commande hors budget et son contrôle seront confirmés à partir de votre capture.' },
            { id: 'budget-realizations-followup', label: 'Suivi des réalisations', section: 'realisations', status: 'planned', reason: 'Aucune réalisation n’est rapprochée d’un budget dans le prototype ; aucun taux d’exécution n’est simulé.' },
            { id: 'budget-realizations-by-line', label: 'Détail des réalisations de chaque ligne budgétaire', section: 'realisations', status: 'planned', reason: 'Le lien entre pièce comptable, ligne budgétaire et règle d’imputation attend vos captures.' },
            { id: 'budget-outside-realizations-total', label: 'Cumul des réalisations hors budget', section: 'realisations', status: 'planned', reason: 'La règle de classement et de cumul des réalisations hors budget reste à confirmer.' },
            { id: 'budget-outside-realizations-detail', label: 'Détail des réalisations hors budget', section: 'realisations', status: 'planned', reason: 'La sélection, les justificatifs et le niveau de détail attendent votre capture.' },
            { id: 'budget-available-balance', label: 'Reste disponible sur engagements et réalisations', section: 'availability', status: 'planned', reason: 'Aucun calcul de disponible n’est effectué sans budgets, engagements et réalisations rapprochés.' },
            { id: 'budget-available-not-committed', label: 'Reste disponible sur engagements et réalisations non engagées', section: 'availability', status: 'planned', reason: 'La distinction entre engagé et non engagé, ainsi que le calcul du reste, attendent vos règles et captures.' }
          ]
        },
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
        { id: 'opening-transfer', label: 'Passage à N+1 · reports à nouveau', status: 'partial', reason: 'Le registre, son contrôle et le transfert relançable sont accessibles dans Saisie → Reports à nouveau. Cette action ne clôture pas définitivement l’exercice et ne valide aucune écriture.', actions: [{ label: 'Ouvrir les reports à nouveau', route: 'menu', group: 'saisie', tab: 'opening-balances' }] },
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
