/* Affectations analytiques d’encaissements : pièces validées, comptes exacts, reliquats explicites. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const values = new Map();
const localStorage = { getItem(key) { return values.has(key) ? values.get(key) : null; }, setItem(key, value) { values.set(key, String(value)); }, removeItem(key) { values.delete(key); } };
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array, Set, Map };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
const S = sandbox.window.PerfectoStore;
const initialDossierId = S.currentDossier().id;
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalInvoicePaymentAllocationConfiguration())), {
  customerAccountCodes: [], cashAccountCodes: [], rows: [], updatedAt: ''
}, 'aucun compte, facture, règlement ou classement n’est présélectionné');

const invoice = S.createEntry({
  reference: 'FAC-REELLE-001', journal: 'VTE', date: '2026-05-01', description: 'Facture client saisie',
  lines: [{ account: '411', debit: 10000, credit: 0 }, { account: '701', debit: 0, credit: 10000 }]
}, 'posted');
assert.equal(invoice.ok, true, invoice.errors && invoice.errors.join(' '));
const receipt = S.createEntry({
  reference: 'BQ-ENCAISSEMENT-001', journal: 'BQ', date: '2026-05-10', description: 'Encaissement bancaire saisi',
  lines: [{ account: '512', debit: 6000, credit: 0 }, { account: '411', debit: 0, credit: 6000 }]
}, 'posted');
assert.equal(receipt.ok, true, receipt.errors && receipt.errors.join(' '));

const notConfigured = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  customerAccountCodes: [], cashAccountCodes: [], rows: [{ invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 6000 }]
});
assert.equal(notConfigured.ok, false);
assert.match(notConfigured.errors.join(' '), /configurez d’abord les comptes clients exacts/);
const wrongClass = S.saveAnalyticalInvoicePaymentAllocationConfiguration({ customerAccountCodes: ['701'], cashAccountCodes: ['571'], rows: [] });
assert.equal(wrongClass.ok, false);
assert.match(wrongClass.errors.join(' '), /ne relève pas des comptes clients 41/);

const mapping = { customerAccountCodes: ['411'], cashAccountCodes: ['512'], rows: [] };
const unconfirmed = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 6000, analyticalAllocations: [] }]
});
assert.equal(unconfirmed.ok, false);
assert.match(unconfirmed.errors.join(' '), /confirmez avoir vérifié sur justificatif/);
const added = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 6000, reference: 'RAPPROCHEMENT-001', identityConfirmed: true, analyticalAllocations: [] }]
});
assert.equal(added.ok, true, added.errors && added.errors.join(' '));
let stored = JSON.parse(JSON.stringify(S.analyticalInvoicePaymentAllocationConfiguration().rows[0]));
assert.equal(stored.amount, 6000);
assert.equal(stored.invoiceReference, 'FAC-REELLE-001');
assert.equal(stored.receiptReference, 'BQ-ENCAISSEMENT-001');
assert.equal(stored.reference, 'RAPPROCHEMENT-001');
assert.equal(stored.identityConfirmed, true);
assert.equal(stored.analyticalAllocations.length, 0, 'aucune imputation analytique n’est héritée de la facture');

const invalidStatus = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ ...stored, status: 'paid' }]
});
assert.equal(invalidStatus.ok, false);
assert.match(invalidStatus.errors.join(' '), /état invalide/);
const invoiceOver = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [stored, { invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 4001, analyticalAllocations: [] }]
});
assert.equal(invoiceOver.ok, false);
assert.match(invoiceOver.errors.join(' '), /dépasse la créance de la facture/);
const receiptOver = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [stored, { invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 1, analyticalAllocations: [] }]
});
assert.equal(receiptOver.ok, false);
assert.match(receiptOver.errors.join(' '), /dépasse le règlement client comptabilisé/);
const futurePayment = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ invoiceEntryId: invoice.entry.id, receiptEntryId: invoice.entry.id, amount: 100 }]
});
assert.equal(futurePayment.ok, false);
assert.match(futurePayment.errors.join(' '), /pièces distinctes/);

assert.equal(S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Services', active: true }]).ok, true);
assert.equal(S.saveAnalyticalDimensionValues('expense-categories', [{ label: 'Prestation', active: true }]).ok, true);
let classified = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ ...stored, analyticalAllocations: [
    { natureId: 'activity-domains', valueLabel: 'Services', amount: 6000 },
    { natureId: 'expense-categories', valueLabel: 'Prestation', amount: 6000 }
  ] }]
});
assert.equal(classified.ok, true, classified.errors && classified.errors.join(' '));
assert.equal(S.analyticalInvoicePaymentAllocationConfiguration().rows[0].analyticalAllocations.length, 2, 'axes analytiques parallèles conservés sans s’additionner');
const overNature = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ ...S.analyticalInvoicePaymentAllocationConfiguration().rows[0], analyticalAllocations: [
    { natureId: 'activity-domains', valueLabel: 'Services', amount: 6001 }
  ] }]
});
assert.equal(overNature.ok, false);
assert.match(overNature.errors.join(' '), /dépasse le montant de règlement affecté/);
const unknownValue = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [{ ...stored, analyticalAllocations: [{ natureId: 'activity-domains', valueLabel: 'Valeur inventée', amount: 100 }]}]
});
assert.equal(unknownValue.ok, false);
assert.match(unknownValue.errors.join(' '), /valeur est absente ou inactive/);

const noDelete = S.saveAnalyticalInvoicePaymentAllocationConfiguration({ ...mapping, rows: [] });
assert.equal(noDelete.ok, false);
assert.match(noDelete.errors.join(' '), /ne peut pas être supprimée/);
stored = JSON.parse(JSON.stringify(S.analyticalInvoicePaymentAllocationConfiguration().rows[0]));
const cancelled = S.saveAnalyticalInvoicePaymentAllocationConfiguration({ ...mapping, rows: [{ ...stored, status: 'cancelled' }] });
assert.equal(cancelled.ok, true, cancelled.errors && cancelled.errors.join(' '));
assert.equal(S.analyticalInvoicePaymentAllocationConfiguration().rows[0].status, 'cancelled');

const created = S.createDossier({ clientName: 'Dossier affectations isolées', clientCode: 'AFF', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(created.ok, true, created.errors && created.errors.join(' '));
assert.equal(S.switchDossier(created.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalInvoicePaymentAllocationConfiguration().rows)), []);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalInvoicePaymentAllocationConfiguration().customerAccountCodes)), []);
assert.equal(S.switchDossier(initialDossierId).ok, true);
assert.equal(S.analyticalInvoicePaymentAllocationConfiguration().rows[0].status, 'cancelled');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(navigation, /id: 'invoice-payment-allocation',[^\n]*status: 'active'/);
assert.match(app, /function viewAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /function openAnalyticalInvoicePaymentClassifications\(/);
assert.match(app, /exchangeFeature = viewAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /bindAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /aucune imputation de la facture n’est copiée automatiquement/i);
assert.match(css, /\.invoice-payment-summary/);
console.log('Affectation analytique facture–règlement : pièces validées, comptes exacts, limites de soldes et axes explicites — OK');
