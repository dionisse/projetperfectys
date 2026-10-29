/* Intégration de Cadre comptable dans Définitions et plans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js', 'accounting-framework-edition-report.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'financial-framework-edition.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const tab = nav.getTab('editions', 'definitions-and-plans');
const child = tab.children.find(item => item.id === 'edition-accounting-framework');

assert.equal(tab.status, 'partial');
assert.equal(child.status, 'active');
assert.match(child.reason, /Comptes \(\*\)/);
assert.match(child.reason, /Code, Intitulé et Postes au bilan/);
assert.match(child.reason, /Aperçu plein écran et exports/);
assert.equal(tab.children.find(item => item.id === 'edition-balance-items').status, 'active');

assert.match(app, /var FinancialFrameworkEditionReport = window\.PerfectoAccountingFrameworkEdition/);
assert.match(app, /function viewFinancialFrameworkEdition\([\s\S]*edition-report-detail-view financial-framework-edition-report-detail/);
assert.match(app, /child\.id === 'edition-accounting-framework'\) return viewFinancialFrameworkEdition/);
assert.match(app, /menuParams\.t === 'definitions-and-plans' && menuParams\.c === FinancialFrameworkEditionReport\.REPORT_ID\) bindFinancialFrameworkEditionReport/);
assert.match(app, /function financialFrameworkEditionFilterField\([\s\S]*Comptes[\s\S]*Parcourir/);
assert.match(app, /function financialFrameworkEditionSelectionView\([\s\S]*Postes au bilan[\s\S]*data-financial-framework-edition-line-count/);
assert.match(app, /function financialFrameworkEditionLayoutView\([\s\S]*Imprimante[\s\S]*Style[\s\S]*Orientation[\s\S]*Marges[\s\S]*Parité[\s\S]*Destination/);
assert.match(app, /function openFinancialFrameworkEditionPreview\([\s\S]*openReportPreview\('Aperçu — Cadre comptable'/);
assert.match(app, /function financialFrameworkEditionPostHtml\([\s\S]*record\.debit[\s\S]*record\.credit/);
assert.match(app, /function generateFinancialFrameworkEditionFile\([\s\S]*exportTabularWorkbook[\s\S]*generalBalanceReportTsv/);
assert.match(model, /generatedLineCount: rows\.length \? rows\.length \+ 1 : 0/);

assert.ok(html.indexOf('js/accounting-framework.js') < html.indexOf('js/accounting-framework-edition-report.js'));
assert.ok(html.indexOf('js/accounting-balance-report.js') < html.indexOf('js/accounting-framework-edition-report.js'));
assert.ok(html.indexOf('js/accounting-framework-edition-report.js') < html.indexOf('js/app.js'));
assert.match(html, /css\/financial-framework-edition\.css/);
assert.match(sw, /\.\/js\/accounting-framework-edition-report\.js/);
assert.match(sw, /\.\/css\/financial-framework-edition\.css/);
assert.match(sw, /perfecto-static-v147/);
assert.match(css, /\.financial-framework-edition-table-wrap[\s\S]*overflow-x: auto/);
assert.match(css, /body\.report-preview-printing[\s\S]*\.financial-framework-edition-table/);
assert.match(workflow, /modern-proto\/js\/accounting-framework-edition-report\.js/);
assert.match(workflow, /modern-proto\/css\/financial-framework-edition\.css/);
assert.match(workflow, /node tests\/accounting-framework-edition\.test\.js/);
assert.match(workflow, /node tests\/accounting-framework-edition-ui\.test\.js/);

console.log('Cadre comptable : sous-menu, sélection, mise en page, aperçu plein écran, exports et ressources vérifiés.');
