/* Les recherches par numéro de compte doivent toujours être des recherches de préfixe. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const AccountSearch = require('../modern-proto/js/account-search.js');
const AccountMovements = require('../modern-proto/js/account-movements.js');
const AccountingFramework = require('../modern-proto/js/accounting-framework.js');
const BalanceItems = require('../modern-proto/js/accounting-balance-items.js');

assert.equal(AccountSearch.codeQuery('23'), '23');
assert.equal(AccountSearch.codeQuery('23*'), '23');
assert.equal(AccountSearch.matches('230100', 'Immobilisations', '23'), true);
assert.equal(AccountSearch.matches('123230', 'Compte contenant 23', '23'), false);
assert.equal(AccountSearch.matches('601230', 'Libellé contenant 23', '23'), false);
assert.equal(AccountSearch.matches('401', 'Fournisseurs 23', '23'), false);
assert.equal(AccountSearch.matches('401', 'Fournisseurs', 'four'), true, 'la recherche par libellé reste disponible');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
function extract(name, next) {
  const start = appSource.indexOf('function ' + name + '(');
  const end = appSource.indexOf('function ' + next + '(', start + 1);
  assert.notEqual(start, -1, name + ' doit exister dans app.js');
  assert.notEqual(end, -1, 'borne suivante de ' + name + ' introuvable');
  return appSource.slice(start, end);
}
const sandbox = { AccountSearch };
vm.runInNewContext(extract('filterAccountPickerRows', 'money') + 'globalThis.filterRows = filterAccountPickerRows;', sandbox);
function pickerRow(code, text) {
  return {
    hidden: false,
    querySelector: () => ({ value: code }),
    getAttribute: name => name === 'data-picker-text' ? text : null
  };
}
const startsWith23 = pickerRow('230100', '230100 Immobilisations');
const contains23 = pickerRow('123230', '123230 Compte contenant 23');
const labelContains23 = pickerRow('401', '401 Fournisseur 23');
sandbox.filterRows([startsWith23, contains23, labelContains23], '23');
assert.equal(startsWith23.hidden, false);
assert.equal(contains23.hidden, true);
assert.equal(labelContains23.hidden, true);

const accountTree = AccountMovements.buildTree([
  { code: '123230', cls: 1, label: 'Code contenant 23' },
  { code: '230100', cls: 2, subclass: '23', label: 'Immobilisations' },
  { code: '230200', cls: 2, subclass: '23', label: 'Matériel' }
], []);
const movementRows = AccountMovements.flattenTree(AccountMovements.filterTree(accountTree, '23', 'general'));
assert.deepEqual(movementRows.filter(row => row.kind === 'account').map(row => row.code), ['230100', '230200']);

const balanceItemMatches = BalanceItems.search('23');
assert.ok(balanceItemMatches.length > 0);
assert.ok(balanceItemMatches.every(post => [post.code].concat(post.accounts || []).join(' ').split(/[\s,;]+/).some(code => code.startsWith('23'))), 'la recherche des postes du bilan tient compte des comptes associés avec une correspondance de préfixe');

const frameworkMatches = AccountingFramework.search('23');
assert.ok(frameworkMatches.length > 0);
assert.ok(frameworkMatches.every(row => [row.code, row.debit && row.debit.code, row.credit && row.credit.code]
  .some(code => String(code || '').startsWith('23'))), 'le référentiel ne retourne que les codes commençant par 23');

assert.match(appSource, /record\.codeLower\.indexOf\(codePrefix\) === 0/);
assert.match(appSource, /record\.searchText\.indexOf\(normalizedNeedle\) !== -1/);
assert.match(appSource, /refreshEntryAccountDatalist\(input\)/);
assert.match(appSource, /function viewAccounts[\s\S]*AccountSearch\.matches\(a\.code/);
assert.match(appSource, /function viewBalance[\s\S]*AccountSearch\.matches\(r\.code/);

console.log('Recherche des comptes validée : une requête numérique ne trouve que les codes commençant par le préfixe saisi.');
