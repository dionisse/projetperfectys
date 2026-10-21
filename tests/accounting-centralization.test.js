/* Tests du format pivot, de l’agrégateur et de la préparation de centralisation auxiliaire. */
'use strict';

const assert = require('node:assert/strict');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
global.fflate = fflate;
const Exchange = require('../modern-proto/js/accounting-exchange.js');
const Centralization = require('../modern-proto/js/accounting-centralization.js');

const accounts = [
  { code: '401100', label: 'Fournisseurs', aux: true, active: true },
  { code: '411100', label: 'Clients', aux: true, active: true },
  { code: '601100', label: 'Achats', aux: false, active: true },
  { code: '521100', label: 'Banque', aux: false, active: true },
  { code: '701000', label: 'Ventes', aux: false, active: true }
];
const rows = [
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'AC', '2026-01-10', 'AC-001', 'Facture fournisseur', '601100', 'Achats', '', '', 'Achat marchandise', '100', '0', 'sage-aux-001'],
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'AC', '2026-01-10', 'AC-001', 'Facture fournisseur', '401-SUP-001', 'Fournisseur source', 'SUP-001', 'Fournisseur A', 'Dette fournisseur', '0', '100', 'sage-aux-002'],
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'BQ', '2026-01-11', 'BQ-009', 'Règlement fournisseur', '401-SUP-001', 'Fournisseur source', 'SUP-001', 'Fournisseur A', 'Règlement', '40', '0', 'sage-aux-003'],
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'BQ', '2026-01-11', 'BQ-009', 'Règlement fournisseur', '521100', 'Banque', '', '', 'Sortie banque', '0', '40', 'sage-aux-004'],
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'VE', '2026-01-12', 'VE-003', 'Facture client', '411-CLI-009', 'Client source', 'CLI-009', 'Client B', 'Créance client', '200', '0', 'sage-aux-005'],
  ['PERFECTO-AUXILIAIRE', '1', 'SAGE', 'COR-SOURCE', '2026', 'AUX-LOT-2026-01', 'VE', '2026-01-12', 'VE-003', 'Facture client', '701000', 'Ventes', '', '', 'Vente', '0', '200', 'sage-aux-006']
];
const csv = '\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...rows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';'))
  .join('\r\n') + '\r\n';

const parsed = Exchange.parseAuxiliary(csv);
assert.equal(parsed.ok, true, parsed.errors.join('\n'));
assert.equal(parsed.rows.length, 6);
assert.equal(parsed.documentCount, 3);
assert.equal(parsed.auxiliaryMovementCount, 3);
assert.equal(parsed.totalDebit, 340);
assert.equal(parsed.totalCredit, 340);
assert.equal(parsed.metadata.batchReference, 'AUX-LOT-2026-01');

const mappings = {
  '601100': '601100',
  '401-SUP-001': '401100',
  '521100': '521100',
  '411-CLI-009': '411100',
  '701000': '701000'
};
const aggregated = Centralization.aggregate(parsed, mappings, accounts);
assert.equal(aggregated.ok, true, aggregated.errors.join('\n'));
assert.equal(aggregated.totalDebit, 340);
assert.equal(aggregated.totalCredit, 340);
assert.equal(aggregated.auxiliaryAccountCount, 2);
assert.deepEqual(aggregated.lines.filter(line => line.account === '401100').map(line => [line.debit, line.credit]), [[40, 0], [0, 100]], 'Les mouvements débiteurs et créditeurs d’un même compte restent distincts.');
assert.equal(aggregated.accountMappings.find(item => item.sourceCode === '401-SUP-001').targetCode, '401100');

const internalRows = rows.map(row => {
  const copy = row.slice();
  copy[2] = 'PERFECTO-VENTES-STOCK-FACTURATION';
  copy[3] = 'COR-CIBLE2026';
  return copy;
});
const internalCsv = '\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...internalRows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';'))
  .join('\r\n') + '\r\n';
