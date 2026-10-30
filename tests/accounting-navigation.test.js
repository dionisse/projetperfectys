/* Vérifie la hiérarchie des menus et le statut d’activation par défaut. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const journalLinesSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'journal-lines-report.js'), 'utf8');
const generalBalanceSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-balance-report.js'), 'utf8');
const generalLedgerSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'general-ledger-report.js'), 'utf8');
const agedBalanceSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'aged-balance-report.js'), 'utf8');
const openingBalanceReportSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'opening-balance-report.js'), 'utf8');
const accountSituationReportSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'account-situation-report.js'), 'utf8');
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
  'Extraction interne et lots auxiliaires PERFECTO',
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
  'Écritures non lettrées',
  'Anomalies sur les lettrages',
  'Écritures pointées',
  'Écritures non pointées',
  'Justification des soldes par pointage',
  'Relevé de banque',
  'Rapprochements bancaires',
  'Tableau des immobilisations',
  'Tableau des amortissements',
  'Virements des éléments immobilisés',
  'Entrées d’immobilisations',
  'Sorties des éléments immobilisés',
  'Immobilisations par localisations',
  'Fiche d’immobilisation',
  'Cumul des éléments immobilisés',
  'Grand-livre des éléments immobilisés',
  'Écarts à l’ouverture avec la comptabilité générale',
  'Écarts de la période entre Comptabilité et Tableau des immobilisations',
  'Écarts sur les entrées entre Comptabilité et Tableau des Immobilisations',
  'Écarts sur les sorties entre Comptabilité et Tableau des Immobilisations',
  'Anomalies sur les éléments immobilisés',
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
  'Budget prévisionnel',
  'Budget, reste sur commandes',
  'Détail des commandes des lignes budgétaires',
  'Commandes hors Budget',
  'Budget, suivi des réalisations',
  'Détail des réalisations budgétaires',
  'Cumul des réalisations hors Budget',
  'Réalisations hors Budget',
  'Budget, engagements et réalisations',
  'Budget, reste disponible',
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
assert.equal(findTab('definitions', 'journals').label, 'Journaux');
assert.ok(findTab('definitions', 'journals').actions.some(action => action.route === 'journals'));
assert.ok(findTab('definitions', 'journals').reason.includes('journaux libres'));
const journalsViewStart = appSource.indexOf('function viewJournals() {');
const journalsViewEnd = appSource.indexOf("/* --------------------------- Saisie d'écriture", journalsViewStart);
const journalsView = appSource.slice(journalsViewStart, journalsViewEnd);
const modernCss = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.ok(journalsView.includes('class=\"journal-card-top\"'), 'Les journaux doivent être présentés sous forme de cartes numérotées');
assert.ok(journalsView.includes('Ouvrir le journal'), 'Chaque carte doit permettre d’ouvrir le journal');
assert.ok(journalsView.includes('Détails du journal'), 'Les informations détaillées restent accessibles sans alourdir les cartes');
assert.match(modernCss, /\.journal-card\s*\{[^}]*padding:\s*12px/s, 'Les cartes de journaux doivent rester compactes');
assert.match(modernCss, /\.journal-description\s*\{[^}]*-webkit-line-clamp:\s*2/s, 'Les descriptions ne doivent pas agrandir les cartes');
assert.match(menuRenderer, /group\.id === 'saisie' && tab\.id === 'journal-entry'[\s\S]*accounting-menu-panel-journal-entry/);
assert.match(modernCss, /\.accounting-menu-panel-journal-entry \.accounting-menu-panel-head h3 \{ font-size: \.83rem; \}/, 'Le titre du sous-menu de saisie reprend la taille des titres des cartes Journaux');
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
assert.equal(internalAuxiliaryCentralization.status, 'partial');
assert.ok(internalAuxiliaryCentralization.reason.includes('PERFECTO-AUXILIAIRE v1'));
assert.ok(internalAuxiliaryCentralization.reason.includes('Excel, CSV ou TXT'));
assert.ok(internalAuxiliaryCentralization.reason.includes('lecture seule'));
assert.ok(internalAuxiliaryCentralization.reason.includes('explicite'));
assert.ok(internalAuxiliaryCentralization.reason.includes('brouillon'));
assert.ok(internalAuxiliaryCentralization.reason.includes('authentifié techniquement'));
assert.match(appSource, /function viewInternalAuxiliaryCentralization\(\)[\s\S]*internalAuxiliaryExtractionHtml\(dossier\)[\s\S]*producteur n’est pas authentifié par signature technique/i);
assert.match(appSource, /PERFECTO-AUXILIAIRE v1/);
assert.match(appSource, /function internalAuxiliaryExtractionHtml\([\s\S]*S\.entries\(\)[\s\S]*Aucune ligne validée rattachée explicitement à un auxiliaire[\s\S]*data-format="xlsx"[\s\S]*data-format="csv"[\s\S]*data-format="txt"/);
assert.match(appSource, /function exportInternalAuxiliaryExtraction\([\s\S]*exportAuxiliaryExtractionWorkbook[\s\S]*exportAuxiliaryExtractionCsv[\s\S]*exportAuxiliaryExtractionText/);
assert.match(appSource, /function parseInternalAuxiliaryFile\([\s\S]*parseAuxiliaryWorkbook/);
assert.match(appSource, /function bindInternalAuxiliaryCentralization\(\)[\s\S]*readAsArrayBuffer/);
assert.match(appSource, /function commitInternalAuxiliaryCentralization\(\)[\s\S]*S\.importExchange\(\[entry\], 'draft'/);
assert.match(appSource, /data-action="download-internal-auxiliary-workbook-template"[\s\S]*data-action="download-internal-auxiliary-csv-template"/);
assert.match(appSource, /function internalAuxiliaryHistoryHtml\([\s\S]*Télécharger l’original[\s\S]*Annuler le lot brouillon/);
assert.match(appSource, /menuParams\.c === 'centralize-auxiliary-perfecto'\) bindInternalAuxiliaryCentralization\(\)/);
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
assert.equal(findTab('editions', 'journals').children[0].status, 'active');
assert.ok(findTab('editions', 'journals').children[0].reason.includes('export Excel/TXT'));
assert.equal(findTab('editions', 'journals').children[1].status, 'active');
assert.ok(findTab('editions', 'journals').children[1].reason.includes('compteur dynamique'));
assert.equal(findTab('editions', 'journals').children[4].status, 'active');
assert.ok(findTab('editions', 'journals').children[4].reason.includes('par compte individuel'));
assert.ok(findTab('editions', 'journals').children[4].reason.includes('export Excel/TXT'));
assert.equal(findTab('editions', 'journals').children[5].status, 'active');
assert.ok(findTab('editions', 'journals').children[5].reason.includes('niveau de synthèse'));
assert.ok(findTab('editions', 'journals').children[5].reason.includes('premiers chiffres du code'));
assert.ok(findTab('editions', 'journals').children[5].reason.includes('export Excel/TXT'));
assert.equal(findTab('editions', 'journals').children[6].status, 'active');
assert.ok(findTab('editions', 'journals').children[6].reason.includes('nature'));
assert.ok(findTab('editions', 'journals').children[6].reason.includes('référence explicite'));
assert.ok(findTab('editions', 'journals').children[6].reason.includes('ne sont pas ventilés'));
assert.match(appSource, /child\.id === 'journal-lines' \|\| child\.id === 'journal-modified-pieces' \|\| child\.id === 'journal-unbalanced-pieces' \|\| child\.id === 'journal-entry-totals' \|\| child\.id === 'journal-individual-account-totals' \|\| child\.id === 'journal-summary-account-totals' \|\| child\.id === 'journal-third-party-totals' \|\| child\.id === 'journal-analytic-center-totals' \|\| child\.id === 'journal-currency-totals'\) return viewJournalLinesReport\(backLink\)/,
  'les rapports et les cumuls passent par le parcours partagé en deux étapes');
assert.match(appSource, /parsed\.params\.c === 'journal-individual-account-totals'[\s\S]*'account-totals'[\s\S]*parsed\.params\.c === 'journal-summary-account-totals'[\s\S]*'summary-account-totals'[\s\S]*parsed\.params\.c === 'journal-third-party-totals'[\s\S]*'third-party-totals'[\s\S]*parsed\.params\.c === 'journal-analytic-center-totals'[\s\S]*'analytic-center-totals'[\s\S]*parsed\.params\.c === 'journal-currency-totals' \? 'currency-totals'/,
  'les sous-menus ouvrent les modes dédiés aux cumuls par compte, tiers, centre et devise');
assert.match(journalLinesSource, /ACCOUNT_TOTALS_COLUMNS = \[[\s\S]*Code du compte[\s\S]*Intitulé du compte[\s\S]*Nombre de lignes[\s\S]*reportType === 'account-totals'/,
  'le calcul du cumul individuel expose les colonnes de la capture');
assert.match(journalLinesSource, /SUMMARY_ACCOUNT_TOTALS_COLUMNS = \[[\s\S]*Code du compte[\s\S]*Intitulé du compte[\s\S]*Nombre de lignes[\s\S]*Total des débits[\s\S]*defaultSelected: false[\s\S]*Total des crédits[\s\S]*summary-account-totals/,
  'le cumul de synthèse propose les cinq colonnes attendues avec les débits décochés par défaut');
assert.match(appSource, /id="journal-lines-summary-level"[\s\S]*min="1" max="8" step="1"[\s\S]*value="' \+ esc\(session\.filters\.summaryLevel \|\| 1\)/,
  'le niveau de synthèse est numérique, limité aux codes du plan et initialisé à 1');
assert.match(journalLinesSource, /THIRD_PARTY_TOTALS_COLUMNS = \[[\s\S]*Code du compte[\s\S]*Intitulé du compte[\s\S]*Nombre de lignes[\s\S]*Total des débits[\s\S]*Total des crédits/);
assert.match(appSource, /function journalLinesThirdPartyNatureOptions\(\)[\s\S]*value: 'clients', label: 'Clients'/);
assert.match(appSource, /id="journal-lines-third-party-nature" name="thirdPartyNature"/,
  'le cumul par tiers propose une nature de tiers initialement réglée sur Clients');
assert.match(appSource, /thirdPartyNature: isThirdPartyTotalsReport \? 'clients' : undefined[\s\S]*orientation: [\s\S]*isThirdPartyTotalsReport \|\| isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'landscape'/,
  'le rapport par tiers démarre sur Clients et les cumuls associés reprennent le paysage');
assert.match(appSource, /référence explicite correspondant à une fiche du dossier[\s\S]*ne sont jamais ventilés par supposition/,
  'les cumuls par tiers ne répartissent jamais les mouvements collectifs sans identifiant');
assert.match(appSource, /AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*S\.entries\(\), S\.accounts\(\), dossier/);
assert.match(appSource, /thirdPartyMovements: auxiliaryExtraction\.ok \? auxiliaryExtraction\.movements : \[\][\s\S]*sourceErrors: auxiliaryExtraction\.errors/,
  'une extraction auxiliaire en erreur n’envoie aucun mouvement partiel au rapport');
assert.match(appSource, /session\.mode === 'third-party-totals' && session\.report\.sourceErrors[\s\S]*showJournalLinesErrors\(\$\('#journal-lines-selection-errors'/);
assert.match(appSource, /session\.mode === 'third-party-totals' && session\.report\.sourceErrors[\s\S]*showJournalLinesErrors\(\$\('#journal-lines-layout-errors'/,
  'les erreurs d’extraction bloquent la sélection et la mise en page du rapport');
assert.match(journalLinesSource, /ANALYTICAL_CENTER_TOTALS_COLUMNS = \[[\s\S]*Code analytique[\s\S]*Intitulé[\s\S]*Nombre de lignes[\s\S]*Total des débits[\s\S]*Total des crédits[\s\S]*defaultSelected: true/,
  'le cumul analytique expose les cinq colonnes de la capture, cochées par défaut');
assert.match(journalLinesSource, /function analyticalCenterReferences\([\s\S]*function buildAnalyticalCenterTotals\([\s\S]*centerByReference[\s\S]*natureId === 'responsibility-centers'[\s\S]*references\.invalid/,
  'le cumul analytique exige une référence explicite, valide et non ambiguë');
assert.match(appSource, /function journalLinesAnalyticalNatureOptions\([\s\S]*row\.id === 'responsibility-centers'[\s\S]*S\.analyticalCenters\(\)/);
assert.match(appSource, /id="journal-lines-analytic-nature" name="analyticalNature"[\s\S]*id="journal-lines-analytic-centers-summary"[\s\S]*data-journal-lines-picker="analytic-centers"/,
  'la sélection reprend la nature analytique et les codes de centres de la capture');
assert.match(appSource, /printer: isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'system' : 'pdf'[\s\S]*orientation: [\s\S]*isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'landscape'/,
  'la mise en page analytique démarre sur l’imprimante système et le paysage de la capture');
assert.match(appSource, /lignes validées portant une référence analytique explicite et non ambiguë[\s\S]*Aucune imputation n’est créée/,
  'le rapport analytique ne crée aucune imputation et n’attribue pas les lignes sans référence');
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-currency-totals').status, 'active');
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-currency-totals').reason.includes('montant d’origine explicites'));
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-currency-totals').reason.includes('Aucun taux ni conversion'));
const allocationSheetChild = findTab('editions', 'journals').children.find(child => child.id === 'journal-allocation-sheet');
assert.equal(allocationSheetChild.status, 'active');
assert.ok(allocationSheetChild.reason.includes('trois fiches par page'));
assert.ok(allocationSheetChild.reason.includes('six lignes'));
assert.match(appSource, /function journalAllocationSheetMarkup\(identity, index\)[\s\S]*Array\.from\(\{ length: 6 \}[\s\S]*N° PIÈCE[\s\S]*DATE[\s\S]*JOURNAL[\s\S]*NUMÉRO DE COMPTE[\s\S]*LIBELLÉ[\s\S]*MONTANT/,
  'la fiche reprend les champs de la capture et limite chaque formulaire à six lignes vierges');
assert.match(appSource, /function viewJournalAllocationSheet\(backLink\)[\s\S]*Array\.from\(\{ length: 3 \}[\s\S]*A4/,
  'l’aperçu rassemble trois fiches sur une page A4');
assert.match(appSource, /journal-allocation-sheet-identity[\s\S]*identity\.licenseOwner[\s\S]*identity\.dossierName/,
  'le titulaire et le nom du dossier figurent à gauche, le dossier sous le titulaire');
assert.match(appSource, /function printJournalAllocationSheet\(\)[\s\S]*size: A4 portrait[\s\S]*window\.print\(\)/,
  'la fiche est imprimable ou enregistrable en PDF par le dialogue du navigateur');
assert.match(appSource, /child\.id === 'journal-allocation-sheet'\) return viewJournalAllocationSheet\(backLink\)/);
assert.match(appSource, /menuParams\.c === 'journal-allocation-sheet'\) bindJournalAllocationSheet\(\)/);
assert.match(configurationCss, /journal-allocation-sheet-page[\s\S]*88mm[\s\S]*journal-allocation-sheet-table[\s\S]*tbody tr/);
assert.match(configurationCss, /journal-allocation-sheet-printing \* \{ visibility: hidden !important; \}[\s\S]*journal-allocation-sheet-page \*/);
assert.match(journalLinesSource, /CURRENCY_TOTALS_COLUMNS = \[[\s\S]*Code devise[\s\S]*Intitulé de la devise[\s\S]*Nombre de pièces[\s\S]*Nombre de lignes[^\n]*defaultSelected: false[\s\S]*Total des débits[\s\S]*Total des crédits[\s\S]*buildCurrencyTotals/,
  'le cumul par devise reprend les six colonnes de la capture et laisse le nombre de lignes facultatif');
assert.match(appSource, /currencyRecords: currencyConfiguration\.rows[\s\S]*baseCurrencyCode: currencyConfiguration\.defaultCurrencyCode[\s\S]*reportType: session\.mode/,
  'le rapport utilise les devises configurées par dossier sans appliquer leur cours');
assert.match(appSource, /Les montants XOF reprennent les débits et crédits comptabilisés ; les autres devises exigent un code et un montant d’origine explicites\. Aucun cours de change ni conversion n’est appliqué/);
assert.ok(appSource.indexOf('class="alert info journal-lines-layout-summary"') < appSource.indexOf("session.mode === 'currency-totals' && report.omittedLineCount ?"),
  'l’avertissement sur les lignes omises suit immédiatement le résumé de mise en page');
assert.match(appSource, /devise absente ou ambiguë dans le référentiel[\s\S]*montant comptabilisé invalide ou montant d’origine absent\/illisible[\s\S]*Aucun cours ni conversion n’a été appliqué/);
assert.match(appSource, /printerHint \+\s*currencyWarning \+/,
  'l’avertissement sur les lignes omises est également repris dans l’aperçu');
assert.match(appSource, /printer: isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'system' : 'pdf'[\s\S]*isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'landscape'/,
  'la mise en page devise reprend l’imprimante système, le paysage et l’aperçu de la capture');
assert.match(appSource, /'PERFECTO-cumul-devises-'[\s\S]*'Cumul par devises'/,
  'les exports du cumul par devises utilisent un nom de fichier et un onglet dédiés');
assert.match(configurationCss, /journal-lines-filter-grid\.journal-currency-total-filters[\s\S]*journal-lines-column-grid\.journal-currency-total-columns/);
assert.match(appSource, /includeDrafts: isModifiedReport[\s\S]*modifiedOnly: isModifiedReport[\s\S]*filterByModificationDate: isModifiedReport/,
  'le rapport modifié filtre la date de modification et accepte les brouillons modifiés');
assert.match(appSource, /Lignes générées[\s\S]*data-jlr-generated-count[\s\S]*updateJournalLinesGeneratedCount/,
  'le compteur dynamique est mis à jour lorsque la période de modification change');
assert.match(appSource, /Date de la pièce[\s\S]*Modifications du[\s\S]*au/,
  'le rapport sépare la date comptable de la période de modification');
assert.match(appSource, /function bindJournalLinesReport\([\s\S]*submitJournalLinesSelection[\s\S]*submitJournalLinesLayout/,
  'les deux écrans de sélection et de mise en page sont liés');
assert.match(appSource, /async function generateJournalLinesReportFile[\s\S]*exportTabularWorkbook[\s\S]*toTsv/,
  'les destinations Table et Fichier produisent les formats attendus');
assert.match(appSource, /function printJournalLinesReport[\s\S]*window\.print\(\)/,
  'l’impression n’est lancée qu’à partir de l’écran d’aperçu');
assert.match(appSource, /session\.phase === 'preview'[\s\S]*journal-lines-preview-overlay[\s\S]*aria-modal="true"[\s\S]*data-journal-lines-close-preview/,
  'l’aperçu s’ouvre dans une fenêtre plein écran accessible');
assert.match(appSource, /data-journal-lines-close-preview[\s\S]*session\.phase = 'layout'/,
  'la fermeture de la fenêtre ramène à la mise en page');
assert.match(configurationCss, /\.journal-lines-preview-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/);
assert.match(configurationCss, /\.journal-lines-preview-scroll\s*\{[^}]*overflow:\s*auto/);
assert.match(configurationCss, /body\.journal-lines-printing \.journal-lines-preview-overlay\s*\{[^}]*position:\s*static/,
  'la fenêtre plein écran est retirée du flux au moment d’imprimer');
assert.match(appSource, /function openReportPreview\(title, contentHtml, printOptions\)[\s\S]*report-preview-generic-overlay[\s\S]*report-preview-toolbar-actions/,
  'un composant commun ouvre les futurs aperçus de rapport en plein écran');
assert.match(appSource, /function openCurrentReportPreview\(title\)[\s\S]*reportPreviewSnapshotHtml\(view\)/,
  'les écrans d’édition existants sont capturés en aperçu avant impression');
assert.match(appSource, /case 'print-opening-balances':[\s\S]*openCurrentReportPreview\('Reports à nouveau'\)/,
  'les reports à nouveau utilisent aussi la fenêtre d’aperçu commune');
assert.match(appSource, /case 'print':[\s\S]*openCurrentReportPreview\(\)/,
  'les anciens et futurs boutons data-action="print" passent par l’aperçu commun');
assert.match(configurationCss, /\.report-preview-overlay,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/,
  'la fenêtre générique occupe tout l’écran avec une zone de rapport défilable');
assert.match(configurationCss, /body\.report-preview-printing \.report-preview-sheet[\s\S]*position:\s*absolute/,
  'l’impression de l’aperçu commun isole le document du reste de l’application');
assert.match(appSource, /function journalLinesReportIdentity[\s\S]*id === 'company-name'[\s\S]*Dossier concerné/,
  'l’aperçu reprend le titulaire de licence puis le dossier concerné');
assert.match(appSource, /Organisation · propriétaire de la licence[\s\S]*Dossier concerné/,
  'le même en-tête d’identification est inclus dans la zone d’aperçu et d’impression');
assert.match(journalLinesSource, /(?=[\s\S]*subtotalByPiece)(?=[\s\S]*subtotalByMonth)/);
assert.ok(htmlSource.indexOf('js/journal-lines-report.js') < htmlSource.indexOf('js/app.js'),
  'les fonctions pures du rapport sont chargées avant l’application');
assert.match(serviceWorkerSource, /\.\/js\/journal-lines-report\.js/);
assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/app.js'),
  'le calcul pur de balance est chargé avant les vues de l’application');
assert.match(serviceWorkerSource, /\.\/js\/accounting-balance-report\.js/);
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-unbalanced-pieces').status, 'active');
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-unbalanced-pieces').reason.includes('huit colonnes'));
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-entry-totals').status, 'active');
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-entry-totals').reason.includes('pièces validées'));
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-entry-totals').reason.includes('aperçu, export Excel/TXT'));
assert.equal(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').status, 'active');
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').reason.includes('référence explicite et non ambiguë'));
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').reason.includes('aucune imputation'));
assert.ok(findTab('editions', 'journals').children.find(child => child.id === 'journal-analytic-center-totals').reason.includes('export Excel/TXT'));
assert.equal(findTab('editions', 'matching').status, 'active');
assert.deepEqual(findTab('editions', 'matching').children.map(child => child.label), [
  'Écritures lettrées', 'Écritures non lettrées', 'Anomalies sur les lettrages'
]);
assert.ok(findTab('editions', 'matching').children.every(child => child.status === 'active'));
assert.ok(findTab('editions', 'matching').children.find(child => child.id === 'edition-matching-anomalies').reason.includes('invariants enregistrés'));
assert.ok(findTab('editions', 'matching').children.find(child => child.id === 'edition-matched-entries').reason.includes('tous les comptes du plan'));
assert.ok(findTab('editions', 'matching').children.find(child => child.id === 'edition-unmatched-entries').reason.includes('Écritures à partir du'));
assert.equal(findTab('saisie', 'matching').children, undefined, 'le lettrage opérationnel reste séparé des éditions');
assert.equal(findTab('editions', 'bank-reconciliation').status, 'active');
assert.deepEqual(findTab('editions', 'bank-reconciliation').children.map(child => child.label), [
  'Écritures pointées', 'Écritures non pointées', 'Justification des soldes par pointage',
  'Relevé de banque', 'Rapprochements bancaires'
]);
assert.deepEqual(findTab('editions', 'bank-reconciliation').children.map(child => child.section), [
  'pointing', 'pointing', 'pointing', 'bankReconciliation', 'bankReconciliation'
]);
assert.deepEqual(findTab('editions', 'bank-reconciliation').children.map(child => child.status), [
  'active', 'active', 'active', 'active', 'active'
]);
assert.ok(findTab('editions', 'bank-reconciliation').children.find(child => child.id === 'edition-pointed-entries').reason.includes('tous les comptes sélectionnés'));
assert.ok(findTab('editions', 'bank-reconciliation').children.find(child => child.id === 'edition-bank-reconciliation').reason.includes('ligne de relevé'));
assert.ok(findTab('editions', 'bank-reconciliation').children.find(child => child.id === 'edition-bank-statement').reason.includes('erreurs restent visibles'));
assert.ok(findTab('editions', 'bank-reconciliation').children.find(child => child.id === 'edition-bank-statement').reason.includes('Aucun pointage automatique'));
assert.equal(findTab('editions', 'fixed-assets').status, 'partial');
assert.deepEqual(findTab('editions', 'fixed-assets').children.map(child => child.label), [
  'Tableau des immobilisations', 'Tableau des amortissements',
  'Virements des éléments immobilisés', 'Entrées d’immobilisations', 'Sorties des éléments immobilisés',
  'Immobilisations par localisations', 'Fiche d’immobilisation',
  'Cumul des éléments immobilisés', 'Grand-livre des éléments immobilisés',
  'Écarts à l’ouverture avec la comptabilité générale', 'Écarts de la période entre Comptabilité et Tableau des immobilisations',
  'Écarts sur les entrées entre Comptabilité et Tableau des Immobilisations',
  'Écarts sur les sorties entre Comptabilité et Tableau des Immobilisations', 'Anomalies sur les éléments immobilisés',
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
assert.ok(findTab('editions', 'fixed-assets').children.slice(0, 14).every(child => child.status === 'active'));
assert.ok(findTab('editions', 'fixed-assets').children.slice(14).every(child => child.status === 'inactive'));
assert.ok(findTab('editions', 'fixed-assets').children[0].reason.includes('Aperçu plein écran'));
assert.ok(findTab('editions', 'fixed-assets').children[1].reason.includes('Valeur nette et amortissement restent vides'));
assert.ok(findTab('editions', 'fixed-assets').children.find(child => child.id === 'edition-fixed-asset-entry-discrepancies').reason.includes('date Jusqu’au par défaut en fin de cycle'));
assert.ok(findTab('editions', 'fixed-assets').children.find(child => child.id === 'edition-fixed-asset-entry-discrepancies').reason.includes('Montants enregistrés, Écart'));
assert.ok(findTab('editions', 'fixed-assets').children.find(child => child.id === 'edition-fixed-asset-other-anomalies').reason.includes('Éléments (*)'));
assert.ok(findTab('editions', 'fixed-assets').reason.includes('rapprochements et anomalies sans source/règle restent vides'));
assert.equal(findTab('editions', 'definitions-and-plans').status, 'partial');
assert.equal(findTab('editions', 'definitions-and-plans').children[0].status, 'active');
assert.match(findTab('editions', 'definitions-and-plans').children[0].reason, /532 lignes du PDF SYSCOHADA révisé[\s\S]*Aperçu plein écran/);
assert.equal(findTab('editions', 'definitions-and-plans').children[1].status, 'active');
assert.match(findTab('editions', 'definitions-and-plans').children[1].reason, /92 postes[\s\S]*166 lignes du PDF[\s\S]*compteur 167/);
assert.deepEqual(findTab('editions', 'definitions-and-plans').children.map(child => child.label), [
  'Cadre comptable', 'Postes du bilan', 'Plan comptable', 'Postes associés aux comptes',
  'Tiers', 'Plan des journaux', 'Plan analytiques'
]);
assert.deepEqual(findTab('editions', 'definitions-and-plans').children.map(child => child.section), [
  'definitionsFramework', 'definitionsFramework', 'definitionsAccounts', 'definitionsAccounts',
  'definitionsThirdParties', 'definitionsJournals', 'definitionsAnalytics'
]);
assert.equal(findTab('editions', 'definitions-and-plans').children[2].status, 'active');
assert.ok(findTab('editions', 'definitions-and-plans').children[2].reason.includes('1 400 codes'));
assert.equal(findTab('editions', 'definitions-and-plans').children[3].status, 'active');
assert.equal(findTab('editions', 'definitions-and-plans').children[4].status, 'active');
assert.equal(findTab('editions', 'definitions-and-plans').children[5].status, 'active');
assert.equal(findTab('editions', 'definitions-and-plans').children[6].status, 'inactive');
assert.ok(findTab('editions', 'definitions-and-plans').children.find(child => child.id === 'edition-third-parties').reason.includes('aperçu plein écran'));
assert.ok(findTab('editions', 'definitions-and-plans').children.find(child => child.id === 'edition-journal-plan').reason.includes('automatiques'));
assert.match(appSource, /matching: \{ title: 'États du lettrage'/);
assert.match(appSource, /pointing: \{ title: 'Écritures et justifications par pointage'/);
assert.match(appSource, /bankReconciliation: \{ title: 'Relevés et rapprochements bancaires'/);
assert.match(appSource, /assetDiscrepancies: \{ title: 'Écarts et anomalies'/);
assert.match(appSource, /assetDimensions: \{ title: 'Ventilations désactivées'/);
assert.match(appSource, /definitionsFramework: \{ title: 'Cadre comptable et postes du bilan'/);
assert.match(appSource, /definitionsAnalytics: \{ title: 'Plan analytiques'/);
assert.match(appSource, /child.section === 'definitionsAnalytics'/);
assert.match(appSource, /var disabled = child\.status === 'inactive';[\s\S]*return disabled[\s\S]*edition-report-card is-disabled/);
assert.match(journalLinesSource, /options\.unbalancedOnly[\s\S]*entryDebit[\s\S]*entryCredit/,
  'le rapport ne conserve que les pièces dont les totaux diffèrent');
assert.match(appSource, /function createJournalLinesReportSession[\s\S]*var isCurrencyTotalsReport = mode === 'currency-totals'[\s\S]*orientation: isUnbalancedReport \|\| isTotalsReport \|\| isAccountTotalsReport \|\| isSummaryAccountTotalsReport \|\| isThirdPartyTotalsReport \|\| isAnalyticCenterTotalsReport \|\| isCurrencyTotalsReport \? 'landscape'/,
  'les cumuls par journal, compte, tiers, centre et devise reprennent l’orientation paysage');
assert.match(appSource, /reportType: session\.mode[\s\S]*unbalancedOnly: isUnbalancedReport/);
assert.match(appSource, /if \(child\.id === 'journal-lines'[\s\S]*child\.id === 'journal-entry-totals' \|\| child\.id === 'journal-individual-account-totals' \|\| child\.id === 'journal-summary-account-totals' \|\| child\.id === 'journal-third-party-totals' \|\| child\.id === 'journal-analytic-center-totals' \|\| child\.id === 'journal-currency-totals'\) return viewJournalLinesReport\(backLink\)/,
  'les rapports et les cinq cumuls passent par le même parcours à deux étapes');
assert.match(appSource, /menuParams\.c === 'journal-lines'[\s\S]*menuParams\.c === 'journal-entry-totals' \|\| menuParams\.c === 'journal-individual-account-totals' \|\| menuParams\.c === 'journal-summary-account-totals' \|\| menuParams\.c === 'journal-third-party-totals' \|\| menuParams\.c === 'journal-analytic-center-totals' \|\| menuParams\.c === 'journal-currency-totals'\)\) bindJournalLinesReport\(\)/,
  'les cinq cumuls sont reliés aux interactions de sélection, mise en page, aperçu et impression');
assert.match(appSource, /function editionReportCatalog\([\s\S]*Balances, ouvertures et situations[\s\S]*Grands livres et historiques[\s\S]*Disponibilités budgétaires/);
assert.match(menuRenderer, /isEditionReportsMenu[\s\S]*editionReportChildView\(selectedChild/);
assert.equal(findTab('editions', 'general-accounts').status, 'mixed');
assert.deepEqual(findTab('editions', 'general-accounts').children.map(child => child.label), [
  'Balance générale des comptes', 'Balance de synthèse', 'Balance âgée', 'Balance d’ouverture', 'Situation des comptes',
  'Grand livre des comptes', 'Historique des comptes sur plusieurs exercices', 'Journal des reports',
  'Balance détaillée analytiquement', 'Détail des contreparties d’un compte', 'Cumul des contreparties d’un compte'
]);
assert.equal(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-balance').status, 'active');
assert.ok(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-balance').reason.includes('cumul'));
const agedBalanceNavigation = findTab('editions', 'general-accounts').children.find(child => child.id === 'general-aged-balance');
assert.equal(agedBalanceNavigation.status, 'active');
assert.ok(agedBalanceNavigation.reason.includes('registre dédié'));
assert.ok(agedBalanceNavigation.reason.includes('1–30'));
const openingBalanceNavigation = findTab('editions', 'general-accounts').children.find(child => child.id === 'general-opening-balance');
assert.equal(openingBalanceNavigation.status, 'active');
assert.ok(openingBalanceNavigation.reason.includes('registre Reports à nouveau'));
assert.ok(openingBalanceNavigation.reason.includes('En devise'));
const accountSituationNavigation = findTab('editions', 'general-accounts').children.find(child => child.id === 'general-account-situation');
assert.equal(accountSituationNavigation.status, 'active');
assert.ok(accountSituationNavigation.reason.includes('date du cycle'));
assert.ok(accountSituationNavigation.reason.includes('regroupement'));
assert.match(agedBalanceSource, /balanceEqualsTotalDueLessAdvances: true[\s\S]*postedJournalEntriesAreNotUsed: true/);
assert.match(agedBalanceSource, /itemsAreGrossAmounts: true[\s\S]*advancesAreDatedSettlements: true/);
assert.match(appSource, /var AGED_BALANCE_AGE_COLUMN_DEFINITIONS = AgedBalanceReport\.AGE_BUCKETS\.map\([\s\S]*defaultSelected: false/);
assert.match(appSource, /Aucune tranche n’est cochée par défaut/);
assert.match(appSource, /function agedBalanceReportColumns\(session\)[\s\S]*AGED_BALANCE_AGE_COLUMN_DEFINITIONS\.forEach\(function \(column\) \{[\s\S]*if \(session\.columns\[column\.key\]\)/);
assert.doesNotMatch(appSource, /key: 'ageAmounts'/);
assert.match(agedBalanceSource, /function horizonStart\([\s\S]*shiftMonths\(asOfDate, months\)/);
assert.match(appSource, /child\.id === 'general-aged-balance'\) return viewAgedBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-aged-balance'\) bindAgedBalanceReport\(\)/);
assert.match(appSource, /function submitAgedBalanceSelection\([\s\S]*session\.phase = 'layout'[\s\S]*function openAgedBalanceItemModal/);
assert.match(appSource, /function openAgedBalanceItemModal\([\s\S]*agedBalance\.items\.create[\s\S]*S\.createAgedBalanceItem/);
assert.match(appSource, /function agedBalanceReportPreviewView\([\s\S]*report-preview-overlay aged-balance-preview-overlay[\s\S]*aria-modal="true"[\s\S]*report-preview-sheet aged-balance-preview-sheet/);
assert.match(appSource, /if \(session\.phase === 'preview'\) return agedBalanceReportPreviewView\(session\)/);
assert.match(appSource, /function printAgedBalanceReport\([\s\S]*agedBalance\.print[\s\S]*printReportPreview\(overlay, agedBalancePrintOptions\(session\)\)/);
assert.match(appSource, /function bindAgedBalanceReport\([\s\S]*aged-balance-preview-open[\s\S]*data-aged-balance-close-preview[\s\S]*event\.key === 'Escape'/);
assert.match(configurationCss, /body\.aged-balance-preview-open\s*\{\s*overflow:\s*hidden[\s\S]*\.aged-balance-preview-overlay\s*\{\s*padding:\s*0[\s\S]*\.report-preview-sheet\.aged-balance-preview-sheet\s*\{[^}]*max-width:\s*none/);
assert.ok(htmlSource.indexOf('js/aged-balance-report.js') < htmlSource.indexOf('js/app.js'));
assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/general-ledger-report.js'));
assert.ok(htmlSource.indexOf('js/general-ledger-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/general-ledger-report\.js/);
assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/account-situation-report.js'));
assert.ok(htmlSource.indexOf('js/account-situation-report.js') < htmlSource.indexOf('js/app.js'));
assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/opening-balance-report.js'));
assert.ok(htmlSource.indexOf('js/opening-balance-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/account-situation-report\.js/);
assert.match(serviceWorkerSource, /\.\/js\/aged-balance-report\.js/);
assert.match(serviceWorkerSource, /\.\/js\/opening-balance-report\.js/);
assert.match(configurationCss, /\.aged-balance-register-table[\s\S]*\.aged-balance-report-table/);
assert.ok(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-balance').reason.includes('aperçu'));
const generalLedgerNavigation = findTab('editions', 'general-accounts').children.find(child => child.id === 'general-ledger');
assert.equal(generalLedgerNavigation.status, 'active');
assert.ok(generalLedgerNavigation.reason.includes('soldes progressifs'));
assert.ok(generalLedgerNavigation.reason.includes('comptes non mouvementés'));
assert.equal(findTab('editions', 'general-accounts').children.find(child => child.id === 'general-analytic-balance').status, 'inactive');
assert.equal(findTab('editions', 'third-parties').children.length, 7);
assert.equal(findTab('editions', 'foreign-currency').children.length, 5);
assert.equal(findTab('editions', 'foreign-currency').status, 'active');
assert.equal(findTab('editions', 'foreign-currency').children.find(child => child.id === 'currency-balance').status, 'active');
assert.ok(findTab('editions', 'foreign-currency').children.filter(child => child.id.startsWith('currency-')).every(child => child.status === 'active'));
assert.equal(findTab('editions', 'analytic-statements').status, 'inactive');
assert.equal(findTab('editions', 'analytic-statements').children.length, 7);
assert.ok(findTab('editions', 'analytic-statements').children.every(child => child.status === 'inactive'));
assert.equal(findTab('editions', 'supplier-orders').status, 'inactive');
assert.equal(findTab('editions', 'budget').children.length, 10);
assert.equal(findTab('editions', 'budget').status, 'active');
const budgetTab = findTab('editions', 'budget');
const visibleBudgetReportIds = [
  'budget-entered', 'budget-orders-followup', 'budget-orders-by-line', 'budget-orders-outside',
  'budget-realizations-followup', 'budget-realizations-by-line', 'budget-outside-realizations-total',
  'budget-outside-realizations-detail', 'budget-available-not-committed', 'budget-available-balance'
];
assert.ok(visibleBudgetReportIds.every(id => budgetTab.children.find(child => child.id === id).status === 'active'));
assert.ok(budgetTab.children.every(child => child.status === 'active'));
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
assert.equal(findTab('fin-exercice', 'opening-transfer').children[0].id, 'opening-transfer-build');
assert.equal(findTab('fin-exercice', 'opening-transfer').children[0].label, 'Construire le report à nouveau à N+1');
assert.equal(findTab('fin-exercice', 'opening-transfer').children[0].status, 'partial');
assert.ok(findTab('fin-exercice', 'opening-transfer').reason.includes('ne clôture pas définitivement'));
assert.equal(findTab('fin-exercice', 'balance-checks').status, 'partial');
assert.ok(findTab('fin-exercice', 'balance-checks').reason.includes('pièces validées du cycle'));
assert.equal(findTab('fin-exercice', 'depreciation').status, 'partial');
assert.ok(findTab('fin-exercice', 'depreciation').reason.includes('aucune écriture AMO n’est générée'));
assert.match(menuRenderer, /group\.id === 'fin-exercice' && tab\.id === 'depreciation'[\s\S]*viewYearEndDepreciation\(\)/,
  'le calcul des amortissements est intégré au sous-menu de fin d’exercice');
assert.match(appSource, /function viewYearEndDepreciation\(\)[\s\S]*cycleEnd[\s\S]*12-31[\s\S]*Aucune écriture AMO n’est créée/,
  'le calcul est limité aux cycles clos au 31 décembre et reste non comptabilisant');
assert.match(appSource, /function bindYearEndDepreciation\(\)[\s\S]*FixedAssetDepreciation\.simulate\(S\.fixedAssets\(\)/,
  'le sous-menu utilise le moteur de simulation des fiches d’immobilisations');
assert.match(appSource, /menuParams\.g === 'fin-exercice' && menuParams\.t === 'depreciation'\) bindYearEndDepreciation\(\)/,
  'les conventions explicites et le lancement du calcul sont liés au sous-menu');
assert.match(menuRenderer, /group\.id === 'fin-exercice' && tab\.id === 'balance-checks'[\s\S]*viewFundamentalBalanceChecks\(\)/,
  'la vérification des équilibres est intégrée au sous-menu de fin d’exercice');
assert.match(appSource, /function viewFundamentalBalanceChecks\(\)[\s\S]*viewAccountingBalanceRecalculation\(\)/,
  'le contrôle de fin d’exercice réutilise le recalcul indépendant existant');
assert.match(appSource, /isBalanceRecalculationMenu[\s\S]*parsed\.params\.g === 'fin-exercice' && parsed\.params\.t === 'balance-checks'/,
  'les résultats du contrôle restent affichés pendant les rendus du sous-menu');
assert.match(menuRenderer, /group\.id === 'fin-exercice' && tab\.id === 'opening-transfer' && selectedChild && selectedChild\.id === 'opening-transfer-build'[\s\S]*viewOpeningTransferBuild\(\)/,
  'le sous-élément fin d’exercice ouvre l’écran de construction du report');
assert.match(appSource, /function viewOpeningTransferBuild\(\)[\s\S]*viewOpeningBalances\(\)/,
  'Passage à N+1 réutilise le rendu et le registre Reports à nouveau');
assert.match(appSource, /menuParams\.g === 'fin-exercice' && menuParams\.t === 'opening-transfer' && menuParams\.c === 'opening-transfer-build'\) bindOpeningBalancesView\(\)/,
  'les interactions du transfert utilisent les mêmes liaisons que Saisie → Reports à nouveau');
assert.equal(findTab('fin-exercice', 'period-close').status, 'partial');
assert.equal(findTab('fin-exercice', 'period-close').actions[0].route, 'periods');
assert.ok(findTab('fin-exercice', 'period-close').reason.includes('une seule confirmation'));
assert.match(menuRenderer, /group\.id === 'fin-exercice' && tab\.id === 'period-close'[\s\S]*viewPeriods\(\)/,
  'le sous-menu de fin d’exercice affiche la gestion des périodes existante');
assert.match(appSource, /data-action="close-all-cycle-periods"[\s\S]*Clôturer en une fois les/,
  'la gestion des périodes propose une action de clôture groupée');
assert.match(appSource, /case 'close-all-cycle-periods'[\s\S]*S\.closeOpenCyclePeriods\(\)/,
  'la clôture groupée appelle la mutation atomique du registre de périodes');
assert.match(appSource, /case 'close-all-cycle-periods':[\s\S]*period\.close/,
  'la clôture groupée conserve le droit comptable period.close');
assert.match(appSource, /data-action="reopen-all-cycle-periods"[\s\S]*Réouvrir en une fois les/,
  'la gestion des périodes propose aussi une action de réouverture groupée');
assert.match(appSource, /case 'reopen-all-cycle-periods'[\s\S]*S\.reopenClosedCyclePeriods\(\)/,
  'la réouverture groupée utilise la mutation atomique du registre de périodes');
assert.match(appSource, /case 'reopen-all-cycle-periods':[\s\S]*period\.reopen/,
  'la réouverture groupée conserve le droit comptable period.reopen');
assert.equal(findTab('fin-exercice', 'definitive-close').irreversible, true);
assert.equal(findTab('fin-exercice', 'definitive-close').status, 'active');
assert.equal(findTab('parametres', 'dossier-configuration').label, 'Configuration de la Comptabilité');
assert.equal(findTab('parametres', 'dossier-configuration').actions[0].route, 'settings', 'les sauvegardes restent accessibles séparément');
assert.equal(findTab('parametres', 'sections-accounts').status, 'partial', 'le paramétrage est accessible, sans activer les traitements analytiques');
assert.equal(findTab('parametres', 'allocation-keys').status, 'partial');
assert.ok(findTab('parametres', 'allocation-keys').reason.includes('aucun calcul ou transfert analytique'));
assert.equal(findTab('parametres', 'general-account-natures').status, 'partial');
assert.ok(findTab('parametres', 'general-account-natures').reason.includes('contrôle des doublons'));
assert.equal(findTab('parametres', 'print-information').status, 'partial');
assert.ok(findTab('parametres', 'print-information').reason.includes('35 rubriques'));
assert.equal(findTab('parametres', 'currencies').status, 'partial');
assert.ok(findTab('parametres', 'currencies').reason.includes('XOF comme référence au cours 1.000'));
assert.ok(findTab('parametres', 'currencies').reason.includes('aucune conversion'));
assert.equal(findTab('parametres', 'confidential-accounts').status, 'partial');
assert.ok(findTab('parametres', 'confidential-accounts').reason.includes('Superviseur général'));
assert.ok(findTab('parametres', 'confidential-accounts').reason.includes('masqués'));
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'confidential-accounts'[\s\S]*viewConfidentialAccounts\(\)/);
assert.match(appSource, /function bindConfidentialAccounts\(\)[\s\S]*S\.addConfidentialAccount[\s\S]*S\.updateConfidentialAccount/);
assert.match(configurationCss, /\.confidential-accounts-layout[\s\S]*grid-template-columns/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'general-account-natures'[\s\S]*viewGeneralAccountNatures\(\)/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'print-information'[\s\S]*viewPrintedReportInformation\(\)/);
assert.match(menuRenderer, /group\.id === 'parametres' && tab\.id === 'currencies'[\s\S]*viewCurrencies\(\)/);
assert.match(appSource, /function viewCurrencies\(\)[\s\S]*Devise de référence[\s\S]*Code[\s\S]*Intitulé[\s\S]*Dernier cours[\s\S]*Insérer[\s\S]*Modifier[\s\S]*Supprimer[\s\S]*Valider[\s\S]*Annuler/);
assert.match(appSource, /function bindCurrencies\(\)[\s\S]*'currencies\.configure'[\s\S]*saveCurrenciesConfiguration/);
assert.match(appSource, /case 'save-currency-configuration':[\s\S]*actionId: 'currencies\.configure'/);
assert.match(configurationCss, /\.currency-settings-list-wrap[\s\S]*overflow: auto/);
assert.match(appSource, /function viewPrintedReportInformation\(\)[\s\S]*35 rubriques uniques[\s\S]*Rubrique[\s\S]*Valeur[\s\S]*Annuler[\s\S]*Valider/);
assert.match(appSource, /function bindPrintedReportInformation\(\)[\s\S]*savePrintedReportInformationConfiguration/);
assert.match(configurationCss, /\.printed-report-information-table-wrap[\s\S]*overflow: auto/);
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
assert.match(appSource, /child\.id === 'general-balance'[\s\S]*viewGeneralBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-balance'\) bindGeneralBalanceReport\(\)/);
assert.match(appSource, /function createGeneralBalanceReportSession\(dossier\)[\s\S]*from: dossier\.cycleStart, to: dossier\.cycleEnd[\s\S]*intermediateTotal: false, includeClass8InManagement: true[\s\S]*orientation: 'landscape'[\s\S]*destination: 'preview'/);
assert.match(appSource, /function buildGeneralBalanceReport\(session\)[\s\S]*GeneralBalanceReport\.build\(\{[\s\S]*entries: S\.postedEntries\(\)[\s\S]*openingBalances: S\.openingBalances\(\)/);
assert.match(generalBalanceSource, /beforeInventory: filters\.beforeInventory === true[\s\S]*beforeResult: filters\.beforeResult === true/);
assert.match(generalBalanceSource, /openingBalancesIncludedBeforePeriod: true/);
assert.match(generalBalanceSource, /Cumul Début Période[\s\S]*supported: true[\s\S]*Cumul Fin Période[\s\S]*supported: true/);
assert.match(generalBalanceSource, /cumulativeStartDebit: openingDebit[\s\S]*cumulativeEndDebit: \(row\.openingDebitMinor \+ row\.movementDebitMinor\) \/ factor/);
assert.match(appSource, /selected\.cumulativeStart[\s\S]*Cumul début période[\s\S]*selected\.cumulativeEnd[\s\S]*Cumul fin période/);
assert.match(appSource, /aucun libellé de rubrique absent du plan n’est inventé/);
assert.match(generalBalanceSource, /groupMode === 'chart' \|\| filters\.groupMode === 'subtotals'[\s\S]*displayRows/);
assert.match(appSource, /'subtotals'[\s\S]*Sous-totaux \(imprimés après les comptes individuels\)/);
assert.match(appSource, /openingBalanceDebit[\s\S]*movementBalanceDebit[\s\S]*closingBalanceDebit/);
assert.match(generalBalanceSource, /intermediateTotal: filters\.intermediateTotal === true[\s\S]*includeClass8InManagement: includeClass8InManagement/);
assert.match(appSource, /general-balance-intermediate-total[\s\S]*classes 1–5 \(bilan\)[\s\S]*general-balance-include-class8[\s\S]*classe 8 dans le sous-total de gestion/);
assert.match(appSource, /session\.filters\.intermediateTotal = !![\s\S]*session\.filters\.includeClass8InManagement = !!/);
assert.match(appSource, /general-balance-intermediate-total-row/);
assert.match(appSource, /var displayRows = report\.displayRows \|\| report\.rows;[\s\S]*var bodyRows = displayRows\.map/);
assert.match(appSource, /function generalBalanceReportExportMatrix\(session, report, forSpreadsheet\)[\s\S]*var displayRows = report\.displayRows \|\| report\.rows;[\s\S]*var rows = displayRows\.map/);
assert.match(configurationCss, /general-balance-group-row > td \{[\s\S]*font-weight: 700[\s\S]*general-balance-subtotal-row > td \{[\s\S]*background/);
assert.match(configurationCss, /general-balance-intermediate-total-row > td \{[\s\S]*font-weight: 700[\s\S]*background/);
assert.match(appSource, /function generalBalancePrintOptions\(session\)[\s\S]*@page \{ size: A4/);
assert.match(appSource, /openReportPreview\('Aperçu — Balance générale des comptes'[\s\S]*generalBalanceReportPrintableHtml/);
assert.match(appSource, /child\.id === 'general-opening-balance'\) return viewOpeningBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-opening-balance'\) bindOpeningBalanceReport\(\)/);
assert.match(appSource, /function buildOpeningBalanceReport\(session\)[\s\S]*openingBalances: S\.openingBalances\(\)[\s\S]*sourceDate: S\.expectedOpeningBalanceDate\(\)/);
assert.match(appSource, /function openingBalanceReportSelectionView\([\s\S]*data-opening-balance-picker[\s\S]*Sous-totaux de synthèse[\s\S]*En devise/);
assert.match(openingBalanceReportSource, /foreignCurrencyAmountsAvailable: false[\s\S]*grossDebitAndCreditRetained: true/);
assert.match(appSource, /function openingBalanceReportPrintableHtml\([\s\S]*Balance d’ouverture[\s\S]*registre Reports à nouveau[\s\S]*colonne « En devise » est donc laissée vide/);
assert.match(appSource, /function openingBalanceReportLayoutView\([\s\S]*opening-balance-orientation[\s\S]*opening-balance-margins[\s\S]*opening-balance-page-first[\s\S]*opening-balance-parity[\s\S]*opening-balance-destination/);
assert.match(appSource, /function openOpeningBalanceReportPreview\([\s\S]*openReportPreview\('Aperçu — Balance d’ouverture'/);
assert.match(appSource, /function generateOpeningBalanceReportFile\([\s\S]*exportTabularWorkbook\('Balance d’ouverture'[\s\S]*generalBalanceReportTsv/);
assert.match(appSource, /child\.id === 'general-account-situation'\) return viewAccountSituationReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-account-situation'\) bindAccountSituationReport\(\)/);
assert.match(appSource, /function buildAccountSituationReport\(session\)[\s\S]*entries: S\.postedEntries\(\)[\s\S]*openingBalances: S\.openingBalances\(\)[\s\S]*asOfDate: session\.filters\.asOfDate/);
assert.match(appSource, /function accountSituationReportSelectionView\([\s\S]*account-situation-date[\s\S]*Avec les comptes de regroupement[\s\S]*Lignes générées/);
assert.match(appSource, /function accountSituationReportPrintableHtml\([\s\S]*POSITION DES COMPTES[\s\S]*date incluse[\s\S]*solde net/);
assert.match(appSource, /function accountSituationReportLayoutView\([\s\S]*account-situation-orientation[\s\S]*account-situation-margins[\s\S]*account-situation-page-first[\s\S]*account-situation-parity[\s\S]*account-situation-destination/);
assert.match(appSource, /function openAccountSituationReportPreview\([\s\S]*openReportPreview\('Aperçu — Position des comptes'/);
assert.match(accountSituationReportSource, /closingNetBalances: true[\s\S]*draftEntriesExcluded: true/);
assert.match(appSource, /child\.id === 'general-ledger'\) return viewGeneralLedgerReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-ledger'\) bindGeneralLedgerReport\(\)/);
assert.match(appSource, /function buildGeneralLedgerReport\(session\)[\s\S]*entries: S\.postedEntries\(\)[\s\S]*openingBalances: S\.openingBalances\(\)[\s\S]*from: session\.filters\.from[\s\S]*to: session\.filters\.to/);
assert.match(appSource, /function generalLedgerReportSelectionView\([\s\S]*general-ledger-from[\s\S]*general-ledger-to[\s\S]*Sous-total par mois[\s\S]*Comptes non mouvementés[\s\S]*Lignes générées/);
assert.match(appSource, /function generalLedgerReportLayoutView\([\s\S]*general-ledger-orientation[\s\S]*general-ledger-margins[\s\S]*general-ledger-page-first[\s\S]*general-ledger-parity[\s\S]*general-ledger-destination/);
assert.match(appSource, /function generalLedgerReportPrintableHtml\([\s\S]*GRAND LIVRE DES COMPTES[\s\S]*reports à nouveau[\s\S]*page-break/);
assert.match(generalLedgerSource, /priorEntriesIncludedInRunningBalance: true[\s\S]*sourceReferenceOnly: true[\s\S]*noAccountingMutation: true/);
assert.match(configurationCss, /\.general-ledger-column-grid[\s\S]*\.general-ledger-account-section/);
assert.match(serviceWorkerSource, /perfecto-static-v157/);
assert.equal(nav.getTab('declarations', 'vat-difference').status, 'active');
assert.match(appSource, /group\.id === 'declarations' && tab\.id === 'vat-difference'[\s\S]*viewVatDifferenceReport/);
assert.match(appSource, /function vatDifferenceConfigurationKey\([\s\S]*function openVatDifferenceAccountPicker/);

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
assert.match(appSource, /Référentiel SYSCOHADA révisé · source conservée[\s\S]*Débit\/Crédit/);
assert.match(appSource, /Cellule vide dans le PDF/,
  'la vue distingue les deux colonnes et laisse les cellules vides sans calcul comptable');
assert.match(appSource, /function bindFinancialFramework\(\)[\s\S]*AccountingFramework\.search[\s\S]*row\.hidden/,
  'la recherche filtre localement le référentiel sans écrire dans le dossier');
assert.match(appSource, /menuParams\.t === 'financial-framework'\) bindFinancialFramework\(\)/,
  'la recherche est liée lorsque le sous-menu est ouvert');
assert.ok(htmlSource.indexOf('js/accounting-framework.js') < htmlSource.indexOf('js/app.js'),
  'le référentiel est chargé avant le routeur de l’application');
assert.match(serviceWorkerSource, /perfecto-static-v157/);
assert.match(serviceWorkerSource, /\.\/js\/accounting-framework\.js/);
assert.match(serviceWorkerSource, /\.\/js\/accounting-centralization\.js/);
assert.match(htmlSource, /js\/accounting-centralization\.js/);
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
