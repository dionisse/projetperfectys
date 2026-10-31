/* Intégration des dix fenêtres Budget des captures au sous-menu et au parcours d’édition. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Reports = require('../modern-proto/js/budget-reports.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'budget-reports.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'budget-reports.css'), 'utf8');
const budgetTab = navigation.getTab('editions', 'budget');

const expected = [
  ['budget-entered', 'Budget prévisionnel', 'viewBudgetForecastReport'],
  ['budget-orders-followup', 'Budget, reste sur commandes', 'viewBudgetOrdersFollowupReport'],
  ['budget-orders-by-line', 'Détail des commandes des lignes budgétaires', 'viewBudgetOrdersByLineReport'],
  ['budget-orders-outside', 'Commandes hors Budget', 'viewBudgetOrdersOutsideReport'],
  ['budget-realizations-followup', 'Budget, suivi des réalisations', 'viewBudgetRealizationsFollowupReport'],
  ['budget-realizations-by-line', 'Détail des réalisations budgétaires', 'viewBudgetRealizationsByLineReport'],
  ['budget-outside-realizations-total', 'Cumul des réalisations hors Budget', 'viewBudgetOutsideRealizationsTotalReport'],
  ['budget-outside-realizations-detail', 'Réalisations hors Budget', 'viewBudgetOutsideRealizationsDetailReport'],
  ['budget-available-not-committed', 'Budget, engagements et réalisations', 'viewBudgetAvailabilitySummaryReport'],
  ['budget-available-balance', 'Budget, reste disponible', 'viewBudgetAvailableBalanceReport']
];

assert.ok(budgetTab, 'le sous-menu Budget existe');
assert.equal(budgetTab.status, 'active');
assert.match(budgetTab.reason, /93 à 99/);
assert.match(budgetTab.reason, /sans montant simulé/i);
for (const [id, label, viewFunction] of expected) {
  const child = budgetTab.children.find(item => item.id === id);
  assert.ok(child, `${id} est un enfant distinct du sous-menu Budget`);
  assert.equal(child.label, label);
  assert.equal(child.status, 'active');
  assert.match(child.reason, /93[^0-9]*99/);
  assert.match(child.reason, /aperçu plein écran/i);
  assert.ok(appSource.includes(`function ${viewFunction}(backLink)`), `${viewFunction} est défini`);
  assert.ok(appSource.includes(`if (child.id === '${id}') return ${viewFunction}(backLink)`), `${id} est routé vers sa vue`);
  assert.ok(Reports.REPORT_IDS.includes(id));
}
assert.equal(budgetTab.children.filter(item => item.status === 'active').length, 10);
assert.equal(budgetTab.children.filter(item => item.status === 'planned').length, 0);

assert.match(appSource, /var BudgetReports = window\.PerfectoBudgetReports/);
assert.match(appSource, /function createBudgetReportSession\([\s\S]*budgetOptions\(dossier\.cycleStart\)[\s\S]*from: dossier\.cycleStart, to: dossier\.cycleEnd, asOfDate: dossier\.cycleEnd/);
assert.match(appSource, /function budgetReportFilterField\([\s\S]*data-budget-report-filter=\"asOfDate\"/);
assert.match(appSource, /C = Charges, I = Investissements, P = Produits/);
assert.match(appSource, /budget-column-count:[\s\S]*columnStacksMarkup\.join\(''\)/);
assert.match(appSource, /dateLabel\(report\.asOfDate\)/);
assert.match(appSource, /« \* » sélectionne les comptes des rubriques analytiques 93 à 99/);
assert.match(appSource, /function buildBudgetReport\([\s\S]*accounts: S\.accounts\(\)[\s\S]*entries: S\.postedEntries\(\)/);
assert.match(appSource, /function bindBudgetReport\([\s\S]*openCurrencyBalancePicker\(input, 'accounts'\)[\s\S]*openBudgetReportPreview/);
assert.match(appSource, /Aucun montant n’est simulé/);
assert.match(appSource, /Aucune ligne générée/);
assert.match(reportSource, /budgetRegisterAvailable: false[\s\S]*commitmentRegisterAvailable: false[\s\S]*realizationRegisterAvailable: false[\s\S]*accountsLimitedToAnalyticClasses93to99: true/);
assert.match(reportSource, /var year = match\[1\][\s\S]*var code = year \+ type\.suffix/);
assert.match(reportSource, /suffix: 'C'[\s\S]*suffix: 'I'[\s\S]*suffix: 'P'/);

assert.ok(htmlSource.indexOf('js/currency-balance-report.js') < htmlSource.indexOf('js/budget-reports.js'));
assert.ok(htmlSource.indexOf('js/budget-reports.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/budget-reports\.css/);
assert.match(serviceWorkerSource, /\.\/js\/budget-reports\.js/);
assert.match(serviceWorkerSource, /\.\/css\/budget-reports\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v172/);
assert.match(cssSource, /\.budget-report-filter-grid[\s\S]*\.budget-report-column-option[\s\S]*\.budget-report-table/);
assert.match(cssSource, /max-width: 640px/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.budget-report-table/);

console.log('Budget : navigation, formulaires par capture, filtres et aperçu contrôlés.');
