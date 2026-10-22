/* Vérifie les cumuls de journaux, les rapports de lignes et leurs exports en lecture seule. */
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
assert.equal(Report.columns.find(column => column.key === 'lastEntry').defaultSelected, false,
  'la nouvelle colonne par défaut du rapport modifié ne change pas les choix initiaux du rapport existant');

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

const modifiedReport = Report.build({
  entries: [
    {
      id: 'modified-posted', reference: 'OD-MOD-1', journal: 'OD', date: '2025-12-31', status: 'posted',
      createdAt: '2025-12-31T08:00:00.000Z', updatedAt: '2026-02-05T12:30:00.000Z',
      lines: [{ account: '601100', debit: 40, credit: 0 }, { account: '401100', debit: 0, credit: 40 }]
    },
    {
      id: 'modified-draft', reference: 'OD-MOD-2', journal: 'OD', date: '2026-01-10', status: 'draft',
      createdAt: '2026-01-10T09:00:00.000Z', updatedAt: '2026-02-20T15:45:00.000Z',
      lines: [{ account: '601100', debit: 60, credit: 0 }, { account: '401100', debit: 0, credit: 60 }]
    },
    {
      id: 'unmodified', reference: 'OD-SAME', journal: 'OD', date: '2026-02-10', status: 'posted',
      createdAt: '2026-02-10T08:00:00.000Z',
      lines: [{ account: '601100', debit: 5, credit: 0 }]
    },
    {
      id: 'no-modification-date', reference: 'OD-OLD', journal: 'OD', date: '2026-02-10', status: 'posted',
      createdAt: '2026-02-10T08:00:00.000Z',
      lines: [{ account: '601100', debit: 7, credit: 0 }]
    },
    {
      id: 'outside-modification-period', reference: 'OD-LATE', journal: 'OD', date: '2026-02-10', status: 'posted',
      createdAt: '2026-02-10T08:00:00.000Z', updatedAt: '2026-03-01T08:00:00.000Z',
      lines: [{ account: '601100', debit: 8, credit: 0 }]
    },
    {
      id: 'other-journal', reference: 'AC-MOD', journal: 'AC', date: '2026-02-10', status: 'posted',
      createdAt: '2026-02-10T08:00:00.000Z', updatedAt: '2026-02-11T08:00:00.000Z',
      lines: [{ account: '601100', debit: 9, credit: 0 }]
    }
  ],
  accounts,
  journals,
  filters: { journals: ['OD'], from: '2026-02-01', to: '2026-02-28' },
  columns: ['date', 'piece', 'firstEntry', 'lastEntry'],
  includeDrafts: true,
  modifiedOnly: true,
  filterByModificationDate: true
});
assert.equal(modifiedReport.entryCount, 2, 'seules les pièces réellement modifiées, horodatées, filtrées par date de modification et journal sont retenues');
assert.equal(modifiedReport.lineCount, 4, 'le compteur reflète les lignes de pièces modifiées validées ou encore en brouillon');
assert.deepEqual(modifiedReport.groups.map(group => group.code), ['OD']);
const modifiedLines = modifiedReport.groups[0].rows.filter(row => row.kind === 'line');
assert.equal(modifiedLines[0].cells.date, '2025-12-31', 'la date de pièce reste la date comptable et ne devient pas la date de modification');
assert.equal(modifiedLines[0].cells.firstEntry, '2025-12-31T08:00:00.000Z');
assert.equal(modifiedLines[0].cells.lastEntry, '2026-02-05T12:30:00.000Z');
const legacyModifiedReport = Report.build({
  entries: [{
    id: 'legacy-modified', reference: 'OD-LEGACY', journal: 'OD', date: '2024-10-10', status: 'draft',
    updatedAt: '2026-02-12T10:00:00.000Z', lines: [{ account: '601100', debit: 12, credit: 0 }]
  }],
  accounts, journals,
  filters: { journals: ['OD'], from: '2026-02-01', to: '2026-02-28' },
  columns: ['firstEntry', 'lastEntry'], includeDrafts: true, modifiedOnly: true, filterByModificationDate: true
});
assert.equal(legacyModifiedReport.lineCount, 1);
assert.equal(legacyModifiedReport.groups[0].rows[0].cells.firstEntry, '', 'une première saisie absente dans une ancienne donnée reste vide, sans date inventée');
assert.equal(legacyModifiedReport.groups[0].rows[0].cells.lastEntry, '2026-02-12T10:00:00.000Z');
assert.deepEqual(Report.build({ entries, accounts, journals }).columns.map(column => column.key),
  Report.columns.filter(column => column.defaultSelected).map(column => column.key));

