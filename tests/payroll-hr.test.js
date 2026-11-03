/* Tests du socle local Paie & RH : fiches synthétiques et blocage des calculs inventés. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const PayrollHR = require('../modern-proto/js/payroll-hr.js');

const dossierResult = PayrollHR.createDossier({
  clientName: 'Dossier de test RH', clientCode: 'QHR',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(dossierResult.ok, true, dossierResult.errors.join('\n'));
const dossier = dossierResult.dossier;
assert.deepEqual(PayrollHR.runs(dossier.id), []);

const unconfirmed = PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-001', lastName: 'Personne', firstName: 'Fictive 001', testOnly: false
});
assert.equal(unconfirmed.ok, false, 'la saisie non confirmée comme test est refusée');
assert.deepEqual(PayrollHR.employees(dossier.id), []);

const created = PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-001', lastName: 'Personne', firstName: 'Fictive 001', testOnly: true
});
assert.equal(created.ok, true, created.errors.join('\n'));
assert.equal(created.employee.dossierId, dossier.id);
assert.equal(created.employee.employeeNumber, 'TEST-001');
assert.equal(created.employee.lastName, 'Personne');
assert.equal(created.employee.firstName, 'Fictive 001');
assert.equal(created.employee.displayName, 'Personne Fictive 001');
assert.equal(created.employee.status, 'test-only');
assert.ok(created.employee.id);
assert.equal('salary' in created.employee, false);
assert.equal('bankAccount' in created.employee, false);
assert.equal(PayrollHR.employees(dossier.id).length, 1);
assert.equal(PayrollHR.employee(dossier.id, created.employee.id).displayName, 'Personne Fictive 001');
assert.equal(PayrollHR.employee('other-dossier', created.employee.id), null, 'la lecture d’une fiche vérifie le dossier explicite');
assert.equal(PayrollHR.employee(dossier.id, 'missing-employee'), null, 'une fiche absente n’est pas exposée');
assert.deepEqual(PayrollHR.employees('other-dossier'), [], 'les fiches sont filtrées par dossier RH explicite');
assert.equal(PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'test-001', lastName: 'Autre', firstName: 'Fiche fictive', testOnly: true
}).ok, false, 'le numéro est unique sans distinction de casse dans le dossier');
assert.equal(PayrollHR.createEmployee('unknown-dossier', {
  employeeNumber: 'TEST-002', lastName: 'Personne', firstName: 'Fictive 002', testOnly: true
}).ok, false, 'un employé ne peut être créé que dans un dossier existant');
assert.equal(PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-002', lastName: '   ', firstName: '   ', testOnly: true
}).ok, false, 'le nom et les prénoms vides sont refusés');
assert.equal(PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-003', displayName: 'Identité legacy uniquement', testOnly: true
}).ok, false, 'un nom d’affichage seul ne remplace pas le nom et les prénoms obligatoires');

assert.equal(PayrollHR.createOrganizationUnit(dossier.id, {
  label: 'Direction test', type: 'Direction', effectiveDate: '2026-01-01', testOnly: false
}).ok, false, 'une structure non confirmée comme test est refusée');
const rootUnit = PayrollHR.createOrganizationUnit(dossier.id, {
  label: 'Direction test', type: 'Direction', code: 'DIR-TEST',
  description: 'Structure synthétique', effectiveDate: '2026-01-01', testOnly: true
});
assert.equal(rootUnit.ok, true, rootUnit.errors.join('\\n'));
const childUnit = PayrollHR.createOrganizationUnit(dossier.id, {
  label: 'Service fictif', type: 'Service', code: 'SRV-TEST', parentId: rootUnit.unit.id,
  effectiveDate: '2026-02-01', testOnly: true
});
assert.equal(childUnit.ok, true, childUnit.errors.join('\\n'));
assert.equal(childUnit.unit.parentId, rootUnit.unit.id);
assert.equal(PayrollHR.organizationUnits(dossier.id).length, 2);
assert.deepEqual(PayrollHR.organizationUnits('other-dossier'), [], 'les unités sont isolées par dossier RH');
assert.equal(PayrollHR.createOrganizationUnit(dossier.id, {
  label: 'Code dupliqué', type: 'Équipe', code: 'dir-test', effectiveDate: '2026-01-01', testOnly: true
}).ok, false, 'un code est unique sans distinction de casse dans le dossier');
assert.equal(PayrollHR.updateOrganizationUnit(dossier.id, rootUnit.unit.id, {
  label: 'Direction test', type: 'Direction', code: 'DIR-TEST', parentId: childUnit.unit.id,
  description: '', effectiveDate: '2026-03-01'
}).ok, false, 'un cycle hiérarchique est refusé');
const updatedUnit = PayrollHR.updateOrganizationUnit(dossier.id, childUnit.unit.id, {
  label: 'Service fictif modifié', type: 'Service', code: 'SRV-TEST', parentId: rootUnit.unit.id,
  description: '', effectiveDate: '2026-03-01'
});
assert.equal(updatedUnit.ok, true, updatedUnit.errors.join('\\n'));
assert.equal(updatedUnit.unit.history.at(-1).action, 'updated');
assert.equal(updatedUnit.unit.history.at(-1).before.label, 'Service fictif');
assert.equal(updatedUnit.unit.history.at(-1).after.label, 'Service fictif modifié');
assert.equal(PayrollHR.archiveOrganizationUnit(dossier.id, rootUnit.unit.id, '2026-04-01').ok, false,
  'une unité parente avec enfants actifs ne peut pas être archivée');
const archivedChild = PayrollHR.archiveOrganizationUnit(dossier.id, childUnit.unit.id, '2026-04-01');
assert.equal(archivedChild.ok, true, archivedChild.errors.join('\\n'));
assert.equal(archivedChild.unit.status, 'archived');
assert.equal(archivedChild.unit.history.at(-1).action, 'archived');
assert.equal(PayrollHR.updateOrganizationUnit(dossier.id, childUnit.unit.id, {
  label: 'Autre', type: 'Service', effectiveDate: '2026-05-01'
}).ok, false, 'une unité archivée est immuable');
assert.equal(PayrollHR.archiveOrganizationUnit(dossier.id, rootUnit.unit.id, '2026-04-02').ok, true);
assert.equal(PayrollHR.organizationUnits(dossier.id).filter(unit => unit.status === 'archived').length, 2);
const assignmentUnit = PayrollHR.createOrganizationUnit(dossier.id, {
  label: 'Unité affectation test', type: 'Unité de test', code: 'AFFECT-TEST',
  effectiveDate: '2026-05-01', testOnly: true
});
assert.equal(assignmentUnit.ok, true, assignmentUnit.errors.join('\\n'));
const assignment = PayrollHR.createOrganizationAssignment(dossier.id, {
  employeeId: created.employee.id, unitId: assignmentUnit.unit.id,
  functionLabel: 'Fonction de test', startDate: '2026-05-01', endDate: '', testOnly: true
});
assert.equal(assignment.ok, true, assignment.errors.join('\\n'));
assert.equal(assignment.assignment.history[0].action, 'created');
assert.equal(PayrollHR.createOrganizationAssignment(dossier.id, {
  employeeId: 'employee-from-other-folder', unitId: assignmentUnit.unit.id,
  startDate: '2026-05-01', testOnly: true
}).ok, false, 'une affectation exige un employé fictif du dossier');
assert.equal(PayrollHR.createOrganizationAssignment(dossier.id, {
  employeeId: created.employee.id, unitId: assignmentUnit.unit.id,
  startDate: '2026-06-02', endDate: '2026-06-01', testOnly: true
}).ok, false, 'une période d’affectation inversée est refusée');
assert.equal(PayrollHR.organizationAssignments('other-dossier').length, 0);
const mission = PayrollHR.createInternalMission(dossier.id, {
  employeeId: created.employee.id, unitId: assignmentUnit.unit.id, title: 'Mission fictive A',
  startDate: '2026-05-04', endDate: '2026-05-05', testOnly: true
});
assert.equal(mission.ok, true, mission.errors.join('\\n'));
assert.equal(mission.mission.history[0].action, 'created');
assert.equal(PayrollHR.createInternalMission(dossier.id, {
  employeeId: 'employee-from-other-folder', title: 'Mission test', startDate: '2026-05-04', testOnly: true
}).ok, false, 'une mission exige un participant fictif du dossier');
assert.equal(PayrollHR.internalMissions('other-dossier').length, 0);

assert.equal(PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'contract', reference: 'TEST-CTR-01', label: 'Suivi fictif', date: '2026-04-01', testOnly: false
}).ok, false, 'les suivis non confirmés comme test sont refusés');
const candidateTracking = PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'recruitment', reference: 'TEST-CAND-01', label: 'Étape fictive alpha', date: '2026-04-01', testOnly: true
});
const contractTracking = PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'contract', reference: 'TEST-CTR-01', label: 'Suivi contractuel synthétique', date: '2026-04-02', testOnly: true
});
const interimTracking = PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'interim', reference: 'TEST-INT-01', label: 'Suivi intérim neutre', date: '2026-04-03', testOnly: true
});
const departureTracking = PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'departure', reference: 'TEST-DEP-01', label: 'Suivi de départ fictif', date: '2026-04-04', testOnly: true
});
assert.equal(candidateTracking.ok, true, candidateTracking.errors.join('\\n'));
assert.equal(contractTracking.ok, true, contractTracking.errors.join('\\n'));
assert.equal(interimTracking.ok, true, interimTracking.errors.join('\\n'));
assert.equal(departureTracking.ok, true, departureTracking.errors.join('\\n'));
assert.deepEqual(PayrollHR.hrTrackingRecords(dossier.id).map(record => record.kind), ['recruitment', 'contract', 'interim', 'departure']);
assert.deepEqual(PayrollHR.hrTrackingRecords('other-dossier'), [], 'les suivis restent isolés dans leur dossier RH');
assert.equal(PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'contract', reference: 'test-ctr-01', label: 'Doublon', date: '2026-04-04', testOnly: true
}).ok, false, 'une référence de suivi est unique par type et dossier');
assert.equal(PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'unknown', reference: 'TEST-UNK', label: 'Type non configuré', date: '2026-04-04', testOnly: true
}).ok, false, 'un type de suivi non prévu est refusé');

assert.equal(PayrollHR.createLeaveAbsenceRecord(dossier.id, {
  kind: 'request', employeeId: created.employee.id, typeLabel: 'Type de test',
  startDate: '2026-05-04', endDate: '2026-05-05', testOnly: false
}).ok, false, 'une demande non confirmée comme test est refusée');
const leaveRequest = PayrollHR.createLeaveAbsenceRecord(dossier.id, {
  kind: 'request', employeeId: created.employee.id, typeLabel: 'Type libre fictif',
  startDate: '2026-05-04', endDate: '2026-05-05', comment: 'Note de test non médicale', testOnly: true
});
const absenceRecord = PayrollHR.createLeaveAbsenceRecord(dossier.id, {
  kind: 'absence', employeeId: created.employee.id, typeLabel: 'Autre type libre',
  startDate: '2026-05-04', endDate: '2026-05-05', testOnly: true
});
assert.equal(leaveRequest.ok, true, leaveRequest.errors.join('\\n'));
assert.equal(absenceRecord.ok, true, absenceRecord.errors.join('\\n'));
assert.equal(leaveRequest.record.kind, 'request');
assert.equal(absenceRecord.record.kind, 'absence');
assert.equal('status' in leaveRequest.record, false, 'aucun statut d’approbation n’est présumé');
assert.equal('days' in leaveRequest.record, false, 'aucun décompte de jours n’est calculé');
assert.equal(PayrollHR.createLeaveAbsenceRecord(dossier.id, {
  kind: 'absence', employeeId: 'employee-from-other-folder', typeLabel: 'Type fictif',
  startDate: '2026-05-04', endDate: '2026-05-05', testOnly: true
}).ok, false, 'une absence doit référencer un employé fictif du dossier');
assert.equal(PayrollHR.leaveAbsenceRecords(dossier.id).length, 2);
assert.deepEqual(PayrollHR.leaveAbsenceRecords('other-dossier'), [], 'les événements restent isolés par dossier');

assert.equal(PayrollHR.createPayrollComponent(dossier.id, {
  code: 'TEST-COMP-A', label: 'Composante de test A', natureLabel: '', entryModeLabel: '', testOnly: false
}).ok, false, 'une rubrique non confirmée comme test est refusée');
const component = PayrollHR.createPayrollComponent(dossier.id, {
  code: 'TEST-COMP-A', label: 'Composante de test A', description: 'Descriptive uniquement',
  natureLabel: 'Type libre de test', entryModeLabel: '', testOnly: true
});
assert.equal(component.ok, true, component.errors.join('\\n'));
assert.equal(component.component.calculationConfigured, false);
assert.equal(PayrollHR.createPayrollComponent(dossier.id, {
  code: 'test-comp-a', label: 'Doublon fictif', testOnly: true
}).ok, false, 'le code de rubrique est unique par dossier');
const variableReference = PayrollHR.createPayrollVariableReference(dossier.id, {
  employeeId: created.employee.id, componentId: component.component.id,
  period: '2026-05', sourceReference: 'SOURCE-TEST-A', label: 'Référence sans valeur', testOnly: true
});
assert.equal(variableReference.ok, true, variableReference.errors.join('\\n'));
assert.equal(variableReference.reference.valueProvided, false);
assert.equal('amount' in variableReference.reference, false);
assert.equal('quantity' in variableReference.reference, false);
assert.equal(PayrollHR.createPayrollVariableReference(dossier.id, {
  employeeId: 'employee-from-other-folder', componentId: component.component.id,
  period: '2026-05', label: 'Référence croisée', testOnly: true
}).ok, false, 'une référence rejette les relations employé inter-dossiers');
assert.equal(PayrollHR.createPayrollVariableReference(dossier.id, {
  employeeId: created.employee.id, componentId: component.component.id,
  period: '2026-13', label: 'Période invalide', testOnly: true
}).ok, false, 'la période mensuelle doit être valide');
assert.equal(PayrollHR.payrollComponents(dossier.id).length, 1);
assert.equal(PayrollHR.payrollVariableReferences(dossier.id).length, 1);
assert.equal(PayrollHR.payrollComponents('other-dossier').length, 0);
assert.equal(PayrollHR.payrollVariableReferences('other-dossier').length, 0);

assert.deepEqual(PayrollHR.accountingAccountCatalog(), [], 'aucun compte de paie n’est préconfiguré');
const fakeRun = PayrollHR.createDemoRun(dossier, '2026-01');
assert.equal(fakeRun.ok, false, 'aucun lot avec montant ou compte inventé ne peut être créé');
assert.deepEqual(PayrollHR.runs(dossier.id), [], 'aucun calcul fictif ne persiste');
assert.equal(PayrollHR.approveRun(dossier, 'missing-run').ok, false, 'aucun lot ne peut être approuvé sans calcul ni règles validés');
const legacyStorageKey = 'perfecto.payroll.v1.' + encodeURIComponent(dossier.id);
storage.set(legacyStorageKey, JSON.stringify({
  version: 1, dossierId: dossier.id,
  runs: [{ id: 'legacy-demo', dossierId: dossier.id, reference: 'LOT-DEMO', period: '2026-01', date: '2026-01-31', status: 'approved', origin: 'demo', accountingLines: [] }]
}));
assert.deepEqual(PayrollHR.runs(dossier.id), [], 'les anciens lots fictifs sont masqués et ne peuvent plus alimenter la centralisation');
assert.equal(PayrollHR.getRun(dossier.id, 'legacy-demo'), null);
assert.equal(PayrollHR.periodFitsDossier('2026-01', dossier), true);
assert.equal(PayrollHR.periodFitsDossier('2025-12', dossier), false);
assert.equal(PayrollHR.sourceId(dossier.id, 'run-test'), PayrollHR.sourceId(dossier.id, 'run-test'));
assert.notEqual(PayrollHR.sourceId(dossier.id, 'run-test'), PayrollHR.sourceId('other-dossier', 'run-test'));

const testDossier = PayrollHR.createTestDossier();
assert.equal(testDossier.ok, true, testDossier.errors.join('\n'));
assert.equal(testDossier.dossier.reference, 'PRH-TEST-2026');
assert.equal(testDossier.dossier.accountingDossierId, '');
assert.equal(testDossier.dossier.demoEmployees.length, 10);
assert.ok(testDossier.dossier.demoEmployees.every(employee => employee.dossierId === testDossier.dossier.id));
assert.ok(testDossier.dossier.demoEmployees.every(employee => employee.status === 'test-only' && !('salary' in employee)));
assert.deepEqual(PayrollHR.runs(testDossier.dossier.id), []);
assert.equal(PayrollHR.isDemoTestDossier(testDossier.dossier.id), true);
const addedTestEmployee = PayrollHR.createEmployee(testDossier.dossier.id, {
  employeeNumber: 'TEST-ADDED-01', lastName: 'Employé', firstName: 'Fictif supplémentaire', testOnly: true
});
assert.equal(addedTestEmployee.ok, true, addedTestEmployee.errors.join('\\n'));
assert.match(addedTestEmployee.employee.id, /^EMP-TEST-/);
assert.equal(PayrollHR.isDemoTestDossier(testDossier.dossier.id), true, 'l’ajout d’une fiche fictive conserve le dossier de test reconnu');
const profileUpdate = PayrollHR.updateEmployee(testDossier.dossier.id, addedTestEmployee.employee.id, {
  employeeNumber: 'TEST-ADDED-UPDATED', lastName: 'Employé', firstName: 'Fictif mis à jour', birthDate: '1990-05-12',
  childrenCount: '2', seniorityMonthsToDeduct: '1', socialInsuranceNumber: 'TEST-SS-0001',
  bankAccountNumber: 'TEST-ACCOUNT-0001', address: 'Adresse fictive 1', photoDataUrl: 'data:image/png;base64,ZmFrZQ=='
});
assert.equal(profileUpdate.ok, true, profileUpdate.errors.join('\\n'));
assert.equal(PayrollHR.employee(testDossier.dossier.id, addedTestEmployee.employee.id).birthDate, '1990-05-12');
assert.equal(PayrollHR.employee(testDossier.dossier.id, addedTestEmployee.employee.id).displayName, 'Employé Fictif mis à jour');
assert.equal(PayrollHR.employee(testDossier.dossier.id, addedTestEmployee.employee.id).bankAccountNumber, 'TEST-ACCOUNT-0001');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, addedTestEmployee.employee.id, { birthDate: '2026-02-31' }).ok, false, 'les dates de saisie sont contrôlées');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, addedTestEmployee.employee.id, { photoDataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }).ok, false, 'les photos sont limitées aux formats raster autorisés');
assert.equal(PayrollHR.updateEmployee(dossier.id, created.employee.id, { displayName: 'hors dossier test' }).ok, false, 'modification impossible hors PRH-TEST-2026');
assert.equal(PayrollHR.deleteEmployee(testDossier.dossier.id, addedTestEmployee.employee.id).ok, true);
assert.equal(PayrollHR.employee(testDossier.dossier.id, addedTestEmployee.employee.id), null);
assert.equal(PayrollHR.isDemoTestDossier(testDossier.dossier.id), true, 'le dossier test reste valide après suppression d’une fiche non liée');
assert.equal(PayrollHR.isDemoTestDossier(dossier.id), false, 'le préchargement est limité au dossier de démonstration identifié');
assert.deepEqual(PayrollHR.employeeStatuses(dossier.id), []);
assert.equal(PayrollHR.seedDemoEmployeeStatuses(dossier.id).ok, false);
const statusesSeed = PayrollHR.seedDemoEmployeeStatuses(testDossier.dossier.id);
assert.equal(statusesSeed.ok, true, statusesSeed.errors.join('\\n'));
assert.deepEqual(statusesSeed.statuses.map(status => [status.code, status.label]), [['A', 'Agent de l’État'], ['C', 'Contractuel'], ['O', 'Occasionnel'], ['S', 'Stagiaire']]);
assert.equal(statusesSeed.statuses[0].monthlyWorkDays, '21.66');
assert.equal(statusesSeed.statuses[0].monthlyWorkHours, '173.33');
assert.equal(statusesSeed.statuses[0].leaveDaysPerMonth, '2.00');
assert.equal(statusesSeed.statuses[0].leaveDayType, 'ouvrables');
const statusDefaults = PayrollHR.employeeStatusDefaults();
assert.equal(statusDefaults.rubricIds.length, 66, 'les 66 cases de référence sont cochées par défaut');
assert.ok(statusesSeed.statuses.every(status => status.ohadaClassification === 'Permanent' && status.monthlyWorkDays === '21.66' && status.monthlyWorkHours === '173.33' && status.leaveDaysPerMonth === '2.00' && status.leaveDayType === 'ouvrables'), 'tous les statuts reprennent les mêmes valeurs par défaut');
assert.ok(statusesSeed.statuses.every(status => JSON.stringify(status.rubricIds) === JSON.stringify(statusesSeed.statuses[0].rubricIds)), 'les mêmes 66 rubriques sont cochées par défaut pour chaque statut');
const legacyStatusCatalog = JSON.parse(localStorage.getItem('perfecto.payroll.dossiers.v1'));
const legacyStatusDossier = legacyStatusCatalog.dossiers.find(item => item.id === testDossier.dossier.id);
legacyStatusDossier.employeeStatuses.filter(status => status.code !== 'A').forEach(status => {
  delete status.defaultProfileVersion;
  status.ohadaClassification = '';
  status.monthlyWorkDays = '';
  status.monthlyWorkHours = '';
  status.leaveDaysPerMonth = '';
  status.leaveDayType = '';
  status.rubricIds = [];
});
localStorage.setItem('perfecto.payroll.dossiers.v1', JSON.stringify(legacyStatusCatalog));
const migratedStatuses = PayrollHR.employeeStatuses(testDossier.dossier.id);
assert.ok(migratedStatuses.every(status => status.rubricIds.length === 66 && status.ohadaClassification === 'Permanent' && status.monthlyWorkDays === '21.66'), 'les profils déjà chargés reçoivent les valeurs et rubriques communes');
const rubricCatalog = PayrollHR.employeeRubricCatalog();
assert.equal(new Set(rubricCatalog.map(item => item.id)).size, rubricCatalog.length, 'chaque rubrique possède un identifiant unique');
assert.ok(rubricCatalog.some(item => item.label === 'MONTANT À PAYER'));
assert.ok(rubricCatalog.some(item => item.id === 'advance-9-withheld-month'));
assert.equal(PayrollHR.seedDemoEmployeeStatuses(testDossier.dossier.id).ok, false, 'le chargement ne crée aucun doublon');
const statusA = statusesSeed.statuses[0];
assert.ok(statusA.rubricIds.includes('worked-days-total'));
assert.ok(!statusA.rubricIds.includes('worked-hours-total'));
const independentlyConfigurableRubric = rubricCatalog.find(item => !item.selectedByReference);
assert.ok(independentlyConfigurableRubric);
const assignedStatus = PayrollHR.updateEmployee(testDossier.dossier.id, testDossier.dossier.demoEmployees[0].id, { employeeStatus: statusA.id });
assert.equal(assignedStatus.ok, true, assignedStatus.errors.join('\\n'));
const createdWithStatus = PayrollHR.createEmployee(testDossier.dossier.id, { employeeNumber: 'TEST-STATUS-01', lastName: 'Employé', firstName: 'Lié au statut', employeeStatus: statusA.id, testOnly: true });
assert.equal(createdWithStatus.ok, true, createdWithStatus.errors.join('\\n'));
assert.equal(createdWithStatus.employee.employeeStatus, statusA.id);
assert.equal(PayrollHR.deleteEmployee(testDossier.dossier.id, createdWithStatus.employee.id).ok, true);
assert.equal(PayrollHR.deleteEmployeeStatus(testDossier.dossier.id, statusA.id).ok, false, 'un statut attribué à un employé ne peut pas être supprimé');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, testDossier.dossier.demoEmployees[1].id, { employeeStatus: 'missing-status' }).ok, false, 'un employé ne peut pas être lié à un statut absent');
const customStatus = PayrollHR.createEmployeeStatus(testDossier.dossier.id, {
  code: 'X', label: 'Statut fictif X', monthlyWorkDays: '20.5', leaveDayType: 'calendaires',
  rubricIds: [independentlyConfigurableRubric.id, independentlyConfigurableRubric.id], testOnly: true
});
assert.equal(customStatus.ok, true, customStatus.errors.join('\\n'));
assert.deepEqual(customStatus.employeeStatus.rubricIds, [independentlyConfigurableRubric.id], 'la sélection de rubriques est dédoublonnée');
assert.ok(!statusA.rubricIds.includes(independentlyConfigurableRubric.id), 'la sélection est propre à chaque statut');
assert.equal(PayrollHR.createEmployeeStatus(testDossier.dossier.id, { code: 'x', label: 'Code déjà pris', testOnly: true }).ok, false);
const updatedStatus = PayrollHR.updateEmployeeStatus(testDossier.dossier.id, customStatus.employeeStatus.id, {
  code: 'X', label: 'Statut fictif modifié', ohadaClassification: 'Occasionnel', monthlyWorkDays: '21.25',
  monthlyWorkHours: '170', leaveDaysPerMonth: '1.5', leaveDayType: 'ouvrables', rubricIds: rubricCatalog.slice(0, 2).map(item => item.id), testOnly: true
});
assert.equal(updatedStatus.ok, true, updatedStatus.errors.join('\\n'));
assert.equal(PayrollHR.deleteEmployeeStatus(testDossier.dossier.id, customStatus.employeeStatus.id).ok, true);
assert.equal(PayrollHR.deleteEmployeeStatus(testDossier.dossier.id, statusesSeed.statuses[1].id).ok, true);
assert.deepEqual(PayrollHR.employeeCategories(dossier.id), []);
const categorySeed = PayrollHR.seedDemoEmployeeCategories(testDossier.dossier.id);
assert.equal(categorySeed.ok, true, categorySeed.errors.join('\\n'));
assert.deepEqual(categorySeed.categories.map(category => [category.code, category.salaryIndex, category.ohadaClassification]), [['C1', '', 'Cadre supérieur']]);
assert.deepEqual(categorySeed.categories[0].linkedPremiumIds, ['categorical-salary']);
assert.deepEqual(PayrollHR.employeeCategoryClassifications(), ['Aucune', 'Cadre supérieur', 'Technicien supérieur/Cadre moyen', 'Technicien/Agent de maîtrise/Ouvrier qualifié', 'Employé/Ouvrier/Manœuvre/Apprenti']);
assert.equal(PayrollHR.employeeCategoryPremiumCatalog()[0].label, 'Salaire catégoriel');
assert.equal(PayrollHR.seedDemoEmployeeCategories(testDossier.dossier.id).ok, false, 'la catégorie C1 ne peut pas être doublée');
const categoryC1 = categorySeed.categories[0];
const addedClassification = PayrollHR.createEmployeeCategoryAdditionalClassification(testDossier.dossier.id, { label: 'Classe interne', testOnly: true });
assert.equal(addedClassification.ok, true, addedClassification.errors.join('\\n'));
assert.equal(PayrollHR.createEmployeeCategoryAdditionalClassification(testDossier.dossier.id, { label: 'classe INTERNE', testOnly: true }).ok, false, 'les classifications complémentaires sont uniques sans distinction de casse');
const categoryWithClassification = PayrollHR.updateEmployeeCategory(testDossier.dossier.id, categoryC1.id, { code: 'C1', salaryIndex: '', ohadaClassification: 'Cadre supérieur', linkedPremiumIds: ['categorical-salary'], additionalClassificationIds: [addedClassification.classification.id], testOnly: true });
assert.equal(categoryWithClassification.ok, true, categoryWithClassification.errors.join('\\n'));
assert.deepEqual(categoryWithClassification.category.additionalClassificationIds, [addedClassification.classification.id]);
assert.equal(PayrollHR.deleteEmployeeCategoryAdditionalClassification(testDossier.dossier.id, addedClassification.classification.id).ok, false, 'une classification utilisée ne peut pas être supprimée');
const categoryLinkedEmployee = PayrollHR.updateEmployee(testDossier.dossier.id, testDossier.dossier.demoEmployees[1].id, { categoryId: categoryC1.id });
assert.equal(categoryLinkedEmployee.ok, true, categoryLinkedEmployee.errors.join('\\n'));
const createdWithCategory = PayrollHR.createEmployee(testDossier.dossier.id, { employeeNumber: 'TEST-CATEGORY-01', lastName: 'Employé', firstName: 'Lié à C1', categoryId: categoryC1.id, testOnly: true });
assert.equal(createdWithCategory.ok, true, createdWithCategory.errors.join('\\n'));
assert.equal(createdWithCategory.employee.categoryId, categoryC1.id);
assert.equal(PayrollHR.deleteEmployee(testDossier.dossier.id, createdWithCategory.employee.id).ok, true);
assert.equal(PayrollHR.deleteEmployeeCategory(testDossier.dossier.id, categoryC1.id).ok, false, 'une catégorie liée à un employé ne peut pas être supprimée');
const categoryC2 = PayrollHR.createEmployeeCategory(testDossier.dossier.id, { code: 'C2', salaryIndex: '1.25', ohadaClassification: 'Aucune', linkedPremiumIds: ['categorical-salary', 'categorical-salary'], testOnly: true });
assert.equal(categoryC2.ok, true, categoryC2.errors.join('\\n'));
assert.deepEqual(categoryC2.category.linkedPremiumIds, ['categorical-salary']);
assert.equal(PayrollHR.createEmployeeCategory(testDossier.dossier.id, { code: 'c2', ohadaClassification: 'Aucune', testOnly: true }).ok, false);
assert.equal(PayrollHR.positionEmployeeCategory(testDossier.dossier.id, categoryC2.category.id, 1).ok, true);

const zoneSeed = PayrollHR.seedDemoEmployeeGeographicZones(testDossier.dossier.id);
assert.equal(zoneSeed.ok, true, zoneSeed.errors.join('\\n'));
assert.deepEqual(zoneSeed.zones.map(zone => [zone.code, zone.label]), [['0', 'Siège']]);
assert.equal(PayrollHR.seedDemoEmployeeGeographicZones(testDossier.dossier.id).ok, false, 'le référentiel zones ne doit pas être doublé');
assert.deepEqual(PayrollHR.employeeGeographicZones(dossier.id), [], 'les zones sont réservées au dossier PRH-TEST-2026');
assert.equal(PayrollHR.createEmployeeGeographicZone(dossier.id, { code: '1', label: 'Agence', testOnly: true }).ok, false);
const geographicZone = zoneSeed.zones[0];
const secondGeographicZone = PayrollHR.createEmployeeGeographicZone(testDossier.dossier.id, { code: '1', label: 'Agence', testOnly: true });
assert.equal(secondGeographicZone.ok, true, secondGeographicZone.errors.join('\\n'));
assert.equal(PayrollHR.createEmployeeGeographicZone(testDossier.dossier.id, { code: '1', label: 'Autre agence', testOnly: true }).ok, false, 'les codes de zone sont uniques');
assert.equal(PayrollHR.positionEmployeeGeographicZone(testDossier.dossier.id, secondGeographicZone.zone.id, 1).ok, true);
assert.equal(PayrollHR.employeeGeographicZones(testDossier.dossier.id)[0].id, secondGeographicZone.zone.id);
assert.equal(PayrollHR.updateEmployeeGeographicZone(testDossier.dossier.id, secondGeographicZone.zone.id, { code: '2', label: 'Agence régionale', testOnly: true }).ok, true);
assert.equal(PayrollHR.createEmployee(testDossier.dossier.id, { employeeNumber: 'TEST-GEO-001', lastName: 'Employé', firstName: 'Zone fictive', geographicZoneId: geographicZone.id, testOnly: true }).employee.geographicZoneId, geographicZone.id);
const geographicEmployee = PayrollHR.employees(testDossier.dossier.id).find(employee => employee.employeeNumber === 'TEST-GEO-001');
assert.equal(geographicEmployee.zone, 'Siège', 'la valeur historique Zone reste lisible');
assert.equal(PayrollHR.deleteEmployeeGeographicZone(testDossier.dossier.id, geographicZone.id).ok, false, 'une zone associée ne peut être supprimée');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, geographicEmployee.id, { geographicZoneId: secondGeographicZone.zone.id }).employee.zone, 'Agence régionale');
assert.equal(PayrollHR.updateEmployeeGeographicZone(testDossier.dossier.id, secondGeographicZone.zone.id, { code: '2', label: 'Agence locale', testOnly: true }).ok, true);
assert.equal(PayrollHR.employee(testDossier.dossier.id, geographicEmployee.id).zone, 'Agence locale', 'le libellé Employé suit la mise à jour du référentiel lié');
assert.equal(PayrollHR.deleteEmployeeGeographicZone(testDossier.dossier.id, geographicZone.id).ok, true, 'une zone inutilisée peut être supprimée');
assert.equal(PayrollHR.deleteEmployeeGeographicZone(testDossier.dossier.id, secondGeographicZone.zone.id).ok, false, 'une zone toujours associée ne peut être supprimée');
const serviceSeed = PayrollHR.seedDemoEmployeeServices(testDossier.dossier.id);
assert.equal(serviceSeed.ok, true, serviceSeed.errors.join('\\n'));
assert.deepEqual(serviceSeed.services.map(service => [service.code, service.label]), [['DA', 'Direction Administrative'], ['DF', 'Direction Financière'], ['DG', 'Direction Générale']]);
assert.equal(PayrollHR.seedDemoEmployeeServices(testDossier.dossier.id).ok, false, 'les services de la capture ne doivent pas être doublés');
assert.deepEqual(PayrollHR.employeeServices(dossier.id), [], 'les services sont réservés à PRH-TEST-2026');
assert.equal(PayrollHR.createEmployeeService(dossier.id, { code: 'X', label: 'Autre', testOnly: true }).ok, false);
const temporaryEmployeeService = PayrollHR.createEmployeeService(testDossier.dossier.id, { code: 'TMP', label: 'Service temporaire', testOnly: true });
assert.equal(temporaryEmployeeService.ok, true, temporaryEmployeeService.errors.join('\\n'));
assert.equal(PayrollHR.createEmployeeService(testDossier.dossier.id, { code: 'tmp', label: 'Code en double', testOnly: true }).ok, false, 'les codes services sont uniques sans distinction de casse');
assert.equal(PayrollHR.updateEmployeeService(testDossier.dossier.id, temporaryEmployeeService.service.id, { code: 'TMP2', label: 'Service temporaire modifié', testOnly: true }).ok, true);
assert.equal(PayrollHR.positionEmployeeService(testDossier.dossier.id, temporaryEmployeeService.service.id, 1).ok, true);
assert.equal(PayrollHR.employeeServices(testDossier.dossier.id)[0].id, temporaryEmployeeService.service.id);
assert.equal(PayrollHR.deleteEmployeeService(testDossier.dossier.id, temporaryEmployeeService.service.id).ok, true);
const administrativeService = PayrollHR.employeeServices(testDossier.dossier.id).find(service => service.code === 'DA');
const financeService = PayrollHR.employeeServices(testDossier.dossier.id).find(service => service.code === 'DF');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, geographicEmployee.id, { serviceId: administrativeService.id }).employee.service, 'Direction Administrative');
assert.equal(PayrollHR.deleteEmployeeService(testDossier.dossier.id, administrativeService.id).ok, false, 'un service lié à un employé ne peut être supprimé directement');
const mergedServices = PayrollHR.mergeEmployeeServices(testDossier.dossier.id, administrativeService.id, financeService.id);
assert.equal(mergedServices.ok, true, mergedServices.errors.join('\\n'));
assert.equal(mergedServices.reassignedCount, 1, 'la fusion transfère les affectations existantes');
assert.equal(PayrollHR.employee(testDossier.dossier.id, geographicEmployee.id).serviceId, financeService.id);
assert.equal(PayrollHR.employee(testDossier.dossier.id, geographicEmployee.id).service, 'Direction Financière');
assert.equal(PayrollHR.employeeServices(testDossier.dossier.id).some(service => service.id === administrativeService.id), false, 'le service source est supprimé après la fusion');
assert.equal(PayrollHR.deleteEmployeeService(testDossier.dossier.id, financeService.id).ok, false, 'la destination fusionnée reste protégée tant qu’elle est affectée');
assert.equal(PayrollHR.mergeEmployeeServices(testDossier.dossier.id, financeService.id, financeService.id).ok, false, 'un service ne peut pas être fusionné avec lui-même');
const functionSeed = PayrollHR.seedDemoEmployeeFunctions(testDossier.dossier.id);
assert.equal(functionSeed.ok, true, functionSeed.errors.join('\\n'));
assert.deepEqual(functionSeed.functions.map(employeeFunction => [employeeFunction.code, employeeFunction.label, employeeFunction.linkedPremiumIds]), [['DG', 'Directeur général', ['responsibility-premium']]]);
assert.equal(PayrollHR.employeeFunctionPremiumCatalog()[0].label, 'Prime de responsabilité');
assert.equal(PayrollHR.seedDemoEmployeeFunctions(testDossier.dossier.id).ok, false, 'la fonction de capture ne doit pas être doublée');
assert.deepEqual(PayrollHR.employeeFunctions(dossier.id), [], 'les fonctions sont réservées à PRH-TEST-2026');
assert.equal(PayrollHR.createEmployeeFunction(dossier.id, { code: 'X', label: 'Autre', testOnly: true }).ok, false);
const capturedFunction = functionSeed.functions[0];
const additionalFunctionPremium = PayrollHR.createEmployeeFunctionPremium(testDossier.dossier.id, { label: '  Prime   de projet  ', testOnly: true });
assert.equal(additionalFunctionPremium.ok, true, additionalFunctionPremium.errors.join('\\n'));
assert.equal(additionalFunctionPremium.premium.label, 'Prime de projet', 'les espaces superflus du libellé sont normalisés');
assert.equal(PayrollHR.employeeFunctionPremiumCatalog(testDossier.dossier.id).length, 2, 'le catalogue accepte une prime complémentaire');
assert.equal(PayrollHR.createEmployeeFunctionPremium(testDossier.dossier.id, { label: 'prime DE PROJET', testOnly: true }).ok, false, 'les primes du dossier ne sont pas doublées');
const temporaryFunction = PayrollHR.createEmployeeFunction(testDossier.dossier.id, { code: 'ASSIST', label: 'Assistant', linkedPremiumIds: [additionalFunctionPremium.premium.id], linkedPremiumAmounts: { [additionalFunctionPremium.premium.id]: '1250,50' }, testOnly: true });
assert.equal(temporaryFunction.ok, true, temporaryFunction.errors.join('\\n'));
assert.deepEqual(temporaryFunction.employeeFunction.linkedPremiumAmounts, { [additionalFunctionPremium.premium.id]: '1250.50' }, 'le montant décimal est enregistré avec la liaison sans être calculé');
assert.equal(PayrollHR.createEmployeeFunction(testDossier.dossier.id, { code: 'BAD-AMOUNT', label: 'Montant invalide', linkedPremiumIds: [additionalFunctionPremium.premium.id], linkedPremiumAmounts: { [additionalFunctionPremium.premium.id]: 'non-numérique' }, testOnly: true }).ok, false, 'un montant non numérique est refusé');
assert.equal(PayrollHR.createEmployeeFunction(testDossier.dossier.id, { code: 'assist', label: 'Autre assistant', testOnly: true }).ok, false, 'les codes fonction sont uniques sans distinction de casse');
const employeeCreatedWithFunctions = PayrollHR.createEmployee(testDossier.dossier.id, { employeeNumber: 'TEST-FUNC-001', lastName: 'Employé', firstName: 'Fonctions fictives', functionIds: [capturedFunction.id, temporaryFunction.employeeFunction.id], testOnly: true });
assert.equal(employeeCreatedWithFunctions.ok, true, employeeCreatedWithFunctions.errors.join('\\n'));
assert.deepEqual(employeeCreatedWithFunctions.employee.functionIds, [capturedFunction.id, temporaryFunction.employeeFunction.id], 'une fiche peut cumuler plusieurs fonctions distinctes');
assert.equal(employeeCreatedWithFunctions.employee.functionId, '', 'aucune fonction principale n’est inventée en cas de cumul');
const updatedCapturedFunction = PayrollHR.updateEmployeeFunction(testDossier.dossier.id, capturedFunction.id, { code: 'DG', label: 'Directeur général', linkedPremiumIds: ['responsibility-premium', additionalFunctionPremium.premium.id], linkedPremiumAmounts: { [additionalFunctionPremium.premium.id]: '8000.25' }, testOnly: true });
assert.equal(updatedCapturedFunction.ok, true, updatedCapturedFunction.errors.join('\\n'));
assert.equal(updatedCapturedFunction.employeeFunction.linkedPremiumAmounts[additionalFunctionPremium.premium.id], '8000.25', 'chaque fonction peut porter son propre montant descriptif');
assert.equal(temporaryFunction.employeeFunction.linkedPremiumAmounts[additionalFunctionPremium.premium.id], '1250.50', 'le montant de la même prime reste distinct par fonction');
assert.equal(PayrollHR.employee(testDossier.dossier.id, employeeCreatedWithFunctions.employee.id).function, 'Directeur général · Assistant', 'le cumul affiche les libellés associés');
assert.equal(PayrollHR.deleteEmployeeFunctionPremium(testDossier.dossier.id, additionalFunctionPremium.premium.id).ok, false, 'une prime liée à une fonction ne peut être supprimée');
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, geographicEmployee.id, { functionIds: [capturedFunction.id, temporaryFunction.employeeFunction.id] }).ok, true);
assert.deepEqual(PayrollHR.employee(testDossier.dossier.id, geographicEmployee.id).functionIds, [capturedFunction.id, temporaryFunction.employeeFunction.id]);
assert.equal(PayrollHR.updateEmployee(testDossier.dossier.id, geographicEmployee.id, { functionIds: [temporaryFunction.employeeFunction.id] }).employee.functionId, temporaryFunction.employeeFunction.id, 'une affectation unique conserve la compatibilité avec l’ancien champ');
assert.equal(PayrollHR.updateEmployeeFunction(testDossier.dossier.id, temporaryFunction.employeeFunction.id, { code: 'AST', label: 'Assistant de direction', linkedPremiumIds: [additionalFunctionPremium.premium.id], testOnly: true }).ok, true);
assert.equal(PayrollHR.positionEmployeeFunction(testDossier.dossier.id, temporaryFunction.employeeFunction.id, 1).ok, true);
assert.equal(PayrollHR.employeeFunctions(testDossier.dossier.id)[0].id, temporaryFunction.employeeFunction.id);
assert.equal(PayrollHR.deleteEmployeeFunction(testDossier.dossier.id, capturedFunction.id).ok, false, 'une fonction affectée ne peut pas être supprimée directement');
assert.equal(PayrollHR.deleteEmployeeFunction(testDossier.dossier.id, temporaryFunction.employeeFunction.id).ok, false, 'la fonction affectée à la fiche ne peut pas être supprimée');

assert.deepEqual(PayrollHR.employeeDefinitionItems(dossier.id, 'qualifications'), [], 'les nouveaux référentiels restent isolés dans PRH-TEST-2026');
assert.equal(PayrollHR.seedDemoEmployeeDefinitionItems(dossier.id, 'banks').ok, false, 'les banques de test ne sont pas chargées hors du dossier fictif');
const seededQualifications = PayrollHR.seedDemoEmployeeDefinitionItems(testDossier.dossier.id, 'qualifications');
assert.equal(seededQualifications.ok, true, seededQualifications.errors.join('\\n'));
assert.deepEqual(seededQualifications.items.map(item => [item.code, item.label]), [['01', 'Bac G2'], ['11', 'BTS en Informatique de Gestion']]);
const createdEmployeeWithQualifications = PayrollHR.createEmployee(testDossier.dossier.id, { employeeNumber: 'TEST-QUAL-001', lastName: 'Employé', firstName: 'Qualifié fictif', qualificationIds: seededQualifications.items.map(item => item.id), testOnly: true });
assert.equal(createdEmployeeWithQualifications.ok, true, createdEmployeeWithQualifications.errors.join('\\n'));
assert.deepEqual(createdEmployeeWithQualifications.employee.qualificationIds, seededQualifications.items.map(item => item.id), 'la création accepte plusieurs diplômes et qualifications');
const employeeWithQualifications = PayrollHR.updateEmployee(testDossier.dossier.id, geographicEmployee.id, { qualificationIds: seededQualifications.items.map(item => item.id) });
assert.equal(employeeWithQualifications.ok, true, employeeWithQualifications.errors.join('\\n'));
assert.deepEqual(employeeWithQualifications.employee.qualificationIds, seededQualifications.items.map(item => item.id), 'un employé peut porter plusieurs diplômes et qualifications');
assert.equal(PayrollHR.deleteEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', seededQualifications.items[0].id).ok, false, 'une qualification affectée à un employé est protégée');
const seededProfessions = PayrollHR.seedDemoEmployeeDefinitionItems(testDossier.dossier.id, 'professions');
assert.equal(seededProfessions.ok, true, seededProfessions.errors.join('\\n'));
assert.equal(seededProfessions.items.length, 7);
const seededFunds = PayrollHR.seedDemoEmployeeDefinitionItems(testDossier.dossier.id, 'socialFunds');
assert.equal(seededFunds.ok, true, seededFunds.errors.join('\\n'));
assert.deepEqual([seededFunds.items[0].label, seededFunds.items[0].address], ['GROUPAMA-VIE', 'Cotonou']);
const seededBanks = PayrollHR.seedDemoEmployeeDefinitionItems(testDossier.dossier.id, 'banks');
assert.equal(seededBanks.ok, true, seededBanks.errors.join('\\n'));
assert.deepEqual(seededBanks.items.map(bank => bank.code), ['BOA', 'EB', 'OB']);
assert.ok(seededBanks.items.every(bank => !bank.bankBranchCode && !bank.accountNumber), 'les exemples ne contiennent aucun RIB');
assert.equal(PayrollHR.mergeEmployeeBanks(testDossier.dossier.id, seededBanks.items[0].id, seededBanks.items[0].id).ok, false, 'une banque ne peut pas être fusionnée avec elle-même');
const mergedTestBanks = PayrollHR.mergeEmployeeBanks(testDossier.dossier.id, seededBanks.items[0].id, seededBanks.items[1].id);
assert.equal(mergedTestBanks.ok, true, mergedTestBanks.errors.join('\\n'));
assert.equal(mergedTestBanks.reassignedCount, 0, 'aucune opération sans lien explicite à une banque n’est réattribuée');
assert.equal(mergedTestBanks.banks.some(bank => bank.id === seededBanks.items[0].id), false, 'la fusion retire la référence source');
assert.equal(mergedTestBanks.banks.find(bank => bank.id === seededBanks.items[1].id).address, 'Cotonou');
const customQualification = PayrollHR.createEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', { code: '20', label: 'Certification fictive', testOnly: true });
assert.equal(customQualification.ok, true, customQualification.errors.join('\\n'));
assert.equal(PayrollHR.createEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', { code: '20', label: 'Doublon', testOnly: true }).ok, false, 'le code de qualification ne peut pas être doublé');
assert.equal(PayrollHR.updateEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', customQualification.item.id, { code: '21', label: 'Certification fictive modifiée', testOnly: true }).ok, true);
assert.equal(PayrollHR.positionEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', customQualification.item.id, 1).ok, true);
assert.equal(PayrollHR.deleteEmployeeDefinitionItem(testDossier.dossier.id, 'qualifications', customQualification.item.id).ok, true);

assert.deepEqual(PayrollHR.employeeCategories(testDossier.dossier.id).map(category => category.code), ['C2', 'C1']);
const updatedCategoryC2 = PayrollHR.updateEmployeeCategory(testDossier.dossier.id, categoryC2.category.id, { code: 'C2', salaryIndex: '2.5', ohadaClassification: 'Technicien supérieur/Cadre moyen', linkedPremiumIds: [], testOnly: true });
assert.equal(updatedCategoryC2.ok, true, updatedCategoryC2.errors.join('\\n'));
assert.equal(PayrollHR.deleteEmployeeCategory(testDossier.dossier.id, categoryC2.category.id).ok, true);
const unlinkedEmployeeCategory = PayrollHR.updateEmployee(testDossier.dossier.id, testDossier.dossier.demoEmployees[1].id, { categoryId: '' });
assert.equal(unlinkedEmployeeCategory.ok, true, unlinkedEmployeeCategory.errors.join('\\n'));
const categoryWithoutClassification = PayrollHR.updateEmployeeCategory(testDossier.dossier.id, categoryC1.id, { code: 'C1', salaryIndex: '', ohadaClassification: 'Cadre supérieur', linkedPremiumIds: ['categorical-salary'], additionalClassificationIds: [], testOnly: true });
assert.equal(categoryWithoutClassification.ok, true, categoryWithoutClassification.errors.join('\\n'));
assert.equal(PayrollHR.deleteEmployeeCategoryAdditionalClassification(testDossier.dossier.id, addedClassification.classification.id).ok, true);
assert.equal(PayrollHR.deleteEmployeeCategory(testDossier.dossier.id, categoryC1.id).ok, true);
const mockSeed = PayrollHR.seedDemoOrganizationData(testDossier.dossier.id);
assert.equal(mockSeed.ok, true, mockSeed.errors.join('\\n'));
assert.equal(mockSeed.organizationUnits.length, 2);
assert.equal(mockSeed.assignments.length, 2);
assert.equal(mockSeed.missions.length, 2);
assert.ok(mockSeed.assignments.every(item => item.origin === 'demo-mock' && item.dossierId === testDossier.dossier.id));
assert.ok(mockSeed.missions.every(item => item.origin === 'demo-mock' && item.dossierId === testDossier.dossier.id));
assert.equal(PayrollHR.deleteEmployee(testDossier.dossier.id, mockSeed.assignments[0].employeeId).ok, false, 'une fiche référencée par une affectation ne peut pas être supprimée');
assert.equal(PayrollHR.demoOrganizationSeeded(testDossier.dossier.id), true);
assert.equal(PayrollHR.seedDemoOrganizationData(testDossier.dossier.id).ok, false, 'le jeu exemple ne peut pas être dupliqué');
assert.equal(PayrollHR.seedDemoOrganizationData(dossier.id).ok, false, 'aucun jeu fictif prérempli dans un dossier ordinaire');
const leaveSeed = PayrollHR.seedDemoLeaveAbsenceData(testDossier.dossier.id);
assert.equal(leaveSeed.ok, true, leaveSeed.errors.join('\\n'));
assert.equal(leaveSeed.records.length, 2);
assert.deepEqual(leaveSeed.records.map(record => record.kind), ['request', 'absence']);
assert.ok(leaveSeed.records.every(record => record.origin === 'demo-mock' && record.dossierId === testDossier.dossier.id));
assert.equal(PayrollHR.demoLeaveAbsenceSeeded(testDossier.dossier.id), true);
assert.equal(PayrollHR.seedDemoLeaveAbsenceData(testDossier.dossier.id).ok, false, 'les exemples congés/absences ne se dupliquent pas');
assert.equal(PayrollHR.seedDemoLeaveAbsenceData(dossier.id).ok, false, 'les exemples congés restent réservés au dossier de test');
const payrollSeed = PayrollHR.seedDemoPayrollReferences(testDossier.dossier.id);
assert.equal(payrollSeed.ok, true, payrollSeed.errors.join('\\n'));
assert.equal(payrollSeed.components.length, 2);
assert.equal(payrollSeed.references.length, 2);
assert.ok(payrollSeed.components.every(item => item.origin === 'demo-mock' && item.calculationConfigured === false));
assert.ok(payrollSeed.references.every(item => item.origin === 'demo-mock' && item.valueProvided === false && !('amount' in item)));
assert.equal(PayrollHR.demoPayrollReferencesSeeded(testDossier.dossier.id), true);
assert.equal(PayrollHR.seedDemoPayrollReferences(testDossier.dossier.id).ok, false, 'les rubriques DEMO ne peuvent pas être dupliquées');
assert.equal(PayrollHR.seedDemoPayrollReferences(dossier.id).ok, false, 'les valeurs DEMO sont réservées au dossier de test');

assert.equal(PayrollHR.createCountryRulePack(dossier.id, {
  countryCode: 'BJ', countryLabel: 'Bénin test', domainCode: 'FISCAL-TEST', domainLabel: 'Domaine fictif', versionLabel: 'DEMO-0.1', testOnly: false
}).ok, false, 'un cadre pays non confirmé comme test est refusé');
const countryPack = PayrollHR.createCountryRulePack(dossier.id, {
  countryCode: 'BJ', countryLabel: 'Bénin test', domainCode: 'FISCAL-TEST',
  domainLabel: 'Domaine fictif non juridique', versionLabel: 'DEMO-0.1', testOnly: true
});
assert.equal(countryPack.ok, true, countryPack.errors.join('\\n'));
assert.equal(countryPack.pack.status, 'en préparation');
assert.equal(countryPack.pack.activationEnabled, false);
assert.equal(countryPack.pack.activated, false);
assert.equal(PayrollHR.createCountryRulePack(dossier.id, {
  countryCode: 'BJ', countryLabel: 'Bénin test', domainCode: 'FISCAL-TEST',
  domainLabel: 'Domaine fictif', versionLabel: 'demo-0.1', testOnly: true
}).ok, false, 'une version de cadre ne peut pas être dupliquée');
const countryCandidate = PayrollHR.createCountryRuleCandidate(dossier.id, countryPack.pack.id, {
  title: 'Fiche candidate de test', sourceKind: 'synthetic-test', sourceTitle: 'Source fictive',
  sourceReference: 'DEMO-NON-SOURCE', applicabilityNote: 'Scénario non juridique',
  validFrom: '', validTo: '', testOnly: true
});
assert.equal(countryCandidate.ok, true, countryCandidate.errors.join('\\n'));
assert.equal(countryCandidate.candidate.status, 'à documenter');
assert.equal(countryCandidate.candidate.sourceVerified, false);
assert.equal(countryCandidate.candidate.interpretationValidated, false);
assert.equal(countryCandidate.candidate.approved, false);
assert.equal(countryCandidate.candidate.active, false);
assert.equal('rate' in countryCandidate.candidate, false);
assert.equal('amount' in countryCandidate.candidate, false);
assert.equal(PayrollHR.createCountryRuleCandidate(dossier.id, countryPack.pack.id, {
  title: 'Période inversée', sourceKind: 'synthetic-test', validFrom: '2026-12-01', validTo: '2026-01-01', testOnly: true
}).ok, false, 'une période de validité inversée est rejetée');
assert.equal(PayrollHR.createCountryRuleCandidate('other-dossier', countryPack.pack.id, {
  title: 'Lien croisé', sourceKind: 'synthetic-test', testOnly: true
}).ok, false, 'une fiche candidate ne peut pas référencer le pack d’un autre dossier');
assert.equal(PayrollHR.countryRuleCandidates(dossier.id, countryPack.pack.id).length, 1);
assert.equal(PayrollHR.countryRulePacks('other-dossier').length, 0);
const countryCoverage = PayrollHR.countryRulePackCoverage(dossier.id, countryPack.pack.id);
assert.equal(countryCoverage.ready, false);
assert.equal(countryCoverage.activated, false);
assert.ok(countryCoverage.reasons.some(reason => reason.includes('Aucune règle')));
const countryPackSeed = PayrollHR.seedDemoCountryRulePack(testDossier.dossier.id);
assert.equal(countryPackSeed.ok, true, countryPackSeed.errors.join('\\n'));
assert.equal(countryPackSeed.pack.countryCode, 'BJ');
assert.equal(countryPackSeed.pack.origin, 'demo-mock');
assert.equal(countryPackSeed.pack.activationEnabled, false);
assert.equal(countryPackSeed.candidate.sourceKind, 'synthetic-test');
assert.equal(countryPackSeed.candidate.sourceVerified, false);
assert.equal(PayrollHR.demoCountryRulePackSeeded(testDossier.dossier.id), true);
assert.equal(PayrollHR.seedDemoCountryRulePack(testDossier.dossier.id).ok, false, 'le pack DEMO ne se duplique pas');
assert.equal(PayrollHR.seedDemoCountryRulePack(dossier.id).ok, false, 'le jeu DEMO est réservé à PRH-TEST-2026');
const blockedPreparation = PayrollHR.createPayrollBatchPreparation(testDossier.dossier.id, {
  packId: countryPackSeed.pack.id, period: '2026-09', testOnly: true
});
assert.equal(blockedPreparation.ok, true, blockedPreparation.errors.join('\\n'));
assert.equal(blockedPreparation.preparation.status, 'calcul incomplet / bloqué');
assert.equal(blockedPreparation.preparation.executionEnabled, false);
assert.deepEqual(blockedPreparation.preparation.employeeIds, []);
assert.deepEqual(blockedPreparation.preparation.sourceSnapshot.employeeIds, []);
assert.equal('amount' in blockedPreparation.preparation, false);
assert.equal('total' in blockedPreparation.preparation, false);
assert.ok(blockedPreparation.preparation.blockers.some(reason => reason.includes('Aucune règle')));
assert.ok(blockedPreparation.preparation.blockers.some(reason => reason.includes('Aucun employé')));
assert.equal(PayrollHR.createPayrollBatchPreparation(testDossier.dossier.id, {
  packId: countryPackSeed.pack.id, period: '2027-01', testOnly: true
}).ok, false, 'la période doit rester dans le cycle du dossier');
assert.equal(PayrollHR.createPayrollBatchPreparation(dossier.id, {
  packId: countryPackSeed.pack.id, period: '2026-09', testOnly: true
}).ok, false, 'le pack doit appartenir au même dossier RH');
assert.equal(PayrollHR.payrollBatchPreparations(testDossier.dossier.id).length, 1);
assert.equal(PayrollHR.payrollBatchPreparations(dossier.id).length, 0);
assert.equal(PayrollHR.executePayrollBatchPreparation(testDossier.dossier.id, blockedPreparation.preparation.id).ok, false);
assert.equal(PayrollHR.payrollBatchPreparations(testDossier.dossier.id).length, 1, 'une tentative refusée ne crée pas de résultat');
const blockedWorkflow = PayrollHR.payrollBatchControlState(testDossier.dossier.id, blockedPreparation.preparation.id);
assert.equal(blockedWorkflow.approved, false);
assert.equal(blockedWorkflow.locked, false);
assert.ok(blockedWorkflow.transitions.every(transition => transition.enabled === false));
for (const transition of [PayrollHR.submitPayrollBatchForReview, PayrollHR.approvePayrollBatch, PayrollHR.lockPayrollBatch, PayrollHR.reopenPayrollBatch, PayrollHR.cancelPayrollBatch]) {
  assert.equal(transition(testDossier.dossier.id, blockedPreparation.preparation.id, { testOnly: true }).ok, false);
}
assert.equal(PayrollHR.payrollBatchPreparations(testDossier.dossier.id)[0].status, 'calcul incomplet / bloqué', 'aucune transition refusée ne modifie la fiche');
assert.equal(PayrollHR.payrollBatchPreparations(testDossier.dossier.id)[0].history.length, 1, 'les actions refusées ne fabriquent pas de traces d’approbation');
const documentReadiness = PayrollHR.payslipAndPaymentReadiness(testDossier.dossier.id);
assert.equal(documentReadiness.ready, false);
assert.equal(documentReadiness.finalPayslipEnabled, false);
assert.equal(documentReadiness.paymentTrackingEnabled, false);
assert.deepEqual(PayrollHR.payslipDocuments(testDossier.dossier.id), []);
assert.deepEqual(PayrollHR.payrollPaymentRecords(testDossier.dossier.id), []);
assert.equal(PayrollHR.createPayslipPreview(testDossier.dossier.id, { employeeId: created.employee.id, testOnly: true }).ok, false);
assert.equal(PayrollHR.issuePayslip(testDossier.dossier.id, { amount: 1, testOnly: true }).ok, false);
assert.equal(PayrollHR.recordPayrollPayment(testDossier.dossier.id, { amount: 1, currency: 'XOF', testOnly: true }).ok, false);
assert.deepEqual(PayrollHR.payslipDocuments(testDossier.dossier.id), [], 'un aperçu ou bulletin refusé n’est pas enregistré');
assert.deepEqual(PayrollHR.payrollPaymentRecords(testDossier.dossier.id), [], 'aucun faux suivi de paiement n’est créé');
const reportReadiness = PayrollHR.payrollReportReadiness(testDossier.dossier.id);
assert.equal(reportReadiness.ok, true);
assert.equal(reportReadiness.available, false);
assert.equal(reportReadiness.families.length, 6);
assert.ok(reportReadiness.families.every(family => family.reportAvailable === false && family.status === 'non défini / bloqué'));
assert.equal(reportReadiness.families.find(family => family.id === 'headcount').sourcePresent, true);
assert.equal(reportReadiness.families.find(family => family.id === 'payments').sourcePresent, false);
assert.ok(reportReadiness.families.every(family => !('amount' in family) && !('total' in family) && !('count' in family)));
const editionReadiness = PayrollHR.payrollEditionReadiness(testDossier.dossier.id);
assert.equal(editionReadiness.ok, true);
assert.equal(editionReadiness.available, false);
assert.ok(editionReadiness.editions.length >= 3);
assert.ok(editionReadiness.editions.every(edition => edition.enabled === false && edition.fileGenerated === false));
assert.equal(PayrollHR.payrollEditionReadiness('unknown-dossier').ok, false);
const accountingReadiness = PayrollHR.payrollAccountingCentralizationReadiness(testDossier.dossier.id);
assert.equal(accountingReadiness.available, false);
assert.equal(accountingReadiness.transferEnabled, false);
assert.equal(accountingReadiness.accountingEntryCreated, false);
assert.equal(accountingReadiness.associationConfigured, false);
assert.ok(accountingReadiness.checks.every(check => check.ready === false));
const explicitLink = PayrollHR.updateAccountingDossierLink(testDossier.dossier.id, 'ACCOUNTING-EXPLICIT-TEST');
assert.equal(explicitLink.ok, true);
const linkedAccountingReadiness = PayrollHR.payrollAccountingCentralizationReadiness(testDossier.dossier.id);
assert.equal(linkedAccountingReadiness.associationConfigured, true);
assert.equal(linkedAccountingReadiness.associationReference, 'ACCOUNTING-EXPLICIT-TEST');
assert.equal(linkedAccountingReadiness.transferEnabled, false, 'un identifiant associé ne débloque ni transfert ni écriture');
assert.deepEqual(PayrollHR.runs(testDossier.dossier.id), [], 'la préparation de centralisation ne crée aucun lot');
console.log('Paie & RH : éditions et centralisation indisponibles sans prérequis validés — OK');
