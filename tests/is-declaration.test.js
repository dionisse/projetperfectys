'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const Is = require('../modern-proto/js/is-declaration.js');
const zip = require('../modern-proto/vendor/fflate-0.8.2.js');

assert.strictEqual(Is.TEMPLATE_SHA256, 'bec9dc0fe66fedb108728a1736c625c7a44ce3ade1664fe2ac95d59f855f1e28');
const defaults = Is.defaults();
assert.ok(Object.values(defaults.mappings).every((codes) => codes.length === 0), 'unvalidated post mappings must remain blank');
assert.strictEqual(Is.normalise({ mappings: { H3: ['ta', 'TA', 'bad-code', 'TA'] } }).mappings.H3.join(','), 'TA');

const manual = Object.fromEntries(Is.MANUAL_FIELDS.map((field) => [field.key, '']));
Object.assign(manual, {
  'IS2!H44': '850',
  'IS4!O3': '6',
  'IS4!O4': '100',
  'IS4!O8': '1',
  'IS4!O9': '2',
  'IS4!O12': '3',
  'IS4!O13': '4'
});
const calculated = Is.calculate({
  balance: [{ code: '701', debit: 0, credit: 1000 }],
  accountMappings: { '701': { credit: 'TA' } },
  configuration: { mappings: { H3: ['TA'] } },
  manual,
  printedInformationRows: [
    { id: 'company-name', value: 'Société de test' },
    { id: 'ifu-number', value: '1234567890123' },
    { id: 'head-office-address', value: 'Cotonou' }
  ],
  cycleStart: '2025-01-01',
  cycleEnd: '2025-12-31',
  companyType: 'industrial',
  regime: 'normal'
});
assert.strictEqual(calculated.values['IS2!H3'], 1000, 'verified configurable OHADA mapping supplies a value');
assert.strictEqual(calculated.values['IS2!H5'], null, 'unmapped lines stay blank rather than becoming zero');
assert.strictEqual(calculated.values['IS2!H44'], 850, 'taxable result is a documented manual entry, not inferred');
assert.strictEqual(calculated.values['IS4!O3'], 6, 'minimum tax is not computed from an unvalidated tax base');
assert.strictEqual(calculated.values['IS4!O14'], 90, 'payment balance follows the workbook formula from entered tax and credits');
assert.ok(calculated.gaps.length > 0, 'unknown and incomplete fields are reported');
const csv = Is.buildGapCsv({ calculated });
assert.ok(csv.startsWith('\ufeff"Feuille";'));
assert.ok(csv.includes('Donnée source non fournie'));

const template = fs.readFileSync(path.join(root, 'modern-proto/assets/is-declaration-template.xlsx'));
const generated = Is.generateWorkbook(template, { calculated });
assert.strictEqual(generated.formulaCount, 21, 'the model formulas are retained');
assert.ok(generated.bytes.length > 0);
const files = zip.unzipSync(generated.bytes);
const sheet2 = new TextDecoder().decode(files['xl/worksheets/sheet2.xml']);
const sheet4 = new TextDecoder().decode(files['xl/worksheets/sheet4.xml']);
assert.match(sheet2, /r="H3"[^>]*><v>1000<\/v>/);
assert.doesNotMatch(sheet2, /656589064|77098985|695295648|23968901/);
assert.doesNotMatch(sheet4, /7336000/);
const workbook = new TextDecoder().decode(files['xl/workbook.xml']);
assert.doesNotMatch(workbook, /Dares Services Sarl/);

const html = fs.readFileSync(path.join(root, 'modern-proto/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const statements = fs.readFileSync(path.join(root, 'modern-proto/js/ohada-financial-statements.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'modern-proto/service-worker.js'), 'utf8');
assert.match(statements, /Déclaration fiscales IS/);
assert.match(html, /css\/is-declaration\.css/);
assert.match(html, /js\/is-declaration\.js/);
assert.match(app, /bindIsDeclaration/);
assert.match(worker, /assets\/is-declaration-template\.xlsx/);
assert.match(worker, /js\/is-declaration\.js/);
assert.match(worker, /css\/is-declaration\.css/);
console.log('Tests IS declaration : OK');
