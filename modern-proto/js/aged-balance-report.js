/*
 * PERFECTO · Balance âgée des pièces ouvertes.
 * Calcul pur en lecture seule : les échéances et règlements proviennent du
 * registre dédié, jamais d’une date de pièce ou d’un tiers supposé.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoAgedBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var NATURES = [
    { key: 'clients', label: 'Clients', defaultAccounts: '411 -4117 485 486 488', thirdPartyType: 'client' },
    { key: 'suppliers', label: 'Fournisseurs', defaultAccounts: '401 -4017 408 481 482 483 484', thirdPartyType: 'supplier' },
    { key: 'salary-advances', label: 'Avances sur salaire', defaultAccounts: '421', thirdPartyType: 'personnel' }
  ];
  var AGE_BUCKETS = [
    { key: 'notDue', label: 'Non échu' },
    { key: 'days1to30', label: '1–30 jours' },
    { key: 'days31to60', label: '31–60 jours' },
    { key: 'days61to90', label: '61–90 jours' },
    { key: 'over90', label: 'Plus de 90 jours' },
    { key: 'prior', label: 'Antérieur à l’étendue' }
  ];
  var RANGE_MONTHS = { 'six-months': 6, 'five-years': 60 };

  function parseIsoDate(value) {
    var text = String(value == null ? '' : value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    var date = new Date(text + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? date : null;
  }

  function daysBetween(laterIso, earlierIso) {
    var later = parseIsoDate(laterIso);
    var earlier = parseIsoDate(earlierIso);
    if (!later || !earlier) return null;
    return Math.round((later.getTime() - earlier.getTime()) / 86400000);
  }

  function parseAccountFilter(expression) {
    var raw = String(expression == null ? '' : expression).trim();
    var tokens = raw.split(/[\s,;]+/).filter(Boolean);
    if (!tokens.length) return { valid: false, all: false, includes: [], excludes: [], error: 'Indiquez des comptes ou * pour sélectionner tous les comptes.' };
    if (tokens.indexOf('*') !== -1) return { valid: true, all: true, includes: [], excludes: [], error: '' };
    var includes = [];
    var excludes = [];
    var invalid = [];
    tokens.forEach(function (token) {
      var excluded = token.charAt(0) === '-';
      var prefix = excluded ? token.slice(1) : token;
      if (!prefix || !/^\d+(?:\*)?$/.test(prefix)) {
        invalid.push(token);
        return;
      }
      prefix = prefix.replace(/\*$/, '');
      (excluded ? excludes : includes).push(prefix);
    });
    if (invalid.length) return { valid: false, all: false, includes: includes, excludes: excludes, error: 'Compte(s) ou préfixe(s) non valide(s) : ' + invalid.join(', ') + '.' };
    if (!includes.length) return { valid: false, all: false, includes: includes, excludes: excludes, error: 'Ajoutez au moins un compte positif avant les exclusions.' };
    return { valid: true, all: false, includes: includes, excludes: excludes, error: '' };
  }

  function accountMatches(code, parsedFilter) {
    var filter = parsedFilter && Array.isArray(parsedFilter.includes)
      ? parsedFilter
      : parseAccountFilter(parsedFilter);
    if (!filter.valid) return false;
    if (filter.all) return true;
    var value = String(code == null ? '' : code);
    return filter.includes.some(function (prefix) { return value.indexOf(prefix) === 0; }) &&
      !filter.excludes.some(function (prefix) { return value.indexOf(prefix) === 0; });
  }

  function shiftMonths(isoDate, months) {
    var date = parseIsoDate(isoDate);
    if (!date) return '';
    var monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() - months;
    var year = Math.floor(monthIndex / 12);
    var month = monthIndex - year * 12;
    var day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
    return String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function horizonStart(asOfDate, range) {
    var months = RANGE_MONTHS[range] || RANGE_MONTHS['six-months'];
    return shiftMonths(asOfDate, months);
  }

  function bucketFor(dueDate, asOfDate, range) {
    var overdueDays = daysBetween(asOfDate, dueDate);
    if (overdueDays === null) return '';
    if (overdueDays <= 0) return 'notDue';
    if (overdueDays <= 30) return 'days1to30';
    if (overdueDays <= 60) return 'days31to60';
    if (overdueDays <= 90) return 'days61to90';
    return dueDate < horizonStart(asOfDate, range) ? 'prior' : 'over90';
  }

  function build(options) {
    options = options || {};
    var filters = options.filters || {};
    var nature = NATURES.find(function (item) { return item.key === String(filters.nature || ''); });
    var asOfDate = String(filters.asOfDate || '');
    var range = Object.prototype.hasOwnProperty.call(RANGE_MONTHS, filters.range) ? filters.range : 'six-months';
    var accountFilter = parseAccountFilter(filters.accounts == null ? '' : filters.accounts);
    var errors = [];
    if (!nature) errors.push('Choisissez une nature de comptes disponible.');
    if (!parseIsoDate(asOfDate)) errors.push('La date d’arrêté doit être une date valide.');
    if (!accountFilter.valid) errors.push(accountFilter.error);

    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var items = Array.isArray(options.items) ? options.items : [];
    var settlements = Array.isArray(options.settlements) ? options.settlements : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var accountByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountByCode[String(account.code)] = account;
    });
    var settlementsByItem = Object.create(null);
    var invalidSettlementByItem = Object.create(null);
    var invalidSettlementWithoutItemCount = 0;
    var settlementCount = 0;
    var invalidSettlementCount = 0;
    settlements.forEach(function (settlement) {
      if (!settlement || !settlement.itemId || !parseIsoDate(settlement.date)) {
        if (settlement && settlement.itemId) {
          var invalidItemKey = String(settlement.itemId);
          invalidSettlementByItem[invalidItemKey] = (invalidSettlementByItem[invalidItemKey] || 0) + 1;
        } else invalidSettlementWithoutItemCount += 1;
        return;
      }
      var amount = Number(settlement.amount);
      var units = Math.round(amount * factor);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(units) || units <= 0) {
        var invalidAmountItemKey = String(settlement.itemId);
        invalidSettlementByItem[invalidAmountItemKey] = (invalidSettlementByItem[invalidAmountItemKey] || 0) + 1;
        return;
      }
      if (settlement.date > asOfDate) return;
      var itemKey = String(settlement.itemId);
      if (!settlementsByItem[itemKey]) settlementsByItem[itemKey] = { units: 0, count: 0 };
      settlementsByItem[itemKey].units += units;
      settlementsByItem[itemKey].count += 1;
      settlementCount += 1;
    });

    var rowsByKey = Object.create(null);
    var selectedItemIds = Object.create(null);
    var invalidItemCount = 0;
    var itemCount = 0;
    if (!errors.length) items.forEach(function (item) {
      if (!item || !item.id || !item.accountCode || !parseIsoDate(item.documentDate) || !parseIsoDate(item.dueDate) || !natureDefinition(item.nature)) {
        invalidItemCount += 1;
        return;
      }
      if (item.nature !== nature.key || item.documentDate > asOfDate || !accountMatches(item.accountCode, accountFilter)) return;
      selectedItemIds[String(item.id)] = true;
      var amount = Number(item.amount);
      var units = Math.round(amount * factor);
      if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(units) || units <= 0) {
        invalidItemCount += 1;
        return;
      }
      var bucket = bucketFor(item.dueDate, asOfDate, range);
      if (!bucket) { invalidItemCount += 1; return; }
      var account = accountByCode[String(item.accountCode)] || null;
      var partyKey = String(item.thirdPartyId || item.thirdPartyCode || item.thirdPartyName || '');
      var key = String(item.accountCode) + '\u0000' + partyKey;
      var row = rowsByKey[key];
      if (!row) {
        row = rowsByKey[key] = {
          accountCode: String(item.accountCode),
          accountTitle: String(account && account.label || item.accountCode),
          thirdPartyId: String(item.thirdPartyId || ''),
          thirdPartyCode: String(item.thirdPartyCode || ''),
          thirdPartyName: String(item.thirdPartyName || ''),
          ageAmounts: Object.create(null),
          totalDue: 0,
          advances: 0,
          balance: 0,
          documentCount: 0,
          settlementCount: 0,
          _totalUnits: 0,
          _advanceUnits: 0
        };
        AGE_BUCKETS.forEach(function (definition) { row.ageAmounts[definition.key] = 0; });
        row._ageUnits = Object.create(null);
        AGE_BUCKETS.forEach(function (definition) { row._ageUnits[definition.key] = 0; });
      }
      var settlement = settlementsByItem[String(item.id)] || { units: 0, count: 0 };
      row._ageUnits[bucket] += units;
      row._totalUnits += units;
      row._advanceUnits += settlement.units;
      row.documentCount += 1;
      row.settlementCount += settlement.count;
      itemCount += 1;
    });

    var rows = Object.keys(rowsByKey).map(function (key) {
      var row = rowsByKey[key];
      AGE_BUCKETS.forEach(function (definition) { row.ageAmounts[definition.key] = row._ageUnits[definition.key] / factor; });
      row.totalDue = row._totalUnits / factor;
      row.advances = row._advanceUnits / factor;
      row.balance = row.totalDue - row.advances;
      delete row._ageUnits;
      delete row._totalUnits;
      delete row._advanceUnits;
      return row;
    }).sort(function (left, right) {
      return String(left.accountCode).localeCompare(String(right.accountCode), 'fr', { numeric: true }) ||
        String(left.thirdPartyName || left.thirdPartyCode).localeCompare(String(right.thirdPartyName || right.thirdPartyCode), 'fr', { sensitivity: 'base' });
    });

    settlementCount = rows.reduce(function (count, row) { return count + row.settlementCount; }, 0);
    invalidSettlementCount = invalidSettlementWithoutItemCount + Object.keys(invalidSettlementByItem).reduce(function (count, itemId) {
      return count + (selectedItemIds[itemId] ? invalidSettlementByItem[itemId] : 0);
    }, 0);

    var totals = { totalDue: 0, advances: 0, balance: 0, ageAmounts: Object.create(null) };
    AGE_BUCKETS.forEach(function (definition) { totals.ageAmounts[definition.key] = 0; });
    rows.forEach(function (row) {
      totals.totalDue += row.totalDue;
      totals.advances += row.advances;
      totals.balance += row.balance;
      AGE_BUCKETS.forEach(function (definition) { totals.ageAmounts[definition.key] += row.ageAmounts[definition.key]; });
    });

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: [],
      nature: nature ? nature.key : '',
      natureLabel: nature ? nature.label : '',
      asOfDate: asOfDate,
      range: range,
      horizonMonths: RANGE_MONTHS[range],
      horizonStart: parseIsoDate(asOfDate) ? horizonStart(asOfDate, range) : '',
      ageBuckets: AGE_BUCKETS.map(function (definition) { return Object.assign({}, definition); }),
      rows: rows,
      totals: totals,
      itemCount: itemCount,
      settlementCount: settlementCount,
      invalidItemCount: invalidItemCount,
      invalidSettlementCount: invalidSettlementCount,
      accountFilter: accountFilter,
      basis: {
        itemsAreGrossAmounts: true,
        advancesAreDatedSettlements: true,
        balanceEqualsTotalDueLessAdvances: true,
        postedJournalEntriesAreNotUsed: true
      }
    };
  }

  function natureDefinition(nature) {
    return NATURES.find(function (item) { return item.key === String(nature || ''); }) || null;
  }

  return {
    NATURES: NATURES.map(function (item) { return Object.assign({}, item); }),
    AGE_BUCKETS: AGE_BUCKETS.map(function (item) { return Object.assign({}, item); }),
    RANGE_MONTHS: Object.assign({}, RANGE_MONTHS),
    parseIsoDate: parseIsoDate,
    daysBetween: daysBetween,
    shiftMonths: shiftMonths,
    horizonStart: horizonStart,
    parseAccountFilter: parseAccountFilter,
    accountMatches: accountMatches,
    bucketFor: bucketFor,
    natureDefinition: natureDefinition,
    build: build
  };
});
