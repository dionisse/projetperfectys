/* Tableau des immobilisations : registre explicite uniquement, sans codes ni mouvements déduits. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/fixed-asset-overview-report.js');

const accounts = [
  { code: '213000', label: 'Matériel informatique' },
  { code: '218000', label: 'Autres immobilisations corporelles' },
  { code: '242000', label: 'Matériel' }
];

const assets = [
  {
    id: 'ASSET-1', code: 'IMMO-0001', name: 'Ordinateur comptable', assetAccountCode: '213000',
    acquisitionDate: '2024-12-15', annualRatePercent: 20, serialNumber: 'SERIAL-NOT-A-MATERIAL-CODE', grossCost: 850000
  },
  {
    id: 'ASSET-2', code: 'IMMO-0002', name: 'Imprimante', assetAccountCode: '213000',
    acquisitionDate: '2025-06-20', annualRatePercent: 0, serialNumber: '', grossCost: 250000
  },
  {
    id: 'ASSET-FUTURE', code: 'IMMO-0003', name: 'Élément futur', assetAccountCode: '218000',
    acquisitionDate: '2026-01-01', annualRatePercent: 12, serialNumber: 'FUTURE-SERIAL', grossCost: 100000
  },
  {
    id: 'ASSET-INVALID-DATE', code: 'IMMO-0004', name: 'Date à contrôler', assetAccountCode: '242000',
    acquisitionDate: '', annualRatePercent: '', serialNumber: 'UNKNOWN-SERIAL', grossCost: 50000
  },
  {
    id: 'ASSET-OUTSIDE-ACCOUNT', code: 'IMMO-0005', name: 'Compte exclu', assetAccountCode: '242000',
    acquisitionDate: '2025-07-01', annualRatePercent: 5, serialNumber: 'OUTSIDE-SERIAL', grossCost: 90000
  }
];

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    accountFilter: '*',
    from: '2025-01-01',
    to: '2025-12-31',
    includeTracked: true,
    includeUntracked: false,
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

console.log('Tableau des immobilisations · champs explicites, compte et période');

test('expose les colonnes de la capture, toutes cochées par défaut', () => {
  const definition = Reports.definitionFor(Reports.REPORT_ID);
  assert.equal(definition.title, 'Tableau des immobilisations');
  assert.deepEqual(definition.filters, ['accounts', 'from', 'to']);
  assert.deepEqual(definition.columns.map(column => column.label), [
    'Code élément', 'Intitulé élément', 'Code matériel', 'Date d’entrée', 'Taux d’amortissement',
    'Report', 'Augmentation', 'Diminution', 'Solde'
  ]);
  assert.ok(definition.columns.every(column => column.defaultSelected));
  assert.equal(Reports.definitionFor('unknown'), null);
});

test('lit les éléments enregistrés par compte et jusqu’à la fin de période, sans fabriquer de montants', () => {
  const report = Reports.buildReport(options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.assetCode), ['IMMO-0001', 'IMMO-0002', 'IMMO-0004', 'IMMO-0005']);
  const priorToPeriod = report.rows.find(row => row.assetCode === 'IMMO-0001');
  assert.equal(priorToPeriod.entryDate, '2024-12-15', 'l’élément antérieur reste visible dans le report de la période');
  assert.equal(priorToPeriod.assetName, 'Ordinateur comptable');
  assert.equal(priorToPeriod.accountLabel, 'Matériel informatique');
  assert.equal(priorToPeriod.depreciationRate, '20 %', 'seul le taux annuel explicitement saisi est restitué');
  assert.deepEqual([priorToPeriod.carryforward, priorToPeriod.increase, priorToPeriod.decrease, priorToPeriod.balance], ['', '', '', '']);
  assert.equal(priorToPeriod.materialCode, '', 'le numéro de série ne devient pas un code matériel');
  assert.equal(report.rows.find(row => row.assetCode === 'IMMO-0002').depreciationRate, '', 'un taux absent ou nul n’est pas calculé');
  assert.equal(report.rows.find(row => row.assetCode === 'IMMO-0004').entryDateValid, false);
  assert.equal(report.rows.find(row => row.assetCode === 'IMMO-0004').materialCode, '');
  assert.equal(report.generatedLineCount, 4);
  assert.deepEqual(report.displayAccounts.map(account => account.code), ['213000', '242000']);
  assert.equal(report.totals, null);
  assert.equal(report.basis.fixedAssetMovementsAvailable, false);
  assert.equal(report.basis.materialCodeFromSerialNumber, false);
  assert.equal(report.basis.noExplicitMaterialCodeSource, true);
  assert.equal(report.basis.noMovementAmountsOrBalanceCalculated, true);
  assert.match(report.warnings.join(' '), /aucune source explicite de code matériel/i);
  assert.match(report.warnings.join(' '), /restent vides/i);
  assert.doesNotMatch(JSON.stringify(report.rows), /850000|250000|SERIAL-NOT-A-MATERIAL-CODE/);
});

test('applique les filtres de comptes et conserve les comptes avant la date Début', () => {
  const report = Reports.buildReport(options({ accountFilter: '213*', from: '2025-06-01', to: '2025-12-31' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.assetCode), ['IMMO-0001', 'IMMO-0002']);
  assert.equal(report.from, '2025-06-01');
  assert.equal(report.to, '2025-12-31');
  assert.deepEqual(Reports.buildReport(options({ accountFilter: '242000' })).rows.map(row => row.assetCode), ['IMMO-0004', 'IMMO-0005']);
  assert.equal(Reports.buildReport(options({ accountFilter: '' })).ok, false);
});

test('la sélection des catégories respecte le défaut capture et ne crée aucune ligne non suivie', () => {
  const defaults = Reports.buildReport(options());
  assert.equal(defaults.includeTracked, true);
  assert.equal(defaults.includeUntracked, false);
  const untracked = Reports.buildReport(options({ includeTracked: false, includeUntracked: true }));
  assert.equal(untracked.ok, true, untracked.errors.join(' '));
  assert.deepEqual(untracked.rows, []);
  assert.equal(untracked.generatedLineCount, 0);
  assert.equal(untracked.totals, null);
  assert.match(untracked.warnings.join(' '), /aucune source explicite ne recense les comptes non suivis/i);
  assert.equal(Reports.buildReport(options({ includeTracked: false, includeUntracked: false })).ok, false);
});

test('refuse les dates inversées, hors cycle et les cycles mal formés', () => {
  assert.equal(Reports.buildReport(options({ from: '2025-12-31', to: '2025-01-01' })).ok, false);
  assert.equal(Reports.buildReport(options({ from: '2024-12-31' })).ok, false);
  assert.equal(Reports.buildReport(options({ to: '2026-01-01' })).ok, false);
  assert.equal(Reports.buildReport(options({ cycleStart: '2025-02-30' })).ok, false);
});

test('un registre vide reste vide et le rapport ne modifie aucune écriture comptable', () => {
  const report = Reports.buildReport(options({ assets: [], accounts: [] }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.displayAccounts, []);
  assert.equal(report.generatedLineCount, 0);
  assert.equal(report.dataAvailable, false);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(report.totals, null);
});

console.log('Tableau des immobilisations : sources, bornes, catégories et absence de calcul contrôlées.');
