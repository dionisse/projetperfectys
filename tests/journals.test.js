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

function oldReportJournal() {
  return {
    code: 'RAN', label: 'Journal Report à Nouveau', type: 'Automatique', id: 'journal-system-opening-balance',
    referencePrefix: 'RAN', description: 'Réservé au report à nouveau.', active: true,
    origin: 'system', isStandard: false, systemManaged: true,
    systemKey: 'opening-balance', systemSource: 'PERFECTO-REPORT-A-NOUVEAU'
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
test('huit journaux standards et deux journaux automatiques sont présents dès la création du dossier', () => {
  const { store } = createEnvironment();
  assert.equal(store.journals().length, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(store.journals().filter(record => record.isStandard).map(record => record.code))), ['AC', 'VE', 'BQ', 'CA', 'OD', 'PA', 'ABO', 'CEN']);
  assert.deepEqual(JSON.parse(JSON.stringify(store.journals().filter(record => record.systemManaged).map(record => record.code))), ['AMO', 'RPE']);
  assert.equal(store.journal('RAN'), null);
  assert.ok(store.getState().journalCodeHistory.includes('RAN'), 'le code retiré reste réservé');
  assert.equal(store.createJournal({ code: 'RAN', label: 'Tentative de retour', type: 'Divers', referencePrefix: 'RAN2' }).ok, false);
  assert.equal(store.journal('amo').systemSource, 'PERFECTO-IMMOBILISATIONS-AMORTISSEMENT');
  assert.equal(store.journal('ABO').systemSource, '');
  assert.equal(store.journal('CEN').systemSource, '');
  assert.equal(store.journal('ABO').type, 'Abonnement');
  assert.equal(store.journal('CEN').type, 'Centralisation');
  assert.equal(store.journal('ABO').description.includes('aucune écriture n’est générée automatiquement'), true);
  assert.equal(store.journal('CEN').description.includes('tableaux de passage'), true);
  assert.equal(store.journal('rpe').label, 'Journal Résultat de la période');
  assert.deepEqual(JSON.parse(JSON.stringify(store.journalOperationNatures())), [
    'Opérations courantes', 'Amortissements automatiques', 'Abonnements', 'Centralisation',
    'Résultat de l’exercice', 'Inventaire', 'Immobilisations', 'Caisse en temps réel'
  ]);
  assert.equal(store.journal('AMO').operationNature, 'Amortissements automatiques');
  assert.equal(store.journal('ABO').operationNature, 'Abonnements');
  assert.equal(store.journal('CEN').operationNature, 'Centralisation');
  assert.equal(store.journal('RPE').operationNature, 'Résultat de l’exercice');
  assert.equal(store.journal('AC').operationNature, 'Opérations courantes');
  assert.equal(store.journal('AC').authorizedAccounts, '*');
  assert.equal(store.nextJournalCode(), 'J01');
});

test('une ancienne base à six journaux migre sans réécrire ses écritures', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  const entriesBefore = JSON.stringify(legacy.entries);
  legacy.journals = legacy.journals.filter(record => ['AC', 'VE', 'BQ', 'CA', 'OD', 'PA'].includes(record.code)).map(({ code, label, type }) => ({ code, label, type }));
  legacy.journals.push({
    id: 'journal-previous-custom', code: 'CST', label: 'Journal personnalisé ancien', type: 'Projet',
    referencePrefix: 'PC', description: 'Registre conservé lors de la migration.', active: false
  });
  delete legacy.journalRegistryVersion;
  delete legacy.journalCodeHistory;
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  assert.equal(migrated.journals().length, 11, 'les dix journaux intégrés et le journal utilisateur historique sont conservés');
  assert.equal(migrated.getState().journalRegistryVersion, 4);
  assert.equal(migrated.journal('CST').origin, 'user');
  assert.equal(migrated.journal('CST').referencePrefix, 'PC');
  assert.equal(migrated.journal('CST').operationNature, 'Opérations courantes');
  assert.equal(migrated.journal('CST').authorizedAccounts, '*');
  assert.equal(migrated.journal('AC').authorizedAccounts, '*');
  assert.equal(migrated.journal('CST').active, false);
  assert.equal(JSON.stringify(migrated.entries()), entriesBefore);
  assert.ok(migrated.getState().journalCodeHistory.includes('AMO'));
});

test('migration d’un registre v2 ajoute les nouveaux paramètres avec des valeurs compatibles', () => {
  const env = createEnvironment();
  const custom = env.store.createJournal({
    code: 'CST', label: 'Journal historique', type: 'Divers', referencePrefix: 'CST'
  });
  assert.equal(custom.ok, true, custom.errors.join(' '));
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  const entriesBefore = JSON.stringify(legacy.entries);
  legacy.journalRegistryVersion = 2;
  legacy.journals = legacy.journals.map(record => {
    const oldRecord = Object.assign({}, record);
    delete oldRecord.operationNature;
    delete oldRecord.authorizedAccounts;
    return oldRecord;
  });
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  assert.equal(migrated.getState().journalRegistryVersion, 4);
  assert.equal(migrated.journal('CST').operationNature, 'Opérations courantes');
  assert.equal(migrated.journal('CST').authorizedAccounts, '*');
  assert.equal(migrated.journal('AC').authorizedAccounts, '*');
  assert.equal(JSON.stringify(migrated.entries()), entriesBefore);
});

