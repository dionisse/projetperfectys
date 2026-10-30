/* Persistance des correspondances et cycle de vie des générations OHADA. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const values = new Map();
const events = [];
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const window = {
  localStorage,
  dispatchEvent(event) { events.push(event); },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init && init.detail; }
};
const sandbox = { window, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array, RegExp };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
const store = window.PerfectoStore;

assert.equal(store.saveFinancialStatementsMappingsConfiguration({ mappings: {
  '101': { debit: '', credit: 'CA' },
  '401': { debit: 'BH', credit: 'DJ' }
} }).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(store.financialStatementsMappingsConfiguration().mappings)), {
  '101': { debit: '', credit: 'CA' },
  '401': { debit: 'BH', credit: 'DJ' }
});
assert.equal(store.saveFinancialStatementsMappingsConfiguration({ mappings: { '1': { debit: 'invalid code', credit: '' } } }).ok, false);
assert.equal(store.financialStatementsMappingsConfiguration().mappings['101'].credit, 'CA', 'une correction refusée ne remplace pas la configuration enregistrée');

assert.equal(store.saveOhadaResultGeneration({
  resultId: 'OHADA-test-initial', generatedAt: '2026-10-01T12:00:00.000Z',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31', asOfDate: '2026-09-30', summary: { balanced: true }
}).ok, true);
assert.equal(store.ohadaResultGeneration().asOfDate, '2026-09-30', 'la date d’arrêté de la génération intermédiaire est conservée');
assert.equal(store.saveOhadaResultGeneration({ resultId: 'invalid-date', generatedAt: '2026-10-01T12:00:00.000Z', cycleStart: '2026-01-01', cycleEnd: '2026-12-31', asOfDate: '2025-12-31' }).ok, false, 'la date d’arrêté hors cycle est refusée');
assert.equal(store.saveOhadaResultGeneration({ resultId: 'invalid-calendar-date', generatedAt: '2026-10-01T12:00:00.000Z', cycleStart: '2026-01-01', cycleEnd: '2026-12-31', asOfDate: '2026-02-30' }).ok, false, 'une date inexistante du calendrier est refusée');
const result = store.createEntry({
  reference: 'OD-OHADA-STALE-TEST', journal: 'OD', date: '2026-10-02', description: 'Pièce de test du cycle de péremption',
  lines: [
    { account: '601100', debit: 125, credit: 0 },
    { account: '401100', debit: 0, credit: 125 }
  ]
}, 'posted');
assert.equal(result.ok, true, result.errors.join(' '));
assert.equal(store.ohadaResultGeneration().stale, true, 'une écriture directement créée comme validée périme la génération active');
assert.equal(events.filter(event => event.type === 'perfecto:ohada-result-stale').length, 1, 'le changement de fraîcheur déclenche une notification pour l’interface');
assert.equal(store.ohadaResultGeneration().resultId, 'OHADA-test-initial', 'la version périmée reste active et consultable');
assert.equal(store.saveOhadaResultGeneration({
  resultId: 'OHADA-test-regenerated', generatedAt: '2026-10-03T12:00:00.000Z',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31', summary: { balanced: true }
}).ok, true);
assert.equal(store.ohadaResultGeneration().stale, false, 'la nouvelle génération remplace la version active et réinitialise le statut périmé');
assert.equal(store.ohadaResultGeneration().resultId, 'OHADA-test-regenerated');
const openingAccount = store.accounts().find(account => Number(account.cls) === 1 && account.postable !== false);
assert.ok(openingAccount, 'un compte de bilan imputable existe dans le plan');
const opening = store.createOpeningBalance({
  accountCode: openingAccount.code, date: '2025-12-31', label: 'Report de test', debit: 100, credit: 0
});
assert.equal(opening.ok, true, opening.errors.join(' '));
assert.equal(store.ohadaResultGeneration().stale, true, 'la modification des reports à nouveau signale aussi une génération périmée');
store.setConfidentialAccountAccess(true);
const confidentialAccount = store.accounts().find(account => String(account.code) === String(openingAccount.code));
assert.ok(confidentialAccount);
assert.equal(store.addConfidentialAccount(confidentialAccount.code).ok, true);
store.setConfidentialAccountAccess(false);
assert.equal(store.hasHiddenConfidentialAccounts(), true, 'les comptes confidentiels masqués empêchent une génération partielle non signalée');
store.setConfidentialAccountAccess(true);
assert.equal(store.hasHiddenConfidentialAccounts(), false, 'le profil explicitement autorisé peut calculer les états complets');

console.log('OK · correspondances par dossier, état actif conservé et péremption après écriture validée');
