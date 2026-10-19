/* Tests des dossiers clients locaux de démonstration, sans dépendance externe. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const STANDARD_ACCOUNT_COUNT = require('../modern-proto/js/accounting-chart.js').accountCount();

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

function loadStore() {
  const sandbox = { window: {}, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  sandbox.window.localStorage = localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

const legacyState = {
  version: 1, exercise: 2026, accounts: [{ code: '411100' }], journals: [{ code: 'VE' }],
  entries: [{ id: 'legacy', reference: 'VE-2026-LEGACY', date: '2026-01-01', status: 'posted', lines: [] }], periods: []
};
values.set('perfecto.lot1.v1', JSON.stringify(legacyState));
let store = loadStore();
assert.equal(store.currentDossier().id, 'folder-main');
assert.equal(store.entries()[0].reference, 'VE-2026-LEGACY', 'la version antérieure reste accessible dans le dossier principal');
assert.equal(values.get('perfecto.lot1.v1'), JSON.stringify(legacyState), 'la migration conserve la clé comptable historique');
assert.equal(store.currentDossier().clientName, 'Entreprise de démonstration');

// Migration transparente du catalogue de dossiers de la version précédente.
values.delete('perfecto.dossiers.v1');
values.delete('perfecto.activeDossier.v1');
values.set('perfecto.folders.v1', JSON.stringify([
  { id: 'folder-main', name: 'Dossier principal', seeded: true },
  { id: 'folder-legacy', name: 'Agence Nord', seeded: false, address: 'Cotonou, Bénin', ifu: 'IFU-123', rccm: 'RCCM-456', email: 'contact@agence.bj', phone: '+229 21 00 00 00' }
]));
values.set('perfecto.activeFolder.v1', 'folder-legacy');
store = loadStore();
assert.equal(store.currentDossier().name, 'Agence Nord');
assert.equal(store.currentDossier().clientName, 'Agence Nord');
assert.equal(store.currentDossier().reference, 'COR-NOR2026');
assert.equal(store.currentDossier().address, 'Cotonou, Bénin');
assert.equal(store.currentDossier().ifu, 'IFU-123');
assert.equal(store.currentDossier().rccm, 'RCCM-456');
assert.equal(store.currentDossier().email, 'contact@agence.bj');
assert.equal(store.currentDossier().phone, '+229 21 00 00 00');
assert.equal(store.switchDossier('folder-main').ok, true);

values.clear();
store = loadStore();
const main = store.currentDossier();
assert.equal(main.id, 'folder-main');
assert.equal(store.entries().length, 4, 'le dossier historique de démonstration conserve ses données');
const preSupplierState = JSON.parse(JSON.stringify(store.getState()));
delete preSupplierState.suppliers;
delete preSupplierState.supplierRegistryVersion;
delete preSupplierState.clients;
delete preSupplierState.clientRegistryVersion;
values.set('perfecto.lot1.v1', JSON.stringify(preSupplierState));
store = loadStore();
assert.equal(store.suppliers().length, 0, 'la migration ajoute un référentiel vide aux anciennes bases valides');
const migratedState = JSON.parse(values.get('perfecto.lot1.v1'));
assert.equal(migratedState.supplierRegistryVersion, 2);
assert.equal(migratedState.suppliers.length, 0);
assert.equal(migratedState.clientRegistryVersion, 1);
assert.equal(migratedState.clients.length, 0);
assert.equal(store.clients().length, 0, 'la migration ajoute un répertoire clients vide aux anciennes bases valides');
assert.equal(store.backupInfo().available, true, 'la migration conserve un point local de restauration');

const created = store.createDossier({
  clientName: 'Cabinet Godwin',
  clientCode: 'GOD',
  accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR',
  cycleStart: '2026-07-01',
  cycleEnd: '2027-06-30',
  address: 'Rue des finances, Cotonou',
  ifu: 'IFU-GOD-2026',
  rccm: 'RB/COT/26 A 12345',
  email: 'contact@godwin.bj',
  phone: '+229 01 02 03 04'
});
assert.equal(created.ok, true);
assert.equal(created.dossier.clientCode, 'GOD', 'le code saisi est conservé après normalisation');
assert.equal(created.dossier.reference, 'COR-GOD2026', 'la référence suit le type, le code client et l’année du cycle');
assert.equal(created.dossier.exerciseYear, 2026);
assert.equal(created.dossier.address, 'Rue des finances, Cotonou');
assert.equal(created.dossier.ifu, 'IFU-GOD-2026');
assert.equal(created.dossier.rccm, 'RB/COT/26 A 12345');
assert.equal(created.dossier.email, 'contact@godwin.bj');
assert.equal(created.dossier.phone, '+229 01 02 03 04');
assert.equal(store.createDossier({
  clientName: 'Client sans code', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
}).ok, false, 'le code client est saisi explicitement, sans règle de génération automatique');
assert.equal(store.createDossier({
  clientName: 'Cabinet Godwin bis', clientCode: 'GOD', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
}).ok, false, 'une référence déjà prise ne peut pas être réutilisée');
assert.equal(store.createDossier({
  clientName: 'Cycle invalide', clientCode: 'CYC', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-02-30', cycleEnd: '2026-12-31'
}).ok, false, 'une date civile inexistante est refusée');
const second = store.createDossier({
  clientName: 'Dossier, autre', clientCode: 'AUT', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(second.ok, true, 'une virgule dans le nom reste acceptée');
assert.equal(second.dossier.address, '', 'l’adresse est facultative');
assert.equal(second.dossier.ifu, '', 'le N° IFU est facultatif');
assert.equal(second.dossier.rccm, '', 'le N° RCCM est facultatif');
assert.equal(second.dossier.email, '', 'l’email est facultatif');
assert.equal(second.dossier.phone, '', 'le téléphone est facultatif');

const switched = store.switchDossier(created.dossier.id);
assert.equal(switched.ok, true);
assert.equal(store.currentDossier().name, 'Cabinet Godwin');
assert.equal(store.entries().length, 0, 'un nouveau dossier est vide, sans recopier les écritures du principal');
assert.equal(store.accounts().length, STANDARD_ACCOUNT_COUNT, 'le plan complet est disponible dans un nouveau dossier');
assert.equal(store.exercise(), 2026);
assert.equal(store.periodStats(2026).length, 12, 'le cycle juillet 2026 — juin 2027 contient ses 12 périodes civiles');
assert.equal(store.periodStats(2027).length, 0, 'la liste de périodes est rattachée à l’exercice sélectionné');
assert.equal(store.suppliers().length, 0, 'le nouveau dossier démarre sans fournisseurs hérités d’un autre dossier');
assert.equal(store.clients().length, 0, 'le nouveau dossier démarre sans clients hérités d’un autre dossier');
const entriesBeforeSupplier = store.entries().length;
const supplier = store.createSupplier({
  code: 'four-001', name: 'Fournitures du Littoral SARL', ifu: 'IFU-FOUR-001', rccm: 'RB/COT/26 B 12345',
  contactName: 'Aïcha Mensah', email: 'contact@fournitures.bj', phone: '+229 01 23 45 67',
  address: 'Cotonou, Bénin', accountCode: '401', paymentTermDays: 30, notes: 'Livraison à convenir'
});
assert.equal(supplier.ok, true, supplier.errors.join(' '));
assert.equal(store.entries().length, entriesBeforeSupplier, 'la fiche fournisseur ne crée aucune écriture comptable');
assert.equal(supplier.supplier.code, 'FOUR-001', 'le code est nettoyé et normalisé en majuscules');
assert.equal(supplier.supplier.auxiliaryAccountCode, '401-FOUR-001', 'le compte auxiliaire individuel associe le compte général et le code fournisseur');
assert.equal(store.supplier('four-001').id, supplier.supplier.id, 'la recherche fournisseur accepte le code sans sensibilité à la casse');
assert.equal(store.createSupplier({ code: 'FOUR-001', name: 'Doublon', accountCode: '401' }).ok, false, 'le code est unique dans le dossier');
assert.equal(store.createSupplier({ code: 'FOUR-002', name: 'E-mail invalide', accountCode: '401', email: 'adresse invalide' }).ok, false);
assert.equal(store.createSupplier({ code: 'FOUR-003', name: 'Compte non auxiliaire', accountCode: '521' }).ok, false);
assert.equal(store.createSupplier({ code: 'FOUR-004', name: 'Compte client incorrect', accountCode: '411' }).ok, false, 'un compte auxiliaire client ne peut pas être choisi pour un fournisseur');
const entriesBeforeClient = store.entries().length;
const clientRecord = store.createClient({
  name: 'Client de démonstration', accountCode: '411', ifu: 'IFU-CLI-001', contactName: 'Yvette Hounkpe'
});
assert.equal(clientRecord.ok, true, clientRecord.errors.join(' '));
assert.equal(clientRecord.client.code, 'CLI-0001', 'la séquence client est isolée et commence dans ce dossier');
assert.equal(clientRecord.client.auxiliaryAccountCode, '411-CLI-0001');
assert.equal(store.entries().length, entriesBeforeClient, 'la fiche client ne crée aucune écriture');
const supplierEdit = store.updateSupplier(supplier.supplier.id, {
  ...supplier.supplier, name: 'Fournitures du Littoral', paymentTermDays: 45, accountCode: '401'
});
assert.equal(supplierEdit.ok, true, supplierEdit.errors.join(' '));
assert.equal(store.supplier(supplier.supplier.id).name, 'Fournitures du Littoral');
assert.equal(store.supplier(supplier.supplier.id).paymentTermDays, 45);
assert.equal(store.setSupplierActive(supplier.supplier.id, false).supplier.active, false, 'l’archivage conserve la fiche');
assert.equal(store.suppliers().length, 1);
assert.equal(store.setSupplierActive(supplier.supplier.id, true).supplier.active, true, 'une fiche archivée peut être réactivée');
storageWritesBlocked = true;
const failedSupplierSave = store.createSupplier({ code: 'FOUR-FAIL', name: 'Ne doit pas être sauvegardé', accountCode: '401' });
storageWritesBlocked = false;
assert.equal(failedSupplierSave.ok, false, 'une panne de stockage annule la création');
assert.equal(store.suppliers().length, 1, 'une création non persistée est retirée de l’état en mémoire');
const outsideCycle = store.validateEntry({
  reference: 'OD-2026-OUT', journal: 'OD', date: '2026-06-30', description: 'Hors cycle',
  lines: [{ account: '601', debit: 1000, credit: 0 }, { account: '401', debit: 0, credit: 1000 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(outsideCycle.ok, false, 'les écritures avant le début du cycle sont refusées');
assert(outsideCycle.errors.some(error => error.includes('cycle du dossier')));
const entry = store.createEntry({
  reference: 'OD-2027-001', journal: 'OD', date: '2027-01-15', description: 'Cabinet Godwin',
  lines: [{ account: '601', debit: 1000, credit: 0 }, { account: '401', debit: 0, credit: 1000 }]
}, 'posted');
assert.equal(entry.ok, true, 'une période du cycle peut se situer dans l’année civile suivante');
assert.equal(store.entries().length, 1);
assert.equal(store.backupInfo().available, true, 'la première écriture crée un point propre à ce dossier');
assert.equal(store.backupInfo().entryCount, 0);
assert.equal(store.addAccount({ code: '602200', label: 'Test Cabinet Godwin', nature: 'Charge' }).ok, true);
assert.equal(store.backupInfo().available, true);
assert.equal(store.backupInfo().entryCount, 1);

assert.equal(store.switchDossier(main.id).ok, true);
assert.equal(store.entries().length, 4, 'le changement de dossier restaure les données principales');
assert.equal(store.backupInfo().available, true, 'la migration du dossier principal a créé son propre point de restauration');
assert.equal(store.backupInfo().entryCount, 4, 'le point local du dossier principal ne reprend pas les données du dossier client');
assert.equal(store.switchDossier(created.dossier.id).ok, true);
assert.equal(store.entries().length, 1, 'les écritures restent persistées dans leur propre dossier');
assert.equal(store.accounts().length, STANDARD_ACCOUNT_COUNT + 1);
assert.equal(store.restoreBackup().ok, true);
assert.equal(store.accounts().length, STANDARD_ACCOUNT_COUNT, 'la restauration remplace uniquement les données du dossier actif');
assert.equal(store.entries().length, 1);
assert.equal(store.suppliers().length, 1, 'le point de restauration contient le référentiel fournisseur du dossier');
assert.equal(store.suppliers()[0].active, true);
assert.equal(store.clients().length, 1, 'le point de restauration contient aussi le répertoire clients');
assert.equal(store.clients()[0].name, 'Client de démonstration');

assert.equal(store.switchDossier(main.id).ok, true);
assert.equal(store.suppliers().length, 0, 'le référentiel du nouveau dossier ne fuit pas vers le dossier principal');
assert.equal(store.clients().length, 0, 'le répertoire clients du nouveau dossier ne fuit pas vers le dossier principal');
assert.equal(store.switchDossier(created.dossier.id).ok, true);
assert.equal(store.suppliers().length, 1, 'le fournisseur revient en sélectionnant son dossier');
assert.equal(store.clients().length, 1, 'le client revient en sélectionnant son dossier');

store = loadStore();
assert.equal(store.currentDossier().id, created.dossier.id, 'la sélection de dossier est conservée localement');
assert.equal(store.currentDossier().address, 'Rue des finances, Cotonou', 'les informations client survivent au rechargement');
assert.equal(store.currentDossier().ifu, 'IFU-GOD-2026');
assert.equal(store.currentDossier().rccm, 'RB/COT/26 A 12345');
assert.equal(store.currentDossier().email, 'contact@godwin.bj');
assert.equal(store.currentDossier().phone, '+229 01 02 03 04');
assert.equal(store.entries().length, 1, 'les données du dossier survivent au rechargement');
assert.equal(store.accounts().length, STANDARD_ACCOUNT_COUNT);
assert.equal(store.suppliers().length, 1, 'le référentiel fournisseurs survit au rechargement');
assert.equal(store.suppliers()[0].name, 'Fournitures du Littoral');
assert.equal(store.suppliers()[0].accountCode, '401');
assert.equal(store.suppliers()[0].auxiliaryAccountCode, '401-FOUR-001');
assert.equal(store.clients().length, 1, 'le répertoire clients survit au rechargement');
assert.equal(store.clients()[0].name, 'Client de démonstration');
assert.equal(store.clients()[0].accountCode, '411');
assert.deepEqual(store.dossiers().map(dossier => dossier.name), ['Entreprise de démonstration', 'Cabinet Godwin', 'Dossier, autre']);
console.log('Dossiers, clients et fournisseurs : migration, cycle, persistance et isolation — OK');
