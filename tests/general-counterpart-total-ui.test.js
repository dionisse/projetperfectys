/* Contrat d’intégration du Cumul des contreparties d’un compte. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'general-counterpart-total-report.js'), 'utf8');
const ledgerSource = fs.readFileSync(path.join(root, 'js', 'general-ledger-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const configurationCss = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const child = nav.getTab('editions', 'general-accounts').children.find(item => item.id === 'general-counterpart-total');

assert.ok(child, 'le cumul figure sous Comptes généraux');
assert.equal(child.label, 'Cumul des contreparties d’un compte');
assert.equal(child.status, 'active');
assert.match(child.reason, /lignes réelles des comptes de contrepartie/);
assert.match(child.reason, /sans ventilation/);

assert.match(appSource, /var GeneralCounterpartTotalReport = window\.PerfectoGeneralCounterpartTotalReport/);
assert.match(appSource, /function createGeneralCounterpartTotalReportSession\([\s\S]*accounts: '\*', counterpartAccounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd[\s\S]*printer: 'system', style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*pageFirst: '', pageLast: '', parity: 'none', destination: 'preview'/);
const builder = appSource.slice(appSource.indexOf('function buildGeneralCounterpartTotalReport'), appSource.indexOf('function generalCounterpartTotalColumnOption'));
assert.match(builder, /entries: S\.postedEntries\(\)/);
assert.match(builder, /openingBalances: \[\]/);
assert.doesNotMatch(builder, /entries: S\.entries\(\)|openingBalances: S\.openingBalances\(\)/);
assert.match(appSource, /Comptes à détailler[\s\S]*Comptes de contrepartie[\s\S]*general-counterpart-total-from[\s\S]*general-counterpart-total-to[\s\S]*Colonnes à imprimer/);
assert.match(appSource, /function generalCounterpartTotalPrintableHtml\([\s\S]*Cumul des contreparties d’un compte[\s\S]*lignes source des comptes de contrepartie[\s\S]*Chaque ligne de contrepartie est cumulée une seule fois/);
assert.match(appSource, /function generalCounterpartTotalExportMatrix\([\s\S]*report\.rows/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /Aperçu obligatoire avant impression/);
assert.match(appSource, /function generalCounterpartTotalReportPrintOptions\([\s\S]*@page \{ size: A4 '[ \+]*\+ orientation \+ '[ \+]*; margin: 12mm 12mm 12mm '[ \+]*\+ left \+ '[ \+]*; \}/);
assert.match(appSource, /child\.id === 'general-counterpart-total'\) return viewGeneralCounterpartTotalReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-counterpart-total'\) bindGeneralCounterpartTotalReport\(\)/);
assert.match(reportSource, /counterpartSourceLinesDeduplicated: true[\s\S]*multilineAmountAllocationApplied: false/);
assert.match(reportSource, /sourceLine\.debitMinor[\s\S]*sourceLine\.creditMinor/);
assert.ok(ledgerSource.includes('counterpartLines: counterpartLines'), 'le grand livre expose les lignes source réelles');
assert.ok(ledgerSource.includes('entryKey: entryKey') && ledgerSource.includes('lineIndex: lineIndex'), 'chaque ligne source garde une clé de pièce et un index stable');
assert.ok(htmlSource.indexOf('js/general-counterpart-detail-report.js') < htmlSource.indexOf('js/general-counterpart-total-report.js'));
assert.ok(htmlSource.indexOf('js/general-counterpart-total-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/general-counterpart-total-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v117/);
assert.match(configurationCss, /\.general-counterpart-total-filter-grid[\s\S]*\.general-counterpart-total-column-grid[\s\S]*\.general-counterpart-total-table/);

console.log('Cumul des contreparties : intégration navigation, filtres, écrans et ressources vérifiée.');
