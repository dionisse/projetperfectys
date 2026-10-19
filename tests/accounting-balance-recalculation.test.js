/* Tests du recalcul indépendant des soldes du grand livre. */
'use strict';

const assert = require('node:assert/strict');
const { recalculate, compareBalances, validIsoDate } = require('../modern-proto/js/accounting-balance-recalculation.js');

const accounts = [
  { code: '101200', label: 'Capital social' },
  { code: '401100', label: 'Fournisseurs' },
  { code: '521100', label: 'Banque' },
  { code: '601100', label: 'Achats de marchandises' }
];
const entries = [
  {
    id: 'opening-1', reference: 'BQ-2026-001', journal: 'BQ', date: '2026-01-05', status: 'posted',
    lines: [
      { account: '521100', debit: 1000, credit: 0 },
      { account: '101200', debit: 0, credit: 1000 }
    ]
  },
  {
    id: 'purchase-1', reference: 'ACH-2026-001', journal: 'ACH', date: '2026-01-12', status: 'posted',
    lines: [
      { account: '601100', debit: 500, credit: 0 },
      { account: '401100', debit: 0, credit: 500 }
    ]
  },
  {
    id: 'draft-1', reference: 'OD-2026-BROUILLON', journal: 'OD', date: '2026-01-15', status: 'draft',
    lines: [
      { account: '601100', debit: 900, credit: 0 },
      { account: '401100', debit: 0, credit: 900 }
    ]
  },
  {
    id: 'outside-cycle', reference: 'OD-2025-001', journal: 'OD', date: '2025-12-31', status: 'posted',
    lines: [
      { account: '521100', debit: 300, credit: 0 },
      { account: '101200', debit: 0, credit: 300 }
    ]
  }
];
const originalEntries = JSON.parse(JSON.stringify(entries));

assert.equal(validIsoDate('2026-02-28'), true);
assert.equal(validIsoDate('2026-02-29'), false);

const result = recalculate(entries, accounts, { cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(result.ok, true);
assert.equal(result.entriesCount, 2);
assert.equal(result.excludedDraftCount, 1);
assert.equal(result.outsideCyclePostedCount, 1);
assert.deepEqual(result.outsideCycleEntries, [{ id: 'outside-cycle', reference: 'OD-2025-001', date: '2025-12-31' }]);
assert.equal(result.movementCount, 4);
assert.equal(result.totalDebit, 1500);
assert.equal(result.totalCredit, 1500);
assert.equal(result.balanced, true);
assert.equal(result.rows.length, 4);
assert.equal(result.rows.find(row => row.code === '521100').debitBalance, 1000);
assert.equal(result.rows.find(row => row.code === '101200').creditBalance, 1000);
assert.ok(result.warnings.some(message => message.includes('hors cycle')));
assert.deepEqual(entries, originalEntries, 'le recalcul ne modifie pas les écritures sources');

const sameAsCurrent = compareBalances(result.rows, result.rows.map(row => ({
  code: row.code, label: row.label, debit: row.debit, credit: row.credit
})));
assert.equal(sameAsCurrent.ok, true);
assert.deepEqual(sameAsCurrent.differences, []);
const mismatch = compareBalances(result.rows, [{ code: '521100', debit: 999, credit: 0 }]);
assert.equal(mismatch.ok, false);
assert.ok(mismatch.differences.some(row => row.code === '521100'));

const unknownAccount = recalculate([{
  id: 'unknown', reference: 'OD-2026-001', journal: 'OD', date: '2026-02-01', status: 'posted',
  lines: [
    { account: '899999', accountLabel: 'Compte inconnu', debit: 25, credit: 0 },
    { account: '401100', debit: 0, credit: 25 }
  ]
}], accounts, { cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(unknownAccount.ok, true);
assert.deepEqual(unknownAccount.unknownAccounts, ['899999']);
assert.ok(unknownAccount.warnings.some(message => message.includes('899999')));
assert.equal(unknownAccount.rows.find(row => row.code === '899999').label, 'Compte inconnu');

const unbalanced = recalculate([{
  id: 'bad', reference: 'OD-ERR-1', journal: 'OD', date: '2026-02-01', status: 'posted',
  lines: [
    { account: '601100', debit: 30, credit: 0 },
    { account: '401100', debit: 0, credit: 20 }
  ]
}], accounts, { cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(message => message.includes('n’est pas équilibrée')));
assert.equal(unbalanced.balanced, false);

const invalidLine = recalculate([{
  id: 'bad-line', reference: 'OD-ERR-2', journal: 'OD', date: '2026-02-01', status: 'posted',
  lines: [
    { account: '601100', debit: -1, credit: 0 },
    { account: '401100', debit: 0, credit: 0 }
  ]
}], accounts, { cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(invalidLine.ok, false);
assert.ok(invalidLine.errors.some(message => message.includes('montant invalide')));

const badCycle = recalculate(entries, accounts, { cycleStart: '2026-13-01', cycleEnd: '2026-12-31' });
assert.equal(badCycle.ok, false);
assert.match(badCycle.errors[0], /cycle comptable/);

console.log('Recalcul des soldes : période, équilibre, exclusions, comparaison et lecture seule — OK');
