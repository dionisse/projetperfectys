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
