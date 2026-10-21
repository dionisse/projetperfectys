/* Devises par dossier : référentiel initial, cours de référence XOF et opérations sans conversion comptable. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const storedValues = new Map();
let storageWritesBlocked = false;
const localStorage = {
  getItem(key) { return storedValues.has(key) ? storedValues.get(key) : null; },
  setItem(key, value) {
    if (storageWritesBlocked) throw new Error('quota simulé');
    storedValues.set(key, String(value));
  },
  removeItem(key) { storedValues.delete(key); }
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
const initial = store.currenciesConfiguration();
assert.equal(initial.defaultCurrencyCode, 'XOF', 'XOF est la devise de référence dès le départ');
assert.deepEqual(Array.from(initial.rows, row => row.code), ['EUR', 'USD', 'XOF'], 'les trois devises de la capture sont affichées dans l’ordre');
assert.deepEqual(Array.from(initial.rows, row => row.label), ['Euro', "Dollard des E.U. d'Amérique", 'Franc CFA']);
assert.equal(initial.rows.find(row => row.code === 'XOF').lastRate, '1.000', 'XOF conserve le cours de référence indiqué');
assert.equal(initial.rows.find(row => row.code === 'EUR').lastRate, '', 'aucun cours EUR n’est inventé');
assert.equal(initial.rows.find(row => row.code === 'USD').lastRate, '', 'aucun cours USD n’est inventé');

const withPound = [
  ...Array.from(initial.rows, row => ({ ...row })),
  { code: 'GBP', label: 'Livre sterling', lastRate: '1.2500' }
];
const saved = store.saveCurrenciesConfiguration({ rows: withPound });
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.currenciesConfiguration().defaultCurrencyCode, 'XOF');
assert.equal(store.currenciesConfiguration().rows.find(row => row.code === 'GBP').lastRate, '1.2500', 'le cours saisi est conservé sans conversion ni arrondi');
assert.equal(loadStore().currenciesConfiguration().rows.find(row => row.code === 'GBP').label, 'Livre sterling', 'la configuration persiste après rechargement');

const duplicate = store.saveCurrenciesConfiguration({ rows: [...withPound, { code: 'eur', label: 'Euro dupliqué', lastRate: '' }] });
assert.equal(duplicate.ok, false, 'les doublons de code, sans tenir compte de la casse, sont refusés');
const withoutBase = store.saveCurrenciesConfiguration({ rows: withPound.filter(row => row.code !== 'XOF') });
assert.equal(withoutBase.ok, false, 'la devise de référence ne peut pas être supprimée');
const changedBaseRate = store.saveCurrenciesConfiguration({ rows: withPound.map(row => row.code === 'XOF' ? { ...row, lastRate: '1.25' } : row) });
assert.equal(changedBaseRate.ok, false, 'le cours de la devise de référence ne peut pas être modifié');
const invalidCode = store.saveCurrenciesConfiguration({ rows: [...withPound, { code: 'EURO', label: 'Code trop long', lastRate: '' }] });
assert.equal(invalidCode.ok, false, 'un code de devise doit comporter trois lettres');
const invalidRate = store.saveCurrenciesConfiguration({ rows: withPound.map(row => row.code === 'GBP' ? { ...row, lastRate: '0' } : row) });
assert.equal(invalidRate.ok, false, 'un cours renseigné doit être strictement positif');
assert.equal(store.currenciesConfiguration().rows.find(row => row.code === 'GBP').lastRate, '1.2500', 'les saisies refusées ne remplacent pas les valeurs enregistrées');

const corruptCatalog = JSON.parse(storedValues.get('perfecto.dossiers.v1'));
const mainDossier = corruptCatalog.find(dossier => dossier.id === 'folder-main');
mainDossier.currenciesConfiguration.rows.push({ code: 'eur', label: 'Doublon importé', lastRate: '' });
storedValues.set('perfecto.dossiers.v1', JSON.stringify(corruptCatalog));
const normalized = loadStore().currenciesConfiguration();
assert.equal(normalized.rows.filter(row => row.code === 'EUR').length, 1, 'une configuration historique corrompue est normalisée sans doublon');
assert.equal(normalized.rows.find(row => row.code === 'XOF').lastRate, '1.000', 'la normalisation restaure le cours de référence');

const afterNormalization = store.currenciesConfiguration();
const deletedEuro = store.saveCurrenciesConfiguration({ rows: afterNormalization.rows.filter(row => row.code !== 'EUR') });
assert.equal(deletedEuro.ok, true, deletedEuro.errors && deletedEuro.errors.join(' '));
assert.ok(!store.currenciesConfiguration().rows.some(row => row.code === 'EUR'), 'une devise non-référence peut être supprimée');
assert.equal(store.currenciesConfiguration().rows.find(row => row.code === 'XOF').code, 'XOF');

const second = store.createDossier({
  clientName: 'Dossier de devises isolé', clientCode: 'DEV', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(second.ok, true, second.errors && second.errors.join(' '));
assert.equal(store.switchDossier(second.dossier.id).ok, true);
assert.deepEqual(Array.from(store.currenciesConfiguration().rows, row => row.code), ['EUR', 'USD', 'XOF'], 'un dossier neuf reçoit ses devises initiales, sans reprendre les suppressions d’un autre dossier');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.ok(!store.currenciesConfiguration().rows.some(row => row.code === 'EUR'), 'la suppression reste propre au premier dossier');

storageWritesBlocked = true;
const failed = store.saveCurrenciesConfiguration({ rows: store.currenciesConfiguration().rows.map(row => ({ ...row, label: row.code === 'GBP' ? 'Nouvel intitulé' : row.label })) });
storageWritesBlocked = false;
assert.equal(failed.ok, false, 'une indisponibilité du stockage refuse la sauvegarde');
assert.equal(store.currenciesConfiguration().rows.find(row => row.code === 'GBP').label, 'Livre sterling', 'les données antérieures sont restaurées après échec');
assert.equal(store.entries().length, initialEntryCount, 'le paramétrage ne crée aucune écriture');
assert.equal(store.accounts().length, initialAccountCount, 'le paramétrage ne modifie pas le plan comptable');

const legacyCatalog = JSON.parse(storedValues.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.currenciesConfiguration; });
storedValues.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migrated = loadStore().currenciesConfiguration();
assert.deepEqual(Array.from(migrated.rows, row => row.code), ['EUR', 'USD', 'XOF'], 'les anciens dossiers reçoivent le référentiel initial');
assert.equal(migrated.defaultCurrencyCode, 'XOF');

const permissionSandbox = { window: {} };
vm.createContext(permissionSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'permissions.js'), 'utf8'), permissionSandbox, { filename: 'permissions.js' });
const permissions = permissionSandbox.window.PerfectoPermissions;
const permissionContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
const member = { role: 'manager', organizationId: 'org-1', grants: { accounting: [{ actions: ['module.view'], scope: { type: 'dossier', dossiers: ['dossier-1'] } }] } };
assert.equal(permissions.hasPermission(member, 'accounting', 'currencies.configure', permissionContext), false, 'l’accès est refusé sans délégation explicite');
member.grants.accounting[0].actions.push('currencies.configure');
assert.equal(permissions.hasPermission(member, 'accounting', 'currencies.configure', permissionContext), true, 'une délégation explicite autorise la configuration du bon dossier');
assert.equal(permissions.hasPermission(member, 'accounting', 'currencies.configure', { ...permissionContext, dossierId: 'dossier-2' }), false, 'le droit ne s’étend pas aux autres dossiers');

console.log('  ✓ EUR, USD et XOF sont configurables par dossier ; XOF reste la référence à 1.000, sans calcul ni écriture comptable.');
