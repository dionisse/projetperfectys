/* Référentiel fictif des natures d'avances et de prêts, sans opération de paie. */
(function (root) {
  'use strict';
  var PREFIX = 'perfecto.payroll.loan-natures.v1.';
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function normalize(input) {
    var code = String(input.code || '').trim(), label = String(input.label || '').trim().replace(/\s+/g, ' ');
    if (!code || !label) throw new Error('Le code et l’intitulé sont obligatoires.');
    if (code.length > 24 || label.length > 100) throw new Error('Le code est limité à 24 caractères et l’intitulé à 100 caractères.');
    return { code: code, label: label };
  }
  function parse(raw) {
    if (raw === null) return [];
    var data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('Référentiel illisible : aucune modification effectuée.'); }
    if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error('Référentiel illisible : aucune modification effectuée.');
    var ids = new Set(), codes = new Set();
    data.items.forEach(function (item) {
      if (!item || typeof item.id !== 'string' || !item.id || typeof item.code !== 'string' || typeof item.label !== 'string') throw new Error('Référentiel illisible : aucune modification effectuée.');
      var n = normalize(item), key = n.code.toLocaleLowerCase();
      if (ids.has(item.id) || codes.has(key)) throw new Error('Référentiel incohérent : aucune modification effectuée.');
      ids.add(item.id); codes.add(key);
    });
    return data.items;
  }
  function unique(items, code, id) { return !items.some(function (item) { return item.id !== id && item.code.toLocaleLowerCase() === code.toLocaleLowerCase(); }); }
  function mount(container, options) {
    var hr = options.hr, id = options.dossier.id, key = PREFIX + encodeURIComponent(id), raw, items;
    var state = { selected: '', mode: 'view' };
    try { raw = root.localStorage.getItem(key); items = parse(raw); } catch (e) { container.textContent = e.message; return; }
    function permitted(action) { var active = hr.currentDossier(); return !!(active && active.id === id && hr.isDemoTestDossier(id) && options[action] && options[action]()); }
    function current() { return items.find(function (item) { return item.id === state.selected; }) || null; }
    function guard() { return state.mode === 'view' || root.confirm('Abandonner les modifications non enregistrées ?'); }
    function fail(e) { root.alert(e.message || String(e)); }
    function persist(next, action) {
      if (!permitted(action)) throw new Error('Action non autorisée ou dossier actif modifié.');
      var latest = root.localStorage.getItem(key);
      if (latest !== raw) throw new Error('Le référentiel a changé ailleurs. Rechargez la page avant de réessayer ; aucune modification n’a été écrasée.');
      var nextRaw = JSON.stringify({ version: 1, items: next });
      root.localStorage.setItem(key, nextRaw); raw = nextRaw; items = next;
    }
    function render() {
      if (!items.some(function (x) { return x.id === state.selected; })) state.selected = items[0] ? items[0].id : '';
      var selected = current(), edit = state.mode === 'edit', create = state.mode === 'create', replacing = state.mode === 'replace';
      var source = create ? {code:'',label:''} : selected;
      var rows = items.map(function (item) { return '<tr><td colspan="2"><button type="button" data-nature-select="'+esc(item.id)+'" aria-pressed="'+(item.id===state.selected)+'"><span>'+esc(item.code)+'</span><span>'+esc(item.label)+'</span></button></td></tr>'; }).join('');
      var disabled = state.mode !== 'view';
      var fields = source ? '<form data-nature-form><div class="loan-nature-fields"><label>Code<input name="code" maxlength="24" required value="'+esc(source.code)+'"'+(edit||create?'':' readonly')+'></label><label>Intitulé<input name="label" maxlength="100" required value="'+esc(source.label)+'"'+(edit||create?'':' readonly')+'></label></div>'+(edit||create?'<label class="loan-nature-confirm"><input type="checkbox" name="testOnly" required> Je confirme que cette nature est fictive et réservée au test.</label><div class="loan-nature-actions"><button type="submit" class="btn btn-primary">Valider</button><button type="button" class="btn btn-secondary" data-nature-action="cancel">Annuler</button></div>':'')+'</form>' : '<p class="muted">Aucune nature enregistrée. Insérez-en une ou chargez les exemples de la capture.</p>';
      var replaceForm = replacing && selected ? '<form data-nature-replace><h4>Remplacer une nature</h4><p>La nature sélectionnée sera supprimée au profit de la destination. Aucune opération ni aucun bulletin n’est actuellement lié à ce référentiel : aucun montant ou historique ne sera transféré.</p><label>Destination<select name="destination" required><option value="">— Choisir une nature —</option>'+items.filter(function(x){return x.id!==selected.id;}).map(function(x){return '<option value="'+esc(x.id)+'">'+esc(x.code+' · '+x.label)+'</option>';}).join('')+'</select></label><label class="loan-nature-confirm"><input type="checkbox" name="testOnly" required> Je confirme le remplacement de cette nature fictive.</label><div class="loan-nature-actions"><button class="btn btn-primary" type="submit">Confirmer le remplacement</button><button type="button" class="btn btn-secondary" data-nature-action="cancel">Annuler</button></div></form>' : '';
      var test = hr.isDemoTestDossier(id);
      container.innerHTML = '<section class="loan-nature-workspace"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · SALAIRES</p><h3>Natures des avances et prêts</h3></div><span class="badge draft">'+(test?'PRH-TEST-2026 · TEST':'DOSSIER NON TEST')+'</span></div><div class="alert warning"><div>Référentiel local pour données fictives uniquement. Les rubriques d’avances des bulletins existent déjà mais ne sont pas reliées à ces natures. Aucun prêt, retenue, remboursement ou calcul de paie n’est créé ici.</div></div><div class="loan-nature-toolbar"><button type="button" class="btn btn-secondary" data-nature-action="replace" '+(!disabled&&selected&&items.length>1&&permitted('canEdit')&&permitted('canDelete')?'':'disabled')+'>Remplacer</button><button type="button" class="btn btn-secondary" data-nature-action="print" '+(items.length?'':'disabled')+'>Imprimer</button></div><div class="loan-nature-layout"><div class="loan-nature-list"><table><thead><tr><th>Code</th><th>Intitulé</th></tr></thead><tbody>'+(rows||'<tr><td colspan="2">Aucune nature enregistrée.</td></tr>')+'</tbody></table></div><div class="loan-nature-side"><button type="button" class="btn btn-primary" data-nature-action="create" '+(!disabled&&permitted('canCreate')?'':'disabled')+'>Insérer</button><button type="button" class="btn btn-secondary" data-nature-action="edit" '+(!disabled&&selected&&permitted('canEdit')?'':'disabled')+'>Modifier</button><button type="button" class="btn btn-danger" data-nature-action="delete" '+(!disabled&&selected&&permitted('canDelete')?'':'disabled')+'>Supprimer</button>'+(test&&!items.length?'<button type="button" class="btn btn-secondary" data-nature-action="seed" '+(!disabled&&permitted('canCreate')?'':'disabled')+'>Charger les exemples</button>':'')+'</div></div><div class="loan-nature-detail">'+fields+replaceForm+'</div><p class="small muted">Enregistré dans ce navigateur, pour le dossier actif ; non synchronisé entre utilisateurs.</p></section>';
      bind();
    }
    function bind() {
      container.querySelectorAll('[data-nature-select]').forEach(function (button) { button.onclick = function () { if (button.dataset.natureSelect === state.selected || !guard()) return; state.mode='view'; state.selected=button.dataset.natureSelect; render(); }; });
      var form = container.querySelector('[data-nature-form]');
      if (form) form.onsubmit = function (event) { event.preventDefault(); try {
        var mode=state.mode, action=mode==='create'?'canCreate':'canEdit';
        if (mode!=='create' && mode!=='edit') return;
        if (!permitted(action) || !form.elements.testOnly.checked) throw new Error('Action non autorisée ou confirmation de test manquante.');
        var value=normalize({code:form.elements.code.value,label:form.elements.label.value}), selected=current();
        if (mode==='edit'&&!selected) throw new Error('Nature introuvable.');
        if (!unique(items,value.code,mode==='edit'?selected.id:'')) throw new Error('Ce code existe déjà dans le dossier.');
        var record={id:mode==='edit'?selected.id:'nature-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10),code:value.code,label:value.label};
        var next=mode==='edit'?items.map(function(x){return x.id===record.id?record:x;}):items.concat([record]);
        persist(next,action);state.selected=record.id;state.mode='view';render();
      } catch(e){fail(e);} };
      var replacement=container.querySelector('[data-nature-replace]');
      if (replacement) replacement.onsubmit=function(event){event.preventDefault();try{
        if (!permitted('canEdit') || !permitted('canDelete') || !replacement.elements.testOnly.checked) throw new Error('Action non autorisée ou confirmation de test manquante.');
        var selected=current(), destination=items.find(function(x){return x.id===replacement.elements.destination.value;});
        if (!selected||!destination||destination.id===selected.id) throw new Error('Choisissez une destination différente et existante.');
        if (!root.confirm('Supprimer « '+selected.code+' · '+selected.label+' » au profit de « '+destination.code+' · '+destination.label+' » ? Aucun bulletin ne sera modifié.')) return;
        persist(items.filter(function(x){return x.id!==selected.id;}),'canDelete');state.selected=destination.id;state.mode='view';render();
      }catch(e){fail(e);}};
      container.querySelectorAll('[data-nature-action]').forEach(function(button){button.onclick=function(){try{var action=button.dataset.natureAction, selected=current();
        if(action==='create'&&permitted('canCreate')){state.mode='create';render();}
        else if(action==='edit'&&selected&&permitted('canEdit')){state.mode='edit';render();}
        else if(action==='replace'&&selected&&items.length>1&&permitted('canEdit')&&permitted('canDelete')){state.mode='replace';render();}
        else if(action==='cancel'){if(guard()){state.mode='view';render();}}
        else if(action==='delete'&&selected&&permitted('canDelete')){if(root.confirm('Supprimer la nature fictive « '+selected.code+' · '+selected.label+' » ? Aucun bulletin ne sera modifié.')){persist(items.filter(function(x){return x.id!==selected.id;}),'canDelete');state.selected='';render();}}
        else if(action==='seed'&&!items.length&&permitted('canCreate')){if(root.confirm('Charger les deux exemples fictifs de la capture ?')){persist([{id:'example-01',code:'01',label:'Prêt 01'},{id:'example-02',code:'02',label:'Prêt 02'}],'canCreate');render();}}
        else if(action==='print'&&items.length){var win=root.open('','_blank');if(!win)throw new Error('L’aperçu a été bloqué par le navigateur.');win.opener=null;win.document.write('<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Natures des avances et prêts</title><style>body{font:15px sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:.5rem;text-align:left}@media print{button{display:none}}</style></head><body><h1>Natures des avances et prêts — test</h1><p>Dossier : '+esc(options.dossier.reference||id)+' · Référentiel fictif</p><table><thead><tr><th>Code</th><th>Intitulé</th></tr></thead><tbody>'+items.map(function(x){return '<tr><td>'+esc(x.code)+'</td><td>'+esc(x.label)+'</td></tr>';}).join('')+'</tbody></table><button type="button" onclick="window.print()">Imprimer</button></body></html>');win.document.close();}
      }catch(e){fail(e);}};});
    }
    function navigationGuard(event){if(state.mode==='view'||!container.isConnected||container.contains(event.target))return;if(event.target.closest&&event.target.closest('a[href], button[data-action]')&&!guard()){event.preventDefault();event.stopImmediatePropagation();}}
    function unloadGuard(event){if(state.mode!=='view'&&container.isConnected){event.preventDefault();event.returnValue='';}}
    root.document.addEventListener('click',navigationGuard,true);root.addEventListener('beforeunload',unloadGuard);
    var observer=new root.MutationObserver(function(){if(!container.isConnected){root.document.removeEventListener('click',navigationGuard,true);root.removeEventListener('beforeunload',unloadGuard);observer.disconnect();}});observer.observe(root.document.documentElement,{childList:true,subtree:true});
    render();
  }
  var api={mount:mount,normalize:normalize,parse:parse,unique:unique};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PayrollLoanNatures=api;
})(typeof window!=='undefined'?window:globalThis);
