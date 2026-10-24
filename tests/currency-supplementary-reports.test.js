/* États position, ouverture, Grand-Livre et écarts des comptes en devises : sources explicites uniquement. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/currency-supplementary-reports.js');

const currencyRecords = [
  { code: 'EUR', label: 'Euro', lastRate: '999.00' },
  { code: 'USD', label: 'Dollar des États-Unis', lastRate: '700.00' },
  { code: 'XOF', label: 'Franc CFA', lastRate: '1.000' }
];
const accounts = [
  { code: '930100', label: 'Compte analytique EUR', postable: true },
  { code: '940200', label: 'Compte analytique USD', postable: true },
  { code: '995000', label: 'Compte analytique divers', postable: true },
  { code: '401000', label: 'Fournisseurs', postable: true }
];
const openingBalances = [
  { id: 'RAN-930100', accountCode: '930100', date: '2025-12-31', debit: 80, credit: 0 },
  { id: 'RAN-940200', accountCode: '940200', date: '2025-12-31', debit: 0, credit: 50 },
  { id: 'RAN-401000', accountCode: '401000', date: '2025-12-31', debit: 500, credit: 0 }
];
const entries = [
  { id: 'START-XOF', date: '2026-01-01', journal: 'OD', reference: 'OD-001', status: 'posted', description: 'Ouverture de la période', lines: [
    { account: '930100', debit: 10, credit: 0, description: 'Mouvement XOF' },
    { account: '401000', debit: 0, credit: 10 }
  ] },
  { id: 'EUR-EXPLICIT', date: '2026-01-15', journal: 'ACH', reference: 'ACH-015', sourceReference: 'FOUR-15', status: 'posted', description: 'Facture en euros', lines: [
    { account: '930100', debit: 900, credit: 0, currencyCode: 'EUR', foreignDebit: '2.50', description: 'Achat EUR' },
    { account: '401000', debit: 0, credit: 900 }
  ] },
  { id: 'EUR-CREDIT', date: '2026-01-31', journal: 'BQ', reference: 'BQ-031', status: 'posted', lines: [
    { account: '930100', debit: 0, credit: 400, currencyCode: 'EUR', foreignCredit: '1.25', piece: 'PIECE-031', reference: 'REF-31' },
    { account: '401000', debit: 400, credit: 0 }
  ] },
  { id: 'EUR-MISSING-ORIGINAL', date: '2026-02-01', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 100, credit: 0, currencyCode: 'EUR', description: 'Montant étranger absent' },
    { account: '401000', debit: 0, credit: 100 }
  ] },
  { id: 'USD-EXPLICIT', date: '2026-02-01', journal: 'OD', status: 'posted', lines: [
    { account: '940200', debit: 700, credit: 0, currencyCode: 'USD', foreignDebit: 1 },
    { account: '401000', debit: 0, credit: 700 }
  ] },
  { id: 'AFTER-CYCLE', date: '2027-01-01', journal: 'OD', status: 'posted', lines: [
    { account: '930100', debit: 999, credit: 0, currencyCode: 'EUR', foreignDebit: 999 }
  ] },
  { id: 'DRAFT', date: '2026-01-20', journal: 'OD', status: 'draft', lines: [
    { account: '930100', debit: 5000, credit: 0, currencyCode: 'EUR', foreignDebit: 100 }
  ] },
  { id: 'OUT-OF-SCOPE', date: '2026-01-25', journal: 'OD', status: 'posted', lines: [
    { account: '401000', debit: 75, credit: 0 }
  ] }
];

function options(overrides = {}) {
  return Object.assign({
    accounts,
    entries,
    openingBalances,
    currencyRecords,
    baseCurrencyCode: 'XOF',
    decimalPlaces: 0,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    currencyFilter: '*',
    accountFilter: '*'
  }, overrides);
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

console.log('États complémentaires des comptes en devises · classes analytiques 93–99');

test('définit les quatre jeux de colonnes dans l’ordre de la capture, tous cochés par défaut', () => {
  assert.deepEqual(Reports.POSITION_COLUMNS.map(column => column.label), [
    'Code du Compte', 'Intitulé du Compte', 'Position en CFA', 'Position en devise'
  ]);
  assert.deepEqual(Reports.OPENING_COLUMNS.map(column => column.label), [
    'Compte', 'Intitulé', 'Position en CFA', 'Position en devise'
  ]);
  assert.deepEqual(Reports.LEDGER_COLUMNS.map(column => column.label), [
    'Date', 'Journal', 'Pièce', 'Référence', 'Montant en CFA', 'Montant en devise', 'Libellé', 'Contrepartie'
  ]);
  assert.deepEqual(Reports.EXCHANGE_COLUMNS.map(column => column.label), [
    'Code du Compte', 'Position en CFA', 'Contrevaleur en CFA', 'Intitulé du Compte', 'Position en devise', 'Écart de change'
  ]);
  for (const columns of [Reports.POSITION_COLUMNS, Reports.OPENING_COLUMNS, Reports.LEDGER_COLUMNS, Reports.EXCHANGE_COLUMNS]) {
    assert.ok(columns.every(column => column.defaultSelected));
  }
});

test('la balance d’ouverture reprend uniquement les reports XOF explicites des comptes 93–99', () => {
  const report = Reports.buildOpeningBalance(options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.openingDate, '2025-12-31');
  assert.deepEqual(report.rows.map(row => row.accountCode), ['930100', '940200']);
  assert.equal(report.rows[0].positionCfa, 80);
  assert.equal(report.rows[0].positionCurrency, 80);
  assert.equal(report.rows[1].positionCfa, -50);
  assert.equal(report.rows[1].positionCurrency, -50);
  assert.ok(report.warnings.some(message => /ne stocke que le montant XOF/i.test(message)));
  assert.equal(report.basis.foreignOpeningBalancesAvailable, false);
  assert.equal(report.basis.noExchangeRateApplied, true);
});

test('la balance d’ouverture ne rattache pas les reports XOF à une devise étrangère', () => {
  const report = Reports.buildOpeningBalance(options({ currencyFilter: 'EUR' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows, []);
  assert.equal(report.groups.length, 0);
  assert.ok(report.warnings.some(message => /aucun solde d’ouverture dans une devise étrangère/i.test(message)));
  const missing = Reports.buildOpeningBalance(options({ currencyFilter: 'XOF', openingBalances: [] }));
  assert.equal(missing.ok, true, missing.errors.join(' '));
  assert.deepEqual(missing.rows, []);
  assert.ok(missing.warnings.some(message => /aucun report d’ouverture XOF explicite/i.test(message)));
  assert.equal(Reports.buildOpeningBalance(options({ currencyFilter: 'XOF', openingBalances: [
    { accountCode: '930100', date: '2026-01-01', debit: 10, credit: 0 }
  ] })).ok, false, 'la date d’ouverture doit être la veille du cycle');
});

test('la position XOF additionne report et lignes validées incluses jusqu’à la date choisie', () => {
  const sourceBefore = JSON.stringify({ entries, openingBalances });
  const report = Reports.buildPosition(options({ asOfDate: '2026-01-31', currencyFilter: 'XOF' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.accountCode), ['930100', '940200']);
  assert.equal(report.rows[0].positionCfa, 90);
  assert.equal(report.rows[0].positionCurrency, 90);
  assert.equal(report.rows[0].positionCfaKnown, true);
  assert.equal(report.rows[1].positionCfa, -50);
  assert.equal(report.rows[1].lineCount, 0);
  assert.equal(report.asOfDate, '2026-01-31');
  assert.equal(report.basis.dateInclusive, true);
  assert.equal(JSON.stringify({ entries, openingBalances }), sourceBefore, 'les sources ne sont pas modifiées');
});

test('la position étrangère n’est pas déduite des mouvements XOF ou du dernier cours configuré', () => {
  const report = Reports.buildPosition(options({ asOfDate: '2026-01-31', currencyFilter: 'EUR' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].accountCode, '930100');
  assert.equal(report.rows[0].positionCfa, null);
  assert.equal(report.rows[0].positionCurrency, null);
  assert.equal(report.rows[0].positionCfaKnown, false);
  assert.ok(report.warnings.some(message => /aucune position complète en CFA ou en devise étrangère/i.test(message)));
  assert.equal(report.rows.some(row => row.positionCurrency === 2.5), false);
});

test('la position filtre par rubrique analytique et refuse une date hors du cycle', () => {
  const selected = Reports.buildPosition(options({ asOfDate: '2026-02-01', currencyFilter: 'XOF', accountFilter: '93' }));
  assert.equal(selected.ok, true, selected.errors.join(' '));
  assert.deepEqual(selected.rows.map(row => row.accountCode), ['930100']);
  assert.equal(Reports.buildPosition(options({ asOfDate: '2027-01-01' })).ok, false);
  assert.equal(Reports.buildPosition(options({ asOfDate: '2026-02-30' })).ok, false);
});

test('le Grand-Livre restitue écritures validées, sens débit/crédit, montant source et contreparties', () => {
  const report = Reports.buildLedger(options({ from: '2026-01-01', to: '2026-01-31' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 3);
  const xof = report.rows.find(row => row.currencyCode === 'XOF');
  const euroDebit = report.rows.find(row => row.date === '2026-01-15');
  const euroCredit = report.rows.find(row => row.date === '2026-01-31');
  assert.equal(xof.amountCfa, 10);
  assert.equal(xof.amountCurrency, 10);
  assert.equal(euroDebit.amountCfa, 900);
  assert.equal(euroDebit.amountCurrency, 2.5);
  assert.equal(euroDebit.journal, 'ACH');
  assert.equal(euroDebit.piece, 'ACH-015');
  assert.equal(euroDebit.reference, 'FOUR-15');
  assert.equal(euroDebit.label, 'Achat EUR');
  assert.equal(euroDebit.counterpart, '401000 — Fournisseurs');
  assert.equal(euroCredit.amountCfa, -400);
  assert.equal(euroCredit.amountCurrency, -1.25);
  assert.equal(euroCredit.piece, 'PIECE-031');
  assert.equal(euroCredit.reference, 'REF-31');
  assert.equal(report.generatedLineCount, 3);
  assert.equal(report.basis.postedEntriesOnly, true);
  assert.equal(report.basis.debitIsPositiveCreditIsNegative, true);
});

test('le Grand-Livre laisse le montant d’origine vide s’il manque, sans le convertir', () => {
  const report = Reports.buildLedger(options({ from: '2026-02-01', to: '2026-02-01', currencyFilter: 'EUR' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].amountCfa, 100);
  assert.equal(report.rows[0].amountCurrency, null);
  assert.equal(report.rows[0].foreignAmountKnown, false);
  assert.equal(report.missingOriginalAmountLineCount, 1);
  assert.ok(report.warnings.some(message => /Montant en devise.{0,5}reste vide/i.test(message)));
  assert.equal(Reports.buildLedger(options({ from: '2025-12-31', to: '2026-02-01' })).ok, false);
});

test('les écarts de change n’utilisent pas lastRate et laissent la contrevaleur étrangère vide', () => {
  const report = Reports.buildExchangeDifferences(options({ asOfDate: '2026-01-31' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.accountCode), ['930100', '930100', '940200']);
  const euro = report.rows.find(row => row.currencyCode === 'EUR');
  const xof = report.rows.find(row => row.currencyCode === 'XOF');
  assert.equal(euro.positionCfa, null);
  assert.equal(euro.countervalueCfa, null);
  assert.equal(euro.positionCurrency, null);
  assert.equal(euro.exchangeDifference, null);
  assert.equal(xof.positionCfa, 90);
  assert.equal(xof.countervalueCfa, 90);
  assert.equal(xof.positionCurrency, 90);
  assert.equal(xof.exchangeDifference, 0);
  assert.equal(report.rateHistoryAvailable, false);
  assert.equal(report.basis.lastConfiguredRateIgnored, true);
  assert.equal(report.basis.noExchangeDifferenceSimulated, true);
  assert.ok(report.warnings.some(message => /aucun historique de taux/i.test(message)));
});

test('les écarts de change couvrent tous les comptes 93–99 sans filtre Compte', () => {
  const report = Reports.buildExchangeDifferences(options({ asOfDate: '2026-02-01', currencyFilter: 'USD' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.accountCode), ['940200']);
  assert.equal(report.rows[0].positionCfa, null);
  assert.equal(report.rows[0].exchangeDifference, null);
  const withoutAccountFilter = Reports.buildExchangeDifferences(options({ asOfDate: '2026-02-01', currencyFilter: '*', accountFilter: '401000' }));
  assert.equal(withoutAccountFilter.ok, true, withoutAccountFilter.errors.join(' '));
  assert.ok(withoutAccountFilter.rows.length > 0);
  assert.ok(withoutAccountFilter.rows.every(row => /^9[3-9]/.test(row.accountCode)), 'toutes les classes 93–99 restent incluses sans filtre Compte');
});

test('valide les sources et le périmètre sans sortir des classes 93 à 99', () => {
  assert.equal(Reports.buildOpeningBalance(options({ currencyFilter: 'GBP' })).ok, false);
  assert.equal(Reports.buildPosition(options({ asOfDate: '2026-03-01', accountFilter: '401000' })).ok, false);
  assert.equal(Reports.buildLedger(options({ from: '2026-01-01', to: '2026-02-01', accountFilter: '401000' })).ok, false);
  const ledger = Reports.buildLedger(options({ from: '2026-01-01', to: '2026-02-01', currencyFilter: 'EUR', accountFilter: '93' }));
  assert.equal(ledger.ok, true, ledger.errors.join(' '));
  assert.ok(ledger.rows.every(row => row.accountCode.startsWith('93')));
  assert.equal(Reports.buildPosition(options({ asOfDate: '2026-02-01', sourceErrors: ['Source manquante'] })).ok, false);
});

console.log('États complémentaires des comptes en devises : filtres, périodes, sources, taux absents et valeurs explicites vérifiés.');
