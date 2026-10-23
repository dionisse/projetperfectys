/*
 * PERFECTO · Situation / position des tiers à une date.
 * Adaptation du calcul auxiliaire commun à une date d’arrêté incluse.
 */
(function (root, factory) {
  'use strict';
  var thirdPartyBalanceReport = root.PerfectoThirdPartyBalanceReport;
  if (!thirdPartyBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    thirdPartyBalanceReport = require('./third-party-balance-report.js');
  }
  var api = factory(thirdPartyBalanceReport);
  root.PerfectoThirdPartyAccountSituationReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ThirdPartyBalanceReport) {
  'use strict';

  var COLUMN_DEFINITIONS = [
    { key: 'thirdPartyCode', label: 'Code du tiers', exportLabel: 'Code du tiers', defaultSelected: true, text: true },
    { key: 'thirdPartyTitle', label: 'Intitulé du tiers', exportLabel: 'Intitulé du tiers', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', exportLabel: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', exportLabel: 'Crédit', defaultSelected: true, text: false }
  ];

  function emptyResult(options, errors, report) {
    options = options || {};
    report = report || {};
    return {
      ok: false,
      errors: (errors || report.errors || []).map(String),
      warnings: Array.isArray(report.warnings) ? report.warnings.slice() : [],
      nature: String(options.nature || 'clients'),
      natureLabel: String(report.natureLabel || ''),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      asOfDate: String(options.asOfDate || ''),
      rows: [],
      tierCount: 0,
      sourceMovementCount: 0,
      periodMovementCount: 0,
      openingReportLineCount: 0,
      unattributedOpeningBalanceCount: 0,
      unmatchedMovementCount: 0,
      totals: { debit: 0, credit: 0 },
      thirdPartyFilter: report.thirdPartyFilter || null,
      basis: {
        positionAtDate: true,
        cutoffDateInclusive: true,
        postedAuxiliaryMovementsOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    if (!ThirdPartyBalanceReport || typeof ThirdPartyBalanceReport.build !== 'function') {
      return emptyResult(options, ['Le calcul des soldes auxiliaires des tiers n’est pas disponible.']);
    }
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var asOfDate = String(options.asOfDate || '');
    var balance = ThirdPartyBalanceReport.build({
      nature: options.nature,
      thirdPartyRecords: options.thirdPartyRecords,
      thirdPartyMovements: options.thirdPartyMovements,
      openingBalances: options.openingBalances,
      sourceErrors: options.sourceErrors,
      sourceWarnings: options.sourceWarnings,
      thirdPartyFilter: options.thirdPartyFilter,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      from: cycleStart,
      to: asOfDate,
      decimalPlaces: options.decimalPlaces
    });
    if (!balance.ok) return emptyResult(options, balance.errors, balance);

    var rows = balance.rows.map(function (row) {
      return {
        thirdPartyId: row.thirdPartyId,
        thirdPartyCode: row.thirdPartyCode,
        thirdPartyTitle: row.thirdPartyTitle,
        auxiliaryAccountCode: row.auxiliaryAccountCode,
        debit: Number(row.closingBalanceDebit) || 0,
        credit: Number(row.closingBalanceCredit) || 0,
        sourceMovementCount: Number(row.sourceMovementCount) || 0,
        periodMovementCount: Number(row.periodMovementCount) || 0,
        openingReportKnown: row.openingReportKnown === true
      };
    });
    return {
      ok: true,
      errors: [],
      warnings: balance.warnings.slice(),
      nature: balance.nature,
      natureLabel: balance.natureLabel,
      cycleStart: balance.cycleStart,
      cycleEnd: balance.cycleEnd,
      asOfDate: asOfDate,
      rows: rows,
      tierCount: rows.length,
      sourceMovementCount: balance.sourceMovementCount,
      periodMovementCount: balance.periodMovementCount,
      openingReportLineCount: balance.openingReportLineCount,
      unattributedOpeningBalanceCount: balance.unattributedOpeningBalanceCount,
      unmatchedMovementCount: balance.unmatchedMovementCount,
      totals: {
        debit: Number(balance.totals.closingBalanceDebit) || 0,
        credit: Number(balance.totals.closingBalanceCredit) || 0
      },
      thirdPartyFilter: balance.thirdPartyFilter,
      basis: {
        positionAtDate: true,
        cutoffDateInclusive: true,
        postedAuxiliaryMovementsOnly: balance.basis.postedAuxiliaryMovementsOnly === true,
        openingReportsRequireExplicitThirdPartyReference: balance.basis.openingReportsRequireExplicitThirdPartyReference === true,
        unlinkedOpeningReportsExcluded: balance.basis.unlinkedOpeningReportsExcluded === true,
        unattributedCollectiveLinesExcluded: balance.basis.unattributedCollectiveLinesExcluded === true,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: ThirdPartyBalanceReport.NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    build: build
  };
});
