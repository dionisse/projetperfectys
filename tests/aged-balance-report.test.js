/* Vérifie les tranches, filtres, horizons calendaires et règlements de la Balance âgée. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/aged-balance-report.js');

const accounts = [
  { code: '411100', label: 'Clients collectifs' },
  { code: '411700', label: 'Clients retenues' },
  { code: '401100', label: 'Fournisseurs collectifs' },
  { code: '421', label: 'Rémunérations dues' },
  { code: '486100', label: 'Charges constatées d’avance' }
];

const items = [
  { id: 'DUE', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-001', documentDate: '2026-01-01', dueDate: '2026-10-23', amount: 1000 },
  { id: 'D1', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-002', documentDate: '2026-01-02', dueDate: '2026-10-22', amount: 200 },
  { id: 'D30', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-030', documentDate: '2026-01-03', dueDate: '2026-09-23', amount: 300 },
  { id: 'D31', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-031', documentDate: '2026-01-04', dueDate: '2026-09-22', amount: 400 },
  { id: 'D60', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-060', documentDate: '2026-01-05', dueDate: '2026-08-24', amount: 500 },
  { id: 'D61', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', reference: 'FAC-061', documentDate: '2026-01-06', dueDate: '2026-08-23', amount: 600 },
  { id: 'D90', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-090', documentDate: '2026-01-07', dueDate: '2026-07-25', amount: 700 },
  { id: 'D91', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-091', documentDate: '2026-01-08', dueDate: '2026-07-24', amount: 800 },
  { id: 'SIX-MONTHS', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-6M', documentDate: '2026-01-09', dueDate: '2026-04-23', amount: 900 },
  { id: 'BEFORE-SIX-MONTHS', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-OLD', documentDate: '2025-12-31', dueDate: '2026-04-22', amount: 1000 },
  { id: 'FIVE-YEARS', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-2', thirdPartyCode: 'CLI-2', thirdPartyName: 'Client B', reference: 'FAC-5Y', documentDate: '2021-01-01', dueDate: '2021-10-23', amount: 1100 },
  { id: 'BEFORE-FIVE-YEARS', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-2', thirdPartyCode: 'CLI-2', thirdPartyName: 'Client B', reference: 'FAC-5Y-OLD', documentDate: '2020-12-31', dueDate: '2021-10-22', amount: 1200 },
  { id: 'AFTER-AS-OF', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-FUTURE', documentDate: '2026-10-24', dueDate: '2026-11-10', amount: 1300 },
  { id: 'SUPPLIER', nature: 'suppliers', accountCode: '401100', thirdPartyId: 'sup-1', thirdPartyCode: 'FOU-1', thirdPartyName: 'Fournisseur A', reference: 'ACH-001', documentDate: '2026-01-01', dueDate: '2026-10-20', amount: 500 },
  { id: 'EXCLUDED-ACCOUNT', nature: 'clients', accountCode: '411700', thirdPartyId: 'cli-1', thirdPartyCode: 'CLI-1', thirdPartyName: 'Client A', reference: 'FAC-EX', documentDate: '2026-01-01', dueDate: '2026-10-01', amount: 1400 }
];

const settlements = [
  { id: 'PAY-1', itemId: 'DUE', date: '2026-10-20', reference: 'REG-001', amount: 100 },
  { id: 'PAY-FUTURE', itemId: 'DUE', date: '2026-10-24', reference: 'REG-002', amount: 50 },
  { id: 'PAY-OLD', itemId: 'BEFORE-SIX-MONTHS', date: '2026-10-22', reference: 'REG-003', amount: 200 },
  { id: 'PAY-SUPPLIER', itemId: 'SUPPLIER', date: '2026-10-22', reference: 'REG-004', amount: 50 }
];

function build(filters = {}) {
  return Report.build({
    items,
    settlements,
    accounts,
    decimalPlaces: 0,
    filters: Object.assign({ nature: 'clients', accounts: '411 -4117 485 486 488', asOfDate: '2026-10-23', range: 'six-months' }, filters)
  });
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

console.log('Balance âgée · tranches brutes, horizons et règlements');

test('les exclusions de comptes et les préfixes par nature sont appliqués', () => {
  const filter = Report.parseAccountFilter('411 -4117 485 486 488');
  assert.equal(filter.valid, true);
  assert.equal(Report.accountMatches('411100', filter), true);
  assert.equal(Report.accountMatches('411700', filter), false);
  assert.equal(Report.accountMatches('486100', filter), true);
  assert.equal(Report.parseAccountFilter('411700 -411').valid, true);
  assert.equal(Report.accountMatches('411700', Report.parseAccountFilter('411700 -411')), false);
  assert.equal(Report.parseAccountFilter('-4117').valid, false);
});

test('les tranches respectent exactement les bornes de 0, 30, 31, 60, 61, 90 et 91 jours', () => {
  assert.equal(Report.bucketFor('2026-10-23', '2026-10-23', 'six-months'), 'notDue');
  assert.equal(Report.bucketFor('2026-10-22', '2026-10-23', 'six-months'), 'days1to30');
  assert.equal(Report.bucketFor('2026-09-23', '2026-10-23', 'six-months'), 'days1to30');
  assert.equal(Report.bucketFor('2026-09-22', '2026-10-23', 'six-months'), 'days31to60');
  assert.equal(Report.bucketFor('2026-08-24', '2026-10-23', 'six-months'), 'days31to60');
  assert.equal(Report.bucketFor('2026-08-23', '2026-10-23', 'six-months'), 'days61to90');
  assert.equal(Report.bucketFor('2026-07-25', '2026-10-23', 'six-months'), 'days61to90');
  assert.equal(Report.bucketFor('2026-07-24', '2026-10-23', 'six-months'), 'over90');
});

test('l’horizon est calendaire, avec Antérieur au-delà de six mois ou de cinq ans', () => {
  assert.equal(Report.horizonStart('2026-10-23', 'six-months'), '2026-04-23');
  assert.equal(Report.horizonStart('2026-10-23', 'five-years'), '2021-10-23');
  assert.equal(Report.bucketFor('2026-04-23', '2026-10-23', 'six-months'), 'over90');
  assert.equal(Report.bucketFor('2026-04-22', '2026-10-23', 'six-months'), 'prior');
  assert.equal(Report.bucketFor('2021-10-23', '2026-10-23', 'five-years'), 'over90');
  assert.equal(Report.bucketFor('2021-10-22', '2026-10-23', 'five-years'), 'prior');
});

test('les tranches restent brutes, les règlements sont datés et le solde suit la formule confirmée', () => {
  const report = build();
  assert.equal(report.ok, true);
  assert.equal(report.rows.length, 2, 'les lignes sont ventilées par compte et tiers');
  const clientA = report.rows.find(row => row.thirdPartyId === 'cli-1');
  assert.ok(clientA);
  assert.deepEqual({ ...clientA.ageAmounts }, {
    notDue: 1000,
    days1to30: 500,
    days31to60: 900,
    days61to90: 1300,
    over90: 1700,
    prior: 1000
  });
  assert.equal(clientA.totalDue, 6400);
  assert.equal(clientA.advances, 300, 'seuls les règlements liés et datés au plus tard à l’arrêté sont inclus');
  assert.equal(clientA.balance, 6100, 'solde = total dû − avances');
  assert.equal(report.totals.totalDue, 8700);
  assert.equal(report.totals.advances, 300);
  assert.equal(report.totals.balance, 8400);
  assert.equal(report.settlementCount, 2);
  assert.equal(report.itemCount, 12);
  assert.equal(report.basis.itemsAreGrossAmounts, true);
  assert.equal(report.basis.balanceEqualsTotalDueLessAdvances, true);
});

test('une sélection fournisseurs isole les tiers et les règlements de cette nature', () => {
  const report = build({ nature: 'suppliers', accounts: '401 -4017 408 481 482 483 484' });
  assert.equal(report.ok, true);
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].thirdPartyName, 'Fournisseur A');
  assert.equal(report.rows[0].totalDue, 500);
  assert.equal(report.rows[0].advances, 50);
  assert.equal(report.rows[0].balance, 450);
});

test('une date ou un filtre de comptes invalide est rejeté sans calcul', () => {
  const badDate = build({ asOfDate: '2026-02-30' });
  assert.equal(badDate.ok, false);
  assert.ok(badDate.errors.some(error => error.includes('date')));
  const badAccounts = build({ accounts: '-4117' });
  assert.equal(badAccounts.ok, false);
  assert.equal(badAccounts.rows.length, 0);
});

test('les montants décimaux respectent la précision configurée', () => {
  const report = Report.build({
    items: [{ id: 'DEC', nature: 'clients', accountCode: '411100', thirdPartyId: 'cli', thirdPartyName: 'Client', reference: 'D-1', documentDate: '2026-01-01', dueDate: '2026-10-23', amount: 10.25 }],
    settlements: [{ id: 'DEC-PAY', itemId: 'DEC', date: '2026-10-23', amount: 0.25 }],
    accounts,
    decimalPlaces: 2,
    filters: { nature: 'clients', accounts: '411', asOfDate: '2026-10-23', range: 'six-months' }
  });
  assert.equal(report.rows[0].totalDue, 10.25);
  assert.equal(report.rows[0].advances, 0.25);
  assert.equal(report.rows[0].balance, 10);
});
