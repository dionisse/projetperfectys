/* Historique des écritures du journal consultable sous la saisie, du plus récent au plus ancien. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const start = appSource.indexOf('function entryJournalHistoryEntries(');
const end = appSource.indexOf('function entryJournalHistoryHtml(', start + 1);
assert.notEqual(start, -1, 'le tri des pièces du journal doit être centralisé');
assert.notEqual(end, -1, 'la fonction de rendu doit suivre le tri');
const renderStart = end;
const renderEnd = appSource.indexOf('function lineRowHtml(', renderStart + 1);
const historyFunction = appSource.slice(start, end);
const historyRenderer = appSource.slice(renderStart, renderEnd);
const entries = [
  { id: 'old', journal: 'AC', date: '2025-12-31', reference: 'AC-01', status: 'draft', lines: [] },
  { id: 'newest', journal: 'AC', date: '2026-01-02', reference: 'AC-02', status: 'posted', lines: [], createdAt: '2026-01-02T08:00:00.000Z' },
  { id: 'same-date-later', journal: 'AC', date: '2026-01-02', reference: 'AC-03', status: 'posted', lines: [], updatedAt: '2026-01-02T10:00:00.000Z' },
  { id: 'other-journal', journal: 'BQ', date: '2026-01-03', reference: 'BQ-01', status: 'posted', lines: [] }
];
const sandbox = {
  S: { entries: () => entries, journal: code => ({ code }), totals: () => ({ debit: 0, credit: 0 }) },
  esc: value => String(value),
  dateLabel: value => value,
  amount: value => String(value),
  statusBadge: value => value,
  journalDisplayName: journal => journal.code
};
vm.runInNewContext(historyFunction + historyRenderer + 'globalThis.historyEntries = entryJournalHistoryEntries; globalThis.renderHistory = entryJournalHistoryHtml;', sandbox);
assert.deepEqual(Array.from(sandbox.historyEntries('AC'), entry => entry.id), ['same-date-later', 'newest', 'old']);
const historyHtml = sandbox.renderHistory('AC');
assert.ok(historyHtml.indexOf('AC-03') < historyHtml.indexOf('AC-02') && historyHtml.indexOf('AC-02') < historyHtml.indexOf('AC-01'));
assert.doesNotMatch(historyHtml, /BQ-01/, 'les pièces d’un autre journal sont exclues');

assert.match(appSource, /return html \+ '<div id="entry-journal-history-container">' \+ entryJournalHistoryHtml\(model\.journal\)/,
  'la liste est rendue directement sous le formulaire');
assert.match(appSource, /Pièces du journal · /);
assert.match(appSource, /data-action="open-entry"/);
assert.match(appSource, /var historyContainer = \$\('#entry-journal-history-container'\);[\s\S]*entryJournalHistoryHtml\(input\.value\)/,
  'le journal sélectionné actualise immédiatement la liste affichée');
assert.match(appSource, /entryRouteContext[\s\S]*navigate\('#\/entry\?journal='/,
  'après enregistrement, la saisie reste ouverte sur le journal pour consulter l’historique');
assert.match(appSource, /function entryJournalHistoryEntries[\s\S]*String\(right\.date \|\| ''\)\.localeCompare\(String\(left\.date \|\| ''\)\)/,
  'le tri principal est chronologique décroissant');

console.log('Historique sous la saisie : filtrage par journal, consultation du détail et ordre chronologique décroissant vérifiés.');
