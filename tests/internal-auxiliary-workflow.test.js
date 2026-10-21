/* Parcours fichier interne : contrôle source, aperçu pur, brouillon, source conservée et inversion liée. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
global.window = global;
global.fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
require('../modern-proto/js/accounting-chart.js');
require('../modern-proto/js/store.js');
const Store = global.PerfectoStore;
const Exchange = require('../modern-proto/js/accounting-exchange.js');
const Centralization = require('../modern-proto/js/accounting-centralization.js');
const Cancellation = require('../modern-proto/js/centralization-cancellation.js');

const dossier = Store.currentDossier();
const sourceSystem = 'PERFECTO-PAIE-RH';
const batchReference = 'AUX-WORKFLOW-TEST-001';
const pieceDate = dossier.cycleStart;
const rows = [
  ['PERFECTO-AUXILIAIRE', '1', sourceSystem, dossier.reference, String(dossier.exerciseYear), batchReference, 'AC', pieceDate, 'AC-WORKFLOW-001', 'Pièce auxiliaire test', '601100', 'Achats', '', '', 'Achat', '1250', '0', 'workflow-test-001'],
  ['PERFECTO-AUXILIAIRE', '1', sourceSystem, dossier.reference, String(dossier.exerciseYear), batchReference, 'AC', pieceDate, 'AC-WORKFLOW-001', 'Pièce auxiliaire test', '401100', 'Fournisseurs', 'SUP-TEST-001', 'Fournisseur test', 'Dette fournisseur', '0', '1250', 'workflow-test-002'],
  ['PERFECTO-AUXILIAIRE', '1', sourceSystem, dossier.reference, String(dossier.exerciseYear), batchReference, 'BQ', pieceDate, 'BQ-WORKFLOW-001', 'Règlement auxiliaire test', '401100', 'Fournisseurs', 'SUP-TEST-001', 'Fournisseur test', 'Règlement fournisseur', '350', '0', 'workflow-test-003'],
  ['PERFECTO-AUXILIAIRE', '1', sourceSystem, dossier.reference, String(dossier.exerciseYear), batchReference, 'BQ', pieceDate, 'BQ-WORKFLOW-001', 'Règlement auxiliaire test', '521100', 'Banque', '', '', 'Sortie banque', '0', '350', 'workflow-test-004']
];
const csv = '\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...rows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';'))
  .join('\r\n') + '\r\n';
const parsed = Exchange.parseAuxiliary(csv);
assert.equal(parsed.ok, true, parsed.errors.join('\n'));
assert.equal(Centralization.validateSourceContext(parsed, dossier).ok, true);

const accountMap = { '601100': '601100', '401100': '401100', '521100': '521100' };
const aggregated = Centralization.aggregate(parsed, accountMap, Store.accounts());
assert.equal(aggregated.ok, true, aggregated.errors.join('\n'));
assert.equal(aggregated.totalDebit, 1600);
assert.equal(aggregated.totalCredit, 1600);
const built = Centralization.buildEntry(parsed, aggregated, {
  dossier,
  reference: 'AUX-CEN-WORKFLOW-001',
  journal: 'OD',
  date: pieceDate,
  sourceFileSha256: 'd'.repeat(64)
});
assert.equal(built.ok, true, built.errors.join('\n'));

const beforePreview = JSON.stringify(Store.entries());
const options = {
  sourceSystem: Centralization.INTERNAL_SOURCE_SYSTEM,
  accountMap: Object.create(null),
  journalMap: Object.create(null)
};
const preview = Store.previewExchangeImport([built.entry], 'draft', options);
assert.equal(preview.ok, true, preview.errors.join('\n'));
assert.equal(JSON.stringify(Store.entries()), beforePreview, 'l’aperçu et l’agrégation ne mutent aucune écriture');

const sourceHash = 'd'.repeat(64);
const sourceFile = {
  sourceSystem: Exchange.AUXILIARY_FORMAT,
  sourceFormat: Exchange.AUXILIARY_FORMAT,
  sourceVersion: Exchange.AUXILIARY_VERSION,
  sourceProducer: sourceSystem,
  sourceDossierReference: dossier.reference,
  sourceExercise: dossier.exerciseYear,
  sourceBatchReference: batchReference,
  fileName: 'mouvements-auxiliaires-test.csv',
  mimeType: 'text/csv;charset=utf-8',
  fileSize: Buffer.byteLength(csv),
  byteLength: Buffer.byteLength(csv),
  sha256: sourceHash,
  contentBase64: Buffer.from(csv, 'utf8').toString('base64'),
  encoding: 'UTF-8',
  delimiter: ';',
  headerCount: Exchange.AUXILIARY_HEADERS.length,
  lineCount: parsed.rows.length,
  sourceMovementCount: parsed.rows.length,
  documentCount: parsed.documentCount,
  auxiliaryMovementCount: parsed.auxiliaryMovementCount,
  totalDebit: parsed.totalDebit,
  totalCredit: parsed.totalCredit,
  localOnly: true
};
const importedResult = Store.importExchange([built.entry], 'draft', { ...options, importSourceFile: sourceFile });
assert.equal(importedResult.ok, true, importedResult.errors.join('\n'));
const imported = Store.entries().find(entry => entry.importBatchId === importedResult.batchId);
assert.ok(imported);
assert.equal(imported.status, 'draft');
assert.equal(imported.sourceSystem, Centralization.INTERNAL_SOURCE_SYSTEM);
assert.equal(imported.sourceReference, batchReference);
assert.equal(imported.sourceJournal, '', 'un lot couvrant plusieurs journaux source ne prétend pas n’en avoir qu’un');
assert.equal(imported.sourceMetadata.operation, 'auxiliary-centralization');
assert.equal(imported.sourceMetadata.sourceFileId, sourceHash);
assert.equal(Cancellation.isInternalCentralization(imported), true);
assert.equal(Cancellation.sourceModuleForEntry(imported), 'accounting');
assert.equal(Store.importSourceFile(importedResult.batchId).contentBase64, sourceFile.contentBase64);

const cancelled = Store.cancelImportBatch(importedResult.batchId);
assert.equal(cancelled.ok, true, cancelled.errors.join('\n'));
assert.equal(Store.entries().some(entry => entry.importBatchId === importedResult.batchId), false);
assert.equal(Store.importSourceFiles().find(source => source.id === importedResult.batchId).status, 'cancelled');
assert.equal(Store.importSourceFile(importedResult.batchId).contentBase64, sourceFile.contentBase64, 'l’annulation conserve le fichier original');

const retried = Store.importExchange([built.entry], 'draft', { ...options, importSourceFile: sourceFile });
assert.equal(retried.ok, true, retried.errors.join('\n'));
const retryEntry = Store.entries().find(entry => entry.importBatchId === retried.batchId);
assert.ok(retryEntry);
const posted = Store.postEntry(retryEntry.id);
assert.equal(posted.ok, true, posted.errors.join('\n'));
const reversal = Cancellation.buildReversalEntry(posted.entry, {
  reference: 'AUX-CEN-REV-WORKFLOW-001',
  journal: 'OD',
  date: pieceDate,
  reason: 'Test de correction auxiliaire'
});
assert.equal(reversal.ok, true, reversal.errors.join('\n'));
const reversalImport = Store.importExchange([reversal.entry], 'draft', {
  sourceSystem: Cancellation.CANCELLATION_SOURCE,
  accountMap: Object.create(null),
  journalMap: Object.create(null)
});
assert.equal(reversalImport.ok, true, reversalImport.errors.join('\n'));
const reversalEntry = Store.entries().find(entry => entry.reference === 'AUX-CEN-REV-WORKFLOW-001');
assert.ok(reversalEntry);
assert.equal(Cancellation.findReversal(Store.entries(), posted.entry).id, reversalEntry.id);
assert.equal(Store.cancelImportBatch(retried.batchId).ok, false, 'un lot contenant une écriture validée ne peut pas être supprimé');

console.log('Centralisation auxiliaire interne : transfert local, brouillon, fichier source, annulation et inversion liée — OK');
