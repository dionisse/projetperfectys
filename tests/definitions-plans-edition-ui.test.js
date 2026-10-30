/* Intégration de Tiers et Plan des journaux dans Définitions et plans. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const nav = require('../modern-proto/js/accounting-navigation.js');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'definitions-plans-edition.css'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const workflow = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'main.yml'), 'utf8');
const tab = nav.getTab('editions', 'definitions-and-plans');
const tiers = tab.children.find(item => item.id === 'edition-third-parties');
const journals = tab.children.find(item => item.id === 'edition-journal-plan');

assert.equal(tiers.status, 'active');
assert.equal(journals.status, 'active');
assert.match(tiers.reason, /Fournisseurs, Clients, Personnel ou Tiers Divers/);
assert.match(tiers.reason, /Adresse et Autres informations/);
assert.match(journals.reason, /standards, automatiques et ceux créés/);
assert.match(journals.reason, /Code, Intitulé et Clôture/);

assert.match(app, /var DefinitionsPlansEditionReports = window\.PerfectoDefinitionsPlansEditionReports/);
assert.match(app, /function definitionsPlansEditionSelectionView\([\s\S]*definitions-plans-edition-report-detail/);
assert.match(app, /function definitionsPlansEditionSelectionView\([\s\S]*Nature des tiers[\s\S]*Colonnes à imprimer[\s\S]*Lignes générées/);
assert.match(app, /function definitionsPlansEditionPicker\([\s\S]*definitionsPlansEditionRecords[\s\S]*Appliquer/);
assert.match(app, /function definitionsPlansEditionPrintHtml\([\s\S]*report\.rows\.map[\s\S]*report\.columns/);
assert.match(app, /openReportPreview\('Aperçu — '[\s\S]*definitionsPlansEditionPrintHtml/);
assert.match(app, /if \(!isDefinitionsPlansEditionReportRoute\) definitionsPlansEditionReportSession = null/);
assert.match(app, /definitions-and-plans' && \[DefinitionsPlansEditionReports\.THIRD_PARTY_ID, DefinitionsPlansEditionReports\.JOURNAL_ID\]\.indexOf\(menuParams\.c\) !== -1\) bindDefinitionsPlansEditionReport/);

assert.match(html, /css\/definitions-plans-edition\.css/);
assert.match(html, /js\/definitions-plans-edition-reports\.js/);
assert.match(sw, /\.\/css\/definitions-plans-edition\.css/);
assert.match(sw, /\.\/js\/definitions-plans-edition-reports\.js/);
assert.match(sw, /perfecto-static-v157/);
assert.match(css, /\.definitions-plans-edition-filter-grid[\s\S]*grid-template-columns/);
assert.doesNotMatch(app, /definitions-plans-edition-window|definitions-plans-edition-titlebar/);
assert.match(css, /body\.report-preview-printing[\s\S]*\.definitions-plans-edition-print/);
assert.match(workflow, /modern-proto\/js\/definitions-plans-edition-reports\.js/);
assert.match(workflow, /modern-proto\/css\/definitions-plans-edition\.css/);
assert.match(workflow, /node tests\/definitions-plans-edition-reports\.test\.js/);
assert.match(workflow, /node tests\/definitions-plans-edition-ui\.test\.js/);

console.log('Éditions Tiers et Plan des journaux : menu, sélection, aperçu plein écran et ressources vérifiés.');
