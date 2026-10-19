/* Cycle de vie du plan comptable, des fournisseurs et des codes d’identification. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
let storageWritesBlocked = false;
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) {
    if (storageWritesBlocked) throw new Error('quota simulé');
    values.set(key, String(value));
  },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
const chartSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8');
const storeSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8');
vm.runInContext(chartSource, sandbox, { filename: 'accounting-chart.js' });

function loadStore() {
  vm.runInContext(storeSource, sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

let store = loadStore();

// Les pièces existantes interdisent la renumérotation ou la suppression d’un compte référencé.
const postedBefore = JSON.stringify(store.entries());
const usedAccountEdit = store.updateAccount('601100', {
  code: '601101', label: 'Achats renommés', nature: 'Charge', usage: 'Test', aux: false
});
assert.equal(usedAccountEdit.ok, false);
assert.match(usedAccountEdit.errors.join(' '), /pièce\(s\) comptable\(s\)/);
assert.equal(store.deleteAccount('601100').ok, false);
assert.equal(JSON.stringify(store.entries()), postedBefore, 'les pièces et leurs lignes restent inchangées');

// Les comptes libres peuvent être modifiés, supprimés et un compte standard supprimé ne réapparaît pas.
const customAccount = store.addAccount({
  code: '758901', label: 'Compte personnalisé', nature: 'Produit', usage: 'Premier libellé', aux: false
});
assert.equal(customAccount.ok, true, customAccount.errors.join(' '));
const changedCustom = store.updateAccount('758901', {
  code: '758902', label: 'Compte personnalisé modifié', nature: 'Produit', usage: 'Usage mis à jour', aux: false
});
assert.equal(changedCustom.ok, true, changedCustom.errors.join(' '));
assert.equal(store.account('758901'), null);
assert.equal(store.account('758902').label, 'Compte personnalisé modifié');

const renamedStandard = store.updateAccount('755', {
  code: '7555', label: 'Quote-part personnalisée', nature: 'Produit', usage: 'Libellé ajusté par le dossier', aux: false
});
assert.equal(renamedStandard.ok, true, renamedStandard.errors.join(' '));
assert.ok(store.getState().deletedStandardAccountCodes.includes('755'));
const renamedStandardCode = store.getState().accountChartVersion;
sandbox.window.PerfectoAccountingChart.VERSION = renamedStandardCode + 1;
store = loadStore();
assert.equal(store.account('755'), null, 'une mise à niveau du plan ne restaure pas le compte standard supprimé');
assert.equal(store.account('7555').label, 'Quote-part personnalisée', 'le compte renuméroté reste conservé après migration');
assert.equal(store.deleteAccount('7555').ok, true, 'un compte personnalisé désormais inutilisé peut être supprimé');
assert.equal(store.account('7555'), null);
assert.equal(store.account('755'), null);

// Les préfixes sont partagés, mais les compteurs et historiques sont isolés par dossier.
assert.equal(store.nextIdentificationCode('supplier'), 'FOU-0001');
assert.equal(store.nextIdentificationCode('client'), 'CLI-0001');
assert.equal(store.nextIdentificationCode('personnel'), 'PER-0001');
assert.equal(store.registerIdentificationCode('client', 'CLI-0001').ok, true);
assert.equal(store.nextIdentificationCode('client'), 'CLI-0002');
assert.equal(store.registerIdentificationCode('personnel', 'PER-0001').ok, true);
assert.equal(store.nextIdentificationCode('personnel'), 'PER-0002');
assert.equal(store.nextIdentificationCode('inconnu'), '');
assert.equal(store.getState().clientRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.clients())), []);

const firstClient = store.createClient({ name: 'Client généré', accountCode: '411', paymentTermDays: '30' });
assert.equal(firstClient.ok, true, firstClient.errors.join(' '));
assert.equal(firstClient.client.code, 'CLI-0002', 'le code client est attribué automatiquement à l’enregistrement');
assert.equal(firstClient.client.auxiliaryAccountCode, '411-CLI-0002');
const updatedClient = store.updateClient(firstClient.client.id, {
  code: 'CLI-CLIENT-001', name: 'Client modifié', accountCode: '411', paymentTermDays: '45'
});
assert.equal(updatedClient.ok, true, updatedClient.errors.join(' '));
assert.equal(updatedClient.client.code, 'CLI-CLIENT-001', 'le code client reste modifiable');
assert.equal(updatedClient.client.name, 'Client modifié');
assert.equal(store.deleteClient(firstClient.client.id).ok, true, 'un client sans écriture liée peut être supprimé');
assert.ok(store.getState().clientCodeHistory.includes('CLI-0002'), 'le code supprimé reste réservé');
assert.ok(store.getState().clientCodeHistory.includes('CLI-CLIENT-001'), 'le code modifié reste aussi réservé');
const secondClient = store.createClient({ name: 'Deuxième client', accountCode: '411' });
assert.equal(secondClient.ok, true, secondClient.errors.join(' '));
assert.equal(secondClient.client.code, 'CLI-0003', 'le code client supprimé n’est pas réattribué');
const reusedClientCode = store.createClient({ code: 'CLI-0002', name: 'Code client à ne pas reprendre', accountCode: '411' });
assert.equal(reusedClientCode.ok, false);
assert.match(reusedClientCode.errors.join(' '), /déjà été attribué/);
const referencedClient = store.createClient({ name: 'Client avec historique', accountCode: '412' });
assert.equal(referencedClient.ok, true, referencedClient.errors.join(' '));
store.getState().entries.push(
  {
    id: 'client-reference-test', reference: 'OD-REF-CLI', journal: 'OD', date: '2026-02-02', status: 'posted',
    lines: [{ account: '411100', debit: 10, credit: 0, clientId: referencedClient.client.id }]
  },
  {
    id: 'client-auxiliary-reference-test', reference: 'OD-REF-CLI-AUX', journal: 'OD', date: '2026-02-03', status: 'posted',
    lines: [{ account: referencedClient.client.auxiliaryAccountCode, debit: 25, credit: 0 }]
  }
);
assert.equal(store.save(), true);
assert.equal(store.clientCodeChangeCheck(referencedClient.client.id).ok, false, 'un code associé à une écriture ne peut pas être renuméroté');
assert.equal(store.updateClient(referencedClient.client.id, {
  code: 'CLI-0005', name: 'Code changé à tort', accountCode: '412'
}).ok, false);
assert.equal(store.updateClient(referencedClient.client.id, {
  code: referencedClient.client.code, name: 'Compte changé à tort', accountCode: '411'
}).ok, false, 'le compte collectif est verrouillé si le client est référencé');
const safeHistoricalClientUpdate = store.updateClient(referencedClient.client.id, {
  code: referencedClient.client.code, name: 'Client référencé modifié', accountCode: '412', paymentTermDays: '60'
});
assert.equal(safeHistoricalClientUpdate.ok, true, safeHistoricalClientUpdate.errors.join(' '));
assert.equal(safeHistoricalClientUpdate.client.name, 'Client référencé modifié');
assert.equal(store.deleteClient(referencedClient.client.id).ok, false, 'un client référencé par une écriture ne peut pas être supprimé');
assert.equal(store.accountCodeChangeCheck('412').references.clientCount, 1, 'le compte collectif garde son lien avec le répertoire client');

const firstSupplier = store.createSupplier({ name: 'Fournisseur généré', accountCode: '401', paymentTermDays: '30' });
assert.equal(firstSupplier.ok, true, firstSupplier.errors.join(' '));
assert.equal(firstSupplier.supplier.code, 'FOU-0001', 'un code fournisseur est proposé automatiquement');
assert.equal(firstSupplier.supplier.auxiliaryAccountCode, '401-FOU-0001');
const updatedSupplier = store.updateSupplier(firstSupplier.supplier.id, {
  code: firstSupplier.supplier.code, name: 'Fournisseur modifié', accountCode: '401', paymentTermDays: '45'
});
assert.equal(updatedSupplier.ok, true, updatedSupplier.errors.join(' '));
assert.equal(updatedSupplier.supplier.name, 'Fournisseur modifié');
assert.equal(store.deleteSupplier(firstSupplier.supplier.id).ok, true, 'une fiche fournisseur non référencée peut être supprimée');
assert.ok(store.getState().supplierCodeHistory.includes('FOU-0001'), 'le code supprimé reste réservé');
const secondSupplier = store.createSupplier({ name: 'Deuxième fournisseur', accountCode: '401' });
assert.equal(secondSupplier.ok, true, secondSupplier.errors.join(' '));
assert.equal(secondSupplier.supplier.code, 'FOU-0002', 'la numérotation ne réutilise pas le code supprimé');
const reusedSupplierCode = store.createSupplier({ code: 'FOU-0001', name: 'Code à ne pas reprendre', accountCode: '401' });
assert.equal(reusedSupplierCode.ok, false);
assert.match(reusedSupplierCode.errors.join(' '), /déjà été attribué/);

const referencedSupplier = store.createSupplier({ name: 'Fournisseur avec historique', accountCode: '401' });
assert.equal(referencedSupplier.ok, true, referencedSupplier.errors.join(' '));
store.getState().entries.push({
  id: 'supplier-reference-test', reference: 'OD-REF-FOU', journal: 'OD', date: '2026-02-01', status: 'posted',
  lines: [{ account: '401100', debit: 0, credit: 10, supplierId: referencedSupplier.supplier.id }]
});
assert.equal(store.save(), true);
const blockedSupplierDeletion = store.deleteSupplier(referencedSupplier.supplier.id);
assert.equal(blockedSupplierDeletion.ok, false);
assert.match(blockedSupplierDeletion.errors.join(' '), /référence cette fiche/);
assert.ok(store.supplier(referencedSupplier.supplier.id), 'la fiche reste en place si une écriture la référence');

// Migration de bases antérieures : reprendre les registres et séquences fournisseurs/clients déjà présents.
const legacyState = JSON.parse(JSON.stringify(store.getState()));
legacyState.supplierRegistryVersion = 1;
legacyState.suppliers = [{ id: 'legacy-supplier', code: 'FOU-0099', name: 'Fournisseur migré', accountCode: '401' }];
legacyState.clients = [{ id: 'legacy-client', code: 'CLI-0099', name: 'Client migré', accountCode: '411' }];
delete legacyState.clientRegistryVersion;
delete legacyState.supplierCodeHistory;
delete legacyState.clientCodeHistory;
delete legacyState.personnelCodeHistory;
delete legacyState.identificationSequences;
values.set(store.currentStorageKey(), JSON.stringify(legacyState));
store = loadStore();
assert.equal(store.nextIdentificationCode('supplier'), 'FOU-0100');
assert.ok(store.getState().supplierCodeHistory.includes('FOU-0099'));
assert.equal(store.getState().supplierRegistryVersion, 2);
assert.equal(store.nextIdentificationCode('client'), 'CLI-0100');
assert.ok(store.getState().clientCodeHistory.includes('CLI-0099'));
assert.equal(store.getState().clientRegistryVersion, 1);

console.log('Comptes, fournisseurs et clients : modifications/suppressions protégées et identifiants FOU/CLI/PER — OK');
