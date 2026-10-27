/* Contrat d’intégration du rapport Décomposition des soldes des tiers par nature. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const reportSource = fs.readFileSync(path.join(root, 'js', 'third-party-nature-breakdown-report.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'css', 'accounting-configuration.css'), 'utf8');
const tierTab = nav.getTab('editions', 'third-parties');
const child = tierTab.children.find(item => item.id === 'third-party-nature-breakdown');

assert.ok(child, 'la décomposition est dans le sous-menu Tiers');
assert.equal(tierTab.label, 'Tiers');
assert.equal(child.label, 'Décomposition des soldes par nature (clients/fournisseurs)');
assert.equal(child.status, 'active');
assert.match(child.reason, /cases à cocher/);
assert.match(child.reason, /reports explicitement liés/);

assert.match(appSource, /var ThirdPartyNatureBreakdownReport = window\.PerfectoThirdPartyNatureBreakdownReport/);
assert.match(appSource, /function createThirdPartyNatureBreakdownReportSession\([\s\S]*nature: 'suppliers', thirdParties: '\*', asOfDate: dossier\.cycleEnd[\s\S]*style: 'plain8', orientation: 'landscape', margins: 'standard'[\s\S]*destination: 'preview'/);
const builderStart = appSource.indexOf('function buildThirdPartyNatureBreakdownReport');
const builderEnd = appSource.indexOf('function thirdPartyNatureBreakdownColumnOption', builderStart);
const builder = appSource.slice(builderStart, builderEnd);
assert.match(builder, /AccountingCentralization\.extractValidatedAuxiliaryMovements\([\s\S]*S\.entries\(\), S\.accounts\(\), dossier/);
assert.match(builder, /accountNatureRows: accountNatures && accountNatures\.rows/);
assert.match(builder, /openingBalances: S\.openingBalances\(\)/);
assert.match(builder, /thirdPartyRecords: journalLinesThirdPartyRecords\(session\.filters\.nature\)/);
assert.doesNotMatch(builder, /S\.agedBalanceItems\(\)|record\.thirdParty\b/);
assert.match(appSource, /type="checkbox" data-third-party-nature-breakdown-nature/);
assert.match(appSource, /Cochez une seule case : compte client ou compte fournisseur/);
assert.match(appSource, /third-party-nature-breakdown-date[\s\S]*type="date"[\s\S]*min="' \+ esc\(dossier\.cycleStart\)[\s\S]*max="' \+ esc\(dossier\.cycleEnd\)/);
assert.deepEqual(require('../modern-proto/js/third-party-nature-breakdown-report.js').COLUMN_DEFINITIONS.map(column => column.label), [
  'Code du tiers', 'Intitulé du tiers', 'Avances et Avoirs', 'Factures non réglées',
  'Retenues de garantie', 'Créances provisionnées', 'Solde'
]);
assert.match(appSource, /function thirdPartyNatureBreakdownLayoutView\([\s\S]*Imprimante par défaut de Windows[\s\S]*Sans couleurs, 8 points[\s\S]*Paysage[\s\S]*Standard[\s\S]*third-party-nature-breakdown-page-first[\s\S]*third-party-nature-breakdown-parity/);
assert.match(appSource, /Télécharger un classeur Excel \(\.xlsx\)/);
assert.match(appSource, /Télécharger un fichier texte tabulé \(\.txt\)/);
assert.match(appSource, /function openThirdPartyNatureBreakdownPreview\([\s\S]*openReportPreview\('Aperçu — Décomposition des soldes des tiers'/);
assert.match(appSource, /function bindThirdPartyNatureBreakdownReport\([\s\S]*session\.phase === 'preview' && !session\.previewOpened[\s\S]*openThirdPartyNatureBreakdownPreview/);
assert.match(appSource, /child\.id === 'third-party-nature-breakdown'\) return viewThirdPartyNatureBreakdownReport\(backLink\)/);
assert.match(appSource, /menuParams\.g === 'editions' && menuParams\.t === 'third-parties' && menuParams\.c === 'third-party-nature-breakdown'\) bindThirdPartyNatureBreakdownReport\(\)/);
assert.match(reportSource, /CATEGORY_DEFINITIONS[\s\S]*customer-receivables[\s\S]*supplier-debts/);
assert.match(reportSource, /closingPositionAtDate: true[\s\S]*cutoffDateInclusive: true/);
assert.match(reportSource, /accountCategoriesFromDossierConfiguration: true/);
assert.doesNotMatch(reportSource, /record\.thirdParty\b/);
assert.ok(htmlSource.indexOf('js/third-party-balance-report.js') < htmlSource.indexOf('js/third-party-nature-breakdown-report.js'));
assert.ok(htmlSource.indexOf('js/third-party-nature-breakdown-report.js') < htmlSource.indexOf('js/app.js'));
assert.match(serviceWorkerSource, /\.\/js\/third-party-nature-breakdown-report\.js/);
assert.match(serviceWorkerSource, /perfecto-static-v136/);
assert.match(cssSource, /\.third-party-nature-breakdown-filter-grid[\s\S]*\.third-party-nature-breakdown-column-grid[\s\S]*\.third-party-nature-breakdown-table/);
assert.match(cssSource, /\.third-party-nature-breakdown-kind-options[\s\S]*\.third-party-nature-breakdown-nature-option/);

console.log('Décomposition des soldes des tiers : navigation, cases, sources et aperçu plein écran vérifiés.');
