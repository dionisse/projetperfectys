/* Contrat d’intégration de la Situation des comptes tiers et de son aperçu plein écran. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-account-situation-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-situation');

assert.ok(child, 'Situation des comptes est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Situation des comptes');
assert.equal(child.status, 'active');
assert.match(child.reason, /date d’arrêté incluse/);
assert.match(child.reason, /aperçu plein écran/);

assert.match(appSource, /var ThirdPartyAccountSituationReport = window\.PerfectoThirdPartyAccountSituationReport/);
assert.match(appSource, /function createThirdPartyAccountSituationReportSession\([\s\S]*nature: 'clients', thirdParties: '\*', asOfDate: dossier\.cycleEnd[\s\S]*style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*destination: 'preview'/);
const builderStart = appSource.indexOf('function buildThirdPartyAccountSituationReport');
const builderEnd = appSource.indexOf('function thirdPartyAccountSituationColumnOption', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*S\.entries\(\), S\.accounts\(\), dossier/);
assert.match(builder, /ThirdPartyAccountSituationReport\.build\([\s\S]*journalLinesThirdPartyRecords\(session\.filters\.nature\)[\s\S]*asOfDate: session\.filters\.asOfDate/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.match(appSource, /third-party-account-situation-date[\s\S]*type="date"[\s\S]*min="' \+ esc\(dossier\.cycleStart\)[\s\S]*max="' \+ esc\(dossier\.cycleEnd\)/);
assert.deepEqual(require('../modern-proto/js/third-party-account-situation-report.js').COLUMN_DEFINITIONS.map(column => column.label), ['Code du tiers', 'Intitulé du tiers', 'Débit', 'Crédit']);
assert.match(appSource, /function thirdPartyAccountSituationLayoutView\([\s\S]*Imprimante par défaut de Windows[\s\S]*Sans couleurs, 8 points[\s\S]*Paysage[\s\S]*Standard[\s\S]*third-party-account-situation-page-first[\s\S]*third-party-account-situation-parity/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyAccountSituationPreview\([\s\S]*openReportPreview\('Aperçu — Position des tiers'/);
assert.match(appSource, /function bindThirdPartyAccountSituationReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyAccountSituationPreview/);
assert.match(appSource, /child\.id === 'third-party-situation'\) return viewThirdPartyAccountSituationReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-situation'\) bindThirdPartyAccountSituationReport\(\)/);
assert.match(reportSource, /from: cycleStart[\s\S]*to: asOfDate/);
assert.match(reportSource, /closingBalanceDebit[\s\S]*closingBalanceCredit/);
assert.match(reportSource, /positionAtDate: true[\s\S]*cutoffDateInclusive: true/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/third-party-balance-report.js') < htmlSource.indexOf('js/third-party-account-situation-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-account-situation-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-account-situation-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v132/);
assert.match(cssSource, /\.report-preview-overlay\s*,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/);
assert.match(cssSource, /\.third-party-account-situation-filter-grid[\s\S]*\.third-party-account-situation-column-grid[\s\S]*\.third-party-account-situation-table/);

console.log('Situation des comptes tiers : navigation, date, sources et aperçu plein écran vérifiés.');
