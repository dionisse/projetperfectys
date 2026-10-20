'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness(initialValues = {}) {
  const values = Object.assign(Object.create(null), initialValues);
  const sandbox = {
    window: {},
    localStorage: {
      getItem(key) { return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null; },
      setItem(key, value) { values[key] = String(value); },
      removeItem(key) { delete values[key]; }
    },
    Intl, console, JSON, Date, Math, String, Number, Object, Array, RegExp, Map, Set
  };
  sandbox.window.localStorage = sandbox.localStorage;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  ['accounting-chart.js', 'store.js', 'opening-balances.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return { S: sandbox.window.PerfectoStore, OpeningBalances: sandbox.window.PerfectoOpeningBalances, values, sandbox };
}

function account(code, cls, aux = false) {
  return { code, cls, aux, postable: true, active: true, label: 'Compte ' + code };
}

function sourceFixture(overrides = {}) {
  const accounts = [
    account('101', 1), account('401', 4, true), account('411', 4, true), account('521', 5),
    account('601', 6), account('701', 7)
  ];
  const sourceDossier = {
    id: 'dossier-2025', clientCode: 'GOD', accountingTypeCode: 'COR',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', exerciseYear: 2025,
    reference: 'COR-GOD2025'
  };
  const targetDossier = {
    id: 'dossier-2026', clientCode: 'GOD', accountingTypeCode: 'COR',
    cycleStart: '2026-01-01', cycleEnd: '2026-12-31', exerciseYear: 2026,
    reference: 'COR-GOD2026'
  };
  const state = {
    exercise: 2025,
    cycleStart: sourceDossier.cycleStart,
    cycleEnd: sourceDossier.cycleEnd,
    accounts,
    openingBalances: [
      { id: 'RAN-2025-0001', accountCode: '101', date: '2024-12-31', debit: 0, credit: 100, reference: 'CAP-01', label: 'Report capital' },
      { id: 'RAN-2025-0002', accountCode: '401', date: '2024-12-31', debit: 0, credit: 50, reference: 'FAC-08', label: 'Facture fournisseur', thirdParty: 'FOU-008 · Fournisseur A', dueDate: '2025-02-15' },
      { id: 'RAN-2025-0003', accountCode: '521', date: '2024-12-31', debit: 150, credit: 0, reference: 'BAN-01', label: 'Report banque' }
    ],
    entries: [
      { id: 'E1', date: '2025-03-10', status: 'posted', reference: 'OD-001', description: 'Règlement fournisseur', lines: [
        { account: '401', debit: 10, credit: 0 }, { account: '521', debit: 0, credit: 10 }
      ] },
      { id: 'E2', date: '2025-04-11', status: 'posted', reference: 'BQ-002', description: 'Dépôt banque', lines: [
        { account: '521', debit: 7, credit: 0 }, { account: '101', debit: 0, credit: 7 }
      ] },
      { id: 'E3', date: '2025-06-14', status: 'posted', reference: 'VTE-003', description: 'Facture client', lines: [
        { account: '411', debit: 25, credit: 0 }, { account: '101', debit: 0, credit: 25 }
      ] },
      { id: 'E4A', date: '2025-07-02', status: 'posted', reference: 'LET-01', description: 'Lettrage égal', lines: [
        { account: '401', debit: 5, credit: 0 }, { account: '101', debit: 0, credit: 5 }
      ] },
      { id: 'E4B', date: '2025-07-03', status: 'posted', reference: 'LET-02', description: 'Lettrage égal', lines: [
        { account: '401', debit: 0, credit: 5 }, { account: '101', debit: 5, credit: 0 }
      ] },
      { id: 'DRAFT', date: '2025-12-01', status: 'draft', reference: 'OD-DRAFT', lines: [
        { account: '101', debit: 999, credit: 0 }, { account: '521', debit: 0, credit: 999 }
      ] },
      { id: 'RESULT', date: '2025-12-02', status: 'posted', reference: 'OD-RESULT', lines: [
        { account: '601', debit: 999, credit: 0 }, { account: '701', debit: 0, credit: 999 }
      ] }
    ],
    matchingGroups: [{ id: 'LET-1', code: 'L1', accountCode: '401', lineKeys: ['E4A:0', 'E4B:0'], debit: 5, credit: 5, status: 'active' }],
    pointageMarks: [{ id: 'P1', code: 'PNT-1', entryId: 'E2', lineIndex: 0, lineKey: 'E2:0', accountCode: '521', status: 'pointed' }]
  };
  return {
    state: Object.assign(state, overrides.state || {}),
    accounts: overrides.accounts || accounts,
    sourceDossier: overrides.sourceDossier || sourceDossier,
    targetDossier: overrides.targetDossier || targetDossier
  };
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

console.log('Reports à nouveau · calcul, maintenance, transfert relançable et isolation');

test('le calcul reprend les soldes de bilan, exclut brouillons et comptes 6–8, détaille auxiliaires et pointages', () => {
  const h = createHarness();
  const fixture = sourceFixture();
  const before = JSON.stringify(fixture.state);
  const result = h.OpeningBalances.buildTransfer(fixture.state, fixture.sourceDossier, fixture.targetDossier, fixture.accounts);
  assert.equal(result.ok, true, result.errors.join(' '));
  assert.equal(result.balanced, true);
  assert.equal(result.totals.debit, 192);
  assert.equal(result.totals.credit, 192);
  assert.equal(result.accountBalances['101'], -132);
  assert.equal(result.accountBalances['401'], -40);
  assert.equal(result.accountBalances['411'], 25);
  assert.equal(result.accountBalances['521'], 147);
  assert.equal(result.reportDate, '2025-12-31');
  assert.equal(result.rows.some(row => row.accountCode === '601' || row.accountCode === '701'), false);
  assert.equal(result.rows.some(row => row.reference === 'OD-DRAFT'), false);
  const supplierLines = result.rows.filter(row => row.accountCode === '401');
  assert.equal(supplierLines.length, 2, 'les lignes lettrées à solde net nul sont exclues du détail');
  assert.ok(supplierLines.some(row => row.thirdParty === 'FOU-008 · Fournisseur A' && row.dueDate === '2025-02-15'), 'le tiers et l’échéance documentaire sont conservés');
  const bankRows = result.rows.filter(row => row.accountCode === '521');
  assert.equal(bankRows.length, 3, 'report initial, mouvement non pointé et solde pointé séparé');
  assert.ok(bankRows.some(row => row.label.includes('mouvements pointés') && row.debit === 7));
  assert.equal(JSON.stringify(fixture.state), before, 'le calcul n’altère pas les données source');
});

test('la configuration lettrable du dossier cible entraîne le détail des écritures non lettrées', () => {
  const h = createHarness();
  const fixture = sourceFixture();
  const targetAccounts = fixture.accounts.map(item => Object.assign({}, item));
  fixture.state.accounts.find(item => item.code === '401').aux = false;
  targetAccounts.find(item => item.code === '401').aux = true;
  const result = h.OpeningBalances.buildTransfer(fixture.state, fixture.sourceDossier, fixture.targetDossier, targetAccounts);
  assert.equal(result.ok, true, result.errors.join(' '));
  assert.equal(result.rows.filter(row => row.accountCode === '401').length, 2);
});

test('le registre de reports est ajouté par migration sans perdre les données déjà enregistrées', () => {
  const first = createHarness();
  const S = first.S;
  const date = S.expectedOpeningBalanceDate();
  const accountRecord = S.accounts().find(item => Number(item.cls) === 1 && item.postable !== false);
  const saved = S.createOpeningBalance({ accountCode: accountRecord.code, date, debit: 0, credit: 50, reference: 'MIG-1', label: 'Report pré-migration' });
  assert.equal(saved.ok, true, saved.errors.join(' '));
  const key = S.currentStorageKey();
  const raw = JSON.parse(first.values[key]);
  delete raw.openingBalanceRegistryVersion;
  delete raw.openingBalanceSequence;
  delete raw.openingBalanceTransfers;
  first.values[key] = JSON.stringify(raw);
  const migrated = createHarness(first.values).S.getState();
  assert.equal(migrated.openingBalanceRegistryVersion, 1);
  assert.equal(migrated.openingBalances.length, 1);
  assert.equal(migrated.openingBalances[0].id, saved.openingBalance.id);
  assert.equal(migrated.openingBalances[0].reference, 'MIG-1');
  assert.equal(migrated.openingBalanceSequence, 2);
  assert.deepEqual(Array.from(migrated.openingBalanceTransfers), []);
});

test('le calcul bloque une rupture de cycle, un compte cible manquant et un transfert déséquilibré', () => {
  const h = createHarness();
  const fixture = sourceFixture();
  const wrongCycle = Object.assign({}, fixture.targetDossier, { cycleStart: '2026-02-01' });
  const cycleResult = h.OpeningBalances.buildTransfer(fixture.state, fixture.sourceDossier, wrongCycle, fixture.accounts);
  assert.equal(cycleResult.ok, false);
  assert.ok(cycleResult.errors.some(error => error.includes('veille')));
  const missingAccount = h.OpeningBalances.buildTransfer(fixture.state, fixture.sourceDossier, fixture.targetDossier, fixture.accounts.filter(item => item.code !== '101'));
  assert.equal(missingAccount.ok, false);
  assert.ok(missingAccount.errors.some(error => error.includes('101')));
  const unbalancedState = JSON.parse(JSON.stringify(fixture.state));
  unbalancedState.openingBalances[0].credit = 101;
  const unbalanced = h.OpeningBalances.buildTransfer(unbalancedState, fixture.sourceDossier, fixture.targetDossier, fixture.accounts);
  assert.equal(unbalanced.ok, false);
  assert.equal(unbalanced.balanced, false);
  assert.ok(unbalanced.errors.some(error => error.includes('équilibré')));
});

test('une première ouverture peut insérer et contrôler manuellement des lignes de bilan', () => {
  const h = createHarness();
  const S = h.S;
  const dossier = S.currentDossier();
  const date = S.expectedOpeningBalanceDate();
  const classOne = S.accounts().find(item => Number(item.cls) === 1 && item.postable !== false);
  const classFive = S.accounts().find(item => Number(item.cls) === 5 && item.postable !== false);
  assert.ok(classOne && classFive);
  const rejected = S.createOpeningBalance({ accountCode: '601100', date, debit: 25, credit: 0, label: 'Compte de charge' });
  assert.equal(rejected.ok, false, 'les comptes de résultat sont exclus');
  const credit = S.createOpeningBalance({ accountCode: classOne.code, date, reference: 'INIT-1', debit: 0, credit: 100, label: 'Capital initial' });
  assert.equal(credit.ok, true, credit.errors.join(' '));
  const debit = S.createOpeningBalance({ accountCode: classFive.code, date, reference: 'INIT-2', debit: 100, credit: 0, label: 'Banque initiale' });
  assert.equal(debit.ok, true, debit.errors.join(' '));
  assert.equal(S.auditOpeningBalances().balanced, true);
  const modified = S.updateOpeningBalance(credit.openingBalance.id, {
    accountCode: classOne.code, date, reference: 'INIT-1A', debit: 0, credit: 120, label: 'Capital initial modifié'
  });
  assert.equal(modified.ok, true, modified.errors.join(' '));
  assert.equal(S.openingBalance(credit.openingBalance.id).reference, 'INIT-1A');
  assert.equal(S.deleteOpeningBalance(debit.openingBalance.id).ok, true);
  assert.equal(S.openingBalances().length, 1);
  assert.equal(S.auditOpeningBalances().balanced, false, 'le contrôle signale le déséquilibre sans créer de compte d’équilibre');
});

test('la lecture d’un exercice antérieur est non destructive et n’active pas le dossier source', () => {
  const h = createHarness();
  const S = h.S;
  const target = S.currentDossier();
  const sourceResult = S.createDossier({
    clientName: target.clientName,
    clientCode: target.clientCode,
    accountingTypeLabel: target.accountingTypeLabel,
    accountingTypeCode: target.accountingTypeCode,
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31'
  });
  assert.equal(sourceResult.ok, true, sourceResult.errors.join(' '));
  assert.equal(S.switchDossier(sourceResult.dossier.id).ok, true);
  const sourceState = S.getState();
  const classOne = S.accounts().find(item => Number(item.cls) === 1 && item.postable !== false);
  const classFive = S.accounts().find(item => Number(item.cls) === 5 && item.postable !== false);
  sourceState.openingBalances = [
    { id: 'RAN-2025-0001', accountCode: classOne.code, date: '2024-12-31', debit: 0, credit: 100, reference: 'CAP-01', label: 'Capital' },
    { id: 'RAN-2025-0002', accountCode: classFive.code, date: '2024-12-31', debit: 100, credit: 0, reference: 'BAN-01', label: 'Banque' }
  ];
  assert.equal(S.save(), true);
  const sourceKey = S.currentStorageKey();
  const storedBeforeRead = h.values[sourceKey];
  assert.equal(S.switchDossier(target.id).ok, true);
  const currentKeyBeforeRead = S.currentStorageKey();
  const sameDossierRead = S.readDossierStateSnapshot(target.id);
  assert.equal(sameDossierRead.ok, false, 'le dossier actif ne peut pas servir de source à son propre report');
  const snapshot = S.readDossierStateSnapshot(sourceResult.dossier.id);
  assert.equal(snapshot.ok, true, (snapshot.errors || []).join(' '));
  assert.equal(snapshot.state.exercise, 2025);
  assert.equal(S.currentDossier().id, target.id, 'la lecture source ne change pas le dossier actif');
  assert.equal(S.currentStorageKey(), currentKeyBeforeRead);
  assert.equal(h.values[sourceKey], storedBeforeRead, 'la base source reste strictement identique après lecture');
});

test('le transfert remplace seulement les soldes changés et préserve les lettrages/pointages courants', () => {
  const h = createHarness();
  const S = h.S;
  const OpeningBalances = h.OpeningBalances;
  const target = S.currentDossier();
  const sourceResult = S.createDossier({
    clientName: target.clientName, clientCode: target.clientCode,
    accountingTypeLabel: target.accountingTypeLabel, accountingTypeCode: target.accountingTypeCode,
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31'
  });
  assert.equal(sourceResult.ok, true, sourceResult.errors.join(' '));
  assert.equal(S.switchDossier(sourceResult.dossier.id).ok, true);
  const sourceState = S.getState();
  const classOne = S.accounts().find(item => Number(item.cls) === 1 && item.postable !== false);
  const classTwo = S.accounts().find(item => Number(item.cls) === 2 && item.postable !== false);
  const classFive = S.accounts().find(item => Number(item.cls) === 5 && item.postable !== false);
  const aux = S.accounts().find(item => Number(item.cls) === 4 && item.aux === true && item.postable !== false);
  assert.ok(classOne && classTwo && classFive && aux);
  sourceState.openingBalances = [
    { id: 'RAN-2025-0001', accountCode: classOne.code, date: '2024-12-31', debit: 0, credit: 100, reference: 'CAP-01', label: 'Capital' },
    { id: 'RAN-2025-0002', accountCode: classFive.code, date: '2024-12-31', debit: 100, credit: 0, reference: 'BAN-01', label: 'Banque' },
    { id: 'RAN-2025-0003', accountCode: aux.code, date: '2024-12-31', debit: 0, credit: 20, reference: 'FOU-01', label: 'Facture à payer', thirdParty: 'Fournisseur', dueDate: '2025-02-10' },
    { id: 'RAN-2025-0004', accountCode: classTwo.code, date: '2024-12-31', debit: 20, credit: 0, reference: 'IMMO-01', label: 'Immobilisation' }
  ];
  assert.equal(S.save(), true);
  assert.equal(S.switchDossier(target.id).ok, true);
  const targetState = S.getState();
  targetState.matchingGroups = [{ id: 'keep-letter', code: 'LET-2026-0098', accountCode: '401100', lineKeys: ['entry-x:0', 'entry-y:0'], debit: 1, credit: 1, status: 'active' }];
  targetState.pointageMarks = [{ id: 'keep-point', code: 'PNT-2026-0098', entryId: 'entry-x', lineIndex: 0, lineKey: 'entry-x:0', accountCode: '521100', statementDate: '2026-01-31', status: 'pointed' }];
  assert.equal(S.save(), true);
  let matchingBefore = JSON.stringify(S.matchingGroups());
  let pointageBefore = JSON.stringify(S.pointageMarks());
  let sourceSnapshot = S.readDossierStateSnapshot(sourceResult.dossier.id);
  let plan = OpeningBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, target, S.accounts());
  assert.equal(plan.ok, true, plan.errors.join(' '));
  const firstTransfer = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(firstTransfer.ok, true, firstTransfer.errors.join(' '));
  assert.ok(firstTransfer.addedRows >= 3);
  const firstRows = S.openingBalances().filter(row => row.origin === 'transfer');
  const firstIds = firstRows.map(row => row.id).sort();
  assert.ok(firstRows.some(row => row.accountCode === aux.code && row.thirdParty === 'Fournisseur' && row.dueDate === '2025-02-10'));
  assert.equal(JSON.stringify(S.matchingGroups()), matchingBefore);
  assert.equal(JSON.stringify(S.pointageMarks()), pointageBefore);
  const rerun = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(rerun.ok, true, rerun.errors.join(' '));
  assert.equal(rerun.addedRows, 0, 'un retraitransfert sans variation ne duplique pas les reports');
  assert.deepEqual(S.openingBalances().filter(row => row.origin === 'transfer').map(row => row.id).sort(), firstIds);
  assert.equal(JSON.stringify(S.matchingGroups()), matchingBefore);
  assert.equal(JSON.stringify(S.pointageMarks()), pointageBefore);

  // Supprimer toutes les lignes d’un compte force le détail même si son solde est inchangé.
  const existingAuxRows = S.openingBalances().filter(row => row.origin === 'transfer' && row.accountCode === aux.code);
  existingAuxRows.forEach(row => assert.equal(S.deleteOpeningBalance(row.id).ok, true));
  const forcedPreview = S.openingBalanceTransferPreview(sourceResult.dossier.id, plan.accountBalances, plan.rows);
  const forcedDecision = forcedPreview.decisions.find(item => item.accountCode === aux.code);
  assert.equal(forcedDecision.action, 'replace');
  assert.ok(forcedDecision.reason.includes('forcé'));
  const forcedTransfer = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(forcedTransfer.ok, true, forcedTransfer.errors.join(' '));
  assert.ok(S.openingBalances().some(row => row.origin === 'transfer' && row.accountCode === aux.code));

  // L’actualisation d’un solde source remplace uniquement la ligne transférée de ce compte.
  assert.equal(S.switchDossier(sourceResult.dossier.id).ok, true);
  const changedSourceState = S.getState();
  changedSourceState.openingBalances.find(row => row.accountCode === classOne.code).credit = 120;
  changedSourceState.openingBalances.find(row => row.accountCode === classFive.code).debit = 120;
  assert.equal(S.save(), true);
  assert.equal(S.switchDossier(target.id).ok, true);
  matchingBefore = JSON.stringify(S.matchingGroups());
  pointageBefore = JSON.stringify(S.pointageMarks());
  sourceSnapshot = S.readDossierStateSnapshot(sourceResult.dossier.id);
  plan = OpeningBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, target, S.accounts());
  assert.equal(plan.ok, true, plan.errors.join(' '));
  const refresh = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(refresh.ok, true, refresh.errors.join(' '));
  assert.ok(S.openingBalances().some(row => row.origin === 'transfer' && row.accountCode === classOne.code && row.credit === 120));
  assert.equal(JSON.stringify(S.matchingGroups()), matchingBefore);
  assert.equal(JSON.stringify(S.pointageMarks()), pointageBefore);

  // Une ligne modifiée manuellement reste protégée lorsque le solde source change.
  const transferredCapital = S.openingBalances().find(row => row.origin === 'transfer' && row.accountCode === classOne.code);
  const adjusted = S.updateOpeningBalance(transferredCapital.id, {
    accountCode: classOne.code, date: '2025-12-31', reference: 'CAP-MANUEL', debit: 0, credit: 125, label: 'Ajustement contrôlé'
  });
  assert.equal(adjusted.ok, true, adjusted.errors.join(' '));
  assert.equal(S.switchDossier(sourceResult.dossier.id).ok, true);
  const nextSourceState = S.getState();
  nextSourceState.openingBalances.find(row => row.accountCode === classOne.code).credit = 130;
  nextSourceState.openingBalances.find(row => row.accountCode === classFive.code).debit = 130;
  assert.equal(S.save(), true);
  assert.equal(S.switchDossier(target.id).ok, true);
  sourceSnapshot = S.readDossierStateSnapshot(sourceResult.dossier.id);
  plan = OpeningBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, target, S.accounts());
  assert.equal(plan.ok, true, plan.errors.join(' '));
  const protectedTransfer = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(protectedTransfer.ok, true, protectedTransfer.errors.join(' '));
  assert.equal(S.openingBalance(transferredCapital.id).origin, 'manual-adjusted');
  assert.equal(S.openingBalance(transferredCapital.id).credit, 125, 'le report modifié n’est pas écrasé');
  assert.ok(protectedTransfer.conflicts.some(item => item.accountCode === classOne.code));
  assert.equal(JSON.stringify(S.matchingGroups()), matchingBefore);
  assert.equal(JSON.stringify(S.pointageMarks()), pointageBefore);
});

