/* L’AIB reste un paramétrage par année; aucun taux ni montant légal n’est inventé. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../modern-proto/js/aib-suppliers-report.js');
const report = globalThis.PerfectoAibSuppliersReport;

assert.deepEqual(report.CATEGORIES.map(row => row.label), ['AIB SUR ACHATS', 'AIB SUR HONORAIRES']);
assert.deepEqual(report.defaults(2025).categories.map(row => row.lines.length), [1, 1]);
assert.deepEqual(report.defaults(2025).categories.map(row => row.lines[0].rate), ['', '']);
assert.throws(() => report.removeLine(report.defaults(2025), 'purchases', 'purchases-1'), /au moins une ligne/);
let withExtraPurchaseLine = report.addLine(report.defaults(2025), 'purchases');
assert.equal(withExtraPurchaseLine.categories[0].lines.length, 2);
assert.equal(withExtraPurchaseLine.categories[1].lines.length, 1);
let manyLines = report.defaults(2025);
for (let i = 0; i < 20; i++) manyLines = report.addLine(manyLines, 'purchases');
for (let i = 0; i < 12; i++) manyLines = report.addLine(manyLines, 'honoraires');
assert.deepEqual(manyLines.categories.map(row => row.lines.length), [21, 13]);
assert.equal(new Set(manyLines.categories.flatMap(row => row.lines.map(line => line.id))).size, 34);
withExtraPurchaseLine = report.removeLine(withExtraPurchaseLine, 'purchases', 'purchases-2');
assert.equal(withExtraPurchaseLine.categories[0].lines.length, 1);
assert.deepEqual(report.normalise({ year: 2025, categories: [{ key: 'purchases', rate: '2', accounts: ['401*'] }] }, 2025).categories[0].lines[0], { id: 'purchases-1', rate: '2', accounts: ['401*'] });
assert.throws(() => report.prepare({ period: '2025-01' }), /saisissez un taux/i);
assert.equal(report.cleanAccounts(['4471*', '4471*', '44x', '447801']).join(','), '4471*,447801');
assert.equal(report.isAibSubaccountToken('447801'), true);
assert.equal(report.isAibSubaccountToken('44780*'), true);
assert.equal(report.isAibSubaccountToken('4478'), false);
assert.equal(report.isAibSubaccountToken('4493'), false);
assert.equal(report.isAibSubaccountToken('4471*'), false);

const configuration = report.normalise({ categories: [
  { key: 'purchases', lines: [
    { id: 'purchases-1', rate: '1,5 %', accounts: ['447801'] },
    { id: 'purchases-2', rate: '2', accounts: ['447804'] }
  ] },
  { key: 'honoraires', lines: [{ id: 'honoraires-1', rate: '3', accounts: ['447803'] }] }
] }, 2025);
const validation = report.validateDefinition(configuration, 2025);
assert.equal(validation.ok, true);
assert.equal(validation.configuration.categories[0].lines[0].rate, '1.5');
assert.equal(validation.configuration.categories[0].lines.length, 2);
const outsideAibFamily = report.validateDefinition({ categories: [
  { key: 'purchases', lines: [{ rate: '1', accounts: ['4493'] }] },
  { key: 'honoraires', lines: [{ rate: '2', accounts: ['447803'] }] }
] }, 2025);
assert.equal(outsideAibFamily.ok, false);
assert.ok(outsideAibFamily.errors.some(message => /4493.*n’est pas un sous-compte de 4478/.test(message)));
const incomplete = report.validateDefinition({ categories: [
  { key: 'purchases', lines: [{ rate: '', accounts: [] }, { rate: '2', accounts: ['447801'] }] },
  { key: 'honoraires', lines: [{ rate: '3', accounts: ['447803'] }] }
] }, 2025);
assert.equal(incomplete.ok, false);
assert.ok(incomplete.errors.some(message => message.includes('Ligne 1 de « AIB SUR ACHATS »')));
const preparation = report.prepare({
  period: '2025-01', configuration,
  payment: { method: 'cheque', cheque: 'CH-01', bank: 'Banque' },
  signer: 'Signataire configuré', city: 'Cotonou', signatureDate: '2025-01-31'
});
assert.equal(preparation.payment.method, 'cheque');
assert.equal(preparation.declarant.signer, 'Signataire configuré');
assert.equal(preparation.excelTable, null);
assert.equal(preparation.generatedWithholdingLines, 0);

const movementConfiguration = report.normalise({ year: 2025, categories: [
  { key: 'purchases', lines: [{ id: 'goods-1', rate: '1', accounts: ['447801'] }] },
  { key: 'honoraires', lines: [{ id: 'services-1', rate: '5', accounts: ['447803'] }] }
] }, 2025);
const movementAnalysis = report.analyseMonth({
  period: '2025-01', configuration: movementConfiguration, decimalPlaces: 0,
  entries: [
    { id: 'goods-01', reference: 'AC-01', status: 'posted', date: '2025-01-04', lines: [
      { account: '601100', debit: 1000000, credit: 0 },
      { account: '447801', debit: 0, credit: 10000 },
      { account: '401100', debit: 0, credit: 1010000 }
    ] },
    { id: 'service-01', reference: 'AC-02', status: 'posted', date: '2025-01-12', lines: [
      { account: '632600', debit: 500000, credit: 0 },
      { account: '447803', debit: 0, credit: 25000 },
      { account: '401200', debit: 0, credit: 525000 }
    ] },
    { id: 'goods-no-aib', reference: 'AC-03', status: 'posted', date: '2025-01-15', lines: [
      { account: '601100', debit: 100000, credit: 0 },
      { account: '401100', debit: 0, credit: 100000 }
    ] },
    { id: 'dgi-payment', reference: 'BQ-01', status: 'posted', date: '2025-01-20', lines: [
      { account: '447803', debit: 25000, credit: 0 },
      { account: '521100', debit: 0, credit: 25000 }
    ] },
    { id: 'draft', reference: 'AC-DRAFT', status: 'draft', date: '2025-01-21', lines: [
      { account: '601100', debit: 700000, credit: 0 },
      { account: '447801', debit: 0, credit: 7000 },
      { account: '401100', debit: 0, credit: 707000 }
    ] },
    { id: 'other-month', reference: 'AC-DEC', status: 'posted', date: '2024-12-31', lines: [
      { account: '601100', debit: 900000, credit: 0 },
      { account: '447801', debit: 0, credit: 9000 },
      { account: '401100', debit: 0, credit: 909000 }
    ] }
  ]
});
assert.equal(movementAnalysis.ok, true);
assert.equal(movementAnalysis.categories[0].lines[0].base, 1100000);
assert.equal(movementAnalysis.categories[0].lines[0].theoreticalAmount, 11000);
assert.equal(movementAnalysis.categories[0].lines[0].recordedAmount, 10000);
assert.equal(movementAnalysis.categories[0].lines[0].actualComplete, false);
assert.equal(movementAnalysis.categories[0].lines[0].variance, null, 'un montant comptabilisé partiel n’est pas présenté comme un écart complet');
assert.equal(movementAnalysis.categories[1].lines[0].base, 500000);
assert.equal(movementAnalysis.categories[1].lines[0].theoreticalAmount, 25000);
assert.equal(movementAnalysis.categories[1].lines[0].recordedAmount, 25000);
assert.equal(movementAnalysis.categories[1].lines[0].variance, 0);
assert.ok(movementAnalysis.gaps.some(gap => gap.reference === 'AC-03' && /aucun mouvement créditeur net/.test(gap.message)));
assert.equal(movementAnalysis.gaps.some(gap => gap.reference === 'BQ-01'), false, 'un règlement isolé à la DGI n’est pas compté comme une nouvelle retenue');
assert.equal(movementAnalysis.gaps.some(gap => gap.reference === 'AC-DRAFT'), false, 'les brouillons sont exclus');
assert.equal(movementAnalysis.gaps.some(gap => gap.reference === 'AC-DEC'), false, 'les écritures hors mois sont exclues');
const preparedWithMovements = report.prepare({ period: '2025-01', configuration: movementConfiguration, entries: [] });
assert.equal(preparedWithMovements.movementAnalysis.ok, true);
const transferPreparation = report.prepare({ period: '2025-01', configuration: movementConfiguration, payment: { method: 'transfer', transferBank: 'Banque exemple', transferReference: 'REF-01' } });
assert.equal(transferPreparation.payment.method, 'transfer');
assert.equal(transferPreparation.payment.transferBank, 'Banque exemple');

const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
const templatePath = path.join(__dirname, '..', 'modern-proto', 'assets', 'aib-suppliers-template.xlsx');
const templateBytes = new Uint8Array(fs.readFileSync(templatePath));
const workbookPreparation = report.prepare({
  period: '2025-01', configuration: movementConfiguration,
  entries: [{ id: 'goods-01', reference: 'AC-01', status: 'posted', date: '2025-01-04', lines: [
    { account: '601100', debit: 1000000, credit: 0 },
    { account: '447801', debit: 0, credit: 10000 },
    { account: '401100', debit: 0, credit: 1010000 }
  ] }],
  decimalPlaces: 0, signer: 'Signataire', city: 'Cotonou', signatureDate: '2025-01-31', payment: { method: 'cash' }
});
const generated = report.generateWorkbook(templateBytes, workbookPreparation, {
  printedInformationRows: [{ id: 'company-name', value: 'Société & Fils' }], decimalPlaces: 0
});
assert.equal(generated.formulaCount, 46, 'les 46 formules du formulaire officiel sont conservées');
assert.equal(generated.totalTheoreticalAmount, 10000);
const generatedFiles = fflate.unzipSync(generated.bytes);
const decoder = new TextDecoder('utf-8');
const originalWorkbookXml = decoder.decode(fflate.unzipSync(templateBytes)['xl/worksheets/sheet1.xml']);
const generatedSheetXml = decoder.decode(generatedFiles['xl/worksheets/sheet1.xml']);
const generatedWorkbookXml = decoder.decode(generatedFiles['xl/workbook.xml']);
const formulas = xml => Array.from(xml.matchAll(/<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/g), match => match[1]);
assert.deepEqual(formulas(generatedSheetXml), formulas(originalWorkbookXml), 'les expressions de formule source restent identiques');
assert.match(generatedSheetXml, /r="K22"[^>]*>[\s\S]*?<v>1000000<\/v>/);
assert.match(generatedSheetXml, /r="N22"[^>]*>[\s\S]*?<v>10000<\/v>/);
assert.match(generatedSheetXml, /r="N31"[^>]*>[\s\S]*?<v>10000<\/v>/);
assert.match(generatedSheetXml, /r="E12"[^>]*>[\s\S]*?Société &amp; Fils/);
assert.doesNotMatch(generatedSheetXml + generatedWorkbookXml, /Dares Services Sarl|zéro|2025-01-01/);
assert.match(generatedWorkbookXml, /fullCalcOnLoad="1"/);
assert.ok(generated.gaps.some(gap => /lettres/.test(gap.message)));
const gapCsv = report.buildGapReport(generated.gaps);
assert.equal(gapCsv.charCodeAt(0), 0xFEFF);
assert.match(gapCsv, /Montant du versement en lettres/);
assert.throws(() => report.generateWorkbook(templateBytes, report.prepare({ period: '2025-01', configuration: report.normalise({ categories: [
  { key: 'purchases', lines: Array.from({ length: 5 }, (_, index) => ({ id: 'goods-' + index, rate: '1', accounts: ['447801'] })) },
  { key: 'honoraires', lines: [{ id: 'services-1', rate: '5', accounts: ['447803'] }] }
] }, 2025), entries: [] })), /quatre lignes/);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
assert.equal(nav.getTab('declarations', 'aib-suppliers').status, 'active');
assert.match(app, /group\.id === 'declarations' && tab\.id === 'aib-suppliers'[\s\S]*viewAibSuppliersReport/);
assert.match(app, /menuParams\.g === 'declarations' && menuParams\.t === 'aib-suppliers'\) bindAibSuppliersReport\(\)/);
assert.match(app, /Valider la définition des taux/);
assert.doesNotMatch(app, /name="aib-suppliers-payment" value="cash" checked/, 'le modèle ne préremplit pas un mode de paiement d’exemple');
assert.match(app, /entries: S\.postedEntries\(\), decimalPlaces: S\.accountingConfiguration\(\)\.decimalPlaces/);
assert.match(app, /data-aib-add-line/);
assert.match(app, /data-aib-remove-line/);
assert.match(app, /data-aib-edit/);
assert.match(app, /data-aib-download-workbook/);
assert.match(app, /AibSuppliersReport\.loadTemplate\(\)[\s\S]*AibSuppliersReport\.generateWorkbook/);
assert.match(app, /data-aib-download-gaps/);
assert.match(app, /value="transfer"/);
assert.match(app, /code\.indexOf\('4478'\) === 0 && code\.length > 4/);
assert.match(app, /Les comptes 4493 ne sont pas utilisés/);
assert.match(app, /openReportPreview\('Aperçu — AIB sur fournisseurs/);
assert.match(app, /print-information/);
assert.match(app, /aib-suppliers\.v1/);
assert.match(html, /js\/aib-suppliers-report\.js/);
assert.match(html, /css\/aib-suppliers-report\.css/);
assert.match(worker, /aib-suppliers-report\.js/);
assert.match(worker, /aib-suppliers-report\.css/);
assert.match(worker, /aib-suppliers-template\.xlsx/);
assert.match(workflow, /modern-proto\/assets\/aib-suppliers-template\.xlsx/);
assert.match(workflow, /run: npm test/);
console.log('OK · analyse AIB mensuelle configurée, rapprochement 4478 et rapport d’écarts');
