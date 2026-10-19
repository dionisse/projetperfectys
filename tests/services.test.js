/* Tests du référentiel local des prestations. */
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

console.log('Référentiel des prestations');
test('création, normalisation et persistance par dossier', () => {
  const env = createEnvironment();
  const created = env.store.createService({ name: 'Conseil en gestion', description: 'Accompagnement ponctuel.' });
  assert.equal(created.ok, true, created.errors.join(' '));
  assert.equal(created.service.code, 'PRE-0001');
  assert.equal(env.store.nextServiceCode(), 'PRE-0002');
  const reloaded = env.loadStore();
  assert.equal(reloaded.services().length, 1);
  assert.equal(reloaded.service('pre-0001').name, 'Conseil en gestion');
  assert.equal(reloaded.service('PRE-0001').description, 'Accompagnement ponctuel.');
});

test('modification, archivage, réactivation et suppression sans réutiliser le code', () => {
  const { store } = createEnvironment();
  const created = store.createService({ code: 'ETUDE', name: 'Étude technique' });
  assert.equal(created.ok, true, created.errors.join(' '));
  const updated = store.updateService(created.service.id, {
    code: 'ETUDE-CLIENT', name: 'Étude technique personnalisée', description: 'Périmètre défini avec le client.'
  });
  assert.equal(updated.ok, true, updated.errors.join(' '));
  assert.equal(updated.service.code, 'ETUDE-CLIENT');
  assert.equal(store.setServiceActive(created.service.id, false).service.active, false);
  assert.equal(store.setServiceActive(created.service.id, true).service.active, true);
  assert.equal(store.deleteService(created.service.id).ok, true);
  assert.equal(store.service('ETUDE-CLIENT'), null);
  assert.ok(store.getState().serviceCodeHistory.includes('ETUDE'));
  assert.ok(store.getState().serviceCodeHistory.includes('ETUDE-CLIENT'));
  assert.equal(store.createService({ code: 'ETUDE', name: 'Réutilisation interdite' }).ok, false);
  assert.equal(store.nextServiceCode(), 'PRE-0001');
});

test('les codes et désignations sont validés et les références protègent les fiches', () => {
  const { store } = createEnvironment();
  assert.equal(store.createService({ code: 'CODE', name: '' }).ok, false);
  assert.equal(store.createService({ code: 'CODE INVALIDE', name: 'Service' }).ok, false);
  const created = store.createService({ code: 'CONSULT', name: 'Consultation' });
  assert.equal(created.ok, true, created.errors.join(' '));
  assert.equal(store.createService({ code: 'consult', name: 'Doublon' }).ok, false);
  store.getState().entries.push({ id: 'service-entry', journal: 'VE', serviceCode: 'CONSULT', lines: [] });
  assert.equal(store.serviceReferenceCount(created.service.id), 1);
  const changedCode = store.updateService(created.service.id, { code: 'CONSULT-2', name: 'Consultation' });
  assert.equal(changedCode.ok, false);
  assert.equal(store.deleteService(created.service.id).ok, false);
  assert.equal(store.setServiceActive(created.service.id, false).ok, true, 'la fiche liée peut être archivée');
});

test('migration non destructive des anciennes bases et isolation entre dossiers', () => {
  const env = createEnvironment();
  const legacy = JSON.parse(JSON.stringify(env.store.getState()));
  const entriesBefore = JSON.stringify(legacy.entries);
  delete legacy.serviceRegistryVersion;
  delete legacy.services;
  delete legacy.serviceCodeHistory;
  delete legacy.serviceSequence;
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(legacy));
  const migrated = env.loadStore();
  assert.equal(migrated.getState().serviceRegistryVersion, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(migrated.services())), []);
  assert.equal(JSON.stringify(migrated.entries()), entriesBefore);

  const mainService = migrated.createService({ name: 'Formation professionnelle' });
  assert.equal(mainService.ok, true, mainService.errors.join(' '));
  const dossier = migrated.createDossier({
    clientName: 'Dossier secondaire', clientCode: 'SEC',
    accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR',
    cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
  });
  assert.equal(dossier.ok, true, dossier.errors.join(' '));
  assert.equal(migrated.switchDossier(dossier.dossier.id).ok, true);
  assert.equal(migrated.services().length, 0);
  assert.equal(migrated.createService({ name: 'Service dossier secondaire' }).ok, true);
  assert.equal(migrated.switchDossier('folder-main').ok, true);
  assert.equal(migrated.service(mainService.service.id).name, 'Formation professionnelle');
  assert.equal(migrated.services().length, 1);
});

test('les codes PRE existants font avancer le compteur de migration', () => {
  const env = createEnvironment();
  const state = JSON.parse(JSON.stringify(env.store.getState()));
  state.services = [{ id: 'old-service', code: 'PRE-0007', name: 'Prestation historique', description: '', active: true }];
  state.serviceRegistryVersion = 1;
  state.serviceCodeHistory = [];
  state.serviceSequence = 1;
  env.values.set(env.store.STORAGE_KEY, JSON.stringify(state));
  const migrated = env.loadStore();
  assert.equal(migrated.nextServiceCode(), 'PRE-0008');
});

console.log('Prestations : CRUD, migration, traçabilité et isolation — terminé');
