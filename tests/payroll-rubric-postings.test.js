const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const posting=require('../modern-proto/js/payroll-rubric-postings');
const status={id:'status-a',rubricIds:posting.totals.map(x=>x.id)};
const chart=[{code:'6611',label:'Salaires',active:true,postable:true},{code:'422',label:'Personnel',active:true,postable:true},{code:'431',active:false},{code:'664',postable:false},{code:'4472',label:'Impôts'},{code:'4472',label:'Doublon'}];
const input={status,rubricId:'salary-base-total',accountingDossierId:'accounting-a',chart,lines:[{code:'6611',side:'debit'},{code:'422',side:'credit'}]};
test('imputation manuelle multiligne, liée au statut et au plan sans mutation',()=>{let before=JSON.stringify(input);let r=posting.prepare([],input);assert.equal(JSON.stringify(input),before);assert.deepEqual(r,{statusId:'status-a',rubricId:'salary-base-total',accountingDossierId:'accounting-a',lines:[{code:'6611',side:'debit',label:'Salaires'},{code:'422',side:'credit',label:'Personnel'}]});});
test('strictement des totaux retenus, compte exact actif et imputable, sens et doublons',()=>{
 for(const change of [{rubricId:'seniority-premium'},{status:{id:'a',rubricIds:[]}},{accountingDossierId:''},{chart:null},{lines:[]},{lines:[{code:'431',side:'credit'}]},{lines:[{code:'664',side:'debit'}]},{lines:[{code:'4472',side:'credit'}]},{lines:[{code:'661',side:'debit'}]},{lines:[{code:'6611',side:'bad'}]},{lines:[{code:'6611',side:'debit'},{code:'6611',side:'debit'}]}]) assert.throws(()=>posting.prepare([],{...input,...change}));
});
test('totaux redondants interdits au sein du statut mais isolés entre statuts',()=>{
 const rec=posting.prepare([],input);assert.throws(()=>posting.prepare([rec],{...input,rubricId:'gross-salary'}),/brut global/);assert.throws(()=>posting.prepare([rec],{...input,rubricId:'base-elements-total'}),/base/);assert.doesNotThrow(()=>posting.prepare([rec],{...input,status:{...status,id:'b'},rubricId:'gross-salary'}));let n=posting.prepare([],{...input,rubricId:'net-salary'});assert.throws(()=>posting.prepare([n],{...input,rubricId:'amount-payable'}),/Salaire net/);
});
test('stockage isolé par dossier, corrompu non écrasé et compte modifié signalable',()=>{
 let m=new Map(),storage={getItem(k){return m.has(k)?m.get(k):null},setItem(k,v){m.set(k,v)}};const rec=posting.prepare([],input);posting.save(storage,'a',{version:1,records:[rec]});assert.equal(posting.load(storage,'b').records.length,0);assert.equal(posting.load(storage,'a').records[0].lines.length,2);m.set('EMRYS-payroll-rubric-postings-v1:b','{broken');assert.throws(()=>posting.load(storage,'b'),/illisible/);assert.equal(m.get('EMRYS-payroll-rubric-postings-v1:b'),'{broken');assert.equal(posting.matchAccount([{code:'6611',label:'Autre'}],'6611').account.label,'Autre');
});
test('intégration distincte de la génération et des droits',()=>{
 const src=fs.readFileSync('modern-proto/js/payroll-rubric-postings.js','utf8'),app=fs.readFileSync('modern-proto/js/app.js','utf8');assert.match(src,/isDemoTestDossier/);assert.match(src,/options.canView\(\)/);assert.match(src,/options.canEdit\(\)/);assert.match(src,/options.canDelete\(\)/);assert.match(src,/non retenue/);assert.match(src,/dossier comptable a changé/i);assert.doesNotMatch(src,/readPeriodDrafts|generateJournal|\.transfer\(/);assert.match(app,/payroll-rubric-postings-workspace/);assert.match(app,/Génération indisponible/);
});
