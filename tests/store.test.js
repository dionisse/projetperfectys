/*
 * Tests des règles métier de PERFECTO (Lot 1), sans dépendance externe.
 * Exécution : node tests/store.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const stored = {};
const sandbox = {
  window: {},
  localStorage: {
    getItem: (key) => (key in stored ? stored[key] : null),
    setItem: (key, value) => { stored[key] = String(value); },
    removeItem: (key) => { delete stored[key]; }
  },
  Intl,
  console,
  JSON,
  Date,
  Math,
  String,
  Number,
  Object,
  Array
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'),
  sandbox,
  { filename: 'store.js' }
);

const S = sandbox.window.PerfectoStore;
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.message);
    process.exitCode = 1;
  }
}

console.log('Référentiel de démonstration');
test('18 comptes, 6 journaux, 3 pièces validées et 1 brouillon', () => {
  assert.strictEqual(S.accounts().length, 18);
  assert.strictEqual(S.journals().length, 6);
  assert.strictEqual(S.postedEntries().length, 3);
  assert.strictEqual(S.entries().filter((e) => e.status === 'draft').length, 1);
});

test('mouvements validés équilibrés à 2 832 000 XOF', () => {
  const k = S.kpis();
  assert.strictEqual(k.debit, 2832000);
  assert.strictEqual(k.credit, 2832000);
  assert.strictEqual(k.resultat, 242000);
  assert.strictEqual(k.tresorerie, 1500000);
});

console.log('Pièces et contrôles');
test('référence proposée par journal', () => {
  assert.strictEqual(S.nextReference('AC', '2026-03-01'), 'AC-2026-002');
  assert.strictEqual(S.nextReference('BQ', '2026-03-01'), 'BQ-2026-002');
});

test('pièce équilibrée acceptée en validation', () => {
  const result = S.createEntry({
    reference: 'OD-2026-101', journal: 'OD', date: '2026-03-10', description: 'Test',
    lines: [
      { account: '601100', debit: 150000, credit: 0 },
      { account: '401100', debit: 0, credit: 150000 }
    ]
  }, 'posted');
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  assert.strictEqual(result.entry.status, 'posted');
});

test('référence en doublon refusée', () => {
  const result = S.createEntry({
    reference: 'OD-2026-101', journal: 'OD', date: '2026-03-11',
    lines: [
      { account: '601100', debit: 1, credit: 0 },
      { account: '401100', debit: 0, credit: 1 }
    ]
  }, 'draft');
  assert.strictEqual(result.ok, false);
});

test('pièce déséquilibrée refusée à la validation', () => {
  const result = S.createEntry({
    reference: 'OD-2026-102', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 100, credit: 0 },
      { account: '401100', debit: 0, credit: 90 }
    ]
  }, 'posted');
  assert.strictEqual(result.ok, false);
});

test('débit et crédit simultanés sur une ligne refusés', () => {
  const result = S.validateEntry({
    reference: 'OD-2026-103', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 10, credit: 10 },
      { account: '401100', debit: 0, credit: 10 }
    ]
  }, { requireBalanced: true });
  assert.strictEqual(result.ok, false);
});

test('ligne vide ignorée', () => {
  const result = S.validateEntry({
    reference: 'OD-2026-104', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 1000, credit: 0 },
      { account: '401100', debit: 0, credit: 1000 },
      { account: '', debit: '', credit: '' }
    ]
  }, { requireBalanced: true });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
});

console.log('Périodes');
test('période clôturée refuse la saisie', () => {
  S.setPeriod(2026, 4, 'closed');
  const result = S.createEntry({
    reference: 'OD-2026-105', journal: 'OD', date: '2026-04-15',
    lines: [
      { account: '601100', debit: 50, credit: 0 },
      { account: '401100', debit: 0, credit: 50 }
    ]
  }, 'draft');
  assert.strictEqual(result.ok, false);
  S.setPeriod(2026, 4, 'open');
});

test('période clôturée refuse la validation d’un brouillon', () => {
  const draft = S.createEntry({
    reference: 'OD-2026-106', journal: 'OD', date: '2026-05-15',
    lines: [
      { account: '622100', debit: 7000, credit: 0 },
      { account: '401100', debit: 0, credit: 7000 }
    ]
  }, 'draft');
  assert.strictEqual(draft.ok, true, draft.errors.join(' '));
  S.setPeriod(2026, 5, 'closed');
  const posted = S.postEntry(draft.entry.id);
  assert.strictEqual(posted.ok, false);
  S.setPeriod(2026, 5, 'open');
  assert.strictEqual(S.postEntry(draft.entry.id).ok, true);
});

console.log('Brouillons et états');
test('validation d’un brouillon puis immuabilité', () => {
  const draft = S.createEntry({
    reference: 'OD-2026-107', journal: 'OD', date: '2026-06-05', description: 'Brouillon',
    lines: [
      { account: '622100', debit: 5000, credit: 0 },
      { account: '401100', debit: 0, credit: 5000 }
    ]
  }, 'draft');
  assert.strictEqual(draft.ok, true);
  assert.strictEqual(S.postEntry(draft.entry.id).ok, true);
  assert.strictEqual(S.deleteDraft(draft.entry.id).ok, false);
});

test('brouillons exclus de la balance', () => {
  const draftTotal = S.entries()
    .filter((e) => e.status === 'draft')
    .reduce((sum, e) => sum + S.totals(e.lines).debit, 0);
  const debit = S.balance().reduce((sum, r) => sum + r.debit, 0);
  const postedTotal = S.postedEntries().reduce((sum, e) => sum + S.totals(e.lines).debit, 0);
  assert.strictEqual(debit, postedTotal);
  assert.ok(draftTotal > 0);
});

test('grand livre : solde progressif cohérent', () => {
  const ledger = S.ledger('401100');
  const total = ledger.rows.reduce((sum, row) => sum + row.debit - row.credit, 0);
  assert.strictEqual(ledger.balance, total);
  assert.strictEqual(ledger.rows[ledger.rows.length - 1].balance, total);
});

console.log('Plan comptable et sauvegarde');
test('ajout de compte avec code unique', () => {
  const added = S.addAccount({ code: '601200', label: 'Achats de matières premières', nature: 'Charge' });
  assert.strictEqual(added.ok, true, added.errors.join(' '));
  assert.strictEqual(S.accounts().length, 19);
  const duplicate = S.addAccount({ code: '601200', label: 'Doublon', nature: 'Charge' });
  assert.strictEqual(duplicate.ok, false);
});

test('export puis import JSON', () => {
  const json = S.exportJson();
  const imported = S.importJson(json);
  assert.strictEqual(imported.ok, true, imported.errors.join(' '));
  assert.strictEqual(S.kpis().debit, S.kpis().credit);
});

test('import d’un fichier invalide refusé', () => {
  const result = S.importJson('{"foo":42}');
  assert.strictEqual(result.ok, false);
});

test('point de restauration local avant remplacement et restauration', () => {
  const before = S.getState();
  const beforeSummary = { accounts: before.accounts.length, entries: before.entries.length, debit: S.kpis().debit };
  S.reset();
  const backup = S.backupInfo();
  assert.strictEqual(backup.available, true);
  assert.strictEqual(backup.accountCount, beforeSummary.accounts);
  assert.strictEqual(backup.entryCount, beforeSummary.entries);
  const restored = S.restoreBackup();
  assert.strictEqual(restored.ok, true, restored.errors.join(' '));
  assert.strictEqual(S.accounts().length, beforeSummary.accounts);
  assert.strictEqual(S.entries().length, beforeSummary.entries);
  assert.strictEqual(S.kpis().debit, beforeSummary.debit);
});

console.log('');
if (process.exitCode) {
  console.error('Échec des tests.');
} else {
  console.log(passed + ' tests réussis.');
}
