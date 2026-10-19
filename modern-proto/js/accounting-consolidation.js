/*
 * PERFECTO · Consolidation pré-résultat en journal groupé, sans écriture nouvelle.
 * Chaque mouvement agrégé garde une provenance vers sa pièce et sa ligne source.
 */
(function (root) {
  'use strict';

  function validIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1]) &&
      date.getUTCMonth() === Number(match[2]) - 1 &&
      date.getUTCDate() === Number(match[3]);
  }

  function consolidate(entries, options) {
    options = options || {};
    entries = Array.isArray(entries) ? entries : [];
    var dateStart = String(options.dateStart || '').trim();
    var dateEnd = String(options.dateEnd || '').trim();
    var cycleStart = String(options.cycleStart || '').trim();
    var cycleEnd = String(options.cycleEnd || '').trim();
    var journalCode = String(options.journalCode || '').trim();
    var accountLookup = Object.create(null);
    var grouped = Object.create(null);
    var errors = [];
    var matchedPostedEntries = 0;
    var excludedDraftEntries = 0;
    var movementCount = 0;
    var totalDebit = 0;
    var totalCredit = 0;

    if (!validIsoDate(dateStart)) errors.push('La date de début de la consolidation est invalide.');
    if (!validIsoDate(dateEnd)) errors.push('La date de fin de la consolidation est invalide.');
    if (validIsoDate(dateStart) && validIsoDate(dateEnd) && dateStart > dateEnd) {
      errors.push('La date de début doit précéder ou égaler la date de fin.');
    }
    if (cycleStart && validIsoDate(cycleStart) && validIsoDate(dateStart) && dateStart < cycleStart) {
      errors.push('La date de début sort du cycle comptable du dossier.');
    }
    if (cycleEnd && validIsoDate(cycleEnd) && validIsoDate(dateEnd) && dateEnd > cycleEnd) {
      errors.push('La date de fin sort du cycle comptable du dossier.');
    }
    (options.accounts || []).forEach(function (account) {
      if (account && account.code) accountLookup[String(account.code)] = account;
    });
    if (errors.length) return emptyResult(dateStart, dateEnd, journalCode, errors);

    entries.forEach(function (entry) {
      if (!entry) return;
      if (!validIsoDate(entry.date)) {
        if (entry.status === 'posted' && (!journalCode || entry.journal === journalCode)) {
          errors.push('La pièce « ' + String(entry.reference || entry.id || 'sans référence') + ' » a une date invalide ; son inclusion ne peut pas être déterminée.');
        }
        return;
      }
      if (entry.date < dateStart || entry.date > dateEnd) return;
      if (journalCode && entry.journal !== journalCode) return;
      if (entry.status === 'draft') {
        excludedDraftEntries += 1;
        return;
      }
      if (entry.status !== 'posted') return;
      matchedPostedEntries += 1;
      if (!Array.isArray(entry.lines) || entry.lines.length < 2) {
        errors.push('La pièce « ' + String(entry.reference || entry.id || 'sans référence') + ' » doit comporter au moins deux lignes exploitables.');
        return;
      }
      var entryDebit = 0;
      var entryCredit = 0;
      entry.lines.forEach(function (line, index) {
        line = line || {};
        var accountCode = String(line.account || '').trim();
        var debit = Number(line.debit);
        var credit = Number(line.credit);
        if (!accountCode || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 ||
            (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
          errors.push('Pièce « ' + String(entry.reference || entry.id || 'sans référence') + ' », ligne ' + (index + 1) + ' : compte ou montant invalide.');
          return;
        }
        entryDebit += debit;
        entryCredit += credit;
        var row = grouped[accountCode];
        if (!row) {
          var account = accountLookup[accountCode];
          row = {
            account: accountCode,
            accountLabel: String((account && account.label) || line.accountLabel || ''),
            debit: 0,
            credit: 0,
            provenance: []
          };
          grouped[accountCode] = row;
        }
        row.debit += debit;
        row.credit += credit;
        totalDebit += debit;
        totalCredit += credit;
        movementCount += 1;
        if (!Number.isSafeInteger(row.debit) || !Number.isSafeInteger(row.credit) ||
            !Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
          errors.push('Les totaux consolidés dépassent la capacité numérique sûre.');
          return;
        }
        var metadata = entry.sourceMetadata || {};
        row.provenance.push({
          entryId: String(entry.id || ''),
          reference: String(entry.reference || ''),
          journal: String(entry.journal || ''),
          date: String(entry.date || ''),
          description: String(entry.description || ''),
          lineNumber: index + 1,
          debit: debit,
          credit: credit,
          sourceSystem: String(entry.sourceSystem || ''),
          sourceId: String(entry.sourceId || ''),
          sourceReference: String(entry.sourceReference || ''),
          sourceModule: String(metadata.sourceModule || metadata.originalSourceModule || ''),
          sourceRunReference: String(metadata.runReference || metadata.originalSourceRunReference || ''),
          originalReference: String(metadata.originalReference || '')
        });
      });
      if (!Number.isSafeInteger(entryDebit) || !Number.isSafeInteger(entryCredit)) {
        errors.push('La pièce « ' + String(entry.reference || entry.id || 'sans référence') + ' » dépasse la capacité numérique sûre.');
      } else if (entryDebit !== entryCredit) {
        errors.push('La pièce « ' + String(entry.reference || entry.id || 'sans référence') + ' » n’est pas équilibrée (débit ' + entryDebit + ' XOF, crédit ' + entryCredit + ' XOF).');
      }
    });

    var rows = Object.keys(grouped).sort(function (a, b) { return a.localeCompare(b); }).map(function (code) {
      var row = grouped[code];
      row.provenance.sort(function (a, b) {
        return a.date.localeCompare(b.date) || a.journal.localeCompare(b.journal) ||
          a.reference.localeCompare(b.reference) || a.lineNumber - b.lineNumber;
      });
      row.provenanceCount = row.provenance.length;
      row.balance = row.debit - row.credit;
      return row;
    });
    return {
      ok: errors.length === 0,
      errors: errors,
      dateStart: dateStart,
      dateEnd: dateEnd,
      journalCode: journalCode,
      entriesCount: matchedPostedEntries,
      excludedDraftEntries: excludedDraftEntries,
      movementCount: movementCount,
      rows: rows,
      totalDebit: totalDebit,
      totalCredit: totalCredit,
      balanced: errors.length === 0 && movementCount > 0 && totalDebit === totalCredit
    };
  }

  function emptyResult(dateStart, dateEnd, journalCode, errors) {
    return {
      ok: false,
      errors: errors,
      dateStart: dateStart,
      dateEnd: dateEnd,
      journalCode: journalCode,
      entriesCount: 0,
      excludedDraftEntries: 0,
      movementCount: 0,
      rows: [],
      totalDebit: 0,
      totalCredit: 0,
      balanced: false
    };
  }

  var api = Object.freeze({ consolidate: consolidate, validIsoDate: validIsoDate });
  root.PerfectoAccountingConsolidation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
