/* Vérifie que le style des tableaux est global, chargé en dernier et disponible hors ligne. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'modern-proto', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modern-proto', 'css', 'table-design-system.css'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'modern-proto', 'service-worker.js'), 'utf8');
const stylesheetLinks = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"\s*\/>/g)].map(match => match[1]);
const modernIndex = stylesheetLinks.indexOf('css/modern.css');
const configurationIndex = stylesheetLinks.indexOf('css/accounting-configuration.css');
const tableSystemIndex = stylesheetLinks.indexOf('css/table-design-system.css');

assert.ok(modernIndex >= 0 && configurationIndex > modernIndex && tableSystemIndex > configurationIndex,
  'le système partagé est chargé après les styles des composants existants');
assert.match(css, /^table\s*\{/m, 'les tableaux présents et futurs sont ciblés par leur élément HTML');
assert.match(css, /table\s+:is\(th, td\)[\s\S]*border:\s*1px solid var\(--table-line\) !important/,
  'toutes les cellules utilisent le même quadrillage fin');
assert.match(css, /table thead :is\(th, td\)[\s\S]*background:\s*var\(--table-head-bg\) !important[\s\S]*text-transform:\s*none !important/,
  'les en-têtes partagent le fond pâle et la casse lisible de la référence');
assert.match(css, /table thead :is\(th, td\)\[colspan\][\s\S]*text-align:\s*center/,
  'les en-têtes groupés restent centrés');
assert.match(css, /table tbody > tr:nth-child\(even\)[\s\S]*var\(--table-row-alt\)/,
  'les lignes utilisent un zébrage discret');
assert.match(css, /--table-head-bg:\s*#eff4f1/);
assert.match(css, /--table-row-alt:\s*#f8faf9/);
assert.match(serviceWorker, /perfecto-static-v157/);
assert.match(serviceWorker, /\.\/css\/table-design-system\.css/,
  'le nouveau style est inclus dans le cache hors ligne');

console.log('Système global des tableaux : quadrillage, en-têtes, zébrage et cache hors ligne — OK');
