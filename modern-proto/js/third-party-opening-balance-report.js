/*
 * PERFECTO · Balance d’ouverture des tiers.
 * Lecture seule : utilise le registre Reports à nouveau et n’affecte une ligne
 * à une fiche que si le registre porte un identifiant/code tiers explicite.
 */
(function (root, factory) {
  'use strict';
  var openingBalanceReport = root.PerfectoOpeningBalanceReport;
  if (!openingBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    openingBalanceReport = require('./opening-balance-report.js');
  }
  var api = factory(openingBalanceReport);
  root.PerfectoThirdPartyOpeningBalanceReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (OpeningBalanceReport) {
  'use strict';

  var NATURES = [
    { key: 'suppliers', label: 'Fournisseurs' },
    { key: 'clients', label: 'Clients' },
    { key: 'personnel', label: 'Personnel' },
    { key: 'debtors', label: 'Débiteurs divers' },
    { key: 'creditors', label: 'Créditeurs divers' }
  ];

  var COLUMN_DEFINITIONS = [
    { key: 'thirdPartyCode', label: 'Code du tiers', exportLabel: 'Code du tiers', defaultSelected: true, text: true },
    { key: 'thirdPartyTitle', label: 'Intitulé du tiers', exportLabel: 'Intitulé du tiers', defaultSelected: true, text: true },
    { key: 'debit', label: 'Débit', exportLabel: 'Débit', defaultSelected: true, text: false },
    { key: 'credit', label: 'Crédit', exportLabel: 'Crédit', defaultSelected: true, text: false }
  ];

  function normalizeReference(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function auxiliaryAccountCode(record) {
    return String(record && (record.auxiliaryAccountCode || (record.accountCode && record.code
      ? record.accountCode + '-' + record.code
      : '')) || '').trim();
  }

  function recordKey(record, index) {
    return String(record && record.id || '') || ('third-party-' + index + ':' + String(record && record.code || ''));
  }

  function previousIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return '';
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  }

  function createAliasIndex(records) {
    var aliases = new Map();
    function register(reference, record) {
      var value = normalizeReference(reference);
      if (!value) return;
      if (!aliases.has(value)) aliases.set(value, record);
      else if (aliases.get(value) !== record) aliases.set(value, null);
    }
    records.forEach(function (record) {
      if (!record) return;
      register(record.id, record);
      register(record.code, record);
      register(auxiliaryAccountCode(record), record);
    });
    return aliases;
  }

  function emptyResult(options, errors, warnings, filter) {
    options = options || {};
    var nature = String(options.nature || 'clients').toLowerCase();
    return {
      ok: !errors.length,
      errors: errors.slice(),
      warnings: warnings.slice(),
      nature: nature,
      natureLabel: (NATURES.find(function (item) { return item.key === nature; }) || NATURES[1]).label,
      reportDate: String(options.cycleStart || ''),
      sourceDate: String(options.sourceDate || previousIsoDate(options.cycleStart)),
      rows: [],
      tierCount: 0,
      sourceLineCount: 0,
      linkedLineCount: 0,
      unattributedOpeningBalanceCount: 0,
      invalidLineCount: 0,
      totals: { debit: 0, credit: 0 },
      thirdPartyFilter: filter || null,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        foreignCurrencyAmountsAvailable: false,
        explicitThirdPartyReferenceRequired: true,
        unlinkedOpeningBalancesExcluded: true,
        noAccountingMutation: true
      }
    };
  }

  function build(options) {
    options = options || {};
    var nature = String(options.nature || 'clients').toLowerCase();
    var natureInfo = NATURES.find(function (item) { return item.key === nature; });
    var records = Array.isArray(options.thirdPartyRecords) ? options.thirdPartyRecords.filter(function (record) {
      return record && typeof record === 'object' && String(record.code || '').trim();
    }) : [];
    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var openingBalances = Array.isArray(options.openingBalances) ? options.openingBalances : [];
    var cycleStart = String(options.cycleStart || '');
    var sourceDate = String(options.sourceDate || previousIsoDate(cycleStart));
    var filterExpression = options.thirdPartyFilter == null ? '*' : String(options.thirdPartyFilter);
    var sourceErrors = [];
    var warnings = Array.isArray(options.sourceWarnings) ? options.sourceWarnings.map(String) : [];
    var errors = [];

    if (!OpeningBalanceReport || typeof OpeningBalanceReport.build !== 'function') {
      errors.push('Le registre Reports à nouveau n’est pas disponible.');
    }
    if (!natureInfo) errors.push('Choisissez une nature de tiers disponible.');
    if (!cycleStart || !sourceDate || sourceDate !== previousIsoDate(cycleStart)) {
      errors.push('Le registre doit contenir les reports datés de la veille du début du cycle actif.');
    }
    if (errors.length) return emptyResult(options, errors, warnings, null);

    var accountByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountByCode[String(account.code)] = account;
    });
    var aliases = createAliasIndex(records);
    var tokens = filterExpression.trim().split(/[\s,;]+/).filter(Boolean);
    var filter = { valid: tokens.length > 0, all: tokens.indexOf('*') !== -1, selectedKeys: Object.create(null), codes: [], error: '' };
    if (!tokens.length) {
      filter.error = 'Indiquez un code de tiers ou * pour sélectionner tous les tiers.';
    } else if (!filter.all) {
      var invalidTokens = [];
      tokens.forEach(function (token) {
        var reference = normalizeReference(token);
        if (!aliases.has(reference)) {
          invalidTokens.push(token);
          return;
        }
        var record = aliases.get(reference);
        if (!record) {
          invalidTokens.push(token + ' (référence ambiguë)');
          return;
        }
        var index = records.indexOf(record);
        filter.selectedKeys[recordKey(record, index)] = true;
        if (filter.codes.indexOf(String(record.code || '')) === -1) filter.codes.push(String(record.code || ''));
      });
      if (invalidTokens.length) {
        filter.valid = false;
        filter.error = 'Tiers introuvable(s) ou ambigu(s) : ' + invalidTokens.join(', ') + '.';
      }
    }
    if (!filter.valid) return emptyResult(options, [filter.error], warnings, filter);

    var selectedRecords = records.filter(function (record, index) {
      return filter.all || !!filter.selectedKeys[recordKey(record, index)];
    });
    var selectedRecordKeys = Object.create(null);
    var selectedAccountCodes = Object.create(null);
    var ineligibleSelectedRecords = 0;
    selectedRecords.forEach(function (record) {
      var accountCode = String(record.accountCode || '').trim();
      var account = accountByCode[accountCode];
      if (!accountCode || !account || account.aux !== true || account.postable === false) {
        ineligibleSelectedRecords += 1;
        return;
      }
      selectedRecordKeys[recordKey(record, records.indexOf(record))] = true;
      selectedAccountCodes[accountCode] = true;
    });
    if (ineligibleSelectedRecords) {
      warnings.push(ineligibleSelectedRecords + (ineligibleSelectedRecords === 1
        ? ' fiche de tiers sélectionnée n’est pas rattachée à un compte auxiliaire actif ; elle ne peut pas être restituée.'
        : ' fiches de tiers sélectionnées ne sont pas rattachées à un compte auxiliaire actif ; elles ne peuvent pas être restituées.'));
    }

    var candidateOpeningBalances = openingBalances.filter(function (record) {
      return record && selectedAccountCodes[String(record.accountCode || '').trim()];
    });
    var sourceReport = OpeningBalanceReport.build({
      accounts: accounts,
      openingBalances: candidateOpeningBalances,
      accountFilter: '*',
      subtotals: false,
      reportDate: cycleStart,
      sourceDate: sourceDate
    });
    if (!sourceReport.ok) {
      sourceErrors = Array.isArray(sourceReport.errors) ? sourceReport.errors.map(String) : ['Le registre Reports à nouveau est invalide.'];
      return emptyResult(options, sourceErrors, warnings, filter);
    }

    var openingLines = Array.isArray(sourceReport.sourceRecords) ? sourceReport.sourceRecords : [];
    var aggregateByKey = Object.create(null);
    var linkedLineCount = 0;
    var sourceLineCount = 0;
    var unattributedOpeningBalanceCount = 0;
    var wrongAccountLineCount = 0;
    var totalsOverflow = false;

    function ensureAggregate(record) {
      var index = records.indexOf(record);
      var key = recordKey(record, index);
      if (!aggregateByKey[key]) aggregateByKey[key] = {
        thirdPartyId: String(record.id || ''),
        thirdPartyCode: String(record.code || ''),
        thirdPartyTitle: String(record.name || record.label || ''),
        auxiliaryAccountCode: auxiliaryAccountCode(record),
        debit: 0,
        credit: 0,
        lineCount: 0
      };
      return aggregateByKey[key];
    }

    openingLines.forEach(function (record) {
      var accountCode = String(record.accountCode || '').trim();
      if (!selectedAccountCodes[accountCode]) return;
      var references = [record.thirdPartyId, record.thirdPartyCode, record.auxiliaryCode].map(normalizeReference).filter(Boolean);
      if (!references.length) {
        unattributedOpeningBalanceCount += 1;
        return;
      }
      var matchedRecords = [];
      var unresolvedReference = false;
      references.forEach(function (reference) {
        if (!aliases.has(reference) || !aliases.get(reference)) {
          unresolvedReference = true;
          return;
        }
        var match = aliases.get(reference);
        if (matchedRecords.indexOf(match) === -1) matchedRecords.push(match);
      });
      if (unresolvedReference || matchedRecords.length !== 1) {
        unattributedOpeningBalanceCount += 1;
        return;
      }
      var thirdParty = matchedRecords[0];
      var thirdPartyKey = recordKey(thirdParty, records.indexOf(thirdParty));
      if (!selectedRecordKeys[thirdPartyKey]) return;
      if (String(thirdParty.accountCode || '').trim() !== accountCode) {
        wrongAccountLineCount += 1;
        return;
      }
      var aggregate = ensureAggregate(thirdParty);
      var debit = Number(record.debit);
      var credit = Number(record.credit);
      aggregate.debit += debit;
      aggregate.credit += credit;
      aggregate.lineCount += 1;
      linkedLineCount += 1;
      sourceLineCount += 1;
      if (!Number.isSafeInteger(aggregate.debit) || !Number.isSafeInteger(aggregate.credit)) totalsOverflow = true;
    });

    if (sourceReport.invalidLineCount) warnings.push(sourceReport.invalidLineCount + (sourceReport.invalidLineCount === 1
      ? ' ligne invalide du registre sur un compte auxiliaire sélectionné a été écartée.'
      : ' lignes invalides du registre sur des comptes auxiliaires sélectionnés ont été écartées.'));
    if (unattributedOpeningBalanceCount) warnings.push(unattributedOpeningBalanceCount + (unattributedOpeningBalanceCount === 1
      ? ' ligne de report valide sur les comptes auxiliaires sélectionnés ne porte pas de référence tiers explicite et non ambiguë ; elle n’est pas attribuée. Les champs libres ne sont pas interprétés comme des liaisons.'
      : ' lignes de report valides sur les comptes auxiliaires sélectionnés ne portent pas de référence tiers explicite et non ambiguë ; elles ne sont pas attribuées. Les champs libres ne sont pas interprétés comme des liaisons.'));
    if (wrongAccountLineCount) warnings.push(wrongAccountLineCount + (wrongAccountLineCount === 1
      ? ' ligne explicitement liée à une fiche porte un compte collectif différent de celui de cette fiche ; elle est écartée.'
      : ' lignes explicitement liées à une fiche portent un compte collectif différent de celui de ces fiches ; elles sont écartées.'));
    if (!linkedLineCount) warnings.push('Aucun report d’ouverture valide n’est explicitement lié à une fiche de tiers sélectionnée. Les libellés libres du registre ne sont pas interprétés comme des identifiants.');
    if (totalsOverflow) return emptyResult(options, ['Les cumuls de la balance d’ouverture des tiers dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.'], warnings, filter);

    var rows = Object.keys(aggregateByKey).map(function (key) {
      var aggregate = aggregateByKey[key];
      return {
        thirdPartyId: aggregate.thirdPartyId,
        thirdPartyCode: aggregate.thirdPartyCode,
        thirdPartyTitle: aggregate.thirdPartyTitle,
        auxiliaryAccountCode: aggregate.auxiliaryAccountCode,
        debit: aggregate.debit,
        credit: aggregate.credit,
        lineCount: aggregate.lineCount
      };
    }).sort(function (left, right) {
      return String(left.auxiliaryAccountCode || left.thirdPartyCode).localeCompare(String(right.auxiliaryAccountCode || right.thirdPartyCode), 'fr', { numeric: true, sensitivity: 'base' });
    });

    var totals = rows.reduce(function (result, row) {
      result.debit += row.debit;
      result.credit += row.credit;
      if (!Number.isSafeInteger(result.debit) || !Number.isSafeInteger(result.credit)) totalsOverflow = true;
      return result;
    }, { debit: 0, credit: 0 });
    if (totalsOverflow) return emptyResult(options, ['Les totaux de la balance d’ouverture des tiers dépassent la précision entière disponible ; aucun montant approximatif n’est affiché.'], warnings, filter);

    return {
      ok: true,
      errors: [],
      warnings: warnings,
      nature: nature,
      natureLabel: natureInfo.label,
      reportDate: cycleStart,
      sourceDate: sourceDate,
      rows: rows,
      tierCount: rows.length,
      sourceLineCount: sourceLineCount,
      linkedLineCount: linkedLineCount,
      unattributedOpeningBalanceCount: unattributedOpeningBalanceCount,
      invalidLineCount: Number(sourceReport.invalidLineCount) || 0,
      totals: totals,
      thirdPartyFilter: filter,
      basis: {
        source: 'opening-balance-registry',
        amountsInXof: true,
        foreignCurrencyAmountsAvailable: false,
        explicitThirdPartyReferenceRequired: true,
        unlinkedOpeningBalancesExcluded: true,
        noAccountingMutation: true
      }
    };
  }

  return {
    NATURES: NATURES.map(function (nature) { return Object.assign({}, nature); }),
    COLUMN_DEFINITIONS: COLUMN_DEFINITIONS.map(function (column) { return Object.assign({}, column); }),
    auxiliaryAccountCode: auxiliaryAccountCode,
    build: build
  };
});
