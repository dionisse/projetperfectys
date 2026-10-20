/* Vérifie la hiérarchie des menus et le statut d’activation par défaut. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
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
  'Centralisation auxiliaire interne',
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
  'Cumul des pièces saisies',
  'Cumul par comptes individuels',
  'Cumul par comptes de synthèse',
  'Cumul par tiers',
  'Cumul par centres analytiques',
  'Cumul par devises',
  'Fiche d’imputation',
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
assert.equal(findTab('fichier', 'import-balance').status, 'partial');
assert.ok(findTab('fichier', 'import-balance').reason.includes('PERFECTO-BALANCE v1'));
assert.equal(findTab('fichier', 'centralize-auxiliary').status, 'planned');
assert.ok(findTab('fichier', 'centralize-auxiliary').reason.includes('modules internes'));
assert.ok(findTab('fichier', 'centralize-auxiliary').reason.includes('n’alimente pas une centralisation interne'));
assert.equal(findTab('fichier', 'centralize-payroll').status, 'partial');
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('module interne Paie & RH'));
assert.ok(findTab('fichier', 'centralize-payroll').reason.includes('sans import de fichier externe'));
assert.equal(findTab('fichier', 'centralize-sales').status, 'partial');
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('module maison Ventes, stock & facturation'));
assert.ok(findTab('fichier', 'centralize-sales').reason.includes('sans fichier ni logiciel tiers'));
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
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').status, 'inactive');
assert.match(appSource, /function journalReportCatalog\([\s\S]*Suivi et contrôle des pièces[\s\S]*Cumuls et ventilations[\s\S]*Imputation/);
assert.match(menuRenderer, /isJournalReportsMenu[\s\S]*journalReportChildView\(selectedChild/);
assert.equal(findTab('editions', 'general-accounts').status, 'active');
assert.equal(findTab('editions', 'analytic-statements').status, 'inactive');
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
assert.deepEqual(findTab('editions', 'general-accounts').actions.map(action => action.route), ['balance', 'ledger']);

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

console.log('Navigation comptable : 8 menus, hiérarchie, sélection des enfants, périmètre et états inactifs — OK');
