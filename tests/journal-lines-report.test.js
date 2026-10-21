/* Vérifie le filtrage en lecture seule et les regroupements du détail des journaux. */
'use strict';

const assert = require('node:assert/strict');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
global.fflate = fflate;
const Report = require('../modern-proto/js/journal-lines-report.js');
const Exchange = require('../modern-proto/js/accounting-exchange.js');

const accounts = [
  { code: '401100', label: 'Fournisseurs' },
  { code: '601100', label: 'Achats' }
];
const journals = [
  { code: 'OD', label: 'Opérations diverses' },
  { code: 'AC', label: 'Achats' }
];
const entries = [
  {
    id: 'od-1', reference: 'OD-001', journal: 'OD', date: '2026-01-14', description: 'Facture de janvier',
    status: 'posted', createdAt: '2026-01-14T08:10:00.000Z',
    lines: [
      { account: '601100', debit: 1200, credit: 0 },
      { account: '401100', debit: 0, credit: 1200 }
    ]
  },
  {
    id: 'od-2', reference: 'OD-002', journal: 'OD', date: '2026-02-03', description: '=HYPERLINK("https://example.invalid")',
    status: 'posted', createdAt: '2026-02-03T09:15:00.000Z',
    lines: [
      { account: '601100', debit: 350, credit: 0 },
      { account: '401100', debit: 0, credit: 350 }
    ]
  },
  {
    id: 'ac-1', reference: 'AC-001', journal: 'AC', date: '2026-02-05', description: 'Hors journal choisi',
    status: 'posted', lines: [{ account: '601100', debit: 75, credit: 0 }]
  },
  {
    id: 'od-draft', reference: 'OD-DRAFT', journal: 'OD', date: '2026-02-06', description: 'Brouillon exclu',
    status: 'draft', lines: [{ account: '601100', debit: 10, credit: 0 }]
  },
  {
    id: 'od-outside', reference: 'OD-OUT', journal: 'OD', date: '2025-12-31', description: 'Hors période',
    status: 'posted', lines: [{ account: '601100', debit: 20, credit: 0 }]
  }
];

const optionalColumnKeys = ['currency', 'dueDate', 'fixedAsset', 'market', 'analysis', 'lastEntry'];
assert.ok(Report.columns.every(column => column.selectable), 'Aucune colonne ne doit être grisée ou désactivée.');
const optionalReport = Report.build({
  entries: [{
    reference: 'OD-OPTIONAL', journal: 'OD', date: '2026-03-02', status: 'posted',
    updatedAt: '2026-03-02T10:00:00.000Z',
    lines: [{
      account: '601100', debit: 25, credit: 0, currencyCode: 'EUR', dueDate: '2026-03-31',
      fixedAssetCode: 'IMM-01', market: 'Marché A', analyticCode: 'AN-01'
    }]
  }],
  accounts,
  journals,
  filters: { journals: ['OD'] },
  columns: optionalColumnKeys
});
assert.deepEqual(optionalReport.columns.map(column => column.key), optionalColumnKeys);
assert.deepEqual(optionalReport.groups[0].rows[0].cells, {
  currency: 'EUR', dueDate: '2026-03-31', fixedAsset: 'IMM-01', market: 'Marché A', analysis: 'AN-01', lastEntry: '2026-03-02T10:00:00.000Z'
});

const columns = ['date', 'piece', 'account', 'debit', 'credit', 'label', 'firstEntry'];
const report = Report.build({
  entries,
  accounts,
  journals,
  filters: { journals: ['OD'], accounts: ['601100'], from: '2026-01-01', to: '2026-02-28' },
  columns,
  newPageEachJournal: true,
  subtotalByPiece: true,
  subtotalByMonth: true
});

