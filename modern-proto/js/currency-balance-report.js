/*
 * PERFECTO · Balance des comptes en devises.
 * Périmètre analytique limité aux comptes 93–99 du référentiel. Les montants
 * étrangers doivent être explicitement enregistrés ; aucun cours n'est appliqué.
 */
(function (root, factory) {
  'use strict';
  var framework = root.PerfectoAccountingFramework;
  if (!framework && typeof module !== 'undefined' && module.exports) framework = require('./accounting-framework.js');
  var api = factory(framework);
  root.PerfectoCurrencyBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AccountingFramework) {
  'use strict';

  var ANALYTIC_ACCOUNT_ROOTS = ['93', '94', '95', '96', '97', '98', '99'].map(function (code) {
    var reference = AccountingFramework && AccountingFramework.getByCode(code);
    return { code: code, label: reference ? String(reference.label || '') : '' };
  });
  var COLUMN_DEFINITIONS = [
    { key: 'accountCode', label: 'Code du Compte', exportLabel: 'Code du Compte', defaultSelected: true, text: true },
    { key: 'accountLabel', label: 'Intitulé du Compte', exportLabel: 'Intitulé du Compte', defaultSelected: true, text: true },
    { key: 'openingBalance', label: 'Solde en Début de Période', exportLabel: 'Solde en Début de Période', defaultSelected: true, text: false },
    { key: 'movements', label: 'Mouvements de la Période', exportLabel: 'Mouvements de la Période', defaultSelected: true, text: false },
    { key: 'closingBalance', label: 'Solde en Fin de Période', exportLabel: 'Solde en Fin de Période', defaultSelected: true, text: false }
  ];

  function normalizeCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
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

  function dayBefore(value) {
    if (!isIsoDate(value)) return '';
    var date = new Date(String(value) + 'T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function isAnalyticAccountCode(value) {
    return /^9[3-9]\d*$/.test(String(value == null ? '' : value).trim());
  }

  function accountRoot(code) {
    var match = /^9([3-9])/.exec(String(code == null ? '' : code).trim());
    return match ? '9' + match[1] : '';
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function accountOptions(accounts, entries) {
    var labels = Object.create(null);
    ANALYTIC_ACCOUNT_ROOTS.forEach(function (record) { labels[record.code] = record.label; });
    (Array.isArray(accounts) ? accounts : []).forEach(function (record) {
      var code = String(record && record.code || '').trim();
      if (isAnalyticAccountCode(code) && record.label) labels[code] = String(record.label);
    });
    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      var lines = Array.isArray(entry && entry.lines) ? entry.lines : [];
      var sourceLines = entry && entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      lines.forEach(function (line, index) {
        var code = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        var sourceLine = sourceLines[index] || {};
        if (isAnalyticAccountCode(code) && !labels[code]) labels[code] = String(line && line.accountLabel || sourceLine.accountLabel || '');
      });
    });
    return Object.keys(labels).map(function (code) { return { code: code, label: labels[code], root: code.length === 2 }; })
      .sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true, sensitivity: 'base' }); });
  }

  function parseCurrencyFilter(expression, currencies) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    var byCode = Object.create(null);
    (Array.isArray(currencies) ? currencies : []).forEach(function (currency) {
      var code = normalizeCode(currency && currency.code);
      if (!/^[A-Z]{3}$/.test(code)) return;
      byCode[code] = (byCode[code] || 0) + 1;
    });
    if (!tokens.length) return { valid: false, all: false, codes: [], error: 'Indiquez une devise ou * pour sélectionner toutes les devises.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, all: true, codes: Object.keys(byCode), error: '' };
    var selected = [];
    var invalid = [];
    tokens.forEach(function (token) {
      var code = normalizeCode(token);
      if (!/^[A-Z]{3}$/.test(code) || byCode[code] !== 1) {
        invalid.push(token + (byCode[code] > 1 ? ' (code ambigu)' : ''));
        return;
      }
      if (selected.indexOf(code) === -1) selected.push(code);
    });
    return invalid.length
      ? { valid: false, all: false, codes: [], error: 'Devise(s) absente(s) ou ambiguë(s) dans le référentiel du dossier : ' + invalid.join(', ') + '.' }
      : { valid: true, all: false, codes: selected, error: '' };
  }

  function parseAccountFilter(expression, availableAccounts) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    var options = Array.isArray(availableAccounts) ? availableAccounts : ANALYTIC_ACCOUNT_ROOTS;
    var availableCodes = options.map(function (row) { return String(row.code || '').trim(); });
    if (!tokens.length) return { valid: false, all: false, patterns: [], tokens: [], error: 'Indiquez un compte analytique (93 à 99) ou * pour tous les comptes.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, all: true, patterns: [], tokens: ['*'], error: '' };
    var patterns = [];
    var invalid = [];
    tokens.forEach(function (token) {
      var value = String(token || '').trim();
      if (!/^9[3-9][0-9]*(?:\*)?$/.test(value)) {
        invalid.push(value);
        return;
      }
      var root = accountRoot(value.replace(/\*$/, ''));
      if (!root) {
        invalid.push(value);
        return;
      }
      var expression = value.indexOf('*') !== -1
        ? new RegExp('^' + value.split('*').map(escapeRegex).join('.*') + '$', 'i')
        : (value.length === 2 ? new RegExp('^' + value, 'i') : new RegExp('^' + escapeRegex(value) + '$', 'i'));
      var hasKnownMatch = availableCodes.some(function (code) { return expression.test(code); });
      if (!hasKnownMatch) {
        invalid.push(value + ' (compte non répertorié)');
        return;
      }
      patterns.push(expression);
    });
    return invalid.length
      ? { valid: false, all: false, patterns: [], tokens: tokens, error: 'Compte(s) absent(s) des comptes analytiques 93 à 99 : ' + invalid.join(', ') + '.' }
      : { valid: true, all: false, patterns: patterns, tokens: tokens, error: '' };
  }

  function accountMatches(code, filter) {
    if (!filter || !filter.valid) return false;
    if (filter.all) return isAnalyticAccountCode(code);
    var value = String(code == null ? '' : code).trim();
    return isAnalyticAccountCode(value) && filter.patterns.some(function (pattern) { return pattern.test(value); });
  }

  function parseBaseAmountUnits(value, decimalPlaces) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var factor = Math.pow(10, decimalPlaces);
    var rounded = Math.round(amount * factor);
    if (!Number.isSafeInteger(rounded) || Math.abs(amount - rounded / factor) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 4) return null;
    var units = rounded * Math.pow(10, 4 - decimalPlaces);
    return Number.isSafeInteger(units) ? units : null;
  }

  function parseCurrencyUnits(value) {
    if (value == null || value === '') return null;
    var numeric;
    if (typeof value === 'number') numeric = value;
    else {
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
      var code = normalizeCode(value);
      if (!/^[A-Z]{3}$/.test(code)) invalid = true;
      else if (values.indexOf(code) === -1) values.push(code);
    });
    return { values: values, invalid: invalid };
  }

  function explicitCurrencySideAmounts(line, sourceLine) {
    var debitAliases = ['foreignDebit', 'currencyDebit'];
    var creditAliases = ['foreignCredit', 'currencyCredit'];
    var resolved = null;
    var invalid = false;
    var present = false;
    [line, sourceLine].forEach(function (record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) return;
      var hasFields = debitAliases.concat(creditAliases).some(function (key) { return Object.prototype.hasOwnProperty.call(record, key); });
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
      var debit = readSide(debitAliases);
      var credit = readSide(creditAliases);
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
    var scalarSources = [line, sourceLine].filter(function (source) {
      return source && typeof source === 'object' && !Array.isArray(source) &&
        Object.prototype.hasOwnProperty.call(source, 'foreignAmount') && source.foreignAmount != null && source.foreignAmount !== '';
    });
    var values = scalarSources.map(function (source) { return parseCurrencyUnits(source.foreignAmount); });
    if (sideAmounts.present) {
      if (sideAmounts.invalid) return null;
      if (values.length && (values.some(function (value) { return value == null; }) || values.some(function (value) { return value !== values[0]; }) ||
          values[0] !== sideAmounts.value.debitUnits + sideAmounts.value.creditUnits)) return null;
      return sideAmounts.value;
    }
    if (!values.length || values.some(function (value) { return value == null; }) || values.some(function (value) { return value !== values[0]; }) || !values[0]) return null;
    if (baseDebitUnits > 0 && baseCreditUnits === 0) return { debitUnits: values[0], creditUnits: 0 };
    if (baseCreditUnits > 0 && baseDebitUnits === 0) return { debitUnits: 0, creditUnits: values[0] };
    return null;
  }

  function lineCurrencyCode(entry, line, sourceLine, baseCurrencyCode) {
    var codes = explicitCurrencyCodes(line, sourceLine);
    if (codes.invalid || codes.values.length > 1) return { valid: false, reason: 'currency-code' };
    var entryHasCode = entry && entry.currencyCode != null && String(entry.currencyCode).trim() !== '';
    var entryCode = normalizeCode(entry && entry.currencyCode);
    if (entryHasCode && (typeof entry.currencyCode !== 'string' || !/^[A-Z]{3}$/.test(entryCode))) return { valid: false, reason: 'currency-code' };
    if (codes.values.length && entryCode && codes.values[0] !== entryCode) return { valid: false, reason: 'currency-conflict' };
    var hasForeignAmount = [line, sourceLine].some(function (source) {
      return source && Object.prototype.hasOwnProperty.call(source, 'foreignAmount') && source.foreignAmount != null && source.foreignAmount !== '';
    });
    var sideAmounts = explicitCurrencySideAmounts(line, sourceLine);
    if (!codes.values.length && !entryCode && (hasForeignAmount || sideAmounts.present)) return { valid: false, reason: 'currency-code' };
    return { valid: true, code: codes.values[0] || entryCode || baseCurrencyCode };
  }

  function resolveLineAmounts(entry, line, sourceLine, currencyCode, baseCurrencyCode, decimalPlaces) {
    var baseDebitUnits = parseBaseAmountUnits(line.debit, decimalPlaces);
    var baseCreditUnits = parseBaseAmountUnits(line.credit, decimalPlaces);
    if (baseDebitUnits == null || baseCreditUnits == null || (baseDebitUnits > 0 && baseCreditUnits > 0) || (baseDebitUnits === 0 && baseCreditUnits === 0)) {
      return { valid: false, reason: 'base-amount' };
    }
    if (currencyCode === baseCurrencyCode) return { valid: true, debitUnits: baseDebitUnits, creditUnits: baseCreditUnits };
    var amount = explicitCurrencyAmount(line, sourceLine, baseDebitUnits, baseCreditUnits);
    if (!amount || !Number.isSafeInteger(amount.debitUnits) || !Number.isSafeInteger(amount.creditUnits) || amount.debitUnits < 0 || amount.creditUnits < 0 ||
        (amount.debitUnits > 0 && amount.creditUnits > 0) || (amount.debitUnits === 0 && amount.creditUnits === 0)) {
      return { valid: false, reason: 'foreign-amount' };
    }
    return { valid: true, debitUnits: amount.debitUnits, creditUnits: amount.creditUnits };
  }

  function addToAccumulator(accumulator, debitUnits, creditUnits, field) {
    var next = accumulator[field] + debitUnits - creditUnits;
    if (!Number.isSafeInteger(next)) return false;
    accumulator[field] = next;
    return true;
  }

  function uniqueWarnings(warnings) {
    return warnings.filter(function (message, index, all) { return all.indexOf(message) === index; });
  }

  function emptyResult(options, errors, warnings, currencyFilter, accountFilter) {
    options = options || {};
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      from: String(options.from || ''),
      to: String(options.to || ''),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      baseCurrencyCode: normalizeCode(options.baseCurrencyCode || 'XOF'),
      currencyFilter: currencyFilter || null,
      accountFilter: accountFilter || null,
      currencyCodes: [],
      groups: [],
      rows: [],
      lineCount: 0,
      generatedLineCount: 0,
      omittedUnconfiguredCurrencyLineCount: 0,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        datesInclusive: true,
        originalCurrencyAmountsRequired: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        noExchangeRateApplied: true,
        noAccountingMutation: true,
        noPartialValuesOnInvalidSources: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var currencies = Array.isArray(options.currencyRecords) ? options.currencyRecords.filter(Boolean) : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts.filter(Boolean) : [];
    var entries = Array.isArray(options.entries) ? options.entries.filter(Boolean) : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances.filter(Boolean) : [];
    var sourceErrors = Array.isArray(options.sourceErrors) ? options.sourceErrors.map(String) : [];
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var from = String(options.from || '');
    var to = String(options.to || '');
    var baseCurrencyCode = normalizeCode(options.baseCurrencyCode || 'XOF');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var errors = [];
    var accountList = accountOptions(accounts, entries);
    var currencyFilter = parseCurrencyFilter(options.currencyFilter == null ? '*' : options.currencyFilter, currencies);
    var accountFilter = parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter, accountList);
    var currencyByCode = Object.create(null);
    var accountLabelByCode = Object.create(null);
    var omittedUnconfiguredCurrencyLineCount = 0;
    var accumulators = Object.create(null);

    if (!currencyFilter.valid) errors.push(currencyFilter.error);
    if (!accountFilter.valid) errors.push(accountFilter.error);
    if (!/^[A-Z]{3}$/.test(baseCurrencyCode)) errors.push('La devise de référence du dossier n’est pas valide.');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour la période.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (from < cycleStart || to > cycleEnd)) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    if (!currencies.some(function (currency) { return normalizeCode(currency.code) === baseCurrencyCode; })) errors.push('La devise de référence « ' + baseCurrencyCode + ' » est absente du référentiel du dossier.');
    if (sourceErrors.length) errors.push.apply(errors, sourceErrors);
    if (errors.length) return emptyResult(options, errors, uniqueWarnings(warnings), currencyFilter, accountFilter);

    currencies.forEach(function (currency) {
      var code = normalizeCode(currency.code);
      if (!/^[A-Z]{3}$/.test(code)) {
        errors.push('Une devise du référentiel porte un code invalide.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(currencyByCode, code)) currencyByCode[code] = null;
      else currencyByCode[code] = currency;
    });
    var selectedCurrencyCodes = currencyFilter.all
      ? currencies.map(function (currency) { return normalizeCode(currency.code); }).filter(function (code, index, all) { return code && all.indexOf(code) === index; })
      : currencyFilter.codes.slice();
    selectedCurrencyCodes.forEach(function (code) {
      if (!currencyByCode[code] || currencyByCode[code] === null) errors.push('Le code de devise « ' + code + ' » est absent ou répété dans le référentiel ; aucun montant n’est affiché.');
    });
    if (errors.length) return emptyResult(options, errors, uniqueWarnings(warnings), currencyFilter, accountFilter);

    accounts.forEach(function (account) {
      var code = String(account.code == null ? '' : account.code).trim();
      if (!isAnalyticAccountCode(code)) return;
      if (account.label) accountLabelByCode[code] = String(account.label);
    });
    ANALYTIC_ACCOUNT_ROOTS.forEach(function (root) {
      if (!accountLabelByCode[root.code]) accountLabelByCode[root.code] = root.label;
    });

    function ensureAccumulator(currencyCode, accountCode) {
      var key = currencyCode + '|' + accountCode;
      if (!accumulators[key]) {
        accumulators[key] = {
          key: key,
          currencyCode: currencyCode,
          accountCode: accountCode,
          accountLabel: String(accountLabelByCode[accountCode] || ''),
          openingUnits: 0,
          openingSourcePresent: false,
          priorMovementUnits: 0,
          periodMovementUnits: 0,
          priorLineCount: 0,
          periodLineCount: 0,
          openingLineCount: 0
        };
      }
      return accumulators[key];
    }

    var selectedCurrencies = Object.create(null);
    selectedCurrencyCodes.forEach(function (code) { selectedCurrencies[code] = true; });
    var expectedOpeningDate = dayBefore(cycleStart);
    if (selectedCurrencies[baseCurrencyCode]) {
      openingBalances.forEach(function (record) {
        var code = String(record.accountCode == null ? '' : record.accountCode).trim();
        if (!isAnalyticAccountCode(code) || !accountMatches(code, accountFilter)) return;
        if (String(record.date || '') !== expectedOpeningDate) {
          errors.push('Le report d’ouverture du compte analytique « ' + code + ' » n’est pas daté de la veille du cycle (' + expectedOpeningDate + ').');
          return;
        }
        var debitUnits = parseBaseAmountUnits(record.debit, decimalPlaces);
        var creditUnits = parseBaseAmountUnits(record.credit, decimalPlaces);
        if (debitUnits == null || creditUnits == null || (debitUnits > 0 && creditUnits > 0) || (debitUnits === 0 && creditUnits === 0)) {
          errors.push('Le report d’ouverture XOF du compte analytique « ' + code + ' » contient un montant invalide.');
          return;
        }
        var accumulator = ensureAccumulator(baseCurrencyCode, code);
        if (!addToAccumulator(accumulator, debitUnits, creditUnits, 'openingUnits')) {
          errors.push('Le report d’ouverture du compte analytique « ' + code + ' » dépasse la capacité numérique sûre.');
          return;
        }
        accumulator.openingSourcePresent = true;
        accumulator.openingLineCount += 1;
      });
    }

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted') return;
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      lines.forEach(function (line, lineIndex) {
        if (!line || typeof line !== 'object' || Array.isArray(line)) return;
        var accountCode = String(line.account == null ? line.accountCode || '' : line.account).trim();
        if (!isAnalyticAccountCode(accountCode) || !accountMatches(accountCode, accountFilter)) return;
        var date = String(entry.date || '');
        if (!isIsoDate(date)) {
          errors.push('Une écriture d’un compte analytique 93 à 99 porte une date invalide.');
          return;
        }
        if (date < cycleStart || date > cycleEnd || date > to) return;
        var sourceLine = sourceLines[lineIndex] && typeof sourceLines[lineIndex] === 'object' ? sourceLines[lineIndex] : {};
        var codeResult = lineCurrencyCode(entry, line, sourceLine, baseCurrencyCode);
        if (!codeResult.valid) {
          errors.push('La devise d’une ligne du compte analytique « ' + accountCode + ' » est absente, contradictoire ou invalide ; aucun résultat partiel n’est affiché.');
          return;
        }
        var currencyCode = codeResult.code;
        if (!currencyByCode[currencyCode] || currencyByCode[currencyCode] === null) {
          omittedUnconfiguredCurrencyLineCount += 1;
          return;
        }
        if (!selectedCurrencies[currencyCode]) return;
        var amounts = resolveLineAmounts(entry, line, sourceLine, currencyCode, baseCurrencyCode, decimalPlaces);
        if (!amounts.valid) {
          var reason = amounts.reason === 'foreign-amount'
            ? 'ne porte pas de montant d’origine explicite en ' + currencyCode
            : 'porte des montants de base invalides';
          errors.push('La ligne validée du compte analytique « ' + accountCode + ' » ' + reason + ' ; aucun résultat partiel n’est affiché.');
          return;
        }
        if (!accountLabelByCode[accountCode]) {
          accountLabelByCode[accountCode] = String(line.accountLabel || sourceLine.accountLabel || '');
        }
        var accumulator = ensureAccumulator(currencyCode, accountCode);
        if (!accumulator.accountLabel && accountLabelByCode[accountCode]) accumulator.accountLabel = accountLabelByCode[accountCode];
        var field = date < from ? 'priorMovementUnits' : 'periodMovementUnits';
        if (!addToAccumulator(accumulator, amounts.debitUnits, amounts.creditUnits, field)) {
          errors.push('Les mouvements du compte analytique « ' + accountCode + ' » dépassent la capacité numérique sûre.');
          return;
        }
        if (date < from) accumulator.priorLineCount += 1;
        else accumulator.periodLineCount += 1;
      });
    });

    if (errors.length) return emptyResult(options, errors, uniqueWarnings(warnings), currencyFilter, accountFilter);

    var rowsByCurrency = Object.create(null);
    Object.keys(accumulators).forEach(function (key) {
      var accumulator = accumulators[key];
      var isBaseCurrency = accumulator.currencyCode === baseCurrencyCode;
      var hasReportActivity = accumulator.openingSourcePresent || accumulator.periodLineCount > 0;
      if (!hasReportActivity) return;
      var openingBalanceUnits = isBaseCurrency && accumulator.openingSourcePresent
        ? accumulator.openingUnits + accumulator.priorMovementUnits
        : null;
      if (openingBalanceUnits != null && !Number.isSafeInteger(openingBalanceUnits)) {
        errors.push('Le solde de début du compte analytique « ' + accumulator.accountCode + ' » dépasse la capacité numérique sûre.');
        return;
      }
      var closingBalanceUnits = openingBalanceUnits == null ? null : openingBalanceUnits + accumulator.periodMovementUnits;
      if (closingBalanceUnits != null && !Number.isSafeInteger(closingBalanceUnits)) {
        errors.push('Le solde de fin du compte analytique « ' + accumulator.accountCode + ' » dépasse la capacité numérique sûre.');
        return;
      }
      var currency = currencyByCode[accumulator.currencyCode];
      var row = {
        currencyCode: accumulator.currencyCode,
        currencyLabel: String(currency && currency.label || ''),
        accountCode: accumulator.accountCode,
        accountLabel: accumulator.accountLabel,
        openingBalance: openingBalanceUnits == null ? null : openingBalanceUnits / 10000,
        movements: accumulator.periodMovementUnits / 10000,
        closingBalance: closingBalanceUnits == null ? null : closingBalanceUnits / 10000,
        openingBalanceKnown: openingBalanceUnits != null,
        closingBalanceKnown: closingBalanceUnits != null,
        openingLineCount: accumulator.openingLineCount,
        priorLineCount: accumulator.priorLineCount,
        periodLineCount: accumulator.periodLineCount,
        rowType: 'account'
      };
      if (!rowsByCurrency[row.currencyCode]) rowsByCurrency[row.currencyCode] = [];
      rowsByCurrency[row.currencyCode].push(row);
    });
    if (errors.length) return emptyResult(options, errors, uniqueWarnings(warnings), currencyFilter, accountFilter);

    selectedCurrencyCodes.forEach(function (currencyCode) {
      (rowsByCurrency[currencyCode] || []).sort(function (left, right) {
        return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true, sensitivity: 'base' });
      });
    });
    var groups = [];
    selectedCurrencyCodes.forEach(function (currencyCode) {
      var groupRows = rowsByCurrency[currencyCode] || [];
      if (!groupRows.length) return;
      var currency = currencyByCode[currencyCode];
      groups.push({
        key: currencyCode,
        currencyCode: currencyCode,
        currencyLabel: String(currency && currency.label || ''),
        title: currencyCode + (currency && currency.label ? ' · ' + String(currency.label) : ''),
        rows: groupRows,
        lineCount: groupRows.length
      });
    });
    var rows = [];
    groups.forEach(function (group) { Array.prototype.push.apply(rows, group.rows); });
    if (rows.some(function (row) { return row.currencyCode !== baseCurrencyCode && !row.openingBalanceKnown; })) {
      warnings.push('Le registre Reports à nouveau ne stocke que des montants XOF. Pour les autres devises, le solde de début et le solde de fin restent vides ; seuls les mouvements d’origine de la période sont affichés. Aucun taux de change n’est appliqué.');
    }
    if (rows.some(function (row) { return row.currencyCode === baseCurrencyCode && !row.openingBalanceKnown; })) {
      warnings.push('Aucun report XOF explicite n’est disponible pour certains comptes sélectionnés ; les soldes de début et de fin restent vides, sans supposer un solde nul.');
    }
    if (omittedUnconfiguredCurrencyLineCount) {
      warnings.push(omittedUnconfiguredCurrencyLineCount + ' ligne(s) des comptes analytiques portent une devise absente du référentiel du dossier ; elles ne sont pas présentées.');
    }
    warnings = uniqueWarnings(warnings);

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      from: from,
      to: to,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      baseCurrencyCode: baseCurrencyCode,
      currencyCodes: selectedCurrencyCodes.slice(),
      currencyFilter: currencyFilter,
      accountFilter: accountFilter,
      groups: groups,
      rows: rows,
      lineCount: rows.length,
      generatedLineCount: rows.length,
      omittedUnconfiguredCurrencyLineCount: omittedUnconfiguredCurrencyLineCount,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        datesInclusive: true,
        originalCurrencyAmountsRequired: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        xofOpeningRequiresExplicitRegistryRows: true,
        noExchangeRateApplied: true,
        noAccountingMutation: true,
        noPartialValuesOnInvalidSources: true
      }
    };
  }

  return {
    ANALYTIC_ACCOUNT_ROOTS: ANALYTIC_ACCOUNT_ROOTS.map(function (row) { return Object.assign({}, row); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    accountOptions: accountOptions,
    parseCurrencyFilter: parseCurrencyFilter,
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    isAnalyticAccountCode: isAnalyticAccountCode,
    build: build
  };
});
