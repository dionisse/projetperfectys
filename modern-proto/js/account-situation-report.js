/*
 * PERFECTO · Situation / position des comptes généraux à une date.
 * Lecture seule : réutilise les soldes nets à date calculés à partir du registre des reports et des pièces validées.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoAccountSituationReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'code', label: 'Code du compte', reportLabel: 'Compte', exportLabel: 'Compte', defaultSelected: true, text: true },
    { key: 'label', label: 'Intitulé du compte', reportLabel: 'Intitulé', exportLabel: 'Intitulé', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', reportLabel: 'Débit', exportLabel: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédit', exportLabel: 'Crédit', defaultSelected: true, text: false }
  ];

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function emptyResult(options, errors, parsedFilter) {
    return {
      ok: !errors.length,
      errors: errors,
      warnings: [],
      from: String(options.cycleStart || ''),
      to: String(options.asOfDate || ''),
      asOfDate: String(options.asOfDate || ''),
      rows: [],
      displayRows: [],
      totals: { accountCount: 0, debit: 0, credit: 0, difference: 0, balanced: true },
      generatedLineCount: 0,
      invalidLineCount: 0,
      accountFilter: parsedFilter || null,
      includeGrouping: options.includeGrouping === true,
      basis: {
        postedEntriesOnly: true,
        openingBalancesSeparate: true,
        closingNetBalances: true,
        cutoffDateInclusive: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var asOfDate = String(options.asOfDate || '');
    var accountExpression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var parsedFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(accountExpression)
      : { valid: false, all: false, tokens: [], patterns: [], error: 'Le calcul de la balance générale n’est pas disponible.' };
    var errors = [];
    if (!parsedFilter.valid) errors.push(parsedFilter.error);
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(asOfDate)) errors.push('Indiquez une date valide pour la situation des comptes.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (asOfDate < cycleStart || asOfDate > cycleEnd)) {
      errors.push('La date doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (errors.length) return emptyResult(options, errors, parsedFilter);

    var baseReport = GeneralBalanceReport.build({
      accounts: accounts,
      entries: entries,
      openingBalances: openingBalances,
      journals: journals,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      decimalPlaces: options.decimalPlaces,
      filters: {
        accounts: accountExpression,
        from: cycleStart,
        to: asOfDate,
        groupMode: options.includeGrouping === true ? 'chart' : 'none'
      }
    });
    if (!baseReport.ok) return emptyResult(options, baseReport.errors || ['La situation des comptes n’a pas pu être calculée.'], parsedFilter);

    function mapPosition(row) {
      return Object.assign({}, row, {
        debit: Number(row.closingBalanceDebit) || 0,
        credit: Number(row.closingBalanceCredit) || 0
      });
    }

    var accountByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountByCode[String(account.code)] = account;
    });
    function isEmptyGroupingAccount(row) {
      var account = accountByCode[String(row.code)];
      return !!(account && account.postable === false && (Number(row.closingBalance) || 0) === 0);
    }
    var rows = baseReport.rows.filter(function (row) { return !isEmptyGroupingAccount(row); }).map(mapPosition);
    var displayRows = (baseReport.displayRows || baseReport.rows).filter(function (row) {
      return (row.rowType !== 'group' || String(row.label || '').trim()) && !isEmptyGroupingAccount(row);
    }).map(mapPosition);
    var debitTotal = Number(baseReport.totals.closingBalanceDebit) || 0;
    var creditTotal = Number(baseReport.totals.closingBalanceCredit) || 0;
    var difference = debitTotal - creditTotal;
    var warnings = [];
    if (baseReport.invalidLineCount) {
      warnings.push(baseReport.invalidLineCount + (baseReport.invalidLineCount === 1
        ? ' ligne source contenant un montant invalide a été ignorée.'
        : ' lignes sources contenant un montant invalide ont été ignorées.'));
    }
    if (parsedFilter.all && difference !== 0) warnings.push('La situation de tous les comptes n’est pas équilibrée ; aucun ajustement n’a été appliqué.');

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      from: cycleStart,
      to: asOfDate,
      asOfDate: asOfDate,
      rows: rows,
      displayRows: displayRows,
      totals: {
        accountCount: rows.length,
        debit: debitTotal,
        credit: creditTotal,
        difference: difference,
        balanced: difference === 0
      },
      generatedLineCount: displayRows.length,
      invalidLineCount: baseReport.invalidLineCount,
      movementEntryCount: baseReport.movementEntryCount,
      openingBalanceLineCount: baseReport.openingBalanceLineCount,
      accountFilter: parsedFilter,
      includeGrouping: options.includeGrouping === true,
      basis: {
        postedEntriesOnly: true,
        openingBalancesSeparate: true,
        openingBalancesIncludedBeforePeriod: true,
        closingNetBalances: true,
        cutoffDateInclusive: true,
        draftEntriesExcluded: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
