/* Référence auxiliaire explicite par ligne d’écriture : identité source, compte exact et traçabilité. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
for (const file of ['accounting-chart.js', 'store.js', 'accounting-centralization.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', file), 'utf8'), sandbox, { filename: file });
}
const S = sandbox.window.PerfectoStore;
const supplierAccounts = S.accounts().filter(account => account.aux === true && account.active !== false && account.postable !== false && /^40[12489]/.test(account.code));
assert.ok(supplierAccounts.length >= 2, 'le plan offre plusieurs comptes auxiliaires fournisseur pour vérifier l’exactitude.');
const target = supplierAccounts[0];
const different = supplierAccounts.find(account => account.code !== target.code);
const supplier = S.createSupplier({ code: 'AUX-LINK-1', name: 'Fournisseur explicitement lié', accountCode: target.code });
assert.equal(supplier.ok, true, supplier.errors.join(' '));
const otherSupplier = S.createSupplier({ code: 'AUX-LINK-2', name: 'Fournisseur compte différent', accountCode: different.code });
assert.equal(otherSupplier.ok, true, otherSupplier.errors.join(' '));
const expenseAccount = S.accounts().find(account => account.active !== false && account.postable !== false && /^6/.test(account.code));
assert.ok(expenseAccount);

function payload(lineReference, thirdPartyType, thirdPartyId, accountCode = target.code) {
  const auxiliaryLine = { account: accountCode, debit: 0, credit: 125 };
  if (thirdPartyType !== undefined) auxiliaryLine.thirdPartyType = thirdPartyType;
  if (thirdPartyId !== undefined) auxiliaryLine.thirdPartyId = thirdPartyId;
  return {
    reference: lineReference, journal: 'OD', date: '2026-06-15', description: 'Test du lien auxiliaire explicite',
    lines: [
      { account: expenseAccount.code, debit: 125, credit: 0 },
      auxiliaryLine
    ]
  };
}

const valid = S.validateEntry(payload('OD-AUX-LINK-OK', 'supplier', supplier.supplier.id), { requireBalanced: true, status: 'draft' });
assert.equal(valid.ok, true, valid.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify({
  account: valid.entry.lines[1].account,
  thirdPartyType: valid.entry.lines[1].thirdPartyType,
  thirdPartyId: valid.entry.lines[1].thirdPartyId,
  thirdPartyCode: valid.entry.lines[1].thirdPartyCode,
  thirdPartyName: valid.entry.lines[1].thirdPartyName,
  auxiliaryAccountCode: valid.entry.lines[1].auxiliaryAccountCode
})), {
  account: target.code,
  thirdPartyType: 'supplier',
  thirdPartyId: supplier.supplier.id,
  thirdPartyCode: supplier.supplier.code,
  thirdPartyName: supplier.supplier.name,
  auxiliaryAccountCode: supplier.supplier.auxiliaryAccountCode
});

const mismatch = S.validateEntry(payload('OD-AUX-LINK-MISMATCH', 'supplier', supplier.supplier.id, different.code), { requireBalanced: true, status: 'draft' });
assert.equal(mismatch.ok, false);
assert.match(mismatch.errors.join(' '), /ne correspond pas exactement/);
const nonAuxiliary = S.accounts().find(account => account.aux !== true && account.active !== false && account.postable !== false);
assert.ok(nonAuxiliary);
const notAux = S.validateEntry(payload('OD-AUX-LINK-NON-AUX', 'supplier', supplier.supplier.id, nonAuxiliary.code), { requireBalanced: true, status: 'draft' });
assert.equal(notAux.ok, false);
assert.match(notAux.errors.join(' '), /compte marqué auxiliaire/);
const partial = S.validateEntry(payload('OD-AUX-LINK-PARTIAL', 'supplier', ''), { requireBalanced: true, status: 'draft' });
assert.equal(partial.ok, false);
assert.match(partial.errors.join(' '), /type et l’identifiant/);
const noInference = S.validateEntry(payload('OD-AUX-LINK-NONE'), { requireBalanced: true, status: 'draft' });
assert.equal(noInference.ok, true, noInference.errors.join(' '));
assert.equal(noInference.entry.lines[1].thirdPartyId, undefined, 'un compte collectif seul ne choisit jamais un tiers.');

const created = S.createEntry(payload('OD-AUX-LINK-SAVED', 'supplier', supplier.supplier.id), 'draft');
assert.equal(created.ok, true, created.errors.join(' '));
const posted = S.postEntry(created.entry.id);
assert.equal(posted.ok, true, posted.errors.join(' '));
const savedLine = S.entry(created.entry.id).lines.find(line => line.account === target.code);
assert.equal(savedLine.thirdPartyId, supplier.supplier.id, 'la référence est conservée dans l’écriture validée.');
const extraction = sandbox.window.PerfectoAccountingCentralization.extractValidatedAuxiliaryMovements(
  [S.entry(created.entry.id)], S.accounts(), S.currentDossier(), { decimalPlaces: S.accountingConfiguration().decimalPlaces }
);
assert.equal(extraction.ok, true, extraction.errors.join(' '));
const extractedMovement = extraction.movements.find(movement => movement.account === target.code);
assert.equal(extractedMovement.auxiliaryCode, supplier.supplier.auxiliaryAccountCode);
assert.equal(extractedMovement.thirdPartyId, supplier.supplier.id, 'l’extraction auxiliaire remet à disposition le lien source explicite.');
assert.equal(extractedMovement.thirdPartyType, 'supplier');
const deleteReferenced = S.deleteSupplier(supplier.supplier.id);
assert.equal(deleteReferenced.ok, false, 'une fiche auxiliaire référencée ne peut pas être supprimée.');
assert.match(deleteReferenced.errors.join(' '), /référence/);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const rowStart = app.indexOf('function lineRowHtml(');
const rowEnd = app.indexOf('function viewEntryForm(', rowStart);
const rowRenderer = app.slice(rowStart, rowEnd);
assert.match(rowRenderer, /entryAuxiliaryPartyEditorHtml/);
assert.match(rowRenderer, /thirdPartyType/);
assert.match(app, /aucun tiers n’est déduit du compte collectif/i);
assert.match(app, /data-field="third-party"/);
assert.match(app, /thirdPartyId: party \? party\.id : ''/);

const css = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'css', 'modern.css'), 'utf8');
assert.match(css, /entry-auxiliary-party-editor/);
console.log('Lien auxiliaire explicite : sélection, contrôle strict du compte, persistance et protection des fiches tiers — OK');
