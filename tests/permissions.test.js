'use strict';

const assert = require('assert');
global.PerfectoModules = require('../modern-proto/js/modules.js');
const Permissions = require('../modern-proto/js/permissions.js');
const context = { organizationId: 'org-1', scopeType: 'organization' };

function test(name, fn) {
  fn();
  console.log('  ✓ ' + name);
}

console.log('Politique d’accès (refus par défaut)');
test('sans profil ou sans grant, aucun accès n’est accordé', () => {
  assert.strictEqual(Permissions.hasPermission(null, 'accounting', 'module.view', context), false);
  const manager = { role: 'manager', organizationId: 'org-1' };
  const employee = { role: 'employee', organizationId: 'org-1' };
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'module.view', context), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', context), false);
});

test('la configuration des natures de comptes généraux exige un droit explicite par dossier', () => {
  const dossier = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'generalAccountNatures.configure', dossier), false);
  employee.grants.accounting[0].actions.push('generalAccountNatures.configure');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'generalAccountNatures.configure', dossier), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'generalAccountNatures.configure', {
    organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2'
  }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'generalAccountNatures.configure'));
});

test('les natures analytiques exigent un droit explicite dans le dossier concerné', () => {
  const dossier = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalNatures.configure', dossier), false);
  employee.grants.accounting[0].actions.push('analyticalNatures.configure');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalNatures.configure', dossier), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalNatures.configure', {
    organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2'
  }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'analyticalNatures.configure'));
});

test('les clés de répartition exigent un droit explicite dans le dossier concerné', () => {
  const dossier = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalAllocationKeys.configure', dossier), false);
  employee.grants.accounting[0].actions.push('analyticalAllocationKeys.configure');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalAllocationKeys.configure', dossier), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'analyticalAllocationKeys.configure', {
    organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2'
  }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'analyticalAllocationKeys.configure'));
});

test('la gestion des journaux est une série de droits distincts, explicitement délégués', () => {
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'organization' }, actions: ['module.view', 'journals.create'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'journals.create', context), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'journals.edit', context), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'journals.delete', context), false);
  assert.deepEqual(Permissions.actionsForModule('accounting').filter(action => action.id.startsWith('journals.')).map(action => action.id), [
    'journals.create', 'journals.edit', 'journals.delete'
  ]);
});

test('les reports à nouveau ont des droits distincts pour maintenance, transfert et impression', () => {
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'openingBalances.create', 'openingBalances.transfer'] }] }
  };
  const dossier = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.create', dossier), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.transfer', dossier), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.edit', dossier), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.delete', dossier), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.print', dossier), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'openingBalances.create', { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2' }), false);
  assert.deepEqual(Permissions.actionsForModule('accounting').filter(action => action.id.startsWith('openingBalances.')).map(action => action.id), [
    'openingBalances.create', 'openingBalances.edit', 'openingBalances.delete', 'openingBalances.transfer', 'openingBalances.print'
  ]);
});

test('la gestion d’organisation peut être déléguée explicitement dans le bon périmètre', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { organization: [{ scope: { type: 'organization' }, actions: ['module.view'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'module.view', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false, 'la consultation seule ne donne pas le droit de gérer');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageDossiers', context), false, 'gérer les membres ne donne pas le droit de créer des dossiers clients');
  manager.grants.organization[0].actions.push('organization.manageMembers');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), true);
  manager.grants.organization[0].actions.push('organization.manageDossiers');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageDossiers', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', { organizationId: 'org-2' }), false);
  manager.grants.organization[0].actions = ['organization.manageMembers'];
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false, 'l’action déléguée exige aussi module.view');
});

test('un grant explicite est limité aux actions et à sa propre organisation', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'organization' }, actions: ['module.view', 'draft.create'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'module.view', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'entry.validate', context), false);
  const legacyGrant = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: { scope: { type: 'organization' }, actions: ['module.view'] } }
  };
  assert.strictEqual(Permissions.hasPermission(legacyGrant, 'accounting', 'module.view', context), true, 'l’ancien format unitaire reste lisible');
  manager.grants.accounting[0].actions = ['draft.create'];
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', context), false, 'une action exige aussi module.view');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'module.view', { organizationId: 'org-2' }), false);
});

