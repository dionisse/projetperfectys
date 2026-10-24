/* États du cadre comptable : filtre de compte et fidélité aux postes du PDF source. */
'use strict';

const assert = require('node:assert/strict');
const Framework = require('../modern-proto/js/accounting-framework.js');
const Edition = require('../modern-proto/js/accounting-framework-edition-report.js');

assert.equal(Edition.REPORT_ID, 'edition-accounting-framework');
assert.equal(Edition.TITLE, 'Cadre comptable');
assert.deepEqual(Edition.COLUMNS.map(column => [column.key, column.label, column.defaultSelected]), [
  ['code', 'Code', true], ['label', 'Intitulé', true], ['posts', 'Postes au bilan', true]
]);

const all = Edition.buildReport({ accountFilter: '*' });
assert.equal(all.ok, true);
assert.equal(all.rows.length, 532, 'seules les 532 lignes présentes dans le PDF sont restituées');
assert.equal(all.sourceRowCount, 532);
assert.equal(all.generatedLineCount, 533, 'le compteur de la fenêtre inclut l’en-tête des colonnes');
assert.equal(all.basis.sourceFile, Framework.metadata.sourceFile);
assert.equal(all.basis.sourcePdfSha256, Framework.metadata.sourcePdfSha256);
assert.equal(all.basis.sourcePages, 11);
assert.equal(all.basis.mappedRowCount, 409);
assert.equal(all.basis.unmappedRowCount, 123);
assert.equal(all.basis.noAccountingMutation, true);
assert.deepEqual(all.rows[0], { code: '1', label: 'Ressources Durables', debit: null, credit: null, sourcePage: 1 });

const balanceSideDifference = Edition.buildReport({ accountFilter: '184' });
assert.equal(balanceSideDifference.rows.length, 1);
assert.equal(balanceSideDifference.rows[0].debit.code, 'BJ');
assert.equal(balanceSideDifference.rows[0].credit.code, 'DM');
assert.equal(Edition.formatBalancePosts(balanceSideDifference.rows[0]), 'Débit : <BJ> Autres créances ; Crédit : <DM> Autres dettes');

const singleSided = Edition.buildReport({ accountFilter: '488' });
assert.equal(Edition.formatBalancePosts(singleSided.rows[0]), 'Débit : <BA> Actif circulant HAO');
assert.equal(singleSided.rows[0].credit, null, 'la cellule Crédit vide reste vide');
assert.equal(Edition.formatBalancePosts(Edition.buildReport({ accountFilter: '1' }).rows[0]), '');

const prefix = Edition.buildReport({ accountFilter: '2*' });
assert.ok(prefix.rows.length > 0);
assert.ok(prefix.rows.every(row => row.code.startsWith('2')));
assert.equal(prefix.generatedLineCount, prefix.rows.length + 1);
const explicitCodes = Edition.buildReport({ accountFilter: '101, 401' });
assert.deepEqual(explicitCodes.rows.map(row => row.code), ['101', '401']);

const invalid = Edition.buildReport({ accountFilter: '' });
assert.equal(invalid.ok, false);
assert.deepEqual(invalid.rows, []);
assert.match(invalid.errors.join(' '), /Indiquez un compte ou \*/i);
const noRows = Edition.buildReport({ accountFilter: '000' });
assert.equal(noRows.ok, true);
assert.deepEqual(noRows.rows, []);
assert.equal(noRows.generatedLineCount, 0);

console.log('Cadre comptable : filtres, 532 lignes source, 533 lignes avec en-tête, postes Débit/Crédit et consultation seule vérifiés.');
