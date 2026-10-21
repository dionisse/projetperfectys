/* Tests du tableau de passage entre plans de dossiers PERFECTO. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); }
};
const Bridge = require('../modern-proto/js/accounting-bridge.js');

const sourceAccounts = [
  { code: '101', label: 'Capital', postable: true, active: true },
  { code: '401', label: 'Fournisseurs', postable: true, active: false },
  { code: '40', label: 'Tiers', postable: false, active: true }
];
const targetAccounts = [
  { code: '201', label: 'Immobilisations', postable: true, active: true },
  { code: '401', label: 'Fournisseurs', postable: true, active: true },
  { code: '411', label: 'Clients', postable: true, active: false },
  { code: '4', label: 'Classe 4', postable: false, active: true }
];

assert.deepEqual(Bridge.get('target-a', 'source-a'), {
  ok: true,
  errors: [],
  mappings: [],
  updatedAt: ''
});

const saved = Bridge.save('target-a', 'source-a', [
  { sourceCode: '101', targetCode: '201' },
  { sourceCode: '401', targetCode: '401' }
], sourceAccounts, targetAccounts);
assert.equal(saved.ok, true, saved.errors && saved.errors.join('\n'));
assert.equal(saved.mappings.length, 2);
const reloaded = Bridge.get('target-a', 'source-a');
assert.equal(reloaded.ok, true);
assert.deepEqual(reloaded.mappings, saved.mappings);
assert.ok(reloaded.updatedAt);
assert.deepEqual(Bridge.get('target-b', 'source-a').mappings, [], 'les correspondances restent séparées selon le dossier cible');
assert.deepEqual(Bridge.get('target-a', 'source-b').mappings, [], 'les correspondances restent séparées selon le dossier source');

const duplicateSource = Bridge.validateMappings([
  { sourceCode: '101', targetCode: '201' },
  { sourceCode: '101', targetCode: '401' }
], sourceAccounts, targetAccounts);
assert.equal(duplicateSource.ok, false);
assert.ok(duplicateSource.errors.some(error => error.includes('apparaît plusieurs fois')));

const missingSource = Bridge.validateMappings([{ sourceCode: '999', targetCode: '201' }], sourceAccounts, targetAccounts);
assert.equal(missingSource.ok, false);
assert.ok(missingSource.errors.some(error => error.includes('absent ou non imputable')));

const nonPostableSource = Bridge.validateMappings([{ sourceCode: '40', targetCode: '401' }], sourceAccounts, targetAccounts);
assert.equal(nonPostableSource.ok, false);

const inactiveTarget = Bridge.validateMappings([{ sourceCode: '101', targetCode: '411' }], sourceAccounts, targetAccounts);
assert.equal(inactiveTarget.ok, false);
assert.ok(inactiveTarget.errors.some(error => error.includes('inactif')));

const nonPostableTarget = Bridge.validateMappings([{ sourceCode: '101', targetCode: '4' }], sourceAccounts, targetAccounts);
assert.equal(nonPostableTarget.ok, false);

assert.equal(Bridge.save('same', 'same', [], sourceAccounts, targetAccounts).ok, false);
assert.equal(Bridge.save('target-a', 'source-a', [], sourceAccounts, targetAccounts).ok, true, 'vider puis enregistrer le tableau retire ses correspondances');
assert.deepEqual(Bridge.get('target-a', 'source-a').mappings, []);

const corruptKey = 'perfecto.accounting-bridge.v1.corrupt-target.corrupt-source';
storage.set(corruptKey, '{');
const corrupted = Bridge.get('corrupt-target', 'corrupt-source');
assert.equal(corrupted.ok, false);
assert.ok(corrupted.errors.some(error => error.includes('illisible')));

storage.set(corruptKey, JSON.stringify({
  version: 1, targetDossierId: 'corrupt-target', sourceDossierId: 'corrupt-source',
  mappings: [{ sourceCode: '', targetCode: '201' }]
}));
const originalMalformedPayload = storage.get(corruptKey);
const malformedRows = Bridge.get('corrupt-target', 'corrupt-source');
assert.equal(malformedRows.ok, false, 'une ligne invalide enregistrée ne doit pas être supprimée silencieusement');
assert.equal(storage.get(corruptKey), originalMalformedPayload, 'une lecture invalide ne remplace pas la donnée locale originale');

storage.set(corruptKey, JSON.stringify({
  version: 1, targetDossierId: 'corrupt-target', sourceDossierId: 'corrupt-source',
  mappings: [{ sourceCode: '101', targetCode: '201' }, { sourceCode: '101', targetCode: '401' }]
}));
assert.equal(Bridge.get('corrupt-target', 'corrupt-source').ok, false, 'un doublon source enregistré doit être signalé, pas normalisé');

const localStorageReference = global.localStorage;
delete global.localStorage;
assert.equal(Bridge.get('target-a', 'source-a').ok, false, 'un stockage indisponible ne doit pas être présenté comme un tableau vide');
assert.equal(Bridge.save('target-a', 'source-a', [], sourceAccounts, targetAccounts).ok, false);
global.localStorage = localStorageReference;

console.log('Tableau de passage PERFECTO : validation, séparation des dossiers et persistance locale — OK');
