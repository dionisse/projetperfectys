/*
 * PERFECTO · Édition « Plan comptable ».
 * Le rapport lit le plan du dossier : référentiel SYSCOHADA, ajouts et comptes
 * historiques conservés. Il ne crée ni ne modifie aucun compte ni aucune écriture.
 */
(function (root, factory) {
  'use strict';
  var chart = root.PerfectoAccountingChart;
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!chart) chart = require('./accounting-chart.js');
    if (!generalBalanceReport) generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(chart, generalBalanceReport);
  root.PerfectoAccountingPlanEdition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AccountingChart, GeneralBalanceReport) {
  'use strict';

  var REPORT_ID = 'edition-chart-of-accounts';
  var TITLE = 'Plan comptable';
  var COLUMNS = [
    { key: 'code', label: 'Numéro', text: true, defaultSelected: true },
    { key: 'label', label: 'Libellé', text: true, defaultSelected: true },
    { key: 'class', label: 'Classe', text: true, defaultSelected: true },
    { key: 'subclass', label: 'Sous-classe', text: true, defaultSelected: true },
    { key: 'usage', label: 'Nature / utilisation', text: true, defaultSelected: true },
    { key: 'nature', label: 'Type comptable', text: true, defaultSelected: true },
    { key: 'posting', label: 'Imputation', text: true, defaultSelected: true },
    { key: 'auxiliary', label: 'Auxiliaire', text: true, defaultSelected: true },
    { key: 'origin', label: 'Origine', text: true, defaultSelected: true },
    { key: 'sourcePage', label: 'Page PDF', text: true, defaultSelected: false }
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

  function compareCodes(left, right) {
    return String(left || '').localeCompare(String(right || ''), 'fr', { numeric: true });
  }

  function originLabel(account) {
    if (account && account.legacy) return 'Compte historique';
    if (account && account.standard) return 'Référentiel SYSCOHADA';
    return 'Ajout du dossier';
  }

  function rowFromAccount(account) {
    var code = String(account.code == null ? '' : account.code);
    var cls = Number(account.cls || code.charAt(0));
    var subclass = String(account.subclass || code.slice(0, 2));
    var classLabel = String(account.classLabel || (AccountingChart && AccountingChart.classLabel(cls)) || ('Classe ' + cls));
    var subclassLabel = String(account.subclassLabel || (AccountingChart && AccountingChart.SUBCLASS_LABELS[subclass]) || 'Compte du dossier');
    var referenceOnly = cls === 9;
    return {
      code: code,
      label: String(account.label == null ? '' : account.label),
      class: String(cls + ' — ' + classLabel),
      subclass: String(subclass + ' — ' + subclassLabel),
      usage: String(account.usage == null ? '' : account.usage),
      nature: String(account.nature == null ? '' : account.nature),
      posting: account.legacy ? 'Historique' : (referenceOnly ? 'Référence seule' : (account.postable === false ? 'Rubrique / indicateur' : 'Imputable')),
      auxiliary: account.aux ? 'Oui' : '—',
      origin: originLabel(account),
      sourcePage: Number(account.sourcePage) || '',
      standard: account.standard === true && !account.legacy,
      legacy: account.legacy === true,
      custom: !account.standard && !account.legacy
    };
  }

  function buildReport(options) {
    options = options || {};
    var records = Array.isArray(options.records)
      ? options.records
      : (AccountingChart && typeof AccountingChart.accounts === 'function' ? AccountingChart.accounts() : []);
    var expression = options.accountFilter == null ? '*' : options.accountFilter;
    var filter = parseAccountFilter(expression);
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
        sourceRowCount: 0,
        filters: { accounts: String(expression == null ? '' : expression) },
        basis: {
          sourceFile: AccountingChart && AccountingChart.METADATA && AccountingChart.METADATA.sourceFile || '',
          sourcePdfSha256: AccountingChart && AccountingChart.METADATA && AccountingChart.METADATA.sourcePdfSha256 || '',
          sourcePages: AccountingChart && AccountingChart.METADATA && AccountingChart.METADATA.sourcePages || 0,
          noAccountingMutation: true
        }
      };
    }

    var rows = records.filter(function (record) {
      return record && record.code != null && accountMatches(record.code, filter);
    }).map(rowFromAccount).sort(function (left, right) {
      return compareCodes(left.code, right.code);
    });
    var standardCount = rows.filter(function (row) { return row.standard; }).length;
    var customCount = rows.filter(function (row) { return row.custom; }).length;
    var legacyCount = rows.filter(function (row) { return row.legacy; }).length;
    var metadata = AccountingChart && AccountingChart.METADATA || {};

    return {
      ok: true,
      reportId: REPORT_ID,
      title: TITLE,
      errors: [],
      warnings: [],
      rows: rows,
      sourceRowCount: rows.length,
      referenceAccountCount: standardCount,
      userAddedAccountCount: customCount,
      historicalAccountCount: legacyCount,
      generatedLineCount: rows.length ? rows.length + 1 : 0,
      filters: { accounts: String(expression == null ? '*' : expression) },
      basis: {
        sourceFile: String(metadata.sourceFile || ''),
        sourcePdfSha256: String(metadata.sourcePdfSha256 || ''),
        sourcePages: Number(metadata.sourcePages) || 0,
        sourceReferenceAccountCount: Number(metadata.accountCount) || 0,
        sourceRowCount: rows.length,
        referenceAccountCount: standardCount,
        userAddedAccountCount: customCount,
        historicalAccountCount: legacyCount,
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
    compareCodes: compareCodes,
    originLabel: originLabel,
    rowFromAccount: rowFromAccount,
    buildReport: buildReport
  });
});
