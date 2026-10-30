/* Imputations analytiques explicites liées aux lignes du grand livre général. */
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
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
}
const S = sandbox.window.PerfectoStore;
const centers = [
  S.createAnalyticalCenter({ code: 'ANA-TEST-A', name: 'Centre A' }).analyticalCenter,
  S.createAnalyticalCenter({ code: 'ANA-TEST-B', name: 'Centre B' }).analyticalCenter,
  S.createAnalyticalCenter({ code: 'ANA-TEST-C', name: 'Centre C' }).analyticalCenter
];

function entry(lineAnalyticSplits, reference) {
  return {
    reference: reference || 'OD-ANALYTIC-TEST', journal: 'OD', date: '2026-06-15',
    description: 'Test ventilation analytique',
    lines: [
      { account: '601100', debit: 100, credit: 0, analyticSplits: lineAnalyticSplits },
      { account: '401100', debit: 0, credit: 100 }
    ]
  };
}
function centerAllocation(center, value) { return { centerId: center.id, value: String(value) }; }

console.log('Ventilations analytiques liées aux lignes générales');

const completeAmounts = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete',
  allocations: [centerAllocation(centers[0], 40), centerAllocation(centers[1], 60)]
}]), { requireBalanced: true, status: 'posted' });
assert.equal(completeAmounts.ok, true, completeAmounts.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify(completeAmounts.entry.lines[0].analyticSplits[0].allocations.map((item) => item.amount))), [40, 60]);
assert.equal(completeAmounts.entry.lines[0].analyticSplits[0].unallocatedAmount, 0);
assert.equal(completeAmounts.entry.lines[0].debit, 100, 'la ventilation ne modifie pas le débit général');
assert.equal(completeAmounts.entry.lines[1].credit, 100, 'la ventilation ne modifie pas le crédit général');

const overAmount = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: 'partial',
  allocations: [centerAllocation(centers[0], 101)]
}], 'OD-ANALYTIC-OVER'), { requireBalanced: true, status: 'posted' });
assert.equal(overAmount.ok, false);
assert.match(overAmount.errors.join(' '), /dépasse le montant de la ligne/);

const partial = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'percentage', completeness: 'partial',
  allocations: [centerAllocation(centers[0], 60), centerAllocation(centers[1], 20)]
}], 'OD-ANALYTIC-PARTIAL'), { requireBalanced: true, status: 'posted' });
assert.equal(partial.ok, true, partial.errors.join(' '));
assert.equal(partial.entry.lines[0].analyticSplits[0].unallocatedAmount, 20, 'le reliquat demeure explicitement non ventilé');

const fullWithoutRoundingTarget = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'percentage', completeness: 'complete',
  allocations: [centerAllocation(centers[0], 33.3), centerAllocation(centers[1], 33.3), centerAllocation(centers[2], 33.4)]
}], 'OD-ANALYTIC-ROUND-MISSING'), { requireBalanced: true, status: 'posted' });
assert.equal(fullWithoutRoundingTarget.ok, false);
assert.match(fullWithoutRoundingTarget.errors.join(' '), /choisissez explicitement le centre/);

const fullWithRoundingTarget = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'percentage', completeness: 'complete', roundingCenterId: centers[1].id,
  allocations: [centerAllocation(centers[0], 33.3), centerAllocation(centers[1], 33.3), centerAllocation(centers[2], 33.4)]
}], 'OD-ANALYTIC-ROUND-OK'), { requireBalanced: true, status: 'posted' });
assert.equal(fullWithRoundingTarget.ok, true, fullWithRoundingTarget.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify(fullWithRoundingTarget.entry.lines[0].analyticSplits[0].allocations.map((item) => item.amount))), [33, 34, 33]);

const separateNatureGroups = S.validateEntry(entry([
  { natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete', allocations: [centerAllocation(centers[0], 100)] },
  { natureId: 'activity-domains', mode: 'amount', completeness: 'complete', allocations: [{ valueLabel: 'Activité explicitement saisie', value: '100' }] }
], 'OD-ANALYTIC-NATURES'), { requireBalanced: true, status: 'posted' });
assert.equal(separateNatureGroups.ok, true, separateNatureGroups.errors.join(' '));
assert.equal(separateNatureGroups.entry.lines[0].analyticSplits.length, 2, 'chaque nature est contrôlée séparément');

const missingCompleteness = S.validateEntry(entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: '', allocations: [centerAllocation(centers[0], 100)]
}], 'OD-ANALYTIC-POLICY'), { requireBalanced: true, status: 'posted' });
assert.equal(missingCompleteness.ok, false);
assert.match(missingCompleteness.errors.join(' '), /choisissez si la ventilation est complète/);

const draft = S.createEntry(entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete',
  allocations: [centerAllocation(centers[0], 50)]
}], 'OD-ANALYTIC-DRAFT'), 'draft');
assert.equal(draft.ok, true, draft.errors.join(' '));
assert.equal(draft.entry.lines[0].analyticSplits[0].allocations[0].amount, 50);
const update = S.updateDraft(draft.entry.id, entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete',
  allocations: [centerAllocation(centers[0], 75)]
}], 'OD-ANALYTIC-DRAFT'));
assert.equal(update.ok, true, update.errors.join(' '));
assert.equal(update.entry.lines[0].analyticSplits[0].allocations[0].amount, 75, 'la modification analytique est détectée et sauvegardée');
const incompletePost = S.postEntry(draft.entry.id);
assert.equal(incompletePost.ok, false, 'la validation d’un brouillon recontrôle aussi sa ventilation analytique');
assert.match(incompletePost.errors.join(' '), /doit être égale au montant de la ligne/);
const postableDraft = S.createEntry(entry([{
  natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete', allocations: [centerAllocation(centers[0], 100)]
}], 'OD-ANALYTIC-POSTABLE'), 'draft');
assert.equal(postableDraft.ok, true, postableDraft.errors.join(' '));
const posted = S.postEntry(postableDraft.entry.id);
assert.equal(posted.ok, true, posted.errors.join(' '));
assert.equal(posted.entry.lines[0].analyticSplits[0].allocations[0].amount, 100);

const isolated = S.createDossier({
  clientName: 'Dossier analytique isolé', clientCode: 'ANISO',
  accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(isolated.ok, true, isolated.errors && isolated.errors.join(' '));
S.switchDossier(isolated.dossier.id);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalCenters())), [], 'les centres et ventilations sont isolés par dossier');

console.log('Ventilations analytiques : montants, pourcentages, reliquat, arrondi explicite, natures multiples, historique brouillon et isolation — OK');
