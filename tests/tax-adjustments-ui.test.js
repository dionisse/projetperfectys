/* La vue fiscale reste un registre documentaire et ne remplit pas les déclarations. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const store = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8');
const permissions = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'permissions.js'), 'utf8');

assert.match(navigation, /id:\s*'tax-adjustments',[\s\S]{0,260}status:\s*'partial'/);
assert.match(app, /group\.id === 'fin-exercice' && tab\.id === 'tax-adjustments'[\s\S]{0,100}viewTaxAdjustments\(\)/);
assert.match(app, /function viewTaxAdjustments\(\)/);
assert.match(app, /Aucun transfert automatique vers les déclarations/);
assert.match(app, /H38 « Charges non déductibles » et H39 « Déductions autorisées »/);
assert.match(app, /champs IBA d’ajustements, restent saisis et contrôlés séparément/);
assert.match(app, /Le rapprochement de ce registre avec ces rubriques devra éviter les omissions et doubles inclusions/);
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
