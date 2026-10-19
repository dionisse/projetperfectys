/* Règles des opérations de caisse rapide, sans DOM ni dépendance externe. */
'use strict';

const assert = require('node:assert/strict');
const Cash = require('../modern-proto/js/cash-operations.js');

const accounts = [
  { code: '521100', label: 'Banques locales', cls: 5, active: true, postable: true },
  { code: '571000', label: 'Caisse siège social', cls: 5, active: true, postable: true },
  { code: '572000', label: 'Caisse succursale', cls: 5, active: true, postable: true },
  { code: '571900', label: 'Ancienne caisse', cls: 5, active: false, postable: true },
  { code: '572900', label: 'Rubrique de caisse', cls: 5, active: true, postable: false },
  { code: '401100', label: 'Fournisseurs', cls: 4, active: true, postable: true },
  { code: '601100', label: 'Achats de marchandises', cls: 6, active: true, postable: true }
];

assert.deepEqual(Cash.cashAccounts(accounts).map(account => account.code), ['571000', '572000']);
assert.equal(Cash.isCashCode('581000'), false, 'le compte de virements de fonds n’est pas une caisse physique');

const entries = [
  { id: 'posted-before', date: '2026-01-02', journal: 'OD', status: 'posted', lines: [{ account: '571000', debit: 100000, credit: 0 }] },
  { id: 'cash-receipt', date: '2026-01-10', journal: 'CA', reference: 'CA-2026-001', description: 'Vente comptant', status: 'posted', lines: [{ account: '571000', debit: 25000, credit: 0 }, { account: '706000', debit: 0, credit: 25000 }] },
  { id: 'cash-draft', date: '2026-01-11', journal: 'CA', reference: 'CA-2026-002', description: 'Brouillon non validé', status: 'draft', lines: [{ account: '571000', debit: 90000, credit: 0 }, { account: '706000', debit: 0, credit: 90000 }] },
  { id: 'cash-future', date: '2026-01-20', journal: 'CA', status: 'posted', lines: [{ account: '571000', debit: 0, credit: 10000 }] },
  { id: 'bank-only', date: '2026-01-10', journal: 'BQ', status: 'posted', lines: [{ account: '521100', debit: 300000, credit: 0 }] }
];

const balances = Cash.cashBalances(accounts, entries, '2026-01-01', '2026-12-31', '2026-01-15');
assert.equal(balances.find(row => row.code === '571000').balance, 125000, 'les soldes partent de tous les journaux et excluent brouillons/futur');
assert.equal(balances.find(row => row.code === '572000').balance, 0, 'les comptes de caisse sans mouvement restent visibles à zéro');

const movements = Cash.movementRecords(entries, accounts, '2026-01-01', '2026-12-31');
assert.deepEqual(movements.map(record => record.id), ['cash-future', 'cash-draft', 'cash-receipt']);
assert.equal(movements.find(record => record.id === 'cash-draft').status, 'draft');
assert.equal(movements.find(record => record.id === 'cash-receipt').direction, 'Encaissement');
assert.equal(movements.find(record => record.id === 'cash-receipt').counterpartAccounts[0].label, '706000');

const receipt = Cash.buildEntry({
  direction: 'receipt', cashAccount: '571000', counterpartAccount: '706000',
  amount: '12000', reference: 'CA-2026-003', date: '2026-01-15', description: 'Encaissement client'
}, accounts.concat({ code: '706000', label: 'Prestations de services', cls: 7, active: true, postable: true }));
assert.equal(receipt.ok, true);
assert.deepEqual(receipt.entry.lines, [
  { account: '571000', debit: 12000, credit: 0 },
  { account: '706000', debit: 0, credit: 12000 }
]);

const disbursement = Cash.buildEntry({
  direction: 'disbursement', cashAccount: '571000', counterpartAccount: '401100',
  amount: 8000, reference: 'CA-2026-004', date: '2026-01-15', description: 'Règlement fournisseur'
}, accounts);
assert.equal(disbursement.ok, true);
assert.deepEqual(disbursement.entry.lines, [
  { account: '571000', debit: 0, credit: 8000 },
  { account: '401100', debit: 8000, credit: 0 }
]);

const invalidAmount = Cash.buildEntry({
  direction: 'receipt', cashAccount: '571000', counterpartAccount: '401100',
  amount: 1.5, reference: 'CA-2026-005', date: '2026-01-15', description: 'Montant fractionnaire'
}, accounts);
assert.equal(invalidAmount.ok, false);
assert.ok(invalidAmount.errors.some(error => error.includes('nombre entier')));

const invalidTransfer = Cash.buildEntry({
  direction: 'receipt', cashAccount: '571000', counterpartAccount: '572000',
  amount: 100, reference: 'CA-2026-006', date: '2026-01-15', description: 'Transfert entre caisses'
}, accounts);
assert.equal(invalidTransfer.ok, false);
assert.ok(invalidTransfer.errors.some(error => error.includes('transfert entre caisses')));

console.log('Opérations de caisse : soldes validés, mouvements et écritures équilibrées — OK');
