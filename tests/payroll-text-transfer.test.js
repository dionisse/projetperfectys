'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const tx=require('../modern-proto/js/payroll-text-transfer.js'),tools=require('../modern-proto/js/payroll-payslip-workspace.js'),tracking=require('../modern-proto/js/payroll-payment-tracking.js');
function fixture(){return {period:'2026-01',today:'2026-02-03',banks:[{id:'em',code:'EM',label:'Emettrice'},{id:'a',code:'BA',label:'Banque A'},{id:'b',code:'BB',label:'Banque B'}],rubrics:[{id:'amount-payable',label:'Montant à payer'},{id:'net-salary',label:'Net'}],employees:[{id:'a',employeeNumber:'001',displayName:'Alice',paymentMethod:'Virement Bancaire',bankId:'a',bankAccountNumber:'000123'},{id:'b',employeeNumber:'002',displayName:'Benoit',paymentMethod:'Chèque',bankId:'b',bankAccountNumber:'000456'},{id:'c',employeeNumber:'003',displayName:'Claire',paymentMethod:'Virement Bancaire',bankId:'a'},{id:'d',employeeNumber:'004',displayName:'Denis',paymentMethod:'Virement Bancaire',bankId:'a',bankAccountNumber:'0004'},{id:'e',employeeNumber:'005',displayName:'Eva',paymentMethod:'Virement Bancaire',bankId:'a',bankAccountNumber:'0005'},{id:'f',employeeNumber:'006',displayName:'Frank',paymentMethod:'Virement Bancaire',bankId:'outside',bankAccountNumber:'0006'},{id:'g',employeeNumber:'007',displayName:'Grace',paymentMethod:'Virement Bancaire',bankId:'a',bankAccountNumber:'0007'}],drafts:{a:{'amount-payable':{amount:'100.123456'},'net-salary':{amount:'20'}},b:{'amount-payable':{amount:'200.1'}},c:{'amount-payable':{amount:'2'}},d:{'amount-payable':{amount:'0'}},e:{'amount-payable':{amount:'10'}},f:{'amount-payable':{amount:'40'}},g:{'amount-payable':{amount:'500'}}},payments:{events:[{id:'p1',kind:'paid',employeeId:'e',period:'2026-01',snapshot:{'amount-payable':{amount:'10'}}},{id:'p2',kind:'paid',employeeId:'g',period:'2026-01',snapshot:{'amount-payable':{amount:'400'}}}]},settings:{emitterId:'em',format:'generic-v1',datePaie:'2026-01-31',dateVirement:'2026-02-05',filename:'ordre.txt'}};}

test('modèle unique, lignes salariés automatiques, fin et total exact',()=>{
  const d=fixture(),original=JSON.stringify(d),r=tx.build(d,tools,tracking);
  assert.equal(JSON.stringify(d),original);assert.equal(r.count,3);assert.equal(r.total,'340.223456');
  assert.equal(r.content,'ENTETE;2026-01;2026-01-31;2026-02-05;2026-02-03;EM;Emettrice\r\nVIREMENT;001;Alice;000123;100.123456\r\nVIREMENT;002;Benoit;000456;200.1\r\nVIREMENT;006;Frank;0006;40\r\nTOTAL;3;340.223456\r\n');
  assert.equal(r.excluded.length,4);assert.match(JSON.stringify(r.excluded),/compte manquant/);assert.match(JSON.stringify(r.excluded),/montant non positif/);assert.match(JSON.stringify(r.excluded),/règlement déjà déclaré/);assert.match(JSON.stringify(r.excluded),/déclaration de règlement à vérifier/);assert.match(r.warnings.join(' '),/mode différent/);
});
test('seul Montant à payer est utilisé même avec une autre rubrique présente',()=>{
  const d=fixture();d.settings.rubricId='net-salary';d.employees=[d.employees[0]];const r=tx.build(d,tools,tracking);assert.equal(r.total,'100.123456');assert.match(r.content,/000123;100\.123456\r\nTOTAL;1;100\.123456/);
  delete d.drafts.a['amount-payable'];const empty=tx.build(d,tools,tracking);assert.equal(empty.count,0);assert.equal(empty.content,'');assert.equal(empty.total,'');assert.match(JSON.stringify(empty.excluded),/montant à payer non renseigné/);
});
test('exclusions, données manquantes et absence de données bancaires supposées',()=>{
  const d=fixture();d.employees=[{id:'a',paymentMethod:'Virement Bancaire',bankAccountNumber:'001'}];const r=tx.build(d,tools,tracking);assert.equal(r.count,1);assert.match(r.content,/VIREMENT;;;001;100\.123456/);assert.match(r.warnings.join(),/matricule ou nom absent/);
  d.drafts={};const empty=tx.build(d,tools,tracking);assert.equal(empty.count,0);assert.match(JSON.stringify(empty.excluded),/brouillon absent/);
});
test('dates, format et nom sont validés ; caractères dangereux refusés',()=>{
  const d=fixture();d.employees=[d.employees[0]];
  assert.throws(()=>tx.build({...d,settings:{...d.settings,emitterId:'inconnu'}},tools,tracking),/émettrice/);
  assert.throws(()=>tx.build({...d,settings:{...d.settings,format:'autre'}},tools,tracking),/format/);
  assert.throws(()=>tx.build({...d,settings:{...d.settings,filename:'../ordre.txt'}},tools,tracking),/sans chemin/);
  assert.throws(()=>tx.build({...d,settings:{...d.settings,datePaie:'2026-02-30'}},tools,tracking),/date valide/);
  d.employees[0].displayName='A;B';assert.throws(()=>tx.build(d,tools,tracking),/séparateur/);
  d.employees[0].displayName='A\u0000B';assert.throws(()=>tx.build(d,tools,tracking),/caractère de contrôle/);
});
test('date du navigateur utilise le jour local et chaque génération recalcule sa date',()=>{
  assert.equal(tx.today(new Date(2026,0,2,0,1)),'2026-01-02');const d=fixture();d.employees=[d.employees[0]];const a=tx.build(d,tools,tracking);d.today='2026-02-04';const b=tx.build(d,tools,tracking);assert.notEqual(a.content,b.content);assert.match(b.content,/2026-02-04/);
});
test('intégration, accès, fraîcheur, navigation et modèle non homologué',()=>{
  const source=fs.readFileSync('modern-proto/js/payroll-text-transfer.js','utf8'),app=fs.readFileSync('modern-proto/js/app.js','utf8');
  assert.match(app,/multiple-transfers-text[^}]*ready: true/);assert.match(source,/ne correspond à aucun format bancaire homologué/);assert.match(source,/if\(!allowed\(\)\)throw new Error/);assert.match(source,/JSON\.stringify\(fresh\)!==JSON\.stringify\(report\)/);assert.match(source,/navigationGuard/);assert.match(source,/profileGuard/);assert.match(source,/beforeunload/);assert.match(source,/TEST-ordre-virements\.txt/);
  for(const f of ['modern-proto/index.html','modern-proto/service-worker.js'])assert.match(fs.readFileSync(f,'utf8'),/payroll-text-transfer\.js/);
});
