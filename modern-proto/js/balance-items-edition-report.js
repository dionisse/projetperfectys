/*
 * PERFECTO · Édition « Postes du Bilan » issue du PDF de référence.
 * Restitution de consultation : aucune association de comptes n'est déduite.
 */
(function (root, factory) {
  'use strict';
  var data = root.PerfectoBalanceItems;
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!data) data = require('./accounting-balance-items.js');
    if (!generalBalanceReport) generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(data, generalBalanceReport);
  root.PerfectoBalanceItemsEdition = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (BalanceItems, GeneralBalanceReport) {
  'use strict';

  var REPORT_ID = 'edition-balance-items';
  var TITLE = 'Postes du Bilan';
  var COLUMNS = [
    { key: 'code', label: 'Code', text: true, defaultSelected: true },
    { key: 'accounts', label: 'Comptes', text: true, defaultSelected: true },
    { key: 'label', label: 'Intitulé', text: true, defaultSelected: true }
  ];

  function parsePostFilter(expression) {
    if (!GeneralBalanceReport || typeof GeneralBalanceReport.parseAccountFilter !== 'function') {
      return { valid: false, all: false, tokens: [], patterns: [], error: 'Le filtre des postes n’est pas disponible.' };
    }
    var parsed = GeneralBalanceReport.parseAccountFilter(expression);
    if (!parsed.valid) parsed.error = 'Indiquez un poste ou * pour sélectionner tous les postes.';
    return parsed;
  }

  function postMatches(code, parsedFilter) {
    return !!GeneralBalanceReport && GeneralBalanceReport.accountMatches(code, parsedFilter);
  }

  function sourceLineCount(post) {
    return Math.max(1, Array.isArray(post && post.accounts) ? post.accounts.length : 0);
  }

  function formatAccounts(post) {
    return Array.isArray(post && post.accounts) ? post.accounts.join('\n') : '';
  }

  function expandPost(post) {
    var sourceAccounts = Array.isArray(post.accounts) ? post.accounts : [];
    var lines = sourceAccounts.length ? sourceAccounts : [''];
    return lines.map(function (accounts, index) {
      return {
        code: index === 0 ? String(post.code == null ? '' : post.code) : '',
        accounts: String(accounts == null ? '' : accounts),
        label: index === 0 ? String(post.label == null ? '' : post.label) : '',
        postCode: String(post.code == null ? '' : post.code),
        page: Number(post.page) || null
      };
    });
  }

  function buildReport(options) {
    options = options || {};
    var records = Array.isArray(options.records)
      ? options.records
      : (BalanceItems && typeof BalanceItems.all === 'function' ? BalanceItems.all() : []);
    var expression = options.postFilter == null ? '*' : options.postFilter;
    var filter = parsePostFilter(expression);
    var errors = [];

    if (!filter.valid) errors.push(filter.error || 'Indiquez un poste ou * pour sélectionner tous les postes.');
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
        sourcePostCount: 0,
        sourceLineCount: 0,
        filters: { posts: String(expression == null ? '' : expression) },
        basis: { sourceFile: BalanceItems && BalanceItems.metadata && BalanceItems.metadata.sourceFile || '', noAccountingMutation: true }
      };
    }

    var posts = records.filter(function (post) {
      return post && postMatches(post.code, filter);
    });
    var rows = [];
    posts.forEach(function (post) { rows = rows.concat(expandPost(post)); });
    var metadata = BalanceItems && BalanceItems.metadata || {};
    var lineCount = rows.length;

    return {
      ok: true,
      reportId: REPORT_ID,
      title: TITLE,
      errors: [],
      warnings: [],
      rows: rows,
      sourceRowCount: lineCount,
      sourcePostCount: posts.length,
      sourceLineCount: lineCount,
      // Les 166 lignes du PDF plus l'en-tête donnent 167, sans ligne inventée.
      generatedLineCount: lineCount ? lineCount + 1 : 0,
      filters: { posts: String(expression == null ? '*' : expression) },
      basis: {
        sourceFile: String(metadata.sourceFile || ''),
        sourcePdfSha256: String(metadata.sourcePdfSha256 || ''),
        sourcePages: Number(metadata.sourcePages) || 0,
        sourcePostCount: posts.length,
        sourceLineCount: lineCount,
        noAccountingMutation: true
      }
    };
  }

  return Object.freeze({
    REPORT_ID: REPORT_ID,
    TITLE: TITLE,
    COLUMNS: Object.freeze(COLUMNS.map(function (column) { return Object.freeze(Object.assign({}, column)); })),
    parsePostFilter: parsePostFilter,
    postMatches: postMatches,
    sourceLineCount: sourceLineCount,
    formatAccounts: formatAccounts,
    expandPost: expandPost,
    buildReport: buildReport
  });
});
