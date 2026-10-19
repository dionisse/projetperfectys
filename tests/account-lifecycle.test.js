/* Cycle de vie du plan comptable, des tiers auxiliaires et du personnel local. */
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
assert.equal(store.nextIdentificationCode('debtor'), 'DEB-0001');
assert.equal(store.nextIdentificationCode('creditor'), 'CRE-0001');
assert.equal(store.nextIdentificationCode('inconnu'), '');
assert.equal(store.getState().clientRegistryVersion, 1);
assert.equal(store.getState().otherPartyRegistryVersion, 1);
assert.equal(store.getState().personnelRegistryVersion, 1);
assert.equal(store.getState().fixedAssetLocationRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.fixedAssetLocations())), []);
assert.equal(store.nextFixedAssetLocationCode(), 'LOC-0001');
assert.equal(store.getState().fixedAssetRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.fixedAssets())), []);
assert.equal(store.nextFixedAssetCode(), 'IMMO-0001');
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

const firstDebtor = store.createOtherParty({ type: 'debtor', name: 'Débiteur divers généré', accountCode: '471' });
assert.equal(firstDebtor.ok, true, firstDebtor.errors.join(' '));
assert.equal(firstDebtor.otherParty.code, 'DEB-0001', 'un code DEB est attribué automatiquement');
assert.equal(firstDebtor.otherParty.auxiliaryAccountCode, '471-DEB-0001');
const updatedDebtor = store.updateOtherParty(firstDebtor.otherParty.id, { ...firstDebtor.otherParty, name: 'Débiteur divers modifié' });
assert.equal(updatedDebtor.ok, true, updatedDebtor.errors.join(' '));
assert.equal(store.deleteOtherParty(firstDebtor.otherParty.id).ok, true, 'un tiers divers non référencé peut être supprimé');
assert.ok(store.getState().debtorCodeHistory.includes('DEB-0001'), 'le code DEB supprimé reste réservé');
const secondDebtor = store.createOtherParty({ type: 'debtor', name: 'Tiers à requalifier', accountCode: '471' });
assert.equal(secondDebtor.otherParty.code, 'DEB-0002');
const reclassifiedCreditor = store.updateOtherParty(secondDebtor.otherParty.id, {
  ...secondDebtor.otherParty, type: 'creditor'
});
assert.equal(reclassifiedCreditor.ok, true, reclassifiedCreditor.errors.join(' '));
assert.equal(reclassifiedCreditor.otherParty.code, 'CRE-0001', 'le code suit automatiquement la nouvelle nature du tiers');
const firstCreditor = store.createOtherParty({ type: 'creditor', name: 'Créditeur divers', accountCode: '471' });
assert.equal(firstCreditor.ok, true, firstCreditor.errors.join(' '));
assert.equal(firstCreditor.otherParty.code, 'CRE-0002');
assert.equal(store.createOtherParty({ type: 'creditor', code: 'DEB-0001', name: 'Code réutilisé', accountCode: '471' }).ok, false, 'un code de tiers supprimé ne peut pas être réutilisé par l’autre type');
const referencedOtherParty = store.createOtherParty({ type: 'debtor', name: 'Tiers divers référencé', accountCode: '471' });
assert.equal(referencedOtherParty.ok, true, referencedOtherParty.errors.join(' '));
store.getState().entries.push({
  id: 'other-party-reference-test', reference: 'OD-REF-DIV', journal: 'OD', date: '2026-02-04', status: 'posted',
  lines: [{ account: referencedOtherParty.otherParty.auxiliaryAccountCode, debit: 40, credit: 0, debtorId: referencedOtherParty.otherParty.id }]
});
assert.equal(store.save(), true);
assert.equal(store.otherPartyIdentityChangeCheck(referencedOtherParty.otherParty.id).ok, false);
assert.equal(store.updateOtherParty(referencedOtherParty.otherParty.id, {
  type: 'creditor', code: 'CRE-0003', name: 'Tiers requalifié', accountCode: '471'
}).ok, false, 'type et identité sont protégés dès qu’une pièce référence le tiers');
const safeOtherPartyUpdate = store.updateOtherParty(referencedOtherParty.otherParty.id, {
  ...referencedOtherParty.otherParty, name: 'Tiers divers référencé modifié'
});
assert.equal(safeOtherPartyUpdate.ok, true, safeOtherPartyUpdate.errors.join(' '));
assert.equal(store.deleteOtherParty(referencedOtherParty.otherParty.id).ok, false);
assert.equal(store.accountCodeChangeCheck('471').references.otherPartyCount, 3, 'le compte collectif reste lié aux tiers divers');

