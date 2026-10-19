/* Diagnostic de base, réparations techniques sûres et récupération locale. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repairEngine = require('../modern-proto/js/accounting-database-repair.js');

function createStore(values = new Map()) {
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
  const sandbox = { window: { localStorage }, Intl, JSON, Date, Math, String, Number, Object, Array };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-database-repair.js'), 'utf8'), sandbox, { filename: 'accounting-database-repair.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return { store: sandbox.window.PerfectoStore, values };
}

function plain(value) { return JSON.parse(JSON.stringify(value)); }

const { store } = createStore();
const original = plain(store.getState());
const dossier = plain(store.currentDossier());
const healthy = repairEngine.inspect(original, dossier);
assert.equal(healthy.ok, true, JSON.stringify(healthy.issues));
assert.equal(healthy.summary.postedEntries, 3);
assert.equal(healthy.summary.validPostedEntries, 3);
assert.equal(healthy.summary.draftEntries, 1);
assert.equal(healthy.safeRepairNeeded, false);
assert.equal(store.repairDatabase().changed, false, 'une base propre ne crée pas de modification superflue');

const damagedPeriods = plain(original);
damagedPeriods.exercise = 2025;
damagedPeriods.periods = damagedPeriods.periods.filter(period => period.month !== 2);
damagedPeriods.periods[0].status = 'closed';
damagedPeriods.periods.push({ year: 2026, month: 1, status: 'open' });
damagedPeriods.periods.push({ year: 'invalide', month: 0, status: 'open' });
const beforeEntries = plain(damagedPeriods.entries);
const report = repairEngine.inspect(damagedPeriods, dossier);
assert.equal(report.canApplySafeRepair, true);
assert.equal(report.safeRepairNeeded, true);
assert.ok(report.issues.some(issue => issue.code === 'period-duplicate'));
assert.ok(report.issues.some(issue => issue.code === 'period-missing'));
assert.ok(report.issues.some(issue => issue.code === 'exercise-mismatch'));
const repairedPlan = repairEngine.repair(damagedPeriods, dossier);
assert.equal(repairedPlan.ok, true);
assert.equal(repairedPlan.changed, true);
assert.equal(repairedPlan.data.exercise, 2026);
assert.equal(repairedPlan.data.periods.filter(period => period.year === 2026 && period.month === 1).length, 1);
assert.equal(repairedPlan.data.periods.find(period => period.year === 2026 && period.month === 1).status, 'closed', 'une fusion de doublons ne rouvre jamais une période clôturée');
assert.ok(repairedPlan.data.periods.some(period => period.year === 2026 && period.month === 2 && period.status === 'open'));
assert.deepEqual(plain(repairedPlan.data.entries), beforeEntries, 'aucune pièce ni ligne n’est modifiée');
assert.deepEqual(damagedPeriods.entries, original.entries, 'l’analyse et le plan restent sans mutation');

const badLedger = plain(original);
badLedger.entries.find(entry => entry.status === 'posted').lines[0].debit += 1;
const ledgerReport = repairEngine.inspect(badLedger, dossier);
assert.ok(ledgerReport.issues.some(issue => issue.code === 'entry-unbalanced'));
const ledgerPlan = repairEngine.repair(badLedger, dossier);
assert.equal(ledgerPlan.ok, true, 'une réparation technique peut rester isolée des anomalies comptables');
assert.equal(ledgerPlan.changed, false);
assert.equal(ledgerPlan.data.entries[0].lines[0].debit, badLedger.entries[0].lines[0].debit, 'un montant validé n’est jamais ajusté automatiquement');

const blockedPlan = repairEngine.repair({ accounts: [], journals: [], entries: [], cycleStart: '2026-13-01', cycleEnd: '2026-12-31' }, dossier);
assert.equal(blockedPlan.ok, false, 'un cycle invalide bloque la réparation automatique');

const repairStore = createStore();
const repairState = repairStore.store.getState();
repairState.exercise = 2025;
repairState.periods = repairState.periods.filter(period => period.month !== 2);
repairState.periods[0].status = 'closed';
repairState.periods.push({ year: 2026, month: 1, status: 'open' });
repairStore.values.set(repairStore.store.currentStorageKey(), JSON.stringify(plain(repairState)));
const storeRepair = repairStore.store.repairDatabase();
assert.equal(storeRepair.ok, true, storeRepair.errors && storeRepair.errors.join(' '));
assert.equal(storeRepair.changed, true);
assert.equal(repairStore.store.backupInfo().available, true, 'un point de restauration est créé avant l’écriture réparée');
assert.equal(repairStore.store.getState().exercise, 2026);
assert.equal(repairStore.store.getState().periods.filter(period => period.year === 2026 && period.month === 1).length, 1);
assert.equal(repairStore.store.getState().periods.find(period => period.year === 2026 && period.month === 1).status, 'closed');

const metadataStore = createStore();
const metadataState = plain(metadataStore.store.getState());
delete metadataState.periods;
const metadataRaw = JSON.stringify(metadataState);
metadataStore.values.set(metadataStore.store.currentStorageKey(), metadataRaw);
const metadataReloaded = createStore(metadataStore.values);
metadataReloaded.store.getState();
assert.equal(metadataReloaded.store.databaseStorageStatus().recoveryRequired, true);
assert.equal(metadataReloaded.store.databaseStorageStatus().kind, 'metadata');
assert.equal(metadataReloaded.values.get('perfecto.lot1.v1'), metadataRaw, 'les métadonnées brutes ne sont pas écrasées au chargement');
const metadataRepair = metadataReloaded.store.repairDatabase();
assert.equal(metadataRepair.ok, true, metadataRepair.errors && metadataRepair.errors.join(' '));
assert.equal(metadataReloaded.store.databaseStorageStatus().recoveryRequired, false);
assert.equal(metadataReloaded.store.getState().periods.length, 12);
const metadataRawCopyKey = [...metadataReloaded.values.keys()].find(key => key.endsWith('.recovery.raw.v1'));
assert.equal(JSON.parse(metadataReloaded.values.get(metadataRawCopyKey)).raw, metadataRaw, 'la version brute des métadonnées est archivée avant leur réparation');

const corruptText = '{"accounts": [broken';
const corruptStore = createStore(new Map([['perfecto.lot1.v1', corruptText]]));
corruptStore.store.getState();
assert.equal(corruptStore.store.databaseStorageStatus().recoveryRequired, true);
assert.equal(corruptStore.store.databaseStorageStatus().kind, 'corrupt');
assert.equal(corruptStore.store.corruptDatabaseContents(), corruptText);
assert.equal(corruptStore.store.save(), false, 'aucune sauvegarde automatique ne doit écraser la base illisible');
assert.equal(corruptStore.values.get('perfecto.lot1.v1'), corruptText);
const initialized = corruptStore.store.reinitializeCorruptDatabase();
assert.equal(initialized.ok, true, initialized.errors && initialized.errors.join(' '));
assert.equal(corruptStore.store.databaseStorageStatus().recoveryRequired, false);
const rawRecoveryKey = [...corruptStore.values.keys()].find(key => key.endsWith('.recovery.raw.v1'));
assert.ok(rawRecoveryKey);
assert.equal(JSON.parse(corruptStore.values.get(rawRecoveryKey)).raw, corruptText, 'la donnée brute est préservée avant réinitialisation');

const backupStore = createStore();
backupStore.store.getState();
const savedEntry = backupStore.store.createEntry({
  reference: 'OD-2026-RECOVERY-001', journal: 'OD', date: '2026-03-01', description: 'Pièce avant corruption',
  lines: [{ account: '601100', debit: 500, credit: 0 }, { account: '401100', debit: 0, credit: 500 }]
}, 'posted');
assert.equal(savedEntry.ok, true);
backupStore.values.set('perfecto.lot1.v1', 'corruption');
const reloadedBackupStore = createStore(backupStore.values);
reloadedBackupStore.store.getState();
assert.equal(reloadedBackupStore.store.databaseStorageStatus().backupAvailable, true);
const restored = reloadedBackupStore.store.restoreBackup();
assert.equal(restored.ok, true, restored.errors && restored.errors.join(' '));
assert.equal(restored.preservedCorruptRaw, true);
assert.equal(reloadedBackupStore.store.entries().length, 4, 'le point valide antérieur est restauré');
assert.equal(reloadedBackupStore.store.databaseStorageStatus().recoveryRequired, false);

console.log('Réparation de base : diagnostic, immuabilité comptable, point local et récupération de données brutes — OK');
