/* Natures analytiques : tableau de référence, édition libre et sauvegarde par dossier. */
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
const initial = store.analyticalNaturesConfiguration();
const rows = initial.rows;
assert.deepEqual(rows.map(row => row.genericName), [
  'Centres de responsabilité', 'Domaines d\'activités', 'Catégorie de dépenses',
  'Sources de financement', 'Comptes alternatifs', 'Analyses Diverses',
  'Frais sur véhicules', 'Bénéficiaires de frais de mission', 'Analyse 3', 'Analyse 4', 'Analyse 5',
  'Natures des flux de trésorerie'
]);
assert.deepEqual(rows.map(row => row.individualName), [
  'Centre', 'Activité', 'Catégorie', 'Financement', 'Cpt alternatif', '',
  'Véhicule', 'Bénéficiaire', 'Analyse 3', 'Analyse 4', 'Analyse 5', 'Nature du flux'
]);
assert.equal(rows.filter(row => row.group).length, 1, 'la ligne Analyses Diverses est un séparateur unique');
assert.ok(rows.filter(row => !row.group && row.id !== 'cash-flow-natures').every(row =>
  !row.requiredAtEntry && row.significantAccounts === '' && row.carryForwardAccounts === ''
), 'les cellules vides de la capture restent vides');
const cashFlow = rows.find(row => row.id === 'cash-flow-natures');
assert.equal(cashFlow.requiredAtEntry, true);
assert.equal(cashFlow.significantAccounts, '5');
assert.equal(cashFlow.carryForwardAccounts, '');

const savedRows = rows.map(row => {
  if (row.id === 'activity-domains') return { ...row, genericName: 'Domaines revisités', individualName: 'Secteur', significantAccounts: '21   22', carryForwardAccounts: '2 3' };
  if (row.id === 'cash-flow-natures') return { ...row, requiredAtEntry: false, significantAccounts: '5 57' };
  return row;
});
const saved = store.saveAnalyticalNaturesConfiguration({ rows: savedRows });
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').genericName, 'Domaines revisités');
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').significantAccounts, '21 22', 'les espaces successifs sont normalisés sans interpréter les valeurs');
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'cash-flow-natures').requiredAtEntry, false);
const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].analyticalNaturesConfiguration.rows.find(row => row.id === 'activity-domains').carryForwardAccounts, '2 3');
assert.equal(persistedCatalog[0].analyticalNaturesConfiguration.rows.find(row => row.id === 'cash-flow-natures').significantAccounts, '5 57');

const reloadedStore = loadStore();
assert.equal(reloadedStore.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').individualName, 'Secteur', 'les modifications sont conservées après rechargement');
const missingRow = store.saveAnalyticalNaturesConfiguration({ rows: savedRows.filter(row => row.id !== 'analysis-3') });
assert.equal(missingRow.ok, false, 'toutes les lignes du tableau doivent être conservées');
const unknownRow = store.saveAnalyticalNaturesConfiguration({ rows: [...savedRows, { id: 'custom', genericName: 'Nouvelle analyse' }] });
assert.equal(unknownRow.ok, false, 'aucune ligne non présente dans la capture n’est inventée');
const tooLong = store.saveAnalyticalNaturesConfiguration({ rows: savedRows.map(row => row.id === 'analysis-3' ? { ...row, significantAccounts: 'x'.repeat(501) } : row) });
assert.equal(tooLong.ok, false, 'les valeurs restent dans la longueur prévue par les champs');

const other = store.createDossier({
  clientName: 'Natures analytiques isolées', clientCode: 'NAN', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').genericName, 'Domaines d\'activités', 'chaque dossier conserve ses propres valeurs');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').genericName, 'Domaines revisités');
assert.equal(store.entries().length, initialEntryCount, 'la configuration ne crée aucune pièce');
assert.equal(store.accounts().length, initialAccountCount, 'la configuration ne modifie pas le plan comptable général');

storageWritesBlocked = true;
const failedSave = store.saveAnalyticalNaturesConfiguration({ rows: savedRows });
storageWritesBlocked = false;
assert.equal(failedSave.ok, false, 'un échec de stockage refuse la modification');
assert.equal(store.analyticalNaturesConfiguration().rows.find(row => row.id === 'activity-domains').genericName, 'Domaines revisités', 'un échec de stockage conserve la configuration précédente');

console.log('  ✓ Natures analytiques conformes à la capture, modifiables, isolées par dossier et sans écriture analytique.');
