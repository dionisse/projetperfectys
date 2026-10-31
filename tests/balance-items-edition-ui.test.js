/* Intégration des Postes du Bilan dans le sous-menu Définitions et plans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'js', 'accounting-balance-items.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js', 'balance-items-edition-report.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'balance-items-edition.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const tab = nav.getTab('editions', 'definitions-and-plans');
const child = tab.children.find(item => item.id === 'edition-balance-items');

assert.equal(tab.status, 'partial');
assert.equal(child.status, 'active');
assert.match(child.reason, /Filtre Postes \(\*\)/);
assert.match(child.reason, /Code, Comptes et Intitulé cochées/);
assert.match(child.reason, /compteur 167 inclut seulement l’en-tête/);

assert.match(app, /var BalanceItems = window\.PerfectoBalanceItems/);
assert.match(app, /var BalanceItemsEditionReport = window\.PerfectoBalanceItemsEdition/);
assert.match(app, /function viewBalanceItemsEdition\([\s\S]*edition-report-detail-view balance-items-edition-report-detail/);
assert.match(app, /child\.id === 'edition-balance-items'\) return viewBalanceItemsEdition/);
assert.match(app, /menuParams\.t === 'definitions-and-plans' && menuParams\.c === BalanceItemsEditionReport\.REPORT_ID\) bindBalanceItemsEditionReport/);
assert.match(app, /function balanceItemsEditionFilterField\([\s\S]*Postes[\s\S]*data-balance-items-edition-picker/);
assert.match(app, /function balanceItemsEditionSelectionView\([\s\S]*Colonnes à imprimer[\s\S]*data-balance-items-edition-line-count/);
assert.match(app, /function balanceItemsEditionPrintableHtml\([\s\S]*report\.rows\.map[\s\S]*balanceItemsEditionCellText/);
assert.match(app, /function openBalanceItemsEditionPreview\([\s\S]*openReportPreview\('Aperçu — Postes du Bilan'/);
assert.match(app, /function openBalanceItemsEditionPostPicker\([\s\S]*BalanceItems\.all\(\)/);
assert.match(model, /generatedLineCount: lineCount \? lineCount \+ 1 : 0/);
assert.match(model, /function expandPost\([\s\S]*accounts:[\s\S]*postCode:/);
assert.match(data, /postCount: 92,[\s\S]*sourceLineCount: 166/);

assert.ok(html.indexOf('js/accounting-balance-report.js') < html.indexOf('js/accounting-balance-items.js'));
assert.ok(html.indexOf('js/accounting-balance-items.js') < html.indexOf('js/balance-items-edition-report.js'));
assert.ok(html.indexOf('js/balance-items-edition-report.js') < html.indexOf('js/app.js'));
assert.match(html, /css\/balance-items-edition\.css/);
assert.match(sw, /\.\/js\/accounting-balance-items\.js/);
assert.match(sw, /\.\/js\/balance-items-edition-report\.js/);
assert.match(sw, /\.\/css\/balance-items-edition\.css/);
assert.match(sw, /perfecto-static-v167/);
assert.match(css, /\.balance-items-edition-table-wrap[\s\S]*overflow-x: auto/);
assert.match(css, /body\.report-preview-printing[\s\S]*\.balance-items-edition-table/);
assert.match(workflow, /modern-proto\/js\/accounting-balance-items\.js/);
assert.match(workflow, /modern-proto\/js\/balance-items-edition-report\.js/);
assert.match(workflow, /modern-proto\/css\/balance-items-edition\.css/);
assert.match(workflow, /run: npm test/);
assert.match(workflow, /run: npm test/);

console.log('Postes du Bilan : sous-menu, sélection, mise en page, aperçu plein écran, exports et ressources vérifiés.');
