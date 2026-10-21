/* Comptes confidentiels : liste par dossier, droits superviseur et masquage transversal des lectures comptables. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function createHarness(sharedValues) {
  const values = sharedValues || new Map();
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
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return {
    store: sandbox.window.PerfectoStore,
    values,
    blockStorageWrites(value) { storageWritesBlocked = value; }
  };
}

const h = createHarness();
const S = h.store;
assert.equal(S.confidentialAccountsConfiguration().rows.length, 0, 'sans accès superviseur, la liste n’est pas exposée');
assert.equal(S.addConfidentialAccount('601').ok, false, 'un profil non superviseur ne peut pas ajouter un compte');

S.setConfidentialAccountAccess(true);
const dossier = S.createDossier({
  clientName: 'Dossier confidentiel', clientCode: 'CONF', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(dossier.ok, true, dossier.errors && dossier.errors.join(' '));
assert.equal(S.switchDossier(dossier.dossier.id).ok, true);
S.setConfidentialAccountAccess(true);
const accountCount = S.accounts().length;
assert.equal(S.addConfidentialAccount('999999').ok, false, 'le compte doit déjà appartenir au plan comptable');
assert.equal(S.addConfidentialAccount('601').ok, true, 'un compte existant peut être ajouté à la liste');
assert.equal(S.addConfidentialAccount('601').ok, false, 'un compte ne peut pas être ajouté deux fois');
assert.equal(S.accounts().length, accountCount, 'le paramétrage ne crée aucun compte');
assert.equal(S.getState().entries.length, 0, 'le paramétrage ne crée ni ne modifie d’écriture');
assert.equal(JSON.stringify(S.confidentialAccountsConfiguration().rows), JSON.stringify([{ accountCode: '601' }]));

S.getState().entries.push({
  id: 'confidential-entry', reference: 'OD-CONF-01', journal: 'OD', date: '2026-02-02', status: 'posted',
  lines: [{ account: '601', debit: 500, credit: 0 }, { account: '401', debit: 0, credit: 500 }]
});
assert.equal(S.save(), true);

S.setConfidentialAccountAccess(false);
assert.equal(S.confidentialAccountsConfiguration().rows.length, 0, 'un profil non superviseur ne peut pas consulter la configuration');
assert.equal(S.account('601'), null, 'le compte confidentiel est masqué du plan comptable');
assert.equal(S.accounts().some(account => account.code === '601'), false);
assert.equal(S.entry('confidential-entry'), null, 'la pièce confidentielle est masquée');
assert.equal(S.entries().some(entry => entry.id === 'confidential-entry'), false);
assert.equal(S.postedEntries().some(entry => entry.id === 'confidential-entry'), false);
assert.equal(JSON.stringify(S.ledger('401')), JSON.stringify({ rows: [], debit: 0, credit: 0, balance: 0 }), 'la contrepartie du compte confidentiel ne ressort pas au grand livre');
assert.equal(S.balance().some(row => row.code === '401' || row.code === '601'), false, 'l’écriture entière est exclue de la balance, y compris sa contrepartie');
assert.equal(S.kpis().debit, 0, 'les totaux du tableau de bord excluent l’écriture entière');
assert.equal(S.journalStats().find(row => row.journal.code === 'OD').count, 0, 'les statistiques de journal ne comptent pas la pièce confidentielle');
assert.equal(S.periodStats(2026).reduce((count, row) => count + row.count, 0), 0, 'les statistiques périodiques ne comptent pas la pièce confidentielle');
assert.equal(S.visibleState().entries.length, 0, 'l’état destiné à l’interface est filtré');
assert.equal(S.visibleState().accounts.some(account => account.code === '601'), false);
assert.equal(S.currentDossier().confidentialAccountsConfiguration, undefined, 'la configuration est absente du contexte dossier exposé aux autres profils');
const safeExport = JSON.parse(S.exportJson());
assert.equal(safeExport.data.entries.some(entry => entry.id === 'confidential-entry'), false, 'l’export destiné à un profil non superviseur est filtré');
assert.equal(JSON.stringify(safeExport).includes('OD-CONF-01'), false);
assert.equal(JSON.stringify(safeExport).includes('601'), false);
assert.equal(S.importJson(S.exportJson()).ok, false, 'la restauration complète est bloquée pour un profil non superviseur si une liste confidentielle existe');
assert.equal(S.createEntry({ lines: [{ account: '601', debit: 10, credit: 0 }] }, 'draft').ok, false, 'une nouvelle pièce ne peut pas utiliser un compte confidentiel');
assert.equal(S.previewExchangeImport([{ lines: [{ account: '601', debit: 10, credit: 0 }] }], 'draft').ok, false, 'un import ne peut pas prévisualiser le compte confidentiel');
assert.equal(S.addConfidentialAccount('411').ok, false, 'un profil non superviseur ne peut pas modifier la liste');
assert.equal(S.deleteAccount('601').ok, false, 'un compte marqué ne peut pas être supprimé directement du plan comptable');

S.setConfidentialAccountAccess(true);
assert.equal(S.account('601').code, '601', 'le Superviseur général conserve la consultation complète');
assert.equal(S.entry('confidential-entry').id, 'confidential-entry');
const beforeEditAccounts = S.accounts().length;
const edited = S.updateConfidentialAccount('601', '411');
assert.equal(edited.ok, true, edited.errors && edited.errors.join(' '));
assert.equal(S.confidentialAccountsConfiguration().rows.length, 1, 'la modification remplace la sélection sans action de retrait séparée');
assert.equal(S.confidentialAccountsConfiguration().rows[0].accountCode, '411');
assert.equal(S.accounts().length, beforeEditAccounts, 'modifier la liste ne modifie pas le plan comptable');
assert.equal(typeof S.removeConfidentialAccount, 'undefined', 'aucune opération de retrait n’est exposée');

S.setConfidentialAccountAccess(false);
assert.equal(S.account('411'), null, 'la nouvelle sélection est masquée après l’édition');
assert.equal(S.account('601').code, '601', 'le compte remplacé n’est plus confidentiel');
assert.equal(S.entry('confidential-entry').id, 'confidential-entry', 'la pièce ne contient plus le compte désormais marqué');
S.setConfidentialAccountAccess(true);
S.getState().entries.push({
  id: 'confidential-entry-after-edit', reference: 'OD-CONF-02', journal: 'OD', date: '2026-02-04', status: 'posted',
  lines: [{ account: '411', debit: 125, credit: 0 }, { account: '401', debit: 0, credit: 125 }]
});
assert.equal(S.save(), true);

const secondDossier = S.createDossier({
  clientName: 'Dossier confidentiel distinct', clientCode: 'CONF2', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(secondDossier.ok, true, secondDossier.errors && secondDossier.errors.join(' '));
assert.equal(S.switchDossier(secondDossier.dossier.id).ok, true);
S.setConfidentialAccountAccess(false);
const sourceSnapshot = S.readDossierStateSnapshot(dossier.dossier.id);
assert.equal(sourceSnapshot.ok, true, sourceSnapshot.errors && sourceSnapshot.errors.join(' '));
assert.equal(sourceSnapshot.state.entries.some(entry => entry.id === 'confidential-entry-after-edit'), false, 'les lectures d’un autre dossier filtrent aussi les pièces confidentielles');
assert.equal(sourceSnapshot.dossier.confidentialAccountsConfiguration, undefined, 'la configuration source reste réservée au Superviseur général');
S.setConfidentialAccountAccess(true);
assert.equal(S.confidentialAccountsConfiguration().rows.length, 0, 'la configuration n’est pas partagée entre dossiers');
assert.equal(S.accounts().length, accountCount, 'le second dossier conserve son propre plan');
assert.equal(S.switchDossier(dossier.dossier.id).ok, true);
S.setConfidentialAccountAccess(true);
assert.equal(S.confidentialAccountsConfiguration().rows[0].accountCode, '411', 'la configuration initiale persiste après changement de dossier');

h.blockStorageWrites(true);
const failedSave = S.updateConfidentialAccount('411', '601');
h.blockStorageWrites(false);
assert.equal(failedSave.ok, false, 'une erreur de stockage refuse la modification');
assert.equal(S.confidentialAccountsConfiguration().rows[0].accountCode, '411', 'la valeur précédente reste intacte après échec de sauvegarde');
assert.equal(S.getState().entries.length, 2, 'les écritures ne sont pas modifiées par les échecs de paramétrage');

const reloaded = createHarness(h.values).store;
reloaded.setConfidentialAccountAccess(true);
assert.equal(reloaded.confidentialAccountsConfiguration().rows[0].accountCode, '411', 'la configuration persiste après rechargement');
assert.equal(reloaded.accounts().length, accountCount, 'aucun compte n’a été ajouté au plan');

console.log('  ✓ Liste confidentielle par dossier, droits Superviseur, masquage des écritures et rapports, et absence d’opération comptable validés.');