test('migration déclassifie ABO et CEN sans modifier les pièces qui les référencent', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  legacy.journalRegistryVersion = 3;
  legacy.journals = legacy.journals.map(record => {
    if (record.code === 'ABO') return Object.assign({}, record, {
      type: 'Automatique', origin: 'system', isStandard: false, systemManaged: true,
      systemKey: 'recurring-subscriptions', systemSource: 'PERFECTO-ABONNEMENTS',
      description: 'Réservé aux abonnements générés par le système.'
    });
    if (record.code === 'CEN') return Object.assign({}, record, {
      type: 'Automatique', origin: 'system', isStandard: false, systemManaged: true,
      systemKey: 'internal-centralizations', systemSource: 'PERFECTO-CENTRALISATIONS-INTERNES',
      description: 'Réservé aux centralisations produites par le système.'
    });
    return record;
  });
  legacy.entries.push(Object.assign({ id: 'abo-historique', status: 'draft' }, entryPayload('ABO', 'ABO-2026-001')));
  legacy.entries.push(Object.assign({ id: 'cen-historique', status: 'draft' }, entryPayload('CEN', 'CEN-2026-001')));
  const entriesBefore = JSON.stringify(legacy.entries);
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();

  ['ABO', 'CEN'].forEach(code => {
    assert.equal(migrated.journal(code).isStandard, true);
    assert.equal(migrated.journal(code).systemManaged, false);
    assert.equal(migrated.journal(code).origin, 'standard');
    assert.equal(migrated.journal(code).type, code === 'ABO' ? 'Abonnement' : 'Centralisation');
    assert.equal(migrated.journal(code).systemSource, '');
  });
  assert.equal(migrated.getState().journalRegistryVersion, 4);
  assert.equal(JSON.stringify(migrated.entries()), entriesBefore, 'les écritures et leurs références de journal sont conservées à l’identique');
});

test('les journaux ABO et CEN ne sont plus verrouillés comme des journaux système', () => {
  const { store } = createEnvironment();
  ['ABO', 'CEN'].forEach(code => {
    const record = store.journal(code);
    const update = store.updateJournal(code, {
      code, label: record.label, type: record.type, operationNature: record.operationNature,
      referencePrefix: record.referencePrefix, description: record.description, active: true
    });
    assert.equal(update.ok, true, update.errors.join(' '));
    const created = store.createEntry(entryPayload(code, store.nextReference(code, '2026-03-15')), 'draft');
    assert.equal(created.ok, true, created.errors.join(' '));
    if (code === 'CEN') {
      const externalFileImport = store.previewExchangeImport([Object.assign({}, entryPayload('CEN', 'EXT-CEN-001'), {
        sourceId: 'ext-cen-001'
      })], 'draft', { sourceSystem: 'EXCEL' });
      assert.equal(externalFileImport.ok, false);
      assert.match(externalFileImport.errors.join(' '), /transfert interne entre dossiers PERFECTO/);
    }
  });
});

test('migration retire le journal RAN v1 s’il ne porte aucune écriture et réserve son code', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  legacy.journalRegistryVersion = 1;
  legacy.journals.push(oldReportJournal());
  legacy.journalCodeHistory.push('RAN');
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  assert.equal(migrated.journal('RAN'), null);
  assert.ok(migrated.getState().journalCodeHistory.includes('RAN'));
  assert.equal(migrated.getState().journalRegistryVersion, 4);
  assert.equal(migrated.journal('ABO').systemManaged, false);
  assert.equal(migrated.journal('ABO').type, 'Abonnement');
  assert.equal(migrated.journal('CEN').systemManaged, false);
  assert.equal(migrated.journal('CEN').type, 'Centralisation');
  assert.equal(migrated.journal('RPE').systemManaged, true);
});

