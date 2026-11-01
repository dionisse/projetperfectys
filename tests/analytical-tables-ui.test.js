/* Vérifie la grille visuelle commune et les alignements numériques du module analytique. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'modern-proto/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modern-proto/css/analytical-tables.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'modern-proto/service-worker.js'), 'utf8');

const analyticsStylesheet = html.indexOf('css/analytical-tables.css');
assert.ok(analyticsStylesheet > html.indexOf('css/table-design-system.css'),
  'la grille analytique se charge après le système global de tableaux');
assert.ok(analyticsStylesheet > html.indexOf('css/accounting-configuration.css'),
  'les anciennes règles de configuration ne reprennent pas la priorité dans le module');
assert.match(css, /body:is\(\.analytics-module-mode, \.analytical-table-mode\) #view table/,
  'la grille couvre le module et ses sous-menus analytiques dans la Comptabilité générale');
assert.match(app, /function isAnalyticalAccountingMenuRoute\(params\)[\s\S]*responsibility-centers[\s\S]*analytic-movements[\s\S]*analytic-natures[\s\S]*analytic-statements/);
assert.match(app, /toggle\('analytical-table-mode', route === 'analytics' \|\| \(route === 'menu' && isAnalyticalAccountingMenuRoute\(parsed\.params\)\)\)/);
assert.match(css, /--table-head-bg:\s*#f1edf8/);
assert.match(css, /border-radius:\s*12px/);
assert.match(css, /overflow-x:\s*auto/);
assert.match(css, /analytical-natures-table tbody tr\.analytical-natures-group/,
  'les lignes de regroupement ont un traitement commun et lisible');
assert.match(css, /analytical-natures-row\.is-selected[\s\S]*background:\s*#eee8f8/,
  'la sélection des natures utilise la teinte analytique sans perdre le contraste');
assert.match(css, /analytical-statement-unallocated[\s\S]*#fbf6e9/);
assert.match(css, /analytical-statement-unmatched[\s\S]*#fff1ef/);
assert.match(css, /@media \(max-width: 700px\)[\s\S]*analytical-consistency-table/);
assert.match(css, /@media print[\s\S]*overflow:\s*visible/);
assert.match(app, /function analyticalStatementColumnIsNumeric\(column\)[\s\S]*lineCount[\s\S]*debit[\s\S]*credit[\s\S]*net/,
  'les colonnes de valeurs des états sont repérées à partir de leur clé, sans toucher aux calculs');
assert.match(app, /analytical-movement-table[\s\S]*column\.key === 'debit'[\s\S]*column\.key === 'credit'/,
  'les débits et crédits des mouvements ont des en-têtes alignés avec leurs montants');
assert.match(serviceWorker, /\.\/css\/analytical-tables\.css/);

console.log('Suivi Analytique : tableaux harmonisés, responsives, valeurs alignées et états sémantiquement conservés — OK');
