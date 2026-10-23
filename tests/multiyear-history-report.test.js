/* Vérifie l’agrégation historique en lecture seule, sans double comptage des reports à nouveau. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/multiyear-history-report.js');

const accounts = [
  { code: '401000', label: 'Fournisseurs', postable: true },
  { code: '521000', label: 'Banque', postable: true }
];

const dossiers = [
  { id: 'd2024', name: 'Société · 2024', reference: 'COR-SOC2024', clientCode: 'SOC', accountingTypeCode: 'COR', exerciseYear: 2024, cycleStart: '2024-01-01', cycleEnd: '2024-12-31' },
  { id: 'd2025', name: 'Société · 2025', reference: 'COR-SOC2025', clientCode: 'SOC', accountingTypeCode: 'COR', exerciseYear: 2025, cycleStart: '2025-01-01', cycleEnd: '2025-12-31' },
  { id: 'd2026', name: 'Société · 2026', reference: 'COR-SOC2026', clientCode: 'SOC', accountingTypeCode: 'COR', exerciseYear: 2026, cycleStart: '2026-01-01', cycleEnd: '2026-12-31' },
  { id: 'other-client', name: 'Autre société', reference: 'COR-AUT2025', clientCode: 'AUT', accountingTypeCode: 'COR', exerciseYear: 2025, cycleStart: '2025-01-01', cycleEnd: '2025-12-31' },
  { id: 'other-type', name: 'Société · autre type', reference: 'SYS-SOC2025', clientCode: 'SOC', accountingTypeCode: 'SYS', exerciseYear: 2025, cycleStart: '2025-01-01', cycleEnd: '2025-12-31' }
];

function entry(id, date, supplierDebit, supplierCredit, bankDebit, bankCredit, status = 'posted') {
  return {
    id,
    date,
    journal: 'OD',
    reference: id,
    description: 'Mouvement source ' + id,
    status,
    lines: [
      { account: '401000', debit: supplierDebit, credit: supplierCredit, reference: 'REF-' + id, description: 'Ligne fournisseur ' + id },
      { account: '521000', debit: bankDebit, credit: bankCredit, description: 'Ligne banque ' + id }
    ]
  };
}

const sourceStates = {
  d2024: {
    accounts,
    journals: [],
    openingBalances: [
      { id: 'RAN-24-401', date: '2023-12-31', accountCode: '401000', debit: 0, credit: 100 },
      { id: 'RAN-24-521', date: '2023-12-31', accountCode: '521000', debit: 100, credit: 0 }
    ],
    entries: [entry('E24', '2024-06-05', 10, 0, 0, 10), entry('DRAFT24', '2024-07-05', 90, 0, 0, 90, 'draft')]
  },
  d2025: {
    accounts,
    journals: [],
    openingBalances: [
      { id: 'RAN-25-401', date: '2024-12-31', accountCode: '401000', debit: 0, credit: 90 },
      { id: 'RAN-25-521', date: '2024-12-31', accountCode: '521000', debit: 90, credit: 0 }
    ],
    entries: [entry('E25', '2025-02-01', 15, 0, 0, 15)]
  },
  d2026: {
    accounts,
    journals: [],
    openingBalances: [
      { id: 'RAN-26-401', date: '2025-12-31', accountCode: '401000', debit: 0, credit: 75 },
      { id: 'RAN-26-521', date: '2025-12-31', accountCode: '521000', debit: 75, credit: 0 }
    ],
    entries: [entry('E26', '2026-01-01', 0, 5, 5, 0)]
  },
  'other-client': {
    accounts,
    journals: [],
    openingBalances: [],
    entries: [entry('OTHER', '2025-06-01', 1000, 0, 0, 1000)]
  },
  'other-type': {
    accounts,
    journals: [],
    openingBalances: [],
    entries: [entry('WRONG-TYPE', '2025-06-01', 2000, 0, 0, 2000)]
  }
};

function makeSources(overrides = {}) {
  return dossiers.map(dossier => {
    const source = Object.prototype.hasOwnProperty.call(overrides, dossier.id)
      ? overrides[dossier.id]
      : sourceStates[dossier.id];
    return source
      ? { dossier, ok: true, state: source, errors: [] }
      : { dossier, ok: false, state: null, errors: ['Aucune base comptable enregistrée.'] };
  });
}

function context(overrides = {}) {
  const currentDossier = overrides.currentDossier || dossiers.find(dossier => dossier.id === 'd2026');
  return Object.assign({
    currentDossier,
    dossiers,
    sources: makeSources(),
    accounts,
    journals: [],
    decimalPlaces: 0,
    startExercise: 2024,
    accountFilter: '401*'
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

console.log('Historique des comptes sur plusieurs exercices · dossiers réels, reports et mouvements validés');

test('reprend les six colonnes de la capture et les coche par défaut', () => {
  assert.deepEqual(Report.COLUMN_DEFINITIONS.map(column => column.key), ['date', 'debit', 'balance', 'reference', 'credit', 'label']);
  assert.ok(Report.COLUMN_DEFINITIONS.every(column => column.defaultSelected));
});

test('agrège la même série de dossiers et initialise chaque exercice avec son RAN enregistré', () => {
  const before = JSON.stringify(sourceStates);
  const report = Report.build(context());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.sourceDossiers.map(source => source.id), ['d2024', 'd2025', 'd2026']);
  const supplier = report.accounts.find(account => account.code === '401000');
  assert.deepEqual(supplier.rows.map(row => row.date), ['2024-06-05', '2025-02-01', '2026-01-01']);
  assert.deepEqual(supplier.rows.map(row => row.balance), [-90, -75, -80]);
  assert.deepEqual(supplier.rows.map(row => row.reference), ['REF-E24', 'REF-E25', 'REF-E26']);
  assert.equal(report.lineCount, 3);
  assert.equal(report.generatedLineCount, 3);
  assert.equal(report.movementEntryCount, 3);
  assert.equal(report.basis.startingOpeningBalanceDossierId, 'd2024');
  assert.equal(report.basis.openingBalancesUsedPerExercise, true);
  assert.equal(report.basis.exerciseOpeningBalancesResetRunningBalance, true);
  assert.equal(report.basis.noOpeningBalanceDoubleCount, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(JSON.stringify(sourceStates), before, 'les snapshots d’origine restent inchangés');
});

test('le report enregistré dans un exercice ultérieur gouverne son solde sans devenir un mouvement', () => {
  const laterState = Object.assign({}, sourceStates.d2025, {
    openingBalances: [
      { id: 'RAN-25-401-ADJUSTED', date: '2024-12-31', accountCode: '401000', debit: 0, credit: 50 },
      { id: 'RAN-25-521-ADJUSTED', date: '2024-12-31', accountCode: '521000', debit: 50, credit: 0 }
    ]
  });
  const report = Report.build(context({ sources: makeSources({ d2025: laterState }) }));
  assert.equal(report.ok, true, report.errors.join(' '));
  const supplier = report.accounts.find(account => account.code === '401000');
  assert.deepEqual(supplier.rows.map(row => row.balance), [-90, -35, -80]);
  assert.equal(report.lineCount, 3, 'les lignes de report ne gonflent pas le compteur des mouvements');
});

test('un autre exercice de début reprend seulement son propre report initial', () => {
  const report = Report.build(context({ startExercise: 2025 }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.sourceDossiers.map(source => source.id), ['d2025', 'd2026']);
  const supplier = report.accounts.find(account => account.code === '401000');
  assert.deepEqual(supplier.rows.map(row => row.balance), [-75, -80]);
  assert.equal(report.basis.startingOpeningBalanceDossierId, 'd2025');
});

test('le compteur n’inclut ni les brouillons ni les dossiers d’un autre client ou type comptable', () => {
  const report = Report.build(context({ accountFilter: '*' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 6);
  assert.equal(report.movementEntryCount, 3);
  assert.equal(report.rows.some(row => row.reference === 'REF-OTHER'), false);
  assert.equal(report.rows.some(row => row.reference === 'REF-WRONG-TYPE'), false);
});

test('propose uniquement les années dont tous les dossiers source sélectionnés sont lisibles', () => {
  assert.deepEqual(Report.availableStartYears(context()), [2024, 2025, 2026]);
  const unavailableSources = makeSources({ d2025: null });
  assert.deepEqual(Report.availableStartYears(context({ sources: unavailableSources })), [2026]);
  const report = Report.build(context({ sources: unavailableSources, startExercise: 2024 }));
  assert.equal(report.ok, false);
  assert.match(report.errors.join(' '), /COR-SOC2025/);
  assert.equal(report.accounts.length, 0, 'aucun résultat partiel n’est présenté');
});

test('signale les périodes manquantes plutôt que de créer des mouvements', () => {
  const dossiersWithout2025 = dossiers.filter(dossier => dossier.id !== 'd2025' && dossier.id !== 'other-client' && dossier.id !== 'other-type');
  const dossierIds = new Set(dossiersWithout2025.map(dossier => dossier.id));
  const sourcesWithout2025 = makeSources().filter(source => dossierIds.has(source.dossier.id));
  const report = Report.build(context({ dossiers: dossiersWithout2025, sources: sourcesWithout2025 }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.ok(report.warnings.some(warning => warning.includes('Aucun dossier accessible ne couvre la période')));
  assert.equal(report.lineCount, 2);
  assert.equal(report.sourceDossiers.length, 2);
});

test('refuse les cycles qui se chevauchent et les filtres invalides', () => {
  const overlapping = Object.assign({}, dossiers.find(dossier => dossier.id === 'd2025'), {
    cycleStart: '2024-12-01', cycleEnd: '2025-11-30'
  });
  const overlappingDossiers = dossiers.map(dossier => dossier.id === 'd2025' ? overlapping : dossier);
  const overlapReport = Report.build(context({ dossiers: overlappingDossiers }));
  assert.equal(overlapReport.ok, false);
  assert.ok(overlapReport.errors.some(error => error.includes('se chevauchent')));
  assert.equal(Report.build(context({ accountFilter: '' })).ok, false);
});

test('ignore les écritures datées hors du cycle de leur dossier et le signale', () => {
  const sourceOverrides = Object.assign({}, sourceStates, {
    d2025: Object.assign({}, sourceStates.d2025, {
      entries: sourceStates.d2025.entries.concat(entry('OUTSIDE', '2024-12-30', 7, 0, 0, 7))
    })
  });
  const sources = dossiers.map(dossier => ({ dossier, ok: true, state: sourceOverrides[dossier.id], errors: [] }));
  const report = Report.build(context({ sources }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.lineCount, 3);
  assert.ok(report.warnings.some(warning => warning.includes('hors du cycle de son dossier')));
  assert.equal(report.rows.some(row => row.reference === 'REF-OUTSIDE'), false);
});

console.log('Historique pluriannuel : tests de calcul terminés.');
