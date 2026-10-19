/* Simulation indicative d’amortissement : conventions explicites, résultat en lecture seule. */
'use strict';

const assert = require('node:assert/strict');
const Depreciation = require('../modern-proto/js/fixed-asset-depreciation.js');

const linearAsset = {
  id: 'asset-linear', code: 'IMMO-0001', name: 'Équipement', assetType: 'corporelle', status: 'en-service',
  grossCost: 1200, residualValue: 200, depreciationMethod: 'lineaire', usefulLifeMonths: 10,
  depreciationStartDate: '2026-02-15'
};
const sourceBefore = JSON.stringify(linearAsset);

assert.equal(Depreciation.simulate([linearAsset], '2026-02-01', '2026-04-30', '').ok, false,
  'aucune convention de calcul n’est sélectionnée par défaut');

const monthly = Depreciation.simulate([linearAsset], '2026-02-01', '2026-04-30', 'month-full');
assert.equal(monthly.ok, true);
assert.equal(monthly.conventionLabel, 'Mois civil entier dès le mois de début');
assert.equal(monthly.rows.length, 3);
assert.deepEqual(monthly.rows.map(row => row.period), ['février 2026', 'mars 2026', 'avril 2026']);
assert(monthly.rows.every(row => row.amount === 100), 'la base résiduelle est répartie sur les mois de vie déclarés');
assert.equal(monthly.total, 300);

const daily = Depreciation.simulate([linearAsset], '2026-02-01', '2026-04-30', 'days-exact');
assert.equal(daily.ok, true);
assert.equal(daily.conventionLabel, 'Prorata journalier exact (début inclus, fin exclue)');
assert.equal(daily.rows.length, 3);
assert(Math.abs(daily.rows.reduce((sum, row) => sum + row.amount, 0) - (1000 * 75 / 303)) < 1e-8,
  'le prorata ne retient que les 75 jours de vie compris dans le cycle, sur 303 jours au total');

const fullDailyLife = Depreciation.simulate([{
  ...linearAsset, usefulLifeMonths: 2, depreciationStartDate: '2026-01-15'
}], '2026-01-01', '2026-03-31', 'days-exact');
assert.equal(fullDailyLife.ok, true);
assert(Math.abs(fullDailyLife.total - 1000) < 1e-8, 'la vie complète répartit la base amortissable sans arrondi comptabilisé');

const withUnsupported = Depreciation.simulate([
  linearAsset,
  { ...linearAsset, id: 'asset-undefined', code: 'IMMO-0002', depreciationMethod: 'a-definir' },
  { ...linearAsset, id: 'asset-retired', code: 'IMMO-0003', status: 'retiree' },
  { ...linearAsset, id: 'asset-financial', code: 'IMMO-0004', assetType: 'financiere' },
  { ...linearAsset, id: 'asset-degressive', code: 'IMMO-0005', depreciationMethod: 'degressif' },
  { ...linearAsset, id: 'asset-units', code: 'IMMO-0006', depreciationMethod: 'unites-oeuvre' }
], '2026-02-01', '2026-04-30', 'month-full');
assert.equal(withUnsupported.plans.length, 1);
assert.equal(withUnsupported.excluded.length, 5);
assert(withUnsupported.excluded.some(item => item.reason.includes('reste à définir')));
assert(withUnsupported.excluded.some(item => item.reason.includes('date de sortie')));
assert(withUnsupported.excluded.some(item => item.reason.includes('financières')));
assert(withUnsupported.excluded.some(item => item.reason.includes('dégressive')));
assert(withUnsupported.excluded.some(item => item.reason.includes('quantités réalisées')));

assert.equal(Depreciation.simulate([linearAsset], '2026-04-01', '2026-03-31', 'month-full').ok, false,
  'un cycle inversé est refusé');
assert.equal(Depreciation.simulate([linearAsset], '2026-02-30', '2026-03-31', 'days-exact').ok, false,
  'une date civile inexistante est refusée');
assert.equal(JSON.stringify(linearAsset), sourceBefore, 'la simulation ne modifie pas les fiches sources');

console.log('Immobilisations : simulation linéaire explicite, non comptabilisante et sans mutation — OK');
