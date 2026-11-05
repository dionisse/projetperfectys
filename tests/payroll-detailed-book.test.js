'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const book=require('../modern-proto/js/payroll-detailed-book.js'),tools=require('../modern-proto/js/payroll-payslip-workspace.js');
const keys=book.columns.map(c=>c.key);
function fixture(){return {period:'2026-01',dossier:{id:'d',clientName:'Entreprise <fictive>',reference:'PRH'},licenseOwner:'',serviceLabel:'Tous',employeeLabel:'Tous',employees:[{id:'a',employeeNumber:'001',displayName:'Alice',socialInsuranceNumber:'CNSS-1',maritalStatus:'Célibataire',childrenCount:0,employeeStatus:'s',categoryId:'c',paymentMethod:'Chèque'},{id:'b',employeeNumber:'002',displayName:'Bob'}],refs:{statuses:[{id:'s',code:'C',label:'Cadre'}],categories:[{id:'c',code:'C1',ohadaClassification:'Permanent'}]},drafts:{a:{'salary-base-total':{amount:'100'},'fixed-premiums-total':{amount:'20'},'advances-loans-total':{amount:'13'},'advance-1-withheld-month':{amount:'999'},'amount-payable':{amount:'107,50'},'net-salary':{amount:'110'},'gross-salary':{amount:'140'}}},columnKeys:keys};}
test('colonnes de la capture et données strictement saisies, sans inventer ni calculer',()=>{
 assert.equal(keys.length,23);assert.equal(new Set(keys).size,23);assert.equal(book.columns.find(c=>c.key==='cnss').label,'N° CNSS');
 const data=fixture(),r=book.build(data,tools);assert.equal(r.rows.length,2);const a=r.rows[0],b=r.rows[1];assert.equal(a.values.cnss,'CNSS-1');assert.equal(a.values.children,'0');assert.equal(a.values.status,'C · Cadre');assert.equal(a.values.category,'C1 · Permanent');assert.equal(a.values.loans,'13');assert.equal(a.values.payable,'107.50');assert.equal(a.values['advance-deduction'],'');assert.equal(a.values.delegations,'');assert.equal(b.hasDraft,false);assert.equal(b.values.gross,'');assert.equal(data.drafts.a['amount-payable'].amount,'107,50');
 const text=book.reportHtml(r);assert.match(text,/CNSS-1/);assert.match(text,/Sans brouillon : 002 · Bob/);assert.match(text,/total avances et prêts saisi/);assert.match(text,/source à définir/);assert.match(text,/Entreprise &lt;fictive&gt;/);assert.doesNotMatch(text,/999/);
});
test('choix de colonnes et valeurs invalides traités sans remplacement silencieux',()=>{
 let d=fixture();d.columnKeys=['name','base'];let r=book.build(d,tools);assert.deepEqual(r.columns.map(c=>c.key),['name','base']);assert.doesNotMatch(book.reportHtml(r),/N° CNSS/);assert.match(book.reportHtml(r),/Sans brouillon : Bob/); d.columnKeys=['base']; assert.match(book.reportHtml(book.build(d,tools)),/Sans brouillon : Ligne 2/); d.columnKeys=['name','base'];
 assert.throws(()=>book.build({...d,columnKeys:[]},tools),/au moins une colonne/);assert.throws(()=>book.build({...d,columnKeys:['name','name']},tools),/colonne valide/);assert.throws(()=>book.build({...d,columnKeys:['intrus']},tools),/colonne valide/);
 d.drafts.a['salary-base-total']={amount:{bad:1}};assert.throws(()=>book.build(d,tools),/Montant du brouillon illisible/);
});
test('impression en bandes sans perte de colonne, configuration et avertissements',()=>{
 const r=book.build(fixture(),tools);for(const o of ['portrait','landscape']){const bands=book.columnBands(r.columns,o),flat=bands.flat();for(const c of r.columns)assert.ok(flat.some(x=>x.key===c.key),c.key);assert.ok(bands.length>1);const html=book.printDocument(r,{orientation:o,margins:'binding',style:'plain8',pageFirst:'2',pageLast:'5',parity:'odd'});assert.match(html,new RegExp('@page\\{size:A4 '+o));assert.match(html,/20mm/);assert.match(html,/Réglez ces choix dans la boîte/);for(const c of r.columns)assert.ok(html.includes(c.label),c.label);assert.match(html,/Sans brouillon/);}
});
test('exports préservent les zéros et neutralisent les formules texte',()=>{
 let d=fixture();d.employees[0].displayName='=HYPERLINK("test")';const r=book.build(d,tools),m=book.matrix(r),out=book.tsv(r);assert.equal(m.rows[0][0],'001');assert.equal(m.rows[0][4],'0');assert.match(out,/'=HYPERLINK/);assert.match(out,/Sans brouillon/);assert.match(out,/janvier 2026/);
});
test('intégration des fichiers et limites affichées',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8'),index=fs.readFileSync('modern-proto/index.html','utf8'),worker=fs.readFileSync('modern-proto/service-worker.js','utf8');
 assert.match(app,/payroll-detailed-book-workspace/);for(const file of ['payroll-detailed-book.js','payroll-detailed-book.css']){assert.ok(index.includes(file));assert.ok(worker.includes(file));}
});
