/* Contrats des dix rapports Budget visibles sur les deux captures, sans source budgétaire simulée. */
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

test('reprend les dix fenêtres distinctes et leurs colonnes dans l’ordre des captures', () => {
  assert.deepEqual(BudgetReports.REPORT_IDS, [
    'budget-entered',
    'budget-orders-followup',
    'budget-orders-by-line',
    'budget-orders-outside',
    'budget-realizations-followup',
    'budget-realizations-by-line',
    'budget-outside-realizations-total',
    'budget-outside-realizations-detail',
    'budget-available-not-committed',
    'budget-available-balance'
  ]);
  const expected = {
    'budget-entered': ['Code', 'Intitulé', 'Budget exercice', 'Pourcentage du total'],
    'budget-orders-followup': ['Code', 'Intitulé', 'Budget exercice', 'Engagements antérieurs', 'Engagements période', 'Engagements totaux', 'Reste sur l’exercice'],
    'budget-orders-by-line': ['Date', 'Commande', 'Libellé de la commande', 'Compte', 'Intitulé du compte', 'Libellé de la ligne', 'Montant'],
    'budget-orders-outside': ['Date', 'Compte', 'Intitulé', 'Marché', '-', '-', 'Montant'],
    'budget-realizations-followup': ['Code', 'Intitulé', 'Budget N-1', 'Réalisation N-1', 'Budget exercice', 'Réalisation avant période', 'Réalisation période', 'Réalisation fin période', 'Reste fin période'],
    'budget-realizations-by-line': ['Date', 'Journal', 'Pièce', 'Compte', 'Intitulé', 'Débit', 'Crédit', 'Libellé'],
    'budget-outside-realizations-total': ['Compte', 'Intitulé', 'Montant'],
    'budget-outside-realizations-detail': ['Date', 'Journal', 'Pièce', 'Compte', 'Intitulé', 'Marché', '-', '-', 'Débit', 'Crédit', 'Libellé'],
    'budget-available-not-committed': ['Code', 'Intitulé', 'Budget', 'Engagements', 'Réalisations'],
    'budget-available-balance': ['Code', 'Intitulé', 'Budget', 'Engagements', 'Dépenses hors engag.', 'Budget consommé', '% consommé', 'Reste disponible']
  };
  for (const id of BudgetReports.REPORT_IDS) {
    const definition = BudgetReports.definitionFor(id);
    assert.deepEqual(definition.columns.map(column => column.label), expected[id], id);
    if (['budget-outside-realizations-detail', 'budget-available-not-committed', 'budget-available-balance'].includes(id)) {
      assert.equal(definition.columnStacks, 3, id + ' utilise trois piles de colonnes');
    }
    const selectedByDefault = definition.columns.filter(column => column.defaultSelected).map(column => column.key);
    const expectedDefault = id === 'budget-outside-realizations-detail'
      ? definition.columns.filter(column => column.key !== 'credit').map(column => column.key)
      : definition.columns.map(column => column.key);
    assert.deepEqual(selectedByDefault, expectedDefault, id + ' : options de colonnes par défaut');
  }
});

test('les dix états affichent un résultat vide plutôt que des valeurs budgétaires inventées', () => {
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
  for (const id of ['budget-orders-outside', 'budget-outside-realizations-total', 'budget-outside-realizations-detail', 'budget-available-not-committed']) {
    const report = BudgetReports.buildReport(id, options({ accountFilter: '401000' }));
    assert.equal(report.ok, true, id + ': ' + report.errors.join(' '));
    assert.equal(BudgetReports.definitionFor(id).filters.includes('accounts'), false, id + ' ne présente pas de filtre Compte');
  }
  assert.equal(BudgetReports.definitionFor('budget-available-balance').filters.includes('accounts'), true);
});

test('les périodes sont inclusives et restent dans le cycle pour les sept états datés', () => {
  const datedReports = BudgetReports.REPORT_IDS.filter(id => BudgetReports.definitionFor(id).filters.includes('from'));
  assert.equal(datedReports.length, 7);
  for (const id of datedReports) {
    assert.equal(BudgetReports.buildReport(id, options({ from: '2025-01-01', to: '2025-12-31' })).ok, true, id);
    assert.equal(BudgetReports.buildReport(id, options({ from: '2024-12-31', to: '2025-12-31' })).ok, false, id);
    assert.equal(BudgetReports.buildReport(id, options({ from: '2025-12-31', to: '2025-01-01' })).ok, false, id);
  }
  assert.equal(BudgetReports.buildReport('budget-entered', options({ from: '2020-01-01', to: '2020-01-02' })).ok, true, 'le Budget prévisionnel n’a pas de filtre de dates');
  for (const id of ['budget-available-not-committed', 'budget-available-balance']) {
    const report = BudgetReports.buildReport(id, options());
    assert.equal(report.ok, true, report.errors.join(' '));
    assert.equal(report.asOfDate, '2025-12-31', id + ' : date par défaut en fin de cycle');
    assert.deepEqual(report.lineSelection, { generalAccounts: true, groupingCodes: false, placeholderLines: [false, false] }, id + ' : cases par défaut des lignes à imprimer');
    assert.equal(BudgetReports.buildReport(id, options({ asOfDate: '2026-01-01' })).ok, false, id);
    assert.equal(BudgetReports.buildReport(id, options({ asOfDate: '2025-02-30' })).ok, false, id);
  }
});

test('propage les erreurs de source et rejette les identifiants d’état inconnus', () => {
  const sourceError = BudgetReports.buildReport('budget-realizations-followup', options({ sourceErrors: ['Registre indisponible'] }));
  assert.equal(sourceError.ok, false);
  assert.ok(sourceError.errors.includes('Registre indisponible'));
  assert.equal(BudgetReports.buildReport('budget-not-real', options()).ok, false);
});

console.log('Rapports Budget : formulaires, choix d’exercice, colonnes et limites de source vérifiés.');
