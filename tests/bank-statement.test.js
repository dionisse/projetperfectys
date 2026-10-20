/* Relevés tabulaires génériques : normalisation, contrôles et suggestions non bloquantes. */
'use strict';

const assert = require('node:assert/strict');
const BankStatement = require('../modern-proto/js/bank-statement.js');

const csvRows = [
  ['Relevé de trésorerie'],
  ['Date opération', 'Libellé', 'Référence', 'Débit', 'Crédit'],
  ['31/01/2026', 'Paiement fournisseur', 'VIR-001', '125 000', ''],
  ['2026-02-01', 'Règlement client', 'REM-204', '', '250000'],
  ['date incorrecte', 'Ligne à contrôler', 'ERR-3', '0', ''],
  ['', '', '', '', '']
];
const csv = '\uFEFF' + csvRows.map(row => row.map(value => '"' + value.replace(/"/g, '""') + '"').join(';')).join('\r\n');
const tabular = require('../modern-proto/js/accounting-exchange.js').parseTableCsv(csv);
assert.equal(tabular.ok, true);
assert.equal(BankStatement.detectHeaderIndex(tabular.rows), 1, 'détecte l’en-tête après une ligne de titre');
const mapping = BankStatement.suggestMapping(tabular.rows[1]);
assert.deepEqual(mapping, {
  dateColumn: 0,
  descriptionColumn: 1,
  referenceColumn: 2,
  debitColumn: 3,
  creditColumn: 4,
  amountColumn: -1,
  positiveDirection: 'credit'
});
const parsed = BankStatement.parseMappedRows(tabular.rows, { ...mapping, headerIndex: 1 });
assert.equal(parsed.ok, true, parsed.errors.join(' '));
assert.equal(parsed.rows.length, 3);
assert.equal(parsed.validCount, 2);
assert.equal(parsed.invalidCount, 1);
assert.equal(parsed.rows[0].date, '2026-01-31');
assert.equal(parsed.rows[0].statementDebit, 125000);
assert.equal(parsed.rows[0].bookCredit, 125000, 'un débit du relevé correspond au crédit du compte bancaire');
assert.equal(parsed.rows[1].statementCredit, 250000);
assert.equal(parsed.rows[1].bookDebit, 250000, 'un crédit du relevé correspond au débit du compte bancaire');
assert.equal(parsed.rows[2].valid, false);
assert.ok(parsed.rows[2].errors.some(error => error.includes('date invalide')));

const signedAmountRows = [
  ['Date', 'Description', 'Amount'],
  ['2026-03-01', 'Sortie', '-7500'],
  ['2026-03-02', 'Entrée', '12 000']
];
const signedMapping = BankStatement.suggestMapping(signedAmountRows[0]);
assert.equal(signedMapping.amountColumn, 2);
const signed = BankStatement.parseMappedRows(signedAmountRows, { ...signedMapping, headerIndex: 0, positiveDirection: 'credit' });
assert.equal(signed.validCount, 2);
assert.equal(signed.rows[0].statementDebit, 7500);
assert.equal(signed.rows[0].bookCredit, 7500);
assert.equal(signed.rows[1].statementCredit, 12000);

assert.deepEqual(BankStatement.parseAmount('1.250.000'), { ok: true, value: 1250000 });
assert.deepEqual(BankStatement.parseAmount('(125 000)'), { ok: true, value: -125000 });
assert.equal(BankStatement.parseAmount('125000,50').ok, false, 'les décimales non nulles sont signalées en XOF');
assert.equal(BankStatement.parseDate('2026-02-29'), '');
assert.equal(BankStatement.parseDate('31/12/2026'), '2026-12-31');
assert.equal(BankStatement.columnLabel(27), 'AB');

const bankRow = parsed.rows[0];
const ledgerRows = [
  { lineKey: 'entry-exact:0', date: '2026-01-31', reference: 'VIR-001', description: 'Virement fournisseur', debit: 0, credit: 125000 },
  { lineKey: 'entry-near:0', date: '2026-02-02', reference: 'AUTRE', description: 'Autre paiement', debit: 0, credit: 125000 },
  { lineKey: 'entry-wrong-direction:0', date: '2026-01-31', reference: 'VIR-001', description: '', debit: 125000, credit: 0 },
  { lineKey: 'entry-wrong-amount:0', date: '2026-01-31', reference: 'VIR-001', description: '', debit: 0, credit: 125001 },
  { lineKey: 'entry-already-pointed:0', date: '2026-01-31', reference: 'VIR-001', description: '', debit: 0, credit: 125000, pointageMark: { code: 'PNT-EXISTANT' } }
];
const suggestions = BankStatement.suggestMatches(bankRow, ledgerRows, { dateToleranceDays: 7 });
assert.equal(suggestions.length, 2, 'montant, sens, délai et lignes déjà pointées sont contrôlés');
assert.equal(suggestions[0].lineKey, 'entry-exact:0', 'une référence exacte départage les candidats');
assert.equal(suggestions[0].dateGapDays, 0);
assert.ok(suggestions[0].reasons.includes('référence identique'));
assert.equal(BankStatement.suggestMatches(bankRow, ledgerRows, { dateToleranceDays: 0 }).length, 1);
assert.equal(BankStatement.suggestMatches({ ...bankRow, valid: false }, ledgerRows).length, 0);
assert.equal(ledgerRows[0].pointageMark, undefined, 'calculer une suggestion ne pointe pas la ligne comptable');

console.log('Relevés bancaires génériques : lecture CSV, mappage, normalisation et suggestions non comptabilisantes — OK');
