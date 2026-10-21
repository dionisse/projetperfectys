/* Comptes lettrables, pointables, à payer et à recevoir : listes libres, persistées par dossier sans écriture. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const values = new Map();
let storageWritesBlocked = false;
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) {
    if (storageWritesBlocked) throw new Error('quota simulé');
    values.set(key, String(value));
  },
  removeItem(key) { values.delete(key); }
};

function loadStore() {
  const sandbox = { window: {}, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  sandbox.window.localStorage = localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

const store = loadStore();
const initialEntryCount = store.entries().length;
const initialAccountCount = store.accounts().length;
const empty = store.accountControlsConfiguration();
assert.deepEqual({
  payableAccounts: empty.payableAccounts,
  lettrableAccounts: empty.lettrableAccounts,
  receivableAccounts: empty.receivableAccounts,
  pointableAccounts: empty.pointableAccounts
}, { payableAccounts: '', lettrableAccounts: '', receivableAccounts: '', pointableAccounts: '' }, 'les quatre listes sont vierges par défaut');

const entries = {
  payableAccounts: '401\n42 43',
  lettrableAccounts: '471\n472',
  receivableAccounts: '411\n416',
  pointableAccounts: '512\n521'
};
const saved = store.saveAccountControlsConfiguration(entries);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.deepEqual({
  payableAccounts: store.accountControlsConfiguration().payableAccounts,
  lettrableAccounts: store.accountControlsConfiguration().lettrableAccounts,
  receivableAccounts: store.accountControlsConfiguration().receivableAccounts,
  pointableAccounts: store.accountControlsConfiguration().pointableAccounts
}, entries, 'les valeurs libres sont enregistrées sans transformation');
assert.equal(store.saveAccountControlsConfiguration({ payableAccounts: '401\r\n404' }).ok, true, 'une seule liste peut être sauvegardée sans effacer les autres');
assert.equal(store.accountControlsConfiguration().payableAccounts, '401\n404', 'les fins de ligne sont normalisées pour l’édition');
assert.equal(store.accountControlsConfiguration().lettrableAccounts, entries.lettrableAccounts, 'une mise à jour partielle conserve les autres listes');
assert.equal(loadStore().accountControlsConfiguration().pointableAccounts, entries.pointableAccounts, 'les listes persistent après rechargement');

const second = store.createDossier({
  clientName: 'Dossier de suivi isolé', clientCode: 'DSI', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(second.ok, true, second.errors && second.errors.join(' '));
assert.equal(store.switchDossier(second.dossier.id).ok, true);
assert.equal(store.accountControlsConfiguration().payableAccounts, '', 'les listes ne sont pas partagées entre dossiers');
assert.equal(store.accountControlsConfiguration().pointableAccounts, '');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.accountControlsConfiguration().payableAccounts, '401\n404');

const tooLong = store.saveAccountControlsConfiguration({ payableAccounts: 'x'.repeat(5001) });
assert.equal(tooLong.ok, false, 'une liste trop longue est refusée');
assert.equal(store.accountControlsConfiguration().payableAccounts, '401\n404', 'une entrée refusée ne modifie pas les listes sauvegardées');
const invalidType = store.saveAccountControlsConfiguration({ payableAccounts: ['401'] });
assert.equal(invalidType.ok, false, 'les valeurs doivent rester du texte libre');

storageWritesBlocked = true;
const failed = store.saveAccountControlsConfiguration({ payableAccounts: 'nouvelle valeur' });
storageWritesBlocked = false;
assert.equal(failed.ok, false, 'un stockage indisponible refuse la sauvegarde');
assert.equal(store.accountControlsConfiguration().payableAccounts, '401\n404', 'les valeurs antérieures restent intactes après un échec');
assert.equal(store.entries().length, initialEntryCount, 'le paramétrage ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'le paramétrage ne modifie pas le plan comptable');

const legacyCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.accountControlsConfiguration; });
values.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migrated = loadStore();
assert.deepEqual({
  payableAccounts: migrated.accountControlsConfiguration().payableAccounts,
  lettrableAccounts: migrated.accountControlsConfiguration().lettrableAccounts,
  receivableAccounts: migrated.accountControlsConfiguration().receivableAccounts,
  pointableAccounts: migrated.accountControlsConfiguration().pointableAccounts
}, { payableAccounts: '', lettrableAccounts: '', receivableAccounts: '', pointableAccounts: '' }, 'les dossiers existants reçoivent quatre listes vides sans toucher aux pièces');

console.log('  ✓ Les quatre listes de suivi sont libres, sauvegardées par dossier et sans opération comptable.');
