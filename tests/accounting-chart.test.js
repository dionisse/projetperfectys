/* Tests du référentiel comptable fourni et de sa migration conservatrice. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Chart = require('../modern-proto/js/accounting-chart.js');

const expectedCodes = [
  '10', '101', '102', '104', '11', '111', '112', '118', '12', '121', '129', '13', '131', '139', '161', '162', '163', '164', '165', '168',
  '20', '211', '212', '213', '214', '215', '221', '222', '224', '231', '232', '234', '241', '242', '244', '245', '246', '251', '271', '281', '283', '284',
  '311', '312', '321', '322', '331', '335', '351', '352', '361', '38', '391',
  '401', '402', '404', '408', '409', '411', '412', '413', '416', '419', '421', '422', '425', '427', '431', '441', '443', '444', '447', '449', '451', '471', '481', '486', '487', '488',
  '521', '522', '523', '524', '531', '541', '571', '572', '581',
  '601', '602', '604', '605', '608', '609', '611', '612', '613', '618', '621', '622', '623', '624', '625', '626', '627', '628', '631', '634', '636', '641', '643', '644', '645', '647', '651', '659', '661', '664', '671', '681', '691', '695',
  '701', '702', '703', '706', '707', '709', '721', '722', '731', '752', '755', '758', '761', '771', '791',
  '81', '82', '83', '84', '85', '86', '87', '88', '891', '892'
];

assert.equal(Chart.accountCount(), 147);
assert.deepEqual(Chart.codes(), expectedCodes, 'les 147 codes, leur ordre par classe et les zéros éventuels sont préservés');
assert.equal(new Set(Chart.codes()).size, 147, 'le référentiel ne comporte aucun doublon');
assert.deepEqual(
  [1, 2, 3, 4, 5, 6, 7, 8].map(cls => Chart.accounts().filter(account => account.cls === cls).length),
  [20, 22, 11, 26, 9, 34, 15, 10]
);
for (const account of Chart.accounts()) {
  assert.ok(account.label, `le compte ${account.code} possède un libellé`);
  assert.ok(account.classLabel, `le compte ${account.code} possède une classe libellée`);
  assert.ok(account.subclass, `le compte ${account.code} possède un code de sous-classe`);
  assert.ok(account.subclassLabel, `le compte ${account.code} possède une sous-classe libellée`);
  assert.ok(account.usage, `le compte ${account.code} possède une utilisation`);
  assert.equal(account.cls, Number(account.code.charAt(0)));
}
assert.equal(Chart.accounts().find(account => account.code === '101').subclass, '10');
assert.equal(Chart.accounts().find(account => account.code === '101').classLabel, 'Ressources durables');
assert.equal(Chart.accounts().find(account => account.code === '10').postable, false, 'une rubrique de regroupement n’est pas imputable');
assert.equal(Chart.accounts().find(account => account.code === '601').postable, true);
assert.equal(Chart.accounts().find(account => account.code === '81').postable, false, 'un indicateur de gestion n’est pas une ligne de journal');
assert.equal(Chart.accounts().find(account => account.code === '891').postable, true);

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
const oldState = {
  version: 1,
  exercise: 2026,
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31',
  accounts: [
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
assert.equal(migratedAccounts.filter(account => account.standard).length, 147);
assert.ok(store.account('601'));
assert.equal(store.account('601100').legacy, true);
assert.equal(store.account('601100').active, true, 'un ancien compte reste utilisable pour la compatibilité');
assert.equal(store.account('604500').label, 'Compte personnalisé à conserver');
assert.equal(store.account('604500').legacy, false, 'un compte personnalisé n’est pas confondu avec l’ancien référentiel');
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

console.log('Plan comptable : 147 codes, classes/sous-classes et migration historique non destructive — OK');
