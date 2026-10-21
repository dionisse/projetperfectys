/* Tests structurels du lecteur FEC béninois — aucune donnée réelle. */
'use strict';

const assert = require('node:assert/strict');
const FecImport = require('../modern-proto/js/fec-import.js');

const headers = [
  'Code journal', 'Libellé journal', 'Numéro d’écriture', 'Date d’écriture',
  'Numéro du compte', 'Libellé du compte', 'Compte auxiliaire',
  'Libellé du compte auxiliaire', 'Référence pièce', 'Date de la pièce',
  'Libellé de l’écriture', 'Montant au début', 'Montant au crédit',
  'Lettrage de l’écriture', 'Date de lettrage', 'Date de validation de l’écriture',
  'Montant en devise', 'Code de la devise'
];

function row(values) {
  return values.map(value => String(value == null ? '' : value)).join('\t');
}

const debitLine = [
  'OD', 'Opérations diverses', 'E-0001', '20250102', '601100', 'Achats', '', '',
  'P-001', '20250102', 'Ligne débit', '125,50', '0', '', '', '20250103', '', ''
];
const creditLine = [
  'OD', 'Opérations diverses', 'E-0001', '20250102', '401100', 'Fournisseurs', 'FOU-1', 'Fournisseur',
  'P-001', '20250102', 'Ligne crédit', '0', '125,50', '', '', '20250103', '', ''
];
const text = [row(headers), row(debitLine), row(creditLine)].join('\r\n') + '\r\n';
const parsed = FecImport.parse(text, { fileName: 'FEC_IFU_20250131.txt', encoding: 'iso-8859-15' });
assert.equal(parsed.ok, true, parsed.errors.join('\n'));
assert.equal(parsed.metadata.format, 'FEC-BENIN');
assert.equal(parsed.metadata.headerCount, 18);
assert.equal(parsed.metadata.delimiter, 'TAB');
assert.equal(parsed.metadata.recordSeparator, 'CRLF');
assert.equal(parsed.metadata.lineCount, 2);
assert.equal(parsed.metadata.entryCount, 1);
assert.equal(parsed.entries[0].journal, 'OD');
assert.equal(parsed.entries[0].date, '2025-01-02');
assert.equal(parsed.entries[0].sourceStatus, 'posted');
assert.equal(parsed.entries[0].lines[0].debit, 125.5);
assert.equal(parsed.entries[0].lines[1].credit, 125.5);
assert.equal(parsed.entries[0].sourceMetadata.lines[1].auxiliaryAccount, 'FOU-1');
assert.equal(parsed.entries[0].sourceMetadata.lines[1].pieceReference, 'P-001');

// Le signe FEC est préservé et une valeur négative est présentée sur le côté comptable opposé.
const negativeDebitLine = debitLine.map((value, index) => index === 11 ? '-125,50' : value);
const oppositeDebitLine = creditLine.map((value, index) => index === 11 ? '125,50' : (index === 12 ? '0' : value));
const signedDebitCredit = FecImport.parse([row(headers), row(negativeDebitLine), row(oppositeDebitLine)].join('\n'));
assert.equal(signedDebitCredit.ok, true, signedDebitCredit.errors.join('\n'));
assert.equal(signedDebitCredit.metadata.normalizedSignCount, 1);
assert.equal(signedDebitCredit.entries[0].lines[0].debit, 0);
assert.equal(signedDebitCredit.entries[0].lines[0].credit, 125.5);
assert.equal(signedDebitCredit.entries[0].sourceMetadata.lines[0].debitRaw, '-125,50');
assert.equal(signedDebitCredit.rows[0].signNormalized, true);
assert.ok(signedDebitCredit.warnings.some(message => message.includes('côté comptable opposé')));

// La variante lisible du fichier d’exemple utilise des libellés descriptifs ;
// « Montant au début » est l’alias confirmé de MontDebit.
assert.equal(FecImport.normalizeHeader('Montant au début'), 'MONTANTAUDEBUT');
assert.equal(FecImport.parse(text.replaceAll('Montant au début', 'Montant au débit')).ok, true);

