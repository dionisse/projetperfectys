/* Vérifie les cumuls de journaux et de comptes, les rapports de lignes et leurs exports en lecture seule. */
'use strict';

const assert = require('node:assert/strict');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
global.fflate = fflate;
const Report = require('../modern-proto/js/journal-lines-report.js');
const Exchange = require('../modern-proto/js/accounting-exchange.js');

const accounts = [
  { code: '401', label: 'Fournisseurs, dettes en compte', classLabel: 'Tiers', subclassLabel: 'Fournisseurs et comptes rattachés' },
  { code: '601', label: 'Achats de marchandises', classLabel: 'Charges', subclassLabel: 'Achats et variations de stocks' },
  { code: '401100', label: 'Fournisseurs', classLabel: 'Tiers', subclassLabel: 'Fournisseurs et comptes rattachés' },
  { code: '601100', label: 'Achats', classLabel: 'Charges', subclassLabel: 'Achats et variations de stocks' }
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

const accountTotals = Report.build({
  reportType: 'account-totals',
  entries,
  accounts,
  journals,
  decimalPlaces: 2,
  filters: { journals: ['OD'], accounts: ['601100', '401100'], from: '2026-01-01', to: '2026-02-28' }
});
assert.deepEqual(Report.columnsForReport('account-totals').map(column => column.key),
  ['accountCode', 'accountTitle', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('account-totals').map(column => column.label),
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.ok(Report.columnsForReport('account-totals').every(column => column.selectable && column.defaultSelected),
  'les cinq colonnes de la capture sont activables et cochées par défaut');
assert.deepEqual(Report.columnGroupsForReport('account-totals').map(group => group.map(column => column.label)), [
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes'], ['Total des débits', 'Total des crédits']
]);
assert.equal(accountTotals.accountCount, 2);
assert.equal(accountTotals.lineCount, 4);
assert.equal(accountTotals.totalDebit, 1550);
assert.equal(accountTotals.totalCredit, 1550);
assert.deepEqual(accountTotals.groups[0].rows.map(row => row.cells), [
  { accountCode: '401100', accountTitle: 'Fournisseurs', lineCount: 2, debit: 0, credit: 1550 },
  { accountCode: '601100', accountTitle: 'Achats', lineCount: 2, debit: 1550, credit: 0 }
], 'les lignes validées sont regroupées par compte, avec les filtres de journal, compte et période');
const accountTotalsMatrix = Report.toMatrix(accountTotals);
assert.deepEqual(accountTotalsMatrix[0], ['Code du compte', 'Intitulé du compte', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(accountTotalsMatrix[1], ['Cumul par comptes individuels', '', '', '', '']);
const accountTotalsSelectedColumns = Report.build({
  reportType: 'account-totals', entries, accounts, journals,
  columns: ['accountCode', 'lineCount'],
  filters: { journals: ['OD'], accounts: ['601100'], from: '2026-01-01', to: '2026-02-28' }
});
assert.deepEqual(accountTotalsSelectedColumns.columns.map(column => column.key), ['accountCode', 'lineCount']);
assert.deepEqual(accountTotalsSelectedColumns.groups[0].rows[0].cells, { accountCode: '601100', lineCount: 2 });
const decimalAccountTotals = Report.build({
  reportType: 'account-totals', decimalPlaces: 2, accounts, journals,
  entries: [{ status: 'posted', journal: 'OD', date: '2026-03-01', lines: [
    { account: '601100', debit: 0.1, credit: 0 }, { account: '601100', debit: 0.2, credit: 0 }
  ] }],
  filters: { journals: ['OD'], from: '2026-03-01', to: '2026-03-31' }
});
assert.equal(decimalAccountTotals.groups[0].rows[0].cells.debit, 0.3,
  'les cumuls individuels respectent la précision du dossier sans dérive IEEE-754');
const emptyAccountTotals = Report.build({
  reportType: 'account-totals', entries: [], accounts, journals,
  filters: { from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(emptyAccountTotals.accountCount, 0);
assert.deepEqual(emptyAccountTotals.groups, [], 'aucun compte sans mouvement n’est ajouté au rapport');

assert.deepEqual(Report.columnsForReport('summary-account-totals').map(column => column.key),
  ['accountCode', 'accountTitle', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('summary-account-totals').map(column => column.label),
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(Report.columnsForReport('summary-account-totals').map(column => column.defaultSelected), [true, true, true, false, true],
  'les colonnes code, intitulé, nombre de lignes et crédits sont cochées par défaut, pas les débits');
assert.ok(Report.columnsForReport('summary-account-totals').every(column => column.selectable));
assert.deepEqual(Report.columnGroupsForReport('summary-account-totals').map(group => group.map(column => column.label)), [
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes'], ['Total des débits', 'Total des crédits']
]);
const summaryAccountTotals = Report.build({
  reportType: 'summary-account-totals', entries, accounts, journals, decimalPlaces: 2,
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28', summaryLevel: 1 }
});
assert.equal(summaryAccountTotals.summaryLevel, 1);
assert.equal(summaryAccountTotals.accountCount, 2);
assert.equal(summaryAccountTotals.lineCount, 4);
assert.equal(summaryAccountTotals.totalDebit, 1550);
assert.equal(summaryAccountTotals.totalCredit, 1550);
assert.deepEqual(summaryAccountTotals.groups[0].rows.map(row => row.cells), [
  { accountCode: '4', accountTitle: 'Tiers', lineCount: 2, credit: 1550 },
  { accountCode: '6', accountTitle: 'Charges', lineCount: 2, credit: 0 }
], 'le niveau 1 regroupe sur le premier chiffre et utilise les intitulés de classes présents dans le référentiel');
const summaryAccountTotalsMatrix = Report.toMatrix(summaryAccountTotals);
assert.deepEqual(summaryAccountTotalsMatrix[0], ['Code du compte', 'Intitulé du compte', 'Nombre de lignes', 'Total des crédits']);
assert.deepEqual(summaryAccountTotalsMatrix[1], ['Cumul par comptes de synthèse · niveau 1', '', '', '']);
const subclassTotals = Report.build({
  reportType: 'summary-account-totals', entries, accounts, journals,
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28', summaryLevel: 2 }
});
assert.deepEqual(subclassTotals.groups[0].rows.map(row => row.cells), [
  { accountCode: '40', accountTitle: 'Fournisseurs et comptes rattachés', lineCount: 2, credit: 1550 },
  { accountCode: '60', accountTitle: 'Achats et variations de stocks', lineCount: 2, credit: 0 }
], 'le niveau 2 reprend les intitulés de sous-classe du référentiel');
const accountGroupTotals = Report.build({
  reportType: 'summary-account-totals', entries, accounts, journals,
  columns: ['accountCode', 'accountTitle', 'lineCount', 'debit', 'credit'],
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28', summaryLevel: 3 }
});
assert.deepEqual(accountGroupTotals.groups[0].rows.map(row => row.cells), [
  { accountCode: '401', accountTitle: 'Fournisseurs, dettes en compte', lineCount: 2, debit: 0, credit: 1550 },
  { accountCode: '601', accountTitle: 'Achats de marchandises', lineCount: 2, debit: 1550, credit: 0 }
], 'le niveau 3 utilise les codes et libellés exacts du référentiel');
const unknownSummaryTitle = Report.build({
  reportType: 'summary-account-totals', entries, accounts, journals, columns: ['accountCode', 'accountTitle'],
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28', summaryLevel: 4 }
});
assert.deepEqual(unknownSummaryTitle.groups[0].rows.map(row => row.cells), [
  { accountCode: '4011', accountTitle: '' }, { accountCode: '6011', accountTitle: '' }
], 'un intitulé absent du référentiel reste vide au lieu d’être fabriqué');
const customSubclassTitle = Report.build({
  reportType: 'summary-account-totals',
  accounts: [{ code: '499900', label: 'Compte personnalisé', classLabel: 'Tiers', subclassLabel: 'Comptes personnalisés' }],
  entries: [{ status: 'posted', journal: 'OD', date: '2026-01-01', lines: [{ account: '499900', debit: 10, credit: 0 }] }],
  columns: ['accountCode', 'accountTitle'],
  filters: { summaryLevel: 2 }
});
assert.deepEqual(customSubclassTitle.groups[0].rows[0].cells, { accountCode: '49', accountTitle: '' },
  'un libellé générique de sous-classe ne remplace pas un libellé absent du référentiel');
const invalidSummaryLevel = Report.build({
  reportType: 'summary-account-totals', entries, accounts, journals,
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28', summaryLevel: 9 }
});
assert.equal(invalidSummaryLevel.summaryLevel, 1, 'le calcul pur revient au niveau valide par défaut si un niveau hors plage lui est transmis');

const clientRecords = [
  { id: 'client-1', code: 'CLI-0001', name: 'Client Alpha', accountCode: '411', auxiliaryAccountCode: '411-CLI-0001' },
  { id: 'client-2', code: 'CLI-0002', name: 'Client Beta', accountCode: '411', auxiliaryAccountCode: '411-CLI-0002' }
];
const explicitThirdPartyMovements = [
  { date: '2026-01-15', journal: 'VTE', account: '411', auxiliaryCode: 'CLI-0001', debit: 100, credit: 0 },
  { date: '2026-01-16', journal: 'VTE', account: '411', auxiliaryCode: '411-CLI-0001', debit: 0, credit: 100 },
  { date: '2026-01-20', journal: 'OD', account: '411', auxiliaryCode: 'CLI-0001', debit: 10, credit: 0 },
  { date: '2026-02-01', journal: 'VTE', account: '411', auxiliaryCode: 'CLI-0002', debit: 0, credit: 40 },
  { date: '2026-02-28', journal: 'VTE', account: '411', auxiliaryCode: 'CLI-0001', debit: 0.1, credit: 0 },
  { date: '2026-03-01', journal: 'VTE', account: '411', auxiliaryCode: 'CLI-0001', debit: 50, credit: 0 },
  { date: '2026-01-15', journal: 'VTE', account: '401', auxiliaryCode: 'CLI-0001', debit: 900, credit: 0 },
  { date: '2026-01-15', journal: 'VTE', account: '411', auxiliaryCode: 'CLI-INCONNU', debit: 700, credit: 0 },
  { date: '2026-01-15', journal: 'VTE', account: '411', auxiliaryCode: '', debit: 500, credit: 0 }
];
assert.deepEqual(Report.columnsForReport('third-party-totals').map(column => column.key),
  ['accountCode', 'accountTitle', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('third-party-totals').map(column => column.label),
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(Report.columnsForReport('third-party-totals').map(column => column.defaultSelected), [true, true, true, true, true],
  'les cinq colonnes du cumul par tiers sont cochées par défaut');
assert.ok(Report.columnsForReport('third-party-totals').every(column => column.selectable));
assert.deepEqual(Report.columnGroupsForReport('third-party-totals').map(group => group.map(column => column.label)), [
  ['Code du compte', 'Intitulé du compte', 'Nombre de lignes'], ['Total des débits', 'Total des crédits']
]);
const clientTotals = Report.build({
  reportType: 'third-party-totals',
  thirdPartyRecords: clientRecords,
  thirdPartyMovements: explicitThirdPartyMovements,
  decimalPlaces: 2,
  filters: { thirdPartyNature: 'clients', thirdParties: ['CLI-0001'], journals: ['VTE'], from: '2026-01-01', to: '2026-02-28' }
});
assert.equal(clientTotals.thirdPartyCount, 1);
assert.equal(clientTotals.thirdPartyNatureLabel, 'Clients');
assert.equal(clientTotals.lineCount, 3);
assert.equal(clientTotals.totalDebit, 100.1);
assert.equal(clientTotals.totalCredit, 100);
assert.deepEqual(clientTotals.groups[0].rows[0].cells, {
  accountCode: '411-CLI-0001', accountTitle: 'Client Alpha', lineCount: 3, debit: 100.1, credit: 100
}, 'le cumul tiers filtre les journaux, le code de tiers, le cycle et le compte collectif rattaché');
assert.equal(clientTotals.groups[0].title, 'Cumul par tiers · Clients');
const explicitTierFilter = Report.build({
  reportType: 'third-party-totals',
  thirdPartyRecords: clientRecords,
  thirdPartyMovements: explicitThirdPartyMovements,
  filters: { thirdPartyNature: 'clients', journals: ['VTE'], from: '2026-01-01', to: '2026-02-28' }
});
assert.deepEqual(explicitTierFilter.groups[0].rows.map(row => row.cells.accountTitle), ['Client Alpha', 'Client Beta'],
  'sans code de tiers choisi, le cumul couvre les fiches auxquelles un mouvement explicite correspond');
const ambiguousClientTotals = Report.build({
  reportType: 'third-party-totals',
  thirdPartyRecords: [clientRecords[0], Object.assign({}, clientRecords[1], { code: 'CLI-0001', auxiliaryAccountCode: '411-CLI-0001' })],
  thirdPartyMovements: [explicitThirdPartyMovements[0]],
  filters: { thirdPartyNature: 'clients' }
});
assert.equal(ambiguousClientTotals.lineCount, 0, 'une référence correspondant à plusieurs fiches est exclue plutôt que devinée');
const invalidAuxiliarySource = Report.build({
  reportType: 'third-party-totals', thirdPartyRecords: clientRecords, thirdPartyMovements: explicitThirdPartyMovements,
  sourceErrors: ['Source auxiliaire invalide.'], filters: { thirdPartyNature: 'clients' }
});
assert.deepEqual(invalidAuxiliarySource.sourceErrors, ['Source auxiliaire invalide.']);
assert.deepEqual(invalidAuxiliarySource.groups, [], 'aucun montant partiel n’est affiché si la source auxiliaire échoue à ses contrôles');
assert.equal(invalidAuxiliarySource.lineCount, 0);

const analyticalCenterRecords = [
  { id: 'center-1', code: 'ANA-0001', name: 'Atelier Nord', active: true },
  { id: 'center-2', code: 'ANA-0002', name: 'Atelier Sud', active: false }
];
const analyticalEntries = [
  {
    id: 'analytic-posted-1', date: '2026-01-20', journal: 'OD', status: 'posted',
    sourceMetadata: { lines: [{ analytical_center_id: 'center-1' }] },
    lines: [{ account: '601100', debit: 100, credit: 0 }]
  },
  {
    id: 'analytic-posted-2', date: '2026-02-10', journal: 'OD', status: 'posted',
    lines: [{ account: '401100', analyticalCenterCode: 'ANA-0001', analyticalCenterId: 'center-1', debit: 0, credit: 30 }]
  },
  {
    id: 'analytic-posted-3', date: '2026-02-20', journal: 'VTE', status: 'posted',
    lines: [{ account: '411000', analysisCenter: 'ANA-0001', debit: 0, credit: 70 }]
  },
  {
    id: 'analytic-posted-4', date: '2026-02-28', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', analytic_center_code: 'ANA-0002', debit: 25, credit: 0 }]
  },
  {
    id: 'analytic-unknown', date: '2026-02-15', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', analyticalCenterCode: 'ANA-UNKNOWN', debit: 900, credit: 0 }]
  },
  {
    id: 'analytic-ambiguous', date: '2026-02-16', journal: 'OD', status: 'posted',
    sourceMetadata: { lines: [{ analyticCenter: 'ANA-0002' }] },
    lines: [{ account: '601100', analyticalCenterCode: 'ANA-0001', debit: 800, credit: 0 }]
  },
  {
    id: 'analytic-unassigned', date: '2026-02-17', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', debit: 700, credit: 0 }]
  },
  {
    id: 'analytic-draft', date: '2026-02-18', journal: 'OD', status: 'draft',
    lines: [{ account: '601100', analyticalCenterCode: 'ANA-0001', debit: 600, credit: 0 }]
  },
  {
    id: 'analytic-outside-period', date: '2026-03-01', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', analyticalCenterCode: 'ANA-0001', debit: 500, credit: 0 }]
  }
];
assert.deepEqual(Report.columnsForReport('analytic-center-totals').map(column => column.key),
  ['analyticCode', 'analyticTitle', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('analytic-center-totals').map(column => column.label),
  ['Code analytique', 'Intitulé', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(Report.columnsForReport('analytic-center-totals').map(column => column.defaultSelected), [true, true, true, true, true]);
assert.ok(Report.columnsForReport('analytic-center-totals').every(column => column.selectable));
const analyticalCentersBefore = JSON.parse(JSON.stringify(analyticalCenterRecords));
const analyticalEntriesBefore = JSON.parse(JSON.stringify(analyticalEntries));
const analyticTotals = Report.build({
  reportType: 'analytic-center-totals', analyticalCenters: analyticalCenterRecords, entries: analyticalEntries,
  decimalPlaces: 2,
  filters: {
    analyticalNature: 'responsibility-centers', analyticalNatureLabel: 'Centres de responsabilité',
    analyticalCenters: ['ANA-0001'], journals: ['OD'], from: '2026-01-01', to: '2026-02-28'
  }
});
assert.equal(analyticTotals.centerCount, 1);
assert.equal(analyticTotals.lineCount, 2);
assert.equal(analyticTotals.totalDebit, 100);
assert.equal(analyticTotals.totalCredit, 30);
assert.deepEqual(analyticTotals.groups[0].rows[0].cells, {
  analyticCode: 'ANA-0001', analyticTitle: 'Atelier Nord', lineCount: 2, debit: 100, credit: 30
}, 'le cumul analytique applique période, journaux et code ; il accepte une référence unique présente sur la ligne ou sa métadonnée source');
assert.equal(analyticTotals.groups[0].title, 'Cumul des saisies · Centres de responsabilité');
assert.deepEqual(analyticalCenterRecords, analyticalCentersBefore, 'le cumul ne modifie pas le référentiel des centres');
assert.deepEqual(analyticalEntries, analyticalEntriesBefore, 'le cumul ne modifie aucune pièce comptable');
const analyticMatrix = Report.toMatrix(analyticTotals);
assert.deepEqual(analyticMatrix[0], ['Code analytique', 'Intitulé', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.ok(analyticMatrix.some(row => row[0] === 'ANA-0001' && row[1] === 'Atelier Nord' && row[2] === 2 && row[3] === 100 && row[4] === 30),
  'l’export tabulaire contient le cumul analytique sans ventilation inventée');
const allAnalyticCenters = Report.build({
  reportType: 'analytic-center-totals', analyticalCenters: analyticalCenterRecords, entries: analyticalEntries,
  filters: { analyticalNature: 'responsibility-centers', from: '2026-01-01', to: '2026-02-28' }
});
assert.deepEqual(allAnalyticCenters.groups[0].rows.map(row => row.cells.analyticCode), ['ANA-0001', 'ANA-0002']);
assert.equal(allAnalyticCenters.lineCount, 4, 'les brouillons, références inconnues ou ambiguës, lignes non affectées et dates hors période sont exclus');
assert.equal(allAnalyticCenters.totalDebit, 125);
assert.equal(allAnalyticCenters.totalCredit, 100);
const noAnalyticalNature = Report.build({
  reportType: 'analytic-center-totals', analyticalCenters: analyticalCenterRecords, entries: analyticalEntries,
  filters: { from: '2026-01-01', to: '2026-02-28' }
});
assert.deepEqual(noAnalyticalNature.groups, [], 'sans nature analytique sélectionnée, aucun cumul n’est produit');

const currencyRecords = [
  { code: 'EUR', label: 'Euro', lastRate: '999' },
  { code: 'USD', label: 'Dollar des États-Unis' },
  { code: 'XOF', label: 'Franc CFA', lastRate: '1.000' }
];
const currencyEntries = [
  {
    id: 'currency-eur', date: '2026-01-12', journal: 'OD', status: 'posted', reference: 'OD-EUR-1',
    sourceMetadata: { lines: [{ currencyCode: 'eur', foreignAmount: '12,50' }, { currencyCode: 'EUR', foreignAmount: '12,50' }] },
    lines: [{ account: '601100', debit: 8000, credit: 0 }, { account: '401100', debit: 0, credit: 8000 }]
  },
  {
    id: 'currency-usd', date: '2026-02-01', journal: 'OD', status: 'posted', reference: 'OD-USD-1',
    lines: [
      { account: '601100', currencyCode: 'USD', foreignDebit: 50, debit: 45000, credit: 0 },
      { account: '401100', currencyCode: 'USD', foreignCredit: 50, debit: 0, credit: 45000 }
    ]
  },
  {
    id: 'currency-xof', date: '2026-02-10', journal: 'OD', status: 'posted', reference: 'OD-XOF-1',
    lines: [{ account: '601100', debit: 75, credit: 0 }, { account: '401100', debit: 0, credit: 75 }]
  },
  {
    id: 'currency-unknown', date: '2026-02-11', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', currencyCode: 'JPY', foreignDebit: 90, debit: 1000, credit: 0 }]
  },
  {
    id: 'currency-missing-amount', date: '2026-02-12', journal: 'OD', status: 'posted',
    sourceMetadata: { lines: [{ currencyCode: 'EUR' }] },
    lines: [{ account: '601100', debit: 1200, credit: 0 }]
  },
  {
    id: 'currency-negative-amount', date: '2026-02-13', journal: 'OD', status: 'posted',
    sourceMetadata: { lines: [{ currencyCode: 'EUR', foreignAmount: '-20,00' }] },
    lines: [{ account: '601100', debit: 1300, credit: 0 }]
  },
  {
    id: 'currency-ambiguous', date: '2026-02-14', journal: 'OD', status: 'posted',
    sourceMetadata: { lines: [{ currencyCode: 'EUR', foreignAmount: '25,00' }] },
    lines: [{ account: '601100', currencyCode: 'USD', debit: 1400, credit: 0 }]
  },
  {
    id: 'currency-entry-code-conflict', date: '2026-02-14', journal: 'OD', status: 'posted', currencyCode: 'USD',
    sourceMetadata: { lines: [{ currencyCode: 'EUR', foreignAmount: '10,00' }] },
    lines: [{ account: '601100', debit: 1500, credit: 0 }]
  },
  {
    id: 'currency-other-journal', date: '2026-02-15', journal: 'AC', status: 'posted',
    lines: [{ account: '601100', debit: 1500, credit: 0 }]
  },
  {
    id: 'currency-draft', date: '2026-02-16', journal: 'OD', status: 'draft',
    lines: [{ account: '601100', debit: 1600, credit: 0 }]
  },
  {
    id: 'currency-outside-period', date: '2026-03-01', journal: 'OD', status: 'posted',
    lines: [{ account: '601100', debit: 1700, credit: 0 }]
  }
];
assert.deepEqual(Report.columnsForReport('currency-totals').map(column => column.key),
  ['currencyCode', 'currencyTitle', 'pieceCount', 'lineCount', 'debit', 'credit']);
assert.deepEqual(Report.columnsForReport('currency-totals').map(column => column.label),
  ['Code devise', 'Intitulé de la devise', 'Nombre de pièces', 'Nombre de lignes', 'Total des débits', 'Total des crédits']);
assert.deepEqual(Report.columnsForReport('currency-totals').map(column => column.defaultSelected), [true, true, true, false, true, true],
  'les colonnes et leur sélection initiale suivent la capture ; le nombre de lignes reste facultatif');
assert.ok(Report.columnsForReport('currency-totals').every(column => column.selectable));
const currencyRecordsBefore = JSON.parse(JSON.stringify(currencyRecords));
const currencyEntriesBefore = JSON.parse(JSON.stringify(currencyEntries));
const currencyTotals = Report.build({
  reportType: 'currency-totals', entries: currencyEntries, currencyRecords, baseCurrencyCode: 'XOF',
  filters: { journals: ['OD'], from: '2026-01-01', to: '2026-02-28' }
});
assert.equal(currencyTotals.currencyCount, 3);
assert.equal(currencyTotals.entryCount, 3);
assert.equal(currencyTotals.lineCount, 6);
assert.equal(currencyTotals.omittedLineCount, 5, 'les codes inconnus/contradictoires, les montants d’origine absents/négatifs et les références ambiguës sont signalés puis exclus');
assert.equal(currencyTotals.groups[0].title, 'Cumul des journaux par devises');
assert.deepEqual(currencyTotals.groups[0].rows.map(row => row.currencyCode), ['EUR', 'USD', 'XOF']);
assert.deepEqual(currencyTotals.groups[0].rows.map(row => row.cells), [
  { currencyCode: 'EUR', currencyTitle: 'Euro', pieceCount: 1, debit: 12.5, credit: 12.5 },
  { currencyCode: 'USD', currencyTitle: 'Dollar des États-Unis', pieceCount: 1, debit: 50, credit: 50 },
  { currencyCode: 'XOF', currencyTitle: 'Franc CFA', pieceCount: 1, debit: 75, credit: 75 }
], 'les montants étrangers explicites restent dans leur devise, sans conversion avec le dernier cours configuré');
assert.deepEqual(currencyRecords, currencyRecordsBefore, 'le rapport ne modifie pas le référentiel des devises');
assert.deepEqual(currencyEntries, currencyEntriesBefore, 'le rapport ne modifie aucune écriture');
const currencyMatrix = Report.toMatrix(currencyTotals);
assert.deepEqual(currencyMatrix[0], ['Code devise', 'Intitulé de la devise', 'Nombre de pièces', 'Total des débits', 'Total des crédits']);
assert.ok(currencyMatrix.some(row => row[0] === 'EUR' && row[3] === 12.5 && row[4] === 12.5));
const currencyLineCountReport = Report.build({
  reportType: 'currency-totals', currencyRecords, entries: [currencyEntries[0]],
  columns: ['currencyCode', 'lineCount'], filters: { journals: ['OD'], from: '2026-01-01', to: '2026-12-31' }
});
assert.deepEqual(currencyLineCountReport.groups[0].rows[0].cells, { currencyCode: 'EUR', lineCount: 2 },
  'la colonne facultative du nombre de lignes est calculée et exportable quand elle est activée');
const noForeignCurrencyAmount = Report.build({
  reportType: 'currency-totals', currencyRecords, entries: [{
    id: 'currency-no-source-amount', status: 'posted', journal: 'OD', date: '2026-01-01',
    lines: [{ currencyCode: 'EUR', debit: 100, credit: 0 }]
  }], filters: { journals: ['OD'], from: '2026-01-01', to: '2026-12-31' }
});
assert.deepEqual(noForeignCurrencyAmount.groups, [], 'un montant XOF n’est jamais repris comme montant d’une devise étrangère');
assert.equal(noForeignCurrencyAmount.omittedLineCount, 1);

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

console.log('Rapports de journaux : cumuls par journal, comptes individuels, synthèse, tiers, centres analytiques et devises, filtres et exports — OK');
