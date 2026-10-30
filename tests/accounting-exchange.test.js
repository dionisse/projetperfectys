/* Tests du format commun PERFECTO-ÉCHANGE v1, sans dépendance externe. */
'use strict';

const assert = require('node:assert/strict');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
global.fflate = fflate;
const Exchange = require('../modern-proto/js/accounting-exchange.js');

const dossier = {
  reference: 'COR-ESSAI2026',
  exerciseYear: 2026,
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31'
};
const accounts = [
  { code: '401100', label: 'Fournisseurs', cls: 4, nature: 'Passif', aux: true, active: true },
  { code: '601100', label: 'Achats de marchandises', cls: 6, nature: 'Charge', aux: false, active: true }
];
const journals = [{ code: 'OD', label: 'Opérations diverses', type: 'Divers' }];
const analyticalCenters = [{ id: 'ana-center-1', code: 'ATELIER', name: 'Atelier de production' }];
const entries = [
  {
    id: 'entry-1', reference: 'OD-2026-900', journal: 'OD', date: '2026-02-12',
    description: 'Achat; pièce "A"\nligne 2', status: 'posted',
    lines: [
      { account: '601100', debit: 125000, credit: 0, analyticSplits: [{ natureId: 'responsibility-centers', mode: 'amount', completeness: 'complete', roundingCenterId: '', allocations: [{ centerId: 'ana-center-1', centerCode: 'ATELIER', centerName: 'Atelier de production', value: '125000', amount: 125000 }] }] },
      { account: '401100', debit: 0, credit: 125000 }
    ]
  },
  {
    id: 'entry-2', reference: 'OD-2026-901', journal: 'OD', date: '2026-02-13',
    description: '=HYPERLINK("https://example.invalid")', status: 'posted',
    lines: [
      { account: '601100', debit: 2000, credit: 0 },
      { account: '401100', debit: 0, credit: 2000 }
    ]
  },
  {
    id: 'entry-draft', reference: 'OD-2026-902', journal: 'OD', date: '2026-02-14',
    description: 'Brouillon non exporté', status: 'draft',
    lines: [{ account: '601100', debit: 50, credit: 0 }, { account: '401100', debit: 0, credit: 50 }]
  }
];

const csv = Exchange.exportEntries({ dossier, accounts, journals, analyticalCenters }, entries);
assert.ok(csv.charCodeAt(0) === 0xFEFF, 'Le CSV doit inclure le BOM UTF-8 attendu par Excel.');
assert.ok(csv.includes('"FORMAT";"VERSION";'), 'Le CSV doit contenir l’en-tête du format versionné.');
assert.ok(csv.includes("'=HYPERLINK"), 'Les cellules de texte commençant par une formule doivent être protégées pour Excel.');

const parsed = Exchange.parse(csv);
assert.equal(parsed.ok, true, parsed.errors.join('\n'));
assert.equal(parsed.delimiter, ';');
assert.equal(parsed.entries.length, 2, 'Les brouillons ne sont pas exportés.');
assert.equal(parsed.lineCount, 4);
assert.equal(parsed.entries[0].description, 'Achat; pièce "A"\nligne 2');
assert.equal(parsed.entries[0].lines.length, 2, 'Les lignes partageant une référence doivent être regroupées.');
assert.equal(parsed.entries[0].lines[0].analyticSplits[0].allocations[0].centerCode, 'ATELIER', 'Le CSV conserve le code du centre analytique source.');
assert.equal(parsed.entries[0].lines[0].analyticSplits[0].allocations[0].centerName, 'Atelier de production');
assert.equal(parsed.entries[0].sourceId, 'entry-1');
assert.equal(parsed.entries[0].sourceStatus, 'posted');
assert.equal(parsed.entries[1].description, '=HYPERLINK("https://example.invalid")', 'La protection Excel doit être réversible à la lecture.');
assert.deepEqual(parsed.metadata, {
  format: 'PERFECTO-ECHANGE',
  version: '1',
  sourceSystem: 'PERFECTO',
  dossierReference: 'COR-ESSAI2026',
  exercise: 2026
});
const legacyHeaders = Exchange.HEADERS.filter(header => header !== 'IMPUTATIONS_ANALYTIQUES_JSON');
const legacyRows = [
  { FORMAT: 'PERFECTO-ECHANGE', VERSION: '1', SYSTEME_SOURCE: 'SAGE', REFERENCE_DOSSIER: 'COR-OLD2026', EXERCICE: '2026', CODE_JOURNAL: 'OD', LIBELLE_JOURNAL: 'Opérations diverses', DATE: '2026-03-01', REFERENCE_PIECE: 'OD-OLD-1', LIBELLE_PIECE: 'Ancien échange v1', CODE_COMPTE: '601100', LIBELLE_COMPTE: 'Achats', CLASSE_COMPTE: '6', NATURE_COMPTE: 'Charge', DEBIT_XOF: '80', CREDIT_XOF: '0', STATUT_SOURCE: 'VALIDEE', ID_SOURCE: 'old-1' },
  { FORMAT: 'PERFECTO-ECHANGE', VERSION: '1', SYSTEME_SOURCE: 'SAGE', REFERENCE_DOSSIER: 'COR-OLD2026', EXERCICE: '2026', CODE_JOURNAL: 'OD', LIBELLE_JOURNAL: 'Opérations diverses', DATE: '2026-03-01', REFERENCE_PIECE: 'OD-OLD-1', LIBELLE_PIECE: 'Ancien échange v1', CODE_COMPTE: '401100', LIBELLE_COMPTE: 'Fournisseurs', CLASSE_COMPTE: '4', NATURE_COMPTE: 'Passif', DEBIT_XOF: '0', CREDIT_XOF: '80', STATUT_SOURCE: 'VALIDEE', ID_SOURCE: 'old-1' }
];
const quoteCsv = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
const legacyCsv = '\uFEFF' + [legacyHeaders.map(quoteCsv).join(';'), ...legacyRows.map(row => legacyHeaders.map(header => quoteCsv(row[header])).join(';'))].join('\r\n');
const parsedLegacy = Exchange.parse(legacyCsv);
assert.equal(parsedLegacy.ok, true, parsedLegacy.errors.join('\\n'));
assert.deepEqual(parsedLegacy.entries[0].lines[0].analyticSplits, [], 'Les fichiers PERFECTO-ÉCHANGE v1 antérieurs sans colonne analytique restent lisibles.');

