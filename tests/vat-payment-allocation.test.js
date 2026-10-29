/* Tests de l’affectation explicite des encaissements partiels aux factures. */
'use strict';

const assert = require('node:assert/strict');
require('../modern-proto/js/vat-payment-allocation.js');
const allocation = globalThis.PerfectoVatPaymentAllocation;
const entries = [
  { id: 'inv-1', status: 'posted', date: '2026-01-10', reference: 'V001', lines: [
    { account: '411100', debit: 1180000, credit: 0 },
    { account: '706100', debit: 0, credit: 1000000 },
    { account: '445900', debit: 0, credit: 180000 }
  ] },
  { id: 'pay-1', status: 'posted', date: '2026-02-10', reference: 'BQ001', lines: [
    { account: '521000', debit: 590000, credit: 0 },
    { account: '411100', debit: 0, credit: 590000 }
  ] },
  { id: 'draft', status: 'draft', date: '2026-02-11', lines: [
    { account: '521000', debit: 590000, credit: 0 }, { account: '411100', debit: 0, credit: 590000 }
  ] }
];
const config = { customerAccounts: ['411*'], suspenseAccounts: ['4459*'] };

assert.equal(allocation.invoiceGross(entries[0], config.customerAccounts), 1180000);
assert.equal(allocation.receiptApplied(entries[1], config.customerAccounts), 590000);
assert.equal(allocation.pendingVat(entries[0], config.suspenseAccounts), 180000);

const first = { id: 'a1', invoiceEntryId: 'inv-1', receiptEntryId: 'pay-1', amountTtc: 590000 };
const valid = allocation.validateAllocation(first, Object.assign({ entries, allocations: [] }, config));
assert.equal(valid.ok, true);
const release = allocation.calculateReleasedVat({
  entries, allocations: [first], period: '2026-02', decimalPlaces: 0,
  customerAccounts: config.customerAccounts, suspenseAccounts: config.suspenseAccounts
});
assert.equal(release.ok, true);
assert.equal(release.total, 90000);
assert.equal(release.rows[0].vatReleased, 90000);

const overInvoice = allocation.validateAllocation({ id: 'a2', invoiceEntryId: 'inv-1', receiptEntryId: 'pay-1', amountTtc: 600000 }, Object.assign({ entries, allocations: [first] }, config));
assert.equal(overInvoice.ok, false);
assert.match(overInvoice.errors.join(' '), /dépasse/);
const draftInvoice = allocation.validateAllocation({ invoiceEntryId: 'draft', receiptEntryId: 'pay-1', amountTtc: 100 }, Object.assign({ entries, allocations: [] }, config));
assert.equal(draftInvoice.ok, false);
assert.match(draftInvoice.errors.join(' '), /facture comptabilisée/);

const twoRates = allocation.calculateReleasedVat({
  entries: [Object.assign({}, entries[0], { lines: [
    { account: '411100', debit: 1180000, credit: 0 },
    { account: '706100', debit: 0, credit: 1000000 },
    { account: '445900', debit: 0, credit: 180000 },
    { account: '521000', debit: 0, credit: 0 }
  ] }), entries[1]],
  allocations: [first], period: '2026-02', customerAccounts: ['411*'], suspenseAccounts: ['4459*']
});
assert.equal(twoRates.total, 90000, 'le ratio utilise la TVA réellement portée sur la facture');
console.log('OK · affectations facture-règlement et TVA exigible sur encaissement');
