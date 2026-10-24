/* États du pointage : sources explicites, comptes sans limite de classe, colonnes de capture. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/pointing-edition-reports.js');

const accounts = [
  { code: '401000', label: 'Fournisseurs', cls: 4 },
  { code: '521000', label: 'Banque principale', cls: 5 },
  { code: '531000', label: 'Caisse', cls: 5 }
];

const entries = [
  { id: 'BANK-1', date: '2025-02-01', reference: 'BQ-001', description: 'Virement bancaire', status: 'posted', lines: [
    { account: '521000', debit: 100, credit: 0, description: 'Virement bancaire' }
  ] },
  { id: 'MANUAL-1', date: '2025-02-10', reference: 'CA-002', description: 'Mouvement manuel', status: 'posted', lines: [
    { account: '531000', debit: 0, credit: 40, description: 'Mouvement manuel' }
  ] },
  { id: 'FUTURE-1', date: '2025-03-01', reference: 'FUT-001', description: 'Compte futur', status: 'posted', lines: [
    { account: '999900', debit: 70, credit: 0, description: 'Compte futur' }
  ] },
  { id: 'OPEN-1', date: '2025-04-15', reference: 'BQ-004', description: 'Mouvement non pointé', status: 'posted', lines: [
    { account: '521000', debit: 0, credit: 50, description: 'Mouvement non pointé' }
  ] },
  { id: 'CANCELLED-1', date: '2025-05-01', reference: 'BQ-005', description: 'Pointage annulé', status: 'posted', lines: [
    { account: '521000', debit: 25, credit: 0, description: 'Pointage annulé' }
  ] },
  { id: 'DRAFT-1', date: '2025-06-01', reference: 'OD-DRAFT', description: 'Brouillon', status: 'draft', lines: [
    { account: '521000', debit: 30, credit: 0, description: 'Brouillon' }
  ] },
  { id: 'AUX-UNPOINTED', date: '2025-06-15', reference: 'FOU-001', description: 'Mouvement auxiliaire non pointé', status: 'posted', lines: [
    { account: '401000', debit: 12, credit: 0, description: 'Mouvement auxiliaire non pointé' }
  ] },
  { id: 'OUTSIDE-1', date: '2026-01-01', reference: 'BQ-OUT', description: 'Hors cycle', status: 'posted', lines: [
    { account: '521000', debit: 10, credit: 0, description: 'Hors cycle' }
  ] }
];

const pointageMarks = [
  { id: 'P1', code: 'PNT-2025-0001', lineKey: 'BANK-1:0', entryId: 'BANK-1', lineIndex: 0, accountCode: '521000', statementDate: '2025-02-02', createdAt: '2025-02-02T11:30:00.000Z', bankStatementId: 'STMT-1', bankStatementRowId: 'ROW-1', status: 'pointed' },
  { id: 'P2', code: 'PNT-2025-0002', lineKey: 'MANUAL-1:0', entryId: 'MANUAL-1', lineIndex: 0, accountCode: '531000', statementDate: '', createdAt: '2025-02-12T09:00:00.000Z', status: 'pointed' },
  { id: 'P3', code: 'PNT-2025-0003', lineKey: 'FUTURE-1:0', entryId: 'FUTURE-1', lineIndex: 0, accountCode: '999900', statementDate: '2025-03-02', createdAt: '2025-03-02T09:00:00.000Z', status: 'pointed' },
  { id: 'P4', code: 'PNT-2025-0004', lineKey: 'CANCELLED-1:0', entryId: 'CANCELLED-1', lineIndex: 0, accountCode: '521000', statementDate: '2025-05-02', createdAt: '2025-05-02T09:00:00.000Z', status: 'cancelled' }
];

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    accountFilter: '*',
    from: '2025-01-01',
    to: '2025-12-31',
    accountScope: 'all',
    signatories: { center: 'Centre', centerName: 'Nom Centre', left: 'Gauche', leftName: 'Nom Gauche', right: 'Droite', rightName: 'Nom Droite' },
    accounts,
    entries,
    pointageMarks
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

console.log('États du pointage · sélections, colonnes, sources et comptes');

test('expose les quatre états distincts correspondant aux fenêtres de la capture', () => {
  assert.deepEqual(Reports.REPORT_IDS, [
    'edition-pointed-entries', 'edition-unpointed-entries',
    'edition-pointing-balance-justification', 'edition-bank-reconciliation'
  ]);
  const expected = {
    'edition-pointed-entries': ['Date pointage', 'Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-unpointed-entries': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-pointing-balance-justification': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-bank-reconciliation': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé']
  };
  for (const id of Reports.REPORT_IDS) {
    const definition = Reports.definitionFor(id);
    assert.deepEqual(definition.columns.map(column => column.label), expected[id], id);
    assert.ok(definition.columns.every(column => column.defaultSelected), id + ' : colonnes cochées');
  }
  assert.deepEqual(Reports.definitionFor('edition-pointed-entries').filters, ['accounts', 'from', 'to']);
  assert.deepEqual(Reports.definitionFor('edition-unpointed-entries').filters, ['accounts', 'to']);
  assert.equal(Reports.definitionFor('edition-bank-reconciliation').hasSignatories, true);
});

test('les écritures pointées sont lues dans le registre actif, toutes classes confondues', () => {
  const report = Reports.buildReport('edition-pointed-entries', options());
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.pointageDate, row.entryDate, row.reference, row.debit, row.credit, row.label]), [
    ['521000', '2025-02-02', '2025-02-01', 'BQ-001', 100, 0, 'Virement bancaire'],
    ['531000', '2025-02-12', '2025-02-10', 'CA-002', 0, 40, 'Mouvement manuel'],
    ['999900', '2025-03-02', '2025-03-01', 'FUT-001', 70, 0, 'Compte futur']
  ]);
  assert.equal(report.rows.some(row => row.accountCode === '999900'), true, 'un compte futur sans restriction de classe est lu');
  assert.equal(report.basis.explicitPointageRegisterOnly, true);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.ok(report.warnings.length > 0);
});

test('les comptes à imprimer couvrent tout le plan ou seulement les comptes mouvementés', () => {
  const allSelected = Reports.buildReport('edition-pointed-entries', options());
  const movedOnly = Reports.buildReport('edition-pointed-entries', options({ accountScope: 'moved' }));
  assert.deepEqual(allSelected.displayAccounts.map(account => account.code), ['401000', '521000', '531000', '999900']);
  assert.deepEqual(movedOnly.displayAccounts.map(account => account.code), ['521000', '531000', '999900']);
  const futureFilter = Reports.buildReport('edition-pointed-entries', options({ accountFilter: '999*' }));
  assert.deepEqual(futureFilter.rows.map(row => row.accountCode), ['999900']);
  assert.equal(Reports.buildReport('edition-pointed-entries', options({ accountFilter: '999999' })).ok, true, 'un compte futur absent du plan reste sélectionnable');
});

test('les écritures non pointées excluent les marqueurs actifs, mais pas les pointages annulés', () => {
  const report = Reports.buildReport('edition-unpointed-entries', options({ to: '2025-05-01' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.entryDate, row.reference]), [
    ['521000', '2025-04-15', 'BQ-004'],
    ['521000', '2025-05-01', 'BQ-005']
  ]);
  assert.equal(Reports.buildReport('edition-unpointed-entries', options({ to: '2025-06-01' })).rows.some(row => row.reference === 'OD-DRAFT'), false);
  assert.equal(Reports.buildReport('edition-unpointed-entries', options({ to: '2025-02-10', accountFilter: '531*' })).rows.length, 0, 'la ligne pointée ne réapparaît pas');
});

test('les rapprochements bancaires ne reprennent que les liens explicites de relevé', () => {
  const report = Reports.buildReport('edition-bank-reconciliation', options({ to: '2025-02-28' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.lineKey), ['BANK-1:0']);
  assert.deepEqual(report.signatories, options().signatories);
  assert.equal(report.basis.bankStatementLinkedRowsOnly, true);
  assert.match(report.warnings.join(' '), /aucun écart bancaire ni solde n’est recalculé/i);
  assert.equal(Reports.buildReport('edition-bank-reconciliation', options({ to: '2025-01-31' })).rows.length, 0);
});

test('la justification reprend les pointages actifs à la date sans recalculer de soldes', () => {
  const report = Reports.buildReport('edition-pointing-balance-justification', options({ to: '2025-03-31' }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.rows.map(row => row.lineKey), ['BANK-1:0', 'MANUAL-1:0', 'FUTURE-1:0']);
  assert.equal(report.basis.noBalanceRecalculation, true);
  assert.match(report.warnings.join(' '), /aucun solde, écart ou rapprochement n’est recalculé/i);
});

test('les dates restent bornées au cycle et le filtre * accepte toutes les classes', () => {
  assert.equal(Reports.buildReport('edition-pointed-entries', options({ from: '2025-12-31', to: '2025-01-01' })).ok, false);
  assert.equal(Reports.buildReport('edition-unpointed-entries', options({ to: '2026-01-01' })).ok, false);
  const all = Reports.buildReport('edition-unpointed-entries', options({ accountFilter: '*' }));
  assert.equal(all.ok, true);
  assert.ok(all.rows.some(row => row.accountCode === '401000'), 'pas de restriction aux comptes 93–99 ou à la classe 5');
  assert.equal(Reports.buildReport('edition-unpointed-entries', options({ accountFilter: '' })).ok, false);
});

test('ne fabrique ni écritures ni lignes de pointage en l’absence de source', () => {
  for (const id of Reports.REPORT_IDS) {
    const report = Reports.buildReport(id, options({ accounts: [], entries: [], pointageMarks: [] }));
    assert.equal(report.ok, true, report.errors.join(' '));
    assert.equal(report.generatedLineCount, 0);
    assert.deepEqual(report.rows, []);
    assert.equal(report.basis.noAccountingMutation, true);
  }
  assert.equal(Reports.buildReport('missing-report', options()).ok, false);
});

console.log('États du pointage : dates, comptes, colonnes, pointages et rapprochements contrôlés.');