test('les grants sont additifs, sans transférer les actions entre portées', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [
      { scope: { type: 'organization' }, actions: ['module.view', 'accounts.create'] },
      { scope: { type: 'folder', folders: ['Agence Nord'] }, actions: ['module.view', 'draft.create'] },
      { scope: { type: 'folder', folders: ['Agence Sud'] }, actions: ['module.view'] }
    ] }
  };
  const north = { organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord' };
  const south = { organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Sud' };
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounts.create', north), true, 'un grant organisationnel couvre ses dossiers');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounts.create', south), true, 'les grants organisationnels sont applicables dans chaque dossier de l’organisation');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', north), true, 'le grant Nord ajoute ce droit');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', south), false, 'le droit Nord ne se transfère pas au grant Sud');
  manager.grants.accounting.push({ scope: { type: 'folder', folders: ['Agence Est'] }, actions: ['draft.delete'] });
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.delete', { organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Est' }), false, 'un droit métier reste refusé sans module.view dans le même grant');
});

test('les portées client utilisent les identifiants de dossiers, même si des noms se ressemblent', () => {
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'draft.create'] }] }
  };
  const first = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1', dossierName: 'Cabinet Godwin' };
  const second = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2', dossierName: 'Cabinet Godwin' };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', first), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', first), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', second), false, 'une portée identifiée ne s’étend pas à un autre dossier portant le même nom');
});

test('un grant limité à des dossiers refuse tout autre dossier ou périmètre', () => {
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: [
      { scope: { type: 'folder', folders: ['Agence Nord'] }, actions: ['module.view', 'draft.create'] },
      { scope: { type: 'folder', folders: ['Agence Sud'] }, actions: ['module.view'] }
    ] }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord'
  }), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord'
  }), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Sud'
  }), true, 'un grant indépendant peut autoriser un autre dossier');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Sud'
  }), false, 'un droit non accordé dans ce grant ne se propage pas à l’autre dossier');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', context), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'organization', folderName: 'Agence Nord'
  }), false, 'un périmètre organisation ne doit pas se substituer au contexte dossier');
  employee.grants.accounting[0].actions = ['draft.create'];
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord'
  }), false, 'une action exige aussi module.view dans le même grant');
  employee.grants.accounting[0].actions = ['module.view', 'draft.create'];
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'agence nord'
  }), true, 'l’action accordée s’applique à son dossier, sans sensibilité à la casse');
});

test('le Superviseur général gère son organisation, pas une autre', () => {
  const supervisor = { role: 'supervisor', organizationId: 'org-1' };
  assert.strictEqual(Permissions.hasPermission(supervisor, 'organization', 'organization.manageMembers', context), true);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'data.reset', context), true);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'data.restore', context), true);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'organization', 'organization.manageMembers', { organizationId: 'org-2' }), false);
});

test('les paramétrages comptables sont réservés au Superviseur général ou à une délégation explicite', () => {
  const supervisor = { role: 'supervisor', organizationId: 'org-1' };
  const manager = { role: 'manager', organizationId: 'org-1', grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] } };
  const dossier = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'accounting.configure', dossier), true);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'analyticalSections.configure', dossier), true);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'accounting.configure', { organizationId: 'org-2', scopeType: 'dossier', dossierId: 'dossier-1' }), false);
  assert.strictEqual(Permissions.hasPermission(supervisor, 'accounting', 'analyticalSections.configure', { organizationId: 'org-2', scopeType: 'dossier', dossierId: 'dossier-1' }), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounting.configure', dossier), false, 'la consultation seule ne permet pas de modifier');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'analyticalSections.configure', dossier), false, 'la configuration analytique exige aussi un droit explicite');
  manager.grants.accounting[0].actions.push('accounting.configure', 'analyticalSections.configure');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounting.configure', dossier), true, 'une délégation explicite dans le dossier autorise la modification');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'analyticalSections.configure', dossier), true, 'une délégation explicite autorise la configuration analytique');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounting.configure', { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2' }), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'analyticalSections.configure', { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-2' }), false);
});

