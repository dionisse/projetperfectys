/* Intégration de Postes associés aux comptes dans Définitions et plans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const data = fs.readFileSync(path.join(root, 'js', 'accounting-associated-items.js'), 'utf8');
const model = fs.readFileSync(path.join(root, 'js', 'account-associated-items-edition-report.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'associated-items-edition.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const child = nav.getTab('editions', 'definitions-and-plans').children.find(item => item.id === 'edition-account-associated-items');

assert.equal(child.status, 'active');
assert.match(child.reason, /Comptes \(\*\)/);
assert.match(child.reason, /193 lignes du PDF joint sur 4 pages/);
assert.match(child.reason, /Aperçu plein écran imprimable/);

assert.match(app, /var AssociatedItemsEditionReport = window\.PerfectoAssociatedAccountItemsEdition/);
assert.match(app, /function associatedItemsEditionSelectionView\([\s\S]*pageHeader\('Postes associés aux comptes'[\s\S]*card journal-lines-card[\s\S]*Comptes[\s\S]*Colonnes à imprimer[\s\S]*Lignes générées/);
assert.doesNotMatch(app, /associated-items-edition-window|definitions-plans-edition-titlebar/);
assert.match(app, /function associatedItemsEditionPrintableHtml\([\s\S]*Postes[\s\S]*Débiteur[\s\S]*Créditeur[\s\S]*Comptes sélectionnés/);
assert.match(app, /function openAssociatedItemsAccountPicker\([\s\S]*AssociatedItemsReference\.all\(\)/);
assert.match(app, /openReportPreview\('Aperçu — '[\s\S]*associatedItemsEditionPrintableHtml/);
assert.match(app, /if \(!isAssociatedItemsEditionReportRoute\) associatedItemsEditionReportSession = null/);
assert.match(app, /child\.id === AssociatedItemsEditionReport\.REPORT_ID\) return viewAssociatedItemsEditionReport/);
assert.match(app, /menuParams\.c === AssociatedItemsEditionReport\.REPORT_ID\) bindAssociatedItemsEditionReport/);
assert.match(model, /generatedLineCount: rows\.length \? rows\.length \+ 1 : 0/);
assert.match(data, /sourcePdfSha256/);

assert.ok(html.indexOf('js/accounting-associated-items.js') < html.indexOf('js/account-associated-items-edition-report.js'));
assert.ok(html.indexOf('js/account-associated-items-edition-report.js') < html.indexOf('js/app.js'));
assert.match(html, /css\/associated-items-edition\.css/);
assert.match(sw, /\.\/js\/accounting-associated-items\.js/);
assert.match(sw, /\.\/js\/account-associated-items-edition-report\.js/);
assert.match(sw, /\.\/css\/associated-items-edition\.css/);
assert.match(sw, /perfecto-static-v146/);
assert.match(css, /\.associated-items-edition-print[\s\S]*table-layout: fixed/);
assert.match(css, /body\.report-preview-printing[\s\S]*\.associated-items-edition-print/);
assert.match(workflow, /modern-proto\/js\/accounting-associated-items\.js/);
assert.match(workflow, /modern-proto\/js\/account-associated-items-edition-report\.js/);
assert.match(workflow, /modern-proto\/css\/associated-items-edition\.css/);
assert.match(workflow, /node tests\/accounting-associated-items-edition\.test\.js/);
assert.match(workflow, /node tests\/account-associated-items-edition-ui\.test\.js/);

console.log('Postes associés aux comptes : sous-menu, filtre, colonnes, aperçu plein écran et ressources vérifiés.');
