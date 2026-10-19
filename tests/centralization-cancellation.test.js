/* Tests de l’annulation traçable des centralisations PERFECTO internes. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

global.window = global;
require('../modern-proto/js/accounting-chart.js');
require('../modern-proto/js/store.js');
const Store = global.PerfectoStore;
const Cancellation = require('../modern-proto/js/centralization-cancellation.js');

const payrollEntry = {
  id: 'internal-payroll-entry',
  reference: 'PA-2026-CENT-001',
  journal: 'PA',
  date: '2026-08-15',
  description: 'Centralisation interne Paie & RH',
  status: 'posted',
  sourceSystem: 'PERFECTO-PAIE-RH',
  sourceId: 'PERFECTO-PAIE-RH:dossier-1:run-1',
  sourceMetadata: {
    feed: 'internal',
    sourceModule: 'payroll-hr',
    runId: 'run-1',
    runReference: 'PAIE-2026-08-001',
    period: '2026-08'
  },
  lines: [
    { account: '601100', accountLabel: 'Achats de marchandises', debit: 250000, credit: 0 },
    { account: '401100', accountLabel: 'Fournisseurs', debit: 0, credit: 250000 }
  ]
};

assert.equal(Cancellation.isInternalCentralization(payrollEntry), true);
assert.equal(Cancellation.sourceModuleForEntry(payrollEntry), 'payroll-hr');
const salesEntry = {
  ...payrollEntry,
  id: 'internal-sales-entry',
  reference: 'VTE-2026-CENT-001',
  sourceSystem: 'PERFECTO-VENTES-STOCK-FACTURATION',
  sourceId: 'PERFECTO-VENTES-STOCK-FACTURATION:dossier-1:run-2',
  sourceMetadata: { feed: 'internal', sourceModule: 'sales-stock-invoicing', runId: 'run-2', runReference: 'VENTE-2026-08-001' }
};
assert.equal(Cancellation.isInternalCentralization(salesEntry), true);
assert.equal(Cancellation.sourceModuleForEntry(salesEntry), 'sales-stock-invoicing');
assert.equal(Cancellation.sourceModuleForEntry({
  ...payrollEntry,
  sourceSystem: 'SAGE',
  sourceMetadata: { ...payrollEntry.sourceMetadata, sourceModule: 'payroll-hr' }
}), null, 'une pièce Sage ne devient pas annulable par cette fonction');
assert.equal(Cancellation.sourceModuleForEntry({
  ...payrollEntry,
  sourceMetadata: { ...payrollEntry.sourceMetadata, sourceModule: 'sales-stock-invoicing' }
}), null, 'la provenance interne doit correspondre au système source');
assert.equal(Cancellation.isInternalCentralization({ ...payrollEntry, sourceId: '' }), false);

const built = Cancellation.buildReversalEntry(payrollEntry, {
  reference: 'OD-2026-ANN-001',
  journal: 'OD',
  date: '2026-08-20',
  reason: 'Correction du lot de paie'
});
assert.equal(built.ok, true, built.errors.join('\n'));
assert.equal(built.entry.sourceSystem, 'PERFECTO-ANNULATION-CENTRALISATION');
assert.equal(built.entry.sourceMetadata.originalEntryId, payrollEntry.id);
assert.equal(built.entry.sourceMetadata.originalSourceSystem, 'PERFECTO-PAIE-RH');
assert.equal(built.entry.sourceMetadata.originalSourceRunReference, 'PAIE-2026-08-001');
assert.equal(built.entry.sourceMetadata.cancellationReason, 'Correction du lot de paie');
assert.deepEqual(JSON.parse(built.entry.sourceId), [Cancellation.CANCELLATION_SOURCE, payrollEntry.id]);
assert.deepEqual(built.entry.lines.map(line => [line.account, line.debit, line.credit]), [
  ['601100', 0, 250000],
  ['401100', 250000, 0]
]);
assert.equal(Cancellation.isInternalCentralization(built.entry), false, 'une écriture inverse ne peut pas être prise pour une nouvelle centralisation');
assert.equal(Cancellation.findReversal([built.entry], payrollEntry), built.entry);
assert.equal(Cancellation.isCancellationEntry(built.entry), true);

assert.equal(Cancellation.buildReversalEntry({ ...payrollEntry, status: 'draft' }, {
  reference: 'OD-2026-ANN-002', journal: 'OD', date: '2026-08-20', reason: 'Test de brouillon'
}).ok, false, 'un brouillon n’a pas d’effet à inverser');
assert.equal(Cancellation.buildReversalEntry({
  ...payrollEntry,
  lines: [payrollEntry.lines[0], { ...payrollEntry.lines[1], credit: 249999 }]
}, { reference: 'OD-2026-ANN-003', journal: 'OD', date: '2026-08-20', reason: 'Test déséquilibré' }).ok, false, 'une pièce source déséquilibrée est refusée');
assert.equal(Cancellation.buildReversalEntry(payrollEntry, { reference: '', journal: 'OD', date: '2026-08-20', reason: 'Référence absente' }).ok, false);
assert.equal(Cancellation.buildReversalEntry(payrollEntry, { reference: 'OD-2026-ANN-NO-REASON', journal: 'OD', date: '2026-08-20' }).ok, false, 'le motif est obligatoire pour la traçabilité');
assert.equal(Cancellation.buildReversalEntry(payrollEntry, { reference: 'OD-2026-ANN-LONG-REASON', journal: 'OD', date: '2026-08-20', reason: 'x'.repeat(251) }).ok, false, 'le motif est limité à 250 caractères');

const sourceForStore = {
  ...payrollEntry,
  id: undefined,
  reference: 'PA-2026-CENT-STORE-001',
  sourceId: 'PERFECTO-PAIE-RH:demo:store-run',
  sourceMetadata: { ...payrollEntry.sourceMetadata, runId: 'store-run', runReference: 'PAIE-STORE-001' }
};
const originalImport = Store.importExchange([sourceForStore], 'posted', { sourceSystem: 'PERFECTO-PAIE-RH' });
assert.equal(originalImport.ok, true, originalImport.errors.join('\n'));
const original = Store.entries().find(entry => entry.reference === sourceForStore.reference);
assert.ok(original);
assert.equal(original.status, 'posted');
const originalSnapshot = JSON.parse(JSON.stringify(original));
const debitBefore = Store.balance().find(row => row.code === '601100').debit - Store.balance().find(row => row.code === '601100').credit;
const creditBefore = Store.balance().find(row => row.code === '401100').debit - Store.balance().find(row => row.code === '401100').credit;
const storeReversal = Cancellation.buildReversalEntry(original, {
  reference: 'OD-2026-ANN-STORE-001', journal: 'OD', date: '2026-08-20', reason: 'Régularisation du lot source'
});
assert.equal(storeReversal.ok, true, storeReversal.errors.join('\n'));
const options = {
  sourceSystem: Cancellation.CANCELLATION_SOURCE,
  accountMap: Object.create(null),
  journalMap: Object.create(null)
};
const preview = Store.previewExchangeImport([storeReversal.entry], 'draft', options);
assert.equal(preview.ok, true, preview.errors.join('\n'));
const reversalImport = Store.importExchange([storeReversal.entry], 'draft', options);
assert.equal(reversalImport.ok, true, reversalImport.errors.join('\n'));
assert.deepEqual(Store.entry(original.id), originalSnapshot, 'la pièce validée d’origine reste immuable');
const reversal = Store.entries().find(entry => entry.reference === 'OD-2026-ANN-STORE-001');
assert.ok(reversal);
assert.equal(reversal.status, 'draft');
assert.equal(Cancellation.findReversal(Store.entries(), original).id, reversal.id);
const editReversal = Store.updateDraft(reversal.id, {
  reference: 'OD-2026-ANN-ALTERED', journal: 'OD', date: '2026-08-20', description: 'Altération interdite', lines: reversal.lines
});
assert.equal(editReversal.ok, false, 'une écriture inverse préparée ne peut pas être modifiée');
assert.equal(Store.previewExchangeImport([storeReversal.entry], 'draft', options).ok, false, 'l’identifiant de l’annulation empêche un doublon');

const postedReversal = Store.postEntry(reversal.id);
assert.equal(postedReversal.ok, true, postedReversal.errors.join('\n'));
const debitAfter = Store.balance().find(row => row.code === '601100').debit - Store.balance().find(row => row.code === '601100').credit;
const creditAfter = Store.balance().find(row => row.code === '401100').debit - Store.balance().find(row => row.code === '401100').credit;
assert.equal(debitAfter - debitBefore, -250000, 'le débit d’origine sur le compte de charge est repris au crédit');
assert.equal(creditAfter - creditBefore, 250000, 'le crédit d’origine sur le compte fournisseur est repris au débit');
assert.deepEqual(Store.entry(original.id), originalSnapshot, 'la pièce d’origine n’est toujours pas modifiée après validation de l’inverse');
assert.equal(Cancellation.findReversal(Store.entries(), original).status, 'posted');

const draftSource = {
  ...sourceForStore,
  reference: 'PA-2026-CENT-DRAFT-001',
  sourceId: 'PERFECTO-PAIE-RH:demo:draft-run',
  sourceMetadata: { ...sourceForStore.sourceMetadata, runId: 'draft-run', runReference: 'PAIE-DRAFT-001' }
};
const draftImport = Store.importExchange([draftSource], 'draft', { sourceSystem: 'PERFECTO-PAIE-RH' });
assert.equal(draftImport.ok, true, draftImport.errors.join('\n'));
const draft = Store.entries().find(entry => entry.reference === draftSource.reference);
assert.equal(draft.status, 'draft');
assert.equal(Store.deleteDraft(draft.id).ok, true);
assert.equal(Store.entry(draft.id), null, 'le brouillon non comptabilisé peut être retiré sans toucher au lot source');
assert.equal(Store.backupInfo().available, true, 'la suppression laisse un point de restauration local');
assert.equal(Store.previewExchangeImport([draftSource], 'draft', { sourceSystem: 'PERFECTO-PAIE-RH' }).ok, true, 'le lot maison reste retransférable après annulation du brouillon');

console.log('Annulation des centralisations internes : source maison, écriture inverse, immuabilité, anti-doublon et brouillon — OK');
