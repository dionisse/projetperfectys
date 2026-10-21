/* Clés de répartition analytiques : saisie libre, conservation par dossier et verrouillage après validation. */
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
const defaults = store.analyticalAllocationKeysConfiguration();
assert.deepEqual(JSON.parse(JSON.stringify(defaults)), {
  auxiliaryToMain: { rows: [], destination: '', configured: false, validatedAt: '' },
  servicesBySection: { rows: [], destination: '', configured: false, validatedAt: '' }
}, 'les deux grilles sont vides par défaut');
const initialEntryCount = store.entries().length;
const initialAccountCount = store.accounts().length;

const empty = store.saveAnalyticalAllocationKeysConfiguration('auxiliaryToMain', {
  rows: [{ mainSection: '', auxiliarySection: '', key: '' }], destination: ''
});
assert.equal(empty.ok, false, 'une grille vide reste le paramétrage par défaut');

const incomplete = store.saveAnalyticalAllocationKeysConfiguration('auxiliaryToMain', {
  rows: [{ mainSection: 'Administration', auxiliarySection: '', key: '1' }], destination: ''
});
assert.equal(incomplete.ok, false, 'une ligne commencée doit être complète');

const savedAuxiliary = store.saveAnalyticalAllocationKeysConfiguration('auxiliaryToMain', {
  rows: [
    { mainSection: 'Administration', auxiliarySection: 'Paie', key: '0,35' },
    { mainSection: 'Administration', auxiliarySection: 'Accueil', key: '0,65' },
    { mainSection: '', auxiliarySection: '', key: '' }
  ],
  destination: 'Répartition interne'
});
assert.equal(savedAuxiliary.ok, true, savedAuxiliary.errors && savedAuxiliary.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalAllocationKeysConfiguration().auxiliaryToMain.rows)), [
  { mainSection: 'Administration', counterpart: 'Paie', key: '0,35' },
  { mainSection: 'Administration', counterpart: 'Accueil', key: '0,65' }
], 'les clés sont conservées en texte sans supposer leur formule ou leur unité');
assert.equal(store.analyticalAllocationKeysConfiguration().auxiliaryToMain.destination, 'Répartition interne');
assert.equal(store.analyticalAllocationKeysConfiguration().servicesBySection.configured, false, 'la validation d’une grille ne verrouille pas l’autre');

const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].analyticalAllocationKeysConfiguration.auxiliaryToMain.configured, true);
assert.equal(persistedCatalog[0].analyticalAllocationKeysConfiguration.auxiliaryToMain.rows.length, 2);

const lockedSave = store.saveAnalyticalAllocationKeysConfiguration('auxiliaryToMain', {
  rows: [{ mainSection: 'Autre', auxiliarySection: 'Autre', key: '100' }], destination: ''
});
assert.equal(lockedSave.ok, false, 'une grille validée est verrouillée');

const savedServices = store.saveAnalyticalAllocationKeysConfiguration('servicesBySection', {
  rows: [{ mainSection: 'Production', serviceFamily: 'Prestations techniques', key: 'Base heures' }],
  destination: ''
});
assert.equal(savedServices.ok, true, savedServices.errors && savedServices.errors.join(' '));
assert.equal(store.analyticalAllocationKeysConfiguration().servicesBySection.rows[0].counterpart, 'Prestations techniques');
const reloadedStore = loadStore();
assert.equal(reloadedStore.analyticalAllocationKeysConfiguration().auxiliaryToMain.configured, true, 'la première grille reste validée après rechargement');
assert.equal(reloadedStore.analyticalAllocationKeysConfiguration().servicesBySection.configured, true, 'la seconde grille reste validée après rechargement');
assert.equal(store.entries().length, initialEntryCount, 'le paramétrage ne crée aucune écriture');
assert.equal(store.accounts().length, initialAccountCount, 'le paramétrage ne modifie pas le plan général');

const unknown = store.saveAnalyticalAllocationKeysConfiguration('unknown', { rows: [] });
assert.equal(unknown.ok, false);

const other = store.createDossier({
  clientName: 'Dossier clés isolées', clientCode: 'CLE', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.equal(store.analyticalAllocationKeysConfiguration().auxiliaryToMain.configured, false);
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalAllocationKeysConfiguration().auxiliaryToMain.rows)), [], 'les clés restent isolées entre dossiers');

storageWritesBlocked = true;
const quotaFailure = store.saveAnalyticalAllocationKeysConfiguration('auxiliaryToMain', {
  rows: [{ mainSection: 'Centre', auxiliarySection: 'Atelier', key: '1' }], destination: ''
});
storageWritesBlocked = false;
assert.equal(quotaFailure.ok, false);
assert.equal(store.analyticalAllocationKeysConfiguration().auxiliaryToMain.configured, false, 'un échec de persistance ne verrouille pas la grille');

console.log('  ✓ Clés de répartition conservées par grille et dossier, puis grisées sans calcul analytique.');
