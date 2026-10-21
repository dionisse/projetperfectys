/*
 * PERFECTO · Agrégateur de centralisation auxiliaire interne.
 * Applique la règle de Comptabilité générale : regrouper les opérations réelles
 * des comptes auxiliaires par compte collectif cible. Ne lit aucun fichier et
 * ne modifie pas le dossier ; le module source doit fournir un lot contrôlé.
 */
(function (root) {
  'use strict';

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

  var api = { aggregate: aggregate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PerfectoAccountingCentralization = api;
}(typeof window !== 'undefined' ? window : globalThis));
