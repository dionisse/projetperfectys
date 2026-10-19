/* Tests du registre local interne Paie & RH. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const PayrollHR = require('../modern-proto/js/payroll-hr.js');

const dossier = { id: 'dossier-payroll', cycleStart: '2026-07-15', cycleEnd: '2027-06-30', exerciseYear: 2026 };
assert.deepEqual(PayrollHR.runs(dossier.id), []);

const created = PayrollHR.createDemoRun(dossier, '2026-07');
assert.equal(created.ok, true, created.errors.join('\n'));
assert.equal(created.run.status, 'draft');
assert.equal(created.run.period, '2026-07');
assert.equal(created.run.date, '2026-07-31', 'la date source reste dans un cycle qui commence en milieu de mois');
assert.equal(created.run.employeeCount, 3);
assert.equal(created.run.accountingLines.length, 3);
assert.deepEqual(created.run.totals, { grossPay: 750000, deductions: 75000, netPay: 675000 });
assert.match(created.run.calculationNote, /aucun calcul de paie/i);
assert.equal(PayrollHR.createDemoRun(dossier, '2026-07').ok, false, 'un exemple ne peut pas être dupliqué pour la même période');
assert.equal(PayrollHR.createDemoRun(dossier, '2025-12').ok, false, 'une période hors cycle est refusée');

const unbalanced = PayrollHR.validateAccountingLines([
  { accountCode: '641000', accountLabel: 'Salaires', debit: 100, credit: 0 },
  { accountCode: '421000', accountLabel: 'Net à payer', debit: 0, credit: 99 }
], true);
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('n’est pas équilibré')));

const approved = PayrollHR.approveRun(dossier, created.run.id);
assert.equal(approved.ok, true, approved.errors.join('\n'));
assert.equal(approved.run.status, 'approved');
assert.ok(approved.run.approvedAt);
assert.equal(PayrollHR.approveRun(dossier, created.run.id).ok, false, 'un lot déjà approuvé ne peut pas être approuvé une seconde fois');
assert.equal(PayrollHR.getRun(dossier.id, created.run.id).status, 'approved');
assert.deepEqual(PayrollHR.runs('another-dossier'), [], 'les lots Paie & RH sont isolés par dossier client');
assert.equal(PayrollHR.sourceId(dossier.id, created.run.id), PayrollHR.sourceId(dossier.id, created.run.id));
assert.notEqual(PayrollHR.sourceId(dossier.id, created.run.id), PayrollHR.sourceId('another-dossier', created.run.id));

const secondPeriod = PayrollHR.createDemoRun(dossier, '2026-08');
assert.equal(secondPeriod.ok, true);
assert.deepEqual(PayrollHR.runs(dossier.id).map(run => run.period), ['2026-08', '2026-07']);
console.log('Paie & RH interne : lots locaux, approbation, équilibre et isolation — OK');
