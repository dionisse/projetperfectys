/* Vérifie la transcription exhaustive et non interprétée du cadre SYSCOHADA fourni. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Framework = require('../modern-proto/js/accounting-framework.js');

const rows = Framework.all();
const expectedPageCounts = [51, 52, 51, 51, 52, 51, 51, 51, 51, 51, 20];
const expectedDataSha256 = '8d03d790ab78ed1075cd6eccc8868e6775134ef0849f469f991589e52e0d4b97';

assert.equal(Framework.metadata.standard, 'SYSCOHADA révisé');
assert.equal(Framework.metadata.sourceFile, 'cadre comptable syscohada révisé.pdf');
assert.equal(Framework.metadata.sourcePdfSha256, '85c7ea8735d2939b901460dd3eb4929a3892a0c0bf8695d3449cfa5e7e53b604');
assert.equal(Framework.metadata.sourcePages, 11);
assert.deepEqual(Framework.metadata.pageRowCounts, expectedPageCounts);
assert.equal(Framework.metadata.rowCount, 532);
assert.equal(Framework.metadata.mappedRowCount, 409);
assert.equal(Framework.metadata.unmappedRowCount, 123);
assert.equal(rows.length, 532);
assert.equal(new Set(rows.map(row => row.code)).size, rows.length, 'aucun compte ou intitulé de rubrique n’est supprimé par un doublon');

const dataSha256 = crypto.createHash('sha256').update(JSON.stringify(rows), 'utf8').digest('hex');
assert.equal(Framework.metadata.dataSha256, expectedDataSha256);
assert.equal(dataSha256, expectedDataSha256, 'l’ensemble ordonné des lignes reste identique à la transcription vérifiée du PDF');
assert.equal(expectedPageCounts.reduce((total, count) => total + count, 0), rows.length);

let previousPage = 0;
for (const row of rows) {
  assert.match(row.code, /^\d{1,4}$/, `code de compte valide : ${row.code}`);
  assert.ok(row.label, `intitulé présent pour ${row.code}`);
  assert.ok(Number.isInteger(row.page) && row.page >= 1 && row.page <= 11, `page source présente pour ${row.code}`);
  assert.ok(row.page >= previousPage, 'l’ordre des lignes du PDF est conservé');
  previousPage = row.page;
  for (const side of ['debit', 'credit']) {
    if (!row[side]) continue;
    assert.match(row[side].code, /^[A-Z]{2}$/, `code de poste ${side} présent pour ${row.code}`);
    assert.ok(row[side].label, `libellé du poste ${side} présent pour ${row.code}`);
    assert.ok(Object.isFrozen(row[side]), `le poste ${side} reste en lecture seule pour ${row.code}`);
  }
  assert.ok(Object.isFrozen(row), `la ligne ${row.code} reste en lecture seule`);
}

const mappedRows = rows.filter(row => row.debit || row.credit);
const unmappedRows = rows.filter(row => !row.debit && !row.credit);
const oneSidedRows = rows.filter(row => Boolean(row.debit) !== Boolean(row.credit));
assert.equal(mappedRows.length, 409);
assert.equal(unmappedRows.length, 123);
assert.deepEqual(oneSidedRows.map(row => [row.code, row.debit, row.credit]), [
  ['488', { code: 'BA', label: 'Actif circulant HAO' }, null]
], 'la cellule Crédit vide du compte 488 reste vide ; aucun poste miroir n’est inventé');
assert.deepEqual(Framework.getByCode('101'), {
  code: '101', label: 'Capital Social',
  debit: { code: 'CA', label: 'Capital' }, credit: { code: 'CA', label: 'Capital' }, page: 1
});
assert.deepEqual(Framework.getByCode('401'), {
  code: '401', label: 'Fournisseurs, Dettes en Compte',
  debit: { code: 'BH', label: 'Fournisseurs, avances versées' },
  credit: { code: 'DJ', label: "Fournisseurs d'exploitation" }, page: 4
});
assert.deepEqual(Framework.getByCode('901'), {
  code: '901', label: 'Engagements de Financement Obtenus', debit: null, credit: null, page: 11
});
assert.equal(Framework.getByCode('000'), null);
assert.equal(Framework.all(), rows);
assert.ok(Object.isFrozen(rows));
assert.ok(Object.isFrozen(Framework.metadata));
assert.ok(Object.isFrozen(Framework.metadata.pageRowCounts));

assert.deepEqual(Framework.search(''), rows);
assert.deepEqual(Framework.search('réserves'), Framework.search('reserves'), 'la recherche ignore les accents');
assert.ok(Framework.search('reserves').some(row => row.code === '111'));
assert.ok(Framework.search("Fournisseurs d'exploitation").some(row => row.code === '401'), 'la recherche couvre les postes crédit');
assert.deepEqual(Framework.search('488').map(row => row.code), ['488']);
assert.ok(Framework.metadata.note.includes('cellules sans rattachement restent vides'));
assert.ok(Framework.metadata.note.includes('libellés tronqués'));

const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const viewStart = appSource.indexOf('function viewFinancialFramework() {');
const viewEnd = appSource.indexOf('function viewGeneralAccountNatures()', viewStart);
assert.ok(viewStart >= 0 && viewEnd > viewStart, 'la vue du référentiel est déclarée');
const sandbox = {
  AccountingFramework: Framework,
  ui: { financialFramework: { q: 'initial search' } },
  esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
};
vm.createContext(sandbox);
vm.runInContext(appSource.slice(viewStart, viewEnd) + '\nthis.renderFinancialFramework = viewFinancialFramework;', sandbox);
const html = sandbox.renderFinancialFramework();
assert.equal((html.match(/<tr data-financial-framework-row /g) || []).length, 532, 'les 532 lignes sont rendues dans le tableau');
assert.equal((html.match(/Cellule vide dans le PDF/g) || []).length, 494, 'les vides des 123 rubriques et du Crédit 488 restent réellement vides');
assert.ok(html.includes('<th scope="colgroup" colspan="2">Débit</th>'));
assert.ok(html.includes('<th scope="colgroup" colspan="2">Crédit</th>'));
assert.ok(html.includes('value="initial search"'), 'la recherche reste préremplie lors du retour au sous-menu');
const account488Html = html.slice(html.indexOf('data-account-code="488"'), html.indexOf('</tr>', html.indexOf('data-account-code="488"')));
assert.match(account488Html, /&lt;BA&gt;[\s\S]*Cellule vide dans le PDF[\s\S]*Cellule vide dans le PDF/);

console.log('Cadre SYSCOHADA : 532 lignes, 11 pages, Débit/Crédit et cellules vides contrôlés — OK');
