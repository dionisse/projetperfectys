/* Vérifie l’extraction des TVA facturées/déductibles par période, sans fabriquer les données facture absentes. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/vat-detail-report.js');
const report = globalThis.PerfectoVatDetailReport;

assert.deepEqual(report.DEFAULTS.billedAccounts, ['4431', '4432', '4433']);
assert.deepEqual(report.DEFAULTS.deductibleAccounts, ['4451', '4452', '4453', '4454', '4456']);
assert.throws(() => report.normaliseConfiguration({ billedAccounts: ['4431'], deductibleAccounts: ['443'] }), /même compte/);
assert.deepEqual(report.normaliseConfiguration({ billedAccounts: [' 701 ', '701'], deductibleAccounts: ['4452'] }), { billedAccounts: ['701'], deductibleAccounts: ['4452'] });
assert.equal(report.COLUMNS[0].label, 'N°INSAE/IFU');
assert.throws(() => report.build({ period: '2025' }), /période mensuelle/);

const result = report.build({
  period: '2025-01', decimalPlaces: 0,
  accounts: [
    { code: '4431', label: 'TVA facturée sur ventes' },
    { code: '4432', label: 'TVA facturée sur services' },
    { code: '4452', label: 'TVA récupérable sur achats' },
    { code: '4455', label: 'TVA sur factures non parvenues' },
    { code: '4434', label: 'TVA sur production livrée à soi-même' }
  ],
  entries: [
    { id: 'e1', status: 'posted', date: '2025-01-04', journal: 'VT', reference: 'VT-001', lines: [
      { account: '4431', debit: 0, credit: 1800 }, { account: '4432', debit: 100, credit: 0 }
    ] },
    { id: 'e2', status: 'posted', date: '2025-01-12', journal: 'AC', reference: 'AC-001', lines: [
      { account: '4452', debit: 450, credit: 0 }, { account: '4455', debit: 300, credit: 0 }
    ] },
    { id: 'e3', status: 'draft', date: '2025-01-20', journal: 'VT', reference: 'VT-DRAFT', lines: [{ account: '4431', debit: 0, credit: 5000 }] },
    { id: 'e4', status: 'posted', date: '2025-02-01', journal: 'VT', reference: 'VT-002', lines: [{ account: '4431', debit: 0, credit: 900 }] },
    { id: 'e5', status: 'posted', date: '2025-01-24', journal: 'VT', reference: 'VT-003', lines: [{ account: '4434', debit: 0, credit: 700 }] }
  ]
});
assert.equal(result.generatedLineCount, 2);
assert.equal(result.totals.vatBilled, 1700);
assert.equal(result.totals.vatDeductible, 450);
assert.equal(result.rows.find(row => row.entryId === 'e1').reference, 'VT-001');
assert.equal('invoiceNumber' in result.rows[0], false);
const remapped = report.build({
  period: '2025-01', configuration: { billedAccounts: ['4432'], deductibleAccounts: ['4452'] },
  entries: [{ id: 'custom', status: 'posted', date: '2025-01-05', lines: [
    { account: '4432', debit: 20, credit: 0 }, { account: '4452', debit: 30, credit: 0 }
  ] }]
});
assert.equal(remapped.generatedLineCount, 1);
assert.equal(remapped.totals.vatBilled, -20);
assert.equal(remapped.totals.vatDeductible, 30);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'vat-detail-report.js'), 'utf8');
assert.equal(nav.getTab('declarations', 'vat-detail').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'vat-detail'[\s\S]*viewVatDetailReport/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'vat-detail'\) bindVatDetailReport\(\)/);
assert.match(moduleSource, /N°INSAE\/IFU/);
assert.match(app, /TVA facturée aux clients[\s\S]*TVA déductible/);
assert.match(app, /data-vat-detail-accounts="billedAccounts"/);
assert.match(app, /data-vat-detail-accounts="deductibleAccounts"/);
assert.match(app, /vat-detail-accounts\.v1/);
assert.match(html, /js\/vat-detail-report\.js/);
assert.match(html, /css\/vat-detail-report\.css/);
assert.match(worker, /vat-detail-report\.js/);
assert.match(worker, /vat-detail-report\.css/);
console.log('OK · détail TVA, filtres mensuels et montants 443/445');
