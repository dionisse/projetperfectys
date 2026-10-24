/*
 * PERFECTO · États complémentaires des comptes en devises.
 * Ils lisent les écritures validées et le registre d'ouverture existant ;
 * aucune conversion ni valeur étrangère d'ouverture n'est reconstituée.
 */
(function (root, factory) {
  'use strict';
  var balanceReport = root.PerfectoCurrencyBalanceReport;
  if (!balanceReport && typeof module !== 'undefined' && module.exports) balanceReport = require('./currency-balance-report.js');
  var api = factory(balanceReport);
  root.PerfectoCurrencySupplementaryReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (CurrencyBalanceReport) {
  'use strict';

  var POSITION_COLUMNS = [
    { key: 'accountCode', label: 'Code du Compte', exportLabel: 'Code du Compte', text: true, defaultSelected: true },
    { key: 'accountLabel', label: 'Intitulé du Compte', exportLabel: 'Intitulé du Compte', text: true, defaultSelected: true },
    { key: 'positionCfa', label: 'Position en CFA', exportLabel: 'Position en CFA', text: false, defaultSelected: true },
    { key: 'positionCurrency', label: 'Position en devise', exportLabel: 'Position en devise', text: false, defaultSelected: true }
  ];
  var OPENING_COLUMNS = [
    { key: 'accountCode', label: 'Compte', exportLabel: 'Compte', text: true, defaultSelected: true },
    { key: 'accountLabel', label: 'Intitulé', exportLabel: 'Intitulé', text: true, defaultSelected: true },
    { key: 'positionCfa', label: 'Position en CFA', exportLabel: 'Position en CFA', text: false, defaultSelected: true },
    { key: 'positionCurrency', label: 'Position en devise', exportLabel: 'Position en devise', text: false, defaultSelected: true }
  ];
  var LEDGER_COLUMNS = [
    { key: 'date', label: 'Date', exportLabel: 'Date', text: true, defaultSelected: true },
    { key: 'journal', label: 'Journal', exportLabel: 'Journal', text: true, defaultSelected: true },
    { key: 'piece', label: 'Pièce', exportLabel: 'Pièce', text: true, defaultSelected: true },
    { key: 'reference', label: 'Référence', exportLabel: 'Référence', text: true, defaultSelected: true },
    { key: 'amountCfa', label: 'Montant en CFA', exportLabel: 'Montant en CFA', text: false, defaultSelected: true },
    { key: 'amountCurrency', label: 'Montant en devise', exportLabel: 'Montant en devise', text: false, defaultSelected: true },
    { key: 'label', label: 'Libellé', exportLabel: 'Libellé', text: true, defaultSelected: true },
    { key: 'counterpart', label: 'Contrepartie', exportLabel: 'Contrepartie', text: true, defaultSelected: true }
  ];
  var EXCHANGE_COLUMNS = [
    { key: 'accountCode', label: 'Code du Compte', exportLabel: 'Code du Compte', text: true, defaultSelected: true },
    { key: 'positionCfa', label: 'Position en CFA', exportLabel: 'Position en CFA', text: false, defaultSelected: true },
    { key: 'countervalueCfa', label: 'Contrevaleur en CFA', exportLabel: 'Contrevaleur en CFA', text: false, defaultSelected: true },
    { key: 'accountLabel', label: 'Intitulé du Compte', exportLabel: 'Intitulé du Compte', text: true, defaultSelected: true },
    { key: 'positionCurrency', label: 'Position en devise', exportLabel: 'Position en devise', text: false, defaultSelected: true },
    { key: 'exchangeDifference', label: 'Écart de change', exportLabel: 'Écart de change', text: false, defaultSelected: true }
  ];

  function normalizeCode(value) { return String(value == null ? '' : value).trim().toLocaleUpperCase(); }

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

  function signedUnits(debitUnits, creditUnits) { return debitUnits - creditUnits; }

  function safeAdd(left, right) {
    var result = left + right;
    return Number.isSafeInteger(result) ? result : null;
  }

  function unique(values) {
    return values.filter(function (value, index, all) { return all.indexOf(value) === index; });
  }

  function accountLabelIndex(accounts, entries) {
    var labels = Object.create(null);
    (Array.isArray(accounts) ? accounts : []).forEach(function (account) {
      if (!account || account.code == null) return;
      var code = String(account.code).trim();
      if (code && account.label) labels[code] = String(account.label);
    });
    CurrencyBalanceReport.ANALYTIC_ACCOUNT_ROOTS.forEach(function (root) {
      if (root.label && !labels[root.code]) labels[root.code] = root.label;
    });
    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      var lines = Array.isArray(entry && entry.lines) ? entry.lines : [];
      var sourceLines = entry && entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      lines.forEach(function (line, index) {
        var code = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        var sourceLine = sourceLines[index] || {};
        if (code && !labels[code]) labels[code] = String(line && line.accountLabel || sourceLine.accountLabel || '');
      });
    });
    return labels;
  }

  function createContext(options, includeAccountFilter) {
    options = options || {};
    var currencies = Array.isArray(options.currencyRecords) ? options.currencyRecords.filter(Boolean) : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts.filter(Boolean) : [];
    var entries = Array.isArray(options.entries) ? options.entries.filter(Boolean) : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances.filter(Boolean) : [];
    var baseCurrencyCode = normalizeCode(options.baseCurrencyCode || 'XOF');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var accountOptions = CurrencyBalanceReport.accountOptions(accounts, entries);
    var currencyFilter = CurrencyBalanceReport.parseCurrencyFilter(options.currencyFilter == null ? '*' : options.currencyFilter, currencies);
    var accountFilter = includeAccountFilter
      ? CurrencyBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter, accountOptions)
      : CurrencyBalanceReport.parseAccountFilter('*', accountOptions);
    var errors = [];
    var warnings = [];
    var currencyByCode = Object.create(null);
    var accountLabels = accountLabelIndex(accounts, entries);

    if (!currencyFilter.valid) errors.push(currencyFilter.error);
    if (!accountFilter.valid) errors.push(accountFilter.error);
    if (!/^[A-Z]{3}$/.test(baseCurrencyCode)) errors.push('La devise de référence du dossier n’est pas valide.');
    currencies.forEach(function (currency) {
      var code = normalizeCode(currency.code);
      if (!/^[A-Z]{3}$/.test(code)) {
        errors.push('Une devise du référentiel porte un code invalide.');
        return;
      }
      if (Object.prototype.hasOwnProperty.call(currencyByCode, code)) currencyByCode[code] = null;
      else currencyByCode[code] = currency;
    });
    if (!currencies.some(function (currency) { return normalizeCode(currency.code) === baseCurrencyCode; })) {
      errors.push('La devise de référence « ' + baseCurrencyCode + ' » est absente du référentiel du dossier.');
    }
    var selectedCurrencyCodes = currencyFilter.all
      ? currencies.map(function (currency) { return normalizeCode(currency.code); }).filter(function (code, index, all) { return code && all.indexOf(code) === index; })
      : currencyFilter.codes.slice();
    selectedCurrencyCodes.forEach(function (code) {
      if (!currencyByCode[code] || currencyByCode[code] === null) errors.push('Le code de devise « ' + code + ' » est absent ou répété dans le référentiel.');
    });
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));

    return {
      options: options,
      currencies: currencies,
      accounts: accounts,
      entries: entries,
      openingBalances: openingBalances,
      baseCurrencyCode: baseCurrencyCode,
      decimalPlaces: decimalPlaces,
      currencyFilter: currencyFilter,
      accountFilter: accountFilter,
      selectedCurrencyCodes: selectedCurrencyCodes,
      selectedCurrencies: selectedCurrencyCodes.reduce(function (map, code) { map[code] = true; return map; }, Object.create(null)),
      currencyByCode: currencyByCode,
      accountLabels: accountLabels,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      errors: errors,
      warnings: warnings
    };
  }

  function emptyResult(context, errors) {
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: (context && context.warnings || []).slice(),
      cycleStart: context ? context.cycleStart : '',
      cycleEnd: context ? context.cycleEnd : '',
      baseCurrencyCode: context ? context.baseCurrencyCode : 'XOF',
      currencyCodes: [],
      groups: [],
      rows: [],
      lineCount: 0,
      generatedLineCount: 0,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        originalAmountsAreExplicitOnly: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        noExchangeRateApplied: true,
        noAccountingMutation: true
      }
    };
  }

  function accountInFilter(context, code) {
    return CurrencyBalanceReport.accountMatches(code, context.accountFilter);
  }

  function accountLabel(context, code, line, sourceLine) {
    return String(context.accountLabels[code] || (line && line.accountLabel) || (sourceLine && sourceLine.accountLabel) || '');
  }

  function makeGroups(context, rows) {
    var groups = [];
    context.selectedCurrencyCodes.forEach(function (currencyCode) {
      var groupRows = rows.filter(function (row) { return row.currencyCode === currencyCode; });
      if (!groupRows.length) return;
      var currency = context.currencyByCode[currencyCode];
      groups.push({
        key: currencyCode,
        currencyCode: currencyCode,
        currencyLabel: String(currency && currency.label || ''),
        title: currencyCode + (currency && currency.label ? ' · ' + String(currency.label) : ''),
        rows: groupRows,
        lineCount: groupRows.length
      });
    });
    return groups;
  }

  function finalize(context, rows, errors, extraWarnings, extra) {
    if (errors.length) return emptyResult(context, errors);
    var groups = makeGroups(context, rows);
    var flattened = [];
    groups.forEach(function (group) { Array.prototype.push.apply(flattened, group.rows); });
    var warnings = unique(context.warnings.concat(extraWarnings || []));
    var result = Object.assign({
      ok: true,
      errors: [],
      warnings: warnings,
      cycleStart: context.cycleStart,
      cycleEnd: context.cycleEnd,
      baseCurrencyCode: context.baseCurrencyCode,
      currencyCodes: context.selectedCurrencyCodes.slice(),
      currencyFilter: context.currencyFilter,
      accountFilter: context.accountFilter,
      groups: groups,
      rows: flattened,
      lineCount: flattened.length,
      generatedLineCount: flattened.length,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        originalAmountsAreExplicitOnly: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        noExchangeRateApplied: true,
        noAccountingMutation: true
      }
    }, extra || {});
    result.warnings = warnings;
    return result;
  }

  function openingBalanceIndex(context, errors) {
    var byAccount = Object.create(null);
    var expectedDate = dayBefore(context.cycleStart);
    if (!context.selectedCurrencies[context.baseCurrencyCode]) return byAccount;
    context.openingBalances.forEach(function (record) {
      var code = String(record.accountCode == null ? '' : record.accountCode).trim();
      if (!CurrencyBalanceReport.isAnalyticAccountCode(code) || !accountInFilter(context, code)) return;
      if (String(record.date || '') !== expectedDate) {
        errors.push('Le report d’ouverture XOF du compte analytique « ' + code + ' » n’est pas daté de la veille du cycle (' + expectedDate + ').');
        return;
      }
      var debitUnits = CurrencyBalanceReport.parseBaseAmountUnits(record.debit, context.decimalPlaces);
      var creditUnits = CurrencyBalanceReport.parseBaseAmountUnits(record.credit, context.decimalPlaces);
      if (debitUnits == null || creditUnits == null || (debitUnits > 0 && creditUnits > 0) || (debitUnits === 0 && creditUnits === 0)) {
        errors.push('Le report d’ouverture XOF du compte analytique « ' + code + ' » contient un montant invalide.');
        return;
      }
      if (!byAccount[code]) byAccount[code] = { units: 0, lineCount: 0 };
      var total = safeAdd(byAccount[code].units, signedUnits(debitUnits, creditUnits));
      if (total == null) {
        errors.push('Le report d’ouverture du compte analytique « ' + code + ' » dépasse la capacité numérique sûre.');
        return;
      }
      byAccount[code].units = total;
      byAccount[code].lineCount += 1;
    });
    return byAccount;
  }

  function buildOpeningBalance(options) {
    var context = createContext(options, true);
    var errors = context.errors.slice();
    if (errors.length) return emptyResult(context, errors);
    var openingByAccount = openingBalanceIndex(context, errors);
    if (errors.length) return emptyResult(context, errors);
    var rows = [];
    var xof = context.selectedCurrencies[context.baseCurrencyCode];
    if (xof) {
      Object.keys(openingByAccount).sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); }).forEach(function (code) {
        var record = openingByAccount[code];
        rows.push({
          currencyCode: context.baseCurrencyCode,
          currencyLabel: String(context.currencyByCode[context.baseCurrencyCode].label || ''),
          accountCode: code,
          accountLabel: String(context.accountLabels[code] || ''),
          positionCfa: record.units / 10000,
          positionCurrency: record.units / 10000,
          positionCfaKnown: true,
          positionCurrencyKnown: true,
          openingLineCount: record.lineCount,
          rowType: 'account'
        });
      });
    }
    var hasForeignCurrencies = context.selectedCurrencyCodes.some(function (code) { return code !== context.baseCurrencyCode; });
    var warnings = [];
    if (xof && !Object.keys(openingByAccount).length) warnings.push('Aucun report d’ouverture XOF explicite n’est disponible pour les comptes sélectionnés ; aucun solde n’est supposé nul.');
    if (hasForeignCurrencies) warnings.push('Le registre des reports à nouveau ne stocke que le montant XOF. Aucun solde d’ouverture dans une devise étrangère n’est disponible ; aucune conversion n’est faite.');
    return finalize(context, rows, errors, warnings, {
      reportKind: 'opening-balance',
      openingDate: dayBefore(context.cycleStart),
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        originalAmountsAreExplicitOnly: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        noExchangeRateApplied: true,
        noAccountingMutation: true
      }
    });
  }

  function buildPosition(options) {
    var context = createContext(options, true);
    var date = String(options && options.asOfDate || '');
    var errors = context.errors.slice();
    if (!isIsoDate(date)) errors.push('Indiquez une date d’arrêté valide.');
    else if (date < context.cycleStart || date > context.cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + context.cycleStart + ' — ' + context.cycleEnd + ').');
    if (errors.length) return emptyResult(context, errors);

    var openingByAccount = openingBalanceIndex(context, errors);
    if (errors.length) return emptyResult(context, errors);
    var positions = Object.create(null);
    var missingOriginalCount = 0;
    var omittedCurrencyCount = 0;

    function accumulator(currencyCode, code) {
      var key = currencyCode + '|' + code;
      if (!positions[key]) positions[key] = {
        currencyCode: currencyCode,
        accountCode: code,
        accountLabel: String(context.accountLabels[code] || ''),
        baseMovementUnits: 0,
        originalMovementUnits: 0,
        originalMovementKnown: true,
        hasOpening: false,
        openingUnits: 0,
        lineCount: 0
      };
      return positions[key];
    }

    if (context.selectedCurrencies[context.baseCurrencyCode]) {
      Object.keys(openingByAccount).forEach(function (code) {
        var record = openingByAccount[code];
        var item = accumulator(context.baseCurrencyCode, code);
        item.hasOpening = true;
        item.openingUnits = record.units;
      });
    }

    context.entries.forEach(function (entry, entryIndex) {
      if (!entry || entry.status !== 'posted') return;
      var dateValue = String(entry.date || '');
      if (!isIsoDate(dateValue)) {
        var hasSelectedAnalyticLine = (Array.isArray(entry.lines) ? entry.lines : []).some(function (line) {
          var code = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
          return CurrencyBalanceReport.isAnalyticAccountCode(code) && accountInFilter(context, code);
        });
        if (hasSelectedAnalyticLine) errors.push('Une écriture d’un compte analytique 93 à 99 porte une date invalide.');
        return;
      }
      if (dateValue < context.cycleStart || dateValue > date || dateValue > context.cycleEnd) return;
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      lines.forEach(function (line, lineIndex) {
        var code = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        if (!CurrencyBalanceReport.isAnalyticAccountCode(code) || !accountInFilter(context, code)) return;
        var sourceLine = sourceLines[lineIndex] && typeof sourceLines[lineIndex] === 'object' ? sourceLines[lineIndex] : {};
        var resolved = CurrencyBalanceReport.resolveLine(entry, line, sourceLine, context.baseCurrencyCode, context.decimalPlaces);
        if (!resolved.valid) {
          errors.push('Une ligne validée du compte analytique « ' + code + ' » contient une devise ou un montant XOF invalide.');
          return;
        }
        var currencyCode = resolved.currencyCode;
        if (!context.currencyByCode[currencyCode] || context.currencyByCode[currencyCode] === null) {
          omittedCurrencyCount += 1;
          return;
        }
        if (!context.selectedCurrencies[currencyCode]) return;
        var item = accumulator(currencyCode, code);
        if (!item.accountLabel) item.accountLabel = accountLabel(context, code, line, sourceLine);
        var nextBase = safeAdd(item.baseMovementUnits, signedUnits(resolved.baseDebitUnits, resolved.baseCreditUnits));
        if (nextBase == null) { errors.push('Les montants XOF du compte analytique « ' + code + ' » dépassent la capacité numérique sûre.'); return; }
        item.baseMovementUnits = nextBase;
        item.lineCount += 1;
        if (resolved.originalAmountKnown) {
          var nextOriginal = safeAdd(item.originalMovementUnits, signedUnits(resolved.originalDebitUnits, resolved.originalCreditUnits));
          if (nextOriginal == null) { errors.push('Les montants d’origine du compte analytique « ' + code + ' » dépassent la capacité numérique sûre.'); return; }
          item.originalMovementUnits = nextOriginal;
        } else {
          item.originalMovementKnown = false;
          missingOriginalCount += 1;
        }
      });
    });
    if (errors.length) return emptyResult(context, errors);

    var rows = [];
    Object.keys(positions).forEach(function (key) {
      var item = positions[key];
      var isBaseCurrency = item.currencyCode === context.baseCurrencyCode;
      var hasActivity = item.hasOpening || item.lineCount > 0;
      if (!hasActivity) return;
      var positionCfaKnown = isBaseCurrency && item.hasOpening;
      var positionCfaUnits = positionCfaKnown ? safeAdd(item.openingUnits, item.baseMovementUnits) : null;
      if (positionCfaKnown && positionCfaUnits == null) {
        errors.push('La position XOF du compte analytique « ' + item.accountCode + ' » dépasse la capacité numérique sûre.');
        return;
      }
      var positionCurrencyKnown = isBaseCurrency && item.hasOpening;
      var positionCurrencyUnits = null;
      if (positionCurrencyKnown) positionCurrencyUnits = positionCfaUnits;
      rows.push({
        currencyCode: item.currencyCode,
        currencyLabel: String(context.currencyByCode[item.currencyCode] && context.currencyByCode[item.currencyCode].label || ''),
        accountCode: item.accountCode,
        accountLabel: item.accountLabel,
        positionCfa: positionCfaUnits == null ? null : positionCfaUnits / 10000,
        positionCurrency: positionCurrencyUnits == null ? null : positionCurrencyUnits / 10000,
        positionCfaKnown: positionCfaUnits != null,
        positionCurrencyKnown: positionCurrencyUnits != null,
        lineCount: item.lineCount,
        rowType: 'account'
      });
    });
    rows.sort(function (left, right) {
      return left.currencyCode.localeCompare(right.currencyCode, 'fr', { sensitivity: 'base' }) ||
        left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true, sensitivity: 'base' });
    });
    var warnings = [];
    if (context.selectedCurrencyCodes.some(function (code) { return code !== context.baseCurrencyCode; })) {
      warnings.push('Le registre d’ouverture ne rattache pas de montant XOF à une devise étrangère et ne conserve pas de montant d’origine. Aucune position complète en CFA ou en devise étrangère ne peut être établie, sans solde nul supposé ni conversion.');
    }
    if (rows.some(function (row) { return !row.positionCfaKnown; })) {
      warnings.push('Aucun report d’ouverture XOF explicite n’est disponible pour certains comptes ; la position à la date choisie reste vide plutôt que supposée nulle.');
    }
    if (missingOriginalCount) warnings.push(missingOriginalCount + ' ligne(s) n’ont pas de montant d’origine exploitable ; aucune position étrangère n’est déduite de leur montant XOF.');
    if (omittedCurrencyCount) warnings.push(omittedCurrencyCount + ' ligne(s) portent une devise absente du référentiel du dossier et ne sont pas présentées.');
    return finalize(context, rows, errors, warnings, {
      reportKind: 'position',
      asOfDate: date,
      missingOriginalAmountLineCount: missingOriginalCount,
      omittedUnconfiguredCurrencyLineCount: omittedCurrencyCount,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        dateInclusive: true,
        originalAmountsAreExplicitOnly: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        noExchangeRateApplied: true,
        noAccountingMutation: true
      }
    });
  }

  function buildLedger(options) {
    var context = createContext(options, true);
    var from = String(options && options.from || '');
    var to = String(options && options.to || '');
    var errors = context.errors.slice();
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour le grand livre des comptes en devises.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (from < context.cycleStart || to > context.cycleEnd) errors.push('La période du grand livre doit rester dans le cycle du dossier (' + context.cycleStart + ' — ' + context.cycleEnd + ').');
    if (errors.length) return emptyResult(context, errors);

    var labels = accountLabelIndex(context.accounts, context.entries);
    var rows = [];
    var missingOriginalCount = 0;
    var omittedCurrencyCount = 0;
    var errorLineCount = 0;

    context.entries.forEach(function (entry, entryIndex) {
      if (!entry || entry.status !== 'posted') return;
      var date = String(entry.date || '');
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      var relevantLines = lines.map(function (line, lineIndex) {
        var code = String(line && (line.account == null ? line.accountCode || '' : line.account) || '').trim();
        return { line: line, lineIndex: lineIndex, accountCode: code };
      }).filter(function (item) {
        return CurrencyBalanceReport.isAnalyticAccountCode(item.accountCode) && accountInFilter(context, item.accountCode);
      });
      if (!relevantLines.length) return;
      if (!isIsoDate(date)) {
        errors.push('Une écriture d’un compte analytique 93 à 99 porte une date invalide.');
        return;
      }
      if (date < from || date > to || date < context.cycleStart || date > context.cycleEnd) return;
      var sourceLines = entry.sourceMetadata && Array.isArray(entry.sourceMetadata.lines) ? entry.sourceMetadata.lines : [];
      relevantLines.forEach(function (item) {
        var line = item.line;
        var lineIndex = item.lineIndex;
        var code = item.accountCode;
        var sourceLine = sourceLines[lineIndex] && typeof sourceLines[lineIndex] === 'object' ? sourceLines[lineIndex] : {};
        var resolved = CurrencyBalanceReport.resolveLine(entry, line, sourceLine, context.baseCurrencyCode, context.decimalPlaces);
        if (!resolved.valid) {
          errorLineCount += 1;
          errors.push('La ligne validée du compte analytique « ' + code + ' » porte une devise ou un montant XOF invalide.');
          return;
        }
        var currencyCode = resolved.currencyCode;
        var currency = context.currencyByCode[currencyCode];
        if (!currency || currency === null) {
          omittedCurrencyCount += 1;
          return;
        }
        if (!context.selectedCurrencies[currencyCode]) return;
        var counterpartCodes = unique(lines.map(function (otherLine) {
          return String(otherLine && (otherLine.account == null ? otherLine.accountCode || '' : otherLine.account) || '').trim();
        }).filter(function (otherCode) { return otherCode && otherCode !== code; }))
          .sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true, sensitivity: 'base' }); });
        var counterpart = counterpartCodes.map(function (otherCode) {
          var label = labels[otherCode] || '';
          return otherCode + (label ? ' — ' + label : '');
        }).join(' · ');
        var signedCfa = signedUnits(resolved.baseDebitUnits, resolved.baseCreditUnits) / 10000;
        var signedForeign = resolved.originalAmountKnown
          ? signedUnits(resolved.originalDebitUnits, resolved.originalCreditUnits) / 10000
          : null;
        if (!resolved.originalAmountKnown) missingOriginalCount += 1;
        rows.push({
          currencyCode: currencyCode,
          currencyLabel: String(currency.label || ''),
          accountCode: code,
          accountLabel: String(labels[code] || accountLabel(context, code, line, sourceLine)),
          date: date,
          journal: String(entry.journal || entry.journalCode || ''),
          piece: String(line.piece || line.pieceReference || entry.reference || entry.internalNumber || ''),
          reference: String(line.reference || entry.sourceReference || ''),
          amountCfa: signedCfa,
          amountCurrency: signedForeign,
          label: String(line.description || line.label || entry.description || ''),
          counterpart: counterpart,
          entryIndex: entryIndex,
          lineIndex: lineIndex,
          foreignAmountKnown: resolved.originalAmountKnown,
          rowType: 'movement'
        });
      });
    });
    if (errors.length) return emptyResult(context, errors);
    rows.sort(function (left, right) {
      return left.currencyCode.localeCompare(right.currencyCode, 'fr', { sensitivity: 'base' }) ||
        left.date.localeCompare(right.date) || left.entryIndex - right.entryIndex || left.lineIndex - right.lineIndex;
    });
    var warnings = [];
    if (missingOriginalCount) warnings.push(missingOriginalCount + ' ligne(s) ne portent pas de montant d’origine exploitable ; « Montant en devise » reste vide sur ces lignes.');
    if (omittedCurrencyCount) warnings.push(omittedCurrencyCount + ' ligne(s) portent une devise absente du référentiel du dossier et ne sont pas présentées.');
    return finalize(context, rows, errors, warnings, {
      reportKind: 'ledger',
      from: from,
      to: to,
      missingOriginalAmountLineCount: missingOriginalCount,
      omittedUnconfiguredCurrencyLineCount: omittedCurrencyCount,
      invalidLineCount: errorLineCount,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        datesInclusive: true,
        debitIsPositiveCreditIsNegative: true,
        originalAmountsAreExplicitOnly: true,
        counterpartLabelsFromRecordedAccountPlan: true,
        noExchangeRateApplied: true,
        noAccountingMutation: true
      }
    });
  }

  function buildExchangeDifferences(options) {
    var context = createContext(options, false);
    var date = String(options && options.asOfDate || '');
    var errors = context.errors.slice();
    if (!isIsoDate(date)) errors.push('Indiquez une date d’arrêté valide.');
    else if (date < context.cycleStart || date > context.cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + context.cycleStart + ' — ' + context.cycleEnd + ').');
    if (errors.length) return emptyResult(context, errors);
    var position = buildPosition(Object.assign({}, options, { accountFilter: '*' }));
    if (!position.ok) return emptyResult(context, position.errors);
    var rows = position.rows.map(function (row) {
      var isBaseCurrency = row.currencyCode === context.baseCurrencyCode;
      return {
        currencyCode: row.currencyCode,
        currencyLabel: row.currencyLabel,
        accountCode: row.accountCode,
        accountLabel: row.accountLabel,
        positionCfa: row.positionCfa,
        countervalueCfa: isBaseCurrency ? row.positionCfa : null,
        positionCurrency: row.positionCurrency,
        exchangeDifference: isBaseCurrency && row.positionCfaKnown ? 0 : null,
        positionCfaKnown: row.positionCfaKnown,
        countervalueCfaKnown: isBaseCurrency && row.positionCfaKnown,
        positionCurrencyKnown: row.positionCurrencyKnown,
        exchangeDifferenceKnown: isBaseCurrency && row.positionCfaKnown,
        lineCount: row.lineCount || 0,
        rowType: 'account'
      };
    });
    var warnings = position.warnings.slice();
    if (context.selectedCurrencyCodes.some(function (code) { return code !== context.baseCurrencyCode; })) {
      warnings.push('Aucun historique de taux de change à la date choisie n’est disponible. La contrevaleur en CFA et l’écart de change des devises étrangères restent vides ; le dernier cours configuré n’est pas utilisé.');
    }
    return finalize(context, rows, [], warnings, {
      reportKind: 'exchange-differences',
      asOfDate: date,
      rateHistoryAvailable: false,
      basis: {
        accountsLimitedToAnalyticClasses93to99: true,
        postedEntriesOnly: true,
        dateInclusive: true,
        openingRegistryIsXofOnly: true,
        foreignOpeningBalancesAvailable: false,
        historicalExchangeRatesAvailable: false,
        lastConfiguredRateIgnored: true,
        noExchangeDifferenceSimulated: true,
        noAccountingMutation: true
      }
    });
  }

  return {
    POSITION_COLUMNS: POSITION_COLUMNS.map(function (column) { return Object.assign({}, column); }),
    OPENING_COLUMNS: OPENING_COLUMNS.map(function (column) { return Object.assign({}, column); }),
    LEDGER_COLUMNS: LEDGER_COLUMNS.map(function (column) { return Object.assign({}, column); }),
    EXCHANGE_COLUMNS: EXCHANGE_COLUMNS.map(function (column) { return Object.assign({}, column); }),
    buildPosition: buildPosition,
    buildOpeningBalance: buildOpeningBalance,
    buildLedger: buildLedger,
    buildExchangeDifferences: buildExchangeDifferences
  };
});
