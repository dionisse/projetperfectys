/* Vérifie le sous-menu, la sélection fidèle à la capture et l’aperçu du tableau d’immobilisations. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Reports = require('../modern-proto/js/fixed-asset-overview-report.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'fixed-asset-overview-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'fixed-asset-overview-report.css'), 'utf8');
const tab = navigation.getTab('editions', 'fixed-assets');

assert.ok(tab);
assert.equal(tab.status, 'partial');
const reportItem = tab.children.find(child => child.id === Reports.REPORT_ID);
assert.ok(reportItem);
assert.equal(reportItem.status, 'active');
assert.match(reportItem.reason, /Code élément[\s\S]*Intitulé élément[\s\S]*Code matériel[\s\S]*Taux d’amortissement[\s\S]*Report[\s\S]*Augmentation[\s\S]*Diminution[\s\S]*Solde/);
assert.match(reportItem.reason, /Suivis par éléments coché par défaut, Non suivis par éléments décoché/);
assert.match(reportItem.reason, /Aperçu plein écran/);

assert.match(appSource, /var FixedAssetOverviewReport = window\.PerfectoFixedAssetOverviewReport/);
assert.match(appSource, /function createFixedAssetOverviewReportSession\([\s\S]*accounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd, includeTracked: true, includeUntracked: false/);
assert.match(appSource, /function buildFixedAssetOverviewReport\([\s\S]*accountFilter: session\.filters\.accounts[\s\S]*from: session\.filters\.from[\s\S]*to: session\.filters\.to[\s\S]*accounts: S\.accounts\(\)[\s\S]*assets: S\.fixedAssets\(\)/);
assert.match(appSource, /function fixedAssetOverviewFilterField\([\s\S]*Comptes[\s\S]*Début[\s\S]*Fin/);
assert.match(appSource, /function fixedAssetOverviewSelectionView\([\s\S]*data-fixed-asset-overview-scope="tracked"[\s\S]*Suivis par éléments[\s\S]*data-fixed-asset-overview-scope="untracked"[\s\S]*Non suivis par éléments/);
assert.match(appSource, /function fixedAssetOverviewColumnOption\([\s\S]*data-fixed-asset-overview-column/);
assert.ok(Reports.definitionFor(Reports.REPORT_ID).columns.some(column => column.label === 'Code matériel'));
assert.match(appSource, /function fixedAssetOverviewPrintableHtml\([\s\S]*TABLEAU DES IMMOBILISATIONS[\s\S]*fixedAssetOverviewRowsHtml/);
assert.match(appSource, /function fixedAssetOverviewPrintOptions\([\s\S]*@page \{ size: A4[\s\S]*orientation/);
assert.match(appSource, /function openFixedAssetOverviewPreview\([\s\S]*openReportPreview\(/);
assert.match(appSource, /function generateFixedAssetOverviewReportFile\([\s\S]*exportTabularWorkbook[\s\S]*generalLedgerReportTsv/);
assert.match(appSource, /child\.id === 'edition-fixed-asset-overview'\) return viewFixedAssetOverviewReport/);
assert.match(appSource, /menuParams\.t === 'fixed-assets' && menuParams\.c === 'edition-fixed-asset-overview'\) bindFixedAssetOverviewReport\(\)/);
assert.match(appSource, /Aucun code matériel explicite n’y est enregistré : cette colonne reste vide/);
assert.doesNotMatch(reportSource, /materialCode:\s*String\(asset\.serialNumber/);
assert.doesNotMatch(reportSource, /Code matériel[^\n]*(?:reprend|numéro de série)/i);
assert.match(reportSource, /materialCode:\s*''/);
assert.match(reportSource, /materialCodeFromSerialNumber:\s*false/);
assert.match(reportSource, /Aucune source explicite de code matériel/);
assert.match(reportSource, /carryforward:\s*''[\s\S]*increase:\s*''[\s\S]*decrease:\s*''[\s\S]*balance:\s*''/);
assert.match(reportSource, /fixedAssetMovementsAvailable:\s*false[\s\S]*noMovementAmountsOrBalanceCalculated:\s*true/);
assert.doesNotMatch(reportSource, /grossCost|accumulatedDepreciation|depreciationMethod/);

assert.ok(htmlSource.indexOf('js/accounting-balance-report.js') < htmlSource.indexOf('js/fixed-asset-overview-report.js'));
assert.ok(htmlSource.indexOf('js/fixed-asset-overview-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/fixed-asset-overview-report\.css/);
assert.match(serviceWorkerSource, /\.\/js\/fixed-asset-overview-report\.js/);
assert.match(serviceWorkerSource, /\.\/css\/fixed-asset-overview-report\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v124/);
assert.match(cssSource, /\.fixed-asset-overview-filter-grid[\s\S]*\.fixed-asset-overview-columns-grid[\s\S]*\.fixed-asset-overview-table/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.fixed-asset-overview-table/);
assert.match(cssSource, /max-width: 640px/);

console.log('Immobilisations : sous-menu, filtres, colonnes, code explicite, aperçu et exports contrôlés.');
