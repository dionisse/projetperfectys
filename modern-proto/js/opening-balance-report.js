/*
 * PERFECTO · Balance d’ouverture des comptes généraux.
 * Lecture seule : restitue le registre dédié des reports à nouveau, sans reprendre les exemples des PDF.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoOpeningBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'code', label: 'Code du compte', reportLabel: 'Compte', exportLabel: 'Compte', defaultSelected: true, text: true },
    { key: 'label', label: 'Intitulé du compte', reportLabel: 'Intitulé', exportLabel: 'Intitulé', defaultSelected: true, text: true },
    { key: 'lines', label: 'Lignes', reportLabel: 'Lignes', exportLabel: 'Lignes', defaultSelected: true, text: false },
    { key: 'debit', label: 'Débit', reportLabel: 'Débits', exportLabel: 'Débits', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédits', exportLabel: 'Crédits', defaultSelected: true, text: false },
    { key: 'currency', label: 'En devise', reportLabel: 'En Devise', exportLabel: 'En Devise', defaultSelected: true, text: false }
  ];

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function previousIsoDate(value) {
    if (!isIsoDate(value)) return '';
    var parts = value.split('-').map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() - 1);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function accountClass(account) {
    var value = Number(account && account.cls);
    if (Number.isInteger(value)) return value;
    return Number(String(account && account.code || '').charAt(0));
  }

  function validOpeningBalanceRecord(record, accountByCode, sourceDate) {
    if (!record || typeof record !== 'object') return false;
    var code = String(record.accountCode == null ? '' : record.accountCode).trim();
    var account = accountByCode[code];
    var cls = accountClass(account);
    var debit = Number(record.debit);
    var credit = Number(record.credit);
    return !!code && !!account && Number.isInteger(cls) && cls >= 1 && cls <= 5 && account.postable !== false &&
      record.date === sourceDate && Number.isSafeInteger(debit) && debit >= 0 && Number.isSafeInteger(credit) && credit >= 0 &&
      !((debit > 0 && credit > 0) || (debit === 0 && credit === 0));
  }

  function emptyResult(options, errors, invalidLineCount, parsedFilter) {
    return {
      ok: !errors.length,
      errors: errors,
      warnings: [],
      reportDate: String(options.reportDate || ''),
      sourceDate: String(options.sourceDate || ''),
      rows: [],
      displayRows: [],
      sourceRecords: [],
      totals: { accountCount: 0, lines: 0, debit: 0, credit: 0, difference: 0, balanced: true },
      lineCount: 0,
      invalidLineCount: invalidLineCount || 0,
      accountFilter: parsedFilter || null,
      subtotals: options.subtotals === true,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        foreignCurrencyAmountsAvailable: false
      }
    };
  }

  function build(options) {
    options = options || {};
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var reportDate = String(options.reportDate || '');
    var sourceDate = String(options.sourceDate || '');
    var accountExpression = options.accountFilter == null ? '*' : String(options.accountFilter);
    var parsedFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(accountExpression)
      : { valid: false, all: false, tokens: [], patterns: [], error: 'Le calcul de la balance générale n’est pas disponible.' };
    var errors = [];
    if (!parsedFilter.valid) errors.push(parsedFilter.error);
    if (!isIsoDate(reportDate)) errors.push('La date de la balance d’ouverture doit être le début du cycle du dossier.');
    if (!isIsoDate(sourceDate) || sourceDate !== previousIsoDate(reportDate)) {
      errors.push('Le registre doit contenir les reports datés de la veille du début du cycle.');
    }
    if (errors.length) return emptyResult(options, errors, 0, parsedFilter);

    var accountByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountByCode[String(account.code)] = account;
    });
    var selectedRecords = [];
    var invalidLineCount = 0;
    openingBalances.forEach(function (record) {
      var code = String(record && record.accountCode != null ? record.accountCode : '').trim();
      if (!GeneralBalanceReport.accountMatches(code, parsedFilter)) return;
      if (!validOpeningBalanceRecord(record, accountByCode, sourceDate)) {
        invalidLineCount += 1;
        return;
      }
      selectedRecords.push(record);
    });

    var debitTotal = 0;
    var creditTotal = 0;
    var totalsOverflow = false;
    var detailLineCounts = Object.create(null);
    var prefixLineCounts = Object.create(null);
    selectedRecords.forEach(function (record) {
      var debit = Number(record.debit);
      var credit = Number(record.credit);
      debitTotal += debit;
      creditTotal += credit;
      if (!Number.isSafeInteger(debitTotal) || !Number.isSafeInteger(creditTotal)) totalsOverflow = true;
      var code = String(record.accountCode);
      detailLineCounts[code] = (detailLineCounts[code] || 0) + 1;
      for (var length = 1; length <= code.length; length += 1) {
        var prefix = code.slice(0, length);
        prefixLineCounts[prefix] = (prefixLineCounts[prefix] || 0) + 1;
      }
    });
    if (totalsOverflow) {
      errors.push('Les totaux dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.');
      return emptyResult(options, errors, invalidLineCount, parsedFilter);
    }

    var detailReport = GeneralBalanceReport.build({
      accounts: accounts,
      entries: [],
      openingBalances: selectedRecords,
      journals: [],
      cycleStart: reportDate,
      cycleEnd: reportDate,
      decimalPlaces: 0,
      filters: {
        accounts: '*',
        from: reportDate,
        to: reportDate,
        groupMode: options.subtotals === true ? 'subtotals' : 'none'
      }
    });
    if (!detailReport.ok) errors = errors.concat(detailReport.errors || []);
    if (errors.length) return emptyResult(options, errors, invalidLineCount, parsedFilter);

    function addReportFields(row) {
      var rowType = row.rowType || 'account';
      var code = String(row.code || '');
      var subtotalCode = rowType === 'subtotal' ? code.replace(/^Total\s+/, '') : '';
      return Object.assign({}, row, {
        lines: rowType === 'subtotal' ? (prefixLineCounts[subtotalCode] || 0) : (detailLineCounts[code] || 0),
        debit: Number(row.openingDebit) || 0,
        credit: Number(row.openingCredit) || 0,
        currency: ''
      });
    }

    var rows = detailReport.rows.map(addReportFields);
    var displayRows = (detailReport.displayRows || detailReport.rows).filter(function (row) {
      return row.rowType !== 'subtotal' || String(row.label || '').trim();
    }).map(addReportFields);
    var difference = debitTotal - creditTotal;
    var warnings = [];
    if (invalidLineCount) warnings.push(invalidLineCount + (invalidLineCount === 1 ? ' ligne de report invalide a été écartée.' : ' lignes de report invalides ont été écartées.'));
    if (difference !== 0) warnings.push('Les reports sélectionnés ne sont pas équilibrés ; l’écart est affiché sans correction.');

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      reportDate: reportDate,
      sourceDate: sourceDate,
      rows: rows,
      displayRows: displayRows,
      sourceRecords: selectedRecords.map(function (record) { return Object.assign({}, record); }),
      totals: {
        accountCount: rows.length,
        lines: selectedRecords.length,
        debit: debitTotal,
        credit: creditTotal,
        difference: difference,
        balanced: difference === 0
      },
      lineCount: selectedRecords.length,
      invalidLineCount: invalidLineCount,
      accountFilter: parsedFilter,
      subtotals: options.subtotals === true,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        foreignCurrencyAmountsAvailable: false,
        grossDebitAndCreditRetained: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
