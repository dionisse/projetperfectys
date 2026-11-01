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
assert.match(budgetTab.reason, /écritures validées/);
assert.match(budgetTab.reason, /liées manuellement aux lignes budgétaires/i);
assert.match(budgetTab.reason, /trois autres éditions restent en attente/i);
for (const [id, label, viewFunction] of expected) {
  const child = budgetTab.children.find(item => item.id === id);
  assert.ok(child, `${id} est un enfant distinct du sous-menu Budget`);
  assert.equal(child.label, label);
  assert.equal(child.status, 'active');
  if (id === 'budget-entered') {
    assert.match(child.reason, /budget réellement enregistré/i);
    assert.match(child.reason, /montants annuels saisis/i);
    assert.match(child.reason, /Pourcentage du total reste « — »/i);
  } else if (id === 'budget-orders-followup' || id === 'budget-orders-by-line') {
    assert.match(child.reason, /budget enregistré/i);
    assert.match(child.reason, /explicitement liées|reliées manuellement/i);
    if (id === 'budget-orders-followup') assert.match(child.reason, /aucune facture ni écriture n’est créée/i);
    else assert.match(child.reason, /ne sont pas présentés comme des engagements budgétaires/i);
    assert.doesNotMatch(child.reason, /93–99/);
  } else if (id === 'budget-orders-outside') {
    assert.match(child.reason, /classées explicitement hors budget/i);
    assert.match(child.reason, /non classées ne sont jamais assimilées/i);
    assert.match(child.reason, /compte choisi/i);
    assert.doesNotMatch(child.reason, /93–99/);
  } else if (id === 'budget-outside-realizations-total') {
    assert.match(child.reason, /allocation explicite/i);
    assert.match(child.reason, /absente des lignes de ce même compte/i);
    assert.match(child.reason, /ne sont pas requalifiés hors budget/i);
  } else if (id === 'budget-realizations-followup' || id === 'budget-realizations-by-line') {
    assert.match(child.reason, /budget (réellement )?enregistré/i);
    assert.match(child.reason, /écritures validées|lignes validées/i);
    if (id === 'budget-realizations-followup') assert.match(child.reason, /commandes fournisseurs exclues/i);
    else {
      assert.match(child.reason, /allocations explicites/i);
      assert.match(child.reason, /aucune écriture n’est modifiée/i);
    }
  } else {
    assert.match(child.reason, /93[^0-9]*99/);
    assert.match(child.reason, /aperçu plein écran/i);
  }
  assert.ok(appSource.includes(`function ${viewFunction}(backLink)`), `${viewFunction} est défini`);
  assert.ok(appSource.includes(`if (child.id === '${id}') return ${viewFunction}(backLink)`), `${id} est routé vers sa vue`);
  assert.ok(Reports.REPORT_IDS.includes(id));
}
assert.equal(budgetTab.children.filter(item => item.status === 'active').length, 10);
assert.equal(budgetTab.children.filter(item => item.status === 'planned').length, 0);

