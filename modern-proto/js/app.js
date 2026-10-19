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
  var AccountingConsolidation = window.PerfectoAccountingConsolidation;
  var BalanceRecalculation = window.PerfectoBalanceRecalculation;
  var PayrollHR = window.PerfectoPayrollHR;
  var PayrollCentralization = window.PerfectoPayrollCentralization;
  var SalesOperations = window.PerfectoSalesOperations;
  var SalesCentralization = window.PerfectoSalesCentralization;
  var CentralizationCancellation = window.PerfectoCentralizationCancellation;

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

  var ROUTES = ['login', 'launcher', 'organization', 'payroll', 'sales', 'dossiers', 'dashboard', 'accounts', 'journals', 'entry', 'entries', 'balance', 'journal', 'ledger', 'periods', 'settings', 'menu'];

  var TITLES = {
    login: ['Connexion', 'Accès à votre espace PERFECTO'],
    launcher: ['Launcher', 'Modules de votre organisation'],
    organization: ['Organisation & accès', 'Organisation, membres et droits d’accès'],
    payroll: ['Paie & RH', 'Lots de paie internes · prototype de centralisation'],
    sales: ['Ventes, stock & facturation', 'Lots d’opérations internes · prototype de centralisation'],
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
    accounts: { q: '', cls: '', nature: '', status: 'standard' },
    entries: { q: '', status: '', journal: '' },
    balance: { cls: '', q: '' },
    journal: { journal: '', year: String(S.exercise()) },
    ledger: { account: '521' },
    periods: { year: S.exercise() },
    suppliers: { q: '', status: 'active' },
    clients: { q: '' },
    otherParties: { q: '', type: 'all' },
    personnel: { q: '' }
  };

  var deferredInstallPrompt = null;
  var exchangeImportSession = null;
  var balanceImportSession = null;
  var payrollCentralizationSession = null;
  var salesCentralizationSession = null;
  var centralizationCancellationSession = null;
  var consolidationBeforeResultSession = null;
  var consolidationAfterResultSession = null;
  var balanceRecalculationSession = null;
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

  function payrollAccessContext(dossier) {
    return accountingAccessContext(dossier || S.currentDossier());
  }

  function salesAccessContext(dossier) {
    return accountingAccessContext(dossier || S.currentDossier());
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
      case 'create-demo-payroll-run':
        return { moduleId: 'payroll-hr', actionId: 'record.create' };
      case 'approve-internal-payroll-run':
        return { moduleId: 'payroll-hr', actionId: 'record.validate' };
      case 'open-accounting-payroll-centralization':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'commit-accounting-payroll-centralization':
        return { moduleId: 'accounting', actionId: 'data.import' };
      case 'create-demo-sales-run':
        return { moduleId: 'sales-stock-invoicing', actionId: 'record.create' };
      case 'approve-internal-sales-run':
        return { moduleId: 'sales-stock-invoicing', actionId: 'record.validate' };
      case 'open-accounting-sales-centralization':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'commit-accounting-sales-centralization':
        return { moduleId: 'accounting', actionId: 'data.import' };
      case 'select-centralization-cancellation':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'cancel-draft-centralization':
        return { moduleId: 'accounting', actionId: 'draft.delete' };
      case 'commit-centralization-cancellation':
        return { moduleId: 'accounting', actionId: 'centralization.cancel' };
      case 'export-accounting-consolidation-before-result':
      case 'export-accounting-consolidation-after-result':
      case 'export-recalculated-account-balances':
        return { moduleId: 'accounting', actionId: 'data.export' };
      case 'recalculate-account-balances':
      case 'analyze-accounting-database':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'repair-accounting-database':
      case 'restore-database-backup':
        return { moduleId: 'accounting', actionId: 'data.restore' };
      case 'export-corrupt-database':
        return { moduleId: 'accounting', actionId: 'data.export' };
      case 'reinitialize-corrupt-database':
        return { moduleId: 'accounting', actionId: 'data.reset' };
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
      case 'edit-account':
        return { moduleId: 'accounting', actionId: 'accounts.edit' };
      case 'delete-account':
        return { moduleId: 'accounting', actionId: 'accounts.delete' };
      case 'save-account':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-account-mode') === 'edit' ? 'accounts.edit' : 'accounts.create'
        };
      case 'new-supplier':
        return { moduleId: 'accounting', actionId: 'suppliers.create' };
      case 'edit-supplier':
        return { moduleId: 'accounting', actionId: 'suppliers.edit' };
      case 'archive-supplier':
        return { moduleId: 'accounting', actionId: 'suppliers.archive' };
      case 'delete-supplier':
        return { moduleId: 'accounting', actionId: 'suppliers.delete' };
      case 'save-supplier':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-supplier-mode') === 'edit' ? 'suppliers.edit' : 'suppliers.create'
        };
      case 'new-client':
        return { moduleId: 'accounting', actionId: 'clients.create' };
      case 'edit-client':
        return { moduleId: 'accounting', actionId: 'clients.edit' };
      case 'delete-client':
        return { moduleId: 'accounting', actionId: 'clients.delete' };
      case 'save-client':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-client-mode') === 'edit' ? 'clients.edit' : 'clients.create'
        };
      case 'new-other-party':
        return { moduleId: 'accounting', actionId: 'otherParties.create' };
      case 'edit-other-party':
        return { moduleId: 'accounting', actionId: 'otherParties.edit' };
      case 'delete-other-party':
        return { moduleId: 'accounting', actionId: 'otherParties.delete' };
      case 'save-other-party':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-other-party-mode') === 'edit' ? 'otherParties.edit' : 'otherParties.create'
        };
      case 'new-personnel':
        return { moduleId: 'accounting', actionId: 'personnel.create' };
      case 'edit-personnel':
        return { moduleId: 'accounting', actionId: 'personnel.edit' };
      case 'delete-personnel':
        return { moduleId: 'accounting', actionId: 'personnel.delete' };
      case 'save-personnel':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-personnel-mode') === 'edit' ? 'personnel.edit' : 'personnel.create'
        };
      case 'new-fixed-asset-location':
        return { moduleId: 'accounting', actionId: 'fixedAssetLocations.create' };
      case 'edit-fixed-asset-location':
        return { moduleId: 'accounting', actionId: 'fixedAssetLocations.edit' };
      case 'delete-fixed-asset-location':
        return { moduleId: 'accounting', actionId: 'fixedAssetLocations.delete' };
      case 'save-fixed-asset-location':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-fixed-asset-location-mode') === 'edit' ? 'fixedAssetLocations.edit' : 'fixedAssetLocations.create'
        };
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
      : (rule.moduleId === 'payroll-hr'
        ? payrollAccessContext(selectedDossier || undefined)
        : (rule.moduleId === 'sales-stock-invoicing' ? salesAccessContext(selectedDossier || undefined) : demoAccessContext('organization')));
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
      else if (routePart === 'payroll') requirement = { moduleId: 'payroll-hr', actionId: 'module.view' };
      else if (routePart === 'sales') requirement = { moduleId: 'sales-stock-invoicing', actionId: 'module.view' };
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
        var context = requirement.moduleId === 'accounting'
          ? accountingAccessContext()
          : (requirement.moduleId === 'payroll-hr'
            ? payrollAccessContext()
            : (requirement.moduleId === 'sales-stock-invoicing' ? salesAccessContext() : demoAccessContext('organization')));
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
    if (phoneViewport && (route === 'payroll' || route === 'sales')) {
      navigate(accountingMenuHash('editions', 'general-accounts'));
      return;
    }
    if (phoneViewport && ACCOUNTING_ROUTES.indexOf(route) !== -1 && !phoneRouteAllowed) {
      navigate(accountingMenuHash('editions', 'general-accounts'));
      return;
    }
    var isDatabaseRepairRoute = route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'repair-database';
    var databaseStorage = ACCOUNTING_ROUTES.indexOf(route) !== -1 && S.databaseStorageStatus
      ? S.databaseStorageStatus()
      : { recoveryRequired: false };
    if (databaseStorage.recoveryRequired && !isDatabaseRepairRoute && route !== 'dossiers') {
      if (!phoneViewport) {
        navigate(accountingMenuHash('fichier', 'repair-database'));
        return;
      }
      if (PHONE_REPORT_ROUTES.indexOf(route) !== -1) {
        navigate(accountingMenuHash('editions', 'general-accounts'));
        return;
      }
    }
    var view = $('#view');
    if (!view) return;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'import-balance')) balanceImportSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'centralize-payroll')) payrollCentralizationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'centralize-sales')) salesCentralizationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'cancel-centralization')) centralizationCancellationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'consolidate-before-result')) consolidationBeforeResultSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'consolidate-after-result')) consolidationAfterResultSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'recalculate-balances')) balanceRecalculationSession = null;

    var activeMember = getActiveDemoMember();
    var orgContext = demoAccessContext('organization');
    if (route === 'organization' && !hasDemoPermission(activeMember, 'organization', 'module.view', orgContext)) {
      toast('Accès refusé : aucun droit de consultation de l’organisation n’est accordé à ce profil.', 'warning');
      navigate('#/launcher');
      return;
    }
    if (route === 'payroll' && !hasDemoPermission(activeMember, 'payroll-hr', 'module.view', payrollAccessContext())) {
      toast('Accès refusé : aucun droit de consultation de Paie & RH n’est accordé à ce profil.', 'warning');
      navigate('#/launcher');
      return;
    }
    if (route === 'sales' && !hasDemoPermission(activeMember, 'sales-stock-invoicing', 'module.view', salesAccessContext())) {
      toast('Accès refusé : aucun droit de consultation de Ventes, stock & facturation n’est accordé à ce profil.', 'warning');
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
      var entryBeingEdited = parsed.params.id ? S.entry(parsed.params.id) : null;
      if (entryBeingEdited && entryBeingEdited.status === 'draft' && CentralizationCancellation.isCancellationEntry(entryBeingEdited)) {
        toast('Un brouillon d’annulation est immuable. Supprimez-le et recommencez l’annulation si une correction est nécessaire.', 'warning');
        navigate('#/entries');
        return;
      }
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
      case 'payroll': html = viewPayrollModule(); break;
      case 'sales': html = viewSalesModule(); break;
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
      var inAccounting = ACCOUNTING_ROUTES.indexOf(route) !== -1 || route === 'payroll' || route === 'sales';
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
    if (topbarEntry && (route === 'dossiers' || route === 'payroll' || route === 'sales')) topbarEntry.hidden = true;

    var title = TITLES[route] || TITLES.login;
    if (route === 'menu') {
      var menuGroupForTitle = AccountingNavigation.getGroup(phoneViewport ? 'editions' : parsed.params.g);
      var menuTabForTitle = AccountingNavigation.getTab(menuGroupForTitle.id, parsed.params.t || menuGroupForTitle.defaultTab);
      title = [menuGroupForTitle.label, menuTabForTitle.label];
    }
    var pageTitle = $('#page-title');
    if (pageTitle) pageTitle.textContent = title[0];
    var topbarEyebrow = $('.topbar-titles .eyebrow');
    if (topbarEyebrow) topbarEyebrow.textContent = route === 'payroll'
      ? 'CABINET GOBEX · Paie & RH'
      : (route === 'sales' ? 'CABINET GOBEX · Ventes, stock & facturation' : 'CABINET GOBEX · Comptabilité générale');
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
    var available = (module.status === 'available' || module.status === 'partial') && module.route;
    var moduleContext = module.id === 'accounting'
      ? accountingAccessContext()
      : (module.id === 'payroll-hr'
        ? payrollAccessContext()
        : (module.id === 'sales-stock-invoicing' ? salesAccessContext() : demoAccessContext('organization')));
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
        '<summary><span><strong>' + esc(module.name) + '</strong><small>' + (module.id === 'organization' ? 'Gestion de l’organisation de démonstration' : esc(module.status === 'available' ? 'Disponible en démo' : (module.status === 'partial' ? 'Partiellement disponible en démo' : 'Module à venir'))) + '</small></span><span class="permission-pending" data-demo-module-count="' + esc(module.id) + '">' + status + '</span></summary>' +
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

  function postingAccounts() {
    return S.accounts().filter(function (account) {
      return account.active !== false && account.postable !== false;
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
      var opts = postingAccounts().filter(function (a) { return a.cls === Number(cls); }).map(function (a) {
        var historical = a.legacy ? ' · historique' : '';
        return '<option value="' + esc(a.code) + '"' + (a.code === selected ? ' selected' : '') + '>' +
          esc(a.code + ' — ' + a.label + historical) + '</option>';
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
    var allAccounts = S.accounts();
    var bal = balanceRows();
    var legacyCount = allAccounts.filter(function (account) { return account.legacy; }).length;
    var standardCount = allAccounts.filter(function (account) { return !account.legacy; }).length;
    var list = allAccounts.filter(function (a) {
      if (filter.status !== 'all' && (a.legacy || a.active === false)) return false;
      var text = [a.code, a.label, a.classLabel, a.subclass, a.subclassLabel, a.usage, a.nature].join(' ').toLowerCase();
      if (filter.q && text.indexOf(filter.q.toLowerCase()) === -1) return false;
      if (filter.cls && String(a.cls) !== filter.cls) return false;
      if (filter.nature && a.nature !== filter.nature) return false;
      return true;
    });

    var html = pageHeader('Plan comptable', 'Référentiel source de 147 comptes, personnalisable dans le dossier. Un numéro utilisé dans des pièces ou comme rattachement auxiliaire client, fournisseur, tiers divers ou personnel est protégé contre le changement et la suppression.',
      '<button type="button" class="btn btn-ghost" data-action="export-accounts-csv">↓ Export CSV</button>' +
      '<button type="button" class="btn btn-primary" data-action="new-account">＋ Nouveau compte</button>');

    html += '<div class="card"><div class="panel">' +
      '<div class="filter-row">' +
        '<div class="field grow"><label for="f-accounts-q">Rechercher</label>' +
          '<input id="f-accounts-q" type="search" data-filter="accounts:q" value="' + esc(filter.q) + '" placeholder="Code, intitulé, sous-classe ou utilisation…"></div>' +
        '<div class="field"><label for="f-accounts-cls">Classe</label><select id="f-accounts-cls" data-filter="accounts:cls">' +
          '<option value="">Toutes</option>' +
          [1, 2, 3, 4, 5, 6, 7, 8].map(function (c) {
            var label = window.PerfectoAccountingChart ? window.PerfectoAccountingChart.classLabel(c) : ('Classe ' + c);
            return '<option value="' + c + '"' + (filter.cls === String(c) ? ' selected' : '') + '>Classe ' + c + ' — ' + esc(label) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label for="f-accounts-nature">Nature comptable</label><select id="f-accounts-nature" data-filter="accounts:nature">' +
          '<option value="">Toutes</option>' +
          ['Actif', 'Passif', 'Charge', 'Produit', 'SIG', 'Hors bilan'].map(function (n) {
            return '<option value="' + esc(n) + '"' + (filter.nature === n ? ' selected' : '') + '>' + esc(n) + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label for="f-accounts-status">Référentiel</label><select id="f-accounts-status" data-filter="accounts:status">' +
          '<option value="standard"' + (filter.status !== 'all' ? ' selected' : '') + '>Plan fourni et comptes personnalisés</option>' +
          '<option value="all"' + (filter.status === 'all' ? ' selected' : '') + '>Inclure aussi les comptes historiques</option>' +
        '</select></div>' +
      '</div>' +
      '<p class="small muted account-chart-summary" style="margin-bottom:10px">' + list.length + ' compte(s) affiché(s). Plan source : ' + standardCount + ' compte(s) standard et personnalisé(s) ; ' + legacyCount + ' compte(s) de compatibilité conservé(s)' + (filter.status === 'all' ? '.' : ' (masqués par défaut).') + '</p>' +
      '<div class="table-wrap"><table class="data-table account-chart-table">' +
        '<caption>Plan comptable — codes, libellés, classe, sous-classe, utilisation et soldes des écritures validées</caption>' +
        '<thead><tr><th scope="col">Numéro</th><th scope="col">Libellé</th><th scope="col">Classe</th><th scope="col">Sous-classe</th><th scope="col">Nature / utilisation</th><th scope="col">Type comptable</th><th scope="col">Imputation</th>' +
        '<th scope="col">Auxiliaire</th><th scope="col" class="num">Débit</th><th scope="col" class="num">Crédit</th><th scope="col" class="num">Solde</th><th scope="col">Actions</th></tr></thead><tbody>' +
        (list.length ? list.map(function (a) {
          var row = bal[a.code] || { debit: 0, credit: 0 };
          var solde = row.debit - row.credit;
          var imputation = a.legacy
            ? '<span class="badge plain">Historique</span>'
            : (a.postable === false ? '<span class="badge plain">Rubrique / indicateur</span>' : '<span class="badge open">Imputable</span>');
          return '<tr>' +
            '<td><span class="code-chip">' + esc(a.code) + '</span></td>' +
            '<td class="strong">' + esc(a.label || '—') + '</td>' +
            '<td>' + esc(a.cls + ' — ' + (a.classLabel || ('Classe ' + a.cls))) + '</td>' +
            '<td>' + esc((a.subclass || String(a.code).slice(0, 2)) + ' — ' + (a.subclassLabel || 'Compte personnalisé')) + '</td>' +
            '<td class="account-usage">' + esc(a.usage || '—') + '</td>' +
            '<td>' + natureBadge(a.nature) + '</td>' +
            '<td>' + imputation + '</td>' +
            '<td>' + (a.aux ? '<span class="badge plain">Oui</span>' : '<span class="muted">—</span>') + '</td>' +
            '<td class="num">' + (row.debit ? amount(row.debit) : '—') + '</td>' +
            '<td class="num">' + (row.credit ? amount(row.credit) : '—') + '</td>' +
            '<td class="num strong">' + (solde === 0 ? '—' : amount(Math.abs(solde)) + (solde > 0 ? ' D' : ' C')) + '</td>' +
            '<td><div class="account-row-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-account" data-id="' + esc(a.code) + '" aria-label="Modifier le compte ' + esc(a.code) + '">Modifier</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-action="delete-account" data-id="' + esc(a.code) + '" aria-label="Supprimer le compte ' + esc(a.code) + '" title="La suppression est refusée si le compte a des pièces, des auxiliaires clients/fournisseurs/tiers/personnel rattachés ou des sous-comptes.">Supprimer</button>' +
            '</div></td>' +
          '</tr>';
        }).join('') : '<tr><td colspan="12"><div class="empty-state"><strong>Aucun compte ne correspond</strong>Modifiez la recherche ou les filtres.</div></td></tr>') +
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
    var isCancellationEntry = CentralizationCancellation.isCancellationEntry(e);
    if (isCancellationEntry) {
      var cancellationMetadata = e.sourceMetadata || {};
      body += '<div class="alert info" style="margin-top:16px"><div><strong>Écriture inverse liée à ' + esc(cancellationMetadata.originalReference || 'la pièce d’origine') + '.</strong>' +
        (cancellationMetadata.cancellationReason ? '<br>Motif : ' + esc(cancellationMetadata.cancellationReason) : '') +
        (S.entry(cancellationMetadata.originalEntryId) ? '<br><button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" data-action="open-entry" data-id="' + esc(cancellationMetadata.originalEntryId) + '">Consulter la pièce d’origine</button>' : '') +
        '</div></div>';
    }

    var footer = '';
    if (e.status === 'draft') {
      footer += '<button type="button" class="btn btn-danger" data-action="delete-draft" data-id="' + esc(e.id) + '">× Supprimer</button>';
      if (!isCancellationEntry) footer += '<button type="button" class="btn btn-ghost" data-action="edit-draft" data-id="' + esc(e.id) + '">✎ Modifier</button>';
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
    var targetOptions = isAccount ? postingAccounts() : S.journals();
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
    var accounts = postingAccounts();
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

  function payrollEntryForRun(run, dossierId) {
    if (!run || !PayrollHR) return null;
    var sourceId = PayrollHR.sourceId(dossierId, run.id);
    return S.entries().find(function (entry) {
      return entry.sourceSystem === 'PERFECTO-PAIE-RH' && entry.sourceId === sourceId;
    }) || null;
  }

  function viewPayrollModule() {
    var dossier = S.currentDossier();
    var runs = PayrollHR.runs(dossier.id);
    var firstPeriod = PayrollHR.periodForDate(dossier.cycleStart);
    var lastPeriod = PayrollHR.periodForDate(dossier.cycleEnd);
    var rows = runs.map(function (run) {
      var linkedEntry = payrollEntryForRun(run, dossier.id);
      var status = linkedEntry
        ? '<span class="badge posted">Transféré en comptabilité</span><small>' + esc(linkedEntry.reference) + ' · ' + esc(linkedEntry.status === 'posted' ? 'validée' : 'brouillon') + '</small>'
        : (run.status === 'approved'
          ? '<span class="badge posted">Approuvé · prêt</span>'
          : '<span class="badge draft">Brouillon Paie & RH</span>');
      var action = linkedEntry
        ? '<span class="small muted">Lot déjà centralisé</span>'
        : (run.status === 'approved'
          ? '<button type="button" class="btn btn-primary btn-sm" data-action="open-accounting-payroll-centralization">Centraliser dans la Comptabilité</button>'
          : '<button type="button" class="btn btn-ghost btn-sm" data-action="approve-internal-payroll-run" data-id="' + esc(run.id) + '">Contrôler et approuver</button>');
      return '<tr><td><strong>' + esc(run.reference) + '</strong><br><span class="small muted">' + esc(run.origin === 'demo' ? 'Jeu d’exemple interne' : 'Lot Paie & RH') + '</span></td>' +
        '<td>' + esc(run.period) + '<br><span class="small muted">Comptabilisation source au ' + esc(dateLabel(run.date)) + '</span></td>' +
        '<td class="numeric">' + Number(run.employeeCount || 0) + '</td>' +
        '<td class="numeric">' + esc(amount(run.totals && run.totals.grossPay || 0)) + '</td>' +
        '<td class="numeric">' + esc(amount(run.totals && run.totals.netPay || 0)) + '</td>' +
        '<td>' + status + '</td><td>' + action + '</td></tr>';
    }).join('');
    var empty = runs.length
      ? ''
      : '<div class="empty-state"><strong>Aucun lot Paie & RH dans ce dossier</strong><span>Créez un jeu d’exemple interne pour vérifier le flux vers la Comptabilité. Aucun fichier externe n’est accepté.</span></div>';
    return '<div class="payroll-module-workspace">' +
      pageHeader('Paie & RH', 'Dossier client : <strong>' + esc(dossier.clientName) + '</strong> · ' + esc(dossier.reference) + ' · source interne pour la centralisation comptable.', '<a class="btn btn-ghost" href="#/launcher">← Modules</a>') +
      '<div class="alert warning"><div><strong>Étape de raccordement interne · démonstration</strong><br>Cette version conserve des lots locaux et contrôle leur journal comptable. Elle ne calcule pas les salaires, les cotisations ni les retenues légales. Les montants d’exemple sont fictifs ; aucun export/import tiers n’intervient.</div></div>' +
      '<section class="exchange-card"><p class="page-kicker">SOURCE INTERNE DE PAIE</p><h3>Lots de paie du dossier</h3>' +
        '<p>Un lot doit être approuvé dans Paie & RH avant d’être transmis. Après centralisation, son identifiant interne empêche un second transfert.</p>' +
        '<div class="payroll-demo-create"><div class="field"><label for="payroll-demo-period">Période de l’exemple interne</label><input id="payroll-demo-period" type="month" min="' + esc(firstPeriod) + '" max="' + esc(lastPeriod) + '" value="' + esc(firstPeriod) + '"><span class="hint">La période doit se situer dans le cycle du dossier actif.</span></div>' +
        '<button type="button" class="btn btn-primary" data-action="create-demo-payroll-run">＋ Créer un lot fictif de démonstration</button></div>' +
      '</section>' +
      '<section class="exchange-card"><p class="page-kicker">SUIVI DES LOTS</p><h3>' + runs.length + ' lot(s) enregistré(s)</h3>' + empty +
        (runs.length ? '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Référence interne</th><th>Période</th><th class="numeric">Effectif</th><th class="numeric">Brut illustratif (XOF)</th><th class="numeric">Net illustratif (XOF)</th><th>État</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '</section>' +
      '<div class="alert info"><div>Les données Paie & RH sont isolées par dossier client dans ce navigateur. Les calculs de paie, les dossiers du personnel, la validation métier complète et la synchronisation multi-utilisateur restent à construire.</div></div>' +
    '</div>';
  }

  function salesEntryForRun(run, dossierId) {
    if (!run || !SalesOperations) return null;
    var sourceId = SalesOperations.sourceId(dossierId, run.id);
    return S.entries().find(function (entry) {
      return entry.sourceSystem === 'PERFECTO-VENTES-STOCK-FACTURATION' && entry.sourceId === sourceId;
    }) || null;
  }

  function viewSalesModule() {
    var dossier = S.currentDossier();
    var runs = SalesOperations.runs(dossier.id);
    var firstPeriod = SalesOperations.periodForDate(dossier.cycleStart);
    var lastPeriod = SalesOperations.periodForDate(dossier.cycleEnd);
    var rows = runs.map(function (run) {
      var linkedEntry = salesEntryForRun(run, dossier.id);
      var status = linkedEntry
        ? '<span class="badge posted">Transféré en comptabilité</span><small>' + esc(linkedEntry.reference) + ' · ' + esc(linkedEntry.status === 'posted' ? 'validée' : 'brouillon') + '</small>'
        : (run.status === 'approved'
          ? '<span class="badge posted">Approuvé · prêt</span>'
          : '<span class="badge draft">Brouillon opérations</span>');
      var action = linkedEntry
        ? '<span class="small muted">Lot déjà centralisé</span>'
        : (run.status === 'approved'
          ? '<button type="button" class="btn btn-primary btn-sm" data-action="open-accounting-sales-centralization">Centraliser dans la Comptabilité</button>'
          : '<button type="button" class="btn btn-ghost btn-sm" data-action="approve-internal-sales-run" data-id="' + esc(run.id) + '">Contrôler et approuver</button>');
      return '<tr><td><strong>' + esc(run.reference) + '</strong><br><span class="small muted">' + esc(run.origin === 'demo' ? 'Jeu d’exemple interne' : 'Lot Ventes, stock & facturation') + '</span></td>' +
        '<td>' + esc(run.period) + '<br><span class="small muted">Date source au ' + esc(dateLabel(run.date)) + '</span></td>' +
        '<td class="numeric">' + Number(run.invoiceCount || 0) + '</td>' +
        '<td class="numeric">' + Number(run.stockMovementCount || 0) + '</td>' +
        '<td class="numeric">' + esc(amount(run.totals && run.totals.invoicedSales || 0)) + '</td>' +
        '<td class="numeric">' + esc(amount(run.totals && run.totals.stockPurchases || 0)) + '</td>' +
        '<td>' + status + '</td><td>' + action + '</td></tr>';
    }).join('');
    var empty = runs.length
      ? ''
      : '<div class="empty-state"><strong>Aucun lot d’opérations dans ce dossier</strong><span>Créez un lot fictif interne pour vérifier le flux vers la Comptabilité. Aucun fichier externe n’est accepté.</span></div>';
    return '<div class="sales-module-workspace">' +
      pageHeader('Ventes, stock & facturation', 'Dossier client : <strong>' + esc(dossier.clientName) + '</strong> · ' + esc(dossier.reference) + ' · source interne pour la centralisation comptable.', '<a class="btn btn-ghost" href="#/launcher">← Modules</a>') +
      '<div class="alert warning"><div><strong>Étape de raccordement interne · démonstration</strong><br>Les lots d’exemple sont fictifs. Cette version ne calcule pas la TVA, les marges, les coûts de revient ni la valorisation du stock ; elle n’accepte aucun export/import tiers.</div></div>' +
      '<section class="exchange-card"><p class="page-kicker">SOURCE INTERNE DES OPÉRATIONS</p><h3>Lots du dossier</h3>' +
        '<p>Le lot regroupe les pièces issues des ventes facturées et des mouvements d’approvisionnement du module maison. Il doit être approuvé avant tout transfert ; son identifiant interne bloque un second transfert.</p>' +
        '<div class="sales-demo-create"><div class="field"><label for="sales-demo-period">Période de l’exemple interne</label><input id="sales-demo-period" type="month" min="' + esc(firstPeriod) + '" max="' + esc(lastPeriod) + '" value="' + esc(firstPeriod) + '"><span class="hint">La période doit se situer dans le cycle du dossier actif.</span></div>' +
        '<button type="button" class="btn btn-primary" data-action="create-demo-sales-run">＋ Créer un lot fictif d’opérations</button></div>' +
      '</section>' +
      '<section class="exchange-card"><p class="page-kicker">SUIVI DES LOTS</p><h3>' + runs.length + ' lot(s) enregistré(s)</h3>' + empty +
        (runs.length ? '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Référence interne</th><th>Période</th><th class="numeric">Factures</th><th class="numeric">Mouvements stock</th><th class="numeric">Ventes fictives (XOF)</th><th class="numeric">Approvisionnements fictifs (XOF)</th><th>État</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '</section>' +
      '<div class="alert info"><div>Les données du module sont isolées par dossier client dans ce navigateur. La gestion complète des clients/articles, des tarifs, de la fiscalité, des retours, des règlements, des inventaires et de la synchronisation multi-utilisateur reste à construire.</div></div>' +
    '</div>';
  }

  function createPayrollCentralizationSession(run, dossier) {
    var accountMap = Object.create(null);
    run.accountingLines.forEach(function (line) {
      var code = String(line.accountCode || '').trim();
      if (!Object.prototype.hasOwnProperty.call(accountMap, code)) accountMap[code] = S.account(code) ? code : '';
    });
    var defaultJournal = S.journals().find(function (journal) { return journal.code === 'PA'; }) || S.journals().find(function (journal) { return journal.code === 'OD'; }) || S.journals()[0];
    var parts = run.period.split('-');
    return {
      runId: run.id,
      targetDossierId: dossier.id,
      targetDate: run.date,
      targetJournal: defaultJournal && defaultJournal.code || '',
      targetReference: 'PA-' + parts[0] + '-' + parts[1] + '-001',
      mode: 'draft',
      accountMap: accountMap,
      additiveConfirmed: false,
      aggregateResult: null,
      analysis: null
    };
  }

  function payrollCentralizationEntry(session, run) {
    var aggregate = session.aggregateResult;
    var totals = run.totals || {};
    return {
      reference: String(session.targetReference || '').trim(),
      journal: String(session.targetJournal || '').trim(),
      date: String(session.targetDate || '').trim(),
      description: 'Centralisation salaires ' + String(run.period || '') + ' · ' + String(run.reference || ''),
      sourceSystem: 'PERFECTO-PAIE-RH',
      sourceId: PayrollHR.sourceId(run.dossierId, run.id),
      sourceStatus: run.status,
      sourceMetadata: {
        sourceModule: 'payroll-hr',
        sourceModuleVersion: PayrollHR.VERSION,
        feed: 'internal',
        runId: run.id,
        runReference: run.reference,
        period: run.period,
        sourcePayrollDate: run.date,
        employeeCount: run.employeeCount,
        grossPay: Number(totals.grossPay) || 0,
        deductions: Number(totals.deductions) || 0,
        netPay: Number(totals.netPay) || 0,
        sourceLineCount: run.accountingLines.length,
        totalDebit: aggregate.totalDebit,
        totalCredit: aggregate.totalCredit,
        accountMappings: aggregate.accountMappings,
        demonstrationData: run.origin === 'demo'
      },
      lines: aggregate.lines
    };
  }

  function payrollCentralizationMappingsHtml(session, run) {
    var catalog = Object.create(null);
    run.accountingLines.forEach(function (line) {
      var code = String(line.accountCode || '').trim();
      if (!catalog[code]) catalog[code] = { label: line.accountLabel || '' };
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    var accounts = postingAccounts();
    return '<details class="exchange-mapping"' + (codes.some(function (code) { return !session.accountMap[code]; }) ? ' open' : '') + '><summary>Correspondance des comptes du journal interne (' + codes.length + ' codes)</summary>' +
      '<p class="small muted">Les comptes sont proposés par Paie & RH. Associez chaque compte source à un compte existant du plan du dossier ; aucun compte ne sera créé.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte source Paie & RH</th><th>Libellé source</th><th>Compte cible</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = session.accountMap[code] || '';
        var options = '<option value="">— Choisir une correspondance —</option>' + accounts.map(function (account) {
          var inactive = account.active === false ? ' · inactif' : '';
          return '<option value="' + esc(account.code) + '"' + (account.code === mappedCode ? ' selected' : '') + '>' + esc(account.code + ' — ' + account.label + inactive) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(catalog[code].label || '—') + '</td><td><select aria-label="Associer le compte Paie & RH ' + esc(code) + '" data-payroll-account-map="' + esc(code) + '">' + options + '</select></td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function payrollCentralizationOutputHtml(lines) {
    return '<section class="exchange-card"><p class="page-kicker">PIÈCE GÉNÉRALE PRÉVISIONNELLE</p><h4>' + lines.length + ' ligne(s) après agrégation par compte cible</h4>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte cible</th><th class="numeric">Débit (XOF)</th><th class="numeric">Crédit (XOF)</th></tr></thead><tbody>' +
      lines.map(function (line) { return '<tr><td><strong>' + esc(line.account) + ' — ' + esc(line.accountLabel) + '</strong></td><td class="numeric">' + esc(amount(line.debit)) + '</td><td class="numeric">' + esc(amount(line.credit)) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  function createDemoPayrollRun() {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'payroll-hr', 'record.create', payrollAccessContext(dossier))) {
      toast('Création refusée : le droit de saisie dans Paie & RH n’est pas accordé.', 'warning');
      return;
    }
    var period = ($('#payroll-demo-period') || {}).value || '';
    var result = PayrollHR.createDemoRun(dossier, period);
    if (!result.ok) {
      toast(result.errors[0] || 'Création du lot de démonstration impossible.', 'error');
      return;
    }
    toast('Lot fictif créé dans le registre interne Paie & RH. Contrôlez-le avant approbation.', 'success');
    render();
  }

  function approveInternalPayrollRun(runId) {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'payroll-hr', 'record.validate', payrollAccessContext(dossier))) {
      toast('Approbation refusée : le droit de validation dans Paie & RH n’est pas accordé.', 'warning');
      return;
    }
    var result = PayrollHR.approveRun(dossier, runId);
    if (!result.ok) {
      toast(result.errors[0] || 'Approbation du lot impossible.', 'error');
      return;
    }
    toast('Lot de paie approuvé dans Paie & RH ; il est prêt pour la centralisation interne.', 'success');
    render();
  }

  function renderPayrollCentralizationPreview() {
    var host = $('#payroll-centralization-preview');
    var session = payrollCentralizationSession;
    if (!host || !session) return;
    var dossier = S.currentDossier();
    var run = PayrollHR.getRun(dossier.id, session.runId);
    if (!run || run.status !== 'approved' || session.targetDossierId !== dossier.id) {
      host.innerHTML = '<div class="alert error"><strong>Lot interne indisponible.</strong> Rechargez la liste Paie & RH avant de poursuivre.</div>';
      session.aggregateResult = null;
      session.analysis = null;
      return;
    }
    var dateInput = $('#payroll-centralization-date');
    var journalInput = $('#payroll-centralization-journal');
    var referenceInput = $('#payroll-centralization-reference');
    var modeSelect = $('#payroll-centralization-mode');
    if (dateInput) session.targetDate = dateInput.value;
    if (journalInput) session.targetJournal = journalInput.value;
    if (referenceInput) session.targetReference = referenceInput.value;
    if (modeSelect) session.mode = modeSelect.value === 'posted' ? 'posted' : 'draft';

    var aggregate = PayrollCentralization.aggregate(run, session.accountMap, S.accounts());
    session.aggregateResult = aggregate;
    var sourceEntry = aggregate.ok ? payrollCentralizationEntry(session, run) : null;
    var analysis = aggregate.ok
      ? S.previewExchangeImport([sourceEntry], session.mode, { sourceSystem: 'PERFECTO-PAIE-RH', accountMap: Object.create(null), journalMap: Object.create(null) })
      : { ok: false, errors: aggregate.errors, warnings: [], balancedCount: 0 };
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var canImport = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
    var canViewPayroll = hasDemoPermission(getActiveDemoMember(), 'payroll-hr', 'module.view', payrollAccessContext());
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext());
    var permissionBlocked = !canImport || !canViewPayroll || (session.mode === 'posted' && !canPost);
    var existingPostedCount = S.entries().filter(function (entry) {
      return entry.status === 'posted' && entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd;
    }).length;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    var canCommit = aggregate.ok && analysis.ok && !permissionBlocked && !additiveBlocked;
    var totals = run.totals || {};
    var summary = '<div class="exchange-summary-grid">' +
      '<div><small>Module source</small><strong>Paie & RH · interne</strong></div>' +
      '<div><small>Lot approuvé</small><strong>' + esc(run.reference) + '</strong></div>' +
      '<div><small>Période / effectif</small><strong>' + esc(run.period) + ' · ' + Number(run.employeeCount || 0) + ' salarié(s)</strong></div>' +
      '<div><small>Brut illustratif</small><strong>' + amount(totals.grossPay || 0) + ' XOF</strong></div>' +
      '<div><small>Net illustratif</small><strong>' + amount(totals.netPay || 0) + ' XOF</strong></div>' +
      '<div><small>Date source → comptabilisation</small><strong>' + esc(dateLabel(run.date)) + ' → ' + esc(session.targetDate || '—') + '</strong></div>' +
      '</div>';
    var sourceRows = run.accountingLines.map(function (line) {
      return '<tr><td><strong>' + esc(line.accountCode) + '</strong></td><td>' + esc(line.accountLabel || '') + '</td><td>' + esc(line.description || '') + '</td><td class="numeric">' + esc(amount(line.debit)) + '</td><td class="numeric">' + esc(amount(line.credit)) + '</td></tr>';
    }).join('');
    var sourceTable = '<section class="exchange-card"><p class="page-kicker">JOURNAL COMPTABLE PRODUIT PAR PAIE & RH</p><h4>' + run.accountingLines.length + ' ligne(s) source</h4><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte source</th><th>Libellé</th><th>Nature</th><th class="numeric">Débit (XOF)</th><th class="numeric">Crédit (XOF)</th></tr></thead><tbody>' + sourceRows + '</tbody></table></div></section>';
    var warningsList = (aggregate.warnings || []).concat(analysis.warnings || []);
    var warnings = warningsList.length
      ? '<div class="alert warning"><div><strong>À vérifier</strong><ul>' + warningsList.slice(0, 20).map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var errorsList = aggregate.ok ? analysis.errors : aggregate.errors;
    var errors = errorsList.length
      ? '<div class="alert error"><div><strong>' + errorsList.length + ' contrôle(s) bloquant(s)</strong><ul>' + errorsList.slice(0, 20).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
      : '<div class="alert success"><div><strong>Journal de paie équilibré et comptes associés.</strong><br>' + amount(aggregate.totalDebit) + ' XOF au débit comme au crédit · ' + aggregate.lines.length + ' ligne(s) générales prévues.</div></div>';
    var additiveWarning = existingPostedCount
      ? '<div class="alert warning"><div><strong>Le dossier contient déjà ' + existingPostedCount + ' écriture(s) validée(s) sur le cycle.</strong><br>La centralisation s’ajoutera au grand livre ; vérifiez que ce lot de paie n’est pas déjà comptabilisé.<label class="exchange-context-confirm"><input id="payroll-centralization-confirm-additive" type="checkbox"' + (session.additiveConfirmed ? ' checked' : '') + '> Je confirme l’ajout sans remplacement des écritures existantes.</label></div></div>'
      : '';
    var permissionNote = permissionBlocked
      ? '<div class="alert warning">Droits requis : consulter Paie & RH, importer dans la Comptabilité et, pour une écriture validée, disposer aussi du droit de validation comptable.</div>'
      : '';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-payroll-centralization"' + (canCommit ? '' : ' disabled') + '>Centraliser comme ' + (session.mode === 'posted' ? 'écriture validée' : 'brouillon') + '</button>';
    host.innerHTML = summary + sourceTable + payrollCentralizationMappingsHtml(session, run) +
      (aggregate.ok ? payrollCentralizationOutputHtml(aggregate.lines) : '') + warnings + errors + additiveWarning + permissionNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);
    $$('[data-payroll-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-payroll-account-map')] = select.value;
        session.additiveConfirmed = !!(host.querySelector('#payroll-centralization-confirm-additive') && host.querySelector('#payroll-centralization-confirm-additive').checked);
        renderPayrollCentralizationPreview();
      });
    });
    var confirmAdditive = $('#payroll-centralization-confirm-additive', host);
    if (confirmAdditive) confirmAdditive.addEventListener('change', function () {
      session.additiveConfirmed = confirmAdditive.checked;
      renderPayrollCentralizationPreview();
    });
  }

  function bindPayrollCentralization() {
    var runSelect = $('#payroll-centralization-run');
    var previewHost = $('#payroll-centralization-preview');
    if (!runSelect) return;
    var dossier = S.currentDossier();
    function selectRun(runId) {
      var run = PayrollHR.getRun(dossier.id, runId);
      if (!run || run.status !== 'approved') {
        payrollCentralizationSession = null;
        return;
      }
      payrollCentralizationSession = createPayrollCentralizationSession(run, dossier);
      render();
    }
    runSelect.addEventListener('change', function () { selectRun(runSelect.value); });
    if (!previewHost) return;
    if (!payrollCentralizationSession || payrollCentralizationSession.targetDossierId !== dossier.id || payrollCentralizationSession.runId !== runSelect.value) {
      var selectedRun = PayrollHR.getRun(dossier.id, runSelect.value);
      if (!selectedRun) return;
      payrollCentralizationSession = createPayrollCentralizationSession(selectedRun, dossier);
      payrollCentralizationSession.targetDate = ($('#payroll-centralization-date') || {}).value || selectedRun.date;
      payrollCentralizationSession.targetJournal = ($('#payroll-centralization-journal') || {}).value || payrollCentralizationSession.targetJournal;
      payrollCentralizationSession.targetReference = ($('#payroll-centralization-reference') || {}).value || payrollCentralizationSession.targetReference;
      payrollCentralizationSession.mode = ($('#payroll-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    }
    function syncControls() {
      if (!payrollCentralizationSession) return;
      payrollCentralizationSession.targetDate = ($('#payroll-centralization-date') || {}).value || '';
      payrollCentralizationSession.targetJournal = ($('#payroll-centralization-journal') || {}).value || '';
      payrollCentralizationSession.targetReference = ($('#payroll-centralization-reference') || {}).value || '';
      payrollCentralizationSession.mode = ($('#payroll-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
      payrollCentralizationSession.additiveConfirmed = !!($('#payroll-centralization-confirm-additive') && $('#payroll-centralization-confirm-additive').checked);
      renderPayrollCentralizationPreview();
    }
    ['payroll-centralization-date', 'payroll-centralization-journal', 'payroll-centralization-reference', 'payroll-centralization-mode'].forEach(function (id) {
      var control = $('#' + id);
      if (control) control.addEventListener('change', syncControls);
    });
    renderPayrollCentralizationPreview();
  }

  function commitAccountingPayrollCentralization() {
    var session = payrollCentralizationSession;
    var dossier = S.currentDossier();
    if (!session || session.targetDossierId !== dossier.id) {
      toast('Aucun lot Paie & RH prêt dans le dossier actif.', 'error');
      return;
    }
    var run = PayrollHR.getRun(dossier.id, session.runId);
    if (!run || run.status !== 'approved') {
      toast('Centralisation refusée : seul un lot interne approuvé dans Paie & RH peut être transmis.', 'warning');
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'payroll-hr', 'module.view', payrollAccessContext(dossier)) ||
        !hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext(dossier))) {
      toast('Centralisation refusée : les droits de consultation Paie & RH et d’import comptable sont requis.', 'warning');
      return;
    }
    var mode = ($('#payroll-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    if (mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier))) {
      toast('Validation refusée : le droit « Valider une écriture » est requis.', 'warning');
      return;
    }
    session.targetDate = ($('#payroll-centralization-date') || {}).value || '';
    session.targetJournal = ($('#payroll-centralization-journal') || {}).value || '';
    session.targetReference = ($('#payroll-centralization-reference') || {}).value || '';
    session.mode = mode;
    var aggregate = PayrollCentralization.aggregate(run, session.accountMap, S.accounts());
    session.aggregateResult = aggregate;
    if (!aggregate.ok) {
      renderPayrollCentralizationPreview();
      toast('Le journal interne de paie est bloqué par les contrôles affichés.', 'warning');
      return;
    }
    var sourceEntry = payrollCentralizationEntry(session, run);
    var options = { sourceSystem: 'PERFECTO-PAIE-RH', accountMap: Object.create(null), journalMap: Object.create(null) };
    var analysis = S.previewExchangeImport([sourceEntry], mode, options);
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var linkedEntry = payrollEntryForRun(run, dossier.id);
    var existingPostedCount = S.entries().filter(function (entry) { return entry.status === 'posted' && entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd; }).length;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    if (linkedEntry || !analysis.ok || additiveBlocked) {
      renderPayrollCentralizationPreview();
      toast(linkedEntry
        ? 'Ce lot Paie & RH a déjà été centralisé ; un transfert en doublon est refusé.'
        : (additiveBlocked ? 'Confirmez l’ajout au grand livre existant.' : 'La centralisation est bloquée par les contrôles affichés.'), 'warning');
      return;
    }
    var statusLabel = mode === 'posted' ? 'écriture validée' : 'brouillon';
    var additiveNote = existingPostedCount ? ' Les écritures validées présentes seront conservées ; aucun mouvement existant ne sera remplacé.' : '';
    if (!window.confirm('Transférer le lot interne « ' + run.reference + ' » (' + run.period + ') vers la Comptabilité comme ' + statusLabel + ', dans le journal ' + session.targetJournal + ' au ' + session.targetDate + ' ?' + additiveNote + ' Un point de restauration local sera créé.')) return;
    var result = S.importExchange([sourceEntry], mode, options);
    if (!result.ok) {
      toast(result.errors[0] || 'Centralisation impossible.', 'error');
      renderPayrollCentralizationPreview();
      return;
    }
    payrollCentralizationSession = null;
    toast('Lot Paie & RH centralisé dans la Comptabilité ; point de restauration local créé.', 'success');
    render();
  }

  function viewAccountingPayrollCentralization() {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'payroll-hr', 'module.view', payrollAccessContext(dossier))) {
      return '<div class="alert error"><div><strong>Accès Paie & RH requis.</strong><br>Ce profil ne peut pas consulter les lots de salaires du dossier actif.</div></div>';
    }
    var runs = PayrollHR.runs(dossier.id);
    var approvedRuns = runs.filter(function (run) { return run.status === 'approved'; });
    var existingSession = payrollCentralizationSession && payrollCentralizationSession.targetDossierId === dossier.id
      ? payrollCentralizationSession
      : null;
    var selectedRun = existingSession && approvedRuns.find(function (run) { return run.id === existingSession.runId; }) || approvedRuns[0] || null;
    var linkedEntry = selectedRun && payrollEntryForRun(selectedRun, dossier.id);
    var targetDate = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetDate : (selectedRun && selectedRun.date || '');
    var targetJournal = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetJournal : (S.journals().find(function (journal) { return journal.code === 'PA'; }) || S.journals()[0] || {}).code || '';
    var targetReference = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetReference : (selectedRun ? 'PA-' + selectedRun.period.replace('-', '-') + '-001' : '');
    var targetMode = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.mode : 'draft';
    var options = approvedRuns.map(function (run) {
      var linked = payrollEntryForRun(run, dossier.id);
      var label = run.reference + ' · ' + run.period + ' · ' + run.employeeCount + ' salarié(s)' + (linked ? ' · déjà transféré' : '');
      return '<option value="' + esc(run.id) + '"' + (selectedRun && run.id === selectedRun.id ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    var noRun = !approvedRuns.length
      ? '<div class="empty-state"><strong>Aucun lot approuvé à centraliser</strong><span>' + (runs.length ? runs.length + ' lot(s) restent en brouillon. Approuvez-les dans le module Paie & RH avant transfert.' : 'Créez et approuvez un lot interne dans Paie & RH. Aucun fichier externe ne peut alimenter cette centralisation.') + '</span><a class="btn btn-primary" href="#/payroll">Ouvrir Paie & RH</a></div>'
      : '';
    var linkedNotice = linkedEntry
      ? '<div class="alert success"><div><strong>Ce lot a déjà été transféré vers la Comptabilité.</strong><br>Pièce ' + esc(linkedEntry.reference) + ' · statut ' + esc(linkedEntry.status === 'posted' ? 'validé' : 'brouillon') + '. Une seconde centralisation est bloquée par l’identifiant source interne.</div></div>'
      : '';
    var controls = selectedRun && !linkedEntry
      ? '<div class="exchange-import-controls payroll-centralization-controls">' +
        '<div class="field"><label for="payroll-centralization-date">Date de la pièce générale</label><input id="payroll-centralization-date" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(targetDate) + '" required><span class="hint">La date proposée vient du lot approuvé ; elle doit rester dans le cycle du dossier.</span></div>' +
        '<div class="field"><label for="payroll-centralization-journal">Journal général</label><select id="payroll-centralization-journal" required>' + S.journals().map(function (journal) { return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journal.code + ' — ' + journal.label) + '</option>'; }).join('') + '</select><span class="hint">Le journal « PA » est proposé par défaut ; aucun journal n’est créé.</span></div>' +
        '<div class="field"><label for="payroll-centralization-reference">Référence comptable</label><input id="payroll-centralization-reference" type="text" maxlength="100" value="' + esc(targetReference) + '" required></div>' +
        '<div class="field"><label for="payroll-centralization-mode">Statut de la pièce</label><select id="payroll-centralization-mode"><option value="draft"' + (targetMode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (targetMode === 'posted' ? ' selected' : '') + '>Importer comme écriture validée</option></select><span class="hint">La validation exige une période ouverte et les droits comptables nécessaires.</span></div>' +
      '</div>'
      : '';
    return '<div class="exchange-workspace payroll-centralization-workspace">' +
      '<div class="alert info"><div><strong>Flux interne Paie & RH → Comptabilité</strong><br>La source est exclusivement un lot interne approuvé dans Paie & RH. Aucun CSV, Excel ou logiciel tiers n’est lu par ce parcours ; les calculs de paie restent dans leur module source.</div></div>' +
      (approvedRuns.length ? '<div class="field payroll-run-selector"><label for="payroll-centralization-run">Lot interne approuvé</label><select id="payroll-centralization-run">' + options + '</select></div>' : '') +
      noRun + linkedNotice + controls +
      (selectedRun && !linkedEntry ? '<div id="payroll-centralization-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Analyse du lot de paie</strong><span>Contrôlez le journal interne et les correspondances avant l’ajout au grand livre.</span></div></div>' : '') +
      '<p class="exchange-footnote">L’ajout crée une seule pièce générale, conserve le lot de paie source, crée un point de restauration local et n’écrase aucune écriture. Chaque lot interne ne peut être centralisé qu’une fois.</p>' +
    '</div>';
  }

  function createSalesCentralizationSession(run, dossier) {
    var accountMap = Object.create(null);
    run.accountingLines.forEach(function (line) {
      var code = String(line.accountCode || '').trim();
      if (!Object.prototype.hasOwnProperty.call(accountMap, code)) accountMap[code] = S.account(code) ? code : '';
    });
    var defaultJournal = S.journals().find(function (journal) { return journal.code === 'VE'; }) || S.journals().find(function (journal) { return journal.code === 'OD'; }) || S.journals()[0];
    var parts = run.period.split('-');
    return {
      runId: run.id,
      targetDossierId: dossier.id,
      targetDate: run.date,
      targetJournal: defaultJournal && defaultJournal.code || '',
      targetReference: 'VE-' + parts[0] + '-' + parts[1] + '-001',
      mode: 'draft',
      accountMap: accountMap,
      additiveConfirmed: false,
      aggregateResult: null,
      analysis: null
    };
  }

  function salesCentralizationEntry(session, run) {
    var aggregate = session.aggregateResult;
    var totals = run.totals || {};
    return {
      reference: String(session.targetReference || '').trim(),
      journal: String(session.targetJournal || '').trim(),
      date: String(session.targetDate || '').trim(),
      description: 'Centralisation ventes, stock et facturation ' + String(run.period || '') + ' · ' + String(run.reference || ''),
      sourceSystem: 'PERFECTO-VENTES-STOCK-FACTURATION',
      sourceId: SalesOperations.sourceId(run.dossierId, run.id),
      sourceStatus: run.status,
      sourceMetadata: {
        sourceModule: 'sales-stock-invoicing',
        sourceModuleVersion: SalesOperations.VERSION,
        feed: 'internal',
        runId: run.id,
        runReference: run.reference,
        period: run.period,
        sourceOperationsDate: run.date,
        invoiceCount: Number(run.invoiceCount) || 0,
        stockMovementCount: Number(run.stockMovementCount) || 0,
        invoicedSales: Number(totals.invoicedSales) || 0,
        stockPurchases: Number(totals.stockPurchases) || 0,
        sourceLineCount: run.accountingLines.length,
        totalDebit: aggregate.totalDebit,
        totalCredit: aggregate.totalCredit,
        accountMappings: aggregate.accountMappings,
        demonstrationData: run.origin === 'demo',
        taxCalculated: false,
        stockValuationCalculated: false
      },
      lines: aggregate.lines
    };
  }

  function salesCentralizationMappingsHtml(session, run) {
    var catalog = Object.create(null);
    run.accountingLines.forEach(function (line) {
      var code = String(line.accountCode || '').trim();
      if (!catalog[code]) catalog[code] = { label: line.accountLabel || '' };
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    var accounts = postingAccounts();
    return '<details class="exchange-mapping"' + (codes.some(function (code) { return !session.accountMap[code]; }) ? ' open' : '') + '><summary>Correspondance des comptes du journal interne (' + codes.length + ' codes)</summary>' +
      '<p class="small muted">Les comptes sont produits par Ventes, stock & facturation. Associez chaque compte source à un compte existant du plan du dossier ; aucun compte ne sera créé.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte source</th><th>Libellé source</th><th>Compte cible</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = session.accountMap[code] || '';
        var options = '<option value="">— Choisir une correspondance —</option>' + accounts.map(function (account) {
          var inactive = account.active === false ? ' · inactif' : '';
          return '<option value="' + esc(account.code) + '"' + (account.code === mappedCode ? ' selected' : '') + '>' + esc(account.code + ' — ' + account.label + inactive) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(catalog[code].label || '—') + '</td><td><select aria-label="Associer le compte source ' + esc(code) + '" data-sales-account-map="' + esc(code) + '">' + options + '</select></td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function salesCentralizationOutputHtml(lines) {
    return '<section class="exchange-card"><p class="page-kicker">PIÈCE GÉNÉRALE PRÉVISIONNELLE</p><h4>' + lines.length + ' ligne(s) après agrégation par compte cible</h4>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte cible</th><th class="numeric">Débit (XOF)</th><th class="numeric">Crédit (XOF)</th></tr></thead><tbody>' +
      lines.map(function (line) { return '<tr><td><strong>' + esc(line.account) + ' — ' + esc(line.accountLabel) + '</strong></td><td class="numeric">' + esc(amount(line.debit)) + '</td><td class="numeric">' + esc(amount(line.credit)) + '</td></tr>'; }).join('') +
      '</tbody></table></div></section>';
  }

  function renderSalesCentralizationPreview() {
    var host = $('#sales-centralization-preview');
    var session = salesCentralizationSession;
    if (!host || !session) return;
    var dossier = S.currentDossier();
    var run = SalesOperations.getRun(dossier.id, session.runId);
    if (!run || run.status !== 'approved' || session.targetDossierId !== dossier.id) {
      host.innerHTML = '<div class="alert error"><strong>Lot interne indisponible.</strong> Rechargez la liste Ventes, stock & facturation avant de poursuivre.</div>';
      session.aggregateResult = null;
      session.analysis = null;
      return;
    }
    var dateInput = $('#sales-centralization-date');
    var journalInput = $('#sales-centralization-journal');
    var referenceInput = $('#sales-centralization-reference');
    var modeSelect = $('#sales-centralization-mode');
    if (dateInput) session.targetDate = dateInput.value;
    if (journalInput) session.targetJournal = journalInput.value;
    if (referenceInput) session.targetReference = referenceInput.value;
    if (modeSelect) session.mode = modeSelect.value === 'posted' ? 'posted' : 'draft';

    var aggregate = SalesCentralization.aggregate(run, session.accountMap, S.accounts());
    session.aggregateResult = aggregate;
    var sourceEntry = aggregate.ok ? salesCentralizationEntry(session, run) : null;
    var options = { sourceSystem: 'PERFECTO-VENTES-STOCK-FACTURATION', accountMap: Object.create(null), journalMap: Object.create(null) };
    var analysis = aggregate.ok
      ? S.previewExchangeImport([sourceEntry], session.mode, options)
      : { ok: false, errors: aggregate.errors, warnings: [], balancedCount: 0 };
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var canImport = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
    var canViewSales = hasDemoPermission(getActiveDemoMember(), 'sales-stock-invoicing', 'module.view', salesAccessContext());
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext());
    var permissionBlocked = !canImport || !canViewSales || (session.mode === 'posted' && !canPost);
    var existingPostedCount = S.entries().filter(function (entry) {
      return entry.status === 'posted' && entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd;
    }).length;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    var canCommit = aggregate.ok && analysis.ok && !permissionBlocked && !additiveBlocked;
    var totals = run.totals || {};
    var summary = '<div class="exchange-summary-grid">' +
      '<div><small>Module source</small><strong>Ventes, stock & facturation · interne</strong></div>' +
      '<div><small>Lot approuvé</small><strong>' + esc(run.reference) + '</strong></div>' +
      '<div><small>Période / opérations</small><strong>' + esc(run.period) + ' · ' + Number(run.invoiceCount || 0) + ' facture(s), ' + Number(run.stockMovementCount || 0) + ' mouvement(s) de stock</strong></div>' +
      '<div><small>Ventes illustratives</small><strong>' + amount(totals.invoicedSales || 0) + ' XOF</strong></div>' +
      '<div><small>Approvisionnements illustratifs</small><strong>' + amount(totals.stockPurchases || 0) + ' XOF</strong></div>' +
      '<div><small>Date source → comptabilisation</small><strong>' + esc(dateLabel(run.date)) + ' → ' + esc(session.targetDate || '—') + '</strong></div>' +
      '</div>';
    var sourceRows = run.accountingLines.map(function (line) {
      var operationLabel = line.operationType === 'customer-invoice' ? 'Facture ' : (line.operationType === 'stock-receipt' ? 'Stock ' : 'Opération ');
      return '<tr><td>' + esc(operationLabel + (line.operationReference || '')) + '</td><td><strong>' + esc(line.accountCode) + '</strong><br><span class="small muted">' + esc(line.accountLabel || '') + '</span></td><td>' + esc(line.description || '') + '</td><td class="numeric">' + esc(amount(line.debit)) + '</td><td class="numeric">' + esc(amount(line.credit)) + '</td></tr>';
    }).join('');
    var sourceTable = '<section class="exchange-card"><p class="page-kicker">JOURNAL COMPTABLE PRODUIT PAR LE MODULE MAISON</p><h4>' + run.accountingLines.length + ' ligne(s) source</h4><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Opération source</th><th>Compte source</th><th>Libellé</th><th class="numeric">Débit (XOF)</th><th class="numeric">Crédit (XOF)</th></tr></thead><tbody>' + sourceRows + '</tbody></table></div></section>';
    var warningsList = (aggregate.warnings || []).concat(analysis.warnings || []);
    var warnings = warningsList.length
      ? '<div class="alert warning"><div><strong>À vérifier</strong><ul>' + warningsList.slice(0, 20).map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var errorsList = aggregate.ok ? analysis.errors : aggregate.errors;
    var errors = errorsList.length
      ? '<div class="alert error"><div><strong>' + errorsList.length + ' contrôle(s) bloquant(s)</strong><ul>' + errorsList.slice(0, 20).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
      : '<div class="alert success"><div><strong>Journal interne équilibré et comptes associés.</strong><br>' + amount(aggregate.totalDebit) + ' XOF au débit comme au crédit · ' + aggregate.lines.length + ' ligne(s) générales prévues.</div></div>';
    var additiveWarning = existingPostedCount
      ? '<div class="alert warning"><div><strong>Le dossier contient déjà ' + existingPostedCount + ' écriture(s) validée(s) sur le cycle.</strong><br>La centralisation s’ajoutera au grand livre ; vérifiez que ce lot n’est pas déjà comptabilisé.<label class="exchange-context-confirm"><input id="sales-centralization-confirm-additive" type="checkbox"' + (session.additiveConfirmed ? ' checked' : '') + '> Je confirme l’ajout sans remplacement des écritures existantes.</label></div></div>'
      : '';
    var permissionNote = permissionBlocked
      ? '<div class="alert warning">Droits requis : consulter Ventes, stock & facturation, importer dans la Comptabilité et, pour une écriture validée, disposer aussi du droit de validation comptable.</div>'
      : '';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-sales-centralization"' + (canCommit ? '' : ' disabled') + '>Centraliser comme ' + (session.mode === 'posted' ? 'écriture validée' : 'brouillon') + '</button>';
    host.innerHTML = summary + sourceTable + salesCentralizationMappingsHtml(session, run) +
      (aggregate.ok ? salesCentralizationOutputHtml(aggregate.lines) : '') + warnings + errors + additiveWarning + permissionNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);
    $$('[data-sales-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-sales-account-map')] = select.value;
        session.additiveConfirmed = !!(host.querySelector('#sales-centralization-confirm-additive') && host.querySelector('#sales-centralization-confirm-additive').checked);
        renderSalesCentralizationPreview();
      });
    });
    var confirmAdditive = $('#sales-centralization-confirm-additive', host);
    if (confirmAdditive) confirmAdditive.addEventListener('change', function () {
      session.additiveConfirmed = confirmAdditive.checked;
      renderSalesCentralizationPreview();
    });
  }

  function bindSalesCentralization() {
    var runSelect = $('#sales-centralization-run');
    var previewHost = $('#sales-centralization-preview');
    if (!runSelect) return;
    var dossier = S.currentDossier();
    function selectRun(runId) {
      var run = SalesOperations.getRun(dossier.id, runId);
      if (!run || run.status !== 'approved') {
        salesCentralizationSession = null;
        return;
      }
      salesCentralizationSession = createSalesCentralizationSession(run, dossier);
      render();
    }
    runSelect.addEventListener('change', function () { selectRun(runSelect.value); });
    if (!previewHost) return;
    if (!salesCentralizationSession || salesCentralizationSession.targetDossierId !== dossier.id || salesCentralizationSession.runId !== runSelect.value) {
      var selectedRun = SalesOperations.getRun(dossier.id, runSelect.value);
      if (!selectedRun) return;
      salesCentralizationSession = createSalesCentralizationSession(selectedRun, dossier);
      salesCentralizationSession.targetDate = ($('#sales-centralization-date') || {}).value || selectedRun.date;
      salesCentralizationSession.targetJournal = ($('#sales-centralization-journal') || {}).value || salesCentralizationSession.targetJournal;
      salesCentralizationSession.targetReference = ($('#sales-centralization-reference') || {}).value || salesCentralizationSession.targetReference;
      salesCentralizationSession.mode = ($('#sales-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    }
    function syncControls() {
      if (!salesCentralizationSession) return;
      salesCentralizationSession.targetDate = ($('#sales-centralization-date') || {}).value || '';
      salesCentralizationSession.targetJournal = ($('#sales-centralization-journal') || {}).value || '';
      salesCentralizationSession.targetReference = ($('#sales-centralization-reference') || {}).value || '';
      salesCentralizationSession.mode = ($('#sales-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
      salesCentralizationSession.additiveConfirmed = !!($('#sales-centralization-confirm-additive') && $('#sales-centralization-confirm-additive').checked);
      renderSalesCentralizationPreview();
    }
    ['sales-centralization-date', 'sales-centralization-journal', 'sales-centralization-reference', 'sales-centralization-mode'].forEach(function (id) {
      var control = $('#' + id);
      if (control) control.addEventListener('change', syncControls);
    });
    renderSalesCentralizationPreview();
  }

  function commitAccountingSalesCentralization() {
    var session = salesCentralizationSession;
    var dossier = S.currentDossier();
    if (!session || session.targetDossierId !== dossier.id) {
      toast('Aucun lot Ventes, stock & facturation prêt dans le dossier actif.', 'error');
      return;
    }
    var run = SalesOperations.getRun(dossier.id, session.runId);
    if (!run || run.status !== 'approved') {
      toast('Centralisation refusée : seul un lot interne approuvé dans Ventes, stock & facturation peut être transmis.', 'warning');
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'sales-stock-invoicing', 'module.view', salesAccessContext(dossier)) ||
        !hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext(dossier))) {
      toast('Centralisation refusée : les droits de consultation du module maison et d’import comptable sont requis.', 'warning');
      return;
    }
    var mode = ($('#sales-centralization-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    if (mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier))) {
      toast('Validation refusée : le droit « Valider une écriture » est requis.', 'warning');
      return;
    }
    session.targetDate = ($('#sales-centralization-date') || {}).value || '';
    session.targetJournal = ($('#sales-centralization-journal') || {}).value || '';
    session.targetReference = ($('#sales-centralization-reference') || {}).value || '';
    session.mode = mode;
    var aggregate = SalesCentralization.aggregate(run, session.accountMap, S.accounts());
    session.aggregateResult = aggregate;
    if (!aggregate.ok) {
      renderSalesCentralizationPreview();
      toast('Le journal interne est bloqué par les contrôles affichés.', 'warning');
      return;
    }
    var sourceEntry = salesCentralizationEntry(session, run);
    var options = { sourceSystem: 'PERFECTO-VENTES-STOCK-FACTURATION', accountMap: Object.create(null), journalMap: Object.create(null) };
    var analysis = S.previewExchangeImport([sourceEntry], mode, options);
    session.analysis = analysis;
    session.previewEntry = sourceEntry;
    var linkedEntry = salesEntryForRun(run, dossier.id);
    var existingPostedCount = S.entries().filter(function (entry) { return entry.status === 'posted' && entry.date >= dossier.cycleStart && entry.date <= dossier.cycleEnd; }).length;
    var additiveBlocked = existingPostedCount > 0 && !session.additiveConfirmed;
    if (linkedEntry || !analysis.ok || additiveBlocked) {
      renderSalesCentralizationPreview();
      toast(linkedEntry
        ? 'Ce lot Ventes, stock & facturation a déjà été centralisé ; le doublon est refusé.'
        : (additiveBlocked ? 'Confirmez l’ajout au grand livre existant.' : 'La centralisation est bloquée par les contrôles affichés.'), 'warning');
      return;
    }
    var statusLabel = mode === 'posted' ? 'écriture validée' : 'brouillon';
    var additiveNote = existingPostedCount ? ' Les écritures validées présentes seront conservées ; aucun mouvement existant ne sera remplacé.' : '';
    if (!window.confirm('Transférer le lot interne « ' + run.reference + ' » (' + run.period + ') vers la Comptabilité comme ' + statusLabel + ', dans le journal ' + session.targetJournal + ' au ' + session.targetDate + ' ?' + additiveNote + ' Un point de restauration local sera créé.')) return;
    var result = S.importExchange([sourceEntry], mode, options);
    if (!result.ok) {
      toast(result.errors[0] || 'Centralisation impossible.', 'error');
      renderSalesCentralizationPreview();
      return;
    }
    salesCentralizationSession = null;
    toast('Lot interne centralisé dans la Comptabilité ; point de restauration local créé.', 'success');
    render();
  }

  function viewAccountingSalesCentralization() {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'sales-stock-invoicing', 'module.view', salesAccessContext(dossier))) {
      return '<div class="alert error"><div><strong>Accès Ventes, stock & facturation requis.</strong><br>Ce profil ne peut pas consulter les lots d’opérations du dossier actif.</div></div>';
    }
    var runs = SalesOperations.runs(dossier.id);
    var approvedRuns = runs.filter(function (run) { return run.status === 'approved'; });
    var existingSession = salesCentralizationSession && salesCentralizationSession.targetDossierId === dossier.id
      ? salesCentralizationSession
      : null;
    var selectedRun = existingSession && approvedRuns.find(function (run) { return run.id === existingSession.runId; }) || approvedRuns[0] || null;
    var linkedEntry = selectedRun && salesEntryForRun(selectedRun, dossier.id);
    var targetDate = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetDate : (selectedRun && selectedRun.date || '');
    var targetJournal = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetJournal : (S.journals().find(function (journal) { return journal.code === 'VE'; }) || S.journals()[0] || {}).code || '';
    var targetReference = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetReference : (selectedRun ? 'VE-' + selectedRun.period + '-001' : '');
    var targetMode = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.mode : 'draft';
    var options = approvedRuns.map(function (run) {
      var linked = salesEntryForRun(run, dossier.id);
      var label = run.reference + ' · ' + run.period + ' · ' + Number(run.invoiceCount || 0) + ' facture(s), ' + Number(run.stockMovementCount || 0) + ' mouvement(s)' + (linked ? ' · déjà transféré' : '');
      return '<option value="' + esc(run.id) + '"' + (selectedRun && run.id === selectedRun.id ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
    var noRun = !approvedRuns.length
      ? '<div class="empty-state"><strong>Aucun lot approuvé à centraliser</strong><span>' + (runs.length ? runs.length + ' lot(s) restent en brouillon. Approuvez-les dans le module Ventes, stock & facturation avant transfert.' : 'Créez et approuvez un lot interne dans Ventes, stock & facturation. Aucun fichier externe ne peut alimenter ce parcours.') + '</span><a class="btn btn-primary" href="#/sales">Ouvrir Ventes, stock & facturation</a></div>'
      : '';
    var linkedNotice = linkedEntry
      ? '<div class="alert success"><div><strong>Ce lot a déjà été transféré vers la Comptabilité.</strong><br>Pièce ' + esc(linkedEntry.reference) + ' · statut ' + esc(linkedEntry.status === 'posted' ? 'validé' : 'brouillon') + '. Une seconde centralisation est bloquée par l’identifiant source interne.</div></div>'
      : '';
    var controls = selectedRun && !linkedEntry
      ? '<div class="exchange-import-controls sales-centralization-controls">' +
        '<div class="field"><label for="sales-centralization-date">Date de la pièce générale</label><input id="sales-centralization-date" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(targetDate) + '" required><span class="hint">La date proposée vient du lot approuvé ; elle doit rester dans le cycle du dossier.</span></div>' +
        '<div class="field"><label for="sales-centralization-journal">Journal général</label><select id="sales-centralization-journal" required>' + S.journals().map(function (journal) { return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journal.code + ' — ' + journal.label) + '</option>'; }).join('') + '</select><span class="hint">Le journal « VE » est proposé par défaut ; aucun journal n’est créé.</span></div>' +
        '<div class="field"><label for="sales-centralization-reference">Référence comptable</label><input id="sales-centralization-reference" type="text" maxlength="100" value="' + esc(targetReference) + '" required></div>' +
        '<div class="field"><label for="sales-centralization-mode">Statut de la pièce</label><select id="sales-centralization-mode"><option value="draft"' + (targetMode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (targetMode === 'posted' ? ' selected' : '') + '>Importer comme écriture validée</option></select><span class="hint">La validation exige une période ouverte et les droits comptables nécessaires.</span></div>' +
      '</div>'
      : '';
    return '<div class="exchange-workspace sales-centralization-workspace">' +
      '<div class="alert info"><div><strong>Flux interne Ventes, stock & facturation → Comptabilité</strong><br>La source est exclusivement un lot approuvé produit dans le module maison. Aucun CSV, Excel ou logiciel tiers n’est lu par ce parcours ; les règles de facturation et de valorisation du stock restent à construire.</div></div>' +
      (approvedRuns.length ? '<div class="field sales-run-selector"><label for="sales-centralization-run">Lot interne approuvé</label><select id="sales-centralization-run">' + options + '</select></div>' : '') +
      noRun + linkedNotice + controls +
      (selectedRun && !linkedEntry ? '<div id="sales-centralization-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Analyse du lot d’opérations</strong><span>Contrôlez le journal interne et les correspondances avant l’ajout au grand livre.</span></div></div>' : '') +
      '<p class="exchange-footnote">L’ajout crée une seule pièce générale, conserve le lot source, crée un point de restauration local et n’écrase aucune écriture. Chaque lot interne ne peut être centralisé qu’une fois.</p>' +
    '</div>';
  }

  function cancellationSourceLabel(moduleId) {
    return moduleId === 'payroll-hr'
      ? 'Paie & RH'
      : (moduleId === 'sales-stock-invoicing' ? 'Ventes, stock & facturation' : 'Source interne');
  }

  function canViewCentralizationSource(entry, dossier, member) {
    var moduleId = CentralizationCancellation.sourceModuleForEntry(entry);
    return !!moduleId && hasDemoPermission(member || getActiveDemoMember(), moduleId, 'module.view', accountingAccessContext(dossier));
  }

  function accessibleInternalCentralizations(dossier) {
    var member = getActiveDemoMember();
    return sortedEntries(S.entries()).filter(function (entry) {
      return CentralizationCancellation.isInternalCentralization(entry) &&
        (entry.status === 'draft' || entry.status === 'posted') &&
        canViewCentralizationSource(entry, dossier, member);
    });
  }

  function cancellationDateIsOpen(date, dossier) {
    if (!date || date < dossier.cycleStart || date > dossier.cycleEnd || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) return false;
    return S.periodStatus(Number(date.slice(0, 4)), Number(date.slice(5, 7))) !== 'closed';
  }

  function defaultCentralizationCancellationDate(original, dossier) {
    if (original && cancellationDateIsOpen(original.date, dossier)) return original.date;
    var today = S.todayIso();
    if (cancellationDateIsOpen(today, dossier)) return today;
    var startYear = Number(dossier.cycleStart.slice(0, 4));
    var startMonth = Number(dossier.cycleStart.slice(5, 7));
    var endYear = Number(dossier.cycleEnd.slice(0, 4));
    var endMonth = Number(dossier.cycleEnd.slice(5, 7));
    var monthCount = (endYear - startYear) * 12 + endMonth - startMonth;
    for (var offset = 0; offset <= monthCount; offset += 1) {
      var absoluteMonth = startYear * 12 + startMonth - 1 + offset;
      var year = Math.floor(absoluteMonth / 12);
      var month = absoluteMonth % 12 + 1;
      var monthStart = String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-01';
      var candidate = offset === 0 && dossier.cycleStart.slice(8, 10) > '01' ? dossier.cycleStart : monthStart;
      if (candidate <= dossier.cycleEnd && cancellationDateIsOpen(candidate, dossier)) return candidate;
    }
    return '';
  }

  function createCentralizationCancellationSession(original, dossier) {
    var journal = original && S.journal(original.journal) ? original.journal : '';
    if (!journal) journal = (S.journals().find(function (item) { return item.code === 'OD'; }) || S.journals()[0] || {}).code || '';
    var date = defaultCentralizationCancellationDate(original, dossier);
    return {
      originalEntryId: original.id,
      targetDossierId: dossier.id,
      targetDate: date,
      targetJournal: journal,
      targetReference: S.nextReference(journal, date),
      reason: '',
      mode: 'draft'
    };
  }

  function viewAccountingCentralizationCancellation() {
    var dossier = S.currentDossier();
    var entries = accessibleInternalCentralizations(dossier);
    var allEntries = S.entries();
    var session = centralizationCancellationSession && centralizationCancellationSession.targetDossierId === dossier.id
      ? centralizationCancellationSession
      : null;
    var selectedOriginal = session && entries.find(function (entry) { return entry.id === session.originalEntryId; }) || null;
    if (selectedOriginal && (selectedOriginal.status !== 'posted' || CentralizationCancellation.findReversal(allEntries, selectedOriginal))) {
      centralizationCancellationSession = null;
      selectedOriginal = null;
      session = null;
    }

    var rows = entries.map(function (entry) {
      var moduleId = CentralizationCancellation.sourceModuleForEntry(entry);
      var metadata = entry.sourceMetadata || {};
      var reversal = CentralizationCancellation.findReversal(allEntries, entry);
      var state = '';
      var action = '';
      if (reversal && reversal.status === 'posted') {
        state = '<span class="badge posted">Annulée</span><small>Écriture inverse validée : ' + esc(reversal.reference) + ' · original conservé</small>';
      } else if (reversal && reversal.status === 'draft') {
        state = '<span class="badge draft">Annulation en brouillon</span><small>' + esc(reversal.reference) + ' · à valider dans les pièces comptables</small>';
      } else if (entry.status === 'draft') {
        state = '<span class="badge draft">Brouillon non comptabilisé</span><small>Aucun effet sur le grand livre</small>';
        action = '<button type="button" class="btn btn-danger btn-sm" data-action="cancel-draft-centralization" data-id="' + esc(entry.id) + '">Supprimer le brouillon</button>';
      } else {
        state = '<span class="badge posted">Validée · non annulée</span><small>Une écriture inverse sera ajoutée ; l’originale restera intacte</small>';
        action = '<button type="button" class="btn btn-primary btn-sm" data-action="select-centralization-cancellation" data-id="' + esc(entry.id) + '">Préparer l’annulation</button>';
      }
      if (reversal && reversal.sourceMetadata && reversal.sourceMetadata.cancellationReason) {
        state += '<small>Motif : ' + esc(reversal.sourceMetadata.cancellationReason) + '</small>';
      }
      return '<tr' + (selectedOriginal && selectedOriginal.id === entry.id ? ' class="is-selected"' : '') + '>' +
        '<td><strong>' + esc(entry.reference) + '</strong><br><span class="small muted">' + esc(cancellationSourceLabel(moduleId)) + ' · ' + esc(metadata.runReference || 'lot interne') + '</span></td>' +
        '<td>' + esc(dateLabel(entry.date)) + '<br><span class="small muted">Journal ' + esc(entry.journal) + ' · ' + esc(amount(entryAmount(entry))) + ' XOF</span></td>' +
        '<td>' + state + '</td><td>' + action + '</td></tr>';
    }).join('');
    var empty = entries.length
      ? ''
      : '<div class="empty-state"><strong>Aucune centralisation interne accessible dans ce dossier</strong><span>Seules les pièces issues de Paie & RH ou de Ventes, stock & facturation apparaissent ici. Les imports Excel/CSV et logiciels tiers sont exclus. Accordez aussi le droit de consultation du module source pour afficher ses centralisations.</span></div>';

    var controls = '';
    var preview = '';
    if (selectedOriginal && session) {
      var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier));
      if (!canPost && session.mode === 'posted') session.mode = 'draft';
      var postedOption = canPost
        ? '<option value="posted"' + (session.mode === 'posted' ? ' selected' : '') + '>Créer et valider immédiatement l’écriture inverse</option>'
        : '';
      controls = '<section class="exchange-card centralization-cancellation-controls"><p class="page-kicker">ÉCRITURE INVERSE</p><h4>Annuler la pièce ' + esc(selectedOriginal.reference) + '</h4>' +
        '<div class="alert warning"><div><strong>La pièce validée ne sera ni modifiée ni supprimée.</strong><br>L’annulation ajoutera les mêmes lignes avec débits et crédits inversés. En mode brouillon, l’effet prendra place dans le grand livre seulement après validation.</div></div>' +
        '<div class="exchange-import-controls">' +
          '<div class="field"><label for="centralization-cancellation-date">Date de l’écriture inverse</label><input id="centralization-cancellation-date" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(session.targetDate) + '" required><span class="hint">La date doit se trouver dans le cycle du dossier et une période ouverte. Si la période d’origine est clôturée, une date ouverte est proposée.</span></div>' +
          '<div class="field"><label for="centralization-cancellation-journal">Journal</label><select id="centralization-cancellation-journal" required>' + journalOptions(session.targetJournal) + '</select></div>' +
          '<div class="field"><label for="centralization-cancellation-reason">Motif de l’annulation</label><textarea id="centralization-cancellation-reason" maxlength="250" rows="2" required placeholder="Ex. erreur de compte ou lot centralisé en double">' + esc(session.reason || '') + '</textarea><span class="hint">Ce motif sera conservé dans la provenance de l’écriture inverse (250 caractères maximum).</span></div>' +
          '<div class="field"><label for="centralization-cancellation-reference">Référence de l’écriture inverse</label><input id="centralization-cancellation-reference" type="text" maxlength="100" value="' + esc(session.targetReference) + '" required></div>' +
          '<div class="field"><label for="centralization-cancellation-mode">Enregistrement</label><select id="centralization-cancellation-mode"><option value="draft"' + (session.mode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option>' + postedOption + '</select><span class="hint">La validation immédiate requiert aussi le droit « Valider une écriture ».</span></div>' +
        '</div></section>';
      preview = '<div id="centralization-cancellation-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Vérification de l’écriture inverse</strong><span>Les montants, le dossier, la période et la provenance vont être contrôlés.</span></div></div>';
    }

    return '<div class="exchange-workspace centralization-cancellation-workspace">' +
      '<div class="alert info"><div><strong>Annulation réservée aux centralisations PERFECTO internes.</strong><br>Le périmètre couvre les pièces de Paie & RH et de Ventes, stock & facturation dans le dossier actif. Les fichiers d’échange et logiciels tiers ne sont pas sélectionnables.</div></div>' +
      '<section class="exchange-card"><p class="page-kicker">HISTORIQUE DES CENTRALISATIONS INTERNES</p><h4>' + entries.length + ' pièce(s) accessible(s)</h4>' + empty +
        (entries.length ? '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Pièce d’origine / module source</th><th>Date et montant</th><th>État de l’annulation</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '</section>' + controls + preview +
      '<p class="exchange-footnote">Un brouillon non comptabilisé peut être supprimé sans toucher au lot source, puis retransféré si nécessaire. Une pièce validée est immuable : son écriture inverse est liée à l’original, protégée contre les doublons et précédée d’un point de restauration local.</p>' +
    '</div>';
  }

  function selectCentralizationCancellation(entryId) {
    var dossier = S.currentDossier();
    var original = S.entry(entryId);
    if (!original || !CentralizationCancellation.isInternalCentralization(original) || original.status !== 'posted' ||
        !canViewCentralizationSource(original, dossier, getActiveDemoMember())) {
      toast('Cette pièce n’est pas une centralisation interne validée accessible dans le dossier actif.', 'warning');
      return;
    }
    if (CentralizationCancellation.findReversal(S.entries(), original)) {
      toast('Une annulation existe déjà pour cette pièce ; aucun doublon ne sera créé.', 'warning');
      render();
      return;
    }
    centralizationCancellationSession = createCentralizationCancellationSession(original, dossier);
    render();
  }

  function bindCentralizationCancellation() {
    var session = centralizationCancellationSession;
    var dossier = S.currentDossier();
    if (!session || session.targetDossierId !== dossier.id) return;
    var dateInput = $('#centralization-cancellation-date');
    var journalInput = $('#centralization-cancellation-journal');
    var reasonInput = $('#centralization-cancellation-reason');
    var referenceInput = $('#centralization-cancellation-reference');
    var modeInput = $('#centralization-cancellation-mode');
    function syncAndPreview() {
      if (dateInput) session.targetDate = dateInput.value;
      if (journalInput) session.targetJournal = journalInput.value;
      if (reasonInput) session.reason = reasonInput.value;
      if (referenceInput) session.targetReference = referenceInput.value;
      if (modeInput) session.mode = modeInput.value === 'posted' ? 'posted' : 'draft';
      renderCentralizationCancellationPreview();
    }
    [dateInput, journalInput, reasonInput, referenceInput, modeInput].forEach(function (control) {
      if (!control) return;
      control.addEventListener(control === referenceInput || control === reasonInput ? 'input' : 'change', syncAndPreview);
      if (control === referenceInput || control === reasonInput) control.addEventListener('change', syncAndPreview);
    });
    renderCentralizationCancellationPreview();
  }

  function renderCentralizationCancellationPreview() {
    var host = $('#centralization-cancellation-preview');
    var session = centralizationCancellationSession;
    if (!host || !session) return;
    var dossier = S.currentDossier();
    var member = getActiveDemoMember();
    var original = S.entry(session.originalEntryId);
    if (!original || session.targetDossierId !== dossier.id || !CentralizationCancellation.isInternalCentralization(original) ||
        original.status !== 'posted' || !canViewCentralizationSource(original, dossier, member)) {
      host.innerHTML = '<div class="alert error"><strong>Pièce d’origine indisponible.</strong> Le dossier, le statut ou le droit de consultation du module source ne correspond plus.</div>';
      return;
    }
    var existingReversal = CentralizationCancellation.findReversal(S.entries(), original);
    if (existingReversal) {
      host.innerHTML = '<div class="alert warning"><strong>Une annulation est déjà liée à ' + esc(original.reference) + '.</strong> Écriture ' + esc(existingReversal.reference) + ' · statut ' + esc(existingReversal.status === 'posted' ? 'validée' : 'brouillon') + '.</div>';
      return;
    }
    var dateInput = $('#centralization-cancellation-date');
    var journalInput = $('#centralization-cancellation-journal');
    var reasonInput = $('#centralization-cancellation-reason');
    var referenceInput = $('#centralization-cancellation-reference');
    var modeInput = $('#centralization-cancellation-mode');
    if (dateInput) session.targetDate = dateInput.value;
    if (journalInput) session.targetJournal = journalInput.value;
    if (reasonInput) session.reason = reasonInput.value;
    if (referenceInput) session.targetReference = referenceInput.value;
    if (modeInput) session.mode = modeInput.value === 'posted' ? 'posted' : 'draft';

    var built = CentralizationCancellation.buildReversalEntry(original, {
      date: session.targetDate,
      journal: session.targetJournal,
      reference: session.targetReference,
      reason: session.reason
    });
    var analysis = built.ok
      ? S.previewExchangeImport([built.entry], session.mode, {
        sourceSystem: CentralizationCancellation.CANCELLATION_SOURCE,
        accountMap: Object.create(null),
        journalMap: Object.create(null)
      })
      : { ok: false, errors: built.errors, warnings: [], entries: [] };
    session.previewEntry = built.entry;
    session.analysis = analysis;
    var canCancel = hasDemoPermission(member, 'accounting', 'centralization.cancel', accountingAccessContext(dossier));
    var canPost = hasDemoPermission(member, 'accounting', 'entry.validate', accountingAccessContext(dossier));
    var permissionBlocked = !canCancel || (session.mode === 'posted' && !canPost);
    var canCommit = built.ok && analysis.ok && !permissionBlocked;
    var originalRows = (original.lines || []).map(function (line, index) {
      var reversed = built.ok ? built.entry.lines[index] : null;
      var account = S.account(line.account);
      return '<tr><td><strong>' + esc(line.account) + '</strong><br><span class="small muted">' + esc(account ? account.label : (line.accountLabel || '')) + '</span></td>' +
        '<td class="numeric">' + esc(amount(line.debit)) + '</td><td class="numeric">' + esc(amount(line.credit)) + '</td>' +
        '<td class="numeric">' + (reversed ? esc(amount(reversed.debit)) : '—') + '</td><td class="numeric">' + (reversed ? esc(amount(reversed.credit)) : '—') + '</td></tr>';
    }).join('');
    var totals = built.ok ? S.totals(built.entry.lines) : { debit: 0, credit: 0, balanced: false };
    var summary = '<div class="exchange-summary-grid">' +
      '<div><small>Pièce d’origine</small><strong>' + esc(original.reference) + ' · validée</strong></div>' +
      '<div><small>Source maison</small><strong>' + esc(cancellationSourceLabel(CentralizationCancellation.sourceModuleForEntry(original))) + '</strong></div>' +
      '<div><small>Date source → annulation</small><strong>' + esc(dateLabel(original.date)) + ' → ' + esc(dateLabel(session.targetDate)) + '</strong></div>' +
      '<div><small>Journal inverse</small><strong>' + esc(session.targetJournal || '—') + ' · ' + esc(session.targetReference || '—') + '</strong></div>' +
      '</div>';
    var table = '<section class="exchange-card"><p class="page-kicker">COMPARAISON DES MOUVEMENTS</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte</th><th class="numeric">Origine débit</th><th class="numeric">Origine crédit</th><th class="numeric">Annulation débit</th><th class="numeric">Annulation crédit</th></tr></thead><tbody>' + originalRows +
      '</tbody><tfoot><tr><td>Totaux</td><td class="numeric">' + esc(amount(S.totals(original.lines).debit)) + '</td><td class="numeric">' + esc(amount(S.totals(original.lines).credit)) + '</td><td class="numeric">' + esc(amount(totals.debit)) + '</td><td class="numeric">' + esc(amount(totals.credit)) + '</td></tr></tfoot></table></div></section>';
    var warnings = (analysis.warnings || []).length
      ? '<div class="alert warning"><div><strong>À vérifier</strong><ul>' + analysis.warnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var errorsList = built.ok ? (analysis.errors || []) : built.errors;
    var errors = errorsList.length
      ? '<div class="alert error"><div><strong>' + errorsList.length + ' contrôle(s) bloquant(s)</strong><ul>' + errorsList.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
      : '<div class="alert success"><div><strong>Écriture inverse équilibrée.</strong><br>' + esc(amount(totals.debit)) + ' XOF au débit comme au crédit · la provenance de l’original sera conservée.</div></div>';
    var permissionNote = permissionBlocked
      ? '<div class="alert warning">' + (!canCancel ? 'Le droit « Annuler une centralisation interne » est requis.' : 'Le droit « Valider une écriture » est requis pour comptabiliser immédiatement l’écriture inverse.') + '</div>'
      : '';
    var buttonLabel = session.mode === 'posted' ? 'Annuler et comptabiliser' : 'Créer le brouillon d’annulation';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-centralization-cancellation"' + (canCommit ? '' : ' disabled') + '>' + buttonLabel + '</button>';
    host.innerHTML = summary + table + warnings + errors + permissionNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);
  }

  function commitCentralizationCancellation() {
    var session = centralizationCancellationSession;
    var dossier = S.currentDossier();
    var member = getActiveDemoMember();
    if (!session || session.targetDossierId !== dossier.id) {
      toast('Sélectionnez une centralisation interne validée dans le dossier actif.', 'error');
      return;
    }
    var original = S.entry(session.originalEntryId);
    if (!original || !CentralizationCancellation.isInternalCentralization(original) || original.status !== 'posted' ||
        !canViewCentralizationSource(original, dossier, member)) {
      toast('Annulation refusée : la pièce n’est pas une centralisation interne validée accessible.', 'warning');
      render();
      return;
    }
    if (CentralizationCancellation.findReversal(S.entries(), original)) {
      toast('Annulation refusée : une écriture inverse est déjà liée à cette pièce.', 'warning');
      render();
      return;
    }
    var mode = ($('#centralization-cancellation-mode') || {}).value === 'posted' ? 'posted' : 'draft';
    if (!hasDemoPermission(member, 'accounting', 'centralization.cancel', accountingAccessContext(dossier)) ||
        (mode === 'posted' && !hasDemoPermission(member, 'accounting', 'entry.validate', accountingAccessContext(dossier)))) {
      toast('Annulation refusée : les droits d’annulation et, le cas échéant, de validation sont requis.', 'warning');
      renderCentralizationCancellationPreview();
      return;
    }
    session.targetDate = ($('#centralization-cancellation-date') || {}).value || '';
    session.targetJournal = ($('#centralization-cancellation-journal') || {}).value || '';
    session.targetReference = ($('#centralization-cancellation-reference') || {}).value || '';
    session.reason = ($('#centralization-cancellation-reason') || {}).value || '';
    session.mode = mode;
    var built = CentralizationCancellation.buildReversalEntry(original, {
      date: session.targetDate,
      journal: session.targetJournal,
      reference: session.targetReference,
      reason: session.reason
    });
    if (!built.ok) {
      renderCentralizationCancellationPreview();
      toast(built.errors[0] || 'Écriture inverse invalide.', 'error');
      return;
    }
    var options = {
      sourceSystem: CentralizationCancellation.CANCELLATION_SOURCE,
      accountMap: Object.create(null),
      journalMap: Object.create(null)
    };
    var analysis = S.previewExchangeImport([built.entry], mode, options);
    session.analysis = analysis;
    session.previewEntry = built.entry;
    if (!analysis.ok) {
      renderCentralizationCancellationPreview();
      toast(analysis.errors[0] || 'Les contrôles comptables bloquent cette annulation.', 'warning');
      return;
    }
    var statusLabel = mode === 'posted' ? 'validée immédiatement' : 'créée en brouillon';
    if (!window.confirm('Annuler la centralisation « ' + original.reference + ' » en ajoutant l’écriture inverse « ' + session.targetReference + ' », ' + statusLabel + ' dans le journal ' + session.targetJournal + ' au ' + session.targetDate + ' ? La pièce d’origine reste intacte et un point de restauration local sera créé.')) return;
    var result = S.importExchange([built.entry], mode, options);
    if (!result.ok) {
      toast(result.errors[0] || 'Écriture inverse impossible à enregistrer.', 'error');
      renderCentralizationCancellationPreview();
      return;
    }
    centralizationCancellationSession = null;
    toast(mode === 'posted'
      ? 'Écriture inverse comptabilisée ; la pièce d’origine reste intacte.'
      : 'Brouillon d’annulation créé ; validez-le dans les pièces comptables pour prendre effet.', 'success');
    render();
  }

  function cancelDraftCentralization(entryId) {
    var dossier = S.currentDossier();
    var entry = S.entry(entryId);
    if (!entry || !CentralizationCancellation.isInternalCentralization(entry) || entry.status !== 'draft' ||
        !canViewCentralizationSource(entry, dossier, getActiveDemoMember())) {
      toast('Suppression refusée : le brouillon n’est pas une centralisation interne accessible.', 'warning');
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.delete', accountingAccessContext(dossier))) {
      toast('Le droit « Supprimer un brouillon » est requis.', 'warning');
      return;
    }
    if (!window.confirm('Supprimer le brouillon de centralisation « ' + entry.reference + ' » ? Il n’a aucun effet sur le grand livre. Le lot interne source restera intact et pourra être retransféré. Un point de restauration local sera conservé.')) return;
    var result = S.deleteDraft(entry.id);
    if (!result.ok) {
      toast(result.errors[0] || 'Suppression du brouillon impossible.', 'error');
      return;
    }
    toast('Brouillon supprimé ; le lot interne source n’a pas été modifié.', 'success');
    render();
  }

  function createDemoSalesRun() {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'sales-stock-invoicing', 'record.create', salesAccessContext(dossier))) {
      toast('Création refusée : le droit de saisie dans Ventes, stock & facturation n’est pas accordé.', 'warning');
      return;
    }
    var period = ($('#sales-demo-period') || {}).value || '';
    var result = SalesOperations.createDemoRun(dossier, period);
    if (!result.ok) {
      toast(result.errors[0] || 'Création du lot d’opérations impossible.', 'error');
      return;
    }
    toast('Lot fictif créé dans le registre interne Ventes, stock & facturation. Contrôlez-le avant approbation.', 'success');
    render();
  }

  function approveInternalSalesRun(runId) {
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'sales-stock-invoicing', 'record.validate', salesAccessContext(dossier))) {
      toast('Approbation refusée : le droit de validation dans Ventes, stock & facturation n’est pas accordé.', 'warning');
      return;
    }
    var result = SalesOperations.approveRun(dossier, runId);
    if (!result.ok) {
      toast(result.errors[0] || 'Approbation du lot impossible.', 'error');
      return;
    }
    toast('Lot d’opérations approuvé dans le module maison ; il est prêt pour la centralisation interne.', 'success');
    render();
  }

  function viewInternalAuxiliaryCentralization() {
    return '<div class="alert info"><div><strong>Centralisation auxiliaire depuis les modules maison uniquement.</strong><br>Ce parcours sera activé lorsque les modules PERFECTO de gestion des tiers et de leurs mouvements fourniront leurs données internes. Le format pivot CSV/Excel PERFECTO-AUXILIAIRE v1 est réservé à l’interopérabilité ; aucun fichier ni logiciel tiers ne peut alimenter cette centralisation.</div></div>';
  }

  function consolidationStageOptions(stage) {
    return stage === 'after'
      ? {
        key: 'after',
        label: 'après résultat',
        heading: 'Journal groupé après résultat',
        statusTag: 'APRÈS RÉSULTAT',
        description: 'Ce journal est destiné au regroupement consultatif après détermination du résultat. La version actuelle lit les écritures validées choisies par période et journal ; elle ne détecte pas automatiquement la pièce ou la date d’arrêté, ne calcule pas le résultat et ne génère ni affectation ni écriture de clôture.',
        format: 'PERFECTO-CONSOLIDATION-APRES-RESULTAT',
        filePart: 'apres-resultat',
        exportAction: 'export-accounting-consolidation-after-result',
        successMessage: 'Journal groupé après résultat exporté avec la provenance de chaque mouvement source.'
      }
      : {
        key: 'before',
        label: 'avant résultat',
        heading: 'Journal groupé avant résultat',
        statusTag: 'AVANT RÉSULTAT',
        description: 'Synthèse de préparation avant détermination du résultat. Les écritures validées sont regroupées par compte ; cette vue ne calcule pas le résultat et ne crée aucune pièce.',
        format: 'PERFECTO-CONSOLIDATION-AVANT-RESULTAT',
        filePart: 'avant-resultat',
        exportAction: 'export-accounting-consolidation-before-result',
        successMessage: 'Journal groupé avant résultat exporté avec la provenance de chaque mouvement source.'
      };
  }

  function ensureAccountingConsolidationSession(stage) {
    var dossier = S.currentDossier();
    if (stage === 'after') {
      if (!consolidationAfterResultSession || consolidationAfterResultSession.dossierId !== dossier.id) {
        consolidationAfterResultSession = {
          dossierId: dossier.id,
          dateStart: dossier.cycleStart,
          dateEnd: dossier.cycleEnd,
          journalCode: ''
        };
      }
      return consolidationAfterResultSession;
    }
    if (!consolidationBeforeResultSession || consolidationBeforeResultSession.dossierId !== dossier.id) {
      consolidationBeforeResultSession = {
        dossierId: dossier.id,
        dateStart: dossier.cycleStart,
        dateEnd: dossier.cycleEnd,
        journalCode: ''
      };
    }
    return consolidationBeforeResultSession;
  }

  function consolidationSourceSummary(source) {
    var details = [];
    var moduleLabels = {
      'payroll-hr': 'Paie & RH (module PERFECTO)',
      'sales-stock-invoicing': 'Ventes, stock & facturation (module PERFECTO)'
    };
    if (source.sourceModule) details.push('module : ' + (moduleLabels[source.sourceModule] || source.sourceModule));
    if (source.sourceRunReference) details.push('lot : ' + source.sourceRunReference);
    if (source.sourceReference) details.push('référence source : ' + source.sourceReference);
    if (source.sourceId) details.push('ID source : ' + source.sourceId);
    if (source.originalReference) details.push('pièce d’origine : ' + source.originalReference);
    return details.length ? details.join(' · ') : 'Origine PERFECTO · pièce comptable source';
  }

  function renderAccountingConsolidationPreview(stage) {
    var stageOptions = consolidationStageOptions(stage);
    var session = ensureAccountingConsolidationSession(stageOptions.key);
    var dossier = S.currentDossier();
    var result = AccountingConsolidation.consolidate(S.entries(), {
      dateStart: session.dateStart,
      dateEnd: session.dateEnd,
      cycleStart: dossier.cycleStart,
      cycleEnd: dossier.cycleEnd,
      journalCode: session.journalCode,
      accounts: S.accounts()
    });
    if (!result.ok) {
      return '<div class="alert error"><div><strong>Consolidation impossible : les données sélectionnées ne peuvent pas être totalisées de façon sûre.</strong><ul>' +
        result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') +
        '</ul></div></div>';
    }
    if (!result.movementCount) {
      return '<div class="empty-state"><span class="empty-state-icon">⌕</span><h3>Aucun mouvement validé pour cette sélection</h3><p>Vérifiez la période ou le journal choisi. Les brouillons sont exclus du journal groupé.</p></div>';
    }

    var balanceAlert = result.balanced
      ? '<div class="alert success"><div><strong>Équilibre contrôlé.</strong> Le total débit est égal au total crédit pour les pièces validées sélectionnées.</div></div>'
      : '<div class="alert warning"><div><strong>Écart de consolidation.</strong> Les totaux sélectionnés ne sont pas équilibrés ; vérifiez le périmètre et les pièces sources avant toute utilisation.</div></div>';
    var summary = '<div class="exchange-summary-grid consolidation-summary-grid">' +
      '<div><small>Pièces validées</small><strong>' + result.entriesCount + '</strong></div>' +
      '<div><small>Lignes sources</small><strong>' + result.movementCount + '</strong></div>' +
      '<div><small>Total débit</small><strong>' + esc(money(result.totalDebit)) + '</strong></div>' +
      '<div><small>Total crédit</small><strong>' + esc(money(result.totalCredit)) + '</strong></div>' +
      '</div>' +
      (result.excludedDraftEntries ? '<p class="exchange-footnote">' + result.excludedDraftEntries + ' brouillon(s) exclu(s) du regroupement.</p>' : '');

    var rows = result.rows.map(function (row) {
      var provenanceRows = row.provenance.map(function (source) {
        var sourceSystem = source.sourceSystem || 'PERFECTO · saisie comptable';
        var pieceReference = source.reference || source.entryId || 'Pièce sans référence';
        return '<tr>' +
          '<td>' + esc(dateLabel(source.date)) + '</td>' +
          '<td><strong>' + esc(source.journal || '—') + '</strong></td>' +
          '<td><strong>' + esc(pieceReference) + '</strong>' + (source.description ? '<br><span class="small muted">' + esc(source.description) + '</span>' : '') + '</td>' +
          '<td>Ligne ' + source.lineNumber + '</td>' +
          '<td>' + esc(sourceSystem) + '<br><span class="small muted">' + esc(consolidationSourceSummary(source)) + '</span></td>' +
          '<td class="text-right">' + esc(amount(source.debit)) + '</td>' +
          '<td class="text-right">' + esc(amount(source.credit)) + '</td>' +
          '</tr>';
      }).join('');
      var provenance = '<details class="consolidation-provenance"><summary>' + row.provenanceCount + ' ligne(s) source · consulter la provenance</summary>' +
        '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Date source</th><th>Journal</th><th>Pièce source</th><th>Ligne</th><th>Origine</th><th>Débit XOF</th><th>Crédit XOF</th></tr></thead><tbody>' + provenanceRows + '</tbody></table></div></details>';
      return '<tr>' +
        '<td><strong>' + esc(row.account) + '</strong></td>' +
        '<td>' + esc(row.accountLabel || 'Compte sans intitulé') + '</td>' +
        '<td class="text-right">' + esc(amount(row.debit)) + '</td>' +
        '<td class="text-right">' + esc(amount(row.credit)) + '</td>' +
        '<td class="text-right">' + esc(amount(row.balance)) + '</td>' +
        '<td>' + provenance + '</td>' +
        '</tr>';
    }).join('');
    var table = '<div class="exchange-card consolidation-journal-card"><h4>Journal groupé par compte général</h4>' +
      '<p>Chaque ligne agrégée conserve le détail de ses mouvements sources : date, journal, pièce, numéro de ligne et origine éventuelle.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table consolidation-journal-table"><thead><tr><th>Compte</th><th>Intitulé</th><th>Débit XOF</th><th>Crédit XOF</th><th>Solde débiteur / créditeur</th><th>Provenance des lignes</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><th colspan="2">Total du journal groupé</th><th class="text-right">' + esc(amount(result.totalDebit)) + '</th><th class="text-right">' + esc(amount(result.totalCredit)) + '</th><th colspan="2">' + (result.balanced ? 'Équilibré' : 'À contrôler') + '</th></tr></tfoot></table></div></div>';
    var actions = '<div class="exchange-preview-footer consolidation-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>' +
      '<button type="button" class="btn btn-primary" data-action="' + esc(stageOptions.exportAction) + '">↓ Exporter le détail CSV avec provenance</button>' +
      '</div>';
    return '<div class="exchange-preview consolidation-result">' + balanceAlert + summary + table + actions +
      '<p class="exchange-footnote">Dossier : ' + esc(dossier.reference) + ' · période : ' + esc(dateLabel(result.dateStart)) + ' au ' + esc(dateLabel(result.dateEnd)) +
      (result.journalCode ? ' · journal : ' + esc(result.journalCode) : ' · tous les journaux') +
      '. Aucun brouillon ni nouvelle écriture n’est ajouté au grand livre.</p></div>';
  }

  function viewAccountingConsolidation(stage) {
    var stageOptions = consolidationStageOptions(stage);
    var session = ensureAccountingConsolidationSession(stageOptions.key);
    var dossier = S.currentDossier();
    var prefix = 'consolidation-' + stageOptions.key + '-result';
    var journalOptions = '<option value="">Tous les journaux</option>' + S.journals().map(function (journal) {
      return '<option value="' + esc(journal.code) + '"' + (journal.code === session.journalCode ? ' selected' : '') + '>' + esc(journal.code + ' · ' + journal.label) + '</option>';
    }).join('');
    return '<div class="exchange-workspace consolidation-workspace">' +
      '<section class="exchange-card consolidation-filter-card" aria-labelledby="' + prefix + '-heading">' +
        '<p class="page-kicker">REGROUPEMENT COMPTABLE · ' + esc(stageOptions.statusTag) + ' · LECTURE SEULE</p>' +
        '<h4 id="' + prefix + '-heading">' + esc(stageOptions.heading) + '</h4>' +
        '<p>' + esc(stageOptions.description) + ' Chaque ligne source reste traçable dans le détail et dans l’export.</p>' +
        '<div class="alert info"><div><strong>Traitement non comptabilisant.</strong> Les filtres portent sur les écritures validées de la période choisie. Le sous-menu ne crée, ne modifie et ne valide aucune écriture dans le grand livre.</div></div>' +
        '<form class="consolidation-filter-form" id="' + prefix + '-form">' +
          '<label class="field"><span>Date de début</span><input id="' + prefix + '-date-start" type="date" value="' + esc(session.dateStart) + '" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" required /></label>' +
          '<label class="field"><span>Date de fin</span><input id="' + prefix + '-date-end" type="date" value="' + esc(session.dateEnd) + '" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" required /></label>' +
          '<label class="field"><span>Journal source</span><select id="' + prefix + '-journal">' + journalOptions + '</select></label>' +
          '<button type="submit" class="btn btn-primary">Afficher le journal groupé</button>' +
        '</form>' +
      '</section>' +
      '<div id="' + prefix + '-output" aria-live="polite">' + renderAccountingConsolidationPreview(stageOptions.key) + '</div>' +
    '</div>';
  }

  function bindAccountingConsolidation(stage) {
    var stageOptions = consolidationStageOptions(stage);
    var prefix = 'consolidation-' + stageOptions.key + '-result';
    var form = document.getElementById(prefix + '-form');
    if (!form) return;
    function updatePreview() {
      var session = ensureAccountingConsolidationSession(stageOptions.key);
      session.dateStart = (document.getElementById(prefix + '-date-start') || {}).value || '';
      session.dateEnd = (document.getElementById(prefix + '-date-end') || {}).value || '';
      session.journalCode = (document.getElementById(prefix + '-journal') || {}).value || '';
      var output = document.getElementById(prefix + '-output');
      if (output) output.innerHTML = renderAccountingConsolidationPreview(stageOptions.key);
      applyDemoActionGates(output);
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      updatePreview();
    });
    [prefix + '-date-start', prefix + '-date-end', prefix + '-journal'].forEach(function (id) {
      var input = document.getElementById(id);
      if (input) input.addEventListener('change', updatePreview);
    });
  }

  function exportAccountingConsolidation(stage) {
    var stageOptions = consolidationStageOptions(stage);
    var session = ensureAccountingConsolidationSession(stageOptions.key);
    var dossier = S.currentDossier();
    var result = AccountingConsolidation.consolidate(S.entries(), {
      dateStart: session.dateStart,
      dateEnd: session.dateEnd,
      cycleStart: dossier.cycleStart,
      cycleEnd: dossier.cycleEnd,
      journalCode: session.journalCode,
      accounts: S.accounts()
    });
    if (!result.ok || !result.movementCount) {
      toast(result.errors[0] || 'Aucune ligne consolidée à exporter.', 'warning');
      return;
    }
    var rows = [
      [stageOptions.format, '1'],
      ['DOSSIER', dossier.reference],
      ['EXERCICE', S.exercise()],
      ['DATE_DEBUT', result.dateStart],
      ['DATE_FIN', result.dateEnd],
      ['JOURNAL_SOURCE', result.journalCode || 'TOUS'],
      [],
      ['CODE_COMPTE', 'INTITULE_COMPTE', 'DATE_SOURCE', 'JOURNAL_SOURCE', 'REFERENCE_PIECE_SOURCE', 'ID_PIECE_PERFECTO', 'NUMERO_LIGNE_SOURCE', 'LIBELLE_PIECE_SOURCE', 'DEBIT_XOF', 'CREDIT_XOF', 'SYSTEME_SOURCE', 'REFERENCE_SOURCE', 'ID_SOURCE', 'MODULE_SOURCE', 'LOT_SOURCE', 'REFERENCE_PIECE_ORIGINE']
    ];
    result.rows.forEach(function (row) {
      row.provenance.forEach(function (source) {
        rows.push([
          row.account,
          row.accountLabel,
          source.date,
          source.journal,
          source.reference,
          source.entryId,
          source.lineNumber,
          source.description,
          source.debit,
          source.credit,
          source.sourceSystem || 'PERFECTO · saisie comptable',
          source.sourceReference,
          source.sourceId,
          source.sourceModule,
          source.sourceRunReference,
          source.originalReference
        ]);
      });
    });
    rows.push([], ['TOTAL_JOURNAL_GROUPE', '', '', '', '', '', '', '', result.totalDebit, result.totalCredit]);
    var fileName = 'perfecto-' + safeFilePart(dossier.reference) + '-consolidation-' + stageOptions.filePart + '-' + result.dateStart + '-' + result.dateEnd + '.csv';
    downloadFile(fileName, toCsv(rows), 'text/csv;charset=utf-8');
    toast(stageOptions.successMessage, 'success');
  }

  function viewAccountingConsolidationBeforeResult() { return viewAccountingConsolidation('before'); }
  function viewAccountingConsolidationAfterResult() { return viewAccountingConsolidation('after'); }
  function bindAccountingConsolidationBeforeResult() { bindAccountingConsolidation('before'); }
  function bindAccountingConsolidationAfterResult() { bindAccountingConsolidation('after'); }
  function exportAccountingConsolidationBeforeResult() { exportAccountingConsolidation('before'); }
  function exportAccountingConsolidationAfterResult() { exportAccountingConsolidation('after'); }

  function viewAccountingBalanceRecalculation() {
    var dossier = S.currentDossier();
    return '<div class="exchange-workspace balance-recalculation-workspace">' +
      '<section class="exchange-card balance-recalculation-card" aria-labelledby="balance-recalculation-heading">' +
        '<p class="page-kicker">CONTRÔLE DES SOLDES · DOSSIER ACTIF</p>' +
        '<h4 id="balance-recalculation-heading">Recalcul du solde des comptes</h4>' +
        '<p>Reconstituer les débits, crédits et soldes nets à partir des écritures validées du cycle comptable, puis comparer le résultat au calcul actuel de la balance générale.</p>' +
        '<div class="alert info"><div><strong>Opération sans écriture.</strong> PERFECTO ne conserve pas de cache de soldes séparé : le recalcul relit les mouvements validés et n’enregistre aucune modification. Les brouillons sont exclus ; les pièces hors cycle sont signalées.</div></div>' +
        '<div class="exchange-preview-footer"><button type="button" class="btn btn-primary" data-action="recalculate-account-balances">↻ Recalculer les soldes</button></div>' +
      '</section>' +
      '<div id="balance-recalculation-output" aria-live="polite">' + renderBalanceRecalculationPreview() + '</div>' +
      '<p class="exchange-footnote">Dossier : ' + esc(dossier.reference) + ' · cycle : ' + esc(dateLabel(dossier.cycleStart)) + ' au ' + esc(dateLabel(dossier.cycleEnd)) + '. Une correction comptable doit passer par le parcours normal de saisie ou de validation.</p>' +
    '</div>';
  }

  function renderBalanceRecalculationPreview() {
    var dossier = S.currentDossier();
    var session = balanceRecalculationSession;
    if (!session || session.dossierId !== dossier.id) {
      return '<div class="empty-state"><span class="empty-state-icon">↻</span><h3>Recalcul non lancé</h3><p>Le recalcul analysera toutes les pièces validées du cycle actif et exclura les brouillons.</p></div>';
    }
    var result = session.result;
    if (!result.ok) {
      return '<div class="alert error"><div><strong>Recalcul interrompu : des mouvements validés sont invalides.</strong><ul>' +
        result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') +
        '</ul><p>Aucun solde n’a été modifié. Corrigez les pièces par les parcours comptables prévus, puis relancez le contrôle.</p></div></div>';
    }
    if (!result.movementCount) {
      return '<div class="empty-state"><span class="empty-state-icon">⌕</span><h3>Aucun mouvement validé dans le cycle</h3><p>Les soldes sont nuls ; aucun tableau de comptes mouvementés n’est à afficher.</p></div>';
    }

    var comparison = session.comparison || { ok: false, differences: [] };
    var checkMessage = comparison.ok
      ? '<div class="alert success"><div><strong>Concordance vérifiée.</strong> Les soldes recalculés correspondent à la balance générale calculée actuellement par PERFECTO.</div></div>'
      : '<div class="alert warning"><div><strong>Écart détecté par compte.</strong> Le recalcul indépendant ne correspond pas à la balance générale courante pour ' + comparison.differences.length + ' compte(s).</div></div>';
    var totalsMessage = result.balanced
      ? '<div class="alert success"><div><strong>Balance équilibrée.</strong> Total débit = total crédit = ' + esc(money(result.totalDebit)) + '.</div></div>'
      : '<div class="alert warning"><div><strong>Totaux déséquilibrés.</strong> Débit : ' + esc(money(result.totalDebit)) + ' · Crédit : ' + esc(money(result.totalCredit)) + '.</div></div>';
    var summary = '<div class="exchange-summary-grid balance-recalculation-summary-grid">' +
      '<div><small>Pièces validées</small><strong>' + result.entriesCount + '</strong></div>' +
      '<div><small>Lignes recalculées</small><strong>' + result.movementCount + '</strong></div>' +
      '<div><small>Comptes mouvementés</small><strong>' + result.rows.length + '</strong></div>' +
      '<div><small>Total débit</small><strong>' + esc(money(result.totalDebit)) + '</strong></div>' +
      '<div><small>Total crédit</small><strong>' + esc(money(result.totalCredit)) + '</strong></div>' +
      '</div>' +
      (result.excludedDraftCount ? '<p class="exchange-footnote">' + result.excludedDraftCount + ' brouillon(s) exclu(s) du calcul.</p>' : '');
    var warnings = result.warnings.length
      ? '<div class="alert warning"><div><strong>Points à contrôler.</strong><ul>' + result.warnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var rows = result.rows.map(function (row) {
      return '<tr>' +
        '<td><strong>' + esc(row.code) + '</strong></td>' +
        '<td>' + esc(row.label) + '</td>' +
        '<td class="text-right">' + esc(amount(row.debit)) + '</td>' +
        '<td class="text-right">' + esc(amount(row.credit)) + '</td>' +
        '<td class="text-right">' + esc(amount(row.debitBalance)) + '</td>' +
        '<td class="text-right">' + esc(amount(row.creditBalance)) + '</td>' +
        '<td class="text-right">' + row.movementCount + '</td>' +
        '</tr>';
    }).join('');
    var table = '<section class="exchange-card balance-recalculation-table-card"><h4>Soldes recalculés par compte</h4>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table balance-recalculation-table"><thead><tr><th>Compte</th><th>Intitulé</th><th>Débit XOF</th><th>Crédit XOF</th><th>Solde débiteur XOF</th><th>Solde créditeur XOF</th><th>Mouvements</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><th colspan="2">Totaux du cycle</th><th class="text-right">' + esc(amount(result.totalDebit)) + '</th><th class="text-right">' + esc(amount(result.totalCredit)) + '</th><th colspan="3">' + (result.balanced ? 'Équilibrés' : 'À contrôler') + '</th></tr></tfoot></table></div></section>';
    var differences = comparison.differences.length
      ? '<section class="exchange-card balance-recalculation-differences"><h4>Comptes en écart avec le calcul courant</h4><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte</th><th>Débit recalculé</th><th>Débit courant</th><th>Crédit recalculé</th><th>Crédit courant</th></tr></thead><tbody>' +
        comparison.differences.map(function (difference) {
          return '<tr><td><strong>' + esc(difference.code) + '</strong>' + (difference.label ? '<br><span class="small muted">' + esc(difference.label) + '</span>' : '') + '</td>' +
            '<td class="text-right">' + esc(amount(difference.recalculatedDebit)) + '</td><td class="text-right">' + esc(amount(difference.currentDebit)) + '</td>' +
            '<td class="text-right">' + esc(amount(difference.recalculatedCredit)) + '</td><td class="text-right">' + esc(amount(difference.currentCredit)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>'
      : '';
    var actions = '<div class="exchange-preview-footer balance-recalculation-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>' +
      '<button type="button" class="btn btn-primary" data-action="export-recalculated-account-balances">↓ Exporter le recalcul CSV</button></div>';
    return '<div class="exchange-preview balance-recalculation-result">' + checkMessage + totalsMessage + warnings + summary + table + differences + actions + '</div>';
  }

  function recalculateAccountBalances() {
    var dossier = S.currentDossier();
    var result = BalanceRecalculation.recalculate(S.entries(), S.accounts(), {
      cycleStart: dossier.cycleStart,
      cycleEnd: dossier.cycleEnd
    });
    var currentRows = result.ok ? S.balance() : [];
    var comparison = result.ok
      ? BalanceRecalculation.compareBalances(result.rows, currentRows)
      : { ok: false, differences: [] };
    balanceRecalculationSession = { dossierId: dossier.id, result: result, comparison: comparison, currentRows: currentRows };
    if (!result.ok) toast('Recalcul interrompu : vérifiez les pièces validées signalées.', 'warning');
    else if (!comparison.ok) toast('Des écarts de calcul ont été détectés. Consultez le détail avant toute correction.', 'warning');
    else toast('Recalcul terminé. Les données comptables n’ont pas été modifiées.', 'success');
    render();
  }

  function exportRecalculatedAccountBalances() {
    var dossier = S.currentDossier();
    var session = balanceRecalculationSession;
    if (!session || session.dossierId !== dossier.id || !session.result || !session.result.ok || !session.result.movementCount) {
      toast('Lancez un recalcul réussi comportant des mouvements avant l’export.', 'warning');
      return;
    }
    var result = session.result;
    var calculatedByCode = Object.create(null);
    var currentByCode = Object.create(null);
    result.rows.forEach(function (row) { calculatedByCode[row.code] = row; });
    (session.currentRows || []).forEach(function (row) { currentByCode[row.code] = row; });
    var codes = Object.keys(calculatedByCode);
    Object.keys(currentByCode).forEach(function (code) { if (codes.indexOf(code) === -1) codes.push(code); });
    codes.sort(function (a, b) { return a.localeCompare(b); });
    var rows = [
      ['PERFECTO-RECALCUL-SOLDES-COMPTES', '1'],
      ['DOSSIER', dossier.reference],
      ['EXERCICE', S.exercise()],
      ['CYCLE_DEBUT', result.cycleStart],
      ['CYCLE_FIN', result.cycleEnd],
      ['ETAT_COMPARAISON', session.comparison && session.comparison.ok ? 'CONCORDANT' : 'ECART'],
      ['BROUILLONS_EXCLUS', result.excludedDraftCount],
      ['PIECES_VALIDEES_HORS_CYCLE', result.outsideCyclePostedCount],
      [],
      ['CODE_COMPTE', 'INTITULE_COMPTE', 'DEBIT_RECALCULE_XOF', 'CREDIT_RECALCULE_XOF', 'SOLDE_DEBITEUR_RECALCULE_XOF', 'SOLDE_CREDITEUR_RECALCULE_XOF', 'DEBIT_BALANCE_COURANTE_XOF', 'CREDIT_BALANCE_COURANTE_XOF', 'ECART_DEBIT_XOF', 'ECART_CREDIT_XOF', 'NOMBRE_MOUVEMENTS', 'ETAT_COMPTE']
    ];
    codes.forEach(function (code) {
      var calculated = calculatedByCode[code] || { code: code, label: '', debit: 0, credit: 0, debitBalance: 0, creditBalance: 0, movementCount: 0 };
      var current = currentByCode[code] || { label: '', debit: 0, credit: 0 };
      var same = Number(calculated.debit) === Number(current.debit) && Number(calculated.credit) === Number(current.credit);
      rows.push([
        code,
        calculated.label || current.label,
        calculated.debit,
        calculated.credit,
        calculated.debitBalance,
        calculated.creditBalance,
        current.debit,
        current.credit,
        Number(calculated.debit) - Number(current.debit),
        Number(calculated.credit) - Number(current.credit),
        calculated.movementCount,
        same ? 'CONCORDANT' : 'ECART'
      ]);
    });
    rows.push([], ['ALERTES'], ['TYPE', 'DETAIL']);
    result.warnings.forEach(function (warning) { rows.push(['AVERTISSEMENT', warning]); });
    rows.push([], ['TOTAL_RECALCULE', '', result.totalDebit, result.totalCredit]);
    downloadFile('perfecto-' + safeFilePart(dossier.reference) + '-recalcul-soldes-' + result.cycleStart + '-' + result.cycleEnd + '.csv', toCsv(rows), 'text/csv;charset=utf-8');
    toast('Recalcul des soldes exporté. Aucune écriture n’a été ajoutée au grand livre.', 'success');
  }

  function viewAccountingDatabaseRepair() {
    var dossier = S.currentDossier();
    var storage = S.databaseStorageStatus();
    var backup = S.backupInfo();
    var intro = '<section class="exchange-card database-repair-card" aria-labelledby="database-repair-heading">' +
      '<p class="page-kicker">INTÉGRITÉ DES DONNÉES · DOSSIER ACTIF</p>' +
      '<h4 id="database-repair-heading">Réparation complète de la base</h4>' +
      '<p>Analyse le plan comptable, les journaux, les pièces validées et les brouillons, le cycle et le registre des périodes du dossier actif.</p>' +
      '<div class="alert info"><div><strong>Protection comptable.</strong> Les écritures, les montants, les comptes et les journaux ne sont jamais modifiés automatiquement. Les réparations proposées portent uniquement sur des métadonnées techniques et sont précédées d’un point de restauration local.</div></div>' +
      '<div class="database-repair-context"><strong>' + esc(dossier.reference) + '</strong><span>' + esc(dossier.name) + '</span><span>Cycle ' + esc(dateLabel(dossier.cycleStart)) + ' au ' + esc(dateLabel(dossier.cycleEnd)) + '</span></div>' +
      '</section>';

    if (storage.recoveryRequired && storage.kind === 'corrupt') {
      var recoveryActions = '<div class="exchange-preview-footer database-repair-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="export-corrupt-database">↓ Télécharger la base brute conservée</button>' +
        (backup.available ? '<button type="button" class="btn btn-primary" data-action="restore-database-backup">↺ Restaurer le point local valide</button>' : '') +
        '<button type="button" class="btn btn-danger" data-action="reinitialize-corrupt-database">Réinitialiser le dossier</button></div>';
      var recoveryCopyNote = storage.recoveryCopyAvailable
        ? '<p class="exchange-footnote">Une copie brute de récupération existe aussi dans le stockage local (' + esc(storage.recoveryCopyCreatedAt || '') + ').</p>'
        : '<p class="exchange-footnote">La base brute n’a pas été remplacée. Avant une réinitialisation, téléchargez le fichier ou vérifiez qu’un point de restauration valide existe.</p>';
      return '<div class="exchange-workspace database-repair-workspace">' + intro +
        '<section class="exchange-card database-repair-recovery"><div class="alert error"><div><strong>La base comptable n’est pas lisible.</strong> ' + esc(storage.message) + '<br>Contenu conservé : ' + storage.rawLength + ' caractères. Les saisies sont bloquées pour éviter tout écrasement silencieux.</div></div>' +
        (backup.available ? '<p class="database-repair-backup"><strong>Point de restauration disponible</strong> · ' + backup.entryCount + ' pièce(s) · ' + esc(backup.createdAt || '') + '</p>' : '<p class="database-repair-backup">Aucun point de restauration local valide n’a été trouvé.</p>') +
        recoveryActions + recoveryCopyNote +
        '<p class="small muted">La réinitialisation crée une nouvelle base de démonstration uniquement après avoir conservé une copie brute dans l’espace de récupération local. Elle ne répare pas les données illisibles.</p></section>' +
        '</div>';
    }

    var report = S.databaseRepairAnalysis();
    var summary = report.summary || {};
    var issueList = (report.issues || []).map(function (issue) {
      var severity = issue.severity === 'error' ? 'error' : (issue.severity === 'warning' ? 'warning' : 'info');
      var examples = Array.isArray(issue.examples) && issue.examples.length
        ? '<ul>' + issue.examples.map(function (example) { return '<li>' + esc(example) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<li class="database-repair-issue database-repair-issue-' + severity + '"><div><strong>' + esc(issue.message) + '</strong>' +
        (issue.count > 1 ? '<span class="database-repair-issue-count">' + issue.count + ' occurrence(s)</span>' : '') + examples + '</div></li>';
    }).join('');
    var issueSection = issueList
      ? '<section class="exchange-card database-repair-findings"><h4>Résultats du diagnostic</h4><ul class="database-repair-issue-list">' + issueList + '</ul></section>'
      : '<div class="alert success database-repair-clean"><div><strong>Aucune incohérence détectée.</strong> La structure et les équilibres des pièces validées sont cohérents avec les référentiels du dossier.</div></div>';
    var repairAvailable = !!(report.canApplySafeRepair && (report.safeRepairNeeded || storage.recoveryRequired));
    var actions = '<div class="exchange-preview-footer database-repair-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="analyze-accounting-database">⌕ Relancer l’analyse</button>' +
      '<button type="button" class="btn btn-ghost" data-action="export-json">↓ Télécharger une sauvegarde JSON</button>' +
      (storage.recoveryRequired || storage.recoveryCopyAvailable ? '<button type="button" class="btn btn-ghost" data-action="export-corrupt-database">↓ Télécharger ' + (storage.recoveryRequired ? 'le JSON brut d’origine' : 'la copie brute archivée') + '</button>' : '') +
      (repairAvailable ? '<button type="button" class="btn btn-primary" data-action="repair-accounting-database">✓ Créer un point local et réparer les périodes</button>' : '') +
      (backup.available ? '<button type="button" class="btn btn-ghost" data-action="restore-database-backup">↺ Restaurer le point local précédent</button>' : '') +
      (storage.recoveryRequired && !repairAvailable ? '<button type="button" class="btn btn-danger" data-action="reinitialize-corrupt-database">Réinitialiser après copie brute</button>' : '') +
      '</div>';
    var recoveryNote = storage.recoveryRequired
      ? '<div class="alert warning"><div><strong>Métadonnées à enregistrer.</strong> Le contenu brut reste conservé. Téléchargez-le ou utilisez un point de restauration avant toute récupération.</div></div>'
      : '';
    var recoveryCopyNote = storage.recoveryCopyAvailable
      ? '<div class="alert info"><div><strong>Copie brute archivée disponible.</strong> Une version antérieure du stockage est conservée dans l’espace local de récupération (' + esc(storage.recoveryCopyCreatedAt || '') + ').</div></div>'
      : '';
    var manualNote = (report.criticalCount || report.warningCount) && !repairAvailable
      ? '<div class="alert warning"><div><strong>Intervention automatique limitée.</strong> Les anomalies comptables signalées doivent être corrigées par les parcours normaux ou par restauration d’une sauvegarde vérifiée. Aucun montant validé ne sera réécrit ici.</div></div>'
      : '';
    var backupNote = backup.available
      ? '<p class="database-repair-backup"><strong>Point local antérieur disponible</strong> · ' + backup.entryCount + ' pièce(s) · ' + esc(backup.createdAt || '') + '</p>'
      : '<p class="database-repair-backup">Aucun point local antérieur n’est disponible. L’export JSON permet de conserver une copie indépendante.</p>';
    var summaryMarkup = '<div class="exchange-summary-grid database-repair-summary-grid">' +
      '<div><small>Comptes</small><strong>' + Number(summary.accounts || 0) + '</strong></div>' +
      '<div><small>Journaux</small><strong>' + Number(summary.journals || 0) + '</strong></div>' +
      '<div><small>Pièces validées</small><strong>' + Number(summary.postedEntries || 0) + '</strong></div>' +
      '<div><small>Brouillons</small><strong>' + Number(summary.draftEntries || 0) + '</strong></div>' +
      '<div><small>Validées équilibrées</small><strong>' + Number(summary.validPostedEntries || 0) + '</strong></div>' +
      '<div><small>Périodes enregistrées</small><strong>' + Number(summary.periods || 0) + '</strong></div>' +
      '</div>';
    return '<div class="exchange-workspace database-repair-workspace">' + intro +
      '<section class="exchange-card database-repair-report"><h4>État de la base</h4>' +
      '<div class="alert ' + (report.ok ? 'success' : 'warning') + '"><div><strong>' + (report.ok ? 'Contrôle terminé.' : 'Anomalies à examiner.') + '</strong> ' +
        Number(report.criticalCount || 0) + ' anomalie(s) bloquante(s), ' + Number(report.warningCount || 0) + ' avertissement(s).</div></div>' +
      summaryMarkup + recoveryNote + recoveryCopyNote + issueSection + manualNote + backupNote + actions + '</section>' +
      '</div>';
  }

  function supplierAccountLabel(record) {
    var account = S.account(record.accountCode);
    return account ? account.code + ' · ' + account.label : String(record.accountCode || 'Compte non disponible');
  }

  function filteredSuppliers(records, query, status) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (record) {
      var active = record.active !== false;
      if (status === 'active' && !active) return false;
      if (status === 'archived' && active) return false;
      if (!needle) return true;
      var searchable = [
        record.code, record.auxiliaryAccountCode, record.name, record.contactName, record.ifu, record.rccm,
        record.email, record.phone, record.address, record.notes, supplierAccountLabel(record)
      ].join(' ').toLocaleLowerCase();
      return searchable.indexOf(needle) !== -1;
    });
  }

  function supplierRowsHtml(records) {
    var filter = ui.suppliers || { q: '', status: 'active' };
    return filteredSuppliers(records, filter.q, filter.status).map(function (record) {
      var active = record.active !== false;
      var coordinates = [
        record.ifu ? 'IFU : ' + record.ifu : '',
        record.rccm ? 'RCCM : ' + record.rccm : '',
        record.email || '', record.phone || ''
      ].filter(Boolean).map(esc).join('<br>') || '<span class="muted">Non renseignées</span>';
      var contact = [record.contactName, record.address].filter(Boolean).map(esc).join('<br>');
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><strong>' + esc(record.name) + '</strong>' + (contact ? '<br><small>' + contact + '</small>' : '') + '</td>' +
        '<td>' + coordinates + '</td>' +
        '<td><strong>' + esc(record.auxiliaryAccountCode || (record.accountCode + '-' + record.code)) + '</strong><br><small>Compte général : ' + esc(supplierAccountLabel(record)) + '</small><br><small>' + Number(record.paymentTermDays || 0) + ' jour(s)</small></td>' +
        '<td><span class="badge ' + (active ? 'actif' : 'passif') + '">' + (active ? 'Actif' : 'Archivé') + '</span></td>' +
        '<td><div class="supplier-row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-supplier" data-id="' + esc(record.id) + '" aria-label="Modifier la fiche de ' + esc(record.name) + '">Modifier</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="archive-supplier" data-id="' + esc(record.id) + '" aria-label="' + (active ? 'Archiver ' : 'Réactiver ') + esc(record.name) + '">' + (active ? 'Archiver' : 'Réactiver') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-supplier" data-id="' + esc(record.id) + '" aria-label="Supprimer définitivement ' + esc(record.name) + '" title="Suppression définitive ; archivez pour conserver la fiche.">Supprimer</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function viewSuppliers() {
    var records = S.suppliers().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var activeCount = records.filter(function (record) { return record.active !== false; }).length;
    var archivedCount = records.length - activeCount;
    var filter = ui.suppliers || (ui.suppliers = { q: '', status: 'active' });
    var options = [
      { value: 'active', label: 'Fournisseurs actifs' },
      { value: 'archived', label: 'Fournisseurs archivés' },
      { value: 'all', label: 'Tous les fournisseurs' }
    ].map(function (option) {
      return '<option value="' + option.value + '"' + (filter.status === option.value ? ' selected' : '') + '>' + option.label + '</option>';
    }).join('');
    var visibleCount = filteredSuppliers(records, filter.q, filter.status).length;
    var emptyMessage = records.length
      ? 'Aucun fournisseur ne correspond à cette recherche et à ce filtre.'
      : 'Aucun fournisseur n’est encore enregistré dans ce dossier. Utilisez « Nouveau fournisseur » pour créer la première fiche.';
    return '<div class="exchange-workspace supplier-workspace" id="supplier-workspace">' +
      '<div class="alert info"><div><strong>Référentiel local du dossier client.</strong> Les fournisseurs, coordonnées et comptes de rattachement restent isolés dans ce dossier et sur cet appareil. Modifier ou archiver une fiche ne réécrit aucune écriture historique. Ce référentiel ne crée pas de facture, règlement, mouvement auxiliaire, lettrage ou centralisation : les échanges de fichiers restent des échanges, et les centralisations sont réservées aux lots des modules PERFECTO internes.</div></div>' +
      '<div class="exchange-summary-grid supplier-summary-grid" aria-label="Résumé du référentiel fournisseurs">' +
        '<div><small>Fournisseurs actifs</small><strong>' + activeCount + '</strong></div>' +
        '<div><small>Fournisseurs archivés</small><strong>' + archivedCount + '</strong></div>' +
        '<div><small>Résultats affichés</small><strong id="supplier-visible-count">' + visibleCount + '</strong></div>' +
      '</div>' +
      '<section class="exchange-card supplier-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Répertoire des fournisseurs</h4><p>Identité, contacts, IFU/RCCM, compte auxiliaire et délai indicatif de règlement.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="new-supplier">＋ Nouveau fournisseur</button></div>' +
        '<form id="supplier-filter-form" class="supplier-filter-controls" role="search">' +
          '<label class="field"><span>Rechercher</span><input id="supplier-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, raison sociale, IFU, contact…" autocomplete="off"></label>' +
          '<label class="field"><span>État</span><select id="supplier-status">' + options + '</select></label>' +
        '</form>' +
        '<p class="supplier-result-note" id="supplier-result-note">' + visibleCount + (visibleCount === 1 ? ' fournisseur affiché.' : ' fournisseurs affichés.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap supplier-table-wrap" id="supplier-table-wrap"' + (visibleCount ? '' : ' hidden') + '>' +
          '<table class="exchange-mapping-table supplier-table"><caption class="sr-only">Fournisseurs du dossier client actif</caption><thead><tr>' +
            '<th>Code</th><th>Raison sociale / contact</th><th>Coordonnées administratives</th><th>Compte / délai</th><th>État</th><th>Actions</th>' +
          '</tr></thead><tbody id="supplier-rows">' + supplierRowsHtml(records) + '</tbody></table>' +
        '</div>' +
        '<div id="supplier-list-empty" class="empty-state supplier-empty"' + (visibleCount ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">La sauvegarde et l’export JSON de la base comptable incluent ce référentiel local. Aucun service PERFECTO distant ne reçoit ces données.</p>' +
    '</div>';
  }

  function refreshSupplierRows() {
    var records = S.suppliers().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.suppliers || { q: '', status: 'active' };
    var visible = filteredSuppliers(records, filter.q, filter.status);
    var rows = $('#supplier-rows');
    var tableWrap = $('#supplier-table-wrap');
    var empty = $('#supplier-list-empty');
    var count = $('#supplier-visible-count');
    var note = $('#supplier-result-note');
    if (rows) rows.innerHTML = supplierRowsHtml(records);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      var message = records.length
        ? 'Aucun fournisseur ne correspond à cette recherche et à ce filtre.'
        : 'Aucun fournisseur n’est encore enregistré dans ce dossier. Utilisez « Nouveau fournisseur » pour créer la première fiche.';
      empty.querySelector('p').textContent = message;
    }
    if (count) count.textContent = String(visible.length);
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' fournisseur affiché.' : ' fournisseurs affichés.');
    applyDemoActionGates(rows);
  }

  function bindSupplierView() {
    var form = $('#supplier-filter-form');
    if (!form) return;
    var search = $('#supplier-search', form);
    var status = $('#supplier-status', form);
    function update() {
      ui.suppliers = ui.suppliers || { q: '', status: 'active' };
      ui.suppliers.q = search ? search.value : '';
      ui.suppliers.status = status ? status.value : 'active';
      refreshSupplierRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
    if (status) status.addEventListener('change', update);
  }

  function clientAccountLabel(record) {
    var account = S.account(record.accountCode);
    return account ? account.code + ' · ' + account.label : String(record.accountCode || 'Compte non disponible');
  }

  function filteredClients(records, query) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (record) {
      if (!needle) return true;
      var searchable = [
        record.code, record.auxiliaryAccountCode, record.name, record.contactName, record.ifu, record.rccm,
        record.email, record.phone, record.address, record.notes, clientAccountLabel(record)
      ].join(' ').toLocaleLowerCase();
      return searchable.indexOf(needle) !== -1;
    });
  }

  function clientRowsHtml(records) {
    var filter = ui.clients || { q: '' };
    return filteredClients(records, filter.q).map(function (record) {
      var coordinates = [
        record.ifu ? 'IFU : ' + record.ifu : '',
        record.rccm ? 'RCCM : ' + record.rccm : '',
        record.email || '', record.phone || ''
      ].filter(Boolean).map(esc).join('<br>') || '<span class="muted">Non renseignées</span>';
      var contact = [record.contactName, record.address].filter(Boolean).map(esc).join('<br>');
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><strong>' + esc(record.name) + '</strong>' + (contact ? '<br><small>' + contact + '</small>' : '') + '</td>' +
        '<td>' + coordinates + '</td>' +
        '<td><strong>' + esc(record.auxiliaryAccountCode || (record.accountCode + '-' + record.code)) + '</strong><br><small>Compte collectif : ' + esc(clientAccountLabel(record)) + '</small><br><small>' + Number(record.paymentTermDays || 0) + ' jour(s)</small></td>' +
        '<td><div class="supplier-row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-client" data-id="' + esc(record.id) + '" aria-label="Modifier la fiche de ' + esc(record.name) + '">Modifier</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-client" data-id="' + esc(record.id) + '" aria-label="Supprimer définitivement ' + esc(record.name) + '" title="Suppression refusée si une pièce comptable ou un mouvement référence ce client.">Supprimer</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function viewClients() {
    var records = S.clients().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.clients || (ui.clients = { q: '' });
    var visibleCount = filteredClients(records, filter.q).length;
    var emptyMessage = records.length
      ? 'Aucun client ne correspond à cette recherche.'
      : 'Aucun client n’est encore enregistré pour l’entreprise de ce dossier. Utilisez « Nouveau client » pour créer la première fiche.';
    return '<div class="exchange-workspace client-workspace" id="client-workspace">' +
      '<div class="alert info"><div><strong>Répertoire des clients de l’entreprise suivie.</strong> Il est distinct de la liste des dossiers clients du cabinet. Les fiches et leurs codes sont isolés dans le dossier comptable actif. Elles ne créent ni facture, ni règlement, ni écriture ou centralisation ; les centralisations restent alimentées par les modules PERFECTO internes.</div></div>' +
      '<div class="exchange-summary-grid client-summary-grid" aria-label="Résumé du répertoire clients">' +
        '<div><small>Clients enregistrés</small><strong>' + records.length + '</strong></div>' +
        '<div><small>Résultats affichés</small><strong id="client-visible-count">' + visibleCount + '</strong></div>' +
      '</div>' +
      '<section class="exchange-card client-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Répertoire des clients</h4><p>Code automatique modifiable, identité, contacts, compte collectif et délai indicatif.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="new-client">＋ Nouveau client</button></div>' +
        '<form id="client-filter-form" class="supplier-filter-controls client-filter-controls" role="search">' +
          '<label class="field"><span>Rechercher</span><input id="client-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, nom, IFU, contact…" autocomplete="off"></label>' +
        '</form>' +
        '<p class="supplier-result-note" id="client-result-note">' + visibleCount + (visibleCount === 1 ? ' client affiché.' : ' clients affichés.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap client-table-wrap" id="client-table-wrap"' + (visibleCount ? '' : ' hidden') + '>' +
          '<table class="exchange-mapping-table client-table"><caption class="sr-only">Clients de l’entreprise du dossier actif</caption><thead><tr>' +
            '<th>Code</th><th>Nom / contact</th><th>Coordonnées administratives</th><th>Compte / délai</th><th>Actions</th>' +
          '</tr></thead><tbody id="client-rows">' + clientRowsHtml(records) + '</tbody></table>' +
        '</div>' +
        '<div id="client-list-empty" class="empty-state client-empty"' + (visibleCount ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">Les codes attribués ne sont pas réutilisés après suppression. Les fiches sont incluses dans l’export et le point de restauration local du dossier.</p>' +
    '</div>';
  }

  function refreshClientRows() {
    var records = S.clients().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.clients || { q: '' };
    var visible = filteredClients(records, filter.q);
    var rows = $('#client-rows');
    var tableWrap = $('#client-table-wrap');
    var empty = $('#client-list-empty');
    var count = $('#client-visible-count');
    var note = $('#client-result-note');
    if (rows) rows.innerHTML = clientRowsHtml(records);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      empty.querySelector('p').textContent = records.length
        ? 'Aucun client ne correspond à cette recherche.'
        : 'Aucun client n’est encore enregistré pour l’entreprise de ce dossier. Utilisez « Nouveau client » pour créer la première fiche.';
    }
    if (count) count.textContent = String(visible.length);
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' client affiché.' : ' clients affichés.');
    applyDemoActionGates(rows);
  }

  function bindClientView() {
    var form = $('#client-filter-form');
    if (!form) return;
    var search = $('#client-search', form);
    function update() {
      ui.clients = ui.clients || { q: '' };
      ui.clients.q = search ? search.value : '';
      refreshClientRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
  }

  function openClientModal(id) {
    var existing = id ? S.client(id) : null;
    if (id && !existing) { toast('Client introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var clientRoots = ['411', '412', '413', '416', '419'];
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return clientRoots.some(function (rootCode) { return code.indexOf(rootCode) === 0; }) &&
        Number(account.cls || code.charAt(0)) === 4 && account.aux === true &&
        account.active !== false && account.postable !== false;
    });
    var existingAccount = existing && S.account(existing.accountCode);
    if (existingAccount && !accounts.some(function (account) { return account.code === existingAccount.code; })) accounts.push(existingAccount);
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!accounts.length) {
      toast('Aucun compte auxiliaire client actif de classe 4 n’est disponible dans ce dossier.', 'warning');
      return;
    }
    var defaultAccount = accounts.find(function (account) { return account.code === '411'; }) || accounts[0];
    var selectedAccount = existing && accounts.some(function (account) { return account.code === existing.accountCode; })
      ? existing.accountCode : defaultAccount.code;
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (account.code === selectedAccount ? ' selected' : '') + '>' +
        esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var codeCheck = existing ? S.clientCodeChangeCheck(existing.id) : { ok: true, errors: [] };
    var suggestedClientCode = existing ? existing.code : S.nextIdentificationCode('client');
    var value = function (key) {
      var raw = existing && existing[key] != null ? existing[key] : (key === 'code' ? suggestedClientCode : '');
      return esc(raw);
    };
    var codeHint = existing && !codeCheck.ok
      ? '<span class="hint">Code et compte collectif verrouillés pour préserver les références : ' + esc(codeCheck.errors.join(' ')) + '</span>'
      : '<span class="hint">Code proposé automatiquement à l’enregistrement ; il reste modifiable avant validation.</span>';
    var body = '<form id="client-form" novalidate>' +
      '<div id="client-errors" aria-live="assertive"></div>' +
      '<div class="form-grid supplier-form-grid client-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="client-code">Code client <span aria-hidden="true">*</span></label>' +
          '<input id="client-code" name="code" type="text" maxlength="32" value="' + value('code') + '" placeholder="Ex. CLI-0001"' + (existing && !codeCheck.ok ? ' readonly' : '') + ' required autocomplete="off">' + codeHint + '</div>' +
        '<div class="field"><label for="client-name">Nom ou raison sociale <span aria-hidden="true">*</span></label>' +
          '<input id="client-name" name="name" type="text" maxlength="150" value="' + value('name') + '" placeholder="Nom du client" required></div>' +
        '<div class="field"><label for="client-ifu">Numéro IFU</label><input id="client-ifu" name="ifu" type="text" maxlength="50" value="' + value('ifu') + '"></div>' +
        '<div class="field"><label for="client-rccm">Numéro RCCM</label><input id="client-rccm" name="rccm" type="text" maxlength="80" value="' + value('rccm') + '"></div>' +
        '<div class="field"><label for="client-contact">Nom du contact</label><input id="client-contact" name="contactName" type="text" maxlength="120" value="' + value('contactName') + '"></div>' +
        '<div class="field"><label for="client-email">Adresse e-mail</label><input id="client-email" name="email" type="email" maxlength="254" value="' + value('email') + '"></div>' +
        '<div class="field"><label for="client-phone">Téléphone</label><input id="client-phone" name="phone" type="tel" maxlength="40" value="' + value('phone') + '"></div>' +
        '<div class="field"><label for="client-account">Compte collectif client <span aria-hidden="true">*</span></label><select id="client-account" name="accountCode" required' + (existing && !codeCheck.ok ? ' disabled' : '') + '>' + accountOptions + '</select><span class="hint">Compte de rattachement et auxiliaire individuel ; aucune écriture n’est générée.</span></div>' +
        '<div class="field"><label for="client-terms">Délai indicatif de règlement (jours)</label><input id="client-terms" name="paymentTermDays" type="number" min="0" max="3650" step="1" value="' + esc(existing ? existing.paymentTermDays : 30) + '"></div>' +
        '<div class="field supplier-address-field"><label for="client-address">Adresse</label><input id="client-address" name="address" type="text" maxlength="255" value="' + value('address') + '"></div>' +
        '<div class="field supplier-notes-field"><label for="client-notes">Notes internes</label><textarea id="client-notes" name="notes" rows="3" maxlength="1000">' + value('notes') + '</textarea></div>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="client-form" data-action="save-client" data-client-mode="' + mode + '">' +
        (existing ? 'Enregistrer les modifications' : 'Enregistrer le client') + '</button>';
    openModal(existing ? 'Modifier le client' : 'Nouveau client',
      existing ? 'Fiche du dossier ' + esc(S.currentDossier().reference) : 'Création d’une fiche dans le dossier ' + esc(S.currentDossier().reference),
      body, footer, true);

    var form = $('#client-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'clients.edit' : 'clients.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var clientInput = {
        code: $('#client-code').value,
        name: $('#client-name').value,
        ifu: $('#client-ifu').value,
        rccm: $('#client-rccm').value,
        contactName: $('#client-contact').value,
        email: $('#client-email').value,
        phone: $('#client-phone').value,
        accountCode: $('#client-account').value,
        paymentTermDays: $('#client-terms').value,
        address: $('#client-address').value,
        notes: $('#client-notes').value
      };
      var result = existing ? S.updateClient(existing.id, clientInput) : S.createClient(clientInput);
      if (!result.ok) {
        $('#client-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche client mise à jour.' : 'Client ' + result.client.code + ' enregistré.', 'success');
      closeModal(true);
      render();
    });
  }

  function auxiliaryPartyKind(type) { return type === 'creditor' ? 'creditor' : 'debtor'; }

  function auxiliaryPartyTypeLabel(type) { return type === 'creditor' ? 'Créditeur divers' : 'Débiteur divers'; }

  function auxiliaryPartyAccountLabel(record) {
    var account = S.account(record.accountCode);
    return account ? account.code + ' · ' + account.label : String(record.accountCode || 'Compte non disponible');
  }

  function filteredOtherParties(records, query, type) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (record) {
      if (type && type !== 'all' && record.type !== type) return false;
      if (!needle) return true;
      var searchable = [
        record.code, record.auxiliaryAccountCode, record.name, record.contactName, record.ifu, record.rccm,
        record.email, record.phone, record.address, record.notes, auxiliaryPartyTypeLabel(record.type), auxiliaryPartyAccountLabel(record)
      ].join(' ').toLocaleLowerCase();
      return searchable.indexOf(needle) !== -1;
    });
  }

  function otherPartyRowsHtml(records) {
    var filter = ui.otherParties || { q: '', type: 'all' };
    return filteredOtherParties(records, filter.q, filter.type).map(function (record) {
      var coordinates = [record.ifu ? 'IFU : ' + record.ifu : '', record.rccm ? 'RCCM : ' + record.rccm : '', record.email || '', record.phone || '']
        .filter(Boolean).map(esc).join('<br>') || '<span class="muted">Non renseignées</span>';
      var contact = [record.contactName, record.address].filter(Boolean).map(esc).join('<br>');
      return '<tr>' +
        '<td><span class="other-party-type ' + (record.type === 'creditor' ? 'is-creditor' : 'is-debtor') + '">' + esc(auxiliaryPartyTypeLabel(record.type)) + '</span></td>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><strong>' + esc(record.name) + '</strong>' + (contact ? '<br><small>' + contact + '</small>' : '') + '</td>' +
        '<td>' + coordinates + '</td>' +
        '<td><strong>' + esc(record.auxiliaryAccountCode || (record.accountCode + '-' + record.code)) + '</strong><br><small>Compte collectif : ' + esc(auxiliaryPartyAccountLabel(record)) + '</small></td>' +
        '<td><div class="supplier-row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-other-party" data-id="' + esc(record.id) + '" aria-label="Modifier la fiche ' + esc(record.name) + '">Modifier</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-other-party" data-id="' + esc(record.id) + '" aria-label="Supprimer définitivement ' + esc(record.name) + '" title="Suppression refusée si une pièce comptable ou un mouvement référence ce tiers.">Supprimer</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function viewOtherParties() {
    var records = S.otherParties().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.otherParties || (ui.otherParties = { q: '', type: 'all' });
    var visible = filteredOtherParties(records, filter.q, filter.type);
    var debtorCount = records.filter(function (record) { return record.type === 'debtor'; }).length;
    var creditorCount = records.filter(function (record) { return record.type === 'creditor'; }).length;
    var emptyMessage = records.length
      ? 'Aucun tiers ne correspond à cette recherche et à ce filtre.'
      : 'Aucun débiteur ou créditeur divers n’est encore enregistré. Utilisez « Nouveau tiers divers » pour créer une fiche.';
    return '<div class="exchange-workspace other-party-workspace" id="other-party-workspace">' +
      '<div class="alert info"><div><strong>Répertoire des débiteurs et créditeurs divers du dossier actif.</strong> Le type sert à distinguer la nature du tiers ; le compte collectif de classe 4/famille 47 est choisi sur la fiche. Aucun mouvement, règlement ou lettrage n’est généré et les centralisations restent réservées aux modules PERFECTO internes.</div></div>' +
      '<div class="exchange-summary-grid client-summary-grid" aria-label="Résumé des débiteurs et créditeurs divers">' +
        '<div><small>Tiers enregistrés</small><strong>' + records.length + '</strong></div>' +
        '<div><small>Débiteurs divers</small><strong>' + debtorCount + '</strong></div>' +
        '<div><small>Créditeurs divers</small><strong>' + creditorCount + '</strong></div>' +
      '</div>' +
      '<section class="exchange-card other-party-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Débiteurs et créditeurs divers</h4><p>Codes DEB/CRE proposés automatiquement, modifiables et réservés après attribution.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="new-other-party">＋ Nouveau tiers divers</button></div>' +
        '<form id="other-party-filter-form" class="supplier-filter-controls other-party-filter-controls" role="search">' +
          '<label class="field"><span>Rechercher</span><input id="other-party-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, type, nom, IFU, contact…" autocomplete="off"></label>' +
          '<label class="field"><span>Nature du tiers</span><select id="other-party-type-filter"><option value="all"' + (filter.type === 'all' ? ' selected' : '') + '>Tous les tiers</option><option value="debtor"' + (filter.type === 'debtor' ? ' selected' : '') + '>Débiteurs divers</option><option value="creditor"' + (filter.type === 'creditor' ? ' selected' : '') + '>Créditeurs divers</option></select></label>' +
        '</form>' +
        '<p class="supplier-result-note" id="other-party-result-note">' + visible.length + (visible.length === 1 ? ' tiers affiché.' : ' tiers affichés.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap other-party-table-wrap" id="other-party-table-wrap"' + (visible.length ? '' : ' hidden') + '>' +
          '<table class="exchange-mapping-table other-party-table"><caption class="sr-only">Débiteurs et créditeurs divers du dossier actif</caption><thead><tr>' +
            '<th>Nature</th><th>Code</th><th>Nom / contact</th><th>Coordonnées</th><th>Compte collectif</th><th>Actions</th>' +
          '</tr></thead><tbody id="other-party-rows">' + otherPartyRowsHtml(records) + '</tbody></table>' +
        '</div>' +
        '<div id="other-party-list-empty" class="empty-state registry-empty"' + (visible.length ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">Les écritures du compte 47 restent à saisir dans les parcours comptables ; ces fiches ne sont pas des pièces ni des soldes auxiliaires.</p>' +
    '</div>';
  }

  function refreshOtherPartyRows() {
    var records = S.otherParties().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.otherParties || { q: '', type: 'all' };
    var visible = filteredOtherParties(records, filter.q, filter.type);
    var rows = $('#other-party-rows');
    var tableWrap = $('#other-party-table-wrap');
    var empty = $('#other-party-list-empty');
    var note = $('#other-party-result-note');
    if (rows) rows.innerHTML = otherPartyRowsHtml(records);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      empty.querySelector('p').textContent = records.length ? 'Aucun tiers ne correspond à cette recherche et à ce filtre.' : 'Aucun débiteur ou créditeur divers n’est encore enregistré. Utilisez « Nouveau tiers divers » pour créer une fiche.';
    }
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' tiers affiché.' : ' tiers affichés.');
    applyDemoActionGates(rows);
  }

  function bindOtherPartyView() {
    var form = $('#other-party-filter-form');
    if (!form) return;
    var search = $('#other-party-search', form);
    var type = $('#other-party-type-filter', form);
    function update() {
      ui.otherParties = ui.otherParties || { q: '', type: 'all' };
      ui.otherParties.q = search ? search.value : '';
      ui.otherParties.type = type ? type.value : 'all';
      refreshOtherPartyRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
    if (type) type.addEventListener('change', update);
  }

  function openOtherPartyModal(id) {
    var existing = id ? S.otherParty(id) : null;
    if (id && !existing) { toast('Débiteur ou créditeur divers introuvable dans le dossier actif.', 'error'); return; }
    var roots = ['47'];
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return roots.some(function (rootCode) { return code.indexOf(rootCode) === 0; }) &&
        Number(account.cls || code.charAt(0)) === 4 && account.aux === true && account.active !== false && account.postable !== false;
    });
    var existingAccount = existing && S.account(existing.accountCode);
    if (existingAccount && !accounts.some(function (account) { return account.code === existingAccount.code; })) accounts.push(existingAccount);
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!accounts.length) { toast('Aucun compte auxiliaire actif de la famille 47 n’est disponible.', 'warning'); return; }
    var type = existing ? existing.type : 'debtor';
    var defaultAccount = accounts.find(function (account) { return account.code === '471'; }) || accounts[0];
    var selectedAccount = existing && accounts.some(function (account) { return account.code === existing.accountCode; }) ? existing.accountCode : defaultAccount.code;
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (account.code === selectedAccount ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var identityCheck = existing ? S.otherPartyIdentityChangeCheck(existing.id) : { ok: true, errors: [] };
    var suggestedCode = existing ? existing.code : S.nextIdentificationCode(auxiliaryPartyKind(type));
    var codeInputEdited = false;
    var lastAutomaticCode = suggestedCode;
    var value = function (key) { return esc(existing && existing[key] != null ? existing[key] : (key === 'code' ? suggestedCode : '')); };
    var codeHint = existing && !identityCheck.ok
      ? '<span class="hint">Type, code et compte collectif verrouillés pour préserver les références : ' + esc(identityCheck.errors.join(' ')) + '</span>'
      : '<span class="hint">Code DEB/CRE proposé automatiquement ; modifiable avant enregistrement.</span>';
    var body = '<form id="other-party-form" novalidate>' +
      '<div id="other-party-errors" aria-live="assertive"></div>' +
      '<div class="form-grid supplier-form-grid other-party-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="other-party-type">Nature du tiers <span aria-hidden="true">*</span></label><select id="other-party-type" name="type" required' + (existing && !identityCheck.ok ? ' disabled' : '') + '><option value="debtor"' + (type === 'debtor' ? ' selected' : '') + '>Débiteur divers</option><option value="creditor"' + (type === 'creditor' ? ' selected' : '') + '>Créditeur divers</option></select></div>' +
        '<div class="field"><label for="other-party-code">Code <span aria-hidden="true">*</span></label><input id="other-party-code" name="code" type="text" maxlength="32" value="' + value('code') + '" placeholder="Ex. DEB-0001"' + (existing && !identityCheck.ok ? ' readonly' : '') + ' required autocomplete="off">' + codeHint + '</div>' +
        '<div class="field"><label for="other-party-name">Nom ou raison sociale <span aria-hidden="true">*</span></label><input id="other-party-name" name="name" type="text" maxlength="150" value="' + value('name') + '" required></div>' +
        '<div class="field"><label for="other-party-contact">Nom du contact</label><input id="other-party-contact" name="contactName" type="text" maxlength="120" value="' + value('contactName') + '"></div>' +
        '<div class="field"><label for="other-party-ifu">Numéro IFU</label><input id="other-party-ifu" name="ifu" type="text" maxlength="50" value="' + value('ifu') + '"></div>' +
        '<div class="field"><label for="other-party-rccm">Numéro RCCM</label><input id="other-party-rccm" name="rccm" type="text" maxlength="80" value="' + value('rccm') + '"></div>' +
        '<div class="field"><label for="other-party-email">Adresse e-mail</label><input id="other-party-email" name="email" type="email" maxlength="254" value="' + value('email') + '"></div>' +
        '<div class="field"><label for="other-party-phone">Téléphone</label><input id="other-party-phone" name="phone" type="tel" maxlength="40" value="' + value('phone') + '"></div>' +
        '<div class="field"><label for="other-party-account">Compte collectif classe 4 · famille 47 <span aria-hidden="true">*</span></label><select id="other-party-account" name="accountCode" required' + (existing && !identityCheck.ok ? ' disabled' : '') + '>' + accountOptions + '</select><span class="hint">Compte collectif et auxiliaire du tiers ; aucune écriture n’est générée.</span></div>' +
        '<div class="field other-party-address-field"><label for="other-party-address">Adresse</label><input id="other-party-address" name="address" type="text" maxlength="255" value="' + value('address') + '"></div>' +
        '<div class="field other-party-notes-field"><label for="other-party-notes">Notes internes</label><textarea id="other-party-notes" name="notes" rows="3" maxlength="1000">' + value('notes') + '</textarea></div>' +
      '</div>' +
    '</form>';
    var mode = existing ? 'edit' : 'create';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="other-party-form" data-action="save-other-party" data-other-party-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Enregistrer le tiers') + '</button>';
    openModal(existing ? 'Modifier un tiers divers' : 'Nouveau débiteur ou créditeur divers',
      'Fiche locale du dossier ' + esc(S.currentDossier().reference), body, footer, true);
    var form = $('#other-party-form');
    var typeInput = $('#other-party-type');
    var codeInput = $('#other-party-code');
    if (codeInput) codeInput.addEventListener('input', function () { if (codeInput.value !== lastAutomaticCode) codeInputEdited = true; });
    if (typeInput) typeInput.addEventListener('change', function () {
      if (!codeInputEdited) {
        codeInput.value = S.nextIdentificationCode(auxiliaryPartyKind(typeInput.value));
        lastAutomaticCode = codeInput.value;
      }
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'otherParties.edit' : 'otherParties.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        type: $('#other-party-type').value, code: $('#other-party-code').value, name: $('#other-party-name').value,
        contactName: $('#other-party-contact').value, ifu: $('#other-party-ifu').value, rccm: $('#other-party-rccm').value,
        email: $('#other-party-email').value, phone: $('#other-party-phone').value, address: $('#other-party-address').value,
        accountCode: $('#other-party-account').value, notes: $('#other-party-notes').value
      };
      var result = existing ? S.updateOtherParty(existing.id, input) : S.createOtherParty(input);
      if (!result.ok) {
        $('#other-party-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' + result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche de tiers divers mise à jour.' : auxiliaryPartyTypeLabel(result.otherParty.type) + ' ' + result.otherParty.code + ' enregistré.', 'success');
      closeModal(true);
      render();
    });
  }

  function filteredPersonnel(records, query) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (record) {
      if (!needle) return true;
      var account = S.account(record.accountCode);
      var searchable = [record.code, record.auxiliaryAccountCode, record.name, record.jobTitle, record.department, record.email, record.phone, record.address, record.notes, account && account.label, record.accountCode].join(' ').toLocaleLowerCase();
      return searchable.indexOf(needle) !== -1;
    });
  }

  function personnelRowsHtml(records) {
    var filter = ui.personnel || { q: '' };
    return filteredPersonnel(records, filter.q).map(function (record) {
      var contacts = [record.email || '', record.phone || '', record.address || ''].filter(Boolean).map(esc).join('<br>') || '<span class="muted">Non renseignés</span>';
      var role = [record.jobTitle, record.department].filter(Boolean).map(esc).join('<br>');
      var account = S.account(record.accountCode);
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><strong>' + esc(record.name) + '</strong>' + (role ? '<br><small>' + role + '</small>' : '') + '</td>' +
        '<td>' + contacts + '</td>' +
        '<td><strong>' + esc(record.auxiliaryAccountCode || (record.accountCode + '-' + record.code)) + '</strong><br><small>Compte collectif : ' + esc(account ? account.code + ' · ' + account.label : String(record.accountCode || 'Compte non disponible')) + '</small></td>' +
        '<td><div class="supplier-row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-personnel" data-id="' + esc(record.id) + '" aria-label="Modifier la fiche de ' + esc(record.name) + '">Modifier</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-personnel" data-id="' + esc(record.id) + '" aria-label="Supprimer définitivement ' + esc(record.name) + '" title="Suppression refusée si une pièce comptable référence ce membre du personnel.">Supprimer</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function viewPersonnel() {
    var records = S.personnel().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.personnel || (ui.personnel = { q: '' });
    var visible = filteredPersonnel(records, filter.q);
    var emptyMessage = records.length ? 'Aucun membre ne correspond à cette recherche.' : 'Aucun membre du personnel n’est encore enregistré. Utilisez « Nouveau membre » pour créer une fiche.';
    return '<div class="exchange-workspace personnel-workspace" id="personnel-workspace">' +
      '<div class="alert info"><div><strong>Répertoire local du personnel du dossier actif.</strong> Les codes PER identifient les fiches ; les données de rémunération, contrats et calculs de paie restent dans le périmètre du module Paie & RH et ne sont pas gérés ici.</div></div>' +
      '<div class="exchange-summary-grid client-summary-grid" aria-label="Résumé du personnel"><div><small>Membres enregistrés</small><strong>' + records.length + '</strong></div><div><small>Résultats affichés</small><strong id="personnel-visible-count">' + visible.length + '</strong></div></div>' +
      '<section class="exchange-card personnel-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Personnel</h4><p>Identité professionnelle, contacts et compte collectif ; aucune donnée de salaire n’est stockée.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="new-personnel">＋ Nouveau membre</button></div>' +
        '<form id="personnel-filter-form" class="supplier-filter-controls client-filter-controls" role="search"><label class="field"><span>Rechercher</span><input id="personnel-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, nom, fonction, service…" autocomplete="off"></label></form>' +
        '<p class="supplier-result-note" id="personnel-result-note">' + visible.length + (visible.length === 1 ? ' membre affiché.' : ' membres affichés.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap personnel-table-wrap" id="personnel-table-wrap"' + (visible.length ? '' : ' hidden') + '>' +
          '<table class="exchange-mapping-table personnel-table"><caption class="sr-only">Personnel du dossier actif</caption><thead><tr><th>Code</th><th>Identité / fonction</th><th>Coordonnées</th><th>Compte collectif</th><th>Actions</th></tr></thead><tbody id="personnel-rows">' + personnelRowsHtml(records) + '</tbody></table>' +
        '</div>' +
        '<div id="personnel-list-empty" class="empty-state registry-empty"' + (visible.length ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">Le répertoire est isolé par dossier et inclus dans la sauvegarde locale. La synchronisation et les droits réels restent à construire.</p>' +
    '</div>';
  }

  function refreshPersonnelRows() {
    var records = S.personnel().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.personnel || { q: '' };
    var visible = filteredPersonnel(records, filter.q);
    var rows = $('#personnel-rows');
    var tableWrap = $('#personnel-table-wrap');
    var empty = $('#personnel-list-empty');
    var count = $('#personnel-visible-count');
    var note = $('#personnel-result-note');
    if (rows) rows.innerHTML = personnelRowsHtml(records);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      empty.querySelector('p').textContent = records.length ? 'Aucun membre ne correspond à cette recherche.' : 'Aucun membre du personnel n’est encore enregistré. Utilisez « Nouveau membre » pour créer une fiche.';
    }
    if (count) count.textContent = String(visible.length);
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' membre affiché.' : ' membres affichés.');
    applyDemoActionGates(rows);
  }

  function bindPersonnelView() {
    var form = $('#personnel-filter-form');
    if (!form) return;
    var search = $('#personnel-search', form);
    function update() {
      ui.personnel = ui.personnel || { q: '' };
      ui.personnel.q = search ? search.value : '';
      refreshPersonnelRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
  }

  function openPersonnelModal(id) {
    var existing = id ? S.personnelRecord(id) : null;
    if (id && !existing) { toast('Membre du personnel introuvable dans le dossier actif.', 'error'); return; }
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return code.indexOf('42') === 0 && Number(account.cls || code.charAt(0)) === 4 && account.aux === true && account.active !== false && account.postable !== false;
    });
    var existingAccount = existing && S.account(existing.accountCode);
    if (existingAccount && !accounts.some(function (account) { return account.code === existingAccount.code; })) accounts.push(existingAccount);
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!accounts.length) { toast('Aucun compte auxiliaire actif de la famille Personnel (42) n’est disponible.', 'warning'); return; }
    var defaultAccount = accounts.find(function (account) { return account.code === '421'; }) || accounts[0];
    var selectedAccount = existing && accounts.some(function (account) { return account.code === existing.accountCode; }) ? existing.accountCode : defaultAccount.code;
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (account.code === selectedAccount ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var identityCheck = existing ? S.personnelIdentityChangeCheck(existing.id) : { ok: true, errors: [] };
    var suggestedCode = existing ? existing.code : S.nextIdentificationCode('personnel');
    var value = function (key) { return esc(existing && existing[key] != null ? existing[key] : (key === 'code' ? suggestedCode : '')); };
    var identityHint = existing && !identityCheck.ok
      ? '<span class="hint">Code et compte collectif verrouillés pour préserver les références : ' + esc(identityCheck.errors.join(' ')) + '</span>'
      : '<span class="hint">Code PER proposé automatiquement ; modifiable avant enregistrement.</span>';
    var body = '<form id="personnel-form" novalidate><div id="personnel-errors" aria-live="assertive"></div>' +
      '<div class="form-grid supplier-form-grid personnel-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="personnel-code">Code personnel <span aria-hidden="true">*</span></label><input id="personnel-code" name="code" type="text" maxlength="32" value="' + value('code') + '" placeholder="Ex. PER-0001"' + (existing && !identityCheck.ok ? ' readonly' : '') + ' required autocomplete="off">' + identityHint + '</div>' +
        '<div class="field"><label for="personnel-name">Nom et prénom <span aria-hidden="true">*</span></label><input id="personnel-name" name="name" type="text" maxlength="150" value="' + value('name') + '" required></div>' +
        '<div class="field"><label for="personnel-job-title">Fonction</label><input id="personnel-job-title" name="jobTitle" type="text" maxlength="120" value="' + value('jobTitle') + '"></div>' +
        '<div class="field"><label for="personnel-department">Service</label><input id="personnel-department" name="department" type="text" maxlength="120" value="' + value('department') + '"></div>' +
        '<div class="field"><label for="personnel-email">Adresse e-mail</label><input id="personnel-email" name="email" type="email" maxlength="254" value="' + value('email') + '"></div>' +
        '<div class="field"><label for="personnel-phone">Téléphone</label><input id="personnel-phone" name="phone" type="tel" maxlength="40" value="' + value('phone') + '"></div>' +
        '<div class="field"><label for="personnel-account">Compte collectif du personnel <span aria-hidden="true">*</span></label><select id="personnel-account" name="accountCode" required' + (existing && !identityCheck.ok ? ' disabled' : '') + '>' + accountOptions + '</select><span class="hint">Compte auxiliaire individuel du plan comptable ; aucune écriture de paie n’est générée.</span></div>' +
        '<div class="field personnel-address-field"><label for="personnel-address">Adresse</label><input id="personnel-address" name="address" type="text" maxlength="255" value="' + value('address') + '"></div>' +
        '<div class="field personnel-notes-field"><label for="personnel-notes">Notes professionnelles</label><textarea id="personnel-notes" name="notes" rows="3" maxlength="1000">' + value('notes') + '</textarea></div>' +
      '</div></form>';
    var mode = existing ? 'edit' : 'create';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary" form="personnel-form" data-action="save-personnel" data-personnel-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Enregistrer le membre') + '</button>';
    openModal(existing ? 'Modifier la fiche du personnel' : 'Nouveau membre du personnel', 'Répertoire local du dossier ' + esc(S.currentDossier().reference), body, footer, true);
    var form = $('#personnel-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'personnel.edit' : 'personnel.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        code: $('#personnel-code').value, name: $('#personnel-name').value, jobTitle: $('#personnel-job-title').value,
        department: $('#personnel-department').value, email: $('#personnel-email').value, phone: $('#personnel-phone').value,
        accountCode: $('#personnel-account').value, address: $('#personnel-address').value, notes: $('#personnel-notes').value
      };
      var result = existing ? S.updatePersonnel(existing.id, input) : S.createPersonnel(input);
      if (!result.ok) {
        $('#personnel-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' + result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche du personnel mise à jour.' : 'Membre ' + result.personnel.code + ' enregistré.', 'success');
      closeModal(true);
      render();
    });
  }

  function fixedAssetLocationPathLabel(record, records) {
    var parts = [];
    var current = record;
    var visited = Object.create(null);
    var byId = Object.create(null);
    records.forEach(function (item) { byId[item.id] = item; });
    while (current && !visited[current.id]) {
      visited[current.id] = true;
      parts.unshift(String(current.name || current.code || 'Emplacement'));
      current = current.parentId ? byId[current.parentId] : null;
    }
    return parts.join(' › ');
  }

  function fixedAssetLocationTree(records, query) {
    var byId = Object.create(null);
    var children = Object.create(null);
    var selected = Object.create(null);
    var visited = Object.create(null);
    var q = String(query || '').trim().toLocaleLowerCase('fr');
    records.forEach(function (record) { byId[record.id] = record; });
    var matches = records.filter(function (record) {
      if (!q) return true;
      var searchable = [record.code, record.level, record.name, record.address, record.responsible, record.notes, fixedAssetLocationPathLabel(record, records)].join(' ').toLocaleLowerCase('fr');
      return searchable.indexOf(q) !== -1;
    });
    if (!q) records.forEach(function (record) { selected[record.id] = true; });
    else matches.forEach(function (record) {
      var current = record;
      var ancestors = Object.create(null);
      while (current && !ancestors[current.id]) {
        ancestors[current.id] = true;
        selected[current.id] = true;
        current = current.parentId ? byId[current.parentId] : null;
      }
    });
    records.forEach(function (record) {
      var parentId = String(record.parentId || '');
      if (parentId && parentId !== String(record.id) && byId[parentId]) {
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(record);
      }
    });
    Object.keys(children).forEach(function (parentId) {
      children[parentId].sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    });
    var roots = records.filter(function (record) {
      var parentId = String(record.parentId || '');
      return !parentId || parentId === String(record.id) || !byId[parentId];
    }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var rows = [];
    function visit(record, depth) {
      if (!record || visited[record.id]) return;
      visited[record.id] = true;
      if (selected[record.id]) rows.push({ record: record, depth: depth });
      (children[record.id] || []).forEach(function (child) { visit(child, depth + 1); });
    }
    roots.forEach(function (record) { visit(record, 0); });
    records.forEach(function (record) { if (!visited[record.id]) visit(record, 0); });
    return { rows: rows, matchCount: matches.length };
  }

  function fixedAssetLocationDescendantIds(records, rootId) {
    var descendants = Object.create(null);
    var changed = true;
    while (changed) {
      changed = false;
      records.forEach(function (record) {
        if (String(record.id) === String(rootId) || descendants[record.id]) return;
        if (String(record.parentId || '') === String(rootId) || descendants[String(record.parentId || '')]) {
          descendants[record.id] = true;
          changed = true;
        }
      });
    }
    return descendants;
  }

  function fixedAssetLocationParentOptions(records, selectedParentId, excludeId) {
    var excluded = excludeId ? fixedAssetLocationDescendantIds(records, excludeId) : Object.create(null);
    var tree = fixedAssetLocationTree(records, '');
    return '<option value="">Aucun — emplacement racine</option>' + tree.rows.filter(function (row) {
      return String(row.record.id) !== String(excludeId || '') && !excluded[row.record.id];
    }).map(function (row) {
      var indent = new Array(Math.min(row.depth, 8) + 1).join('— ');
      var label = indent + (row.record.code ? row.record.code + ' · ' : '') + row.record.name + ' (' + row.record.level + ')';
      return '<option value="' + esc(row.record.id) + '"' + (String(row.record.id) === String(selectedParentId || '') ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function fixedAssetLocationRowsHtml(records, query) {
    var tree = fixedAssetLocationTree(records, query);
    var byId = Object.create(null);
    records.forEach(function (record) { byId[record.id] = record; });
    return tree.rows.map(function (row) {
      var record = row.record;
      var parent = record.parentId ? byId[record.parentId] : null;
      var depth = Math.min(row.depth, 8);
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><span class="fixed-asset-location-level">' + esc(record.level) + '</span></td>' +
        '<td><div class="fixed-asset-location-tree-node" style="padding-inline-start:' + (depth * 20) + 'px"><span class="fixed-asset-location-tree-marker" aria-hidden="true">' + (row.depth ? '↳' : '⌂') + '</span><div><strong>' + esc(record.name) + '</strong><small>' + esc(parent ? 'Sous-emplacement de ' + parent.name : 'Emplacement racine') + '</small></div></div></td>' +
        '<td>' + (record.address ? esc(record.address) : '<span class="muted">Non renseignée</span>') + '</td>' +
        '<td>' + (record.responsible ? esc(record.responsible) : '<span class="muted">Non renseigné</span>') + '</td>' +
        '<td><div class="supplier-row-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-fixed-asset-location" data-id="' + esc(record.id) + '" aria-label="Modifier la localisation ' + esc(record.name) + '">Modifier</button><button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-fixed-asset-location" data-id="' + esc(record.id) + '" aria-label="Supprimer la localisation ' + esc(record.name) + '" title="Refusée si l’emplacement possède des enfants ou référence une immobilisation.">Supprimer</button></div></td>' +
      '</tr>';
    }).join('');
  }

  function viewFixedAssetLocations() {
    var records = S.fixedAssetLocations();
    var filter = ui.fixedAssetLocations || (ui.fixedAssetLocations = { q: '' });
    var tree = fixedAssetLocationTree(records, filter.q);
    var rootCount = records.filter(function (record) { return !record.parentId || !records.some(function (candidate) { return candidate.id === record.parentId; }); }).length;
    var emptyMessage = records.length
      ? 'Aucun emplacement ne correspond à cette recherche.'
      : 'Aucun emplacement n’est encore enregistré dans ce dossier. Créez d’abord un site ou un emplacement racine.';
    return '<div class="exchange-workspace fixed-asset-location-workspace" id="fixed-asset-location-workspace">' +
      '<div class="alert info"><div><strong>Référentiel hiérarchique du dossier actif.</strong> Créez les niveaux utiles à votre organisation — par exemple site, bâtiment, étage, local ou zone — puis rattachez chaque emplacement à son parent. Le niveau, le code et les champs descriptifs restent modifiables ; aucune immobilisation, écriture ou dotation aux amortissements n’est créée ici.</div></div>' +
      '<div class="exchange-summary-grid fixed-asset-location-summary-grid" aria-label="Résumé des localisations d’immobilisations"><div><small>Emplacements enregistrés</small><strong>' + records.length + '</strong></div><div><small>Emplacements racines</small><strong>' + rootCount + '</strong></div><div><small>Résultats de recherche</small><strong id="fixed-asset-location-visible-count">' + tree.matchCount + '</strong></div></div>' +
      '<section class="exchange-card fixed-asset-location-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Localisations des immobilisations corporelles</h4><p>Arborescence modifiable, sans limite métier fixe sur le nombre de niveaux.</p></div><button type="button" class="btn btn-primary" data-action="new-fixed-asset-location">＋ Nouvel emplacement</button></div>' +
        '<form id="fixed-asset-location-filter-form" class="supplier-filter-controls client-filter-controls" role="search"><label class="field"><span>Rechercher dans les codes, niveaux et emplacements</span><input id="fixed-asset-location-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, site, bâtiment, local, responsable…" autocomplete="off"></label></form>' +
        '<p class="supplier-result-note" id="fixed-asset-location-result-note">' + tree.matchCount + (tree.matchCount === 1 ? ' emplacement correspondant.' : ' emplacements correspondants.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap fixed-asset-location-table-wrap" id="fixed-asset-location-table-wrap"' + (tree.matchCount ? '' : ' hidden') + '><table class="exchange-mapping-table fixed-asset-location-table"><caption class="sr-only">Arborescence des localisations d’immobilisations du dossier actif</caption><thead><tr><th>Code</th><th>Niveau</th><th>Emplacement hiérarchisé</th><th>Adresse / précision</th><th>Responsable / service</th><th>Actions</th></tr></thead><tbody id="fixed-asset-location-rows">' + fixedAssetLocationRowsHtml(records, filter.q) + '</tbody></table></div>' +
        '<div id="fixed-asset-location-list-empty" class="empty-state registry-empty"' + (tree.matchCount ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">Les localisations restent dans les données locales et la sauvegarde JSON du dossier actif. L’affectation aux fiches d’immobilisations sera activée avec le registre des immobilisations.</p>' +
    '</div>';
  }

  function refreshFixedAssetLocationRows() {
    var records = S.fixedAssetLocations();
    var filter = ui.fixedAssetLocations || { q: '' };
    var tree = fixedAssetLocationTree(records, filter.q);
    var rows = $('#fixed-asset-location-rows');
    var tableWrap = $('#fixed-asset-location-table-wrap');
    var empty = $('#fixed-asset-location-list-empty');
    var count = $('#fixed-asset-location-visible-count');
    var note = $('#fixed-asset-location-result-note');
    if (rows) rows.innerHTML = fixedAssetLocationRowsHtml(records, filter.q);
    if (tableWrap) tableWrap.hidden = tree.matchCount === 0;
    if (empty) {
      empty.hidden = tree.matchCount !== 0;
      empty.querySelector('p').textContent = records.length
        ? 'Aucun emplacement ne correspond à cette recherche.'
        : 'Aucun emplacement n’est encore enregistré dans ce dossier. Créez d’abord un site ou un emplacement racine.';
    }
    if (count) count.textContent = String(tree.matchCount);
    if (note) note.textContent = tree.matchCount + (tree.matchCount === 1 ? ' emplacement correspondant.' : ' emplacements correspondants.');
    applyDemoActionGates(rows);
  }

  function bindFixedAssetLocationView() {
    var form = $('#fixed-asset-location-filter-form');
    if (!form) return;
    var search = $('#fixed-asset-location-search', form);
    function update() {
      ui.fixedAssetLocations = ui.fixedAssetLocations || { q: '' };
      ui.fixedAssetLocations.q = search ? search.value : '';
      refreshFixedAssetLocationRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
  }

  function openFixedAssetLocationModal(id) {
    var existing = id ? S.fixedAssetLocation(id) : null;
    if (id && !existing) { toast('Emplacement d’immobilisation introuvable dans le dossier actif.', 'error'); return; }
    var records = S.fixedAssetLocations();
    var suggestedCode = existing ? existing.code : S.nextFixedAssetLocationCode();
    var value = function (key, fallback) { return esc(existing && existing[key] != null ? existing[key] : (fallback == null ? '' : fallback)); };
    var parentOptions = fixedAssetLocationParentOptions(records, existing && existing.parentId, existing && existing.id);
    var body = '<form id="fixed-asset-location-form" novalidate><div id="fixed-asset-location-errors" aria-live="assertive"></div>' +
      '<div class="form-grid fixed-asset-location-form-grid">' +
        '<div class="field"><label for="fixed-asset-location-code">Code <span aria-hidden="true">*</span></label><input id="fixed-asset-location-code" name="code" type="text" maxlength="32" value="' + value('code', suggestedCode) + '" placeholder="Ex. LOC-0001" required autocomplete="off"><span class="hint">Code proposé automatiquement, modifiable avant enregistrement et non réutilisé après attribution.</span></div>' +
        '<div class="field"><label for="fixed-asset-location-level">Niveau hiérarchique <span aria-hidden="true">*</span></label><input id="fixed-asset-location-level" name="level" type="text" maxlength="80" list="fixed-asset-location-level-options" value="' + value('level') + '" placeholder="Ex. Site, bâtiment, étage, local…" required><datalist id="fixed-asset-location-level-options"><option value="Site"><option value="Bâtiment"><option value="Étage"><option value="Local"><option value="Zone"><option value="Service"><option value="Atelier"></datalist><span class="hint">Saisissez votre propre niveau si nécessaire ; ce champ est libre et modifiable.</span></div>' +
        '<div class="field"><label for="fixed-asset-location-name">Désignation <span aria-hidden="true">*</span></label><input id="fixed-asset-location-name" name="name" type="text" maxlength="150" value="' + value('name') + '" placeholder="Ex. Siège de Cotonou" required></div>' +
        '<div class="field"><label for="fixed-asset-location-parent">Emplacement parent</label><select id="fixed-asset-location-parent" name="parentId">' + parentOptions + '</select><span class="hint">Laissez « emplacement racine » pour créer un site ou un point de départ. Les descendants ne peuvent pas devenir parents.</span></div>' +
        '<div class="field"><label for="fixed-asset-location-address">Adresse ou précision</label><input id="fixed-asset-location-address" name="address" type="text" maxlength="255" value="' + value('address') + '" placeholder="Adresse, aile, repère…"></div>' +
        '<div class="field"><label for="fixed-asset-location-responsible">Responsable ou service</label><input id="fixed-asset-location-responsible" name="responsible" type="text" maxlength="150" value="' + value('responsible') + '" placeholder="Service ou responsable du lieu"></div>' +
        '<div class="field fixed-asset-location-notes-field"><label for="fixed-asset-location-notes">Notes</label><textarea id="fixed-asset-location-notes" name="notes" rows="3" maxlength="1000" placeholder="Informations complémentaires">' + value('notes') + '</textarea></div>' +
      '</div></form>';
    var mode = existing ? 'edit' : 'create';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary" form="fixed-asset-location-form" data-action="save-fixed-asset-location" data-fixed-asset-location-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Enregistrer l’emplacement') + '</button>';
    openModal(existing ? 'Modifier une localisation' : 'Nouvelle localisation d’immobilisation', 'Référentiel local du dossier ' + esc(S.currentDossier().reference), body, footer, true);
    var form = $('#fixed-asset-location-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'fixedAssetLocations.edit' : 'fixedAssetLocations.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        code: $('#fixed-asset-location-code').value,
        level: $('#fixed-asset-location-level').value,
        name: $('#fixed-asset-location-name').value,
        parentId: $('#fixed-asset-location-parent').value,
        address: $('#fixed-asset-location-address').value,
        responsible: $('#fixed-asset-location-responsible').value,
        notes: $('#fixed-asset-location-notes').value
      };
      var result = existing ? S.updateFixedAssetLocation(existing.id, input) : S.createFixedAssetLocation(input);
      if (!result.ok) {
        $('#fixed-asset-location-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' + result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Localisation mise à jour.' : 'Emplacement ' + result.location.code + ' enregistré.', 'success');
      closeModal(true);
      render();
    });
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
        ? '<div class="alert info menu-readonly-note">Consultation seule. Cette démonstration affiche uniquement les données enregistrées dans ce navigateur ; aucune synchronisation entre appareils n’est encore disponible.</div>' +
          (S.databaseStorageStatus().recoveryRequired ? '<div class="alert warning menu-readonly-note"><strong>Base comptable à contrôler.</strong> Aucun état comptable n’est affiché à partir des données de secours. Ouvrez le dossier sur ordinateur ou tablette, puis Fichier → Réparation complète de la base.</div>' : '')
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
      '<span><i class="legend-dot legend-dot-partial"></i>Partiel</span>' +
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
    var exchangeFeature = '';
    if (group.id === 'definitions' && tab.id === 'suppliers') {
      exchangeFeature = viewSuppliers();
    } else if (group.id === 'definitions' && tab.id === 'clients') {
      exchangeFeature = viewClients();
    } else if (group.id === 'definitions' && tab.id === 'other-debtors-creditors') {
      exchangeFeature = viewOtherParties();
    } else if (group.id === 'definitions' && tab.id === 'personnel') {
      exchangeFeature = viewPersonnel();
    } else if (group.id === 'definitions' && tab.id === 'fixed-asset-locations') {
      exchangeFeature = viewFixedAssetLocations();
    }
    if (group.id === 'fichier') {
      switch (tab.id) {
        case 'export-other': exchangeFeature = viewAccountingExchangeExport(); break;
        case 'import-other': exchangeFeature = viewAccountingExchangeImport(); break;
        case 'import-balance': exchangeFeature = viewAccountingBalanceImport(); break;
        case 'centralize-auxiliary': exchangeFeature = viewInternalAuxiliaryCentralization(); break;
        case 'centralize-payroll': exchangeFeature = viewAccountingPayrollCentralization(); break;
        case 'centralize-sales': exchangeFeature = viewAccountingSalesCentralization(); break;
        case 'cancel-centralization': exchangeFeature = viewAccountingCentralizationCancellation(); break;
        case 'consolidate-before-result': exchangeFeature = viewAccountingConsolidationBeforeResult(); break;
        case 'consolidate-after-result': exchangeFeature = viewAccountingConsolidationAfterResult(); break;
        case 'recalculate-balances': exchangeFeature = viewAccountingBalanceRecalculation(); break;
        case 'repair-database': exchangeFeature = viewAccountingDatabaseRepair(); break;
        default: break;
      }
    }
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
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'suppliers') bindSupplierView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'clients') bindClientView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'other-debtors-creditors') bindOtherPartyView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'personnel') bindPersonnelView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'fixed-asset-locations') bindFixedAssetLocationView();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-other') bindAccountingExchangeImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-balance') bindAccountingBalanceImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'centralize-payroll') bindPayrollCentralization();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'centralize-sales') bindSalesCentralization();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'cancel-centralization') bindCentralizationCancellation();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'consolidate-before-result') bindAccountingConsolidationBeforeResult();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'consolidate-after-result') bindAccountingConsolidationAfterResult();
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
        : (launcherUi.filter === 'available' ? status === 'available' || status === 'partial' : status === launcherUi.filter);
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
        if (selectedModule && (selectedModule.status === 'available' || selectedModule.status === 'partial') && selectedModule.route) {
          navigate('#/' + selectedModule.route);
        } else if (selectedModule) {
          toast(selectedModule.name + ' n’est pas encore disponible.', 'warning');
        }
        break;
      }
      case 'create-demo-payroll-run':
        createDemoPayrollRun();
        break;
      case 'approve-internal-payroll-run':
        approveInternalPayrollRun(id);
        break;
      case 'open-accounting-payroll-centralization':
        navigate(accountingMenuHash('fichier', 'centralize-payroll'));
        break;
      case 'create-demo-sales-run':
        createDemoSalesRun();
        break;
      case 'approve-internal-sales-run':
        approveInternalSalesRun(id);
        break;
      case 'open-accounting-sales-centralization':
        navigate(accountingMenuHash('fichier', 'centralize-sales'));
        break;
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
      case 'edit-account':
        if (id) openAccountModal(id);
        break;
      case 'delete-account': {
        if (!id) break;
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'accounts.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « accounts.delete » n’est pas accordé.', 'warning');
          break;
        }
        var accountToDelete = S.account(id);
        if (!accountToDelete) { toast('Compte introuvable dans le dossier actif.', 'error'); break; }
        var accountDeleteCheck = S.accountDeleteCheck(id);
        if (!accountDeleteCheck.ok) {
          toast('Suppression refusée : ' + accountDeleteCheck.errors.join(' '), 'warning');
          break;
        }
        if (!window.confirm('Supprimer définitivement le compte ' + accountToDelete.code + ' — ' + accountToDelete.label + ' de ce dossier ? Les pièces historiques ne seront pas modifiées.')) break;
        var deletedAccount = S.deleteAccount(id);
        if (!deletedAccount.ok) { toast(deletedAccount.errors.join(' ') || 'Suppression impossible.', 'error'); break; }
        toast('Compte ' + id + ' supprimé du dossier.', 'success');
        render();
        break;
      }
      case 'new-supplier':
        openSupplierModal();
        break;
      case 'edit-supplier':
        if (id) openSupplierModal(id);
        break;
      case 'archive-supplier': {
        var supplierRecord = S.supplier(id);
        if (!supplierRecord) { toast('Fournisseur introuvable dans le dossier actif.', 'error'); break; }
        var activateSupplier = supplierRecord.active === false;
        var confirmation = activateSupplier
          ? 'Réactiver le fournisseur « ' + supplierRecord.name + ' » ?'
          : 'Archiver le fournisseur « ' + supplierRecord.name + ' » ? Il restera conservé et ses écritures historiques ne seront pas modifiées.';
        if (!window.confirm(confirmation)) break;
        var supplierState = S.setSupplierActive(id, activateSupplier);
        if (!supplierState.ok) { toast(supplierState.errors[0] || 'Changement d’état impossible.', 'error'); break; }
        toast(activateSupplier ? 'Fournisseur réactivé.' : 'Fournisseur archivé.', 'success');
        render();
        break;
      }
      case 'delete-supplier': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'suppliers.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « suppliers.delete » n’est pas accordé.', 'warning');
          break;
        }
        var supplierToDelete = S.supplier(id);
        if (!supplierToDelete) { toast('Fournisseur introuvable dans le dossier actif.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement la fiche « ' + supplierToDelete.name + ' » ? Si vous souhaitez seulement la retirer des listes actives, choisissez « Archiver ».')) break;
        var supplierDeletion = S.deleteSupplier(id);
        if (!supplierDeletion.ok) { toast(supplierDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Fournisseur supprimé. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
      case 'new-client':
        openClientModal();
        break;
      case 'edit-client':
        if (id) openClientModal(id);
        break;
      case 'delete-client': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'clients.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « clients.delete » n’est pas accordé.', 'warning');
          break;
        }
        var clientToDelete = S.client(id);
        if (!clientToDelete) { toast('Client introuvable dans le dossier actif.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement la fiche client « ' + clientToDelete.name + ' » ? Le code ne sera pas réattribué.')) break;
        var clientDeletion = S.deleteClient(id);
        if (!clientDeletion.ok) { toast(clientDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Client supprimé. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
      case 'new-other-party':
        openOtherPartyModal();
        break;
      case 'edit-other-party':
        if (id) openOtherPartyModal(id);
        break;
      case 'delete-other-party': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'otherParties.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « otherParties.delete » n’est pas accordé.', 'warning');
          break;
        }
        var otherPartyToDelete = S.otherParty(id);
        if (!otherPartyToDelete) { toast('Débiteur ou créditeur divers introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement la fiche « ' + otherPartyToDelete.name + ' » ? Le code ne sera pas réattribué.')) break;
        var otherPartyDeletion = S.deleteOtherParty(id);
        if (!otherPartyDeletion.ok) { toast(otherPartyDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Fiche de tiers supprimée. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
      case 'new-personnel':
        openPersonnelModal();
        break;
      case 'edit-personnel':
        if (id) openPersonnelModal(id);
        break;
      case 'delete-personnel': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'personnel.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « personnel.delete » n’est pas accordé.', 'warning');
          break;
        }
        var personnelToDelete = S.personnelRecord(id);
        if (!personnelToDelete) { toast('Membre du personnel introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement la fiche de « ' + personnelToDelete.name + ' » ? Le code ne sera pas réattribué.')) break;
        var personnelDeletion = S.deletePersonnel(id);
        if (!personnelDeletion.ok) { toast(personnelDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Fiche du personnel supprimée. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
      case 'new-fixed-asset-location':
        openFixedAssetLocationModal();
        break;
      case 'edit-fixed-asset-location':
        if (id) openFixedAssetLocationModal(id);
        break;
      case 'delete-fixed-asset-location': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'fixedAssetLocations.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « fixedAssetLocations.delete » n’est pas accordé.', 'warning');
          break;
        }
        var locationToDelete = S.fixedAssetLocation(id);
        if (!locationToDelete) { toast('Emplacement d’immobilisation introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer l’emplacement « ' + locationToDelete.name + ' » ? La suppression sera refusée s’il possède des sous-emplacements ou référence une immobilisation.')) break;
        var locationDeletion = S.deleteFixedAssetLocation(id);
        if (!locationDeletion.ok) { toast(locationDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Emplacement supprimé. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
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
      case 'commit-accounting-payroll-centralization':
        commitAccountingPayrollCentralization();
        break;
      case 'commit-accounting-sales-centralization':
        commitAccountingSalesCentralization();
        break;
      case 'select-centralization-cancellation':
        selectCentralizationCancellation(id);
        break;
      case 'cancel-draft-centralization':
        cancelDraftCentralization(id);
        break;
      case 'commit-centralization-cancellation':
        commitCentralizationCancellation();
        break;
      case 'export-accounting-consolidation-before-result':
        exportAccountingConsolidationBeforeResult();
        break;
      case 'export-accounting-consolidation-after-result':
        exportAccountingConsolidationAfterResult();
        break;
      case 'recalculate-account-balances':
        recalculateAccountBalances();
        break;
      case 'analyze-accounting-database':
        render();
        break;
      case 'repair-accounting-database': {
        if (!window.confirm('Créer un point de restauration local puis réparer uniquement les périodes et métadonnées techniques ? Les comptes, journaux, montants et écritures ne seront pas modifiés.')) break;
        var repairResult = S.repairDatabase();
        if (!repairResult.ok) { toast(repairResult.errors[0] || 'Réparation impossible.', 'error'); break; }
        toast(repairResult.changed ? 'Réparation technique terminée. Le point de restauration a été conservé.' : 'Aucune réparation technique nécessaire.', 'success');
        render();
        break;
      }
      case 'restore-database-backup': {
        if (!window.confirm('Restaurer le dernier point de restauration valide du dossier actif ? Les données actuelles seront remplacées ; une copie brute sera conservée si la base est illisible.')) break;
        var databaseBackup = S.restoreBackup();
        if (!databaseBackup.ok) { toast(databaseBackup.errors[0] || 'Restauration impossible.', 'error'); break; }
        toast('Point de restauration restauré. Les écritures validées du point choisi sont intactes.', 'success');
        render();
        break;
      }
      case 'export-corrupt-database': {
        var rawDatabase = S.corruptDatabaseContents();
        if (rawDatabase == null) { toast('Aucune donnée brute de récupération n’est disponible.', 'warning'); break; }
        downloadFile('perfecto-' + safeFilePart(S.currentDossier().reference) + '-base-brute-recovery.json', rawDatabase, 'application/json;charset=utf-8');
        toast('Copie brute de récupération téléchargée sans modification.', 'success');
        break;
      }
      case 'reinitialize-corrupt-database': {
        if (!window.confirm('Créer une nouvelle base de démonstration pour ce dossier ? Le contenu ou les métadonnées d’origine seront d’abord copiés dans l’espace de récupération local. Cette action ne tente pas de réparer les écritures.')) break;
        var initializedDatabase = S.reinitializeCorruptDatabase();
        if (!initializedDatabase.ok) { toast(initializedDatabase.errors[0] || 'Réinitialisation impossible.', 'error'); break; }
        toast('Nouvelle base créée. La copie brute précédente est conservée dans l’espace de récupération local.', 'success');
        render();
        break;
      }
      case 'export-recalculated-account-balances':
        exportRecalculatedAccountBalances();
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
        var chartDossier = S.currentDossier();
        downloadFile('perfecto-' + safeFilePart(chartDossier.reference) + '-plan-comptable.csv', AccountingExchange.exportAccounts(S.accounts()), 'text/csv;charset=utf-8');
        toast('Plan comptable complet exporté avec classes, sous-classes et utilisations.', 'success');
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

  function openSupplierModal(id) {
    var existing = id ? S.supplier(id) : null;
    if (id && !existing) { toast('Fournisseur introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var supplierRoots = ['401', '402', '404', '408', '409'];
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return supplierRoots.some(function (rootCode) { return code.indexOf(rootCode) === 0; }) &&
        Number(account.cls || code.charAt(0)) === 4 && account.aux === true &&
        account.active !== false && account.postable !== false;
    }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!accounts.length) {
      toast('Aucun compte auxiliaire fournisseur actif de classe 4 n’est disponible dans ce dossier.', 'warning');
      return;
    }
    var defaultAccount = accounts.find(function (account) { return account.code === '401'; }) || accounts[0];
    var selectedAccount = existing && accounts.some(function (account) { return account.code === existing.accountCode; })
      ? existing.accountCode : defaultAccount.code;
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (account.code === selectedAccount ? ' selected' : '') + '>' +
        esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var suggestedSupplierCode = existing ? existing.code : S.nextIdentificationCode('supplier');
    var value = function (key) {
      var raw = existing && existing[key] != null ? existing[key] : (key === 'code' ? suggestedSupplierCode : '');
      return esc(raw);
    };
    var body = '<form id="supplier-form" novalidate data-supplier-id="' + esc(existing && existing.id || '') + '">' +
      '<div id="supplier-errors" aria-live="assertive"></div>' +
      '<div class="form-grid supplier-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="supplier-code">Code fournisseur <span aria-hidden="true">*</span></label>' +
          '<input id="supplier-code" name="code" type="text" maxlength="32" placeholder="Ex. FOU-0001" value="' + value('code') + '" required autocomplete="off"><span class="hint">Proposition automatique ' + (existing ? 'conservée' : 'modifiable') + ' ; code unique dans ce dossier.</span></div>' +
        '<div class="field"><label for="supplier-name">Raison sociale <span aria-hidden="true">*</span></label>' +
          '<input id="supplier-name" name="name" type="text" maxlength="150" placeholder="Ex. Société béninoise de fournitures" value="' + value('name') + '" required></div>' +
        '<div class="field"><label for="supplier-ifu">Numéro IFU</label><input id="supplier-ifu" name="ifu" type="text" maxlength="50" value="' + value('ifu') + '"></div>' +
        '<div class="field"><label for="supplier-rccm">Numéro RCCM</label><input id="supplier-rccm" name="rccm" type="text" maxlength="80" value="' + value('rccm') + '"></div>' +
        '<div class="field"><label for="supplier-contact">Nom du contact</label><input id="supplier-contact" name="contactName" type="text" maxlength="120" value="' + value('contactName') + '"></div>' +
        '<div class="field"><label for="supplier-email">Adresse e-mail</label><input id="supplier-email" name="email" type="email" maxlength="254" value="' + value('email') + '"></div>' +
        '<div class="field"><label for="supplier-phone">Téléphone</label><input id="supplier-phone" name="phone" type="tel" maxlength="40" value="' + value('phone') + '"></div>' +
        '<div class="field"><label for="supplier-account">Compte général de rattachement <span aria-hidden="true">*</span></label><select id="supplier-account" name="accountCode" required>' + accountOptions + '</select><span class="hint">Le compte auxiliaire individuel associe ce compte au code fournisseur (ex. 401-FOUR-001) ; aucune écriture n’est générée.</span></div>' +
        '<div class="field"><label for="supplier-terms">Délai indicatif de règlement (jours)</label><input id="supplier-terms" name="paymentTermDays" type="number" min="0" max="3650" step="1" value="' + esc(existing ? existing.paymentTermDays : 30) + '"></div>' +
        '<div class="field supplier-address-field"><label for="supplier-address">Adresse</label><input id="supplier-address" name="address" type="text" maxlength="255" value="' + value('address') + '"></div>' +
        '<div class="field supplier-notes-field"><label for="supplier-notes">Notes internes</label><textarea id="supplier-notes" name="notes" rows="3" maxlength="1000">' + value('notes') + '</textarea></div>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="supplier-form" data-action="save-supplier" data-supplier-mode="' + mode + '">' +
        (existing ? 'Enregistrer les modifications' : 'Créer le fournisseur') + '</button>';
    openModal(existing ? 'Modifier le fournisseur' : 'Nouveau fournisseur',
      existing ? 'Fiche du dossier ' + esc(S.currentDossier().reference) : 'Création d’une fiche dans le dossier ' + esc(S.currentDossier().reference),
      body, footer, true);

    var form = $('#supplier-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'suppliers.edit' : 'suppliers.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var supplierInput = {
        code: $('#supplier-code').value,
        name: $('#supplier-name').value,
        ifu: $('#supplier-ifu').value,
        rccm: $('#supplier-rccm').value,
        contactName: $('#supplier-contact').value,
        email: $('#supplier-email').value,
        phone: $('#supplier-phone').value,
        accountCode: $('#supplier-account').value,
        paymentTermDays: $('#supplier-terms').value,
        address: $('#supplier-address').value,
        notes: $('#supplier-notes').value
      };
      var result = existing ? S.updateSupplier(existing.id, supplierInput) : S.createSupplier(supplierInput);
      if (!result.ok) {
        $('#supplier-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche fournisseur mise à jour.' : 'Fournisseur ' + result.supplier.code + ' créé.', 'success');
      closeModal(true);
      render();
    });
  }

  function openAccountModal(code) {
    var existing = code ? S.account(code) : null;
    if (code && !existing) { toast('Compte introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var codeCheck = existing ? S.accountCodeChangeCheck(existing.code) : { ok: true, errors: [] };
    var natureOptions = ['Actif', 'Passif', 'Charge', 'Produit', 'SIG', 'Hors bilan'].map(function (nature) {
      var selected = existing ? existing.nature === nature : nature === 'Actif';
      return '<option value="' + esc(nature) + '"' + (selected ? ' selected' : '') + '>' + esc(nature) + '</option>';
    }).join('');
    var codeHint = existing && !codeCheck.ok
      ? '<span class="hint">Numéro verrouillé pour préserver les références : ' + esc(codeCheck.errors.join(' ')) + '</span>'
      : '<span class="hint">2 à 8 chiffres, classe SYSCOHADA de 1 à 8 en premier.</span>';
    var codeValue = existing ? esc(existing.code) : '';
    var labelValue = existing ? esc(existing.label || '') : '';
    var usageValue = existing ? esc(existing.usage || '') : '';
    var body = '<form id="account-form" novalidate>' +
      '<div id="account-errors" aria-live="assertive"></div>' +
      '<div class="form-grid account-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="a-code">Numéro de compte</label>' +
          '<input id="a-code" name="code" type="text" inputmode="numeric" pattern="[1-8][0-9]{1,7}" maxlength="8" placeholder="Ex. 6012" value="' + codeValue + '"' + (existing && !codeCheck.ok ? ' readonly' : '') + ' required>' +
          codeHint + '</div>' +
        '<div class="field"><label for="a-label">Intitulé</label>' +
          '<input id="a-label" name="label" type="text" maxlength="150" placeholder="Ex. Achats de matières premières" value="' + labelValue + '" required></div>' +
        '<div class="field"><label for="a-nature">Nature comptable</label><select id="a-nature" name="nature">' + natureOptions + '</select></div>' +
        '<div class="field"><label for="a-aux">Compte auxiliaire requis</label>' +
          '<select id="a-aux" name="aux"><option value="no"' + (!existing || !existing.aux ? ' selected' : '') + '>Non</option><option value="yes"' + (existing && existing.aux ? ' selected' : '') + '>Oui</option></select></div>' +
        '<div class="field" style="grid-column:1 / -1"><label for="a-usage">Nature / utilisation</label>' +
          '<textarea id="a-usage" name="usage" rows="3" maxlength="1000" placeholder="Rôle ou utilisation du compte dans le dossier">' + usageValue + '</textarea></div>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="account-form" data-action="save-account" data-account-mode="' + mode + '">' +
        (existing ? 'Enregistrer les modifications' : 'Créer le compte') + '</button>';
    openModal(existing ? 'Modifier le compte comptable' : 'Nouveau compte comptable',
      existing ? 'Modification du compte local ' + esc(existing.code) : 'Ajout au plan comptable local', body, footer, true);

    var form = $('#account-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'accounts.edit' : 'accounts.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var accountInput = {
        code: $('#a-code').value,
        label: $('#a-label').value,
        nature: $('#a-nature').value,
        usage: $('#a-usage').value,
        aux: $('#a-aux').value === 'yes'
      };
      var result = existing ? S.updateAccount(existing.code, accountInput) : S.addAccount(accountInput);
      if (!result.ok) {
        $('#account-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Compte ' + result.account.code + ' mis à jour.' : 'Compte ' + result.account.code + ' créé.', 'success');
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
