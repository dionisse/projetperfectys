/*
 * PERFECTO · États du sous-menu Budget.
 * Les états sans raccordement de source restent vides ; le suivi des réalisations
 * s’appuie sur le registre budgétaire du dossier et les écritures validées.
 */
(function (root, factory) {
  'use strict';
  var currencyReport = root.PerfectoCurrencyBalanceReport;
  var budgetRealizations = root.PerfectoBudgetRealizations;
  if (!currencyReport && typeof module !== 'undefined' && module.exports) currencyReport = require('./currency-balance-report.js');
  if (!budgetRealizations && typeof module !== 'undefined' && module.exports) budgetRealizations = require('./budget-realizations.js');
  var api = factory(currencyReport, budgetRealizations);
  root.PerfectoBudgetReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (CurrencyBalanceReport, BudgetRealizations) {
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

  function budgetOptions(cycleStart, budgetRows, cycleEnd) {
    var value = String(cycleStart || '');
    var match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
    if (!match) return [];
    var year = match[1];
    if (Array.isArray(budgetRows)) {
      return budgetRows.filter(function (budget) {
        return budget && String(budget.year || '') === year && isIsoDate(budget.cycleStart) && isIsoDate(budget.cycleEnd) &&
          budget.cycleStart === value && budget.cycleEnd === String(cycleEnd || '') && budget.cycleStart <= budget.cycleEnd;
      }).map(function (budget) {
        var typeLabel = BUDGET_TYPES.find(function (item) { return item.suffix === budget.type; });
        return { code: String(budget.code || ''), year: year, type: String(budget.type || 'X'), label: String(budget.code || '') + ' - ' + String(budget.label || typeLabel && typeLabel.label || 'Personnalisé'), category: String(budget.label || typeLabel && typeLabel.label || 'Personnalisé'), budget: budget };
      }).filter(function (item) { return item.code; });
    }
    return BUDGET_TYPES.map(function (type) {
      var code = year + type.suffix;
      return { code: code, year: year, type: type.suffix, label: code + ' - ' + type.label, category: type.label };
    });
  }

  function budgetAccountFilter(expression, budgetLines) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    var codes = (Array.isArray(budgetLines) ? budgetLines : []).map(function (line) { return String(line && line.accountCode || '').trim(); }).filter(Boolean);
    if (!tokens.length) return { valid: false, codes: [], error: 'Indiquez un compte budgété ou * pour tous les comptes de ce budget.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, codes: codes, error: '' };
    var selected = Object.create(null);
    var errors = [];
    tokens.forEach(function (token) {
      var pattern = token.slice(-1) === '*' ? token.slice(0, -1) : token;
      if (!/^\d{1,12}$/.test(pattern)) { errors.push(token); return; }
      var matches = codes.filter(function (code) { return token.slice(-1) === '*' ? code.indexOf(pattern) === 0 : code === pattern; });
      if (!matches.length) errors.push(token + ' (aucune ligne budgétaire correspondante)');
      matches.forEach(function (code) { selected[code] = true; });
    });
    return errors.length
      ? { valid: false, codes: [], error: 'Compte(s) hors des lignes budgétaires sélectionnées : ' + errors.join(', ') + '.' }
      : { valid: true, codes: Object.keys(selected), error: '' };
  }

  function sumValues(values) {
    var available = (Array.isArray(values) ? values : []).filter(function (value) { return value != null && Number.isFinite(Number(value)); });
    return available.length ? available.reduce(function (sum, value) { return sum + Number(value); }, 0) : null;
  }

  function realizationRows(budget, entries, accountCodes, from, to) {
    var filteredBudget = Object.assign({}, budget, { lines: budget.lines.filter(function (line) { return accountCodes.indexOf(String(line.accountCode || '')) !== -1; }) });
    var cycleEntries = (Array.isArray(entries) ? entries : []).filter(function (entry) {
      return entry && entry.status === 'posted' && isIsoDate(entry.date) && entry.date >= filteredBudget.cycleStart && entry.date <= filteredBudget.cycleEnd;
    });
    function calculate(predicate) {
      return BudgetRealizations.calculate({ budget: filteredBudget, entries: cycleEntries.filter(predicate) });
    }
    var all = calculate(function () { return true; });
    var before = from === filteredBudget.cycleStart ? null : calculate(function (entry) { return entry.date < from; });
    var period = calculate(function (entry) { return entry.date >= from && entry.date <= to; });
    var through = calculate(function (entry) { return entry.date <= to; });
    var calculations = [all, before, period, through].filter(Boolean);
    var errors = calculations.reduce(function (result, item) { return result.concat(item.errors || []); }, []);
    if (errors.length) return { ok: false, errors: Array.from(new Set(errors)), rows: [], sourceEntryCount: 0, matchedSourceLineCount: 0, noSourceData: true };
    function indexRows(result) {
      var index = Object.create(null);
      (result && result.rows || []).forEach(function (row) { index[row.key] = row; });
      return index;
    }
    function amountFor(resultIndex, key, property) {
      var row = resultIndex && resultIndex[key];
      return row ? sumValues(row.periods.map(function (item) { return item[property]; })) : null;
    }
    var allRows = indexRows(all);
    var beforeRows = indexRows(before);
    var periodRows = indexRows(period);
    var throughRows = indexRows(through);
    var keys = Object.keys(allRows).filter(function (key) {
      return allRows[key].status === 'budgeted' || allRows[key].status === 'unclassified-budget';
    });
    [beforeRows, periodRows, throughRows].forEach(function (index) {
      Object.keys(index).forEach(function (key) { if (keys.indexOf(key) === -1) keys.push(key); });
    });
    var rows = keys.map(function (key) {
      var source = allRows[key] || beforeRows[key] || periodRows[key] || throughRows[key];
      var budgetValues = (source.periods || []).map(function (item) { return item.budgetAmount; });
      var budgetAmount = budgetValues.length && budgetValues.every(function (value) { return value != null && Number.isFinite(Number(value)); })
        ? budgetValues.reduce(function (sum, value) { return sum + Number(value); }, 0)
        : null;
      var priorRealization = before ? amountFor(beforeRows, key, 'realizationAmount') : 0;
      var periodRealization = amountFor(periodRows, key, 'realizationAmount');
      var realizationAtPeriodEnd = amountFor(throughRows, key, 'realizationAmount');
      return {
        key: key,
        accountCode: (source.accountCodes || []).join(', '),
        accountLabel: source.label,
        status: source.status,
        previousBudget: null,
        previousRealization: null,
        budgetAmount: budgetAmount,
        realizationBeforePeriod: priorRealization,
        periodRealization: periodRealization,
        realizationAtPeriodEnd: realizationAtPeriodEnd,
        remainingAtPeriodEnd: budgetAmount == null || realizationAtPeriodEnd == null ? null : budgetAmount - realizationAtPeriodEnd
      };
    });
    return {
      ok: true,
      rows: rows,
      sourceEntryCount: through.sourceEntryCount,
      matchedSourceLineCount: through.matchedSourceLineCount,
      noSourceData: through.noSourceData,
      realizationMode: budget.realizationMode,
      classification: budget.classification,
      axisNatureId: through.axisNatureId,
      noAccountingMutation: true
    };
  }

  function realizationDetailRows(budget, entries, accountCodes, from, to, accounts) {
    var classification = String(budget.classification || 'C');
    var axisIndex = classification.charAt(0) === 'A' ? Number(classification.slice(1)) - 1 : -1;
    var axisNatureId = axisIndex >= 0 && Array.isArray(budget.analyticNatureIds) ? budget.analyticNatureIds[axisIndex] : '';
    var accountLabels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      var code = String(account && account.code || '');
      if (code) accountLabels[code] = String(account.label || account.name || '');
    });
    var rows = [];
    var entryIds = Object.create(null);
    var sourceLineCount = 0;
    var unallocatedCount = 0;
    var unmatchedValueCount = 0;
    function addSourceRow(entry, line, accountCode, amount, valueLabel, suffix, lineIndex, allocationIndex) {
      var debit = Number(line.debit) || 0;
      var credit = Number(line.credit) || 0;
      var bothSides = debit > 0 && credit > 0;
      var side = debit > 0 && !credit ? 'debit' : credit > 0 && !debit ? 'credit' : '';
      var rowAmount = Number(amount);
      var rowDebit = side === 'debit' && Number.isFinite(rowAmount) && rowAmount >= 0 ? rowAmount : (bothSides ? debit : 0);
      var rowCredit = side === 'credit' && Number.isFinite(rowAmount) && rowAmount >= 0 ? rowAmount : (bothSides ? credit : 0);
      var label = String(line.label || entry.description || '');
      if (valueLabel) label += (label ? ' · ' : '') + 'Valeur analytique : ' + valueLabel;
      if (suffix) label += (label ? ' · ' : '') + suffix;
      rows.push({
        date: String(entry.date || ''), journal: String(entry.journal || ''), piece: String(entry.reference || ''),
        accountCode: accountCode, accountLabel: accountLabels[accountCode] || accountCode,
        debit: rowDebit, credit: rowCredit, label: label,
        sourceEntryId: String(entry.id || ''), sourceLineIndex: lineIndex, allocationIndex: allocationIndex
      });
    }
    (Array.isArray(entries) ? entries : []).forEach(function (entry, entryIndex) {
      if (!entry || entry.status !== 'posted' || !isIsoDate(entry.date) || entry.date < from || entry.date > to || entry.date < budget.cycleStart || entry.date > budget.cycleEnd) return;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
        var accountCode = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        if (!line || accountCodes.indexOf(accountCode) === -1) return;
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        var lineAmount = debit > 0 && credit > 0 ? NaN : debit > 0 ? debit : credit;
        sourceLineCount += 1;
        entryIds[String(entry.id || 'entry-' + entryIndex)] = true;
        if (classification === 'C') {
          addSourceRow(entry, line, accountCode, lineAmount, '', '', lineIndex, -1);
          return;
        }
        if (!Number.isFinite(lineAmount)) {
          addSourceRow(entry, line, accountCode, NaN, '', 'À vérifier · débits et crédits simultanés sur la ligne source', lineIndex, -1);
          unallocatedCount += 1;
          return;
        }
        var split = (Array.isArray(line.analyticSplits) ? line.analyticSplits : []).find(function (item) { return item && item.natureId === axisNatureId; });
        if (!split) {
          addSourceRow(entry, line, accountCode, lineAmount, '', 'À ventiler · aucune imputation explicite pour la nature du budget', lineIndex, -1);
          unallocatedCount += 1;
          return;
        }
        var assigned = 0;
        (Array.isArray(split.allocations) ? split.allocations : []).forEach(function (allocation, allocationIndex) {
          var amount = Number(allocation && allocation.amount);
          if (!Number.isFinite(amount) || amount <= 0) return;
          assigned += amount;
          var valueLabel = String(allocation.valueLabel || allocation.centerName || allocation.centerCode || allocation.centerId || '').trim();
          var matchesBudget = (budget.lines || []).some(function (budgetLine) {
            if (String(budgetLine.accountCode || '') !== accountCode) return false;
            var value = budgetLine.analyticValues && budgetLine.analyticValues[axisNatureId] || {};
            return axisNatureId === 'responsibility-centers'
              ? String(value.valueId || '') === String(allocation.centerId || '')
              : String(value.valueLabel || '').trim().replace(/\s+/g, ' ') === valueLabel.replace(/\s+/g, ' ');
          });
          if (!matchesBudget) unmatchedValueCount += 1;
          addSourceRow(entry, line, accountCode, amount, valueLabel, matchesBudget ? 'Imputation explicite · valeur budgétée' : 'Imputation explicite · valeur sans ligne budgétaire', lineIndex, allocationIndex);
        });
        var rawUnallocated = split.unallocatedAmount;
        var unallocated = rawUnallocated == null || rawUnallocated === '' ? Math.max(0, lineAmount - assigned) : Number(rawUnallocated);
        if (Number.isFinite(unallocated) && unallocated > 0) {
          addSourceRow(entry, line, accountCode, unallocated, '', 'À ventiler · reliquat analytique explicite', lineIndex, -1);
          unallocatedCount += 1;
        }
      });
    });
    rows.sort(function (left, right) { return left.date.localeCompare(right.date) || left.journal.localeCompare(right.journal) || left.piece.localeCompare(right.piece) || left.accountCode.localeCompare(right.accountCode) || left.sourceLineIndex - right.sourceLineIndex || (left.allocationIndex < 0 ? Number.MAX_SAFE_INTEGER : left.allocationIndex) - (right.allocationIndex < 0 ? Number.MAX_SAFE_INTEGER : right.allocationIndex); });
    return {
      rows: rows,
      sourceEntryCount: Object.keys(entryIds).length,
      matchedSourceLineCount: sourceLineCount,
      noSourceData: sourceLineCount === 0,
      unallocatedCount: unallocatedCount,
      unmatchedValueCount: unmatchedValueCount,
      classification: classification,
      axisNatureId: axisNatureId,
      realizationMode: String(budget.realizationMode || ''),
      noAccountingMutation: true
    };
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
        accountsLimitedToAnalyticClasses93to99: !(['budget-realizations-followup', 'budget-realizations-by-line'].indexOf(reportId) !== -1 && !!budget && Array.isArray(options && options.budgetRegister)),
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
    var availableBudgets = budgetOptions(cycleStart, options.budgetRegister, cycleEnd);
    var selectedOption = availableBudgets.find(function (item) { return item.code === String(options.budgetCode || ''); }) || null;
    var selectedBudget = selectedOption && selectedOption.budget || selectedOption;
    if (!selectedBudget) errors.push(Array.isArray(options.budgetRegister)
      ? 'Sélectionnez un budget enregistré correspondant au cycle de ce dossier.'
      : 'Sélectionnez un budget C (Charges), I (Investissements) ou P (Produits) de l’exercice du dossier.');

    var accountOptions = CurrencyBalanceReport.accountOptions(
      Array.isArray(options.accounts) ? options.accounts : [],
      Array.isArray(options.entries) ? options.entries : []
    );
    var accountFilter = definition.filters.indexOf('accounts') !== -1
      ? (['realizations-followup', 'realizations-by-line'].indexOf(definition.kind) !== -1 && selectedBudget && Array.isArray(options.budgetRegister)
        ? budgetAccountFilter(options.accountFilter == null ? '*' : options.accountFilter, selectedBudget.lines)
        : CurrencyBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter, accountOptions))
      : CurrencyBalanceReport.parseAccountFilter('*', accountOptions);
    if (!accountFilter.valid) errors.push(accountFilter.error);

    var hasPeriod = definition.filters.indexOf('from') !== -1;
    var from = String(options.from || (hasPeriod ? cycleStart : ''));
    var to = String(options.to || (hasPeriod ? cycleEnd : ''));
    if (hasPeriod) {
      if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour la période budgétaire.');
      else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
      else if (from < cycleStart || to > cycleEnd) errors.push('La période budgétaire doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
      else if (['realizations-followup', 'realizations-by-line'].indexOf(definition.kind) !== -1 && selectedBudget && (from < selectedBudget.cycleStart || to > selectedBudget.cycleEnd)) errors.push('La période choisie doit rester dans le cycle du budget sélectionné (' + selectedBudget.cycleStart + ' — ' + selectedBudget.cycleEnd + ').');
    }
    var hasAsOfDate = definition.filters.indexOf('asOfDate') !== -1;
    var asOfDate = String(options.asOfDate || (hasAsOfDate ? cycleEnd : ''));
    if (hasAsOfDate) {
      if (!isIsoDate(asOfDate)) errors.push('Indiquez une date d’arrêté valide.');
      else if (asOfDate < cycleStart || asOfDate > cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));

    if (errors.length) return emptyResult(reportId, definition, options, errors, warnings, selectedBudget);
    if (definition.kind === 'realizations-by-line' && Array.isArray(options.budgetRegister)) {
      var details = realizationDetailRows(selectedBudget, options.entries, accountFilter.codes, from, to, options.accounts);
      if (details.noSourceData) warnings.push('Aucune ligne comptabilisée ne correspond aux comptes budgétés sélectionnés dans la période.');
      if (details.unallocatedCount) warnings.push(details.unallocatedCount + ' ligne(s) ou allocation(s) restent « À ventiler » ou nécessitent une vérification ; elles sont explicitement marquées dans le détail.');
      if (details.unmatchedValueCount) warnings.push(details.unmatchedValueCount + ' allocation(s) utilisent une valeur analytique explicite sans ligne correspondante dans le budget sélectionné ; elles restent identifiées, sans rattachement inventé.');
      warnings.push('Détail en lecture seule depuis les écritures comptabilisées ; les commandes fournisseurs ne sont pas une source de réalisation.');
      var detailReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      detailReport.cycleStart = cycleStart;
      detailReport.cycleEnd = cycleEnd;
      detailReport.from = from;
      detailReport.to = to;
      detailReport.accountFilter = accountFilter;
      detailReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      detailReport.rows = details.rows;
      detailReport.generatedLineCount = details.rows.length;
      detailReport.dataAvailable = details.rows.length > 0;
      detailReport.sourceEntryCount = details.sourceEntryCount;
      detailReport.matchedSourceLineCount = details.matchedSourceLineCount;
      detailReport.unallocatedCount = details.unallocatedCount;
      detailReport.unmatchedValueCount = details.unmatchedValueCount;
      detailReport.realizationMode = details.realizationMode;
      detailReport.axisNatureId = details.axisNatureId;
      detailReport.realizationBasis = details.classification === 'C' ? 'Compte général exact, selon le budget sélectionné.' : 'Une seule nature analytique est détaillée à partir des imputations explicites.';
      detailReport.basis.budgetRegisterAvailable = true;
      detailReport.basis.realizationRegisterAvailable = false;
      detailReport.basis.noBudgetAmountsSimulated = false;
      detailReport.basis.noRealizationsSimulated = false;
      detailReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      detailReport.basis.noAccountingMutation = true;
      return detailReport;
    }
    if (definition.kind === 'realizations-followup' && Array.isArray(options.budgetRegister)) {
      if (!BudgetRealizations || typeof BudgetRealizations.calculate !== 'function') return emptyResult(reportId, definition, options, ['Le calcul des réalisations budgétaires n’est pas chargé.'], warnings, selectedBudget);
      var actuals = realizationRows(selectedBudget, options.entries, accountFilter.codes, from, to);
      if (!actuals.ok) return emptyResult(reportId, definition, options, actuals.errors, warnings, selectedBudget);
      warnings.push('Les colonnes N-1 restent indisponibles : cet état ne consulte que les sources du cycle du budget sélectionné.');
      if (actuals.noSourceData) warnings.push('Aucune ligne validée ne correspond aux comptes budgétés sélectionnés dans la période de cumul ; les réalisations restent « — », sans zéro supposé.');
      warnings.push('Réalisations calculées depuis les écritures comptabilisées du dossier ; les commandes fournisseurs et autres engagements ne sont pas des sources de réalisation.');
      var realizedReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      realizedReport.cycleStart = cycleStart;
      realizedReport.cycleEnd = cycleEnd;
      realizedReport.from = from;
      realizedReport.to = to;
      realizedReport.accountFilter = accountFilter;
      realizedReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      realizedReport.rows = actuals.rows.map(function (row) {
        if (actuals.classification !== 'C' || !row.accountCode) return row;
        var code = row.accountCode;
        var account = (Array.isArray(options.accounts) ? options.accounts : []).find(function (item) { return String(item && item.code || '') === code; });
        return Object.assign({}, row, { accountLabel: account && String(account.label || account.name || '') || row.accountLabel });
      });
      realizedReport.generatedLineCount = actuals.rows.length;
      realizedReport.dataAvailable = actuals.rows.length > 0;
      realizedReport.sourceEntryCount = actuals.sourceEntryCount;
      realizedReport.matchedSourceLineCount = actuals.matchedSourceLineCount;
      realizedReport.realizationMode = actuals.realizationMode;
      realizedReport.axisNatureId = actuals.axisNatureId;
      realizedReport.realizationBasis = actuals.classification === 'C' ? 'Compte général exact, selon le budget sélectionné.' : 'Une seule nature analytique explicitement sélectionnée par le classement du budget.';
      realizedReport.basis.budgetRegisterAvailable = true;
      realizedReport.basis.realizationRegisterAvailable = false;
      realizedReport.basis.noBudgetAmountsSimulated = false;
      realizedReport.basis.noRealizationsSimulated = false;
      realizedReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      realizedReport.basis.noAccountingMutation = true;
      return realizedReport;
    }
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
