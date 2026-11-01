/* Vérifie la sélection des mêmes dossiers comptables depuis le module analytique. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'modern-proto/js/app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'modern-proto/index.html'), 'utf8');
const modules = require('../modern-proto/js/modules.js');

assert.equal(modules.get('analytics').route, 'analytics-dossiers');
assert.match(app, /'analytics-dossiers'/, 'la route de sélection des dossiers est reconnue');
assert.match(app, /case 'analytics-dossiers': html = viewAnalyticalDossiers\(\)/);
assert.match(app, /function viewAnalyticalDossiers\(\)[\s\S]*permittedDemoDossiers\(member\)[\s\S]*accessible\.map\(dossierCard\)/,
  'la liste reprend les dossiers auxquels le profil a accès dans la comptabilité');
assert.match(app, /function viewAnalyticalDossiers\(\)[\s\S]*même dossier, sans créer de copie/);
assert.match(app, /function analyticalSidebarMarkup\(params, route\)[\s\S]*#\/analytics-dossiers[\s\S]*Dossiers clients/,
  'le parcours analytique permet de revenir à la sélection des dossiers');
assert.match(app, /var openedFromAnalytics = parseHash\(\)\.route === 'analytics-dossiers'[\s\S]*analyticalMenuHash\('home', 'overview'\)/,
  'l’ouverture d’un dossier depuis Analytics mène à son accueil analytique');
assert.match(app, /var isAnalyticalDossierDirectory = route === 'analytics-dossiers'[\s\S]*permittedDemoDossiers\(activeMember\)/,
  'l’indicateur de dossier affiche le nombre de dossiers visibles');
assert.match(html, /css\/analytical-module\.css/);

console.log('Suivi Analytique : liste des dossiers partagée, sélection sécurisée et retour au module — OK');
