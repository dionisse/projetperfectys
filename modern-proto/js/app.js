/* =========================================================================
   PERFECTO · Prototype statique — application comptable SYSCOHADA
   JavaScript natif, aucun framework, aucun build. Données locales.
   ========================================================================= */
(function () {
  'use strict';

  var S = window.PerfectoStore;
  var ModuleRegistry = window.PerfectoModules;
  var Permissions = window.PerfectoPermissions;
  var AccountingNavigation = window.PerfectoAccountingNavigation;
  var AccountingExchange = window.PerfectoAccountingExchange;

  /* ------------------------------ Utilitaires ------------------------------ */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function money(value) { return S.money(value); }
  function amount(value) { return S.amount(value); }
  function dateLabel(iso) { return S.dateLabel(iso); }

  function moneyHtml(value) {
    return amount(value) + '\u00A0<small>XOF</small>';
  }

  var ICONS = {
    dashboard: '▥', accounts: '▤', journals: '▦', entry: '＋', entries: '▤',
    balance: '⚖︎', journal: '≡', ledger: '⌕', periods: '◷', settings: '⚙︎'
  };

  var ROUTES = ['login', 'launcher', 'organization', 'dossiers', 'dashboard', 'accounts', 'journals', 'entry', 'entries', 'balance', 'journal', 'ledger', 'periods', 'settings', 'menu'];

  var TITLES = {
    login: ['Connexion', 'Accès à votre espace PERFECTO'],
    launcher: ['Launcher', 'Modules de votre organisation'],
    organization: ['Organisation & accès', 'Organisation, membres et droits d’accès'],
    dossiers: ['Dossiers clients', 'Entreprises clientes et cycles comptables'],
    dashboard: ['Tableau de bord', 'Vue d’ensemble de la comptabilité générale'],
    accounts: ['Plan comptable', 'Comptes SYSCOHADA révisé'],
    journals: ['Journaux comptables', 'Les six journaux du module'],
    entry: ['Saisie d’écriture', 'Pièce multiligne — brouillon ou validation'],
    entries: ['Pièces comptables', 'Brouillons et pièces validées'],
    balance: ['Balance générale', 'Mouvements et soldes par compte'],
    journal: ['Journal des écritures', 'Écritures validées, par journal'],
    ledger: ['Grand livre', 'Mouvements et solde progressif par compte'],
    periods: ['Périodes comptables', 'Ouverture et clôture des exercices'],
    settings: ['Données & application', 'Sauvegarde, restauration et installation'],
    menu: ['Comptabilité générale', 'Menus et fonctions du dossier']
  };

  var ui = {
    accounts: { q: '', cls: '', nature: '' },
    entries: { q: '', status: '', journal: '' },
    balance: { cls: '', q: '' },
    journal: { journal: '', year: String(S.exercise()) },
    ledger: { account: '521100' },
    periods: { year: S.exercise() }
  };

  var deferredInstallPrompt = null;
  var exchangeImportSession = null;
  var balanceImportSession = null;
  var launcherUi = { filter: 'all', query: '' };
  var DEMO_ORGANIZATION_ID = 'demo-org';
  var ACCOUNTING_ROUTES = ['dossiers', 'dashboard', 'accounts', 'journals', 'entry', 'entries', 'balance', 'journal', 'ledger', 'periods', 'settings', 'menu'];
  var PHONE_REPORT_ROUTES = ['balance', 'journal', 'ledger'];
  var PHONE_BREAKPOINT = 700;
  var ACCESS_MODULES = [{ id: 'organization', name: 'Organisation & accès', status: 'available', route: 'organization', scopeable: false }].concat(ModuleRegistry.all());
  var demoMembers = [{ id: 'demo-supervisor', name: 'Compte superviseur (démo)', role: 'supervisor', organizationId: DEMO_ORGANIZATION_ID, grants: {} }];
  var activeDemoMemberId = 'demo-supervisor';
  var activeDemoDossierId = S.currentDossier().id;
  var demoMemberSequence = 0;

  function isPhoneViewport() {
    return !!(window.matchMedia && window.matchMedia('(max-width: ' + PHONE_BREAKPOINT + 'px)').matches);
  }

  function accountingMenuHash(groupId, tabId) {
    var group = AccountingNavigation.getGroup(groupId);
    var tab = AccountingNavigation.getTab(group.id, tabId || group.defaultTab);
    return '#/menu?g=' + encodeURIComponent(group.id) + '&t=' + encodeURIComponent(tab.id);
  }

  function accountingGroupForRoute(route) {
    var routeGroups = {
      accounts: 'definitions', journals: 'definitions',
      entry: 'saisie', entries: 'saisie',
      balance: 'editions', journal: 'editions', ledger: 'editions',
      periods: 'fin-exercice', settings: 'parametres'
    };
    return routeGroups[route] || '';
  }

  function getActiveDemoMember() {
    return demoMembers.find(function (member) { return member.id === activeDemoMemberId; }) || demoMembers[0] || null;
  }

  function demoGrantList(member, moduleId) {
    var grants = member && member.grants && member.grants[moduleId];
    if (Array.isArray(grants)) return grants;
    return grants && typeof grants === 'object' ? [grants] : [];
  }

  function demoAccessContext(scopeType, dossier) {
    dossier = dossier || null;
    return {
      organizationId: DEMO_ORGANIZATION_ID,
      scopeType: scopeType || 'organization',
      dossierId: dossier && dossier.id || null,
      dossierName: dossier && dossier.name || null,
      folderName: dossier && dossier.name || null
    };
  }

  function demoDossierById(dossierId) {
    return S.dossiers().find(function (dossier) { return dossier.id === dossierId; }) || null;
  }

  function accountingAccessContext(dossier) {
    var selected = dossier || (activeDemoDossierId ? demoDossierById(activeDemoDossierId) : null);
    return demoAccessContext('dossier', selected);
  }

  function permittedDemoDossiers(member) {
    return S.dossiers().filter(function (dossier) {
      return hasDemoPermission(member, 'accounting', 'module.view', accountingAccessContext(dossier));
    });
  }

  function ensureDemoDossierForMember(member) {
    var permitted = permittedDemoDossiers(member);
    var selected = permitted.find(function (dossier) { return dossier.id === activeDemoDossierId; }) || permitted[0] || null;
    if (!selected) {
      activeDemoDossierId = null;
      return permitted;
    }
    if (selected.id !== activeDemoDossierId) {
      var switched = S.switchDossier(selected.id);
      if (switched.ok) activeDemoDossierId = selected.id;
      else return [];
    }
    return permitted;
  }

  function hasDemoPermission(member, moduleId, actionId, context) {
    return Permissions.hasPermission(member, moduleId, actionId, context || demoAccessContext('organization'));
  }

  function demoActionRule(action, trigger) {
    switch (action) {
      case 'add-demo-member':
      case 'configure-demo-access':
      case 'remove-demo-member':
        return { moduleId: 'organization', actionId: 'organization.manageMembers' };
      case 'create-demo-dossier':
        return { moduleId: 'organization', actionId: 'organization.manageDossiers' };
      case 'open-dossier':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'open-module':
        return { moduleId: trigger && trigger.getAttribute('data-module-id'), actionId: 'module.view' };
      case 'open-entry':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'edit-draft':
        return { moduleId: 'accounting', actionId: 'draft.edit' };
      case 'delete-draft':
        return { moduleId: 'accounting', actionId: 'draft.delete' };
      case 'validate-entry':
        return { moduleId: 'accounting', actionId: 'entry.validate' };
      case 'new-account':
        return { moduleId: 'accounting', actionId: 'accounts.create' };
      case 'close-period':
        return { moduleId: 'accounting', actionId: 'period.close' };
      case 'open-period':
        return { moduleId: 'accounting', actionId: 'period.reopen' };
      case 'reset-data':
        return { moduleId: 'accounting', actionId: 'data.reset' };
      case 'restore-local-backup':
        return { moduleId: 'accounting', actionId: 'data.restore' };
      case 'commit-accounting-exchange-import':
      case 'commit-accounting-balance-import':
        return { moduleId: 'accounting', actionId: 'data.import' };
      case 'export-json':
      case 'export-accounts-csv':
      case 'export-balance-csv':
      case 'export-accounting-exchange':
      case 'export-accounting-workbook':
      case 'download-accounting-exchange-template':
      case 'download-accounting-workbook-template':
      case 'download-accounting-balance-template':
      case 'download-accounting-balance-workbook-template':
      case 'export-accounting-chart':
      case 'export-accounting-journals':
      case 'print':
        return { moduleId: 'accounting', actionId: 'data.export' };
      case 'add-line':
      case 'remove-line':
        return { moduleId: 'accounting', actionId: parseHash().params.id ? 'draft.edit' : 'draft.create' };
      default:
        return null;
    }
  }

  function canPerformDemoAction(action, trigger, shouldNotify) {
    var rule = demoActionRule(action, trigger);
    if (!rule) return true;
    var member = getActiveDemoMember();
    var selectedDossier = action === 'open-dossier' && trigger ? demoDossierById(trigger.getAttribute('data-id')) : null;
    var context = rule.moduleId === 'accounting'
      ? accountingAccessContext(selectedDossier || undefined)
      : demoAccessContext('organization');
    var allowed;
    if (action === 'open-module' && rule.moduleId === 'accounting') {
      allowed = permittedDemoDossiers(member).length > 0 || hasDemoPermission(member, 'organization', 'organization.manageDossiers', demoAccessContext('organization'));
    } else {
      allowed = !!rule.moduleId && !!context && hasDemoPermission(member, rule.moduleId, rule.actionId, context);
    }
    if (!allowed && shouldNotify !== false) {
      toast('Action refusée par défaut : le profil simulé ne possède pas le droit « ' + rule.actionId + ' ».', 'warning');
    }
    return allowed;
  }

  function applyDemoActionGates(root) {
    if (!root) return;
    $$('[data-action]', root).forEach(function (trigger) {
      var action = trigger.getAttribute('data-action');
      if (demoActionRule(action, trigger)) trigger.hidden = !canPerformDemoAction(action, trigger, false);
    });
    $$('a[href^="#/"]', root).forEach(function (link) {
      var hash = link.getAttribute('href') || '';
      var routePart = hash.replace(/^#\/?/, '').split('?')[0];
      var requirement = null;
      if (routePart === 'organization') requirement = { moduleId: 'organization', actionId: 'module.view' };
      else if (routePart === 'dossiers') {
        link.hidden = permittedDemoDossiers(getActiveDemoMember()).length === 0 &&
          !hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageDossiers', demoAccessContext('organization'));
        return;
      } else if (ACCOUNTING_ROUTES.indexOf(routePart) !== -1) requirement = { moduleId: 'accounting', actionId: 'module.view' };
      if (routePart === 'entry') {
        var hasId = /(?:^|[?&])id=/.test(hash);
        requirement = { moduleId: 'accounting', actionId: hasId ? 'draft.edit' : 'draft.create' };
      }
      if (requirement) {
        var context = requirement.moduleId === 'accounting' ? accountingAccessContext() : demoAccessContext('organization');
        link.hidden = !hasDemoPermission(getActiveDemoMember(), requirement.moduleId, requirement.actionId, context);
      }
    });
    var form = $('#entry-form', root);
    if (form) {
      var editing = !!form.getAttribute('data-entry-id');
      $$('[data-mode]', form).forEach(function (button) {
        var mode = button.getAttribute('data-mode');
        var actions = mode === 'posted'
          ? [editing ? 'draft.edit' : 'draft.create', 'entry.validate']
          : [editing ? 'draft.edit' : 'draft.create'];
        var context = accountingAccessContext();
        var allowed = actions.every(function (actionId) { return hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, context); });
        button.hidden = !allowed;
      });
    }
    var canManageOrganization = hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageMembers', demoAccessContext('organization'));
    $$('[data-demo-member-role]', root).forEach(function (select) { select.disabled = !canManageOrganization; });
    var canManageDossiers = hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageDossiers', demoAccessContext('organization'));
    var dossierForm = $('#dossier-create-form', root);
    if (dossierForm) dossierForm.hidden = !canManageDossiers;
    var importInput = $('#import-file', root);
    if (importInput) {
      var canImportData = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
      importInput.hidden = !canImportData;
      var importLabel = $('label[for="import-file"]', root);
      if (importLabel) importLabel.hidden = !canImportData;
    }
    var exchangeImportInput = $('#exchange-import-file', root);
    if (exchangeImportInput) {
      var canImportExchange = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
      exchangeImportInput.hidden = !canImportExchange;
      var exchangeImportLabel = $('#exchange-import-label', root);
      if (exchangeImportLabel) exchangeImportLabel.hidden = !canImportExchange;
    }
    var balanceImportInput = $('#balance-import-file', root);
    if (balanceImportInput) {
      var canImportBalance = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
      balanceImportInput.hidden = !canImportBalance;
      var balanceImportLabel = $('#balance-import-label', root);
      if (balanceImportLabel) balanceImportLabel.hidden = !canImportBalance;
    }
  }

  /* -------------------------------- Toasts --------------------------------- */
  function toast(message, type) {
    var region = $('#toast-region');
    if (!region) return;
    var node = document.createElement('div');
    node.className = 'toast ' + (type || 'success');
    node.setAttribute('role', 'status');
    node.innerHTML = '<span>' + esc(message) + '</span><button type="button" aria-label="Fermer la notification">✕</button>';
    node.querySelector('button').addEventListener('click', function () { node.remove(); });
    region.appendChild(node);
    window.setTimeout(function () {
      if (node.parentNode) node.remove();
    }, 4600);
  }

  /* -------------------------------- Modale --------------------------------- */
  var lastFocused = null;

  function openModal(title, subtitle, bodyHtml, footerHtml, wide) {
    closeModal(true);
    lastFocused = document.activeElement;
    var root = $('#modal-root');
    root.innerHTML =
      '<div class="modal-backdrop">' +
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style="' + (wide ? 'width:min(920px,100%)' : '') + '">' +
          '<div class="modal-header">' +
            '<div><h2 id="modal-title">' + esc(title) + '</h2>' + (subtitle ? '<p class="sub">' + subtitle + '</p>' : '') + '</div>' +
            '<button type="button" class="modal-close" data-action="close-modal" aria-label="Fermer">✕</button>' +
          '</div>' +
          '<div class="modal-body">' + bodyHtml + '</div>' +
          (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
        '</div>' +
      '</div>';
    applyDemoActionGates(root);
    var backdrop = $('.modal-backdrop', root);
    if (backdrop) {
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop) closeModal();
      });
    }
    var focusable = root.querySelector('button, [href], input, select, textarea');
    if (focusable) focusable.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal(silent) {
    var root = $('#modal-root');
    if (!root) return;
    if (root.innerHTML) root.innerHTML = '';
    document.body.style.overflow = '';
    if (!silent && lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  /* ------------------------------ Routage ---------------------------------- */
  function parseHash() {
    var raw = String(location.hash || '').replace(/^#\/?/, '');
    var parts = raw.split('?');
    var route = parts[0] || 'login';
    if (ROUTES.indexOf(route) === -1) route = 'login';
    var params = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (pair) {
        var kv = pair.split('=');
        params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return { route: route, params: params };
  }

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    var parsed = parseHash();
    var route = parsed.route;
    var phoneViewport = isPhoneViewport();
    var phoneRouteAllowed = route === 'dossiers' ||
      (route === 'menu' && parsed.params.g === 'editions') ||
      PHONE_REPORT_ROUTES.indexOf(route) !== -1;
    if (phoneViewport && ACCOUNTING_ROUTES.indexOf(route) !== -1 && !phoneRouteAllowed) {
      navigate(accountingMenuHash('editions', 'general-accounts'));
      return;
    }
    var view = $('#view');
    if (!view) return;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'import-balance')) balanceImportSession = null;

    var activeMember = getActiveDemoMember();
    var orgContext = demoAccessContext('organization');
    if (route === 'organization' && !hasDemoPermission(activeMember, 'organization', 'module.view', orgContext)) {
      toast('Accès refusé : aucun droit de consultation de l’organisation n’est accordé à ce profil.', 'warning');
      navigate('#/launcher');
      return;
    }
    if (route === 'dossiers') {
      var canOpenDossierList = permittedDemoDossiers(activeMember).length > 0 ||
        hasDemoPermission(activeMember, 'organization', 'organization.manageDossiers', orgContext);
      if (!canOpenDossierList) {
        toast('Aucun dossier client accessible n’est accordé à ce profil de démonstration.', 'warning');
        navigate('#/launcher');
        return;
      }
    } else if (ACCOUNTING_ROUTES.indexOf(route) !== -1 && !hasDemoPermission(activeMember, 'accounting', 'module.view', accountingAccessContext())) {
      toast('Aucun accès à la Comptabilité générale n’est accordé à ce profil de démonstration.', 'warning');
      navigate('#/dossiers');
      return;
    }
    if (route === 'entry') {
      var requiredEntryAction = parsed.params.id ? 'draft.edit' : 'draft.create';
      if (!hasDemoPermission(activeMember, 'accounting', requiredEntryAction, accountingAccessContext())) {
        toast('Ce profil ne possède pas le droit nécessaire pour cette saisie.', 'warning');
        navigate('#/launcher');
        return;
      }
    }

    closeModal(true);
    var launcherMode = route === 'login' || route === 'launcher' || route === 'organization';
    var selectedDossierMode = ACCOUNTING_ROUTES.indexOf(route) !== -1 && route !== 'dossiers';
    var dossiersListMode = route === 'dossiers';
    document.body.classList.toggle('launcher-mode', launcherMode);
    document.body.classList.toggle('dossiers-list-mode', dossiersListMode);
    document.body.classList.toggle('phone-editions-mode', phoneViewport && ACCOUNTING_ROUTES.indexOf(route) !== -1);

    var html = '';
    switch (route) {
      case 'login': html = viewLogin(); break;
      case 'launcher': html = viewLauncher(); break;
      case 'organization': html = viewOrganization(); break;
      case 'dossiers': html = viewDossiers(); break;
      case 'dashboard': html = viewDashboard(); break;
      case 'accounts': html = viewAccounts(); break;
      case 'journals': html = viewJournals(); break;
      case 'entry': html = viewEntryForm(parsed.params); break;
      case 'entries': html = viewEntries(); break;
      case 'balance': html = viewBalance(); break;
      case 'journal': html = viewJournal(); break;
      case 'ledger': html = viewLedger(); break;
      case 'periods': html = viewPeriods(); break;
      case 'settings': html = viewSettings(); break;
      case 'menu': html = viewAccountingMenu(parsed.params); break;
      default: html = viewLogin();
    }
    view.innerHTML = html;
    applyDemoActionGates(document);

    var folderIndicator = $('#active-folder-indicator');
    if (folderIndicator) {
      var inAccounting = ACCOUNTING_ROUTES.indexOf(route) !== -1;
      var activeDossier = S.currentDossier();
      var visibleDossierCount = route === 'dossiers' ? permittedDemoDossiers(activeMember).length : 0;
      folderIndicator.hidden = !inAccounting;
      folderIndicator.textContent = route === 'dossiers'
        ? 'DOSSIERS CLIENTS · ' + visibleDossierCount + (visibleDossierCount === 1 ? ' dossier visible' : ' dossiers visibles')
        : (inAccounting && activeDossier ? activeDossier.reference : '');
      folderIndicator.title = route === 'dossiers'
        ? 'Liste multi-dossiers accessible à ce profil de démonstration'
        : (inAccounting ? 'Dossier client isolé localement · ' + (activeDossier && activeDossier.name || '') : '');
    }
    var dossiersReturn = $('#dossier-list-return');
    if (dossiersReturn) dossiersReturn.hidden = !selectedDossierMode;
    var topbarEntry = $('a[href="#/entry"].btn.btn-primary');
    if (topbarEntry && route === 'dossiers') topbarEntry.hidden = true;

    var title = TITLES[route] || TITLES.login;
    if (route === 'menu') {
      var menuGroupForTitle = AccountingNavigation.getGroup(phoneViewport ? 'editions' : parsed.params.g);
      var menuTabForTitle = AccountingNavigation.getTab(menuGroupForTitle.id, parsed.params.t || menuGroupForTitle.defaultTab);
      title = [menuGroupForTitle.label, menuTabForTitle.label];
    }
    var pageTitle = $('#page-title');
    if (pageTitle) pageTitle.textContent = title[0];
    document.title = 'PERFECTO · ' + title[0];

    $$('[data-route]').forEach(function (link) {
      var active = link.getAttribute('data-route') === route;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    var selectedMenuGroup = route === 'menu'
      ? AccountingNavigation.getGroup(phoneViewport ? 'editions' : parsed.params.g).id
      : accountingGroupForRoute(route);
    $$('[data-menu-group]').forEach(function (link) {
      var active = link.getAttribute('data-menu-group') === selectedMenuGroup;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    $$('[data-mobile-edition]').forEach(function (link) {
      var target = link.getAttribute('data-mobile-edition');
      var active = target === 'menu'
        ? route === 'menu'
        : route === target;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    updateDraftBadge();
    bindView(route);
    closeSidebar();
  }

  function updateDraftBadge() {
    var badge = $('#draft-badge');
    if (!badge) return;
    var count = S.entries().filter(function (e) { return e.status === 'draft'; }).length;
    badge.textContent = String(count);
    badge.style.display = count ? '' : 'none';
  }

  function rerenderKeepFocus() {
    var active = document.activeElement;
    var id = active && active.id;
    var start = null;
    var end = null;
    try {
      if (active && typeof active.selectionStart === 'number') {
        start = active.selectionStart;
        end = active.selectionEnd;
      }
    } catch (err) { /* champs sans sélection */ }
    render();
    if (id) {
      var restored = document.getElementById(id);
      if (restored) {
        restored.focus();
        try {
          if (start !== null && typeof restored.setSelectionRange === 'function') {
            restored.setSelectionRange(start, end);
          }
        } catch (err) { /* ignore */ }
      }
    }
  }

  /* --------------------------- Fragments communs --------------------------- */
  function statusBadge(status) {
    return status === 'posted'
      ? '<span class="badge posted">Validée</span>'
      : '<span class="badge draft">Brouillon</span>';
  }

  function natureBadge(nature) {
    var cls = String(nature || '').toLowerCase();
    return '<span class="badge ' + esc(cls) + '">' + esc(nature) + '</span>';
  }

  function pageHeader(title, subtitle, actions, variant) {
    var variantClass = variant ? ' ' + esc(variant) : '';
    return '<div class="page-header' + variantClass + '">' +
      '<div class="page-header-copy">' +
        '<p class="page-kicker"><span class="page-kicker-rule" aria-hidden="true"></span> CABINET GOBEX · PERFECTO</p>' +
        '<h2>' + esc(title) + '</h2><p class="page-description">' + subtitle + '</p>' +
      '</div>' +
      (actions ? '<div class="page-header-actions">' + actions + '</div>' : '') +
      '</div>';
  }

  function viewLogin() {
    return `
      <div class="suite-screen login-screen">
        <header class="suite-header">
          <a class="suite-brand" href="#/login" aria-label="PERFECTO, accueil">
            <span class="suite-mark">P<span>.</span></span>
            <span class="suite-brand-copy"><strong>PERFECTO</strong><small>SUITE DE GESTION</small></span>
          </a>
          <div class="suite-header-note"><span class="suite-live-dot"></span>VERSION WEB · PROTOTYPE</div>
        </header>
        <main class="login-layout">
          <section class="login-intro">
            <p class="suite-kicker">L’ESPACE DE TRAVAIL DE VOTRE ORGANISATION</p>
            <h1>Une suite de gestion.<br><em>Un seul point d’entrée.</em></h1>
            <p class="login-lead">Retrouvez vos outils de gestion dans un environnement commun, organisé autour de votre organisation et de ses utilisateurs.</p>
            <div class="login-highlights">
              <div><span class="highlight-number">01</span><span><strong>Des modules réunis</strong><small>Comptabilité, RH, courriers, ventes et plus.</small></span></div>
              <div><span class="highlight-number">02</span><span><strong>Un espace organisationnel</strong><small>Les accès sont définis selon les rôles accordés.</small></span></div>
              <div><span class="highlight-number">03</span><span><strong>Vos données restent chez vous</strong><small>Le stockage cloud sera connecté après validation.</small></span></div>
            </div>
          </section>
          <section class="login-card" aria-labelledby="login-heading">
            <span class="login-card-label">ESPACE ORGANISATION</span>
            <h2 id="login-heading">Bienvenue</h2>
            <p class="login-card-copy">Choisis plus tard entre les deux méthodes prévues : e-mail et mot de passe, ou compte Google.</p>
            <div class="login-methods"><span class="login-methods-caption">MÉTHODES PRÉVUES · NON ACTIVES EN DÉMO</span><div><span>E-mail + mot de passe</span><span>Google</span></div></div>
            <div class="login-preview-field"><span>Adresse e-mail</span><span class="preview-placeholder">À configurer</span></div>
            <div class="login-preview-field"><span>Mot de passe</span><span class="preview-placeholder">Non demandé en démonstration</span></div>
            <button type="button" class="suite-primary-button" data-action="demo-login">Ouvrir la démonstration <span aria-hidden="true">→</span></button>
            <p class="prototype-note"><strong>Prototype uniquement.</strong> Aucun compte ni mot de passe n’est demandé, enregistré ou transmis.</p>
            <div class="login-card-divider"><span></span>PERFECTO<span></span></div>
          </section>
        </main>
        <footer class="suite-footer"><span>PERFECTO · SUITE DE GESTION</span><span>Connexion réelle et Google Drive à configurer ensemble</span></footer>
      </div>`;
  }

  function launcherModuleCard(module, index) {
    var available = module.status === 'available' && module.route;
    var moduleContext = module.id === 'accounting' ? accountingAccessContext() : demoAccessContext('organization');
    var activeMember = getActiveDemoMember();
    var permitted = available && (module.id === 'accounting'
      ? (permittedDemoDossiers(activeMember).length > 0 || hasDemoPermission(activeMember, 'organization', 'organization.manageDossiers', demoAccessContext('organization')))
      : hasDemoPermission(activeMember, module.id, 'module.view', moduleContext));
    var number = String(index + 1).padStart(2, '0');
    var action = permitted
      ? '<button type="button" class="module-open-button" data-action="open-module" data-module-id="' + esc(module.id) + '">Ouvrir le module <span aria-hidden="true">→</span></button>'
      : (available ? '<span class="module-disabled">Accès à attribuer</span>' : '<span class="module-disabled">Bientôt</span>');

    var searchText = [module.name, module.category, module.description].join(' ');
    return '<article class="module-card module-' + esc(module.accent) + '" data-module-card data-is-module="true" data-module-status="' + esc(module.status) + '" data-module-search="' + esc(searchText) + '">' +
      '<div class="module-card-top"><span>MODULE ' + number + '</span><span class="module-status ' + esc(module.status) + '"><i></i>' + esc(module.statusLabel) + '</span></div>' +
      '<div class="module-icon" aria-hidden="true">' + esc(module.icon) + '</div>' +
      '<p class="module-category">' + esc(module.category) + '</p>' +
      '<h3>' + esc(module.name) + '</h3>' +
      '<p class="module-description">' + esc(module.description) + '</p>' +
      '<div class="module-card-bottom"><span>' + esc(module.version) + '</span>' + action + '</div>' +
      '</article>';
  }

  function viewLauncher() {
    var modules = ModuleRegistry.all();
    var stats = ModuleRegistry.stats();
    var activeMember = getActiveDemoMember();
    var accessibleDossiers = ensureDemoDossierForMember(activeMember);
    var availableLabel = String(stats.available).padStart(2, '0');
    var availableText = stats.available === 1 ? 'disponible' : 'disponibles';
    var availableNoun = stats.available === 1 ? 'module disponible' : 'modules disponibles';
    var cards = modules.map(launcherModuleCard).join('');
    var profileOptions = demoMembers.map(function (member) {
      var selected = member.id === activeDemoMemberId ? ' selected' : '';
      return '<option value="' + esc(member.id) + '"' + selected + '>' + esc(demoRoleLabel(member.role) + ' · ' + member.name) + '</option>';
    }).join('');
    var folderControl = accessibleDossiers.length
      ? '<label class="demo-folder-switch"><span>DOSSIER CLIENT ACTIF</span><select id="demo-active-folder" aria-label="Choisir un dossier client actif">' + accessibleDossiers.map(function (dossier) {
          return '<option value="' + esc(dossier.id) + '"' + (dossier.id === activeDemoDossierId ? ' selected' : '') + '>' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</option>';
        }).join('') + '</select></label>'
      : '<span class="demo-folder-unavailable">Aucun dossier client autorisé</span>';
    var organizationControl = hasDemoPermission(activeMember, 'organization', 'module.view', demoAccessContext('organization'))
      ? '<a class="org-manage-link" href="#/organization">Organisation &amp; accès <span aria-hidden="true">→</span></a>'
      : '<span class="org-manage-disabled" title="Aucun droit de consultation accordé à ce profil">Organisation &amp; accès · accès non accordé</span>';

    return `
      <div class="suite-screen launcher-screen">
        <header class="suite-header launcher-header">
          <a class="suite-brand" href="#/launcher" aria-label="PERFECTO, launcher">
            <span class="suite-mark">P<span>.</span></span>
            <span class="suite-brand-copy"><strong>PERFECTO</strong><small>SUITE DE GESTION</small></span>
          </a>
          <div class="launcher-nav"><span class="launcher-nav-active">LANCEUR</span><span>ESPACE DE TRAVAIL</span></div>
          <button type="button" class="launcher-icon-button" data-action="launcher-info" aria-label="État du stockage" title="État du stockage">☁</button>
        </header>
        <main class="launcher-main">
          <div class="workspace-strip">
            <div><span class="workspace-caption">ORGANISATION</span><strong>Organisation de démonstration</strong></div>
            <span class="role-chip">${esc(demoRoleLabel(activeMember.role).toUpperCase())} · DÉMO</span>
            ${folderControl}
            <label class="demo-profile-switch"><span>PROFIL SIMULÉ</span><select id="demo-active-profile" aria-label="Choisir un profil de démonstration">${profileOptions}</select></label>
            ${organizationControl}
            <button type="button" class="drive-status" data-action="launcher-info"><span class="drive-status-dot"></span>Google Drive <b>À connecter</b></button>
          </div>
          <section class="launcher-heading">
            <div><p class="suite-kicker">VOTRE ESPACE DE TRAVAIL</p><h1>Vos applications</h1><p>Ouvrez un module accordé au profil simulé. Les accès non accordés sont refusés par défaut.</p></div>
            <div class="launcher-count"><strong>${availableLabel}</strong><span>${availableNoun}<br>sur ${String(stats.total).padStart(2, '0')} annoncés</span></div>
          </section>
          <div class="launcher-section-heading"><h2>Modules PERFECTO</h2><span>${stats.total} modules · ${stats.available} ${availableText}</span></div>
          <div class="launcher-tools">
            <div class="launcher-filters" role="group" aria-label="Filtrer les modules">
              <button type="button" class="launcher-filter is-active" data-action="launcher-filter" data-filter-value="all" aria-pressed="true">Tous <span>${String(stats.total).padStart(2, '0')}</span></button>
              <button type="button" class="launcher-filter" data-action="launcher-filter" data-filter-value="available" aria-pressed="false">Disponibles <span>${String(stats.available).padStart(2, '0')}</span></button>
              <button type="button" class="launcher-filter" data-action="launcher-filter" data-filter-value="planned" aria-pressed="false">À venir <span>${String(stats.planned).padStart(2, '0')}</span></button>
            </div>
            <label class="launcher-search"><span aria-hidden="true">⌕</span><span class="sr-only">Rechercher un module</span><input id="launcher-search" type="search" placeholder="Rechercher un module…" value="${esc(launcherUi.query)}" autocomplete="off"></label>
          </div>
          <p class="launcher-result-count" id="launcher-result-count" aria-live="polite"></p>
          <div class="launcher-grid">
            ${cards}
            <article class="module-card module-future" data-module-card data-is-module="false" data-module-status="future" data-module-search="d’autres modules suite évolutive besoins organisation">
              <div class="module-card-top"><span>SUITE ÉVOLUTIVE</span><span class="module-status flexible"><i></i>ÉVOLUTIF</span></div>
              <div class="module-icon" aria-hidden="true">＋</div><p class="module-category">SELON VOS BESOINS</p><h3>D’autres modules</h3>
              <p class="module-description">La suite pourra accueillir de nouveaux modules au fil des besoins de votre organisation.</p>
              <div class="module-card-bottom"><span>Architecture modulaire</span><span class="module-disabled">À définir</span></div>
            </article>
          </div>
          <p class="launcher-empty-state" id="launcher-empty-state" hidden>Aucun module ne correspond à cette recherche ou à ce filtre.</p>
          <div class="launcher-notice"><span class="launcher-notice-icon">i</span><span>Profil simulé uniquement : les contrôles d’accès servent à valider la logique et ne remplacent pas une authentification ou une sécurité serveur.</span></div>
        </main>
        <footer class="suite-footer launcher-footer"><span>PERFECTO · ESPACE DE DÉMONSTRATION</span><button type="button" data-action="logout-demo">Retour à l’écran de connexion</button></footer>
      </div>`;
  }

  function demoRoleLabel(role) {
    if (role === 'supervisor') return 'Superviseur général';
    if (role === 'manager') return 'Gestionnaire';
    return 'Utilisateur / employé';
  }

  function demoMemberRow(member) {
    var isSupervisor = member.role === 'supervisor';
    var roleControl = isSupervisor
      ? '<span class="member-role-static">Superviseur général · racine</span>'
      : '<label class="sr-only" for="demo-role-' + esc(member.id) + '">Rôle de ' + esc(member.name) + '</label>' +
        '<select id="demo-role-' + esc(member.id) + '" data-demo-member-role data-id="' + esc(member.id) + '">' +
          '<option value="manager"' + (member.role === 'manager' ? ' selected' : '') + '>Gestionnaire</option>' +
          '<option value="employee"' + (member.role === 'employee' ? ' selected' : '') + '>Utilisateur / employé</option>' +
        '</select>';
    var memberActions = isSupervisor
      ? '<span class="member-root-note">Administration racine</span>'
      : '<button type="button" class="member-configure-button" data-action="configure-demo-access" data-id="' + esc(member.id) + '">Droits</button>' +
        '<button type="button" class="member-remove-button" data-action="remove-demo-member" data-id="' + esc(member.id) + '">Retirer</button>';
    var configured = ACCESS_MODULES.filter(function (module) {
      return demoGrantList(member, module.id).some(function (grant) {
        return grant && Array.isArray(grant.actions) && grant.actions.length > 0;
      });
    }).length;
    var dossierScopes = ACCESS_MODULES.reduce(function (count, module) {
      return count + demoGrantList(member, module.id).filter(function (grant) {
        return grant && grant.scope && (grant.scope.type === 'dossier' || grant.scope.type === 'folder') &&
          ((Array.isArray(grant.scope.dossiers) && grant.scope.dossiers.length) || (Array.isArray(grant.scope.folders) && grant.scope.folders.length));
      }).length;
    }, 0);
    var initials = member.role === 'supervisor' ? 'SG' : (member.role === 'manager' ? 'G' : 'U');

    return '<div class="organization-member-row">' +
      '<div class="member-identity"><span class="member-avatar ' + (isSupervisor ? 'is-root' : '') + '">' + initials + '</span><span><strong>' + esc(member.name) + '</strong><small>Profil temporaire de démonstration · aucune connexion réelle</small></span></div>' +
      '<div class="member-role-control">' + roleControl + '</div>' +
      '<div class="member-access-status"><span>DROITS EXPLICITES · DÉMO</span><strong>' + configured + ' / ' + ACCESS_MODULES.length + ' module(s) · ' + dossierScopes + ' portée(s) dossier</strong></div>' +
      '<div class="member-row-action">' + memberActions + '</div>' +
      '</div>';
  }

  function dossierComplementaryDetails(dossier) {
    var details = [
      { label: 'Adresse', value: dossier.address },
      { label: 'N° IFU', value: dossier.ifu },
      { label: 'N° RCCM', value: dossier.rccm },
      { label: 'Email', value: dossier.email },
      { label: 'N° Tel', value: dossier.phone }
    ].filter(function (item) { return String(item.value || '').trim(); });
    if (!details.length) return '';
    return '<div class="dossier-card-details"><p>INFORMATIONS COMPLÉMENTAIRES</p><dl>' +
      details.map(function (item) {
        return '<div class="dossier-card-detail"><dt>' + esc(item.label) + '</dt><dd>' + esc(item.value) + '</dd></div>';
      }).join('') +
      '</dl></div>';
  }

  function dossierCard(dossier) {
    return '<article class="client-dossier-card">' +
      '<div class="dossier-card-top"><span class="dossier-type-label">' + esc(dossier.accountingTypeLabel) + '</span><span class="dossier-local-tag"><i></i>LOCAL · DÉMO</span></div>' +
      '<div class="dossier-card-identity"><div class="dossier-client-mark" aria-hidden="true">' + esc((dossier.clientCode || 'D').slice(0, 1)) + '</div><div><h3>' + esc(dossier.clientName || dossier.name) + '</h3><span class="dossier-reference">' + esc(dossier.reference) + '</span></div></div>' +
      '<div class="dossier-card-cycle"><span>EXERCICE ' + esc(dossier.exerciseYear) + '</span><strong>' + dateLabel(dossier.cycleStart) + ' <i>→</i> ' + dateLabel(dossier.cycleEnd) + '</strong></div>' +
      dossierComplementaryDetails(dossier) +
      '<div class="dossier-card-foot"><span>Code dossier <strong>' + esc(dossier.clientCode) + '</strong></span><button type="button" class="btn btn-primary btn-sm" data-action="open-dossier" data-id="' + esc(dossier.id) + '">Ouvrir le dossier <span aria-hidden="true">→</span></button></div>' +
      '</article>';
  }

  function viewDossiers() {
    var member = getActiveDemoMember();
    var accessible = permittedDemoDossiers(member);
    var mobileReadOnly = isPhoneViewport();
    var canCreate = !mobileReadOnly && hasDemoPermission(member, 'organization', 'organization.manageDossiers', demoAccessContext('organization'));
    var html = pageHeader(
      'Dossiers clients',
      'Sélectionnez une entreprise cliente pour ouvrir sa comptabilité. Chaque dossier conserve ses propres données et son cycle comptable.',
      '<a class="btn btn-ghost" href="#/launcher">← Modules</a>',
      'dossiers-page-header'
    );
    html += '<div class="dossiers-summary"><div><span class="dossiers-summary-icon" aria-hidden="true">▰</span><span><strong>' + accessible.length + ' dossier' + (accessible.length === 1 ? '' : 's') + ' accessible' + (accessible.length === 1 ? '' : 's') + '</strong><small>Accès évalué par le profil simulé</small></span></div><span class="dossiers-demo-note">Données locales · aucune synchronisation</span></div>';
    html += '<section class="dossiers-section"><div class="dossiers-section-heading"><div><p class="page-kicker">COMPTABILITÉ GÉNÉRALE</p><h3>Vos entreprises clientes</h3></div><span>' + accessible.length + ' résultat' + (accessible.length === 1 ? '' : 's') + '</span></div>';
    html += accessible.length
      ? '<div class="client-dossier-grid">' + accessible.map(dossierCard).join('') + '</div>'
      : '<div class="dossiers-empty"><span aria-hidden="true">▰</span><strong>Aucun dossier client visible</strong><p>Un accès explicite à un dossier doit être accordé à ce profil, ou un dossier peut être créé par un profil autorisé.</p></div>';
    html += '</section>';
    if (canCreate) {
      var currentYear = Number(S.todayIso().slice(0, 4)) || S.exercise();
      html += '<section class="dossier-create-panel"><div class="dossier-create-heading"><div><p class="page-kicker">NOUVEAU CLIENT</p><h3>Créer un dossier client</h3><p>Enregistrez l’entreprise, le type de comptabilité et son exercice.</p></div><span class="dossier-create-icon" aria-hidden="true">＋</span></div>' +
        '<form id="dossier-create-form" class="dossier-create-form" novalidate>' +
          '<div class="dossier-form-grid">' +
            '<div class="field dossier-field-wide"><label for="dossier-client-name">Entreprise cliente <span aria-hidden="true">*</span></label><input id="dossier-client-name" name="clientName" type="text" maxlength="120" placeholder="Ex. Cabinet Godwin" autocomplete="organization" required></div>' +
            '<div class="field"><label for="dossier-client-code">Code du dossier <span aria-hidden="true">*</span></label><input id="dossier-client-code" name="clientCode" type="text" maxlength="8" minlength="2" placeholder="Ex. GOD" required><span class="hint">Code saisi librement, de 2 à 8 caractères.</span></div>' +
            '<div class="field"><label for="dossier-type-label">Type de comptabilité <span aria-hidden="true">*</span></label><input id="dossier-type-label" name="accountingTypeLabel" type="text" maxlength="80" value="Comptabilité révisée SYSCOHADA" required></div>' +
            '<div class="field"><label for="dossier-type-code">Code du type</label><input id="dossier-type-code" name="accountingTypeCode" type="text" minlength="2" maxlength="6" value="COR" required><span class="hint">Ex. COR pour comptabilité révisée.</span></div>' +
            '<div class="field"><label for="dossier-cycle-start">Début du cycle <span aria-hidden="true">*</span></label><input id="dossier-cycle-start" name="cycleStart" type="date" value="' + currentYear + '-01-01" required></div>' +
            '<div class="field"><label for="dossier-cycle-end">Fin du cycle <span aria-hidden="true">*</span></label><input id="dossier-cycle-end" name="cycleEnd" type="date" value="' + currentYear + '-12-31" required></div>' +
            '<div class="dossier-form-subheading dossier-field-wide"><h4>Informations complémentaires</h4><span>FACULTATIVES</span></div>' +
            '<div class="field dossier-field-wide"><label for="dossier-address">Adresse</label><textarea id="dossier-address" name="address" rows="2" autocomplete="street-address" placeholder="Adresse de l’entreprise cliente"></textarea></div>' +
            '<div class="field"><label for="dossier-ifu">N° IFU</label><input id="dossier-ifu" name="ifu" type="text" maxlength="40" placeholder="Identifiant fiscal unique" autocomplete="off"></div>' +
            '<div class="field"><label for="dossier-rccm">N° RCCM</label><input id="dossier-rccm" name="rccm" type="text" maxlength="60" placeholder="Registre du commerce" autocomplete="off"></div>' +
            '<div class="field"><label for="dossier-email">Email</label><input id="dossier-email" name="email" type="email" maxlength="254" placeholder="contact@entreprise.bj" autocomplete="email"></div>' +
            '<div class="field"><label for="dossier-phone">N° Tel</label><input id="dossier-phone" name="phone" type="tel" maxlength="40" placeholder="+229 …" autocomplete="tel"></div>' +
          '</div>' +
          '<div class="dossier-reference-preview" id="dossier-reference-preview" aria-live="polite"></div>' +
          '<div class="dossier-create-footer"><p>La création n’effectue aucune copie. Le cycle est géré par périodes mensuelles dans ce prototype.</p><button type="submit" class="btn btn-primary" data-action="create-demo-dossier">＋ Créer le dossier</button></div>' +
        '</form></section>';
    } else {
      html += '<div class="dossier-create-restricted"><span>i</span><p>' + (mobileReadOnly
        ? 'Sur téléphone, PERFECTO est limité à la consultation des éditions. La création de dossiers se fait sur ordinateur ou tablette.'
        : 'La création d’un dossier client n’est pas accordée à ce profil de démonstration.') + '</p></div>';
    }
    html += '<p class="dossiers-storage-footnote">Ce prototype conserve les données dans le navigateur de cet appareil. Il ne se connecte ni à Google Drive ni à un service cloud.</p>';
    return html;
  }

  function bindDossiersView() {
    var form = $('#dossier-create-form');
    if (!form) return;
    var nameInput = $('#dossier-client-name', form);
    var codeInput = $('#dossier-client-code', form);
    var typeCodeInput = $('#dossier-type-code', form);
    var startInput = $('#dossier-cycle-start', form);
    var preview = $('#dossier-reference-preview');
    function updateReferencePreview() {
      var clientCode = String(codeInput.value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      var typeCode = String(typeCodeInput.value || 'COR').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      var exerciseYear = String(startInput.value || '').slice(0, 4) || String(S.exercise());
      if (!clientCode) {
        preview.textContent = 'La référence sera calculée après saisie du code dossier et de l’exercice.';
        return;
      }
      var reference = (typeCode || 'COR') + '-' + clientCode + exerciseYear;
      preview.innerHTML = 'Référence proposée <strong>' + esc(reference) + '</strong> · elle pourra être créée si elle est unique.';
    }
    [nameInput, codeInput].forEach(function (input) { input.addEventListener('input', updateReferencePreview); });
    [typeCodeInput, startInput].forEach(function (input) { input.addEventListener('input', updateReferencePreview); input.addEventListener('change', updateReferencePreview); });
    updateReferencePreview();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageDossiers', demoAccessContext('organization'))) {
        toast('Création refusée : ce profil ne possède pas le droit de créer des dossiers clients.', 'warning');
        return;
      }
      var result = S.createDossier({
        clientName: nameInput.value,
        clientCode: codeInput.value,
        accountingTypeLabel: $('#dossier-type-label', form).value,
        accountingTypeCode: typeCodeInput.value,
        cycleStart: startInput.value,
        cycleEnd: $('#dossier-cycle-end', form).value,
        address: $('#dossier-address', form).value,
        ifu: $('#dossier-ifu', form).value,
        rccm: $('#dossier-rccm', form).value,
        email: $('#dossier-email', form).value,
        phone: $('#dossier-phone', form).value
      });
      if (!result.ok) { toast(result.errors[0] || 'Création du dossier impossible.', 'warning'); return; }
      toast('Dossier « ' + result.dossier.clientName + ' » créé sous la référence ' + result.dossier.reference + '.', 'success');
      render();
    });
  }

  function viewOrganization() {
    var modules = ACCESS_MODULES;
    var managers = demoMembers.filter(function (member) { return member.role === 'manager'; }).length;
    var employees = demoMembers.filter(function (member) { return member.role === 'employee'; }).length;
    var memberRows = demoMembers.map(demoMemberRow).join('');
    var activeMember = getActiveDemoMember();
    var visibleDossiers = permittedDemoDossiers(activeMember);
    var dossierRows = visibleDossiers.map(function (dossier) {
      var active = dossier.id === activeDemoDossierId;
      return '<div class="demo-folder-row"><span class="demo-folder-icon" aria-hidden="true">▰</span><span><strong>' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</strong><small>' + esc(dossier.accountingTypeLabel) + ' · ' + dateLabel(dossier.cycleStart) + ' au ' + dateLabel(dossier.cycleEnd) + (dossier.seeded ? ' · données historiques conservées' : ' · données isolées') + '</small></span><span class="demo-folder-status' + (active ? ' is-active' : '') + '">' + (active ? 'Actif' : 'Visible') + '</span></div>';
    }).join('');
    var rows = modules.map(function (module) {
      var availability = module.status === 'available' ? 'Disponible en démo' : 'À venir';
      return '<tr>' +
        '<th scope="row"><strong>' + esc(module.name) + '</strong><small>' + esc(availability) + '</small></th>' +
        '<td><span class="permission-root">Administration de l’organisation</span></td>' +
        '<td><span class="permission-explicit">Aucun implicite · par personne</span></td>' +
        '<td><span class="permission-explicit">Aucun implicite · par personne</span></td>' +
        '</tr>';
    }).join('');

    return `
      <div class="suite-screen organization-screen">
        <header class="suite-header launcher-header">
          <a class="suite-brand" href="#/launcher" aria-label="Retour au launcher PERFECTO">
            <span class="suite-mark">P<span>.</span></span>
            <span class="suite-brand-copy"><strong>PERFECTO</strong><small>SUITE DE GESTION</small></span>
          </a>
          <div class="launcher-nav"><span class="launcher-nav-active">ORGANISATION &amp; ACCÈS</span></div>
          <a class="org-back-link" href="#/launcher">← Retour aux modules</a>
        </header>
        <main class="organization-main">
          <section class="organization-heading">
            <div><p class="suite-kicker">ESPACE DE TRAVAIL · DÉMONSTRATION</p><h1>Organisation &amp; accès</h1><p>Profils temporaires de démonstration : refus par défaut, administration par le Superviseur général et droits explicites par personne, module, périmètre et action.</p></div>
          </section>
          <div class="organization-summary-grid">
            <article class="organization-panel organization-identity">
              <div class="organization-panel-kicker">ESPACE ORGANISATIONNEL</div>
              <h2>Organisation de démonstration</h2>
              <p>L’espace cloud est destiné à appartenir à l’organisation, même si elle ne compte qu’une seule personne.</p>
              <div class="organization-facts"><span>FOURNISSEUR INITIAL</span><strong>Google Drive · non connecté</strong></div>
            </article>
            <article class="organization-panel organization-structure">
              <div class="organization-panel-kicker">HIÉRARCHIE CONFIRMÉE</div>
              <div class="role-level"><span class="role-level-number">01</span><div><strong>Superviseur général</strong><small>Au niveau racine de l’organisation</small></div></div>
              <div class="role-connector" aria-hidden="true"></div>
              <div class="role-level"><span class="role-level-number">02</span><div><strong>Gestionnaire(s)</strong><small>Rattachés à l’organisation</small></div></div>
              <div class="role-connector" aria-hidden="true"></div>
              <div class="role-level"><span class="role-level-number">03</span><div><strong>Utilisateurs / employés</strong><small>Accès selon l’affiliation et les droits accordés</small></div></div>
            </article>
          </div>
          <section class="organization-panel demo-folders-panel">
            <div class="members-heading"><div><div class="organization-panel-kicker">ENTREPRISES CLIENTES · DÉMO</div><h2>Dossiers clients</h2><p>Chaque entreprise dispose de son type de comptabilité, de son cycle et de ses données locales isolées.</p></div><span class="permission-pending">${visibleDossiers.length} dossier(s) visible(s)</span></div>
            <div class="demo-folder-list">${dossierRows || '<p class="small muted">Aucun dossier client n’est visible pour ce profil.</p>'}</div>
            <div class="organization-dossier-footer"><p class="small muted">Ces données ne sont pas des répertoires Google Drive : aucune synchronisation ni sécurité serveur n’est activée.</p><a class="btn btn-ghost btn-sm" href="#/dossiers">Ouvrir la liste des dossiers <span aria-hidden="true">→</span></a></div>
          </section>
          <section class="organization-panel members-panel">
            <div class="members-heading">
              <div><div class="organization-panel-kicker">PROFILS DE DÉMONSTRATION</div><h2>Membres de l’organisation</h2><p>${demoMembers.length} profil(s) · ${managers} gestionnaire(s) · ${employees} utilisateur(s)/employé(s)</p></div>
              <button type="button" class="btn btn-primary btn-sm" data-action="add-demo-member">＋ Ajouter un profil démo</button>
            </div>
            <div class="members-list">${memberRows}</div>
            <p class="members-demo-note">Ces profils sont temporaires et restent en mémoire jusqu’au rechargement de la page. Aucun e-mail n’est demandé, aucun compte n’est créé et aucune invitation n’est envoyée.</p>
          </section>
          <section class="organization-panel access-design-panel">
            <div class="access-design-heading"><div><div class="organization-panel-kicker">POLITIQUE APPROUVÉE</div><h2>Règles d’accès de la démo</h2><p>Le profil de chaque gestionnaire ou employé se règle avec « Droits ». Aucun droit n’est hérité de son rôle ; le vocabulaire des actions reste à co-concevoir.</p></div><span class="permission-pending">REFUS PAR DÉFAUT</span></div>
            <div class="organization-table-wrap">
              <table class="organization-access-table">
                <thead><tr><th scope="col">Module</th><th scope="col">Superviseur général</th><th scope="col">Gestionnaire</th><th scope="col">Utilisateur / employé</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <div class="access-scope-note"><span class="launcher-notice-icon">i</span><p>Les droits sont évalués côté client pour éprouver les parcours. Ils ne protègent pas les données et ne sont liés ni à une authentification réelle ni à Google Drive.</p></div>
          </section>
        </main>
        <footer class="suite-footer launcher-footer"><span>PERFECTO · ESPACE DE DÉMONSTRATION</span><span>Authentification et droits réels à implémenter après validation</span></footer>
      </div>`;
  }

  function openDemoMemberModal() {
    var body = '<form id="demo-member-form" novalidate>' +
      '<div class="alert info">Prototype uniquement : ce profil temporaire ne crée pas de compte et n’envoie pas d’invitation.</div>' +
      '<div class="field"><label for="demo-member-role">Rôle à prévisualiser</label>' +
        '<select id="demo-member-role" name="role"><option value="manager">Gestionnaire</option><option value="employee">Utilisateur / employé</option></select></div>' +
      '<p class="small muted">Le nouveau profil commence sans droit. Le Superviseur général peut attribuer explicitement ses actions et périmètres dans l’éditeur.</p>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="demo-member-form">Ajouter le profil démo</button>';
    openModal('Ajouter un profil de démonstration', 'Aucune donnée réelle ne sera demandée.', body, footer);

    var form = $('#demo-member-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageMembers', demoAccessContext('organization'))) {
        toast('Ajout refusé par défaut : le droit de gestion des membres n’est pas accordé.', 'warning');
        return;
      }
      var role = $('#demo-member-role').value === 'manager' ? 'manager' : 'employee';
      demoMemberSequence += 1;
      demoMembers.push({
        id: 'demo-member-' + demoMemberSequence,
        name: 'Profil de démonstration ' + demoMemberSequence,
        role: role,
        organizationId: DEMO_ORGANIZATION_ID,
        grants: {}
      });
      closeModal(true);
      toast('Profil temporaire ajouté. Aucune invitation n’a été envoyée.', 'success');
      render();
    });
  }

  function demoPermissionGrantRow(module, grant, grantIndex) {
    grant = grant || { scope: { type: 'organization', dossiers: [] }, actions: [] };
    var priorScope = grant.scope && grant.scope.type;
    var scopeType = module.scopeable === false ? 'organization' : (priorScope === 'dossier' || priorScope === 'folder' ? 'dossier' : 'organization');
    var selectedDossiers = grant.scope && Array.isArray(grant.scope.dossiers) ? grant.scope.dossiers : (grant.scope && Array.isArray(grant.scope.folders) ? grant.scope.folders : []);
    var scopeOptions = '<option value="organization"' + (scopeType === 'organization' ? ' selected' : '') + '>Organisation entière</option>';
    if (module.scopeable !== false) scopeOptions += '<option value="dossier"' + (scopeType === 'dossier' ? ' selected' : '') + '>Dossier(s) client(s) précis</option>';
    var dossierList = S.dossiers();
    var dossierOptions = dossierList.map(function (dossier) {
      var selected = selectedDossiers.some(function (value) {
        return String(value) === String(dossier.id) || String(value).trim().toLocaleLowerCase() === dossier.name.trim().toLocaleLowerCase();
      });
      return '<option value="' + esc(dossier.id) + '"' + (selected ? ' selected' : '') + '>' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</option>';
    }).join('');
    var dossierField = module.scopeable === false ? '' :
      '<div class="field demo-folder-field" data-demo-dossier-field="' + esc(module.id) + '" data-demo-dossier-index="' + grantIndex + '"' + (scopeType === 'dossier' ? '' : ' hidden') + '>' +
        '<label for="demo-dossiers-' + esc(module.id) + '-' + grantIndex + '">Dossier(s) client(s)</label>' +
        '<select id="demo-dossiers-' + esc(module.id) + '-' + grantIndex + '" data-demo-dossier-ids="' + esc(module.id) + '" data-demo-dossier-index="' + grantIndex + '" multiple size="' + Math.max(2, Math.min(5, dossierList.length)) + '">' + dossierOptions + '</select>' +
        '<span class="hint">Ctrl/Cmd + clic pour sélectionner plusieurs entreprises clientes.</span></div>';
    var actions = Permissions.actionsForModule(module.id).map(function (action) {
      var checked = Array.isArray(grant.actions) && grant.actions.indexOf(action.id) !== -1;
      return '<label class="demo-action-choice"><input type="checkbox" data-demo-action-module="' + esc(module.id) + '" data-demo-action-index="' + grantIndex + '" data-demo-action-id="' + esc(action.id) + '"' + (checked ? ' checked' : '') + '><span>' + esc(action.label) + '</span></label>';
    }).join('');
    return '<section class="demo-scope-grant" data-demo-grant-row data-demo-grant-module="' + esc(module.id) + '" data-demo-grant-index="' + grantIndex + '">' +
      '<div class="demo-scope-grant-heading"><strong>Portée ' + (grantIndex + 1) + '</strong><button type="button" class="demo-grant-remove" data-demo-remove-grant="' + esc(module.id) + '" data-demo-grant-index="' + grantIndex + '">Retirer</button></div>' +
      '<div class="field"><label for="demo-scope-' + esc(module.id) + '-' + grantIndex + '">Périmètre</label><select id="demo-scope-' + esc(module.id) + '-' + grantIndex + '" data-demo-scope-module="' + esc(module.id) + '" data-demo-scope-index="' + grantIndex + '">' + scopeOptions + '</select></div>' +
      dossierField +
      '<fieldset class="demo-actions-fieldset"><legend>Actions proposées à accorder</legend><div class="demo-actions-grid">' + actions + '</div></fieldset>' +
      '</section>';
  }

  function updateDemoGrantModuleState(moduleId, scopeable) {
    var list = $('[data-demo-grant-list="' + moduleId + '"]');
    if (!list) return;
    var rows = $$('[data-demo-grant-row]', list);
    var count = rows.length;
    var totalActions = rows.reduce(function (sum, row) { return sum + $$('input[type="checkbox"]:checked', row).length; }, 0);
    var empty = $('[data-demo-no-grants="' + moduleId + '"]');
    var addButton = $('[data-demo-add-grant="' + moduleId + '"]');
    var status = $('[data-demo-module-count="' + moduleId + '"]');
    if (empty) empty.hidden = count > 0;
    if (addButton) addButton.disabled = scopeable === false && count > 0;
    if (status) status.textContent = count ? count + ' portée(s) · ' + totalActions + ' droit(s)' : 'À définir';
  }

  function openDemoAccessModal(memberId) {
    var member = demoMembers.find(function (item) { return item.id === memberId; });
    if (!member) return;
    var modules = ACCESS_MODULES;
    var moduleRows = modules.map(function (module, moduleIndex) {
      var grants = demoGrantList(member, module.id);
      var grantRows = grants.map(function (grant, grantIndex) {
        return demoPermissionGrantRow(module, grant, grantIndex);
      }).join('');
      var totalActions = grants.reduce(function (count, grant) {
        return count + (grant && Array.isArray(grant.actions) ? grant.actions.length : 0);
      }, 0);
      var status = grants.length ? grants.length + ' portée(s) · ' + totalActions + ' droit(s)' : 'À définir';
      var addDisabled = module.scopeable === false && grants.length ? ' disabled' : '';
      return '<details class="demo-module-permission"' + (moduleIndex === 0 ? ' open' : '') + '>' +
        '<summary><span><strong>' + esc(module.name) + '</strong><small>' + (module.id === 'organization' ? 'Gestion de l’organisation de démonstration' : esc(module.status === 'available' ? 'Disponible en démo' : 'Module à venir')) + '</small></span><span class="permission-pending" data-demo-module-count="' + esc(module.id) + '">' + status + '</span></summary>' +
        '<div class="demo-module-permission-body">' +
          '<p class="demo-no-grants" data-demo-no-grants="' + esc(module.id) + '"' + (grants.length ? ' hidden' : '') + '>Aucun droit explicite dans ce module.</p>' +
          '<div class="demo-grants-list" data-demo-grant-list="' + esc(module.id) + '" data-demo-next-grant-index="' + grants.length + '">' + grantRows + '</div>' +
          '<button type="button" class="demo-grant-add" data-demo-add-grant="' + esc(module.id) + '"' + addDisabled + '>＋ Ajouter une portée</button>' +
          (module.scopeable === false ? '<span class="hint">Ce module s’applique à l’organisation entière.</span>' : '') +
        '</div>' +
      '</details>';
    }).join('');
    var body = '<form id="demo-access-form" novalidate>' +
      '<div class="alert info">Refus par défaut. Les grants d’un même module se cumulent ; pour chaque portée, une action métier exige aussi « Consulter le module ».</div>' +
      '<div class="demo-access-list"><div class="demo-access-list-heading"><strong>Droits de ' + esc(member.name) + '</strong><span>PROPOSITION DE DÉMO</span></div>' + moduleRows + '</div>' +
      '<p class="small muted">Le vocabulaire et les effets métier des actions restent à valider. Plusieurs portées peuvent définir des actions différentes. En démo locale, les données sont isolées par dossier sur cet appareil ; aucun partage cloud n’est actif.</p>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="demo-access-form">Enregistrer en démo</button>';
    openModal('Droits de démonstration', demoRoleLabel(member.role) + ' · ' + member.name, body, footer, true);

    var form = $('#demo-access-form');
    $$('[data-demo-scope-module]', form).forEach(function (select) {
      select.addEventListener('change', function () {
        var moduleId = select.getAttribute('data-demo-scope-module');
        var grantIndex = select.getAttribute('data-demo-scope-index');
        var dossierField = $('[data-demo-dossier-field="' + moduleId + '"][data-demo-dossier-index="' + grantIndex + '"]', form);
        if (dossierField) dossierField.hidden = select.value !== 'dossier';
      });
    });
    form.addEventListener('click', function (event) {
      var addButton = event.target.closest('[data-demo-add-grant]');
      if (addButton) {
        event.preventDefault();
        var moduleId = addButton.getAttribute('data-demo-add-grant');
        var module = modules.find(function (item) { return item.id === moduleId; });
        var list = $('[data-demo-grant-list="' + moduleId + '"]', form);
        if (!module || !list || (module.scopeable === false && $$('[data-demo-grant-row]', list).length > 0)) return;
        var grantIndex = Number(list.getAttribute('data-demo-next-grant-index')) || 0;
        list.setAttribute('data-demo-next-grant-index', String(grantIndex + 1));
        list.insertAdjacentHTML('beforeend', demoPermissionGrantRow(module, null, grantIndex));
        updateDemoGrantModuleState(moduleId, module.scopeable);
        return;
      }
      var removeButton = event.target.closest('[data-demo-remove-grant]');
      if (removeButton) {
        event.preventDefault();
        var removeModuleId = removeButton.getAttribute('data-demo-remove-grant');
        var removeIndex = removeButton.getAttribute('data-demo-grant-index');
        var row = $('[data-demo-grant-row][data-demo-grant-module="' + removeModuleId + '"][data-demo-grant-index="' + removeIndex + '"]', form);
        if (row) row.remove();
        var removeModule = modules.find(function (item) { return item.id === removeModuleId; });
        updateDemoGrantModuleState(removeModuleId, removeModule && removeModule.scopeable);
      }
    });
    form.addEventListener('change', function (event) {
      var checkbox = event.target;
      if (!checkbox || !checkbox.matches('input[type="checkbox"][data-demo-action-module]')) return;
      var moduleId = checkbox.getAttribute('data-demo-action-module');
      var grantIndex = checkbox.getAttribute('data-demo-action-index');
      var actionId = checkbox.getAttribute('data-demo-action-id');
      var viewPermission = $('[data-demo-action-module="' + moduleId + '"][data-demo-action-index="' + grantIndex + '"][data-demo-action-id="module.view"]', form);
      if (checkbox.checked && actionId !== 'module.view' && viewPermission) viewPermission.checked = true;
      if (!checkbox.checked && actionId === 'module.view') {
        $$('[data-demo-action-module="' + moduleId + '"][data-demo-action-index="' + grantIndex + '"]', form).forEach(function (action) { action.checked = false; });
      }
      var module = modules.find(function (item) { return item.id === moduleId; });
      updateDemoGrantModuleState(moduleId, module && module.scopeable);
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageMembers', demoAccessContext('organization'))) {
        toast('Modification refusée par défaut : le droit de gestion des accès n’est pas accordé.', 'warning');
        return;
      }
      var grants = {};
      var invalidDossierScope = false;
      var missingModuleView = false;
      modules.forEach(function (module) {
        var moduleGrants = [];
        $$('[data-demo-grant-row][data-demo-grant-module="' + module.id + '"]', form).forEach(function (row) {
          var grantIndex = row.getAttribute('data-demo-grant-index');
          var checked = $$('[data-demo-action-module="' + module.id + '"][data-demo-action-index="' + grantIndex + '"]:checked', form).map(function (checkbox) {
            return checkbox.getAttribute('data-demo-action-id');
          });
          if (!checked.length) return;
          if (checked.some(function (actionId) { return actionId !== 'module.view'; }) && checked.indexOf('module.view') === -1) {
            missingModuleView = true;
            return;
          }
          var scope = $('[data-demo-scope-module="' + module.id + '"][data-demo-scope-index="' + grantIndex + '"]', form).value;
          var dossierSelect = $('[data-demo-dossier-ids="' + module.id + '"][data-demo-dossier-index="' + grantIndex + '"]', form);
          var dossierIds = scope === 'dossier' && dossierSelect
            ? Array.prototype.map.call(dossierSelect.selectedOptions, function (option) { return option.value; })
            : [];
          if (scope === 'dossier' && !dossierIds.length) { invalidDossierScope = true; return; }
          moduleGrants.push({ scope: { type: scope, dossiers: dossierIds }, actions: checked });
        });
        if (moduleGrants.length) grants[module.id] = moduleGrants;
      });
      if (invalidDossierScope) {
        toast('Chaque portée limitée doit sélectionner au moins un dossier client.', 'warning');
        return;
      }
      if (missingModuleView) {
        toast('Chaque action métier doit être accordée avec « Consulter le module » dans la même portée.', 'warning');
        return;
      }
      member.grants = grants;
      closeModal(true);
      toast('Droits temporaires enregistrés. Le moteur cumule les grants explicites en démo.', 'success');
      render();
    });
  }

  function accountOptions(selected) {
    var groups = {
      1: 'Classe 1 — Ressources durables',
      2: 'Classe 2 — Actif immobilisé',
      3: 'Classe 3 — Stocks',
      4: 'Classe 4 — Tiers',
      5: 'Classe 5 — Trésorerie',
      6: 'Classe 6 — Charges',
      7: 'Classe 7 — Produits',
      8: 'Classe 8 — Autres charges et produits'
    };
    var html = '<option value="">— Choisir un compte —</option>';
    Object.keys(groups).forEach(function (cls) {
      var opts = S.accounts().filter(function (a) { return a.cls === Number(cls); }).map(function (a) {
        return '<option value="' + esc(a.code) + '"' + (a.code === selected ? ' selected' : '') + '>' +
          esc(a.code) + ' — ' + esc(a.label) + '</option>';
      }).join('');
      if (opts) html += '<optgroup label="' + groups[cls] + '">' + opts + '</optgroup>';
    });
    return html;
  }

  function journalOptions(selected, includeAll) {
    var html = includeAll ? '<option value="">Tous les journaux</option>' : '';
    html += S.journals().map(function (j) {
      return '<option value="' + esc(j.code) + '"' + (j.code === selected ? ' selected' : '') + '>' +
        esc(j.code) + ' — ' + esc(j.label) + '</option>';
    }).join('');
    return html;
  }

  function balanceRows() {
    var rows = S.balance();
    var map = {};
    rows.forEach(function (r) { map[r.code] = r; });
    return map;
  }

  function entryAmount(entry) {
    return S.totals(entry.lines).debit;
  }

  function sortedEntries(list) {
    return list.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date)) || String(b.reference).localeCompare(String(a.reference));
    });
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
      link.remove();
    }, 400);
  }

  function toCsv(rows) {
    return '\uFEFF' + rows.map(function (row) {
      return row.map(function (cell) {
        var value = String(cell == null ? '' : cell);
        return /[";\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
      }).join(';');
    }).join('\r\n');
  }

  /* ------------------------------- Dashboard ------------------------------- */
  function viewDashboard() {
    var k = S.kpis();
    var dossier = S.currentDossier();
    var exerciseYear = S.exercise();
    var recent = sortedEntries(S.entries().filter(function (entry) { return entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd; })).slice(0, 6);
    var stats = S.journalStats();
    var periods = S.periodStats(exerciseYear);
    var openCount = periods.filter(function (p) { return p.status === 'open'; }).length;

    var html = pageHeader(
      'Tableau de bord',
      'Entreprise cliente : <strong>' + esc(dossier.clientName) + '</strong> · ' + esc(dossier.accountingTypeLabel) + ' · ' + esc(dossier.reference) + ' · exercice ' + exerciseYear + ' (' + dateLabel(dossier.cycleStart) + ' au ' + dateLabel(dossier.cycleEnd) + '). Données conservées localement dans ce prototype.',
      '<a class="btn btn-ghost" href="#/dossiers">← Tous les dossiers</a>' +
      '<a class="btn btn-ghost" href="#/balance">⚖︎ Balance</a>' +
      '<a class="btn btn-primary" href="#/entry">＋ Nouvelle écriture</a>',
      'dashboard-featured'
    );

    html += '<div class="kpi-grid">' +
      '<article class="kpi-card">' +
        '<div class="kpi-top"><span class="kpi-icon" aria-hidden="true">↑</span><span class="kpi-label">Débit validé</span></div>' +
        '<div class="kpi-value">' + moneyHtml(k.debit) + '</div>' +
        '<p class="kpi-foot">' + k.posted + ' pièce(s) validée(s)</p>' +
      '</article>' +
      '<article class="kpi-card green">' +
        '<div class="kpi-top"><span class="kpi-icon" aria-hidden="true">↓</span><span class="kpi-label">Crédit validé</span></div>' +
        '<div class="kpi-value">' + moneyHtml(k.credit) + '</div>' +
        '<p class="kpi-foot">' + (k.debit === k.credit ? 'Balance équilibrée' : 'Écart détecté') + '</p>' +
      '</article>' +
      '<article class="kpi-card orange">' +
        '<div class="kpi-top"><span class="kpi-icon" aria-hidden="true">↗</span><span class="kpi-label">Résultat</span></div>' +
        '<div class="kpi-value">' + moneyHtml(k.resultat) + '</div>' +
        '<p class="kpi-foot">Produits ' + money(k.produits) + ' − charges ' + money(k.charges) + '</p>' +
      '</article>' +
      '<article class="kpi-card violet">' +
        '<div class="kpi-top"><span class="kpi-icon" aria-hidden="true">▤</span><span class="kpi-label">Pièces</span></div>' +
        '<div class="kpi-value">' + k.posted + '<small>validées</small></div>' +
        '<p class="kpi-foot">' + k.drafts + ' brouillon(s) en attente</p>' +
      '</article>' +
    '</div>';

    html += '<div class="grid-2">';

    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Dernières pièces</h2><p class="sub">Triées par date décroissante</p></div>' +
      '<a class="btn btn-ghost btn-sm" href="#/entries">Tout voir</a></div>';

    if (!recent.length) {
      html += '<div class="empty-state"><div class="empty-icon">▤</div><strong>Aucune pièce</strong>Saisissez votre première écriture comptable.</div>';
    } else {
      html += '<div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Libellé</th><th scope="col" class="num">Montant</th><th scope="col">Statut</th></tr></thead><tbody>' +
        recent.map(function (e) {
          return '<tr class="clickable" data-action="open-entry" data-id="' + esc(e.id) + '">' +
            '<td class="nowrap">' + dateLabel(e.date) + '</td>' +
            '<td><strong>' + esc(e.reference) + '</strong></td>' +
            '<td class="muted">' + esc(e.description || '—') + '</td>' +
            '<td class="num">' + amount(entryAmount(e)) + '</td>' +
            '<td>' + statusBadge(e.status) + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    html += '</section>';

    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Accès rapides</h2><p class="sub">Les gestes du quotidien</p></div></div>' +
      '<div class="quick-actions" style="display:grid;gap:8px">' +
        '<a class="btn btn-accent" href="#/entry">＋ Saisir une écriture</a>' +
        '<a class="btn btn-ghost" href="#/accounts">▤ Consulter le plan comptable</a>' +
        '<a class="btn btn-ghost" href="#/ledger">⌕ Ouvrir le grand livre</a>' +
        '<a class="btn btn-ghost" href="#/periods">◷ Gérer les périodes (' + openCount + '/' + periods.length + ' ouvertes)</a>' +
      '</div>' +
      '<div class="alert ' + (k.debit === k.credit ? 'success' : 'warning') + '" style="margin:16px 0 0">' +
        (k.debit === k.credit
          ? '✅ Contrôle d’équilibre : débit = crédit = ' + money(k.debit) + '.'
          : '⚠️ Contrôle d’équilibre : écart de ' + money(Math.abs(k.debit - k.credit)) + '.') +
      '</div>' +
      '<p class="small muted" style="margin-top:12px">Trésorerie nette (classe 5) : <strong>' + money(k.tresorerie) + '</strong></p>' +
    '</section>';

    html += '</div>';

    html += '<div class="grid-2 mt-16">';
    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Activité par journal</h2><p class="sub">Pièces validées uniquement</p></div>' +
      '<a class="btn btn-ghost btn-sm" href="#/journals">Détail</a></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Journal</th><th scope="col" class="num">Pièces</th><th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th></tr></thead><tbody>' +
        stats.map(function (s) {
          return '<tr><td><span class="code-chip">' + esc(s.journal.code) + '</span> <span class="muted">' + esc(s.journal.label) + '</span></td>' +
            '<td class="num">' + s.posted + '</td><td class="num">' + amount(s.debit) + '</td><td class="num">' + amount(s.credit) + '</td></tr>';
        }).join('') +
      '</tbody></table></div>' +
    '</section>';

    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Exercice ' + exerciseYear + '</h2><p class="sub">' + dateLabel(dossier.cycleStart) + ' au ' + dateLabel(dossier.cycleEnd) + '</p></div>' +
      '<a class="btn btn-ghost btn-sm" href="#/periods">Gérer</a></div>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">Mois</th><th scope="col" class="num">Pièces</th><th scope="col">État</th></tr></thead><tbody>' +
        periods.map(function (p) {
          return '<tr><td>' + esc(S.monthLabel(p.month)) + '</td><td class="num">' + p.count + '</td>' +
            '<td>' + (p.status === 'open' ? '<span class="badge open">Ouverte</span>' : '<span class="badge closed">Clôturée</span>') + '</td></tr>';
        }).join('') +
      '</tbody></table></div>' +
    '</section>';
    html += '</div>';

    return html;
  }

  /* ----------------------------- Plan comptable ---------------------------- */
  function viewAccounts() {
    var filter = ui.accounts;
    var bal = balanceRows();
    var list = S.accounts().filter(function (a) {
      var text = (a.code + ' ' + a.label).toLowerCase();
      if (filter.q && text.indexOf(filter.q.toLowerCase()) === -1) return false;
      if (filter.cls && String(a.cls) !== filter.cls) return false;
      if (filter.nature && a.nature !== filter.nature) return false;
      return true;
    });

    var html = pageHeader('Plan comptable', 'Comptes du référentiel SYSCOHADA révisé, enrichis au fil des besoins.',
      '<button type="button" class="btn btn-ghost" data-action="export-accounts-csv">↓ Export CSV</button>' +
      '<button type="button" class="btn btn-primary" data-action="new-account">＋ Nouveau compte</button>');

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field grow"><label for="f-accounts-q">Rechercher</label>' +
          '<input id="f-accounts-q" type="search" data-filter="accounts:q" value="' + esc(filter.q) + '" placeholder="Code ou intitulé…"></div>' +
        '<div class="field"><label for="f-accounts-cls">Classe</label><select id="f-accounts-cls" data-filter="accounts:cls">' +
          '<option value="">Toutes</option>' +
          [1, 2, 3, 4, 5, 6, 7, 8].map(function (c) {
            return '<option value="' + c + '"' + (filter.cls === String(c) ? ' selected' : '') + '>Classe ' + c + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label for="f-accounts-nature">Nature</label><select id="f-accounts-nature" data-filter="accounts:nature">' +
          '<option value="">Toutes</option>' +
          ['Actif', 'Passif', 'Charge', 'Produit'].map(function (n) {
            return '<option value="' + n + '"' + (filter.nature === n ? ' selected' : '') + '>' + n + '</option>';
          }).join('') +
        '</select></div>' +
      '</div>' +
      '<p class="small muted" style="margin-bottom:10px">' + list.length + ' compte(s) affiché(s) sur ' + S.accounts().length + '.</p>' +
      '<div class="table-wrap"><table class="data-table">' +
        '<caption>Plan comptable — comptes actifs et soldes issus des pièces validées</caption>' +
        '<thead><tr><th scope="col">Code</th><th scope="col">Intitulé</th><th scope="col">Classe</th><th scope="col">Nature</th>' +
        '<th scope="col">Auxiliaire</th><th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th><th scope="col" class="num">Solde</th></tr></thead><tbody>' +
        (list.length ? list.map(function (a) {
          var row = bal[a.code] || { debit: 0, credit: 0 };
          var solde = row.debit - row.credit;
          return '<tr>' +
            '<td><span class="code-chip">' + esc(a.code) + '</span></td>' +
            '<td class="strong">' + esc(a.label) + '</td>' +
            '<td>' + a.cls + '</td>' +
            '<td>' + natureBadge(a.nature) + '</td>' +
            '<td>' + (a.aux ? '<span class="badge plain">Oui</span>' : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + (row.debit ? amount(row.debit) : '—') + '</td>' +
            '<td class="num">' + (row.credit ? amount(row.credit) : '—') + '</td>' +
            '<td class="num strong">' + (solde === 0 ? '—' : amount(Math.abs(solde)) + (solde > 0 ? ' D' : ' C')) + '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="8"><div class="empty-state"><strong>Aucun compte ne correspond</strong>Modifiez la recherche ou les filtres.</div></td></tr>') +
        '</tbody></table></div>' +
      '</div></div>';

    return html;
  }

  /* -------------------------------- Journaux ------------------------------- */
  function viewJournals() {
    var stats = S.journalStats();
    var html = pageHeader('Journaux comptables', 'Six journaux couvrent les opérations courantes du Lot 1.',
      '<a class="btn btn-primary" href="#/entry">＋ Nouvelle écriture</a>');

    html += '<div class="journal-grid">' + stats.map(function (s) {
      return '<article class="journal-card">' +
        '<div class="journal-head"><span class="journal-code">' + esc(s.journal.code) + '</span>' +
          '<div><h3>' + esc(s.journal.label) + '</h3><span class="journal-meta">Type : ' + esc(s.journal.type) + '</span></div></div>' +
        '<dl>' +
          '<dt>Pièces validées</dt><dd>' + s.posted + '</dd>' +
          '<dt>Brouillons</dt><dd>' + s.drafts + '</dd>' +
          '<dt>Total débit</dt><dd>' + amount(s.debit) + ' XOF</dd>' +
          '<dt>Total crédit</dt><dd>' + amount(s.credit) + ' XOF</dd>' +
        '</dl>' +
        '<a class="btn btn-ghost btn-sm mt-8" href="#/journal?journal=' + encodeURIComponent(s.journal.code) + '">Voir le journal</a>' +
      '</article>';
    }).join('') + '</div>';

    return html;
  }

  /* --------------------------- Saisie d'écriture --------------------------- */
  function defaultEntryModel(params) {
    if (params && params.id) {
      var existing = S.entry(params.id);
      if (existing && existing.status === 'draft') {
        return {
          id: existing.id,
          reference: existing.reference,
          journal: existing.journal,
          date: existing.date,
          description: existing.description,
          lines: existing.lines.map(function (l) { return { account: l.account, debit: l.debit || '', credit: l.credit || '' }; })
        };
      }
    }
    var dossier = S.currentDossier();
    var today = S.todayIso();
    var date = today >= dossier.cycleStart && today <= dossier.cycleEnd ? today : dossier.cycleStart;
    var journal = 'OD';
    return {
      id: null,
      reference: S.nextReference(journal, date),
      journal: journal,
      date: date,
      description: '',
      lines: [
        { account: '', debit: '', credit: '' },
        { account: '', debit: '', credit: '' }
      ]
    };
  }

  function lineRowHtml(line) {
    return '<div class="line-row">' +
      '<select data-field="account" aria-label="Compte de la ligne">' + accountOptions(line.account) + '</select>' +
      '<input type="number" data-field="debit" min="0" step="1" inputmode="numeric" value="' + esc(line.debit) + '" placeholder="0" aria-label="Montant au débit">' +
      '<input type="number" data-field="credit" min="0" step="1" inputmode="numeric" value="' + esc(line.credit) + '" placeholder="0" aria-label="Montant au crédit">' +
      '<button type="button" class="line-remove" data-action="remove-line" aria-label="Supprimer cette ligne">✕</button>' +
    '</div>';
  }

  function viewEntryForm(params) {
    var model = defaultEntryModel(params || {});
    var editing = !!model.id;
    var closed = S.periodStatus(Number(model.date.slice(0, 4)), Number(model.date.slice(5, 7))) === 'closed';

    var html = pageHeader(editing ? 'Modifier le brouillon' : 'Saisie d’écriture',
      editing ? 'La pièce reste modifiable tant qu’elle n’est pas validée.' : 'Saisie multiligne avec contrôle d’équilibre en temps réel.',
      '<a class="btn btn-ghost" href="#/entries">← Retour aux pièces</a>');

    if (editing) {
      html += '<div class="alert info">Brouillon <strong>' + esc(model.reference) + '</strong> en cours de modification.</div>';
    }

    html += '<form id="entry-form" class="card panel" data-entry-id="' + esc(model.id || '') + '" novalidate>' +
      '<div id="form-errors" aria-live="assertive"></div>' +
      '<div id="period-notice">' + (closed ? '<div class="alert warning">⚠️ La période sélectionnée est clôturée : enregistrement et validation seront refusés.</div>' : '') + '</div>' +
      '<div class="form-grid">' +
        '<div class="field"><label for="e-reference">Référence</label>' +
          '<input id="e-reference" name="reference" type="text" required value="' + esc(model.reference) + '" data-auto="' + (editing ? 'false' : 'true') + '" autocomplete="off">' +
          '<span class="hint">Unique, proposée automatiquement par journal.</span></div>' +
        '<div class="field"><label for="e-journal">Journal</label>' +
          '<select id="e-journal" name="journal" required>' + journalOptions(model.journal) + '</select></div>' +
        '<div class="field"><label for="e-date">Date</label>' +
          '<input id="e-date" name="date" type="date" required value="' + esc(model.date) + '"></div>' +
        '<div class="field"><label for="e-description">Libellé</label>' +
          '<input id="e-description" name="description" type="text" value="' + esc(model.description) + '" placeholder="Objet de la pièce"></div>' +
      '</div>' +

      '<div class="panel-header" style="margin-top:22px"><div><h3>Lignes de l’écriture</h3>' +
        '<p class="sub">Un débit ou un crédit par ligne, jamais les deux. Les lignes vides sont ignorées.</p></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="add-line">＋ Ajouter une ligne</button></div>' +

      '<div class="lines-head" aria-hidden="true"><span>Compte</span><span>Débit (XOF)</span><span>Crédit (XOF)</span><span></span></div>' +
      '<div class="lines-editor" id="lines-body">' + model.lines.map(lineRowHtml).join('') + '</div>' +

      '<div class="entry-footer">' +
        '<div class="totals-inline">' +
          '<div class="total-item"><span>Total débit</span><strong id="total-debit">0</strong></div>' +
          '<div class="total-item"><span>Total crédit</span><strong id="total-credit">0</strong></div>' +
          '<div class="total-item"><span>Contrôle</span><span class="balance-chip" id="balance-chip">Équilibrée</span></div>' +
        '</div>' +
        '<div class="entry-actions">' +
          '<button type="submit" class="btn btn-ghost" data-mode="draft">💾 ' + (editing ? 'Mettre à jour' : 'Enregistrer le brouillon') + '</button>' +
          '<button type="submit" class="btn btn-primary" data-mode="posted">✓ Valider la pièce</button>' +
        '</div>' +
      '</div>' +
    '</form>';

    return html;
  }

  function collectEntryForm() {
    var form = $('#entry-form');
    if (!form) return null;
    var rows = $$('#lines-body .line-row');
    return {
      id: form.getAttribute('data-entry-id') || null,
      reference: $('#e-reference').value.trim(),
      journal: $('#e-journal').value,
      date: $('#e-date').value,
      description: $('#e-description').value,
      lines: rows.map(function (row) {
        return {
          account: row.querySelector('[data-field="account"]').value,
          debit: row.querySelector('[data-field="debit"]').value,
          credit: row.querySelector('[data-field="credit"]').value
        };
      })
    };
  }

  function readTotals() {
    var debit = 0;
    var credit = 0;
    $$('#lines-body .line-row').forEach(function (row) {
      debit += Number(row.querySelector('[data-field="debit"]').value) || 0;
      credit += Number(row.querySelector('[data-field="credit"]').value) || 0;
    });
    return { debit: debit, credit: credit, balanced: debit === credit && debit > 0 };
  }

  function updateEntryTotals() {
    var t = readTotals();
    var debitEl = $('#total-debit');
    var creditEl = $('#total-credit');
    var chip = $('#balance-chip');
    if (!debitEl || !creditEl || !chip) return;
    debitEl.textContent = amount(t.debit) + ' XOF';
    creditEl.textContent = amount(t.credit) + ' XOF';
    chip.textContent = t.balanced ? '✓ Équilibrée' : (t.debit === 0 && t.credit === 0 ? 'Aucun montant' : 'Déséquilibrée');
    chip.classList.toggle('unbalanced', !t.balanced);
  }

  function showFormErrors(errors) {
    var box = $('#form-errors');
    if (!box) return;
    if (!errors || !errors.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="alert error" role="alert"><div><strong>Corrigez les points suivants :</strong><ul style="margin:6px 0 0 18px">' +
      errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div></div>';
    var alert = box.querySelector('.alert');
    if (alert) alert.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function updatePeriodNotice() {
    var date = $('#e-date');
    var box = $('#period-notice');
    if (!date || !box) return;
    var value = date.value;
    if (!value) { box.innerHTML = ''; return; }
    var year = Number(value.slice(0, 4));
    var month = Number(value.slice(5, 7));
    if (S.periodStatus(year, month) === 'closed') {
      box.innerHTML = '<div class="alert warning">⚠️ La période ' + esc(S.monthLabel(month)) + ' ' + year + ' est clôturée : enregistrement et validation seront refusés.</div>';
    } else {
      box.innerHTML = '';
    }
  }

  function syncReferenceFromContext() {
    var ref = $('#e-reference');
    var journal = $('#e-journal');
    var date = $('#e-date');
    if (!ref || !journal || !date) return;
    if (ref.getAttribute('data-auto') === 'true') {
      ref.value = S.nextReference(journal.value, date.value);
    }
  }

  /* ----------------------------- Pièces comptables ------------------------- */
  function viewEntries() {
    var filter = ui.entries;
    var list = sortedEntries(S.entries()).filter(function (e) {
      var text = (e.reference + ' ' + (e.description || '')).toLowerCase();
      if (filter.q && text.indexOf(filter.q.toLowerCase()) === -1) return false;
      if (filter.status && e.status !== filter.status) return false;
      if (filter.journal && e.journal !== filter.journal) return false;
      return true;
    });

    var html = pageHeader('Pièces comptables', 'Brouillons modifiables, pièces validées immuables.',
      '<a class="btn btn-primary" href="#/entry">＋ Nouvelle écriture</a>');

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field grow"><label for="f-entries-q">Rechercher</label>' +
          '<input id="f-entries-q" type="search" data-filter="entries:q" value="' + esc(filter.q) + '" placeholder="Référence ou libellé…"></div>' +
        '<div class="field"><label for="f-entries-status">Statut</label><select id="f-entries-status" data-filter="entries:status">' +
          '<option value="">Tous</option>' +
          '<option value="posted"' + (filter.status === 'posted' ? ' selected' : '') + '>Validées</option>' +
          '<option value="draft"' + (filter.status === 'draft' ? ' selected' : '') + '>Brouillons</option>' +
        '</select></div>' +
        '<div class="field"><label for="f-entries-journal">Journal</label><select id="f-entries-journal" data-filter="entries:journal">' +
          journalOptions(filter.journal, true) + '</select></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="data-table">' +
        '<caption>' + list.length + ' pièce(s) — montants exprimés en XOF</caption>' +
        '<thead><tr><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Journal</th><th scope="col">Libellé</th>' +
        '<th scope="col" class="num">Montant</th><th scope="col">Statut</th></tr></thead><tbody>' +
        (list.length ? list.map(function (e) {
          return '<tr class="clickable" data-action="open-entry" data-id="' + esc(e.id) + '">' +
            '<td class="nowrap">' + dateLabel(e.date) + '</td>' +
            '<td><button type="button" class="btn btn-ghost btn-sm" data-action="open-entry" data-id="' + esc(e.id) + '">' + esc(e.reference) + '</button></td>' +
            '<td><span class="code-chip">' + esc(e.journal) + '</span></td>' +
            '<td class="muted">' + esc(e.description || '—') + '</td>' +
            '<td class="num">' + amount(entryAmount(e)) + '</td>' +
            '<td>' + statusBadge(e.status) + '</td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">▤</div><strong>Aucune pièce</strong>Aucune pièce ne correspond à ces critères.</div></td></tr>') +
      '</tbody></table></div>' +
    '</div></div>';

    return html;
  }

  function openEntryModal(id) {
    var e = S.entry(id);
    if (!e) { toast('Pièce introuvable.', 'error'); return; }
    var t = S.totals(e.lines);
    var journal = S.journal(e.journal);

    var body = '<div class="form-grid" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px">' +
      '<div class="total-item"><span>Date</span><strong>' + dateLabel(e.date) + '</strong></div>' +
      '<div class="total-item"><span>Journal</span><strong>' + esc(e.journal) + ' — ' + esc(journal ? journal.label : '') + '</strong></div>' +
      '<div class="total-item"><span>Statut</span><div>' + statusBadge(e.status) + '</div></div>' +
      '</div>' +
      '<p class="muted" style="margin-bottom:16px">' + esc(e.description || 'Aucun libellé') + '</p>' +
      '<div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th></tr></thead><tbody>' +
        e.lines.map(function (l) {
          var acc = S.account(l.account);
          return '<tr><td><span class="code-chip">' + esc(l.account) + '</span></td>' +
            '<td>' + esc(acc ? acc.label : '—') + '</td>' +
            '<td class="num">' + (l.debit ? amount(l.debit) : '—') + '</td>' +
            '<td class="num">' + (l.credit ? amount(l.credit) : '—') + '</td></tr>';
        }).join('') +
      '</tbody><tfoot><tr><td colspan="2">Totaux</td><td class="num">' + amount(t.debit) + '</td><td class="num">' + amount(t.credit) + '</td></tr></tfoot></table></div>' +
      '<div class="alert ' + (t.balanced ? 'success' : 'warning') + '" style="margin-top:16px">' +
        (t.balanced ? '✅ Pièce équilibrée.' : '⚠️ Pièce déséquilibrée (brouillon).') + '</div>';

    var footer = '';
    if (e.status === 'draft') {
      footer += '<button type="button" class="btn btn-danger" data-action="delete-draft" data-id="' + esc(e.id) + '">× Supprimer</button>';
      footer += '<button type="button" class="btn btn-ghost" data-action="edit-draft" data-id="' + esc(e.id) + '">✎ Modifier</button>';
      footer += '<button type="button" class="btn btn-primary" data-action="validate-entry" data-id="' + esc(e.id) + '">✓ Valider la pièce</button>';
    }
    footer += '<button type="button" class="btn btn-ghost" data-action="close-modal">Fermer</button>';

    openModal('Pièce ' + e.reference, 'Détail de l’écriture comptable', body, footer, true);
  }

  /* --------------------------------- Balance ------------------------------- */
  function viewBalance() {
    var filter = ui.balance;
    var rows = S.balance().filter(function (r) {
      var text = (r.code + ' ' + r.label).toLowerCase();
      if (filter.q && text.indexOf(filter.q.toLowerCase()) === -1) return false;
      if (filter.cls && String(r.cls) !== filter.cls) return false;
      return true;
    });
    var totalDebit = rows.reduce(function (s, r) { return s + r.debit; }, 0);
    var totalCredit = rows.reduce(function (s, r) { return s + r.credit; }, 0);
    var balanced = totalDebit === totalCredit;

    var html = pageHeader('Balance générale', 'Les brouillons sont exclus. Les soldes sont exprimés en débit (D) ou crédit (C).',
      '<button type="button" class="btn btn-ghost" data-action="export-balance-csv">↓ Export CSV</button>' +
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>');

    html += '<div class="alert ' + (balanced ? 'success' : 'warning') + '">' +
      (balanced
        ? '✅ Balance équilibrée : débit = crédit = <strong>' + money(totalDebit) + '</strong>.'
        : '⚠️ Déséquilibre de <strong>' + money(Math.abs(totalDebit - totalCredit)) + '</strong>.') +
      '</div>';

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field grow"><label for="f-balance-q">Rechercher un compte</label>' +
          '<input id="f-balance-q" type="search" data-filter="balance:q" value="' + esc(filter.q) + '" placeholder="Code ou intitulé…"></div>' +
        '<div class="field"><label for="f-balance-cls">Classe</label><select id="f-balance-cls" data-filter="balance:cls">' +
          '<option value="">Toutes</option>' +
          [1, 2, 3, 4, 5, 6, 7, 8].map(function (c) {
            return '<option value="' + c + '"' + (filter.cls === String(c) ? ' selected' : '') + '>Classe ' + c + '</option>';
          }).join('') +
        '</select></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="data-table">' +
        '<caption>Balance générale au ' + dateLabel(S.todayIso()) + ' — ' + rows.length + ' compte(s) mouvementé(s)</caption>' +
        '<thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col">Classe</th>' +
        '<th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th><th scope="col" class="num">Solde</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          var solde = r.debit - r.credit;
          return '<tr><td><span class="code-chip">' + esc(r.code) + '</span></td>' +
            '<td>' + esc(r.label) + '</td><td>' + r.cls + '</td>' +
            '<td class="num">' + (r.debit ? amount(r.debit) : '—') + '</td>' +
            '<td class="num">' + (r.credit ? amount(r.credit) : '—') + '</td>' +
            '<td class="num strong">' + (solde === 0 ? '—' : amount(Math.abs(solde)) + (solde > 0 ? ' D' : ' C')) + '</td></tr>';
        }).join('') : '<tr><td colspan="6"><div class="empty-state"><strong>Aucun mouvement</strong>Les comptes apparaîtront après validation de pièces.</div></td></tr>') +
        '</tbody>' +
        (rows.length ? '<tfoot><tr><td colspan="3">Totaux</td><td class="num">' + amount(totalDebit) + '</td><td class="num">' + amount(totalCredit) + '</td><td class="num">' + (balanced ? '=' : '≠') + '</td></tr></tfoot>' : '') +
        '</table></div>' +
    '</div></div>';

    return html;
  }

  /* ---------------------------- Journal des écritures ---------------------- */
  function viewJournal() {
    var filter = ui.journal;
    var dossier = S.currentDossier();
    var year = S.exercise();
    ui.journal.year = String(year);
    var list = sortedEntries(S.postedEntries()).filter(function (e) {
      if (e.journal !== filter.journal && filter.journal) return false;
      if (e.date < dossier.cycleStart || e.date > dossier.cycleEnd) return false;
      return true;
    });
    var totalDebit = list.reduce(function (s, e) { return s + S.totals(e.lines).debit; }, 0);
    var totalCredit = list.reduce(function (s, e) { return s + S.totals(e.lines).credit; }, 0);
    var years = S.years();

    var html = pageHeader('Journal des écritures', 'Écritures validées de l’exercice, présentées chronologiquement.',
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>');

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field"><label for="f-journal-journal">Journal</label><select id="f-journal-journal" data-filter="journal:journal">' +
          journalOptions(filter.journal, true) + '</select></div>' +
        '<div class="field"><label for="f-journal-year">Exercice</label><select id="f-journal-year" data-filter="journal:year">' +
          years.map(function (y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>' + y + '</option>'; }).join('') +
        '</select></div>' +
        '<div class="field grow" style="align-self:flex-end"><p class="small muted" style="margin:0">' +
          list.length + ' pièce(s) validée(s) — débit ' + money(totalDebit) + ' / crédit ' + money(totalCredit) + '</p></div>' +
      '</div>';

    if (!list.length) {
      html += '<div class="empty-state"><div class="empty-icon">≡</div><strong>Aucune écriture validée</strong>Aucune pièce ne correspond à ce filtre.</div>';
    } else {
      html += list.map(function (e) {
        var t = S.totals(e.lines);
        return '<article class="entry-block">' +
          '<div class="entry-block-head">' +
            '<span class="ref">' + esc(e.reference) + '</span>' +
            '<span class="badge plain">' + dateLabel(e.date) + '</span>' +
            '<span class="badge plain">' + esc(e.journal) + '</span>' +
            '<span class="desc">' + esc(e.description || '—') + '</span>' +
            '<span class="spacer"></span>' +
            '<span class="small muted">Débit ' + money(t.debit) + ' · Crédit ' + money(t.credit) + '</span>' +
          '</div>' +
          '<div class="table-wrap"><table class="data-table">' +
            '<thead><tr><th scope="col">Compte</th><th scope="col">Intitulé</th><th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th></tr></thead><tbody>' +
            e.lines.map(function (l) {
              var acc = S.account(l.account);
              return '<tr><td><span class="code-chip">' + esc(l.account) + '</span></td><td>' + esc(acc ? acc.label : '—') + '</td>' +
                '<td class="num">' + (l.debit ? amount(l.debit) : '—') + '</td><td class="num">' + (l.credit ? amount(l.credit) : '—') + '</td></tr>';
            }).join('') +
            '</tbody></table></div>' +
        '</article>';
      }).join('');
    }
    html += '</div></div>';

    return html;
  }

  /* -------------------------------- Grand livre ---------------------------- */
  function viewLedger() {
    var selected = ui.ledger.account;
    if (!S.account(selected)) selected = S.accounts()[0] ? S.accounts()[0].code : '';
    var acc = S.account(selected);
    var data = selected ? S.ledger(selected) : { rows: [], debit: 0, credit: 0, balance: 0 };
    var solde = data.balance;

    var html = pageHeader('Grand livre', 'Mouvements d’un compte et solde progressif, pièces validées uniquement.',
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>');

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field grow" style="max-width:520px"><label for="f-ledger-account">Compte</label>' +
          '<select id="f-ledger-account" data-filter="ledger:account">' + accountOptions(selected) + '</select></div>' +
      '</div>';

    if (acc) {
      html += '<div class="ledger-summary">' +
        '<div class="total-item"><span>Compte</span><strong>' + esc(acc.code) + '</strong></div>' +
        '<div class="total-item"><span>Intitulé</span><strong>' + esc(acc.label) + '</strong></div>' +
        '<div class="total-item"><span>Total débit</span><strong>' + money(data.debit) + '</strong></div>' +
        '<div class="total-item"><span>Total crédit</span><strong>' + money(data.credit) + '</strong></div>' +
        '<div class="total-item"><span>Solde</span><strong>' + (solde === 0 ? '0 XOF' : money(Math.abs(solde)) + (solde > 0 ? ' D' : ' C')) + '</strong></div>' +
      '</div>';

      if (!data.rows.length) {
        html += '<div class="empty-state"><div class="empty-icon">⌕</div><strong>Aucun mouvement</strong>Ce compte n’a pas encore été mouvementé par une pièce validée.</div>';
      } else {
        html += '<div class="table-wrap"><table class="data-table">' +
          '<caption>Grand livre ' + esc(acc.code) + ' — ' + esc(acc.label) + '</caption>' +
          '<thead><tr><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Journal</th><th scope="col">Libellé</th>' +
          '<th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th><th scope="col" class="num">Solde progressif</th></tr></thead><tbody>' +
          data.rows.map(function (r) {
            return '<tr><td class="nowrap">' + dateLabel(r.date) + '</td>' +
              '<td><button type="button" class="btn btn-ghost btn-sm" data-action="open-entry" data-id="' + esc(findEntryId(r.reference)) + '">' + esc(r.reference) + '</button></td>' +
              '<td><span class="code-chip">' + esc(r.journal) + '</span></td>' +
              '<td class="muted">' + esc(r.description || '—') + '</td>' +
              '<td class="num">' + (r.debit ? amount(r.debit) : '—') + '</td>' +
              '<td class="num">' + (r.credit ? amount(r.credit) : '—') + '</td>' +
              '<td class="num strong">' + (r.balance === 0 ? '—' : amount(Math.abs(r.balance)) + (r.balance > 0 ? ' D' : ' C')) + '</td></tr>';
          }).join('') +
          '</tbody></table></div>';
      }
    }
    html += '</div></div>';

    return html;
  }

  function findEntryId(reference) {
    var found = S.entries().find(function (e) { return e.reference === reference; });
    return found ? found.id : '';
  }

  /* --------------------------------- Périodes ------------------------------ */
  function viewPeriods() {
    var dossier = S.currentDossier();
    var year = S.exercise();
    ui.periods.year = year;
    var list = S.periodStats(year);
    var openCount = list.filter(function (p) { return p.status === 'open'; }).length;
    var years = [year];

    var html = pageHeader('Périodes comptables', 'Une période clôturée refuse les nouvelles pièces et la validation des brouillons.',
      '<div class="field"><label class="sr-only" for="f-periods-year">Exercice</label>' +
        '<select id="f-periods-year" data-filter="periods:year">' +
        years.map(function (y) { return '<option value="' + y + '"' + (y === year ? ' selected' : '') + '>Exercice ' + y + '</option>'; }).join('') +
        '</select></div>');

    html += '<div class="alert info">Exercice <strong>' + year + '</strong> (' + dateLabel(dossier.cycleStart) + ' au ' + dateLabel(dossier.cycleEnd) + ') : ' + openCount + ' période(s) ouverte(s) sur ' + list.length + '. ' +
      'La clôture est immédiate et persistée localement.</div>';

    html += '<div class="period-grid">' + list.map(function (p) {
      var isOpen = p.status === 'open';
      return '<article class="period-card' + (isOpen ? '' : ' closed') + '">' +
        '<div class="period-top"><h3>' + esc(S.monthLabel(p.month)) + ' ' + p.year + '</h3>' +
          (isOpen ? '<span class="badge open">Ouverte</span>' : '<span class="badge closed">Clôturée</span>') + '</div>' +
        '<div class="period-stats">' +
          '<span><strong>' + p.count + '</strong> pièce(s) — <strong>' + p.posted + '</strong> validée(s)</span>' +
          '<span>Débit validé : <strong>' + amount(p.debit) + ' XOF</strong></span>' +
        '</div>' +
        (isOpen
          ? '<button type="button" class="btn btn-ghost btn-sm" data-action="close-period" data-year="' + p.year + '" data-month="' + p.month + '">◷ Clôturer</button>'
          : '<button type="button" class="btn btn-ghost btn-sm" data-action="open-period" data-year="' + p.year + '" data-month="' + p.month + '">🔓 Réouvrir</button>') +
      '</article>';
    }).join('') + '</div>';

    return html;
  }

  /* -------------------------------- Paramètres ----------------------------- */
  function viewSettings() {
    var raw = '';
    try { raw = window.localStorage.getItem(S.currentStorageKey()) || ''; } catch (err) { raw = ''; }
    var sizeKb = (raw.length / 1024).toFixed(1);
    var state = S.getState();
    var backupInfo = S.backupInfo();
    var backupDate = backupInfo.available ? new Date(backupInfo.createdAt).toLocaleString('fr-FR') : '';
    var backupMarkup = backupInfo.available
      ? '<div class="local-backup-status"><div><strong>Point de restauration disponible</strong><small>État précédent · ' + esc(backupDate) + ' · ' + backupInfo.entryCount + ' pièce(s)</small></div><button type="button" class="btn btn-ghost btn-sm" data-action="restore-local-backup">Restaurer</button></div>'
      : '<div class="local-backup-status is-empty"><div><strong>Aucun point de restauration pour le moment</strong><small>Il sera créé automatiquement avant la prochaine modification des données.</small></div></div>';
    var swReady = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

    var html = pageHeader('Données & application', 'Sauvegarde, restauration et installation — tout reste dans votre navigateur.',
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>');

    html += '<div class="grid-2">';

    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Données locales</h2><p class="sub">Stockage navigateur (localStorage)</p></div></div>' +
      '<div class="ledger-summary" style="margin-bottom:16px">' +
        '<div class="total-item"><span>Comptes</span><strong>' + state.accounts.length + '</strong></div>' +
        '<div class="total-item"><span>Pièces</span><strong>' + state.entries.length + '</strong></div>' +
        '<div class="total-item"><span>Périodes</span><strong>' + state.periods.length + '</strong></div>' +
        '<div class="total-item"><span>Espace utilisé</span><strong>' + sizeKb + ' Ko</strong></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-primary" data-action="export-json">↓ Sauvegarder le dossier (JSON)</button>' +
        '<label class="btn btn-ghost" for="import-file" style="cursor:pointer">↑ Restaurer une sauvegarde JSON</label>' +
        '<input id="import-file" type="file" accept="application/json,.json" class="sr-only">' +
        '<button type="button" class="btn btn-danger" data-action="reset-data">↺ Réinitialiser la démo</button>' +
      '</div>' +
      '<p class="small muted mt-8">La sauvegarde JSON PERFECTO est distincte des fichiers d’échange Excel/CSV. Sa restauration remplace les données comptables du dossier actif.</p>' +
      '<div class="local-backup-box"><div class="local-backup-heading"><span>RESTAURATION LOCALE</span><b>1 point</b></div>' + backupMarkup +
      '<p class="small muted">Ce point reste dans ce navigateur et conserve uniquement l’état précédent. Il ne remplace pas une copie exportée sur un support indépendant.</p></div>' +
    '</section>';

    html += '<section class="card panel">' +
      '<div class="panel-header"><div><h2>Application installable</h2><p class="sub">PWA statique, sans service serveur</p></div></div>' +
      '<div class="alert ' + (swReady ? 'success' : 'info') + '">' +
        (swReady ? '✅ Service worker actif : l’application peut fonctionner hors ligne.' : 'ℹ️ Le service worker s’active après le premier chargement complet.') +
      '</div>' +
      '<p class="small muted">PERFECTO est une page statique : HTML, CSS et JavaScript natifs. Elle peut être installée depuis le menu du navigateur (« Installer » ou « Ajouter à l’écran d’accueil »).</p>' +
      '<div class="mt-16"><button type="button" class="btn btn-accent" data-action="install-app" hidden>📲 Installer PERFECTO</button></div>' +
    '</section>';

    html += '</div>';

    html += '<section class="card panel mt-16">' +
      '<div class="panel-header"><div><h2>À propos de ce prototype</h2><p class="sub">Lot 1 — comptabilité générale SYSCOHADA révisé</p></div>' +
      '<span class="badge plain">v0.2.0-preview.1</span></div>' +
      '<div class="grid-2" style="gap:22px">' +
        '<div>' +
          '<h3 style="font-size:.88rem;margin-bottom:6px">Règles appliquées</h3>' +
          '<ul class="small muted" style="margin:0;padding-left:18px;line-height:1.8">' +
            '<li>Référence de pièce unique par exercice et journal.</li>' +
            '<li>Compte existant, débit ou crédit exclusif par ligne.</li>' +
            '<li>Équilibre obligatoire avant validation définitive.</li>' +
            '<li>Une pièce validée est immuable.</li>' +
            '<li>Les brouillons sont exclus des états comptables.</li>' +
            '<li>Une période clôturée refuse saisie et validation.</li>' +
          '</ul>' +
        '</div>' +
        '<div>' +
          '<h3 style="font-size:.88rem;margin-bottom:6px">Architecture</h3>' +
          '<p class="small muted" style="margin:0 0 8px">Aucun Blazor, aucun WebAssembly, aucun build : des fichiers statiques servis tels quels, compatibles avec un hébergement simple (Vercel, GitHub Pages, intranet).</p>' +
          '<p class="small muted" style="margin:0">Les données restent sur l’appareil. Aucune donnée n’est envoyée à un serveur.</p>' +
        '</div>' +
      '</div>' +
    '</section>';

    return html;
  }

  function menuStatusBadge(status) {
    var label = AccountingNavigation.statusLabels[status] || AccountingNavigation.statusLabels.inactive;
    return '<span class="menu-status menu-status-' + esc(status) + '">' + esc(label) + '</span>';
  }

  function menuShortStatus(status) {
    var labels = { active: 'Disponible', partial: 'Partiel', planned: 'À construire', inactive: 'Inactif', review: 'À confirmer', mixed: 'Partiel' };
    return labels[status] || 'Inactif';
  }

  function menuActionLink(action, status) {
    if (!action || !action.route || (status !== 'active' && status !== 'partial' && status !== 'mixed')) return '';
    var href = action.route === 'menu' ? accountingMenuHash(action.group, action.tab) : '#/' + action.route;
    return '<a class="btn btn-primary btn-sm menu-action-link" href="' + esc(href) + '">' + esc(action.label) + ' <span aria-hidden="true">→</span></a>';
  }

  function menuChildList(children, parentReason) {
    if (!children || !children.length) return '';
    return '<ul class="menu-child-list">' + children.map(function (child) {
      var hasRoute = child.route && child.status === 'active';
      var body = hasRoute
        ? '<a href="#/' + esc(child.route) + '">' + esc(child.label) + '<span aria-hidden="true">→</span></a>'
        : '<span class="menu-child-label">' + esc(child.label) + '</span>';
      return '<li class="menu-child menu-child-' + esc(child.status) + '">' + body + menuStatusBadge(child.status) +
        (child.reason || (child.status !== 'active' ? parentReason : '') ? '<small>' + esc(child.reason || parentReason || '') + '</small>' : '') +
        '</li>';
    }).join('') + '</ul>';
  }

  function safeFilePart(value) {
    return String(value || 'dossier').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'dossier';
  }

  function viewExchangeFormatGuide() {
    var columns = [
      ['FORMAT / VERSION', 'Valeurs fixes : PERFECTO-ECHANGE / 1.'],
      ['SYSTEME_SOURCE', 'Origine déclarée : EXCEL, SAGE, PERFECTO, HYPERSOFT, ODOO ou autre libellé.'],
      ['REFERENCE_DOSSIER / EXERCICE', 'Dossier et exercice source ; identiques sur toutes les lignes du fichier.'],
      ['CODE_JOURNAL / LIBELLE_JOURNAL', 'Code du journal source et libellé ; le code est associé à un journal du dossier actif.'],
      ['DATE / REFERENCE_PIECE / LIBELLE_PIECE', 'Date AAAA-MM-JJ, référence unique de la pièce et libellé. Les lignes d’une pièce partagent ces valeurs.'],
      ['CODE_COMPTE / LIBELLE_COMPTE', 'Code et libellé du compte source ; le code est associé à un compte existant du plan PERFECTO.'],
      ['CLASSE_COMPTE / NATURE_COMPTE', 'Informations de contexte sur le compte source ; elles ne créent ni ne modifient le plan.'],
      ['DEBIT_XOF / CREDIT_XOF', 'Montants XOF entiers, sans séparateurs de milliers ni décimales ; renseigner un seul côté par ligne.'],
      ['STATUT_SOURCE', 'VALIDEE ou BROUILLON ; le statut appliqué à l’import est toujours celui choisi dans l’écran.'],
      ['ID_SOURCE', 'Identifiant de la pièce d’origine, identique sur toutes ses lignes ; utilisé pour la traçabilité et le contrôle des doublons.']
    ];
    return '<details class="exchange-mapping exchange-format-guide"><summary>Voir les colonnes et règles du modèle PERFECTO-ÉCHANGE v1</summary>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Colonne(s)</th><th>Règle</th></tr></thead><tbody>' +
      columns.map(function (row) { return '<tr><td><strong>' + esc(row[0]) + '</strong></td><td>' + esc(row[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted">Une ligne du CSV ou de la feuille Écritures correspond à une ligne comptable. Les lignes ayant le même code journal, la même date et la même référence sont regroupées en une pièce. Le classeur `.xlsx` n’exécute pas les macros ni les formules lors de l’import ; les formats logiciels propriétaires feront l’objet d’adaptateurs ultérieurs.</p></details>';
  }

  function viewAccountingExchangeExport() {
    var dossier = S.currentDossier();
    var entries = S.entries().filter(function (entry) {
      return entry.status === 'posted' && entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd;
    });
    var lineCount = entries.reduce(function (count, entry) { return count + entry.lines.length; }, 0);
    var drafts = S.entries().filter(function (entry) { return entry.status === 'draft'; }).length;
    var systems = [
      { label: 'Classeur Excel + CSV PERFECTO v1', state: 'Disponible', ready: true },
      { label: 'Sage Comptabilité', state: 'Adaptateur à construire', ready: false },
      { label: 'PERFECTO historique', state: 'Adaptateur à construire', ready: false },
      { label: 'HYPERSOFT', state: 'Adaptateur à construire', ready: false },
      { label: 'ODOO', state: 'Adaptateur à construire', ready: false }
    ];
    return '<div class="exchange-workspace">' +
      '<div class="alert info"><div><strong>Format commun PERFECTO-ÉCHANGE v1</strong><br>Classeur Excel `.xlsx` avec feuilles Instructions, Dossier, Comptes, Journaux et Écritures, et format CSV UTF-8 ouvrable dans Excel. Ce format commun sert de passerelle ; les fichiers natifs de Sage, PERFECTO historique, HYPERSOFT et ODOO nécessiteront ensuite leurs propres adaptateurs.</div></div>' +
      '<div class="exchange-context-grid">' +
        '<div><small>Dossier actif</small><strong>' + esc(dossier.reference) + '</strong></div>' +
        '<div><small>Écritures validées exportables</small><strong>' + entries.length + ' pièce(s) · ' + lineCount + ' ligne(s)</strong></div>' +
        '<div><small>Brouillons non exportés</small><strong>' + drafts + '</strong></div>' +
      '</div>' +
      '<div class="exchange-grid">' +
        '<section class="exchange-card"><p class="page-kicker">ÉCRITURES</p><h4>Exporter le dossier vers Excel</h4>' +
          '<p>Le classeur regroupe les instructions, le dossier, le plan comptable, les journaux et les écritures validées. Les brouillons sont exclus.</p>' +
          '<div class="exchange-button-row"><button type="button" class="btn btn-primary" data-action="export-accounting-workbook">↓ Classeur Excel (.xlsx)</button>' +
          '<button type="button" class="btn btn-ghost" data-action="export-accounting-exchange">↓ Écritures CSV</button></div>' +
        '</section>' +
        '<section class="exchange-card"><p class="page-kicker">MODÈLES</p><h4>Préparer un fichier d’échange</h4>' +
          '<p>Le modèle Excel peut être complété puis réimporté. Les comptes et journaux sources peuvent être associés aux référentiels du dossier lors de l’aperçu.</p>' +
          '<div class="exchange-button-row"><button type="button" class="btn btn-primary" data-action="download-accounting-workbook-template">↓ Modèle Excel (.xlsx)</button>' +
          '<button type="button" class="btn btn-ghost" data-action="download-accounting-exchange-template">↓ Modèle CSV</button>' +
          '<button type="button" class="btn btn-ghost" data-action="export-accounting-chart">↓ Plan comptable</button>' +
          '<button type="button" class="btn btn-ghost" data-action="export-accounting-journals">↓ Journaux</button></div>' +
        '</section>' +
      '</div>' +
      viewExchangeFormatGuide() +
      '<section class="exchange-card exchange-systems"><p class="page-kicker">PROFILS LOGICIELS</p><h4>Prise en charge</h4>' +
        '<ul>' + systems.map(function (system) {
          return '<li><span>' + esc(system.label) + '</span><strong class="' + (system.ready ? 'is-ready' : 'is-planned') + '">' + esc(system.state) + '</strong></li>';
        }).join('') + '</ul>' +
        '<p class="small muted">Un adaptateur direct sera validé par version de logiciel et à partir d’un fichier réel anonymisé. Excel/CSV est disponible comme format commun, pas comme connexion directe au logiciel cible.</p>' +
      '</section>' +
      '<p class="exchange-footnote">Montants en XOF entiers ; dates au format AAAA-MM-JJ. Les données sont générées dans le navigateur et ne sont pas envoyées à un serveur.</p>' +
    '</div>';
  }

  function viewAccountingExchangeImport() {
    return '<div class="exchange-workspace">' +
      '<div class="alert info"><div><strong>Import sécurisé par aperçu</strong><br>Chargez le format commun PERFECTO-ÉCHANGE v1. Le fichier reste dans ce navigateur ; aucun compte ou journal n’est créé automatiquement. L’import ajoute des pièces au dossier actif, sans remplacer ses données.</div></div>' +
      '<div class="exchange-import-controls">' +
        '<div class="field"><label for="exchange-import-file">Fichier d’échange CSV ou Excel</label>' +
          '<input id="exchange-import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
          '<label id="exchange-import-label" class="btn btn-primary exchange-file-picker" for="exchange-import-file">↑ Choisir un CSV ou un classeur Excel</label>' +
          '<span class="hint">Jusqu’à 5 Mo · format PERFECTO-ÉCHANGE v1 · CSV ou classeur `.xlsx` sans macros.</span></div>' +
        '<div class="field"><label for="exchange-import-mode">Statut des écritures importées</label>' +
          '<select id="exchange-import-mode"><option value="draft" selected>Créer des brouillons (recommandé)</option><option value="posted">Importer comme écritures validées</option></select>' +
          '<span class="hint">La validation exige l’équilibre de chaque pièce et une période ouverte. Elle requiert aussi le droit « Valider une écriture ».</span></div>' +
      '</div>' +
      '<div id="exchange-import-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Aucun fichier analysé</strong><span>Choisissez un CSV ou un classeur .xlsx pour voir les écritures, les correspondances et les contrôles avant import.</span></div></div>' +
      viewExchangeFormatGuide() +
      '<p class="exchange-footnote">Importation initiale : écritures générales uniquement depuis le format commun Excel/CSV. Les tiers, données analytiques, devises et fichiers natifs Sage/PERFECTO/HYPERSOFT/ODOO ne sont pas encore importés directement.</p>' +
    '</div>';
  }

  function viewAccountingBalanceImport() {
    var dossier = S.currentDossier();
    var journals = S.journals();
    var defaultJournal = journals.find(function (journal) { return journal.code === 'OD'; }) || journals[0] || null;
    var session = balanceImportSession;
    var targetDate = session ? session.targetDate : dossier.cycleStart;
    var targetJournal = session ? session.targetJournal : (defaultJournal && defaultJournal.code || '');
    var targetReference = session ? session.targetReference : 'BAL-' + dossier.exerciseYear + '-001';
    var targetMode = session ? session.mode : 'draft';
    return '<div class="exchange-workspace balance-import-workspace">' +
      '<div class="alert warning"><div><strong>Reprise de soldes, distincte de l’import des écritures</strong><br>Ce parcours accepte une balance générale de soldes nets : une ligne par compte, avec un solde débiteur ou créditeur. Il ne reprend pas les mouvements de la période ni les colonnes débit/crédit cumulées.</div></div>' +
      '<div class="alert info"><div>Chaque solde sera transformé en ligne d’une seule pièce de reprise, dans le journal et à la date de destination choisis. L’import s’ajoute aux écritures existantes et ne remplace ni ne supprime aucune donnée. Pour éviter un cumul accidentel, vérifiez que cette reprise correspond bien au dossier actif.</div></div>' +
      '<section class="exchange-card"><p class="page-kicker">MODÈLES DE BALANCE</p><h4>Préparer le fichier source</h4>' +
        '<p>Utilisez le format versionné `PERFECTO-BALANCE` v1. La feuille Excel à importer s’appelle « Balance » ; les feuilles Dossier et Comptes sont fournies à titre de référence.</p>' +
        '<div class="exchange-button-row"><button type="button" class="btn btn-primary" data-action="download-accounting-balance-workbook-template">↓ Modèle Excel (.xlsx)</button>' +
        '<button type="button" class="btn btn-ghost" data-action="download-accounting-balance-template">↓ Modèle CSV</button></div>' +
      '</section>' +
      '<div class="exchange-import-controls balance-import-controls">' +
        '<div class="field"><label for="balance-import-file">Fichier de balance CSV ou Excel</label>' +
          '<input id="balance-import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
          '<label id="balance-import-label" class="btn btn-primary exchange-file-picker" for="balance-import-file">↑ Choisir un CSV ou un classeur Excel</label>' +
          '<span class="hint">Jusqu’à 5 Mo · modèle PERFECTO-BALANCE v1 · les formules et macros ne sont pas acceptées.</span></div>' +
        '<div class="field"><label for="balance-import-date">Date de comptabilisation de la reprise</label><input id="balance-import-date" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(targetDate) + '" required>' +
          '<span class="hint">La date de la balance source reste enregistrée dans son contexte ; cette date situe la pièce dans le dossier cible.</span></div>' +
        '<div class="field"><label for="balance-import-journal">Journal de reprise dans le dossier cible</label><select id="balance-import-journal" required>' + journals.map(function (journal) {
          return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journal.code + ' — ' + journal.label) + '</option>';
        }).join('') + '</select><span class="hint">Aucun journal n’est créé automatiquement.</span></div>' +
        '<div class="field"><label for="balance-import-reference">Référence de la pièce de reprise</label><input id="balance-import-reference" type="text" maxlength="100" value="' + esc(targetReference) + '" required>' +
          '<span class="hint">La référence doit être unique dans le dossier ; elle reste modifiable.</span></div>' +
        '<div class="field"><label for="balance-import-mode">Statut de la pièce créée</label><select id="balance-import-mode"><option value="draft"' + (targetMode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (targetMode === 'posted' ? ' selected' : '') + '>Importer comme écriture validée</option></select>' +
          '<span class="hint">La validation exige une période ouverte, l’équilibre de la pièce et le droit « Valider une écriture ».</span></div>' +
      '</div>' +
      '<div id="balance-import-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Aucune balance analysée</strong><span>Choisissez un fichier pour contrôler les comptes, les totaux et les correspondances avant toute écriture.</span></div></div>' +
      viewBalanceImportFormatGuide() +
      '<p class="exchange-footnote">Import comptable de la balance générale en soldes nets uniquement. Une balance de mouvements, une balance auxiliaire ou un état financier nécessitent un format distinct.</p>' +
    '</div>';
  }

  function viewBalanceImportFormatGuide() {
    var rules = [
      ['FORMAT / VERSION', 'Valeurs fixes : PERFECTO-BALANCE / 1.'],
      ['SYSTEME_SOURCE', 'Logiciel ou origine de la balance (par exemple SAGE, ODOO, HYPERSOFT ou EXCEL).'],
      ['REFERENCE_DOSSIER / EXERCICE / DATE_BALANCE', 'Contexte de la balance source ; les métadonnées sont répétées à l’identique sur chaque ligne.'],
      ['REFERENCE_BALANCE', 'Référence source identique sur toutes les lignes ; utilisée avec le logiciel source pour détecter un nouvel import en doublon.'],
      ['CODE_COMPTE / LIBELLE_COMPTE', 'Code et intitulé source ; chaque code doit être associé explicitement à un compte existant du plan cible.'],
      ['SOLDE_DEBITEUR_XOF / SOLDE_CREDITEUR_XOF', 'Soldes nets en XOF entiers sans séparateur ni décimale ; un seul côté par compte, les soldes nuls sont omis.'],
      ['ID_SOURCE', 'Facultatif ; s’il est rempli, garder une valeur identique sur toutes les lignes de la balance.']
    ];
    return '<details class="exchange-mapping exchange-format-guide"><summary>Voir les colonnes et contrôles du format PERFECTO-BALANCE v1</summary>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Colonne(s)</th><th>Règle</th></tr></thead><tbody>' +
      rules.map(function (row) { return '<tr><td><strong>' + esc(row[0]) + '</strong></td><td>' + esc(row[1]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted">Le total des soldes débiteurs doit égaler celui des soldes créditeurs. Une différence bloque la prévisualisation et l’import.</p></details>';
  }

  function exchangeMappingsHtml(session, kind) {
    var isAccount = kind === 'account';
    var sourceMap = isAccount ? session.accountMap : session.journalMap;
    var catalog = Object.create(null);
    session.parseResult.entries.forEach(function (entry) {
      if (!isAccount) {
        var journalCode = String(entry.journal || '');
        if (!catalog[journalCode]) catalog[journalCode] = entry.journalLabel || '';
      } else {
        entry.lines.forEach(function (line) {
          var accountCode = String(line.account || '');
          if (!catalog[accountCode]) catalog[accountCode] = line.accountLabel || '';
        });
      }
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    if (!codes.length) return '';
    var targetOptions = isAccount ? S.accounts() : S.journals();
    var label = isAccount ? 'comptes' : 'journaux';
    var hasUnmapped = codes.some(function (code) { return !sourceMap[code]; });
    return '<details class="exchange-mapping"' + (hasUnmapped ? ' open' : '') + '><summary>Correspondance des ' + label + ' (' + codes.length + ' codes source)</summary>' +
      '<p class="small muted">' + (isAccount
        ? 'Associez chaque code source à un compte du plan PERFECTO. Aucun compte n’est créé automatiquement.'
        : 'Associez chaque journal source à un journal du dossier.') + '</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Code source</th><th>Libellé source</th><th>Correspondance PERFECTO</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = sourceMap[code] || '';
        var sourceLabel = catalog[code] || '';
        var options = '<option value="">— Choisir une correspondance —</option>' + targetOptions.map(function (target) {
          var selected = target.code === mappedCode ? ' selected' : '';
          var targetLabel = target.label || target.type || '';
          var inactive = isAccount && target.active === false ? ' · inactif' : '';
          return '<option value="' + esc(target.code) + '"' + selected + '>' + esc(target.code + ' — ' + targetLabel + inactive) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(sourceLabel || '—') + '</td><td><select aria-label="Associer ' + esc(code) + '" data-exchange-' + (isAccount ? 'account' : 'journal') + '-map="' + esc(code) + '">' + options + '</select></td></tr>';
      }).join('') +
      '</tbody></table></div></details>';
  }

  function renderExchangeImportPreview() {
    var host = $('#exchange-import-preview');
    if (!host || !exchangeImportSession) return;
    var session = exchangeImportSession;
    var parsed = session.parseResult;
    if (!parsed.ok) {
      host.innerHTML = '<div class="alert error"><div><strong>Fichier non reconnu ou invalide</strong><ul>' +
        parsed.errors.slice(0, 20).map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') +
        (parsed.errors.length > 20 ? '<li>… et ' + (parsed.errors.length - 20) + ' autre(s) erreur(s).</li>' : '') +
        '</ul></div></div>';
      session.analysis = null;
      return;
    }

    var modeSelect = $('#exchange-import-mode');
    session.mode = modeSelect && modeSelect.value === 'posted' ? 'posted' : 'draft';
    var metadata = parsed.metadata || {};
    var target = S.currentDossier();
    var contextMismatch = metadata.dossierReference !== target.reference || Number(metadata.exercise) !== Number(target.exerciseYear);
    var options = {
      sourceSystem: metadata.sourceSystem,
      accountMap: session.accountMap,
      journalMap: session.journalMap
    };
    var analysis = S.previewExchangeImport(parsed.entries, session.mode, options);
    session.analysis = analysis;
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext());
    var permissionBlocked = session.mode === 'posted' && !canPost;
    var contextBlocked = contextMismatch && !session.contextConfirmed;
    var canCommit = analysis.ok && !permissionBlocked && !contextBlocked;
    var sourceStatus = parsed.entries.filter(function (entry) { return entry.sourceStatus === 'posted'; }).length;
    var summaries = '<div class="exchange-summary-grid">' +
      '<div><small>Fichier</small><strong>' + esc(session.fileName) + '</strong></div>' +
      '<div><small>Origine déclarée</small><strong>' + esc(metadata.sourceSystem || '—') + '</strong></div>' +
      '<div><small>Contenu</small><strong>' + parsed.entries.length + ' pièce(s) · ' + parsed.lineCount + ' ligne(s)</strong></div>' +
      '<div><small>Dossier source / actif</small><strong>' + esc(metadata.dossierReference || '—') + ' → ' + esc(target.reference) + '</strong></div>' +
      '</div>';
    var warningMarkup = analysis.warnings.length
      ? '<div class="alert warning"><div><strong>À vérifier</strong><ul>' + analysis.warnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var errorsMarkup = analysis.errors.length
      ? '<div class="alert error"><div><strong>' + analysis.errors.length + ' contrôle(s) bloquant(s)</strong><ul>' +
        analysis.errors.slice(0, 20).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') +
        (analysis.errors.length > 20 ? '<li>… et ' + (analysis.errors.length - 20) + ' autre(s) erreur(s).</li>' : '') +
        '</ul></div></div>'
      : '<div class="alert success"><div><strong>Aucun contrôle bloquant</strong><br>' + analysis.balancedCount + ' pièce(s) équilibrée(s)' +
        (session.mode === 'draft' && analysis.unbalancedCount ? ' · ' + analysis.unbalancedCount + ' brouillon(s) à équilibrer avant validation' : '') +
        '.</div></div>';
    var contextMarkup = contextMismatch
      ? '<label class="exchange-context-confirm"><input id="exchange-confirm-target" type="checkbox"' + (session.contextConfirmed ? ' checked' : '') + '> Je confirme que le fichier source (' + esc(metadata.dossierReference || 'sans référence') + ', exercice ' + esc(metadata.exercise) + ') concerne le dossier actif ' + esc(target.reference) + ' (exercice ' + esc(target.exerciseYear) + ').</label>'
      : '';
    var permissionMarkup = permissionBlocked
      ? '<div class="alert warning">Ce profil peut importer, mais ne possède pas le droit « Valider une écriture ». Choisissez le mode brouillon ou demandez ce droit.</div>'
      : '';
    var modeLabel = session.mode === 'posted' ? 'Importer et valider le lot' : 'Importer comme brouillons';
    var buttonLabel = modeLabel + ' (' + parsed.entries.length + ' pièce' + (parsed.entries.length === 1 ? '' : 's') + ')';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-exchange-import"' + (canCommit ? '' : ' disabled') + '>' + esc(buttonLabel) + '</button>';
    var importedSourceStatus = sourceStatus
      ? '<p class="small muted">Le fichier marque ' + sourceStatus + ' pièce(s) comme validée(s). Le statut appliqué sera celui choisi ci-dessus.</p>'
      : '';

    host.innerHTML = summaries +
      '<div class="exchange-mode-note">Mode sélectionné : <strong>' + (session.mode === 'posted' ? 'écritures validées' : 'brouillons') + '</strong>. Un point de restauration local sera créé avant l’ajout.</div>' +
      importedSourceStatus +
      exchangeMappingsHtml(session, 'account') + exchangeMappingsHtml(session, 'journal') +
      warningMarkup + errorsMarkup + contextMarkup + permissionMarkup +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);

    $$('[data-exchange-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-exchange-account-map')] = select.value;
        session.contextConfirmed = !!(host.querySelector('#exchange-confirm-target') && host.querySelector('#exchange-confirm-target').checked);
        renderExchangeImportPreview();
      });
    });
    $$('[data-exchange-journal-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.journalMap[select.getAttribute('data-exchange-journal-map')] = select.value;
        session.contextConfirmed = !!(host.querySelector('#exchange-confirm-target') && host.querySelector('#exchange-confirm-target').checked);
        renderExchangeImportPreview();
      });
    });
    var confirmContext = $('#exchange-confirm-target', host);
    if (confirmContext) {
      confirmContext.addEventListener('change', function () {
        session.contextConfirmed = confirmContext.checked;
        renderExchangeImportPreview();
      });
    }
  }

  function bindAccountingExchangeImport() {
    exchangeImportSession = null;
    var fileInput = $('#exchange-import-file');
    var modeSelect = $('#exchange-import-mode');
    var previewHost = $('#exchange-import-preview');
    if (!fileInput || !modeSelect || !previewHost) return;

    modeSelect.addEventListener('change', function () {
      if (!exchangeImportSession) return;
      exchangeImportSession.contextConfirmed = !!($('#exchange-confirm-target') && $('#exchange-confirm-target').checked);
      renderExchangeImportPreview();
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        exchangeImportSession = { fileName: file.name, parseResult: { ok: false, errors: ['Le fichier dépasse la limite de 5 Mo. Divisez-le en lots plus petits.'], entries: [], metadata: null } };
        renderExchangeImportPreview();
        return;
      }
      var reader = new FileReader();
      var isWorkbook = /\.xlsx$/i.test(file.name || '') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      reader.onload = function () {
        var parseResult = isWorkbook
          ? AccountingExchange.parseWorkbook(new Uint8Array(reader.result || new ArrayBuffer(0)))
          : AccountingExchange.parse(String(reader.result || ''));
        var accountMap = Object.create(null);
        var journalMap = Object.create(null);
        if (parseResult.ok) {
          parseResult.entries.forEach(function (entry) {
            if (!Object.prototype.hasOwnProperty.call(journalMap, entry.journal)) journalMap[entry.journal] = S.journal(entry.journal) ? entry.journal : '';
            entry.lines.forEach(function (line) {
              if (!Object.prototype.hasOwnProperty.call(accountMap, line.account)) accountMap[line.account] = S.account(line.account) ? line.account : '';
            });
          });
        }
        exchangeImportSession = {
          fileName: file.name,
          targetDossierId: S.currentDossier().id,
          parseResult: parseResult,
          accountMap: accountMap,
          journalMap: journalMap,
          mode: modeSelect.value === 'posted' ? 'posted' : 'draft',
          contextConfirmed: false,
          analysis: null
        };
        renderExchangeImportPreview();
      };
      reader.onerror = function () {
        exchangeImportSession = { fileName: file.name, parseResult: { ok: false, errors: ['Lecture du fichier impossible.'], entries: [], metadata: null } };
        renderExchangeImportPreview();
      };
      if (isWorkbook) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
    });
  }

  function balanceSourceEntry(session) {
    var metadata = session.parseResult.metadata || {};
    var sourceId = metadata.sourceId || [
      'PERFECTO-BALANCE', metadata.sourceSystem, metadata.dossierReference,
      metadata.exercise, metadata.balanceDate, metadata.balanceReference
    ].join(':');
    return {
      reference: String(session.targetReference || '').trim(),
      journal: String(session.targetJournal || '').trim(),
      date: String(session.targetDate || '').trim(),
      description: 'Reprise de la balance ' + String(metadata.balanceReference || '') + ' au ' + String(metadata.balanceDate || ''),
      sourceSystem: String(metadata.sourceSystem || 'EXCEL').trim().toUpperCase(),
      sourceId: String(sourceId),
      sourceMetadata: {
        format: metadata.format,
        version: metadata.version,
        sourceSystem: metadata.sourceSystem,
        dossierReference: metadata.dossierReference,
        exercise: metadata.exercise,
        balanceDate: metadata.balanceDate,
        balanceReference: metadata.balanceReference,
        sourceId: metadata.sourceId || ''
      },
      lines: session.parseResult.rows.map(function (row) {
        return {
          account: row.account,
          accountLabel: row.accountLabel,
          debit: row.debit,
          credit: row.credit,
          sourceRow: row.sourceRow
        };
      })
    };
  }

  function balanceAccountMappingsHtml(session) {
    var catalog = Object.create(null);
    session.parseResult.rows.forEach(function (row) {
      if (!catalog[row.account]) catalog[row.account] = row.accountLabel || '';
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    if (!codes.length) return '';
    var accounts = S.accounts();
    var hasUnmapped = codes.some(function (code) { return !session.accountMap[code]; });
    return '<details class="exchange-mapping"' + (hasUnmapped ? ' open' : '') + '><summary>Correspondance des comptes (' + codes.length + ' codes source)</summary>' +
      '<p class="small muted">Associez chaque compte source au plan comptable PERFECTO. Les comptes inconnus ne seront pas créés et plusieurs comptes ne sont associés qu’après votre choix explicite.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Code source</th><th>Libellé source</th><th>Correspondance PERFECTO</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = session.accountMap[code] || '';
        var options = '<option value="">— Choisir une correspondance —</option>' + accounts.map(function (account) {
          var inactive = account.active === false ? ' · inactif' : '';
          return '<option value="' + esc(account.code) + '"' + (account.code === mappedCode ? ' selected' : '') + '>' + esc(account.code + ' — ' + account.label + inactive) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(catalog[code] || '—') + '</td><td><select aria-label="Associer le compte source ' + esc(code) + '" data-balance-account-map="' + esc(code) + '">' + options + '</select></td></tr>';
      }).join('') +
      '</tbody></table></div></details>';
  }

  function balanceLinesPreviewHtml(session) {
    var rows = session.parseResult.rows || [];
    var visibleRows = rows.slice(0, 20);
    var body = visibleRows.map(function (row) {
      var mappedCode = session.accountMap[row.account] || '';
      var mappedAccount = mappedCode ? S.account(mappedCode) : null;
      var mappingLabel = mappedAccount ? mappedAccount.code + ' — ' + mappedAccount.label : 'À associer';
      return '<tr><td><strong>' + esc(row.account) + '</strong></td><td>' + esc(row.accountLabel || '—') + '</td><td class="numeric">' + esc(amount(row.debit)) + '</td><td class="numeric">' + esc(amount(row.credit)) + '</td><td>' + esc(mappingLabel) + '</td></tr>';
    }).join('');
    var rowLimitNote = rows.length > visibleRows.length
      ? '<p class="small muted">Affichage des ' + visibleRows.length + ' premières lignes sur ' + rows.length + ' ; les correspondances de tous les comptes sont disponibles juste en dessous.</p>'
      : '';
    return '<section class="exchange-card balance-lines-preview"><p class="page-kicker">APERÇU DE LA BALANCE</p><h4>' + rows.length + ' compte(s) source</h4>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Code source</th><th>Libellé source</th><th class="numeric">Solde débiteur (XOF)</th><th class="numeric">Solde créditeur (XOF)</th><th>Compte cible</th></tr></thead><tbody>' + body + '</tbody></table></div>' + rowLimitNote + '</section>';
  }

  function renderBalanceImportPreview() {
    var host = $('#balance-import-preview');
    var session = balanceImportSession;
    if (!host || !session) return;
    var parsed = session.parseResult;
    if (!parsed || !parsed.ok) {
      var parseErrors = parsed && parsed.errors || ['La balance n’a pas pu être analysée.'];
      host.innerHTML = '<div class="alert error"><div><strong>Balance non reconnue ou invalide</strong><ul>' +
        parseErrors.slice(0, 20).map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') +
        (parseErrors.length > 20 ? '<li>… et ' + (parseErrors.length - 20) + ' autre(s) erreur(s).</li>' : '') +
        '</ul></div></div>';
      session.analysis = null;
      return;
    }

    var dateInput = $('#balance-import-date');
    var journalInput = $('#balance-import-journal');
    var referenceInput = $('#balance-import-reference');
    var modeSelect = $('#balance-import-mode');
    if (dateInput) session.targetDate = dateInput.value;
    if (journalInput) session.targetJournal = journalInput.value;
    if (referenceInput) session.targetReference = referenceInput.value;
    if (modeSelect) session.mode = modeSelect.value === 'posted' ? 'posted' : 'draft';

    var metadata = parsed.metadata || {};
    var target = S.currentDossier();
    var contextMismatch = metadata.dossierReference !== target.reference || Number(metadata.exercise) !== Number(target.exerciseYear);
    var existingPostedCount = S.entries().filter(function (entry) {
      return entry.status === 'posted' && entry.date >= target.cycleStart && entry.date <= target.cycleEnd;
    }).length;
    var sourceEntry = balanceSourceEntry(session);
    var options = { sourceSystem: metadata.sourceSystem, accountMap: session.accountMap, journalMap: Object.create(null) };
    var analysis = S.previewExchangeImport([sourceEntry], session.mode, options);
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext());
    var permissionBlocked = session.mode === 'posted' && !canPost;
    var contextBlocked = contextMismatch && !session.contextConfirmed;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    var canCommit = analysis.ok && !permissionBlocked && !contextBlocked && !additiveBlocked;
    var summary = '<div class="exchange-summary-grid">' +
      '<div><small>Fichier</small><strong>' + esc(session.fileName || '—') + '</strong></div>' +
      '<div><small>Balance source</small><strong>' + esc(metadata.sourceSystem || '—') + ' · ' + esc(metadata.balanceReference || '—') + '</strong></div>' +
      '<div><small>Soldes nets équilibrés</small><strong>' + parsed.lineCount + ' compte(s) · ' + amount(parsed.totalDebit) + ' XOF</strong></div>' +
      '<div><small>Dossier source / actif</small><strong>' + esc(metadata.dossierReference || '—') + ' → ' + esc(target.reference) + '</strong></div>' +
      '<div><small>Date source / reprise</small><strong>' + esc(metadata.balanceDate || '—') + ' → ' + esc(session.targetDate || '—') + '</strong></div>' +
      '<div><small>Écriture cible</small><strong>' + esc(session.targetJournal || '—') + ' · ' + esc(session.targetReference || '—') + '</strong></div>' +
      '</div>';
    var warnings = analysis.warnings.length
      ? '<div class="alert warning"><div><strong>À vérifier</strong><ul>' + analysis.warnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var errors = analysis.errors.length
      ? '<div class="alert error"><div><strong>' + analysis.errors.length + ' contrôle(s) bloquant(s)</strong><ul>' +
        analysis.errors.slice(0, 20).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') +
        (analysis.errors.length > 20 ? '<li>… et ' + (analysis.errors.length - 20) + ' autre(s) erreur(s).</li>' : '') +
        '</ul></div></div>'
      : '<div class="alert success"><div><strong>Contrôles réussis</strong><br>' + analysis.balancedCount + ' pièce équilibrée · ' + parsed.lineCount + ' solde(s) net(s) · débit et crédit ' + amount(parsed.totalDebit) + ' XOF.</div></div>';
    var context = contextMismatch
      ? '<label class="exchange-context-confirm"><input id="balance-import-confirm-target" type="checkbox"' + (session.contextConfirmed ? ' checked' : '') + '> Je confirme la reprise de la balance source (' + esc(metadata.dossierReference || 'sans référence') + ', exercice ' + esc(metadata.exercise) + ', au ' + esc(metadata.balanceDate) + ') dans le dossier actif ' + esc(target.reference) + ' (exercice ' + esc(target.exerciseYear) + ').</label>'
      : '';
    var additiveWarning = existingPostedCount
      ? '<div class="alert warning"><div><strong>Le dossier contient déjà ' + existingPostedCount + ' écriture(s) validée(s) sur le cycle.</strong><br>À sa validation, la pièce de reprise s’ajoutera à ces écritures, sans les remplacer. Pour éviter un double comptage, vérifiez que cette reprise est intentionnelle ou utilisez un dossier cible vide.<label class="exchange-context-confirm"><input id="balance-import-confirm-additive" type="checkbox"' + (session.additiveConfirmed ? ' checked' : '') + '> Je confirme que la reprise est additive et ne doit pas remplacer les écritures existantes.</label></div></div>'
      : '';
    var permission = permissionBlocked
      ? '<div class="alert warning">Ce profil peut importer, mais ne possède pas le droit « Valider une écriture ». Choisissez le mode brouillon ou demandez ce droit.</div>'
      : '';
    var statusLabel = session.mode === 'posted' ? 'écriture validée' : 'brouillon';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-balance-import"' + (canCommit ? '' : ' disabled') + '>Ajouter la pièce de reprise comme ' + statusLabel + '</button>';

    host.innerHTML = summary +
      '<div class="exchange-mode-note">L’import créera une seule pièce avec une ligne par compte, comme ' + statusLabel + '. Elle ne modifiera aucun solde avant validation si elle est enregistrée en brouillon.</div>' +
      balanceLinesPreviewHtml(session) + balanceAccountMappingsHtml(session) + warnings + errors + context + additiveWarning + permission +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);

    $$('[data-balance-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-balance-account-map')] = select.value;
        session.contextConfirmed = !!(host.querySelector('#balance-import-confirm-target') && host.querySelector('#balance-import-confirm-target').checked);
        session.additiveConfirmed = !!(host.querySelector('#balance-import-confirm-additive') && host.querySelector('#balance-import-confirm-additive').checked);
        renderBalanceImportPreview();
      });
    });
    var confirmContext = $('#balance-import-confirm-target', host);
    if (confirmContext) {
      confirmContext.addEventListener('change', function () {
        session.contextConfirmed = confirmContext.checked;
        renderBalanceImportPreview();
      });
    }
    var confirmAdditive = $('#balance-import-confirm-additive', host);
    if (confirmAdditive) {
      confirmAdditive.addEventListener('change', function () {
        session.additiveConfirmed = confirmAdditive.checked;
        renderBalanceImportPreview();
      });
    }
  }

  function bindAccountingBalanceImport() {
    var fileInput = $('#balance-import-file');
    var previewHost = $('#balance-import-preview');
    var modeSelect = $('#balance-import-mode');
    if (!fileInput || !previewHost || !modeSelect) return;

    function syncBalanceControls() {
      if (!balanceImportSession) return;
      balanceImportSession.targetDate = ($('#balance-import-date') || {}).value || '';
      balanceImportSession.targetJournal = ($('#balance-import-journal') || {}).value || '';
      balanceImportSession.targetReference = ($('#balance-import-reference') || {}).value || '';
      balanceImportSession.mode = modeSelect.value === 'posted' ? 'posted' : 'draft';
      balanceImportSession.contextConfirmed = !!($('#balance-import-confirm-target') && $('#balance-import-confirm-target').checked);
      balanceImportSession.additiveConfirmed = !!($('#balance-import-confirm-additive') && $('#balance-import-confirm-additive').checked);
      renderBalanceImportPreview();
    }

    modeSelect.addEventListener('change', syncBalanceControls);
    ['balance-import-date', 'balance-import-journal', 'balance-import-reference'].forEach(function (id) {
      var control = $('#' + id);
      if (control) control.addEventListener('change', syncBalanceControls);
    });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var isWorkbook = /\.xlsx$/i.test(file.name || '') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      var currentDossier = S.currentDossier();
      var initialJournal = ($('#balance-import-journal') || {}).value || '';
      var initialDate = ($('#balance-import-date') || {}).value || currentDossier.cycleStart;
      var initialReference = ($('#balance-import-reference') || {}).value || '';
      var initialMode = modeSelect.value === 'posted' ? 'posted' : 'draft';
      if (file.size > 5 * 1024 * 1024) {
        balanceImportSession = {
          fileName: file.name,
          targetDossierId: currentDossier.id,
          targetDate: initialDate,
          targetJournal: initialJournal,
          targetReference: initialReference,
          mode: initialMode,
          accountMap: Object.create(null),
          contextConfirmed: false,
          additiveConfirmed: false,
          parseResult: { ok: false, errors: ['Le fichier dépasse la limite de 5 Mo. Divisez-le en lots plus petits.'] }
        };
        renderBalanceImportPreview();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var parseResult = isWorkbook
          ? AccountingExchange.parseBalanceWorkbook(new Uint8Array(reader.result || new ArrayBuffer(0)))
          : AccountingExchange.parseBalance(String(reader.result || ''));
        var accountMap = Object.create(null);
        if (parseResult.ok) {
          parseResult.rows.forEach(function (row) {
            if (!Object.prototype.hasOwnProperty.call(accountMap, row.account)) accountMap[row.account] = S.account(row.account) ? row.account : '';
          });
        }
        balanceImportSession = {
          fileName: file.name,
          targetDossierId: currentDossier.id,
          targetDate: initialDate,
          targetJournal: initialJournal,
          targetReference: initialReference,
          mode: initialMode,
          accountMap: accountMap,
          contextConfirmed: false,
          additiveConfirmed: false,
          parseResult: parseResult,
          analysis: null
        };
        renderBalanceImportPreview();
      };
      reader.onerror = function () {
        balanceImportSession = {
          fileName: file.name,
          targetDossierId: currentDossier.id,
          targetDate: initialDate,
          targetJournal: initialJournal,
          targetReference: initialReference,
          mode: initialMode,
          accountMap: Object.create(null),
          contextConfirmed: false,
          additiveConfirmed: false,
          parseResult: { ok: false, errors: ['Lecture du fichier impossible.'] }
        };
        renderBalanceImportPreview();
      };
      if (isWorkbook) reader.readAsArrayBuffer(file);
      else reader.readAsText(file, 'UTF-8');
    });
  }

  function commitAccountingBalanceImport() {
    var session = balanceImportSession;
    if (!session || !session.parseResult || !session.parseResult.ok) {
      toast('Aucune balance valide n’est prête à être importée.', 'error');
      return;
    }
    if (session.targetDossierId !== S.currentDossier().id) {
      toast('Le dossier actif a changé depuis l’analyse. Rechargez la balance pour éviter une reprise dans le mauvais dossier.', 'error');
      balanceImportSession = null;
      render();
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext())) {
      toast('Import refusé par défaut : ce profil ne possède pas le droit data.import.', 'warning');
      return;
    }
    var mode = ($('#balance-import-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    if (mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext())) {
      toast('Validation refusée : le droit « Valider une écriture » est requis pour importer cette balance comme écriture validée.', 'warning');
      return;
    }
    session.targetDate = ($('#balance-import-date') || {}).value || '';
    session.targetJournal = ($('#balance-import-journal') || {}).value || '';
    session.targetReference = ($('#balance-import-reference') || {}).value || '';
    session.mode = mode;
    var metadata = session.parseResult.metadata || {};
    var sourceEntry = balanceSourceEntry(session);
    var options = { sourceSystem: metadata.sourceSystem, accountMap: session.accountMap, journalMap: Object.create(null) };
    var analysis = S.previewExchangeImport([sourceEntry], mode, options);
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var target = S.currentDossier();
    var contextMismatch = metadata.dossierReference !== target.reference || Number(metadata.exercise) !== Number(target.exerciseYear);
    var existingPostedCount = S.entries().filter(function (entry) {
      return entry.status === 'posted' && entry.date >= target.cycleStart && entry.date <= target.cycleEnd;
    }).length;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    if (!analysis.ok || (contextMismatch && !session.contextConfirmed) || additiveBlocked) {
      renderBalanceImportPreview();
      toast(contextMismatch && !session.contextConfirmed
        ? 'Confirmez le dossier source et l’exercice de destination avant la reprise.'
        : (additiveBlocked ? 'Confirmez que la balance doit être ajoutée aux écritures déjà validées.' : 'La reprise est bloquée par les contrôles affichés dans l’aperçu.'), 'warning');
      return;
    }
    var modeLabel = mode === 'posted' ? 'écriture validée' : 'brouillon';
    var existingNote = existingPostedCount ? ' Les ' + existingPostedCount + ' écritures déjà validées seront conservées ; la reprise, une fois validée, se cumulera avec elles.' : '';
    if (!window.confirm('Ajouter une pièce de reprise (' + session.parseResult.lineCount + ' compte(s), ' + amount(session.parseResult.totalDebit) + ' XOF) comme ' + modeLabel + ' au dossier « ' + target.reference + ' » ?' + existingNote + ' Aucune donnée ne sera remplacée. Un point de restauration local sera créé avant l’ajout.')) return;
    var result = S.importExchange([sourceEntry], mode, options);
    if (!result.ok) {
      toast(result.errors[0] || 'Reprise de balance impossible.', 'error');
      renderBalanceImportPreview();
      return;
    }
    balanceImportSession = null;
    toast('Balance reprise dans une pièce ' + modeLabel + ' ; point de restauration local créé.', 'success');
    render();
  }

  function commitAccountingExchangeImport() {
    var session = exchangeImportSession;
    if (!session || !session.parseResult || !session.parseResult.ok) {
      toast('Aucun fichier d’échange valide n’est prêt à être importé.', 'error');
      return;
    }
    if (session.targetDossierId !== S.currentDossier().id) {
      toast('Le dossier actif a changé depuis l’analyse. Rechargez le fichier pour éviter un import dans le mauvais dossier.', 'error');
      exchangeImportSession = null;
      render();
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext())) {
      toast('Import refusé par défaut : ce profil ne possède pas le droit data.import.', 'warning');
      return;
    }
    var modeSelect = $('#exchange-import-mode');
    var mode = modeSelect && modeSelect.value === 'posted' ? 'posted' : 'draft';
    if (mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext())) {
      toast('Validation refusée : le droit « Valider une écriture » est requis pour importer des pièces validées.', 'warning');
      return;
    }
    var metadata = session.parseResult.metadata || {};
    var options = {
      sourceSystem: metadata.sourceSystem,
      accountMap: session.accountMap,
      journalMap: session.journalMap
    };
    var analysis = S.previewExchangeImport(session.parseResult.entries, mode, options);
    var target = S.currentDossier();
    var contextMismatch = metadata.dossierReference !== target.reference || Number(metadata.exercise) !== Number(target.exerciseYear);
    if (!analysis.ok || (contextMismatch && !session.contextConfirmed)) {
      session.mode = mode;
      session.analysis = analysis;
      session.contextConfirmed = session.contextConfirmed && contextMismatch;
      renderExchangeImportPreview();
      toast(contextMismatch && !session.contextConfirmed
        ? 'Confirmez d’abord le dossier et l’exercice de destination.'
        : 'L’import est bloqué par les contrôles affichés dans l’aperçu.', 'warning');
      return;
    }
    var statusLabel = mode === 'posted' ? 'écritures validées' : 'brouillons';
    if (!window.confirm('Ajouter ' + session.parseResult.entries.length + ' pièce(s) comme ' + statusLabel + ' au dossier « ' + target.reference + ' » ? Les données existantes ne seront pas remplacées. Un point de restauration local sera créé avant l’ajout.')) return;

    var result = S.importExchange(session.parseResult.entries, mode, options);
    if (!result.ok) {
      toast(result.errors[0] || 'Import impossible.', 'error');
      renderExchangeImportPreview();
      return;
    }
    exchangeImportSession = null;
    toast(result.importedCount + ' pièce(s) importée(s) comme ' + statusLabel + ' ; sauvegarde locale créée.', 'success');
    render();
  }

  function viewAccountingMenu(params) {
    params = params || {};
    var phone = isPhoneViewport();
    var group = AccountingNavigation.getGroup(phone ? 'editions' : params.g);
    var tab = AccountingNavigation.getTab(group.id, params.t || group.defaultTab);
    var isSelected = function (item) { return item.id === tab.id; };
    var context = S.currentDossier();
    var reportNote = group.id === 'editions'
      ? (phone
        ? '<div class="alert info menu-readonly-note">Consultation seule. Cette démonstration affiche uniquement les données enregistrées dans ce navigateur ; aucune synchronisation entre appareils n’est encore disponible.</div>'
        : '<div class="alert info menu-readonly-note">Ce menu sert à consulter les données comptables traitées. La saisie et les modifications restent dans leurs menus dédiés.</div>')
      : '';
    var tabs = group.tabs.map(function (item) {
      var active = isSelected(item);
      return '<a role="tab" id="accounting-tab-' + esc(item.id) + '" aria-controls="accounting-menu-tabpanel" aria-selected="' + (active ? 'true' : 'false') + '"' +
        (active ? ' aria-current="page"' : '') +
        ' class="accounting-subtab' + (active ? ' is-active' : '') + '" data-menu-status="' + esc(item.status) + '" title="' + esc(AccountingNavigation.statusLabels[item.status] + (item.reason ? ' — ' + item.reason : '')) + '" href="' + esc(accountingMenuHash(group.id, item.id)) + '">' +
        '<span class="accounting-subtab-label">' + esc(item.label) + '</span>' +
        '<small class="accounting-subtab-state">' + esc(menuShortStatus(item.status)) + '</small>' +
        '</a>';
    }).join('');
    var statusLegend = '<div class="menu-status-legend" aria-label="Légende des statuts">' +
      '<span><i class="legend-dot legend-dot-active"></i>Disponible</span>' +
      '<span><i class="legend-dot legend-dot-planned"></i>À construire</span>' +
      '<span><i class="legend-dot legend-dot-inactive"></i>Inactif ou à confirmer</span>' +
      '</div>';
    var actions = (tab.actions || []).map(function (action) { return menuActionLink(action, tab.status); }).join('');
    var childList = menuChildList(tab.children, tab.reason);
    var phoneContext = phone
      ? '<span class="menu-phone-label">CONSULTATION TÉLÉPHONE · LECTURE SEULE</span>'
      : '';
    var irreversible = tab.irreversible
      ? '<div class="alert warning menu-irreversible-note"><strong>Attention : opération irréversible.</strong> Une copie complète du dossier devra être exportée et confirmée avant toute activation de cette fonction.</div>'
      : '';
    var details = tab.reason
      ? '<p class="menu-item-reason">' + esc(tab.reason) + '</p>'
      : '';
    var exchangeFeature = group.id === 'fichier' && tab.id === 'export-other'
      ? viewAccountingExchangeExport()
      : (group.id === 'fichier' && tab.id === 'import-other'
        ? viewAccountingExchangeImport()
        : (group.id === 'fichier' && tab.id === 'import-balance' ? viewAccountingBalanceImport() : ''));
    var emptyActionNote = !actions && !childList && !exchangeFeature
      ? '<p class="menu-disabled-note">Aucune action n’est disponible pour cet élément.</p>'
      : '';

    return '<section class="accounting-menu-page" aria-label="Menu ' + esc(group.label) + '">' +
      '<div class="accounting-menu-heading"><div><p class="page-kicker">COMPTABILITÉ GÉNÉRALE · ' + esc(context.reference || '') + '</p><h2>' + esc(group.label) + '</h2></div>' + phoneContext + '</div>' +
      reportNote +
      '<div class="accounting-menu-layout">' +
        '<nav class="accounting-subtabs" role="tablist" aria-orientation="vertical" aria-label="Sous-menus ' + esc(group.label) + '">' + tabs + '</nav>' +
        '<div class="accounting-menu-detail">' +
          statusLegend +
          '<section class="accounting-menu-panel" id="accounting-menu-tabpanel" role="tabpanel" aria-labelledby="accounting-tab-' + esc(tab.id) + '">' +
            '<div class="accounting-menu-panel-head"><div><p class="page-kicker">SOUS-MENU</p><h3>' + esc(tab.label) + '</h3></div>' + menuStatusBadge(tab.status) + '</div>' +
            details + irreversible +
            (childList ? '<div class="menu-children-wrap"><h4>Éléments de ce sous-menu</h4>' + childList + '</div>' : '') +
            exchangeFeature +
            (actions ? '<div class="menu-actions">' + actions + '</div>' : '') +
            emptyActionNote +
          '</section>' +
          '<p class="menu-data-boundary">Les opérations et écritures de ce dossier restent isolées de celles des autres clients.</p>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* ------------------------------ Liaisons vue ----------------------------- */
  function bindView(route) {
    if (route === 'launcher') {
      bindLauncherView();
      return;
    }
    if (route === 'dossiers') {
      bindDossiersView();
      return;
    }
    if (route === 'organization') {
      bindOrganizationView();
      return;
    }
    if (route === 'menu') {
      var menuParams = parseHash().params;
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-other') bindAccountingExchangeImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-balance') bindAccountingBalanceImport();
      return;
    }

    if (route === 'entry') {
      var form = $('#entry-form');
      if (!form) return;
      updateEntryTotals();
      updatePeriodNotice();

      var refInput = $('#e-reference');
      if (refInput) {
        refInput.addEventListener('input', function () { refInput.setAttribute('data-auto', 'false'); });
      }
      ['e-journal', 'e-date'].forEach(function (id) {
        var input = document.getElementById(id);
        if (input) input.addEventListener('change', function () {
          syncReferenceFromContext();
          updatePeriodNotice();
        });
      });

      $$('#lines-body [data-field="debit"], #lines-body [data-field="credit"]').forEach(function (input) {
        input.addEventListener('input', function () {
          var isDebit = input.getAttribute('data-field') === 'debit';
          var row = input.closest('.line-row');
          if (row && Number(input.value) > 0) {
            row.querySelector('[data-field="' + (isDebit ? 'credit' : 'debit') + '"]').value = '';
          }
          updateEntryTotals();
        });
      });

      $$('#lines-body [data-field="account"]').forEach(function (select) {
        select.addEventListener('change', updateEntryTotals);
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var submitter = event.submitter;
        var mode = submitter && submitter.getAttribute('data-mode') === 'posted' ? 'posted' : 'draft';
        var payload = collectEntryForm();
        var editingId = payload.id;
        var requiredWriteActions = [editingId ? 'draft.edit' : 'draft.create'];
        if (mode === 'posted') requiredWriteActions.push('entry.validate');
        if (!requiredWriteActions.every(function (actionId) { return hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext()); })) {
          showFormErrors(['Action refusée par défaut : les droits de démonstration requis ne sont pas accordés.']);
          return;
        }

        if (mode === 'posted') {
          var check = S.validateEntry(payload, { requireBalanced: true, status: 'posted' });
          if (!check.ok) { showFormErrors(check.errors); return; }
        }

        var result;
        if (editingId) {
          result = S.updateDraft(editingId, payload);
          if (result.ok && mode === 'posted') result = S.postEntry(editingId);
        } else {
          result = S.createEntry(payload, mode);
        }

        if (!result.ok) { showFormErrors(result.errors); return; }

        toast(mode === 'posted' ? 'Pièce ' + result.entry.reference + ' validée.' : 'Brouillon ' + result.entry.reference + ' enregistré.', 'success');
        navigate('#/entries');
      });

      return;
    }

    if (route === 'settings') {
      var fileInput = $('#import-file');
      if (fileInput) {
        fileInput.addEventListener('change', function () {
          var file = fileInput.files && fileInput.files[0];
          if (!file) return;
          var reader = new FileReader();
          reader.onload = function () {
            if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext())) {
              toast('Import refusé par défaut : ce profil ne peut pas gérer les données.', 'warning');
              return;
            }
            var result = S.importJson(String(reader.result || ''));
            if (!result.ok) { toast(result.errors[0] || 'Import impossible.', 'error'); return; }
            toast('Données importées avec succès.', 'success');
            render();
          };
          reader.onerror = function () { toast('Lecture du fichier impossible.', 'error'); };
          reader.readAsText(file);
        });
      }
      var installBtn = $('[data-action="install-app"]');
      if (installBtn) installBtn.hidden = !deferredInstallPrompt;
    }
  }

  function bindLauncherView() {
    var profileSelect = $('#demo-active-profile');
    if (profileSelect) {
      profileSelect.addEventListener('change', function () {
        var selected = demoMembers.find(function (member) { return member.id === profileSelect.value; });
        if (!selected) return;
        activeDemoMemberId = selected.id;
        ensureDemoDossierForMember(selected);
        toast('Profil simulé actif : ' + demoRoleLabel(selected.role) + '. Aucun compte réel n’est connecté.', 'info');
        render();
      });
    }
    var folderSelect = $('#demo-active-folder');
    if (folderSelect) {
      folderSelect.addEventListener('change', function () {
        var dossier = permittedDemoDossiers(getActiveDemoMember()).find(function (item) { return item.id === folderSelect.value; });
        if (!dossier) { toast('Ce profil n’a pas accès à ce dossier client.', 'warning'); render(); return; }
        var result = S.switchDossier(dossier.id);
        if (!result.ok) { toast(result.errors[0] || 'Changement de dossier impossible.', 'error'); render(); return; }
        activeDemoDossierId = dossier.id;
        toast('Dossier actif : ' + dossier.clientName + ' · ' + dossier.reference + '. Les données restent isolées localement pour la démonstration.', 'info');
        render();
      });
    }
    var search = $('#launcher-search');
    if (search) {
      search.value = launcherUi.query;
      search.addEventListener('input', function () {
        launcherUi.query = search.value;
        applyLauncherFilters();
      });
    }
    applyLauncherFilters();
  }

  function bindOrganizationView() {
    $$('[data-demo-member-role]').forEach(function (select) {
      select.addEventListener('change', function () {
        if (!hasDemoPermission(getActiveDemoMember(), 'organization', 'organization.manageMembers', demoAccessContext('organization'))) {
          toast('Modification refusée par défaut : le droit de gestion des membres n’est pas accordé.', 'warning');
          render();
          return;
        }
        var id = select.getAttribute('data-id');
        var member = demoMembers.find(function (item) { return item.id === id; });
        if (!member) return;
        member.role = select.value === 'manager' ? 'manager' : 'employee';
        toast('Rôle de démonstration modifié. Aucun droit implicite n’a été ajouté.', 'success');
        render();
      });
    });
  }

  function applyLauncherFilters() {
    var query = String(launcherUi.query || '').trim().toLowerCase();
    var visibleModules = 0;
    $$('[data-module-card]').forEach(function (card) {
      var status = card.getAttribute('data-module-status');
      var text = String(card.getAttribute('data-module-search') || '').toLowerCase();
      var matchesFilter = launcherUi.filter === 'all'
        ? true
        : status === launcherUi.filter;
      var matchesQuery = !query || text.indexOf(query) !== -1;
      var visible = matchesFilter && matchesQuery;
      card.hidden = !visible;
      if (visible && card.getAttribute('data-is-module') === 'true') visibleModules += 1;
    });

    var count = $('#launcher-result-count');
    if (count) {
      count.textContent = visibleModules === 1
        ? '1 module affiché'
        : visibleModules + ' modules affichés';
    }
    var empty = $('#launcher-empty-state');
    if (empty) empty.hidden = visibleModules !== 0;
  }

  /* ------------------------- Actions & interactions ------------------------ */
  function closeSidebar() {
    var sidebar = $('#sidebar');
    var scrim = $('#sidebar-scrim');
    if (sidebar) {
      sidebar.classList.remove('open');
      sidebar.hidden = document.body.classList.contains('dossiers-list-mode') || document.body.classList.contains('phone-editions-mode');
    }
    if (scrim) scrim.remove();
    var toggle = $('[data-action="toggle-sidebar"]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Ouvrir la navigation');
    }
  }

  function toggleSidebar() {
    var sidebar = $('#sidebar');
    if (!sidebar) return;
    if (!sidebar.classList.contains('open')) sidebar.hidden = false;
    var isOpen = sidebar.classList.toggle('open');
    if (!isOpen && document.body.classList.contains('dossiers-list-mode')) sidebar.hidden = true;
    var toggle = $('[data-action="toggle-sidebar"]');
    if (toggle) {
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'Fermer la navigation' : 'Ouvrir la navigation');
    }
    var scrim = $('#sidebar-scrim');
    if (isOpen && !scrim) {
      scrim = document.createElement('div');
      scrim.id = 'sidebar-scrim';
      scrim.className = 'sidebar-scrim';
      scrim.setAttribute('data-action', 'close-sidebar');
      document.body.appendChild(scrim);
    } else if (!isOpen && scrim) {
      scrim.remove();
    }
  }

  function onFilterChange(target) {
    var spec = target.getAttribute('data-filter');
    if (!spec) return;
    var parts = spec.split(':');
    var section = parts[0];
    var key = parts[1];
    if (!ui[section]) return;
    ui[section][key] = target.value;
    rerenderKeepFocus();
  }

  document.addEventListener('input', function (event) {
    var target = event.target;
    if (target && target.matches('[data-filter]')) onFilterChange(target);
  });

  document.addEventListener('change', function (event) {
    var target = event.target;
    if (target && target.matches('select[data-filter]')) onFilterChange(target);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeModal();
    if (event.key === 'Enter' || event.key === ' ') {
      var target = event.target;
      if (target && target.matches('[data-action="open-entry"]') && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
        event.preventDefault();
        openEntryModal(target.getAttribute('data-id'));
      }
    }
  });

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    var action = trigger.getAttribute('data-action');
    var id = trigger.getAttribute('data-id');
    if (!canPerformDemoAction(action, trigger)) { event.preventDefault(); return; }

    switch (action) {
      case 'launcher-filter':
        launcherUi.filter = trigger.getAttribute('data-filter-value') || 'all';
        $$('[data-action="launcher-filter"]').forEach(function (button) {
          var active = button.getAttribute('data-filter-value') === launcherUi.filter;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        applyLauncherFilters();
        break;
      case 'demo-login':
        navigate('#/launcher');
        break;
      case 'add-demo-member':
        openDemoMemberModal();
        break;
      case 'configure-demo-access':
        openDemoAccessModal(id);
        break;
      case 'remove-demo-member': {
        var memberIndex = demoMembers.findIndex(function (member) { return member.id === id && member.role !== 'supervisor'; });
        if (memberIndex < 0) break;
        if (!window.confirm('Retirer ce profil temporaire de la démonstration ? Aucun compte réel n’est concerné.')) break;
        demoMembers.splice(memberIndex, 1);
        toast('Profil temporaire retiré de la démonstration.', 'success');
        render();
        break;
      }
      case 'open-module': {
        var selectedModule = ModuleRegistry.get(trigger.getAttribute('data-module-id'));
        if (selectedModule && selectedModule.status === 'available' && selectedModule.route) {
          navigate('#/' + selectedModule.route);
        } else if (selectedModule) {
          toast(selectedModule.name + ' n’est pas encore disponible.', 'warning');
        }
        break;
      }
      case 'open-dossier': {
        var dossier = permittedDemoDossiers(getActiveDemoMember()).find(function (item) { return item.id === id; });
        if (!dossier || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'module.view', accountingAccessContext(dossier))) {
          toast('Ouverture refusée : ce profil ne possède pas de droit sur ce dossier client.', 'warning');
          break;
        }
        var switchedDossier = S.switchDossier(dossier.id);
        if (!switchedDossier.ok) { toast(switchedDossier.errors[0] || 'Ouverture du dossier impossible.', 'error'); break; }
        activeDemoDossierId = dossier.id;
        navigate(isPhoneViewport() ? accountingMenuHash('editions', 'general-accounts') : '#/dashboard');
        break;
      }
      case 'launcher-info':
        openModal('Stockage de l’organisation', 'Google Drive sera le premier fournisseur cloud.',
          '<div class="alert warning"><strong>Non connecté.</strong> Cette démonstration ne communique pas avec Google Drive et ne transfère aucune donnée.</div><p>La connexion au Drive de l’organisation, les droits d’accès et la stratégie de sauvegarde seront conçus avant toute synchronisation réelle.</p>',
          '<button type="button" class="btn btn-primary" data-action="close-modal">Compris</button>');
        break;
      case 'logout-demo':
        navigate('#/login');
        break;
      case 'toggle-sidebar':
        toggleSidebar();
        break;
      case 'close-sidebar':
        closeSidebar();
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'open-entry':
        if (id) openEntryModal(id);
        break;
      case 'edit-draft':
        if (id) { closeModal(true); navigate('#/entry?id=' + encodeURIComponent(id)); }
        break;
      case 'validate-entry': {
        if (!id) break;
        var posted = S.postEntry(id);
        if (!posted.ok) { toast(posted.errors[0] || 'Validation impossible.', 'error'); break; }
        toast('Pièce ' + posted.entry.reference + ' validée.', 'success');
        closeModal(true);
        render();
        break;
      }
      case 'delete-draft': {
        if (!id) break;
        if (!window.confirm('Supprimer définitivement ce brouillon ?')) break;
        var removed = S.deleteDraft(id);
        if (!removed.ok) { toast(removed.errors[0] || 'Suppression impossible.', 'error'); break; }
        toast('Brouillon supprimé.', 'success');
        closeModal(true);
        render();
        break;
      }
      case 'new-account':
        openAccountModal();
        break;
      case 'add-line': {
        var body = $('#lines-body');
        if (body) {
          body.insertAdjacentHTML('beforeend', lineRowHtml({ account: '', debit: '', credit: '' }));
          bindNewLine(body.lastElementChild);
          updateEntryTotals();
        }
        break;
      }
      case 'remove-line': {
        var row = trigger.closest('.line-row');
        var bodyEl = $('#lines-body');
        if (row && bodyEl) {
          if (bodyEl.querySelectorAll('.line-row').length <= 1) {
            toast('Une écriture doit conserver au moins une ligne.', 'warning');
            break;
          }
          row.remove();
          updateEntryTotals();
        }
        break;
      }
      case 'close-period': {
        var y = Number(trigger.getAttribute('data-year'));
        var m = Number(trigger.getAttribute('data-month'));
        if (!window.confirm('Clôturer ' + S.monthLabel(m) + ' ' + y + ' ? Les nouvelles pièces et la validation de brouillons seront refusées sur cette période.')) break;
        S.setPeriod(y, m, 'closed');
        toast('Période ' + S.monthLabel(m) + ' ' + y + ' clôturée.', 'success');
        render();
        break;
      }
      case 'open-period': {
        var oy = Number(trigger.getAttribute('data-year'));
        var om = Number(trigger.getAttribute('data-month'));
        S.setPeriod(oy, om, 'open');
        toast('Période ' + S.monthLabel(om) + ' ' + oy + ' réouverte.', 'success');
        render();
        break;
      }
      case 'reset-data':
        if (!window.confirm('Réinitialiser les données du dossier « ' + S.currentDossier().name + ' » ? Un point de restauration propre à ce dossier sera conservé avant le remplacement.')) break;
        S.reset();
        toast('Données de démonstration restaurées. L’état précédent reste récupérable localement.', 'success');
        render();
        break;
      case 'restore-local-backup': {
        if (!window.confirm('Restaurer le dernier point de restauration ? L’état actuel deviendra à son tour le point de restauration.')) break;
        var restoredBackup = S.restoreBackup();
        if (!restoredBackup.ok) { toast(restoredBackup.errors[0] || 'Restauration impossible.', 'error'); break; }
        toast('Point de restauration local restauré.', 'success');
        render();
        break;
      }
      case 'commit-accounting-exchange-import':
        commitAccountingExchangeImport();
        break;
      case 'commit-accounting-balance-import':
        commitAccountingBalanceImport();
        break;
      case 'export-accounting-workbook': {
        var workbookDossier = S.currentDossier();
        var workbookStem = 'perfecto-' + safeFilePart(workbookDossier.reference) + '-' + S.exercise();
        try {
          var workbookBytes = AccountingExchange.exportWorkbook({
            dossier: workbookDossier,
            accounts: S.accounts(),
            journals: S.journals()
          }, S.entries());
          downloadFile(workbookStem + '-echange-v1.xlsx', workbookBytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          toast('Classeur Excel PERFECTO-ÉCHANGE v1 téléchargé.', 'success');
        } catch (workbookError) {
          toast(workbookError.message || 'Classeur Excel impossible à générer.', 'error');
        }
        break;
      }
      case 'export-accounting-exchange': {
        var exchangeDossier = S.currentDossier();
        var exchangeStem = 'perfecto-' + safeFilePart(exchangeDossier.reference) + '-' + S.exercise();
        try {
          var exchangeCsv = AccountingExchange.exportEntries({
            dossier: exchangeDossier,
            accounts: S.accounts(),
            journals: S.journals()
          }, S.entries());
          downloadFile(exchangeStem + '-ecritures-v1.csv', exchangeCsv, 'text/csv;charset=utf-8');
          toast('Écritures validées exportées au format PERFECTO-ÉCHANGE v1.', 'success');
        } catch (exchangeError) {
          toast(exchangeError.message || 'Export impossible : les écritures doivent être contrôlées.', 'error');
        }
        break;
      }
      case 'download-accounting-balance-workbook-template': {
        var balanceTemplateDossier = S.currentDossier();
        try {
          var balanceWorkbookTemplate = AccountingExchange.templateBalanceWorkbook({
            dossier: balanceTemplateDossier,
            accounts: S.accounts(),
            journals: S.journals()
          });
          downloadFile('perfecto-balance-v1-modele-' + safeFilePart(balanceTemplateDossier.reference) + '.xlsx', balanceWorkbookTemplate, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          toast('Modèle Excel de balance PERFECTO-BALANCE v1 téléchargé.', 'success');
        } catch (balanceTemplateError) {
          toast(balanceTemplateError.message || 'Modèle Excel de balance impossible à générer.', 'error');
        }
        break;
      }
      case 'download-accounting-balance-template': {
        var balanceCsvDossier = S.currentDossier();
        downloadFile('perfecto-balance-v1-modele-' + safeFilePart(balanceCsvDossier.reference) + '.csv', AccountingExchange.templateBalance(), 'text/csv;charset=utf-8');
        toast('Modèle CSV de balance PERFECTO-BALANCE v1 téléchargé.', 'success');
        break;
      }
      case 'download-accounting-workbook-template': {
        var workbookTemplateDossier = S.currentDossier();
        try {
          var workbookTemplate = AccountingExchange.templateWorkbook({
            dossier: workbookTemplateDossier,
            accounts: S.accounts(),
            journals: S.journals()
          });
          downloadFile('perfecto-echange-v1-modele-' + safeFilePart(workbookTemplateDossier.reference) + '.xlsx', workbookTemplate, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          toast('Modèle Excel PERFECTO-ÉCHANGE v1 téléchargé.', 'success');
        } catch (templateError) {
          toast(templateError.message || 'Modèle Excel impossible à générer.', 'error');
        }
        break;
      }
      case 'download-accounting-exchange-template': {
        var templateDossier = S.currentDossier();
        downloadFile('perfecto-echange-v1-modele-' + safeFilePart(templateDossier.reference) + '.csv', AccountingExchange.template({ dossier: templateDossier }), 'text/csv;charset=utf-8');
        toast('Modèle CSV Excel téléchargé.', 'success');
        break;
      }
      case 'export-accounting-chart': {
        var chartDossier = S.currentDossier();
        downloadFile('perfecto-' + safeFilePart(chartDossier.reference) + '-plan-comptable.csv', AccountingExchange.exportAccounts(S.accounts()), 'text/csv;charset=utf-8');
        toast('Plan comptable exporté au format CSV Excel.', 'success');
        break;
      }
      case 'export-accounting-journals': {
        var journalsDossier = S.currentDossier();
        downloadFile('perfecto-' + safeFilePart(journalsDossier.reference) + '-journaux.csv', AccountingExchange.exportJournals(S.journals()), 'text/csv;charset=utf-8');
        toast('Journaux exportés au format CSV Excel.', 'success');
        break;
      }
      case 'export-json':
        downloadFile('perfecto-comptabilite-' + S.todayIso() + '.json', S.exportJson(), 'application/json;charset=utf-8');
        toast('Export JSON généré.', 'success');
        break;
      case 'export-accounts-csv': {
        var rows = [['Code', 'Intitulé', 'Classe', 'Nature', 'Auxiliaire', 'Actif']];
        S.accounts().forEach(function (a) {
          rows.push([a.code, a.label, a.cls, a.nature, a.aux ? 'Oui' : 'Non', a.active ? 'Oui' : 'Non']);
        });
        downloadFile('perfecto-plan-comptable.csv', toCsv(rows), 'text/csv;charset=utf-8');
        toast('Plan comptable exporté.', 'success');
        break;
      }
      case 'export-balance-csv': {
        var csv = [['Compte', 'Intitulé', 'Classe', 'Débit', 'Crédit', 'Solde']];
        S.balance().forEach(function (r) {
          csv.push([r.code, r.label, r.cls, r.debit, r.credit, r.debit - r.credit]);
        });
        downloadFile('perfecto-balance.csv', toCsv(csv), 'text/csv;charset=utf-8');
        toast('Balance exportée.', 'success');
        break;
      }
      case 'print':
        window.print();
        break;
      case 'install-app':
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          deferredInstallPrompt.userChoice.then(function (choice) {
            if (choice && choice.outcome === 'accepted') toast('PERFECTO installée.', 'success');
            deferredInstallPrompt = null;
            var btn = $('[data-action="install-app"]');
            if (btn) btn.hidden = true;
          });
        }
        break;
      default:
        break;
    }
  });

  function bindNewLine(row) {
    if (!row) return;
    $$('[data-field="debit"], [data-field="credit"]', row).forEach(function (input) {
      input.addEventListener('input', function () {
        var isDebit = input.getAttribute('data-field') === 'debit';
        if (Number(input.value) > 0) {
          row.querySelector('[data-field="' + (isDebit ? 'credit' : 'debit') + '"]').value = '';
        }
        updateEntryTotals();
      });
    });
    var sel = $('[data-field="account"]', row);
    if (sel) sel.addEventListener('change', updateEntryTotals);
  }

  function openAccountModal() {
    var body = '<form id="account-form" novalidate>' +
      '<div id="account-errors" aria-live="assertive"></div>' +
      '<div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="a-code">Code du compte</label>' +
          '<input id="a-code" name="code" type="text" inputmode="numeric" pattern="[0-9]{4,8}" placeholder="Ex. 601200" required>' +
          '<span class="hint">4 à 8 chiffres, classe SYSCOHADA en premier.</span></div>' +
        '<div class="field"><label for="a-label">Intitulé</label>' +
          '<input id="a-label" name="label" type="text" placeholder="Ex. Achats de matières premières" required></div>' +
        '<div class="field"><label for="a-nature">Nature</label>' +
          '<select id="a-nature" name="nature">' +
            ['Actif', 'Passif', 'Charge', 'Produit'].map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('') +
          '</select></div>' +
        '<div class="field"><label for="a-aux">Compte auxiliaire requis</label>' +
          '<select id="a-aux" name="aux"><option value="no">Non</option><option value="yes">Oui</option></select></div>' +
      '</div>' +
    '</form>';

    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="account-form">Créer le compte</button>';

    openModal('Nouveau compte comptable', 'Ajout au plan comptable local', body, footer);

    var form = $('#account-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'accounts.create', accountingAccessContext())) {
        toast('Création refusée par défaut : le droit « accounts.create » n’est pas accordé.', 'warning');
        return;
      }
      var result = S.addAccount({
        code: $('#a-code').value,
        label: $('#a-label').value,
        nature: $('#a-nature').value,
        aux: $('#a-aux').value === 'yes'
      });
      if (!result.ok) {
        $('#account-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast('Compte ' + result.account.code + ' créé.', 'success');
      closeModal(true);
      render();
    });
  }

  /* -------------------------------- Démarrage ------------------------------ */
  function init() {
    var topbarDate = $('#topbar-date');
    if (topbarDate) {
      var now = new Date();
      topbarDate.textContent = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    window.addEventListener('hashchange', render);
    if (window.matchMedia) {
      var phoneQuery = window.matchMedia('(max-width: ' + PHONE_BREAKPOINT + 'px)');
      if (phoneQuery.addEventListener) phoneQuery.addEventListener('change', render);
      else if (phoneQuery.addListener) phoneQuery.addListener(render);
    }
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault();
      deferredInstallPrompt = event;
      var btn = $('[data-action="install-app"]');
      if (btn) btn.hidden = false;
    });

    if (!location.hash) location.replace('#/login');
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
