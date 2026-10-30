'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const Iba = require('../modern-proto/js/iba-declaration.js');

function validData(overrides = {}) {
  return Object.assign({
    taxpayerName: 'Contribuable Test', taxpayerIfu: '1234567890123', taxpayerAddress: 'Cotonou', businessDescription: 'Commerce général', taxOffice: 'Cotonou', supportingReference: 'Pièces comptables exercice',
    taxpayerKind: 'individual', ownAccount: 'yes', habitualActivity: 'yes', activityCategory: 'business', exemption: 'none', territoryVerified: 'yes', accountingMethod: 'accrual', profile: 'standard', halfReduction: 'no', combinedBusinessAndLiberal: 'no', successionArticle62Verified: 'no',
    lossesVerified: 'yes', art47ProductsVerified: 'yes', accountingResultBenin: '1000000', personalDrawings: '0', personalExpenses: '0', ownerCapitalInterest: '0', nonLinearDepreciation: '0', mixedExpenses: '0',
    nonProfessionalPropertyIncome: '0', nonProfessionalPropertyExpenses: '0', spouseSalaryDisallowed: '0', familySalaryDisallowed: '0', otherAdditions: '0', otherDeductions: '0', pensionAndLifePaid: '0', pensionAndLifeAlreadyDeducted: '0',
    lossYear1: '0', lossYear2: '0', lossYear3: '0', confirmedTaxableBase: '1000000', cashableProducts: '10000000', profitSharePercent: '', specialMinimum: '', stationLitres: ''
  }, overrides);
}
function calculate(overrides = {}) { return Iba.calculate({ data: validData(overrides), cycleStart: '2025-01-01', cycleEnd: '2025-12-31' }); }

assert.strictEqual(Iba.RATES.standard, 30);
assert.strictEqual(Iba.RATES.privateEducation, 25);
assert.strictEqual(Iba.RATES.minimumStandard, 1.5);
assert.strictEqual(Iba.RATES.minimumCfa, 250000);

const standard = calculate();
assert.strictEqual(standard.status, 'proposal-ready-for-review');
assert.strictEqual(standard.complete, true);
assert.strictEqual(standard.totals.proportionalTax, 300000);
assert.strictEqual(standard.totals.minimumPerception, 250000);
assert.strictEqual(standard.totals.tax, 300000);
assert.strictEqual(standard.totals.ortbLevy, 4000);
assert.strictEqual(standard.totals.totalWithOrtbLevy, 304000);
assert.ok(standard.warnings.some(x => x.article === 'Articles 47, 51 et 66'));

const adjustments = calculate({
  accountingResultBenin: '1000000', mixedExpenses: '100000', pensionAndLifePaid: '50000', pensionAndLifeAlreadyDeducted: '50000',
  lossYear1: '10000', confirmedTaxableBase: '1060000', profile: 'buildingAndPublicWorks', cashableProducts: '20000000'
});
assert.strictEqual(adjustments.totals.mixedExpenseReintegration, 70000);
assert.strictEqual(adjustments.totals.pensionDeductible, 50000);
assert.strictEqual(adjustments.totals.proposedBase, 1060000);
assert.strictEqual(adjustments.totals.proportionalTax, 318000);
assert.strictEqual(adjustments.totals.minimumPerception, 600000);
assert.strictEqual(adjustments.totals.tax, 600000);

const education = calculate({ profile: 'privateEducation', confirmedTaxableBase: '1000000', cashableProducts: '20000000' });
assert.strictEqual(education.totals.proportionalTax, 250000);
assert.strictEqual(education.totals.minimumPerception, 300000);
assert.strictEqual(education.totals.tax, 300000);
const succession = calculate({ successionArticle62Verified: 'yes', gainDeferredArticle62: '100000', confirmedTaxableBase: '900000' });
assert.strictEqual(succession.totals.deductions, 100000);
assert.strictEqual(succession.totals.proposedBase, 900000);
const property = calculate({ profile: 'realEstateDominant', cashableProducts: '10000000' });
assert.strictEqual(property.totals.minimumPerception, 1000000);
const station = calculate({ profile: 'serviceStation', cashableProducts: '10000000', stationLitres: '500000', stationEligibilityVerified: 'yes' });
assert.strictEqual(station.totals.minimumPerception, 300000);
const special = calculate({ profile: 'usedVehicles', specialMinimum: '500000', specialMinimumVerified: 'yes', art47ProductsVerified: 'no', cashableProducts: '' });
assert.strictEqual(special.totals.minimumPerception, 500000);
assert.strictEqual(special.gaps.some(x => x.field === 'art47ProductsVerified'), false);
const half = calculate({ halfReduction: 'yes', profile: 'standard', cashableProducts: '30000000' });
assert.strictEqual(half.totals.taxBeforeArticle65, 450000);
assert.strictEqual(half.totals.tax, 225000);
assert.strictEqual(half.totals.totalWithOrtbLevy, 229000);

