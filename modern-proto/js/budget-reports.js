/*
 * PERFECTO · États du sous-menu Budget.
 * Les états sans raccordement de source restent vides ; le budget prévisionnel
 * et les réalisations s’appuient sur le registre budgétaire du dossier.
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

  function budgetOrderRows(budget, orders, accountCodes, from, to, accounts, detail, configuredBaseCurrencyCode) {
    var baseCurrencyCode = String(configuredBaseCurrencyCode || 'XOF').toUpperCase();
    var accountLabels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      var code = String(account && account.code || '');
      if (code) accountLabels[code] = String(account.label || account.name || '');
    });
    var selectedLines = (Array.isArray(budget.lines) ? budget.lines : []).filter(function (line) {
      return line && accountCodes.indexOf(String(line.accountCode || '')) !== -1;
    });
    var linesById = Object.create(null);
    (Array.isArray(budget.lines) ? budget.lines : []).forEach(function (line) { if (line && line.id) linesById[String(line.id)] = line; });
    var selectedLineIds = Object.create(null);
    selectedLines.forEach(function (line) { selectedLineIds[String(line.id || '')] = true; });
    var totals = Object.create(null);
    selectedLines.forEach(function (line) {
      totals[String(line.id || '')] = { prior: 0, period: 0, total: 0, matchedCount: 0, currencyIncomplete: false };
    });
    var rows = [];
    var sourceOrderLineCount = 0;
    var matchedOrderLineCount = 0;
    var unlinkedOrderLineCount = 0;
    var staleLinkCount = 0;
    var nonBaseCurrencyLineCount = 0;
    var invalidAmountCount = 0;
    var eligibleOrders = (Array.isArray(orders) ? orders : []).filter(function (order) {
      return order && order.status === 'issued' && isIsoDate(order.date) && order.date >= budget.cycleStart && order.date <= to && (!detail || order.date >= from);
    });
    eligibleOrders.forEach(function (order) {
      (Array.isArray(order.lines) ? order.lines : []).forEach(function (line, lineIndex) {
        sourceOrderLineCount += 1;
        var linkedBudgetId = String(line && line.budgetId || '').trim();
        var linkedLineId = String(line && line.budgetLineId || '').trim();
        if (!linkedBudgetId || !linkedLineId) {
          unlinkedOrderLineCount += 1;
          return;
        }
        if (linkedBudgetId !== String(budget.id || '')) return;
        var budgetLine = linesById[linkedLineId];
        if (!budgetLine) { staleLinkCount += 1; return; }
        if (!selectedLineIds[linkedLineId]) return;
        if (String(order.currencyCode || '').toUpperCase() !== baseCurrencyCode) {
          nonBaseCurrencyLineCount += 1;
          totals[linkedLineId].currencyIncomplete = true;
          return;
        }
        var amount = Number(line.amount);
        if (!Number.isFinite(amount) || amount < 0) { invalidAmountCount += 1; return; }
        var target = totals[linkedLineId];
        target.total += amount;
        target.matchedCount += 1;
        if (order.date < from) target.prior += amount;
        else target.period += amount;
        matchedOrderLineCount += 1;
        if (detail) {
          rows.push({
            date: String(order.date || ''), order: String(order.reference || ''),
            orderLabel: String(order.description || line.description || ''),
            accountCode: String(budgetLine.accountCode || ''),
            accountLabel: accountLabels[String(budgetLine.accountCode || '')] || String(budgetLine.accountCode || ''),
            budgetLineLabel: String(budgetLine.label || ''), amount: amount,
            sourceOrderId: String(order.id || ''), sourceOrderLineId: String(line.id || ''), sourceLineIndex: lineIndex
          });
        }
      });
    });
    if (detail) {
      rows.sort(function (left, right) { return left.date.localeCompare(right.date) || left.order.localeCompare(right.order) || left.accountCode.localeCompare(right.accountCode) || left.sourceLineIndex - right.sourceLineIndex; });
    } else {
      rows = selectedLines.map(function (line) {
        var code = String(line.accountCode || '');
        var amount = line.amountComplete === false || line.annualAmount == null ? null : Number(line.annualAmount);
        if (!Number.isFinite(amount) || amount < 0) amount = null;
        var total = totals[String(line.id || '')] || { prior: 0, period: 0, total: 0, currencyIncomplete: false };
        var canComputeRemaining = amount != null && unlinkedOrderLineCount === 0 && staleLinkCount === 0 && invalidAmountCount === 0 && !total.currencyIncomplete;
        return {
          accountCode: code, accountLabel: String(line.label || accountLabels[code] || code),
          budgetAmount: amount,
          priorCommitments: total.currencyIncomplete ? null : total.prior,
          periodCommitments: total.currencyIncomplete ? null : total.period,
          totalCommitments: total.currencyIncomplete ? null : total.total,
          remainingOnExercise: canComputeRemaining ? amount - total.total : null,
          sourceBudgetLineId: String(line.id || ''), matchedOrderLineCount: total.matchedCount,
          status: amount == null || total.currencyIncomplete || unlinkedOrderLineCount > 0 || staleLinkCount > 0 || invalidAmountCount > 0 ? 'incomplete-commitment' : 'budgeted'
        };
      });
    }
    return {
      rows: rows,
      sourceOrderLineCount: sourceOrderLineCount,
      matchedOrderLineCount: matchedOrderLineCount,
      unlinkedOrderLineCount: unlinkedOrderLineCount,
      staleLinkCount: staleLinkCount,
      nonBaseCurrencyLineCount: nonBaseCurrencyLineCount,
      invalidAmountCount: invalidAmountCount,
      noMatchedSource: matchedOrderLineCount === 0,
      incompleteRemaining: unlinkedOrderLineCount > 0 || staleLinkCount > 0 || invalidAmountCount > 0 || nonBaseCurrencyLineCount > 0,
      baseCurrencyCode: baseCurrencyCode
    };
  }

  function budgetAvailabilityRows(budget, orders, entries, accounts, asOfDate, configuredBaseCurrencyCode) {
    var accountCodes = Array.from(new Set((Array.isArray(budget.lines) ? budget.lines : []).map(function (line) { return String(line && line.accountCode || '').trim(); }).filter(Boolean)));
    var actuals = realizationRows(budget, entries, accountCodes, budget.cycleStart, asOfDate);
    if (!actuals.ok) return { ok: false, errors: actuals.errors || ['Les réalisations du budget ne peuvent pas être calculées.'] };
    var commitments = budgetOrderRows(budget, orders, accountCodes, budget.cycleStart, asOfDate, accounts, false, configuredBaseCurrencyCode);
    var classification = String(budget.classification || 'C');
    var axisIndex = classification.charAt(0) === 'A' ? Number(classification.slice(1)) - 1 : -1;
    var axisNatureId = axisIndex >= 0 && Array.isArray(budget.analyticNatureIds) ? String(budget.analyticNatureIds[axisIndex] || '') : '';
    function groupKeyForLine(line) {
      var code = String(line && line.accountCode || '').trim();
      if (classification === 'C') return 'account:' + code;
      var value = line && line.analyticValues && line.analyticValues[axisNatureId] || {};
      var valueKey = axisNatureId === 'responsibility-centers'
        ? (value.valueId ? 'center:' + String(value.valueId) : '')
        : (value.valueLabel ? 'label:' + String(value.valueLabel).trim().replace(/\s+/g, ' ') : '');
      return valueKey ? 'axis:' + valueKey : '__budget-unclassified__';
    }
    var realizationGroups = Object.create(null);
    (actuals.rows || []).forEach(function (row) {
      if (row.status === 'budgeted' || row.status === 'unclassified-budget') realizationGroups[String(row.key || '')] = row;
    });
    var commitmentByLine = Object.create(null);
    (commitments.rows || []).forEach(function (row) { commitmentByLine[String(row.sourceBudgetLineId || '')] = row; });
    var groupedCommitments = Object.create(null);
    (Array.isArray(budget.lines) ? budget.lines : []).forEach(function (line) {
      if (!line || !line.id) return;
      var key = groupKeyForLine(line);
      if (!groupedCommitments[key]) groupedCommitments[key] = { amount: 0, incomplete: false, lineCount: 0 };
      var target = groupedCommitments[key];
      var commitment = commitmentByLine[String(line.id)];
      target.lineCount += 1;
      if (!commitment || commitment.totalCommitments == null || commitments.unlinkedOrderLineCount > 0 || commitments.staleLinkCount > 0 || commitments.invalidAmountCount > 0) target.incomplete = true;
      else target.amount += Number(commitment.totalCommitments) || 0;
    });
    var accountLabels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      var code = String(account && account.code || '');
      if (code) accountLabels[code] = String(account.label || account.name || '');
    });
    var rows = Object.keys(realizationGroups).map(function (key) {
      var actual = realizationGroups[key];
      var commitment = groupedCommitments[key] || { amount: 0, incomplete: true, lineCount: 0 };
      var budgetAmount = actual.budgetAmount == null || !Number.isFinite(Number(actual.budgetAmount)) ? null : Number(actual.budgetAmount);
      var realizedAmount = actual.realizationAtPeriodEnd == null || !Number.isFinite(Number(actual.realizationAtPeriodEnd)) ? null : Number(actual.realizationAtPeriodEnd);
      var code = String(actual.accountCode || '');
      var accountLabel = classification === 'C' && code.indexOf(',') === -1
        ? accountLabels[code] || String(actual.accountLabel || code)
        : String(actual.accountLabel || '');
      return {
        accountCode: code,
        accountLabel: accountLabel,
        budgetAmount: budgetAmount,
        commitments: commitment.incomplete ? null : commitment.amount,
        realizations: realizedAmount,
        sourceGroupKey: key,
        sourceBudgetLineCount: commitment.lineCount,
        status: budgetAmount == null || commitment.incomplete ? 'incomplete-availability' : 'budgeted'
      };
    }).sort(function (left, right) { return left.accountCode.localeCompare(right.accountCode) || String(left.sourceGroupKey).localeCompare(String(right.sourceGroupKey)); });
    var unbudgetedRealizationGroupCount = (actuals.rows || []).filter(function (row) { return row.status === 'unbudgeted-realization'; }).length;
    var unallocatedRealizationGroupCount = (actuals.rows || []).filter(function (row) { return row.status === 'unclassified-realization'; }).length;
    return {
      ok: true, rows: rows, actuals: actuals, commitments: commitments,
      sourceEntryCount: actuals.sourceEntryCount, matchedSourceLineCount: actuals.matchedSourceLineCount,
      unbudgetedRealizationGroupCount: unbudgetedRealizationGroupCount,
      unallocatedRealizationGroupCount: unallocatedRealizationGroupCount,
      baseCurrencyCode: commitments.baseCurrencyCode
    };
  }

  function explicitOutsideOrderRows(budget, orders, from, to, accounts, configuredBaseCurrencyCode) {
    var baseCurrencyCode = String(configuredBaseCurrencyCode || 'XOF').toUpperCase();
    var accountLabels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      var code = String(account && account.code || '');
      if (code) accountLabels[code] = String(account.label || account.name || '');
    });
    var rows = [];
    var sourceOrderLineCount = 0;
    var unclassifiedLineCount = 0;
    var linkedLineCount = 0;
    var nonBaseCurrencyLineCount = 0;
    var missingAccountLineCount = 0;
    var unknownAccountLineCount = 0;
    var invalidAmountCount = 0;
    (Array.isArray(orders) ? orders : []).filter(function (order) {
      return order && order.status === 'issued' && isIsoDate(order.date) && order.date >= budget.cycleStart && order.date >= from && order.date <= to;
    }).forEach(function (order) {
      (Array.isArray(order.lines) ? order.lines : []).forEach(function (line, lineIndex) {
        sourceOrderLineCount += 1;
        var budgetId = String(line && line.budgetId || '').trim();
        var budgetLineId = String(line && line.budgetLineId || '').trim();
        if (budgetId && budgetLineId) { linkedLineCount += 1; return; }
        if (String(line && line.budgetTreatment || 'unclassified') !== 'outside') { unclassifiedLineCount += 1; return; }
        if (String(order.currencyCode || '').toUpperCase() !== baseCurrencyCode) { nonBaseCurrencyLineCount += 1; return; }
        var accountCode = String(line && line.accountCode || '').trim();
        if (!accountCode) { missingAccountLineCount += 1; return; }
        if (!Object.prototype.hasOwnProperty.call(accountLabels, accountCode)) { unknownAccountLineCount += 1; return; }
        var amount = Number(line.amount);
        if (!Number.isFinite(amount) || amount < 0) { invalidAmountCount += 1; return; }
        rows.push({
          date: String(order.date || ''), accountCode: accountCode,
          accountLabel: accountLabels[accountCode] || accountCode,
          market: String(line.market || ''), reserved1: '-', reserved2: '-', amount: amount,
          sourceOrderId: String(order.id || ''), sourceOrderLineId: String(line.id || ''), sourceLineIndex: lineIndex
        });
      });
    });
    rows.sort(function (left, right) { return left.date.localeCompare(right.date) || left.accountCode.localeCompare(right.accountCode) || left.sourceOrderId.localeCompare(right.sourceOrderId) || left.sourceLineIndex - right.sourceLineIndex; });
    return {
      rows: rows, sourceOrderLineCount: sourceOrderLineCount, unclassifiedLineCount: unclassifiedLineCount,
      linkedLineCount: linkedLineCount, nonBaseCurrencyLineCount: nonBaseCurrencyLineCount,
      missingAccountLineCount: missingAccountLineCount, unknownAccountLineCount: unknownAccountLineCount,
      invalidAmountCount: invalidAmountCount, baseCurrencyCode: baseCurrencyCode
    };
  }

  function outsideRealizationTotalRows(budget, entries, accounts, from, to) {
    var classification = String(budget.classification || 'C');
    var axisIndex = classification.charAt(0) === 'A' ? Number(classification.slice(1)) - 1 : -1;
    var axisNatureId = axisIndex >= 0 && Array.isArray(budget.analyticNatureIds) ? String(budget.analyticNatureIds[axisIndex] || '') : '';
    if (classification === 'C') return { ok: true, accountClassificationOnly: true, rows: [], detailRows: [], sourceEntryCount: 0, matchedSourceLineCount: 0, matchedAllocationCount: 0, unallocatedCount: 0, unbudgetedAccountLineCount: 0, invalidAllocationCount: 0, noSourceData: true, realizationMode: budget.realizationMode, axisNatureId: '' };
    if (!/^A[1-4]$/.test(classification) || !axisNatureId) return { ok: false, errors: ['Le classement analytique du budget ne désigne pas un axe configuré.'], rows: [] };
    var mode = String(budget.realizationMode || '');
    if (['debit', 'credit', 'debit-credit', 'credit-debit'].indexOf(mode) === -1) return { ok: false, errors: ['La base de réalisation du budget n’est pas définie.'], rows: [] };
    var budgetLinesByAccount = Object.create(null);
    (Array.isArray(budget.lines) ? budget.lines : []).forEach(function (line) {
      var code = String(line && line.accountCode || '').trim();
      if (!code) return;
      if (!budgetLinesByAccount[code]) budgetLinesByAccount[code] = [];
      budgetLinesByAccount[code].push(line);
    });
    var accountLabels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      var code = String(account && account.code || '');
      if (code) accountLabels[code] = String(account.label || account.name || '');
    });
    var totals = Object.create(null);
    var detailRows = [];
    var sourceEntryIds = Object.create(null);
    var matchedSourceLineCount = 0;
    var matchedAllocationCount = 0;
    var unallocatedCount = 0;
    var unbudgetedAccountLineCount = 0;
    var invalidAllocationCount = 0;
    // A line is outside only when its explicit axis value has no exact match on a budget line for the same account.
    // Account codes absent from the budget are kept out of this report rather than assigned by inference.
    function contribution(side, amount) {
      if (side === 'debit') return mode === 'debit' || mode === 'debit-credit' ? amount : mode === 'credit-debit' ? -amount : 0;
      return mode === 'credit' || mode === 'credit-debit' ? amount : mode === 'debit-credit' ? -amount : 0;
    }
    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !isIsoDate(entry.date) || entry.date < budget.cycleStart || entry.date > budget.cycleEnd || entry.date < from || entry.date > to) return;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
        var accountCode = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        var matchingBudgetLines = budgetLinesByAccount[accountCode];
        if (!line || !matchingBudgetLines || !matchingBudgetLines.length) { if (accountCode) unbudgetedAccountLineCount += 1; return; }
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (debit > 0 && credit > 0 || debit <= 0 && credit <= 0) { invalidAllocationCount += 1; return; }
        var split = (Array.isArray(line.analyticSplits) ? line.analyticSplits : []).find(function (item) { return item && item.natureId === axisNatureId; });
        if (!split) { unallocatedCount += 1; return; }
        var allocations = Array.isArray(split.allocations) ? split.allocations : [];
        var allocatedTotal = 0;
        var lineHasOutsideAllocation = false;
        allocations.forEach(function (allocation, allocationIndex) {
          var amount = Number(allocation && allocation.amount);
          if (!Number.isFinite(amount) || amount <= 0) { if (amount !== 0) invalidAllocationCount += 1; return; }
          var valueKey = '';
          var valueLabel = String(allocation.valueLabel || '').trim().replace(/\s+/g, ' ');
          if (axisNatureId === 'responsibility-centers') {
            var centerId = String(allocation.centerId || '').trim();
            if (!centerId) { invalidAllocationCount += 1; return; }
            valueKey = 'center:' + centerId;
            valueLabel = valueLabel || String(allocation.centerName || allocation.centerCode || centerId);
          } else {
            if (!valueLabel) { invalidAllocationCount += 1; return; }
            valueKey = 'label:' + valueLabel;
          }
          allocatedTotal += amount;
          var matched = matchingBudgetLines.some(function (budgetLine) {
            var budgetValue = budgetLine.analyticValues && budgetLine.analyticValues[axisNatureId] || {};
            return axisNatureId === 'responsibility-centers'
              ? String(budgetValue.valueId || '') === valueKey.slice('center:'.length)
              : String(budgetValue.valueLabel || '').trim().replace(/\s+/g, ' ') === valueLabel;
          });
          if (matched) return;
          var side = debit > 0 ? 'debit' : 'credit';
          var key = accountCode;
          if (!totals[key]) totals[key] = { accountCode: accountCode, amount: 0, allocationCount: 0 };
          totals[key].amount += contribution(side, amount);
          totals[key].allocationCount += 1;
          sourceEntryIds[String(entry.id || '')] = true;
          matchedAllocationCount += 1;
          lineHasOutsideAllocation = true;
          var detailLabel = String(line.label || entry.description || '');
          detailLabel += (detailLabel ? ' · ' : '') + 'Valeur analytique hors budget : ' + valueLabel;
          detailRows.push({
            date: String(entry.date || ''), journal: String(entry.journal || ''), piece: String(entry.reference || ''),
            accountCode: accountCode, accountLabel: accountLabels[accountCode] || accountCode,
            market: String(line.market || ''), reserved1: '-', reserved2: '-',
            debit: debit > 0 ? amount : 0, credit: credit > 0 ? amount : 0, label: detailLabel,
            sourceEntryId: String(entry.id || ''), sourceLineIndex: lineIndex,
            allocationIndex: allocationIndex
          });
        });
        var unallocated = split.unallocatedAmount == null || split.unallocatedAmount === '' ? Math.max(0, (debit || credit) - allocatedTotal) : Number(split.unallocatedAmount);
        if (Number.isFinite(unallocated) && unallocated > 0) unallocatedCount += 1;
        else if (!Number.isFinite(unallocated) || unallocated < 0) invalidAllocationCount += 1;
        if (lineHasOutsideAllocation) matchedSourceLineCount += 1;
      });
    });
    detailRows.sort(function (left, right) { return left.date.localeCompare(right.date) || left.journal.localeCompare(right.journal) || left.piece.localeCompare(right.piece) || left.accountCode.localeCompare(right.accountCode) || left.sourceLineIndex - right.sourceLineIndex || left.allocationIndex - right.allocationIndex; });
    var rows = Object.keys(totals).map(function (code) {
      return { accountCode: code, accountLabel: accountLabels[code] || code, amount: totals[code].amount, sourceAllocationCount: totals[code].allocationCount };
    }).sort(function (left, right) { return left.accountCode.localeCompare(right.accountCode); });
    return {
      ok: true, accountClassificationOnly: false, rows: rows, detailRows: detailRows,
      sourceEntryCount: Object.keys(sourceEntryIds).length, matchedSourceLineCount: matchedSourceLineCount, matchedAllocationCount: matchedAllocationCount,
      unallocatedCount: unallocatedCount, unbudgetedAccountLineCount: unbudgetedAccountLineCount,
      invalidAllocationCount: invalidAllocationCount, noSourceData: matchedSourceLineCount === 0,
      realizationMode: mode, axisNatureId: axisNatureId
    };
  }

  function forecastRows(budget, accountCodes, accounts, analyticNatures, lineSelection) {
    var accountRows = Array.isArray(accounts) ? accounts : [];
    var natureRows = Array.isArray(analyticNatures) ? analyticNatures : [];
    var selectedCodes = Object.create(null);
    (Array.isArray(accountCodes) ? accountCodes : []).forEach(function (code) { selectedCodes[String(code)] = true; });
    var sourceLines = (Array.isArray(budget.lines) ? budget.lines : []).map(function (line, index) {
      var code = String(line && line.accountCode || '').trim();
      if (!line || !code || !selectedCodes[code]) return null;
      var amount = line.amountComplete === false || line.annualAmount == null ? null : Number(line.annualAmount);
      if (!Number.isFinite(amount) || amount < 0) amount = null;
      var label = String(line.label || '');
      (Array.isArray(budget.analyticNatureIds) ? budget.analyticNatureIds : []).forEach(function (natureId) {
        var value = line.analyticValues && line.analyticValues[natureId] || {};
        var valueLabel = String(value.valueLabel || value.valueId || '').trim();
        if (!valueLabel) return;
        var nature = natureRows.find(function (item) { return item && item.id === natureId; });
        var natureLabel = String(nature && (nature.individualName || nature.genericName) || natureId);
        label += (label ? ' · ' : '') + natureLabel + ' : ' + valueLabel;
      });
      return { accountCode: code, accountLabel: label, budgetAmount: amount, shareOfTotal: null, sourceLineId: String(line.id || ''), sourceLineIndex: index, status: amount == null ? 'incomplete-budget' : 'budgeted' };
    }).filter(Boolean);
    var rows = [];
    if (lineSelection.generalAccounts !== false) rows = rows.concat(sourceLines);
    if (lineSelection.groupingCodes === true) {
      var groupingCodes = Object.create(null);
      sourceLines.forEach(function (line) {
        accountRows.forEach(function (account) {
          var code = String(account && account.code || '').trim();
          if (!code || account.postable !== false || code.length >= line.accountCode.length || line.accountCode.indexOf(code) !== 0) return;
          groupingCodes[code] = account;
        });
      });
      Object.keys(groupingCodes).forEach(function (code) {
        var descendants = sourceLines.filter(function (line) { return line.accountCode.indexOf(code) === 0; });
        var complete = descendants.length > 0 && descendants.every(function (line) { return line.budgetAmount != null; });
        rows.push({
          accountCode: code,
          accountLabel: String(groupingCodes[code].label || groupingCodes[code].name || code),
          budgetAmount: complete ? descendants.reduce(function (sum, line) { return sum + line.budgetAmount; }, 0) : null,
          shareOfTotal: null,
          sourceLineId: '',
          sourceLineIndex: -1,
          status: complete ? 'grouping' : 'incomplete-grouping'
        });
      });
    }
    rows.sort(function (left, right) {
      return left.accountCode.localeCompare(right.accountCode) || left.sourceLineIndex - right.sourceLineIndex;
    });
    return {
      rows: rows,
      sourceLineCount: sourceLines.length,
      incompleteLineCount: sourceLines.filter(function (line) { return line.budgetAmount == null; }).length,
      hasGroupingRows: rows.some(function (line) { return line.sourceLineIndex < 0; })
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
        accountsLimitedToAnalyticClasses93to99: !(['budget-entered', 'budget-orders-followup', 'budget-orders-by-line', 'budget-orders-outside', 'budget-realizations-followup', 'budget-realizations-by-line', 'budget-outside-realizations-total', 'budget-outside-realizations-detail', 'budget-available-not-committed'].indexOf(reportId) !== -1 && !!budget && Array.isArray(options && options.budgetRegister)),
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
      ? (['forecast', 'orders-followup', 'orders-by-line', 'realizations-followup', 'realizations-by-line'].indexOf(definition.kind) !== -1 && selectedBudget && Array.isArray(options.budgetRegister)
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
      else if (['realizations-followup', 'realizations-by-line', 'outside-realizations-total', 'outside-realizations-detail'].indexOf(definition.kind) !== -1 && selectedBudget && (from < selectedBudget.cycleStart || to > selectedBudget.cycleEnd)) errors.push('La période choisie doit rester dans le cycle du budget sélectionné (' + selectedBudget.cycleStart + ' — ' + selectedBudget.cycleEnd + ').');
    }
    var hasAsOfDate = definition.filters.indexOf('asOfDate') !== -1;
    var asOfDate = String(options.asOfDate || (hasAsOfDate ? cycleEnd : ''));
    if (hasAsOfDate) {
      if (!isIsoDate(asOfDate)) errors.push('Indiquez une date d’arrêté valide.');
      else if (asOfDate < cycleStart || asOfDate > cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));

    if (errors.length) return emptyResult(reportId, definition, options, errors, warnings, selectedBudget);
    if (['orders-followup', 'orders-by-line'].indexOf(definition.kind) !== -1 && Array.isArray(options.budgetRegister)) {
      if (!Array.isArray(options.supplierOrders)) return emptyResult(reportId, definition, options, ['Le registre des commandes fournisseurs n’est pas chargé.'], warnings, selectedBudget);
      var orderDetails = budgetOrderRows(selectedBudget, options.supplierOrders, accountFilter.codes, from, to, options.accounts, definition.kind === 'orders-by-line', options.baseCurrencyCode);
      if (orderDetails.noMatchedSource) warnings.push('Aucune commande émise avec une liaison budgétaire explicite et exploitable ne correspond à la période et aux comptes sélectionnés.');
      if (orderDetails.unlinkedOrderLineCount) warnings.push(orderDetails.unlinkedOrderLineCount + ' ligne(s) de commande émise(s) sans liaison budgétaire explicite sont exclues ; le reste ne peut pas être certifié complet.');
      if (orderDetails.staleLinkCount) warnings.push(orderDetails.staleLinkCount + ' liaison(s) explicite(s) pointent vers une ligne budgétaire absente ; elles ne sont pas réattribuées.');
      if (orderDetails.nonBaseCurrencyLineCount) warnings.push(orderDetails.nonBaseCurrencyLineCount + ' ligne(s) liée(s) en devise autre que ' + orderDetails.baseCurrencyCode + ' ne sont pas converties ni additionnées ; le reste concerné reste indisponible.');
      if (orderDetails.invalidAmountCount) warnings.push(orderDetails.invalidAmountCount + ' montant(s) de commande ne peuvent pas être exploités ; aucun montant de remplacement n’est calculé.');
      warnings.push('Seules les commandes émises et explicitement liées à une ligne du budget sont prises en compte ; brouillons et commandes annulées sont exclus. Une commande ne constitue pas une facture ni une écriture comptable.');
      var orderReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      orderReport.cycleStart = cycleStart;
      orderReport.cycleEnd = cycleEnd;
      orderReport.from = from;
      orderReport.to = to;
      orderReport.accountFilter = accountFilter;
      orderReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      orderReport.rows = orderDetails.rows;
      orderReport.generatedLineCount = orderDetails.rows.length;
      orderReport.dataAvailable = orderDetails.rows.length > 0;
      orderReport.sourceOrderLineCount = orderDetails.sourceOrderLineCount;
      orderReport.matchedOrderLineCount = orderDetails.matchedOrderLineCount;
      orderReport.unlinkedOrderLineCount = orderDetails.unlinkedOrderLineCount;
      orderReport.staleLinkCount = orderDetails.staleLinkCount;
      orderReport.nonBaseCurrencyLineCount = orderDetails.nonBaseCurrencyLineCount;
      orderReport.baseCurrencyCode = orderDetails.baseCurrencyCode;
      orderReport.incompleteRemaining = orderDetails.incompleteRemaining;
      orderReport.commitmentRegisterAvailable = true;
      orderReport.basis.budgetRegisterAvailable = true;
      orderReport.basis.commitmentRegisterAvailable = true;
      orderReport.basis.noBudgetAmountsSimulated = false;
      orderReport.basis.noCommitmentsSimulated = false;
      orderReport.basis.noRealizationsSimulated = true;
      orderReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      orderReport.basis.noAccountingMutation = true;
      return orderReport;
    }
    if (definition.kind === 'orders-outside' && Array.isArray(options.budgetRegister)) {
      if (!Array.isArray(options.supplierOrders)) return emptyResult(reportId, definition, options, ['Le registre des commandes fournisseurs n’est pas chargé.'], warnings, selectedBudget);
      var outsideOrders = explicitOutsideOrderRows(selectedBudget, options.supplierOrders, from, to, options.accounts, options.baseCurrencyCode);
      if (!outsideOrders.rows.length) warnings.push('Aucune ligne de commande émise et explicitement classée hors budget ne correspond à la période.');
      if (outsideOrders.unclassifiedLineCount) warnings.push(outsideOrders.unclassifiedLineCount + ' ligne(s) sans classification budgétaire explicite sont exclues ; elles ne sont pas assimilées à des commandes hors budget.');
      if (outsideOrders.linkedLineCount) warnings.push(outsideOrders.linkedLineCount + ' ligne(s) explicitement liées à un budget sont exclues de cet état.');
      if (outsideOrders.nonBaseCurrencyLineCount) warnings.push(outsideOrders.nonBaseCurrencyLineCount + ' ligne(s) classée(s) hors budget en devise autre que ' + outsideOrders.baseCurrencyCode + ' ne sont ni converties ni présentées dans les montants.');
      if (outsideOrders.missingAccountLineCount) warnings.push(outsideOrders.missingAccountLineCount + ' ligne(s) classée(s) hors budget sans compte général explicite sont exclues.');
      if (outsideOrders.unknownAccountLineCount) warnings.push(outsideOrders.unknownAccountLineCount + ' ligne(s) classée(s) hors budget référencent un compte absent du plan ; elles sont exclues.');
      if (outsideOrders.invalidAmountCount) warnings.push(outsideOrders.invalidAmountCount + ' montant(s) hors budget invalides sont exclus sans montant de remplacement.');
      warnings.push('Source : commandes émises, classées explicitement hors budget avec un compte choisi ; brouillons et annulations sont exclus. Ces commandes ne créent ni facture ni écriture comptable.');
      var outsideReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      outsideReport.cycleStart = cycleStart;
      outsideReport.cycleEnd = cycleEnd;
      outsideReport.from = from;
      outsideReport.to = to;
      outsideReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      outsideReport.rows = outsideOrders.rows;
      outsideReport.generatedLineCount = outsideOrders.rows.length;
      outsideReport.dataAvailable = outsideOrders.rows.length > 0;
      outsideReport.sourceOrderLineCount = outsideOrders.sourceOrderLineCount;
      outsideReport.unclassifiedLineCount = outsideOrders.unclassifiedLineCount;
      outsideReport.linkedLineCount = outsideOrders.linkedLineCount;
      outsideReport.nonBaseCurrencyLineCount = outsideOrders.nonBaseCurrencyLineCount;
      outsideReport.missingAccountLineCount = outsideOrders.missingAccountLineCount;
      outsideReport.unknownAccountLineCount = outsideOrders.unknownAccountLineCount;
      outsideReport.baseCurrencyCode = outsideOrders.baseCurrencyCode;
      outsideReport.commitmentRegisterAvailable = true;
      outsideReport.outsideClassificationAvailable = true;
      outsideReport.basis.budgetRegisterAvailable = true;
      outsideReport.basis.commitmentRegisterAvailable = true;
      outsideReport.basis.noBudgetAmountsSimulated = true;
      outsideReport.basis.noCommitmentsSimulated = false;
      outsideReport.basis.noRealizationsSimulated = true;
      outsideReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      outsideReport.basis.noAccountingMutation = true;
      return outsideReport;
    }
    if (['outside-realizations-total', 'outside-realizations-detail'].indexOf(definition.kind) !== -1 && Array.isArray(options.budgetRegister)) {
      var isOutsideRealizationDetail = definition.kind === 'outside-realizations-detail';
      var outsideActuals = outsideRealizationTotalRows(selectedBudget, options.entries, options.accounts, from, to);
      if (!outsideActuals.ok) return emptyResult(reportId, definition, options, outsideActuals.errors || ['Le cumul des réalisations hors budget ne peut pas être calculé.'], warnings, selectedBudget);
      if (outsideActuals.accountClassificationOnly) warnings.push('Le budget est classé par compte général (C) ; aucune classification explicite ne distingue les écritures hors budget. Aucun montant hors budget n’est déduit.');
      else if (outsideActuals.noSourceData) warnings.push('Aucune allocation analytique explicite, sur un compte budgété, ne correspond à une valeur absente des lignes du budget sélectionné.');
      if (outsideActuals.unallocatedCount) warnings.push(outsideActuals.unallocatedCount + ' ligne(s) ou reliquat(s) « À ventiler » sont exclus ; aucun axe ni aucune valeur ne sont inventés.');
      if (outsideActuals.unbudgetedAccountLineCount) warnings.push(outsideActuals.unbudgetedAccountLineCount + ' ligne(s) validée(s) portent un compte absent des lignes budgétaires ; elles ne sont pas attribuées au hors budget sans lien explicite.');
      if (outsideActuals.invalidAllocationCount) warnings.push(outsideActuals.invalidAllocationCount + ' ligne(s) ou allocation(s) analytiques invalides sont exclues.');
      warnings.push('Périmètre calculé uniquement pour les comptes budgétés ayant un axe analytique explicite : allocations validées dont la valeur exacte ne figure pas sur une ligne du même compte. Le classement « C » par compte seul ne permet pas d’isoler le hors budget. Source en lecture seule : écritures validées.');
      if (isOutsideRealizationDetail) warnings.push('La colonne Marché n’est renseignée que si la ligne source la fournit ; aucun marché n’est reconstitué. Les colonnes « - » restent des marqueurs.');
      var outsideActualReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      outsideActualReport.cycleStart = cycleStart;
      outsideActualReport.cycleEnd = cycleEnd;
      outsideActualReport.from = from;
      outsideActualReport.to = to;
      outsideActualReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      outsideActualReport.rows = isOutsideRealizationDetail ? outsideActuals.detailRows || [] : outsideActuals.rows;
      outsideActualReport.generatedLineCount = outsideActualReport.rows.length;
      outsideActualReport.dataAvailable = outsideActualReport.rows.length > 0;
      outsideActualReport.sourceEntryCount = outsideActuals.sourceEntryCount;
      outsideActualReport.matchedSourceLineCount = outsideActuals.matchedSourceLineCount;
      outsideActualReport.matchedAllocationCount = outsideActuals.matchedAllocationCount;
      outsideActualReport.unallocatedCount = outsideActuals.unallocatedCount;
      outsideActualReport.unbudgetedAccountLineCount = outsideActuals.unbudgetedAccountLineCount;
      outsideActualReport.invalidAllocationCount = outsideActuals.invalidAllocationCount;
      outsideActualReport.realizationMode = outsideActuals.realizationMode;
      outsideActualReport.axisNatureId = outsideActuals.axisNatureId;
      outsideActualReport.realizationBasis = outsideActuals.accountClassificationOnly ? 'Aucun classement hors budget distinct n’est défini pour une classification par compte.' : isOutsideRealizationDetail ? 'Compte exact du budget et détail des valeurs analytiques explicitement imputées, absentes de ce compte budgété.' : 'Compte exact du budget et valeur de la nature analytique explicitement imputée, absente de ce compte budgété.';
      outsideActualReport.budgetRegisterAvailable = true;
      outsideActualReport.realizationRegisterAvailable = false;
      outsideActualReport.basis.budgetRegisterAvailable = true;
      outsideActualReport.basis.realizationRegisterAvailable = false;
      outsideActualReport.basis.noBudgetAmountsSimulated = true;
      outsideActualReport.basis.noRealizationsSimulated = false;
      outsideActualReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      outsideActualReport.basis.noAccountingMutation = true;
      return outsideActualReport;
    }
    if (definition.kind === 'availability-summary' && Array.isArray(options.budgetRegister)) {
      if (!Array.isArray(options.supplierOrders)) return emptyResult(reportId, definition, options, ['Le registre des commandes fournisseurs n’est pas chargé.'], warnings, selectedBudget);
      if (!BudgetRealizations || typeof BudgetRealizations.calculate !== 'function') return emptyResult(reportId, definition, options, ['Le calcul des réalisations budgétaires n’est pas chargé.'], warnings, selectedBudget);
      var availability = budgetAvailabilityRows(selectedBudget, options.supplierOrders, options.entries, options.accounts, asOfDate, options.baseCurrencyCode);
      if (!availability.ok) return emptyResult(reportId, definition, options, availability.errors || ['Le suivi des engagements et réalisations ne peut pas être calculé.'], warnings, selectedBudget);
      if (!availability.rows.length) warnings.push('Le budget sélectionné ne contient aucune ligne permettant de présenter ce suivi.');
      if (availability.rows.length && options.generalAccounts === false) warnings.push('Aucune ligne de compte général n’a été sélectionnée pour l’impression ; les sources et calculs restent inchangés.');
      if (availability.rows.some(function (row) { return row.budgetAmount == null; })) warnings.push('Une ou plusieurs lignes budgétaires sont incomplètes ; leur budget reste « — ».');
      if (availability.commitments.unlinkedOrderLineCount) warnings.push(availability.commitments.unlinkedOrderLineCount + ' ligne(s) de commande émise(s) sans liaison explicite empêchent de certifier les engagements ; aucun rattachement n’est déduit.');
      if (availability.commitments.staleLinkCount) warnings.push(availability.commitments.staleLinkCount + ' liaison(s) explicite(s) de commande pointent vers une ligne budgétaire absente ; elles ne sont pas réattribuées.');
      if (availability.commitments.nonBaseCurrencyLineCount) warnings.push(availability.commitments.nonBaseCurrencyLineCount + ' ligne(s) de commande liée(s) en devise autre que ' + availability.commitments.baseCurrencyCode + ' ne sont pas converties ; les engagements des groupes concernés restent vides.');
      if (availability.commitments.invalidAmountCount) warnings.push(availability.commitments.invalidAmountCount + ' montant(s) de commande invalide(s) empêchent de certifier les engagements.');
      if (availability.unbudgetedRealizationGroupCount) warnings.push(availability.unbudgetedRealizationGroupCount + ' groupe(s) de valeur analytique explicite sans ligne budgétaire sont exclus des lignes budgétées ; aucune réalisation n’est reclassée.');
      if (availability.unallocatedRealizationGroupCount) warnings.push(availability.unallocatedRealizationGroupCount + ' groupe(s) de réalisations « À ventiler » sont exclus ; les allocations ne sont pas inventées.');
      if (availability.actuals.noSourceData) warnings.push('Aucune écriture validée ne correspond au budget et à la période arrêtée ; les réalisations restent « — », sans zéro supposé.');
      warnings.push('Lecture au ' + asOfDate + ' : Budget issu du registre, engagements issus des commandes émises et explicitement liées, réalisations issues des écritures validées selon le classement du budget. Aucun budget consommé, pourcentage ou reste disponible n’est calculé dans cet état.');
      var availabilityReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      availabilityReport.cycleStart = cycleStart;
      availabilityReport.cycleEnd = cycleEnd;
      availabilityReport.asOfDate = asOfDate;
      availabilityReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      availabilityReport.rows = options.generalAccounts === false ? [] : availability.rows;
      availabilityReport.generatedLineCount = availabilityReport.rows.length;
      availabilityReport.dataAvailable = availabilityReport.rows.length > 0;
      availabilityReport.lineSelection = { generalAccounts: options.generalAccounts !== false, groupingCodes: false, placeholderLines: Array.isArray(options.placeholderLines) ? options.placeholderLines.map(Boolean).slice(0, 2) : [false, false] };
      availabilityReport.sourceEntryCount = availability.sourceEntryCount;
      availabilityReport.matchedSourceLineCount = availability.matchedSourceLineCount;
      availabilityReport.sourceOrderLineCount = availability.commitments.sourceOrderLineCount;
      availabilityReport.matchedOrderLineCount = availability.commitments.matchedOrderLineCount;
      availabilityReport.unlinkedOrderLineCount = availability.commitments.unlinkedOrderLineCount;
      availabilityReport.staleLinkCount = availability.commitments.staleLinkCount;
      availabilityReport.nonBaseCurrencyLineCount = availability.commitments.nonBaseCurrencyLineCount;
      availabilityReport.baseCurrencyCode = availability.baseCurrencyCode;
      availabilityReport.realizationMode = availability.actuals.realizationMode;
      availabilityReport.axisNatureId = availability.actuals.axisNatureId;
      availabilityReport.realizationBasis = String(availability.actuals.basis || 'Classement budgétaire et écritures validées.');
      availabilityReport.budgetRegisterAvailable = true;
      availabilityReport.commitmentRegisterAvailable = true;
      availabilityReport.realizationRegisterAvailable = false;
      availabilityReport.basis.budgetRegisterAvailable = true;
      availabilityReport.basis.commitmentRegisterAvailable = true;
      availabilityReport.basis.realizationRegisterAvailable = false;
      availabilityReport.basis.noBudgetAmountsSimulated = false;
      availabilityReport.basis.noCommitmentsSimulated = false;
      availabilityReport.basis.noRealizationsSimulated = false;
      availabilityReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      availabilityReport.basis.noAccountingMutation = true;
      return availabilityReport;
    }
    if (definition.kind === 'forecast' && Array.isArray(options.budgetRegister)) {
      var forecast = forecastRows(selectedBudget, accountFilter.codes, options.accounts, options.analyticNatures, {
        generalAccounts: options.generalAccounts !== false,
        groupingCodes: options.groupingCodes === true
      });
      if (!forecast.sourceLineCount) warnings.push('Le budget sélectionné ne contient aucune ligne correspondant au filtre de comptes.');
      if (forecast.incompleteLineCount) warnings.push(forecast.incompleteLineCount + ' ligne(s) budgétaire(s) ont un montant annuel incomplet ; ces montants restent « — ».');
      if (!forecast.rows.length && forecast.sourceLineCount) warnings.push('Aucune ligne de compte ou de regroupement n’a été sélectionnée pour l’état.');
      warnings.push('Les lignes et montants proviennent du registre de budget enregistré. La colonne « Pourcentage du total » reste indisponible : sa formule n’est pas définie.');
      if (forecast.hasGroupingRows) warnings.push('Les codes de regroupement affichés totalisent les lignes budgétaires visibles ; un total reste « — » si une ligne descendante est incomplète.');
      var forecastReport = emptyResult(reportId, definition, options, [], warnings, selectedBudget);
      forecastReport.cycleStart = cycleStart;
      forecastReport.cycleEnd = cycleEnd;
      forecastReport.accountFilter = accountFilter;
      forecastReport.budgetOptions = availableBudgets.map(function (item) { return Object.assign({}, item); });
      forecastReport.rows = forecast.rows;
      forecastReport.generatedLineCount = forecast.rows.length;
      forecastReport.dataAvailable = forecast.rows.length > 0;
      forecastReport.sourceLineCount = forecast.sourceLineCount;
      forecastReport.incompleteLineCount = forecast.incompleteLineCount;
      forecastReport.lineSelection = { generalAccounts: options.generalAccounts !== false, groupingCodes: options.groupingCodes === true, placeholderLines: Array.isArray(options.placeholderLines) ? options.placeholderLines.map(Boolean).slice(0, 2) : [false, false] };
      forecastReport.budgetRegisterAvailable = true;
      forecastReport.basis.budgetRegisterAvailable = true;
      forecastReport.basis.noBudgetAmountsSimulated = false;
      forecastReport.basis.noCommitmentsSimulated = true;
      forecastReport.basis.noRealizationsSimulated = true;
      forecastReport.basis.noAvailabilityOrExecutionRateSimulated = true;
      forecastReport.basis.noAccountingMutation = true;
      return forecastReport;
    }
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
