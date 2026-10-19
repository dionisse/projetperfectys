/* Tests de la centralisation interne Ventes, stock & facturation → Comptabilité. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const Operations = require('../modern-proto/js/sales-stock-invoicing.js');
const Centralization = require('../modern-proto/js/sales-centralization.js');
const dossier = { id: 'dossier-1', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' };
const runResult = Operations.createDemoRun(dossier, '2026-01');
assert.equal(runResult.ok, true, runResult.errors.join('\n'));
assert.equal(Operations.approveRun(dossier, runResult.run.id).ok, true);
const run = Operations.getRun(dossier.id, runResult.run.id);
const accounts = [
  { code: '411100', label: 'Clients', active: true, aux: true },
  { code: '701000', label: 'Ventes de marchandises', active: true },
  { code: '601100', label: 'Achats de marchandises', active: true },
  { code: '401100', label: 'Fournisseurs', active: true, aux: true },
  { code: '445100', label: 'TVA collectée', active: true }
];

const mappings = { '411100': '411100', '701000': '701000', '601100': '601100', '401100': '401100' };
const aggregated = Centralization.aggregate(run, mappings, accounts);
assert.equal(aggregated.ok, true, aggregated.errors.join('\n'));
assert.equal(aggregated.totalDebit, 1800000);
assert.equal(aggregated.totalCredit, 1800000);
assert.equal(aggregated.lines.length, 4);
assert.equal(aggregated.accountMappings.length, 4);

const notApproved = Centralization.aggregate({ ...run, status: 'draft' }, mappings, accounts);
assert.equal(notApproved.ok, false);
assert.ok(notApproved.errors.some(error => error.includes('lots approuvés')));

const missingMapping = Centralization.aggregate(run, { ...mappings, '401100': '' }, accounts);
assert.equal(missingMapping.ok, false);
assert.ok(missingMapping.errors.some(error => error.includes('sans correspondance')));

const inactive = Centralization.aggregate(run, mappings, [
  ...accounts.filter(account => account.code !== '701000'),
  { code: '701000', label: 'Ventes de marchandises', active: false }
]);
assert.equal(inactive.ok, false);
assert.ok(inactive.errors.some(error => error.includes('inactif')));

const unbalancedRun = { ...run, accountingLines: run.accountingLines.map(line => ({ ...line })) };
unbalancedRun.accountingLines[0].debit += 1;
const unbalanced = Centralization.aggregate(unbalancedRun, mappings, accounts);
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('n’est pas équilibré')));

const merged = Centralization.aggregate(run, { ...mappings, '701000': '411100' }, accounts);
assert.equal(merged.ok, true, merged.errors.join('\n'));
assert.deepEqual(merged.lines.filter(line => line.account === '411100').map(line => [line.debit, line.credit]), [[1200000, 0], [0, 1200000]], 'les débits et crédits restent séparés après agrégation');
console.log('Centralisation interne Ventes, stock & facturation : approbation, correspondances et agrégation — OK');