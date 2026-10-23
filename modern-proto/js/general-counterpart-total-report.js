/*
 * PERFECTO · Cumul des contreparties d’un compte.
 * Agrège les lignes réelles des autres comptes d’une même pièce validée.
 * Chaque ligne source de contrepartie est comptée une fois ; aucune ventilation n’est créée.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  var generalLedgerReport = root.PerfectoGeneralLedgerReport;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!generalBalanceReport) generalBalanceReport = require('./accounting-balance-report.js');
    if (!generalLedgerReport) generalLedgerReport = require('./general-ledger-report.js');
  }
  var api = factory(generalBalanceReport, generalLedgerReport);
  root.PerfectoGeneralCounterpartTotalReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport, GeneralLedgerReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'counterpartCode', label: 'Contrepartie', reportLabel: 'Contrepartie', exportLabel: 'Contrepartie', text: true, defaultSelected: true },
    { key: 'counterpartTitle', label: 'Intitulé', reportLabel: 'Intitulé', exportLabel: 'Intitulé', text: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', reportLabel: 'Nombre de lignes', exportLabel: 'Nombre de lignes', text: false, defaultSelected: true },
    { key: 'debit', label: 'Débits', reportLabel: 'Débits', exportLabel: 'Débits', text: false, defaultSelected: true },
    { key: 'credit', label: 'Crédits', reportLabel: 'Crédits', exportLabel: 'Crédits', text: false, defaultSelected: true }
  ];

  function emptyResult(options, errors, mainFilter, counterpartFilter) {
    options = options || {};
    errors = Array.isArray(errors) ? errors.slice() : [];
    return {
      ok: !errors.length,
      errors: errors,
      warnings: [],
      from: String(options.from || ''),
      to: String(options.to || ''),
      rows: [],
      counterpartCount: 0,
      generatedLineCount: 0,
      sourceLineCount: 0,
      invalidLineCount: 0,
      invalidDateCount: 0,
      accountFilter: mainFilter || null,
      counterpartFilter: counterpartFilter || null,
      basis: {
        postedEntriesOnly: true,
        counterpartValuesFromSourceLines: true,
        counterpartSourceLinesDeduplicated: true,
        multilineAmountAllocationApplied: false,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    if (!GeneralBalanceReport || !GeneralLedgerReport) {
      return emptyResult(options, ['Le calcul des mouvements et des contreparties n’est pas disponible.']);
    }
    var accountExpression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var counterpartExpression = options.counterpartFilter == null ? '*' : String(options.counterpartFilter);
    var mainFilter = GeneralBalanceReport.parseAccountFilter(accountExpression);
    var counterpartFilter = GeneralBalanceReport.parseAccountFilter(counterpartExpression);
    var filterErrors = [];
    if (!mainFilter.valid) filterErrors.push('Comptes à détailler : ' + mainFilter.error);
    if (!counterpartFilter.valid) filterErrors.push('Comptes de contrepartie : ' + counterpartFilter.error);
    if (filterErrors.length) return emptyResult(options, filterErrors, mainFilter, counterpartFilter);

    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var ledgerReport = GeneralLedgerReport.build({
      accounts: accounts,
      entries: Array.isArray(options.entries) ? options.entries : [],
      openingBalances: Array.isArray(options.openingBalances) ? options.openingBalances : [],
      journals: Array.isArray(options.journals) ? options.journals : [],
      matchingGroups: [],
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      from: String(options.from || ''),
      to: String(options.to || ''),
      accountFilter: accountExpression,
      includeNonMoved: false,
      subtotalByMonth: false,
      decimalPlaces: decimalPlaces
    });
    if (!ledgerReport.ok) return emptyResult(options, ledgerReport.errors, mainFilter, counterpartFilter);

    var accountByCode = Object.create(null);
    var accountOrder = Object.create(null);
    accounts.forEach(function (account, index) {
      if (!account || account.code == null) return;
      accountByCode[String(account.code)] = account;
      accountOrder[String(account.code)] = index;
    });
    var factor = Math.pow(10, decimalPlaces);
    var totalsByCounterpart = Object.create(null);
    var seenCounterpartLines = Object.create(null);
    var sourceLineCount = 0;
    var totalsOverflow = false;

    (ledgerReport.rows || []).forEach(function (detailRow) {
      var counterpartLines = Array.isArray(detailRow.counterpartLines) ? detailRow.counterpartLines : [];
      counterpartLines.forEach(function (sourceLine) {
        var code = String(sourceLine && sourceLine.accountCode || '');
        if (!code || !GeneralBalanceReport.accountMatches(code, counterpartFilter)) return;
        var sourceKey = String(sourceLine.sourceKey || sourceLine.key || (String(detailRow.entryKey || detailRow.key || '') + ':' + sourceLine.lineIndex));
        if (!sourceKey || seenCounterpartLines[sourceKey]) return;
        seenCounterpartLines[sourceKey] = true;
        var debitMinor = Number(sourceLine.debitMinor);
        var creditMinor = Number(sourceLine.creditMinor);
        if (!Number.isSafeInteger(debitMinor) || debitMinor < 0 || !Number.isSafeInteger(creditMinor) || creditMinor < 0) return;
        var aggregate = totalsByCounterpart[code];
        if (!aggregate) {
          var account = accountByCode[code];
          aggregate = totalsByCounterpart[code] = {
            counterpartCode: code,
            counterpartTitle: String(account && account.label || code),
            lineCount: 0,
            debitMinor: 0,
            creditMinor: 0
          };
        }
        aggregate.lineCount += 1;
        aggregate.debitMinor += debitMinor;
        aggregate.creditMinor += creditMinor;
        sourceLineCount += 1;
        if (!Number.isSafeInteger(aggregate.lineCount) || !Number.isSafeInteger(aggregate.debitMinor) || !Number.isSafeInteger(aggregate.creditMinor) || !Number.isSafeInteger(sourceLineCount)) {
          totalsOverflow = true;
        }
      });
    });

    if (totalsOverflow) {
      return emptyResult(options, ['Les cumuls de contrepartie dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.'], mainFilter, counterpartFilter);
    }
    var rows = Object.keys(totalsByCounterpart).map(function (code) {
      var aggregate = totalsByCounterpart[code];
      return {
        counterpartCode: aggregate.counterpartCode,
        counterpartTitle: aggregate.counterpartTitle,
        lineCount: aggregate.lineCount,
        debit: aggregate.debitMinor / factor,
        credit: aggregate.creditMinor / factor,
        debitMinor: aggregate.debitMinor,
        creditMinor: aggregate.creditMinor
      };
    }).sort(function (left, right) {
      var leftIndex = Object.prototype.hasOwnProperty.call(accountOrder, left.counterpartCode) ? accountOrder[left.counterpartCode] : Number.MAX_SAFE_INTEGER;
      var rightIndex = Object.prototype.hasOwnProperty.call(accountOrder, right.counterpartCode) ? accountOrder[right.counterpartCode] : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.counterpartCode.localeCompare(right.counterpartCode, 'fr', { numeric: true });
    });

    return {
      ok: true,
      errors: [],
      warnings: Array.isArray(ledgerReport.warnings) ? ledgerReport.warnings.slice() : [],
      from: ledgerReport.from,
      to: ledgerReport.to,
      rows: rows,
      counterpartCount: rows.length,
      generatedLineCount: rows.length,
      sourceLineCount: sourceLineCount,
      invalidLineCount: Number(ledgerReport.invalidLineCount) || 0,
      invalidDateCount: Number(ledgerReport.invalidDateCount) || 0,
      accountFilter: mainFilter,
      counterpartFilter: counterpartFilter,
      basis: {
        postedEntriesOnly: true,
        counterpartValuesFromSourceLines: true,
        counterpartSourceLinesDeduplicated: true,
        multilineAmountAllocationApplied: false,
        noAccountingMutation: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
