/*
 * PERFECTO · Journal des reports à nouveau.
 * Lecture seule : détaille les lignes validées du registre dédié du dossier.
 */
(function (root, factory) {
  'use strict';
  var openingBalanceReport = root.PerfectoOpeningBalanceReport;
  if (!openingBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    openingBalanceReport = require('./opening-balance-report.js');
  }
  var api = factory(openingBalanceReport);
  root.PerfectoOpeningBalanceJournalReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (OpeningBalanceReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'accountCode', label: 'Code du compte', reportLabel: 'Code du compte', exportLabel: 'Code du compte', defaultSelected: true, text: true },
    { key: 'accountTitle', label: 'Intitulé du compte', reportLabel: 'Intitulé du compte', exportLabel: 'Intitulé du compte', defaultSelected: true, text: true },
    { key: 'date', label: 'Date', reportLabel: 'Date', exportLabel: 'Date', defaultSelected: true, text: true },
    { key: 'reference', label: 'Référence', reportLabel: 'Référence', exportLabel: 'Référence', defaultSelected: true, text: true },
    { key: 'letteringDate', label: 'Date lettrage', reportLabel: 'Date lettrage', exportLabel: 'Date lettrage', defaultSelected: true, text: true, supported: false },
    { key: 'debit', label: 'Débit', reportLabel: 'Débit', exportLabel: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédit', exportLabel: 'Crédit', defaultSelected: true, text: false },
    { key: 'currencyAmount', label: 'Montant en devise', reportLabel: 'Montant en devise', exportLabel: 'Montant en devise', defaultSelected: true, text: false, supported: false },
    { key: 'label', label: 'Libellé', reportLabel: 'Libellé', exportLabel: 'Libellé', defaultSelected: true, text: true }
  ];

  function emptyResult(options, sourceReport) {
    options = options || {};
    sourceReport = sourceReport || {};
    return {
      ok: sourceReport.ok !== false,
      errors: Array.isArray(sourceReport.errors) ? sourceReport.errors.slice() : [],
      warnings: Array.isArray(sourceReport.warnings) ? sourceReport.warnings.slice() : [],
      reportDate: String(options.reportDate || ''),
      sourceDate: String(options.sourceDate || ''),
      rows: [],
      lineCount: 0,
      invalidLineCount: Number(sourceReport.invalidLineCount) || 0,
      totals: { lines: 0, debit: 0, credit: 0, difference: 0, balanced: true },
      accountFilter: sourceReport.accountFilter || null,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        letteringDateAvailable: false,
        foreignCurrencyAmountsAvailable: false,
        journalEntriesUsed: false
      }
    };
  }

  function build(options) {
    options = options || {};
    if (!OpeningBalanceReport || typeof OpeningBalanceReport.build !== 'function') {
      return emptyResult(options, { ok: false, errors: ['Le registre Reports à nouveau n’est pas disponible.'] });
    }
    var sourceReport = OpeningBalanceReport.build({
      accounts: Array.isArray(options.accounts) ? options.accounts : [],
      openingBalances: Array.isArray(options.openingBalances) ? options.openingBalances : [],
      accountFilter: options.accountFilter == null ? '*' : String(options.accountFilter),
      subtotals: false,
      reportDate: String(options.reportDate || ''),
      sourceDate: String(options.sourceDate || '')
    });
    if (!sourceReport.ok) return emptyResult(options, sourceReport);

    var accountsByCode = Object.create(null);
    (Array.isArray(options.accounts) ? options.accounts : []).forEach(function (account) {
      if (account && account.code != null) accountsByCode[String(account.code)] = account;
    });
    var records = Array.isArray(sourceReport.sourceRecords) ? sourceReport.sourceRecords : [];
    var rows = records.map(function (record) {
      var code = String(record.accountCode || '');
      var account = accountsByCode[code];
      return {
        accountCode: code,
        accountTitle: String(account && account.label || ''),
        date: String(record.date || ''),
        reference: String(record.reference || ''),
        letteringDate: '',
        debit: Number(record.debit) || 0,
        credit: Number(record.credit) || 0,
        currencyAmount: '',
        label: String(record.label || '')
      };
    });
    return {
      ok: true,
      errors: [],
      warnings: Array.isArray(sourceReport.warnings) ? sourceReport.warnings.slice() : [],
      reportDate: sourceReport.reportDate,
      sourceDate: sourceReport.sourceDate,
      rows: rows,
      lineCount: rows.length,
      invalidLineCount: Number(sourceReport.invalidLineCount) || 0,
      totals: {
        lines: rows.length,
        debit: Number(sourceReport.totals && sourceReport.totals.debit) || 0,
        credit: Number(sourceReport.totals && sourceReport.totals.credit) || 0,
        difference: Number(sourceReport.totals && sourceReport.totals.difference) || 0,
        balanced: !!(sourceReport.totals && sourceReport.totals.balanced)
      },
      accountFilter: sourceReport.accountFilter || null,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        letteringDateAvailable: false,
        foreignCurrencyAmountsAvailable: false,
        journalEntriesUsed: false
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
