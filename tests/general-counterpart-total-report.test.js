/* Vérifie le cumul des véritables lignes de contrepartie des pièces validées. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/general-counterpart-total-report.js');

const accounts = [
  { code: '401000', label: 'Fournisseurs', postable: true },
  { code: '411000', label: 'Clients', postable: true },
  { code: '512000', label: 'Banque', postable: true },
  { code: '531000', label: 'Caisse', postable: true },
  { code: '604000', label: 'Achats', postable: true }
];

const entries = [
  {
    id: 'MULTI-1', date: '2025-01-15', journal: 'BQ', reference: 'BQ-001',
    status: 'posted', lines: [
      { account: '401000', debit: 60, credit: 0 },
      { account: '512000', debit: 0, credit: 40 },
      { account: '531000', debit: 0, credit: 20 }
    ]
  },
  {
    id: 'MULTI-2', date: '2025-03-10', journal: 'OD', reference: 'OD-004',
    status: 'posted', lines: [
      { account: '401000', debit: 100, credit: 0 },
      { account: '401000', debit: 50, credit: 0 },
      { account: '512000', debit: 0, credit: 150 }
    ]
  },
  {
    id: 'SIMPLE-1', date: '2025-06-30', journal: 'OD', reference: 'OD-007',
    status: 'posted', lines: [
      { account: '411000', debit: 0, credit: 125 },
      { account: '604000', debit: 125, credit: 0 }
    ]
  },
  {
    id: 'OUTSIDE', date: '2026-01-02', journal: 'BQ', reference: 'BQ-2026', status: 'posted', lines: [
      { account: '401000', debit: 10, credit: 0 }, { account: '512000', debit: 0, credit: 10 }
    ]
  },
  {
    id: 'DRAFT', date: '2025-04-10', journal: 'BQ', reference: 'BQ-DRAFT', status: 'draft', lines: [
      { account: '401000', debit: 900, credit: 0 }, { account: '512000', debit: 0, credit: 900 }
    ]
  }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances: [],
    journals: [],
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-01-01',
    to: '2025-12-31',
    accountFilter: '*',
    counterpartFilter: '*',
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

console.log('Cumul des contreparties · filtres, lignes sources, agrégation et lecture seule');

test('reprend les cinq colonnes de la capture et les coche par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Contrepartie', 'Intitulé', 'Nombre de lignes', 'Débits', 'Crédits'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('agrège les contreparties à partir de leurs lignes source réelles', () => {
  const snapshot = JSON.stringify(entries);
  const report = build({ accountFilter: '401*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.counterpartCode, row.counterpartTitle, row.lineCount, row.debit, row.credit]), [
    ['512000', 'Banque', 2, 0, 190],
    ['531000', 'Caisse', 1, 0, 20]
  ]);
  assert.equal(report.sourceLineCount, 3);
  assert.equal(report.counterpartCount, 2);
  assert.equal(report.basis.counterpartValuesFromSourceLines, true);
  assert.equal(report.basis.counterpartSourceLinesDeduplicated, true);
  assert.equal(report.basis.multilineAmountAllocationApplied, false);
  assert.equal(JSON.stringify(entries), snapshot, 'le rapport ne modifie pas les écritures');
});

test('compte une ligne de contrepartie une seule fois malgré plusieurs lignes détaillées de la même pièce', () => {
  const report = build({ accountFilter: '401*', counterpartFilter: '512*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.counterpartCode, row.lineCount, row.credit]), [['512000', 2, 190]]);
  assert.equal(report.sourceLineCount, 2, 'la ligne banque de la pièce multiligne n’est pas doublée par les deux lignes 401000');
});

test('déduplique une ligne source reliée à plusieurs comptes détaillés sans la ventiler', () => {
  const report = build({ accountFilter: '*', counterpartFilter: '*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.sourceLineCount, 8, 'chaque ligne source comptable éligible n’est comptée qu’une fois');
  assert.deepEqual(report.rows.map(row => row.counterpartCode), ['401000', '411000', '512000', '531000', '604000']);
  assert.equal(report.rows.find(row => row.counterpartCode === '512000').lineCount, 2);
  assert.equal(report.rows.find(row => row.counterpartCode === '512000').credit, 190);
});

test('ne confond pas les lignes de deux pièces sans identifiant qui partagent une référence', () => {
  const duplicateReferences = [
    { date: '2025-02-01', reference: 'DOUBLON', status: 'posted', lines: [
      { account: '401000', debit: 10, credit: 0 }, { account: '512000', debit: 0, credit: 10 }
    ] },
    { date: '2025-02-02', reference: 'DOUBLON', status: 'posted', lines: [
      { account: '401000', debit: 15, credit: 0 }, { account: '512000', debit: 0, credit: 15 }
    ] }
  ];
  const report = build({ entries: duplicateReferences, accountFilter: '401*', counterpartFilter: '512*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.counterpartCode, row.lineCount, row.credit]), [['512000', 2, 25]]);
});

test('applique la période et le filtre des comptes de contrepartie', () => {
  const report = build({
    accountFilter: '411*', counterpartFilter: '604*',
    from: '2025-06-30', to: '2025-06-30'
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.counterpartCode, row.lineCount, row.debit, row.credit]), [
    ['604000', 1, 125, 0]
  ]);
});

test('refuse les filtres et périodes invalides', () => {
  const badMain = build({ accountFilter: '' });
  assert.equal(badMain.ok, false);
  assert.ok(badMain.errors.some(message => message.includes('Comptes à détailler')));

  const badCounterpart = build({ counterpartFilter: '' });
  assert.equal(badCounterpart.ok, false);
  assert.ok(badCounterpart.errors.some(message => message.includes('Comptes de contrepartie')));

  const badRange = build({ from: '2024-12-31' });
  assert.equal(badRange.ok, false);
  assert.ok(badRange.errors.some(message => message.includes('cycle du dossier')));
});

console.log('Cumul des contreparties : tests de restitution terminés.');
