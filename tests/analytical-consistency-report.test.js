/* Contrôle consultatif des ventilations analytiques validées, axe par axe. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/journal-lines-report.js');

const natures = [
  { id: 'responsibility-centers', genericName: 'Centres de responsabilité', individualName: 'Centre' },
  { id: 'activity-domains', genericName: 'Domaines d’activité', individualName: 'Activité' }
];
const centers = [
  { id: 'c1', code: 'ANA-01', name: 'Atelier nord' },
  { id: 'c2', code: 'ANA-02', name: 'Atelier sud' },
  { id: 'c3', code: 'ANA-03', name: 'Atelier est' }
];
const accounts = [{ code: '601100', label: 'Achats de production' }];
const baseline = {
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31', decimalPlaces: 0,
  analyticalNatures: natures, analyticalCenters: centers, accounts,
  accountRules: [], filters: { from: '2026-01-01', to: '2026-12-31' }
};
function entry(lines, status = 'posted', reference = 'OD-001', date = '2026-05-02') {
  return { id: reference, status, reference, journal: 'OD', date, lines };
}
function line(splits = [], amount = 100) {
  return { account: '601100', debit: amount, credit: 0, analyticSplits: splits };
}
function centerAllocation(id, code, name, value, amount) {
  return { centerId: id, centerCode: code, centerName: name, value: String(value), amount };
}
function centerSplit(completeness = 'complete', allocations = [centerAllocation('c1', 'ANA-01', 'Atelier nord', 100, 100)], mode = 'amount', roundingCenterId = '') {
  return { natureId: 'responsibility-centers', completeness, mode, roundingCenterId, allocations };
}
function build(entries, extra = {}) {
  return Report.buildAnalyticalConsistencyReport(Object.assign({}, baseline, { entries }, extra));
}

const validEntry = entry([line([
  centerSplit(),
  { natureId: 'activity-domains', completeness: 'complete', mode: 'amount', allocations: [{ valueLabel: 'Production', value: '100', amount: 100 }] }
])]);
const sourceSnapshot = JSON.stringify(validEntry);
const clean = build([validEntry]);
assert.deepEqual(clean.errors, []);
assert.equal(clean.checkedEntryCount, 1);
assert.equal(clean.checkedLineCount, 1);
assert.equal(clean.rowCount, 0, 'deux natures complètes sont contrôlées indépendamment sans se cumuler.');
assert.equal(JSON.stringify(validEntry), sourceSnapshot, 'le contrôle ne modifie jamais les écritures.');

const missingRequired = build([entry([line([])])], {
  accountRules: [{ accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: false }]
});
assert.equal(missingRequired.anomalyCount, 1);
assert.match(missingRequired.groups[0].rows[0].cells.control, /imputation obligatoire.*manque/i);

const permittedPartial = build([entry([line([centerSplit('partial', [centerAllocation('c1', 'ANA-01', 'Atelier nord', 80, 80)])])])], {
  accountRules: [{ accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: true }]
});
assert.equal(permittedPartial.anomalyCount, 0);
assert.equal(permittedPartial.unallocatedCount, 1);
assert.equal(permittedPartial.groups[0].rows[0].cells.severity, 'À ventiler');
assert.match(permittedPartial.groups[0].rows[0].cells.control, /reliquat partiel autorisé/i);

const unpermittedPartial = build([entry([line([centerSplit('partial', [centerAllocation('c1', 'ANA-01', 'Atelier nord', 80, 80)])])])]);
assert.equal(unpermittedPartial.anomalyCount, 1);
assert.match(unpermittedPartial.groups[0].rows[0].cells.control, /n’est pas autorisé explicitement/i);

const overAllocated = build([entry([line([centerSplit('complete', [
  centerAllocation('c1', 'ANA-01', 'Atelier nord', 70, 70),
  centerAllocation('c2', 'ANA-02', 'Atelier sud', 40, 40)
])])])]);
assert.ok(overAllocated.anomalyCount >= 1);
assert.ok(overAllocated.groups[0].rows.some(row => /dépasse le montant comptable/.test(row.cells.control)));

const unknownCenter = build([entry([line([centerSplit('complete', [centerAllocation('missing', 'ANA-X', 'Inconnu', 100, 100)])])])]);
assert.ok(unknownCenter.groups[0].rows.some(row => /centre .* absent ou inconnu/.test(row.cells.control)));

const unknownNature = build([entry([line([{ natureId: 'unknown-axis', completeness: 'complete', mode: 'amount', allocations: [{ valueLabel: 'X', value: '100', amount: 100 }] }])])]);
assert.ok(unknownNature.groups[0].rows.some(row => /nature analytique inconnue/.test(row.cells.control)));

const emptyValue = build([entry([line([{ natureId: 'activity-domains', completeness: 'complete', mode: 'amount', allocations: [{ value: '100', amount: 100 }] }])])]);
assert.ok(emptyValue.groups[0].rows.some(row => /valeur analytique .* est vide/.test(row.cells.control)));

const unauthorizedNature = build([entry([line([centerSplit(), { natureId: 'activity-domains', completeness: 'complete', mode: 'amount', allocations: [{ valueLabel: 'Production', value: '100', amount: 100 }] }])])], {
  accountRules: [{ accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: false }]
});
assert.ok(unauthorizedNature.groups[0].rows.some(row => /n’est pas autorisée par la règle exacte/.test(row.cells.control)));

const percentRounded = build([entry([line([centerSplit('complete', [
  centerAllocation('c1', 'ANA-01', 'Atelier nord', '33.3', 33),
  centerAllocation('c2', 'ANA-02', 'Atelier sud', '33.3', 34),
  centerAllocation('c3', 'ANA-03', 'Atelier est', '33.4', 33)
], 'percentage', 'c2')])])]);
assert.equal(percentRounded.anomalyCount, 0, 'l’arrondi est accepté uniquement avec un destinataire explicite cohérent.');

const missingRoundingTarget = build([entry([line([centerSplit('complete', [
  centerAllocation('c1', 'ANA-01', 'Atelier nord', '33.3', 33),
  centerAllocation('c2', 'ANA-02', 'Atelier sud', '33.3', 33),
  centerAllocation('c3', 'ANA-03', 'Atelier est', '33.4', 33)
], 'percentage')])])]);
assert.ok(missingRoundingTarget.groups[0].rows.some(row => /écart d’arrondi.*sans destinataire/.test(row.cells.control)));

const draftExcluded = build([validEntry, entry([line([])], 'draft', 'OD-DRAFT')]);
assert.equal(draftExcluded.checkedEntryCount, 1, 'les brouillons sont exclus.');
const reversedPeriod = build([validEntry], { filters: { from: '2026-12-31', to: '2026-01-01' } });
assert.match(reversedPeriod.errors.join(' '), /période est inversée/);
const outsideCycle = build([validEntry], { filters: { from: '2025-12-31', to: '2026-12-31' } });
assert.match(outsideCycle.errors.join(' '), /comprise dans le cycle/);

console.log('Contrôle analytique : obligations, axes autorisés, reliquats, dépassements, références et arrondis — OK');
