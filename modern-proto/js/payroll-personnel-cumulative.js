/* Cumuls des fiches de personnel fictives, sans historique d'affectation. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PayrollPersonnelCumulative = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var columns = [
    {key:'code',label:'Code'},
    {key:'label',label:'Intitulé'},
    {key:'count',label:"Nombre d'employés"}
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function build(input, personnel) {
    var classification = personnel.classifications.find(function(c){return c.key===input.classification;});
    if (!classification || !Array.isArray(input.months) || input.months.indexOf(input.month)<0) throw new Error('Classement ou mois invalide.');
    var keys=input.columnKeys || [], chosen=new Set(keys);
    if (!keys.length || chosen.size!==keys.length || keys.some(function(k){return !columns.some(function(c){return c.key===k;});})) throw new Error('Sélectionnez au moins une colonne.');
    var catalog=input.refs[classification.key], groups=new Map(), seen=new Set(), present=0, uncertain=0, excluded=0, unknown=0;
    function group(key,item) {
      if (!groups.has(key)) groups.set(key,{code:item?String(item.code||''):'', label:item?String(item.label||item.ohadaClassification||''):'Non renseigné ou non reconnu',count:0});
      return groups.get(key);
    }
    (input.employees||[]).forEach(function(e){
      // Chaque fiche contribue au plus une fois à chaque groupe, même en cas d'affectation répétée.
      if (!e || !e.id) throw new Error('Fiche employé sans identifiant : état impossible.');
      if (seen.has(e.id)) throw new Error('Fiche employé dupliquée : état impossible.');
      seen.add(e.id);
      var presence=personnel.presence(e,input.month);
      if (!presence.include){excluded++;return;}
      present++;if(presence.warning)uncertain++;
      var member=personnel.membership(e,classification,catalog);
      member.ids.forEach(function(id){var item=catalog.find(function(c){return c.id===id;});var g=group('known:'+id,item);g.count++;});
      if(!member.ids.length||member.unresolved.length){var g=group('unknown',null);g.count++;unknown++;}
    });
    var sorted=Array.from(groups.entries()).sort(function(a,b){if(a[0]==='unknown')return 1;if(b[0]==='unknown')return -1;return (a[1].code||a[1].label).localeCompare(b[1].code||b[1].label,'fr',{numeric:true,sensitivity:'base'})||a[1].label.localeCompare(b[1].label,'fr',{sensitivity:'base'})||a[0].localeCompare(b[0]);});
    var rows=sorted.map(function(entry){var g=entry[1];return {values:{code:g.code,label:g.label,count:String(g.count)}};});
    var reportNotes=[
      'Données fictives en lecture seule. Les fiches et les affectations sont actuelles et ne constituent pas un historique du mois choisi.',
      'Présence indicative : au moins un jour de chevauchement avec le mois choisi. Parmi les fiches retenues, les dates manquantes ou incohérentes et les réembauches sont signalées pour contrôle : '+uncertain+' fiche(s) à vérifier. '+excluded+' fiche(s) clairement hors période exclue(s).',
      'Fiches distinctes retenues : '+present+'. Les diplômes et fonctions multiples peuvent compter un employé dans plusieurs groupes ; la somme des lignes n’est pas un effectif dédoublonné.',
      'Classement absent ou non reconnu : '+unknown+' fiche(s) dans une ligne distincte. Une fiche comportant une affectation reconnue et une autre non reconnue peut figurer dans les deux groupes. Seuls les groupes ayant au moins une fiche sont affichés.'
    ];
    return {paymentReport:true,advanceReport:true,notesAfterTable:true,title:'Etat cumulé du Personnel · brouillon test',period:input.month,periodDisplay:input.month,method:classification.label+' · '+input.month,dossier:input.dossier,licenseOwner:input.licenseOwner||'',columns:columns.filter(function(c){return chosen.has(c.key);}).map(function(c){return {key:c.key,label:c.label,kind:'value'};}),rows:rows,reportNotes:reportNotes};
  }
  function mount(container,options) {
    var win=container.ownerDocument.defaultView,hr=options.hr,id=options.dossier.id,book=options.book,personnel=options.personnel,dirty=false,saved=null,months=options.tools.monthList(options.dossier);
    function allowed(){var d=hr.currentDossier();return !!(d&&d.id===id&&hr.isDemoTestDossier(id)&&options.canView());}
    if(!allowed()){container.textContent='État disponible uniquement pour le dossier fictif PRH-TEST-2026 avec droit de consultation.';return;}
    container.innerHTML='<section class="payroll-book-workspace payroll-rubric-cumulative"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · ÉDITIONS · ÉTATS SUR LE PERSONNEL</p><h3>Etat cumulé du Personnel</h3></div><span class="badge draft">BROUILLON TEST</span></div><div class="alert warning">Fiches fictives et affectations actuelles, non historiques. La présence est indicative : les dates incomplètes et les réembauches sont signalées. Un employé multi-diplômé ou multi-fonctions peut compter dans plusieurs groupes.</div><form class="rubric-setup" data-personnel-cumulative-form><fieldset class="rubric-card"><legend>Sélection</legend><div class="rubric-layout-fields"><label>Cumul par<select name="classification">'+personnel.classifications.map(function(c){return '<option value="'+esc(c.key)+'"'+(c.key==='statuses'?' selected':'')+'>'+esc(c.label)+'</option>';}).join('')+'</select></label><label>Employés présents en<select name="month">'+months.map(function(m){return '<option value="'+esc(m)+'">'+esc(new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')))+'</option>';}).join('')+'</select></label></div></fieldset><fieldset class="rubric-card"><legend>Colonnes à imprimer</legend><div class="rubric-checks">'+columns.map(function(c){return '<label><input type="checkbox" name="columns" value="'+esc(c.key)+'" checked> '+esc(c.label)+'</label>';}).join('')+'</div></fieldset><div class="rubric-form-footer"><p data-personnel-cumulative-count aria-live="polite">Lignes générées : —</p><div><button type="button" class="btn btn-secondary" data-personnel-cumulative-cancel>Annuler</button> <button type="submit" class="btn btn-primary">Valider · aperçu</button></div></div></form><div data-personnel-cumulative-result hidden></div></section>';
    var form=container.querySelector('[data-personnel-cumulative-form]'),result=container.querySelector('[data-personnel-cumulative-result]');
    function selection(){return {classification:form.elements.classification.value,month:form.elements.month.value,columnKeys:Array.from(form.querySelectorAll('[name=columns]:checked')).map(function(x){return x.value;})};}
    function snapshot(s){if(!allowed())throw new Error('Dossier ou droit de consultation indisponible.');var d=hr.currentDossier();return Object.assign({},s,{months:options.tools.monthList(d),refs:personnel.refs(hr,id),employees:hr.employees(id),dossier:d,licenseOwner:options.licenseOwner()});}
    function fresh(){var source=snapshot(saved.selection);if(JSON.stringify(source)!==saved.signature)throw new Error('Les fiches ou référentiels ont changé : revenez à la sélection et validez de nouveau.');return build(source,personnel);}
    function updateCount(){try{var s=selection();if(!s.columnKeys.length)s.columnKeys=['count'];var r=build(snapshot(s),personnel);form.querySelector('[data-personnel-cumulative-count]').textContent='Lignes générées : '+r.rows.length;}catch(e){form.querySelector('[data-personnel-cumulative-count]').textContent='Lignes générées : indisponible';}}
    form.addEventListener('change',updateCount);updateCount();
    form.onsubmit=function(e){e.preventDefault();try{
      var s=selection(),source=snapshot(s),report=build(source,personnel);saved={selection:s,signature:JSON.stringify(source)};form.hidden=true;result.hidden=false;
      var layout={style:'plain8',orientation:'landscape',margins:'standard',pageFirst:'',pageLast:'',parity:'none'};
      result.innerHTML='<div class="payroll-book-actions"><button type="button" class="btn btn-secondary" data-cumulative-back>Retour à la sélection</button><button type="button" class="btn btn-primary" data-cumulative-print>Imprimer / PDF</button><button type="button" class="btn btn-secondary" data-cumulative-xlsx>Excel</button><button type="button" class="btn btn-secondary" data-cumulative-tsv>Fichier texte</button></div>'+book.reportHtml(report,layout);
      result.querySelector('[data-cumulative-back]').onclick=function(){result.hidden=true;form.hidden=false;updateCount();};
      result.querySelector('[data-cumulative-print]').onclick=function(){try{var r=fresh(),popup=win.open('','_blank');if(!popup)throw new Error('Fenêtre d’impression bloquée.');popup.opener=null;popup.document.write(book.printDocument(r,layout));popup.document.close();}catch(err){win.alert(err.message);}};
      ['xlsx','tsv'].forEach(function(type){result.querySelector('[data-cumulative-'+type+']').onclick=function(){try{var r=fresh(),m=book.matrix(r),data=type==='xlsx'?options.exchange.exportTabularWorkbook(r.title,m.headers,m.rows):book.tsv(r),blob=new win.Blob([data],{type:type==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/plain;charset=utf-8'}),url=win.URL.createObjectURL(blob),a=win.document.createElement('a');a.href=url;a.download='TEST-personnel-cumule-'+s.month+(type==='xlsx'?'.xlsx':'.txt');win.document.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(url);},1000);}catch(err){win.alert(err.message);}};});
      result.querySelector('[data-cumulative-back]').focus({preventScroll:true});
    }catch(err){win.alert(err.message);}};
    form.querySelector('[data-personnel-cumulative-cancel]').onclick=function(){if(dirty&&!win.confirm('Quitter cet état ? Les choix temporaires seront perdus.'))return;dirty=false;options.onClose();};
    container.addEventListener('input',function(){dirty=true;});container.addEventListener('change',function(){dirty=true;});
    var profile=win.document.querySelector('#demo-active-profile'),initialProfile=profile&&profile.value;
    function guard(e){if(!dirty||!container.isConnected||container.contains(e.target))return;var el=e.target;if(!el.closest||el.closest('a[download]'))return;if(el.closest('a[href],button[data-action]')&&!win.confirm('Quitter cet état ? Les choix temporaires seront perdus.')){e.preventDefault();e.stopImmediatePropagation();}}
    function profileGuard(e){if(dirty&&container.isConnected&&profile&&e.target===profile&&profile.value!==initialProfile&&!win.confirm('Changer de profil ? Les choix temporaires seront perdus.')){profile.value=initialProfile;e.preventDefault();e.stopImmediatePropagation();}}
    function unload(e){if(dirty&&container.isConnected){e.preventDefault();e.returnValue='';}}
    win.document.addEventListener('click',guard,true);win.document.addEventListener('change',profileGuard,true);win.addEventListener('beforeunload',unload);var observer=new win.MutationObserver(function(){if(!container.isConnected){observer.disconnect();win.document.removeEventListener('click',guard,true);win.document.removeEventListener('change',profileGuard,true);win.removeEventListener('beforeunload',unload);}});observer.observe(win.document.documentElement,{childList:true,subtree:true});
  }
  return {columns:columns,build:build,mount:mount};
});