const firstPersonnel = store.createPersonnel({ name: 'Employée de démonstration', jobTitle: 'Comptable', department: 'Finance', accountCode: '421' });
assert.equal(firstPersonnel.ok, true, firstPersonnel.errors.join(' '));
assert.equal(firstPersonnel.personnel.code, 'PER-0002', 'un code PER est attribué automatiquement');
assert.equal(firstPersonnel.personnel.auxiliaryAccountCode, '421-PER-0002');
const updatedPersonnel = store.updatePersonnel(firstPersonnel.personnel.id, {
  ...firstPersonnel.personnel, code: 'PER-EMP-001', name: 'Employée modifiée'
});
assert.equal(updatedPersonnel.ok, true, updatedPersonnel.errors.join(' '));
assert.equal(store.deletePersonnel(firstPersonnel.personnel.id).ok, true, 'une fiche du personnel non référencée peut être supprimée');
assert.ok(store.getState().personnelCodeHistory.includes('PER-0002'));
assert.ok(store.getState().personnelCodeHistory.includes('PER-EMP-001'));
assert.equal(store.createPersonnel({ name: 'Mauvais compte', accountCode: '471' }).ok, false);
const referencedPersonnel = store.createPersonnel({ name: 'Employé référencé', accountCode: '421' });
assert.equal(referencedPersonnel.ok, true, referencedPersonnel.errors.join(' '));
assert.equal(referencedPersonnel.personnel.code, 'PER-0003', 'le code PER supprimé n’est pas réattribué');
store.getState().entries.push({
  id: 'personnel-reference-test', reference: 'OD-REF-PER', journal: 'OD', date: '2026-02-05', status: 'posted',
  lines: [{ account: referencedPersonnel.personnel.auxiliaryAccountCode, debit: 75, credit: 0, personnelId: referencedPersonnel.personnel.id }]
});
assert.equal(store.save(), true);
assert.equal(store.personnelIdentityChangeCheck(referencedPersonnel.personnel.id).ok, false);
assert.equal(store.updatePersonnel(referencedPersonnel.personnel.id, {
  ...referencedPersonnel.personnel, code: 'PER-0004', accountCode: '422'
}).ok, false);
const safePersonnelUpdate = store.updatePersonnel(referencedPersonnel.personnel.id, {
  ...referencedPersonnel.personnel, name: 'Employé référencé modifié', department: 'Comptabilité'
});
assert.equal(safePersonnelUpdate.ok, true, safePersonnelUpdate.errors.join(' '));
assert.equal(store.deletePersonnel(referencedPersonnel.personnel.id).ok, false);
assert.equal(store.accountCodeChangeCheck('421').references.personnelCount, 1, 'le compte collectif conserve le lien personnel');

