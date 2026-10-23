/* La justification restitue des lignes sources arrêtées à la date, sans calculer de solde. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/third-party-balance-justification-report.js');

const parties = [
  { id: 'client-a', code: 'CLI-A', name: 'Client Alpha', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-A', _thirdPartyNature: 'clients' },
  { id: 'client-b', code: 'CLI-B', name: 'Client Beta', accountCode: '411100', auxiliaryAccountCode: '411100-CLI-B', _thirdPartyNature: 'clients' },
  { id: 'supplier-a', code: 'FOU-A', name: 'Fournisseur A', accountCode: '401100', auxiliaryAccountCode: '401100-FOU-A', _thirdPartyNature: 'suppliers' },
  { id: 'other-a', code: 'DIV-A', name: 'Tiers divers A', accountCode: '471100', auxiliaryAccountCode: '471100-DIV-A', _thirdPartyNature: 'other-parties' }
];

const accounts = [
  { code: '411100', label: 'Clients', aux: true },
  { code: '401100', label: 'Fournisseurs', aux: true },
  { code: '471100', label: 'Tiers divers', aux: true },
  { code: '512000', label: 'Banque', aux: false },
  { code: '707000', label: 'Ventes', aux: false }
];

const entries = [
  { id: 'ENTRY-A', date: '2025-02-10', journal: 'VTE', reference: 'PIECE-A', sourceReference: 'FAC-A-25', status: 'posted', lines: [
    { account: '411100', debit: 25, credit: 0, auxiliaryCode: 'CLI-A', description: 'Facture Alpha' },
    { account: '707000', debit: 0, credit: 25 }
  ] },
  { id: 'ENTRY-B', date: '2025-03-31', journal: 'BQ', reference: 'PIECE-B', status: 'posted', lines: [
    { account: '411100', debit: 0, credit: 8, auxiliaryCode: '411100-CLI-B', description: 'Règlement Beta' },
    { account: '512000', debit: 8, credit: 0 }
  ] },
  { id: 'ENTRY-AFTER-CUTOFF', date: '2025-04-01', journal: 'VTE', reference: 'PIECE-C', status: 'posted', lines: [
    { account: '411100', debit: 999, credit: 0, auxiliaryCode: 'CLI-A', description: 'Après arrêté' },
    { account: '707000', debit: 0, credit: 999 }
  ] }
];

const movements = [
  { date: '2025-02-10', account: '411100', auxiliaryCode: 'CLI-A', debit: 25, credit: 0, sourceEntryId: 'ENTRY-A', lineNumber: 1 },
  { date: '2025-03-31', account: '411100', auxiliaryCode: '411100-CLI-B', debit: 0, credit: 8, sourceEntryId: 'ENTRY-B', lineNumber: 1 },
  { date: '2025-04-01', account: '411100', auxiliaryCode: 'CLI-A', debit: 999, credit: 0, sourceEntryId: 'ENTRY-AFTER-CUTOFF', lineNumber: 1 }
];

const openingBalances = [
  { id: 'RAN-A', accountCode: '411100', date: '2024-12-31', debit: 40, credit: 0, thirdPartyId: 'client-a', reference: 'RAN-A', label: 'Report Alpha' },
  { id: 'RAN-B', accountCode: '411100', date: '2024-12-31', debit: 0, credit: 12, thirdPartyCode: 'CLI-B', reference: 'RAN-B', label: 'Report Beta' },
  { id: 'RAN-FREE-TEXT', accountCode: '411100', date: '2024-12-31', debit: 999, credit: 0, thirdParty: 'CLI-A', label: 'Texte libre non probant' }
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
    asOfDate: '2025-03-31',
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

console.log('Justification de solde des tiers · date d’arrêté, lignes sources et références explicites');

test('reproduit les quatre natures et les six colonnes de la capture avec Libellé décochée', () => {
  assert.deepEqual(Report.NATURES.map(nature => nature.label), ['Fournisseurs', 'Clients', 'Personnel', 'Tiers divers']);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.label), ['Date', 'Compte général', 'Référence', 'Débit', 'Crédit', 'Libellé']);
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.defaultSelected), [true, true, true, true, true, false]);
});

test('inclut les reports explicitement liés et les mouvements validés jusqu’au jour d’arrêté inclus', () => {
  const snapshot = JSON.stringify({ entries, movements, openingBalances });
  const report = build({ commentLeft: 'Note à gauche', commentRight: 'Note à droite' });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.natureLabel, 'Clients');
  assert.equal(report.asOfDate, '2025-03-31');
  assert.deepEqual(report.groups.map(group => group.thirdPartyCode), ['CLI-A', 'CLI-B']);
  assert.deepEqual(report.rows.map(row => [row.rowType, row.date, row.accountCode, row.reference, row.debit, row.credit, row.label]), [
    ['opening-balance', '2024-12-31', '411100', 'RAN-A', 40, 0, 'Report Alpha'],
    ['movement', '2025-02-10', '411100', 'FAC-A-25', 25, 0, 'Facture Alpha'],
    ['opening-balance', '2024-12-31', '411100', 'RAN-B', 0, 12, 'Report Beta'],
    ['movement', '2025-03-31', '411100', 'PIECE-B', 0, 8, 'Règlement Beta']
  ]);
  assert.equal(report.lineCount, 4);
  assert.equal(report.movementLineCount, 2);
  assert.equal(report.openingLineCount, 2);
  assert.equal(report.basis.cutoffDateInclusive, true);
  assert.equal(report.basis.openingReportsRequireExplicitThirdPartyReference, true);
  assert.equal(report.basis.freeTextTierFieldNeverUsed, true);
  assert.equal(report.basis.noRunningOrNetBalanceCalculated, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(report.commentLeft, 'Note à gauche');
  assert.equal(report.commentRight, 'Note à droite');
  assert.equal(Object.hasOwn(report, 'totals'), false);
  assert.equal(Object.hasOwn(report.rows[0], 'balance'), false);
  assert.equal(report.rows.some(row => row.sourceEntryId === 'ENTRY-AFTER-CUTOFF'), false);
  assert.ok(report.warnings.some(message => /champ libre « Tiers »/i.test(message)));
  assert.ok(report.warnings.some(message => /report\(s\) d’ouverture/i.test(message)));
  assert.equal(JSON.stringify({ entries, movements, openingBalances }), snapshot, 'aucune source comptable n’est modifiée');
});

test('un champ tiers libre ne lie pas un report ; un filtre explicite ne retient que la fiche demandée', () => {
  const report = build({
    thirdPartyFilter: 'CLI-A',
    openingBalances: [openingBalances[2]],
    thirdPartyMovements: []
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.tierCount, 0);
  assert.deepEqual(report.rows, []);
  assert.ok(report.warnings.some(message => /n’ont pas de référence auxiliaire explicite exploitable/i.test(message)));
});

test('n’affiche aucune attribution lorsqu’une référence d’ouverture est ambiguë', () => {
  const ambiguous = [
    { id: 'client-a', code: 'DUP', name: 'Fiche A', accountCode: '411100', _thirdPartyNature: 'clients' },
    { id: 'client-b', code: 'DUP', name: 'Fiche B', accountCode: '411100', _thirdPartyNature: 'clients' }
  ];
  const report = build({
    thirdPartyRecords: ambiguous,
    allThirdPartyRecords: ambiguous,
    thirdPartyMovements: [{ date: '2025-02-10', account: '411100', auxiliaryCode: 'DUP', debit: 10, credit: 0, sourceEntryId: 'ambiguous', lineNumber: 1 }],
    openingBalances: [{ id: 'RAN-DUP', accountCode: '411100', date: '2024-12-31', debit: 10, credit: 0, thirdPartyCode: 'DUP' }]
  });
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 0);
  assert.equal(report.tierCount, 0);
  assert.ok(report.warnings.some(message => /références absentes, contradictoires ou ambiguës/i.test(message)));
  assert.ok(report.warnings.some(message => /mouvement\(s\) portent une référence correspondant à plusieurs fiches/i.test(message)));
});

test('refuse les sources incohérentes et une date invalide plutôt que de retourner des valeurs partielles', () => {
  const invalidOpening = build({ openingBalances: [{ id: 'BAD', accountCode: '411100', date: '2024-12-31', debit: -3, credit: 0, thirdPartyId: 'client-a' }] });
  assert.equal(invalidOpening.ok, false);
  assert.deepEqual(invalidOpening.rows, []);
  assert.ok(invalidOpening.errors.some(message => /montant invalide/i.test(message)));
  const invalidDate = build({ asOfDate: '2026-01-01' });
  assert.equal(invalidDate.ok, false);
  assert.deepEqual(invalidDate.rows, []);
  const invalidSource = build({ sourceErrors: ['Écriture source invalide.'] });
  assert.equal(invalidSource.ok, false);
  assert.deepEqual(invalidSource.rows, []);
  const mismatchedMovement = build({
    openingBalances: [],
    thirdPartyMovements: [{ date: '2025-02-10', account: '411100', auxiliaryCode: 'CLI-A', debit: 25, credit: 0, sourceEntryId: 'DRAFT-A', lineNumber: 1 }],
    entries: [{ id: 'DRAFT-A', date: '2025-02-10', status: 'draft', lines: [
      { account: '411100', debit: 25, credit: 0, auxiliaryCode: 'CLI-A' }, { account: '707000', debit: 0, credit: 25 }
    ] }]
  });
  assert.equal(mismatchedMovement.ok, false);
  assert.deepEqual(mismatchedMovement.rows, []);
  assert.ok(mismatchedMovement.errors.some(message => /écriture validée/i.test(message)));
});

console.log('Justification de solde des tiers : tests de calcul terminés.');
