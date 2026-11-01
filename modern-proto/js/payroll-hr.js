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
      var migratedEmployeeLinks = false;
      var dossiers = saved.dossiers.filter(function (dossier) {
        return dossier && typeof dossier.id === 'string' && typeof dossier.clientName === 'string' &&
          typeof dossier.clientCode === 'string' && typeof dossier.reference === 'string' &&
          dateParts(dossier.cycleStart) && dateParts(dossier.cycleEnd) && dossier.cycleEnd >= dossier.cycleStart;
      }).map(function (dossier) {
        var employees = Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees.map(function (employee) {
          if (!employee || employee.dossierId !== dossier.id) migratedEmployeeLinks = true;
          return Object.assign({}, employee, { dossierId: dossier.id });
        }) : [];
        return Object.assign({}, dossier, { demoEmployees: employees });
      });
      var activeDossierId = dossiers.some(function (dossier) { return dossier.id === saved.activeDossierId; })
        ? String(saved.activeDossierId) : (dossiers[0] && dossiers[0].id || '');
      var catalog = { version: 1, dossiers: dossiers, activeDossierId: activeDossierId };
      if (migratedEmployeeLinks) saveDossierCatalog(catalog);
      return catalog;
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

  function employees(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.demoEmployees)) return [];
    return clone(dossier.demoEmployees.filter(function (employee) { return employee && employee.dossierId === dossierId; }).map(function (employee) {
      return Object.assign({}, employee, { employeeNumber: employee.employeeNumber || employee.id || '' });
    }));
  }

  function createEmployee(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des fiches synthétiques de test.'] };
    var employeeNumber = String(input.employeeNumber || '').trim();
    var displayName = String(input.displayName || '').trim().replace(/\s+/g, ' ');
    var errors = [];
    if (!employeeNumber) errors.push('Le numéro employé interne est obligatoire.');
    if (employeeNumber.length > 40) errors.push('Le numéro employé ne peut pas dépasser 40 caractères.');
    if (!displayName) errors.push('Le nom d’affichage est obligatoire pour cette fiche de test.');
    if (displayName.length > 120) errors.push('Le nom d’affichage ne peut pas dépasser 120 caractères.');
    var current = Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees : [];
    if (employeeNumber && current.some(function (employee) {
      return String(employee && (employee.employeeNumber || employee.id) || '').trim().toLocaleLowerCase() === employeeNumber.toLocaleLowerCase();
    })) errors.push('Ce numéro employé existe déjà dans ce dossier Paie & RH.');
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do {
      id = 'emp-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    } while (current.some(function (employee) { return employee && employee.id === id; }));
    var employee = {
      id: id,
      dossierId: dossierId,
      employeeNumber: employeeNumber,
      displayName: displayName,
      status: 'test-only',
      createdAt: new Date().toISOString()
    };
    dossier.demoEmployees = current.concat([employee]);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fiche fictive dans le stockage local.'] };
    return { ok: true, errors: [], employee: clone(employee) };
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
    var demoEmployees = input.includeTenTestEmployees === true
      ? Array.from({ length: 10 }, function (_, index) {
        var number = String(index + 1).padStart(3, '0');
        return { id: 'EMP-TEST-' + number, dossierId: id, displayName: 'Employé fictif ' + number, status: 'test-only' };
      })
      : [];
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
      demoEmployees: demoEmployees,
      createdAt: new Date().toISOString()
    };
    catalog.dossiers.push(dossier);
    catalog.activeDossierId = id;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Création impossible : le stockage local est indisponible ou plein. Aucun dossier Paie & RH n’a été enregistré.'] };
    return { ok: true, errors: [], dossier: clone(dossier) };
  }

  function createTestDossier() {
    return createDossier({
      clientName: 'Entreprise fictive de test',
      clientCode: 'TEST',
      cycleStart: '2026-01-01',
      cycleEnd: '2026-12-31',
      includeTenTestEmployees: true
    });
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
          run.dossierId === String(dossierId) && run.origin !== 'demo' && (run.status === 'draft' || run.status === 'approved') &&
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

  function accountingAccountCatalog() {
    // Aucune rubrique ni correspondance comptable n’est présumée par défaut.
    return [];
  }


  function runs(dossierId) {
    return clone(load(dossierId).runs).sort(function (a, b) {
      return String(b.period).localeCompare(String(a.period)) || String(a.reference).localeCompare(String(b.reference));
    });
  }

  function getRun(dossierId, runId) {
    return runs(dossierId).find(function (run) { return run.id === runId; }) || null;
  }

  function createDemoRun() {
    return { ok: false, errors: ['La création de lots fictifs avec montants ou comptes inventés est désactivée. Un lot réel exige des données source et des règles validées.'] };
  }

  function approveRun() {
    return { ok: false, errors: ['L’approbation est désactivée tant qu’un calcul reproductible et des règles applicables validées ne sont pas disponibles.'] };
  }

  function sourceId(dossierId, runId) {
    return JSON.stringify(['PERFECTO-PAIE-RH', String(dossierId || ''), String(runId || '')]);
  }

  var api = Object.freeze({
    VERSION: VERSION,
    dossiers: dossiers,
    currentDossier: currentDossier,
    dossier: dossierById,
    employees: employees,
    createEmployee: createEmployee,
    createDossier: createDossier,
    createTestDossier: createTestDossier,
    selectDossier: selectDossier,
    updateAccountingDossierLink: updateAccountingDossierLink,
    runs: runs,
    getRun: getRun,
    accountingAccountCatalog: accountingAccountCatalog,
    createDemoRun: createDemoRun,
    approveRun: approveRun,
    sourceId: sourceId,
    periodForDate: periodForDate,
    periodFitsDossier: periodFitsDossier
  });

  root.PerfectoPayrollHR = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
