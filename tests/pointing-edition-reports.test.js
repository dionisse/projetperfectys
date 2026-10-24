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
  { id: 'P1', code: 'PNT-2025-0001', lineKey: 'BANK-1:0', entryId: 'BANK-1', lineIndex: 0, accountCode: '521000', statementDate: '2025-02-02', createdAt: '2025-02-02T11:30:00.000Z', bankStatementId: 'STMT-1', bankStatementRowId: 'ROW-1', reference: 'BQ-001', status: 'pointed' },
  { id: 'P2', code: 'PNT-2025-0002', lineKey: 'MANUAL-1:0', entryId: 'MANUAL-1', lineIndex: 0, accountCode: '531000', statementDate: '', createdAt: '2025-02-12T09:00:00.000Z', status: 'pointed' },
  { id: 'P3', code: 'PNT-2025-0003', lineKey: 'FUTURE-1:0', entryId: 'FUTURE-1', lineIndex: 0, accountCode: '999900', statementDate: '2025-03-02', createdAt: '2025-03-02T09:00:00.000Z', status: 'pointed' },
  { id: 'P4', code: 'PNT-2025-0004', lineKey: 'CANCELLED-1:0', entryId: 'CANCELLED-1', lineIndex: 0, accountCode: '521000', statementDate: '2025-05-02', createdAt: '2025-05-02T09:00:00.000Z', status: 'cancelled' }
];

