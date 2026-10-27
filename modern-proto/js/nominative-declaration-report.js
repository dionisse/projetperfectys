/* =========================================================================
   PERFECTO · État nominatif à joindre à la déclaration
   Structure de période/colonnes uniquement. Aucune donnée de retenue ou de
   fournisseur n’est inventée lorsqu’aucun lien source n’est disponible.
   ========================================================================= */
(function (root) {
  'use strict';

  var COLUMNS = [
    { key: 'supplier', label: 'Fournisseur' },
    { key: 'ifu', label: 'N°INSAE/IFU' },
    { key: 'withholding', label: 'Prélèvement effectué' }
  ];

  function build(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Choisissez un mois de référence valide.');
    // Les écritures courantes ne portent pas de lien fournisseur/IFU avec un
    // prélèvement AIB. Tant qu’une source structurée n’est pas raccordée,
    // seules des lignes explicitement fournies pourront être listées.
    var rows = Array.isArray(options.records)
      ? options.records.filter(function (record) { return record && record.period === period; }).map(function (record) {
        return {
          supplier: typeof record.supplier === 'string' ? record.supplier : '',
          ifu: typeof record.ifu === 'string' ? record.ifu : '',
          withholding: typeof record.withholding === 'number' && Number.isFinite(record.withholding) ? record.withholding : null
        };
      })
      : [];
    return {
      period: period,
      rows: rows,
      generatedLineCount: rows.length,
      sourceLinked: rows.length > 0
    };
  }

  root.PerfectoNominativeDeclarationReport = { COLUMNS: COLUMNS, build: build };
}(typeof window !== 'undefined' ? window : globalThis));
