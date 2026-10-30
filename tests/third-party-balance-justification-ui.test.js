/* Contrat d’intégration de la Justification de solde dans le sous-menu Tiers. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const Report = require('../modern-proto/js/third-party-balance-justification-report.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-balance-justification-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-balance-justification');

assert.ok(child, 'Justification de solde est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Justification de solde');
assert.equal(child.status, 'active');
assert.match(child.reason, /identifiant\/code tiers explicite/i);
assert.match(child.reason, /aucun rapprochement facture\/règlement/i);

assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), ['Date', 'Compte général', 'Référence', 'Débit', 'Crédit', 'Libellé']);
assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.defaultSelected), [true, true, true, true, true, false]);

assert.match(appSource, /var ThirdPartyBalanceJustificationReport = window\.PerfectoThirdPartyBalanceJustificationReport/);
assert.match(appSource, /function createThirdPartyBalanceJustificationReportSession\([\s\S]*filters: \{ nature: 'clients', thirdParties: '\*', asOfDate: dossier\.cycleEnd/);
const builderStart = appSource.indexOf('function buildThirdPartyBalanceJustificationReport');
const builderEnd = appSource.indexOf('function thirdPartyBalanceJustificationColumns', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /AccountingCentralization\.extractValidatedAuxiliaryMovements/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.match(builder, /asOfDate: session\.filters\.asOfDate/);
assert.match(builder, /commentLeft: session\.filters\.commentLeft/);
assert.match(builder, /allThirdPartyRecords: allRecords/);
assert.doesNotMatch(builder, /record\.thirdParty\b/);
assert.doesNotMatch(appSource, /data-third-party-balance-justification-include-non-moved/);
assert.doesNotMatch(appSource, /third-party-balance-justification-line-count/);
const selectionStart = appSource.indexOf('function thirdPartyBalanceJustificationSelectionView');
const selectionEnd = appSource.indexOf('function syncThirdPartyBalanceJustificationSelection', selectionStart);
const selectionView = appSource.slice(selectionStart, selectionEnd);
assert.match(selectionView, /Nature des tiers[\s\S]*Tiers initial[\s\S]*Date d’arrêté[\s\S]*Colonnes à imprimer[\s\S]*Commentaire \(à gauche\)[\s\S]*Commentaire \(à droite\)/);
assert.doesNotMatch(selectionView, /Lignes générées|line-count|comptes non mouvementés/i);
assert.match(selectionView, /Parcourir…/);
assert.match(appSource, /function thirdPartyBalanceJustificationReportLayoutView\([\s\S]*Imprimante[\s\S]*Style[\s\S]*Orientation[\s\S]*Marges[\s\S]*Première[\s\S]*Dernière[\s\S]*Parité[\s\S]*Destination/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyBalanceJustificationPreview\([\s\S]*openReportPreview\('Aperçu — Justification de solde des tiers'/);
assert.match(appSource, /function bindThirdPartyBalanceJustificationReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyBalanceJustificationPreview/);
assert.match(appSource, /child\.id === 'third-party-balance-justification'\) return viewThirdPartyBalanceJustificationReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-balance-justification'\) bindThirdPartyBalanceJustificationReport\(\)/);
assert.match(reportSource, /openingReportsRequireExplicitThirdPartyReference: true/);
assert.match(reportSource, /freeTextTierFieldNeverUsed: true/);
assert.match(reportSource, /noRunningOrNetBalanceCalculated: true/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/third-party-ledger-report.js') < htmlSource.indexOf('js/third-party-balance-justification-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-balance-justification-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-balance-justification-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v157/);
assert.match(cssSource, /\.third-party-balance-justification-filter-grid[\s\S]*\.third-party-balance-justification-column-grid[\s\S]*\.third-party-balance-justification-comments-grid/);
assert.match(cssSource, /\.third-party-balance-justification-print\.is-mono-style[\s\S]*\.third-party-balance-justification-print\.is-color-style/);
assert.match(cssSource, /\.report-preview-overlay\s*,[\s\S]*position:\s*fixed[\s\S]*inset:\s*0/);

console.log('Justification de solde des tiers : navigation, filtres, sources, colonnes et aperçu plein écran vérifiés.');
