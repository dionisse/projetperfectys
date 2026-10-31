/* Les prévisions de règlement sont locales au dossier, explicites et non exécutables. */
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
const initialDossierId = S.currentDossier().id;
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalPaymentScheduleConfiguration().rows)), [], 'aucune échéance n’est créée implicitement');

const entry = {
  date: '2026-05-12', reference: 'REF SAISIE', beneficiary: 'Fournisseur saisi',
  description: 'Entretien du local', amount: 12500, currencyCode: 'XOF',
  natureId: '', valueId: '', valueLabel: '', status: 'planned'
};
const saved = S.saveAnalyticalPaymentScheduleConfiguration([entry]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
const stored = JSON.parse(JSON.stringify(S.analyticalPaymentScheduleConfiguration().rows[0]));
assert.match(stored.id, /^analytical-payment-/);
assert.equal(stored.date, entry.date);
assert.equal(stored.amount, entry.amount);
assert.equal(stored.currencyCode, 'XOF');
assert.equal(stored.status, 'planned');
assert.equal(stored.natureId, '', 'aucune nature n’est automatiquement imputée');
assert.equal(stored.valueLabel, '', 'aucune valeur analytique n’est automatiquement imputée');

const invalidDate = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, date: '2027-01-01' }]);
assert.equal(invalidDate.ok, false);
assert.match(invalidDate.errors.join(' '), /cycle du dossier/);
const invalidAmount = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, amount: 0 }]);
assert.equal(invalidAmount.ok, false);
assert.match(invalidAmount.errors.join(' '), /montant doit être un nombre positif/);
const invalidCurrency = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, currencyCode: 'ZZZ' }]);
assert.equal(invalidCurrency.ok, false);
assert.match(invalidCurrency.errors.join(' '), /devise présente dans le référentiel/);
const invalidPrecision = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, amount: 12500.5 }]);
assert.equal(invalidPrecision.ok, false);
assert.match(invalidPrecision.errors.join(' '), /dépasse la précision configurée/);
const invalidStatus = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, status: 'paid' }]);
assert.equal(invalidStatus.ok, false);
assert.match(invalidStatus.errors.join(' '), /état de programmation est invalide/);
const invalidNature = S.saveAnalyticalPaymentScheduleConfiguration([{ ...stored, natureId: 'unknown-nature' }]);
assert.equal(invalidNature.ok, false);
assert.match(invalidNature.errors.join(' '), /nature analytique choisie n’existe plus/);

assert.equal(S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Services', active: true }]).ok, true);
const classified = S.saveAnalyticalPaymentScheduleConfiguration([{
  ...stored, natureId: 'activity-domains', valueLabel: 'Services'
}]);
assert.equal(classified.ok, true, classified.errors && classified.errors.join(' '));
assert.equal(S.analyticalPaymentScheduleConfiguration().rows[0].valueLabel, 'Services');
const unknownValue = S.saveAnalyticalPaymentScheduleConfiguration([{
  ...S.analyticalPaymentScheduleConfiguration().rows[0], valueLabel: 'Valeur inventée'
}]);
assert.equal(unknownValue.ok, false);
assert.match(unknownValue.errors.join(' '), /valeur analytique choisie est absente/);

const duplicate = S.saveAnalyticalPaymentScheduleConfiguration([
  S.analyticalPaymentScheduleConfiguration().rows[0],
  S.analyticalPaymentScheduleConfiguration().rows[0]
]);
assert.equal(duplicate.ok, false);
assert.match(duplicate.errors.join(' '), /identifiant répété/);
const deleted = S.saveAnalyticalPaymentScheduleConfiguration([]);
assert.equal(deleted.ok, false);
assert.match(deleted.errors.join(' '), /ne peut pas être supprimée/);
const cancelled = S.saveAnalyticalPaymentScheduleConfiguration([
  { ...S.analyticalPaymentScheduleConfiguration().rows[0], status: 'cancelled' }
]);
assert.equal(cancelled.ok, true, cancelled.errors && cancelled.errors.join(' '));
assert.equal(S.analyticalPaymentScheduleConfiguration().rows[0].status, 'cancelled');
assert.equal(S.analyticalPaymentScheduleConfiguration().rows[0].amount, 12500, 'annuler la prévision ne règle ni ne supprime le montant historique');

const otherDossier = S.createDossier({
  clientName: 'Dossier planning séparé', clientCode: 'PLN', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(otherDossier.ok, true, otherDossier.errors && otherDossier.errors.join(' '));
assert.equal(S.switchDossier(otherDossier.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalPaymentScheduleConfiguration().rows)), [], 'aucune programmation ne fuit vers un autre dossier');
assert.equal(S.switchDossier(initialDossierId).ok, true);
assert.equal(S.analyticalPaymentScheduleConfiguration().rows[0].status, 'cancelled');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(navigation, /id: 'scheduled-payments',[^\n]*status: 'active'/);
assert.match(app, /function viewAnalyticalPaymentSchedule\(\)/);
assert.match(app, /exchangeFeature = viewAnalyticalPaymentSchedule\(\)/);
assert.match(app, /bindAnalyticalPaymentSchedule\(\)/);
assert.match(app, /aucune écriture, sortie de trésorerie, relance automatique ni conversion de devise n’est créée/);
assert.match(app, /S\.saveAnalyticalPaymentScheduleConfiguration\(rows\)/);
assert.match(css, /\.scheduled-payment-summary/);

console.log('Programmation des règlements : saisie explicite, validation, classement, annulation et isolation par dossier — OK');
