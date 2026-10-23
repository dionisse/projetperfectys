/*
 * PERFECTO · Détail des contreparties d’un compte.
 * Lecture seule : les mouvements validés sont rapprochés des autres comptes de la même pièce.
 * En pièce multiligne, aucun montant n’est ventilé entre les comptes de contrepartie.
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
  root.PerfectoGeneralCounterpartDetailReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport, GeneralLedgerReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', reportLabel: 'Date', exportLabel: 'Date', text: true, defaultSelected: true },
    { key: 'journal', label: 'Journal', reportLabel: 'Journal', exportLabel: 'Journal', text: true, defaultSelected: true },
    { key: 'piece', label: 'Pièce', reportLabel: 'Pièce', exportLabel: 'Pièce', text: true, defaultSelected: true },
    { key: 'counterpart', label: 'Contrepartie', reportLabel: 'Contrepartie', exportLabel: 'Contrepartie', text: true, defaultSelected: true },
    { key: 'label', label: 'Libellé', reportLabel: 'Libellé', exportLabel: 'Libellé', text: true, defaultSelected: true },
    { key: 'debit', label: 'Débit', reportLabel: 'Débit', exportLabel: 'Débit', text: false, defaultSelected: true },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédit', exportLabel: 'Crédit', text: false, defaultSelected: true }
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
      accounts: [],
      rows: [],
      accountCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      invalidLineCount: 0,
      invalidDateCount: 0,
      mainAccountFilter: mainFilter || null,
      counterpartAccountFilter: counterpartFilter || null,
      basis: {
        postedEntriesOnly: true,
        draftEntriesExcluded: true,
        counterpartFromOtherAccountsInSameEntry: true,
        counterpartAmountsAllocated: false,
        rowAmountsFromDetailedAccountLine: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    if (!GeneralBalanceReport || !GeneralLedgerReport) {
      return emptyResult(options, ['Le calcul du grand livre nécessaire à cette édition n’est pas disponible.']);
    }
    var accountExpression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var counterpartExpression = options.counterpartFilter == null ? '*' : String(options.counterpartFilter);
    var mainFilter = GeneralBalanceReport.parseAccountFilter(accountExpression);
    var counterpartFilter = GeneralBalanceReport.parseAccountFilter(counterpartExpression);
    var filterErrors = [];
    if (!mainFilter.valid) filterErrors.push('Comptes à détailler : ' + mainFilter.error);
    if (!counterpartFilter.valid) filterErrors.push('Comptes de contrepartie : ' + counterpartFilter.error);
    if (filterErrors.length) return emptyResult(options, filterErrors, mainFilter, counterpartFilter);

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
      decimalPlaces: options.decimalPlaces
    });
    if (!ledgerReport.ok) return emptyResult(options, ledgerReport.errors, mainFilter, counterpartFilter);

    var accountByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountByCode[String(account.code)] = account;
    });
    var reportAccounts = [];
    var rows = [];
    (ledgerReport.accounts || []).forEach(function (section) {
      var sectionRows = [];
      (section.rows || []).forEach(function (row) {
        var counterpartCodes = Array.isArray(row.counterpartCodes) ? row.counterpartCodes : [];
        var selectedCodes = counterpartCodes.filter(function (code) {
          return GeneralBalanceReport.accountMatches(String(code), counterpartFilter);
        });
        if (!selectedCodes.length) return;
        var counterpart = selectedCodes.map(function (code) {
          var account = accountByCode[String(code)];
          return String(code) + (account && account.label ? ' — ' + String(account.label) : '');
        }).join(' · ');
        sectionRows.push(Object.assign({}, row, {
          counterpartCodes: selectedCodes.slice(),
          counterpart: counterpart
        }));
      });
      if (!sectionRows.length) return;
      var reportSection = {
        code: String(section.code || ''),
        label: String(section.label || section.code || ''),
        lineCount: sectionRows.length,
        rows: sectionRows
      };
      reportAccounts.push(reportSection);
      Array.prototype.push.apply(rows, sectionRows);
    });

    return {
      ok: true,
      errors: [],
      warnings: Array.isArray(ledgerReport.warnings) ? ledgerReport.warnings.slice() : [],
      from: ledgerReport.from,
      to: ledgerReport.to,
      accounts: reportAccounts,
      rows: rows,
      accountCount: reportAccounts.length,
      lineCount: rows.length,
      generatedLineCount: rows.length,
      invalidLineCount: Number(ledgerReport.invalidLineCount) || 0,
      invalidDateCount: Number(ledgerReport.invalidDateCount) || 0,
      mainAccountFilter: mainFilter,
      counterpartAccountFilter: counterpartFilter,
      basis: {
        postedEntriesOnly: true,
        draftEntriesExcluded: true,
        counterpartFromOtherAccountsInSameEntry: true,
        counterpartAmountsAllocated: false,
        rowAmountsFromDetailedAccountLine: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
