/* Contrats des dix rapports Budget et contrôle du raccordement des réalisations à leurs sources. */
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

console.log('Rapports Budget · sélections, filtres et réalisations sources');

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

test('le budget prévisionnel restitue les lignes enregistrées sans inventer le pourcentage', () => {
  const registeredBudget = {
    id: 'budget-forecast-2025', code: '2025C', year: '2025', type: 'C', label: 'Charges',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', decomposition: 'none', realizationMode: 'debit',
    classification: 'A1', analyticNatureIds: ['activity-domains'], accountPrefixes: ['6'],
    lines: [
      { id: 'line-service-1', accountCode: '601', label: 'Prestations', annualAmount: 1000, amountComplete: true, analyticValues: { 'activity-domains': { valueLabel: 'Services' } } },
      { id: 'line-service-2', accountCode: '601', label: 'Maintenance', annualAmount: 500, amountComplete: true, analyticValues: { 'activity-domains': { valueLabel: 'Services' } } },
      { id: 'line-incomplete', accountCode: '602', label: 'Achats à compléter', annualAmount: 0, amountComplete: false, analyticValues: { 'activity-domains': { valueLabel: 'Fournitures' } } }
    ]
  };
  const accounts = [
    { code: '6', label: 'Charges', postable: false },
    { code: '60', label: 'Achats', postable: false },
    { code: '601', label: 'Services', postable: true },
    { code: '602', label: 'Autres achats', postable: true }
  ];
  const report = BudgetReports.buildReport('budget-entered', options({
    budgetRegister: [registeredBudget], budgetCode: '2025C', accountFilter: '601', accounts,
    analyticNatures: [{ id: 'activity-domains', individualName: 'Domaine d’activité' }], groupingCodes: true
  }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.budget.id, registeredBudget.id);
  assert.equal(report.dataAvailable, true);
  assert.equal(report.generatedLineCount, 4, 'deux lignes saisies et leurs deux codes de regroupement');
  assert.deepEqual(report.rows.map(row => [row.accountCode, row.budgetAmount]), [['6', 1500], ['60', 1500], ['601', 1000], ['601', 500]]);
  assert.match(report.rows[2].accountLabel, /Prestations · Domaine d’activité : Services/);
  assert.equal(report.rows.every(row => row.shareOfTotal == null), true);
  assert.equal(report.basis.budgetRegisterAvailable, true);
  assert.equal(report.basis.noBudgetAmountsSimulated, false);
  assert.equal(report.basis.accountsLimitedToAnalyticClasses93to99, false);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.match(report.warnings.join(' '), /Pourcentage du total.+formule n’est pas définie/);

  const incomplete = BudgetReports.buildReport('budget-entered', options({
    budgetRegister: [registeredBudget], budgetCode: '2025C', accountFilter: '60*', accounts,
    groupingCodes: true
  }));
  assert.equal(incomplete.generatedLineCount, 5);
  assert.equal(incomplete.incompleteLineCount, 1);
  assert.equal(incomplete.rows.find(row => row.accountCode === '602').budgetAmount, null);
  assert.equal(incomplete.rows.filter(row => row.status === 'incomplete-grouping').length, 2);
});

test('le suivi des commandes n’utilise que les liens explicites et exclut les devises non converties', () => {
  const budget = {
    id: 'budget-orders-2025', code: '2025C', year: '2025', type: 'C', label: 'Charges',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', decomposition: 'none', realizationMode: 'debit',
    classification: 'C', analyticNatureIds: [], lines: [{ id: 'line-orders-601', accountCode: '601', label: 'Prestations', annualAmount: 1000, amountComplete: true }]
  };
  const accounts = [{ code: '601', label: 'Prestations de services' }];
  const linkedOrders = [
    { id: 'order-before', status: 'issued', date: '2025-01-05', reference: 'CMD-1', description: 'Avant période', currencyCode: 'XOF', lines: [{ id: 'line-before', description: 'Acompte', amount: 200, budgetId: budget.id, budgetLineId: 'line-orders-601' }] },
    { id: 'order-period', status: 'issued', date: '2025-01-15', reference: 'CMD-2', description: 'Dans période', currencyCode: 'XOF', lines: [{ id: 'line-period', description: 'Intervention', amount: 300, budgetId: budget.id, budgetLineId: 'line-orders-601' }] },
    { id: 'order-draft', status: 'draft', date: '2025-01-16', currencyCode: 'XOF', lines: [{ id: 'line-draft', amount: 900, budgetId: budget.id, budgetLineId: 'line-orders-601' }] },
    { id: 'order-cancelled', status: 'cancelled', date: '2025-01-17', currencyCode: 'XOF', lines: [{ id: 'line-cancelled', amount: 800, budgetId: budget.id, budgetLineId: 'line-orders-601' }] }
  ];
  const followup = BudgetReports.buildReport('budget-orders-followup', options({
    budgetRegister: [budget], budgetCode: '2025C', supplierOrders: linkedOrders,
    accountFilter: '601', accounts, baseCurrencyCode: 'XOF', from: '2025-01-10', to: '2025-01-20'
  }));
  assert.equal(followup.ok, true, followup.errors.join(' '));
  assert.equal(followup.generatedLineCount, 1);
  assert.equal(followup.rows[0].budgetAmount, 1000);
  assert.equal(followup.rows[0].priorCommitments, 200);
  assert.equal(followup.rows[0].periodCommitments, 300);
  assert.equal(followup.rows[0].totalCommitments, 500);
  assert.equal(followup.rows[0].remainingOnExercise, 500);
  assert.equal(followup.sourceOrderLineCount, 2, 'brouillons et annulations sont exclus');
  assert.equal(followup.matchedOrderLineCount, 2);
  assert.equal(followup.basis.commitmentRegisterAvailable, true);
  assert.equal(followup.basis.noAccountingMutation, true);

  const incompleteOrders = linkedOrders.concat([
    { id: 'order-fx', status: 'issued', date: '2025-01-16', reference: 'CMD-FX', currencyCode: 'USD', lines: [{ id: 'line-fx', amount: 100, budgetId: budget.id, budgetLineId: 'line-orders-601' }] },
    { id: 'order-unlinked', status: 'issued', date: '2025-01-17', reference: 'CMD-UNLINKED', currencyCode: 'XOF', lines: [{ id: 'line-unlinked', amount: 70 }] },
    { id: 'order-stale', status: 'issued', date: '2025-01-18', reference: 'CMD-STALE', currencyCode: 'XOF', lines: [{ id: 'line-stale', amount: 50, budgetId: budget.id, budgetLineId: 'missing-line' }] }
  ]);
  const partial = BudgetReports.buildReport('budget-orders-followup', options({
    budgetRegister: [budget], budgetCode: '2025C', supplierOrders: incompleteOrders,
    accountFilter: '601', accounts, baseCurrencyCode: 'XOF', from: '2025-01-10', to: '2025-01-20'
  }));
  assert.equal(partial.rows[0].periodCommitments, null, 'un montant lié en devise étrangère n’est pas converti');
  assert.equal(partial.rows[0].remainingOnExercise, null, 'les liens incomplets empêchent de certifier le reste');
  assert.equal(partial.unlinkedOrderLineCount, 1);
  assert.equal(partial.staleLinkCount, 1);
  assert.equal(partial.nonBaseCurrencyLineCount, 1);
  assert.match(partial.warnings.join(' '), /sans liaison budgétaire explicite/);
  assert.match(partial.warnings.join(' '), /ne sont pas converties/);

  const detail = BudgetReports.buildReport('budget-orders-by-line', options({
    budgetRegister: [budget], budgetCode: '2025C', supplierOrders: incompleteOrders,
    accountFilter: '601', accounts, baseCurrencyCode: 'XOF', from: '2025-01-10', to: '2025-01-20'
  }));
  assert.equal(detail.rows.length, 1, 'seule la commande émise XOF explicitement liée est détaillée');
  assert.equal(detail.rows[0].order, 'CMD-2');
  assert.equal(detail.rows[0].amount, 300);
  assert.equal(detail.rows[0].budgetLineLabel, 'Prestations');
});

test('les commandes hors budget exigent un classement explicite, un compte exact et une devise exploitable', () => {
  const budget = {
    id: 'budget-outside-2025', code: '2025C', year: '2025', type: 'C', label: 'Charges',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', decomposition: 'none', realizationMode: 'debit',
    classification: 'C', analyticNatureIds: [], lines: [{ id: 'line-outside-601', accountCode: '601', label: 'Prestations', annualAmount: 1000, amountComplete: true }]
  };
  const supplierOrders = [
    { id: 'outside-order', status: 'issued', date: '2025-02-01', reference: 'CMD-OUT', currencyCode: 'XOF', lines: [{ id: 'outside-line', description: 'Marché déclaré hors budget', amount: 125, budgetTreatment: 'outside', accountCode: '930100', market: 'MARCHÉ-01' }] },
    { id: 'unclassified-order', status: 'issued', date: '2025-02-02', currencyCode: 'XOF', lines: [{ id: 'unclassified-line', amount: 500, accountCode: '930100' }] },
    { id: 'linked-order', status: 'issued', date: '2025-02-03', currencyCode: 'XOF', lines: [{ id: 'linked-line', amount: 600, budgetId: budget.id, budgetLineId: 'line-outside-601' }] },
    { id: 'foreign-outside-order', status: 'issued', date: '2025-02-04', currencyCode: 'USD', lines: [{ id: 'foreign-outside-line', amount: 700, budgetTreatment: 'outside', accountCode: '930100' }] },
    { id: 'invalid-account-order', status: 'issued', date: '2025-02-05', currencyCode: 'XOF', lines: [{ id: 'invalid-account-line', amount: 800, budgetTreatment: 'outside', accountCode: '999999' }] },
    { id: 'draft-outside-order', status: 'draft', date: '2025-02-06', currencyCode: 'XOF', lines: [{ id: 'draft-outside-line', amount: 900, budgetTreatment: 'outside', accountCode: '930100' }] }
  ];
  const report = BudgetReports.buildReport('budget-orders-outside', options({
    budgetRegister: [budget], budgetCode: '2025C', supplierOrders,
    accounts: [{ code: '930100', label: 'Compte de projet' }], baseCurrencyCode: 'XOF', from: '2025-01-01', to: '2025-12-31'
  }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.rows.length, 1);
  assert.equal(report.sourceOrderLineCount, 5, 'brouillons et annulations sont exclus du périmètre');
  assert.deepEqual([report.rows[0].accountCode, report.rows[0].accountLabel, report.rows[0].market, report.rows[0].amount, report.rows[0].reserved1, report.rows[0].reserved2], ['930100', 'Compte de projet', 'MARCHÉ-01', 125, '-', '-']);
  assert.equal(report.unclassifiedLineCount, 1, 'une absence de classification n’est pas interprétée hors budget');
  assert.equal(report.linkedLineCount, 1, 'les lignes liées à un budget sont exclues');
  assert.equal(report.nonBaseCurrencyLineCount, 1, 'aucune conversion n’est faite');
  assert.equal(report.unknownAccountLineCount, 1, 'un compte absent du plan n’est pas exploité');
  assert.equal(report.basis.noBudgetAmountsSimulated, true);
  assert.equal(report.basis.noCommitmentsSimulated, false);
  assert.equal(report.basis.noAccountingMutation, true);
  assert.match(report.warnings.join(' '), /ne sont pas assimilées à des commandes hors budget/);
  assert.match(report.warnings.join(' '), /ne sont ni converties/);
});

test('le suivi des réalisations relie le budget enregistré aux seules écritures validées', () => {
  const registeredBudget = {
    id: 'budget-2025c', code: '2025C', year: '2025', type: 'C', label: 'Charges enregistrées',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', decomposition: 'none', realizationMode: 'debit-credit',
    classification: 'C', analyticNatureIds: [], lines: [{ id: 'line-601', accountCode: '601', label: 'Services', annualAmount: 1000, amountComplete: true, periodAmounts: {}, analyticValues: {} }]
  };
  const entries = [
    { id: 'before', status: 'posted', date: '2025-01-08', lines: [{ account: '601', debit: 40, credit: 5 }] },
    { id: 'period-debit', status: 'posted', date: '2025-01-15', lines: [{ account: '601', debit: 100, credit: 0 }] },
    { id: 'period-credit', status: 'posted', date: '2025-01-20', lines: [{ account: '601', debit: 0, credit: 30 }] },
    { id: 'draft', status: 'draft', date: '2025-01-21', lines: [{ account: '601', debit: 900, credit: 0 }] },
    { id: 'other-account', status: 'posted', date: '2025-01-22', lines: [{ account: '602', debit: 700, credit: 0 }] }
  ];
  const report = BudgetReports.buildReport('budget-realizations-followup', options({
    budgetRegister: [registeredBudget], budgetCode: '2025C', accountFilter: '60*',
    from: '2025-01-10', to: '2025-01-31', entries
  }));
  assert.equal(report.ok, true, report.errors.join(' '));
  assert.equal(report.budget.id, registeredBudget.id);
  assert.deepEqual(report.budgetOptions.map(item => item.code), ['2025C']);
  assert.equal(report.generatedLineCount, 1);
  assert.equal(report.rows[0].accountCode, '601');
  assert.equal(report.rows[0].budgetAmount, 1000);
  assert.equal(report.rows[0].realizationBeforePeriod, 35);
  assert.equal(report.rows[0].periodRealization, 70);
  assert.equal(report.rows[0].realizationAtPeriodEnd, 105);
  assert.equal(report.rows[0].remainingAtPeriodEnd, 895);
  assert.equal(report.rows[0].previousBudget, null, 'N-1 reste explicitement indisponible');
  assert.equal(report.sourceEntryCount, 4, 'le cumul indique les écritures validées du dossier jusqu’à la fin de période, hors brouillons');
  assert.equal(report.matchedSourceLineCount, 3, 'seules les lignes de comptes budgétés contribuent au réalisé');
  assert.equal(report.basis.noAccountingMutation, true);
  assert.equal(report.basis.accountsLimitedToAnalyticClasses93to99, false, 'le filtre suit les comptes réellement budgétés, pas une classe présumée');
  assert.match(report.warnings.join(' '), /N-1 restent indisponibles/);

  const analyticBudget = {
    ...registeredBudget, id: 'budget-2025-analytic', classification: 'A1', analyticNatureIds: ['activity-domains'],
    lines: [{ id: 'line-analytic', accountCode: '601', label: 'Services', annualAmount: 100, amountComplete: true, periodAmounts: {}, analyticValues: { 'activity-domains': { valueLabel: 'Services' } } }]
  };
  const analyticReport = BudgetReports.buildReport('budget-realizations-followup', options({
    budgetRegister: [analyticBudget], budgetCode: analyticBudget.code, accountFilter: '*',
    from: '2025-01-01', to: '2025-06-30', entries: [
      { id: 'analytic-entry', status: 'posted', date: '2025-04-10', lines: [{ account: '601', debit: 100, credit: 0, analyticSplits: [{ natureId: 'activity-domains', allocations: [{ valueLabel: 'Services', amount: 60 }], unallocatedAmount: 40 }] }] },
      { id: 'future-unbudgeted', status: 'posted', date: '2025-11-10', lines: [{ account: '601', debit: 50, credit: 0, analyticSplits: [{ natureId: 'activity-domains', allocations: [{ valueLabel: 'Valeur future non budgétée', amount: 50 }], unallocatedAmount: 0 }] }] }
    ]
  }));
  const analyticServices = analyticReport.rows.find(row => row.accountLabel === 'Services');
  const analyticRemainder = analyticReport.rows.find(row => row.status === 'unclassified-realization');
  assert.equal(analyticServices.realizationAtPeriodEnd, 60, 'seule l’imputation explicite de la nature classée est reprise');
  assert.equal(analyticServices.remainingAtPeriodEnd, 40);
  assert.equal(analyticRemainder.realizationAtPeriodEnd, 40, 'le reliquat reste séparé et non ventilé');
  assert.equal(analyticReport.rows.some(row => row.accountLabel.indexOf('Valeur future') !== -1), false, 'aucune réalisation postérieure à la fin de période n’apparaît');
  assert.equal(analyticReport.axisNatureId, 'activity-domains');

  const empty = BudgetReports.buildReport('budget-realizations-followup', options({ budgetRegister: [], budgetCode: '' }));
  assert.equal(empty.ok, false, 'aucun budget fictif ne doit être proposé dans le parcours applicatif');
});

test('le détail restitue les seules lignes validées du budget et sépare les ventilations analytiques', () => {
  const registeredBudget = {
    id: 'budget-detail-2025', code: '2025C', year: '2025', type: 'C', label: 'Charges détaillées',
    cycleStart: '2025-01-01', cycleEnd: '2025-12-31', decomposition: 'none', realizationMode: 'debit-credit',
    classification: 'C', analyticNatureIds: [], lines: [{ id: 'line-601', accountCode: '601', label: 'Services', annualAmount: 1000, amountComplete: true, periodAmounts: {}, analyticValues: {} }]
  };
  const entries = [
    { id: 'posted-match', status: 'posted', date: '2025-02-03', journal: 'OD', reference: 'OD-1', description: 'Prestation', lines: [{ account: '601', debit: 100, credit: 0, label: 'Ligne validée' }] },
    { id: 'draft', status: 'draft', date: '2025-02-04', lines: [{ account: '601', debit: 900, credit: 0 }] },
    { id: 'other-account', status: 'posted', date: '2025-02-05', lines: [{ account: '602', debit: 800, credit: 0 }] },
    { id: 'outside-period', status: 'posted', date: '2025-07-01', lines: [{ account: '601', debit: 700, credit: 0 }] }
  ];
  const detail = BudgetReports.buildReport('budget-realizations-by-line', options({
    budgetRegister: [registeredBudget], budgetCode: '2025C', accountFilter: '601',
    from: '2025-02-01', to: '2025-06-30', entries, accounts: [{ code: '601', label: 'Prestations' }]
  }));
  assert.equal(detail.ok, true, detail.errors.join(' '));
  assert.equal(detail.generatedLineCount, 1);
  assert.deepEqual(detail.rows[0], {
    date: '2025-02-03', journal: 'OD', piece: 'OD-1', accountCode: '601', accountLabel: 'Prestations',
    debit: 100, credit: 0, label: 'Ligne validée', sourceEntryId: 'posted-match', sourceLineIndex: 0, allocationIndex: -1
  });
  assert.equal(detail.sourceEntryCount, 1);
  assert.equal(detail.matchedSourceLineCount, 1);
  assert.equal(detail.basis.noAccountingMutation, true);
  const missingIds = BudgetReports.buildReport('budget-realizations-by-line', options({
    budgetRegister: [registeredBudget], budgetCode: '2025C', accountFilter: '601',
    from: '2025-02-01', to: '2025-06-30', entries: [
      { status: 'posted', date: '2025-03-01', lines: [{ account: '601', debit: 10, credit: 0 }] },
      { status: 'posted', date: '2025-03-01', lines: [{ account: '601', debit: 15, credit: 0 }] }
    ]
  }));
  assert.equal(missingIds.sourceEntryCount, 2, 'les pièces sans identifiant restent comptées individuellement');

  const analyticBudget = {
    ...registeredBudget, id: 'budget-detail-axis', code: '2025X', type: 'X', classification: 'A1', analyticNatureIds: ['activity-domains'],
    lines: [{ id: 'axis-line', accountCode: '601', label: 'Services', annualAmount: 1000, amountComplete: true, periodAmounts: {}, analyticValues: { 'activity-domains': { valueLabel: 'Services' } } }]
  };
  const analytic = BudgetReports.buildReport('budget-realizations-by-line', options({
    budgetRegister: [analyticBudget], budgetCode: '2025X', accountFilter: '*',
    from: '2025-02-01', to: '2025-06-30',
    entries: [{ id: 'analytic-posted', status: 'posted', date: '2025-03-01', journal: 'OD', reference: 'OD-A', lines: [{ account: '601', debit: 100, credit: 0, label: 'Ventilation source', analyticSplits: [{ natureId: 'activity-domains', allocations: [{ valueLabel: 'Services', amount: 60 }, { valueLabel: 'Autre valeur', amount: 20 }], unallocatedAmount: 20 }] }] }]
  }));
  assert.equal(analytic.ok, true, analytic.errors.join(' '));
  assert.equal(analytic.rows.length, 3, 'les deux affectations explicites et le reliquat restent distincts');
  assert.deepEqual(analytic.rows.map(row => row.debit), [60, 20, 20]);
  assert.match(analytic.rows[0].label, /Imputation explicite · valeur budgétée/);
  assert.match(analytic.rows[1].label, /valeur sans ligne budgétaire/);
  assert.match(analytic.rows[2].label, /À ventiler · reliquat analytique explicite/);
  assert.equal(analytic.unmatchedValueCount, 1);
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
