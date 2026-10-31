/* Simulation explicite des clés analytiques ; aucun enregistrement n’est modifié. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AnalyticalAllocationPreview = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function parseDecimal(value) {
    var raw = String(value == null ? '' : value).trim().replace(/\s+/g, '');
    if (!/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(raw)) return NaN;
    return Number(raw.replace(',', '.'));
  }

  function simulate(options) {
    options = options || {};
    var mode = String(options.mode || '');
    var precisionDigits = Number(options.decimalPlaces);
    if (!Number.isInteger(precisionDigits) || precisionDigits < 0 || precisionDigits > 4) precisionDigits = 0;
    var precision = Math.pow(10, precisionDigits);
    var sourceAmount = parseDecimal(options.sourceAmount);
    var rows = Array.isArray(options.rows) ? options.rows : [];
    var errors = [];
    if (['weights', 'percentage', 'amount'].indexOf(mode) === -1) errors.push('Choisissez explicitement une interprétation des clés.');
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) errors.push('Saisissez un montant de base positif.');
    if (Number.isFinite(sourceAmount) && !Number.isSafeInteger(Math.round(sourceAmount * precision))) errors.push('Le montant de base dépasse la plage numérique sûre pour cette précision.');
    if (Number.isFinite(sourceAmount) && Math.abs(sourceAmount * precision - Math.round(sourceAmount * precision)) > 1e-7) {
      errors.push('Le montant de base dépasse la précision configurée du dossier.');
    }
    if (!rows.length) errors.push('Aucune ligne de clé n’est disponible pour cette simulation.');
    if (errors.length) return { ok: false, errors: errors };

    var sourceUnits = Math.round(sourceAmount * precision);
    var parsedRows = rows.map(function (row, index) {
      var key = parseDecimal(row && row.key);
      if (!Number.isFinite(key)) errors.push('Clé ' + (index + 1) + ' : saisissez un nombre positif ou nul, sans unité implicite.');
      return { row: row || {}, index: index, key: key };
    });
    if (errors.length) return { ok: false, errors: errors };
    if (mode === 'percentage' && parsedRows.some(function (item) { return item.key > 100; })) {
      return { ok: false, errors: ['Une clé en pourcentage ne peut pas dépasser 100 %.'] };
    }

    var keyTotal = parsedRows.reduce(function (sum, item) { return sum + item.key; }, 0);
    if (!Number.isFinite(keyTotal)) return { ok: false, errors: ['La somme des clés dépasse la plage numérique sûre.'] };
    if (!(keyTotal > 0)) return { ok: false, errors: ['La somme des clés doit être supérieure à zéro.'] };
    if (mode === 'percentage' && keyTotal > 100 + 1e-8) {
      return { ok: false, errors: ['Le total des pourcentages dépasse 100 %. Aucune répartition n’est calculée.'] };
    }

    var allocationUnits;
    if (mode === 'weights') {
      allocationUnits = parsedRows.map(function (item) { return Math.round(sourceUnits * item.key / keyTotal); });
    } else if (mode === 'percentage') {
      allocationUnits = parsedRows.map(function (item) { return Math.round(sourceUnits * item.key / 100); });
    } else {
      allocationUnits = parsedRows.map(function (item) {
        var units = Math.round(item.key * precision);
        if (Math.abs(item.key * precision - units) > 1e-7) errors.push('Une clé en montant dépasse la précision configurée du dossier.');
        return units;
      });
      if (errors.length) return { ok: false, errors: Array.from(new Set(errors)) };
      if (allocationUnits.some(function (units) { return !Number.isSafeInteger(units); })) return { ok: false, errors: ['Un montant fixe dépasse la plage numérique sûre.'] };
    }

    var allocatedUnits = allocationUnits.reduce(function (sum, units) { return sum + units; }, 0);
    if (!Number.isSafeInteger(allocatedUnits)) return { ok: false, errors: ['Le total des montants calculés dépasse la plage numérique sûre.'] };
    var roundingDifference = sourceUnits - allocatedUnits;
    var hasCompletePercentage = mode === 'percentage' && Math.abs(keyTotal - 100) <= 1e-8;
    var requiresRoundingChoice = mode === 'weights' && roundingDifference !== 0 || hasCompletePercentage && roundingDifference !== 0;
    var roundingAmount = requiresRoundingChoice ? roundingDifference / precision : 0;
    if (allocatedUnits > sourceUnits && !requiresRoundingChoice) {
      return { ok: false, errors: ['Le total calculé dépasse le montant de base. Aucune répartition n’est proposée.'] };
    }
    var roundingRowIndex = options.roundingRowIndex === '' || options.roundingRowIndex == null
      ? -1
      : Number(options.roundingRowIndex);
    if (requiresRoundingChoice) {
      if (!Number.isInteger(roundingRowIndex) || roundingRowIndex < 0 || roundingRowIndex >= allocationUnits.length) {
        return {
          ok: false,
          requiresRoundingChoice: true,
          roundingDifference: roundingDifference / precision,
          roundingAmount: roundingAmount,
          errors: ['Choisissez explicitement la ligne qui recevra l’écart d’arrondi de ' + (roundingDifference / precision).toFixed(precisionDigits) + ' XOF.']
        };
      }
      allocationUnits[roundingRowIndex] += roundingDifference;
      if (allocationUnits[roundingRowIndex] < 0) {
        return { ok: false, errors: ['La ligne choisie ne peut pas absorber l’écart d’arrondi sans devenir négative.'] };
      }
      allocatedUnits = allocationUnits.reduce(function (sum, units) { return sum + units; }, 0);
      roundingDifference = 0;
    }

    return {
      ok: true,
      mode: mode,
      sourceAmount: sourceUnits / precision,
      keyTotal: keyTotal,
      allocations: parsedRows.map(function (item, index) {
        return {
          index: item.index,
          mainSection: String(item.row.mainSection || ''),
          counterpart: String(item.row.counterpart || item.row.auxiliarySection || item.row.serviceFamily || ''),
          key: String(item.row.key == null ? '' : item.row.key),
          amount: allocationUnits[index] / precision
        };
      }),
      allocatedAmount: allocatedUnits / precision,
      unallocatedAmount: (sourceUnits - allocatedUnits) / precision,
      complete: allocatedUnits === sourceUnits && (mode !== 'percentage' || hasCompletePercentage),
      unallocatedPercent: mode === 'percentage' ? Math.max(0, 100 - keyTotal) : 0,
      roundingApplied: requiresRoundingChoice,
      roundingAmount: roundingAmount,
      roundingRowIndex: requiresRoundingChoice ? roundingRowIndex : -1
    };
  }

  return { simulate: simulate };
});
