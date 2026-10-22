/* Vérifie les calculs documentés de la balance générale, sans modifier le dossier. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/accounting-balance-report.js');

const accounts = [
  { code: '101000', label: 'Capital', cls: 1, aux: false },
  { code: '401100', label: 'Fournisseurs collectifs', cls: 4, aux: true },
  { code: '401200', label: 'Fournisseur sans auxiliaire', cls: 4, aux: false },
  { code: '411100', label: 'Clients collectifs', cls: 4, aux: true },
  { code: '601000', label: 'Achats', cls: 6, aux: false }
];

const journals = [
  { code: 'OD', operationNature: 'Opérations courantes' },
  { code: 'INV', operationNature: 'Inventaire' },
  { code: 'RPE', operationNature: 'Résultat de l’exercice' }
];

const entries = [
  { id: 'OPEN-MOVE', date: '2026-01-02', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 100 }
  ] },
  { id: 'PERIOD-MOVE', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
    { account: '401100', debit: 30, credit: 0 }, { account: '101000', debit: 0, credit: 30 }
  ] },
  { id: 'INVENTORY', date: '2026-01-09', status: 'posted', journal: 'INV', lines: [
    { account: '101000', debit: 20, credit: 0 }, { account: '401100', debit: 0, credit: 20 }
  ] },
  { id: 'RESULT', date: '2026-01-09', status: 'posted', journal: 'RPE', lines: [
    { account: '401100', debit: 5, credit: 0 }, { account: '101000', debit: 0, credit: 5 }
  ] },
  { id: 'DRAFT', date: '2026-01-08', status: 'draft', journal: 'OD', lines: [
    { account: '101000', debit: 999, credit: 0 }, { account: '401100', debit: 0, credit: 999 }
  ] },
  { id: 'OUTSIDE-CYCLE', date: '2025-12-31', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 500, credit: 0 }, { account: '401100', debit: 0, credit: 500 }
  ] },
  { id: 'AFTER-RANGE', date: '2026-01-11', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 700, credit: 0 }, { account: '401100', debit: 0, credit: 700 }
  ] }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances: [
      { id: 'RAN-1', date: '2025-12-31', accountCode: '101000', debit: 50, credit: 0 },
      { id: 'RAN-2', date: '2025-12-31', accountCode: '401100', debit: 0, credit: 50 }
    ],
    journals,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    decimalPlaces: 0,
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' },
    columns: { code: true, label: true, movements: true, movementBalance: true }
  }, overrides));
}

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.stack);
    process.exitCode = 1;
  }
}

console.log('Balance générale des comptes · source réelle, filtres et soldes');

test('le filtre de comptes accepte tous, les codes exacts et les préfixes génériques', () => {
  assert.equal(Report.parseAccountFilter('*').all, true);
  assert.equal(Report.accountMatches('401100', Report.parseAccountFilter('401*; 411100')), true);
  assert.equal(Report.accountMatches('401200', Report.parseAccountFilter('401100')), false);
  assert.equal(Report.parseAccountFilter('  ').valid, false);
});

test('les mouvements couvrent les bornes, excluent brouillons et dates hors cycle/période, et intègrent le report au solde d’ouverture', () => {
  const report = build();
  assert.equal(report.ok, true);
  assert.equal(report.movementEntryCount, 3);
  assert.equal(report.totals.movementDebit, 55);
  assert.equal(report.totals.movementCredit, 55);
  const capital = report.rows.find(row => row.code === '101000');
  const suppliers = report.rows.find(row => row.code === '401100');
  assert.equal(capital.openingBalance, 150, 'report à nouveau débiteur plus pièce validée antérieure à la période');
  assert.equal(capital.movementBalance, -15);
  assert.equal(capital.closingBalance, 135);
  assert.equal(suppliers.openingBalance, -150, 'report à nouveau et pièce antérieure au crédit');
  assert.equal(suppliers.movementBalance, 15);
  assert.equal(suppliers.closingBalance, -135);
  assert.equal(report.openingBalanceLineCount, 2);
});

test('les options avant inventaire et avant résultat filtrent par nature enregistrée du journal', () => {
  const inventoryExcluded = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeInventory: true, groupMode: 'none' } });
  assert.equal(inventoryExcluded.movementEntryCount, 2);
  assert.equal(inventoryExcluded.totals.movementDebit, 35);
  const resultExcluded = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeResult: true, groupMode: 'none' } });
  assert.equal(resultExcluded.movementEntryCount, 2);
  assert.equal(resultExcluded.totals.movementDebit, 50);
  const both = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeInventory: true, beforeResult: true, groupMode: 'none' } });
  assert.equal(both.movementEntryCount, 1);
  assert.equal(both.totals.movementDebit, 30);
});

test('comptes collectifs limite aux comptes auxiliaires connus de classe 4', () => {
  const report = build({ filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', collectivesOnly: true, groupMode: 'none' } });
  assert.deepEqual(report.rows.map(row => row.code), ['401100']);
  assert.equal(report.totals.movementDebit, 35, 'la ligne de classe 4 de l’écriture d’inventaire reste comprise sans filtre avant inventaire');
});

test('une période inversée est rejetée par le calcul pur', () => {
  const report = build({ filters: { accounts: '*', from: '2026-02-01', to: '2026-01-10', groupMode: 'none' } });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(error => error.includes('début')));
});

test('une sélection explicite montre les comptes sans mouvement et respecte le mode ordre du plan', () => {
  const filters = { accounts: '101000, 411*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' };
  const ungrouped = build({ accounts: [accounts[3], accounts[0]], entries: [], openingBalances: [], filters });
  assert.deepEqual(ungrouped.rows.map(row => row.code), ['101000', '411100']);
  const grouped = build({ accounts: [accounts[3], accounts[0]], entries: [], openingBalances: [], filters: Object.assign({}, filters, { groupMode: 'chart' }) });
  assert.deepEqual(grouped.rows.map(row => row.code), ['411100', '101000']);
});

test('les montants respectent la précision du dossier et les données source restent inchangées', () => {
  const decimalEntries = [{ id: 'DECIMAL', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
    { account: '101000', debit: 1.23, credit: 0 }, { account: '401100', debit: 0, credit: 1.23 }
  ] }];
  const before = JSON.stringify(decimalEntries);
  const report = build({ entries: decimalEntries, openingBalances: [], decimalPlaces: 2,
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'none' } });
  assert.equal(report.totals.movementDebit, 1.23);
  assert.equal(report.rows.find(row => row.code === '101000').movementBalance, 1.23);
  assert.equal(JSON.stringify(decimalEntries), before);
});

test('les cumuls début et fin conservent séparément les débits et crédits', () => {
  const report = build({ columns: { code: true, cumulativeStart: true, cumulativeEnd: true } });
  assert.deepEqual(report.columns, ['code', 'cumulativeStart', 'cumulativeEnd']);
  const capital = report.rows.find(row => row.code === '101000');
  const suppliers = report.rows.find(row => row.code === '401100');
  assert.deepEqual(
    [capital.cumulativeStartDebit, capital.cumulativeStartCredit, capital.cumulativeEndDebit, capital.cumulativeEndCredit],
    [150, 0, 170, 35],
    'début = report + mouvements antérieurs ; fin = début + mouvements débit/crédit de période'
  );
  assert.deepEqual(
    [suppliers.cumulativeStartDebit, suppliers.cumulativeStartCredit, suppliers.cumulativeEndDebit, suppliers.cumulativeEndCredit],
    [0, 150, 35, 170]
  );
  assert.equal(report.totals.cumulativeStartDebit, 150);
  assert.equal(report.totals.cumulativeStartCredit, 150);
  assert.equal(report.totals.cumulativeEndDebit, 205);
  assert.equal(report.totals.cumulativeEndCredit, 205);
  assert.equal(capital.closingBalance, capital.cumulativeEndDebit - capital.cumulativeEndCredit);
  assert.equal(suppliers.closingBalance, suppliers.cumulativeEndDebit - suppliers.cumulativeEndCredit);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeStart').supported, true);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeEnd').supported, true);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeStart').defaultSelected, false);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'cumulativeEnd').defaultSelected, false);
});

test('les regroupements suivent les niveaux du plan et les sous-totaux ferment chaque branche', () => {
  const hierarchyAccounts = [
    { code: '12', label: 'Report à nouveau', cls: 1, classLabel: 'Ressources durables', subclass: '12', subclassLabel: 'Report à nouveau', postable: false },
    { code: '129', label: 'Report à nouveau débiteur', cls: 1, classLabel: 'Ressources durables', subclass: '12', subclassLabel: 'Report à nouveau', postable: true },
    { code: '129000', label: 'RAN débiteur', cls: 1, classLabel: 'Ressources durables', subclass: '12', subclassLabel: 'Report à nouveau', postable: true },
    { code: '13', label: 'Résultat net de l’exercice', cls: 1, classLabel: 'Ressources durables', subclass: '13', subclassLabel: 'Résultat net', postable: false },
    { code: '130', label: 'Résultat en instance', cls: 1, classLabel: 'Ressources durables', subclass: '13', subclassLabel: 'Résultat net', postable: true },
    { code: '1309', label: 'Perte en instance', cls: 1, classLabel: 'Ressources durables', subclass: '13', subclassLabel: 'Résultat net', postable: true },
    { code: '130900', label: 'Perte en instance détaillée', cls: 1, classLabel: 'Ressources durables', subclass: '13', subclassLabel: 'Résultat net', postable: true },
    { code: '139', label: 'Résultat net : perte', cls: 1, classLabel: 'Ressources durables', subclass: '13', subclassLabel: 'Résultat net', postable: true }
  ];
  const groupedEntries = [{ id: 'GROUPED', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
    { account: '129000', debit: 100, credit: 0 },
    { account: '130900', debit: 50, credit: 20 },
    { account: '139', debit: 0, credit: 40 }
  ] }];
  const common = {
    accounts: hierarchyAccounts,
    entries: groupedEntries,
    openingBalances: [],
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'chart' },
    columns: { code: true, label: true, movements: true, movementBalance: true }
  };
  const chart = build(common);
  assert.deepEqual(chart.displayRows.map(row => `${row.rowType}:${row.code}`), [
    'group:1', 'group:12', 'group:129', 'account:129000',
    'group:13', 'group:130', 'group:1309', 'account:130900', 'account:139'
  ]);
  const classTotal = chart.displayRows.find(row => row.rowType === 'group' && row.code === '1');
  assert.deepEqual([classTotal.movementDebit, classTotal.movementCredit, classTotal.movementBalanceDebit, classTotal.movementBalanceCredit], [150, 60, 130, 40]);

  const subtotals = build(Object.assign({}, common, { filters: Object.assign({}, common.filters, { groupMode: 'subtotals' }) }));
  assert.deepEqual(subtotals.displayRows.map(row => `${row.rowType}:${row.code}`), [
    'account:129000', 'subtotal:Total 129', 'subtotal:Total 12',
    'account:130900', 'subtotal:Total 1309', 'subtotal:Total 130',
    'account:139', 'subtotal:Total 13', 'subtotal:Total 1'
  ]);
  const resultSubtotal = subtotals.displayRows.find(row => row.code === 'Total 13');
  assert.deepEqual([resultSubtotal.movementDebit, resultSubtotal.movementCredit, resultSubtotal.movementBalanceDebit, resultSubtotal.movementBalanceCredit], [50, 60, 30, 40]);

  const customPlan = build({
    accounts: [{ code: '987654', label: 'Compte personnalisé', cls: 9, classLabel: 'Classe 9', subclass: '98', subclassLabel: 'Comptes personnalisés', postable: true }],
    entries: [{ id: 'CUSTOM', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [{ account: '987654', debit: 1, credit: 0 }] }],
    openingBalances: [],
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', groupMode: 'chart' }
  });
  assert.deepEqual(customPlan.displayRows.slice(0, 2).map(row => [row.code, row.label]), [['9', ''], ['98', '']]);
});

test('les totaux intermédiaires séparent bilan et gestion et la classe 8 reste au choix', () => {
  const totalAccounts = [
    { code: '101000', label: 'Capital', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', postable: true },
    { code: '401100', label: 'Fournisseurs', cls: 4, classLabel: 'Tiers', subclass: '40', subclassLabel: 'Fournisseurs', postable: true },
    { code: '601000', label: 'Achats', cls: 6, classLabel: 'Charges', subclass: '60', subclassLabel: 'Achats', postable: true },
    { code: '701000', label: 'Ventes', cls: 7, classLabel: 'Produits', subclass: '70', subclassLabel: 'Ventes', postable: true },
    { code: '811000', label: 'Charge H.A.O.', cls: 8, classLabel: 'SIG et comptes spéciaux', subclass: '81', subclassLabel: 'Charges H.A.O.', postable: true },
    { code: '821000', label: 'Produit H.A.O.', cls: 8, classLabel: 'SIG et comptes spéciaux', subclass: '82', subclassLabel: 'Produits H.A.O.', postable: true }
  ];
  const totalEntries = [
    { id: 'BALANCE', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
      { account: '101000', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 100 }
    ] },
    { id: 'MANAGEMENT', date: '2026-01-07', status: 'posted', journal: 'OD', lines: [
      { account: '601000', debit: 30, credit: 0 }, { account: '701000', debit: 0, credit: 30 }
    ] },
    { id: 'HAO', date: '2026-01-08', status: 'posted', journal: 'OD', lines: [
      { account: '811000', debit: 10, credit: 0 }, { account: '821000', debit: 0, credit: 10 }
    ] }
  ];
  const common = {
    accounts: totalAccounts,
    entries: totalEntries,
    openingBalances: [],
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', intermediateTotal: true, groupMode: 'none' }
  };
  const report = build(common);
  assert.deepEqual(report.displayRows.filter(row => row.rowType === 'intermediate-total').map(row => [row.label, row.movementDebit, row.movementCredit]), [
    ['Total des comptes de bilan', 100, 100],
    ['Total des comptes de gestion', 40, 40]
  ]);
  assert.equal(report.displayRows.find(row => row.rowType === 'intermediate-total' && row.intermediateCategory === 'balance').movementBalanceDebit, 100);
  assert.equal(report.displayRows.find(row => row.rowType === 'intermediate-total' && row.intermediateCategory === 'balance').movementBalanceCredit, 100);
  assert.ok(report.displayRows.findIndex(row => row.rowType === 'intermediate-total' && row.intermediateCategory === 'balance') < report.displayRows.findIndex(row => row.code === '601000'));
  assert.ok(report.displayRows.findIndex(row => row.rowType === 'intermediate-total' && row.intermediateCategory === 'management') > report.displayRows.findIndex(row => row.code === '821000'));

  const grouped = build(Object.assign({}, common, { filters: Object.assign({}, common.filters, { groupMode: 'chart' }) }));
  assert.ok(grouped.displayRows.findIndex(row => row.intermediateCategory === 'balance') < grouped.displayRows.findIndex(row => row.rowType === 'group' && row.code === '6'));
  assert.ok(grouped.displayRows.findIndex(row => row.intermediateCategory === 'management') > grouped.displayRows.findIndex(row => row.code === '821000'));

  const withoutClass8 = build(Object.assign({}, common, { filters: Object.assign({}, common.filters, { includeClass8InManagement: false, groupMode: 'subtotals' }) }));
  const managementTotal = withoutClass8.displayRows.find(row => row.rowType === 'intermediate-total' && row.intermediateCategory === 'management');
  assert.deepEqual([managementTotal.movementDebit, managementTotal.movementCredit], [30, 30]);
  assert.ok(withoutClass8.displayRows.findIndex(row => row.intermediateCategory === 'management') < withoutClass8.displayRows.findIndex(row => row.code === 'Total 81'));
});

test('la Balance de synthèse regroupe aux niveaux 01 à 05 et développe les niveaux inférieurs à la demande', () => {
  const summaryAccounts = [
    { code: '10', label: 'Capital', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', postable: false },
    { code: '101', label: 'Capital social', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', postable: false },
    { code: '101000', label: 'Capital social A', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', postable: true },
    { code: '101100', label: 'Capital social B', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', postable: true },
    { code: '40', label: 'Fournisseurs et comptes rattachés', cls: 4, classLabel: 'Tiers', subclass: '40', subclassLabel: 'Fournisseurs et comptes rattachés', postable: false },
    { code: '401', label: 'Fournisseurs, dettes en compte', cls: 4, classLabel: 'Tiers', subclass: '40', subclassLabel: 'Fournisseurs et comptes rattachés', postable: false },
    { code: '401100', label: 'Fournisseurs', cls: 4, classLabel: 'Tiers', subclass: '40', subclassLabel: 'Fournisseurs et comptes rattachés', postable: true }
  ];
  const summaryOptions = {
    accounts: summaryAccounts,
    entries: [
      { id: 'S1', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [{ account: '101000', debit: 100, credit: 0 }] },
      { id: 'S2', date: '2026-01-07', status: 'posted', journal: 'OD', lines: [{ account: '101100', debit: 0, credit: 20 }] },
      { id: 'S3', date: '2026-01-08', status: 'posted', journal: 'OD', lines: [{ account: '401100', debit: 15, credit: 0 }] }
    ],
    openingBalances: [
      { id: 'R1', date: '2025-12-31', accountCode: '101000', debit: 40, credit: 0 },
      { id: 'R2', date: '2025-12-31', accountCode: '101100', debit: 0, credit: 5 }
    ],
    journals,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    decimalPlaces: 0,
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', summaryLevel: 1, includeLowerLevels: false },
    columns: { code: true, label: true, openingBalance: true, movements: true, closingBalance: true }
  };
  const byClass = Report.buildSummary(summaryOptions);
  assert.deepEqual(byClass.rows.map(row => [row.code, row.label]), [['1', 'Ressources durables'], ['4', 'Tiers']]);
  assert.deepEqual(byClass.displayRows.map(row => row.code), ['1', '4'], 'sans niveaux inférieurs, seul le niveau choisi est affiché');
  const capitalClass = byClass.rows[0];
  assert.deepEqual([capitalClass.openingBalanceDebit, capitalClass.openingBalanceCredit, capitalClass.movementDebit, capitalClass.movementCredit, capitalClass.closingBalanceDebit, capitalClass.closingBalanceCredit], [40, 5, 100, 20, 140, 25]);
  assert.equal(byClass.totals.movementDebit, 115);
  assert.equal(byClass.totals.movementCredit, 20);

  const levelTwo = Report.buildSummary(Object.assign({}, summaryOptions, { filters: Object.assign({}, summaryOptions.filters, { summaryLevel: 2 }) }));
  assert.deepEqual(levelTwo.rows.map(row => [row.code, row.label]), [['10', 'Capital'], ['40', 'Fournisseurs et comptes rattachés']]);
  const levelThree = Report.buildSummary(Object.assign({}, summaryOptions, { filters: Object.assign({}, summaryOptions.filters, { summaryLevel: 3, includeLowerLevels: true }) }));
  assert.deepEqual(levelThree.rows.map(row => row.code), ['101', '401']);
  assert.deepEqual(levelThree.displayRows.map(row => row.code), ['101', '1010', '10100', '1011', '10110', '401', '4011', '40110']);
  assert.equal(levelThree.displayRows.find(row => row.code === '1010').label, '', 'aucun libellé n’est fabriqué pour un préfixe absent du plan');
  const levelFour = Report.buildSummary(Object.assign({}, summaryOptions, { filters: Object.assign({}, summaryOptions.filters, { summaryLevel: 4 }) }));
  assert.deepEqual(levelFour.rows.map(row => row.code), ['1010', '1011', '4011']);
  const levelFive = Report.buildSummary(Object.assign({}, summaryOptions, { filters: Object.assign({}, summaryOptions.filters, { summaryLevel: 5 }) }));
  assert.deepEqual(levelFive.rows.map(row => row.code), ['10100', '10110', '40110']);
  assert.deepEqual([levelFive.rows[0].movementDebit, levelFive.rows[0].movementCredit], [100, 0]);
  assert.deepEqual([levelFive.rows[1].movementDebit, levelFive.rows[1].movementCredit], [0, 20]);

  const specialNatureEntries = summaryOptions.entries.concat([
    { id: 'SUMMARY-INV', date: '2026-01-09', status: 'posted', journal: 'INV', lines: [{ account: '101000', debit: 7, credit: 0 }] },
    { id: 'SUMMARY-RESULT', date: '2026-01-09', status: 'posted', journal: 'RPE', lines: [{ account: '101000', debit: 0, credit: 3 }] }
  ]);
  const beforeInventory = Report.buildSummary(Object.assign({}, summaryOptions, {
    entries: specialNatureEntries,
    filters: Object.assign({}, summaryOptions.filters, { beforeInventory: true })
  }));
  const beforeResult = Report.buildSummary(Object.assign({}, summaryOptions, {
    entries: specialNatureEntries,
    filters: Object.assign({}, summaryOptions.filters, { beforeResult: true })
  }));
  assert.equal(beforeInventory.totals.movementDebit, 115, 'l’option est transmise au calcul de base');
  assert.equal(beforeResult.totals.movementCredit, 20, 'la nature Résultat de l’exercice reste distincte');
});

test('les filtres de nature s’appliquent aussi aux mouvements qui alimentent les cumuls', () => {
  const filteredEntries = [
    { id: 'PRE-ORDINARY', date: '2026-01-02', status: 'posted', journal: 'OD', lines: [
      { account: '101000', debit: 10, credit: 0 }, { account: '401100', debit: 0, credit: 10 }
    ] },
    { id: 'PRE-INVENTORY', date: '2026-01-03', status: 'posted', journal: 'INV', lines: [
      { account: '101000', debit: 5, credit: 0 }, { account: '401100', debit: 0, credit: 5 }
    ] },
    { id: 'PERIOD-ORDINARY', date: '2026-01-06', status: 'posted', journal: 'OD', lines: [
      { account: '101000', debit: 3, credit: 0 }, { account: '401100', debit: 0, credit: 3 }
    ] },
    { id: 'PERIOD-INVENTORY', date: '2026-01-08', status: 'posted', journal: 'INV', lines: [
      { account: '101000', debit: 7, credit: 0 }, { account: '401100', debit: 0, credit: 7 }
    ] }
  ];
  const report = build({
    entries: filteredEntries,
    openingBalances: [],
    filters: { accounts: '*', from: '2026-01-05', to: '2026-01-10', beforeInventory: true, groupMode: 'none' },
    columns: { code: true, cumulativeStart: true, cumulativeEnd: true }
  });
  const capital = report.rows.find(row => row.code === '101000');
  const suppliers = report.rows.find(row => row.code === '401100');
  assert.equal(capital.cumulativeStartDebit, 10);
  assert.equal(capital.cumulativeEndDebit, 13);
  assert.equal(suppliers.cumulativeStartCredit, 10);
  assert.equal(suppliers.cumulativeEndCredit, 13);
  assert.equal(report.movementEntryCount, 1);
});
