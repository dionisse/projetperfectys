/* Contrats d’interface pour le répertoire autonome Paie & RH. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const modules = fs.readFileSync(path.join(root, 'modern-proto/js/modules.js'), 'utf8');
const payroll = fs.readFileSync(path.join(root, 'modern-proto/js/payroll-hr.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'modern-proto/css/modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'modern-proto/service-worker.js'), 'utf8');

assert.match(modules, /id: 'payroll-hr'[\s\S]*route: 'payroll-dossiers'/);
assert.match(app, /'payroll-dossiers': \['Dossiers RH/);
assert.match(app, /function viewPayrollDossiers\([\s\S]*Créer un dossier client Paie & RH/);
assert.match(app, /PRH-' \+ code \+ '-' \+ year/);
assert.match(app, /Aucun lien automatique avec un dossier comptable/);
assert.match(app, /Aucun salarié, calcul, écriture comptable ou dossier comptable n’est créé automatiquement/);
assert.match(app, /function permittedPayrollDossiers\([\s\S]*PayrollHR\.dossiers\(\)/);
assert.match(app, /module\.id === 'payroll-hr' \? PayrollHR\.dossiers\(\) : S\.dossiers\(\)/);
assert.match(app, /function payrollRunFromSelection\([\s\S]*payrollDossier\.accountingDossierId !== String\(accountingDossierId/);
assert.match(payroll, /var DOSSIER_CATALOG_KEY = 'perfecto\.payroll\.dossiers\.v1'/);
assert.match(payroll, /function createDossier\(input\)[\s\S]*'PRH-' \+ clientCode \+ '-' \+ \(exerciseYear/);
assert.match(payroll, /accountingDossierId: accountingDossierId/);
assert.match(payroll, /function storageKey\(dossierId\)[\s\S]*STORAGE_PREFIX \+ encodeURIComponent/);
assert.match(css, /\.payroll-dossier-grid[\s\S]*\.payroll-dossier-card/);
assert.match(worker, /perfecto-static-v198/);
console.log('UI Paie & RH : route dossier dédiée, référence PRH, sélection par dossier et association non automatique — OK');
