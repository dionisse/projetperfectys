/*
 * PERFECTO · Calcul des balances générale et de synthèse.
 * Lecture seule : pièces validées du cycle et registre distinct des reports à nouveau.
 * Les cumuls débit/crédit et les regroupements suivent les balances de référence ; seules les rubriques connues du plan sont affichées.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoGeneralBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'code', label: 'Code du compte', defaultSelected: true, supported: true },
    { key: 'label', label: 'Intitulé du compte', defaultSelected: true, supported: true },
    { key: 'cumulativeStart', label: 'Cumul Début Période', defaultSelected: false, supported: true },
    { key: 'openingBalance', label: 'Solde Début Période', defaultSelected: false, supported: true },
    { key: 'movements', label: 'Mouvements Période', defaultSelected: true, supported: true },
    { key: 'movementBalance', label: 'Solde Mouvements Période', defaultSelected: true, supported: true },
    { key: 'cumulativeEnd', label: 'Cumul Fin Période', defaultSelected: false, supported: true },
    { key: 'closingBalance', label: 'Solde Fin Période', defaultSelected: false, supported: true }
  ];

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseAccountFilter(expression) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) return { valid: false, all: false, tokens: [], patterns: [], error: 'Indiquez un compte ou * pour sélectionner tous les comptes.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, all: true, tokens: ['*'], patterns: [] };
    var patterns = tokens.map(function (token) {
      return new RegExp('^' + token.split('*').map(escapeRegex).join('.*') + '$', 'i');
    });
    return { valid: true, all: false, tokens: tokens, patterns: patterns };
  }

  function accountMatches(code, parsedFilter) {
    var parsed = parsedFilter && typeof parsedFilter === 'object' && Array.isArray(parsedFilter.patterns)
      ? parsedFilter
      : parseAccountFilter(parsedFilter);
    if (!parsed.valid) return false;
    if (parsed.all) return true;
    var value = String(code == null ? '' : code);
    return parsed.patterns.some(function (pattern) { return pattern.test(value); });
  }

  function classNumber(account) {
    var declared = Number(account && account.cls);
    if (Number.isInteger(declared) && declared >= 1 && declared <= 9) return declared;
    var first = Number(String(account && account.code || '').charAt(0));
    return Number.isInteger(first) ? first : 0;
  }

  function finiteAmount(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    return Number.isSafeInteger(scaled) ? scaled : null;
  }

  function build(options) {
    options = options || {};
    var filters = options.filters || {};
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var from = String(filters.from || '');
    var to = String(filters.to || '');
    var parsedFilter = parseAccountFilter(filters.accounts == null ? '*' : filters.accounts);
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var selectedColumns = options.columns || {};
    var accountByCode = Object.create(null);
    var accountOrder = Object.create(null);
    var journalNatureByCode = Object.create(null);
    var sums = Object.create(null);
    var movementEntryIds = Object.create(null);
    var invalidLineCount = 0;
    var openingBalanceLineCount = 0;
    var sourceLineCount = 0;

    accounts.forEach(function (account, index) {
      if (!account || account.code == null) return;
      var code = String(account.code);
      accountByCode[code] = account;
      accountOrder[code] = index;
    });
    journals.forEach(function (journal) {
      if (!journal || journal.code == null) return;
      journalNatureByCode[String(journal.code)] = String(journal.operationNature || '');
    });

    function accountIsSelected(code) {
      if (!accountMatches(code, parsedFilter)) return false;
      if (!filters.collectivesOnly) return true;
      var account = accountByCode[code];
      return !!account && classNumber(account) === 4 && account.aux === true;
    }

    function ensureRow(code) {
      code = String(code || '');
      if (!code) return null;
      if (!sums[code]) {
        var account = accountByCode[code] || null;
        sums[code] = {
          code: code,
          label: account && account.label ? String(account.label) : code,
          cls: classNumber(account || { code: code }),
          aux: !!(account && account.aux === true),
          openingDebitMinor: 0,
          openingCreditMinor: 0,
          movementDebitMinor: 0,
          movementCreditMinor: 0
        };
      }
      return sums[code];
    }

    function addAmounts(row, debitValue, creditValue, bucket) {
      var debit = finiteAmount(debitValue, factor);
      var credit = finiteAmount(creditValue, factor);
      if (debit === null || credit === null) {
        invalidLineCount += 1;
        return false;
      }
      row[bucket + 'DebitMinor'] += debit;
      row[bucket + 'CreditMinor'] += credit;
      return true;
    }

    function excludedByNature(entry) {
      var journalCode = String(entry && (entry.journal == null ? entry.journalCode : entry.journal) || '');
      var nature = journalNatureByCode[journalCode] || '';
      if (filters.beforeInventory && nature === 'Inventaire') return true;
      if (filters.beforeResult && nature === 'Résultat de l’exercice') return true;
      return false;
    }

    /*
     * Les reports à nouveau sont une base distincte du journal. Avec les pièces
     * validées antérieures à la période, ils forment les cumuls de début en
     * conservant séparément débits et crédits. Les cumuls de fin additionnent
     * ensuite les mouvements de la période à chacun de ces deux côtés.
     */
    openingBalances.forEach(function (record) {
      if (!record || !record.accountCode || !record.date || record.date >= from) return;
      var code = String(record.accountCode);
      if (!accountIsSelected(code)) return;
      var row = ensureRow(code);
      if (!addAmounts(row, record.debit, record.credit, 'opening')) return;
      openingBalanceLineCount += 1;
    });

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !entry.date || entry.date > to || excludedByNature(entry)) return;
      if (options.cycleStart && entry.date < options.cycleStart) return;
      if (options.cycleEnd && entry.date > options.cycleEnd) return;
      var bucket = entry.date < from ? 'opening' : 'movement';
      var hasSelectedLine = false;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line) {
        if (!line) return;
        var code = String(line.account == null ? line.accountCode || '' : line.account);
        if (!code || !accountIsSelected(code)) return;
        var row = ensureRow(code);
        if (!addAmounts(row, line.debit, line.credit, bucket)) return;
        hasSelectedLine = true;
        sourceLineCount += 1;
      });
      if (bucket === 'movement' && hasSelectedLine) {
        var entryId = String(entry.id || entry.reference || ('entry-' + Object.keys(movementEntryIds).length));
        movementEntryIds[entryId] = true;
      }
    });

    /* Une sélection explicite montre aussi les comptes sans mouvement. */
    if (parsedFilter.valid && !parsedFilter.all) {
      accounts.forEach(function (account) {
        if (!account || account.code == null) return;
        var code = String(account.code);
        if (accountIsSelected(code)) ensureRow(code);
      });
    }

    var rows = Object.keys(sums).map(function (code) {
      var row = sums[code];
      var openingDebit = row.openingDebitMinor / factor;
      var openingCredit = row.openingCreditMinor / factor;
      var movementDebit = row.movementDebitMinor / factor;
      var movementCredit = row.movementCreditMinor / factor;
      var openingBalanceMinor = row.openingDebitMinor - row.openingCreditMinor;
      var movementBalanceMinor = row.movementDebitMinor - row.movementCreditMinor;
      var closingBalanceMinor = openingBalanceMinor + movementBalanceMinor;
      var openingBalance = openingBalanceMinor / factor;
      var movementBalance = movementBalanceMinor / factor;
      var closingBalance = closingBalanceMinor / factor;
      var hasActivity = row.openingDebitMinor !== 0 || row.openingCreditMinor !== 0 ||
        row.movementDebitMinor !== 0 || row.movementCreditMinor !== 0;
      if (!hasActivity && parsedFilter.all) return null;
      return {
        code: row.code,
        label: row.label,
        cls: row.cls,
        aux: row.aux,
        openingDebit: openingDebit,
        openingCredit: openingCredit,
        openingBalance: openingBalance,
        openingBalanceDebit: Math.max(openingBalanceMinor, 0) / factor,
        openingBalanceCredit: Math.max(-openingBalanceMinor, 0) / factor,
        cumulativeStartDebit: openingDebit,
        cumulativeStartCredit: openingCredit,
        movementDebit: movementDebit,
        movementCredit: movementCredit,
        movementBalance: movementBalance,
        movementBalanceDebit: Math.max(movementBalanceMinor, 0) / factor,
        movementBalanceCredit: Math.max(-movementBalanceMinor, 0) / factor,
        cumulativeEndDebit: (row.openingDebitMinor + row.movementDebitMinor) / factor,
        cumulativeEndCredit: (row.openingCreditMinor + row.movementCreditMinor) / factor,
        closingBalance: closingBalance,
        closingBalanceDebit: Math.max(closingBalanceMinor, 0) / factor,
        closingBalanceCredit: Math.max(-closingBalanceMinor, 0) / factor
      };
    }).filter(Boolean);

    if (filters.groupMode === 'chart' || filters.groupMode === 'subtotals') {
      rows.sort(function (left, right) {
        var leftIndex = Object.prototype.hasOwnProperty.call(accountOrder, left.code) ? accountOrder[left.code] : Number.MAX_SAFE_INTEGER;
        var rightIndex = Object.prototype.hasOwnProperty.call(accountOrder, right.code) ? accountOrder[right.code] : Number.MAX_SAFE_INTEGER;
        return leftIndex - rightIndex || left.code.localeCompare(right.code, 'fr', { numeric: true });
      });
    } else {
      rows.sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });
    }

    /* Les soldes signés de `rows` restent l’API compte par compte ; la hiérarchie ne modifie que la présentation. */
    var aggregateFields = [
      'openingDebit', 'openingCredit', 'openingBalance', 'openingBalanceDebit', 'openingBalanceCredit',
      'cumulativeStartDebit', 'cumulativeStartCredit', 'movementDebit', 'movementCredit',
      'movementBalance', 'movementBalanceDebit', 'movementBalanceCredit', 'cumulativeEndDebit',
      'cumulativeEndCredit', 'closingBalance', 'closingBalanceDebit', 'closingBalanceCredit'
    ];
    var displayRows = rows.map(function (row) { return Object.assign({}, row, { rowType: 'account' }); });
    if (filters.groupMode === 'chart' || filters.groupMode === 'subtotals') {
      var hierarchyNodes = Object.create(null);
      var hierarchyRoots = [];

      function orderIndex(code) {
        return Object.prototype.hasOwnProperty.call(accountOrder, String(code)) ? accountOrder[String(code)] : Number.MAX_SAFE_INTEGER;
      }

      function metadataHierarchyLabel(label, generatedFallback) {
        var value = String(label || '').trim();
        if (!value || value === generatedFallback || /^(autres comptes|compte historique|comptes personnalisés)$/i.test(value)) return '';
        return value;
      }

      function ensureHierarchyNode(code, parent, kind, label, account) {
        code = String(code);
        var node = hierarchyNodes[code];
        if (!node) {
          node = hierarchyNodes[code] = {
            code: code, label: '', kind: kind, cls: 0, postable: null, directRow: null, children: [], childMap: Object.create(null),
            parent: null, orderIndex: Number.MAX_SAFE_INTEGER, aggregateMinor: null, hasActivity: false
          };
        }
        if (account && account.label) node.label = String(account.label);
        else if (!node.label && label) node.label = String(label);
        if (account && Number.isInteger(Number(account.cls))) node.cls = Number(account.cls);
        if (account && typeof account.postable === 'boolean') node.postable = account.postable;
        if (parent) {
          if (!Object.prototype.hasOwnProperty.call(parent.childMap, code)) {
            parent.childMap[code] = true;
            parent.children.push(node);
          }
          node.parent = parent;
        } else if (!node.parent && hierarchyRoots.indexOf(node) === -1) hierarchyRoots.push(node);
        node.orderIndex = Math.min(node.orderIndex, orderIndex(code));
        return node;
      }

      rows.forEach(function (row) {
        var account = accountByCode[row.code] || { code: row.code, cls: row.cls, label: row.label };
        var cls = classNumber(account);
        var classCode = cls ? String(cls) : '';
        var subclassCode = String(account.subclass || (String(row.code).length > 1 ? String(row.code).slice(0, 2) : ''));
        var path = [];
        if (classCode && classCode !== String(row.code)) {
          var classAccount = accountByCode[classCode];
          var classLabel = classAccount ? classAccount.label : metadataHierarchyLabel(account.classLabel, 'Classe ' + classCode);
          path.push({ code: classCode, kind: 'class', cls: cls, label: classLabel, account: classAccount });
        }
        if (subclassCode && subclassCode !== classCode && subclassCode !== String(row.code)) {
          var subclassAccount = accountByCode[subclassCode];
          var subclassLabel = subclassAccount ? subclassAccount.label : metadataHierarchyLabel(account.subclassLabel, '');
          path.push({ code: subclassCode, kind: 'subclass', cls: cls, label: subclassLabel, account: subclassAccount });
        }
        Object.keys(accountByCode).forEach(function (candidate) {
          if (candidate === String(row.code) || candidate.length <= 2 || candidate.length >= String(row.code).length) return;
          if (String(row.code).toLocaleUpperCase().indexOf(candidate.toLocaleUpperCase()) !== 0) return;
          if (path.some(function (item) { return item.code === candidate; })) return;
          path.push({ code: candidate, kind: 'account-group', cls: cls, label: accountByCode[candidate].label || '', account: accountByCode[candidate] });
        });
        path.sort(function (left, right) {
          return left.code.length - right.code.length || orderIndex(left.code) - orderIndex(right.code) || left.code.localeCompare(right.code, 'fr', { numeric: true });
        });
        var parent = null;
        path.forEach(function (item) {
          parent = ensureHierarchyNode(item.code, parent, item.kind, item.label, item.account);
          parent.cls = Number(item.cls) || parent.cls;
        });
        var leaf = ensureHierarchyNode(row.code, parent, 'account', row.label, account);
        leaf.label = String(row.label || leaf.label || row.code);
        leaf.cls = Number(row.cls) || leaf.cls;
        leaf.directRow = row;
        leaf.orderIndex = Math.min(leaf.orderIndex, orderIndex(row.code));
      });

      function compareHierarchyNodes(left, right) {
        return left.orderIndex - right.orderIndex || left.code.length - right.code.length || left.code.localeCompare(right.code, 'fr', { numeric: true });
      }

      function aggregateNode(node) {
        var childValues = [];
        node.children.forEach(function (child) {
          childValues.push({ node: child, values: aggregateNode(child) });
          node.orderIndex = Math.min(node.orderIndex, child.orderIndex);
        });
        node.children.sort(compareHierarchyNodes);
        var sums = Object.create(null);
        aggregateFields.forEach(function (field) { sums[field] = 0; });
        function addValues(source) {
          aggregateFields.forEach(function (field) { sums[field] += Math.round((Number(source[field]) || 0) * factor); });
        }
        if (node.directRow) addValues(node.directRow);
        childValues.forEach(function (child) {
          aggregateFields.forEach(function (field) { sums[field] += child.values[field]; });
        });
        node.aggregateMinor = sums;
        node.hasActivity = aggregateFields.some(function (field) { return sums[field] !== 0; });
        return sums;
      }

      function aggregateRow(node, rowType, code) {
        var row = { code: code || node.code, label: node.label || '', cls: node.cls || 0, aux: false, rowType: rowType };
        aggregateFields.forEach(function (field) { row[field] = node.aggregateMinor[field] / factor; });
        return row;
      }

      function emitChartRows(node) {
        if (node.children.length) {
          if (node.directRow && node.postable !== false) displayRows.push(Object.assign({}, node.directRow, { rowType: 'account' }));
          else if (node.hasActivity) displayRows.push(aggregateRow(node, 'group'));
          node.children.forEach(emitChartRows);
        } else if (node.directRow) {
          displayRows.push(Object.assign({}, node.directRow, { rowType: 'account' }));
        }
      }

      function emitSubtotalRows(node) {
        if (node.directRow) displayRows.push(Object.assign({}, node.directRow, { rowType: 'account' }));
        node.children.forEach(emitSubtotalRows);
        if (node.children.length && node.hasActivity) displayRows.push(aggregateRow(node, 'subtotal', 'Total ' + node.code));
      }

      hierarchyRoots.sort(compareHierarchyNodes);
      hierarchyRoots.forEach(aggregateNode);
      displayRows = [];
      if (filters.groupMode === 'chart') hierarchyRoots.forEach(emitChartRows);
      else hierarchyRoots.forEach(emitSubtotalRows);
    }

    var includeClass8InManagement = filters.includeClass8InManagement !== false;
    if (filters.intermediateTotal === true) {
      var intermediateSums = {
        balance: { hasRows: false, values: Object.create(null) },
        management: { hasRows: false, values: Object.create(null) }
      };
      Object.keys(intermediateSums).forEach(function (category) {
        aggregateFields.forEach(function (field) { intermediateSums[category].values[field] = 0; });
      });

      function intermediateCategory(cls) {
        if (cls >= 1 && cls <= 5) return 'balance';
        if (cls === 6 || cls === 7 || (cls === 8 && includeClass8InManagement)) return 'management';
        return '';
      }

      rows.forEach(function (row) {
        var account = accountByCode[row.code] || row;
        var category = intermediateCategory(classNumber(account));
        if (!category) return;
        intermediateSums[category].hasRows = true;
        aggregateFields.forEach(function (field) {
          intermediateSums[category].values[field] += Math.round((Number(row[field]) || 0) * factor);
        });
      });

      function lastDisplayIndexForClassRange(firstClass, lastClass) {
        var lastIndex = -1;
        displayRows.forEach(function (row, index) {
          var cls = Number(row.cls) || classNumber(accountByCode[row.code] || row);
          if (cls >= firstClass && cls <= lastClass) lastIndex = index;
        });
        return lastIndex;
      }

      function intermediateTotalRow(category, label) {
        var row = { code: '', label: label, cls: 0, aux: false, rowType: 'intermediate-total', intermediateCategory: category };
        aggregateFields.forEach(function (field) {
          row[field] = intermediateSums[category].values[field] / factor;
        });
        return row;
      }

      var intermediateInsertions = [];
      if (intermediateSums.balance.hasRows) {
        intermediateInsertions.push({
          index: lastDisplayIndexForClassRange(1, 5) + 1,
          row: intermediateTotalRow('balance', 'Total des comptes de bilan')
        });
      }
      var managementLastClass = includeClass8InManagement ? 8 : 7;
      if (intermediateSums.management.hasRows) {
        intermediateInsertions.push({
          index: lastDisplayIndexForClassRange(6, managementLastClass) + 1,
          row: intermediateTotalRow('management', 'Total des comptes de gestion')
        });
      }
      intermediateInsertions.sort(function (left, right) { return right.index - left.index; });
      intermediateInsertions.forEach(function (insertion) {
        displayRows.splice(Math.max(0, insertion.index), 0, insertion.row);
      });
    }

    function sumRows(key) {
      return rows.reduce(function (sum, row) { return sum + Math.round((Number(row[key]) || 0) * factor); }, 0) / factor;
    }

    var totals = {
      openingBalance: sumRows('openingBalance'),
      openingBalanceDebit: sumRows('openingBalanceDebit'),
      openingBalanceCredit: sumRows('openingBalanceCredit'),
      cumulativeStartDebit: sumRows('cumulativeStartDebit'),
      cumulativeStartCredit: sumRows('cumulativeStartCredit'),
      movementDebit: sumRows('movementDebit'),
      movementCredit: sumRows('movementCredit'),
      movementBalance: sumRows('movementBalance'),
      movementBalanceDebit: sumRows('movementBalanceDebit'),
      movementBalanceCredit: sumRows('movementBalanceCredit'),
      cumulativeEndDebit: sumRows('cumulativeEndDebit'),
      cumulativeEndCredit: sumRows('cumulativeEndCredit'),
      closingBalance: sumRows('closingBalance'),
      closingBalanceDebit: sumRows('closingBalanceDebit'),
      closingBalanceCredit: sumRows('closingBalanceCredit')
    };
    var visibleColumns = COLUMN_DEFINITIONS.filter(function (column) {
      return column.supported && selectedColumns[column.key] === true;
    }).map(function (column) { return column.key; });
    var errors = [];
    if (!parsedFilter.valid) errors.push(parsedFilter.error);
    if (!from || !to) errors.push('Les dates de début et de fin sont obligatoires.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');

    return {
      ok: errors.length === 0,
      errors: errors,
      from: from,
      to: to,
      rows: rows,
      displayRows: displayRows,
      columns: visibleColumns,
      totals: totals,
      movementEntryCount: Object.keys(movementEntryIds).length,
      openingBalanceLineCount: openingBalanceLineCount,
      sourceLineCount: sourceLineCount,
      invalidLineCount: invalidLineCount,
      accountFilter: parsedFilter,
      filters: {
        collectivesOnly: filters.collectivesOnly === true,
        beforeInventory: filters.beforeInventory === true,
        beforeResult: filters.beforeResult === true,
        intermediateTotal: filters.intermediateTotal === true,
        includeClass8InManagement: includeClass8InManagement,
        groupMode: filters.groupMode === 'chart' || filters.groupMode === 'subtotals' ? filters.groupMode : 'none'
      },
      basis: {
        postedEntriesOnly: true,
        openingBalancesSeparate: true,
        openingBalancesIncludedBeforePeriod: true
      }
    };
  }

  function buildSummary(options) {
    options = options || {};
    var filters = options.filters || {};
    var summaryLevel = Number(filters.summaryLevel);
    if (!Number.isInteger(summaryLevel) || summaryLevel < 1 || summaryLevel > 5) summaryLevel = 1;
    var includeLowerLevels = filters.includeLowerLevels === true;
    var baseFilters = Object.assign({}, filters, { groupMode: 'none', intermediateTotal: false });
    var detailReport = build(Object.assign({}, options, { filters: baseFilters }));
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var accountByCode = Object.create(null);
    var accountOrder = Object.create(null);
    var fields = [
      'openingDebit', 'openingCredit', 'openingBalance', 'openingBalanceDebit', 'openingBalanceCredit',
      'cumulativeStartDebit', 'cumulativeStartCredit', 'movementDebit', 'movementCredit',
      'movementBalance', 'movementBalanceDebit', 'movementBalanceCredit', 'cumulativeEndDebit',
      'cumulativeEndCredit', 'closingBalance', 'closingBalanceDebit', 'closingBalanceCredit'
    ];
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var nodes = Object.create(null);
    var roots = [];
    var rootMap = Object.create(null);

    accounts.forEach(function (account, index) {
      if (!account || account.code == null) return;
      var code = String(account.code);
      accountByCode[code] = account;
      accountOrder[code] = index;
    });

    function metadataLabel(value, genericFallback) {
      var label = String(value || '').trim();
      if (!label || label === genericFallback || /^(autres comptes|compte historique|comptes personnalisés)$/i.test(label)) return '';
      return label;
    }

    function ensureNode(code, level, parent) {
      var key = level + ':' + code;
      var node = nodes[key];
      if (!node) {
        node = nodes[key] = {
          code: code, level: level, label: '', cls: 0, parent: null, children: [], childMap: Object.create(null),
          orderIndex: Number.MAX_SAFE_INTEGER, values: Object.create(null), accountCount: 0
        };
        fields.forEach(function (field) { node.values[field] = 0; });
      }
      if (parent) {
        if (!Object.prototype.hasOwnProperty.call(parent.childMap, key)) {
          parent.childMap[key] = true;
          parent.children.push(node);
        }
        node.parent = parent;
      } else if (!Object.prototype.hasOwnProperty.call(rootMap, key)) {
        rootMap[key] = true;
        roots.push(node);
      }
      var exactAccount = accountByCode[code];
      if (exactAccount && exactAccount.label) node.label = String(exactAccount.label);
      if (Object.prototype.hasOwnProperty.call(accountOrder, code)) node.orderIndex = Math.min(node.orderIndex, accountOrder[code]);
      return node;
    }

    detailReport.rows.forEach(function (row) {
      var code = String(row.code || '');
      if (!code) return;
      var account = accountByCode[code] || row;
      var classValue = classNumber(account);
      var maxLevel = Math.min(5, code.length);
      var firstLevel = Math.min(summaryLevel, maxLevel);
      var parent = null;
      for (var level = firstLevel; level <= maxLevel; level += 1) {
        var prefix = code.slice(0, level);
        var node = ensureNode(prefix, level, parent);
        node.cls = classValue || node.cls;
        if (Object.prototype.hasOwnProperty.call(accountOrder, code)) node.orderIndex = Math.min(node.orderIndex, accountOrder[code]);
        if (!node.label) {
          if (level === 1) node.label = metadataLabel(account.classLabel, 'Classe ' + prefix);
          else if (level === 2) node.label = metadataLabel(account.subclassLabel, '');
        }
        fields.forEach(function (field) {
          node.values[field] += Math.round((Number(row[field]) || 0) * factor);
        });
        node.accountCount += 1;
        parent = node;
      }
    });

    function compareNodes(left, right) {
      return left.orderIndex - right.orderIndex || left.code.localeCompare(right.code, 'fr', { numeric: true });
    }

    function toRow(node) {
      var row = {
        code: node.code,
        label: node.label || '',
        cls: node.cls,
        aux: false,
        rowType: 'summary',
        summaryLevel: node.level,
        accountCount: node.accountCount
      };
      fields.forEach(function (field) { row[field] = node.values[field] / factor; });
      return row;
    }

    function flatten(node, target) {
      target.push(toRow(node));
      node.children.sort(compareNodes).forEach(function (child) { flatten(child, target); });
    }

    roots.sort(compareNodes);
    var summaryRows = roots.map(toRow);
    var displayRows = [];
    if (includeLowerLevels) roots.forEach(function (node) { flatten(node, displayRows); });
    else displayRows = summaryRows.slice();
    return Object.assign({}, detailReport, {
      rows: summaryRows,
      displayRows: displayRows,
      detailRows: detailReport.rows,
      accountCount: summaryRows.length,
      detailAccountCount: detailReport.rows.length,
      summaryLevel: summaryLevel,
      includeLowerLevels: includeLowerLevels,
      filters: Object.assign({}, detailReport.filters, {
        summaryLevel: summaryLevel,
        includeLowerLevels: includeLowerLevels
      })
    });
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.slice(),
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    build: build,
    buildSummary: buildSummary
  };
});
