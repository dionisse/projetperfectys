/* Vérifie la position des comptes à date à partir des reports et pièces validées du dossier. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/account-situation-report.js');

const accounts = [
  { code: '1', label: 'Ressources durables', cls: 1, postable: false },
  { code: '10', label: 'Capital', cls: 1, postable: false, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '101', label: 'Capital social', cls: 1, postable: false, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '101001', label: 'Capital personnel A', cls: 1, postable: true, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '101002', label: 'Capital personnel B', cls: 1, postable: true, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '4', label: 'Tiers', cls: 4, postable: false },
  { code: '40', label: 'Fournisseurs et comptes rattachés', cls: 4, postable: false, subclass: '40', subclassLabel: 'Fournisseurs', classLabel: 'Tiers' },
  { code: '401', label: 'Fournisseurs en compte', cls: 4, postable: false, subclass: '40', subclassLabel: 'Fournisseurs', classLabel: 'Tiers' },
  { code: '401001', label: 'Fournisseur A', cls: 4, postable: true, subclass: '40', subclassLabel: 'Fournisseurs', classLabel: 'Tiers' },
  { code: '5', label: 'Trésorerie', cls: 5, postable: false },
  { code: '52', label: 'Banques', cls: 5, postable: false, subclass: '52', subclassLabel: 'Banques', classLabel: 'Trésorerie' },
  { code: '521001', label: 'Banque A', cls: 5, postable: true, subclass: '52', subclassLabel: 'Banques', classLabel: 'Trésorerie' }
];

const openingBalances = [
  { id: 'RAN-1', date: '2025-12-31', accountCode: '101001', debit: 0, credit: 100 },
  { id: 'RAN-2', date: '2025-12-31', accountCode: '401001', debit: 0, credit: 40 },
  { id: 'RAN-3', date: '2025-12-31', accountCode: '521001', debit: 140, credit: 0 }
];

const entries = [
  { id: 'E1', date: '2026-02-01', status: 'posted', lines: [
    { account: '101001', debit: 25, credit: 0 }, { account: '521001', debit: 0, credit: 25 }
  ] },
  { id: 'E2', date: '2026-06-30', status: 'posted', lines: [
    { account: '401001', debit: 15, credit: 0 }, { account: '521001', debit: 0, credit: 15 },
    { account: '101002', debit: 7, credit: 0 }, { account: '521001', debit: 0, credit: 7 }
  ] },
  { id: 'FUTURE', date: '2026-07-01', status: 'posted', lines: [
    { account: '101001', debit: 900, credit: 0 }, { account: '521001', debit: 0, credit: 900 }
  ] },
  { id: 'DRAFT', date: '2026-04-01', status: 'draft', lines: [
    { account: '101001', debit: 500, credit: 0 }, { account: '521001', debit: 0, credit: 500 }
  ] }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances,
    journals: [],
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    asOfDate: '2026-06-30',
    accountFilter: '*',
    includeGrouping: false,
    decimalPlaces: 0
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

console.log('Situation des comptes · arrêté à date, comptes de regroupement et soldes');

test('reprend les intitulés de sélection et de sortie et coche les quatre colonnes par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du compte', 'Intitulé du compte', 'Débit', 'Crédit'
  ]);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.reportLabel), [
    'Compte', 'Intitulé', 'Débit', 'Crédit'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('calcule la position nette à la date incluse avec les reports et seules les écritures validées du cycle', () => {
  const sourceBefore = JSON.stringify({ openingBalances, entries });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.asOfDate, '2026-06-30');
  assert.deepEqual(report.rows.map(row => row.code), ['101001', '101002', '401001', '521001']);
  assert.equal(report.rows.find(row => row.code === '101001').debit, 0);
  assert.equal(report.rows.find(row => row.code === '101001').credit, 75);
  assert.equal(report.rows.find(row => row.code === '101002').debit, 7);
  assert.equal(report.rows.find(row => row.code === '401001').credit, 25);
  assert.equal(report.rows.find(row => row.code === '521001').debit, 93);
  assert.equal(report.totals.accountCount, 4);
  assert.equal(report.totals.debit, 100);
  assert.equal(report.totals.credit, 100);
  assert.equal(report.totals.balanced, true);
  assert.equal(report.generatedLineCount, 4);
  assert.equal(report.basis.cutoffDateInclusive, true);
  assert.equal(report.basis.draftEntriesExcluded, true);
  assert.equal(JSON.stringify({ openingBalances, entries }), sourceBefore, 'le calcul ne modifie ni les reports ni les pièces');
});

test('le filtre de comptes limite les soldes et ne rajoute pas de lignes de regroupement par défaut', () => {
  const report = build({ accountFilter: '101*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.code), ['101001', '101002']);
  assert.deepEqual(report.displayRows.map(row => row.rowType), ['account', 'account']);
  assert.equal(report.totals.debit, 7);
  assert.equal(report.totals.credit, 75);
});

test('la case regroupement affiche les rubriques du plan sans les additionner deux fois au total', () => {
  const report = build({ includeGrouping: true });
  assert.equal(report.ok, true, report.errors.join(' '));
  const resources = report.displayRows.find(row => row.rowType === 'group' && row.code === '1');
  const suppliers = report.displayRows.find(row => row.rowType === 'group' && row.code === '40');
  const treasury = report.displayRows.find(row => row.rowType === 'group' && row.code === '5');
  assert.equal(resources.label, 'Ressources durables');
  assert.equal(resources.debit, 7);
  assert.equal(resources.credit, 75);
  assert.equal(suppliers.label, 'Fournisseurs et comptes rattachés');
  assert.equal(suppliers.credit, 25);
  assert.equal(treasury.debit, 93);
  assert.ok(report.generatedLineCount > report.rows.length);
  assert.equal(report.totals.debit, 100, 'les lignes de regroupement ne sont pas recomptées dans le total');
  assert.equal(report.totals.credit, 100);
});

test('refuse une date hors du cycle et un filtre de comptes vide', () => {
  const outside = build({ asOfDate: '2027-01-01' });
  assert.equal(outside.ok, false);
  assert.ok(outside.errors.some(message => message.includes('rester dans le cycle')));
  const invalidFilter = build({ accountFilter: '' });
  assert.equal(invalidFilter.ok, false);
  assert.ok(invalidFilter.errors.some(message => message.includes('Indiquez un compte')));
});

console.log('Situation des comptes : tests de calcul terminés.');
