/* États complémentaires des immobilisations : sources explicites uniquement. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/fixed-asset-additional-reports.js');

const accounts = [
  { code: '213000', label: 'Matériel informatique' },
  { code: '215000', label: 'Matériel industriel' }
];
const assets = [
  {
    id: 'asset-1', code: 'IMMO-001', name: 'Serveur', assetType: 'corporelle', status: 'en-service', assetAccountCode: '213000',
    accumulatedDepreciationAccountCode: '281300', depreciationExpenseAccountCode: '681300',
    acquisitionDate: '2025-03-10', commissioningDate: '2025-03-15', depreciationStartDate: '2025-04-01', grossCost: 1000000, residualValue: 50000,
    depreciationMethod: 'lineaire', usefulLifeMonths: 60, annualRatePercent: 20, locationId: 'loc-1',
    description: 'Salle informatique', serialNumber: 'SERIE-001'
  },
  {
    id: 'asset-2', code: 'IMMO-002', name: 'Machine', assetType: 'corporelle', status: 'en-cours', assetAccountCode: '299900',
    acquisitionDate: '2025-11-30', grossCost: 250000, residualValue: 0, depreciationMethod: 'a-definir',
    usefulLifeMonths: 0, annualRatePercent: 0, description: 'Atelier'
  },
  {
    id: 'asset-3', code: 'IMMO-003', name: 'Ancien équipement', assetType: 'corporelle', status: 'retiree', assetAccountCode: '213000',
    acquisitionDate: '2024-06-01', grossCost: 300000, residualValue: 0, depreciationMethod: 'aucun', commissioningDate: '2024-06-01'
  },
  {
    id: 'asset-4', code: 'IMMO-004', name: 'Outil sans coût', assetType: 'corporelle', status: 'en-cours', assetAccountCode: '215000',
    acquisitionDate: '2025-05-01', grossCost: '', residualValue: 0, depreciationMethod: 'a-definir', locationId: 'loc-1'
  }
];
const locations = [{ id: 'loc-1', code: 'LOC-A', name: 'Atelier principal' }];
const postedEntries = [
  { id: 'posted-1', status: 'posted', date: '2025-04-02', journal: 'ACH', reference: 'ACH-001', lines: [
    { account: '213000', debit: 1000000, credit: 0, fixedAssetCode: 'IMMO-001' },
    { account: '401000', debit: 0, credit: 1000000 },
    { account: '281300', debit: 0, credit: 0, fixedAssetCode: 'IMMO-001' }
  ] },
  { id: 'posted-2', status: 'posted', date: '2025-05-02', journal: 'OD', reference: 'OD-002', lines: [
    { account: '299900', debit: 1000, credit: 0, fixedAssetCode: 'IMMO-002' }
  ] },
  { id: 'posted-unlinked', status: 'posted', date: '2025-05-03', journal: 'OD', reference: 'OD-003', lines: [
    { account: '213000', debit: 900, credit: 0, label: 'Serveur IMMO-001' }
  ] },
  { id: 'draft-1', status: 'draft', date: '2025-05-04', journal: 'ACH', reference: 'ACH-D', lines: [
    { account: '213000', debit: 90, credit: 0, fixedAssetCode: 'IMMO-001' }
  ] }
];

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', accountFilter: '*',
    elementFilter: '*', locationFilter: '*', from: '2025-01-01', to: '2025-12-31', date: '2025-12-31',
    accounts, assets, locations, entries: postedEntries
  }, overrides);
}

function test(name, fn) {
  try { fn(); console.log('  ✓ ' + name); }
  catch (error) { console.error('  ✗ ' + name); console.error('    ' + error.stack); process.exitCode = 1; }
}

console.log('États complémentaires des immobilisations · filtres, sources et limites');

test('expose les neuf fenêtres avec libellés, filtres et colonnes de la capture', () => {
  assert.equal(Reports.REPORT_IDS.length, 9);
  const expected = {
    'edition-fixed-asset-entries': ['Entrées d’immobilisations', ['accounts', 'from', 'to'], ['Code élément', 'Date d’entrée', 'Taux d’Amort.', 'Intitulé élément', 'Valeur brute']],
    'edition-fixed-asset-inventory-sheets': ['Fiche d’immobilisation', ['accounts', 'elements'], null],
    'edition-fixed-asset-ledger': ['Grand-livre des éléments immobilisés', ['accounts', 'elements', 'from', 'to'], ['Journal', 'Pièce', 'Amortissement', 'Date', 'Valeur brute', 'Valeur nette']],
    'edition-fixed-asset-transfers': ['Virements des éléments immobilisés', ['accounts'], ['Élément', 'Amortissements', 'Intitulé', 'Valeur nette', 'Date d’entrée', 'Compte de destination', 'Valeur brute']],
    'edition-fixed-asset-locations-inventory': ['Immobilisations par localisations', ['locations', 'accounts', 'date'], ['Date d’entrée', 'Compte', 'Code élément', 'Intitulé élément', 'Code matériel', 'Taux d’amortissement', 'Valeur brute', 'Amortissements', 'Valeur nette', 'État', 'Description']],
    'edition-fixed-asset-opening-discrepancies': ['Écarts à l’ouverture avec la comptabilité générale', ['accounts'], ['Compte', 'Intitulé', 'Valeur brute', 'Amortissements', 'Écarts']],
    'edition-fixed-asset-exits': ['Sorties des éléments immobilisés', ['accounts', 'from', 'to'], ['Code élément', 'Amortissements', 'Intitulé élément', 'Date et valeur de sortie', 'Date et valeur d’entrée']],
    'edition-fixed-asset-account-totals': ['Cumul des éléments immobilisés', ['accounts', 'date'], ['Code du compte', 'Nombre d’éléments', 'Amortissement', 'Intitulé du compte', 'Valeur brute', 'Valeur nette']],
    'edition-fixed-asset-period-discrepancies': ['Écarts de la période entre Comptabilité et Tableau des immobilisations', ['accounts', 'date'], ['Compte', 'Amortissements', 'Valeur brute']]
  };
  Object.entries(expected).forEach(([id, [title, filters, labels]]) => {
    const definition = Reports.definitionFor(id);
    assert.ok(definition, id);
    assert.equal(definition.title, title);
    assert.deepEqual(definition.filters, filters);
    if (labels) assert.deepEqual(definition.columns.map(column => column.label), labels);
    else assert.equal(definition.showColumns, false, 'aucun choix de colonnes n’est affiché pour la fiche');
    assert.ok(definition.columns.every(column => column.defaultSelected));
  });
  assert.equal(Reports.definitionFor('unknown'), null);
});

test('les entrées suivent la date d’acquisition et couvrent tous les comptes sans restriction 93–99', () => {
  const report = Reports.buildReport('edition-fixed-asset-entries', options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.assetCode), ['IMMO-001', 'IMMO-004', 'IMMO-002']);
  assert.equal(report.rows[0].grossValue, 1000000);
  assert.equal(report.rows[0].depreciationRate, '20 %');
  assert.equal(report.rows.find(row => row.assetCode === 'IMMO-004').grossValue, '', 'coût absent conservé vide');
  assert.equal(report.basis.accountFilterIncludesCurrentAndFutureCodes, true);
  assert.equal(report.basis.noAccountingMutation, true);
  const futureAccount = Reports.buildReport('edition-fixed-asset-entries', options({ accountFilter: '2999*' }));
  assert.deepEqual(futureAccount.rows.map(row => row.assetCode), ['IMMO-002']);
  assert.equal(Reports.buildReport('edition-fixed-asset-entries', options({ from: '2025-11-01', to: '2025-12-31' })).rows.length, 1);
});

test('la fiche restitue les champs enregistrés sans assimiler valeur résiduelle, VNC ou numéro de série', () => {
  const report = Reports.buildReport('edition-fixed-asset-inventory-sheets', options({ elementFilter: 'IMMO-00*' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  const asset = report.rows.find(row => row.assetCode === 'IMMO-001');
  assert.equal(asset.grossValue, 1000000);
  assert.equal(asset.residualValue, 50000);
  assert.equal(asset.depreciationMethod, 'Linéaire');
  assert.equal(asset.accumulatedDepreciationAccountCode, '281300');
  assert.equal(asset.depreciationExpenseAccountCode, '681300');
  assert.equal(asset.commissioningDate, '2025-03-15');
  assert.equal(asset.depreciationStartDate, '2025-04-01');
  assert.equal(asset.serialNumber, 'SERIE-001');
  assert.equal(Object.hasOwn(asset, 'materialCode'), false);
  assert.equal(asset.netValue, '');
  assert.match(report.warnings.join(' '), /valeur résiduelle saisie/i);
  assert.match(report.warnings.join(' '), /n’est pas transformé en Code matériel/i);
});

test('les localisations utilisent uniquement le lien locationId explicite et la date d’arrêté', () => {
  const all = Reports.buildReport('edition-fixed-asset-locations-inventory', options());
  assert.equal(all.ok, true, all.errors.join(' '));
  assert.deepEqual(all.rows.map(row => row.assetCode), ['IMMO-001', 'IMMO-004', 'IMMO-003', 'IMMO-002']);
  assert.equal(all.rows[0].locationCode, 'LOC-A');
  assert.equal(all.rows[0].grossValue, 1000000);
  assert.equal(all.rows[0].depreciation, '');
  assert.equal(all.rows[0].netValue, '');
  assert.equal(all.rows[0].materialCode, undefined);
  assert.match(all.warnings.join(' '), /2 fiche\(s\) sans localisation/i);
  assert.match(all.warnings.join(' '), /marquée\(s\) « Retirée » restent prises en compte/i);
  const selected = Reports.buildReport('edition-fixed-asset-locations-inventory', options({ locationFilter: 'LOC-A', date: '2025-06-01' }));
  assert.deepEqual(selected.rows.map(row => row.assetCode), ['IMMO-001', 'IMMO-004']);
  assert.equal(selected.rows.some(row => row.assetCode === 'IMMO-002'), false, 'élément acquis après l’arrêté exclu');
});

test('le cumul est limité au compte : nombre de fiches et somme des coûts explicites, sans amortissement/VNC', () => {
  const report = Reports.buildReport('edition-fixed-asset-account-totals', options());
  assert.equal(report.ok, true, report.errors.join(' '));
  const byAccount = Object.fromEntries(report.rows.map(row => [row.accountCode, row]));
  assert.deepEqual([byAccount['213000'].count, byAccount['213000'].grossValue], [2, 1300000]);
  assert.deepEqual([byAccount['299900'].count, byAccount['299900'].grossValue], [1, 250000]);
  assert.deepEqual([byAccount['215000'].count, byAccount['215000'].grossValue], [1, '']);
  assert.equal(byAccount['213000'].depreciation, '');
  assert.equal(byAccount['213000'].netValue, '');
  assert.equal(report.totals, null, 'aucun total général non demandé n’est fabriqué');
  assert.match(report.warnings.join(' '), /somme des coûts d’acquisition enregistrés/i);
  assert.match(report.warnings.join(' '), /marquée\(s\) « Retirée » restent prises en compte/i);
});

test('le grand-livre n’inclut que les écritures validées portant une référence explicite à une fiche', () => {
  const report = Reports.buildReport('edition-fixed-asset-ledger', options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 2);
  assert.deepEqual(report.rows.map(row => row.assetCode), ['IMMO-001', 'IMMO-002']);
  assert.equal(report.rows[0].journal, 'ACH');
  assert.equal(report.rows[0].piece, 'ACH-001');
  assert.equal(report.rows[0].date, '2025-04-02');
  assert.equal(report.rows[0].grossValue, '');
  assert.equal(report.rows[0].depreciation, '');
  assert.equal(report.rows[0].netValue, '');
  assert.equal(report.basis.explicitLedgerLinksRead, 2);
  assert.match(report.warnings.join(' '), /code d’immobilisation explicite/i);
  assert.match(report.warnings.join(' '), /ventilation par fiche vérifiable/i);
  assert.equal(report.rows.some(row => row.piece === 'OD-003'), false, 'le code présent uniquement dans un libellé n’est pas un lien');
  assert.equal(report.rows.some(row => row.piece === 'ACH-D'), false, 'les brouillons sont exclus');
  const duplicateAssets = assets.concat([Object.assign({}, assets[0], { id: 'asset-duplicate' })]);
  const ambiguous = Reports.buildReport('edition-fixed-asset-ledger', options({ assets: duplicateAssets, entries: [postedEntries[0]] }));
  assert.deepEqual(ambiguous.rows, [], 'un code dupliqué ne désigne pas arbitrairement une fiche');
  assert.match(ambiguous.warnings.join(' '), /référence explicite ambiguë/i);
});

test('les virements, sorties et écarts sans registre source restent sans lignes', () => {
  [
    ['edition-fixed-asset-transfers', /pas d’historique explicite de virements/i],
    ['edition-fixed-asset-exits', /aucun registre de sorties/i],
    ['edition-fixed-asset-opening-discrepancies', /soldes d’ouverture comptables ne sont pas rapprochés/i],
    ['edition-fixed-asset-period-discrepancies', /ne fournit pas de mouvements de la période/i]
  ].forEach(([id, warning]) => {
    const report = Reports.buildReport(id, options());
    assert.equal(report.ok, true, report.errors.join(' '));
    assert.deepEqual(report.rows, [], id);
    assert.equal(report.generatedLineCount, 0);
    assert.equal(report.dataAvailable, false);
    assert.match(report.warnings.join(' '), warning);
    assert.equal(report.basis.noUnsupportedAmountsOrDiscrepanciesCalculated, true);
  });
});

test('valide les périodes du cycle et les filtres de codes sans élargir leur portée', () => {
  assert.equal(Reports.buildReport('edition-fixed-asset-entries', options({ from: '2025-12-31', to: '2025-01-01' })).ok, false);
  assert.equal(Reports.buildReport('edition-fixed-asset-entries', options({ from: '' })).ok, false);
  assert.equal(Reports.buildReport('edition-fixed-asset-account-totals', options({ date: '' })).ok, false);
  assert.equal(Reports.buildReport('edition-fixed-asset-account-totals', options({ date: '2026-01-01' })).ok, false);
  assert.equal(Reports.buildReport('edition-fixed-asset-inventory-sheets', options({ elementFilter: '' })).ok, false);
  assert.equal(Reports.buildReport('edition-fixed-asset-locations-inventory', options({ locationFilter: 'LOC-*' })).rows.length, 2);
  assert.equal(Reports.parseCodeFilter('IMMO-00*', 'Éléments').valid, true);
  assert.equal(Reports.parseCodeFilter('LOC-*', 'Localisations').valid, true);
  assert.equal(Reports.parseCodeFilter('LOC-*;OTHER-1', 'Localisations').valid, true);
  assert.equal(Reports.parseCodeFilter('LOC-**', 'Localisations').valid, false);
});

console.log('Immobilisations complémentaires : 9 fenêtres, filtres, références explicites et limites de calcul contrôlés.');
