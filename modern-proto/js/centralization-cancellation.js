/*
 * PERFECTO · Annulation contrôlée des centralisations internes.
 * Les pièces validées restent intactes : leur annulation crée une écriture inverse.
 */
(function (root) {
  'use strict';

  var INTERNAL_SOURCES = Object.freeze({
    'PERFECTO-PAIE-RH': 'payroll-hr',
    'PERFECTO-VENTES-STOCK-FACTURATION': 'sales-stock-invoicing'
  });
  var CANCELLATION_SOURCE = 'PERFECTO-ANNULATION-CENTRALISATION';

  function sourceModuleForEntry(entry) {
    if (!entry || !entry.sourceSystem || !entry.sourceMetadata || entry.sourceMetadata.feed !== 'internal') return null;
    var expectedModule = INTERNAL_SOURCES[String(entry.sourceSystem)];
    if (!expectedModule || entry.sourceMetadata.sourceModule !== expectedModule) return null;
    return expectedModule;
  }

  function isInternalCentralization(entry) {
    return !!sourceModuleForEntry(entry) && !!String(entry.sourceId || '').trim();
  }

  function isCancellationEntry(entry) {
    return !!entry && entry.sourceSystem === CANCELLATION_SOURCE &&
      !!entry.sourceMetadata && entry.sourceMetadata.operation === 'centralization-reversal' &&
      !!String(entry.sourceMetadata.originalEntryId || '').trim();
  }

  function findReversal(entries, original) {
    if (!original || !original.id || !Array.isArray(entries)) return null;
    return entries.find(function (entry) {
      return isCancellationEntry(entry) && entry.sourceMetadata.originalEntryId === original.id;
    }) || null;
  }

  function buildReversalEntry(original, target) {
    var errors = [];
    target = target || {};
    var sourceModule = sourceModuleForEntry(original);
    if (!original || original.status !== 'posted') errors.push('Seules les centralisations internes déjà validées peuvent recevoir une écriture inverse.');
    if (!sourceModule) errors.push('La pièce sélectionnée ne provient pas d’une centralisation interne Paie & RH ou Ventes, stock & facturation.');
    if (!original || !String(original.id || '').trim()) errors.push('La pièce d’origine ne possède pas d’identifiant stable.');

    var reference = String(target.reference || '').trim();
    var journal = String(target.journal || '').trim();
    var date = String(target.date || '').trim();
    var reason = String(target.reason || '').trim();
    if (!reference) errors.push('La référence de l’écriture d’annulation est obligatoire.');
    if (!journal) errors.push('Le journal de l’écriture d’annulation est obligatoire.');
    if (!reason) errors.push('Le motif de l’annulation est obligatoire pour assurer la traçabilité.');
    if (reason.length > 250) errors.push('Le motif de l’annulation ne peut pas dépasser 250 caractères.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('La date de l’écriture d’annulation doit être une date valide.');

    var lines = [];
    var totalDebit = 0;
    var totalCredit = 0;
    var originalLines = original && Array.isArray(original.lines) ? original.lines : [];
    if (originalLines.length < 2) errors.push('La pièce d’origine ne contient pas assez de lignes pour former une écriture inverse.');
    originalLines.forEach(function (line, index) {
      line = line || {};
      var account = String(line.account || '').trim();
      var debit = Number(line.debit);
      var credit = Number(line.credit);
      if (!account || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 ||
          (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        errors.push('La ligne ' + (index + 1) + ' de la pièce d’origine contient un compte ou un montant non valide.');
        return;
      }
      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isSafeInteger(totalDebit) || !Number.isSafeInteger(totalCredit)) {
        errors.push('Les totaux de la pièce d’origine dépassent la capacité numérique sûre.');
        return;
      }
      lines.push({
        account: account,
        accountLabel: String(line.accountLabel || line.sourceAccountLabel || '').trim(),
        debit: credit,
        credit: debit
      });
    });
    if (totalDebit !== totalCredit) errors.push('La pièce d’origine n’est pas équilibrée ; aucune écriture inverse ne peut être préparée.');
    if (lines.length < 2) errors.push('L’écriture inverse doit contenir au moins deux lignes valides.');
    if (errors.length) return { ok: false, errors: errors, entry: null };

    var metadata = original.sourceMetadata || {};
    return {
      ok: true,
      errors: [],
      entry: {
        reference: reference,
        journal: journal,
        date: date,
        description: 'Annulation de la centralisation ' + String(original.reference || original.id) + ' — ' + reason,
        sourceSystem: CANCELLATION_SOURCE,
        sourceId: JSON.stringify([CANCELLATION_SOURCE, original.id]),
        sourceStatus: 'posted',
        sourceMetadata: {
          feed: 'internal',
          operation: 'centralization-reversal',
          reversalMethod: 'opposite-lines',
          cancellationReason: reason,
          originalEntryId: original.id,
          originalReference: String(original.reference || ''),
          originalSourceSystem: String(original.sourceSystem || ''),
          originalSourceId: String(original.sourceId || ''),
          originalSourceModule: sourceModule,
          originalSourceRunId: String(metadata.runId || ''),
          originalSourceRunReference: String(metadata.runReference || ''),
          originalPeriod: String(metadata.period || ''),
          originalDate: String(original.date || ''),
          originalJournal: String(original.journal || '')
        },
        lines: lines
      }
    };
  }

  var api = Object.freeze({
    INTERNAL_SOURCES: INTERNAL_SOURCES,
    CANCELLATION_SOURCE: CANCELLATION_SOURCE,
    sourceModuleForEntry: sourceModuleForEntry,
    isInternalCentralization: isInternalCentralization,
    isCancellationEntry: isCancellationEntry,
    findReversal: findReversal,
    buildReversalEntry: buildReversalEntry
  });
  root.PerfectoCentralizationCancellation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
