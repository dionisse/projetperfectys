/* Déclarations locales de règlement fictif ; aucune opération bancaire ou comptable. */
(function(root){
  'use strict';
  var PREFIX='perfecto.payroll.payment-declarations.v1.';
  function storageKey(id){return PREFIX+encodeURIComponent(id);}
  function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+canonical(value[k]);}).join(',')+'}';return JSON.stringify(value);}
  function load(id){
    var raw=root.localStorage.getItem(storageKey(id));if(raw===null)return {version:1,events:[]};
    var data;try{data=JSON.parse(raw);}catch(e){throw new Error('Historique des règlements illisible : aucune modification effectuée.');}
    if(!data||data.version!==1||!Array.isArray(data.events)||data.events.some(function(e){return !e||typeof e.id!=='string'||typeof e.employeeId!=='string'||!/^\d{4}-\d{2}$/.test(e.period)||(e.kind!=='paid'&&e.kind!=='cancelled')||(e.kind==='paid'&&(!e.snapshot||typeof e.snapshot!=='object'||Array.isArray(e.snapshot)||typeof e.amount!=='string'||typeof e.date!=='string'))||(e.kind==='cancelled'&&typeof e.paidId!=='string');}))throw new Error('Historique des règlements illisible : aucune modification effectuée.');
    return data;
  }
  function active(data,employeeId,period){var events=data.events.filter(function(e){return e.employeeId===employeeId&&e.period===period;}),cancelled=new Set(events.filter(function(e){return e.kind==='cancelled';}).map(function(e){return e.paidId;})),paid=events.filter(function(e){return e.kind==='paid'&&!cancelled.has(e.id);});if(paid.length>1)throw new Error('Déclarations multiples incohérentes ; aucune modification effectuée.');return paid[0]||null;}
  function status(event,record){return !event?'unpaid':(canonical(event.snapshot)===canonical(record)?'paid':'changed');}
  function localToday(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function newId(){return 'payment-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);}
  function authorize(args,deps){
    var current=deps.hr.currentDossier();
    if(!current||current.id!==args.dossierId||!deps.hr.isDemoTestDossier(args.dossierId)||!deps.canValidate())throw new Error('Droit de validation absent ou dossier actif modifié.');
    if(!deps.hr.employees(args.dossierId).some(function(e){return e.id===args.employeeId;})||deps.tools.monthList(current).indexOf(args.period)<0)throw new Error('Employé ou période indisponible.');
    return current;
  }
  function declare(args,deps){
    authorize(args,deps);if(args.testOnly!==true)throw new Error('Confirmez la déclaration de règlement fictif.');
    if(!deps.tools.isValidDate(args.date)||args.date>localToday())throw new Error('Indiquez une date de règlement valide, non future.');
    if(['Virement Bancaire','Mobile Money','Chèque','Autres'].indexOf(args.method)<0)throw new Error('Choisissez le mode de règlement effectué.');
    var reference=String(args.reference||'').trim();if(reference.length>120)throw new Error('La référence est limitée à 120 caractères.');
    var draft=deps.tools.readDraft(args.dossierId,args.period,args.employeeId);
    if(!draft||canonical(draft)!==canonical(args.snapshot))throw new Error('Le brouillon a changé ou est absent. Réactualisez l’aperçu avant de confirmer.');
    var amount=deps.tools.numbers(draft['amount-payable']&&draft['amount-payable'].amount);
    if(!amount||Number(amount)<=0)throw new Error('Un montant à payer positif doit être saisi dans le brouillon avant la déclaration.');
    var raw=root.localStorage.getItem(storageKey(args.dossierId)),data=load(args.dossierId);
    if(active(data,args.employeeId,args.period))throw new Error('Un règlement est déjà déclaré pour ce bulletin.');
    var event={id:newId(),kind:'paid',employeeId:args.employeeId,period:args.period,date:args.date,method:args.method,reference:reference,amount:amount,snapshot:draft,recordedAt:new Date().toISOString(),actorId:String(args.actorId||''),accountingStatus:'not-implemented'};
    data.events.push(event);authorize(args,deps);
    if(canonical(deps.tools.readDraft(args.dossierId,args.period,args.employeeId))!==canonical(draft)||root.localStorage.getItem(storageKey(args.dossierId))!==raw)throw new Error('Les données ont changé ailleurs. Réactualisez avant de réessayer.');
    root.localStorage.setItem(storageKey(args.dossierId),JSON.stringify(data));return event;
  }
  function cancel(args,deps){
    authorize(args,deps);var reason=String(args.reason||'').trim();if(!reason||reason.length>200)throw new Error('Indiquez un motif d’annulation (200 caractères maximum).');
    var raw=root.localStorage.getItem(storageKey(args.dossierId)),data=load(args.dossierId),paid=active(data,args.employeeId,args.period);
    if(!paid||paid.id!==args.paidId)throw new Error('La déclaration a changé ou n’existe plus. Réactualisez avant de réessayer.');
    var event={id:newId(),kind:'cancelled',paidId:paid.id,employeeId:args.employeeId,period:args.period,reason:reason,recordedAt:new Date().toISOString(),actorId:String(args.actorId||'')};data.events.push(event);authorize(args,deps);
    if(root.localStorage.getItem(storageKey(args.dossierId))!==raw)throw new Error('L’historique a changé ailleurs. Réactualisez avant de réessayer.');
    root.localStorage.setItem(storageKey(args.dossierId),JSON.stringify(data));return event;
  }
  var api={load:load,active:active,status:status,declare:declare,cancel:cancel};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PayrollPaymentTracking=api;
})(typeof window!=='undefined'?window:globalThis);
