/*
 * PERFECTO · Construction des états de journaux et de lignes comptables.
 * Fonctions pures : filtrage en lecture seule, regroupements et sérialisation.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PerfectoJournalLinesReport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var COLUMNS = [
    { key: 'date', label: 'Date', group: 0, selectable: true, defaultSelected: true },
    { key: 'piece', label: 'N° pièce', group: 0, selectable: true, defaultSelected: true },
    { key: 'account', label: 'Compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'accountTitle', label: 'Intitulé', group: 0, selectable: true, defaultSelected: true },
    { key: 'reference', label: 'Référence', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Débit', group: 1, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Crédit', group: 1, selectable: true, defaultSelected: true },
    { key: 'currency', label: 'En devise', group: 1, selectable: true, defaultSelected: false },
    { key: 'dueDate', label: 'Échéance', group: 1, selectable: true, defaultSelected: false },
    { key: 'fixedAsset', label: 'Immobilisation', group: 1, selectable: true, defaultSelected: false },
    { key: 'market', label: 'Marché', group: 2, selectable: true, defaultSelected: false },
    { key: 'analysis', label: 'Analyse diverse', group: 3, selectable: true, defaultSelected: false },
    { key: 'label', label: 'Libellé', group: 3, selectable: true, defaultSelected: true },
    { key: 'firstEntry', label: '1ère saisie', group: 3, selectable: true, defaultSelected: true },
    { key: 'lastEntry', label: 'Dernière saisie', group: 3, selectable: true, defaultSelected: false }
  ];

  var COLUMN_GROUPS = [
    [COLUMNS[0], COLUMNS[1], COLUMNS[2], COLUMNS[3], COLUMNS[4]],
    [COLUMNS[5], COLUMNS[6], COLUMNS[7], COLUMNS[8], COLUMNS[9]],
    [COLUMNS[10], null, null, null, null],
    [null, COLUMNS[11], COLUMNS[12], COLUMNS[13], COLUMNS[14]]
  ];

  var UNBALANCED_COLUMNS = [
    { key: 'date', label: 'Date', group: 0, selectable: true, defaultSelected: true },
    { key: 'line', label: 'Ligne', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Débit', group: 0, selectable: true, defaultSelected: true },
    { key: 'label', label: 'Libellé', group: 0, selectable: true, defaultSelected: true },
    { key: 'piece', label: 'N° pièce', group: 1, selectable: true, defaultSelected: true },
    { key: 'account', label: 'Compte', group: 1, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Crédit', group: 1, selectable: true, defaultSelected: true },
    { key: 'internalNumber', label: 'N° interne', group: 1, selectable: true, defaultSelected: true }
  ];

  var UNBALANCED_COLUMN_GROUPS = [
    [UNBALANCED_COLUMNS[0], UNBALANCED_COLUMNS[4]],
    [UNBALANCED_COLUMNS[1], UNBALANCED_COLUMNS[5]],
    [UNBALANCED_COLUMNS[2], UNBALANCED_COLUMNS[6]],
    [UNBALANCED_COLUMNS[3], UNBALANCED_COLUMNS[7]]
  ];

  var JOURNAL_TOTALS_COLUMNS = [
    { key: 'journalCode', label: 'Code journal', group: 0, selectable: true, defaultSelected: true },
    { key: 'journalLabel', label: 'Intitulé', group: 0, selectable: true, defaultSelected: true },
    { key: 'pieceCount', label: 'Nombre de pièces', group: 1, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 1, selectable: true, defaultSelected: false },
    { key: 'debit', label: 'Total des débits', group: 2, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Total des crédits', group: 2, selectable: true, defaultSelected: true }
  ];

  var JOURNAL_TOTALS_COLUMN_GROUPS = [
    [JOURNAL_TOTALS_COLUMNS[0], JOURNAL_TOTALS_COLUMNS[1]],
    [JOURNAL_TOTALS_COLUMNS[2], JOURNAL_TOTALS_COLUMNS[3]],
    [JOURNAL_TOTALS_COLUMNS[4], JOURNAL_TOTALS_COLUMNS[5]]
  ];

  var ACCOUNT_TOTALS_COLUMNS = [
    { key: 'accountCode', label: 'Code du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'accountTitle', label: 'Intitulé du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Total des débits', group: 1, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Total des crédits', group: 1, selectable: true, defaultSelected: true }
  ];

  var ACCOUNT_TOTALS_COLUMN_GROUPS = [
    [ACCOUNT_TOTALS_COLUMNS[0], ACCOUNT_TOTALS_COLUMNS[1], ACCOUNT_TOTALS_COLUMNS[2]],
    [ACCOUNT_TOTALS_COLUMNS[3], ACCOUNT_TOTALS_COLUMNS[4]]
  ];

  var SUMMARY_ACCOUNT_TOTALS_COLUMNS = [
    { key: 'accountCode', label: 'Code du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'accountTitle', label: 'Intitulé du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Total des débits', group: 1, selectable: true, defaultSelected: false },
    { key: 'credit', label: 'Total des crédits', group: 1, selectable: true, defaultSelected: true }
  ];

  var SUMMARY_ACCOUNT_TOTALS_COLUMN_GROUPS = [
    [SUMMARY_ACCOUNT_TOTALS_COLUMNS[0], SUMMARY_ACCOUNT_TOTALS_COLUMNS[1], SUMMARY_ACCOUNT_TOTALS_COLUMNS[2]],
    [SUMMARY_ACCOUNT_TOTALS_COLUMNS[3], SUMMARY_ACCOUNT_TOTALS_COLUMNS[4]]
  ];

  var THIRD_PARTY_TOTALS_COLUMNS = [
    { key: 'accountCode', label: 'Code du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'accountTitle', label: 'Intitulé du compte', group: 0, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Total des débits', group: 1, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Total des crédits', group: 1, selectable: true, defaultSelected: true }
  ];

  var THIRD_PARTY_TOTALS_COLUMN_GROUPS = [
    [THIRD_PARTY_TOTALS_COLUMNS[0], THIRD_PARTY_TOTALS_COLUMNS[1], THIRD_PARTY_TOTALS_COLUMNS[2]],
    [THIRD_PARTY_TOTALS_COLUMNS[3], THIRD_PARTY_TOTALS_COLUMNS[4]]
  ];

  var ANALYTICAL_CENTER_TOTALS_COLUMNS = [
    { key: 'analyticCode', label: 'Code analytique', group: 0, selectable: true, defaultSelected: true },
    { key: 'analyticTitle', label: 'Intitulé', group: 0, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 0, selectable: true, defaultSelected: true },
    { key: 'debit', label: 'Total des débits', group: 1, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Total des crédits', group: 1, selectable: true, defaultSelected: true }
  ];

  var ANALYTICAL_CENTER_TOTALS_COLUMN_GROUPS = [
    [ANALYTICAL_CENTER_TOTALS_COLUMNS[0], ANALYTICAL_CENTER_TOTALS_COLUMNS[1], ANALYTICAL_CENTER_TOTALS_COLUMNS[2]],
    [ANALYTICAL_CENTER_TOTALS_COLUMNS[3], ANALYTICAL_CENTER_TOTALS_COLUMNS[4]]
  ];

  var CURRENCY_TOTALS_COLUMNS = [
    { key: 'currencyCode', label: 'Code devise', group: 0, selectable: true, defaultSelected: true },
    { key: 'currencyTitle', label: 'Intitulé de la devise', group: 0, selectable: true, defaultSelected: true },
    { key: 'pieceCount', label: 'Nombre de pièces', group: 1, selectable: true, defaultSelected: true },
    { key: 'lineCount', label: 'Nombre de lignes', group: 1, selectable: true, defaultSelected: false },
    { key: 'debit', label: 'Total des débits', group: 2, selectable: true, defaultSelected: true },
    { key: 'credit', label: 'Total des crédits', group: 2, selectable: true, defaultSelected: true }
  ];

  var CURRENCY_TOTALS_COLUMN_GROUPS = [
    [CURRENCY_TOTALS_COLUMNS[0], CURRENCY_TOTALS_COLUMNS[1]],
    [CURRENCY_TOTALS_COLUMNS[2], CURRENCY_TOTALS_COLUMNS[3]],
    [CURRENCY_TOTALS_COLUMNS[4], CURRENCY_TOTALS_COLUMNS[5]]
  ];

  function columnsForReport(reportType) {
    var columns = reportType === 'unbalanced'
      ? UNBALANCED_COLUMNS
      : (reportType === 'totals'
        ? JOURNAL_TOTALS_COLUMNS
        : (reportType === 'account-totals'
          ? ACCOUNT_TOTALS_COLUMNS
          : (reportType === 'summary-account-totals'
            ? SUMMARY_ACCOUNT_TOTALS_COLUMNS
            : (reportType === 'third-party-totals'
              ? THIRD_PARTY_TOTALS_COLUMNS
              : (reportType === 'analytic-center-totals'
                ? ANALYTICAL_CENTER_TOTALS_COLUMNS
                : (reportType === 'currency-totals' ? CURRENCY_TOTALS_COLUMNS : COLUMNS))))));
    return columns.map(function (column) { return Object.assign({}, column); });
  }

  function columnGroupsForReport(reportType) {
    var groups = reportType === 'unbalanced'
      ? UNBALANCED_COLUMN_GROUPS
      : (reportType === 'totals'
        ? JOURNAL_TOTALS_COLUMN_GROUPS
        : (reportType === 'account-totals'
          ? ACCOUNT_TOTALS_COLUMN_GROUPS
          : (reportType === 'summary-account-totals'
            ? SUMMARY_ACCOUNT_TOTALS_COLUMN_GROUPS
            : (reportType === 'third-party-totals'
              ? THIRD_PARTY_TOTALS_COLUMN_GROUPS
              : (reportType === 'analytic-center-totals'
                ? ANALYTICAL_CENTER_TOTALS_COLUMN_GROUPS
                : (reportType === 'currency-totals' ? CURRENCY_TOTALS_COLUMN_GROUPS : COLUMN_GROUPS))))));
    return groups.map(function (group) {
      return group.map(function (column) { return column ? Object.assign({}, column) : null; });
    });
  }

  function asSet(values) {
    return new Set((Array.isArray(values) ? values : []).map(function (value) { return String(value); }));
  }

  function compare(a, b) {
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'fr', { numeric: true, sensitivity: 'base' });
  }

  function safeAmount(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function lineValue(key, entry, line, account, lineIndex) {
    switch (key) {
      case 'date': return entry.date || '';
      case 'piece': return entry.reference || '';
      case 'line': return lineIndex + 1;
      case 'account': return line.account || '';
      case 'accountTitle': return account && account.label || line.account || '';
      case 'reference': return line.reference || entry.sourceReference || '';
      case 'debit': return safeAmount(line.debit);
      case 'credit': return safeAmount(line.credit);
      case 'currency': return line.currencyCode || entry.currencyCode || '';
      case 'dueDate': return line.dueDate || entry.dueDate || '';
      case 'fixedAsset': return line.fixedAssetCode || line.assetCode || entry.fixedAssetCode || '';
      case 'market': return line.market || entry.market || '';
      case 'analysis': return line.analyticCode || line.analysis || entry.analysis || '';
      case 'label': return line.description || entry.description || '';
      case 'internalNumber':
        return line.internalNumber != null ? line.internalNumber : (entry.internalNumber != null ? entry.internalNumber : '');
      case 'firstEntry': return entry.createdAt || '';
      case 'lastEntry': return entry.updatedAt || '';
      default: return '';
    }
  }

  function makeCells(columns, entry, line, account, lineIndex) {
    var cells = {};
    columns.forEach(function (column) {
      cells[column.key] = lineValue(column.key, entry, line, account, lineIndex);
    });
    return cells;
  }

  function subtotalRow(columns, kind, label, reference, date, debit, credit) {
    var cells = {};
    var labelColumn = columns.find(function (column) { return column.key !== 'debit' && column.key !== 'credit'; });
    columns.forEach(function (column) {
      if (labelColumn && column.key === labelColumn.key) cells[column.key] = label;
      else if (column.key === 'debit') cells[column.key] = debit;
      else if (column.key === 'credit') cells[column.key] = credit;
      else cells[column.key] = '';
    });
    return { kind: kind, label: label, reference: reference || '', date: date || '', debit: debit, credit: credit, cells: cells };
  }

  function buildJournalTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var journalByCode = new Map(journals.map(function (journal) { return [String(journal.code), journal]; }));
    var selectedKeys = Array.isArray(options.columns) ? options.columns : JOURNAL_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = JOURNAL_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByJournal = new Map();

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted') return;
      var entryDate = String(entry.date || '');
      if (from && entryDate < from) return;
      if (to && entryDate > to) return;
      var code = String(entry.journal || '');
      if (selectedJournals.size && !selectedJournals.has(code)) return;
      var lines = (Array.isArray(entry.lines) ? entry.lines : []).filter(Boolean);
      var journalTotal = totalsByJournal.get(code);
      if (!journalTotal) {
        journalTotal = { code: code, pieceCount: 0, lineCount: 0, debitUnits: 0, creditUnits: 0 };
        totalsByJournal.set(code, journalTotal);
      }
      journalTotal.pieceCount += 1;
      journalTotal.lineCount += lines.length;
      lines.forEach(function (line) {
        journalTotal.debitUnits += Math.round(safeAmount(line.debit) * precision);
        journalTotal.creditUnits += Math.round(safeAmount(line.credit) * precision);
      });
    });

    var entryCount = 0;
    var lineCount = 0;
    var rows = Array.from(totalsByJournal.values()).sort(function (a, b) {
      return compare(a.code, b.code);
    }).map(function (journalTotal) {
      var journal = journalByCode.get(journalTotal.code);
      var journalLabel = journal && journal.label ? String(journal.label) : '';
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'journalCode': cells[column.key] = journalTotal.code; break;
          case 'journalLabel': cells[column.key] = journalLabel; break;
          case 'pieceCount': cells[column.key] = journalTotal.pieceCount; break;
          case 'lineCount': cells[column.key] = journalTotal.lineCount; break;
          case 'debit': cells[column.key] = journalTotal.debitUnits / precision; break;
          case 'credit': cells[column.key] = journalTotal.creditUnits / precision; break;
        }
      });
      entryCount += journalTotal.pieceCount;
      lineCount += journalTotal.lineCount;
      return { kind: 'line', cells: cells };
    });
    var groups = rows.length ? [{
      code: '',
      title: 'Cumul par journal',
      entryCount: entryCount,
      lineCount: lineCount,
      rows: rows
    }] : [];
    return { columns: columns, groups: groups, entryCount: entryCount, lineCount: lineCount, journalCount: totalsByJournal.size };
  }

  function buildAccountTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var selectedAccounts = asSet(filters.accounts);
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var accountByCode = new Map(accounts.map(function (account) { return [String(account.code), account]; }));
    var selectedKeys = Array.isArray(options.columns) ? options.columns : ACCOUNT_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = ACCOUNT_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByAccount = new Map();

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted') return;
      var entryDate = String(entry.date || '');
      if (from && entryDate < from) return;
      if (to && entryDate > to) return;
      if (selectedJournals.size && !selectedJournals.has(String(entry.journal || ''))) return;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
        if (!line) return;
        var code = String(line.account || '').trim();
        if (!code || (selectedAccounts.size && !selectedAccounts.has(code))) return;
        var accountTotal = totalsByAccount.get(code);
        if (!accountTotal) {
          accountTotal = { code: code, lineCount: 0, debitUnits: 0, creditUnits: 0 };
          totalsByAccount.set(code, accountTotal);
        }
        accountTotal.lineCount += 1;
        accountTotal.debitUnits += Math.round(safeAmount(line.debit) * precision);
        accountTotal.creditUnits += Math.round(safeAmount(line.credit) * precision);
      });
    });

    var lineCount = 0;
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var rows = Array.from(totalsByAccount.values()).sort(function (a, b) {
      return compare(a.code, b.code);
    }).map(function (accountTotal) {
      var account = accountByCode.get(accountTotal.code) || null;
      var debit = accountTotal.debitUnits / precision;
      var credit = accountTotal.creditUnits / precision;
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'accountCode': cells[column.key] = accountTotal.code; break;
          case 'accountTitle': cells[column.key] = account && account.label || ''; break;
          case 'lineCount': cells[column.key] = accountTotal.lineCount; break;
          case 'debit': cells[column.key] = debit; break;
          case 'credit': cells[column.key] = credit; break;
        }
      });
      lineCount += accountTotal.lineCount;
      totalDebitUnits += accountTotal.debitUnits;
      totalCreditUnits += accountTotal.creditUnits;
      return { kind: 'line', cells: cells };
    });
    var accountCount = totalsByAccount.size;
    var groups = rows.length ? [{
      code: 'accounts',
      title: 'Cumul par comptes individuels',
      accountCount: accountCount,
      lineCount: lineCount,
      rows: rows
    }] : [];
    return {
      columns: columns,
      groups: groups,
      accountCount: accountCount,
      lineCount: lineCount,
      totalDebit: totalDebitUnits / precision,
      totalCredit: totalCreditUnits / precision
    };
  }

  function summaryAccountTitle(code, level, accountByCode, sourceAccount) {
    var exactAccount = accountByCode.get(code);
    if (exactAccount && exactAccount.label) return String(exactAccount.label);
    if (level === 1) return String(sourceAccount && sourceAccount.classLabel || '');
    if (level === 2) {
      var subclassLabel = String(sourceAccount && sourceAccount.subclassLabel || '');
      return subclassLabel === 'Comptes personnalisés' ? '' : subclassLabel;
    }
    return '';
  }

  function buildSummaryAccountTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var level = Number(filters.summaryLevel);
    if (!Number.isInteger(level) || level < 1 || level > 8) level = 1;
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var accountByCode = new Map(accounts.map(function (account) { return [String(account.code), account]; }));
    var selectedKeys = Array.isArray(options.columns) ? options.columns : SUMMARY_ACCOUNT_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = SUMMARY_ACCOUNT_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByAccount = new Map();

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted') return;
      var entryDate = String(entry.date || '');
      if (from && entryDate < from) return;
      if (to && entryDate > to) return;
      if (selectedJournals.size && !selectedJournals.has(String(entry.journal || ''))) return;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
        if (!line) return;
        var sourceCode = String(line.account || '').trim();
        if (!sourceCode) return;
        var summaryCode = sourceCode.slice(0, Math.min(level, sourceCode.length));
        var summary = totalsByAccount.get(summaryCode);
        if (!summary) {
          summary = { code: summaryCode, lineCount: 0, debitUnits: 0, creditUnits: 0, sourceAccount: accountByCode.get(sourceCode) || null };
          totalsByAccount.set(summaryCode, summary);
        }
        summary.lineCount += 1;
        summary.debitUnits += Math.round(safeAmount(line.debit) * precision);
        summary.creditUnits += Math.round(safeAmount(line.credit) * precision);
      });
    });

    var lineCount = 0;
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var rows = Array.from(totalsByAccount.values()).sort(function (a, b) {
      return compare(a.code, b.code);
    }).map(function (summary) {
      var debit = summary.debitUnits / precision;
      var credit = summary.creditUnits / precision;
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'accountCode': cells[column.key] = summary.code; break;
          case 'accountTitle': cells[column.key] = summaryAccountTitle(summary.code, level, accountByCode, summary.sourceAccount); break;
          case 'lineCount': cells[column.key] = summary.lineCount; break;
          case 'debit': cells[column.key] = debit; break;
          case 'credit': cells[column.key] = credit; break;
        }
      });
      lineCount += summary.lineCount;
      totalDebitUnits += summary.debitUnits;
      totalCreditUnits += summary.creditUnits;
      return { kind: 'line', cells: cells };
    });
    var accountCount = totalsByAccount.size;
    var groups = rows.length ? [{
      code: 'summary-accounts',
      title: 'Cumul par comptes de synthèse · niveau ' + level,
      accountCount: accountCount,
      lineCount: lineCount,
      rows: rows
    }] : [];
    return {
      columns: columns,
      groups: groups,
      accountCount: accountCount,
      lineCount: lineCount,
      summaryLevel: level,
      totalDebit: totalDebitUnits / precision,
      totalCredit: totalCreditUnits / precision
    };
  }

  function normalizeAnalyticalCenterReference(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
  }

  function analyticalCenterReferences(line, sourceLine) {
    var referenceKey = /^(?:analyticalCenter|analytical_center|analyticCenter|analytic_center|analysisCenter|analysis_center)(?:\w*(?:id|code))?$/i;
    var references = [];
    var invalid = false;
    [line, sourceLine].forEach(function (source) {
      if (!source || typeof source !== 'object' || Array.isArray(source)) return;
      Object.keys(source).forEach(function (key) {
        if (!referenceKey.test(key)) return;
        var value = source[key];
        if (value == null || value === '') return;
        if (typeof value !== 'string' && typeof value !== 'number') {
          invalid = true;
          return;
        }
        var normalized = normalizeAnalyticalCenterReference(value);
        if (normalized && references.indexOf(normalized) === -1) references.push(normalized);
      });
    });
    return { values: references, invalid: invalid };
  }

  function buildAnalyticalCenterTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var selectedCenters = new Set((Array.isArray(filters.analyticalCenters) ? filters.analyticalCenters : []).map(normalizeAnalyticalCenterReference));
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var natureId = String(filters.analyticalNature || '');
    var natureLabel = String(filters.analyticalNatureLabel || 'Centres de responsabilité');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var centers = Array.isArray(options.analyticalCenters) ? options.analyticalCenters : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var centerByReference = new Map();
    var selectedKeys = Array.isArray(options.columns) ? options.columns : ANALYTICAL_CENTER_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = ANALYTICAL_CENTER_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByCenter = new Map();
    var unallocatedTotals = { lineCount: 0, debitUnits: 0, creditUnits: 0 };

    function registerReference(reference, center) {
      var normalized = normalizeAnalyticalCenterReference(reference);
      if (!normalized) return;
      if (centerByReference.has(normalized) && centerByReference.get(normalized) !== center) {
        centerByReference.set(normalized, null);
        return;
      }
      if (centerByReference.get(normalized) !== null) centerByReference.set(normalized, center);
    }

    centers.forEach(function (center) {
      if (!center) return;
      registerReference(center.id, center);
      registerReference(center.code, center);
    });

    if (natureId === 'responsibility-centers') {
      entries.forEach(function (entry) {
        if (!entry || entry.status !== 'posted') return;
        var date = String(entry.date || '');
        if (from && date < from) return;
        if (to && date > to) return;
        var journal = String(entry.journal || '');
        if (selectedJournals.size && !selectedJournals.has(journal)) return;
        var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
          if (!line || typeof line !== 'object') return;
          var debit = Number(line.debit);
          var credit = Number(line.credit);
          if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
              (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) return;

          function addCenterAmount(center, amount) {
            if (!center || !center.code || !Number.isFinite(amount) || amount <= 0) return;
            var centerCode = String(center.code).trim();
            if (!centerCode || (selectedCenters.size && !selectedCenters.has(normalizeAnalyticalCenterReference(centerCode)))) return;
            var total = totalsByCenter.get(centerCode);
            if (!total) {
              total = { center: center, lineCount: 0, debitUnits: 0, creditUnits: 0 };
              totalsByCenter.set(centerCode, total);
            }
            total.lineCount += 1;
            if (debit > 0) total.debitUnits += Math.round(amount * precision);
            else total.creditUnits += Math.round(amount * precision);
          }

          var analyticalSplits = Array.isArray(line.analyticSplits) ? line.analyticSplits : [];
          var centerSplits = analyticalSplits.filter(function (split) {
            return split && split.natureId === natureId;
          });
          if (centerSplits.length) {
            centerSplits.forEach(function (split) {
              (Array.isArray(split.allocations) ? split.allocations : []).forEach(function (allocation) {
                if (!allocation) return;
                var reference = normalizeAnalyticalCenterReference(allocation.centerId || '');
                var center = reference && centerByReference.has(reference) ? centerByReference.get(reference) : null;
                addCenterAmount(center, Number(allocation.amount));
              });
              var unallocatedAmount = Number(split.unallocatedAmount);
              if (Number.isFinite(unallocatedAmount) && unallocatedAmount > 0) {
                unallocatedTotals.lineCount += 1;
                if (debit > 0) unallocatedTotals.debitUnits += Math.round(unallocatedAmount * precision);
                else unallocatedTotals.creditUnits += Math.round(unallocatedAmount * precision);
              }
            });
            return;
          }

          // Compatibilité historique : les références explicites antérieures restent consultables.
          var references = analyticalCenterReferences(line, sourceLines[lineIndex] || {});
          if (references.invalid || !references.values.length) return;
          var legacyCenter = null;
          for (var refIndex = 0; refIndex < references.values.length; refIndex += 1) {
            var legacyReference = references.values[refIndex];
            if (!centerByReference.has(legacyReference)) return;
            var matched = centerByReference.get(legacyReference);
            if (!matched || (legacyCenter && legacyCenter !== matched)) return;
            legacyCenter = matched;
          }
          if (legacyCenter) addCenterAmount(legacyCenter, debit || credit);
        });
      });
    }

    var lineCount = 0;
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var rows = Array.from(totalsByCenter.values()).sort(function (a, b) {
      return compare(a.center.code, b.center.code);
    }).map(function (total) {
      var debit = total.debitUnits / precision;
      var credit = total.creditUnits / precision;
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'analyticCode': cells[column.key] = String(total.center.code || ''); break;
          case 'analyticTitle': cells[column.key] = String(total.center.name || ''); break;
          case 'lineCount': cells[column.key] = total.lineCount; break;
          case 'debit': cells[column.key] = debit; break;
          case 'credit': cells[column.key] = credit; break;
        }
      });
      lineCount += total.lineCount;
      totalDebitUnits += total.debitUnits;
      totalCreditUnits += total.creditUnits;
      return { kind: 'line', cells: cells };
    });
    var centerCount = totalsByCenter.size;
    var groups = rows.length ? [{
      code: 'analytical-centers',
      title: 'Cumul des saisies · ' + natureLabel,
      centerCount: centerCount,
      lineCount: lineCount,
      rows: rows
    }] : [];
    var unallocatedDebit = unallocatedTotals.debitUnits / precision;
    var unallocatedCredit = unallocatedTotals.creditUnits / precision;
    if (unallocatedTotals.lineCount) {
      var unallocatedCells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'analyticCode': unallocatedCells[column.key] = ''; break;
          case 'analyticTitle': unallocatedCells[column.key] = 'À ventiler (sans centre)'; break;
          case 'lineCount': unallocatedCells[column.key] = unallocatedTotals.lineCount; break;
          case 'debit': unallocatedCells[column.key] = unallocatedDebit; break;
          case 'credit': unallocatedCells[column.key] = unallocatedCredit; break;
        }
      });
      groups.push({
        code: 'analytical-unallocated',
        title: 'Écarts · montants non attribués à un centre',
        centerCount: 0,
        lineCount: unallocatedTotals.lineCount,
        rows: [{ kind: 'line', cells: unallocatedCells }]
      });
    }
    return {
      columns: columns,
      groups: groups,
      centerCount: centerCount,
      lineCount: lineCount,
      analyticalNature: natureId,
      analyticalNatureLabel: natureLabel,
      totalDebit: totalDebitUnits / precision,
      totalCredit: totalCreditUnits / precision,
      unallocatedLineCount: unallocatedTotals.lineCount,
      unallocatedDebit: unallocatedDebit,
      unallocatedCredit: unallocatedCredit
    };
  }

  function normalizeAnalyticalMovementSearch(value) {
    return String(value == null ? '' : value).trim().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLocaleUpperCase();
  }

  var ANALYTICAL_MOVEMENT_COLUMNS = [
    { key: 'date', label: 'Date' },
    { key: 'journal', label: 'Journal' },
    { key: 'piece', label: 'N° pièce' },
    { key: 'account', label: 'Compte' },
    { key: 'accountTitle', label: 'Intitulé du compte' },
    { key: 'destination', label: 'Centre / valeur analytique' },
    { key: 'mode', label: 'Mode' },
    { key: 'enteredValue', label: 'Valeur saisie' },
    { key: 'debit', label: 'Débit analytique' },
    { key: 'credit', label: 'Crédit analytique' },
    { key: 'status', label: 'État' }
  ];

  function buildAnalyticalMovements(options) {
    options = options || {};
    var filters = options.filters || {};
    var natureId = String(filters.analyticalNature || '');
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var selectedJournal = String(filters.journal || '');
    var selectedCenterId = String(filters.centerId || '');
    var search = normalizeAnalyticalMovementSearch(filters.search || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var centers = Array.isArray(options.analyticalCenters) ? options.analyticalCenters : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var natures = Array.isArray(options.analyticalNatures) ? options.analyticalNatures : [];
    var centerByReference = new Map();
    var centerById = new Map();
    var accountByCode = new Map(accounts.map(function (account) { return [String(account.code || ''), account]; }));
    var nature = natures.find(function (record) { return record && record.id === natureId && !record.group; }) || null;
    var errors = [];
    var rows = [];
    var sourceLineKeys = new Set();
    var unallocated = { lineCount: 0, debitUnits: 0, creditUnits: 0 };
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var unmatchedCenterCount = 0;
    var unclassifiedAllocationCount = 0;

    function registerCenter(reference, center) {
      var key = normalizeAnalyticalCenterReference(reference);
      if (!key) return;
      if (centerByReference.has(key) && centerByReference.get(key) !== center) centerByReference.set(key, null);
      else if (centerByReference.get(key) !== null) centerByReference.set(key, center);
    }
    centers.forEach(function (center) {
      if (!center) return;
      centerById.set(String(center.id || ''), center);
      registerCenter(center.id, center);
      registerCenter(center.code, center);
    });

    if (!natureId || !nature) errors.push('Choisissez une nature analytique valide pour consulter ses mouvements.');
    if (from && to && from > to) errors.push('La période est inversée : la date de début doit précéder la date de fin.');
    if (cycleStart && from && from < cycleStart || cycleEnd && to && to > cycleEnd) errors.push('La période sélectionnée doit rester comprise dans le cycle du dossier (' + cycleStart + ' au ' + cycleEnd + ').');

    if (!errors.length && natureId === 'responsibility-centers') {
      entries.forEach(function (entry, entryIndex) {
        if (!entry || entry.status !== 'posted') return;
        var date = String(entry.date || '');
        if (from && date < from || to && date > to) return;
        if (selectedJournal && String(entry.journal || '') !== selectedJournal) return;
        var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
          if (!line || typeof line !== 'object') return;
          var debit = Number(line.debit);
          var credit = Number(line.credit);
          if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
              (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) return;
          var accountCode = String(line.account || '').trim();
          var account = accountByCode.get(accountCode) || null;
          var lineKey = String(entry.id || entryIndex) + ':' + lineIndex;
          var matchingSplits = (Array.isArray(line.analyticSplits) ? line.analyticSplits : []).filter(function (split) { return split && split.natureId === natureId; });

          function addRow(center, destination, enteredValue, mode, analyticAmount, status, isUnallocated) {
            analyticAmount = Number(analyticAmount);
            if (!Number.isFinite(analyticAmount) || analyticAmount <= 0) return;
            var centerId = center ? String(center.id || '') : '';
            if (!isUnallocated && selectedCenterId && centerId !== selectedCenterId) return;
            var searchText = normalizeAnalyticalMovementSearch([
              date, entry.journal, entry.reference, accountCode, account && account.label,
              destination, nature.genericName, nature.individualName
            ].join(' '));
            if (search && searchText.indexOf(search) === -1) return;
            var units = Math.round(analyticAmount * precision);
            var debitUnits = debit > 0 ? units : 0;
            var creditUnits = credit > 0 ? units : 0;
            var cells = {
              date: date,
              journal: String(entry.journal || ''),
              piece: String(entry.reference || ''),
              account: accountCode,
              accountTitle: String(account && account.label || ''),
              destination: destination,
              mode: mode,
              enteredValue: enteredValue == null ? '' : String(enteredValue),
              debit: debitUnits / precision,
              credit: creditUnits / precision,
              status: status
            };
            rows.push({ kind: 'line', entry: entry, line: line, center: center, cells: cells });
            sourceLineKeys.add(lineKey);
            if (isUnallocated) {
              unallocated.lineCount += 1;
              unallocated.debitUnits += debitUnits;
              unallocated.creditUnits += creditUnits;
            } else {
              totalDebitUnits += debitUnits;
              totalCreditUnits += creditUnits;
            }
          }

          if (matchingSplits.length) {
            matchingSplits.forEach(function (split) {
              (Array.isArray(split.allocations) ? split.allocations : []).forEach(function (allocation) {
                if (!allocation) return;
                var ref = normalizeAnalyticalCenterReference(allocation.centerId || '');
                var center = ref && centerByReference.has(ref) ? centerByReference.get(ref) : null;
                if (!center || (allocation.centerCode && allocation.centerCode !== center.code) || (allocation.centerName && allocation.centerName !== center.name)) {
                  unmatchedCenterCount += 1;
                  return;
                }
                addRow(center, String(center.code || '') + ' · ' + String(center.name || ''), allocation.value, split.mode === 'percentage' ? 'Pourcentage' : 'Montant', allocation.amount, 'Ventilé', false);
              });
              var remaining = Number(split.unallocatedAmount);
              if (Number.isFinite(remaining) && remaining > 0) addRow(null, 'À ventiler (sans centre)', '', split.mode === 'percentage' ? 'Pourcentage' : 'Montant', remaining, 'À ventiler', true);
            });
            return;
          }

          // Les références historiques explicites restent visibles ; aucune correspondance partielle n’est retenue.
          var legacy = analyticalCenterReferences(line, sourceLines[lineIndex] || {});
          if (legacy.invalid || !legacy.values.length) return;
          var legacyCenter = null;
          for (var refIndex = 0; refIndex < legacy.values.length; refIndex += 1) {
            var legacyReference = legacy.values[refIndex];
            if (!centerByReference.has(legacyReference)) return;
            var candidate = centerByReference.get(legacyReference);
            if (!candidate || legacyCenter && legacyCenter !== candidate) return;
            legacyCenter = candidate;
          }
          if (legacyCenter) addRow(legacyCenter, legacyCenter.code + ' · ' + legacyCenter.name, '', 'Historique', debit || credit, 'Référence historique', false);
        });
      });
    } else if (!errors.length) {
      entries.forEach(function (entry, entryIndex) {
        if (!entry || entry.status !== 'posted') return;
        var date = String(entry.date || '');
        if (from && date < from || to && date > to) return;
        if (selectedJournal && String(entry.journal || '') !== selectedJournal) return;
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
          var debit = Number(line && line.debit);
          var credit = Number(line && line.credit);
          if (!line || !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) return;
          var accountCode = String(line.account || '').trim();
          var account = accountByCode.get(accountCode) || null;
          (Array.isArray(line.analyticSplits) ? line.analyticSplits : []).filter(function (split) { return split && split.natureId === natureId; }).forEach(function (split) {
            (Array.isArray(split.allocations) ? split.allocations : []).forEach(function (allocation) {
              var destination = String(allocation && allocation.valueLabel || '').trim();
              var analyticAmount = Number(allocation && allocation.amount);
              if (!destination || !Number.isFinite(analyticAmount) || analyticAmount <= 0) {
                unclassifiedAllocationCount += 1;
                return;
              }
              var searchText = normalizeAnalyticalMovementSearch([date, entry.journal, entry.reference, accountCode, account && account.label, destination, nature.genericName, nature.individualName].join(' '));
              if (search && searchText.indexOf(search) === -1) return;
              var units = Math.round(analyticAmount * precision);
              var cells = {
                date: date, journal: String(entry.journal || ''), piece: String(entry.reference || ''), account: accountCode,
                accountTitle: String(account && account.label || ''), destination: destination,
                mode: split.mode === 'percentage' ? 'Pourcentage' : 'Montant',
                enteredValue: allocation.value == null ? '' : String(allocation.value),
                debit: debit > 0 ? units / precision : 0,
                credit: credit > 0 ? units / precision : 0,
                status: 'Ventilé'
              };
              rows.push({ kind: 'line', entry: entry, line: line, cells: cells });
              sourceLineKeys.add(String(entry.id || entryIndex) + ':' + lineIndex);
              if (debit > 0) totalDebitUnits += units;
              else totalCreditUnits += units;
            });
            var remaining = Number(split.unallocatedAmount);
            if (Number.isFinite(remaining) && remaining > 0) {
              var units = Math.round(remaining * precision);
              var remainingSearch = normalizeAnalyticalMovementSearch([date, entry.journal, entry.reference, accountCode, account && account.label, nature.genericName, nature.individualName].join(' '));
              if (!search || remainingSearch.indexOf(search) !== -1) {
                rows.push({ kind: 'line', entry: entry, line: line, cells: {
                  date: date, journal: String(entry.journal || ''), piece: String(entry.reference || ''), account: accountCode,
                  accountTitle: String(account && account.label || ''), destination: 'À ventiler (sans centre)',
                  mode: split.mode === 'percentage' ? 'Pourcentage' : 'Montant', enteredValue: '',
                  debit: debit > 0 ? units / precision : 0, credit: credit > 0 ? units / precision : 0, status: 'À ventiler'
                }});
                unallocated.lineCount += 1;
                if (debit > 0) unallocated.debitUnits += units;
                else unallocated.creditUnits += units;
              }
            }
          });
        });
      });
    }

    rows.sort(function (left, right) {
      return compare(left.cells.date, right.cells.date) || compare(left.cells.journal, right.cells.journal) || compare(left.cells.piece, right.cells.piece) || compare(left.cells.account, right.cells.account) || compare(left.cells.destination, right.cells.destination);
    });
    var columns = ANALYTICAL_MOVEMENT_COLUMNS.map(function (column) { return Object.assign({}, column); });
    var unallocatedDebit = unallocated.debitUnits / precision;
    var unallocatedCredit = unallocated.creditUnits / precision;
    var groups = rows.length ? [{
      code: 'analytical-movements',
      title: 'Mouvements analytiques · ' + String(nature && (nature.individualName || nature.genericName) || ''),
      rows: rows
    }] : [];
    var allocationRows = rows.filter(function (row) { return row.cells.status === 'Ventilé'; });
    return {
      columns: columns,
      groups: groups,
      errors: errors,
      rowCount: rows.length,
      sourceLineCount: sourceLineKeys.size,
      allocationCount: allocationRows.length,
      totalDebit: totalDebitUnits / precision,
      totalCredit: totalCreditUnits / precision,
      unallocatedLineCount: unallocated.lineCount,
      unallocatedDebit: unallocatedDebit,
      unallocatedCredit: unallocatedCredit,
      unmatchedCenterCount: unmatchedCenterCount,
      unclassifiedAllocationCount: unclassifiedAllocationCount,
      analyticalNature: natureId,
      analyticalNatureLabel: nature ? String(nature.individualName || nature.genericName || '') : ''
    };
  }

  function buildAnalyticalStatement(options) {
    options = options || {};
    var reportType = String(options.reportType || '');
    var movements = buildAnalyticalMovements(options);
    var natureLabel = movements.analyticalNatureLabel || '';
    if (movements.errors.length) return Object.assign({}, movements, { reportType: reportType });
    var sourceRows = movements.groups.reduce(function (result, group) { return result.concat(group.rows || []); }, []);
    var assignedRows = sourceRows.filter(function (row) { return row.cells.status !== 'À ventiler'; });
    var unallocatedRows = sourceRows.filter(function (row) { return row.cells.status === 'À ventiler'; });
    var detailTypes = ['analytic-ledger', 'analytic-other-nature-ledger'];
    var columns;
    var grouped = [];

    if (detailTypes.indexOf(reportType) !== -1) {
      columns = movements.columns.map(function (column) { return Object.assign({}, column); });
      grouped = assignedRows.map(function (row) { return row.cells; });
    } else {
      var groupKind = reportType === 'analytic-center-balance' || reportType === 'analytic-center-situation'
        ? 'center'
        : (reportType === 'analytic-general-account-balance' ? 'account' : 'nature-account');
      var groupsByKey = new Map();
      assignedRows.forEach(function (record) {
        var cells = record.cells;
        var key = groupKind === 'center'
          ? String(record.center && record.center.id || cells.destination)
          : (groupKind === 'account'
            ? String(cells.account || '')
            : String(cells.destination || '') + '\u001f' + String(cells.account || ''));
        var bucket = groupsByKey.get(key);
        if (!bucket) {
          bucket = {
            center: record.center || null,
            destination: cells.destination,
            account: cells.account,
            accountTitle: cells.accountTitle,
            sourceLines: new Set(),
            debitUnits: 0,
            creditUnits: 0
          };
          groupsByKey.set(key, bucket);
        }
        var entryId = String(record.entry && record.entry.id || record.cells.piece || '');
        var lineIndex = record.entry && Array.isArray(record.entry.lines) ? record.entry.lines.indexOf(record.line) : -1;
        bucket.sourceLines.add(entryId + ':' + lineIndex);
        bucket.debitUnits += Math.round(Number(cells.debit || 0) * Math.pow(10, Number(options.decimalPlaces) || 0));
        bucket.creditUnits += Math.round(Number(cells.credit || 0) * Math.pow(10, Number(options.decimalPlaces) || 0));
      });
      var precision = Math.pow(10, Number(options.decimalPlaces) || 0);
      columns = groupKind === 'center'
        ? [
            { key: 'analyticCode', label: 'Code analytique' }, { key: 'analyticTitle', label: 'Centre analytique' },
            { key: 'lineCount', label: 'Nombre de lignes' }, { key: 'debit', label: 'Débit analytique' },
            { key: 'credit', label: 'Crédit analytique' }, { key: 'net', label: 'Solde net analytique' }
          ]
        : [
            { key: groupKind === 'account' ? 'account' : 'destination', label: groupKind === 'account' ? 'Compte général' : 'Valeur analytique' }
          ].concat(groupKind === 'account' ? [{ key: 'accountTitle', label: 'Intitulé du compte' }] : [
            { key: 'account', label: 'Compte général' }, { key: 'accountTitle', label: 'Intitulé du compte' }
          ]).concat([
            { key: 'lineCount', label: 'Nombre de lignes' }, { key: 'debit', label: 'Débit analytique' },
            { key: 'credit', label: 'Crédit analytique' }, { key: 'net', label: 'Solde net analytique' }
          ]);
      grouped = Array.from(groupsByKey.values()).sort(function (left, right) {
        return compare(groupKind === 'center' ? left.center && left.center.code || left.destination : groupKind === 'account' ? left.account : left.destination,
          groupKind === 'center' ? right.center && right.center.code || right.destination : groupKind === 'account' ? right.account : right.destination) || compare(left.account, right.account);
      }).map(function (bucket) {
        var debit = bucket.debitUnits / precision;
        var credit = bucket.creditUnits / precision;
        var values = {
          analyticCode: bucket.center ? String(bucket.center.code || '') : '',
          analyticTitle: bucket.center ? String(bucket.center.name || '') : '',
          destination: bucket.destination,
          account: bucket.account,
          accountTitle: bucket.accountTitle,
          lineCount: bucket.sourceLines.size,
          debit: debit,
          credit: credit,
          net: debit - credit
        };
        var cells = {};
        columns.forEach(function (column) { cells[column.key] = values[column.key] == null ? '' : values[column.key]; });
        return cells;
      });
    }

    var mainGroupTitle = reportType === 'analytic-center-balance'
      ? 'Balance des centres · mouvements analytiques explicites'
      : (reportType === 'analytic-other-nature-balance'
        ? 'Balance détaillée par nature · ' + natureLabel
        : (reportType === 'analytic-ledger'
          ? 'Grand livre analytique · ' + natureLabel
          : (reportType === 'analytic-other-nature-ledger'
            ? 'Grand livre par autre nature · ' + natureLabel
            : (reportType === 'analytic-center-situation'
              ? 'Situation des centres · mouvements cumulés du cycle à date'
              : (reportType === 'analytic-other-nature-situation'
                ? 'Situation par autre nature · mouvements cumulés du cycle à date'
                : 'Balance analytique par comptes généraux · ' + natureLabel)))));
    var groups = grouped.length ? [{
      code: 'analytical-statement', title: mainGroupTitle,
      rowCount: grouped.length,
      rows: grouped.map(function (cells) { return { kind: 'line', cells: cells }; })
    }] : [];
    if (unallocatedRows.length) {
      var remainderCells;
      if (detailTypes.indexOf(reportType) !== -1) {
        remainderCells = unallocatedRows.map(function (row) { return row.cells; });
      } else {
        var remainderDebit = movements.unallocatedDebit;
        var remainderCredit = movements.unallocatedCredit;
        var remainderValues = {
          analyticCode: '', analyticTitle: 'À ventiler (sans centre)', destination: 'À ventiler (sans centre)',
          account: '', accountTitle: '', lineCount: movements.unallocatedLineCount,
          debit: remainderDebit, credit: remainderCredit, net: remainderDebit - remainderCredit
        };
        var remainder = {};
        columns.forEach(function (column) { remainder[column.key] = remainderValues[column.key] == null ? '' : remainderValues[column.key]; });
        remainderCells = [remainder];
      }
      groups.push({
        code: 'analytical-unallocated', title: 'Reliquats · « À ventiler » (sans attribution)',
        rowCount: unallocatedRows.length,
        rows: remainderCells.map(function (cells) { return { kind: 'line', cells: cells }; })
      });
    }
    return {
      reportType: reportType,
      columns: columns,
      groups: groups,
      errors: [],
      rowCount: grouped.length,
      sourceLineCount: movements.sourceLineCount,
      totalDebit: movements.totalDebit,
      totalCredit: movements.totalCredit,
      unallocatedLineCount: movements.unallocatedLineCount,
      unallocatedDebit: movements.unallocatedDebit,
      unallocatedCredit: movements.unallocatedCredit,
      unmatchedCenterCount: movements.unmatchedCenterCount,
      unclassifiedAllocationCount: movements.unclassifiedAllocationCount,
      analyticalNature: movements.analyticalNature,
      analyticalNatureLabel: natureLabel
    };
  }

  function normalizeCurrencyCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function parseCurrencyUnits(value) {
    if (value == null || value === '') return null;
    var numeric;
    if (typeof value === 'number') {
      numeric = value;
    } else {
      var match = /^\+?(\d+)(?:[.,](\d{1,4}))?$/.exec(String(value).trim());
      if (!match) return null;
      numeric = Number(match[1] + (match[2] ? '.' + match[2] : ''));
    }
    if (!Number.isFinite(numeric) || numeric < 0) return null;
    var units = Math.round(numeric * 10000);
    return Number.isSafeInteger(units) && Math.abs(numeric - units / 10000) < 1e-8 ? units : null;
  }

  function explicitCurrencyCodes(line, sourceLine) {
    var values = [];
    var invalid = false;
    [line, sourceLine].forEach(function (source) {
      if (!source || typeof source !== 'object' || Array.isArray(source) || !Object.prototype.hasOwnProperty.call(source, 'currencyCode')) return;
      var value = source.currencyCode;
      if (value == null || value === '') return;
      if (typeof value !== 'string' && typeof value !== 'number') {
        invalid = true;
        return;
      }
      var code = normalizeCurrencyCode(value);
      if (!/^[A-Z]{3}$/.test(code)) invalid = true;
      else if (values.indexOf(code) === -1) values.push(code);
    });
    return { values: values, invalid: invalid };
  }

  function explicitCurrencySideAmounts(line, sourceLine) {
    var aliases = {
      debit: ['foreignDebit', 'currencyDebit'],
      credit: ['foreignCredit', 'currencyCredit']
    };
    var records = [line, sourceLine];
    var resolved = null;
    var invalid = false;
    var present = false;
    records.forEach(function (record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return;
      var hasFields = aliases.debit.concat(aliases.credit).some(function (key) {
        return Object.prototype.hasOwnProperty.call(record, key);
      });
      if (!hasFields) return;
      present = true;
      function readSide(keys) {
        var values = keys.filter(function (key) {
          return Object.prototype.hasOwnProperty.call(record, key) && record[key] != null && record[key] !== '';
        }).map(function (key) { return parseCurrencyUnits(record[key]); });
        if (values.some(function (value) { return value == null; })) return { valid: false, units: 0 };
        if (values.some(function (value) { return value !== values[0]; })) return { valid: false, units: 0 };
        return { valid: true, units: values.length ? values[0] : 0 };
      }
      var debit = readSide(aliases.debit);
      var credit = readSide(aliases.credit);
      if (!debit.valid || !credit.valid || (debit.units > 0 && credit.units > 0) || (!debit.units && !credit.units)) {
        invalid = true;
        return;
      }
      if (resolved && (resolved.debitUnits !== debit.units || resolved.creditUnits !== credit.units)) {
        invalid = true;
        return;
      }
      resolved = { debitUnits: debit.units, creditUnits: credit.units };
    });
    return { present: present, invalid: invalid, value: resolved };
  }

  function explicitCurrencyAmount(line, sourceLine, baseDebitUnits, baseCreditUnits) {
    var sideAmounts = explicitCurrencySideAmounts(line, sourceLine);
    if (sideAmounts.present) return sideAmounts.invalid ? null : sideAmounts.value;
    var values = [line, sourceLine].filter(function (source) {
      return source && typeof source === 'object' && !Array.isArray(source) &&
        Object.prototype.hasOwnProperty.call(source, 'foreignAmount') && source.foreignAmount != null && source.foreignAmount !== '';
    }).map(function (source) { return parseCurrencyUnits(source.foreignAmount); });
    if (!values.length || values.some(function (value) { return value == null; }) || values.some(function (value) { return value !== values[0]; })) return null;
    if (!values[0]) return null;
    if (baseDebitUnits > 0 && baseCreditUnits === 0) return { debitUnits: values[0], creditUnits: 0 };
    if (baseCreditUnits > 0 && baseDebitUnits === 0) return { debitUnits: 0, creditUnits: values[0] };
    return null;
  }

  function buildCurrencyTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var baseCurrencyCode = normalizeCurrencyCode(options.baseCurrencyCode || 'XOF');
    var currencies = Array.isArray(options.currencyRecords) ? options.currencyRecords : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var currencyByCode = new Map();
    var selectedKeys = Array.isArray(options.columns) ? options.columns : CURRENCY_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = CURRENCY_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByCurrency = new Map();
    var includedEntries = new Set();
    var lineCount = 0;
    var omittedLineCount = 0;

    currencies.forEach(function (currency) {
      if (!currency || typeof currency !== 'object') return;
      var code = normalizeCurrencyCode(currency.code);
      if (!/^[A-Z]{3}$/.test(code)) return;
      if (currencyByCode.has(code)) currencyByCode.set(code, null);
      else currencyByCode.set(code, currency);
    });

    entries.forEach(function (entry, entryIndex) {
      if (!entry || entry.status !== 'posted') return;
      var date = String(entry.date || '');
      if (from && date < from) return;
      if (to && date > to) return;
      var journal = String(entry.journal || '');
      if (selectedJournals.size && !selectedJournals.has(journal)) return;
      var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
        if (!line || typeof line !== 'object' || Array.isArray(line)) return;
        var sourceLine = sourceLines[lineIndex] && typeof sourceLines[lineIndex] === 'object' ? sourceLines[lineIndex] : {};
        var codes = explicitCurrencyCodes(line, sourceLine);
        var hasForeignAmount = [line, sourceLine].some(function (source) {
          return source && Object.prototype.hasOwnProperty.call(source, 'foreignAmount') && source.foreignAmount != null && source.foreignAmount !== '';
        });
        var sideAmounts = explicitCurrencySideAmounts(line, sourceLine);
        var hasExplicitSideAmount = sideAmounts.present;
        if (codes.invalid || codes.values.length > 1) {
          omittedLineCount += 1;
          return;
        }
        var hasEntryCurrencyCode = entry.currencyCode != null && String(entry.currencyCode).trim() !== '';
        var entryCurrencyCode = normalizeCurrencyCode(entry.currencyCode);
        if (hasEntryCurrencyCode && (typeof entry.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(entryCurrencyCode))) {
          omittedLineCount += 1;
          return;
        }
        if (codes.values.length && entryCurrencyCode && codes.values[0] !== entryCurrencyCode) {
          omittedLineCount += 1;
          return;
        }
        var currencyCode = codes.values[0] || entryCurrencyCode || baseCurrencyCode;
        if (!codes.values.length && !entryCurrencyCode && (hasForeignAmount || hasExplicitSideAmount)) {
          omittedLineCount += 1;
          return;
        }
        var currency = currencyByCode.get(currencyCode);
        if (!currency || currencyByCode.get(currencyCode) === null) {
          omittedLineCount += 1;
          return;
        }
        var baseDebit = Number(line.debit);
        var baseCredit = Number(line.credit);
        if (!Number.isFinite(baseDebit) || !Number.isFinite(baseCredit) || baseDebit < 0 || baseCredit < 0 ||
            (baseDebit > 0 && baseCredit > 0) || (baseDebit === 0 && baseCredit === 0)) {
          omittedLineCount += 1;
          return;
        }
        var baseDebitUnits = Math.round(baseDebit * 10000);
        var baseCreditUnits = Math.round(baseCredit * 10000);
        if (!Number.isSafeInteger(baseDebitUnits) || !Number.isSafeInteger(baseCreditUnits)) {
          omittedLineCount += 1;
          return;
        }
        var amounts = currencyCode === baseCurrencyCode
          ? { debitUnits: baseDebitUnits, creditUnits: baseCreditUnits }
          : explicitCurrencyAmount(line, sourceLine, baseDebitUnits, baseCreditUnits);
        if (!amounts || !Number.isSafeInteger(amounts.debitUnits) || !Number.isSafeInteger(amounts.creditUnits) ||
            amounts.debitUnits < 0 || amounts.creditUnits < 0 ||
            (amounts.debitUnits > 0 && amounts.creditUnits > 0) || (amounts.debitUnits === 0 && amounts.creditUnits === 0)) {
          omittedLineCount += 1;
          return;
        }
        var total = totalsByCurrency.get(currencyCode);
        var nextDebitUnits = (total ? total.debitUnits : 0) + amounts.debitUnits;
        var nextCreditUnits = (total ? total.creditUnits : 0) + amounts.creditUnits;
        if (!Number.isSafeInteger(nextDebitUnits) || !Number.isSafeInteger(nextCreditUnits)) {
          omittedLineCount += 1;
          return;
        }
        if (!total) {
          total = { currency: currency, entryIds: new Set(), lineCount: 0, debitUnits: 0, creditUnits: 0 };
          totalsByCurrency.set(currencyCode, total);
        }
        var entryId = entry.id != null && String(entry.id).trim() !== '' ? 'id:' + String(entry.id) : 'entry:' + entryIndex;
        total.entryIds.add(entryId);
        includedEntries.add(entryId);
        total.lineCount += 1;
        total.debitUnits = nextDebitUnits;
        total.creditUnits = nextCreditUnits;
        lineCount += 1;
      });
    });

    var rows = Array.from(totalsByCurrency.entries()).sort(function (a, b) {
      return compare(a[0], b[0]);
    }).map(function (item) {
      var code = item[0];
      var total = item[1];
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'currencyCode': cells[column.key] = code; break;
          case 'currencyTitle': cells[column.key] = String(total.currency.label || ''); break;
          case 'pieceCount': cells[column.key] = total.entryIds.size; break;
          case 'lineCount': cells[column.key] = total.lineCount; break;
          case 'debit': cells[column.key] = total.debitUnits / 10000; break;
          case 'credit': cells[column.key] = total.creditUnits / 10000; break;
        }
      });
      return { kind: 'line', currencyCode: code, cells: cells };
    });
    var currencyCount = totalsByCurrency.size;
    var groups = rows.length ? [{
      code: 'currency-totals',
      title: 'Cumul des journaux par devises',
      currencyCount: currencyCount,
      entryCount: includedEntries.size,
      lineCount: lineCount,
      rows: rows
    }] : [];
    return {
      columns: columns,
      groups: groups,
      currencyCount: currencyCount,
      entryCount: includedEntries.size,
      lineCount: lineCount,
      omittedLineCount: omittedLineCount
    };
  }

  function thirdPartyNatureLabel(nature) {
    return {
      suppliers: 'Fournisseurs',
      clients: 'Clients',
      personnel: 'Personnel',
      debtors: 'Débiteurs divers',
      creditors: 'Créditeurs divers'
    }[String(nature || '').toLowerCase()] || 'Clients';
  }

  function normalizeThirdPartyReference(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function thirdPartyAuxiliaryAccountCode(record) {
    return String(record && (record.auxiliaryAccountCode || (record.accountCode && record.code ? record.accountCode + '-' + record.code : '')) || '');
  }

  function buildThirdPartyTotals(options) {
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var selectedThirdParties = new Set((Array.isArray(filters.thirdParties) ? filters.thirdParties : []).map(normalizeThirdPartyReference));
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var records = Array.isArray(options.thirdPartyRecords) ? options.thirdPartyRecords : [];
    var sourceErrors = Array.isArray(options.sourceErrors) ? options.sourceErrors.slice() : [];
    var movements = sourceErrors.length || !Array.isArray(options.thirdPartyMovements) ? [] : options.thirdPartyMovements;
    var recordByAuxiliaryReference = new Map();
    var selectedKeys = Array.isArray(options.columns) ? options.columns : THIRD_PARTY_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = THIRD_PARTY_TOTALS_COLUMNS.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var totalsByThirdParty = new Map();

    function registerReference(reference, record) {
      var normalized = normalizeThirdPartyReference(reference);
      if (!normalized) return;
      if (recordByAuxiliaryReference.has(normalized) && recordByAuxiliaryReference.get(normalized) !== record) {
        recordByAuxiliaryReference.set(normalized, null);
        return;
      }
      if (recordByAuxiliaryReference.get(normalized) !== null) recordByAuxiliaryReference.set(normalized, record);
    }

    records.forEach(function (record) {
      if (!record) return;
      registerReference(record.id, record);
      registerReference(record.code, record);
      registerReference(thirdPartyAuxiliaryAccountCode(record), record);
    });

    movements.forEach(function (movement) {
      if (!movement) return;
      var date = String(movement.date || '');
      if (from && date < from) return;
      if (to && date > to) return;
      if (selectedJournals.size && !selectedJournals.has(String(movement.journal || ''))) return;
      var reference = normalizeThirdPartyReference(movement.auxiliaryCode);
      if (!reference || !recordByAuxiliaryReference.has(reference)) return;
      var record = recordByAuxiliaryReference.get(reference);
      if (!record) return;
      var recordCode = String(record.code || '');
      if (!recordCode) return;
      if (selectedThirdParties.size && !selectedThirdParties.has(normalizeThirdPartyReference(recordCode))) return;
      var collectiveAccountCode = String(record.accountCode || '');
      if (collectiveAccountCode && String(movement.account || '') !== collectiveAccountCode) return;
      var total = totalsByThirdParty.get(recordCode);
      if (!total) {
        total = { record: record, lineCount: 0, debitUnits: 0, creditUnits: 0 };
        totalsByThirdParty.set(recordCode, total);
      }
      total.lineCount += 1;
      total.debitUnits += Math.round(safeAmount(movement.debit) * precision);
      total.creditUnits += Math.round(safeAmount(movement.credit) * precision);
    });

    var lineCount = 0;
    var totalDebitUnits = 0;
    var totalCreditUnits = 0;
    var rows = Array.from(totalsByThirdParty.values()).sort(function (a, b) {
      return compare(thirdPartyAuxiliaryAccountCode(a.record) || a.record.code, thirdPartyAuxiliaryAccountCode(b.record) || b.record.code);
    }).map(function (total) {
      var debit = total.debitUnits / precision;
      var credit = total.creditUnits / precision;
      var cells = {};
      columns.forEach(function (column) {
        switch (column.key) {
          case 'accountCode': cells[column.key] = thirdPartyAuxiliaryAccountCode(total.record); break;
          case 'accountTitle': cells[column.key] = String(total.record.name || ''); break;
          case 'lineCount': cells[column.key] = total.lineCount; break;
          case 'debit': cells[column.key] = debit; break;
          case 'credit': cells[column.key] = credit; break;
        }
      });
      lineCount += total.lineCount;
      totalDebitUnits += total.debitUnits;
      totalCreditUnits += total.creditUnits;
      return { kind: 'line', cells: cells };
    });
    var thirdPartyCount = totalsByThirdParty.size;
    var natureLabel = thirdPartyNatureLabel(filters.thirdPartyNature);
    var groups = rows.length ? [{
      code: 'third-parties',
      title: 'Cumul par tiers · ' + natureLabel,
      thirdPartyCount: thirdPartyCount,
      lineCount: lineCount,
      rows: rows
    }] : [];
    return {
      columns: columns,
      groups: groups,
      thirdPartyCount: thirdPartyCount,
      thirdPartyNature: String(filters.thirdPartyNature || 'clients'),
      thirdPartyNatureLabel: natureLabel,
      lineCount: lineCount,
      totalDebit: totalDebitUnits / precision,
      totalCredit: totalCreditUnits / precision,
      sourceErrors: sourceErrors
    };
  }

  function build(options) {
    options = options || {};
    if (options.reportType === 'totals') return buildJournalTotals(options);
    if (options.reportType === 'account-totals') return buildAccountTotals(options);
    if (options.reportType === 'summary-account-totals') return buildSummaryAccountTotals(options);
    if (options.reportType === 'third-party-totals') return buildThirdPartyTotals(options);
    if (options.reportType === 'analytic-center-totals') return buildAnalyticalCenterTotals(options);
    if (options.reportType === 'currency-totals') return buildCurrencyTotals(options);
    var filters = options.filters || {};
    var selectedJournals = asSet(filters.journals);
    var selectedAccounts = asSet(filters.accounts);
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var reportType = options.reportType === 'unbalanced' ? 'unbalanced' : 'standard';
    var availableColumns = reportType === 'unbalanced' ? UNBALANCED_COLUMNS : COLUMNS;
    var accountByCode = new Map(accounts.map(function (account) { return [String(account.code), account]; }));
    var journalByCode = new Map(journals.map(function (journal) { return [String(journal.code), journal]; }));
    var selectedKeys = Array.isArray(options.columns) ? options.columns : availableColumns.filter(function (column) {
      return column.selectable && column.defaultSelected;
    }).map(function (column) { return column.key; });
    var columns = availableColumns.filter(function (column) {
      return column.selectable && selectedKeys.indexOf(column.key) !== -1;
    });
    var jobs = [];

    entries.forEach(function (entry, entryIndex) {
      if (!entry) return;
      var isDraft = entry.status === 'draft';
      if (entry.status !== 'posted' && !(options.includeDrafts && isDraft)) return;
      if (options.unbalancedOnly) {
        var entryDebit = 0;
        var entryCredit = 0;
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
          entryDebit += safeAmount(line && line.debit);
          entryCredit += safeAmount(line && line.credit);
        });
        var debitUnits = Math.round(entryDebit * precision);
        var creditUnits = Math.round(entryCredit * precision);
        if (debitUnits === creditUnits) return;
      }
      var updatedAt = String(entry.updatedAt || '');
      if (options.modifiedOnly && (!updatedAt || !Number.isFinite(Date.parse(updatedAt)))) return;
      var filterDate = options.filterByModificationDate ? updatedAt.slice(0, 10) : String(entry.date || '');
      if (from && filterDate < from) return;
      if (to && filterDate > to) return;
      var journalCode = String(entry.journal || '');
      if (selectedJournals.size && !selectedJournals.has(journalCode)) return;
      var lines = (Array.isArray(entry.lines) ? entry.lines : []).map(function (line, lineIndex) {
        return { line: line, lineIndex: lineIndex, account: accountByCode.get(String(line && line.account || '')) || null };
      }).filter(function (record) {
        return record.line && (!selectedAccounts.size || selectedAccounts.has(String(record.line.account || '')));
      });
      if (!lines.length) return;
      jobs.push({
        entry: entry,
        entryIndex: entryIndex,
        journalCode: journalCode,
        sortDate: options.filterByModificationDate ? filterDate : String(entry.date || ''),
        lines: lines
      });
    });

    jobs.sort(function (a, b) {
      return compare(a.journalCode, b.journalCode) ||
        compare(a.sortDate, b.sortDate) ||
        compare(a.entry.reference, b.entry.reference) ||
        a.entryIndex - b.entryIndex;
    });

    var groups = [];
    jobs.forEach(function (job) {
      var group = groups[groups.length - 1];
      if (!group || group.code !== job.journalCode) {
        var journal = journalByCode.get(job.journalCode) || null;
        group = {
          code: job.journalCode,
          label: journal && journal.label || job.journalCode,
          title: 'Journal ' + job.journalCode + (journal && journal.label ? ' · ' + journal.label : ''),
          pageBreakBefore: !!options.newPageEachJournal && groups.length > 0,
          rows: []
        };
        groups.push(group);
      }
      job.group = group;
    });

    groups.forEach(function (group) {
      var groupJobs = jobs.filter(function (job) { return job.group === group; });
      var currentMonth = '';
      var monthDebit = 0;
      var monthCredit = 0;
      var monthLabel = '';

      function finishMonth() {
        if (!options.subtotalByMonth || !currentMonth) return;
        group.rows.push(subtotalRow(
          columns,
          'month-subtotal',
          'Sous-total du mois ' + monthLabel,
          '',
          currentMonth,
          monthDebit / precision,
          monthCredit / precision
        ));
      }

      groupJobs.forEach(function (job) {
        var entry = job.entry;
        var month = String(entry.date || '').slice(0, 7);
        if (month !== currentMonth) {
          finishMonth();
          currentMonth = month;
          monthDebit = 0;
          monthCredit = 0;
          monthLabel = month;
        }
        var pieceDebit = 0;
        var pieceCredit = 0;
        job.lines.forEach(function (record) {
          var debit = safeAmount(record.line.debit);
          var credit = safeAmount(record.line.credit);
          pieceDebit += Math.round(debit * precision);
          pieceCredit += Math.round(credit * precision);
          monthDebit += Math.round(debit * precision);
          monthCredit += Math.round(credit * precision);
          group.rows.push({
            kind: 'line',
            entry: entry,
            line: record.line,
            account: record.account,
            cells: makeCells(columns, entry, record.line, record.account, record.lineIndex)
          });
        });
        if (options.subtotalByPiece) {
          group.rows.push(subtotalRow(
            columns,
            'piece-subtotal',
            'Sous-total de la pièce ' + String(entry.reference || ''),
            entry.reference || '',
            entry.date || '',
            pieceDebit / precision,
            pieceCredit / precision
          ));
        }
      });
      finishMonth();
    });

    return {
      columns: columns,
      groups: groups,
      lineCount: groups.reduce(function (count, group) {
        return count + group.rows.filter(function (row) { return row.kind === 'line'; }).length;
      }, 0),
      entryCount: jobs.length
    };
  }

  function toMatrix(report) {
    report = report || { columns: [], groups: [] };
    var columns = Array.isArray(report.columns) ? report.columns : [];
    var matrix = [columns.map(function (column) { return column.label; })];
    (Array.isArray(report.groups) ? report.groups : []).forEach(function (group) {
      if (columns.length) matrix.push([group.title].concat(columns.slice(1).map(function () { return ''; })));
      (group.rows || []).forEach(function (row) {
        var values = columns.map(function (column) {
          return row.cells && row.cells[column.key] != null ? row.cells[column.key] : '';
        });
        if (row.kind !== 'line' && !columns.some(function (column) { return column.key !== 'debit' && column.key !== 'credit'; })) {
          matrix.push([row.label].concat(columns.slice(1).map(function () { return ''; })));
        }
        matrix.push(values);
      });
    });
    return matrix;
  }

  function toTsv(report) {
    return '\uFEFF' + toMatrix(report).map(function (row) {
      return row.map(function (cell) {
        var value = cell == null ? '' : String(cell);
        if (typeof cell === 'string' && /^[=+\-@\t\r]/.test(value)) value = "'" + value;
        return /[\t\r\n"]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
      }).join('\t');
    }).join('\r\n') + '\r\n';
  }

  return {
    columns: COLUMNS.map(function (column) { return Object.assign({}, column); }),
    columnGroups: COLUMN_GROUPS.map(function (group) { return group.slice(); }),
    columnsForReport: columnsForReport,
    columnGroupsForReport: columnGroupsForReport,
    analyticalMovementColumns: ANALYTICAL_MOVEMENT_COLUMNS.map(function (column) { return Object.assign({}, column); }),
    buildAnalyticalMovements: buildAnalyticalMovements,
    buildAnalyticalStatement: buildAnalyticalStatement,
    build: build,
    toMatrix: toMatrix,
    toTsv: toTsv
  };
}));