test('les actions disponibles sont décrites par module', () => {
  const actions = Permissions.actionsForModule('accounting').map((action) => action.id);
  assert(actions.includes('module.view'));
  assert(actions.includes('accounting.configure'));
  assert(actions.includes('analyticalSections.configure'));
  assert(actions.includes('draft.create'));
  assert(actions.includes('entry.validate'));
  assert(actions.includes('centralization.cancel'));
  assert(actions.includes('draft.delete'));
  assert(actions.includes('accounts.create'));
  assert(actions.includes('accounts.edit'));
  assert(actions.includes('accounts.delete'));
  assert(actions.includes('suppliers.create'));
  assert(actions.includes('suppliers.delete'));
  assert(actions.includes('suppliers.edit'));
  assert(actions.includes('suppliers.archive'));
  assert(actions.includes('clients.create'));
  assert(actions.includes('clients.edit'));
  assert(actions.includes('clients.delete'));
  assert(actions.includes('services.create'));
  assert(actions.includes('services.edit'));
  assert(actions.includes('services.archive'));
  assert(actions.includes('services.delete'));
  assert(actions.includes('otherParties.create'));
  assert(actions.includes('otherParties.edit'));
  assert(actions.includes('otherParties.delete'));
  assert(actions.includes('personnel.create'));
  assert(actions.includes('personnel.edit'));
  assert(actions.includes('personnel.delete'));
  assert(actions.includes('analyticalCenters.create'));
  assert(actions.includes('analyticalCenters.edit'));
  assert(actions.includes('analyticalCenters.archive'));
  assert(actions.includes('analyticalCenters.delete'));
  assert(actions.includes('matching.assign'));
  assert(actions.includes('matching.cancel'));
  assert(actions.includes('pointage.mark'));
  assert(actions.includes('pointage.unmark'));
  assert(actions.includes('pointage.statement.import'));
  assert(actions.includes('pointage.statement.match'));
  assert(actions.includes('fixedAssets.create'));
  assert(actions.includes('fixedAssets.edit'));
  assert(actions.includes('fixedAssets.delete'));
  assert(actions.includes('period.close'));
  assert(actions.includes('period.reopen'));
  assert(actions.includes('data.import'));
  assert(actions.includes('data.reset'));
  assert(actions.includes('data.restore'));
  assert(actions.includes('data.export'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'module.view'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'organization.manageMembers'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'organization.manageDossiers'));
  assert(Permissions.actionsForModule('analytics').some((action) => action.id === 'module.view'));
  const payrollActions = Permissions.actionsForModule('payroll-hr').map((action) => action.id);
  assert(payrollActions.includes('module.view'));
  assert(payrollActions.includes('record.create'));
  assert(payrollActions.includes('record.validate'));
  const payrollManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { 'payroll-hr': [{ scope: { type: 'dossier', dossiers: ['client-1'] }, actions: ['module.view', 'record.create', 'record.validate'] }] }
  };
  const payrollContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'client-1' };
  assert.strictEqual(Permissions.hasPermission(payrollManager, 'payroll-hr', 'record.validate', payrollContext), true);
  assert.strictEqual(Permissions.hasPermission(payrollManager, 'payroll-hr', 'record.validate', { ...payrollContext, dossierId: 'client-2' }), false, 'un lot de paie reste limité au dossier accordé');
  const salesActions = Permissions.actionsForModule('sales-stock-invoicing').map((action) => action.id);
  assert(salesActions.includes('module.view'));
  assert(salesActions.includes('record.create'));
  assert(salesActions.includes('record.validate'));
  const salesManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { 'sales-stock-invoicing': [{ scope: { type: 'dossier', dossiers: ['client-1'] }, actions: ['module.view', 'record.create', 'record.validate'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(salesManager, 'sales-stock-invoicing', 'record.validate', payrollContext), true);
  assert.strictEqual(Permissions.hasPermission(salesManager, 'sales-stock-invoicing', 'record.validate', { ...payrollContext, dossierId: 'client-2' }), false, 'un lot commercial reste limité au dossier accordé');
  assert.deepStrictEqual(Permissions.actionsForModule('unknown-module'), [], 'un module inconnu est refusé');
  const unknownGrant = { role: 'manager', organizationId: 'org-1', grants: { 'unknown-module': [{ scope: { type: 'organization' }, actions: ['module.view'] }] } };
  assert.strictEqual(Permissions.hasPermission(unknownGrant, 'unknown-module', 'module.view', context), false);
  assert.strictEqual(Permissions.hasPermission({ role: 'supervisor', organizationId: 'org-1' }, 'accounting', 'unknown.action', context), false);
});

test('les actions sensibles restent indépendantes les unes des autres', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'organization' }, actions: ['module.view', 'draft.edit', 'accounts.create', 'period.close', 'data.import'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'accounts.create', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'period.close', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'period.reopen', context), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'data.import', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'data.reset', context), false);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'data.restore', context), false);
  const cancellationManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'centralization.cancel'] }] }
  };
  const cancellationContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(cancellationManager, 'accounting', 'centralization.cancel', cancellationContext), true);
  assert.strictEqual(Permissions.hasPermission(cancellationManager, 'accounting', 'entry.validate', cancellationContext), false, 'le droit d’annulation n’accorde pas implicitement la validation');
  assert.strictEqual(Permissions.hasPermission(cancellationManager, 'accounting', 'centralization.cancel', { ...cancellationContext, dossierId: 'dossier-2' }), false, 'le droit reste limité au dossier accordé');
});

