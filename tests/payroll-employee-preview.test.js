'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const start = source.indexOf('  function viewPayrollEmployeeDetails(');
const end = source.indexOf('  function viewPayrollEmployeeGeographicZones(', start);
const helperStart = source.indexOf('  function updatePayrollEmployeeChoiceLists(');
const helperEnd = source.indexOf('  function bindPayrollEmployeeChoiceLists(', helperStart);
assert.ok(start >= 0 && end > start && helperStart >= 0 && helperEnd > helperStart);
let canEdit = true;
const catalogs = {
  qualifications: [{id:'q1',code:'D1',label:'Bac'}, {id:'q2',code:'D2',label:'BTS'}],
  professions: [{id:'p1',code:'P1',label:'Profession'}],
  socialFunds: [{id:'ins1',label:'Assurance A'}, {id:'ins2',label:'Assurance B'}],
  socialSecurityFunds: [{id:'ss1',label:'CNSS'}], banks: [{id:'b1',code:'B1',label:'Banque'}]
};
const hr = {isDemoTestDossier:()=>true, employeeStatuses:()=>[{id:'s1',code:'A',label:'Statut'}],
  employeeCategories:()=>[{id:'c1',code:'C1',ohadaClassification:'Cadre'}], employeeGeographicZones:()=>[{id:'z1',code:'Z1',label:'Zone'}],
  employeeServices:()=>[{id:'svc1',code:'S1',label:'Service'}], employeeFunctions:()=>[{id:'f1',code:'F1',label:'Direction'},{id:'f2',code:'F2',label:'Gestion'}], employeeDefinitionItems:(id,kind)=>catalogs[kind]||[]};
const ctx = {PayrollHR:hr, ui:{payrollEmployeeId:'emp',payrollEmployeeCreateMode:false}, hasDemoPermission:()=>canEdit, getActiveDemoMember:()=>({}), payrollAccessContext:()=>({}), esc:value=>String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')};
vm.createContext(ctx); vm.runInContext(source.slice(start,end)+source.slice(helperStart,helperEnd),ctx);
const employee={id:'emp',employeeNumber:'001',displayName:'Doe Jane',lastName:'Doe',firstName:'Jane', firstHireDate:'2021-01-01',seniorityMonthsToDeduct:'2',seniorityReferenceDate:'2021-02-01',vpsExemptionEndDate:'2022-02-01',terminationDate:'2023-01-01',terminationReason:'Motif fictif',rehireDate:'2024-01-01',birthDate:'2000-01-01',sex:'F',maritalStatus:'Célibataire',childrenCount:'0',birthplace:'Cotonou',nationality:'Bénin',socialSecurityFundId:'ss1',socialInsuranceNumber:'SOC-1',taxId:'IFU-1',supplementaryInsurances:[{insurerId:'ins1',insuranceNumber:'A-01'},{insurerId:'ins2',insuranceNumber:'B-02'}],supplementaryInsuranceCompany:'Ancien organisme',supplementaryInsuranceNumber:'V-03',professionId:'p1',employeeStatus:'s1',categoryId:'c1',effectiveDate:'2024-02-01',geographicZoneId:'z1',serviceId:'svc1',qualificationIds:['q1','q2'],functionIds:['f1','f2'],paymentMethod:'Mobile Money',bankId:'b1',bankAccountNumber:'COMPTE',address:'Adresse test',contactPhone:'000',contactEmail:'a@fictif.test',miscellaneousLabel:'Note',miscellaneousValue:'Autre mention <test>'};
const dossier={id:'d'};
let html=ctx.viewPayrollEmployeeDetails(dossier,[employee],true);
assert.match(html,/aria-label="Aperçu de la fiche employé"/);
assert.match(html, /class="payroll-employee-preview-wide"><dt>Diplômes et qualifications<\/dt>/);
assert.doesNotMatch(html,/id="payroll-employee-edit-form"/);
assert.match(html,/data-action="open-payroll-employee-edit" data-employee-id="emp">Modifier/);
for(const value of ['001','Doe','Jane','2021-01-01','Motif fictif','2000-01-01','Célibataire','CNSS','SOC-1','IFU-1','Assurance A · N° A-01','Assurance B · N° B-02','Ancien organisme · N° V-03','P1 · Profession','A · Statut','C1 · Cadre','Z1 · Zone','S1 · Service','<li>D1 · Bac</li><li>D2 · BTS</li>','F1 · Direction, F2 · Gestion','Mobile Money','B1 · Banque','COMPTE','Adresse test','a@fictif.test','Autre mention &lt;test&gt;']) assert.ok(html.includes(value),'aperçu : '+value);
for(const action of ['open-payroll-employee-info','open-payroll-employee-photo','print-payroll-employee']) assert.ok(html.includes('data-action="'+action+'"'));
ctx.ui.payrollEmployeeEditId='emp';
html=ctx.viewPayrollEmployeeDetails(dossier,[employee],true);
assert.match(html,/id="payroll-employee-edit-form"/);
assert.doesNotMatch(html,/aria-label="Aperçu de la fiche employé"/);
assert.match(html,/data-action="cancel-payroll-employee-edit"/);
assert.equal((html.match(/data-payroll-choice-list/g)||[]).length,2);
for(const name of ['q1','q2']) assert.match(html,new RegExp('name="qualificationIds" value="'+name+'" checked'));
for(const name of ['f1','f2']) assert.match(html,new RegExp('name="functionIds" value="'+name+'" checked'));
canEdit=false; html=ctx.viewPayrollEmployeeDetails(dossier,[employee],true);
assert.match(html,/aria-label="Aperçu de la fiche employé"/);
assert.doesNotMatch(html,/data-action="open-payroll-employee-edit"/);
assert.doesNotMatch(html,/id="payroll-employee-edit-form"/);
// Résumé de la liste : tous les choix sont maintenus, sans sélection unique imposée.
const summary={textContent:''};
const checked=[{closest:()=>({querySelector:()=>({textContent:'D1 · Bac'})})},{closest:()=>({querySelector:()=>({textContent:'D2 · BTS'})})}];
const list={querySelector:()=>summary,querySelectorAll:()=>checked};
ctx.updatePayrollEmployeeChoiceLists({querySelectorAll:()=>[list]});
assert.equal(summary.textContent,'D1 · Bac ; D2 · BTS');
assert.match(source,/ui\.payrollEmployeeEditId = '';\s*toast\('Fiche fictive mise à jour/);
assert.match(source,/ui\.payrollEmployeeId = result\.employee\.id;\s*ui\.payrollEmployeeCreateMode = false;\s*ui\.payrollEmployeeEditId = ''/);
// Dans l’aperçu, les libellés longs restent distincts et le champ s’étend sur la ligne entière.
canEdit = true; ctx.ui.payrollEmployeeEditId = '';
catalogs.qualifications = [{ id:'q1',code:'01',label:'Bac G2' }, { id:'q2',code:'11',label:'BTS en Informatique de Gestion' }];
html = ctx.viewPayrollEmployeeDetails(dossier,[employee],true);
assert.match(html, /class="payroll-employee-preview-wide"><dt>Diplômes et qualifications<\/dt><dd><ul class="payroll-employee-preview-values"><li>01 · Bac G2<\/li><li>11 · BTS en Informatique de Gestion<\/li><\/ul>/);
const css = fs.readFileSync(path.join(root, 'modern-proto/css/modern.css'), 'utf8');
assert.match(css, /\.payroll-employee-preview-section dl > \.payroll-employee-preview-wide \{ grid-column: 1 \/ -1; \}/);
