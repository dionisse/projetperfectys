const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const simulation=require('../modern-proto/js/payroll-journal-simulation.js');
const math=require('../modern-proto/js/payroll-cumulative-book.js');
const tools={numbers(v){const s=String(v==null?'':v).trim();if(!s)return '';if(!/^-?\d{1,12}(?:[.,]\d{1,6})?$/.test(s))throw Error('invalid');return s.replace(',','.');}};
const months=['2026-01'];
const input={months,period:'2026-01',employees:[{id:'a',employeeNumber:'01',displayName:'A'}, {id:'b'}],drafts:{a:{'gross-salary':{amount:'1000,125'},'cnss-contributions':{amount:'20.125'},'ipts':{amount:'30'},'supp-insurance':{amount:'10'},'net-salary':{amount:'940'},'amount-payable':{amount:'700'}},unknown:{}}};
test('projection partielle exacte, sans confondre net et montant à payer',()=>{
 const before=JSON.stringify(input),r=simulation.build(input,tools,math),a=r.entries[0];assert.equal(JSON.stringify(input),before);assert.equal(r.entries.length,1);assert.deepEqual(r.without,['b']);assert.deepEqual(r.unknown,['unknown']);assert.equal(a.rows.find(x=>x.code==='422').value,940000000n);assert.equal(a.payable.value,700000000n);assert.equal(a.debit,1000125000n);assert.equal(a.credit,1000125000n);assert.equal(a.complete,true);assert.equal(a.rows[0].control,'Plan non vérifié');
});
test('absence, zéro, montants invalides ou négatifs distincts ; pas de fausse complétude',()=>{
 const r=simulation.build({...input,drafts:{a:{'gross-salary':{amount:'0'},'ipts':{amount:'abc'},'net-salary':{amount:'-2'},'supp-insurance':{amount:[]}}}},tools,math).entries[0];assert.equal(r.rows[0].value,0n);assert.equal(r.rows[1].issue,'Non renseigné');assert.equal(r.rows[2].issue,'Montant invalide');assert.equal(r.rows[3].issue,'Montant illisible');assert.equal(r.rows[4].issue,'Montant négatif à vérifier');assert.equal(r.complete,false);
});
test('codes exacts et comptes uniquement indicatifs, actifs ou non',()=>{
 const chart=[{code:'6611',label:'Personnalisé',active:true,postable:true},{code:'4311',active:false},{code:'447',postable:false},{code:'42860',label:'autre'}];let rows=simulation.build({...input,chart},tools,math).entries[0].rows;assert.equal(rows[0].accountLabel,'Personnalisé');assert.equal(rows[0].control,'Compte à confirmer');assert.equal(rows[1].control,'Compte inactif');assert.equal(rows[2].control,'Compte non imputable');assert.equal(rows[3].control,'Compte non disponible');
});
test('mois invalide et doublons rejetés',()=>{assert.throws(()=>simulation.build({...input,period:'2025-01'},tools,math));assert.throws(()=>simulation.build({...input,employees:[{id:'a'},{id:'a'}]},tools,math));});
test('aperçu isolé, droits et protections inchangées',()=>{
 const s=fs.readFileSync('modern-proto/js/payroll-journal-simulation.js','utf8');assert.match(s,/isDemoTestDossier/);assert.match(s,/options\.canView\(\)/);assert.match(s,/readPeriodDrafts/);assert.doesNotMatch(s,/localStorage|\.save\(|\.export\(|\.transfer\(/);assert.match(s,/aucun équilibre global/);assert.match(s,/montant à payer est distinct et non imputé/);
 const app=fs.readFileSync('modern-proto/js/app.js','utf8');assert.match(app,/testDossier \? '<div id="payroll-journal-simulation-workspace/);assert.match(app,/window\.PayrollJournalSimulation\.mount/);assert.match(app,/payrollJournalPlan/);
});
