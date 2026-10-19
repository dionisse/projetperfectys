/* Lettrage et pointage : registres séparés, persistés par dossier, sans réécrire les pièces. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, localStorage, Intl, console, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
const storeSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8');
function loadStore() {
  vm.runInContext(storeSource, sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

let store = loadStore();
assert.equal(store.getState().reconciliationRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.matchingGroups())), []);
assert.deepEqual(JSON.parse(JSON.stringify(store.pointageMarks())), []);

// Une ancienne base migrée reçoit des registres vides sans toucher aux écritures.
const storageKey = store.currentStorageKey();
const beforeMigrationEntries = JSON.stringify(store.entries());
const legacy = JSON.parse(values.get(storageKey));
delete legacy.reconciliationRegistryVersion;
delete legacy.matchingGroups;
delete legacy.matchingSequence;
delete legacy.pointageMarks;
delete legacy.pointageSequence;
values.set(storageKey, JSON.stringify(legacy));
store = loadStore();
assert.equal(store.getState().reconciliationRegistryVersion, 1);
assert.deepEqual(JSON.parse(JSON.stringify(store.matchingGroups())), []);
assert.deepEqual(JSON.parse(JSON.stringify(store.pointageMarks())), []);
assert.equal(JSON.stringify(store.entries()), beforeMigrationEntries, 'la migration ne modifie aucune pièce comptable');

function createPostedEntry(date, description, lines) {
  const result = store.createEntry({
    date,
    journal: 'OD',
    reference: store.nextReference('OD', date),
    description,
    lines
  }, 'posted');
  assert.equal(result.ok, true, result.errors.join(' '));
  return result.entry;
}
const debitEntry = createPostedEntry('2026-01-10', 'Facture fournisseur à lettrer', [
  { account: '401', debit: 100, credit: 0 },
  { account: '521', debit: 0, credit: 100 }
]);
const creditEntry = createPostedEntry('2026-01-18', 'Règlement fournisseur à lettrer', [
  { account: '521', debit: 100, credit: 0 },
  { account: '401', debit: 0, credit: 100 }
]);
const partialEntry = createPostedEntry('2026-01-22', 'Avoir fournisseur partiel', [
  { account: '521', debit: 40, credit: 0 },
  { account: '401', debit: 0, credit: 40 }
]);
const debitKey = debitEntry.id + ':0';
const creditKey = creditEntry.id + ':1';
const partialKey = partialEntry.id + ':1';
const beforeLettrageEntries = JSON.stringify(store.entries());

assert.equal(store.assignLetter('401', [debitKey, partialKey]).ok, false, 'un lettrage déséquilibré est refusé');
assert.equal(store.assignLetter('521', [debitEntry.id + ':1', creditEntry.id + ':0']).ok, false, 'le lettrage est réservé aux comptes auxiliaires de classe 4');
const firstLetter = store.assignLetter('401', [debitKey, creditKey]);
assert.equal(firstLetter.ok, true, firstLetter.errors.join(' '));
assert.equal(firstLetter.matchingGroup.code, 'LET-2026-0001');
assert.equal(firstLetter.matchingGroup.debit, 100);
assert.equal(firstLetter.matchingGroup.credit, 100);
assert.equal(store.matchingForLine(debitKey).code, firstLetter.matchingGroup.code);
assert.equal(store.assignLetter('401', [debitKey, creditKey]).ok, false, 'une ligne ne peut pas appartenir à deux lettrages actifs');
assert.equal(JSON.stringify(store.entries()), beforeLettrageEntries, 'le lettrage est un registre séparé, sans modification du grand livre');

assert.equal(store.cancelLetter(firstLetter.matchingGroup.id).ok, true);
assert.equal(store.matchingForLine(debitKey), null, 'l’annulation libère les lignes');
const secondLetter = store.assignLetter('401', [debitKey, creditKey]);
assert.equal(secondLetter.ok, true, secondLetter.errors.join(' '));
assert.equal(secondLetter.matchingGroup.code, 'LET-2026-0002', 'un code de lettrage annulé n’est pas réutilisé');
assert.equal(store.matchingGroups('401').length, 1);

const beforePointageEntries = JSON.stringify(store.entries());
const firstPointage = store.pointEntryLine(debitEntry.id + ':1', '2026-01-31');
assert.equal(firstPointage.ok, true, firstPointage.errors.join(' '));
assert.equal(firstPointage.pointageMark.code, 'PNT-2026-0001');
assert.equal(firstPointage.pointageMark.statementDate, '2026-01-31');
assert.equal(store.pointageForLine(debitEntry.id + ':1').code, firstPointage.pointageMark.code);
assert.equal(store.pointEntryLine(debitEntry.id + ':1').ok, false, 'une ligne ne peut être pointée deux fois');
assert.equal(store.pointEntryLine(debitKey).ok, false, 'le pointage est réservé aux comptes de trésorerie de classe 5');
assert.equal(store.pointEntryLine(creditEntry.id + ':0', '31/01/2026').ok, false, 'la date de relevé doit être au format ISO valide');
assert.equal(JSON.stringify(store.entries()), beforePointageEntries, 'le pointage ne modifie aucune écriture');

assert.equal(store.unpointEntryLine(debitEntry.id + ':1').ok, true);
assert.equal(store.pointageForLine(debitEntry.id + ':1'), null, 'le retrait du pointage libère la ligne');
const secondPointage = store.pointEntryLine(debitEntry.id + ':1');
assert.equal(secondPointage.ok, true, secondPointage.errors.join(' '));
assert.equal(secondPointage.pointageMark.code, 'PNT-2026-0002', 'un code de pointage retiré n’est pas réutilisé');

// La migration reconstitue les compteurs à partir des codes déjà utilisés et conserve l’historique.
const beforeReloadEntries = JSON.stringify(store.entries());
const beforeReload = JSON.parse(values.get(storageKey));
delete beforeReload.reconciliationRegistryVersion;
delete beforeReload.matchingSequence;
delete beforeReload.pointageSequence;
values.set(storageKey, JSON.stringify(beforeReload));
store = loadStore();
assert.equal(store.getState().matchingSequence, 3);
assert.equal(store.getState().pointageSequence, 3);
assert.equal(store.matchingGroups('401').length, 1);
assert.equal(store.pointageForLine(debitEntry.id + ':1').code, 'PNT-2026-0002');
assert.equal(JSON.stringify(store.entries()), beforeReloadEntries);

const otherDossier = store.createDossier({
  clientName: 'Dossier de contrôle', clientCode: 'CTRL',
  accountingTypeLabel: 'Comptabilité révisée SYSCOHADA', accountingTypeCode: 'COR',
  cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(otherDossier.ok, true, otherDossier.errors.join(' '));
assert.equal(store.switchDossier(otherDossier.dossier.id).ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(store.matchingGroups())), [], 'les lettrages sont isolés par dossier');
assert.deepEqual(JSON.parse(JSON.stringify(store.pointageMarks())), [], 'les pointages sont isolés par dossier');

console.log('Lettrage et pointage : validation des lignes, historique, migrations, isolation par dossier et immuabilité des écritures — OK');
