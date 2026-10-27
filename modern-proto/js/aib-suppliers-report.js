/* =========================================================================
   PERFECTO · État mensuel des retenues d’AIB sur les fournisseurs
   Paramétrage annuel fourni par l’utilisateur. Aucun taux ni calcul fiscal
   n’est présumé; le raccordement au tableau Excel dédié viendra ensuite.
   ========================================================================= */
(function (root) {
  'use strict';

  var CATEGORIES = [
    { key: 'purchases', label: 'AIB SUR ACHATS' },
    { key: 'honoraires', label: 'AIB SUR HONORAIRES' }
  ];

  function cleanAccounts(value) {
    var entries = Array.isArray(value) ? value : String(value == null ? '' : value).split(/[\s,;]+/);
    var seen = Object.create(null);
    return entries.map(function (entry) { return String(entry == null ? '' : entry).trim(); }).filter(function (code) {
      if (!code || !/^\d+\*?$/.test(code) || seen[code]) return false;
      seen[code] = true;
      return true;
    });
  }

  function defaults(year) {
    return {
      schemaVersion: 1,
      year: Number(year) || null,
      categories: CATEGORIES.map(function (category) {
        return { key: category.key, label: category.label, rate: '', accounts: [] };
      })
    };
  }

  function normalise(configuration, year) {
    var source = configuration && typeof configuration === 'object' ? configuration : {};
    var supplied = Array.isArray(source.categories) ? source.categories : [];
    return {
      schemaVersion: 1,
      year: Number(year) || Number(source.year) || null,
      categories: CATEGORIES.map(function (category) {
        var row = supplied.find(function (candidate) { return candidate && candidate.key === category.key; }) || {};
        return {
          key: category.key,
          label: category.label,
          rate: String(row.rate == null ? '' : row.rate).trim().replace(',', '.').replace(/\s*%$/, '').trim().slice(0, 24),
          accounts: cleanAccounts(row.accounts)
        };
      })
    };
  }

  function validateDefinition(configuration, year) {
    var normalized = normalise(configuration, year);
    var errors = [];
    normalized.categories.forEach(function (category) {
      if (!category.rate || !/^\d+(?:\.\d+)?$/.test(category.rate) || Number(category.rate) < 0 || Number(category.rate) > 100) {
        errors.push('Saisissez un taux compris entre 0 et 100 % pour « ' + category.label + ' ».');
      }
      if (!category.accounts.length) errors.push('Sélectionnez au moins un compte pour « ' + category.label + ' ».');
    });
    return { ok: errors.length === 0, errors: errors, configuration: normalized };
  }

  function prepare(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Choisissez un mois de référence valide.');
    var validation = validateDefinition(options.configuration, Number(period.slice(0, 4)));
    if (!validation.ok) throw new Error(validation.errors.join(' '));
    var payment = options.payment || {};
    var method = payment.method === 'cheque' ? 'cheque' : (payment.method === 'cash' ? 'cash' : '');
    return {
      period: period,
      year: Number(period.slice(0, 4)),
      configuration: validation.configuration,
      payment: {
        method: method,
        cheque: String(payment.cheque || '').trim(),
        bank: String(payment.bank || '').trim()
      },
      declarant: {
        signer: String(options.signer || '').trim(),
        city: String(options.city || '').trim(),
        signatureDate: String(options.signatureDate || '').trim()
      },
      excelTable: null,
      generatedWithholdingLines: 0
    };
  }

  root.PerfectoAibSuppliersReport = {
    CATEGORIES: CATEGORIES,
    defaults: defaults,
    cleanAccounts: cleanAccounts,
    normalise: normalise,
    validateDefinition: validateDefinition,
    prepare: prepare
  };
}(typeof window !== 'undefined' ? window : globalThis));
