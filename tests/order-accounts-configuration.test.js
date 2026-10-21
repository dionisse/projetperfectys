/* Comptes de suivi des commandes : données de capture, configuration par dossier et absence d’écritures. */
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
const initial = store.orderAccountsConfiguration();
assert.deepEqual(initial.rows.map(row => [row.rubric, row.accounts]), [
  ['Réalisation HT (achats, travaux, honoraires)', '21 22 23 24 60 -608 61 62 63'],
  ['TVA déductible', '445'],
  ['Avances aux fournisseurs', '4091 4092 4093'],
  ['Factures fournisseurs', '401 -4017 408 481 482 483 484'],
  ['Règlements', '5'],
  ['Retenues de garantie', '4017'],
  ['Autres retenues (impôts, pénalités...)', '447FO']
], 'les rubriques et comptes correspondent à la capture, y compris les signes et 447FO');
assert.deepEqual(initial.additionalRows, [], 'les lignes personnalisées sont vides à la création');

const additionalRow = { id: 'order-accounts-custom-1', rubric: 'Rubrique libre', accounts: '471 472' };
const added = store.saveOrderAccountsConfiguration({ rows: initial.rows, additionalRows: [additionalRow] });
assert.equal(added.ok, true, added.errors && added.errors.join(' '));
assert.equal(store.orderAccountsConfiguration().additionalRows[0].rubric, 'Rubrique libre');
assert.deepEqual(store.orderAccountsConfiguration().rows.map(row => row.accounts), initial.rows.map(row => row.accounts), 'l’ajout ne modifie aucune rubrique de référence');
const persisted = JSON.parse(values.get('perfecto.dossiers.v1'))[0].orderAccountsConfiguration;
assert.equal(persisted.additionalRows[0].accounts, '471 472');
assert.equal(loadStore().orderAccountsConfiguration().additionalRows[0].id, 'order-accounts-custom-1', 'les rubriques ajoutées persistent après rechargement');

const emptyAdditional = store.saveOrderAccountsConfiguration({ rows: initial.rows, additionalRows: [{ id: 'order-accounts-custom-2', rubric: '', accounts: '' }] });
assert.equal(emptyAdditional.ok, false, 'une ligne vide reste un emplacement de saisie');
assert.equal(store.orderAccountsConfiguration().additionalRows.length, 1, 'un enregistrement vide ne supprime pas les rubriques existantes');
const missingRow = store.saveOrderAccountsConfiguration({ rows: initial.rows.filter(row => row.id !== 'orders-vat-deductible') });
assert.equal(missingRow.ok, false, 'les rubriques de référence doivent être conservées');
const unknownRow = store.saveOrderAccountsConfiguration({ rows: [...initial.rows, { id: 'unknown', rubric: 'Inconnue', accounts: '40' }] });
assert.equal(unknownRow.ok, false, 'une rubrique inconnue ne remplace pas les lignes de référence');

const other = store.createDossier({
  clientName: 'Dossier de marchés isolé', clientCode: 'DMI', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.deepEqual(store.orderAccountsConfiguration().additionalRows, [], 'les rubriques restent isolées par dossier');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.orderAccountsConfiguration().additionalRows[0].accounts, '471 472');

storageWritesBlocked = true;
const failedSave = store.saveOrderAccountsConfiguration({ rows: initial.rows, additionalRows: [{ id: 'order-accounts-custom-1', rubric: 'Autre rubrique', accounts: '475' }] });
storageWritesBlocked = false;
assert.equal(failedSave.ok, false, 'un échec de stockage refuse l’enregistrement');
assert.equal(store.orderAccountsConfiguration().additionalRows[0].accounts, '471 472', 'les valeurs précédentes restent conservées en cas d’échec');
assert.equal(store.entries().length, initialEntryCount, 'la configuration ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'la configuration ne crée ni ne modifie de compte général');

const legacyCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.orderAccountsConfiguration; });
values.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migrated = loadStore();
assert.equal(migrated.orderAccountsConfiguration().rows.length, 7, 'les dossiers existants reçoivent les rubriques de référence');
assert.equal(migrated.orderAccountsConfiguration().rows[0].accounts, '21 22 23 24 60 -608 61 62 63');

console.log('  ✓ Comptes de suivi des commandes conformes à la capture, paramétrables par dossier et sans suivi d’achat ni écriture.');
