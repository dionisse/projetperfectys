'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const map=new Map();
global.localStorage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
const hr=require('../modern-proto/js/payroll-hr.js');
const key='perfecto.payroll.dossiers.v1';
test('lien explicite, contrôle de concurrence et conservation des autres données',()=>{
  const d=hr.createTestDossier().dossier;
  const raw=JSON.parse(map.get(key));raw.unrecognized={keep:'unchanged'};raw.dossiers.push({id:'unknown',unrecognized:true});map.set(key,JSON.stringify(raw));
  assert.equal(hr.updateAccountingDossierLink(d.id,'accounting-a','').ok,true);
  assert.equal(JSON.parse(map.get(key)).unrecognized.keep,'unchanged');
  assert.deepEqual(JSON.parse(map.get(key)).dossiers.at(-1),{id:'unknown',unrecognized:true});
  const snapshot=map.get(key);
  assert.match(hr.updateAccountingDossierLink(d.id,'accounting-b','').errors.join(),/changé ailleurs/);
  assert.equal(map.get(key),snapshot);
  assert.equal(hr.updateAccountingDossierLink(d.id,'','accounting-a').ok,true);
  assert.equal(JSON.parse(map.get(key)).dossiers[0].accountingDossierId,'');
});
test('catalogue invalide, dossier ambigu et stockage indisponible ne provoquent aucun écrasement',()=>{
  const saved=map.get(key);map.set(key,'{broken');assert.equal(hr.updateAccountingDossierLink('test','x').ok,false);assert.equal(map.get(key),'{broken');
  const data=JSON.parse(saved);data.dossiers.push({...data.dossiers[0]});map.set(key,JSON.stringify(data));const duplicate=map.get(key);assert.equal(hr.updateAccountingDossierLink(data.dossiers[0].id,'x').ok,false);assert.equal(map.get(key),duplicate);
  map.set(key,saved);const set=global.localStorage.setItem;global.localStorage.setItem=()=>{throw Error('quota')};assert.equal(hr.updateAccountingDossierLink(JSON.parse(saved).dossiers[0].id,'x').ok,false);assert.equal(map.get(key),saved);global.localStorage.setItem=set;
});
test('écran de source liée et raccourcis locaux, sans fausse sauvegarde ni envoi en ligne',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8');
 assert.match(app,/viewPayrollAccountsLocation/);assert.match(app,/payrollJournalPlan\(dossier\)/);assert.match(app,/Association existante inaccessible/);
 assert.match(app,/payroll-location-export/);assert.match(app,/personnel-list/);assert.match(app,/payroll-book-detail/);assert.match(app,/Indisponible pour le moment/);
 assert.match(app,/ne constituent pas une sauvegarde restaurable/);assert.match(app,/isDemoTestDossier\(now.id\)/);assert.match(app,/updateAccountingDossierLink\(initialLocationDossier, selected, initialLocationLink\)/);
});
