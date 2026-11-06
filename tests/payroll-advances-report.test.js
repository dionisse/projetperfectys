'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../modern-proto/js/payroll-advances-report.js'),tools=require('../modern-proto/js/payroll-payslip-workspace.js');
const a=n=>({amount:String(n)}),catalog=[{id:'advance-1',label:'AVANCE SUR SALAIRE'},{id:'advance-2',label:'AVANCE 2'},{id:'advances-loans-total',label:'TOTAL AVANCES ET PRÊTS'},{id:'advance-1-carry-forward',label:'Report'}];
function fixture(mode='advances-evolution'){
 const drafts={'2026-01':{a:{'advance-1':a('50'),'advance-1-carry-forward':a('100.123456'),'advance-1-increase-month':a('40'),'advance-1-withheld-month':a('20')}},'2026-02':{a:{'advance-1':a('4'),'advance-1-increase-month':a('10'),'advance-1-withheld-month':a('30')}},'2026-03':{a:{'advance-1-increase-month':a('0')}}};
 return {mode,months:['2026-01','2026-02','2026-03'],start:'2026-01',end:'2026-03',catalog,ledger:api.snapshot(drafts),employees:[{id:'a',employeeNumber:'001',displayName:'Alice'},{id:'b',employeeNumber:'002',displayName:'Bob'}],employeeIds:['a'],natureId:'advance-1',columnKeys:api.definitions[mode].columns.map(c=>c[0]),dossier:{id:'d',name:'Test'}};
}
test('registre synchronisé par salarié, mois et rubrique, sans total agrégé',()=>{
 assert.deepEqual(api.natures(catalog).map(x=>x.id),['advance-1','advance-2']);let f=fixture(),r=api.build(f,tools);assert.equal(r.rows.length,3);
 let [jan,feb,mar]=r.rows.map(x=>x.values);assert.equal(jan.granted,'50');assert.equal(jan.carry,'100.123456');assert.equal(jan.increase,'40');assert.equal(jan.due,'140.123456');assert.equal(jan.decrease,'20');assert.equal(jan.retention,'20');assert.equal(jan.remaining,'120.123456');
 assert.equal(feb.carry,'120.123456');assert.equal(feb.due,'130.123456');assert.equal(feb.remaining,'100.123456');assert.equal(mar.carry,'100.123456');assert.equal(mar.due,'100.123456');assert.equal(mar.remaining,'');assert.ok(r.rows[2].review);assert.match(r.reportNotes.join(' '),/retenue non renseignée/);
});
test('montant accordé = rubrique principale et non augmentation, sélection et colonnes',()=>{
 const f=fixture('advances-granted');f.end=f.start;f.employeeIds='*';f.columnKeys=['number','granted'];let r=api.build(f,tools);assert.equal(r.rows.length,2);assert.equal(r.rows[0].values.granted,'50');assert.equal(r.rows[1].values.granted,'');assert.ok(r.rows[1].review);assert.deepEqual(r.columns.map(x=>x.key),['nature','number','granted']);
 f.employeeIds=[];assert.throws(()=>api.build(f,tools),/Sélectionnez des employés/);f.employeeIds=['a','a'];assert.throws(()=>api.build(f,tools),/employés valides/);f.employeeIds='*';f.columnKeys=[];assert.throws(()=>api.build(f,tools),/colonne/);
});
test('reports explicites divergents, manques et mois non consécutifs signalés',()=>{
 const f=fixture();f.ledger.periods['2026-02'].a['advance-1'].carry=a('200');let r=api.build(f,tools);assert.equal(r.rows[1].values.carry,'200');assert.ok(r.rows[1].review);assert.match(r.reportNotes.join(' '),/différent du reste/);assert.equal(r.rows[2].values.carry,'');
 delete f.ledger.periods['2026-01'].a['advance-1'].carry;delete f.ledger.periods['2026-02'].a['advance-1'].carry;r=api.build(f,tools);assert.equal(r.rows[0].values.due,'');assert.equal(r.rows[1].values.carry,'');assert.match(r.reportNotes.join(' '),/report initial/);
});
test('refuse nature agrégée, dates et données illisibles',()=>{
 let f=fixture();f.natureId='advances-loans-total';assert.throws(()=>api.build(f,tools),/Nature/);f.natureId='advance-1';f.start='2027-01';assert.throws(()=>api.build(f,tools),/Période/);f.start='2026-01';f.ledger.periods['2026-01'].a['advance-1'].increase='bad';assert.throws(()=>api.build(f,tools),/illisible/);
});
test('intégration des quatre états, sauvegarde atomique et migration sans écriture',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8'),workspace=fs.readFileSync('modern-proto/js/payroll-payslip-workspace.js','utf8');for(const mode of Object.keys(api.definitions))assert.match(app,new RegExp("id: '"+mode+"', label: '[^']+', ready: true"));
 assert.match(workspace,/data\.advanceLedger=root\.PayrollAdvanceReports\.snapshot\(data\.drafts\)/);assert.match(workspace,/readAdvanceLedger/);assert.match(app,/PayrollAdvanceReports\.mount/);
 for(const f of ['modern-proto/index.html','modern-proto/service-worker.js'])assert.match(fs.readFileSync(f,'utf8'),/payroll-advances-report\.js/);
});
test('le registre accepte de nouvelles natures individuelles et isole les clés particulières',()=>{
 const entries=JSON.parse('{"__proto__":{"advance-10":{"amount":"12"},"advance-10-increase-month":{"amount":"2"}}}');
 const ledger=api.snapshot({'2026-01':entries});
 assert.equal(ledger.periods['2026-01']['__proto__']['advance-10'].granted.amount,'12');
 assert.equal(ledger.periods['2026-01']['__proto__']['advance-10'].increase.amount,'2');
 assert.deepEqual(api.natures([{id:'advance-10',label:'AVANCE 10'},{id:'advances-loans-total',label:'TOTAL'}]).map(x=>x.id),['advance-10']);
 assert.equal({}.granted,undefined);
});
