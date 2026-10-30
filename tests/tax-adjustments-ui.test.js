/* La vue fiscale propose un calcul limité, revu humainement avant transfert IS. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8');
const taxEngine = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'is-tax-adjustments.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const permissions = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'permissions.js'), 'utf8');

assert.match(navigation, /id:\s*'tax-adjustments',[\s\S]{0,260}status:\s*'partial'/);
assert.match(app, /group\.id === 'fin-exercice' && tab\.id === 'tax-adjustments'[\s\S]{0,100}viewTaxAdjustments\(\)/);
assert.match(app, /function viewTaxAdjustments\(\)/);
assert.match(app, /taxAdjustmentAnalysis/);
assert.match(app, /Reporter les propositions dans IS/);
assert.match(app, /conditions de fond et de preuve/);
assert.match(app, /Article 15 confirmé/);
assert.match(app, /apply-tax-adjustments-is/);
assert.match(app, /article15-standard/);
assert.match(taxEngine, /article: '15'/);
assert.match(taxEngine, /article: '35'/);
assert.match(taxEngine, /article: '36'/);
assert.match(index, /js\/is-tax-adjustments\.js/);
assert.match(serviceWorker, /\.\/js\/is-tax-adjustments\.js/);
assert.match(app, /function openTaxAdjustmentModal\(id\)/);
assert.match(app, /function deleteTaxAdjustment\(id\)/);
assert.match(app, /data-action="new-tax-adjustment"/);
assert.match(app, /data-action="edit-tax-adjustment"/);
assert.match(app, /data-action="delete-tax-adjustment"/);
assert.match(app, /Aucune déclaration ni écriture ne sera modifiée/);
assert.match(store, /createTaxAdjustment/);
assert.match(store, /updateTaxAdjustment/);
assert.match(store, /deleteTaxAdjustment/);
assert.match(permissions, /taxAdjustments\.create/);
assert.match(permissions, /taxAdjustments\.edit/);
assert.match(permissions, /taxAdjustments\.delete/);

console.log('Ajustements fiscaux : navigation, déclaration séparée, CRUD et permissions UI — OK');
