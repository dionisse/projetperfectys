/* Transcription des Postes du Bilan et édition en lecture seule. */
'use strict';

const assert = require('node:assert/strict');
const Data = require('../modern-proto/js/accounting-balance-items.js');
const Edition = require('../modern-proto/js/balance-items-edition-report.js');

assert.equal(Data.metadata.title, 'Postes du Bilan SYSCOHADA révisé');
assert.equal(Data.metadata.sourceFile, 'les postes du bilan.pdf');
assert.equal(Data.metadata.sourcePdfSha256, 'e86bc39b37f6fe4cfdf3ea057117226873b8d3bcc15126478a59128665f5a283');
assert.equal(Data.metadata.sourcePages, 4);
assert.equal(Data.metadata.postCount, 92);
assert.equal(Data.metadata.sourceLineCount, 166);
assert.equal(Data.all().length, 92);
assert.equal(Data.all().reduce((count, post) => count + Edition.sourceLineCount(post), 0), 166);
assert.ok(Object.isFrozen(Data.all()));
assert.ok(Object.isFrozen(Data.getByCode('AE')));

assert.deepEqual(Edition.COLUMNS.map(column => [column.key, column.label, column.defaultSelected]), [
  ['code', 'Code', true], ['accounts', 'Comptes', true], ['label', 'Intitulé', true]
]);
assert.equal(Edition.REPORT_ID, 'edition-balance-items');
assert.equal(Edition.TITLE, 'Postes du Bilan');

const before = JSON.stringify(Data.all());
const all = Edition.buildReport({ postFilter: '*' });
assert.equal(all.ok, true);
assert.equal(all.sourcePostCount, 92);
assert.equal(all.sourceRowCount, 166);
assert.equal(all.sourceLineCount, 166);
assert.equal(all.rows.length, 166, 'les lignes de comptes du PDF restent des lignes distinctes');
assert.equal(all.generatedLineCount, 167, 'le compteur ajoute uniquement l’en-tête des colonnes');
assert.equal(all.basis.sourcePages, 4);
assert.equal(all.basis.sourcePdfSha256, Data.metadata.sourcePdfSha256);
assert.equal(all.basis.noAccountingMutation, true);
assert.deepEqual(all.rows[0], { code: 'AD', accounts: '', label: 'IMMOBILISATIONS INCORPORELLES', postCode: 'AD', page: 1 });
assert.deepEqual(all.rows.slice(1, 5).map(row => [row.code, row.accounts, row.label, row.postCode]), [
  ['AE', '211 2181 2191', 'Frais de R & D', 'AE'],
  ['', '<Dépréciation>', '', 'AE'],
  ['', '2811 28181', '', 'AE'],
  ['', '2911 29181 29191', '', 'AE']
]);

const debtors = Edition.buildReport({ postFilter: 'BA' });
assert.equal(debtors.sourcePostCount, 1);
assert.equal(debtors.rows.length, 5);
assert.equal(debtors.generatedLineCount, 6);
assert.deepEqual(debtors.rows.map(row => row.accounts), ['<Débiteurs>', '4851 4852 4853 4854 4855 4856 4857', '488', '<Dépréciation>', '498']);
assert.ok(debtors.rows.slice(1).every(row => row.code === '' && row.label === '' && row.postCode === 'BA'));

const singleLetterPost = Edition.buildReport({ postFilter: 'R' });
assert.deepEqual(singleLetterPost.rows.map(row => row.postCode), ['R']);
assert.equal(singleLetterPost.rows[0].label, 'RESULTAT - CHARGES');
assert.equal(singleLetterPost.generatedLineCount, 2);
const prefix = Edition.buildReport({ postFilter: 'R*' });
assert.ok(prefix.sourcePostCount > 1);
assert.ok(prefix.rows.every(row => row.postCode.startsWith('R')));
const multiple = Edition.buildReport({ postFilter: 'BA, DH' });
assert.deepEqual([...new Set(multiple.rows.map(row => row.postCode))], ['BA', 'DH']);
assert.equal(multiple.generatedLineCount, 9);
assert.equal(Edition.formatAccounts(Data.getByCode('AH')), '217 2198 218 -2181\n<Dépréciation>\n2817 2818 -28181\n2917 29198 2918 -29181');
assert.equal(Data.getByCode('BS').label, 'Banques,Chèques postausx Caisse', 'les libellés du PDF ne sont pas corrigés ni complétés');
assert.equal(Data.getByCode('TO').label, 'Autrs produits HAO');

const invalid = Edition.buildReport({ postFilter: '' });
assert.equal(invalid.ok, false);
assert.deepEqual(invalid.rows, []);
assert.match(invalid.errors.join(' '), /Indiquez un poste ou \*/i);
const noResult = Edition.buildReport({ postFilter: 'ZZZ' });
assert.equal(noResult.ok, true);
assert.deepEqual(noResult.rows, []);
assert.equal(noResult.generatedLineCount, 0);
assert.equal(JSON.stringify(Data.all()), before, 'le rapport et les filtres ne modifient pas le PDF transcrit');

console.log('Postes du Bilan : 92 postes, 166 lignes source, compteur 167 avec en-tête, filtres et fidélité au PDF vérifiés.');
