/*
 * PERFECTO · Édition « Cadre comptable » issue du référentiel SYSCOHADA révisé.
 * Les correspondances Débit/Crédit restent séparées et fidèles au PDF source.
 */
(function (root, factory) {
  'use strict';
  var framework = root.PerfectoAccountingFramework;
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!framework) framework = require('./accounting-framework.js');
    if (!generalBalanceReport) generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(framework, generalBalanceReport);
  root.PerfectoAccountingFrameworkEdition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AccountingFramework, GeneralBalanceReport) {
  'use strict';

  var REPORT_ID = 'edition-accounting-framework';
  var TITLE = 'Cadre comptable';
  var COLUMNS = [
    { key: 'code', label: 'Code', text: true, defaultSelected: true },
    { key: 'label', label: 'Intitulé', text: true, defaultSelected: true },
    { key: 'posts', label: 'Postes au bilan', text: true, defaultSelected: true }
  ];

  function parseAccountFilter(expression) {
    if (!GeneralBalanceReport || typeof GeneralBalanceReport.parseAccountFilter !== 'function') {
      return { valid: false, all: false, tokens: [], patterns: [], error: 'Le filtre des comptes n’est pas disponible.' };
    }
    return GeneralBalanceReport.parseAccountFilter(expression);
  }

  function accountMatches(code, parsedFilter) {
    return !!GeneralBalanceReport && GeneralBalanceReport.accountMatches(code, parsedFilter);
  }

  function formatBalancePosts(record) {
    record = record || {};
    var parts = [];
    if (record.debit) parts.push('Débit : <' + record.debit.code + '> ' + record.debit.label);
    if (record.credit) parts.push('Crédit : <' + record.credit.code + '> ' + record.credit.label);
    return parts.join(' ; ');
  }

  function buildReport(options) {
    options = options || {};
    var records = Array.isArray(options.records)
      ? options.records
      : (AccountingFramework && typeof AccountingFramework.all === 'function' ? AccountingFramework.all() : []);
    var filter = parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter);
    var errors = [];

    if (!filter.valid) errors.push(filter.error || 'Indiquez un compte ou * pour sélectionner tous les comptes.');

    if (errors.length) {
      return {
        ok: false,
        reportId: REPORT_ID,
        title: TITLE,
        errors: errors,
        warnings: [],
        rows: [],
        generatedLineCount: 0,
        sourceRowCount: records.length,
        filters: { accounts: String(options.accountFilter == null ? '' : options.accountFilter) },
        basis: { sourceFile: AccountingFramework && AccountingFramework.metadata && AccountingFramework.metadata.sourceFile || '', noAccountingMutation: true }
      };
    }

    var rows = records.filter(function (record) {
      return record && accountMatches(record.code, filter);
    }).map(function (record) {
      return {
        code: String(record.code == null ? '' : record.code),
        label: String(record.label == null ? '' : record.label),
        debit: record.debit || null,
        credit: record.credit || null,
        sourcePage: Number(record.page) || null
      };
    });

    var metadata = AccountingFramework && AccountingFramework.metadata || {};
    return {
      ok: true,
      reportId: REPORT_ID,
      title: TITLE,
      errors: [],
      warnings: [],
      rows: rows,
      // Le compteur de la fenêtre historique inclut la ligne des en-têtes :
      // 532 lignes source + 1 ligne de titre de colonnes = 533.
      generatedLineCount: rows.length ? rows.length + 1 : 0,
      sourceRowCount: rows.length,
      filters: { accounts: String(options.accountFilter == null ? '*' : options.accountFilter) },
      basis: {
        sourceFile: String(metadata.sourceFile || ''),
        sourcePdfSha256: String(metadata.sourcePdfSha256 || ''),
        sourcePages: Number(metadata.sourcePages) || 0,
        sourceRowCount: rows.length,
        mappedRowCount: rows.filter(function (row) { return row.debit || row.credit; }).length,
        unmappedRowCount: rows.filter(function (row) { return !row.debit && !row.credit; }).length,
        noAccountingMutation: true
      }
    };
  }

  return Object.freeze({
    REPORT_ID: REPORT_ID,
    TITLE: TITLE,
    COLUMNS: Object.freeze(COLUMNS.map(function (column) { return Object.freeze(Object.assign({}, column)); })),
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    formatBalancePosts: formatBalancePosts,
    buildReport: buildReport
  });
});
