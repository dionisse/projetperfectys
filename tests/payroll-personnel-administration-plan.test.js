'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const plan=require('../modern-proto/js/payroll-personnel-administration-plan.js');
test('plan de l’administration et de la carrière : sections numérotées et sous-éléments consultatifs',()=>{
 const html=plan.render();for (const number of ['01','02','03','04','05','06']) assert.match(html,new RegExp('class="rubric-step">'+number));
 for (const title of ['Dossier du salarié','Contrats et avenants','Affectations et missions','Congés et absences','Entrées et sorties','Documents du personnel','Historique de carrière','Mobilité et évolution professionnelle','Statut, catégorie et échelon','Évolution de la rémunération','Formations et qualifications','Recrutement et intégration','Temps de travail','Organigramme et postes','Évaluations et objectifs','Mobilité et succession','Alertes et tableaux de bord','Espace salarié et responsable','Liaison avec la paie','Paramétrage par pays','Droits et confidentialité','Traçabilité et sécurité','Sauvegarde et restauration','Ordre de développement proposé']) assert.ok(html.includes(title),title);
 assert.equal((html.match(/<details /g)||[]).length,20);assert.match(html,/validation explicite avant toute application future/);assert.match(html,/ne constitue(?:nt)? pas des contrats individuels/);assert.match(html,/sans migration automatique/);
});
test('activation impossible, aucun formulaire ni opération ou accès aux données dans le plan',()=>{
 const html=plan.render(), source=fs.readFileSync('modern-proto/js/payroll-personnel-administration-plan.js','utf8');
 assert.match(html,/<button type="button" class="btn btn-secondary" disabled>Activer le module/);assert.match(html,/Aucun statut d’activation n’est enregistré/);assert.doesNotMatch(html,/<form|<input|data-action=/);assert.doesNotMatch(source,/localStorage|sessionStorage|\.setItem\(|fetch\(/);
});
test('sous-menu accessible, statut à construire et ressources en cache',()=>{
 const app=fs.readFileSync('modern-proto/js/app.js','utf8'), index=fs.readFileSync('modern-proto/index.html','utf8'),sw=fs.readFileSync('modern-proto/service-worker.js','utf8');
 assert.match(app,/id === 'personnel-administration-module'/);assert.match(app,/PayrollPersonnelAdministrationPlan\.render\(\)/);assert.match(app,/À construire/);assert.match(index,/payroll-personnel-administration-plan\.js/);assert.match(sw,/payroll-personnel-administration-plan\.js/);
});

test('périmètre proposé, sécurité et priorités sans automatisme',()=>{
 const html=plan.render();
 for (const text of ['renouvellements et échéances','calendrier et soldes','restitution du matériel','dates d’expiration','rémunérations et pièces sensibles','sauvegardes indépendantes','restaurations vérifiées','seuls éléments RH vérifiés et approuvés','périodes closes','pays indicatif des paramètres généraux','aucune étape n’est activée','1 · Fondations sécurisées','2 · Dossier et carrière','3 · Circuits et services']) assert.ok(html.includes(text),text);
});
