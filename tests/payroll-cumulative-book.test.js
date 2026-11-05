'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const book=require('../modern-proto/js/payroll-cumulative-book.js'),shared=require('../modern-proto/js/payroll-detailed-book.js'),tools=require('../modern-proto/js/payroll-payslip-workspace.js');
const cols=book.columns.map(x=>x.key);
function data(){return {period:'2026-01',dossier:{id:'d',clientName:'Demo'},licenseOwner:'',serviceLabel:'Tous',serviceId:'*',services:[{id:'s1',code:'S1',label:'Service 1'},{id:'s2',code:'S2',label:'Service 2'}],employees:[{id:'a',displayName:'Secret A',serviceId:'s1'},{id:'b',displayName:'Secret B',serviceId:'s1'},{id:'c',serviceId:'s2'},{id:'d',serviceId:'unknown'}],drafts:{a:{'salary-base-total':{amount:'100.123456'},'gross-salary':{amount:'0'},'advances-loans-total':{amount:'10'}},b:{'salary-base-total':{amount:'-0.123456'},'advances-loans-total':{amount:'2'}},c:{'salary-base-total':{amount:'999999999999.999999'}},d:{'salary-base-total':{amount:'999999999999.999999'}}},columnKeys:cols};}
test('regroupement par service et total général, valeurs exactes et sans employé',()=>{
 const d=data(),r=book.build(d,tools);assert.equal(r.columns.length,17);assert.deepEqual(r.rows.map(x=>x.values.label),['Service 1 · sous-total','Service 2 · sous-total','Service non défini ou introuvable · sous-total','TOTAL GÉNÉRAL']);
 assert.equal(r.rows[0].values.base,'100');assert.equal(r.rows[1].values.base,'999999999999.999999');assert.equal(r.rows[3].values.base,'2000000000099.999998');assert.equal(r.rows[0].values.loans,'12');assert.equal(r.rows[0].values.gross,'0');assert.equal(r.rows[0].quality.gross.count,1);assert.equal(r.rows[0].quality.gross.total,2);assert.equal(r.rows[3].values['advance-deduction'],undefined);
 let out=shared.reportHtml(r);assert.match(out,/0 \*/);assert.match(out,/Salaire brut 1\/2/);assert.doesNotMatch(out,/Secret A|Secret B/);assert.match(out,/source à définir/);assert.match(out,/Service non défini/);assert.match(out,/TOTAL GÉNÉRAL/);
 assert.equal(d.drafts.a['salary-base-total'].amount,'100.123456');
});
test('un service sélectionné exclut tous les autres et les absences restent partielles',()=>{
 let d=data();d.serviceId='s1';d.serviceLabel='S1';delete d.drafts.b;let r=book.build(d,tools);assert.equal(r.rows.length,1);assert.equal(r.rows[0].values.base,'100.123456');assert.equal(r.rows[0].quality.base.count,1);assert.match(shared.reportHtml(r),/100\.123456 \*/);assert.match(shared.reportHtml(r),/1 sans brouillon/);assert.doesNotMatch(JSON.stringify(r),/999999999999/);
 assert.throws(()=>book.build({...d,serviceId:'absent'},tools),/Service indisponible/);assert.throws(()=>book.build({...d,employees:[]},tools),/Aucun employé/);
});
test('colonnes, données malformées, bandes et exports',()=>{
 let d=data();d.columnKeys=['label','base','net'];let r=book.build(d,tools);assert.deepEqual(r.columns.map(x=>x.key),['label','base','net']);assert.equal(r.rows[0].values.net,'');assert.match(shared.reportHtml(r),/— \*/);assert.match(shared.tsv(r),/service/i);assert.match(shared.tsv(r),/colonnes incomplètes/);let printed=shared.printDocument(r,{orientation:'portrait',margins:'standard',style:'plain8',parity:'none'});assert.match(printed,/Livre de paie cumulé/);assert.match(printed,/TOTAL GÉNÉRAL/);assert.match(printed,/— \*/);assert.doesNotMatch(printed,/Secret A/);d.drafts.a['salary-base-total']={amount:{}};assert.throws(()=>book.build(d,tools),/Montant du brouillon illisible/);assert.throws(()=>book.build({...data(),columnKeys:[]},tools),/colonne valide/);
});
test('module branché sur la sélection, le HTML et le cache',()=>{for(const f of ['modern-proto/index.html','modern-proto/service-worker.js'])assert.match(fs.readFileSync(f,'utf8'),/payroll-cumulative-book\.js/);assert.match(fs.readFileSync('modern-proto/js/app.js','utf8'),/payroll-book-cumulative[^}]*ready: true/);});

test('absence de brouillon, zéro explicite et colonnes sans montants',()=>{
 let d=data();d.drafts={a:{'salary-base-total':{amount:'0'}}};let r=book.build(d,tools);assert.equal(r.rows[0].values.base,'0');assert.equal(r.rows[0].quality.base.count,1);assert.match(shared.tsv(r),/0 \*/);assert.equal(r.rows[1].values.base,'');assert.equal(r.rows[1].quality.base.count,0);assert.match(shared.tsv(r),/Salaire de base 0\/1/);
 d.columnKeys=['centre'];r=book.build(d,tools);assert.match(shared.reportHtml(r),/aucune colonne de montant disponible sélectionnée/);assert.doesNotMatch(shared.reportHtml(r),/colonnes de montants sélectionnées complètes/);
});
