/* États de préparation des règlements fictifs, sans paiement ni émission de chèque. */
(function(root,factory){'use strict';var api=factory();root.PayrollPaymentReport=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var columns=[{key:'employee',label:'Employé',kind:'employee'},{key:'payable',label:'Montant à payer',kind:'amount'}];
  function build(input,tools,tracking){
    var selected=input.columnKeys||[],keys=new Set(selected);
    if(!selected.length||keys.size!==selected.length||selected.some(function(k){return !columns.some(function(c){return c.key===k;});}))throw new Error('Sélectionnez au moins une colonne valide.');
    if(input.mode!=='cash'&&input.mode!=='cheque')throw new Error('État de règlement indisponible.');
    var method=input.mode==='cash'?'Espèces':'Chèque',chosen=columns.filter(function(c){return keys.has(c.key);}),excluded=0,unknown=0,rows=[],notes=[];
    input.employees.forEach(function(e){
      var paymentMethod=e.paymentMethod||'';
      if(['Espèces','Chèque','Virement Bancaire','Mobile Money'].indexOf(paymentMethod)<0)unknown++;
      if(paymentMethod!==method)return;
      var draft=Object.prototype.hasOwnProperty.call(input.drafts,e.id)?input.drafts[e.id]:null;
      var event=tracking.active(input.payments,e.id,input.period),phase=tracking.status(event,draft);
      if(phase==='paid'){excluded++;return;}
      var hasEntry=!!draft&&Object.prototype.hasOwnProperty.call(draft,'amount-payable'),entry=hasEntry?draft['amount-payable']:null,amount='';
      if(hasEntry){if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Montant à payer du brouillon illisible.');if(entry.amount!=null&&entry.amount!==''){if(typeof entry.amount!=='string'&&typeof entry.amount!=='number')throw new Error('Montant à payer du brouillon illisible.');amount=tools.numbers(entry.amount);}}
      var flags=[];if(phase==='changed')flags.push('déclaration de règlement à vérifier : brouillon modifié ou absent depuis la déclaration ; ne pas préparer un nouveau règlement sans vérification');
      if(!draft)flags.push('brouillon absent');else if(amount==='')flags.push('montant à payer non renseigné');
      var nonPositive=amount!==''&&Number(amount)<=0;if(nonPositive)flags.push('montant non positif à vérifier avant tout règlement');
      var number=rows.length+1;if(flags.length)notes.push('Ligne '+number+' : '+flags.join(' ; ')+'.');
      rows.push({values:{employee:[e.employeeNumber||e.id,e.displayName||[e.lastName,e.firstName].filter(Boolean).join(' ')].filter(Boolean).join(' · '),payable:amount},review:phase==='changed'||nonPositive,missing:amount===''});
    });
    var reportNotes=['État de préparation fictif du mois : montant à payer saisi dans le brouillon ordinaire, sans calcul ni paiement effectué.','Mode actuel de la fiche : '+method+' ; les fiches et modes ne constituent pas un historique de la période.','Lignes générées : '+rows.length+' ; règlements déjà déclarés pour le brouillon actuel exclus : '+excluded+'.','Fiches au mode vide, « Autres » ou non reconnu : '+unknown+' ; elles ne sont attribuées à aucun mode et doivent être vérifiées.','Les lignes marquées * comportent une déclaration ou un montant non positif à vérifier ; elles ne doivent pas être interprétées comme un nouveau règlement à effectuer.'].concat(notes);
    return {paymentReport:true,title:input.mode==='cash'?'Etat des paiements en espèces':'Etat des chèques à établir',period:input.period,dossier:{id:input.dossier.id,clientName:input.dossier.clientName||'',name:input.dossier.name||'',reference:input.dossier.reference||''},licenseOwner:input.licenseOwner||'',method:method,columns:chosen,rows:rows,reportNotes:reportNotes};
  }
  return {columns:columns,build:build};
});
