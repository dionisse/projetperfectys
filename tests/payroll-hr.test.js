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
assert.equal(candidateTracking.ok, true, candidateTracking.errors.join('\\n'));
assert.equal(contractTracking.ok, true, contractTracking.errors.join('\\n'));
assert.equal(interimTracking.ok, true, interimTracking.errors.join('\\n'));
assert.deepEqual(PayrollHR.hrTrackingRecords(dossier.id).map(record => record.kind), ['recruitment', 'contract', 'interim']);
assert.deepEqual(PayrollHR.hrTrackingRecords('other-dossier'), [], 'les suivis restent isolés dans leur dossier RH');
assert.equal(PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'contract', reference: 'test-ctr-01', label: 'Doublon', date: '2026-04-04', testOnly: true
}).ok, false, 'une référence de suivi est unique par type et dossier');
assert.equal(PayrollHR.createHRTrackingRecord(dossier.id, {
  kind: 'unknown', reference: 'TEST-UNK', label: 'Type non configuré', date: '2026-04-04', testOnly: true
}).ok, false, 'un type de suivi non prévu est refusé');

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
console.log('Paie & RH : création fictive d’employé, isolation dossier et blocage de paie non sourcée — OK');
