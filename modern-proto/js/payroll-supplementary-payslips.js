/* Bulletins complémentaires fictifs pour les employés recrutés depuis une autre entreprise. */
(function (root) {
  'use strict';
  var PREFIX = 'perfecto.payroll.supplementary-payslips.v1.';
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function isRecruitedElsewhere(employee) {
    var date = String(employee && employee.terminationDate || ''), match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return false;
    var year=+match[1], month=+match[2], day=+match[3], utc=new Date(Date.UTC(year, month-1, day));
    return year >= 1900 && utc.getUTCFullYear()===year && utc.getUTCMonth()===month-1 && utc.getUTCDate()===day;
  }
  function applyFormula(expression, values, tools) {
    var source=String(expression || '');
    var vars={base:values.base, taux:values.taux, quantite:values.quantite};
    var resolved=source.replace(/\b(base|taux|quantite)\b/gi,function(match){
      var value=tools.numbers(vars[match.toLowerCase()]);
      if(value==='') throw new Error('Renseignez la valeur de '+match+'.');
      return '('+value+')';
    });
    return tools.calculate(resolved);
  }
  function load(id) {
    var raw = root.localStorage.getItem(PREFIX + encodeURIComponent(id));
    if (!raw) return { version:1, slips:[], rules:[] };
    var data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.slips)) throw new Error('Les données des bulletins complémentaires sont illisibles. Aucune modification effectuée.');
    if (data.rules == null) data.rules=[];
    if (!Array.isArray(data.rules)) throw new Error('Les règles sont illisibles. Aucune modification effectuée.');
    return data;
  }
  function save(id, data) { root.localStorage.setItem(PREFIX + encodeURIComponent(id), JSON.stringify(data)); }
  function mount(container, options) {
    if (!container || !options || !options.hr || !options.tools) return;
    var hr=options.hr, tools=options.tools, dossier=options.dossier, dossierId=dossier.id, data;
    var state={employeeId:'', slipId:'', mode:'view', query:''};
    try { data=load(dossierId); } catch(e) { container.textContent=e.message; return; }
    function employees() { return hr.employees(dossierId).filter(isRecruitedElsewhere).sort(function(a,b){return String(a.employeeNumber||a.id).localeCompare(String(b.employeeNumber||b.id),'fr',{numeric:true});}); }
    function currentEmployee() { return employees().find(function(e){return e.id===state.employeeId;}) || null; }
    function canEdit() { var active=hr.currentDossier(); return !!(hr.isDemoTestDossier(dossierId) && active && active.id===dossierId && options.canEdit()); }
    function canDelete() { var active=hr.currentDossier(); return !!(hr.isDemoTestDossier(dossierId) && active && active.id===dossierId && options.canDelete()); }
    function selectedSlip() { return data.slips.find(function(s){return s && s.employeeId===state.employeeId && s.id===state.slipId;}) || null; }
    function validEmployee() { if (!currentEmployee()) throw new Error('Sélectionnez un employé dont la fiche indique un recrutement depuis une autre entreprise.'); }
    function guard() { return state.mode === 'view' || root.confirm('Abandonner les modifications non enregistrées de ce bulletin ?'); }
    function showError(e) { root.alert(e.message || String(e)); }
    function makeId() { return 'supp-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10); }
    function selection(employee) { return tools.resolveRubrics(employee,hr.employeeStatuses(dossierId),hr.employeeRubricCatalog()); }
    function labelPeriod(period) { return period || 'Période non renseignée'; }
    function render() {
      var list=employees().filter(function(e){return tools.matchesEmployee(e,state.query);});
      if(!list.some(function(e){return e.id===state.employeeId;})) state.employeeId='';
      var employee=list.find(function(e){return e.id===state.employeeId;}) || null;
      var slips=data.slips.filter(function(s){return s && employee && s.employeeId===employee.id;});
      if(!slips.some(function(s){return s.id===state.slipId;})) state.slipId=slips[0] && slips[0].id || '';
      var slip=selectedSlip(), editing=state.mode!=='view' && canEdit() && !!employee;
      var selectionResult=employee ? selection(employee) : null;
      var rubricRows=selectionResult ? selectionResult.rows : [];
      var amounts=slip && slip.amounts && typeof slip.amounts==='object' ? slip.amounts : {};
      var periods=tools.monthList(dossier), defaultPeriod=periods[0] || '';
      var fields=editing ? '<div class="payroll-supp-fields"><label>Bulletin <input name="label" form="supp-slip-form" maxlength="80" required value="'+escape(state.mode==='edit' && slip ? slip.label : '')+'" placeholder="Libellé du bulletin"></label><label>Période <select name="period" form="supp-slip-form" required>'+(state.mode==='edit' && slip && periods.indexOf(slip.period)<0 ? '<option value="'+escape(slip.period)+'" selected>Période hors cycle : '+escape(slip.period)+'</option>' : '')+periods.map(function(p){return '<option value="'+escape(p)+'"'+((state.mode==='edit' && slip ? slip.period : defaultPeriod)===p?' selected':'')+'>'+escape(labelPeriod(p))+'</option>';}).join('')+'</select></label><label>À payer · montant saisi <input name="payable" form="supp-slip-form" inputmode="decimal" maxlength="20" value="'+escape(state.mode==='edit' && slip ? slip.payable : '')+'"></label></div>' : (slip ? '<p class="small muted">'+escape(slip.label)+' · '+escape(labelPeriod(slip.period))+' · À payer : '+escape(slip.payable || 'Non renseigné')+'</p>' : (!employee ? '<p class="small muted">Sélectionnez un employé recruté depuis une autre entreprise pour accéder aux bulletins.</p>' : ''));
      var rows=rubricRows.map(function(r){var val=state.mode==='create' ? '' : amounts[r.id] || ''; return '<tr class="'+(r.heading?'payroll-slip-rubric-heading ':'')+(r.retained?'is-retained':'is-not-retained')+'"><th scope="row"'+(r.level?' class="payroll-slip-rubric-child"':'')+'>'+escape(r.label)+' <span class="payroll-slip-rubric-state">'+(r.retained?'Cochée':'Non cochée')+'</span></th><td>'+(editing && r.retained ? '<input form="supp-slip-form" type="text" inputmode="decimal" maxlength="20" data-supp-rubric="'+escape(r.id)+'" aria-label="Montant · '+escape(r.label)+'" value="'+escape(val)+'">' : (val ? escape(val) : '—'))+'</td></tr>';}).join('');
      var buttons='<button type="button" class="btn btn-primary" data-supp-action="add"'+(!employee||!canEdit()||!periods.length||editing?' disabled':'')+'>Ajouter</button><button type="button" class="btn btn-secondary" data-supp-action="edit"'+(!employee||!slip||!canEdit()||editing?' disabled':'')+'>Modifier</button><button type="button" class="btn btn-danger" data-supp-action="delete"'+(!employee||!slip||!canDelete()||editing?' disabled':'')+'>Supprimer</button><button type="button" class="btn btn-secondary" data-supp-action="print"'+(!employee||!slip||editing?' disabled':'')+'>Éditer</button>';
      container.innerHTML='<section class="payroll-supp-workspace"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · SALAIRES</p><h3>Bulletins complémentaires après débauchage</h3></div><span class="badge draft">BROUILLON TEST</span></div><div class="alert warning"><div>Données fictives uniquement. Le débauchage désigne ici un recrutement depuis une autre entreprise. Vérifiez les dates enregistrées avant ce changement : elles sont désormais interprétées comme des recrutements, et non des départs. Les montants sont saisis ou calculés à partir d’une formule libre, sans règle légale automatique ; aucun bulletin final ni paiement n’est produit.</div></div><div class="payroll-supp-layout"><aside><label>Rechercher un employé<input type="search" data-supp-query placeholder="Matricule, nom ou prénoms" value="'+escape(state.query)+'"></label><p class="small muted">'+list.length+' employé(s) recruté(s) depuis une autre entreprise</p><div class="payroll-slip-scroll"><table><thead><tr><th>Débauchage</th><th>Matricule · Nom</th></tr></thead><tbody>'+list.map(function(e){return '<tr><td>'+escape(e.terminationDate)+'</td><td><button type="button" data-supp-employee="'+escape(e.id)+'"'+(e.id===state.employeeId?' aria-current="true"':'')+'>'+escape((e.employeeNumber||e.id)+' · '+e.displayName)+'</button></td></tr>';}).join('')+'</tbody></table>'+(list.length?'':'<p>Aucun employé correspondant. Renseignez la date de débauchage dans la fiche employé.</p>')+'</div></aside><div><h4>Bulletins</h4><div class="payroll-slip-scroll"><table><thead><tr><th>Bulletin</th><th>À payer</th></tr></thead><tbody>'+slips.map(function(s){return '<tr><td><button type="button" data-supp-slip="'+escape(s.id)+'"'+(s.id===state.slipId?' aria-current="true"':'')+'>'+escape(s.label)+'<br><small>'+escape(labelPeriod(s.period))+'</small></button></td><td>'+escape(s.payable || '—')+'</td></tr>';}).join('')+'</tbody></table>'+(employee && !slips.length?'<p>Aucun bulletin complémentaire.</p>':'')+'</div></div><div class="payroll-supp-detail"><div class="payroll-slip-actions">'+buttons+'</div>'+fields+(selectionResult && selectionResult.isDefaultPreview ? '<p class="small muted">Statut non reconnu : les cases cochées par défaut sont utilisées à titre indicatif.</p>' : '')+'<form id="supp-slip-form"><div class="payroll-slip-scroll payroll-supp-rubrics"><table><thead><tr><th>Rubrique</th><th>Montant</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+(editing ? '<p class="small muted">Seules les rubriques cochées dans le statut peuvent être saisies. Le montant à payer est saisi séparément et n’est pas calculé automatiquement.</p><label class="payroll-slip-checkbox"><input type="checkbox" name="testOnly" required> Je confirme qu’il s’agit de données fictives.</label>' : '')+'<div class="payroll-slip-actions"><button type="button" class="btn btn-secondary" data-supp-action="calculate"'+(!editing||!employee?' disabled':'')+'>Calcul de l’indemnité</button>'+(editing?'<button type="submit" class="btn btn-primary">Valider</button><button type="button" class="btn btn-secondary" data-supp-action="cancel">Annuler</button>':'<button type="button" disabled>Valider</button><button type="button" disabled>Annuler</button>')+'</div></form></div></div><div data-supp-dialog></div></section>';
      bind();
    }
    function saveForm(form) {
      if(!canEdit()) throw new Error('Modification non autorisée ou dossier actif modifié.'); validEmployee();
      if(!form.elements.testOnly.checked) throw new Error('Confirmez le caractère fictif.');
      var label=form.elements.label.value.trim(), period=form.elements.period.value, payable=tools.numbers(form.elements.payable.value);
      if(!label || label.length>80) throw new Error('Renseignez un libellé de 80 caractères maximum.');
      if(tools.monthList(dossier).indexOf(period)<0) throw new Error('Choisissez une période du cycle du dossier.');
      var latest=load(dossierId), original=state.mode==='edit' ? latest.slips.find(function(s){return s.id===state.slipId && s.employeeId===state.employeeId;}) : null;
      if(state.mode==='edit' && !original) throw new Error('Le bulletin n’existe plus.');
      var amounts=original && original.amounts ? JSON.parse(JSON.stringify(original.amounts)) : {};
      var currentSelection=selection(currentEmployee());
      form.querySelectorAll('[data-supp-rubric]').forEach(function(input){ if(!currentSelection.rows.some(function(r){return r.id===input.dataset.suppRubric && r.retained;})) throw new Error('La sélection des rubriques a changé ; rechargez avant d’enregistrer.'); amounts[input.dataset.suppRubric]=tools.numbers(input.value); });
      var record={id:original ? original.id : makeId(),employeeId:state.employeeId,label:label,period:period,payable:payable,amounts:amounts};
      if(original) latest.slips[latest.slips.indexOf(original)]=record; else latest.slips.push(record);
      save(dossierId,latest); data=latest;state.slipId=record.id;state.mode='view'; render();
    }
    function calculator() {
      validEmployee(); if(!canEdit() || state.mode==='view') throw new Error('Ouvrez la saisie d’un bulletin avant le calcul.');
      var host=container.querySelector('[data-supp-dialog]'), targets=Array.from(container.querySelectorAll('[data-supp-rubric]'));
      if(!targets.length) throw new Error('Aucune rubrique cochée ne peut recevoir le résultat.');
      host.innerHTML='<dialog class="payroll-employee-dialog payroll-slip-dialog"><div class="payroll-employee-dialog-head"><h3>Calcul de l’indemnité</h3><button type="button" data-calc-close aria-label="Fermer">×</button></div><p>Indiquez votre formule ou vos taux. Ce calcul est libre et ne représente pas une règle légale automatique. Exemple : 100000 * 0.05</p><label>Règle enregistrée <select data-calc-rule><option value="">Aucune</option>'+data.rules.map(function(rule){return '<option value="'+escape(rule.id)+'">'+escape(rule.label)+'</option>';}).join('')+'</select></label><label>Nom de la règle <input data-calc-name maxlength="80" placeholder="Exemple : indemnité fictive"></label><label>Expression <input data-calc-expression type="text" maxlength="300" placeholder="Base * Taux / 100"></label><div class="payroll-supp-fields"><label>Base <input data-calc-base inputmode="decimal"></label><label>Taux <input data-calc-taux inputmode="decimal"></label><label>Quantité <input data-calc-quantite inputmode="decimal"></label></div><p>Résultat : <strong data-calc-result>—</strong></p><label>Reporter le résultat dans <select data-calc-target><option value="">Choisir une rubrique</option>'+targets.map(function(input,i){return '<option value="'+i+'">'+escape(input.getAttribute('aria-label'))+'</option>';}).join('')+'</select></label><div class="payroll-slip-actions"><button type="button" data-calc-compute>Calculer</button><button type="button" data-calc-save>Enregistrer la règle</button><button type="button" data-calc-delete>Supprimer la règle</button><button type="button" data-calc-transfer>Reporter</button><button type="button" data-calc-close>Fermer</button></div><p class="small muted">Utilisez Base, Taux et Quantite dans vos formules, le point pour les décimales et la virgule entre les arguments des fonctions Puissance, Racine et Modulo. Un taux en pourcentage nécessite une division par 100 si votre formule le prévoit.</p></dialog>';
      var d=host.firstElementChild, result=null;d.showModal();d.addEventListener('close',function(){host.innerHTML='';});
      d.querySelectorAll('[data-calc-expression],[data-calc-base],[data-calc-taux],[data-calc-quantite]').forEach(function(input){input.oninput=function(){result=null;d.querySelector('[data-calc-result]').textContent='—';};});
      d.querySelectorAll('[data-calc-close]').forEach(function(el){el.onclick=function(){d.close();};});
      d.querySelector('[data-calc-compute]').onclick=function(){try{result=Number(applyFormula(d.querySelector('[data-calc-expression]').value,{base:d.querySelector('[data-calc-base]').value,taux:d.querySelector('[data-calc-taux]').value,quantite:d.querySelector('[data-calc-quantite]').value},tools).toFixed(6));d.querySelector('[data-calc-result]').textContent=String(result);}catch(e){result=null;d.querySelector('[data-calc-result]').textContent='Erreur';showError(e);}};
      d.querySelector('[data-calc-rule]').onchange=function(){var rule=data.rules.find(function(r){return r.id===d.querySelector('[data-calc-rule]').value;});d.querySelector('[data-calc-name]').value=rule ? rule.label : '';d.querySelector('[data-calc-expression]').value=rule ? rule.expression : '';result=null;d.querySelector('[data-calc-result]').textContent='—';};
      d.querySelector('[data-calc-save]').onclick=function(){try{validEmployee();if(!canEdit())throw new Error('Modification non autorisée.');var name=d.querySelector('[data-calc-name]').value.trim(),expression=d.querySelector('[data-calc-expression]').value.trim();if(!name || name.length>80 || !expression)throw new Error('Renseignez le nom et l’expression de la règle.');applyFormula(expression,{base:'1',taux:'1',quantite:'1'},tools);var latest=load(dossierId), id=d.querySelector('[data-calc-rule]').value;var existing=latest.rules.find(function(r){return r.id===id;});if(latest.rules.some(function(r){return r.id!==id && r.label.toLocaleLowerCase()===name.toLocaleLowerCase();}))throw new Error('Ce nom de règle existe déjà.');if(!existing){existing={id:makeId()};latest.rules.push(existing);}existing.label=name;existing.expression=expression;save(dossierId,latest);data=latest;var select=d.querySelector('[data-calc-rule]');select.innerHTML='<option value="">Aucune</option>'+data.rules.map(function(r){return '<option value="'+escape(r.id)+'">'+escape(r.label)+'</option>';}).join('');select.value=existing.id;root.alert('Règle fictive enregistrée ; elle ne s’applique pas automatiquement.');}catch(e){showError(e);}};
      d.querySelector('[data-calc-delete]').onclick=function(){try{validEmployee();if(!canDelete())throw new Error('Suppression non autorisée.');var id=d.querySelector('[data-calc-rule]').value;if(!id)throw new Error('Choisissez une règle enregistrée.');if(!root.confirm('Supprimer cette règle ? Les bulletins déjà saisis restent inchangés.'))return;var latest=load(dossierId);latest.rules=latest.rules.filter(function(r){return r.id!==id;});save(dossierId,latest);data=latest;var select=d.querySelector('[data-calc-rule]');select.innerHTML='<option value="">Aucune</option>'+data.rules.map(function(r){return '<option value="'+escape(r.id)+'">'+escape(r.label)+'</option>';}).join('');d.querySelector('[data-calc-name]').value='';d.querySelector('[data-calc-expression]').value='';result=null;d.querySelector('[data-calc-result]').textContent='—';}catch(e){showError(e);}};
      d.querySelector('[data-calc-transfer]').onclick=function(){try{validEmployee();if(!canEdit() || state.mode==='view') throw new Error('Modification non autorisée.');var target=d.querySelector('[data-calc-target]').value;if(result===null || target==='') throw new Error('Calculez un résultat et choisissez une rubrique.');var input=targets[Number(target)];if(!input || !input.isConnected) throw new Error('Rubrique indisponible.');input.value=tools.numbers(String(result));d.close();}catch(e){showError(e);}};
    }
    function printSlip() {
      validEmployee(); var employee=currentEmployee(), slip=selectedSlip(); if(!slip) throw new Error('Sélectionnez un bulletin.');
      var rows=selection(employee).rows, amounts=slip.amounts||{};
      var printable=rows.filter(function(r){return amounts[r.id] !== undefined && amounts[r.id] !== '';}).map(function(r){return '<tr><td>'+escape(r.label)+(r.retained?'':' (non cochée)')+'</td><td>'+escape(amounts[r.id])+'</td></tr>';}).join('');
      var output=root.open('','_blank'); if(!output) throw new Error('L’ouverture de l’aperçu a été bloquée par le navigateur.');
      output.opener=null;output.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Bulletin complémentaire fictif</title><style>body{font:15px sans-serif;margin:2rem;color:#222}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:.5rem;text-align:left}@media print{button{display:none}}</style></head><body><h1>Bulletin complémentaire — Brouillon fictif</h1><p>Employé : '+escape((employee.employeeNumber||employee.id)+' · '+employee.displayName)+'</p><p>Débauchage : '+escape(employee.terminationDate)+' · Bulletin : '+escape(slip.label)+' · Période : '+escape(slip.period)+'</p><table><thead><tr><th>Rubrique</th><th>Montant</th></tr></thead><tbody>'+printable+'</tbody></table><p>À payer · montant saisi : '+escape(slip.payable || 'Non renseigné')+'</p><p>Ce document est un brouillon fictif, sans calcul de paie ni paiement validé.</p><button type="button" onclick="window.print()">Imprimer</button></body></html>');output.document.close();
    }
    function bind() {
      var query=container.querySelector('[data-supp-query]');query.addEventListener('input',function(){var next=query.value,cursor=query.selectionStart;if(!guard()){query.value=state.query;return;}state.mode='view';state.query=next;render();var nextInput=container.querySelector('[data-supp-query]');nextInput.focus();if(cursor!==null)nextInput.setSelectionRange(cursor,cursor);});
      container.querySelectorAll('[data-supp-employee]').forEach(function(el){el.onclick=function(){if(el.dataset.suppEmployee===state.employeeId || !guard()) return;state.mode='view';state.employeeId=el.dataset.suppEmployee;state.slipId='';render();};});
      container.querySelectorAll('[data-supp-slip]').forEach(function(el){el.onclick=function(){if(el.dataset.suppSlip===state.slipId || !guard())return;state.mode='view';state.slipId=el.dataset.suppSlip;render();};});
      var form=container.querySelector('#supp-slip-form');form.onsubmit=function(e){e.preventDefault();try{saveForm(form);}catch(err){showError(err);}};
      container.querySelectorAll('[data-supp-action]').forEach(function(el){el.onclick=function(){try{var action=el.dataset.suppAction; if(action==='cancel'){if(!guard())return;state.mode='view';render();return;} validEmployee(); if(action==='add'){if(!canEdit())throw new Error('Modification non autorisée.');state.mode='create';render();} else if(action==='edit'){if(!canEdit() || !selectedSlip())throw new Error('Modification non autorisée ou bulletin introuvable.');state.mode='edit';render();} else if(action==='delete'){if(!canDelete() || !selectedSlip())throw new Error('Suppression non autorisée ou bulletin introuvable.');if(!root.confirm('Supprimer ce brouillon complémentaire fictif ?'))return;var latest=load(dossierId);latest.slips=latest.slips.filter(function(s){return !(s.id===state.slipId && s.employeeId===state.employeeId);});save(dossierId,latest);data=latest;state.slipId='';render();} else if(action==='calculate')calculator();else if(action==='print')printSlip();}catch(e){showError(e);}};});
    }
    function navigationGuard(event){if(state.mode==='view'||!container.isConnected||container.contains(event.target))return;if(event.target.closest && event.target.closest('a[href], button[data-action]') && !guard()){event.preventDefault();event.stopImmediatePropagation();}}
    function unloadGuard(event){if(state.mode!=='view'&&container.isConnected){event.preventDefault();event.returnValue='';}}
    root.document.addEventListener('click',navigationGuard,true);root.addEventListener('beforeunload',unloadGuard);
    var observer=new root.MutationObserver(function(){if(!container.isConnected){root.document.removeEventListener('click',navigationGuard,true);root.removeEventListener('beforeunload',unloadGuard);observer.disconnect();}});observer.observe(root.document.documentElement,{childList:true,subtree:true});
    render();
  }
  var api={mount:mount,isRecruitedElsewhere:isRecruitedElsewhere,applyFormula:applyFormula};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  root.PayrollSupplementaryPayslips=api;
})(typeof window!=='undefined'?window:globalThis);
