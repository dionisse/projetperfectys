/* Vérifie le calcul prudent, le remplissage du classeur officiel et le rapport CSV. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
globalThis.fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
require('../modern-proto/js/vat-declaration-workbook.js');
const workbook = globalThis.PerfectoVatDeclarationWorkbook;

const selectors = {
  exemptLocalSales: ['7010'], taxableExports: ['7020'], nonTaxableExports: ['7030'], taxableSales: ['7040'],
  taxableInternalConsumption: ['7050'], collectedSales: ['4431'], collectedInternalConsumption: ['4432'],
  fullDeductibleOperatingPurchases: ['4451'], fullDeductibleFixedAssets: ['4452'],
  fullDeductibleRegularisation: [], prorataDeductibleOperatingPurchases: ['4453'], prorataDeductibleFixedAssets: ['4454'],
  sourceWithholding: []
};
const movements = {
  exemptLocalSales: [0, 100], taxableExports: [0, 20], nonTaxableExports: [0, 30], taxableSales: [0, 200],
  taxableInternalConsumption: [0, 5], collectedSales: [0, 18], collectedInternalConsumption: [0, 0],
  fullDeductibleOperatingPurchases: [10, 0], fullDeductibleFixedAssets: [0, 0],
  fullDeductibleRegularisation: [0, 0], prorataDeductibleOperatingPurchases: [0, 0], prorataDeductibleFixedAssets: [10, 0],
  sourceWithholding: [0, 0]
};
const movementReport = { rows: Object.keys(selectors).map(key => ({
  key, selectors: selectors[key], accounts: selectors[key].length ? [{ code: selectors[key][0], debit: movements[key][0], credit: movements[key][1] }] : []
})), decimalPlaces: 0, serviceExigibleMovement: {
  selectors: ['4438'], accounts: [{ code: '4438', debit: 0, credit: 4 }], debitTotal: 0, creditTotal: 4, netCredit: 4
}, gaps: [] };
const preparation = {
  period: '2026-07', decimalPlaces: 0, configuration: { accounts: selectors, serviceVatBasis: 'debits', serviceVatBasisConfirmed: true, serviceExigibleVatAccounts: ['4438'], prorataPercent: '50' },
  declaration: { from: '2026-07-01', to: '2026-07-31', credit: '0', extraDeduction: '0', extraAmount: '0', paymentMethod: 'cash', city: 'Cotonou', declarantDate: '2026-08-05' },
  movementReport, serviceVatRelease: null
};
preparation.calculated = workbook.calculate(preparation);
assert.equal(preparation.calculated.totals.bases, 350, 'la base 05 totalise les lignes 01 à 04');
assert.equal(preparation.calculated.totals.collectedVat, 22, 'le mouvement de TVA exigible sur services est intégré une fois');
assert.equal(preparation.calculated.totals.deductibleOperating, 10);
assert.equal(preparation.calculated.totals.deductibleFixed, 5, 'le prorata validé s’applique aux immobilisations concernées');
assert.equal(preparation.calculated.totals.net, 7);
assert.equal(preparation.calculated.gaps.length, 0);
const unsupportedAdjustmentReport = Object.assign({}, movementReport, {
  rows: movementReport.rows.map(row => row.key === 'fullDeductibleRegularisation'
    ? Object.assign({}, row, { selectors: ['4459'], accounts: [{ code: '4459', debit: 3, credit: 0 }] }) : row)
});
const unsupportedAdjustment = workbook.calculate(Object.assign({}, preparation, { movementReport: unsupportedAdjustmentReport }));
assert.equal(unsupportedAdjustment.totals.deductions, null, 'une rubrique déductible non traitée empêche un total/net partiel');
assert.equal(unsupportedAdjustment.values.mTVANet, '');
const unconfirmedLegacyBasis = workbook.calculate(Object.assign({}, preparation, {
  configuration: Object.assign({}, preparation.configuration, { serviceVatBasis: 'cash', serviceVatBasisConfirmed: false, serviceExigibleVatAccounts: [] }),
  movementReport: Object.assign({}, movementReport, { serviceExigibleMovement: { selectors: [], netCredit: 0 } }),
  serviceVatRelease: { ok: true, confirmed: true, total: 9, gaps: [] }
}));
assert.equal(unconfirmedLegacyBasis.values.mTVABrut, '', 'un ancien régime par défaut n’est pas accepté comme confirmé');

const templatePath = path.join(__dirname, '..', 'modern-proto', 'assets', 'vat-declaration-template.xlsx');
const template = new Uint8Array(fs.readFileSync(templatePath));
const printedRows = [
  ['insae-number', 'TEST-INSAE'], ['ifu-number', 'TEST-IFU'], ['company-name', 'Entreprise de test'],
  ['business-name', 'Essai'], ['head-office-address', 'Adresse de test'], ['secondary-address-1', 'Complément 1'],
  ['secondary-address-2', 'Complément 2'], ['signature-city', 'Cotonou']
].map(([id, value]) => ({ id, value }));
const generated = workbook.generateWorkbook(template, preparation, printedRows);
assert.equal(generated.complete, true);
assert.equal(generated.formulaCount, 31);
const originalFiles = globalThis.fflate.unzipSync(template);
const generatedFiles = globalThis.fflate.unzipSync(generated.bytes);
const originalFormulaCount = (new TextDecoder().decode(originalFiles['xl/worksheets/sheet1.xml']).match(/<f(?:\s[^>]*)?>/g) || []).length;
const generatedSheet = new TextDecoder().decode(generatedFiles['xl/worksheets/sheet1.xml']);
assert.equal(originalFormulaCount, 31);
assert.equal((generatedSheet.match(/<f(?:\s[^>]*)?>/g) || []).length, originalFormulaCount, 'le nombre de formules reste inchangé');
assert.match(generatedSheet, /<c[^>]*r="N22"[^>]*>[\s\S]*?<v>350<\/v>/);
assert.match(generatedSheet, /<c[^>]*r="H47"[^>]*>[\s\S]*?<v>7<\/v>/);

const uncertain = workbook.calculate(Object.assign({}, preparation, {
  configuration: Object.assign({}, preparation.configuration, { serviceVatBasis: 'cash', serviceExigibleVatAccounts: [] }),
  movementReport: Object.assign({}, movementReport, { serviceExigibleMovement: { selectors: [], netCredit: 0 } }),
  serviceVatRelease: { ok: false, confirmed: false, total: null, candidateTotal: 90, gaps: [{ message: 'Ventilation TVA par ligne inconnue.' }] }
}));
assert.equal(uncertain.values.mTVABrut, '');
assert.equal(uncertain.totals.collectedVat, null);
assert.equal(uncertain.completeness.collectedVat, false);
assert.ok(uncertain.gaps.some(item => /Ventilation TVA par ligne inconnue/.test(item.message)));

const csv = workbook.buildGapCsv({ calculated: uncertain, declaration: preparation.declaration }, []);
assert.match(csv, /Ventilation TVA par ligne inconnue/);
assert.match(csv, /IFU/);
const uncertainGenerated = workbook.generateWorkbook(template, Object.assign({}, preparation, {
  configuration: Object.assign({}, preparation.configuration, { serviceVatBasis: 'cash', serviceExigibleVatAccounts: [] }),
  movementReport: Object.assign({}, movementReport, { serviceExigibleMovement: { selectors: [], netCredit: 0 } }),
  serviceVatRelease: { ok: false, confirmed: false, total: null, candidateTotal: 90, gaps: [{ message: 'Ventilation TVA par ligne inconnue.' }] },
  calculated: uncertain
}), []);
assert.equal(uncertainGenerated.complete, false, 'un classeur avec lacunes ne déclenche pas de recalcul automatique trompeur');
assert.match(new TextDecoder().decode(globalThis.fflate.unzipSync(uncertainGenerated.bytes)['xl/workbook.xml']), /calcMode="manual"/);
console.log('OK · calcul TVA prudent, classeur officiel et lacunes CSV');
