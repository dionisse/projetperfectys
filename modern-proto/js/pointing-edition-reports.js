/*
 * PERFECTO · États du pointage et des rapprochements bancaires.
 * Lecture seule : écritures validées et marqueurs explicites du registre de pointage.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoPointingEditionReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var DEFINITIONS = {
    'edition-pointed-entries': {
      id: 'edition-pointed-entries', kind: 'pointed', title: 'Écritures pointées',
      filters: ['accounts', 'from', 'to'], accountPrintMode: true, columnStacks: 2,
      fromLabel: 'Début', toLabel: 'Fin', movedAccountsLabel: 'Comptes mouvementés uniquement (dans la période)',
      columns: [
        { key: 'pointingDate', label: 'Date pointage', text: true },
        { key: 'entryDate', label: 'Date écriture', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-unpointed-entries': {
      id: 'edition-unpointed-entries', kind: 'unpointed', title: 'Écritures non pointées',
      filters: ['accounts', 'to'], columnStacks: 2,
      toLabel: 'Date',
      columns: [
        { key: 'entryDate', label: 'Date écriture', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-pointing-balance-justification': {
      id: 'edition-pointing-balance-justification', kind: 'justification', title: 'Justification des soldes par pointage',
      filters: ['accounts', 'to'], accountPrintMode: true, columnStacks: 3,
      toLabel: 'Date', movedAccountsLabel: 'Comptes mouvementés dans la période',
      columns: [
        { key: 'entryDate', label: 'Date écriture', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-bank-reconciliation': {
      id: 'edition-bank-reconciliation', kind: 'bank-reconciliation', title: 'Rapprochements bancaires',
      filters: ['accounts', 'to'], accountPrintMode: true, hasSignatories: true, columnStacks: 3,
      toLabel: 'Date', movedAccountsLabel: 'Comptes mouvementés pendant l’exercice',
      columns: [
        { key: 'entryDate', label: 'Date écriture', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-bank-statement': {
      id: 'edition-bank-statement', kind: 'bank-statement', title: 'Relevé de banque',
      filters: ['accounts', 'statementId', 'from', 'to'], columnStacks: 3,
      fromLabel: 'Début', toLabel: 'Fin',
      columns: [
        { key: 'statementDate', label: 'Date', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'description', label: 'Libellé', text: true },
        { key: 'statementDebit', label: 'Débit banque', text: false },
        { key: 'statementCredit', label: 'Crédit banque', text: false },
        { key: 'status', label: 'État', text: true, required: true },
        { key: 'ledgerReference', label: 'Référence écriture associée', text: true }
      ]
    }
  };

  function cloneDefinition(definition) {
    if (!definition) return null;
    return Object.assign({}, definition, {
      filters: definition.filters.slice(),
      columns: definition.columns.map(function (column) {
        return Object.assign({ defaultSelected: true }, column);
      })
    });
  }

  function definitionFor(reportId) {
    return cloneDefinition(DEFINITIONS[String(reportId || '')]);
  }

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function baseResult(reportId, definition, options, errors, warnings, accountFilter, from, to) {
    var signatories = options.signatories && typeof options.signatories === 'object' ? options.signatories : {};
    return {
      ok: !errors.length,
      reportId: reportId,
      kind: definition ? definition.kind : '',
      title: definition ? definition.title : '',
      errors: errors.slice(),
      warnings: warnings.slice(),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      from: from || '',
      to: to || '',
      accountFilter: accountFilter || null,
      accountScope: options.accountScope === 'moved' ? 'moved' : 'all',
      statementId: String(options.statementId == null ? '*' : options.statementId),
      signatories: {
        center: String(signatories.center || ''),
        centerName: String(signatories.centerName || ''),
        left: String(signatories.left || ''),
        leftName: String(signatories.leftName || ''),
        right: String(signatories.right || ''),
        rightName: String(signatories.rightName || '')
      },
      rows: [],
      displayAccounts: [],
      displayStatements: [],
      dataAvailable: false,
      generatedLineCount: 0,
      basis: {
        explicitPointageRegisterOnly: true,
        postedEntrySourcesOnly: true,
        bankReconciliationRequiresExplicitBankStatementLink: true,
        allAccountCodesAllowed: true,
        noAccountingMutation: true,
        noBalanceRecalculation: true
      }
    };
  }

  function parseLineKey(value) {
    var key = String(value || '');
    var separator = key.lastIndexOf(':');
    if (separator <= 0) return null;
    var index = Number(key.slice(separator + 1));
    if (!Number.isInteger(index) || index < 0) return null;
    return { entryId: key.slice(0, separator), lineIndex: index };
  }

  function pointageDate(mark) {
    var statementDate = String(mark && mark.statementDate || '').slice(0, 10);
    if (isIsoDate(statementDate)) return statementDate;
    var recordedDate = String(mark && mark.createdAt || '').slice(0, 10);
    return isIsoDate(recordedDate) ? recordedDate : '';
  }

  function rowFromMark(mark, context) {
    var parsed = parseLineKey(mark && mark.lineKey);
    if (!parsed) return null;
    if (mark.entryId && String(mark.entryId) !== parsed.entryId) return null;
    if (mark.lineIndex != null && Number(mark.lineIndex) !== parsed.lineIndex) return null;
    var entry = context.entriesById[parsed.entryId];
    if (!entry || entry.status !== 'posted' || !isIsoDate(entry.date)) return null;
    if (entry.date < context.cycleStart || entry.date > context.cycleEnd || entry.date > context.to) return null;
    var line = Array.isArray(entry.lines) ? entry.lines[parsed.lineIndex] : null;
    if (!line) return null;
    var code = String(line.account == null ? line.accountCode || '' : line.account);
    if (!code || code !== String(mark.accountCode || '') || !GeneralBalanceReport.accountMatches(code, context.accountFilter)) return null;
    var account = context.accountsByCode[code];
    return {
      lineKey: String(mark.lineKey),
      accountCode: code,
      accountLabel: account ? String(account.label || '') : '',
      pointageCode: String(mark.code || ''),
      pointageDate: pointageDate(mark),
      entryDate: String(entry.date),
      reference: String(line.reference || line.sourceReference || entry.sourceReference || entry.reference || ''),
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      label: String(line.description || entry.description || '')
    };
  }

  function sortRows(rows) {
    return rows.sort(function (left, right) {
      return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) ||
        left.entryDate.localeCompare(right.entryDate, 'fr') ||
        left.reference.localeCompare(right.reference, 'fr', { numeric: true }) ||
        left.lineKey.localeCompare(right.lineKey, 'fr', { numeric: true });
    });
  }

  function accountListForReport(accounts, rows, accountFilter, accountScope, includeAllSelected) {
    var byCode = Object.create(null);
    if (includeAllSelected && accountScope !== 'moved') {
      (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
        if (!account || account.code == null) return;
        var code = String(account.code);
        if (GeneralBalanceReport.accountMatches(code, accountFilter)) byCode[code] = String(account.label || '');
      });
    }
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !row.accountCode || !GeneralBalanceReport.accountMatches(row.accountCode, accountFilter)) return;
      if (!Object.prototype.hasOwnProperty.call(byCode, row.accountCode)) byCode[row.accountCode] = String(row.accountLabel || '');
    });
    return Object.keys(byCode).map(function (code) {
      return { code: code, label: byCode[code] };
    }).sort(function (left, right) {
      return left.code.localeCompare(right.code, 'fr', { numeric: true });
    });
  }

  function statementLineReference(mark, entriesById) {
    var parsed = parseLineKey(mark && mark.lineKey);
    if (parsed && (!mark.entryId || String(mark.entryId) === parsed.entryId)) {
      var entry = entriesById[parsed.entryId];
      var line = entry && entry.status === 'posted' && Array.isArray(entry.lines) ? entry.lines[parsed.lineIndex] : null;
      if (line) return String(line.reference || line.sourceReference || entry.sourceReference || entry.reference || mark.reference || '');
    }
    return String(mark && mark.reference || '');
  }

  function buildBankStatementRows(statementRecords, options) {
    var selectedId = String(options.statementId == null ? '*' : options.statementId);
    var accountFilter = options.accountFilter;
    var from = String(options.from || '');
    var to = String(options.to || '');
    var accountsByCode = options.accountsByCode || Object.create(null);
    var entriesById = options.entriesById || Object.create(null);
    var marksByStatementRow = options.marksByStatementRow || Object.create(null);
    var rows = [];
    var displayStatements = [];
    (Array.isArray(statementRecords) ? statementRecords : []).forEach(function (statement) {
      if (!statement || !statement.id || !statement.accountCode || !Array.isArray(statement.rows)) return;
      if (options.dossierId && String(statement.dossierId || '') !== String(options.dossierId)) return;
      var statementId = String(statement.id);
      var accountCode = String(statement.accountCode);
      if (!GeneralBalanceReport.accountMatches(accountCode, accountFilter)) return;
      if (selectedId !== '*' && selectedId !== 'all' && selectedId !== statementId) return;
      var account = accountsByCode[accountCode];
      var statementInfo = {
        id: statementId,
        accountCode: accountCode,
        accountLabel: account ? String(account.label || '') : '',
        fileName: String(statement.fileName || ''),
        importedAt: String(statement.importedAt || ''),
        sheetName: String(statement.sheetName || ''),
        rowCount: Number(statement.rowCount) || statement.rows.length,
        validCount: Number(statement.validCount) || 0,
        invalidCount: Number(statement.invalidCount) || 0
      };
      displayStatements.push(statementInfo);
      statement.rows.forEach(function (sourceRow) {
        if (!sourceRow || sourceRow.id == null) return;
        var rowDate = String(sourceRow.date || '');
        var dateValid = isIsoDate(rowDate);
        if (dateValid && (rowDate < from || rowDate > to)) return;
        var rowId = String(sourceRow.id);
        var marks = marksByStatementRow[statementId + '|' + rowId] || [];
        var valid = sourceRow.valid === true && dateValid;
        var markAccountMatches = marks.length === 1 && String(marks[0].accountCode || '') === accountCode;
        var mark = valid && markAccountMatches ? marks[0] : null;
        var duplicateMarks = valid && marks.length > 1;
        var mismatchedMark = valid && marks.length === 1 && !markAccountMatches;
        var rowErrors = Array.isArray(sourceRow.errors) ? sourceRow.errors.map(String) : [];
        if (duplicateMarks) rowErrors.push('Plusieurs marqueurs de pointage actifs référencent cette ligne de relevé.');
        if (mismatchedMark) rowErrors.push('Le compte du marqueur de pointage ne correspond pas au compte du relevé.');
        rows.push({

          lineKey: statementId + ':' + rowId,
          statementId: statementId,
          statementFileName: statementInfo.fileName,
          statementImportedAt: statementInfo.importedAt,
          statementRowNumber: Number(sourceRow.rowNumber) || '',
          accountCode: accountCode,
          accountLabel: statementInfo.accountLabel,
          statementDate: rowDate,
          dateValid: dateValid,
          reference: String(sourceRow.reference || ''),
          description: String(sourceRow.description || ''),
          statementDebit: Number(sourceRow.statementDebit) || 0,
          statementCredit: Number(sourceRow.statementCredit) || 0,
          status: !valid || duplicateMarks || mismatchedMark ? 'À contrôler' : (mark ? 'Pointée' : 'Non pointée'),
          rowErrors: rowErrors,
          ledgerReference: mark ? statementLineReference(mark, entriesById) : ''
        });
      });
    });
    rows.sort(function (left, right) {
      return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) ||
        left.statementFileName.localeCompare(right.statementFileName, 'fr') ||
        left.statementDate.localeCompare(right.statementDate, 'fr') ||
        Number(left.statementRowNumber || 0) - Number(right.statementRowNumber || 0);
    });
    return { rows: rows, displayStatements: displayStatements };
  }

  function buildReport(reportId, options) {
    options = options || {};
    reportId = String(reportId || '');
    var definition = DEFINITIONS[reportId];
    if (!definition) return baseResult(reportId, null, options, ['État du pointage ou du rapprochement bancaire inconnu.'], [], null, '', '');

    var errors = [];
    var warnings = [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!GeneralBalanceReport || !GeneralBalanceReport.parseAccountFilter || !GeneralBalanceReport.accountMatches) {
      errors.push('Le sélecteur de comptes n’est pas disponible.');
    }
    var accountFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter)
      : null;
    if (accountFilter && !accountFilter.valid) errors.push(accountFilter.error);

    var isStatementReport = definition.kind === 'bank-statement';
    var hasPeriod = definition.kind === 'pointed' || isStatementReport;
    var from = String(options.from || (hasPeriod ? cycleStart : ''));
    var to = String(options.to || cycleEnd);
    if (hasPeriod) {
      if (!isIsoDate(from) || !isIsoDate(to)) errors.push(isStatementReport ? 'Indiquez des dates valides pour la période du relevé.' : 'Indiquez des dates valides pour les écritures pointées.');
      else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
      else if (!isStatementReport && (from < cycleStart || to > cycleEnd)) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    } else {
      if (!isIsoDate(to)) errors.push('Indiquez une date valide pour l’état de pointage.');
      else if (to < cycleStart || to > cycleEnd) errors.push('La date doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));
    if (errors.length) return baseResult(reportId, definition, options, errors, warnings, accountFilter, hasPeriod ? from : '', to);

    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var pointageMarks = Array.isArray(options.pointageMarks) ? options.pointageMarks : [];
    var bankStatements = Array.isArray(options.bankStatements) ? options.bankStatements : [];
    var accountsByCode = Object.create(null);
    var entriesById = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountsByCode[String(account.code)] = account;
    });
    entries.forEach(function (entry) {
      if (entry && entry.id != null) entriesById[String(entry.id)] = entry;
    });

    var activeMarksByLine = Object.create(null);
    var marksByStatementRow = Object.create(null);
    pointageMarks.forEach(function (mark) {
      if (!mark || mark.status === 'cancelled') return;
      var key = String(mark.lineKey || '');
      if (key) {
        if (!activeMarksByLine[key]) activeMarksByLine[key] = [];
        activeMarksByLine[key].push(mark);
      }
      if (mark.bankStatementId && mark.bankStatementRowId) {
        var statementKey = String(mark.bankStatementId) + '|' + String(mark.bankStatementRowId);
        if (!marksByStatementRow[statementKey]) marksByStatementRow[statementKey] = [];
        marksByStatementRow[statementKey].push(mark);
      }
    });

    var rows = [];
    var displayStatements = [];
    var context = {
      accountsByCode: accountsByCode,
      entriesById: entriesById,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      to: to,
      accountFilter: accountFilter
    };
    if (definition.kind === 'bank-statement') {
      var statementReport = buildBankStatementRows(bankStatements, {
        dossierId: options.dossierId,
        statementId: options.statementId,
        accountFilter: accountFilter,
        from: from,
        to: to,
        accountsByCode: accountsByCode,
        entriesById: entriesById,
        marksByStatementRow: marksByStatementRow
      });
      rows = statementReport.rows;
      displayStatements = statementReport.displayStatements;
    } else if (definition.kind === 'unpointed') {
      entries.forEach(function (entry) {
        if (!entry || entry.status !== 'posted' || !isIsoDate(entry.date)) return;
        if (entry.date < cycleStart || entry.date > cycleEnd || entry.date > to) return;
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
          if (!line) return;
          var code = String(line.account == null ? line.accountCode || '' : line.account);
          if (!code || !GeneralBalanceReport.accountMatches(code, accountFilter)) return;
          var lineKey = String(entry.id || '') + ':' + lineIndex;
          if ((activeMarksByLine[lineKey] || []).length) return;
          var account = accountsByCode[code];
          rows.push({
            lineKey: lineKey,
            accountCode: code,
            accountLabel: account ? String(account.label || '') : '',
            pointageCode: '',
            pointageDate: '',
            entryDate: String(entry.date),
            reference: String(line.reference || line.sourceReference || entry.sourceReference || entry.reference || ''),
            debit: Number(line.debit) || 0,
            credit: Number(line.credit) || 0,
            label: String(line.description || entry.description || '')
          });
        });
      });
    } else {
      var bankOnly = definition.kind === 'bank-reconciliation';
      Object.keys(activeMarksByLine).forEach(function (lineKey) {
        var marks = activeMarksByLine[lineKey];
        if (marks.length !== 1) return;
        var mark = marks[0];
        if (bankOnly && !(mark.bankStatementId && mark.bankStatementRowId)) return;
        var row = rowFromMark(mark, context);
        if (!row) return;
        if (hasPeriod && (row.entryDate < from || row.entryDate > to)) return;
        rows.push(row);
      });
    }
    if (definition.kind !== 'bank-statement') sortRows(rows);

    var accountScope = options.accountScope === 'moved' ? 'moved' : 'all';
    var displayAccounts = accountListForReport(accounts, rows, accountFilter, accountScope, !!definition.accountPrintMode);
    var report = baseResult(reportId, definition, options, [], warnings, accountFilter, hasPeriod ? from : '', to);
    report.ok = true;
    report.rows = rows;
    report.displayAccounts = displayAccounts;
    report.displayStatements = displayStatements;
    report.dataAvailable = rows.length > 0;
    report.generatedLineCount = rows.length;
    report.accountScope = accountScope;
    report.signatories = {
      center: String(options.signatories && options.signatories.center || ''),
      centerName: String(options.signatories && options.signatories.centerName || ''),
      left: String(options.signatories && options.signatories.left || ''),
      leftName: String(options.signatories && options.signatories.leftName || ''),
      right: String(options.signatories && options.signatories.right || ''),
      rightName: String(options.signatories && options.signatories.rightName || '')
    };
    report.basis.cycleStart = cycleStart;
    report.basis.cycleEnd = cycleEnd;
    report.basis.selectedFrom = hasPeriod ? from : '';
    report.basis.selectedTo = to;
    report.basis.pointageMarksRead = pointageMarks.length;
    report.basis.bankStatementLinkedRowsOnly = definition.kind === 'bank-reconciliation';
    report.basis.importedBankStatementRowsOnly = definition.kind === 'bank-statement';
    if (definition.kind === 'bank-statement') {
      warnings.push('Les lignes sont restituées depuis les relevés importés conservés dans le stockage local du navigateur. Les correspondances viennent uniquement des marqueurs de pointage enregistrés ; aucun rapprochement n’est simulé.');
      var checkCount = rows.filter(function (row) { return row.status === 'À contrôler'; }).length;
      if (checkCount) warnings.push(checkCount + ' ligne(s) à contrôler sont conservées dans le relevé, avec leurs erreurs source.');
    } else if (definition.kind === 'bank-reconciliation') {
      warnings.push('Seuls les pointages actifs portant une référence explicite de relevé et de ligne de relevé sont présentés. Aucun écart bancaire ni solde n’est recalculé.');
    } else if (definition.kind === 'justification') {
      warnings.push('Les lignes proviennent des pointages actifs et des écritures validées à la date choisie. Aucun solde, écart ou rapprochement n’est recalculé.');
    } else if (definition.kind === 'unpointed') {
      warnings.push('Écritures validées sans marqueur de pointage actif à la date choisie ; aucun mouvement ni pointage n’est simulé.');
    } else {
      warnings.push('Les écritures validées sont reliées au registre de pointage actif. La date pointage utilise la date de relevé enregistrée, sinon la date de création du marqueur.');
    }
    report.warnings = warnings.slice();
    return report;
  }

  return {
    REPORT_IDS: Object.keys(DEFINITIONS),
    definitionFor: definitionFor,
    buildReport: buildReport
  };
});
