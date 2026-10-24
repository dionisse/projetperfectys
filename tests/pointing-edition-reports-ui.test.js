/* Vérifie l’intégration des états Pointage aux menus, filtres, aperçus et exports. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Reports = require('../modern-proto/js/pointing-edition-reports.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'pointing-edition-reports.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'pointing-edition-reports.css'), 'utf8');
const tab = navigation.getTab('editions', 'bank-reconciliation');

assert.ok(tab);
assert.equal(tab.status, 'active');
assert.deepEqual(tab.children.map(child => child.id), [
  'edition-pointed-entries', 'edition-unpointed-entries', 'edition-pointing-balance-justification',
  'edition-bank-statement', 'edition-bank-reconciliation'
]);
assert.deepEqual(tab.children.filter(child => Reports.REPORT_IDS.includes(child.id)).map(child => child.label), [
  'Écritures pointées', 'Écritures non pointées', 'Justification des soldes par pointage', 'Relevé de banque', 'Rapprochements bancaires'
]);
assert.ok(tab.children.filter(child => Reports.REPORT_IDS.includes(child.id)).every(child => child.status === 'active'));
assert.match(tab.children.find(child => child.id === 'edition-bank-statement').reason, /lignes invalides et leurs erreurs restent visibles/);
assert.ok(tab.children.filter(child => Reports.REPORT_IDS.includes(child.id)).every(child => /tout le plan(?: comptable)? actuel et futur/.test(child.reason)));

assert.match(appSource, /var PointingEditionReports = window\.PerfectoPointingEditionReports/);
assert.match(appSource, /function createPointingEditionReportSession\([\s\S]*accounts: '\*', statementId: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd/);
assert.match(appSource, /function buildPointingEditionReport\([\s\S]*accountFilter: session\.filters\.accounts[\s\S]*statementId: session\.filters\.statementId[\s\S]*accounts: S\.accounts\(\)[\s\S]*entries: S\.entries\(\)[\s\S]*pointageMarks: S\.pointageMarks\(\)[\s\S]*bankStatements: session\.statementRecords/);
assert.match(appSource, /function loadPointingEditionStatements\([\s\S]*BankStatementStorage\.list\(dossierId\)/);
assert.match(appSource, /function pointingEditionFilterField\([\s\S]*statementId[\s\S]*Tous les relevés correspondant aux comptes sélectionnés/);
assert.match(appSource, /function pointingEditionStatementRowsHtml\([\s\S]*pointing-edition-statement-invalid/);
assert.match(appSource, /column\.key === 'status' && row\.rowErrors/);
assert.match(appSource, /function pointingEditionReportExportMatrix\([\s\S]*definition\.kind === 'bank-statement'[\s\S]*pointingEditionReportValue\(row, column\)/);
assert.match(appSource, /openGeneralBalanceAccountPicker\(input\)/);
assert.match(appSource, /Tous les comptes sélectionnés/);
assert.match(appSource, /function pointingEditionSignatoriesView\([\s\S]*Centre[\s\S]*Gauche[\s\S]*Droite/);
assert.match(appSource, /function pointingEditionReportPrintableHtml\([\s\S]*pointingEditionSignatoriesHtml[\s\S]*Aperçu/);
assert.match(appSource, /function openPointingEditionPreview\([\s\S]*openReportPreview\(/);
assert.match(appSource, /function generatePointingEditionReportFile\([\s\S]*exportTabularWorkbook[\s\S]*generalLedgerReportTsv/);
assert.match(appSource, /PointingEditionReports\.REPORT_IDS\.indexOf\(child\.id\) !== -1\) return viewPointingEditionReport/);
assert.match(appSource, /menuParams\.t === 'bank-reconciliation' && PointingEditionReports\.REPORT_IDS\.indexOf\(menuParams\.c\) !== -1\) bindPointingEditionReport\(\)/);
assert.match(reportSource, /GeneralBalanceReport\.parseAccountFilter/);
assert.match(reportSource, /allAccountCodesAllowed: true/);
assert.match(reportSource, /bankReconciliationRequiresExplicitBankStatementLink: true/);
assert.match(reportSource, /aucun écart bancaire ni solde n’est recalculé/i);
assert.doesNotMatch(reportSource, /account\.cls|classNumber/);

assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/pointing-edition-reports.js'));
assert.ok(htmlSource.indexOf('js/pointing-edition-reports.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/pointing-edition-reports\.css/);
assert.match(serviceWorkerSource, /\.\/js\/pointing-edition-reports\.js/);
assert.match(serviceWorkerSource, /\.\/css\/pointing-edition-reports\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v126/);
assert.match(cssSource, /\.pointing-edition-filter-grid[\s\S]*\.pointing-edition-columns-grid[\s\S]*\.pointing-edition-table/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.pointing-edition-table/);
assert.match(cssSource, /max-width: 640px/);

console.log('Pointage : sous-menu, comptes tous plans, sources enregistrées, signataires, aperçu et exports contrôlés.');
