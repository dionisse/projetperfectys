/* Tests du tableau de passage interne : stockage ciblé, validation et usage par les opérations. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const storage = new Map();
global.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); }
};

const Bridge = require('../modern-proto/js/accounting-bridge.js');
const PayrollHR = require('../modern-proto/js/payroll-hr.js');
const SalesOperations = require('../modern-proto/js/sales-stock-invoicing.js');
const SalesCentralization = require('../modern-proto/js/sales-centralization.js');
const Navigation = require('../modern-proto/js/accounting-navigation.js');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const serviceWorkerSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');

const sourcePayroll = PayrollHR.accountingAccountCatalog();
const sourceSales = SalesOperations.accountingAccountCatalog();
const targetAccounts = [
  { code: '641', label: 'Rémunérations du personnel', active: true, postable: true },
  { code: '421', label: 'Personnel, rémunérations dues', active: true, postable: true },
  { code: '431', label: 'Organismes sociaux', active: true, postable: true },
  { code: '411', label: 'Clients', active: true, postable: true },
  { code: '701', label: 'Ventes de marchandises', active: true, postable: true },
  { code: '601', label: 'Achats de marchandises', active: true, postable: true },
  { code: '401', label: 'Fournisseurs, dettes en compte', active: true, postable: true },
  { code: '499', label: 'Compte cible de test', active: true, postable: true },
  { code: '498', label: 'Compte inactif', active: false, postable: true },
  { code: '497', label: 'Compte non imputable', active: true, postable: false }
];

assert.deepEqual(sourcePayroll, [], 'aucun compte de paie n’est préconfiguré sans règles et rubriques validées');
assert.deepEqual(new Set(sourceSales.map(account => account.code)), new Set(['411', '701', '601', '401']));
assert.ok(sourceSales.every(account => account.postable && account.active));

const empty = Bridge.get('dossier-a', 'payroll-hr');
assert.equal(empty.ok, true);
assert.deepEqual(empty.mappings, []);

const attemptedUnvalidatedPayrollMapping = Bridge.save('dossier-a', 'payroll-hr', [
  { sourceCode: '641', targetCode: '499' }
], sourcePayroll, targetAccounts);
assert.equal(attemptedUnvalidatedPayrollMapping.ok, false, 'une correspondance de paie ne peut viser une rubrique source inexistante/non validée');
assert.deepEqual(Bridge.get('dossier-a', 'payroll-hr').mappings, []);
assert.deepEqual(Bridge.get('dossier-b', 'payroll-hr').mappings, [], 'les dossiers cibles ont des tableaux séparés');
assert.deepEqual(Bridge.get('dossier-a', 'sales-stock-invoicing').mappings, [], 'les modules sources ont des tableaux séparés');

const savedSales = Bridge.save('dossier-a', 'sales-stock-invoicing', [
  { sourceCode: '411', targetCode: '411' },
  { sourceCode: '701', targetCode: '701' },
  { sourceCode: '601', targetCode: '601' },
  { sourceCode: '401', targetCode: '401' }
], sourceSales, targetAccounts);
assert.equal(savedSales.ok, true, savedSales.errors.join('\n'));
assert.equal(Bridge.get('dossier-a', 'sales-stock-invoicing').mappings.length, 4);

const dossier = { id: 'dossier-a', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' };
assert.deepEqual(Bridge.get(dossier.id, 'payroll-hr').mappings, [], 'la configuration de paie reste vide jusqu’à validation de ses sources');

const salesRunResult = SalesOperations.createDemoRun(dossier, '2026-01');
assert.equal(salesRunResult.ok, true, salesRunResult.errors.join('\n'));
assert.equal(SalesOperations.approveRun(dossier, salesRunResult.run.id).ok, true);
const salesRun = SalesOperations.getRun(dossier.id, salesRunResult.run.id);
const salesMap = Object.fromEntries(Bridge.get(dossier.id, 'sales-stock-invoicing').mappings.map(mapping => [mapping.sourceCode, mapping.targetCode]));
const salesAggregate = SalesCentralization.aggregate(salesRun, salesMap, targetAccounts);
assert.equal(salesAggregate.ok, true, salesAggregate.errors.join('\n'));
assert.equal(salesAggregate.lines.length, 4);

for (const invalid of [
  [{ sourceCode: '999', targetCode: '499' }],
  [{ sourceCode: '641', targetCode: '498' }],
  [{ sourceCode: '641', targetCode: '497' }],
  [{ sourceCode: '641', targetCode: '499' }, { sourceCode: '641', targetCode: '421' }],
  [{ sourceCode: '641', targetCode: '' }]
]) {
  const rejected = Bridge.save('dossier-a', 'payroll-hr', invalid, sourcePayroll, targetAccounts);
  assert.equal(rejected.ok, false);
}
assert.deepEqual(Bridge.get('dossier-a', 'payroll-hr').mappings, [],
  'aucune configuration paie n’est enregistrée sans rubriques source validées');

const corruptKey = 'perfecto.accounting-bridge.v2.' + encodeURIComponent('dossier-corrupt') + '.' + encodeURIComponent('payroll-hr');
storage.set(corruptKey, '{broken');
assert.equal(Bridge.get('dossier-corrupt', 'payroll-hr').ok, false, 'un paramétrage illisible reste signalé et n’est pas remplacé');

assert.equal(Navigation.getTab('parametres', 'accounting-bridge').status, 'partial');
assert.equal(Navigation.getTab('fichier', 'centralize-auxiliary').status, 'mixed');
assert.equal(Navigation.getTab('fichier', 'centralize-auxiliary').children.find(child => child.id === 'centralize-auxiliary-fec').status, 'partial');
assert.ok(Navigation.getTab('parametres', 'accounting-bridge').reason.includes('par module source PERFECTO et dossier cible actif'));
assert.match(appSource, /group\.id === 'parametres' && tab\.id === 'accounting-bridge'[\s\S]*viewAccountingBridge\(\)/);
assert.match(appSource, /menuParams\.t === 'accounting-bridge'\) bindAccountingBridge\(\)/);
assert.match(appSource, /function accountingBridgeConfiguredAccountMap\([\s\S]*AccountingBridge\.get\(dossier\.id, sourceModuleId\)/);
assert.match(appSource, /createPayrollCentralizationSession\(run, dossier\)[\s\S]*accountingBridgeConfiguredAccountMap\(dossier, 'payroll-hr', run\.accountingLines, false\)/);
assert.match(appSource, /function createPayrollCentralizationSession\([\s\S]*targetDate: '',[\s\S]*targetJournal: '',[\s\S]*targetReference: ''/);
assert.match(appSource, /— Choisir un journal —[\s\S]*Aucun journal n’est présélectionné/);
assert.match(appSource, /Centralisation bloquée : choisissez explicitement la date, le journal et la référence comptable/);
assert.match(appSource, /createSalesCentralizationSession\(run, dossier\)[\s\S]*accountingBridgeConfiguredAccountMap\(dossier, 'sales-stock-invoicing'/);
assert.match(appSource, /function saveAccountingBridgeFromView\([\s\S]*AccountingBridge\.validateMappings[\s\S]*window\.confirm[\s\S]*AccountingBridge\.save/);
assert.match(appSource, /Les opérations Paie & RH et Ventes, stock & facturation chargent ces correspondances comme point de départ/);
assert.match(htmlSource, /js\/accounting-bridge\.js/);
assert.match(serviceWorkerSource, /\.\/js\/accounting-bridge\.js/);

console.log('Tableau de passage : stockage par dossier/module, contrôles et consommation par Paie & RH et Ventes — OK');
