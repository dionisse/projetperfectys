/* Référentiels analytiques vides par défaut, locaux au dossier et protégés par les usages. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array, Set, Map };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
}
const S = sandbox.window.PerfectoStore;
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalDimensionValuesConfiguration().rows)), [], 'aucune valeur n’est préremplie.');

const saved = S.saveAnalyticalDimensionValues('activity-domains', [
  { label: 'Production agricole', active: true },
  { label: 'Services', active: true },
  { label: 'Ancienne activité', active: false }
]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalDimensionValuesConfiguration('activity-domains').rows.map(row => [row.natureId, row.label, row.active]))), [
  ['activity-domains', 'Production agricole', true],
  ['activity-domains', 'Services', true],
  ['activity-domains', 'Ancienne activité', false]
]);

const duplicate = S.saveAnalyticalDimensionValues('activity-domains', [
  { label: 'Activité', active: true }, { label: 'activite', active: true }
]);
assert.equal(duplicate.ok, false);
assert.match(duplicate.errors.join(' '), /répétée/);
const unknownNature = S.saveAnalyticalDimensionValues('not-a-real-nature', [{ label: 'Valeur' }]);
assert.equal(unknownNature.ok, false);

const posted = S.createEntry({
  reference: 'OD-ANALYTIC-DOMAIN', journal: 'OD', date: '2026-05-01', description: 'Test du référentiel',
  lines: [
    { account: '601100', debit: 100, credit: 0, analyticSplits: [{
      natureId: 'activity-domains', mode: 'amount', completeness: 'complete',
      allocations: [{ valueLabel: 'Production agricole', value: '100' }]
    }] },
    { account: '401100', debit: 0, credit: 100 }
  ]
}, 'posted');
assert.equal(posted.ok, true, posted.errors && posted.errors.join(' '));
const deletion = S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Services', active: true }]);
assert.equal(deletion.ok, false);
assert.match(deletion.errors.join(' '), /utilisée par une écriture/);
const rename = S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Production', active: true }, { label: 'Services', active: true }]);
assert.equal(rename.ok, false);
assert.match(rename.errors.join(' '), /ne peut pas être supprimée\/renommée/);
const archive = S.saveAnalyticalDimensionValues('activity-domains', [
  { label: 'Production agricole', active: false }, { label: 'Services', active: true }
]);
assert.equal(archive.ok, true, archive.errors && archive.errors.join(' '));
assert.equal(S.analyticalDimensionValuesConfiguration('activity-domains').rows[0].active, false);

const funding = S.saveAnalyticalDimensionValues('funding-sources', [{ label: 'Financement utilisateur', active: true }]);
assert.equal(funding.ok, true, funding.errors && funding.errors.join(' '));
assert.equal(S.analyticalDimensionValuesConfiguration('activity-domains').rows.length, 2);
assert.equal(S.analyticalDimensionValuesConfiguration('funding-sources').rows.length, 1);

const sourceDossierId = S.currentDossier().id;
const newDossier = S.createDossier({
  clientName: 'Dossier valeurs vides', clientCode: 'VAL', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(newDossier.ok, true, newDossier.errors && newDossier.errors.join(' '));
assert.equal(S.switchDossier(newDossier.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalDimensionValuesConfiguration().rows)), [], 'les listes ne sont pas copiées dans un autre dossier.');
assert.equal(S.switchDossier(sourceDossierId).ok, true);

console.log('Valeurs analytiques : saisie libre, doublons, suggestions, protection des usages, archivage et isolation — OK');
