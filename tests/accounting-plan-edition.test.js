/* Modèle du rapport Plan comptable : référence PDF et comptes visibles du dossier. */
'use strict';

const assert = require('node:assert/strict');
const Chart = require('../modern-proto/js/accounting-chart.js');
const Edition = require('../modern-proto/js/accounting-plan-edition-report.js');

assert.equal(Edition.REPORT_ID, 'edition-chart-of-accounts');
assert.equal(Edition.TITLE, 'Plan comptable');
assert.deepEqual(Edition.COLUMNS.map(column => [column.key, column.label, column.defaultSelected]), [
  ['code', 'Numéro', true],
  ['label', 'Libellé', true],
  ['class', 'Classe', true],
  ['subclass', 'Sous-classe', true],
  ['usage', 'Nature / utilisation', true],
  ['nature', 'Type comptable', true],
  ['posting', 'Imputation', true],
  ['auxiliary', 'Auxiliaire', true],
  ['origin', 'Origine', true],
  ['sourcePage', 'Page PDF', false]
]);

const chartBefore = JSON.stringify(Chart.accounts());
const all = Edition.buildReport({ accountFilter: '*', records: Chart.accounts() });
assert.equal(all.ok, true);
assert.equal(all.reportId, Edition.REPORT_ID);
assert.equal(all.sourceRowCount, 1400);
assert.equal(all.referenceAccountCount, 1400);
assert.equal(all.userAddedAccountCount, 0);
assert.equal(all.historicalAccountCount, 0);
assert.equal(all.generatedLineCount, 1401, 'le compteur ajoute un en-tête aux lignes de comptes');
assert.equal(all.basis.sourceFile, Chart.METADATA.sourceFile);
assert.equal(all.basis.sourcePdfSha256, Chart.METADATA.sourcePdfSha256);
assert.equal(all.basis.sourcePages, 37);
assert.equal(all.basis.sourceReferenceAccountCount, 1400);
assert.equal(all.basis.noAccountingMutation, true);
assert.deepEqual(all.rows[0], {
  code: '10', label: 'CAPITAL', class: '1 — Ressources durables',
  subclass: '10 — CAPITAL', usage: '', nature: 'Passif', posting: 'Rubrique / indicateur',
  auxiliary: '—', origin: 'Référentiel SYSCOHADA', sourcePage: 6,
  standard: true, legacy: false, custom: false
});
const classNine = all.rows.filter(row => row.code.charAt(0) === '9');
assert.equal(classNine.length, 90);
assert.ok(classNine.every(row => row.posting === 'Référence seule'));
const miningProvision = all.rows.find(row => row.code === '1551');
assert.equal(miningProvision.label, 'Reconstitution des gisements miniers et pétroliers');
assert.equal(miningProvision.sourcePage, 7);
assert.equal(miningProvision.class, '1 — Ressources durables');

const custom = {
  code: '604500', label: 'Compte ajouté au dossier', cls: 6,
  classLabel: 'Charges des activités ordinaires', subclass: '60', subclassLabel: 'Achats',
  usage: 'Usage personnalisé', nature: 'Charge', aux: false, active: true,
  postable: true, legacy: false, standard: false
};
const legacy = {
  code: '601100', label: 'Compte historique', cls: 6,
  classLabel: 'Charges des activités ordinaires', subclass: '60', subclassLabel: 'Achats',
  usage: 'Compte historique conservé.', nature: 'Charge', aux: false, active: true,
  postable: true, legacy: true, standard: false
};
const dossierAccounts = Chart.accounts().concat([custom, legacy]);
const dossierReport = Edition.buildReport({ accountFilter: '*', records: dossierAccounts });
assert.equal(dossierReport.sourceRowCount, 1402);
assert.equal(dossierReport.referenceAccountCount, 1400);
assert.equal(dossierReport.userAddedAccountCount, 1);
assert.equal(dossierReport.historicalAccountCount, 1);
assert.equal(dossierReport.generatedLineCount, 1403);
assert.equal(dossierReport.rows.find(row => row.code === '604500').origin, 'Ajout du dossier');
assert.equal(dossierReport.rows.find(row => row.code === '604500').usage, 'Usage personnalisé');
assert.equal(dossierReport.rows.find(row => row.code === '601100').origin, 'Compte historique');
assert.equal(dossierReport.rows.find(row => row.code === '601100').posting, 'Historique');

const filtered = Edition.buildReport({ accountFilter: '1551, 604500, 601100', records: dossierAccounts });
assert.equal(filtered.ok, true);
assert.deepEqual(filtered.rows.map(row => row.code), ['1551', '601100', '604500']);
assert.equal(filtered.generatedLineCount, 4);
const prefix = Edition.buildReport({ accountFilter: '401*', records: dossierAccounts });
assert.ok(prefix.rows.length > 0);
assert.ok(prefix.rows.every(row => row.code.startsWith('401')));
const empty = Edition.buildReport({ accountFilter: '987654321', records: dossierAccounts });
assert.equal(empty.ok, true);
assert.deepEqual(empty.rows, []);
assert.equal(empty.generatedLineCount, 0);
const invalid = Edition.buildReport({ accountFilter: '', records: dossierAccounts });
assert.equal(invalid.ok, false);
assert.deepEqual(invalid.rows, []);
assert.match(invalid.errors.join(' '), /Indiquez un compte ou \*/i);

assert.equal(JSON.stringify(Chart.accounts()), chartBefore, 'les filtres et l’édition ne modifient pas le plan de référence');
assert.equal(custom.label, 'Compte ajouté au dossier', 'la génération du rapport ne modifie pas les comptes du dossier');
assert.equal(legacy.legacy, true);

console.log('Plan comptable : 1 400 lignes source, classe 9 de référence, personnalisations, comptes historiques, filtres et absence de mutation vérifiés.');
