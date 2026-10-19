'use strict';

const assert = require('assert');
const modules = require('../modern-proto/js/modules.js');

const catalog = modules.all();
const ids = catalog.map((module) => module.id);
const stats = modules.stats();

assert.strictEqual(catalog.length, 5, 'le launcher annonce cinq modules');
assert.strictEqual(new Set(ids).size, ids.length, 'les identifiants des modules sont uniques');
assert.deepStrictEqual(stats, { total: 5, available: 2, planned: 3 });

const accounting = modules.get('accounting');
assert(accounting, 'la Comptabilité générale est dans le catalogue');
assert.strictEqual(accounting.status, 'available');
assert.strictEqual(accounting.route, 'dossiers', 'le module ouvre d’abord la liste multi-dossiers clients');

const payroll = modules.get('payroll-hr');
assert(payroll, 'Paie & RH est dans le catalogue');
assert.strictEqual(payroll.status, 'partial', 'seul le flux interne de centralisation est disponible en démo');
assert.strictEqual(payroll.route, 'payroll');
assert.strictEqual(payroll.scopeable, true, 'les droits Paie & RH peuvent être limités au dossier client');

catalog.filter((module) => module.status === 'planned').forEach((module) => {
  assert.strictEqual(module.route, null, `${module.id} ne doit pas lancer une route non implémentée`);
  assert(module.name && module.description && module.category, `${module.id} doit avoir ses métadonnées`);
});

assert.strictEqual(modules.get('module-inconnu'), null, 'un module inconnu renvoie null');
console.log('Catalogue des modules : 5 modules, 2 accessibles dont Paie & RH partiel, 3 à venir — OK');
