/* Extraction automatique des écritures validées avec rattachement auxiliaire explicite et exports. */
'use strict';

const assert = require('node:assert/strict');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
global.fflate = fflate;
const Exchange = require('../modern-proto/js/accounting-exchange.js');
const Centralization = require('../modern-proto/js/accounting-centralization.js');
assert.equal(new Set(Exchange.AUXILIARY_REPORT_HEADERS).size, Exchange.AUXILIARY_REPORT_HEADERS.length, 'les colonnes du format d’export sont uniques');

const dossier = {
  id: 'dossier-test',
  reference: 'DOS-TEST-2026',
  exerciseYear: 2026,
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31'
};
const accounts = [
  { code: '401100', label: 'Fournisseurs', aux: true, active: true },
  { code: '411100', label: 'Clients', aux: true, active: true },
  { code: '601100', label: 'Achats', aux: false, active: true }
];
const entries = [
  {
    id: 'entry-1', sourceId: 'source-1', sourceSystem: 'FEC-BENIN', sourceReference: 'FEC-PIECE-1',
    sourceJournal: 'ACH', reference: 'ACH-001', journal: 'ACH', date: '2026-03-10',
    description: 'Facture fournisseur', status: 'posted',
    sourceMetadata: {
      sourceFileId: 'a'.repeat(64),
      lines: [
        { sourceRow: 12, auxiliaryAccount: 'SUP-001', auxiliaryLabel: '=1+1', description: 'Facture SUP-001' },
        {}
      ]
    },
    lines: [
      { account: '401100', accountLabel: 'Fournisseurs', debit: 0, credit: 120 },
      { account: '601100', accountLabel: 'Achats', debit: 120, credit: 0 }
    ]
  },
  {
    id: 'entry-2', sourceId: 'source-2', sourceSystem: 'FEC-BENIN', sourceReference: 'FEC-PIECE-2',
    sourceJournal: 'BQ', reference: 'BQ-002', journal: 'BQ', date: '2026-03-11',
    description: 'Règlement fournisseur', status: 'posted',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-001', auxiliaryLabel: 'Fournisseur A', sourceRow: 18 }, {}] },
    lines: [
      { account: '401100', debit: 30, credit: 0 },
      { account: '601100', debit: 0, credit: 30 }
    ]
  },
  {
    id: 'entry-unattributed', reference: 'ACH-003', journal: 'ACH', date: '2026-03-12', status: 'posted',
    lines: [{ account: '401100', debit: 0, credit: 50 }, { account: '601100', debit: 50, credit: 0 }]
  },
  {
    id: 'entry-draft', reference: 'ACH-DRAFT', journal: 'ACH', date: '2026-03-12', status: 'draft',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-DRAFT', auxiliaryLabel: 'Brouillon' }] },
    lines: [{ account: '401100', debit: 0, credit: 50 }]
  },
  {
    id: 'seed-explicit-aux', reference: 'DEMO-001', date: '2026-03-12', status: 'posted',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-DEMO', auxiliaryLabel: 'Donnée démo' }] },
    lines: [{ account: '401100', debit: 0, credit: 10 }]
  },
  {
    id: 'entry-prior-centralization', reference: 'CEN-001', date: '2026-03-13', status: 'posted',
    sourceSystem: Centralization.INTERNAL_SOURCE_SYSTEM,
    sourceMetadata: { operation: 'auxiliary-centralization', lines: [{ auxiliaryAccount: 'SUP-001' }] },
    lines: [{ account: '401100', debit: 0, credit: 120 }]
  },
  {
    id: 'entry-not-aux', reference: 'OD-001', date: '2026-03-14', status: 'posted',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-001', auxiliaryLabel: 'Fournisseur A' }] },
    lines: [{ account: '601100', debit: 5, credit: 0 }]
  },
  {
    id: 'entry-out-of-cycle', reference: 'ACH-OLD', date: '2025-12-31', status: 'posted',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-OLD', auxiliaryLabel: 'Hors exercice' }] },
    lines: [{ account: '401100', debit: 0, credit: 10 }]
  }
];
const originalEntries = JSON.stringify(entries);
const extraction = Centralization.extractValidatedAuxiliaryMovements(entries, accounts, dossier, { decimalPlaces: 0 });

assert.equal(extraction.ok, true, extraction.errors.join('\n'));
assert.equal(extraction.stats.eligibleEntryCount, 2);
assert.equal(extraction.stats.eligibleMovementCount, 2);
assert.equal(extraction.stats.auxiliaryCount, 1);
assert.equal(extraction.stats.totalDebit, 30);
assert.equal(extraction.stats.totalCredit, 120);
assert.equal(extraction.stats.unattributedMovementCount, 1, 'une ligne collective sans ID tiers est comptée comme exclue, pas attribuée');
assert.equal(extraction.stats.unclassifiedAuxiliaryMovementCount, 1);
assert.equal(extraction.stats.ignoredDraftEntryCount, 1);
assert.equal(extraction.stats.excludedDemoEntryCount, 1);
assert.equal(extraction.stats.excludedCentralizationEntryCount, 1);
assert.equal(extraction.stats.excludedOutOfCycleEntryCount, 1);
assert.deepEqual(extraction.byCollective.map(group => [group.account, group.debit, group.credit, group.movementCount, group.auxiliaryCount]), [
  ['401100', 30, 120, 2, 1]
]);
assert.deepEqual(extraction.byAuxiliary.map(group => [group.account, group.auxiliaryCode, group.debit, group.credit, group.movementCount]), [
  ['401100', 'SUP-001', 30, 120, 2]
]);
assert.equal(extraction.movements[0].sourceEntryId, 'entry-1');
assert.equal(extraction.movements[0].sourceFileId, 'a'.repeat(64));
assert.equal(extraction.movements[0].sourceRow, '12');
assert.equal(extraction.movements[0].auxiliaryLabel, '=1+1', 'le libellé source est conservé tel quel dans les données');
assert.equal(JSON.stringify(entries), originalEntries, 'l’extraction ne modifie jamais les écritures source');

