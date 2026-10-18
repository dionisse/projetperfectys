/*
 * PERFECTO · Catalogue central des modules
 * Ce registre décrit le launcher sans dépendre des règles métier de chaque module.
 * Ajouter un module ici ne le rend pas automatiquement accessible : son statut,
 * sa route et ses droits devront être validés avant son activation réelle.
 */
(function (root) {
  'use strict';

  var modules = [
    {
      id: 'accounting',
      name: 'Comptabilité générale',
      category: 'COMPTABILITÉ · SYSCOHADA',
      description: 'Journaux, pièces comptables, balance, journal des écritures et grand livre.',
      icon: '▤',
      accent: 'accounting',
      status: 'available',
      statusLabel: 'DISPONIBLE',
      version: 'Lot 1 · Prototype',
      route: 'dossiers'
    },
    {
      id: 'analytics',
      name: 'Comptabilité analytique',
      category: 'PILOTAGE',
      description: 'Suivi des coûts, axes analytiques et analyse de la performance.',
      icon: '∑',
      accent: 'analytics',
      status: 'planned',
      statusLabel: 'À VENIR',
      version: 'En préparation',
      route: null
    },
    {
      id: 'payroll-hr',
      name: 'Paie & RH',
      category: 'RESSOURCES HUMAINES',
      description: 'Gestion du personnel, suivi RH et préparation de la paie.',
      icon: '◷',
      accent: 'hr',
      status: 'planned',
      statusLabel: 'À VENIR',
      version: 'En préparation',
      route: null
    },
    {
      id: 'correspondence',
      name: 'Gestion des courriers',
      category: 'GESTION DOCUMENTAIRE',
      description: 'Enregistrement, suivi et classement des courriers de l’organisation.',
      icon: '✉',
      accent: 'mail',
      status: 'planned',
      statusLabel: 'À VENIR',
      version: 'En préparation',
      route: null
    },
    {
      id: 'sales-stock-invoicing',
      name: 'Ventes, stock & facturation',
      category: 'ACTIVITÉ COMMERCIALE',
      description: 'Ventes, gestion des stocks et suivi de la facturation.',
      icon: '◫',
      accent: 'sales',
      status: 'planned',
      statusLabel: 'À VENIR',
      version: 'En préparation',
      route: null
    }
  ].map(function (module) { return Object.freeze(module); });

  Object.freeze(modules);

  function all() {
    return modules.slice();
  }

  function get(id) {
    return modules.find(function (module) { return module.id === id; }) || null;
  }

  function stats() {
    var available = modules.filter(function (module) { return module.status === 'available'; }).length;
    return {
      total: modules.length,
      available: available,
      planned: modules.length - available
    };
  }

  var api = Object.freeze({ all: all, get: get, stats: stats });
  root.PerfectoModules = api;

  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
