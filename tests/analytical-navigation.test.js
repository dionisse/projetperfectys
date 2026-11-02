/* Vérifie la navigation propre au Suivi Analytique et son raccordement à l’application. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const navigation = require('../modern-proto/js/analytical-navigation.js');
const modules = require('../modern-proto/js/modules.js');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'modern-proto/index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'modern-proto/service-worker.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modern-proto/css/analytical-module.css'), 'utf8');
const groups = navigation.all();

assert.deepEqual(groups.map(group => group.id), ['home', 'imputations', 'references', 'reports']);
assert.deepEqual(groups.map(group => group.label), ['Accueil', 'Imputations', 'Référentiels analytiques', 'États analytiques']);
assert.equal(navigation.getGroup('unknown').id, 'home');
assert.equal(navigation.getItem('reports', 'unknown').id, 'analytic-center-balance');
assert.equal(navigation.getItem('imputations', 'source-entry').contextOnly, true, 'la pièce source est un item contextuel, pas un menu permanent supplémentaire');
assert.ok(groups.flatMap(group => group.items).every(item => item.status === 'active'));
assert.equal(groups.find(group => group.id === 'imputations').items.find(item => item.id === 'entry').route, 'entry');
assert.doesNotMatch(fs.readFileSync(path.join(root, 'modern-proto/js/analytical-navigation.js'), 'utf8'), /PerfectoAccountingNavigation/,
  'le catalogue analytique est autonome et ne réutilise pas la navigation générale');

const analytics = modules.get('analytics');
assert.equal(analytics.route, 'analytics-dossiers');
assert.equal(analytics.name, 'Suivi Analytique');
assert.match(app, /'analytics'[^\]]*'menu'/, 'la route dédiée est reconnue par le routeur');
assert.match(app, /case 'analytics': html = viewAnalyticalModule\(parsed\.params\)/);
assert.match(app, /function setModuleSidebar\(route, params\)[\s\S]*analyticalSidebarMarkup\(params, route\)[\s\S]*accountingSidebarMarkup/,
  'le menu analytique remplace la navigation générale et celle-ci est restaurée en sortie');
assert.match(app, /var ACCOUNTING_ROUTES = \['analytics'/,
  'les permissions et le dossier restent dans le même périmètre comptable');
assert.match(app, /function analyticalWorkspaceHash[\s\S]*parseHash\(\)\.route === 'analytics'[\s\S]*analyticalMenuHash/,
  'les raccourcis de référentiel reviennent dans le parcours analytique');
assert.match(app, /function viewAnalyticalModule\(params\)[\s\S]*viewAnalyticalStatement\([\s\S]*backLink/,
  'les états analytiques ont un retour dans le menu autonome');
assert.match(app, /analytics-module-mode/);
assert.match(app, /phoneRouteAllowed = route === 'dossiers' \|\| route === 'analytics'/,
  'la route dédiée reste accessible dans le parcours mobile');
assert.match(html, /css\/analytical-module\.css/);
assert.ok(html.indexOf('js/analytical-navigation.js') < html.indexOf('js/app.js'),
  'le catalogue analytique est chargé avant le routeur');
assert.match(serviceWorker, /perfecto-static-v214/);
assert.match(serviceWorker, /\.\/js\/analytical-navigation\.js/);
assert.match(serviceWorker, /\.\/css\/analytical-module\.css/);
assert.match(css, /body\.analytics-module-mode/);

console.log('Navigation Suivi Analytique : route autonome, menus dédiés, retours locaux et dossier partagé — OK');