const unbalancedReport = Report.build({
  entries: [
    {
      id: 'unbalanced-draft', reference: 'OD-DES-1', journal: 'OD', date: '2025-06-10', status: 'draft',
      internalNumber: 'INT-007', description: 'Écriture à contrôler',
      lines: [{ account: '601100', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 80 }]
    },
    {
      id: 'balanced-posted', reference: 'OD-BAL', journal: 'OD', date: '2025-06-11', status: 'posted',
      lines: [{ account: '601100', debit: 50, credit: 0 }, { account: '401100', debit: 0, credit: 50 }]
    },
    {
      id: 'zero-total-draft', reference: 'OD-ZERO', journal: 'OD', date: '2025-06-11', status: 'draft',
      lines: [{ account: '601100', debit: 0, credit: 0 }]
    },
    {
      id: 'unbalanced-posted', reference: 'OD-DES-POSTED', journal: 'OD', date: '2025-06-14', status: 'posted',
      lines: [{ account: '601100', debit: 12, credit: 0 }]
    },
    {
      id: 'unbalanced-outside', reference: 'OD-OUTSIDE', journal: 'OD', date: '2026-01-01', status: 'posted',
      lines: [{ account: '601100', debit: 9, credit: 0 }]
    },
    {
      id: 'unbalanced-other-journal', reference: 'AC-DES', journal: 'AC', date: '2025-06-12', status: 'posted',
      lines: [{ account: '601100', debit: 9, credit: 0 }]
    },
    {
      id: 'decimal-balanced', reference: 'OD-DEC-BAL', journal: 'OD', date: '2025-06-13', status: 'posted',
      lines: [{ account: '601100', debit: 0.304, credit: 0 }, { account: '401100', debit: 0, credit: 0.3 }]
    }
  ],
  accounts,
  journals,
  reportType: 'unbalanced',
  includeDrafts: true,
  unbalancedOnly: true,
  decimalPlaces: 2,
  filters: { journals: ['OD'], from: '2025-01-01', to: '2025-12-31' }
});
assert.deepEqual(Report.columnsForReport('unbalanced').map(column => column.key),
  ['date', 'line', 'debit', 'label', 'piece', 'account', 'credit', 'internalNumber']);
assert.deepEqual(Report.columnsForReport('unbalanced').map(column => column.label),
  ['Date', 'Ligne', 'Débit', 'Libellé', 'N° pièce', 'Compte', 'Crédit', 'N° interne']);
assert.ok(Report.columnsForReport('unbalanced').every(column => column.selectable && column.defaultSelected),
  'les huit colonnes de la capture sont sélectionnables et cochées par défaut');
