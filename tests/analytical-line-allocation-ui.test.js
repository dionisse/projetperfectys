/* Vérifie que la ventilation est visible dans la saisie générale et reliée aux états et formats. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'store.js'), 'utf8');
const exchange = fs.readFileSync(path.join(root, 'js', 'accounting-exchange.js'), 'utf8');
const report = fs.readFileSync(path.join(root, 'js', 'journal-lines-report.js'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'js', 'accounting-navigation.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'modern.css'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const sourceHas = (source, pattern, label) => assert.ok(pattern.test(source), 'Élément attendu absent : ' + label);

sourceHas(app, /<details class="entry-analytic-editor">[\s\S]*Imputation analytique/, 'app source contract');
sourceHas(app, /data-analytic-field="mode"[\s\S]*value="amount"[\s\S]*value="percentage"/, 'app source contract');
sourceHas(app, /Ventilation complète[\s\S]*Partielle · reliquat visible/, 'app source contract');
sourceHas(app, /function collectAnalyticalSplits\([\s\S]*analyticSplits: collectAnalyticalSplits\(row\)/, 'app source contract');
sourceHas(app, /S\.evaluateAnalyticalSplit\(split, baseAmount, decimalPlaces\)/, 'app source contract');
sourceHas(app, /data-action="add-analytic-split"/, 'app source contract');
sourceHas(app, /data-action="add-analytic-allocation"/, 'app source contract');
sourceHas(app, /S\.normalizeAnalyticalSplits\(l\.analyticSplits\)/, 'app source contract');
sourceHas(store, /JSON\.stringify\(line\.analyticSplits \|\| \[\]\)/, 'line analytics persisted in signature');
sourceHas(store, /le total ventilé dépasse le montant de la ligne comptable/, 'store source contract');
sourceHas(store, /Aucune correspondance automatique n’est faite/, 'store source contract');
sourceHas(report, /line\.analyticSplits/, 'report source contract');
sourceHas(report, /allocation\.amount/, 'report source contract');
sourceHas(report, /À ventiler \(sans centre\)[\s\S]*analytical-unallocated/, 'visible unallocated analytic remainder distinct from centers');
sourceHas(report, /Compatibilité historique/, 'report source contract');
sourceHas(exchange, /IMPUTATIONS_ANALYTIQUES_JSON/, 'exchange source contract');
sourceHas(exchange, /OPTIONAL_HEADERS = \['IMPUTATIONS_ANALYTIQUES_JSON'\]/, 'exchange source contract');
sourceHas(exchange, /analyticSplits: analyticSplits/, 'exchange source contract');
sourceHas(navigation, /reprend d’abord les ventilations explicites enregistrées sur les lignes validées/, 'navigation source contract');
sourceHas(css, /\.entry-analytic-editor/, 'css source contract');
sourceHas(css, /\.entry-analytic-allocation/, 'css source contract');
sourceHas(worker, /perfecto-static-v165/, 'worker source contract');

console.log('Saisie analytique : champs multi-axes, modes, contrôle d’écart, persistance, cumul et export intégrés — OK');
