/* Vérifie les référentiels de valeurs analytiques et leur usage en suggestions explicites. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'accounting-navigation.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const permissions = fs.readFileSync(path.join(root, 'js', 'permissions.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(app, /function viewAnalyticalDimensionValues\(natureId\)/);
assert.match(app, /function bindAnalyticalDimensionValues\(natureId\)/);
assert.match(app, /entry-analytical-values-/);
assert.match(app, /aucune classification automatique/);
assert.match(app, /S\.saveAnalyticalDimensionValues\(natureId, rows\)/);
assert.match(app, /ANALYTICAL_VALUE_REGISTRY_NATURES\.indexOf\(tab\.id\)/);
assert.match(store, /function saveAnalyticalDimensionValues\(natureId, inputRows\)/);
assert.match(store, /ne peut pas être supprimée\/renommée/);
assert.match(permissions, /analyticalValues\.configure/);
for (const id of ['activity-domains', 'expense-categories', 'funding-sources', 'alternate-accounts', 'vehicle-expenses', 'mission-beneficiaries', 'cash-flow-natures']) {
  assert.match(navigation, new RegExp("id: '" + id + "'.*status: 'active'"));
}
assert.match(css, /\.analytical-dimension-view/);
assert.match(worker, /perfecto-static-v169/);

console.log('Référentiels analytiques : écrans, suggestions explicites, droits et ressources vérifiés — OK');
