/* Paramètres des natures de comptes généraux : capture, isolation par dossier et contrôle des doublons par nature. */
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
const initial = store.generalAccountNaturesConfiguration();
const dataRows = initial.rows.filter(row => !row.separator);
const natureLabels = dataRows.map(row => row.nature);
assert.equal(initial.rows.filter(row => row.nature === 'Etat').length, 1, 'les captures qui se chevauchent ne dupliquent pas la section État');
assert.equal(new Set(initial.rows.map(row => row.id)).size, initial.rows.length, 'chaque ligne du tableau possède un identifiant unique');
assert.equal(new Set(natureLabels.map(label => label.toLocaleLowerCase('fr'))).size, natureLabels.length, 'aucune nature n’est répétée dans la liste');
for (const row of dataRows) {
  const accounts = row.accounts.split(/[\s,;]+/).filter(Boolean).map(code => code.toLocaleUpperCase('fr'));
  assert.equal(new Set(accounts).size, accounts.length, `aucun compte répété dans la nature « ${row.nature} »`);
}
assert.equal(initial.rows.find(row => row.id === 'stable-grants').accounts, '14');
assert.equal(initial.rows.find(row => row.id === 'fixed-assets').accounts, '2 -28 -29 475');
assert.equal(initial.rows.find(row => row.id === 'supplier-debts').accounts, '401 -4017 408 481 482 483 484');
assert.equal(initial.rows.find(row => row.id === 'state-aib-sales').accounts, '447CL');
assert.equal(initial.rows.find(row => row.id === 'commitments').accounts, '21 22 23 24 60 -603 61 62 63');
assert.equal(initial.rows.filter(row => row.separator).length > 0, true, 'les séparations de groupes sont conservées');

function withRow(configuration, id, changes) {
  return configuration.rows.map(row => row.id === id ? { ...row, ...changes } : row);
}

const saved = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(initial, 'stable-grants', { nature: 'dont subventions révisées', accounts: '14 145' })
});
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14 145');
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'supplier-debts').accounts, '401 -4017 408 481 482 483 484', 'les codes visibles dans plusieurs natures restent distincts par nature comme sur la capture');
const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].generalAccountNaturesConfiguration.rows.find(row => row.id === 'stable-grants').nature, 'dont subventions révisées');

const duplicateWithinNature = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(store.generalAccountNaturesConfiguration(), 'stable-grants', { accounts: '14 14' })
});
assert.equal(duplicateWithinNature.ok, false, 'un compte ne peut pas être répété dans la même nature');
assert.ok(duplicateWithinNature.errors.some(error => error.includes('14') && error.includes('répété')));
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14 145', 'un rejet ne modifie pas les valeurs enregistrées');

const duplicateNatureLabel = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(store.generalAccountNaturesConfiguration(), 'stable-grants', { nature: 'Ressources stables' })
});
assert.equal(duplicateNatureLabel.ok, false, 'le tableau refuse un libellé de nature dupliqué');
const missingRow = store.saveGeneralAccountNaturesConfiguration({ rows: [] });
assert.equal(missingRow.ok, false, 'une modification doit conserver toutes les lignes de la nomenclature');
const unknownRow = store.saveGeneralAccountNaturesConfiguration({
  rows: [...store.generalAccountNaturesConfiguration().rows, { id: 'custom', nature: 'Compte divers', accounts: '999' }]
});
assert.equal(unknownRow.ok, false, 'aucune nature non prévue n’est ajoutée sans référence métier');

const reloadedStore = loadStore();
assert.equal(reloadedStore.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14 145', 'les modifications persistent après rechargement');
const initialized = store.initializeGeneralAccountNaturesConfiguration();
assert.equal(initialized.ok, true, initialized.errors && initialized.errors.join(' '));
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').nature, 'dont subventions');
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14', 'Initialisation restaure la nomenclature des captures');

const customMain = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(store.generalAccountNaturesConfiguration(), 'stable-grants', { accounts: '14 145' })
});
assert.equal(customMain.ok, true);
const other = store.createDossier({
  clientName: 'Natures isolées', clientCode: 'NAT', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14', 'un dossier neuf reprend son initialisation sans les modifications d’un autre');
const changedOther = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(store.generalAccountNaturesConfiguration(), 'stocks', { accounts: '3 31' })
});
assert.equal(changedOther.ok, true);
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14 145', 'les modifications restent isolées par dossier');
assert.equal(store.entries().length, initialEntryCount, 'le paramétrage ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'le paramétrage ne crée ni ne modifie de compte général');

storageWritesBlocked = true;
const failedSave = store.saveGeneralAccountNaturesConfiguration({
  rows: withRow(store.generalAccountNaturesConfiguration(), 'stable-grants', { accounts: '14 199' })
});
storageWritesBlocked = false;
assert.equal(failedSave.ok, false, 'un échec de stockage refuse l’enregistrement');
assert.equal(store.generalAccountNaturesConfiguration().rows.find(row => row.id === 'stable-grants').accounts, '14 145', 'un échec de stockage conserve la configuration précédente');

console.log('  ✓ Natures des comptes chargées depuis les captures, sans ligne dupliquée, éditables et isolées par dossier.');
