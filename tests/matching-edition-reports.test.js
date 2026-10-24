/* États du lettrage : colonnes de capture, sources explicites et contrôle d’intégrité en lecture seule. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/matching-edition-reports.js');

const accounts = [
  { code: '401000', label: 'Fournisseurs', cls: 4, aux: true, active: true, postable: true },
  { code: '521000', label: 'Banque', cls: 5, aux: false, active: true, postable: true },
  { code: '411000', label: 'Clients', cls: 4, aux: true, active: true, postable: true }
];

const entries = [
  { id: 'MATCH-1', date: '2025-02-01', journal: 'OD', reference: 'OD-001', sourceReference: 'FACT-55', description: 'Facture réglée', status: 'posted', lines: [
    { account: '401000', debit: 100, credit: 0, description: 'Facture fournisseur' },
    { account: '521000', debit: 0, credit: 100, description: 'Contrepartie bancaire' }
  ] },
  { id: 'OPEN-1', date: '2025-03-10', journal: 'BQ', reference: 'BQ-004', sourceReference: 'VIR-11', description: 'Virement fournisseur', status: 'posted', lines: [
    { account: '401000', debit: 0, credit: 30, description: 'Virement fournisseur' },
    { account: '521000', debit: 30, credit: 0, description: 'Sortie de banque' }
  ] },
  { id: 'DRAFT-1', date: '2025-04-02', journal: 'OD', reference: 'OD-DRAFT', status: 'draft', lines: [
    { account: '401000', debit: 20, credit: 0 }, { account: '521000', debit: 0, credit: 20 }
  ] },
  { id: 'OUTSIDE-1', date: '2026-01-01', journal: 'OD', reference: 'OD-OUT', status: 'posted', lines: [
    { account: '411000', debit: 20, credit: 0 }, { account: '521000', debit: 0, credit: 20 }
  ] }
];

const matchingGroups = [
  { id: 'group-1', code: 'LET-2025-0001', accountCode: '401000', lineKeys: ['MATCH-1:0'], debit: 100, credit: 100, status: 'active', createdAt: '2025-02-03T10:30:00.000Z' },
  { id: 'group-cancelled', code: 'LET-2025-0002', accountCode: '411000', lineKeys: ['OPEN-1:0'], debit: 0, credit: 0, status: 'cancelled', createdAt: '2025-02-04T10:30:00.000Z' }
];

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    accountFilter: '*',
    from: '2025-01-01',
    to: '2025-12-31',
    accounts,
    entries,
    matchingGroups
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

console.log('États du lettrage · sélections, colonnes et sources explicites');

test('expose les trois états dans l’ordre de la capture et toutes les colonnes cochées', () => {
  assert.deepEqual(Reports.REPORT_IDS, [
    'edition-matched-entries', 'edition-unmatched-entries', 'edition-matching-anomalies'
  ]);
  const expected = {
    'edition-matched-entries': ['Date lettrage', 'Journal', 'Date écriture', 'N° pièce', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-unmatched-entries': ['Journal', 'Date', 'Pièce', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-matching-anomalies': ['Compte', 'Intitulé', 'Débits', 'Crédits', 'Anomalie']
  };
  for (const id of Reports.REPORT_IDS) {
    const definition = Reports.definitionFor(id);
    assert.deepEqual(definition.columns.map(column => column.label), expected[id], id);
    assert.ok(definition.columns.every(column => column.defaultSelected), id + ' : toutes les colonnes cochées');
  }
  assert.deepEqual(Reports.definitionFor('edition-unmatched-entries').filters, ['accounts', 'from', 'to']);
  assert.deepEqual(Reports.definitionFor('edition-unmatched-entries').fromLabel, 'Écritures à partir du');
  assert.deepEqual(Reports.definitionFor('edition-unmatched-entries').toLabel, 'Écritures non lettrées au');
  assert.deepEqual(Reports.definitionFor('edition-matching-anomalies').filters, ['accounts']);
});

test('les écritures lettrées reprennent le registre actif, la date de constitution et les valeurs sources', () => {
  const report = Reports.buildReport('edition-matched-entries', options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.generatedLineCount, 1);
  assert.equal(report.dataAvailable, true);
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.letteringDate, row.journal, row.entryDate, row.piece, row.reference, row.debit, row.credit, row.label]), [[
    '401000', '2025-02-03', 'OD', '2025-02-01', 'OD-001', 'FACT-55', 100, 0, 'Facture fournisseur'
  ]]);
  assert.equal(report.basis.explicitMatchingRegisterOnly, true);
  assert.equal(report.basis.noAccountingMutation, true);
});

test('les écritures non lettrées filtrent toutes les classes par date inclusive et excluent les brouillons', () => {
  const report = Reports.buildReport('edition-unmatched-entries', options({ from: '2025-03-10', to: '2025-03-10' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.date, row.journal, row.piece, row.reference, row.debit, row.credit]), [
    ['401000', '2025-03-10', 'BQ', 'BQ-004', 'VIR-11', 0, 30],
    ['521000', '2025-03-10', 'BQ', 'BQ-004', 'VIR-11', 30, 0]
  ]);
  assert.equal(Reports.buildReport('edition-unmatched-entries', options({ from: '2025-04-02', to: '2025-04-02' })).rows.length, 0, 'les brouillons restent exclus');
  assert.equal(Reports.buildReport('edition-unmatched-entries', options({ from: '2026-01-01', to: '2026-01-01' })).ok, false, 'les dates restent dans le cycle');
});

test('le filtre accepte le plan complet et les codes à venir, sans restriction de classe', () => {
  const allAccounts = Reports.buildReport('edition-unmatched-entries', options({ accountFilter: '*' }));
  const clientAccount = Reports.buildReport('edition-unmatched-entries', options({ accountFilter: '411*' }));
  const invalid = Reports.buildReport('edition-unmatched-entries', options({ accountFilter: '' }));
  assert.equal(allAccounts.ok, true);
  assert.equal(allAccounts.rows.some(row => row.accountCode === '521000'), true);
  assert.equal(clientAccount.ok, true);
  assert.equal(clientAccount.rows.length, 0, 'un filtre valide sans écriture ne fabrique aucune ligne');
  assert.equal(Reports.buildReport('edition-unmatched-entries', options({ accountFilter: '999999' })).ok, true, 'un code absent aujourd’hui reste un filtre recevable');
  assert.equal(invalid.ok, false);
  assert.equal(Reports.buildReport('edition-matched-entries', options({ from: '2025-03-01', to: '2025-02-01' })).ok, false);
});

test('ne signale comme anomalie que la contradiction avec les invariants du registre', () => {
  const anomalyEntries = entries.concat([
    { id: 'UNBAL-A', date: '2025-05-01', journal: 'OD', reference: 'OD-A', status: 'posted', lines: [
      { account: '401000', debit: 100, credit: 0 }, { account: '521000', debit: 0, credit: 100 }
    ] },
    { id: 'UNBAL-B', date: '2025-05-02', journal: 'OD', reference: 'OD-B', status: 'posted', lines: [
      { account: '401000', debit: 0, credit: 80 }, { account: '521000', debit: 80, credit: 0 }
    ] },
    { id: 'VALID-A', date: '2025-06-01', journal: 'OD', reference: 'OD-VA', status: 'posted', lines: [
      { account: '401000', debit: 50, credit: 0 }, { account: '521000', debit: 0, credit: 50 }
    ] },
    { id: 'VALID-B', date: '2025-06-02', journal: 'OD', reference: 'OD-VB', status: 'posted', lines: [
      { account: '401000', debit: 0, credit: 50 }, { account: '521000', debit: 50, credit: 0 }
    ] }
  ]);
  const groups = [
    { id: 'valid-group', code: 'LET-VALID', accountCode: '401000', lineKeys: ['VALID-A:0', 'VALID-B:0'], debit: 50, credit: 50, status: 'active' },
    { id: 'missing-group', code: 'LET-MISSING', accountCode: '401000', lineKeys: ['MISSING:0', 'MATCH-1:0'], debit: 100, credit: 100, status: 'active' },
    { id: 'unbalanced-group', code: 'LET-UNBAL', accountCode: '401000', lineKeys: ['UNBAL-A:0', 'UNBAL-B:0'], debit: 100, credit: 80, status: 'active' },
    { id: 'cancelled-group', code: 'LET-CANCELLED', accountCode: '411000', lineKeys: ['OPEN-1:0', 'VALID-A:0'], debit: 50, credit: 50, status: 'cancelled' }
  ];
  const report = Reports.buildReport('edition-matching-anomalies', options({ entries: anomalyEntries, matchingGroups: groups }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.matchingCode), ['LET-MISSING', 'LET-UNBAL']);
  assert.match(report.rows[0].anomaly, /ligne source est absente/i);
  assert.equal(report.rows[0].debit, 100);
  assert.equal(report.rows[0].credit, 100);
  assert.match(report.rows[1].anomaly, /totaux débit et crédit enregistrés ne sont pas équilibrés/i);
  assert.match(report.rows[1].anomaly, /lignes sources ne respectent pas l’équilibre exact/i);
  assert.equal(report.rows.some(row => row.matchingCode === 'LET-VALID'), false, 'un groupe valide n’est pas qualifié d’anomalie');
  assert.equal(report.rows.some(row => row.matchingCode === 'LET-2025-0002'), false, 'les groupes annulés sont exclus');
  const validGroup = groups.filter(group => group.id === 'valid-group');
  const inactiveAccounts = accounts.map(account => account.code === '401000' ? { ...account, active: false } : account);
  const inactiveAccountReport = Reports.buildReport('edition-matching-anomalies', options({ accounts: inactiveAccounts, entries: anomalyEntries, matchingGroups: validGroup }));
  assert.match(inactiveAccountReport.rows[0].anomaly, /compte du lettrage est inactif/i);
  const nonPostableAccounts = accounts.map(account => account.code === '401000' ? { ...account, postable: false } : account);
  const nonPostableAccountReport = Reports.buildReport('edition-matching-anomalies', options({ accounts: nonPostableAccounts, entries: anomalyEntries, matchingGroups: validGroup }));
  assert.match(nonPostableAccountReport.rows[0].anomaly, /compte du lettrage n’est plus imputable/i);
  assert.equal(report.basis.anomalyChecksUseExistingLettrageRules, true);
});

test('détecte une ligne dupliquée dans plusieurs lettrages actifs et respecte le filtre de compte', () => {
  const groups = matchingGroups.concat([
    { id: 'duplicate-1', code: 'LET-DUP-1', accountCode: '401000', lineKeys: ['MATCH-1:0', 'OPEN-1:0'], debit: 100, credit: 100, status: 'active' },
    { id: 'duplicate-2', code: 'LET-DUP-2', accountCode: '401000', lineKeys: ['MATCH-1:0', 'OPEN-1:0'], debit: 100, credit: 100, status: 'active' }
  ]);
  const filtered = Reports.buildReport('edition-matching-anomalies', options({ accountFilter: '401*', matchingGroups: groups }));
  assert.equal(filtered.ok, true, filtered.errors.join(' '));
  assert.equal(filtered.rows.length, 3);
  assert.ok(filtered.rows.every(row => /plusieurs lettrages actifs/.test(row.anomaly)));
  const otherAccount = Reports.buildReport('edition-matching-anomalies', options({ accountFilter: '521*', matchingGroups: groups }));
  assert.equal(otherAccount.rows.length, 0);
});

test('renvoie des listes vides sans inventer de lignes ou de totaux', () => {
  for (const id of Reports.REPORT_IDS) {
    const report = Reports.buildReport(id, options({ entries: [], matchingGroups: [] }));
    assert.equal(report.ok, true, report.errors.join(' '));
    assert.equal(report.dataAvailable, false);
    assert.deepEqual(report.rows, []);
    assert.equal(report.generatedLineCount, 0);
    assert.equal(report.basis.noAccountingMutation, true);
    assert.ok(report.warnings.length > 0);
  }
  assert.equal(Reports.buildReport('missing-report', options()).ok, false);
});

console.log('États du lettrage : dates, comptes, colonnes, source du lettrage et anomalies contrôlés.');
