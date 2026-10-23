/* Vérifie le grand livre par compte à partir des reports et écritures du dossier. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/general-ledger-report.js');

const accounts = [
  { code: '401000', label: 'Fournisseurs', postable: true },
  { code: '521000', label: 'Banque', postable: true },
  { code: '604000', label: 'Achats de matières et fournitures', postable: true },
  { code: '4', label: 'Comptes de tiers', postable: false }
];

const openingBalances = [
  { id: 'RAN-401', date: '2024-12-31', accountCode: '401000', debit: 0, credit: 100 },
  { id: 'RAN-521', date: '2024-12-31', accountCode: '521000', debit: 100, credit: 0 }
];

const entries = [
  { id: 'BEFORE', date: '2025-01-10', journal: 'OD', reference: 'OD-001', description: 'Règlement antérieur', status: 'posted', lines: [
    { account: '401000', debit: 25, credit: 0 }, { account: '521000', debit: 0, credit: 25 }
  ] },
  { id: 'FEB', date: '2025-02-05', journal: 'BQ', reference: 'BQ-001', sourceReference: 'VIR-EXT-1', description: 'Paiement fournisseur', status: 'posted', lines: [
    { account: '401000', debit: 20, credit: 0 }, { account: '521000', debit: 0, credit: 20 }
  ] },
  { id: 'MAR', date: '2025-03-02', journal: 'OD', reference: 'OD-002', description: 'Ajustement fournisseur', status: 'posted', lines: [
    { account: '401000', debit: 0, credit: 10, reference: 'FACT-REF-2' }, { account: '521000', debit: 10, credit: 0 }
  ] },
  { id: 'AFTER', date: '2025-04-01', journal: 'BQ', reference: 'BQ-002', status: 'posted', lines: [
    { account: '401000', debit: 50, credit: 0 }, { account: '521000', debit: 0, credit: 50 }
  ] },
  { id: 'DRAFT', date: '2025-02-20', journal: 'OD', reference: 'OD-DRAFT', status: 'draft', lines: [
    { account: '401000', debit: 90, credit: 0 }, { account: '521000', debit: 0, credit: 90 }
  ] }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances,
    journals: [],
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-02-01',
    to: '2025-03-31',
    accountFilter: '*',
    includeNonMoved: false,
    subtotalByMonth: false,
    decimalPlaces: 0
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

console.log('Grand livre des comptes · mouvements validés, reports et soldes progressifs');

test('reprend les colonnes et sélections par défaut de la capture', () => {
  const selected = Report.COLUMN_DEFINITIONS.filter(column => column.defaultSelected).map(column => column.key);
  assert.deepEqual(selected, ['date', 'journal', 'piece', 'reference', 'debit', 'credit', 'label', 'counterpart']);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'market').enabled, false);
  assert.deepEqual(Report.COLUMN_GROUPS.map(group => group.length), [5, 5, 0, 3]);
});

test('filtre les dates inclusivement et calcule le solde depuis les reports et écritures antérieures', () => {
  const snapshot = JSON.stringify({ openingBalances, entries });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.accounts.map(account => account.code), ['401000', '521000']);
  const supplierRows = report.accounts.find(account => account.code === '401000').rows;
  assert.deepEqual(supplierRows.map(row => row.piece), ['BQ-001', 'OD-002']);
  assert.equal(supplierRows[0].balance, -55);
  assert.equal(supplierRows[1].balance, -65);
  assert.equal(supplierRows[0].counterpart, '521000 — Banque');
  assert.deepEqual(supplierRows[0].counterpartCodes, ['521000']);
  assert.deepEqual(supplierRows[0].counterpartLines, [{
    key: 'FEB:1', sourceKey: '1:1', lineIndex: 1, accountCode: '521000', debit: 0, credit: 20, debitMinor: 0, creditMinor: 20
  }]);
  assert.equal(supplierRows[0].entryKey, 'FEB');
  assert.equal(supplierRows[0].lineIndex, 0);
  assert.equal(supplierRows[0].reference, 'VIR-EXT-1');
  assert.equal(supplierRows[1].reference, 'FACT-REF-2');
  assert.equal(report.lineCount, 4);
  assert.equal(report.generatedLineCount, 4);
  assert.equal(report.movementEntryCount, 2);
  assert.equal(report.totals.debit, 30);
  assert.equal(report.totals.credit, 30);
  assert.equal(report.basis.priorEntriesIncludedInRunningBalance, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ openingBalances, entries }), snapshot, 'le calcul ne modifie ni les reports ni les pièces');
});

test('le filtre de comptes limite les mouvements et laisse les colonnes non modélisées vides', () => {
  const report = build({ accountFilter: '401*', to: '2025-02-05' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.accounts.map(account => account.code), ['401000']);
  assert.equal(report.lineCount, 1);
  assert.equal(report.rows[0].date, '2025-02-05');
  assert.equal(report.rows[0].letteringDate, '');
  assert.equal(report.rows[0].fixedAsset, '');
  assert.equal(report.totals.debit, 20);
  assert.equal(report.totals.credit, 0);
});

test('reprend la date de lettrage enregistrée sans la confondre avec la date de pièce', () => {
  const report = build({ matchingGroups: [{
    status: 'active',
    createdAt: '2025-02-12T14:00:00.000Z',
    lineKeys: ['FEB:0']
  }] });
  assert.equal(report.ok, true, report.errors.join(' '));
  const matched = report.accounts.find(account => account.code === '401000').rows[0];
  assert.equal(matched.date, '2025-02-05');
  assert.equal(matched.letteringDate, '2025-02-12');
});

test('inclut les comptes sans mouvement seulement sur demande, sans ajouter les comptes de regroupement', () => {
  const report = build({ includeNonMoved: true });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.accounts.map(account => account.code), ['401000', '521000', '604000']);
  assert.equal(report.accounts.find(account => account.code === '604000').lineCount, 0);
});

test('ajoute un sous-total par mois et compte sans modifier le solde progressif', () => {
  const report = build({ subtotalByMonth: true });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 4);
  assert.equal(report.generatedLineCount, 8);
  const subtotals = report.displayRows.filter(row => row.rowType === 'monthly-subtotal');
  assert.equal(subtotals.length, 4);
  assert.deepEqual(subtotals.map(row => row.subtotalLabel), [
    'Sous-total février 2025', 'Sous-total mars 2025',
    'Sous-total février 2025', 'Sous-total mars 2025'
  ]);
  assert.equal(subtotals[0].debit, 20);
  assert.equal(subtotals[0].credit, 0);
  assert.equal(subtotals[0].balance, -55);
  assert.equal(subtotals[1].balance, -65);
});

test('refuse dates hors du cycle, inversées et filtre vide', () => {
  assert.equal(build({ from: '2024-12-31' }).ok, false);
  assert.equal(build({ from: '2025-04-01', to: '2025-03-31' }).ok, false);
  const invalidFilter = build({ accountFilter: '' });
  assert.equal(invalidFilter.ok, false);
  assert.ok(invalidFilter.errors.some(message => message.includes('Indiquez un compte')));
});

console.log('Grand livre des comptes : tests de calcul terminés.');
