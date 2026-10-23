/* Vérifie la position des tiers à une date, calculée avec les seules sources auxiliaires explicites. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-account-situation-report.js');

const clients = [
  { id: 'client-1', code: 'CLI-001', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-001' },
  { id: 'client-2', code: 'CLI-002', name: 'Client Beta', accountCode: '411200', auxiliaryAccountCode: '411200-CLI-002' }
];

const movements = [
  { date: '2026-01-01', account: '411100', auxiliaryCode: 'CLI-001', debit: 100, credit: 0, sourceEntryId: 'E-1', lineNumber: 1 },
  { date: '2026-02-05', account: '411100', auxiliaryCode: '411100-CLI-001', debit: 0, credit: 30, sourceEntryId: 'E-2', lineNumber: 1 },
  { date: '2026-06-30', account: '411100', auxiliaryCode: 'client-1', debit: 0, credit: 10, sourceEntryId: 'E-3', lineNumber: 1 },
  { date: '2026-12-31', account: '411100', auxiliaryCode: 'CLI-001', debit: 900, credit: 0, sourceEntryId: 'E-4', lineNumber: 1 },
  { date: '2026-03-01', account: '411200', auxiliaryCode: 'CLI-002', debit: 5, credit: 0, sourceEntryId: 'E-5', lineNumber: 1 },
  { date: '2026-04-01', account: '411100', auxiliaryCode: 'CLI-INCONNU', debit: 700, credit: 0, sourceEntryId: 'E-6', lineNumber: 1 }
];

const openingBalances = [
  { id: 'RAN-1', accountCode: '411100', date: '2025-12-31', debit: 40, credit: 0, thirdPartyId: 'client-1' },
  { id: 'RAN-2', accountCode: '411200', date: '2025-12-31', debit: 0, credit: 20, thirdPartyCode: 'CLI-002' },
  { id: 'RAN-FREE-TEXT', accountCode: '411100', date: '2025-12-31', debit: 999, credit: 0, thirdParty: 'CLI-001 · Client Alpha' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: clients,
    thirdPartyMovements: movements,
    openingBalances,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    asOfDate: '2026-06-30',
    thirdPartyFilter: '*',
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

console.log('Situation des comptes tiers · date d’arrêté, filtre et soldes');

test('reprend les quatre colonnes de la capture avec toutes les cases cochées', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du tiers', 'Intitulé du tiers', 'Débit', 'Crédit'
  ]);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.defaultSelected), [true, true, true, true]);
});

test('calcule les soldes au jour inclusif depuis reports explicites et mouvements avant la date', () => {
  const snapshot = JSON.stringify({ clients, movements, openingBalances });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.asOfDate, '2026-06-30');
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.thirdPartyTitle, row.debit, row.credit]), [
    ['CLI-001', 'Client Alpha', 100, 0],
    ['CLI-002', 'Client Beta', 0, 15]
  ]);
  assert.equal(report.tierCount, 2);
  assert.equal(report.sourceMovementCount, 4);
  assert.equal(report.periodMovementCount, 4);
  assert.equal(report.openingReportLineCount, 2);
  assert.deepEqual(report.totals, { debit: 100, credit: 15 });
  assert.ok(report.warnings.some(message => /libellés libres/i.test(message)));
  assert.ok(report.warnings.some(message => /référence auxiliaire/i.test(message)));
  assert.equal(report.basis.positionAtDate, true);
  assert.equal(report.basis.cutoffDateInclusive, true);
  assert.equal(report.basis.postedAuxiliaryMovementsOnly, true);
  assert.equal(report.basis.openingReportsRequireExplicitThirdPartyReference, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ clients, movements, openingBalances }), snapshot);
});

test('filtre un tiers par code et conserve uniquement sa position à date', () => {
  const report = build({ thirdPartyFilter: 'CLI-002' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.debit, row.credit]), [['CLI-002', 0, 15]]);
  assert.equal(report.tierCount, 1);
});

test('refuse une date hors cycle, un filtre inconnu et des sources invalides sans soldes partiels', () => {
  const badDate = build({ asOfDate: '2027-01-01' });
  assert.equal(badDate.ok, false);
  assert.equal(badDate.rows.length, 0);
  assert.ok(badDate.errors.some(message => /cycle du dossier/i.test(message)));

  const badFilter = build({ thirdPartyFilter: 'CLI-404' });
  assert.equal(badFilter.ok, false);
  assert.ok(badFilter.errors.some(message => /Tiers introuvable/i.test(message)));

  const badSource = build({ sourceErrors: ['Extraction auxiliaire invalide.'] });
  assert.equal(badSource.ok, false);
  assert.deepEqual(badSource.rows, []);
  assert.deepEqual(badSource.totals, { debit: 0, credit: 0 });
});

console.log('Situation des comptes tiers : tests de calcul terminés.');
