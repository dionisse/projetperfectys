/*
 * PERFECTO · Recalcul indépendant des soldes depuis les mouvements validés.
 * Aucun solde n'est persisté par cette opération ; le grand livre est en lecture seule.
 */
(function (root) {
  'use strict';

  function validIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function recalculate(entries, accounts, options) {
    entries = Array.isArray(entries) ? entries : [];
    accounts = Array.isArray(accounts) ? accounts : [];
    options = options || {};
    var cycleStart = String(options.cycleStart || '').trim();
    var cycleEnd = String(options.cycleEnd || '').trim();
    var accountLookup = Object.create(null);
    var grouped = Object.create(null);
    var unknownAccounts = Object.create(null);
    var errors = [];
    var postedEntriesCount = 0;
    var excludedDraftCount = 0;
    var outsideCyclePostedCount = 0;
    var outsideCycleEntries = [];
    var movementCount = 0;
    var totalDebit = 0;
    var totalCredit = 0;

    if (!validIsoDate(cycleStart) || !validIsoDate(cycleEnd) || cycleEnd < cycleStart) {
      return emptyResult(cycleStart, cycleEnd, ['Le cycle comptable du dossier est invalide.']);
    }

    accounts.forEach(function (account) {
      if (account && account.code) accountLookup[String(account.code)] = account;
    });

    entries.forEach(function (entry) {
      if (!entry || (entry.status !== 'posted' && entry.status !== 'draft')) return;
      if (!validIsoDate(entry.date)) {
        if (entry.status === 'posted') {
          errors.push('La pièce validée « ' + String(entry.reference || entry.id || 'sans référence') + ' » a une date invalide.');
        }
        return;
      }
      if (entry.date < cycleStart || entry.date > cycleEnd) {
        if (entry.status === 'posted') {
          outsideCyclePostedCount += 1;
          outsideCycleEntries.push({
            id: String(entry.id || ''),
            reference: String(entry.reference || entry.id || 'sans référence'),
            date: entry.date
          });
        }
        return;
      }
      if (entry.status === 'draft') {
        excludedDraftCount += 1;
        return;
      }

      postedEntriesCount += 1;
      var entryLabel = String(entry.reference || entry.id || 'sans référence');
      if (!Array.isArray(entry.lines) || entry.lines.length < 2) {
        errors.push('La pièce validée « ' + entryLabel + ' » ne comporte pas au moins deux lignes.');
        return;
      }
      var entryDebit = 0;
      var entryCredit = 0;
      entry.lines.forEach(function (line, index) {
        line = line || {};
        var code = String(line.account || '').trim();
        var debit = Number(line.debit);
        var credit = Number(line.credit);
        if (!code || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 ||
            (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          errors.push('Pièce validée « ' + entryLabel + ' », ligne ' + (index + 1) + ' : compte ou montant invalide.');
          return;
        }

        entryDebit += debit;
        entryCredit += credit;
        var account = accountLookup[code];
        if (!account) unknownAccounts[code] = true;
        var row = grouped[code];
        if (!row) {
          row = {
            code: code,
            label: String((account && account.label) || line.accountLabel || 'Compte absent du plan comptable'),
            debit: 0,
            credit: 0,
            movementCount: 0
          };
          grouped[code] = row;
        }
        row.debit += debit;
        row.credit += credit;
        row.movementCount += 1;
        totalDebit += debit;
        totalCredit += credit;
        movementCount += 1;
        if (!Number.isSafeInteger(entryDebit) || !Number.isSafeInteger(entryCredit) ||
            !Number.isSafeInteger(row.debit) || !Number.isSafeInteger(row.credit) ||
            !Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
          errors.push('La pièce ou les soldes recalculés dépassent la capacité numérique sûre.');
          return;
        }
      });
      if (!Number.isSafeInteger(entryDebit) || !Number.isSafeInteger(entryCredit)) {
        errors.push('La pièce validée « ' + entryLabel + ' » dépasse la capacité numérique sûre.');
      } else if (entryDebit !== entryCredit) {
        errors.push('La pièce validée « ' + entryLabel + ' » n’est pas équilibrée (débit ' + entryDebit + ' XOF, crédit ' + entryCredit + ' XOF).');
      }
    });

    var rows = Object.keys(grouped).sort(function (a, b) { return a.localeCompare(b); }).map(function (code) {
      var row = grouped[code];
      row.balance = row.debit - row.credit;
      row.debitBalance = Math.max(0, row.balance);
      row.creditBalance = Math.max(0, -row.balance);
      return row;
    });
    var warnings = [];
    if (outsideCyclePostedCount) {
      var outsideReferences = outsideCycleEntries.map(function (entry) { return entry.reference + ' (' + entry.date + ')'; });
      warnings.push(outsideCyclePostedCount + ' pièce(s) validée(s) hors cycle ignorée(s), comme dans la balance générale du dossier : ' + outsideReferences.join(', ') + '.');
    }
    var unknownCodes = Object.keys(unknownAccounts).sort(function (a, b) { return a.localeCompare(b); });
    if (unknownCodes.length) {
      warnings.push('Compte(s) absent(s) du plan comptable mais présent(s) dans des écritures : ' + unknownCodes.join(', ') + '.');
    }

    return {
      ok: errors.length === 0,
      errors: errors,
      warnings: warnings,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      entriesCount: postedEntriesCount,
      excludedDraftCount: excludedDraftCount,
      outsideCyclePostedCount: outsideCyclePostedCount,
      outsideCycleEntries: outsideCycleEntries,
      unknownAccounts: unknownCodes,
      movementCount: movementCount,
      rows: rows,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      balanced: errors.length === 0 && movementCount > 0 && totalDebit === totalCredit
    };
  }

  function compareBalances(recalculatedRows, currentRows) {
    var recalculated = Object.create(null);
    var current = Object.create(null);
    (recalculatedRows || []).forEach(function (row) {
      if (row && row.code) recalculated[String(row.code)] = row;
    });
    (currentRows || []).forEach(function (row) {
      if (row && row.code) current[String(row.code)] = row;
    });
    var codes = Object.keys(recalculated);
    Object.keys(current).forEach(function (code) {
      if (codes.indexOf(code) === -1) codes.push(code);
    });
    codes.sort(function (a, b) { return a.localeCompare(b); });
    var differences = [];
    codes.forEach(function (code) {
      var recalculatedRow = recalculated[code] || { debit: 0, credit: 0 };
      var currentRow = current[code] || { debit: 0, credit: 0 };
      var recalculatedDebit = Number(recalculatedRow.debit);
      var recalculatedCredit = Number(recalculatedRow.credit);
      var currentDebit = Number(currentRow.debit);
      var currentCredit = Number(currentRow.credit);
      if (recalculatedDebit !== currentDebit || recalculatedCredit !== currentCredit) {
        differences.push({
          code: code,
          label: String(recalculatedRow.label || currentRow.label || ''),
          recalculatedDebit: recalculatedDebit,
          recalculatedCredit: recalculatedCredit,
          currentDebit: currentDebit,
          currentCredit: currentCredit
        });
      }
    });
    return { ok: differences.length === 0, differences: differences };
  }

  function emptyResult(cycleStart, cycleEnd, errors) {
    return {
      ok: false,
      errors: errors,
      warnings: [],
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      entriesCount: 0,
      excludedDraftCount: 0,
      outsideCyclePostedCount: 0,
      outsideCycleEntries: [],
      unknownAccounts: [],
      movementCount: 0,
      rows: [],
      totalDebit: 0,
      totalCredit: 0,
      balanced: false
    };
  }

  var api = Object.freeze({ recalculate: recalculate, compareBalances: compareBalances, validIsoDate: validIsoDate });
  root.PerfectoBalanceRecalculation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
