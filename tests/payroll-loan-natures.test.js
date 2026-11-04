'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../modern-proto/js/payroll-loan-natures.js');
test('natures de prêt : validation, codes et données de stockage',()=>{
  assert.deepEqual(api.normalize({code:' 01 ',label:'  Prêt   01 '}),{code:'01',label:'Prêt 01'});
  assert.throws(()=>api.normalize({code:'',label:'X'}));
  assert.throws(()=>api.normalize({code:'X',label:' '}));
  assert.throws(()=>api.normalize({code:'X'.repeat(25),label:'X'}));
  assert.deepEqual(api.parse(null),[]);
  const rows=[{id:'a',code:'Ab',label:'Prêt'}];
  assert.deepEqual(api.parse(JSON.stringify({version:1,items:rows})),rows);
  assert.equal(api.unique(rows,'aB',''),false);
  assert.equal(api.unique(rows,'aB','a'),true);
  assert.throws(()=>api.parse('{'));
  assert.throws(()=>api.parse(JSON.stringify({version:2,items:[]})));
  assert.throws(()=>api.parse(JSON.stringify({version:1,items:rows.concat([{id:'b',code:'ab',label:'Autre'}])})));
});
test('natures de prêt : intégration au menu et cache',()=>{
  const app=fs.readFileSync('modern-proto/js/app.js','utf8');
  assert.match(app,/selectedItem\.id === 'advances-loans'[\s\S]*payroll-loan-nature-workspace/);
  assert.match(fs.readFileSync('modern-proto/index.html','utf8'),/payroll-loan-natures\.js/);
  assert.match(fs.readFileSync('modern-proto/service-worker.js','utf8'),/payroll-loan-natures\.js/);
});
