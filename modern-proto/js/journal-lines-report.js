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

  function columnsForReport(reportType) {
    var columns = reportType === 'unbalanced'
      ? UNBALANCED_COLUMNS
      : (reportType === 'totals'
        ? JOURNAL_TOTALS_COLUMNS
        : (reportType === 'account-totals'
          ? ACCOUNT_TOTALS_COLUMNS
          : (reportType === 'summary-account-totals'
            ? SUMMARY_ACCOUNT_TOTALS_COLUMNS
            : (reportType === 'third-party-totals' ? THIRD_PARTY_TOTALS_COLUMNS : COLUMNS))));
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
            : (reportType === 'third-party-totals' ? THIRD_PARTY_TOTALS_COLUMN_GROUPS : COLUMN_GROUPS))));
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
    build: build,
    toMatrix: toMatrix,
    toTsv: toTsv
  };
}));