// Format alternatif Montant/sens.
const amountSenseHeaders = headers.slice();
amountSenseHeaders[11] = 'Montant';
amountSenseHeaders[12] = 'Sens';
const amountSenseDebit = debitLine.slice();
amountSenseDebit[11] = '90,25';
amountSenseDebit[12] = 'D';
const amountSenseCredit = creditLine.slice();
amountSenseCredit[11] = '90,25';
amountSenseCredit[12] = 'C';
const amountSense = FecImport.parse([
  row(amountSenseHeaders), row(amountSenseDebit), row(amountSenseCredit)
].join('\n'));
assert.equal(amountSense.ok, true, amountSense.errors.join('\n'));
assert.equal(amountSense.metadata.amountVariant, 'amount-sense');
assert.equal(amountSense.entries[0].lines[0].debit, 90.25);
assert.equal(amountSense.entries[0].lines[1].credit, 90.25);
const negativeAmountSenseCredit = amountSenseCredit.slice();
negativeAmountSenseCredit[11] = '-90,25';
negativeAmountSenseCredit[12] = 'D';
const signedAmountSense = FecImport.parse([
  row(amountSenseHeaders), row(amountSenseDebit), row(negativeAmountSenseCredit)
].join('\n'));
assert.equal(signedAmountSense.ok, true, signedAmountSense.errors.join('\n'));
assert.equal(signedAmountSense.entries[0].lines[1].credit, 90.25);
assert.equal(signedAmountSense.entries[0].sourceMetadata.lines[1].amountRaw, '-90,25');

// La variante à 21 champs conserve les informations de règlement sans calculer d’écriture additionnelle.
const cashHeaders = headers.concat(['Date Règlement', 'Mode Règlement', 'NatOp']);
const cashDebit = debitLine.concat(['20250115', 'Virement', 'REGLEMENT']);
const cashCredit = creditLine.concat(['20250115', 'Virement', 'REGLEMENT']);
const cash = FecImport.parse([row(cashHeaders), row(cashDebit), row(cashCredit)].join('\r\n'));
assert.equal(cash.ok, true, cash.errors.join('\n'));
assert.equal(cash.metadata.headerCount, 21);
assert.equal(cash.entries[0].sourceMetadata.lines[0].settlementDate, '2025-01-15');
assert.equal(cash.entries[0].sourceMetadata.lines[0].settlementMode, 'Virement');

// Détection du séparateur autorisé pipe et dates de report.
const pipeText = [row(headers).replaceAll('\t', '|'), row(debitLine).replaceAll('\t', '|'), row(creditLine).replaceAll('\t', '|')].join('\r');
const pipeParsed = FecImport.parse(pipeText);
assert.equal(pipeParsed.ok, true, pipeParsed.errors.join('\n'));
assert.equal(pipeParsed.metadata.delimiter, '|');
assert.equal(pipeParsed.metadata.recordSeparator, 'CR');

// Les fichiers EBCDIC exigent une variante déclarée explicitement.
assert.equal(FecImport.decodeBytes(Uint8Array.from([0xc8, 0xc5, 0xd3, 0xd3, 0xd6]), 'ibm037'), 'HELLO');
assert.equal(FecImport.decodeBytes(Uint8Array.from([0xc8, 0xc5, 0xd3, 0xd3, 0xd6]), 'ibm500'), 'HELLO');
assert.throws(() => FecImport.decodeBytes(Uint8Array.from([0x43, 0x6f, 0x64, 0x65, 0xe9]), 'ascii'), /hors ASCII/);

const noHeader = FecImport.parse([row(debitLine), row(creditLine)].join('\n'));
assert.equal(noHeader.ok, false);
assert.ok(noHeader.errors.some(error => error.includes('En-tête non reconnu')));
const wrongColumns = FecImport.parse([row(headers), row(debitLine.slice(0, 17)), row(creditLine)].join('\n'));
assert.equal(wrongColumns.ok, false);
assert.ok(wrongColumns.errors.some(error => error.includes('colonne')));
const unbalanced = FecImport.parse([row(headers), row(debitLine), row(creditLine.map((value, index) => index === 12 ? '125,49' : value))].join('\n'));
assert.equal(unbalanced.ok, false);
assert.ok(unbalanced.errors.some(error => error.includes('non équilibrée')));
const invalidAccount = FecImport.parse([row(headers), row(debitLine.map((value, index) => index === 4 ? 'A01100' : value)), row(creditLine)].join('\n'));
assert.equal(invalidAccount.ok, false);
assert.ok(invalidAccount.errors.some(error => error.includes('trois premiers caractères')));
const invalidDate = FecImport.parse([row(headers), row(debitLine.map((value, index) => index === 3 ? '20250230' : value)), row(creditLine)].join('\n'));
assert.equal(invalidDate.ok, false);
assert.ok(invalidDate.errors.some(error => error.includes('DateEcriture')));
const invalidChronology = FecImport.parse([row(headers), row(debitLine), row(creditLine.map((value, index) => index === 15 ? '20250101' : value))].join('\n'));
assert.equal(invalidChronology.ok, false);
assert.ok(invalidChronology.errors.some(error => error.includes('chronologiquement')));

console.log('Lecteur FEC béninois : entête, tabulation/pipe, encodages déclarés, 18/21 champs, montants, dates et équilibre — OK');
