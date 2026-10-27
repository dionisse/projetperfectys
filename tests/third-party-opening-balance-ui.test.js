/* Contrat d’intégration de la Balance d’ouverture des tiers et de son aperçu plein écran. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-opening-balance-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-opening-balance');

assert.ok(child, 'Balance d’ouverture est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Balance d’ouverture');
assert.equal(child.status, 'active');
assert.match(child.reason, /registre Reports à nouveau/);
assert.match(child.reason, /explicitement reliées/);

assert.match(appSource, /var ThirdPartyOpeningBalanceReport = window\.PerfectoThirdPartyOpeningBalanceReport/);
assert.match(appSource, /function createThirdPartyOpeningBalanceReportSession\([\s\S]*nature: 'clients', thirdParties: '\*'[\s\S]*style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*destination: 'preview'/);
assert.match(appSource, /function buildThirdPartyOpeningBalanceReport\([\s\S]*OpeningBalanceReport\.build|ThirdPartyOpeningBalanceReport\.build/);
const builderStart = appSource.indexOf('function buildThirdPartyOpeningBalanceReport');
const builderEnd = appSource.indexOf('function thirdPartyOpeningBalanceColumnOption', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /journalLinesThirdPartyRecords\(session\.filters\.nature\)/);
assert.match(builder, /accounts: S\.accounts\(\)/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.match(builder, /sourceDate: S\.expectedOpeningBalanceDate\(\)/);
assert.doesNotMatch(builder, /S\.entries\(\)|S\.agedBalanceItems\(\)/);
assert.match(appSource, /third-party-opening-balance-nature[\s\S]*third-party-opening-balance-parties[\s\S]*Lignes générées/);
assert.match(appSource, /function thirdPartyOpeningBalanceReportLayoutView\([\s\S]*Imprimante par défaut de Windows[\s\S]*Sans couleurs, 8 points[\s\S]*Paysage[\s\S]*Standard[\s\S]*third-party-opening-balance-page-first[\s\S]*third-party-opening-balance-parity/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyOpeningBalanceReportPreview\([\s\S]*openReportPreview\('Aperçu — Balance d’ouverture des tiers'/);
assert.match(appSource, /function bindThirdPartyOpeningBalanceReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyOpeningBalanceReportPreview/);
assert.match(appSource, /child\.id === 'third-party-opening-balance'\) return viewThirdPartyOpeningBalanceReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-opening-balance'\) bindThirdPartyOpeningBalanceReport\(\)/);
assert.match(reportSource, /OpeningBalanceReport\.build\([\s\S]*openingBalances: candidateOpeningBalances/);
assert.match(reportSource, /record\.thirdPartyId, record\.thirdPartyCode, record\.auxiliaryCode/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.match(reportSource, /explicitThirdPartyReferenceRequired: true[\s\S]*unlinkedOpeningBalancesExcluded: true/);
assert.ok(htmlSource.indexOf('js/opening-balance-report.js') < htmlSource.indexOf('js/third-party-opening-balance-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-opening-balance-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-opening-balance-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v135/);
assert.match(cssSource, /\.report-preview-overlay\s*,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/);
assert.match(cssSource, /\.third-party-opening-balance-filter-grid[\s\S]*\.third-party-opening-balance-column-grid[\s\S]*\.third-party-opening-balance-table/);

console.log('Balance d’ouverture des tiers : navigation, parcours, sources et aperçu plein écran vérifiés.');
