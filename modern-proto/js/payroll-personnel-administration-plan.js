/* Plan consultatif : aucune activation ni donnée RH créée ou modifiée. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PayrollPersonnelAdministrationPlan = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var groups = [
    { title:'Administration du personnel', intro:'Propositions de sous-éléments pour gérer le parcours administratif, à préciser ensemble.', items:[
      {title:'Dossier du salarié', description:'S’appuyer sur la fiche employé existante et ses référentiels, sans créer un second salarié. Identifier les informations à compléter et leurs droits de consultation.'},
      {title:'Recrutement et intégration', description:'Prévoir le suivi des candidatures, des pièces à fournir et des étapes d’arrivée, puis une création contrôlée de la fiche salarié.'},
      {title:'Contrats et avenants', description:'Prévoir les contrats, avenants, périodes d’essai, renouvellements et échéances avec rattachement explicite au salarié. Les suivis RH synthétiques existants ne constituent pas des contrats individuels validés.'},
      {title:'Affectations et missions', description:'Prévoir le suivi daté des affectations, fonctions et missions. Étudier séparément la reprise des enregistrements de test déjà présents, sans correspondance automatique.'},
      {title:'Temps de travail', description:'Prévoir horaires, présences et heures supplémentaires ; définir leur contrôle et leur validation avant toute transmission éventuelle à la paie.'},
      {title:'Congés et absences', description:'Prévoir demandes, approbations, calendrier et soldes, puis définir les règles de décompte et les éventuelles conséquences sur la paie selon le pays.'},
      {title:'Entrées et sorties', description:'Organiser les étapes d’embauche et de départ, les dates, justificatifs, documents et restitution du matériel, sans lancer automatiquement un calcul ou une formalité.'},
      {title:'Documents du personnel', description:'Étudier le classement, les dates d’expiration, les droits, la conservation et un stockage sécurisé avant tout dépôt de pièces.'}
    ]},
    { title:'Gestion de carrière', intro:'Propositions pour suivre l’évolution professionnelle du salarié dans le temps.', items:[
      {title:'Organigramme et postes', description:'Prévoir la structure de l’entreprise, les postes, les responsables et un historique des affectations, en s’appuyant sur les référentiels existants à examiner.'},
      {title:'Historique de carrière', description:'Prévoir une chronologie par salarié : événements datés, situation avant et après, origine et décisions, sans reconstituer d’historique absent.'},
      {title:'Mobilité et évolution professionnelle', description:'Prévoir les changements de fonction ou d’affectation, mutations et promotions, avec date d’effet et validation.'},
      {title:'Statut, catégorie et échelon', description:'Prévoir les changements et leur motif ; les règles et les contrôles d’avancement restent à définir et à vérifier.'},
      {title:'Évolution de la rémunération', description:'Prévoir les propositions de changement de rémunération et leur date d’effet. Le lien avec la paie et les périodes déjà traitées reste à concevoir.'},
      {title:'Évaluations et objectifs', description:'Prévoir les entretiens, objectifs et décisions documentées, avec des accès encadrés et des règles à définir.'},
      {title:'Formations et qualifications', description:'Prévoir les besoins, formations suivies et qualifications, avec éventuels justificatifs et échéances, sans attribuer automatiquement de qualification.'},
      {title:'Mobilité et succession', description:'Prévoir les candidatures internes, postes envisagés et préparation des remplacements, sans décision automatique.'}
    ]},
    { title:'Services transversaux', intro:'Fonctions complémentaires à concevoir après les bases du module.', items:[
      {title:'Alertes et tableaux de bord', description:'Prévoir des alertes sur les échéances contractuelles, congés et formations, ainsi que des indicateurs RH limités aux informations autorisées.'},
      {title:'Espace salarié et responsable', description:'Étudier la consultation des informations autorisées, les demandes et les validations, une fois la sécurité et les droits définis.'},
      {title:'Liaison avec la paie', description:'Prévoir la transmission des seuls éléments RH vérifiés et approuvés, avec contrôle des dates d’effet et des périodes closes ; aucun transfert automatique n’existe dans ce plan.'},
      {title:'Paramétrage par pays', description:'Définir et vérifier séparément les règles sociales, calendriers et documents de chaque pays. Le pays indicatif des paramètres généraux n’active pas ces règles.'}
    ]}
  ];
  function esc(value) { return String(value).replace(/[&<>"']/g, function(c) {return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function cards(group) {
    return '<div class="personnel-plan-cards">'+group.items.map(function(item) {
      return '<details class="personnel-plan-item"><summary><span>'+esc(item.title)+'</span><small>À définir</small></summary><p>'+esc(item.description)+'</p></details>';
    }).join('')+'</div>';
  }
  function render() {
    return '<section class="payroll-book-workspace payroll-rubric-cumulative personnel-administration-plan">'+
      '<div class="payroll-employee-workspace-head rubric-page-head"><div><p class="page-kicker">SOUS-MENU · PARAMÈTRES</p><h3>Activation du module de l’administration du personnel</h3><p class="rubric-page-subtitle">Administration du personnel et gestion de carrière · proposition de conception.</p></div><span class="badge draft">À CONSTRUIRE</span></div>'+
      '<div class="alert warning rubric-notice">Plan consultable uniquement : le module n’est pas activé. Aucune préférence ni donnée RH n’est enregistrée et les écrans existants restent inchangés.</div>'+
      '<div class="rubric-setup">'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">01</span> Activation du module</legend><p class="rubric-card-intro">L’activation sera conçue après définition et développement du module. Elle n’est pas disponible dans cette étape.</p><button type="button" class="btn btn-secondary" disabled>Activer le module · à venir</button><p class="rubric-helper">Aucun statut d’activation n’est enregistré. Les fonctions de test déjà existantes ne sont ni activées ni désactivées par cet écran.</p></fieldset>'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">02</span> '+esc(groups[0].title)+'</legend><p class="rubric-card-intro">'+esc(groups[0].intro)+'</p>'+cards(groups[0])+'</fieldset>'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">03</span> '+esc(groups[1].title)+'</legend><p class="rubric-card-intro">'+esc(groups[1].intro)+'</p>'+cards(groups[1])+'</fieldset>'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">04</span> Principes à préparer</legend><div class="personnel-plan-principles">'+
      '<section><h4>Décision et date d’effet</h4><p>Préparer un événement daté, le contrôler puis obtenir une validation explicite avant toute application future à la fiche ou à la paie. Les rôles, corrections et refus restent à définir.</p></section>'+
      '<section><h4>Sources et historique</h4><p>Une fiche salarié de référence par dossier. Les suivis RH actuels sont synthétiques ; leur lien éventuel avec un salarié et la reprise des autres données de test doivent être étudiés, sans migration automatique.</p></section>'+
      '<section><h4>Droits et confidentialité</h4><p>Définir des droits par dossier et par type d’information : consultation, saisie, validation et administration. Prévoir un accès distinct aux rémunérations et pièces sensibles.</p></section>'+
      '<section><h4>Traçabilité et sécurité</h4><p>Prévoir l’auteur, les dates, les décisions et corrections, sans effacer l’historique, ainsi qu’une authentification réelle et un stockage sécurisé avant toute utilisation de données réelles.</p></section>'+
      '<section><h4>Sauvegarde et restauration</h4><p>Prévoir des sauvegardes indépendantes, leur protection et des restaurations vérifiées. Le stockage local actuel ne remplit pas ces conditions.</p></section>'+
      '<section><h4>Paie et réglementation</h4><p>Préciser les règles du pays, les dates d’effet et la gestion des périodes closes. Aucun changement de carrière ne modifie aujourd’hui la paie ou la fiche depuis ce plan.</p></section>'+
      '</div></fieldset>'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">05</span> '+esc(groups[2].title)+'</legend><p class="rubric-card-intro">'+esc(groups[2].intro)+'</p>'+cards(groups[2])+'</fieldset>'+
      '<fieldset class="rubric-card"><legend><span class="rubric-step">06</span> Ordre de développement proposé</legend><p class="rubric-card-intro">À préciser et à valider ensemble ; aucune étape n’est activée par ce plan.</p><div class="personnel-plan-principles">'+
      '<section><h4>1 · Fondations sécurisées</h4><p>Authentification, droits, confidentialité, traçabilité, stockage sécurisé et sauvegardes vérifiées.</p></section>'+
      '<section><h4>2 · Dossier et carrière</h4><p>Fiche de référence, contrats et événements datés avec contrôle et validation explicite.</p></section>'+
      '<section><h4>3 · Circuits et services</h4><p>Congés et temps de travail, puis alertes, tableaux de bord et espaces salarié et responsable.</p></section>'+
      '</div></fieldset></div></section>';
  }
  return { render:render };
});
