'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const store=new Map();global.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)};
const tools=require('../modern-proto/js/payroll-payslip-workspace.js');
const edition=require('../modern-proto/js/payroll-slip-edition.js');
test('lecture du brouillon isolée par employé, période et dossier',()=>{
 const key='perfecto.payroll.payslip-drafts.v1.d1';
 assert.equal(tools.readDraft('d1','2026-01','e1'),null);
 global.localStorage.setItem(key,JSON.stringify({version:1,drafts:{'2026-01':{e1:{'amount-payable':{amount:'123'}}}},groups:[]}));
 assert.equal(tools.readPeriodDrafts('d1','2026-01').e1['amount-payable'].amount,'123');
 const r=tools.readDraft('d1','2026-01','e1');assert.equal(r['amount-payable'].amount,'123');r['amount-payable'].amount='999';assert.equal(tools.readDraft('d1','2026-01','e1')['amount-payable'].amount,'123');
 assert.equal(tools.readDraft('d1','2026-01','e2'),null);assert.equal(tools.readDraft('d1','2026-02','e1'),null);assert.equal(tools.readDraft('d2','2026-01','e1'),null);
 global.localStorage.setItem(key,'invalid');assert.throws(()=>tools.readDraft('d1','2026-01','e1'));
});
test('aperçu : informations actuelles, valeurs saisies et rubriques non cochées conservées',()=>{
 const model={dossier:{clientName:'Entreprise <test>',reference:'PRH',address:'Adresse',ifu:'123'},employee:{id:'e1',displayName:'Alice <test>',employeeStatus:'s',categoryId:'c',serviceId:'sv',geographicZoneId:'z',functionIds:['f']},period:'2026-01',licenseOwner:'Titulaire',refs:{status:[{id:'s',code:'S',label:'Cadre'}],category:[{id:'c',code:'C1',ohadaClassification:'Cadre'}],service:[{id:'sv',label:'Finances'}],functions:[{id:'f',label:'Directrice'}],zone:[{id:'z',label:'Siège'}]},selection:{isDefaultPreview:false,rows:[{id:'x',label:'Salaire',retained:true},{id:'y',label:'Retenue',retained:false},{id:'amount-payable',label:'À payer',retained:true}]},record:{x:{base:'100',qty:'0',amount:'95'},y:{amount:'3'},'amount-payable':{amount:'92'},old:{amount:'7'}}};
 const out=edition.report(model);
 for(const expected of ['Titulaire','Entreprise &lt;test&gt;','Alice &lt;test&gt;','Cadre','C1','Finances','Directrice','Siège','janvier 2026','Date de paiement','Non renseignée','Gains','Retenues','Autre montant','Rubrique hors référentiel · old','92','actuellement enregistrées']) assert.ok(out.includes(expected),expected);
 assert.match(edition.report({...model,licenseOwner:''}),/Titulaire indisponible dans la démonstration/);
 assert.ok(!out.includes('Entreprise <test>'));assert.ok(!out.includes('Alice <test>'));
});
test('intégration éditions et cache',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8');assert.match(app,/selectedItem\.id === 'payslip-edition'[\s\S]*payroll-slip-edition-workspace/);assert.match(app,/licenseOwner: licenseOwnerName/);assert.doesNotMatch(app,/item\.id === editionDossier\.accountingDossierId/);
 const editionSource=fs.readFileSync('modern-proto/js/payroll-slip-edition.js','utf8');assert.doesNotMatch(editionSource,/data-edition-owner/);
 for(const f of ['modern-proto/index.html','modern-proto/service-worker.js']) {const s=fs.readFileSync(f,'utf8');assert.match(s,/payroll-slip-edition\.js/);assert.match(s,/payroll-slip-edition\.css/);}
});
test('étoile : tous les services et employés, sans restreindre par la recherche',()=>{
 const employees=[{id:'a',employeeNumber:'002',displayName:'Alice',serviceId:'a'}, {id:'b',employeeNumber:'001',displayName:'Bob',serviceId:'b',terminationDate:'2026-01-02'},{id:'c',employeeNumber:'003',displayName:'Charles'}];
 const state={service:'*',includeDeparted:true,period:'2026-01',sort:'number',query:'Alice'};
 assert.deepEqual(edition.selectEmployees(employees,state,tools,false).map(e=>e.id),['b','a','c']);
 assert.deepEqual(edition.selectEmployees(employees,state,tools,true).map(e=>e.id),['a']);
 assert.deepEqual(edition.selectEmployees(employees,{...state,service:'a'},tools,false).map(e=>e.id),['a']);
 assert.deepEqual(edition.selectEmployees(employees,{...state,includeDeparted:false},tools,false).map(e=>e.id),['a','c']);
});
test('document groupé : une feuille par bulletin et valeurs renseignées seulement',()=>{
 const model={dossier:{clientName:'Client'},employee:{id:'a',displayName:'Alice'},period:'2026-01',refs:{status:[],category:[],service:[],functions:[],zone:[]},selection:{rows:[{id:'blank',label:'Vide',retained:true},{id:'zero',label:'Zéro',retained:false}],isDefaultPreview:true},record:{zero:{amount:'0'},ancien:{amount:'7'}},printCompact:true,grouped:true};
 const html=edition.report(model);assert.doesNotMatch(html,/>Vide </);assert.match(html,/>Zéro</);assert.match(html,/>0<\/td>/);assert.match(html,/Rubrique hors référentiel · ancien/);assert.doesNotMatch(html,/id="slip-edition-document"/);
 const batch=edition.printDocument({count:2,documents:[html,edition.report({...model,employee:{id:'b',displayName:'Bob'},record:{},noDraft:true})]});
 assert.equal((batch.match(/class="slip-print-page"/g)||[]).length,2);assert.match(batch,/break-after:page/);assert.match(batch,/AUCUN BROUILLON ENREGISTRÉ/);assert.ok(batch.indexOf('Alice')<batch.indexOf('Bob'));
});
test('édition : lignes cochées du statut ou renseignées, avec retrait réversible',()=>{
 const selection={isDefaultPreview:false,rows:[{id:'required',label:'Cochée vide',retained:true},{id:'empty',label:'Non cochée vide',retained:false},{id:'zero',label:'Zéro',retained:false}]};
 const model={dossier:{},employee:{id:'a'},period:'2026-01',refs:{status:[],category:[],service:[],functions:[],zone:[]},selection,record:{zero:{amount:'0'},legacy:{qty:'2'}}};
 assert.deepEqual(edition.eligibleRows(model.record,selection).map(r=>r.id),['required','zero','legacy']);
 const text=edition.report(model);assert.match(text,/Cochée vide/);assert.doesNotMatch(text,/Non cochée vide/);assert.match(text,/Zéro/);assert.match(text,/Rubrique hors référentiel · legacy/);
 const prefs={excluded:new Set(['required','zero']),natures:new Map()};const edited=edition.report({...model,preferences:prefs});assert.match(edited,/Cochée vide/);assert.doesNotMatch(edited,/>Zéro</);assert.match(edited,/1 ligne\(s\) non cochée\(s\) retirée/);assert.equal(model.record.zero.amount,'0');
 prefs.excluded.clear();assert.match(edition.report({...model,preferences:prefs}),/>Zéro</);
 const unknown=edition.report({...model,selection:{...selection,isDefaultPreview:true},preferences:{excluded:new Set(['zero']),natures:new Map()}});assert.match(unknown,/>Zéro</);
 assert.deepEqual(edition.eligibleRows({}, {...selection,isDefaultPreview:true}),[]);
});
test('gains et retenues suggérés ou confirmés, autres montants conservés',()=>{
 const model={dossier:{},employee:{id:'a'},period:'2026-01',refs:{status:[],category:[],service:[],functions:[],zone:[]},selection:{isDefaultPreview:false,rows:[{id:'shift-premium',label:'Prime',retained:true},{id:'cnss-contributions',label:'CNSS',retained:true},{id:'gross-salary',label:'Brut',retained:true},{id:'ipts',label:'Impôt négatif',retained:true}]},record:{'shift-premium':{amount:'100'},'cnss-contributions':{amount:'20'},'gross-salary':{amount:'1000'},ipts:{amount:'-5'}}};
 const out=edition.report(model);assert.match(out,/Prime <small>Suggestion à vérifier<\/small><\/th><td>—<\/td><td>—<\/td><td>100<\/td><td>—<\/td><td>—<\/td>/);assert.match(out,/CNSS <small>Suggestion à vérifier<\/small><\/th><td>—<\/td><td>—<\/td><td>—<\/td><td>20<\/td>/);assert.match(out,/>Brut<\/th><td>—<\/td><td>—<\/td><td>—<\/td><td>—<\/td><td>1000<\/td>/);assert.match(out,/>Impôt négatif<\/th><td>—<\/td><td>—<\/td><td>—<\/td><td>—<\/td><td>-5<\/td>/);
 const prefs={excluded:new Set(),natures:new Map([['cnss-contributions','gain']])};assert.match(edition.report({...model,preferences:prefs}),/>CNSS<\/th><td>—<\/td><td>—<\/td><td>20<\/td>/);
});
test('visibilité groupée : ciblage explicite, obligations individuelles et statut inconnu',()=>{
 const rows=[{id:'x',label:'X',retained:false},{id:'y',label:'Y',retained:false},{id:'required',label:'Obligatoire',retained:true}],sel={isDefaultPreview:false,rows};
 const source={employee:{id:'a'},selection:sel,record:{x:{amount:'1'},y:{amount:'2'}},preferences:{excluded:new Set(['x']),natures:new Map()}};
 const target=(id,selection,record)=>({employee:{id},selection,record,preferences:{excluded:new Set(['y']),natures:new Map([['y','gain']])}});
 const targets=[target('b',sel,{x:{amount:'3'},y:{amount:'4'}}),target('c',{...sel,rows:rows.map(r=>r.id==='x'?{...r,retained:true}:r)},{x:{amount:'5'}}),target('d',{...sel,isDefaultPreview:true},{x:{amount:'6'}})];
 const plan=edition.visibilityPlan(source,targets,new Set(['x','y']));
 assert.deepEqual(plan.operations,[{employeeId:'b',rowId:'x',hide:true},{employeeId:'b',rowId:'y',hide:false}]);assert.equal(plan.mandatory,1);assert.equal(plan.missing,1);assert.equal(plan.unknown,1);
 assert.equal(targets[0].record.x.amount,'3');assert.deepEqual([...targets[0].preferences.excluded],['y']);assert.equal(targets[0].preferences.natures.get('y'),'gain');
 assert.throws(()=>edition.visibilityPlan(source,targets,new Set(['required'])),/sélection des rubriques a changé/);
});
