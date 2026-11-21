/* Paramétrage analytique de test : aucune écriture ni création de centre. */
(function (root, factory) {
  'use strict';
  var api = factory();
  root.PayrollAnalyticPostings = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function key(id) { return 'EMRYS-payroll-analytic-v1:' + encodeURIComponent(String(id)); }
  function normalizeCode(v) { return String(v == null ? '' : v).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase(); }
  function validCode(c) { return typeof c === 'string' && /^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(c); }
  function prefixes(text) {
    var list = String(text || '').split(/[;,\s]+/).filter(Boolean);
    if (!list.length || list.length > 20 || list.some(function (p) { return !/^6[0-9]{0,7}$/.test(p); }) || new Set(list).size !== list.length) throw Error('Saisissez de 1 à 20 préfixes distincts de la classe 6, séparés par des virgules.');
    return list;
  }
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.plans)) throw Error('Format inconnu.');
    var plans = new Set();
    data.plans.forEach(function (p) {
      if (!p || typeof p.accountingDossierId !== 'string' || !p.accountingDossierId || plans.has(p.accountingDossierId) || !Array.isArray(p.prefixes) || !Array.isArray(p.overrides)) throw Error('Plan invalide.');
      if (p.prefixes.some(function (v) { return typeof v !== 'string'; }) || JSON.stringify(prefixes(p.prefixes.join(','))) !== JSON.stringify(p.prefixes)) throw Error('Préfixes invalides.');
      plans.add(p.accountingDossierId);
      var services = new Set();
      p.overrides.forEach(function (o) {
        if (!o || typeof o.serviceId !== 'string' || !o.serviceId || services.has(o.serviceId) || typeof o.serviceCode !== 'string' || typeof o.serviceLabel !== 'string' || !validCode(o.centerCode) || !(o.centerId === null || typeof o.centerId === 'string' && !!o.centerId) || typeof o.centerName !== 'string') throw Error('Correspondance invalide.');
        services.add(o.serviceId);
      });
    });
    return data;
  }
  function load(storage, id) {
    var raw;
    try { raw = storage.getItem(key(id)); } catch (_) { throw Error('Lecture du stockage impossible ; aucune donnée ne sera écrasée.'); }
    if (raw === null) return { version: 1, plans: [] };
    try { return validate(JSON.parse(raw)); } catch (_) { throw Error('Imputations analytiques illisibles ou invalides : aucune donnée ne sera écrasée.'); }
  }
  function save(storage, id, data) { validate(data); try { storage.setItem(key(id), JSON.stringify(data)); } catch (_) { throw Error('Enregistrement impossible dans ce navigateur ; les données précédentes sont conservées.'); } }
  function getPlan(data, id) { return data.plans.find(function (p) { return p.accountingDossierId === id; }) || { accountingDossierId: id, prefixes: ['6'], overrides: [] }; }
  function eligible(account, list) { return !!(account && account.code != null && list.some(function (p) { return String(account.code).indexOf(p) === 0; }) && account.active !== false && account.postable !== false); }
  function matching(centers, code) { return centers.filter(function (c) { return c && normalizeCode(c.code) === code; }); }
  function analyse(service, ctx, plan) {
    var o = plan.overrides.find(function (x) { return x.serviceId === service.id; });
    var code = o ? o.centerCode : normalizeCode(service.code);
    var result = { serviceId: service.id, code: code, source: o ? 'Modifié' : 'Défaut · code service', status: [], override: o };
    if (!validCode(code)) result.status.push('Code service incompatible avec un code centre · à renseigner');
    if (!ctx || !Array.isArray(ctx.centers) || !Array.isArray(ctx.chart)) { result.status.push('Référentiel comptable inaccessible · non vérifié'); return result; }
    var matches = matching(ctx.centers, code);
    if (matches.length !== 1) { result.status.push(matches.length ? 'Code centre en doublon · à vérifier' : 'Centre absent · à vérifier'); return result; }
    var c = matches[0];
    if (!c.id || ctx.centers.filter(function (x) { return x && String(x.id || '') === String(c.id || ''); }).length !== 1) result.status.push('Identifiant centre absent ou dupliqué');
    if (c.active === false) result.status.push('Centre archivé');
    if (o && o.centerId && (o.centerId !== String(c.id || '') || o.centerName !== String(c.name || '') || o.serviceCode !== String(service.code || '') || o.serviceLabel !== String(service.label || ''))) result.status.push('Service ou centre modifié · reconfirmation requise');
    if (o && !o.centerId) result.status.push('Centre retrouvé depuis la saisie · confirmation requise');
    if (!o) result.status.push('Proposition par code · correspondance à confirmer');
    else if (!result.status.length) result.status.push('Correspondance confirmée · à recontrôler avant utilisation');
    return result;
  }
  function prepare(service, value, ctx) {
    var code = normalizeCode(value);
    if (!service || !service.id || !validCode(code)) throw Error('Code centre invalide (32 caractères maximum).');
    if (!ctx || !Array.isArray(ctx.centers) || !Array.isArray(ctx.chart)) throw Error('Référentiel comptable inaccessible.');
    var matches = matching(ctx.centers, code);
    if (matches.length > 1) throw Error('Code centre non unique.');
    var c = matches[0] || null;
    if (c && (!c.id || ctx.centers.filter(function (v) { return v && String(v.id || '') === String(c.id); }).length !== 1)) throw Error('Identifiant centre absent ou dupliqué.');
    if (c && c.active === false) throw Error('Ce centre est archivé.');
    return { serviceId: service.id, serviceCode: String(service.code || ''), serviceLabel: String(service.label || ''), centerCode: code, centerId: c ? String(c.id) : null, centerName: c ? String(c.name || '') : '' };
  }
  function mount(container, options) {
    var win = container.ownerDocument.defaultView, storage = win.localStorage, hr = options.hr, id = options.dossier.id;
    var state = { service: '', dirty: false, prefixDirty: false, editDirty: false, message: '' };
    function allowed(edit) { var d = hr.currentDossier(); return !!(d && d.id === id && hr.isDemoTestDossier(id) && options.canView() && (!edit || options.canEdit())); }
    function read() {
      if (!allowed(false)) throw Error('Dossier ou droit de consultation indisponible.');
      var d = hr.currentDossier(), services = hr.employeeServices(id), ctx = options.context(d), all = load(storage, id), accountId = d.accountingDossierId || '', seen = new Set();
      services.forEach(function (s) { if (!s || !s.id || seen.has(s.id)) throw Error('Identifiant service absent ou dupliqué.'); seen.add(s.id); });
      var available = !!(accountId && ctx && Array.isArray(ctx.chart) && Array.isArray(ctx.centers));
      return { services: services, context: ctx || {}, all: all, accountId: accountId, available: available, plan: available ? getPlan(all, accountId) : { accountingDossierId: '', prefixes: ['6'], overrides: [] } };
    }
    function commit(original, change) {
      if (!allowed(true)) throw Error('Droit de modification indisponible.');
      var fresh = read();
      if (!fresh.available || fresh.accountId !== original.accountId) throw Error('Dossier comptable lié inaccessible ou modifié.');
      if (JSON.stringify(fresh.plan) !== JSON.stringify(original.plan)) throw Error('Ce paramétrage a changé ailleurs ; rechargez avant de réessayer.');
      change(fresh);
      fresh.all.plans = fresh.all.plans.filter(function (p) { return p.accountingDossierId !== fresh.accountId; });
      fresh.all.plans.push(fresh.plan); save(storage, id, fresh.all); state.dirty = false; state.prefixDirty = false; state.editDirty = false;
    }
    function showError(error) { var el = container.querySelector('[data-analytic-message]'); if (el) el.textContent = error.message; }
    function render() {
      try {
        var data = read(), services = data.services, selected = services.find(function (s) { return s.id === state.service; }) || services[0];
        state.service = selected ? selected.id : '';
        var rows = services.map(function (s) { return { service: s, result: analyse(s, data.available ? data.context : null, data.plan) }; });
        var row = rows.find(function (x) { return x.service.id === state.service; });
        var edit = allowed(true) && data.available, canReset = edit && options.canDelete();
        var orphans = data.plan.overrides.filter(function (o) { return !services.some(function (s) { return s.id === o.serviceId; }); });
        var count = data.available ? data.context.chart.filter(function (a) { return eligible(a, data.plan.prefixes); }).length : 0;
        var centers = data.available ? data.context.centers.filter(function (c) { return c && c.active !== false; }) : [];
        container.innerHTML = '<section class="payroll-book-workspace"><div class="payroll-employee-workspace-head"><div><p class="page-kicker">SOUS-MENU · COMPTABILISATIONS</p><h3>Imputations analytiques</h3></div><span class="badge draft">PARAMÉTRAGE · TEST</span></div>' +
          '<div class="alert warning">Paramétrage fictif uniquement. Aucun centre, journal ou écriture n’est créé. Un code identique est une proposition, pas une correspondance confirmée.</div><p>' + esc(data.context.notice || '') + '</p><div class="alert info" role="status" data-analytic-message>' + esc(state.message) + '</div>' +
          '<form class="rubric-card" data-analytic-prefix><p>Si vous utilisez l’analyse par centres de responsabilité dans la comptabilité générale, indiquez les comptes généraux concernés.</p><label>Comptes généraux · préfixes <input name="prefixes" maxlength="179" value="' + esc(data.plan.prefixes.join(', ')) + '"' + (!edit ? ' disabled' : '') + '></label> <button class="btn btn-secondary" type="submit"' + (!edit ? ' disabled' : '') + '>Enregistrer les préfixes</button><p>6 inclut ses subdivisions. ' + (data.available ? count + ' compte(s) visibles, actifs et imputables dans le plan lié.' : 'Plan non vérifié.') + ' Les règles analytiques par compte restent à vérifier avant toute utilisation.</p></form>' +
          '<p>Les codes des centres de responsabilité de la comptabilité peuvent différer de ceux des services de paie : indiquez et confirmez leur correspondance. Plusieurs services peuvent partager un centre.</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Service</th><th>Intitulé</th><th>Centre</th><th>Origine et contrôle</th><th>Sélection</th></tr></thead><tbody>' + (rows.map(function (x) { return '<tr><td>' + esc(x.service.code) + '</td><td>' + esc(x.service.label) + '</td><td>' + esc(x.result.code || '—') + '</td><td>' + esc(x.result.source + ' · ' + x.result.status.join(' ; ')) + '</td><td><button class="btn btn-secondary" type="button" data-analytic-service="' + esc(x.service.id) + '" aria-pressed="' + (x.service.id === state.service) + '">Choisir</button></td></tr>'; }).join('') || '<tr><td colspan="5">Aucun service de paie.</td></tr>') + '</tbody></table></div>' +
          (orphans.length ? '<div class="alert warning">' + orphans.length + ' correspondance(s) orpheline(s) conservées et non utilisables. Elles ne seront supprimées que lors du retour confirmé au défaut.</div>' : '') +
          (row ? '<form data-analytic-edit class="rubric-card"><h4>Modifier · ' + esc(row.service.code + ' · ' + row.service.label) + '</h4><label>Code centre <input name="centerCode" list="payroll-analytic-centers" maxlength="32" required value="' + esc(row.result.code) + '"' + (!edit ? ' disabled' : '') + '></label><datalist id="payroll-analytic-centers">' + centers.map(function (c) { return '<option value="' + esc(c.code) + '">' + esc(c.name) + '</option>'; }).join('') + '</datalist><p data-analytic-preview></p><button class="btn btn-primary" type="submit"' + (!edit ? ' disabled' : '') + '>Modifier</button>' + (row.result.override ? ' <button class="btn btn-secondary" type="button" data-analytic-reset-one' + (!canReset ? ' disabled' : '') + '>Défaut pour ce service</button>' : '') + '</form>' : '') +
          '<div class="payroll-book-actions"><button class="btn btn-secondary" type="button" data-analytic-default' + (!canReset ? ' disabled' : '') + '>Défaut (Centre = Service)</button> <button class="btn btn-secondary" type="button" data-analytic-close>Fermer</button></div><p>Préfixes et correspondances isolés par dossier comptable lié. Les correspondances modifiées, absentes ou archivées sont à vérifier. Le journal officiel ne les utilise pas encore.</p></section>';
        container.querySelectorAll('[data-analytic-service]').forEach(function (b) { b.onclick = function () { if (state.dirty && !win.confirm('Abandonner les modifications non enregistrées ?')) return; state.service = b.getAttribute('data-analytic-service'); state.dirty = false; state.prefixDirty = false; state.editDirty = false; state.message = ''; render(); }; });
        var prefixForm = container.querySelector('[data-analytic-prefix]');
        prefixForm.addEventListener('input', function () { state.dirty = true; state.prefixDirty = true; });
        prefixForm.onsubmit = function (e) { e.preventDefault(); try { if (state.editDirty && !win.confirm('Abandonner la modification du centre non enregistrée ?')) return; var value = prefixes(prefixForm.elements.prefixes.value); commit(data, function (fresh) { fresh.plan.prefixes = value; }); state.message = 'Préfixes enregistrés ; vérifiez le plan et ses règles analytiques.'; render(); } catch (err) { showError(err); } };
        var form = container.querySelector('[data-analytic-edit]');
        if (form) {
          function preview() { var ms = data.available ? matching(data.context.centers, normalizeCode(form.elements.centerCode.value)) : [], c = ms.length === 1 ? ms[0] : null; form.querySelector('[data-analytic-preview]').textContent = !data.available ? 'Référentiel comptable inaccessible.' : c ? 'Centre existant : ' + String(c.name || 'sans nom') + (c.active === false ? ' · archivé' : '') + '. Vérifiez la correspondance.' : ms.length ? 'Plusieurs centres portent ce code.' : 'Centre absent : code conservé à vérifier, sans création.'; }
          preview(); form.addEventListener('input', function () { state.dirty = true; state.editDirty = true; preview(); });
          form.onsubmit = function (e) { e.preventDefault(); try {
            if (state.prefixDirty && !win.confirm('Abandonner les préfixes non enregistrés ?')) return;
            var code = form.elements.centerCode.value, candidate = prepare(selected, code, data.context), latest = read();
            if (!latest.available || latest.accountId !== data.accountId || JSON.stringify(latest.plan) !== JSON.stringify(data.plan)) throw Error('Dossier ou paramétrage modifié ; rechargez.');
            if (JSON.stringify(prepare(latest.services.find(function (s) { return s.id === state.service; }), code, latest.context)) !== JSON.stringify(candidate)) throw Error('Service ou centre modifié ; rechargez et vérifiez.');
            if (!win.confirm(candidate.centerId ? 'Confirmer que le centre ' + candidate.centerCode + ' · ' + candidate.centerName + ' correspond au service ' + candidate.serviceCode + ' · ' + candidate.serviceLabel + ' ?' : 'Aucun centre trouvé. Enregistrer ce code à vérifier sans créer de centre ?')) return;
            commit(data, function (fresh) { var current = prepare(fresh.services.find(function (s) { return s.id === state.service; }), code, fresh.context); if (JSON.stringify(current) !== JSON.stringify(candidate)) throw Error('Service ou centre modifié ; rechargez et vérifiez.'); fresh.plan.overrides = fresh.plan.overrides.filter(function (o) { return o.serviceId !== state.service; }); fresh.plan.overrides.push(current); });
            state.message = candidate.centerId ? 'Correspondance enregistrée ; recontrôler avant utilisation.' : 'Code enregistré à vérifier ; aucun centre créé.'; render();
          } catch (err) { showError(err); } };
        }
        var reset = container.querySelector('[data-analytic-reset-one]');
        if (reset) reset.onclick = function () { try { if (!allowed(true) || !options.canDelete()) throw Error('Droits de modification et de suppression requis.'); if (!win.confirm('Rétablir le code service par défaut ? Les modifications non enregistrées seront abandonnées.')) return; commit(data, function (fresh) { if (!options.canDelete()) throw Error('Droit de suppression indisponible.'); fresh.plan.overrides = fresh.plan.overrides.filter(function (o) { return o.serviceId !== state.service; }); }); state.message = 'Code service rétabli comme proposition.'; render(); } catch (err) { showError(err); } };
        container.querySelector('[data-analytic-default]').onclick = function () { try { if (!allowed(true) || !options.canDelete()) throw Error('Droits de modification et de suppression requis.'); if (!win.confirm('Rétablir les codes services pour tous les centres ? Les correspondances manuelles, y compris orphelines, seront supprimées et les modifications non enregistrées abandonnées.')) return; commit(data, function (fresh) { if (!options.canDelete()) throw Error('Droit de suppression indisponible.'); fresh.plan.overrides = []; }); state.message = 'Codes services rétablis comme propositions ; aucun centre créé.'; render(); } catch (err) { showError(err); } };
        container.querySelector('[data-analytic-close]').onclick = function () { if (state.dirty && !win.confirm('Abandonner les modifications non enregistrées ?')) return; state.dirty = false; options.onClose(); };
      } catch (error) { container.textContent = error.message; }
    }
    function navigationGuard(e) { if (state.dirty && container.isConnected && !container.contains(e.target) && e.target.closest && e.target.closest('a[href],button[data-action]') && !win.confirm('Abandonner les modifications non enregistrées ?')) { e.preventDefault(); e.stopImmediatePropagation(); } }
    function unloadGuard(e) { if (state.dirty && container.isConnected) { e.preventDefault(); e.returnValue = ''; } }
    win.document.addEventListener('click', navigationGuard, true); win.addEventListener('beforeunload', unloadGuard);
    var observer = new win.MutationObserver(function () { if (!container.isConnected) { observer.disconnect(); win.document.removeEventListener('click', navigationGuard, true); win.removeEventListener('beforeunload', unloadGuard); } });
    observer.observe(win.document.documentElement, { childList: true, subtree: true }); render();
  }
  return { normalizeCode: normalizeCode, prefixes: prefixes, validCode: validCode, load: load, save: save, getPlan: getPlan, eligible: eligible, analyse: analyse, prepare: prepare, mount: mount };
});
