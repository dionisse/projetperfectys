/* PERFECTO · Lecture locale et normalisation d’un relevé bancaire tabulaire.
   Aucun envoi réseau, aucune dépendance à un format bancaire propriétaire. */
(function (root) {
  'use strict';

  var MAX_ROWS = 20000;
  var MAX_FILE_BYTES = 5 * 1024 * 1024;
  var MAX_CELL_LENGTH = 10000;
  var ALIASES = {
    date: ['DATE', 'DATE OPERATION', 'DATE DE OPERATION', 'DATE VALEUR', 'DATE DE VALEUR', 'DATE COMPTABLE', 'TRANSACTION DATE', 'VALUE DATE', 'OPERATION DATE'],
    description: ['LIBELLE', 'DESCRIPTION', 'MOTIF', 'OPERATION', 'TRANSACTION', 'DETAIL', 'DETAILS', 'NATURE', 'COMMUNICATION'],
    reference: ['REFERENCE', 'REF', 'REFERENCE BANQUE', 'NO OPERATION', 'NUMERO OPERATION', 'NUMERO TRANSACTION', 'TRANSACTION ID', 'CHEQUE', 'DOCUMENT'],
    debit: ['DEBIT', 'DEBIT XOF', 'MONTANT DEBIT', 'MONTANT DEBITE', 'DEBIT BANQUE', 'DEBIT AMOUNT', 'SORTIE', 'RETRAIT', 'WITHDRAWAL'],
    credit: ['CREDIT', 'CREDIT XOF', 'MONTANT CREDIT', 'MONTANT CREDITE', 'CREDIT BANQUE', 'CREDIT AMOUNT', 'ENTREE', 'VERSEMENT', 'DEPOSIT'],
    amount: ['MONTANT', 'MONTANT XOF', 'AMOUNT', 'TRANSACTION AMOUNT', 'VALEUR']
  };

  function normalizeHeader(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  function columnIndex(headers, field) {
    var values = (headers || []).map(normalizeHeader);
    var aliases = ALIASES[field] || [];
    for (var a = 0; a < aliases.length; a += 1) {
      var exact = normalizeHeader(aliases[a]);
      var exactIndex = values.indexOf(exact);
      if (exactIndex !== -1) return exactIndex;
    }
    for (var i = 0; i < values.length; i += 1) {
      for (var j = 0; j < aliases.length; j += 1) {
        var candidate = normalizeHeader(aliases[j]);
        if (candidate.length >= 5 && values[i].indexOf(candidate) !== -1) return i;
      }
    }
    return -1;
  }

  function detectHeaderIndex(rows) {
    var limit = Math.min(20, (rows || []).length);
    var bestIndex = -1;
    var bestScore = -1;
    for (var i = 0; i < limit; i += 1) {
      var headers = rows[i] || [];
      var date = columnIndex(headers, 'date');
      var debit = columnIndex(headers, 'debit');
      var credit = columnIndex(headers, 'credit');
      var amount = columnIndex(headers, 'amount');
      if (date < 0) continue;
      var score = 3 + (debit >= 0 ? 1 : 0) + (credit >= 0 ? 1 : 0) + (amount >= 0 ? 1 : 0) +
        (columnIndex(headers, 'description') >= 0 ? 1 : 0) + (columnIndex(headers, 'reference') >= 0 ? 1 : 0);
      if ((debit >= 0 && credit >= 0) || amount >= 0) score += 3;
      if (score > bestScore) { bestScore = score; bestIndex = i; }
    }
    return bestIndex < 0 ? 0 : bestIndex;
  }

  function suggestMapping(headers) {
    var debit = columnIndex(headers, 'debit');
    var credit = columnIndex(headers, 'credit');
    var amount = columnIndex(headers, 'amount');
    return {
      dateColumn: columnIndex(headers, 'date'),
      descriptionColumn: columnIndex(headers, 'description'),
      referenceColumn: columnIndex(headers, 'reference'),
      debitColumn: debit,
      creditColumn: credit,
      amountColumn: amount,
      positiveDirection: 'credit'
    };
  }

  function parseDate(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return '';
    var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    var yearFirst = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(raw);
    if (yearFirst) return validDate(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
    var dayFirst = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(raw);
    if (dayFirst) return validDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]));
    var dashedDayFirst = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(raw);
    if (dashedDayFirst) return validDate(Number(dashedDayFirst[3]), Number(dashedDayFirst[2]), Number(dashedDayFirst[1]));
    if (/^\d+(?:\.\d+)?$/.test(raw)) {
      var serial = Number(raw);
      if (serial >= 1 && serial <= 80000) {
        var date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
        return validDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      }
    }
    return '';
  }

  function validDate(year, month, day) {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return '';
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return '';
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function parseAmount(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return { ok: true, value: 0 };
    var negative = false;
    if (/^\(.*\)$/.test(raw)) { negative = true; raw = raw.slice(1, -1); }
    raw = raw.replace(/(?:XOF|FCFA|F\s*CFA)/gi, '').replace(/[\u00a0\u202f\s'’]/g, '');
    if (raw.charAt(0) === '-') { negative = !negative; raw = raw.slice(1); }
    else if (raw.charAt(0) === '+') raw = raw.slice(1);
    if (raw.charAt(raw.length - 1) === '-') { negative = !negative; raw = raw.slice(0, -1); }
    if (!raw || !/^[0-9.,]+$/.test(raw)) return { ok: false, error: 'montant illisible' };
    var lastComma = raw.lastIndexOf(',');
    var lastDot = raw.lastIndexOf('.');
    var decimalSeparator = '';
    if (lastComma >= 0 && lastDot >= 0) decimalSeparator = lastComma > lastDot ? ',' : '.';
    else {
      var separator = lastComma >= 0 ? ',' : (lastDot >= 0 ? '.' : '');
      if (separator) {
        var trailingDigits = raw.length - raw.lastIndexOf(separator) - 1;
        if (trailingDigits === 1 || trailingDigits === 2) decimalSeparator = separator;
      }
    }
    var normalized;
    if (decimalSeparator) {
      var decimalIndex = raw.lastIndexOf(decimalSeparator);
      var integerPart = raw.slice(0, decimalIndex).replace(/[.,]/g, '');
      var decimalPart = raw.slice(decimalIndex + 1);
      if (!integerPart) integerPart = '0';
      if (!/^\d+$/.test(integerPart) || !/^\d{1,2}$/.test(decimalPart)) return { ok: false, error: 'format de montant invalide' };
      normalized = integerPart + '.' + decimalPart;
    } else {
      normalized = raw.replace(/[.,]/g, '');
      if (!/^\d+$/.test(normalized)) return { ok: false, error: 'format de montant invalide' };
    }
    var numeric = Number(normalized) * (negative ? -1 : 1);
    if (!Number.isFinite(numeric) || !Number.isSafeInteger(Math.round(numeric))) return { ok: false, error: 'montant hors plage' };
    if (Math.abs(numeric - Math.round(numeric)) > 0.000001) return { ok: false, error: 'les décimales non nulles ne sont pas gérées en XOF' };
    return { ok: true, value: Math.round(numeric) };
  }

  function selectedIndex(value, headers) {
    var index = value === '' || value === null || value === undefined ? -1 : Number(value);
    return Number.isInteger(index) && index >= 0 && index < (headers || []).length ? index : -1;
  }

  function parseMappedRows(rows, options) {
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    if (rows.length > MAX_ROWS + 20) return { ok: false, errors: ['Le relevé dépasse la limite de ' + MAX_ROWS + ' lignes.'], rows: [], headers: [] };
    var headerIndex = Number(options.headerIndex);
    if (!Number.isInteger(headerIndex) || headerIndex < 0 || headerIndex >= rows.length || headerIndex >= 20) headerIndex = detectHeaderIndex(rows);
    var headers = (rows[headerIndex] || []).map(function (value) { return String(value == null ? '' : value).trim(); });
    var dateIndex = selectedIndex(options.dateColumn, headers);
    var descriptionIndex = selectedIndex(options.descriptionColumn, headers);
    var referenceIndex = selectedIndex(options.referenceColumn, headers);
    var debitIndex = selectedIndex(options.debitColumn, headers);
    var creditIndex = selectedIndex(options.creditColumn, headers);
    var amountIndex = selectedIndex(options.amountColumn, headers);
    var separateAmounts = debitIndex >= 0 || creditIndex >= 0;
    var errors = [];
    if (dateIndex < 0) errors.push('Choisissez la colonne de date du relevé.');
    if (!separateAmounts && amountIndex < 0) errors.push('Choisissez les colonnes débit/crédit ou la colonne unique de montant.');
    if (separateAmounts && amountIndex >= 0) errors.push('Utilisez soit les colonnes débit/crédit, soit une seule colonne Montant, pas les deux.');
    var parsedRows = [];
    var lastRow = Math.min(rows.length, headerIndex + MAX_ROWS + 1);
    for (var rowIndex = headerIndex + 1; rowIndex < lastRow; rowIndex += 1) {
      var source = rows[rowIndex] || [];
      if (!source.some(function (cell) { return String(cell == null ? '' : cell).trim() !== ''; })) continue;
      var rowErrors = [];
      var date = dateIndex >= 0 ? parseDate(source[dateIndex]) : '';
      if (!date) rowErrors.push('date invalide ou manquante');
      var description = descriptionIndex >= 0 ? String(source[descriptionIndex] == null ? '' : source[descriptionIndex]).trim() : '';
      var reference = referenceIndex >= 0 ? String(source[referenceIndex] == null ? '' : source[referenceIndex]).trim() : '';
      if (description.length > MAX_CELL_LENGTH || reference.length > MAX_CELL_LENGTH) rowErrors.push('libellé ou référence trop long');
      var statementDebit = 0;
      var statementCredit = 0;
      if (separateAmounts) {
        var debitRaw = debitIndex >= 0 ? String(source[debitIndex] == null ? '' : source[debitIndex]).trim() : '';
        var creditRaw = creditIndex >= 0 ? String(source[creditIndex] == null ? '' : source[creditIndex]).trim() : '';
        var parsedDebit = parseAmount(debitRaw);
        var parsedCredit = parseAmount(creditRaw);
        if (!parsedDebit.ok) rowErrors.push('débit ' + parsedDebit.error);
        if (!parsedCredit.ok) rowErrors.push('crédit ' + parsedCredit.error);
        if (parsedDebit.ok && parsedDebit.value < 0) rowErrors.push('le débit du relevé doit être positif');
        if (parsedCredit.ok && parsedCredit.value < 0) rowErrors.push('le crédit du relevé doit être positif');
        if (parsedDebit.ok && parsedDebit.value > 0) statementDebit = parsedDebit.value;
        if (parsedCredit.ok && parsedCredit.value > 0) statementCredit = parsedCredit.value;
      } else if (amountIndex >= 0) {
        var parsedAmount = parseAmount(source[amountIndex]);
        if (!parsedAmount.ok) rowErrors.push('montant ' + parsedAmount.error);
        else if (!parsedAmount.value) rowErrors.push('montant nul ou manquant');
        else {
          var positiveDirection = options.positiveDirection === 'debit' ? 'debit' : 'credit';
          var direction = parsedAmount.value < 0 ? (positiveDirection === 'credit' ? 'debit' : 'credit') : positiveDirection;
          if (direction === 'debit') statementDebit = Math.abs(parsedAmount.value);
          else statementCredit = Math.abs(parsedAmount.value);
        }
      }
      if (!rowErrors.length && statementDebit === 0 && statementCredit === 0) rowErrors.push('montant nul ou manquant');
      if (!rowErrors.length && statementDebit > 0 && statementCredit > 0) rowErrors.push('débit et crédit renseignés sur la même ligne');
      parsedRows.push({
        id: 'line-' + (rowIndex + 1),
        rowNumber: rowIndex + 1,
        date: date,
        reference: reference,
        description: description,
        statementDebit: statementDebit,
        statementCredit: statementCredit,
        statementAmount: statementDebit + statementCredit,
        bookDebit: statementCredit,
        bookCredit: statementDebit,
        valid: rowErrors.length === 0,
        errors: rowErrors
      });
    }
    var invalidCount = parsedRows.filter(function (row) { return !row.valid; }).length;
    return {
      ok: errors.length === 0,
      errors: errors,
      headers: headers,
      headerIndex: headerIndex,
      rows: parsedRows,
      validCount: parsedRows.length - invalidCount,
      invalidCount: invalidCount,
      skippedBlankRows: Math.max(0, lastRow - headerIndex - 1 - parsedRows.length)
    };
  }

  function normalizedSearchText(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function dayDistance(left, right) {
    var leftDate = parseDate(left);
    var rightDate = parseDate(right);
    if (!leftDate || !rightDate) return null;
    return Math.abs(Math.round((Date.parse(leftDate + 'T00:00:00Z') - Date.parse(rightDate + 'T00:00:00Z')) / 86400000));
  }

  /* Suggestions seulement : cette fonction ne pointe ni ne modifie aucune ligne. */
  function suggestMatches(statementRow, ledgerRows, options) {
    options = options || {};
    if (!statementRow || statementRow.valid === false) return [];
    var tolerance = Number(options.dateToleranceDays);
    if (!Number.isInteger(tolerance) || tolerance < 0) tolerance = 7;
    tolerance = Math.min(tolerance, 365);
    var candidates = [];
    (Array.isArray(ledgerRows) ? ledgerRows : []).forEach(function (ledger) {
      if (!ledger || ledger.pointageMark || !ledger.lineKey) return;
      if (Number(ledger.debit || 0) !== Number(statementRow.bookDebit || 0) ||
          Number(ledger.credit || 0) !== Number(statementRow.bookCredit || 0)) return;
      var days = dayDistance(statementRow.date, ledger.date);
      if (days === null || days > tolerance) return;
      var bankReference = normalizedSearchText(statementRow.reference);
      var bookReference = normalizedSearchText(ledger.reference);
      var bankDescription = normalizedSearchText(statementRow.description);
      var bookDescription = normalizedSearchText(ledger.description);
      var referenceExact = !!bankReference && bankReference === bookReference;
      var referenceRelated = !referenceExact && bankReference.length >= 4 && bookReference.length >= 4 &&
        (bankReference.indexOf(bookReference) !== -1 || bookReference.indexOf(bankReference) !== -1);
      var descriptionExact = !!bankDescription && bankDescription === bookDescription;
      var rank = (referenceExact ? 1000 : (referenceRelated ? 400 : 0)) +
        (descriptionExact ? 200 : 0) + Math.max(0, 100 - days);
      var reasons = ['montant et sens égaux'];
      reasons.push(days === 0 ? 'date identique' : 'écart de date : ' + days + ' jour' + (days > 1 ? 's' : ''));
      if (referenceExact) reasons.push('référence identique');
      else if (referenceRelated) reasons.push('références proches');
      if (descriptionExact) reasons.push('libellé identique');
      candidates.push({ lineKey: ledger.lineKey, ledger: ledger, dateGapDays: days, reasons: reasons, rank: rank });
    });
    return candidates.sort(function (left, right) {
      return right.rank - left.rank || left.dateGapDays - right.dateGapDays || left.lineKey.localeCompare(right.lineKey);
    }).slice(0, 5);
  }

  function columnLabel(index) {
    var label = '';
    var number = Number(index) + 1;
    if (!Number.isInteger(number) || number < 1) return '';
    while (number > 0) {
      var remainder = (number - 1) % 26;
      label = String.fromCharCode(65 + remainder) + label;
      number = Math.floor((number - 1) / 26);
    }
    return label;
  }

  var api = {
    MAX_ROWS: MAX_ROWS,
    MAX_FILE_BYTES: MAX_FILE_BYTES,
    normalizeHeader: normalizeHeader,
    detectHeaderIndex: detectHeaderIndex,
    suggestMapping: suggestMapping,
    parseDate: parseDate,
    parseAmount: parseAmount,
    parseMappedRows: parseMappedRows,
    suggestMatches: suggestMatches,
    columnLabel: columnLabel
  };
  root.PerfectoBankStatement = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
