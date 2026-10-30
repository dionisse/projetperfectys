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

const reopen = activeCyclePeriods[0];
S.setPeriod(reopen.year, reopen.month, 'open');
storageWritesBlocked = true;
const failedSave = S.closeOpenCyclePeriods();
storageWritesBlocked = false;
assert.equal(failedSave.ok, false);
assert.equal(failedSave.closedCount, 0);
assert.equal(S.periodStatus(reopen.year, reopen.month), 'open', 'échec de sauvegarde : état en mémoire restauré, aucune clôture partielle');

console.log('Clôture périodique groupée : cycle actif, relançable et atomique — OK');
