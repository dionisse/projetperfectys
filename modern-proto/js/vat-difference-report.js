/* =========================================================================
   PERFECTO · Comparaison TVA calculée / TVA facturée
   Calcul pur, fondé sur les écritures validées et les correspondances choisies.
   ========================================================================= */
(function (root) {
  'use strict';

  var STANDARD_RATE_2026 = 18;
  var DEFAULTS = {
    salesBase: ['70*'],
    internalBase: ['722', '724'],
    salesVat: ['4431', '4432', '4433'],
    internalVat: ['4434']
  };

  function cleanCodes(value) {
    var list = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;]+/);
    var seen = Object.create(null);
    return list.map(function (code) { return String(code || '').trim(); })
      .filter(function (code) {
        if (!code || !/^[0-9]+\*?$/.test(code) || seen[code]) return false;
        seen[code] = true;
        return true;
      });
  }

  function defaults(year) {
    return {
      year: Number(year), rate: STANDARD_RATE_2026,
      salesBase: DEFAULTS.salesBase.slice(), internalBase: DEFAULTS.internalBase.slice(),
      salesVat: DEFAULTS.salesVat.slice(), internalVat: DEFAULTS.internalVat.slice()
    };
  }

  function normalise(configuration, year) {
    var base = defaults(year);
    var source = configuration || {};
    ['salesBase', 'internalBase', 'salesVat', 'internalVat'].forEach(function (key) {
      base[key] = cleanCodes(source[key] == null ? base[key] : source[key]);
    });
    var rate = Number(source.rate);
    base.rate = Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : STANDARD_RATE_2026;
    base.year = Number(year) || Number(source.year) || new Date().getFullYear();
    return base;
  }

  function accountMatches(code, selectors) {
    var accountCode = String(code == null ? '' : code);
    return cleanCodes(selectors).some(function (selector) {
      var prefix = selector.replace(/\*$/, '');
      return selector.slice(-1) === '*' ? accountCode.indexOf(prefix) === 0 : (accountCode === prefix || accountCode.indexOf(prefix) === 0);
    });
  }

  function round(value, places) {
    var scale = Math.pow(10, Math.max(0, Math.min(6, Number(places) || 0)));
    return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
  }

  function monthAccumulator(year, month) {
    return {
      year: year, month: month,
      salesBase: 0, internalBase: 0, salesVatBooked: 0, internalVatBooked: 0,
      hasActivity: false
    };
  }

  function calculate(options) {
    options = options || {};
    var year = Number(options.year);
    var configuration = normalise(options.configuration, year);
    var places = options.decimalPlaces;
    var months = [];
    var byMonth = Object.create(null);
    for (var month = 1; month <= 12; month++) {
      var item = monthAccumulator(year, month);
      months.push(item);
      byMonth[String(month).padStart(2, '0')] = item;
    }

    (options.entries || []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || '')) || Number(entry.date.slice(0, 4)) !== year) return;
      var bucket = byMonth[entry.date.slice(5, 7)];
      if (!bucket) return;
      (entry.lines || []).forEach(function (line) {
        var code = String(line.account == null ? '' : line.account);
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (debit === 0 && credit === 0) return;
        var balance = credit - debit;
        var matched = false;
        if (accountMatches(code, configuration.salesBase)) { bucket.salesBase += balance; matched = true; }
        if (accountMatches(code, configuration.internalBase)) {
          // The SYSCOHADA class 6 has a debit-normal balance; class 7 output accounts are credit-normal.
          bucket.internalBase += String(code).charAt(0) === '6' ? debit - credit : balance;
          matched = true;
        }
        if (accountMatches(code, configuration.salesVat)) { bucket.salesVatBooked += balance; matched = true; }
        if (accountMatches(code, configuration.internalVat)) { bucket.internalVatBooked += balance; matched = true; }
        if (matched) bucket.hasActivity = true;
      });
    });

    var visibleMonths = months.filter(function (month) { return month.hasActivity; }).map(function (month) {
      var salesVatCalculated = round(month.salesBase * configuration.rate / 100, places);
      var internalVatCalculated = round(month.internalBase * configuration.rate / 100, places);
      return {
        year: year, month: month.month,
        salesBase: round(month.salesBase, places), internalBase: round(month.internalBase, places),
        salesVatCalculated: salesVatCalculated, salesVatBooked: round(month.salesVatBooked, places),
        salesDifference: round(salesVatCalculated - month.salesVatBooked, places),
        internalVatCalculated: internalVatCalculated, internalVatBooked: round(month.internalVatBooked, places),
        internalDifference: round(internalVatCalculated - month.internalVatBooked, places),
        calculatedTotal: round(salesVatCalculated + internalVatCalculated, places),
        bookedTotal: round(month.salesVatBooked + month.internalVatBooked, places),
        differenceTotal: round(salesVatCalculated + internalVatCalculated - month.salesVatBooked - month.internalVatBooked, places)
      };
    });

    var totalSalesBase = months.reduce(function (sum, month) { return sum + month.salesBase; }, 0);
    var totalInternalBase = months.reduce(function (sum, month) { return sum + month.internalBase; }, 0);
    var totalSalesVatBooked = months.reduce(function (sum, month) { return sum + month.salesVatBooked; }, 0);
    var totalInternalVatBooked = months.reduce(function (sum, month) { return sum + month.internalVatBooked; }, 0);
    var totalSalesVatCalculated = round(totalSalesBase * configuration.rate / 100, places);
    var totalInternalVatCalculated = round(totalInternalBase * configuration.rate / 100, places);

    return {
      year: year, rate: configuration.rate, months: visibleMonths,
      generatedLineCount: visibleMonths.length,
      totals: {
        salesBase: round(totalSalesBase, places), internalBase: round(totalInternalBase, places),
        salesVatCalculated: totalSalesVatCalculated, salesVatBooked: round(totalSalesVatBooked, places),
        salesDifference: round(totalSalesVatCalculated - totalSalesVatBooked, places),
        internalVatCalculated: totalInternalVatCalculated, internalVatBooked: round(totalInternalVatBooked, places),
        internalDifference: round(totalInternalVatCalculated - totalInternalVatBooked, places),
        calculatedTotal: round(totalSalesVatCalculated + totalInternalVatCalculated, places),
        bookedTotal: round(totalSalesVatBooked + totalInternalVatBooked, places),
        differenceTotal: round(totalSalesVatCalculated + totalInternalVatCalculated - totalSalesVatBooked - totalInternalVatBooked, places)
      }
    };
  }

  root.PerfectoVatDifferenceReport = {
    STANDARD_RATE_2026: STANDARD_RATE_2026,
    defaults: defaults,
    cleanCodes: cleanCodes,
    normalise: normalise,
    accountMatches: accountMatches,
    calculate: calculate
  };
}(typeof window !== 'undefined' ? window : globalThis));
