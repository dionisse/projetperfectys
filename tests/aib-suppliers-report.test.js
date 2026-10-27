/* L’AIB reste un paramétrage par année; aucun taux ni montant légal n’est inventé. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/aib-suppliers-report.js');
const report = globalThis.PerfectoAibSuppliersReport;

assert.deepEqual(report.CATEGORIES.map(row => row.label), ['AIB SUR ACHATS', 'AIB SUR HONORAIRES']);
assert.deepEqual(report.defaults(2025).categories.map(row => row.rate), ['', '']);
assert.throws(() => report.prepare({ period: '2025-01' }), /Saisissez un taux/);
assert.equal(report.cleanAccounts(['4471*', '4471*', '44x']).join(','), '4471*');

const configuration = report.normalise({ categories: [
  { key: 'purchases', rate: '1,5 %', accounts: ['4471*'] },
  { key: 'honoraires', rate: '3', accounts: ['4472'] }
] }, 2025);
const validation = report.validateDefinition(configuration, 2025);
assert.equal(validation.ok, true);
assert.equal(validation.configuration.categories[0].rate, '1.5');
const preparation = report.prepare({
  period: '2025-01', configuration,
  payment: { method: 'cheque', cheque: 'CH-01', bank: 'Banque' },
  signer: 'Signataire configuré', city: 'Cotonou', signatureDate: '2025-01-31'
});
assert.equal(preparation.payment.method, 'cheque');
assert.equal(preparation.declarant.signer, 'Signataire configuré');
assert.equal(preparation.excelTable, null);
assert.equal(preparation.generatedWithholdingLines, 0);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
assert.equal(nav.getTab('declarations', 'aib-suppliers').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'aib-suppliers'[\s\S]*viewAibSuppliersReport/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'aib-suppliers'\) bindAibSuppliersReport\(\)/);
assert.match(app, /Valider la définition des taux/);
assert.match(app, /data-aib-edit/);
assert.match(app, /openReportPreview\('Aperçu — AIB sur fournisseurs/);
assert.match(app, /print-information/);
assert.match(app, /aib-suppliers\.v1/);
assert.match(html, /js\/aib-suppliers-report\.js/);
assert.match(html, /css\/aib-suppliers-report\.css/);
assert.match(worker, /aib-suppliers-report\.js/);
assert.match(worker, /aib-suppliers-report\.css/);
assert.match(workflow, /node tests\/aib-suppliers-report\.test\.js/);
console.log('OK · paramétrage mensuel AIB fournisseurs, sans taux ni calcul présumés');
