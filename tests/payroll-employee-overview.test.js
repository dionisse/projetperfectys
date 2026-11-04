'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modern-proto/css/modern.css'), 'utf8');
const begin = app.indexOf('  function viewPayrollEmployeeDetails(');
const end = app.indexOf('  function viewPayrollEmployeeGeographicZones(', begin);
const helpersStart = app.indexOf('  function trackPayrollEmployeeDraft(');
const helpersEnd = app.indexOf('  function validPayrollEmployeeFormTarget(', helpersStart);
assert.ok(begin >= 0 && end > begin && helpersStart >= 0 && helpersEnd > helpersStart);
let isTestDossier = true, canEdit = true;
const hr = { isDemoTestDossier: () => isTestDossier,
  employeeStatuses: () => [], employeeCategories: () => [], employeeGeographicZones: () => [],
  employeeServices: () => [{ id: 'svc', code: 'DF', label: 'Finance' }],
  employeeFunctions: () => [{ id: 'fun', code: 'DG', label: 'Directeur général' }], employeeDefinitionItems: () => [] };
const ctx = { PayrollHR: hr, ui: { payrollEmployeeId: 'id1', payrollEmployeeCreateMode: false },
  hasDemoPermission: () => canEdit, getActiveDemoMember: () => ({}), payrollAccessContext: () => ({}),
  esc: value => String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') };
vm.createContext(ctx);
vm.runInContext(app.slice(begin, end) + app.slice(helpersStart, helpersEnd), ctx);
const employees = Array.from({ length: 11 }, (_, i) => ({ id: 'id' + (i + 1), employeeNumber: 'MAT' + (i + 1), displayName: i === 10 ? 'Élodie <fictive>' : 'Employé ' + (i + 1), serviceId: 'svc', functionIds: ['fun'], service: 'Finance', function: 'Directeur général' }));
const dossier = { id: 'dossier-test' };
let html = ctx.viewPayrollEmployeeDetails(dossier, employees.slice(0, 10), true);
assert.doesNotMatch(html, /id="payroll-employee-overview"/, 'pas de plein écran pour 10 employés');
html = ctx.viewPayrollEmployeeDetails(dossier, employees, true);
assert.match(html, /data-action="open-payroll-employee-overview"/);
assert.match(html, /<dialog id="payroll-employee-overview"/);
assert.equal((html.match(/data-employee-overview-row /g) || []).length, 11);
assert.match(html, /data-action="payroll-employee-overview-select" data-employee-id="id11"/);
assert.match(html, /Élodie &lt;fictive&gt;/);
assert.match(html, /data-search="MAT11 Élodie &lt;fictive&gt; Finance Directeur général"/);
assert.doesNotMatch(html, /id="payroll-employee-edit-form"/);
assert.match(html, /data-action="open-payroll-employee-edit"/);
assert.match(html, /data-action="open-payroll-employee-photo"/);
ctx.ui.payrollEmployeeEditId = 'id1';
html = ctx.viewPayrollEmployeeDetails(dossier, employees, true);
assert.match(html, /id="payroll-employee-edit-form"/);
assert.match(html, /name="functionIds"/);
canEdit = false;
html = ctx.viewPayrollEmployeeDetails(dossier, employees, false);
assert.match(html, /payroll-employee-preview/);
assert.match(html, /mais ce profil ne possède pas le droit de modification/);
assert.doesNotMatch(html, /id="payroll-employee-edit-form"/);
isTestDossier = false;
html = ctx.viewPayrollEmployeeDetails(dossier, employees, false);
assert.doesNotMatch(html, /id="payroll-employee-overview"/, 'pas de fuite du dossier de test');

// Filtrage interactif : accents, nom ou autres colonnes, zéro résultat et réinitialisation.
const rows = ['MAT1 Élodie Finance', 'MAT2 Pascal Direction'].map(text => ({ hidden: false, getAttribute: () => text }));
const search = { value: 'elodie' }, count = {}, empty = {};
const dialog = { querySelector: selector => selector === '[data-employee-overview-search]' ? search : selector === '[data-employee-overview-count]' ? count : empty, querySelectorAll: () => rows };
ctx.filterPayrollEmployeeOverview(dialog);
assert.deepEqual(rows.map(row => row.hidden), [false, true]);
assert.equal(count.textContent, '1 employé(s) affiché(s) sur 2.'); assert.equal(empty.hidden, true);
search.value = 'rien'; ctx.filterPayrollEmployeeOverview(dialog); assert.equal(empty.hidden, false);
search.value = ''; ctx.filterPayrollEmployeeOverview(dialog); assert.deepEqual(rows.map(row => row.hidden), [false, false]);

const handlers = {};
const attributes = {};
const form = { addEventListener: (name, callback) => { handlers[name] = callback; }, setAttribute: (name, value) => { attributes[name] = value; }, removeAttribute: name => { delete attributes[name]; } };
ctx.trackPayrollEmployeeDraft(form); handlers.input(); assert.equal(attributes['data-employee-dirty'], 'true');
handlers.reset(); assert.equal(attributes['data-employee-dirty'], undefined);
handlers.click({ target: { closest: () => true } }); assert.equal(attributes['data-employee-dirty'], 'true');
assert.match(app, /Les modifications non enregistrées seront perdues/);
assert.match(app, /PayrollHR\.employee\(currentPayrollDossier\.id, overviewEmployeeId\)/);
assert.match(app, /employeeOverviewDialog\.showModal\(\)/);
assert.match(app, /ui\.payrollEmployeeId = overviewEmployeeId;[\s\S]*ui\.payrollEmployeeCreateMode = false;[\s\S]*render\(\)/);
assert.match(css, /\.payroll-employee-field-grid > \.payroll-employee-function-field \{ grid-column: 1 \/ -1; \}/);
assert.match(css, /\.payroll-employee-function-checklist \{ grid-template-columns: repeat\(auto-fit/);
assert.match(css, /\.payroll-employee-overview \{ position: fixed; inset: 0;/);
