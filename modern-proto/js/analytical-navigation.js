/* Navigation autonome du module Suivi Analytique.
   Les données restent liées au dossier comptable, mais ce menu n’emprunte pas les groupes de Comptabilité générale. */
(function (root) {
  'use strict';

  var groups = [
    {
      id: 'home', label: 'Accueil', icon: '▥', defaultItem: 'overview', items: [
        { id: 'overview', label: 'Tableau de bord analytique', view: 'overview', status: 'active' }
      ]
    },
    {
      id: 'imputations', label: 'Imputations', icon: '∑', defaultItem: 'movements', items: [
        { id: 'movements', label: 'Mouvements analytiques', view: 'movements', status: 'active', description: 'Consultation des ventilations explicites portées par les écritures validées.' },
        { id: 'source-entry', label: 'Pièce comptable source', view: 'source-entry', status: 'active', contextOnly: true, description: 'Consultation en lecture seule de la pièce et de ses imputations analytiques enregistrées.' },
        { id: 'consistency', label: 'Contrôle de cohérence', view: 'consistency', reportId: 'analytic-consistency-control', status: 'active', description: 'Contrôle en lecture seule des axes, règles, reliquats et imputations.' },
        { id: 'entry', label: 'Saisie d’une pièce comptable', route: 'entry', status: 'active', description: 'La pièce générale et ses imputations analytiques restent saisies ensemble dans la Comptabilité générale.' }
      ]
    },
    {
      id: 'references', label: 'Référentiels analytiques', icon: '▧', defaultItem: 'centers', items: [
        { id: 'centers', label: 'Centres analytiques', view: 'centers', status: 'active' },
        { id: 'natures', label: 'Natures et axes', view: 'natures', status: 'active' },
        { id: 'values', label: 'Valeurs analytiques', view: 'values', status: 'active' },
        { id: 'account-rules', label: 'Règles analytiques par compte', view: 'account-rules', status: 'active' },
        { id: 'allocation-keys', label: 'Clés de répartition', view: 'allocation-keys', status: 'active' },
        { id: 'sections-accounts', label: 'Sections et comptes analytiques', view: 'sections-accounts', status: 'active' }
      ]
    },
    {
      id: 'reports', label: 'États analytiques', icon: '▤', defaultItem: 'analytic-center-balance', items: [
        { id: 'analytic-center-balance', label: 'Balance des centres', view: 'report', status: 'active', description: 'Ventilations explicites validées ; reliquats conservés « À ventiler ».' },
        { id: 'analytic-other-nature-balance', label: 'Balance par une autre nature', view: 'report', status: 'active', description: 'Nature choisie explicitement ; détail par valeur et compte général.' },
        { id: 'analytic-ledger', label: 'Grand livre analytique', view: 'report', status: 'active', description: 'Détail chronologique des ventilations de centres enregistrées.' },
        { id: 'analytic-other-nature-ledger', label: 'Grand livre par une autre nature', view: 'report', status: 'active', description: 'Détail chronologique après choix d’une autre nature.' },
        { id: 'analytic-center-situation', label: 'Situation des centres', view: 'report', status: 'active', description: 'Mouvements du cycle jusqu’à la date choisie, sans report analytique supposé.' },
        { id: 'analytic-other-nature-situation', label: 'Situation par une autre nature', view: 'report', status: 'active', description: 'Mouvements cumulés selon une autre nature choisie explicitement.' },
        { id: 'analytic-general-account-balance', label: 'Balance par comptes généraux', view: 'report', status: 'active', description: 'Balance regroupée par compte général et nature analytique choisie.' }
      ]
    }
  ];

  groups.forEach(function (group) {
    group.items.forEach(function (item) { Object.freeze(item); });
    Object.freeze(group.items);
    Object.freeze(group);
  });
  Object.freeze(groups);

  function getGroup(id) {
    return groups.find(function (group) { return group.id === String(id || ''); }) || groups[0];
  }

  function getItem(groupId, itemId) {
    var group = getGroup(groupId);
    return group.items.find(function (item) { return item.id === String(itemId || ''); }) ||
      group.items.find(function (item) { return item.id === group.defaultItem; }) || group.items[0];
  }

  function all() { return groups.slice(); }

  var api = Object.freeze({ all: all, getGroup: getGroup, getItem: getItem });
  root.PerfectoAnalyticalNavigation = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
