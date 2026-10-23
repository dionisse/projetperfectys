/* Vérifie le détail ligne par ligne du registre des reports à nouveau. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/opening-balance-journal-report.js');

const accounts = [
  { code: '401', label: 'Fournisseurs', cls: 4, postable: false },
  { code: '401100', label: 'Fournisseurs locaux', cls: 4, postable: true },
  { code: '411100', label: 'Clients locaux', cls: 4, postable: true },
  { code: '601000', label: 'Achats', cls: 6, postable: true }
];

const openingBalances = [
  {
    id: 'RAN-1', date: '2025-12-31', accountCode: '401100', reference: 'F-2025-19',
    debit: 0, credit: 1250, label: 'Facture fournisseur à reporter',
    letteringDate: '2025-12-31', currencyAmount: 999, thirdParty: 'TIER-01'
  },
  { id: 'RAN-2', date: '2025-12-31', accountCode: '411100', reference: 'C-2025-05', debit: 2500, credit: 0, label: 'Solde client reporté' },
  { id: 'RAN-WRONG-DATE', date: '2025-12-30', accountCode: '401100', debit: 1, credit: 0, label: 'Doit être écarté' },
  { id: 'RAN-WRONG-CLASS', date: '2025-12-31', accountCode: '601000', debit: 2, credit: 0, label: 'Doit être écarté' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    openingBalances,
    accountFilter: '*',
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

console.log('Journal des reports · registre, colonnes, filtre et disponibilité des données');

test('reprend les neuf colonnes de la capture dans le même ordre', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du compte', 'Intitulé du compte', 'Date', 'Référence', 'Date lettrage',
    'Débit', 'Crédit', 'Montant en devise', 'Libellé'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'letteringDate').supported, false);
  assert.equal(Report.COLUMN_DEFINITIONS.find(column => column.key === 'currencyAmount').supported, false);
});

test('détaille une ligne par enregistrement du registre avec le libellé du plan comptable', () => {
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.reportDate, '2026-01-01');
  assert.equal(report.sourceDate, '2025-12-31');
  assert.equal(report.lineCount, 2);
  assert.equal(report.totals.lines, 2);
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.accountTitle, row.reference]), [
    ['401100', 'Fournisseurs locaux', 'F-2025-19'],
    ['411100', 'Clients locaux', 'C-2025-05']
  ]);
  assert.deepEqual(report.rows.map(row => [row.date, row.debit, row.credit, row.label]), [
    ['2025-12-31', 0, 1250, 'Facture fournisseur à reporter'],
    ['2025-12-31', 2500, 0, 'Solde client reporté']
  ]);
});

test('ne reprend pas de date de lettrage ou de montant de devise absents du modèle', () => {
  const report = build();
  assert.equal(report.rows[0].letteringDate, '');
  assert.equal(report.rows[0].currencyAmount, '');
  assert.equal(report.basis.letteringDateAvailable, false);
  assert.equal(report.basis.foreignCurrencyAmountsAvailable, false);
  assert.equal(report.basis.journalEntriesUsed, false);
  assert.deepEqual(openingBalances[0].letteringDate, '2025-12-31', 'le rapport ne modifie pas la donnée d’entrée');
});

test('filtre les comptes et écarte les lignes invalides selon les contrôles du registre', () => {
  const report = build({ accountFilter: '401*' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 1);
  assert.equal(report.rows[0].accountCode, '401100');
  assert.equal(report.invalidLineCount, 1, 'la ligne de la classe 6 est invalide pour le registre');
  assert.ok(report.warnings.some(message => message.includes('ligne de report invalide')));
});

test('refuse une date de registre qui n’est pas la veille du cycle', () => {
  const report = build({ sourceDate: '2025-12-30' });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some(message => message.includes('veille du début du cycle')));
  assert.deepEqual(report.rows, []);
});

test('ne lit pas les pièces de journal ni des montants de devise pour construire le rapport', () => {
  const report = Report.build({
    accounts,
    openingBalances: [openingBalances[0]],
    entries: [{ accountCode: '411100', debit: 100000, credit: 0, label: 'Écriture non source' }],
    journalEntries: [{ accountCode: '411100', debit: 200000, credit: 0 }],
    accountFilter: '*', reportDate: '2026-01-01', sourceDate: '2025-12-31'
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 1);
  assert.equal(report.rows[0].accountCode, '401100');
  assert.equal(report.rows[0].currencyAmount, '');
});

console.log('Journal des reports : tests de restitution terminés.');
