/* Vérifie les calculs documentés de la balance générale, sans modifier le dossier. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/accounting-balance-report.js');

const accounts = [
  { code: '101000', label: 'Capital', cls: 1, aux: false },
  { code: '401100', label: 'Fournisseurs collectifs', cls: 4, aux: true },
  { code: '401200', label: 'Fournisseur sans auxiliaire', cls: 4, aux: false },
  { code: '411100', label: 'Clients collectifs', cls: 4, aux: true },
  { code: '601000', label: 'Achats', cls: 6, aux: false }
];

const journals = [
  { code: 'OD', operationNature: 'Opérations courantes' },
  { code: 'INV', operationNature: 'Inventaire' },
  { code: 'RPE', operationNature: 'Résultat de l’exercice' }
];

const entries = [
  { id: 'OPEN-MOVE', date: '2026-01-02', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 100 }
  ] },
  { id: 'PERIOD-MOVE', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
    { account: '401100', debit: 30, credit: 0 }, { account: '101000', debit: 0, credit: 30 }
  ] },
  { id: 'INVENTORY', date: '2026-01-09', status: 'posted', journal: 'INV', lines: [
    { account: '101000', debit: 20, credit: 0 }, { account: '401100', debit: 0, credit: 20 }
  ] },
  { id: 'RESULT', date: '2026-01-09', status: 'posted', journal: 'RPE', lines: [
    { account: '401100', debit: 5, credit: 0 }, { account: '101000', debit: 0, credit: 5 }
  ] },
  { id: 'DRAFT', date: '2026-01-08', status: 'draft', journal: 'OD', lines: [
    { account: '101000', debit: 999, credit: 0 }, { account: '401100', debit: 0, credit: 999 }
  ] },
  { id: 'OUTSIDE-CYCLE', date: '2025-12-31', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 500, credit: 0 }, { account: '401100', debit: 0, credit: 500 }
  ] },
  { id: 'AFTER-RANGE', date: '2026-01-11', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 700, credit: 0 }, { account: '401100', debit: 0, credit: 700 }
  ] }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances: [
      { id: 'RAN-1', date: '2025-12-31', accountCode: '101000', debit: 50, credit: 0 },
      { id: 'RAN-2', date: '2025-12-31', accountCode: '401100', debit: 0, credit: 50 }
    ],
    journals,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    decimalPlaces: 0,
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' },
    columns: { code: true, label: true, movements: true, movementBalance: true }
  }, overrides));
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

console.log('Balance générale des comptes · source réelle, filtres et soldes');

test('le filtre de comptes accepte tous, les codes exacts et les préfixes génériques', () => {
  assert.equal(Report.parseAccountFilter('*').all, true);
  assert.equal(Report.accountMatches('401100', Report.parseAccountFilter('401*; 411100')), true);
  assert.equal(Report.accountMatches('401200', Report.parseAccountFilter('401100')), false);
  assert.equal(Report.parseAccountFilter('  ').valid, false);
});

test('les mouvements couvrent les bornes, excluent brouillons et dates hors cycle/période, et intègrent le report au solde d’ouverture', () => {
  const report = build();
  assert.equal(report.ok, true);
  assert.equal(report.movementEntryCount, 3);
  assert.equal(report.totals.movementDebit, 55);
  assert.equal(report.totals.movementCredit, 55);
  const capital = report.rows.find(row => row.code === '101000');
  const suppliers = report.rows.find(row => row.code === '401100');
  assert.equal(capital.openingBalance, 150, 'report à nouveau débiteur plus pièce validée antérieure à la période');
  assert.equal(capital.movementBalance, -15);
  assert.equal(capital.closingBalance, 135);
  assert.equal(suppliers.openingBalance, -150, 'report à nouveau et pièce antérieure au crédit');
  assert.equal(suppliers.movementBalance, 15);
  assert.equal(suppliers.closingBalance, -135);
  assert.equal(report.openingBalanceLineCount, 2);
});

test('les options avant inventaire et avant résultat filtrent par nature enregistrée du journal', () => {
  const inventoryExcluded = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeInventory: true, groupMode: 'none' } });
  assert.equal(inventoryExcluded.movementEntryCount, 2);
  assert.equal(inventoryExcluded.totals.movementDebit, 35);
  const resultExcluded = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeResult: true, groupMode: 'none' } });
  assert.equal(resultExcluded.movementEntryCount, 2);
  assert.equal(resultExcluded.totals.movementDebit, 50);
  const both = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeInventory: true, beforeResult: true, groupMode: 'none' } });
  assert.equal(both.movementEntryCount, 1);
  assert.equal(both.totals.movementDebit, 30);
});

test('comptes collectifs limite aux comptes auxiliaires connus de classe 4', () => {
  const report = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', collectivesOnly: true, groupMode: 'none' } });
  assert.deepEqual(report.rows.map(row => row.code), ['401100']);
  assert.equal(report.totals.movementDebit, 35, 'la ligne de classe 4 de l’écriture d’inventaire reste comprise sans filtre avant inventaire');
});

test('une période inversée est rejetée par le calcul pur', () => {
  const report = build({ filters: { accounts: '*', from: '2026-02-01', to: '2026-01-10', groupMode: 'none' } });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.includes('début')));
});

test('une sélection explicite montre les comptes sans mouvement et respecte le mode ordre du plan', () => {
  const filters = { accounts: '101000, 411*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' };
  const ungrouped = build({ accounts: [accounts[3], accounts[0]], entries: [], openingBalances: [], filters });
  assert.deepEqual(ungrouped.rows.map(row => row.code), ['101000', '411100']);
  const grouped = build({ accounts: [accounts[3], accounts[0]], entries: [], openingBalances: [], filters: Object.assign({}, filters, { groupMode: 'chart' }) });
  assert.deepEqual(grouped.rows.map(row => row.code), ['411100', '101000']);
});

test('les montants respectent la précision du dossier et les données source restent inchangées', () => {
  const decimalEntries = [{ id: 'DECIMAL', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 1.23, credit: 0 }, { account: '401100', debit: 0, credit: 1.23 }
  ] }];
  const before = JSON.stringify(decimalEntries);
  const report = build({ entries: decimalEntries, openingBalances: [], decimalPlaces: 2,
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' } });
  assert.equal(report.totals.movementDebit, 1.23);
  assert.equal(report.rows.find(row => row.code === '101000').movementBalance, 1.23);
  assert.equal(JSON.stringify(decimalEntries), before);
});

test('le cumul non confirmé ne devient pas une colonne calculée', () => {
  const report = build({ columns: { code: true, cumulativeStart: true, cumulativeEnd: true } });
  assert.deepEqual(report.columns, ['code']);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeStart').supported, false);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeEnd').supported, false);
});
