/* Saisie d’écriture : recherche libre de comptes et contreparties basées sur des pièces réelles. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');

function extractFunction(name, nextName) {
  const start = appSource.indexOf('function ' + name + '(');
  const end = appSource.indexOf('function ' + nextName + '(', start + 1);
  assert.notEqual(start, -1, name + ' doit exister');
  assert.notEqual(end, -1, 'borne suivante de ' + name + ' introuvable');
  return appSource.slice(start, end);
}

const accounts = [
  { code: '601000', label: 'Achats', cls: 6, active: true, postable: true },
  { code: '401000', label: 'Fournisseurs', cls: 4, active: true, postable: true },
  { code: '512000', label: 'Banque', cls: 5, active: true, postable: true },
  { code: '570000', label: 'Caisse inactive', cls: 5, active: false, postable: true },
  { code: '601100', label: 'Achats', cls: 6, active: true, postable: true }
];
const entries = [
  { status: 'posted', journal: 'AC', lines: [{ account: '601000' }, { account: '401000' }, { account: '401000' }] },
  { status: 'posted', journal: 'OD', lines: [{ account: '601000' }, { account: '512000' }] },
  { status: 'draft', journal: 'AC', lines: [{ account: '601000' }, { account: '570000' }] }
];
const accountByCode = Object.fromEntries(accounts.map(account => [account.code, account]));
const sandbox = {
  postingAccounts: () => accounts.filter(account => account.active !== false && account.postable !== false),
  S: {
    entries: () => entries,
    account: code => accountByCode[String(code)] || null,
    journalAllowsAccount: (journalCode, accountCode) => !(journalCode === 'AC' && accountCode === '512000')
  }
};
sandbox.globalThis = sandbox;

vm.runInNewContext(
  extractFunction('allowedEntryAccounts', 'resolveEntryAccount') +
  extractFunction('resolveEntryAccount', 'entryAccountDatalist') +
  extractFunction('entryCounterpartSuggestions', 'refreshEntryCounterpartSuggestions') +
  'globalThis.resolveEntryAccount = resolveEntryAccount; globalThis.entryCounterpartSuggestions = entryCounterpartSuggestions;',
  sandbox
);

assert.equal(sandbox.resolveEntryAccount('601000', 'AC').code, '601000', 'un code exact est saisi sans menu déroulant');
assert.equal(sandbox.resolveEntryAccount('601000 — Achats', 'AC').code, '601000', 'une suggestion code et intitulé est reconnue puis normalisée au code');
assert.equal(sandbox.resolveEntryAccount('Fournisseurs', 'AC').code, '401000', 'un intitulé unique peut aussi être renseigné');
assert.equal(sandbox.resolveEntryAccount('Achats', 'AC'), null, 'un intitulé partagé reste ambigu et n’est pas choisi au hasard');
assert.equal(sandbox.resolveEntryAccount('512000', 'AC'), null, 'un compte interdit par le journal n’est pas reconnu comme choix valide');
assert.equal(sandbox.resolveEntryAccount('compte inconnu', 'AC'), null, 'un compte absent du plan n’est pas inventé');

const suggestions = sandbox.entryCounterpartSuggestions('AC', ['601000']);
assert.equal(
  JSON.stringify(suggestions.map(item => [item.account.code, item.entries, item.sameJournal])),
  JSON.stringify([['401000', 1, 1]]),
  'la suggestion utilise seulement les pièces validées observées, déduplique une même contrepartie dans une pièce, privilégie le journal courant et exclut les comptes non autorisés'
);

const lineRenderer = appSource.slice(appSource.indexOf('function lineRowHtml('), appSource.indexOf('function viewEntryForm(', appSource.indexOf('function lineRowHtml(')));
assert.match(lineRenderer, /type="text" data-field="account" list="entry-account-suggestions"/);
assert.match(appSource, /<datalist id="entry-account-suggestions">[\s\S]*entryAccountDatalist\(model\.journal\)/);
assert.match(appSource, /data-action="add-suggested-counterpart"/);
assert.match(appSource, /Ajouter le compte uniquement/);
assert.match(appSource, /debit: '', credit: ''/);
assert.match(appSource, /id="entry-difference"/);
assert.match(appSource, /Saisissez un code ou un intitulé exact proposé pour ce journal/);

console.log('Saisie dynamique : saisie directe, résolution non ambiguë, recherche filtrée et suggestions de contrepartie sourcées vérifiées.');
