/* Le classeur OHADA part d’un modèle local immuable et préserve ses formules. */
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const fflate = require('../modern-proto/vendor/fflate-0.8.2.js');
require('../modern-proto/js/ohada-financial-statements.js');
const report = globalThis.PerfectoOhadaFinancialStatements;

assert.equal(report.DEFAULT_SELECTED_KEY, 'financial-statements');
assert.deepEqual(report.ITEMS.filter(item => !item.separator).map(item => item.label), [
  'Tableaux financiers OHADA révisé',
  'Déclaration fiscale (IS)',
  'Déclaration IRPP',
  'Déclaration des honoraires',
  'Ensemble des postes détaillés par comptes',
  'Charges détaillées par comptes',
  'Produits détaillés par comptes',
  'Actif détaillé par comptes',
  'Passif détaillé par comptes',
  'Déductions et réintégrations fiscales'
]);
assert.throws(() => report.buildPreview('missing', 2026), /Sélectionnez un état/);
const preview = report.buildPreview(report.DEFAULT_SELECTED_KEY, 2026);
assert.equal(preview.label, 'Tableaux financiers OHADA révisé');
assert.equal(preview.exercise, 2026);
assert.equal(preview.generatedLineCount, 0);
assert.deepEqual(preview.financialRows, []);

const templatePath = path.join(__dirname, '..', 'modern-proto', 'assets', 'OHADAr-template.xlsx');
const templateBytes = new Uint8Array(fs.readFileSync(templatePath));
assert.equal(crypto.createHash('sha256').update(templateBytes).digest('hex'), report.TEMPLATE_SHA256, 'la ressource intégrée est la copie de référence immuable');
const sourceWorkbook = fflate.unzipSync(templateBytes);
const sourceFiles = Object.keys(sourceWorkbook).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
assert.equal(sourceFiles.length, 57, 'le classeur complet reste embarqué');
assert.equal(report.itemizeTemplateCells(templateBytes).formulaCount, 1435, 'le modèle conserve les formules source');

function formulaSignatures(files) {
  return Object.keys(files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort().flatMap(name => {
    const xml = new TextDecoder().decode(files[name]);
    const found = [];
    xml.replace(/<c\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/c>)/g, (_cell, attributes, body) => {
      if (!body) return _cell;
      const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
      const formula = /<f(?:\s([^>]*))?>([\s\S]*?)<\/f>|<f\s*\/>/.exec(body);
      if (formula) found.push(name + '!' + reference + ':' + (formula[1] || '') + ':' + (formula[2] || ''));
      return _cell;
    });
    return found;
  });
}
const sourceFormulas = formulaSignatures(sourceWorkbook);

const generated = report.generateWorkbook(templateBytes, {
  dossierName: 'Entreprise de contrôle',
  cycleStart: '2026-01-01',
  cycleEnd: '2026-12-31',
  printedInformationRows: [
    { id: 'company-name', value: 'Entreprise de contrôle' },
    { id: 'ifu-number', value: 'IFU-TEST-123' },
    { id: 'phone', value: '+22900000000' }
  ],
  balance: [
    { code: '101', debit: 0, credit: 2000 },
    { code: '521', debit: 2000, credit: 0 },
    { code: '401', debit: 0, credit: 300 },
    { code: '601', debit: 300, credit: 0 },
    { code: '411', debit: 500, credit: 0 },
    { code: '701', debit: 0, credit: 500 }
  ]
});
assert.ok(generated.bytes instanceof Uint8Array);
assert.equal(generated.summary.balanced, true);
assert.equal(generated.summary.mappedAccountCount, 6);
const generatedFiles = fflate.unzipSync(generated.bytes);
assert.deepEqual(formulaSignatures(generatedFiles), sourceFormulas, 'les formules et leurs références restent inchangées');
const generatedIndex = report.itemizeTemplateCells(generated.bytes).index;
assert.equal(report.itemizeTemplateCells(generated.bytes).formulaCount, 1435);
function indexedCell(sheetName, reference) {
  const rowNumber = reference.match(/\d+$/)[0];
  const column = reference.replace(/\d+$/, '');
  return generatedIndex.sheets[sheetName].rows[rowNumber][column];
}
assert.equal(indexedCell('ACTIF', 'D21').value, '', 'un exemple chiffré du bilan est retiré');
assert.equal(indexedCell('NOTE 6', 'B12').value, '', 'un exemple chiffré des notes est retiré');
assert.equal(indexedCell('NOTE 1', 'E10').value, 'Nantissements ', 'le contenu textuel et la structure des notes restent intacts');
assert.equal(indexedCell('FICHE R1 ', 'AQ14').value, '', 'la durée comparative non fournie reste vide');
assert.equal(indexedCell('FICHE R2 ', 'AH30').value, '', 'les données d’activité d’exemple restent vides');
assert.equal(indexedCell('FICHE R2 ', 'AH42').value, '', 'le total en pourcentage non calculé n’est pas prérempli');
assert.equal(indexedCell('PAGE DE GARDE', 'E43').value, '', 'les cases précochées d’exemple sont vidées');
assert.equal(Object.values(generatedIndex.sheets).flatMap(sheet => Object.values(sheet.rows).flatMap(row => Object.values(row))).filter(cell => cell.formula && cell.value !== '').length, 0, 'aucune ancienne valeur mise en cache d’une formule ne subsiste');

