/* Tests des dossiers clients locaux de démonstration, sans dépendance externe. */
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
assert.equal(store.currentDossier().id, 'folder-main');
assert.equal(store.entries()[0].reference, 'VE-2026-LEGACY', 'la version antérieure reste accessible dans le dossier principal');
assert.equal(values.get('perfecto.lot1.v1'), JSON.stringify(legacyState), 'la migration conserve la clé comptable historique');
assert.equal(store.currentDossier().clientName, 'Entreprise de démonstration');

// Migration transparente du catalogue de dossiers de la version précédente.
values.delete('perfecto.dossiers.v1');
values.delete('perfecto.activeDossier.v1');
values.set('perfecto.folders.v1', JSON.stringify([
  { id: 'folder-main', name: 'Dossier principal', seeded: true },
  { id: 'folder-legacy', name: 'Agence Nord', seeded: false }
]));
values.set('perfecto.activeFolder.v1', 'folder-legacy');
store = loadStore();
assert.equal(store.currentDossier().name, 'Agence Nord');
assert.equal(store.currentDossier().clientName, 'Agence Nord');
assert.equal(store.currentDossier().reference, 'COR-NOR2026');
assert.equal(store.switchDossier('folder-main').ok, true);

values.clear();
store = loadStore();
const main = store.currentDossier();
assert.equal(main.id, 'folder-main');
assert.equal(store.entries().length, 4, 'le dossier historique de démonstration conserve ses données');

const created = store.createDossier({
  clientName: 'Cabinet Godwin',
  clientCode: 'GOD',
  accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR',
  cycleStart: '2026-07-01',
  cycleEnd: '2027-06-30'
});
assert.equal(created.ok, true);
assert.equal(created.dossier.clientCode, 'GOD', 'le code saisi est conservé après normalisation');
assert.equal(created.dossier.reference, 'COR-GOD2026', 'la référence suit le type, le code client et l’année du cycle');
assert.equal(created.dossier.exerciseYear, 2026);
assert.equal(store.createDossier({
  clientName: 'Client sans code', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
}).ok, false, 'le code client est saisi explicitement, sans règle de génération automatique');
assert.equal(store.createDossier({
  clientName: 'Cabinet Godwin bis', clientCode: 'GOD', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
}).ok, false, 'une référence déjà prise ne peut pas être réutilisée');
assert.equal(store.createDossier({
  clientName: 'Cycle invalide', clientCode: 'CYC', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-02-30', cycleEnd: '2026-12-31'
}).ok, false, 'une date civile inexistante est refusée');
const second = store.createDossier({
  clientName: 'Dossier, autre', clientCode: 'AUT', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(second.ok, true, 'une virgule dans le nom reste acceptée');

const switched = store.switchDossier(created.dossier.id);
assert.equal(switched.ok, true);
assert.equal(store.currentDossier().name, 'Cabinet Godwin');
assert.equal(store.entries().length, 0, 'un nouveau dossier est vide, sans recopier les écritures du principal');
assert.equal(store.accounts().length, 18, 'le plan SYSCOHADA de départ reste disponible');
assert.equal(store.exercise(), 2026);
assert.equal(store.periodStats(2026).length, 12, 'le cycle juillet 2026 — juin 2027 contient ses 12 périodes civiles');
assert.equal(store.periodStats(2027).length, 0, 'la liste de périodes est rattachée à l’exercice sélectionné');
const outsideCycle = store.validateEntry({
  reference: 'OD-2026-OUT', journal: 'OD', date: '2026-06-30', description: 'Hors cycle',
  lines: [{ account: '601100', debit: 1000, credit: 0 }, { account: '401100', debit: 0, credit: 1000 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(outsideCycle.ok, false, 'les écritures avant le début du cycle sont refusées');
assert(outsideCycle.errors.some(error => error.includes('cycle du dossier')));
const entry = store.createEntry({
  reference: 'OD-2027-001', journal: 'OD', date: '2027-01-15', description: 'Cabinet Godwin',
  lines: [{ account: '601100', debit: 1000, credit: 0 }, { account: '401100', debit: 0, credit: 1000 }]
}, 'posted');
assert.equal(entry.ok, true, 'une période du cycle peut se situer dans l’année civile suivante');
assert.equal(store.entries().length, 1);
assert.equal(store.backupInfo().available, true, 'la première écriture crée un point propre à ce dossier');
assert.equal(store.backupInfo().entryCount, 0);
assert.equal(store.addAccount({ code: '602200', label: 'Test Cabinet Godwin', nature: 'Charge' }).ok, true);
assert.equal(store.backupInfo().available, true);
assert.equal(store.backupInfo().entryCount, 1);

assert.equal(store.switchDossier(main.id).ok, true);
assert.equal(store.entries().length, 4, 'le changement de dossier restaure les données principales');
assert.equal(store.backupInfo().available, false, 'les points de restauration sont isolés par dossier');
assert.equal(store.switchDossier(created.dossier.id).ok, true);
assert.equal(store.entries().length, 1, 'les écritures restent persistées dans leur propre dossier');
assert.equal(store.accounts().length, 19);
assert.equal(store.restoreBackup().ok, true);
assert.equal(store.accounts().length, 18, 'la restauration remplace uniquement les données du dossier actif');
assert.equal(store.entries().length, 1);

store = loadStore();
assert.equal(store.currentDossier().id, created.dossier.id, 'la sélection de dossier est conservée localement');
assert.equal(store.entries().length, 1, 'les données du dossier survivent au rechargement');
assert.equal(store.accounts().length, 18);
assert.deepEqual(store.dossiers().map(dossier => dossier.name), ['Entreprise de démonstration', 'Cabinet Godwin', 'Dossier, autre']);
console.log('Dossiers clients : migration, référence, cycle et isolation — OK');
