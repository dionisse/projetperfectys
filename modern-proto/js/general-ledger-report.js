/*
 * PERFECTO · Grand livre général par compte.
 * Calcul consultatif : reports d’ouverture, écritures validées et solde progressif sans mutation.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoGeneralLedgerReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', reportLabel: 'Date', exportLabel: 'Date', text: true, defaultSelected: true },
    { key: 'journal', label: 'Journal', reportLabel: 'Journal', exportLabel: 'Journal', text: true, defaultSelected: true },
    { key: 'piece', label: 'Pièce', reportLabel: 'Pièce', exportLabel: 'Pièce', text: true, defaultSelected: true },
    { key: 'reference', label: 'Référence', reportLabel: 'Référence', exportLabel: 'Référence', text: true, defaultSelected: true },
    { key: 'letteringDate', label: 'Date lettrage', reportLabel: 'Date lettrage', exportLabel: 'Date lettrage', text: true, defaultSelected: false },
    { key: 'debit', label: 'Débit', reportLabel: 'Débit', exportLabel: 'Débit', text: false, defaultSelected: true },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédit', exportLabel: 'Crédit', text: false, defaultSelected: true },
    { key: 'balance', label: 'Solde', reportLabel: 'Solde', exportLabel: 'Solde', text: false, defaultSelected: false },
    { key: 'fixedAsset', label: 'Immobilisation', reportLabel: 'Immobilisation', exportLabel: 'Immobilisation', text: true, defaultSelected: false },
    { key: 'market', label: 'Marché', reportLabel: 'Marché', exportLabel: 'Marché', text: true, defaultSelected: false, enabled: false },
    { key: 'analysis', label: 'Analyse diverse', reportLabel: 'Analyse diverse', exportLabel: 'Analyse diverse', text: true, defaultSelected: false },
    { key: 'label', label: 'Libellé', reportLabel: 'Libellé', exportLabel: 'Libellé', text: true, defaultSelected: true },
    { key: 'counterpart', label: 'Contrepartie', reportLabel: 'Contrepartie', exportLabel: 'Contrepartie', text: true, defaultSelected: true }
  ];

  var COLUMN_GROUPS = [
    ['date', 'journal', 'piece', 'reference', 'letteringDate'],
    ['debit', 'credit', 'balance', 'fixedAsset', 'market'],
    [],
    ['analysis', 'label', 'counterpart']
  ];

  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function monthLabel(value) {
    var year = Number(String(value || '').slice(0, 4));
    var month = Number(String(value || '').slice(5, 7));
    return month >= 1 && month <= 12 ? MONTHS[month - 1] + ' ' + year : String(value || '');
  }

  function finiteMinor(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    return Number.isSafeInteger(scaled) ? scaled : null;
  }

  function emptyResult(options, errors, parsedFilter) {
    return {
      ok: !errors.length,
      errors: errors,
      warnings: [],
      from: String(options.from || ''),
      to: String(options.to || ''),
      accounts: [],
      rows: [],
      displayRows: [],
      accountCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      movementEntryCount: 0,
      invalidLineCount: 0,
      invalidDateCount: 0,
      totals: { debit: 0, credit: 0, difference: 0 },
      accountFilter: parsedFilter || null,
      includeNonMoved: options.includeNonMoved === true,
      subtotalByMonth: options.subtotalByMonth === true,
      basis: { postedEntriesOnly: true, openingBalancesSeparate: true, priorEntriesIncludedInRunningBalance: true }
    };
  }

  function build(options) {
    options = options || {};
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var journals = Array.isArray(options.journals) ? options.journals : [];
    var matchingGroups = Array.isArray(options.matchingGroups) ? options.matchingGroups : [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var from = String(options.from || '');
    var to = String(options.to || '');
    var accountExpression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var parsedFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(accountExpression)
      : { valid: false, all: false, patterns: [], error: 'Le calcul de la balance générale n’est pas disponible.' };
    var errors = [];
    if (!parsedFilter.valid) errors.push(parsedFilter.error);
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour le grand livre.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (from < cycleStart || to > cycleEnd)) errors.push('Les dates du grand livre doivent rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    if (errors.length) return emptyResult(options, errors, parsedFilter);

    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var baseReport = GeneralBalanceReport.build({
      accounts: accounts,
      entries: entries,
      openingBalances: openingBalances,
      journals: journals,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      decimalPlaces: decimalPlaces,
      filters: { accounts: accountExpression, from: from, to: to, groupMode: 'none' }
    });
    if (!baseReport.ok) return emptyResult(options, baseReport.errors || ['Le grand livre n’a pas pu être calculé.'], parsedFilter);

    var accountByCode = Object.create(null);
    var accountOrder = Object.create(null);
    var openingBalanceByCode = Object.create(null);
    var movementsByCode = Object.create(null);
    var matchingDateByLineKey = Object.create(null);
    matchingGroups.forEach(function (group) {
      if (!group || group.status === 'cancelled') return;
      var date = String(group.letteringDate || group.date || group.createdAt || '').slice(0, 10);
      if (!isIsoDate(date)) return;
      (Array.isArray(group.lineKeys) ? group.lineKeys : []).forEach(function (lineKey) {
        matchingDateByLineKey[String(lineKey)] = date;
      });
    });
    accounts.forEach(function (account, index) {
      if (!account || account.code == null) return;
      accountByCode[String(account.code)] = account;
      accountOrder[String(account.code)] = index;
    });
    (baseReport.rows || []).forEach(function (row) {
      openingBalanceByCode[String(row.code)] = Math.round((Number(row.openingBalance) || 0) * factor);
    });

    function ensureMovementList(code) {
      if (!movementsByCode[code]) movementsByCode[code] = [];
      return movementsByCode[code];
    }

    var invalidDateCount = 0;
    var movementEntryIds = Object.create(null);
    entries.forEach(function (entry, entryIndex) {
      if (!entry || entry.status !== 'posted') return;
      var date = String(entry.date || '');
      if (!isIsoDate(date)) {
        invalidDateCount += 1;
        return;
      }
      if (date < from || date > to || date < cycleStart || date > cycleEnd) return;
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      lines.forEach(function (line, lineIndex) {
        if (!line) return;
        var code = String(line.account == null ? line.accountCode || '' : line.account);
        if (!code || !GeneralBalanceReport.accountMatches(code, parsedFilter)) return;
        var debitMinor = finiteMinor(line.debit, factor);
        var creditMinor = finiteMinor(line.credit, factor);
        if (debitMinor === null || creditMinor === null) return;
        var counterpartCodes = [];
        lines.forEach(function (otherLine, otherIndex) {
          if (!otherLine || otherIndex === lineIndex) return;
          var otherCode = String(otherLine.account == null ? otherLine.accountCode || '' : otherLine.account);
          if (otherCode && otherCode !== code && counterpartCodes.indexOf(otherCode) === -1) counterpartCodes.push(otherCode);
        });
        counterpartCodes.sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); });
        var counterpart = counterpartCodes.map(function (otherCode) {
          var account = accountByCode[otherCode];
          return otherCode + (account && account.label ? ' — ' + String(account.label) : '');
        }).join(' · ');
        var lineRows = ensureMovementList(code);
        var rowKey = String(entry.id || entry.reference || ('entry-' + entryIndex)) + ':' + lineIndex;
        lineRows.push({
          key: rowKey,
          accountCode: code,
          date: date,
          journal: String(entry.journal || entry.journalCode || ''),
          piece: String(line.piece || line.pieceReference || entry.reference || entry.internalNumber || ''),
          reference: String(line.reference || entry.sourceReference || ''),
          letteringDate: String(line.letteringDate || line.dateLettrage || entry.letteringDate || entry.dateLettrage || matchingDateByLineKey[rowKey] || ''),
          fixedAsset: String(line.fixedAssetCode || line.assetCode || entry.fixedAssetCode || ''),
          market: String(line.market || entry.market || ''),
          analysis: String(line.analyticCode || line.analysis || entry.analysis || ''),
          label: String(line.description || entry.description || ''),
          counterpart: counterpart,
          debit: debitMinor / factor,
          credit: creditMinor / factor,
          debitMinor: debitMinor,
          creditMinor: creditMinor,
          counterpartCodes: counterpartCodes.slice(),
          rowType: 'movement'
        });
        var entryKey = String(entry.id || entry.reference || ('entry-' + entryIndex));
        movementEntryIds[entryKey] = true;
      });
    });

    var codes = Object.keys(movementsByCode);
    if (options.includeNonMoved === true) {
      accounts.forEach(function (account) {
        if (!account || account.code == null || account.postable === false) return;
        var code = String(account.code);
        if (GeneralBalanceReport.accountMatches(code, parsedFilter) && codes.indexOf(code) === -1) codes.push(code);
      });
    }
    codes.sort(function (left, right) {
      var leftIndex = Object.prototype.hasOwnProperty.call(accountOrder, left) ? accountOrder[left] : Number.MAX_SAFE_INTEGER;
      var rightIndex = Object.prototype.hasOwnProperty.call(accountOrder, right) ? accountOrder[right] : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.localeCompare(right, 'fr', { numeric: true });
    });

    var reportAccounts = [];
    var flatRows = [];
    var flatDisplayRows = [];
    var totalDebitMinor = 0;
    var totalCreditMinor = 0;
    var lineCount = 0;
    var generatedLineCount = 0;
    codes.forEach(function (code) {
      var account = accountByCode[code] || { code: code, label: code };
      var movements = movementsByCode[code] || [];
      if (!movements.length && options.includeNonMoved !== true) return;
      movements.sort(function (left, right) {
        return left.date.localeCompare(right.date) ||
          left.piece.localeCompare(right.piece, 'fr', { numeric: true, sensitivity: 'base' }) ||
          left.journal.localeCompare(right.journal, 'fr', { numeric: true, sensitivity: 'base' }) ||
          left.key.localeCompare(right.key, 'fr', { numeric: true });
      });
      var openingMinor = Number.isSafeInteger(openingBalanceByCode[code]) ? openingBalanceByCode[code] : 0;
      var runningMinor = openingMinor;
      var debitMinorTotal = 0;
      var creditMinorTotal = 0;
      var displayRows = [];
      var monthDebitMinor = 0;
      var monthCreditMinor = 0;
      var currentMonth = '';

      function pushMonthSubtotal(month) {
        if (!month || !options.subtotalByMonth || (monthDebitMinor === 0 && monthCreditMinor === 0)) return;
        displayRows.push({
          key: code + ':subtotal:' + month,
          accountCode: code,
          date: '', journal: '', piece: '', reference: '', letteringDate: '', fixedAsset: '', market: '', analysis: '',
          label: 'Sous-total ' + monthLabel(month), counterpart: '',
          debit: monthDebitMinor / factor,
          credit: monthCreditMinor / factor,
          balance: runningMinor / factor,
          debitMinor: monthDebitMinor,
          creditMinor: monthCreditMinor,
          balanceMinor: runningMinor,
          rowType: 'monthly-subtotal',
          subtotalLabel: 'Sous-total ' + monthLabel(month)
        });
        generatedLineCount += 1;
        monthDebitMinor = 0;
        monthCreditMinor = 0;
      }

      movements.forEach(function (row, index) {
        var month = row.date.slice(0, 7);
        if (currentMonth && month !== currentMonth) pushMonthSubtotal(currentMonth);
        currentMonth = month;
        runningMinor += row.debitMinor - row.creditMinor;
        row.balanceMinor = runningMinor;
        row.balance = runningMinor / factor;
        debitMinorTotal += row.debitMinor;
        creditMinorTotal += row.creditMinor;
        totalDebitMinor += row.debitMinor;
        totalCreditMinor += row.creditMinor;
        monthDebitMinor += row.debitMinor;
        monthCreditMinor += row.creditMinor;
        lineCount += 1;
        generatedLineCount += 1;
        displayRows.push(row);
        if (index === movements.length - 1) pushMonthSubtotal(currentMonth);
      });

      var section = {
        code: code,
        label: String(account.label || code),
        openingBalance: openingMinor / factor,
        closingBalance: runningMinor / factor,
        debit: debitMinorTotal / factor,
        credit: creditMinorTotal / factor,
        lineCount: movements.length,
        rows: movements,
        displayRows: displayRows
      };
      reportAccounts.push(section);
      Array.prototype.push.apply(flatRows, movements);
      Array.prototype.push.apply(flatDisplayRows, displayRows);
    });

    var warnings = [];
    if (baseReport.invalidLineCount) warnings.push(baseReport.invalidLineCount + (baseReport.invalidLineCount === 1
      ? ' ligne source contenant un montant invalide a été ignorée.'
      : ' lignes sources contenant un montant invalide ont été ignorées.'));
    if (invalidDateCount) warnings.push(invalidDateCount + (invalidDateCount === 1
      ? ' écriture validée avec une date invalide n’a pas été retenue.'
      : ' écritures validées avec une date invalide n’ont pas été retenues.'));

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      from: from,
      to: to,
      accounts: reportAccounts,
      rows: flatRows,
      displayRows: flatDisplayRows,
      accountCount: reportAccounts.length,
      lineCount: lineCount,
      generatedLineCount: generatedLineCount,
      movementEntryCount: Object.keys(movementEntryIds).length,
      invalidLineCount: baseReport.invalidLineCount,
      invalidDateCount: invalidDateCount,
      totals: { debit: totalDebitMinor / factor, credit: totalCreditMinor / factor, difference: (totalDebitMinor - totalCreditMinor) / factor },
      accountFilter: parsedFilter,
      includeNonMoved: options.includeNonMoved === true,
      subtotalByMonth: options.subtotalByMonth === true,
      basis: {
        postedEntriesOnly: true,
        openingBalancesSeparate: true,
        openingBalanceDateBeforePeriod: true,
        priorEntriesIncludedInRunningBalance: true,
        cutoffDateInclusive: true,
        sourceReferenceOnly: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    COLUMN_GROUPS: COLUMN_GROUPS.map(function (group) { return group.slice(); }),
    build: build,
    monthLabel: monthLabel
  };
});
