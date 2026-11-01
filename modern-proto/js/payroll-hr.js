/*
 * PERFECTO · Source interne de paie (prototype)
 * Les lots sont produits et conservés localement pour le dossier client actif.
 * Cette première interface ne calcule pas les rémunérations ni les obligations légales.
 */
(function (root) {
  'use strict';

  var VERSION = 1;
  var STORAGE_PREFIX = 'perfecto.payroll.v1.';
  var DOSSIER_CATALOG_KEY = 'perfecto.payroll.dossiers.v1';
  var MONTH_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function storageKey(dossierId) {
    return STORAGE_PREFIX + encodeURIComponent(String(dossierId || ''));
  }

  function emptyDossierCatalog() {
    return { version: 1, dossiers: [], activeDossierId: '' };
  }

  function loadDossierCatalog() {
    if (!root.localStorage) return emptyDossierCatalog();
    try {
      var raw = root.localStorage.getItem(DOSSIER_CATALOG_KEY);
      if (!raw) return emptyDossierCatalog();
      var saved = JSON.parse(raw);
      if (!saved || saved.version !== 1 || !Array.isArray(saved.dossiers)) return emptyDossierCatalog();
      var dossiers = saved.dossiers.filter(function (dossier) {
        return dossier && typeof dossier.id === 'string' && typeof dossier.clientName === 'string' &&
          typeof dossier.clientCode === 'string' && typeof dossier.reference === 'string' &&
          dateParts(dossier.cycleStart) && dateParts(dossier.cycleEnd) && dossier.cycleEnd >= dossier.cycleStart;
      });
      var activeDossierId = dossiers.some(function (dossier) { return dossier.id === saved.activeDossierId; })
        ? String(saved.activeDossierId) : (dossiers[0] && dossiers[0].id || '');
      return { version: 1, dossiers: dossiers, activeDossierId: activeDossierId };
    } catch (err) {
      return emptyDossierCatalog();
    }
  }

  function saveDossierCatalog(catalog) {
    try {
      if (!root.localStorage) return false;
      root.localStorage.setItem(DOSSIER_CATALOG_KEY, JSON.stringify(catalog));
      return true;
    } catch (err) {
      return false;
    }
  }

  function dossiers() {
    return clone(loadDossierCatalog().dossiers);
  }

  function currentDossier() {
    var catalog = loadDossierCatalog();
    return clone(catalog.dossiers.find(function (dossier) { return dossier.id === catalog.activeDossierId; }) || null);
  }

  function dossierById(dossierId) {
    return clone(loadDossierCatalog().dossiers.find(function (dossier) { return dossier.id === String(dossierId || ''); }) || null);
  }

  function selectDossier(dossierId) {
    var catalog = loadDossierCatalog();
    dossierId = String(dossierId || '');
    if (!catalog.dossiers.some(function (dossier) { return dossier.id === dossierId; })) {
      return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    }
    catalog.activeDossierId = dossierId;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de mémoriser le dossier Paie & RH actif dans le stockage local.'] };
    return { ok: true, errors: [], dossier: currentDossier() };
  }

  function createDossier(input) {
    input = input || {};
    var clientName = String(input.clientName || input.name || '').trim().replace(/\s+/g, ' ');
    var clientCode = String(input.clientCode || '').trim().toLocaleUpperCase().replace(/\s+/g, '');
    var cycleStart = String(input.cycleStart || '');
    var cycleEnd = String(input.cycleEnd || '');
    var start = dateParts(cycleStart);
    var end = dateParts(cycleEnd);
    var errors = [];
    if (!clientName) errors.push('Le nom de l’entreprise cliente est obligatoire.');
    if (clientName.length > 120) errors.push('Le nom de l’entreprise ne peut pas dépasser 120 caractères.');
    if (!/^[A-Z0-9]{2,8}$/.test(clientCode)) errors.push('Le sigle du dossier doit contenir de 2 à 8 lettres ou chiffres.');
    if (!start || !end || cycleEnd < cycleStart) errors.push('Le cycle d’exercice doit préciser des dates valides, dans l’ordre chronologique.');
    if (start && end && (end.year - start.year) * 12 + end.month - start.month + 1 > 18) {
      errors.push('Le cycle d’exercice ne peut pas dépasser 18 mois dans cette version.');
    }
    var exerciseYear = start ? start.year : 0;
    var reference = clientCode ? 'PRH-' + clientCode + '-' + (exerciseYear || '') : '';
    var catalog = loadDossierCatalog();
    if (reference && catalog.dossiers.some(function (dossier) { return dossier.reference.toLocaleLowerCase() === reference.toLocaleLowerCase(); })) {
      errors.push('La référence « ' + reference + ' » existe déjà. Choisissez un autre sigle ou un autre exercice.');
    }
    var accountingDossierId = String(input.accountingDossierId || '').trim();
    if (accountingDossierId.length > 160) errors.push('L’identifiant du dossier comptable associé est invalide.');
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do {
      id = 'prh-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    } while (catalog.dossiers.some(function (dossier) { return dossier.id === id; }));
    var dossier = {
      id: id,
      clientName: clientName,
      name: clientName,
      clientCode: clientCode,
      reference: reference,
      exerciseYear: exerciseYear,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      address: String(input.address || '').trim().slice(0, 240),
      ifu: String(input.ifu || '').trim().slice(0, 40),
      rccm: String(input.rccm || '').trim().slice(0, 60),
      email: String(input.email || '').trim().slice(0, 254),
      phone: String(input.phone || '').trim().slice(0, 40),
      accountingDossierId: accountingDossierId,
      createdAt: new Date().toISOString()
    };
    catalog.dossiers.push(dossier);
    catalog.activeDossierId = id;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Création impossible : le stockage local est indisponible ou plein. Aucun dossier Paie & RH n’a été enregistré.'] };
    return { ok: true, errors: [], dossier: clone(dossier) };
  }

  function updateAccountingDossierLink(dossierId, accountingDossierId) {
    var catalog = loadDossierCatalog();
    dossierId = String(dossierId || '');
    accountingDossierId = String(accountingDossierId || '').trim();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (accountingDossierId.length > 160) return { ok: false, errors: ['Identifiant de dossier comptable invalide.'] };
    dossier.accountingDossierId = accountingDossierId;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le lien explicite avec la Comptabilité générale.'] };
    return { ok: true, errors: [], dossier: clone(dossier) };
  }

  function emptyState(dossierId) {
    return { version: VERSION, dossierId: String(dossierId || ''), runs: [] };
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

  function monthEnd(period) {
    if (!validPeriod(period)) return '';
    var parts = period.split('-');
    return new Date(Date.UTC(Number(parts[0]), Number(parts[1]), 0)).toISOString().slice(0, 10);
  }

  function periodFitsDossier(period, dossier) {
    if (!validPeriod(period) || !dossier || !dateParts(dossier.cycleStart) || !dateParts(dossier.cycleEnd) || dossier.cycleEnd < dossier.cycleStart) return false;
    var firstMonth = periodForDate(dossier.cycleStart);
    var lastMonth = periodForDate(dossier.cycleEnd);
    return period >= firstMonth && period <= lastMonth;
  }

  function accountingDateForPeriod(period, dossier) {
    var end = monthEnd(period);
    if (!end || !dossier) return '';
    if (end > dossier.cycleEnd) end = dossier.cycleEnd;
    if (end < dossier.cycleStart) end = dossier.cycleStart;
    return end;
  }

  function validateAccountingLines(lines, requireBalanced) {
    var errors = [];
    if (!Array.isArray(lines) || lines.length < 2) return { ok: false, errors: ['Un lot de paie doit contenir au moins deux lignes comptables.'], debit: 0, credit: 0 };
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
    if (requireBalanced && debit !== credit) errors.push('Le lot de paie n’est pas équilibré : débit ' + debit + ' XOF, crédit ' + credit + ' XOF.');
    return { ok: errors.length === 0, errors: errors, debit: debit, credit: credit };
  }

  function demoAccountingLines() {
    return [
      { accountCode: '641', accountLabel: 'Rémunérations du personnel', description: 'Rémunérations brutes · exemple', debit: 750000, credit: 0 },
      { accountCode: '421', accountLabel: 'Personnel, rémunérations dues', description: 'Net à payer · exemple', debit: 0, credit: 675000 },
      { accountCode: '431', accountLabel: 'Organismes sociaux', description: 'Retenues sociales · exemple', debit: 0, credit: 75000 }
    ];
  }

  function accountingAccountCatalog() {
    var seen = Object.create(null);
    return demoAccountingLines().filter(function (line) {
      if (seen[line.accountCode]) return false;
      seen[line.accountCode] = true;
      return true;
    }).map(function (line) {
      return { code: line.accountCode, label: line.accountLabel, postable: true, active: true };
    });
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
    if (!dossier || !dossier.id) return { ok: false, errors: ['Aucun dossier client actif pour créer le lot de paie.'] };
    period = String(period || periodForDate(dossier.cycleStart));
    if (!periodFitsDossier(period, dossier)) return { ok: false, errors: ['La période de paie doit se situer dans le cycle du dossier actif.'] };
    var state = load(dossier.id);
    var periodToken = period.replace('-', '');
    var reference = 'PAIE-DEMO-' + periodToken;
    if (state.runs.some(function (run) { return run.reference === reference; })) {
      return { ok: false, errors: ['Un lot de démonstration existe déjà pour la période ' + period + '.'] };
    }
    var date = accountingDateForPeriod(period, dossier);
    var run = {
      id: 'paie-demo-' + encodeURIComponent(String(dossier.id)) + '-' + periodToken,
      dossierId: String(dossier.id),
      reference: reference,
      period: period,
      date: date,
      status: 'draft',
      employeeCount: 3,
      totals: { grossPay: 750000, deductions: 75000, netPay: 675000 },
      accountingLines: demoAccountingLines(),
      origin: 'demo',
      calculationNote: 'Montants fictifs de démonstration : aucun calcul de paie, de cotisation ou de retenue légale n’est effectué.',
      createdAt: new Date().toISOString(),
      approvedAt: null
    };
    var lineCheck = validateAccountingLines(run.accountingLines, true);
    if (!lineCheck.ok) return { ok: false, errors: lineCheck.errors };
    state.runs.push(run);
    if (!save(state)) return { ok: false, errors: ['Impossible d’enregistrer le lot Paie & RH dans le stockage local.'] };
    return { ok: true, errors: [], run: clone(run) };
  }

  function approveRun(dossier, runId) {
    if (!dossier || !dossier.id) return { ok: false, errors: ['Aucun dossier client actif.'] };
    var state = load(dossier.id);
    var run = state.runs.find(function (item) { return item.id === runId; });
    if (!run) return { ok: false, errors: ['Lot de paie introuvable dans Paie & RH.'] };
    if (run.status !== 'draft') return { ok: false, errors: ['Seul un lot de paie en brouillon peut être approuvé.'] };
    if (!periodFitsDossier(run.period, dossier) || periodForDate(run.date) !== run.period || run.date < dossier.cycleStart || run.date > dossier.cycleEnd) {
      return { ok: false, errors: ['La date et la période du lot doivent se situer dans le cycle du dossier actif.'] };
    }
    var lineCheck = validateAccountingLines(run.accountingLines, true);
    if (!lineCheck.ok) return { ok: false, errors: lineCheck.errors };
    run.status = 'approved';
    run.approvedAt = new Date().toISOString();
    if (!save(state)) return { ok: false, errors: ['Impossible d’enregistrer l’approbation dans le stockage local.'] };
    return { ok: true, errors: [], run: clone(run) };
  }

  function sourceId(dossierId, runId) {
    return JSON.stringify(['PERFECTO-PAIE-RH', String(dossierId || ''), String(runId || '')]);
  }

  var api = Object.freeze({
    VERSION: VERSION,
    dossiers: dossiers,
    currentDossier: currentDossier,
    dossier: dossierById,
    createDossier: createDossier,
    selectDossier: selectDossier,
    updateAccountingDossierLink: updateAccountingDossierLink,
    runs: runs,
    getRun: getRun,
    accountingAccountCatalog: accountingAccountCatalog,
    createDemoRun: createDemoRun,
    approveRun: approveRun,
    sourceId: sourceId,
    validateAccountingLines: validateAccountingLines,
    periodForDate: periodForDate,
    periodFitsDossier: periodFitsDossier
  });

  root.PerfectoPayrollHR = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
