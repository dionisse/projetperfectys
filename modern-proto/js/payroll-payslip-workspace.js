/* Brouillons de bulletins fictifs : valeurs manuelles, jamais un calcul de paie final. */
(function (root) {
  'use strict';
  var PREFIX = 'perfecto.payroll.payslip-drafts.v1.';
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function key(id) { return PREFIX + encodeURIComponent(id); }
  function load(id) {
    var raw = root.localStorage.getItem(key(id));
    if (!raw) return { version: 1, drafts: {}, groups: [] };
    var data = JSON.parse(raw);
    if (!data || data.version !== 1 || !data.drafts || typeof data.drafts !== 'object' || Array.isArray(data.drafts) || !Array.isArray(data.groups)) throw new Error('Données de bulletins illisibles : aucune modification effectuée.');
    return data;
  }
  function save(id, data) { root.localStorage.setItem(key(id), JSON.stringify(data)); }
  function numbers(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return '';
    if (!/^-?\d{1,12}(?:[.,]\d{1,6})?$/.test(text)) throw new Error('Saisissez un nombre valide (12 chiffres entiers et 6 décimales au maximum).');
    return text.replace(',', '.');
  }
  // Grammaire limitée : nombres, parenthèses, + - * / et fonctions autorisées ; aucun code exécuté.
  function calculate(expression) {
    var text = String(expression || '').replace(/\s+/g, '');
    if (!text || text.length > 300) throw new Error('Expression vide ou trop longue.');
    var pos = 0, depth = 0;
    function finite(n) { if (!Number.isFinite(n) || Math.abs(n) > 1e15) throw new Error('Résultat hors limites ou opération invalide.'); return n; }
    function primary() {
      if (++depth > 30) throw new Error('Expression trop complexe.');
      var v, m;
      if (text[pos] === '(') { pos++; v = sum(); if (text[pos++] !== ')') throw new Error('Parenthèse manquante.'); }
      else if ((m = /^[A-Za-z]+/.exec(text.slice(pos)))) {
        pos += m[0].length;
        var name = m[0].toLowerCase();
        if (['puissance','racine','modulo'].indexOf(name) < 0 || text[pos++] !== '(') throw new Error('Fonction inconnue.');
        var a = sum(); if (text[pos++] !== ',') throw new Error('Deux arguments séparés par une virgule sont requis.');
        var b = sum(); if (text[pos++] !== ')') throw new Error('Parenthèse manquante.');
        if (name === 'puissance') v = Math.pow(a,b);
        else if (name === 'modulo') { if (b === 0) throw new Error('Division par zéro.'); v = a % b; }
        else { if (b === 0 || (a < 0 && (!Number.isInteger(b) || Math.abs(b % 2) !== 1))) throw new Error('Racine impossible.'); v = a < 0 ? -Math.pow(-a, 1/b) : Math.pow(a, 1/b); }
      } else {
        m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(pos));
        if (!m) throw new Error('Expression invalide.');
        pos += m[0].length; v = Number(m[0]);
      }
      depth--; return finite(v);
    }
    function unary() { if (text[pos] === '+') { pos++; return unary(); } if (text[pos] === '-') { pos++; return finite(-unary()); } return primary(); }
    function product() { var n = unary(); while (text[pos] === '*' || text[pos] === '/') { var op = text[pos++], b = unary(); if (op === '/' && b === 0) throw new Error('Division par zéro.'); n = finite(op === '*' ? n*b : n/b); } return n; }
    function sum() { var n = product(); while (text[pos] === '+' || text[pos] === '-') { var op = text[pos++], b = product(); n = finite(op === '+' ? n+b : n-b); } return n; }
    var result = sum(); if (pos !== text.length) throw new Error('Expression invalide.'); return finite(result);
  }
  function monthList(dossier) {
    var start = String(dossier.cycleStart || '').slice(0,7), end = String(dossier.cycleEnd || '').slice(0,7), out = [];
    if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return out;
    var y = +start.slice(0,4), m = +start.slice(5,7);
    for (var i=0; i<120 && y+'-'+String(m).padStart(2,'0') <= end; i++) { out.push(y+'-'+String(m).padStart(2,'0')); if (++m > 12) { m=1; y++; } }
    return out;
  }
  function searchText(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
  }
  function matchesEmployee(employee, query) {
    var terms = searchText(query).trim().split(/\s+/).filter(Boolean);
    var searchable = searchText([employee.employeeNumber || employee.id || '', employee.displayName || '', employee.lastName || '', employee.firstName || ''].join(' '));
    return terms.every(function(term) { return searchable.indexOf(term) !== -1; });
  }
  // Les cases du statut font foi, y compris une sélection volontairement vide.
  // Sans statut identifié, on montre seulement le modèle commun, sans attribuer de statut.
  function resolveRubrics(employee, statuses, catalog) {
    var status = employee && statuses.find(function(s) { return s && s.id === employee.employeeStatus; });
    var ids = status && Array.isArray(status.rubricIds) ? status.rubricIds : null;
    return {
      status: status || null,
      isDefaultPreview: !status,
      rows: catalog.filter(function(r) { return status ? !!ids && ids.indexOf(r.id) >= 0 : r.selectedByReference === true; })
    };
  }
  function mount(container, options) {
    if (!container || !options || !options.hr) return;
    var hr = options.hr, dossier = options.dossier, dossierId = dossier.id;
    var state = { filter: '', filterId: '', group: '', sort:'number', query:'', selected:'', period:monthList(dossier)[0] || '', includeTerminated:false, editing:false };
    var data;
    try { data = load(dossierId); } catch(e) { container.textContent = e.message; return; }
    function canEdit() { return hr.isDemoTestDossier(dossierId) && options.canEdit() && hr.currentDossier() && hr.currentDossier().id === dossierId; }
    function allEmployees() { return hr.employees(dossierId); }
    function statuses() { return hr.employeeStatuses(dossierId); }
    function groupById(id) { return data.groups.find(function(g) { return g.id === id; }); }
    function rubricSelection(employee) { return resolveRubrics(employee, statuses(), hr.employeeRubricCatalog()); }
    function rubrics(employee) { return rubricSelection(employee).rows; }
    function draft(employeeId) { return (data.drafts[state.period] || {})[employeeId] || {}; }
    function value(record, r, field) { return record[r] && record[r][field] != null ? record[r][field] : ''; }
    function refLabel(items, id, fallback) { var found = items.find(function(item) { return item.id === id; }); return found ? (found.code ? found.code + ' · ' : '') + (found.label || found.ohadaClassification || '') : (fallback || id || '—'); }
    function guard() { if (!state.editing) return true; return root.confirm('Abandonner les modifications non enregistrées du bulletin ?'); }
    function selectOptions(items, selected) { return items.map(function(item) { return '<option value="'+escape(item.id)+'"'+(item.id === selected ? ' selected' : '')+'>'+escape((item.code ? item.code+' · ' : '')+item.label)+'</option>'; }).join(''); }
    function render() {
      var employees = allEmployees(), cats = {status:statuses(), zone:hr.employeeGeographicZones(dossierId), service:hr.employeeServices(dossierId)};
      var list = employees.filter(function(e) { var cutoff = state.period + '-31'; var left = !!(e.terminationDate && e.terminationDate <= cutoff && !(e.rehireDate && e.rehireDate > e.terminationDate && e.rehireDate <= cutoff)); if (left && !state.includeTerminated) return false; var field = {status:'employeeStatus',zone:'geographicZoneId',service:'serviceId'}[state.filter]; var g = groupById(state.group); return (!field || !state.filterId || e[field] === state.filterId) && (!state.group || (g && g.employeeIds.indexOf(e.id) >= 0)) && matchesEmployee(e, state.query); });
      list.sort(function(a,b) { return String(state.sort === 'name' ? a.displayName || '' : a.employeeNumber || a.id).localeCompare(String(state.sort === 'name' ? b.displayName || '' : b.employeeNumber || b.id), 'fr', {numeric:true, sensitivity:'base'}); });
      if (!list.some(function(e) { return e.id === state.selected; })) state.selected = list[0] && list[0].id || '';
      var selected = list.find(function(e) { return e.id === state.selected; }), selection = rubricSelection(selected), rows = selection.rows, record = selected ? draft(selected.id) : {};
      var hiddenSaved = Object.keys(record).filter(function(id) { return !rows.some(function(r) { return r.id === id; }); }).length;
      var edit = state.editing && canEdit();
      var valuesTable = rows.map(function(r) { return '<tr class="'+(r.heading ? 'payroll-slip-rubric-heading' : '')+'"><th scope="row"'+(r.level ? ' class="payroll-slip-rubric-child"' : '')+'>'+escape(r.label)+'</th>'+['base','qty','amount'].map(function(field) { var val=value(record,r.id,field); return '<td>'+(edit ? '<input type="text" inputmode="decimal" maxlength="20" data-rubric="'+escape(r.id)+'" data-field="'+field+'" aria-label="'+escape(r.label+' · '+({base:'Base',qty:'Quantité',amount:'Montant'}[field]))+'" value="'+escape(val)+'">' : (val === '' ? '—' : escape(val)))+'</td>'; }).join('')+'</tr>'; }).join('');
      var details = selected ? [['Embauche',selected.firstHireDate],['Débauchage',selected.terminationDate],['Situation matrimoniale',selected.maritalStatus],['Enfants',selected.childrenCount],['Statut',refLabel(cats.status,selected.employeeStatus)],['Catégorie / échelon',refLabel(hr.employeeCategories(dossierId),selected.categoryId,selected.categoryStep)],['Date d’effet',selected.effectiveDate],['Zone',refLabel(cats.zone,selected.geographicZoneId,selected.zone)],['Service',refLabel(cats.service,selected.serviceId,selected.service)],['Fonction',selected.function]].map(function(x) { return '<div><dt>'+escape(x[0])+'</dt><dd>'+escape(x[1] == null || x[1] === '' ? '—' : x[1])+'</dd></div>'; }).join('') : '';
      container.innerHTML = '<div class="payroll-slip"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · SALAIRES</p><h3>Bulletins de salaire</h3></div><span class="badge draft">BROUILLON TEST</span></div><div class="alert warning"><div>Données fictives uniquement. Les valeurs sont saisies manuellement : aucun calcul de paie, bulletin final, paiement ou écriture comptable n’est produit.</div></div><div class="payroll-slip-layout"><aside><div class="payroll-slip-filters"><label>Filtre<select data-slip="filter"><option value="">Aucun</option><option value="status"'+(state.filter==='status'?' selected':'')+'>Statut</option><option value="zone"'+(state.filter==='zone'?' selected':'')+'>Zone</option><option value="service"'+(state.filter==='service'?' selected':'')+'>Service</option></select></label>'+(state.filter ? '<label>Valeur<select data-slip="filterId"><option value="">Toutes</option>'+selectOptions(cats[state.filter],state.filterId)+'</select></label>' : '')+'<label>Groupe<select data-slip="group"><option value="">Tous les groupes</option>'+selectOptions(data.groups,state.group)+'</select></label><label>Classement<select data-slip="sort"><option value="number">Matricule</option><option value="name"'+(state.sort==='name'?' selected':'')+'>Nom</option></select></label><label>Rechercher un employé<input type="search" data-slip="query" value="'+escape(state.query)+'" placeholder="Matricule, nom ou prénoms" autocomplete="off"></label></div><p class="payroll-slip-search-count" aria-live="polite">'+list.length+' employé(s) affiché(s) · recherche et filtres appliqués</p><div class="payroll-slip-scroll"><table><thead><tr><th>Matricule</th><th>Nom</th></tr></thead><tbody>'+list.map(function(e) { return '<tr><td colspan="2"><button type="button" data-slip-employee="'+escape(e.id)+'"'+(e.id===state.selected?' aria-current="true"':'')+'><span>'+escape(e.employeeNumber || e.id)+'</span><span>'+escape(e.displayName || '')+'</span></button></td></tr>'; }).join('')+'</tbody></table>'+(list.length ? '' : '<p>Aucun employé correspondant.</p>')+'</div><label class="payroll-slip-checkbox"><input type="checkbox" data-slip="includeTerminated"'+(state.includeTerminated?' checked':'')+'> Afficher les employés débauchés</label><dl class="payroll-slip-details">'+details+'</dl></aside><div class="payroll-slip-main"><div class="payroll-slip-top"><label>Bulletins <select data-slip="period">'+monthList(dossier).map(function(p) { return '<option value="'+p+'"'+(p===state.period?' selected':'')+'>'+escape(p)+'</option>'; }).join('')+'</select></label><strong>'+escape(selected ? selected.displayName : 'Sélectionnez un employé')+'</strong></div>'+(selection.isDefaultPreview ? '<p class="payroll-slip-source alert info"><strong>Rubriques cochées par défaut ('+rows.length+').</strong> '+(selected ? 'Aucun statut de cet employé n’est reconnu dans le référentiel. Ce modèle indicatif peut être saisi en brouillon ; choisissez un statut dans sa fiche pour afficher ses rubriques propres. Les applications de groupe exigent un statut reconnu.' : 'Sélectionnez un employé pour afficher les rubriques de son statut.')+'</p>' : '<p class="payroll-slip-source">Rubriques cochées pour le statut '+escape(selection.status.code+' · '+selection.status.label)+' : '+rows.length+'.</p>')+(selected && !selection.isDefaultPreview && !rows.length ? '<p>Aucune rubrique cochée pour ce statut. Vérifiez Définitions → Statuts → Rubriques.</p>' : '')+(hiddenSaved ? '<p class="alert warning">'+hiddenSaved+' rubrique(s) enregistrée(s) ne figurent plus dans le statut actuel. Les valeurs restent conservées.</p>' : '')+'<div class="payroll-slip-scroll payroll-slip-rubrics"><table><thead><tr><th>Rubrique</th><th>Base</th><th>Qté</th><th>Montant</th></tr></thead><tbody>'+valuesTable+'</tbody></table></div><div class="payroll-slip-actions"><button type="button" class="btn btn-secondary" data-slip-action="calculator">Calculatrice…</button>'+(edit ? '<button type="button" class="btn btn-secondary" data-slip-action="cancel">Annuler</button><button type="button" class="btn btn-primary" data-slip-action="save">Enregistrer le brouillon</button>' : '<button type="button" class="btn btn-primary" data-slip-action="edit"'+(!canEdit() || !selected || !rows.length || !state.period ? ' disabled':'')+'>Modifier</button>')+'<button type="button" class="btn btn-secondary" data-slip-action="groups"'+(!canEdit()?' disabled':'')+'>Gérer les groupes</button><button type="button" class="btn btn-secondary" data-slip-action="close">Fermer</button></div><p class="small muted">Les rubriques cochées du statut s’affichent automatiquement. Les valeurs manuelles ne déclenchent aucune formule automatique.</p></div></div><div data-slip-dialog></div></div>';
      bind();
    }
    function redrawField(el) {
      var name=el.dataset.slip, old=state[name], next=el.type === 'checkbox' ? el.checked : el.value;
      var cursor = name === 'query' ? el.selectionStart : null;
      if (old === next) return;
      if (!guard()) { if(el.type === 'checkbox') el.checked=old; else el.value=old; return; }
      state.editing=false; state[name]=next; if(name==='filter') state.filterId=''; render();
      if (name === 'query') { var search=container.querySelector('[data-slip="query"]'); if (search) { search.focus(); if (cursor !== null) search.setSelectionRange(cursor, cursor); } }
    }
    function readDraft() { var rec=copy(draft(state.selected)); container.querySelectorAll('[data-rubric][data-field]').forEach(function(el) { var id=el.dataset.rubric, field=el.dataset.field; if (!rec[id]) rec[id]={}; rec[id][field]=numbers(el.value); }); return rec; }
    function commit(rec) { if (!canEdit()) throw new Error('Modification non autorisée ou dossier actif modifié.'); if (monthList(dossier).indexOf(state.period) < 0 || !allEmployees().some(function(e) { return e.id === state.selected; })) throw new Error('Employé ou période indisponible.'); var latest=load(dossierId); latest.drafts[state.period]=latest.drafts[state.period] || {}; latest.drafts[state.period][state.selected]=rec; save(dossierId,latest); data=latest; }
    function showError(e) { root.alert(e.message || String(e)); }
    function dialog(html) { var host=container.querySelector('[data-slip-dialog]'); host.innerHTML='<dialog class="payroll-employee-dialog payroll-slip-dialog">'+html+'</dialog>'; var d=host.firstElementChild; d.showModal(); d.addEventListener('close',function(){host.innerHTML='';}); return d; }
    function calculator() {
      var lines=[{op:'+',expr:''}], result=null, target='';
      function paint() { var html='<div class="payroll-employee-dialog-head"><h3>Calculatrice</h3><button type="button" data-calc="close" aria-label="Fermer">×</button></div><p class="small muted">Utilisez le point pour les décimales ; +, −, *, / et les parenthèses. Les arguments des fonctions sont séparés par une virgule.</p><table class="payroll-calc-table"><thead><tr><th>Op.</th><th>Expression</th><th>Résultat partiel</th><th></th></tr></thead><tbody>'+lines.map(function(l,i) { return '<tr><td><select data-op="'+i+'"><option'+(l.op==='+'?' selected':'')+'>+</option><option'+(l.op==='-'?' selected':'')+'>-</option></select></td><td><input data-expr="'+i+'" aria-label="Expression '+(i+1)+'" value="'+escape(l.expr)+'"></td><td data-part="'+i+'">—</td><td><button type="button" data-delete="'+i+'" aria-label="Supprimer la ligne '+(i+1)+'">×</button></td></tr>'; }).join('')+'</tbody></table><p><strong>Résultat général : <span data-total>—</span></strong></p><div class="payroll-slip-actions"><button type="button" data-calc="add">Insérer</button><button type="button" data-calc="reset">Remise à zéro</button><button type="button" data-calc="functions">Fonctions…</button><button type="button" data-calc="compute">Calculer</button></div>';
        if (state.editing) { var inputs=Array.from(container.querySelectorAll('[data-rubric][data-field]')); html+='<label>Reporter dans <select data-calc-target><option value="">Choisir une cellule</option>'+inputs.map(function(el,i) { return '<option value="'+i+'"'+(target===String(i)?' selected':'')+'>'+escape(el.getAttribute('aria-label'))+'</option>'; }).join('')+'</select></label><button type="button" data-calc="transfer">Reporter le résultat</button>'; }
        var d=container.querySelector('.payroll-slip-dialog'); if(!d) d=dialog(html); else d.innerHTML=html;
        d.querySelectorAll('[data-expr]').forEach(function(el){el.oninput=function(){lines[+el.dataset.expr].expr=el.value; result=null; d.querySelector('[data-total]').textContent='—'; d.querySelectorAll('[data-part]').forEach(function(part){part.textContent='—';});};});
        d.querySelectorAll('[data-op]').forEach(function(el){el.onchange=function(){lines[+el.dataset.op].op=el.value; result=null; d.querySelector('[data-total]').textContent='—'; d.querySelectorAll('[data-part]').forEach(function(part){part.textContent='—';});};});
        d.querySelectorAll('[data-delete]').forEach(function(el){el.onclick=function(){lines.splice(+el.dataset.delete,1); if(!lines.length) lines.push({op:'+',expr:''}); result=null; paint();};});
        var targetEl=d.querySelector('[data-calc-target]'); if(targetEl) targetEl.onchange=function(){target=targetEl.value;};
        d.querySelectorAll('[data-calc]').forEach(function(el){el.onclick=function(){ var act=el.dataset.calc; if(act==='close') d.close(); else if(act==='add'){lines.push({op:'+',expr:''});result=null;paint();} else if(act==='reset'){lines=[{op:'+',expr:''}];result=null;paint();} else if(act==='functions') root.alert('Fonctions de calcul\nPuissance(nombre, exposant)\nRacine(nombre, ordre)\nModulo(nombre, diviseur)'); else if(act==='compute'){ try {if(!lines.some(function(l){return l.expr.trim();})) throw new Error('Saisissez au moins une expression.'); var total=0;lines.forEach(function(l,i){var part=l.expr.trim() ? calculate(l.expr) : 0; d.querySelector('[data-part="'+i+'"]').textContent=l.expr.trim()?String(part):'—'; total+=(l.op==='-'?-1:1)*part;}); if(!Number.isFinite(total)||Math.abs(total)>1e15) throw new Error('Résultat hors limites.'); result=Number(total.toFixed(6)); d.querySelector('[data-total]').textContent=String(result);}catch(e){result=null;d.querySelector('[data-total]').textContent='Erreur';showError(e);} } else if(act==='transfer'){try {if(result===null) throw new Error('Calculez un résultat valide avant le report.'); if(target==='') throw new Error('Choisissez une cellule.'); if(!canEdit()) throw new Error('Modification non autorisée.'); var input=container.querySelectorAll('[data-rubric][data-field]')[+target]; if(!input) throw new Error('Cellule introuvable.'); input.value=numbers(String(result)); d.close();}catch(e){showError(e);} } };});
      } paint();
    }
    function groups() {
      var chosen = state.group && groupById(state.group) ? state.group : '', all = allEmployees();
      function paint() {
        var g=groupById(chosen), html='<div class="payroll-employee-dialog-head"><h3>Groupes de paie fictifs</h3><button type="button" data-group-action="close" aria-label="Fermer">×</button></div><p>Les groupes peuvent se recouper. Ils servent à regrouper des valeurs communes (brut, primes, heures…) sans créer de formule automatique.</p><label>Groupe <select data-group-choice><option value="">Nouveau groupe</option>'+selectOptions(data.groups,chosen)+'</select></label><form data-group-form><label>Nom du groupe <input name="label" maxlength="80" required value="'+escape(g ? g.label : '')+'"></label><fieldset><legend>Employés du groupe</legend><div class="payroll-slip-members">'+all.map(function(e){return '<label><input type="checkbox" name="member" value="'+escape(e.id)+'"'+(g && g.employeeIds.indexOf(e.id)>=0?' checked':'')+'> '+escape((e.employeeNumber || e.id)+' · '+e.displayName)+'</label>';}).join('')+'</div></fieldset><button type="submit">Enregistrer le groupe</button>'+(g ? ' <button type="button" data-group-action="delete">Supprimer le groupe</button>' : '')+'</form>';
        if(g) html+='<hr><h4>Appliquer une valeur commune</h4><p>Cette opération remplace uniquement la cellule choisie, pour les membres dont le statut contient la rubrique. Aucun autre champ n’est modifié.</p><form data-bulk-form><label>Rubrique <select name="rubric" required><option value="">Choisir une rubrique</option>'+selectOptions(hr.employeeRubricCatalog(), '')+'</select></label><label>Cellule <select name="field"><option value="base">Base</option><option value="qty">Quantité</option><option value="amount">Montant</option></select></label><label>Valeur commune <input name="value" inputmode="decimal" required></label><button type="button" data-group-action="save-rule">Enregistrer cette valeur commune</button><button type="submit">Appliquer au groupe pour '+escape(state.period)+'</button></form><h4>Valeurs communes enregistrées</h4><div class="payroll-slip-rules">'+(Array.isArray(g.rules) && g.rules.length ? g.rules.map(function(rule,i){var rubric=hr.employeeRubricCatalog().find(function(r){return r.id===rule.rubricId;});return '<p>'+escape((rubric ? rubric.label : rule.rubricId)+' · '+rule.field+' = '+rule.value)+' <button type="button" data-rule-load="'+i+'">Utiliser</button> <button type="button" data-rule-delete="'+i+'">Supprimer</button></p>';}).join('') : '<p>Aucune valeur commune enregistrée.</p>')+'</div>';
        var d=container.querySelector('.payroll-slip-dialog'); if(!d) d=dialog(html); else d.innerHTML=html;
        d.querySelector('[data-group-choice]').onchange=function(e){chosen=e.target.value;paint();};
        d.querySelector('[data-group-action="close"]').onclick=function(){d.close();render();};
        var del=d.querySelector('[data-group-action="delete"]'); if(del) del.onclick=function(){try{if(!canEdit()) throw new Error('Modification non autorisée.'); if(!root.confirm('Supprimer ce groupe ? Les bulletins restent inchangés.')) return; var latest=load(dossierId); latest.groups=latest.groups.filter(function(x){return x.id!==chosen;}); save(dossierId,latest);data=latest;if(state.group===chosen) state.group='';chosen='';paint();}catch(e){showError(e);}};
        d.querySelector('[data-group-form]').onsubmit=function(ev){ev.preventDefault();try{if(!canEdit()) throw new Error('Modification non autorisée.'); var f=ev.currentTarget,label=f.elements.label.value.trim(); if(!label) throw new Error('Le nom du groupe est obligatoire.'); var ids=Array.from(f.querySelectorAll('[name="member"]:checked')).map(function(el){return el.value;}); if(!ids.length) throw new Error('Sélectionnez au moins un employé.'); var latest=load(dossierId); if(latest.groups.some(function(x){return x.id!==chosen && x.label.toLocaleLowerCase()===label.toLocaleLowerCase();})) throw new Error('Ce nom de groupe existe déjà.'); var item=latest.groups.find(function(x){return x.id===chosen;}); if(!item){item={id:'group-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10)};latest.groups.push(item);} item.label=label;item.employeeIds=ids;save(dossierId,latest);data=latest;chosen=item.id;state.group=chosen;paint();}catch(e){showError(e);}};
        var bulk=d.querySelector('[data-bulk-form]');
        if(bulk) {
          d.querySelector('[data-group-action="save-rule"]').onclick=function(){try{if(!canEdit()) throw new Error('Modification non autorisée.'); var id=bulk.elements.rubric.value, field=bulk.elements.field.value, val=numbers(bulk.elements.value.value); if(!id || !val) throw new Error('Choisissez une rubrique et une valeur.'); var latest=load(dossierId), group=latest.groups.find(function(x){return x.id===chosen;}); if(!group) throw new Error('Groupe introuvable.');group.rules=Array.isArray(group.rules)?group.rules:[];group.rules=group.rules.filter(function(r){return r.rubricId!==id || r.field!==field;});group.rules.push({rubricId:id,field:field,value:val});save(dossierId,latest);data=latest;paint();}catch(e){showError(e);}};
          d.querySelectorAll('[data-rule-load]').forEach(function(btn){btn.onclick=function(){var rule=g.rules[+btn.dataset.ruleLoad];bulk.elements.rubric.value=rule.rubricId;bulk.elements.field.value=rule.field;bulk.elements.value.value=rule.value;};});
          d.querySelectorAll('[data-rule-delete]').forEach(function(btn){btn.onclick=function(){try{if(!canEdit()) throw new Error('Modification non autorisée.'); if(!root.confirm('Supprimer cette valeur commune ? Les bulletins restent inchangés.')) return;var latest=load(dossierId), group=latest.groups.find(function(x){return x.id===chosen;}); if(!group || !Array.isArray(group.rules)) throw new Error('Groupe introuvable.');group.rules.splice(+btn.dataset.ruleDelete,1);save(dossierId,latest);data=latest;paint();}catch(e){showError(e);}};});
        }
        if(bulk) bulk.onsubmit=function(ev){ev.preventDefault();try{if(!canEdit()) throw new Error('Modification non autorisée.'); if(monthList(dossier).indexOf(state.period)<0) throw new Error('Période indisponible.'); var f=ev.currentTarget, id=f.elements.rubric.value, field=f.elements.field.value, val=numbers(f.elements.value.value); if(val==='') throw new Error('Saisissez une valeur.'); var members=allEmployees().filter(function(e){return g.employeeIds.indexOf(e.id)>=0;}); var eligible=members.filter(function(e){var selection=rubricSelection(e); return !selection.isDefaultPreview && selection.rows.some(function(r){return r.id===id;});}); var skipped=members.filter(function(e){return eligible.indexOf(e)<0;}); if(!eligible.length) throw new Error('Aucun membre ne possède cette rubrique dans son statut.'); var names=eligible.map(function(e){return (e.employeeNumber||e.id)+' · '+e.displayName;}).join('\n'); var excluded=skipped.map(function(e){return (e.employeeNumber||e.id)+' · '+e.displayName;}).join('\n'); var selectedRubric = hr.employeeRubricCatalog().find(function(r){return r.id===id;}); if(!selectedRubric || ['base','qty','amount'].indexOf(field)<0) throw new Error('Rubrique ou cellule invalide.'); if(!root.confirm('Appliquer '+selectedRubric.label+' · '+({base:'Base',qty:'Quantité',amount:'Montant'}[field])+' = '+val+' pour '+eligible.length+' employé(s) en '+state.period+' ?\n'+names+(skipped.length?'\n\nNon concernés (statut absent ou rubrique non cochée) :\n'+excluded:'')+'\n\nLes valeurs précédentes de cette cellule seront remplacées.')) return; var latest=load(dossierId);latest.drafts[state.period]=latest.drafts[state.period]||{};eligible.forEach(function(e){var rec=latest.drafts[state.period][e.id] || {};rec[id]=rec[id] || {};rec[id][field]=val;latest.drafts[state.period][e.id]=rec;}); save(dossierId,latest);data=latest;root.alert('Valeur appliquée à '+eligible.length+' brouillon(s) fictif(s), sans calcul automatique.');d.close();render();}catch(e){showError(e);}};
      } paint();
    }
    function bind() {
      container.querySelectorAll('[data-slip]').forEach(function(el){el.addEventListener(el.dataset.slip==='query'?'input':'change',function(){redrawField(el);});});
      container.querySelectorAll('[data-slip-employee]').forEach(function(el){el.onclick=function(){if(el.dataset.slipEmployee===state.selected || !guard()) return; state.editing=false;state.selected=el.dataset.slipEmployee;render();};});
      container.querySelectorAll('[data-slip-action]').forEach(function(el){el.onclick=function(){var action=el.dataset.slipAction; try { if(action==='edit'){if(!canEdit()) throw new Error('Modification non autorisée.');state.editing=true;render();} else if(action==='cancel'){if(!guard())return;state.editing=false;render();} else if(action==='save'){commit(readDraft());state.editing=false;render();} else if(action==='calculator') calculator(); else if(action==='groups'){if(!guard())return;state.editing=false;groups();} else if(action==='close'){if(!guard()) return;state.editing=false;if(options.onClose) options.onClose();} } catch(e){showError(e);} };});
    }
    // Protéger les brouillons avant de quitter par la navigation de l'application.
    function navigationGuard(event) {
      if (!state.editing || !container.isConnected || container.contains(event.target)) return;
      if (event.target.closest && event.target.closest('a[href], button[data-action]') && !guard()) { event.preventDefault(); event.stopImmediatePropagation(); }
    }
    function unloadGuard(event) { if (state.editing && container.isConnected) { event.preventDefault(); event.returnValue=''; } }
    root.document.addEventListener('click', navigationGuard, true);
    root.addEventListener('beforeunload', unloadGuard);
    var observer = new root.MutationObserver(function() { if (!container.isConnected) { root.document.removeEventListener('click', navigationGuard, true); root.removeEventListener('beforeunload', unloadGuard); observer.disconnect(); } });
    observer.observe(root.document.documentElement, {childList:true, subtree:true});
    render();
  }
  var api={mount:mount,calculate:calculate,numbers:numbers,monthList:monthList,matchesEmployee:matchesEmployee,resolveRubrics:resolveRubrics};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  root.PayrollPayslipWorkspace=api;
})(typeof window !== 'undefined' ? window : globalThis);
