/* Le moteur IS ne retient que les règles explicites et les montants humainement confirmés. */
'use strict';
const assert = require('node:assert/strict');
const Tax = require('../modern-proto/js/is-tax-adjustments.js');
const Chart = require('../modern-proto/js/accounting-chart.js');
const Framework = require('../modern-proto/js/accounting-framework.js');
const accounts = Chart.accounts();
for (const code of ['89', '891', '8911', '892']) assert.equal(Tax.matchingRule(accounts.find(a => a.code === code)).id, 'is-profit-tax');
for (const code of ['6471', '657', '6687']) assert.equal(Tax.matchingRule(accounts.find(a => a.code === code)).id, 'is-penalty');
assert.equal(Tax.matchingRule({ code: '695', label: 'Impôts sur le résultat', cls: 6, nature: 'Charge' }), null);
const source = [{ id: 'expense', status: 'posted', reference: 'OD-1', date: '2026-02-01', lines: [{ account: '891', debit: 1000 }, { account: '6471', debit: 200 }, { account: '657', debit: 300 }] }];
const expense = Tax.analyze({ accounts, financialFramework: Framework.all(), expensePostCodes: ['RI', 'RJ'], entries: source });
assert.equal(expense.proposals.find(p => p.accountCode === '891').inIncomeStatementBase, false);
assert.equal(expense.automaticReintegrations, 500);
const incomeEntry = [{ id: 'income', status: 'posted', reference: 'BQ-1', date: '2026-03-01', lines: [{ account: '7721', credit: 100000 }, { account: '7745', credit: 80000 }, { account: '7746', credit: 50000 }] }];
const keys = [0, 1, 2].map(i => Tax.reviewKey('income', i, 'is-exempt-security-income'));
const income = Tax.analyze({ accounts, financialFramework: Framework.all(), incomePostCodes: ['TK'], entries: incomeEntry, reviews: [
  { key: keys[0], decision: 'article15-standard', overrideAmount: 50000, note: 'Revenu net et IRCM justifiés' },
  { key: keys[1], decision: 'article15-government', overrideAmount: 80000, note: 'Titre public béninois vérifié' },
  { key: keys[2], decision: 'automatic' }
] });
assert.equal(income.proposals.length, 3);
assert.equal(income.proposals[0].includedAmount, 35000);
assert.equal(income.proposals[1].includedAmount, 80000);
assert.equal(income.proposals[2].decision, 'awaiting-qualification');
assert.equal(income.awaitingQualificationCount, 1);
assert.equal(income.automaticDeductions, 115000);
assert.equal(income.deductionsToImport, 115000);
const noScope = Tax.analyze({ accounts, financialFramework: Framework.all(), incomePostCodes: [], entries: incomeEntry });
assert.equal(noScope.automaticDeductions, 0);
assert.equal(noScope.outsideIsBaseCount, 3);
console.log('IS : art. 15 humainement confirmé, art. 35/36, comptes et base IS configurée — OK');