const missing = calculate({ mixedExpenses: '', otherDeductions: '' });
assert.strictEqual(missing.totals.proposedBase, null, 'blank adjustment inputs must not silently be treated as zero');
assert.ok(missing.gaps.some(x => x.field === 'mixedExpenses'));
assert.ok(missing.gaps.some(x => x.field === 'otherDeductions'));
const nonResidentSource = calculate({ territoryVerified: 'no' });
assert.strictEqual(nonResidentSource.totals.tax, null, 'territorial scope must be verified before tax calculation');
assert.ok(nonResidentSource.gaps.some(x => x.field === 'territoryVerified'));
const exempt = Iba.calculate({ data: { exemption: 'agriculture' }, cycleStart: '2025-01-01', cycleEnd: '2025-12-31' });
assert.strictEqual(exempt.status, 'exemption-declared');
assert.strictEqual(exempt.totals.tax, undefined, 'exempt activities are not assigned a tax amount');
assert.ok(exempt.warnings[0].article === 'Article 58');
const agricultureClassifiedAsTaxable = calculate({ activityCategory: 'agriculture', exemption: 'none' });
assert.strictEqual(agricultureClassifiedAsTaxable.totals.tax, null, 'the explicit Article 58 agriculture exemption must not be silently ignored');
assert.ok(agricultureClassifiedAsTaxable.gaps.some(x => x.field === 'agricultureExemption'));
const cashValid = calculate({ accountingMethod: 'cash', activityCategory: 'liberal', cashOptionVerified: 'yes', cashOptionDate: '2024-11-20' });
assert.strictEqual(cashValid.gaps.some(x => x.field === 'cashOptionDate'), false);
const cashInvalid = calculate({ accountingMethod: 'cash', activityCategory: 'business', cashOptionVerified: 'yes', cashOptionDate: '2024-12-01' });
assert.ok(cashInvalid.gaps.some(x => x.field === 'accountingMethod'));
assert.ok(cashInvalid.gaps.some(x => x.field === 'cashOptionDate'));
const partner = calculate({ taxpayerKind: 'partnerNotIs', transparentEntityVerified: 'yes', profitSharePercent: '40', confirmedTaxableBase: '1000000' });
assert.strictEqual(partner.totals.proposedBase, 400000);

const csv = Iba.buildCsv(standard);
assert.ok(csv.startsWith('\ufeff"Section";'));
assert.ok(csv.includes('Article 64.4'));
assert.ok(csv.includes('Proposition, non transmise'));

const nav = require('../modern-proto/js/accounting-navigation.js');
const statements = require('../modern-proto/js/ohada-financial-statements.js');
const html = fs.readFileSync(path.join(root, 'modern-proto/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'modern-proto/service-worker.js'), 'utf8');
assert.ok(statements.ITEMS.some(x => x.key === 'iba-declaration' && /Déclaration IBA/.test(x.label)));
assert.match(html, /css\/iba-declaration\.css/);
assert.match(html, /js\/iba-declaration\.js/);
assert.match(app, /bindIbaDeclaration/);
assert.match(app, /if\(selectedKey==='iba-declaration'\)openIbaDeclarationForm\(\)/);
assert.match(app, /Proposer le résultat depuis la balance OHADA/);
assert.match(worker, /js\/iba-declaration\.js/);
assert.match(worker, /css\/iba-declaration\.css/);
assert.ok(nav.getTab('declarations', 'ohada-statements'));
console.log('Tests IBA declaration : OK');
