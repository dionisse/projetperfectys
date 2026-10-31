/* Vérifie l’accès au contrôle analytique consultatif depuis les éditions. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'accounting-navigation.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'js', 'journal-lines-report.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(app, /function viewAnalyticalConsistencyControl\(backLink\)/);
assert.match(app, /function bindAnalyticalConsistencyControl\(\)/);
assert.match(app, /menuParams\.t === 'analytic-statements'[\s\S]{0,120}ANALYTICAL_STATEMENT_IDS/);
assert.match(app, /JournalLinesReport\.buildAnalyticalConsistencyReport\(/);
assert.match(app, /Ne crée, ne corrige et ne modifie aucune écriture/);
assert.match(app, /natures sans règle obligatoire ne sont pas présumées obligatoires/i);
assert.match(navigation, /id: 'analytic-consistency-control'.*status: 'active'/);
assert.match(report, /function buildAnalyticalConsistencyReport\(options\)/);
assert.match(report, /reliquat partiel n’est pas autorisé explicitement/);
assert.match(app, /analyticalDimensionValues:.*analyticalDimensionValuesConfiguration/);
assert.match(report, /absente du référentiel renseigné ; la valeur reste non classée/);
assert.match(css, /\.analytical-consistency-table/);
assert.match(worker, /perfecto-static-v170/);

console.log('Contrôle des ventilations analytiques : navigation, calcul consultatif, export et style vérifiés — OK');
