/*
 * PERFECTO · Règles pures de centralisation auxiliaire interne.
 * Agrège les mouvements d’un lot PERFECTO-AUXILIAIRE v1 par compte cible,
 * contrôle sa provenance déclarée et prépare une pièce générale. Ce module
 * ne lit aucun fichier et ne modifie jamais le dossier ni ses écritures.
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
    validateSourceContext: validateSourceContext,
    buildEntry: buildEntry
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfectoAccountingCentralization = api;
}(typeof window !== 'undefined' ? window : globalThis));
