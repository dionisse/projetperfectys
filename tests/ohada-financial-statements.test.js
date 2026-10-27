/* Le sélecteur OHADA reprend la nomenclature de la capture sans inventer de tableaux chiffrés. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/ohada-financial-statements.js');
const report = globalThis.PerfectoOhadaFinancialStatements;

assert.equal(report.DEFAULT_SELECTED_KEY, 'all-items-by-account');
assert.deepEqual(report.ITEMS.filter(item => !item.separator).map(item => item.label), [
  'Tableaux financiers OHADA révisé',
  'Déclaration fiscale (IS)',
  'Déclaration IRPP',
  'Déclaration des honoraires',
  'Ensemble des postes détaillés par comptes',
  'Charges détaillées par comptes',
  'Produits détaillés par comptes',
  'Actif détaillé par comptes',
  'Passif détaillé par comptes',
  'Déductions et réintégrations fiscales'
]);
assert.throws(() => report.buildPreview('missing', 2026), /Sélectionnez un état/);
const preview = report.buildPreview(report.DEFAULT_SELECTED_KEY, 2026);
assert.equal(preview.label, 'Ensemble des postes détaillés par comptes');
assert.equal(preview.exercise, 2026);
assert.equal(preview.generatedLineCount, 0);
assert.deepEqual(preview.financialRows, []);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
assert.equal(nav.getTab('declarations', 'ohada-statements').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'ohada-statements'[\s\S]*viewOhadaFinancialStatements/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'ohada-statements'\) bindOhadaFinancialStatements\(\)/);
assert.match(app, /Éditer l’état sélectionné/);
assert.match(app, /openReportPreview\('Aperçu — '/);
assert.match(html, /js\/ohada-financial-statements\.js/);
assert.match(html, /css\/ohada-financial-statements\.css/);
assert.match(worker, /ohada-financial-statements\.js/);
assert.match(worker, /ohada-financial-statements\.css/);
assert.match(workflow, /node tests\/ohada-financial-statements\.test\.js/);
console.log('OK · sélecteur des tableaux financiers OHADA, aperçu sans calculs inventés');
