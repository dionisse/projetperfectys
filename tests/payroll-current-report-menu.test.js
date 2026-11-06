'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const app=fs.readFileSync('modern-proto/js/app.js','utf8');
const source=app.slice(app.indexOf('  function payrollCurrentMonthReportSections() {'),app.indexOf('  function payrollMenuSections(menu) {'));
const sections=Function(source+'; return payrollCurrentMonthReportSections();')();
test('les 15 états du mois reprennent les libellés et les groupes de la capture',()=>{
 assert.deepEqual(sections.map(group=>group.items.map(item=>item.label)),[
  ['Livre de paie détaillé','Livre de paie cumulé'],
  ['Etat des paiements en espèces','Etat des chèques à établir','Ordre unique de virements','Ordres multiples de virements avec chèque joint','Ordres multiples de virements par débit de notre compte','Ordres multiples de virement par fichier-texte'],
  ['Avances accordées','Suivi des avances par employés','Suivi des avances par nature','Evolution des avances de chaque employé'],
  ['Cumul par Services des rubriques de salaire','Cumul par zones des rubriques de salaire'],
  ['Variations des éléments fixes']
 ]);
 const items=sections.flatMap(group=>group.items);assert.equal(items.length,15);assert.equal(new Set(items.map(item=>item.id)).size,15);
});
test('navigation clairement provisoire et ne lançant aucune opération',()=>{
 assert.match(app,/selectedItem\.id === 'current-month-payroll-reports'\) panel = viewPayrollCurrentMonthReports\(\)/);
 assert.match(app,/data-action="payroll-current-report-select"/);assert.match(app,/case 'payroll-current-report-select':[\s\S]*?return \{ moduleId: 'payroll-hr', actionId: 'module.view' \}/);
 assert.match(app,/Aucun état, fichier ou opération/i); assert.equal(sections[0].items[0].ready,true);assert.equal(sections[0].items[1].ready,true);assert.equal(sections[1].items[0].ready,true);assert.equal(sections[1].items[1].ready,true);assert.equal(sections[1].items[2].ready,true);assert.equal(sections[1].items[3].ready,true);assert.equal(sections[1].items[4].ready,true);assert.equal(sections[1].items[5].ready,true);assert.equal(sections.flatMap(s=>s.items).filter(i=>!i.ready).length,7);assert.match(app,/Aucun ordre bancaire ni paiement ne peut être exécuté/);assert.match(app,/n’existe pas encore de registre lié des avances/);
 assert.doesNotMatch(source,/localStorage|\.setItem|fetch\(|window\.open/);
});

test('typographie des sous-éléments harmonisée avec les sous-menus',()=>{
 const css=fs.readFileSync('modern-proto/css/modern.css','utf8');
 assert.match(css,/\.accounting-subtab \{[^}]*font-size: \.72rem;[^}]*font-weight: 700;/);
 assert.match(css,/\.payroll-current-report-item \{[^}]*font-family:inherit; font-size:\.72rem; font-weight:700; line-height:1\.3;/);
 assert.match(css,/@media \(max-width:700px\) \{ \.payroll-current-report-item \{ font-size:\.68rem;/);
});
