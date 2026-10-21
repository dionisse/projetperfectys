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
  var AccountingFramework = window.PerfectoAccountingFramework;
  var CashOperations = window.PerfectoCashOperations;
  var AccountMovements = window.PerfectoAccountMovements;
  var AccountingExchange = window.PerfectoAccountingExchange;
  var FecImport = window.PerfectoFecImport;
  var BankStatement = window.PerfectoBankStatement;
  var BankStatementStorage = window.PerfectoBankStatementStorage;
  var AccountingConsolidation = window.PerfectoAccountingConsolidation;
  var BalanceRecalculation = window.PerfectoBalanceRecalculation;
  var PayrollHR = window.PerfectoPayrollHR;
  var PayrollCentralization = window.PerfectoPayrollCentralization;
  var SalesOperations = window.PerfectoSalesOperations;
  var SalesCentralization = window.PerfectoSalesCentralization;
  var CentralizationCancellation = window.PerfectoCentralizationCancellation;
  var FixedAssetDepreciation = window.PerfectoFixedAssetDepreciation;
  var OpeningBalances = window.PerfectoOpeningBalances;

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
    journals: ['Journaux comptables', 'Référentiel et paramètres du dossier'],
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
    accountMovements: { q: '', kind: 'all', nodeId: '', month: '' },
    matching: { q: '', account: '', status: 'unmatched', selectedLineKeys: [] },
    pointage: { q: '', account: '', status: 'all', month: 'all', statementDate: '', statementId: '', dateToleranceDays: '7' },
    thirdPartyMovements: { q: '', kind: 'all', recordId: '', month: '' },
    analyticalCenters: { q: '', status: 'active' },
    openingBalances: { q: '', position: '', sourceDossierId: '', selectedId: '' },
    periods: { year: S.exercise() },
    suppliers: { q: '', status: 'active' },
    clients: { q: '' },
    otherParties: { q: '', type: 'all' },
    personnel: { q: '' },
    fixedAssets: { q: '', status: 'all', assetType: 'all' },
    financialFramework: { q: '' }
  };

  var selectedEntryJournalCode = '';
  var analyticalNatureSelectedId = 'activity-domains';
  var fixedAssetAccountsSelectedId = 'fixed-assets-class-21';
  var fixedAssetAccountsSelectedDossierId = '';
  var fixedAssetAccountsEditDraft = null;
  var fixedAssetAccountsEditDossierId = '';
  var orderAccountsSelectedId = 'orders-realization-ht';
  var orderAccountsSelectedDossierId = '';
  var orderNaturesSelectedId = 'order-nature-1';
  var orderNaturesSelectedDossierId = '';
  var accountControlsSelectedField = 'payableAccounts';
  var accountControlsSelectedDossierId = '';
  var generalAccountNatureSelectedId = 'stable-grants';
  var deferredInstallPrompt = null;
  var exchangeImportSession = null;
  var fecImportSession = null;
  var fecImportReversalSession = null;
  var fecImportReadSequence = 0;
  var bankStatementImportSession = null;
  var bankStatementRecords = [];
  var bankStatementRecordsDossierId = '';
  var bankStatementLoadingDossierId = '';
  var bankStatementLoadError = '';
  var bankStatementLoadPending = false;
  var bankStatementLoadSequence = 0;
  var balanceImportSession = null;
  var payrollCentralizationSession = null;
  var salesCentralizationSession = null;
  var centralizationCancellationSession = null;
  var consolidationBeforeResultSession = null;
  var consolidationAfterResultSession = null;
  var balanceRecalculationSession = null;
  var openingBalanceTransferSession = null;
  var openingBalanceAuditResult = null;
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

  function accountingMenuHash(groupId, tabId, childId) {
    var group = AccountingNavigation.getGroup(groupId);
    var tab = AccountingNavigation.getTab(group.id, tabId || group.defaultTab);
    var hash = '#/menu?g=' + encodeURIComponent(group.id) + '&t=' + encodeURIComponent(tab.id);
    return childId ? hash + '&c=' + encodeURIComponent(childId) : hash;
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
      case 'toggle-matching-line':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'assign-letter':
        return { moduleId: 'accounting', actionId: 'matching.assign' };
      case 'cancel-letter':
        return { moduleId: 'accounting', actionId: 'matching.cancel' };
      case 'point-entry-line':
        return { moduleId: 'accounting', actionId: 'pointage.mark' };
      case 'unpoint-entry-line':
        return { moduleId: 'accounting', actionId: 'pointage.unmark' };
      case 'choose-bank-statement-file':
      case 'confirm-bank-statement-import':
        return { moduleId: 'accounting', actionId: 'pointage.statement.import' };
      case 'confirm-bank-statement-match':
        return { moduleId: 'accounting', actionId: 'pointage.statement.match' };
      case 'select-bank-statement-page':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'download-bank-statement':
        return { moduleId: 'accounting', actionId: 'data.export' };
      case 'select-account-movement-node':
      case 'select-account-movement-month':
      case 'select-third-party-movement-month':
      case 'open-account-movement-month-detail':
      case 'open-account-movement-cycle-detail':
      case 'select-third-party-movement-record':
      case 'open-third-party-collective-month-detail':
      case 'open-third-party-collective-cycle-detail':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'open-entry':
      case 'select-entry-journal':
      case 'open-entry-journal-consultation':
      case 'open-entry-journal-close':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'open-entry-journal':
        return { moduleId: 'accounting', actionId: 'draft.create' };
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
      case 'new-journal':
        return { moduleId: 'accounting', actionId: 'journals.create' };
      case 'edit-journal':
        return { moduleId: 'accounting', actionId: 'journals.edit' };
      case 'delete-journal':
        return { moduleId: 'accounting', actionId: 'journals.delete' };
      case 'save-journal':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-journal-mode') === 'edit' ? 'journals.edit' : 'journals.create'
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
      case 'new-service':
        return { moduleId: 'accounting', actionId: 'services.create' };
      case 'edit-service':
        return { moduleId: 'accounting', actionId: 'services.edit' };
      case 'archive-service':
        return { moduleId: 'accounting', actionId: 'services.archive' };
      case 'delete-service':
        return { moduleId: 'accounting', actionId: 'services.delete' };
      case 'save-service':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-service-mode') === 'edit' ? 'services.edit' : 'services.create'
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
      case 'new-analytical-center':
        return { moduleId: 'accounting', actionId: 'analyticalCenters.create' };
      case 'edit-analytical-center':
        return { moduleId: 'accounting', actionId: 'analyticalCenters.edit' };
      case 'archive-analytical-center':
        return { moduleId: 'accounting', actionId: 'analyticalCenters.archive' };
      case 'delete-analytical-center':
        return { moduleId: 'accounting', actionId: 'analyticalCenters.delete' };
      case 'save-analytical-center':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-analytical-center-mode') === 'edit' ? 'analyticalCenters.edit' : 'analyticalCenters.create'
        };
      case 'preview-fixed-asset-depreciation':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'new-opening-balance':
        return { moduleId: 'accounting', actionId: 'openingBalances.create' };
      case 'edit-opening-balance':
        return { moduleId: 'accounting', actionId: 'openingBalances.edit' };
      case 'delete-opening-balance':
        return { moduleId: 'accounting', actionId: 'openingBalances.delete' };
      case 'save-opening-balance':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-opening-balance-mode') === 'edit' ? 'openingBalances.edit' : 'openingBalances.create'
        };
      case 'read-opening-balance-source':
      case 'apply-opening-balance-transfer':
        return { moduleId: 'accounting', actionId: 'openingBalances.transfer' };
      case 'print-opening-balances':
        return { moduleId: 'accounting', actionId: 'openingBalances.print' };
      case 'audit-opening-balances':
      case 'select-opening-balance':
      case 'position-opening-balance':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'new-fixed-asset':
        return { moduleId: 'accounting', actionId: 'fixedAssets.create' };
      case 'edit-fixed-asset':
        return { moduleId: 'accounting', actionId: 'fixedAssets.edit' };
      case 'delete-fixed-asset':
        return { moduleId: 'accounting', actionId: 'fixedAssets.delete' };
      case 'save-fixed-asset':
        return {
          moduleId: 'accounting',
          actionId: trigger && trigger.getAttribute('data-fixed-asset-mode') === 'edit' ? 'fixedAssets.edit' : 'fixedAssets.create'
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
      case 'commit-accounting-fec-import':
        return { moduleId: 'accounting', actionId: 'data.import' };
      case 'cancel-fec-import-batch':
        return { moduleId: 'accounting', actionId: 'draft.delete' };
      case 'open-fec-import-reversal':
        return { moduleId: 'accounting', actionId: 'module.view' };
      case 'commit-fec-import-reversal':
        return { moduleId: 'accounting', actionId: 'data.import' };
      case 'download-fec-source':
        return { moduleId: 'accounting', actionId: 'data.export' };
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
    var fecImportInput = $('#fec-import-file', root);
    if (fecImportInput) {
      var canImportFec = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
      fecImportInput.hidden = !canImportFec;
      var fecImportLabel = $('#fec-import-label', root);
      if (fecImportLabel) fecImportLabel.hidden = !canImportFec;
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
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'import-fec')) {
      fecImportSession = null;
      fecImportReversalSession = null;
      fecImportReadSequence += 1;
    }
    if (!(route === 'menu' && parsed.params.g === 'saisie' && parsed.params.t === 'reconciliation')) bankStatementImportSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'centralize-payroll')) payrollCentralizationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'centralize-sales')) salesCentralizationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'cancel-centralization')) centralizationCancellationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'consolidate-before-result')) consolidationBeforeResultSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'consolidate-after-result')) consolidationAfterResultSession = null;
    if (!(route === 'menu' && parsed.params.g === 'fichier' && parsed.params.t === 'recalculate-balances')) balanceRecalculationSession = null;
    if (!(route === 'menu' && parsed.params.g === 'saisie' && parsed.params.t === 'opening-balances')) openingBalanceTransferSession = null;

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

  function accountOptions(selected, journalCode) {
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
    var availableAccounts = postingAccounts().filter(function (account) {
      return !journalCode || S.journalAllowsAccount(journalCode, account.code);
    });
    var selectedAccount = selected ? S.account(selected) : null;
    var selectedIsAvailable = availableAccounts.some(function (account) { return String(account.code) === String(selected); });
    var html = '<option value="">— Choisir un compte —</option>';
    Object.keys(groups).forEach(function (cls) {
      var opts = availableAccounts.filter(function (account) { return account.cls === Number(cls); }).map(function (account) {
        var historical = account.legacy ? ' · historique' : '';
        return '<option value="' + esc(account.code) + '"' + (String(account.code) === String(selected) ? ' selected' : '') + '>' +
          esc(account.code + ' — ' + account.label + historical) + '</option>';
      }).join('');
      if (opts) html += '<optgroup label="' + groups[cls] + '">' + opts + '</optgroup>';
    });
    if (journalCode && selectedAccount && !selectedIsAvailable) {
      var selectionIssue = !S.journalAllowsAccount(journalCode, selectedAccount.code)
        ? 'non autorisé'
        : (selectedAccount.active === false ? 'inactif' : 'non imputable');
      html += '<optgroup label="À corriger — compte ' + selectionIssue + '"><option value="' + esc(selectedAccount.code) + '" selected>' +
        esc(selectedAccount.code + ' — ' + selectedAccount.label + ' · ' + selectionIssue) + '</option></optgroup>';
    }
    return html;
  }

  function journalDisplayName(record) {
    if (!record) return '';
    var code = String(record.code || '').trim();
    var label = String(record.label || code).trim();
    if (!code) return label;
    var suffix = ' (' + code + ')';
    if (label.slice(-suffix.length).toLocaleUpperCase() === suffix.toLocaleUpperCase()) return label;
    return label + suffix;
  }

  function isFillableJournal(record) {
    return !!record && record.active !== false && !record.systemManaged && !record.retired;
  }

  function journalOptions(selected, includeAll, includeSystem, includeInactive) {
    var html = includeAll ? '<option value="">Tous les journaux</option>' : '<option value="">— Choisir un journal —</option>';
    html += S.journals().filter(function (record) {
      if (!includeSystem && record.systemManaged) return false;
      if (!includeInactive && record.active === false && record.code !== selected) return false;
      return true;
    }).map(function (record) {
      var stateLabel = record.active === false ? ' · inactif' : '';
      var systemLabel = record.systemManaged ? ' · système' : '';
      return '<option value="' + esc(record.code) + '"' + (record.code === selected ? ' selected' : '') + '>' +
        esc(journalDisplayName(record) + stateLabel + systemLabel) + '</option>';
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
          return '<tr><td><span class="muted">' + esc(journalDisplayName(s.journal)) + '</span></td>' +
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
    var managementAllowed = !isPhoneViewport();
    var standardCount = stats.filter(function (item) { return item.journal.isStandard; }).length;
    var systemCount = stats.filter(function (item) { return item.journal.systemManaged; }).length;
    var userCount = stats.filter(function (item) { return !item.journal.isStandard && !item.journal.systemManaged && !item.journal.retired; }).length;
    var headerActions = managementAllowed
      ? '<button type="button" class="btn btn-primary" data-action="new-journal">＋ Créer un journal</button><a class="btn btn-ghost" href="#/entry">＋ Nouvelle écriture</a>'
      : '<a class="btn btn-ghost" href="#/menu?g=editions&amp;t=journals">Consulter les écritures</a>';
    var html = pageHeader('Journaux comptables', managementAllowed
      ? 'Créez et paramétrez autant de journaux que nécessaire pour ce dossier.'
      : 'Consultation seule sur téléphone ; la gestion des journaux se fait sur ordinateur ou tablette.', headerActions);

    html += '<div class="journal-summary" aria-label="Répartition des journaux">' +
      '<div><strong>' + standardCount + '</strong><span>journaux standards</span></div>' +
      '<div><strong>' + userCount + '</strong><span>journaux créés dans ce dossier</span></div>' +
      '<div><strong>' + systemCount + '</strong><span>journaux réservés au système</span></div>' +
      '<div><strong>' + stats.length + '</strong><span>journaux au total</span></div>' +
    '</div>' +
    (managementAllowed ? '' : '<div class="alert info">La création, la modification et la saisie sont masquées sur téléphone. Utilisez le menu Éditions pour consulter les écritures.</div>') +
    '<div class="alert info journal-system-note"><strong>Journaux système protégés.</strong> <code>AMO</code> (amortissements automatiques) et <code>RPE</code> (résultat de la période) restent réservés aux traitements système. <code>ABO</code> (abonnements) et <code>CEN</code> (centralisations) sont des journaux standards dédiés : leurs traitements spécifiques sont à construire. La centralisation de lots internes Paie &amp; RH et Ventes vers <code>Paie (PA)</code> et <code>Ventes (VTE)</code> reste distincte du futur transfert entre dossiers. La simulation d’amortissement demeure indicative et ne comptabilise rien.</div>' +
    '<div class="journal-grid">' + stats.map(function (item) {
      var record = item.journal;
      var systemManaged = !!record.systemManaged;
      var kind = record.retired ? 'Historique retiré' : (systemManaged ? 'Automatique · système' : (record.isStandard ? 'Standard modifiable' : 'Créé par l’utilisateur'));
      var activeLabel = record.active === false ? 'Inactif' : 'Actif';
      var references = record.referencePrefix || record.code;
      var count = S.journalEntryCount(record.id);
      var actions = '<a class="btn btn-ghost btn-sm" href="#/journal?journal=' + encodeURIComponent(record.code) + '">Voir le journal</a>';
      if (managementAllowed && !systemManaged && !record.retired) {
        actions += '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-journal" data-id="' + esc(record.code) + '">Paramètres</button>';
      }
      if (managementAllowed && !systemManaged && !record.retired && !record.isStandard) {
        actions += '<button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="delete-journal" data-id="' + esc(record.code) + '"' + (count ? ' disabled title="Ce journal contient des écritures : il peut être désactivé, mais pas supprimé."' : '') + '>Supprimer</button>';
      }
      return '<article class="journal-card' + (systemManaged ? ' system-managed' : '') + (record.retired ? ' journal-retired' : '') + (record.active === false ? ' journal-inactive' : '') + '">' +
        '<div class="journal-head"><div><h3>' + esc(journalDisplayName(record)) + '</h3><span class="journal-meta">Type : ' + esc(record.type) + '</span></div></div>' +
        '<div class="journal-tags"><span class="badge plain">' + esc(kind) + '</span><span class="badge ' + (record.active === false ? 'draft' : 'posted') + '">' + activeLabel + '</span></div>' +
        '<dl>' +
          '<dt>Préfixe des références</dt><dd>' + esc(references) + '-AAAA-001</dd>' +
          '<dt>Nature des opérations</dt><dd>' + esc(record.operationNature || '—') + '</dd>' +
          '<dt>Comptes autorisés</dt><dd class="journal-account-list">' + esc(record.authorizedAccounts === '*' ? 'Tous les comptes' : (Array.isArray(record.authorizedAccounts) ? record.authorizedAccounts.join(', ') : 'Tous les comptes')) + '</dd>' +
          '<dt>Pièces sur le cycle</dt><dd>' + item.count + '</dd>' +
          '<dt>Validées / brouillons</dt><dd>' + item.posted + ' / ' + item.drafts + '</dd>' +
          '<dt>Total débit</dt><dd>' + amount(item.debit) + ' XOF</dd>' +
          '<dt>Total crédit</dt><dd>' + amount(item.credit) + ' XOF</dd>' +
        '</dl>' +
        (record.description ? '<p class="journal-description">' + esc(record.description) + '</p>' : '') +
        '<div class="journal-actions">' + actions + '</div>' +
      '</article>';
    }).join('') + '</div>';

    return html;
  }

  /* --------------------------- Saisie d'écriture --------------------------- */
  function viewEntryJournalSelector() {
    var dossier = S.currentDossier();
    var referenceDate = S.todayIso();
    if (referenceDate < dossier.cycleStart || referenceDate > dossier.cycleEnd) referenceDate = dossier.cycleStart;
    var dateParts = referenceDate.split('-');
    var periodStatus = S.periodStatus(Number(dateParts[0]), Number(dateParts[1]));
    var periodClosed = periodStatus === 'closed';
    var periodLabel = dateParts[1] + '/' + dateParts[0];
    var stats = S.journalStats();
    var draftsByJournal = Object.create(null);
    var canCreateEntries = hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.create', accountingAccessContext(dossier));

    S.entries().forEach(function (entry) {
      if (entry.status !== 'draft' || entry.date < dossier.cycleStart || entry.date > dossier.cycleEnd) return;
      var journal = S.journal(entry.journal);
      var code = journal ? journal.code : String(entry.journal || '');
      if (!draftsByJournal[code]) draftsByJournal[code] = [];
      draftsByJournal[code].push(entry);
    });
    Object.keys(draftsByJournal).forEach(function (code) {
      draftsByJournal[code].sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || '')) || String(b.reference || '').localeCompare(String(a.reference || ''));
      });
    });

    var selectedItem = stats.find(function (item) { return item.journal.code === selectedEntryJournalCode; });
    if (!selectedItem) selectedItem = stats.find(function (item) { return isFillableJournal(item.journal); }) || stats[0] || null;
    selectedEntryJournalCode = selectedItem ? selectedItem.journal.code : '';
    var selectedRecord = selectedItem && selectedItem.journal;
    var selectedIsFillable = isFillableJournal(selectedRecord);
    var selectedCanOpen = selectedIsFillable && canCreateEntries;

    var rows = stats.map(function (item) {
      var record = item.journal;
      var drafts = draftsByJournal[record.code] || [];
      var fillable = isFillableJournal(record);
      var statusText = record.retired
        ? 'Historique retiré · consultation uniquement'
        : (record.systemManaged
          ? 'Automatique · réservé au système'
          : (record.active === false
            ? 'Inactif · consultation uniquement'
            : (canCreateEntries ? 'Saisie disponible' : 'Consultation · droit de saisie absent')));
      var draftCell = drafts.length
        ? '<div class="entry-journal-draft"><span class="badge draft">' + drafts.length + ' brouillon' + (drafts.length > 1 ? 's' : '') + '</span><small>' + esc(drafts[0].reference || 'Référence non disponible') + (drafts.length > 1 ? ' · et ' + (drafts.length - 1) + ' autre(s)' : '') + '</small></div>'
        : '<span class="muted">Aucune</span>';
      var rowClasses = 'clickable entry-journal-row' + (record.code === selectedEntryJournalCode ? ' is-selected' : '') + (!fillable || !canCreateEntries ? ' is-readonly' : '');
      var rowLabel = journalDisplayName(record) + ' · ' + item.count + ' pièce(s) · ' + (fillable && canCreateEntries ? 'saisie disponible' : 'consultation uniquement');
      return '<tr class="' + rowClasses + '" data-action="select-entry-journal" data-entry-journal-row data-id="' + esc(record.code) + '" data-fillable="' + (fillable ? 'true' : 'false') + '" data-search="' + esc((record.code + ' ' + record.label).toLocaleLowerCase()) + '" tabindex="0" aria-selected="' + (record.code === selectedEntryJournalCode ? 'true' : 'false') + '" aria-label="' + esc(rowLabel) + '">' +
        '<td><span class="code-chip">' + esc(record.code) + '</span></td>' +
        '<td><strong>' + esc(record.label) + '</strong><br><small class="entry-journal-state">' + esc(statusText) + '</small></td>' +
        '<td class="num">' + item.count + '</td>' +
        '<td class="num">' + amount(item.debit) + '</td>' +
        '<td class="num">' + amount(item.credit) + '</td>' +
        '<td>' + draftCell + '</td>' +
        '<td><span class="badge ' + (periodClosed ? 'closed' : 'open') + '">' + (periodClosed ? 'Clôturée' : 'Ouverte') + '</span></td>' +
      '</tr>';
    }).join('');

    var html = '<div class="entry-journal-selector"><div class="alert info entry-journal-instructions"><div><strong>Double-cliquez sur un journal saisissable.</strong> Les journaux système, retirés et inactifs restent visibles pour consultation, mais ne peuvent pas recevoir de nouvelle pièce. Les débits et crédits ci-dessous portent sur les pièces validées.</div></div>' +
      '<section class="card entry-journal-card"><div class="table-wrap"><table id="entry-journal-table" class="data-table entry-journal-table"><caption>Dossier ' + esc(dossier.reference) + ' · cycle du ' + esc(dateLabel(dossier.cycleStart)) + ' au ' + esc(dateLabel(dossier.cycleEnd)) + ' · clôture de la période ' + esc(periodLabel) + '</caption>' +
        '<thead><tr><th scope="col">Journal</th><th scope="col">Intitulé</th><th scope="col" class="num">Pièces</th><th scope="col" class="num">Débits (XOF)</th><th scope="col" class="num">Crédits (XOF)</th><th scope="col">Pièce en cours</th><th scope="col">Clôture</th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="7"><div class="empty-state"><strong>Aucun journal disponible</strong>Créez ou restaurez un journal avant de saisir une pièce.</div></td></tr>') +
        '</tbody></table></div>' +
      '<div class="entry-journal-toolbar">' +
        '<div class="entry-journal-position"><label for="entry-journal-position">Positionner</label><input id="entry-journal-position" type="text" maxlength="80" placeholder="Code ou intitulé" aria-label="Positionner sur un journal par code ou intitulé"><span class="sr-only">Saisissez un code ou un intitulé, puis appuyez sur Entrée.</span></div>' +
        '<div id="entry-journal-selection-status" class="entry-journal-selection" role="status" aria-live="polite">Journal sélectionné : <strong id="entry-journal-selected-name">' + esc(selectedRecord ? journalDisplayName(selectedRecord) : 'Aucun journal') + '</strong></div>' +
        '<div class="entry-journal-actions">' +
          '<button type="button" class="btn btn-ghost" data-action="open-entry-journal-close">Clôture</button>' +
          '<button type="button" class="btn btn-primary" id="entry-journal-open" data-action="open-entry-journal"' + (selectedCanOpen ? '' : ' disabled') + '>Saisies des écritures</button>' +
          '<button type="button" class="btn btn-ghost" id="entry-journal-consult" data-action="open-entry-journal-consultation"' + (selectedRecord ? '' : ' disabled') + '>Consultation</button>' +
          '<a class="btn btn-ghost" href="#/dashboard">Fermer</a>' +
        '</div>' +
      '</div>' +
      (!canCreateEntries ? '<p class="entry-journal-permission-note small muted">Ce profil peut consulter les journaux, mais le droit de création de brouillon n’est pas accordé.</p>' : '') +
      '</section></div>';
    return html;
  }

  function selectEntryJournal(code) {
    var record = S.journal(code);
    if (!record) return;
    selectedEntryJournalCode = record.code;
    $$('[data-entry-journal-row]').forEach(function (row) {
      var selected = row.getAttribute('data-id') === selectedEntryJournalCode;
      row.classList.toggle('is-selected', selected);
      row.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    var selectedName = $('#entry-journal-selected-name');
    if (selectedName) selectedName.textContent = journalDisplayName(record);
    var canCreate = isFillableJournal(record) && hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.create', accountingAccessContext());
    var entryButton = $('#entry-journal-open');
    if (entryButton) {
      entryButton.disabled = !canCreate;
      entryButton.title = canCreate ? 'Ouvrir la saisie dans ' + journalDisplayName(record) : 'Ce journal ne peut pas recevoir de nouvelle pièce.';
    }
    var consultationButton = $('#entry-journal-consult');
    if (consultationButton) consultationButton.disabled = false;
  }

  function openEntryForJournal(code) {
    var record = S.journal(code);
    if (!isFillableJournal(record)) {
      toast(record ? journalDisplayName(record) + ' est réservé à la consultation.' : 'Journal introuvable dans ce dossier.', 'warning');
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.create', accountingAccessContext())) {
      toast('Ce profil ne possède pas le droit de créer un brouillon comptable.', 'warning');
      return;
    }
    navigate('#/entry?journal=' + encodeURIComponent(record.code) + '&from=journal-list');
  }

  function positionEntryJournal(query) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    if (!needle) return;
    var rows = $$('[data-entry-journal-row]');
    var match = rows.find(function (row) { return String(row.getAttribute('data-search') || '') === needle; }) ||
      rows.find(function (row) { return String(row.getAttribute('data-search') || '').indexOf(needle) !== -1; });
    if (!match) {
      toast('Aucun journal ne correspond à « ' + String(query).trim() + ' ».', 'warning');
      return;
    }
    selectEntryJournal(match.getAttribute('data-id'));
    if (typeof match.scrollIntoView === 'function') match.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    match.focus();
  }

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
    var entryAllowedUntil = dossier.accountingConfiguration && dossier.accountingConfiguration.entryAllowedUntil || dossier.cycleEnd;
    var latestEntryDate = entryAllowedUntil < dossier.cycleEnd ? entryAllowedUntil : dossier.cycleEnd;
    var date = today >= dossier.cycleStart && today <= latestEntryDate ? today : (today > latestEntryDate ? latestEntryDate : dossier.cycleStart);
    var requestedJournal = params && params.journal ? S.journal(params.journal) : null;
    var defaultJournal = isFillableJournal(requestedJournal) ? requestedJournal : S.journal('OD');
    if (!isFillableJournal(defaultJournal)) {
      defaultJournal = S.journals().find(isFillableJournal) || null;
    }
    var journal = defaultJournal ? defaultJournal.code : '';
    return {
      id: null,
      reference: journal ? S.nextReference(journal, date) : '',
      journal: journal,
      date: date,
      description: '',
      lines: [
        { account: '', debit: '', credit: '' },
        { account: '', debit: '', credit: '' }
      ]
    };
  }

  function lineRowHtml(line, journalCode) {
    var decimalPlaces = S.accountingConfiguration().decimalPlaces;
    var amountStep = decimalPlaces ? String(1 / Math.pow(10, decimalPlaces)) : '1';
    var amountInputMode = decimalPlaces ? 'decimal' : 'numeric';
    return '<div class="line-row">' +
      '<select data-field="account" aria-label="Compte de la ligne">' + accountOptions(line.account, journalCode) + '</select>' +
      '<input type="number" data-field="debit" min="0" step="' + amountStep + '" inputmode="' + amountInputMode + '" value="' + esc(line.debit) + '" placeholder="0" aria-label="Montant au débit">' +
      '<input type="number" data-field="credit" min="0" step="' + amountStep + '" inputmode="' + amountInputMode + '" value="' + esc(line.credit) + '" placeholder="0" aria-label="Montant au crédit">' +
      '<button type="button" class="line-remove" data-action="remove-line" aria-label="Supprimer cette ligne">✕</button>' +
    '</div>';
  }

  function viewEntryForm(params) {
    var model = defaultEntryModel(params || {});
    var editing = !!model.id;
    var returnToJournalList = params && params.from === 'journal-list';
    var selectedJournal = S.journal(model.journal);
    var closed = S.periodStatus(Number(model.date.slice(0, 4)), Number(model.date.slice(5, 7))) === 'closed';
    var returnLink = returnToJournalList
      ? '<a class="btn btn-ghost" href="' + accountingMenuHash('saisie', 'journal-entry') + '">← Retour aux journaux</a>'
      : '<a class="btn btn-ghost" href="#/entries">← Retour aux pièces</a>';

    var html = pageHeader(editing ? 'Modifier le brouillon' : 'Saisie d’écriture',
      editing ? 'La pièce reste modifiable tant qu’elle n’est pas validée.' : 'Journal sélectionné : ' + journalDisplayName(selectedJournal) + ' · saisie multiligne avec contrôle d’équilibre en temps réel.',
      returnLink);

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
          '<select id="e-journal" name="journal" required>' + journalOptions(model.journal) + '</select><span class="hint">Les comptes proposés sont filtrés selon les autorisations du journal.</span></div>' +
        '<div class="field"><label for="e-date">Date</label>' +
          '<input id="e-date" name="date" type="date" min="' + esc(S.currentDossier().cycleStart) + '" max="' + esc(S.accountingConfiguration().entryAllowedUntil) + '" required value="' + esc(model.date) + '"></div>' +
        '<div class="field"><label for="e-description">Libellé</label>' +
          '<input id="e-description" name="description" type="text" value="' + esc(model.description) + '" placeholder="Objet de la pièce"></div>' +
      '</div>' +

      '<div class="panel-header" style="margin-top:22px"><div><h3>Lignes de l’écriture</h3>' +
        '<p class="sub">Un débit ou un crédit par ligne, jamais les deux. Les lignes vides sont ignorées.</p></div>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="add-line">＋ Ajouter une ligne</button></div>' +

      '<div class="lines-head" aria-hidden="true"><span>Compte</span><span>Débit (XOF)</span><span>Crédit (XOF)</span><span></span></div>' +
      '<div class="lines-editor" id="lines-body">' + model.lines.map(function (line) { return lineRowHtml(line, model.journal); }).join('') + '</div>' +

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
      ref.value = journal.value ? S.nextReference(journal.value, date.value) : '';
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
          journalOptions(filter.journal, true, true, true) + '</select></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="data-table">' +
        '<caption>' + list.length + ' pièce(s) — montants exprimés en XOF</caption>' +
        '<thead><tr><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Journal</th><th scope="col">Libellé</th>' +
        '<th scope="col" class="num">Montant</th><th scope="col">Statut</th></tr></thead><tbody>' +
        (list.length ? list.map(function (e) {
          return '<tr class="clickable" data-action="open-entry" data-id="' + esc(e.id) + '">' +
            '<td class="nowrap">' + dateLabel(e.date) + '</td>' +
            '<td><button type="button" class="btn btn-ghost btn-sm" data-action="open-entry" data-id="' + esc(e.id) + '">' + esc(e.reference) + '</button></td>' +
            '<td>' + esc(journalDisplayName(S.journal(e.journal)) || e.journal) + '</td>' +
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
      '<div class="total-item"><span>Journal</span><strong>' + esc(journal ? journalDisplayName(journal) : e.journal) + '</strong></div>' +
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
    var isSystemManagedJournal = !!(journal && (journal.systemManaged || journal.retired));
    if (isSystemManagedJournal) {
      body += '<div class="alert info" style="margin-top:16px"><strong>' + (journal.retired ? 'Journal historique retiré.' : 'Journal alimenté par le système.') + '</strong> La modification et la suppression manuelles sont désactivées.</div>';
    }
    if (isCancellationEntry) {
      var cancellationMetadata = e.sourceMetadata || {};
      body += '<div class="alert info" style="margin-top:16px"><div><strong>Écriture inverse liée à ' + esc(cancellationMetadata.originalReference || 'la pièce d’origine') + '.</strong>' +
        (cancellationMetadata.cancellationReason ? '<br>Motif : ' + esc(cancellationMetadata.cancellationReason) : '') +
        (S.entry(cancellationMetadata.originalEntryId) ? '<br><button type="button" class="btn btn-ghost btn-sm" style="margin-top:8px" data-action="open-entry" data-id="' + esc(cancellationMetadata.originalEntryId) + '">Consulter la pièce d’origine</button>' : '') +
        '</div></div>';
    }

    var footer = '';
    if (e.status === 'draft') {
      if (!isSystemManagedJournal) {
        footer += '<button type="button" class="btn btn-danger" data-action="delete-draft" data-id="' + esc(e.id) + '">× Supprimer</button>';
        if (!isCancellationEntry) footer += '<button type="button" class="btn btn-ghost" data-action="edit-draft" data-id="' + esc(e.id) + '">✎ Modifier</button>';
      }
      if (!isCancellationEntry && (!isSystemManagedJournal || (journal.systemManaged && e.sourceSystem === journal.systemSource))) {
        footer += '<button type="button" class="btn btn-primary" data-action="validate-entry" data-id="' + esc(e.id) + '">✓ Valider la pièce</button>';
      }
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
    var routeJournalCode = parseHash().params.journal;
    var routeJournal = routeJournalCode ? S.journal(routeJournalCode) : null;
    if (routeJournal) ui.journal.journal = routeJournal.code;
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
          journalOptions(filter.journal, true, true, true) + '</select></div>' +
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
            '<span class="badge plain">' + esc(journalDisplayName(S.journal(e.journal)) || e.journal) + '</span>' +
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
              '<td>' + esc(journalDisplayName(S.journal(r.journal)) || r.journal) + '</td>' +
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
            '<li>Référence de pièce unique, proposée selon le journal et la périodicité configurée.</li>' +
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

  function viewAccountingConfiguration() {
    var dossier = S.currentDossier();
    var configuration = dossier.accountingConfiguration || S.accountingConfiguration();
    var canManage = hasDemoPermission(getActiveDemoMember(), 'accounting', 'accounting.configure', accountingAccessContext(dossier));
    var editable = canManage && !isPhoneViewport();
    var disabled = editable ? '' : ' disabled';
    var supplierSettlement = configuration.supplierSettlement || {};
    var otherPayablesSettlement = configuration.otherPayablesSettlement || {};

    function textField(id, label, value, maxLength, hint) {
      return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" type="text" maxlength="' + maxLength + '" value="' + esc(value) + '" required>' +
        (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
    }

    function numberField(id, label, value, min, max, hint) {
      return '<div class="field"><label for="' + id + '">' + label + '</label><input id="' + id + '" name="' + id + '" type="number" min="' + min + '" max="' + max + '" step="1" value="' + esc(value == null ? '' : value) + '">' +
        (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
    }

    function settlementGroup(prefix, title, settings) {
      return '<section class="accounting-config-subgroup"><h5>' + title + '</h5><div class="accounting-config-grid">' +
        numberField(prefix + '-minimum-delay', 'Délai minimal (jours)', settings.minimumDelayDays, 0, 3650, 'Laisser vide si aucun délai n’est défini.') +
        numberField(prefix + '-earliest-day', 'Jour du mois au plus tôt', settings.earliestDayOfMonth, 1, 31, 'Laisser vide si aucun jour n’est défini.') +
        textField(prefix + '-settlement-on', 'Règlement le', settings.settlementOn || '', 80, 'Valeur libre à préciser selon la règle de l’organisation.') +
        '</div></section>';
    }

    var numberPeriods = [
      { value: 'day', label: 'Jour' },
      { value: 'month', label: 'Mois' },
      { value: 'year', label: 'Année' },
      { value: 'exercise', label: 'Exercice' }
    ];
    var permissionNotice = canManage
      ? (editable ? '' : '<div class="alert info">La configuration est consultable sur téléphone, mais sa modification est réservée à un ordinateur ou une tablette.</div>')
      : '<div class="alert warning">Consultation seule : seul le Superviseur général, ou un profil auquel le droit explicite « Modifier la configuration comptable du dossier » a été accordé, peut enregistrer ces paramètres.</div>';

    return '<div class="accounting-config-workspace">' +
      '<div class="alert info"><div><strong>Dossier actif : ' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</strong><br>Les dates préremplies reprennent le cycle déjà associé à ce dossier, afin de préserver ses écritures. Elles restent modifiables sous contrôle de cohérence.</div></div>' +
      permissionNotice +
      '<form id="accounting-configuration-form" class="accounting-config-form">' +
        '<fieldset class="accounting-config-fields"' + disabled + '>' +
          '<section class="accounting-config-group"><div class="accounting-config-group-heading"><span>01 · IDENTITÉ COMPTABLE</span><h4>Référentiel du dossier</h4></div>' +
            '<div class="accounting-config-grid">' +
              textField('config-framework', 'Cadre comptable', configuration.framework || 'SYSCOHADA révisé', 100, '') +
              textField('config-country', 'Pays', configuration.country || 'BENIN', 80, '') +
              textField('config-specific-organization', 'Organisme spécifique', configuration.specificOrganization || 'Aucun', 120, 'Saisir « Aucun » lorsqu’aucun organisme ne s’applique.') +
            '</div>' +
          '</section>' +
          '<section class="accounting-config-group"><div class="accounting-config-group-heading"><span>02 · EXERCICE &amp; SAISIE</span><h4>Dates et règles générales</h4></div>' +
            '<div class="accounting-config-grid">' +
              '<div class="field"><label for="config-cycle-start">Exercice en cours · du</label><input id="config-cycle-start" name="cycle-start" type="date" value="' + esc(dossier.cycleStart) + '" required></div>' +
              '<div class="field"><label for="config-cycle-end">Exercice en cours · au</label><input id="config-cycle-end" name="cycle-end" type="date" value="' + esc(dossier.cycleEnd) + '" required></div>' +
              '<div class="field"><label for="config-entry-allowed-until">Saisies autorisées jusqu’au</label><input id="config-entry-allowed-until" name="entry-allowed-until" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(configuration.entryAllowedUntil || dossier.cycleEnd) + '" required></div>' +
              numberField('config-decimal-places', 'Décimales des montants', configuration.decimalPlaces, 0, 4, 'Le nombre configuré est appliqué aux saisies et affichages.') +
              '<div class="field"><label for="config-numbering-period">Numérotation des pièces par</label><select id="config-numbering-period" name="numbering-period" required>' + numberPeriods.map(function (period) {
                return '<option value="' + period.value + '"' + (configuration.numberingPeriod === period.value ? ' selected' : '') + '>' + period.label + '</option>';
              }).join('') + '</select></div>' +
              numberField('config-auto-close-months', 'Clôture automatique après (mois)', configuration.automaticClosingMonths, 1, 120, 'Laisser vide pour ne pas définir de délai.') +
            '</div>' +
          '</section>' +
          '<section class="accounting-config-group"><div class="accounting-config-group-heading"><span>03 · RÈGLEMENTS</span><h4>Délais de règlement</h4></div>' +
            settlementGroup('config-supplier', 'Fournisseurs', supplierSettlement) +
            settlementGroup('config-other-payables', 'Autres comptes à payer', otherPayablesSettlement) +
          '</section>' +
          '<section class="accounting-config-group"><div class="accounting-config-group-heading"><span>04 · OPTIONS</span><h4>Fonctions du dossier</h4></div>' +
            '<div class="accounting-config-options">' +
              '<label class="accounting-config-checkbox"><input type="checkbox" id="config-supplier-orders" name="supplier-orders"' + (configuration.supplierOrdersEnabled ? ' checked' : '') + '><span>Commandes fournisseurs</span></label>' +
              '<label class="accounting-config-checkbox"><input type="checkbox" id="config-euro-statements" name="euro-statements"' + (configuration.euroStatementsEnabled ? ' checked' : '') + '><span>États en euros</span></label>' +
            '</div>' +
          '</section>' +
        '</fieldset>' +
        '<div class="accounting-config-footer">' +
          '<span class="small muted">La modification du cycle est refusée si elle exclurait une pièce existante.</span>' +
          '<button type="submit" class="btn btn-primary"' + (editable ? '' : ' disabled') + '>Valider et enregistrer</button>' +
        '</div>' +
      '</form>' +
      '<div class="alert info accounting-config-scope-note"><div><strong>Portée du prototype.</strong> Le cycle, la date limite de saisie, le nombre de décimales et la périodicité de numérotation sont appliqués. Les autres paramètres sont conservés par dossier ; les automatisations de clôture, de règlement, de commandes fournisseurs et d’états en euros ne sont pas activées dans cette version.</div></div>' +
    '</div>';
  }

  function viewAnalyticalSectionsConfiguration() {
    var dossier = S.currentDossier();
    var configuration = S.analyticalSectionsConfiguration();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalSections.configure', accountingAccessContext(dossier));
    var locked = configuration.configured === true;
    var editable = canConfigure && !locked && !isPhoneViewport();
    var disabled = editable ? '' : ' disabled';
    var validationDate = '';
    if (locked && configuration.validatedAt) {
      var parsedValidationDate = new Date(configuration.validatedAt);
      if (!isNaN(parsedValidationDate.getTime())) validationDate = parsedValidationDate.toLocaleString('fr-FR');
    }
    var accessNotice = locked
      ? '<div class="alert warning analytic-sections-lock-note"><div><strong>Paramétrage validé' + (validationDate ? ' le ' + esc(validationDate) : '') + '.</strong><br>Les listes sont conservées et grisées pour le moment. Les traitements de comptabilité analytique restent inactifs.</div></div>'
      : (!canConfigure
        ? '<div class="alert warning">Consultation seule : le droit explicite « Configurer les sections et comptes analytiques » est requis pour valider ce paramétrage.</div>'
        : (isPhoneViewport() ? '<div class="alert info">La consultation est disponible sur téléphone ; le paramétrage se fait sur ordinateur ou tablette.</div>' : ''));

    function listField(id, label, values) {
      return '<div class="analytic-sections-row"><label for="' + id + '">' + label + '</label><textarea id="' + id + '" name="' + id + '" rows="7" maxlength="20000" spellcheck="false" aria-label="' + label + '">' +
        esc((Array.isArray(values) ? values : []).join('\n')) + '</textarea></div>';
    }

    return '<div class="analytic-sections-workspace">' +
      '<div class="alert info"><div><strong>Sections et comptes du dossier : ' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</strong><br>Les listes sont vides par défaut. Inscrivez les valeurs souhaitées, une par ligne, puis validez. Ce paramétrage ne modifie pas le plan comptable général et ne crée aucun mouvement ni aucune écriture analytique.</div></div>' +
      accessNotice +
      '<form id="analytical-sections-form" class="analytic-sections-form">' +
        '<fieldset class="analytic-sections-fields' + (locked ? ' is-locked' : '') + '"' + disabled + '>' +
          listField('analytic-main-sections', 'Sections principales', configuration.mainSections) +
          listField('analytic-auxiliary-sections', 'Sections auxiliaires', configuration.auxiliarySections) +
          listField('analytic-accounts', 'Comptes', configuration.accounts) +
        '</fieldset>' +
        '<div class="analytic-sections-footer"><span class="small muted">Le paramétrage est propre à ce dossier.</span><button type="submit" class="btn btn-primary"' + (editable ? '' : ' disabled') + '>Valider</button></div>' +
      '</form>' +
      '<div class="alert info analytic-sections-inactive-note"><div><strong>Comptabilité analytique inactive.</strong> La configuration peut être consultée après validation, mais aucune imputation, ventilation ou édition analytique n’est activée dans le parcours général.</div></div>' +
    '</div>';
  }

  function allocationKeyRowHtml(kind, row, index, editable) {
    row = row && typeof row === 'object' ? row : {};
    var counterpartLabel = kind === 'auxiliaryToMain' ? 'Section auxiliaire' : 'Famille des prestations';
    var disabled = editable ? '' : ' disabled';
    return '<tr data-allocation-row>' +
      '<td><input type="text" maxlength="240" data-allocation-field="mainSection" aria-label="Section principale, ligne ' + (index + 1) + '" value="' + esc(row.mainSection || '') + '"' + disabled + '></td>' +
      '<td><input type="text" maxlength="240" data-allocation-field="counterpart" aria-label="' + counterpartLabel + ', ligne ' + (index + 1) + '" value="' + esc(row.counterpart || row.auxiliarySection || row.serviceFamily || '') + '"' + disabled + '></td>' +
      '<td><input type="text" maxlength="120" data-allocation-field="key" aria-label="Clé, ligne ' + (index + 1) + '" value="' + esc(row.key || '') + '"' + disabled + '></td>' +
      '</tr>';
  }

  function viewAnalyticalAllocationKeys() {
    var dossier = S.currentDossier();
    var configurations = S.analyticalAllocationKeysConfiguration();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalAllocationKeys.configure', accountingAccessContext(dossier));

    function tableGroup(kind, title, initialRows) {
      var configuration = configurations[kind] || { rows: [], destination: '', configured: false, validatedAt: '' };
      var locked = configuration.configured === true;
      var editable = canConfigure && !locked && !isPhoneViewport();
      var readOnlyClass = editable ? '' : ' is-readonly';
      var disabled = editable ? '' : ' disabled';
      var rows = Array.isArray(configuration.rows) ? configuration.rows.slice() : [];
      if (!locked) {
        while (rows.length < initialRows) rows.push({ mainSection: '', counterpart: '', key: '' });
      }
      var tbodyId = 'allocation-rows-' + kind;
      var headerHtml = kind === 'auxiliaryToMain'
        ? '<th>Sections principales</th><th>Sections auxiliaires</th><th>Clé</th>'
        : '<th>Sections principales</th><th>Familles des prestations</th><th>Clé</th>';
      var savedDate = '';
      if (locked && configuration.validatedAt) {
        var date = new Date(configuration.validatedAt);
        if (!isNaN(date.getTime())) savedDate = date.toLocaleString('fr-FR');
      }
      var notice = locked
        ? '<div class="alert warning allocation-key-lock-note"><div><strong>Grille validée' + (savedDate ? ' le ' + esc(savedDate) : '') + '.</strong> Les champs sont grisés. Aucune ventilation n’est exécutée.</div></div>'
        : '';
      var tableClass = 'allocation-key-grid' + (locked ? ' is-locked' : '');
      return '<section class="allocation-key-group" data-allocation-group="' + kind + '">' +
        '<h4>' + title + '</h4>' + notice +
        '<form class="allocation-key-form" data-allocation-kind="' + kind + '">' +
          '<fieldset class="allocation-key-fields' + (locked ? ' is-locked' : '') + readOnlyClass + '">' +
            '<div class="allocation-key-table-wrap"><table class="' + tableClass + '"><thead><tr>' + headerHtml + '</tr></thead><tbody id="' + tbodyId + '" data-allocation-body="' + kind + '">' +
              rows.map(function (row, index) { return allocationKeyRowHtml(kind, row, index, editable); }).join('') +
            '</tbody></table></div>' +
            '<div class="allocation-key-control-column">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-allocation-action="display">Afficher</button>' +
              '<button type="submit" class="btn btn-ghost btn-sm" data-allocation-action="validate"' + disabled + '>Valider</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-allocation-action="destination" aria-controls="allocation-destination-' + kind + '"' + disabled + '>Destination</button>' +
              '<input type="text" id="allocation-destination-' + kind + '" data-allocation-destination maxlength="240" value="' + esc(configuration.destination || '') + '" aria-label="Destination"' + disabled + '>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-allocation-action="preview">Aperçu</button>' +
            '</div>' +
          '</fieldset>' +
          '<p class="allocation-key-hint">Saisir une ligne par association. La clé et la destination sont conservées telles que saisies ; aucune règle de répartition n’est calculée.</p>' +
        '</form>' +
        (!canConfigure && !locked ? '<div class="alert warning allocation-key-permission-note">Consultation seule : le droit explicite « Configurer les clés de répartition analytiques » est requis pour saisir ou valider.</div>' : '') +
      '</section>';
    }

    var permissionNotice = !canConfigure
      ? '<div class="alert warning">Les grilles sont consultables ; la saisie nécessite un droit explicite au niveau du dossier.</div>'
      : (isPhoneViewport() ? '<div class="alert info">Consultation sur téléphone ; la configuration est réservée à un ordinateur ou une tablette.</div>' : '');

    return '<div class="allocation-key-workspace">' +
      '<div class="alert info"><div><strong>Clés de répartition · ' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</strong><br>Les grilles sont vides par défaut. Les valeurs validées sont conservées par dossier et deviennent grises. Les boutons de consultation n’effectuent aucun calcul.</div></div>' +
      permissionNotice +
      tableGroup('auxiliaryToMain', 'LES CLÉS DE RÉPARTITION DES SECTIONS AUXILIAIRES SUR LES PRINCIPALES', 12) +
      tableGroup('servicesBySection', 'LES CLÉS DE RÉPARTITION DES PRESTATIONS PAR SECTION', 5) +
      '<div class="alert info allocation-key-inactive-note"><div><strong>Comptabilité analytique inactive.</strong> Ce paramétrage ne génère aucune ventilation, imputation, écriture ou édition analytique.</div></div>' +
    '</div>';
  }

  function viewAnalyticalNatures() {
    var dossier = S.currentDossier();
    var configuration = S.analyticalNaturesConfiguration();
    var rows = Array.isArray(configuration.rows) ? configuration.rows : [];
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalNatures.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var selected = rows.find(function (row) { return row.id === analyticalNatureSelectedId && !row.group; }) ||
      rows.find(function (row) { return row.id === 'activity-domains' && !row.group; }) ||
      rows.find(function (row) { return !row.group; });
    if (selected) analyticalNatureSelectedId = selected.id;

    var tableRows = rows.map(function (row) {
      if (row.group) {
        return '<tr class="analytical-natures-group"><td>' + esc(row.genericName) + '</td><td></td><td></td><td></td><td></td></tr>';
      }
      var isSelected = selected && row.id === selected.id;
      return '<tr class="analytical-natures-row' + (isSelected ? ' is-selected' : '') + '" data-analytical-nature-row="' + esc(row.id) + '" tabindex="0" aria-selected="' + (isSelected ? 'true' : 'false') + '">' +
        '<td>' + esc(row.genericName || '') + '</td>' +
        '<td>' + esc(row.individualName || '') + '</td>' +
        '<td class="analytical-natures-io">' + (row.requiredAtEntry ? 'Oui' : '') + '</td>' +
        '<td>' + esc(row.significantAccounts || '') + '</td>' +
        '<td>' + esc(row.carryForwardAccounts || '') + '</td>' +
      '</tr>';
    }).join('');
    var accessNotice = !canConfigure
      ? '<div class="alert warning analytical-natures-access-note">Consultation seule : un droit explicite « Configurer les natures analytiques » est nécessaire pour modifier la nomenclature.</div>'
      : (isPhoneViewport() ? '<div class="alert info analytical-natures-access-note">Consultation sur téléphone ; la modification est réservée à un ordinateur ou une tablette.</div>' : '');

    return '<div class="analytical-natures-workspace">' +
      accessNotice +
      '<div class="analytical-natures-table-wrap" role="region" aria-label="Tableau des natures analytiques" tabindex="0">' +
        '<table class="analytical-natures-table"><thead><tr>' +
          '<th scope="col">Nom générique</th><th scope="col">Nom indiv.</th><th scope="col">I.O.</th><th scope="col">Comptes significatifs</th><th scope="col">Comptes à reporter</th>' +
        '</tr></thead><tbody>' + tableRows + '</tbody></table>' +
      '</div>' +
      '<div class="analytical-natures-footer">' +
        '<button type="button" class="btn btn-ghost" disabled title="La sélection des comptes généraux reste désactivée comme sur la capture.">Comptes généraux</button>' +
        '<button type="button" class="analytical-natures-io-legend" data-analytical-nature-action="toggle-io"' + (editable && selected ? '' : ' disabled') + '><strong>I.O.</strong> (Imputation obligatoire à la saisie)</button>' +
        '<div class="analytical-natures-footer-end">' +
          '<button type="button" class="btn btn-ghost" data-analytical-nature-action="modify"' + (editable && selected ? '' : ' disabled') + '>Modifier</button>' +
          '<button type="button" class="btn btn-ghost" data-analytical-nature-action="close">Fermer</button>' +
        '</div>' +
      '</div>' +
      '<p class="small muted analytical-natures-footnote">Les valeurs sont conservées par dossier. Cette nomenclature ne crée aucune imputation, aucun mouvement ni aucune écriture analytique.</p>' +
    '</div>';
  }

  function openAnalyticalNatureEditor(natureRow) {
    if (!natureRow || natureRow.group) return;
    var dossier = S.currentDossier();
    var body = '<form id="analytical-nature-form" novalidate>' +
      '<div id="analytical-nature-errors" aria-live="assertive"></div>' +
      '<div class="analytical-nature-editor-grid">' +
        '<div class="field"><label for="analytical-nature-generic">Nom générique</label><input id="analytical-nature-generic" type="text" maxlength="120" value="' + esc(natureRow.genericName || '') + '"></div>' +
        '<div class="field"><label for="analytical-nature-individual">Nom individuel</label><input id="analytical-nature-individual" type="text" maxlength="120" value="' + esc(natureRow.individualName || '') + '"></div>' +
        '<label class="analytical-nature-required"><input id="analytical-nature-required" type="checkbox"' + (natureRow.requiredAtEntry ? ' checked' : '') + '> <span>Imputation obligatoire à la saisie (I.O.)</span></label>' +
        '<div class="field"><label for="analytical-nature-significant">Comptes significatifs</label><input id="analytical-nature-significant" type="text" maxlength="500" spellcheck="false" value="' + esc(natureRow.significantAccounts || '') + '"></div>' +
        '<div class="field"><label for="analytical-nature-carry-forward">Comptes à reporter</label><input id="analytical-nature-carry-forward" type="text" maxlength="500" spellcheck="false" value="' + esc(natureRow.carryForwardAccounts || '') + '"></div>' +
      '</div>' +
      '<p class="small muted">Les valeurs sont enregistrées telles que saisies ; aucun traitement analytique n’est exécuté.</p>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="analytical-nature-form">Enregistrer</button>';
    openModal('Modifier une nature analytique', 'Dossier ' + esc(dossier.reference) + ' · ' + esc(natureRow.genericName), body, footer, true);

    var form = $('#analytical-nature-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalNatures.configure', accountingAccessContext(S.currentDossier()))) {
        toast('Modification refusée : le droit de configuration des natures analytiques n’est pas accordé.', 'warning');
        return;
      }
      var current = S.analyticalNaturesConfiguration();
      var rows = current.rows.map(function (row) {
        if (row.id !== natureRow.id) return row;
        return Object.assign({}, row, {
          genericName: $('#analytical-nature-generic', form).value,
          individualName: $('#analytical-nature-individual', form).value,
          requiredAtEntry: $('#analytical-nature-required', form).checked,
          significantAccounts: $('#analytical-nature-significant', form).value,
          carryForwardAccounts: $('#analytical-nature-carry-forward', form).value
        });
      });
      var result = S.saveAnalyticalNaturesConfiguration({ rows: rows });
      if (!result.ok) {
        var errorRegion = $('#analytical-nature-errors', form);
        if (errorRegion) errorRegion.innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          (result.errors || ['Modification impossible.']).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast('Nature analytique enregistrée dans le dossier. Aucun mouvement analytique n’a été créé.', 'success');
      closeModal(true);
      render();
    });
  }

  function viewFixedAssetAccounts() {
    var dossier = S.currentDossier();
    if (fixedAssetAccountsSelectedDossierId !== dossier.id) {
      fixedAssetAccountsSelectedId = 'fixed-assets-class-21';
      fixedAssetAccountsSelectedDossierId = dossier.id;
    }
    if (fixedAssetAccountsEditDraft && fixedAssetAccountsEditDossierId !== dossier.id) {
      fixedAssetAccountsEditDraft = null;
      fixedAssetAccountsEditDossierId = '';
    }
    var configuration = S.fixedAssetAccountsConfiguration();
    var editing = !!fixedAssetAccountsEditDraft;
    var rows = editing ? fixedAssetAccountsEditDraft.rows :
      (Array.isArray(configuration.rows) ? configuration.rows : []).concat(Array.isArray(configuration.additionalRows) ? configuration.additionalRows : []);
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'fixedAssetAccounts.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var selected = rows.find(function (row) { return row.id === fixedAssetAccountsSelectedId; }) || null;
    var selectedIsEmptySlot = /^fixed-assets-empty-\d+$/.test(fixedAssetAccountsSelectedId);
    if (!selected && !selectedIsEmptySlot) {
      selected = rows[0] || null;
      if (selected) fixedAssetAccountsSelectedId = selected.id;
    }
    var hasSelection = !!selected || selectedIsEmptySlot;
    var editingNewRow = editing && fixedAssetAccountsEditDraft.isNewRow === true;
    var columns = [
      { key: 'grossValueAccount', label: 'Compte de valeur brute' },
      { key: 'accumulatedDepreciationAccount', label: 'Compte d’amortissements' },
      { key: 'depreciationExpenseAccount', label: 'Dotations aux amortissements' },
      { key: 'disposalNetValueAccount', label: 'Valeurs nettes de cession' },
      { key: 'grantRecoveryAccount', label: 'Reprises de subventions' }
    ];
    var tableRows = rows.map(function (row) {
      var isSelected = selected && row.id === selected.id;
      var cells = columns.map(function (column) {
        if (editing && !editingNewRow && isSelected) {
          return '<td><input type="text" maxlength="120" data-fixed-asset-account-field="' + column.key + '" aria-label="' + esc(column.label + ' — ligne ' + (row.grossValueAccount || row.id)) + '" value="' + esc(row[column.key] || '') + '"></td>';
        }
        return '<td>' + esc(row[column.key] || '') + '</td>';
      }).join('');
      return '<tr class="fixed-asset-accounts-row' + (isSelected ? ' is-selected' : '') + '" data-fixed-asset-account-row="' + esc(row.id) + '" tabindex="0" aria-selected="' + (isSelected ? 'true' : 'false') + '">' + cells + '</tr>';
    }).join('');
    var blankRows = '';
    for (var blankIndex = 0; blankIndex < 11; blankIndex += 1) {
      var blankId = 'fixed-assets-empty-' + blankIndex;
      var blankSelected = selectedIsEmptySlot && fixedAssetAccountsSelectedId === blankId;
      var editBlank = editingNewRow && fixedAssetAccountsEditDraft.slotId === blankId;
      var blankCells = columns.map(function (column) {
        if (editBlank) {
          return '<td><input type="text" maxlength="120" data-fixed-asset-account-field="' + column.key + '" aria-label="' + esc(column.label + ' — nouvelle ligne') + '" value="' + esc(fixedAssetAccountsEditDraft.newRow[column.key] || '') + '"></td>';
        }
        return '<td></td>';
      }).join('');
      blankRows += '<tr class="fixed-asset-accounts-row fixed-asset-accounts-empty-row' + (blankSelected ? ' is-selected' : '') + '" data-fixed-asset-account-row="' + blankId + '" tabindex="0" aria-selected="' + (blankSelected ? 'true' : 'false') + '">' + blankCells + '</tr>';
    }
    var accessNotice = !canConfigure
      ? '<div class="alert warning fixed-asset-accounts-access-note">Consultation seule : un droit explicite « Configurer les comptes associés aux immobilisations » est nécessaire pour modifier ou réinitialiser cette grille.</div>'
      : (isPhoneViewport() ? '<div class="alert info fixed-asset-accounts-access-note">Consultation sur téléphone ; les modifications sont réservées à un ordinateur ou une tablette.</div>' : '');

    return '<div class="fixed-asset-accounts-workspace">' +
      accessNotice +
      '<div class="fixed-asset-accounts-layout">' +
        '<div class="fixed-asset-accounts-table-wrap" role="region" aria-label="Comptes associés aux immobilisations" tabindex="0">' +
          '<table class="fixed-asset-accounts-table"><thead><tr>' + columns.map(function (column) { return '<th scope="col">' + esc(column.label) + '</th>'; }).join('') + '</tr></thead><tbody>' + tableRows + blankRows + '</tbody></table>' +
        '</div>' +
        '<div class="fixed-asset-accounts-actions">' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="close">Fermer</button>' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="modify"' + (!editable || editing || !hasSelection ? ' disabled' : '') + '>Modifier</button>' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="reset"' + (!editable || editing ? ' disabled' : '') + '>Réinitialiser...</button>' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="accounts" disabled title="La sélection de comptes reste désactivée comme sur la capture.">Comptes...</button>' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="validate"' + (!editable || !editing ? ' disabled' : '') + '>Valider</button>' +
          '<button type="button" class="btn btn-ghost" data-fixed-asset-account-action="cancel"' + (!editing ? ' disabled' : '') + '>Annuler</button>' +
        '</div>' +
      '</div>' +
      '<p class="small muted fixed-asset-accounts-footnote">Sélectionnez une ligne vide puis « Modifier » pour ajouter une correspondance, sans changer les lignes existantes. Aucun calcul ni aucune écriture ne sont produits.</p>' +
    '</div>';
  }

  function viewOrderAccounts() {
    var dossier = S.currentDossier();
    if (orderAccountsSelectedDossierId !== dossier.id) {
      orderAccountsSelectedId = 'orders-realization-ht';
      orderAccountsSelectedDossierId = dossier.id;
    }
    var configuration = S.orderAccountsConfiguration();
    var rows = (Array.isArray(configuration.rows) ? configuration.rows : []).concat(Array.isArray(configuration.additionalRows) ? configuration.additionalRows : []);
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderAccounts.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var selected = rows.find(function (row) { return row.id === orderAccountsSelectedId; }) || null;
    var selectedIsEmptySlot = /^order-accounts-empty-\d+$/.test(orderAccountsSelectedId);
    if (!selected && !selectedIsEmptySlot) {
      selected = rows[0] || null;
      if (selected) orderAccountsSelectedId = selected.id;
    }
    var tableRows = '';
    rows.forEach(function (row, index) {
      if (index > 0) tableRows += '<tr class="order-accounts-separator" aria-hidden="true"><td></td><td></td></tr>';
      var isSelected = selected && selected.id === row.id;
      tableRows += '<tr class="order-accounts-row' + (index % 2 ? ' is-even' : '') + (isSelected ? ' is-selected' : '') + '" data-order-account-row="' + esc(row.id) + '" tabindex="0" aria-selected="' + (isSelected ? 'true' : 'false') + '"><td>' + esc(row.rubric || '') + '</td><td>' + esc(row.accounts || '') + '</td></tr>';
    });
    var blankRows = '';
    for (var blankIndex = 0; blankIndex < 2; blankIndex += 1) {
      var blankId = 'order-accounts-empty-' + blankIndex;
      var blankSelected = selectedIsEmptySlot && orderAccountsSelectedId === blankId;
      blankRows += '<tr class="order-accounts-row order-accounts-empty-row' + (blankSelected ? ' is-selected' : '') + '" data-order-account-row="' + blankId + '" tabindex="0" aria-selected="' + (blankSelected ? 'true' : 'false') + '"><td></td><td></td></tr>';
    }
    var accessNote = !canConfigure
      ? '<div class="alert warning order-accounts-access-note">Consultation seule : le droit « Configurer les comptes de suivi des commandes et marchés accordés » est requis pour modifier les rubriques.</div>'
      : (isPhoneViewport() ? '<div class="alert info order-accounts-access-note">Consultation sur téléphone ; les modifications sont réservées à un ordinateur ou une tablette.</div>' : '');

    return '<div class="order-accounts-workspace">' + accessNote +
      '<div class="order-accounts-table-wrap" role="region" aria-label="Rubriques et comptes de suivi des commandes" tabindex="0">' +
        '<table class="order-accounts-table"><thead><tr><th scope="col">Rubrique</th><th scope="col">Comptes</th></tr></thead><tbody>' + tableRows + blankRows + '</tbody></table>' +
      '</div>' +
      '<div class="order-accounts-footer">' +
        '<button type="button" class="btn btn-ghost" data-order-accounts-action="accounts" disabled title="La sélection des comptes généraux reste désactivée comme sur la capture.">Comptes généraux...</button>' +
        '<div class="order-accounts-footer-end">' +
          '<button type="button" class="btn btn-ghost" data-order-accounts-action="modify"' + (editable && (selected || selectedIsEmptySlot) ? '' : ' disabled') + '>Modifier</button>' +
          '<button type="button" class="btn btn-ghost" data-order-accounts-action="close">Fermer</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function viewOrderNatures() {
    var dossier = S.currentDossier();
    if (orderNaturesSelectedDossierId !== dossier.id) {
      orderNaturesSelectedId = 'order-nature-1';
      orderNaturesSelectedDossierId = dossier.id;
    }
    var configuration = S.orderNaturesConfiguration();
    var rows = (Array.isArray(configuration.rows) ? configuration.rows : []).concat(Array.isArray(configuration.additionalRows) ? configuration.additionalRows : []);
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderNatures.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var selected = rows.find(function (row) { return row.id === orderNaturesSelectedId; }) || null;
    var selectedIsEmptySlot = /^order-natures-empty-\d+$/.test(orderNaturesSelectedId);
    if (!selected && !selectedIsEmptySlot) {
      selected = rows[0] || null;
      if (selected) orderNaturesSelectedId = selected.id;
    }
    var tableRows = '';
    rows.forEach(function (row, index) {
      var isSelected = selected && selected.id === row.id;
      tableRows += '<tr class="order-natures-row' + (index % 2 ? ' is-even' : '') + (isSelected ? ' is-selected' : '') + '" data-order-nature-row="' + esc(row.id) + '" tabindex="0" aria-selected="' + (isSelected ? 'true' : 'false') + '"><td>' + esc(row.number || '') + '</td><td>' + esc(row.name || '') + '</td></tr>';
    });
    var blankRows = '';
    for (var blankIndex = 0; blankIndex < 7; blankIndex += 1) {
      var blankId = 'order-natures-empty-' + blankIndex;
      var blankSelected = selectedIsEmptySlot && orderNaturesSelectedId === blankId;
      blankRows += '<tr class="order-natures-row order-natures-empty-row' + (blankIndex % 2 ? ' is-even' : '') + (blankSelected ? ' is-selected' : '') + '" data-order-nature-row="' + blankId + '" tabindex="0" aria-selected="' + (blankSelected ? 'true' : 'false') + '"><td></td><td></td></tr>';
    }
    var accessNote = !canConfigure
      ? '<div class="alert warning order-natures-access-note">Consultation seule : le droit « Configurer les natures des commandes » est requis pour modifier ou ajouter une nature.</div>'
      : (isPhoneViewport() ? '<div class="alert info order-natures-access-note">Consultation sur téléphone ; les modifications sont réservées à un ordinateur ou une tablette.</div>' : '');

    return '<div class="order-natures-workspace">' + accessNote +
      '<div class="order-natures-list-wrap" role="region" aria-label="Natures des commandes" tabindex="0">' +
        '<table class="order-natures-table"><tbody>' + tableRows + blankRows + '</tbody></table>' +
      '</div>' +
      '<div class="order-natures-footer">' +
        '<button type="button" class="btn btn-ghost" data-order-natures-action="modify"' + (editable && (selected || selectedIsEmptySlot) ? '' : ' disabled') + '>Modifier</button>' +
        '<button type="button" class="btn btn-ghost" data-order-natures-action="close">Fermer</button>' +
      '</div>' +
    '</div>';
  }

  function viewAccountControls() {
    var dossier = S.currentDossier();
    if (accountControlsSelectedDossierId !== dossier.id) {
      accountControlsSelectedField = 'payableAccounts';
      accountControlsSelectedDossierId = dossier.id;
    }
    var configuration = S.accountControlsConfiguration();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'accountControls.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var readonly = editable ? '' : ' readonly';
    var fields = [
      { key: 'payableAccounts', id: 'account-controls-payable', label: 'Comptes à payer (fournisseurs, organismes sociaux, état ...)' },
      { key: 'lettrableAccounts', id: 'account-controls-matchable', label: 'Comptes lettrables (autres que dettes ou créances)' },
      { key: 'receivableAccounts', id: 'account-controls-receivable', label: 'Comptes à recevoir (clients, débiteurs divers ...)' },
      { key: 'pointableAccounts', id: 'account-controls-pointable', label: 'Comptes pointables (banques)' }
    ];
    var accessNote = !canConfigure
      ? '<div class="alert warning account-controls-access-note">Consultation seule : le droit « Configurer les comptes lettrables, pointables, à payer et à recevoir » est requis pour modifier ces listes.</div>'
      : (isPhoneViewport() ? '<div class="alert info account-controls-access-note">Consultation sur téléphone ; les modifications sont réservées à un ordinateur ou une tablette.</div>' : '');
    var fieldHtml = fields.map(function (field) {
      var active = accountControlsSelectedField === field.key;
      return '<fieldset class="account-controls-fieldset' + (active ? ' is-active' : '') + '"><legend>' + esc(field.label) + '</legend>' +
        '<textarea id="' + field.id + '" data-account-controls-field="' + field.key + '" rows="4" maxlength="5000" spellcheck="false" aria-label="' + esc(field.label) + '"' + readonly + '>' + esc(configuration[field.key] || '') + '</textarea>' +
      '</fieldset>';
    }).join('');

    return '<form id="account-controls-form" class="account-controls-workspace" novalidate>' + accessNote +
      '<div class="account-controls-grid">' + fieldHtml + '</div>' +
      '<div class="account-controls-actions">' +
        '<button type="button" class="btn btn-ghost account-controls-picker-button" data-account-controls-action="accounts"' + (!editable ? ' disabled' : '') + '>Comptes généraux...</button>' +
        '<div class="account-controls-actions-end">' +
          '<button type="submit" class="btn btn-ghost" data-account-controls-action="validate"' + (!editable ? ' disabled' : '') + '>Valider</button>' +
          '<button type="button" class="btn btn-ghost" data-account-controls-action="cancel"' + (!editable ? ' disabled' : '') + '>Annuler</button>' +
        '</div>' +
      '</div>' +
      '<div class="account-controls-status" role="status" aria-live="polite"></div>' +
    '</form>';
  }

  function viewFinancialFramework() {
    var metadata = AccountingFramework.metadata;
    var records = AccountingFramework.all();

    function mappingCells(posting, side) {
      if (!posting) {
        return '<td class="financial-framework-empty-cell" aria-label="Cellule vide dans le PDF"></td>' +
          '<td class="financial-framework-empty-cell" aria-label="Cellule vide dans le PDF"></td>';
      }
      return '<td class="financial-framework-post-code"><code>&lt;' + esc(posting.code) + '&gt;</code></td>' +
        '<td class="financial-framework-post-label" data-post-side="' + side + '">' + esc(posting.label) + '</td>';
    }

    var rows = records.map(function (record) {
      return '<tr data-financial-framework-row data-account-code="' + esc(record.code) + '" title="Source PDF · page ' + record.page + '">' +
        '<th scope="row" class="financial-framework-account-code">' + esc(record.code) + '</th>' +
        '<td class="financial-framework-account-label">' + esc(record.label) + '</td>' +
        mappingCells(record.debit, 'debit') + mappingCells(record.credit, 'credit') +
      '</tr>';
    }).join('');
    var query = esc(ui.financialFramework.q || '');

    return '<div class="financial-framework-workspace">' +
      '<div class="alert info financial-framework-note"><div><strong>Référentiel SYSCOHADA révisé · consultation seule.</strong> Les codes et libellés des postes Débit/Crédit sont repris du document fourni. Les cases vides restent vides ; ce référentiel n’active aucun calcul ni aucune écriture comptable.</div></div>' +
      '<div class="financial-framework-summary" aria-label="Contenu du référentiel">' +
        '<div><small>Lignes du PDF</small><strong>' + metadata.rowCount + '</strong></div>' +
        '<div><small>Avec rattachement</small><strong>' + metadata.mappedRowCount + '</strong></div>' +
        '<div><small>Sans rattachement</small><strong>' + metadata.unmappedRowCount + '</strong></div>' +
        '<div><small>Pages source</small><strong>' + metadata.sourcePages + '</strong></div>' +
      '</div>' +
      '<section class="exchange-card financial-framework-card"><div class="supplier-directory-head"><div><h4>Comptes et postes des tableaux financiers</h4><p>Chaque compte garde sa ligne source et ses deux colonnes de rattachement, Débit et Crédit.</p></div><span id="financial-framework-result-count" class="financial-framework-result-count" aria-live="polite">' + records.length + ' / ' + records.length + ' lignes</span></div>' +
        '<div class="financial-framework-search"><label class="field" for="financial-framework-search"><span>Rechercher un compte ou un poste</span><input id="financial-framework-search" type="search" value="' + query + '" placeholder="Code, intitulé ou poste · ex. 401, client, DA" autocomplete="off"></label></div>' +
        '<div id="financial-framework-table-wrap" class="financial-framework-table-wrap" role="region" aria-label="Référentiel comptable SYSCOHADA révisé" tabindex="0">' +
          '<table class="financial-framework-table"><caption class="sr-only">' + esc(metadata.standard) + ' · comptes, intitulés et rattachements Débit/Crédit</caption>' +
            '<colgroup span="1"></colgroup><colgroup span="1"></colgroup><colgroup span="2"></colgroup><colgroup span="2"></colgroup>' +
            '<thead><tr><th scope="col" rowspan="2">Compte</th><th scope="col" rowspan="2">Intitulé</th><th scope="colgroup" colspan="2">Débit</th><th scope="colgroup" colspan="2">Crédit</th></tr>' +
              '<tr><th scope="col">Code du poste</th><th scope="col">Libellé du poste</th><th scope="col">Code du poste</th><th scope="col">Libellé du poste</th></tr></thead>' +
            '<tbody id="financial-framework-rows">' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        '<div id="financial-framework-empty" class="empty-state financial-framework-empty" hidden><strong>Aucun compte ni poste correspondant</strong><span>Essayez un autre code, un intitulé ou un code/libellé de poste.</span></div>' +
        '<p class="small muted financial-framework-source-note">Source : « ' + esc(metadata.sourceFile) + ' » · ' + metadata.sourcePages + ' pages. Certains libellés sont tronqués dans la source ; ils sont conservés tels quels, sans compléter les lettres manquantes.</p>' +
      '</section>' +
    '</div>';
  }

  function viewGeneralAccountNatures() {
    var dossier = S.currentDossier();
    var configuration = S.generalAccountNaturesConfiguration();
    var rows = Array.isArray(configuration.rows) ? configuration.rows : [];
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'generalAccountNatures.configure', accountingAccessContext(dossier));
    var editable = canConfigure && !isPhoneViewport();
    var selected = rows.find(function (row) { return row.id === generalAccountNatureSelectedId && !row.separator; }) ||
      rows.find(function (row) { return row.id === 'stable-grants' && !row.separator; }) ||
      rows.find(function (row) { return !row.separator; });
    if (selected) generalAccountNatureSelectedId = selected.id;

    var tableRows = rows.map(function (row) {
      if (row.separator) return '<tr class="general-account-natures-separator" aria-hidden="true"><td colspan="2"></td></tr>';
      var isSelected = selected && row.id === selected.id;
      var indentClass = row.level > 0 ? ' general-account-nature-child' : '';
      return '<tr class="general-account-nature-row' + indentClass + (isSelected ? ' is-selected' : '') + '" data-general-account-nature-row="' + esc(row.id) + '" tabindex="0" aria-selected="' + (isSelected ? 'true' : 'false') + '">' +
        '<td>' + esc(row.nature || '') + '</td><td>' + esc(row.accounts || '') + '</td></tr>';
    }).join('');
    var permissionNotice = canConfigure
      ? (editable ? '' : '<div class="alert info general-account-natures-access-note">Consultation sur téléphone ; les modifications sont réservées à un ordinateur ou une tablette.</div>')
      : '<div class="alert warning general-account-natures-access-note">Consultation seule : un droit explicite « Configurer les natures des comptes généraux » est nécessaire pour modifier ou initialiser cette liste.</div>';

    return '<div class="general-account-natures-workspace">' +
      '<div class="alert info"><div><strong>Nomenclature du dossier : ' + esc(dossier.clientName) + ' · ' + esc(dossier.reference) + '</strong><br>Valeurs initiales reprises de la capture. Sélectionnez une ligne puis « Modifier ». Cette configuration ne modifie ni le plan comptable, ni les pièces.</div></div>' +
      permissionNotice +
      '<div class="general-account-natures-table-wrap" role="region" aria-label="Natures et comptes généraux" tabindex="0">' +
        '<table class="general-account-natures-table"><thead><tr><th scope="col">Nature</th><th scope="col">Comptes</th></tr></thead><tbody>' + tableRows + '</tbody></table>' +
      '</div>' +
      '<div class="general-account-natures-footer">' +
        '<button type="button" class="btn btn-ghost" data-general-account-natures-action="accounts" disabled title="La sélection des comptes généraux est conservée désactivée comme sur la capture.">Comptes généraux...</button>' +
        '<button type="button" class="btn btn-ghost" data-general-account-natures-action="initialize"' + (editable ? '' : ' disabled') + '>Initialisation</button>' +
        '<div class="general-account-natures-footer-end">' +
          '<button type="button" class="btn btn-ghost" data-general-account-natures-action="modify"' + (editable && selected ? '' : ' disabled') + '>Modifier</button>' +
          '<button type="button" class="btn btn-ghost" data-general-account-natures-action="close">Fermer</button>' +
        '</div>' +
      '</div>' +
      '<p class="small muted general-account-natures-footnote">Les numéros sont conservés tels qu’indiqués par nature ; les contrôles évitent de répéter deux fois le même code dans une ligne. Les sections qui se chevauchent dans les captures ne sont affichées qu’une fois. « * » signifie tous les comptes ; « ? » remplace un chiffre à sa position. Ainsi, « 2?9* » désigne les comptes divisionnaires à trois chiffres de classe 2 se terminant par 9, ainsi que leurs subdivisions. Ces motifs sont conservés sans calcul.</p>' +
    '</div>';
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

  function menuChildList(children, parentReason, groupId, tabId, selectedChildId) {
    if (!children || !children.length) return '';
    return '<ul class="menu-child-list">' + children.map(function (child) {
      var canOpenChild = groupId && tabId && (child.status === 'active' || child.status === 'partial' || child.status === 'mixed');
      var selected = child.id === selectedChildId;
      var href = canOpenChild ? accountingMenuHash(groupId, tabId, child.id) : '';
      var body = canOpenChild
        ? '<a class="menu-child-link' + (selected ? ' is-selected' : '') + '"' + (selected ? ' aria-current="page"' : '') + ' href="' + esc(href) + '">' + esc(child.label) + '<span aria-hidden="true">→</span></a>'
        : '<span class="menu-child-label" aria-disabled="true">' + esc(child.label) + '</span>';
      return '<li class="menu-child menu-child-' + esc(child.status) + (selected ? ' is-selected' : '') + '">' + body + menuStatusBadge(child.status) +
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

  function viewAccountingFecImport() {
    var dossierPrecision = S.accountingConfiguration().decimalPlaces;
    return '<div class="exchange-workspace fec-import-workspace">' +
      '<div class="alert info"><div><strong>Import manuel du FEC béninois</strong><br>Le fichier est contrôlé dans ce navigateur selon l’arrêté du 23 avril 2020 : en-tête obligatoire, 18 champs de base (ou 21 pour la trésorerie), dates AAAAMMJJ, montants décimaux et écritures équilibrées. PERFECTO ne se connecte pas directement au logiciel source.</div></div>' +
      '<div class="alert warning"><div><strong>Stockage de cette version</strong><br>Le fichier original et sa trace seront conservés dans le stockage local de ce navigateur et dans les sauvegardes du dossier. Ce n’est pas un archivage Google Drive ni un espace partagé de l’organisation ; exportez une sauvegarde indépendante.</div></div>' +
      '<div class="alert info"><div><strong>Précision active : ' + Number(dossierPrecision) + ' décimale(s)</strong><br>Les montants FEC plus précis que le paramétrage du dossier bloquent l’import. PERFECTO n’arrondit pas silencieusement ; ajustez la précision dans Paramètres → Configuration de la Comptabilité, puis rechargez le fichier.</div></div>' +
      '<div class="exchange-import-controls fec-import-controls">' +
        '<div class="field"><label for="fec-import-file">Fichier FEC (.txt ou .csv)</label>' +
          '<input id="fec-import-file" type="file" accept=".txt,.csv,text/plain,text/csv" hidden>' +
          '<label id="fec-import-label" class="btn btn-primary exchange-file-picker" for="fec-import-file">↑ Choisir un fichier FEC</label>' +
          '<span class="hint">1 Mo maximum par fichier dans ce prototype local · les fichiers volumineux peuvent être fractionnés selon la norme.</span></div>' +
        '<div class="field"><label for="fec-import-encoding">Jeu de caractères déclaré</label>' +
          '<select id="fec-import-encoding"><option value="iso-8859-15" selected>ISO 8859-15 (échantillon)</option><option value="ascii">ASCII</option><option value="ibm037">EBCDIC IBM037</option><option value="ibm500">EBCDIC IBM500</option></select>' +
          '<span class="hint">« EBCDIC » seul ne précise pas le code de page ; sélectionnez la variante indiquée par la source.</span></div>' +
        '<div class="field"><label for="fec-import-delimiter">Séparateur de champs</label>' +
          '<select id="fec-import-delimiter"><option value="auto" selected>Détection de l’en-tête</option><option value="tab">Tabulation</option><option value="pipe">Caractère |</option></select>' +
          '<span class="hint">L’exemple transmis utilise la tabulation et des fins de ligne CRLF.</span></div>' +
        '<div class="field"><label for="fec-import-mode">Statut dans PERFECTO</label>' +
          '<select id="fec-import-mode"><option value="draft" selected>Créer des brouillons (recommandé)</option><option value="posted">Importer comme écritures validées</option></select>' +
          '<span class="hint">La source FEC est validée ; l’import reste un brouillon par défaut. Le choix « validées » exige les droits de validation.</span></div>' +
      '</div>' +
      '<div id="fec-import-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Aucun fichier analysé</strong><span>Choisissez un fichier : l’aperçu et les correspondances seront proposés avant toute écriture comptable.</span></div></div>' +
      '<section class="exchange-card fec-source-history"><p class="page-kicker">TRAÇABILITÉ LOCALE</p><h4>Sources FEC déjà importées</h4>' + fecImportHistoryHtml() + '</section>' +
      fecImportReversalHtml() +
      '<details class="exchange-mapping exchange-format-guide"><summary>Règles vérifiées par le lecteur FEC</summary><p class="small muted">Le lecteur contrôle la première ligne d’en-tête et son ordre, les variantes MontDebit/MontCredit ou Montant/sens, les dates, les comptes SYSCOHADA, les montants sans séparateur de milliers, l’ordre chronologique de validation et l’équilibre de chaque écriture. Les informations auxiliaires, de lettrage, de devise et de règlement restent dans la trace source ; aucun taux de change, tiers ni écriture supplémentaire n’est calculé.</p><p class="small muted">La source doit contenir uniquement des écritures validées et ne doit pas inclure les écritures de centralisation ni les soldes de charges/produits. L’application demande une confirmation de conformité avant l’import ; ces exclusions ne peuvent pas toutes être déduites automatiquement des colonnes.</p></details>' +
      '<p class="exchange-footnote">Le nom réglementaire du fichier doit inclure l’IFU et la date de clôture. Le contrôle de contenu reste distinct du nom de la pièce jointe. Aucun fichier n’est envoyé à un serveur.</p>' +
    '</div>';
  }

  var FEC_IMPORT_REVERSAL_SOURCE = 'PERFECTO-ANNULATION-FEC';

  function findFecImportReversal(entries, original) {
    if (!original || !original.id || !Array.isArray(entries)) return null;
    return entries.find(function (entry) {
      return entry.sourceSystem === FEC_IMPORT_REVERSAL_SOURCE && entry.sourceMetadata &&
        entry.sourceMetadata.operation === 'fec-import-reversal' &&
        entry.sourceMetadata.originalEntryId === original.id;
    }) || null;
  }

  function fecImportHistoryHtml() {
    var sources = (S.importSourceFiles ? S.importSourceFiles() : []).filter(function (record) {
      return record && record.sourceSystem === 'FEC-BENIN';
    }).sort(function (a, b) { return String(b.importedAt || '').localeCompare(String(a.importedAt || '')); });
    if (!sources.length) return '<p class="small muted">Aucun fichier FEC n’a encore été archivé dans ce navigateur.</p>';
    var allEntries = S.entries();
    return '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Fichier source</th><th>Import</th><th>Contenu</th><th>État</th><th>Actions</th></tr></thead><tbody>' +
      sources.map(function (source) {
        var batchEntries = allEntries.filter(function (entry) { return entry.importBatchId === source.id; });
        var allDrafts = batchEntries.length > 0 && batchEntries.every(function (entry) { return entry.status === 'draft'; });
        var postedEntries = batchEntries.filter(function (entry) { return entry.sourceSystem === 'FEC-BENIN' && entry.status === 'posted'; });
        var reversedCount = postedEntries.filter(function (entry) { return !!findFecImportReversal(allEntries, entry); }).length;
        var statusLabel = source.status === 'cancelled' ? 'Brouillons annulés · source conservée'
          : (postedEntries.length ? postedEntries.length + ' écriture(s) validée(s) · ' + reversedCount + ' écriture(s) inverse(s) liée(s)'
            : (allDrafts ? 'Brouillons' : 'Source conservée'));
        var cancelButton = source.status !== 'cancelled' && allDrafts
          ? '<button type="button" class="btn btn-danger btn-sm" data-action="cancel-fec-import-batch" data-id="' + esc(source.id) + '">Annuler le lot brouillon</button>'
          : '';
        var reversalButton = postedEntries.length
          ? '<button type="button" class="btn btn-ghost btn-sm" data-action="open-fec-import-reversal" data-id="' + esc(source.id) + '">Gérer les écritures validées</button>'
          : '';
        return '<tr><td><strong>' + esc(source.fileName || 'Fichier FEC') + '</strong><br><small>' + esc(source.sha256 || '') + '</small></td>' +
          '<td>' + esc(source.importedAt ? new Date(source.importedAt).toLocaleString('fr-FR') : '—') + '</td>' +
          '<td>' + esc(source.entryCount || 0) + ' pièce(s) · ' + esc(source.lineCount || 0) + ' ligne(s)<br><small>' + esc(source.encoding || '') + ' · ' + esc(source.delimiter || '') + '</small></td>' +
          '<td>' + esc(statusLabel) + '</td><td><div class="exchange-button-row"><button type="button" class="btn btn-ghost btn-sm" data-action="download-fec-source" data-id="' + esc(source.id) + '">Télécharger l’original</button>' + reversalButton + cancelButton + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function fecImportReversalDateIsOpen(date, dossier) {
    var value = String(date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < dossier.cycleStart || value > dossier.cycleEnd) return false;
    var year = Number(value.slice(0, 4));
    var month = Number(value.slice(5, 7));
    var day = Number(value.slice(8, 10));
    var check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return false;
    return S.periodStatus(year, month) !== 'closed';
  }

  function defaultFecImportReversalDate(original, dossier) {
    if (original && fecImportReversalDateIsOpen(original.date, dossier)) return original.date;
    var today = S.todayIso();
    if (fecImportReversalDateIsOpen(today, dossier)) return today;
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
      if (candidate <= dossier.cycleEnd && fecImportReversalDateIsOpen(candidate, dossier)) return candidate;
    }
    return '';
  }

  function fecReversalJournal(original) {
    var originalJournal = original && S.journal(original.journal);
    var candidateCode = originalJournal && originalJournal.retired ? originalJournal.replacedBy : (originalJournal && originalJournal.code);
    var candidate = candidateCode && S.journal(candidateCode);
    if (candidate && !candidate.retired && !candidate.systemManaged && candidate.code !== 'CEN') return candidate.code;
    return (S.journals().find(function (journal) { return journal.code === 'OD' && !journal.retired && !journal.systemManaged; }) ||
      S.journals().find(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; }) || {}).code || '';
  }

  function buildFecImportReversalEntry(original, target) {
    var errors = [];
    target = target || {};
    if (!original || original.sourceSystem !== 'FEC-BENIN' || original.status !== 'posted') {
      errors.push('Seules les écritures FEC déjà validées peuvent recevoir une écriture inverse.');
    }
    if (!original || !original.sourceMetadata || !original.sourceMetadata.sourceFileId) {
      errors.push('La trace du fichier FEC source est absente ; aucune inversion ne peut être préparée.');
    }
    if (!original || !String(original.id || '').trim()) errors.push('La pièce FEC d’origine ne possède pas d’identifiant stable.');
    var reference = String(target.reference || '').trim();
    var journal = String(target.journal || '').trim();
    var date = String(target.date || '').trim();
    var reason = String(target.reason || '').trim();
    if (!reference) errors.push('La référence de l’écriture inverse est obligatoire.');
    if (!journal) errors.push('Le journal de l’écriture inverse est obligatoire.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('La date de l’écriture inverse doit respecter AAAA-MM-JJ.');
    if (!reason) errors.push('Le motif de l’inversion est obligatoire pour assurer la traçabilité.');
    if (reason.length > 250) errors.push('Le motif de l’inversion ne peut pas dépasser 250 caractères.');

    var lines = [];
    var totalDebit = 0;
    var totalCredit = 0;
    var originalLines = original && Array.isArray(original.lines) ? original.lines : [];
    if (originalLines.length < 2) errors.push('La pièce FEC d’origine ne contient pas assez de lignes pour former une écriture inverse.');
    originalLines.forEach(function (line, index) {
      line = line || {};
      var account = String(line.account || '').trim();
      var debit = Number(line.debit);
      var credit = Number(line.credit);
      if (!account || !Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0 ||
          (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        errors.push('La ligne ' + (index + 1) + ' de la pièce FEC d’origine contient un compte ou un montant non valide.');
        return;
      }
      totalDebit += debit;
      totalCredit += credit;
      if (!Number.isFinite(totalDebit) || !Number.isFinite(totalCredit)) {
        errors.push('Les totaux de la pièce FEC d’origine dépassent la capacité numérique sûre.');
        return;
      }
      lines.push({
        account: account,
        accountLabel: String(line.accountLabel || line.sourceAccountLabel || '').trim(),
        debit: credit,
        credit: debit
      });
    });
    if (lines.length < 2) errors.push('L’écriture inverse doit contenir au moins deux lignes valides.');
    if (originalLines.length >= 2 && !S.totals(originalLines).balanced) errors.push('La pièce FEC d’origine n’est pas équilibrée à la précision du dossier ; aucune écriture inverse ne peut être préparée.');
    if (errors.length) return { ok: false, errors: errors, entry: null };

    var metadata = original.sourceMetadata || {};
    return {
      ok: true,
      errors: [],
      entry: {
        reference: reference,
        journal: journal,
        date: date,
        description: 'Écriture inverse liée à l’import FEC ' + String(original.reference || original.id) + ' — ' + reason,
        sourceSystem: FEC_IMPORT_REVERSAL_SOURCE,
        sourceId: JSON.stringify([FEC_IMPORT_REVERSAL_SOURCE, original.id]),
        sourceStatus: 'posted',
        sourceMetadata: {
          operation: 'fec-import-reversal',
          reversalMethod: 'opposite-lines',
          cancellationReason: reason,
          originalEntryId: original.id,
          originalReference: String(original.reference || ''),
          originalSourceSystem: String(original.sourceSystem || ''),
          originalSourceId: String(original.sourceId || ''),
          sourceFileId: String(metadata.sourceFileId || ''),
          originalImportBatchId: String(original.importBatchId || '')
        },
        lines: lines
      }
    };
  }

  function openFecImportReversal(batchId) {
    var dossier = S.currentDossier();
    var source = S.importSourceFiles().find(function (record) { return record.id === batchId && record.sourceSystem === 'FEC-BENIN'; });
    var entries = S.entries().filter(function (entry) { return entry.importBatchId === batchId && entry.sourceSystem === 'FEC-BENIN' && entry.status === 'posted'; });
    if (!source || !entries.length) {
      toast('Aucune écriture FEC validée n’est disponible dans ce lot.', 'warning');
      return;
    }
    var allEntries = S.entries();
    var selected = entries.find(function (entry) { return !findFecImportReversal(allEntries, entry); }) || entries[0];
    var journal = fecReversalJournal(selected);
    var date = defaultFecImportReversalDate(selected, dossier);
    fecImportReversalSession = {
      batchId: batchId,
      targetDossierId: dossier.id,
      selectedEntryId: selected.id,
      targetDate: date,
      targetJournal: journal,
      targetReference: date && journal ? S.nextReference(journal, date) : '',
      referenceTouched: false,
      reason: '',
      mode: 'draft'
    };
    render();
  }

  function fecImportReversalHtml() {
    var session = fecImportReversalSession;
    if (!session) return '';
    var source = S.importSourceFiles().find(function (record) { return record.id === session.batchId && record.sourceSystem === 'FEC-BENIN'; });
    var entries = S.entries().filter(function (entry) { return entry.importBatchId === session.batchId && entry.sourceSystem === 'FEC-BENIN' && entry.status === 'posted'; });
    if (!source || !entries.length) return '<section id="fec-import-reversal-panel" class="exchange-card"><div class="alert error">Le lot FEC sélectionné ne contient plus d’écriture validée accessible.</div></section>';
    var allEntries = S.entries();
    var selected = entries.find(function (entry) { return entry.id === session.selectedEntryId; }) || entries[0];
    session.selectedEntryId = selected.id;
    var options = '<option value="">— Choisir une écriture source —</option>' + entries.map(function (entry) {
      var reversal = findFecImportReversal(allEntries, entry);
      var suffix = reversal ? ' · écriture inverse ' + reversal.reference + ' (' + (reversal.status === 'posted' ? 'validée' : 'brouillon') + ')' : '';
      return '<option value="' + esc(entry.id) + '"' + (entry.id === selected.id ? ' selected' : '') + (reversal ? ' disabled' : '') + '>' +
        esc(entry.reference + ' · ' + entry.journal + ' · ' + entry.date + suffix) + '</option>';
    }).join('');
    var journalList = S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; });
    if (session.targetDossierId !== S.currentDossier().id) {
      return '<section id="fec-import-reversal-panel" class="exchange-card"><div class="alert error">Le dossier actif a changé. Fermez ce panneau puis sélectionnez de nouveau la source dans le dossier cible.</div></section>';
    }
    if (findFecImportReversal(allEntries, selected)) {
      return '<section id="fec-import-reversal-panel" class="exchange-card"><div class="supplier-directory-head"><div><p class="page-kicker">ÉCRITURE INVERSE · IMPORT FEC</p><h4>' + esc(source.fileName || 'Fichier FEC') + '</h4></div><button type="button" class="btn btn-ghost btn-sm" data-action="close-fec-import-reversal">Fermer</button></div>' +
        '<div class="field"><label for="fec-reversal-entry">Écriture validée du lot</label><select id="fec-reversal-entry">' + options + '</select></div>' +
        '<div class="alert info"><div>Une écriture inverse est déjà liée à <strong>' + esc(selected.reference) + '</strong> : ' + esc(findFecImportReversal(allEntries, selected).reference) + ' · ' + esc(findFecImportReversal(allEntries, selected).status === 'posted' ? 'validée' : 'brouillon') + '. L’original est conservé.</div></div></section>';
    }
    var accountLines = (selected.lines || []).map(function (line) {
      var account = S.account(line.account);
      return '<tr><td>' + esc(line.account) + ' · ' + esc(account ? account.label : (line.accountLabel || '')) + '</td><td class="numeric">' + fecDisplayAmount(line.debit) + '</td><td class="numeric">' + fecDisplayAmount(line.credit) + '</td></tr>';
    }).join('');
    return '<section id="fec-import-reversal-panel" class="exchange-card"><div class="supplier-directory-head"><div><p class="page-kicker">ÉCRITURE INVERSE · IMPORT FEC</p><h4>' + esc(source.fileName || 'Fichier FEC') + '</h4><p>L’écriture d’origine reste validée et inchangée. L’inversion reprend les mêmes comptes et montants en côtés opposés, puis ajoute une pièce liée.</p></div><button type="button" class="btn btn-ghost btn-sm" data-action="close-fec-import-reversal">Fermer</button></div>' +
      '<div class="field"><label for="fec-reversal-entry">Écriture validée du lot</label><select id="fec-reversal-entry">' + options + '</select></div>' +
      '<div class="exchange-import-controls fec-import-controls">' +
        '<div class="field"><label for="fec-reversal-date">Date de l’écriture inverse</label><input id="fec-reversal-date" type="date" min="' + esc(S.currentDossier().cycleStart) + '" max="' + esc(S.currentDossier().cycleEnd) + '" value="' + esc(session.targetDate) + '"></div>' +
        '<div class="field"><label for="fec-reversal-journal">Journal de l’écriture inverse</label><select id="fec-reversal-journal">' + journalList.map(function (journal) {
          return '<option value="' + esc(journal.code) + '"' + (journal.code === session.targetJournal ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>';
        }).join('') + '</select></div>' +
        '<div class="field"><label for="fec-reversal-reference">Référence</label><input id="fec-reversal-reference" maxlength="100" value="' + esc(session.targetReference) + '"></div>' +
        '<div class="field"><label for="fec-reversal-mode">Statut de l’écriture inverse</label><select id="fec-reversal-mode"><option value="draft"' + (session.mode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (session.mode === 'posted' ? ' selected' : '') + '>Créer comme écriture validée</option></select></div>' +
        '<div class="field fec-reversal-reason"><label for="fec-reversal-reason">Motif de l’inversion</label><textarea id="fec-reversal-reason" maxlength="250" rows="2">' + esc(session.reason) + '</textarea></div>' +
      '</div>' +
      '<section class="exchange-card"><p class="page-kicker">ÉCRITURE SOURCE CONSERVÉE · ' + esc(selected.reference) + '</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte cible</th><th class="numeric">Débit source</th><th class="numeric">Crédit source</th></tr></thead><tbody>' + accountLines + '</tbody></table></div></section>' +
      '<div id="fec-reversal-preview" class="exchange-preview" aria-live="polite"><div class="empty-state"><strong>Vérification en cours</strong><span>Contrôle du lien, de la période et de l’équilibre.</span></div></div></section>';
  }

  function renderFecImportReversalPreview() {
    var host = $('#fec-reversal-preview');
    var session = fecImportReversalSession;
    if (!host || !session) return;
    var dossier = S.currentDossier();
    var original = S.entry(session.selectedEntryId);
    var allEntries = S.entries();
    if (!original || original.importBatchId !== session.batchId || original.sourceSystem !== 'FEC-BENIN' || original.status !== 'posted') {
      session.canCommit = false;
      host.innerHTML = '<div class="alert error">L’écriture FEC d’origine n’est plus disponible ou n’est pas validée.</div>';
      return;
    }
    var existing = findFecImportReversal(allEntries, original);
    if (existing) {
      session.canCommit = false;
      host.innerHTML = '<div class="alert warning">Une écriture inverse est déjà liée à cette pièce : ' + esc(existing.reference) + ' (' + esc(existing.status === 'posted' ? 'validée' : 'brouillon') + '). L’original reste conservé.</div>';
      return;
    }
    if (session.targetDossierId !== dossier.id) {
      session.canCommit = false;
      host.innerHTML = '<div class="alert error">Le dossier actif a changé depuis l’ouverture du panneau.</div>';
      return;
    }
    var built = buildFecImportReversalEntry(original, {
      date: session.targetDate,
      journal: session.targetJournal,
      reference: session.targetReference,
      reason: session.reason
    });
    var analysis = built.ok ? S.previewExchangeImport([built.entry], session.mode, { sourceSystem: FEC_IMPORT_REVERSAL_SOURCE })
      : { ok: false, errors: built.errors, warnings: [] };
    var canImport = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext(dossier));
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier));
    var permissionBlocked = !canImport || (session.mode === 'posted' && !canPost);
    var canCommit = built.ok && analysis.ok && !permissionBlocked;
    session.canCommit = canCommit;
    var errors = analysis.errors && analysis.errors.length
      ? '<div class="alert error"><div><strong>' + analysis.errors.length + ' contrôle(s) bloquant(s)</strong><ul>' + analysis.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
      : '<div class="alert success"><div><strong>Écriture inverse équilibrée</strong><br>Les lignes source ne sont pas modifiées ; une nouvelle pièce liée sera ajoutée.</div></div>';
    var permission = permissionBlocked
      ? '<div class="alert warning">' + (!canImport ? 'Le droit « data.import » est requis pour créer l’écriture inverse.' : 'Le droit « entry.validate » est requis pour créer une écriture inverse validée.') + '</div>'
      : '';
    var warnings = (analysis.warnings || []).length
      ? '<div class="alert warning"><ul>' + analysis.warnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul></div>' : '';
    var rows = (built.ok ? built.entry.lines : []).map(function (line) {
      return '<tr><td>' + esc(line.account) + '</td><td class="numeric">' + fecDisplayAmount(line.debit) + '</td><td class="numeric">' + fecDisplayAmount(line.credit) + '</td></tr>';
    }).join('');
    var table = rows ? '<section class="exchange-card"><p class="page-kicker">APERÇU DE LA NOUVELLE ÉCRITURE</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte</th><th class="numeric">Débit inverse</th><th class="numeric">Crédit inverse</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>' : '';
    var action = '<div class="exchange-preview-footer"><button type="button" class="btn btn-primary" data-action="commit-fec-import-reversal"' + (canCommit ? '' : ' disabled') + '>Créer l’écriture inverse · ' + (session.mode === 'posted' ? 'validée' : 'brouillon') + '</button></div>';
    host.innerHTML = errors + warnings + permission + table + action;
    applyDemoActionGates(host);
  }

  function bindFecImportReversal() {
    var session = fecImportReversalSession;
    var panel = $('#fec-import-reversal-panel');
    if (!session || !panel) return;
    var entryInput = $('#fec-reversal-entry', panel);
    if (entryInput) entryInput.addEventListener('change', function () {
      var entry = S.entry(entryInput.value);
      if (!entry) return;
      session.selectedEntryId = entry.id;
      session.targetDate = defaultFecImportReversalDate(entry, S.currentDossier());
      session.targetJournal = fecReversalJournal(entry);
      session.targetReference = session.targetDate && session.targetJournal ? S.nextReference(session.targetJournal, session.targetDate) : '';
      session.referenceTouched = false;
      session.reason = '';
      render();
    });
    var dateInput = $('#fec-reversal-date', panel);
    var journalInput = $('#fec-reversal-journal', panel);
    var referenceInput = $('#fec-reversal-reference', panel);
    var reasonInput = $('#fec-reversal-reason', panel);
    var modeInput = $('#fec-reversal-mode', panel);
    function syncAndPreview(control) {
      if (dateInput) session.targetDate = dateInput.value;
      if (journalInput) session.targetJournal = journalInput.value;
      if (control === dateInput || control === journalInput) {
        if (!session.referenceTouched && session.targetDate && session.targetJournal) {
          session.targetReference = S.nextReference(session.targetJournal, session.targetDate);
          if (referenceInput) referenceInput.value = session.targetReference;
        }
      }
      if (referenceInput) session.targetReference = referenceInput.value;
      if (control === referenceInput) session.referenceTouched = true;
      if (reasonInput) session.reason = reasonInput.value;
      if (modeInput) session.mode = modeInput.value === 'posted' ? 'posted' : 'draft';
      renderFecImportReversalPreview();
    }
    [dateInput, journalInput, modeInput].forEach(function (control) {
      if (control) control.addEventListener('change', function () { syncAndPreview(control); });
    });
    if (referenceInput) referenceInput.addEventListener('input', function () { syncAndPreview(referenceInput); });
    if (reasonInput) reasonInput.addEventListener('input', function () { syncAndPreview(reasonInput); });
    renderFecImportReversalPreview();
  }

  function commitFecImportReversal() {
    var session = fecImportReversalSession;
    if (!session) return;
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext())) {
      toast('Création de l’écriture inverse refusée : le droit « data.import » est requis.', 'warning');
      return;
    }
    if (session.mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext())) {
      toast('Validation refusée : choisissez le mode brouillon ou demandez le droit « entry.validate ».', 'warning');
      return;
    }
    renderFecImportReversalPreview();
    if (!session.canCommit) {
      toast('Écriture inverse bloquée : vérifiez le motif, le journal, la période et les contrôles affichés.', 'warning');
      return;
    }
    var original = S.entry(session.selectedEntryId);
    var built = buildFecImportReversalEntry(original, {
      date: session.targetDate,
      journal: session.targetJournal,
      reference: session.targetReference,
      reason: session.reason
    });
    if (!built.ok) { toast(built.errors[0] || 'Écriture inverse impossible.', 'error'); return; }
    if (!window.confirm('Ajouter une écriture ' + (session.mode === 'posted' ? 'validée' : 'brouillon') + ' qui inverse « ' + original.reference + ' » ? La pièce FEC d’origine restera validée et inchangée.')) return;
    var result = S.importExchange([built.entry], session.mode, { sourceSystem: FEC_IMPORT_REVERSAL_SOURCE });
    if (!result.ok) { toast(result.errors[0] || 'Écriture inverse impossible.', 'error'); return; }
    fecImportReversalSession = null;
    toast('Écriture inverse créée et liée à la pièce FEC d’origine ; aucune écriture historique n’a été supprimée.', 'success');
    render();
  }

  function fecFilenameCompliant(name) {
    var stem = String(name || '').replace(/\.(txt|csv)$/i, '');
    return /^FEC(?:[_ -]+)(?:IFU[_ -]+)?[A-Z0-9]+[_ -]+\d{8}(?:[_ -]+\d+)?$/i.test(stem);
  }

  function fecBytesToBase64(bytes) {
    var binary = '';
    for (var offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
    }
    return window.btoa(binary);
  }

  function fecBase64ToBytes(base64) {
    var binary = window.atob(String(base64 || ''));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function fecSha256(bytes) {
    if (!window.crypto || !window.crypto.subtle) return Promise.reject(new Error('SHA-256 indisponible dans ce contexte navigateur sécurisé.'));
    return window.crypto.subtle.digest('SHA-256', bytes).then(function (digest) {
      return Array.prototype.map.call(new Uint8Array(digest), function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function fecDisplayAmount(value) {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(Number(value) || 0);
  }

  function fecAccountMappingsHtml(session) {
    var catalog = Object.create(null);
    (session.parseResult.rows || []).forEach(function (row) {
      if (!catalog[row.account]) catalog[row.account] = row.accountLabel || '';
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    if (!codes.length) return '';
    var accounts = postingAccounts();
    return '<details class="exchange-mapping" open><summary>Correspondance des comptes (' + codes.length + ' codes source)</summary>' +
      '<p class="small muted">Les correspondances exactes sont seulement pré-sélectionnées comme propositions. Vérifiez chaque ligne et confirmez explicitement l’ensemble ; aucun compte n’est créé.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Compte FEC</th><th>Libellé source</th><th>Compte cible proposé / confirmé</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = session.accountMap[code] || '';
        var exactMatch = S.account(code);
        var selectOptions = '<option value="">— Choisir une correspondance —</option>' + accounts.map(function (account) {
          var inactive = account.active === false ? ' · inactif' : '';
          return '<option value="' + esc(account.code) + '"' + (account.code === mappedCode ? ' selected' : '') + '>' + esc(account.code + ' — ' + account.label + inactive) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(catalog[code] || '—') + '</td><td>' +
          '<select aria-label="Associer le compte FEC ' + esc(code) + '" data-fec-account-map="' + esc(code) + '">' + selectOptions + '</select>' +
          (exactMatch ? '<small class="hint">Code identique proposé ; confirmation requise.</small>' : '<small class="hint">Aucun code identique dans le plan cible.</small>') +
          '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function fecJournalMappingsHtml(session) {
    var catalog = Object.create(null);
    (session.parseResult.entries || []).forEach(function (entry) {
      if (!catalog[entry.journal]) catalog[entry.journal] = entry.journalLabel || '';
    });
    var codes = Object.keys(catalog).sort(function (a, b) { return a.localeCompare(b); });
    if (!codes.length) return '';
    var journals = S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; });
    return '<details class="exchange-mapping" open><summary>Correspondance des journaux (' + codes.length + ' codes source)</summary>' +
      '<p class="small muted">Associez chaque journal source à un journal actif du dossier cible. Le journal CEN et les journaux système sont exclus des imports externes.</p>' +
      '<div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Journal FEC</th><th>Libellé source</th><th>Journal cible</th></tr></thead><tbody>' +
      codes.map(function (code) {
        var mappedCode = session.journalMap[code] || '';
        var exactMatch = S.journal(code);
        var selectOptions = '<option value="">— Choisir un journal —</option>' + journals.map(function (journal) {
          return '<option value="' + esc(journal.code) + '"' + (journal.code === mappedCode ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>';
        }).join('');
        return '<tr><td><strong>' + esc(code) + '</strong></td><td>' + esc(catalog[code] || '—') + '</td><td>' +
          '<select aria-label="Associer le journal FEC ' + esc(code) + '" data-fec-journal-map="' + esc(code) + '">' + selectOptions + '</select>' +
          (exactMatch ? '<small class="hint">Code identique proposé ; confirmation requise.</small>' : '<small class="hint">Aucun code identique dans le dossier.</small>') +
          '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  function fecLinesPreviewHtml(session) {
    var rows = (session.parseResult.rows || []).slice(0, 20);
    var body = rows.map(function (row) {
      var targetCode = session.accountMap[row.account] || '';
      var targetAccount = targetCode ? S.account(targetCode) : null;
      return '<tr><td>' + esc(row.sourceRow) + '</td><td><strong>' + esc(row.journal) + ' · ' + esc(row.entryNumber) + '</strong><br><small>' + esc(row.date) + ' · validée le ' + esc(row.validationDate) + '</small></td>' +
        '<td><strong>' + esc(row.account) + '</strong><br><small>' + esc(row.accountLabel) + '</small></td>' +
        '<td class="numeric">' + esc(row.debitRaw || '—') + '</td><td class="numeric">' + esc(row.creditRaw || '—') + '</td>' +
        '<td>' + (row.signNormalized ? '<span class="badge draft">Signe reporté au côté opposé</span>' : '—') + '</td>' +
        '<td>' + esc(targetAccount ? targetAccount.code + ' — ' + targetAccount.label : 'À associer') + '</td></tr>';
    }).join('');
    var note = session.parseResult.rows.length > rows.length
      ? '<p class="small muted">Aperçu des ' + rows.length + ' premières lignes sur ' + session.parseResult.rows.length + '. Les contrôles couvrent tout le fichier.</p>'
      : '';
    return '<section class="exchange-card fec-lines-preview"><p class="page-kicker">APERÇU DES LIGNES FEC</p><div class="exchange-table-wrap"><table class="exchange-mapping-table"><thead><tr><th>Ligne</th><th>Journal · écriture</th><th>Compte source</th><th class="numeric">Débit source</th><th class="numeric">Crédit source</th><th>Signe</th><th>Compte cible</th></tr></thead><tbody>' + body + '</tbody></table></div>' + note + '</section>';
  }

  function renderFecImportPreview() {
    var host = $('#fec-import-preview');
    var session = fecImportSession;
    if (!host || !session) return;
    if (session.pending) {
      host.innerHTML = '<div class="alert info">Lecture du fichier et calcul de l’empreinte SHA-256 en cours…</div>';
      return;
    }
    var parsed = session.parseResult;
    if (!parsed || !parsed.ok) {
      var parseErrors = parsed && parsed.errors || ['Le fichier FEC n’a pas pu être analysé.'];
      host.innerHTML = '<div class="alert error"><div><strong>Fichier FEC non reconnu ou invalide</strong><ul>' +
        parseErrors.slice(0, 20).map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') +
        (parseErrors.length > 20 ? '<li>… et ' + (parseErrors.length - 20) + ' autre(s) erreur(s).</li>' : '') + '</ul></div></div>';
      session.analysis = null;
      session.canCommit = false;
      return;
    }
    var modeSelect = $('#fec-import-mode');
    session.mode = modeSelect && modeSelect.value === 'posted' ? 'posted' : 'draft';
    var options = { sourceSystem: FecImport.FORMAT, accountMap: session.accountMap, journalMap: session.journalMap };
    var analysis = S.previewExchangeImport(parsed.entries, session.mode, options);
    session.analysis = analysis;
    var canImport = hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext());
    var canPost = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext());
    var permissionBlocked = !canImport || (session.mode === 'posted' && !canPost);
    var sourceDuplicate = S.importSourceFiles().some(function (source) { return source.sha256 === session.sha256; });
    var nameCompliant = fecFilenameCompliant(session.fileName);
    var nameBlocked = !nameCompliant && !session.fileNameConfirmed;
    var dossierMismatch = session.targetDossierId !== S.currentDossier().id;
    var canCommit = analysis.ok && session.complianceConfirmed && session.mappingsConfirmed && !permissionBlocked &&
      !sourceDuplicate && !nameBlocked && !dossierMismatch && !!session.contentBase64;
    session.canCommit = canCommit;

    var dateRange = parsed.metadata.dateRange || {};
    var summary = '<div class="exchange-summary-grid fec-summary-grid">' +
      '<div><small>Fichier source</small><strong>' + esc(session.fileName || '—') + '</strong></div>' +
      '<div><small>Schéma FEC</small><strong>' + parsed.metadata.headerCount + ' champs · ' + (parsed.metadata.amountVariant === 'amount-sense' ? 'Montant/sens' : 'Débit/crédit') + '</strong></div>' +
      '<div><small>Lecture</small><strong>' + esc(session.encodingLabel || session.encoding) + ' · ' + esc(parsed.metadata.delimiter) + ' · ' + esc(parsed.metadata.recordSeparator) + '</strong></div>' +
      '<div><small>Écritures / lignes</small><strong>' + parsed.metadata.entryCount + ' · ' + parsed.metadata.lineCount + '</strong></div>' +
      '<div><small>Période de validation</small><strong>' + esc(dateRange.firstValidationDate || '—') + ' → ' + esc(dateRange.lastValidationDate || '—') + '</strong></div>' +
      '<div><small>Totaux de contrôle source</small><strong>' + fecDisplayAmount(parsed.metadata.totalDebit) + ' / ' + fecDisplayAmount(parsed.metadata.totalCredit) + ' XOF</strong></div>' +
      '</div>';
    var duplicateAlert = sourceDuplicate
      ? '<div class="alert error"><strong>Import bloqué :</strong> le même fichier source a déjà été importé dans ce dossier.</div>' : '';
    var nameAlert = !nameCompliant
      ? '<div class="alert warning"><div><strong>Nom de fichier à vérifier</strong><br>Le nom ne correspond pas au motif FEC/IFU/date de clôture décrit par l’arrêté (ou le nom est anonymisé).<label class="exchange-context-confirm"><input id="fec-import-confirm-filename" type="checkbox"' + (session.fileNameConfirmed ? ' checked' : '') + '> Je confirme que ce nom est intentionnel pour ce fichier.</label></div></div>' : '';
    var errors = analysis.errors.length
      ? '<div class="alert error"><div><strong>' + analysis.errors.length + ' contrôle(s) bloquant(s)</strong><ul>' +
        analysis.errors.slice(0, 20).map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') +
        (analysis.errors.length > 20 ? '<li>… et ' + (analysis.errors.length - 20) + ' autre(s) erreur(s).</li>' : '') + '</ul></div></div>'
      : '<div class="alert success"><div><strong>Contrôles de conversion réussis</strong><br>' + analysis.balancedCount + ' pièce(s) équilibrée(s) dans le plan cible.</div></div>';
    var warnings = parsed.warnings.concat(analysis.warnings || []);
    var warningsHtml = warnings.length
      ? '<div class="alert warning"><div><strong>Informations de conversion</strong><ul>' + warnings.map(function (message) { return '<li>' + esc(message) + '</li>'; }).join('') + '</ul></div></div>' : '';
    var permissionNotice = permissionBlocked
      ? '<div class="alert warning">' + (!canImport ? 'Le droit « data.import » est requis.' : 'Ce profil ne possède pas le droit « Valider une écriture » ; choisissez le mode brouillon.') + '</div>' : '';
    var dossierNotice = dossierMismatch ? '<div class="alert error">Le dossier actif a changé depuis la sélection du fichier. Rechargez le fichier dans le dossier cible avant import.</div>' : '';
    var filenameText = nameCompliant ? '' : '<p class="small muted">Nom détecté comme non conforme ou non standard ; aucune IFU ni date de clôture n’est déduite automatiquement.</p>';
    var mappingConfirmation = '<label class="exchange-context-confirm"><input id="fec-import-confirm-mappings" type="checkbox"' + (session.mappingsConfirmed ? ' checked' : '') + '> Je confirme les correspondances de comptes et de journaux affichées.</label>';
    var complianceConfirmation = '<label class="exchange-context-confirm"><input id="fec-import-confirm-compliance" type="checkbox"' + (session.complianceConfirmed ? ' checked' : '') + '> Je confirme que la source contient des écritures validées, sans centralisation ni soldes de charges/produits, et que l’ajout est intentionnel.</label>';
    var modeLabel = session.mode === 'posted' ? 'écritures validées' : 'brouillons';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-fec-import"' + (canCommit ? '' : ' disabled') + '>Importer ' + parsed.metadata.entryCount + ' écriture(s) comme ' + modeLabel + '</button>';
    var statusNote = '<p class="exchange-mode-note">Mode choisi : <strong>' + modeLabel + '</strong>. Le statut source validé ne valide pas automatiquement les écritures dans le dossier cible.</p>';
    host.innerHTML = summary + filenameText + duplicateAlert + nameAlert +
      fecAccountMappingsHtml(session) + fecJournalMappingsHtml(session) + fecLinesPreviewHtml(session) +
      warningsHtml + errors + dossierNotice + permissionNotice + mappingConfirmation + complianceConfirmation + statusNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);

    $$('[data-fec-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-fec-account-map')] = select.value;
        session.mappingsConfirmed = false;
        renderFecImportPreview();
      });
    });
    $$('[data-fec-journal-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.journalMap[select.getAttribute('data-fec-journal-map')] = select.value;
        session.mappingsConfirmed = false;
        renderFecImportPreview();
      });
    });
    var mappingConfirm = $('#fec-import-confirm-mappings', host);
    if (mappingConfirm) mappingConfirm.addEventListener('change', function () { session.mappingsConfirmed = mappingConfirm.checked; renderFecImportPreview(); });
    var complianceConfirm = $('#fec-import-confirm-compliance', host);
    if (complianceConfirm) complianceConfirm.addEventListener('change', function () { session.complianceConfirmed = complianceConfirm.checked; renderFecImportPreview(); });
    var filenameConfirm = $('#fec-import-confirm-filename', host);
    if (filenameConfirm) filenameConfirm.addEventListener('change', function () { session.fileNameConfirmed = filenameConfirm.checked; renderFecImportPreview(); });
  }

  function parseFecImportSession() {
    var session = fecImportSession;
    if (!session || !session.rawBytes) return;
    var encodingInput = $('#fec-import-encoding');
    var delimiterInput = $('#fec-import-delimiter');
    session.encoding = encodingInput ? encodingInput.value : 'iso-8859-15';
    session.encodingLabel = encodingInput && encodingInput.selectedOptions[0] ? encodingInput.selectedOptions[0].textContent : session.encoding;
    session.delimiterOption = delimiterInput ? delimiterInput.value : 'auto';
    session.complianceConfirmed = false;
    session.mappingsConfirmed = false;
    try {
      var decoded = FecImport.decodeBytes(session.rawBytes, session.encoding);
      session.decodedText = decoded;
      session.parseResult = FecImport.parse(decoded, {
        fileName: session.fileName,
        fileHash: session.sha256,
        encoding: session.encoding,
        delimiter: session.delimiterOption
      });
      if (session.parseResult.ok) {
        var accountMap = Object.create(null);
        var journalMap = Object.create(null);
        session.parseResult.rows.forEach(function (row) {
          if (!Object.prototype.hasOwnProperty.call(accountMap, row.account)) accountMap[row.account] = S.account(row.account) ? row.account : '';
        });
        session.parseResult.entries.forEach(function (entry) {
          if (!Object.prototype.hasOwnProperty.call(journalMap, entry.journal)) journalMap[entry.journal] = S.journal(entry.journal) ? entry.journal : '';
        });
        session.accountMap = accountMap;
        session.journalMap = journalMap;
      }
    } catch (error) {
      session.parseResult = { ok: false, errors: [error.message || 'Décodage du FEC impossible.'], entries: [], rows: [], metadata: null, warnings: [] };
    }
    renderFecImportPreview();
  }

  function bindAccountingFecImport() {
    var fileInput = $('#fec-import-file');
    var encodingInput = $('#fec-import-encoding');
    var delimiterInput = $('#fec-import-delimiter');
    var modeInput = $('#fec-import-mode');
    if (!fileInput || !encodingInput || !delimiterInput || !modeInput) return;
    [encodingInput, delimiterInput].forEach(function (input) {
      input.addEventListener('change', function () { parseFecImportSession(); });
    });
    modeInput.addEventListener('change', function () { renderFecImportPreview(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var readSequence = ++fecImportReadSequence;
      fecImportSession = { fileName: file.name, pending: true, parseResult: null };
      renderFecImportPreview();
      if (file.size > 1024 * 1024) {
        fecImportSession = { fileName: file.name, parseResult: { ok: false, errors: ['Le fichier dépasse 1 Mo dans ce prototype local. Fractionnez-le conformément à la norme, ou utilisez un stockage organisationnel avant d’augmenter cette limite.'], entries: [], rows: [], metadata: null } };
        renderFecImportPreview();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        if (readSequence !== fecImportReadSequence) return;
        var bytes = new Uint8Array(reader.result || new ArrayBuffer(0));
        fecSha256(bytes).then(function (sha256) {
          if (readSequence !== fecImportReadSequence) return;
          fecImportSession = {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'text/plain',
            targetDossierId: S.currentDossier().id,
            rawBytes: bytes,
            contentBase64: fecBytesToBase64(bytes),
            sha256: sha256,
            fileNameConfirmed: false,
            complianceConfirmed: false,
            mappingsConfirmed: false,
            mode: modeInput.value === 'posted' ? 'posted' : 'draft',
            parseResult: null,
            accountMap: Object.create(null),
            journalMap: Object.create(null),
            analysis: null
          };
          parseFecImportSession();
        }).catch(function (error) {
          if (readSequence !== fecImportReadSequence) return;
          fecImportSession = { fileName: file.name, parseResult: { ok: false, errors: [error.message || 'Empreinte SHA-256 impossible.'], entries: [], rows: [], metadata: null } };
          renderFecImportPreview();
        });
      };
      reader.onerror = function () {
        if (readSequence !== fecImportReadSequence) return;
        fecImportSession = { fileName: file.name, parseResult: { ok: false, errors: ['Lecture du fichier impossible.'], entries: [], rows: [], metadata: null } };
        renderFecImportPreview();
      };
      reader.readAsArrayBuffer(file);
    });
    bindFecImportReversal();
  }

  function commitAccountingFecImport() {
    var session = fecImportSession;
    if (!session || !session.parseResult || !session.parseResult.ok) {
      toast('Aucun fichier FEC valide n’est prêt à être importé.', 'error');
      return;
    }
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.import', accountingAccessContext())) {
      toast('Import FEC refusé par défaut : le droit « data.import » n’est pas accordé.', 'warning');
      return;
    }
    if (session.targetDossierId !== S.currentDossier().id) {
      toast('Le dossier actif a changé. Rechargez et contrôlez le FEC dans le bon dossier.', 'error');
      return;
    }
    if (session.mode === 'posted' && !hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext())) {
      toast('La validation comptable est refusée : choisissez le mode brouillon ou demandez le droit « entry.validate ».', 'warning');
      return;
    }
    renderFecImportPreview();
    if (!session.canCommit) {
      toast('Import bloqué : vérifiez les correspondances, confirmations et contrôles de l’aperçu.', 'warning');
      return;
    }
    var sourceFile = {
      sourceSystem: 'FEC-BENIN',
      fileName: session.fileName,
      mimeType: session.mimeType,
      fileSize: session.fileSize,
      byteLength: session.fileSize,
      sha256: session.sha256,
      contentBase64: session.contentBase64,
      encoding: session.encoding,
      delimiter: session.parseResult.metadata.delimiter,
      recordSeparator: session.parseResult.metadata.recordSeparator,
      headerCount: session.parseResult.metadata.headerCount,
      amountVariant: session.parseResult.metadata.amountVariant,
      lineCount: session.parseResult.metadata.lineCount,
      entryCount: session.parseResult.metadata.entryCount,
      complianceConfirmed: session.complianceConfirmed,
      fileNameConfirmed: session.fileNameConfirmed,
      localOnly: true
    };
    var result = S.importExchange(session.parseResult.entries, session.mode, {
      sourceSystem: 'FEC-BENIN',
      accountMap: session.accountMap,
      journalMap: session.journalMap,
      importSourceFile: sourceFile
    });
    if (!result.ok) {
      toast(result.errors[0] || 'Import FEC impossible. Aucun changement n’a été conservé.', 'error');
      return;
    }
    var statusLabel = session.mode === 'posted' ? 'écriture(s) validée(s)' : 'brouillon(s)';
    toast(result.importedCount + ' ' + statusLabel + ' importé(s). Le fichier source est conservé localement.', 'success');
    fecImportSession = null;
    render();
  }

  function downloadFecSource(sourceId) {
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.export', accountingAccessContext())) {
      toast('Téléchargement refusé : le droit « data.export » est requis.', 'warning');
      return;
    }
    var source = S.importSourceFile(sourceId);
    if (!source || !source.contentBase64) {
      toast('Fichier source FEC introuvable dans le stockage local.', 'error');
      return;
    }
    downloadFile(source.fileName || 'source-fec.txt', fecBase64ToBytes(source.contentBase64), source.mimeType || 'text/plain');
    toast('Fichier FEC original téléchargé depuis le stockage local.', 'success');
  }

  function cancelFecImportBatch(batchId) {
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.delete', accountingAccessContext())) {
      toast('Annulation refusée par défaut : le droit « draft.delete » n’est pas accordé.', 'warning');
      return;
    }
    var source = S.importSourceFiles().find(function (record) { return record.id === batchId; });
    if (!source) { toast('Lot FEC introuvable.', 'error'); return; }
    if (!window.confirm('Annuler les brouillons de ce lot FEC ? Le fichier source et sa trace seront conservés ; aucune écriture validée ne sera supprimée.')) return;
    var result = S.cancelImportBatch(batchId);
    if (!result.ok) { toast(result.errors[0] || 'Annulation du lot impossible.', 'error'); return; }
    toast(result.cancelledCount + ' brouillon(s) annulé(s) ; le FEC source reste archivé localement.', 'success');
    render();
  }

  function viewAccountingBalanceImport() {
    var dossier = S.currentDossier();
    var journals = S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; });
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
          return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>';
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
    var targetOptions = isAccount ? postingAccounts() : S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; });
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
          var inactive = target.active === false ? ' · inactif' : '';
          var displayLabel = isAccount ? target.code + ' — ' + targetLabel + inactive : journalDisplayName(target) + inactive;
          return '<option value="' + esc(target.code) + '"' + selected + '>' + esc(displayLabel) + '</option>';
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
      mappingsConfirmed: false,
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
    return '<details class="exchange-mapping" open><summary>Correspondance des comptes du journal interne (' + codes.length + ' codes)</summary>' +
      '<p class="small muted">Le plan de Paie & RH est comparé au plan comptable général du dossier. Les codes identiques sont pré-sélectionnés comme propositions ; vérifiez chaque ligne et confirmez explicitement l’ensemble. Aucun compte n’est créé.</p>' +
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
    var canCommit = aggregate.ok && analysis.ok && session.mappingsConfirmed && !permissionBlocked && !additiveBlocked;
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
    var mappingConfirmation = '<label class="exchange-context-confirm"><input id="payroll-centralization-confirm-mappings" type="checkbox"' + (session.mappingsConfirmed ? ' checked' : '') + '> Je confirme les correspondances affichées entre le journal Paie & RH et le plan comptable général du dossier.</label>';
    var additiveWarning = existingPostedCount
      ? '<div class="alert warning"><div><strong>Le dossier contient déjà ' + existingPostedCount + ' écriture(s) validée(s) sur le cycle.</strong><br>La centralisation s’ajoutera au grand livre ; vérifiez que ce lot de paie n’est pas déjà comptabilisé.<label class="exchange-context-confirm"><input id="payroll-centralization-confirm-additive" type="checkbox"' + (session.additiveConfirmed ? ' checked' : '') + '> Je confirme l’ajout sans remplacement des écritures existantes.</label></div></div>'
      : '';
    var permissionNote = permissionBlocked
      ? '<div class="alert warning">Droits requis : consulter Paie & RH, importer dans la Comptabilité et, pour une écriture validée, disposer aussi du droit de validation comptable.</div>'
      : '';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-payroll-centralization"' + (canCommit ? '' : ' disabled') + '>Centraliser comme ' + (session.mode === 'posted' ? 'écriture validée' : 'brouillon') + '</button>';
    host.innerHTML = summary + sourceTable + payrollCentralizationMappingsHtml(session, run) + mappingConfirmation +
      (aggregate.ok ? payrollCentralizationOutputHtml(aggregate.lines) : '') + warnings + errors + additiveWarning + permissionNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);
    $$('[data-payroll-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-payroll-account-map')] = select.value;
        session.mappingsConfirmed = false;
        session.additiveConfirmed = !!(host.querySelector('#payroll-centralization-confirm-additive') && host.querySelector('#payroll-centralization-confirm-additive').checked);
        renderPayrollCentralizationPreview();
      });
    });
    var confirmMappings = $('#payroll-centralization-confirm-mappings', host);
    if (confirmMappings) confirmMappings.addEventListener('change', function () {
      session.mappingsConfirmed = confirmMappings.checked;
      renderPayrollCentralizationPreview();
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
    var mappingsBlocked = !session.mappingsConfirmed;
    if (linkedEntry || !analysis.ok || additiveBlocked || mappingsBlocked) {
      renderPayrollCentralizationPreview();
      toast(linkedEntry
        ? 'Ce lot Paie & RH a déjà été centralisé ; un transfert en doublon est refusé.'
        : (additiveBlocked ? 'Confirmez l’ajout au grand livre existant.' : (mappingsBlocked ? 'Confirmez les correspondances entre le module source et le plan comptable général.' : 'La centralisation est bloquée par les contrôles affichés.')), 'warning');
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
        '<div class="field"><label for="payroll-centralization-journal">Journal général</label><select id="payroll-centralization-journal" required>' + S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; }).map(function (journal) { return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>'; }).join('') + '</select><span class="hint">Le journal « Paie (PA) » est proposé par défaut ; aucun journal n’est créé.</span></div>' +
        '<div class="field"><label for="payroll-centralization-reference">Référence comptable</label><input id="payroll-centralization-reference" type="text" maxlength="100" value="' + esc(targetReference) + '" required></div>' +
        '<div class="field"><label for="payroll-centralization-mode">Statut de la pièce</label><select id="payroll-centralization-mode"><option value="draft"' + (targetMode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (targetMode === 'posted' ? ' selected' : '') + '>Importer comme écriture validée</option></select><span class="hint">La validation exige une période ouverte et les droits comptables nécessaires.</span></div>' +
      '</div>'
      : '';
    return '<div class="exchange-workspace payroll-centralization-workspace">' +
      '<div class="alert info"><div><strong>Opération de Comptabilité générale · Paie & RH → grand livre</strong><br>Cette centralisation générale est disponible pour un lot interne approuvé. La pièce alimente le grand livre général ; aucune imputation, ventilation ou écriture analytique n’est créée. Aucun CSV, Excel ou logiciel tiers n’est lu par ce parcours ; les calculs de paie restent dans leur module source.</div></div>' +
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
    var defaultJournal = S.journals().find(function (journal) { return journal.code === 'VTE'; }) || S.journals().find(function (journal) { return journal.code === 'OD'; }) || S.journals()[0];
    var parts = run.period.split('-');
    return {
      runId: run.id,
      targetDossierId: dossier.id,
      targetDate: run.date,
      targetJournal: defaultJournal && defaultJournal.code || '',
      targetReference: 'VTE-' + parts[0] + '-' + parts[1] + '-001',
      mode: 'draft',
      accountMap: accountMap,
      mappingsConfirmed: false,
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
    return '<details class="exchange-mapping" open><summary>Correspondance des comptes du journal interne (' + codes.length + ' codes)</summary>' +
      '<p class="small muted">Le plan de Ventes, stock & facturation est comparé au plan comptable général du dossier. Les codes identiques sont pré-sélectionnés comme propositions ; vérifiez chaque ligne et confirmez explicitement l’ensemble. Aucun compte n’est créé.</p>' +
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
    var canCommit = aggregate.ok && analysis.ok && session.mappingsConfirmed && !permissionBlocked && !additiveBlocked;
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
    var mappingConfirmation = '<label class="exchange-context-confirm"><input id="sales-centralization-confirm-mappings" type="checkbox"' + (session.mappingsConfirmed ? ' checked' : '') + '> Je confirme les correspondances affichées entre Ventes, stock & facturation et le plan comptable général du dossier.</label>';
    var additiveWarning = existingPostedCount
      ? '<div class="alert warning"><div><strong>Le dossier contient déjà ' + existingPostedCount + ' écriture(s) validée(s) sur le cycle.</strong><br>La centralisation s’ajoutera au grand livre ; vérifiez que ce lot n’est pas déjà comptabilisé.<label class="exchange-context-confirm"><input id="sales-centralization-confirm-additive" type="checkbox"' + (session.additiveConfirmed ? ' checked' : '') + '> Je confirme l’ajout sans remplacement des écritures existantes.</label></div></div>'
      : '';
    var permissionNote = permissionBlocked
      ? '<div class="alert warning">Droits requis : consulter Ventes, stock & facturation, importer dans la Comptabilité et, pour une écriture validée, disposer aussi du droit de validation comptable.</div>'
      : '';
    var button = '<button type="button" class="btn btn-primary" data-action="commit-accounting-sales-centralization"' + (canCommit ? '' : ' disabled') + '>Centraliser comme ' + (session.mode === 'posted' ? 'écriture validée' : 'brouillon') + '</button>';
    host.innerHTML = summary + sourceTable + salesCentralizationMappingsHtml(session, run) + mappingConfirmation +
      (aggregate.ok ? salesCentralizationOutputHtml(aggregate.lines) : '') + warnings + errors + additiveWarning + permissionNote +
      '<div class="exchange-preview-footer">' + button + '</div>';
    applyDemoActionGates(host);
    $$('[data-sales-account-map]', host).forEach(function (select) {
      select.addEventListener('change', function () {
        session.accountMap[select.getAttribute('data-sales-account-map')] = select.value;
        session.mappingsConfirmed = false;
        session.additiveConfirmed = !!(host.querySelector('#sales-centralization-confirm-additive') && host.querySelector('#sales-centralization-confirm-additive').checked);
        renderSalesCentralizationPreview();
      });
    });
    var confirmMappings = $('#sales-centralization-confirm-mappings', host);
    if (confirmMappings) confirmMappings.addEventListener('change', function () {
      session.mappingsConfirmed = confirmMappings.checked;
      renderSalesCentralizationPreview();
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
    var mappingsBlocked = !session.mappingsConfirmed;
    if (linkedEntry || !analysis.ok || additiveBlocked || mappingsBlocked) {
      renderSalesCentralizationPreview();
      toast(linkedEntry
        ? 'Ce lot Ventes, stock & facturation a déjà été centralisé ; le doublon est refusé.'
        : (additiveBlocked ? 'Confirmez l’ajout au grand livre existant.' : (mappingsBlocked ? 'Confirmez les correspondances entre le module source et le plan comptable général.' : 'La centralisation est bloquée par les contrôles affichés.')), 'warning');
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
    var targetJournal = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetJournal : (S.journals().find(function (journal) { return journal.code === 'VTE'; }) || S.journals()[0] || {}).code || '';
    var targetReference = existingSession && selectedRun && existingSession.runId === selectedRun.id ? existingSession.targetReference : (selectedRun ? 'VTE-' + selectedRun.period + '-001' : '');
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
        '<div class="field"><label for="sales-centralization-journal">Journal général</label><select id="sales-centralization-journal" required>' + S.journals().filter(function (journal) { return !journal.retired && !journal.systemManaged && journal.code !== 'CEN'; }).map(function (journal) { return '<option value="' + esc(journal.code) + '"' + (journal.code === targetJournal ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>'; }).join('') + '</select><span class="hint">Le journal « Ventes (VTE) » est proposé par défaut ; aucun journal n’est créé.</span></div>' +
        '<div class="field"><label for="sales-centralization-reference">Référence comptable</label><input id="sales-centralization-reference" type="text" maxlength="100" value="' + esc(targetReference) + '" required></div>' +
        '<div class="field"><label for="sales-centralization-mode">Statut de la pièce</label><select id="sales-centralization-mode"><option value="draft"' + (targetMode === 'draft' ? ' selected' : '') + '>Créer un brouillon (recommandé)</option><option value="posted"' + (targetMode === 'posted' ? ' selected' : '') + '>Importer comme écriture validée</option></select><span class="hint">La validation exige une période ouverte et les droits comptables nécessaires.</span></div>' +
      '</div>'
      : '';
    return '<div class="exchange-workspace sales-centralization-workspace">' +
      '<div class="alert info"><div><strong>Opération de Comptabilité générale · Ventes, stock & facturation → grand livre</strong><br>Cette centralisation générale est disponible pour un lot interne approuvé. La pièce alimente le grand livre général ; aucune imputation, ventilation ou écriture analytique n’est créée. Aucun CSV, Excel ou logiciel tiers n’est lu par ce parcours ; les règles de facturation et de valorisation du stock restent à construire.</div></div>' +
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
    var originalJournal = original && S.journal(original.journal);
    var candidateCode = originalJournal && originalJournal.retired ? originalJournal.replacedBy : (originalJournal && originalJournal.code);
    var candidateJournal = candidateCode && S.journal(candidateCode);
    var journal = candidateJournal && !candidateJournal.retired && !candidateJournal.systemManaged ? candidateJournal.code : '';
    if (!journal) journal = (S.journals().find(function (item) { return item.code === 'OD' && !item.retired && !item.systemManaged; }) || S.journals()[0] || {}).code || '';
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
        '<td>' + esc(dateLabel(entry.date)) + '<br><span class="small muted">Journal ' + esc(journalDisplayName(S.journal(entry.journal)) || entry.journal) + ' · ' + esc(amount(entryAmount(entry))) + ' XOF</span></td>' +
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
      (result.journalCode ? ' · journal : ' + esc(journalDisplayName(S.journal(result.journalCode)) || result.journalCode) : ' · tous les journaux') +
      '. Aucun brouillon ni nouvelle écriture n’est ajouté au grand livre.</p></div>';
  }

  function viewAccountingConsolidation(stage) {
    var stageOptions = consolidationStageOptions(stage);
    var session = ensureAccountingConsolidationSession(stageOptions.key);
    var dossier = S.currentDossier();
    var prefix = 'consolidation-' + stageOptions.key + '-result';
    var journalOptions = '<option value="">Tous les journaux</option>' + S.journals().map(function (journal) {
      return '<option value="' + esc(journal.code) + '"' + (journal.code === session.journalCode ? ' selected' : '') + '>' + esc(journalDisplayName(journal)) + '</option>';
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

  function filteredServices(records, query, status) {
    var needle = String(query || '').trim().toLocaleLowerCase();
    return records.filter(function (record) {
      if (status === 'active' && record.active === false) return false;
      if (status === 'archived' && record.active !== false) return false;
      if (!needle) return true;
      return [record.code, record.name, record.description].join(' ').toLocaleLowerCase().indexOf(needle) !== -1;
    });
  }

  function serviceRowsHtml(records) {
    var filter = ui.services || { q: '', status: 'active' };
    return filteredServices(records, filter.q, filter.status).map(function (record) {
      var archived = record.active === false;
      var referenceCount = S.serviceReferenceCount(record.id);
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong></td>' +
        '<td><strong>' + esc(record.name) + '</strong>' + (record.description ? '<br><small>' + esc(record.description) + '</small>' : '') + '</td>' +
        '<td><span class="badge ' + (archived ? 'draft' : 'posted') + '">' + (archived ? 'Archivée' : 'Active') + '</span></td>' +
        '<td><div class="supplier-row-actions service-row-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-service" data-id="' + esc(record.id) + '" aria-label="Modifier la prestation ' + esc(record.name) + '">Modifier</button>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-action="archive-service" data-id="' + esc(record.id) + '">' + (archived ? 'Réactiver' : 'Archiver') + '</button>' +
          '<button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-service" data-id="' + esc(record.id) + '"' + (referenceCount ? ' disabled title="Une écriture ou un mouvement référence cette prestation ; archivez-la plutôt."' : '') + '>Supprimer</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');
  }

  function viewServices() {
    var records = S.services().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var activeCount = records.filter(function (record) { return record.active !== false; }).length;
    var archivedCount = records.length - activeCount;
    var filter = ui.services || (ui.services = { q: '', status: 'active' });
    var statusOptions = [
      { value: 'active', label: 'Prestations actives' },
      { value: 'archived', label: 'Prestations archivées' },
      { value: 'all', label: 'Toutes les prestations' }
    ].map(function (option) {
      return '<option value="' + option.value + '"' + (filter.status === option.value ? ' selected' : '') + '>' + option.label + '</option>';
    }).join('');
    var visibleCount = filteredServices(records, filter.q, filter.status).length;
    var emptyMessage = records.length
      ? 'Aucune prestation ne correspond à cette recherche et à ce filtre.'
      : 'Aucune prestation n’est encore définie dans ce dossier. Créez une fiche pour commencer le référentiel.';
    return '<div class="exchange-workspace service-workspace" id="service-workspace">' +
      '<div class="alert info"><div><strong>Référentiel local des prestations du dossier.</strong> Cette étape conserve le code, la désignation, une description et l’état actif ou archivé. Elle ne crée pas de facture, de prix, de TVA, d’écriture ou de centralisation ; les règles de vente et le lien avec Ventes, stock & facturation restent à construire.</div></div>' +
      '<div class="exchange-summary-grid service-summary-grid" aria-label="Résumé des prestations">' +
        '<div><small>Prestations actives</small><strong>' + activeCount + '</strong></div>' +
        '<div><small>Prestations archivées</small><strong>' + archivedCount + '</strong></div>' +
        '<div><small>Résultats affichés</small><strong id="service-visible-count">' + visibleCount + '</strong></div>' +
      '</div>' +
      '<section class="exchange-card service-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Catalogue des prestations</h4><p>Codes uniques par dossier, désignations modifiables et archivage réversible.</p></div>' +
          '<button type="button" class="btn btn-primary" data-action="new-service">＋ Nouvelle prestation</button></div>' +
        '<form id="service-filter-form" class="supplier-filter-controls service-filter-controls" role="search">' +
          '<label class="field"><span>Rechercher</span><input id="service-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, désignation, description…" autocomplete="off"></label>' +
          '<label class="field"><span>État</span><select id="service-status">' + statusOptions + '</select></label>' +
        '</form>' +
        '<p class="supplier-result-note" id="service-result-note">' + visibleCount + (visibleCount === 1 ? ' prestation affichée.' : ' prestations affichées.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap service-table-wrap" id="service-table-wrap"' + (visibleCount ? '' : ' hidden') + '>' +
          '<table class="exchange-mapping-table service-table"><caption class="sr-only">Prestations du dossier actif</caption><thead><tr>' +
            '<th>Code</th><th>Désignation / description</th><th>État</th><th>Actions</th>' +
          '</tr></thead><tbody id="service-rows">' + serviceRowsHtml(records) + '</tbody></table>' +
        '</div>' +
        '<div id="service-list-empty" class="empty-state supplier-empty"' + (visibleCount ? ' hidden' : '') + '><span class="empty-state-icon">▧</span><h3>Aucune prestation à afficher</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">Les codes supprimés restent réservés et ne seront pas réattribués. Le référentiel est isolé par dossier et inclus dans les sauvegardes et exports JSON locaux.</p>' +
    '</div>';
  }

  function refreshServiceRows() {
    var records = S.services().slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); });
    var filter = ui.services || { q: '', status: 'active' };
    var visible = filteredServices(records, filter.q, filter.status);
    var rows = $('#service-rows');
    var tableWrap = $('#service-table-wrap');
    var empty = $('#service-list-empty');
    var count = $('#service-visible-count');
    var note = $('#service-result-note');
    if (rows) rows.innerHTML = serviceRowsHtml(records);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      empty.querySelector('p').textContent = records.length
        ? 'Aucune prestation ne correspond à cette recherche et à ce filtre.'
        : 'Aucune prestation n’est encore définie dans ce dossier. Créez une fiche pour commencer le référentiel.';
    }
    if (count) count.textContent = String(visible.length);
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' prestation affichée.' : ' prestations affichées.');
    applyDemoActionGates(rows);
  }

  function bindServicesView() {
    var form = $('#service-filter-form');
    if (!form) return;
    var search = $('#service-search', form);
    var status = $('#service-status', form);
    function update() {
      ui.services = ui.services || { q: '', status: 'active' };
      ui.services.q = search ? search.value : '';
      ui.services.status = status ? status.value : 'active';
      refreshServiceRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
    if (status) status.addEventListener('change', update);
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

  function fixedAssetTypeLabel(type) {
    return { corporelle: 'Corporelle', incorporelle: 'Incorporelle', financiere: 'Financière' }[type] || 'Nature non définie';
  }

  function fixedAssetStatusLabel(status) {
    return { 'en-service': 'En service', 'en-cours': 'En cours', retiree: 'Retiré' }[status] || 'État non défini';
  }

  function fixedAssetMethodLabel(method) {
    return { 'a-definir': 'À définir', lineaire: 'Linéaire', degressif: 'Dégressif', 'unites-oeuvre': 'Unités d’œuvre', aucun: 'Non amortissable' }[method] || 'Méthode non définie';
  }

  function fixedAssetAccountOptions(type, selectedCode) {
    var prefixes = { corporelle: ['22', '23', '24'], incorporelle: ['20', '21'], financiere: ['26', '27'] }[type] || [];
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return Number(account.cls || code.charAt(0)) === 2 && prefixes.some(function (prefix) { return code.indexOf(prefix) === 0; }) &&
        code.indexOf('25') !== 0 && code.indexOf('28') !== 0 && account.active !== false && account.postable !== false;
    });
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    return '<option value="">Choisir un compte d’immobilisation</option>' + accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (String(account.code) === String(selectedCode || '') ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
  }

  function fixedAssetAccumulatedAccountOptions(type, selectedCode) {
    var prefix = type === 'corporelle' ? '283' : (type === 'incorporelle' ? '281' : '');
    var accounts = prefix ? S.accounts().filter(function (account) {
      var code = String(account.code);
      return code.indexOf(prefix) === 0 && Number(account.cls || code.charAt(0)) === 2 && account.active !== false && account.postable !== false;
    }) : [];
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    return '<option value="">' + (prefix ? 'Choisir un compte cumulé' : 'Non applicable à cette nature') + '</option>' + accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (String(account.code) === String(selectedCode || '') ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
  }

  function fixedAssetExpenseAccountOptions(selectedCode) {
    var accounts = S.accounts().filter(function (account) {
      var code = String(account.code);
      return code.indexOf('68') === 0 && Number(account.cls || code.charAt(0)) === 6 && account.active !== false && account.postable !== false;
    });
    accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    return '<option value="">Choisir un compte de dotation</option>' + accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (String(account.code) === String(selectedCode || '') ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
  }

  function fixedAssetLocationSelectOptions(selectedId) {
    var records = S.fixedAssetLocations();
    var tree = fixedAssetLocationTree(records, '');
    return '<option value="">Aucune localisation définie</option>' + tree.rows.map(function (row) {
      var indent = new Array(Math.min(row.depth, 8) + 1).join('— ');
      var label = indent + (row.record.code ? row.record.code + ' · ' : '') + row.record.name + ' (' + row.record.level + ')';
      return '<option value="' + esc(row.record.id) + '"' + (String(row.record.id) === String(selectedId || '') ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function filteredFixedAssets(records, filter) {
    filter = filter || { q: '', status: 'all', assetType: 'all' };
    var q = String(filter.q || '').trim().toLocaleLowerCase('fr');
    return records.filter(function (record) {
      if (filter.status === 'en-service' && record.status !== 'en-service') return false;
      if (filter.status === 'en-cours' && record.status !== 'en-cours') return false;
      if (filter.status === 'retiree' && record.status !== 'retiree') return false;
      if (filter.assetType !== 'all' && record.assetType !== filter.assetType) return false;
      if (!q) return true;
      var location = record.locationId ? S.fixedAssetLocation(record.locationId) : null;
      var locationPath = location ? fixedAssetLocationPathLabel(location, S.fixedAssetLocations()) : '';
      var searchable = [record.code, record.name, record.description, fixedAssetTypeLabel(record.assetType), fixedAssetStatusLabel(record.status),
        record.serialNumber, record.manufacturer, record.model, record.vendor, record.invoiceReference, record.custodian,
        locationPath, record.assetAccountCode, record.acquisitionDate].join(' ').toLocaleLowerCase('fr');
      return searchable.indexOf(q) !== -1;
    });
  }

  function fixedAssetRowsHtml(records, filter) {
    var visible = filteredFixedAssets(records, filter);
    return visible.slice().sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'fr'); }).map(function (record) {
      var location = record.locationId ? S.fixedAssetLocation(record.locationId) : null;
      var assetAccount = S.account(record.assetAccountCode);
      var accumulatedAccount = S.account(record.accumulatedDepreciationAccountCode);
      var expenseAccount = S.account(record.depreciationExpenseAccountCode);
      var assetClass = record.status === 'retiree' ? 'is-retired' : (record.status === 'en-cours' ? 'is-pending' : 'is-active');
      var depreciation = record.depreciationMethod === 'aucun'
        ? 'Non amortissable'
        : fixedAssetMethodLabel(record.depreciationMethod) + (record.usefulLifeMonths ? ' · ' + record.usefulLifeMonths + ' mois' : '');
      return '<tr>' +
        '<td><strong>' + esc(record.code) + '</strong><br><span class="fixed-asset-name">' + esc(record.name) + '</span>' + (record.description ? '<br><small>' + esc(record.description) + '</small>' : '') + '</td>' +
        '<td><span class="fixed-asset-status ' + assetClass + '">' + esc(fixedAssetStatusLabel(record.status)) + '</span><br><small>' + esc(fixedAssetTypeLabel(record.assetType)) + '</small></td>' +
        '<td>' + (location ? '<strong>' + esc(fixedAssetLocationPathLabel(location, S.fixedAssetLocations())) + '</strong>' : '<span class="muted">Non renseignée</span>') + (record.serialNumber ? '<br><small>N° série · ' + esc(record.serialNumber) + '</small>' : '') + '</td>' +
        '<td><strong>' + esc(S.money(record.grossCost)) + '</strong><br><small>Acquisition · ' + esc(S.dateLabel(record.acquisitionDate)) + (record.commissioningDate ? ' · Service · ' + esc(S.dateLabel(record.commissioningDate)) : '') + '</small></td>' +
        '<td><strong>' + esc(assetAccount ? assetAccount.code + ' · ' + assetAccount.label : String(record.assetAccountCode || 'Compte absent')) + '</strong><br><small>Amort. ' + esc(accumulatedAccount ? accumulatedAccount.code : '—') + ' · Dotation ' + esc(expenseAccount ? expenseAccount.code : '—') + '</small></td>' +
        '<td><strong>' + esc(depreciation) + '</strong>' + (record.depreciationStartDate ? '<br><small>Début · ' + esc(S.dateLabel(record.depreciationStartDate)) + '</small>' : '') + '</td>' +
        '<td><div class="supplier-row-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-fixed-asset" data-id="' + esc(record.id) + '" aria-label="Modifier l’élément immobilisé ' + esc(record.name) + '">Modifier</button><button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-fixed-asset" data-id="' + esc(record.id) + '" aria-label="Supprimer l’élément immobilisé ' + esc(record.name) + '" title="La suppression est refusée dès qu’un mouvement ou une écriture le référence.">Supprimer</button></div></td>' +
      '</tr>';
    }).join('');
  }

  function viewFixedAssets() {
    var records = S.fixedAssets();
    var filter = ui.fixedAssets || (ui.fixedAssets = { q: '', status: 'all', assetType: 'all' });
    var visible = filteredFixedAssets(records, filter);
    var activeCount = records.filter(function (record) { return record.status === 'en-service'; }).length;
    var constructionCount = records.filter(function (record) { return record.status === 'en-cours'; }).length;
    var grossTotal = records.reduce(function (total, record) { return total + (Number(record.grossCost) || 0); }, 0);
    var statusOptions = [
      ['all', 'Tous les états'], ['en-service', 'En service'], ['en-cours', 'En cours'], ['retiree', 'Retirés']
    ].map(function (option) { return '<option value="' + option[0] + '"' + (filter.status === option[0] ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('');
    var typeOptions = [
      ['all', 'Toutes les natures'], ['corporelle', 'Corporelles'], ['incorporelle', 'Incorporelles'], ['financiere', 'Financières']
    ].map(function (option) { return '<option value="' + option[0] + '"' + (filter.assetType === option[0] ? ' selected' : '') + '>' + option[1] + '</option>'; }).join('');
    var emptyMessage = records.length ? 'Aucun élément ne correspond aux filtres.' : 'Aucun élément immobilisé n’est enregistré dans ce dossier. Utilisez « Nouvel élément » pour créer une fiche.';
    return '<div class="exchange-workspace fixed-asset-workspace" id="fixed-asset-workspace">' +
      '<div class="alert info"><div><strong>Registre local des immobilisations du dossier actif.</strong> Les fiches distinguent l’identification opérationnelle, les comptes, les dates et les paramètres d’amortissement. Le bouton « Prévisualiser le linéaire » fournit un aperçu explicitement hypothétique, non arrondi et non comptabilisant ; il ne crée ni valeur nette comptable officielle ni écriture.</div></div>' +
      '<div class="exchange-summary-grid fixed-asset-summary-grid" aria-label="Résumé des immobilisations"><div><small>En service</small><strong>' + activeCount + '</strong></div><div><small>En cours</small><strong>' + constructionCount + '</strong></div><div><small>Coût d’acquisition renseigné</small><strong>' + esc(S.money(grossTotal)) + '</strong></div></div>' +
      '<section class="exchange-card fixed-asset-directory-card">' +
        '<div class="supplier-directory-head"><div><h4>Éléments immobilisés</h4><p>Suivi des biens, localisation, comptes de classe 2/28/68 et paramètres d’amortissement modifiables.</p></div><div class="fixed-asset-directory-actions"><button type="button" class="btn btn-ghost" data-action="preview-fixed-asset-depreciation">Prévisualiser le linéaire</button><button type="button" class="btn btn-primary" data-action="new-fixed-asset">＋ Nouvel élément</button></div></div>' +
        '<form id="fixed-asset-filter-form" class="supplier-filter-controls fixed-asset-filter-controls" role="search"><label class="field"><span>Rechercher</span><input id="fixed-asset-search" type="search" value="' + esc(filter.q) + '" placeholder="Code, désignation, série, fournisseur, lieu…" autocomplete="off"></label><label class="field"><span>État</span><select id="fixed-asset-status-filter">' + statusOptions + '</select></label><label class="field"><span>Nature</span><select id="fixed-asset-type-filter">' + typeOptions + '</select></label></form>' +
        '<p class="supplier-result-note" id="fixed-asset-result-note">' + visible.length + (visible.length === 1 ? ' élément affiché.' : ' éléments affichés.') + '</p>' +
        '<div class="table-wrap exchange-table-wrap fixed-asset-table-wrap" id="fixed-asset-table-wrap"' + (visible.length ? '' : ' hidden') + '><table class="exchange-mapping-table fixed-asset-table"><caption class="sr-only">Éléments immobilisés du dossier actif</caption><thead><tr><th>Code / désignation</th><th>État / nature</th><th>Localisation / série</th><th>Acquisition / coût</th><th>Comptes associés</th><th>Paramètres d’amortissement</th><th>Actions</th></tr></thead><tbody id="fixed-asset-rows">' + fixedAssetRowsHtml(records, filter) + '</tbody></table></div>' +
        '<div id="fixed-asset-list-empty" class="empty-state registry-empty"' + (visible.length ? ' hidden' : '') + '><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>' +
      '</section>' +
      '<p class="exchange-footnote">La simulation ne traite que le linéaire et impose le choix explicite d’une convention ; le dégressif, les unités d’œuvre, les cessions, les arrondis comptables, les écritures et les états réglementaires restent à cadrer après validation métier et fiscale.</p>' +
    '</div>';
  }

  function fixedAssetSimulationMoney(value) {
    var formatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
    return formatter.format(Number(value) || 0) + '\u00A0XOF';
  }

  function fixedAssetDepreciationSimulationHtml(result) {
    var rows = result.rows.map(function (row) {
      return '<tr><td><strong>' + esc(row.code) + '</strong><br><small>' + esc(row.name) + '</small></td><td>' + esc(row.period) + '</td><td class="number-cell"><strong>' + esc(fixedAssetSimulationMoney(row.amount)) + '</strong></td></tr>';
    }).join('');
    var excluded = result.excluded.length
      ? '<details class="fixed-asset-simulation-exclusions"><summary>Fiches non simulées : ' + result.excluded.length + '</summary><div class="table-wrap"><table class="exchange-mapping-table fixed-asset-simulation-table"><thead><tr><th>Code / désignation</th><th>Motif de non-simulation</th></tr></thead><tbody>' + result.excluded.map(function (item) {
          return '<tr><td><strong>' + esc(item.code || 'Code absent') + '</strong><br><small>' + esc(item.name || 'Désignation absente') + '</small></td><td>' + esc(item.reason) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>'
      : '<p class="fixed-asset-simulation-all-included">Toutes les fiches du registre sont simulables selon les paramètres renseignés.</p>';
    return '<div class="fixed-asset-simulation-results">' +
      '<div class="alert warning"><div><strong>Simulation indicative uniquement.</strong> Convention « ' + esc(result.conventionLabel) + ' ». Les montants sont non arrondis (4 décimales au plus à l’affichage) ; les règles comptables et fiscales, les arrondis définitifs et la comptabilisation restent à valider. Aucune donnée n’est enregistrée et aucune écriture n’est créée.</div></div>' +
      '<div class="exchange-summary-grid fixed-asset-simulation-summary"><div><small>Fiches simulées</small><strong>' + result.plans.length + '</strong></div><div><small>Fiches écartées</small><strong>' + result.excluded.length + '</strong></div><div><small>Total indicatif du cycle</small><strong>' + esc(fixedAssetSimulationMoney(result.total)) + '</strong></div></div>' +
      '<p class="supplier-result-note">Cycle du dossier : ' + esc(S.dateLabel(result.cycleStart)) + ' au ' + esc(S.dateLabel(result.cycleEnd)) + ' · simulation par périodes mensuelles.</p>' +
      (rows
        ? '<div class="table-wrap exchange-table-wrap fixed-asset-simulation-table-wrap"><table class="exchange-mapping-table fixed-asset-simulation-table"><caption class="sr-only">Simulation linéaire indicative par immobilisation et période</caption><thead><tr><th>Immobilisation</th><th>Période</th><th>Montant non arrondi</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<div class="empty-state registry-empty"><h3>Aucune ligne à afficher</h3><p>Aucun bien linéaire en service et complet ne couvre ce cycle avec la convention choisie.</p></div>') +
      excluded +
    '</div>';
  }

  function openFixedAssetDepreciationModal() {
    var dossier = S.currentDossier();
    var conventions = FixedAssetDepreciation.conventions;
    var conventionOptions = Object.keys(conventions).map(function (key) {
      return '<option value="' + esc(key) + '">' + esc(conventions[key]) + '</option>';
    }).join('');
    var body = '<div class="alert info"><div><strong>Aperçu sans comptabilisation.</strong> Cette première simulation ne calcule que les fiches linéaires en service, déjà renseignées. Les méthodes dégressive et unités d’œuvre restent à cadrer. Les fiches « À définir », non amortissables, financières, en cours ou retirées sont signalées et écartées.</div></div>' +
      '<p class="fixed-asset-simulation-cycle">Cycle actif : <strong>' + esc(S.dateLabel(dossier.cycleStart)) + ' au ' + esc(S.dateLabel(dossier.cycleEnd)) + '</strong> · dossier ' + esc(dossier.reference || dossier.name) + '</p>' +
      '<form id="fixed-asset-simulation-form" class="fixed-asset-simulation-form" novalidate>' +
        '<label class="field"><span>Convention de simulation <span aria-hidden="true">*</span></span><select id="fixed-asset-simulation-convention" required><option value="">Choisir explicitement une hypothèse</option>' + conventionOptions + '</select><span class="hint">Aucune convention n’est présélectionnée. « Mois entier » démarre au mois civil de la date saisie ; le prorata exact compte les jours du début inclus à la fin exclue.</span></label>' +
        '<button type="submit" class="btn btn-primary">Calculer l’aperçu non comptabilisant</button>' +
      '</form>' +
      '<div id="fixed-asset-simulation-output" class="fixed-asset-simulation-output" aria-live="polite"><div class="empty-state registry-empty"><h3>Simulation non lancée</h3><p>Choisissez une convention explicite pour afficher les montants prévisionnels du cycle.</p></div></div>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Fermer</button>';
    openModal('Simulation indicative des amortissements', 'Aperçu linéaire · aucune écriture ne sera générée', body, footer, true);
    var form = $('#fixed-asset-simulation-form');
    var convention = $('#fixed-asset-simulation-convention');
    var output = $('#fixed-asset-simulation-output');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!convention.value) {
        output.innerHTML = '<div class="alert error" role="alert">Choisissez explicitement une convention avant de lancer la simulation.</div>';
        convention.focus();
        return;
      }
      var result = FixedAssetDepreciation.simulate(S.fixedAssets(), dossier.cycleStart, dossier.cycleEnd, convention.value);
      if (!result.ok) {
        output.innerHTML = '<div class="alert error" role="alert">' + esc((result.errors || ['La simulation ne peut pas être calculée.']).join(' ')) + '</div>';
        return;
      }
      output.innerHTML = fixedAssetDepreciationSimulationHtml(result);
    });
  }

  function refreshFixedAssetRows() {
    var records = S.fixedAssets();
    var filter = ui.fixedAssets || { q: '', status: 'all', assetType: 'all' };
    var visible = filteredFixedAssets(records, filter);
    var rows = $('#fixed-asset-rows');
    var tableWrap = $('#fixed-asset-table-wrap');
    var empty = $('#fixed-asset-list-empty');
    var note = $('#fixed-asset-result-note');
    if (rows) rows.innerHTML = fixedAssetRowsHtml(records, filter);
    if (tableWrap) tableWrap.hidden = visible.length === 0;
    if (empty) {
      empty.hidden = visible.length !== 0;
      empty.querySelector('p').textContent = records.length
        ? 'Aucun élément ne correspond aux filtres.'
        : 'Aucun élément immobilisé n’est enregistré dans ce dossier. Utilisez « Nouvel élément » pour créer une fiche.';
    }
    if (note) note.textContent = visible.length + (visible.length === 1 ? ' élément affiché.' : ' éléments affichés.');
    applyDemoActionGates(rows);
  }

  function bindFixedAssetView() {
    var form = $('#fixed-asset-filter-form');
    if (!form) return;
    var search = $('#fixed-asset-search', form);
    var status = $('#fixed-asset-status-filter', form);
    var type = $('#fixed-asset-type-filter', form);
    function update() {
      ui.fixedAssets = ui.fixedAssets || { q: '', status: 'all', assetType: 'all' };
      ui.fixedAssets.q = search ? search.value : '';
      ui.fixedAssets.status = status ? status.value : 'all';
      ui.fixedAssets.assetType = type ? type.value : 'all';
      refreshFixedAssetRows();
    }
    form.addEventListener('submit', function (event) { event.preventDefault(); });
    if (search) search.addEventListener('input', update);
    if (status) status.addEventListener('change', update);
    if (type) type.addEventListener('change', update);
  }

  function fixedAssetDepreciationFieldVisibility() {
    var type = $('#fixed-asset-asset-type');
    var method = $('#fixed-asset-depreciation-method');
    if (!type || !method) return;
    var financial = type.value === 'financiere';
    if (financial && ['lineaire', 'degressif', 'unites-oeuvre'].indexOf(method.value) !== -1) method.value = 'aucun';
    Array.prototype.forEach.call(method.options, function (option) {
      option.disabled = financial && ['lineaire', 'degressif', 'unites-oeuvre'].indexOf(option.value) !== -1;
    });
    var methodValue = method.value;
    var amortizable = ['lineaire', 'degressif', 'unites-oeuvre'].indexOf(methodValue) !== -1 && !financial;
    ['fixed-asset-useful-life-field', 'fixed-asset-depreciation-start-field', 'fixed-asset-accumulated-account-field', 'fixed-asset-expense-account-field'].forEach(function (id) {
      var field = $('#' + id);
      if (field) field.hidden = !amortizable;
    });
    var rate = $('#fixed-asset-rate-field');
    if (rate) rate.hidden = methodValue !== 'degressif';
    var units = $('#fixed-asset-units-fields');
    if (units) units.hidden = methodValue !== 'unites-oeuvre';
  }

  function clearUnusedFixedAssetDepreciationFields() {
    var method = $('#fixed-asset-depreciation-method');
    if (!method) return;
    fixedAssetDepreciationFieldVisibility();
    var amortizable = ['lineaire', 'degressif', 'unites-oeuvre'].indexOf(method.value) !== -1;
    if (!amortizable) {
      ['fixed-asset-useful-life', 'fixed-asset-depreciation-start', 'fixed-asset-rate', 'fixed-asset-production-total', 'fixed-asset-production-unit', 'fixed-asset-accumulated-account', 'fixed-asset-expense-account'].forEach(function (id) {
        var input = $('#' + id);
        if (input) input.value = '';
      });
    } else {
      if (method.value !== 'degressif' && $('#fixed-asset-rate')) $('#fixed-asset-rate').value = '';
      if (method.value !== 'unites-oeuvre') {
        if ($('#fixed-asset-production-total')) $('#fixed-asset-production-total').value = '';
        if ($('#fixed-asset-production-unit')) $('#fixed-asset-production-unit').value = '';
      }
    }
    fixedAssetDepreciationFieldVisibility();
  }

  function openFixedAssetModal(id) {
    var existing = id ? S.fixedAsset(id) : null;
    if (id && !existing) { toast('Élément immobilisé introuvable dans le dossier actif.', 'error'); return; }
    var assetType = existing ? existing.assetType : 'corporelle';
    var preferredAssetAccountCode = { corporelle: '231', incorporelle: '212', financiere: '271' }[assetType];
    var assetPrefixes = { corporelle: ['22', '23', '24'], incorporelle: ['20', '21'], financiere: ['26', '27'] }[assetType] || [];
    var defaultAssetAccount = S.accounts().find(function (account) {
      return String(account.code) === preferredAssetAccountCode && account.active !== false && account.postable !== false;
    }) || S.accounts().find(function (account) {
      var code = String(account.code);
      return assetPrefixes.some(function (prefix) { return code.indexOf(prefix) === 0; }) && account.active !== false && account.postable !== false;
    });
    var today = S.todayIso();
    var suggestedCode = existing ? existing.code : S.nextFixedAssetCode();
    var value = function (key, fallback) { return esc(existing && existing[key] != null ? existing[key] : (fallback == null ? '' : fallback)); };
    var options = function (choices, selected) {
      return choices.map(function (choice) { return '<option value="' + esc(choice[0]) + '"' + (String(choice[0]) === String(selected || '') ? ' selected' : '') + '>' + esc(choice[1]) + '</option>'; }).join('');
    };
    var body = '<form id="fixed-asset-form" novalidate><div id="fixed-asset-errors" aria-live="assertive"></div>' +
      '<div class="fixed-asset-form-sections">' +
        '<section class="fixed-asset-form-section"><h4>Identification et état</h4><div class="fixed-asset-form-grid">' +
          '<div class="field"><label for="fixed-asset-code">Code d’inventaire <span aria-hidden="true">*</span></label><input id="fixed-asset-code" name="code" type="text" maxlength="32" value="' + value('code', suggestedCode) + '" placeholder="Ex. IMMO-0001" required autocomplete="off"><span class="hint">Code proposé automatiquement, modifiable et non réutilisé.</span></div>' +
          '<div class="field"><label for="fixed-asset-name">Désignation <span aria-hidden="true">*</span></label><input id="fixed-asset-name" name="name" type="text" maxlength="150" value="' + value('name') + '" placeholder="Ex. Véhicule de service" required></div>' +
          '<div class="field"><label for="fixed-asset-type">Nature <span aria-hidden="true">*</span></label><select id="fixed-asset-asset-type" name="assetType" required>' + options([['corporelle', 'Immobilisation corporelle'], ['incorporelle', 'Immobilisation incorporelle'], ['financiere', 'Immobilisation financière']], assetType) + '</select></div>' +
          '<div class="field"><label for="fixed-asset-status">État <span aria-hidden="true">*</span></label><select id="fixed-asset-status" name="status" required>' + options([['en-service', 'En service'], ['en-cours', 'En cours / non mise en service'], ['retiree', 'Retiré de l’usage']], existing ? existing.status : 'en-service') + '</select></div>' +
          '<div class="field fixed-asset-description-field"><label for="fixed-asset-description">Description</label><textarea id="fixed-asset-description" name="description" rows="2" maxlength="500" placeholder="Caractéristiques et usage du bien">' + value('description') + '</textarea></div>' +
        '</div></section>' +
        '<section class="fixed-asset-form-section"><h4>Localisation et suivi physique</h4><div class="fixed-asset-form-grid">' +
          '<div class="field"><label for="fixed-asset-location">Localisation</label><select id="fixed-asset-location" name="locationId">' + fixedAssetLocationSelectOptions(existing && existing.locationId) + '</select><span class="hint">Les emplacements se gèrent dans le sous-menu « Localisation des immobilisations corporelles ».</span></div>' +
          '<div class="field"><label for="fixed-asset-custodian">Détenteur / responsable</label><input id="fixed-asset-custodian" name="custodian" type="text" maxlength="150" value="' + value('custodian') + '" placeholder="Personne ou service responsable"></div>' +
          '<div class="field"><label for="fixed-asset-manufacturer">Fabricant</label><input id="fixed-asset-manufacturer" name="manufacturer" type="text" maxlength="100" value="' + value('manufacturer') + '"></div>' +
          '<div class="field"><label for="fixed-asset-model">Modèle</label><input id="fixed-asset-model" name="model" type="text" maxlength="100" value="' + value('model') + '"></div>' +
          '<div class="field"><label for="fixed-asset-serial">Numéro de série / châssis</label><input id="fixed-asset-serial" name="serialNumber" type="text" maxlength="100" value="' + value('serialNumber') + '"></div>' +
          '<div class="field"><label for="fixed-asset-vendor">Fournisseur / provenance</label><input id="fixed-asset-vendor" name="vendor" type="text" maxlength="150" value="' + value('vendor') + '"></div>' +
          '<div class="field"><label for="fixed-asset-invoice">Référence de facture / pièce source</label><input id="fixed-asset-invoice" name="invoiceReference" type="text" maxlength="100" value="' + value('invoiceReference') + '"></div>' +
          '<div class="field"><label for="fixed-asset-warranty">Fin de garantie</label><input id="fixed-asset-warranty" name="warrantyEndDate" type="date" value="' + value('warrantyEndDate') + '"></div>' +
          '<div class="field"><label for="fixed-asset-last-inventory">Dernier inventaire physique</label><input id="fixed-asset-last-inventory" name="lastInventoryDate" type="date" value="' + value('lastInventoryDate') + '"></div>' +
          '<div class="field fixed-asset-notes-field"><label for="fixed-asset-notes">Notes</label><textarea id="fixed-asset-notes" name="notes" rows="2" maxlength="1000">' + value('notes') + '</textarea></div>' +
        '</div></section>' +
        '<section class="fixed-asset-form-section"><h4>Acquisition et comptes</h4><div class="fixed-asset-form-grid">' +
          '<div class="field"><label for="fixed-asset-asset-account">Compte d’immobilisation <span aria-hidden="true">*</span></label><select id="fixed-asset-asset-account" name="assetAccountCode" required>' + fixedAssetAccountOptions(assetType, value('assetAccountCode', defaultAssetAccount && defaultAssetAccount.code)) + '</select><span class="hint">Compte actif et imputable de classe 2, filtré par nature du bien.</span></div>' +
          '<div class="field"><label for="fixed-asset-acquisition-date">Date d’acquisition / début des travaux <span aria-hidden="true">*</span></label><input id="fixed-asset-acquisition-date" name="acquisitionDate" type="date" value="' + value('acquisitionDate', today) + '" required></div>' +
          '<div class="field"><label for="fixed-asset-commissioning-date">Date de mise en service</label><input id="fixed-asset-commissioning-date" name="commissioningDate" type="date" value="' + value('commissioningDate', existing ? '' : today) + '"><span class="hint">Obligatoire lorsque le bien est en service ou retiré.</span></div>' +
          '<div class="field"><label for="fixed-asset-gross-cost">Coût d’acquisition (XOF) <span aria-hidden="true">*</span></label><input id="fixed-asset-gross-cost" name="grossCost" type="number" min="0" step="1" value="' + value('grossCost') + '" required></div>' +
          '<div class="field"><label for="fixed-asset-residual-value">Valeur résiduelle estimée (XOF)</label><input id="fixed-asset-residual-value" name="residualValue" type="number" min="0" step="1" value="' + value('residualValue', 0) + '"><span class="hint">Paramètre saisi, sans calcul de valeur nette comptable.</span></div>' +
        '</div></section>' +
        '<section class="fixed-asset-form-section"><h4>Paramètres d’amortissement</h4><div class="fixed-asset-form-grid">' +
          '<div class="field"><label for="fixed-asset-depreciation-method">Méthode <span aria-hidden="true">*</span></label><select id="fixed-asset-depreciation-method" name="depreciationMethod">' + options([['a-definir', 'À définir / à valider'], ['lineaire', 'Linéaire'], ['degressif', 'Dégressif (taux saisi)'], ['unites-oeuvre', 'Unités d’œuvre'], ['aucun', 'Non amortissable']], existing ? existing.depreciationMethod : 'a-definir') + '</select><span class="hint">À définir par défaut : aucune règle ni durée fiscale n’est présumée. La fiche n’exécute aucun calcul ni écriture.</span></div>' +
          '<div class="field" id="fixed-asset-useful-life-field"><label for="fixed-asset-useful-life">Durée d’utilisation (mois)</label><input id="fixed-asset-useful-life" name="usefulLifeMonths" type="number" min="1" max="1200" step="1" value="' + value('usefulLifeMonths') + '"></div>' +
          '<div class="field" id="fixed-asset-depreciation-start-field"><label for="fixed-asset-depreciation-start">Début d’amortissement</label><input id="fixed-asset-depreciation-start" name="depreciationStartDate" type="date" value="' + value('depreciationStartDate') + '"></div>'+
          '<div class="field" id="fixed-asset-rate-field"><label for="fixed-asset-rate">Taux annuel dégressif (%)</label><input id="fixed-asset-rate" name="annualRatePercent" type="number" min="0.01" max="100" step="0.01" value="' + value('annualRatePercent') + '"></div>' +
          '<div class="fixed-asset-form-grid-inner" id="fixed-asset-units-fields"><div class="field"><label for="fixed-asset-production-total">Unités d’œuvre estimées</label><input id="fixed-asset-production-total" name="unitOfProductionTotal" type="number" min="1" step="1" value="' + value('unitOfProductionTotal') + '"></div><div class="field"><label for="fixed-asset-production-unit">Unité</label><input id="fixed-asset-production-unit" name="unitOfProductionUnit" type="text" maxlength="40" value="' + value('unitOfProductionUnit') + '" placeholder="Heures, kilomètres, unités…"></div></div>' +
          '<div class="field" id="fixed-asset-accumulated-account-field"><label for="fixed-asset-accumulated-account">Compte d’amortissements cumulés</label><select id="fixed-asset-accumulated-account" name="accumulatedDepreciationAccountCode">' + fixedAssetAccumulatedAccountOptions(assetType, value('accumulatedDepreciationAccountCode')) + '</select></div>' +
          '<div class="field" id="fixed-asset-expense-account-field"><label for="fixed-asset-expense-account">Compte de dotation</label><select id="fixed-asset-expense-account" name="depreciationExpenseAccountCode">' + fixedAssetExpenseAccountOptions(value('depreciationExpenseAccountCode')) + '</select></div>'+
        '</div></section>' +
      '</div></form>';
    var mode = existing ? 'edit' : 'create';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary" form="fixed-asset-form" data-action="save-fixed-asset" data-fixed-asset-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Enregistrer l’élément') + '</button>';
    openModal(existing ? 'Modifier un élément immobilisé' : 'Nouvel élément immobilisé', 'Registre local du dossier ' + esc(S.currentDossier().reference), body, footer, true);
    var form = $('#fixed-asset-form');
    var typeInput = $('#fixed-asset-asset-type');
    var methodInput = $('#fixed-asset-depreciation-method');
    function refreshAssetAccounts() {
      var type = typeInput.value;
      var assetAccountInput = $('#fixed-asset-asset-account');
      var accumulatedAccountInput = $('#fixed-asset-accumulated-account');
      var currentAssetAccount = assetAccountInput.value;
      var currentAccumulatedAccount = accumulatedAccountInput.value;
      assetAccountInput.innerHTML = fixedAssetAccountOptions(type, currentAssetAccount);
      accumulatedAccountInput.innerHTML = fixedAssetAccumulatedAccountOptions(type, currentAccumulatedAccount);
      if (type === 'financiere') clearUnusedFixedAssetDepreciationFields();
      else fixedAssetDepreciationFieldVisibility();
    }
    typeInput.addEventListener('change', refreshAssetAccounts);
    methodInput.addEventListener('change', clearUnusedFixedAssetDepreciationFields);
    clearUnusedFixedAssetDepreciationFields();
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'fixedAssets.edit' : 'fixedAssets.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        code: $('#fixed-asset-code').value, name: $('#fixed-asset-name').value, description: $('#fixed-asset-description').value,
        assetType: typeInput.value, status: $('#fixed-asset-status').value, locationId: $('#fixed-asset-location').value,
        custodian: $('#fixed-asset-custodian').value, manufacturer: $('#fixed-asset-manufacturer').value, model: $('#fixed-asset-model').value,
        serialNumber: $('#fixed-asset-serial').value, vendor: $('#fixed-asset-vendor').value, invoiceReference: $('#fixed-asset-invoice').value,
        warrantyEndDate: $('#fixed-asset-warranty').value, lastInventoryDate: $('#fixed-asset-last-inventory').value, notes: $('#fixed-asset-notes').value,
        assetAccountCode: $('#fixed-asset-asset-account').value, acquisitionDate: $('#fixed-asset-acquisition-date').value,
        commissioningDate: $('#fixed-asset-commissioning-date').value, grossCost: $('#fixed-asset-gross-cost').value,
        residualValue: $('#fixed-asset-residual-value').value, depreciationMethod: methodInput.value,
        usefulLifeMonths: $('#fixed-asset-useful-life').value, depreciationStartDate: $('#fixed-asset-depreciation-start').value,
        annualRatePercent: $('#fixed-asset-rate').value, unitOfProductionTotal: $('#fixed-asset-production-total').value,
        unitOfProductionUnit: $('#fixed-asset-production-unit').value,
        accumulatedDepreciationAccountCode: $('#fixed-asset-accumulated-account').value,
        depreciationExpenseAccountCode: $('#fixed-asset-expense-account').value
      };
      var result = existing ? S.updateFixedAsset(existing.id, input) : S.createFixedAsset(input);
      if (!result.ok) {
        $('#fixed-asset-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' + result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche d’immobilisation mise à jour.' : 'Élément ' + result.fixedAsset.code + ' enregistré.', 'success');
      closeModal(true);
      render();
    });
  }

  function cashOperationAccounts(journalCode) {
    return CashOperations.cashAccounts(S.accounts()).filter(function (account) {
      return S.journalAllowsAccount(journalCode, account.code);
    });
  }

  function cashOperationCounterpartAccounts(journalCode) {
    return postingAccounts().filter(function (account) {
      return !CashOperations.isCashCode(account.code) && S.journalAllowsAccount(journalCode, account.code);
    });
  }

  function cashOperationAccountOptions(records, selected, placeholder) {
    return '<option value="">' + esc(placeholder || '— Choisir un compte —') + '</option>' + records.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (String(account.code) === String(selected || '') ? ' selected' : '') + '>' +
        esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
  }

  function cashOperationDateIsOpen(date, dossier) {
    date = String(date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < dossier.cycleStart || date > dossier.cycleEnd) return false;
    return S.periodStatus(Number(date.slice(0, 4)), Number(date.slice(5, 7))) !== 'closed';
  }

  function viewAccountingCashOperations() {
    var dossier = S.currentDossier();
    var today = S.todayIso();
    var defaultDate = today >= dossier.cycleStart && today <= dossier.cycleEnd ? today : dossier.cycleStart;
    var journal = S.journal(CashOperations.CASH_JOURNAL);
    var journalAvailable = isFillableJournal(journal);
    var canCreate = hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.create', accountingAccessContext(dossier));
    var canValidate = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier));
    var cashAccounts = journal ? cashOperationAccounts(journal.code) : [];
    var counterpartAccounts = journal ? cashOperationCounterpartAccounts(journal.code) : [];
    var formAvailable = canCreate && journalAvailable && cashAccounts.length > 0 && counterpartAccounts.length > 0;
    var balances = CashOperations.cashBalances(S.accounts(), S.entries(), dossier.cycleStart, dossier.cycleEnd, defaultDate);
    var displayedBalances = balances.filter(function (record) { return record.selectable || record.balance !== 0; });
    var totalCash = balances.reduce(function (sum, record) { return sum + record.balance; }, 0);
    var records = CashOperations.movementRecords(S.entries(), S.accounts(), dossier.cycleStart, dossier.cycleEnd).slice(0, 12);
    var notices = [];
    if (!journal) notices.push('Le journal Caisse (CA) est absent du dossier. Consultez le référentiel des journaux avant toute opération.');
    else if (!journalAvailable) notices.push('Le journal Caisse (CA) est inactif ou réservé : aucune nouvelle opération ne peut y être enregistrée.');
    if (!canCreate) notices.push('Ce profil peut consulter la situation de caisse, mais le droit draft.create n’est pas accordé.');
    if (journalAvailable && !cashAccounts.length) notices.push('Aucun compte de caisse actif, imputable et autorisé par le journal CA n’est disponible dans la famille 57.');
    if (journalAvailable && !counterpartAccounts.length) notices.push('Aucun compte de contrepartie actif, imputable et autorisé par le journal CA n’est disponible.');
    var periodIsOpen = cashOperationDateIsOpen(defaultDate, dossier);
    var movementRows = records.length ? records.map(function (record) {
      var cashLabels = record.cashAccounts.map(function (account) { return account.label + ' (' + account.code + ')'; }).join(', ');
      var counterpartLabels = record.counterpartAccounts.map(function (account) { return account.label + ' (' + account.code + ')'; }).join(', ') || '—';
      return '<tr class="clickable" data-action="open-entry" data-id="' + esc(record.id) + '" tabindex="0" aria-label="Consulter la pièce ' + esc(record.reference) + '">' +
        '<td class="nowrap">' + esc(dateLabel(record.date)) + '</td>' +
        '<td><strong>' + esc(record.reference) + '</strong></td>' +
        '<td>' + esc(record.direction) + '</td>' +
        '<td>' + esc(cashLabels) + '</td>' +
        '<td>' + esc(counterpartLabels) + '</td>' +
        '<td>' + esc(record.description || '—') + '</td>' +
        '<td class="num">' + esc(amount(record.amount)) + '</td>' +
        '<td>' + statusBadge(record.status) + '</td>' +
      '</tr>';
    }).join('') : '<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">₣</div><strong>Aucune opération de caisse</strong>Les pièces du journal CA comportant un compte de caisse 57 apparaîtront ici.</div></td></tr>';

    return '<div class="cash-operations">' +
      '<div class="alert info cash-operations-local-note"><strong>Actualisation immédiate dans ce dossier.</strong> Le solde est recalculé depuis les pièces validées ; les brouillons ne le modifient pas. Les données de ce prototype restent locales à ce navigateur, sans synchronisation multi-utilisateur.</div>' +
      notices.map(function (notice) { return '<div class="alert warning cash-operations-notice">' + esc(notice) + '</div>'; }).join('') +
      '<section class="cash-register-summary" aria-label="Situation des caisses">' +
        '<article class="cash-total-card"><span>Solde total des comptes de caisse</span><strong id="cash-total-balance">' + esc(amount(totalCash)) + ' XOF</strong><small>Soldes comptables jusqu’au <span id="cash-situation-date">' + esc(dateLabel(defaultDate)) + '</span> · période du dossier</small></article>' +
        '<div class="cash-position-grid" id="cash-position-grid">' +
          (displayedBalances.length ? displayedBalances.map(function (record) {
            return '<article class="cash-position-card' + (record.balance < 0 ? ' is-negative' : '') + '" data-cash-position-card data-account-code="' + esc(record.code) + '"><span>' + esc(record.label) + '</span><small>Compte ' + esc(record.code) + '</small><strong data-cash-balance="' + esc(record.code) + '">' + esc(amount(record.balance)) + ' XOF</strong></article>';
          }).join('') : '<p class="small muted">Aucun compte de caisse 57 n’est enregistré au plan comptable.</p>') +
        '</div>' +
      '</section>' +
      '<section class="card panel cash-operation-entry">' +
        '<div class="cash-section-heading"><div><h4>Nouvelle opération</h4><p class="sub">Une écriture équilibrée est préparée au journal Caisse (CA).</p></div><a class="btn btn-ghost btn-sm" href="#/menu?g=saisie&amp;t=journal-entry">Saisie générale</a></div>' +
        '<div class="alert info cash-operation-rule"><strong>Comptabilisation :</strong> un encaissement débite le compte de caisse et crédite la contrepartie ; un décaissement fait l’inverse. Aucun calcul de TVA ni transfert entre caisses n’est automatisé.</div>' +
        '<div id="cash-operation-errors" aria-live="assertive"></div>' +
        '<form id="cash-operation-form">' +
          '<fieldset class="cash-operation-fields"' + (formAvailable ? '' : ' disabled') + '><legend class="sr-only">Détails de l’opération de caisse</legend>' +
            '<div class="form-grid">' +
              '<div class="field"><label for="cash-operation-direction">Sens de l’opération</label><select id="cash-operation-direction" name="direction" required><option value="receipt">Encaissement</option><option value="disbursement">Décaissement</option></select></div>' +
              '<div class="field"><label for="cash-operation-account">Caisse</label><select id="cash-operation-account" name="cashAccount" required>' + cashOperationAccountOptions(cashAccounts, cashAccounts[0] && cashAccounts[0].code, '— Choisir une caisse —') + '</select></div>' +
              '<div class="field"><label for="cash-operation-counterpart">Compte de contrepartie</label><select id="cash-operation-counterpart" name="counterpartAccount" required>' + cashOperationAccountOptions(counterpartAccounts, '', '— Choisir un compte —') + '</select><span class="hint">Le compte est contrôlé selon les autorisations du journal CA.</span></div>' +
              '<div class="field"><label for="cash-operation-date">Date</label><input id="cash-operation-date" name="date" type="date" min="' + esc(dossier.cycleStart) + '" max="' + esc(dossier.cycleEnd) + '" value="' + esc(defaultDate) + '" required><span class="hint" id="cash-operation-period-status">' + (periodIsOpen ? 'Période ouverte.' : 'Date hors cycle ou période clôturée.') + '</span></div>' +
              '<div class="field"><label for="cash-operation-reference">Référence proposée</label><input id="cash-operation-reference" name="reference" type="text" value="' + esc(S.nextReference(CashOperations.CASH_JOURNAL, defaultDate)) + '" readonly required><span class="hint">Séquence du journal CA.</span></div>' +
              '<div class="field"><label for="cash-operation-amount">Montant (XOF)</label><input id="cash-operation-amount" name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="0" required></div>' +
              '<div class="field cash-field-wide"><label for="cash-operation-description">Libellé de l’opération</label><input id="cash-operation-description" name="description" type="text" maxlength="160" placeholder="Ex. règlement en espèces d’une facture" required></div>' +
            '</div>' +
          '</fieldset>' +
          '<div class="cash-operation-preview" aria-live="polite"><div><span>Solde comptable avant</span><strong id="cash-operation-current-balance">0 XOF</strong></div><span class="cash-preview-arrow" aria-hidden="true">→</span><div><span>Solde estimé après validation</span><strong id="cash-operation-projected-balance">0 XOF</strong></div></div>' +
          '<div id="cash-operation-negative-warning" class="alert warning cash-operation-negative-warning" hidden>Le décaissement ferait apparaître un solde de caisse négatif à cette date. Vérifiez le compte et les pièces antérieures avant de valider.</div>' +
          '<div id="cash-operation-date-warning" class="alert warning cash-operation-date-warning"' + (periodIsOpen ? ' hidden' : '') + '>La date doit appartenir au cycle du dossier et à une période ouverte.</div>' +
          '<div class="cash-operation-actions"><button type="submit" class="btn btn-ghost" data-cash-mode="draft"' + (formAvailable ? '' : ' disabled') + '>Enregistrer un brouillon</button><button type="submit" class="btn btn-primary" data-cash-mode="posted"' + (formAvailable && canValidate && periodIsOpen ? '' : ' disabled') + '>Valider l’opération</button></div>' +
          (!canValidate ? '<p class="small muted cash-operation-permission-note">La validation immédiate nécessite aussi le droit entry.validate. Le brouillon reste disponible si draft.create est accordé.</p>' : '') +
        '</form>' +
      '</section>' +
      '<section class="card panel cash-register-ledger">' +
        '<div class="cash-section-heading"><div><h4>Dernières opérations de caisse</h4><p class="sub">12 pièces récentes du journal CA · brouillons visibles, mais exclus des soldes</p></div><a class="btn btn-ghost btn-sm" href="#/journal?journal=CA">Journal CA</a></div>' +
        '<div class="table-wrap"><table class="data-table cash-operations-table"><caption>Dossier ' + esc(dossier.reference) + ' · cycle du ' + esc(dateLabel(dossier.cycleStart)) + ' au ' + esc(dateLabel(dossier.cycleEnd)) + '</caption>' +
          '<thead><tr><th scope="col">Date</th><th scope="col">Référence</th><th scope="col">Sens</th><th scope="col">Caisse</th><th scope="col">Contrepartie</th><th scope="col">Libellé</th><th scope="col" class="num">Montant (XOF)</th><th scope="col">État</th></tr></thead><tbody>' + movementRows + '</tbody></table></div>' +
      '</section>' +
    '</div>';
  }

  function refreshCashOperationPreview() {
    var dateInput = $('#cash-operation-date');
    var cashInput = $('#cash-operation-account');
    var directionInput = $('#cash-operation-direction');
    var amountInput = $('#cash-operation-amount');
    if (!dateInput || !cashInput || !directionInput || !amountInput) return;
    var dossier = S.currentDossier();
    var date = dateInput.value || dossier.cycleStart;
    var balances = CashOperations.cashBalances(S.accounts(), S.entries(), dossier.cycleStart, dossier.cycleEnd, date);
    var total = balances.reduce(function (sum, record) { return sum + record.balance; }, 0);
    var totalNode = $('#cash-total-balance');
    if (totalNode) totalNode.textContent = amount(total) + ' XOF';
    var dateNode = $('#cash-situation-date');
    if (dateNode) dateNode.textContent = dateLabel(date);
    $$('[data-cash-position-card]').forEach(function (card) {
      var code = card.getAttribute('data-account-code');
      var record = balances.find(function (item) { return item.code === code; });
      var value = record ? record.balance : 0;
      var valueNode = $('[data-cash-balance]', card);
      if (valueNode) valueNode.textContent = amount(value) + ' XOF';
      card.classList.toggle('is-negative', value < 0);
    });
    var cashBalance = balances.find(function (record) { return record.code === cashInput.value; });
    var current = cashBalance ? cashBalance.balance : 0;
    var operationAmount = Number(amountInput.value) || 0;
    var projected = current + (directionInput.value === 'receipt' ? operationAmount : -operationAmount);
    var currentNode = $('#cash-operation-current-balance');
    var projectedNode = $('#cash-operation-projected-balance');
    if (currentNode) currentNode.textContent = amount(current) + ' XOF';
    if (projectedNode) projectedNode.textContent = amount(projected) + ' XOF';
    var negativeWarning = $('#cash-operation-negative-warning');
    if (negativeWarning) negativeWarning.hidden = !(operationAmount > 0 && directionInput.value === 'disbursement' && projected < 0);
    var reference = $('#cash-operation-reference');
    if (reference) reference.value = S.nextReference(CashOperations.CASH_JOURNAL, date);
    var periodLabel = $('#cash-operation-period-status');
    var dateOpen = cashOperationDateIsOpen(date, dossier);
    if (periodLabel) {
      if (date < dossier.cycleStart || date > dossier.cycleEnd) periodLabel.textContent = 'Date hors du cycle comptable.';
      else if (!dateOpen) periodLabel.textContent = 'Période clôturée.';
      else periodLabel.textContent = 'Période ouverte.';
    }
    var dateWarning = $('#cash-operation-date-warning');
    if (dateWarning) dateWarning.hidden = dateOpen;
    var canCreate = hasDemoPermission(getActiveDemoMember(), 'accounting', 'draft.create', accountingAccessContext(dossier));
    var canValidate = hasDemoPermission(getActiveDemoMember(), 'accounting', 'entry.validate', accountingAccessContext(dossier));
    var journalAvailable = isFillableJournal(S.journal(CashOperations.CASH_JOURNAL));
    var canStart = canCreate && journalAvailable && cashOperationAccounts(CashOperations.CASH_JOURNAL).length > 0 && cashOperationCounterpartAccounts(CashOperations.CASH_JOURNAL).length > 0;
    var draftButton = $('[data-cash-mode="draft"]');
    var postedButton = $('[data-cash-mode="posted"]');
    if (draftButton) draftButton.disabled = !canStart || !dateOpen;
    if (postedButton) postedButton.disabled = !canStart || !canValidate || !dateOpen;
  }

  function showCashOperationErrors(errors) {
    var box = $('#cash-operation-errors');
    if (!box) return;
    box.innerHTML = '<div class="alert error" role="alert"><strong>Opération non enregistrée.</strong><ul>' + errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
  }

  function bindAccountingCashOperations() {
    var form = $('#cash-operation-form');
    if (!form) return;
    ['cash-operation-date', 'cash-operation-account', 'cash-operation-direction', 'cash-operation-amount'].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('input', refreshCashOperationPreview);
      input.addEventListener('change', refreshCashOperationPreview);
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var submitter = event.submitter || document.activeElement;
      var mode = submitter && submitter.getAttribute('data-cash-mode') === 'posted' ? 'posted' : 'draft';
      var dossier = S.currentDossier();
      var requiredActions = ['draft.create'];
      if (mode === 'posted') requiredActions.push('entry.validate');
      if (!requiredActions.every(function (actionId) {
        return hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext(dossier));
      })) {
        showCashOperationErrors(['Action refusée : les droits de démonstration requis ne sont pas accordés.']);
        return;
      }
      var journal = S.journal(CashOperations.CASH_JOURNAL);
      if (!isFillableJournal(journal)) {
        showCashOperationErrors(['Le journal Caisse (CA) est absent, inactif ou réservé au système.']);
        return;
      }
      var input = {
        direction: $('#cash-operation-direction').value,
        cashAccount: $('#cash-operation-account').value,
        counterpartAccount: $('#cash-operation-counterpart').value,
        amount: $('#cash-operation-amount').value,
        date: $('#cash-operation-date').value,
        reference: $('#cash-operation-reference').value,
        description: $('#cash-operation-description').value
      };
      var built = CashOperations.buildEntry(input, S.accounts());
      if (!built.ok) { showCashOperationErrors(built.errors); return; }
      var unauthorizedAccounts = built.entry.lines.filter(function (line) { return !S.journalAllowsAccount(journal.code, line.account); });
      if (unauthorizedAccounts.length) {
        showCashOperationErrors(['Le journal CA n’autorise pas tous les comptes sélectionnés. Vérifiez ses paramètres avant de continuer.']);
        return;
      }
      var validation = S.validateEntry(built.entry, { requireBalanced: mode === 'posted', status: mode });
      if (!validation.ok) { showCashOperationErrors(validation.errors); return; }
      var result = S.createEntry(built.entry, mode);
      if (!result.ok) { showCashOperationErrors(result.errors); return; }
      toast(mode === 'posted'
        ? 'Opération ' + result.entry.reference + ' validée ; les soldes de caisse sont actualisés.'
        : 'Brouillon ' + result.entry.reference + ' enregistré ; les soldes ne changent qu’après validation.', 'success');
      render();
    });
    refreshCashOperationPreview();
  }

  function accountMovementAuxiliaryRecords() {
    var records = [];
    function append(items, type, labelFor) {
      (items || []).forEach(function (record) {
        if (!record || !record.accountCode) return;
        var code = String(record.code || record.id || '');
        records.push({
          id: String(type) + ':' + String(record.id || code),
          type: type,
          code: code,
          auxiliaryAccountCode: record.auxiliaryAccountCode || '',
          accountCode: String(record.accountCode),
          label: labelFor ? labelFor(record) : String(record.name || code),
          active: record.active !== false
        });
      });
    }
    append(S.suppliers(), 'Fournisseur');
    append(S.clients(), 'Client');
    append(S.otherParties(), 'Tiers divers', function (record) {
      return String(record.name || record.code || '') + ' · ' + auxiliaryPartyTypeLabel(record.type);
    });
    append(S.personnel(), 'Personnel');
    return records;
  }

  function accountMovementSourceAccounts() {
    var accounts = S.accounts().slice();
    var known = Object.create(null);
    accounts.forEach(function (account) { known[String(account.code)] = true; });
    S.balance().forEach(function (row) {
      var code = String(row.code);
      if (known[code]) return;
      known[code] = true;
      accounts.push(Object.assign({}, row, {
        label: code + ' · absent du référentiel',
        subclassLabel: 'Comptes hors référentiel',
        missingFromChart: true,
        postable: false
      }));
    });
    return accounts;
  }

  function accountMovementMonthLabel(period) {
    if (!period) return '—';
    var name = S.monthLabel(period.month);
    return name.charAt(0).toLocaleUpperCase() + name.slice(1) + ' ' + period.year;
  }

  function accountMovementPeriodStatus(status) {
    return '<span class="account-movement-period-status account-movement-period-' + esc(status === 'closed' ? 'closed' : 'open') + '">' +
      (status === 'closed' ? 'Clôturée' : 'Ouverte') + '</span>';
  }

  function accountMovementBalanceText(value) {
    value = Number(value) || 0;
    if (!value) return '—';
    return amount(Math.abs(value)) + ' ' + (value > 0 ? 'D' : 'C');
  }

  function getAccountMovementsContext() {
    var dossier = S.currentDossier();
    var accounts = accountMovementSourceAccounts();
    var auxiliaries = accountMovementAuxiliaryRecords();
    var tree = AccountMovements.buildTree(accounts, auxiliaries);
    var visibleTree = AccountMovements.filterTree(tree, ui.accountMovements.q, ui.accountMovements.kind);
    var visibleNodes = AccountMovements.flattenTree(visibleTree);
    var balanceRows = S.balance();
    var balanceByCode = Object.create(null);
    var movingCodes = Object.create(null);
    balanceRows.forEach(function (row) {
      balanceByCode[String(row.code)] = (Number(row.debit) || 0) - (Number(row.credit) || 0);
      movingCodes[String(row.code)] = true;
    });
    var selected = visibleNodes.find(function (node) { return node.id === ui.accountMovements.nodeId; }) || null;
    if (!selected) {
      selected = visibleNodes.find(function (node) {
        return node.kind === 'account' && movingCodes[node.code] && (ui.accountMovements.kind !== 'auxiliary' || node.hasAuxiliaries);
      }) || visibleNodes.find(function (node) { return node.kind === 'auxiliary'; }) ||
        visibleNodes.find(function (node) { return node.kind === 'account'; }) || visibleNodes[0] || null;
    }
    ui.accountMovements.nodeId = selected ? selected.id : '';

    var periods = S.periodStats(S.exercise()).map(function (period) {
      return Object.assign({}, period, { key: Number(period.year) + '-' + String(period.month).padStart(2, '0') });
    });
    var todayKey = S.todayIso().slice(0, 7);
    var selectedMonth = periods.find(function (period) { return period.key === ui.accountMovements.month; }) ||
      periods.find(function (period) { return period.key === todayKey; }) ||
      periods.find(function (period) { return period.posted > 0; }) || periods[0] || null;
    ui.accountMovements.month = selectedMonth ? selectedMonth.key : '';

    var cycleEntries = S.entries();
    var postedEntries = S.postedEntries();
    var summary = AccountMovements.monthlySummary(selected, cycleEntries, periods, dossier.cycleStart, dossier.cycleEnd);
    return {
      dossier: dossier,
      accounts: accounts,
      auxiliaries: auxiliaries,
      tree: tree,
      visibleTree: visibleTree,
      visibleNodes: visibleNodes,
      selected: selected,
      periods: periods,
      selectedMonth: selectedMonth,
      summary: summary,
      balanceByCode: balanceByCode,
      postedEntries: postedEntries
    };
  }

  function accountMovementTreeBalance(node, balanceByCode) {
    if (!node || node.kind === 'auxiliary') return null;
    return (node.accountCodes || []).reduce(function (sum, code) { return sum + (Number(balanceByCode[String(code)]) || 0); }, 0);
  }

  function renderAccountMovementTreeRow(node, context) {
    var selected = context.selected && context.selected.id === node.id;
    var classes = 'account-movement-row account-movement-row-' + node.kind + (selected ? ' is-selected' : '');
    if (node.account && node.account.missingFromChart) classes += ' is-unmapped';
    var closing = node.kind === 'auxiliary'
      ? '<span class="muted" title="Aucun mouvement auxiliaire n’est lié aux écritures actuelles.">Non calculé</span>'
      : accountMovementBalanceText(accountMovementTreeBalance(node, context.balanceByCode));
    var code = node.kind === 'auxiliary' ? '<span class="account-movement-code account-movement-code-aux">' + esc(node.code) + '</span>' : '<strong class="account-movement-code">' + esc(node.code) + '</strong>';
    var label = '<span class="account-movement-label">' + esc(node.label) + '</span>';
    var tags = '';
    if (node.kind === 'auxiliary') tags += '<span class="account-movement-tag">' + esc(node.auxiliaryType || 'Auxiliaire') + '</span>';
    if (node.kind === 'auxiliary' && !node.active) tags += '<span class="account-movement-tag is-inactive">Archivé</span>';
    if (node.account && node.account.missingFromChart) tags += '<span class="account-movement-tag is-warning">Hors référentiel</span>';
    return '<tr class="' + classes + '" data-action="select-account-movement-node" data-node-id="' + esc(node.id) + '" tabindex="' + (selected ? '0' : '-1') + '" aria-selected="' + (selected ? 'true' : 'false') + '" aria-label="Sélectionner ' + esc(node.kind === 'auxiliary' ? 'l’auxiliaire ' : '') + esc(node.code + ' ' + node.label) + '">' +
      '<td class="account-movement-tree-cell" style="--tree-depth:' + Number(node.depth || 0) + '">' + code + '</td>' +
      '<td>' + label + tags + '</td>' +
      '<td class="num nowrap">' + closing + '</td>' +
    '</tr>';
  }

  function renderAccountMovementMonthRow(period, summary, selectedMonth) {
    var row = summary.months.find(function (month) { return month.key === period.key; });
    var selected = selectedMonth && selectedMonth.key === period.key;
    var unavailable = !summary.available;
    return '<tr class="account-movement-month-row' + (selected ? ' is-selected' : '') + '" data-action="select-account-movement-month" data-month-key="' + esc(period.key) + '" tabindex="' + (selected ? '0' : '-1') + '" aria-selected="' + (selected ? 'true' : 'false') + '">' +
      '<td><span class="account-movement-month-name">' + esc(accountMovementMonthLabel(period)) + '</span>' + accountMovementPeriodStatus(period.status) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.lines : 0))) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.debit : 0))) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.credit : 0))) + '</td>' +
    '</tr>';
  }

  function viewGeneralAccountMovements() {
    var context = getAccountMovementsContext();
    var selected = context.selected;
    var summary = context.summary;
    var selectedName = selected ? selected.code + ' · ' + selected.label : 'Aucun compte sélectionné';
    var rows = context.visibleNodes.map(function (node) { return renderAccountMovementTreeRow(node, context); }).join('');
    if (!rows) {
      var emptyText = ui.accountMovements.kind === 'auxiliary'
        ? 'Aucune fiche auxiliaire rattachée à un compte affiché dans ce dossier.'
        : (ui.accountMovements.q ? 'Aucun compte ne correspond à cette recherche.' : 'Aucun compte n’est disponible dans ce dossier.');
      rows = '<tr><td colspan="3"><div class="empty-state account-movement-empty"><div class="empty-icon">⌕</div><strong>' + esc(emptyText) + '</strong>Les comptes et fiches proviennent du dossier comptable actif.</div></td></tr>';
    }
    var monthRows = context.periods.map(function (period) { return renderAccountMovementMonthRow(period, summary, context.selectedMonth); }).join('');
    var totals = !selected
      ? '<tr class="account-movement-total-row"><th colspan="4">Sélectionnez un compte pour afficher les totaux.</th></tr>'
      : (summary.available
        ? '<tr class="account-movement-total-row"><th colspan="2">Total de l’exercice · ' + esc(amount(summary.totalLines)) + ' ligne(s)</th><td class="num">' + esc(amount(summary.debit)) + '</td><td class="num">' + esc(amount(summary.credit)) + '</td></tr>'
        : '<tr class="account-movement-total-row"><th colspan="4">Totaux auxiliaires non disponibles</th></tr>');
    var status = context.selectedMonth ? accountMovementPeriodStatus(context.selectedMonth.status) : '';
    var auxiliaryCount = AccountMovements.flattenTree(context.tree).filter(function (node) { return node.kind === 'auxiliary'; }).length;
    var auxiliaryNote = '<div class="alert info account-movement-auxiliary-note"><strong>Limite des mouvements auxiliaires.</strong> ' +
      (auxiliaryCount
        ? esc(auxiliaryCount + ' fiche(s) auxiliaire(s) des répertoires fournisseurs, clients, tiers divers et personnel sont rattachées à leur compte collectif dans l’arborescence.') + ' '
        : 'Les répertoires fournisseurs, clients, tiers divers et personnel sont consultés pour alimenter l’arborescence. ') +
      'Les pièces validées ne portent pas encore d’identifiant auxiliaire : aucun mouvement ni solde individuel n’est inventé. Les totaux disponibles sont ceux des comptes généraux.' +
      '</div>';
    var detailDisabled = !selected || !summary.available;
    var draftNote = summary.available && summary.totalDrafts
      ? '<p class="small muted account-movement-draft-note">' + esc(amount(summary.totalDrafts)) + ' pièce(s) en brouillon exclue(s) des mouvements et soldes.</p>'
      : '<p class="small muted account-movement-draft-note">Seules les écritures validées de la période du dossier sont prises en compte.</p>';
    var closeBalance = !selected ? '—' : (summary.available ? accountMovementBalanceText(summary.closingBalance) : 'Non disponible');
    return '<div class="account-movements-feature">' +
      '<div class="account-movements-title"><p class="page-kicker">SAISIE · ÉCRITURES DU DOSSIER</p><h4>Mouvements des comptes généraux et auxiliaires</h4></div>' +
      auxiliaryNote +
      '<div class="account-movements-toolbar">' +
        '<div class="field account-movements-search"><label for="account-movement-search">Rechercher un compte ou un auxiliaire</label><input id="account-movement-search" type="search" data-filter="accountMovements:q" value="' + esc(ui.accountMovements.q) + '" placeholder="Code ou intitulé"></div>' +
        '<div class="field account-movements-kind"><label for="account-movement-kind">Afficher</label><select id="account-movement-kind" data-filter="accountMovements:kind"><option value="all"' + (ui.accountMovements.kind === 'all' ? ' selected' : '') + '>Généraux et auxiliaires</option><option value="general"' + (ui.accountMovements.kind === 'general' ? ' selected' : '') + '>Comptes généraux</option><option value="auxiliary"' + (ui.accountMovements.kind === 'auxiliary' ? ' selected' : '') + '>Auxiliaires</option></select></div>' +
      '</div>' +
      '<div class="account-movements-workspace">' +
        '<section class="account-movements-pane account-movements-tree-pane" aria-labelledby="account-movement-tree-title">' +
          '<div class="account-movements-pane-head"><div><p class="page-kicker">DOSSIER · ' + esc(context.dossier.reference || context.dossier.name || '') + '</p><h4 id="account-movement-tree-title">Comptes généraux et auxiliaires</h4></div><span class="account-movement-count">' + esc(String(context.visibleNodes.length)) + ' ligne(s)</span></div>' +
          '<div class="table-wrap account-movement-tree-wrap"><table class="account-movement-table account-movement-tree-table"><thead><tr><th>Code</th><th>Intitulé</th><th class="num">Clôture</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</section>' +
        '<section class="account-movements-pane account-movements-month-pane" aria-labelledby="account-movement-month-title">' +
          '<div class="account-movements-pane-head"><div><p class="page-kicker">SYNTHÈSE MENSUELLE · EXERCICE ' + esc(String(S.exercise())) + '</p><small class="account-movement-cycle-range">Cycle du dossier · ' + esc(dateLabel(context.dossier.cycleStart)) + ' — ' + esc(dateLabel(context.dossier.cycleEnd)) + '</small><h4 id="account-movement-month-title">' + esc(selectedName) + '</h4></div>' + status + '</div>' +
          '<div class="table-wrap account-movement-month-wrap"><table class="account-movement-table account-movement-month-table"><thead><tr><th>Mois</th><th class="num">Lignes</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' + monthRows + '</tbody><tfoot>' + totals + '</tfoot></table></div>' +
          '<div class="account-movement-closing-summary"><span>Solde de clôture de l’exercice</span><strong>' + esc(closeBalance) + (summary.available ? ' <small>XOF</small>' : '') + '</strong></div>' +
          draftNote +
        '</section>' +
      '</div>' +
      '<div class="account-movement-actions"><button type="button" class="btn btn-ghost" data-action="open-account-movement-month-detail"' + (detailDisabled ? ' disabled' : '') + '>Détail du mois…</button><button type="button" class="btn btn-ghost" data-action="open-account-movement-cycle-detail"' + (detailDisabled ? ' disabled' : '') + '>Détail de l’exercice…</button><a class="btn btn-primary" href="#/periods" title="Ouvrir la gestion des périodes comptables">Clôture</a></div>' +
      '<p class="small muted account-movement-period-note">La clôture est gérée par période comptable, jamais par compte ni par journal. Le bouton ouvre la gestion des périodes du dossier.</p>' +
    '</div>';
  }

  function openAccountMovementDetail(scope) {
    var context = getAccountMovementsContext();
    var selected = context.selected;
    if (!selected) {
      toast('Sélectionnez un compte général pour afficher son détail.', 'warning');
      return;
    }
    if (selected.kind === 'auxiliary') {
      openModal('Détail auxiliaire non disponible', '', '<div class="alert warning">Les écritures ne sont pas encore liées à une fiche auxiliaire. Aucun mouvement ni solde individuel ne peut être présenté.</div>', '<button type="button" class="btn btn-primary" data-action="close-modal">Fermer</button>');
      return;
    }
    var month = context.selectedMonth;
    var monthKey = scope === 'month' && month ? month.key : '';
    var detail = AccountMovements.detailRows(selected, context.postedEntries, context.accounts, context.dossier.cycleStart, context.dossier.cycleEnd, monthKey);
    var title = scope === 'month' ? 'Détail du mois — ' + accountMovementMonthLabel(month) : 'Détail de l’exercice — ' + String(S.exercise());
    var subtitle = esc(selected.code + ' · ' + selected.label);
    var body;
    if (!detail.available) {
      body = '<div class="alert info">' + esc(detail.reason) + '</div>';
    } else if (!detail.rows.length) {
      body = '<div class="empty-state"><div class="empty-icon">⌕</div><strong>Aucune ligne validée</strong>Aucun mouvement ne correspond à cette période pour le compte sélectionné.</div>';
    } else {
      var detailRowsHtml = detail.rows.map(function (row) {
        return '<tr><td class="nowrap">' + esc(dateLabel(row.date)) + '</td><td><strong>' + esc(row.reference || '—') + '</strong></td><td>' + esc(row.journal || '—') + '</td><td>' + esc(row.account + ' · ' + row.accountLabel) + '</td><td>' + esc(row.description || '—') + '</td><td class="num">' + esc(amount(row.debit)) + '</td><td class="num">' + esc(amount(row.credit)) + '</td></tr>';
      }).join('');
      body = '<p class="small muted">Pièces validées uniquement · ' + esc(String(detail.rows.length)) + ' ligne(s).</p>' +
        '<div class="table-wrap account-movement-detail-wrap"><table class="account-movement-table account-movement-detail-table"><thead><tr><th>Date</th><th>Référence</th><th>Journal</th><th>Compte</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' + detailRowsHtml + '</tbody><tfoot><tr><th colspan="5">Totaux</th><td class="num">' + esc(amount(detail.debit)) + '</td><td class="num">' + esc(amount(detail.credit)) + '</td></tr></tfoot></table></div>';
    }
    openModal(title, subtitle, body, '<button type="button" class="btn btn-primary" data-action="close-modal">Fermer</button>', true);
  }

  function thirdPartyMovementRecords() {
    var records = [];
    function append(items, key, typeLabel, definitionTab, editAction, subtype) {
      (items || []).forEach(function (record) {
        if (!record || !record.accountCode) return;
        var code = String(record.code || record.id || '');
        var specificType = subtype ? subtype(record) : key;
        records.push({
          id: key + ':' + String(record.id || code),
          recordId: String(record.id || code),
          kind: specificType,
          typeLabel: typeLabel(record),
          code: code,
          auxiliaryCode: String(record.auxiliaryAccountCode || (record.accountCode + '-' + code)),
          generalAccountCode: String(record.accountCode),
          name: String(record.name || record.label || code),
          active: record.active !== false,
          definitionTab: definitionTab,
          editAction: editAction
        });
      });
    }
    append(S.suppliers(), 'supplier', function () { return 'Fournisseur'; }, 'suppliers', 'edit-supplier');
    append(S.clients(), 'client', function () { return 'Client'; }, 'clients', 'edit-client');
    append(S.personnel(), 'personnel', function () { return 'Personnel'; }, 'personnel', 'edit-personnel');
    append(S.otherParties(), 'otherParty', function (record) { return auxiliaryPartyTypeLabel(record.type); }, 'other-debtors-creditors', 'edit-other-party', function (record) { return record.type; });
    var order = { supplier: 0, client: 1, personnel: 2, debtor: 3, creditor: 4 };
    return records.sort(function (a, b) {
      return (order[a.kind] || 0) - (order[b.kind] || 0) || a.name.localeCompare(b.name, 'fr') || a.code.localeCompare(b.code);
    });
  }

  function filteredThirdPartyMovementRecords(records) {
    var needle = String(ui.thirdPartyMovements.q || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    return (records || []).filter(function (record) {
      if (ui.thirdPartyMovements.kind !== 'all' && record.kind !== ui.thirdPartyMovements.kind) return false;
      if (!needle) return true;
      var text = [record.typeLabel, record.code, record.auxiliaryCode, record.name, record.generalAccountCode, S.account(record.generalAccountCode) && S.account(record.generalAccountCode).label]
        .join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
      return text.indexOf(needle) !== -1;
    });
  }

  function getThirdPartyMovementsContext() {
    var dossier = S.currentDossier();
    var records = thirdPartyMovementRecords();
    var visibleRecords = filteredThirdPartyMovementRecords(records);
    var selected = visibleRecords.find(function (record) { return record.id === ui.thirdPartyMovements.recordId; }) || visibleRecords[0] || null;
    ui.thirdPartyMovements.recordId = selected ? selected.id : '';
    var periods = S.periodStats(S.exercise()).map(function (period) {
      return Object.assign({}, period, { key: Number(period.year) + '-' + String(period.month).padStart(2, '0') });
    });
    var todayKey = S.todayIso().slice(0, 7);
    var selectedMonth = periods.find(function (period) { return period.key === ui.thirdPartyMovements.month; }) ||
      periods.find(function (period) { return period.key === todayKey; }) ||
      periods.find(function (period) { return period.posted > 0; }) || periods[0] || null;
    ui.thirdPartyMovements.month = selectedMonth ? selectedMonth.key : '';
    var collectiveNode = selected && selected.generalAccountCode ? {
      id: 'account:' + selected.generalAccountCode,
      kind: 'account',
      code: selected.generalAccountCode,
      label: (S.account(selected.generalAccountCode) || {}).label || 'Compte collectif',
      accountCodes: [selected.generalAccountCode]
    } : null;
    var cycleEntries = S.entries();
    var postedEntries = S.postedEntries();
    var summary = AccountMovements.monthlySummary(collectiveNode, cycleEntries, periods, dossier.cycleStart, dossier.cycleEnd);
    return {
      dossier: dossier,
      visibleRecords: visibleRecords,
      selected: selected,
      periods: periods,
      selectedMonth: selectedMonth,
      collectiveNode: collectiveNode,
      summary: summary,
      accounts: S.accounts(),
      postedEntries: postedEntries
    };
  }

  function renderThirdPartyMovementRow(record, context) {
    var selected = context.selected && context.selected.id === record.id;
    var account = S.account(record.generalAccountCode);
    var editButton = record.editAction
      ? '<button type="button" class="btn btn-ghost btn-sm" data-action="' + esc(record.editAction) + '" data-id="' + esc(record.recordId) + '" aria-label="Modifier la fiche de ' + esc(record.name) + '">Fiche</button>'
      : '';
    return '<tr class="account-movement-row account-movement-row-third-party' + (selected ? ' is-selected' : '') + '" data-action="select-third-party-movement-record" data-record-id="' + esc(record.id) + '" tabindex="' + (selected ? '0' : '-1') + '" aria-selected="' + (selected ? 'true' : 'false') + '">' +
      '<td><span class="third-party-type-tag">' + esc(record.typeLabel) + '</span><br><small>' + esc(record.auxiliaryCode) + '</small></td>' +
      '<td><strong class="account-movement-label">' + esc(record.name) + '</strong><br><small>' + esc(record.code) + (record.active ? '' : ' · Archivé') + '</small></td>' +
      '<td><strong>' + esc(record.generalAccountCode) + '</strong><br><small>' + esc(account ? account.label : 'Compte absent du référentiel') + '</small></td>' +
      '<td>' + editButton + '</td>' +
    '</tr>';
  }

  function renderThirdPartyMovementMonthRow(period, summary, selectedMonth) {
    var row = summary.months.find(function (month) { return month.key === period.key; });
    var selected = selectedMonth && selectedMonth.key === period.key;
    var unavailable = !summary.available;
    return '<tr class="account-movement-month-row' + (selected ? ' is-selected' : '') + '" data-action="select-third-party-movement-month" data-month-key="' + esc(period.key) + '" tabindex="' + (selected ? '0' : '-1') + '" aria-selected="' + (selected ? 'true' : 'false') + '">' +
      '<td><span class="account-movement-month-name">' + esc(accountMovementMonthLabel(period)) + '</span>' + accountMovementPeriodStatus(period.status) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.lines : 0))) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.debit : 0))) + '</td>' +
      '<td class="num">' + (unavailable ? '—' : esc(amount(row ? row.credit : 0))) + '</td>' +
    '</tr>';
  }

  function viewThirdPartyMovements() {
    var context = getThirdPartyMovementsContext();
    var selected = context.selected;
    var summary = context.summary;
    var rows = context.visibleRecords.map(function (record) { return renderThirdPartyMovementRow(record, context); }).join('');
    if (!rows) rows = '<tr><td colspan="4"><div class="empty-state account-movement-empty"><div class="empty-icon">⌕</div><strong>' +
      esc(ui.thirdPartyMovements.q ? 'Aucun tiers ne correspond à cette recherche.' : 'Aucune fiche de cette catégorie n’est encore enregistrée.') +
      '</strong>Créez ou gérez les fiches depuis les boutons ci-dessus.</div></td></tr>';
    var monthRows = context.periods.map(function (period) { return renderThirdPartyMovementMonthRow(period, summary, context.selectedMonth); }).join('');
    var totalRow = !selected
      ? '<tr class="account-movement-total-row"><th colspan="4">Sélectionnez une fiche pour afficher le compte collectif.</th></tr>'
      : (summary.available
        ? '<tr class="account-movement-total-row"><th colspan="2">Compte collectif · ' + esc(amount(summary.totalLines)) + ' ligne(s)</th><td class="num">' + esc(amount(summary.debit)) + '</td><td class="num">' + esc(amount(summary.credit)) + '</td></tr>'
        : '<tr class="account-movement-total-row"><th colspan="4">Synthèse du compte collectif indisponible</th></tr>');
    var title = selected ? selected.typeLabel + ' · ' + selected.name : 'Aucune fiche sélectionnée';
    var collectiveLabel = selected ? 'Compte collectif ' + selected.generalAccountCode : 'Compte collectif non sélectionné';
    var detailDisabled = !selected || !summary.available;
    var directoryTab = selected ? selected.definitionTab : 'suppliers';
    var individualNote = '<div class="alert warning third-party-individual-note"><strong>Mouvements individuels non disponibles.</strong> Les pièces comptables ne contiennent pas encore l’identifiant de la fiche sélectionnée. Le tableau mensuel ci-contre présente uniquement les mouvements agrégés du compte général collectif ' +
      (selected ? '<strong>' + esc(selected.generalAccountCode) + '</strong>, toutes fiches confondues' : 'du dossier') +
      ' ; il ne constitue pas le solde de ce fournisseur, client, membre du personnel ou tiers divers.</div>';
    return '<div class="account-movements-feature third-party-movements-feature">' +
      '<div class="account-movements-title"><p class="page-kicker">SAISIE · TIERS DU DOSSIER</p><h4>Mouvements des comptes tiers</h4></div>' +
      individualNote +
      '<div class="third-party-create-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="new-supplier">＋ Fournisseur</button><button type="button" class="btn btn-ghost btn-sm" data-action="new-client">＋ Client</button><button type="button" class="btn btn-ghost btn-sm" data-action="new-personnel">＋ Personnel</button><button type="button" class="btn btn-ghost btn-sm" data-action="new-other-party">＋ Débiteur / créditeur divers</button></div>' +
      '<div class="account-movements-toolbar">' +
        '<div class="field account-movements-search"><label for="third-party-movement-search">Rechercher un tiers</label><input id="third-party-movement-search" type="search" data-filter="thirdPartyMovements:q" value="' + esc(ui.thirdPartyMovements.q) + '" placeholder="Code, nom, compte collectif"></div>' +
        '<div class="field account-movements-kind"><label for="third-party-movement-kind">Catégorie</label><select id="third-party-movement-kind" data-filter="thirdPartyMovements:kind"><option value="all"' + (ui.thirdPartyMovements.kind === 'all' ? ' selected' : '') + '>Tous les tiers</option><option value="supplier"' + (ui.thirdPartyMovements.kind === 'supplier' ? ' selected' : '') + '>Fournisseurs</option><option value="client"' + (ui.thirdPartyMovements.kind === 'client' ? ' selected' : '') + '>Clients</option><option value="personnel"' + (ui.thirdPartyMovements.kind === 'personnel' ? ' selected' : '') + '>Personnel</option><option value="debtor"' + (ui.thirdPartyMovements.kind === 'debtor' ? ' selected' : '') + '>Débiteurs divers</option><option value="creditor"' + (ui.thirdPartyMovements.kind === 'creditor' ? ' selected' : '') + '>Créditeurs divers</option></select></div>' +
      '</div>' +
      '<div class="account-movements-workspace third-party-movements-workspace">' +
        '<section class="account-movements-pane" aria-labelledby="third-party-tree-title"><div class="account-movements-pane-head"><div><p class="page-kicker">FICHES AUXILIAIRES · ' + esc(context.dossier.reference || '') + '</p><h4 id="third-party-tree-title">Fournisseurs, clients, personnel et autres tiers</h4></div><span class="account-movement-count">' + esc(String(context.visibleRecords.length)) + ' fiche(s)</span></div>' +
          '<div class="table-wrap account-movement-tree-wrap third-party-movement-tree-wrap"><table class="account-movement-table third-party-movement-table"><thead><tr><th>Type / code auxiliaire</th><th>Intitulé</th><th>Compte collectif</th><th>Fiche</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        '</section>' +
        '<section class="account-movements-pane" aria-labelledby="third-party-month-title"><div class="account-movements-pane-head"><div><p class="page-kicker">SYNTHÈSE MENSUELLE · EXERCICE ' + esc(String(S.exercise())) + '</p><small class="account-movement-cycle-range">Cycle du dossier · ' + esc(dateLabel(context.dossier.cycleStart)) + ' — ' + esc(dateLabel(context.dossier.cycleEnd)) + '</small><h4 id="third-party-month-title">' + esc(collectiveLabel) + '</h4><small class="account-movement-cycle-range">' + esc(title) + ' · données du collectif uniquement</small></div>' + (context.selectedMonth ? accountMovementPeriodStatus(context.selectedMonth.status) : '') + '</div>' +
          '<div class="table-wrap account-movement-month-wrap"><table class="account-movement-table account-movement-month-table"><thead><tr><th>Mois</th><th class="num">Lignes</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' + monthRows + '</tbody><tfoot>' + totalRow + '</tfoot></table></div>' +
          '<div class="account-movement-closing-summary"><span>Solde net du compte collectif</span><strong>' + esc(selected && summary.available ? accountMovementBalanceText(summary.closingBalance) : '—') + (selected && summary.available ? ' <small>XOF</small>' : '') + '</strong></div>' +
          '<p class="small muted account-movement-draft-note">' + (summary.available && summary.totalDrafts ? esc(amount(summary.totalDrafts)) + ' pièce(s) en brouillon exclue(s). ' : '') + 'Les lignes restent agrégées au compte général ; aucun solde individuel n’est calculé.</p>' +
        '</section>' +
      '</div>' +
      '<div class="account-movement-actions"><button type="button" class="btn btn-ghost" data-action="open-third-party-collective-month-detail"' + (detailDisabled ? ' disabled' : '') + '>Détail du mois · collectif…</button><button type="button" class="btn btn-ghost" data-action="open-third-party-collective-cycle-detail"' + (detailDisabled ? ' disabled' : '') + '>Détail de l’exercice · collectif…</button><a class="btn btn-ghost" href="' + esc(accountingMenuHash('definitions', directoryTab)) + '">Gérer le répertoire</a><a class="btn btn-primary" href="#/periods" title="La clôture reste rattachée aux périodes comptables">Clôture</a></div>' +
      '<p class="small muted account-movement-period-note">La clôture s’effectue par période comptable. Les fiches tiers n’ont pas de statut de clôture individuel.</p>' +
    '</div>';
  }

  function openThirdPartyCollectiveDetail(scope) {
    var context = getThirdPartyMovementsContext();
    var selected = context.selected;
    if (!selected || !context.collectiveNode) {
      toast('Sélectionnez une fiche tierce rattachée à un compte collectif.', 'warning');
      return;
    }
    var month = context.selectedMonth;
    var monthKey = scope === 'month' && month ? month.key : '';
    var detail = AccountMovements.detailRows(context.collectiveNode, context.postedEntries, context.accounts, context.dossier.cycleStart, context.dossier.cycleEnd, monthKey);
    var title = scope === 'month' ? 'Détail du mois — ' + accountMovementMonthLabel(month) : 'Détail de l’exercice — ' + String(S.exercise());
    var subtitle = esc('Compte collectif ' + selected.generalAccountCode + ' · ' + selected.typeLabel + ' : ' + selected.name);
    var warning = '<div class="alert warning"><strong>Détail agrégé du compte collectif.</strong> Ces lignes peuvent concerner plusieurs fiches. Elles ne sont pas attribuées individuellement à « ' + esc(selected.name) + ' ».</div>';
    var body;
    if (!detail.rows.length) {
      body = warning + '<div class="empty-state"><div class="empty-icon">⌕</div><strong>Aucune ligne validée</strong>Aucun mouvement du compte collectif ne correspond à cette période.</div>';
    } else {
      var detailRowsHtml = detail.rows.map(function (row) {
        return '<tr><td class="nowrap">' + esc(dateLabel(row.date)) + '</td><td><strong>' + esc(row.reference || '—') + '</strong></td><td>' + esc(row.journal || '—') + '</td><td>' + esc(row.account + ' · ' + row.accountLabel) + '</td><td>' + esc(row.description || '—') + '</td><td class="num">' + esc(amount(row.debit)) + '</td><td class="num">' + esc(amount(row.credit)) + '</td></tr>';
      }).join('');
      body = warning + '<p class="small muted">Pièces validées uniquement · ' + esc(String(detail.rows.length)) + ' ligne(s).</p>' +
        '<div class="table-wrap account-movement-detail-wrap"><table class="account-movement-table account-movement-detail-table"><thead><tr><th>Date</th><th>Référence</th><th>Journal</th><th>Compte</th><th>Libellé</th><th class="num">Débit</th><th class="num">Crédit</th></tr></thead><tbody>' + detailRowsHtml + '</tbody><tfoot><tr><th colspan="5">Totaux du compte collectif</th><td class="num">' + esc(amount(detail.debit)) + '</td><td class="num">' + esc(amount(detail.credit)) + '</td></tr></tfoot></table></div>';
    }
    openModal(title, subtitle, body, '<button type="button" class="btn btn-primary" data-action="close-modal">Fermer</button>', true);
  }

  function matchingAccountRecords() {
    return S.accounts().filter(function (account) {
      return Number(account.cls) === 4 && account.aux === true && account.active !== false && account.postable !== false;
    }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), 'fr'); });
  }

  function pointageAccountRecords() {
    return S.accounts().filter(function (account) {
      return Number(account.cls) === 5 && account.active !== false && account.postable !== false;
    }).sort(function (a, b) { return String(a.code).localeCompare(String(b.code), 'fr'); });
  }

  function accountingControlLineRows(accountCode) {
    var matchingByLine = Object.create(null);
    var pointageByLine = Object.create(null);
    S.matchingGroups(accountCode).forEach(function (group) {
      group.lineKeys.forEach(function (key) { matchingByLine[key] = group; });
    });
    S.pointageMarks(accountCode).forEach(function (mark) { pointageByLine[mark.lineKey] = mark; });
    var rows = [];
    S.postedEntries().forEach(function (entry) {
      (entry.lines || []).forEach(function (line, lineIndex) {
        if (String(line.account) !== String(accountCode)) return;
        var lineKey = entry.id + ':' + lineIndex;
        rows.push({
          lineKey: lineKey,
          entryId: entry.id,
          lineIndex: lineIndex,
          accountCode: String(accountCode),
          date: entry.date,
          monthKey: String(entry.date || '').slice(0, 7),
          reference: String(entry.reference || ''),
          journal: String(entry.journal || ''),
          description: String(entry.description || ''),
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          matchingGroup: matchingByLine[lineKey] || null,
          pointageMark: pointageByLine[lineKey] || null
        });
      });
    });
    return rows.sort(function (a, b) { return a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference) || a.lineIndex - b.lineIndex; });
  }

  function accountingControlSearchMatches(row, query) {
    var needle = String(query || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    if (!needle) return true;
    return [row.date, row.reference, row.journal, row.description, row.accountCode].join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().indexOf(needle) !== -1;
  }

  function renderMatchingLineRow(row) {
    var isMatched = !!row.matchingGroup;
    var checked = ui.matching.selectedLineKeys.indexOf(row.lineKey) !== -1;
    var selection = isMatched
      ? '<span class="matching-line-letter" title="Lettrage actif">' + esc(row.matchingGroup.code) + '</span>'
      : '<input type="checkbox" data-action="toggle-matching-line" data-line-key="' + esc(row.lineKey) + '"' + (checked ? ' checked' : '') + ' aria-label="Sélectionner la ligne ' + esc(row.reference) + ' du ' + esc(dateLabel(row.date)) + '">';
    return '<tr class="reconciliation-line-row' + (isMatched ? ' is-matched' : '') + '">' +
      '<td class="reconciliation-selection-cell">' + selection + '</td>' +
      '<td class="nowrap">' + esc(dateLabel(row.date)) + '</td>' +
      '<td><strong>' + esc(row.journal) + '</strong></td>' +
      '<td><strong>' + esc(row.reference) + '</strong></td>' +
      '<td class="reconciliation-description-cell">' + esc(row.description || '—') + '</td>' +
      '<td class="num">' + esc(amount(row.debit)) + '</td>' +
      '<td class="num">' + esc(amount(row.credit)) + '</td>' +
      '<td>' + (isMatched ? '<span class="reconciliation-status is-matched">Lettré · ' + esc(row.matchingGroup.code) + '</span>' : '<span class="reconciliation-status is-open">Non lettré</span>') + '</td>' +
    '</tr>';
  }

  function viewMatching() {
    var accounts = matchingAccountRecords();
    var selectedAccount = accounts.find(function (account) { return String(account.code) === String(ui.matching.account); }) || accounts[0] || null;
    ui.matching.account = selectedAccount ? String(selectedAccount.code) : '';
    if (!selectedAccount) ui.matching.selectedLineKeys = [];
    var allRows = selectedAccount ? accountingControlLineRows(selectedAccount.code) : [];
    ui.matching.selectedLineKeys = ui.matching.selectedLineKeys.filter(function (key) {
      return allRows.some(function (row) { return row.lineKey === key && !row.matchingGroup; });
    });
    var visibleRows = allRows.filter(function (row) {
      if (ui.matching.status === 'unmatched' && row.matchingGroup) return false;
      if (ui.matching.status === 'matched' && !row.matchingGroup) return false;
      return accountingControlSearchMatches(row, ui.matching.q);
    });
    var selectedRows = allRows.filter(function (row) { return ui.matching.selectedLineKeys.indexOf(row.lineKey) !== -1 && !row.matchingGroup; });
    var selectedDebit = selectedRows.reduce(function (sum, row) { return sum + row.debit; }, 0);
    var selectedCredit = selectedRows.reduce(function (sum, row) { return sum + row.credit; }, 0);
    var selectedDifference = selectedDebit - selectedCredit;
    var canAssign = !!selectedAccount && selectedRows.length >= 2 && selectedDebit > 0 && selectedDebit === selectedCredit;
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (selectedAccount && String(account.code) === String(selectedAccount.code) ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var lineRows = visibleRows.map(renderMatchingLineRow).join('');
    if (!lineRows) lineRows = '<tr><td colspan="8"><div class="empty-state reconciliation-empty"><strong>' +
      (selectedAccount ? (allRows.length ? 'Aucune ligne ne correspond aux filtres.' : 'Aucune écriture validée pour ce compte dans le cycle.') : 'Aucun compte auxiliaire actif de classe 4 n’est disponible.') +
      '</strong>Les brouillons ne sont pas présentés dans le lettrage.</div></td></tr>';
    var groups = selectedAccount ? S.matchingGroups(selectedAccount.code) : [];
    var groupsHtml = groups.map(function (group) {
      var rowByKey = Object.create(null);
      allRows.forEach(function (row) { rowByKey[row.lineKey] = row; });
      var references = group.lineKeys.map(function (key) { var row = rowByKey[key]; return row ? row.reference : 'Ligne historique'; });
      return '<tr><td><strong>' + esc(group.code) + '</strong></td><td>' + esc(String(group.lineKeys.length)) + '</td><td>' + esc(references.join(' · ')) + '</td><td class="num">' + esc(amount(group.debit)) + '</td><td class="num">' + esc(amount(group.credit)) + '</td><td><button type="button" class="btn btn-ghost btn-sm" data-action="cancel-letter" data-id="' + esc(group.id) + '">Annuler le lettrage</button></td></tr>';
    }).join('');
    if (!groupsHtml) groupsHtml = '<tr><td colspan="6"><div class="empty-state reconciliation-empty"><strong>Aucun lettrage actif pour ce compte.</strong>Les lignes validées restent disponibles dans la liste ci-dessus.</div></td></tr>';
    var selectionState = selectedRows.length < 2
      ? 'Sélectionnez au moins deux lignes non lettrées.'
      : (selectedDebit === selectedCredit && selectedDebit > 0
        ? 'Équilibre exact : prêt à créer le lettrage.'
        : 'Écart débit − crédit : ' + esc(amount(selectedDifference)) + ' XOF.');
    return '<div class="exchange-workspace reconciliation-workspace matching-workspace">' +
      '<div class="alert info reconciliation-boundary-note"><div><strong>Lettrage au niveau du compte général auxiliaire uniquement.</strong> Les écritures validées ne sont jamais modifiées. Comme les pièces ne portent pas d’identifiant fournisseur/client, ce lettrage n’attribue pas les lignes à un tiers individuel. Plusieurs lignes peuvent être rapprochées si les totaux débit et crédit sont strictement égaux.</div></div>' +
      '<div class="supplier-filter-controls reconciliation-toolbar"><label class="field"><span>Compte auxiliaire de classe 4</span><select id="matching-account" data-filter="matching:account"' + (accounts.length ? '' : ' disabled') + '>' + accountOptions + '</select></label>' +
        '<label class="field"><span>Afficher</span><select id="matching-status" data-filter="matching:status"><option value="unmatched"' + (ui.matching.status === 'unmatched' ? ' selected' : '') + '>Lignes non lettrées</option><option value="matched"' + (ui.matching.status === 'matched' ? ' selected' : '') + '>Lignes déjà lettrées</option><option value="all"' + (ui.matching.status === 'all' ? ' selected' : '') + '>Toutes les lignes</option></select></label>' +
        '<label class="field"><span>Rechercher</span><input id="matching-search" type="search" data-filter="matching:q" value="' + esc(ui.matching.q) + '" placeholder="Date, journal, référence ou libellé"></label></div>' +
      '<div class="exchange-summary-grid reconciliation-summary-grid"><div><small>Lignes validées du compte</small><strong>' + allRows.length + '</strong></div><div><small>Lignes déjà lettrées</small><strong>' + allRows.filter(function (row) { return !!row.matchingGroup; }).length + '</strong></div><div><small>Lignes sélectionnées</small><strong>' + selectedRows.length + '</strong></div></div>' +
      '<section class="exchange-card reconciliation-card"><div class="supplier-directory-head"><div><h4>' + esc(selectedAccount ? selectedAccount.code + ' · ' + selectedAccount.label : 'Comptes auxiliaires indisponibles') + '</h4><p>Choisissez des lignes validées du même compte. Les mouvements restent dans le grand livre inchangés.</p></div></div>' +
        '<div class="table-wrap exchange-table-wrap reconciliation-table-wrap"><table class="exchange-mapping-table reconciliation-table matching-table"><thead><tr><th>Sél.</th><th>Date</th><th>Journal</th><th>Référence</th><th>Libellé de la pièce</th><th class="num">Débit</th><th class="num">Crédit</th><th>État</th></tr></thead><tbody>' + lineRows + '</tbody></table></div>' +
        '<div class="reconciliation-selection-summary"><div><small>Sélection</small><strong>' + selectedRows.length + ' ligne(s) · Débit ' + esc(amount(selectedDebit)) + ' · Crédit ' + esc(amount(selectedCredit)) + ' · Écart ' + esc(amount(selectedDifference)) + ' XOF</strong><span>' + selectionState + '</span></div><button type="button" class="btn btn-primary" data-action="assign-letter"' + (canAssign ? '' : ' disabled') + '>Lettrer la sélection</button></div>' +
      '</section>' +
      '<section class="exchange-card reconciliation-card"><div class="supplier-directory-head"><div><h4>Lettrages actifs</h4><p>Les lettres sont un suivi local au dossier, historisé indépendamment des pièces.</p></div></div>' +
        '<div class="table-wrap exchange-table-wrap reconciliation-table-wrap"><table class="exchange-mapping-table reconciliation-table matching-groups-table"><thead><tr><th>Lettre</th><th>Lignes</th><th>Références</th><th class="num">Débit</th><th class="num">Crédit</th><th>Action</th></tr></thead><tbody>' + groupsHtml + '</tbody></table></div>' +
      '</section>' +
      '<p class="exchange-footnote">Les lettres ne sont ni des imputations, ni des écritures, ni des soldes auxiliaires. L’annulation conserve l’historique et libère les lignes pour un nouveau lettrage.</p>' +
    '</div>';
  }

  function renderPointageLineRow(row) {
    var mark = row.pointageMark;
    var action = mark
      ? '<button type="button" class="btn btn-ghost btn-sm" data-action="unpoint-entry-line" data-line-key="' + esc(row.lineKey) + '">Retirer</button>'
      : '<button type="button" class="btn btn-ghost btn-sm" data-action="point-entry-line" data-line-key="' + esc(row.lineKey) + '">Pointer</button>';
    var markLabel = mark
      ? '<span class="reconciliation-status is-pointed">Pointé · ' + esc(mark.code) + '</span>' + (mark.statementDate ? '<small>Relevé du ' + esc(dateLabel(mark.statementDate)) + '</small>' : '') + (mark.source === 'bank-statement' ? '<small>Confirmé depuis un relevé importé</small>' : '')
      : '<span class="reconciliation-status is-open">Non pointé</span>';
    return '<tr class="reconciliation-line-row' + (mark ? ' is-pointed' : '') + '"><td class="nowrap">' + esc(dateLabel(row.date)) + '</td><td><strong>' + esc(row.reference) + '</strong></td><td>' + esc(row.journal) + '</td><td class="reconciliation-description-cell">' + esc(row.description || '—') + '</td><td class="num">' + esc(amount(row.debit)) + '</td><td class="num">' + esc(amount(row.credit)) + '</td><td><div class="pointage-state-cell">' + markLabel + action + '</div></td></tr>';
  }

  function bankStatementMappingSelect(field, label, headers, selectedIndex) {
    var options = '<option value="">— Choisir une colonne —</option>' + (headers || []).map(function (header, index) {
      var name = String(header == null ? '' : header).trim() || ('Colonne ' + BankStatement.columnLabel(index));
      return '<option value="' + index + '"' + (Number(selectedIndex) === index ? ' selected' : '') + '>' + esc(BankStatement.columnLabel(index) + ' · ' + name) + '</option>';
    }).join('');
    return '<label class="field"><span>' + esc(label) + '</span><select data-bank-map="' + esc(field) + '">' + options + '</select></label>';
  }

  function bankStatementEffectiveMapping(session) {
    var mapping = Object.assign({}, session.mapping || {});
    mapping.headerIndex = session.headerIndex;
    if (session.amountMode === 'single') {
      mapping.debitColumn = -1;
      mapping.creditColumn = -1;
    } else {
      mapping.amountColumn = -1;
    }
    return mapping;
  }

  function analyzeBankStatementImport(session) {
    if (!session || !Array.isArray(session.tableRows) || !session.tableRows.length) return null;
    session.parseResult = BankStatement.parseMappedRows(session.tableRows, bankStatementEffectiveMapping(session));
    return session.parseResult;
  }

  function configureBankStatementSheet(session, sheet) {
    session.sheetName = sheet.name;
    session.tableRows = sheet.rows || [];
    session.headerIndex = BankStatement.detectHeaderIndex(session.tableRows);
    var headers = session.tableRows[session.headerIndex] || [];
    session.mapping = BankStatement.suggestMapping(headers);
    session.amountMode = session.mapping.debitColumn >= 0 || session.mapping.creditColumn >= 0 ? 'columns' : 'single';
    analyzeBankStatementImport(session);
  }

  function bestBankStatementSheet(sheets) {
    return (sheets || []).map(function (sheet, index) {
      var rows = sheet.rows || [];
      var headerIndex = BankStatement.detectHeaderIndex(rows);
      var mapping = BankStatement.suggestMapping(rows[headerIndex] || []);
      var score = (mapping.dateColumn >= 0 ? 5 : 0) +
        ((mapping.debitColumn >= 0 && mapping.creditColumn >= 0) ? 5 : 0) +
        (mapping.amountColumn >= 0 ? 4 : 0) +
        (mapping.descriptionColumn >= 0 ? 1 : 0) +
        (mapping.referenceColumn >= 0 ? 1 : 0) + Math.min(1, rows.length / 10000);
      return { sheet: sheet, score: score, index: index };
    }).sort(function (left, right) { return right.score - left.score || left.index - right.index; })[0].sheet;
  }

  function readBankStatementFile(file) {
    if (!file) return;
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'pointage.statement.import', accountingAccessContext())) {
      toast('Import refusé : le droit « pointage.statement.import » n’est pas accordé.', 'warning');
      return;
    }
    var name = String(file.name || 'releve-bancaire').slice(0, 240);
    var session = { file: file, fileName: name, mimeType: String(file.type || ''), fileSize: Number(file.size) || 0, accountCode: ui.pointage.account, errors: [], sheets: [], tableRows: [], loading: true };
    bankStatementImportSession = session;
    if (session.fileSize > BankStatement.MAX_FILE_BYTES) {
      session.loading = false;
      session.errors.push('Le fichier dépasse la limite de 5 Mo.');
      render();
      return;
    }
    var isWorkbook = /\.xlsx$/i.test(name) || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (!isWorkbook && !/\.csv$/i.test(name) && file.type !== 'text/csv' && file.type !== 'application/csv') {
      session.loading = false;
      session.errors.push('Sélectionnez un fichier CSV ou un classeur Excel .xlsx.');
      render();
      return;
    }
    render();
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var bytes = new Uint8Array(reader.result || new ArrayBuffer(0));
        if (isWorkbook) {
          var workbook = AccountingExchange.listTableWorkbook(bytes);
          if (!workbook.ok) session.errors = workbook.errors || ['Classeur Excel illisible.'];
          else {
            session.sheets = workbook.sheets;
            configureBankStatementSheet(session, bestBankStatementSheet(session.sheets));
          }
        } else {
          var csvText = new TextDecoder('utf-8').decode(bytes);
          var parsedCsv = AccountingExchange.parseTableCsv(csvText);
          if (!parsedCsv.ok) session.errors = parsedCsv.errors || ['Fichier CSV illisible.'];
          else {
            session.sheets = [{ name: 'CSV', rows: parsedCsv.rows }];
            configureBankStatementSheet(session, session.sheets[0]);
          }
        }
      } catch (error) {
        session.errors = [error && error.message || 'Lecture du relevé impossible.'];
      }
      session.loading = false;
      render();
    };
    reader.onerror = function () {
      session.loading = false;
      session.errors = ['Lecture du fichier impossible dans ce navigateur.'];
      render();
    };
    reader.readAsArrayBuffer(file);
  }

  function bankStatementImportPanelHtml(accounts) {
    var session = bankStatementImportSession;
    var selectedAccount = session && accounts.find(function (account) { return String(account.code) === String(session.accountCode); }) || accounts[0] || null;
    var accountOptions = (accounts || []).map(function (account) {
      var selected = session ? String(account.code) === String(session.accountCode) : selectedAccount && String(account.code) === String(selectedAccount.code);
      return '<option value="' + esc(account.code) + '"' + (selected ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var errorMarkup = session && session.errors && session.errors.length
      ? '<div class="alert error"><div><strong>Lecture du relevé impossible</strong><ul>' + session.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
      : '';
    var progressMarkup = session && session.loading ? '<div class="alert info">Lecture locale du fichier en cours…</div>' : '';
    var previewMarkup = '';
    if (session && !session.loading && session.tableRows && session.tableRows.length) {
      var headers = session.tableRows[session.headerIndex] || [];
      var mapping = session.mapping || {};
      var headerOptions = session.tableRows.slice(0, 20).map(function (row, index) {
        var sample = (row || []).slice(0, 5).map(function (value) { return String(value == null ? '' : value).trim(); }).filter(Boolean).join(' · ');
        return '<option value="' + index + '"' + (index === session.headerIndex ? ' selected' : '') + '>Ligne ' + (index + 1) + (sample ? ' — ' + esc(sample.slice(0, 90)) : '') + '</option>';
      }).join('');
      var sheetOptions = session.sheets.length > 1
        ? '<label class="field"><span>Feuille Excel</span><select data-bank-sheet>' + session.sheets.map(function (sheet) {
          return '<option value="' + esc(sheet.name) + '"' + (sheet.name === session.sheetName ? ' selected' : '') + '>' + esc(sheet.name) + '</option>';
        }).join('') + '</select></label>'
        : '';
      var amountOptions = '<option value="columns"' + (session.amountMode === 'columns' ? ' selected' : '') + '>Colonnes Débit et Crédit</option><option value="single"' + (session.amountMode === 'single' ? ' selected' : '') + '>Une colonne Montant signée</option>';
      var amountMapping = session.amountMode === 'single'
        ? bankStatementMappingSelect('amountColumn', 'Colonne Montant', headers, mapping.amountColumn) +
          '<label class="field"><span>Le signe positif signifie</span><select data-bank-direction><option value="credit"' + (mapping.positiveDirection !== 'debit' ? ' selected' : '') + '>Crédit du relevé (entrée)</option><option value="debit"' + (mapping.positiveDirection === 'debit' ? ' selected' : '') + '>Débit du relevé (sortie)</option></select></label>'
        : bankStatementMappingSelect('debitColumn', 'Colonne Débit du relevé', headers, mapping.debitColumn) +
          bankStatementMappingSelect('creditColumn', 'Colonne Crédit du relevé', headers, mapping.creditColumn);
      var controls = '<div class="bank-statement-mapping-grid">' +
        '<label class="field"><span>Ligne d’en-tête</span><select data-bank-header>' + headerOptions + '</select></label>' + sheetOptions +
        bankStatementMappingSelect('dateColumn', 'Date de l’opération', headers, mapping.dateColumn) +
        bankStatementMappingSelect('descriptionColumn', 'Libellé / description (facultatif)', headers, mapping.descriptionColumn) +
        bankStatementMappingSelect('referenceColumn', 'Référence (facultatif)', headers, mapping.referenceColumn) +
        '<label class="field"><span>Présentation des montants</span><select data-bank-amount-mode>' + amountOptions + '</select></label>' +
        amountMapping + '</div>';
      var parseResult = session.parseResult || analyzeBankStatementImport(session);
      var validation = parseResult && parseResult.errors && parseResult.errors.length
        ? '<div class="alert warning"><div><strong>Correspondance à compléter</strong><ul>' + parseResult.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div></div>'
        : '';
      var rowPreview = parseResult && parseResult.rows ? parseResult.rows.slice(0, 8).map(function (row) {
        var rowStatus = row.valid ? '<span class="reconciliation-status is-pointed">Valide</span>' : '<span class="reconciliation-status is-open">À contrôler</span>';
        return '<tr><td>' + row.rowNumber + '</td><td>' + esc(row.date || '—') + '</td><td>' + esc(row.reference || '—') + '</td><td>' + esc(row.description || '—') + '</td><td class="num">' + (row.statementDebit ? esc(amount(row.statementDebit)) : '—') + '</td><td class="num">' + (row.statementCredit ? esc(amount(row.statementCredit)) : '—') + '</td><td>' + rowStatus + (row.errors.length ? '<small>' + esc(row.errors.join(' · ')) + '</small>' : '') + '</td></tr>';
      }).join('') : '';
      var previewTable = rowPreview
        ? '<div class="table-wrap bank-statement-preview-wrap"><table class="exchange-mapping-table bank-statement-preview-table"><thead><tr><th>Ligne</th><th>Date</th><th>Référence</th><th>Libellé</th><th class="num">Débit relevé</th><th class="num">Crédit relevé</th><th>Contrôle</th></tr></thead><tbody>' + rowPreview + '</tbody></table></div>'
        : '';
      var importButton = '<button type="button" class="btn btn-primary" data-action="confirm-bank-statement-import"' + (parseResult && parseResult.ok && parseResult.validCount > 0 && selectedAccount && !session.saving ? '' : ' disabled') + '>' + (session.saving ? 'Enregistrement local…' : 'Enregistrer le relevé et ses lignes') + '</button>';
      previewMarkup = '<div class="bank-statement-file-summary"><strong>' + esc(session.fileName) + '</strong><span>' + (session.fileSize / 1024).toFixed(0) + ' Ko · ' + esc(session.sheetName || 'CSV') + '</span></div>' +
        '<div class="bank-statement-account-field"><label class="field"><span>Compte de trésorerie concerné</span><select data-bank-statement-account' + (accounts.length ? '' : ' disabled') + '>' + accountOptions + '</select></label></div>' +
        controls + validation +
        (parseResult ? '<div class="bank-statement-preview-summary"><strong>' + parseResult.validCount + ' ligne(s) exploitable(s)</strong><span>' + parseResult.invalidCount + ' à contrôler · ' + parseResult.rows.length + ' ligne(s) lue(s). Les lignes invalides seront conservées mais exclues des suggestions.</span></div>' : '') +
        previewTable + '<div class="exchange-preview-footer">' + importButton + '<button type="button" class="btn btn-ghost" data-action="cancel-bank-statement-import">Annuler la prévisualisation</button></div>';
    }
    var storageUnavailable = !BankStatementStorage || !BankStatementStorage.available();
    return '<section class="exchange-card bank-statement-import-card"><div class="supplier-directory-head"><div><h4>Importer un relevé bancaire</h4><p>Fichier tabulaire générique CSV ou Excel (.xlsx), sans profil bancaire présumé. Le contenu est lu dans ce navigateur et n’est pas transmis au serveur.</p></div>' +
      '<button type="button" class="btn btn-primary" data-action="choose-bank-statement-file"' + (storageUnavailable || !accounts.length ? ' disabled' : '') + '>＋ Choisir un fichier</button></div>' +
      '<input id="bank-statement-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
      '<div class="alert warning bank-statement-storage-note"><div><strong>Stockage de démonstration uniquement.</strong> L’original et les lignes sont conservés dans IndexedDB sur cet appareil, séparément par dossier. Ce prototype n’est pas relié aux comptes PERFECTO ni au Google Drive de l’organisation ; ce stockage local n’est pas une sauvegarde cloud.</div></div>' +
      (storageUnavailable ? '<div class="alert error">Le stockage local du navigateur est indisponible ; le relevé ne peut pas être conservé.</div>' : '') +
      '<p class="small muted">CSV UTF-8 ou classeur .xlsx sans macros · 5 Mo maximum · aperçu et choix des colonnes avant enregistrement · aucune écriture comptable créée ou modifiée.</p>' +
      errorMarkup + progressMarkup + previewMarkup + '</section>';
  }

  function renderBankStatementReconciliation(statement, ledgerRows) {
    if (!statement) return '<div class="empty-state bank-statement-empty"><strong>Aucun relevé sélectionné pour ce compte.</strong>Choisissez un fichier CSV/XLSX ci-dessus pour commencer.</div>';
    var activeMarks = S.pointageMarks(statement.accountCode).filter(function (mark) { return mark.bankStatementId === statement.id; });
    var marksByRowId = Object.create(null);
    activeMarks.forEach(function (mark) { marksByRowId[mark.bankStatementRowId] = mark; });
    var pageSize = 50;
    var pageCount = Math.max(1, Math.ceil((statement.rows || []).length / pageSize));
    if (!Number.isInteger(Number(ui.pointage.statementPage)) || Number(ui.pointage.statementPage) < 0) ui.pointage.statementPage = 0;
    if (ui.pointage.statementPage >= pageCount) ui.pointage.statementPage = pageCount - 1;
    var start = ui.pointage.statementPage * pageSize;
    var end = Math.min(start + pageSize, (statement.rows || []).length);
    var visibleRows = (statement.rows || []).slice(start, end);
    var rowsHtml = visibleRows.map(function (row) {
      var mark = marksByRowId[row.id];
      var ledgerRow = mark && ledgerRows.find(function (item) { return item.lineKey === mark.lineKey; });
      var matchContent = '';
      if (!row.valid) {
        matchContent = '<span class="reconciliation-status is-open">À contrôler</span><small>' + esc((row.errors || []).join(' · ')) + '</small>';
      } else if (mark) {
        matchContent = '<span class="reconciliation-status is-pointed">Pointé · ' + esc(mark.code) + '</span>' +
          (ledgerRow ? '<small>' + esc(dateLabel(ledgerRow.date) + ' · ' + ledgerRow.journal + ' · ' + ledgerRow.reference) + '</small>' : '<small>La ligne comptable associée n’est plus dans le cycle affiché.</small>') +
          '<small>Pour retirer ce pointage, utilisez « Retirer » dans la liste du grand livre ci-dessous.</small>';
      } else {
        var suggestions = BankStatement.suggestMatches(row, ledgerRows, { dateToleranceDays: Number(ui.pointage.dateToleranceDays) });
        if (!suggestions.length) {
          matchContent = '<span class="reconciliation-status is-open">Aucune suggestion</span><small>Montant et sens exacts requis, dans la tolérance de date choisie.</small>';
        } else {
          matchContent = '<div class="bank-statement-suggestion-head"><span class="reconciliation-status is-open">' + suggestions.length + ' suggestion(s) · à confirmer</span><small>Débit relevé ↔ crédit comptable · crédit relevé ↔ débit comptable</small></div><ul class="bank-statement-suggestions">' +
            suggestions.map(function (candidate) {
              var book = candidate.ledger;
              return '<li><div><strong>' + esc(dateLabel(book.date) + ' · ' + book.journal + ' · ' + book.reference) + '</strong><span>' + esc(book.description || '—') + '</span><small>Débit ' + esc(amount(book.debit)) + ' · Crédit ' + esc(amount(book.credit)) + ' · ' + esc(candidate.reasons.join(' · ')) + '</small></div>' +
                '<button type="button" class="btn btn-primary btn-sm" data-action="confirm-bank-statement-match" data-id="' + esc(statement.id) + '" data-statement-row-id="' + esc(row.id) + '" data-line-key="' + esc(book.lineKey) + '">Confirmer le pointage</button></li>';
            }).join('') + '</ul>';
        }
      }
      return '<tr class="bank-statement-row' + (!row.valid ? ' is-invalid' : (mark ? ' is-linked' : '')) + '"><td><strong>' + row.rowNumber + '</strong><br><span class="nowrap">' + esc(row.date || '—') + '</span></td>' +
        '<td><strong>' + esc(row.reference || '—') + '</strong><br><span>' + esc(row.description || '—') + '</span></td>' +
        '<td class="num">' + (row.statementDebit ? esc(amount(row.statementDebit)) : '—') + '</td><td class="num">' + (row.statementCredit ? esc(amount(row.statementCredit)) : '—') + '</td><td class="bank-statement-match-cell">' + matchContent + '</td></tr>';
    }).join('');
    if (!rowsHtml) rowsHtml = '<tr><td colspan="5"><div class="empty-state bank-statement-empty"><strong>Le relevé ne contient aucune ligne à afficher.</strong></div></td></tr>';
    var pagination = pageCount > 1
      ? '<div class="bank-statement-pagination"><button type="button" class="btn btn-ghost btn-sm" data-action="select-bank-statement-page" data-page="' + Math.max(0, ui.pointage.statementPage - 1) + '"' + (ui.pointage.statementPage === 0 ? ' disabled' : '') + '>← Précédent</button><span>Lignes ' + (start + 1) + '–' + end + ' sur ' + statement.rows.length + '</span><button type="button" class="btn btn-ghost btn-sm" data-action="select-bank-statement-page" data-page="' + Math.min(pageCount - 1, ui.pointage.statementPage + 1) + '"' + (ui.pointage.statementPage >= pageCount - 1 ? ' disabled' : '') + '>Suivant →</button></div>'
      : '<div class="bank-statement-pagination"><span>' + statement.rows.length + ' ligne(s) du relevé</span></div>';
    var validCount = Number(statement.validCount) || 0;
    var invalidCount = Number(statement.invalidCount) || 0;
    return '<div class="bank-statement-record-summary"><div><strong>' + esc(statement.fileName) + '</strong><span>Importé le ' + esc(dateLabel(String(statement.importedAt || '').slice(0, 10))) + ' · ' + validCount + ' ligne(s) exploitables · ' + invalidCount + ' à contrôler</span></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-action="download-bank-statement" data-id="' + esc(statement.id) + '">↓ Télécharger l’original</button></div>' +
      '<div class="supplier-filter-controls bank-statement-controls"><label class="field"><span>Tolérance de date des suggestions</span><select data-filter="pointage:dateToleranceDays"><option value="0"' + (ui.pointage.dateToleranceDays === '0' ? ' selected' : '') + '>Date identique</option><option value="3"' + (ui.pointage.dateToleranceDays === '3' ? ' selected' : '') + '>± 3 jours</option><option value="7"' + (ui.pointage.dateToleranceDays === '7' ? ' selected' : '') + '>± 7 jours</option><option value="15"' + (ui.pointage.dateToleranceDays === '15' ? ' selected' : '') + '>± 15 jours</option><option value="30"' + (ui.pointage.dateToleranceDays === '30' ? ' selected' : '') + '>± 30 jours</option></select></label><p class="small muted">Les suggestions sont indicatives et ne pointent rien. La confirmation explicite ouvre un contrôle avant l’enregistrement.</p></div>' +
      '<div class="table-wrap exchange-table-wrap bank-statement-table-wrap"><table class="exchange-mapping-table bank-statement-table"><thead><tr><th>Ligne / date</th><th>Référence / libellé du relevé</th><th class="num">Débit banque</th><th class="num">Crédit banque</th><th>Suggestions de rapprochement</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' + pagination;
  }

  function viewPointage() {
    var accounts = pointageAccountRecords();
    var selectedAccount = accounts.find(function (account) { return String(account.code) === String(ui.pointage.account); }) || accounts[0] || null;
    ui.pointage.account = selectedAccount ? String(selectedAccount.code) : '';
    var dossier = S.currentDossier();
    var statements = bankStatementRecordsDossierId === dossier.id ? bankStatementRecords : [];
    var accountStatements = selectedAccount ? statements.filter(function (statement) { return String(statement.accountCode) === String(selectedAccount.code); }) : [];
    if (!accountStatements.some(function (statement) { return statement.id === ui.pointage.statementId; })) {
      ui.pointage.statementId = accountStatements[0] ? accountStatements[0].id : '';
      ui.pointage.statementPage = 0;
    }
    var selectedStatement = accountStatements.find(function (statement) { return statement.id === ui.pointage.statementId; }) || null;
    var periods = S.periodStats(S.exercise()).map(function (period) {
      return Object.assign({}, period, { key: Number(period.year) + '-' + String(period.month).padStart(2, '0') });
    });
    if (ui.pointage.month !== 'all' && !periods.some(function (period) { return period.key === ui.pointage.month; })) ui.pointage.month = 'all';
    var allRows = selectedAccount ? accountingControlLineRows(selectedAccount.code) : [];
    var visibleRows = allRows.filter(function (row) {
      if (ui.pointage.month !== 'all' && row.monthKey !== ui.pointage.month) return false;
      if (ui.pointage.status === 'pointed' && !row.pointageMark) return false;
      if (ui.pointage.status === 'unpointed' && row.pointageMark) return false;
      return accountingControlSearchMatches(row, ui.pointage.q);
    });
    var rowsHtml = visibleRows.map(renderPointageLineRow).join('');
    if (!rowsHtml) rowsHtml = '<tr><td colspan="7"><div class="empty-state reconciliation-empty"><strong>' +
      (selectedAccount ? (allRows.length ? 'Aucune ligne ne correspond aux filtres.' : 'Aucune écriture validée pour ce compte dans le cycle.') : 'Aucun compte de trésorerie actif de classe 5 n’est disponible.') +
      '</strong>Les brouillons sont exclus du pointage.</div></td></tr>';
    var accountOptions = accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (selectedAccount && String(account.code) === String(selectedAccount.code) ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var monthOptions = '<option value="all"' + (ui.pointage.month === 'all' ? ' selected' : '') + '>Tout le cycle</option>' + periods.map(function (period) {
      return '<option value="' + esc(period.key) + '"' + (ui.pointage.month === period.key ? ' selected' : '') + '>' + esc(accountMovementMonthLabel(period)) + '</option>';
    }).join('');
    var pointedCount = allRows.filter(function (row) { return !!row.pointageMark; }).length;
    var statementOptions = '<option value="">— Aucun relevé pour ce compte —</option>' + accountStatements.map(function (statement) {
      return '<option value="' + esc(statement.id) + '"' + (statement.id === ui.pointage.statementId ? ' selected' : '') + '>' + esc(statement.fileName + ' · ' + (Number(statement.validCount) || 0) + ' ligne(s)') + '</option>';
    }).join('');
    var loadNote = bankStatementLoadPending && bankStatementLoadingDossierId === dossier.id
      ? '<p class="small muted">Chargement des relevés conservés sur cet appareil…</p>'
      : (bankStatementLoadError && bankStatementRecordsDossierId === dossier.id ? '<div class="alert warning">' + esc(bankStatementLoadError) + '</div>' : '');
    var statementPanel = '<section class="exchange-card bank-statement-reconciliation-card"><div class="supplier-directory-head"><div><h4>Relevés importés et suggestions</h4><p>' + esc(selectedAccount ? selectedAccount.code + ' · ' + selectedAccount.label : 'Aucun compte de trésorerie') + '</p></div><label class="field bank-statement-select-field"><span>Relevé conservé</span><select data-filter="pointage:statementId"' + (accountStatements.length ? '' : ' disabled') + '>' + statementOptions + '</select></label></div>' + loadNote +
      (selectedStatement ? renderBankStatementReconciliation(selectedStatement, allRows) : (accountStatements.length ? '<div class="empty-state bank-statement-empty"><strong>Sélectionnez un relevé.</strong></div>' : '<div class="empty-state bank-statement-empty"><strong>Aucun relevé importé pour ce compte.</strong>Importez un fichier CSV ou Excel dans le panneau ci-dessus.</div>')) + '</section>';
    return '<div class="exchange-workspace reconciliation-workspace pointage-workspace">' +
      '<div class="alert info reconciliation-boundary-note"><div><strong>Pointage du grand livre de trésorerie et lecture de relevés.</strong> Le relevé est analysé localement ; ses dates, libellés, références et montants sont proposés en regard des lignes validées de classe 5. Les suggestions ne pointent jamais une ligne sans confirmation. Aucun écart comptable n’est généré et aucune écriture n’est créée ou modifiée.</div></div>' +
      '<div class="supplier-filter-controls reconciliation-toolbar pointage-toolbar"><label class="field"><span>Compte de trésorerie</span><select id="pointage-account" data-filter="pointage:account"' + (accounts.length ? '' : ' disabled') + '>' + accountOptions + '</select></label>' +
        '<label class="field"><span>Période</span><select id="pointage-month" data-filter="pointage:month">' + monthOptions + '</select></label>' +
        '<label class="field"><span>État</span><select id="pointage-status" data-filter="pointage:status"><option value="all"' + (ui.pointage.status === 'all' ? ' selected' : '') + '>Toutes les lignes</option><option value="unpointed"' + (ui.pointage.status === 'unpointed' ? ' selected' : '') + '>Non pointées</option><option value="pointed"' + (ui.pointage.status === 'pointed' ? ' selected' : '') + '>Déjà pointées</option></select></label>' +
        '<label class="field"><span>Rechercher</span><input id="pointage-search" type="search" data-filter="pointage:q" value="' + esc(ui.pointage.q) + '" placeholder="Date, journal, référence ou libellé"></label>' +
        '<label class="field"><span>Date du relevé (facultative)</span><input id="pointage-statement-date" type="date" data-filter="pointage:statementDate" value="' + esc(ui.pointage.statementDate) + '"></label></div>' +
      '<div class="exchange-summary-grid reconciliation-summary-grid"><div><small>Lignes affichées</small><strong>' + visibleRows.length + '</strong></div><div><small>Lignes pointées dans ce compte</small><strong>' + pointedCount + ' / ' + allRows.length + '</strong></div><div><small>Lignes non pointées</small><strong>' + (allRows.length - pointedCount) + '</strong></div></div>' +
      bankStatementImportPanelHtml(accounts) + statementPanel +
      '<section class="exchange-card reconciliation-card"><div class="supplier-directory-head"><div><h4>' + esc(selectedAccount ? selectedAccount.code + ' · ' + selectedAccount.label : 'Comptes de trésorerie indisponibles') + '</h4><p>Pointage manuel ou confirmé depuis un relevé. Les écritures validées restent inchangées.</p></div></div>' +
        '<div class="table-wrap exchange-table-wrap reconciliation-table-wrap"><table class="exchange-mapping-table reconciliation-table pointage-table"><thead><tr><th>Date comptable</th><th>Référence</th><th>Journal</th><th>Libellé de la pièce</th><th class="num">Débit</th><th class="num">Crédit</th><th>Pointage</th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>' +
      '</section><p class="exchange-footnote">Les fichiers sources et lignes importées sont conservés uniquement dans le navigateur de démonstration, par dossier, via IndexedDB. L’intégration à l’espace cloud d’une organisation — notamment Drive partagé — reste à connecter. Un pointage n’est pas une écriture et n’équivaut pas à un rapprochement bancaire complet.</p>' +
    '</div>';
  }

  function bindPointageView() {
    var fileInput = $('#bank-statement-file');
    if (fileInput) fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (file) readBankStatementFile(file);
      fileInput.value = '';
    });
    $$('[data-bank-map]').forEach(function (select) {
      select.addEventListener('change', function () {
        var session = bankStatementImportSession;
        if (!session) return;
        var key = select.getAttribute('data-bank-map');
        session.mapping[key] = select.value === '' ? -1 : Number(select.value);
        analyzeBankStatementImport(session);
        render();
      });
    });
    var headerSelect = $('[data-bank-header]');
    if (headerSelect) headerSelect.addEventListener('change', function () {
      var session = bankStatementImportSession;
      if (!session) return;
      session.headerIndex = Number(headerSelect.value);
      session.mapping = BankStatement.suggestMapping(session.tableRows[session.headerIndex] || []);
      session.amountMode = session.mapping.debitColumn >= 0 || session.mapping.creditColumn >= 0 ? 'columns' : 'single';
      analyzeBankStatementImport(session);
      render();
    });
    var amountModeSelect = $('[data-bank-amount-mode]');
    if (amountModeSelect) amountModeSelect.addEventListener('change', function () {
      if (!bankStatementImportSession) return;
      bankStatementImportSession.amountMode = amountModeSelect.value === 'single' ? 'single' : 'columns';
      analyzeBankStatementImport(bankStatementImportSession);
      render();
    });
    var directionSelect = $('[data-bank-direction]');
    if (directionSelect) directionSelect.addEventListener('change', function () {
      if (!bankStatementImportSession) return;
      bankStatementImportSession.mapping.positiveDirection = directionSelect.value === 'debit' ? 'debit' : 'credit';
      analyzeBankStatementImport(bankStatementImportSession);
      render();
    });
    var sheetSelect = $('[data-bank-sheet]');
    if (sheetSelect) sheetSelect.addEventListener('change', function () {
      var session = bankStatementImportSession;
      if (!session) return;
      var sheet = session.sheets.find(function (item) { return item.name === sheetSelect.value; });
      if (!sheet) return;
      configureBankStatementSheet(session, sheet);
      render();
    });
    var accountSelect = $('[data-bank-statement-account]');
    if (accountSelect) accountSelect.addEventListener('change', function () {
      if (!bankStatementImportSession) return;
      bankStatementImportSession.accountCode = accountSelect.value;
      render();
    });

    var dossier = S.currentDossier();
    if (bankStatementRecordsDossierId === dossier.id || (bankStatementLoadPending && bankStatementLoadingDossierId === dossier.id)) return;
    if (!BankStatementStorage || !BankStatementStorage.available()) {
      bankStatementRecords = [];
      bankStatementRecordsDossierId = dossier.id;
      bankStatementLoadError = 'IndexedDB n’est pas disponible dans ce navigateur.';
      bankStatementLoadPending = false;
      bankStatementLoadingDossierId = '';
      return;
    }
    bankStatementLoadPending = true;
    bankStatementLoadingDossierId = dossier.id;
    bankStatementLoadError = '';
    var sequence = ++bankStatementLoadSequence;
    BankStatementStorage.list(dossier.id).then(function (records) {
      if (sequence !== bankStatementLoadSequence) return;
      bankStatementRecords = records;
      bankStatementRecordsDossierId = dossier.id;
      bankStatementLoadPending = false;
      bankStatementLoadingDossierId = '';
      bankStatementLoadError = '';
      var account = ui.pointage.account;
      var firstForAccount = records.find(function (statement) { return String(statement.accountCode) === String(account); });
      if (!records.some(function (statement) { return statement.id === ui.pointage.statementId; })) {
        ui.pointage.statementId = firstForAccount ? firstForAccount.id : '';
        ui.pointage.statementPage = 0;
      }
      if (S.currentDossier().id === dossier.id) render();
    }).catch(function (error) {
      if (sequence !== bankStatementLoadSequence) return;
      bankStatementRecords = [];
      bankStatementRecordsDossierId = dossier.id;
      bankStatementLoadPending = false;
      bankStatementLoadingDossierId = '';
      bankStatementLoadError = error && error.message || 'Lecture des relevés conservés localement impossible.';
      if (S.currentDossier().id === dossier.id) render();
    });
  }

  function newBankStatementId() {
    return 'releve-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function confirmBankStatementImport() {
    var session = bankStatementImportSession;
    var dossier = S.currentDossier();
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'pointage.statement.import', accountingAccessContext())) {
      toast('Import refusé : le droit « pointage.statement.import » n’est pas accordé.', 'warning');
      return;
    }
    if (!session || !session.file || session.saving) { toast('Choisissez un fichier à importer.', 'warning'); return; }
    if (!BankStatementStorage || !BankStatementStorage.available()) { toast('Le stockage local IndexedDB n’est pas disponible.', 'error'); return; }
    if (!session.accountCode || !pointageAccountRecords().some(function (account) { return String(account.code) === String(session.accountCode); })) {
      toast('Choisissez un compte de trésorerie actif de classe 5.', 'warning');
      return;
    }
    var parsed = analyzeBankStatementImport(session);
    if (!parsed || !parsed.ok || !parsed.validCount) {
      toast('Corrigez le mappage et obtenez au moins une ligne valide avant l’enregistrement.', 'warning');
      render();
      return;
    }
    var statement = {
      id: newBankStatementId(),
      dossierId: dossier.id,
      fileName: session.fileName,
      mimeType: session.mimeType || 'application/octet-stream',
      fileSize: session.fileSize,
      accountCode: String(session.accountCode),
      sheetName: session.sheetName || 'CSV',
      headerIndex: session.headerIndex,
      mapping: bankStatementEffectiveMapping(session),
      importedAt: new Date().toISOString(),
      rowCount: parsed.rows.length,
      validCount: parsed.validCount,
      invalidCount: parsed.invalidCount,
      rows: parsed.rows
    };
    session.saving = true;
    render();
    BankStatementStorage.save(statement, session.file).then(function () {
      if (bankStatementImportSession === session) bankStatementImportSession = null;
      if (bankStatementRecordsDossierId !== dossier.id) bankStatementRecords = [];
      bankStatementRecordsDossierId = dossier.id;
      bankStatementRecords = [statement].concat(bankStatementRecords.filter(function (item) { return item.id !== statement.id; }));
      bankStatementLoadError = '';
      ui.pointage.account = statement.accountCode;
      ui.pointage.statementId = statement.id;
      ui.pointage.statementPage = 0;
      toast('Relevé conservé dans le navigateur de démonstration. Aucune écriture n’a été créée ou modifiée.', 'success');
      render();
    }).catch(function (error) {
      session.saving = false;
      toast(error && error.message || 'Le relevé n’a pas pu être conservé localement.', 'error');
      render();
    });
  }

  function confirmBankStatementMatch(trigger) {
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'pointage.statement.match', accountingAccessContext())) {
      toast('Action refusée : le droit « pointage.statement.match » n’est pas accordé.', 'warning');
      return;
    }
    var statementId = trigger.getAttribute('data-id') || '';
    var statementRowId = trigger.getAttribute('data-statement-row-id') || '';
    var lineKey = trigger.getAttribute('data-line-key') || '';
    var dossier = S.currentDossier();
    var statement = bankStatementRecordsDossierId === dossier.id
      ? bankStatementRecords.find(function (record) { return record.id === statementId && record.dossierId === dossier.id; })
      : null;
    if (!statement || !Array.isArray(statement.rows)) { toast('Le relevé n’est plus disponible dans le dossier actif.', 'warning'); return; }
    var statementRow = statement.rows.find(function (row) { return row.id === statementRowId; });
    if (!statementRow || !statementRow.valid) { toast('La ligne du relevé est invalide ou introuvable.', 'warning'); return; }
    var ledgerRows = accountingControlLineRows(statement.accountCode);
    var candidates = BankStatement.suggestMatches(statementRow, ledgerRows, { dateToleranceDays: Number(ui.pointage.dateToleranceDays) });
    var candidate = candidates.find(function (item) { return item.lineKey === lineKey; });
    if (!candidate) { toast('Cette suggestion n’est plus valide. Actualisez la liste avant de pointer.', 'warning'); render(); return; }
    var ledger = candidate.ledger;
    var confirmation = 'Confirmer le pointage de la ligne du relevé « ' + (statementRow.reference || statementRow.description || statementRow.id) + ' » du ' +
      (statementRow.date || 'date inconnue') + ' (' + amount(statementRow.statementAmount) + ' XOF) avec la ligne comptable ' + ledger.reference + ' du ' + dateLabel(ledger.date) +
      ' ? Cette action ajoute uniquement un marqueur de pointage ; l’écriture ne sera pas modifiée.';
    if (!window.confirm(confirmation)) return;
    var result = S.pointEntryLine(lineKey, statementRow.date, { bankStatementId: statement.id, bankStatementRowId: statementRow.id });
    if (!result.ok) { toast(result.errors.join(' ') || 'Pointage impossible.', 'warning'); return; }
    toast('Rapprochement confirmé · ' + result.pointageMark.code + '. L’écriture reste inchangée.', 'success');
    render();
  }

  function downloadBankStatement(trigger) {
    var statementId = trigger.getAttribute('data-id') || '';
    var dossierId = S.currentDossier().id;
    if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'data.export', accountingAccessContext())) {
      toast('Téléchargement refusé par défaut : le droit data.export n’est pas accordé.', 'warning');
      return;
    }
    BankStatementStorage.getFile(dossierId, statementId).then(function (record) {
      if (!record || !record.blob) { toast('Fichier source introuvable dans le stockage local de ce dossier.', 'error'); return; }
      var url = window.URL.createObjectURL(record.blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = record.fileName || 'releve-bancaire';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 1000);
    }).catch(function (error) {
      toast(error && error.message || 'Téléchargement du fichier source impossible.', 'error');
    });
  }

  function analyticalCenterMatches(record, query) {
    var needle = String(query || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    if (!needle) return true;
    return [record.code, record.name, record.description].join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().indexOf(needle) !== -1;
  }

  function viewAnalyticalCenters() {
    var records = S.analyticalCenters().slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code), 'fr'); });
    var filter = ui.analyticalCenters;
    var visible = records.filter(function (record) {
      if (filter.status === 'active' && record.active === false) return false;
      if (filter.status === 'archived' && record.active !== false) return false;
      return analyticalCenterMatches(record, filter.q);
    });
    var rows = visible.map(function (record) {
      var active = record.active !== false;
      return '<tr><td><strong>' + esc(record.code) + '</strong></td><td><strong>' + esc(record.name) + '</strong>' + (record.description ? '<br><small>' + esc(record.description) + '</small>' : '') + '</td>' +
        '<td><span class="analytic-center-status ' + (active ? 'is-active' : 'is-archived') + '">' + (active ? 'Actif' : 'Archivé') + '</span></td>' +
        '<td><div class="supplier-row-actions"><button type="button" class="btn btn-ghost btn-sm" data-action="edit-analytical-center" data-id="' + esc(record.id) + '">Modifier</button><button type="button" class="btn btn-ghost btn-sm" data-action="archive-analytical-center" data-id="' + esc(record.id) + '">' + (active ? 'Archiver' : 'Réactiver') + '</button><button type="button" class="btn btn-ghost btn-sm btn-danger-quiet" data-action="delete-analytical-center" data-id="' + esc(record.id) + '">Supprimer</button></div></td></tr>';
    }).join('');
    var emptyMessage = records.length ? 'Aucun centre ne correspond à cette recherche et à ce filtre.' : 'Aucun centre analytique n’est encore créé pour ce dossier.';
    var activeCount = records.filter(function (record) { return record.active !== false; }).length;
    return '<div class="exchange-workspace analytical-center-workspace">' +
      '<div class="alert info"><div><strong>Référentiel analytique seulement.</strong> Créez ici vos propres centres, réservés à l’analytique. Ils ne sont pas des comptes généraux et ne produisent aucune écriture. Les mouvements et états analytiques restent grisés/inactifs dans la comptabilité générale.</div></div>' +
      '<div class="exchange-summary-grid supplier-summary-grid"><div><small>Centres actifs</small><strong>' + activeCount + '</strong></div><div><small>Centres archivés</small><strong>' + (records.length - activeCount) + '</strong></div><div><small>Résultats affichés</small><strong>' + visible.length + '</strong></div></div>' +
      '<section class="exchange-card analytical-center-card"><div class="supplier-directory-head"><div><h4>Centres d’analyse</h4><p>Codes et libellés propres au dossier, sans lien avec les journaux ou le plan général.</p></div><button type="button" class="btn btn-primary" data-action="new-analytical-center">＋ Nouveau centre</button></div>' +
        '<div class="supplier-filter-controls analytical-center-filter-controls"><label class="field"><span>Rechercher</span><input id="analytical-centers-search" type="search" data-filter="analyticalCenters:q" value="' + esc(filter.q) + '" placeholder="Code, nom, description"></label><label class="field"><span>État</span><select id="analytical-centers-status" data-filter="analyticalCenters:status"><option value="active"' + (filter.status === 'active' ? ' selected' : '') + '>Centres actifs</option><option value="archived"' + (filter.status === 'archived' ? ' selected' : '') + '>Centres archivés</option><option value="all"' + (filter.status === 'all' ? ' selected' : '') + '>Tous les centres</option></select></label></div>' +
        (visible.length
          ? '<div class="table-wrap exchange-table-wrap analytical-center-table-wrap"><table class="exchange-mapping-table analytical-center-table"><thead><tr><th>Code</th><th>Centre / description</th><th>État</th><th>Actions</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
          : '<div class="empty-state registry-empty"><span class="empty-state-icon">⌕</span><h3>Aucun résultat</h3><p>' + esc(emptyMessage) + '</p></div>') +
      '</section><p class="exchange-footnote">Chaque centre est isolé dans le dossier actif et inclus dans sa sauvegarde locale. Aucune affectation analytique n’est encore comptabilisée.</p>' +
    '</div>';
  }

  function openAnalyticalCenterModal(id) {
    var existing = id ? S.analyticalCenter(id) : null;
    if (id && !existing) { toast('Centre analytique introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var code = existing ? existing.code : S.nextAnalyticalCenterCode();
    var value = function (key) { return esc(existing && existing[key] != null ? existing[key] : (key === 'code' ? code : '')); };
    var body = '<form id="analytical-center-form" novalidate><div id="analytical-center-errors" aria-live="assertive"></div>' +
      '<div class="form-grid analytical-center-form-grid"><div class="field"><label for="analytical-center-code">Code du centre <span aria-hidden="true">*</span></label><input id="analytical-center-code" name="code" type="text" maxlength="32" value="' + value('code') + '" required autocomplete="off"><span class="hint">Proposition ANA automatique ou code libre. Les codes déjà attribués ne seront pas réutilisés.</span></div>' +
      '<div class="field"><label for="analytical-center-name">Nom du centre <span aria-hidden="true">*</span></label><input id="analytical-center-name" name="name" type="text" maxlength="150" value="' + value('name') + '" required></div>' +
      '<div class="field analytical-center-description-field"><label for="analytical-center-description">Description / périmètre analytique</label><textarea id="analytical-center-description" name="description" rows="4" maxlength="500">' + value('description') + '</textarea></div></div>' +
      '<p class="small muted">Ce centre est réservé à la comptabilité analytique. Il n’est jamais un compte général et ne peut pas produire d’écriture générale.</p></form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button><button type="submit" class="btn btn-primary" form="analytical-center-form" data-action="save-analytical-center" data-analytical-center-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Créer le centre') + '</button>';
    openModal(existing ? 'Modifier le centre analytique' : 'Nouveau centre analytique', 'Référentiel réservé à l’analytique · dossier ' + esc(S.currentDossier().reference), body, footer, true);
    var form = $('#analytical-center-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var permissionAction = mode === 'edit' ? 'analyticalCenters.edit' : 'analyticalCenters.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', permissionAction, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + permissionAction + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = { code: $('#analytical-center-code').value, name: $('#analytical-center-name').value, description: $('#analytical-center-description').value };
      var result = existing ? S.updateAnalyticalCenter(existing.id, input) : S.createAnalyticalCenter(input);
      if (!result.ok) {
        $('#analytical-center-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' + result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Centre analytique mis à jour.' : 'Centre analytique ' + result.analyticalCenter.code + ' créé.', 'success');
      closeModal(true);
      render();
    });
  }

  function openingBalanceSourceDossiers(targetDossier) {
    if (!targetDossier || !targetDossier.cycleStart) return [];
    var sourceCycleEnd = OpeningBalances.dayBefore(targetDossier.cycleStart);
    if (!sourceCycleEnd) return [];
    return S.dossiers().filter(function (dossier) {
      return dossier.id !== targetDossier.id &&
        dossier.clientCode === targetDossier.clientCode &&
        dossier.accountingTypeCode === targetDossier.accountingTypeCode &&
        dossier.cycleEnd === sourceCycleEnd &&
        dossier.cycleStart < dossier.cycleEnd;
    }).sort(function (left, right) {
      return String(right.cycleEnd).localeCompare(String(left.cycleEnd));
    });
  }

  function openingBalancePlanSignature(plan) {
    if (!plan) return '';
    return JSON.stringify({
      rows: plan.rows,
      accountBalances: plan.accountBalances,
      reportDate: plan.reportDate,
      targetDate: plan.targetDate,
      sourceCycleEnd: plan.sourceCycleEnd,
      totals: plan.totals,
      balanced: plan.balanced
    });
  }

  function openingBalancePreviewSignature(preview) {
    if (!preview) return '';
    return JSON.stringify((preview.decisions || []).map(function (item) {
      return [item.accountCode, item.action, item.previousBalance, item.nextBalance, item.addedRows, item.replacedRows];
    }));
  }

  function readOpeningBalanceSource() {
    var targetDossier = S.currentDossier();
    var sourceSelect = $('#opening-balance-source');
    var sourceId = sourceSelect ? sourceSelect.value : ui.openingBalances.sourceDossierId;
    if (!sourceId) { toast('Sélectionnez un dossier de l’exercice immédiatement précédent.', 'warning'); return; }
    var sourceRead = S.readDossierStateSnapshot(sourceId);
    if (!sourceRead.ok) {
      openingBalanceTransferSession = null;
      toast(sourceRead.errors[0] || 'Lecture du dossier source impossible.', 'error');
      render();
      return;
    }
    var plan = OpeningBalances.buildTransfer(sourceRead.state, sourceRead.dossier, targetDossier, S.accounts());
    var preview = S.openingBalanceTransferPreview(sourceRead.dossier.id, plan.accountBalances, plan.rows);
    ui.openingBalances.sourceDossierId = sourceRead.dossier.id;
    openingBalanceTransferSession = {
      sourceDossierId: sourceRead.dossier.id,
      targetDossierId: targetDossier.id,
      sourceReference: sourceRead.dossier.reference,
      sourceCycleEnd: sourceRead.dossier.cycleEnd,
      plan: plan,
      preview: preview,
      readAt: new Date().toISOString()
    };
    render();
    if (!plan.ok) toast(plan.errors[0] || 'Aucun report transférable n’a été calculé.', 'warning');
    else toast('Lecture non destructive terminée : contrôlez les comptes avant le transfert.', 'success');
  }

  function applyOpeningBalanceTransferFromSession() {
    var session = openingBalanceTransferSession;
    var targetDossier = S.currentDossier();
    if (!session || session.targetDossierId !== targetDossier.id) {
      toast('Relisez les reports de l’exercice précédent avant de lancer le transfert.', 'warning');
      return;
    }
    var sourceRead = S.readDossierStateSnapshot(session.sourceDossierId);
    if (!sourceRead.ok) { toast(sourceRead.errors[0] || 'Lecture du dossier source impossible.', 'error'); return; }
    var freshPlan = OpeningBalances.buildTransfer(sourceRead.state, sourceRead.dossier, targetDossier, S.accounts());
    var freshPreview = S.openingBalanceTransferPreview(sourceRead.dossier.id, freshPlan.accountBalances, freshPlan.rows);
    var sourceChanged = openingBalancePlanSignature(freshPlan) !== openingBalancePlanSignature(session.plan);
    var targetChanged = openingBalancePreviewSignature(freshPreview) !== openingBalancePreviewSignature(session.preview);
    if (sourceChanged || targetChanged) {
      openingBalanceTransferSession = {
        sourceDossierId: sourceRead.dossier.id,
        targetDossierId: targetDossier.id,
        sourceReference: sourceRead.dossier.reference,
        sourceCycleEnd: sourceRead.dossier.cycleEnd,
        plan: freshPlan,
        preview: freshPreview,
        readAt: new Date().toISOString()
      };
      render();
      toast('Les données source ou cible ont changé depuis la lecture. Vérifiez le nouvel aperçu avant de confirmer.', 'warning');
      return;
    }
    if (!freshPlan.ok || (!freshPlan.rows.length && !freshPreview.replaceCount)) {
      toast(freshPlan.errors[0] || 'Aucune ligne ni aucun report antérieur modifié à appliquer.', 'warning');
      return;
    }
    var result = S.applyOpeningBalanceTransfer(sourceRead.dossier, freshPlan);
    if (!result.ok) { toast(result.errors[0] || 'Transfert impossible.', 'error'); return; }
    openingBalanceAuditResult = null;
    ui.openingBalances.selectedId = '';
    openingBalanceTransferSession = null;
    render();
    if (result.conflicts && result.conflicts.length) {
      toast('Transfert relançable terminé avec ' + result.changedAccounts + ' compte(s) actualisé(s). ' + result.conflicts.length + ' compte(s) ont été préservés pour contrôle manuel.', 'warning');
    } else if (result.changedAccounts) {
      toast('Transfert terminé : ' + result.addedRows + ' ligne(s) ajoutée(s), ' + result.removedRows + ' ancienne(s) ligne(s) remplacée(s), ' + result.unchangedAccounts + ' compte(s) inchangé(s).', 'success');
    } else {
      toast(result.message || 'Aucun compte n’a changé depuis le dernier transfert.', 'info');
    }
  }

  function fixedAssetOpeningBalanceControlHtml(dossier) {
    var assets = S.fixedAssets();
    var openingRows = S.openingBalances();
    var cutoff = OpeningBalances.dayBefore(dossier.cycleStart);
    var grossByAccount = Object.create(null);
    var accumulatedByAccount = Object.create(null);
    var undatedAssetCount = 0;
    assets.forEach(function (asset) {
      var accountCode = String(asset.assetAccountCode || '');
      if (accountCode && !asset.acquisitionDate) undatedAssetCount += 1;
      if (accountCode && asset.acquisitionDate && asset.acquisitionDate <= cutoff) {
        if (!grossByAccount[accountCode]) grossByAccount[accountCode] = { count: 0, gross: 0 };
        grossByAccount[accountCode].count += 1;
        grossByAccount[accountCode].gross += Number(asset.grossCost) || 0;
      }
      var depreciationCode = String(asset.accumulatedDepreciationAccountCode || '');
      if (depreciationCode && asset.acquisitionDate && asset.acquisitionDate <= cutoff) {
        if (!accumulatedByAccount[depreciationCode]) accumulatedByAccount[depreciationCode] = 0;
        accumulatedByAccount[depreciationCode] += 1;
      }
    });
    var reportByAccount = Object.create(null);
    openingRows.forEach(function (row) {
      var code = String(row.accountCode || '');
      if (!reportByAccount[code]) reportByAccount[code] = 0;
      reportByAccount[code] += (Number(row.debit) || 0) - (Number(row.credit) || 0);
    });
    var grossCodes = Object.keys(grossByAccount).sort();
    var grossTable = grossCodes.length
      ? '<div class="table-wrap exchange-table-wrap"><table class="exchange-mapping-table opening-balance-check-table"><thead><tr><th>Compte d’immobilisation</th><th>Fiches au registre</th><th>Coût brut indiqué</th><th>Report à nouveau net</th><th>Écart indicatif</th></tr></thead><tbody>' + grossCodes.map(function (code) {
        var group = grossByAccount[code];
        var account = S.account(code);
        var report = Number(reportByAccount[code]) || 0;
        var difference = report - group.gross;
        return '<tr><td><strong>' + esc(code) + '</strong><br><small>' + esc(account ? account.label : 'Compte absent du dossier') + '</small></td><td>' + group.count + '</td><td class="num">' + esc(money(group.gross)) + '</td><td class="num">' + esc(money(report)) + '</td><td class="num"><strong>' + esc(money(difference)) + '</strong></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<div class="empty-state opening-balance-check-empty"><strong>Aucune fiche du registre ne renseigne un compte d’immobilisation antérieure au report.</strong><span>La comparaison du coût brut n’est donc pas disponible dans ce dossier.</span></div>';
    var accumulatedCodes = Object.keys(accumulatedByAccount).sort();
    var accumulatedTable = accumulatedCodes.length
      ? '<div class="table-wrap exchange-table-wrap"><table class="exchange-mapping-table opening-balance-check-table"><thead><tr><th>Compte d’amortissements cumulés</th><th>Fiches associées</th><th>Report à nouveau net</th><th>État du registre</th></tr></thead><tbody>' + accumulatedCodes.map(function (code) {
        var account = S.account(code);
        return '<tr><td><strong>' + esc(code) + '</strong><br><small>' + esc(account ? account.label : 'Compte absent du dossier') + '</small></td><td>' + accumulatedByAccount[code] + '</td><td class="num">' + esc(money(Number(reportByAccount[code]) || 0)) + '</td><td><span class="opening-balance-check-status">Montant cumulé non suivi dans le registre</span></td></tr>';
      }).join('') + '</tbody></table></div>'
      : '<p class="small muted">Aucun compte d’amortissements cumulés n’est renseigné dans les fiches.</p>';
    return '<details class="opening-balance-asset-check"><summary>Contrôler les immobilisations et amortissements avec le registre (' + assets.length + ' fiche(s))</summary>' +
      '<p class="small muted">Comparaison indicative des coûts bruts renseignés aux comptes d’immobilisations et aux reports du dossier. Le registre ne porte pas les valeurs d’amortissements cumulés au début du cycle ni les dates/valeurs de sortie historiques : les écarts doivent être justifiés par les pièces et le dossier, sans correction automatique.' + (undatedAssetCount ? ' ' + undatedAssetCount + ' fiche(s) sans date d’acquisition ne sont pas incluses dans le contrôle.' : '') + '</p>' +
      '<h4>Coûts bruts renseignés par compte</h4>' + grossTable +
      '<h4>Amortissements cumulés</h4>' + accumulatedTable +
      '<p class="exchange-footnote">Une valeur identique ne constitue pas à elle seule une validation comptable ; les dates d’acquisition, cessions, travaux et autres mouvements du compte doivent être vérifiés.</p></details>';
  }

  function openingBalanceAuditHtml(dossier) {
    if (!openingBalanceAuditResult || openingBalanceAuditResult.dossierId !== dossier.id) return '';
    var result = openingBalanceAuditResult.result;
    var issues = result.issues || [];
    var body = issues.length
      ? '<ul class="opening-balance-audit-issues">' + issues.map(function (issue) {
        return '<li><strong>' + esc(issue.accountCode ? issue.accountCode + ' · ' : '') + '</strong>' + esc(issue.message) + '</li>';
      }).join('') + '</ul>'
      : '<p>Aucune anomalie structurelle n’a été détectée ; débits et crédits sont égaux.</p>';
    return '<div class="alert ' + (result.ok ? 'success' : 'warning') + ' opening-balance-audit-result" role="status"><div><strong>Contrôle des reports</strong><br>' + body +
      '<small>« Réparer » ne corrige pas automatiquement les montants : les sources de factures, d’analytique et les soldes d’amortissements ne sont pas déduits sans justificatif.</small></div></div>';
  }

  function openingBalanceTransferPanelHtml(dossier, sources) {
    var session = openingBalanceTransferSession && openingBalanceTransferSession.targetDossierId === dossier.id
      ? openingBalanceTransferSession : null;
    var selectedSourceId = session ? session.sourceDossierId : ui.openingBalances.sourceDossierId;
    if (selectedSourceId && !sources.some(function (item) { return item.id === selectedSourceId; })) selectedSourceId = '';
    var sourceOptions = '<option value="">' + (sources.length ? 'Choisir l’exercice précédent…' : 'Aucun exercice précédent enregistré') + '</option>' + sources.map(function (source) {
      return '<option value="' + esc(source.id) + '"' + (source.id === selectedSourceId ? ' selected' : '') + '>' + esc(source.reference + ' · ' + source.cycleStart + ' → ' + source.cycleEnd) + '</option>';
    }).join('');
    var previewHtml = '';
    if (session) {
      var plan = session.plan;
      var preview = session.preview;
      var warnings = (plan.warnings || []).map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('');
      var errors = (plan.errors || []).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('');
      var decisions = preview && preview.decisions || [];
      var incomingRows = (plan.rows || []).map(function (line) {
        var account = S.account(line.accountCode);
        var detail = [line.thirdParty, line.dueDate ? 'Échéance ' + dateLabel(line.dueDate) : '', line.sourceDescription].filter(Boolean).join(' · ');
        return '<tr><td><strong>' + esc(line.accountCode) + '</strong><br><small>' + esc(account ? account.label : '') + '</small></td><td>' + esc(dateLabel(line.date)) + '</td><td>' + esc(line.reference || '—') + '</td><td class="num">' + (line.debit ? esc(amount(line.debit)) : '—') + '</td><td class="num">' + (line.credit ? esc(amount(line.credit)) : '—') + '</td><td><strong>' + esc(line.label) + '</strong>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</td></tr>';
      }).join('');
      var incomingDetails = incomingRows
        ? '<details class="opening-balance-source-lines"><summary>Afficher les ' + plan.rows.length + ' ligne(s) détaillée(s) calculée(s)</summary><div class="table-wrap exchange-table-wrap opening-balance-source-lines-wrap"><table class="exchange-mapping-table opening-balance-source-lines-table"><thead><tr><th>Compte</th><th>Date</th><th>Référence</th><th>Débit</th><th>Crédit</th><th>Libellé</th></tr></thead><tbody>' + incomingRows + '</tbody></table></div></details>'
        : '';
      var rows = decisions.length ? decisions.map(function (decision) {
        var account = S.account(decision.accountCode);
        var stateLabel = decision.action === 'replace' ? 'À transférer' : (decision.action === 'conflict' ? 'À contrôler' : 'Inchangé');
        var stateClass = decision.action === 'replace' ? 'is-transfer' : (decision.action === 'conflict' ? 'is-conflict' : 'is-unchanged');
        return '<tr><td><strong>' + esc(decision.accountCode) + '</strong><br><small>' + esc(account ? account.label : '') + '</small></td><td><span class="opening-balance-transfer-status ' + stateClass + '">' + stateLabel + '</span><br><small>' + esc(decision.reason) + '</small></td><td class="num">' + (decision.previousBalance == null ? '—' : esc(money(decision.previousBalance))) + '</td><td class="num">' + esc(money(decision.nextBalance)) + '</td><td>' + decision.addedRows + ' ligne(s)' + (decision.replacedRows ? '<br><small>' + decision.replacedRows + ' actuelle(s)</small>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="5">Aucun compte de bilan avec un report à transférer.</td></tr>';
      previewHtml = '<div class="opening-balance-transfer-preview" aria-live="polite">' +
        '<div class="exchange-summary-grid opening-balance-transfer-summary"><div><small>Lignes calculées</small><strong>' + plan.rows.length + '</strong></div><div><small>Comptes actualisés</small><strong>' + preview.replaceCount + '</strong></div><div><small>Inchangés</small><strong>' + preview.unchangedCount + '</strong></div><div><small>À contrôler</small><strong>' + preview.conflictCount + '</strong></div></div>' +
        '<div class="opening-balance-transfer-totals"><span>Total calculé</span><strong>Débit ' + esc(money(plan.totals.debit)) + ' · Crédit ' + esc(money(plan.totals.credit)) + '</strong><span class="' + (plan.balanced ? 'is-balanced' : 'is-unbalanced') + '">' + (plan.balanced ? 'Équilibré' : 'Non équilibré') + '</span></div>' +
        (errors ? '<div class="alert error"><div><strong>Transfert bloqué</strong><ul>' + errors + '</ul></div></div>' : '') +
        (warnings ? '<details class="opening-balance-transfer-notes"><summary>Règles et contrôles à vérifier</summary><ul>' + warnings + '</ul></details>' : '') +
        '<div class="table-wrap exchange-table-wrap opening-balance-transfer-table-wrap"><table class="exchange-mapping-table opening-balance-transfer-table"><thead><tr><th>Compte</th><th>Décision</th><th>Solde précédent</th><th>Solde calculé</th><th>Détail</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        incomingDetails +
        (preview.conflictCount ? '<div class="alert warning"><div><strong>Les lignes manuelles ou provenant d’un autre transfert ne seront pas écrasées.</strong> Pour forcer un changement de détail (lettrable/pointable), supprimez toutes les lignes de report de ce compte puis relisez l’exercice précédent.</div></div>' : '') +
        '<div class="exchange-preview-footer"><button type="button" class="btn btn-primary" data-action="apply-opening-balance-transfer"' + (!plan.ok || !preview.replaceCount ? ' disabled' : '') + '>Appliquer les changements calculés</button></div>' +
        '<p class="exchange-footnote">Lecture de la source effectuée le ' + esc(new Date(session.readAt).toLocaleString('fr-FR')) + '. La source sera relue avant écriture ; toute variation exigera une nouvelle vérification de l’aperçu.</p>' +
      '</div>';
    }
    return '<section class="exchange-card opening-balance-transfer-card"><div class="supplier-directory-head"><div><h4>Exercice précédent</h4><p>Le dossier source est lu sans le modifier. Le transfert peut être relancé : seuls les comptes dont le solde diffère du dernier transfert sont remplacés.</p></div></div>' +
      '<div class="opening-balance-source-controls"><label class="field" for="opening-balance-source"><span>Dossier source enregistré</span><select id="opening-balance-source">' + sourceOptions + '</select><small class="hint">Même entreprise et même type comptable, cycle terminé la veille du début du dossier actif.</small></label>' +
      '<button type="button" class="btn btn-primary" data-action="read-opening-balance-source"' + (!sources.length ? ' disabled' : '') + '>Lire les reports de l’exercice précédent</button></div>' +
      (!sources.length ? '<div class="alert info"><div><strong>Aucun dossier source admissible n’a été trouvé.</strong> Le premier exercice peut être renseigné manuellement ; aucun solde n’est inventé.</div></div>' : '') +
      previewHtml + '</section>';
  }

  function viewOpeningBalances() {
    var dossier = S.currentDossier();
    if (openingBalanceTransferSession && openingBalanceTransferSession.targetDossierId !== dossier.id) openingBalanceTransferSession = null;
    var allRows = S.openingBalances().slice().sort(function (left, right) {
      return String(left.accountCode).localeCompare(String(right.accountCode)) || String(left.reference).localeCompare(String(right.reference)) || String(left.id).localeCompare(String(right.id));
    });
    var query = String(ui.openingBalances.q || '').trim().toLocaleLowerCase('fr');
    var visibleRows = allRows.filter(function (record) {
      if (!query) return true;
      var account = S.account(record.accountCode);
      return [record.accountCode, account && account.label, record.reference, record.label, record.thirdParty, record.sourceDossierReference].join(' ').toLocaleLowerCase('fr').indexOf(query) !== -1;
    });
    var selected = visibleRows.find(function (record) { return record.id === ui.openingBalances.selectedId; }) || null;
    var audit = S.auditOpeningBalances();
    var totals = audit.totals;
    var sources = openingBalanceSourceDossiers(dossier);
    var rowsHtml = visibleRows.map(function (record) {
      var account = S.account(record.accountCode);
      var selectedRow = selected && selected.id === record.id;
      var origin = record.origin === 'transfer'
        ? 'Transféré de ' + (record.sourceDossierReference || 'l’exercice précédent')
        : (record.origin === 'manual-adjusted' ? 'Origine transférée · modifié manuellement' : 'Saisi dans ce dossier');
      var labelDetails = (record.thirdParty ? '<small>Tiers / facture : ' + esc(record.thirdParty) + '</small>' : '') +
        (record.dueDate ? '<small>Échéance : ' + esc(dateLabel(record.dueDate)) + '</small>' : '') +
        '<small>' + esc(origin) + '</small>';
      return '<tr id="opening-balance-row-' + esc(safeFilePart(record.id)) + '" data-opening-balance-row data-id="' + esc(record.id) + '" class="' + (selectedRow ? 'opening-balance-selected' : '') + '"><td><button type="button" class="opening-balance-account-select" data-action="select-opening-balance" data-id="' + esc(record.id) + '" aria-pressed="' + (selectedRow ? 'true' : 'false') + '"><strong>' + esc(record.accountCode) + '</strong><span>' + esc(account ? account.label : 'Compte non disponible') + '</span></button></td>' +
        '<td>' + esc(dateLabel(record.date)) + '</td><td>' + esc(record.reference || '—') + '</td><td class="num">' + (record.debit ? esc(amount(record.debit)) : '—') + '</td><td class="num">' + (record.credit ? esc(amount(record.credit)) : '—') + '</td><td class="opening-balance-label-cell"><strong>' + esc(record.label) + '</strong>' + labelDetails + '</td></tr>';
    }).join('');
    var emptyMessage = allRows.length ? 'Aucun report ne correspond à la recherche.' : 'Aucun report à nouveau n’est enregistré dans ce dossier.';
    var auditStatus = audit.balanced ? 'Équilibré' : 'Écart à contrôler';
    var auditClass = audit.balanced ? 'is-balanced' : 'is-unbalanced';
    return '<div class="exchange-workspace opening-balances-workspace" id="opening-balances-workspace">' +
      '<div class="alert info opening-balances-intro"><div><strong>' + esc(dossier.reference) + ' · Exercice ' + esc(dossier.exerciseYear) + '</strong><br>Reports datés du ' + esc(dateLabel(S.expectedOpeningBalanceDate())) + ' (veille du début du cycle). Les reports sont un registre distinct : aucune écriture de journal n’est créée.</div></div>' +
      '<div class="exchange-summary-grid opening-balance-summary-grid"><div><small>Nombre de lignes</small><strong>' + totals.count + '</strong></div><div><small>Total débit</small><strong>' + esc(money(totals.debit)) + '</strong></div><div><small>Total crédit</small><strong>' + esc(money(totals.credit)) + '</strong></div><div><small>Contrôle</small><strong class="' + auditClass + '">' + auditStatus + (totals.difference ? ' · écart ' + esc(money(totals.difference)) : '') + '</strong></div></div>' +
      '<div class="opening-balances-toolbar"><div class="opening-balance-command-row">' +
        '<button type="button" class="btn btn-primary" data-action="new-opening-balance">＋ Insérer</button>' +
        '<button type="button" class="btn btn-ghost" data-action="edit-opening-balance" data-id="' + esc(selected ? selected.id : '') + '"' + (!selected ? ' disabled' : '') + '>Modifier</button>' +
        '<button type="button" class="btn btn-ghost btn-danger-quiet" data-action="delete-opening-balance" data-id="' + esc(selected ? selected.id : '') + '"' + (!selected ? ' disabled' : '') + '>Supprimer</button>' +
        '<button type="button" class="btn btn-ghost" data-action="audit-opening-balances">Réparer</button>' +
        '<button type="button" class="btn btn-ghost" data-action="print-opening-balances"' + (!allRows.length ? ' disabled' : '') + '>Imprimer</button>' +
      '</div><div class="opening-balance-position-row"><label class="field" for="opening-balance-position"><span>Positionner sur un compte</span><input id="opening-balance-position" type="search" value="' + esc(ui.openingBalances.position) + '" placeholder="Code, ex. 411" autocomplete="off"></label><button type="button" class="btn btn-ghost" data-action="position-opening-balance">Positionner</button></div></div>' +
      '<div class="opening-balance-controls"><label class="field" for="opening-balance-search"><span>Rechercher dans les reports</span><input id="opening-balance-search" type="search" data-filter="openingBalances.q" value="' + esc(ui.openingBalances.q) + '" placeholder="Compte, référence, libellé, tiers…" autocomplete="off"></label><p class="small muted">Sélectionnez une ligne dans le tableau pour la modifier ou la supprimer.</p></div>' +
      openingBalanceAuditHtml(dossier) +
      '<section class="exchange-card opening-balance-list-card"><div class="supplier-directory-head"><div><h4>Reports du dossier</h4><p>Liste des soldes d’ouverture et détails transmis ou saisis pour le cycle actif.</p></div><span class="opening-balance-visible-count">' + visibleRows.length + ' / ' + allRows.length + ' ligne(s)</span></div>' +
        '<div class="table-wrap exchange-table-wrap opening-balance-table-wrap"' + (visibleRows.length ? '' : ' hidden') + '><table class="exchange-mapping-table data-table opening-balance-table"><caption class="sr-only">Reports à nouveau du dossier ' + esc(dossier.reference) + '</caption><thead><tr><th>Compte</th><th>Date</th><th>Référence</th><th class="num">Débit</th><th class="num">Crédit</th><th>Libellé</th></tr></thead><tbody>' + rowsHtml + '</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td class="num">' + esc(amount(totals.debit)) + '</td><td class="num">' + esc(amount(totals.credit)) + '</td><td><strong>' + auditStatus + '</strong></td></tr></tfoot></table></div>' +
        '<div class="empty-state opening-balance-empty"' + (visibleRows.length ? ' hidden' : '') + '><strong>' + esc(emptyMessage) + '</strong><span>Utilisez « Insérer » pour un report manuel ou sélectionnez un exercice source admissible.</span></div>' +
      '</section>' +
      openingBalanceTransferPanelHtml(dossier, sources) +
      '<section class="exchange-card opening-balance-rules-card"><h4>Règles et limites de contrôle</h4><ul><li>Les comptes de bilan sont repris sur leur solde net ; les brouillons et les comptes 6 à 8 sont exclus.</li><li>Les comptes auxiliaires lettrables du dossier cible sont détaillés selon les écritures non lettrées disponibles. Les factures non soldées n’ont pas de registre dans ce prototype : les champs tiers, référence et échéance peuvent être renseignés manuellement, sans inventer un état de facture.</li><li>Les comptes de trésorerie de classe 5 distinguent le solde des lignes pointées et le détail des lignes non pointées.</li><li>Les reports analytiques restent séparés et inactifs dans ce parcours général.</li></ul></section>' +
      fixedAssetOpeningBalanceControlHtml(dossier) +
      '<p class="exchange-footnote">Stockage local de démonstration uniquement. Aucune connexion à Google Drive ni synchronisation serveur n’est effectuée.</p>' +
    '</div>';
  }

  function openOpeningBalanceModal(id) {
    var existing = id ? S.openingBalance(id) : null;
    if (id && !existing) { toast('Report à nouveau introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var expectedDate = S.expectedOpeningBalanceDate();
    var dateValue = existing && existing.date === expectedDate ? existing.date : expectedDate;
    var accounts = S.accounts().filter(function (account) {
      var accountClass = Number(account.cls || String(account.code).charAt(0));
      return accountClass >= 1 && accountClass <= 5 && account.postable !== false;
    }).sort(function (left, right) { return String(left.code).localeCompare(String(right.code)); });
    var accountOptions = '<option value="">Choisir un compte de bilan…</option>' + accounts.map(function (account) {
      return '<option value="' + esc(account.code) + '"' + (existing && existing.accountCode === account.code ? ' selected' : '') + '>' + esc(account.code + ' · ' + account.label) + '</option>';
    }).join('');
    var sourceInfo = existing && existing.sourceDossierReference
      ? '<div class="alert info"><div>Origine : ' + esc(existing.sourceDossierReference) + '. Enregistrer une modification protège cette ligne contre l’écrasement lors d’un prochain transfert.</div></div>' : '';
    var body = '<form id="opening-balance-form" novalidate><div id="opening-balance-errors" aria-live="assertive"></div>' + sourceInfo +
      '<div class="form-grid opening-balance-form-grid">' +
        '<div class="field"><label for="opening-balance-account">Compte</label><select id="opening-balance-account" name="accountCode" required>' + accountOptions + '</select><span class="hint">Compte imputable de bilan, classes 1 à 5.</span></div>' +
        '<div class="field"><label for="opening-balance-date">Date</label><input id="opening-balance-date" name="date" type="date" value="' + esc(dateValue) + '" min="' + esc(expectedDate) + '" max="' + esc(expectedDate) + '" required><span class="hint">Date fixe du report : veille du début du cycle.</span></div>' +
        '<div class="field"><label for="opening-balance-reference">Référence</label><input id="opening-balance-reference" name="reference" type="text" maxlength="120" value="' + esc(existing && existing.reference || '') + '" placeholder="Facture, pièce source…"></div>' +
        '<div class="field"><label for="opening-balance-third-party">Tiers / facture non soldée</label><input id="opening-balance-third-party" name="thirdParty" type="text" maxlength="200" value="' + esc(existing && existing.thirdParty || '') + '" placeholder="Nom ou référence documentaire"><span class="hint">Détail manuel, sans registre ni statut de facture dans ce prototype.</span></div>' +
        '<div class="field"><label for="opening-balance-debit">Débit (XOF)</label><input id="opening-balance-debit" name="debit" type="number" min="0" step="1" value="' + (existing && existing.debit ? esc(existing.debit) : '') + '"></div>' +
        '<div class="field"><label for="opening-balance-credit">Crédit (XOF)</label><input id="opening-balance-credit" name="credit" type="number" min="0" step="1" value="' + (existing && existing.credit ? esc(existing.credit) : '') + '"></div>' +
        '<div class="field"><label for="opening-balance-label">Libellé</label><input id="opening-balance-label" name="label" type="text" maxlength="300" value="' + esc(existing && existing.label || 'Report au ' + dateValue) + '" required></div>' +
        '<div class="field"><label for="opening-balance-due-date">Échéance documentaire (facultatif)</label><input id="opening-balance-due-date" name="dueDate" type="date" value="' + esc(existing && existing.dueDate || '') + '"></div>' +
      '</div></form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="opening-balance-form" data-action="save-opening-balance" data-opening-balance-mode="' + mode + '">' + (existing ? 'Enregistrer les modifications' : 'Insérer le report') + '</button>';
    openModal(existing ? 'Modifier le report ' + esc(existing.accountCode) : 'Insérer un report à nouveau',
      'Dossier ' + esc(S.currentDossier().reference) + ' · date du report ' + esc(dateLabel(expectedDate)), body, footer, true);
    var form = $('#opening-balance-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var permissionAction = mode === 'edit' ? 'openingBalances.edit' : 'openingBalances.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', permissionAction, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + permissionAction + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        accountCode: $('#opening-balance-account').value,
        date: $('#opening-balance-date').value,
        reference: $('#opening-balance-reference').value,
        thirdParty: $('#opening-balance-third-party').value,
        debit: $('#opening-balance-debit').value || 0,
        credit: $('#opening-balance-credit').value || 0,
        label: $('#opening-balance-label').value,
        dueDate: $('#opening-balance-due-date').value
      };
      var result = existing ? S.updateOpeningBalance(existing.id, input) : S.createOpeningBalance(input);
      if (!result.ok) {
        $('#opening-balance-errors').innerHTML = '<div class="alert error" role="alert"><ul>' + (result.errors || []).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      openingBalanceAuditResult = null;
      ui.openingBalances.selectedId = result.openingBalance.id;
      closeModal(true);
      toast(existing ? 'Report à nouveau modifié.' : 'Report à nouveau inséré.', 'success');
      render();
    });
  }

  function bindOpeningBalancesView() {
    var sourceSelect = $('#opening-balance-source');
    if (sourceSelect) sourceSelect.addEventListener('change', function () {
      ui.openingBalances.sourceDossierId = sourceSelect.value;
      openingBalanceTransferSession = null;
    });
    var positionInput = $('#opening-balance-position');
    if (positionInput) positionInput.addEventListener('input', function () { ui.openingBalances.position = positionInput.value; });
  }

  function editionReportCatalog(children, groupId, tabId, tabLabel) {
    var sectionMap = {
      pieces: { title: 'Suivi et contrôle des pièces', description: 'Explorer les lignes, repérer les situations à contrôler et consulter les cumuls de saisie.' },
      matching: { title: 'États du lettrage', description: 'Les sous-états sont structurés ; critères, colonnes et rendus attendent vos captures.' },
      pointing: { title: 'Écritures et justifications par pointage', description: 'Les trois sous-états sont structurés ; critères, colonnes, calculs et rendus attendent vos captures.' },
      bankReconciliation: { title: 'Relevés et rapprochement bancaire', description: 'Les deux sous-états sont structurés ; format, critères, colonnes et rendus attendent vos captures.' },
      assetSummary: { title: 'Tableaux des immobilisations', description: 'États de synthèse structurés avant définition des paramètres et de la présentation.' },
      assetMovements: { title: 'Mouvements de la période', description: 'Virements, entrées et sorties ; critères et rendus à confirmer par capture.' },
      assetInventory: { title: 'Inventaire', description: 'États d’inventaire à préciser sans générer de fiches ou de listes avant vos captures.' },
      assetAccounts: { title: 'Consultation par comptes', description: 'Cumul et grand-livre des éléments à définir à partir de vos captures.' },
      assetDiscrepancies: { title: 'Écarts et anomalies', description: 'Sources de comparaison, critères et résultats à préciser ; aucun écart n’est calculé ici.' },
      assetDimensions: { title: 'Ventilations désactivées', description: 'Les trois éléments restent grisés comme dans votre capture ; aucune sortie n’est affichée.' },
      definitionsFramework: { title: 'Cadre comptable et postes du bilan', description: 'Les deux éléments sont structurés comme sur votre capture ; contenu et présentation à préciser.' },
      definitionsAccounts: { title: 'Plan comptable et postes associés', description: 'Les deux éditions restent distinctes des fonctions de maintenance du plan.' },
      definitionsThirdParties: { title: 'Tiers', description: 'Édition à préciser sans ouvrir les écrans de maintenance des fiches.' },
      definitionsJournals: { title: 'Plan des journaux', description: 'Restitution à préciser sans ouvrir la maintenance des journaux.' },
      definitionsAnalytics: { title: 'Plan analytiques', description: 'Élément visible mais désactivé dans le parcours général.' },
      cumuls: { title: 'Cumuls et ventilations', description: 'Consulter les montants selon le niveau de compte ou l’axe de ventilation à confirmer.' },
      imputation: { title: 'Imputation', description: 'Accéder aux fiches et restitutions associées à l’imputation.' },
      balances: { title: 'Balances, ouvertures et situations', description: 'États de synthèse et positions comptables à préciser selon le dossier.' },
      ledgers: { title: 'Grands livres et historiques', description: 'Détails chronologiques, reports et comparaisons d’exercices.' },
      analysis: { title: 'Analyses et contreparties', description: 'Détails de contrepartie et ventilations ; les états analytiques restent séparés.' },
      controls: { title: 'Relevés et contrôles de tiers', description: 'Restitutions à définir sans attribuer au tiers des mouvements non identifiés.' },
      exchange: { title: 'Devises et écarts de change', description: 'Éditions à construire après définition des montants et règles de conversion.' },
      situations: { title: 'Situations analytiques', description: 'États appartenant au module de comptabilité analytique séparé.' },
      budgets: { title: 'Budgets', description: 'Budgets de référence et paramètres de saisie.' },
      commitments: { title: 'Commandes et engagements', description: 'Suivi des commandes par ligne budgétaire et hors budget.' },
      realisations: { title: 'Réalisations', description: 'Rapprochement des réalisations avec les lignes budgétaires.' },
      availability: { title: 'Disponibilités budgétaires', description: 'Restes disponibles à calculer après validation des engagements et réalisations.' }
    };
    var sectionOrder = ['pieces', 'matching', 'pointing', 'bankReconciliation', 'assetSummary', 'assetMovements', 'assetInventory', 'assetAccounts', 'assetDiscrepancies', 'assetDimensions', 'definitionsFramework', 'definitionsAccounts', 'definitionsThirdParties', 'definitionsJournals', 'definitionsAnalytics', 'cumuls', 'imputation', 'balances', 'ledgers', 'analysis', 'controls', 'exchange', 'situations', 'budgets', 'commitments', 'realisations', 'availability'];
    var sections = sectionOrder.map(function (id) { return Object.assign({ id: id }, sectionMap[id]); });
    var cards = sections.map(function (section) {
      var sectionChildren = (children || []).filter(function (child) { return child.section === section.id; });
      if (!sectionChildren.length) return '';
      return '<section class="edition-report-section" aria-labelledby="edition-report-section-' + esc(section.id) + '">' +
        '<header class="edition-report-section-head"><div><h4 id="edition-report-section-' + esc(section.id) + '">' + esc(section.title) + '</h4><p>' + esc(section.description) + '</p></div><span>' + sectionChildren.length + ' élément(s)</span></header>' +
        '<div class="edition-report-card-grid">' + sectionChildren.map(function (child, index) {
          var disabled = child.status === 'inactive';
          var cardContent = '<span class="edition-report-card-top"><span class="edition-report-card-index">' + String(index + 1).padStart(2, '0') + '</span>' + menuStatusBadge(child.status) + '</span>' +
            '<strong class="edition-report-card-title">' + esc(child.label) + '</strong>' +
            '<span class="edition-report-card-description">' + esc(child.reason || '') + '</span>' +
            '<span class="edition-report-card-cta">' + (disabled ? 'Hors parcours général' : (child.status === 'partial' ? 'Ouvrir la vue existante' : 'Voir le périmètre')) + (disabled ? '' : ' <span aria-hidden="true">→</span>') + '</span>';
          return disabled
            ? '<article class="edition-report-card is-disabled" aria-disabled="true">' + cardContent + '</article>'
            : '<a class="edition-report-card" href="' + esc(accountingMenuHash(groupId, tabId, child.id)) + '">' + cardContent + '</a>';
        }).join('') + '</div></section>';
    }).join('');
    var allInactive = (children || []).length && children.every(function (child) { return child.status === 'inactive'; });
    var intro = allInactive
      ? 'Les éléments conservent la nomenclature demandée, mais tous restent désactivés dans la comptabilité générale.'
      : 'Les états sont regroupés par usage. Les vues déjà disponibles ouvrent les écrans existants ; les autres paramètres et restitutions seront affinés à partir de vos captures.';
    return '<div class="edition-report-catalog"><div class="edition-report-catalog-intro"><span class="page-kicker">ÉDITIONS · ' + esc(String(tabLabel || '').toLocaleUpperCase('fr')) + '</span><strong>Choisissez un état ou un contrôle</strong><p>' + esc(intro) + '</p></div>' + cards + '</div>';
  }

  function viewUnbalancedJournalPieces() {
    var dossier = S.currentDossier();
    var filter = ui.journal;
    var entries = sortedEntries(S.entries()).filter(function (entry) {
      if (entry.date < dossier.cycleStart || entry.date > dossier.cycleEnd) return false;
      if (filter.journal && entry.journal !== filter.journal) return false;
      var total = S.totals(entry.lines || []);
      return total.debit !== total.credit;
    });
    var draftCount = entries.filter(function (entry) { return entry.status === 'draft'; }).length;
    var postedCount = entries.filter(function (entry) { return entry.status === 'posted'; }).length;
    var totalDebit = entries.reduce(function (sum, entry) { return sum + S.totals(entry.lines || []).debit; }, 0);
    var totalCredit = entries.reduce(function (sum, entry) { return sum + S.totals(entry.lines || []).credit; }, 0);
    var absoluteDifference = entries.reduce(function (sum, entry) {
      var total = S.totals(entry.lines || []);
      return sum + Math.abs(total.debit - total.credit);
    }, 0);
    var rows = entries.map(function (entry) {
      var total = S.totals(entry.lines || []);
      var difference = total.debit - total.credit;
      return '<tr><td>' + esc(dateLabel(entry.date)) + '</td><td><strong>' + esc(entry.reference || '—') + '</strong></td><td>' + esc(journalDisplayName(S.journal(entry.journal)) || entry.journal) + '</td><td class="edition-report-description-cell">' + esc(entry.description || '—') + '</td><td>' + (entry.lines || []).length + '</td><td class="num">' + esc(amount(total.debit)) + '</td><td class="num">' + esc(amount(total.credit)) + '</td><td class="num edition-report-difference">' + esc(amount(Math.abs(difference))) + (difference > 0 ? ' D' : ' C') + '<small>' + (entry.status === 'posted' ? 'Validée · à vérifier' : 'Brouillon') + '</small></td></tr>';
    }).join('');
    var alert = postedCount
      ? '<div class="alert error journal-unbalanced-posted-warning"><div><strong>' + postedCount + ' pièce(s) validée(s) apparaissent déséquilibrées.</strong> Les pièces validées sont normalement immuables ; ce signalement ne les corrige pas. Vérifiez la base et les justificatifs.</div></div>'
      : '<div class="alert info journal-unbalanced-posted-warning"><div>Contrôle en lecture seule : les débits et crédits sont comparés pièce par pièce dans le cycle du dossier. Les brouillons sont signalés sans être validés ni modifiés.</div></div>';
    return '<div class="edition-report-detail-view journal-unbalanced-view">' +
      '<a class="btn btn-ghost btn-sm edition-report-back" href="' + esc(accountingMenuHash('editions', 'journals')) + '">← Tous les éléments Journaux</a>' +
      pageHeader('Pièces déséquilibrées', 'Pièces du cycle dont les débits et crédits diffèrent, filtrées par journal.', '<button type="button" class="btn btn-ghost" data-action="print">⎙ Imprimer</button>') +
      '<div class="card"><div class="panel">' +
        '<div class="filter-row journal-unbalanced-filter-row"><div class="field"><label for="journal-unbalanced-filter">Journal</label><select id="journal-unbalanced-filter" data-filter="journal:journal">' + journalOptions(filter.journal, true, true, true) + '</select></div><div class="field grow journal-unbalanced-cycle"><span>Cycle du dossier</span><strong>' + esc(dateLabel(dossier.cycleStart)) + ' — ' + esc(dateLabel(dossier.cycleEnd)) + '</strong></div></div>' +
        '<div class="exchange-summary-grid journal-unbalanced-summary"><div><small>Pièces signalées</small><strong>' + entries.length + '</strong></div><div><small>Brouillons</small><strong>' + draftCount + '</strong></div><div><small>Validées à vérifier</small><strong>' + postedCount + '</strong></div><div><small>Somme des écarts absolus</small><strong>' + esc(money(absoluteDifference)) + '</strong></div></div>' +
        alert +
        (entries.length
          ? '<div class="table-wrap"><table class="data-table journal-unbalanced-table"><thead><tr><th>Date</th><th>Référence</th><th>Journal</th><th>Libellé</th><th>Lignes</th><th class="num">Débit</th><th class="num">Crédit</th><th class="num">Écart</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="5"><strong>Total des pièces listées</strong></td><td class="num">' + esc(amount(totalDebit)) + '</td><td class="num">' + esc(amount(totalCredit)) + '</td><td class="num">' + esc(amount(totalDebit - totalCredit)) + '</td></tr></tfoot></table></div>'
          : '<div class="empty-state"><strong>Aucune pièce déséquilibrée détectée</strong>Le filtre sélectionné ne contient pas de pièce dont le débit diffère du crédit.</div>') +
        '<p class="exchange-footnote">Cette première vue compare uniquement les totaux débit/crédit des pièces enregistrées. Elle ne valide, ne modifie et ne supprime aucune pièce ; la restitution définitive sera ajustée après votre capture.</p>' +
      '</div></div></div>';
  }

  function editionReportChildView(child, groupId, tabId) {
    var backLabel = groupId === 'editions' && tabId === 'journals' ? 'Tous les éléments Journaux' : 'Tous les états';
    var backLink = '<a class="btn btn-ghost btn-sm edition-report-back" href="' + esc(accountingMenuHash(groupId, tabId)) + '">← ' + esc(backLabel) + '</a>';
    if (child.id === 'journal-lines') return '<div class="edition-report-detail-view">' + backLink + viewJournal() + '</div>';
    if (child.id === 'journal-unbalanced-pieces') return viewUnbalancedJournalPieces();
    if (child.id === 'general-balance') return '<div class="edition-report-detail-view">' + backLink + viewBalance() + '</div>';
    if (child.id === 'general-ledger') return '<div class="edition-report-detail-view">' + backLink + viewLedger() + '</div>';
    var inactive = child.status === 'inactive';
    var analytic = inactive && (child.section === 'analysis' || child.section === 'situations' || child.section === 'definitionsAnalytics' || child.id.indexOf('analytic-') === 0 || child.id === 'general-analytic-balance' || child.id === 'journal-analytic-center-totals');
    var noticeTitle = analytic ? 'Comptabilité analytique séparée' : (inactive ? 'Élément désactivé' : 'Sous-élément créé · écran à préciser');
    var notice = analytic
      ? 'Cet élément reste visible pour conserver la nomenclature demandée, mais il est désactivé dans la comptabilité générale. Aucun cumul analytique n’est calculé ici.'
      : (inactive
        ? 'Cet élément reste visible mais grisé selon le périmètre de votre capture. Aucune sortie ni aucun calcul n’est présenté.'
        : 'La navigation et la place de cet état sont créées. Nous attendrons votre capture de paramétrage et de résultat avant d’ajouter des filtres, des règles de regroupement ou des calculs.');
    var extra = '';
    if (child.id === 'journal-modified-pieces') {
      extra = 'Dans le prototype actuel, une pièce validée est immuable et aucun journal de versions après première saisie n’est conservé.';
    } else if (child.id === 'journal-third-party-totals' || child.section === 'controls' || child.id.indexOf('third-party-') === 0) {
      extra = 'Les pièces ne comportent pas encore d’identifiant auxiliaire individuel ; aucun solde ni mouvement ne sera attribué à un tiers comme s’il était confirmé.';
    } else if (child.id.indexOf('currency-') === 0 || child.id.indexOf('foreign-currency') === 0) {
      extra = 'Le modèle ne porte pas encore de montants en devise distincts ni de taux de conversion ; aucun équivalent XOF ni écart de change n’est calculé.';
    } else if (child.id.indexOf('budget-') === 0) {
      extra = 'Aucun registre de budget, de commande engagée ou de réalisation rapprochée n’est enregistré ; aucun disponible ni taux d’exécution n’est simulé.';
    } else if (child.id === 'general-aged-balance') {
      extra = 'Aucun registre de factures/règlements avec échéances et soldes ouverts n’est disponible pour calculer une ancienneté fiable.';
    } else if (child.id === 'general-multiyear-history') {
      extra = 'Les exercices sont stockés dans des dossiers distincts ; aucune série pluriannuelle n’est agrégée automatiquement.';
    } else if (child.id === 'general-opening-balance' || child.id === 'general-opening-journal' || child.id.indexOf('third-party-opening') === 0 || child.id.indexOf('currency-opening') === 0) {
      extra = 'Les reports restent dans le registre Reports à nouveau, séparé des écritures de journal ; cette carte ne les modifie pas.';
    } else if (child.id.indexOf('general-counterpart-') === 0) {
      extra = 'Le critère de contrepartie par pièce, notamment pour les pièces à plusieurs lignes, reste à confirmer avant tout cumul.';
    }
    var sectionLabels = {
      pieces: 'SUIVI ET CONTRÔLE DES PIÈCES', matching: 'ÉTATS DU LETTRAGE', pointing: 'ÉCRITURES ET JUSTIFICATIONS PAR POINTAGE', bankReconciliation: 'RELEVÉS ET RAPPROCHEMENT BANCAIRE', assetSummary: 'TABLEAUX DES IMMOBILISATIONS', assetMovements: 'MOUVEMENTS DE LA PÉRIODE', assetInventory: 'INVENTAIRE', assetAccounts: 'CONSULTATION PAR COMPTES', assetDiscrepancies: 'ÉCARTS ET ANOMALIES', assetDimensions: 'VENTILATIONS DÉSACTIVÉES', definitionsFramework: 'CADRE COMPTABLE ET BILAN', definitionsAccounts: 'PLAN COMPTABLE ET POSTES ASSOCIÉS', definitionsThirdParties: 'TIERS', definitionsJournals: 'PLAN DES JOURNAUX', definitionsAnalytics: 'PLAN ANALYTIQUES', cumuls: 'CUMULS ET VENTILATIONS', imputation: 'IMPUTATION',
      balances: 'BALANCES, OUVERTURES ET SITUATIONS', ledgers: 'GRANDS LIVRES ET HISTORIQUES', analysis: 'ANALYSES ET CONTREPARTIES',
      controls: 'RELEVÉS ET CONTRÔLES DE TIERS', exchange: 'DEVISES ET ÉCARTS DE CHANGE', situations: 'SITUATIONS ANALYTIQUES',
      budgets: 'BUDGETS', commitments: 'COMMANDES ET ENGAGEMENTS', realisations: 'RÉALISATIONS', availability: 'DISPONIBILITÉS BUDGÉTAIRES'
    };
    return '<div class="edition-report-placeholder">' + backLink +
      '<section class="edition-report-placeholder-card"><div class="edition-report-placeholder-heading"><div><span class="page-kicker">' + esc(sectionLabels[child.section] || 'ÉDITION') + '</span><h4>' + esc(child.label) + '</h4></div>' + menuStatusBadge(child.status) + '</div>' +
        '<p class="edition-report-placeholder-description">' + esc(child.reason || '') + '</p>' +
        '<div class="alert ' + (inactive ? 'info' : 'warning') + ' edition-report-placeholder-alert"><div><strong>' + esc(noticeTitle) + '</strong><br>' + esc(notice) + '</div></div>' +
        (extra ? '<p class="edition-report-placeholder-note">' + esc(extra) + '</p>' : '') +
        '<p class="exchange-footnote">Aucune donnée ni règle métier n’est simulée pour cet état en attendant vos références visuelles.</p>' +
      '</section></div>';
  }

  function viewAccountingMenu(params) {
    params = params || {};
    var phone = isPhoneViewport();
    var group = AccountingNavigation.getGroup(phone ? 'editions' : params.g);
    var tab = AccountingNavigation.getTab(group.id, params.t || group.defaultTab);
    var selectedChild = (tab.children || []).find(function (child) { return child.id === params.c; }) || null;
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
    var isJournalEntrySubmenu = group.id === 'saisie' && tab.id === 'journal-entry';
    var isCashOperationsSubmenu = group.id === 'saisie' && tab.id === 'live-cash';
    var isAccountMovementsSubmenu = group.id === 'saisie' && tab.id === 'account-movements';
    var isEditionReportsMenu = group.id === 'editions' && Array.isArray(tab.children) && tab.children.length > 0;
    var actions = isJournalEntrySubmenu || isEditionReportsMenu ? '' : (tab.actions || []).map(function (action) { return menuActionLink(action, tab.status); }).join('');
    var childList = isEditionReportsMenu ? '' : menuChildList(tab.children, tab.reason, group.id, tab.id, selectedChild && selectedChild.id);
    var phoneContext = phone
      ? '<span class="menu-phone-label">CONSULTATION TÉLÉPHONE · LECTURE SEULE</span>'
      : '';
    var irreversible = tab.irreversible
      ? '<div class="alert warning menu-irreversible-note"><strong>Attention : opération irréversible.</strong> Une copie complète du dossier devra être exportée et confirmée avant toute activation de cette fonction.</div>'
      : '';
    var details = isEditionReportsMenu ? '' : (selectedChild && selectedChild.reason
      ? '<p class="menu-item-reason">' + esc(selectedChild.reason) + '</p>'
      : (!isJournalEntrySubmenu && !isCashOperationsSubmenu && !isAccountMovementsSubmenu && tab.reason
        ? '<p class="menu-item-reason">' + esc(tab.reason) + '</p>'
        : ''));
    var exchangeFeature = '';
    if (isEditionReportsMenu) {
      exchangeFeature = selectedChild
        ? editionReportChildView(selectedChild, group.id, tab.id)
        : editionReportCatalog(tab.children, group.id, tab.id, tab.label);
    } else if (isJournalEntrySubmenu) {
      exchangeFeature = viewEntryJournalSelector();
    } else if (group.id === 'saisie' && tab.id === 'live-cash') {
      exchangeFeature = viewAccountingCashOperations();
    } else if (group.id === 'saisie' && tab.id === 'matching') {
      exchangeFeature = viewMatching();
    } else if (group.id === 'saisie' && tab.id === 'reconciliation') {
      exchangeFeature = viewPointage();
    } else if (isAccountMovementsSubmenu && selectedChild && selectedChild.id === 'general-movements') {
      exchangeFeature = viewGeneralAccountMovements();
    } else if (isAccountMovementsSubmenu && selectedChild && selectedChild.id === 'third-party-movements') {
      exchangeFeature = viewThirdPartyMovements();
    } else if (isAccountMovementsSubmenu && selectedChild && selectedChild.id === 'analytic-movements') {
      exchangeFeature = '<div class="alert info analytic-disabled-note"><strong>Comptabilité analytique — inactive.</strong> Cet élément reste grisé dans le menu : il ne crée ni mouvement, ni imputation, ni écriture générale. Les centres analytiques sont gérés séparément dans Définitions.</div>';
    } else if (group.id === 'definitions' && tab.id === 'responsibility-centers') {
      exchangeFeature = viewAnalyticalCenters();
    } else if (group.id === 'definitions' && tab.id === 'journals') {
      exchangeFeature = viewJournals();
    } else if (group.id === 'definitions' && tab.id === 'suppliers') {
      exchangeFeature = viewSuppliers();
    } else if (group.id === 'definitions' && tab.id === 'clients') {
      exchangeFeature = viewClients();
    } else if (group.id === 'definitions' && tab.id === 'services') {
      exchangeFeature = viewServices();
    } else if (group.id === 'definitions' && tab.id === 'other-debtors-creditors') {
      exchangeFeature = viewOtherParties();
    } else if (group.id === 'definitions' && tab.id === 'personnel') {
      exchangeFeature = viewPersonnel();
    } else if (group.id === 'definitions' && tab.id === 'fixed-asset-locations') {
      exchangeFeature = viewFixedAssetLocations();
    } else if (group.id === 'definitions' && tab.id === 'fixed-assets') {
      exchangeFeature = viewFixedAssets();
    } else if (group.id === 'saisie' && tab.id === 'opening-balances') {
      exchangeFeature = viewOpeningBalances();
    } else if (group.id === 'parametres' && tab.id === 'dossier-configuration') {
      exchangeFeature = viewAccountingConfiguration();
    } else if (group.id === 'parametres' && tab.id === 'sections-accounts') {
      exchangeFeature = viewAnalyticalSectionsConfiguration();
    } else if (group.id === 'parametres' && tab.id === 'allocation-keys') {
      exchangeFeature = viewAnalyticalAllocationKeys();
    } else if (group.id === 'parametres' && tab.id === 'analytic-natures') {
      exchangeFeature = viewAnalyticalNatures();
    } else if (group.id === 'parametres' && tab.id === 'fixed-asset-accounts') {
      exchangeFeature = viewFixedAssetAccounts();
    } else if (group.id === 'parametres' && tab.id === 'orders-accounts') {
      exchangeFeature = viewOrderAccounts();
    } else if (group.id === 'parametres' && tab.id === 'order-natures') {
      exchangeFeature = viewOrderNatures();
    } else if (group.id === 'parametres' && tab.id === 'account-controls') {
      exchangeFeature = viewAccountControls();
    } else if (group.id === 'parametres' && tab.id === 'financial-framework') {
      exchangeFeature = viewFinancialFramework();
    } else if (group.id === 'parametres' && tab.id === 'general-account-natures') {
      exchangeFeature = viewGeneralAccountNatures();
    }
    if (group.id === 'fichier') {
      switch (tab.id) {
        case 'export-other': exchangeFeature = viewAccountingExchangeExport(); break;
        case 'import-other': exchangeFeature = viewAccountingExchangeImport(); break;
        case 'import-fec': exchangeFeature = viewAccountingFecImport(); break;
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
            '<div class="accounting-menu-panel-head"><div><p class="page-kicker">' + (selectedChild ? 'ÉLÉMENT DU SOUS-MENU' : 'SOUS-MENU') + '</p><h3>' + esc(selectedChild ? selectedChild.label : (tab.id === 'orders-accounts' ? 'Comptes de suivi des marchés accordés' : (tab.id === 'order-natures' ? 'Natures des marchés accordés' : (tab.id === 'account-controls' ? 'Suivi des comptes' : tab.label)))) + '</h3></div>' + menuStatusBadge(selectedChild ? selectedChild.status : tab.status) + '</div>' +
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

  function bindAccountingConfiguration() {
    var form = $('#accounting-configuration-form');
    if (!form) return;
    var cycleStartInput = $('#config-cycle-start');
    var cycleEndInput = $('#config-cycle-end');
    var entryLimitInput = $('#config-entry-allowed-until');

    function syncEntryLimitRange() {
      if (!entryLimitInput) return;
      if (cycleStartInput && cycleStartInput.value) entryLimitInput.min = cycleStartInput.value;
      if (cycleEndInput && cycleEndInput.value) entryLimitInput.max = cycleEndInput.value;
    }

    if (cycleStartInput) cycleStartInput.addEventListener('change', syncEntryLimitRange);
    if (cycleEndInput) cycleEndInput.addEventListener('change', syncEntryLimitRange);
    syncEntryLimitRange();

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var dossier = S.currentDossier();
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'accounting.configure', accountingAccessContext(dossier))) {
        toast('Modification refusée : le droit de configuration du dossier n’est pas accordé pour ce profil ou cet appareil.', 'warning');
        return;
      }
      function value(id) {
        var input = $('#' + id, form);
        return input ? input.value : '';
      }
      function settlement(prefix) {
        return {
          minimumDelayDays: value(prefix + '-minimum-delay'),
          earliestDayOfMonth: value(prefix + '-earliest-day'),
          settlementOn: value(prefix + '-settlement-on')
        };
      }
      var result = S.updateAccountingConfiguration({
        cycleStart: value('config-cycle-start'),
        cycleEnd: value('config-cycle-end'),
        accountingConfiguration: {
          framework: value('config-framework'),
          country: value('config-country'),
          specificOrganization: value('config-specific-organization'),
          entryAllowedUntil: value('config-entry-allowed-until'),
          decimalPlaces: value('config-decimal-places'),
          numberingPeriod: value('config-numbering-period'),
          automaticClosingMonths: value('config-auto-close-months'),
          supplierSettlement: settlement('config-supplier'),
          otherPayablesSettlement: settlement('config-other-payables'),
          supplierOrdersEnabled: !!($('#config-supplier-orders', form) || {}).checked,
          euroStatementsEnabled: !!($('#config-euro-statements', form) || {}).checked
        }
      });
      if (!result.ok) {
        toast((result.errors || ['Enregistrement de la configuration impossible.']).join(' '), 'warning');
        return;
      }
      toast('Configuration enregistrée pour ' + result.dossier.clientName + ' · ' + result.dossier.reference + '.', 'success');
      render();
    });
  }

  function bindAnalyticalSectionsConfiguration() {
    var form = $('#analytical-sections-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var dossier = S.currentDossier();
      var configuration = S.analyticalSectionsConfiguration();
      if (configuration.configured) {
        toast('Ce paramétrage a déjà été validé et reste verrouillé pendant que la comptabilité analytique est inactive.', 'warning');
        return;
      }
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalSections.configure', accountingAccessContext(dossier))) {
        toast('Validation refusée : le droit de configuration analytique n’est pas accordé pour ce profil ou cet appareil.', 'warning');
        return;
      }
      function value(id) {
        var input = $('#' + id, form);
        return input ? input.value : '';
      }
      var result = S.saveAnalyticalSectionsConfiguration({
        mainSections: value('analytic-main-sections'),
        auxiliarySections: value('analytic-auxiliary-sections'),
        accounts: value('analytic-accounts')
      });
      if (!result.ok) {
        toast((result.errors || ['Validation du paramétrage impossible.']).join(' '), 'warning');
        return;
      }
      toast('Paramétrage des sections et comptes analytiques validé pour ce dossier. Les opérations analytiques restent inactives.', 'success');
      render();
    });
  }

  function bindAnalyticalAllocationKeys() {
    function counterpartLabel(kind) {
      return kind === 'auxiliaryToMain' ? 'Sections auxiliaires' : 'Familles des prestations';
    }

    function previewAllocationTable(kind, configuration, subtitle) {
      var label = counterpartLabel(kind);
      var rows = Array.isArray(configuration.rows) ? configuration.rows : [];
      var visibleRows = rows.filter(function (row) {
        return row && (row.mainSection || row.counterpart || row.auxiliarySection || row.serviceFamily || row.key);
      });
      var body = visibleRows.length
        ? '<div class="table-wrap"><table class="data-table allocation-preview-table"><thead><tr><th>Sections principales</th><th>' + label + '</th><th>Clé</th></tr></thead><tbody>' +
          visibleRows.map(function (row) {
            return '<tr><td>' + esc(row.mainSection || '') + '</td><td>' + esc(row.counterpart || row.auxiliarySection || row.serviceFamily || '') + '</td><td>' + esc(row.key || '') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="empty-state"><strong>Aucune valeur à afficher</strong><span>Renseignez la grille avant de demander un aperçu.</span></div>';
      var destination = configuration.destination
        ? '<p class="allocation-preview-destination"><strong>Destination :</strong> ' + esc(configuration.destination) + '</p>'
        : '<p class="allocation-preview-destination muted">Aucune destination renseignée.</p>';
      openModal('Clés de répartition', subtitle, body + destination + '<p class="small muted">Aucun calcul ni transfert de données n’est exécuté par cet aperçu.</p>',
        '<button type="button" class="btn btn-primary" data-action="close-modal">Fermer</button>', true);
    }

    function formRows(form) {
      return $$('[data-allocation-row]', form).map(function (row) {
        function value(field) {
          var input = $('[data-allocation-field="' + field + '"]', row);
          return input ? input.value : '';
        }
        return { mainSection: value('mainSection'), counterpart: value('counterpart'), key: value('key') };
      });
    }

    $$('.allocation-key-form').forEach(function (form) {
      var kind = form.getAttribute('data-allocation-kind');
      var tbody = $('[data-allocation-body]', form);
      if (tbody) tbody.addEventListener('input', function (event) {
        var row = event.target.closest ? event.target.closest('[data-allocation-row]') : null;
        if (!row || row !== tbody.lastElementChild) return;
        var hasValue = $$('input', row).some(function (input) { return String(input.value || '').trim(); });
        if (hasValue) tbody.insertAdjacentHTML('beforeend', allocationKeyRowHtml(kind, {}, tbody.querySelectorAll('[data-allocation-row]').length, true));
      });

      form.addEventListener('click', function (event) {
        var button = event.target.closest ? event.target.closest('[data-allocation-action]') : null;
        if (!button) return;
        var action = button.getAttribute('data-allocation-action');
        if (action === 'display') {
          var savedTable = S.analyticalAllocationKeysConfiguration()[kind];
          previewAllocationTable(kind, savedTable || { rows: [], destination: '' }, 'Configuration enregistrée · lecture seule');
        } else if (action === 'destination') {
          var destinationField = $('[data-allocation-destination]', form);
          if (destinationField && !destinationField.disabled) destinationField.focus();
        } else if (action === 'preview') {
          var destination = $('[data-allocation-destination]', form);
          previewAllocationTable(kind, { rows: formRows(form), destination: destination ? destination.value : '' }, 'Aperçu des valeurs saisies · lecture seule');
        }
      });

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var dossier = S.currentDossier();
        var current = S.analyticalAllocationKeysConfiguration()[kind];
        if (current && current.configured) {
          toast('Cette grille a déjà été validée et reste verrouillée pendant que la comptabilité analytique est inactive.', 'warning');
          return;
        }
        if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalAllocationKeys.configure', accountingAccessContext(dossier))) {
          toast('Validation refusée : le droit de configuration des clés analytiques n’est pas accordé pour ce profil ou cet appareil.', 'warning');
          return;
        }
        var destination = $('[data-allocation-destination]', form);
        var result = S.saveAnalyticalAllocationKeysConfiguration(kind, {
          rows: formRows(form),
          destination: destination ? destination.value : ''
        });
        if (!result.ok) {
          toast((result.errors || ['Validation de la grille impossible.']).join(' '), 'warning');
          return;
        }
        toast('Clés de répartition validées pour ce dossier. Aucun calcul ni transfert analytique n’a été exécuté.', 'success');
        render();
      });
    });
  }

  function openGeneralAccountNatureEditor(natureRow) {
    if (!natureRow || natureRow.separator) return;
    var dossier = S.currentDossier();
    var body = '<form id="general-account-nature-form" novalidate>' +
      '<div id="general-account-nature-errors" aria-live="assertive"></div>' +
      '<div class="general-account-nature-editor-grid">' +
        '<div class="field"><label for="general-account-nature-label">Nature</label><input id="general-account-nature-label" type="text" maxlength="120" value="' + esc(natureRow.nature || '') + '" required></div>' +
        '<div class="field"><label for="general-account-nature-accounts">Comptes</label><input id="general-account-nature-accounts" type="text" maxlength="500" spellcheck="false" value="' + esc(natureRow.accounts || '') + '"><span class="hint">Conservez l’écriture de la capture et ne répétez pas deux fois un même code dans cette nature.</span></div>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="general-account-nature-form">Enregistrer</button>';
    openModal('Modifier une nature de compte', esc(natureRow.nature), body, footer, true);

    var form = $('#general-account-nature-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'generalAccountNatures.configure', accountingAccessContext(S.currentDossier()))) {
        toast('Modification refusée : le droit de configuration des natures de comptes n’est pas accordé pour ce profil ou cet appareil.', 'warning');
        return;
      }
      var current = S.generalAccountNaturesConfiguration();
      var rows = current.rows.map(function (row) {
        if (row.id !== natureRow.id) return row;
        return {
          id: row.id,
          nature: $('#general-account-nature-label', form).value,
          accounts: $('#general-account-nature-accounts', form).value
        };
      });
      var result = S.saveGeneralAccountNaturesConfiguration({ rows: rows });
      if (!result.ok) {
        var errorRegion = $('#general-account-nature-errors', form);
        if (errorRegion) errorRegion.innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          (result.errors || ['Modification impossible.']).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast('Nature des comptes enregistrée dans le dossier. Aucune écriture n’a été modifiée.', 'success');
      closeModal(true);
      render();
    });
  }

  function bindFixedAssetAccounts() {
    var workspace = $('.fixed-asset-accounts-workspace');
    if (!workspace) return;
    var dossier = S.currentDossier();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'fixedAssetAccounts.configure', accountingAccessContext(dossier));
    var fields = ['grossValueAccount', 'accumulatedDepreciationAccount', 'depreciationExpenseAccount', 'disposalNetValueAccount', 'grantRecoveryAccount'];

    function selectRow(row) {
      if (fixedAssetAccountsEditDraft) return;
      var id = row && row.getAttribute('data-fixed-asset-account-row');
      if (!id) return;
      fixedAssetAccountsSelectedId = id;
      $$('[data-fixed-asset-account-row]', workspace).forEach(function (item) {
        var isSelected = item.getAttribute('data-fixed-asset-account-row') === id;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    $$('[data-fixed-asset-account-row]', workspace).forEach(function (row) {
      row.addEventListener('click', function () { selectRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRow(row);
      });
    });

    workspace.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-fixed-asset-account-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-fixed-asset-account-action');
      if (action === 'close') {
        fixedAssetAccountsEditDraft = null;
        fixedAssetAccountsEditDossierId = '';
        fixedAssetAccountsSelectedId = 'fixed-assets-class-21';
        navigate(accountingMenuHash('parametres', 'dossier-configuration'));
      } else if (action === 'modify') {
        if (!canConfigure || isPhoneViewport()) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var current = S.fixedAssetAccountsConfiguration();
        var storedRows = (Array.isArray(current.rows) ? current.rows : []).concat(Array.isArray(current.additionalRows) ? current.additionalRows : []);
        var isNewRow = /^fixed-assets-empty-\d+$/.test(fixedAssetAccountsSelectedId);
        var newRow = null;
        if (isNewRow) {
          var usedCustomIds = Object.create(null);
          (current.additionalRows || []).forEach(function (row) { usedCustomIds[row.id] = true; });
          var customIndex = 1;
          while (usedCustomIds['fixed-assets-custom-' + customIndex]) customIndex += 1;
          newRow = { id: 'fixed-assets-custom-' + customIndex };
          fields.forEach(function (field) { newRow[field] = ''; });
        }
        fixedAssetAccountsEditDraft = {
          rows: storedRows.map(function (row) { return Object.assign({}, row); }),
          isNewRow: isNewRow,
          slotId: isNewRow ? fixedAssetAccountsSelectedId : '',
          newRow: newRow
        };
        fixedAssetAccountsEditDossierId = dossier.id;
        render();
      } else if (action === 'reset') {
        if (!canConfigure || isPhoneViewport()) {
          toast('Réinitialisation refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        if (!window.confirm('Réinitialiser les comptes associés aux immobilisations de ce dossier aux valeurs de la capture ? Les lignes ajoutées seront retirées ; les pièces comptables ne seront pas modifiées.')) return;
        var initialized = S.initializeFixedAssetAccountsConfiguration();
        if (!initialized.ok) {
          toast((initialized.errors || ['Réinitialisation impossible.']).join(' '), 'error');
          return;
        }
        fixedAssetAccountsSelectedId = 'fixed-assets-class-21';
        toast('Comptes associés aux immobilisations réinitialisés pour ce dossier.', 'success');
        render();
      } else if (action === 'validate') {
        if (!canConfigure || !fixedAssetAccountsEditDraft || isPhoneViewport()) {
          toast('Validation refusée : un droit explicite sur ce dossier et un écran ordinateur ou tablette sont requis.', 'warning');
          return;
        }
        var editedFields = Object.create(null);
        $$('[data-fixed-asset-account-field]', workspace).forEach(function (input) {
          editedFields[input.getAttribute('data-fixed-asset-account-field')] = input.value;
        });
        var draft = fixedAssetAccountsEditDraft;
        var nextRows;
        var selectedAfterSave = fixedAssetAccountsSelectedId;
        if (draft.isNewRow) {
          var addedRow = Object.assign({}, draft.newRow, editedFields);
          if (!fields.some(function (field) { return String(addedRow[field] || '').trim(); })) {
            toast('Renseignez au moins une cellule avant d’ajouter la ligne.', 'warning');
            return;
          }
          nextRows = draft.rows.concat([addedRow]);
          selectedAfterSave = addedRow.id;
        } else {
          nextRows = draft.rows.map(function (row) {
            if (row.id !== fixedAssetAccountsSelectedId) return row;
            return Object.assign({}, row, editedFields);
          });
        }
        var fixedRows = nextRows.filter(function (row) { return !/^fixed-assets-custom-\d+$/.test(row.id); });
        var additionalRows = nextRows.filter(function (row) { return /^fixed-assets-custom-\d+$/.test(row.id); });
        var saved = S.saveFixedAssetAccountsConfiguration({ rows: fixedRows, additionalRows: additionalRows });
        if (!saved.ok) {
          toast((saved.errors || ['Enregistrement impossible.']).join(' '), 'error');
          return;
        }
        fixedAssetAccountsSelectedId = selectedAfterSave;
        fixedAssetAccountsEditDraft = null;
        fixedAssetAccountsEditDossierId = '';
        toast(draft.isNewRow ? 'Nouvelle ligne ajoutée sans modifier les lignes existantes.' : 'Comptes associés aux immobilisations enregistrés dans le dossier. Aucune écriture n’a été créée.', 'success');
        render();
      } else if (action === 'cancel') {
        fixedAssetAccountsEditDraft = null;
        fixedAssetAccountsEditDossierId = '';
        render();
      }
    });
  }

  function openOrderAccountEditor(orderRow, isNewRow) {
    var dossier = S.currentDossier();
    if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderAccounts.configure', accountingAccessContext(dossier))) {
      toast('Modification refusée : un droit explicite sur ce dossier et un écran ordinateur ou tablette sont requis.', 'warning');
      return;
    }
    var body = '<form id="order-account-form" novalidate>' +
      '<div id="order-account-errors" aria-live="assertive"></div>' +
      '<div class="order-account-editor-grid">' +
        '<div class="field"><label for="order-account-rubric">Rubrique</label><input id="order-account-rubric" type="text" maxlength="120" value="' + esc(orderRow && orderRow.rubric || '') + '"></div>' +
        '<div class="field"><label for="order-account-codes">Comptes</label><input id="order-account-codes" type="text" maxlength="500" spellcheck="false" value="' + esc(orderRow && orderRow.accounts || '') + '"><span class="hint">Conservez les signes et codes tels qu’ils apparaissent dans la capture.</span></div>' +
      '</div>' +
      '<p class="small muted">Cette table configure des correspondances uniquement ; elle ne crée aucun achat ni aucune écriture.</p>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="order-account-form">Enregistrer</button>';
    openModal(isNewRow ? 'Ajouter une rubrique de suivi' : 'Modifier une rubrique de suivi', esc(isNewRow ? 'Nouvelle rubrique' : orderRow.rubric), body, footer, true);

    var form = $('#order-account-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var currentDossier = S.currentDossier();
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderAccounts.configure', accountingAccessContext(currentDossier))) {
        toast('Modification refusée : le droit de configuration de ce dossier n’est pas accordé.', 'warning');
        return;
      }
      var rubric = $('#order-account-rubric', form).value;
      var accounts = $('#order-account-codes', form).value;
      var current = S.orderAccountsConfiguration();
      var rows = (Array.isArray(current.rows) ? current.rows : []).map(function (row) { return Object.assign({}, row); });
      var additionalRows = (Array.isArray(current.additionalRows) ? current.additionalRows : []).map(function (row) { return Object.assign({}, row); });
      var rowId = orderRow && orderRow.id;
      if (isNewRow) {
        var usedIds = Object.create(null);
        additionalRows.forEach(function (row) { usedIds[row.id] = true; });
        var customIndex = 1;
        while (usedIds['order-accounts-custom-' + customIndex]) customIndex += 1;
        rowId = 'order-accounts-custom-' + customIndex;
        additionalRows.push({ id: rowId, rubric: rubric, accounts: accounts });
      } else if (/^order-accounts-custom-\d+$/.test(rowId)) {
        additionalRows = additionalRows.map(function (row) {
          return row.id === rowId ? { id: row.id, rubric: rubric, accounts: accounts } : row;
        });
      } else {
        rows = rows.map(function (row) {
          return row.id === rowId ? { id: row.id, rubric: rubric, accounts: accounts } : row;
        });
      }
      var result = S.saveOrderAccountsConfiguration({ rows: rows, additionalRows: additionalRows });
      if (!result.ok) {
        var errorRegion = $('#order-account-errors', form);
        if (errorRegion) errorRegion.innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          (result.errors || ['Enregistrement impossible.']).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      orderAccountsSelectedId = rowId;
      closeModal(true);
      toast(isNewRow ? 'Nouvelle rubrique de suivi ajoutée au dossier.' : 'Rubrique de suivi enregistrée dans le dossier.', 'success');
      render();
    });
  }

  function bindOrderAccounts() {
    var workspace = $('.order-accounts-workspace');
    if (!workspace) return;
    var dossier = S.currentDossier();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderAccounts.configure', accountingAccessContext(dossier));

    function selectRow(row) {
      var id = row && row.getAttribute('data-order-account-row');
      if (!id) return;
      orderAccountsSelectedId = id;
      $$('[data-order-account-row]', workspace).forEach(function (item) {
        var isSelected = item.getAttribute('data-order-account-row') === id;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    $$('[data-order-account-row]', workspace).forEach(function (row) {
      row.addEventListener('click', function () { selectRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRow(row);
      });
    });

    workspace.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-order-accounts-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-order-accounts-action');
      if (action === 'close') {
        orderAccountsSelectedId = 'orders-realization-ht';
        navigate(accountingMenuHash('parametres', 'dossier-configuration'));
      } else if (action === 'modify') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var current = S.orderAccountsConfiguration();
        var isNewRow = /^order-accounts-empty-\d+$/.test(orderAccountsSelectedId);
        var selectedRow = (Array.isArray(current.rows) ? current.rows : []).concat(Array.isArray(current.additionalRows) ? current.additionalRows : []).find(function (row) {
          return row.id === orderAccountsSelectedId;
        });
        if (selectedRow || isNewRow) openOrderAccountEditor(selectedRow || null, isNewRow);
      }
    });
  }

  function openOrderNatureEditor(natureRow, isNewRow) {
    var dossier = S.currentDossier();
    if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderNatures.configure', accountingAccessContext(dossier))) {
      toast('Modification refusée : un droit explicite sur ce dossier et un écran ordinateur ou tablette sont requis.', 'warning');
      return;
    }
    var current = S.orderNaturesConfiguration();
    var allRows = (Array.isArray(current.rows) ? current.rows : []).concat(Array.isArray(current.additionalRows) ? current.additionalRows : []);
    var nextNumber = 1;
    allRows.forEach(function (row) {
      var value = String(row.number || '').trim();
      if (/^\d+$/.test(value)) nextNumber = Math.max(nextNumber, Number(value) + 1);
    });
    var number = isNewRow ? String(nextNumber) : natureRow.number;
    var name = isNewRow ? '' : natureRow.name;
    var body = '<form id="order-nature-form" novalidate>' +
      '<div id="order-nature-errors" aria-live="assertive"></div>' +
      '<div class="order-nature-editor-grid">' +
        '<div class="field"><label for="order-nature-number">Numéro</label><input id="order-nature-number" type="text" maxlength="12" value="' + esc(number || '') + '"></div>' +
        '<div class="field"><label for="order-nature-name">Nature</label><input id="order-nature-name" type="text" maxlength="120" value="' + esc(name || '') + '"></div>' +
      '</div>' +
      '<p class="small muted">Cette nomenclature décrit les types de documents ; les commandes et leurs écritures restent inactives.</p>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="order-nature-form">Enregistrer</button>';
    openModal(isNewRow ? 'Ajouter une nature de commande' : 'Modifier une nature de commande', esc(isNewRow ? 'Nouvelle nature' : 'Nature ' + natureRow.number), body, footer, true);

    var form = $('#order-nature-form');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var currentDossier = S.currentDossier();
      if (isPhoneViewport() || !hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderNatures.configure', accountingAccessContext(currentDossier))) {
        toast('Modification refusée : le droit de configuration de ce dossier n’est pas accordé.', 'warning');
        return;
      }
      var numberValue = $('#order-nature-number', form).value;
      var nameValue = $('#order-nature-name', form).value;
      var latest = S.orderNaturesConfiguration();
      var rows = (Array.isArray(latest.rows) ? latest.rows : []).map(function (row) { return Object.assign({}, row); });
      var additionalRows = (Array.isArray(latest.additionalRows) ? latest.additionalRows : []).map(function (row) { return Object.assign({}, row); });
      var rowId = natureRow && natureRow.id;
      if (isNewRow) {
        var usedIds = Object.create(null);
        additionalRows.forEach(function (row) { usedIds[row.id] = true; });
        var customIndex = 1;
        while (usedIds['order-natures-custom-' + customIndex]) customIndex += 1;
        rowId = 'order-natures-custom-' + customIndex;
        additionalRows.push({ id: rowId, number: numberValue, name: nameValue });
      } else if (/^order-natures-custom-\d+$/.test(rowId)) {
        additionalRows = additionalRows.map(function (row) {
          return row.id === rowId ? { id: row.id, number: numberValue, name: nameValue } : row;
        });
      } else {
        rows = rows.map(function (row) {
          return row.id === rowId ? { id: row.id, number: numberValue, name: nameValue } : row;
        });
      }
      var result = S.saveOrderNaturesConfiguration({ rows: rows, additionalRows: additionalRows });
      if (!result.ok) {
        var errorRegion = $('#order-nature-errors', form);
        if (errorRegion) errorRegion.innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          (result.errors || ['Enregistrement impossible.']).map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      orderNaturesSelectedId = rowId;
      closeModal(true);
      toast(isNewRow ? 'Nature de commande ajoutée au dossier.' : 'Nature de commande enregistrée dans le dossier.', 'success');
      render();
    });
  }

  function bindOrderNatures() {
    var workspace = $('.order-natures-workspace');
    if (!workspace) return;
    var dossier = S.currentDossier();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'orderNatures.configure', accountingAccessContext(dossier));

    function selectRow(row) {
      var id = row && row.getAttribute('data-order-nature-row');
      if (!id) return;
      orderNaturesSelectedId = id;
      $$('[data-order-nature-row]', workspace).forEach(function (item) {
        var isSelected = item.getAttribute('data-order-nature-row') === id;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    $$('[data-order-nature-row]', workspace).forEach(function (row) {
      row.addEventListener('click', function () { selectRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRow(row);
      });
    });

    workspace.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-order-natures-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-order-natures-action');
      if (action === 'close') {
        orderNaturesSelectedId = 'order-nature-1';
        navigate(accountingMenuHash('parametres', 'dossier-configuration'));
      } else if (action === 'modify') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var current = S.orderNaturesConfiguration();
        var isNewRow = /^order-natures-empty-\d+$/.test(orderNaturesSelectedId);
        var selectedRow = (Array.isArray(current.rows) ? current.rows : []).concat(Array.isArray(current.additionalRows) ? current.additionalRows : []).find(function (row) {
          return row.id === orderNaturesSelectedId;
        });
        if (selectedRow || isNewRow) openOrderNatureEditor(selectedRow || null, isNewRow);
      }
    });
  }

  function bindAccountControls() {
    var form = $('#account-controls-form');
    if (!form) return;
    var dossier = S.currentDossier();
    var status = $('.account-controls-status', form);

    function isAllowed() {
      return !isPhoneViewport() && hasDemoPermission(getActiveDemoMember(), 'accounting', 'accountControls.configure', accountingAccessContext(S.currentDossier()));
    }

    function setActiveField(key) {
      accountControlsSelectedField = key;
      $$('.account-controls-fieldset', form).forEach(function (fieldset) {
        var input = $('textarea[data-account-controls-field]', fieldset);
        fieldset.classList.toggle('is-active', !!input && input.getAttribute('data-account-controls-field') === key);
      });
    }

    function updateStatus(message, kind) {
      if (!status) return;
      status.textContent = message || '';
      status.className = 'account-controls-status' + (kind ? ' is-' + kind : '');
    }

    $$('textarea[data-account-controls-field]', form).forEach(function (textarea) {
      textarea.addEventListener('focus', function () { setActiveField(textarea.getAttribute('data-account-controls-field')); });
      textarea.addEventListener('click', function () { setActiveField(textarea.getAttribute('data-account-controls-field')); });
    });

    function openGeneralAccountPicker() {
      if (!isAllowed()) {
        toast('Sélection refusée : le droit de configuration de ce dossier n’est pas accordé.', 'warning');
        return;
      }
      var textarea = $('textarea[data-account-controls-field="' + accountControlsSelectedField + '"]', form);
      if (!textarea) return;
      var descriptor = {
        payableAccounts: 'Comptes à payer',
        lettrableAccounts: 'Comptes lettrables',
        receivableAccounts: 'Comptes à recevoir',
        pointableAccounts: 'Comptes pointables'
      }[accountControlsSelectedField] || 'la liste sélectionnée';
      var existingCodes = String(textarea.value || '').split(/[\s,;]+/).filter(Boolean);
      var existingLookup = Object.create(null);
      existingCodes.forEach(function (code) { existingLookup[code] = true; });
      var accounts = S.accounts().slice().sort(function (left, right) { return String(left.code).localeCompare(String(right.code), 'fr', { numeric: true }); });
      var rows = accounts.map(function (account, index) {
        var checked = existingLookup[account.code] ? ' checked' : '';
        return '<label class="account-controls-picker-row" data-picker-text="' + esc(account.code + ' ' + (account.label || '')) + '">' +
          '<input type="checkbox" data-account-controls-picker-account value="' + esc(account.code) + '" id="account-controls-picker-' + index + '"' + checked + '>' +
          '<span class="account-controls-picker-code">' + esc(account.code) + '</span><span>' + esc(account.label || '') + '</span>' +
        '</label>';
      }).join('');
      var body = '<div class="account-controls-picker">' +
        '<div class="field"><label for="account-controls-picker-search">Rechercher un compte général</label><input id="account-controls-picker-search" type="search" placeholder="Numéro ou libellé"></div>' +
        '<p class="small muted">Sélectionnez les comptes à ajouter à « ' + esc(descriptor) + ' ». Les valeurs libres déjà saisies restent inchangées.</p>' +
        '<div class="account-controls-picker-list" role="group" aria-label="Comptes généraux">' + (rows || '<div class="empty-state">Aucun compte général disponible.</div>') + '</div>' +
      '</div>';
      var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
        '<button type="button" class="btn btn-primary" data-account-controls-picker-apply>Ajouter la sélection</button>';
      openModal('Comptes généraux', esc('Ajout à ' + descriptor), body, footer, true);
      var modalRoot = $('#modal-root');
      var search = $('#account-controls-picker-search', modalRoot);
      var pickerRows = $$('.account-controls-picker-row', modalRoot);
      if (search) search.addEventListener('input', function () {
        var query = search.value.trim().toLocaleLowerCase();
        pickerRows.forEach(function (row) { row.hidden = !!query && row.getAttribute('data-picker-text').toLocaleLowerCase().indexOf(query) === -1; });
      });
      modalRoot.addEventListener('click', function (event) {
        var applyButton = event.target.closest ? event.target.closest('[data-account-controls-picker-apply]') : null;
        if (!applyButton) return;
        if (!isAllowed()) {
          toast('Sélection refusée : le droit de configuration de ce dossier n’est plus accordé.', 'warning');
          return;
        }
        var selectedCodes = $$('[data-account-controls-picker-account]:checked', modalRoot).map(function (input) { return input.value; });
        var present = Object.create(null);
        String(textarea.value || '').split(/[\s,;]+/).filter(Boolean).forEach(function (code) { present[code] = true; });
        var additions = selectedCodes.filter(function (code) {
          if (present[code]) return false;
          present[code] = true;
          return true;
        });
        if (additions.length) {
          var currentText = String(textarea.value || '');
          var separator = currentText && !/[\r\n]$/.test(currentText) ? '\n' : '';
          textarea.value = currentText + separator + additions.join('\n');
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          setActiveField(accountControlsSelectedField);
          updateStatus(additions.length + ' compte(s) ajouté(s) à la liste ; cliquez sur Valider pour enregistrer.', 'info');
        } else {
          updateStatus('Aucun nouveau compte n’a été ajouté.', 'info');
        }
        closeModal(true);
        textarea.focus();
      });
    }

    form.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-account-controls-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-account-controls-action');
      if (action === 'accounts') {
        openGeneralAccountPicker();
      } else if (action === 'cancel') {
        if (!isAllowed()) {
          toast('Annulation refusée : le droit de configuration de ce dossier n’est pas accordé.', 'warning');
          return;
        }
        var saved = S.accountControlsConfiguration();
        $$('textarea[data-account-controls-field]', form).forEach(function (textarea) {
          textarea.value = saved[textarea.getAttribute('data-account-controls-field')] || '';
        });
        setActiveField('payableAccounts');
        updateStatus('Modifications annulées ; les dernières valeurs enregistrées sont restaurées.', 'info');
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!isAllowed()) {
        toast('Validation refusée : un droit explicite sur ce dossier et un écran ordinateur ou tablette sont requis.', 'warning');
        return;
      }
      var input = {};
      $$('textarea[data-account-controls-field]', form).forEach(function (textarea) {
        input[textarea.getAttribute('data-account-controls-field')] = textarea.value;
      });
      var result = S.saveAccountControlsConfiguration(input);
      if (!result.ok) {
        updateStatus((result.errors || ['Enregistrement impossible.']).join(' '), 'error');
        toast('Enregistrement des paramètres refusé.', 'warning');
        return;
      }
      updateStatus('Paramètres de suivi des comptes enregistrés pour ce dossier.', 'success');
      toast('Paramètres de suivi des comptes enregistrés dans le dossier.', 'success');
    });

    if (dossier && accountControlsSelectedDossierId !== dossier.id) setActiveField('payableAccounts');
  }

  function bindFinancialFramework() {
    var input = $('#financial-framework-search');
    var tableWrap = $('#financial-framework-table-wrap');
    var tableBody = $('#financial-framework-rows');
    var count = $('#financial-framework-result-count');
    var empty = $('#financial-framework-empty');
    if (!input || !tableWrap || !tableBody) return;

    var rowElements = $$('[data-financial-framework-row]', tableBody);
    function applyFilter() {
      ui.financialFramework.q = input.value;
      var matches = AccountingFramework.search(input.value);
      var visibleCodes = Object.create(null);
      matches.forEach(function (record) { visibleCodes[record.code] = true; });
      rowElements.forEach(function (row) {
        row.hidden = !visibleCodes[row.getAttribute('data-account-code')];
      });
      tableWrap.hidden = matches.length === 0;
      if (empty) empty.hidden = matches.length > 0;
      if (count) count.textContent = matches.length + ' / ' + rowElements.length + ' lignes';
    }

    input.addEventListener('input', applyFilter);
    applyFilter();
  }

  function bindAnalyticalNatures() {
    var workspace = $('.analytical-natures-workspace');
    if (!workspace) return;
    var dossier = S.currentDossier();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalNatures.configure', accountingAccessContext(dossier));

    function selectRow(row) {
      var id = row && row.getAttribute('data-analytical-nature-row');
      if (!id) return;
      analyticalNatureSelectedId = id;
      $$('[data-analytical-nature-row]', workspace).forEach(function (item) {
        var isSelected = item.getAttribute('data-analytical-nature-row') === id;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    $$('[data-analytical-nature-row]', workspace).forEach(function (row) {
      row.addEventListener('click', function () { selectRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRow(row);
      });
    });

    workspace.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-analytical-nature-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-analytical-nature-action');
      if (action === 'close') {
        navigate(accountingMenuHash('parametres', 'dossier-configuration'));
      } else if (action === 'toggle-io') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var currentConfiguration = S.analyticalNaturesConfiguration();
        var selectedNature = currentConfiguration.rows.find(function (row) {
          return row.id === analyticalNatureSelectedId && !row.group;
        });
        if (!selectedNature) return;
        var nextRows = currentConfiguration.rows.map(function (row) {
          return row.id === selectedNature.id ? Object.assign({}, row, { requiredAtEntry: !row.requiredAtEntry }) : row;
        });
        var saved = S.saveAnalyticalNaturesConfiguration({ rows: nextRows });
        if (!saved.ok) {
          toast((saved.errors || ['Modification impossible.']).join(' '), 'error');
          return;
        }
        toast('Indicateur I.O. ' + (selectedNature.requiredAtEntry ? 'désactivé' : 'activé') + ' pour « ' + selectedNature.genericName + ' ». Les saisies restent inchangées.', 'success');
        render();
      } else if (action === 'modify') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var selectedRow = S.analyticalNaturesConfiguration().rows.find(function (row) {
          return row.id === analyticalNatureSelectedId && !row.group;
        });
        if (selectedRow) openAnalyticalNatureEditor(selectedRow);
      }
    });
  }

  function bindGeneralAccountNatures() {
    var workspace = $('.general-account-natures-workspace');
    if (!workspace) return;
    var dossier = S.currentDossier();
    var canConfigure = hasDemoPermission(getActiveDemoMember(), 'accounting', 'generalAccountNatures.configure', accountingAccessContext(dossier));

    function selectRow(row) {
      var id = row && row.getAttribute('data-general-account-nature-row');
      if (!id) return;
      generalAccountNatureSelectedId = id;
      $$('[data-general-account-nature-row]', workspace).forEach(function (item) {
        var isSelected = item.getAttribute('data-general-account-nature-row') === id;
        item.classList.toggle('is-selected', isSelected);
        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    $$('[data-general-account-nature-row]', workspace).forEach(function (row) {
      row.addEventListener('click', function () { selectRow(row); });
      row.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRow(row);
      });
    });

    workspace.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('[data-general-account-natures-action]') : null;
      if (!button) return;
      var action = button.getAttribute('data-general-account-natures-action');
      if (action === 'close') {
        navigate(accountingMenuHash('parametres', 'dossier-configuration'));
      } else if (action === 'modify') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Modification refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        var selectedRow = S.generalAccountNaturesConfiguration().rows.find(function (row) {
          return row.id === generalAccountNatureSelectedId && !row.separator;
        });
        if (selectedRow) openGeneralAccountNatureEditor(selectedRow);
      } else if (action === 'initialize') {
        if (isPhoneViewport() || !canConfigure) {
          toast('Initialisation refusée : un droit explicite sur ce dossier est requis.', 'warning');
          return;
        }
        if (!window.confirm('Réinitialiser les natures des comptes généraux de ce dossier aux valeurs des captures ? Les modifications de cette liste seront remplacées. Les comptes réels et les écritures ne seront pas modifiés.')) return;
        var result = S.initializeGeneralAccountNaturesConfiguration();
        if (!result.ok) {
          toast((result.errors || ['Initialisation impossible.']).join(' '), 'error');
          return;
        }
        generalAccountNatureSelectedId = 'stable-grants';
        toast('Nomenclature initialisée pour ce dossier ; aucune pièce comptable n’a été modifiée.', 'success');
        render();
      }
    });
  }

  function bindEntryJournalSelector() {
    var positionInput = $('#entry-journal-position');
    if (positionInput) {
      positionInput.addEventListener('change', function () { positionEntryJournal(positionInput.value); });
      positionInput.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        positionEntryJournal(positionInput.value);
      });
    }
    if (selectedEntryJournalCode) selectEntryJournal(selectedEntryJournalCode);
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
      if (menuParams.g === 'parametres' && menuParams.t === 'dossier-configuration') bindAccountingConfiguration();
      if (menuParams.g === 'parametres' && menuParams.t === 'sections-accounts') bindAnalyticalSectionsConfiguration();
      if (menuParams.g === 'parametres' && menuParams.t === 'allocation-keys') bindAnalyticalAllocationKeys();
      if (menuParams.g === 'parametres' && menuParams.t === 'analytic-natures') bindAnalyticalNatures();
      if (menuParams.g === 'parametres' && menuParams.t === 'fixed-asset-accounts') bindFixedAssetAccounts();
      if (menuParams.g === 'parametres' && menuParams.t === 'orders-accounts') bindOrderAccounts();
      if (menuParams.g === 'parametres' && menuParams.t === 'order-natures') bindOrderNatures();
      if (menuParams.g === 'parametres' && menuParams.t === 'account-controls') bindAccountControls();
      if (menuParams.g === 'parametres' && menuParams.t === 'financial-framework') bindFinancialFramework();
      if (menuParams.g === 'parametres' && menuParams.t === 'general-account-natures') bindGeneralAccountNatures();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'suppliers') bindSupplierView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'clients') bindClientView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'services') bindServicesView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'other-debtors-creditors') bindOtherPartyView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'personnel') bindPersonnelView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'fixed-asset-locations') bindFixedAssetLocationView();
      if (!isPhoneViewport() && menuParams.g === 'definitions' && menuParams.t === 'fixed-assets') bindFixedAssetView();
      if (!isPhoneViewport() && menuParams.g === 'saisie' && menuParams.t === 'opening-balances') bindOpeningBalancesView();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-other') bindAccountingExchangeImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-fec') bindAccountingFecImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'import-balance') bindAccountingBalanceImport();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'centralize-payroll') bindPayrollCentralization();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'centralize-sales') bindSalesCentralization();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'cancel-centralization') bindCentralizationCancellation();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'consolidate-before-result') bindAccountingConsolidationBeforeResult();
      if (!isPhoneViewport() && menuParams.g === 'fichier' && menuParams.t === 'consolidate-after-result') bindAccountingConsolidationAfterResult();
      if (!isPhoneViewport() && menuParams.g === 'saisie' && (!menuParams.t || menuParams.t === 'journal-entry')) bindEntryJournalSelector();
      if (!isPhoneViewport() && menuParams.g === 'saisie' && menuParams.t === 'live-cash') bindAccountingCashOperations();
      if (!isPhoneViewport() && menuParams.g === 'saisie' && menuParams.t === 'reconciliation') bindPointageView();
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
          if (id === 'e-journal') {
            $$('#lines-body [data-field="account"]').forEach(function (select) {
              var selectedAccount = select.value;
              select.innerHTML = accountOptions(selectedAccount, input.value);
            });
          }
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
    if (section === 'matching' && (key === 'account' || key === 'status')) ui.matching.selectedLineKeys = [];
    if (section === 'pointage' && (key === 'account' || key === 'statementId')) ui.pointage.statementPage = 0;
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
      if (target && target.matches('[data-entry-journal-row]')) {
        event.preventDefault();
        selectEntryJournal(target.getAttribute('data-id'));
        return;
      }
      if (target && target.matches('[data-action="select-account-movement-node"], [data-action="select-account-movement-month"], [data-action="select-third-party-movement-record"], [data-action="select-third-party-movement-month"]')) {
        event.preventDefault();
        target.click();
        return;
      }
      if (target && target.matches('[data-action="open-entry"]') && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
        event.preventDefault();
        openEntryModal(target.getAttribute('data-id'));
      }
    }
  });

  document.addEventListener('dblclick', function (event) {
    var row = event.target.closest('[data-entry-journal-row]');
    if (!row) return;
    event.preventDefault();
    openEntryForJournal(row.getAttribute('data-id'));
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
      case 'new-opening-balance':
        openingBalanceAuditResult = null;
        openOpeningBalanceModal('');
        break;
      case 'edit-opening-balance':
        openOpeningBalanceModal(id);
        break;
      case 'delete-opening-balance': {
        var openingBalanceToDelete = S.openingBalance(id);
        if (!openingBalanceToDelete) { toast('Report à nouveau introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer le report du compte ' + openingBalanceToDelete.accountCode + ' · ' + openingBalanceToDelete.label + ' ? Les écritures, lettrages et pointages restent inchangés.')) break;
        var deletedOpeningBalance = S.deleteOpeningBalance(id);
        if (!deletedOpeningBalance.ok) { toast(deletedOpeningBalance.errors[0] || 'Suppression impossible.', 'error'); break; }
        ui.openingBalances.selectedId = '';
        openingBalanceAuditResult = null;
        toast('Report à nouveau supprimé. Les écritures, lettrages et pointages du dossier restent inchangés.', 'success');
        render();
        break;
      }
      case 'select-opening-balance':
        ui.openingBalances.selectedId = id;
        render();
        break;
      case 'position-opening-balance': {
        var positionValue = String(($('#opening-balance-position') || {}).value || '').trim().toLocaleLowerCase('fr');
        ui.openingBalances.position = ($('#opening-balance-position') || {}).value || '';
        if (!positionValue) { toast('Saisissez un code de compte ou un libellé pour vous positionner.', 'warning'); break; }
        ui.openingBalances.q = '';
        var positioningRows = S.openingBalances();
        var positioned = positioningRows.find(function (record) { return String(record.accountCode).toLocaleLowerCase('fr') === positionValue; }) ||
          positioningRows.find(function (record) {
            var account = S.account(record.accountCode);
            return String(record.accountCode + ' ' + (account && account.label || '') + ' ' + record.label).toLocaleLowerCase('fr').indexOf(positionValue) !== -1;
          });
        if (!positioned) { toast('Aucun report ne correspond à « ' + ui.openingBalances.position + ' ». ', 'warning'); break; }
        ui.openingBalances.selectedId = positioned.id;
        render();
        window.setTimeout(function () {
          var row = $$('[data-opening-balance-row]').find(function (item) { return item.getAttribute('data-id') === positioned.id; });
          if (row && typeof row.scrollIntoView === 'function') row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
        break;
      }
      case 'read-opening-balance-source':
        readOpeningBalanceSource();
        break;
      case 'apply-opening-balance-transfer':
        applyOpeningBalanceTransferFromSession();
        break;
      case 'audit-opening-balances': {
        var openingAudit = S.auditOpeningBalances();
        openingBalanceAuditResult = { dossierId: S.currentDossier().id, result: openingAudit };
        render();
        toast(openingAudit.issues.length ? 'Contrôle terminé : ' + openingAudit.issues.length + ' point(s) à vérifier. Aucun montant n’a été corrigé automatiquement.' : 'Contrôle terminé : reports équilibrés, aucune anomalie détectée.', openingAudit.issues.length ? 'warning' : 'success');
        break;
      }
      case 'print-opening-balances':
        window.print();
        break;
      case 'toggle-matching-line': {
        var matchingLineKey = trigger.getAttribute('data-line-key') || '';
        var selectedLineIndex = ui.matching.selectedLineKeys.indexOf(matchingLineKey);
        if (selectedLineIndex === -1) ui.matching.selectedLineKeys.push(matchingLineKey);
        else ui.matching.selectedLineKeys.splice(selectedLineIndex, 1);
        render();
        var matchingCheckbox = $$('[data-action="toggle-matching-line"]').find(function (item) { return item.getAttribute('data-line-key') === matchingLineKey; });
        if (matchingCheckbox) matchingCheckbox.focus();
        break;
      }
      case 'assign-letter': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'matching.assign', accountingAccessContext())) {
          toast('Action refusée par défaut : le droit « matching.assign » n’est pas accordé.', 'warning');
          break;
        }
        var assignedLetter = S.assignLetter(ui.matching.account, ui.matching.selectedLineKeys);
        if (!assignedLetter.ok) { toast(assignedLetter.errors.join(' ') || 'Lettrage impossible.', 'warning'); break; }
        ui.matching.selectedLineKeys = [];
        toast('Lettrage ' + assignedLetter.matchingGroup.code + ' créé. Les écritures restent inchangées.', 'success');
        render();
        break;
      }
      case 'cancel-letter': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'matching.cancel', accountingAccessContext())) {
          toast('Action refusée par défaut : le droit « matching.cancel » n’est pas accordé.', 'warning');
          break;
        }
        var letterToCancel = S.matchingGroup(id);
        if (!letterToCancel || letterToCancel.status === 'cancelled') { toast('Lettrage actif introuvable.', 'error'); break; }
        if (!window.confirm('Annuler le lettrage « ' + letterToCancel.code + ' » ? Les pièces restent inchangées et ses lignes seront libérées.')) break;
        var canceledLetter = S.cancelLetter(id);
        if (!canceledLetter.ok) { toast(canceledLetter.errors.join(' ') || 'Annulation impossible.', 'warning'); break; }
        ui.matching.selectedLineKeys = [];
        toast('Lettrage annulé ; son historique est conservé.', 'success');
        render();
        break;
      }
      case 'choose-bank-statement-file': {
        var bankStatementFileInput = $('#bank-statement-file');
        if (bankStatementFileInput) bankStatementFileInput.click();
        break;
      }
      case 'confirm-bank-statement-import':
        confirmBankStatementImport();
        break;
      case 'cancel-bank-statement-import':
        bankStatementImportSession = null;
        render();
        break;
      case 'confirm-bank-statement-match':
        confirmBankStatementMatch(trigger);
        break;
      case 'download-bank-statement':
        downloadBankStatement(trigger);
        break;
      case 'select-bank-statement-page':
        ui.pointage.statementPage = Math.max(0, Number(trigger.getAttribute('data-page')) || 0);
        render();
        break;
      case 'point-entry-line': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'pointage.mark', accountingAccessContext())) {
          toast('Action refusée par défaut : le droit « pointage.mark » n’est pas accordé.', 'warning');
          break;
        }
        var pointageActionLineKey = trigger.getAttribute('data-line-key') || '';
        var pointageResult = S.pointEntryLine(pointageActionLineKey, ui.pointage.statementDate);
        if (!pointageResult.ok) { toast(pointageResult.errors.join(' ') || 'Pointage impossible.', 'warning'); break; }
        toast('Ligne pointée · ' + pointageResult.pointageMark.code + '. Aucune écriture n’a été modifiée.', 'success');
        render();
        var pointedLineAction = $$('[data-action="unpoint-entry-line"]').find(function (item) { return item.getAttribute('data-line-key') === pointageActionLineKey; });
        if (pointedLineAction) pointedLineAction.focus();
        break;
      }
      case 'unpoint-entry-line': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'pointage.unmark', accountingAccessContext())) {
          toast('Action refusée par défaut : le droit « pointage.unmark » n’est pas accordé.', 'warning');
          break;
        }
        var pointageLineKey = trigger.getAttribute('data-line-key') || '';
        if (!window.confirm('Retirer le pointage de cette ligne ? Son historique restera conservé.')) break;
        var unpointResult = S.unpointEntryLine(pointageLineKey);
        if (!unpointResult.ok) { toast(unpointResult.errors.join(' ') || 'Retrait du pointage impossible.', 'warning'); break; }
        toast('Pointage retiré ; l’écriture reste inchangée.', 'success');
        render();
        var unpointedLineAction = $$('[data-action="point-entry-line"]').find(function (item) { return item.getAttribute('data-line-key') === pointageLineKey; });
        if (unpointedLineAction) unpointedLineAction.focus();
        break;
      }
      case 'select-account-movement-node': {
        ui.accountMovements.nodeId = trigger.getAttribute('data-node-id') || '';
        var movementNodeId = ui.accountMovements.nodeId;
        render();
        var movementNodeRow = $$('[data-action="select-account-movement-node"]').find(function (row) { return row.getAttribute('data-node-id') === movementNodeId; });
        if (movementNodeRow) movementNodeRow.focus();
        break;
      }
      case 'select-account-movement-month': {
        ui.accountMovements.month = trigger.getAttribute('data-month-key') || '';
        var movementMonthKey = ui.accountMovements.month;
        render();
        var movementMonthRow = $$('[data-action="select-account-movement-month"]').find(function (row) { return row.getAttribute('data-month-key') === movementMonthKey; });
        if (movementMonthRow) movementMonthRow.focus();
        break;
      }
      case 'select-third-party-movement-record': {
        ui.thirdPartyMovements.recordId = trigger.getAttribute('data-record-id') || '';
        var selectedThirdPartyId = ui.thirdPartyMovements.recordId;
        render();
        var selectedThirdPartyRow = $$('[data-action="select-third-party-movement-record"]').find(function (row) { return row.getAttribute('data-record-id') === selectedThirdPartyId; });
        if (selectedThirdPartyRow) selectedThirdPartyRow.focus();
        break;
      }
      case 'select-third-party-movement-month': {
        ui.thirdPartyMovements.month = trigger.getAttribute('data-month-key') || '';
        render();
        break;
      }
      case 'open-third-party-collective-month-detail':
        openThirdPartyCollectiveDetail('month');
        break;
      case 'open-third-party-collective-cycle-detail':
        openThirdPartyCollectiveDetail('cycle');
        break;
      case 'open-account-movement-month-detail':
        openAccountMovementDetail('month');
        break;
      case 'open-account-movement-cycle-detail':
        openAccountMovementDetail('cycle');
        break;
      case 'open-entry':
        if (id) openEntryModal(id);
        break;
      case 'select-entry-journal':
        if (id) selectEntryJournal(id);
        break;
      case 'open-entry-journal':
        if (selectedEntryJournalCode) openEntryForJournal(selectedEntryJournalCode);
        break;
      case 'open-entry-journal-consultation': {
        var selectedJournalForConsultation = S.journal(selectedEntryJournalCode);
        if (selectedJournalForConsultation) navigate('#/journal?journal=' + encodeURIComponent(selectedJournalForConsultation.code));
        break;
      }
      case 'open-entry-journal-close':
        navigate('#/periods');
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
      case 'new-journal':
        openJournalModal();
        break;
      case 'edit-journal':
        if (id) openJournalModal(id);
        break;
      case 'delete-journal': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'journals.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « journals.delete » n’est pas accordé.', 'warning');
          break;
        }
        var journalToDelete = S.journal(id);
        if (!journalToDelete) { toast('Journal introuvable dans le dossier actif.', 'error'); break; }
        if (!window.confirm('Supprimer le journal « ' + journalDisplayName(journalToDelete) + ' » ? Son code restera réservé et ne pourra pas être réattribué.')) break;
        var journalDeletion = S.deleteJournal(journalToDelete.id);
        if (!journalDeletion.ok) { toast(journalDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Journal supprimé. Son code ne sera pas réattribué.', 'success');
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
      case 'new-service':
        openServiceModal();
        break;
      case 'edit-service':
        if (id) openServiceModal(id);
        break;
      case 'archive-service': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'services.archive', accountingAccessContext())) {
          toast('Action refusée par défaut : le droit « services.archive » n’est pas accordé.', 'warning');
          break;
        }
        var serviceToArchive = S.service(id);
        if (!serviceToArchive) { toast('Prestation introuvable dans le dossier actif.', 'error'); break; }
        var reactivateService = serviceToArchive.active === false;
        var serviceConfirmation = reactivateService
          ? 'Réactiver la prestation « ' + serviceToArchive.name + ' » ?'
          : 'Archiver la prestation « ' + serviceToArchive.name + ' » ? Elle restera conservée dans le dossier.';
        if (!window.confirm(serviceConfirmation)) break;
        var serviceState = S.setServiceActive(id, reactivateService);
        if (!serviceState.ok) { toast(serviceState.errors[0] || 'Changement d’état impossible.', 'error'); break; }
        toast(reactivateService ? 'Prestation réactivée.' : 'Prestation archivée.', 'success');
        render();
        break;
      }
      case 'delete-service': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'services.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « services.delete » n’est pas accordé.', 'warning');
          break;
        }
        var serviceToDelete = S.service(id);
        if (!serviceToDelete) { toast('Prestation introuvable dans le dossier actif.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement la prestation « ' + serviceToDelete.name + ' » ? Son code restera réservé.')) break;
        var serviceDeletion = S.deleteService(id);
        if (!serviceDeletion.ok) { toast(serviceDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Prestation supprimée. Son code ne sera pas réattribué.', 'success');
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
      case 'new-analytical-center':
        openAnalyticalCenterModal();
        break;
      case 'edit-analytical-center':
        if (id) openAnalyticalCenterModal(id);
        break;
      case 'archive-analytical-center': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalCenters.archive', accountingAccessContext())) {
          toast('Archivage refusé par défaut : le droit « analyticalCenters.archive » n’est pas accordé.', 'warning');
          break;
        }
        var centerToArchive = S.analyticalCenter(id);
        if (!centerToArchive) { toast('Centre analytique introuvable.', 'error'); break; }
        var reactivateCenter = centerToArchive.active === false;
        var centerConfirmation = reactivateCenter
          ? 'Réactiver le centre analytique « ' + centerToArchive.name + ' » ?'
          : 'Archiver le centre analytique « ' + centerToArchive.name + ' » ? Il restera réservé au référentiel analytique.';
        if (!window.confirm(centerConfirmation)) break;
        var centerState = S.setAnalyticalCenterActive(id, reactivateCenter);
        if (!centerState.ok) { toast(centerState.errors.join(' ') || 'Changement d’état impossible.', 'error'); break; }
        toast(reactivateCenter ? 'Centre analytique réactivé.' : 'Centre analytique archivé.', 'success');
        render();
        break;
      }
      case 'delete-analytical-center': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'analyticalCenters.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « analyticalCenters.delete » n’est pas accordé.', 'warning');
          break;
        }
        var centerToDelete = S.analyticalCenter(id);
        if (!centerToDelete) { toast('Centre analytique introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement le centre analytique « ' + centerToDelete.name + ' » ? Aucun mouvement comptable général ne sera modifié.')) break;
        var centerDeletion = S.deleteAnalyticalCenter(id);
        if (!centerDeletion.ok) { toast(centerDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Centre analytique supprimé. Son code ne sera pas réattribué.', 'success');
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
      case 'preview-fixed-asset-depreciation':
        openFixedAssetDepreciationModal();
        break;
      case 'new-fixed-asset':
        openFixedAssetModal();
        break;
      case 'edit-fixed-asset':
        if (id) openFixedAssetModal(id);
        break;
      case 'delete-fixed-asset': {
        if (!hasDemoPermission(getActiveDemoMember(), 'accounting', 'fixedAssets.delete', accountingAccessContext())) {
          toast('Suppression refusée par défaut : le droit « fixedAssets.delete » n’est pas accordé.', 'warning');
          break;
        }
        var assetToDelete = S.fixedAsset(id);
        if (!assetToDelete) { toast('Élément immobilisé introuvable.', 'error'); break; }
        if (!window.confirm('Supprimer définitivement l’élément « ' + assetToDelete.name + ' » ? Cette action est refusée s’il existe un mouvement ou une écriture liée.')) break;
        var assetDeletion = S.deleteFixedAsset(id);
        if (!assetDeletion.ok) { toast(assetDeletion.errors.join(' ') || 'Suppression impossible.', 'warning'); break; }
        toast('Élément supprimé. Son code ne sera pas réattribué.', 'success');
        render();
        break;
      }
      case 'add-line': {
        var body = $('#lines-body');
        if (body) {
          body.insertAdjacentHTML('beforeend', lineRowHtml({ account: '', debit: '', credit: '' }, ($('#e-journal') || {}).value || ''));
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
      case 'commit-accounting-fec-import':
        commitAccountingFecImport();
        break;
      case 'download-fec-source':
        downloadFecSource(id);
        break;
      case 'cancel-fec-import-batch':
        cancelFecImportBatch(id);
        break;
      case 'open-fec-import-reversal':
        openFecImportReversal(id);
        break;
      case 'close-fec-import-reversal':
        fecImportReversalSession = null;
        render();
        break;
      case 'commit-fec-import-reversal':
        commitFecImportReversal();
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

  function openServiceModal(id) {
    var existing = id ? S.service(id) : null;
    if (id && !existing) { toast('Prestation introuvable dans le dossier actif.', 'error'); return; }
    var mode = existing ? 'edit' : 'create';
    var code = existing ? existing.code : S.nextServiceCode();
    var value = function (key) { return esc(existing && existing[key] != null ? existing[key] : (key === 'code' ? code : '')); };
    var body = '<form id="service-form" novalidate>' +
      '<div id="service-errors" aria-live="assertive"></div>' +
      '<div class="form-grid service-form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">' +
        '<div class="field"><label for="service-code">Code de la prestation <span aria-hidden="true">*</span></label>' +
          '<input id="service-code" name="code" type="text" maxlength="32" value="' + value('code') + '" placeholder="Ex. PRE-0001" required autocomplete="off"><span class="hint">Proposé automatiquement, modifiable ; un code attribué ne sera pas réutilisé.</span></div>' +
        '<div class="field"><label for="service-name">Désignation <span aria-hidden="true">*</span></label>' +
          '<input id="service-name" name="name" type="text" maxlength="150" value="' + value('name') + '" placeholder="Ex. Conseil en gestion" required></div>' +
        '<div class="field service-description-field"><label for="service-description">Description / périmètre</label>' +
          '<textarea id="service-description" name="description" rows="4" maxlength="1000" placeholder="Décrivez la prestation sans créer de tarif ou de règle fiscale">' + value('description') + '</textarea></div>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="service-form" data-action="save-service" data-service-mode="' + mode + '">' +
        (existing ? 'Enregistrer les modifications' : 'Créer la prestation') + '</button>';
    openModal(existing ? 'Modifier la prestation' : 'Nouvelle prestation',
      'Référentiel du dossier ' + esc(S.currentDossier().reference), body, footer, true);

    var form = $('#service-form');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var actionId = mode === 'edit' ? 'services.edit' : 'services.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', actionId, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + actionId + ' » n’est pas accordé.', 'warning');
        return;
      }
      var input = {
        code: $('#service-code').value,
        name: $('#service-name').value,
        description: $('#service-description').value
      };
      var result = existing ? S.updateService(existing.id, input) : S.createService(input);
      if (!result.ok) {
        $('#service-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Fiche prestation mise à jour.' : 'Prestation ' + result.service.code + ' créée.', 'success');
      closeModal(true);
      render();
    });
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

  function openJournalModal(code) {
    var existing = code ? S.journal(code) : null;
    if (code && !existing) { toast('Journal introuvable dans le dossier actif.', 'error'); return; }
    if (existing && existing.systemManaged) { toast('Ce journal est réservé au système.', 'warning'); return; }
    var mode = existing ? 'edit' : 'create';
    var lockedCode = !!(existing && (existing.isStandard || S.journalEntryCount(existing.id) > 0));
    var codeValue = existing ? existing.code : S.nextJournalCode();
    var prefixValue = existing ? (existing.referencePrefix || existing.code) : codeValue;
    var operationNature = existing && existing.operationNature || 'Opérations courantes';
    var authorizedAccounts = existing && existing.authorizedAccounts != null
      ? (existing.authorizedAccounts === '*' ? '*' : (Array.isArray(existing.authorizedAccounts) ? existing.authorizedAccounts.join(', ') : String(existing.authorizedAccounts)))
      : '*';
    var operationNatureOptions = S.journalOperationNatures().map(function (nature) {
      return '<option value="' + esc(nature) + '"' + (nature === operationNature ? ' selected' : '') + '>' + esc(nature) + '</option>';
    }).join('');
    var codeHint = existing && existing.isStandard
      ? 'Code standard conservé pour préserver les parcours existants.'
      : (lockedCode ? 'Code verrouillé car ce journal possède déjà des écritures.' : 'Code libre, unique dans le dossier (8 caractères maximum).');
    var body = '<form id="journal-form" novalidate>' +
      '<div id="journal-errors" aria-live="assertive"></div>' +
      '<div class="form-grid journal-form-grid">' +
        '<div class="field"><label for="j-code">Code du journal</label><input id="j-code" name="code" type="text" maxlength="8" pattern="[A-Za-z0-9_-]{1,8}" value="' + esc(codeValue) + '" required' + (lockedCode ? ' readonly' : '') + '><span class="hint">' + esc(codeHint) + '</span></div>' +
        '<div class="field"><label for="j-label">Libellé</label><input id="j-label" name="label" type="text" maxlength="80" placeholder="Ex. Journal des prestations" value="' + esc(existing ? existing.label : '') + '" required></div>' +
        '<div class="field"><label for="j-type">Type de journal</label><input id="j-type" name="type" type="text" list="journal-type-suggestions" maxlength="40" placeholder="Ex. Vente, Trésorerie, Divers" value="' + esc(existing ? existing.type : '') + '" required><datalist id="journal-type-suggestions"><option value="Achat"><option value="Vente"><option value="Trésorerie"><option value="Divers"><option value="Paie"><option value="Automatique"></datalist><span class="hint">Choisissez une suggestion ou saisissez votre propre type.</span></div>' +
        '<div class="field"><label for="j-operation-nature">Nature des opérations</label><select id="j-operation-nature" name="operationNature" required>' + operationNatureOptions + '</select></div>' +
        '<div class="field"><label for="j-authorized-accounts">Comptes autorisés</label><input id="j-authorized-accounts" name="authorizedAccounts" type="text" maxlength="1000" value="' + esc(authorizedAccounts) + '" placeholder="* ou 601100, 401100" required><span class="hint">Saisissez « * » pour tous les comptes, ou des numéros de compte de 2 à 8 chiffres (classes 1 à 8) séparés par des virgules.</span></div>' +
        '<div class="field"><label for="j-reference-prefix">Préfixe de référence</label><input id="j-reference-prefix" name="referencePrefix" type="text" maxlength="8" pattern="[A-Za-z0-9_-]{1,8}" value="' + esc(prefixValue) + '" required><span class="hint">Par défaut : « PRÉFIXE-ANNÉE-001 ». La période de numérotation se règle dans Paramètres → Configuration de la Comptabilité.</span></div>' +
        '<div class="field" style="grid-column:1 / -1"><label for="j-description">Description / utilisation</label><textarea id="j-description" name="description" rows="3" maxlength="240" placeholder="Précisez les opérations à enregistrer dans ce journal">' + esc(existing ? existing.description : '') + '</textarea></div>' +
        '<label class="journal-active-toggle"><input id="j-active" name="active" type="checkbox"' + (!existing || existing.active !== false ? ' checked' : '') + '> <span><strong>Journal actif</strong><small>Un journal inactif reste consultable, mais ne reçoit plus de nouvelles écritures.</small></span></label>' +
      '</div>' +
    '</form>';
    var footer = '<button type="button" class="btn btn-ghost" data-action="close-modal">Annuler</button>' +
      '<button type="submit" class="btn btn-primary" form="journal-form" data-action="save-journal" data-journal-mode="' + mode + '">' +
        (existing ? 'Enregistrer les paramètres' : 'Créer le journal') + '</button>';
    openModal(existing ? 'Paramètres du journal ' + esc(journalDisplayName(existing)) : 'Créer un journal',
      existing ? 'Les écritures historiques sont conservées.' : 'Le nouveau journal sera propre à ce dossier client.', body, footer, true);

    var form = $('#journal-form');
    var codeInput = $('#j-code');
    var prefixInput = $('#j-reference-prefix');
    var prefixFollowsCode = !existing || existing.referencePrefix === existing.code;
    if (prefixInput) prefixInput.addEventListener('input', function () { prefixFollowsCode = false; });
    if (codeInput) codeInput.addEventListener('input', function () {
      if (prefixFollowsCode && prefixInput) prefixInput.value = codeInput.value.trim().toLocaleUpperCase();
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var permissionAction = mode === 'edit' ? 'journals.edit' : 'journals.create';
      if (!hasDemoPermission(getActiveDemoMember(), 'accounting', permissionAction, accountingAccessContext())) {
        toast('Action refusée par défaut : le droit « ' + permissionAction + ' » n’est pas accordé.', 'warning');
        return;
      }
      var journalInput = {
        code: $('#j-code').value,
        label: $('#j-label').value,
        type: $('#j-type').value,
        operationNature: $('#j-operation-nature').value,
        authorizedAccounts: $('#j-authorized-accounts').value,
        referencePrefix: $('#j-reference-prefix').value,
        description: $('#j-description').value,
        active: $('#j-active').checked
      };
      var result = existing ? S.updateJournal(existing.id, journalInput) : S.createJournal(journalInput);
      if (!result.ok) {
        $('#journal-errors').innerHTML = '<div class="alert error" role="alert"><ul style="margin:0 0 0 18px">' +
          result.errors.map(function (error) { return '<li>' + esc(error) + '</li>'; }).join('') + '</ul></div>';
        return;
      }
      toast(existing ? 'Paramètres du journal ' + journalDisplayName(result.journal) + ' mis à jour.' : 'Journal ' + journalDisplayName(result.journal) + ' créé.', 'success');
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
