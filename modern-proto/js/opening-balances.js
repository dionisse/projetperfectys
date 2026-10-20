/* PERFECTO · Calcul des reports à nouveau, sans écriture ni mutation de source. */
(function (root) {
  'use strict';

  function isoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }

  function dayBefore(value) {
    var date = isoDate(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() - 1);
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0') + '-' + String(date.getUTCDate()).padStart(2, '0');
  }

  function accountClass(account) {
    var value = Number(account && account.cls);
    if (Number.isInteger(value) && value >= 1 && value <= 9) return value;
    var code = String(account && account.code || '');
    return /^[1-9]/.test(code) ? Number(code.charAt(0)) : 0;
  }

  function amounts(line) {
    var debit = Number(line && line.debit);
    var credit = Number(line && line.credit);
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0)) return null;
    return { debit: debit, credit: credit };
  }

  function reportLine(accountCode, date, reportLabel, values, provenance) {
    provenance = provenance || {};
    return {
      accountCode: String(accountCode),
      date: date,
      reference: String(provenance.reference || ''),
      debit: Number(values.debit) || 0,
      credit: Number(values.credit) || 0,
      label: String(provenance.label || reportLabel),
      thirdParty: String(provenance.thirdParty || ''),
      dueDate: String(provenance.dueDate || ''),
      sourceDescription: String(provenance.description || ''),
      sourceEntryId: String(provenance.entryId || ''),
      sourceLineKey: String(provenance.lineKey || ''),
      sourceOpeningBalanceId: String(provenance.openingBalanceId || '')
    };
  }

  function buildTransfer(sourceState, sourceDossier, targetDossier, targetAccounts) {
    var errors = [];
    var warnings = [];
    var lines = [];
    var accountBalances = Object.create(null);
    var rowsByAccount = Object.create(null);
    var sourceAccounts = Object.create(null);
    var targetAccountMap = Object.create(null);
    var entries = sourceState && Array.isArray(sourceState.entries) ? sourceState.entries : [];
    var sourceCycleStart = String(sourceState && sourceState.cycleStart || sourceDossier && sourceDossier.cycleStart || '');
    var sourceCycleEnd = String(sourceState && sourceState.cycleEnd || sourceDossier && sourceDossier.cycleEnd || '');
    var targetCycleStart = String(targetDossier && targetDossier.cycleStart || '');
    var reportDate = dayBefore(targetCycleStart);
    var reportLabel = 'Report au ' + targetCycleStart;

    if (!sourceState || !sourceDossier || !targetDossier || !reportDate) {
      return { ok: false, errors: ['Le dossier source, le dossier cible ou leur cycle comptable est invalide.'], warnings: [], rows: [], accountBalances: {}, reportDate: '', totals: { debit: 0, credit: 0, difference: 0 }, balanced: false };
    }
    if (!Array.isArray(sourceState.accounts) || !Array.isArray(sourceState.entries)) errors.push('La base source ne contient pas les registres comptables attendus.');
    if (sourceState.openingBalances !== undefined && !Array.isArray(sourceState.openingBalances)) errors.push('Le registre des reports du dossier source est illisible.');
    if (!isoDate(sourceCycleStart) || !isoDate(sourceCycleEnd) || sourceCycleEnd < sourceCycleStart) errors.push('Le cycle du dossier source est invalide.');
    if (sourceCycleEnd !== dayBefore(targetCycleStart)) errors.push('Le dossier source ne se termine pas la veille du cycle cible : vérifiez qu’il s’agit bien de l’exercice précédent.');
    if (sourceDossier.clientCode !== targetDossier.clientCode || sourceDossier.accountingTypeCode !== targetDossier.accountingTypeCode) {
      errors.push('Le dossier source doit appartenir à la même entreprise et au même type de comptabilité que le dossier cible.');
    }
    if (sourceState.cycleStart && sourceState.cycleStart !== sourceDossier.cycleStart) errors.push('Le cycle enregistré dans la base source ne correspond pas aux métadonnées du dossier.');
    if (sourceState.cycleEnd && sourceState.cycleEnd !== sourceDossier.cycleEnd) errors.push('La date de fin enregistrée dans la base source ne correspond pas aux métadonnées du dossier.');

    (Array.isArray(sourceState.accounts) ? sourceState.accounts : []).forEach(function (account) {
      if (account && account.code != null) sourceAccounts[String(account.code)] = account;
    });
    (Array.isArray(targetAccounts) ? targetAccounts : []).forEach(function (account) {
      if (account && account.code != null) targetAccountMap[String(account.code)] = account;
    });

    function ensureBucket(code, account) {
      if (!rowsByAccount[code]) {
        rowsByAccount[code] = { account: account, sourceLines: [], debit: 0, credit: 0 };
      }
      return rowsByAccount[code];
    }

    function addSourceLine(code, sourceLine, provenance) {
      var sourceAccount = sourceAccounts[code];
      var cls = accountClass(sourceAccount || { code: code });
      if (cls < 1 || cls > 5) return;
      if (!sourceAccount) {
        errors.push('Le compte source ' + code + ' est absent du plan comptable du dossier précédent.');
        return;
      }
      var targetAccount = targetAccountMap[code];
      if (!targetAccount) {
        errors.push('Le compte ' + code + ' existe dans l’exercice précédent mais pas dans le dossier cible ; aucun compte n’a été créé automatiquement.');
        return;
      }
      if (accountClass(targetAccount) !== cls || targetAccount.postable === false) {
        errors.push('Le compte ' + code + ' du dossier cible n’est pas compatible ou imputable pour le report.');
        return;
      }
      var parsed = amounts(sourceLine);
      if (!parsed) {
        errors.push('Une ligne source du compte ' + code + ' contient des montants invalides.');
        return;
      }
      if (!parsed.debit && !parsed.credit) return;
      var bucket = ensureBucket(code, sourceAccount);
      bucket.debit += parsed.debit;
      bucket.credit += parsed.credit;
      if (!Number.isSafeInteger(bucket.debit) || !Number.isSafeInteger(bucket.credit)) errors.push('Le cumul des mouvements du compte ' + code + ' dépasse la précision entière prise en charge.');
      bucket.sourceLines.push({
        debit: parsed.debit,
        credit: parsed.credit,
        reference: String(provenance && provenance.reference || ''),
        description: String(provenance && provenance.description || ''),
        entryId: String(provenance && provenance.entryId || ''),
        lineKey: String(provenance && provenance.lineKey || ''),
        openingBalanceId: String(provenance && provenance.openingBalanceId || ''),
        thirdParty: String(provenance && provenance.thirdParty || ''),
        dueDate: String(provenance && provenance.dueDate || ''),
        label: String(provenance && provenance.label || ''),
        isOpeningBalance: !!(provenance && provenance.openingBalanceId)
      });
    }

    // Un report déjà saisi dans le dossier source constitue son solde d’ouverture.
    var sourceOpeningDate = dayBefore(sourceCycleStart);
    (Array.isArray(sourceState.openingBalances) ? sourceState.openingBalances : []).forEach(function (line) {
      if (!line || typeof line !== 'object' || Array.isArray(line) || !line.accountCode) {
        errors.push('Une ligne du registre des reports source est illisible ; elle ne peut pas être ignorée sans contrôle.');
        return;
      }
      if (!isoDate(line.date) || line.date !== sourceOpeningDate) errors.push('Le report source du compte ' + line.accountCode + ' n’est pas daté de la veille du début de son cycle.');
      var openingAmounts = amounts(line);
      if (!openingAmounts || (!openingAmounts.debit && !openingAmounts.credit)) errors.push('Le report source du compte ' + line.accountCode + ' contient un montant invalide ou nul.');
      addSourceLine(String(line.accountCode), line, {
        reference: line.reference,
        description: line.sourceDescription || line.label,
        label: line.label,
        thirdParty: line.thirdParty,
        dueDate: line.dueDate,
        openingBalanceId: line.id
      });
    });

    entries.forEach(function (entry) {
      if (!entry || entry.status !== 'posted' || String(entry.date || '') < sourceCycleStart || String(entry.date || '') > sourceCycleEnd) return;
      (Array.isArray(entry.lines) ? entry.lines : []).forEach(function (line, lineIndex) {
        if (!line || line.account == null) return;
        var code = String(line.account);
        var sourceAccount = sourceAccounts[code];
        var cls = accountClass(sourceAccount || { code: code });
        if (cls < 1 || cls > 5) return;
        addSourceLine(code, line, {
          reference: entry.reference,
          description: entry.description,
          entryId: entry.id,
          lineKey: String(entry.id) + ':' + lineIndex
        });
      });
    });

    var activeLetteredLines = Object.create(null);
    (Array.isArray(sourceState.matchingGroups) ? sourceState.matchingGroups : []).forEach(function (group) {
      if (!group || group.status === 'cancelled') return;
      (Array.isArray(group.lineKeys) ? group.lineKeys : []).forEach(function (key) { activeLetteredLines[String(key)] = true; });
    });
    var activePointedLines = Object.create(null);
    (Array.isArray(sourceState.pointageMarks) ? sourceState.pointageMarks : []).forEach(function (mark) {
      if (!mark || mark.status === 'cancelled' || !mark.lineKey) return;
      activePointedLines[String(mark.lineKey)] = true;
    });

    Object.keys(rowsByAccount).sort(function (left, right) { return left.localeCompare(right); }).forEach(function (code) {
      var bucket = rowsByAccount[code];
      var sourceAccount = bucket.account || sourceAccounts[code];
      var targetAccount = targetAccountMap[code];
      var cls = accountClass(sourceAccount);
      var balance = bucket.debit - bucket.credit;
      if (!Number.isSafeInteger(balance)) errors.push('Le solde du compte ' + code + ' dépasse la précision entière prise en charge.');
      accountBalances[code] = balance;
      var detailLines = [];

      if (cls === 4 && targetAccount.aux === true) {
        detailLines = bucket.sourceLines.filter(function (line) {
          // Les reports antérieurs n’ont pas de lettrage de pièce dans le registre actuel.
          return line.isOpeningBalance || !activeLetteredLines[line.lineKey];
        });
        var detailBalance = detailLines.reduce(function (sum, line) { return sum + line.debit - line.credit; }, 0);
        if (detailBalance !== balance) {
          errors.push('Le détail non lettré du compte ' + code + ' (' + detailBalance + ') ne correspond pas à son solde de clôture (' + balance + '). Vérifiez les lettrages avant le transfert.');
          return;
        }
      } else if (cls === 5) {
        var pointed = bucket.sourceLines.filter(function (line) { return !!line.lineKey && !!activePointedLines[line.lineKey]; });
        var unpointed = bucket.sourceLines.filter(function (line) { return !line.lineKey || !activePointedLines[line.lineKey]; });
        var pointedDebit = pointed.reduce(function (sum, line) { return sum + line.debit; }, 0);
        var pointedCredit = pointed.reduce(function (sum, line) { return sum + line.credit; }, 0);
        if (pointedDebit || pointedCredit) {
          lines.push(reportLine(code, reportDate, reportLabel + ' · solde des mouvements pointés', { debit: Math.max(0, pointedDebit - pointedCredit), credit: Math.max(0, pointedCredit - pointedDebit) }, {
            description: 'Solde agrégé des mouvements pointés au ' + sourceCycleEnd
          }));
        }
        detailLines = unpointed;
      } else {
        if (balance !== 0) {
          lines.push(reportLine(code, reportDate, reportLabel, { debit: Math.max(0, balance), credit: Math.max(0, -balance) }));
        }
        return;
      }

      detailLines.forEach(function (line) {
        lines.push(reportLine(code, reportDate, reportLabel, { debit: line.debit, credit: line.credit }, {
          reference: line.reference,
          description: line.description,
          entryId: line.entryId,
          lineKey: line.lineKey,
          openingBalanceId: line.openingBalanceId,
          thirdParty: line.thirdParty,
          dueDate: line.dueDate,
          label: line.label || reportLabel
        }));
      });
    });

    var debit = lines.reduce(function (sum, line) { return sum + line.debit; }, 0);
    var credit = lines.reduce(function (sum, line) { return sum + line.credit; }, 0);
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) errors.push('Les totaux du report dépassent la précision entière prise en charge.');
    var difference = debit - credit;
    if (!Object.keys(rowsByAccount).length) warnings.push('Le dossier précédent ne contient aucun mouvement ou report sur les comptes de bilan 1 à 5.');
    warnings.push('Le transfert ne crée aucune écriture. Le calcul reprend les reports enregistrés et les écritures validées ; les brouillons et les comptes de résultat 6 à 8 sont exclus.');
    warnings.push('Les comptes auxiliaires imputables dans le dossier cible sont détaillés à partir des lignes non lettrées disponibles dans la source. Les comptes de trésorerie de classe 5 sont ventilés selon les pointages existants.');
    warnings.push('Les ventilations analytiques, devises, factures non soldées non identifiables dans les pièces et écarts avec le détail des immobilisations restent à contrôler séparément.');
    if (difference !== 0) errors.push('Le report calculé n’est pas équilibré : Débit ' + debit + ', Crédit ' + credit + ', écart ' + difference + '. Le transfert est bloqué ; aucun compte d’équilibre n’est ajouté.');

    return {
      ok: errors.length === 0 && difference === 0,
      errors: errors,
      warnings: warnings,
      rows: lines,
      accountBalances: accountBalances,
      reportDate: reportDate,
      targetDate: targetCycleStart,
      sourceCycleEnd: sourceCycleEnd,
      totals: { debit: debit, credit: credit, difference: difference },
      balanced: difference === 0
    };
  }

  function totals(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var debit = rows.reduce(function (sum, row) { return sum + (Number(row.debit) || 0); }, 0);
    var credit = rows.reduce(function (sum, row) { return sum + (Number(row.credit) || 0); }, 0);
    return { debit: debit, credit: credit, difference: debit - credit, count: rows.length };
  }

  var api = {
    dayBefore: dayBefore,
    accountClass: accountClass,
    buildTransfer: buildTransfer,
    totals: totals
  };
  root.PerfectoOpeningBalances = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));