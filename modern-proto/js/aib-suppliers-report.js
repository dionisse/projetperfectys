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

  function blankLine(categoryKey, id) {
    return { id: String(id || categoryKey + '-1'), rate: '', accounts: [] };
  }

  function defaults(year) {
    return {
      schemaVersion: 2,
      year: Number(year) || null,
      categories: CATEGORIES.map(function (category) {
        return { key: category.key, label: category.label, lines: [blankLine(category.key)] };
      })
    };
  }

  function normalise(configuration, year) {
    var source = configuration && typeof configuration === 'object' ? configuration : {};
    var supplied = Array.isArray(source.categories) ? source.categories : [];
    var usedIds = Object.create(null);
    return {
      schemaVersion: 2,
      year: Number(year) || Number(source.year) || null,
      categories: CATEGORIES.map(function (category) {
        var row = supplied.find(function (candidate) { return candidate && candidate.key === category.key; }) || {};
        var rawLines = Array.isArray(row.lines) ? row.lines : null;
        if (!rawLines) rawLines = [{ id: category.key + '-1', rate: row.rate, accounts: row.accounts }];
        var lines = rawLines.map(function (line, index) {
          line = line && typeof line === 'object' ? line : {};
          var id = String(line.id || category.key + '-' + (index + 1)).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
          if (!id || usedIds[id]) id = category.key + '-' + (index + 1);
          while (usedIds[id]) id += '-x';
          usedIds[id] = true;
          return {
            id: id,
            rate: String(line.rate == null ? '' : line.rate).trim().replace(',', '.').replace(/\s*%$/, '').trim().slice(0, 24),
            accounts: cleanAccounts(line.accounts)
          };
        });
        if (!lines.length) lines = [blankLine(category.key, category.key + '-1')];
        return { key: category.key, label: category.label, lines: lines };
      })
    };
  }

  function nextLineId(configuration, categoryKey) {
    var category = configuration.categories.find(function (row) { return row.key === categoryKey; });
    var max = 0;
    (category ? category.lines : []).forEach(function (line) {
      var match = String(line.id).match(new RegExp('^' + categoryKey + '-(\\d+)$'));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return categoryKey + '-' + (max + 1);
  }

  function addLine(configuration, categoryKey) {
    var result = normalise(configuration, configuration && configuration.year);
    var category = result.categories.find(function (row) { return row.key === categoryKey; });
    if (!category) throw new Error('Rubrique AIB inconnue.');
    category.lines.push(blankLine(categoryKey, nextLineId(result, categoryKey)));
    return result;
  }

  function removeLine(configuration, categoryKey, lineId) {
    var result = normalise(configuration, configuration && configuration.year);
    var category = result.categories.find(function (row) { return row.key === categoryKey; });
    if (!category) throw new Error('Rubrique AIB inconnue.');
    if (category.lines.length <= 1) throw new Error('Chaque rubrique doit conserver au moins une ligne.');
    category.lines = category.lines.filter(function (line) { return line.id !== lineId; });
    if (!category.lines.length) category.lines = [blankLine(categoryKey, categoryKey + '-1')];
    return result;
  }

  function validateDefinition(configuration, year) {
    var normalized = normalise(configuration, year);
    var errors = [];
    normalized.categories.forEach(function (category) {
      category.lines.forEach(function (line, index) {
        var prefix = 'Ligne ' + (index + 1) + ' de « ' + category.label + ' » : ';
        if (!line.rate || !/^\d+(?:\.\d+)?$/.test(line.rate) || !isFinite(Number(line.rate)) || Number(line.rate) < 0) {
          errors.push(prefix + 'saisissez un taux numérique positif ou nul.');
        }
        if (!line.accounts.length) errors.push(prefix + 'sélectionnez au moins un compte.');
      });
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
    addLine: addLine,
    removeLine: removeLine,
    validateDefinition: validateDefinition,
    prepare: prepare
  };
}(typeof window !== 'undefined' ? window : globalThis));