const template = Exchange.template({ dossier });
const parsedTemplate = Exchange.parse(template);
assert.equal(parsedTemplate.ok, false, 'Un modèle vide ne doit pas être importable comme un lot comptable.');
assert.ok(parsedTemplate.errors.some(error => error.includes('aucune ligne comptable')));

const workbookBytes = Exchange.exportWorkbook({ dossier, accounts, journals, analyticalCenters }, entries);
assert.ok(workbookBytes instanceof Uint8Array);
const workbookFiles = fflate.unzipSync(workbookBytes);
assert.ok(workbookFiles['xl/workbook.xml']);
assert.ok(workbookFiles['xl/worksheets/sheet5.xml']);
const workbookXml = new TextDecoder().decode(workbookFiles['xl/workbook.xml']);
assert.ok(workbookXml.includes('name="Ecritures"'));
const entriesSheetXml = new TextDecoder().decode(workbookFiles['xl/worksheets/sheet5.xml']);
assert.ok(entriesSheetXml.includes('PERFECTO-ECHANGE'));
assert.ok(entriesSheetXml.includes('OD-2026-900'));
assert.ok(entriesSheetXml.includes('Atelier de production'), 'Le classeur conserve aussi les imputations analytiques explicites.');
assert.ok(!entriesSheetXml.includes('OD-2026-902'), 'Le classeur exclut lui aussi les brouillons.');
const workbookTemplate = fflate.unzipSync(Exchange.templateWorkbook({ dossier, accounts, journals }));
const templateSheetXml = new TextDecoder().decode(workbookTemplate['xl/worksheets/sheet5.xml']);
assert.ok(templateSheetXml.includes('REFERENCE_PIECE'));
assert.ok(!templateSheetXml.includes('OD-2026-900'));