const assetLocationRoot = store.createFixedAssetLocation({
  name: 'Siège de Cotonou', level: 'Site', address: 'Cotonou, Littoral', responsible: 'Administration'
});
assert.equal(assetLocationRoot.ok, true, assetLocationRoot.errors.join(' '));
assert.equal(assetLocationRoot.location.code, 'LOC-0001');
const assetLocationBuilding = store.createFixedAssetLocation({
  name: 'Bâtiment A', level: 'Bâtiment', parentId: assetLocationRoot.location.id, notes: 'Aile principale'
});
assert.equal(assetLocationBuilding.ok, true, assetLocationBuilding.errors.join(' '));
assert.equal(assetLocationBuilding.location.code, 'LOC-0002');
assert.equal(store.fixedAssetLocation('loc-0002').id, assetLocationBuilding.location.id, 'la recherche accepte le code sans sensibilité à la casse');
assert.equal(store.deleteFixedAssetLocation(assetLocationRoot.location.id).ok, false, 'un emplacement parent qui possède des enfants ne peut pas être supprimé');
assert.equal(store.updateFixedAssetLocation(assetLocationRoot.location.id, {
  ...assetLocationRoot.location, parentId: assetLocationBuilding.location.id
}).ok, false, 'un emplacement ne peut pas devenir descendant de son propre enfant');
const updatedAssetLocation = store.updateFixedAssetLocation(assetLocationBuilding.location.id, {
  ...assetLocationBuilding.location, code: 'BAT-A', name: 'Bâtiment administratif', level: 'Bâtiment principal',
  address: 'Avenue des finances', responsible: 'Services généraux', notes: 'Libellés modifiables'
});
assert.equal(updatedAssetLocation.ok, true, updatedAssetLocation.errors.join(' '));
assert.equal(updatedAssetLocation.location.code, 'BAT-A');
assert.equal(updatedAssetLocation.location.level, 'Bâtiment principal');
assert.equal(updatedAssetLocation.location.parentId, assetLocationRoot.location.id, 'le lien parent/enfant reste enregistré');
assert.equal(store.createFixedAssetLocation({ code: 'bat-a', name: 'Code en doublon', level: 'Local' }).ok, false);
assert.equal(store.createFixedAssetLocation({ name: 'Sans niveau' }).ok, false, 'le champ hiérarchique est obligatoire');
assert.equal(store.deleteFixedAssetLocation(assetLocationBuilding.location.id).ok, true);
assert.ok(store.getState().fixedAssetLocationCodeHistory.includes('LOC-0002'));
assert.ok(store.getState().fixedAssetLocationCodeHistory.includes('BAT-A'));
const nextAssetLocation = store.createFixedAssetLocation({ name: 'Entrepôt', level: 'Zone' });
assert.equal(nextAssetLocation.location.code, 'LOC-0003', 'les codes supprimés ou remplacés ne sont pas réattribués');
assert.equal(store.deleteFixedAssetLocation(assetLocationRoot.location.id).ok, true);
const entriesBeforeFixedAssets = store.entries().length;
const firstFixedAsset = store.createFixedAsset({
  name: 'Véhicule de service', assetType: 'corporelle', status: 'en-service',
  acquisitionDate: '2026-02-01', commissioningDate: '2026-02-15', grossCost: '12500000', residualValue: '500000',
  assetAccountCode: '242', locationId: nextAssetLocation.location.id,
  depreciationMethod: 'lineaire', usefulLifeMonths: '60', depreciationStartDate: '2026-03-01',
  accumulatedDepreciationAccountCode: '283', depreciationExpenseAccountCode: '681',
  manufacturer: 'Constructeur', model: 'Utilitaire', serialNumber: 'VIN-TEST-001', physicalCondition: 'Bon'
});
assert.equal(firstFixedAsset.ok, true, firstFixedAsset.errors.join(' '));
assert.equal(firstFixedAsset.fixedAsset.code, 'IMMO-0001');
assert.equal(firstFixedAsset.fixedAsset.grossCost, 12500000);
assert.equal(firstFixedAsset.fixedAsset.assetAccountCode, '242');
assert.equal(firstFixedAsset.fixedAsset.locationId, nextAssetLocation.location.id);
assert.equal(firstFixedAsset.fixedAsset.depreciationMethod, 'lineaire');
assert.equal(store.entries().length, entriesBeforeFixedAssets, 'la fiche d’immobilisation ne génère aucune écriture comptable');
assert.equal(store.fixedAsset('immo-0001').id, firstFixedAsset.fixedAsset.id, 'la recherche accepte le code sans sensibilité à la casse');
assert.equal(store.updateFixedAsset(firstFixedAsset.fixedAsset.id, {
  ...firstFixedAsset.fixedAsset, code: 'IMMO-VEH-01', name: 'Véhicule utilitaire'
}).ok, true, 'le code et les informations descriptives restent modifiables');
assert.equal(store.createFixedAsset({ name: 'Actif au compte de trésorerie', assetType: 'corporelle', assetAccountCode: '512', grossCost: '1000' }).ok, false, 'un compte hors classe 2 est refusé pour un actif corporel');
assert.equal(store.createFixedAsset({
  name: 'Coût absent', assetType: 'corporelle', status: 'en-cours', assetAccountCode: '242', acquisitionDate: '2026-02-01', depreciationMethod: 'a-definir'
}).ok, false, 'un coût d’acquisition XOF doit être fourni, même si le bien est encore en cours');
assert.equal(store.createFixedAsset({
  name: 'Titre financier amortissable', assetType: 'financiere', assetAccountCode: '271', grossCost: '1000', depreciationMethod: 'lineaire'
}).ok, false, 'une méthode d’amortissement ne peut pas être enregistrée pour une immobilisation financière');
assert.equal(store.createFixedAsset({
  name: 'Immobilisation au compte incorporel', assetType: 'incorporelle', assetAccountCode: '242', grossCost: '1000'
}).ok, false, 'un compte corporel ne peut pas être associé à une immobilisation incorporelle');
const intangibleAsset = store.createFixedAsset({
  name: 'Licence logicielle', assetType: 'incorporelle', status: 'en-service',
  acquisitionDate: '2026-02-01', commissioningDate: '2026-02-01', grossCost: '800000', assetAccountCode: '213'
});
assert.equal(intangibleAsset.ok, true, intangibleAsset.errors.join(' '));
assert.equal(intangibleAsset.fixedAsset.code, 'IMMO-0002');
assert.equal(intangibleAsset.fixedAsset.depreciationMethod, 'a-definir', 'la méthode non validée est aussi le défaut du registre');
const financialAsset = store.createFixedAsset({
  name: 'Prêt à long terme', assetType: 'financiere', status: 'en-service',
  acquisitionDate: '2026-02-01', commissioningDate: '2026-02-01', grossCost: '2000000', assetAccountCode: '271', depreciationMethod: 'aucun'
});
assert.equal(financialAsset.ok, true, financialAsset.errors.join(' '));
assert.equal(financialAsset.fixedAsset.code, 'IMMO-0003');
assert.equal(store.deleteFixedAsset(intangibleAsset.fixedAsset.id).ok, true, 'une fiche incorporelle sans mouvement peut être supprimée');
assert.equal(store.deleteFixedAsset(financialAsset.fixedAsset.id).ok, true, 'une fiche financière sans mouvement peut être supprimée');
assert.ok(store.getState().fixedAssetCodeHistory.includes('IMMO-0002'));
assert.ok(store.getState().fixedAssetCodeHistory.includes('IMMO-0003'));
assert.equal(store.nextFixedAssetCode(), 'IMMO-0004', 'les codes supprimés ne sont jamais réutilisés');
store.getState().fixedAssetMovements = [{ id: 'fixed-asset-reference-test', fixedAssetId: firstFixedAsset.fixedAsset.id }];
assert.equal(store.save(), true);
assert.equal(store.updateFixedAsset(firstFixedAsset.fixedAsset.id, {
  ...store.fixedAsset(firstFixedAsset.fixedAsset.id), code: 'IMMO-VEH-02'
}).ok, false, 'le code est protégé lorsque des mouvements utilisent la fiche');
assert.equal(store.deleteFixedAsset(firstFixedAsset.fixedAsset.id).ok, false, 'une immobilisation référencée par des mouvements ne peut pas être supprimée');
assert.equal(store.updateFixedAsset(firstFixedAsset.fixedAsset.id, {
  ...store.fixedAsset(firstFixedAsset.fixedAsset.id), name: 'Véhicule utilitaire du siège'
}).ok, true, 'les champs descriptifs restent modifiables sans rompre les références');
assert.equal(store.updateFixedAssetLocation(nextAssetLocation.location.id, {
  ...nextAssetLocation.location, code: 'LOC-0004'
}).ok, false, 'le code et la hiérarchie sont protégés lorsque des immobilisations utilisent le lieu');
assert.equal(store.deleteFixedAssetLocation(nextAssetLocation.location.id).ok, false, 'un lieu affecté à une immobilisation ne peut pas être supprimé');
assert.equal(store.updateFixedAssetLocation(nextAssetLocation.location.id, {
  ...nextAssetLocation.location, name: 'Entrepôt de stockage'
}).ok, true, 'les champs descriptifs restent modifiables sans rompre l’affectation');

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

