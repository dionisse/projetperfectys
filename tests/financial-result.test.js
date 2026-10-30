/* Calcul du résultat comptable à date : écritures validées et reports explicites seulement. */
'use strict';
const assert = require('node:assert/strict');
const FinancialResult = require('../modern-proto/js/financial-result.js');
const input = {
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31', asOfDate: '2026-06-30',
  accounts: [{ code: '101', label: 'Capital', cls: 1, nature: 'Passif' }, { code: '601', label: 'Achats', cls: 6, nature: 'Charge' }],
  entries: [
    { date: '2026-01-05', status: 'posted', lines: [{ account: '601', debit: 100, credit: 0 }, { account: '401', debit: 0, credit: 100 }] },
    { date: '2026-07-01', status: 'posted', lines: [{ account: '601', debit: 50, credit: 0 }] },
    { date: '2026-03-01', status: 'draft', lines: [{ account: '601', debit: 999, credit: 0 }] },
    { date: '2025-12-31', status: 'posted', lines: [{ account: '601', debit: 999, credit: 0 }] }
  ],
  openingBalances: [
    { accountCode: '101', date: '2025-12-31', debit: 0, credit: 500 },
    { accountCode: '101', date: '2026-01-01', debit: 0, credit: 300 }
  ]
};
const result = FinancialResult.calculate(input);
assert.equal(result.ok, true);
assert.equal(result.asOfDate, '2026-06-30');
assert.equal(result.postedEntryCount, 1);
assert.equal(result.openingBalanceCount, 1);
assert.deepEqual(result.balance.map(row => [row.code, row.debit, row.credit]), [['101', 0, 500], ['401', 0, 100], ['601', 100, 0]]);
assert.equal(FinancialResult.calculate({ ...input, asOfDate: '2026-12-31' }).postedEntryCount, 2);
assert.equal(FinancialResult.calculate({ ...input, asOfDate: '2026-02-30' }).ok, false);
assert.equal(FinancialResult.calculate({ ...input, asOfDate: '2025-12-31' }).ok, false);
assert.equal(FinancialResult.calculate({ ...input, asOfDate: '2027-01-01' }).ok, false);
const mappedResult = FinancialResult.accountingResult({
  balance: [{ code: '601', cls: 6, debit: 100, credit: 0 }, { code: '701', cls: 7, debit: 0, credit: 150 }],
  financialFramework: [
    { code: '6', debit: { code: 'R' }, credit: { code: 'R' } },
    { code: '7', debit: { code: 'T' }, credit: { code: 'T' } }
  ]
});
assert.equal(mappedResult.complete, true);
assert.equal(mappedResult.result, 50);
assert.equal(FinancialResult.accountingResult({ balance: [{ code: '601', cls: 6, debit: 100, credit: 0 }] }).complete, false, 'un compte de résultat sans correspondance n’est pas imputé à zéro');
console.log('Résultat à date : cycle borné, écritures validées, reports explicites et aucune mutation — OK');
