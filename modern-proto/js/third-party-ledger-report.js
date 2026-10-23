/*
 * PERFECTO · Grand livre des tiers.
 * Restitue les mouvements auxiliaires explicitement liés et les reports
 * d’ouverture identifiés, sans créer ni ventiler d’écritures.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PerfectoThirdPartyLedgerReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var NATURES = [
    { key: 'suppliers', label: 'Fournisseurs' },
    { key: 'clients', label: 'Clients' },
    { key: 'personnel', label: 'Personnel' },
    { key: 'other-parties', label: 'Tiers divers' }
  ];

  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', defaultSelected: true, text: true },
    { key: 'journal', label: 'Journal', defaultSelected: true, text: true },
    { key: 'piece', label: 'Pièce', defaultSelected: true, text: true },
    { key: 'accountCode', label: 'Compte général', defaultSelected: true, text: true },
    { key: 'reference', label: 'Référence', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', defaultSelected: true, text: false },
    { key: 'balance', label: 'Solde', defaultSelected: true, text: false, balance: true },
    { key: 'market', label: 'Marché', defaultSelected: true, text: true },
    { key: 'label', label: 'Libellé', defaultSelected: true, text: true },
    { key: 'counterpart', label: 'Contrepartie', defaultSelected: true, text: true }
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

  function finiteMinor(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return null;
    var scaled = Math.round(amount * factor);
    if (!Number.isSafeInteger(scaled) || Math.abs(amount - scaled / factor) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 4) return null;
    return scaled;
  }

  function natureLabel(nature) {
    var match = NATURES.find(function (item) { return item.key === String(nature || '').toLowerCase(); });
    return match ? match.label : 'Clients';
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
      register(auxiliaryAccountCode(record), descriptor);
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
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      nature: nature,
      natureLabel: natureLabel(nature),
      from: String(options.from || ''),
      to: String(options.to || ''),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      groups: [],
      rows: [],
      tierCount: 0,
      sourceMovementCount: 0,
      periodMovementCount: 0,
      openingReportLineCount: 0,
      unattributedOpeningBalanceCount: 0,
      ambiguousOpeningBalanceCount: 0,
      wrongAccountOpeningBalanceCount: 0,
      unmatchedMovementCount: 0,
      ambiguousMovementCount: 0,
      wrongAccountMovementCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      movementEntryCount: 0,
      totals: { debit: 0, credit: 0, difference: 0 },
      thirdPartyFilter: filter || null,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        explicitThirdPartyReferencesOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        priorCycleMovementsIncludedInRunningBalance: true,
        priorPeriodMovementsIncludedInRunningBalance: true,
        runningBalanceIsDebitMinusCredit: true,
        marketOnlyFromSource: true,
        counterpartFromOtherAccountsInSameEntry: true,
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
    var warningKeys = Object.create(null);
    var accountByCode = Object.create(null);
    var entryById = Object.create(null);
    var entryIdAmbiguities = Object.create(null);

    function addWarning(message) {
      if (!warningKeys[message]) {
        warningKeys[message] = true;
        warnings.push(message);
      }
    }

    function addError(message) {
      if (errors.indexOf(message) === -1) errors.push(message);
    }

    if (!natureInfo) addError('Choisissez une nature de tiers disponible.');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) addError('Le cycle du dossier n’est pas défini correctement.');
    if (!isIsoDate(from) || !isIsoDate(to)) addError('Indiquez des dates valides pour la période.');
    else if (from > to) addError('La date de début doit précéder ou égaler la date de fin.');
    else if (isIsoDate(cycleStart) && isIsoDate(cycleEnd) && (from < cycleStart || to > cycleEnd)) {
      addError('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
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
    var selectedDescriptors = [];
    var descriptorsByObject = new Map();
    var descriptorsByBaseKey = Object.create(null);
    allDescriptors.forEach(function (descriptor) {
      if (descriptor.record && typeof descriptor.record === 'object') descriptorsByObject.set(descriptor.record, descriptor);
      if (!descriptorsByBaseKey[descriptor.baseKey]) descriptorsByBaseKey[descriptor.baseKey] = [];
      descriptorsByBaseKey[descriptor.baseKey].push(descriptor);
    });
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
        var reference = normalizeReference(token);
        var matches = selectedAliases.get(reference) || [];
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

    selectedDescriptors = selectedDescriptors.filter(function (descriptor) {
      return filter.all || !!filter.selectedKeys[descriptor.key];
    });
    var selectedKeys = Object.create(null);
    var selectedAccountCodes = Object.create(null);
    var accountLabelByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (!account || account.code == null) return;
      var code = String(account.code).trim();
      accountByCode[code] = account;
      accountLabelByCode[code] = String(account.label || '');
    });
    selectedDescriptors.forEach(function (descriptor) {
      var record = descriptor.record || {};
      selectedKeys[descriptor.key] = true;
      var code = String(record.code || '').trim();
      var accountCode = String(record.accountCode || '').trim();
      if (!code) addError('Une fiche de la nature « ' + natureInfo.label + ' » n’a pas de code de tiers ; elle ne peut pas être distinguée dans le grand livre.');
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

    var openingDate = dayBefore(cycleStart);
    var openingByKey = Object.create(null);
    selectedDescriptors.forEach(function (descriptor) {
      openingByKey[descriptor.key] = { signedMinor: 0, debitMinor: 0, creditMinor: 0, lineCount: 0 };
    });
    var openingReportLineCount = 0;
    var unattributedOpeningBalanceCount = 0;
    var ambiguousOpeningBalanceCount = 0;
    var wrongAccountOpeningBalanceCount = 0;
    openingBalances.forEach(function (opening) {
      if (!opening || typeof opening !== 'object') return;
      var accountCode = String(opening.accountCode || '').trim();
      var references = [opening.thirdPartyId, opening.thirdPartyCode, opening.auxiliaryCode]
        .map(normalizeReference).filter(Boolean);
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
        var touchesSelection = selectedAccountCodes[accountCode] || resolution.candidates.some(function (candidate) { return !!selectedKeys[candidate.key]; });
        if (touchesSelection) ambiguousOpeningBalanceCount += 1;
        return;
      }
      var descriptor = resolution.descriptor;
      if (!selectedKeys[descriptor.key]) return;
      if (resolution.wrongAccount || accountCode !== String(descriptor.record.accountCode || '').trim()) {
        wrongAccountOpeningBalanceCount += 1;
        return;
      }
      if (String(opening.date || '') !== openingDate) {
        addError('Le report d’ouverture lié au tiers « ' + String(descriptor.record.code || '') + ' » n’est pas daté de la veille du cycle (' + openingDate + ').');
        return;
      }
      var debitMinor = finiteMinor(opening.debit, factor);
      var creditMinor = finiteMinor(opening.credit, factor);
      if (debitMinor === null || creditMinor === null || (debitMinor > 0 && creditMinor > 0) || (debitMinor === 0 && creditMinor === 0)) {
        addError('Le report d’ouverture lié au tiers « ' + String(descriptor.record.code || '') + ' » contient un montant invalide.');
        return;
      }
      var aggregate = openingByKey[descriptor.key];
      aggregate.debitMinor += debitMinor;
      aggregate.creditMinor += creditMinor;
      aggregate.signedMinor += debitMinor - creditMinor;
      aggregate.lineCount += 1;
      if (![aggregate.debitMinor, aggregate.creditMinor, aggregate.signedMinor].every(Number.isSafeInteger)) {
        addError('Le report d’ouverture du tiers « ' + String(descriptor.record.code || '') + ' » dépasse la capacité numérique sûre.');
        return;
      }
      openingReportLineCount += 1;
    });

    var unmatchedMovementCount = 0;
    var ambiguousMovementCount = 0;
    var wrongAccountMovementCount = 0;
    var seenSourceLines = Object.create(null);
    var selectedMovements = [];
    movements.forEach(function (movement, movementIndex) {
      if (!movement || typeof movement !== 'object') return;
      var accountCode = String(movement.account || movement.accountCode || '').trim();
      var auxiliaryReference = normalizeReference(movement.auxiliaryCode || movement.auxiliaryAccountCode || movement.auxiliaryId);
      var resolution = resolveReference(auxiliaryReference, allAliases, accountCode);
      if (resolution.status === 'missing') {
        if (selectedAccountCodes[accountCode]) unmatchedMovementCount += 1;
        return;
      }
      if (resolution.status === 'ambiguous') {
        var movementTouchesSelection = selectedAccountCodes[accountCode] || resolution.candidates.some(function (candidate) { return !!selectedKeys[candidate.key]; });
        if (movementTouchesSelection) ambiguousMovementCount += 1;
        return;
      }
      var descriptor = resolution.descriptor;
      if (!selectedKeys[descriptor.key]) return;
      if (resolution.wrongAccount || accountCode !== String(descriptor.record.accountCode || '').trim()) {
        wrongAccountMovementCount += 1;
        return;
      }
      var date = String(movement.date || '');
      if (!isIsoDate(date)) {
        addError('Un mouvement auxiliaire du tiers « ' + String(descriptor.record.code || '') + ' » porte une date invalide.');
        return;
      }
      if (date < cycleStart || date > cycleEnd || date > to) return;
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
      var lineIndex = lineNumber - 1;
      var lines = Array.isArray(entry.lines) ? entry.lines : [];
      var line = lines[lineIndex];
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
      selectedMovements.push({
        descriptor: descriptor,
        date: date,
        journal: String(entry.journal || entry.journalCode || ''),
        piece: String(line.piece || line.pieceReference || entry.reference || entry.internalNumber || ''),
        accountCode: accountCode,
        reference: String(line.reference || entry.sourceReference || ''),
        market: String(line.market || entry.market || ''),
        label: String(line.description || entry.description || ''),
        counterpart: counterpartForLine(lines, lineIndex, accountCode, accountByCode),
        debitMinor: debitMinor,
        creditMinor: creditMinor,
        sourceEntryId: sourceEntryId,
        lineNumber: lineNumber,
        sourceKey: sourceLineKey
      });
    });

    if (unattributedOpeningBalanceCount) addWarning(unattributedOpeningBalanceCount + ' report(s) sur les comptes auxiliaires sélectionnés n’ont pas de référence de tiers explicite exploitable ; ils ne sont pas affectés.');
    if (ambiguousOpeningBalanceCount) addWarning(ambiguousOpeningBalanceCount + ' report(s) d’ouverture portent des références absentes, contradictoires ou ambiguës ; ils ne sont pas attribués.');
    if (wrongAccountOpeningBalanceCount) addWarning(wrongAccountOpeningBalanceCount + ' report(s) explicitement liés à un tiers portent un compte différent de celui de sa fiche ; ils sont exclus.');
    var selectedWithoutOpeningCount = selectedDescriptors.filter(function (descriptor) {
      return !openingByKey[descriptor.key] || !openingByKey[descriptor.key].lineCount;
    }).length;
    if (!openingReportLineCount) addWarning('Aucun report en début d’exercice n’est explicitement lié aux tiers sélectionnés ; le solde progressif reprend uniquement les montants individualisés disponibles.');
    else if (selectedWithoutOpeningCount) addWarning(selectedWithoutOpeningCount + ' fiche(s) sélectionnée(s) n’ont pas de report d’ouverture explicitement lié ; leur solde initial est partiel.');
    if (unmatchedMovementCount) addWarning(unmatchedMovementCount + ' mouvement(s) sur les comptes des tiers sélectionnés ne portent pas de référence auxiliaire reconnue ; ils ne sont attribués à aucune fiche.');
    if (ambiguousMovementCount) addWarning(ambiguousMovementCount + ' mouvement(s) portent une référence correspondant à plusieurs fiches sur le même compte ; ils sont exclus plutôt que devinés.');
    if (wrongAccountMovementCount) addWarning(wrongAccountMovementCount + ' mouvement(s) liés à une fiche portent un compte différent de celui enregistré sur cette fiche ; ils sont exclus.');
    addWarning('Les champs Référence et Marché sont repris uniquement s’ils sont enregistrés sur la ligne ou la pièce. La contrepartie reprend les autres comptes de la même pièce, sans ventilation de montant.');
    addWarning('Un report d’ouverture n’est repris que s’il comporte un identifiant/code tiers dédié ; le champ libre « Tiers » du registre n’est jamais interprété comme une liaison.');
    if (errors.length) return emptyResult(options, errors, warnings, filter);

    selectedMovements.sort(function (left, right) {
      return left.descriptor.key.localeCompare(right.descriptor.key, 'fr', { numeric: true, sensitivity: 'base' }) ||
        left.date.localeCompare(right.date) ||
        left.piece.localeCompare(right.piece, 'fr', { numeric: true, sensitivity: 'base' }) ||
        left.journal.localeCompare(right.journal, 'fr', { numeric: true, sensitivity: 'base' }) ||
        left.lineNumber - right.lineNumber ||
        left.sourceEntryId.localeCompare(right.sourceEntryId, 'fr', { numeric: true, sensitivity: 'base' });
    });

    var accountGroups = Object.create(null);
    selectedMovements.forEach(function (movement) {
      var key = movement.descriptor.key;
      if (!accountGroups[key]) accountGroups[key] = [];
      accountGroups[key].push(movement);
    });

    var groups = [];
    var flatRows = [];
    var totalDebitMinor = 0;
    var totalCreditMinor = 0;
    var sourceMovementCount = 0;
    var periodMovementCount = 0;
    var movementEntryIds = Object.create(null);
    var overflow = false;
    selectedDescriptors.forEach(function (descriptor) {
      var partyMovements = accountGroups[descriptor.key] || [];
      var opening = openingByKey[descriptor.key] || { signedMinor: 0, debitMinor: 0, creditMinor: 0, lineCount: 0 };
      var runningMinor = opening.signedMinor;
      var periodOpeningMinor = opening.signedMinor;
      var rows = [];
      partyMovements.forEach(function (movement) {
        if (movement.date < from) {
          runningMinor += movement.debitMinor - movement.creditMinor;
          periodOpeningMinor = runningMinor;
          sourceMovementCount += 1;
          if (!Number.isSafeInteger(runningMinor)) overflow = true;
          return;
        }
        runningMinor += movement.debitMinor - movement.creditMinor;
        sourceMovementCount += 1;
        periodMovementCount += 1;
        totalDebitMinor += movement.debitMinor;
        totalCreditMinor += movement.creditMinor;
        if (![runningMinor, totalDebitMinor, totalCreditMinor].every(Number.isSafeInteger)) overflow = true;
        var row = {
          key: movement.sourceKey,
          sourceEntryId: movement.sourceEntryId,
          lineNumber: movement.lineNumber,
          date: movement.date,
          journal: movement.journal,
          piece: movement.piece,
          accountCode: movement.accountCode,
          reference: movement.reference,
          debit: movement.debitMinor / factor,
          credit: movement.creditMinor / factor,
          balance: runningMinor / factor,
          balanceMinor: runningMinor,
          market: movement.market,
          label: movement.label,
          counterpart: movement.counterpart,
          thirdPartyId: String(descriptor.record.id || ''),
          thirdPartyCode: String(descriptor.record.code || ''),
          thirdPartyTitle: String(descriptor.record.name || descriptor.record.label || ''),
          rowType: 'movement'
        };
        rows.push(row);
        flatRows.push(row);
        movementEntryIds[movement.sourceEntryId] = true;
      });
      if (!rows.length) return;
      groups.push({
        key: descriptor.key,
        thirdPartyId: String(descriptor.record.id || ''),
        thirdPartyCode: String(descriptor.record.code || ''),
        thirdPartyTitle: String(descriptor.record.name || descriptor.record.label || ''),
        thirdPartyType: String(descriptor.record.type || ''),
        auxiliaryAccountCode: auxiliaryAccountCode(descriptor.record),
        accountCode: String(descriptor.record.accountCode || ''),
        accountLabel: String(accountLabelByCode[String(descriptor.record.accountCode || '').trim()] || ''),
        openingReportLineCount: opening.lineCount,
        openingReportKnown: opening.lineCount > 0,
        openingReportBalance: opening.signedMinor / factor,
        openingBalance: periodOpeningMinor / factor,
        closingBalance: runningMinor / factor,
        lineCount: rows.length,
        rows: rows
      });
    });
    if (overflow) {
      return emptyResult(options, ['Les soldes progressifs ou les totaux du grand livre des tiers dépassent la capacité numérique sûre ; aucun montant approximatif n’est affiché.'], warnings, filter);
    }

    groups.sort(function (left, right) {
      return (left.auxiliaryAccountCode || left.thirdPartyCode).localeCompare(right.auxiliaryAccountCode || right.thirdPartyCode, 'fr', { numeric: true, sensitivity: 'base' }) ||
        left.thirdPartyCode.localeCompare(right.thirdPartyCode, 'fr', { numeric: true, sensitivity: 'base' });
    });
    flatRows = [];
    groups.forEach(function (group) { Array.prototype.push.apply(flatRows, group.rows); });

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
      groups: groups,
      rows: flatRows,
      tierCount: groups.length,
      sourceMovementCount: sourceMovementCount,
      periodMovementCount: periodMovementCount,
      openingReportLineCount: openingReportLineCount,
      unattributedOpeningBalanceCount: unattributedOpeningBalanceCount,
      ambiguousOpeningBalanceCount: ambiguousOpeningBalanceCount,
      wrongAccountOpeningBalanceCount: wrongAccountOpeningBalanceCount,
      unmatchedMovementCount: unmatchedMovementCount,
      ambiguousMovementCount: ambiguousMovementCount,
      wrongAccountMovementCount: wrongAccountMovementCount,
      lineCount: periodMovementCount,
      generatedLineCount: periodMovementCount,
      movementEntryCount: Object.keys(movementEntryIds).length,
      totals: {
        debit: totalDebitMinor / factor,
        credit: totalCreditMinor / factor,
        difference: (totalDebitMinor - totalCreditMinor) / factor
      },
      thirdPartyFilter: filter,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        explicitThirdPartyReferencesOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        priorCycleMovementsIncludedInRunningBalance: true,
        priorPeriodMovementsIncludedInRunningBalance: true,
        runningBalanceIsDebitMinusCredit: true,
        marketOnlyFromSource: true,
        counterpartFromOtherAccountsInSameEntry: true,
        noAccountingMutation: true
      }
    };
  }

  function counterpartForLine(lines, lineIndex, accountCode, accountByCode) {
    var codes = [];
    lines.forEach(function (line, index) {
      if (!line || index === lineIndex) return;
      var code = String(line.account || line.accountCode || '').trim();
      if (!code || code === accountCode || codes.indexOf(code) !== -1) return;
      codes.push(code);
    });
    codes.sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); });
    return codes.map(function (code) {
      var account = accountByCode[code];
      return code + (account && account.label ? ' — ' + String(account.label) : '');
    }).join(' · ');
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    auxiliaryAccountCode: auxiliaryAccountCode,
    build: build
  };
});