// Migration de bases antérieures : reprendre les répertoires et séquences de tous les tiers.
const legacyState = JSON.parse(JSON.stringify(store.getState()));
legacyState.supplierRegistryVersion = 1;
legacyState.suppliers = [{ id: 'legacy-supplier', code: 'FOU-0099', name: 'Fournisseur migré', accountCode: '401' }];
legacyState.clients = [{ id: 'legacy-client', code: 'CLI-0099', name: 'Client migré', accountCode: '411' }];
legacyState.otherParties = [
  { id: 'legacy-debtor', type: 'debtor', code: 'DEB-0099', name: 'Débiteur migré', accountCode: '471' },
  { id: 'legacy-creditor', type: 'creditor', code: 'CRE-0088', name: 'Créditeur migré', accountCode: '471' }
];
legacyState.personnel = [{ id: 'legacy-personnel', code: 'PER-0099', name: 'Personnel migré', accountCode: '421' }];
legacyState.fixedAssetLocationRegistryVersion = 0;
legacyState.fixedAssetLocations = [{ id: 'legacy-location', code: 'LOC-0099', name: 'Dépôt migré', level: 'Site', parentId: '' }];
delete legacyState.fixedAssetLocationCodeHistory;
delete legacyState.fixedAssetLocationSequence;
legacyState.fixedAssetRegistryVersion = 0;
legacyState.fixedAssets = [{
  id: 'legacy-fixed-asset', code: 'IMMO-0099', name: 'Actif migré', assetType: 'corporelle', status: 'en-service',
  assetAccountCode: '242', locationId: 'legacy-location', grossCost: 1000
}];
legacyState.fixedAssetMovements = [];
delete legacyState.fixedAssetCodeHistory;
delete legacyState.fixedAssetSequence;
delete legacyState.clientRegistryVersion;
delete legacyState.otherPartyRegistryVersion;
delete legacyState.personnelRegistryVersion;
delete legacyState.supplierCodeHistory;
delete legacyState.clientCodeHistory;
delete legacyState.debtorCodeHistory;
delete legacyState.creditorCodeHistory;
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
assert.equal(store.nextIdentificationCode('debtor'), 'DEB-0100');
assert.ok(store.getState().debtorCodeHistory.includes('DEB-0099'));
assert.equal(store.nextIdentificationCode('creditor'), 'CRE-0089');
assert.ok(store.getState().creditorCodeHistory.includes('CRE-0088'));
assert.equal(store.nextIdentificationCode('personnel'), 'PER-0100');
assert.ok(store.getState().personnelCodeHistory.includes('PER-0099'));
assert.equal(store.getState().otherPartyRegistryVersion, 1);
assert.equal(store.getState().personnelRegistryVersion, 1);
assert.equal(store.getState().fixedAssetLocationRegistryVersion, 1);
assert.equal(store.fixedAssetLocation('legacy-location').name, 'Dépôt migré', 'la migration conserve les anciennes localisations');
assert.ok(store.getState().fixedAssetLocationCodeHistory.includes('LOC-0099'));
assert.equal(store.nextFixedAssetLocationCode(), 'LOC-0100', 'la migration reprend la séquence des codes existants');
assert.equal(store.getState().fixedAssetRegistryVersion, 1);
assert.equal(store.fixedAsset('legacy-fixed-asset').name, 'Actif migré', 'la migration conserve les anciennes fiches immobilisées');
assert.ok(store.getState().fixedAssetCodeHistory.includes('IMMO-0099'));
assert.equal(store.nextFixedAssetCode(), 'IMMO-0100', 'la migration reprend la séquence des codes existants');
const legacyImport = JSON.parse(store.exportJson());
legacyImport.data.fixedAssetLocationRegistryVersion = 0;
legacyImport.data.fixedAssetLocations = [{ id: 'imported-legacy-location', code: 'LOC-0200', name: 'Site importé', level: 'Site' }];
delete legacyImport.data.fixedAssetLocationCodeHistory;
delete legacyImport.data.fixedAssetLocationSequence;
legacyImport.data.fixedAssetRegistryVersion = 0;
legacyImport.data.fixedAssets = [{
  id: 'imported-legacy-asset', code: 'IMMO-0200', name: 'Actif importé', assetType: 'corporelle',
  status: 'en-service', assetAccountCode: '242', locationId: 'imported-legacy-location', grossCost: 5000
}];
delete legacyImport.data.fixedAssetCodeHistory;
delete legacyImport.data.fixedAssetSequence;
assert.equal(store.importJson(JSON.stringify(legacyImport)).ok, true, 'la restauration JSON migre les référentiels de localisations et immobilisations');
assert.equal(store.fixedAssetLocation('imported-legacy-location').name, 'Site importé');
assert.equal(store.nextFixedAssetLocationCode(), 'LOC-0201');
assert.equal(store.fixedAsset('imported-legacy-asset').name, 'Actif importé');
assert.equal(store.nextFixedAssetCode(), 'IMMO-0201');

console.log('Comptes, tiers et registres d’immobilisations : CRUD protégé et migrations — OK');
