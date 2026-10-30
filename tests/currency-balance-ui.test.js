/* Contrat d’intégration de la Balance des comptes en devises dans les Éditions. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Report = require('../modern-proto/js/currency-balance-report.js');
const SupplementaryReports = require('../modern-proto/js/currency-supplementary-reports.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'currency-balance-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'currency-balance-report.css'), 'utf8');
const currencyTab = navigation.getTab('editions', 'foreign-currency');
const child = currencyTab.children.find(item => item.id === 'currency-balance');

assert.ok(child, 'Balance est l’enfant du sous-menu Comptes en devises');
assert.equal(currencyTab.label, 'Comptes en devises');
assert.equal(currencyTab.status, 'active');
assert.equal(child.label, 'Balance');
assert.equal(child.status, 'active');
assert.match(child.reason, /93 à 99/);
assert.match(child.reason, /aperçu plein écran/i);
assert.match(child.reason, /aucun cours/i);

const supplementaryChildren = ['currency-opening-balance', 'currency-situation', 'currency-ledger', 'currency-exchange-differences'].map(id => {
  const item = currencyTab.children.find(childItem => childItem.id === id);
  assert.ok(item, `${id} est un enfant distinct de Comptes en devises`);
  assert.equal(item.status, 'active');
  assert.match(item.reason, /93 à 99/);
  assert.match(item.reason, /aperçu plein écran/i);
  return item;
});
assert.equal(supplementaryChildren.length, 4);
assert.deepEqual(SupplementaryReports.POSITION_COLUMNS.map(column => column.label), [
  'Code du Compte', 'Intitulé du Compte', 'Position en CFA', 'Position en devise'
]);
assert.deepEqual(SupplementaryReports.OPENING_COLUMNS.map(column => column.label), [
  'Compte', 'Intitulé', 'Position en CFA', 'Position en devise'
]);
assert.deepEqual(SupplementaryReports.LEDGER_COLUMNS.map(column => column.label), [
  'Date', 'Journal', 'Pièce', 'Référence', 'Montant en CFA', 'Montant en devise', 'Libellé', 'Contrepartie'
]);
assert.deepEqual(SupplementaryReports.EXCHANGE_COLUMNS.map(column => column.label), [
  'Code du Compte', 'Position en CFA', 'Contrevaleur en CFA', 'Intitulé du Compte', 'Position en devise', 'Écart de change'
]);

assert.deepEqual(Report.ANALYTIC_ACCOUNT_ROOTS.map(row => row.code), ['93', '94', '95', '96', '97', '98', '99']);
assert.deepEqual(Report.COLUMN_DEFINITIONS.filter(column => column.defaultSelected).map(column => column.label), [
  'Code du Compte',
  'Intitulé du Compte',
  'Solde en Début de Période',
  'Mouvements de la Période',
  'Solde en Fin de Période'
]);

assert.match(appSource, /var CurrencyBalanceReport = window\.PerfectoCurrencyBalanceReport/);
assert.match(appSource, /var CurrencySupplementaryReports = window\.PerfectoCurrencySupplementaryReports/);
assert.match(appSource, /isCurrencyBalanceReportRoute = route === 'menu'[\s\S]*params\.t === 'foreign-currency'[\s\S]*params\.c === 'currency-balance/);
assert.match(appSource, /function viewCurrencyOpeningBalanceReport[\s\S]*function viewCurrencyPositionReport[\s\S]*function viewCurrencyLedgerReport[\s\S]*function viewCurrencyExchangeDifferenceReport/);
assert.match(appSource, /data-currency-supp-filter="asOfDate"/);
assert.match(appSource, /function bindCurrencySupplementaryReport\([\s\S]*openCurrencySupplementaryPicker[\s\S]*openCurrencySupplementaryReportPreview/);
assert.match(appSource, /currency-opening-balance', 'currency-situation', 'currency-ledger', 'currency-exchange-differences/);
assert.match(appSource, /child\.id === 'currency-balance'\) return viewCurrencyBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'foreign-currency' && menuParams\.c === 'currency-balance'\) bindCurrencyBalanceReport\(\)/);
assert.match(appSource, /function createCurrencyBalanceReportSession\([\s\S]*currencies: '\*', accounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd/);
assert.match(appSource, /function buildCurrencyBalanceReport\(session\)[\s\S]*entries: S\.postedEntries\(\)[\s\S]*openingBalances: S\.openingBalances\(\)[\s\S]*currencyRecords: currencyConfiguration\.rows[\s\S]*baseCurrencyCode: currencyConfiguration\.defaultCurrencyCode/);
assert.match(appSource, /function currencyBalanceReportSelectionView\([\s\S]*currency-balance-currencies[\s\S]*currency-balance-accounts[\s\S]*currency-balance-from[\s\S]*currency-balance-to/);
assert.match(appSource, /Lignes générées : <strong data-currency-balance-line-count>/);
assert.match(appSource, /function currencyBalanceReportSelectionView\([\s\S]*rubriques 93 à 99[\s\S]*aucun taux n’est appliqué/);
assert.match(appSource, /function currencyBalanceReportLayoutView\([\s\S]*Imprimante[\s\S]*Style[\s\S]*Portrait[\s\S]*Paysage[\s\S]*Marges[\s\S]*Première[\s\S]*Dernière[\s\S]*Parité[\s\S]*Destination/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openCurrencyBalanceReportPreview\([\s\S]*openReportPreview\('Aperçu — Balance des comptes en devises'/);
assert.match(appSource, /function bindCurrencyBalanceReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openCurrencyBalanceReportPreview/);
assert.match(reportSource, /openingRegistryIsXofOnly: true[\s\S]*foreignOpeningBalancesAvailable: false[\s\S]*noExchangeRateApplied: true[\s\S]*noAccountingMutation: true/);
assert.match(reportSource, /Le registre Reports à nouveau ne stocke que des montants XOF/);
assert.match(reportSource, /aucun résultat partiel n’est affiché/);

assert.ok(htmlSource.indexOf('js/accounting-framework.js') < htmlSource.indexOf('js/currency-balance-report.js'));
assert.ok(htmlSource.indexOf('js/currency-balance-report.js') < htmlSource.indexOf('js/currency-supplementary-reports.js'));
assert.ok(htmlSource.indexOf('js/currency-supplementary-reports.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/currency-balance-report\.css/);
assert.match(serviceWorkerSource, /\.\/js\/currency-balance-report\.js/);
assert.match(serviceWorkerSource, /\.\/js\/currency-supplementary-reports\.js/);
assert.match(serviceWorkerSource, /\.\/css\/currency-balance-report\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v155/);
assert.match(cssSource, /\.currency-balance-selection-footer[\s\S]*\.currency-balance-generated-count/);
assert.match(cssSource, /\.currency-balance-filter-grid[\s\S]*\.currency-balance-column-grid/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.currency-balance-report-table/);

console.log('Balance des comptes en devises : navigation, sélection, mise en page et aperçu contrôlés.');
