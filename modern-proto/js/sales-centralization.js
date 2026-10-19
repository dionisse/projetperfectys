/*
 * PERFECTO · Centralisation interne Ventes, stock & facturation.
 * Consomme exclusivement les lots approuvés du module maison.
 */
(function (root) {
  'use strict';

  function aggregate(run, accountMap, targetAccounts) {
    var errors = [];
    var warnings = [];
    var errorKeys = Object.create(null);
    var accountLookup = Object.create(null);
    var grouped = Object.create(null);
    var sourceAccounts = Object.create(null);
    var totalDebit = 0;
    var totalCredit = 0;

    function addError(key, message) {
      if (errorKeys[key]) return;
      errorKeys[key] = true;
      errors.push(message);
    }

    if (!run || run.status !== 'approved' || !Array.isArray(run.accountingLines) || !run.accountingLines.length) {
      return { ok: false, errors: ['Seuls les lots approuvés dans Ventes, stock & facturation peuvent être centralisés.'], warnings: [], lines: [], totalDebit: 0, totalCredit: 0, accountMappings: [] };
    }
    (targetAccounts || []).forEach(function (account) { accountLookup[String(account.code)] = account; });
    accountMap = accountMap || Object.create(null);

    run.accountingLines.forEach(function (line, index) {
      line = line || {};
      var sourceCode = String(line.accountCode || '').trim();
      var mappedCode = Object.prototype.hasOwnProperty.call(accountMap, sourceCode)
        ? String(accountMap[sourceCode] || '').trim()
        : sourceCode;
      var target = accountLookup[mappedCode];
      var debit = Number(line.debit);
      var credit = Number(line.credit);
      var rowLabel = String(line.accountLabel || '').trim();
      if (!sourceCode || !mappedCode || !target) {
        addError('unmapped:' + sourceCode, 'Compte source « ' + (sourceCode || 'Ligne ' + (index + 1)) + ' » sans correspondance valide dans le plan comptable du dossier.');
        return;
      }
      if (target.active === false) {
        addError('inactive:' + sourceCode + ':' + mappedCode, 'Le compte cible « ' + mappedCode + ' » est inactif et ne peut pas recevoir ce lot.');
        return;
      }
      if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        addError('amount:' + index, 'Ligne ' + (index + 1) + ' : débit ou crédit XOF invalide dans le journal interne.');
        return;
      }

      var sourceInfo = sourceAccounts[sourceCode];
      if (!sourceInfo) {
        sourceInfo = { sourceCode: sourceCode, sourceLabel: rowLabel, targetCode: mappedCode, targetLabel: target.label || '' };
        sourceAccounts[sourceCode] = sourceInfo;
      } else if (sourceInfo.targetCode !== mappedCode) {
        addError('mapping-conflict:' + sourceCode, 'Le compte source « ' + sourceCode + ' » possède plusieurs correspondances cibles.');
        return;
      } else if (sourceInfo.sourceLabel && rowLabel && sourceInfo.sourceLabel !== rowLabel) {
        addError('label-conflict:' + sourceCode, 'Le libellé du compte source « ' + sourceCode + ' » varie dans le lot.');
        return;
      }

      var group = grouped[mappedCode];
      if (!group) {
        group = { account: mappedCode, accountLabel: target.label || '', debit: 0, credit: 0 };
        grouped[mappedCode] = group;
      }
      group.debit += debit;
      group.credit += credit;
      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isSafeInteger(group.debit) || !Number.isSafeInteger(group.credit) ||
          !Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
        addError('overflow', 'Les totaux du lot dépassent la capacité numérique sûre.');
      }
    });

    if (totalDebit !== totalCredit) addError('unbalanced', 'Le journal interne n’est pas équilibré : débit ' + totalDebit + ' XOF, crédit ' + totalCredit + ' XOF.');

    var lines = [];
    Object.keys(grouped).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (code) {
      var group = grouped[code];
      if (group.debit > 0) lines.push({ account: group.account, accountLabel: group.accountLabel, debit: group.debit, credit: 0 });
      if (group.credit > 0) lines.push({ account: group.account, accountLabel: group.accountLabel, debit: 0, credit: group.credit });
    });
    if (lines.length < 2) addError('line-count', 'La centralisation doit produire au moins deux lignes générales mouvementées.');

    var mappings = Object.keys(sourceAccounts).sort(function (a, b) { return a.localeCompare(b); }).map(function (sourceCode) {
      return sourceAccounts[sourceCode];
    });
    mappings.forEach(function (mapping) {
      if (mapping.sourceCode !== mapping.targetCode && warnings.length < 20) {
        warnings.push('Le compte source « ' + mapping.sourceCode + ' — ' + mapping.sourceLabel + ' » sera associé à « ' + mapping.targetCode + ' — ' + mapping.targetLabel + ' ».');
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
      accountMappings: mappings
    };
  }

  var api = Object.freeze({ aggregate: aggregate });
  root.PerfectoSalesCentralization = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));