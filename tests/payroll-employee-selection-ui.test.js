'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../modern-proto/js/app.js'), 'utf8');
const start = source.indexOf('  function viewPayrollEmployeeDetails(');
const end = source.indexOf('  function viewPayrollEmployeeGeographicZones(', start);
assert.ok(start >= 0 && end > start);
const data = { functions: [], banks: [] };
const payroll = {
  isDemoTestDossier: () => true,
  employeeStatuses: () => [], employeeCategories: () => [], employeeGeographicZones: () => [], employeeServices: () => [],
  employeeFunctions: () => data.functions,
  employeeDefinitionItems: (id, kind) => kind === 'banks' ? data.banks : []
};
const context = { PayrollHR: payroll, ui: { payrollEmployeeCreateMode: true },
  hasDemoPermission: () => true, getActiveDemoMember: () => ({}), payrollAccessContext: () => ({}),
  esc: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const dossier = { id: 'test' };
let html = context.viewPayrollEmployeeDetails(dossier, [], true);
assert.match(html, /Aucune fonction à sélectionner/);
assert.match(html, /Définitions → Fonctions/);
assert.match(html, /Définitions → Banques/);
assert.match(html, /<select id="payroll-employee-create-paymentMethod" name="paymentMethod">/);
for (const method of ['Virement Bancaire', 'Mobile Money', 'Chèque', 'Autres']) assert.ok(html.includes('<option value="' + method + '">' + method + '</option>'));
assert.match(html, /<select id="payroll-employee-create-bankId" name="bankId"><option value="">— Sélectionner une banque —<\/option>/);
data.functions = [{ id: 'f1', code: 'DG', label: 'Direction' }, { id: 'f2', code: 'FIN', label: 'Finance' }];
data.banks = [{ id: 'b1', code: 'BOA', label: 'Banque fictive' }];
html = context.viewPayrollEmployeeDetails(dossier, [], true);
assert.match(html, /<input type="checkbox" name="functionIds" value="f1"><span>DG · Direction/);
assert.match(html, /<input type="checkbox" name="functionIds" value="f2"><span>FIN · Finance/);
assert.match(html, /<option value="b1">BOA · Banque fictive<\/option>/);
context.ui = { payrollEmployeeCreateMode: false, payrollEmployeeId: 'e1', payrollEmployeeEditId: 'e1' };
let employee = { id: 'e1', employeeNumber: '1', displayName: 'Fictif', functionIds: ['f2'], bankId: 'b1', paymentMethod: 'Mobile Money' };
html = context.viewPayrollEmployeeDetails(dossier, [employee], true);
assert.match(html, /name="functionIds" value="f2" checked/);
assert.match(html, /<option value="b1" selected>/);
assert.match(html, /<option value="Mobile Money" selected>/);
employee.paymentMethod = 'Ancien mode';
html = context.viewPayrollEmployeeDetails(dossier, [employee], true);
assert.match(html, /<option value="Ancien mode" selected>Ancien mode · valeur enregistrée/);
// Rendus distincts pour la caisse sociale et plusieurs contrats complémentaires.
data.socialSecurity = [{ id: 'cnss', label: 'CNSS' }];
data.insurers = [{ id: 'ass1', label: 'Assureur A' }, { id: 'ass2', label: 'Assureur B' }];
payroll.employeeDefinitionItems = (id, kind) => kind === 'banks' ? data.banks : kind === 'socialSecurityFunds' ? data.socialSecurity : kind === 'socialFunds' ? data.insurers : [];
context.ui = { payrollEmployeeCreateMode: true };
html = context.viewPayrollEmployeeDetails(dossier, [], true);
assert.match(html, /name="socialSecurityFundId"/);
assert.match(html, /<option value="cnss">CNSS<\/option>/);
assert.match(html, /<template data-payroll-insurance-template>/);
assert.match(html, /<option value="ass1">Assureur A<\/option>/);
assert.match(html, /<option value="ass2">Assureur B<\/option>/);
assert.match(html, /data-payroll-insurance-add/);
context.ui = { payrollEmployeeCreateMode: false, payrollEmployeeId: 'e1', payrollEmployeeEditId: 'e1' };
employee = { id: 'e1', displayName: 'Test', socialSecurityFundId: 'cnss', supplementaryInsuranceCompany: 'Ancienne valeur', supplementaryInsuranceNumber: 'ANCIEN', supplementaryInsurances: [{ insurerId: 'ass1', insuranceNumber: 'A-1' }, { insurerId: 'ass2', insuranceNumber: 'B-2' }] };
html = context.viewPayrollEmployeeDetails(dossier, [employee], true);
assert.match(html, /<option value="cnss" selected>/);
assert.match(html, /<option value="ass1" selected>/);
assert.match(html, /<option value="ass2" selected>/);
assert.match(html, /value="A-1"/); assert.match(html, /value="B-2"/);
assert.match(html, /Données d’assurance antérieures non classées/);
assert.match(html, /Ancienne valeur · N° ANCIEN/);
// Une valeur historique absente du référentiel ne disparaît pas à l’ouverture.
context.ui = { payrollEmployeeCreateMode: false, payrollEmployeeId: 'e1', payrollEmployeeEditId: 'e1' };
employee = { id: 'e1', displayName: 'Test', employeeStatus: 'Ancien statut', categoryStep: 'Ancienne catégorie', zone: 'Ancienne zone', service: 'Ancien service' };
html = context.viewPayrollEmployeeDetails(dossier, [employee], true);
for (const label of ['Ancien statut', 'Ancienne catégorie', 'Ancienne zone', 'Ancien service']) assert.ok(html.includes(label + ' · valeur enregistrée hors référentiel'));
// Le champ de diplômes occupe toute la largeur et conserve deux choix distincts.
data.qualifications = [{ id: 'q1', code: '01', label: 'Bac G2' }, { id: 'q2', code: '11', label: 'BTS en Informatique de Gestion' }];
payroll.employeeDefinitionItems = (id, kind) => kind === 'qualifications' ? data.qualifications : kind === 'banks' ? data.banks : kind === 'socialSecurityFunds' ? data.socialSecurity : kind === 'socialFunds' ? data.insurers : [];
context.ui = { payrollEmployeeCreateMode: true };
html = context.viewPayrollEmployeeDetails(dossier, [], true);
assert.match(html, /payroll-employee-qualification-field/);
assert.match(html, /name="qualificationIds" value="q1"><span>01 · Bac G2/);
assert.match(html, /name="qualificationIds" value="q2"><span>11 · BTS en Informatique de Gestion/);
context.ui = { payrollEmployeeCreateMode: false, payrollEmployeeId: 'e1', payrollEmployeeEditId: 'e1' };
html = context.viewPayrollEmployeeDetails(dossier, [{ id: 'e1', displayName: 'Fictif', qualificationIds: ['q1', 'q2'] }], true);
assert.match(html, /name="qualificationIds" value="q1" checked/);
assert.match(html, /name="qualificationIds" value="q2" checked/);
const css = fs.readFileSync(require('node:path').join(__dirname, '../modern-proto/css/modern.css'), 'utf8');
assert.match(css, /\.payroll-employee-qualification-field \.payroll-employee-function-checklist \{ grid-template-columns: minmax\(0, 1fr\); \}/);
