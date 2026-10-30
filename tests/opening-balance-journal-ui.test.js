/* Contrat d’intégration du Journal des reports dans Comptes généraux. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const sourceReport = fs.readFileSync(path.join(root, 'js', 'opening-balance-report.js'), 'utf8');
const journalReport = fs.readFileSync(path.join(root, 'js', 'opening-balance-journal-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const configurationCss = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const child = nav.getTab('editions', 'general-accounts').children.find(item => item.id === 'general-opening-journal');

assert.ok(child, 'Journal des reports est présent sous Comptes généraux');
assert.equal(child.label, 'Journal des reports');
assert.equal(child.status, 'active');
assert.match(child.reason, /registre Reports à nouveau/);
assert.match(child.reason, /date de lettrage et les montants d’origine en devise restent vides/);

assert.match(appSource, /var OpeningBalanceJournalReport = window\.PerfectoOpeningBalanceJournalReport/);
assert.match(appSource, /function buildOpeningBalanceJournalReport\(session\)[\s\S]*OpeningBalanceJournalReport\.build\([\s\S]*openingBalances: S\.openingBalances\(\)[\s\S]*sourceDate: S\.expectedOpeningBalanceDate\(\)/);
const builder = appSource.slice(appSource.indexOf('function buildOpeningBalanceJournalReport'), appSource.indexOf('function openingBalanceJournalColumnOption'));
assert.doesNotMatch(builder, /postedEntries|entries:/, 'le parcours lit uniquement le registre Reports à nouveau');
assert.match(appSource, /function openingBalanceJournalReportSelectionView\([\s\S]*value="' \+ esc\(session\.filters\.accounts\)[\s\S]*opening-journal-column-grid[\s\S]*Date lettrage[\s\S]*Montant en devise/);
assert.match(appSource, /function createOpeningBalanceJournalReportSession\([\s\S]*filters: \{ accounts: '\*' \}[\s\S]*printer: 'system', style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*pageFirst: '', pageLast: '', parity: 'none', destination: 'preview'/);
assert.match(appSource, /data-opening-journal-column="' \+ esc\(column\.key\)[\s\S]*unsupported \? ' aria-describedby=/);
const columnOption = appSource.slice(appSource.indexOf('function openingBalanceJournalColumnOption'), appSource.indexOf('function openingBalanceJournalReportSelectionView'));
assert.doesNotMatch(columnOption, /disabled/, 'les colonnes indisponibles restent masquables, leurs cellules ne sont que vides');
assert.match(appSource, /function openingBalanceJournalReportExportMatrix\([\s\S]*openingBalanceJournalReportLeafColumns\(session\)[\s\S]*report\.rows\.map/);
assert.match(appSource, /function openingBalanceJournalReportPrintableHtml\([\s\S]*Journal des reports[\s\S]*registre Reports à nouveau[\s\S]*date de lettrage ni de montant d’origine en devise/);
assert.match(appSource, /child\.id === 'general-opening-journal'\) return viewOpeningBalanceJournalReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'general-accounts' && menuParams\.c === 'general-opening-journal'\) bindOpeningBalanceJournalReport\(\)/);
assert.match(journalReport, /letteringDate: ''[\s\S]*currencyAmount: ''/);
assert.match(journalReport, /journalEntriesUsed: false[\s\S]*foreignCurrencyAmountsAvailable: false/);
assert.match(sourceReport, /sourceRecords: selectedRecords\.map\(function \(record\) \{ return Object\.assign\(\{\}, record\); \}\)/);
assert.ok(htmlSource.indexOf('js/opening-balance-report.js') < htmlSource.indexOf('js/opening-balance-journal-report.js'));
assert.ok(htmlSource.indexOf('js/opening-balance-journal-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/opening-balance-journal-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v154/);
assert.match(configurationCss, /\.opening-journal-column-grid[\s\S]*\.opening-journal-column-placeholder-stack/);

console.log('Journal des reports : intégration navigation, colonnes et parcours vérifiée.');