test('les actions du référentiel fournisseurs sont explicites et limitées au dossier accordé', () => {
  const supplierManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'suppliers.create', 'suppliers.edit'] }] }
  };
  const supplierContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.create', supplierContext), true);
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.edit', supplierContext), true);
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.archive', supplierContext), false, 'archiver reste un droit distinct');
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.delete', supplierContext), false, 'supprimer reste un droit distinct');
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.create', { ...supplierContext, dossierId: 'dossier-2' }), false);
  supplierManager.grants.accounting[0].actions.push('suppliers.delete');
  assert.strictEqual(Permissions.hasPermission(supplierManager, 'accounting', 'suppliers.delete', supplierContext), true);
});

test('la modification et la suppression des comptes exigent chacune leur grant explicite', () => {
  const accountManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'accounts.edit'] }] }
  };
  const accountContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(accountManager, 'accounting', 'accounts.edit', accountContext), true);
  assert.strictEqual(Permissions.hasPermission(accountManager, 'accounting', 'accounts.delete', accountContext), false);
  accountManager.grants.accounting[0].actions.push('accounts.delete');
  assert.strictEqual(Permissions.hasPermission(accountManager, 'accounting', 'accounts.delete', accountContext), true);
  assert.strictEqual(Permissions.hasPermission(accountManager, 'accounting', 'accounts.delete', { ...accountContext, dossierId: 'dossier-2' }), false);
});

test('clients.create, clients.edit et clients.delete sont des droits distincts limités au dossier', () => {
  const clientManager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'clients.create', 'clients.edit'] }] }
  };
  const clientContext = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(clientManager, 'accounting', 'clients.create', clientContext), true);
  assert.strictEqual(Permissions.hasPermission(clientManager, 'accounting', 'clients.edit', clientContext), true);
  assert.strictEqual(Permissions.hasPermission(clientManager, 'accounting', 'clients.delete', clientContext), false);
  clientManager.grants.accounting[0].actions.push('clients.delete');
  assert.strictEqual(Permissions.hasPermission(clientManager, 'accounting', 'clients.delete', clientContext), true);
  assert.strictEqual(Permissions.hasPermission(clientManager, 'accounting', 'clients.delete', { ...clientContext, dossierId: 'dossier-2' }), false);
});

