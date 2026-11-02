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

  function employee(dossierId, employeeId) {
    dossierId = String(dossierId || '');
    employeeId = String(employeeId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.demoEmployees)) return null;
    var match = dossier.demoEmployees.find(function (item) {
      return item && item.id === employeeId && item.dossierId === dossierId;
    });
    return match ? clone(Object.assign({}, match, { employeeNumber: match.employeeNumber || match.id || '' })) : null;
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

  function organizationUnits(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.organizationUnits)) return [];
    return clone(dossier.organizationUnits.filter(function (unit) {
      return unit && unit.dossierId === dossierId && typeof unit.id === 'string';
    }));
  }

  function validateUnitFields(dossier, input, excludedId) {
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var type = String(input.type || '').trim().replace(/\s+/g, ' ');
    var code = String(input.code || '').trim();
    var description = String(input.description || '').trim();
    var effectiveDate = String(input.effectiveDate || '');
    var parentId = String(input.parentId || '').trim();
    var errors = [];
    if (!label) errors.push('Le libellé de l’unité est obligatoire.');
    if (label.length > 120) errors.push('Le libellé ne peut pas dépasser 120 caractères.');
    if (!type) errors.push('Le type d’unité est obligatoire.');
    if (type.length > 40) errors.push('Le type d’unité ne peut pas dépasser 40 caractères.');
    if (code.length > 40) errors.push('Le code d’unité ne peut pas dépasser 40 caractères.');
    if (description.length > 240) errors.push('La description ne peut pas dépasser 240 caractères.');
    if (!dateParts(effectiveDate)) errors.push('La date d’effet doit être une date valide.');
    var units = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    if (code && units.some(function (unit) {
      return unit && unit.id !== excludedId && String(unit.code || '').trim().toLocaleLowerCase() === code.toLocaleLowerCase();
    })) errors.push('Ce code d’unité existe déjà dans ce dossier RH.');
    if (parentId) {
      var parent = units.find(function (unit) { return unit && unit.id === parentId && unit.dossierId === dossier.id; });
      if (!parent) errors.push('L’unité parente doit appartenir au même dossier RH.');
      else if (parent.status !== 'active') errors.push('Une unité archivée ne peut pas être le parent d’une nouvelle structure.');
      else if (parent.id === excludedId) errors.push('Une unité ne peut pas être son propre parent.');
    }
    return { ok: errors.length === 0, errors: errors, value: {
      label: label, type: type, code: code, description: description,
      effectiveDate: effectiveDate, parentId: parentId
    } };
  }

  function createOrganizationUnit(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement une structure synthétique de test.'] };
    dossier.organizationUnits = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    var validation = validateUnitFields(dossier, input);
    if (!validation.ok) return validation;
    var id;
    do { id = 'org-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.organizationUnits.some(function (unit) { return unit && unit.id === id; }));
    var now = new Date().toISOString();
    var unit = Object.assign({
      id: id, dossierId: dossierId, status: 'active',
      history: [{ action: 'created', effectiveDate: validation.value.effectiveDate, changedAt: now }],
      createdAt: now
    }, validation.value);
    dossier.organizationUnits.push(unit);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer l’unité dans le stockage local.'] };
    return { ok: true, errors: [], unit: clone(unit) };
  }

  function updateOrganizationUnit(dossierId, unitId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    unitId = String(unitId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var units = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    var unit = units.find(function (item) { return item && item.id === unitId && item.dossierId === dossierId; });
    if (!unit) return { ok: false, errors: ['Unité introuvable dans ce dossier RH.'] };
    if (unit.status !== 'active') return { ok: false, errors: ['Une unité archivée ne peut pas être modifiée.'] };
    var validation = validateUnitFields(dossier, input, unitId);
    if (!validation.ok) return validation;
    var parentId = validation.value.parentId;
    var seen = Object.create(null);
    while (parentId) {
      if (parentId === unitId) return { ok: false, errors: ['Cette modification créerait un cycle dans l’organigramme.'] };
      if (seen[parentId]) return { ok: false, errors: ['La structure parente contient déjà un cycle ; corrigez-la avant cette modification.'] };
      seen[parentId] = true;
      var parent = units.find(function (candidate) { return candidate && candidate.id === parentId && candidate.dossierId === dossierId; });
      parentId = parent ? String(parent.parentId || '') : '';
    }
    var before = { label: unit.label, type: unit.type, code: unit.code || '', description: unit.description || '', parentId: unit.parentId || '', effectiveDate: unit.effectiveDate };
    var after = validation.value;
    if (!Object.keys(after).some(function (key) { return before[key] !== after[key]; })) {
      return { ok: false, errors: ['Aucun changement à enregistrer.'] };
    }
    unit.history = Array.isArray(unit.history) ? unit.history : [];
    unit.history.push({ action: 'updated', effectiveDate: after.effectiveDate, changedAt: new Date().toISOString(), before: before, after: clone(after) });
    Object.assign(unit, after);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la modification de l’unité.'] };
    return { ok: true, errors: [], unit: clone(unit) };
  }

  function archiveOrganizationUnit(dossierId, unitId, effectiveDate) {
    dossierId = String(dossierId || '');
    unitId = String(unitId || '');
    effectiveDate = String(effectiveDate || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var units = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    var unit = units.find(function (item) { return item && item.id === unitId && item.dossierId === dossierId; });
    if (!unit) return { ok: false, errors: ['Unité introuvable dans ce dossier RH.'] };
    if (unit.status !== 'active') return { ok: false, errors: ['Cette unité est déjà archivée.'] };
    if (!dateParts(effectiveDate)) return { ok: false, errors: ['La date d’archivage doit être valide.'] };
    if (units.some(function (candidate) { return candidate && candidate.dossierId === dossierId && candidate.parentId === unitId && candidate.status === 'active'; })) {
      return { ok: false, errors: ['Déplacez ou archivez d’abord les unités enfants actives.'] };
    }
    unit.status = 'archived';
    unit.archivedAt = effectiveDate;
    unit.history = Array.isArray(unit.history) ? unit.history : [];
    unit.history.push({ action: 'archived', effectiveDate: effectiveDate, changedAt: new Date().toISOString() });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’archiver l’unité dans le stockage local.'] };
    return { ok: true, errors: [], unit: clone(unit) };
  }

  function hrTrackingRecords(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.hrTrackingRecords)) return [];
    return clone(dossier.hrTrackingRecords.filter(function (record) {
      return record && record.dossierId === dossierId && typeof record.id === 'string';
    }));
  }

  function createHRTrackingRecord(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des suivis synthétiques de test.'] };
    var kind = String(input.kind || '');
    var kinds = ['recruitment', 'contract', 'interim', 'departure'];
    var reference = String(input.reference || '').trim();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var date = String(input.date || '');
    var errors = [];
    if (kinds.indexOf(kind) === -1) errors.push('Choisissez un type de suivi disponible.');
    if (!reference) errors.push('La référence synthétique est obligatoire.');
    if (reference.length > 60) errors.push('La référence ne peut pas dépasser 60 caractères.');
    if (!label) errors.push('Le libellé de suivi est obligatoire.');
    if (label.length > 120) errors.push('Le libellé ne peut pas dépasser 120 caractères.');
    if (!dateParts(date)) errors.push('La date de suivi doit être une date valide.');
    dossier.hrTrackingRecords = Array.isArray(dossier.hrTrackingRecords) ? dossier.hrTrackingRecords : [];
    if (reference && dossier.hrTrackingRecords.some(function (record) {
      return record && record.kind === kind && String(record.reference || '').toLocaleLowerCase() === reference.toLocaleLowerCase();
    })) errors.push('Cette référence existe déjà pour ce type de suivi dans le dossier RH.');
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do { id = 'hr-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.hrTrackingRecords.some(function (record) { return record && record.id === id; }));
    var record = { id: id, dossierId: dossierId, kind: kind, reference: reference, label: label,
      date: date, status: 'test-only', createdAt: new Date().toISOString() };
    dossier.hrTrackingRecords.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer ce suivi dans le stockage local.'] };
    return { ok: true, errors: [], record: clone(record) };
  }

  function isDemoTestDossier(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    return !!(dossier && dossier.reference === 'PRH-TEST-2026' && dossier.clientCode === 'TEST' &&
      dossier.clientName === 'Entreprise fictive de test' && Array.isArray(dossier.demoEmployees) &&
      dossier.demoEmployees.length >= 2 && dossier.demoEmployees.every(function (employee) {
        return employee && employee.dossierId === dossier.id && employee.status === 'test-only' && /^EMP-TEST-/.test(employee.id || '');
      }));
  }

  function demoOrganizationSeeded(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    return !!(dossier && dossier.demoOrganizationSeededAt);
  }

  function validDemoEmployee(dossier, employeeId) {
    return Array.isArray(dossier.demoEmployees) && dossier.demoEmployees.some(function (employee) {
      return employee && employee.id === employeeId && employee.dossierId === dossier.id && employee.status === 'test-only';
    });
  }

  function validateTrackingDates(startDate, endDate, label) {
    var errors = [];
    if (!dateParts(startDate)) errors.push('La date de début ' + label + ' doit être valide.');
    if (endDate && !dateParts(endDate)) errors.push('La date de fin ' + label + ' doit être valide.');
    if (dateParts(startDate) && dateParts(endDate) && endDate < startDate) errors.push('La date de fin ' + label + ' ne peut pas précéder la date de début.');
    return errors;
  }

  function organizationAssignments(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.organizationAssignments)) return [];
    return clone(dossier.organizationAssignments.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function createOrganizationAssignment(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des affectations de test.'] };
    var employeeId = String(input.employeeId || '');
    var unitId = String(input.unitId || '');
    var functionLabel = String(input.functionLabel || '').trim().replace(/\s+/g, ' ');
    var startDate = String(input.startDate || '');
    var endDate = String(input.endDate || '');
    var errors = [];
    if (!validDemoEmployee(dossier, employeeId)) errors.push('Choisissez un employé fictif du dossier RH courant.');
    var units = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    if (unitId && !units.some(function (unit) { return unit && unit.id === unitId && unit.dossierId === dossierId && unit.status === 'active'; })) {
      errors.push('L’unité choisie doit être active et appartenir au même dossier RH.');
    }
    if (functionLabel.length > 100) errors.push('La fonction de test ne peut pas dépasser 100 caractères.');
    errors = errors.concat(validateTrackingDates(startDate, endDate, 'd’affectation'));
    if (errors.length) return { ok: false, errors: errors };
    dossier.organizationAssignments = Array.isArray(dossier.organizationAssignments) ? dossier.organizationAssignments : [];
    var id;
    do { id = 'assignment-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.organizationAssignments.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var record = { id: id, dossierId: dossierId, employeeId: employeeId, unitId: unitId,
      functionLabel: functionLabel, startDate: startDate, endDate: endDate, origin: 'test-only',
      history: [{ action: 'created', changedAt: now }], createdAt: now };
    dossier.organizationAssignments.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer l’affectation de test.'] };
    return { ok: true, errors: [], assignment: clone(record) };
  }

  function internalMissions(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.internalMissions)) return [];
    return clone(dossier.internalMissions.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function createInternalMission(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des missions synthétiques de test.'] };
    var employeeId = String(input.employeeId || '');
    var title = String(input.title || '').trim().replace(/\s+/g, ' ');
    var unitId = String(input.unitId || '');
    var startDate = String(input.startDate || '');
    var endDate = String(input.endDate || '');
    var errors = [];
    if (!validDemoEmployee(dossier, employeeId)) errors.push('Choisissez un participant fictif du dossier RH courant.');
    if (!title) errors.push('Le libellé de mission fictive est obligatoire.');
    if (title.length > 120) errors.push('Le libellé de mission ne peut pas dépasser 120 caractères.');
    var units = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    if (unitId && !units.some(function (unit) { return unit && unit.id === unitId && unit.dossierId === dossierId && unit.status === 'active'; })) {
      errors.push('L’unité choisie doit être active et appartenir au même dossier RH.');
    }
    errors = errors.concat(validateTrackingDates(startDate, endDate, 'de mission'));
    if (errors.length) return { ok: false, errors: errors };
    dossier.internalMissions = Array.isArray(dossier.internalMissions) ? dossier.internalMissions : [];
    var id;
    do { id = 'mission-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.internalMissions.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var mission = { id: id, dossierId: dossierId, employeeId: employeeId, unitId: unitId,
      title: title, startDate: startDate, endDate: endDate, origin: 'test-only',
      history: [{ action: 'created', changedAt: now }], createdAt: now };
    dossier.internalMissions.push(mission);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la mission de test.'] };
    return { ok: true, errors: [], mission: clone(mission) };
  }

  function seedDemoOrganizationData(dossierId) {
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le jeu prérempli est réservé au dossier « PRH-TEST-2026 » et à ses fiches employé fictives.'] };
    if (dossier.demoOrganizationSeededAt) return { ok: false, errors: ['Le jeu de démonstration a déjà été chargé dans ce dossier.'] };
    dossier.organizationUnits = Array.isArray(dossier.organizationUnits) ? dossier.organizationUnits : [];
    dossier.organizationAssignments = Array.isArray(dossier.organizationAssignments) ? dossier.organizationAssignments : [];
    dossier.internalMissions = Array.isArray(dossier.internalMissions) ? dossier.internalMissions : [];
    if (dossier.organizationUnits.some(function (unit) { return unit && (unit.code === 'MOCK-UNIT-A' || unit.code === 'MOCK-UNIT-B'); }) ||
        dossier.organizationAssignments.some(function (item) { return item && String(item.id || '').indexOf('mock-assignment-') === 0; }) ||
        dossier.internalMissions.some(function (item) { return item && String(item.id || '').indexOf('mock-mission-') === 0; })) {
      return { ok: false, errors: ['Des données de démonstration similaires existent déjà ; aucune donnée n’a été ajoutée.'] };
    }
    var now = new Date().toISOString();
    var unitA = { id: 'mock-org-unit-a', dossierId: dossierId, label: 'Unité fictive A — DEMO', type: 'Unité de démonstration', code: 'MOCK-UNIT-A', description: '', parentId: '', effectiveDate: '2026-01-01', status: 'active', origin: 'demo-mock', createdAt: now, history: [{ action: 'created', effectiveDate: '2026-01-01', changedAt: now }] };
    var unitB = { id: 'mock-org-unit-b', dossierId: dossierId, label: 'Unité fictive B — DEMO', type: 'Unité de démonstration', code: 'MOCK-UNIT-B', description: '', parentId: '', effectiveDate: '2026-01-01', status: 'active', origin: 'demo-mock', createdAt: now, history: [{ action: 'created', effectiveDate: '2026-01-01', changedAt: now }] };
    dossier.organizationUnits.push(unitA, unitB);
    var employees = dossier.demoEmployees.slice(0, 2);
    dossier.organizationAssignments.push(
      { id: 'mock-assignment-001', dossierId: dossierId, employeeId: employees[0].id, unitId: unitA.id, functionLabel: 'Fonction fictive A — DEMO', startDate: '2026-01-05', endDate: '', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now },
      { id: 'mock-assignment-002', dossierId: dossierId, employeeId: employees[1].id, unitId: unitB.id, functionLabel: 'Fonction fictive B — DEMO', startDate: '2026-02-02', endDate: '', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now }
    );
    dossier.internalMissions.push(
      { id: 'mock-mission-001', dossierId: dossierId, employeeId: employees[0].id, unitId: unitA.id, title: 'Mission synthétique A — DEMO', startDate: '2026-03-10', endDate: '2026-03-12', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now },
      { id: 'mock-mission-002', dossierId: dossierId, employeeId: employees[1].id, unitId: unitB.id, title: 'Mission synthétique B — DEMO', startDate: '2026-04-06', endDate: '2026-04-07', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now }
    );
    dossier.demoOrganizationSeededAt = now;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le jeu de démonstration.'] };
    return { ok: true, errors: [], dossierId: dossierId, organizationUnits: [clone(unitA), clone(unitB)], assignments: clone(dossier.organizationAssignments.slice(-2)), missions: clone(dossier.internalMissions.slice(-2)) };
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
    employee: employee,
    createEmployee: createEmployee,
    organizationUnits: organizationUnits,
    createOrganizationUnit: createOrganizationUnit,
    updateOrganizationUnit: updateOrganizationUnit,
    archiveOrganizationUnit: archiveOrganizationUnit,
    isDemoTestDossier: isDemoTestDossier,
    demoOrganizationSeeded: demoOrganizationSeeded,
    organizationAssignments: organizationAssignments,
    createOrganizationAssignment: createOrganizationAssignment,
    internalMissions: internalMissions,
    createInternalMission: createInternalMission,
    seedDemoOrganizationData: seedDemoOrganizationData,
    hrTrackingRecords: hrTrackingRecords,
    createHRTrackingRecord: createHRTrackingRecord,
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
