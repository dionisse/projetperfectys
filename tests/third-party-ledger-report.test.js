/* Vérifie le Grand livre des tiers depuis les seules références auxiliaires explicites. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-ledger-report.js');
const AccountingCentralization = require('../modern-proto/js/accounting-centralization.js');

const parties = [
  { id: 'client-a', code: 'CLI-A', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-A', _thirdPartyNature: 'clients' },
  { id: 'client-b', code: 'CLI-B', name: 'Client Beta', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-B', _thirdPartyNature: 'clients' },
  { id: 'supplier-a', code: 'FOU-A', name: 'Fournisseur A', accountCode: '401100', auxiliaryAccountCode: '401100-FOU-A', _thirdPartyNature: 'suppliers' },
  { id: 'debtor-a', code: 'DV-A', name: 'Débiteur divers', type: 'debtor', accountCode: '471100', auxiliaryAccountCode: '471100-DV-A', _thirdPartyNature: 'other-parties' },
  { id: 'creditor-a', code: 'DV-B', name: 'Créditeur divers', type: 'creditor', accountCode: '472100', auxiliaryAccountCode: '472100-DV-B', _thirdPartyNature: 'other-parties' }
];

const accounts = [
  { code: '411100', label: 'Clients', aux: true },
  { code: '401100', label: 'Fournisseurs', aux: true },
  { code: '471100', label: 'Débiteurs divers', aux: true },
  { code: '472100', label: 'Créditeurs divers', aux: true },
  { code: '512000', label: 'Banque', aux: false },
  { code: '707000', label: 'Ventes', aux: false }
];

const entries = [
  { id: 'JAN-A', date: '2025-01-15', journal: 'OD', reference: 'OD-001', status: 'posted', lines: [
    { account: '411100', debit: 10, credit: 0, auxiliaryCode: 'CLI-A', description: 'Mouvement antérieur' },
    { account: '512000', debit: 0, credit: 10 }
  ] },
  { id: 'FEB-A', date: '2025-02-05', journal: 'BQ', reference: 'BQ-001', sourceReference: 'VIR-EXT-1', status: 'posted', lines: [
    { account: '411100', debit: 0, credit: 30, auxiliaryCode: '411100-CLI-A', market: 'M-03', description: 'Règlement client' },
    { account: '512000', debit: 30, credit: 0 }
  ] },
  { id: 'MAR-A', date: '2025-03-31', journal: 'VTE', reference: 'VT-001', status: 'posted', lines: [
    { account: '411100', debit: 5, credit: 0, auxiliaryCode: 'client-a', description: 'Facture client' },
    { account: '707000', debit: 0, credit: 5 }
  ] },
  { id: 'FEB-B', date: '2025-02-28', journal: 'VTE', reference: 'VT-002', status: 'posted', lines: [
    { account: '411100', debit: 15, credit: 0, auxiliaryCode: 'CLI-B', description: 'Facture Beta' },
    { account: '707000', debit: 0, credit: 15 }
  ] },
  { id: 'DRAFT', date: '2025-02-10', journal: 'OD', reference: 'OD-DRAFT', status: 'draft', lines: [
    { account: '411100', debit: 999, credit: 0, auxiliaryCode: 'CLI-A' },
    { account: '512000', debit: 0, credit: 999 }
  ] }
];

const movements = [
  { date: '2025-01-15', account: '411100', auxiliaryCode: 'CLI-A', debit: 10, credit: 0, sourceEntryId: 'JAN-A', lineNumber: 1 },
  { date: '2025-02-05', account: '411100', auxiliaryCode: '411100-CLI-A', debit: 0, credit: 30, sourceEntryId: 'FEB-A', lineNumber: 1 },
  { date: '2025-03-31', account: '411100', auxiliaryCode: 'client-a', debit: 5, credit: 0, sourceEntryId: 'MAR-A', lineNumber: 1 },
  { date: '2025-02-28', account: '411100', auxiliaryCode: 'CLI-B', debit: 15, credit: 0, sourceEntryId: 'FEB-B', lineNumber: 1 }
];

const openingBalances = [
  { id: 'RAN-A', accountCode: '411100', date: '2024-12-31', debit: 40, credit: 0, thirdPartyId: 'client-a' },
  { id: 'RAN-B', accountCode: '411100', date: '2024-12-31', debit: 0, credit: 12, thirdPartyCode: 'CLI-B' },
  { id: 'RAN-FREE-TEXT', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdParty: 'Client Alpha' }
];

function build(overrides = {}) {
  return Report.build(Object.assign({
    nature: 'clients',
    thirdPartyRecords: parties.filter(record => record._thirdPartyNature === 'clients'),
    allThirdPartyRecords: parties,
    thirdPartyMovements: movements,
    entries,
    accounts,
    openingBalances,
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    from: '2025-02-01',
    to: '2025-02-28',
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

console.log('Grand livre des tiers · références explicites, mouvements et soldes progressifs');

test('reprend les quatre natures et les onze colonnes cochées dans l’ordre demandé', () => {
  assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), [
    'Date', 'Journal', 'Pièce', 'Compte général', 'Référence', 'Débit', 'Crédit', 'Solde', 'Marché', 'Libellé', 'Contrepartie'
  ]);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('calcule un solde progressif propre à chaque tiers avec les reports et mouvements antérieurs explicites', () => {
  const snapshot = JSON.stringify({ entries, movements, openingBalances });
  const report = build();
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Clients');
  assert.equal(report.tierCount, 2);
  assert.equal(report.sourceMovementCount, 3);
  assert.equal(report.periodMovementCount, 2);
  assert.equal(report.openingReportLineCount, 2);
  assert.equal(report.lineCount, 2);
  assert.equal(report.movementEntryCount, 2);
  assert.deepEqual(report.groups.map(group => [group.thirdPartyCode, group.openingBalance, group.closingBalance, group.openingReportKnown]), [
    ['CLI-A', 50, 20, true],
    ['CLI-B', -12, 3, true]
  ]);
  const alpha = report.groups[0].rows[0];
  assert.deepEqual([
    alpha.date, alpha.journal, alpha.piece, alpha.accountCode, alpha.reference, alpha.debit, alpha.credit,
    alpha.balance, alpha.market, alpha.label, alpha.counterpart
  ], ['2025-02-05', 'BQ', 'BQ-001', '411100', 'VIR-EXT-1', 0, 30, 20, 'M-03', 'Règlement client', '512000 — Banque']);
  const beta = report.groups[1].rows[0];
  assert.equal(beta.balance, 3);
  assert.equal(beta.market, '', 'le marché reste vide si la source ne le porte pas');
  assert.equal(report.totals.debit, 15);
  assert.equal(report.totals.credit, 30);
  assert.equal(report.totals.difference, -15);
  assert.equal(report.basis.explicitThirdPartyReferencesOnly, true);
  assert.equal(report.basis.counterpartFromOtherAccountsInSameEntry, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify({ entries, movements, openingBalances }), snapshot, 'le calcul ne modifie aucune source');
});

test('consomme directement les lignes traçables extraites des écritures validées', () => {
  const dossier = { cycleStart: '2025-01-01', cycleEnd: '2025-12-31' };
  const extraction = AccountingCentralization.extractValidatedAuxiliaryMovements(entries, accounts, dossier, { decimalPlaces: 0 });
  assert.equal(extraction.ok, true, extraction.errors.join(' '));
  assert.equal(extraction.stats.ignoredDraftEntryCount, 1);
  const report = build({ thirdPartyFilter: 'CLI-A', thirdPartyMovements: extraction.movements, sourceWarnings: [] });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.groups.length, 1);
  assert.deepEqual(report.groups[0].rows.map(row => [row.sourceEntryId, row.balance]), [['FEB-A', 20]]);
});

test('filtre un seul tiers et ne mélange pas les soldes de fiches partageant le même compte général', () => {
  const report = build({ thirdPartyFilter: 'CLI-A' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.groups.map(group => group.thirdPartyCode), ['CLI-A']);
  assert.equal(report.groups[0].rows[0].balance, 20);
  assert.equal(report.groups[0].rows[0].accountCode, '411100');
});

test('ne reprend jamais un report relié uniquement par le libellé libre du registre', () => {
  const report = build({
    thirdPartyFilter: 'CLI-A',
    from: '2025-01-01',
    to: '2025-01-31',
    thirdPartyMovements: [movements[0]],
    openingBalances: [{ id: 'RAN-TEXTE', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdParty: 'CLI-A' }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.groups[0].openingReportKnown, false);
  assert.equal(report.groups[0].openingReportBalance, 0);
  assert.equal(report.groups[0].openingBalance, 0);
  assert.equal(report.groups[0].rows[0].balance, 10);
  assert.equal(report.openingReportLineCount, 0);
  assert.equal(report.unattributedOpeningBalanceCount, 1);
  assert.ok(report.warnings.some(message => /champ libre « Tiers »/i.test(message)));
});

test('combine les débiteurs et créditeurs divers sans confondre leurs références ni leurs comptes', () => {
  const allDivers = parties.filter(record => record._thirdPartyNature === 'other-parties');
  const entriesForDivers = [
    { id: 'DIVERSE-D', date: '2025-01-20', journal: 'OD', reference: 'OD-D', status: 'posted', lines: [
      { account: '471100', debit: 70, credit: 0, auxiliaryCode: 'DV-A' }, { account: '512000', debit: 0, credit: 70 }
    ] },
    { id: 'DIVERSE-C', date: '2025-01-21', journal: 'OD', reference: 'OD-C', status: 'posted', lines: [
      { account: '472100', debit: 0, credit: 22, auxiliaryCode: 'DV-B' }, { account: '512000', debit: 22, credit: 0 }
    ] }
  ];
  const report = build({
    nature: 'other-parties',
    thirdPartyRecords: allDivers,
    allThirdPartyRecords: parties,
    thirdPartyMovements: [
      { date: '2025-01-20', account: '471100', auxiliaryCode: 'DV-A', debit: 70, credit: 0, sourceEntryId: 'DIVERSE-D', lineNumber: 1 },
      { date: '2025-01-21', account: '472100', auxiliaryCode: 'DV-B', debit: 0, credit: 22, sourceEntryId: 'DIVERSE-C', lineNumber: 1 }
    ],
    entries: entriesForDivers,
    openingBalances: [],
    from: '2025-01-01',
    to: '2025-12-31'
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Tiers divers');
  assert.deepEqual(report.groups.map(group => [group.thirdPartyCode, group.thirdPartyType, group.accountCode, group.closingBalance]), [
    ['DV-A', 'debtor', '471100', 70],
    ['DV-B', 'creditor', '472100', -22]
  ]);
});

test('exclut une référence de mouvement ambiguë même si toutes les fiches sont sélectionnées', () => {
  const ambiguousParties = [
    { id: 'debtor-one', code: 'DUP', name: 'Débiteur 1', type: 'debtor', accountCode: '471100', _thirdPartyNature: 'other-parties' },
    { id: 'creditor-two', code: 'DUP', name: 'Créditeur 2', type: 'creditor', accountCode: '471100', _thirdPartyNature: 'other-parties' }
  ];
  const report = build({
    nature: 'other-parties',
    thirdPartyRecords: ambiguousParties,
    allThirdPartyRecords: ambiguousParties,
    thirdPartyMovements: [{ date: '2025-02-10', account: '471100', auxiliaryCode: 'DUP', debit: 5, credit: 0, sourceEntryId: 'AMB', lineNumber: 1 }],
    entries: [{ id: 'AMB', date: '2025-02-10', status: 'posted', lines: [
      { account: '471100', debit: 5, credit: 0, auxiliaryCode: 'DUP' }, { account: '512000', debit: 0, credit: 5 }
    ] }],
    accounts,
    openingBalances: []
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.groups.length, 0);
  assert.equal(report.ambiguousMovementCount, 1);
  assert.ok(report.warnings.some(message => /plusieurs fiches/i.test(message)));
});

test('refuse les filtres, périodes et correspondances de lignes sources invalides', () => {
  assert.equal(build({ thirdPartyFilter: 'TIERS-ABSENT' }).ok, false);
  assert.equal(build({ from: '2024-12-31' }).ok, false);
  const missingSourceLine = build({ thirdPartyFilter: 'CLI-A', thirdPartyMovements: [Object.assign({}, movements[1], { sourceEntryId: 'UNKNOWN' })] });
  assert.equal(missingSourceLine.ok, false);
  assert.deepEqual(missingSourceLine.groups, []);
  assert.ok(missingSourceLine.errors.some(message => /retrouvé de façon univoque/i.test(message)));
  const badOpeningDate = build({ openingBalances: [Object.assign({}, openingBalances[0], { date: '2025-01-01' })] });
  assert.equal(badOpeningDate.ok, false);
  assert.ok(badOpeningDate.errors.some(message => /veille du cycle/i.test(message)));
});

console.log('Grand livre des tiers : tests de calcul terminés.');
