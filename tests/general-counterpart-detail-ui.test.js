/* Contrat d’intégration du Détail des contreparties d’un compte. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'general-counterpart-detail-report.js'), 'utf8');
const ledgerSource = fs.readFileSync(path.join(root, 'js', 'general-ledger-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const configurationCss = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const child = nav.getTab('editions', 'general-accounts').children.find(item => item.id === 'general-counterpart-detail');

assert.ok(child, 'le rapport figure sous Comptes généraux');
assert.equal(child.label, 'Détail des contreparties d’un compte');
assert.equal(child.status, 'active');
assert.match(child.reason, /même pièce/);
assert.match(child.reason, /aucune ventilation de montant/);

assert.match(appSource, /var GeneralCounterpartDetailReport = window\.PerfectoGeneralCounterpartDetailReport/);
assert.match(appSource, /function createGeneralCounterpartDetailReportSession\([\s\S]*accounts: '\*', counterpartAccounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd[\s\S]*printer: 'system', style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*pageFirst: '', pageLast: '', parity: 'none', destination: 'preview'/);
const builder = appSource.slice(appSource.indexOf('function buildGeneralCounterpartDetailReport'), appSource.indexOf('function generalCounterpartDetailColumnOption'));
assert.match(builder, /entries: S\.postedEntries\(\)/);
assert.match(builder, /openingBalances: \[\]/);
assert.doesNotMatch(builder, /entries: S\.entries\(\)|openingBalances: S\.openingBalances\(\)/);
assert.match(appSource, /Comptes à détailler[\s\S]*Comptes de contrepartie[\s\S]*general-counterpart-detail-from[\s\S]*general-counterpart-detail-to[\s\S]*Colonnes à imprimer[\s\S]*Lignes générées/);
assert.match(appSource, /function generalCounterpartDetailReportPrintableHtml\([\s\S]*Détail des contreparties d’un compte[\s\S]*pièce multiligne[\s\S]*aucune ventilation/);
assert.match(appSource, /function generalCounterpartDetailExportMatrix\([\s\S]*columns\.map[\s\S]*Compte à détailler/);
assert.match(appSource, /child\.id === 'general-counterpart-detail'\) return viewGeneralCounterpartDetailReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-counterpart-detail'\) bindGeneralCounterpartDetailReport\(\)/);
assert.match(reportSource, /counterpartAmountsAllocated: false[\s\S]*rowAmountsFromDetailedAccountLine: true/);
assert.match(ledgerSource, /counterpartCodes: counterpartCodes\.slice\(\)/);
assert.ok(htmlSource.indexOf('js/general-ledger-report.js') < htmlSource.indexOf('js/general-counterpart-detail-report.js'));
assert.ok(htmlSource.indexOf('js/general-counterpart-detail-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/general-counterpart-detail-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v131/);
assert.match(configurationCss, /\.general-counterpart-detail-filter-grid[\s\S]*\.general-counterpart-detail-column-grid[\s\S]*\.general-counterpart-detail-table/);

console.log('Détail des contreparties : intégration navigation, filtres et écrans vérifiée.');
