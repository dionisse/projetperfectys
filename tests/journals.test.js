/* Tests du référentiel des journaux et des journaux réservés au système. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const chartSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8');

function createEnvironment() {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const sandbox = { window: { localStorage }, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  vm.createContext(sandbox);
  vm.runInContext(chartSource, sandbox, { filename: 'accounting-chart.js' });
  function loadStore() {
    vm.runInContext(storeSource, sandbox, { filename: 'store.js' });
    return sandbox.window.PerfectoStore;
  }
  return { values, loadStore, store: loadStore() };
}

function entryPayload(journal, reference) {
  return {
    reference,
    journal,
    date: '2026-03-15',
    description: 'Test des journaux',
    lines: [
      { account: '601100', debit: 100, credit: 0 },
      { account: '401100', debit: 0, credit: 100 }
    ]
  };
}

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.message);
    process.exitCode = 1;
  }
}

console.log('Référentiel des journaux');
test('six journaux standards et trois journaux automatiques sont présents dès la création du dossier', () => {
  const { store } = createEnvironment();
  assert.equal(store.journals().length, 9);
  assert.deepEqual(JSON.parse(JSON.stringify(store.journals().filter(record => record.isStandard).map(record => record.code))), ['AC', 'VE', 'BQ', 'CA', 'OD', 'PA']);
  assert.deepEqual(JSON.parse(JSON.stringify(store.journals().filter(record => record.systemManaged).map(record => record.code))), ['AMO', 'ABO', 'RAN']);
  assert.equal(store.journal('amo').systemSource, 'PERFECTO-IMMOBILISATIONS-AMORTISSEMENT');
  assert.equal(store.nextJournalCode(), 'J01');
});

test('une ancienne base à six journaux migre sans réécrire ses écritures', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  const entriesBefore = JSON.stringify(legacy.entries);
  legacy.journals = legacy.journals.filter(record => record.isStandard).map(({ code, label, type }) => ({ code, label, type }));
  legacy.journals.push({
    id: 'journal-previous-custom', code: 'CST', label: 'Journal personnalisé ancien', type: 'Projet',
    referencePrefix: 'PC', description: 'Registre conservé lors de la migration.', active: false
  });
  delete legacy.journalRegistryVersion;
  delete legacy.journalCodeHistory;
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  assert.equal(migrated.journals().length, 10, 'les neuf journaux intégrés et le journal utilisateur historique sont conservés');
  assert.equal(migrated.getState().journalRegistryVersion, 1);
  assert.equal(migrated.journal('CST').origin, 'user');
  assert.equal(migrated.journal('CST').referencePrefix, 'PC');
  assert.equal(migrated.journal('CST').active, false);
  assert.equal(JSON.stringify(migrated.entries()), entriesBefore);
  assert.ok(migrated.getState().journalCodeHistory.includes('AMO'));
});

test('création illimitée par dossier, paramètres libres et préfixe de référence', () => {
  const { store } = createEnvironment();
  const created = store.createJournal({
    code: 'web', label: 'Ventes en ligne', type: 'Canal numérique', referencePrefix: 'WEB',
    description: 'Ventes saisies par l’équipe e-commerce.', active: true
  });
  assert.equal(created.ok, true, created.errors.join(' '));
  assert.equal(created.journal.code, 'WEB');
  assert.equal(created.journal.origin, 'user');
  assert.equal(store.journal('WEB').description, 'Ventes saisies par l’équipe e-commerce.');
  assert.equal(store.nextReference('WEB', '2026-03-15'), 'WEB-2026-001');
  const next = store.createJournal({ code: 'J02', label: 'Journal projet', type: 'Projet', referencePrefix: 'PRJ' });
  assert.equal(next.ok, true, next.errors.join(' '));
  assert.equal(store.journals().filter(record => !record.isStandard && !record.systemManaged).length, 2);
});

test('unicité du code et du préfixe, puis code réservé après suppression', () => {
  const { store } = createEnvironment();
  assert.equal(store.createJournal({ code: 'ac', label: 'Double', type: 'Divers', referencePrefix: 'DBL' }).ok, false);
  assert.equal(store.createJournal({ code: 'J01', label: 'Premier', type: 'Divers', referencePrefix: 'AC' }).ok, false);
  const created = store.createJournal({ code: 'J01', label: 'Journal test', type: 'Divers', referencePrefix: 'TST' });
  assert.equal(created.ok, true, created.errors.join(' '));
  assert.equal(store.deleteJournal(created.journal.id).ok, true);
  assert.equal(store.createJournal({ code: 'J01', label: 'Réutilisation interdite', type: 'Divers', referencePrefix: 'TST2' }).ok, false);
  assert.equal(store.getState().journalCodeHistory.includes('J01'), true);
});

test('les journaux référencés gardent leur code et ne peuvent pas être supprimés', () => {
  const { store } = createEnvironment();
  const created = store.createJournal({ code: 'VTE', label: 'Ventes spéciales', type: 'Vente', referencePrefix: 'VTS' });
  assert.equal(created.ok, true, created.errors.join(' '));
  const payload = entryPayload('VTE', store.nextReference('VTE', '2026-03-15'));
  const draft = store.createEntry(payload, 'draft');
  assert.equal(draft.ok, true, draft.errors.join(' '));
  assert.equal(store.journalEntryCount('VTE'), 1);
  assert.equal(store.nextReference('VTE', '2026-03-15'), 'VTS-2026-002');
  const rename = store.updateJournal('VTE', { code: 'VT2', label: 'Ventes spéciales', type: 'Vente', referencePrefix: 'VTS', description: '', active: true });
  assert.equal(rename.ok, false);
  assert.match(rename.errors.join(' '), /code ne peut plus changer/);
  assert.equal(store.deleteJournal('VTE').ok, false);
  assert.match(store.deleteJournal('VTE').errors.join(' '), /archivez-le/);
});

test('inactivation, modification d’un brouillon existant et refus des nouvelles écritures', () => {
  const { store } = createEnvironment();
  const created = store.createJournal({ code: 'PRJ', label: 'Journal projet', type: 'Projet', referencePrefix: 'PRJ' });
  const draft = store.createEntry(entryPayload('PRJ', store.nextReference('PRJ', '2026-03-15')), 'draft');
  assert.equal(draft.ok, true, draft.errors.join(' '));
  const updated = store.updateJournal('PRJ', {
    code: 'PRJ', label: 'Projet renommé', type: 'Projet interne', referencePrefix: 'PJT', description: 'Suivi interne.', active: false
  });
  assert.equal(updated.ok, true, updated.errors.join(' '));
  assert.equal(store.createEntry(entryPayload('PRJ', 'PJT-2026-001'), 'draft').ok, false);
  const revisedDraft = store.updateDraft(draft.entry.id, entryPayload('PRJ', draft.entry.reference));
  assert.equal(revisedDraft.ok, true, revisedDraft.errors.join(' '));
  assert.equal(store.postEntry(draft.entry.id).ok, true, 'un brouillon déjà enregistré peut encore être validé');
});

test('codes et libellés des journaux standards sont protégés, leurs paramètres restent modifiables', () => {
  const { store } = createEnvironment();
  assert.equal(store.deleteJournal('AC').ok, false);
  const codeChange = store.updateJournal('AC', { code: 'ACH', label: 'Achats', type: 'Achat', referencePrefix: 'AC', active: true });
  assert.equal(codeChange.ok, false);
  const labelChange = store.updateJournal('AC', { code: 'AC', label: 'Achats et frais', type: 'Achat', referencePrefix: 'AC', active: true });
  assert.equal(labelChange.ok, true, labelChange.errors.join(' '));
});

test('les trois journaux système sont non modifiables et refusent saisie/import manuel', () => {
  const { store } = createEnvironment();
  ['AMO', 'ABO', 'RAN'].forEach(code => {
    const record = store.journal(code);
    assert.equal(store.updateJournal(code, { code, label: 'Tentative', type: 'Divers', referencePrefix: code, active: true }).ok, false);
    assert.equal(store.deleteJournal(code).ok, false);
    const manual = store.createEntry(entryPayload(code, store.nextReference(code, '2026-03-15')), 'draft');
    assert.equal(manual.ok, false);
    assert.match(manual.errors.join(' '), /réservé aux écritures générées par le système/);
    const imported = store.previewExchangeImport([{
      reference: code + '-IMPORT-001', journal: code, date: '2026-03-15', description: 'Import interdit',
      sourceSystem: 'EXCEL', sourceId: 'import-test', lines: [
        { account: '601100', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 100 }
      ]
    }], 'draft', { sourceSystem: 'EXCEL', journalMap: { [code]: code } });
    assert.equal(imported.ok, false);
    assert.match(imported.errors.join(' '), /réservé aux écritures générées par le système/);
    const generated = store.createEntry(entryPayload(code, store.nextReference(code, '2026-03-15')), 'draft', { systemSource: record.systemSource });
    assert.equal(generated.ok, true, generated.errors.join(' '));
    assert.equal(store.updateDraft(generated.entry.id, entryPayload(code, generated.entry.reference)).ok, false);
    assert.equal(store.deleteDraft(generated.entry.id).ok, false);
    assert.equal(store.postEntry(generated.entry.id).ok, true, 'un brouillon conforme peut être validé après génération interne');
    store.getState().entries.push({
      id: 'manual-system-' + code, reference: code + '-MANUAL-001', journal: code,
      date: '2026-03-15', description: 'Entrée sans provenance', status: 'draft',
      lines: [{ account: '601100', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 100 }]
    });
    store.save();
    assert.equal(store.postEntry('manual-system-' + code).ok, false);
  });
});

console.log('Journaux : règles, migration, références et protections système — terminé');
