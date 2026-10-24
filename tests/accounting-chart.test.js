/* Tests du référentiel SYSCOHADA transcrit et de sa migration conservatrice. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Chart = require('../modern-proto/js/accounting-chart.js');

assert.equal(Chart.VERSION, 2);
assert.equal(Chart.accountCount(), 1400);
assert.equal(Chart.METADATA.sourceFile, 'NOMENCLATURE-DES-COMPTES-SYSCOHADA-FINAL-1.pdf');
assert.equal(Chart.METADATA.sourcePdfSha256, '3d90abdfc6c741cfa0f2a3168ad1b696d3dd7d3d40bd1669119a7883f1c5f43c');
assert.equal(Chart.METADATA.sourcePages, 37);
assert.deepEqual(JSON.parse(JSON.stringify(Chart.METADATA.classCounts)), {
  1: 151, 2: 286, 3: 84, 4: 257, 5: 92, 6: 258, 7: 128, 8: 54, 9: 90
});

const accounts = Chart.accounts();
assert.equal(accounts.length, 1400);
assert.equal(new Set(Chart.codes()).size, 1400, 'le référentiel ne comporte aucun code dupliqué');
assert.deepEqual(
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map(cls => accounts.filter(account => account.cls === cls).length),
  [151, 286, 84, 257, 92, 258, 128, 54, 90]
);
for (const account of accounts) {
  assert.ok(account.label, `le compte ${account.code} possède un libellé transcrit`);
  assert.ok(account.classLabel, `le compte ${account.code} possède une classe libellée`);
  assert.ok(account.subclass, `le compte ${account.code} possède un code de sous-classe`);
  assert.ok(account.subclassLabel, `le compte ${account.code} possède une sous-classe libellée`);
  assert.equal(account.cls, Number(account.code.charAt(0)));
  assert.ok(Number.isInteger(account.sourcePage) && account.sourcePage >= 1 && account.sourcePage <= 37,
    `le compte ${account.code} renvoie à une page source`);
}
assert.equal(accounts.find(account => account.code === '101').subclass, '10');
assert.equal(accounts.find(account => account.code === '101').classLabel, 'Ressources durables');
assert.equal(accounts.find(account => account.code === '10').postable, false, 'une rubrique de regroupement n’est pas imputable');
assert.equal(accounts.find(account => account.code === '601').postable, true);
assert.equal(accounts.find(account => account.code === '81').postable, false, 'un indicateur de gestion n’est pas une ligne de journal');
assert.equal(accounts.find(account => account.code === '891').postable, true);
assert.ok(accounts.filter(account => account.cls === 9).every(account => account.postable === false),
  'la classe 9 reste une référence seule et n’est pas rendue imputable');
assert.equal(accounts.find(account => account.code === '1551').label, 'Reconstitution des gisements miniers et pétroliers');
assert.equal(accounts.find(account => account.code === '1551').sourcePage, 7, 'le code 1551 et son libellé ont été vérifiés dans la page physique 7 du PDF');
assert.equal(accounts.find(account => account.code === '10').usage, '', 'aucune utilisation absente du PDF n’est inventée');

const values = new Map();
const originalEntries = [{
  id: 'legacy-entry-1', reference: 'AC-2026-001', journal: 'AC', date: '2026-01-12',
  description: 'Écriture historique', status: 'posted',
  lines: [
    { account: '601100', debit: 500000, credit: 0 },
    { account: '401100', debit: 0, credit: 500000 }
  ],
  sourceMetadata: { note: 'ne pas modifier' }
}];
const previous601 = Chart.previousVersionOneAccount('601');
const previous401 = Chart.previousVersionOneAccount('401');
assert.ok(previous601 && previous401, 'les anciennes valeurs par défaut v1 sont conservées pour la migration');
const oldState = {
  version: 1,
  exercise: 2026,
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31',
  accounts: [
    { code: '601', label: previous601.label, cls: 6, nature: previous601.nature, usage: previous601.usage, aux: false, active: true, standard: true },
    { code: '401', label: 'Fournisseurs personnalisés', cls: 4, nature: 'Passif', usage: 'Usage propre au dossier', aux: true, active: true, standard: true },
    { code: '755', label: 'Libellé historique personnalisé', cls: 7, nature: 'Produit', usage: 'Usage historique personnalisé', aux: false, active: true, standard: true },
    { code: '101200', label: 'Capital social', cls: 1, nature: 'Passif', aux: false, active: true },
    { code: '401100', label: 'Fournisseurs', cls: 4, nature: 'Passif', aux: true, active: true },
    { code: '601100', label: 'Achats de marchandises', cls: 6, nature: 'Charge', aux: false, active: true },
    { code: '604500', label: 'Compte personnalisé à conserver', cls: 6, nature: 'Charge', aux: false, active: true }
  ],
  journals: [
    { code: 'AC', label: 'Journal des achats', type: 'Achat' },
    { code: 'OD', label: 'Opérations diverses', type: 'Divers' }
  ],
  entries: originalEntries,
  periods: Array.from({ length: 12 }, (_, index) => ({ year: 2026, month: index + 1, status: 'open' }))
};
const originalRaw = JSON.stringify(oldState);
values.set('perfecto.lot1.v1', originalRaw);
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); }
};
const sandbox = { window: { localStorage }, Intl, JSON, Date, Math, String, Number, Object, Array };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
const store = sandbox.window.PerfectoStore;
const migratedAccounts = store.accounts();
assert.equal(migratedAccounts.filter(account => account.standard).length, 1400, 'la migration ajoute le référentiel complet');
assert.equal(store.account('601').label, accounts.find(account => account.code === '601').label,
  'une valeur par défaut v1 est actualisée depuis le PDF');
assert.equal(store.account('601').usage, accounts.find(account => account.code === '601').usage,
  'l’usage non personnalisé suit aussi la mise à jour de référence');
assert.equal(store.account('401').label, 'Fournisseurs personnalisés', 'un libellé personnalisé est préservé');
assert.equal(store.account('401').usage, 'Usage propre au dossier', 'une utilisation personnalisée est préservée');
assert.equal(store.account('755').legacy, true, 'un compte standard v1 absent du nouveau PDF est conservé comme historique');
assert.equal(store.account('755').label, 'Libellé historique personnalisé', 'le libellé dossier de l’ancien compte reste inchangé');
assert.equal(store.account('755').usage, 'Usage historique personnalisé', 'l’utilisation personnalisée de l’ancien compte reste inchangée');
assert.equal(store.account('101200').legacy, true);
assert.equal(store.account('101200').active, true, 'un ancien compte reste utilisable pour la compatibilité');
assert.equal(store.account('601100').legacy, true);
assert.equal(store.account('601100').active, true, 'un compte ancien référencé dans des pièces est conservé');
assert.equal(store.account('604500').label, 'Compte personnalisé à conserver');
assert.equal(store.account('604500').legacy, false, 'un compte ajouté n’est pas confondu avec un ancien compte standard');
assert.equal(store.getState().accountChartVersion, Chart.VERSION);
assert.deepEqual(JSON.parse(JSON.stringify(store.entries())), originalEntries, 'les écritures validées et leurs métadonnées restent strictement inchangées');
assert.equal(values.get('perfecto.lot1.v1'), JSON.stringify(store.getState()), 'la version enrichie est persistée dans le dossier existant');
const backup = JSON.parse(values.get('perfecto.lot1.backup.v1'));
assert.deepEqual(backup.data, oldState, 'la base d’origine est sauvegardée avant l’ajout du référentiel');
const rejectedGroupEntry = store.validateEntry({
  reference: 'OD-2026-TEST-GROUPE', journal: 'OD', date: '2026-02-10',
  lines: [{ account: '10', debit: 10, credit: 0 }, { account: '401', debit: 0, credit: 10 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(rejectedGroupEntry.ok, false, 'une rubrique non imputable ne peut pas recevoir une écriture');
assert.ok(rejectedGroupEntry.errors.some(error => /non imputable/.test(error)));
const rejectedClassNineEntry = store.validateEntry({
  reference: 'OD-2026-TEST-CLASSE-9', journal: 'OD', date: '2026-02-10',
  lines: [{ account: '90', debit: 10, credit: 0 }, { account: '401', debit: 0, credit: 10 }]
}, { requireBalanced: true, status: 'posted' });
assert.equal(rejectedClassNineEntry.ok, false, 'les comptes classe 9 de référence ne sont pas activés dans la saisie générale');
assert.ok(rejectedClassNineEntry.errors.some(error => /non imputable/.test(error)));

console.log('Plan comptable SYSCOHADA : 1 400 codes, 9 classes, page source 1551 vérifiée, migration conservatrice et classe 9 non imputable — OK');
