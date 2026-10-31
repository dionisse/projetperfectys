/* Commandes fournisseurs analytiques : brouillons, émission confirmée et axes distincts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const storage = new Map();
const localStorage = { getItem(key) { return storage.has(key) ? storage.get(key) : null; }, setItem(key, value) { storage.set(key, String(value)); }, removeItem(key) { storage.delete(key); } };
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array, Set, Map };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
const S = sandbox.window.PerfectoStore;
const dossierId = S.currentDossier().id;
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalSupplierOrdersConfiguration().rows)), [], 'le registre est vierge');
const supplierResult = S.createSupplier({ code: 'FOU-TEST-1', name: 'Fournisseur saisi', accountCode: '401' });
assert.equal(supplierResult.ok, true, supplierResult.errors && supplierResult.errors.join(' '));
const supplier = supplierResult.supplier;
const entriesBefore = S.entries().length;
const nature = S.orderNaturesConfiguration().rows[0];
const order = { reference: 'CMD-TEST-001', date: '2026-04-10', supplierId: supplier.id, natureId: nature.id, description: 'Achat de fournitures', currencyCode: 'XOF', status: 'draft', lines: [{ description: 'Consommables', amount: 10000, analyticalAllocations: [] }] };
const saved = S.saveAnalyticalSupplierOrdersConfiguration([order]);
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
let record = JSON.parse(JSON.stringify(S.analyticalSupplierOrdersConfiguration().rows[0]));
assert.match(record.id, /^analytical-supplier-order-/);
assert.match(record.lines[0].id, /^supplier-order-line-/);
assert.equal(record.status, 'draft');
assert.equal(record.supplierId, supplier.id);
assert.equal(record.lines[0].analyticalAllocations.length, 0);
assert.equal(S.entries().length, entriesBefore, 'un brouillon ne crée aucune écriture');

const invalidDate = S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, date: '2027-01-01' }]);
assert.equal(invalidDate.ok, false);
assert.match(invalidDate.errors.join(' '), /date doit être valide et comprise dans le cycle/);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, supplierId: 'inconnu' }]).ok, false);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, currencyCode: 'ZZZ' }]).ok, false);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, lines: [{ ...record.lines[0], amount: 0 }] }]).ok, false);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, status: 'issued' }]).ok, false, 'une commande neuve ne peut pas être émise directement');
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([]).ok, false, 'une commande ne peut pas être supprimée');

assert.equal(S.saveAnalyticalDimensionValues('activity-domains', [{ label: 'Services', active: true }]).ok, true);
assert.equal(S.saveAnalyticalDimensionValues('expense-categories', [{ label: 'Équipement', active: true }]).ok, true);
const allocations = [
  { natureId: 'activity-domains', valueLabel: 'Services', amount: 10000 },
  { natureId: 'expense-categories', valueLabel: 'Équipement', amount: 10000 }
];
let result = S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, lines: [{ ...record.lines[0], analyticalAllocations: allocations }] }]);
assert.equal(result.ok, true, result.errors && result.errors.join(' '));
record = JSON.parse(JSON.stringify(S.analyticalSupplierOrdersConfiguration().rows[0]));
assert.equal(record.lines[0].analyticalAllocations.length, 2, 'les axes sont indépendants, sans addition transversale');
result = S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, lines: [{ ...record.lines[0], analyticalAllocations: [{ ...allocations[0], amount: 10001 }] }] }]);
assert.equal(result.ok, false, 'un axe ne peut dépasser le montant de la ligne');
assert.match(result.errors.join(' '), /ventilation d’une nature dépasse/);

assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, status: 'issued', issueConfirmed: true }]).ok, true);
record = JSON.parse(JSON.stringify(S.analyticalSupplierOrdersConfiguration().rows[0]));
assert.equal(record.status, 'issued');
assert.ok(record.issuedAt);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, description: 'Modification interdite' }]).ok, false);
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, status: 'cancelled' }]).ok, false, 'annulation à confirmer explicitement');
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...record, status: 'cancelled', cancelConfirmed: true }]).ok, true);
assert.equal(S.analyticalSupplierOrdersConfiguration().rows[0].status, 'cancelled');
assert.equal(S.saveAnalyticalSupplierOrdersConfiguration([{ ...S.analyticalSupplierOrdersConfiguration().rows[0], status: 'issued' }]).ok, false, 'une commande annulée ne peut pas être réactivée');
assert.equal(S.entries().length, entriesBefore, 'émission et annulation ne créent aucune écriture');

const other = S.createDossier({ clientName: 'Dossier commandes isolé', clientCode: 'CMD', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31' });
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(S.switchDossier(other.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(S.analyticalSupplierOrdersConfiguration().rows)), [], 'registre isolé par dossier');
assert.equal(S.switchDossier(dossierId).ok, true);
assert.equal(S.analyticalSupplierOrdersConfiguration().rows[0].status, 'cancelled');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-navigation.js'), 'utf8');
const Navigation = require('../modern-proto/js/accounting-navigation.js');
const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(navigation, /id: 'supplier-orders',[^\n]*status: 'active'/);
assert.match(app, /function viewAnalyticalSupplierOrders\(\)/);
assert.match(app, /function openAnalyticalSupplierOrderLine\(/);
assert.match(app, /exchangeFeature = viewAnalyticalSupplierOrders\(\)/);
assert.match(app, /bindAnalyticalSupplierOrders\(\)/);
assert.equal(Navigation.getTab('editions', 'supplier-orders').status, 'active', 'le sous-menu est disponible dans Éditions');
assert.match(app, /function viewAnalyticalSupplierOrdersEdition\(\)/);
assert.match(app, /exchangeFeature = viewAnalyticalSupplierOrdersEdition\(\)/);
assert.match(app, /function openAnalyticalSupplierOrderEditionDetails\(/);
assert.match(app, /function bindAnalyticalSupplierOrdersEdition\(\)/);
assert.match(app, /Édition en lecture seule des commandes enregistrées/);
assert.match(app, /aucun lien budgétaire, conversion ou écriture n’est créé/i);
assert.match(app, /Imputations analytiques enregistrées · par nature/);
assert.match(app, /Aperçu plein écran \/ imprimer/);
const editionView = app.slice(app.indexOf('function viewAnalyticalSupplierOrdersEdition()'), app.indexOf('function openAnalyticalSupplierOrderEditionDetails('));
assert.doesNotMatch(editionView, /S\.saveAnalyticalSupplierOrdersConfiguration|S\.entries\(\)\.push/);
assert.match(app, /menuParams\.g === 'editions' && menuParams\.t === 'supplier-orders'\) bindAnalyticalSupplierOrdersEdition\(\)/);
assert.match(app, /aucun ordre n’est prérempli/i);
assert.match(css, /\.supplier-order-summary/);
console.log('Commandes fournisseurs analytiques : brouillons, émission confirmée, annulation conservée et axes analytiques distincts — OK');