assert.deepEqual(report.columns.map(column => column.key), columns);
assert.equal(report.entryCount, 2, 'Seules les pièces validées et dans les filtres sont conservées.');
assert.equal(report.lineCount, 2, 'Le filtre de compte ne conserve que les lignes du compte choisi.');
assert.equal(report.groups.length, 1);
assert.equal(report.groups[0].title, 'Journal OD · Opérations diverses');
assert.equal(report.groups[0].pageBreakBefore, false);
assert.deepEqual(report.groups[0].rows.map(row => row.kind), [
  'line', 'piece-subtotal', 'month-subtotal', 'line', 'piece-subtotal', 'month-subtotal'
]);
assert.equal(report.groups[0].rows[0].cells.debit, 1200);
assert.equal(report.groups[0].rows[1].debit, 1200);
assert.equal(report.groups[0].rows[2].label, 'Sous-total du mois 2026-01');
assert.equal(report.groups[0].rows[3].entry.reference, 'OD-002');
assert.equal(report.groups[0].rows[5].debit, 350);

const matrix = Report.toMatrix(report);
assert.deepEqual(matrix[0], ['Date', 'N° pièce', 'Compte', 'Débit', 'Crédit', 'Libellé', '1ère saisie']);
assert.equal(matrix[1][0], 'Journal OD · Opérations diverses');
assert.equal(matrix[2][3], 1200);
assert.equal(matrix[3][3], 1200);
assert.equal(matrix[4][0], 'Sous-total du mois 2026-01');
assert.ok(matrix.some(row => row.includes('Sous-total du mois 2026-02')));

const text = Report.toTsv(report);
assert.equal(text.charCodeAt(0), 0xFEFF, 'Le TXT est encodé en UTF-8 avec BOM.');
assert.ok(text.includes("'=HYPERLINK"), 'Les libellés potentiellement formulaires sont neutralisés dans le TXT.');
assert.ok(text.includes('Journal OD · Opérations diverses'));

const xlsx = Exchange.exportTabularWorkbook('Détail / test', matrix[0], matrix.slice(1));
assert.ok(xlsx instanceof Uint8Array);
const workbook = fflate.unzipSync(xlsx);
const workbookXml = new TextDecoder().decode(workbook['xl/workbook.xml']);
assert.ok(workbookXml.includes('name="Détail   test"'), 'Le nom de feuille Excel est nettoyé des caractères interdits.');
const sheetXml = new TextDecoder().decode(workbook['xl/worksheets/sheet1.xml']);
assert.ok(sheetXml.includes('OD-001'));
assert.ok(sheetXml.includes('<v>1200</v>'), 'Les montants restent des valeurs numériques dans Excel.');
assert.ok(sheetXml.includes('=HYPERLINK'), 'Le texte est écrit comme chaîne OOXML, jamais comme formule.');
assert.throws(() => Exchange.exportTabularWorkbook('Vide', [], []), /au moins une colonne/);
assert.throws(() => Exchange.exportTabularWorkbook('Test', ['Colonne'], ['pas un tableau']), /tableau de cellules/);

const decimalReport = Report.build({
  entries: [{
    reference: 'OD-DEC', journal: 'OD', date: '2026-03-01', status: 'posted',
    lines: [{ account: '601100', debit: 0.1, credit: 0 }, { account: '401100', debit: 0, credit: 0.2 }]
  }],
  accounts,
  journals,
  filters: { journals: ['OD'] },
  columns: ['debit', 'credit'],
  decimalPlaces: 2,
  subtotalByPiece: true
});
assert.equal(decimalReport.groups[0].rows[2].debit, 0.1);
assert.equal(decimalReport.groups[0].rows[2].credit, 0.2);

const twoJournals = Report.build({
  entries,
  accounts,
  journals,
  filters: { from: '2026-01-01', to: '2026-12-31' },
  columns: ['piece'],
  newPageEachJournal: true
});
assert.deepEqual(twoJournals.groups.map(group => group.code), ['AC', 'OD']);
assert.equal(twoJournals.groups[0].pageBreakBefore, false);
assert.equal(twoJournals.groups[1].pageBreakBefore, true);

console.log('Détail des lignes saisies : filtres, sous-totaux, TXT et classeur Excel tabulaire — OK');
