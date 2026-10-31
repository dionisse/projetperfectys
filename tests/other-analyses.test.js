/* Les emplacements « Autres analyses » se nomment et se paramètrent explicitement par dossier. */
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
const Report = require('../modern-proto/js/journal-lines-report.js');
const defaults = S.analyticalNaturesConfiguration();
for (const [id, label] of [['analysis-3', 'Analyse 3'], ['analysis-4', 'Analyse 4'], ['analysis-5', 'Analyse 5']]) {
  const nature = defaults.rows.find(row => row.id === id);
  assert.equal(nature.genericName, label);
  assert.equal(nature.individualName, label);
  assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalDimensionValuesConfiguration(id).rows)), [], 'aucune valeur n’est prédéfinie pour ' + id);
}

const configuredNames = defaults.rows.map(row => row.id === 'analysis-3'
  ? { ...row, genericName: 'Projets', individualName: 'Projet' }
  : row.id === 'analysis-4'
    ? { ...row, genericName: 'Canaux', individualName: 'Canal' }
    : row);
const namesSaved = S.saveAnalyticalNaturesConfiguration({ rows: configuredNames });
assert.equal(namesSaved.ok, true, namesSaved.errors && namesSaved.errors.join(' '));
assert.equal(S.analyticalNaturesConfiguration().rows.find(row => row.id === 'analysis-3').individualName, 'Projet');

assert.equal(S.saveAnalyticalDimensionValues('analysis-3', [
  { label: 'Projet pilote', active: true }, { label: 'Projet historique', active: false }
]).ok, true);
assert.equal(S.saveAnalyticalDimensionValues('analysis-4', [
  { label: 'Vente directe', active: true }
]).ok, true);
assert.equal(S.analyticalDimensionValuesConfiguration('analysis-3').rows.length, 2);
assert.equal(S.analyticalDimensionValuesConfiguration('analysis-4').rows.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalDimensionValuesConfiguration('analysis-5').rows)), [], 'chaque emplacement conserve sa propre liste vide tant que l’utilisateur ne la définit pas');

const entries = [{
  id: 'other-analysis-entry', reference: 'OD-ANALYSE-3', journal: 'OD', date: '2026-04-12', status: 'posted',
  lines: [{ account: '601100', debit: 50, credit: 0, analyticSplits: [{
    natureId: 'analysis-3', mode: 'amount', allocations: [{ valueLabel: 'Projet pilote', value: '50', amount: 50 }]
  }] }]
}];
const movements = Report.buildAnalyticalMovements({
  entries, analyticalNatures: S.analyticalNaturesConfiguration().rows,
  analyticalDimensionValues: S.analyticalDimensionValuesConfiguration('analysis-3').rows,
  accounts: [{ code: '601100', label: 'Charges de projet' }], decimalPlaces: 0,
  filters: { analyticalNature: 'analysis-3', from: '2026-04-01', to: '2026-04-30' }
});
assert.equal(movements.analyticalNatureLabel, 'Projet');
assert.equal(movements.totalDebit, 50);
assert.equal(movements.groups[0].rows[0].cells.destination, 'Projet pilote');
assert.equal(movements.groups[0].rows[0].cells.status, 'Ventilé');
assert.equal(movements.unmatchedValueCount, 0);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(navigation, /id: 'other-analyses', label: 'Autres analyses à définir', status: 'active'/);
assert.match(app, /function viewOtherAnalyses\(\)[\s\S]*Trois emplacements génériques[\s\S]*aucune finalité, valeur ou classification n’est présélectionnée/);
assert.match(app, /function otherAnalysisNatureNameEditor\([\s\S]*S\.saveAnalyticalNaturesConfiguration/);
assert.match(app, /function bindOtherAnalyses\([\s\S]*S\.saveAnalyticalDimensionValues/);
assert.match(app, /selectedChild\.id === 'other-analyses'[\s\S]*viewOtherAnalyses\(\)/);
assert.match(app, /menuParams\.c === 'other-analyses'\) bindOtherAnalyses\(\)/);
assert.match(css, /\.other-analysis-card/);

console.log('Autres analyses : trois emplacements renommables, listes libres par dossier et reprise analytique explicite — OK');
