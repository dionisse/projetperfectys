/* Registre préparatoire des déductions et réintégrations, sans calcul fiscal ni transfert déclaratif. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const stored = Object.create(null);
let storageWritesBlocked = false;
const sandbox = {
  window: {},
  localStorage: {
    getItem(key) { return Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : null; },
    setItem(key, value) {
      if (storageWritesBlocked) throw new Error('quota simulé');
      stored[key] = String(value);
    },
    removeItem(key) { delete stored[key]; }
  },
  Intl, console, JSON, Date, Math, String, Number, Object, Array, RegExp
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.global = sandbox;
vm.createContext(sandbox);
['accounting-chart.js', 'store.js'].forEach(file => {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
});

const S = sandbox.window.PerfectoStore;
assert.deepEqual(Array.from(S.taxAdjustments()), [], 'aucun ajustement d’exemple n’est prérempli');
assert.equal(S.createTaxAdjustment({ direction: 'deduction', description: 'Montant invalide', amount: '1.5' }).ok, false);
assert.equal(S.createTaxAdjustment({ direction: 'invented', description: 'Qualification invalide', amount: 1 }).ok, false);
assert.equal(S.createTaxAdjustment({ direction: 'reintegration', description: '', amount: 1 }).ok, false);

const created = S.createTaxAdjustment({
  direction: 'reintegration', description: 'Élément à examiner avec pièces justificatives', amount: '125000',
  sourceDocument: 'OD-2026-04', taxReference: 'Référence saisie par l’utilisateur'
});
assert.equal(created.ok, true, (created.errors || []).join(' '));
assert.equal(created.taxAdjustment.direction, 'reintegration');
assert.equal(created.taxAdjustment.amount, 125000);
assert.equal(created.taxAdjustment.cycleStart, S.currentDossier().cycleStart);
assert.equal(S.taxAdjustments().length, 1);
assert.equal(S.taxAdjustmentReviews().length, 0);
assert.equal(S.entries().length, 4, 'la saisie au registre ne crée aucune écriture comptable');

const updated = S.updateTaxAdjustment(created.taxAdjustment.id, {
  direction: 'deduction', description: 'Qualification à discuter avec le justificatif', amount: 90000,
  sourceDocument: 'FACT-123', taxReference: ''
});
assert.equal(updated.ok, true, (updated.errors || []).join(' '));
assert.equal(S.taxAdjustments()[0].direction, 'deduction');
assert.equal(S.taxAdjustments()[0].amount, 90000);

storageWritesBlocked = true;
const failedCreate = S.createTaxAdjustment({ direction: 'to-qualify', description: 'Non enregistré', amount: 1 });
storageWritesBlocked = false;
assert.equal(failedCreate.ok, false);
assert.equal(S.taxAdjustments().length, 1, 'une erreur de sauvegarde ne laisse pas une ligne fantôme en mémoire');
const sourceEntry = S.entries().find(entry => entry && entry.status === 'posted');
assert.ok(sourceEntry && sourceEntry.lines.length);
const review = S.saveTaxAdjustmentReview({ sourceEntryId: sourceEntry.id, sourceLineIndex: 0, ruleId: 'is-profit-tax', decision: 'override', overrideAmount: 250, note: 'Correction documentée' });
assert.equal(review.ok, true, (review.errors || []).join(' '));
assert.equal(S.taxAdjustmentReviews().length, 1);
assert.equal(S.saveTaxAdjustmentReview({ sourceEntryId: sourceEntry.id, sourceLineIndex: 1, ruleId: 'is-exempt-security-income', decision: 'article15-government', overrideAmount: 100, note: '' }).ok, false, 'la confirmation article 15 exige une justification');
assert.equal(S.deleteTaxAdjustmentReview(sourceEntry.id, 0, 'is-profit-tax').ok, true);
assert.equal(S.taxAdjustmentReviews().length, 0);

const removed = S.deleteTaxAdjustment(created.taxAdjustment.id);
assert.equal(removed.ok, true);
assert.deepEqual(Array.from(S.taxAdjustments()), []);
assert.equal(S.entries().length, 4, 'suppression du registre sans effet sur les écritures');

console.log('Ajustements fiscaux : registre isolé par cycle, validation des saisies, CRUD et absence d’écriture — OK');
