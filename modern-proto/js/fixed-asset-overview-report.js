/* PERFECTO · Tableau des immobilisations.
   Lecture seule du registre d’éléments ; aucun mouvement, solde ou taux n’est simulé. */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoFixedAssetOverviewReport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var REPORT_ID = 'edition-fixed-asset-overview';
  var TITLE = 'Tableau des immobilisations';
  var COLUMNS = [
    { key: 'assetCode', label: 'Code élément', text: true },
    { key: 'assetName', label: 'Intitulé élément', text: true },
    { key: 'materialCode', label: 'Code matériel', text: true },
    { key: 'entryDate', label: 'Date d’entrée', text: true },
    { key: 'depreciationRate', label: 'Taux d’amortissement', text: true },
    { key: 'carryforward', label: 'Report', text: false },
    { key: 'increase', label: 'Augmentation', text: false },
    { key: 'decrease', label: 'Diminution', text: false },
    { key: 'balance', label: 'Solde', text: false }
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
      includeTracked: options.includeTracked !== false,
      includeUntracked: options.includeUntracked === true,
      rows: [],
      displayAccounts: [],
      dataAvailable: false,
      generatedLineCount: 0,
      totals: null,
      basis: {
        fixedAssetRegistryOnly: true,
        fixedAssetMovementsAvailable: false,
        materialCodeFromSerialNumber: false,
        noExplicitMaterialCodeSource: true,
        depreciationRateOnlyWhenExplicit: true,
        noMovementAmountsOrBalanceCalculated: true,
        noAccountingMutation: true
      }
    };
  }

  function explicitRate(asset) {
    if (!asset || asset.annualRatePercent == null || asset.annualRatePercent === '') return '';
    var value = Number(asset.annualRatePercent);
    if (!Number.isFinite(value) || value <= 0) return '';
    return String(asset.annualRatePercent) + ' %';
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
    if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Indiquez des dates valides pour le tableau des immobilisations.');
    else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
    else if (from < cycleStart || to > cycleEnd) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    var includeTracked = options.includeTracked !== false;
    var includeUntracked = options.includeUntracked === true;
    if (!includeTracked && !includeUntracked) errors.push('Sélectionnez au moins une catégorie de comptes à imprimer.');
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
    if (includeTracked) {
      assets.forEach(function (asset) {
        if (!asset || typeof asset !== 'object') return;
        var accountCode = String(asset.assetAccountCode || '');
        if (!accountCode || !GeneralBalanceReport.accountMatches(accountCode, accountFilter)) return;
        var entryDate = String(asset.acquisitionDate || '');
        var entryDateValid = isIsoDate(entryDate);
        if (entryDateValid && entryDate > to) return;
        if (!entryDateValid) invalidDates += 1;
        var account = accountsByCode[accountCode];
        rows.push({
          assetId: String(asset.id || ''),
          accountCode: accountCode,
          accountLabel: account ? String(account.label || '') : '',
          assetCode: String(asset.code || ''),
          assetName: String(asset.name || ''),
          materialCode: '',
          entryDate: entryDate,
          entryDateValid: entryDateValid,
          depreciationRate: explicitRate(asset),
          carryforward: '',
          increase: '',
          decrease: '',
          balance: ''
        });
      });
    }
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

    warnings.push('Les lignes suivies par éléments proviennent uniquement du registre des immobilisations du dossier ; les éléments dont la date d’entrée est après la fin de période sont exclus. Comme le registre ne fournit ni événements de sortie ni mouvements par période, les éléments antérieurs au début restent listés et aucun report n’est calculé.');
    warnings.push('Aucune source explicite de code matériel n’est enregistrée dans le registre : cette colonne reste vide. Le taux affiché est uniquement le taux annuel saisi ; aucun taux linéaire n’est déduit de la durée.');
    warnings.push('Le registre actuel ne contient pas de mouvements explicites pour calculer Report, Augmentation, Diminution ou Solde : ces cellules restent vides. Aucun montant n’est repris ou calculé à leur place.');
    if (invalidDates) warnings.push(invalidDates + ' fiche(s) ont une date d’entrée absente ou invalide ; elles sont conservées et leur date reste affichée telle qu’enregistrée.');
    if (includeUntracked) warnings.push('Aucune source explicite ne recense les comptes non suivis par élément ; cette catégorie ne génère donc aucune ligne.');

    var report = baseResult(options, [], warnings, accountFilter, from, to);
    report.ok = true;
    report.rows = rows;
    report.displayAccounts = displayAccounts;
    report.dataAvailable = rows.length > 0;
    report.generatedLineCount = rows.length;
    report.includeTracked = includeTracked;
    report.includeUntracked = includeUntracked;
    report.basis.cycleStart = cycleStart;
    report.basis.cycleEnd = cycleEnd;
    report.basis.selectedFrom = from;
    report.basis.selectedTo = to;
    report.basis.registeredAssetsRead = assets.length;
    report.basis.noOpeningOrMovementSource = true;
    report.totals = null;
    return report;
  }

  function definitionFor(reportId) {
    if (String(reportId || '') !== REPORT_ID) return null;
    return {
      id: REPORT_ID,
      title: TITLE,
      filters: ['accounts', 'from', 'to'],
      columns: COLUMNS.map(function (column) { return Object.assign({ defaultSelected: true }, column); })
    };
  }

  return Object.freeze({
    REPORT_ID: REPORT_ID,
    TITLE: TITLE,
    COLUMN_DEFINITIONS: COLUMNS.map(function (column) { return Object.assign({}, column); }),
    definitionFor: definitionFor,
    buildReport: buildReport,
    isIsoDate: isIsoDate
  });
});
