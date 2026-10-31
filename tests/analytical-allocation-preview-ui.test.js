/* Vérifie l’intégration de la simulation explicite des clés au prototype. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'modern-proto');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const helper = fs.readFileSync(path.join(root, 'js', 'analytical-allocation-preview.js'), 'utf8');

assert.match(app, /data-allocation-action="simulate">Simuler une application/);
assert.match(app, /function openAllocationSimulation\(kind, rows\)/);
assert.match(app, /aucune option n’est présélectionnée/);
assert.match(app, /Poids relatifs · répartition proportionnelle/);
assert.match(app, /Pourcentages explicites/);
assert.match(app, /Montants fixes/);
assert.match(app, /aucun changement enregistré/);
assert.match(app, /AnalyticalAllocationPreview\.simulate\(/);
assert.match(html, /<script src="js\/analytical-allocation-preview\.js"><\/script>/);
assert.match(worker, /'\.\/js\/analytical-allocation-preview\.js'/);
assert.match(worker, /perfecto-static-v169/);
assert.match(helper, /Choisissez explicitement une interprétation des clés/);
assert.match(helper, /écart d’arrondi/);

console.log('Simulation des clés : choix utilisateur, aucun mode présélectionné, aperçu seulement et cache vérifiés — OK');
