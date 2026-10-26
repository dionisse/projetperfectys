/* Vérifie le calcul annuel des écarts de TVA à partir des écritures validées. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/vat-difference-report.js');
const report = globalThis.PerfectoVatDifferenceReport;

assert.deepEqual(report.defaults(2026), {
  schemaVersion: 2, year: 2026, rate: 18,
  salesBase: [], internalBase: [],
  salesVat: ['4431', '4432', '4433'], internalVat: ['4434']
});
assert.equal(report.defaults(2025).rate, null, 'un taux d’une autre année ne doit pas être supposé');
const migrated = report.normalise({
  salesBase: ['70*'], internalBase: ['722', '724'],
  salesVat: ['4431', '4432', '4433'], internalVat: ['4434'], rate: 18
}, 2026);
assert.deepEqual(migrated.salesBase, []);
assert.deepEqual(migrated.internalBase, []);
assert.equal(migrated.schemaVersion, 2);
const migratedHistoricalRate = report.normalise({ rate: 18, salesBase: ['7011'] }, 2025);
assert.equal(migratedHistoricalRate.rate, null);
assert.throws(() => report.calculate({ entries: [], year: 2025, configuration: report.defaults(2025) }), /taux applicable/);
assert.equal(report.accountMatches('7011', ['70*']), true);
assert.equal(report.accountMatches('4432', ['4431']), false);
assert.deepEqual(report.cleanCodes('70*, 706*; 70*'), ['70*', '706*']);

const entries = [
  { status: 'posted', date: '2026-01-10', lines: [
    { account: '7011', debit: 0, credit: 10000 },
    { account: '7011', debit: 1000, credit: 0 },
    { account: '4431', debit: 0, credit: 1700 },
    { account: '4431', debit: 100, credit: 0 },
    { account: '724', debit: 0, credit: 5000 },
    { account: '6011', debit: 2000, credit: 0 },
    { account: '4434', debit: 0, credit: 900 },
    { account: '4452', debit: 250, credit: 0 }
  ] },
  { status: 'draft', date: '2026-01-15', lines: [
    { account: '7011', debit: 0, credit: 100000 }, { account: '4431', debit: 0, credit: 18000 }
  ] },
  { status: 'posted', date: '2025-12-31', lines: [
    { account: '7011', debit: 0, credit: 100000 }, { account: '4431', debit: 0, credit: 18000 }
  ] },
  { status: 'posted', date: '2026-02-05', lines: [
    { account: '7061', debit: 0, credit: 2000 }, { account: '4432', debit: 0, credit: 360 }
  ] }
];

const result = report.calculate({
  entries, year: 2026,
  configuration: Object.assign({}, report.defaults(2026), { salesBase: ['70*'], internalBase: ['722', '724'] }),
  decimalPlaces: 0
});
assert.equal(result.generatedLineCount, 2);
assert.equal(result.months[0].salesBase, 9000);
assert.equal(result.months[0].salesVatCalculated, 1620);
assert.equal(result.months[0].salesVatBooked, 1600);
assert.equal(result.months[0].salesDifference, 20);
assert.equal(result.months[0].internalVatCalculated, 900);
assert.equal(result.months[0].internalVatBooked, 900);
assert.equal(result.totals.salesBase, 11000);
assert.equal(result.totals.salesVatCalculated, 1980);
assert.equal(result.totals.salesVatBooked, 1960);
assert.equal(result.totals.differenceTotal, 20);

const custom = report.calculate({
  year: 2026,
  configuration: { salesBase: ['7011'], internalBase: [], salesVat: ['4431'], internalVat: [], rate: 10 },
  entries: [{ status: 'posted', date: '2026-03-01', lines: [{ account: '7011', debit: 0, credit: 100 }, { account: '4431', debit: 0, credit: 5 }] }]
});
assert.equal(custom.totals.salesVatCalculated, 10);
assert.equal(custom.totals.salesDifference, 5);
assert.equal(custom.generatedLineCount, 1);

const debitNormalInternal = report.calculate({
  year: 2026,
  configuration: { salesBase: [], internalBase: ['601*'], salesVat: [], internalVat: ['4434'], rate: 18 },
  entries: [{ status: 'posted', date: '2026-04-12', lines: [{ account: '6011', debit: 1000, credit: 0 }, { account: '4434', debit: 0, credit: 180 }] }]
});
assert.equal(debitNormalInternal.totals.internalBase, 1000);
assert.equal(debitNormalInternal.totals.internalDifference, 0);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'vat-difference'/);
assert.match(app, /bindVatDifferenceReport\(\)/);
assert.match(html, /js\/vat-difference-report\.js/);
assert.match(worker, /vat-difference-report\.js/);
console.log('OK · calculs annuels TVA, exclusions et correspondances modifiables');