const internalParsed = Exchange.parseAuxiliary(internalCsv);
assert.equal(internalParsed.ok, true, internalParsed.errors.join('\n'));
const internalDossier = { reference: 'COR-CIBLE2026', exerciseYear: 2026, cycleStart: '2026-01-01', cycleEnd: '2026-12-31' };
const sourceContext = Centralization.validateSourceContext(internalParsed, internalDossier);
assert.equal(sourceContext.ok, true, sourceContext.errors.join('\n'));
const internalAggregation = Centralization.aggregate(internalParsed, mappings, accounts);
assert.equal(internalAggregation.ok, true, internalAggregation.errors.join('\n'));
const builtEntry = Centralization.buildEntry(internalParsed, internalAggregation, {
  dossier: internalDossier,
  reference: 'AUX-CEN-TEST-001',
  journal: 'OD',
  date: '2026-08-20',
  sourceFileSha256: 'c'.repeat(64)
});
assert.equal(builtEntry.ok, true, builtEntry.errors.join('\n'));
assert.equal(builtEntry.entry.sourceSystem, 'PERFECTO-AUXILIAIRE-INTERNE');
assert.equal(builtEntry.entry.sourceMetadata.feed, 'internal');
assert.equal(builtEntry.entry.sourceMetadata.operation, 'auxiliary-centralization');
assert.equal(builtEntry.entry.sourceMetadata.provenance, 'manual-file-self-declared');
assert.equal(builtEntry.entry.sourceMetadata.sourceBatchReference, 'AUX-LOT-2026-01');
assert.equal(builtEntry.entry.sourceMetadata.sourceFileSha256, 'c'.repeat(64));
assert.deepEqual(builtEntry.entry.lines, internalAggregation.lines);
assert.equal(Centralization.validateSourceContext(internalParsed, { ...internalDossier, reference: 'AUTRE-DOSSIER' }).ok, false);
assert.equal(Centralization.validateSourceContext(parsed, internalDossier).ok, false, 'un système tiers ne peut pas alimenter le transfert interne');
const outOfCycleRows = internalRows.map(row => row.slice());
outOfCycleRows.filter(row => row[8] === 'AC-001').forEach(row => { row[7] = '2025-12-31'; });
const outOfCycleParsed = Exchange.parseAuxiliary('\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...outOfCycleRows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\r\n') + '\r\n');
assert.equal(outOfCycleParsed.ok, true, outOfCycleParsed.errors.join('\n'));
assert.ok(Centralization.validateSourceContext(outOfCycleParsed, internalDossier).errors.some(error => error.includes('hors du cycle')));
assert.equal(Centralization.buildEntry(internalParsed, internalAggregation, {
  dossier: internalDossier, reference: 'AUX-CEN-TEST-INVALID-DATE', journal: 'OD', date: '2026-02-30'
}).ok, false);
assert.ok(Centralization.buildEntry(internalParsed, internalAggregation, {
  dossier: internalDossier, reference: 'AUX-CEN-TEST-CEN', journal: 'CEN', date: '2026-02-20'
}).errors.some(error => error.includes('réservé au futur transfert')));

const nonPostableAccounts = accounts.map(account => account.code === '601100' ? { ...account, postable: false } : account);
const nonPostableAggregate = Centralization.aggregate(internalParsed, mappings, nonPostableAccounts);
assert.equal(nonPostableAggregate.ok, false);
assert.ok(nonPostableAggregate.errors.some(error => error.includes('compte de regroupement')));

const missingMapping = Centralization.aggregate(parsed, { '601100': '601100' }, accounts);
assert.equal(missingMapping.ok, false);
assert.ok(missingMapping.errors.some(error => error.includes('sans correspondance')));
const wrongAuxiliaryTarget = Centralization.aggregate(parsed, { ...mappings, '401-SUP-001': '601100' }, accounts);
assert.equal(wrongAuxiliaryTarget.ok, false);
assert.ok(wrongAuxiliaryTarget.errors.some(error => error.includes('n’est pas marqué comme compte auxiliaire')));

const unbalancedDocumentRows = rows.map(row => row.slice());
unbalancedDocumentRows[0][15] = '101';
const unbalancedDocument = Exchange.parseAuxiliary('\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...unbalancedDocumentRows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\r\n') + '\r\n');
assert.equal(unbalancedDocument.ok, false);
assert.ok(unbalancedDocument.errors.some(error => error.includes('Pièce source') && error.includes('non équilibrée')));

const duplicateIdRows = rows.map(row => row.slice());
duplicateIdRows[1][17] = duplicateIdRows[0][17];
const duplicateId = Exchange.parseAuxiliary('\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...duplicateIdRows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\r\n') + '\r\n');
assert.equal(duplicateId.ok, false);
assert.ok(duplicateId.errors.some(error => error.includes('ID_SOURCE') && error.includes('répété')));

const inconsistentLotRows = rows.map(row => row.slice());
inconsistentLotRows[5][5] = 'AUTRE-LOT';
const inconsistentLot = Exchange.parseAuxiliary('\uFEFF' + [Exchange.AUXILIARY_HEADERS, ...inconsistentLotRows]
  .map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(';')).join('\r\n') + '\r\n');
assert.equal(inconsistentLot.ok, false);
assert.ok(inconsistentLot.errors.some(error => error.includes('métadonnées du lot')));
assert.equal(Exchange.parseAuxiliary(Exchange.templateAuxiliary()).ok, false);

const workbookTemplate = fflate.unzipSync(Exchange.templateAuxiliaryWorkbook({
  dossier: { reference: 'COR-CIBLE2026', exerciseYear: 2026, cycleStart: '2026-01-01', cycleEnd: '2026-12-31' },
  accounts,
  journals: [{ code: 'OD', label: 'Opérations diverses', type: 'Divers' }]
}));
const workbookXml = new TextDecoder().decode(workbookTemplate['xl/workbook.xml']);
assert.ok(workbookXml.includes('name="Auxiliaire"'));
const auxiliarySheet = new TextDecoder().decode(workbookTemplate['xl/worksheets/sheet5.xml']);
assert.ok(auxiliarySheet.includes('CODE_AUXILIAIRE'));
assert.ok(auxiliarySheet.includes('ID_SOURCE'));

console.log('Modèle PERFECTO-AUXILIAIRE v1 : pivot, agrégation, contexte source et pièce générale de brouillon — OK');
