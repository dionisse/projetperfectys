/* Règles fournies par l’utilisateur : présentation et rapprochement non engageants. */
(function(root,factory){'use strict';var api=factory();root.PayrollJournalRules=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var accounts=[
    {code:'6611',usage:'Salaire et appointements'}, {code:'6612',usage:'Primes et gratifications'},
    {code:'422',usage:'Rémunérations dues'}, {code:'4311',usage:'CNSS · part salariale',warning:'Dans le référentiel standard du logiciel, 4311 est intitulé « Prestations familiales » : utilisation pour la part salariale à confirmer.'},
    {code:'431',usage:'CNSS · dette sociale'}, {code:'447',usage:'ITS retenue'}, {code:'664',usage:'Charges sociales patronales'},
    {code:'521',usage:'Banque'}, {code:'571',usage:'Caisse'}, {code:'4286',usage:'Dette envers l’assureur · proposition à vérifier'},
    {code:'6685',usage:'Assurance santé · part employeur'}, {code:'6686',usage:'Assurance retraite · part employeur'}, {code:'668',usage:'Autre assurance · part employeur'}
  ];
  var rules=[
    {title:'Bulletin de paie',trigger:'Paie traitée, approuvée et verrouillée',lines:['Débit 6611 : rémunération brute', 'Crédit 4311 : retenue CNSS salariale', 'Crédit 447 : retenue ITS', 'Crédit 422 : net dû avant éventuelle retenue d’assurance distincte']},
    {title:'Charges patronales',trigger:'Montants patronaux approuvés',lines:['Débit 664 : charge sociale patronale', 'Crédit 431 : dette CNSS patronale']},
    {title:'Paiement des salaires',trigger:'Règlement effectivement constaté et qualifié',lines:['Débit 422 : net payé', 'Crédit 521 : banque ou 571 : caisse, selon le moyen constaté']},
    {title:'Règlement CNSS / ITS',trigger:'Règlement effectivement constaté, distinct de la déclaration',lines:['Débit 431 : cotisations réglées', 'Débit 447 : ITS réglé', 'Crédit 521 : montant réglé par banque']},
    {title:'Assurance complémentaire',trigger:'Parts salarié et employeur approuvées par assureur',lines:['Débit 422 : part salariale retenue', 'Débit 6685 / 6686 / 668 : part employeur selon la couverture', 'Crédit 4286 : dette envers l’assureur']},
    {title:'Règlement de l’assurance',trigger:'Règlement effectivement constaté par assureur',lines:['Débit 4286 : dette réglée', 'Crédit 521 : paiement bancaire']}
  ];
  function audit(chart){if(!Array.isArray(chart))throw new Error('Plan comptable indisponible.');return accounts.map(function(req){var matches=chart.filter(function(a){return a&&String(a.code)===req.code;});var found=matches.length===1?matches[0]:null;return {code:req.code,usage:req.usage,label:found?String(found.label||''):'',state:matches.length>1?'doublon':!found?'non disponible':found.active===false?'inactif':found.postable===false?'non imputable':'actif et imputable',warning:req.warning||''};});}
  return {accounts:accounts,rules:rules,audit:audit};
});
