/* Centres d’analyse : référentiel local réservé à l’analytique, sans écriture générale. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
}

function loadStore() {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

let store = sandbox.window.PerfectoStore;
assert.equal(store.getState().analyticalCenterRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalCenters())), []);
assert.equal(store.nextAnalyticalCenterCode(), 'ANA-0001');

const originalEntries = JSON.stringify(store.entries());
const storageKey = store.currentStorageKey();
const legacy = JSON.parse(values.get(storageKey));
delete legacy.analyticalCenterRegistryVersion;
delete legacy.analyticalCenters;
delete legacy.analyticalCenterCodeHistory;
delete legacy.analyticalCenterSequence;
values.set(storageKey, JSON.stringify(legacy));
store = loadStore();
assert.equal(store.getState().analyticalCenterRegistryVersion, 1, 'un ancien dossier reçoit la migration du registre analytique');
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalCenters())), []);
assert.equal(JSON.stringify(store.entries()), originalEntries, 'la migration ne réécrit aucune pièce comptable');

const created = store.createAnalyticalCenter({ name: 'Atelier de production', description: 'Coûts de l’atelier.' });
assert.equal(created.ok, true, created.errors.join(' '));
assert.equal(created.analyticalCenter.code, 'ANA-0001');
assert.equal(created.analyticalCenter.active, true);
assert.equal(created.analyticalCenter.accountCode, undefined, 'un centre analytique n’est pas un compte général');
assert.equal(JSON.stringify(store.entries()), originalEntries, 'la création d’un centre n’ajoute aucune écriture');

const duplicate = store.createAnalyticalCenter({ code: 'ana-0001', name: 'Code dupliqué' });
assert.equal(duplicate.ok, false);
assert.match(duplicate.errors.join(' '), /existe déjà/);

const updated = store.updateAnalyticalCenter(created.analyticalCenter.id, {
  code: 'ATELIER-NORD', name: 'Atelier Nord', description: 'Centre réservé à l’analytique.'
});
assert.equal(updated.ok, true, updated.errors.join(' '));
assert.equal(updated.analyticalCenter.code, 'ATELIER-NORD');
assert.equal(store.analyticalCenter('ANA-0001'), null, 'le code renommé n’est pas un alias actif');
assert.ok(store.getState().analyticalCenterCodeHistory.includes('ANA-0001'));
assert.ok(store.getState().analyticalCenterCodeHistory.includes('ATELIER-NORD'));

const archived = store.setAnalyticalCenterActive(created.analyticalCenter.id, false);
assert.equal(archived.ok, true);
assert.equal(archived.analyticalCenter.active, false);
const restored = store.setAnalyticalCenterActive(created.analyticalCenter.id, true);
assert.equal(restored.ok, true);
assert.equal(restored.analyticalCenter.active, true);

const deleted = store.deleteAnalyticalCenter(created.analyticalCenter.id);
assert.equal(deleted.ok, true);
assert.equal(store.analyticalCenters().length, 0);
assert.equal(store.createAnalyticalCenter({ code: 'ANA-0001', name: 'Réutilisation refusée' }).ok, false, 'un code supprimé reste réservé');
const next = store.createAnalyticalCenter({ name: 'Centre suivant' });
assert.equal(next.analyticalCenter.code, 'ANA-0002');

const dossier = store.createDossier({
  clientName: 'Dossier Centre Analytique', clientCode: 'CENTREX',
  accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(dossier.ok, true, dossier.errors.join(' '));
assert.equal(store.switchDossier(dossier.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalCenters())), [], 'les centres analytiques sont isolés par dossier');
assert.equal(store.nextAnalyticalCenterCode(), 'ANA-0001', 'la séquence est propre au dossier');

console.log('Centres analytiques : migration, CRUD, code non réutilisable, isolation par dossier et absence de mutation générale — OK');
