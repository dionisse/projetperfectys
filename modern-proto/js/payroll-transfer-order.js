/* Préparation fictive d'un ordre unique : aucune transmission bancaire. */
(function(root,factory){'use strict';var api=factory();root.PayrollTransferOrder=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var columns=[{key:'employee',label:'Employé',kind:'employee'},{key:'account',label:'Compte',kind:'account'},{key:'bank',label:'Banque',kind:'bank'},{key:'payable',label:'Montant à virer',kind:'amount'}];
  var small=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
  function under100(n){if(n<17)return small[n];if(n<20)return 'dix-'+small[n-10];if(n<70){var tens=['','','vingt','trente','quarante','cinquante','soixante'][Math.floor(n/10)],u=n%10;return tens+(u===1?'-et-un':u?'-'+small[u]:'');}if(n<80)return 'soixante-'+(n===71?'et-onze':under100(n-60));return 'quatre-vingt'+(n===80?'s':n>80?'-'+under100(n-80):'');}
  function hundreds(n){if(n<100)return under100(n);var h=Math.floor(n/100),r=n%100;return (h===1?'cent':small[h]+' cent'+(!r?'s':''))+(r?' '+under100(r):'');}
  function integerWords(n){if(n===0n)return 'zéro';var scales=[{size:1000000000n,one:'milliard',many:'milliards'},{size:1000000n,one:'million',many:'millions'},{size:1000n,one:'mille',many:'mille'}],result=[];scales.forEach(function(s){var g=Number(n/s.size);n%=s.size;if(!g)return;var w=hundreds(g);if(s.one==='mille'){if(g===1)w='';if(g%100===0)w=w.replace(/cents$/,'cent');if(g%100===80)w=w.replace(/vingts$/,'vingt');result.push((w?w+' ':'')+'mille');}else result.push(w+' '+(g===1?s.one:s.many));});if(n)result.push(hundreds(Number(n)));return result.join(' ');}
  function words(value,currency,tools){var normalized=tools.numbers(value);if(!normalized)return '';var neg=normalized[0]==='-';if(neg)normalized=normalized.slice(1);var parts=normalized.split('.'),whole=integerWords(BigInt(parts[0])),fraction=parts[1]? ' virgule '+parts[1].split('').map(function(c){return small[Number(c)];}).join(' '):'';return (neg?'moins ':'')+whole+fraction+' '+(currency==='XOF'?(BigInt(parts[0])<2n?'franc CFA (XOF)':'francs CFA (XOF)'):currency);}
  function build(input,tools,tracking){
    var data=input.settings||{},keys=new Set(input.columnKeys||[]),selected=input.columnKeys||[],banks=input.banks||[];
    if(!selected.length||keys.size!==selected.length||selected.some(function(k){return !columns.some(function(c){return c.key===k;});}))throw new Error('Sélectionnez au moins une colonne valide.');
    var emitter=banks.find(function(b){return b.id===data.emitterId;});if(!data.multiple&&!emitter)throw new Error('Choisissez une banque émettrice du référentiel.');
    var ids=data.bankIds||[];if(!data.allBanks&&(!ids.length||new Set(ids).size!==ids.length||ids.some(function(id){return !banks.some(function(b){return b.id===id;});})))throw new Error('Choisissez au moins une banque destinataire du référentiel.');
    if(!/^[A-Z]{3}$/.test(data.currency||''))throw new Error('Indiquez la devise par son code à trois lettres (par exemple XOF).');
    if(data.date&&!tools.isValidDate(data.date))throw new Error('Date invalide.');
    var signers=(data.signers||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);if(data.showSigners&&!signers.length)throw new Error('Indiquez le nom du ou des signataires, un par ligne.');
    var chosen=columns.filter(function(c){return keys.has(c.key);});if(data.showWords)chosen.push({key:'words',label:'Montant en lettres',kind:'amount'});
    var rows=[],anomalies=[],excluded=0,unknown=0;
    input.employees.forEach(function(e){
      var account=String(e.bankAccountNumber||'').trim(),mode=String(e.paymentMethod||'').trim();if(!account&&mode!=='Virement Bancaire')return;
      var bank=banks.find(function(b){return b.id===e.bankId;});if(!bank||e._fallbackForOrder)unknown++;
      if(!data.allBanks&&(!bank||ids.indexOf(bank.id)<0))return;
      var draft=Object.prototype.hasOwnProperty.call(input.drafts,e.id)?input.drafts[e.id]:null,event=tracking.active(input.payments,e.id,input.period),phase=tracking.status(event,draft);
      if(phase==='paid'){excluded++;return;}
      var hasEntry=!!draft&&Object.prototype.hasOwnProperty.call(draft,'amount-payable'),entry=hasEntry?draft['amount-payable']:null,amount='';
      if(hasEntry){if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('Montant à payer du brouillon illisible.');if(entry.amount!=null&&entry.amount!==''){if(typeof entry.amount!=='string'&&typeof entry.amount!=='number')throw new Error('Montant à payer du brouillon illisible.');amount=tools.numbers(entry.amount);}}
      var flags=[];if(e._fallbackForOrder)flags.push('banque par défaut choisie pour cet ordre : fiche employé non modifiée');if(!bank)flags.push('banque non rattachée au référentiel');if(!account)flags.push('compte bancaire absent');if(mode!=='Virement Bancaire')flags.push('mode de règlement différent du virement ou non renseigné');if(phase==='changed')flags.push('déclaration de règlement à vérifier : brouillon modifié ou absent depuis la déclaration');if(!draft)flags.push('brouillon absent');else if(amount==='')flags.push('montant à payer non renseigné');else if(Number(amount)<=0)flags.push('montant non positif');
      var index=rows.length+1;if(flags.length)anomalies.push('Ligne '+index+' : '+flags.join(' ; ')+'.');
      rows.push({values:{employee:[e.employeeNumber||e.id,e.displayName||[e.lastName,e.firstName].filter(Boolean).join(' ')].filter(Boolean).join(' · '),account:account,bank:bank?[bank.code,bank.label].filter(Boolean).join(' · ')+(e._fallbackForOrder?' · banque par défaut':''):'',payable:amount,words:amount&&data.showWords?words(amount,data.currency,tools):''},review:!!flags.length});
    });
    var chosenBanks=data.allBanks?'Toutes les banques':ids.map(function(id){var b=banks.find(function(x){return x.id===id;});return [b.code,b.label].filter(Boolean).join(' · ');}).join(', ');
    var reportNotes=['BROUILLON FICTIF · Aucune transmission bancaire, aucun paiement ni écriture comptable. Vérifiez toutes les informations avant toute utilisation.','Sélection : employés avec compte bancaire ou mode Virement Bancaire ; banque(s) destinataire(s) : '+chosenBanks+(data.multiple?' ; service : '+(data.serviceLabel||'Tous'):'')+'. Les fiches et modes sont actuels, non historiques.','Lignes générées : '+rows.length+' ; règlements déclarés pour le brouillon actuel exclus : '+excluded+' ; fiches concernées sans banque du référentiel avant filtrage et exclusions : '+unknown+'.','* : ligne incomplète ou à vérifier ; ne pas traiter comme une instruction de virement sans vérification. Les montants absents restent vides.','Devise choisie : '+data.currency+'.'+(data.showWords?' Les décimales sont lues chiffre par chiffre après « virgule », sans arrondi.':'')].concat(anomalies);
    var dateInfo=[data.city||'Ville non renseignée',data.date||'date non renseignée'].join(' · '),reference=data.reference||'Non renseignée';
    var letterInfo=data.multiple?['Référence : '+reference,'Lieu et date : '+dateInfo,'Banque destinataire : '+chosenBanks]:['Référence : '+reference,'Lieu et date : '+dateInfo,'Banque émettrice : '+[emitter.code,emitter.label].filter(Boolean).join(' · '),'N° du compte émetteur : '+(data.accountNumber||'Non renseigné'),'Intitulé du compte émetteur : '+(data.accountTitle||'Non renseigné'),'Adressé à : '+(data.addressee||'Non renseigné')];
    var letter=data.multiple?['Objet : ordre de virements des salaires avec chèque à joindre','Madame la Directrice générale, Monsieur le Directeur général,','Nous vous prions de bien vouloir, après vérification et validation par nos soins, autoriser les virements des salaires du mois indiqué au profit des bénéficiaires mentionnés ci-après. Un chèque est à joindre à cet ordre ; cette mention ne confirme ni son existence ni son émission. Les lignes signalées restent à vérifier et ne constituent pas des instructions de paiement.'].concat(data.politeness?[data.politeness]:[]):['Objet : ordre unique de virements des salaires', (data.addressee||'Madame, Monsieur')+',', 'Nous vous prions de bien vouloir, après vérification et validation par nos soins, autoriser les virements des salaires du mois indiqué au profit des bénéficiaires mentionnés ci-après. Les lignes signalées restent à vérifier et ne constituent pas des instructions de paiement.', 'Nous vous remercions de votre collaboration et vous prions d’agréer l’expression de nos salutations distinguées.'];
    if(data.multiple)reportNotes.unshift('Un chèque est à joindre : aucun chèque n’est créé, enregistré, joint ou déclaré émis par cette préparation.');
    return {transferReport:true,title:data.multiple?'Ordres multiples de virements avec chèque joint':'Ordre unique de virements',period:input.period,dossier:{id:input.dossier.id,clientName:input.dossier.clientName||'',name:input.dossier.name||'',reference:input.dossier.reference||''},licenseOwner:input.licenseOwner||'',columns:chosen,rows:rows,reportNotes:reportNotes,letterInfo:letterInfo,letter:letter,signers:data.showSigners?signers:[]};
  }
  function buildMultiple(input,tools,tracking){
    var settings=input.settings||{},banks=input.banks||[],ids=settings.bankIds||[],fallback=settings.defaultBankId||'';
    if(!settings.allBanks&&(!ids.length||new Set(ids).size!==ids.length||ids.some(function(id){return !banks.some(function(b){return b.id===id;});})))throw new Error('Choisissez au moins une banque destinataire du référentiel.');
    if(fallback&&(!banks.some(function(b){return b.id===fallback;})||(!settings.allBanks&&ids.indexOf(fallback)<0)))throw new Error('Choisissez une banque par défaut du référentiel incluse dans la sélection.');
    var people=input.employees.map(function(e){
      var eligible=!!String(e.bankAccountNumber||'').trim()||e.paymentMethod==='Virement Bancaire';
      if(!eligible||banks.some(function(b){return b.id===e.bankId;}))return e;
      var draft=Object.prototype.hasOwnProperty.call(input.drafts,e.id)?input.drafts[e.id]:null,event=tracking.active(input.payments,e.id,input.period);
      if(tracking.status(event,draft)==='paid')return e;
      if(!fallback)throw new Error('Choisissez une banque par défaut pour les employés sans banque reconnue.');
      return Object.assign({},e,{bankId:fallback,_fallbackForOrder:true});
    });
    var chosen=banks.filter(function(b){return settings.allBanks||ids.indexOf(b.id)>=0;}),reports=[];
    chosen.forEach(function(b){
      var one=build(Object.assign({},input,{employees:people,settings:Object.assign({},settings,{multiple:true,allBanks:false,bankIds:[b.id]})}),tools,tracking);
      if(one.rows.length)reports.push(one);
    });
    if(!chosen.length)throw new Error('Ajoutez au moins une banque au référentiel.');
    // Aucun ordre fictif ne doit être attribué à une banque lorsqu'il n'y a aucun bénéficiaire.
    var empty=build(Object.assign({},input,{employees:[],settings:Object.assign({},settings,{multiple:true,allBanks:false,bankIds:[chosen[0].id]})}),tools,tracking);
    empty.letterInfo=[];empty.letter=[];empty.signers=[];empty.reportNotes=['Aucun ordre à préparer pour cette sélection. Aucun chèque ni paiement n’est créé.'];
    return {multipleTransferReport:true,title:'Ordres multiples de virements avec chèque joint',period:input.period,columns:empty.columns,reports:reports,emptyReport:empty};
  }
  return {columns:columns,build:build,buildMultiple:buildMultiple,words:words};
});
