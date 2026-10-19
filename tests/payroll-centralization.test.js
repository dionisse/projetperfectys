/* Tests de la centralisation interne Paie & RH → Comptabilité. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const PayrollHR = require('../modern-proto/js/payroll-hr.js');
const Centralization = require('../modern-proto/js/payroll-centralization.js');
const dossier = { id: 'dossier-1', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' };
const runResult = PayrollHR.createDemoRun(dossier, '2026-01');
assert.equal(runResult.ok, true, runResult.errors.join('\n'));
assert.equal(PayrollHR.approveRun(dossier, runResult.run.id).ok, true);
const run = PayrollHR.getRun(dossier.id, runResult.run.id);
const accounts = [
  { code: '641', label: 'Rémunérations du personnel', active: true },
  { code: '421', label: 'Personnel, rémunérations dues', active: true },
  { code: '431', label: 'Organismes sociaux', active: true },
  { code: '441', label: 'État', active: true }
];

const aggregated = Centralization.aggregate(run, { '641': '641', '421': '421', '431': '431' }, accounts);
assert.equal(aggregated.ok, true, aggregated.errors.join('\n'));
assert.equal(aggregated.totalDebit, 750000);
assert.equal(aggregated.totalCredit, 750000);
assert.equal(aggregated.lines.length, 3);
assert.equal(aggregated.accountMappings.length, 3);

const notApproved = Centralization.aggregate({ ...run, status: 'draft' }, {}, accounts);
assert.equal(notApproved.ok, false);
assert.ok(notApproved.errors.some(error => error.includes('approuvés dans Paie & RH')));

const missingMapping = Centralization.aggregate(run, { '641': '641', '421': '421', '431': '' }, accounts);
assert.equal(missingMapping.ok, false);
assert.ok(missingMapping.errors.some(error => error.includes('sans correspondance')));

const inactive = Centralization.aggregate(run, { '641': '641', '421': '421', '431': '441' }, [
  ...accounts.filter(account => account.code !== '441'), { code: '441', label: 'État', active: false }
]);
assert.equal(inactive.ok, false);
assert.ok(inactive.errors.some(error => error.includes('inactif')));

const unbalancedRun = { ...run, accountingLines: run.accountingLines.map(line => ({ ...line })) };
unbalancedRun.accountingLines[0].debit += 1;
const unbalanced = Centralization.aggregate(unbalancedRun, {}, accounts);
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('n’est pas équilibré')));

const mergeMap = { '641': '641', '421': '421', '431': '421' };
const merged = Centralization.aggregate(run, mergeMap, accounts);
assert.equal(merged.ok, true, merged.errors.join('\n'));
assert.deepEqual(merged.lines.filter(line => line.account === '421').map(line => [line.debit, line.credit]), [[0, 750000]], 'les crédits de paie sont agrégés séparément sur le compte cible');
console.log('Centralisation interne Paie & RH : approbation, correspondances et agrégation — OK');