assert.deepEqual(Report.columnGroupsForReport('unbalanced').map(group => group.map(column => column && column.label)), [
  ['Date', 'N° pièce'], ['Ligne', 'Compte'], ['Débit', 'Crédit'], ['Libellé', 'N° interne']
]);
assert.equal(unbalancedReport.entryCount, 2, 'seules les pièces déséquilibrées du journal et de la période sont conservées');
assert.equal(unbalancedReport.lineCount, 3);
const unbalancedLines = unbalancedReport.groups[0].rows.filter(row => row.kind === 'line');
assert.equal(unbalancedLines[0].cells.line, 1, 'le numéro de ligne reprend l’ordre réel des lignes de la pièce');
assert.equal(unbalancedLines[1].cells.line, 2);
assert.equal(unbalancedLines[2].entry.status, 'posted', 'les pièces déséquilibrées validées restent dans le périmètre du rapport');
assert.equal(unbalancedLines[0].cells.internalNumber, 'INT-007');
assert.equal(unbalancedLines[0].cells.label, 'Écriture à contrôler');
const unbalancedWithoutInternalNumber = Report.build({
  entries: [{ reference: 'OD-DES-2', journal: 'OD', date: '2025-06-15', status: 'posted', lines: [{ account: '601100', debit: 7, credit: 0 }] }],
  accounts, journals, reportType: 'unbalanced', unbalancedOnly: true, filters: { from: '2025-01-01', to: '2025-12-31' }
});
assert.equal(unbalancedWithoutInternalNumber.groups[0].rows[0].cells.internalNumber, '', 'un numéro interne absent dans la source reste vide');

const journalTotals = Report.build({
  reportType: 'totals',
  entries: [
    {
      reference: 'OD-TOT-1', journal: 'OD', date: '2026-01-10', status: 'posted',
      lines: [{ account: '601100', debit: 0.1, credit: 0 }, { account: '401100', debit: 0, credit: 0.1 }]
    },
    {
      reference: 'OD-TOT-2', journal: 'OD', date: '2026-02-10', status: 'posted',
      lines: [{ account: '601100', debit: 0.2, credit: 0 }, { account: '401100', debit: 0, credit: 0.2 }]
    },
    {
      reference: 'OD-TOT-DRAFT', journal: 'OD', date: '2026-02-12', status: 'draft',
      lines: [{ account: '601100', debit: 90, credit: 90 }]
    },
    {
      reference: 'AC-TOT', journal: 'AC', date: '2026-02-13', status: 'posted',
      lines: [{ account: '601100', debit: 40, credit: 40 }]
    },
    {
      reference: 'OD-TOT-OUT', journal: 'OD', date: '2025-12-31', status: 'posted',
      lines: [{ account: '601100', debit: 70, credit: 70 }]
    }
  ],
  journals,
  decimalPlaces: 2,
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-12-31' }
});
assert.deepEqual(Report.columnsForReport('totals').map(column => column.key),
  ['journalCode', 'journalLabel', 'pieceCount', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('totals').map(column => column.label),
  ['Code journal', 'Intitulé', 'Nombre de pièces', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(Report.columnsForReport('totals').map(column => column.defaultSelected), [true, true, true, false, true, true],
  'le nombre de lignes est la seule colonne décochée par défaut, comme sur la capture');
assert.ok(Report.columnsForReport('totals').every(column => column.selectable));
assert.deepEqual(Report.columnGroupsForReport('totals').map(group => group.map(column => column.label)), [
  ['Code journal', 'Intitulé'], ['Nombre de pièces', 'Nombre de lignes'], ['Total des débits', 'Total des crédits']
]);
assert.equal(journalTotals.journalCount, 1);
assert.equal(journalTotals.entryCount, 2, 'le cumul inclut les pièces validées de la période et du journal choisi seulement');
assert.equal(journalTotals.lineCount, 4);
assert.deepEqual(journalTotals.groups[0].rows[0].cells, {
  journalCode: 'OD', journalLabel: 'Opérations diverses', pieceCount: 2, debit: 0.3, credit: 0.3
});
const journalTotalsWithLineCount = Report.build({
  reportType: 'totals',
  entries: [{
    status: 'posted', journal: 'OD', date: '2026-01-10', lines: [{ debit: 1, credit: 0 }, { debit: 0, credit: 1 }]
  }],
  journals, columns: ['journalCode', 'lineCount'], filters: { from: '2026-01-01', to: '2026-12-31' }
});
assert.deepEqual(journalTotalsWithLineCount.columns.map(column => column.key), ['journalCode', 'lineCount']);
assert.equal(journalTotalsWithLineCount.groups[0].rows[0].cells.lineCount, 2);

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

console.log('Rapports de journaux : filtres, cumul par journal, colonnes, déséquilibres, TXT et Excel — OK');
