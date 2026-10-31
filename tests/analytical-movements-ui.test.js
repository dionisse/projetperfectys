/* Vérifie la vue des mouvements analytiques et ses résumés en français. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'accounting-navigation.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'js', 'journal-lines-report.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');

assert.match(app, /function viewAnalyticalMovements\(\)/);
assert.match(app, /JournalLinesReport\.buildAnalyticalMovements\(/);
assert.match(app, /Total débit analytique/);
assert.match(app, /Total crédit analytique/);
assert.match(app, /À ventiler · débit \/ crédit/);
assert.match(app, /Les natures sont consultées séparément/);
assert.match(app, /reliquats restent « À ventiler »/);
assert.match(app, /data-filter="analyticalMovements:natureId"/);
assert.match(navigation, /id: 'analytic-movements', label: 'Comptes analytiques', status: 'active'/);
assert.match(report, /function buildAnalyticalMovements\(/);
assert.match(report, /Référence historique/);
assert.match(css, /\.analytical-movement-summary/);
assert.match(app, /function viewAnalyticalStatement\(child, backLink\)/);
assert.match(app, /JournalLinesReport\.buildAnalyticalStatement\(/);
assert.match(app, /Choisissez explicitement une nature analytique/);
assert.match(app, /aucun report d’ouverture n’est supposé/);
assert.match(app, /Imputations non classées/);
assert.match(app, /unclassifiedAllocationCount/);
assert.match(app, /Valeur non rapprochée/);
assert.match(app, /analytical-unmatched-values/);
assert.match(css, /is-unmatched/);
assert.match(app, /ANALYTICAL_STATEMENT_IDS\.indexOf\(child\.id\)/);
assert.match(navigation, /id: 'analytic-center-balance'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-other-nature-balance'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-ledger'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-other-nature-ledger'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-center-situation'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-other-nature-situation'.*status: 'active'/);
assert.match(navigation, /id: 'analytic-general-account-balance'.*status: 'active'/);
assert.match(css, /\.analytical-statement-view/);
assert.match(css, /--analytical-tint: #f2f6f5/);
assert.match(worker, /perfecto-static-v168/);

console.log('Vue des mouvements analytiques : accès, filtres et résumés entièrement en français — OK');
