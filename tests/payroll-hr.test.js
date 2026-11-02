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
  employeeNumber: 'TEST-001', displayName: 'Personne fictive 001', testOnly: false
});
assert.equal(unconfirmed.ok, false, 'la saisie non confirmée comme test est refusée');
assert.deepEqual(PayrollHR.employees(dossier.id), []);

const created = PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-001', displayName: 'Personne fictive 001', testOnly: true
});
assert.equal(created.ok, true, created.errors.join('\n'));
assert.equal(created.employee.dossierId, dossier.id);
assert.equal(created.employee.employeeNumber, 'TEST-001');
assert.equal(created.employee.displayName, 'Personne fictive 001');
assert.equal(created.employee.status, 'test-only');
assert.ok(created.employee.id);
assert.equal('salary' in created.employee, false);
assert.equal('bankAccount' in created.employee, false);
assert.equal(PayrollHR.employees(dossier.id).length, 1);
assert.equal(PayrollHR.employee(dossier.id, created.employee.id).displayName, 'Personne fictive 001');
assert.equal(PayrollHR.employee('other-dossier', created.employee.id), null, 'la lecture d’une fiche vérifie le dossier explicite');
assert.equal(PayrollHR.employee(dossier.id, 'missing-employee'), null, 'une fiche absente n’est pas exposée');
assert.deepEqual(PayrollHR.employees('other-dossier'), [], 'les fiches sont filtrées par dossier RH explicite');
assert.equal(PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'test-001', displayName: 'Autre fiche fictive', testOnly: true
}).ok, false, 'le numéro est unique sans distinction de casse dans le dossier');
assert.equal(PayrollHR.createEmployee('unknown-dossier', {
  employeeNumber: 'TEST-002', displayName: 'Personne fictive 002', testOnly: true
}).ok, false, 'un employé ne peut être créé que dans un dossier existant');
assert.equal(PayrollHR.createEmployee(dossier.id, {
  employeeNumber: 'TEST-002', displayName: '   ', testOnly: true
}).ok, false, 'un nom d’affichage fictif vide est refusé');

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
assert.equal(PayrollHR.isDemoTestDossier(dossier.id), false, 'le préchargement est limité au dossier de démonstration identifié');
const mockSeed = PayrollHR.seedDemoOrganizationData(testDossier.dossier.id);
assert.equal(mockSeed.ok, true, mockSeed.errors.join('\\n'));
assert.equal(mockSeed.organizationUnits.length, 2);
assert.equal(mockSeed.assignments.length, 2);
assert.equal(mockSeed.missions.length, 2);
assert.ok(mockSeed.assignments.every(item => item.origin === 'demo-mock' && item.dossierId === testDossier.dossier.id));
assert.ok(mockSeed.missions.every(item => item.origin === 'demo-mock' && item.dossierId === testDossier.dossier.id));
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
console.log('Paie & RH : jeux fictifs isolés, demandes, absences et références sans calcul — OK');
