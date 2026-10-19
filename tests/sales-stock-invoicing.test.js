/* Tests du registre interne Ventes, stock & facturation. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const Operations = require('../modern-proto/js/sales-stock-invoicing.js');

const dossier = { id: 'dossier-commercial', cycleStart: '2026-07-15', cycleEnd: '2027-06-30', exerciseYear: 2026 };
assert.deepEqual(Operations.runs(dossier.id), []);

const created = Operations.createDemoRun(dossier, '2026-07');
assert.equal(created.ok, true, created.errors.join('\n'));
assert.equal(created.run.status, 'draft');
assert.equal(created.run.period, '2026-07');
assert.equal(created.run.date, '2026-07-31', 'la date source reste dans un cycle qui commence en milieu de mois');
assert.equal(created.run.invoiceCount, 1);
assert.equal(created.run.stockMovementCount, 1);
assert.deepEqual(created.run.totals, { invoicedSales: 1200000, stockPurchases: 600000 });
assert.equal(created.run.accountingLines.length, 4);
assert.match(created.run.calculationNote, /aucun calcul de TVA/i);
assert.equal(Operations.createDemoRun(dossier, '2026-07').ok, false, 'un exemple ne peut pas être dupliqué pour la même période');
assert.equal(Operations.createDemoRun(dossier, '2025-12').ok, false, 'une période hors cycle est refusée');

const lineCheck = Operations.validateAccountingLines(created.run.accountingLines, true);
assert.equal(lineCheck.ok, true);
assert.equal(lineCheck.debit, 1800000);
assert.equal(lineCheck.credit, 1800000);
const unbalanced = Operations.validateAccountingLines([
  { accountCode: '411100', accountLabel: 'Clients', debit: 100, credit: 0 },
  { accountCode: '701000', accountLabel: 'Ventes', debit: 0, credit: 99 }
], true);
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('n’est pas équilibré')));

const approved = Operations.approveRun(dossier, created.run.id);
assert.equal(approved.ok, true, approved.errors.join('\n'));
assert.equal(approved.run.status, 'approved');
assert.ok(approved.run.approvedAt);
assert.equal(Operations.approveRun(dossier, created.run.id).ok, false, 'un lot déjà approuvé ne peut pas être approuvé une seconde fois');
assert.equal(Operations.getRun(dossier.id, created.run.id).status, 'approved');
assert.deepEqual(Operations.runs('another-dossier'), [], 'les lots sont isolés par dossier client');
assert.notEqual(Operations.sourceId(dossier.id, created.run.id), Operations.sourceId('another-dossier', created.run.id));

const secondPeriod = Operations.createDemoRun(dossier, '2026-08');
assert.equal(secondPeriod.ok, true);
assert.deepEqual(Operations.runs(dossier.id).map(run => run.period), ['2026-08', '2026-07']);
console.log('Ventes, stock & facturation interne : lots locaux, approbation, équilibre et isolation — OK');