/* Arrêt définitif : contrôles préalables, sauvegarde/confirmation obligatoires et scellement irréversible. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness() {
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
  const sandbox = { window: {}, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  sandbox.window.localStorage = localStorage;
  vm.createContext(sandbox);
  ['accounting-chart.js', 'store.js', 'opening-balances.js'].forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
  });
  return {
    store: sandbox.window.PerfectoStore,
    openingBalances: sandbox.window.PerfectoOpeningBalances,
    values,
    blockStorageWrites(value) { storageWritesBlocked = value; }
  };
}

const h = createHarness();
const S = h.store;
const created = S.createDossier({
  clientName: 'Dossier arrêté', clientCode: 'ARRET', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(created.ok, true);
assert.equal(S.switchDossier(created.dossier.id).ok, true);
assert.equal(S.entries().length, 0, 'le dossier vierge n’invente aucune écriture');

let check = S.definitiveClosePreflight();
assert.equal(check.canFinalize, false);
assert.equal(check.openPeriods.length, 12, 'les douze périodes ouvertes empêchent le scellement');
assert.equal(check.draftEntryCount, 0);
assert.equal(check.postedEntryCount, 0);
assert.equal(check.balanced, true, 'aucun mouvement n’est simulé pour rendre le dossier équilibré');

const withoutEvidence = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier.json', backupJson: S.exportJson(), entriesDownloaded: true, exerciseEntriesFileName: 'ecritures-exercice.csv', exerciseEntriesCount: S.definitiveClosePreflight().postedEntryCount, confirmation: 'ARRET DEFINITIF DES COMPTES'
});
assert.equal(withoutEvidence.ok, false, 'aucun arrêt possible avant clôture des périodes');
assert.equal(S.definitiveClosePreflight().finalized, false);

assert.equal(S.closeOpenCyclePeriods().ok, true);
check = S.definitiveClosePreflight();
assert.equal(check.canFinalize, true, check.errors.join(' '));
assert.equal(check.closedPeriodCount, 12);
const staleBackup = S.exportJson();
assert.equal(S.addAccount({ code: '777777', label: 'Compte avant sauvegarde', nature: 'Charge' }).ok, true);
const staleCopyResult = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier-perime.json', backupJson: staleBackup, confirmation: 'ARRET DEFINITIF DES COMPTES'
});
assert.equal(staleCopyResult.ok, false, 'une sauvegarde antérieure à une modification comptable est refusée');
assert.match(staleCopyResult.errors.join(' '), /à jour/);

const missingAcknowledgement = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: false, backupFileName: 'dossier.json', backupJson: S.exportJson(), entriesDownloaded: true, exerciseEntriesFileName: 'ecritures-exercice.csv', exerciseEntriesCount: S.definitiveClosePreflight().postedEntryCount, confirmation: 'ARRET DEFINITIF DES COMPTES'
});
assert.equal(missingAcknowledgement.ok, false);
assert.match(missingAcknowledgement.errors.join(' '), /Confirmez explicitement/);
const wrongConfirmation = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier.json', backupJson: S.exportJson(), entriesDownloaded: true, exerciseEntriesFileName: 'ecritures-exercice.csv', exerciseEntriesCount: S.definitiveClosePreflight().postedEntryCount, confirmation: 'OUI'
});
assert.equal(wrongConfirmation.ok, false);
assert.match(wrongConfirmation.errors.join(' '), /Saisissez exactement/);
const missingEntriesFile = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier.json', backupJson: S.exportJson(),
  confirmation: 'ARRET DEFINITIF DES COMPTES'
});
assert.equal(missingEntriesFile.ok, false, 'le fichier complet des écritures est une condition obligatoire distincte du JSON');
assert.match(missingEntriesFile.errors.join(' '), /fichier complet des écritures/);

h.blockStorageWrites(true);
const failedSave = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier.json', backupJson: S.exportJson(), entriesDownloaded: true, exerciseEntriesFileName: 'ecritures-exercice.csv', exerciseEntriesCount: S.definitiveClosePreflight().postedEntryCount, confirmation: 'ARRET DEFINITIF DES COMPTES'
});
h.blockStorageWrites(false);
assert.equal(failedSave.ok, false, 'un échec de persistance annule atomiquement le scellement');
assert.equal(S.definitiveClosePreflight().finalized, false);

const finalized = S.finalizeDefinitiveClose({
  backupDownloaded: true, backupAcknowledged: true, backupFileName: 'dossier-sauvegarde.json', backupJson: S.exportJson(), entriesDownloaded: true, exerciseEntriesFileName: 'ecritures-exercice.csv', exerciseEntriesCount: S.definitiveClosePreflight().postedEntryCount, confirmation: 'ARRET DEFINITIF DES COMPTES'
});
assert.equal(finalized.ok, true, finalized.errors && finalized.errors.join(' '));
assert.equal(finalized.record.backupAcknowledged, true);
assert.equal(finalized.record.backupFileName, 'dossier-sauvegarde.json');
assert.equal(finalized.record.exerciseEntriesFileName, 'ecritures-exercice.csv');
assert.equal(finalized.record.exerciseEntriesCount, 0);
assert.equal(S.entries().length, 0, 'l’arrêt n’ajoute aucune écriture de clôture');
assert.equal(S.definitiveClosePreflight().finalized, true);
assert.equal(S.definitiveClosePreflight().canFinalize, false);
assert.equal(S.reopenClosedCyclePeriods().ok, false, 'la réouverture est irréversiblement interdite');
assert.equal(S.setPeriod(2026, 1, 'open'), null, 'le registre de périodes reste scellé');
assert.equal(S.updateAccountingConfiguration({ cycleStart: '2025-01-01', cycleEnd: '2025-12-31' }).ok, false, 'le cycle ne peut pas être déplacé pour contourner le scellement');
assert.equal(S.addAccount({ code: '777777', label: 'Compte test après arrêt', nature: 'Charge' }).ok, false, 'les écritures dans le dossier scellé sont rejetées');
S.reset();
assert.equal(S.definitiveClosePreflight().finalized, true, 'la réinitialisation ne peut effacer l’arrêt définitif');
assert.equal(S.entries().length, 0);

const nonContiguousNext = S.nextExercisePreflight('2027-01-02', '2027-12-31');
assert.equal(nonContiguousNext.canCreate, false, 'un intervalle entre N et N+1 n’est pas automatiquement comblé');
assert.match(nonContiguousNext.errors.join(' '), /lendemain/);
const nextPreflight = S.nextExercisePreflight();
assert.equal(nextPreflight.canCreate, true, nextPreflight.errors.join(' '));
assert.equal(nextPreflight.targetStart, '2027-01-01', 'N+1 démarre par défaut le 1er janvier de l’année suivante');
assert.equal(nextPreflight.targetEnd, '2027-12-31', 'N+1 se termine par défaut le 31 décembre');
const sourceAccountCount = S.accounts().length;
const sealedSourceBeforeNext = JSON.stringify({ entries: S.entries(), periods: S.periods(), accounts: S.accounts() });
const nextExercise = S.createNextExerciseDossier();
assert.equal(nextExercise.ok, true, nextExercise.errors && nextExercise.errors.join(' '));
assert.equal(nextExercise.created, true);
assert.equal(Object.prototype.hasOwnProperty.call(nextExercise.dossier, 'confidentialAccountsConfiguration'), false, 'la nouvelle API ne divulgue pas le paramétrage confidentiel');
assert.equal(S.currentDossier().cycleStart, '2027-01-01');
assert.equal(S.currentDossier().cycleEnd, '2027-12-31');
assert.equal(nextExercise.dossier.exerciseContinuity.relationship, 'next-exercise');
assert.equal(nextExercise.dossier.exerciseContinuity.previousDossierId, created.dossier.id, 'la liaison persistante est conservée dans les métadonnées du dossier cible');
assert.equal(nextExercise.dossier.exerciseContinuity.targetCycleStart, '2027-01-01');
const persistedCatalog = JSON.parse(h.values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog.find(dossier => dossier.id === nextExercise.dossier.id).exerciseContinuity.previousDossierId, created.dossier.id, 'le lien est réellement écrit dans le catalogue persistant, indépendamment des reports');
assert.equal(S.entries().length, 0, 'les écritures de N ne sont pas copiées dans N+1');
assert.equal(S.accounts().length, sourceAccountCount, 'le plan comptable explicite est repris sans copier les mouvements');
assert.equal(S.periods().every(period => period.status === 'open'), true, 'les périodes du nouveau cycle sont ouvertes');
assert.equal(nextExercise.sourceDossierId, created.dossier.id);
const sourceSnapshot = S.readDossierStateSnapshot(created.dossier.id);
assert.equal(sourceSnapshot.ok, true, sourceSnapshot.errors && sourceSnapshot.errors.join(' '));
const transferPlan = h.openingBalances.buildTransfer(sourceSnapshot.state, sourceSnapshot.dossier, S.currentDossier(), S.accounts());
assert.equal(transferPlan.ok, true, transferPlan.errors.join(' '));
assert.equal(transferPlan.targetDate, '2027-01-01');
const sharedPreview = S.openingBalanceTransferPreview(created.dossier.id, transferPlan.accountBalances, transferPlan.rows);
assert.ok(Array.isArray(sharedPreview.decisions), 'l’aperçu de N+1 passe par le même registre Reports à nouveau');
const sealedSourceAfterNext = S.readDossierStateSnapshot(created.dossier.id);
assert.equal(sealedSourceAfterNext.ok, true);
assert.equal(JSON.stringify({ entries: sealedSourceAfterNext.state.entries, periods: sealedSourceAfterNext.state.periods, accounts: sealedSourceAfterNext.state.accounts }), sealedSourceBeforeNext, 'la création et la liaison ne modifient pas l’état comptable scellé de N');
assert.equal(S.switchDossier(created.dossier.id).ok, true);
const existingNextPreflight = S.nextExercisePreflight();
assert.equal(existingNextPreflight.canContinue, true);
assert.equal(existingNextPreflight.linkedSuccessor.id, nextExercise.dossier.id, 'N découvre durablement son successeur à partir du lien stocké dans N+1');
assert.equal(existingNextPreflight.canCreate, false, 'un dossier successeur lié interdit la création d’un doublon');
assert.equal(Object.prototype.hasOwnProperty.call(existingNextPreflight.existingDossier, 'confidentialAccountsConfiguration'), false, 'l’aperçu ne divulgue pas la configuration confidentielle du dossier cible');
const reusedExercise = S.createNextExerciseDossier();
assert.equal(reusedExercise.ok, true, reusedExercise.errors && reusedExercise.errors.join(' '));
assert.equal(reusedExercise.created, false, 'un second passage réutilise le même dossier au lieu de créer un doublon');
assert.equal(reusedExercise.dossier.id, nextExercise.dossier.id);

const navigation = require('../modern-proto/js/accounting-navigation.js');
const closeTab = navigation.getTab('fin-exercice', 'definitive-close');
assert.ok(closeTab);
assert.equal(closeTab.status, 'active');
assert.equal(closeTab.irreversible, true);
const nextYearTab = navigation.getTab('fin-exercice', 'next-year');
assert.ok(nextYearTab);
assert.equal(nextYearTab.status, 'partial');
const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
assert.match(app, /function viewDefinitiveClose\(\)/);
assert.match(app, /group\.id === 'fin-exercice' && tab\.id === 'definitive-close'/);
assert.match(app, /download-definitive-close-backup/);
assert.match(app, /download-definitive-close-entries/);
assert.match(app, /PERFECTO-ÉCHANGE v1/);
assert.match(app, /finalize-definitive-close/);
assert.match(app, /ARRET DEFINITIF DES COMPTES/);
assert.match(app, /function viewNextYear\(\)/);
assert.match(app, /group\.id === 'fin-exercice' && tab\.id === 'next-year'/);
assert.match(app, /Lien permanent enregistré/);
assert.match(app, /function openLinkedExercise\(dossierId\)/);
assert.match(app, /opening-balance-continuity/);
assert.match(app, /data-action=\"open-linked-exercise\"/);
assert.match(app, /navigate\('#\/menu\?g=fin-exercice&t=opening-transfer&c=opening-transfer-build'\)/);
assert.match(app, /function viewOpeningTransferBuild\(\)[\s\S]*viewOpeningBalances\(\)/);
assert.match(app, /Le transfert vers N\+1 exige un arrêt définitif enregistré/);

console.log('Arrêt définitif et passage N+1 : contrôles, dates par défaut, création idempotente et reports partagés vérifiés.');
