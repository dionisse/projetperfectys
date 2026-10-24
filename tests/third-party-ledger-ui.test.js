/* Contrat d’intégration du Grand livre dans le sous-menu Tiers. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const Report = require('../modern-proto/js/third-party-ledger-report.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-ledger-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-ledger');

assert.ok(child, 'Grand livre est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Grand livre');
assert.equal(child.status, 'active');
assert.match(child.reason, /onze colonnes/i);
assert.match(child.reason, /aperçu plein écran/i);

assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
  'Date', 'Journal', 'Pièce', 'Compte général', 'Référence', 'Débit', 'Crédit', 'Solde', 'Marché', 'Libellé', 'Contrepartie'
]);
assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));

assert.match(appSource, /var ThirdPartyLedgerReport = window\.PerfectoThirdPartyLedgerReport/);
assert.match(appSource, /function createThirdPartyLedgerReportSession\([\s\S]*filters: \{ nature: 'clients', thirdParties: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd \}[\s\S]*previewOpened: false/);
const builderStart = appSource.indexOf('function buildThirdPartyLedgerReport');
const builderEnd = appSource.indexOf('function thirdPartyLedgerColumnOption', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*entries, accounts, dossier/);
assert.match(builder, /thirdPartyMovements: extraction\.ok \? extraction\.movements : \[\]/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.match(builder, /allThirdPartyRecords: allRecords/);
assert.doesNotMatch(builder, /record\.thirdParty\b/);
assert.match(appSource, /function thirdPartyLedgerAllRecords\([\s\S]*append\('other-parties', S\.otherParties\(\)\)/);
assert.match(appSource, /type="date" value="' \+ esc\(session\.filters\.from\) \+ '" min="' \+ esc\(dossier\.cycleStart\)[\s\S]*type="date" value="' \+ esc\(session\.filters\.to\) \+ '" min="' \+ esc\(dossier\.cycleStart\)/);
assert.match(appSource, /name="thirdParties" type="text" value="' \+ esc\(session\.filters\.thirdParties\) \+ '" placeholder="\*"/);
assert.match(appSource, /Parcourir…/);
assert.match(appSource, /data-third-party-ledger-column=/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyLedgerPreview\([\s\S]*openReportPreview\('Aperçu — Grand livre des tiers'/);
assert.match(appSource, /function bindThirdPartyLedgerReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyLedgerPreview/);
assert.match(appSource, /child\.id === 'third-party-ledger'\) return viewThirdPartyLedgerReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-ledger'\) bindThirdPartyLedgerReport\(\)/);
assert.match(reportSource, /priorPeriodMovementsIncludedInRunningBalance: true/);
assert.match(reportSource, /counterpartFromOtherAccountsInSameEntry: true/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/third-party-balance-report.js') < htmlSource.indexOf('js/third-party-ledger-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-ledger-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-ledger-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v123/);
assert.match(cssSource, /\.third-party-ledger-filter-grid[\s\S]*\.third-party-ledger-column-grid[\s\S]*\.third-party-ledger-table/);
assert.match(cssSource, /\.report-preview-content \.third-party-ledger-print[\s\S]*font-size:\s*8pt/);
assert.match(cssSource, /\.report-preview-overlay\s*,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/);

console.log('Grand livre des tiers : navigation, sélection, sources, exports et aperçu plein écran vérifiés.');
