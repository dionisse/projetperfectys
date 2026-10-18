/* Tests des dossiers locaux de démonstration, sans dépendance externe. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};

function loadStore() {
  const sandbox = { window: {}, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  sandbox.window.localStorage = localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

const legacyState = {
  version: 1, exercise: 2026, accounts: [{ code: '411100' }], journals: [{ code: 'VE' }],
  entries: [{ id: 'legacy', reference: 'VE-2026-LEGACY', date: '2026-01-01', status: 'posted', lines: [] }], periods: []
};
values.set('perfecto.lot1.v1', JSON.stringify(legacyState));
let store = loadStore();
assert.equal(store.currentFolder().id, 'folder-main');
assert.equal(store.entries()[0].reference, 'VE-2026-LEGACY', 'la version antérieure reste accessible dans le dossier principal');
assert.equal(values.get('perfecto.lot1.v1'), JSON.stringify(legacyState), 'la migration conserve la clé comptable historique');

values.clear();
store = loadStore();
const main = store.currentFolder();
assert.equal(main.id, 'folder-main');
assert.equal(store.entries().length, 4, 'le dossier principal neuf démarre avec le jeu de données historique');

const created = store.createFolder('Agence Nord');
assert.equal(created.ok, true);
assert.equal(created.folder.name, 'Agence Nord');
assert.equal(store.createFolder(' agence nord ').ok, false, 'les doublons sans distinction de casse sont refusés');
assert.equal(store.createFolder('Dossier, autre').ok, true, 'un nom de dossier avec virgule reste un seul identifiant sélectionnable');

const switched = store.switchFolder(created.folder.id);
assert.equal(switched.ok, true);
assert.equal(store.currentFolder().name, 'Agence Nord');
assert.equal(store.entries().length, 0, 'un nouveau dossier est vide, sans recopier les écritures du principal');
assert.equal(store.accounts().length, 18, 'le plan SYSCOHADA de départ reste disponible');
const entry = store.createEntry({
  reference: 'OD-2026-001', journal: 'OD', date: '2026-02-10', description: 'Agence Nord',
  lines: [{ account: '601100', debit: 1000, credit: 0 }, { account: '401100', debit: 0, credit: 1000 }]
}, 'posted');
assert.equal(entry.ok, true);
assert.equal(store.entries().length, 1);
assert.equal(store.backupInfo().available, true, 'la première écriture crée un point propre à ce dossier');
assert.equal(store.backupInfo().entryCount, 0);
assert.equal(store.addAccount({ code: '602200', label: 'Test Agence Nord', nature: 'Charge' }).ok, true);
assert.equal(store.backupInfo().available, true);
assert.equal(store.backupInfo().entryCount, 1);

assert.equal(store.switchFolder(main.id).ok, true);
assert.equal(store.entries().length, 4, 'le changement de dossier restaure les données principales');
assert.equal(store.backupInfo().available, false, 'les points de restauration sont isolés par dossier');
assert.equal(store.switchFolder(created.folder.id).ok, true);
assert.equal(store.entries().length, 1, 'les écritures restent persistées dans leur propre dossier');
assert.equal(store.accounts().length, 19);
assert.equal(store.restoreBackup().ok, true);
assert.equal(store.accounts().length, 18, 'la restauration remplace uniquement les données du dossier actif');
assert.equal(store.entries().length, 1);

store = loadStore();
assert.equal(store.currentFolder().id, created.folder.id, 'la sélection de dossier est conservée localement');
assert.equal(store.entries().length, 1, 'les données du dossier survivent au rechargement');
assert.equal(store.accounts().length, 18);
assert.deepEqual(store.folders().map(folder => folder.name), ['Dossier principal', 'Agence Nord', 'Dossier, autre']);
console.log('Dossiers locaux : séparation des données, persistance et catalogue — OK');
