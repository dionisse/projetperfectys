/* Transcription du PDF source et édition des postes associés aux comptes. */
'use strict';

const assert = require('node:assert/strict');
const Data = require('../modern-proto/js/accounting-associated-items.js');
const Edition = require('../modern-proto/js/account-associated-items-edition-report.js');

assert.equal(Data.metadata.title, 'Postes associés aux comptes');
assert.equal(Data.metadata.sourceFile, 'poste associés aux comptes.pdf');
assert.equal(Data.metadata.sourcePdfSha256, '830bfe4df85a74944cd435a707259d3d45ec9ea6d044e176bbeb421708064e70');
assert.equal(Data.metadata.sourcePages, 4);
assert.equal(Data.metadata.sourceRowCount, 193);
assert.equal(Data.metadata.rowsWithAtLeastOnePost, 161);
assert.equal(Data.metadata.rowsWithBothPostsBlank, 32);
assert.equal(Data.all().length, 193);
assert.equal(new Set(Data.all().map(row => row.code)).size, 193);
assert.ok(Object.isFrozen(Data.all()));
assert.ok(Object.isFrozen(Data.getByCode('101000')));
assert.equal(Edition.REPORT_ID, 'edition-account-associated-items');
assert.deepEqual(Edition.COLUMNS.map(column => [column.key, column.label, column.defaultSelected]), [
  ['account', 'Compte', true], ['label', 'Intitulé', true], ['posts', 'Postes', true]
]);

const before = JSON.stringify(Data.all());
const all = Edition.buildReport({ accountFilter: '*' });
assert.equal(all.ok, true);
assert.equal(all.rows.length, 193);
assert.equal(all.generatedLineCount, 194);
assert.equal(all.basis.sourceRowCount, 193);
assert.equal(all.basis.sourcePages, 4);
assert.equal(all.basis.sourcePdfSha256, Data.metadata.sourcePdfSha256);
assert.equal(all.basis.noDataMutation, true);
assert.deepEqual(all.rows[0], { account: '101000', label: 'Capital Social', debit: 'CA', credit: 'CA', sourcePage: 1 });
assert.deepEqual(all.rows.find(row => row.account === '40'), { account: '40', label: 'Fournisseurs et Comptes Rattachés', debit: 'BH', credit: 'DJ', sourcePage: 2 });
assert.deepEqual(all.rows.find(row => row.account === '41'), { account: '41', label: 'Clients et Comptes Rattachés', debit: 'BI', credit: 'DI', sourcePage: 2 });
assert.deepEqual(all.rows.find(row => row.account === '132'), { account: '132', label: 'Marge Commerciale', debit: '', credit: '', sourcePage: 1 });
assert.deepEqual(all.rows.find(row => row.account === '797'), { account: '797', label: 'Reprises/Provisions et Depreciations financi', debit: 'TL', credit: 'TL', sourcePage: 4 });
assert.deepEqual(all.rows.find(row => row.account === '81'), { account: '81', label: "Valeurs Comptables/Cessions d'Immobilisat", debit: 'RO', credit: 'RO', sourcePage: 4 });

assert.equal(Edition.buildReport({ accountFilter: '4*' }).rows.length, 25);
assert.deepEqual(Edition.buildReport({ accountFilter: '40, 41' }).rows.map(row => row.account), ['40', '41']);
assert.deepEqual(Edition.buildReport({ accountFilter: '101000' }).rows.map(row => row.account), ['101000']);
assert.equal(Edition.buildReport({ accountFilter: '70*' }).rows.length, 7);
assert.equal(Edition.buildReport({ accountFilter: '999999' }).generatedLineCount, 0);
assert.equal(Edition.buildReport({ accountFilter: '' }).ok, false);
assert.equal(Edition.buildReport({ accountFilter: 'abc' }).ok, false);
assert.equal(Edition.buildReport({ accountFilter: '*', columns: { account: false, label: false, posts: false } }).ok, false);
assert.deepEqual(Edition.buildReport({ accountFilter: '132' }).rows[0].debit, '');
assert.deepEqual(Edition.buildReport({ accountFilter: '132' }).rows[0].credit, '');
assert.equal(JSON.stringify(Data.all()), before, 'l’édition ne complète et ne modifie pas les données transcrites');

console.log('Postes associés aux comptes : PDF joint transcrit (193 lignes), filtre, colonnes et cellules vides vérifiés.');
