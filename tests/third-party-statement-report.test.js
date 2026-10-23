/* Vérifie le Relevé de compte des tiers sans inventer de mouvements ni de soldes. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-statement-report.js');

const parties = [
  { id: 'client-a', code: 'CLI-A', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-A', _thirdPartyNature: 'clients' },
  { id: 'client-b', code: 'CLI-B', name: 'Client Beta', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-B', _thirdPartyNature: 'clients' },
  { id: 'supplier-a', code: 'FOU-A', name: 'Fournisseur A', accountCode: '401100', auxiliaryAccountCode: '401100-FOU-A', _thirdPartyNature: 'suppliers' }
];

const accounts = [
  { code: '411100', label: 'Clients', aux: true },
  { code: '401100', label: 'Fournisseurs', aux: true },
  { code: '512000', label: 'Banque', aux: false }
];

const entries = [
  { id: 'PRE-PERIOD', date: '2025-01-20', status: 'posted', lines: [
    { account: '411100', debit: 12, credit: 0, auxiliaryCode: 'CLI-A' },
    { account: '512000', debit: 0, credit: 12 }
  ] },
  { id: 'PERIOD-A', date: '2025-02-10', journal: 'VTE', reference: 'PIECE-A', status: 'posted', lines: [
    { account: '411100', debit: 25, credit: 0, auxiliaryCode: '411100-CLI-A', reference: 'FAC-25', description: 'Facture Alpha' },
    { account: '512000', debit: 0, credit: 25 }
  ] },
  { id: 'PERIOD-B', date: '2025-03-05', journal: 'BQ', reference: 'PIECE-B', status: 'posted', lines: [
    { account: '411100', debit: 0, credit: 8, auxiliaryCode: 'CLI-B', description: 'Règlement Beta' },
    { account: '512000', debit: 8, credit: 0 }
  ] }
];

const movements = [
  { date: '2025-01-20', account: '411100', auxiliaryCode: 'CLI-A', debit: 12, credit: 0, sourceEntryId: 'PRE-PERIOD', lineNumber: 1 },
  { date: '2025-02-10', account: '411100', auxiliaryCode: '411100-CLI-A', debit: 25, credit: 0, sourceEntryId: 'PERIOD-A', lineNumber: 1 },
  { date: '2025-03-05', account: '411100', auxiliaryCode: 'CLI-B', debit: 0, credit: 8, sourceEntryId: 'PERIOD-B', lineNumber: 1 }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: parties.filter(record => record._thirdPartyNature === 'clients'),
    allThirdPartyRecords: parties,
    thirdPartyMovements: movements,
    entries,
    accounts,
    openingBalances: [{ id: 'ignored-opening', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdPartyId: 'client-a' }],
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-02-01',
    to: '2025-03-31',
    thirdPartyFilter: '*',
    decimalPlaces: 0,
    includeNonMoved: true,
    commentLeft: 'À l’attention du client',
    commentRight: 'Pour suivi'
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

console.log('Relevé de compte des tiers · sélection, sources explicites et absence de mouvements');

test('expose les quatre natures et les cinq colonnes cochées par défaut, dans l’ordre de la capture', () => {
  assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), ['Date', 'Référence', 'Débit', 'Crédit', 'Libellé']);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('reprend uniquement les lignes validées de la période et respecte les commentaires, sans solde progressif', () => {
  const snapshot = JSON.stringify({ entries, movements });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Clients');
  assert.deepEqual(report.groups.map(group => group.thirdPartyCode), ['CLI-A', 'CLI-B']);
  assert.equal(report.lineCount, 2);
  assert.equal(report.generatedLineCount, 2);
  assert.equal(report.tierCount, 2);
  assert.deepEqual(report.rows.map(row => [row.date, row.reference, row.debit, row.credit, row.label]), [
    ['2025-02-10', 'FAC-25', 25, 0, 'Facture Alpha'],
    ['2025-03-05', '', 0, 8, 'Règlement Beta']
  ]);
  assert.equal(Object.hasOwn(report.rows[0], 'balance'), false);
  assert.equal(report.totals.debit, 25);
  assert.equal(report.totals.credit, 8);
  assert.equal(report.commentLeft, 'À l’attention du client');
  assert.equal(report.commentRight, 'Pour suivi');
  assert.equal(report.basis.openingBalancesNotApplied, true);
  assert.equal(report.basis.noRunningBalanceColumn, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ entries, movements }), snapshot, 'les écritures et les mouvements sources restent inchangés');
});

test('inclut un tiers sans mouvement comme groupe explicatif vide, sans créer de ligne comptable', () => {
  const report = build({
    thirdPartyFilter: 'CLI-B',
    thirdPartyMovements: [],
    includeNonMoved: true
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.tierCount, 1);
  assert.equal(report.lineCount, 0);
  assert.equal(report.generatedLineCount, 0);
  assert.equal(report.groups[0].thirdPartyCode, 'CLI-B');
  assert.deepEqual(report.groups[0].rows, []);
  assert.equal(report.groups[0].lineCount, 0);
  assert.deepEqual(report.rows, []);
  assert.deepEqual(report.totals, { debit: 0, credit: 0, difference: 0 });
});

test('omet les tiers sans mouvement lorsque l’option est désactivée', () => {
  const report = build({
    thirdPartyFilter: 'CLI-B',
    thirdPartyMovements: [],
    includeNonMoved: false
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.tierCount, 0);
  assert.deepEqual(report.groups, []);
  assert.equal(report.generatedLineCount, 0);
});

test('un champ libre de tiers ne permet jamais d’attribuer un mouvement', () => {
  const report = build({
    thirdPartyFilter: 'CLI-A',
    includeNonMoved: true,
    thirdPartyMovements: [{ date: '2025-02-10', account: '411100', thirdParty: 'CLI-A', debit: 5, credit: 0, sourceEntryId: 'PERIOD-A', lineNumber: 1 }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 0);
  assert.equal(report.groups.length, 1);
  assert.deepEqual(report.groups[0].rows, []);
  assert.ok(report.warnings.some(message => /référence auxiliaire explicite/i.test(message)));
});

test('rejette les références ambiguës et les périodes hors cycle, sans choisir une fiche au hasard', () => {
  const ambiguous = [
    { id: 'dup-a', code: 'DUP', name: 'Tiers A', accountCode: '411100', _thirdPartyNature: 'clients' },
    { id: 'dup-b', code: 'DUP', name: 'Tiers B', accountCode: '411100', _thirdPartyNature: 'clients' }
  ];
  const report = build({
    thirdPartyRecords: ambiguous,
    allThirdPartyRecords: ambiguous,
    thirdPartyMovements: [{ date: '2025-02-10', account: '411100', auxiliaryCode: 'DUP', debit: 5, credit: 0, sourceEntryId: 'PERIOD-A', lineNumber: 1 }],
    entries: [{ id: 'PERIOD-A', date: '2025-02-10', status: 'posted', lines: [
      { account: '411100', debit: 5, credit: 0, auxiliaryCode: 'DUP' }, { account: '512000', debit: 0, credit: 5 }
    ] }],
    openingBalances: [],
    includeNonMoved: true
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 0);
  assert.equal(report.groups.length, 2);
  assert.ok(report.warnings.some(message => /plusieurs fiches/i.test(message)));
  assert.equal(build({ from: '2024-12-31' }).ok, false);
  assert.equal(build({ to: '2026-01-01' }).ok, false);
  assert.equal(build({ thirdPartyFilter: 'TIERS-INCONNU' }).ok, false);
});

console.log('Relevé de compte des tiers : tests de calcul terminés.');