test('si RAN porte des écritures anciennes, le registre conserve une entrée historique retirée et verrouillée', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  legacy.journalRegistryVersion = 1;
  legacy.journals.push(oldReportJournal());
  legacy.journalCodeHistory.push('RAN');
  legacy.entries.push(Object.assign({ id: 'ran-historique', status: 'draft' }, entryPayload('RAN', 'RAN-2026-900')));
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  const retired = migrated.journal('RAN');
  assert.equal(retired.retired, true);
  assert.equal(retired.systemManaged, false);
  assert.equal(retired.active, false);
  assert.equal(retired.label, 'Ancien journal RAN (historique)');
  assert.equal(migrated.entry('ran-historique').journal, 'RAN');
  assert.equal(migrated.createEntry(entryPayload('RAN', 'RAN-2026-901'), 'draft').ok, false);
  assert.equal(migrated.updateJournal('RAN', { code: 'RAN', label: 'Réactiver', type: 'Divers', referencePrefix: 'RAN', active: true }).ok, false);
  assert.equal(migrated.deleteJournal('RAN').ok, false);
  assert.equal(migrated.updateDraft('ran-historique', entryPayload('RAN', 'RAN-2026-900')).ok, false);
  assert.equal(migrated.deleteDraft('ran-historique').ok, false);
  assert.equal(migrated.postEntry('ran-historique').ok, false);
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

test('les deux journaux système restent non modifiables et refusent saisie/import manuel', () => {
  const { store } = createEnvironment();
  ['AMO', 'RPE'].forEach(code => {
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

test('les natures et comptes autorisés sont normalisés, persistés et restaurés après rechargement', () => {
  const env = createEnvironment();
  const created = env.store.createJournal({
    code: 'VTE', label: 'Ventes ciblées', type: 'Vente', operationNature: 'Inventaire',
    authorizedAccounts: '601100, 401100, 601100', referencePrefix: 'VTC'
  });
  assert.equal(created.ok, true, created.errors.join(' '));
  assert.equal(created.journal.operationNature, 'Inventaire');
  assert.deepEqual(JSON.parse(JSON.stringify(created.journal.authorizedAccounts)), ['601100', '401100']);
  const persisted = env.loadStore();
  assert.deepEqual(JSON.parse(JSON.stringify(persisted.journal('VTE').authorizedAccounts)), ['601100', '401100']);
  assert.equal(persisted.journalAllowsAccount('VTE', '601100'), true);
  assert.equal(persisted.journalAllowsAccount('VTE', '401100'), true);
  assert.equal(persisted.journalAllowsAccount('VTE', '411100'), false);

  const updated = persisted.updateJournal('VTE', {
    code: 'VTE', label: 'Ventes ciblées', type: 'Vente', operationNature: 'Caisse en temps réel',
    authorizedAccounts: '*', referencePrefix: 'VTC', description: 'Paramètres mis à jour.', active: true
  });
  assert.equal(updated.ok, true, updated.errors.join(' '));
  const reloaded = env.loadStore();
  assert.equal(reloaded.journal('VTE').operationNature, 'Caisse en temps réel');
  assert.equal(reloaded.journal('VTE').authorizedAccounts, '*');
  assert.equal(reloaded.journalAllowsAccount('VTE', '411100'), true);
});

test('les comptes autorisés valident les brouillons et sont revérifiés au moment de la validation', () => {
  const { store } = createEnvironment();
  const created = store.createJournal({
    code: 'LIM', label: 'Journal limité', type: 'Divers', operationNature: 'Opérations courantes',
    authorizedAccounts: '601100', referencePrefix: 'LIM'
  });
  assert.equal(created.ok, true, created.errors.join(' '));
  const denied = store.createEntry(entryPayload('LIM', 'LIM-2026-001'), 'draft');
  assert.equal(denied.ok, false);
  assert.match(denied.errors.join(' '), /401100 n’est pas autorisé/);

  const widened = store.updateJournal('LIM', {
    code: 'LIM', label: 'Journal limité', type: 'Divers', operationNature: 'Opérations courantes',
    authorizedAccounts: '601100, 401100', referencePrefix: 'LIM', active: true
  });
  assert.equal(widened.ok, true, widened.errors.join(' '));
  const draft = store.createEntry(entryPayload('LIM', 'LIM-2026-002'), 'draft');
  assert.equal(draft.ok, true, draft.errors.join(' '));

  const narrowed = store.updateJournal('LIM', {
    code: 'LIM', label: 'Journal limité', type: 'Divers', operationNature: 'Opérations courantes',
    authorizedAccounts: '601100', referencePrefix: 'LIM', active: true
  });
  assert.equal(narrowed.ok, true, narrowed.errors.join(' '));
  const posted = store.postEntry(draft.entry.id);
  assert.equal(posted.ok, false);
  assert.match(posted.errors.join(' '), /401100 n’est pas autorisé/);
});

test('création d’un journal refuse une nature ou une liste de comptes invalide', () => {
  const { store } = createEnvironment();
  const input = { code: 'BAD', label: 'Journal invalide', type: 'Divers', referencePrefix: 'BAD' };
  assert.equal(store.createJournal(Object.assign({}, input, { operationNature: 'Nature inconnue' })).ok, false);
  ['601100,', '601100,abc', '*, 601100', ''].forEach(accounts => {
    const result = store.createJournal(Object.assign({}, input, {
      code: 'BAD' + (accounts ? String(accounts.length) : '0'),
      referencePrefix: 'B' + (accounts ? String(accounts.length) : '0'),
      authorizedAccounts: accounts
    }));
    assert.equal(result.ok, false, 'liste invalide acceptée : ' + accounts);
  });
});

console.log('Journaux : règles, migration, références et protections système — terminé');
