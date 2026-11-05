'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const store=new Map();global.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)};
const tools=require('../modern-proto/js/payroll-payslip-workspace.js');
const edition=require('../modern-proto/js/payroll-slip-edition.js');
test('lecture du brouillon isolée par employé, période et dossier',()=>{
 const key='perfecto.payroll.payslip-drafts.v1.d1';
 assert.equal(tools.readDraft('d1','2026-01','e1'),null);
 global.localStorage.setItem(key,JSON.stringify({version:1,drafts:{'2026-01':{e1:{'amount-payable':{amount:'123'}}}},groups:[]}));
 const r=tools.readDraft('d1','2026-01','e1');assert.equal(r['amount-payable'].amount,'123');r['amount-payable'].amount='999';assert.equal(tools.readDraft('d1','2026-01','e1')['amount-payable'].amount,'123');
 assert.equal(tools.readDraft('d1','2026-01','e2'),null);assert.equal(tools.readDraft('d1','2026-02','e1'),null);assert.equal(tools.readDraft('d2','2026-01','e1'),null);
 global.localStorage.setItem(key,'invalid');assert.throws(()=>tools.readDraft('d1','2026-01','e1'));
});
test('aperçu : informations actuelles, valeurs saisies et rubriques non cochées conservées',()=>{
 const model={dossier:{clientName:'Entreprise <test>',reference:'PRH',address:'Adresse',ifu:'123'},employee:{id:'e1',displayName:'Alice <test>',employeeStatus:'s',categoryId:'c',serviceId:'sv',geographicZoneId:'z',functionIds:['f']},period:'2026-01',licenseOwner:'Titulaire',refs:{status:[{id:'s',code:'S',label:'Cadre'}],category:[{id:'c',code:'C1',ohadaClassification:'Cadre'}],service:[{id:'sv',label:'Finances'}],functions:[{id:'f',label:'Directrice'}],zone:[{id:'z',label:'Siège'}]},selection:{isDefaultPreview:false,rows:[{id:'x',label:'Salaire',retained:true},{id:'y',label:'Retenue',retained:false},{id:'amount-payable',label:'À payer',retained:true}]},record:{x:{base:'100',qty:'0',amount:'95'},y:{amount:'3'},'amount-payable':{amount:'92'},old:{amount:'7'}}};
 const out=edition.report(model);
 for(const expected of ['Titulaire','Entreprise &lt;test&gt;','Alice &lt;test&gt;','Cadre','C1','Finances','Directrice','Siège','janvier 2026','Date de paiement','Non renseignée','Cochée','Non cochée','Rubrique hors référentiel · old','92','actuellement enregistrées']) assert.ok(out.includes(expected),expected);
 assert.ok(!out.includes('Entreprise <test>'));assert.ok(!out.includes('Alice <test>'));
});
test('intégration éditions et cache',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8');assert.match(app,/selectedItem\.id === 'payslip-edition'[\s\S]*payroll-slip-edition-workspace/);assert.match(app,/item\.id === editionDossier\.accountingDossierId/);
 for(const f of ['modern-proto/index.html','modern-proto/service-worker.js']) {const s=fs.readFileSync(f,'utf8');assert.match(s,/payroll-slip-edition\.js/);assert.match(s,/payroll-slip-edition\.css/);}
});
