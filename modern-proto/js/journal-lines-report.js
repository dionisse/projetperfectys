/*
 * PERFECTO · Construction des états de lignes de journal.
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

  function columnsForReport(reportType) {
    var columns = reportType === 'unbalanced' ? UNBALANCED_COLUMNS : COLUMNS;
    return columns.map(function (column) { return Object.assign({}, column); });
  }

  function columnGroupsForReport(reportType) {
    var groups = reportType === 'unbalanced' ? UNBALANCED_COLUMN_GROUPS : COLUMN_GROUPS;
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

  function build(options) {
    options = options || {};
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
