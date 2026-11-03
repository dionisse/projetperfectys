/* Contrat UI du pont de traçabilité bidirectionnel Analytics ↔ Comptabilité générale. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'js', 'journal-lines-report.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'analytical-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'analytical-tables.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(app, /function analyticalMenuHash[\s\S]*extra\.entryId[\s\S]*extra\.lineId/);
assert.match(app, /function viewAnalyticalSourceEntry\(params\)/);
assert.match(app, /S\.entry\(entryId\)/, 'l’identifiant est résolu dans le dossier actif, sans bascule de dossier');
assert.match(app, /SUIVI ANALYTIQUE · PIÈCE SOURCE · LECTURE SEULE/);
assert.match(app, /Consultation de la pièce enregistrée dans le dossier actif/);
assert.match(app, /data-action="edit-posted-entry"[\s\S]*Corriger dans la Comptabilité générale/);
assert.match(app, /Consulter les imputations analytiques de cette pièce/);
assert.match(app, /if \(column\.key === 'piece' && row\.sourceEntryId\)/);
assert.match(app, /entryId: row\.entry\.id, lineId: row\.sourceLineId/);
assert.match(app, /if \(column\.key === 'piece' && row\.sourceEntryId\)/,
  'les liens de source ne sont rendus que sur les lignes détaillées qui portent l’identifiant exact');
assert.match(navigation, /contextOnly: true/);
assert.match(app, /!item\.contextOnly \|\| currentGroup\.id === group\.id && currentItem\.id === item\.id/);
assert.match(report, /selectedEntryId[\s\S]*selectedLineId/);
assert.match(report, /sourceLineId\(entry, line, lineIndex\)/);
assert.match(report, /sourceEntryId: String\(row\.entry && row\.entry\.id \|\| ''\)/);
assert.match(report, /sourceEntryId: row\.sourceEntryId, sourceLineId: row\.sourceLineId/);
assert.match(store, /var lineId = String\(line\.id \|\| ''\)/);
assert.match(store, /id: lineId, account: acc/);
assert.match(app, /data-entry-line-id/);
assert.match(app, /id: row\.getAttribute\('data-entry-line-id'\)/);
assert.match(css, /\.analytical-source-line-focused/);
assert.match(worker, /perfecto-static-v225/);

console.log('Traçabilité analytique bidirectionnelle : source exacte, lecture seule et parcours de correction comptable vérifiés — OK');
