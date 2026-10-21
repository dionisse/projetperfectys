/* Comptes associés aux immobilisations : configuration de la capture, par dossier et sans écriture. */
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
const initial = store.fixedAssetAccountsConfiguration();
assert.deepEqual(initial.rows.map(row => [
  row.grossValueAccount, row.accumulatedDepreciationAccount, row.depreciationExpenseAccount,
  row.disposalNetValueAccount, row.grantRecoveryAccount
]), [
  ['21*', '281*', '6812', '811', '799'],
  ['22*', '282*', '6813', '812', '799'],
  ['23*', '283*', '6813', '812', '799'],
  ['24*', '284*', '6813', '812', '799'],
  ['26*', '', '', '816', '799']
], 'les cinq correspondances et cellules vides reprennent exactement la capture');

const editedRows = initial.rows.map(row => {
  if (row.id === 'fixed-assets-class-21') return { ...row, disposalNetValueAccount: '811 812' };
  if (row.id === 'fixed-assets-class-26') return { ...row, accumulatedDepreciationAccount: '281*' };
  return row;
});
const saved = store.saveFixedAssetAccountsConfiguration({ rows: editedRows });
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811 812');
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-26').accumulatedDepreciationAccount, '281*');
const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].fixedAssetAccountsConfiguration.rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811 812');

assert.deepEqual(initial.additionalRows, [], 'aucune ligne supplémentaire n’est créée par défaut');
const reloadedStore = loadStore();
assert.equal(reloadedStore.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-26').accumulatedDepreciationAccount, '281*', 'les changements sont conservés après rechargement');
const additionalRow = {
  id: 'fixed-assets-custom-1', grossValueAccount: '25*', accumulatedDepreciationAccount: '285*',
  depreciationExpenseAccount: '6813', disposalNetValueAccount: '812', grantRecoveryAccount: '799'
};
const added = store.saveFixedAssetAccountsConfiguration({ rows: editedRows, additionalRows: [additionalRow] });
assert.equal(added.ok, true, added.errors && added.errors.join(' '));
assert.equal(store.fixedAssetAccountsConfiguration().additionalRows[0].grossValueAccount, '25*', 'une ligne vide peut recevoir une nouvelle correspondance');
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811 812', 'l’ajout ne modifie pas les lignes existantes');
const afterAddingStore = loadStore();
assert.equal(afterAddingStore.fixedAssetAccountsConfiguration().additionalRows[0].id, 'fixed-assets-custom-1', 'la nouvelle ligne est persistée après rechargement');
const emptyAdditional = store.saveFixedAssetAccountsConfiguration({ rows: editedRows, additionalRows: [{ id: 'fixed-assets-custom-2' }] });
assert.equal(emptyAdditional.ok, false, 'une ligne totalement vide reste un emplacement de saisie, pas une donnée enregistrée');
assert.equal(store.fixedAssetAccountsConfiguration().additionalRows.length, 1, 'un ajout vide ne supprime pas la ligne déjà enregistrée');
const missingRow = store.saveFixedAssetAccountsConfiguration({ rows: editedRows.filter(row => row.id !== 'fixed-assets-class-23') });
assert.equal(missingRow.ok, false, 'les cinq lignes de référence doivent être conservées');
const unknownRow = store.saveFixedAssetAccountsConfiguration({ rows: [...editedRows, { id: 'custom', grossValueAccount: '20*' }] });
assert.equal(unknownRow.ok, false, 'une ligne inconnue ne peut pas remplacer les lignes de référence');

const other = store.createDossier({
  clientName: 'Comptes immobilisés isolés', clientCode: 'CIM', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811', 'les configurations restent propres à chaque dossier');
assert.deepEqual(store.fixedAssetAccountsConfiguration().additionalRows, [], 'les lignes ajoutées ne sont pas partagées avec un autre dossier');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811 812');
assert.equal(store.fixedAssetAccountsConfiguration().additionalRows[0].grossValueAccount, '25*', 'la ligne ajoutée reste dans son dossier');

const reset = store.initializeFixedAssetAccountsConfiguration();
assert.equal(reset.ok, true, reset.errors && reset.errors.join(' '));
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811', 'la réinitialisation restaure les valeurs de la capture');
assert.deepEqual(store.fixedAssetAccountsConfiguration().additionalRows, [], 'la réinitialisation retire les lignes ajoutées du dossier');
assert.equal(store.entries().length, initialEntryCount, 'la configuration ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'la configuration ne crée ni ne modifie de compte général');

storageWritesBlocked = true;
const failedSave = store.saveFixedAssetAccountsConfiguration({ rows: editedRows });
storageWritesBlocked = false;
assert.equal(failedSave.ok, false, 'un échec de stockage refuse l’enregistrement');
assert.equal(store.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811', 'un échec de stockage conserve les valeurs précédentes');

const legacyCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.fixedAssetAccountsConfiguration; });
values.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migratedStore = loadStore();
assert.equal(migratedStore.fixedAssetAccountsConfiguration().rows.find(row => row.id === 'fixed-assets-class-21').disposalNetValueAccount, '811', 'les dossiers existants reçoivent les valeurs de référence');
assert.equal(JSON.parse(values.get('perfecto.dossiers.v1'))[0].fixedAssetAccountsConfiguration.rows.length, 5, 'la migration du catalogue persiste les cinq lignes par dossier');

console.log('  ✓ Comptes associés aux immobilisations conformes à la capture, avec ajouts non destructifs, isolation par dossier et sans écriture.');
