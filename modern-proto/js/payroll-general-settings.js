/* Paramètres généraux du dossier fictif ; aucun modèle ni calcul légal activé. */
(function (root, factory) {
  'use strict';
  var api = factory(); root.PayrollGeneralSettings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function mount(container, options) {
    var win=container.ownerDocument.defaultView, hr=options.hr, id=options.dossier.id, dirty=false, initial;
    function allowed(write) { var d=hr.currentDossier(); return !!(d&&d.id===id&&hr.isDemoTestDossier(id)&&options.canView()&&(!write||options.canManage())); }
    function input(name,label,value,max) { return '<label>'+esc(label)+'<input type="text" name="'+esc(name)+'" maxlength="'+max+'" value="'+esc(value)+'" autocomplete="off"'+(!allowed(true)?' disabled':'')+'></label>'; }
    function render() {
      try {
        if(!allowed(false)) throw Error('Dossier fictif ou droit de consultation indisponible.');
        initial=hr.generalSettings(hr.currentDossier()); dirty=false;
        var countries=hr.generalSettingCountries();
        function countryOptions(items) { return items.map(function(c) { return '<option value="'+esc(c.id)+'"'+(initial.country===c.id?' selected':'')+'>'+esc(c.label)+'</option>'; }).join(''); }
        container.innerHTML='<section class="payroll-book-workspace payroll-rubric-cumulative payroll-general-settings">'+
          '<div class="payroll-employee-workspace-head rubric-page-head"><div><p class="page-kicker">SOUS-MENU · PARAMÈTRES</p><h3>Paramètres généraux</h3><p class="rubric-page-subtitle">Identité sociale et fiscale · libellés du dossier.</p></div><span class="badge draft">PARAMÉTRAGE · TEST</span></div>'+
          '<div class="alert warning rubric-notice">Données fictives uniquement. Aucun calcul légal, dépôt, bulletin officiel ou paiement n’est déclenché.</div>'+
          '<form data-general-form class="rubric-setup">'+
          '<fieldset class="rubric-card"><legend><span class="rubric-step">01</span> Impôts et assurances sociales</legend><div class="rubric-layout-fields">'+
          '<label>Pays<select name="country" aria-describedby="general-country-note"'+(!allowed(true)?' disabled':'')+'><optgroup label="Pays de l’UEMOA">'+countryOptions(countries.uemoa)+'</optgroup><optgroup label="Autres pays et territoires">'+countryOptions(countries.other)+'</optgroup></select></label>'+
          input('insae','N° INSAE',initial.insae,80)+input('ifu','N° IFU',initial.ifu,40)+input('cnssEmployerNumber','N° employeur CNSS',initial.cnssEmployerNumber,80)+'</div>'+
          '<p id="general-country-note" class="rubric-helper">Le pays est indicatif : il ne modifie pas les règles ni les autres écrans et documents. Les mentions INSAE, IFU et CNSS sont des repères du Bénin ; vérifiez leur pertinence pour un autre pays. Le numéro employeur est celui de l’entreprise, non d’un salarié.</p></fieldset>'+
          '<fieldset class="rubric-card"><legend><span class="rubric-step">02</span> Modification des libellés</legend><div class="rubric-layout-fields">'+input('serviceSingular','Service · singulier',initial.serviceSingular,60)+input('servicePlural','Services · pluriel',initial.servicePlural,60)+'</div><p class="rubric-helper">Ces libellés personnalisent certains intitulés de navigation et de filtres à l’écran. Certains autres écrans restent à adapter ; les données, états imprimés et exports ne sont pas renommés.</p></fieldset>'+
          '<fieldset class="rubric-card"><legend><span class="rubric-step">03</span> Formats des bulletins exceptionnels de salaire</legend><p class="rubric-card-intro">En attente des modèles à fournir : aucun nouveau format n’est créé ou activé ici. Les présentations de test existantes restent inchangées.</p><div class="rubric-layout-fields">'+[1,2,3].map(function(n){return '<label>Format '+n+'<input type="text" disabled placeholder="Modèle à définir"></label>';}).join('')+'</div></fieldset>'+
          '<div data-general-message role="status" class="alert info" hidden></div><div class="rubric-form-footer"><p>Paramètres locaux au dossier fictif.</p><div><button type="button" class="btn btn-secondary" data-general-cancel>Annuler</button> <button type="submit" class="btn btn-primary"'+(!allowed(true)?' disabled':'')+'>Valider</button></div></div>'+(!allowed(true)?'<p>La modification nécessite le droit de gestion des dossiers.</p>':'')+'</form></section>';
        var form=container.querySelector('[data-general-form]'), msg=form.querySelector('[data-general-message]');
        form.addEventListener('input',function(){dirty=true;});
        form.addEventListener('change',function(){dirty=true;});
        form.onsubmit=function(e){e.preventDefault();try{
          if(!allowed(true)) throw Error('Dossier ou droit de gestion indisponible.');
          var current=hr.generalSettings(hr.currentDossier()); if(JSON.stringify(current)!==JSON.stringify(initial)) throw Error('Les paramètres ont changé ailleurs ; rechargez avant de réessayer.');
          var values={};['country','insae','ifu','cnssEmployerNumber','serviceSingular','servicePlural'].forEach(function(k){values[k]=form.elements[k].value;});
          var result=hr.updateGeneralSettings(id,values,initial);if(!result.ok)throw Error(result.errors.join(' '));dirty=false;options.onSave();
        }catch(err){msg.hidden=false;msg.textContent=err.message;}};
        form.querySelector('[data-general-cancel]').onclick=function(){if(dirty&&!win.confirm('Abandonner les modifications non enregistrées ?'))return;dirty=false;options.onClose();};
      } catch(e) { container.textContent=e.message; }
    }
    function guard(e){if(dirty&&container.isConnected&&!container.contains(e.target)&&e.target.closest&&e.target.closest('a[href],button[data-action]')&&!win.confirm('Abandonner les paramètres non enregistrés ?')){e.preventDefault();e.stopImmediatePropagation();}}
    var profile=win.document.querySelector('#demo-active-profile'), profileValue=profile&&profile.value;
    function profileGuard(e){if(dirty&&container.isConnected&&profile&&e.target===profile&&profile.value!==profileValue&&!win.confirm('Changer de profil et abandonner les paramètres non enregistrés ?')){profile.value=profileValue;e.preventDefault();e.stopImmediatePropagation();}}
    function unload(e){if(dirty&&container.isConnected){e.preventDefault();e.returnValue='';}}
    win.document.addEventListener('click',guard,true);win.document.addEventListener('change',profileGuard,true);win.addEventListener('beforeunload',unload);
    var observer=new win.MutationObserver(function(){if(!container.isConnected){observer.disconnect();win.document.removeEventListener('click',guard,true);win.document.removeEventListener('change',profileGuard,true);win.removeEventListener('beforeunload',unload);}});observer.observe(win.document.documentElement,{childList:true,subtree:true});render();
  }
  /* Traduire exclusivement des libellés statiques identifiés, jamais les valeurs des fiches ou les aperçus d'états. */
  function applyLabels(root, labels) {
    if (!root || !labels) return;
    var singular=String(labels.serviceSingular||'Service'), plural=String(labels.servicePlural||'Services');
    var replacements={'Service':singular,'Services':plural,'service':singular.toLocaleLowerCase(),'services':plural.toLocaleLowerCase(),'Tous les services':'Ensemble · '+plural,'* · Tous les services':'* · Ensemble · '+plural};
    var selectors=['[data-menu-item="services"] .accounting-subtab-label','[data-definition-report-id="services"] span','.payroll-employee-services-workspace .payroll-employee-workspace-head h3','.payroll-employee-services-workspace .payroll-status-list-head h4','.payroll-employee-workspace .payroll-employee-preview dt','.payroll-employee-overview-table th','form label','option[value="service"]','option[value="services"]','select[name="service"] option[value="*"]'];
    root.querySelectorAll(selectors.join(',')).forEach(function(el){
      if(el.closest('#payroll-general-settings-workspace, .payroll-book-report, .slip-edition-document, dialog:not(.payroll-employee-overview), [data-personnel-result]:not([hidden]), [data-def-result]:not([hidden])'))return;
      if(el.tagName==='LABEL') {
        var f=el.getAttribute('for')||'', field=el.querySelector('select[name="service"],select[name="serviceId"],input[name="columns"][value="service"],input[name="columns"][value="services"]');
        if(!field && !/service/i.test(f))return;
      }
      Array.from(el.childNodes).forEach(function(node){if(node.nodeType!==3)return;var text=node.nodeValue,trim=text.trim(),value=replacements[trim];if(value===undefined && el.matches('.payroll-employee-services-workspace .payroll-status-list-head h4') && /^Services \([0-9]+\)$/.test(trim))value=trim.replace(/^Services/,plural);if(value!==undefined && value!==trim) {
        if(el.closest('.payroll-employee-workspace')) {
          var span=el.ownerDocument.createElement('span');span.className='payroll-ui-service-label';span.setAttribute('data-print-label',trim);span.textContent=value;node.replaceWith(span);
        } else node.nodeValue=text.replace(trim,value);
      }});
    });
  }
  function localize(root, labels) {
    if(!root)return;applyLabels(root,labels);
    var win=root.ownerDocument.defaultView, observer=new win.MutationObserver(function(){applyLabels(root,labels);});
    observer.observe(root,{childList:true,subtree:true});
    var cleanup=new win.MutationObserver(function(){if(!root.isConnected){observer.disconnect();cleanup.disconnect();}});cleanup.observe(root.ownerDocument.documentElement,{childList:true,subtree:true});
  }
  return {mount:mount,applyLabels:applyLabels,localize:localize};
});