test('les droits du référentiel des prestations sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'services.create', 'services.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'services.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'services.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'services.archive', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'services.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'services.create', { ...context, dossierId: 'dossier-2' }), false);
});

test('les droits débiteurs/créditeurs divers sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'otherParties.create', 'otherParties.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'otherParties.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'otherParties.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'otherParties.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'otherParties.delete', { ...context, dossierId: 'dossier-2' }), false);
});

test('les droits Personnel sont indépendants et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'personnel.create', 'personnel.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'personnel.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'personnel.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'personnel.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'personnel.delete', { ...context, dossierId: 'dossier-2' }), false);
});

test('les droits des localisations d’immobilisations sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'fixedAssetLocations.create', 'fixedAssetLocations.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetLocations.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetLocations.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetLocations.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetLocations.delete', { ...context, dossierId: 'dossier-2' }), false);
});

test('les droits des immobilisations sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'fixedAssets.create', 'fixedAssets.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssets.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssets.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssets.delete', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssets.delete', { ...context, dossierId: 'dossier-2' }), false);
});

test('la configuration des comptes associés aux immobilisations exige un droit par dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetAccounts.configure', context), false);
  member.grants.accounting[0].actions.push('fixedAssetAccounts.configure');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetAccounts.configure', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'fixedAssetAccounts.configure', { ...context, dossierId: 'dossier-2' }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'fixedAssetAccounts.configure'));
});

test('la configuration des comptes de suivi des commandes exige un droit par dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderAccounts.configure', context), false);
  member.grants.accounting[0].actions.push('orderAccounts.configure');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderAccounts.configure', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderAccounts.configure', { ...context, dossierId: 'dossier-2' }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'orderAccounts.configure'));
});

test('la configuration des natures des commandes exige un droit par dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderNatures.configure', context), false);
  member.grants.accounting[0].actions.push('orderNatures.configure');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderNatures.configure', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'orderNatures.configure', { ...context, dossierId: 'dossier-2' }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'orderNatures.configure'));
});

test('la configuration des comptes lettrables, pointables, à payer et à recevoir exige un droit par dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'accountControls.configure', context), false);
  member.grants.accounting[0].actions.push('accountControls.configure');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'accountControls.configure', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'accountControls.configure', { ...context, dossierId: 'dossier-2' }), false);
  assert.ok(Permissions.actionsForModule('accounting').some(action => action.id === 'accountControls.configure'));
});

test('les droits des centres analytiques sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'analyticalCenters.create', 'analyticalCenters.edit'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.create', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.edit', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.archive', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.delete', context), false);
  member.grants.accounting[0].actions.push('analyticalCenters.archive', 'analyticalCenters.delete');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.archive', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.delete', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.create', { ...context, dossierId: 'dossier-2' }), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'analyticalCenters.delete', { ...context, dossierId: 'dossier-2' }), false);
});

test('les droits de lettrage et de pointage sont distincts et limités au dossier', () => {
  const member = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: [{ scope: { type: 'dossier', dossiers: ['dossier-1'] }, actions: ['module.view', 'matching.assign', 'pointage.mark'] }] }
  };
  const context = { organizationId: 'org-1', scopeType: 'dossier', dossierId: 'dossier-1' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'matching.assign', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.mark', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'matching.cancel', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.unmark', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.import', context), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.match', context), false);
  member.grants.accounting[0].actions.push('matching.cancel', 'pointage.unmark', 'pointage.statement.import', 'pointage.statement.match');
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'matching.cancel', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.unmark', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.import', context), true);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.match', context), true);
  const otherDossier = { ...context, dossierId: 'dossier-2' };
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'matching.assign', otherDossier), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.mark', otherDossier), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.import', otherDossier), false);
  assert.strictEqual(Permissions.hasPermission(member, 'accounting', 'pointage.statement.match', otherDossier), false);
});

console.log('Politique d’accès : scénarios réussis.');
