/* Calcul consultatif des clés, après choix explicite de leur interprétation. */
'use strict';

const assert = require('node:assert/strict');
const Preview = require('../modern-proto/js/analytical-allocation-preview.js');

const rows = [
  { mainSection: 'Administration', counterpart: 'Paie', key: '1' },
  { mainSection: 'Production', counterpart: 'Atelier', key: '2' }
];
const weights = Preview.simulate({ rows, sourceAmount: ' ninety', mode: 'weights', decimalPlaces: 0 });
assert.equal(weights.ok, false, 'un montant non numérique n’est jamais interprété implicitement.');
const weighted = Preview.simulate({ rows, sourceAmount: '90', mode: 'weights', decimalPlaces: 0 });
assert.equal(weighted.ok, true);
assert.deepEqual(weighted.allocations.map(row => row.amount), [30, 60]);
assert.equal(weighted.complete, true);
assert.equal(weighted.mode, 'weights');

const roundedRows = [
  { mainSection: 'A', counterpart: 'a', key: '1' },
  { mainSection: 'B', counterpart: 'b', key: '1' },
  { mainSection: 'C', counterpart: 'c', key: '1' }
];
const needsRoundingChoice = Preview.simulate({ rows: roundedRows, sourceAmount: '1', mode: 'weights', decimalPlaces: 0 });
assert.equal(needsRoundingChoice.ok, false);
assert.equal(needsRoundingChoice.requiresRoundingChoice, true);
const rounded = Preview.simulate({ rows: roundedRows, sourceAmount: '1', mode: 'weights', decimalPlaces: 0, roundingRowIndex: '1' });
assert.equal(rounded.ok, true);
assert.deepEqual(rounded.allocations.map(row => row.amount), [0, 1, 0]);
assert.equal(rounded.roundingRowIndex, 1);
assert.equal(rounded.roundingAmount, 1);

const roundedWeightsDown = Preview.simulate({
  rows: [{ key: '1' }, { key: '1' }], sourceAmount: '1', mode: 'weights', decimalPlaces: 0
});
assert.equal(roundedWeightsDown.ok, false);
assert.equal(roundedWeightsDown.roundingDifference, -1, 'un dépassement d’arrondi des poids exige aussi un destinataire choisi.');
const selectedRoundedWeight = Preview.simulate({
  rows: [{ key: '1' }, { key: '1' }], sourceAmount: '1', mode: 'weights', decimalPlaces: 0, roundingRowIndex: '0'
});
assert.deepEqual(selectedRoundedWeight.allocations.map(row => row.amount), [0, 1]);
const percentRounding = Preview.simulate({
  rows: [{ key: '33,33' }, { key: '33,33' }, { key: '33,34' }],
  sourceAmount: '1', mode: 'percentage', decimalPlaces: 0
});
assert.equal(percentRounding.ok, false);
assert.equal(percentRounding.requiresRoundingChoice, true);
assert.equal(percentRounding.roundingAmount, 1);

const percentages = Preview.simulate({ rows: [
  { mainSection: 'A', counterpart: 'a', key: '40' },
  { mainSection: 'B', counterpart: 'b', key: '35' }
], sourceAmount: '100', mode: 'percentage', decimalPlaces: 0 });
assert.equal(percentages.ok, true);
assert.deepEqual(percentages.allocations.map(row => row.amount), [40, 35]);
assert.equal(percentages.unallocatedAmount, 25, 'un pourcentage incomplet conserve explicitement son reliquat.');
assert.equal(percentages.complete, false);
assert.equal(percentages.unallocatedPercent, 25);
const subCurrencyRemainder = Preview.simulate({ rows: [{ key: '99' }], sourceAmount: '0,01', mode: 'percentage', decimalPlaces: 2 });
assert.equal(subCurrencyRemainder.ok, true);
assert.equal(subCurrencyRemainder.complete, false, 'un pourcentage incomplet reste partiel même si l’écart est inférieur à un centime.');
assert.equal(subCurrencyRemainder.unallocatedPercent, 1);
assert.equal(subCurrencyRemainder.unallocatedAmount, 0);

const excessivePercentages = Preview.simulate({ rows: [
  { key: '60' }, { key: '41' }
], sourceAmount: '100', mode: 'percentage', decimalPlaces: 0 });
assert.equal(excessivePercentages.ok, false);
assert.match(excessivePercentages.errors.join(' '), /dépasse 100 %/);

const fixed = Preview.simulate({ rows: [
  { mainSection: 'A', counterpart: 'a', key: '30' },
  { mainSection: 'B', counterpart: 'b', key: '20' }
], sourceAmount: '100', mode: 'amount', decimalPlaces: 0 });
assert.equal(fixed.ok, true);
assert.deepEqual(fixed.allocations.map(row => row.amount), [30, 20]);
assert.equal(fixed.unallocatedAmount, 50);
const overAmount = Preview.simulate({ rows: [{ key: '101' }], sourceAmount: '100', mode: 'amount', decimalPlaces: 0 });
assert.equal(overAmount.ok, false);
assert.match(overAmount.errors.join(' '), /dépasse le montant de base/);
const nonNumericKey = Preview.simulate({ rows: [{ key: 'Base heures' }], sourceAmount: '100', mode: 'weights', decimalPlaces: 0 });
assert.equal(nonNumericKey.ok, false);
assert.match(nonNumericKey.errors.join(' '), /sans unité implicite/);
const noMethod = Preview.simulate({ rows, sourceAmount: '90', decimalPlaces: 0 });
assert.equal(noMethod.ok, false);
assert.match(noMethod.errors.join(' '), /Choisissez explicitement/);

console.log('Simulation des clés : choix explicite poids/pourcentage/montant, plafonds, reliquats et arrondis — OK');
