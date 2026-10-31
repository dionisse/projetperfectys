/* Calcul des réalisations budgétaires : écritures validées, classement explicite et axes indépendants. */
'use strict';
const assert = require('node:assert/strict');
const BudgetRealizations = require('../modern-proto/js/budget-realizations.js');

const budget = {
  code: '2026C', year: '2026', cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  decomposition: 'month', realizationMode: 'debit-credit', classification: 'A1',
  analyticNatureIds: ['activity-domains'],
  lines: [
    { accountCode: '601', label: 'Services', amountComplete: true, analyticValues: { 'activity-domains': { valueLabel: 'Services' } }, periodAmounts: { '2026-01': 70 } },
    { accountCode: '601', label: 'Biens', amountComplete: true, analyticValues: { 'activity-domains': { valueLabel: 'Biens' } }, periodAmounts: { '2026-01': 30 } }
  ]
};
const entries = [
  { id: 'posted-debit', status: 'posted', date: '2026-01-15', lines: [{ account: '601', debit: 100, credit: 0, analyticSplits: [{ natureId: 'activity-domains', allocations: [
    { valueLabel: 'Services', amount: 60 }, { valueLabel: 'Biens', amount: 30 }
  ], unallocatedAmount: 10 }] }] },
  { id: 'posted-credit', status: 'posted', date: '2026-01-20', lines: [{ account: '601', debit: 0, credit: 30, analyticSplits: [{ natureId: 'activity-domains', allocations: [
    { valueLabel: 'Services', amount: 10 }, { valueLabel: 'Biens', amount: 20 }
  ], unallocatedAmount: 0 }] }] },
  { id: 'draft', status: 'draft', date: '2026-01-18', lines: [{ account: '601', debit: 999, credit: 0 }] },
  { id: 'outside-cycle', status: 'posted', date: '2027-01-02', lines: [{ account: '601', debit: 999, credit: 0 }] },
  { id: 'other-account', status: 'posted', date: '2026-01-22', lines: [{ account: '602', debit: 999, credit: 0 }] }
];

let result = BudgetRealizations.calculate({ budget, entries });
assert.equal(result.ok, true, result.errors && result.errors.join(' '));
assert.equal(result.sourceEntryCount, 3, 'les brouillons et dates hors période sont exclus; les écritures du dossier sont comptées indépendamment des comptes budgétés');
assert.equal(result.matchedSourceLineCount, 2, 'seuls les comptes exacts budgétés sont retenus');
const services = result.rows.find(row => row.key === 'axis:label:Services');
const goods = result.rows.find(row => row.key === 'axis:label:Biens');
const unallocated = result.rows.find(row => row.status === 'unclassified-realization');
assert.equal(services.periods[0].budgetAmount, 70);
assert.equal(services.periods[0].realizationAmount, 50, 'débit-crédit s’applique aux montants explicitement ventilés');
assert.equal(services.periods[0].variance, 20);
assert.equal(goods.periods[0].realizationAmount, 10);
assert.equal(unallocated.periods[0].realizationAmount, 10, 'le reliquat analytique reste non affecté');
assert.equal(result.noAccountingMutation, true);
const creditOnly = BudgetRealizations.calculate({ budget: { ...budget, realizationMode: 'credit' }, entries: [entries[0]] });
assert.equal(creditOnly.rows.find(row => row.key === 'axis:label:Services').periods[0].realizationAmount, 0, 'un zéro issu d’une écriture source est conservé quand la méthode écarte le côté débit');
assert.equal(creditOnly.rows.find(row => row.status === 'unclassified-realization').periods[0].realizationAmount, 0);

const accountBudget = { ...budget, decomposition: 'none', classification: 'C', analyticNatureIds: [], realizationMode: 'debit-credit', lines: [
  { accountCode: '601', label: 'Partie 1', amountComplete: true, annualAmount: 600 },
  { accountCode: '601', label: 'Partie 2', amountComplete: true, annualAmount: 400 }
] };
result = BudgetRealizations.calculate({ budget: accountBudget, entries });
const accountRow = result.rows.find(row => row.key === 'account:601');
assert.equal(accountRow.periods[0].budgetAmount, 1000);
assert.equal(accountRow.periods[0].realizationAmount, 70, 'le réalisé du compte est agrégé une fois, même si le budget comporte plusieurs lignes');
for (const [mode, expected] of [['debit', 100], ['credit', 30], ['credit-debit', -70]]) {
  const modeResult = BudgetRealizations.calculate({ budget: { ...accountBudget, realizationMode: mode }, entries });
  assert.equal(modeResult.rows[0].periods[0].realizationAmount, expected, 'la base ' + mode + ' est respectée');
}

const noSource = BudgetRealizations.calculate({ budget, entries: [] });
assert.equal(noSource.noSourceData, true);
assert.equal(noSource.rows[0].periods[0].realizationAmount, null, 'absence de source affichée comme indisponible, jamais comme zéro réalisé');
const noMatchingLines = BudgetRealizations.calculate({ budget, entries: [entries[4]] });
assert.equal(noMatchingLines.noSourceData, true, 'une écriture sur un compte non budgété ne constitue pas une source de réalisation du budget');
assert.equal(noMatchingLines.rows[0].periods[0].realizationAmount, null);
const februaryBudget = { ...budget, lines: budget.lines.map(line => ({ ...line, periodAmounts: { '2026-01': 70, '2026-02': 30 } })) };
const januaryOnly = BudgetRealizations.calculate({ budget: februaryBudget, entries: entries.slice(0, 2) });
assert.equal(januaryOnly.rows[0].periods[1].key, '2026-02');
assert.equal(januaryOnly.rows[0].periods[1].realizationAmount, null, 'une période sans écriture source reste indisponible, pas zéro');
assert.deepEqual(BudgetRealizations.periodKeys({ ...budget, decomposition: 'quarter' }), ['T1', 'T2', 'T3', 'T4']);

const unmatchedEntries = [{ id: 'posted-other-value', status: 'posted', date: '2026-01-28', lines: [{ account: '601', debit: 15, credit: 0, analyticSplits: [{ natureId: 'activity-domains', allocations: [{ valueLabel: 'Autre valeur', amount: 15 }], unallocatedAmount: 0 }] }] }];
result = BudgetRealizations.calculate({ budget, entries: unmatchedEntries });
assert.ok(result.rows.some(row => row.status === 'unbudgeted-realization' && row.periods[0].realizationAmount === 15));
console.log('Réalisations budgétaires : écritures validées, périodes, signes débit/crédit, classement et reliquats — OK');
