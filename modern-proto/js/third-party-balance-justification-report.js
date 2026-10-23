/*
 * PERFECTO · Justification de solde des tiers.
 * Restitue les reports explicitement rattachés et les mouvements validés du cycle
 * jusqu'à la date d'arrêté. Aucune somme de solde, aucun rapprochement et aucune
 * écriture nouvelle ne sont calculés ou créés.
 */
(function (root, factory) {
  'use strict';
  var ledgerReport = root.PerfectoThirdPartyLedgerReport;
  if (!ledgerReport && typeof module !== 'undefined' && module.exports) {
    ledgerReport = require('./third-party-ledger-report.js');
  }
  var api = factory(ledgerReport);
  root.PerfectoThirdPartyBalanceJustificationReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ThirdPartyLedgerReport) {
  'use strict';

  var NATURES = ThirdPartyLedgerReport ? ThirdPartyLedgerReport.NATURES : [];
  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', defaultSelected: true, text: true },
    { key: 'accountCode', label: 'Compte général', defaultSelected: true, text: true },
    { key: 'reference', label: 'Référence', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', defaultSelected: true, text: false },
    { key: 'label', label: 'Libellé', defaultSelected: false, text: true }
  ];

  function normalizeReference(value) {
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

  function finiteMinor(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    if (!Number.isSafeInteger(scaled) || Math.abs(amount - scaled / factor) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 4) return null;
    return scaled;
  }

  function recordNature(record, fallbackNature) {
    return String(record && (record._thirdPartyNature || record.thirdPartyNature) || fallbackNature || '').toLowerCase();
  }

  function recordBaseKey(record, fallbackNature) {
    var nature = recordNature(record, fallbackNature);
    var id = normalizeReference(record && record.id);
    var identity = id ? 'id:' + id : 'code:' + normalizeReference(record && record.code) + '|account:' + String(record && record.accountCode || '').trim();
    return nature + '|' + identity;
  }

  function makeDescriptors(records, fallbackNature) {
    var occurrences = Object.create(null);
    return records.map(function (record, index) {
      var baseKey = recordBaseKey(record, fallbackNature);
      var occurrence = occurrences[baseKey] || 0;
      occurrences[baseKey] = occurrence + 1;
      return {
        record: record,
        index: index,
        baseKey: baseKey,
        key: occurrence ? baseKey + '#duplicate-' + index : baseKey,
        nature: recordNature(record, fallbackNature)
      };
    });
  }

  function createAliasIndex(descriptors) {
    var index = new Map();
    function register(reference, descriptor) {
      var normalized = normalizeReference(reference);
      if (!normalized) return;
      var candidates = index.get(normalized) || [];
      if (!candidates.some(function (candidate) { return candidate.key === descriptor.key; })) candidates.push(descriptor);
      index.set(normalized, candidates);
    }
    descriptors.forEach(function (descriptor) {
      var record = descriptor.record || {};
      register(record.id, descriptor);
      register(record.code, descriptor);
      register(ThirdPartyLedgerReport.auxiliaryAccountCode(record), descriptor);
    });
    return index;
  }

  function resolveReference(reference, aliases, accountCode) {
    var normalized = normalizeReference(reference);
    if (!normalized || !aliases.has(normalized)) return { status: 'missing', candidates: [] };
    var candidates = aliases.get(normalized) || [];
    var matchingAccount = String(accountCode || '').trim();
    var accountMatches = matchingAccount
      ? candidates.filter(function (candidate) { return String(candidate.record.accountCode || '').trim() === matchingAccount; })
      : [];
    if (accountMatches.length === 1) return { status: 'matched', descriptor: accountMatches[0], candidates: candidates };
    if (accountMatches.length > 1) return { status: 'ambiguous', candidates: candidates };
    if (candidates.length === 1) {
      return {
        status: 'matched',
        descriptor: candidates[0],
        candidates: candidates,
        wrongAccount: !!matchingAccount && String(candidates[0].record.accountCode || '').trim() !== matchingAccount
      };
    }
    return { status: 'ambiguous', candidates: candidates };
  }

  function resolveExplicitReferences(references, aliases, accountCode) {
    var matches = [];
    var unresolved = false;
    var ambiguous = false;
    var wrongAccount = false;
    references.forEach(function (reference) {
      var result = resolveReference(reference, aliases, accountCode);
      if (result.status === 'missing') {
        unresolved = true;
        return;
      }
      if (result.status === 'ambiguous') {
        ambiguous = true;
        return;
      }
      if (result.wrongAccount) wrongAccount = true;
      if (!matches.some(function (candidate) { return candidate.key === result.descriptor.key; })) matches.push(result.descriptor);
    });
    if (matches.length > 1) ambiguous = true;
    if (ambiguous || unresolved) return { status: 'ambiguous', candidates: matches, wrongAccount: wrongAccount };
    if (!matches.length) return { status: 'missing', candidates: [] };
    return { status: 'matched', descriptor: matches[0], candidates: matches, wrongAccount: wrongAccount };
  }

  function emptyResult(options, errors, warnings, filter) {
    options = options || {};
    var nature = String(options.nature || 'clients').toLowerCase();
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      nature: nature,
      natureLabel: natureInfo ? natureInfo.label : 'Clients',
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      asOfDate: String(options.asOfDate || ''),
      commentLeft: String(options.commentLeft || ''),
      commentRight: String(options.commentRight || ''),
      groups: [],
      rows: [],
      tierCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      movementLineCount: 0,
      openingLineCount: 0,
      thirdPartyFilter: filter || null,
      basis: {
        cutoffDateInclusive: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        freeTextTierFieldNeverUsed: true,
        postedAuxiliaryMovementsOnly: true,
        currentCycleMovementsOnly: true,
        linkedOpeningReportsIncludedAsSourceRows: true,
        noRunningOrNetBalanceCalculated: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var nature = String(options.nature || 'clients').toLowerCase();
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    var records = Array.isArray(options.thirdPartyRecords) ? options.thirdPartyRecords.filter(Boolean) : [];
    var allRecords = Array.isArray(options.allThirdPartyRecords) ? options.allThirdPartyRecords.filter(Boolean).slice() : records.slice();
    var movements = Array.isArray(options.thirdPartyMovements) ? options.thirdPartyMovements : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var sourceErrors = Array.isArray(options.sourceErrors) ? options.sourceErrors.map(String) : [];
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var asOfDate = String(options.asOfDate || '');
    var filterExpression = options.thirdPartyFilter == null ? '*' : String(options.thirdPartyFilter);
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var factor = Math.pow(10, decimalPlaces);
    var errors = [];
    var accountByCode = Object.create(null);
    var accountLabelByCode = Object.create(null);
    var entryById = Object.create(null);
    var entryIdAmbiguities = Object.create(null);
    var warningKeys = Object.create(null);

    warnings.forEach(function (message) { warningKeys[message] = true; });
    function addWarning(message) {
      if (!warningKeys[message]) {
        warningKeys[message] = true;
        warnings.push(message);
      }
    }
    function addError(message) {
      if (errors.indexOf(message) === -1) errors.push(message);
    }

    if (!ThirdPartyLedgerReport) addError('Le référentiel des tiers nécessaire à la justification n’est pas disponible.');
    if (!natureInfo) addError('Choisissez une nature de tiers disponible.');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) addError('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(asOfDate)) addError('Indiquez une date d’arrêté valide.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (asOfDate < cycleStart || asOfDate > cycleEnd)) {
      addError('La date d’arrêté doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (sourceErrors.length) errors.push.apply(errors, sourceErrors);
    if (errors.length) return emptyResult(options, errors, warnings, null);

    records.forEach(function (record) {
      var found = allRecords.some(function (candidate) {
        return candidate === record || recordBaseKey(candidate, nature) === recordBaseKey(record, nature);
      });
      if (!found) allRecords.push(record);
    });

    var allDescriptors = makeDescriptors(allRecords, nature);
    var descriptorsByObject = new Map();
    var descriptorsByBaseKey = Object.create(null);
    allDescriptors.forEach(function (descriptor) {
      if (descriptor.record && typeof descriptor.record === 'object') descriptorsByObject.set(descriptor.record, descriptor);
      if (!descriptorsByBaseKey[descriptor.baseKey]) descriptorsByBaseKey[descriptor.baseKey] = [];
      descriptorsByBaseKey[descriptor.baseKey].push(descriptor);
    });
    var selectedDescriptors = [];
    records.forEach(function (record) {
      var descriptor = descriptorsByObject.get(record);
      if (!descriptor) {
        var candidates = descriptorsByBaseKey[recordBaseKey(record, nature)] || [];
        if (candidates.length === 1) descriptor = candidates[0];
      }
      if (descriptor && descriptor.nature === nature && !selectedDescriptors.some(function (item) { return item.key === descriptor.key; })) {
        selectedDescriptors.push(descriptor);
      }
    });
    var selectedAliases = createAliasIndex(selectedDescriptors);
    var allAliases = createAliasIndex(allDescriptors);
    var tokens = filterExpression.trim().split(/[\s,;]+/).filter(Boolean);
    var filter = { valid: tokens.length > 0, all: tokens.indexOf('*') !== -1, selectedKeys: Object.create(null), codes: [], error: '' };
    if (!tokens.length) {
      filter.error = 'Indiquez un code de tiers ou * pour sélectionner tous les tiers.';
    } else if (!filter.all) {
      var invalidTokens = [];
      tokens.forEach(function (token) {
        var matches = selectedAliases.get(normalizeReference(token)) || [];
        if (matches.length !== 1) {
          invalidTokens.push(token + (matches.length > 1 ? ' (référence ambiguë)' : ''));
          return;
        }
        var descriptor = matches[0];
        filter.selectedKeys[descriptor.key] = true;
        if (filter.codes.indexOf(String(descriptor.record.code || '')) === -1) filter.codes.push(String(descriptor.record.code || ''));
      });
      if (invalidTokens.length) {
        filter.valid = false;
        filter.error = 'Tiers introuvable(s) ou ambigu(s) : ' + invalidTokens.join(', ') + '.';
      }
    }
    if (!filter.valid) return emptyResult(options, [filter.error], warnings, filter);
    selectedDescriptors = selectedDescriptors.filter(function (descriptor) { return filter.all || !!filter.selectedKeys[descriptor.key]; });

    accounts.forEach(function (account) {
      if (!account || account.code == null) return;
      var code = String(account.code).trim();
      accountByCode[code] = account;
      accountLabelByCode[code] = String(account.label || '');
    });
    var selectedKeys = Object.create(null);
    var selectedAccountCodes = Object.create(null);
    selectedDescriptors.forEach(function (descriptor) {
      var record = descriptor.record || {};
      selectedKeys[descriptor.key] = true;
      var code = String(record.code || '').trim();
      var accountCode = String(record.accountCode || '').trim();
      if (!code) addError('Une fiche de la nature « ' + natureInfo.label + ' » n’a pas de code de tiers ; elle ne peut pas être distinguée dans la justification.');
      if (!accountCode) addError('La fiche « ' + (code || record.name || record.id || '—') + ' » ne porte pas de compte collectif auxiliaire.');
      else if (!accountByCode[accountCode]) addError('Le compte « ' + accountCode + ' » de la fiche « ' + (code || '—') + ' » est absent du plan comptable visible.');
      else if (accountByCode[accountCode].aux !== true) addError('Le compte « ' + accountCode + ' » de la fiche « ' + (code || '—') + ' » n’est pas marqué comme auxiliaire.');
      if (accountCode) selectedAccountCodes[accountCode] = true;
    });
    if (errors.length) return emptyResult(options, errors, warnings, filter);

    entries.forEach(function (entry) {
      if (!entry || !String(entry.id || '').trim()) return;
      var id = String(entry.id);
      if (Object.prototype.hasOwnProperty.call(entryById, id)) {
        entryIdAmbiguities[id] = true;
        entryById[id] = null;
      } else if (!entryIdAmbiguities[id]) entryById[id] = entry;
    });

    var expectedOpeningDate = dayBefore(cycleStart);
    var openingRowsByGroup = Object.create(null);
    var openingReportLineCount = 0;
    var unattributedOpeningBalanceCount = 0;
    var ambiguousOpeningBalanceCount = 0;
    var wrongAccountOpeningBalanceCount = 0;
    openingBalances.forEach(function (opening) {
      if (!opening || typeof opening !== 'object') return;
      var accountCode = String(opening.accountCode || '').trim();
      var references = [opening.thirdPartyId, opening.thirdPartyCode, opening.auxiliaryCode].map(normalizeReference).filter(Boolean);
      if (!references.length) {
        if (selectedAccountCodes[accountCode]) unattributedOpeningBalanceCount += 1;
        return;
      }
      var resolution = resolveExplicitReferences(references, allAliases, accountCode);
      if (resolution.status === 'missing') {
        if (selectedAccountCodes[accountCode]) unattributedOpeningBalanceCount += 1;
        return;
      }
      if (resolution.status === 'ambiguous') {
        var touchesSelection = !!selectedAccountCodes[accountCode] || resolution.candidates.some(function (candidate) { return !!selectedKeys[candidate.key]; });
        if (touchesSelection) ambiguousOpeningBalanceCount += 1;
        return;
      }
      var descriptor = resolution.descriptor;
      if (!selectedKeys[descriptor.key]) return;
      if (resolution.wrongAccount || accountCode !== String(descriptor.record.accountCode || '').trim()) {
        wrongAccountOpeningBalanceCount += 1;
        return;
      }
      if (String(opening.date || '') !== expectedOpeningDate) {
        addError('Le report d’ouverture lié au tiers « ' + String(descriptor.record.code || '') + ' » n’est pas daté de la veille du cycle (' + expectedOpeningDate + ').');
        return;
      }
      var debitMinor = finiteMinor(opening.debit, factor);
      var creditMinor = finiteMinor(opening.credit, factor);
      if (debitMinor === null || creditMinor === null || (debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
        addError('Le report d’ouverture lié au tiers « ' + String(descriptor.record.code || '') + ' » contient un montant invalide.');
        return;
      }
      if (!openingRowsByGroup[descriptor.key]) openingRowsByGroup[descriptor.key] = [];
      openingRowsByGroup[descriptor.key].push({
        key: 'opening:' + String(opening.id || descriptor.key + ':' + openingRowsByGroup[descriptor.key].length),
        rowType: 'opening-balance',
        date: String(opening.date),
        accountCode: accountCode,
        reference: String(opening.reference || ''),
        debit: debitMinor / factor,
        credit: creditMinor / factor,
        label: String(opening.label || ''),
        thirdPartyId: String(descriptor.record.id || ''),
        thirdPartyCode: String(descriptor.record.code || ''),
        thirdPartyTitle: String(descriptor.record.name || descriptor.record.label || '')
      });
      openingReportLineCount += 1;
    });

    var unmatchedMovementCount = 0;
    var ambiguousMovementCount = 0;
    var wrongAccountMovementCount = 0;
    var seenSourceLines = Object.create(null);
    var movementRowsByGroup = Object.create(null);
    movements.forEach(function (movement) {
      if (!movement || typeof movement !== 'object') return;
      var accountCode = String(movement.account || movement.accountCode || '').trim();
      var date = String(movement.date || '');
      var auxiliaryReference = normalizeReference(movement.auxiliaryCode || movement.auxiliaryAccountCode || movement.auxiliaryId);
      if (!isIsoDate(date)) {
        var invalidDateResolution = resolveReference(auxiliaryReference, allAliases, accountCode);
        var invalidDateTouchesSelection = !!selectedAccountCodes[accountCode] ||
          (invalidDateResolution.status === 'matched' && !!selectedKeys[invalidDateResolution.descriptor.key]) ||
          (invalidDateResolution.status === 'ambiguous' && invalidDateResolution.candidates.some(function (candidate) { return !!selectedKeys[candidate.key]; }));
        if (invalidDateTouchesSelection) addError('Un mouvement auxiliaire porte une date invalide pour les tiers sélectionnés.');
        return;
      }
      if (date < cycleStart || date > cycleEnd || date > asOfDate) return;
      var resolution = resolveReference(auxiliaryReference, allAliases, accountCode);
      if (resolution.status === 'missing') {
        if (selectedAccountCodes[accountCode]) unmatchedMovementCount += 1;
        return;
      }
      if (resolution.status === 'ambiguous') {
        var movementTouchesSelection = !!selectedAccountCodes[accountCode] || resolution.candidates.some(function (candidate) { return !!selectedKeys[candidate.key]; });
        if (movementTouchesSelection) ambiguousMovementCount += 1;
        return;
      }
      var descriptor = resolution.descriptor;
      if (!selectedKeys[descriptor.key]) return;
      if (resolution.wrongAccount || accountCode !== String(descriptor.record.accountCode || '').trim()) {
        wrongAccountMovementCount += 1;
        return;
      }
      var debitMinor = finiteMinor(movement.debit, factor);
      var creditMinor = finiteMinor(movement.credit, factor);
      if (debitMinor === null || creditMinor === null || (debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
        addError('Un mouvement auxiliaire du tiers « ' + String(descriptor.record.code || '') + ' » contient un montant invalide.');
        return;
      }
      var sourceEntryId = String(movement.sourceEntryId || '').trim();
      var lineNumber = Number(movement.lineNumber);
      if (!sourceEntryId || !Number.isInteger(lineNumber) || lineNumber < 1) {
        addError('Un mouvement auxiliaire du tiers « ' + String(descriptor.record.code || '') + ' » n’a pas de référence traçable vers sa pièce et sa ligne source.');
        return;
      }
      var sourceLineKey = sourceEntryId + ':' + lineNumber;
      if (seenSourceLines[sourceLineKey]) return;
      seenSourceLines[sourceLineKey] = true;
      if (entryIdAmbiguities[sourceEntryId] || !entryById[sourceEntryId]) {
        addError('Le mouvement auxiliaire « ' + sourceLineKey + ' » ne peut pas être retrouvé de façon univoque dans les écritures visibles du dossier.');
        return;
      }
      var entry = entryById[sourceEntryId];
      var line = (Array.isArray(entry.lines) ? entry.lines : [])[lineNumber - 1];
      if (!line || entry.status !== 'posted' || String(entry.date || '') !== date) {
        addError('La ligne source « ' + sourceLineKey + ' » ne correspond pas à une écriture validée à la date extraite.');
        return;
      }
      var lineAccountCode = String(line.account || line.accountCode || '').trim();
      var sourceDebitMinor = finiteMinor(line.debit, factor);
      var sourceCreditMinor = finiteMinor(line.credit, factor);
      if (lineAccountCode !== accountCode || sourceDebitMinor !== debitMinor || sourceCreditMinor !== creditMinor) {
        addError('La ligne source « ' + sourceLineKey + ' » ne correspond pas aux données du mouvement auxiliaire extrait.');
        return;
      }
      if (!movementRowsByGroup[descriptor.key]) movementRowsByGroup[descriptor.key] = [];
      movementRowsByGroup[descriptor.key].push({
        key: sourceLineKey,
        rowType: 'movement',
        sourceEntryId: sourceEntryId,
        lineNumber: lineNumber,
        date: date,
        accountCode: accountCode,
        reference: String(line.reference || entry.sourceReference || line.piece || line.pieceReference || entry.reference || entry.internalNumber || ''),
        debit: debitMinor / factor,
        credit: creditMinor / factor,
        label: String(line.description || entry.description || ''),
        thirdPartyId: String(descriptor.record.id || ''),
        thirdPartyCode: String(descriptor.record.code || ''),
        thirdPartyTitle: String(descriptor.record.name || descriptor.record.label || '')
      });
    });

    if (unattributedOpeningBalanceCount) addWarning(unattributedOpeningBalanceCount + ' report(s) d’ouverture sur les comptes des tiers sélectionnés n’ont pas de référence auxiliaire explicite exploitable ; ils sont exclus.');
    if (ambiguousOpeningBalanceCount) addWarning(ambiguousOpeningBalanceCount + ' report(s) d’ouverture portent des références absentes, contradictoires ou ambiguës ; ils sont exclus.');
    if (wrongAccountOpeningBalanceCount) addWarning(wrongAccountOpeningBalanceCount + ' report(s) d’ouverture liés à une fiche portent un compte différent de celui enregistré ; ils sont exclus.');
    if (!openingReportLineCount) addWarning('Aucun report d’ouverture explicitement lié aux tiers sélectionnés n’est inclus ; les mouvements affichés commencent au cycle actif.');
    else {
      var selectedWithoutOpeningCount = selectedDescriptors.filter(function (descriptor) {
        return !(openingRowsByGroup[descriptor.key] || []).length;
      }).length;
      if (selectedWithoutOpeningCount) addWarning(selectedWithoutOpeningCount + ' fiche(s) sélectionnée(s) n’ont pas de report d’ouverture explicitement lié ; aucun montant initial n’est reconstitué.');
    }
    if (unmatchedMovementCount) addWarning(unmatchedMovementCount + ' mouvement(s) sur les comptes des tiers sélectionnés ne portent pas de référence auxiliaire reconnue ; ils ne sont attribués à aucune fiche.');
    if (ambiguousMovementCount) addWarning(ambiguousMovementCount + ' mouvement(s) portent une référence correspondant à plusieurs fiches sur le même compte ; ils sont exclus plutôt que devinés.');
    if (wrongAccountMovementCount) addWarning(wrongAccountMovementCount + ' mouvement(s) liés à une fiche portent un compte différent de celui enregistré sur cette fiche ; ils sont exclus.');
    addWarning('Les reports d’ouverture et mouvements sont attribués uniquement par identifiant/code tiers explicite et non ambigu ; le champ libre « Tiers » du registre n’est jamais utilisé.');
    if (errors.length) return emptyResult(options, errors, warnings, filter);

    selectedDescriptors.sort(function (left, right) {
      var leftCode = ThirdPartyLedgerReport.auxiliaryAccountCode(left.record) || String(left.record.code || '');
      var rightCode = ThirdPartyLedgerReport.auxiliaryAccountCode(right.record) || String(right.record.code || '');
      return leftCode.localeCompare(rightCode, 'fr', { numeric: true, sensitivity: 'base' }) ||
        String(left.record.code || '').localeCompare(String(right.record.code || ''), 'fr', { numeric: true, sensitivity: 'base' });
    });
    var groups = [];
    selectedDescriptors.forEach(function (descriptor) {
      var openingRows = openingRowsByGroup[descriptor.key] || [];
      var movementRows = movementRowsByGroup[descriptor.key] || [];
      var rows = openingRows.concat(movementRows);
      rows.sort(function (left, right) {
        return String(left.date).localeCompare(String(right.date)) ||
          (left.rowType === right.rowType ? 0 : (left.rowType === 'opening-balance' ? -1 : 1)) ||
          String(left.reference || '').localeCompare(String(right.reference || ''), 'fr', { numeric: true, sensitivity: 'base' });
      });
      if (!rows.length) return;
      var record = descriptor.record || {};
      groups.push({
        key: descriptor.key,
        thirdPartyId: String(record.id || ''),
        thirdPartyCode: String(record.code || ''),
        thirdPartyTitle: String(record.name || record.label || ''),
        thirdPartyType: String(record.type || ''),
        auxiliaryAccountCode: ThirdPartyLedgerReport.auxiliaryAccountCode(record),
        accountCode: String(record.accountCode || ''),
        accountLabel: String(accountLabelByCode[String(record.accountCode || '').trim()] || ''),
        lineCount: rows.length,
        openingLineCount: openingRows.length,
        movementLineCount: movementRows.length,
        rows: rows
      });
    });
    var rows = [];
    groups.forEach(function (group) { Array.prototype.push.apply(rows, group.rows); });
    var openingLineCount = rows.filter(function (row) { return row.rowType === 'opening-balance'; }).length;
    var movementLineCount = rows.filter(function (row) { return row.rowType === 'movement'; }).length;

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      nature: nature,
      natureLabel: natureInfo.label,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      asOfDate: asOfDate,
      commentLeft: String(options.commentLeft || ''),
      commentRight: String(options.commentRight || ''),
      groups: groups,
      rows: rows,
      tierCount: groups.length,
      lineCount: rows.length,
      generatedLineCount: rows.length,
      movementLineCount: movementLineCount,
      openingLineCount: openingLineCount,
      thirdPartyFilter: filter,
      basis: {
        cutoffDateInclusive: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        freeTextTierFieldNeverUsed: true,
        postedAuxiliaryMovementsOnly: true,
        currentCycleMovementsOnly: true,
        linkedOpeningReportsIncludedAsSourceRows: true,
        noRunningOrNetBalanceCalculated: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
