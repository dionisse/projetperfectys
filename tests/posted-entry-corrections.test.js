/* Corrections des pièces validées : fenêtre de deux pièces suivantes, motif et historique. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');

const storage = new Map();
const sandbox = { window: {}, localStorage: {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
}, Intl, JSON, Date, Math, String, Number, Object, Array };
sandbox.window.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
}
const S = sandbox.window.PerfectoStore;
const date = S.currentDossier().cycleStart;
function payload(reference, debitAccount = '601', amount = 100) {
  return { reference, journal: 'OD', date, description: 'Pièce de test ' + reference, lines: [
    { account: debitAccount, debit: amount, credit: 0 },
    { account: '401', debit: 0, credit: amount }
  ] };
}
function post(reference) {
  const result = S.createEntry(payload(reference), 'posted');
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  return result.entry;
}

const first = post('SEQ-A');
const second = post('SEQ-B');
const third = post('SEQ-C');
assert.equal(S.postedEntryEditPreflight(first.id).canEdit, true, 'deux pièces validées après la cible restent dans la fenêtre');
assert.equal(S.postedEntryEditPreflight(first.id).laterPostedCount, 2);
const fourth = post('SEQ-D');
assert.equal(S.postedEntryEditPreflight(first.id).canEdit, false, 'la troisième pièce validée suivante ferme la fenêtre');
assert.equal(S.postedEntryEditPreflight(first.id).laterPostedCount, 3);
assert.equal(S.postedEntryEditPreflight(second.id).canEdit, true, 'la pièce B reste corrigeable avec deux pièces suivantes');
assert.equal(S.postedEntryEditPreflight(third.id).canEdit, true);
assert.equal(S.postedEntryEditPreflight(fourth.id).canEdit, true);

const noReason = S.updatePostedEntry(second.id, Object.assign({}, payload(second.reference), { description: 'Correction' }), '');
assert.equal(noReason.ok, false, 'le motif de correction est obligatoire');
const secondDraft = S.entry(second.id);
const beforePostedAt = secondDraft.postedAt;
const revised = S.updatePostedEntry(second.id, Object.assign({}, payload(second.reference), { description: 'Libellé corrigé' }), 'Libellé initial erroné');
assert.equal(revised.ok, true, revised.errors && revised.errors.join(' '));
assert.equal(revised.entry.status, 'posted', 'une correction maintient la pièce validée');
assert.equal(revised.entry.postedAt, beforePostedAt, 'l’ordre de validation ne change pas après correction');
assert.equal(revised.entry.revisionHistory.length, 1);
assert.equal(revised.entry.revisionHistory[0].reason, 'Libellé initial erroné');
assert.equal(revised.entry.revisionHistory[0].before.description, secondDraft.description);
assert.equal(revised.entry.revisionHistory[0].after.description, 'Libellé corrigé');
assert.equal(S.postedEntryEditPreflight(second.id).revisionCount, 1);
const forbiddenOldEdit = S.updatePostedEntry(first.id, Object.assign({}, payload(first.reference), { description: 'Trop tard' }), 'Correction tardive');
assert.equal(forbiddenOldEdit.ok, false);
assert.match(forbiddenOldEdit.errors.join(' '), /plus de deux pièces/);

// Pour une acquisition portée sur un compte brut configuré, la fiche d’immobilisation précède la validation.
const assetDraft = S.createEntry(payload('ASSET-SOURCE', '242', 1500), 'draft');
assert.equal(assetDraft.ok, true, assetDraft.errors && assetDraft.errors.join(' '));
const withoutAsset = S.postEntry(assetDraft.entry.id);
assert.equal(withoutAsset.ok, false);
assert.match(withoutAsset.errors.join(' '), /fiche d’immobilisation/);
const asset = S.createFixedAsset({
  name: 'Actif lié au test', assetType: 'corporelle', status: 'en-cours',
  acquisitionDate: date, grossCost: '1500', assetAccountCode: '242',
  sourceEntryId: assetDraft.entry.id, sourceEntryLineIndex: 0,
  sourceEntryLineAccountCode: '242', sourceEntryLineAmount: 1500
});
assert.equal(asset.ok, true, asset.errors && asset.errors.join(' '));
assert.equal(S.postEntry(assetDraft.entry.id).ok, true, 'la pièce est validable après liaison de la fiche immobilisée à sa ligne source');
assert.equal(S.fixedAsset(asset.fixedAsset.id).sourceEntryId, assetDraft.entry.id);
assert.match(appSource, /function fixedAssetEntryCandidates\(entry\)/);
assert.match(appSource, /function openFixedAssetForEntry\(entryId\)/);
assert.match(appSource, /data-mode="amend-posted"/);
assert.match(appSource, /id="e-amendment-reason"/);
assert.match(appSource, /entryRevisionSnapshotHtml\(revision\.before, 'Avant'\)/);

console.log('Corrections de pièces validées et préalable fiche immobilisée : règles et historique vérifiés.');
