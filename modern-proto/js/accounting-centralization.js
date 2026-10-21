/*
 * PERFECTO · Règles pures de centralisation auxiliaire interne.
 * Agrège les lots PERFECTO-AUXILIAIRE v1 et extrait en lecture seule les lignes
 * validées explicitement rattachées à un auxiliaire. Le parcours par lot prépare
 * un brouillon ; l’extraction automatique ne modifie jamais le dossier.
 */
(function (root) {
  'use strict';

  var AUXILIARY_FORMAT = 'PERFECTO-AUXILIAIRE';
  var AUXILIARY_VERSION = '1';
  var INTERNAL_SOURCE_SYSTEM = 'PERFECTO-AUXILIAIRE-INTERNE';
  var INTERNAL_PRODUCERS = Object.freeze([
    'PERFECTO-PAIE-RH',
    'PERFECTO-VENTES-STOCK-FACTURATION'
  ]);

  function aggregate(parsed, accountMap, targetAccounts) {
    var errors = [];
    var warnings = [];
    var errorKeys = Object.create(null);
    var accountLookup = Object.create(null);
    var grouped = Object.create(null);
    var sourceAccounts = Object.create(null);
    var auxiliaryAccounts = Object.create(null);
    var totalDebit = 0;
    var totalCredit = 0;

    function addError(key, message) {
      if (errorKeys[key]) return;
      errorKeys[key] = true;
      errors.push(message);
    }

    if (!parsed || !parsed.ok || !Array.isArray(parsed.rows) || !parsed.rows.length) {
      return { ok: false, errors: (parsed && parsed.errors || ['Aucun lot auxiliaire valide à centraliser.']).slice(), warnings: [], lines: [], totalDebit: 0, totalCredit: 0, accountMappings: [], auxiliaryAccountCount: 0 };
    }
    (targetAccounts || []).forEach(function (account) { accountLookup[String(account.code)] = account; });
    accountMap = accountMap || Object.create(null);

    parsed.rows.forEach(function (row) {
      var sourceCode = String(row.account || '').trim();
      var mappedCode = Object.prototype.hasOwnProperty.call(accountMap, sourceCode)
        ? String(accountMap[sourceCode] || '').trim()
        : sourceCode;
      var target = accountLookup[mappedCode];
      if (!sourceCode || !mappedCode || !target) {
        addError('unmapped:' + sourceCode, 'Compte général source « ' + (sourceCode || '—') + ' » sans correspondance valide dans le plan cible.');
        return;
      }
      if (target.active === false) {
        addError('inactive:' + sourceCode + ':' + mappedCode, 'Le compte cible « ' + mappedCode + ' » est inactif et ne peut pas recevoir une centralisation.');
        return;
      }
      if (target.postable === false) {
        addError('non-postable:' + sourceCode + ':' + mappedCode, 'Le compte cible « ' + mappedCode + ' » est un compte de regroupement et ne peut pas recevoir une écriture.');
        return;
      }
      if (row.auxiliaryCode && !target.aux) {
        addError('not-aux:' + sourceCode + ':' + mappedCode, 'Le compte auxiliaire source « ' + sourceCode + ' » est associé à « ' + mappedCode + ' », qui n’est pas marqué comme compte auxiliaire dans le plan cible.');
        return;
      }

      var sourceKey = sourceCode;
      var sourceInfo = sourceAccounts[sourceKey];
      if (!sourceInfo) {
        sourceInfo = {
          sourceCode: sourceCode,
          sourceLabel: String(row.accountLabel || ''),
          targetCode: mappedCode,
          targetLabel: target.label || '',
          auxiliaryCodes: Object.create(null)
        };
        sourceAccounts[sourceKey] = sourceInfo;
      } else if (sourceInfo.targetCode !== mappedCode) {
        addError('mapping-conflict:' + sourceCode, 'Le compte source « ' + sourceCode + ' » possède plusieurs correspondances cibles.');
        return;
      } else if (sourceInfo.sourceLabel && row.accountLabel && sourceInfo.sourceLabel !== String(row.accountLabel)) {
        addError('label-conflict:' + sourceCode, 'Le libellé du compte source « ' + sourceCode + ' » varie dans le lot.');
        return;
      }
      if (row.auxiliaryCode) {
        var auxiliaryCode = String(row.auxiliaryCode).trim();
        sourceInfo.auxiliaryCodes[auxiliaryCode] = true;
        if (!auxiliaryAccounts[sourceCode]) auxiliaryAccounts[sourceCode] = Object.create(null);
        auxiliaryAccounts[sourceCode][auxiliaryCode] = true;
      }

      var group = grouped[mappedCode];
      if (!group) {
        group = { account: mappedCode, accountLabel: target.label || '', debit: 0, credit: 0 };
        grouped[mappedCode] = group;
      }
      group.debit += Number(row.debit) || 0;
      group.credit += Number(row.credit) || 0;
      totalDebit += Number(row.debit) || 0;
      totalCredit += Number(row.credit) || 0;
      if (!Number.isSafeInteger(group.debit) || !Number.isSafeInteger(group.credit) ||
          !Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
        addError('overflow', 'Les totaux agrégés dépassent la capacité numérique sûre.');
      }
    });

    var auxiliaryAccountCount = Object.keys(auxiliaryAccounts).reduce(function (count, sourceCode) {
      return count + Object.keys(auxiliaryAccounts[sourceCode]).length;
    }, 0);
    if (!auxiliaryAccountCount) addError('no-auxiliary', 'Aucune ligne auxiliaire n’est associée à un compte marqué auxiliaire dans le plan cible.');
    if (totalDebit !== totalCredit) addError('unbalanced', 'Le lot mappé n’est pas équilibré : débit ' + totalDebit + ' XOF, crédit ' + totalCredit + ' XOF.');

    var lines = [];
    Object.keys(grouped).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (code) {
      var group = grouped[code];
      if (group.debit > 0) lines.push({ account: group.account, accountLabel: group.accountLabel, debit: group.debit, credit: 0 });
      if (group.credit > 0) lines.push({ account: group.account, accountLabel: group.accountLabel, debit: 0, credit: group.credit });
    });
    if (lines.length < 2) addError('line-count', 'La centralisation doit produire au moins deux lignes générales mouvementées.');

    var mappings = Object.keys(sourceAccounts).sort(function (a, b) { return a.localeCompare(b); }).map(function (sourceCode) {
      var info = sourceAccounts[sourceCode];
      return {
        sourceCode: info.sourceCode,
        sourceLabel: info.sourceLabel,
        targetCode: info.targetCode,
        targetLabel: info.targetLabel,
        auxiliaryCodeCount: Object.keys(info.auxiliaryCodes).length
      };
    });
    mappings.forEach(function (mapping) {
      if (mapping.sourceCode !== mapping.targetCode && warnings.length < 20) {
        warnings.push('Le compte source « ' + mapping.sourceCode + ' — ' + mapping.sourceLabel + ' » sera centralisé vers « ' + mapping.targetCode + ' — ' + mapping.targetLabel + ' ».');
      }
    });
    if (mappings.filter(function (mapping) { return mapping.sourceCode !== mapping.targetCode; }).length > warnings.length) {
      warnings.push('D’autres correspondances de comptes ne sont pas détaillées ici ; vérifiez le tableau des correspondances.');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      lines: lines,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      accountMappings: mappings,
      auxiliaryAccountCount: auxiliaryAccountCount
    };
  }

  function explicitAuxiliaryReference(line, sourceLine) {
    line = line && typeof line === 'object' ? line : {};
    sourceLine = sourceLine && typeof sourceLine === 'object' ? sourceLine : {};
    function scalar(value) {
      return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    }
    function firstText(values) {
      for (var valueIndex = 0; valueIndex < values.length; valueIndex += 1) {
        var text = scalar(values[valueIndex]);
        if (text) return text;
      }
      return '';
    }
    var lineLabel = firstText([line.auxiliaryLabel, line.auxiliaryAccountLabel, line.auxiliaryName]);
    var sourceLabel = firstText([sourceLine.auxiliaryLabel, sourceLine.auxiliaryAccountLabel, sourceLine.auxiliaryName]);
    var candidates = [
      { code: line.auxiliaryAccountCode, label: lineLabel },
      { code: line.auxiliaryCode, label: lineLabel },
      { code: line.auxiliaryId, label: lineLabel },
      { code: line.auxiliaryAccount, label: lineLabel },
      { code: sourceLine.auxiliaryAccount, label: sourceLabel },
      { code: sourceLine.auxiliaryAccountCode, label: sourceLabel },
      { code: sourceLine.auxiliaryCode, label: sourceLabel },
      { code: sourceLine.auxiliaryId, label: sourceLabel }
    ];
    for (var index = 0; index < candidates.length; index += 1) {
      var code = scalar(candidates[index].code);
      if (code) return { code: code, label: scalar(candidates[index].label) };
    }
    return { code: '', label: '' };
  }

  function extractValidatedAuxiliaryMovements(entries, accounts, dossier, options) {
    dossier = dossier || {};
    options = options || {};
    var decimalPlaces = Number(options.decimalPlaces);
    if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 4) decimalPlaces = 0;
    var precision = Math.pow(10, decimalPlaces);
    var accountLookup = Object.create(null);
    var collectiveGroups = Object.create(null);
    var auxiliaryGroups = Object.create(null);
    var movements = [];
    var errors = [];
    var entryIds = Object.create(null);
    var totals = { debitUnits: 0, creditUnits: 0 };
    var stats = {
      scannedPostedEntryCount: 0,
      eligibleEntryCount: 0,
      eligibleMovementCount: 0,
      auxiliaryCount: 0,
      unattributedMovementCount: 0,
      unclassifiedAuxiliaryMovementCount: 0,
      ignoredDraftEntryCount: 0,
      excludedDemoEntryCount: 0,
      excludedCentralizationEntryCount: 0,
      excludedOutOfCycleEntryCount: 0,
      totalDebit: 0,
      totalCredit: 0,
      decimalPlaces: decimalPlaces
    };

    (accounts || []).forEach(function (account) {
      if (account && account.code != null) accountLookup[String(account.code)] = account;
    });

    function addError(message) {
      if (errors.indexOf(message) === -1) errors.push(message);
    }

    function amountUnits(value) {
      var number = Number(value);
      if (!Number.isFinite(number) || number < 0) return null;
      var units = Math.round(number * precision);
      if (!Number.isSafeInteger(units) || Math.abs(number - units / precision) > Number.EPSILON * Math.max(1, Math.abs(number)) * 4) return null;
      return units;
    }

    function addUnits(target, debitUnits, creditUnits) {
      target.debitUnits += debitUnits;
      target.creditUnits += creditUnits;
      if (!Number.isSafeInteger(target.debitUnits) || !Number.isSafeInteger(target.creditUnits)) {
        addError('Les totaux de l’extraction auxiliaire dépassent la capacité numérique sûre.');
        return false;
      }
      return true;
    }

    function entryIsDemonstration(entry, metadata) {
      return /^seed(?:-|$)/i.test(String(entry.id || '')) || entry.origin === 'demo' || metadata.demonstrationData === true;
    }

    function entryIsPriorCentralization(entry, metadata) {
      return entry.sourceSystem === INTERNAL_SOURCE_SYSTEM || metadata.operation === 'auxiliary-centralization';
    }

    (Array.isArray(entries) ? entries : []).forEach(function (entry) {
      if (!entry || !Array.isArray(entry.lines)) return;
      if (entry.status !== 'posted') {
        if (entry.status === 'draft') stats.ignoredDraftEntryCount += 1;
        return;
      }
      var metadata = entry.sourceMetadata && typeof entry.sourceMetadata === 'object' ? entry.sourceMetadata : {};
      if (entryIsDemonstration(entry, metadata)) {
        stats.excludedDemoEntryCount += 1;
        return;
      }
      if (entryIsPriorCentralization(entry, metadata)) {
        stats.excludedCentralizationEntryCount += 1;
        return;
      }
      var entryDate = String(entry.date || '');
      if ((dossier.cycleStart && entryDate < String(dossier.cycleStart)) ||
          (dossier.cycleEnd && entryDate > String(dossier.cycleEnd))) {
        stats.excludedOutOfCycleEntryCount += 1;
        return;
      }
      stats.scannedPostedEntryCount += 1;
      var sourceLines = Array.isArray(metadata.lines) ? metadata.lines : [];
      (entry.lines || []).forEach(function (line, lineIndex) {
        line = line && typeof line === 'object' ? line : {};
        var sourceLine = sourceLines[lineIndex] || {};
        var auxiliary = explicitAuxiliaryReference(line, sourceLine);
        var accountCode = String(line.account || line.accountCode || '').trim();
        var account = accountLookup[accountCode];
        if (!account || account.aux !== true) {
          if (auxiliary.code) stats.unclassifiedAuxiliaryMovementCount += 1;
          return;
        }
        if (!auxiliary.code) {
          stats.unattributedMovementCount += 1;
          return;
        }
        if (!isValidIsoDate(entryDate)) {
          addError('L’écriture source « ' + String(entry.reference || entry.id || '—') + ' » porte une date invalide ; l’export est bloqué.');
          return;
        }
        if (!String(entry.id || '').trim()) {
          addError('Une ligne auxiliaire ne possède pas d’identifiant de pièce comptable ; l’export traçable est bloqué.');
          return;
        }
        var debitUnits = amountUnits(line.debit);
        var creditUnits = amountUnits(line.credit);
        if (debitUnits === null || creditUnits === null || (debitUnits > 0 && creditUnits > 0) || (debitUnits === 0 && creditUnits === 0)) {
          addError('L’écriture source « ' + String(entry.reference || entry.id || '—') + ' », ligne ' + (lineIndex + 1) + ' : montant auxiliaire invalide à la précision du dossier.');
          return;
        }
        if (!addUnits(totals, debitUnits, creditUnits)) return;

        var accountLabel = String(account.label || line.accountLabel || line.sourceAccountLabel || '').trim();
        var movement = {
          date: entryDate,
          journal: String(entry.journal || '').trim(),
          reference: String(entry.reference || '').trim(),
          description: String(entry.description || line.description || '').trim(),
          sourceDate: String(metadata.dateEcriture || metadata.sourceDate || sourceLine.pieceDate || entryDate).trim(),
          sourceJournal: String(metadata.sourceJournal || metadata.sourceJournalCode || entry.sourceJournal || entry.journal || '').trim(),
          sourceReference: String(metadata.referencePiece || metadata.numEcriture || sourceLine.pieceReference || entry.sourceReference || entry.reference || '').trim(),
          sourceDescription: String(sourceLine.description || metadata.sourceDescription || entry.sourceDescription || entry.description || line.description || '').trim(),
          lineNumber: lineIndex + 1,
          sourceRow: sourceLine.sourceRow == null ? (line.sourceRow == null ? '' : String(line.sourceRow)) : String(sourceLine.sourceRow),
          account: accountCode,
          accountLabel: accountLabel,
          auxiliaryCode: auxiliary.code,
          auxiliaryLabel: auxiliary.label,
          debit: debitUnits / precision,
          credit: creditUnits / precision,
          sourceEntryId: String(entry.id || ''),
          originalEntryId: String(metadata.originalEntryId || '').trim(),
          sourceId: String(entry.sourceId || ''),
          sourceSystem: String(entry.sourceSystem || metadata.sourceSystem || '').trim(),
          sourceFileId: String(metadata.sourceFileId || metadata.fileHash || '').trim()
        };
        movements.push(movement);
        entryIds[movement.sourceEntryId] = true;

        var collectiveGroup = collectiveGroups[accountCode];
        if (!collectiveGroup) {
          collectiveGroup = {
            account: accountCode,
            accountLabel: accountLabel,
            debitUnits: 0,
            creditUnits: 0,
            movementCount: 0,
            auxiliaryCodes: Object.create(null)
          };
          collectiveGroups[accountCode] = collectiveGroup;
        }
        if (!addUnits(collectiveGroup, debitUnits, creditUnits)) return;
        collectiveGroup.movementCount += 1;
        collectiveGroup.auxiliaryCodes[auxiliary.code] = true;

        var auxiliaryKey = JSON.stringify([accountCode, auxiliary.code]);
        var auxiliaryGroup = auxiliaryGroups[auxiliaryKey];
        if (!auxiliaryGroup) {
          auxiliaryGroup = {
            account: accountCode,
            accountLabel: accountLabel,
            auxiliaryCode: auxiliary.code,
            auxiliaryLabel: auxiliary.label,
            debitUnits: 0,
            creditUnits: 0,
            movementCount: 0
          };
          auxiliaryGroups[auxiliaryKey] = auxiliaryGroup;
        } else if (!auxiliaryGroup.auxiliaryLabel && auxiliary.label) {
          auxiliaryGroup.auxiliaryLabel = auxiliary.label;
        }
        if (!addUnits(auxiliaryGroup, debitUnits, creditUnits)) return;
        auxiliaryGroup.movementCount += 1;
      });
    });

    movements.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.journal.localeCompare(b.journal) ||
        a.reference.localeCompare(b.reference) || a.lineNumber - b.lineNumber;
    });
    var byCollective = Object.keys(collectiveGroups).sort(function (a, b) { return a.localeCompare(b); }).map(function (code) {
      var group = collectiveGroups[code];
      return {
        account: group.account,
        accountLabel: group.accountLabel,
        debit: group.debitUnits / precision,
        credit: group.creditUnits / precision,
        movementCount: group.movementCount,
        auxiliaryCount: Object.keys(group.auxiliaryCodes).length
      };
    });
    var byAuxiliary = Object.keys(auxiliaryGroups).sort(function (a, b) { return a.localeCompare(b); }).map(function (key) {
      var group = auxiliaryGroups[key];
      return {
        account: group.account,
        accountLabel: group.accountLabel,
        auxiliaryCode: group.auxiliaryCode,
        auxiliaryLabel: group.auxiliaryLabel,
        debit: group.debitUnits / precision,
        credit: group.creditUnits / precision,
        movementCount: group.movementCount
      };
    });

    stats.eligibleEntryCount = Object.keys(entryIds).length;
    stats.eligibleMovementCount = movements.length;
    stats.auxiliaryCount = byAuxiliary.length;
    stats.totalDebit = totals.debitUnits / precision;
    stats.totalCredit = totals.creditUnits / precision;
    return {
      ok: errors.length === 0,
      errors: errors,
      dossierReference: String(dossier.reference || ''),
      exercise: Number(dossier.exerciseYear || dossier.exercise) || '',
      cycleStart: String(dossier.cycleStart || ''),
      cycleEnd: String(dossier.cycleEnd || ''),
      stats: stats,
      movements: movements,
      byCollective: byCollective,
      byAuxiliary: byAuxiliary
    };
  }

  function isValidIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function validateSourceContext(parsed, dossier) {
    var errors = [];
    var metadata = parsed && parsed.metadata || {};
    dossier = dossier || {};
    if (!parsed || !parsed.ok) errors.push('Le lot auxiliaire n’a pas passé les contrôles de structure et d’équilibre.');
    if (metadata.format !== AUXILIARY_FORMAT || metadata.version !== AUXILIARY_VERSION) {
      errors.push('Le format source doit être PERFECTO-AUXILIAIRE v1.');
    }
    if (INTERNAL_PRODUCERS.indexOf(String(metadata.sourceSystem || '')) === -1) {
      errors.push('Le producteur déclaré doit être Paie & RH ou Ventes, stock & facturation dans PERFECTO ; les logiciels tiers et lots déjà centralisés sont refusés.');
    }
    if (!dossier.reference || String(metadata.dossierReference || '') !== String(dossier.reference)) {
      errors.push('Le dossier source déclaré ne correspond pas au dossier actif ; aucun transfert entre dossiers n’est permis ici.');
    }
    var targetExercise = Number(dossier.exerciseYear || dossier.exercise);
    if (!Number.isInteger(targetExercise) || Number(metadata.exercise) !== targetExercise) {
      errors.push('L’exercice source déclaré ne correspond pas à l’exercice du dossier actif.');
    }
    if (!String(metadata.batchReference || '').trim()) errors.push('La référence du lot source est obligatoire.');
    if (parsed && Array.isArray(parsed.rows) && dossier.cycleStart && dossier.cycleEnd) {
      var outOfCycle = parsed.rows.find(function (row) {
        return String(row.sourceDate || '') < String(dossier.cycleStart) || String(row.sourceDate || '') > String(dossier.cycleEnd);
      });
      if (outOfCycle) errors.push('Au moins une date source (' + String(outOfCycle.sourceDate || '—') + ') se trouve hors du cycle comptable actif.');
    }
    return { ok: errors.length === 0, errors: errors, metadata: metadata };
  }

  function buildEntry(parsed, aggregation, target) {
    target = target || {};
    var dossier = target.dossier || {};
    var context = validateSourceContext(parsed, dossier);
    var errors = context.errors.slice();
    var metadata = context.metadata;
    if (!aggregation || !aggregation.ok) {
      (aggregation && aggregation.errors || ['Les totaux par compte collectif ne sont pas valides.']).forEach(function (message) {
        if (errors.indexOf(message) === -1) errors.push(message);
      });
    }
    var reference = String(target.reference || '').trim();
    var journal = String(target.journal || '').trim();
    var date = String(target.date || '').trim();
    if (!reference) errors.push('La référence de la pièce générale est obligatoire.');
    if (reference.length > 100) errors.push('La référence de la pièce générale ne peut pas dépasser 100 caractères.');
    if (!journal) errors.push('Le journal général est obligatoire.');
    if (journal.length > 30) errors.push('Le code du journal général ne peut pas dépasser 30 caractères.');
    if (journal.toUpperCase() === 'CEN') errors.push('Le journal CEN est réservé au futur transfert interne entre dossiers ; choisissez un journal général ordinaire.');
    if (!isValidIsoDate(date)) errors.push('La date de la pièce générale doit être une date valide.');
    if (isValidIsoDate(date) && dossier.cycleStart && date < dossier.cycleStart) errors.push('La date de centralisation précède le cycle comptable du dossier.');
    if (isValidIsoDate(date) && dossier.cycleEnd && date > dossier.cycleEnd) errors.push('La date de centralisation dépasse le cycle comptable du dossier.');

    var lines = aggregation && Array.isArray(aggregation.lines) ? aggregation.lines : [];
    var totalDebit = 0;
    var totalCredit = 0;
    lines.forEach(function (line, index) {
      var debit = Number(line.debit);
      var credit = Number(line.credit);
      if (!String(line.account || '').trim() || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) ||
          debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        errors.push('La ligne agrégée ' + (index + 1) + ' contient un compte ou un montant non valide.');
        return;
      }
      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
        errors.push('Les totaux de la centralisation dépassent la capacité numérique sûre.');
      }
    });
    if (lines.length < 2) errors.push('La centralisation doit contenir au moins deux lignes générales mouvementées.');
    if (totalDebit !== totalCredit) errors.push('La centralisation préparée doit être équilibrée avant enregistrement.');
    if (errors.length) return { ok: false, errors: errors, entry: null };

    var sourceId = JSON.stringify([
      INTERNAL_SOURCE_SYSTEM,
      String(metadata.sourceSystem),
      String(metadata.dossierReference),
      String(metadata.exercise),
      String(metadata.batchReference)
    ]);
    var description = String(target.description || '').trim() || 'Centralisation auxiliaire · lot ' + String(metadata.batchReference);
    if (description.length > 250) errors.push('Le libellé de la pièce générale ne peut pas dépasser 250 caractères.');
    if (errors.length) return { ok: false, errors: errors, entry: null };

    return {
      ok: true,
      errors: [],
      entry: {
        reference: reference,
        sourceReference: String(metadata.batchReference),
        sourceJournal: '',
        journal: journal,
        date: date,
        description: description,
        sourceSystem: INTERNAL_SOURCE_SYSTEM,
        sourceId: sourceId,
        sourceMetadata: {
          feed: 'internal',
          operation: 'auxiliary-centralization',
          provenance: 'manual-file-self-declared',
          sourceModule: 'accounting',
          runId: sourceId,
          runReference: String(metadata.batchReference),
          period: String(metadata.exercise),
          sourceFormat: AUXILIARY_FORMAT,
          sourceVersion: AUXILIARY_VERSION,
          sourceSystem: String(metadata.sourceSystem),
          sourceDossierReference: String(metadata.dossierReference),
          sourceExercise: Number(metadata.exercise),
          sourceBatchReference: String(metadata.batchReference),
          sourceFileSha256: String(target.sourceFileSha256 || ''),
          sourceMovementCount: parsed.rows.length,
          sourceDocumentCount: Number(parsed.documentCount) || 0,
          sourceAuxiliaryMovementCount: Number(parsed.auxiliaryMovementCount) || 0,
          sourceTotalDebit: Number(parsed.totalDebit) || 0,
          sourceTotalCredit: Number(parsed.totalCredit) || 0,
          accountMappings: (aggregation.accountMappings || []).map(function (mapping) {
            return {
              sourceCode: String(mapping.sourceCode || ''),
              sourceLabel: String(mapping.sourceLabel || ''),
              targetCode: String(mapping.targetCode || ''),
              targetLabel: String(mapping.targetLabel || ''),
              auxiliaryCodeCount: Number(mapping.auxiliaryCodeCount) || 0
            };
          })
        },
        lines: lines.map(function (line) {
          return {
            account: String(line.account),
            accountLabel: String(line.accountLabel || ''),
            debit: Number(line.debit),
            credit: Number(line.credit)
          };
        })
      }
    };
  }

  var api = {
    AUXILIARY_FORMAT: AUXILIARY_FORMAT,
    AUXILIARY_VERSION: AUXILIARY_VERSION,
    INTERNAL_SOURCE_SYSTEM: INTERNAL_SOURCE_SYSTEM,
    INTERNAL_PRODUCERS: INTERNAL_PRODUCERS,
    aggregate: aggregate,
    extractValidatedAuxiliaryMovements: extractValidatedAuxiliaryMovements,
    validateSourceContext: validateSourceContext,
    buildEntry: buildEntry
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfectoAccountingCentralization = api;
}(typeof window !== 'undefined' ? window : globalThis));
