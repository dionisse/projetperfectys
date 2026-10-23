/* Vérifie la restitution de la balance d’ouverture depuis le registre dédié, sans données de référence importées. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/opening-balance-report.js');

const accounts = [
  { code: '1', label: 'Ressources durables', cls: 1, postable: false },
  { code: '10', label: 'Capital', cls: 1, postable: false, subclass: '10' },
  { code: '101', label: 'Capital personnel', cls: 1, postable: false, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '101001', label: 'Capital personnel A', cls: 1, postable: true, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '101002', label: 'Capital personnel B', cls: 1, postable: true, subclass: '10', subclassLabel: 'Capital', classLabel: 'Ressources durables' },
  { code: '401100', label: 'Fournisseurs', cls: 4, postable: true },
  { code: '601000', label: 'Achats', cls: 6, postable: true }
];

const openingBalances = [
  { id: 'RAN-1', date: '2025-12-31', accountCode: '101001', debit: 100, credit: 0 },
  { id: 'RAN-2', date: '2025-12-31', accountCode: '101001', debit: 0, credit: 25 },
  { id: 'RAN-3', date: '2025-12-31', accountCode: '101002', debit: 0, credit: 50 },
  { id: 'RAN-4', date: '2025-12-31', accountCode: '401100', debit: 0, credit: 75 }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    openingBalances,
    accountFilter: '*',
    subtotals: true,
    reportDate: '2026-01-01',
    sourceDate: '2025-12-31'
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

console.log('Balance d’ouverture · registre, filtre, lignes, synthèse et devise');

test('reprend les intitulés de colonnes du formulaire et du PDF de référence', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du compte', 'Intitulé du compte', 'Lignes', 'Débit', 'Crédit', 'En devise'
  ]);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.reportLabel), [
    'Compte', 'Intitulé', 'Lignes', 'Débits', 'Crédits', 'En Devise'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('agrège les reports par compte en conservant séparément les débits et crédits sources', () => {
  const report = build({ subtotals: false });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.reportDate, '2026-01-01');
  assert.equal(report.sourceDate, '2025-12-31');
  assert.deepEqual(report.rows.map(row => row.code), ['101001', '101002', '401100']);
  assert.equal(report.rows[0].debit, 100);
  assert.equal(report.rows[0].credit, 25);
  assert.equal(report.rows[0].lines, 2);
  assert.equal(report.totals.accountCount, 3);
  assert.equal(report.totals.lines, 4);
  assert.equal(report.totals.debit, 100);
  assert.equal(report.totals.credit, 150);
  assert.equal(report.totals.balanced, false);
  assert.equal(report.totals.difference, -50);
  assert.equal(report.rows[0].currency, '');
  assert.deepEqual(report.sourceRecords.map(record => record.id), ['RAN-1', 'RAN-2', 'RAN-3', 'RAN-4']);
  assert.equal(report.basis.grossDebitAndCreditRetained, true);
  assert.equal(report.basis.foreignCurrencyAmountsAvailable, false);
});

test('filtre les comptes sélectionnés sans ajouter les comptes vides du plan', () => {
  const report = build({ accountFilter: '10100*', subtotals: false });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.code), ['101001', '101002']);
  assert.equal(report.totals.accountCount, 2);
  assert.equal(report.totals.lines, 3);
  assert.equal(report.totals.debit, 100);
  assert.equal(report.totals.credit, 75);
});

test('ajoute des sous-totaux hiérarchiques et compte les lignes sources à chaque niveau', () => {
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  const subtotalRows = report.displayRows.filter(row => row.rowType === 'subtotal');
  assert.deepEqual(subtotalRows.map(row => row.code), ['Total 101', 'Total 10', 'Total 1']);
  subtotalRows.forEach(row => {
    assert.equal(row.lines, 3, row.code + ' doit compter les trois lignes de reports de la classe 1');
    assert.equal(row.debit, 100);
    assert.equal(row.credit, 75);
    assert.equal(row.currency, '');
  });
  assert.equal(report.totals.lines, 4, 'le total général inclut également la ligne du compte 401100');
  assert.equal(report.basis.foreignCurrencyAmountsAvailable, false);
});

test('écarte les lignes invalides sans corriger les montants valides', () => {
  const report = build({ openingBalances: openingBalances.concat([
    { id: 'BAD-DATE', date: '2025-12-30', accountCode: '101002', debit: 9, credit: 0 },
    { id: 'BAD-ACCOUNT', date: '2025-12-31', accountCode: '999999', debit: 8, credit: 0 },
    { id: 'BAD-CLASS', date: '2025-12-31', accountCode: '601000', debit: 7, credit: 0 },
    { id: 'BAD-AMOUNT', date: '2025-12-31', accountCode: '101002', debit: 1.5, credit: 0 },
    { id: 'BAD-SIDES', date: '2025-12-31', accountCode: '101002', debit: 4, credit: 5 },
    { id: 'BAD-ZERO', date: '2025-12-31', accountCode: '101002', debit: 0, credit: 0 }
  ]) });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.invalidLineCount, 6);
  assert.equal(report.rows.length, 3);
  assert.equal(report.totals.debit, 100);
  assert.equal(report.totals.credit, 150);
  assert.ok(report.warnings.some(message => message.includes('6 lignes de report invalides')));
});

test('refuse une date de registre qui ne correspond pas à la veille du cycle', () => {
  const report = build({ sourceDate: '2025-12-30' });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(message => message.includes('veille du début du cycle')));
  assert.equal(report.rows.length, 0);
});

test('refuse un filtre vide et signale explicitement le caractère non simulé de la devise', () => {
  const emptyFilter = build({ accountFilter: '' });
  assert.equal(emptyFilter.ok, false);
  assert.ok(emptyFilter.errors.some(message => message.includes('Indiquez un compte')));

  const report = build({ subtotals: false });
  assert.equal(report.basis.amountsInXof, true);
  assert.equal(report.basis.foreignCurrencyAmountsAvailable, false);
  assert.ok(report.rows.every(row => row.currency === ''), 'la colonne de devise reste vide pour chaque compte');
});

console.log('Balance d’ouverture : tests de calcul terminés.');
