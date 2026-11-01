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
assert.match(unconfirmed.errors.join(' '), /confirmez sur justificatif/);
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
assert.match(invoiceOver.errors.join(' '), /dépasse la créance source de la facture/);
const receiptOver = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...mapping, rows: [stored, { invoiceEntryId: invoice.entry.id, receiptEntryId: receipt.entry.id, amount: 1, analyticalAllocations: [] }]
});
assert.equal(receiptOver.ok, false);
assert.match(receiptOver.errors.join(' '), /dépasse le crédit client source/);
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

const clientAccount = S.accounts().find(account => account.aux === true && account.active !== false && account.postable !== false && /^411/.test(account.code) && !/^4117/.test(account.code));
assert.ok(clientAccount, 'le plan fournit un compte auxiliaire client imputable.');
const explicitClient = S.createClient({ code: 'ALLOC-CLIENT-1', name: 'Client lié explicitement', accountCode: clientAccount.code });
assert.equal(explicitClient.ok, true, explicitClient.errors.join(' '));
const secondExplicitClient = S.createClient({ code: 'ALLOC-CLIENT-2', name: 'Autre client explicite', accountCode: clientAccount.code });
assert.equal(secondExplicitClient.ok, true, secondExplicitClient.errors.join(' '));
const linkedInvoice = S.createEntry({
  reference: 'FAC-CLIENT-ID-1', journal: 'VTE', date: '2026-06-01', description: 'Facture client identifiée',
  lines: [{ account: clientAccount.code, debit: 1000, credit: 0, thirdPartyType: 'client', thirdPartyId: explicitClient.client.id }, { account: '701', debit: 0, credit: 1000 }]
}, 'posted');
assert.equal(linkedInvoice.ok, true, linkedInvoice.errors.join(' '));
const linkedReceipt = S.createEntry({
  reference: 'BQ-CLIENT-ID-1', journal: 'BQ', date: '2026-06-10', description: 'Encaissement client identifié',
  lines: [{ account: '512', debit: 700, credit: 0 }, { account: clientAccount.code, debit: 0, credit: 700, thirdPartyType: 'client', thirdPartyId: explicitClient.client.id }]
}, 'posted');
assert.equal(linkedReceipt.ok, true, linkedReceipt.errors.join(' '));
const linkedInvoice2 = S.createEntry({
  reference: 'FAC-CLIENT-ID-2', journal: 'VTE', date: '2026-06-02', description: 'Facture autre client',
  lines: [{ account: clientAccount.code, debit: 500, credit: 0, thirdPartyType: 'client', thirdPartyId: secondExplicitClient.client.id }, { account: '701', debit: 0, credit: 500 }]
}, 'posted');
assert.equal(linkedInvoice2.ok, true, linkedInvoice2.errors.join(' '));
const linkedReceipt2 = S.createEntry({
  reference: 'BQ-CLIENT-ID-2', journal: 'BQ', date: '2026-06-11', description: 'Encaissement autre client',
  lines: [{ account: '512', debit: 500, credit: 0 }, { account: clientAccount.code, debit: 0, credit: 500, thirdPartyType: 'client', thirdPartyId: secondExplicitClient.client.id }]
}, 'posted');
assert.equal(linkedReceipt2.ok, true, linkedReceipt2.errors.join(' '));
const exactClientMapping = { customerAccountCodes: [clientAccount.code], cashAccountCodes: ['512'] };
const preservedLegacyRows = S.analyticalInvoicePaymentAllocationConfiguration().rows;
const directIdentity = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...exactClientMapping, rows: preservedLegacyRows.concat([{ invoiceEntryId: linkedInvoice.entry.id, receiptEntryId: linkedReceipt.entry.id, thirdPartyId: explicitClient.client.id, amount: 600, identityConfirmed: false }])
});
assert.equal(directIdentity.ok, true, directIdentity.errors.join(' '));
const explicitAllocation = S.analyticalInvoicePaymentAllocationConfiguration().rows.find(row => row.invoiceEntryId === linkedInvoice.entry.id);
assert.equal(explicitAllocation.thirdPartyId, explicitClient.client.id);
assert.equal(explicitAllocation.thirdPartyCode, explicitClient.client.code);
assert.equal(explicitAllocation.identitySource, 'explicit');
assert.equal(explicitAllocation.identityConfirmed, true, 'l’identité explicite source suffit, sans case manuelle.');
const preserveAfterDirect = S.analyticalInvoicePaymentAllocationConfiguration().rows;
const crossClient = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...exactClientMapping, rows: preserveAfterDirect.concat([{ invoiceEntryId: linkedInvoice.entry.id, receiptEntryId: linkedReceipt2.entry.id, thirdPartyId: explicitClient.client.id, amount: 100 }])
});
assert.equal(crossClient.ok, false);
assert.match(crossClient.errors.join(' '), /crédit client correspondant à cette identité/);
const strippedIdentity = S.saveAnalyticalInvoicePaymentAllocationConfiguration({
  ...exactClientMapping, rows: preserveAfterDirect.concat([{ invoiceEntryId: linkedInvoice.entry.id, receiptEntryId: linkedReceipt.entry.id, amount: 100, identityConfirmed: true }])
});
assert.equal(strippedIdentity.ok, false, 'une confirmation manuelle ne contourne pas les références déjà présentes et explicites.');
assert.match(strippedIdentity.errors.join(' '), /facture ne présente pas de créance débitrice/);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(navigation, /id: 'invoice-payment-allocation',[^\n]*status: 'active'/);
assert.match(app, /function viewAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /function openAnalyticalInvoicePaymentClassifications\(/);
assert.match(app, /exchangeFeature = viewAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /bindAnalyticalInvoicePaymentAllocation\(\)/);
assert.match(app, /aucune imputation de la facture n’est copiée automatiquement/i);
assert.match(app, /function partyGroups\(entry, positiveSide, negativeSide\)/);
assert.match(app, /thirdPartyId: explicitlyMatched \? invoiceCandidate\.thirdPartyId : ''/);
assert.match(app, /Identité vérifiée par la source/);
assert.match(app, /une source partiellement identifiée ne peut pas être rapprochée manuellement/i);
assert.doesNotMatch(app, /les écritures sources ne portent pas d’identifiant auxiliaire individuel/);
assert.match(css, /\.invoice-payment-summary/);
console.log('Affectation analytique facture–règlement : pièces validées, comptes exacts, limites de soldes et axes explicites — OK');
