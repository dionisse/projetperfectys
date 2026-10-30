/* Intégration du Plan comptable dans Éditions → Définitions et plans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js', 'accounting-plan-edition-report.js'), 'utf8');
const chart = fs.readFileSync(path.join(root, 'js', 'accounting-chart.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'accounting-plan-edition.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const tab = nav.getTab('editions', 'definitions-and-plans');
const child = tab.children.find(item => item.id === 'edition-chart-of-accounts');
const start = app.indexOf('/* --------------------- Édition du Plan comptable');
const end = app.indexOf('function createBalanceItemsEditionReportSession()', start);
const reportUi = app.slice(start, end);

assert.equal(tab.status, 'partial');
assert.equal(child.label, 'Plan comptable');
assert.equal(child.status, 'active');
assert.match(child.reason, /1 400 codes/);
assert.match(child.reason, /ajouts du dossier/);
assert.match(child.reason, /exports Excel\/TXT/);

assert.match(chart, /sourceFile: 'NOMENCLATURE-DES-COMPTES-SYSCOHADA-FINAL-1\.pdf'/);
assert.match(chart, /sourcePdfSha256: '3d90abdfc6c741cfa0f2a3168ad1b696d3dd7d3d40bd1669119a7883f1c5f43c'/);
assert.match(model, /var REPORT_ID = 'edition-chart-of-accounts'/);
assert.match(app, /var AccountingPlanEditionReport = window\.PerfectoAccountingPlanEdition/);
assert.match(app, /var accountingPlanEditionReportSession = null/);
assert.match(app, /var isAccountingPlanEditionReportRoute = route === 'menu'[\s\S]*AccountingPlanEditionReport\.REPORT_ID/);
assert.match(app, /if \(!isAccountingPlanEditionReportRoute\) accountingPlanEditionReportSession = null/);
assert.match(app, /child\.id === 'edition-chart-of-accounts'\) return viewAccountingPlanEdition/);
assert.match(app, /menuParams\.t === 'definitions-and-plans' && menuParams\.c === AccountingPlanEditionReport\.REPORT_ID\) bindAccountingPlanEditionReport/);
assert.match(reportUi, /function createAccountingPlanEditionReportSession\(\)[\s\S]*phase: 'listing'/);
assert.match(reportUi, /function viewAccountingPlanEdition\([\s\S]*session\.phase === 'listing'[\s\S]*viewAccounts\(true\)/);
assert.match(app, /function viewAccounts\(readOnly\)[\s\S]*editionReadOnly = readOnly === true[\s\S]*Même plan comptable que dans Définitions/);
assert.match(app, /editionReadOnly[\s\S]*data-accounting-plan-edition-prepare/);
assert.match(app, /var accountActions = editionReadOnly[\s\S]*Consultation seule/);
assert.match(reportUi, /data-accounting-plan-edition-prepare[\s\S]*session\.phase = 'selection'/);
assert.match(reportUi, /data-accounting-plan-edition-back-listing[\s\S]*session\.phase = 'listing'/);
assert.match(reportUi, /function buildAccountingPlanEditionReport\([\s\S]*records: S\.accounts\(\)/);
assert.match(reportUi, /function accountingPlanEditionSelectionView\([\s\S]*1400[\s\S]*Lignes générées/);
assert.match(reportUi, /function accountingPlanEditionLayoutView\([\s\S]*Imprimante[\s\S]*Style[\s\S]*Orientation[\s\S]*Marges[\s\S]*Pages[\s\S]*Parité[\s\S]*Destination/);
assert.match(reportUi, /function openAccountingPlanEditionPreview\([\s\S]*openReportPreview\('Aperçu — Plan comptable'/);
assert.match(reportUi, /function generateAccountingPlanEditionFile\([\s\S]*exportTabularWorkbook[\s\S]*generalBalanceReportTsv/);
assert.match(reportUi, /function openAccountingPlanEditionAccountPicker\([\s\S]*S\.accounts\(\)/);
assert.match(reportUi, /function accountingPlanEditionPrintableHtml\([\s\S]*report\.rows\.map[\s\S]*accountingPlanEditionCellText/);
assert.match(reportUi, /accountingPlanEditionReportSession = createAccountingPlanEditionReportSession\(\); render\(\)/);
assert.doesNotMatch(reportUi, /S\.(?:addAccount|updateAccount|deleteAccount|createEntry|saveEntry)\s*\(/,
  'le rapport de consultation n’appelle aucune mutation métier');

assert.ok(html.indexOf('js/accounting-balance-report.js') < html.indexOf('js/accounting-plan-edition-report.js'));
assert.ok(html.indexOf('js/accounting-plan-edition-report.js') < html.indexOf('js/app.js'));
assert.match(html, /css\/accounting-plan-edition\.css/);
assert.match(sw, /\.\/js\/accounting-plan-edition-report\.js/);
assert.match(sw, /\.\/css\/accounting-plan-edition\.css/);
assert.match(sw, /perfecto-static-v158/);
assert.match(css, /\.accounting-plan-edition-table-wrap[\s\S]*overflow-x: auto/);
assert.match(css, /body\.report-preview-printing[\s\S]*\.accounting-plan-edition-table/);
assert.match(css, /min-width: 0 !important/);
assert.match(workflow, /modern-proto\/js\/accounting-plan-edition-report\.js/);
assert.match(workflow, /modern-proto\/css\/accounting-plan-edition\.css/);
assert.match(workflow, /node tests\/accounting-plan-edition\.test\.js/);
assert.match(workflow, /node tests\/accounting-plan-edition-ui\.test\.js/);

console.log('Plan comptable : sous-menu, session nettoyée par route, lecture S.accounts(), aperçu plein écran, exports et ressources vérifiés.');
