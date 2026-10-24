/* PERFECTO · Tableau des amortissements.
   Lecture seule du registre ; aucune dotation ou valeur nette n’est calculée. */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoFixedAssetDepreciationReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var REPORT_ID = 'edition-fixed-asset-depreciation';
  var TITLE = 'Tableau des amortissements';
  var DEPRECIABLE_METHODS = ['lineaire', 'degressif', 'unites-oeuvre'];
  var COLUMNS = [
    { key: 'assetCode', label: 'Code élément', text: true },
    { key: 'assetName', label: 'Intitulé élément', text: true },
    { key: 'entryDate', label: 'Date d’entrée', text: true },
    { key: 'depreciationRate', label: 'Taux d’Amort.', text: true },
    { key: 'grossValue', label: 'Valeur brute', text: false },
    { key: 'depreciation', label: 'Amortissement', text: false },
    { key: 'netValue', label: 'Valeur nette', text: false }
  ];
  var ELEMENT_FILTERS = [
    { key: 'netValueNonzero', label: 'Valeur nette non nulle', defaultSelected: true, available: false },
    { key: 'netValueZero', label: 'Valeur nette nulle', defaultSelected: false, available: false },
    { key: 'withDepreciation', label: 'Avec amortissement', defaultSelected: true, available: true },
    { key: 'withoutDepreciation', label: 'Sans amortissement', defaultSelected: false, available: true },
    { key: 'withExits', label: 'Avec les sorties', defaultSelected: true, available: false }
  ];

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function baseResult(options, errors, warnings, accountFilter, from, to) {
    return {
      ok: !errors.length,
      reportId: REPORT_ID,
      title: TITLE,
      errors: errors.slice(),
      warnings: warnings.slice(),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      from: from || '',
      to: to || '',
      accountFilter: accountFilter || null,
      includeWithDepreciation: options.includeWithDepreciation !== false,
      includeWithoutDepreciation: options.includeWithoutDepreciation === true,
      includeNetValueNonzero: options.includeNetValueNonzero !== false,
      includeNetValueZero: options.includeNetValueZero === true,
      includeExits: options.includeExits !== false,
      rows: [],
      displayAccounts: [],
      dataAvailable: false,
      generatedLineCount: 0,
      totals: null,
      basis: {
        fixedAssetRegistryOnly: true,
        grossValueFromRecordedGrossCost: true,
        annualRateOnlyWhenExplicit: true,
        netValuePerAssetAvailable: false,
        accumulatedDepreciationSourceAvailable: false,
        fixedAssetMovementSourceAvailable: false,
        exitDateSourceAvailable: false,
        netValueFiltersApplied: false,
        exitFilterApplied: false,
        noDepreciationOrNetValueCalculated: true,
        noIndicativeSimulationRun: true,
        noAccountingMutation: true
      }
    };
  }

  function explicitRate(asset) {
    if (!asset || asset.annualRatePercent == null || asset.annualRatePercent === '') return '';
    var value = Number(asset.annualRatePercent);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return '';
    return String(asset.annualRatePercent) + ' %';
  }

  function explicitGrossValue(asset) {
    if (!asset || asset.grossCost == null || asset.grossCost === '') return null;
    var value = Number(asset.grossCost);
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }

  function depreciationClass(asset) {
    var method = String(asset && asset.depreciationMethod || '');
    if (DEPRECIABLE_METHODS.indexOf(method) !== -1) return 'with';
    if (method === 'aucun') return 'without';
    return 'unknown';
  }

  function buildReport(options) {
    options = options || {};
    var errors = [];
    var warnings = [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) {
      errors.push('Le cycle du dossier n’est pas défini correctement.');
    }
    if (!GeneralBalanceReport || !GeneralBalanceReport.parseAccountFilter || !GeneralBalanceReport.accountMatches) {
      errors.push('Le sélecteur de comptes n’est pas disponible.');
    }
    var accountFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(options.accountFilter == null ? '*' : options.accountFilter)
      : null;
    if (accountFilter && !accountFilter.valid) errors.push(accountFilter.error);

    var from = String(options.from || cycleStart);
    var to = String(options.to || cycleEnd);
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour le tableau des amortissements.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (from < cycleStart || to > cycleEnd) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    var includeWithDepreciation = options.includeWithDepreciation !== false;
    var includeWithoutDepreciation = options.includeWithoutDepreciation === true;
    if (!includeWithDepreciation && !includeWithoutDepreciation) errors.push('Sélectionnez au moins une catégorie d’amortissement à imprimer.');
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));
    if (errors.length) return baseResult(options, errors, warnings, accountFilter, from, to);

    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var assets = Array.isArray(options.assets) ? options.assets : [];
    var accountsByCode = Object.create(null);
    accounts.forEach(function (account) {
      if (account && account.code != null) accountsByCode[String(account.code)] = account;
    });
    var rows = [];
    var invalidDates = 0;
    var unknownMethods = 0;
    var missingGrossValues = 0;
    var retiredRecords = 0;

    assets.forEach(function (asset) {
      if (!asset || typeof asset !== 'object') return;
      var accountCode = String(asset.assetAccountCode || '');
      if (!accountCode || !GeneralBalanceReport.accountMatches(accountCode, accountFilter)) return;
      var entryDate = String(asset.acquisitionDate || '');
      var entryDateValid = isIsoDate(entryDate);
      if (entryDateValid && entryDate > to) return;
      if (!entryDateValid) invalidDates += 1;
      if (asset.status === 'retiree') retiredRecords += 1;

      var methodClass = depreciationClass(asset);
      if (methodClass === 'unknown') {
        unknownMethods += 1;
        return;
      }
      if (methodClass === 'with' && !includeWithDepreciation) return;
      if (methodClass === 'without' && !includeWithoutDepreciation) return;

      var account = accountsByCode[accountCode];
      var grossValue = explicitGrossValue(asset);
      if (grossValue == null) missingGrossValues += 1;
      rows.push({
        assetId: String(asset.id || ''),
        accountCode: accountCode,
        accountLabel: account ? String(account.label || '') : '',
        assetCode: String(asset.code || ''),
        assetName: String(asset.name || ''),
        entryDate: entryDate,
        entryDateValid: entryDateValid,
        depreciationRate: explicitRate(asset),
        grossValue: grossValue == null ? '' : grossValue,
        depreciation: '',
        netValue: '',
        depreciationClass: methodClass,
        currentStatus: String(asset.status || '')
      });
    });

    rows.sort(function (left, right) {
      return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) ||
        left.assetCode.localeCompare(right.assetCode, 'fr', { numeric: true }) ||
        left.assetName.localeCompare(right.assetName, 'fr');
    });
    var seenAccounts = Object.create(null);
    rows.forEach(function (row) { seenAccounts[row.accountCode] = row.accountLabel; });
    var displayAccounts = Object.keys(seenAccounts).map(function (code) {
      return { code: code, label: seenAccounts[code] };
    }).sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });

    warnings.push('La valeur brute provient uniquement du coût d’acquisition saisi sur la fiche, lorsqu’il est valide.');
    warnings.push('Amortissement et Valeur nette restent vides : le registre ne contient ni amortissement cumulé d’ouverture par élément, ni dotations validées de la période. Aucune simulation ou écriture n’est lancée.');
    warnings.push('Le taux affiché est uniquement le taux annuel enregistré ; il n’est pas déduit de la durée d’utilisation.');
    warnings.push('Les filtres de valeur nette sont désactivés faute de valeur nette par élément. La date de sortie n’est pas enregistrée : « Avec les sorties » ne permet pas de reconstituer les sorties de la période et aucune sortie n’est déduite.');
    warnings.push('Les options Avec/Sans amortissement suivent exclusivement la méthode enregistrée. Les fiches dont la méthode est « à définir » ou non reconnue ne sont pas classées et restent exclues.');
    warnings.push('Les fiches acquises avant Début restent sélectionnables ; seules les dates après Fin sont exclues. Le registre ne reconstitue pas les mouvements de la période.');
    if (invalidDates) warnings.push(invalidDates + ' fiche(s) ont une date d’entrée absente ou invalide ; elles sont conservées et leur date reste affichée telle qu’enregistrée.');
    if (unknownMethods) warnings.push(unknownMethods + ' fiche(s) avec une méthode « à définir » ou inconnue ne peuvent pas être classées dans Avec/Sans amortissement.');
    if (missingGrossValues) warnings.push(missingGrossValues + ' fiche(s) n’ont pas de coût d’acquisition valide ; leur Valeur brute reste vide.');
    if (retiredRecords) warnings.push(retiredRecords + ' fiche(s) sont marquées retirées dans le registre, mais aucune date de sortie ne permet de déterminer si elles sont sorties pendant la période.');

    var report = baseResult(options, [], warnings, accountFilter, from, to);
    report.ok = true;
    report.rows = rows;
    report.displayAccounts = displayAccounts;
    report.dataAvailable = rows.length > 0;
    report.generatedLineCount = rows.length;
    report.includeWithDepreciation = includeWithDepreciation;
    report.includeWithoutDepreciation = includeWithoutDepreciation;
    report.basis.cycleStart = cycleStart;
    report.basis.cycleEnd = cycleEnd;
    report.basis.selectedFrom = from;
    report.basis.selectedTo = to;
    report.basis.registeredAssetsRead = assets.length;
    report.basis.noOpeningAccumulatedDepreciationPerAsset = true;
    report.basis.noValidatedDepreciationEntriesByAsset = true;
    report.totals = null;
    return report;
  }

  function definitionFor(reportId) {
    if (String(reportId || '') !== REPORT_ID) return null;
    return {
      id: REPORT_ID,
      title: TITLE,
      filters: ['accounts', 'from', 'to'],
      columns: COLUMNS.map(function (column) { return Object.assign({ defaultSelected: true }, column); }),
      elementFilters: ELEMENT_FILTERS.map(function (filter) { return Object.assign({}, filter); })
    };
  }

  return Object.freeze({
    REPORT_ID: REPORT_ID,
    TITLE: TITLE,
    COLUMN_DEFINITIONS: COLUMNS.map(function (column) { return Object.assign({}, column); }),
    ELEMENT_FILTERS: ELEMENT_FILTERS.map(function (filter) { return Object.assign({}, filter); }),
    definitionFor: definitionFor,
    buildReport: buildReport,
    isIsoDate: isIsoDate,
    explicitRate: explicitRate,
    explicitGrossValue: explicitGrossValue
  });
});
