/* Informations communes aux états imprimés : référentiel unique, configuration par dossier et sauvegarde prudente. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

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

const store = loadStore();
const initialEntryCount = store.entries().length;
const initialAccountCount = store.accounts().length;
const initial = store.printedReportInformationConfiguration();

const permissionSandbox = { window: {} };
vm.createContext(permissionSandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'permissions.js'), 'utf8'), permissionSandbox, { filename: 'permissions.js' });
const permissions = permissionSandbox.window.PerfectoPermissions;
const permissionContext = { organizationId: 'demo-org', scopeType: 'dossier', dossierId: 'folder-main' };
const memberWithoutGrant = { role: 'member', organizationId: 'demo-org', grants: {} };
assert.equal(permissions.hasPermission(memberWithoutGrant, 'accounting', 'accounting.configure', permissionContext), false, 'la configuration reste refusée sans délégation explicite');
const memberWithoutView = {
  role: 'member', organizationId: 'demo-org',
  grants: { accounting: [{ actions: ['accounting.configure'], scope: { type: 'dossier', dossiers: ['folder-main'] } }] }
};
assert.equal(permissions.hasPermission(memberWithoutView, 'accounting', 'accounting.configure', permissionContext), false, 'la délégation doit inclure la consultation du même périmètre');
const configuredMember = {
  role: 'member', organizationId: 'demo-org',
  grants: { accounting: [{ actions: ['module.view', 'accounting.configure'], scope: { type: 'dossier', dossiers: ['folder-main'] } }] }
};
assert.equal(permissions.hasPermission(configuredMember, 'accounting', 'accounting.configure', permissionContext), true, 'la délégation explicite autorise le dossier prévu');
assert.equal(permissions.hasPermission(configuredMember, 'accounting', 'accounting.configure', { ...permissionContext, dossierId: 'another-folder' }), false, 'la permission ne s’étend pas à un autre dossier');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
assert.match(appSource, /function viewPrintedReportInformation\(\)[\s\S]*'accounting\.configure'[\s\S]*function bindPrintedReportInformation\(\)[\s\S]*'accounting\.configure'/);
assert.match(appSource, /case 'save-printed-report-information':[\s\S]*actionId: 'accounting\.configure'/);
const dataRows = initial.rows.filter(row => !row.separator);
const labels = dataRows.map(row => row.label);
const ids = initial.rows.map(row => row.id);
assert.equal(initial.rows.length, 39, '35 rubriques et quatre séparateurs sont affichés une seule fois');
assert.equal(dataRows.length, 35, 'la liste fusionnée contient exactement 35 champs');
assert.equal(initial.rows.filter(row => row.separator).length, 4, 'les cinq sections restent séparées par quatre traits');
assert.equal(new Set(ids).size, ids.length, 'chaque ligne, séparateurs compris, a un identifiant unique');
assert.equal(new Set(labels.map(label => label.toLocaleLowerCase('fr'))).size, labels.length, 'aucune rubrique n’est dupliquée');
assert.deepEqual(labels.slice(0, 10), [
  'Raison sociale (nom de la licence)', 'Sigle/Enseigne commerciale', 'Téléphone', 'Numéro INSAE',
  'Numéro IFU', 'Greffe', 'Numéro Registre du Commerce', 'Code Activité', 'Activité principale', 'Code importateur'
]);
assert.deepEqual(labels.slice(10, 16), ['Adresse - Siège', 'Et secondaire 1', 'Et secondaire 2', 'Code BP', 'Boîte postale', 'Ville BP']);
assert.deepEqual(labels.slice(16, 19), ['Ville du centre des impôts', 'Signataire des déclarations fiscales', 'Ville de signature']);
assert.deepEqual(labels.slice(19, 29), [
  'Titre <Le Directeur Général>', 'Nom du D.G.', 'Titre <Le Directeur Administratif>', 'Nom du D.A.',
  'Titre <Le Directeur Financier>', 'Nom du D.F.', 'Titre <Le Chef comptable>', 'Nom du C.C.',
  'Personne à contacter', 'Personnel salarié /cabinet'
]);
assert.deepEqual(labels.slice(29), ['Banque 1', 'N° compte banque1', 'Banque 2', 'N° Compte banque 2', 'Banque 3', 'N° Compte banque 3']);
assert.equal(initial.rows.find(row => row.id === 'general-manager-title').value, 'Le Directeur Général');
assert.equal(initial.rows.find(row => row.id === 'administrative-manager-title').value, 'Le Directeur Administratif');
assert.equal(initial.rows.find(row => row.id === 'financial-manager-title').value, 'Le Directeur Financier');
assert.equal(initial.rows.find(row => row.id === 'chief-accountant-title').value, 'Le Chef comptable');
assert.equal(initial.rows.find(row => row.id === 'company-name').value, '', 'aucune raison sociale d’exemple n’est préremplie');
assert.ok(dataRows.every(row => typeof row.value === 'string'));

const valuesToSave = Object.fromEntries(dataRows.map(row => [row.id, row.value]));
valuesToSave['company-name'] = 'Entreprise de test';
valuesToSave['phone'] = '+229 00 00 00 00';
valuesToSave['general-manager-name'] = 'Nom de test';
valuesToSave['bank-1-account'] = 'Compte de test';
const saved = store.savePrintedReportInformationConfiguration({ values: valuesToSave });
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, 'Entreprise de test');
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'general-manager-title').value, 'Le Directeur Général');
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'bank-1-account').value, 'Compte de test');
const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.equal(persistedCatalog[0].printedReportInformationConfiguration.rows.find(row => row.id === 'company-name').value, 'Entreprise de test');

const reloaded = loadStore();
assert.equal(reloaded.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, 'Entreprise de test', 'les valeurs survivent au rechargement');
assert.equal(reloaded.printedReportInformationConfiguration().rows.length, 39, 'le rechargement restaure toujours la nomenclature canonique unique');

const corruptedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
const mainDossier = corruptedCatalog.find(dossier => dossier.id === 'folder-main');
mainDossier.printedReportInformationConfiguration.rows.push(
  { id: 'company-name', label: 'Raison sociale dupliquée', value: 'Valeur à ignorer' },
  { id: 'rubrique-inconnue', label: 'Rubrique à ignorer', value: 'Valeur à ignorer' }
);
values.set('perfecto.dossiers.v1', JSON.stringify(corruptedCatalog));
const deduplicated = loadStore().printedReportInformationConfiguration();
assert.equal(deduplicated.rows.length, 39, 'une source qui répète des éléments ne fait pas apparaître de doublons dans le tableau');
assert.equal(deduplicated.rows.filter(row => row.id === 'company-name').length, 1);
assert.equal(deduplicated.rows.find(row => row.id === 'company-name').value, 'Entreprise de test', 'la première valeur canonique est conservée');
assert.ok(!deduplicated.rows.some(row => row.id === 'rubrique-inconnue'));

const missing = { ...valuesToSave };
delete missing['company-name'];
assert.equal(store.savePrintedReportInformationConfiguration({ values: missing }).ok, false, 'une sauvegarde incomplète est refusée');
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, 'Entreprise de test', 'un rejet ne modifie pas les valeurs enregistrées');
assert.equal(store.savePrintedReportInformationConfiguration({ values: { ...valuesToSave, 'champ-inconnu': 'x' } }).ok, false, 'un champ imprévu ne peut pas être ajouté');
assert.equal(store.savePrintedReportInformationConfiguration({ values: { ...valuesToSave, phone: ['229'] } }).ok, false, 'les valeurs doivent rester du texte');
assert.equal(store.savePrintedReportInformationConfiguration({ values: { ...valuesToSave, phone: 'x'.repeat(501) } }).ok, false, 'une valeur de plus de 500 caractères est refusée');

const second = store.createDossier({
  clientName: 'Dossier imprimés isolé', clientCode: 'PRI', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(second.ok, true, second.errors && second.errors.join(' '));
assert.equal(store.switchDossier(second.dossier.id).ok, true);
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, '', 'un nouveau dossier ne reprend aucune valeur d’un autre');
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'general-manager-title').value, 'Le Directeur Général', 'les valeurs de titre par défaut sont communes à chaque nouveau dossier');
assert.equal(store.switchDossier(store.dossiers()[0].id).ok, true);
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, 'Entreprise de test');

storageWritesBlocked = true;
const failed = store.savePrintedReportInformationConfiguration({ values: { ...valuesToSave, 'company-name': 'Nouvelle valeur' } });
storageWritesBlocked = false;
assert.equal(failed.ok, false, 'une panne de stockage fait échouer la validation');
assert.equal(store.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, 'Entreprise de test', 'les valeurs antérieures restent intactes après un échec');
assert.equal(store.entries().length, initialEntryCount, 'le paramétrage ne crée aucune écriture');
assert.equal(store.accounts().length, initialAccountCount, 'le paramétrage ne modifie pas le plan comptable');

const legacyCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
legacyCatalog.forEach(dossier => { delete dossier.printedReportInformationConfiguration; });
values.set('perfecto.dossiers.v1', JSON.stringify(legacyCatalog));
const migrated = loadStore();
assert.equal(migrated.printedReportInformationConfiguration().rows.length, 39, 'les dossiers existants sans ce champ reçoivent la nomenclature canonique');
assert.equal(migrated.printedReportInformationConfiguration().rows.find(row => row.id === 'company-name').value, '', 'la migration ne préremplit pas de donnée d’entreprise d’exemple');

console.log('  ✓ Les 35 rubriques uniques sont dédoublonnées, isolées par dossier et persistées sans écriture comptable.');
