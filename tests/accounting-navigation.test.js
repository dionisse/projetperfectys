/* Vérifie la hiérarchie des menus et le statut d’activation par défaut. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const configurationCss = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'accounting-configuration.css'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const menuRendererStart = appSource.indexOf('function viewAccountingMenu(params) {');
const menuRendererEnd = appSource.indexOf('function bindEntryJournalSelector()', menuRendererStart);
const menuRenderer = appSource.slice(menuRendererStart, menuRendererEnd);

const groups = nav.all();
assert.deepEqual(groups.map(group => group.id), [
  'fichier', 'definitions', 'saisie', 'editions', 'declarations', 'fin-exercice', 'parametres', 'outils'
]);
assert.deepEqual(groups.map(group => group.label), [
  'Fichier', 'Définitions', 'Saisie', 'Éditions', 'Déclarations périodiques',
  'Opérations de fin d’exercice', 'Paramètres', 'Outils'
]);

const labels = groups.flatMap(group => group.tabs.flatMap(tab => [
  tab.label,
  ...(tab.children || []).map(child => child.label)
]));
[
  'Importation d’une balance générale',
  'Centralisation auxiliaire',
  'FEC externe ou d’une autre organisation',
  'Mouvements auxiliaires des modules PERFECTO',
  'Centralisation des salaires depuis Paie et RH',
  'Centralisation des opérations depuis Vente, Stock et Facturation',
  'Annulation d’une centralisation',
  'Recalcul du solde des comptes',
  'Réparation complète de la base',
  'Consolidation avant résultat',
  'Consolidation après résultat',
  'Comptes généraux',
  'Fournisseurs',
  'Clients',
  'Prestations',
  'Personnel',
  'Localisation des immobilisations corporelles',
  'Éléments immobilisés',
  'Frais sur véhicules',
  'Bénéficiaires de frais de mission',
  'Natures des flux de trésorerie',
  'Saisie dans les journaux',
  'Opérations de caisse en temps réel',
  'Mouvements des comptes généraux, tiers et analytiques',
  'Comptes généraux et auxiliaires',
  'Comptes tiers',
  'Lettrage',
  'Pointage',
  'Centres d’analyse (analytique)',
  'Reports à nouveau',
  'Journaux',
  'Détail des lignes saisies',
  'Pièces modifiées après première saisie',
  'Pièces déséquilibrées',
  'Écritures lettrées',
  'Anomalies sur les lettrages',
  'Écritures non lettrées',
  'Écritures pointées',
  'Écritures non pointées',
  'Justification des soldes par pointage',
  'Relevé de banque',
  'Rapprochement bancaire',
  'Tableau des immobilisations',
  'Tableau des amortissements',
  'Virements internes',
  'Entrées de la période',
  'Sorties de la période',
  'Immobilisations par localisations pour inventaire',
  'Fiches d’inventaire',
  'Cumul par comptes',
  'Grand-livre des éléments',
  'Écarts à l’ouverture avec la comptabilité générale',
  'Écarts de la période avec la comptabilité générale',
  'Écarts sur les entrées',
  'Écarts sur les sorties',
  'Autres anomalies sur les immobilisations',
  'Immobilisations par Centres de responsabilité',
  'Immobilisations par Domaines d’activités',
  'Immobilisations par Sources de financement',
  'Cadre comptable',
  'Comptes associés aux immobilisations',
  'Compte de suivi des commandes et marchés accordés',
  'Natures des commandes',
  'Comptes lettrables, pointables, à payer, à recevoir',
  'Postes du bilan',
  'Plan comptable',
  'Postes associés aux comptes',
  'Tiers',
  'Plan des journaux',
  'Plan analytiques',
  'Cumul des pièces saisies',
  'Cumul par comptes individuels',
  'Cumul par comptes de synthèse',
  'Cumul par tiers',
  'Cumul par centres analytiques',
  'Cumul par devises',
  'Fiche d’imputation',
  'Balance générale des comptes',
  'Balance de synthèse',
  'Balance âgée',
  'Grand livre des comptes',
  'Historique des comptes sur plusieurs exercices',
  'Journal des reports',
  'Balance d’ouverture',
  'Situation des comptes',
  'Balance détaillée analytiquement',
  'Détail des contreparties d’un compte',
  'Cumul des contreparties d’un compte',
  'Balance des tiers',
  'Grand livre',
  'Décomposition des soldes par nature (clients/fournisseurs)',
  'Relevé de compte des tiers',
  'Justification de solde',
  'Balance',
  'Écarts de change',
  'Balance des centres',
  'Balance détaillée par une autre nature',
  'Grand livre détaillé par une autre nature',
  'Situation des centres',
  'Situation détaillée par une autre nature',
  'Balance détaillée par comptes généraux',
  'Budgets saisis',
  'Suivi par commandes',
  'Détail des commandes sur chaque ligne budgétaire',
  'Détail des commandes hors budget',
  'Suivi des réalisations',
  'Détail des réalisations de chaque ligne budgétaire',
  'Cumul des réalisations hors budget',
  'Détail des réalisations hors budget',
  'Reste disponible sur engagements et réalisations',
  'Reste disponible sur engagements et réalisations non engagées',
  'Comptes en devises',
  'États analytiques',
  'Comptes à payer (analytique)',
  'Tableaux financiers OHADA révisé',
  'Arrêt définitif des comptes de l’exercice',
  'Calculatrice',
  'Capture d’écran'
].forEach(label => assert(labels.includes(label), `Élément de menu manquant : ${label}`));

const findTab = (groupId, tabId) => nav.getTab(groupId, tabId);
assert.equal(findTab('definitions', 'general-accounts').status, 'active');
assert.equal(findTab('definitions', 'suppliers').status, 'partial');
assert.ok(findTab('definitions', 'suppliers').reason.includes('archivage'));
assert.ok(findTab('definitions', 'suppliers').reason.includes('centralisation'));
assert.equal(findTab('definitions', 'clients').status, 'partial');
assert.ok(findTab('definitions', 'clients').reason.includes('CLI'));
assert.ok(findTab('definitions', 'clients').reason.includes('dossiers clients du cabinet'));
assert.equal(findTab('definitions', 'services').status, 'partial');
assert.ok(findTab('definitions', 'services').reason.includes('Référentiel local'));
assert.ok(findTab('definitions', 'services').reason.includes('facturation'));
assert.equal(findTab('definitions', 'other-debtors-creditors').status, 'partial');
assert.ok(findTab('definitions', 'other-debtors-creditors').reason.includes('DEB/CRE'));
assert.equal(findTab('definitions', 'personnel').status, 'partial');
assert.ok(findTab('definitions', 'personnel').reason.includes('PER'));
assert.equal(findTab('definitions', 'fixed-asset-locations').status, 'partial');
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('hiérarchique'));
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('parent/enfant'));
assert.ok(findTab('definitions', 'fixed-asset-locations').reason.includes('affectés aux fiches'));
assert.equal(findTab('definitions', 'fixed-assets').status, 'partial');
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('classe 2/28/68'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('non comptabilisant'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('choisie explicitement'));
assert.ok(findTab('definitions', 'fixed-assets').reason.includes('restent à construire'));
assert.equal(findTab('definitions', 'journals').status, 'active');
assert.ok(findTab('definitions', 'journals').reason.includes('journaux libres'));
assert.ok(findTab('definitions', 'journals').reason.includes('réservés au système'));
assert.equal(findTab('saisie', 'journal-entry').status, 'active');
assert.ok(findTab('saisie', 'journal-entry').reason.includes('double-clic'));
assert.equal(findTab('saisie', 'journal-entry').actions, undefined, 'le tableau de sélection des journaux est directement intégré au sous-menu');
assert.equal(findTab('saisie', 'live-cash').status, 'partial');
assert.ok(findTab('saisie', 'live-cash').reason.includes('journal Caisse (CA)'));
assert.ok(findTab('saisie', 'live-cash').reason.includes('synchronisation multi-utilisateur'));
const accountMovementsTab = findTab('saisie', 'account-movements');
assert.equal(accountMovementsTab.status, 'mixed');
assert.ok(accountMovementsTab.reason.includes('identifiant'));
assert.equal(accountMovementsTab.children[0].label, 'Comptes généraux et auxiliaires');
assert.equal(accountMovementsTab.children[0].status, 'partial');
assert.ok(accountMovementsTab.children[0].reason.includes('mouvements individuels'));
assert.equal(accountMovementsTab.children[1].id, 'third-party-movements');
assert.equal(accountMovementsTab.children[1].label, 'Comptes tiers');
assert.equal(accountMovementsTab.children[1].status, 'partial');
assert.ok(accountMovementsTab.children[1].reason.includes('agrégé'));
assert.equal(accountMovementsTab.children[2].id, 'analytic-movements');
assert.equal(accountMovementsTab.children[2].status, 'inactive');
assert.ok(accountMovementsTab.reason.includes('grisée'));
assert.equal(findTab('saisie', 'matching').status, 'partial');
assert.ok(findTab('saisie', 'matching').reason.includes('équilibrées'));
assert.equal(findTab('saisie', 'reconciliation').status, 'partial');
assert.ok(findTab('saisie', 'reconciliation').reason.includes('relevés génériques CSV/Excel'));
assert.ok(findTab('saisie', 'reconciliation').reason.includes('confirmation'));
assert.ok(findTab('saisie', 'reconciliation').reason.includes('aucune intégration Google Drive organisationnelle n’est connectée dans PERFECTO'));
const analyticalCenters = findTab('definitions', 'responsibility-centers');
assert.equal(analyticalCenters.status, 'partial');
assert.ok(analyticalCenters.reason.includes('réservés à la comptabilité analytique'));
assert.ok(analyticalCenters.reason.includes('inactifs'));
assert.equal(findTab('fichier', 'export-other').status, 'partial');
assert.equal(findTab('fichier', 'import-other').status, 'partial');
assert.equal(findTab('fichier', 'import-fec').status, 'partial');
assert.ok(findTab('fichier', 'import-fec').reason.includes('arrêté béninois'));
assert.ok(findTab('fichier', 'import-fec').reason.includes('Aucun connecteur direct'));
assert.equal(findTab('fichier', 'import-balance').status, 'partial');
assert.ok(findTab('fichier', 'import-balance').reason.includes('PERFECTO-BALANCE v1'));
assert.equal(findTab('fichier', 'centralize-auxiliary').label, 'Centralisation auxiliaire');
assert.equal(findTab('fichier', 'centralize-auxiliary').status, 'mixed');
assert.ok(findTab('fichier', 'centralize-auxiliary').reason.includes('FEC'));
assert.equal(findTab('fichier', 'centralize-auxiliary').children.find(child => child.id === 'centralize-auxiliary-fec').status, 'partial');
const internalAuxiliaryCentralization = findTab('fichier', 'centralize-auxiliary').children.find(child => child.id === 'centralize-auxiliary-perfecto');
assert.equal(internalAuxiliaryCentralization.status, 'planned');
assert.ok(internalAuxiliaryCentralization.reason.includes('opérations comptables réelles'));
assert.ok(internalAuxiliaryCentralization.reason.includes('compte collectif'));
assert.ok(internalAuxiliaryCentralization.reason.includes('non analytique'));
assert.ok(internalAuxiliaryCentralization.reason.includes('aucune ligne ni aucun montant de démonstration'));
assert.match(appSource, /function viewInternalAuxiliaryCentralization\(\)[\s\S]*Regrouper les opérations comptables effectivement enregistrées dans les comptes auxiliaires[\s\S]*reporter ces totaux au grand livre[\s\S]*aucun mouvement, montant ou compte n’est fabriqué/i);
assert.equal(findTab('fichier', 'centralize-payroll').status, 'active');
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('Comptabilité générale'));
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('grand livre général'));
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('Aucune imputation ni écriture analytique'));
assert.equal(findTab('fichier', 'centralize-sales').status, 'active');
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('Comptabilité générale'));
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('grand livre général'));
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('Aucune imputation ni écriture analytique'));
assert.equal(findTab('fichier', 'cancel-centralization').status, 'partial');
assert.ok(findTab('fichier', 'cancel-centralization').reason.includes('écriture inverse'));
assert.ok(findTab('fichier', 'cancel-centralization').reason.includes('sources tierces'));
assert.equal(findTab('fichier', 'recalculate-balances').status, 'partial');
assert.ok(findTab('fichier', 'recalculate-balances').reason.includes('aucun solde ni aucune écriture n’est modifié'));
assert.equal(findTab('fichier', 'repair-database').status, 'partial');
assert.ok(findTab('fichier', 'repair-database').reason.includes('jamais automatisée'));
assert.equal(findTab('fichier', 'consolidate-before-result').status, 'partial');
assert.ok(findTab('fichier', 'consolidate-before-result').reason.includes('provenance de chaque ligne source'));
assert.ok(findTab('fichier', 'consolidate-before-result').reason.includes('aucun mouvement n’est ajouté au grand livre'));
assert.equal(findTab('fichier', 'consolidate-after-result').status, 'partial');
assert.ok(findTab('fichier', 'consolidate-after-result').reason.includes('provenance de chaque ligne source'));
assert.ok(findTab('fichier', 'consolidate-after-result').reason.includes('ne sont ni calculés ni comptabilisés'));
assert.equal(findTab('editions', 'journals').status, 'partial');
assert.deepEqual(findTab('editions', 'journals').children.map(child => child.label), [
  'Détail des lignes saisies',
  'Pièces modifiées après première saisie',
  'Pièces déséquilibrées',
  'Cumul des pièces saisies',
  'Cumul par comptes individuels',
  'Cumul par comptes de synthèse',
  'Cumul par tiers',
  'Cumul par centres analytiques',
  'Cumul par devises',
  'Fiche d’imputation'
]);
assert.equal(findTab('editions', 'journals').children[0].status, 'partial');
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-unbalanced-pieces').status, 'partial');
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').status, 'inactive');
assert.equal(findTab('editions', 'matching').status, 'planned');
assert.deepEqual(findTab('editions', 'matching').children.map(child => child.label), [
  'Écritures lettrées', 'Anomalies sur les lettrages', 'Écritures non lettrées'
]);
assert.ok(findTab('editions', 'matching').children.every(child => child.status === 'planned'));
assert.ok(findTab('editions', 'matching').children.find(child => child.id === 'edition-matching-anomalies').reason.includes('aucun lettrage n’est qualifié'));
assert.equal(findTab('saisie', 'matching').children, undefined, 'le lettrage opérationnel reste séparé des éditions');
assert.equal(findTab('editions', 'bank-reconciliation').status, 'planned');
assert.deepEqual(findTab('editions', 'bank-reconciliation').children.map(child => child.label), [
  'Écritures pointées', 'Écritures non pointées', 'Justification des soldes par pointage',
  'Relevé de banque', 'Rapprochement bancaire'
]);
assert.deepEqual(findTab('editions', 'bank-reconciliation').children.map(child => child.section), [
  'pointing', 'pointing', 'pointing', 'bankReconciliation', 'bankReconciliation'
]);
assert.ok(findTab('editions', 'bank-reconciliation').children.every(child => child.status === 'planned'));
assert.equal(findTab('editions', 'fixed-assets').status, 'planned');
assert.deepEqual(findTab('editions', 'fixed-assets').children.map(child => child.label), [
  'Tableau des immobilisations', 'Tableau des amortissements',
  'Virements internes', 'Entrées de la période', 'Sorties de la période',
  'Immobilisations par localisations pour inventaire', 'Fiches d’inventaire',
  'Cumul par comptes', 'Grand-livre des éléments',
  'Écarts à l’ouverture avec la comptabilité générale', 'Écarts de la période avec la comptabilité générale',
  'Écarts sur les entrées', 'Écarts sur les sorties', 'Autres anomalies sur les immobilisations',
  'Immobilisations par Centres de responsabilité', 'Immobilisations par Domaines d’activités',
  'Immobilisations par Sources de financement'
]);
assert.deepEqual(findTab('editions', 'fixed-assets').children.map(child => child.section), [
  'assetSummary', 'assetSummary',
  'assetMovements', 'assetMovements', 'assetMovements',
  'assetInventory', 'assetInventory',
  'assetAccounts', 'assetAccounts',
  'assetDiscrepancies', 'assetDiscrepancies', 'assetDiscrepancies', 'assetDiscrepancies', 'assetDiscrepancies',
  'assetDimensions', 'assetDimensions', 'assetDimensions'
]);
assert.ok(findTab('editions', 'fixed-assets').children.slice(0, 14).every(child => child.status === 'planned'));
assert.ok(findTab('editions', 'fixed-assets').children.slice(14).every(child => child.status === 'inactive'));
assert.equal(findTab('editions', 'definitions-and-plans').status, 'planned');
assert.deepEqual(findTab('editions', 'definitions-and-plans').children.map(child => child.label), [
  'Cadre comptable', 'Postes du bilan', 'Plan comptable', 'Postes associés aux comptes',
  'Tiers', 'Plan des journaux', 'Plan analytiques'
]);
assert.deepEqual(findTab('editions', 'definitions-and-plans').children.map(child => child.section), [
  'definitionsFramework', 'definitionsFramework', 'definitionsAccounts', 'definitionsAccounts',
  'definitionsThirdParties', 'definitionsJournals', 'definitionsAnalytics'
]);
assert.ok(findTab('editions', 'definitions-and-plans').children.slice(0, 6).every(child => child.status === 'planned'));
assert.equal(findTab('editions', 'definitions-and-plans').children[6].status, 'inactive');
assert.ok(findTab('editions', 'definitions-and-plans').children.find(child => child.id === 'edition-chart-of-accounts').reason.includes('maintenance'));
assert.ok(findTab('editions', 'definitions-and-plans').children.find(child => child.id === 'edition-third-parties').reason.includes('maintenance'));
assert.ok(findTab('editions', 'definitions-and-plans').children.find(child => child.id === 'edition-journal-plan').reason.includes('maintenance'));
assert.match(appSource, /matching: \{ title: 'États du lettrage'/);
assert.match(appSource, /pointing: \{ title: 'Écritures et justifications par pointage'/);
assert.match(appSource, /bankReconciliation: \{ title: 'Relevés et rapprochement bancaire'/);
assert.match(appSource, /assetDiscrepancies: \{ title: 'Écarts et anomalies'/);
assert.match(appSource, /assetDimensions: \{ title: 'Ventilations désactivées'/);
assert.match(appSource, /definitionsFramework: \{ title: 'Cadre comptable et postes du bilan'/);
assert.match(appSource, /definitionsAnalytics: \{ title: 'Plan analytiques'/);
assert.match(appSource, /child.section === 'definitionsAnalytics'/);
assert.match(appSource, /var disabled = child\.status === 'inactive';[\s\S]*return disabled[\s\S]*edition-report-card is-disabled/);
assert.match(appSource, /function viewUnbalancedJournalPieces\(\)[\s\S]*total\.debit !== total\.credit/);
assert.match(appSource, /child\.id === 'journal-unbalanced-pieces'\) return viewUnbalancedJournalPieces\(\)/);
assert.match(appSource, /function editionReportCatalog\([\s\S]*Balances, ouvertures et situations[\s\S]*Grands livres et historiques[\s\S]*Disponibilités budgétaires/);
assert.match(menuRenderer, /isEditionReportsMenu[\s\S]*editionReportChildView\(selectedChild/);
assert.equal(findTab('editions', 'general-accounts').status, 'mixed');
assert.deepEqual(findTab('editions', 'general-accounts').children.map(child => child.label), [
  'Balance générale des comptes', 'Balance de synthèse', 'Balance âgée', 'Balance d’ouverture', 'Situation des comptes',
  'Grand livre des comptes', 'Historique des comptes sur plusieurs exercices', 'Journal des reports',
  'Balance détaillée analytiquement', 'Détail des contreparties d’un compte', 'Cumul des contreparties d’un compte'
]);
assert.equal(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-balance').status, 'partial');
assert.equal(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-ledger').status, 'partial');
assert.equal(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-analytic-balance').status, 'inactive');
assert.equal(findTab('editions', 'third-parties').children.length, 7);
assert.equal(findTab('editions', 'foreign-currency').children.length, 5);
assert.equal(findTab('editions', 'analytic-statements').status, 'inactive');
assert.equal(findTab('editions', 'analytic-statements').children.length, 7);
assert.ok(findTab('editions', 'analytic-statements').children.every(child => child.status === 'inactive'));
assert.equal(findTab('editions', 'supplier-orders').status, 'inactive');
assert.equal(findTab('editions', 'budget').children.length, 10);
assert.equal(findTab('editions', 'budget').status, 'planned');
assert.equal(['general-accounts', 'third-parties', 'foreign-currency', 'analytic-statements', 'budget']
  .reduce((total, tabId) => total + findTab('editions', tabId).children.length, 0), 40);
assert.equal(findTab('definitions', 'responsibility-centers').status, 'partial');
assert.equal(findTab('outils', 'calculator').status, 'inactive');
assert.equal(findTab('outils', 'screenshot').status, 'inactive');
assert.equal(findTab('saisie', 'opening-balances').status, 'partial');
assert.ok(findTab('saisie', 'opening-balances').reason.includes('relançable'));
assert.ok(findTab('saisie', 'opening-balances').reason.includes('factures'));
assert.equal(findTab('fin-exercice', 'opening-transfer').status, 'partial');
assert.equal(findTab('fin-exercice', 'opening-transfer').actions[0].tab, 'opening-balances');
assert.ok(findTab('fin-exercice', 'opening-transfer').reason.includes('ne clôture pas définitivement'));
assert.equal(findTab('fin-exercice', 'period-close').status, 'partial');
assert.equal(findTab('fin-exercice', 'period-close').actions[0].route, 'periods');
assert.equal(findTab('fin-exercice', 'definitive-close').irreversible, true);
assert.equal(findTab('fin-exercice', 'definitive-close').status, 'planned');
assert.equal(findTab('parametres', 'dossier-configuration').label, 'Configuration de la Comptabilité');
assert.equal(findTab('parametres', 'dossier-configuration').actions[0].route, 'settings', 'les sauvegardes restent accessibles séparément');
assert.equal(findTab('parametres', 'sections-accounts').status, 'partial', 'le paramétrage est accessible, sans activer les traitements analytiques');
assert.equal(findTab('parametres', 'allocation-keys').status, 'partial');
assert.ok(findTab('parametres', 'allocation-keys').reason.includes('aucun calcul ou transfert analytique'));
assert.equal(findTab('parametres', 'general-account-natures').status, 'partial');
assert.ok(findTab('parametres', 'general-account-natures').reason.includes('contrôle des doublons'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'general-account-natures'[\s\S]*viewGeneralAccountNatures\(\)/);
assert.match(appSource, /function viewGeneralAccountNatures\(\)[\s\S]*generalAccountNatures\.configure[\s\S]*Nature[\s\S]*Comptes généraux\.\.\.[\s\S]*Initialisation[\s\S]*Modifier[\s\S]*Fermer/);
assert.match(appSource, /function bindGeneralAccountNatures\(\)[\s\S]*initializeGeneralAccountNaturesConfiguration/);
assert.match(appSource, /function openGeneralAccountNatureEditor\(natureRow\)[\s\S]*saveGeneralAccountNaturesConfiguration/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'allocation-keys'[\s\S]*viewAnalyticalAllocationKeys\(\)/);
assert.match(appSource, /function viewAnalyticalAllocationKeys\(\)[\s\S]*analyticalAllocationKeys\.configure[\s\S]*Sections auxiliaires[\s\S]*Familles des prestations[\s\S]*data-allocation-action="destination"[\s\S]*Aperçu/);
assert.match(appSource, /function bindAnalyticalAllocationKeys\(\)[\s\S]*saveAnalyticalAllocationKeysConfiguration/);
assert.match(appSource, /Aucun calcul ni transfert de données n’est exécuté par cet aperçu/);
assert.match(appSource, /if \(action === 'display'\)[\s\S]*else if \(action === 'destination'\)[\s\S]*else if \(action === 'preview'\)/);
assert.match(appSource, /function allocationKeyRowHtml\(kind, row, index, editable\)[\s\S]*maxlength="120"[\s\S]*disabled/);
assert.match(appSource, /insertAdjacentHTML\('beforeend', allocationKeyRowHtml\(kind, \{\}, tbody\.querySelectorAll\('\[data-allocation-row\]'\)\.length, true\)\)/);
assert.match(appSource, /data-allocation-action="display"[\s\S]*data-allocation-action="validate"[\s\S]*data-allocation-action="destination"[\s\S]*data-allocation-action="preview"/);
assert.equal(findTab('parametres', 'analytic-natures').status, 'partial', 'le tableau des natures analytiques est consultable sans activer les opérations analytiques');
assert.ok(findTab('parametres', 'analytic-natures').reason.includes('mouvements et calculs'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'analytic-natures'[\s\S]*viewAnalyticalNatures\(\)/);
assert.match(appSource, /function viewAnalyticalNatures\(\)[\s\S]*Nom générique[\s\S]*Nom indiv\.[\s\S]*Comptes significatifs[\s\S]*Comptes à reporter[\s\S]*Modifier[\s\S]*Fermer/);
assert.match(appSource, /function bindAnalyticalNatures\(\)[\s\S]*openAnalyticalNatureEditor/);
assert.match(appSource, /function openAnalyticalNatureEditor\(natureRow\)[\s\S]*saveAnalyticalNaturesConfiguration/);
assert.match(appSource, /data-analytical-nature-action="toggle-io"[\s\S]*requiredAtEntry: !row\.requiredAtEntry/);
assert.equal(findTab('parametres', 'fixed-asset-accounts').status, 'partial');
assert.ok(findTab('parametres', 'fixed-asset-accounts').reason.includes('aucune écriture'));
assert.match(appSource, /var fixedAssetAccountsSelectedId = 'fixed-assets-class-21'/, '21* est sélectionné à l’ouverture');
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'fixed-asset-accounts'[\s\S]*viewFixedAssetAccounts\(\)/);
assert.match(appSource, /function viewFixedAssetAccounts\(\)[\s\S]*Compte de valeur brute[\s\S]*Compte d’amortissements[\s\S]*Dotations aux amortissements[\s\S]*Valeurs nettes de cession[\s\S]*Reprises de subventions[\s\S]*Réinitialiser\.\.\.[\s\S]*Valider[\s\S]*Annuler/);
assert.match(configurationCss, /\.fixed-asset-accounts-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'table et actions suivent une disposition sous la grille');
assert.match(configurationCss, /\.fixed-asset-accounts-table-wrap\s*\{[^}]*width:\s*100%[^}]*\}/, 'la table utilise toute la largeur disponible');
assert.doesNotMatch(configurationCss, /\.fixed-asset-accounts-table-wrap\s*\{[^}]*overflow:\s*(?:auto|scroll)/, 'la table ne crée pas de barre de défilement interne');
assert.match(configurationCss, /\.fixed-asset-accounts-actions\s*\{[^}]*grid-template-columns:\s*repeat\(6/, 'les boutons sont regroupés sous la table');
assert.match(appSource, /function bindFixedAssetAccounts\(\)[\s\S]*initializeFixedAssetAccountsConfiguration[\s\S]*saveFixedAssetAccountsConfiguration/);
assert.match(appSource, /var blankId = 'fixed-assets-empty-' \+ blankIndex/);
assert.match(appSource, /Nouvelle ligne ajoutée sans modifier les lignes existantes/);
assert.match(appSource, /additionalRows: additionalRows/);
assert.equal(findTab('parametres', 'orders-accounts').status, 'partial');
assert.ok(findTab('parametres', 'orders-accounts').reason.includes('aucun achat'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'orders-accounts'[\s\S]*viewOrderAccounts\(\)/);
assert.match(appSource, /function viewOrderAccounts\(\)[\s\S]*Rubrique[\s\S]*Comptes[\s\S]*Comptes généraux\.\.\.[\s\S]*Modifier[\s\S]*Fermer[\s\S]*order-accounts-empty-/);
assert.match(appSource, /tab\.id === 'orders-accounts' \? 'Comptes de suivi des marchés accordés'/, 'le titre de la fenêtre reprend celui de la capture');
assert.match(appSource, /function bindOrderAccounts\(\)[\s\S]*orderAccounts\.configure[\s\S]*openOrderAccountEditor/);
assert.match(appSource, /function openOrderAccountEditor\(orderRow, isNewRow\)[\s\S]*saveOrderAccountsConfiguration/);
assert.match(configurationCss, /\.order-accounts-table tbody tr\.order-accounts-separator td::after/);
assert.match(appSource, /data-order-accounts-action="accounts" disabled/);
assert.equal(findTab('parametres', 'order-natures').status, 'partial');
assert.ok(findTab('parametres', 'order-natures').reason.includes('n’active ni commande'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'order-natures'[\s\S]*viewOrderNatures\(\)/);
assert.match(appSource, /function viewOrderNatures\(\)[\s\S]*data-order-nature-row[\s\S]*Modifier[\s\S]*Fermer[\s\S]*order-natures-empty-/);
assert.match(appSource, /tab\.id === 'order-natures' \? 'Natures des marchés accordés'/, 'le titre de fenêtre reprend celui de la capture');
assert.match(appSource, /function bindOrderNatures\(\)[\s\S]*orderNatures\.configure[\s\S]*openOrderNatureEditor/);
assert.match(appSource, /function openOrderNatureEditor\(natureRow, isNewRow\)[\s\S]*saveOrderNaturesConfiguration/);
assert.match(configurationCss, /\.order-natures-list-wrap[\s\S]*\.order-natures-table[\s\S]*\.order-natures-table tbody tr\.is-selected/);
assert.equal(findTab('parametres', 'account-controls').status, 'partial');
assert.ok(findTab('parametres', 'account-controls').reason.includes('ni lettrage'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'account-controls'[\s\S]*viewAccountControls\(\)/);
assert.match(appSource, /function viewAccountControls\(\)[\s\S]*Comptes à payer[\s\S]*Comptes lettrables[\s\S]*Comptes à recevoir[\s\S]*Comptes pointables[\s\S]*Comptes généraux\.\.\.[\s\S]*Valider[\s\S]*Annuler/);
assert.match(appSource, /tab\.id === 'account-controls' \? 'Suivi des comptes'/, 'le titre de la fenêtre reprend celui de la capture');
assert.match(appSource, /function bindAccountControls\(\)[\s\S]*accountControls\.configure[\s\S]*openGeneralAccountPicker[\s\S]*saveAccountControlsConfiguration/);
assert.match(appSource, /data-account-controls-picker-apply/);
assert.match(configurationCss, /\.account-controls-grid[\s\S]*\.account-controls-fieldset\.is-active textarea[\s\S]*\.account-controls-actions/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'dossier-configuration'[\s\S]*viewAccountingConfiguration\(\)/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'sections-accounts'[\s\S]*viewAnalyticalSectionsConfiguration\(\)/);
assert.match(appSource, /function viewAccountingConfiguration\(\)[\s\S]*accounting\.configure[\s\S]*Exercice en cours/);
assert.match(appSource, /function bindAccountingConfiguration\(\)[\s\S]*updateAccountingConfiguration/);
assert.match(appSource, /function viewAnalyticalSectionsConfiguration\(\)[\s\S]*analyticalSections\.configure[\s\S]*Sections principales[\s\S]*Sections auxiliaires[\s\S]*Comptes/);
assert.match(appSource, /Les listes sont conservées et grisées pour le moment/);
assert.match(appSource, /function bindAnalyticalSectionsConfiguration\(\)[\s\S]*saveAnalyticalSectionsConfiguration/);
assert.match(appSource, /data-action="export-json"/);
assert.match(appSource, /child\.id === 'general-balance'[\s\S]*viewBalance\(\)/);
assert.match(appSource, /child\.id === 'general-ledger'[\s\S]*viewLedger\(\)/);

assert.match(appSource, /function accountingMenuHash\(groupId, tabId, childId\)[\s\S]*return childId \? hash \+ '&c='/,
  'le lien d’un enfant conserve son identifiant dans la route');
assert.match(appSource, /var selectedChild = \(tab\.children \|\| \[\]\)\.find\(function \(child\) \{ return child\.id === params\.c; \}\) \|\| null;/,
  'la plateforme attend la sélection explicite d’un enfant');
assert.match(appSource, /isAccountMovementsSubmenu && selectedChild && selectedChild\.id === 'general-movements'[\s\S]*viewGeneralAccountMovements\(\)/,
  'la plateforme générale ne s’affiche que pour son enfant');
assert.match(appSource, /isAccountMovementsSubmenu && selectedChild && selectedChild\.id === 'third-party-movements'[\s\S]*viewThirdPartyMovements\(\)/,
  'la plateforme des tiers ne s’affiche que pour son enfant');
assert.match(appSource, /isAccountMovementsSubmenu && selectedChild && selectedChild\.id === 'analytic-movements'[\s\S]*analytic-disabled-note/,
  'l’enfant analytique ne produit qu’un avis inactif');
assert.equal((menuRenderer.match(/viewGeneralAccountMovements\(\)/g) || []).length, 1,
  'une seule référence à la plateforme générale existe et elle est gardée par la sélection de l’enfant');
assert.equal((menuRenderer.match(/viewThirdPartyMovements\(\)/g) || []).length, 1,
  'une seule référence à la plateforme des tiers existe et elle est gardée par la sélection de l’enfant');
assert.match(menuRenderer, /group\.id === 'saisie' && tab\.id === 'matching'[\s\S]*viewMatching\(\)/,
  'le sous-menu Lettrage ouvre son écran dédié');
assert.match(menuRenderer, /group\.id === 'saisie' && tab\.id === 'reconciliation'[\s\S]*viewPointage\(\)/,
  'le sous-menu Pointage ouvre son écran dédié');

assert.equal(findTab('parametres', 'financial-framework').status, 'partial');
assert.ok(findTab('parametres', 'financial-framework').reason.includes('cases vides'));
assert.ok(findTab('parametres', 'financial-framework').reason.includes('aucune écriture'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'financial-framework'[\s\S]*viewFinancialFramework\(\)/,
  'le référentiel SYSCOHADA s’ouvre depuis le bon sous-menu Paramètres');
assert.match(appSource, /function viewFinancialFramework\(\)[\s\S]*metadata\.rowCount/);
assert.match(appSource, /Référentiel SYSCOHADA révisé · consultation seule[\s\S]*Débit\/Crédit/);
assert.match(appSource, /Cellule vide dans le PDF/,
  'la vue distingue les deux colonnes et laisse les cellules vides sans calcul comptable');
assert.match(appSource, /function bindFinancialFramework\(\)[\s\S]*AccountingFramework\.search[\s\S]*row\.hidden/,
  'la recherche filtre localement le référentiel sans écrire dans le dossier');
assert.match(appSource, /menuParams\.t === 'financial-framework'\) bindFinancialFramework\(\)/,
  'la recherche est liée lorsque le sous-menu est ouvert');
assert.ok(htmlSource.indexOf('js/accounting-framework.js') < htmlSource.indexOf('js/app.js'),
  'le référentiel est chargé avant le routeur de l’application');
assert.match(serviceWorkerSource, /perfecto-static-v78/);
assert.match(serviceWorkerSource, /\.\/js\/accounting-framework\.js/);
assert.match(serviceWorkerSource, /\.\/js\/fec-import\.js/);
assert.match(htmlSource, /js\/fec-import\.js/);
assert.match(menuRenderer, /case 'import-fec': exchangeFeature = viewAccountingFecImport\(\)/);
assert.match(appSource, /menuParams\.t === 'import-fec'[\s\S]*bindAccountingFecImport\(\)/);
assert.match(appSource, /menuParams\.t === 'centralize-auxiliary' && menuParams\.c === 'centralize-auxiliary-fec'[\s\S]*bindAccountingFecImport\(\)/);
assert.match(appSource, /selectedChild\.id === 'centralize-auxiliary-fec'[\s\S]*viewAccountingFecImport\(\)/);
assert.match(appSource, /function viewAccountingFecImport\(\)[\s\S]*première ligne d’en-tête/);
assert.match(appSource, /function fecImportEntryEditorHtml\([\s\S]*data-fec-edit-field="reference"[\s\S]*data-fec-edit-field="date"[\s\S]*data-fec-edit-field="journal"[\s\S]*data-fec-edit-field="description"[\s\S]*data-fec-edit-field="debit"[\s\S]*data-fec-edit-field="credit"/);
assert.match(appSource, /function fecPreparedEntries\([\s\S]*sourceOriginalEntries[\s\S]*sourceCorrections/);
assert.match(appSource, /Totaux regroupés par compte cible[\s\S]*Lignes auxiliaires/);
assert.match(appSource, /id="fec-import-confirm-corrections"/);
assert.match(appSource, /function buildFecImportReversalEntry\([\s\S]*opposite-lines[\s\S]*originalEntryId/);
assert.match(appSource, /function commitFecImportReversal\([\s\S]*S\.importExchange/);
assert.match(appSource, /Gérer les écritures validées/);
assert.match(appSource, /La pièce FEC d’origine restera validée et inchangée/);
assert.match(appSource, /id="payroll-centralization-confirm-mappings"/);
assert.match(appSource, /id="sales-centralization-confirm-mappings"/);
assert.match(appSource, /Opération de Comptabilité générale · Paie & RH → grand livre/);
assert.match(appSource, /Opération de Comptabilité générale · Ventes, stock & facturation → grand livre/);
assert.equal((appSource.match(/aucune imputation, ventilation ou écriture analytique n’est créée/g) || []).length, 2,
  'les centralisations générales ne doivent pas produire de mouvements analytiques');
assert.equal((appSource.match(/var canCommit = aggregate\.ok && analysis\.ok && session\.mappingsConfirmed && !permissionBlocked && !additiveBlocked;/g) || []).length, 2,
  'Paie & RH et Ventes ne centralisent pas avant confirmation des correspondances');
assert.match(appSource, /function commitAccountingPayrollCentralization\([\s\S]*var mappingsBlocked = !session\.mappingsConfirmed[\s\S]*Confirmez les correspondances entre le module source/);
assert.match(appSource, /function commitAccountingSalesCentralization\([\s\S]*var mappingsBlocked = !session\.mappingsConfirmed[\s\S]*Confirmez les correspondances entre le module source/);
assert.match(configurationCss, /\.financial-framework-table[\s\S]*\.financial-framework-post-code[\s\S]*\.financial-framework-empty-cell/);

console.log('Navigation comptable : 8 menus, hiérarchie, sélection des enfants, périmètre et états inactifs — OK');
