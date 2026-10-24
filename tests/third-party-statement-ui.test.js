/* Contrat d’intégration du Relevé de compte des tiers dans le sous-menu Tiers. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const Report = require('../modern-proto/js/third-party-statement-report.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-statement-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-statement');

assert.ok(child, 'Relevé de compte des tiers est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Relevé de compte des tiers');
assert.equal(child.status, 'active');
assert.match(child.reason, /cinq colonnes/i);
assert.match(child.reason, /aperçu plein écran/i);

assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), ['Date', 'Référence', 'Débit', 'Crédit', 'Libellé']);
assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));

assert.match(appSource, /var ThirdPartyStatementReport = window\.PerfectoThirdPartyStatementReport/);
assert.match(appSource, /function createThirdPartyStatementReportSession\([\s\S]*filters: \{[\s\S]*nature: 'clients', thirdParties: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd,[\s\S]*includeNonMoved: true/);
assert.match(appSource, /function buildThirdPartyStatementReport\([\s\S]*AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*entries, accounts, dossier/);
const builderStart = appSource.indexOf('function buildThirdPartyStatementReport');
const builderEnd = appSource.indexOf('function thirdPartyStatementColumns', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /thirdPartyMovements: extraction\.ok \? extraction\.movements : \[\]/);
assert.match(builder, /openingBalances: \[\]/);
assert.match(builder, /allThirdPartyRecords: allRecords/);
assert.doesNotMatch(builder, /record\.thirdParty\b/);
assert.match(appSource, /data-third-party-statement-include-non-moved/);
assert.match(appSource, /Lignes générées : ' \+ esc\(report\.ok \? report\.generatedLineCount : 0\)/);
assert.match(appSource, /Commentaire \(à gauche\)/);
assert.match(appSource, /Commentaire \(à droite\)/);
assert.match(appSource, /Parcourir…/);
assert.match(appSource, /function thirdPartyStatementReportLayoutView\([\s\S]*Imprimante[\s\S]*Style[\s\S]*Orientation[\s\S]*Marges[\s\S]*Première[\s\S]*Dernière[\s\S]*Parité[\s\S]*Destination/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyStatementPreview\([\s\S]*openReportPreview\('Aperçu — Relevé de compte des tiers'/);
assert.match(appSource, /function bindThirdPartyStatementReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyStatementPreview/);
assert.match(appSource, /child\.id === 'third-party-statement'\) return viewThirdPartyStatementReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-statement'\) bindThirdPartyStatementReport\(\)/);
assert.match(reportSource, /explicitThirdPartyReferencesOnly: true/);
assert.match(reportSource, /openingBalancesNotApplied: true/);
assert.match(reportSource, /nonMovedTiersAreHeadingsOnly: true/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/third-party-ledger-report.js') < htmlSource.indexOf('js/third-party-statement-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-statement-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-statement-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v129/);
assert.match(cssSource, /\.third-party-statement-filter-grid[\s\S]*\.third-party-statement-column-grid[\s\S]*\.third-party-statement-comments-grid/);
assert.match(cssSource, /\.third-party-statement-print\.is-mono-style[\s\S]*\.third-party-statement-print\.is-color-style/);
assert.match(cssSource, /\.report-preview-overlay\s*,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/);

console.log('Relevé de compte des tiers : navigation, sélection, sources, exports et aperçu plein écran vérifiés.');
