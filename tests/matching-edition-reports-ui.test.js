/* Intégration des trois états du sous-menu Lettrage aux vues, exports et aperçu plein écran. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Reports = require('../modern-proto/js/matching-edition-reports.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'matching-edition-reports.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'matching-edition-reports.css'), 'utf8');
const matchingTab = navigation.getTab('editions', 'matching');

const expected = [
  ['edition-matched-entries', 'Écritures lettrées'],
  ['edition-unmatched-entries', 'Écritures non lettrées'],
  ['edition-matching-anomalies', 'Anomalies sur les lettrages']
];

assert.ok(matchingTab, 'le sous-menu Lettrage existe');
assert.equal(matchingTab.status, 'active');
assert.match(matchingTab.reason, /aperçu plein écran/i);
assert.match(matchingTab.reason, /plan actuel et futur/i);
assert.deepEqual(matchingTab.children.map(child => [child.id, child.label]), expected);
assert.ok(matchingTab.children.every(child => child.status === 'active'));
for (const [id, label] of expected) {
  const child = matchingTab.children.find(item => item.id === id);
  assert.equal(child.label, label);
  assert.match(child.reason, /tous les comptes du plan/);
  assert.match(child.reason, /aperçu plein écran/i);
  assert.ok(Reports.REPORT_IDS.includes(id));
}

assert.match(appSource, /var MatchingEditionReports = window\.PerfectoMatchingEditionReports/);
assert.match(appSource, /function createMatchingEditionReportSession\([\s\S]*accounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd/);
assert.match(appSource, /function buildMatchingEditionReport\([\s\S]*accounts: S\.accounts\(\)[\s\S]*entries: S\.entries\(\)[\s\S]*matchingGroups: S\.matchingGroups\(\)/);
assert.match(appSource, /function matchingEditionFilterField\([\s\S]*tous les comptes présents et futurs du plan comptable/);
assert.match(appSource, /openGeneralBalanceAccountPicker\(input\)/);
assert.match(reportSource, /Date lettrage/);
assert.match(appSource, /Aperçu plein écran avant impression obligatoire/);
assert.match(appSource, /function openMatchingEditionReportPreview\([\s\S]*openReportPreview\(/);
assert.match(appSource, /function matchingEditionReportExportMatrix\([\s\S]*groupByAccount/);
assert.match(appSource, /Ecritures-lettrees[\s\S]*Ecritures-non-lettrees[\s\S]*Anomalies-lettrages/);
assert.match(appSource, /function submitMatchingEditionReportSelection\([\s\S]*showGeneralBalanceReportErrors/);
assert.match(appSource, /function bindMatchingEditionReport\([\s\S]*openMatchingEditionReportPreview/);
assert.match(appSource, /MatchingEditionReports\.REPORT_IDS\.indexOf\(child\.id\) !== -1\) return viewMatchingEditionReport\(backLink, child\.id\)/);
assert.match(appSource, /menuParams\.t === 'matching' && MatchingEditionReports\.REPORT_IDS\.indexOf\(menuParams\.c\) !== -1\) bindMatchingEditionReport\(\)/);
assert.match(reportSource, /GeneralBalanceReport\.parseAccountFilter/);
assert.match(reportSource, /Le compte n’est plus un compte auxiliaire de classe 4/);
assert.match(reportSource, /Les totaux débit et crédit enregistrés ne sont pas équilibrés/);
assert.match(reportSource, /Une ligne est rattachée à plusieurs lettrages actifs/);
assert.match(reportSource, /aucune anomalie n’est déduite de la seule absence de lettrage/);

assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/matching-edition-reports.js'));
assert.ok(htmlSource.indexOf('js/matching-edition-reports.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/matching-edition-reports\.css/);
assert.match(serviceWorkerSource, /\.\/js\/matching-edition-reports\.js/);
assert.match(serviceWorkerSource, /\.\/css\/matching-edition-reports\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v147/);
assert.match(cssSource, /\.matching-edition-filter-grid[\s\S]*\.matching-edition-columns-grid[\s\S]*\.matching-edition-table/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.matching-edition-table/);
assert.match(cssSource, /max-width: 640px/);

console.log('Lettrage : sous-menu, comptes tous plans, rapports, règles d’anomalies, aperçu et exports contrôlés.');
