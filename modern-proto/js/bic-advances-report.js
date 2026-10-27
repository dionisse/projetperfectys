/* =========================================================================
   PERFECTO · Acomptes BIC sur ventes détaillés par client
   Période et colonnes du formulaire. Aucun acompte/client n’est déduit sans
   enregistrement nominatif explicitement relié aux données source.
   ========================================================================= */
(function (root) {
  'use strict';

  var COLUMNS = [
    { key: 'client', label: 'Client' },
    { key: 'advance', label: 'Acompte collecté' },
    { key: 'ifu', label: 'N°INSAE/IFU' }
  ];

  function build(options) {
    options = options || {};
    var period = String(options.period || '');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Choisissez un mois de référence valide.');
    var rows = Array.isArray(options.records)
      ? options.records.filter(function (record) { return record && record.period === period; }).map(function (record) {
        return {
          client: typeof record.client === 'string' ? record.client : '',
          advance: typeof record.advance === 'number' && Number.isFinite(record.advance) ? record.advance : null,
          ifu: typeof record.ifu === 'string' ? record.ifu : ''
        };
      })
      : [];
    return { period: period, rows: rows, generatedLineCount: rows.length, sourceLinked: rows.length > 0 };
  }

  root.PerfectoBicAdvancesReport = { COLUMNS: COLUMNS, build: build };
}(typeof window !== 'undefined' ? window : globalThis));
