/* PERFECTO · Édition du PDF source « Postes associés aux comptes ». */
(function (root, factory) {
  'use strict';
  var data = root.PerfectoAssociatedAccountItems;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function' && !data) {
    data = require('./accounting-associated-items.js');
  }
  var api = factory(data);
  root.PerfectoAssociatedAccountItemsEdition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Data) {
  'use strict';

  var REPORT_ID = 'edition-account-associated-items';
  var TITLE = 'Postes associés aux comptes';
  var COLUMNS = Object.freeze([
    Object.freeze({ key: 'account', label: 'Compte', defaultSelected: true }),
    Object.freeze({ key: 'label', label: 'Intitulé', defaultSelected: true }),
    Object.freeze({ key: 'posts', label: 'Postes', defaultSelected: true })
  ]);

  function parseAccountFilter(expression) {
    var raw = String(expression == null ? '' : expression).trim();
    if (!raw) return { valid: false, all: false, tokens: [], error: 'Saisissez un ou plusieurs comptes, ou * pour tous les comptes.' };
    if (raw === '*') return { valid: true, all: true, tokens: [] };
    var tokens = raw.split(',').map(function (token) { return token.trim(); });
    if (tokens.some(function (token) { return !/^\d{1,8}\*?$/.test(token); })) {
      return { valid: false, all: false, tokens: [], error: 'Utilisez des codes de compte, des préfixes suivis de * ou * pour tous les comptes.' };
    }
    return { valid: true, all: false, tokens: tokens };
  }

  function accountMatches(code, parsedFilter) {
    if (!parsedFilter || !parsedFilter.valid) return false;
    if (parsedFilter.all) return true;
    return parsedFilter.tokens.some(function (token) {
      if (token.charAt(token.length - 1) === '*') return String(code).indexOf(token.slice(0, -1)) === 0;
      return String(code) === token;
    });
  }

  function buildReport(options) {
    options = options || {};
    var records = Array.isArray(options.records) ? options.records : (Data ? Data.all() : []);
    var expression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var filter = parseAccountFilter(expression);
    var columnSelection = options.columns || {};
    var columns = COLUMNS.filter(function (column) { return columnSelection[column.key] !== false; });
    var errors = [];
    if (!filter.valid) errors.push(filter.error);
    if (!columns.length) errors.push('Sélectionnez au moins une colonne à imprimer.');
    if (errors.length) {
      return {
        ok: false, reportId: REPORT_ID, title: TITLE, errors: errors,
        rows: [], columns: columns, generatedLineCount: 0,
        filters: { accounts: expression },
        basis: { sourceFile: Data && Data.metadata.sourceFile || '', noDataMutation: true }
      };
    }
    var rows = records.filter(function (record) { return record && accountMatches(record.code, filter); }).map(function (record) {
      return {
        account: String(record.code == null ? '' : record.code),
        label: String(record.label == null ? '' : record.label),
        debit: String(record.debit == null ? '' : record.debit),
        credit: String(record.credit == null ? '' : record.credit),
        sourcePage: Number(record.page) || null
      };
    });
    var metadata = Data && Data.metadata || {};
    return {
      ok: true, reportId: REPORT_ID, title: TITLE, errors: [], rows: rows, columns: columns,
      generatedLineCount: rows.length ? rows.length + 1 : 0,
      sourceRowCount: rows.length,
      filters: { accounts: expression },
      basis: {
        sourceFile: String(metadata.sourceFile || ''),
        sourcePdfSha256: String(metadata.sourcePdfSha256 || ''),
        sourcePages: Number(metadata.sourcePages) || 0,
        sourceRowCount: rows.length,
        noDataMutation: true
      }
    };
  }

  return Object.freeze({
    REPORT_ID: REPORT_ID,
    TITLE: TITLE,
    COLUMNS: COLUMNS,
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    buildReport: buildReport
  });
});
