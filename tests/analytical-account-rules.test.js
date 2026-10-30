/* Règles utilisateur par compte : natures obligatoires/facultatives et reliquat autorisé. */
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
const center = S.createAnalyticalCenter({ code: 'ANA-RULE', name: 'Centre des règles' }).analyticalCenter;
const configBefore = S.analyticalAccountRulesConfiguration();
assert.deepEqual(JSON.parse(JSON.stringify(configBefore.rules)), [], 'aucune règle de compte n’est préremplie.');

const saved = S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: false },
  { accountCode: '601100', natureId: 'activity-domains', requirement: 'optional', allowPartial: true }
] });
assert.equal(saved.ok, true, saved.errors.join(' '));
assert.equal(S.analyticalAccountRulesForAccount('601100').length, 2);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalAccountRulesConfiguration().rules.map(rule => [rule.accountCode, rule.natureId, rule.requirement, rule.allowPartial]))), [
  ['601100', 'responsibility-centers', 'required', false],
  ['601100', 'activity-domains', 'optional', true]
]);

function entry(splits, reference = 'OD-ANALYTIC-RULE') {
  return {
    reference, journal: 'OD', date: '2026-06-15', description: 'Test des règles analytiques',
    lines: [
      { account: '601100', debit: 100, credit: 0, analyticSplits: splits },
      { account: '401100', debit: 0, credit: 100 }
    ]
  };
}
function centerSplit(completeness, amount) {
  return {
    natureId: 'responsibility-centers', mode: 'amount', completeness,
    allocations: [{ centerId: center.id, value: String(amount) }]
  };
}

const missingRequired = S.validateEntry(entry([]), { requireBalanced: true, status: 'posted' });
assert.equal(missingRequired.ok, false);
assert.match(missingRequired.errors.join(' '), /obligatoire pour le compte 601100/);

const disallowedExtraNature = S.validateEntry(entry([
  centerSplit('complete', 100),
  { natureId: 'funding-sources', mode: 'amount', completeness: 'complete', allocations: [{ valueLabel: 'Subvention', value: '100' }] }
]), { requireBalanced: true, status: 'posted' });
assert.equal(disallowedExtraNature.ok, false);
assert.match(disallowedExtraNature.errors.join(' '), /n’est pas prévue dans les règles/);

const forbiddenPartial = S.validateEntry(entry([centerSplit('partial', 90)]), { requireBalanced: true, status: 'posted' });
assert.equal(forbiddenPartial.ok, false);
assert.match(forbiddenPartial.errors.join(' '), /n’autorise pas une ventilation partielle/);

const allowedRulesUpdate = S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: true },
  { accountCode: '601100', natureId: 'activity-domains', requirement: 'optional', allowPartial: true }
] });
assert.equal(allowedRulesUpdate.ok, true, allowedRulesUpdate.errors.join(' '));
const allowedPartial = S.validateEntry(entry([centerSplit('partial', 90)]), { requireBalanced: true, status: 'posted' });
assert.equal(allowedPartial.ok, true, allowedPartial.errors.join(' '));
assert.equal(allowedPartial.entry.lines[0].analyticSplits[0].unallocatedAmount, 10);

const optionalOnly = S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '601100', natureId: 'activity-domains', requirement: 'optional', allowPartial: false }
] });
assert.equal(optionalOnly.ok, true, optionalOnly.errors.join(' '));
const optionalMayBeAbsent = S.validateEntry(entry([]), { requireBalanced: true, status: 'posted' });
assert.equal(optionalMayBeAbsent.ok, true, optionalMayBeAbsent.errors.join(' '));

const invalidAccount = S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '999999', natureId: 'activity-domains', requirement: 'optional', allowPartial: false }
] });
assert.equal(invalidAccount.ok, false);
assert.match(invalidAccount.errors.join(' '), /compte imputable actif/);
const duplicateRule = S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '601100', natureId: 'activity-domains', requirement: 'optional', allowPartial: false },
  { accountCode: '601100', natureId: 'activity-domains', requirement: 'required', allowPartial: false }
] });
assert.equal(duplicateRule.ok, false);
assert.match(duplicateRule.errors.join(' '), /déjà paramétrés/);

S.saveAnalyticalAccountRulesConfiguration({ rules: [
  { accountCode: '601100', natureId: 'responsibility-centers', requirement: 'required', allowPartial: false }
] });
const draft = S.createEntry(entry([], 'OD-ANALYTIC-RULE-DRAFT'), 'draft');
assert.equal(draft.ok, true, draft.errors.join(' '));
const postDraft = S.postEntry(draft.entry.id);
assert.equal(postDraft.ok, false, 'la validation d’un brouillon réapplique les règles de compte.');
assert.match(postDraft.errors.join(' '), /obligatoire pour le compte 601100/);
const mainDossierId = S.currentDossier().id;
const anotherDossier = S.createDossier({
  clientName: 'Dossier règles vide', clientCode: 'RULE', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(anotherDossier.ok, true, anotherDossier.errors && anotherDossier.errors.join(' '));
assert.equal(S.switchDossier(anotherDossier.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalAccountRulesConfiguration().rules)), [], 'les règles ne sont pas copiées dans un autre dossier.');
assert.equal(S.switchDossier(mainDossierId).ok, true);
assert.equal(S.analyticalAccountRulesForAccount('601100').length, 1, 'les règles restent enregistrées dans leur dossier source.');

console.log('Règles analytiques par compte : obligation, facultatif, axes autorisés, reliquat autorisé et recontrôle à la validation — OK');
