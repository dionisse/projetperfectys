/*
 * Tests des règles métier de PERFECTO (Lot 1), sans dépendance externe.
 * Exécution : node tests/store.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const stored = {};
let storageWritesBlocked = false;
const sandbox = {
  window: {},
  localStorage: {
    getItem: (key) => (key in stored ? stored[key] : null),
    setItem: (key, value) => {
      if (storageWritesBlocked) throw new Error('quota simulé');
      stored[key] = String(value);
    },
    removeItem: (key) => { delete stored[key]; }
  },
  Intl,
  console,
  JSON,
  Date,
  Math,
  String,
  Number,
  Object,
  Array
};
sandbox.window.localStorage = sandbox.localStorage;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'),
  sandbox,
  { filename: 'accounting-chart.js' }
);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'),
  sandbox,
  { filename: 'store.js' }
);

const S = sandbox.window.PerfectoStore;
const STANDARD_ACCOUNT_COUNT = sandbox.window.PerfectoAccountingChart.accountCount();
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ✓ ' + name);
  } catch (error) {
    console.error('  ✗ ' + name);
    console.error('    ' + error.message);
    process.exitCode = 1;
  }
}

console.log('Référentiel de démonstration');
test('147 comptes standards, 18 comptes historiques, 8 journaux standards et 2 journaux système', () => {
  assert.strictEqual(STANDARD_ACCOUNT_COUNT, 147);
  assert.strictEqual(S.accounts().length, STANDARD_ACCOUNT_COUNT + 18);
  assert.strictEqual(S.journals().length, 10);
  assert.strictEqual(S.journals().filter((journal) => journal.isStandard).length, 8);
  assert.strictEqual(S.journals().filter((journal) => journal.systemManaged).length, 2);
  assert.strictEqual(S.postedEntries().length, 3);
  assert.strictEqual(S.entries().filter((e) => e.status === 'draft').length, 1);
});

test('les codes du plan fourni sont imputables ou regroupés selon leur nature', () => {
  assert.equal(S.account('101').subclass, '10');
  assert.equal(S.account('601').usage.length > 0, true);
  const group = S.validateEntry({
    reference: 'OD-2026-GROUPE', journal: 'OD', date: '2026-03-01',
    lines: [{ account: '10', debit: 100, credit: 0 }, { account: '401', debit: 0, credit: 100 }]
  }, { requireBalanced: true, status: 'posted' });
  assert.equal(group.ok, false);
  assert.ok(group.errors.some((message) => message.includes('non imputable')));
  const leaf = S.validateEntry({
    reference: 'OD-2026-PLAN', journal: 'OD', date: '2026-03-01',
    lines: [{ account: '601', debit: 100, credit: 0 }, { account: '401', debit: 0, credit: 100 }]
  }, { requireBalanced: true, status: 'posted' });
  assert.equal(leaf.ok, true, leaf.errors.join(' '));
});

test('mouvements validés équilibrés à 2 832 000 XOF', () => {
  const k = S.kpis();
  assert.strictEqual(k.debit, 2832000);
  assert.strictEqual(k.credit, 2832000);
  assert.strictEqual(k.resultat, 242000);
  assert.strictEqual(k.tresorerie, 1500000);
});

console.log('Pièces et contrôles');
test('référence proposée par journal', () => {
  assert.strictEqual(S.nextReference('ACH', '2026-03-01'), 'ACH-2026-002');
  assert.strictEqual(S.nextReference('BQ', '2026-03-01'), 'BQ-2026-002');
});

test('pièce équilibrée acceptée en validation', () => {
  const result = S.createEntry({
    reference: 'OD-2026-101', journal: 'OD', date: '2026-03-10', description: 'Test',
    lines: [
      { account: '601100', debit: 150000, credit: 0 },
      { account: '401100', debit: 0, credit: 150000 }
    ]
  }, 'posted');
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  assert.strictEqual(result.entry.status, 'posted');
});

test('référence en doublon refusée', () => {
  const result = S.createEntry({
    reference: 'OD-2026-101', journal: 'OD', date: '2026-03-11',
    lines: [
      { account: '601100', debit: 1, credit: 0 },
      { account: '401100', debit: 0, credit: 1 }
    ]
  }, 'draft');
  assert.strictEqual(result.ok, false);
});

test('pièce déséquilibrée refusée à la validation', () => {
  const result = S.createEntry({
    reference: 'OD-2026-102', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 100, credit: 0 },
      { account: '401100', debit: 0, credit: 90 }
    ]
  }, 'posted');
  assert.strictEqual(result.ok, false);
});

test('débit et crédit simultanés sur une ligne refusés', () => {
  const result = S.validateEntry({
    reference: 'OD-2026-103', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 10, credit: 10 },
      { account: '401100', debit: 0, credit: 10 }
    ]
  }, { requireBalanced: true });
  assert.strictEqual(result.ok, false);
});

test('ligne vide ignorée', () => {
  const result = S.validateEntry({
    reference: 'OD-2026-104', journal: 'OD', date: '2026-03-12',
    lines: [
      { account: '601100', debit: 1000, credit: 0 },
      { account: '401100', debit: 0, credit: 1000 },
      { account: '', debit: '', credit: '' }
    ]
  }, { requireBalanced: true });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
});

console.log('Périodes');
test('période clôturée refuse la saisie', () => {
  S.setPeriod(2026, 4, 'closed');
  const result = S.createEntry({
    reference: 'OD-2026-105', journal: 'OD', date: '2026-04-15',
    lines: [
      { account: '601100', debit: 50, credit: 0 },
      { account: '401100', debit: 0, credit: 50 }
    ]
  }, 'draft');
  assert.strictEqual(result.ok, false);
  S.setPeriod(2026, 4, 'open');
});

test('période clôturée refuse la validation d’un brouillon', () => {
  const draft = S.createEntry({
    reference: 'OD-2026-106', journal: 'OD', date: '2026-05-15',
    lines: [
      { account: '622100', debit: 7000, credit: 0 },
      { account: '401100', debit: 0, credit: 7000 }
    ]
  }, 'draft');
  assert.strictEqual(draft.ok, true, draft.errors.join(' '));
  S.setPeriod(2026, 5, 'closed');
  const posted = S.postEntry(draft.entry.id);
  assert.strictEqual(posted.ok, false);
  S.setPeriod(2026, 5, 'open');
  assert.strictEqual(S.postEntry(draft.entry.id).ok, true);
});

console.log('Brouillons et états');
test('validation d’un brouillon puis immuabilité', () => {
  const draft = S.createEntry({
    reference: 'OD-2026-107', journal: 'OD', date: '2026-06-05', description: 'Brouillon',
    lines: [
      { account: '622100', debit: 5000, credit: 0 },
      { account: '401100', debit: 0, credit: 5000 }
    ]
  }, 'draft');
  assert.strictEqual(draft.ok, true);
  assert.strictEqual(S.postEntry(draft.entry.id).ok, true);
  assert.strictEqual(S.deleteDraft(draft.entry.id).ok, false);
});

test('une suppression de brouillon échoue sans l’effacer si le stockage est plein', () => {
  const draft = S.createEntry({
    reference: 'OD-2026-108', journal: 'OD', date: '2026-06-06', description: 'Suppression protégée',
    lines: [
      { account: '622100', debit: 2500, credit: 0 },
      { account: '401100', debit: 0, credit: 2500 }
    ]
  }, 'draft');
  assert.strictEqual(draft.ok, true, draft.errors.join(' '));
  storageWritesBlocked = true;
  const removed = S.deleteDraft(draft.entry.id);
  storageWritesBlocked = false;
  assert.strictEqual(removed.ok, false);
  assert.ok(S.entry(draft.entry.id), 'le brouillon reste présent en mémoire si l’enregistrement échoue');
});

test('brouillons exclus de la balance', () => {
  const draftTotal = S.entries()
    .filter((e) => e.status === 'draft')
    .reduce((sum, e) => sum + S.totals(e.lines).debit, 0);
  const debit = S.balance().reduce((sum, r) => sum + r.debit, 0);
  const postedTotal = S.postedEntries().reduce((sum, e) => sum + S.totals(e.lines).debit, 0);
  assert.strictEqual(debit, postedTotal);
  assert.ok(draftTotal > 0);
});

test('grand livre : solde progressif cohérent', () => {
  const ledger = S.ledger('401100');
  const total = ledger.rows.reduce((sum, row) => sum + row.debit - row.credit, 0);
  assert.strictEqual(ledger.balance, total);
  assert.strictEqual(ledger.rows[ledger.rows.length - 1].balance, total);
});

console.log('Plan comptable et sauvegarde');
test('ajout de compte avec code unique', () => {
  const added = S.addAccount({ code: '601200', label: 'Achats de matières premières', nature: 'Charge' });
  assert.strictEqual(added.ok, true, added.errors.join(' '));
  assert.strictEqual(S.accounts().length, STANDARD_ACCOUNT_COUNT + 19);
  const duplicate = S.addAccount({ code: '601200', label: 'Doublon', nature: 'Charge' });
  assert.strictEqual(duplicate.ok, false);
});

test('export puis import JSON', () => {
  const json = S.exportJson();
  const imported = S.importJson(json);
  assert.strictEqual(imported.ok, true, imported.errors.join(' '));
  assert.strictEqual(S.kpis().debit, S.kpis().credit);
});

test('import d’un fichier invalide refusé', () => {
  const result = S.importJson('{"foo":42}');
  assert.strictEqual(result.ok, false);
});

console.log('Échanges comptables PERFECTO-ÉCHANGE v1');
test('aperçu d’import sans modification du dossier, avec correspondance de comptes et journaux', () => {
  const before = S.entries().length;
  const source = [{
    reference: 'OD-2026-EXCHANGE-001', journal: 'DIVERS', journalLabel: 'Opérations diverses',
    date: '2026-08-12', description: 'Import de test', sourceSystem: 'EXCEL', sourceId: 'excel-001', sourceStatus: 'posted',
    lines: [
      { account: 'ACHATS', accountLabel: 'Achats', debit: 1500, credit: 0 },
      { account: 'FOUR', accountLabel: 'Fournisseurs', debit: 0, credit: 1500 }
    ]
  }];
  const missingMappings = S.previewExchangeImport(source, 'draft', { sourceSystem: 'EXCEL' });
  assert.strictEqual(missingMappings.ok, false);
  assert.deepStrictEqual(Array.from(missingMappings.unmappedAccounts, item => item.code).sort(), ['ACHATS', 'FOUR']);
  assert.deepStrictEqual(Array.from(missingMappings.unmappedJournals, item => item.code), ['DIVERS']);
  const mapped = S.previewExchangeImport(source, 'draft', {
    sourceSystem: 'EXCEL',
    accountMap: { ACHATS: '601100', FOUR: '401100' },
    journalMap: { DIVERS: 'OD' }
  });
  assert.strictEqual(mapped.ok, true, mapped.errors.join(' '));
  assert.strictEqual(S.entries().length, before, 'L’aperçu ne doit jamais écrire dans le dossier.');
});

test('écritures importées comme brouillons, traçabilité et doublons refusés', () => {
  const source = [{
    reference: 'OD-2026-EXCHANGE-002', journal: 'OD', date: '2026-08-13', description: 'Reprise Excel',
    sourceSystem: 'EXCEL', sourceId: 'excel-002', sourceStatus: 'posted',
    sourceMetadata: { format: 'PERFECTO-BALANCE', version: '1', dossierReference: 'COR-SOURCE', exercise: 2026, balanceDate: '2026-08-12', balanceReference: 'TB-2026' },
    lines: [
      { account: '601100', accountLabel: 'Achats', debit: 2500, credit: 0 },
      { account: '401100', accountLabel: 'Fournisseurs', debit: 0, credit: 2500 }
    ]
  }];
  const before = S.entries().length;
  const result = S.importExchange(source, 'draft', { sourceSystem: 'EXCEL' });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  assert.strictEqual(result.importedCount, 1);
  assert.strictEqual(S.entries().length, before + 1);
  const imported = S.entries().find(entry => entry.reference === source[0].reference);
  assert.strictEqual(imported.status, 'draft');
  assert.strictEqual(imported.sourceSystem, 'EXCEL');
  assert.strictEqual(imported.sourceId, 'excel-002');
  assert.strictEqual(imported.sourceStatus, 'posted');
  assert.deepStrictEqual(imported.sourceMetadata, source[0].sourceMetadata);
  assert.strictEqual(imported.lines[0].sourceAccountCode, '601100');
  const duplicate = S.previewExchangeImport(source, 'draft', { sourceSystem: 'EXCEL' });
  assert.strictEqual(duplicate.ok, false);
  assert.ok(duplicate.errors.some(error => error.includes('existe déjà')));
});

test('source FEC conservée localement, téléchargeable et lot brouillon annulable', () => {
  const source = [{
    reference: 'FEC-OD-E-LOCAL-001', journal: 'OD', date: '2026-08-17', description: 'Import FEC de test',
    sourceSystem: 'FEC-BENIN', sourceId: 'FEC-LOCAL-001', sourceStatus: 'posted',
    sourceMetadata: { format: 'FEC-BENIN', sourceRow: 2, sourceFileId: 'a'.repeat(64) },
    lines: [
      { account: '601100', accountLabel: 'Achats', debit: 1250, credit: 0 },
      { account: '401100', accountLabel: 'Fournisseurs', debit: 0, credit: 1250 }
    ]
  }];
  const result = S.importExchange(source, 'draft', {
    sourceSystem: 'FEC-BENIN',
    importSourceFile: {
      sourceSystem: 'FEC-BENIN', fileName: 'FEC_IFU_20260831.txt',
      sha256: 'a'.repeat(64), contentBase64: 'AA==', byteLength: 1,
      encoding: 'iso-8859-15', delimiter: 'TAB', recordSeparator: 'CRLF'
    }
  });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  const sourceRecord = S.importSourceFiles().find(item => item.sha256 === 'a'.repeat(64));
  assert.ok(sourceRecord);
  assert.strictEqual(sourceRecord.contentBase64, undefined, 'La liste d’historique ne doit pas exposer le contenu brut.');
  assert.strictEqual(S.importSourceFile(sourceRecord.id).contentBase64, 'AA==');
  const imported = S.entries().find(entry => entry.sourceId === 'FEC-LOCAL-001');
  assert.strictEqual(imported.status, 'draft');
  assert.strictEqual(imported.sourceMetadata.sourceFileId, 'a'.repeat(64));
  const cancelled = S.cancelImportBatch(sourceRecord.id);
  assert.strictEqual(cancelled.ok, true, cancelled.errors.join(' '));
  assert.strictEqual(S.entries().some(entry => entry.importBatchId === sourceRecord.id), false);
  assert.strictEqual(S.importSourceFiles().find(item => item.id === sourceRecord.id).status, 'cancelled');
});

test('corrections FEC en aperçu préservent la source originale et sont tracées dans le brouillon', () => {
  const sourceId = 'FEC-BENIN:corrections-preview-test';
  const original = {
    reference: 'FEC-OD-E-ORIGINAL-EDIT', journal: 'OD', journalLabel: 'Opérations diverses',
    date: '2026-08-17', description: 'Libellé source', sourceSystem: 'FEC-BENIN', sourceId, sourceStatus: 'posted',
    sourceMetadata: { format: 'FEC-BENIN', numEcriture: 'E-ORIGINAL', referencePiece: 'P-ORIGINAL' },
    lines: [
      { account: '601100', accountLabel: 'Achats source', debit: 1250, credit: 0, sourceRow: 2 },
      { account: '401100', accountLabel: 'Fournisseurs source', debit: 0, credit: 1250, sourceRow: 3 }
    ]
  };
  const edited = Object.assign({}, original, {
    reference: 'FEC-OD-E-CORRIGE',
    description: 'Libellé corrigé',
    lines: original.lines.map((line, index) => Object.assign({}, line, index === 0
      ? { account: '601200', debit: 1300 }
      : { credit: 1300 }))
  });
  const corrections = {
    fields: { reference: { before: original.reference, after: edited.reference }, description: { before: original.description, after: edited.description } },
    lines: [
      { sourceRow: 2, account: { before: '601100', after: '601200' }, debit: { before: 1250, after: 1300 } },
      { sourceRow: 3, credit: { before: 1250, after: 1300 } }
    ]
  };
  const result = S.importExchange([edited], 'draft', {
    sourceSystem: 'FEC-BENIN',
    sourceOriginalEntries: { [sourceId]: original },
    sourceCorrections: { [sourceId]: corrections }
  });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  const imported = S.entries().find(entry => entry.reference === edited.reference);
  assert.ok(imported);
  assert.strictEqual(imported.sourceReference, original.reference);
  assert.strictEqual(imported.sourceMetadata.numEcriture, 'E-ORIGINAL');
  assert.deepStrictEqual(imported.sourceMetadata.userCorrections.fields, corrections.fields);
  assert.deepStrictEqual(imported.sourceMetadata.userCorrections.lines, corrections.lines);
  assert.ok(imported.sourceMetadata.userCorrections.modifiedAt);
  assert.strictEqual(imported.lines[0].account, '601200');
  assert.strictEqual(imported.lines[0].debit, 1300);
  assert.strictEqual(imported.lines[0].sourceAccountCode, original.lines[0].account);
});

test('une ligne FEC ne peut pas être supprimée silencieusement en ramenant ses montants à zéro', () => {
  const source = [{
    reference: 'FEC-OD-E-ZERO-LINE', journal: 'OD', date: '2026-08-17', description: 'Contrôle de ligne source',
    sourceSystem: 'FEC-BENIN', sourceId: 'FEC-ZERO-LINE',
    lines: [
      { account: '601100', debit: 0, credit: 0, sourceRow: 2 },
      { account: '401100', debit: 0, credit: 100, sourceRow: 3 }
    ]
  }];
  const preview = S.previewExchangeImport(source, 'draft', { sourceSystem: 'FEC-BENIN' });
  assert.strictEqual(preview.ok, false);
  assert.ok(preview.errors.some(error => error.includes('ligne FEC source 2')));
});

test('un lot FEC validé ne peut pas être supprimé par la fonction d’annulation de brouillon', () => {
  const source = [{
    reference: 'FEC-OD-E-POSTED-001', journal: 'OD', date: '2026-08-18', description: 'FEC validé',
    sourceSystem: 'FEC-BENIN', sourceId: 'FEC-POSTED-001', sourceStatus: 'posted',
    sourceMetadata: { format: 'FEC-BENIN', sourceFileId: 'b'.repeat(64) },
    lines: [
      { account: '601100', accountLabel: 'Achats', debit: 950, credit: 0 },
      { account: '401100', accountLabel: 'Fournisseurs', debit: 0, credit: 950 }
    ]
  }];
  const result = S.importExchange(source, 'posted', {
    sourceSystem: 'FEC-BENIN',
    importSourceFile: {
      sourceSystem: 'FEC-BENIN', fileName: 'FEC_IFU_20260831.txt',
      sha256: 'b'.repeat(64), contentBase64: 'AQ==', byteLength: 1,
      encoding: 'iso-8859-15', delimiter: 'TAB', recordSeparator: 'CRLF'
    }
  });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  const sourceRecord = S.importSourceFiles().find(item => item.sha256 === 'b'.repeat(64));
  const cancelled = S.cancelImportBatch(sourceRecord.id);
  assert.strictEqual(cancelled.ok, false);
  assert.ok(cancelled.errors[0].includes('écritures validées'));
  assert.strictEqual(S.entries().some(entry => entry.importBatchId === sourceRecord.id), true);

  const original = S.entries().find(entry => entry.sourceId === 'FEC-POSTED-001');
  const reversal = [{
    reference: 'FEC-REV-OD-POSTED-001', journal: 'OD', date: '2026-08-20', description: 'Écriture inverse liée au FEC',
    sourceSystem: 'PERFECTO-ANNULATION-FEC', sourceId: JSON.stringify(['PERFECTO-ANNULATION-FEC', original.id]),
    sourceStatus: 'posted', sourceMetadata: {
      operation: 'fec-import-reversal', originalEntryId: original.id, originalReference: original.reference,
      sourceFileId: original.sourceMetadata.sourceFileId, reversalMethod: 'opposite-lines'
    },
    lines: original.lines.map(line => ({ account: line.account, accountLabel: line.accountLabel, debit: line.credit, credit: line.debit }))
  }];
  const reversalPreview = S.previewExchangeImport(reversal, 'posted', { sourceSystem: 'PERFECTO-ANNULATION-FEC' });
  assert.strictEqual(reversalPreview.ok, true, reversalPreview.errors.join(' '));
  const reversalResult = S.importExchange(reversal, 'posted', { sourceSystem: 'PERFECTO-ANNULATION-FEC' });
  assert.strictEqual(reversalResult.ok, true, reversalResult.errors.join(' '));
  const storedOriginal = S.entries().find(entry => entry.id === original.id);
  const storedReversal = S.entries().find(entry => entry.sourceId === reversal[0].sourceId);
  assert.strictEqual(storedOriginal.status, 'posted', 'La pièce FEC originale validée reste dans l’historique.');
  assert.strictEqual(storedReversal.status, 'posted');
  assert.strictEqual(storedReversal.sourceMetadata.originalEntryId, storedOriginal.id);
  assert.deepStrictEqual(storedReversal.lines.map(line => [line.debit, line.credit]), original.lines.map(line => [line.credit, line.debit]));
  assert.strictEqual(S.previewExchangeImport(reversal, 'posted', { sourceSystem: 'PERFECTO-ANNULATION-FEC' }).ok, false,
    'Une même pièce ne reçoit pas deux inversions liées.');
});

test('l’équilibre des montants décimaux suit la précision du dossier sans erreur IEEE-754', () => {
  const previousConfiguration = S.accountingConfiguration();
  try {
    const configured = S.updateAccountingConfiguration(Object.assign({}, previousConfiguration, { decimalPlaces: 2 }));
    assert.strictEqual(configured.ok, true, configured.errors.join(' '));
    const source = [{
      reference: 'OD-2026-EXCHANGE-DECIMAL-001', journal: 'OD', date: '2026-08-19', description: 'Contrôle décimal',
      sourceSystem: 'FEC-BENIN', sourceId: 'fec-decimal-test',
      lines: [
        { account: '601100', debit: 0.1, credit: 0 },
        { account: '601100', debit: 0.2, credit: 0 },
        { account: '401100', debit: 0, credit: 0.3 }
      ]
    }];
    const preview = S.previewExchangeImport(source, 'posted', { sourceSystem: 'FEC-BENIN' });
    assert.strictEqual(preview.ok, true, preview.errors.join(' '));
    assert.strictEqual(preview.balancedCount, 1);
  } finally {
    const restored = S.updateAccountingConfiguration(previousConfiguration);
    assert.strictEqual(restored.ok, true, restored.errors.join(' '));
  }
});

test('écriture déséquilibrée acceptée en brouillon mais refusée comme validée', () => {
  const source = [{
    reference: 'OD-2026-EXCHANGE-003', journal: 'OD', date: '2026-08-14', description: 'Lot incomplet',
    sourceSystem: 'EXCEL', sourceId: 'excel-003',
    lines: [{ account: '601100', debit: 1000, credit: 0 }, { account: '401100', debit: 0, credit: 900 }]
  }];
  assert.strictEqual(S.previewExchangeImport(source, 'draft', { sourceSystem: 'EXCEL' }).ok, true);
  const postedPreview = S.previewExchangeImport(source, 'posted', { sourceSystem: 'EXCEL' });
  assert.strictEqual(postedPreview.ok, false);
  assert.ok(postedPreview.errors.some(error => error.includes('pas équilibrée')));
  const before = S.entries().length;
  const failedBatch = S.importExchange(source, 'posted', { sourceSystem: 'EXCEL' });
  assert.strictEqual(failedBatch.ok, false);
  assert.strictEqual(S.entries().length, before, 'Un lot bloqué ne doit laisser aucune écriture partielle.');
});

test('import validé augmente les états et crée le point local de restauration', () => {
  const source = [{
    reference: 'OD-2026-EXCHANGE-004', journal: 'OD', date: '2026-08-15', description: 'Reprise validée',
    sourceSystem: 'SAGE', sourceId: 'sage-004',
    lines: [{ account: '601100', debit: 4200, credit: 0 }, { account: '401100', debit: 0, credit: 4200 }]
  }];
  const before = S.kpis().debit;
  const result = S.importExchange(source, 'posted', { sourceSystem: 'SAGE' });
  assert.strictEqual(result.ok, true, result.errors.join(' '));
  assert.strictEqual(S.entry(S.entries().find(entry => entry.reference === source[0].reference).id).status, 'posted');
  assert.strictEqual(S.kpis().debit, before + 4200);
  assert.strictEqual(S.backupInfo().available, true);
});

test('import annulé si le point de restauration ne peut pas être écrit', () => {
  const source = [{
    reference: 'OD-2026-EXCHANGE-BACKUP-FAIL', journal: 'OD', date: '2026-08-16', description: 'Doit rester absent',
    sourceSystem: 'EXCEL', sourceId: 'excel-backup-fail',
    lines: [{ account: '601100', debit: 500, credit: 0 }, { account: '401100', debit: 0, credit: 500 }]
  }];
  const before = S.entries().length;
  storageWritesBlocked = true;
  const result = S.importExchange(source, 'draft', { sourceSystem: 'EXCEL' });
  storageWritesBlocked = false;
  assert.strictEqual(result.ok, false);
  assert.ok(result.errors[0].includes('point de restauration'));
  assert.strictEqual(S.entries().length, before);
});

test('point de restauration local avant remplacement et restauration', () => {
  const before = S.getState();
  const beforeSummary = { accounts: before.accounts.length, entries: before.entries.length, debit: S.kpis().debit };
  S.reset();
  const backup = S.backupInfo();
  assert.strictEqual(backup.available, true);
  assert.strictEqual(backup.accountCount, beforeSummary.accounts);
  assert.strictEqual(backup.entryCount, beforeSummary.entries);
  const restored = S.restoreBackup();
  assert.strictEqual(restored.ok, true, restored.errors.join(' '));
  assert.strictEqual(S.accounts().length, beforeSummary.accounts);
  assert.strictEqual(S.entries().length, beforeSummary.entries);
  assert.strictEqual(S.kpis().debit, beforeSummary.debit);
});

console.log('');
if (process.exitCode) {
  console.error('Échec des tests.');
} else {
  console.log(passed + ' tests réussis.');
}
