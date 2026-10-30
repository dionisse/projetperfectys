'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const modules = require('../modern-proto/js/modules.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');

const catalog = modules.all();
const ids = catalog.map((module) => module.id);
const stats = modules.stats();

assert.strictEqual(catalog.length, 5, 'le launcher annonce cinq modules');
assert.strictEqual(new Set(ids).size, ids.length, 'les identifiants des modules sont uniques');
assert.deepStrictEqual(stats, { total: 5, available: 4, planned: 1 });

const accounting = modules.get('accounting');
assert(accounting, 'la Comptabilité générale est dans le catalogue');
assert.strictEqual(accounting.status, 'available');
assert.strictEqual(accounting.route, 'dossiers', 'le module ouvre d’abord la liste multi-dossiers clients');

const analytics = modules.get('analytics');
assert(analytics, 'le Suivi Analytique conserve son identifiant technique historique');
assert.strictEqual(analytics.name, 'Suivi Analytique');
assert.strictEqual(analytics.status, 'partial');
assert.strictEqual(analytics.route, 'menu?g=definitions&t=responsibility-centers', 'le module ouvre un écran du dossier comptable partagé');
assert.match(appSource, /ACCESS_MODULES[^\n]*filter\(function \(module\) \{ return module\.id !== 'analytics'; \}\)/, 'le Suivi Analytique ne crée pas un périmètre de droits distinct');
assert.match(appSource, /module\.id === 'accounting' \|\| module\.id === 'analytics'/, 'l’ouverture du Suivi Analytique utilise les droits du dossier comptable');
assert.match(appSource, /requestedModuleId === 'analytics' \? 'accounting' : requestedModuleId/, 'les droits de lancement restent ceux de la Comptabilité générale');

const payroll = modules.get('payroll-hr');
assert(payroll, 'Paie & RH est dans le catalogue');
assert.strictEqual(payroll.status, 'partial', 'seul le flux interne de centralisation est disponible en démo');
assert.strictEqual(payroll.route, 'payroll');
assert.strictEqual(payroll.scopeable, true, 'les droits Paie & RH peuvent être limités au dossier client');

const sales = modules.get('sales-stock-invoicing');
assert(sales, 'Ventes, stock & facturation est dans le catalogue');
assert.strictEqual(sales.status, 'partial', 'seul le flux interne de démonstration est disponible');
assert.strictEqual(sales.route, 'sales');
assert.strictEqual(sales.scopeable, true, 'les droits Ventes, stock & facturation peuvent être limités au dossier client');

catalog.filter((module) => module.status === 'planned').forEach((module) => {
  assert.strictEqual(module.route, null, `${module.id} ne doit pas lancer une route non implémentée`);
  assert(module.name && module.description && module.category, `${module.id} doit avoir ses métadonnées`);
});

assert.strictEqual(modules.get('module-inconnu'), null, 'un module inconnu renvoie null');
console.log('Catalogue des modules : 5 modules, 4 accessibles dont Suivi Analytique intégré, Paie & RH et Ventes partiels, 1 à venir — OK');
