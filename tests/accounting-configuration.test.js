/* Configuration comptable persistée par dossier, avec contrôles de cohérence. */
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
const dossier = store.currentDossier();
const defaults = store.accountingConfiguration();
assert.equal(defaults.framework, 'SYSCOHADA révisé');
assert.equal(defaults.country, 'BENIN');
assert.equal(defaults.specificOrganization, 'Aucun');
assert.equal(defaults.entryAllowedUntil, dossier.cycleEnd);
assert.equal(defaults.decimalPlaces, 0);
assert.equal(defaults.numberingPeriod, 'year');
assert.equal(defaults.automaticClosingMonths, null);
assert.equal(defaults.supplierOrdersEnabled, false);
assert.equal(defaults.euroStatementsEnabled, false);
assert.equal(defaults.supplierSettlement.minimumDelayDays, null);
assert.equal(defaults.otherPayablesSettlement.settlementOn, '');

const saved = store.updateAccountingConfiguration({
  cycleStart: dossier.cycleStart,
  cycleEnd: dossier.cycleEnd,
  accountingConfiguration: {
    framework: 'SYSCOHADA révisé',
    country: 'BENIN',
    specificOrganization: 'Aucun',
    entryAllowedUntil: '2026-06-30',
    decimalPlaces: '2',
    numberingPeriod: 'month',
    automaticClosingMonths: '9',
    supplierSettlement: { minimumDelayDays: '30', earliestDayOfMonth: '5', settlementOn: '15' },
    otherPayablesSettlement: { minimumDelayDays: '45', earliestDayOfMonth: '10', settlementOn: '30' },
    supplierOrdersEnabled: true,
    euroStatementsEnabled: true
  }
});
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.accountingConfiguration().decimalPlaces, 2);
assert.equal(store.accountingConfiguration().numberingPeriod, 'month');
assert.equal(store.accountingConfiguration().supplierSettlement.minimumDelayDays, 30);
assert.equal(store.accountingConfiguration().supplierSettlement.earliestDayOfMonth, 5);
assert.equal(store.accountingConfiguration().otherPayablesSettlement.settlementOn, '30');
assert.equal(store.accountingConfiguration().supplierOrdersEnabled, true);
assert.equal(store.accountingConfiguration().euroStatementsEnabled, true);
assert.match(store.amount(1234.5), /,50$/, 'le nombre de décimales configuré est appliqué à l’affichage');
assert.equal(store.nextReference('OD', '2026-03-10'), 'OD-2026-03-001', 'la numérotation mensuelle suit le paramètre du dossier');

const lateEntry = store.validateEntry({
  reference: 'OD-CONFIG-LIMIT-001', journal: 'OD', date: '2026-07-01', description: 'Date après limite',
  lines: [{ account: '521100', debit: 100, credit: 0 }, { account: '101200', debit: 0, credit: 100 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(lateEntry.ok, false);
assert(lateEntry.errors.some(error => error.includes('autorisée jusqu’au 30/06/2026')));

const tooPrecise = store.validateEntry({
  reference: 'OD-CONFIG-PRECISION-001', journal: 'OD', date: '2026-03-10', description: 'Précision supérieure',
  lines: [{ account: '521100', debit: 1.234, credit: 0 }, { account: '101200', debit: 0, credit: 1.234 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(tooPrecise.ok, false);
assert(tooPrecise.errors.some(error => error.includes('plus de 2 décimale(s)')));

const fractionalDraft = store.createEntry({
  reference: 'OD-CONFIG-FRACTION-001', journal: 'OD', date: '2026-04-02', description: 'Brouillon décimal',
  lines: [{ account: '521100', debit: 1.25, credit: 0 }, { account: '101200', debit: 0, credit: 1.25 }]
}, 'draft');
assert.equal(fractionalDraft.ok, true, fractionalDraft.errors && fractionalDraft.errors.join(' '));
const lowerPrecision = store.updateAccountingConfiguration({
  cycleStart: dossier.cycleStart,
  cycleEnd: dossier.cycleEnd,
  accountingConfiguration: Object.assign({}, store.accountingConfiguration(), { decimalPlaces: 0 })
});
assert.equal(lowerPrecision.ok, false, 'une baisse de précision qui masquerait un montant historique est refusée');
assert(lowerPrecision.errors[0].includes('Choisissez une précision compatible avec l’historique'));

const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].accountingConfiguration.numberingPeriod, 'month', 'les paramètres sont sauvegardés dans le catalogue du dossier');

const expandedCycle = store.updateAccountingConfiguration({
  cycleStart: '2026-01-01',
  cycleEnd: '2027-06-30',
  accountingConfiguration: Object.assign({}, store.accountingConfiguration(), { entryAllowedUntil: '2027-06-30' })
});
assert.equal(expandedCycle.ok, true, expandedCycle.errors && expandedCycle.errors.join(' '));
assert.equal(store.currentDossier().cycleEnd, '2027-06-30');
assert.equal(store.exercise(), 2026);
assert.equal(store.periodStats(2026).length, 18, 'les 12 périodes existantes et les nouvelles périodes du cycle sont conservées');
assert.equal(store.periodStats(2027).length, 0, 'le registre de périodes reste rattaché à l’exercice de début');

const beforeUnsafeChange = store.currentDossier();
const unsafeCycle = store.updateAccountingConfiguration({
  cycleStart: '2025-01-01',
  cycleEnd: '2025-12-31',
  accountingConfiguration: Object.assign({}, store.accountingConfiguration(), { entryAllowedUntil: '2025-12-31' })
});
assert.equal(unsafeCycle.ok, false, 'un cycle excluant des écritures existantes est refusé');
assert(unsafeCycle.errors[0].includes('sortirait du nouveau cycle'));
assert.equal(store.currentDossier().cycleStart, beforeUnsafeChange.cycleStart, 'le cycle actif est conservé après refus');

const beforeStorageFailure = store.accountingConfiguration();
storageWritesBlocked = true;
const failedSave = store.updateAccountingConfiguration({
  cycleStart: store.currentDossier().cycleStart,
  cycleEnd: store.currentDossier().cycleEnd,
  accountingConfiguration: Object.assign({}, beforeStorageFailure, { framework: 'Cadre non persisté' })
});
storageWritesBlocked = false;
assert.equal(failedSave.ok, false);
assert.equal(store.accountingConfiguration().framework, beforeStorageFailure.framework, 'un échec local conserve la configuration précédente');

const newDossier = store.createDossier({
  clientName: 'Dossier isolé', clientCode: 'ISO', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(newDossier.ok, true, newDossier.errors && newDossier.errors.join(' '));
assert.equal(store.switchDossier(newDossier.dossier.id).ok, true);
assert.equal(store.accountingConfiguration().decimalPlaces, 0, 'les paramètres d’un dossier ne se propagent pas aux autres dossiers');
assert.equal(store.accountingConfiguration().numberingPeriod, 'year');

console.log('  ✓ Configuration comptable persistée par dossier et appliquée sans réécrire les pièces.');
