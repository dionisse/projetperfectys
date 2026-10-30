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
  { code: '601100', label: 'Achats', cls: 6, active: true, postable: true },
  { code: '230100', label: 'Immobilisations', cls: 2, active: true, postable: true },
  { code: '601230', label: 'Compte dont le code contient 23', cls: 6, active: true, postable: true },
  { code: '123230', label: 'Compte dont le code contient 23', cls: 1, active: true, postable: true }
];
const entries = [
  { status: 'posted', journal: 'AC', description: 'Facture fournisseur', lines: [{ account: '601000' }, { account: '401000' }, { account: '401000' }] },
  { status: 'posted', journal: 'OD', description: 'Ajustement', lines: [{ account: '601000' }, { account: '512000' }] },
  { status: 'draft', journal: 'AC', description: 'Facture fournisseur', lines: [{ account: '601000' }, { account: '570000' }] }
];
const accountByCode = Object.fromEntries(accounts.map(account => [account.code, account]));
let entryReads = 0;
let catalogJournalReads = 0;
const sandbox = {
  postingAccounts: () => accounts.filter(account => account.active !== false && account.postable !== false),
  entryAccountCatalogCache: Object.create(null),
  entryCounterpartIndexCache: null,
  esc: value => String(value),
  AccountSearch: require('../modern-proto/js/account-search.js'),
  S: {
    entries: () => { entryReads += 1; return entries; },
    accounts: () => accounts,
    currentDossier: () => ({ id: 'test-dossier' }),
    account: code => accountByCode[String(code)] || null,
    journal: journalCode => {
      catalogJournalReads += 1;
      return journalCode === 'AC'
        ? { authorizedAccounts: accounts.filter(account => account.code !== '512000').map(account => account.code) }
        : null;
    },
    journalAllowsAccount: (journalCode, accountCode) => !(journalCode === 'AC' && accountCode === '512000')
  }
};
sandbox.globalThis = sandbox;

vm.runInNewContext(
  extractFunction('entryAccountCatalog', 'allowedEntryAccounts') +
  extractFunction('allowedEntryAccounts', 'resolveEntryAccount') +
  extractFunction('resolveEntryAccount', 'entryAccountDatalist') +
  extractFunction('entryAccountDatalist', 'entryDescriptionDatalist') +
  extractFunction('entryDescriptionDatalist', 'entryCounterpartIndex') +
  extractFunction('entryCounterpartIndex', 'entryAccountInputStatus') +
  'globalThis.entryDescriptionDatalist = entryDescriptionDatalist;' +
  extractFunction('entryCounterpartSuggestions', 'refreshEntryCounterpartSuggestions') +
  'globalThis.resolveEntryAccount = resolveEntryAccount; globalThis.entryAccountDatalist = entryAccountDatalist; globalThis.entryCounterpartSuggestions = entryCounterpartSuggestions;',
  sandbox
);

assert.equal(sandbox.resolveEntryAccount('601000', 'AC').code, '601000', 'un code exact est saisi sans menu déroulant');
assert.equal(sandbox.resolveEntryAccount('601000 — Achats', 'AC').code, '601000', 'une suggestion code et intitulé est reconnue puis normalisée au code');
assert.equal(sandbox.resolveEntryAccount('Fournisseurs', 'AC').code, '401000', 'un intitulé unique peut aussi être renseigné');
assert.equal(sandbox.resolveEntryAccount('Achats', 'AC'), null, 'un intitulé partagé reste ambigu et n’est pas choisi au hasard');
assert.equal(sandbox.resolveEntryAccount('512000', 'AC'), null, 'un compte interdit par le journal n’est pas reconnu comme choix valide');
assert.equal(sandbox.resolveEntryAccount('compte inconnu', 'AC'), null, 'un compte absent du plan n’est pas inventé');
const prefixOptions = sandbox.entryAccountDatalist('AC', '23');
assert.match(prefixOptions, /230100 — Immobilisations/);
assert.doesNotMatch(prefixOptions, /601230|123230/, 'la suggestion par numéro exige un préfixe de code, pas une occurrence au milieu');
assert.equal(sandbox.entryAccountDatalist('AC', ''), '', 'aucun gros catalogue n’est injecté dans la datalist tant que la saisie est vide');
assert.equal(catalogJournalReads, 1, 'les autorisations du journal sont chargées une fois au lieu d’être relues pour chaque compte');
for (let index = 0; index < 60; index += 1) {
  accounts.push({ code: '699' + String(index).padStart(3, '0'), label: 'Compte de test ' + index, cls: 6, active: true, postable: true });
}
vm.runInNewContext('entryAccountCatalogCache = Object.create(null)', sandbox);
const cappedOptions = sandbox.entryAccountDatalist('AC', '699');
assert.equal((cappedOptions.match(/<option /g) || []).length, 40, 'la liste de suggestions est limitée aux 40 premières correspondances');
assert.doesNotMatch(cappedOptions, /699040/, 'les correspondances supplémentaires ne sont pas injectées en masse dans le DOM');

const suggestions = sandbox.entryCounterpartSuggestions('AC', ['601000']);
assert.equal(
  JSON.stringify(suggestions.map(item => [item.account.code, item.entries, item.sameJournal])),
  JSON.stringify([['401000', 1, 1]]),
  'la suggestion utilise seulement les pièces validées observées, déduplique une même contrepartie dans une pièce, privilégie le journal courant et exclut les comptes non autorisés'
);
sandbox.entryCounterpartSuggestions('AC', ['601000']);
assert.equal(entryReads, 1, 'l’index des pièces validées est réutilisé au lieu de rescanner le registre à chaque frappe');
const labelOptions = sandbox.entryDescriptionDatalist('AC');
assert.equal((labelOptions.match(/Facture fournisseur/g) || []).length, 1, 'les libellés déjà utilisés sont dédupliqués pour le journal sélectionné');
assert.match(appSource, /entry-assistance-title[\s\S]*<div class="field entry-description-field"><label for="e-description">Libellé/);
assert.match(appSource, /id="entry-description-suggestions">' \+ entryDescriptionDatalist\(model\.journal\)/);
const entryView = appSource.slice(appSource.indexOf('function viewEntryForm('), appSource.indexOf('function collectEntryForm(', appSource.indexOf('function viewEntryForm(')));
assert.ok(entryView.indexOf('entry-description-field') > entryView.indexOf('id="lines-body"'), 'le libellé est déplacé sous les lignes de saisie pour être repéré plus vite');

const lineRenderer = appSource.slice(appSource.indexOf('function lineRowHtml('), appSource.indexOf('function viewEntryForm(', appSource.indexOf('function lineRowHtml(')));
assert.match(lineRenderer, /type="text" data-field="account" list="entry-account-suggestions"/);
assert.match(appSource, /<datalist id="entry-account-suggestions">[\s\S]*entryAccountDatalist\(model\.journal\)/);
assert.match(appSource, /data-action="add-suggested-counterpart"/);
assert.match(appSource, /Ajouter le compte uniquement/);
assert.match(appSource, /debit: '', credit: ''/);
assert.match(appSource, /id="entry-difference"/);
assert.match(appSource, /Saisissez un code ou un intitulé exact proposé pour ce journal/);

console.log('Saisie dynamique : saisie directe, résolution non ambiguë, recherche filtrée et suggestions de contrepartie sourcées vérifiées.');
