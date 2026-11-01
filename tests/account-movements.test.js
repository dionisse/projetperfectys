'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const movements = require('../modern-proto/js/account-movements.js');

const accounts = [
  { code: '101', cls: 1, classLabel: 'Ressources durables', subclass: '10', subclassLabel: 'Capital', label: 'Capital social' },
  { code: '401', cls: 4, classLabel: 'Tiers', subclass: '40', subclassLabel: 'Fournisseurs et comptes rattachés', label: 'Fournisseurs', aux: true },
  { code: '411', cls: 4, classLabel: 'Tiers', subclass: '41', subclassLabel: 'Clients et comptes rattachés', label: 'Clients', aux: true },
  { code: '512', cls: 5, classLabel: 'Trésorerie', subclass: '51', subclassLabel: 'Banques', label: 'Banque' }
];
const auxiliaries = [
  { id: 'supplier:s1', thirdPartyId: 's1', thirdPartyType: 'supplier', type: 'Fournisseur', code: 'FOU-001', auxiliaryAccountCode: '401-FOU-001', accountCode: '401', label: 'Fournisseur Un', active: true },
  { id: 'supplier:s2', thirdPartyId: 's2', thirdPartyType: 'supplier', type: 'Fournisseur', code: 'FOU-002', auxiliaryAccountCode: '401-FOU-002', accountCode: '401', label: 'Fournisseur Deux', active: true },
  { id: 'client:c1', thirdPartyId: 'c1', thirdPartyType: 'client', type: 'Client', code: 'CLI-001', auxiliaryAccountCode: '411-CLI-001', accountCode: '411', label: 'Client Alpha', active: true }
];
const tree = movements.buildTree(accounts, auxiliaries);
const flat = movements.flattenTree(tree);

assert.ok(flat.some(node => node.id === 'class:4' && node.label === 'Tiers'));
assert.ok(flat.some(node => node.id === 'account:401' && node.hasAuxiliaries));
assert.ok(flat.some(node => node.kind === 'auxiliary' && node.label === 'Fournisseur Un'));
assert.deepEqual(flat.find(node => node.id === 'class:4').accountCodes, ['401', '411']);

const generalTree = movements.filterTree(tree, 'fournisseurs', 'general');
const generalRows = movements.flattenTree(generalTree);
assert.ok(generalRows.some(node => node.id === 'account:401'));
assert.ok(!generalRows.some(node => node.kind === 'auxiliary'));
assert.ok(movements.flattenTree(movements.filterTree(tree, 'FOU-001', 'auxiliary')).some(node => node.kind === 'auxiliary'));
assert.deepEqual(
  movements.flattenTree(movements.filterTree(tree, 'FOU-001', 'auxiliary')).find(node => node.id === 'account:401').accountCodes,
  ['401'],
  'un filtre auxiliaire garde le compte collectif parent sans agréger les comptes voisins'
);

const periods = [
  { year: 2026, month: 1, status: 'open' },
  { year: 2026, month: 2, status: 'closed' }
];
const entries = [
  {
    id: 'p1', status: 'posted', date: '2026-01-12', reference: 'AC-001', journal: 'AC', description: 'Facture fournisseur',
    lines: [
      { account: '401', debit: 100, credit: 0 },
      { account: '411', debit: 0, credit: 100 }
    ]
  },
  {
    id: 'p2', status: 'posted', date: '2026-02-03', reference: 'BQ-001', journal: 'BQ', description: 'Règlement',
    lines: [{ account: '401', debit: 20, credit: 0 }]
  },
  {
    id: 'd1', status: 'draft', date: '2026-01-20', reference: 'AC-002', journal: 'AC', description: 'Brouillon fournisseur',
    lines: [{ account: '401', debit: 40, credit: 0 }]
  },
  {
    id: 'd2', status: 'draft', date: '2026-01-21', reference: 'AC-003', journal: 'AC', description: 'Brouillon hors compte',
    lines: [{ account: '101', debit: 50, credit: 0 }]
  },
  {
    id: 'p3', status: 'posted', date: '2026-03-01', reference: 'AC-004', journal: 'AC', description: 'Hors cycle',
    lines: [{ account: '401', debit: 900, credit: 0 }]
  },
  {
    id: 'p4', status: 'posted', date: '2026-01-25', reference: 'BQ-002', journal: 'BQ', description: 'Autre compte',
    lines: [{ account: '512', debit: 70, credit: 0 }]
  }
];
const dossierAccounts = movements.buildTree(accounts, auxiliaries);
const supplierAccount = movements.flattenTree(dossierAccounts).find(node => node.id === 'account:401');
const januarySummary = movements.monthlySummary(supplierAccount, entries, periods, '2026-01-01', '2026-02-28');
assert.equal(januarySummary.available, true);
assert.equal(januarySummary.months[0].lines, 1);
assert.equal(januarySummary.months[0].debit, 100);
assert.equal(januarySummary.months[0].drafts, 1);
assert.equal(januarySummary.months[1].lines, 1);
assert.equal(januarySummary.totalLines, 2);
assert.equal(januarySummary.debit, 120);
assert.equal(januarySummary.credit, 0);
assert.equal(januarySummary.closingBalance, 120);
assert.equal(januarySummary.months[1].status, 'closed');

const janDetails = movements.detailRows(supplierAccount, entries, accounts, '2026-01-01', '2026-02-28', '2026-01');
assert.equal(janDetails.rows.length, 1);
assert.equal(janDetails.rows[0].reference, 'AC-001');
assert.equal(janDetails.rows[0].accountLabel, 'Fournisseurs');
assert.equal(janDetails.debit, 100);

