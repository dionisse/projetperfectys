/*
 * PERFECTO · États du lettrage.
 * Lecture seule : lignes validées et registre explicite des lettrages du dossier.
 * Les anomalies sont limitées aux invariants déjà imposés lors d’un lettrage manuel.
 */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoMatchingEditionReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var DEFINITIONS = {
    'edition-matched-entries': {
      id: 'edition-matched-entries', kind: 'matched', title: 'Écritures lettrées',
      filters: ['accounts', 'from', 'to'], columnStacks: 2,
      columns: [
        { key: 'letteringDate', label: 'Date lettrage', text: true },
        { key: 'journal', label: 'Journal', text: true },
        { key: 'entryDate', label: 'Date écriture', text: true },
        { key: 'piece', label: 'N° pièce', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-unmatched-entries': {
      id: 'edition-unmatched-entries', kind: 'unmatched', title: 'Écritures non lettrées',
      filters: ['accounts', 'from', 'to'], columnStacks: 4,
      fromLabel: 'Écritures à partir du', toLabel: 'Écritures non lettrées au',
      columns: [
        { key: 'journal', label: 'Journal', text: true },
        { key: 'date', label: 'Date', text: true },
        { key: 'piece', label: 'Pièce', text: true },
        { key: 'reference', label: 'Référence', text: true },
        { key: 'debit', label: 'Débit', text: false },
        { key: 'credit', label: 'Crédit', text: false },
        { key: 'label', label: 'Libellé', text: true }
      ]
    },
    'edition-matching-anomalies': {
      id: 'edition-matching-anomalies', kind: 'anomalies', title: 'Anomalies sur les lettrages',
      filters: ['accounts'], columnStacks: 3,
      columns: [
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'debit', label: 'Débits', text: false },
        { key: 'credit', label: 'Crédits', text: false },
        { key: 'anomaly', label: 'Anomalie', text: true }
      ]
    }
  };

  function cloneDefinition(definition) {
    if (!definition) return null;
    return Object.assign({}, definition, {
      filters: definition.filters.slice(),
      columns: definition.columns.map(function (column) {
        return Object.assign({ defaultSelected: true }, column);
      })
    });
  }

  function definitionFor(reportId) {
    return cloneDefinition(DEFINITIONS[String(reportId || '')]);
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

  function baseResult(reportId, definition, options, errors, warnings, accountFilter, from, to) {
    return {
      ok: !errors.length,
      reportId: reportId,
      kind: definition ? definition.kind : '',
      title: definition ? definition.title : '',
      errors: errors.slice(),
      warnings: warnings.slice(),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      from: from || '',
      to: to || '',
      accountFilter: accountFilter || null,
      rows: [],
      dataAvailable: false,
      generatedLineCount: 0,
      matchingGroupCount: 0,
      basis: {
        explicitMatchingRegisterOnly: true,
        postedEntriesOnlyForEntryStates: true,
        anomalyChecksUseExistingLettrageRules: true,
        allAccountCodesAllowed: true,
        noAccountingMutation: true
      }
    };
  }

  function matchingGroupDate(group) {
    if (!group) return '';
    var value = String(group.letteringDate || group.date || group.createdAt || '').slice(0, 10);
    return isIsoDate(value) ? value : '';
  }

  function rowFromEntry(entry, line, lineIndex, accountLabel, matchingGroup) {
    var lineReference = String(line.reference || line.sourceReference || entry.sourceReference || '');
    var piece = line.piece || line.pieceReference || entry.reference || entry.internalNumber || '';
    return {
      lineKey: String(entry.id || '') + ':' + lineIndex,
      accountCode: String(line.account == null ? line.accountCode || '' : line.account),
      accountLabel: accountLabel || '',
      letteringDate: matchingGroupDate(matchingGroup),
      matchingCode: matchingGroup ? String(matchingGroup.code || '') : '',
      journal: String(entry.journal || entry.journalCode || ''),
      entryDate: String(entry.date || ''),
      date: String(entry.date || ''),
      piece: String(piece),
      reference: lineReference,
      debit: Number(line.debit) || 0,
      credit: Number(line.credit) || 0,
      label: String(line.description || entry.description || '')
    };
  }

  function parseLineKey(value) {
    var key = String(value || '');
    var separator = key.lastIndexOf(':');
    if (separator <= 0) return null;
    var index = Number(key.slice(separator + 1));
    if (!Number.isInteger(index) || index < 0) return null;
    return { entryId: key.slice(0, separator), lineIndex: index, lineKey: key };
  }

  function amountIsFiniteNonnegative(value) {
    var number = Number(value);
    return Number.isFinite(number) && number >= 0;
  }

  function anomaliesForGroup(group, context) {
    var problems = [];
    var code = String(group && group.accountCode || '');
    var account = context.accountsByCode[code] || null;
    var keys = Array.isArray(group && group.lineKeys) ? group.lineKeys.map(String) : [];
    var actualDebit = 0;
    var actualCredit = 0;
    var completeSource = keys.length > 0;

    if (!account) problems.push('Le compte n’existe plus dans le plan comptable.');
    else if (Number(account.cls) !== 4 || account.aux !== true) problems.push('Le compte n’est plus un compte auxiliaire de classe 4.');
    else {
      if (account.active === false) problems.push('Le compte du lettrage est inactif.');
      if (account.postable === false) problems.push('Le compte du lettrage n’est plus imputable.');
    }
    if (keys.length < 2) problems.push('Le lettrage ne contient pas au moins deux lignes.');

    keys.forEach(function (key) {
      if ((context.lineUseCount[key] || 0) > 1) problems.push('Une ligne est rattachée à plusieurs lettrages actifs.');
      var parsed = parseLineKey(key);
      if (!parsed) {
        completeSource = false;
        problems.push('Une référence de ligne du registre est invalide.');
        return;
      }
      var entry = context.entriesById[parsed.entryId];
      if (!entry) {
        completeSource = false;
        problems.push('Une ligne source est absente des écritures du dossier.');
        return;
      }
      if (entry.status !== 'posted') {
        completeSource = false;
        problems.push('Une ligne source n’est pas validée.');
        return;
      }
      if (!isIsoDate(entry.date) || entry.date < context.cycleStart || entry.date > context.cycleEnd) {
        completeSource = false;
        problems.push('Une ligne source est hors du cycle du dossier.');
        return;
      }
      var line = Array.isArray(entry.lines) ? entry.lines[parsed.lineIndex] : null;
      if (!line) {
        completeSource = false;
        problems.push('Une ligne comptable référencée est introuvable.');
        return;
      }
      var lineAccount = String(line.account == null ? line.accountCode || '' : line.account);
      if (lineAccount !== code) {
        completeSource = false;
        problems.push('Le compte d’une ligne source diffère du compte du lettrage.');
        return;
      }
      if (!amountIsFiniteNonnegative(line.debit) || !amountIsFiniteNonnegative(line.credit)) {
        completeSource = false;
        problems.push('Un montant source est invalide.');
        return;
      }
      actualDebit += Number(line.debit) || 0;
      actualCredit += Number(line.credit) || 0;
    });

    var storedDebit = Number(group && group.debit);
    var storedCredit = Number(group && group.credit);
    var storedTotalsValid = Number.isFinite(storedDebit) && storedDebit >= 0 && Number.isFinite(storedCredit) && storedCredit >= 0;
    if (!storedTotalsValid) problems.push('Les totaux enregistrés du lettrage sont invalides.');
    else if (storedDebit <= 0 || storedDebit !== storedCredit) problems.push('Les totaux débit et crédit enregistrés ne sont pas équilibrés.');
    if (completeSource && storedTotalsValid && (actualDebit !== storedDebit || actualCredit !== storedCredit)) {
      problems.push('Les totaux enregistrés diffèrent des lignes sources.');
    }
    if (completeSource && (actualDebit <= 0 || actualDebit !== actualCredit)) {
      problems.push('Les lignes sources ne respectent pas l’équilibre exact du lettrage.');
    }

    return problems.filter(function (problem, index, list) { return list.indexOf(problem) === index; });
  }

  function buildAnomalyRows(options, accountFilter, accountsByCode, entriesById, matchingGroups, cycleStart, cycleEnd) {
    var activeGroups = (Array.isArray(matchingGroups) ? matchingGroups : []).filter(function (group) {
      return group && group.status !== 'cancelled' && GeneralBalanceReport.accountMatches(group.accountCode, accountFilter);
    });
    var lineUseCount = Object.create(null);
    activeGroups.forEach(function (group) {
      (Array.isArray(group.lineKeys) ? group.lineKeys : []).forEach(function (key) {
        var normalized = String(key || '');
        lineUseCount[normalized] = (lineUseCount[normalized] || 0) + 1;
      });
    });
    var context = {
      accountsByCode: accountsByCode,
      entriesById: entriesById,
      lineUseCount: lineUseCount,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd
    };
    return activeGroups.map(function (group) {
      var problems = anomaliesForGroup(group, context);
      if (!problems.length) return null;
      var code = String(group.accountCode || '');
      var groupCode = String(group.code || 'Lettrage');
      return {
        accountCode: code,
        accountLabel: accountsByCode[code] ? String(accountsByCode[code].label || '') : '',
        debit: amountIsFiniteNonnegative(group.debit) ? Number(group.debit) : '',
        credit: amountIsFiniteNonnegative(group.credit) ? Number(group.credit) : '',
        anomaly: groupCode + ' — ' + problems.join(' '),
        matchingCode: groupCode
      };
    }).filter(Boolean).sort(function (left, right) {
      return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) || left.matchingCode.localeCompare(right.matchingCode, 'fr', { numeric: true });
    });
  }

  function buildReport(reportId, options) {
    options = options || {};
    reportId = String(reportId || '');
    var definition = DEFINITIONS[reportId];
    if (!definition) return baseResult(reportId, null, options, ['État du lettrage inconnu.'], [], null, '', '');

    var errors = [];
    var warnings = [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!GeneralBalanceReport || !GeneralBalanceReport.parseAccountFilter || !GeneralBalanceReport.accountMatches) {
      errors.push('Le sélecteur de comptes n’est pas disponible.');
    }
    var accountFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter)
      : null;
    if (accountFilter && !accountFilter.valid) errors.push(accountFilter.error);

    var hasPeriod = definition.filters.indexOf('from') !== -1;
    var from = String(options.from || (hasPeriod ? cycleStart : ''));
    var to = String(options.to || (hasPeriod ? cycleEnd : ''));
    if (hasPeriod) {
      if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour le rapport de lettrage.');
      else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
      else if (from < cycleStart || to > cycleEnd) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));
    if (errors.length) return baseResult(reportId, definition, options, errors, warnings, accountFilter, hasPeriod ? from : '', hasPeriod ? to : '');

    warnings.push(definition.kind === 'anomalies'
      ? 'Contrôle en lecture seule des invariants du lettrage manuel : compte auxiliaire actif et imputable de classe 4, lignes sources validées du cycle, absence de doublon et équilibre exact. Aucun lettrage n’est créé, corrigé ou annulé.'
      : 'Lecture des écritures validées et du registre de lettrage actif du dossier. Les écritures comptables ne sont ni modifiées ni complétées.');

    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var matchingGroups = Array.isArray(options.matchingGroups) ? options.matchingGroups : [];
    var accountsByCode = Object.create(null);
    var entriesById = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountsByCode[String(account.code)] = account;
    });
    entries.forEach(function (entry) {
      if (entry && entry.id != null) entriesById[String(entry.id)] = entry;
    });

    var activeGroups = matchingGroups.filter(function (group) { return group && group.status !== 'cancelled'; });
    var filteredActiveGroupCount = activeGroups.filter(function (group) {
      return GeneralBalanceReport.accountMatches(group.accountCode, accountFilter);
    }).length;
    var matchingGroupByLine = Object.create(null);
    var lineUseCount = Object.create(null);
    activeGroups.forEach(function (group) {
      (Array.isArray(group.lineKeys) ? group.lineKeys : []).forEach(function (key) {
        var normalized = String(key || '');
        if (!normalized) return;
        lineUseCount[normalized] = (lineUseCount[normalized] || 0) + 1;
        if (!matchingGroupByLine[normalized]) matchingGroupByLine[normalized] = [];
        matchingGroupByLine[normalized].push(group);
      });
    });

    var rows;
    if (definition.kind === 'anomalies') {
      rows = buildAnomalyRows(options, accountFilter, accountsByCode, entriesById, activeGroups, cycleStart, cycleEnd);
      warnings.push('Une anomalie n’est signalée que lorsqu’un lettrage enregistré contredit les règles de validation existantes ; aucune anomalie n’est déduite de la seule absence de lettrage.');
    } else {
      rows = [];
      entries.forEach(function (entry) {
        if (!entry || entry.status !== 'posted' || !isIsoDate(entry.date)) return;
        if (entry.date < cycleStart || entry.date > cycleEnd || entry.date < from || entry.date > to) return;
        (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
          if (!line) return;
          var code = String(line.account == null ? line.accountCode || '' : line.account);
          if (!code || !GeneralBalanceReport.accountMatches(code, accountFilter)) return;
          var lineKey = String(entry.id || '') + ':' + lineIndex;
          var groupsForLine = matchingGroupByLine[lineKey] || [];
          var group = groupsForLine.length === 1 ? groupsForLine[0] : null;
          if (definition.kind === 'matched' && !group) return;
          if (definition.kind === 'unmatched' && groupsForLine.length) return;
          var row = rowFromEntry(entry, line, lineIndex, accountsByCode[code] && accountsByCode[code].label, group);
          rows.push(row);
        });
      });
      rows.sort(function (left, right) {
        return left.entryDate.localeCompare(right.entryDate, 'fr') ||
          left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) ||
          left.journal.localeCompare(right.journal, 'fr', { numeric: true }) ||
          left.piece.localeCompare(right.piece, 'fr', { numeric: true }) ||
          left.lineKey.localeCompare(right.lineKey, 'fr', { numeric: true });
      });
    }

    var report = baseResult(reportId, definition, options, [], warnings, accountFilter, hasPeriod ? from : '', hasPeriod ? to : '');
    report.ok = true;
    report.rows = rows;
    report.dataAvailable = rows.length > 0;
    report.generatedLineCount = rows.length;
    report.matchingGroupCount = filteredActiveGroupCount;
    report.basis.cycleStart = cycleStart;
    report.basis.cycleEnd = cycleEnd;
    report.basis.selectedFrom = hasPeriod ? from : '';
    report.basis.selectedTo = hasPeriod ? to : '';
    report.basis.linesWithMultipleActiveGroups = Object.keys(lineUseCount).filter(function (key) { return lineUseCount[key] > 1; }).length;
    return report;
  }

  return {
    REPORT_IDS: Object.keys(DEFINITIONS),
    definitionFor: definitionFor,
    buildReport: buildReport
  };
});
