/* Registre budgétaire : racines de comptes, décomposition, axes dossier et absence d’écriture. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const storage = new Map();
const localStorage = { getItem(key) { return storage.has(key) ? storage.get(key) : null; }, setItem(key, value) { storage.set(key, String(value)); }, removeItem(key) { storage.delete(key); } };
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array, Set, Map };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
const S = sandbox.window.PerfectoStore;
const dossierId = S.currentDossier().id;
assert.deepEqual(JSON.parse(JSON.stringify(S.budgetRegisterConfiguration().rows)), [], 'aucun budget fictif n’est précréé');
const entriesBefore = S.entries().length;
const expenseAccount = S.accounts().find(account => account.code === '601' && account.postable);
const investmentAccount = S.accounts().find(account => account.code === '4751' && account.postable);
const excludedAccount = S.accounts().find(account => account.code === '2811' && account.postable);
assert.ok(expenseAccount && investmentAccount && excludedAccount);
assert.equal(S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Services', active: true }]).ok, true);
const budget = {
  code: '', year: '2026', type: 'C', label: 'Charges', cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  decomposition: 'none', realizationMode: 'debit-credit', accountPrefixes: ['6', '81', '83', '85', '87', '89'],
  analyticNatureIds: ['activity-domains'], classification: 'A1', lines: [{ accountCode: expenseAccount.code, label: 'Prestations', annualAmount: '1250', analyticValues: { 'activity-domains': { valueLabel: 'Services' } } }]
};
let saved = S.saveBudgetRegisterConfiguration([budget]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
let row = JSON.parse(JSON.stringify(S.budgetRegisterConfiguration().rows[0]));
assert.equal(row.code, '2026C');
assert.equal(row.lines[0].annualAmount, 1250);
assert.equal(row.realizationMode, 'debit-credit');
assert.equal(row.analyticNatureIds[0], 'activity-domains');
assert.equal(S.entries().length, entriesBefore, 'un budget ne génère aucune écriture');

saved = S.saveBudgetRegisterConfiguration([{ ...row, lines: [{ ...row.lines[0], accountCode: '401' }] }]);
assert.equal(saved.ok, false, 'les comptes hors racines sont rejetés');
saved = S.saveBudgetRegisterConfiguration([{ ...row, lines: [{ ...row.lines[0], annualAmount: -10 }] }]);
assert.equal(saved.ok, false, 'un montant négatif est rejeté');

const investment = {
  code: '', year: '2026', type: 'I', label: 'Investissements', cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  decomposition: 'quarter', realizationMode: 'credit', accountPrefixes: ['2', '-28', '-29', '475'], analyticNatureIds: [], classification: 'C',
  lines: [{ accountCode: investmentAccount.code, label: 'Équipement', periodAmounts: { T1: 100, T2: 200, T3: 0, T4: 50 } }]
};
saved = S.saveBudgetRegisterConfiguration([row, investment]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(S.budgetRegisterConfiguration().rows[1].lines[0].annualAmount, 350);
const productAccount = S.accounts().find(account => account.code === '701' && account.postable);
const incompleteBudget = { code: '', year: '2026', type: 'P', label: 'Produits', cycleStart: '2026-01-01', cycleEnd: '2026-12-31', decomposition: 'month', realizationMode: 'credit-debit', accountPrefixes: ['7', '82', '84', '86', '88'], analyticNatureIds: [], classification: 'C', lines: [{ accountCode: productAccount.code, label: 'Ventes', periodAmounts: { '2026-01': 80 } }] };
saved = S.saveBudgetRegisterConfiguration([row, S.budgetRegisterConfiguration().rows[1], incompleteBudget]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
const incomplete = S.budgetRegisterConfiguration().rows[2].lines[0];
assert.equal(incomplete.amountComplete, false, 'les périodes laissées vides ne deviennent pas des zéros');
assert.equal(incomplete.periodAmounts['2026-02'], '');
saved = S.saveBudgetRegisterConfiguration([row, { ...investment, lines: [{ ...investment.lines[0], accountCode: excludedAccount.code }] }]);
assert.equal(saved.ok, false, 'un préfixe précédé de moins exclut le compte et ses sous-comptes');

const nextYear = { ...row, id: '', code: '2027C', year: '2027', cycleStart: '2027-01-01', cycleEnd: '2027-12-31', lines: [{ ...row.lines[0], id: '', annualAmount: 0 }] };
saved = S.saveBudgetRegisterConfiguration([row, S.budgetRegisterConfiguration().rows[1], nextYear]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
const other = S.createDossier({ clientName: 'Dossier budget isolé', clientCode: 'BUD', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(S.switchDossier(other.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.budgetRegisterConfiguration().rows)), [], 'registre isolé par dossier');
assert.equal(S.switchDossier(dossierId).ok, true);
assert.equal(S.budgetRegisterConfiguration().rows.length, 3);
assert.equal(S.entries().length, entriesBefore, 'aucune saisie budgétaire ne modifie le journal');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
assert.match(navigation, /id: 'forecast-budgets',[^\n]*status: 'active'/);
assert.match(app, /function viewBudgetRegister\(\)/);
assert.match(app, /function openBudgetImportModal\(/);
assert.match(app, /function openBudgetFollowingModal\(/);
assert.match(app, /function openBudgetRealizationsModal\(/);
assert.match(app, /data-budget-realizations=/);
assert.match(app, /Aperçu des réalisations/);
assert.match(app, /openReportPreview\('Aperçu des réalisations · ' \+ budget\.code, body\)/);
assert.match(app, /BudgetRealizations\.calculate\(\{ budget: budget, entries: S\.entries\(\) \}\)/);
assert.match(app, /Aucune ligne d’écriture validée ne correspond aux comptes budgétés dans la période/);
assert.match(app, /Télécharger le modèle XLSX/);
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
assert.match(html, /<script src="js\/budget-realizations\.js"><\/script>/);
assert.match(worker, /\.\/js\/budget-realizations\.js/);
assert.match(app, /Suivi analytique · axes configurés dans le dossier/);
assert.match(app, /Aucune écriture comptable n’est créée/);
console.log('Registre budgétaire : isolation dossier, préfixes inclus/exclus, axes configurés, périodes et montants contrôlés — OK');
