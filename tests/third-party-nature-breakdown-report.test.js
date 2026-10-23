/* Vérifie la décomposition des soldes des tiers par rubriques paramétrées. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-nature-breakdown-report.js');

const clients = [
  { id: 'client-invoice', code: 'CLI-INV', name: 'Client facture', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-INV' },
  { id: 'client-advance', code: 'CLI-ADV', name: 'Client avance', accountCode: '419100', auxiliaryAccountCode: '419100-CLI-ADV' },
  { id: 'client-retention', code: 'CLI-RET', name: 'Client retenue', accountCode: '411700', auxiliaryAccountCode: '411700-CLI-RET' },
  { id: 'client-provision', code: 'CLI-PROV', name: 'Client provision', accountCode: '416100', auxiliaryAccountCode: '416100-CLI-PROV' }
];

const movements = [
  { date: '2026-02-01', account: '411100', auxiliaryCode: 'CLI-INV', debit: 130, credit: 0, sourceEntryId: 'E-1', lineNumber: 1 },
  { date: '2026-03-01', account: '411100', auxiliaryCode: '411100-CLI-INV', debit: 0, credit: 40, sourceEntryId: 'E-2', lineNumber: 1 },
  { date: '2026-12-31', account: '411100', auxiliaryCode: 'CLI-INV', debit: 900, credit: 0, sourceEntryId: 'E-FUTURE', lineNumber: 1 },
  { date: '2026-02-10', account: '419100', auxiliaryCode: 'CLI-ADV', debit: 10, credit: 0, sourceEntryId: 'E-3', lineNumber: 1 },
  { date: '2026-02-10', account: '419100', auxiliaryCode: 'CLI-ADV', debit: 0, credit: 80, sourceEntryId: 'E-3', lineNumber: 2 },
  { date: '2026-03-10', account: '411700', auxiliaryCode: 'CLI-RET', debit: 60, credit: 0, sourceEntryId: 'E-4', lineNumber: 1 },
  { date: '2026-03-10', account: '411700', auxiliaryCode: 'CLI-RET', debit: 0, credit: 10, sourceEntryId: 'E-4', lineNumber: 2 },
  { date: '2026-04-10', account: '416100', auxiliaryCode: 'CLI-PROV', debit: 90, credit: 0, sourceEntryId: 'E-5', lineNumber: 1 },
  { date: '2026-04-10', account: '416100', auxiliaryCode: 'CLI-PROV', debit: 0, credit: 20, sourceEntryId: 'E-5', lineNumber: 2 },
  { date: '2026-05-01', account: '411100', auxiliaryCode: 'CLI-INCONNU', debit: 700, credit: 0, sourceEntryId: 'E-6', lineNumber: 1 }
];

const openingBalances = [
  { id: 'RAN-LINKED', date: '2025-12-31', accountCode: '411100', debit: 500, credit: 0, thirdPartyId: 'client-invoice' },
  { id: 'RAN-FREE-TEXT', date: '2025-12-31', accountCode: '411100', debit: 999, credit: 0, thirdParty: 'CLI-INV · Client facture' }
];

const accountNatureRows = [
  { id: 'customer-receivables', accounts: '411 -4117 485 486 488' },
  { id: 'customer-advances', accounts: '4191 4192' },
  { id: 'customer-rebates', accounts: '4198' },
  { id: 'customer-guarantee-retentions', accounts: '4117' },
  { id: 'customer-provisioned-claims', accounts: '416' },
  { id: 'supplier-debts', accounts: '401 -4017 408 481 482 483 484' },
  { id: 'supplier-advances', accounts: '4091 4092 4093' },
  { id: 'supplier-rebates', accounts: '' },
  { id: 'supplier-guarantee-retentions', accounts: '4017' },
  { id: 'supplier-provisioned-claims', accounts: '' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: clients,
    thirdPartyMovements: movements,
    openingBalances,
    accountNatureRows,
    cycleStart: '2026-01-01',
    cycleEnd: '2026-12-31',
    asOfDate: '2026-06-30',
    thirdPartyFilter: '*',
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

console.log('Décomposition des soldes des tiers · calcul par rubriques');

test('reprend les colonnes de la capture et les coche par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du tiers', 'Intitulé du tiers', 'Avances et Avoirs', 'Factures non réglées',
    'Retenues de garantie', 'Créances provisionnées', 'Solde'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
  assert.deepEqual(Report.NATURES.map(nature => nature.key), ['clients', 'suppliers']);
});

test('classe les soldes d’ouverture et les mouvements à date selon les comptes configurés', () => {
  const snapshot = JSON.stringify({ clients, movements, openingBalances, accountNatureRows });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.asOfDate, '2026-06-30');
  assert.deepEqual(report.rows.map(row => [
    row.thirdPartyCode, row.advancesAndCredits, row.unpaidInvoices,
    row.guaranteeRetentions, row.provisionedClaims, row.balance
  ]), [
    ['CLI-INV', 0, 590, 0, 0, 590],
    ['CLI-RET', 0, 0, 50, 0, 50],
    ['CLI-PROV', 0, 0, 0, 70, 70],
    ['CLI-ADV', -70, 0, 0, 0, -70]
  ]);
  assert.equal(report.tierCount, 4);
  assert.equal(report.sourceMovementCount, 8);
  assert.equal(report.periodMovementCount, 8);
  assert.equal(report.openingReportLineCount, 1);
  assert.equal(report.totals.balance, 640);
  assert.equal(report.totals.advancesAndCredits, -70);
  assert.ok(report.warnings.some(message => /libellés libres/i.test(message)));
  assert.ok(report.warnings.some(message => /référence auxiliaire/i.test(message)));
  assert.equal(report.basis.cutoffDateInclusive, true);
  assert.equal(report.basis.openingReportsRequireExplicitThirdPartyReference, true);
  assert.equal(report.basis.accountCategoriesFromDossierConfiguration, true);
  assert.equal(report.basis.categoryBalancesAreDebitLessCredit, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ clients, movements, openingBalances, accountNatureRows }), snapshot);
});

test('filtre un tiers et conserve une cellule vide lorsqu’aucun compte de rubrique n’est configuré', () => {
  const report = build({
    thirdPartyFilter: 'CLI-ADV',
    accountNatureRows: accountNatureRows.map(row => row.id === 'customer-provisioned-claims' ? Object.assign({}, row, { accounts: '' }) : row)
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.advancesAndCredits, row.provisionedClaims, row.balance]), [
    ['CLI-ADV', -70, null, -70]
  ]);
  assert.equal(report.totals.provisionedClaims, null);
  assert.ok(report.warnings.some(message => /Créances provisionnées.*reste vide/i.test(message)));
});

test('respecte les exclusions de comptes préfixes dans les rubriques', () => {
  const parsed = Report.parseAccountExpression('401 -4017 408');
  assert.equal(parsed.valid, true);
  assert.equal(Report.accountMatches('401100', parsed), true);
  assert.equal(Report.accountMatches('401700', parsed), false);
  assert.equal(Report.accountMatches('408100', parsed), true);
  assert.equal(Report.accountMatches('409100', parsed), false);
});

test('calcule le compte fournisseur avec ses signes comptables réels et signale les rubriques sans paramétrage', () => {
  const suppliers = [
    { id: 'supplier-invoice', code: 'FOU-INV', name: 'Fournisseur facture', accountCode: '401100', auxiliaryAccountCode: '401100-FOU-INV' },
    { id: 'supplier-advance', code: 'FOU-ADV', name: 'Fournisseur avance', accountCode: '409100', auxiliaryAccountCode: '409100-FOU-ADV' },
    { id: 'supplier-retention', code: 'FOU-RET', name: 'Fournisseur retenue', accountCode: '401700', auxiliaryAccountCode: '401700-FOU-RET' }
  ];
  const report = build({
    nature: 'suppliers',
    thirdPartyRecords: suppliers,
    thirdPartyMovements: [
      { date: '2026-02-01', account: '401100', auxiliaryCode: 'FOU-INV', debit: 0, credit: 300, sourceEntryId: 'S-1', lineNumber: 1 },
      { date: '2026-02-02', account: '409100', auxiliaryCode: 'FOU-ADV', debit: 50, credit: 0, sourceEntryId: 'S-2', lineNumber: 1 },
      { date: '2026-02-03', account: '401700', auxiliaryCode: 'FOU-RET', debit: 0, credit: 100, sourceEntryId: 'S-3', lineNumber: 1 }
    ],
    openingBalances: [],
    thirdPartyFilter: '*'
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.advancesAndCredits, row.unpaidInvoices, row.guaranteeRetentions, row.balance]), [
    ['FOU-INV', 0, -300, 0, -300],
    ['FOU-RET', 0, 0, -100, -100],
    ['FOU-ADV', 50, 0, 0, 50]
  ]);
  assert.equal(report.totals.balance, -350);
  assert.ok(report.warnings.some(message => /Avances et Avoirs.*partielle/i.test(message)));
  assert.ok(report.warnings.some(message => /Créances provisionnées.*reste vide/i.test(message)));
});

test('bloque les dates hors cycle, les filtres inconnus, les références non valides et les règles comptables invalides', () => {
  assert.equal(build({ asOfDate: '2027-01-01' }).ok, false);
  assert.equal(build({ thirdPartyFilter: 'CLI-404' }).ok, false);
  assert.equal(build({ sourceErrors: ['Extraction auxiliaire invalide.'] }).ok, false);
  const badRules = build({ accountNatureRows: [{ id: 'customer-receivables', accounts: '411 !' }] });
  assert.equal(badRules.ok, false);
  assert.ok(badRules.errors.some(message => /filtre de compte/i.test(message)));
});

console.log('Décomposition des soldes des tiers : tests de calcul terminés.');
