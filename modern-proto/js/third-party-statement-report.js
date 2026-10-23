/*
 * PERFECTO · Relevé de compte des tiers.
 * Présentation des mouvements auxiliaires de la période, sans report
 * d’ouverture ni solde calculé : seules les colonnes de la capture sont émises.
 */
(function (root, factory) {
  'use strict';
  var ledgerReport = root.PerfectoThirdPartyLedgerReport;
  if (!ledgerReport && typeof module !== 'undefined' && module.exports) {
    ledgerReport = require('./third-party-ledger-report.js');
  }
  var api = factory(ledgerReport);
  root.PerfectoThirdPartyStatementReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ThirdPartyLedgerReport) {
  'use strict';

  var NATURES = ThirdPartyLedgerReport ? ThirdPartyLedgerReport.NATURES : [];
  var COLUMN_DEFINITIONS = [
    { key: 'date', label: 'Date', defaultSelected: true, text: true },
    { key: 'reference', label: 'Référence', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', defaultSelected: true, text: false },
    { key: 'label', label: 'Libellé', defaultSelected: true, text: true }
  ];

  function emptyResult(options, errors, warnings) {
    options = options || {};
    var nature = String(options.nature || 'clients');
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      nature: nature,
      natureLabel: natureInfo ? natureInfo.label : 'Clients',
      from: String(options.from || ''),
      to: String(options.to || ''),
      groups: [],
      rows: [],
      tierCount: 0,
      lineCount: 0,
      generatedLineCount: 0,
      sourceMovementCount: 0,
      periodMovementCount: 0,
      includeNonMoved: options.includeNonMoved === true,
      commentLeft: String(options.commentLeft || ''),
      commentRight: String(options.commentRight || ''),
      totals: { debit: 0, credit: 0, difference: 0 },
      thirdPartyFilter: null,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        explicitThirdPartyReferencesOnly: true,
        openingBalancesNotApplied: true,
        noRunningBalanceColumn: true,
        nonMovedTiersAreHeadingsOnly: true,
        noAccountingMutation: true
      }
    };
  }

  function sourceWarnings(options, ledger) {
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    if (ledger.unmatchedMovementCount) warnings.push(ledger.unmatchedMovementCount + ' mouvement(s) sur les comptes des tiers sélectionnés ne portent pas de référence auxiliaire reconnue ; ils ne sont attribués à aucune fiche.');
    if (ledger.ambiguousMovementCount) warnings.push(ledger.ambiguousMovementCount + ' mouvement(s) portent une référence correspondant à plusieurs fiches sur le même compte ; ils sont exclus plutôt que devinés.');
    if (ledger.wrongAccountMovementCount) warnings.push(ledger.wrongAccountMovementCount + ' mouvement(s) liés à une fiche portent un compte différent de celui enregistré sur cette fiche ; ils sont exclus.');
    warnings.push('Seules les écritures validées portant une référence auxiliaire explicite et non ambiguë sont restituées. Les champs libres du registre ne servent pas de liaison.');
    return warnings.filter(function (warning, index, all) { return all.indexOf(warning) === index; });
  }

  function build(options) {
    options = options || {};
    var nature = String(options.nature || 'clients');
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    if (!ThirdPartyLedgerReport) return emptyResult(options, ['Le calcul des mouvements auxiliaires des tiers n’est pas disponible.'], warnings);
    if (!natureInfo) return emptyResult(options, ['Choisissez une nature de tiers disponible.'], warnings);

    var ledger = ThirdPartyLedgerReport.build(Object.assign({}, options, {
      nature: nature,
      openingBalances: [],
      includeNonMoved: options.includeNonMoved === true
    }));
    warnings = sourceWarnings(options, ledger);
    if (!ledger.ok) return emptyResult(options, ledger.errors || ['Le relevé de compte des tiers n’a pas pu être calculé.'], warnings);

    var groups = (ledger.groups || []).map(function (group) {
      var rows = (group.rows || []).map(function (row) {
        return {
          key: row.key,
          sourceEntryId: row.sourceEntryId,
          lineNumber: row.lineNumber,
          date: row.date,
          reference: row.reference,
          debit: row.debit,
          credit: row.credit,
          label: row.label,
          thirdPartyId: row.thirdPartyId,
          thirdPartyCode: row.thirdPartyCode,
          thirdPartyTitle: row.thirdPartyTitle
        };
      });
      return {
        key: group.key,
        thirdPartyId: group.thirdPartyId,
        thirdPartyCode: group.thirdPartyCode,
        thirdPartyTitle: group.thirdPartyTitle,
        thirdPartyType: group.thirdPartyType,
        auxiliaryAccountCode: group.auxiliaryAccountCode,
        accountCode: group.accountCode,
        accountLabel: group.accountLabel,
        lineCount: rows.length,
        rows: rows
      };
    });
    var rows = [];
    groups.forEach(function (group) { Array.prototype.push.apply(rows, group.rows); });

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      nature: nature,
      natureLabel: natureInfo.label,
      from: ledger.from,
      to: ledger.to,
      groups: groups,
      rows: rows,
      tierCount: groups.length,
      lineCount: ledger.lineCount,
      generatedLineCount: ledger.lineCount,
      sourceMovementCount: ledger.sourceMovementCount,
      periodMovementCount: ledger.periodMovementCount,
      includeNonMoved: options.includeNonMoved === true,
      commentLeft: String(options.commentLeft || ''),
      commentRight: String(options.commentRight || ''),
      totals: ledger.totals,
      thirdPartyFilter: ledger.thirdPartyFilter,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        explicitThirdPartyReferencesOnly: true,
        openingBalancesNotApplied: true,
        noRunningBalanceColumn: true,
        nonMovedTiersAreHeadingsOnly: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
