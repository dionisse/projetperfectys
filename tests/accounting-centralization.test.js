/* Tests du format pivot et de l’agrégateur auxiliaire (aucun parcours utilisateur actif). */
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

console.log('Modèle PERFECTO-AUXILIAIRE v1 : validation du pivot et agrégateur (sans parcours utilisateur actif) — OK');
