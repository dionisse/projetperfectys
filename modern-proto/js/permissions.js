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
    { id: 'draft.edit', label: 'Modifier un brouillon' },
    { id: 'draft.delete', label: 'Supprimer un brouillon' },
    { id: 'entry.validate', label: 'Valider une écriture' },
    { id: 'centralization.cancel', label: 'Annuler une centralisation interne' },
    { id: 'accounts.create', label: 'Créer un compte comptable' },
    { id: 'period.close', label: 'Clôturer une période' },
    { id: 'period.reopen', label: 'Rouvrir une période' },
    { id: 'data.import', label: 'Importer des données' },
    { id: 'data.reset', label: 'Réinitialiser les données de démo' },
    { id: 'data.restore', label: 'Restaurer un point local' },
    { id: 'data.export', label: 'Exporter les données et les états' }
  ];

  var GENERIC_ACTIONS = [
    { id: 'module.view', label: 'Consulter le module' },
    { id: 'record.create', label: 'Créer / saisir' },
    { id: 'record.edit', label: 'Modifier' },
    { id: 'record.delete', label: 'Supprimer' },
    { id: 'record.validate', label: 'Valider / approuver' },
    { id: 'module.manage', label: 'Gérer le module' }
  ];

  var ORGANIZATION_ACTIONS = [
    { id: 'module.view', label: 'Consulter l’organisation' },
    { id: 'organization.manageMembers', label: 'Gérer les membres et les accès' },
    { id: 'organization.manageDossiers', label: 'Créer des dossiers clients' }
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

  function grantsForModule(member, moduleId) {
    var grants = member && member.grants && member.grants[moduleId];
    if (Array.isArray(grants)) return grants;
    // Compatibilité de démonstration avec la première forme : un grant par module.
    return grants && typeof grants === 'object' ? [grants] : [];
  }

  function scopeAllows(scope, context) {
    if (!scope || !context) return false;
    if (scope.type === 'organization') return true;
    var isDossierScope = scope.type === 'dossier' || scope.type === 'folder';
    var isDossierContext = context.scopeType === 'dossier' || context.scopeType === 'folder';
    if (!isDossierScope || !isDossierContext) return false;
    if (Array.isArray(scope.dossiers) && context.dossierId) {
      return scope.dossiers.some(function (id) { return String(id) === String(context.dossierId); });
    }
    // Compatibilité avec les grants antérieurs enregistrés par nom de dossier.
    var names = Array.isArray(scope.folders) ? scope.folders : scope.dossiers;
    var contextName = context.dossierName || context.folderName;
    if (!Array.isArray(names) || !contextName) return false;
    var dossierName = normalize(contextName);
    return !!dossierName && names.some(function (name) { return normalize(name) === dossierName; });
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

    // Les grants se cumulent : une action n'est accordée que par un grant
    // explicite qui couvre à la fois le module, l'action et le même périmètre.
    return grantsForModule(member, moduleId).some(function (grant) {
      if (!grant || !Array.isArray(grant.actions) || grant.actions.indexOf(actionId) === -1) return false;
      // Toute action métier exige aussi la consultation dans ce grant/périmètre.
      if (actionId !== 'module.view' && grant.actions.indexOf('module.view') === -1) return false;
      return scopeAllows(grant.scope, context);
    });
  }

  var api = Object.freeze({
    actionsForModule: actionsForModule,
    hasPermission: hasPermission
  });

  root.PerfectoPermissions = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
