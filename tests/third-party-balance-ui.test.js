/* Contrat d’intégration de la Balance des tiers au menu Éditions. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-balance-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-balance');

assert.ok(child, 'Balance des tiers est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(tierTab.status, 'mixed');
assert.equal(child.label, 'Balance des tiers');
assert.equal(child.status, 'active');
assert.match(child.reason, /écritures validées/);
assert.match(child.reason, /référence auxiliaire explicite/);

assert.match(appSource, /var ThirdPartyBalanceReport = window\.PerfectoThirdPartyBalanceReport/);
assert.match(appSource, /function createThirdPartyBalanceReportSession\([\s\S]*nature: 'clients', thirdParties: '\*', from: dossier\.cycleStart, to: dossier\.cycleEnd[\s\S]*printer: 'system', style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*pageFirst: '', pageLast: '', parity: 'none', destination: 'preview'/);
const builderStart = appSource.indexOf('function buildThirdPartyBalanceReport');
const builderEnd = appSource.indexOf('function thirdPartyBalanceColumnOption', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*S\.entries\(\), S\.accounts\(\), dossier/);
assert.match(builder, /thirdPartyRecords: journalLinesThirdPartyRecords\(session\.filters\.nature\)/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.doesNotMatch(builder, /S\.agedBalanceItems\(\)|thirdPartyMovements: S\.entries\(\)/);
assert.match(appSource, /Nature des tiers[\s\S]*data-third-party-balance-parties-label[\s\S]*Début[\s\S]*Fin[\s\S]*Colonnes à imprimer/);
assert.match(appSource, /function thirdPartyBalanceReportLayoutView\([\s\S]*Imprimante par défaut de Windows[\s\S]*Sans couleurs, 8 points[\s\S]*Paysage[\s\S]*Standard/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /Aperçu obligatoire avant impression/);
assert.match(appSource, /function thirdPartyBalanceExportMatrix\([\s\S]*rows\.push\(columns\.map[\s\S]*return 'Totaux'/);
assert.match(appSource, /Plage demandée :[\s\S]*pages impaires[\s\S]*à régler dans le navigateur/);
assert.match(appSource, /function thirdPartyBalanceReportPrintOptions\([\s\S]*@page \{ size: A4/);
assert.match(appSource, /if \(child\.id === 'third-party-balance'\) return viewThirdPartyBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-balance'\) bindThirdPartyBalanceReport\(\)/);
assert.match(reportSource, /openingReportsRequireExplicitThirdPartyReference: true/);
assert.match(reportSource, /record\.thirdPartyId, record\.thirdPartyCode, record\.auxiliaryCode/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/aged-balance-report.js') < htmlSource.indexOf('js/third-party-balance-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-balance-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-balance-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v157/);
assert.match(cssSource, /\.third-party-balance-filter-grid[\s\S]*\.third-party-balance-column-grid[\s\S]*\.third-party-balance-table/);

console.log('Balance des tiers : intégration navigation, parcours et ressources vérifiée.');
