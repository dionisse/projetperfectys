/* Natures des commandes : liste de référence modifiable, extensions par dossier et aucune opération d’achat. */
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
const initial = store.orderNaturesConfiguration();
assert.deepEqual(initial.rows.map(row => [row.number, row.name]), [
  ['1', 'Bon de commande'],
  ['2', 'Lettre de commande'],
  ['3', 'Contrat'],
  ['4', 'Nature 4'],
  ['5', 'Nature 5']
], 'les cinq natures et numéros correspondent à la capture');
assert.deepEqual(initial.additionalRows, [], 'aucune nature libre n’est précréée');

const editedRows = initial.rows.map(row => row.id === 'order-nature-3' ? { ...row, number: '30', name: 'Contrat de marché' } : row);
const savedEdit = store.saveOrderNaturesConfiguration({ rows: editedRows, additionalRows: [] });
assert.equal(savedEdit.ok, true, savedEdit.errors && savedEdit.errors.join(' '));
assert.equal(store.orderNaturesConfiguration().rows.find(row => row.id === 'order-nature-3').name, 'Contrat de marché');
assert.equal(store.orderNaturesConfiguration().rows.find(row => row.id === 'order-nature-3').number, '30', 'le numéro d’une nature est modifiable');
assert.equal(store.orderNaturesConfiguration().rows.find(row => row.id === 'order-nature-1').name, 'Bon de commande', 'modifier une nature ne change pas les autres lignes');

const additional = { id: 'order-natures-custom-1', number: '6', name: 'Accord-cadre' };
const savedAdd = store.saveOrderNaturesConfiguration({ rows: editedRows, additionalRows: [additional] });
assert.equal(savedAdd.ok, true, savedAdd.errors && savedAdd.errors.join(' '));
assert.deepEqual(store.orderNaturesConfiguration().additionalRows.map(row => [row.number, row.name]), [['6', 'Accord-cadre']]);
assert.equal(loadStore().orderNaturesConfiguration().additionalRows[0].id, 'order-natures-custom-1', 'la nature ajoutée persiste après rechargement');
const persisted = JSON.parse(values.get('perfecto.dossiers.v1'))[0].orderNaturesConfiguration;
assert.equal(persisted.additionalRows[0].name, 'Accord-cadre');

const duplicateNumber = store.saveOrderNaturesConfiguration({
  rows: editedRows,
  additionalRows: [{ id: 'order-natures-custom-1', number: '1', name: 'Autre commande' }]
});
assert.equal(duplicateNumber.ok, false, 'un numéro de nature déjà utilisé est refusé');
const incompleteNewRow = store.saveOrderNaturesConfiguration({
  rows: editedRows,
  additionalRows: [{ id: 'order-natures-custom-2', number: '7', name: '' }]
});
assert.equal(incompleteNewRow.ok, false, 'une nature ajoutée doit comporter un libellé');
const missingReference = store.saveOrderNaturesConfiguration({ rows: editedRows.filter(row => row.id !== 'order-nature-4') });
assert.equal(missingReference.ok, false, 'les cinq lignes de référence doivent rester présentes');
const unknownReference = store.saveOrderNaturesConfiguration({ rows: [...editedRows, { id: 'unknown', number: '9', name: 'Inconnue' }] });
assert.equal(unknownReference.ok, false, 'une nature inconnue ne remplace pas une ligne de référence');
assert.equal(store.orderNaturesConfiguration().additionalRows[0].number, '6', 'un rejet conserve la configuration enregistrée');

const other = store.createDossier({
  clientName: 'Dossier de natures isolées', clientCode: 'DNI', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.deepEqual(store.orderNaturesConfiguration().additionalRows, [], 'les ajouts sont isolés par dossier');
assert.equal(store.orderNaturesConfiguration().rows[0].name, 'Bon de commande', 'les nouveaux dossiers reçoivent la liste par défaut');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.orderNaturesConfiguration().rows[2].name, 'Contrat de marché');
assert.equal(store.orderNaturesConfiguration().additionalRows[0].name, 'Accord-cadre');

storageWritesBlocked = true;
const failedSave = store.saveOrderNaturesConfiguration({
  rows: editedRows,
  additionalRows: [{ id: 'order-natures-custom-1', number: '6', name: 'Valeur non sauvegardée' }]
});
storageWritesBlocked = false;
assert.equal(failedSave.ok, false, 'un stockage indisponible refuse l’enregistrement');
assert.equal(store.orderNaturesConfiguration().additionalRows[0].name, 'Accord-cadre', 'les valeurs déjà enregistrées restent conservées');
assert.equal(store.entries().length, initialEntryCount, 'la nomenclature ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'la nomenclature ne crée ni ne modifie de compte général');

const legacyCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.orderNaturesConfiguration; });
values.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migrated = loadStore();
assert.deepEqual(migrated.orderNaturesConfiguration().rows.map(row => row.name), [
  'Bon de commande', 'Lettre de commande', 'Contrat', 'Nature 4', 'Nature 5'
], 'les dossiers déjà créés reçoivent la nomenclature issue de la capture');

console.log('  ✓ Natures des commandes conformes à la capture, modifiables, extensibles par dossier et sans opération d’achat.');
