/* Tableau des amortissements : colonnes de capture et valeurs réellement présentes au registre. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/fixed-asset-depreciation-report.js');

const accounts = [
  { code: '213000', label: 'Matériel informatique' },
  { code: '218000', label: 'Autres immobilisations corporelles' },
  { code: '242000', label: 'Matériel' }
];

const assets = [
  {
    id: 'ASSET-LINEAR', code: 'IMMO-0001', name: 'Ordinateur comptable', assetAccountCode: '213000',
    acquisitionDate: '2024-12-15', annualRatePercent: 20, grossCost: 850000,
    depreciationMethod: 'lineaire', status: 'en-service', serialNumber: 'SERIE-NON-RESTITUEE'
  },
  {
    id: 'ASSET-DEGRESSIVE', code: 'IMMO-0002', name: 'Serveur', assetAccountCode: '213000',
    acquisitionDate: '2025-06-20', annualRatePercent: 25, grossCost: 350000,
    depreciationMethod: 'degressif', status: 'en-service'
  },
  {
    id: 'ASSET-NONE', code: 'IMMO-0003', name: 'Terrain', assetAccountCode: '218000',
    acquisitionDate: '2025-01-05', annualRatePercent: 0, grossCost: 250000,
    depreciationMethod: 'aucun', status: 'en-service'
  },
  {
    id: 'ASSET-UNDEFINED', code: 'IMMO-0004', name: 'Méthode à confirmer', assetAccountCode: '218000',
    acquisitionDate: '2025-03-01', annualRatePercent: 0, grossCost: 450000,
    depreciationMethod: 'a-definir', status: 'en-service'
  },
  {
    id: 'ASSET-RETIRED', code: 'IMMO-0005', name: 'Bien retiré', assetAccountCode: '218000',
    acquisitionDate: '2023-05-01', annualRatePercent: 10, grossCost: 50000,
    depreciationMethod: 'lineaire', status: 'retiree'
  },
  {
    id: 'ASSET-FUTURE', code: 'IMMO-0006', name: 'Élément futur', assetAccountCode: '213000',
    acquisitionDate: '2026-01-01', annualRatePercent: 10, grossCost: 100000,
    depreciationMethod: 'lineaire', status: 'en-service'
  },
  {
    id: 'ASSET-INVALID-DATE', code: 'IMMO-0007', name: 'Date absente', assetAccountCode: '213000',
    acquisitionDate: '', annualRatePercent: '', grossCost: 12000,
    depreciationMethod: 'lineaire', status: 'en-service'
  },
  {
    id: 'ASSET-OUTSIDE-ACCOUNT', code: 'IMMO-0008', name: 'Autre compte', assetAccountCode: '242000',
    acquisitionDate: '2025-07-01', annualRatePercent: 5, grossCost: 90000,
    depreciationMethod: 'lineaire', status: 'en-service'
  }
];

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    accountFilter: '*',
    from: '2025-01-01',
    to: '2025-12-31',
    includeWithDepreciation: true,
    includeWithoutDepreciation: false,
    includeNetValueNonzero: true,
    includeNetValueZero: false,
    includeExits: true,
    accounts,
    assets
  }, overrides);
}

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.stack);
    process.exitCode = 1;
  }
}

console.log('Tableau des amortissements · champs explicites, sélections et absence de calcul');

test('expose les sept colonnes de la capture, toutes cochées par défaut', () => {
  const definition = Reports.definitionFor(Reports.REPORT_ID);
  assert.equal(definition.title, 'Tableau des amortissements');
  assert.deepEqual(definition.filters, ['accounts', 'from', 'to']);
  assert.deepEqual(definition.columns.map(column => column.label), [
    'Code élément', 'Intitulé élément', 'Date d’entrée', 'Taux d’Amort.',
    'Valeur brute', 'Amortissement', 'Valeur nette'
  ]);
  assert.ok(definition.columns.every(column => column.defaultSelected));
  assert.deepEqual(definition.elementFilters.map(filter => [filter.label, filter.defaultSelected, filter.available]), [
    ['Valeur nette non nulle', true, false],
    ['Valeur nette nulle', false, false],
    ['Avec amortissement', true, true],
    ['Sans amortissement', false, true],
    ['Avec les sorties', true, false]
  ]);
  assert.equal(Reports.definitionFor('unknown'), null);
});

test('restitue les données explicites et garde amortissement et valeur nette vides', () => {
  const report = Reports.buildReport(options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.assetCode), ['IMMO-0001', 'IMMO-0002', 'IMMO-0007', 'IMMO-0005', 'IMMO-0008']);
  const linear = report.rows.find(row => row.assetCode === 'IMMO-0001');
  assert.equal(linear.entryDate, '2024-12-15', 'les fiches antérieures au début restent sélectionnables');
  assert.equal(linear.assetName, 'Ordinateur comptable');
  assert.equal(linear.accountLabel, 'Matériel informatique');
  assert.equal(linear.depreciationRate, '20 %', 'le taux explicite est repris sans le recalculer');
  assert.equal(linear.grossValue, 850000, 'la valeur brute reprend le coût enregistré');
  assert.equal(linear.depreciation, '');
  assert.equal(linear.netValue, '');
  assert.equal(report.rows.find(row => row.assetCode === 'IMMO-0007').entryDateValid, false);
  assert.deepEqual(report.displayAccounts.map(account => account.code), ['213000', '218000', '242000']);
  assert.equal(report.generatedLineCount, 5);
  assert.equal(report.totals, null);
  assert.equal(report.basis.grossValueFromRecordedGrossCost, true);
  assert.equal(report.basis.netValuePerAssetAvailable, false);
  assert.equal(report.basis.accumulatedDepreciationSourceAvailable, false);
  assert.equal(report.basis.noDepreciationOrNetValueCalculated, true);
  assert.equal(report.basis.noIndicativeSimulationRun, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.match(report.warnings.join(' '), /Amortissement et Valeur nette restent vides/i);
  assert.match(report.warnings.join(' '), /aucune date de sortie/i);
  assert.match(report.warnings.join(' '), /à définir.*restent exclues/i);
  assert.doesNotMatch(JSON.stringify(report.rows), /SERIE-NON-RESTITUEE/);
});

test('le filtre de comptes est appliqué et le choix Sans amortissement utilise la méthode explicite', () => {
  const accountFiltered = Reports.buildReport(options({ accountFilter: '213*', from: '2025-06-01' }));
  assert.equal(accountFiltered.ok, true, accountFiltered.errors.join(' '));
  assert.deepEqual(accountFiltered.rows.map(row => row.assetCode), ['IMMO-0001', 'IMMO-0002', 'IMMO-0007']);
  assert.equal(accountFiltered.from, '2025-06-01');
  const withNonDepreciable = Reports.buildReport(options({
    includeWithoutDepreciation: true,
    includeNetValueNonzero: false,
    includeNetValueZero: true
  }));
  assert.equal(withNonDepreciable.ok, true, withNonDepreciable.errors.join(' '));
  assert.ok(withNonDepreciable.rows.some(row => row.assetCode === 'IMMO-0003'));
  assert.equal(withNonDepreciable.basis.netValueFiltersApplied, false, 'les filtres VNC ne sont pas appliqués sans VNC source');
  assert.equal(withNonDepreciable.includeNetValueNonzero, false);
  assert.equal(withNonDepreciable.includeNetValueZero, true);
});

test('refuse les catégories vides, les comptes invalides et les dates hors cycle', () => {
  assert.equal(Reports.buildReport(options({ includeWithDepreciation: false })).ok, false);
  assert.equal(Reports.buildReport(options({ includeWithDepreciation: false, includeWithoutDepreciation: false })).ok, false);
  assert.equal(Reports.buildReport(options({ accountFilter: '' })).ok, false);
  assert.equal(Reports.buildReport(options({ from: '2025-12-31', to: '2025-01-01' })).ok, false);
  assert.equal(Reports.buildReport(options({ from: '2024-12-31' })).ok, false);
  assert.equal(Reports.buildReport(options({ to: '2026-01-01' })).ok, false);
  assert.equal(Reports.buildReport(options({ cycleEnd: '2025-02-30' })).ok, false);
});

test('registre vide ou méthode non classée ne fabrique ni ligne ni montant', () => {
  const empty = Reports.buildReport(options({ assets: [], accounts: [] }));
  assert.equal(empty.ok, true, empty.errors.join(' '));
  assert.deepEqual(empty.rows, []);
  assert.equal(empty.generatedLineCount, 0);
  assert.equal(empty.dataAvailable, false);
  assert.equal(empty.totals, null);
  const unknownOnly = Reports.buildReport(options({ assets: [assets.find(asset => asset.id === 'ASSET-UNDEFINED')] }));
  assert.equal(unknownOnly.ok, true, unknownOnly.errors.join(' '));
  assert.deepEqual(unknownOnly.rows, []);
  assert.match(unknownOnly.warnings.join(' '), /méthode « à définir » ou inconnue/);
});

console.log('Tableau des amortissements : sources, règles de sélection et absence de calcul contrôlées.');
