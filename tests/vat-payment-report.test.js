/* Vérifie les rubriques et l’extraction des mouvements de l’état de paiement TVA. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/vat-payment-report.js');
const report = globalThis.PerfectoVatPaymentReport;

assert.deepEqual(report.ROWS.map(row => row.label), [
  'Ventes locales exonérées',
  'Exportations (taxables)',
  'Exportations (non taxables)',
  'Ventes taxables',
  'Consommations internes taxables',
  'Ventes',
  'Consommations internes',
  'À déduire : retenue à la source',
  'Achats d’exploitation',
  'Achats d’immobilisations',
  'Achats à régulariser',
  'Achats d’exploitation',
  'Achats d’immobilisations'
]);
const defaults = report.defaults(2025);
assert.ok(Object.values(defaults.accounts).every(codes => codes.length === 0), 'aucun compte de rubrique fiscale n’est supposé');
assert.equal(report.accountMatches('44521', ['4452*']), true);
assert.equal(report.accountMatches('44521', ['4432']), false);

const config = report.normalise({ accounts: {
  taxableSales: ['70*'], collectedSales: ['4431'], fullDeductibleOperatingPurchases: ['4452']
} }, 2025);
const result = report.calculateMovements({
  from: '2025-07-01', to: '2025-07-31', configuration: config,
  accounts: [{ code: '7011', label: 'Ventes dans la Région' }, { code: '4431', label: 'TVA facturée sur ventes' }, { code: '4452', label: 'TVA récupérable sur achats' }],
  entries: [
    { status: 'posted', date: '2025-07-03', lines: [
      { account: '7011', debit: 0, credit: 12000 },
      { account: '4431', debit: 0, credit: 2160 },
      { account: '4452', debit: 180, credit: 0 }
    ] },
    { status: 'draft', date: '2025-07-15', lines: [{ account: '7011', debit: 0, credit: 9000 }] },
    { status: 'posted', date: '2025-08-01', lines: [{ account: '7011', debit: 0, credit: 5000 }] },
    { status: 'posted', date: '2025-06-30', lines: [{ account: '7011', debit: 0, credit: 2000 }] }
  ]
});
assert.equal(result.matchedLineCount, 3);
assert.equal(result.rows.find(row => row.key === 'taxableSales').creditTotal, 12000);
assert.equal(result.rows.find(row => row.key === 'taxableSales').debitTotal, 0);
assert.equal(result.rows.find(row => row.key === 'collectedSales').creditTotal, 2160);
assert.equal(result.rows.find(row => row.key === 'fullDeductibleOperatingPurchases').debitTotal, 180);
assert.equal('amountDue' in result, false, 'aucun montant à payer ne doit être supposé');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
assert.equal(nav.getTab('declarations', 'vat-payment').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'vat-payment'[\s\S]*viewVatPaymentReport/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'vat-payment'\) bindVatPaymentReport\(\)/);
assert.match(app, /vat-payment-pharmacy[\s\S]*rate\.disabled = !event\.target\.checked/);
assert.match(app, /openReportPreview\('Aperçu — État de paiement TVA'/);
assert.match(html, /js\/vat-payment-report\.js/);
assert.match(html, /css\/vat-payment-report\.css/);
assert.match(worker, /vat-payment-report\.js/);
assert.match(worker, /vat-payment-report\.css/);
console.log('OK · état de paiement TVA, rubriques, période et mouvements validés');
