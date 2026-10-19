/*
 * PERFECTO · Source interne Ventes, stock & facturation (prototype)
 * Les lots sont produits et conservés localement par dossier client.
 * L'exemple ne calcule ni TVA, ni coût de revient, ni valorisation de stock.
 */
(function (root) {
  'use strict';

  var VERSION = 1;
  var STORAGE_PREFIX = 'perfecto.sales-stock-invoicing.v1.';

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function storageKey(dossierId) {
    return STORAGE_PREFIX + encodeURIComponent(String(dossierId || ''));
  }

  function emptyState(dossierId) {
    return { version: VERSION, dossierId: String(dossierId || ''), runs: [] };
  }

  function validPeriod(period) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''));
  }

  function dateParts(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!match) return null;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? { year: year, month: month, day: day }
      : null;
  }

  function periodForDate(iso) {
    var parts = dateParts(iso);
    return parts ? String(parts.year) + '-' + String(parts.month).padStart(2, '0') : '';
  }

  function periodFitsDossier(period, dossier) {
    if (!validPeriod(period) || !dossier || !dateParts(dossier.cycleStart) || !dateParts(dossier.cycleEnd) || dossier.cycleEnd < dossier.cycleStart) return false;
    return period >= periodForDate(dossier.cycleStart) && period <= periodForDate(dossier.cycleEnd);
  }

  function accountingDateForPeriod(period, dossier) {
    if (!validPeriod(period) || !dossier) return '';
    var parts = period.split('-');
    var end = new Date(Date.UTC(Number(parts[0]), Number(parts[1]), 0)).toISOString().slice(0, 10);
    if (end > dossier.cycleEnd) end = dossier.cycleEnd;
    if (end < dossier.cycleStart) end = dossier.cycleStart;
    return end;
  }

  function load(dossierId) {
    var state = emptyState(dossierId);
    if (!dossierId || !root.localStorage) return state;
    try {
      var raw = root.localStorage.getItem(storageKey(dossierId));
      if (!raw) return state;
      var saved = JSON.parse(raw);
      if (!saved || saved.version !== VERSION || String(saved.dossierId) !== String(dossierId) || !Array.isArray(saved.runs)) return state;
      state.runs = saved.runs.filter(function (run) {
        return run && typeof run.id === 'string' && typeof run.reference === 'string' &&
          run.dossierId === String(dossierId) && (run.status === 'draft' || run.status === 'approved') &&
          validPeriod(run.period) && dateParts(run.date) && periodForDate(run.date) === run.period &&
          Array.isArray(run.accountingLines);
      });
      return state;
    } catch (err) {
      return state;
    }
  }

  function save(state) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(storageKey(state.dossierId), JSON.stringify(state));
      return true;
    } catch (err) {
      return false;
    }
  }

  function validateAccountingLines(lines, requireBalanced) {
    var errors = [];
    if (!Array.isArray(lines) || lines.length < 2) {
      return { ok: false, errors: ['Un lot d’opérations doit contenir au moins deux lignes comptables.'], debit: 0, credit: 0 };
    }
    var debit = 0;
    var credit = 0;
    lines.forEach(function (line, index) {
      line = line || {};
      var code = String(line.accountCode || '').trim();
      var label = String(line.accountLabel || '').trim();
      var d = Number(line.debit);
      var c = Number(line.credit);
      if (!code || code.length > 30) errors.push('Ligne ' + (index + 1) + ' : code de compte source obligatoire (30 caractères maximum).');
      if (!label || label.length > 160) errors.push('Ligne ' + (index + 1) + ' : libellé de compte obligatoire (160 caractères maximum).');
      if (!Number.isSafeInteger(d) || !Number.isSafeInteger(c) || d < 0 || c < 0 || (d > 0 && c > 0) || (d === 0 && c === 0)) {
        errors.push('Ligne ' + (index + 1) + ' : renseignez un débit ou un crédit positif en XOF entier, jamais les deux.');
      }
      debit += Number.isSafeInteger(d) ? d : 0;
      credit += Number.isSafeInteger(c) ? c : 0;
      if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit)) errors.push('Le total comptable dépasse la capacité numérique sûre.');
    });
    if (requireBalanced && debit !== credit) errors.push('Le lot d’opérations n’est pas équilibré : débit ' + debit + ' XOF, crédit ' + credit + ' XOF.');
    return { ok: errors.length === 0, errors: errors, debit: debit, credit: credit };
  }

  function runs(dossierId) {
    return clone(load(dossierId).runs).sort(function (a, b) {
      return String(b.period).localeCompare(String(a.period)) || String(a.reference).localeCompare(String(b.reference));
    });
  }

  function getRun(dossierId, runId) {
    return runs(dossierId).find(function (run) { return run.id === runId; }) || null;
  }

  function createDemoRun(dossier, period) {
    if (!dossier || !dossier.id) return { ok: false, errors: ['Aucun dossier client actif pour créer le lot d’opérations.'] };
    period = String(period || periodForDate(dossier.cycleStart));
    if (!periodFitsDossier(period, dossier)) return { ok: false, errors: ['La période d’opérations doit se situer dans le cycle du dossier actif.'] };
    var state = load(dossier.id);
    var periodToken = period.replace('-', '');
    var reference = 'COM-DEMO-' + periodToken;
    if (state.runs.some(function (run) { return run.reference === reference; })) {
      return { ok: false, errors: ['Un lot fictif existe déjà pour la période ' + period + '.'] };
    }

    var invoiceReference = 'FAC-DEMO-' + periodToken;
    var stockReference = 'REC-DEMO-' + periodToken;
    var run = {
      id: 'commerce-demo-' + encodeURIComponent(String(dossier.id)) + '-' + periodToken,
      dossierId: String(dossier.id),
      reference: reference,
      period: period,
      date: accountingDateForPeriod(period, dossier),
      status: 'draft',
      invoiceCount: 1,
      stockMovementCount: 1,
      totals: { invoicedSales: 1200000, stockPurchases: 600000 },
      accountingLines: [
        { operationType: 'customer-invoice', operationReference: invoiceReference, accountCode: '411', accountLabel: 'Clients', description: 'Facture client fictive · créance', debit: 1200000, credit: 0 },
        { operationType: 'customer-invoice', operationReference: invoiceReference, accountCode: '701', accountLabel: 'Ventes de marchandises', description: 'Facture client fictive · vente', debit: 0, credit: 1200000 },
        { operationType: 'stock-receipt', operationReference: stockReference, accountCode: '601', accountLabel: 'Achats de marchandises', description: 'Réception de stock fictive · achat', debit: 600000, credit: 0 },
        { operationType: 'stock-receipt', operationReference: stockReference, accountCode: '401', accountLabel: 'Fournisseurs, dettes en compte', description: 'Réception de stock fictive · dette fournisseur', debit: 0, credit: 600000 }
      ],
      origin: 'demo',
      calculationNote: 'Montants fictifs : aucun calcul de TVA, de marge, de coût de revient ou de valorisation du stock n’est effectué.',
      createdAt: new Date().toISOString(),
      approvedAt: null
    };
    var lineCheck = validateAccountingLines(run.accountingLines, true);
    if (!lineCheck.ok) return { ok: false, errors: lineCheck.errors };
    state.runs.push(run);
    if (!save(state)) return { ok: false, errors: ['Impossible d’enregistrer le lot dans le stockage local du module Ventes, stock & facturation.'] };
    return { ok: true, errors: [], run: clone(run) };
  }

  function approveRun(dossier, runId) {
    if (!dossier || !dossier.id) return { ok: false, errors: ['Aucun dossier client actif.'] };
    var state = load(dossier.id);
    var run = state.runs.find(function (item) { return item.id === runId; });
    if (!run) return { ok: false, errors: ['Lot d’opérations introuvable dans Ventes, stock & facturation.'] };
    if (run.status !== 'draft') return { ok: false, errors: ['Seul un lot d’opérations en brouillon peut être approuvé.'] };
    if (!periodFitsDossier(run.period, dossier) || periodForDate(run.date) !== run.period || run.date < dossier.cycleStart || run.date > dossier.cycleEnd) {
      return { ok: false, errors: ['La date et la période du lot doivent se situer dans le cycle du dossier actif.'] };
    }
    var lineCheck = validateAccountingLines(run.accountingLines, true);
    if (!lineCheck.ok) return { ok: false, errors: lineCheck.errors };
    run.status = 'approved';
    run.approvedAt = new Date().toISOString();
    if (!save(state)) return { ok: false, errors: ['Impossible d’enregistrer l’approbation du lot dans le stockage local.'] };
    return { ok: true, errors: [], run: clone(run) };
  }

  function sourceId(dossierId, runId) {
    return JSON.stringify(['PERFECTO-VENTES-STOCK-FACTURATION', String(dossierId || ''), String(runId || '')]);
  }

  var api = Object.freeze({
    VERSION: VERSION,
    runs: runs,
    getRun: getRun,
    createDemoRun: createDemoRun,
    approveRun: approveRun,
    sourceId: sourceId,
    validateAccountingLines: validateAccountingLines,
    periodForDate: periodForDate,
    periodFitsDossier: periodFitsDossier
  });

  root.PerfectoSalesOperations = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));