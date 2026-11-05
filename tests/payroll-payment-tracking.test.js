'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const storage=new Map();global.localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v))};
const tools=require('../modern-proto/js/payroll-payslip-workspace.js'),payments=require('../modern-proto/js/payroll-payment-tracking.js');
test('déclaration, prévention des doublons et conservation des annulations',()=>{
 storage.clear();const dossier={id:'d',cycleStart:'2026-01-01',cycleEnd:'2026-12-31'},employee={id:'e'},hr={currentDossier:()=>dossier,isDemoTestDossier:()=>true,employees:()=>[employee]};let allowed=true;const deps={hr,tools,canValidate:()=>allowed};const snapshot={'amount-payable':{amount:'100.50'},sal:{amount:'100.50'}};localStorage.setItem('perfecto.payroll.payslip-drafts.v1.d',JSON.stringify({version:1,drafts:{'2026-01':{e:snapshot}},groups:[]}));const args={dossierId:'d',employeeId:'e',period:'2026-01',snapshot,date:'2026-01-05',method:'Virement Bancaire',reference:'fictif',testOnly:true,actorId:'u'};
 assert.throws(()=>payments.declare({...args,testOnly:false},deps),/Confirmez/);assert.throws(()=>payments.declare({...args,date:'2099-01-01'},deps),/date/);assert.throws(()=>payments.declare({...args,method:''},deps),/mode/);
 allowed=false;assert.throws(()=>payments.declare(args,deps),/Droit/);allowed=true;
 const entry=payments.declare(args,deps);assert.equal(entry.amount,'100.50');assert.equal(entry.accountingStatus,'not-implemented');assert.equal(payments.status(entry,snapshot),'paid');assert.equal(payments.status(entry,{'amount-payable':{amount:'101'}}),'changed');assert.throws(()=>payments.declare(args,deps),/déjà/);
 assert.equal(payments.active(payments.load('d'),'autre','2026-01'),null);assert.equal(payments.active(payments.load('d'),'e','2026-02'),null);assert.equal(payments.active(payments.load('autre'),'e','2026-01'),null);
 assert.throws(()=>payments.cancel({...args,paidId:entry.id,reason:''},deps),/motif/);payments.cancel({...args,paidId:entry.id,reason:'Erreur de saisie'},deps);assert.equal(payments.active(payments.load('d'),'e','2026-01'),null);assert.equal(payments.load('d').events.length,2);assert.equal(payments.load('d').events[1].paidId,entry.id);
 localStorage.setItem('perfecto.payroll.payslip-drafts.v1.d',JSON.stringify({version:1,drafts:{'2026-01':{e:{'amount-payable':{amount:'200'}}}},groups:[]}));assert.throws(()=>payments.declare(args,deps),/changé/);assert.equal(payments.load('d').events.length,2);
 localStorage.setItem('perfecto.payroll.payment-declarations.v1.d','invalide');assert.throws(()=>payments.load('d'),/illisible/);assert.throws(()=>payments.declare({...args,snapshot:{'amount-payable':{amount:'200'}}},deps),/illisible/);
});
