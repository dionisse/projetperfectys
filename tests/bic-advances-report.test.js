/* Ne pas déduire un acompte/client à partir du seul compte 447CL. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/bic-advances-report.js');
const report = globalThis.PerfectoBicAdvancesReport;

assert.deepEqual(report.COLUMNS.map(column => column.label), ['Client', 'Acompte collecté', 'N°INSAE/IFU']);
assert.throws(() => report.build({ period: '2025' }), /mois de référence/);
const empty = report.build({ period: '2025-01' });
assert.equal(empty.generatedLineCount, 0);
assert.equal(empty.sourceLinked, false);
const linked = report.build({ period: '2025-01', records: [
  { period: '2025-01', client: 'Client réel', advance: 1250, ifu: 'IFU réel' },
  { period: '2025-02', client: 'Autre mois', advance: 800, ifu: 'IFU-2' }
] });
assert.equal(linked.generatedLineCount, 1);
assert.deepEqual(linked.rows[0], { client: 'Client réel', advance: 1250, ifu: 'IFU réel' });

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'bic-advances-report.js'), 'utf8');
assert.equal(nav.getTab('declarations', 'bic-advances').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'bic-advances'[\s\S]*viewBicAdvancesReport/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'bic-advances'\) bindBicAdvancesReport\(\)/);
assert.match(app, /447CL/);
assert.match(moduleSource, /N°INSAE\/IFU/);
assert.match(html, /js\/bic-advances-report\.js/);
assert.match(html, /css\/bic-advances-report\.css/);
assert.match(worker, /bic-advances-report\.js/);
assert.match(worker, /bic-advances-report\.css/);
assert.match(workflow, /node tests\/bic-advances-report\.test\.js/);
console.log('OK · sélection mensuelle Acomptes BIC par client, sans données inventées');
