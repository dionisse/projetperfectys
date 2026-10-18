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

test('la gestion d’organisation peut être déléguée explicitement dans le bon périmètre', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { organization: [{ scope: { type: 'organization' }, actions: ['module.view'] }] }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'module.view', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false, 'la consultation seule ne donne pas le droit de gérer');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageFolders', context), false, 'gérer les membres ne donne pas le droit de créer des dossiers');
  manager.grants.organization[0].actions.push('organization.manageMembers');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), true);
  manager.grants.organization[0].actions.push('organization.manageFolders');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageFolders', context), true);
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

test('les actions disponibles sont décrites par module', () => {
  const actions = Permissions.actionsForModule('accounting').map((action) => action.id);
  assert(actions.includes('module.view'));
  assert(actions.includes('draft.create'));
  assert(actions.includes('entry.validate'));
  assert(actions.includes('draft.delete'));
  assert(actions.includes('accounts.create'));
  assert(actions.includes('period.close'));
  assert(actions.includes('period.reopen'));
  assert(actions.includes('data.import'));
  assert(actions.includes('data.reset'));
  assert(actions.includes('data.restore'));
  assert(actions.includes('data.export'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'module.view'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'organization.manageMembers'));
  assert(Permissions.actionsForModule('organization').some((action) => action.id === 'organization.manageFolders'));
  assert(Permissions.actionsForModule('analytics').some((action) => action.id === 'module.view'));
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
});

console.log('Politique d’accès : 8 scénarios réussis.');
