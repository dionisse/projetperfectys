'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../modern-proto/js/app.js'), 'utf8');
function functionSource(name, nextName) {
  const start = app.indexOf('  function ' + name + '(');
  const end = app.indexOf('  function ' + nextName + '(', start);
  assert.ok(start >= 0 && end > start);
  return app.slice(start, end);
}
const context = vm.createContext({
  ui: { payrollPersonnelReportId: '' },
  esc: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
});
vm.runInContext(functionSource('payrollPersonnelReportSections', 'payrollDeclarationItems') + functionSource('viewPayrollPersonnelReports', 'viewPayrollDeclarations'), context);

test('les sept éléments et leurs séparateurs suivent la capture', () => {
  const groups = JSON.parse(JSON.stringify(context.payrollPersonnelReportSections()));
  assert.deepEqual(groups.map(group => group.items.map(item => item.label)), [
    ['Liste du Personnel', 'Etat cumulé du Personnel'],
    ['Dernières Embauches', 'Derniers Débauchages'],
    ['Modes de règlement', "Changements d'échelon à effectuer", "Retards de changement d'échelons"]
  ]);
  assert.equal(new Set(groups.flatMap(group => group.items.map(item => item.id))).size, 7);
  const html = context.viewPayrollPersonnelReports();
  assert.equal((html.match(/data-action="payroll-personnel-report-select"/g) || []).length, 7);
  assert.equal((html.match(/class="payroll-current-report-group"/g) || []).length, 3);
  assert.match(html, /liste et l’état cumulé du personnel sont disponibles en brouillon test/i);
  assert.match(app, /selectedItem\.id === 'personnel-reports'\) panel = viewPayrollPersonnelReports\(\)/);
});

test('chaque choix identifie l’état sans prétendre le produire', () => {
  const items = context.payrollPersonnelReportSections().flatMap(group => group.items);
  for (const item of items) {
    context.ui.payrollPersonnelReportId = item.id;
    const html = context.viewPayrollPersonnelReports();
    if (item.id === 'personnel-list') { assert.match(html, /payroll-personnel-list-workspace/); continue; }
    if (item.id === 'personnel-cumulative') { assert.match(html, /payroll-personnel-cumulative-workspace/); continue; }
    assert.match(html, new RegExp('data-personnel-report-id="' + item.id + '" aria-pressed="true"'));
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.ok(html.includes('<h4>' + context.esc(item.label) + '</h4>'));
    assert.match(html, /Aucun état ni fichier n’est produit/);
  }
  assert.match(app, /case 'payroll-personnel-report-select':[\s\S]*moduleId: 'payroll-hr', actionId: 'module.view'/);
  assert.match(app, /ui\.payrollMainMenu !== 'Editions' \|\| ui\.payrollMenuItem !== 'personnel-reports'/);
  assert.match(app, /if \(!knownPersonnelReport\) break/);
});
