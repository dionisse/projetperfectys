/* Heures de présence fictives : stockage journalier, isolé par dossier et employé. */
(function(root) {
  'use strict';
  var PREFIX='perfecto.payroll.attendance.v1.';
  function esc(value) { return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function iso(date) { return date.toISOString().slice(0,10); }
  function calendarWeeks(month) {
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month||''))) throw new Error('Mois invalide.');
    var year=+month.slice(0,4), m=+month.slice(5,7)-1;
    if(year<1900||year>9999) throw new Error('Année invalide.');
    var first=new Date(Date.UTC(year,m,1)), last=new Date(Date.UTC(year,m+1,0));
    var start=new Date(first);start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
    var end=new Date(last);end.setUTCDate(end.getUTCDate()+(6-((end.getUTCDay()+6)%7)));
    var weeks=[], week=[];
    while(start<=end){week.push(iso(start));if(week.length===7){weeks.push(week);week=[];}start.setUTCDate(start.getUTCDate()+1);}
    return weeks;
  }
  function addDay(date) { var d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return iso(d); }
  function clock(value) { if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value||''))) throw new Error('Heure invalide : utilisez HH:MM.');return +value.slice(0,2)*60+(+value.slice(3,5)); }
  function intervals(row) {
    row=row||{};var parts=[];
    [1,2].forEach(function(i){
      var start=String(row['start'+i]||''), end=String(row['end'+i]||''), next=row['next'+i]===true;
      if(!start&&!end){if(next) throw new Error('Le passage au lendemain exige un créneau complet.');return;}
      if(!start||!end) throw new Error('Chaque créneau doit avoir un début et une fin.');
      var a=clock(start),b=clock(end)+(next?1440:0);
      if(b<=a || b-a>1440) throw new Error('La fin doit suivre le début ; cochez « lendemain » pour un créneau de nuit de 24 h maximum.');
      parts.push({start:a,end:b,index:i});
    });
    if(parts.length===2 && (parts[1].start<parts[0].end)) throw new Error('Le deuxième créneau doit commencer après la fin du premier.');
    return parts;
  }
  function dayMinutes(row) { return intervals(row).reduce(function(n,x){return n+x.end-x.start;},0); }
  function duration(n) { return Math.floor(n/60)+' h '+String(n%60).padStart(2,'0'); }
  function validateRecords(records, cycleEnd, cycleStart) {
    var all=[];
    Object.keys(records).forEach(function(date){
      var parsed=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date), check=parsed && new Date(Date.UTC(+parsed[1],+parsed[2]-1,+parsed[3]));
      if(!parsed || +parsed[1]<1900 || check.getUTCFullYear()!==+parsed[1] || check.getUTCMonth()!==+parsed[2]-1 || check.getUTCDate()!==+parsed[3] || (cycleStart && date<cycleStart) || date>cycleEnd) throw new Error('Date de présence invalide ou hors cycle : '+date+'.');
      var startOfDay=Date.parse(date+'T00:00:00Z')/60000;
      intervals(records[date]).forEach(function(p){
        if(p.end>1440 && addDay(date)>cycleEnd) throw new Error(date+' : le créneau de nuit dépasse la fin du cycle.');
        all.push({start:startOfDay+p.start,end:startOfDay+p.end,date:date});
      });
    });
    all.sort(function(a,b){return a.start-b.start;});
    for(var i=1;i<all.length;i++) if(all[i].start<all[i-1].end) throw new Error('Chevauchement entre les créneaux du '+all[i-1].date+' et du '+all[i].date+'.');
  }
  function load(id) {
    var raw=root.localStorage.getItem(PREFIX+encodeURIComponent(id));if(!raw)return {version:1,employees:{}};
    var data=JSON.parse(raw);if(!data||data.version!==1||!data.employees||typeof data.employees!=='object'||Array.isArray(data.employees))throw new Error('Données de présence illisibles ; aucune modification effectuée.');return data;
  }
  function save(id,data){root.localStorage.setItem(PREFIX+encodeURIComponent(id),JSON.stringify(data));}
  function mount(container,options){
    if(!container||!options||!options.hr||!options.tools)return;
    var hr=options.hr,tools=options.tools,dossier=options.dossier,id=dossier.id,data;
    var state={filter:'',filterId:'',sort:'number',query:'',includeDeparted:false,employeeId:'',month:tools.monthList(dossier)[0]||'',editing:false};
    try{data=load(id);}catch(e){container.textContent=e.message;return;}
    function canEdit(){var active=hr.currentDossier();return !!(hr.isDemoTestDossier(id)&&active&&active.id===id&&options.canEdit());}
    function allEmployees(){return hr.employees(id);}
    function chosenEmployee(){return allEmployees().find(function(e){return e.id===state.employeeId;})||null;}
    function records(){return data.employees[state.employeeId]||{};}
    function available(date){return date>=dossier.cycleStart&&date<=dossier.cycleEnd;}
    function guard(){return !state.editing||root.confirm('Abandonner les heures non enregistrées ?');}
    function showError(err){root.alert(err.message||String(err));}
    function selectOptions(items,selected){return items.map(function(item){return '<option value="'+esc(item.id)+'"'+(item.id===selected?' selected':'')+'>'+esc((item.code?item.code+' · ':'')+(item.label||''))+'</option>';}).join('');}
    function formatDay(date){return new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z'));}
    function formatMonth(month){return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(month+'-01T00:00:00Z'));}
    function leaveNotes(employee,date,leaves){return leaves.filter(function(l){return l.employeeId===employee.id&&l.startDate<=date&&l.endDate>=date;}).map(function(l){return l.kind==='request'?'Demande de congé':'Absence enregistrée';}).filter(function(value,index,arr){return arr.indexOf(value)===index;}).join(' · ');}
    function rowObject(tr){var row={};[1,2].forEach(function(i){var a=tr.querySelector('[data-att-time="start'+i+'"]'),b=tr.querySelector('[data-att-time="end'+i+'"]'),n=tr.querySelector('[data-att-next="'+i+'"]');row['start'+i]=a?a.value:'';row['end'+i]=b?b.value:'';row['next'+i]=!!(n&&n.checked);});return row;}
    function render(){
      var catalogs={status:hr.employeeStatuses(id),zone:hr.employeeGeographicZones(id),service:hr.employeeServices(id)};
      var employees=allEmployees().filter(function(e){var field={status:'employeeStatus',zone:'geographicZoneId',service:'serviceId'}[state.filter];return (state.includeDeparted||!tools.hasDepartedAtPeriod(e,state.month))&&(!field||!state.filterId||e[field]===state.filterId)&&tools.matchesEmployee(e,state.query);});
      employees.sort(function(a,b){return String(state.sort==='name'?a.displayName||'':a.employeeNumber||a.id).localeCompare(String(state.sort==='name'?b.displayName||'':b.employeeNumber||b.id),'fr',{numeric:true,sensitivity:'base'});});
      if(!employees.some(function(e){return e.id===state.employeeId;})) state.employeeId='';
      var employee=employees.find(function(e){return e.id===state.employeeId;})||null;
      var weeks=state.month?calendarWeeks(state.month):[], items=employee?records():{}, editing=state.editing&&canEdit()&&!!employee;
      var leaves=employee?hr.leaveAbsenceRecords(id):[];
      var status=employee && catalogs.status.find(function(item){return item.id===employee.employeeStatus;});
      var body=weeks.map(function(week,index){var total=0,count=0;var rows=week.map(function(date){
        var inCycle=available(date),stored=items[date]||{}, parts=[];try{parts=intervals(stored);total+=dayMinutes(stored);if(parts.length)count++;}catch(e){}
        var note=employee?leaveNotes(employee,date,leaves):'';
        var cells=[1,2].map(function(i){var begin=stored['start'+i]||'',end=stored['end'+i]||'',next=stored['next'+i]===true;
          return '<td data-label="Début '+i+'">'+(editing&&inCycle?'<input type="time" step="60" data-att-time="start'+i+'" aria-label="Début '+i+' · '+esc(formatDay(date))+'" value="'+esc(begin)+'">':esc(begin||'—'))+'</td><td data-label="Fin '+i+'">'+(editing&&inCycle?'<input type="time" step="60" data-att-time="end'+i+'" aria-label="Fin '+i+' · '+esc(formatDay(date))+'" value="'+esc(end)+'"><label class="attendance-next"><input type="checkbox" data-att-next="'+i+'" aria-label="Fin '+i+' le lendemain · '+esc(formatDay(date))+'"'+(next?' checked':'')+'> lendemain</label>':esc(end||'—')+(next?' <small>+1 jour</small>':''))+'</td>';}).join('');
        return '<tr data-att-date="'+date+'" data-att-week="'+index+'"'+(!inCycle?' class="attendance-outside"':'')+'><th scope="row">'+esc(formatDay(date))+(date.slice(0,7)!==state.month?' <small>(mois voisin)</small>':'')+(!inCycle?' <small>hors cycle</small>':'')+(note?' <small class="attendance-leave-note">'+esc(note)+'</small>':'')+'</th>'+cells+'<td data-label="Durée" data-att-duration>'+(parts.length?duration(dayMinutes(stored)):'—')+'</td></tr>';
      }).join('');return rows+'<tr class="attendance-week-total"><th scope="row" colspan="5">Total semaine · journées renseignées <span data-att-week-count="'+index+'">('+count+')</span></th><td data-att-week-total="'+index+'">'+(count?duration(total):'—')+'</td></tr>';}).join('');
      var monthTotal=0,monthCount=0;weeks.flat().filter(function(date){return date.slice(0,7)===state.month&&available(date);}).forEach(function(date){try{var row=items[date]||{};if(intervals(row).length){monthTotal+=dayMinutes(row);monthCount++;}}catch(e){}});
      container.innerHTML='<section class="attendance-workspace"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · SALAIRES</p><h3>Heures de présence</h3></div><span class="badge draft">TEST</span></div><div class="alert warning"><div>Données fictives uniquement. Durées calculées à partir des horaires saisis, sans calcul automatique de paie, d’heures supplémentaires ou d’indemnité. Les créneaux de nuit sont comptés au jour de leur début.</div></div><div class="attendance-layout"><aside><div class="attendance-filters"><label>Filtre<select data-att-filter="filter"><option value="">Aucun</option><option value="status"'+(state.filter==='status'?' selected':'')+'>Statut</option><option value="zone"'+(state.filter==='zone'?' selected':'')+'>Zone</option><option value="service"'+(state.filter==='service'?' selected':'')+'>Service</option></select></label>'+(state.filter?'<label>Valeur<select data-att-filter="filterId"><option value="">Toutes</option>'+selectOptions(catalogs[state.filter],state.filterId)+'</select></label>':'')+'<label>Classement<select data-att-filter="sort"><option value="number">Matricule</option><option value="name"'+(state.sort==='name'?' selected':'')+'>Nom</option></select></label><label>Rechercher un employé<input type="search" data-att-filter="query" value="'+esc(state.query)+'" placeholder="Matricule, nom ou prénoms"></label><label class="attendance-checkbox"><input type="checkbox" data-att-filter="includeDeparted"'+(state.includeDeparted?' checked':'')+'> Afficher les employés débauchés</label></div><p class="small muted" aria-live="polite">'+employees.length+' employé(s) affiché(s)</p><div class="payroll-slip-scroll"><table><thead><tr><th>Matricule</th><th>Nom</th></tr></thead><tbody>'+employees.map(function(e){return '<tr><td colspan="2"><button type="button" data-att-employee="'+esc(e.id)+'"'+(state.employeeId===e.id?' aria-current="true"':'')+'><span>'+esc(e.employeeNumber||e.id)+'</span><span>'+esc(e.displayName||'')+'</span></button></td></tr>';}).join('')+'</tbody></table>'+(employees.length?'':'<p>Aucun employé correspondant.</p>')+'</div></aside><div class="attendance-detail"><div class="attendance-top"><label>Mois<select data-att-filter="month">'+tools.monthList(dossier).map(function(p){return '<option value="'+esc(p)+'"'+(p===state.month?' selected':'')+'>'+esc(formatMonth(p))+'</option>';}).join('')+'</select></label><strong>'+esc(employee?employee.displayName:'Sélectionnez un employé')+'</strong></div>'+(status && status.monthlyWorkHours ? '<p class="small muted">Base mensuelle indicative du statut '+esc(status.code || status.label)+' : '+esc(status.monthlyWorkHours)+' h (sans remplissage automatique).</p>' : '')+'<p class="small muted">Semaines du lundi au dimanche ; les jours voisins du mois sont affichés. Les demandes et absences RH sont signalées à titre indicatif, sans modifier les horaires.</p><form id="attendance-form"><div class="payroll-slip-scroll attendance-table"><table><thead><tr><th>Jour</th><th>Début 1</th><th>Fin 1</th><th>Début 2</th><th>Fin 2</th><th>Durée</th></tr></thead><tbody>'+body+'</tbody></table></div><p class="small muted">Total du mois · journées renseignées : <strong data-att-month-total>'+(monthCount?duration(monthTotal):'—')+'</strong> <span data-att-month-count>('+monthCount+')</span>. Une case vide ne signifie pas une absence.</p>'+(editing?'<label class="attendance-checkbox"><input type="checkbox" name="testOnly" required> Je confirme que ces horaires sont fictifs.</label>':'')+'<div class="payroll-slip-actions">'+(editing?'<button type="submit" class="btn btn-primary">Enregistrer</button><button type="button" class="btn btn-secondary" data-att-action="cancel">Annuler</button>':'<button type="button" class="btn btn-primary" data-att-action="edit"'+(!employee||!canEdit()||!state.month?' disabled':'')+'>Modifier</button>')+'<button type="button" class="btn btn-secondary" data-att-action="close">Fermer</button></div></form></div></div></section>';
      bind();
    }
    function recalc(){
      var totals={},counts={},invalid={},monthTotal=0,monthCount=0,monthInvalid=false;
      container.querySelectorAll('[data-att-date]').forEach(function(tr){
        var index=tr.dataset.attWeek,date=tr.dataset.attDate,cell=tr.querySelector('[data-att-duration]');
        if(!tr.querySelector('[data-att-time]')) return;
        try{var row=rowObject(tr),p=intervals(row),mins=dayMinutes(row);cell.textContent=p.length?duration(mins):'—';if(p.length){totals[index]=(totals[index]||0)+mins;counts[index]=(counts[index]||0)+1;if(date.slice(0,7)===state.month){monthTotal+=mins;monthCount++;}}}
        catch(e){cell.textContent='À corriger';invalid[index]=true;if(date.slice(0,7)===state.month)monthInvalid=true;}
      });
      container.querySelectorAll('[data-att-week-total]').forEach(function(el){var i=el.dataset.attWeekTotal;el.textContent=invalid[i]?'À corriger':counts[i]?duration(totals[i]):'—';var count=container.querySelector('[data-att-week-count="'+i+'"]');count.textContent='('+(counts[i]||0)+')';});
      container.querySelector('[data-att-month-total]').textContent=monthInvalid?'À corriger':monthCount?duration(monthTotal):'—';
      container.querySelector('[data-att-month-count]').textContent='('+monthCount+')';
    }
    function saveForm(form){
      if(!state.editing||!canEdit()||!chosenEmployee()) throw new Error('Modification non autorisée ou employé indisponible.');
      if(!form.elements.testOnly.checked)throw new Error('Confirmez le caractère fictif des horaires.');
      if(tools.monthList(dossier).indexOf(state.month)<0)throw new Error('Mois hors cycle.');
      var latest=load(id),previous=records(),current=latest.employees[state.employeeId]||{},updated=Object.assign({},current);
      var changed=[];
      form.querySelectorAll('[data-att-date]').forEach(function(tr){
        var date=tr.dataset.attDate;if(!tr.querySelector('[data-att-time]'))return;
        if(!available(date))throw new Error('Date hors cycle.');
        var row=rowObject(tr);try{intervals(row);}catch(e){throw new Error(formatDay(date)+' : '+e.message);}
        var old=previous[date]||{},normalized={start1:old.start1||'',end1:old.end1||'',next1:old.next1===true,start2:old.start2||'',end2:old.end2||'',next2:old.next2===true};
        if(JSON.stringify(row)===JSON.stringify(normalized))return;
        var latestRow=current[date]||{},latestNorm={start1:latestRow.start1||'',end1:latestRow.end1||'',next1:latestRow.next1===true,start2:latestRow.start2||'',end2:latestRow.end2||'',next2:latestRow.next2===true};
        if(JSON.stringify(latestNorm)!==JSON.stringify(normalized))throw new Error('Les horaires du '+date+' ont changé ailleurs. Rechargez avant de réessayer.');
        if(intervals(row).length)updated[date]=row;else delete updated[date];changed.push(date);
      });
      validateRecords(updated,dossier.cycleEnd,dossier.cycleStart);
      if(!canEdit()||!chosenEmployee())throw new Error('Le dossier ou les droits ont changé.');
      if(changed.length){latest.employees[state.employeeId]=updated;save(id,latest);data=latest;}
      state.editing=false;render();
    }
    function changeFilter(el){
      var name=el.dataset.attFilter,old=state[name],next=el.type==='checkbox'?el.checked:el.value,cursor=name==='query'?el.selectionStart:null;
      if(next===old)return;if(!guard()){if(el.type==='checkbox')el.checked=old;else el.value=old;return;}
      state.editing=false;state[name]=next;if(name==='filter')state.filterId='';render();
      if(name==='query'){var input=container.querySelector('[data-att-filter="query"]');input.focus();if(cursor!==null)input.setSelectionRange(cursor,cursor);}
    }
    function bind(){
      container.querySelectorAll('[data-att-filter]').forEach(function(el){el.addEventListener(el.dataset.attFilter==='query'?'input':'change',function(){changeFilter(el);});});
      container.querySelectorAll('[data-att-employee]').forEach(function(el){el.onclick=function(){if(el.dataset.attEmployee===state.employeeId||!guard())return;state.editing=false;state.employeeId=el.dataset.attEmployee;render();};});
      container.querySelectorAll('[data-att-time], [data-att-next]').forEach(function(el){el.addEventListener('input',recalc);el.addEventListener('change',recalc);});
      var form=container.querySelector('#attendance-form');form.onsubmit=function(e){e.preventDefault();try{saveForm(form);}catch(err){showError(err);}};
      container.querySelectorAll('[data-att-action]').forEach(function(el){el.onclick=function(){var action=el.dataset.attAction;if(action==='edit'){if(!canEdit()||!chosenEmployee()){showError(new Error('Sélectionnez un employé autorisé.'));return;}state.editing=true;render();}else if(action==='cancel'){if(!guard())return;state.editing=false;render();}else if(action==='close'){if(!guard())return;state.editing=false;if(options.onClose)options.onClose();}};});
    }
    function navigationGuard(event){if(!state.editing||!container.isConnected||container.contains(event.target))return;if(event.target.closest&&event.target.closest('a[href], button[data-action]')&&!guard()){event.preventDefault();event.stopImmediatePropagation();}}
    function unloadGuard(event){if(state.editing&&container.isConnected){event.preventDefault();event.returnValue='';}}
    root.document.addEventListener('click',navigationGuard,true);root.addEventListener('beforeunload',unloadGuard);
    var observer=new root.MutationObserver(function(){if(!container.isConnected){root.document.removeEventListener('click',navigationGuard,true);root.removeEventListener('beforeunload',unloadGuard);observer.disconnect();}});observer.observe(root.document.documentElement,{childList:true,subtree:true});
    render();
  }
  var api={mount:mount,calendarWeeks:calendarWeeks,intervals:intervals,dayMinutes:dayMinutes,duration:duration,validateRecords:validateRecords};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PayrollAttendance=api;
})(typeof window!=='undefined'?window:globalThis);
