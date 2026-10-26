/* Modèles de consultation des Tiers et du Plan des journaux. */
'use strict';

const assert = require('node:assert/strict');
const Reports = require('../modern-proto/js/definitions-plans-edition-reports.js');

assert.deepEqual(Reports.NATURES.map(item => [item.key, item.label]), [
  ['suppliers', 'Fournisseurs'], ['clients', 'Clients'], ['personnel', 'Personnel'], ['otherParties', 'Tiers Divers']
]);
assert.deepEqual(Reports.THIRD_PARTY_COLUMNS.map(item => [item.key, item.label, item.defaultSelected]), [
  ['code', 'Code du tiers', true], ['label', 'Intitulé', true], ['address', 'Adresse', true], ['otherInformation', 'Autres informations', true]
]);
assert.deepEqual(Reports.JOURNAL_COLUMNS.map(item => [item.key, item.label, item.defaultSelected]), [
  ['code', 'Code', true], ['label', 'Intitulé', true], ['closure', 'Clôture', true]
]);

const supplier = { code: 'FOU-01', name: 'Fournisseur test', address: 'Rue du Port', contactName: 'Contact', phone: '+229 00 00', email: 'test@example.org', ifu: 'IFU-1', rccm: 'RCCM-1', auxiliaryAccountCode: '401FOU-01', paymentTermDays: 30 };
const client = { code: 'CLI-02', name: 'Client test', address: 'Rue du Marché', contactName: 'Accueil' };
const staff = { code: 'PER-03', name: 'Membre test', address: 'Quartier', jobTitle: 'Comptable', department: 'Finance' };
const other = { code: 'DEB-04', name: 'Tiers test', address: 'Rue 4', type: 'debtor' };
const recordsBefore = JSON.stringify([supplier, client, staff, other]);

const allSuppliers = Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [supplier] }, filter: '*' });
assert.equal(allSuppliers.ok, true);
assert.equal(allSuppliers.generatedLineCount, 2);
assert.equal(allSuppliers.natureLabel, 'Fournisseurs');
assert.deepEqual(allSuppliers.columns.map(column => column.key), ['code', 'label', 'address', 'otherInformation']);
assert.deepEqual(allSuppliers.rows[0], {
  code: 'FOU-01', label: 'Fournisseur test', address: 'Rue du Port',
  otherInformation: 'Contact : Contact · Téléphone : +229 00 00 · E-mail : test@example.org · IFU : IFU-1 · RCCM : RCCM-1 · Compte auxiliaire : 401FOU-01 · Délai de paiement : 30 jour(s)'
});
assert.equal(Reports.buildThirdPartiesReport({ nature: 'clients', collections: { clients: [client] } }).rows[0].otherInformation, 'Contact : Accueil');
assert.equal(Reports.buildThirdPartiesReport({ nature: 'personnel', collections: { personnel: [staff] } }).rows[0].otherInformation, 'Fonction : Comptable · Service : Finance');
assert.equal(Reports.buildThirdPartiesReport({ nature: 'otherParties', collections: { otherParties: [other] } }).rows[0].otherInformation, 'Nature : Débiteur divers');
assert.equal(Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [supplier] }, filter: 'FOU*' }).rows.length, 1);
assert.equal(Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [supplier] }, filter: 'CLI*' }).rows.length, 0);
assert.equal(Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [supplier] }, filter: '' }).rows.length, 0);
assert.equal(Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [supplier] }, columns: { code: true, label: false, address: false, otherInformation: false } }).columns.length, 1);
assert.equal(Reports.buildThirdPartiesReport({ nature: 'suppliers', collections: { suppliers: [] } }).generatedLineCount, 0);

const journals = [
  { code: 'ACH', label: 'Achats', systemManaged: false },
  { code: 'AUTO', label: 'Automatique', systemManaged: true },
  { code: 'USR', label: 'Créé dans le dossier', origin: 'user' },
  { code: 'OLD', label: 'Historique retiré', retired: true }
];
const journalReport = Reports.buildJournalsReport({ records: journals, filter: '*' });
assert.deepEqual(journalReport.rows.map(row => row.code), ['ACH', 'AUTO', 'USR']);
assert.equal(journalReport.generatedLineCount, 4);
assert.equal(journalReport.rows[0].closure, '', 'ne pas inventer une clôture propre au journal');
assert.equal(journalReport.closureSourceAvailable, false);
assert.deepEqual(Reports.buildJournalsReport({ records: [{ code: 'ACH', label: 'Achats', closed: true }] }).rows[0], { code: 'ACH', label: 'Achats', closure: 'Clôturé' });
assert.equal(Reports.buildJournalsReport({ records: journals, filter: 'AUTO,USR' }).rows.length, 2);
assert.equal(Reports.buildJournalsReport({ records: [] }).generatedLineCount, 0);
assert.equal(JSON.stringify([supplier, client, staff, other]), recordsBefore, 'lecture seule : les référentiels ne sont pas modifiés');

console.log('Éditions Tiers et Plan des journaux : natures, filtres, colonnes, compteurs et lecture seule vérifiés.');
