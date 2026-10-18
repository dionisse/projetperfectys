/*
 * PERFECTO · Évaluation des droits (prototype)
 * Refuse par défaut. Les règles sont exécutées côté client uniquement en démo ;
 * une vraie sécurité devra aussi être appliquée par l'identité et le stockage.
 */
(function (root) {
  'use strict';

  // Vocabulaire initial de démonstration, à valider avec le métier.
  var ACCOUNTING_ACTIONS = [
    { id: 'module.view', label: 'Consulter le module' },
    { id: 'draft.create', label: 'Créer une écriture / un brouillon' },
    { id: 'draft.edit', label: 'Modifier ou supprimer un brouillon' },
    { id: 'entry.validate', label: 'Valider une écriture' },
    { id: 'accounts.manage', label: 'Gérer le plan comptable' },
    { id: 'periods.manage', label: 'Clôturer ou rouvrir les périodes' },
    { id: 'data.manage', label: 'Importer ou réinitialiser les données' },
    { id: 'data.export', label: 'Exporter les données et les états' }
  ];

  var GENERIC_ACTIONS = [
    { id: 'module.view', label: 'Consulter le module' },
    { id: 'record.create', label: 'Créer / saisir' },
    { id: 'record.edit', label: 'Modifier' },
    { id: 'record.validate', label: 'Valider / approuver' },
    { id: 'module.manage', label: 'Gérer le module' }
  ];

  var ORGANIZATION_ACTIONS = [
    { id: 'module.view', label: 'Consulter l’organisation' },
    { id: 'organization.manageMembers', label: 'Gérer les membres et les accès' }
  ];

  function actionsForModule(moduleId) {
    if (moduleId === 'accounting') return ACCOUNTING_ACTIONS.slice();
    if (moduleId === 'organization') return ORGANIZATION_ACTIONS.slice();
    var registry = root.PerfectoModules;
    var registered = registry && typeof registry.get === 'function' && registry.get(moduleId);
    return registered ? GENERIC_ACTIONS.slice() : [];
  }

  function normalize(value) {
    return String(value == null ? '' : value).trim().toLocaleLowerCase();
  }

  function sameOrganization(member, context) {
    return !!(member && context && member.organizationId && context.organizationId &&
      String(member.organizationId) === String(context.organizationId));
  }

  function hasPermission(member, moduleId, actionId, context) {
    if (!member || !moduleId || !actionId || !sameOrganization(member, context)) return false;
    var known = actionsForModule(moduleId).some(function (action) { return action.id === actionId; });
    if (!known) return false;

    // Le Superviseur général agit au niveau de sa propre organisation uniquement.
    if (member.role === 'supervisor') return true;

    var grant = member.grants && member.grants[moduleId];
    if (!grant || !Array.isArray(grant.actions) || grant.actions.indexOf(actionId) === -1) return false;

    // Toute action métier exige aussi l’accès explicite à la consultation du module.
    if (actionId !== 'module.view' && grant.actions.indexOf('module.view') === -1) return false;

    var scope = grant.scope || {};
    if (scope.type === 'organization') return true;
    if (scope.type !== 'folder' || context.scopeType !== 'folder' || !Array.isArray(scope.folders) || !context.folderName) return false;

    var folder = normalize(context.folderName);
    return !!folder && scope.folders.some(function (name) { return normalize(name) === folder; });
  }

  var api = Object.freeze({
    actionsForModule: actionsForModule,
    hasPermission: hasPermission
  });

  root.PerfectoPermissions = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
