/*
 * PERFECTO · Calcul de la Balance générale des comptes.
 * Lecture seule : pièces validées du cycle et registre distinct des reports à nouveau.
 * Les cumuls débit/crédit suivent les exemples de balance fournis ; les sous-totaux non définis restent hors calcul.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoGeneralBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'code', label: 'Code du compte', defaultSelected: true, supported: true },
    { key: 'label', label: 'Intitulé du compte', defaultSelected: true, supported: true },
    { key: 'cumulativeStart', label: 'Cumul Début Période', defaultSelected: false, supported: true },
    { key: 'openingBalance', label: 'Solde Début Période', defaultSelected: false, supported: true },
    { key: 'movements', label: 'Mouvements Période', defaultSelected: true, supported: true },
    { key: 'movementBalance', label: 'Solde Mouvements Période', defaultSelected: true, supported: true },
    { key: 'cumulativeEnd', label: 'Cumul Fin Période', defaultSelected: false, supported: true },
    { key: 'closingBalance', label: 'Solde Fin Période', defaultSelected: false, supported: true }
  ];

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseAccountFilter(expression) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) return { valid: false, all: false, tokens: [], patterns: [], error: 'Indiquez un compte ou * pour sélectionner tous les comptes.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, all: true, tokens: ['*'], patterns: [] };
    var patterns = tokens.map(function (token) {
      return new RegExp('^' + token.split('*').map(escapeRegex).join('.*') + '$', 'i');
    });
    return { valid: true, all: false, tokens: tokens, patterns: patterns };
  }

  function accountMatches(code, parsedFilter) {
    var parsed = parsedFilter && typeof parsedFilter === 'object' && Array.isArray(parsedFilter.patterns)
      ? parsedFilter
      : parseAccountFilter(parsedFilter);
    if (!parsed.valid) return false;
    if (parsed.all) return true;
    var value = String(code == null ? '' : code);
    return parsed.patterns.some(function (pattern) { return pattern.test(value); });
  }

  function classNumber(account) {
    var declared = Number(account && account.cls);
    if (Number.isInteger(declared) && declared >= 1 && declared <= 9) return declared;
    var first = Number(String(account && account.code || '').charAt(0));
    return Number.isInteger(first) ? first : 0;
  }

  function finiteAmount(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    return Number.isSafeInteger(scaled) ? scaled : null;
  }

  function build(options) {
    options = options || {};
    var filters = options.filters || {};
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var parsedFilter = parseAccountFilter(filters.accounts == null ? '*' : filters.accounts);
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var selectedColumns = options.columns || {};
    var accountByCode = Object.create(null);
    var accountOrder = Object.create(null);
    var journalNatureByCode = Object.create(null);
    var sums = Object.create(null);
    var movementEntryIds = Object.create(null);
    var invalidLineCount = 0;
    var openingBalanceLineCount = 0;
    var sourceLineCount = 0;

    accounts.forEach(function (account, index) {
      if (!account || account.code == null) return;
      var code = String(account.code);
      accountByCode[code] = account;
      accountOrder[code] = index;
    });
    journals.forEach(function (journal) {
      if (!journal || journal.code == null) return;
      journalNatureByCode[String(journal.code)] = String(journal.operationNature || '');
    });

    function accountIsSelected(code) {
      if (!accountMatches(code, parsedFilter)) return false;
      if (!filters.collectivesOnly) return true;
      var account = accountByCode[code];
      return !!account && classNumber(account) === 4 && account.aux === true;
    }

    function ensureRow(code) {
      code = String(code || '');
      if (!code) return null;
      if (!sums[code]) {
        var account = accountByCode[code] || null;
        sums[code] = {
          code: code,
          label: account && account.label ? String(account.label) : code,
          cls: classNumber(account || { code: code }),
          aux: !!(account && account.aux === true),
          openingDebitMinor: 0,
          openingCreditMinor: 0,
          movementDebitMinor: 0,
          movementCreditMinor: 0
        };
      }
      return sums[code];
    }

    function addAmounts(row, debitValue, creditValue, bucket) {
      var debit = finiteAmount(debitValue, factor);
      var credit = finiteAmount(creditValue, factor);
      if (debit === null || credit === null) {
        invalidLineCount += 1;
        return false;
      }
      row[bucket + 'DebitMinor'] += debit;
      row[bucket + 'CreditMinor'] += credit;
      return true;
    }

    function excludedByNature(entry) {
      var journalCode = String(entry && (entry.journal == null ? entry.journalCode : entry.journal) || '');
      var nature = journalNatureByCode[journalCode] || '';
      if (filters.beforeInventory && nature === 'Inventaire') return true;
      if (filters.beforeResult && nature === 'Résultat de l’exercice') return true;
      return false;
    }

    /*
     * Les reports à nouveau sont une base distincte du journal. Avec les pièces
     * validées antérieures à la période, ils forment les cumuls de début en
     * conservant séparément débits et crédits. Les cumuls de fin additionnent
     * ensuite les mouvements de la période à chacun de ces deux côtés.
     */
    openingBalances.forEach(function (record) {
      if (!record || !record.accountCode || !record.date || record.date >= from) return;
      var code = String(record.accountCode);
      if (!accountIsSelected(code)) return;
      var row = ensureRow(code);
      if (!addAmounts(row, record.debit, record.credit, 'opening')) return;
      openingBalanceLineCount += 1;
    });

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !entry.date || entry.date > to || excludedByNature(entry)) return;
      if (options.cycleStart && entry.date < options.cycleStart) return;
      if (options.cycleEnd && entry.date > options.cycleEnd) return;
      var bucket = entry.date < from ? 'opening' : 'movement';
      var hasSelectedLine = false;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
        if (!line) return;
        var code = String(line.account == null ? line.accountCode || '' : line.account);
        if (!code || !accountIsSelected(code)) return;
        var row = ensureRow(code);
        if (!addAmounts(row, line.debit, line.credit, bucket)) return;
        hasSelectedLine = true;
        sourceLineCount += 1;
      });
      if (bucket === 'movement' && hasSelectedLine) {
        var entryId = String(entry.id || entry.reference || ('entry-' + Object.keys(movementEntryIds).length));
        movementEntryIds[entryId] = true;
      }
    });

    /* Une sélection explicite montre aussi les comptes sans mouvement. */
    if (parsedFilter.valid && !parsedFilter.all) {
      accounts.forEach(function (account) {
        if (!account || account.code == null) return;
        var code = String(account.code);
        if (accountIsSelected(code)) ensureRow(code);
      });
    }

    var rows = Object.keys(sums).map(function (code) {
      var row = sums[code];
      var openingDebit = row.openingDebitMinor / factor;
      var openingCredit = row.openingCreditMinor / factor;
      var movementDebit = row.movementDebitMinor / factor;
      var movementCredit = row.movementCreditMinor / factor;
      var openingBalance = (row.openingDebitMinor - row.openingCreditMinor) / factor;
      var movementBalance = (row.movementDebitMinor - row.movementCreditMinor) / factor;
      var closingBalance = (row.openingDebitMinor - row.openingCreditMinor + row.movementDebitMinor - row.movementCreditMinor) / factor;
      var hasActivity = row.openingDebitMinor !== 0 || row.openingCreditMinor !== 0 ||
        row.movementDebitMinor !== 0 || row.movementCreditMinor !== 0;
      if (!hasActivity && parsedFilter.all) return null;
      return {
        code: row.code,
        label: row.label,
        cls: row.cls,
        aux: row.aux,
        openingDebit: openingDebit,
        openingCredit: openingCredit,
        openingBalance: openingBalance,
        cumulativeStartDebit: openingDebit,
        cumulativeStartCredit: openingCredit,
        movementDebit: movementDebit,
        movementCredit: movementCredit,
        movementBalance: movementBalance,
        cumulativeEndDebit: (row.openingDebitMinor + row.movementDebitMinor) / factor,
        cumulativeEndCredit: (row.openingCreditMinor + row.movementCreditMinor) / factor,
        closingBalance: closingBalance
      };
    }).filter(Boolean);

    if (filters.groupMode === 'chart') {
      rows.sort(function (left, right) {
        var leftIndex = Object.prototype.hasOwnProperty.call(accountOrder, left.code) ? accountOrder[left.code] : Number.MAX_SAFE_INTEGER;
        var rightIndex = Object.prototype.hasOwnProperty.call(accountOrder, right.code) ? accountOrder[right.code] : Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.code.localeCompare(right.code, 'fr', { numeric: true });
      });
    } else {
      rows.sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });
    }

    function sumRows(key) {
      return rows.reduce(function (sum, row) { return sum + Math.round((Number(row[key]) || 0) * factor); }, 0) / factor;
    }

    var totals = {
      openingBalance: sumRows('openingBalance'),
      cumulativeStartDebit: sumRows('cumulativeStartDebit'),
      cumulativeStartCredit: sumRows('cumulativeStartCredit'),
      movementDebit: sumRows('movementDebit'),
      movementCredit: sumRows('movementCredit'),
      movementBalance: sumRows('movementBalance'),
      cumulativeEndDebit: sumRows('cumulativeEndDebit'),
      cumulativeEndCredit: sumRows('cumulativeEndCredit'),
      closingBalance: sumRows('closingBalance')
    };
    var visibleColumns = COLUMN_DEFINITIONS.filter(function (column) {
      return column.supported && selectedColumns[column.key] === true;
    }).map(function (column) { return column.key; });
    var errors = [];
    if (!parsedFilter.valid) errors.push(parsedFilter.error);
    if (!from || !to) errors.push('Les dates de début et de fin sont obligatoires.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');

    return {
      ok: errors.length === 0,
      errors: errors,
      from: from,
      to: to,
      rows: rows,
      columns: visibleColumns,
      totals: totals,
      movementEntryCount: Object.keys(movementEntryIds).length,
      openingBalanceLineCount: openingBalanceLineCount,
      sourceLineCount: sourceLineCount,
      invalidLineCount: invalidLineCount,
      accountFilter: parsedFilter,
      filters: {
        collectivesOnly: filters.collectivesOnly === true,
        beforeInventory: filters.beforeInventory === true,
        beforeResult: filters.beforeResult === true,
        groupMode: filters.groupMode === 'chart' ? 'chart' : 'none'
      },
      basis: {
        postedEntriesOnly: true,
        openingBalancesSeparate: true,
        openingBalancesIncludedBeforePeriod: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.slice(),
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    build: build
  };
});
