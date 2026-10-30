/* Clôture groupée des périodes : cycle actif, idempotence et sauvegarde atomique. */
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
const year = S.exercise();
const activeCyclePeriods = S.periodStats(year);
assert.ok(activeCyclePeriods.length > 0, 'le dossier fournit les périodes du cycle actif');
S.ensureYear(year - 1);
assert.equal(S.periodStatus(year - 1, 12), 'open', 'prépare une période hors cycle qui ne doit pas être clôturée');

const firstOpen = activeCyclePeriods.find(period => period.status === 'open');
if (firstOpen) S.setPeriod(firstOpen.year, firstOpen.month, 'closed');
const stillOpen = S.periodStats(year).filter(period => period.status === 'open');
const entriesBefore = JSON.stringify(S.entries());
const closed = S.closeOpenCyclePeriods();
assert.equal(closed.ok, true);
assert.equal(closed.closedCount, stillOpen.length);
assert.equal(S.periodStats(year).filter(period => period.status === 'open').length, 0);
assert.equal(S.periodStatus(year - 1, 12), 'open', 'les mois hors cycle restent inchangés');
assert.equal(JSON.stringify(S.entries()), entriesBefore, 'la clôture des périodes ne modifie aucune pièce');
assert.deepEqual(Array.from(closed.periods, item => item.year + '-' + item.month), Array.from(stillOpen, item => item.year + '-' + item.month));

const repeated = S.closeOpenCyclePeriods();
assert.equal(repeated.ok, true);
assert.equal(repeated.closedCount, 0, 'une relance ne change pas les périodes déjà clôturées');

const reopened = S.reopenClosedCyclePeriods();
assert.equal(reopened.ok, true);
assert.equal(reopened.reopenedCount, activeCyclePeriods.length, 'toutes les périodes clôturées du cycle sont réouvertes ensemble');
assert.equal(S.periodStats(year).filter(period => period.status === 'closed').length, 0);
assert.equal(S.periodStatus(year - 1, 12), 'open', 'la réouverture ne touche pas les mois hors cycle');
assert.equal(JSON.stringify(S.entries()), entriesBefore, 'la réouverture ne modifie aucune pièce');
const repeatedReopen = S.reopenClosedCyclePeriods();
assert.equal(repeatedReopen.ok, true);
assert.equal(repeatedReopen.reopenedCount, 0, 'une relance ne change pas les périodes déjà ouvertes');

const sample = activeCyclePeriods[0];
S.setPeriod(sample.year, sample.month, 'closed');
storageWritesBlocked = true;
const failedReopen = S.reopenClosedCyclePeriods();
storageWritesBlocked = false;
assert.equal(failedReopen.ok, false);
assert.equal(failedReopen.reopenedCount, 0);
assert.equal(S.periodStatus(sample.year, sample.month), 'closed', 'échec de sauvegarde : aucune réouverture partielle');
const reopenedSingle = S.reopenClosedCyclePeriods();
assert.equal(reopenedSingle.ok, true);
assert.equal(reopenedSingle.reopenedCount, 1);

S.setPeriod(sample.year, sample.month, 'open');
storageWritesBlocked = true;
const failedClose = S.closeOpenCyclePeriods();
storageWritesBlocked = false;
assert.equal(failedClose.ok, false);
assert.equal(failedClose.closedCount, 0);
assert.equal(S.periodStatus(sample.year, sample.month), 'open', 'échec de sauvegarde : état en mémoire restauré, aucune clôture partielle');

console.log('Clôture périodique groupée : fermeture/réouverture du cycle, idempotence et atomicité — OK');