test('un solde devenu nul retire les anciennes lignes transférées sans exiger de lignes entrantes', () => {
  const h = createHarness();
  const S = h.S;
  const target = S.currentDossier();
  const sourceResult = S.createDossier({
    clientName: target.clientName, clientCode: target.clientCode,
    accountingTypeLabel: target.accountingTypeLabel, accountingTypeCode: target.accountingTypeCode,
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31'
  });
  assert.equal(sourceResult.ok, true, sourceResult.errors.join(' '));
  assert.equal(S.switchDossier(sourceResult.dossier.id).ok, true);
  const sourceState = S.getState();
  const classOne = S.accounts().find(item => Number(item.cls) === 1 && item.postable !== false);
  const classFive = S.accounts().find(item => Number(item.cls) === 5 && item.postable !== false);
  sourceState.openingBalances = [
    { id: 'RAN-2025-0091', accountCode: classOne.code, date: '2024-12-31', debit: 0, credit: 100, reference: 'CAP-Z', label: 'Capital' },
    { id: 'RAN-2025-0092', accountCode: classFive.code, date: '2024-12-31', debit: 100, credit: 0, reference: 'BAN-Z', label: 'Banque' }
  ];
  assert.equal(S.save(), true);
  assert.equal(S.switchDossier(target.id).ok, true);
  const sourceDossier = sourceResult.dossier;
  let sourceSnapshot = S.readDossierStateSnapshot(sourceDossier.id);
  let plan = h.OpeningBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, target, S.accounts());
  assert.equal(plan.ok, true, plan.errors.join(' '));
  assert.equal(S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan).ok, true);
  assert.ok(S.openingBalances().some(row => row.origin === 'transfer'));

  assert.equal(S.switchDossier(sourceDossier.id).ok, true);
  S.getState().openingBalances = [];
  S.getState().entries = [];
  assert.equal(S.save(), true);
  assert.equal(S.switchDossier(target.id).ok, true);
  sourceSnapshot = S.readDossierStateSnapshot(sourceDossier.id);
  plan = h.OpeningBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, target, S.accounts());
  assert.equal(plan.ok, true, plan.errors.join(' '));
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.balanced, true);
  const preview = S.openingBalanceTransferPreview(sourceDossier.id, plan.accountBalances, plan.rows);
  assert.ok(preview.replaceCount > 0);
  const result = S.applyOpeningBalanceTransfer(sourceSnapshot.dossier, plan);
  assert.equal(result.ok, true, result.errors.join(' '));
  assert.equal(S.openingBalances().filter(row => row.origin === 'transfer').length, 0);
  assert.ok(result.removedRows > 0);
});

console.log('Reports à nouveau : transferts contrôlés, idempotence et préservation des rapprochements — OK');
