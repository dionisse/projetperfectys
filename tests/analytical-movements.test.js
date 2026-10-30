/* Vérifie les mouvements analytiques en lecture seule, séparés par nature et reliquat. */
'use strict';

const assert = require('node:assert/strict');
const Report = require('../modern-proto/js/journal-lines-report.js');

const analyticalCenters = [
  { id: 'center-1', code: 'ANA-01', name: 'Atelier nord', active: true },
  { id: 'center-2', code: 'ANA-02', name: 'Atelier sud', active: true }
];
const analyticalNatures = [
  { id: 'responsibility-centers', genericName: 'Centres de responsabilité', individualName: 'Centres de responsabilité' },
  { id: 'activity-domains', genericName: 'Domaines d’activité', individualName: 'Activité' }
];
const accounts = [{ code: '601100', label: 'Achats de production' }];
const entries = [
  {
    id: 'entry-1', reference: 'OD-2026-01', journal: 'OD', date: '2026-02-10', status: 'posted',
    lines: [{
      account: '601100', debit: 100, credit: 0,
      analyticSplits: [
        { natureId: 'responsibility-centers', mode: 'amount', unallocatedAmount: 10, allocations: [
          { centerId: 'center-1', centerCode: 'ANA-01', centerName: 'Atelier nord', value: '40', amount: 40 },
          { centerId: 'center-2', centerCode: 'ANA-02', centerName: 'Atelier sud', value: '50', amount: 50 }
        ] },
        { natureId: 'activity-domains', mode: 'percentage', unallocatedAmount: 0, allocations: [
          { valueLabel: 'Production', value: '100', amount: 100 }
        ] }
      ]
    }]
  },
  {
    id: 'entry-draft', reference: 'OD-DRAFT', journal: 'OD', date: '2026-02-11', status: 'draft',
    lines: [{ account: '601100', debit: 50, credit: 0, analyticSplits: [{ natureId: 'responsibility-centers', mode: 'amount', allocations: [{ centerId: 'center-1', value: '50', amount: 50 }] }] }]
  },
  {
    id: 'entry-outside', reference: 'OD-OUT', journal: 'AC', date: '2026-03-01', status: 'posted',
    lines: [{ account: '601100', debit: 30, credit: 0, analyticSplits: [{ natureId: 'responsibility-centers', mode: 'amount', allocations: [{ centerId: 'center-1', value: '30', amount: 30 }] }] }]
  }
];
const snapshot = JSON.stringify(entries);
const report = Report.buildAnalyticalMovements({
  entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  filters: { analyticalNature: 'responsibility-centers', from: '2026-02-01', to: '2026-02-28', journal: 'OD' }
});
assert.deepEqual(report.errors, []);
assert.deepEqual(report.columns.map(column => column.label), [
  'Date', 'Journal', 'N° pièce', 'Compte', 'Intitulé du compte', 'Centre / valeur analytique',
  'Mode', 'Valeur saisie', 'Débit analytique', 'Crédit analytique', 'État'
]);
assert.equal(report.rowCount, 3, 'deux centres explicites et un reliquat sont affichés.');
assert.equal(report.sourceLineCount, 1);
assert.equal(report.allocationCount, 2);
assert.equal(report.totalDebit, 90, 'seuls les montants affectés aux centres entrent dans le total ventilé.');
assert.equal(report.unallocatedDebit, 10);
assert.equal(report.unallocatedCredit, 0);
assert.deepEqual(report.groups[0].rows.map(row => [row.cells.destination, row.cells.debit, row.cells.status]), [
  ['À ventiler (sans centre)', 10, 'À ventiler'],
  ['ANA-01 · Atelier nord', 40, 'Ventilé'],
  ['ANA-02 · Atelier sud', 50, 'Ventilé']
]);

const oneCenter = Report.buildAnalyticalMovements({
  entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  filters: { analyticalNature: 'responsibility-centers', centerId: 'center-1', from: '2026-02-01', to: '2026-02-28' }
});
assert.equal(oneCenter.groups[0].rows.filter(row => row.cells.status === 'Ventilé').length, 1);
assert.equal(oneCenter.groups[0].rows.find(row => row.cells.status === 'Ventilé').cells.destination, 'ANA-01 · Atelier nord');
assert.equal(oneCenter.unallocatedDebit, 10, 'le reliquat reste visible séparément et ne devient pas un centre.');

