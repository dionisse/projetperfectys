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

test('les cinq entrées regroupent les mouvements et les changements d’échelon', () => {
  const groups = JSON.parse(JSON.stringify(context.payrollPersonnelReportSections()));
  assert.deepEqual(groups.map(group => group.items.map(item => item.label)), [
    ['Liste du Personnel', 'Etat cumulé du Personnel'],
    ['Dernières embauches et derniers débauchages'],
    ['Modes de règlement', 'Changements et retards d’échelon']
  ]);
  assert.equal(new Set(groups.flatMap(group => group.items.map(item => item.id))).size, 5);
  const html = context.viewPayrollPersonnelReports();
  assert.equal((html.match(/data-action="payroll-personnel-report-select"/g) || []).length, 5);
  assert.equal((html.match(/class="payroll-current-report-group"/g) || []).length, 3);
  assert.match(html, /Les cinq états du personnel sont disponibles en brouillon test/i);
  assert.match(app, /selectedItem\.id === 'personnel-reports'\) panel = viewPayrollPersonnelReports\(\)/);
});

test('chaque choix identifie l’état sans prétendre le produire', () => {
  const items = context.payrollPersonnelReportSections().flatMap(group => group.items);
  for (const item of items) {
    context.ui.payrollPersonnelReportId = item.id;
    const html = context.viewPayrollPersonnelReports();
    if (item.id === 'personnel-list') { assert.match(html, /payroll-personnel-list-workspace/); continue; }
    if (item.id === 'personnel-cumulative') { assert.match(html, /payroll-personnel-cumulative-workspace/); continue; }
    if (item.id === 'step-changes') { assert.match(html, /payroll-personnel-step-changes-workspace/); continue; }
    if (item.id === 'payment-methods') { assert.match(html, /payroll-personnel-payment-methods-workspace/); continue; }
    if (item.id === 'personnel-movements') { assert.match(html, /payroll-personnel-movements-workspace/); assert.match(html, /data-movement-mode="hires"/); continue; }
    assert.match(html, new RegExp('data-personnel-report-id="' + item.id + '" aria-pressed="true"'));
    assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    assert.ok(html.includes('<h4>' + context.esc(item.label) + '</h4>'));
    assert.match(html, /Aucun état ni fichier n’est produit/);
  }
  assert.match(app, /case 'payroll-personnel-report-select':[\s\S]*moduleId: 'payroll-hr', actionId: 'module.view'/);
  assert.match(app, /ui\.payrollMainMenu !== 'Editions' \|\| ui\.payrollMenuItem !== 'personnel-reports'/);
  assert.match(app, /if \(!knownPersonnelReport\) break/);
});

test('chaque formulaire disponible numérote ses sections dans le même ordre', () => {
  for (const name of ['list', 'cumulative', 'movements', 'payment-methods', 'step-changes']) {
    const source = fs.readFileSync(path.join(__dirname, '../modern-proto/js/payroll-personnel-' + name + '.js'), 'utf8');
    assert.match(source, /<legend><span class="rubric-step">01<\/span> Sélection<\/legend>/, name);
    assert.match(source, /<legend><span class="rubric-step">02<\/span> Colonnes à imprimer<\/legend>/, name);
    assert.ok(source.indexOf('rubric-step">01') < source.indexOf('rubric-step">02'), name);
  }
});
