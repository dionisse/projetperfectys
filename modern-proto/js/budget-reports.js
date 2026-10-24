/*
 * PERFECTO · États du sous-menu Budget.
 * Les sélections suivent les formulaires fournis ; faute de registre budgétaire,
 * de commandes et de réalisations, le modèle ne fabrique aucune ligne de résultat.
 */
(function (root, factory) {
  'use strict';
  var currencyReport = root.PerfectoCurrencyBalanceReport;
  if (!currencyReport && typeof module !== 'undefined' && module.exports) currencyReport = require('./currency-balance-report.js');
  var api = factory(currencyReport);
  root.PerfectoBudgetReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (CurrencyBalanceReport) {
  'use strict';

  var BUDGET_TYPES = [
    { suffix: 'C', label: 'Charges' },
    { suffix: 'I', label: 'Investissements' },
    { suffix: 'P', label: 'Produits' }
  ];

  var DEFINITIONS = {
    'budget-entered': {
      id: 'budget-entered', kind: 'forecast', title: 'Budget prévisionnel',
      filters: ['budget', 'accounts'], showLines: true, showGroupingCodes: true, showGeneratedCount: true,
      accountLabel: 'Comptes généraux',
      columns: [
        { key: 'accountCode', label: 'Code', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'budgetAmount', label: 'Budget exercice', text: false },
        { key: 'shareOfTotal', label: 'Pourcentage du total', text: false }
      ]
    },
    'budget-orders-followup': {
      id: 'budget-orders-followup', kind: 'orders-followup', title: 'Budget, reste sur commandes',
      filters: ['budget', 'accounts', 'from', 'to'], showLines: true, showGroupingCodes: false, showGeneratedCount: true, columnStacks: 3,
      accountLabel: 'Compte',
      columns: [
        { key: 'accountCode', label: 'Code', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'budgetAmount', label: 'Budget exercice', text: false },
        { key: 'priorCommitments', label: 'Engagements antérieurs', text: false },
        { key: 'periodCommitments', label: 'Engagements période', text: false },
        { key: 'totalCommitments', label: 'Engagements totaux', text: false },
        { key: 'remainingOnExercise', label: 'Reste sur l’exercice', text: false }
      ]
    },
    'budget-orders-by-line': {
      id: 'budget-orders-by-line', kind: 'orders-by-line', title: 'Détail des commandes des lignes budgétaires',
      filters: ['budget', 'accounts', 'from', 'to'], accountLabel: 'Compte', columnStacks: 3,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'order', label: 'Commande', text: true },
        { key: 'orderLabel', label: 'Libellé de la commande', text: true },
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé du compte', text: true },
        { key: 'budgetLineLabel', label: 'Libellé de la ligne', text: true },
        { key: 'amount', label: 'Montant', text: false }
      ]
    },
    'budget-orders-outside': {
      id: 'budget-orders-outside', kind: 'orders-outside', title: 'Commandes hors Budget',
      filters: ['budget', 'from', 'to'], columnStacks: 3,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'market', label: 'Marché', text: true },
        { key: 'reserved1', label: '-', text: true },
        { key: 'reserved2', label: '-', text: true },
        { key: 'amount', label: 'Montant', text: false }
      ]
    },
    'budget-realizations-followup': {
      id: 'budget-realizations-followup', kind: 'realizations-followup', title: 'Budget, suivi des réalisations',
      filters: ['budget', 'accounts', 'from', 'to'], showLines: true, showGroupingCodes: true, accountLabel: 'Compte',
      columns: [
        { key: 'accountCode', label: 'Code', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'previousBudget', label: 'Budget N-1', text: false },
        { key: 'previousRealization', label: 'Réalisation N-1', text: false },
        { key: 'budgetAmount', label: 'Budget exercice', text: false },
        { key: 'realizationBeforePeriod', label: 'Réalisation avant période', text: false },
        { key: 'periodRealization', label: 'Réalisation période', text: false },
        { key: 'realizationAtPeriodEnd', label: 'Réalisation fin période', text: false },
        { key: 'remainingAtPeriodEnd', label: 'Reste fin période', text: false }
      ]
    },
    'budget-realizations-by-line': {
      id: 'budget-realizations-by-line', kind: 'realizations-by-line', title: 'Détail des réalisations budgétaires',
      filters: ['budget', 'accounts', 'from', 'to'], accountLabel: 'Compte', columnStacks: 3,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'journal', label: 'Journal', text: true },
        { key: 'piece', label: 'Pièce', text: true },
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'budget-outside-realizations-total': {
      id: 'budget-outside-realizations-total', kind: 'outside-realizations-total', title: 'Cumul des réalisations hors Budget',
      filters: ['budget', 'from', 'to'], columnStacks: 2,
      columns: [
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'amount', label: 'Montant', text: false }
      ]
    },
    'budget-outside-realizations-detail': {
      id: 'budget-outside-realizations-detail', kind: 'outside-realizations-detail', title: 'Réalisations hors Budget',
      filters: ['budget', 'from', 'to'], columnStacks: 3,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'journal', label: 'Journal', text: true },
        { key: 'piece', label: 'Pièce', text: true },
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'market', label: 'Marché', text: true },
        { key: 'reserved1', label: '-', text: true },
        { key: 'reserved2', label: '-', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false, defaultSelected: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'budget-available-not-committed': {
      id: 'budget-available-not-committed', kind: 'availability-summary', title: 'Budget, engagements et réalisations',
      filters: ['budget', 'asOfDate'], showLines: true, showGroupingCodes: false, columnStacks: 3,
      columns: [
        { key: 'accountCode', label: 'Code', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'budgetAmount', label: 'Budget', text: false },
        { key: 'commitments', label: 'Engagements', text: false },
        { key: 'realizations', label: 'Réalisations', text: false }
      ]
    },
    'budget-available-balance': {
      id: 'budget-available-balance', kind: 'available-balance', title: 'Budget, reste disponible',
      filters: ['budget', 'accounts', 'asOfDate'], showLines: true, showGroupingCodes: false, columnStacks: 3,
      accountLabel: 'Compte',
      columns: [
        { key: 'accountCode', label: 'Code', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'budgetAmount', label: 'Budget', text: false },
        { key: 'commitments', label: 'Engagements', text: false },
        { key: 'uncommittedExpenses', label: 'Dépenses hors engag.', text: false },
        { key: 'consumedBudget', label: 'Budget consommé', text: false },
        { key: 'consumedPercent', label: '% consommé', text: false },
        { key: 'remainingAvailable', label: 'Reste disponible', text: false }
      ]
    }
  };

  function cloneDefinition(definition) {
    if (!definition) return null;
    return Object.assign({}, definition, {
      filters: definition.filters.slice(),
      columns: definition.columns.map(function (column) {
        return Object.assign({ defaultSelected: true }, column);
      })
    });
  }

  function definitionFor(reportId) { return cloneDefinition(DEFINITIONS[String(reportId || '')]); }

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function budgetOptions(cycleStart) {
    var value = String(cycleStart || '');
    var match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
    if (!match) return [];
    var year = match[1];
    return BUDGET_TYPES.map(function (type) {
      var code = year + type.suffix;
      return { code: code, year: year, type: type.suffix, label: code + ' - ' + type.label, category: type.label };
    });
  }

  function emptyResult(reportId, definition, options, errors, warnings, budget) {
    return {
      ok: !errors.length,
      reportId: reportId,
      kind: definition ? definition.kind : '',
      title: definition ? definition.title : '',
      errors: errors.slice(),
      warnings: warnings.slice(),
      budget: budget || null,
      budgetCode: budget ? budget.code : '',
      from: String(options && options.from || ''),
      to: String(options && options.to || ''),
      asOfDate: String(options && options.asOfDate || ''),
      accountFilter: options && options.accountFilter || '*',
      rows: [],
      generatedLineCount: 0,
      dataAvailable: false,
      basis: {
        budgetRegisterAvailable: false,
        commitmentRegisterAvailable: false,
        realizationRegisterAvailable: false,
        accountsLimitedToAnalyticClasses93to99: true,
        noBudgetAmountsSimulated: true,
        noCommitmentsSimulated: true,
        noRealizationsSimulated: true,
        noAvailabilityOrExecutionRateSimulated: true,
        noAccountingMutation: true
      }
    };
  }

  function buildReport(reportId, options) {
    options = options || {};
    reportId = String(reportId || '');
    var definition = DEFINITIONS[reportId];
    if (!definition) return emptyResult(reportId, null, options, ['État budgétaire inconnu.'], [], null);

    var errors = [];
    var warnings = [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    var availableBudgets = budgetOptions(cycleStart);
    var selectedBudget = availableBudgets.find(function (item) { return item.code === String(options.budgetCode || ''); }) || null;
    if (!selectedBudget) errors.push('Sélectionnez un budget C (Charges), I (Investissements) ou P (Produits) de l’exercice du dossier.');

    var accountOptions = CurrencyBalanceReport.accountOptions(
      Array.isArray(options.accounts) ? options.accounts : [],
      Array.isArray(options.entries) ? options.entries : []
    );
    var accountFilter = definition.filters.indexOf('accounts') !== -1
      ? CurrencyBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter, accountOptions)
      : CurrencyBalanceReport.parseAccountFilter('*', accountOptions);
    if (!accountFilter.valid) errors.push(accountFilter.error);

    var hasPeriod = definition.filters.indexOf('from') !== -1;
    var from = String(options.from || (hasPeriod ? cycleStart : ''));
    var to = String(options.to || (hasPeriod ? cycleEnd : ''));
    if (hasPeriod) {
      if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour la période budgétaire.');
      else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
      else if (from < cycleStart || to > cycleEnd) errors.push('La période budgétaire doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    var hasAsOfDate = definition.filters.indexOf('asOfDate') !== -1;
    var asOfDate = String(options.asOfDate || (hasAsOfDate ? cycleEnd : ''));
    if (hasAsOfDate) {
      if (!isIsoDate(asOfDate)) errors.push('Indiquez une date d’arrêté valide.');
      else if (asOfDate < cycleStart || asOfDate > cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));

    if (errors.length) return emptyResult(reportId, definition, options, errors, warnings, selectedBudget);
    if (definition.kind === 'forecast') warnings.push('Aucun registre de budget prévisionnel n’est enregistré dans le dossier ; aucun montant ni pourcentage n’est calculé.');
    else if (definition.kind.indexOf('orders-') === 0) warnings.push('Aucun registre de commandes ou d’engagements budgétaires n’est disponible ; aucune commande, ligne ou somme engagée n’est inventée.');
    else if (definition.kind.indexOf('realizations-') === 0 || definition.kind.indexOf('outside-realizations-') === 0 || definition.kind === 'outside-realizations-total') warnings.push('Aucune réalisation budgétaire rapprochée n’est enregistrée ; aucun montant réalisé ni cumul hors budget n’est calculé.');
    else if (definition.kind === 'availability-summary' || definition.kind === 'available-balance') warnings.push('Aucun registre budgétaire, engagement ou réalisation rapprochée n’est disponible ; aucun budget consommé ni reste disponible n’est calculé.');
    warnings.push('Le périmètre de comptes, avec ou sans filtre affiché, est limité aux rubriques analytiques 93 à 99.');

    var result = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
    result.ok = true;
    result.cycleStart = cycleStart;
    result.cycleEnd = cycleEnd;
    result.from = hasPeriod ? from : '';
    result.to = hasPeriod ? to : '';
    result.asOfDate = hasAsOfDate ? asOfDate : '';
    result.accountFilter = accountFilter;
    result.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
    result.lineSelection = {
      generalAccounts: options.generalAccounts !== false,
      groupingCodes: options.groupingCodes === true,
      placeholderLines: Array.isArray(options.placeholderLines) ? options.placeholderLines.map(Boolean).slice(0, 2) : [false, false]
    };
    return result;
  }

  return {
    BUDGET_TYPES: BUDGET_TYPES.map(function (item) { return Object.assign({}, item); }),
    REPORT_IDS: Object.keys(DEFINITIONS),
    definitionFor: definitionFor,
    budgetOptions: budgetOptions,
    buildReport: buildReport
  };
});