assert.match(appSource, /var BudgetReports = window\.PerfectoBudgetReports/);
assert.match(appSource, /function createBudgetReportSession\([\s\S]*budgetOptions\(dossier\.cycleStart, S\.budgetRegisterConfiguration\(\)\.rows, dossier\.cycleEnd\)[\s\S]*from: dossier\.cycleStart, to: dossier\.cycleEnd, asOfDate: dossier\.cycleEnd/);
assert.match(appSource, /function budgetReportFilterField\([\s\S]*data-budget-report-filter=\"asOfDate\"/);
assert.match(appSource, /C = Charges, I = Investissements, P = Produits/);
assert.match(appSource, /budget-column-count:[\s\S]*columnStacksMarkup\.join\(''\)/);
assert.match(appSource, /dateLabel\(report\.asOfDate\)/);
assert.match(appSource, /« \* » sélectionne les comptes des rubriques analytiques 93 à 99/);
assert.match(appSource, /function buildBudgetReport\([\s\S]*budgetRegister: S\.budgetRegisterConfiguration\(\)\.rows[\s\S]*entries: S\.postedEntries\(\)/);
assert.match(reportSource, /BudgetRealizations\.calculate\(\{ budget: filteredBudget, entries:/);
assert.match(reportSource, /realizationBeforePeriod:[\s\S]*periodRealization:[\s\S]*realizationAtPeriodEnd:[\s\S]*remainingAtPeriodEnd:/);
assert.match(appSource, /function budgetReportPrintableHtml\([\s\S]*report\.rows \|\| \[\]/);
assert.match(appSource, /function budgetReportExportMatrix\([\s\S]*report\.rows \|\| \[\]/);
assert.match(appSource, /function bindBudgetReport\([\s\S]*openCurrencyBalancePicker\(input, 'accounts'\)[\s\S]*openBudgetReportPreview/);
assert.match(appSource, /aucun montant n’est simulé/i);
assert.match(appSource, /Aucune ligne générée/);
assert.match(reportSource, /budgetRegisterAvailable: false[\s\S]*commitmentRegisterAvailable: false[\s\S]*realizationRegisterAvailable: false[\s\S]*accountsLimitedToAnalyticClasses93to99:/);
assert.match(reportSource, /accountsLimitedToAnalyticClasses93to99: !\(\['budget-entered', 'budget-orders-followup', 'budget-orders-by-line', 'budget-orders-outside', 'budget-realizations-followup', 'budget-realizations-by-line', 'budget-outside-realizations-total'\]/);
assert.match(reportSource, /function forecastRows\([\s\S]*shareOfTotal: null[\s\S]*incompleteLineCount/);
assert.match(reportSource, /function realizationDetailRows\([\s\S]*sourceEntryCount:[\s\S]*matchedSourceLineCount:[\s\S]*unallocatedCount/);
assert.match(appSource, /analyticNatures: S\.analyticalNaturesConfiguration\(\)\.rows/);
assert.match(appSource, /pourcentage du total n’est pas calculé, car sa formule n’est pas définie/i);
assert.match(reportSource, /À ventiler · reliquat analytique explicite/);
assert.ok(appSource.includes("var reportRows = ['forecast', 'orders-followup', 'orders-by-line', 'orders-outside', 'realizations-followup', 'realizations-by-line', 'outside-realizations-total'].indexOf(definition.kind) !== -1 ? (report.rows || []).map"));
assert.ok(appSource.includes("var rows = ['forecast', 'orders-followup', 'orders-by-line', 'orders-outside', 'realizations-followup', 'realizations-by-line', 'outside-realizations-total'].indexOf(definition.kind) !== -1 ? (report.rows || []).map"));
assert.match(reportSource, /var year = match\[1\][\s\S]*var code = year \+ type\.suffix/);
assert.match(reportSource, /suffix: 'C'[\s\S]*suffix: 'I'[\s\S]*suffix: 'P'/);

assert.ok(htmlSource.indexOf('js/currency-balance-report.js') < htmlSource.indexOf('js/budget-realizations.js'));
assert.ok(htmlSource.indexOf('js/budget-realizations.js') < htmlSource.indexOf('js/budget-reports.js'));
assert.ok(htmlSource.indexOf('js/budget-reports.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/budget-reports\.css/);
assert.match(serviceWorkerSource, /\.\/js\/budget-reports\.js/);
assert.match(serviceWorkerSource, /\.\/css\/budget-reports\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v193/);
assert.match(cssSource, /\.budget-report-filter-grid[\s\S]*\.budget-report-column-option[\s\S]*\.budget-report-table/);
assert.match(cssSource, /max-width: 640px/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.budget-report-table/);

console.log('Budget : navigation, formulaires par capture, filtres et aperçu contrôlés.');
