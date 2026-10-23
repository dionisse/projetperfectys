/* Vérifie la Balance d’ouverture des tiers depuis le registre dédié et les liens explicites. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-opening-balance-report.js');

const accounts = [
  { code: '411100', label: 'Clients Alpha', cls: 4, postable: true, aux: true },
  { code: '411200', label: 'Clients Beta', cls: 4, postable: true, aux: true },
  { code: '401100', label: 'Fournisseurs', cls: 4, postable: true, aux: true },
  { code: '512000', label: 'Banque', cls: 5, postable: true, aux: false }
];

const clients = [
  { id: 'client-1', code: 'CLI-001', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-001' },
  { id: 'client-2', code: 'CLI-002', name: 'Client Beta', accountCode: '411200', auxiliaryAccountCode: '411200-CLI-002' }
];

const openingBalances = [
  { id: 'RAN-1', date: '2025-12-31', accountCode: '411100', debit: 100, credit: 0, thirdPartyId: 'client-1' },
  { id: 'RAN-2', date: '2025-12-31', accountCode: '411200', debit: 0, credit: 50, thirdPartyCode: 'CLI-002' },
  { id: 'RAN-FREE-TEXT', date: '2025-12-31', accountCode: '411100', debit: 999, credit: 0, thirdParty: 'CLI-001 · Client Alpha' },
  { id: 'RAN-WRONG-ACCOUNT', date: '2025-12-31', accountCode: '411100', debit: 0, credit: 7, thirdPartyId: 'client-2' },
  { id: 'RAN-BAD-DATE', date: '2025-12-30', accountCode: '411100', debit: 10, credit: 0, thirdPartyId: 'client-1' },
  { id: 'RAN-BAD-AMOUNT', date: '2025-12-31', accountCode: '411100', debit: 1.5, credit: 0, thirdPartyId: 'client-1' },
  { id: 'RAN-OTHER-ACCOUNT', date: '2025-12-31', accountCode: '512000', debit: 8, credit: 0, thirdPartyId: 'client-1' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: clients,
    accounts,
    openingBalances,
    cycleStart: '2026-01-01',
    sourceDate: '2025-12-31',
    thirdPartyFilter: '*'
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

console.log('Balance d’ouverture des tiers · registre, liaison, nature et filtre');

test('présente les quatre colonnes de la capture avec toutes les cases cochées par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du tiers', 'Intitulé du tiers', 'Débit', 'Crédit'
  ]);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.defaultSelected), [true, true, true, true]);
  assert.deepEqual(Report.NATURES.map(nature => nature.key), ['suppliers', 'clients', 'personnel', 'debtors', 'creditors']);
});

test('restitue les lignes du registre uniquement lorsqu’elles sont explicitement liées à une fiche', () => {
  const snapshot = JSON.stringify({ accounts, clients, openingBalances });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Clients');
  assert.equal(report.reportDate, '2026-01-01');
  assert.equal(report.sourceDate, '2025-12-31');
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.thirdPartyTitle, row.debit, row.credit, row.lineCount]), [
    ['CLI-001', 'Client Alpha', 100, 0, 1],
    ['CLI-002', 'Client Beta', 0, 50, 1]
  ]);
  assert.equal(report.tierCount, 2);
  assert.equal(report.linkedLineCount, 2);
  assert.deepEqual(report.totals, { debit: 100, credit: 50 });
  assert.equal(report.unattributedOpeningBalanceCount, 1);
  assert.equal(report.invalidLineCount, 2);
  assert.ok(report.warnings.some(message => /libre.*pas interprété|libellé.*pas interprété/i.test(message)));
  assert.ok(report.warnings.some(message => /compte collectif différent/i.test(message)));
  assert.equal(report.basis.source, 'opening-balance-registry');
  assert.equal(report.basis.amountsInXof, true);
  assert.equal(report.basis.foreignCurrencyAmountsAvailable, false);
  assert.equal(report.basis.explicitThirdPartyReferenceRequired, true);
  assert.equal(report.basis.unlinkedOpeningBalancesExcluded, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ accounts, clients, openingBalances }), snapshot);
});

test('ne transforme pas le champ libre du registre en liaison ou en code de tiers', () => {
  const report = build({
    openingBalances: [{ id: 'RAN-TEXTE', date: '2025-12-31', accountCode: '411100', debit: 999, credit: 0, thirdParty: 'CLI-001 · Client Alpha' }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 0);
  assert.equal(report.linkedLineCount, 0);
  assert.equal(report.unattributedOpeningBalanceCount, 1);
  assert.ok(report.warnings.some(message => /libellés libres/i.test(message)));
});

test('filtre un tiers sans attribuer la ligne d’une autre fiche partageant les comptes collectifs', () => {
  const report = build({ thirdPartyFilter: 'CLI-002' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.debit, row.credit]), [['CLI-002', 0, 50]]);
  assert.equal(report.linkedLineCount, 1);
});

test('refuse les codes de tiers absents, ambigus ou vides', () => {
  assert.equal(build({ thirdPartyFilter: 'CLI-404' }).ok, false);
  assert.equal(build({ thirdPartyFilter: '' }).ok, false);
  const duplicate = Object.assign({}, clients[1], { code: 'CLI-001' });
  const ambiguous = build({ thirdPartyRecords: [clients[0], duplicate], thirdPartyFilter: 'CLI-001' });
  assert.equal(ambiguous.ok, false);
  assert.ok(ambiguous.errors.some(message => /ambiguë/i.test(message)));
});

test('ne reprend pas les comptes non auxiliaires ni les lignes hors date d’ouverture', () => {
  const report = build({
    thirdPartyRecords: [clients[0]],
    openingBalances: [
      { id: 'RAN-OTHER', date: '2025-12-31', accountCode: '512000', debit: 300, credit: 0, thirdPartyId: 'client-1' },
      { id: 'RAN-OLD', date: '2025-12-30', accountCode: '411100', debit: 10, credit: 0, thirdPartyId: 'client-1' }
    ]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows, []);
  assert.equal(report.invalidLineCount, 1);
});

test('refuse une date source différente de la veille du cycle sans produire de montants partiels', () => {
  const report = build({ sourceDate: '2025-12-30' });
  assert.equal(report.ok, false);
  assert.equal(report.rows.length, 0);
  assert.ok(report.errors.some(message => /veille du début du cycle/i.test(message)));
});

console.log('Balance d’ouverture des tiers : tests de calcul terminés.');
