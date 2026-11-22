'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const store=new Map();global.localStorage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))};
const hr=require('../modern-proto/js/payroll-hr.js');const key='perfecto.payroll.dossiers.v1';
test('paramètres partagés et contrôle de conflit sans perte de données',()=>{
 const d=hr.createTestDossier().dossier, initial=hr.generalSettings(d);const data=JSON.parse(store.get(key));data.extra={keep:1};data.dossiers.push({id:'unknown',foo:1});data.dossiers[0].other={untouched:true};store.set(key,JSON.stringify(data));
 const values={insae:'  00123 ',ifu:' 012 ',cnssEmployerNumber:' 009 ',serviceSingular:'Direction',servicePlural:'Directions'};
 assert.equal(hr.updateGeneralSettings(d.id,values,initial).ok,true);const after=JSON.parse(store.get(key));assert.equal(after.dossiers[0].ifu,'012');assert.equal(after.dossiers[0].cnssEmployerNumber,'009');assert.equal(after.dossiers[0].insae,'00123');assert.deepEqual(after.dossiers[0].other,{untouched:true});assert.deepEqual(after.dossiers[1],{id:'unknown',foo:1});assert.equal(after.extra.keep,1);
 const snap=store.get(key);assert.match(hr.updateGeneralSettings(d.id,values,initial).errors.join(),/changé ailleurs/);assert.equal(store.get(key),snap);
 const current=hr.generalSettings(hr.currentDossier());assert.equal(current.servicePlural,'Directions');assert.equal(hr.updateGeneralSettings(d.id,{...values,serviceSingular:'  '},current).ok,false);assert.equal(store.get(key),snap);
 assert.equal(hr.updateGeneralSettings('unknown',values,current).ok,false);assert.equal(store.get(key),snap);
});
test('catalogue illisible, ambigu ou stockage saturé : pas de remplacement',()=>{
 const saved=store.get(key), d=hr.currentDossier(), initial=hr.generalSettings(d), val={insae:'',ifu:'',cnssEmployerNumber:'',serviceSingular:'Service',servicePlural:'Services'};
 store.set(key,'{');assert.equal(hr.updateGeneralSettings(d.id,val,initial).ok,false);assert.equal(store.get(key),'{');
 const data=JSON.parse(saved);data.dossiers.push({...data.dossiers[0]});store.set(key,JSON.stringify(data));const dup=store.get(key);assert.equal(hr.updateGeneralSettings(d.id,val,initial).ok,false);assert.equal(store.get(key),dup);
 store.set(key,saved);const set=global.localStorage.setItem;global.localStorage.setItem=()=>{throw Error('quota')};assert.equal(hr.updateGeneralSettings(d.id,val,initial).ok,false);assert.equal(store.get(key),saved);global.localStorage.setItem=set;
});
test('montage, garde de droits et formats non configurables',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8'), ui=fs.readFileSync('modern-proto/js/payroll-general-settings.js','utf8');assert.match(app,/payroll-general-settings-workspace/);assert.match(app,/organization.manageDossiers/);assert.match(ui,/if\(!allowed\(true\)\)/);assert.match(ui,/Modèle à définir/);assert.match(ui,/beforeunload/);assert.match(ui,/data-print-label/);
});
