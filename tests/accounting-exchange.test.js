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
const entries = [
  {
    id: 'entry-1', reference: 'OD-2026-900', journal: 'OD', date: '2026-02-12',
    description: 'Achat; pièce "A"\nligne 2', status: 'posted',
    lines: [
      { account: '601100', debit: 125000, credit: 0 },
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

const csv = Exchange.exportEntries({ dossier, accounts, journals }, entries);
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

const template = Exchange.template({ dossier });
const parsedTemplate = Exchange.parse(template);
assert.equal(parsedTemplate.ok, false, 'Un modèle vide ne doit pas être importable comme un lot comptable.');
assert.ok(parsedTemplate.errors.some(error => error.includes('aucune ligne comptable')));

const workbookBytes = Exchange.exportWorkbook({ dossier, accounts, journals }, entries);
assert.ok(workbookBytes instanceof Uint8Array);
const workbookFiles = fflate.unzipSync(workbookBytes);
assert.ok(workbookFiles['xl/workbook.xml']);
assert.ok(workbookFiles['xl/worksheets/sheet5.xml']);
const workbookXml = new TextDecoder().decode(workbookFiles['xl/workbook.xml']);
assert.ok(workbookXml.includes('name="Ecritures"'));
const entriesSheetXml = new TextDecoder().decode(workbookFiles['xl/worksheets/sheet5.xml']);
assert.ok(entriesSheetXml.includes('PERFECTO-ECHANGE'));
assert.ok(entriesSheetXml.includes('OD-2026-900'));
assert.ok(!entriesSheetXml.includes('OD-2026-902'), 'Le classeur exclut lui aussi les brouillons.');
const workbookTemplate = fflate.unzipSync(Exchange.templateWorkbook({ dossier, accounts, journals }));
const templateSheetXml = new TextDecoder().decode(workbookTemplate['xl/worksheets/sheet5.xml']);
assert.ok(templateSheetXml.includes('REFERENCE_PIECE'));
assert.ok(!templateSheetXml.includes('OD-2026-900'));

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

console.log('Interopérabilité PERFECTO-ÉCHANGE v1 : export Excel/CSV, regroupement, sécurité et validation — OK');
