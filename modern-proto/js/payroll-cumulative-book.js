/* Livre cumulé du mois : sommes exactes de montants manuels par service. */
(function(root,factory){'use strict';var api=factory();root.PayrollCumulativeBook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var columns=[
    {key:'centre',label:'Centre',kind:'identity'}, {key:'label',label:'Intitulé',kind:'identity'},
    {key:'base',label:'Salaire de base',kind:'amount',field:'salary-base-total'},
    {key:'fixed',label:'Primes fixes',kind:'amount',field:'fixed-premiums-total'},
    {key:'exceptional',label:'Primes exceptionnelles',kind:'amount',field:'exceptional-premiums-total'},
    {key:'overtime',label:'Heures supplémentaires',kind:'amount',field:'overtime-total'},
    {key:'leave',label:'Indemnité de congé',kind:'amount',field:'leave-pay-indemnity'},
    {key:'gross',label:'Salaire brut',kind:'amount',field:'gross-salary'},
    {key:'social',label:'Cotisations sociales',kind:'amount',field:'social-contributions-total'},
    {key:'taxes',label:'Impôts',kind:'amount',field:'taxes-total'},
    {key:'other-deductions',label:'Autres retenues obligatoires',kind:'amount',field:'other-mandatory-deductions-total'},
    {key:'net',label:'Salaire net',kind:'amount',field:'net-salary'},
    {key:'advance-deduction',label:'Retenue/acompte',kind:'unavailable'},
    {key:'delegations',label:'Délégation de salaire',kind:'unavailable'},
    {key:'loans',label:'Retenue/Avances et Prêts',kind:'amount',field:'advances-loans-total'},
    {key:'expenses',label:'Remboursement de frais',kind:'amount',field:'professional-expenses-total'},
    {key:'payable',label:'Montant à payer',kind:'amount',field:'amount-payable'}
  ];
  function micro(value,tools){
    var text=tools.numbers(value);if(!text)return null;
    var negative=text[0]==='-';if(negative)text=text.slice(1);
    var parts=text.split('.');var n=BigInt(parts[0])*1000000n+BigInt((parts[1]||'').padEnd(6,'0'));
    return negative?-n:n;
  }
  function format(n){var sign=n<0n?'-':'';if(n<0n)n=-n;var integer=n/1000000n,frac=String(n%1000000n).padStart(6,'0').replace(/0+$/,'');return sign+integer.toString()+(frac?'.'+frac:'');}
  function recorded(record,field,tools){
    if(!record||!Object.prototype.hasOwnProperty.call(record,field))return null;
    var entry=record[field];if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Rubrique du brouillon illisible : '+field+'.');
    if(entry.amount==null||entry.amount==='')return null;
    if(typeof entry.amount!=='number'&&typeof entry.amount!=='string')throw new Error('Montant du brouillon illisible : '+field+'.');
    return micro(entry.amount,tools);
  }
  function build(input,tools){
    var keys=input.columnKeys||[],set=new Set(keys);
    if(!keys.length||set.size!==keys.length||keys.some(function(k){return !columns.some(function(c){return c.key===k;});}))throw new Error('Sélectionnez au moins une colonne valide.');
    var chosen=columns.filter(function(c){return set.has(c.key);}),services=input.services||[],selected=input.serviceId||'*',employees=input.employees||[];
    if(selected!=='*'&&!services.some(function(s){return s.id===selected;}))throw new Error('Service indisponible.');
    var included=employees.filter(function(e){return selected==='*'||e.serviceId===selected;}),groups=[], known=new Set(services.map(function(s){return s.id;}));
    services.forEach(function(s){if(selected!=='*'&&s.id!==selected)return;var members=included.filter(function(e){return e.serviceId===s.id;});if(members.length)groups.push({code:s.code||'',label:s.label||'Service sans intitulé',members:members});});
    var unknown=included.filter(function(e){return !e.serviceId||!known.has(e.serviceId);});
    if(selected==='*'&&unknown.length)groups.push({code:'',label:'Service non défini ou introuvable',members:unknown});
    if(!included.length)throw new Error('Aucun employé dans cette sélection de services.');
    if(selected==='*')groups.push({code:'',label:'TOTAL GÉNÉRAL',members:included,total:true});
    var qualityNotes=[];
    var rows=groups.map(function(g,index){
      var values={centre:g.total?'TOTAL GÉNÉRAL':g.code,label:g.total?g.label:g.label+' · sous-total'},quality={},withoutDraft=0;
      g.members.forEach(function(e){if(!Object.prototype.hasOwnProperty.call(input.drafts,e.id))withoutDraft++;});
      chosen.forEach(function(c){if(c.kind!=='amount')return;var n=0n,count=0;g.members.forEach(function(e){var rec=Object.prototype.hasOwnProperty.call(input.drafts,e.id)?input.drafts[e.id]:null,val=recorded(rec,c.field,tools);if(val!==null){n+=val;count++;}});values[c.key]=count?format(n):'';quality[c.key]={count:count,total:g.members.length};});
      var partial=chosen.filter(function(c){return c.kind==='amount'&&quality[c.key].count<quality[c.key].total;}).map(function(c){return c.label+' '+quality[c.key].count+'/'+quality[c.key].total;});
      qualityNotes.push('Ligne '+(index+1)+' · '+(g.code?g.code+' · ':'')+g.label+' : '+g.members.length+' fiche(s), '+withoutDraft+' sans brouillon'+(partial.length?' ; colonnes incomplètes (*), valeurs renseignées / fiches : '+partial.join(', '):chosen.some(function(c){return c.kind==='amount';})?' ; colonnes de montants sélectionnées complètes':' ; aucune colonne de montant disponible sélectionnée')+'.');
      return {values:values,quality:quality,total:!!g.total};
    });
    return {cumulative:true,title:'Livre de paie cumulé',period:input.period,dossier:{id:input.dossier.id,clientName:input.dossier.clientName||'',name:input.dossier.name||'',reference:input.dossier.reference||''},licenseOwner:input.licenseOwner||'',serviceLabel:input.serviceLabel,columns:chosen,rows:rows,qualityNotes:qualityNotes};
  }
  return {columns:columns,build:build,micro:micro,format:format};
});
