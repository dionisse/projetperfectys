/* Registre isolé des dossiers clients Paie & RH. */
'use strict';

const assert = require('node:assert/strict');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};
const PayrollHR = require('../modern-proto/js/payroll-hr.js');

assert.deepEqual(PayrollHR.dossiers(), []);
assert.equal(PayrollHR.currentDossier(), null);

const created = PayrollHR.createDossier({
  clientName: '  Groupe Gobex   Bénin ',
  clientCode: 'gbx',
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31'
});
assert.equal(created.ok, true, created.errors.join('\n'));
assert.equal(created.dossier.clientName, 'Groupe Gobex Bénin');
assert.equal(created.dossier.clientCode, 'GBX');
assert.equal(created.dossier.reference, 'PRH-GBX-2026');
assert.equal(created.dossier.exerciseYear, 2026);
assert.equal(created.dossier.accountingDossierId, '', 'aucun dossier comptable n’est associé par défaut');
assert.equal(PayrollHR.currentDossier().id, created.dossier.id, 'le nouveau dossier RH devient actif');

const invalid = PayrollHR.createDossier({ clientName: 'Test', clientCode: 'X', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(invalid.ok, false, 'un code trop court est refusé');
const duplicate = PayrollHR.createDossier({ clientName: 'Autre nom', clientCode: 'gbx', cycleStart: '2026-02-01', cycleEnd: '2026-12-31' });
assert.equal(duplicate.ok, false, 'la référence PRH-code-année doit être unique');
const tooLong = PayrollHR.createDossier({ clientName: 'Test', clientCode: 'TST', cycleStart: '2025-01-01', cycleEnd: '2026-07-31' });
assert.equal(tooLong.ok, false, 'un cycle de plus de 18 mois est refusé');

const second = PayrollHR.createDossier({
  clientName: 'Groupe Gobex Bénin', clientCode: 'GBX', cycleStart: '2027-01-01', cycleEnd: '2027-12-31', accountingDossierId: 'accounting-folder-explicit'
});
assert.equal(second.ok, true, second.errors.join('\n'));
assert.equal(second.dossier.reference, 'PRH-GBX-2027');
assert.equal(second.dossier.accountingDossierId, 'accounting-folder-explicit', 'le lien n’existe que s’il a été fourni explicitement');
assert.equal(PayrollHR.dossiers().length, 2);
assert.equal(PayrollHR.selectDossier(created.dossier.id).ok, true);
assert.equal(PayrollHR.currentDossier().id, created.dossier.id);
assert.equal(PayrollHR.updateAccountingDossierLink(created.dossier.id, 'accounting-folder-explicit').ok, true);
assert.equal(PayrollHR.dossier(created.dossier.id).accountingDossierId, 'accounting-folder-explicit');
assert.equal(PayrollHR.updateAccountingDossierLink(created.dossier.id, '').ok, true);
assert.equal(PayrollHR.dossier(created.dossier.id).accountingDossierId, '', 'le lien peut être explicitement retiré');

const run = PayrollHR.createDemoRun(created.dossier, '2026-01');
assert.equal(run.ok, true, run.errors.join('\n'));
assert.equal(PayrollHR.runs(created.dossier.id).length, 1);
assert.deepEqual(PayrollHR.runs(second.dossier.id), [], 'les lots demeurent isolés par identifiant de dossier RH, jamais par comptabilité');
assert.notEqual(PayrollHR.sourceId(created.dossier.id, run.run.id), PayrollHR.sourceId(second.dossier.id, run.run.id));

const testDossier = PayrollHR.createTestDossier();
assert.equal(testDossier.ok, true, testDossier.errors.join('\n'));
assert.equal(testDossier.dossier.reference, 'PRH-TEST-2026');
assert.equal(testDossier.dossier.accountingDossierId, '');
assert.equal(testDossier.dossier.demoEmployees.length, 10);
assert.equal(testDossier.dossier.demoEmployees[0].displayName, 'Employé fictif 001');
assert.ok(testDossier.dossier.demoEmployees.every(employee => employee.status === 'test-only' && !('salary' in employee)));
assert.deepEqual(PayrollHR.runs(testDossier.dossier.id), [], 'le dossier test ne crée aucun lot de paie ou montant');
assert.equal(PayrollHR.createTestDossier().ok, false, 'le jeu de test ne se duplique pas');
console.log('Dossiers Paie & RH : identifiants PRH, cycles, association explicite, sélection et isolation des lots — OK');
