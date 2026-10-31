/* Intégration du Tableau des amortissements : capture, limites de source et aperçu plein écran. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const navigation = require('../modern-proto/js/accounting-navigation.js');
const Reports = require('../modern-proto/js/fixed-asset-depreciation-report.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'fixed-asset-depreciation-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'fixed-asset-depreciation-report.css'), 'utf8');
const tab = navigation.getTab('editions', 'fixed-assets');
const child = tab.children.find(item => item.id === Reports.REPORT_ID);

assert.ok(tab);
assert.equal(tab.status, 'partial');
assert.ok(child);
assert.equal(child.status, 'active');
assert.match(child.reason, /Taux d’Amort\.[\s\S]*Valeur brute[\s\S]*Amortissement[\s\S]*Valeur nette/);
assert.match(child.reason, /Aperçu plein écran/);
assert.match(child.reason, /aucune dotation n’est calculée/);

assert.match(appSource, /var FixedAssetDepreciationReport = window\.PerfectoFixedAssetDepreciationReport/);
assert.match(appSource, /function createFixedAssetDepreciationReportSession\([\s\S]*accounts: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd[\s\S]*netValueNonzero: true, netValueZero: false[\s\S]*withDepreciation: true, withoutDepreciation: false, withExits: true/);
assert.match(appSource, /function buildFixedAssetDepreciationReport\([\s\S]*accountFilter: session\.filters\.accounts[\s\S]*assets: S\.fixedAssets\(\)/);
assert.match(appSource, /function fixedAssetDepreciationSelectionView\([\s\S]*Valeur nette non nulle[\s\S]*Valeur nette nulle[\s\S]*Avec amortissement[\s\S]*Sans amortissement[\s\S]*Avec les sorties/);
assert.match(appSource, /function fixedAssetDepreciationScopeOption\([\s\S]*disabled aria-describedby/);
assert.match(appSource, /function fixedAssetDepreciationPrintableHtml\([\s\S]*TABLEAU DES AMORTISSEMENTS[\s\S]*fixedAssetDepreciationRowsHtml/);
assert.match(appSource, /function openFixedAssetDepreciationPreview\([\s\S]*openReportPreview\(/);
assert.match(appSource, /function generateFixedAssetDepreciationReportFile\([\s\S]*exportTabularWorkbook[\s\S]*generalLedgerReportTsv/);
assert.match(appSource, /child\.id === 'edition-fixed-asset-depreciation'\) return viewFixedAssetDepreciationReport/);
assert.match(appSource, /menuParams\.t === 'fixed-assets' && menuParams\.c === 'edition-fixed-asset-depreciation'\) bindFixedAssetDepreciationReport\(\)/);
const reportViewSource = appSource.slice(
  appSource.indexOf('/* ------------------------- Tableau des amortissements'),
  appSource.indexOf('/* ------------------------- Tableau des immobilisations')
);
assert.ok(reportViewSource.length > 0);
assert.doesNotMatch(reportViewSource, /FixedAssetDepreciation\.simulate\(/, 'le rapport ne lance pas la simulation indicative sans convention explicite');

assert.match(reportSource, /grossValueFromRecordedGrossCost:\s*true/);
assert.match(reportSource, /netValuePerAssetAvailable:\s*false/);
assert.match(reportSource, /exitDateSourceAvailable:\s*false/);
assert.match(reportSource, /netValueFiltersApplied:\s*false/);
assert.match(reportSource, /noDepreciationOrNetValueCalculated:\s*true/);
assert.match(reportSource, /depreciation:\s*''[\s\S]*netValue:\s*''/);
assert.doesNotMatch(reportSource, /FixedAssetDepreciation\.simulate|grossCost\s*[-+*/]|residualValue\s*[-+*/]/);

assert.ok(htmlSource.indexOf('js/fixed-asset-depreciation.js') < htmlSource.indexOf('js/fixed-asset-depreciation-report.js'));
assert.ok(htmlSource.indexOf('js/fixed-asset-depreciation-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(htmlSource, /css\/fixed-asset-depreciation-report\.css/);
assert.match(serviceWorkerSource, /\.\/js\/fixed-asset-depreciation-report\.js/);
assert.match(serviceWorkerSource, /\.\/css\/fixed-asset-depreciation-report\.css/);
assert.match(serviceWorkerSource, /perfecto-static-v168/);
assert.match(cssSource, /\.fixed-asset-depreciation-table-wrap \{ width: 100%; max-width: 100%; min-width: 0; overflow-x: auto/);
assert.match(cssSource, /max-width: 640px[\s\S]*\.fixed-asset-depreciation-table \{ min-width: 660px; font-size: 6\.5pt/);
assert.match(cssSource, /body\.report-preview-printing[\s\S]*\.fixed-asset-depreciation-table/);

console.log('Amortissements : sous-menu, options de capture, sources, limites et aperçu plein écran vérifiés.');