function xmlFor(sheetPath) { return new TextDecoder().decode(generatedFiles[sheetPath]); }
function cellBody(sheetPath, ref) {
  const escaped = ref.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const match = new RegExp('<c\\b(?=[^>]*\\br="' + escaped + '")[^>]*?(?:/\\s*>|>[\\s\\S]*?<\\/c>)').exec(xmlFor(sheetPath));
  return match ? match[0] : '';
}
assert.match(cellBody('xl/worksheets/sheet7.xml', 'D10'), /<v>2000<\/v>/, 'le capital validé alimente PASSIF');
assert.match(cellBody('xl/worksheets/sheet7.xml', 'D28'), /<v>300<\/v>/, 'le solde fournisseur alimente le PASSIF');
assert.match(cellBody('xl/worksheets/sheet6.xml', 'D37'), /<v>2000<\/v>/, 'le compte bancaire alimente l’ACTIF');
assert.match(cellBody('xl/worksheets/sheet9.xml', 'E9'), /<v>500<\/v>/, 'les ventes alimentent le compte de résultat');
assert.match(cellBody('xl/worksheets/sheet9.xml', 'E10'), /<v>300<\/v>/, 'les achats alimentent le compte de résultat');
assert.match(cellBody('xl/worksheets/sheet2.xml', 'B6'), /<f>_soNom<\/f>/, 'la cellule de société garde sa formule');
assert.doesNotMatch(cellBody('xl/worksheets/sheet2.xml', 'B6'), /Test/, 'la valeur exemple n’est pas conservée dans le cache formule');
const workbookXml = new TextDecoder().decode(generatedFiles['xl/workbook.xml']);
assert.match(workbookXml, /<definedName name="_soNom">"Entreprise de contrôle"<\/definedName>/);
assert.match(workbookXml, /fullCalcOnLoad="1"/);
assert.match(workbookXml, /forceFullCalc="1"/);
assert.match(new TextDecoder().decode(sourceWorkbook['xl/workbook.xml']), /<definedName name="_soNom">"Test"<\/definedName>/, 'le modèle intégré reste inchangé');

const gapReport = report.buildGapReport(generated.gaps, generated.summary, {
  dossierName: 'Entreprise de contrôle',
  printedInformationRows: [{ id: 'email', label: 'Adresse électronique', value: '' }, { id: 'company-name', label: 'Raison sociale', value: 'Entreprise de contrôle' }]
});
assert.match(gapReport, /Adresse électronique/);
assert.match(gapReport, /Exercice comparatif/);
assert.match(gapReport, /TFT/);
assert.match(gapReport, /Valeurs nulles affichées par formule/);
assert.match(gapReport, /n’est pas confirmé par une donnée source/);
assert.match(gapReport, /Entreprise de contrôle/);

const mappings = report.computeStatementData({
  balance: [{ code: '401', debit: 0, credit: 300 }, { code: '999999', debit: 500, credit: 0 }],
  mappings: { '401': { debit: 'BH', credit: 'DJ' } }
});
assert.ok(mappings.gaps.some(gap => gap.field === 'Compte 999999'));
assert.equal(mappings.summary.mappedAccountCount, 1);

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const nav = require('../modern-proto/js/accounting-navigation.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
assert.equal(nav.getTab('declarations', 'ohada-statements').status, 'active');
assert.equal(nav.getTab('fin-exercice', 'calculate-result').status, 'partial');
assert.equal(nav.getTab('fin-exercice', 'definitive-close').status, 'planned', 'la clôture définitive reste séparée');
assert.match(app, /function viewOhadaFinancialStatements[\s\S]*Éditer l’état sélectionné/);
assert.match(app, /selectedKey === 'financial-statements'[\s\S]*downloadActiveOhadaSnapshot/);
assert.match(app, /function viewFinancialResult[\s\S]*Calculer et générer les états financiers/);
assert.match(app, /function bindFinancialFramework[\s\S]*saveFinancialStatementsMappingsConfiguration/);
assert.match(html, /js\/ohada-financial-statements\.js/);
assert.match(worker, /assets\/OHADAr-template\.xlsx/);
assert.match(worker, /ohada-financial-statements\.js/);
assert.match(workflow, /modern-proto\/assets\/OHADAr-template\.xlsx/);
assert.match(workflow, /\/modern-proto\/assets\/OHADAr-template\.xlsx/);
assert.match(workflow, /node tests\/ohada-financial-statements\.test\.js/);
console.log('OK · modèle OHADA immuable, formules préservées, données source, rapport des écarts et génération non clôturante');
