/* Tests métier du journal groupé « Consolidation avant résultat ». */
'use strict';

const assert = require('node:assert/strict');
const { consolidate, validIsoDate } = require('../modern-proto/js/accounting-consolidation.js');

const accounts = [
  { code: '401100', label: 'Fournisseurs' },
  { code: '421000', label: 'Rémunérations dues' },
  { code: '601100', label: 'Achats de marchandises' }
];
const entries = [
  {
    id: 'entry-ac-1', reference: 'ACH-2026-001', journal: 'ACH', date: '2026-01-05',
    description: 'Achat de fournitures', status: 'posted', sourceSystem: 'SAGE', sourceId: 'sage-doc-01',
    sourceReference: 'FACT-01', lines: [
      { account: '601100', debit: 100, credit: 0 },
      { account: '401100', debit: 0, credit: 100 }
    ]
  },
  {
    id: 'entry-pa-1', reference: 'PA-2026-001', journal: 'PA', date: '2026-01-15',
    description: 'Centralisation de paie', status: 'posted', sourceSystem: 'PERFECTO-PAIE-RH', sourceId: 'payroll-run-01',
    sourceMetadata: { sourceModule: 'payroll-hr', runReference: 'PAIE-2026-01' },
    lines: [
      { account: '601100', debit: 50, credit: 0 },
      { account: '421000', debit: 0, credit: 50 }
    ]
  },
  {
    id: 'entry-od-draft', reference: 'OD-2026-BROUILLON', journal: 'OD', date: '2026-01-20',
    description: 'Écriture en préparation', status: 'draft', lines: [
      { account: '601100', debit: 999, credit: 0 },
      { account: '401100', debit: 0, credit: 999 }
    ]
  },
  {
    id: 'entry-ve-outside', reference: 'VTE-2025-001', journal: 'VTE', date: '2025-12-31',
    description: 'Hors période', status: 'posted', lines: [
      { account: '601100', debit: 700, credit: 0 },
      { account: '401100', debit: 0, credit: 700 }
    ]
  },
  {
    id: 'entry-ve-in-period', reference: 'VTE-2026-001', journal: 'VTE', date: '2026-01-20',
    description: 'Vente', status: 'posted', lines: [
      { account: '401100', debit: 25, credit: 0 },
      { account: '601100', debit: 0, credit: 25 }
    ]
  }
];

assert.equal(validIsoDate('2026-02-28'), true);
assert.equal(validIsoDate('2026-02-29'), false);
assert.equal(validIsoDate('28/02/2026'), false);

const allJournals = consolidate(entries, {
  dateStart: '2026-01-01', dateEnd: '2026-01-31', accounts
});
assert.equal(allJournals.ok, true);
assert.equal(allJournals.entriesCount, 3);
assert.equal(allJournals.excludedDraftEntries, 1);
assert.equal(allJournals.movementCount, 6);
assert.equal(allJournals.totalDebit, 175);
assert.equal(allJournals.totalCredit, 175);
assert.equal(allJournals.balanced, true);
assert.deepEqual(allJournals.rows.map(row => row.account), ['401100', '421000', '601100']);

const purchases = allJournals.rows.find(row => row.account === '601100');
assert.equal(purchases.accountLabel, 'Achats de marchandises');
assert.equal(purchases.debit, 150);
assert.equal(purchases.credit, 25);
assert.equal(purchases.balance, 125);
assert.equal(purchases.provenanceCount, 3);
assert.deepEqual(purchases.provenance.map(source => source.reference), ['ACH-2026-001', 'PA-2026-001', 'VTE-2026-001']);
assert.equal(purchases.provenance[0].lineNumber, 1);
assert.equal(purchases.provenance[0].sourceSystem, 'SAGE');
assert.equal(purchases.provenance[0].sourceReference, 'FACT-01');
assert.equal(purchases.provenance[1].sourceModule, 'payroll-hr');
assert.equal(purchases.provenance[1].sourceRunReference, 'PAIE-2026-01');
assert.ok(purchases.provenance.every(source => source.entryId && source.journal && source.date && source.lineNumber));

const onlyPurchasesJournal = consolidate(entries, {
  dateStart: '2026-01-01', dateEnd: '2026-01-31', journalCode: 'ACH', accounts
});
assert.equal(onlyPurchasesJournal.ok, true);
assert.equal(onlyPurchasesJournal.entriesCount, 1);
assert.equal(onlyPurchasesJournal.excludedDraftEntries, 0);
assert.equal(onlyPurchasesJournal.movementCount, 2);
assert.equal(onlyPurchasesJournal.totalDebit, 100);
assert.equal(onlyPurchasesJournal.totalCredit, 100);
assert.equal(onlyPurchasesJournal.rows.find(row => row.account === '601100').provenanceCount, 1);

const empty = consolidate([], {
  dateStart: '2026-01-01', dateEnd: '2026-12-31', accounts
});
assert.equal(empty.ok, true);
assert.equal(empty.balanced, false);
assert.equal(empty.movementCount, 0);
assert.deepEqual(empty.rows, []);

const invalidPeriod = consolidate(entries, {
  dateStart: '2026-02-01', dateEnd: '2026-01-01', accounts
});
assert.equal(invalidPeriod.ok, false);
assert.match(invalidPeriod.errors[0], /date de début/);

const outsideCycle = consolidate(entries, {
  dateStart: '2025-12-01', dateEnd: '2026-01-31', cycleStart: '2026-01-01', cycleEnd: '2026-12-31', accounts
});
assert.equal(outsideCycle.ok, false);
assert.ok(outsideCycle.errors.some(message => message.includes('sort du cycle')));

const unbalancedEntry = consolidate([{
  id: 'entry-bad', reference: 'OD-ERR-01', journal: 'OD', date: '2026-01-02', status: 'posted',
  lines: [
    { account: '601100', debit: 100, credit: 0 },
    { account: '401100', debit: 0, credit: 90 }
  ]
}], { dateStart: '2026-01-01', dateEnd: '2026-01-31', accounts });
assert.equal(unbalancedEntry.ok, false);
assert.ok(unbalancedEntry.errors.some(message => message.includes('n’est pas équilibrée')));

const corruptMovement = consolidate([{
  id: 'entry-corrupt', reference: 'OD-ERR-02', journal: 'OD', date: '2026-01-02', status: 'posted',
  lines: [
    { account: '601100', debit: -1, credit: 0 },
    { account: '401100', debit: 0, credit: 0 }
  ]
}], { dateStart: '2026-01-01', dateEnd: '2026-01-31', accounts });
assert.equal(corruptMovement.ok, false);
assert.ok(corruptMovement.errors.some(message => message.includes('montant invalide')));

const unknownPostedDate = consolidate([{
  id: 'entry-date-error', reference: 'OD-ERR-03', journal: 'OD', date: '2026/01/02', status: 'posted',
  lines: [
    { account: '601100', debit: 10, credit: 0 },
    { account: '401100', debit: 0, credit: 10 }
  ]
}], { dateStart: '2026-01-01', dateEnd: '2026-01-31', accounts });
assert.equal(unknownPostedDate.ok, false);
assert.ok(unknownPostedDate.errors.some(message => message.includes('date invalide')));

console.log('Consolidation pré-résultat : agrégation, filtres, équilibre et provenance par ligne — OK');
