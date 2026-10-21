/* Paramétrage analytique par dossier : listes libres, validation et verrouillage. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const values = new Map();
let storageWritesBlocked = false;
const localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) {
    if (storageWritesBlocked) throw new Error('quota simulé');
    values.set(key, String(value));
  },
  removeItem(key) { values.delete(key); }
};

function loadStore() {
  const sandbox = { window: {}, localStorage, Intl, JSON, Date, Math, String, Number, Object, Array };
  sandbox.window.localStorage = localStorage;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'accounting-chart.js'), 'utf8'), sandbox, { filename: 'accounting-chart.js' });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  return sandbox.window.PerfectoStore;
}

const store = loadStore();
const defaults = store.analyticalSectionsConfiguration();
const initialEntryCount = store.entries().length;
const initialAccountCount = store.accounts().length;
assert.deepEqual(JSON.parse(JSON.stringify(defaults)), {
  mainSections: [], auxiliarySections: [], accounts: [], configured: false, validatedAt: ''
}, 'les listes vides sont les valeurs par défaut de chaque dossier');

const emptyValidation = store.saveAnalyticalSectionsConfiguration({ mainSections: '', auxiliarySections: '', accounts: '' });
assert.equal(emptyValidation.ok, false, 'les listes vides restent le défaut tant qu’aucune valeur n’est saisie');

const saved = store.saveAnalyticalSectionsConfiguration({
  mainSections: 'Direction\nAtelier',
  auxiliarySections: 'Projet A',
  accounts: '601100\n622100'
});
assert.equal(saved.ok, true, saved.errors && saved.errors.join(' '));
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalSectionsConfiguration())), {
  mainSections: ['Direction', 'Atelier'],
  auxiliarySections: ['Projet A'],
  accounts: ['601100', '622100'],
  configured: true,
  validatedAt: store.analyticalSectionsConfiguration().validatedAt
});
assert.ok(store.analyticalSectionsConfiguration().validatedAt, 'la validation est horodatée');
assert.equal(store.entries().length, initialEntryCount, 'aucune écriture comptable ou analytique n’est créée par le paramétrage');
assert.equal(store.accounts().length, initialAccountCount, 'la liste Comptes ne modifie pas le plan comptable général');

const persistedCatalog = JSON.parse(values.get('perfecto.dossiers.v1'));
assert.deepEqual(persistedCatalog[0].analyticalSectionsConfiguration.mainSections, ['Direction', 'Atelier']);
assert.equal(persistedCatalog[0].analyticalSectionsConfiguration.configured, true, 'les listes sont persistées avec le dossier');

const secondSave = store.saveAnalyticalSectionsConfiguration({ mainSections: 'Remplacement', auxiliarySections: '', accounts: '' });
assert.equal(secondSave.ok, false, 'après validation, les listes sont verrouillées et grisées');
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalSectionsConfiguration().mainSections)), ['Direction', 'Atelier']);

const other = store.createDossier({
  clientName: 'Analytique isolée', clientCode: 'ANI', accountingTypeLabel: 'Comptabilité révisée SYSCOHADA',
  accountingTypeCode: 'COR', cycleStart: '2026-01-01', cycleEnd: '2026-12-31'
});
assert.equal(other.ok, true, other.errors && other.errors.join(' '));
assert.equal(store.switchDossier(other.dossier.id).ok, true);
assert.equal(store.analyticalSectionsConfiguration().configured, false);
assert.deepEqual(JSON.parse(JSON.stringify(store.analyticalSectionsConfiguration().accounts)), [], 'aucune liste analytique n’est copiée depuis un autre dossier');

storageWritesBlocked = true;
const failed = store.saveAnalyticalSectionsConfiguration({ mainSections: 'Centre', auxiliarySections: '', accounts: '' });
storageWritesBlocked = false;
assert.equal(failed.ok, false, 'un quota local bloque la validation');
assert.equal(store.analyticalSectionsConfiguration().configured, false, 'les valeurs ne sont pas considérées validées en cas d’échec de stockage');

console.log('  ✓ Configuration analytique conservée par dossier puis grisée après validation ; aucune opération comptable activée.');
