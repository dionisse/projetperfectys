/* Vérifie le détail des contreparties à partir des lignes des pièces validées. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/general-counterpart-detail-report.js');

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
    description: 'Règlement fournisseur', status: 'posted', lines: [
      { account: '401000', debit: 60, credit: 0, description: 'Règlement partiel' },
      { account: '512000', debit: 0, credit: 40 },
      { account: '531000', debit: 0, credit: 20 }
    ]
  },
  {
    id: 'SIMPLE-1', date: '2025-06-30', journal: 'OD', reference: 'OD-007',
    description: 'Ajustement client', status: 'posted', lines: [
      { account: '411000', debit: 0, credit: 125, description: 'Ajustement' },
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

console.log('Détail des contreparties · filtres, période, pièces multiligne et lecture seule');

test('reprend les sept colonnes de la capture et les coche par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Date', 'Journal', 'Pièce', 'Contrepartie', 'Libellé', 'Débit', 'Crédit'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('détaille les mouvements validés du compte et associe les autres comptes de la même pièce', () => {
  const snapshot = JSON.stringify(entries);
  const report = build({ accountFilter: '401*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.accountCount, 1);
  assert.equal(report.lineCount, 1);
  assert.equal(report.generatedLineCount, 1);
  assert.equal(report.accounts[0].code, '401000');
  assert.equal(report.accounts[0].label, 'Fournisseurs');
  assert.deepEqual(report.rows[0].counterpartCodes, ['512000', '531000']);
  assert.equal(report.rows[0].counterpart, '512000 — Banque · 531000 — Caisse');
  assert.equal(report.rows[0].date, '2025-01-15');
  assert.equal(report.rows[0].journal, 'BQ');
  assert.equal(report.rows[0].piece, 'BQ-001');
  assert.equal(report.rows[0].label, 'Règlement partiel');
  assert.equal(report.rows[0].debit, 60);
  assert.equal(report.rows[0].credit, 0);
  assert.equal(JSON.stringify(entries), snapshot, 'le rapport ne modifie pas les écritures');
});

test('le filtre de contrepartie limite les comptes associés sans ventiler le montant de la ligne', () => {
  const report = build({ accountFilter: '401*', counterpartFilter: '512*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 1);
  assert.deepEqual(report.rows[0].counterpartCodes, ['512000']);
  assert.equal(report.rows[0].counterpart, '512000 — Banque');
  assert.equal(report.rows[0].debit, 60, 'le montant reste celui de la ligne 401000, sans affectation des 40 de la ligne banque');
  assert.equal(report.basis.counterpartAmountsAllocated, false);
  assert.equal(report.basis.rowAmountsFromDetailedAccountLine, true);
});

test('applique les deux filtres de comptes et les dates inclusives du cycle', () => {
  const filtered = build({ accountFilter: '411*', counterpartFilter: '604*', from: '2025-06-30', to: '2025-06-30' });
  assert.equal(filtered.ok, true, filtered.errors.join(' '));
  assert.equal(filtered.lineCount, 1);
  assert.equal(filtered.rows[0].piece, 'OD-007');
  assert.equal(filtered.rows[0].counterpart, '604000 — Achats');
  assert.equal(filtered.rows[0].credit, 125);

  const noMatch = build({ accountFilter: '401*', counterpartFilter: '604*' });
  assert.equal(noMatch.ok, true, noMatch.errors.join(' '));
  assert.equal(noMatch.lineCount, 0);
});

test('exclut les brouillons, les dates hors période et les autres comptes de contrepartie', () => {
  const report = build({ from: '2025-01-16', to: '2025-12-31' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.ok(report.rows.every(row => row.date >= '2025-01-16' && row.date <= '2025-12-31'));
  assert.ok(report.rows.every(row => row.key !== 'DRAFT:0'));
  assert.equal(report.lineCount, 2, 'la pièce de juin produit une ligne pour chacun des deux comptes détaillés');
  assert.deepEqual(report.accounts.map(section => section.code), ['411000', '604000']);
});

test('rejette les filtres ou périodes invalides', () => {
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

console.log('Détail des contreparties : tests de restitution terminés.');
