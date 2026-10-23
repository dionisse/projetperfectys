/*
 * PERFECTO · Historique des comptes sur plusieurs exercices.
 * Agrégation consultative des dossiers successifs d’un même client et type comptable.
 * Les écritures validées sont lues sans basculer le dossier actif ; le report à nouveau
 * enregistré dans chaque exercice initialise son solde sans être traité comme un mouvement.
 */
(function (root, factory) {
  'use strict';
  var generalLedgerReport = root.PerfectoGeneralLedgerReport;
  if (!generalLedgerReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalLedgerReport = require('./general-ledger-report.js');
  }
  var api = factory(generalLedgerReport);
  root.PerfectoMultiYearHistoryReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralLedgerReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', reportLabel: 'Date', exportLabel: 'Date', text: true, defaultSelected: true },
    { key: 'debit', label: 'Débit', reportLabel: 'Débit', exportLabel: 'Débit', text: false, defaultSelected: true },
    { key: 'balance', label: 'Solde', reportLabel: 'Solde', exportLabel: 'Solde', text: false, defaultSelected: true },
    { key: 'reference', label: 'Référence', reportLabel: 'Référence', exportLabel: 'Référence', text: true, defaultSelected: true },
    { key: 'credit', label: 'Crédit', reportLabel: 'Crédit', exportLabel: 'Crédit', text: false, defaultSelected: true },
    { key: 'label', label: 'Libellé', reportLabel: 'Libellé', exportLabel: 'Libellé', text: true, defaultSelected: true }
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

  function exerciseYear(dossier) {
    var value = Number(dossier && dossier.exerciseYear);
    if (Number.isInteger(value) && value >= 1900 && value <= 9999) return value;
    var start = String(dossier && dossier.cycleStart || '');
    return isIsoDate(start) ? Number(start.slice(0, 4)) : 0;
  }

  function sameSeries(left, right) {
    return !!left && !!right &&
      String(left.clientCode || '') !== '' &&
      String(left.clientCode || '') === String(right.clientCode || '') &&
      String(left.accountingTypeCode || '') !== '' &&
      String(left.accountingTypeCode || '') === String(right.accountingTypeCode || '');
  }

  function validDossierCycle(dossier) {
    return !!dossier && isIsoDate(dossier.cycleStart) && isIsoDate(dossier.cycleEnd) && dossier.cycleStart <= dossier.cycleEnd;
  }

  function sourceForDossier(sources, dossierId) {
    return (Array.isArray(sources) ? sources : []).find(function (source) {
      return source && source.dossier && String(source.dossier.id) === String(dossierId);
    }) || null;
  }

  function sourceIsReadable(source) {
    return !!source && source.ok !== false && !!source.state &&
      Array.isArray(source.state.accounts) && Array.isArray(source.state.entries);
  }

  function relatedDossiers(options) {
    options = options || {};
    var current = options.currentDossier || null;
    if (!current || !validDossierCycle(current)) return [];
    var candidates = (Array.isArray(options.dossiers) ? options.dossiers : []).filter(function (dossier) {
      return sameSeries(dossier, current) && validDossierCycle(dossier) && dossier.cycleStart <= current.cycleEnd;
    });
    if (!candidates.some(function (dossier) { return String(dossier.id) === String(current.id); })) candidates.push(current);
    candidates.sort(function (left, right) {
      return String(left.cycleStart).localeCompare(String(right.cycleStart)) ||
        String(left.cycleEnd).localeCompare(String(right.cycleEnd)) ||
        String(left.id).localeCompare(String(right.id));
    });
    return candidates;
  }

  function dossierTimelineIsNonOverlapping(dossiers) {
    for (var index = 1; index < dossiers.length; index += 1) {
      if (dossiers[index].cycleStart <= dossiers[index - 1].cycleEnd) return false;
    }
    return true;
  }

  function selectedDossiers(options, startExercise) {
    var current = options.currentDossier;
    var all = relatedDossiers(options);
    var starts = all.filter(function (dossier) { return exerciseYear(dossier) === startExercise; });
    if (!starts.length) return { all: all, selected: [], startDossier: null, errors: ['Aucun dossier accessible ne correspond à l’exercice de début sélectionné.'] };
    starts.sort(function (left, right) {
      return String(left.cycleStart).localeCompare(String(right.cycleStart)) || String(left.id).localeCompare(String(right.id));
    });
    var startDossier = starts[0];
    if (startExercise > exerciseYear(current) || startDossier.cycleStart > current.cycleEnd) {
      return { all: all, selected: [], startDossier: startDossier, errors: ['L’exercice de début ne peut pas être postérieur à l’exercice actif.'] };
    }
    var selected = all.filter(function (dossier) {
      return dossier.cycleEnd >= startDossier.cycleStart && dossier.cycleStart <= current.cycleEnd;
    });
    if (!selected.some(function (dossier) { return String(dossier.id) === String(current.id); })) {
      return { all: all, selected: selected, startDossier: startDossier, errors: ['Le dossier de l’exercice actif ne fait pas partie de la période sélectionnée.'] };
    }
    if (!dossierTimelineIsNonOverlapping(selected)) {
      return { all: all, selected: selected, startDossier: startDossier, errors: ['Les cycles des dossiers de cette série se chevauchent. Vérifiez leurs périodes avant de produire l’historique.'] };
    }
    return { all: all, selected: selected, startDossier: startDossier, errors: [] };
  }

  function availableStartYears(options) {
    options = options || {};
    var current = options.currentDossier;
    if (!current || !validDossierCycle(current)) return [];
    var all = relatedDossiers(options);
    var years = [];
    all.forEach(function (dossier) {
      var year = exerciseYear(dossier);
      if (year && year <= exerciseYear(current) && years.indexOf(year) === -1) years.push(year);
    });
    years.sort(function (left, right) { return left - right; });
    return years.filter(function (year) {
      var selected = selectedDossiers(options, year);
      if (selected.errors.length) return false;
      return selected.selected.every(function (dossier) {
        return sourceIsReadable(sourceForDossier(options.sources, dossier.id));
      });
    });
  }

  function emptyResult(options, errors) {
    return {
      ok: false,
      errors: errors || [],
      warnings: [],
      from: '',
      to: '',
      startExercise: Number(options && options.startExercise) || 0,
      endExercise: exerciseYear(options && options.currentDossier),
      sourceDossiers: [],
      accounts: [],
      rows: [],
      displayRows: [],
      accountCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      movementEntryCount: 0,
      invalidLineCount: 0,
      invalidDateCount: 0,
      totals: { debit: 0, credit: 0, difference: 0 },
      accountFilter: null,
      basis: {
        postedEntriesOnly: true,
        openingBalancesUsedPerExercise: true,
        openingBalanceNotAddedAsMovement: true,
        noOpeningBalanceDoubleCount: true,
        noAccountingMutation: true
      }
    };
  }

  function dayAfter(value) {
    if (!isIsoDate(value)) return '';
    var parts = value.split('-').map(Number);
    var date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    date.setUTCDate(date.getUTCDate() + 1);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function accountUnion(currentAccounts, selected, sources) {
    var result = [];
    var byCode = Object.create(null);
    (Array.isArray(currentAccounts) ? currentAccounts : []).forEach(function (account) {
      if (!account || account.code == null) return;
      var code = String(account.code);
      byCode[code] = account;
      result.push(account);
    });
    for (var index = selected.length - 2; index >= 0; index -= 1) {
      var source = sourceForDossier(sources, selected[index].id);
      if (!sourceIsReadable(source)) continue;
      (source.state.accounts || []).forEach(function (account) {
        if (!account || account.code == null) return;
        var code = String(account.code);
        if (Object.prototype.hasOwnProperty.call(byCode, code)) return;
        byCode[code] = account;
        result.push(account);
      });
    }
    return result;
  }

  function build(options) {
    options = options || {};
    var currentDossier = options.currentDossier || null;
    var startExercise = Number(options.startExercise);
    var accountFilter = options.accountFilter == null ? '*' : String(options.accountFilter);
    var errors = [];
    if (!GeneralLedgerReport || typeof GeneralLedgerReport.build !== 'function') {
      return emptyResult(options, ['Le calcul du grand livre n’est pas disponible.']);
    }
    if (!currentDossier || !validDossierCycle(currentDossier)) errors.push('Le cycle du dossier actif n’est pas défini correctement.');
    if (!Number.isInteger(startExercise) || startExercise < 1900 || startExercise > 9999) errors.push('Indiquez un exercice de début valide.');
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    if (errors.length) return emptyResult(options, errors);

    var selection = selectedDossiers(options, startExercise);
    errors = errors.concat(selection.errors);
    if (errors.length) return emptyResult(options, errors);
    selection.selected.forEach(function (dossier) {
      var configuredPlaces = Number(dossier.accountingConfiguration && dossier.accountingConfiguration.decimalPlaces);
      if (Number.isInteger(configuredPlaces) && configuredPlaces >= 0 && configuredPlaces <= 4) decimalPlaces = Math.max(decimalPlaces, configuredPlaces);
    });
    var sources = Array.isArray(options.sources) ? options.sources : [];
    var unavailable = selection.selected.filter(function (dossier) {
      return !sourceIsReadable(sourceForDossier(sources, dossier.id));
    });
    if (unavailable.length) {
      return emptyResult(options, ['Lecture historique impossible pour : ' + unavailable.map(function (dossier) {
        return String(dossier.reference || dossier.name || dossier.id);
      }).join(', ') + '. Aucun mouvement partiel n’a été agrégé.']);
    }

    var entriesByDossier = Object.create(null);
    var offCycleEntryCount = 0;
    selection.selected.forEach(function (dossier) {
      var source = sourceForDossier(sources, dossier.id);
      var sourceEntries = Array.isArray(source.state.entries) ? source.state.entries : [];
      entriesByDossier[dossier.id] = [];
      sourceEntries.forEach(function (entry, entryIndex) {
        if (!entry || entry.status !== 'posted') return;
        var date = String(entry.date || '');
        if (isIsoDate(date) && (date < dossier.cycleStart || date > dossier.cycleEnd)) {
          offCycleEntryCount += 1;
          return;
        }
        var originalId = String(entry.id || entry.reference || ('entry-' + entryIndex));
        entriesByDossier[dossier.id].push(Object.assign({}, entry, {
          id: String(dossier.id) + '::' + originalId
        }));
      });
    });

    var currentSource = sourceForDossier(sources, currentDossier.id);
    var currentAccounts = Array.isArray(options.accounts) ? options.accounts : currentSource.state.accounts;
    var allAccounts = accountUnion(currentAccounts, selection.selected, sources);
    var accountOrder = Object.create(null);
    allAccounts.forEach(function (account, index) {
      if (account && account.code != null) accountOrder[String(account.code)] = index;
    });
    var factor = Math.pow(10, decimalPlaces);
    var aggregateByCode = Object.create(null);
    var totalDebitMinor = 0;
    var totalCreditMinor = 0;
    var lineCount = 0;
    var movementEntryCount = 0;
    var invalidLineCount = 0;
    var invalidDateCount = 0;
    var warnings = [];
    var parsedAccountFilter = null;

    selection.selected.forEach(function (dossier) {
      var source = sourceForDossier(sources, dossier.id);
      var segment = GeneralLedgerReport.build({
        accounts: allAccounts,
        entries: entriesByDossier[dossier.id],
        openingBalances: Array.isArray(source.state.openingBalances) ? source.state.openingBalances : [],
        journals: Array.isArray(source.state.journals) ? source.state.journals : [],
        cycleStart: dossier.cycleStart,
        cycleEnd: dossier.cycleEnd,
        from: dossier.cycleStart,
        to: dossier.cycleEnd,
        accountFilter: accountFilter,
        includeNonMoved: false,
        subtotalByMonth: false,
        decimalPlaces: decimalPlaces
      });
      if (!segment.ok) {
        errors = errors.concat((segment.errors || ['Le rapport d’un exercice n’a pas pu être calculé.']).map(function (message) {
          return 'Exercice ' + exerciseYear(dossier) + ' : ' + message;
        }));
        return;
      }
      if (!parsedAccountFilter) parsedAccountFilter = segment.accountFilter;
      (segment.warnings || []).forEach(function (warning) {
        warnings.push('Exercice ' + exerciseYear(dossier) + ' : ' + warning);
      });
      totalDebitMinor += Math.round((Number(segment.totals.debit) || 0) * factor);
      totalCreditMinor += Math.round((Number(segment.totals.credit) || 0) * factor);
      lineCount += Number(segment.lineCount) || 0;
      movementEntryCount += Number(segment.movementEntryCount) || 0;
      invalidLineCount += Number(segment.invalidLineCount) || 0;
      invalidDateCount += Number(segment.invalidDateCount) || 0;
      segment.accounts.forEach(function (section) {
        var code = String(section.code);
        var aggregate = aggregateByCode[code];
        if (!aggregate) {
          aggregate = aggregateByCode[code] = {
            code: code,
            label: String(section.label || code),
            openingBalance: section.openingBalance,
            closingBalance: section.closingBalance,
            debitMinor: 0,
            creditMinor: 0,
            lineCount: 0,
            rows: [],
            displayRows: []
          };
        }
        aggregate.label = String(section.label || aggregate.label || code);
        aggregate.closingBalance = section.closingBalance;
        aggregate.debitMinor += Math.round((Number(section.debit) || 0) * factor);
        aggregate.creditMinor += Math.round((Number(section.credit) || 0) * factor);
        aggregate.lineCount += Number(section.lineCount) || 0;
        Array.prototype.push.apply(aggregate.rows, section.rows || []);
        Array.prototype.push.apply(aggregate.displayRows, section.displayRows || section.rows || []);
      });
    });
    if (errors.length) return emptyResult(options, errors);

    for (var gapIndex = 1; gapIndex < selection.selected.length; gapIndex += 1) {
      var previous = selection.selected[gapIndex - 1];
      var next = selection.selected[gapIndex];
      var nextExpectedStart = dayAfter(previous.cycleEnd);
      if (nextExpectedStart && next.cycleStart > nextExpectedStart) {
        warnings.push('Aucun dossier accessible ne couvre la période du ' + nextExpectedStart + ' au ' + (function () {
          var before = new Date(Date.UTC(Number(next.cycleStart.slice(0, 4)), Number(next.cycleStart.slice(5, 7)) - 1, Number(next.cycleStart.slice(8, 10))));
          before.setUTCDate(before.getUTCDate() - 1);
          return before.getUTCFullYear() + '-' + String(before.getUTCMonth() + 1).padStart(2, '0') + '-' + String(before.getUTCDate()).padStart(2, '0');
        })() + '. L’historique ne contient que les exercices enregistrés listés ci-dessous.');
      }
    }
    if (offCycleEntryCount) {
      warnings.push(offCycleEntryCount + (offCycleEntryCount === 1
        ? ' écriture validée datée hors du cycle de son dossier a été ignorée.'
        : ' écritures validées datées hors du cycle de leur dossier ont été ignorées.'));
    }

    var reportAccounts = Object.keys(aggregateByCode).map(function (code) {
      var aggregate = aggregateByCode[code];
      aggregate.debit = aggregate.debitMinor / factor;
      aggregate.credit = aggregate.creditMinor / factor;
      delete aggregate.debitMinor;
      delete aggregate.creditMinor;
      return aggregate;
    }).sort(function (left, right) {
      var leftIndex = Object.prototype.hasOwnProperty.call(accountOrder, left.code) ? accountOrder[left.code] : Number.MAX_SAFE_INTEGER;
      var rightIndex = Object.prototype.hasOwnProperty.call(accountOrder, right.code) ? accountOrder[right.code] : Number.MAX_SAFE_INTEGER;
      return leftIndex - rightIndex || left.code.localeCompare(right.code, 'fr', { numeric: true });
    });
    var flatRows = [];
    var flatDisplayRows = [];
    reportAccounts.forEach(function (section) {
      Array.prototype.push.apply(flatRows, section.rows);
      Array.prototype.push.apply(flatDisplayRows, section.displayRows);
    });
    return {
      ok: true,
      errors: [],
      warnings: warnings,
      from: selection.startDossier.cycleStart,
      to: currentDossier.cycleEnd,
      startExercise: startExercise,
      endExercise: exerciseYear(currentDossier),
      sourceDossiers: selection.selected.map(function (dossier) {
        return {
          id: dossier.id,
          reference: String(dossier.reference || ''),
          name: String(dossier.name || dossier.clientName || dossier.reference || ''),
          exerciseYear: exerciseYear(dossier),
          cycleStart: dossier.cycleStart,
          cycleEnd: dossier.cycleEnd
        };
      }),
      accounts: reportAccounts,
      rows: flatRows,
      displayRows: flatDisplayRows,
      accountCount: reportAccounts.length,
      lineCount: lineCount,
      generatedLineCount: lineCount,
      movementEntryCount: movementEntryCount,
      invalidLineCount: invalidLineCount,
      invalidDateCount: invalidDateCount,
      totals: {
        debit: totalDebitMinor / factor,
        credit: totalCreditMinor / factor,
        difference: (totalDebitMinor - totalCreditMinor) / factor
      },
      accountFilter: parsedAccountFilter,
      includeNonMoved: false,
      subtotalByMonth: false,
      basis: {
        postedEntriesOnly: true,
        openingBalancesUsedPerExercise: true,
        startingOpeningBalanceDossierId: selection.startDossier.id,
        subsequentOpeningBalancesUsedOnce: true,
        openingBalanceNotAddedAsMovement: true,
        noOpeningBalanceDoubleCount: true,
        exerciseOpeningBalancesResetRunningBalance: true,
        dossiersIsolatedByClientAndAccountingType: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    availableStartYears: availableStartYears,
    build: build
  };
});
