/* Contrat d’intégration de l’édition pluriannuelle dans le menu et ses écrans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'multiyear-history-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const configurationCss = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');

const child = nav.getTab('editions', 'general-accounts').children.find(item => item.id === 'general-multiyear-history');
assert.ok(child, 'l’édition est présente sous Comptes généraux');
assert.equal(child.status, 'active');
assert.match(child.reason, /même client et du même type comptable/);

assert.match(appSource, /var MultiYearHistoryReport = window\.PerfectoMultiYearHistoryReport/);
assert.match(appSource, /function multiYearHistorySourceContext\([\s\S]*permittedDemoDossiers[\s\S]*S\.readDossierStateSnapshot[\s\S]*S\.visibleState\(\)/,
  'les dossiers historiques lisibles sont utilisés sans changer le dossier actif');
assert.doesNotMatch(appSource.slice(appSource.indexOf('function multiYearHistorySourceContext'), appSource.indexOf('function createMultiYearHistoryReportSession')),
  /switchDossier|switchFolder/);
assert.match(appSource, /function buildMultiYearHistoryReport\([\s\S]*MultiYearHistoryReport\.build[\s\S]*startExercise: session\.filters\.startExercise[\s\S]*accountFilter: session\.filters\.accounts/);
assert.match(appSource, /function createMultiYearHistoryReportSession\([\s\S]*printer: 'system', style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*pageFirst: '', pageLast: '', parity: 'none', destination: 'preview'/);
assert.match(appSource, /function multiYearHistoryReportSelectionView\([\s\S]*Exercice de début[\s\S]*multi-year-history-column-grid[\s\S]*Lignes générées/);
assert.match(appSource, /function multiYearHistoryLayoutView\([\s\S]*multi-year-history-orientation[\s\S]*multi-year-history-margins[\s\S]*multi-year-history-page-first[\s\S]*multi-year-history-parity[\s\S]*multi-year-history-destination/);
assert.match(appSource, /function multiYearHistoryExportMatrix\([\s\S]*multiYearHistoryReportColumns\(session\)[\s\S]*multiYearHistoryReportValue/);
assert.match(appSource, /child\.id === 'general-multiyear-history'\) return viewMultiYearHistoryReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-multiyear-history'\) bindMultiYearHistoryReport\(\)/);
assert.match(reportSource, /openingBalancesUsedPerExercise: true[\s\S]*noOpeningBalanceDoubleCount: true[\s\S]*noAccountingMutation: true/);
assert.match(reportSource, /dossiersIsolatedByClientAndAccountingType: true/);
assert.ok(htmlSource.indexOf('js/general-ledger-report.js') < htmlSource.indexOf('js/multiyear-history-report.js'));
assert.ok(htmlSource.indexOf('js/multiyear-history-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/multiyear-history-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v119/);
assert.match(configurationCss, /\.multi-year-history-column-grid[\s\S]*\.multi-year-history-table[\s\S]*multi-year-history-report-print/);

console.log('Historique pluriannuel : intégration navigation, écrans et ressources vérifiée.');
