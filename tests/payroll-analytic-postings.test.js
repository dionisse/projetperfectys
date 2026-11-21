'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const api = require('../modern-proto/js/payroll-analytic-postings.js');
const services = [{ id:'s1',code:'DA',label:'Direction administrative' },{ id:'s2',code:'DF',label:'Direction financière' }];
const centers = [{ id:'c1',code:'DA',name:'Administration',active:true },{ id:'c2',code:'CEN-2',name:'Commun',active:true }];
const chart = [{code:'6',postable:false},{code:'641',active:true,postable:true},{code:'642',active:false},{code:'421',postable:true}];
const ctx = { chart, centers };
const plan = { accountingDossierId:'a', prefixes:['6'], overrides:[] };
test('classe 6 en préfixe, subdivisions et contrôles du plan', () => {
  assert.deepEqual(api.prefixes('6, 641'), ['6','641']);
  for (const bad of ['', '4', '6x', '6,6']) assert.throws(() => api.prefixes(bad));
  assert.equal(api.eligible(chart[1],['6']), true);
  assert.equal(api.eligible(chart[0],['6']), false);
  assert.equal(api.eligible(chart[2],['6']), false);
  assert.equal(api.eligible(chart[3],['6']), false);
});
test('proposition par défaut non confirmée, sans création de centre', () => {
  const a = api.analyse(services[0],ctx,plan), b=api.analyse(services[1],ctx,plan);
  assert.equal(a.code,'DA'); assert.match(a.status.join(),/à confirmer/);
  assert.equal(b.code,'DF'); assert.match(b.status.join(),/absent/);
  assert.match(api.analyse(services[0],null,plan).status.join(),/inaccessible/);
  assert.equal(api.analyse({id:'x',code:'Dév',label:'Test'},ctx,plan).code,'DEV');
});
test('correspondances distinctes ou partagées et codes inconnus à vérifier', () => {
  const a=api.prepare(services[0],'cen-2',ctx), b=api.prepare(services[1],'cen-2',ctx);
  assert.equal(a.centerId,'c2'); assert.equal(b.centerId,'c2');
  const unknown=api.prepare(services[0],'ZZ',ctx); assert.equal(unknown.centerId,null);
  assert.match(api.analyse(services[0],{...ctx,centers:[...centers,{id:'z',code:'ZZ',name:'Nouveau'}]},{...plan,overrides:[unknown]}).status.join(),/confirmation requise/);
  assert.throws(()=>api.prepare(services[0],'!',ctx)); assert.throws(()=>api.prepare(services[0],'DA',null));
});
test('changement de service, de centre, archivage, remplacement ou doublon', () => {
  const o=api.prepare(services[0],'CEN-2',ctx), p={...plan,overrides:[o]};
  assert.match(api.analyse(services[0],ctx,p).status.join(),/confirmée/);
  assert.match(api.analyse({...services[0],label:'Nouvelle direction'},ctx,p).status.join(),/reconfirmation/);
  assert.match(api.analyse(services[0],{...ctx,centers:[{...centers[1],id:'new'}]},p).status.join(),/reconfirmation/);
  assert.match(api.analyse(services[0],{...ctx,centers:[{...centers[1],active:false}]},p).status.join(),/archivé/);
  assert.match(api.analyse(services[0],{...ctx,centers:[]},p).status.join(),/absent/);
  assert.throws(()=>api.prepare(services[0],'CEN-2',{...ctx,centers:[centers[1],centers[1]]}),/non unique/);
  assert.throws(()=>api.prepare(services[0],'CEN-2',{...ctx,centers:[{...centers[1],active:false}]}),/archivé/);
  assert.throws(()=>api.prepare(services[0],'CEN-2',{...ctx,centers:[centers[1],{id:'c2',code:'AUTRE'}]}),/dupliqué/);
});
test('stockage isolé, données invalides et erreurs de stockage', () => {
  const map=new Map(), store={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
  api.save(store,'rh',{version:1,plans:[{...plan,overrides:[api.prepare(services[0],'CEN-2',ctx)]}]});
  assert.equal(api.getPlan(api.load(store,'rh'),'a').overrides.length,1);
  assert.equal(api.getPlan(api.load(store,'rh'),'b').overrides.length,0);
  assert.equal(api.getPlan(api.load(store,'rh2'),'a').prefixes[0],'6');
  map.set('EMRYS-payroll-analytic-v1:bad','{broken'); assert.throws(()=>api.load(store,'bad'),/illisibles/); assert.equal(map.get('EMRYS-payroll-analytic-v1:bad'),'{broken');
  assert.throws(()=>api.load({getItem(){throw Error('denied')}},'rh'),/Lecture/);
  assert.throws(()=>api.save({setItem(){throw Error('full')}},'rh',{version:1,plans:[]}),/Enregistrement impossible/);
});
test('intégration liée aux dossiers accessibles et séparation du journal officiel', () => {
  const app=fs.readFileSync('modern-proto/js/app.js','utf8'), src=fs.readFileSync('modern-proto/js/payroll-analytic-postings.js','utf8');
  assert.match(app,/payrollAnalyticContext/); assert.match(app,/S\.analyticalCenters\(\)/); assert.match(app,/snapshot\.state\.analyticalCenters/); assert.match(app,/permittedDemoDossiers/);
  for(const p of ['isDemoTestDossier','options.canView','options.canEdit','options.canDelete']) assert.ok(src.includes(p));
  assert.doesNotMatch(src,/readPeriodDrafts|generateJournal|\.transfer\(/); assert.match(app,/Génération indisponible/);
});
