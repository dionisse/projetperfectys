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
    grants: { organization: { scope: { type: 'organization' }, actions: ['module.view'] } }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'module.view', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false, 'la consultation seule ne donne pas le droit de gérer');
  manager.grants.organization.actions.push('organization.manageMembers');
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', { organizationId: 'org-2' }), false);
  manager.grants.organization.actions = ['organization.manageMembers'];
  assert.strictEqual(Permissions.hasPermission(manager, 'organization', 'organization.manageMembers', context), false, 'l’action déléguée exige aussi module.view');
});

test('un grant explicite est limité aux actions et à sa propre organisation', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: { scope: { type: 'organization' }, actions: ['module.view', 'draft.create'] } }
  };
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'module.view', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', context), true);
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'entry.validate', context), false);
  manager.grants.accounting.actions = ['draft.create'];
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'draft.create', context), false, 'une action exige aussi module.view');
  assert.strictEqual(Permissions.hasPermission(manager, 'accounting', 'module.view', { organizationId: 'org-2' }), false);
});

test('un grant limité à des dossiers refuse tout autre dossier ou périmètre', () => {
  const employee = {
    role: 'employee', organizationId: 'org-1',
    grants: { accounting: { scope: { type: 'folder', folders: ['Comptabilité 2026', 'Agence Nord'] }, actions: ['module.view'] } }
  };
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord'
  }), true);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Sud'
  }), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', context), false);
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'module.view', {
    organizationId: 'org-1', scopeType: 'organization', folderName: 'Agence Nord'
  }), false, 'un périmètre organisation ne doit pas se substituer au contexte dossier');
  employee.grants.accounting.actions = ['draft.create'];
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Nord'
  }), false, 'une action exige aussi module.view');
  employee.grants.accounting.actions = ['module.view', 'draft.create'];
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'agence nord'
  }), true, 'l’action accordée s’applique à son dossier, sans sensibilité à la casse');
  assert.strictEqual(Permissions.hasPermission(employee, 'accounting', 'draft.create', {
    organizationId: 'org-1', scopeType: 'folder', folderName: 'Agence Sud'
  }), false, 'l’action ne s’étend pas aux autres dossiers');
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
  assert(Permissions.actionsForModule('analytics').some((action) => action.id === 'module.view'));
  assert.deepStrictEqual(Permissions.actionsForModule('unknown-module'), [], 'un module inconnu est refusé');
  const unknownGrant = { role: 'manager', organizationId: 'org-1', grants: { 'unknown-module': { scope: { type: 'organization' }, actions: ['module.view'] } } };
  assert.strictEqual(Permissions.hasPermission(unknownGrant, 'unknown-module', 'module.view', context), false);
  assert.strictEqual(Permissions.hasPermission({ role: 'supervisor', organizationId: 'org-1' }, 'accounting', 'unknown.action', context), false);
});

test('les actions sensibles restent indépendantes les unes des autres', () => {
  const manager = {
    role: 'manager', organizationId: 'org-1',
    grants: { accounting: { scope: { type: 'organization' }, actions: ['module.view', 'draft.edit', 'accounts.create', 'period.close', 'data.import'] } }
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

console.log('Politique d’accès : 7 scénarios réussis.');
