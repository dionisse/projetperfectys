/*
 * PERFECTO · Balance des tiers.
 * Calcule uniquement depuis les reports d'ouverture explicitement liés à un tiers
 * et les mouvements auxiliaires validés fournis par le dossier.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoThirdPartyBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var NATURES = [
    { key: 'suppliers', label: 'Fournisseurs' },
    { key: 'clients', label: 'Clients' },
    { key: 'personnel', label: 'Personnel' },
    { key: 'debtors', label: 'Débiteurs divers' },
    { key: 'creditors', label: 'Créditeurs divers' }
  ];

  var COLUMN_DEFINITIONS = [
    { key: 'thirdPartyCode', label: 'Code du Tiers', defaultSelected: true, text: true },
    { key: 'thirdPartyTitle', label: 'Intitulé du Tiers', defaultSelected: true, text: true },
    { key: 'openingReport', label: 'Report en Début d’Exercice', defaultSelected: false },
    { key: 'cumulativeStart', label: 'Cumul en Début de Période', defaultSelected: false },
    { key: 'openingBalance', label: 'Solde en Début de Période', defaultSelected: true },
    { key: 'movements', label: 'Mouvements de la Période', defaultSelected: true },
    { key: 'movementBalance', label: 'Solde de la Période', defaultSelected: false },
    { key: 'cumulativeEnd', label: 'Cumul en Fin de Période', defaultSelected: false },
    { key: 'closingBalance', label: 'Solde en Fin de Période', defaultSelected: true }
  ];

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

  function normalizeReference(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function auxiliaryAccountCode(record) {
    return String(record && (record.auxiliaryAccountCode || (record.accountCode && record.code
      ? record.accountCode + '-' + record.code
      : '')) || '').trim();
  }

  function recordKey(record, index) {
    return String(record && record.id || '') || ('third-party-' + index + ':' + String(record && record.code || ''));
  }

  function finiteMinor(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    if (!Number.isSafeInteger(scaled) || Math.abs(amount - scaled / factor) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 4) return null;
    return scaled;
  }

  function createAliasIndex(records) {
    var index = new Map();
    function register(reference, record) {
      var normalized = normalizeReference(reference);
      if (!normalized) return;
      if (index.has(normalized) && index.get(normalized) !== record) index.set(normalized, null);
      else if (!index.has(normalized)) index.set(normalized, record);
    }
    records.forEach(function (record) {
      if (!record) return;
      register(record.id, record);
      register(record.code, record);
      register(auxiliaryAccountCode(record), record);
    });
    return index;
  }

  function emptyResult(options, errors, warnings, filter) {
    options = options || {};
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      nature: String(options.nature || 'clients'),
      natureLabel: (NATURES.find(function (item) { return item.key === String(options.nature || 'clients'); }) || NATURES[1]).label,
      from: String(options.from || ''),
      to: String(options.to || ''),
      rows: [],
      tierCount: 0,
      sourceMovementCount: 0,
      periodMovementCount: 0,
      openingReportLineCount: 0,
      unattributedOpeningBalanceCount: 0,
      unmatchedMovementCount: 0,
      totals: {},
      thirdPartyFilter: filter || null,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        unlinkedOpeningReportsExcluded: true,
        unattributedCollectiveLinesExcluded: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var nature = String(options.nature || 'clients').toLowerCase();
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    var records = Array.isArray(options.thirdPartyRecords) ? options.thirdPartyRecords.filter(Boolean) : [];
    var movements = Array.isArray(options.thirdPartyMovements) ? options.thirdPartyMovements : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var sourceErrors = Array.isArray(options.sourceErrors) ? options.sourceErrors.map(String) : [];
    var sourceWarnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var from = String(options.from || '');
    var to = String(options.to || '');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var filterExpression = options.thirdPartyFilter == null ? '*' : String(options.thirdPartyFilter);
    var errors = [];
    var warnings = sourceWarnings.slice();
    if (!natureInfo) errors.push('Choisissez une nature de tiers disponible.');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour la période.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (from < cycleStart || to > cycleEnd)) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    if (sourceErrors.length) errors.push.apply(errors, sourceErrors);
    if (errors.length) return emptyResult(options, errors, warnings, null);

    var aliases = createAliasIndex(records);
    var tokens = filterExpression.trim().split(/[\s,;]+/).filter(Boolean);
    var filter = { valid: tokens.length > 0, all: tokens.indexOf('*') !== -1, selectedKeys: Object.create(null), codes: [], error: '' };
    if (!tokens.length) {
      filter.error = 'Indiquez un code de tiers ou * pour sélectionner tous les tiers.';
    } else if (!filter.all) {
      var invalidTokens = [];
      tokens.forEach(function (token) {
        var reference = normalizeReference(token);
        if (!aliases.has(reference)) {
          invalidTokens.push(token);
          return;
        }
        var record = aliases.get(reference);
        if (!record) {
          invalidTokens.push(token + ' (référence ambiguë)');
          return;
        }
        var index = records.indexOf(record);
        var key = recordKey(record, index);
        filter.selectedKeys[key] = true;
        if (filter.codes.indexOf(String(record.code || '')) === -1) filter.codes.push(String(record.code || ''));
      });
      if (invalidTokens.length) {
        filter.valid = false;
        filter.error = 'Tiers introuvable(s) ou ambigu(s) : ' + invalidTokens.join(', ') + '.';
      }
    }
    if (!filter.valid) return emptyResult(options, [filter.error], warnings, filter);

    var selectedRecords = records.filter(function (record, index) {
      if (!String(record.code || '').trim()) return false;
      return filter.all || !!filter.selectedKeys[recordKey(record, index)];
    });
    var selectedRecordKeys = Object.create(null);
    var selectedAccountCodes = Object.create(null);
    selectedRecords.forEach(function (record, index) {
      var key = recordKey(record, records.indexOf(record) >= 0 ? records.indexOf(record) : index);
      selectedRecordKeys[key] = true;
      var accountCode = String(record.accountCode || '').trim();
      if (accountCode) selectedAccountCodes[accountCode] = true;
    });
    var aggregateByKey = Object.create(null);
    var sourceMovementKeys = Object.create(null);
    var sourceMovementCount = 0;
    var periodMovementCount = 0;
    var openingReportLineCount = 0;
    var unattributedOpeningBalanceCount = 0;
    var unmatchedMovementCount = 0;
    var ambiguousMovementCount = 0;
    var wrongAccountMovementCount = 0;
    var totalsOverflow = false;
    var openingDate = dayBefore(cycleStart);

    function ensureAggregate(record) {
      var recordIndex = records.indexOf(record);
      var key = recordKey(record, recordIndex);
      if (!aggregateByKey[key]) {
        aggregateByKey[key] = {
          thirdPartyId: String(record.id || ''),
          thirdPartyCode: String(record.code || ''),
          thirdPartyTitle: String(record.name || record.label || ''),
          auxiliaryAccountCode: auxiliaryAccountCode(record),
          openingReportKnown: false,
          openingReportDebitMinor: 0,
          openingReportCreditMinor: 0,
          priorDebitMinor: 0,
          priorCreditMinor: 0,
          movementDebitMinor: 0,
          movementCreditMinor: 0,
          sourceMovementCount: 0,
          periodMovementCount: 0
        };
      }
      return aggregateByKey[key];
    }

    function addAmounts(target, debitMinor, creditMinor, debitKey, creditKey) {
      target[debitKey] += debitMinor;
      target[creditKey] += creditMinor;
      if (!Number.isSafeInteger(target[debitKey]) || !Number.isSafeInteger(target[creditKey])) totalsOverflow = true;
    }

    var selectedOpeningRecords = openingBalances.filter(function (record) {
      return record && selectedAccountCodes[String(record.accountCode || '').trim()];
    });
    selectedOpeningRecords.forEach(function (record) {
      var explicitReferences = [record.thirdPartyId, record.thirdPartyCode, record.auxiliaryCode].map(normalizeReference).filter(Boolean);
      var matchedRecords = [];
      explicitReferences.forEach(function (reference) {
        var match = aliases.get(reference);
        if (match && matchedRecords.indexOf(match) === -1) matchedRecords.push(match);
      });
      var hasAmbiguousReference = explicitReferences.some(function (reference) { return aliases.has(reference) && aliases.get(reference) === null; });
      if (!explicitReferences.length || hasAmbiguousReference || matchedRecords.length !== 1) {
        unattributedOpeningBalanceCount += 1;
        return;
      }
      var thirdParty = matchedRecords[0];
      var thirdPartyIndex = records.indexOf(thirdParty);
      var thirdPartyKey = recordKey(thirdParty, thirdPartyIndex);
      if (!selectedRecordKeys[thirdPartyKey]) return;
      if (String(record.accountCode || '') !== String(thirdParty.accountCode || '')) {
        warnings.push('Un report d’ouverture lié au tiers « ' + String(thirdParty.code || '') + ' » porte un compte collectif différent ; il n’est pas repris.');
        return;
      }
      if (String(record.date || '') !== openingDate) {
        errors.push('Le report d’ouverture lié au tiers « ' + String(thirdParty.code || '') + ' » n’est pas daté de la veille du cycle (' + openingDate + ').');
        return;
      }
      var debitMinor = finiteMinor(record.debit, factor);
      var creditMinor = finiteMinor(record.credit, factor);
      if (debitMinor === null || creditMinor === null || (debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
        errors.push('Le report d’ouverture lié au tiers « ' + String(thirdParty.code || '') + ' » contient un montant invalide.');
        return;
      }
      var aggregate = ensureAggregate(thirdParty);
      aggregate.openingReportKnown = true;
      addAmounts(aggregate, debitMinor, creditMinor, 'openingReportDebitMinor', 'openingReportCreditMinor');
      openingReportLineCount += 1;
    });

    movements.forEach(function (movement, movementIndex) {
      if (!movement) return;
      var accountCode = String(movement.account || movement.accountCode || '').trim();
      if (!selectedAccountCodes[accountCode]) return;
      var auxiliaryReference = normalizeReference(movement.auxiliaryCode || movement.auxiliaryAccountCode || movement.auxiliaryId);
      var matched = aliases.get(auxiliaryReference);
      if (!auxiliaryReference || !aliases.has(auxiliaryReference)) {
        unmatchedMovementCount += 1;
        return;
      }
      if (!matched) {
        ambiguousMovementCount += 1;
        return;
      }
      var recordIndex = records.indexOf(matched);
      var key = recordKey(matched, recordIndex);
      if (!selectedRecordKeys[key]) return;
      if (String(matched.accountCode || '') !== accountCode) {
        wrongAccountMovementCount += 1;
        return;
      }
      var date = String(movement.date || '');
      if (!isIsoDate(date)) {
        errors.push('Un mouvement auxiliaire du tiers « ' + String(matched.code || '') + ' » porte une date invalide.');
        return;
      }
      if (date < cycleStart || date > cycleEnd || date > to) return;
      var debitMinor = finiteMinor(movement.debit, factor);
      var creditMinor = finiteMinor(movement.credit, factor);
      if (debitMinor === null || creditMinor === null || (debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
        errors.push('Un mouvement auxiliaire du tiers « ' + String(matched.code || '') + ' » contient un montant invalide.');
        return;
      }
      var sourceLineKey = String(movement.sourceEntryId || '') && String(movement.lineNumber || '')
        ? String(movement.sourceEntryId) + ':' + String(movement.lineNumber)
        : 'movement-' + movementIndex;
      if (sourceMovementKeys[sourceLineKey]) return;
      sourceMovementKeys[sourceLineKey] = true;
      var aggregate = ensureAggregate(matched);
      if (date < from) {
        addAmounts(aggregate, debitMinor, creditMinor, 'priorDebitMinor', 'priorCreditMinor');
      } else {
        addAmounts(aggregate, debitMinor, creditMinor, 'movementDebitMinor', 'movementCreditMinor');
        aggregate.periodMovementCount += 1;
        periodMovementCount += 1;
      }
      aggregate.sourceMovementCount += 1;
      sourceMovementCount += 1;
    });

    if (unattributedOpeningBalanceCount) warnings.push(unattributedOpeningBalanceCount + ' report(s) sur les comptes auxiliaires sélectionnés n’ont pas d’identifiant de tiers explicite et non ambigu ; ils ne sont pas affectés.');
    if (!openingReportLineCount) warnings.push('Aucun report en début d’exercice n’est explicitement rattaché à une fiche de tiers ; les cumuls et soldes ne reprennent donc que les montants sources individualisés disponibles.');
    if (unmatchedMovementCount) warnings.push(unmatchedMovementCount + ' mouvement(s) sur les comptes collectifs des tiers sélectionnés ne portent pas de référence auxiliaire reconnue ; ils ne sont attribués à aucune fiche.');
    if (ambiguousMovementCount) warnings.push(ambiguousMovementCount + ' mouvement(s) portent une référence auxiliaire correspondant à plusieurs fiches ; ils sont exclus plutôt que devinés.');
    if (wrongAccountMovementCount) warnings.push(wrongAccountMovementCount + ' mouvement(s) rattachés à une fiche portent un compte collectif différent de celui enregistré sur cette fiche ; ils sont exclus.');
    warnings.push('Seuls les reports explicitement reliés par identifiant/code de tiers sont repris ; les libellés libres du registre ne sont jamais interprétés comme une liaison.');
    if (totalsOverflow) errors.push('Les cumuls de la balance des tiers dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.');
    if (errors.length) return emptyResult(options, errors, warnings, filter);

    var rows = Object.keys(aggregateByKey).map(function (key) {
      var aggregate = aggregateByKey[key];
      var cumulativeStartDebitMinor = aggregate.openingReportDebitMinor + aggregate.priorDebitMinor;
      var cumulativeStartCreditMinor = aggregate.openingReportCreditMinor + aggregate.priorCreditMinor;
      var cumulativeEndDebitMinor = cumulativeStartDebitMinor + aggregate.movementDebitMinor;
      var cumulativeEndCreditMinor = cumulativeStartCreditMinor + aggregate.movementCreditMinor;
      var openingBalanceMinor = cumulativeStartDebitMinor - cumulativeStartCreditMinor;
      var movementBalanceMinor = aggregate.movementDebitMinor - aggregate.movementCreditMinor;
      var closingBalanceMinor = cumulativeEndDebitMinor - cumulativeEndCreditMinor;
      if (![cumulativeStartDebitMinor, cumulativeStartCreditMinor, cumulativeEndDebitMinor, cumulativeEndCreditMinor, openingBalanceMinor, movementBalanceMinor, closingBalanceMinor].every(Number.isSafeInteger)) {
        totalsOverflow = true;
      }
      return {
        thirdPartyId: aggregate.thirdPartyId,
        thirdPartyCode: aggregate.thirdPartyCode,
        thirdPartyTitle: aggregate.thirdPartyTitle,
        auxiliaryAccountCode: aggregate.auxiliaryAccountCode,
        openingReportKnown: aggregate.openingReportKnown,
        openingReportDebit: aggregate.openingReportKnown ? aggregate.openingReportDebitMinor / factor : null,
        openingReportCredit: aggregate.openingReportKnown ? aggregate.openingReportCreditMinor / factor : null,
        cumulativeStartDebit: cumulativeStartDebitMinor / factor,
        cumulativeStartCredit: cumulativeStartCreditMinor / factor,
        openingBalance: openingBalanceMinor / factor,
        openingBalanceDebit: Math.max(openingBalanceMinor, 0) / factor,
        openingBalanceCredit: Math.max(-openingBalanceMinor, 0) / factor,
        movementDebit: aggregate.movementDebitMinor / factor,
        movementCredit: aggregate.movementCreditMinor / factor,
        movementBalance: movementBalanceMinor / factor,
        movementBalanceDebit: Math.max(movementBalanceMinor, 0) / factor,
        movementBalanceCredit: Math.max(-movementBalanceMinor, 0) / factor,
        cumulativeEndDebit: cumulativeEndDebitMinor / factor,
        cumulativeEndCredit: cumulativeEndCreditMinor / factor,
        closingBalance: closingBalanceMinor / factor,
        closingBalanceDebit: Math.max(closingBalanceMinor, 0) / factor,
        closingBalanceCredit: Math.max(-closingBalanceMinor, 0) / factor,
        sourceMovementCount: aggregate.sourceMovementCount,
        periodMovementCount: aggregate.periodMovementCount
      };
    }).filter(function (row) {
      return row.openingReportKnown || row.sourceMovementCount > 0;
    }).sort(function (left, right) {
      return (left.auxiliaryAccountCode || left.thirdPartyCode).localeCompare(right.auxiliaryAccountCode || right.thirdPartyCode, 'fr', { numeric: true, sensitivity: 'base' });
    });
    if (totalsOverflow) return emptyResult(options, ['Les cumuls de la balance des tiers dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.'], warnings, filter);

    var totalFields = [
      'openingReportDebit', 'openingReportCredit', 'cumulativeStartDebit', 'cumulativeStartCredit',
      'openingBalanceDebit', 'openingBalanceCredit', 'movementDebit', 'movementCredit',
      'movementBalanceDebit', 'movementBalanceCredit', 'cumulativeEndDebit', 'cumulativeEndCredit',
      'closingBalanceDebit', 'closingBalanceCredit'
    ];
    var totals = Object.create(null);
    totalFields.forEach(function (field) { totals[field] = 0; });
    rows.forEach(function (row) {
      totalFields.forEach(function (field) {
        if ((field === 'openingReportDebit' || field === 'openingReportCredit') && !row.openingReportKnown) return;
        totals[field] += Math.round((Number(row[field]) || 0) * factor);
        if (!Number.isSafeInteger(totals[field])) totalsOverflow = true;
      });
    });
    totalFields.forEach(function (field) { totals[field] = totals[field] / factor; });
    if (totalsOverflow) return emptyResult(options, ['Les totaux de la balance des tiers dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.'], warnings, filter);

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      nature: nature,
      natureLabel: natureInfo.label,
      from: from,
      to: to,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      rows: rows,
      tierCount: rows.length,
      sourceMovementCount: sourceMovementCount,
      periodMovementCount: periodMovementCount,
      openingReportLineCount: openingReportLineCount,
      unattributedOpeningBalanceCount: unattributedOpeningBalanceCount,
      unmatchedMovementCount: unmatchedMovementCount,
      totals: totals,
      thirdPartyFilter: filter,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        unlinkedOpeningReportsExcluded: true,
        unattributedCollectiveLinesExcluded: true,
        openingReportDataPresent: openingReportLineCount > 0,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    auxiliaryAccountCode: auxiliaryAccountCode,
    build: build
  };
});