const auxiliaryNode = movements.flattenTree(dossierAccounts).find(node => node.kind === 'auxiliary' && node.thirdPartyId === 's1');
assert.equal(auxiliaryNode.thirdPartyType, 'supplier');
const unlinkedSummary = movements.monthlySummary(auxiliaryNode, entries, periods, '2026-01-01', '2026-02-28');
assert.equal(unlinkedSummary.available, true);
assert.equal(unlinkedSummary.totalLines, 0, 'les mouvements au seul compte collectif ne sont pas attribués à la fiche.');
assert.equal(unlinkedSummary.debit, 0);
assert.equal(unlinkedSummary.unattributedLineCount, 2);
assert.equal(movements.detailRows(auxiliaryNode, entries, accounts, '2026-01-01', '2026-02-28').rows.length, 0);

const individuallyLinkedEntries = entries.concat([
  { id: 'p5', status: 'posted', date: '2026-01-28', reference: 'AC-005', journal: 'AC', description: 'Facture liée au fournisseur Un', lines: [
    { account: '401', debit: 35, credit: 0, thirdPartyType: 'supplier', thirdPartyId: 's1' }, { account: '512', debit: 0, credit: 35 }
  ] },
  { id: 'p6', status: 'posted', date: '2026-01-29', reference: 'AC-006', journal: 'AC', description: 'Facture fournisseur Deux', lines: [
    { account: '401', debit: 0, credit: 12, thirdPartyType: 'supplier', thirdPartyId: 's2' }, { account: '512', debit: 12, credit: 0 }
  ] },
  { id: 'd3', status: 'draft', date: '2026-01-30', reference: 'AC-007', journal: 'AC', description: 'Brouillon lié', lines: [
    { account: '401', debit: 9, credit: 0, thirdPartyType: 'supplier', thirdPartyId: 's1' }
  ] }
]);
const individualSummary = movements.monthlySummary(auxiliaryNode, individuallyLinkedEntries, periods, '2026-01-01', '2026-02-28');
assert.equal(individualSummary.available, true);
assert.equal(individualSummary.months[0].lines, 1);
assert.equal(individualSummary.months[0].debit, 35);
assert.equal(individualSummary.months[0].credit, 0);
assert.equal(individualSummary.months[0].drafts, 1);
assert.equal(individualSummary.totalLines, 1);
assert.equal(individualSummary.debit, 35);
assert.equal(individualSummary.credit, 0);
assert.equal(individualSummary.closingBalance, 35, 'le net est le débit moins le crédit des seuls mouvements liés.');
const individualDetails = movements.detailRows(auxiliaryNode, individuallyLinkedEntries, accounts, '2026-01-01', '2026-02-28', '2026-01');
assert.equal(individualDetails.available, true);
assert.equal(individualDetails.rows.length, 1);
assert.equal(individualDetails.rows[0].reference, 'AC-005');
assert.equal(individualDetails.rows[0].thirdPartyId, 's1');
assert.equal(individualDetails.debit, 35);

const missingIdentityNode = Object.assign({}, auxiliaryNode, { thirdPartyId: '' });
assert.equal(movements.monthlySummary(missingIdentityNode, individuallyLinkedEntries, periods, '2026-01-01', '2026-02-28').available, false);
assert.equal(movements.detailRows(missingIdentityNode, individuallyLinkedEntries, accounts, '2026-01-01', '2026-02-28').available, false);

const localStorageData = {};
const sandbox = {
  window: {},
  localStorage: {
    getItem: key => Object.prototype.hasOwnProperty.call(localStorageData, key) ? localStorageData[key] : null,
    setItem: (key, value) => { localStorageData[key] = String(value); },
    removeItem: key => { delete localStorageData[key]; }
  },
  Intl, console, JSON, Date, Math, String, Number, Object, Array
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.global = sandbox;
vm.createContext(sandbox);
for (const source of ['accounting-chart.js', 'store.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', source), 'utf8'), sandbox, { filename: source });
}
const store = sandbox.window.PerfectoStore;
const demoTree = movements.buildTree(store.accounts(), []);
const demoNodes = movements.flattenTree(demoTree);
const demoPeriods = store.periodStats(store.exercise());
const dossier = store.currentDossier();
for (const account of store.accounts()) {
  const node = demoNodes.find(item => item.id === 'account:' + account.code);
  const monthly = movements.monthlySummary(node, store.postedEntries(), demoPeriods, dossier.cycleStart, dossier.cycleEnd);
  const ledger = store.ledger(account.code);
  assert.equal(monthly.totalLines, ledger.rows.length, 'les lignes mensuelles du compte ' + account.code + ' correspondent au grand livre');
  assert.equal(monthly.debit, ledger.debit, 'le débit mensuel du compte ' + account.code + ' correspond au grand livre');
  assert.equal(monthly.credit, ledger.credit, 'le crédit mensuel du compte ' + account.code + ' correspond au grand livre');
}

const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
assert.match(appSource, /thirdPartyType: type === 'Tiers divers'[\s\S]*thirdPartyId: String\(record\.id \|\| ''\)/);
assert.match(appSource, /function getThirdPartyMovementsContext\([\s\S]*thirdPartyId: selected\.recordId[\s\S]*monthlySummary\(auxiliaryNode/);
assert.match(appSource, /function openThirdPartyIndividualDetail\([\s\S]*detailRows\(context\.auxiliaryNode/);
assert.match(appSource, /Seules les lignes validées portant l’identifiant de cette fiche/);
assert.doesNotMatch(appSource, /Mouvements individuels non disponibles/);

console.log('Comptes et tiers : l’arbre auxiliaire filtre les mouvements validés par identifiant explicite, avec totaux séparés et exclusions visibles.');
