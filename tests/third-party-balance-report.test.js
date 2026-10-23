/* Vérifie la Balance des tiers depuis les seules sources auxiliaires explicites. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-balance-report.js');

const clients = [
  { id: 'client-1', code: 'CLI-001', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-001' },
  { id: 'client-2', code: 'CLI-002', name: 'Client Beta', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-002' }
];

const movements = [
  { date: '2025-01-15', journal: 'VTE', account: '411100', auxiliaryCode: 'CLI-001', debit: 100, credit: 0, sourceEntryId: 'E-1', lineNumber: 1 },
  { date: '2025-02-05', journal: 'BQ', account: '411100', auxiliaryCode: '411100-CLI-001', debit: 0, credit: 30, sourceEntryId: 'E-2', lineNumber: 1 },
  { date: '2025-02-20', journal: 'OD', account: '411100', auxiliaryCode: 'client-1', debit: 10, credit: 0, sourceEntryId: 'E-3', lineNumber: 2 },
  { date: '2025-04-05', journal: 'BQ', account: '411100', auxiliaryCode: 'CLI-001', debit: 0, credit: 50, sourceEntryId: 'E-4', lineNumber: 1 },
  { date: '2025-02-10', journal: 'VTE', account: '411100', auxiliaryCode: 'CLI-002', debit: 0, credit: 7, sourceEntryId: 'E-5', lineNumber: 1 },
  { date: '2025-02-11', journal: 'VTE', account: '411100', auxiliaryCode: 'CLI-INCONNU', debit: 900, credit: 0, sourceEntryId: 'E-6', lineNumber: 1 }
];

const openingBalances = [
  { id: 'RAN-1', accountCode: '411100', date: '2024-12-31', debit: 40, credit: 0, thirdPartyId: 'client-1' },
  { id: 'RAN-2', accountCode: '411100', date: '2024-12-31', debit: 0, credit: 12, thirdPartyCode: 'CLI-002' },
  { id: 'RAN-FREE-TEXT', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdParty: 'Client Alpha' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: clients,
    thirdPartyMovements: movements,
    openingBalances,
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-02-01',
    to: '2025-03-31',
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

console.log('Balance des tiers · sélection, reports explicites, cumuls et mouvements');

test('reprend les colonnes et les valeurs par défaut de la capture', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Code du Tiers', 'Intitulé du Tiers', 'Report en Début d’Exercice', 'Cumul en Début de Période',
    'Solde en Début de Période', 'Mouvements de la Période', 'Solde de la Période',
    'Cumul en Fin de Période', 'Solde en Fin de Période'
  ]);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.defaultSelected), [true, true, false, false, true, true, false, false, true]);
  assert.deepEqual(Report.NATURES.map(nature => nature.key), ['suppliers', 'clients', 'personnel', 'debtors', 'creditors']);
});

test('calcule les reports, cumuls et mouvements depuis les sources liées sans modifier les données', () => {
  const snapshot = JSON.stringify({ movements, openingBalances });
  const report = build({ thirdPartyFilter: 'CLI-001' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Clients');
  assert.equal(report.tierCount, 1);
  assert.equal(report.sourceMovementCount, 3);
  assert.equal(report.periodMovementCount, 2);
  assert.equal(report.openingReportLineCount, 1);
  const row = report.rows[0];
  assert.deepEqual([
    row.thirdPartyCode, row.thirdPartyTitle, row.openingReportKnown, row.openingReportDebit, row.openingReportCredit,
    row.cumulativeStartDebit, row.cumulativeStartCredit, row.openingBalanceDebit, row.openingBalanceCredit,
    row.movementDebit, row.movementCredit, row.movementBalanceDebit, row.movementBalanceCredit,
    row.cumulativeEndDebit, row.cumulativeEndCredit, row.closingBalanceDebit, row.closingBalanceCredit
  ], ['CLI-001', 'Client Alpha', true, 40, 0, 140, 0, 140, 0, 10, 30, 0, 20, 150, 30, 120, 0]);
  assert.equal(report.unattributedOpeningBalanceCount, 1);
  assert.ok(report.warnings.some(message => /libellés libres/i.test(message)));
  assert.ok(report.warnings.some(message => /identifiant de tiers explicite/i.test(message)));
  assert.equal(report.basis.openingReportsRequireExplicitThirdPartyReference, true);
  assert.equal(report.basis.unattributedCollectiveLinesExcluded, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ movements, openingBalances }), snapshot);
});

test('ne transforme pas le libellé libre du registre d’ouverture en référence tiers', () => {
  const report = build({
    thirdPartyFilter: 'CLI-001',
    from: '2025-01-01',
    to: '2025-01-31',
    openingBalances: [{ id: 'RAN-TEXTE', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdParty: 'CLI-001 · Client Alpha' }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.openingReportLineCount, 0);
  assert.equal(report.rows[0].openingReportKnown, false);
  assert.equal(report.rows[0].openingReportDebit, null);
  assert.equal(report.rows[0].cumulativeStartDebit, 0);
  assert.equal(report.rows[0].movementDebit, 100);
  assert.ok(report.warnings.some(message => /Aucun report en début d’exercice/i.test(message)));
  assert.ok(report.warnings.some(message => /libellés libres du registre ne sont jamais interprétés/i.test(message)));
  assert.equal(report.rows[0].closingBalanceDebit, 100);
});

test('filtre une nature, une période et les comptes collectifs de la fiche sans attribuer les autres tiers', () => {
  const report = build({ thirdPartyFilter: 'CLI-002', from: '2025-02-01', to: '2025-02-28' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.thirdPartyCode, row.movementDebit, row.movementCredit, row.closingBalanceDebit, row.closingBalanceCredit]), [
    ['CLI-002', 0, 7, 0, 19]
  ]);
  assert.equal(report.sourceMovementCount, 1);
});

test('ne compte pas deux fois la même ligne auxiliaire source', () => {
  const repeatedLine = Object.assign({}, movements[1]);
  const report = build({
    thirdPartyFilter: 'CLI-001',
    thirdPartyMovements: [movements[1], repeatedLine],
    openingBalances: []
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.sourceMovementCount, 1);
  assert.equal(report.periodMovementCount, 1);
  assert.equal(report.rows[0].movementCredit, 30);
});

test('exclut les mouvements dont la référence auxiliaire est ambiguë', () => {
  const duplicateClients = [
    clients[0],
    Object.assign({}, clients[1], { auxiliaryAccountCode: clients[0].auxiliaryAccountCode })
  ];
  const report = build({
    thirdPartyRecords: duplicateClients,
    thirdPartyMovements: [Object.assign({}, movements[0], { auxiliaryCode: '411100-CLI-001' })],
    openingBalances: [],
    thirdPartyFilter: '*'
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.tierCount, 0);
  assert.equal(report.sourceMovementCount, 0);
  assert.ok(report.warnings.some(message => /plusieurs fiches/i.test(message)));
});

test('refuse les filtres, périodes et sources invalides sans afficher de cumuls partiels', () => {
  const badFilter = build({ thirdPartyFilter: 'CLIENT-ABSENT' });
  assert.equal(badFilter.ok, false);
  assert.ok(badFilter.errors.some(message => /Tiers introuvable/i.test(message)));

  const badPeriod = build({ from: '2024-12-31' });
  assert.equal(badPeriod.ok, false);
  assert.ok(badPeriod.errors.some(message => /cycle du dossier/i.test(message)));

  const badSource = build({ sourceErrors: ['Contrôle auxiliaire invalide.'] });
  assert.equal(badSource.ok, false);
  assert.deepEqual(badSource.rows, []);
  assert.equal(badSource.sourceMovementCount, 0);
});

console.log('Balance des tiers : tests de calcul terminés.');