const bankStatements = [
  {
    id: 'STMT-1', dossierId: 'DOSSIER-1', accountCode: '521000', fileName: 'Releve-fevrier.csv', importedAt: '2025-03-01T08:00:00.000Z',
    rowCount: 5, validCount: 3, invalidCount: 2, rows: [
      { id: 'ROW-1', rowNumber: 2, date: '2025-02-02', reference: 'BQ-001', description: 'Virement', statementDebit: 100, statementCredit: 0, valid: true, errors: [] },
      { id: 'ROW-2', rowNumber: 3, date: '2025-02-10', reference: 'FRAIS', description: 'Frais bancaires', statementDebit: 0, statementCredit: 0, valid: false, errors: ['montant nul ou manquant'] },
      { id: 'ROW-3', rowNumber: 4, date: '2025-02-01', reference: 'BQ-001', description: 'Virement ressemblant', statementDebit: 100, statementCredit: 0, valid: true, errors: [] },
      { id: 'ROW-4', rowNumber: 5, date: '2024-12-15', reference: 'HORS-CYCLE', description: 'Ligne antérieure', statementDebit: 1, statementCredit: 0, valid: true, errors: [] },
      { id: 'ROW-INVALID-DATE', rowNumber: 6, date: '', reference: 'DATE-ERR', description: 'Date à contrôler', statementDebit: 2, statementCredit: 0, valid: false, errors: ['date invalide ou manquante'] }
    ]
  },
  {
    id: 'STMT-FUTURE', dossierId: 'DOSSIER-1', accountCode: '999900', fileName: 'Releve-futur.csv', importedAt: '2025-03-02T08:00:00.000Z',
    rowCount: 1, validCount: 1, invalidCount: 0, rows: [
      { id: 'ROW-FUTURE', rowNumber: 2, date: '2025-03-03', reference: 'FUT-1', description: 'Compte futur', statementDebit: 0, statementCredit: 7, valid: true, errors: [] }
    ]
  },
  {
    id: 'OTHER-DOSSIER', dossierId: 'DOSSIER-OTHER', accountCode: '521000', fileName: 'Autre-dossier.csv', importedAt: '2025-03-03T08:00:00.000Z',
    rowCount: 1, validCount: 1, invalidCount: 0, rows: [
      { id: 'OTHER-ROW', rowNumber: 2, date: '2025-02-03', reference: 'AUTRE', description: 'Autre dossier', statementDebit: 9, statementCredit: 0, valid: true, errors: [] }
    ]
  }
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
    dossierId: 'DOSSIER-1',
    accounts,
    entries,
    pointageMarks,
    bankStatements: []
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

console.log('États du pointage · relevés importés, sélections, colonnes et comptes');

test('expose les cinq états distincts du sous-menu Pointage', () => {
  assert.deepEqual(Reports.REPORT_IDS, [
    'edition-pointed-entries', 'edition-unpointed-entries',
    'edition-pointing-balance-justification', 'edition-bank-reconciliation', 'edition-bank-statement'
  ]);
  const expected = {
    'edition-pointed-entries': ['Date pointage', 'Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-unpointed-entries': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-pointing-balance-justification': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-bank-reconciliation': ['Date écriture', 'Référence', 'Débit', 'Crédit', 'Libellé'],
    'edition-bank-statement': ['Date', 'Référence', 'Libellé', 'Débit banque', 'Crédit banque', 'État', 'Référence écriture associée']
  };
  for (const id of Reports.REPORT_IDS) {
    const definition = Reports.definitionFor(id);
    assert.deepEqual(definition.columns.map(column => column.label), expected[id], id);
    assert.ok(definition.columns.every(column => column.defaultSelected), id + ' : colonnes cochées');
  }
  assert.deepEqual(Reports.definitionFor('edition-pointed-entries').filters, ['accounts', 'from', 'to']);
  assert.deepEqual(Reports.definitionFor('edition-unpointed-entries').filters, ['accounts', 'to']);
  assert.deepEqual(Reports.definitionFor('edition-bank-statement').filters, ['accounts', 'statementId', 'from', 'to']);
  assert.equal(Reports.definitionFor('edition-bank-statement').columns.find(column => column.key === 'status').required, true);
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

test('le relevé de banque restitue les relevés enregistrés, les erreurs et les liens explicites uniquement', () => {
  const report = Reports.buildReport('edition-bank-statement', options({ bankStatements }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.deepEqual(report.displayStatements.map(statement => statement.id), ['STMT-1', 'STMT-FUTURE'], 'un autre dossier reste exclu');
  assert.deepEqual(report.rows.map(row => [row.statementId, row.lineKey, row.status, row.ledgerReference]), [
    ['STMT-1', 'STMT-1:ROW-INVALID-DATE', 'À contrôler', ''],
    ['STMT-1', 'STMT-1:ROW-3', 'Non pointée', ''],
    ['STMT-1', 'STMT-1:ROW-1', 'Pointée', 'BQ-001'],
    ['STMT-1', 'STMT-1:ROW-2', 'À contrôler', ''],
    ['STMT-FUTURE', 'STMT-FUTURE:ROW-FUTURE', 'Non pointée', '']
  ]);
  assert.deepEqual(report.rows.find(row => row.lineKey === 'STMT-1:ROW-2').rowErrors, ['montant nul ou manquant']);
  assert.equal(report.rows.find(row => row.lineKey === 'STMT-1:ROW-INVALID-DATE').dateValid, false);
  assert.deepEqual(report.rows.find(row => row.lineKey === 'STMT-1:ROW-INVALID-DATE').rowErrors, ['date invalide ou manquante']);
  assert.equal(report.rows.find(row => row.lineKey === 'STMT-1:ROW-3').ledgerReference, '', 'une ligne ressemblante ne crée aucune correspondance automatique');
  assert.equal(report.basis.importedBankStatementRowsOnly, true);
  assert.match(report.warnings.join(' '), /aucun rapprochement n’est simulé/i);
  assert.equal(report.generatedLineCount, 5);

  const selected = Reports.buildReport('edition-bank-statement', options({ bankStatements, accountFilter: '521*', statementId: 'STMT-1' }));
  assert.deepEqual(selected.rows.map(row => row.lineKey), ['STMT-1:ROW-INVALID-DATE', 'STMT-1:ROW-3', 'STMT-1:ROW-1', 'STMT-1:ROW-2']);
  assert.deepEqual(selected.displayStatements.map(statement => statement.id), ['STMT-1']);
  const outsideCycle = Reports.buildReport('edition-bank-statement', options({
    bankStatements, statementId: 'STMT-1', from: '2024-12-01', to: '2025-12-31'
  }));
  assert.equal(outsideCycle.ok, true, outsideCycle.errors.join(' '));
  assert.equal(outsideCycle.rows.some(row => row.lineKey === 'STMT-1:ROW-4'), true, 'un relevé peut être consulté hors des bornes du cycle');
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
