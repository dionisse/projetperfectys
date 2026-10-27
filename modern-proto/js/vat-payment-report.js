/* =========================================================================
   PERFECTO · État de paiement TVA
   Référentiel de lignes de la capture et extraction des mouvements validés.
   Aucun calcul de montant fiscal à payer ni aucune écriture comptable ici.
   ========================================================================= */
(function (root) {
  'use strict';

  var ROWS = [
    { section: 'Comptes de ventes exonérées', key: 'exemptLocalSales', label: 'Ventes locales exonérées', nature: 'base' },
    { section: 'Comptes de ventes exonérées', key: 'taxableExports', label: 'Exportations (taxables)', nature: 'base' },
    { section: 'Comptes de ventes exonérées', key: 'nonTaxableExports', label: 'Exportations (non taxables)', nature: 'base' },
    { section: 'Comptes de ventes et consommations', key: 'taxableSales', label: 'Ventes taxables', nature: 'base' },
    { section: 'Comptes de ventes et consommations', key: 'taxableInternalConsumption', label: 'Consommations internes taxables', nature: 'base' },
    { section: 'Comptes TVA collectée', key: 'collectedSales', label: 'Ventes', nature: 'collected' },
    { section: 'Comptes TVA collectée', key: 'collectedInternalConsumption', label: 'Consommations internes', nature: 'collected' },
    { section: 'Comptes TVA collectée', key: 'sourceWithholding', label: 'À déduire : retenue à la source', nature: 'withholding' },
    { section: 'Comptes de TVA déductible à 100%', key: 'fullDeductibleOperatingPurchases', label: 'Achats d’exploitation', nature: 'deductible' },
    { section: 'Comptes de TVA déductible à 100%', key: 'fullDeductibleFixedAssets', label: 'Achats d’immobilisations', nature: 'deductible' },
    { section: 'Comptes de TVA déductible à 100%', key: 'fullDeductibleRegularisation', label: 'Achats à régulariser', nature: 'deductible' },
    { section: 'Comptes de TVA déductible au prorata', key: 'prorataDeductibleOperatingPurchases', label: 'Achats d’exploitation', nature: 'deductibleProrata' },
    { section: 'Comptes de TVA déductible au prorata', key: 'prorataDeductibleFixedAssets', label: 'Achats d’immobilisations', nature: 'deductibleProrata' }
  ];

  function cleanCodes(value) {
    var list = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;]+/);
    var seen = Object.create(null);
    return list.map(function (code) { return String(code || '').trim(); }).filter(function (code) {
      if (!code || !/^[0-9]+\*?$/.test(code) || seen[code]) return false;
      seen[code] = true;
      return true;
    });
  }

  function defaults(year) {
    var accounts = {};
    ROWS.forEach(function (row) { accounts[row.key] = []; });
    return { schemaVersion: 1, year: Number(year) || null, accounts: accounts };
  }

  function normalise(configuration, year) {
    var source = configuration || {};
    var result = defaults(year);
    ROWS.forEach(function (row) {
      result.accounts[row.key] = cleanCodes(source.accounts && source.accounts[row.key]);
    });
    result.year = Number(year) || Number(source.year) || null;
    return result;
  }

  function accountMatches(code, selectors) {
    var accountCode = String(code == null ? '' : code);
    return cleanCodes(selectors).some(function (selector) {
      var prefix = selector.replace(/\*$/, '');
      return accountCode.indexOf(prefix) === 0;
    });
  }

  function calculateMovements(options) {
    options = options || {};
    var from = String(options.from || '');
    var to = String(options.to || '');
    var configuration = normalise(options.configuration, Number(from.slice(0, 4)));
    var places = Math.max(0, Math.min(6, Number(options.decimalPlaces) || 0));
    var round = function (value) { var scale = Math.pow(10, places); return Math.round((Number(value) + Number.EPSILON) * scale) / scale; };
    var accountLabels = Object.create(null);
    (options.accounts || []).forEach(function (account) { accountLabels[String(account.code)] = account.label || String(account.code); });
    var byKey = Object.create(null);
    ROWS.forEach(function (row) {
      byKey[row.key] = { key: row.key, label: row.label, section: row.section, nature: row.nature, selectors: configuration.accounts[row.key].slice(), accounts: Object.create(null) };
    });
    var matchedLineCount = 0;
    (options.entries || []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.date || '')) || entry.date < from || entry.date > to) return;
      (entry.lines || []).forEach(function (line) {
        var code = String(line.account == null ? '' : line.account);
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        if (!debit && !credit) return;
        var matched = false;
        ROWS.forEach(function (row) {
          if (!accountMatches(code, configuration.accounts[row.key])) return;
          var target = byKey[row.key].accounts[code];
          if (!target) target = byKey[row.key].accounts[code] = { code: code, label: accountLabels[code] || code, debit: 0, credit: 0 };
          target.debit += debit;
          target.credit += credit;
          matched = true;
        });
        if (matched) matchedLineCount += 1;
      });
    });

    var rows = ROWS.map(function (row) {
      var item = byKey[row.key];
      var accounts = Object.keys(item.accounts).sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); }).map(function (code) {
        var account = item.accounts[code];
        account.debit = round(account.debit);
        account.credit = round(account.credit);
        account.net = round(account.credit - account.debit);
        return account;
      });
      item.accounts = accounts;
      item.debitTotal = round(accounts.reduce(function (sum, account) { return sum + account.debit; }, 0));
      item.creditTotal = round(accounts.reduce(function (sum, account) { return sum + account.credit; }, 0));
      item.netCredit = round(item.creditTotal - item.debitTotal);
      return item;
    });
    return { from: from, to: to, rows: rows, matchedLineCount: matchedLineCount };
  }

  root.PerfectoVatPaymentReport = {
    ROWS: ROWS,
    defaults: defaults,
    normalise: normalise,
    cleanCodes: cleanCodes,
    accountMatches: accountMatches,
    calculateMovements: calculateMovements
  };
}(typeof window !== 'undefined' ? window : globalThis));
