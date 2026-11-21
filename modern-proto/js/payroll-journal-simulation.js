/* Simulation visuelle isolée : aucun journal, lot, validation ou mouvement créé. */
(function(root,factory){'use strict';var api=factory();root.PayrollJournalSimulation=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  var lines=[
    {code:'6611',label:'Brut non ventilé · imputation à confirmer',field:'gross-salary',side:'debit'},
    {code:'4311',label:'CNSS · part salariale',field:'cnss-contributions',side:'credit'},
    {code:'447',label:'ITS',field:'ipts',side:'credit'},
    {code:'4286',label:'Assurance complémentaire · part à confirmer',field:'supp-insurance',side:'credit'},
    {code:'422',label:'Salaire net saisi · position à confirmer',field:'net-salary',side:'credit'}
  ];
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function read(record,field,tools,math){
    if(!Object.prototype.hasOwnProperty.call(record,field))return {value:null,issue:'Non renseigné'};
    var x=record[field];if(!x||typeof x!=='object'||Array.isArray(x))return {value:null,issue:'Rubrique illisible'};
    if(x.amount==null||x.amount==='')return {value:null,issue:'Non renseigné'};
    if(typeof x.amount!=='number'&&typeof x.amount!=='string')return {value:null,issue:'Montant illisible'};
    try{var n=math.micro(x.amount,tools);if(n===null)return {value:null,issue:'Non renseigné'};if(n<0n)return {value:null,issue:'Montant négatif à vérifier'};return {value:n,issue:''};}catch(e){return {value:null,issue:'Montant invalide'};}
  }
  function build(input,tools,math){
    if(!Array.isArray(input.months)||input.months.indexOf(input.period)<0)throw new Error('Mois indisponible dans le dossier.');
    var employees=input.employees||[],drafts=input.drafts||{},seen=new Set(),map=new Map(),unknown=[],output=[],without=[];
    employees.forEach(function(e){if(!e||!e.id||seen.has(e.id))throw new Error('Identifiant employé absent ou dupliqué.');seen.add(e.id);map.set(e.id,e);});
    Object.keys(drafts).forEach(function(id){if(!map.has(id))unknown.push(id);});
    employees.slice().sort(function(a,b){return String(a.employeeNumber||a.id).localeCompare(String(b.employeeNumber||b.id),'fr',{numeric:true});}).forEach(function(e){
      if(!Object.prototype.hasOwnProperty.call(drafts,e.id)){without.push(e.employeeNumber||e.id);return;}
      var record=drafts[e.id];if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('Brouillon illisible.');
      var rows=lines.map(function(line){var parsed=read(record,line.field,tools,math);var matches=Array.isArray(input.chart)?input.chart.filter(function(a){return a&&String(a.code)===line.code;}):[];var account=matches.length===1?matches[0]:null;var control=!input.chart?'Plan non vérifié':matches.length>1?'Comptes en doublon':!account?'Compte non disponible':account.active===false?'Compte inactif':account.postable===false?'Compte non imputable':'Compte à confirmer';return {code:line.code,label:line.label,field:line.field,side:line.side,value:parsed.value,issue:parsed.issue,accountLabel:account?String(account.label||''):'',control:control};});
      var complete=rows.every(function(r){return r.value!==null;}),debit=0n,credit=0n;rows.forEach(function(r){if(r.value!==null){if(r.side==='debit')debit+=r.value;else credit+=r.value;}});
      output.push({payable:read(record,'amount-payable',tools,math),id:e.id,employee:[e.employeeNumber||e.id,e.displayName||[e.lastName,e.firstName].filter(Boolean).join(' ')].filter(Boolean).join(' · '),rows:rows,complete:complete,debit:debit,credit:credit});
    });
    return {period:input.period,entries:output,without:without,unknown:unknown};
  }
  function mount(container,options){
    var hr=options.hr,dossierId=options.dossier.id,tools=options.tools,math=options.math;
    function allowed(){var d=hr.currentDossier();return !!(d&&d.id===dossierId&&hr.isDemoTestDossier(dossierId)&&options.canView());}
    if(!allowed()){container.textContent='Simulation réservée au dossier fictif PRH-TEST-2026 avec droit de consultation.';return;}
    var months=tools.monthList(hr.currentDossier());
    container.innerHTML='<section class="payroll-book-workspace"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SIMULATION DISTINCTE · SANS GÉNÉRATION</p><h3>Voir le rendu avec les brouillons</h3></div><span class="badge draft">SIMULATION FICTIVE</span></div><div class="alert warning">Lecture seule à partir de bulletins brouillons non approuvés. Ce rendu n’est ni un journal généré ni une écriture comptable ; aucun paiement, calcul de taux, validation ou transfert n’est réalisé. Les chiffres et comptes sont à vérifier.</div><form data-journal-simulation-form class="rubric-card"><label>Mois <select name="period">'+months.map(function(m){return '<option value="'+esc(m)+'">'+esc(m)+'</option>';}).join('')+'</select></label> <button type="submit" class="btn btn-primary"'+(!months.length?' disabled':'')+'>Afficher la simulation</button><p>Réactualisez après modification des brouillons ou du plan comptable.</p></form><div data-journal-simulation-result aria-live="polite"></div></section>';
    var form=container.querySelector('[data-journal-simulation-form]'),host=container.querySelector('[data-journal-simulation-result]');
    form.elements.period.onchange=function(){host.innerHTML='';};
    form.onsubmit=function(ev){ev.preventDefault();host.innerHTML='';try{
      if(!allowed())throw new Error('Dossier ou droit de consultation indisponible.');var period=form.elements.period.value,d=hr.currentDossier(),currentMonths=tools.monthList(d),chartInfo=options.plan(d),chart=chartInfo.chart,report=build({period:period,months:currentMonths,employees:hr.employees(dossierId),drafts:tools.readPeriodDrafts(dossierId,period),chart:chart},tools,math);
      var sections=report.entries.map(function(entry){var rows=entry.rows.map(function(r){var display=r.value===null?'—':math.format(r.value),source=r.field+' · '+(r.issue||'Montant saisi');return '<tr><td>'+esc(r.code)+'</td><td>'+esc(r.label)+(r.accountLabel?'<br><small>Plan : '+esc(r.accountLabel)+'</small>':'')+'</td><td>'+esc(r.side==='debit'?display:'')+'</td><td>'+esc(r.side==='credit'?display:'')+'</td><td>'+esc(source+' ; '+r.control)+'</td></tr>';}).join('');
        var sums=entry.complete?'Montants affichés : débit '+math.format(entry.debit)+' · crédit '+math.format(entry.credit)+' · écart '+math.format(entry.debit-entry.credit)+'.':'Montants incomplets : aucun équilibre global n’est conclu.';
        return '<section class="rubric-card"><h4>'+esc(entry.employee)+'</h4><p>Montant à payer du brouillon (information seule, non imputé) : '+esc(entry.payable.value===null?entry.payable.issue:math.format(entry.payable.value))+'</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte indicatif</th><th>Intitulé</th><th>Débit</th><th>Crédit</th><th>Source et contrôles</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>'+esc(sums)+' Le rapprochement ne vaut pas validation.</p></section>';}).join('');
      host.innerHTML='<div class="alert info"><strong>SIMULATION · '+esc(report.period)+' · '+report.entries.length+' bulletin(s) brouillon(s)</strong><br>'+esc(chartInfo.notice)+'</div>'+(sections||'<p>Aucun bulletin brouillon enregistré pour cette période.</p>')+'<p>'+report.without.length+' fiche(s) sans bulletin brouillon ; '+report.unknown.length+' brouillon(s) sans fiche reconnue, non inclus.</p><div class="alert warning"><div>La simulation utilise uniquement les montants saisis : brut, CNSS, ITS, assurance et salaire net ; le montant à payer est distinct et non imputé. Les absences ne sont pas des zéros. Assurance : crédit direct 4286 hypothétique, sans seconde déduction du 422 ; sa part et son inclusion dans le net sont à confirmer. Le salaire net au crédit 422 est provisoire : les retenues et son positionnement doivent être vérifiés. Brut présenté en 6611 sans ventilation des primes ; la part relevant de 6612 reste à identifier. Les avances, frais, autres retenues et éventuels écarts ne sont pas imputés : un solde affiché ne prouve pas la complétude de l’écriture.</div></div><p><strong>Charges patronales et paiements :</strong> aucune écriture simulée, faute de montants patronaux approuvés et de règlements qualifiés. Les déclarations fictives ne constituent pas une preuve de paiement.</p>';
    }catch(error){host.textContent=error.message;}};
  }
  return {lines:lines,build:build,mount:mount};
});