const csv = Exchange.exportAuxiliaryExtractionCsv(extraction);
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes('PERFECTO-AUXILIAIRE-INTERNE'));
assert.ok(csv.includes('TOTAL_COMPTE_COLLECTIF'));
assert.ok(csv.includes('TOTAL_AUXILIAIRE'));
assert.ok(csv.includes('MOUVEMENT_SOURCE'));
assert.ok(csv.includes("'=1+1"), 'les champs textuels susceptibles de déclencher une formule Excel sont neutralisés à l’export');
const txt = Exchange.exportAuxiliaryExtractionText(extraction);
assert.ok(txt.includes('\t'), 'TXT est produit avec un séparateur tabulation');
assert.ok(txt.includes('SUP-001'));
const workbook = fflate.unzipSync(Exchange.exportAuxiliaryExtractionWorkbook(extraction, dossier));
const workbookXml = new TextDecoder().decode(workbook['xl/workbook.xml']);
assert.ok(workbookXml.includes('name="Totaux collectifs"'));
assert.ok(workbookXml.includes('name="Totaux auxiliaires"'));
assert.ok(workbookXml.includes('name="Mouvements sources"'));
const sourceSheet = new TextDecoder().decode(workbook['xl/worksheets/sheet4.xml']);
assert.ok(sourceSheet.includes('SUP-001'));
assert.ok(sourceSheet.includes('entry-1'));

const noAuxiliaryId = Centralization.extractValidatedAuxiliaryMovements([
  { id: 'ordinary-entry', status: 'posted', date: '2026-05-01', lines: [{ account: '401100', debit: 0, credit: 25 }] }
], accounts, dossier);
assert.equal(noAuxiliaryId.ok, true);
assert.equal(noAuxiliaryId.movements.length, 0);
assert.equal(noAuxiliaryId.stats.unattributedMovementCount, 1);
assert.throws(() => Exchange.exportAuxiliaryExtractionCsv(noAuxiliaryId), /Aucun mouvement auxiliaire/);

const decimalExtraction = Centralization.extractValidatedAuxiliaryMovements([
  {
    id: 'decimal-entry', status: 'posted', date: '2026-05-02', journal: 'ACH', reference: 'ACH-DEC',
    sourceMetadata: { lines: [{ auxiliaryAccountCode: 'SUP-DEC', auxiliaryLabel: 'Fournisseur décimal' }] },
    lines: [{ account: '401100', debit: 1.23, credit: 0 }]
  }
], accounts, dossier, { decimalPlaces: 2 });
assert.equal(decimalExtraction.ok, true, decimalExtraction.errors.join('\n'));
assert.equal(decimalExtraction.stats.totalDebit, 1.23);

const linkedReversal = Centralization.extractValidatedAuxiliaryMovements([
  {
    id: 'fec-original', status: 'posted', date: '2026-06-01', sourceSystem: 'FEC-BENIN', reference: 'FEC-100',
    sourceMetadata: { lines: [{ auxiliaryAccount: 'SUP-REV', auxiliaryLabel: 'Fournisseur lié' }] },
    lines: [{ account: '401100', debit: 0, credit: 75 }]
  },
  {
    id: 'fec-reversal', status: 'posted', date: '2026-06-10', sourceSystem: 'PERFECTO-ANNULATION-FEC', reference: 'OD-REV-100',
    sourceMetadata: {
      operation: 'fec-import-reversal', originalEntryId: 'fec-original', originalReference: 'FEC-100',
      lines: [{ auxiliaryAccount: 'SUP-REV', auxiliaryLabel: 'Fournisseur lié' }]
    },
    lines: [{ account: '401100', debit: 75, credit: 0 }]
  }
], accounts, dossier);
assert.equal(linkedReversal.ok, true, linkedReversal.errors.join('\n'));
assert.equal(linkedReversal.movements.length, 2, 'l’écriture inverse reste traçable avec la même référence auxiliaire');
assert.equal(linkedReversal.movements[1].originalEntryId, 'fec-original');
assert.equal(linkedReversal.stats.totalDebit, 75);
assert.equal(linkedReversal.stats.totalCredit, 75);
assert.ok(Exchange.exportAuxiliaryExtractionCsv(linkedReversal).includes('fec-original'), 'l’export conserve l’identifiant de l’écriture originale liée');

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
const currentDossier = Store.currentDossier();
const seededDossierExtraction = Centralization.extractValidatedAuxiliaryMovements(
  Store.entries(), Store.accounts(), currentDossier, { decimalPlaces: Store.accountingConfiguration().decimalPlaces }
);
assert.equal(seededDossierExtraction.movements.length, 0, 'les écritures de démonstration du dossier ne sont pas exportées');
assert.equal(seededDossierExtraction.stats.excludedDemoEntryCount, 3);
assert.equal(seededDossierExtraction.stats.ignoredDraftEntryCount, 1);

console.log('Extraction auxiliaire automatique : écritures validées, ID explicite, exclusions, traçabilité et exports XLSX/CSV/TXT — OK');
