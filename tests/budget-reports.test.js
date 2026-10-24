/* Contrats des sept rapports Budget visibles sur la capture, sans source budgétaire simulée. */
'use strict';

const assert = require('node:assert/strict');
const BudgetReports = require('../modern-proto/js/budget-reports.js');

function options(overrides = {}) {
  return Object.assign({
    cycleStart: '2025-01-01',
    cycleEnd: '2025-12-31',
    budgetCode: '2025C',
    accountFilter: '*',
    accounts: [{ code: '930100', label: 'Compte analytique' }],
    entries: []
  }, overrides);
}

function test(name, fn) {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.stack);
    process.exitCode = 1;
  }
}

console.log('Rapports Budget · sélections, filtres et absence de sources');

test('propose les trois budgets C/I/P pour l’exercice du cycle, sans année codée en dur', () => {
  assert.deepEqual(BudgetReports.budgetOptions('2025-01-01').map(item => [item.code, item.label]), [
    ['2025C', '2025C - Charges'],
    ['2025I', '2025I - Investissements'],
    ['2025P', '2025P - Produits']
  ]);
  assert.deepEqual(BudgetReports.budgetOptions('2026-04-01').map(item => item.code), ['2026C', '2026I', '2026P']);
  assert.deepEqual(BudgetReports.budgetOptions('date invalide'), []);
});

test('reprend les sept fenêtres distinctes et leurs colonnes dans l’ordre de la capture', () => {
  assert.deepEqual(BudgetReports.REPORT_IDS, [
    'budget-entered',
    'budget-orders-followup',
    'budget-orders-by-line',
    'budget-orders-outside',
    'budget-realizations-followup',
    'budget-realizations-by-line',
    'budget-outside-realizations-total'
  ]);
  const expected = {
    'budget-entered': ['Code', 'Intitulé', 'Budget exercice', 'Pourcentage du total'],
    'budget-orders-followup': ['Code', 'Intitulé', 'Budget exercice', 'Engagements antérieurs', 'Engagements période', 'Engagements totaux', 'Reste sur l’exercice'],
    'budget-orders-by-line': ['Date', 'Commande', 'Libellé de la commande', 'Compte', 'Intitulé du compte', 'Libellé de la ligne', 'Montant'],
    'budget-orders-outside': ['Date', 'Compte', 'Intitulé', 'Marché', '-', '-', 'Montant'],
    'budget-realizations-followup': ['Code', 'Intitulé', 'Budget N-1', 'Réalisation N-1', 'Budget exercice', 'Réalisation avant période', 'Réalisation période', 'Réalisation fin période', 'Reste fin période'],
    'budget-realizations-by-line': ['Date', 'Journal', 'Pièce', 'Compte', 'Intitulé', 'Débit', 'Crédit', 'Libellé'],
    'budget-outside-realizations-total': ['Compte', 'Intitulé', 'Montant']
  };
  for (const id of BudgetReports.REPORT_IDS) {
    const definition = BudgetReports.definitionFor(id);
    assert.deepEqual(definition.columns.map(column => column.label), expected[id], id);
    assert.ok(definition.columns.every(column => column.defaultSelected), id + ' : toutes les colonnes sont sélectionnées par défaut');
  }
});

test('les sept états exposent les valeurs budgétaires demandées, sans inventer de lignes', () => {
  for (const id of BudgetReports.REPORT_IDS) {
    const report = BudgetReports.buildReport(id, options());
    assert.equal(report.ok, true, id + ': ' + report.errors.join(' '));
    assert.equal(report.dataAvailable, false);
    assert.equal(report.generatedLineCount, 0);
    assert.deepEqual(report.rows, []);
    assert.equal(report.budget.label, '2025C - Charges');
    assert.equal(report.basis.accountsLimitedToAnalyticClasses93to99, true);
    assert.equal(report.basis.noBudgetAmountsSimulated, true);
    assert.equal(report.basis.noCommitmentsSimulated, true);
    assert.equal(report.basis.noRealizationsSimulated, true);
    assert.equal(report.basis.noAccountingMutation, true);
    assert.ok(report.warnings.length > 0, id + ' doit expliquer les sources absentes');
  }
});

test('valide les trois codes C/I/P de l’exercice et refuse une autre année', () => {
  for (const code of ['2025C', '2025I', '2025P']) {
    const report = BudgetReports.buildReport('budget-entered', options({ budgetCode: code }));
    assert.equal(report.ok, true, code + ': ' + report.errors.join(' '));
    assert.equal(report.budget.code, code);
  }
  assert.equal(BudgetReports.buildReport('budget-entered', options({ budgetCode: '2024C' })).ok, false);
  assert.equal(BudgetReports.buildReport('budget-entered', options({ budgetCode: '2025X' })).ok, false);
});

test('les filtres Compte acceptent uniquement les comptes analytiques 93 à 99', () => {
  assert.equal(BudgetReports.buildReport('budget-entered', options({ accountFilter: '93' })).ok, true);
  assert.equal(BudgetReports.buildReport('budget-entered', options({ accountFilter: '401000' })).ok, false);
  assert.equal(BudgetReports.buildReport('budget-orders-by-line', options({ accountFilter: '920100' })).ok, false);
  const noAccountFilter = BudgetReports.buildReport('budget-orders-outside', options({ accountFilter: '401000' }));
  assert.equal(noAccountFilter.ok, true, noAccountFilter.errors.join(' '));
  assert.equal(BudgetReports.definitionFor('budget-orders-outside').filters.includes('accounts'), false);
  assert.equal(BudgetReports.definitionFor('budget-outside-realizations-total').filters.includes('accounts'), false);
});

test('les périodes sont inclusives et restent dans le cycle pour les six états datés', () => {
  const datedReports = BudgetReports.REPORT_IDS.filter(id => BudgetReports.definitionFor(id).filters.includes('from'));
  assert.equal(datedReports.length, 6);
  for (const id of datedReports) {
    assert.equal(BudgetReports.buildReport(id, options({ from: '2025-01-01', to: '2025-12-31' })).ok, true, id);
    assert.equal(BudgetReports.buildReport(id, options({ from: '2024-12-31', to: '2025-12-31' })).ok, false, id);
    assert.equal(BudgetReports.buildReport(id, options({ from: '2025-12-31', to: '2025-01-01' })).ok, false, id);
  }
  assert.equal(BudgetReports.buildReport('budget-entered', options({ from: '2020-01-01', to: '2020-01-02' })).ok, true, 'le Budget prévisionnel n’a pas de filtre de dates');
});

test('propage les erreurs de source et rejette les identifiants d’état inconnus', () => {
  const sourceError = BudgetReports.buildReport('budget-realizations-followup', options({ sourceErrors: ['Registre indisponible'] }));
  assert.equal(sourceError.ok, false);
  assert.ok(sourceError.errors.includes('Registre indisponible'));
  assert.equal(BudgetReports.buildReport('budget-not-real', options()).ok, false);
});

console.log('Rapports Budget : formulaires, choix d’exercice, colonnes et limites de source vérifiés.');
