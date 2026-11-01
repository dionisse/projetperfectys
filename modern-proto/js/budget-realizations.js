/* Calcul des réalisations budgétaires depuis les seules écritures validées. Lecture seule. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoBudgetRealizations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
  }

  function periodKeys(budget) {
    if (budget.decomposition === 'none') return ['EXERCICE'];
    var start = String(budget.cycleStart || budget.year + '-01-01');
    var end = String(budget.cycleEnd || budget.year + '-12-31');
    var keys = [];
    if (budget.decomposition === 'month') {
      var cursor = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1));
      var endMonth = new Date(Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, 1));
      while (cursor <= endMonth && keys.length < 48) {
        keys.push(cursor.getUTCFullYear() + '-' + String(cursor.getUTCMonth() + 1).padStart(2, '0'));
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    } else if (budget.decomposition === 'quarter') {
      var monthSpan = (Number(end.slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(start.slice(5, 7));
      var quarterCount = Math.floor(monthSpan / 3) + 1;
      for (var quarter = 1; quarter <= quarterCount && quarter <= 16; quarter += 1) keys.push('T' + quarter);
    }
    return keys;
  }

  function periodForDate(date, budget) {
    if (budget.decomposition === 'none') return 'EXERCICE';
    if (budget.decomposition === 'month') return String(date).slice(0, 7);
    var start = String(budget.cycleStart || budget.year + '-01-01');
    var monthDiff = (Number(String(date).slice(0, 4)) - Number(start.slice(0, 4))) * 12 + Number(String(date).slice(5, 7)) - Number(start.slice(5, 7));
    return 'T' + (Math.floor(monthDiff / 3) + 1);
  }

  function allocationKey(natureId, allocation) {
    if (natureId === 'responsibility-centers') {
      var centerId = String(allocation && allocation.centerId || '').trim();
      return centerId ? 'center:' + centerId : '';
    }
    var label = String(allocation && allocation.valueLabel || '').trim().replace(/\s+/g, ' ');
    return label ? 'label:' + label : '';
  }

  function modeContribution(side, amount, mode) {
    amount = Number(amount);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    if (side === 'debit') {
      if (mode === 'debit' || mode === 'debit-credit') return amount;
      if (mode === 'credit-debit') return -amount;
      return 0;
    }
    if (side === 'credit') {
      if (mode === 'credit' || mode === 'credit-debit') return amount;
      if (mode === 'debit-credit') return -amount;
    }
    return 0;
  }

  function addPeriod(target, key, amount, count) {
    if (!target[key]) target[key] = { amount: 0, sourceLineCount: 0 };
    target[key].amount += amount;
    if (count) target[key].sourceLineCount += 1;
  }

  function calculate(options) {
    options = options || {};
    var budget = options.budget;
    var errors = [];
    if (!budget || typeof budget !== 'object' || !Array.isArray(budget.lines)) errors.push('Sélectionnez un budget avec ses lignes.');
    if (budget && (!isIsoDate(budget.cycleStart) || !isIsoDate(budget.cycleEnd) || budget.cycleStart > budget.cycleEnd)) errors.push('La période du budget est invalide.');
    var mode = budget && budget.realizationMode;
    if (['debit', 'credit', 'debit-credit', 'credit-debit'].indexOf(mode) < 0) errors.push('La base de réalisation du budget n’est pas définie.');
    var classification = budget && String(budget.classification || 'C');
    var axisIndex = classification && classification.charAt(0) === 'A' ? Number(classification.slice(1)) - 1 : -1;
    var axisNatureId = axisIndex >= 0 && budget.analyticNatureIds ? budget.analyticNatureIds[axisIndex] : '';
    if (classification !== 'C' && (!axisNatureId || !/^A[1-4]$/.test(classification))) errors.push('Le classement analytique ne correspond pas à un axe configuré.');
    if (errors.length) return { ok: false, errors: errors, rows: [], periods: [], noSourceData: true };

    var periods = periodKeys(budget);
    var lines = budget.lines;
    var lineByAccount = Object.create(null);
    var groupsByKey = Object.create(null);
    var groupOrder = [];
    function getGroup(key, label, status) {
      if (!groupsByKey[key]) {
        groupsByKey[key] = { key: key, label: label, status: status || 'budgeted', accountCodes: Object.create(null), budgetByPeriod: Object.create(null), realizationByPeriod: Object.create(null), unclassifiedSourceAmount: 0 };
        groupOrder.push(key);
      }
      return groupsByKey[key];
    }
    function periodBudgetValue(line, period) {
      if (budget.decomposition === 'none') return line.amountComplete === false ? null : Number(line.annualAmount || 0);
      var value = line.periodAmounts && line.periodAmounts[period];
      return value === '' || value == null ? null : Number(value);
    }
    lines.forEach(function (line) {
      var accountCode = String(line.accountCode || '').trim();
      if (!accountCode) return;
      if (!lineByAccount[accountCode]) lineByAccount[accountCode] = [];
      lineByAccount[accountCode].push(line);
      var key;
      var label;
      var status = 'budgeted';
      if (classification === 'C') {
        key = 'account:' + accountCode;
        label = accountCode;
      } else {
        var value = line.analyticValues && line.analyticValues[axisNatureId] || {};
        var valueKey = axisNatureId === 'responsibility-centers' ? (value.valueId ? 'center:' + value.valueId : '') : (value.valueLabel ? 'label:' + String(value.valueLabel).trim().replace(/\s+/g, ' ') : '');
        if (!valueKey) { key = '__budget-unclassified__'; label = 'Budget analytique · À ventiler'; status = 'unclassified-budget'; }
        else { key = 'axis:' + valueKey; label = String(value.valueLabel || value.valueId || 'Valeur analytique'); }
      }
      var group = getGroup(key, label, status);
      group.accountCodes[accountCode] = true;
      periods.forEach(function (period) {
        var amount = periodBudgetValue(line, period);
        if (!group.budgetByPeriod[period]) group.budgetByPeriod[period] = { amount: 0, complete: true, lineCount: 0 };
        group.budgetByPeriod[period].lineCount += 1;
        if (amount == null || !Number.isFinite(amount)) group.budgetByPeriod[period].complete = false;
        else group.budgetByPeriod[period].amount += amount;
      });
    });

    var entries = Array.isArray(options.entries) ? options.entries : [];
    var sourceEntries = entries.filter(function (entry) {
      return entry && entry.status === 'posted' && isIsoDate(entry.date) && entry.date >= budget.cycleStart && entry.date <= budget.cycleEnd;
    });
    var sourceLineCount = 0;
    var unbudgetedAnalyticGroups = Object.create(null);
    function addUnbudgeted(key, label, period, amount, accountCode) {
      var group = getGroup('unbudgeted:' + key, label, 'unbudgeted-realization');
      if (accountCode) group.accountCodes[accountCode] = true;
      addPeriod(group.realizationByPeriod, period, amount, true);
      unbudgetedAnalyticGroups[key] = true;
    }

    sourceEntries.forEach(function (entry) {
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
        var accountCode = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        var budgetLines = lineByAccount[accountCode];
        if (!budgetLines || !budgetLines.length) return;
        var period = periodForDate(entry.date, budget);
        if (periods.indexOf(period) < 0) return;
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        sourceLineCount += 1;
        if (classification === 'C') {
          var accountGroup = groupsByKey['account:' + accountCode];
          if (!accountGroup) return;
          var accountAmount = modeContribution('debit', debit, mode) + modeContribution('credit', credit, mode);
          addPeriod(accountGroup.realizationByPeriod, period, accountAmount, true);
          return;
        }
        var split = (Array.isArray(line.analyticSplits) ? line.analyticSplits : []).find(function (item) { return item && item.natureId === axisNatureId; });
        var lineAmount = debit > 0 && credit > 0 ? NaN : debit > 0 ? debit : credit;
        if (!split || !Number.isFinite(lineAmount)) {
          var fullUnallocated = modeContribution('debit', debit, mode) + modeContribution('credit', credit, mode);
          if (Number.isFinite(lineAmount) && lineAmount > 0) {
            var unallocatedGroup = getGroup('__realization-unallocated__', 'Réalisation analytique · À ventiler', 'unclassified-realization');
            unallocatedGroup.accountCodes[accountCode] = true;
            addPeriod(unallocatedGroup.realizationByPeriod, period, fullUnallocated, true);
          }
          return;
        }
        var allocations = Array.isArray(split.allocations) ? split.allocations : [];
        var assignedAmount = 0;
        allocations.forEach(function (allocation) {
          var key = allocationKey(axisNatureId, allocation);
          var amount = Number(allocation && allocation.amount);
          if (!key || !Number.isFinite(amount) || amount < 0) return;
          assignedAmount += amount;
          var contribution = modeContribution(debit > 0 ? 'debit' : 'credit', amount, mode);
          var pairBudgeted = budgetLines.some(function (budgetLine) {
            var budgetValue = budgetLine.analyticValues && budgetLine.analyticValues[axisNatureId] || {};
            return axisNatureId === 'responsibility-centers'
              ? String(budgetValue.valueId || '') === key.slice('center:'.length)
              : String(budgetValue.valueLabel || '').trim().replace(/\s+/g, ' ') === key.slice('label:'.length);
          });
          if (pairBudgeted) {
            var axisGroup = groupsByKey['axis:' + key];
            if (axisGroup && axisGroup.accountCodes[accountCode]) addPeriod(axisGroup.realizationByPeriod, period, contribution, true);
            else addUnbudgeted(key, 'Réalisation sans ligne budgétaire · ' + key.slice(key.indexOf(':') + 1), period, contribution, accountCode);
          } else addUnbudgeted(key, 'Réalisation sans ligne budgétaire · ' + key.slice(key.indexOf(':') + 1), period, contribution, accountCode);
        });
        var unallocated = Number(split.unallocatedAmount);
        if (!Number.isFinite(unallocated) || unallocated < 0) unallocated = Math.max(0, lineAmount - assignedAmount);
        if (unallocated > 0) {
          var sign = modeContribution(debit > 0 ? 'debit' : 'credit', unallocated, mode);
          var remainingGroup = getGroup('__realization-unallocated__', 'Réalisation analytique · À ventiler', 'unclassified-realization');
          remainingGroup.accountCodes[accountCode] = true;
          addPeriod(remainingGroup.realizationByPeriod, period, sign, true);
        }
      });
    });

    var rows = groupOrder.map(function (key) {
      var group = groupsByKey[key];
      var rowPeriods = periods.map(function (period) {
        var budgetValue = group.budgetByPeriod[period] || null;
        var realizationValue = group.realizationByPeriod[period] || null;
        var budgetComplete = budgetValue ? budgetValue.complete : group.status !== 'budgeted' && group.status !== 'unclassified-budget';
        var budgetAmount = budgetValue && budgetValue.complete ? budgetValue.amount : null;
        var realizationAmount = realizationValue ? realizationValue.amount : null;
        return {
          key: period,
          budgetAmount: budgetAmount,
          budgetSubtotal: budgetValue ? budgetValue.amount : null,
          budgetComplete: budgetComplete,
          realizationAmount: realizationAmount,
          sourceLineCount: realizationValue ? realizationValue.sourceLineCount : 0,
          variance: budgetAmount == null || realizationAmount == null ? null : budgetAmount - realizationAmount
        };
      });
      return { key: group.key, label: group.label, status: group.status, accountCodes: Object.keys(group.accountCodes).sort(), periods: rowPeriods };
    });
    return {
      ok: true,
      budgetCode: budget.code,
      classification: classification,
      axisNatureId: axisNatureId || '',
      realizationMode: mode,
      periods: periods,
      rows: rows,
      sourceEntryCount: sourceEntries.length,
      matchedSourceLineCount: sourceLineCount,
      noSourceData: sourceLineCount === 0,
      noAccountingMutation: true,
      basis: classification === 'C' ? 'Comptes exacts du budget ; écritures validées uniquement.' : 'Une seule nature analytique est calculée selon le classement choisi ; les axes parallèles ne sont jamais additionnés.'
    };
  }

  return { calculate: calculate, periodKeys: periodKeys };
});