const otherNature = Report.buildAnalyticalMovements({
  entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  filters: { analyticalNature: 'activity-domains', from: '2026-02-01', to: '2026-02-28' }
});
assert.equal(otherNature.groups[0].rows.length, 1, 'les natures analytiques parallèles ne sont pas additionnées dans la même vue.');
assert.equal(otherNature.groups[0].rows[0].cells.destination, 'Production');
assert.equal(otherNature.totalDebit, 100);

const incompleteOtherNatureEntries = structuredClone(entries);
incompleteOtherNatureEntries[0].lines[0].analyticSplits[1].allocations.push({ value: '25', amount: 25 });
const incompleteOtherNature = Report.buildAnalyticalStatement({
  reportType: 'analytic-other-nature-balance', entries: incompleteOtherNatureEntries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'activity-domains', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(incompleteOtherNature.totalDebit, 100, 'la valeur absente n’est pas classée ni incluse dans les totaux.');
assert.equal(incompleteOtherNature.unclassifiedAllocationCount, 1);

const centerBalance = Report.buildAnalyticalStatement({
  reportType: 'analytic-center-balance', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'responsibility-centers', journal: 'OD', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(centerBalance.groups[0].title, 'Balance des centres · mouvements analytiques explicites');
assert.equal(centerBalance.rowCount, 2);
assert.equal(centerBalance.totalDebit, 90);
assert.equal(centerBalance.unallocatedDebit, 10);
assert.equal(centerBalance.groups[1].code, 'analytical-unallocated');

const detailedOtherNature = Report.buildAnalyticalStatement({
  reportType: 'analytic-other-nature-balance', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'activity-domains', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(detailedOtherNature.groups[0].rows.length, 1);
assert.equal(detailedOtherNature.groups[0].rows[0].cells.destination, 'Production');
assert.equal(detailedOtherNature.groups[0].rows[0].cells.account, '601100');
assert.equal(detailedOtherNature.groups[0].rows[0].cells.net, 100);

const centerLedger = Report.buildAnalyticalStatement({
  reportType: 'analytic-ledger', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'responsibility-centers', journal: 'OD', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(centerLedger.groups[0].rows.length, 2);
assert.equal(centerLedger.groups[1].code, 'analytical-unallocated');
const otherNatureLedger = Report.buildAnalyticalStatement({
  reportType: 'analytic-other-nature-ledger', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'activity-domains', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(otherNatureLedger.groups[0].rows.length, 1);

const centerSituation = Report.buildAnalyticalStatement({
  reportType: 'analytic-center-situation', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'responsibility-centers', from: '2026-01-01', to: '2026-02-10' }
});
assert.match(centerSituation.groups[0].title, /mouvements cumulés du cycle à date/);
const otherNatureSituation = Report.buildAnalyticalStatement({
  reportType: 'analytic-other-nature-situation', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'activity-domains', from: '2026-01-01', to: '2026-02-10' }
});
assert.equal(otherNatureSituation.groups[0].rows[0].cells.destination, 'Production');
const accountAnalyticBalance = Report.buildAnalyticalStatement({
  reportType: 'analytic-general-account-balance', entries, analyticalCenters, analyticalNatures, accounts, decimalPlaces: 0,
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'activity-domains', from: '2026-01-01', to: '2026-12-31' }
});
assert.equal(accountAnalyticBalance.groups[0].rows[0].cells.account, '601100');
assert.equal(accountAnalyticBalance.totalDebit, 100);

const invalidPeriod = Report.buildAnalyticalMovements({
  entries, analyticalCenters, analyticalNatures, accounts,
  filters: { analyticalNature: 'responsibility-centers', from: '2026-03-01', to: '2026-02-01' }
});
assert.match(invalidPeriod.errors.join(' '), /période est inversée/);
const outsideCycle = Report.buildAnalyticalMovements({
  entries, analyticalCenters, analyticalNatures, accounts, cycleStart: '2026-01-01', cycleEnd: '2026-12-31',
  filters: { analyticalNature: 'responsibility-centers', from: '2025-12-31', to: '2026-02-01' }
});
assert.match(outsideCycle.errors.join(' '), /doit rester comprise dans le cycle du dossier/);
const noNature = Report.buildAnalyticalMovements({ entries, analyticalCenters, analyticalNatures, accounts, filters: {} });
assert.match(noNature.errors.join(' '), /Choisissez une nature analytique valide/);
assert.equal(JSON.stringify(entries), snapshot, 'la consultation ne modifie aucune pièce.');

console.log('Mouvements analytiques : nature isolée, multi-centres, À ventiler, filtres, lecture seule et résumés en français — OK');
