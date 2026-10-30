/* Le nominatif n’affiche que des lignes fournies explicitement par une source liée. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/nominative-declaration-report.js');
const report = globalThis.PerfectoNominativeDeclarationReport;

assert.deepEqual(report.COLUMNS.map(column => column.label), ['Fournisseur', 'N°INSAE/IFU', 'Prélèvement effectué']);
assert.throws(() => report.build({ period: '2025' }), /mois de référence/);
const empty = report.build({ period: '2025-01' });
assert.equal(empty.generatedLineCount, 0);
assert.equal(empty.sourceLinked, false);
const linked = report.build({
  period: '2025-01',
  records: [
    { period: '2025-01', supplier: 'Fournisseur réel', ifu: 'IFU réel', withholding: 1250 },
    { period: '2025-02', supplier: 'Autre période', ifu: 'IFU-2', withholding: 950 }
  ]
});
assert.equal(linked.generatedLineCount, 1);
assert.deepEqual(linked.rows[0], { supplier: 'Fournisseur réel', ifu: 'IFU réel', withholding: 1250 });

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'nominative-declaration-report.js'), 'utf8');
assert.equal(nav.getTab('declarations', 'nominative-statement').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'nominative-statement'[\s\S]*viewNominativeDeclaration/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'nominative-statement'\) bindNominativeDeclaration\(\)/);
assert.match(moduleSource, /Prélèvement effectué/);
assert.match(moduleSource, /N°INSAE\/IFU/);
assert.match(app, /Ouvrir l’aperçu plein écran/);
assert.match(html, /js\/nominative-declaration-report\.js/);
assert.match(html, /css\/nominative-declaration-report\.css/);
assert.match(worker, /nominative-declaration-report\.js/);
assert.match(worker, /nominative-declaration-report\.css/);
assert.match(workflow, /run: npm test/);
console.log('OK · sélection mensuelle et colonnes nominatives sans données inventées');
