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
      {title:'Contrats et avenants', description:'Prévoir les contrats, avenants, dates et échéances, avec rattachement explicite au salarié. Les suivis RH synthétiques existants ne constituent pas des contrats individuels validés.'},
      {title:'Affectations et missions', description:'Prévoir le suivi daté des affectations, fonctions et missions. Étudier séparément la reprise des enregistrements de test déjà présents, sans correspondance automatique.'},
      {title:'Congés et absences', description:'Prévoir demandes, décisions et périodes, puis définir les règles de décompte et les éventuelles conséquences sur la paie selon le pays.'},
      {title:'Entrées et sorties', description:'Organiser les étapes d’embauche et de départ, leurs dates et justificatifs, sans lancer automatiquement un calcul ou une formalité.'},
      {title:'Documents du personnel', description:'Étudier les types de documents, les droits, la conservation et un stockage sécurisé avant tout dépôt de pièces.'}
    ]},
    { title:'Gestion de carrière', intro:'Propositions pour suivre l’évolution professionnelle du salarié dans le temps.', items:[
      {title:'Historique de carrière', description:'Prévoir une chronologie par salarié : événements datés, situation avant et après, origine et décisions, sans reconstituer d’historique absent.'},
      {title:'Mobilité et évolution professionnelle', description:'Prévoir les changements de fonction ou d’affectation, mutations et promotions, avec date d’effet et validation.'},
      {title:'Statut, catégorie et échelon', description:'Prévoir les changements et leur motif ; les règles et les contrôles d’avancement restent à définir et à vérifier.'},
      {title:'Évolution de la rémunération', description:'Prévoir les propositions de changement de rémunération et leur date d’effet. Le lien avec la paie et les périodes déjà traitées reste à concevoir.'},
      {title:'Formations et qualifications', description:'Prévoir le suivi des formations et qualifications, avec éventuels justificatifs et échéances, sans attribuer automatiquement de qualification.'}
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
      '<section><h4>Droits et confidentialité</h4><p>Définir des droits distincts de consultation, saisie et validation, ainsi qu’une traçabilité et un stockage sécurisé avant l’utilisation de données réelles.</p></section>'+
      '<section><h4>Paie et réglementation</h4><p>Préciser les règles du pays, les dates d’effet et la gestion des périodes closes. Aucun changement de carrière ne modifie aujourd’hui la paie ou la fiche depuis ce plan.</p></section>'+
      '</div></fieldset></div></section>';
  }
  return { render:render };
});
