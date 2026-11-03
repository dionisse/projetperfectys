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
    var requestedEmployeeStatus = String(input.employeeStatus || '').trim();
    var availableEmployeeStatuses = Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
    var matchingEmployeeStatus = availableEmployeeStatuses.find(function (item) {
      return item && (item.id === requestedEmployeeStatus || String(item.code || '').toLocaleLowerCase() === requestedEmployeeStatus.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedEmployeeStatus.toLocaleLowerCase());
    });
    var requestedCategoryId = String(input.categoryId || input.categoryStep || '').trim();
    var availableEmployeeCategories = Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : [];
    var matchingEmployeeCategory = availableEmployeeCategories.find(function (item) {
      return item && (item.id === requestedCategoryId || String(item.code || '').toLocaleLowerCase() === requestedCategoryId.toLocaleLowerCase());
    });
    var requestedEmployeeServiceId = String(input.serviceId || input.service || '').trim();
    var requestedEmployeeFunctionValues = Array.isArray(input.functionIds)
      ? input.functionIds.map(function (value) { return String(value || '').trim(); }).filter(Boolean)
      : [String(input.functionId || input.function || '').trim()].filter(Boolean);
    var availableEmployeeFunctions = Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : [];
    var matchingEmployeeFunctions = requestedEmployeeFunctionValues.map(function (requestedFunction) {
      return availableEmployeeFunctions.find(function (item) {
        return item && (item.id === requestedFunction || String(item.code || '').toLocaleLowerCase() === requestedFunction.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedFunction.toLocaleLowerCase());
      });
    });
    var availableEmployeeServices = Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
    var matchingEmployeeService = availableEmployeeServices.find(function (item) {
      return item && (item.id === requestedEmployeeServiceId || String(item.code || '').toLocaleLowerCase() === requestedEmployeeServiceId.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedEmployeeServiceId.toLocaleLowerCase());
    });
    var requestedGeographicZoneId = String(input.geographicZoneId || input.zone || '').trim();
    var availableGeographicZones = Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : [];
    var matchingGeographicZone = availableGeographicZones.find(function (item) {
      return item && (item.id === requestedGeographicZoneId || String(item.code || '').toLocaleLowerCase() === requestedGeographicZoneId.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedGeographicZoneId.toLocaleLowerCase());
    });
    var errors = [];
    if (!employeeNumber) errors.push('Le numéro employé interne est obligatoire.');
    if (employeeNumber.length > 40) errors.push('Le numéro employé ne peut pas dépasser 40 caractères.');
    if (!displayName) errors.push('Le nom d’affichage est obligatoire pour cette fiche de test.');
    if (displayName.length > 120) errors.push('Le nom d’affichage ne peut pas dépasser 120 caractères.');
    if (availableEmployeeStatuses.length && requestedEmployeeStatus && !matchingEmployeeStatus) errors.push('Choisissez un statut existant dans le dossier de test.');
    if (availableEmployeeCategories.length && requestedCategoryId && !matchingEmployeeCategory) errors.push('Choisissez une catégorie/échelon existant dans le dossier de test.');
    if (availableEmployeeServices.length && requestedEmployeeServiceId && !matchingEmployeeService) errors.push('Choisissez un service existant dans le dossier de test.');
    if (availableEmployeeFunctions.length && matchingEmployeeFunctions.some(function (item) { return !item; })) errors.push('Choisissez des fonctions existantes dans le dossier de test.');
    if (new Set(requestedEmployeeFunctionValues).size !== requestedEmployeeFunctionValues.length) errors.push('Une fonction ne peut être sélectionnée qu’une seule fois sur la fiche.');
    if (availableGeographicZones.length && requestedGeographicZoneId && !matchingGeographicZone) errors.push('Choisissez une zone géographique existante dans le dossier de test.');
    var current = Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees : [];
    if (employeeNumber && current.some(function (employee) {
      return String(employee && (employee.employeeNumber || employee.id) || '').trim().toLocaleLowerCase() === employeeNumber.toLocaleLowerCase();
    })) errors.push('Ce numéro employé existe déjà dans ce dossier Paie & RH.');
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do {
      id = 'EMP-TEST-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    } while (current.some(function (employee) { return employee && employee.id === id; }));
    var employee = {
      id: id,
      dossierId: dossierId,
      employeeNumber: employeeNumber,
      displayName: displayName,
      employeeStatus: matchingEmployeeStatus ? matchingEmployeeStatus.id : requestedEmployeeStatus,
      categoryId: matchingEmployeeCategory ? matchingEmployeeCategory.id : '',
      categoryStep: matchingEmployeeCategory ? matchingEmployeeCategory.code : requestedCategoryId,
      serviceId: matchingEmployeeService ? matchingEmployeeService.id : '',
      service: matchingEmployeeService ? matchingEmployeeService.label : requestedEmployeeServiceId,
      functionIds: matchingEmployeeFunctions.filter(Boolean).map(function (item) { return item.id; }),
      functionId: matchingEmployeeFunctions.filter(Boolean).length === 1 ? matchingEmployeeFunctions.filter(Boolean)[0].id : '',
      function: matchingEmployeeFunctions.filter(Boolean).map(function (item) { return item.label; }).join(' · ') || requestedEmployeeFunctionValues.join(' · '),
      geographicZoneId: matchingGeographicZone ? matchingGeographicZone.id : '',
      zone: matchingGeographicZone ? matchingGeographicZone.label : requestedGeographicZoneId,
      status: 'test-only',
      createdAt: new Date().toISOString()
    };
    dossier.demoEmployees = current.concat([employee]);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fiche fictive dans le stockage local.'] };
    return { ok: true, errors: [], employee: clone(employee) };
  }

  var EMPLOYEE_PROFILE_TEXT_LIMITS = {
    employeeNumber: 40, displayName: 120, sex: 40, maritalStatus: 60, birthplace: 120,
    nationality: 80, socialInsuranceNumber: 80, taxId: 80, supplementaryInsuranceCompany: 120,
    supplementaryInsuranceNumber: 80, degree: 120, profession: 120, employeeStatus: 80,
    categoryStep: 80, categoryId: 80, geographicZoneId: 80, zone: 120, serviceId: 80, service: 120, functionId: 80, function: 120, terminationReason: 160,
    paymentMethod: 80, bankName: 120, bankAccountNumber: 100, address: 240, contactPhone: 80, contactEmail: 160,
    miscellaneousLabel: 120, miscellaneousValue: 500
  };
  var EMPLOYEE_PROFILE_DATES = ['firstHireDate', 'seniorityReferenceDate', 'vpsExemptionEndDate', 'terminationDate', 'rehireDate', 'birthDate', 'effectiveDate'];

  function updateEmployee(dossierId, employeeId, input) {
    dossierId = String(dossierId || '');
    employeeId = String(employeeId || '');
    input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var employees = dossier && Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees : [];
    var employee = employees.find(function (item) { return item && item.id === employeeId && item.dossierId === dossierId && item.status === 'test-only'; });
    if (!employee) return { ok: false, errors: ['La fiche fictive est introuvable dans le dossier actif.'] };
    var patch = {};
    Object.keys(EMPLOYEE_PROFILE_TEXT_LIMITS).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      var value = String(input[key] == null ? '' : input[key]).trim().replace(/\s+/g, ' ');
      if (value.length > EMPLOYEE_PROFILE_TEXT_LIMITS[key]) return;
      patch[key] = value;
    });
    var errors = [];
    Object.keys(EMPLOYEE_PROFILE_TEXT_LIMITS).forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(input, key) && String(input[key] || '').trim().length > EMPLOYEE_PROFILE_TEXT_LIMITS[key]) {
        errors.push('Le champ « ' + key + ' » dépasse sa longueur maximale de test.');
      }
    });
    EMPLOYEE_PROFILE_DATES.forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      var value = String(input[key] || '').trim();
      if (value && !dateParts(value)) errors.push('Le champ date « ' + key + ' » doit être une date valide.');
      else patch[key] = value;
    });
    ['childrenCount', 'seniorityMonthsToDeduct'].forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) return;
      var value = String(input[key] == null ? '' : input[key]).trim();
      if (value && (!/^\d+$/.test(value) || Number(value) > 9999)) errors.push('Le champ numérique « ' + key + ' » doit être un entier positif de test.');
      else patch[key] = value;
    });
    if (Object.prototype.hasOwnProperty.call(input, 'employeeNumber')) {
      patch.employeeNumber = String(input.employeeNumber || '').trim();
      if (!patch.employeeNumber) errors.push('Le matricule interne est obligatoire.');
      if (employees.some(function (item) { return item && item.id !== employeeId && String(item.employeeNumber || item.id).toLocaleLowerCase() === patch.employeeNumber.toLocaleLowerCase(); })) errors.push('Ce matricule existe déjà dans le dossier test.');
    }
    if (Object.prototype.hasOwnProperty.call(input, 'displayName')) {
      patch.displayName = String(input.displayName || '').trim().replace(/\s+/g, ' ');
      if (!patch.displayName) errors.push('Le nom d’affichage fictif est obligatoire.');
    }
    if (Object.prototype.hasOwnProperty.call(input, 'employeeStatus')) {
      var requestedStatus = String(input.employeeStatus || '').trim();
      var availableStatuses = Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
      var matchingStatus = availableStatuses.find(function (item) {
        return item && (item.id === requestedStatus || String(item.code || '').toLocaleLowerCase() === requestedStatus.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedStatus.toLocaleLowerCase());
      });
      if (availableStatuses.length && requestedStatus && !matchingStatus) errors.push('Choisissez un statut existant dans le dossier de test.');
      else patch.employeeStatus = matchingStatus ? matchingStatus.id : requestedStatus;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'categoryId')) {
      var requestedCategory = String(input.categoryId || '').trim();
      var availableCategories = Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : [];
      var matchingCategory = availableCategories.find(function (item) {
        return item && (item.id === requestedCategory || String(item.code || '').toLocaleLowerCase() === requestedCategory.toLocaleLowerCase());
      });
      if (availableCategories.length && requestedCategory && !matchingCategory) errors.push('Choisissez une catégorie/échelon existant dans le dossier de test.');
      else {
        patch.categoryId = matchingCategory ? matchingCategory.id : requestedCategory;
        patch.categoryStep = matchingCategory ? matchingCategory.code : '';
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'serviceId') || Object.prototype.hasOwnProperty.call(input, 'service')) {
      var requestedService = String(Object.prototype.hasOwnProperty.call(input, 'serviceId') ? input.serviceId || '' : input.service || '').trim();
      var availableServices = Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
      var matchingService = availableServices.find(function (item) {
        return item && (item.id === requestedService || String(item.code || '').toLocaleLowerCase() === requestedService.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedService.toLocaleLowerCase());
      });
      if (availableServices.length && requestedService && !matchingService) errors.push('Choisissez un service existant dans le dossier de test.');
      else {
        patch.serviceId = matchingService ? matchingService.id : '';
        patch.service = matchingService ? matchingService.label : (availableServices.length ? '' : requestedService);
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'functionIds') || Object.prototype.hasOwnProperty.call(input, 'functionId') || Object.prototype.hasOwnProperty.call(input, 'function')) {
      var requestedFunctions = Array.isArray(input.functionIds)
        ? input.functionIds.map(function (value) { return String(value || '').trim(); }).filter(Boolean)
        : [String(Object.prototype.hasOwnProperty.call(input, 'functionId') ? input.functionId || '' : input.function || '').trim()].filter(Boolean);
      var availableFunctions = Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : [];
      var matchingFunctions = requestedFunctions.map(function (requestedFunction) {
        return availableFunctions.find(function (item) {
          return item && (item.id === requestedFunction || String(item.code || '').toLocaleLowerCase() === requestedFunction.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedFunction.toLocaleLowerCase());
        });
      });
      if (availableFunctions.length && matchingFunctions.some(function (item) { return !item; })) errors.push('Choisissez des fonctions existantes dans le dossier de test.');
      if (new Set(requestedFunctions).size !== requestedFunctions.length) errors.push('Une fonction ne peut être sélectionnée qu’une seule fois sur la fiche.');
      patch.functionIds = matchingFunctions.filter(Boolean).map(function (item) { return item.id; });
      patch.functionId = patch.functionIds.length === 1 ? patch.functionIds[0] : '';
      patch.function = matchingFunctions.filter(Boolean).map(function (item) { return item.label; }).join(' · ') || (availableFunctions.length ? '' : requestedFunctions.join(' · '));
    }
    if (Object.prototype.hasOwnProperty.call(input, 'geographicZoneId')) {
      var requestedGeographicZone = String(input.geographicZoneId || '').trim();
      var availableGeographicZones = Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : [];
      var matchingGeographicZone = availableGeographicZones.find(function (item) {
        return item && (item.id === requestedGeographicZone || String(item.code || '').toLocaleLowerCase() === requestedGeographicZone.toLocaleLowerCase() || String(item.label || '').toLocaleLowerCase() === requestedGeographicZone.toLocaleLowerCase());
      });
      if (availableGeographicZones.length && requestedGeographicZone && !matchingGeographicZone) errors.push('Choisissez une zone géographique existante dans le dossier de test.');
      else {
        patch.geographicZoneId = matchingGeographicZone ? matchingGeographicZone.id : requestedGeographicZone;
        patch.zone = matchingGeographicZone ? matchingGeographicZone.label : '';
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, 'photoDataUrl')) {
      var photoDataUrl = String(input.photoDataUrl || '');
      if (photoDataUrl && (!/^data:image\/(?:jpeg|png|webp);base64,/.test(photoDataUrl) || photoDataUrl.length > 1500000)) {
        errors.push('La photo doit être un fichier JPEG, PNG ou WebP de test inférieur à environ 1 Mo.');
      } else patch.photoDataUrl = photoDataUrl;
    }
    if (errors.length) return { ok: false, errors: errors };
    Object.keys(patch).forEach(function (key) { employee[key] = patch[key]; });
    employee.updatedAt = new Date().toISOString();
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fiche dans le stockage local de test.'] };
    return { ok: true, errors: [], employee: clone(employee) };
  }

  function deleteEmployee(dossierId, employeeId) {
    dossierId = String(dossierId || '');
    employeeId = String(employeeId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var employees = dossier && Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees : [];
    var employee = employees.find(function (item) { return item && item.id === employeeId && item.dossierId === dossierId && item.status === 'test-only'; });
    if (!employee) return { ok: false, errors: ['La fiche fictive est introuvable dans le dossier actif.'] };
    if (employees.length <= 2) return { ok: false, errors: ['Il faut conserver au moins deux fiches fictives pour garder le dossier de test valide.'] };
    var linkedCollections = ['organizationAssignments', 'internalMissions', 'leaveAbsenceRecords', 'payrollVariableReferences'];
    if (linkedCollections.some(function (name) {
      return Array.isArray(dossier[name]) && dossier[name].some(function (record) { return record && record.employeeId === employeeId; });
    })) return { ok: false, errors: ['Cette fiche est référencée par un autre élément de test ; supprimez d’abord la référence associée.'] };
    dossier.demoEmployees = employees.filter(function (item) { return item && item.id !== employeeId; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la fiche du stockage local de test.'] };
    return { ok: true, errors: [], deletedEmployeeId: employeeId };
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

  var EMPLOYEE_RUBRIC_CATALOG = [];
  function addEmployeeRubric(id, label, selectedByReference, level, heading) {
    EMPLOYEE_RUBRIC_CATALOG.push({ id: id, label: label, selectedByReference: selectedByReference === true, level: level || 0, heading: heading === true });
  }
  addEmployeeRubric('leave-days-total', 'JOURS DE CONGÉS', true, 0, true);
  addEmployeeRubric('leave-carry-forward', 'Report', true, 1);
  addEmployeeRubric('leave-accrued-month', 'Acquis ce mois', true, 1);
  addEmployeeRubric('leave-extra-days', 'Jours supplémentaires accordés', true, 1);
  addEmployeeRubric('leave-taken-month', 'Pris ce mois', true, 1);
  addEmployeeRubric('worked-days-total', 'JOURS TRAVAILLÉS', true, 0, true);
  addEmployeeRubric('worked-days-statutory', 'Base statutaire', true, 1);
  addEmployeeRubric('worked-days-unpaid-absence', 'Jours d’absence non payés', true, 1);
  addEmployeeRubric('worked-days-paid', 'Jours payés', true, 1);
  addEmployeeRubric('worked-hours-total', 'HEURES TRAVAILLÉES', false, 0, true);
  addEmployeeRubric('worked-hours-statutory', 'Base statutaire', false, 1);
  addEmployeeRubric('worked-hours-unpaid-absence', 'Heures d’absence non payées', false, 1);
  addEmployeeRubric('worked-hours-paid', 'Heures payées', false, 1);
  addEmployeeRubric('base-category', 'Base catégorielle', true);
  addEmployeeRubric('base-convention', 'Base conventionnelle', false);
  addEmployeeRubric('shift-premium', 'Prime de poste', true);
  addEmployeeRubric('seniority-premium', 'Prime d’ancienneté', false);
  addEmployeeRubric('base-elements-total', 'TOTAL DES ÉLÉMENTS DE BASE', true, 0, true);
  addEmployeeRubric('coefficient-worked-days', 'Coefficient/Jours travaillés', true);
  addEmployeeRubric('salary-base-total', 'SALAIRE DE BASE', true, 0, true);
  addEmployeeRubric('travel-allowance', 'Indemnité de déplacement', true);
  addEmployeeRubric('housing-allowance', 'Indemnité de logement', true);
  for (var fixedAllowance = 3; fixedAllowance <= 9; fixedAllowance++) addEmployeeRubric('fixed-allowance-' + fixedAllowance, 'Indemnité fixe ' + fixedAllowance, false);
  addEmployeeRubric('fixed-premiums-total', 'TOTAL PRIMES FIXES', true, 0, true);
  for (var exceptionalPremium = 1; exceptionalPremium <= 19; exceptionalPremium++) addEmployeeRubric('exceptional-premium-' + exceptionalPremium, 'Prime exceptionnelle ' + exceptionalPremium, exceptionalPremium <= 2);
  addEmployeeRubric('exceptional-premiums-total', 'TOTAL PRIMES EXCEPTIONNELLES', true, 0, true);
  [12, 35, 50, 100].forEach(function (rate) {
    addEmployeeRubric('overtime-base-' + rate, 'Base H.S. à ' + rate + '%', true);
    addEmployeeRubric('overtime-count-' + rate, "Nombre d’H.S. à " + rate + '%', true);
    addEmployeeRubric('overtime-hours-' + rate, 'Heures supplémentaires à ' + rate + '%', true);
  });
  addEmployeeRubric('overtime-total', 'TOTAL H.S.', true, 0, true);
  addEmployeeRubric('leave-pay-base', 'Base congé', true);
  addEmployeeRubric('leave-pay-coefficient', 'Coefficient/Jours de congé', true);
  addEmployeeRubric('leave-pay-indemnity', 'Indemnité de congé', true);
  addEmployeeRubric('gross-salary', 'SALAIRE BRUT', true, 0, true);
  addEmployeeRubric('fnr-base', 'Base F.N.R.', false);
  addEmployeeRubric('fnr-contribution', 'Cotisation F.N.R.', false);
  addEmployeeRubric('cnss-base', 'Base C.N.S.S.', true);
  addEmployeeRubric('cnss-contributions', 'Cotisations C.N.S.S.', true);
  addEmployeeRubric('supp-insurance-base', 'Base de l’assurance complémentaire', true);
  addEmployeeRubric('supp-insurance-rate', 'Taux d’assurance complémentaire', true);
  addEmployeeRubric('supp-insurance', 'Assurance complémentaire', true);
  addEmployeeRubric('social-contributions-total', 'TOTAL COTISATIONS SOCIALES', true, 0, true);
  addEmployeeRubric('benefit-housing', 'Logement', true);
  addEmployeeRubric('benefit-vehicle', 'Véhicule', true);
  addEmployeeRubric('benefits-kind-total', 'TOTAL AVANTAGES EN NATURE', true, 0, true);
  addEmployeeRubric('ipts-base', 'Base I.P.T.S.', true);
  addEmployeeRubric('ipts', 'I.P.T.S.', true);
  addEmployeeRubric('taxes-total', 'TOTAL IMPÔTS', true, 0, true);
  addEmployeeRubric('union-contribution', 'Cotisation syndicale', true);
  addEmployeeRubric('mutual-contribution', 'Cotisation mutuelle', true);
  addEmployeeRubric('other-mandatory-deductions-total', 'TOTAL AUTRES RETENUES OBLIGATOIRES', true, 0, true);
  addEmployeeRubric('net-salary', 'SALAIRE NET', true, 0, true);
  addEmployeeRubric('advance-1', 'AVANCE SUR SALAIRE', true, 0, true);
  for (var advanceNumber = 1; advanceNumber <= 9; advanceNumber++) {
    var advanceSelected = advanceNumber <= 2;
    if (advanceNumber > 1) addEmployeeRubric('advance-' + advanceNumber, 'AVANCE ' + advanceNumber, advanceSelected, 0, true);
    addEmployeeRubric('advance-' + advanceNumber + '-carry-forward', 'Report', advanceSelected, 1);
    addEmployeeRubric('advance-' + advanceNumber + '-increase-month', 'Augmentation ce mois', advanceSelected, 1);
    addEmployeeRubric('advance-' + advanceNumber + '-withheld-month', 'Retenue ce mois', advanceSelected, 1);
  }
  addEmployeeRubric('advances-loans-total', 'TOTAL AVANCES ET PRÊTS', true, 0, true);
  addEmployeeRubric('professional-expense-reimbursement-1', 'Remboursement frais professionnels 1', true);
  addEmployeeRubric('professional-expense-reimbursement-2', 'Remboursement frais professionnels 2', true);
  addEmployeeRubric('professional-expenses-total', 'TOTAL REMBOURSEMENT DE FRAIS', true, 0, true);
  addEmployeeRubric('amount-payable', 'MONTANT À PAYER', true, 0, true);

  function employeeStatusDefaults() {
    return { ohadaClassification: 'Permanent', monthlyWorkDays: '21.66', monthlyWorkHours: '173.33',
      leaveDaysPerMonth: '2.00', leaveDayType: 'ouvrables',
      rubricIds: EMPLOYEE_RUBRIC_CATALOG.filter(function (item) { return item.selectedByReference; }).map(function (item) { return item.id; }) };
  }

  function employeeRubricCatalog() { return clone(EMPLOYEE_RUBRIC_CATALOG); }

  function employeeStatuses(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    dossierId = String(dossierId);
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var records = dossier && Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
    var changed = false;
    records.forEach(function (record) {
      if (!record || record.defaultProfileVersion === 1) return;
      var defaults = employeeStatusDefaults();
      ['monthlyWorkDays', 'monthlyWorkHours', 'leaveDaysPerMonth', 'leaveDayType'].forEach(function (key) {
        if (!String(record[key] || '').trim()) { record[key] = defaults[key]; changed = true; }
      });
      if (['Permanent', 'Occasionnel'].indexOf(record.ohadaClassification) === -1) { record.ohadaClassification = defaults.ohadaClassification; changed = true; }
      if (!Array.isArray(record.rubricIds) || !record.rubricIds.length) { record.rubricIds = defaults.rubricIds.slice(); changed = true; }
      record.defaultProfileVersion = 1;
      changed = true;
    });
    if (changed) saveDossierCatalog(catalog);
    return clone(records);
  }

  function seedDemoEmployeeStatuses(dossierId) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les statuts issus de la capture sont réservés au dossier PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (Array.isArray(dossier.employeeStatuses) && dossier.employeeStatuses.length) return { ok: false, errors: ['Des statuts existent déjà dans ce dossier ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    var defaults = [
      { code: 'A', label: 'Agent de l’État' },
      { code: 'C', label: 'Contractuel' },
      { code: 'O', label: 'Occasionnel' },
      { code: 'S', label: 'Stagiaire' }
    ];
    dossier.employeeStatuses = defaults.map(function (item, index) {
      return Object.assign({ id: 'status-test-' + item.code.toLowerCase(), dossierId: dossierId, status: 'test-only', createdAt: now, updatedAt: now, order: index, defaultProfileVersion: 1 }, employeeStatusDefaults(), item);
    });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer les statuts fictifs dans le stockage local.'] };
    return { ok: true, errors: [], statuses: employeeStatuses(dossierId) };
  }

  function normalizeEmployeeStatusInput(input) {
    input = input || {};
    var defaults = employeeStatusDefaults();
    var code = String(input.code || '').trim();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var ohadaClassification = String(input.ohadaClassification || defaults.ohadaClassification).trim().replace(/\s+/g, ' ');
    var monthlyWorkDays = String(input.monthlyWorkDays || defaults.monthlyWorkDays).trim();
    var monthlyWorkHours = String(input.monthlyWorkHours || defaults.monthlyWorkHours).trim();
    var leaveDaysPerMonth = String(input.leaveDaysPerMonth || defaults.leaveDaysPerMonth).trim();
    var leaveDayType = String(input.leaveDayType || defaults.leaveDayType).trim();
    var rubricIds = Array.isArray(input.rubricIds) ? Array.from(new Set(input.rubricIds.map(String))) : defaults.rubricIds.slice();
    var errors = [];
    if (!code) errors.push('Le code du statut est obligatoire.');
    if (code.length > 24) errors.push('Le code est limité à 24 caractères.');
    if (!label) errors.push('L’intitulé du statut est obligatoire.');
    if (label.length > 120 || ohadaClassification.length > 80) errors.push('Un texte dépasse la longueur autorisée.');
    if (['Permanent', 'Occasionnel'].indexOf(ohadaClassification) === -1) errors.push('Choisissez Permanent ou Occasionnel pour la classification OHADA.');
    [monthlyWorkDays, monthlyWorkHours, leaveDaysPerMonth].forEach(function (value) {
      if (value && (!/^\d+(?:[.,]\d+)?$/.test(value) || !Number.isFinite(Number(value.replace(',', '.'))))) errors.push('Les bases et jours acquis doivent être des nombres positifs ou vides.');
    });
    if (leaveDayType && ['ouvrables', 'calendaires'].indexOf(leaveDayType) === -1) errors.push('Choisissez Ouvrables ou Calendaires.');
    var validRubricIds = Object.create(null);
    EMPLOYEE_RUBRIC_CATALOG.forEach(function (item) { validRubricIds[item.id] = true; });
    if (rubricIds.some(function (id) { return !validRubricIds[id]; })) errors.push('La sélection contient une rubrique inconnue.');
    return { ok: errors.length === 0, errors: errors, value: { code: code, label: label, ohadaClassification: ohadaClassification,
      monthlyWorkDays: monthlyWorkDays, monthlyWorkHours: monthlyWorkHours, leaveDaysPerMonth: leaveDaysPerMonth,
      leaveDayType: leaveDayType, rubricIds: rubricIds } };
  }

  function createEmployeeStatus(dossierId, input) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La création est réservée au dossier fictif PRH-TEST-2026.'] };
    if (!input || input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’un statut de test.'] };
    var validation = normalizeEmployeeStatusInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    dossier.employeeStatuses = Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
    if (dossier.employeeStatuses.some(function (item) { return String(item.code).toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code existe déjà dans le dossier test.'] };
    var record = Object.assign({ id: 'status-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, status: 'test-only', createdAt: new Date().toISOString(), defaultProfileVersion: 1 }, validation.value);
    dossier.employeeStatuses.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le statut de test.'] };
    return { ok: true, errors: [], employeeStatus: clone(record) };
  }

  function updateEmployeeStatus(dossierId, statusId, input) {
    dossierId = String(dossierId || ''); statusId = String(statusId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit de valeurs de test.'] };
    var validation = normalizeEmployeeStatusInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var records = Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
    var record = records.find(function (item) { return item && item.id === statusId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['Le statut de test est introuvable.'] };
    if (records.some(function (item) { return item && item.id !== statusId && String(item.code).toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code existe déjà dans le dossier test.'] };
    Object.keys(validation.value).forEach(function (key) { record[key] = validation.value[key]; });
    record.defaultProfileVersion = 1;
    record.updatedAt = new Date().toISOString();
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer les modifications du statut.'] };
    return { ok: true, errors: [], employeeStatus: clone(record) };
  }

  function deleteEmployeeStatus(dossierId, statusId) {
    dossierId = String(dossierId || ''); statusId = String(statusId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var statuses = dossier && Array.isArray(dossier.employeeStatuses) ? dossier.employeeStatuses : [];
    var statusRecord = statuses.find(function (item) { return item && item.id === statusId && item.dossierId === dossierId; });
    if (!statusRecord) return { ok: false, errors: ['Le statut de test est introuvable.'] };
    if ((dossier.demoEmployees || []).some(function (employee) { return employee && employee.employeeStatus === statusId; })) return { ok: false, errors: ['Ce statut est attribué à une fiche employé et ne peut pas être supprimé.'] };
    dossier.employeeStatuses = statuses.filter(function (item) { return item && item.id !== statusId; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer le statut de test.'] };
    return { ok: true, errors: [], deletedStatusId: statusId };
  }

  var EMPLOYEE_CATEGORY_CLASSIFICATIONS = ['Aucune', 'Cadre supérieur', 'Technicien supérieur/Cadre moyen', 'Technicien/Agent de maîtrise/Ouvrier qualifié', 'Employé/Ouvrier/Manœuvre/Apprenti'];
  var EMPLOYEE_CATEGORY_PREMIUM_CATALOG = [{ id: 'categorical-salary', label: 'Salaire catégoriel' }];

  function employeeCategoryClassifications() { return EMPLOYEE_CATEGORY_CLASSIFICATIONS.slice(); }
  function employeeCategoryPremiumCatalog() { return clone(EMPLOYEE_CATEGORY_PREMIUM_CATALOG); }

  function employeeCategoryAdditionalClassifications(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); });
    return clone(dossier && Array.isArray(dossier.employeeCategoryAdditionalClassifications) ? dossier.employeeCategoryAdditionalClassifications : []);
  }

  function createEmployeeCategoryAdditionalClassification(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les classifications complémentaires sont réservées au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez que cette classification complémentaire est fictive.'] };
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    if (!label) return { ok: false, errors: ['Le libellé de classification est obligatoire.'] };
    if (label.length > 80) return { ok: false, errors: ['Le libellé est limité à 80 caractères.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    dossier.employeeCategoryAdditionalClassifications = Array.isArray(dossier.employeeCategoryAdditionalClassifications) ? dossier.employeeCategoryAdditionalClassifications : [];
    if (dossier.employeeCategoryAdditionalClassifications.some(function (item) { return String(item.label || '').toLocaleLowerCase() === label.toLocaleLowerCase(); })) return { ok: false, errors: ['Cette classification complémentaire existe déjà.'] };
    var record = { id: 'category-classification-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, label: label, status: 'test-only', createdAt: new Date().toISOString() };
    dossier.employeeCategoryAdditionalClassifications.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la classification complémentaire.'] };
    return { ok: true, errors: [], classification: clone(record) };
  }

  function deleteEmployeeCategoryAdditionalClassification(dossierId, classificationId) {
    dossierId = String(dossierId || ''); classificationId = String(classificationId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var classifications = dossier && Array.isArray(dossier.employeeCategoryAdditionalClassifications) ? dossier.employeeCategoryAdditionalClassifications : [];
    var classification = classifications.find(function (item) { return item && item.id === classificationId && item.dossierId === dossierId; });
    if (!classification) return { ok: false, errors: ['La classification complémentaire est introuvable.'] };
    if ((dossier.employeeCategories || []).some(function (category) { return category && Array.isArray(category.additionalClassificationIds) && category.additionalClassificationIds.indexOf(classificationId) !== -1; })) return { ok: false, errors: ['Cette classification est utilisée par une catégorie et ne peut pas être supprimée.'] };
    dossier.employeeCategoryAdditionalClassifications = classifications.filter(function (item) { return item && item.id !== classificationId; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la classification complémentaire.'] };
    return { ok: true, errors: [], deletedClassificationId: classificationId };
  }

  function employeeCategories(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); });
    return clone((dossier && Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : []).slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }));
  }

  function seedDemoEmployeeCategories(dossierId) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les catégories de démonstration sont réservées au dossier PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (Array.isArray(dossier.employeeCategories) && dossier.employeeCategories.length) return { ok: false, errors: ['Des catégories existent déjà ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    dossier.employeeCategories = [{ id: 'category-test-c1', dossierId: dossierId, code: 'C1', salaryIndex: '', ohadaClassification: 'Cadre supérieur', linkedPremiumIds: ['categorical-salary'], additionalClassificationIds: [], order: 0, status: 'test-only', createdAt: now, updatedAt: now }];
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la catégorie de test.'] };
    return { ok: true, errors: [], categories: employeeCategories(dossierId) };
  }

  function normalizeEmployeeCategoryInput(input, dossier) {
    input = input || {};
    var code = String(input.code || '').trim();
    var salaryIndex = String(input.salaryIndex || '').trim();
    var ohadaClassification = String(input.ohadaClassification || 'Aucune').trim();
    var linkedPremiumIds = Array.isArray(input.linkedPremiumIds) ? Array.from(new Set(input.linkedPremiumIds.map(String))) : [];
    var additionalClassificationIds = Array.isArray(input.additionalClassificationIds) ? Array.from(new Set(input.additionalClassificationIds.map(String))) : [];
    var position = input.position == null || input.position === '' ? null : Number(input.position);
    var errors = [];
    if (!code) errors.push('Le code catégorie/échelon est obligatoire.');
    if (code.length > 24) errors.push('Le code est limité à 24 caractères.');
    if (salaryIndex && (!/^\d+(?:[.,]\d+)?$/.test(salaryIndex) || !Number.isFinite(Number(salaryIndex.replace(',', '.'))))) errors.push('Le salaire indiciaire doit être un nombre positif ou vide.');
    if (EMPLOYEE_CATEGORY_CLASSIFICATIONS.indexOf(ohadaClassification) === -1) errors.push('Choisissez une classification OHADA proposée.');
    if (position !== null && (!Number.isInteger(position) || position < 1)) errors.push('La position doit être un entier positif.');
    var knownPremiums = Object.create(null);
    EMPLOYEE_CATEGORY_PREMIUM_CATALOG.forEach(function (item) { knownPremiums[item.id] = true; });
    if (linkedPremiumIds.some(function (id) { return !knownPremiums[id]; })) errors.push('La sélection contient une prime inconnue.');
    var knownClassifications = Object.create(null);
    (dossier && Array.isArray(dossier.employeeCategoryAdditionalClassifications) ? dossier.employeeCategoryAdditionalClassifications : []).forEach(function (item) { knownClassifications[item.id] = true; });
    if (additionalClassificationIds.some(function (id) { return !knownClassifications[id]; })) errors.push('La sélection contient une classification complémentaire inconnue.');
    return { ok: errors.length === 0, errors: errors, value: { code: code, salaryIndex: salaryIndex, ohadaClassification: ohadaClassification, linkedPremiumIds: linkedPremiumIds, additionalClassificationIds: additionalClassificationIds, position: position } };
  }

  function createEmployeeCategory(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La création est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une catégorie de test.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var validation = normalizeEmployeeCategoryInput(input, dossier);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    dossier.employeeCategories = Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : [];
    if (dossier.employeeCategories.some(function (item) { return String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code catégorie/échelon existe déjà.'] };
    var now = new Date().toISOString();
    var record = Object.assign({ id: 'category-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, status: 'test-only', createdAt: now, updatedAt: now, order: dossier.employeeCategories.length }, validation.value);
    dossier.employeeCategories.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la catégorie.'] };
    return { ok: true, errors: [], category: clone(record) };
  }

  function updateEmployeeCategory(dossierId, categoryId, input) {
    dossierId = String(dossierId || ''); categoryId = String(categoryId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une modification fictive.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var categories = Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : [];
    var record = categories.find(function (item) { return item && item.id === categoryId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['La catégorie est introuvable.'] };
    var validation = normalizeEmployeeCategoryInput(input, dossier);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    if (categories.some(function (item) { return item && item.id !== categoryId && String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code catégorie/échelon existe déjà.'] };
    var nextPosition = validation.value.position == null ? Number(record.order || 0) + 1 : validation.value.position;
    Object.assign(record, validation.value, { order: nextPosition - 1, updatedAt: new Date().toISOString() });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la catégorie.'] };
    return { ok: true, errors: [], category: clone(record) };
  }

  function deleteEmployeeCategory(dossierId, categoryId) {
    dossierId = String(dossierId || ''); categoryId = String(categoryId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var categories = dossier && Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories : [];
    var category = categories.find(function (item) { return item && item.id === categoryId && item.dossierId === dossierId; });
    if (!category) return { ok: false, errors: ['La catégorie est introuvable.'] };
    if ((dossier.demoEmployees || []).some(function (employee) { return employee && (employee.categoryId === categoryId || employee.categoryStep === category.code); })) return { ok: false, errors: ['Cette catégorie est liée à une fiche employé et ne peut pas être supprimée.'] };
    dossier.employeeCategories = categories.filter(function (item) { return item && item.id !== categoryId; }).map(function (item, index) { item.order = index; return item; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la catégorie.'] };
    return { ok: true, errors: [], deletedCategoryId: categoryId };
  }

  function positionEmployeeCategory(dossierId, categoryId, position) {
    dossierId = String(dossierId || ''); categoryId = String(categoryId || ''); position = Number(position);
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le positionnement est réservé au dossier fictif PRH-TEST-2026.'] };
    if (!Number.isInteger(position) || position < 1) return { ok: false, errors: ['La position doit être un entier positif.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var categories = dossier && Array.isArray(dossier.employeeCategories) ? dossier.employeeCategories.slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }) : [];
    var currentIndex = categories.findIndex(function (item) { return item && item.id === categoryId && item.dossierId === dossierId; });
    if (currentIndex === -1) return { ok: false, errors: ['La catégorie à positionner est introuvable.'] };
    if (position > categories.length) return { ok: false, errors: ['La position ne peut pas dépasser le nombre de catégories.'] };
    var moved = categories.splice(currentIndex, 1)[0];
    categories.splice(position - 1, 0, moved);
    categories.forEach(function (item, index) { item.order = index; });
    dossier.employeeCategories = categories;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le positionnement.'] };
    return { ok: true, errors: [], categories: clone(categories) };
  }

  function employeeGeographicZones(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); });
    return clone((dossier && Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : []).slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }));
  }

  function seedDemoEmployeeGeographicZones(dossierId) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les zones géographiques sont réservées au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (Array.isArray(dossier.employeeGeographicZones) && dossier.employeeGeographicZones.length) return { ok: false, errors: ['Des zones existent déjà ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    dossier.employeeGeographicZones = [{ id: 'geographic-zone-test-0', dossierId: dossierId, code: '0', label: 'Siège', order: 0, status: 'test-only', createdAt: now, updatedAt: now }];
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la zone de test.'] };
    return { ok: true, errors: [], zones: employeeGeographicZones(dossierId) };
  }

  function normalizeEmployeeGeographicZoneInput(input) {
    input = input || {};
    var code = String(input.code || '').trim();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var errors = [];
    if (!code) errors.push('Le code de la zone est obligatoire.');
    if (code.length > 24) errors.push('Le code est limité à 24 caractères.');
    if (!label) errors.push('L’intitulé de la zone est obligatoire.');
    if (label.length > 100) errors.push('L’intitulé est limité à 100 caractères.');
    return { ok: errors.length === 0, errors: errors, value: { code: code, label: label } };
  }

  function createEmployeeGeographicZone(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La création est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une zone de test.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var validation = normalizeEmployeeGeographicZoneInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    dossier.employeeGeographicZones = Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : [];
    if (dossier.employeeGeographicZones.some(function (item) { return String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de zone existe déjà.'] };
    var now = new Date().toISOString();
    var record = Object.assign({ id: 'geographic-zone-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, order: dossier.employeeGeographicZones.length, status: 'test-only', createdAt: now, updatedAt: now }, validation.value);
    dossier.employeeGeographicZones.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la zone de test.'] };
    return { ok: true, errors: [], zone: clone(record) };
  }

  function updateEmployeeGeographicZone(dossierId, zoneId, input) {
    dossierId = String(dossierId || ''); zoneId = String(zoneId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une modification fictive.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var zones = dossier && Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : [];
    var record = zones.find(function (item) { return item && item.id === zoneId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['La zone est introuvable.'] };
    var validation = normalizeEmployeeGeographicZoneInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    if (zones.some(function (item) { return item && item.id !== zoneId && String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de zone existe déjà.'] };
    var previousCode = record.code;
    var previousLabel = record.label;
    Object.assign(record, validation.value, { updatedAt: new Date().toISOString() });
    (dossier.demoEmployees || []).forEach(function (employee) {
      if (!employee) return;
      if (employee.geographicZoneId === zoneId || employee.zone === previousCode || employee.zone === previousLabel) {
        employee.geographicZoneId = zoneId;
        employee.zone = record.label;
      }
    });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la zone.'] };
    return { ok: true, errors: [], zone: clone(record) };
  }

  function deleteEmployeeGeographicZone(dossierId, zoneId) {
    dossierId = String(dossierId || ''); zoneId = String(zoneId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var zones = dossier && Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones : [];
    var zone = zones.find(function (item) { return item && item.id === zoneId && item.dossierId === dossierId; });
    if (!zone) return { ok: false, errors: ['La zone est introuvable.'] };
    if ((dossier.demoEmployees || []).some(function (employee) { return employee && (employee.geographicZoneId === zoneId || employee.zone === zone.code || employee.zone === zone.label); })) return { ok: false, errors: ['Cette zone est utilisée par une fiche employé et ne peut pas être supprimée.'] };
    dossier.employeeGeographicZones = zones.filter(function (item) { return item && item.id !== zoneId; }).map(function (item, index) { item.order = index; return item; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la zone.'] };
    return { ok: true, errors: [], deletedZoneId: zoneId };
  }

  function positionEmployeeGeographicZone(dossierId, zoneId, position) {
    dossierId = String(dossierId || ''); zoneId = String(zoneId || ''); position = Number(position);
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le positionnement est réservé au dossier fictif PRH-TEST-2026.'] };
    if (!Number.isInteger(position) || position < 1) return { ok: false, errors: ['La position doit être un entier positif.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var zones = dossier && Array.isArray(dossier.employeeGeographicZones) ? dossier.employeeGeographicZones.slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }) : [];
    var currentIndex = zones.findIndex(function (item) { return item && item.id === zoneId && item.dossierId === dossierId; });
    if (currentIndex === -1) return { ok: false, errors: ['La zone à positionner est introuvable.'] };
    if (position > zones.length) return { ok: false, errors: ['La position ne peut pas dépasser le nombre de zones.'] };
    var moved = zones.splice(currentIndex, 1)[0];
    zones.splice(position - 1, 0, moved);
    zones.forEach(function (item, index) { item.order = index; });
    dossier.employeeGeographicZones = zones;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le positionnement.'] };
    return { ok: true, errors: [], zones: clone(zones) };
  }

  function employeeServices(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); });
    return clone((dossier && Array.isArray(dossier.employeeServices) ? dossier.employeeServices : []).slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }));
  }

  function seedDemoEmployeeServices(dossierId) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les services sont réservés au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (Array.isArray(dossier.employeeServices) && dossier.employeeServices.length) return { ok: false, errors: ['Des services existent déjà ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    dossier.employeeServices = [
      { code: 'DA', label: 'Direction Administrative' },
      { code: 'DF', label: 'Direction Financière' },
      { code: 'DG', label: 'Direction Générale' }
    ].map(function (item, index) {
      return Object.assign({ id: 'employee-service-test-' + item.code.toLowerCase(), dossierId: dossierId, order: index, status: 'test-only', createdAt: now, updatedAt: now }, item);
    });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer les services de test.'] };
    return { ok: true, errors: [], services: employeeServices(dossierId) };
  }

  function normalizeEmployeeServiceInput(input) {
    input = input || {};
    var code = String(input.code || '').trim();
    var label = String(input.label || '').trim().replace(/\\s+/g, ' ');
    var errors = [];
    if (!code) errors.push('Le code du service est obligatoire.');
    if (code.length > 24) errors.push('Le code est limité à 24 caractères.');
    if (!label) errors.push('L’intitulé du service est obligatoire.');
    if (label.length > 100) errors.push('L’intitulé est limité à 100 caractères.');
    return { ok: errors.length === 0, errors: errors, value: { code: code, label: label } };
  }

  function createEmployeeService(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La création est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’un service de test.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var validation = normalizeEmployeeServiceInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    dossier.employeeServices = Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
    if (dossier.employeeServices.some(function (item) { return String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de service existe déjà.'] };
    var now = new Date().toISOString();
    var record = Object.assign({ id: 'employee-service-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, order: dossier.employeeServices.length, status: 'test-only', createdAt: now, updatedAt: now }, validation.value);
    dossier.employeeServices.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le service de test.'] };
    return { ok: true, errors: [], service: clone(record) };
  }

  function updateEmployeeService(dossierId, serviceId, input) {
    dossierId = String(dossierId || ''); serviceId = String(serviceId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une modification fictive.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var services = dossier && Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
    var record = services.find(function (item) { return item && item.id === serviceId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['Le service est introuvable.'] };
    var validation = normalizeEmployeeServiceInput(input);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    if (services.some(function (item) { return item && item.id !== serviceId && String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de service existe déjà.'] };
    var previousCode = record.code;
    var previousLabel = record.label;
    Object.assign(record, validation.value, { updatedAt: new Date().toISOString() });
    (dossier.demoEmployees || []).forEach(function (employee) {
      if (employee && (employee.serviceId === serviceId || employee.service === previousCode || employee.service === previousLabel)) {
        employee.serviceId = serviceId;
        employee.service = record.label;
      }
    });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la modification du service.'] };
    return { ok: true, errors: [], service: clone(record) };
  }

  function deleteEmployeeService(dossierId, serviceId) {
    dossierId = String(dossierId || ''); serviceId = String(serviceId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var services = dossier && Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
    var service = services.find(function (item) { return item && item.id === serviceId && item.dossierId === dossierId; });
    if (!service) return { ok: false, errors: ['Le service est introuvable.'] };
    if ((dossier.demoEmployees || []).some(function (employee) { return employee && (employee.serviceId === serviceId || employee.service === service.code || employee.service === service.label); })) return { ok: false, errors: ['Ce service est affecté à une fiche employé ; utilisez la fusion vers un autre service ou modifiez son affectation.'] };
    dossier.employeeServices = services.filter(function (item) { return item && item.id !== serviceId; }).map(function (item, index) { item.order = index; return item; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer le service.'] };
    return { ok: true, errors: [], deletedServiceId: serviceId };
  }

  function positionEmployeeService(dossierId, serviceId, position) {
    dossierId = String(dossierId || ''); serviceId = String(serviceId || ''); position = Number(position);
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le positionnement est réservé au dossier fictif PRH-TEST-2026.'] };
    if (!Number.isInteger(position) || position < 1) return { ok: false, errors: ['La position doit être un entier positif.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var services = dossier && Array.isArray(dossier.employeeServices) ? dossier.employeeServices.slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }) : [];
    var currentIndex = services.findIndex(function (item) { return item && item.id === serviceId && item.dossierId === dossierId; });
    if (currentIndex === -1) return { ok: false, errors: ['Le service à positionner est introuvable.'] };
    if (position > services.length) return { ok: false, errors: ['La position ne peut pas dépasser le nombre de services.'] };
    var moved = services.splice(currentIndex, 1)[0];
    services.splice(position - 1, 0, moved);
    services.forEach(function (item, index) { item.order = index; });
    dossier.employeeServices = services;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le positionnement du service.'] };
    return { ok: true, errors: [], services: clone(services) };
  }

  function mergeEmployeeServices(dossierId, sourceServiceId, destinationServiceId) {
    dossierId = String(dossierId || ''); sourceServiceId = String(sourceServiceId || ''); destinationServiceId = String(destinationServiceId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La fusion est réservée au dossier fictif PRH-TEST-2026.'] };
    if (!sourceServiceId || !destinationServiceId || sourceServiceId === destinationServiceId) return { ok: false, errors: ['Choisissez deux services distincts pour la fusion.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var services = dossier && Array.isArray(dossier.employeeServices) ? dossier.employeeServices : [];
    var source = services.find(function (item) { return item && item.id === sourceServiceId && item.dossierId === dossierId; });
    var destination = services.find(function (item) { return item && item.id === destinationServiceId && item.dossierId === dossierId; });
    if (!source || !destination) return { ok: false, errors: ['Le service d’origine ou de destination n’existe plus dans ce dossier.'] };
    var reassignedCount = 0;
    (dossier.demoEmployees || []).forEach(function (employee) {
      if (employee && (employee.serviceId === sourceServiceId || employee.service === source.code || employee.service === source.label)) {
        employee.serviceId = destinationServiceId;
        employee.service = destination.label;
        reassignedCount += 1;
      }
    });
    dossier.employeeServices = services.filter(function (item) { return item && item.id !== sourceServiceId; }).sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }).map(function (item, index) { item.order = index; return item; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fusion des services.'] };
    return { ok: true, errors: [], sourceServiceId: sourceServiceId, destinationServiceId: destinationServiceId, reassignedCount: reassignedCount, services: employeeServices(dossierId) };
  }

  var EMPLOYEE_FUNCTION_PREMIUM_CATALOG = [{ id: 'responsibility-premium', label: 'Prime de responsabilité' }];
  function employeeFunctionPremiumCatalog(dossierId) {
    var dossier = isDemoTestDossier(dossierId) ? loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); }) : null;
    var custom = dossier && Array.isArray(dossier.employeeFunctionPremiums) ? dossier.employeeFunctionPremiums : [];
    return clone(EMPLOYEE_FUNCTION_PREMIUM_CATALOG.concat(custom));
  }

  function createEmployeeFunctionPremium(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les primes de fonction sont réservées à PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez que cette prime est une définition fictive de test.'] };
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    if (!label) return { ok: false, errors: ['Le libellé de la prime est obligatoire.'] };
    if (label.length > 100) return { ok: false, errors: ['Le libellé est limité à 100 caractères.'] };
    if (employeeFunctionPremiumCatalog(dossierId).some(function (item) { return String(item.label || '').toLocaleLowerCase() === label.toLocaleLowerCase(); })) return { ok: false, errors: ['Cette prime existe déjà dans le dossier de test.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    dossier.employeeFunctionPremiums = Array.isArray(dossier.employeeFunctionPremiums) ? dossier.employeeFunctionPremiums : [];
    var premium = { id: 'function-premium-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, label: label, status: 'test-only', createdAt: new Date().toISOString() };
    dossier.employeeFunctionPremiums.push(premium);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer cette prime de fonction.'] };
    return { ok: true, errors: [], premium: clone(premium) };
  }

  function deleteEmployeeFunctionPremium(dossierId, premiumId) {
    dossierId = String(dossierId || ''); premiumId = String(premiumId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression des primes de fonction est réservée à PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var premiums = dossier && Array.isArray(dossier.employeeFunctionPremiums) ? dossier.employeeFunctionPremiums : [];
    if (!premiums.some(function (item) { return item && item.id === premiumId && item.dossierId === dossierId; })) return { ok: false, errors: ['La prime complémentaire est introuvable.'] };
    if ((dossier.employeeFunctions || []).some(function (item) { return item && Array.isArray(item.linkedPremiumIds) && item.linkedPremiumIds.indexOf(premiumId) !== -1; })) return { ok: false, errors: ['Cette prime est liée à une fonction et ne peut pas être supprimée.'] };
    dossier.employeeFunctionPremiums = premiums.filter(function (item) { return item && item.id !== premiumId; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la prime complémentaire.'] };
    return { ok: true, errors: [], deletedPremiumId: premiumId };
  }

  function employeeFunctions(dossierId) {
    if (!isDemoTestDossier(dossierId)) return [];
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId); });
    return clone((dossier && Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : []).slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }));
  }

  function seedDemoEmployeeFunctions(dossierId) {
    dossierId = String(dossierId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les fonctions sont réservées au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (Array.isArray(dossier.employeeFunctions) && dossier.employeeFunctions.length) return { ok: false, errors: ['Des fonctions existent déjà ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    dossier.employeeFunctions = [{ id: 'employee-function-test-dg', dossierId: dossierId, code: 'DG', label: 'Directeur général', linkedPremiumIds: ['responsibility-premium'], order: 0, status: 'test-only', createdAt: now, updatedAt: now }];
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fonction de test.'] };
    return { ok: true, errors: [], functions: employeeFunctions(dossierId) };
  }

  function normalizeEmployeeFunctionInput(input, dossier) {
    input = input || {};
    var code = String(input.code || '').trim();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var linkedPremiumIds = Array.isArray(input.linkedPremiumIds) ? Array.from(new Set(input.linkedPremiumIds.map(String))) : [];
    var requestedPremiumAmounts = input.linkedPremiumAmounts && typeof input.linkedPremiumAmounts === 'object' && !Array.isArray(input.linkedPremiumAmounts) ? input.linkedPremiumAmounts : {};
    var linkedPremiumAmounts = {};
    var knownPremiumIds = {};
    employeeFunctionPremiumCatalog(dossier && dossier.id).forEach(function (item) { knownPremiumIds[item.id] = true; });
    var errors = [];
    if (!code) errors.push('Le code de la fonction est obligatoire.');
    if (code.length > 24) errors.push('Le code est limité à 24 caractères.');
    if (!label) errors.push('L’intitulé de la fonction est obligatoire.');
    if (label.length > 100) errors.push('L’intitulé est limité à 100 caractères.');
    if (linkedPremiumIds.some(function (id) { return !knownPremiumIds[id]; })) errors.push('La sélection contient une prime inconnue.');
    linkedPremiumIds.forEach(function (premiumId) {
      var rawAmount = String(requestedPremiumAmounts[premiumId] == null ? '' : requestedPremiumAmounts[premiumId]).trim();
      if (!rawAmount) return;
      if (rawAmount.length > 30 || !/^-?\d+(?:[.,]\d+)?$/.test(rawAmount)) {
        errors.push('Saisissez un montant numérique valide pour chaque prime liée.');
        return;
      }
      linkedPremiumAmounts[premiumId] = rawAmount.replace(',', '.');
    });
    return { ok: errors.length === 0, errors: errors, value: { code: code, label: label, linkedPremiumIds: linkedPremiumIds, linkedPremiumAmounts: linkedPremiumAmounts } };
  }

  function createEmployeeFunction(dossierId, input) {
    dossierId = String(dossierId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La création est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une fonction de test.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    var validation = normalizeEmployeeFunctionInput(input, dossier);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    dossier.employeeFunctions = Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : [];
    if (dossier.employeeFunctions.some(function (item) { return String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de fonction existe déjà.'] };
    var now = new Date().toISOString();
    var record = Object.assign({ id: 'employee-function-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7), dossierId: dossierId, order: dossier.employeeFunctions.length, status: 'test-only', createdAt: now, updatedAt: now }, validation.value);
    dossier.employeeFunctions.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fonction de test.'] };
    return { ok: true, errors: [], employeeFunction: clone(record) };
  }

  function updateEmployeeFunction(dossierId, functionId, input) {
    dossierId = String(dossierId || ''); functionId = String(functionId || ''); input = input || {};
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La modification est réservée au dossier fictif PRH-TEST-2026.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Confirmez qu’il s’agit d’une modification fictive.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var functions = dossier && Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : [];
    var record = functions.find(function (item) { return item && item.id === functionId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['La fonction est introuvable.'] };
    var validation = normalizeEmployeeFunctionInput(input, dossier);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    if (functions.some(function (item) { return item && item.id !== functionId && String(item.code || '').toLocaleLowerCase() === validation.value.code.toLocaleLowerCase(); })) return { ok: false, errors: ['Ce code de fonction existe déjà.'] };
    var previousCode = record.code;
    var previousLabel = record.label;
    Object.assign(record, validation.value, { updatedAt: new Date().toISOString() });
    (dossier.demoEmployees || []).forEach(function (employee) {
      if (!employee) return;
      var assignedFunctionIds = Array.isArray(employee.functionIds) ? employee.functionIds.slice() : (employee.functionId ? [employee.functionId] : []);
      if (assignedFunctionIds.indexOf(functionId) !== -1 || employee.function === previousCode || employee.function === previousLabel) {
        if (assignedFunctionIds.indexOf(functionId) === -1) assignedFunctionIds.push(functionId);
        employee.functionIds = assignedFunctionIds;
        employee.functionId = assignedFunctionIds.length === 1 ? assignedFunctionIds[0] : '';
        employee.function = assignedFunctionIds.map(function (assignedId) {
          var assignedFunction = functions.find(function (item) { return item && item.id === assignedId; });
          return assignedFunction ? assignedFunction.label : '';
        }).filter(Boolean).join(' · ');
      }
    });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la modification de la fonction.'] };
    return { ok: true, errors: [], employeeFunction: clone(record) };
  }

  function deleteEmployeeFunction(dossierId, functionId) {
    dossierId = String(dossierId || ''); functionId = String(functionId || '');
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['La suppression est réservée au dossier fictif PRH-TEST-2026.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var functions = dossier && Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions : [];
    var record = functions.find(function (item) { return item && item.id === functionId && item.dossierId === dossierId; });
    if (!record) return { ok: false, errors: ['La fonction est introuvable.'] };
    if ((dossier.demoEmployees || []).some(function (employee) { return employee && ((Array.isArray(employee.functionIds) && employee.functionIds.indexOf(functionId) !== -1) || employee.functionId === functionId || employee.function === record.code || employee.function === record.label); })) return { ok: false, errors: ['Cette fonction est affectée à une fiche employé et ne peut pas être supprimée. Retirez-la d’abord de chaque fiche.'] };
    dossier.employeeFunctions = functions.filter(function (item) { return item && item.id !== functionId; }).map(function (item, index) { item.order = index; return item; });
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible de supprimer la fonction.'] };
    return { ok: true, errors: [], deletedFunctionId: functionId };
  }

  function positionEmployeeFunction(dossierId, functionId, position) {
    dossierId = String(dossierId || ''); functionId = String(functionId || ''); position = Number(position);
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le positionnement est réservé au dossier fictif PRH-TEST-2026.'] };
    if (!Number.isInteger(position) || position < 1) return { ok: false, errors: ['La position doit être un entier positif.'] };
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    var functions = dossier && Array.isArray(dossier.employeeFunctions) ? dossier.employeeFunctions.slice().sort(function (left, right) { return Number(left.order || 0) - Number(right.order || 0); }) : [];
    var currentIndex = functions.findIndex(function (item) { return item && item.id === functionId && item.dossierId === dossierId; });
    if (currentIndex === -1) return { ok: false, errors: ['La fonction à positionner est introuvable.'] };
    if (position > functions.length) return { ok: false, errors: ['La position ne peut pas dépasser le nombre de fonctions.'] };
    var moved = functions.splice(currentIndex, 1)[0];
    functions.splice(position - 1, 0, moved);
    functions.forEach(function (item, index) { item.order = index; });
    dossier.employeeFunctions = functions;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le positionnement de la fonction.'] };
    return { ok: true, errors: [], functions: clone(functions) };
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

  function leaveAbsenceRecords(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.leaveAbsenceRecords)) return [];
    return clone(dossier.leaveAbsenceRecords.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function createLeaveAbsenceRecord(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des demandes et absences fictives de test.'] };
    var kind = String(input.kind || '');
    var employeeId = String(input.employeeId || '');
    var typeLabel = String(input.typeLabel || '').trim().replace(/\s+/g, ' ');
    var startDate = String(input.startDate || '');
    var endDate = String(input.endDate || '');
    var comment = String(input.comment || '').trim().replace(/\s+/g, ' ');
    var errors = [];
    if (kind !== 'request' && kind !== 'absence') errors.push('Choisissez demande de congé ou absence constatée.');
    if (!validDemoEmployee(dossier, employeeId)) errors.push('Choisissez un employé fictif du dossier RH courant.');
    if (!typeLabel) errors.push('Le type libre de test est obligatoire.');
    if (typeLabel.length > 60) errors.push('Le type de test ne peut pas dépasser 60 caractères.');
    if (comment.length > 160) errors.push('Le commentaire de test ne peut pas dépasser 160 caractères.');
    errors = errors.concat(validateTrackingDates(startDate, endDate, 'de période'));
    if (errors.length) return { ok: false, errors: errors };
    dossier.leaveAbsenceRecords = Array.isArray(dossier.leaveAbsenceRecords) ? dossier.leaveAbsenceRecords : [];
    var id;
    do { id = 'leave-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.leaveAbsenceRecords.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var record = { id: id, dossierId: dossierId, employeeId: employeeId, kind: kind,
      typeLabel: typeLabel, startDate: startDate, endDate: endDate, comment: comment,
      origin: 'test-only', history: [{ action: 'created', changedAt: now }], createdAt: now };
    dossier.leaveAbsenceRecords.push(record);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer l’enregistrement de test.'] };
    return { ok: true, errors: [], record: clone(record) };
  }

  function demoLeaveAbsenceSeeded(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    return !!(dossier && dossier.demoLeaveAbsenceSeededAt);
  }

  function seedDemoLeaveAbsenceData(dossierId) {
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le jeu prérempli est réservé au dossier de démonstration PRH-TEST-2026.'] };
    if (dossier.demoLeaveAbsenceSeededAt) return { ok: false, errors: ['Les exemples de demandes et absences sont déjà chargés.'] };
    dossier.leaveAbsenceRecords = Array.isArray(dossier.leaveAbsenceRecords) ? dossier.leaveAbsenceRecords : [];
    if (dossier.leaveAbsenceRecords.some(function (item) { return item && /^mock-leave-/.test(item.id || ''); })) {
      return { ok: false, errors: ['Des exemples DEMO similaires existent déjà ; aucune donnée n’a été ajoutée.'] };
    }
    var employees = dossier.demoEmployees.slice(0, 2);
    var now = new Date().toISOString();
    var records = [
      { id: 'mock-leave-request-001', dossierId: dossierId, employeeId: employees[0].id, kind: 'request', typeLabel: 'Type de test DEMO A — sans qualification légale', startDate: '2026-05-04', endDate: '2026-05-05', comment: 'Exemple de demande fictive', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now },
      { id: 'mock-leave-absence-001', dossierId: dossierId, employeeId: employees[1].id, kind: 'absence', typeLabel: 'Type de test DEMO B — sans qualification légale', startDate: '2026-06-08', endDate: '2026-06-09', comment: 'Exemple d’absence fictive', origin: 'demo-mock', history: [{ action: 'created', changedAt: now }], createdAt: now }
    ];
    dossier.leaveAbsenceRecords.push.apply(dossier.leaveAbsenceRecords, records);
    dossier.demoLeaveAbsenceSeededAt = now;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer les exemples de congés et absences.'] };
    return { ok: true, errors: [], records: clone(records) };
  }

  function payrollComponents(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.payrollComponents)) return [];
    return clone(dossier.payrollComponents.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function createPayrollComponent(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des rubriques descriptives de test.'] };
    var code = String(input.code || '').trim().toLocaleUpperCase();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var description = String(input.description || '').trim().replace(/\s+/g, ' ');
    var natureLabel = String(input.natureLabel || '').trim().replace(/\s+/g, ' ');
    var entryModeLabel = String(input.entryModeLabel || '').trim().replace(/\s+/g, ' ');
    var errors = [];
    if (!code) errors.push('Le code de rubrique fictive est obligatoire.');
    if (code.length > 40) errors.push('Le code ne peut pas dépasser 40 caractères.');
    if (!label) errors.push('Le libellé de rubrique fictive est obligatoire.');
    if (label.length > 120) errors.push('Le libellé ne peut pas dépasser 120 caractères.');
    if (description.length > 240) errors.push('La description ne peut pas dépasser 240 caractères.');
    if (natureLabel.length > 60 || entryModeLabel.length > 60) errors.push('Les libellés descriptifs ne peuvent pas dépasser 60 caractères.');
    dossier.payrollComponents = Array.isArray(dossier.payrollComponents) ? dossier.payrollComponents : [];
    if (code && dossier.payrollComponents.some(function (item) { return item && String(item.code || '').toLocaleLowerCase() === code.toLocaleLowerCase(); })) {
      errors.push('Ce code de rubrique existe déjà dans ce dossier RH.');
    }
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do { id = 'component-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.payrollComponents.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var component = { id: id, dossierId: dossierId, code: code, label: label, description: description,
      natureLabel: natureLabel, entryModeLabel: entryModeLabel, origin: 'test-only',
      calculationConfigured: false, createdAt: now, history: [{ action: 'created', changedAt: now }] };
    dossier.payrollComponents.push(component);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la rubrique de test.'] };
    return { ok: true, errors: [], component: clone(component) };
  }

  function payrollVariableReferences(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.payrollVariableReferences)) return [];
    return clone(dossier.payrollVariableReferences.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function createPayrollVariableReference(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des références de variable de test.'] };
    var employeeId = String(input.employeeId || '');
    var componentId = String(input.componentId || '');
    var period = String(input.period || '');
    var sourceReference = String(input.sourceReference || '').trim();
    var label = String(input.label || '').trim().replace(/\s+/g, ' ');
    var errors = [];
    if (!validDemoEmployee(dossier, employeeId)) errors.push('Choisissez un employé fictif du dossier RH courant.');
    dossier.payrollComponents = Array.isArray(dossier.payrollComponents) ? dossier.payrollComponents : [];
    var component = dossier.payrollComponents.find(function (item) { return item && item.id === componentId && item.dossierId === dossierId; });
    if (!component) errors.push('Choisissez une rubrique fictive du même dossier RH.');
    if (!validPeriod(period)) errors.push('Choisissez une période mensuelle de test valide.');
    if (sourceReference.length > 80) errors.push('La référence de source ne peut pas dépasser 80 caractères.');
    if (!label) errors.push('Le libellé de référence est obligatoire.');
    if (label.length > 120) errors.push('Le libellé ne peut pas dépasser 120 caractères.');
    if (errors.length) return { ok: false, errors: errors };
    dossier.payrollVariableReferences = Array.isArray(dossier.payrollVariableReferences) ? dossier.payrollVariableReferences : [];
    var id;
    do { id = 'variable-ref-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.payrollVariableReferences.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var reference = { id: id, dossierId: dossierId, employeeId: employeeId, componentId: componentId,
      period: period, sourceReference: sourceReference, label: label, origin: 'test-only',
      valueProvided: false, createdAt: now, history: [{ action: 'created', changedAt: now }] };
    dossier.payrollVariableReferences.push(reference);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la référence de variable.'] };
    return { ok: true, errors: [], reference: clone(reference) };
  }

  function demoPayrollReferencesSeeded(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    return !!(dossier && dossier.demoPayrollReferencesSeededAt);
  }

  function seedDemoPayrollReferences(dossierId) {
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Les données préremplies sont réservées au dossier PRH-TEST-2026.'] };
    if (dossier.demoPayrollReferencesSeededAt) return { ok: false, errors: ['Les références de rémunération DEMO sont déjà chargées.'] };
    dossier.payrollComponents = Array.isArray(dossier.payrollComponents) ? dossier.payrollComponents : [];
    dossier.payrollVariableReferences = Array.isArray(dossier.payrollVariableReferences) ? dossier.payrollVariableReferences : [];
    if (dossier.payrollComponents.some(function (item) { return item && /^MOCK-COMP-/.test(item.code || ''); }) ||
        dossier.payrollVariableReferences.some(function (item) { return item && /^mock-variable-ref-/.test(item.id || ''); })) {
      return { ok: false, errors: ['Des exemples DEMO similaires existent déjà ; aucun doublon n’a été ajouté.'] };
    }
    var now = new Date().toISOString();
    var components = [
      { id: 'mock-component-a', dossierId: dossierId, code: 'MOCK-COMP-A', label: 'Composante fictive A — DEMO', description: 'Libellé synthétique sans règle de calcul.', natureLabel: '', entryModeLabel: '', origin: 'demo-mock', calculationConfigured: false, createdAt: now, history: [{ action: 'created', changedAt: now }] },
      { id: 'mock-component-b', dossierId: dossierId, code: 'MOCK-COMP-B', label: 'Composante fictive B — DEMO', description: 'Libellé synthétique sans règle de calcul.', natureLabel: '', entryModeLabel: '', origin: 'demo-mock', calculationConfigured: false, createdAt: now, history: [{ action: 'created', changedAt: now }] }
    ];
    var employees = dossier.demoEmployees.slice(0, 2);
    var references = [
      { id: 'mock-variable-ref-a', dossierId: dossierId, employeeId: employees[0].id, componentId: components[0].id, period: '2026-05', sourceReference: 'DEMO-SOURCE-A', label: 'Référence fictive sans valeur', origin: 'demo-mock', valueProvided: false, createdAt: now, history: [{ action: 'created', changedAt: now }] },
      { id: 'mock-variable-ref-b', dossierId: dossierId, employeeId: employees[1].id, componentId: components[1].id, period: '2026-06', sourceReference: 'DEMO-SOURCE-B', label: 'Référence fictive sans valeur', origin: 'demo-mock', valueProvided: false, createdAt: now, history: [{ action: 'created', changedAt: now }] }
    ];
    dossier.payrollComponents.push.apply(dossier.payrollComponents, components);
    dossier.payrollVariableReferences.push.apply(dossier.payrollVariableReferences, references);
    dossier.demoPayrollReferencesSeededAt = now;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le jeu DEMO des rubriques.'] };
    return { ok: true, errors: [], components: clone(components), references: clone(references) };
  }

  var COUNTRY_RULE_SOURCE_KINDS = ['official-text', 'collective-agreement', 'public-instruction', 'internal-policy', 'synthetic-test'];

  function countryRulePacks(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.countryRulePacks)) return [];
    return clone(dossier.countryRulePacks.filter(function (item) { return item && item.dossierId === dossierId; }));
  }

  function countryRuleCandidates(dossierId, packId) {
    dossierId = String(dossierId || '');
    packId = String(packId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.countryRuleCandidates)) return [];
    return clone(dossier.countryRuleCandidates.filter(function (item) {
      return item && item.dossierId === dossierId && (!packId || item.packId === packId);
    }));
  }

  function createCountryRulePack(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des cadres pays de test.'] };
    var countryCode = String(input.countryCode || '').trim().toLocaleUpperCase();
    var countryLabel = String(input.countryLabel || '').trim().replace(/\s+/g, ' ');
    var domainCode = String(input.domainCode || '').trim().toLocaleUpperCase();
    var domainLabel = String(input.domainLabel || '').trim().replace(/\s+/g, ' ');
    var versionLabel = String(input.versionLabel || '').trim();
    var errors = [];
    if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('Le code pays doit être un code à deux lettres saisi explicitement.');
    if (!countryLabel) errors.push('Le libellé du pays est obligatoire.');
    if (countryLabel.length > 80) errors.push('Le libellé du pays ne peut pas dépasser 80 caractères.');
    if (!/^[A-Z0-9_-]{2,32}$/.test(domainCode)) errors.push('Le code de domaine de test doit contenir de 2 à 32 lettres, chiffres, tirets ou soulignés.');
    if (!domainLabel) errors.push('Le libellé du domaine est obligatoire.');
    if (domainLabel.length > 100) errors.push('Le libellé du domaine ne peut pas dépasser 100 caractères.');
    if (!versionLabel) errors.push('L’étiquette de version de test est obligatoire.');
    if (versionLabel.length > 40) errors.push('L’étiquette de version ne peut pas dépasser 40 caractères.');
    dossier.countryRulePacks = Array.isArray(dossier.countryRulePacks) ? dossier.countryRulePacks : [];
    if (dossier.countryRulePacks.some(function (item) {
      return item && item.countryCode === countryCode && item.domainCode === domainCode && String(item.versionLabel || '').toLocaleLowerCase() === versionLabel.toLocaleLowerCase();
    })) errors.push('Cette version de cadre existe déjà dans ce dossier RH.');
    if (errors.length) return { ok: false, errors: errors };
    var id;
    do { id = 'country-pack-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.countryRulePacks.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var pack = {
      id: id, dossierId: dossierId, countryCode: countryCode, countryLabel: countryLabel,
      domainCode: domainCode, domainLabel: domainLabel, versionLabel: versionLabel,
      status: 'en préparation', origin: 'test-only', activated: false,
      activationEnabled: false, createdAt: now,
      history: [{ action: 'created', changedAt: now, status: 'en préparation' }]
    };
    dossier.countryRulePacks.push(pack);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le cadre pays de test.'] };
    return { ok: true, errors: [], pack: clone(pack) };
  }

  function createCountryRuleCandidate(dossierId, packId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    packId = String(packId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des fiches candidates fictives.'] };
    dossier.countryRulePacks = Array.isArray(dossier.countryRulePacks) ? dossier.countryRulePacks : [];
    var pack = dossier.countryRulePacks.find(function (item) { return item && item.id === packId && item.dossierId === dossierId; });
    if (!pack) return { ok: false, errors: ['Le cadre pays doit appartenir au même dossier RH.'] };
    var title = String(input.title || '').trim().replace(/\s+/g, ' ');
    var sourceKind = String(input.sourceKind || '');
    var sourceTitle = String(input.sourceTitle || '').trim().replace(/\s+/g, ' ');
    var sourceAuthority = String(input.sourceAuthority || '').trim().replace(/\s+/g, ' ');
    var sourceVersion = String(input.sourceVersion || '').trim();
    var sourceLocation = String(input.sourceLocation || '').trim();
    var sourceReference = String(input.sourceReference || '').trim();
    var applicabilityNote = String(input.applicabilityNote || '').trim().replace(/\s+/g, ' ');
    var validFrom = String(input.validFrom || '');
    var validTo = String(input.validTo || '');
    var errors = [];
    if (!title) errors.push('Le titre descriptif de la fiche candidate est obligatoire.');
    if (title.length > 120) errors.push('Le titre ne peut pas dépasser 120 caractères.');
    if (COUNTRY_RULE_SOURCE_KINDS.indexOf(sourceKind) < 0) errors.push('Choisissez un type de référence connu.');
    if (sourceTitle.length > 160 || sourceAuthority.length > 120 || sourceVersion.length > 80 || sourceLocation.length > 120 || sourceReference.length > 120) errors.push('Une référence de source dépasse la longueur autorisée.');
    if (applicabilityNote.length > 240) errors.push('La note de périmètre ne peut pas dépasser 240 caractères.');
    if ((validFrom && !dateParts(validFrom)) || (validTo && !dateParts(validTo))) errors.push('Les dates de validité, si renseignées, doivent être des dates valides.');
    if (validFrom && validTo && validTo < validFrom) errors.push('La fin de validité ne peut pas précéder le début.');
    if (errors.length) return { ok: false, errors: errors };
    dossier.countryRuleCandidates = Array.isArray(dossier.countryRuleCandidates) ? dossier.countryRuleCandidates : [];
    var id;
    do { id = 'country-rule-candidate-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.countryRuleCandidates.some(function (item) { return item && item.id === id; }));
    var now = new Date().toISOString();
    var candidate = {
      id: id, dossierId: dossierId, packId: packId, title: title, sourceKind: sourceKind,
      sourceTitle: sourceTitle, sourceAuthority: sourceAuthority, sourceVersion: sourceVersion,
      sourceLocation: sourceLocation, sourceReference: sourceReference, applicabilityNote: applicabilityNote,
      validFrom: validFrom, validTo: validTo, status: 'à documenter', sourceVerified: false,
      interpretationValidated: false, approved: false, active: false, origin: 'test-only',
      createdAt: now, history: [{ action: 'created', changedAt: now, status: 'à documenter' }]
    };
    dossier.countryRuleCandidates.push(candidate);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fiche candidate de test.'] };
    return { ok: true, errors: [], candidate: clone(candidate) };
  }

  function countryRulePackCoverage(dossierId, packId) {
    var packs = countryRulePacks(dossierId);
    var pack = packs.find(function (item) { return item.id === String(packId || ''); });
    if (!pack) return { ok: false, ready: false, reasons: ['Cadre pays introuvable dans ce dossier RH.'] };
    var candidates = countryRuleCandidates(dossierId, pack.id);
    var reasons = ['Aucune règle n’est validée ou activée dans ce prototype.'];
    if (!candidates.length) reasons.unshift('Aucune fiche candidate ni source n’est documentée.');
    else if (candidates.some(function (item) { return !item.sourceVerified; })) reasons.unshift('Les références de source restent à vérifier.');
    reasons.push('Le périmètre requis et les catégories applicables ne sont pas définis.');
    reasons.push('L’approbateur et les cas de référence ne sont pas renseignés.');
    reasons.push('Aucune formule, base, valeur ou donnée de calcul n’est enregistrée.');
    return { ok: true, ready: false, activated: false, reasons: reasons, candidateCount: candidates.length };
  }

  function demoCountryRulePackSeeded(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item && item.id === String(dossierId || ''); });
    return !!(dossier && dossier.demoCountryRulePackSeededAt);
  }

  function seedDemoCountryRulePack(dossierId) {
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (!isDemoTestDossier(dossierId)) return { ok: false, errors: ['Le jeu de cadres pays est réservé au dossier PRH-TEST-2026.'] };
    if (dossier.demoCountryRulePackSeededAt) return { ok: false, errors: ['Le jeu DEMO des cadres pays est déjà chargé.'] };
    dossier.countryRulePacks = Array.isArray(dossier.countryRulePacks) ? dossier.countryRulePacks : [];
    dossier.countryRuleCandidates = Array.isArray(dossier.countryRuleCandidates) ? dossier.countryRuleCandidates : [];
    if (dossier.countryRulePacks.some(function (item) { return item && item.id === 'demo-country-pack-bj-v1'; }) ||
        dossier.countryRuleCandidates.some(function (item) { return item && item.id === 'demo-country-candidate-empty'; })) return { ok: false, errors: ['Un cadre DEMO existe déjà ; aucun doublon n’a été ajouté.'] };
    var now = new Date().toISOString();
    var pack = {
      id: 'demo-country-pack-bj-v1', dossierId: dossierId, countryCode: 'BJ', countryLabel: 'Bénin — démonstration',
      domainCode: 'DEMO-EMPTY', domainLabel: 'Domaine fictif non juridique', versionLabel: 'DEMO-0.1',
      status: 'en préparation', origin: 'demo-mock', activated: false, activationEnabled: false,
      createdAt: now, history: [{ action: 'created', changedAt: now, status: 'en préparation' }]
    };
    var candidate = {
      id: 'demo-country-candidate-empty', dossierId: dossierId, packId: pack.id,
      title: 'Entrée synthétique — aucune règle juridique', sourceKind: 'synthetic-test',
      sourceTitle: 'Référence fictive de démonstration', sourceAuthority: 'Aucune autorité — jeu DEMO',
      sourceVersion: '', sourceLocation: '', sourceReference: 'DEMO-SANS-SOURCE', applicabilityNote: 'Scénario de test uniquement ; aucune applicabilité réelle.',
      validFrom: '', validTo: '', status: 'à documenter', sourceVerified: false,
      interpretationValidated: false, approved: false, active: false, origin: 'demo-mock',
      createdAt: now, history: [{ action: 'created', changedAt: now, status: 'à documenter' }]
    };
    dossier.countryRulePacks.push(pack);
    dossier.countryRuleCandidates.push(candidate);
    dossier.demoCountryRulePackSeededAt = now;
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer le jeu DEMO des cadres pays.'] };
    return { ok: true, errors: [], pack: clone(pack), candidate: clone(candidate) };
  }

  function payrollBatchPreparations(dossierId) {
    dossierId = String(dossierId || '');
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier || !Array.isArray(dossier.payrollBatchPreparations)) return [];
    return clone(dossier.payrollBatchPreparations.filter(function (item) { return item && item.dossierId === dossierId; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }));
  }

  function createPayrollBatchPreparation(dossierId, input) {
    input = input || {};
    dossierId = String(dossierId || '');
    var catalog = loadDossierCatalog();
    var dossier = catalog.dossiers.find(function (item) { return item.id === dossierId; });
    if (!dossier) return { ok: false, errors: ['Dossier Paie & RH introuvable.'] };
    if (input.testOnly !== true) return { ok: false, errors: ['Cette version locale accepte uniquement des fiches de préparation de test.'] };
    var packId = String(input.packId || '');
    var period = String(input.period || '');
    var pack = (Array.isArray(dossier.countryRulePacks) ? dossier.countryRulePacks : []).find(function (item) {
      return item && item.id === packId && item.dossierId === dossierId;
    });
    var errors = [];
    if (!pack) errors.push('Choisissez un cadre pays du même dossier RH.');
    if (!validPeriod(period)) errors.push('Choisissez une période de paie mensuelle valide.');
    else if (!periodFitsDossier(period, dossier)) errors.push('La période doit se situer dans le cycle du dossier RH.');
    if (errors.length) return { ok: false, errors: errors };
    dossier.payrollBatchPreparations = Array.isArray(dossier.payrollBatchPreparations) ? dossier.payrollBatchPreparations : [];
    var now = new Date().toISOString();
    var coverage = countryRulePackCoverage(dossierId, packId);
    var blockers = coverage.ok ? coverage.reasons.slice() : ['Le cadre pays n’a pas pu être contrôlé.'];
    blockers.push('Aucun employé n’est sélectionné ni qualifié pour ce lot de préparation.');
    blockers.push('Aucun contrat, événement ou référence de variable n’est approuvé comme entrée du calcul.');
    blockers.push('Les dates de coupure, règles d’inclusion et rôles de lancement restent à valider.');
    blockers.push('Aucune exécution de calcul n’est disponible dans ce prototype.');
    var id;
    do { id = 'payroll-batch-prep-test-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
    while (dossier.payrollBatchPreparations.some(function (item) { return item && item.id === id; }));
    var preparation = {
      id: id, dossierId: dossierId, packId: packId, countryCode: pack.countryCode,
      countryLabel: pack.countryLabel, packDomainCode: pack.domainCode,
      packDomainLabel: pack.domainLabel, packVersion: pack.versionLabel, period: period,
      status: 'calcul incomplet / bloqué', origin: 'test-only', executionEnabled: false,
      employeeIds: [], blockers: blockers, createdAt: now,
      sourceSnapshot: { employeeIds: [], contractIds: [], leaveAbsenceRecordIds: [], payrollVariableReferenceIds: [], capturedAt: now },
      history: [{ action: 'created', changedAt: now, status: 'calcul incomplet / bloqué' }]
    };
    dossier.payrollBatchPreparations.push(preparation);
    if (!saveDossierCatalog(catalog)) return { ok: false, errors: ['Impossible d’enregistrer la fiche de préparation de test.'] };
    return { ok: true, errors: [], preparation: clone(preparation) };
  }

  function executePayrollBatchPreparation() {
    return { ok: false, errors: ['Calcul refusé : aucune règle approuvée, entrée qualifiée ou exécution de paie n’est disponible. La fiche de préparation reste bloquée et aucun résultat n’a été créé.'] };
  }

  function payrollBatchControlState(dossierId, preparationId) {
    var preparation = payrollBatchPreparations(dossierId).find(function (item) { return item.id === String(preparationId || ''); });
    if (!preparation) return { ok: false, approved: false, locked: false, reasons: ['Fiche de préparation introuvable dans ce dossier RH.'] };
    return {
      ok: true, preparationId: preparation.id, status: preparation.status,
      approved: false, locked: false,
      reasons: preparation.blockers.concat([
        'Aucun rôle ni séparation des tâches n’est configuré pour ce prototype local.',
        'Aucun contrôle métier n’a été qualifié ou exécuté ; les blocages affichés sont structurels.',
        'Aucune action de revue, approbation, verrouillage, réouverture ou annulation n’est activée.'
      ]),
      transitions: [
        { action: 'review', enabled: false }, { action: 'approve', enabled: false },
        { action: 'lock', enabled: false }, { action: 'reopen', enabled: false },
        { action: 'cancel', enabled: false }
      ]
    };
  }

  function refusePayrollBatchTransition() {
    return { ok: false, errors: ['Action refusée : aucun rôle, contrôle ou calcul validé n’est disponible. La fiche et son historique restent inchangés.'] };
  }

  function submitPayrollBatchForReview() { return refusePayrollBatchTransition(); }
  function approvePayrollBatch() { return refusePayrollBatchTransition(); }
  function lockPayrollBatch() { return refusePayrollBatchTransition(); }
  function reopenPayrollBatch() { return refusePayrollBatchTransition(); }
  function cancelPayrollBatch() { return refusePayrollBatchTransition(); }

  function payrollEditionReadiness(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier) return { ok: false, available: false, editions: [], errors: ['Dossier Paie & RH introuvable.'] };
    var editions = [
      { id: 'payslip', label: 'Bulletin individuel', reasons: [
        'Aucun lot calculé, contrôlé, approuvé et verrouillé n’est disponible.',
        'Mentions, numérotation, rôles et canal de remise non validés.',
        'Aucun stockage protégé ni journal de génération n’est configuré.'
      ] },
      { id: 'register', label: 'Registre RH ou de paie', reasons: [
        'Colonnes, format, périmètre d’export et politique de masquage non validés.',
        'Les droits de génération, téléchargement, partage et conservation ne sont pas définis.'
      ] },
      { id: 'report', label: 'État ou tableau de suivi', reasons: [
        'Aucune définition ou méthode d’agrégation n’est approuvée.',
        'Période, filtres, sources et traitement des données manquantes restent à préciser.'
      ] },
      { id: 'payment-proof', label: 'Preuve ou document de paiement', reasons: [
        'Aucune preuve de paiement vérifiée ni procédure de remise n’est disponible.',
        'Aucun stockage protégé ou accès restreint aux pièces n’est configuré.'
      ] }
    ].map(function (edition) { return Object.assign({}, edition, { enabled: false, fileGenerated: false }); });
    return { ok: true, available: false, dossierId: dossier.id, editions: clone(editions),
      note: 'Aucun PDF, tableur, document imprimable, fichier ou lien de partage n’est généré.' };
  }

  function payrollAccountingCentralizationReadiness(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier) return { ok: false, available: false, transferEnabled: false, errors: ['Dossier Paie & RH introuvable.'] };
    var associated = typeof dossier.accountingDossierId === 'string' && dossier.accountingDossierId.trim().length > 0;
    return {
      ok: true,
      available: false,
      transferEnabled: false,
      accountingEntryCreated: false,
      dossierId: dossier.id,
      associationConfigured: associated,
      associationReference: associated ? dossier.accountingDossierId : '',
      checks: [
        { id: 'destination', label: 'Dossier comptable existant, accessible et confirmé', ready: false,
          reason: associated ? 'Une référence explicite est enregistrée, mais son existence, son accès et sa confirmation pour cette opération doivent être vérifiés.' : 'Aucun dossier comptable n’est associé explicitement.' },
        { id: 'source', label: 'Lot source approuvé et verrouillé', ready: false,
          reason: 'Aucun lot calculé, approuvé et verrouillé avec version source qualifiée n’est disponible.' },
        { id: 'mappings', label: 'Comptes et dimensions exactement mappés', ready: false,
          reason: 'Aucun mapping comptable Paie & RH exact, sourcé et approuvé n’est configuré.' },
        { id: 'preview', label: 'Aperçu contrôlé avant transfert', ready: false,
          reason: 'Aucun aperçu Paie & RH n’est produit tant que les dossiers, sources et mappings ne sont pas validés.' },
        { id: 'authorization', label: 'Confirmation par un rôle autorisé', ready: false,
          reason: 'Les rôles, délégations et séparation des tâches applicables restent à définir.' },
        { id: 'accounting-workflow', label: 'Écriture créée et suivie par la Comptabilité', ready: false,
          reason: 'Aucun adaptateur ni retour réel de création comptable n’est qualifié dans ce parcours.' }
      ],
      note: 'Aucune écriture, ligne, montant, compte, transfert ou lien de source n’est créé. Toute correction reste dans le parcours Comptabilité générale.'
    };
  }

  function payrollReportReadiness(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier) return { ok: false, available: false, families: [], errors: ['Dossier Paie & RH introuvable.'] };
    var employees = Array.isArray(dossier.demoEmployees) ? dossier.demoEmployees : [];
    var tracking = Array.isArray(dossier.hrTrackingRecords) ? dossier.hrTrackingRecords : [];
    var assignments = Array.isArray(dossier.organizationAssignments) ? dossier.organizationAssignments : [];
    var missions = Array.isArray(dossier.internalMissions) ? dossier.internalMissions : [];
    var leaveAbsences = Array.isArray(dossier.leaveAbsenceRecords) ? dossier.leaveAbsenceRecords : [];
    var components = Array.isArray(dossier.payrollComponents) ? dossier.payrollComponents : [];
    var variableReferences = Array.isArray(dossier.payrollVariableReferences) ? dossier.payrollVariableReferences : [];
    var rulePacks = Array.isArray(dossier.countryRulePacks) ? dossier.countryRulePacks : [];
    var preparations = Array.isArray(dossier.payrollBatchPreparations) ? dossier.payrollBatchPreparations : [];
    var payslips = Array.isArray(dossier.payslipDocuments) ? dossier.payslipDocuments : [];
    var paymentRecords = Array.isArray(dossier.payrollPaymentRecords) ? dossier.payrollPaymentRecords : [];
    var families = [
      { id: 'headcount', label: 'Effectifs et dossiers', sourceLabels: ['Fiches employés fictives'], sourcePresent: employees.length > 0,
        reason: 'La population à décompter, le statut retenu et la date de référence ne sont pas définis.' },
      { id: 'employment', label: 'Contrats, affectations et missions', sourceLabels: ['Suivis RH génériques', 'Affectations', 'Missions'], sourcePresent: tracking.length + assignments.length + missions.length > 0,
        reason: 'Les suivis et périodes saisies ne prouvent ni validité juridique, ni admissibilité, ni échéance.' },
      { id: 'leave-absence', label: 'Congés et absences', sourceLabels: ['Demandes et événements de test'], sourcePresent: leaveAbsences.length > 0,
        reason: 'Calendrier et règles de droits absents ; jours consommés et soldes non calculés.' },
      { id: 'payroll-results', label: 'Rémunérations et résultats de paie', sourceLabels: ['Catalogue descriptif', 'Références sans valeur', 'Préparations bloquées'], sourcePresent: components.length + variableReferences.length + preparations.length > 0,
        reason: 'Aucun calcul, résultat ou lot complet et approuvé n’est disponible.' },
      { id: 'tax-social', label: 'Fiscalité et cotisations', sourceLabels: ['Cadres pays de test'], sourcePresent: rulePacks.length > 0,
        reason: 'Aucun pack de règle n’est validé ou applicable ; aucun taux ni total ne peut être présenté.' },
      { id: 'payments', label: 'Paiements', sourceLabels: ['Bulletins et références de paiement'], sourcePresent: payslips.length + paymentRecords.length > 0,
        reason: 'Aucun bulletin source ni preuve de paiement vérifiée n’est disponible.' }
    ].map(function (family) {
      return Object.assign({}, family, { status: 'non défini / bloqué', reportAvailable: false });
    });
    return { ok: true, available: false, dossierId: dossier.id, families: clone(families),
      note: 'État de disponibilité seulement : aucun total, taux, solde, ratio, projection ou indicateur n’est calculé.' };
  }

  function payslipAndPaymentReadiness(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier) return { ok: false, ready: false, reasons: ['Dossier Paie & RH introuvable.'] };
    return {
      ok: true, ready: false, finalPayslipEnabled: false, paymentTrackingEnabled: false,
      payslipCount: Array.isArray(dossier.payslipDocuments) ? dossier.payslipDocuments.length : 0,
      paymentRecordCount: Array.isArray(dossier.payrollPaymentRecords) ? dossier.payrollPaymentRecords.length : 0,
      reasons: [
        'Aucun lot calculé, contrôlé, approuvé et verrouillé n’est disponible comme source.',
        'Aucun résultat approuvé, employé admissible ou snapshot de paie n’est disponible.',
        'Les mentions de bulletin, la numérotation, les rôles et le canal sécurisé de remise restent à valider.',
        'Aucune preuve de paiement vérifiée ni procédure d’allocation n’est configurée.',
        'Le stockage local ne protège pas les bulletins ou justificatifs réels.'
      ]
    };
  }

  function payslipDocuments(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier || !Array.isArray(dossier.payslipDocuments)) return [];
    return clone(dossier.payslipDocuments.filter(function (item) { return item && item.dossierId === String(dossierId); }));
  }

  function payrollPaymentRecords(dossierId) {
    var dossier = loadDossierCatalog().dossiers.find(function (item) { return item.id === String(dossierId || ''); });
    if (!dossier || !Array.isArray(dossier.payrollPaymentRecords)) return [];
    return clone(dossier.payrollPaymentRecords.filter(function (item) { return item && item.dossierId === String(dossierId); }));
  }

  function createPayslipPreview() {
    return { ok: false, errors: ['Aperçu refusé : aucun résultat calculé et vérifié n’est disponible. Aucun bulletin ni aperçu n’a été créé.'] };
  }

  function issuePayslip() {
    return { ok: false, errors: ['Émission refusée : un bulletin final exige un lot approuvé et verrouillé, des mentions validées et un stockage protégé.'] };
  }

  function recordPayrollPayment() {
    return { ok: false, errors: ['Paiement refusé : aucune somme, preuve, transaction ou allocation ne peut être enregistrée dans ce prototype.'] };
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
    updateEmployee: updateEmployee,
    deleteEmployee: deleteEmployee,
    employeeStatuses: employeeStatuses,
    employeeRubricCatalog: employeeRubricCatalog,
    employeeStatusDefaults: employeeStatusDefaults,
    seedDemoEmployeeStatuses: seedDemoEmployeeStatuses,
    createEmployeeStatus: createEmployeeStatus,
    updateEmployeeStatus: updateEmployeeStatus,
    deleteEmployeeStatus: deleteEmployeeStatus,
    employeeCategories: employeeCategories,
    employeeCategoryClassifications: employeeCategoryClassifications,
    employeeCategoryPremiumCatalog: employeeCategoryPremiumCatalog,
    employeeCategoryAdditionalClassifications: employeeCategoryAdditionalClassifications,
    createEmployeeCategoryAdditionalClassification: createEmployeeCategoryAdditionalClassification,
    deleteEmployeeCategoryAdditionalClassification: deleteEmployeeCategoryAdditionalClassification,
    seedDemoEmployeeCategories: seedDemoEmployeeCategories,
    createEmployeeCategory: createEmployeeCategory,
    updateEmployeeCategory: updateEmployeeCategory,
    deleteEmployeeCategory: deleteEmployeeCategory,
    positionEmployeeCategory: positionEmployeeCategory,
    employeeGeographicZones: employeeGeographicZones,
    seedDemoEmployeeGeographicZones: seedDemoEmployeeGeographicZones,
    createEmployeeGeographicZone: createEmployeeGeographicZone,
    updateEmployeeGeographicZone: updateEmployeeGeographicZone,
    deleteEmployeeGeographicZone: deleteEmployeeGeographicZone,
    positionEmployeeGeographicZone: positionEmployeeGeographicZone,
    employeeServices: employeeServices,
    seedDemoEmployeeServices: seedDemoEmployeeServices,
    createEmployeeService: createEmployeeService,
    updateEmployeeService: updateEmployeeService,
    deleteEmployeeService: deleteEmployeeService,
    positionEmployeeService: positionEmployeeService,
    mergeEmployeeServices: mergeEmployeeServices,
    employeeFunctionPremiumCatalog: employeeFunctionPremiumCatalog,
    createEmployeeFunctionPremium: createEmployeeFunctionPremium,
    deleteEmployeeFunctionPremium: deleteEmployeeFunctionPremium,
    employeeFunctions: employeeFunctions,
    seedDemoEmployeeFunctions: seedDemoEmployeeFunctions,
    createEmployeeFunction: createEmployeeFunction,
    updateEmployeeFunction: updateEmployeeFunction,
    deleteEmployeeFunction: deleteEmployeeFunction,
    positionEmployeeFunction: positionEmployeeFunction,
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
    leaveAbsenceRecords: leaveAbsenceRecords,
    createLeaveAbsenceRecord: createLeaveAbsenceRecord,
    demoLeaveAbsenceSeeded: demoLeaveAbsenceSeeded,
    seedDemoLeaveAbsenceData: seedDemoLeaveAbsenceData,
    payrollComponents: payrollComponents,
    createPayrollComponent: createPayrollComponent,
    payrollVariableReferences: payrollVariableReferences,
    createPayrollVariableReference: createPayrollVariableReference,
    demoPayrollReferencesSeeded: demoPayrollReferencesSeeded,
    seedDemoPayrollReferences: seedDemoPayrollReferences,
    countryRulePacks: countryRulePacks,
    countryRuleCandidates: countryRuleCandidates,
    createCountryRulePack: createCountryRulePack,
    createCountryRuleCandidate: createCountryRuleCandidate,
    countryRulePackCoverage: countryRulePackCoverage,
    demoCountryRulePackSeeded: demoCountryRulePackSeeded,
    seedDemoCountryRulePack: seedDemoCountryRulePack,
    payrollBatchPreparations: payrollBatchPreparations,
    createPayrollBatchPreparation: createPayrollBatchPreparation,
    executePayrollBatchPreparation: executePayrollBatchPreparation,
    payrollBatchControlState: payrollBatchControlState,
    submitPayrollBatchForReview: submitPayrollBatchForReview,
    approvePayrollBatch: approvePayrollBatch,
    lockPayrollBatch: lockPayrollBatch,
    reopenPayrollBatch: reopenPayrollBatch,
    cancelPayrollBatch: cancelPayrollBatch,
    payrollEditionReadiness: payrollEditionReadiness,
    payrollAccountingCentralizationReadiness: payrollAccountingCentralizationReadiness,
    payrollReportReadiness: payrollReportReadiness,
    payslipAndPaymentReadiness: payslipAndPaymentReadiness,
    payslipDocuments: payslipDocuments,
    payrollPaymentRecords: payrollPaymentRecords,
    createPayslipPreview: createPayslipPreview,
    issuePayslip: issuePayslip,
    recordPayrollPayment: recordPayrollPayment,
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
