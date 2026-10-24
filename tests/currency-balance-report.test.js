/* Vérifie la Balance des comptes en devises sans conversion ni solde d’ouverture supposé. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/currency-balance-report.js');

const currencyRecords = [
  { code: 'EUR', label: 'Euro', lastRate: '999.00' },
  { code: 'USD', label: 'Dollar des États-Unis', lastRate: '700.00' },
  { code: 'XOF', label: 'Franc CFA', lastRate: '1.000' }
];
const accounts = [
  { code: '930100', label: 'Centre de reclassement', postable: true },
  { code: '940200', label: 'Centre de coûts', postable: true },
  { code: '401000', label: 'Fournisseurs', postable: true }
];
const openingBalances = [
  { id: 'RAN-930100', accountCode: '930100', date: '2024-12-31', debit: 80, credit: 0 }
];
const entries = [
  { id: 'BEFORE', date: '2025-01-15', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 0, credit: 10 },
    { account: '401000', debit: 0, credit: 10 }
  ] },
  { id: 'PERIOD-START', date: '2025-02-01', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 20, credit: 0 },
    { account: '940200', debit: 0, credit: 25 }
  ] },
  { id: 'PERIOD-END', date: '2025-02-28', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 0, credit: 5 },
    { account: '930100', debit: 500, credit: 0, currencyCode: 'EUR', foreignDebit: '6,50' },
    { account: '940200', debit: 700, credit: 0, currencyCode: 'USD', foreignDebit: '1.25' }
  ] },
  { id: 'AFTER', date: '2025-03-01', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 0, credit: 100 }
  ] },
  { id: 'DRAFT', date: '2025-02-10', journal: 'OD', status: 'draft', lines: [
    { account: '930100', debit: 999, credit: 0 }
  ] }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    accounts,
    entries,
    openingBalances,
    currencyRecords,
    baseCurrencyCode: 'XOF',
    decimalPlaces: 0,
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-02-01',
    to: '2025-02-28',
    currencyFilter: '*',
    accountFilter: '*'
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

console.log('Balance des comptes en devises · classes analytiques 93–99');

test('expose les rubriques 93 à 99 et coche les cinq colonnes de la capture par défaut', () => {
  assert.deepEqual(Report.ANALYTIC_ACCOUNT_ROOTS.map(row => row.code), ['93', '94', '95', '96', '97', '98', '99']);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du Compte',
    'Intitulé du Compte',
    'Solde en Début de Période',
    'Mouvements de la Période',
    'Solde en Fin de Période'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
  const options = Report.accountOptions(accounts, entries);
  assert.ok(options.some(row => row.code === '93' && row.root));
  assert.ok(options.some(row => row.code === '930100' && row.label === 'Centre de reclassement'));
});

test('calcule l’XOF depuis le report explicite et les écritures antérieures, dates incluses', () => {
  const before = JSON.stringify({ openingBalances, entries });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  const row = report.groups.find(group => group.currencyCode === 'XOF').rows.find(item => item.accountCode === '930100');
  assert.ok(row);
  assert.equal(row.accountLabel, 'Centre de reclassement');
  assert.equal(row.openingBalance, 70, '80 XOF au report moins 10 XOF antérieurs');
  assert.equal(row.movements, 15, '20 XOF au débit le premier jour moins 5 XOF au crédit le dernier jour');
  assert.equal(row.closingBalance, 85);
  assert.equal(row.openingBalanceKnown, true);
  assert.equal(row.periodLineCount, 2);
  assert.equal(report.generatedLineCount, report.rows.length);
  assert.equal(report.basis.datesInclusive, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ openingBalances, entries }), before, 'les sources restent intactes');
});

test('garde les mouvements en devise d’origine et laisse début/fin vides sans report étranger', () => {
  const report = build();
  const euro = report.groups.find(group => group.currencyCode === 'EUR').rows[0];
  const dollar = report.groups.find(group => group.currencyCode === 'USD').rows[0];
  assert.equal(euro.accountCode, '930100');
  assert.equal(euro.movements, 6.5);
  assert.equal(euro.openingBalance, null);
  assert.equal(euro.closingBalance, null);
  assert.equal(euro.openingBalanceKnown, false);
  assert.equal(dollar.accountCode, '940200');
  assert.equal(dollar.movements, 1.25);
  assert.equal(dollar.openingBalance, null);
  assert.equal(dollar.closingBalance, null);
  assert.equal(report.warnings.some(warning => /aucun taux de change/i.test(warning)), true);
  assert.equal(report.rows.some(row => row.openingBalance === 6.5 || row.closingBalance === 6.5), false);
  assert.equal(report.basis.noExchangeRateApplied, true);
});

test('n’applique jamais le dernier cours configuré pour convertir un mouvement', () => {
  const report = build({ currencyFilter: 'EUR' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].movements, 6.5);
  assert.equal(report.rows[0].currencyCode, 'EUR');
});

test('limite les comptes au filtre analytique choisi et exclut les autres classes', () => {
  const report = build({ currencyFilter: 'XOF', accountFilter: '93' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.accountCode), ['930100']);
  const filtered = build({ currencyFilter: 'XOF', accountFilter: '940200' });
  assert.equal(filtered.ok, true, filtered.errors.join(' '));
  assert.deepEqual(filtered.rows.map(row => row.accountCode), ['940200']);
  assert.equal(Report.isAnalyticAccountCode('920100'), false);
  assert.equal(Report.isAnalyticAccountCode('401000'), false);
  assert.equal(Report.parseAccountFilter('93*', Report.accountOptions(accounts, entries)).valid, true);
});

test('la devise étrangère lue dans les métadonnées source FEC accepte un montant explicite unique', () => {
  const report = build({
    currencyFilter: 'EUR',
    entries: [{
      id: 'FEC', date: '2025-02-14', status: 'posted',
      lines: [{ account: '930100', debit: 2500, credit: 0 }],
      sourceMetadata: { lines: [{ currencyCode: 'EUR', foreignAmount: '12.3456' }] }
    }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].movements, 12.3456);
});

test('ne suppose pas un report XOF nul quand la source d’ouverture manque', () => {
  const report = build({
    currencyFilter: 'XOF',
    openingBalances: [],
    entries: [{ id: 'PERIOD', date: '2025-02-05', status: 'posted', lines: [
      { account: '930100', debit: 25, credit: 0 }
    ] }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows[0].openingBalance, null);
  assert.equal(report.rows[0].closingBalance, null);
  assert.equal(report.rows[0].movements, 25);
  assert.ok(report.warnings.some(warning => /sans supposer un solde nul/i.test(warning)));
});

test('ignore un montant d’ouverture étranger non modélisé, sans le convertir ni le lire', () => {
  const report = build({
    currencyFilter: 'EUR',
    openingBalances: [{ accountCode: '930100', date: '2024-12-31', debit: 80, credit: 0, currencyCode: 'EUR', foreignDebit: 500 }],
    entries: [{ id: 'EUR', date: '2025-02-10', status: 'posted', lines: [
      { account: '930100', debit: 700, credit: 0, currencyCode: 'EUR', foreignDebit: 2 }
    ] }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows[0].openingBalance, null);
  assert.equal(report.rows[0].movements, 2);
  assert.equal(report.rows[0].closingBalance, null);
});

test('refuse une ligne étrangère sans montant original plutôt que de publier un résultat partiel', () => {
  const report = build({
    currencyFilter: '*',
    entries: [{ id: 'BAD', date: '2025-02-10', status: 'posted', lines: [
      { account: '930100', debit: 700, credit: 0, currencyCode: 'EUR' },
      { account: '930100', debit: 20, credit: 0, currencyCode: 'XOF' }
    ] }]
  });
  assert.equal(report.ok, false);
  assert.deepEqual(report.rows, []);
  assert.equal(report.generatedLineCount, 0);
  assert.ok(report.errors.some(error => /montant d’origine explicite/i.test(error)));
  assert.equal(report.basis.noPartialValuesOnInvalidSources, true);
});

test('refuse les codes de devise contradictoires et les montants étrangers ambigus', () => {
  const conflict = build({
    entries: [{ id: 'CONFLICT', date: '2025-02-10', status: 'posted', currencyCode: 'EUR', lines: [
      { account: '930100', debit: 10, credit: 0, currencyCode: 'USD', foreignDebit: 1 }
    ] }]
  });
  assert.equal(conflict.ok, false);
  assert.deepEqual(conflict.rows, []);
  const duplicateAmounts = build({
    entries: [{ id: 'DUPLICATE', date: '2025-02-10', status: 'posted', lines: [
      { account: '930100', debit: 10, credit: 0, currencyCode: 'EUR', foreignAmount: 1, foreignDebit: 2 }
    ] }]
  });
  assert.equal(duplicateAmounts.ok, false);
  assert.deepEqual(duplicateAmounts.rows, []);
});

test('signale les devises non configurées au lieu de les convertir ou de les agréger sous XOF', () => {
  const report = build({
    openingBalances: [],
    entries: [{ id: 'JPY', date: '2025-02-10', status: 'posted', lines: [
      { account: '930100', debit: 10, credit: 0, currencyCode: 'JPY', foreignDebit: 1 }
    ] }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows, []);
  assert.equal(report.omittedUnconfiguredCurrencyLineCount, 1);
  assert.ok(report.warnings.some(warning => /absente du référentiel/i.test(warning)));
});

test('valide les dates, les devises et le périmètre des comptes', () => {
  assert.equal(build({ from: '2025-03-01', to: '2025-02-01' }).ok, false);
  assert.equal(build({ from: '2024-12-31' }).ok, false);
  assert.equal(build({ currencyFilter: 'GBP' }).ok, false);
  assert.equal(build({ accountFilter: '401000' }).ok, false);
  assert.equal(build({ accountFilter: '930999' }).ok, false, 'un code absent des options ne devient pas un compte mouvementé');
});

console.log('Balance des comptes en devises : montants d’origine, reports, périodes et absence de conversion vérifiés.');
