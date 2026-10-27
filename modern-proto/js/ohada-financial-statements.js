/* =========================================================================
   PERFECTO · Sélecteur des tableaux financiers et de la liasse fiscale
   Nomenclature reprise de la capture; aucune ligne financière ou fiscale
   n’est calculée ici sans format et correspondances validés.
   ========================================================================= */
(function (root) {
  'use strict';

  var DEFAULT_SELECTED_KEY = 'all-items-by-account';

  var ITEMS = [
    { key: 'financial-statements', label: 'Tableaux financiers OHADA révisé' },
    { key: 'is-declaration', label: 'Déclaration fiscale (IS)' },
    { key: 'irpp-declaration', label: 'Déclaration IRPP' },
    { key: 'fees-declaration', label: 'Déclaration des honoraires' },
    { key: 'separator-1', separator: true },
    { key: 'all-items-by-account', label: 'Ensemble des postes détaillés par comptes' },
    { key: 'separator-2', separator: true },
    { key: 'expenses-by-account', label: 'Charges détaillées par comptes' },
    { key: 'products-by-account', label: 'Produits détaillés par comptes' },
    { key: 'assets-by-account', label: 'Actif détaillé par comptes' },
    { key: 'liabilities-by-account', label: 'Passif détaillé par comptes' },
    { key: 'separator-3', separator: true },
    { key: 'tax-adjustments', label: 'Déductions et réintégrations fiscales' }
  ];

  function item(key) {
    return ITEMS.find(function (candidate) { return candidate.key === key && !candidate.separator; }) || null;
  }

  function buildPreview(key, exercise) {
    var selected = item(key);
    if (!selected) throw new Error('Sélectionnez un état dans la liste.');
    return {
      key: selected.key,
      label: selected.label,
      exercise: Number(exercise) || null,
      generatedLineCount: 0,
      financialRows: []
    };
  }

  root.PerfectoOhadaFinancialStatements = {
    ITEMS: ITEMS,
    DEFAULT_SELECTED_KEY: DEFAULT_SELECTED_KEY,
    item: item,
    buildPreview: buildPreview
  };
}(typeof window !== 'undefined' ? window : globalThis));