const balanceSourceRows = [
  ['PERFECTO-BALANCE', '1', 'SAGE', 'COR-SOURCE', '2025', '2025-12-31', 'BAL-2025-12', '601100', 'Achats de marchandises', '125000', '0', 'sage-bal-2025-12'],
  ['PERFECTO-BALANCE', '1', 'SAGE', 'COR-SOURCE', '2025', '2025-12-31', 'BAL-2025-12', '401100', 'Fournisseurs', '0', '125000', 'sage-bal-2025-12']
];
const balanceCsv = '\uFEFF' + [Exchange.BALANCE_HEADERS, ...balanceSourceRows]
  .map(row => row.map(value => '\"' + String(value).replace(/\"/g, '\"\"') + '\"').join(';')).join('\r\n') + '\r\n';
const parsedBalance = Exchange.parseBalance(balanceCsv);
assert.equal(parsedBalance.ok, true, parsedBalance.errors.join('\n'));
assert.equal(parsedBalance.rows.length, 2);
assert.equal(parsedBalance.totalDebit, 125000);
assert.equal(parsedBalance.totalCredit, 125000);
assert.equal(parsedBalance.metadata.balanceDate, '2025-12-31');
assert.equal(parsedBalance.metadata.balanceReference, 'BAL-2025-12');
assert.equal(parsedBalance.rows[0].account, '601100');
assert.equal(parsedBalance.rows[1].credit, 125000);
assert.equal(Exchange.parseBalance(Exchange.templateBalance()).ok, false, 'Un modèle vide ne doit pas être importable.');
const unbalancedBalance = Exchange.parseBalance(balanceCsv.replace('"125000"', '"124999"'));
assert.equal(unbalancedBalance.ok, false);
assert.ok(unbalancedBalance.errors.some(error => error.includes('Balance déséquilibrée')));
const duplicateBalance = Exchange.parseBalance('\uFEFF' + [Exchange.BALANCE_HEADERS, ...balanceSourceRows, balanceSourceRows[0]]
  .map(row => row.map(value => '\"' + String(value).replace(/\"/g, '\"\"') + '\"').join(';')).join('\r\n') + '\r\n');
assert.equal(duplicateBalance.ok, false);
assert.ok(duplicateBalance.errors.some(error => error.includes('compte source') && error.includes('répété')));
const inconsistentSourceIdRows = balanceSourceRows.map(row => row.slice());
inconsistentSourceIdRows[1][11] = '';
const inconsistentSourceIdBalance = Exchange.parseBalance('\uFEFF' + [Exchange.BALANCE_HEADERS, ...inconsistentSourceIdRows]
  .map(row => row.map(value => '\"' + String(value).replace(/\"/g, '\"\"') + '\"').join(';')).join('\r\n') + '\r\n');
assert.equal(inconsistentSourceIdBalance.ok, false);
assert.ok(inconsistentSourceIdBalance.errors.some(error => error.includes('ID_SOURCE doit être identique')));
const balanceWorkbookTemplate = fflate.unzipSync(Exchange.templateBalanceWorkbook({ dossier, accounts, journals }));
const balanceWorkbookXml = new TextDecoder().decode(balanceWorkbookTemplate['xl/workbook.xml']);
assert.ok(balanceWorkbookXml.includes('name="Balance"'));
const balanceSheetXml = new TextDecoder().decode(balanceWorkbookTemplate['xl/worksheets/sheet4.xml']);
assert.ok(balanceSheetXml.includes('SOLDE_DEBITEUR_XOF'));
assert.ok(balanceSheetXml.includes('REFERENCE_BALANCE'));

const accountCsv = Exchange.exportAccounts(accounts);
assert.equal(accountCsv.charCodeAt(0), 0xFEFF);
assert.ok(accountCsv.includes('"CODE_COMPTE";"LIBELLE_COMPTE"'));
assert.ok(accountCsv.includes('"401100";"Fournisseurs"'));
const journalCsv = Exchange.exportJournals(journals);
assert.ok(journalCsv.includes('"CODE_JOURNAL";"LIBELLE_JOURNAL"'));
const unbalancedEntry = { id: 'invalid-entry', reference: 'OD-2026-999', journal: 'OD', date: '2026-02-15', status: 'posted', lines: [
  { account: '601100', debit: 100, credit: 0 }, { account: '401100', debit: 0, credit: 90 }
] };
assert.throws(() => Exchange.exportEntries({ dossier, accounts, journals }, [unbalancedEntry]), /n’est pas équilibrée/);
assert.throws(() => Exchange.exportWorkbook({ dossier, accounts, journals }, [unbalancedEntry]), /n’est pas équilibrée/);

const invalidAmount = csv.replace('"125000"', '"125,000"');
const invalidParsed = Exchange.parse(invalidAmount);
assert.equal(invalidParsed.ok, false);
assert.ok(invalidParsed.errors.some(error => error.includes('montant XOF entier')));

const wrongVersion = csv.replace('"PERFECTO-ECHANGE";"1"', '"PERFECTO-ECHANGE";"9"');
const wrongVersionParsed = Exchange.parse(wrongVersion);
assert.equal(wrongVersionParsed.ok, false);
assert.ok(wrongVersionParsed.errors.some(error => error.includes('version d’échange non prise en charge')));

const wrongColumns = Exchange.parse('\uFEFFCODE;LIBELLE\r\n1;Essai\r\n');
assert.equal(wrongColumns.ok, false);
assert.ok(wrongColumns.errors[0].includes('Colonnes attendues'));

console.log('Interopérabilité PERFECTO-ÉCHANGE et PERFECTO-BALANCE v1 : export, import, contrôles et modèles Excel/CSV — OK');
