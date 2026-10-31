/* Vérifie le paramétrage explicite des règles analytiques en français. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const permissions = fs.readFileSync(path.join(root, 'js', 'permissions.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(app, /function viewAnalyticalAccountRules\(\)/);
assert.match(app, /Obligatoire/);
assert.match(app, /Facultative/);
assert.match(app, /Autoriser un reliquat « À ventiler »/);
assert.match(app, /nature obligatoire manquante bloque la validation/);
assert.match(app, /S\.saveAnalyticalAccountRulesConfiguration\(/);
assert.match(app, /Règles du compte /);
assert.match(store, /function analyticalAccountRuleErrors\(/);
assert.match(store, /analyticalAccountRulesForAccount\(accountCode\)/);
assert.match(store, /L’imputation « '[\s\S]*obligatoire pour le compte/);
assert.match(store, /n’autorise pas une ventilation partielle/);
assert.match(permissions, /analyticalAccountRules\.configure/);
assert.match(navigation, /analytic-account-rules/);
assert.match(css, /\.analytical-account-rules-table/);
assert.match(worker, /perfecto-static-v168/);

console.log('Règles par compte : écrans, droits, contrôles à la validation et résumés en français — OK');
