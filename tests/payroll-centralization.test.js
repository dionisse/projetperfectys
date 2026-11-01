/* Tests unitaires de l’agrégation ; toutes les écritures ici sont des fixtures synthétiques non comptabilisables. */
'use strict';

const assert = require('node:assert/strict');
const Centralization = require('../modern-proto/js/payroll-centralization.js');
const run = {
  id: 'fixture-only-run',
  dossierId: 'fixture-only-dossier',
  status: 'approved',
  origin: 'test-fixture',
  accountingLines: [
    { accountCode: 'TEST-SOURCE-A', accountLabel: 'Fixture source A — sans classification comptable', debit: 700, credit: 0 },
    { accountCode: 'TEST-SOURCE-B', accountLabel: 'Fixture source B — sans classification comptable', debit: 0, credit: 600 },
    { accountCode: 'TEST-SOURCE-C', accountLabel: 'Fixture source C — sans classification comptable', debit: 0, credit: 100 }
  ]
};
const accounts = [
  { code: 'TEST-TARGET-A', label: 'Compte cible fictif A', active: true },
  { code: 'TEST-TARGET-B', label: 'Compte cible fictif B', active: true },
  { code: 'TEST-TARGET-C', label: 'Compte cible fictif C', active: true },
  { code: 'TEST-INACTIVE', label: 'Cible fictive inactive', active: false }
];
const mappings = { 'TEST-SOURCE-A': 'TEST-TARGET-A', 'TEST-SOURCE-B': 'TEST-TARGET-B', 'TEST-SOURCE-C': 'TEST-TARGET-C' };

const aggregated = Centralization.aggregate(run, mappings, accounts);
assert.equal(aggregated.ok, true, aggregated.errors.join('\n'));
assert.equal(aggregated.totalDebit, 700);
assert.equal(aggregated.totalCredit, 700);
assert.equal(aggregated.lines.length, 3);
assert.equal(aggregated.accountMappings.length, 3);

const notApproved = Centralization.aggregate({ ...run, status: 'draft' }, mappings, accounts);
assert.equal(notApproved.ok, false);
assert.ok(notApproved.errors.some(error => error.includes('approuvés dans Paie & RH')));

const missingMapping = Centralization.aggregate(run, { ...mappings, 'TEST-SOURCE-C': '' }, accounts);
assert.equal(missingMapping.ok, false);
assert.ok(missingMapping.errors.some(error => error.includes('sans correspondance')));

const inactive = Centralization.aggregate(run, { ...mappings, 'TEST-SOURCE-C': 'TEST-INACTIVE' }, accounts);
assert.equal(inactive.ok, false);
assert.ok(inactive.errors.some(error => error.includes('inactif')));

const unbalancedRun = { ...run, accountingLines: run.accountingLines.map(line => ({ ...line })) };
unbalancedRun.accountingLines[0].debit += 1;
const unbalanced = Centralization.aggregate(unbalancedRun, mappings, accounts);
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('n’est pas équilibré')));

const mergeMap = { ...mappings, 'TEST-SOURCE-C': 'TEST-TARGET-B' };
const merged = Centralization.aggregate(run, mergeMap, accounts);
assert.equal(merged.ok, true, merged.errors.join('\n'));
assert.deepEqual(merged.lines.filter(line => line.account === 'TEST-TARGET-B').map(line => [line.debit, line.credit]), [[0, 700]], 'les crédits de fixtures sont agrégés par compte cible sans prétendre à une affectation métier');
console.log('Centralisation Paie & RH : contrôles d’agrégation validés uniquement sur fixtures synthétiques — OK');
