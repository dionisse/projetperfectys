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
    { id: 'accounting.configure', label: 'Modifier la configuration comptable du dossier' },
    { id: 'currencies.configure', label: 'Configurer les devises du dossier' },
    { id: 'analyticalSections.configure', label: 'Configurer les sections et comptes analytiques' },
    { id: 'analyticalAllocationKeys.configure', label: 'Configurer les clés de répartition analytiques' },
    { id: 'analyticalNatures.configure', label: 'Configurer les natures analytiques' },
    { id: 'analyticalAccountRules.configure', label: 'Configurer les règles analytiques par compte' },
    { id: 'generalAccountNatures.configure', label: 'Configurer les natures des comptes généraux' },
    { id: 'draft.create', label: 'Créer une écriture / un brouillon' },
    { id: 'draft.edit', label: 'Modifier un brouillon' },
    { id: 'draft.delete', label: 'Supprimer un brouillon' },
    { id: 'entryAttachments.manage', label: 'Gérer les justificatifs des pièces comptables' },
    { id: 'entry.validate', label: 'Valider une écriture' },
    { id: 'centralization.cancel', label: 'Annuler une centralisation interne' },
    { id: 'accounts.create', label: 'Créer un compte comptable' },
    { id: 'accounts.edit', label: 'Modifier un compte comptable' },
    { id: 'accounts.delete', label: 'Supprimer un compte comptable inutilisé' },
    { id: 'journals.create', label: 'Créer un journal comptable' },
    { id: 'journals.edit', label: 'Modifier un journal comptable' },
    { id: 'journals.delete', label: 'Supprimer un journal inutilisé' },
    { id: 'suppliers.create', label: 'Créer un fournisseur' },
    { id: 'suppliers.edit', label: 'Modifier un fournisseur' },
    { id: 'suppliers.archive', label: 'Archiver ou réactiver un fournisseur' },
    { id: 'suppliers.delete', label: 'Supprimer un fournisseur' },
    { id: 'clients.create', label: 'Créer un client' },
    { id: 'clients.edit', label: 'Modifier un client' },
    { id: 'clients.delete', label: 'Supprimer un client' },
    { id: 'services.create', label: 'Créer une prestation' },
    { id: 'services.edit', label: 'Modifier une prestation' },
    { id: 'services.archive', label: 'Archiver ou réactiver une prestation' },
    { id: 'services.delete', label: 'Supprimer une prestation inutilisée' },
    { id: 'otherParties.create', label: 'Créer un débiteur ou créditeur divers' },
    { id: 'otherParties.edit', label: 'Modifier un débiteur ou créditeur divers' },
    { id: 'otherParties.delete', label: 'Supprimer un débiteur ou créditeur divers' },
    { id: 'personnel.create', label: 'Créer une fiche de personnel' },
    { id: 'personnel.edit', label: 'Modifier une fiche de personnel' },
    { id: 'personnel.delete', label: 'Supprimer une fiche de personnel' },
    { id: 'fixedAssetLocations.create', label: 'Créer une localisation d’immobilisation' },
    { id: 'fixedAssetLocations.edit', label: 'Modifier une localisation d’immobilisation' },
    { id: 'fixedAssetLocations.delete', label: 'Supprimer une localisation d’immobilisation' },
    { id: 'analyticalCenters.create', label: 'Créer un centre analytique' },
    { id: 'analyticalCenters.edit', label: 'Modifier un centre analytique' },
    { id: 'analyticalCenters.archive', label: 'Archiver ou réactiver un centre analytique' },
    { id: 'analyticalCenters.delete', label: 'Supprimer un centre analytique inutilisé' },
    { id: 'matching.assign', label: 'Créer un lettrage' },
    { id: 'matching.cancel', label: 'Annuler un lettrage' },
    { id: 'pointage.mark', label: 'Pointer manuellement une ligne de trésorerie' },
    { id: 'pointage.unmark', label: 'Retirer un pointage' },
    { id: 'pointage.statement.import', label: 'Importer un relevé bancaire' },
    { id: 'pointage.statement.match', label: 'Confirmer un rapprochement depuis un relevé' },
    { id: 'openingBalances.create', label: 'Insérer un report à nouveau' },
    { id: 'openingBalances.edit', label: 'Modifier un report à nouveau' },
    { id: 'openingBalances.delete', label: 'Supprimer un report à nouveau' },
    { id: 'openingBalances.transfer', label: 'Transférer les reports de l’exercice précédent' },
    { id: 'openingBalances.print', label: 'Imprimer les reports à nouveau' },
    { id: 'taxAdjustments.create', label: 'Saisir un ajustement fiscal à examiner' },
    { id: 'taxAdjustments.edit', label: 'Modifier un ajustement fiscal à examiner' },
    { id: 'taxAdjustments.delete', label: 'Supprimer un ajustement fiscal à examiner' },
    { id: 'agedBalance.items.create', label: 'Créer une pièce ouverte pour la balance âgée' },
    { id: 'agedBalance.items.edit', label: 'Modifier une pièce ouverte de balance âgée' },
    { id: 'agedBalance.items.delete', label: 'Supprimer une pièce ouverte de balance âgée' },
    { id: 'agedBalance.settlements.create', label: 'Saisir un règlement ou une avance de balance âgée' },
    { id: 'agedBalance.settlements.edit', label: 'Modifier un règlement ou une avance de balance âgée' },
    { id: 'agedBalance.settlements.delete', label: 'Supprimer un règlement ou une avance de balance âgée' },
    { id: 'agedBalance.print', label: 'Imprimer la balance âgée' },
    { id: 'agedBalance.export', label: 'Exporter la balance âgée' },
    { id: 'fixedAssets.create', label: 'Créer un élément immobilisé' },
    { id: 'fixedAssets.edit', label: 'Modifier un élément immobilisé' },
    { id: 'fixedAssets.delete', label: 'Supprimer un élément immobilisé' },
    { id: 'fixedAssetAccounts.configure', label: 'Configurer les comptes associés aux immobilisations' },
    { id: 'orderAccounts.configure', label: 'Configurer les comptes de suivi des commandes et marchés accordés' },
    { id: 'orderNatures.configure', label: 'Configurer les natures des commandes' },
    { id: 'accountControls.configure', label: 'Configurer les comptes lettrables, pointables, à payer et à recevoir' },
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
