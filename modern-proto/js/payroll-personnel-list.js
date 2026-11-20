/* État de personnel fictif : fiches courantes, sans reconstitution historique. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PayrollPersonnelList = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var classifications = [
    {key:'qualifications', label:'Diplômes', fields:['qualificationIds'], legacy:'degree'},
    {key:'professions', label:'Professions', fields:['professionId'], legacy:'profession'},
    {key:'statuses', label:'Statuts', fields:['employeeStatus']},
    {key:'categories', label:'Catégories/Echelons', fields:['categoryId'], legacy:'categoryStep'},
    {key:'services', label:'Services', fields:['serviceId'], legacy:'service'},
    {key:'functions', label:'Fonctions', fields:['functionIds','functionId'], legacy:'function'},
    {key:'zones', label:'Zones géographiques', fields:['geographicZoneId'], legacy:'zone'},
    {key:'banks', label:'Banques', fields:['bankId'], legacy:'bankName'}
  ];
  var columns = [
    {key:'number',label:'Matricule'}, {key:'name',label:'Nom et Prénoms'}, {key:'hire',label:"Date d'embauche"}, {key:'address',label:'Adresse'}, {key:'misc',label:'Autres informations'}, {key:'birth',label:'Date de naissance'}, {key:'sex',label:'Sexe'}, {key:'nationality',label:'Nationalité'},
    {key:'cnss',label:'N° CNSS'}, {key:'insurance',label:'Assurance complém.'}, {key:'contract',label:'N° contrat'}, {key:'marital',label:'Sit. matrimoniale'}, {key:'children',label:'Enfants'}, {key:'profession',label:'Profession'}, {key:'status',label:'Statut'}, {key:'category',label:'Catégorie/Echelon'},
    {key:'effective',label:'Date/Catégorie'}, {key:'service',label:'Service'}, {key:'function',label:'Fonction'}, {key:'zone',label:'Zone'}, {key:'payment',label:'Mode de règlement'}, {key:'bank',label:'Banque'}, {key:'account',label:'Compte'}, {key:'blank',label:'Colonne vide'}
  ];
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function label(item) { return [item.code,item.label || item.ohadaClassification].filter(Boolean).join(' · ') || item.id; }
  function normalize(v) { return String(v || '').trim().toLocaleLowerCase('fr'); }
  function membership(employee, config, catalog) {
    var ids=[];
    config.fields.forEach(function(field){ var v=employee[field]; (Array.isArray(v)?v:[v]).filter(Boolean).forEach(function(x){if(ids.indexOf(String(x))<0) ids.push(String(x));}); });
    if (!ids.length && config.legacy && employee[config.legacy]) ids.push(String(employee[config.legacy]));
    var matches=[], unresolved=[];
    ids.forEach(function(id) {
      var found=catalog.filter(function(x){return x.id===id;});
      if(!found.length) found=catalog.filter(function(x){return [x.code,x.label].some(function(v){return v && normalize(v)===normalize(id);});});
      if(found.length===1){if(matches.indexOf(found[0].id)<0)matches.push(found[0].id);}else unresolved.push(id);
    });
    return {ids:matches,unresolved:unresolved};
  }
  function validDate(date) { if(!/^\d{4}-\d\d-\d\d$/.test(date||''))return false;var d=new Date(date+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===date; }
  function presence(employee,month) {
    var hire=employee.firstHireDate||'',end=employee.terminationDate||'',rehire=employee.rehireDate||'',last=month+'-'+String(new Date(Date.UTC(+month.slice(0,4),+month.slice(5,7),0)).getUTCDate()).padStart(2,'0'),first=month+'-01';
    if((hire&&!validDate(hire))||(end&&!validDate(end))||(rehire&&!validDate(rehire)))return {include:true, warning:'Dates invalides · présence à vérifier'};
    if(!hire)return {include:true,warning:'Date d’embauche absente · présence à vérifier'};
    if(hire>last && (!rehire || rehire>last))return {include:false};
    if((end && end<hire)||(rehire && (!end || rehire<=end || rehire<hire)))return {include:true,warning:'Dates de départ ou réembauche incohérentes · présence à vérifier'};
    if(end && !rehire && end<first)return {include:false};
    if(end && rehire && end<first && rehire>last)return {include:false};
    return {include:true,warning:rehire?'Réembauche · historique à vérifier':''};
  }
  function refs(hr,id) {return {qualifications:hr.employeeDefinitionItems(id,'qualifications'),professions:hr.employeeDefinitionItems(id,'professions'),statuses:hr.employeeStatuses(id),categories:hr.employeeCategories(id),services:hr.employeeServices(id),functions:hr.employeeFunctions(id),zones:hr.employeeGeographicZones(id),banks:hr.employeeDefinitionItems(id,'banks'),insurers:hr.employeeDefinitionItems(id,'socialFunds')};}
  function reference(employee, config, catalogs) {
    var cat=catalogs[config.key], m=membership(employee,config,cat), vals=m.ids.map(function(id){return label(cat.find(function(x){return x.id===id;}));});
    return vals.concat(m.unresolved.map(function(x){return x+' · non reconnu';})).join(' ; ');
  }
  function build(input) {
    var config=classifications.find(function(x){return x.key===input.classification;});
    if(!config || !Array.isArray(input.months) || input.months.indexOf(input.month)<0)throw new Error('Classement ou mois invalide.');
    var cat=input.refs[config.key], scope=input.selected, known=new Set(cat.map(function(x){return x.id;}));
    if(scope!=='*'&&(!Array.isArray(scope)||!scope.length||new Set(scope).size!==scope.length||scope.some(function(x){return !known.has(x);})))throw new Error('Choisissez au moins un élément du classement.');
    var keys=input.columnKeys||[],set=new Set(keys);if(!keys.length||set.size!==keys.length||keys.some(function(k){return !columns.some(function(c){return c.key===k;});}))throw new Error('Sélectionnez au moins une colonne valide.');
    var cols=[{key:'group',label:config.label+' · classement',kind:'identity'}].concat(columns.filter(function(c){return set.has(c.key);}).map(function(c){return {key:c.key,label:c.label,kind:c.key==='number'||c.key==='name'?'identity':'value', intentionallyBlank:c.key==='blank'};}),[{key:'control',label:'Contrôles',kind:'value'}]);
    var rows=[],excluded=0,uncertain=0;
    (input.employees||[]).forEach(function(e){
      var mem=membership(e,config,cat),groups=mem.ids.filter(function(id){return scope==='*'||scope.indexOf(id)>=0;});
      if(scope==='*'&&(!mem.ids.length||mem.unresolved.length))groups.push(null);
      if(!groups.length)return;var p=presence(e,input.month);if(!p.include){excluded++;return;}if(p.warning)uncertain++;
      var ins=(Array.isArray(e.supplementaryInsurances)?e.supplementaryInsurances:[]).map(function(a){var f=input.refs.insurers.find(function(x){return x.id===a.insurerId;});return f?label(f):'Compagnie non reconnue';});if(!ins.length&&e.supplementaryInsuranceCompany)ins.push(e.supplementaryInsuranceCompany);
      var v={number:e.employeeNumber||e.id||'',name:e.displayName||[e.lastName,e.firstName].filter(Boolean).join(' '),hire:e.firstHireDate||'',address:e.address||'',misc:[e.miscellaneousLabel,e.miscellaneousValue].filter(Boolean).join(' : '),birth:e.birthDate||'',sex:e.sex||'',nationality:e.nationality||'',cnss:e.socialInsuranceNumber||'',insurance:ins.join(' ; '),contract:'',marital:e.maritalStatus||'',children:e.childrenCount==null?'':String(e.childrenCount),profession:reference(e,classifications[1],input.refs),status:reference(e,classifications[2],input.refs),category:reference(e,classifications[3],input.refs),effective:e.effectiveDate||'',service:reference(e,classifications[4],input.refs),function:reference(e,classifications[5],input.refs),zone:reference(e,classifications[6],input.refs),payment:e.paymentMethod||'',bank:reference(e,classifications[7],input.refs),account:e.bankAccountNumber||'',blank:''};
      groups.forEach(function(g){var gr=g?label(cat.find(function(x){return x.id===g;})):'Non renseigné ou non reconnu'+(mem.unresolved.length?' : '+mem.unresolved.join(', '):'');var alerts=[];if(p.warning)alerts.push(p.warning);if(!g)alerts.push('Classement à vérifier');rows.push({id:e.id,values:Object.assign({},v,{group:gr,control:alerts.join(' ; ')||'—'})});});
    });
    rows.sort(function(a,b){return a.values.group.localeCompare(b.values.group,'fr',{numeric:true,sensitivity:'base'}) || String(a.values.number).localeCompare(String(b.values.number),'fr',{numeric:true,sensitivity:'base'}) || String(a.id).localeCompare(String(b.id));});
    var notes=['Données fictives en lecture seule. Les fiches et affectations sont actuelles, pas un historique à la date du mois choisi.', 'Présence indicative : au moins un jour de chevauchement entre le mois et les dates de fiche. Les dates absentes ou incohérentes et les réembauches sont à vérifier ; '+uncertain+' fiche(s) concernée(s). '+excluded+' fiche(s) clairement hors période exclue(s) dans le filtre.', 'Un employé avec plusieurs diplômes ou fonctions peut apparaître dans plusieurs groupes ; les lignes ne sont pas un effectif dédoublonné. * inclut les classements non renseignés ou non reconnus.', 'Les cellules absentes ne sont pas inventées. Le numéro de contrat de travail n’est pas disponible dans les fiches ; aucune substitution par un numéro d’assuré.'];
    if(!set.has('number')&&!set.has('name'))notes.push('Attention : ni matricule ni nom sélectionné ; les lignes ne permettent pas d’identifier les employés.');
    return {paymentReport:true,advanceReport:true,notesAfterTable:true,title:'Liste du personnel · brouillon test',period:input.month,periodDisplay:input.month,method:input.month+' · '+config.label,dossier:input.dossier,licenseOwner:input.licenseOwner||'',columns:cols,rows:rows,reportNotes:notes};
  }
  function mount(container, options) {
    var win=container.ownerDocument.defaultView,hr=options.hr,id=options.dossier.id,book=options.book,dirty=false,saved=null;
    function allowed(){var d=hr.currentDossier();return !!(d&&d.id===id&&hr.isDemoTestDossier(id)&&options.canView());}
    if(!allowed()){container.textContent='État disponible uniquement pour le dossier fictif PRH-TEST-2026 avec droit de consultation.';return;}
    var catalogs=refs(hr,id),months=options.tools.monthList(options.dossier);
    container.innerHTML='<section class="payroll-book-workspace payroll-rubric-cumulative"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · ÉDITIONS · ÉTATS SUR LE PERSONNEL</p><h3>Liste du Personnel</h3></div><span class="badge draft">BROUILLON TEST</span></div><div class="alert warning">Fiches fictives actuelles, non historiques. La présence est indicative et les dates incomplètes sont signalées. Les champs personnels et bancaires ne doivent contenir que des données de test.</div><form class="rubric-setup" data-personnel-form><fieldset class="rubric-card"><legend>Sélection</legend><div class="rubric-layout-fields"><label>Classement<select name="classification">'+classifications.map(function(c){return '<option value="'+esc(c.key)+'"'+(c.key==='statuses'?' selected':'')+'>'+esc(c.label)+'</option>';}).join('')+'</select></label><label>Employés présents en<select name="month">'+months.map(function(m){return '<option value="'+esc(m)+'">'+esc(new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T00:00:00Z')))+'</option>';}).join('')+'</select></label></div><div class="rubric-group-scope"><strong data-scope-label>Statuts</strong><div class="rubric-scope-choices"><label><input type="radio" name="scope" value="all" checked> * · Tous</label><label><input type="radio" name="scope" value="selected"> Sélection personnalisée</label></div><details class="rubric-group-browser"><summary data-scope-summary>Parcourir les statuts</summary><label>Rechercher<input type="search" data-personnel-search placeholder="Code ou libellé"></label><div data-personnel-choices></div></details><p class="rubric-helper">* comprend les fiches sans classement reconnu. Plusieurs diplômes ou fonctions peuvent produire plusieurs lignes.</p></div></fieldset><fieldset class="rubric-card"><legend>Colonnes à imprimer</legend><p class="rubric-card-intro">Décochez les informations inutiles. La colonne N° contrat reste vide : elle n’existe pas dans les fiches actuelles.</p><div class="rubric-output-grid">'+[0,1,2].map(function(g){return '<div class="rubric-checks">'+columns.slice(g*8,g*8+8).map(function(c){return '<label><input type="checkbox" name="columns" value="'+esc(c.key)+'" checked> '+esc(c.label)+'</label>';}).join('')+'</div>';}).join('')+'</div></fieldset><div class="rubric-form-footer"><p>Le classement et les contrôles restent visibles dans l’état.</p><div><button type="button" class="btn btn-secondary" data-personnel-cancel>Annuler</button> <button type="submit" class="btn btn-primary">Valider · aperçu</button></div></div></form><div data-personnel-result hidden></div></section>';
    var form=container.querySelector('[data-personnel-form]'),choices=form.querySelector('[data-personnel-choices]'),result=container.querySelector('[data-personnel-result]');
    function paint(){var c=classifications.find(function(x){return x.key===form.elements.classification.value;});form.querySelector('[data-scope-label]').textContent=c.label;form.querySelector('[data-scope-summary]').textContent='Parcourir : '+c.label;form.querySelector('[data-personnel-search]').value='';form.querySelector('[name="scope"][value="all"]').checked=true;choices.innerHTML=catalogs[c.key].map(function(x){return '<label data-choice-row><input type="checkbox" name="selected" value="'+esc(x.id)+'" disabled> '+esc(label(x))+'</label>';}).join('') || '<p>Aucun élément du référentiel.</p>';}
    paint();form.elements.classification.addEventListener('change',paint);
    form.querySelectorAll('[name=scope]').forEach(function(r){r.addEventListener('change',function(){choices.querySelectorAll('input').forEach(function(i){i.disabled=form.elements.scope.value==='all';});if(form.elements.scope.value==='selected')form.querySelector('details').open=true;});});
    form.querySelector('[data-personnel-search]').addEventListener('input',function(){var q=normalize(this.value);choices.querySelectorAll('[data-choice-row]').forEach(function(r){r.hidden=normalize(r.textContent).indexOf(q)<0;});});
    function selection(){return {classification:form.elements.classification.value,month:form.elements.month.value,selected:form.elements.scope.value==='all'?'*':Array.from(choices.querySelectorAll('input:checked')).map(function(x){return x.value;}),columnKeys:Array.from(form.querySelectorAll('[name=columns]:checked')).map(function(x){return x.value;})};}
    function snapshot(s){if(!allowed())throw new Error('Dossier ou droit de consultation indisponible.');var d=hr.currentDossier();return Object.assign({},s,{months:options.tools.monthList(d),refs:refs(hr,id),employees:hr.employees(id),dossier:d,licenseOwner:options.licenseOwner()});}
    function fresh(){var source=snapshot(saved.selection);if(JSON.stringify(source)!==saved.signature)throw new Error('Les fiches ou référentiels ont changé : revenez à la sélection et validez de nouveau.');return build(source);}
    form.onsubmit=function(e){e.preventDefault();try{var s=selection(),source=snapshot(s),report=build(source);saved={selection:s,signature:JSON.stringify(source)};form.hidden=true;result.hidden=false;var layout={style:'plain8',orientation:'landscape',margins:'standard',pageFirst:'',pageLast:'',parity:'none'};result.innerHTML='<div class="payroll-book-actions"><button type="button" class="btn btn-secondary" data-personnel-back>Retour à la sélection</button><button type="button" class="btn btn-primary" data-personnel-print>Imprimer / PDF</button><button type="button" class="btn btn-secondary" data-personnel-xlsx>Excel</button><button type="button" class="btn btn-secondary" data-personnel-tsv>Fichier texte</button></div>'+book.reportHtml(report,layout);result.querySelector('[data-personnel-back]').onclick=function(){result.hidden=true;form.hidden=false;};result.querySelector('[data-personnel-print]').onclick=function(){try{var r=fresh(),popup=win.open('','_blank');if(!popup)throw new Error('Fenêtre d’impression bloquée.');popup.opener=null;popup.document.write(book.printDocument(r,layout));popup.document.close();}catch(err){win.alert(err.message);}};['xlsx','tsv'].forEach(function(type){result.querySelector('[data-personnel-'+type+']').onclick=function(){try{var r=fresh(),m=book.matrix(r),data=type==='xlsx'?options.exchange.exportTabularWorkbook(r.title,m.headers,m.rows):book.tsv(r),blob=new win.Blob([data],{type:type==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/plain;charset=utf-8'}),url=win.URL.createObjectURL(blob),a=win.document.createElement('a');a.href=url;a.download='TEST-liste-personnel-'+s.month+(type==='xlsx'?'.xlsx':'.txt');win.document.body.appendChild(a);a.click();a.remove();win.setTimeout(function(){win.URL.revokeObjectURL(url);},1000);}catch(err){win.alert(err.message);}};});result.querySelector('[data-personnel-back]').focus({preventScroll:true});}catch(err){win.alert(err.message);}};
    form.querySelector('[data-personnel-cancel]').onclick=function(){if(dirty&&!win.confirm('Quitter cet état ? Les choix temporaires seront perdus.'))return;dirty=false;options.onClose();};
    container.addEventListener('input',function(){dirty=true;});container.addEventListener('change',function(){dirty=true;});
    var profile=win.document.querySelector('#demo-active-profile'),initialProfile=profile&&profile.value;
    function guard(e){if(!dirty||!container.isConnected||container.contains(e.target))return;var el=e.target;if(!el.closest||el.closest('a[download]'))return;if(el.closest('a[href],button[data-action]')&&!win.confirm('Quitter cet état ? Les choix temporaires seront perdus.')){e.preventDefault();e.stopImmediatePropagation();}}
    function profileGuard(e){if(dirty&&container.isConnected&&profile&&e.target===profile&&profile.value!==initialProfile&&!win.confirm('Changer de profil ? Les choix temporaires seront perdus.')){profile.value=initialProfile;e.preventDefault();e.stopImmediatePropagation();}}
    function unload(e){if(dirty&&container.isConnected){e.preventDefault();e.returnValue='';}}
    win.document.addEventListener('click',guard,true);win.document.addEventListener('change',profileGuard,true);win.addEventListener('beforeunload',unload);var observer=new win.MutationObserver(function(){if(!container.isConnected){observer.disconnect();win.document.removeEventListener('click',guard,true);win.document.removeEventListener('change',profileGuard,true);win.removeEventListener('beforeunload',unload);}});observer.observe(win.document.documentElement,{childList:true,subtree:true});
  }
  return {classifications:classifications,columns:columns,membership:membership,presence:presence,refs:refs,build:build,mount:mount};
});
