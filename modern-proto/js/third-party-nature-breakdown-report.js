/*
 * PERFECTO · Décomposition des soldes des tiers par nature.
 * Lecture seule : rattachement explicite des écritures et reports, puis
 * classement des comptes selon les rubriques configurées dans le dossier.
 */
(function (root, factory) {
  'use strict';
  var balanceReport = root.PerfectoThirdPartyBalanceReport;
  if (!balanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    balanceReport = require('./third-party-balance-report.js');
  }
  var api = factory(balanceReport);
  root.PerfectoThirdPartyNatureBreakdownReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (ThirdPartyBalanceReport) {
  'use strict';

  var NATURES = [
    { key: 'clients', label: 'Clients', partyLabel: 'Compte client', prefix: 'customer' },
    { key: 'suppliers', label: 'Fournisseurs', partyLabel: 'Compte fournisseur', prefix: 'supplier' }
  ];

  var CATEGORY_DEFINITIONS = [
    {
      key: 'advancesAndCredits', label: 'Avances et Avoirs',
      accountRows: {
        clients: ['customer-advances', 'customer-rebates'],
        suppliers: ['supplier-advances', 'supplier-rebates']
      }
    },
    {
      key: 'unpaidInvoices', label: 'Factures non réglées',
      accountRows: { clients: ['customer-receivables'], suppliers: ['supplier-debts'] }
    },
    {
      key: 'guaranteeRetentions', label: 'Retenues de garantie',
      accountRows: { clients: ['customer-guarantee-retentions'], suppliers: ['supplier-guarantee-retentions'] }
    },
    {
      key: 'provisionedClaims', label: 'Créances provisionnées',
      accountRows: { clients: ['customer-provisioned-claims'], suppliers: ['supplier-provisioned-claims'] }
    }
  ];

  var COLUMN_DEFINITIONS = [
    { key: 'thirdPartyCode', label: 'Code du tiers', exportLabel: 'Code du tiers', defaultSelected: true, text: true },
    { key: 'thirdPartyTitle', label: 'Intitulé du tiers', exportLabel: 'Intitulé du tiers', defaultSelected: true, text: true },
    { key: 'advancesAndCredits', label: 'Avances et Avoirs', exportLabel: 'Avances et Avoirs', defaultSelected: true, text: false, balance: true },
    { key: 'unpaidInvoices', label: 'Factures non réglées', exportLabel: 'Factures non réglées', defaultSelected: true, text: false, balance: true },
    { key: 'guaranteeRetentions', label: 'Retenues de garantie', exportLabel: 'Retenues de garantie', defaultSelected: true, text: false, balance: true },
    { key: 'provisionedClaims', label: 'Créances provisionnées', exportLabel: 'Créances provisionnées', defaultSelected: true, text: false, balance: true },
    { key: 'balance', label: 'Solde', exportLabel: 'Solde', defaultSelected: true, text: false, balance: true }
  ];

  function normalizeNature(value) {
    return String(value || '').trim().toLowerCase();
  }

  function accountTokenPattern(token) {
    var value = String(token || '').trim().toUpperCase();
    var excluded = value.charAt(0) === '-';
    if (excluded) value = value.slice(1);
    if (!value || !/^[A-Z0-9._/*?-]+$/.test(value)) return null;
    var hasWildcard = /[*?]/.test(value);
    var source = value.split('').map(function (character) {
      if (character === '*') return '.*';
      if (character === '?') return '.';
      return character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    return { excluded: excluded, regex: new RegExp('^' + source + (hasWildcard ? '$' : ''), 'i') };
  }

  function parseAccountExpression(expression) {
    var tokens = String(expression == null ? '' : expression).trim().split(/[\s,;]+/).filter(Boolean);
    var parsed = [];
    var errors = [];
    tokens.forEach(function (token) {
      var parsedToken = accountTokenPattern(token);
      if (!parsedToken) errors.push('Le filtre de compte « ' + token + ' » n’est pas valide.');
      else parsed.push(parsedToken);
    });
    return {
      valid: errors.length === 0,
      tokens: parsed,
      includes: parsed.filter(function (token) { return !token.excluded; }),
      excludes: parsed.filter(function (token) { return token.excluded; }),
      errors: errors
    };
  }

  function accountMatches(code, parsed) {
    var accountCode = String(code == null ? '' : code).trim();
    if (!parsed || !parsed.valid || !accountCode || !parsed.includes.length) return false;
    var included = parsed.includes.some(function (token) { return token.regex.test(accountCode); });
    return included && !parsed.excludes.some(function (token) { return token.regex.test(accountCode); });
  }

  function accountRowsById(rows) {
    var result = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (row && row.id && !result[String(row.id)]) result[String(row.id)] = row;
    });
    return result;
  }

  function buildCategoryRules(nature, configuredRows) {
    var rowsById = accountRowsById(configuredRows);
    var warnings = [];
    var errors = [];
    var rules = CATEGORY_DEFINITIONS.map(function (definition) {
      var rowIds = definition.accountRows[nature] || [];
      var expressions = [];
      var configuredRowCount = 0;
      var missingRowIds = [];
      rowIds.forEach(function (rowId) {
        var row = rowsById[rowId];
        if (!row) {
          missingRowIds.push(rowId);
          return;
        }
        var expression = String(row.accounts == null ? '' : row.accounts).trim();
        if (!expression) {
          missingRowIds.push(rowId);
          return;
        }
        configuredRowCount += 1;
        var parsed = parseAccountExpression(expression);
        if (!parsed.valid) errors.push.apply(errors, parsed.errors);
        else if (!parsed.includes.length) errors.push('La rubrique « ' + rowId + ' » doit contenir au moins un compte inclus.');
        if (parsed.includes.length) expressions.push(parsed);
      });
      return {
        key: definition.key,
        label: definition.label,
        rowIds: rowIds.slice(),
        expressions: expressions,
        supported: expressions.length > 0,
        complete: missingRowIds.length === 0,
        configuredRowCount: configuredRowCount,
        missingRowIds: missingRowIds
      };
    });
    rules.forEach(function (rule) {
      if (!rule.supported) {
        warnings.push('La colonne « ' + rule.label + ' » reste vide : aucun compte correspondant n’est paramétré dans les rubriques du dossier.');
      } else if (!rule.complete) {
        warnings.push('La colonne « ' + rule.label + ' » ne reprend que les rubriques ayant une plage de comptes configurée ; la ventilation peut être partielle.');
      }
    });
    return { rules: rules, errors: errors, warnings: warnings };
  }

  function ruleMatches(rule, accountCode) {
    return !!(rule && rule.supported && rule.expressions.some(function (expression) {
      return accountMatches(accountCode, expression);
    }));
  }

  function recordForRow(row, records) {
    var byId = records.filter(function (record) { return String(record && record.id || '') === String(row.thirdPartyId || ''); });
    if (byId.length === 1) return byId[0];
    var byCode = records.filter(function (record) { return String(record && record.code || '').toLocaleUpperCase() === String(row.thirdPartyCode || '').toLocaleUpperCase(); });
    return byCode.length === 1 ? byCode[0] : null;
  }

  function minorUnits(value, factor) {
    var amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    var units = Math.round(amount * factor);
    if (!Number.isSafeInteger(units) || Math.abs(amount - units / factor) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 4) return null;
    return units;
  }

  function emptyResult(options, errors, warnings, nature, categoryRules, balance) {
    options = options || {};
    return {
      ok: false,
      errors: (errors || []).map(String),
      warnings: (warnings || []).map(String),
      nature: nature ? nature.key : normalizeNature(options.nature),
      natureLabel: nature ? nature.label : '',
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
      unmappedAccountCount: 0,
      ambiguousCategoryAccountCount: 0,
      categoryRules: (categoryRules || []).map(function (rule) {
        return { key: rule.key, label: rule.label, supported: rule.supported, complete: rule.complete };
      }),
      totals: {
        advancesAndCredits: null,
        unpaidInvoices: null,
        guaranteeRetentions: null,
        provisionedClaims: null,
        balance: 0
      },
      thirdPartyFilter: balance && balance.thirdPartyFilter || null,
      basis: {
        postedAuxiliaryMovementsOnly: true,
        openingReportsRequireExplicitThirdPartyReference: true,
        unlinkedOpeningReportsExcluded: true,
        accountCategoriesFromDossierConfiguration: true,
        noFreeTextThirdPartyMatching: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var nature = NATURES.find(function (item) { return item.key === normalizeNature(options.nature); });
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    if (!ThirdPartyBalanceReport || typeof ThirdPartyBalanceReport.build !== 'function') {
      return emptyResult(options, ['Le calcul des soldes auxiliaires des tiers n’est pas disponible.'], warnings, nature, [], null);
    }
    if (!nature) return emptyResult(options, ['Choisissez un compte client ou un compte fournisseur.'], warnings, null, [], null);

    var categoryInfo = buildCategoryRules(nature.key, options.accountNatureRows);
    warnings = warnings.concat(categoryInfo.warnings);
    if (categoryInfo.errors.length) {
      return emptyResult(options, categoryInfo.errors, warnings, nature, categoryInfo.rules, null);
    }

    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    var asOfDate = String(options.asOfDate || '');
    var balance = ThirdPartyBalanceReport.build({
      nature: nature.key,
      thirdPartyRecords: options.thirdPartyRecords,
      thirdPartyMovements: options.thirdPartyMovements,
      openingBalances: options.openingBalances,
      sourceErrors: options.sourceErrors,
      sourceWarnings: warnings,
      thirdPartyFilter: options.thirdPartyFilter,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      from: cycleStart,
      to: asOfDate,
      decimalPlaces: options.decimalPlaces
    });
    if (!balance.ok) return emptyResult(options, balance.errors, balance.warnings, nature, categoryInfo.rules, balance);
    warnings = balance.warnings.slice();

    var records = Array.isArray(options.thirdPartyRecords) ? options.thirdPartyRecords.filter(Boolean) : [];
    var factor = Math.pow(10, Number.isInteger(Number(options.decimalPlaces)) && Number(options.decimalPlaces) >= 0 && Number(options.decimalPlaces) <= 4 ? Number(options.decimalPlaces) : 0);
    var totalsMinor = Object.create(null);
    categoryInfo.rules.forEach(function (rule) { totalsMinor[rule.key] = rule.supported ? 0 : null; });
    totalsMinor.balance = 0;
    var rows = [];
    var unmappedAccountCount = 0;
    var ambiguousCategoryAccountCount = 0;
    var invalidTotal = false;

    balance.rows.forEach(function (balanceRow) {
      var record = recordForRow(balanceRow, records);
      var accountCode = String(record && record.accountCode || '').trim();
      var matches = categoryInfo.rules.filter(function (rule) { return ruleMatches(rule, accountCode); });
      var row = {
        thirdPartyId: balanceRow.thirdPartyId,
        thirdPartyCode: balanceRow.thirdPartyCode,
        thirdPartyTitle: balanceRow.thirdPartyTitle,
        accountCode: accountCode,
        advancesAndCredits: null,
        unpaidInvoices: null,
        guaranteeRetentions: null,
        provisionedClaims: null,
        balance: Number(balanceRow.closingBalance) || 0,
        sourceMovementCount: Number(balanceRow.sourceMovementCount) || 0,
        periodMovementCount: Number(balanceRow.periodMovementCount) || 0,
        openingReportKnown: balanceRow.openingReportKnown === true
      };
      categoryInfo.rules.forEach(function (rule) {
        if (rule.supported) row[rule.key] = 0;
      });
      if (matches.length === 1) row[matches[0].key] = row.balance;
      else if (matches.length > 1) {
        ambiguousCategoryAccountCount += 1;
        matches.forEach(function (rule) { row[rule.key] = null; });
      } else {
        unmappedAccountCount += 1;
      }

      Object.keys(totalsMinor).forEach(function (key) {
        if (row[key] == null) return;
        var units = minorUnits(row[key], factor);
        if (units === null) {
          invalidTotal = true;
          return;
        }
        totalsMinor[key] += units;
        if (!Number.isSafeInteger(totalsMinor[key])) invalidTotal = true;
      });
      rows.push(row);
    });

    if (invalidTotal) {
      return emptyResult(options, ['Un total de la décomposition dépasse la précision numérique sûre du dossier ; aucun montant approximatif n’est affiché.'], balance.warnings, nature, categoryInfo.rules, balance);
    }
    if (unmappedAccountCount) warnings.push(unmappedAccountCount + ' fiche(s) restituée(s) porte(nt) un compte qui n’est classé dans aucune des quatre rubriques ; son solde reste inclus dans la colonne « Solde ».');
    if (ambiguousCategoryAccountCount) warnings.push(ambiguousCategoryAccountCount + ' fiche(s) porte(nt) un compte présent dans plusieurs rubriques configurées ; les cellules de décomposition concernées restent vides et le solde total demeure affiché.');

    var totals = {};
    Object.keys(totalsMinor).forEach(function (key) {
      totals[key] = totalsMinor[key] == null ? null : totalsMinor[key] / factor;
    });
    return {
      ok: true,
      errors: [],
      warnings: warnings,
      nature: nature.key,
      natureLabel: nature.label,
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
      unmappedAccountCount: unmappedAccountCount,
      ambiguousCategoryAccountCount: ambiguousCategoryAccountCount,
      categoryRules: categoryInfo.rules.map(function (rule) {
        return {
          key: rule.key,
          label: rule.label,
          supported: rule.supported,
          complete: rule.complete,
          configuredRowCount: rule.configuredRowCount,
          missingRowIds: rule.missingRowIds.slice()
        };
      }),
      totals: totals,
      thirdPartyFilter: balance.thirdPartyFilter,
      basis: {
        closingPositionAtDate: true,
        cutoffDateInclusive: true,
        postedAuxiliaryMovementsOnly: balance.basis.postedAuxiliaryMovementsOnly === true,
        openingReportsRequireExplicitThirdPartyReference: balance.basis.openingReportsRequireExplicitThirdPartyReference === true,
        unlinkedOpeningReportsExcluded: balance.basis.unlinkedOpeningReportsExcluded === true,
        unattributedCollectiveLinesExcluded: balance.basis.unattributedCollectiveLinesExcluded === true,
        accountCategoriesFromDossierConfiguration: true,
        categoryBalancesAreDebitLessCredit: true,
        totalIncludesUnmappedThirdPartyAccountBalances: true,
        noFreeTextThirdPartyMatching: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    CATEGORY_DEFINITIONS: CATEGORY_DEFINITIONS.map(function (definition) { return Object.assign({}, definition); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    parseAccountExpression: parseAccountExpression,
    accountMatches: accountMatches,
    build: build
  };
});
