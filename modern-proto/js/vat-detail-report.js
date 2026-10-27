/* =========================================================================
   PERFECTO · État détaillé à joindre à l’état de paiement TVA
   Restitue les mouvements réels des comptes de TVA collectée/déductible.
   Les métadonnées facture/tiers ne sont jamais déduites des pièces comptables.
   ========================================================================= */
(function (root) {
  'use strict';

  var DEFAULTS = {
    billedAccounts: ['4431', '4432', '4433'],
    deductibleAccounts: ['4451', '4452', '4453', '4454', '4456']
  };
  var COLUMNS = [
    { key: 'ifu', label: 'N°INSAE/IFU' },
    { key: 'supplier', label: 'Fournisseur' },
    { key: 'invoice', label: 'Facture' },
    { key: 'amountHT', label: 'Montant HT' },
    { key: 'vatBilled', label: 'TVA facturée' },
    { key: 'vatDeductible', label: 'TVA déductible' }
  ];

  function accountLabelMap(accounts) {
    var result = Object.create(null);
    (accounts || []).forEach(function (account) { result[String(account.code)] = account.label || String(account.code); });
    return result;
  }

  function normaliseConfiguration(configuration) {
    configuration = configuration || {};
    function normaliseList(value, fallback, label) {
      var list = Array.isArray(value) ? value : fallback;
      var result = [];
      list.forEach(function (item) {
        var code = String(item == null ? '' : item).replace(/\s/g, '');
        if (!/^\d{3,8}$/.test(code)) throw new Error('Code de compte invalide dans « ' + label + ' » : ' + code);
        if (result.indexOf(code) === -1) result.push(code);
      });
      if (!result.length) throw new Error('Indiquez au moins un compte pour « ' + label + ' ».');
      return result;
    }
    var result = {
      billedAccounts: normaliseList(configuration.billedAccounts, DEFAULTS.billedAccounts, 'TVA facturée'),
      deductibleAccounts: normaliseList(configuration.deductibleAccounts, DEFAULTS.deductibleAccounts, 'TVA déductible')
    };
    result.billedAccounts.forEach(function (billed) {
      result.deductibleAccounts.forEach(function (deductible) {
        if (billed.indexOf(deductible) === 0 || deductible.indexOf(billed) === 0) {
          throw new Error('Un même compte ne peut pas être affecté à la TVA facturée et à la TVA déductible.');
        }
      });
    });
    return result;
  }

  function startsWithAny(code, prefixes) {
    var value = String(code == null ? '' : code);
    return prefixes.some(function (prefix) { return value.indexOf(prefix) === 0; });
  }

  function round(value, places) {
    var scale = Math.pow(10, Math.max(0, Math.min(6, Number(places) || 0)));
    return Math.round((Number(value) + Number.EPSILON) * scale) / scale;
  }

  function build(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error('Choisissez une période mensuelle valide.');
    var labels = accountLabelMap(options.accounts);
    var configuration = normaliseConfiguration(options.configuration);
    var byEntry = Object.create(null);
    var places = options.decimalPlaces;

    (options.entries || []).forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || String(entry.date || '').slice(0, 7) !== period) return;
      (entry.lines || []).forEach(function (line) {
        var code = String(line.account == null ? '' : line.account);
        var debit = Number(line.debit) || 0;
        var credit = Number(line.credit) || 0;
        var kind = startsWithAny(code, configuration.billedAccounts) ? 'billed'
          : (startsWithAny(code, configuration.deductibleAccounts) ? 'deductible' : '');
        if (!kind || (!debit && !credit)) return;
        var id = String(entry.id || entry.reference || '');
        if (!byEntry[id]) byEntry[id] = {
          entryId: String(entry.id || ''), date: String(entry.date || ''), journal: String(entry.journal || ''),
          reference: String(entry.reference || ''), description: String(entry.description || ''),
          vatBilled: 0, vatDeductible: 0, accounts: Object.create(null)
        };
        var row = byEntry[id];
        row[kind === 'billed' ? 'vatBilled' : 'vatDeductible'] += kind === 'billed' ? credit - debit : debit - credit;
        if (!row.accounts[code]) row.accounts[code] = { code: code, label: labels[code] || code, kind: kind, debit: 0, credit: 0 };
        row.accounts[code].debit += debit;
        row.accounts[code].credit += credit;
      });
    });

    var rows = Object.keys(byEntry).map(function (key) {
      var row = byEntry[key];
      row.vatBilled = round(row.vatBilled, places);
      row.vatDeductible = round(row.vatDeductible, places);
      row.accounts = Object.keys(row.accounts).sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); }).map(function (code) {
        var account = row.accounts[code];
        return {
          code: account.code, label: account.label, kind: account.kind,
          debit: round(account.debit, places), credit: round(account.credit, places)
        };
      });
      return row;
    }).sort(function (left, right) {
      return left.date.localeCompare(right.date) || left.reference.localeCompare(right.reference, 'fr', { numeric: true });
    });

    var totals = rows.reduce(function (sum, row) {
      sum.vatBilled += row.vatBilled;
      sum.vatDeductible += row.vatDeductible;
      return sum;
    }, { vatBilled: 0, vatDeductible: 0 });
    totals.vatBilled = round(totals.vatBilled, places);
    totals.vatDeductible = round(totals.vatDeductible, places);
    return { period: period, rows: rows, totals: totals, configuration: configuration, generatedLineCount: rows.length };
  }

  root.PerfectoVatDetailReport = {
    DEFAULTS: DEFAULTS,
    COLUMNS: COLUMNS,
    normaliseConfiguration: normaliseConfiguration,
    build: build
  };
}(typeof window !== 'undefined' ? window : globalThis));
