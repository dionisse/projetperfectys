/* PERFECTO · États complémentaires des immobilisations.
   Chaque état ne restitue que ses sources explicites ; aucun mouvement ou écart n’est extrapolé. */
(function (root, factory) {
  'use strict';
  var generalBalanceReport = root.PerfectoGeneralBalanceReport;
  if (!generalBalanceReport && typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    generalBalanceReport = require('./accounting-balance-report.js');
  }
  var api = factory(generalBalanceReport);
  root.PerfectoFixedAssetEditionReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function (GeneralBalanceReport) {
  'use strict';

  var REPORTS = [
    {
      id: 'edition-fixed-asset-entries', title: 'Entrées d’immobilisations', kind: 'entries',
      filters: ['accounts', 'from', 'to'], filterLabels: { to: 'Date' }, groupBy: 'account', showColumns: true,
      columns: [
        { key: 'assetCode', label: 'Code élément', text: true },
        { key: 'entryDate', label: 'Date d’entrée', text: true },
        { key: 'depreciationRate', label: 'Taux d’Amort.', text: true },
        { key: 'assetName', label: 'Intitulé élément', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-inventory-sheets', title: 'Fiche d’immobilisation', kind: 'card',
      filters: ['accounts', 'elements'], groupBy: 'none', showColumns: false,
      columns: [
        { key: 'assetCode', label: 'Code élément', text: true },
        { key: 'assetName', label: 'Intitulé élément', text: true },
        { key: 'assetType', label: 'Nature', text: true },
        { key: 'status', label: 'État', text: true },
        { key: 'accountCode', label: 'Compte d’immobilisation', text: true },
        { key: 'accumulatedDepreciationAccountCode', label: 'Compte d’amortissement cumulé', text: true },
        { key: 'depreciationExpenseAccountCode', label: 'Compte de dotation', text: true },
        { key: 'entryDate', label: 'Date d’entrée', text: true },
        { key: 'commissioningDate', label: 'Date de mise en service', text: true },
        { key: 'depreciationStartDate', label: 'Début d’amortissement enregistré', text: true },
        { key: 'grossValue', label: 'Coût d’acquisition enregistré', text: false },
        { key: 'residualValue', label: 'Valeur résiduelle saisie', text: false },
        { key: 'depreciationMethod', label: 'Méthode enregistrée', text: true },
        { key: 'usefulLifeMonths', label: 'Durée saisie (mois)', text: true },
        { key: 'depreciationRate', label: 'Taux annuel saisi', text: true },
        { key: 'unitOfProductionTotal', label: 'Total d’unités d’œuvre enregistré', text: true },
        { key: 'unitOfProductionUnit', label: 'Unité d’œuvre', text: true },
        { key: 'location', label: 'Localisation enregistrée', text: true },
        { key: 'manufacturer', label: 'Fabricant', text: true },
        { key: 'model', label: 'Modèle', text: true },
        { key: 'serialNumber', label: 'N° série / châssis', text: true },
        { key: 'vendor', label: 'Fournisseur', text: true },
        { key: 'invoiceReference', label: 'Référence de facture', text: true },
        { key: 'custodian', label: 'Responsable / détenteur', text: true },
        { key: 'warrantyEndDate', label: 'Fin de garantie', text: true },
        { key: 'lastInventoryDate', label: 'Dernier inventaire', text: true },
        { key: 'description', label: 'Description', text: true },
        { key: 'notes', label: 'Notes', text: true }
      ]
    },
    {
      id: 'edition-fixed-asset-ledger', title: 'Grand-livre des éléments immobilisés', kind: 'ledger',
      filters: ['accounts', 'elements', 'from', 'to'], groupBy: 'asset', showColumns: true,
      columns: [
        { key: 'journal', label: 'Journal', text: true },
        { key: 'piece', label: 'Pièce', text: true },
        { key: 'depreciation', label: 'Amortissement', text: false },
        { key: 'date', label: 'Date', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false },
        { key: 'netValue', label: 'Valeur nette', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-transfers', title: 'Virements des éléments immobilisés', kind: 'transfers',
      filters: ['accounts'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'assetCode', label: 'Élément', text: true },
        { key: 'depreciation', label: 'Amortissements', text: false },
        { key: 'assetName', label: 'Intitulé', text: true },
        { key: 'netValue', label: 'Valeur nette', text: false },
        { key: 'entryDate', label: 'Date d’entrée', text: true },
        { key: 'destinationAccount', label: 'Compte de destination', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-locations-inventory', title: 'Immobilisations par localisations', kind: 'locations',
      filters: ['locations', 'accounts', 'date'], groupBy: 'location', showColumns: true,
      columns: [
        { key: 'entryDate', label: 'Date d’entrée', text: true },
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'assetCode', label: 'Code élément', text: true },
        { key: 'assetName', label: 'Intitulé élément', text: true },
        { key: 'materialCode', label: 'Code matériel', text: true },
        { key: 'depreciationRate', label: 'Taux d’amortissement', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false },
        { key: 'depreciation', label: 'Amortissements', text: false },
        { key: 'netValue', label: 'Valeur nette', text: false },
        { key: 'status', label: 'État', text: true },
        { key: 'description', label: 'Description', text: true }
      ]
    },
    {
      id: 'edition-fixed-asset-opening-discrepancies', title: 'Écarts à l’ouverture avec la comptabilité générale', kind: 'opening-discrepancies',
      filters: ['accounts'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'accountLabel', label: 'Intitulé', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false },
        { key: 'depreciation', label: 'Amortissements', text: false },
        { key: 'discrepancy', label: 'Écarts', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-exits', title: 'Sorties des éléments immobilisés', kind: 'exits',
      filters: ['accounts', 'from', 'to'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'assetCode', label: 'Code élément', text: true },
        { key: 'depreciation', label: 'Amortissements', text: false },
        { key: 'assetName', label: 'Intitulé élément', text: true },
        { key: 'exitDateAndValue', label: 'Date et valeur de sortie', text: true },
        { key: 'entryDateAndValue', label: 'Date et valeur d’entrée', text: true }
      ]
    },
    {
      id: 'edition-fixed-asset-account-totals', title: 'Cumul des éléments immobilisés', kind: 'account-totals',
      filters: ['accounts', 'date'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'accountCode', label: 'Code du compte', text: true },
        { key: 'count', label: 'Nombre d’éléments', text: false },
        { key: 'depreciation', label: 'Amortissement', text: false },
        { key: 'accountLabel', label: 'Intitulé du compte', text: true },
        { key: 'grossValue', label: 'Valeur brute', text: false },
        { key: 'netValue', label: 'Valeur nette', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-period-discrepancies', title: 'Écarts de la période entre Comptabilité et Tableau des immobilisations', kind: 'period-discrepancies',
      filters: ['accounts', 'date'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'depreciation', label: 'Amortissements', text: false },
        { key: 'grossValue', label: 'Valeur brute', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-entry-discrepancies', title: 'Écarts sur les entrées entre Comptabilité et Tableau des Immobilisations', kind: 'entry-discrepancies',
      filters: ['accounts', 'date'], filterLabels: { date: 'Jusqu’au' }, groupBy: 'none', showColumns: true,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'registeredAmounts', label: 'Montants enregistrés', text: false },
        { key: 'discrepancy', label: 'Écart', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-exit-discrepancies', title: 'Écarts sur les sorties entre Comptabilité et Tableau des Immobilisations', kind: 'exit-discrepancies',
      filters: ['accounts', 'date'], filterLabels: { date: 'Jusqu’au' }, groupBy: 'none', showColumns: true,
      columns: [
        { key: 'date', label: 'Date', text: true },
        { key: 'registeredAmounts', label: 'Montants enregistrés', text: false },
        { key: 'discrepancy', label: 'Écart', text: false }
      ]
    },
    {
      id: 'edition-fixed-asset-other-anomalies', title: 'Anomalies sur les éléments immobilisés', kind: 'other-anomalies',
      filters: ['accounts', 'elements'], groupBy: 'none', showColumns: true,
      columns: [
        { key: 'accountCode', label: 'Compte', text: true },
        { key: 'assetCode', label: 'Élément', text: true },
        { key: 'journal', label: 'Journal', text: true },
        { key: 'date', label: 'Date', text: true },
        { key: 'anomaly', label: 'Anomalie', text: true }
      ]
    }
  ];
  var REPORT_BY_ID = Object.create(null);
  REPORTS.forEach(function (report) { REPORT_BY_ID[report.id] = report; });
  var REPORT_IDS = REPORTS.map(function (report) { return report.id; });

  function isIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase('fr');
  }

  function parseCodeFilter(value, label) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw) return { valid: false, all: false, tokens: [], error: 'Indiquez un filtre pour ' + label + ' ou utilisez « * ».' };
    var parts = raw.split(/[;,]+/).map(function (part) { return normalizeCode(part); }).filter(Boolean);
    if (parts.indexOf('*') !== -1) return { valid: true, all: true, tokens: ['*'], error: '' };
    if (!parts.length || parts.some(function (part) { return !/^[A-Z0-9][A-Z0-9._/-]*\*?$/.test(part) || (part.indexOf('*') !== -1 && part.charAt(part.length - 1) !== '*'); })) {
      return { valid: false, all: false, tokens: [], error: 'Le filtre ' + label + ' doit contenir des codes ou des préfixes terminés par *.' };
    }
    return { valid: true, all: false, tokens: parts, error: '' };
  }

  function codeMatches(value, filter) {
    var code = normalizeCode(value);
    if (!filter || !filter.valid || !code) return false;
    if (filter.all) return true;
    return filter.tokens.some(function (token) {
      return token.charAt(token.length - 1) === '*'
        ? code.indexOf(token.slice(0, -1)) === 0
        : code === token;
    });
  }

  function explicitRate(asset) {
    if (!asset || asset.annualRatePercent == null || asset.annualRatePercent === '') return '';
    var value = Number(asset.annualRatePercent);
    if (!Number.isFinite(value) || value <= 0 || value > 100) return '';
    return String(asset.annualRatePercent) + ' %';
  }

  function explicitAmount(value) {
    if (value == null || value === '') return null;
    var amount = Number(value);
    return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
  }

  function assetTypeLabel(value) {
    return ({ corporelle: 'Corporelle', incorporelle: 'Incorporelle', financiere: 'Financière' })[String(value || '')] || String(value || '');
  }

  function assetStatusLabel(value) {
    return ({ 'en-service': 'En service', 'en-cours': 'En cours', retiree: 'Retirée' })[String(value || '')] || String(value || '');
  }

  function depreciationMethodLabel(value) {
    return ({ 'a-definir': 'À définir', lineaire: 'Linéaire', degressif: 'Dégressif', 'unites-oeuvre': 'Unités d’œuvre', aucun: 'Non amortissable' })[String(value || '')] || String(value || '');
  }

  function baseResult(definition, options, errors, warnings, accountFilter, elementFilter, locationFilter, from, to, date) {
    return {
      ok: !errors.length,
      reportId: definition ? definition.id : String(options.reportId || ''),
      title: definition ? definition.title : 'État des immobilisations',
      kind: definition ? definition.kind : '',
      errors: errors.slice(),
      warnings: warnings.slice(),
      cycleStart: String(options.cycleStart || ''),
      cycleEnd: String(options.cycleEnd || ''),
      from: from || '',
      to: to || '',
      date: date || '',
      accountFilter: accountFilter || null,
      elementFilter: elementFilter || null,
      locationFilter: locationFilter || null,
      columns: definition ? definition.columns.map(function (column) { return Object.assign({ defaultSelected: true }, column); }) : [],
      filters: definition ? definition.filters.slice() : [],
      showColumns: definition ? definition.showColumns !== false : false,
      groupBy: definition ? definition.groupBy : 'none',
      rows: [],
      displayAccounts: [],
      displayLocations: [],
      displayElements: [],
      dataAvailable: false,
      generatedLineCount: 0,
      totals: null,
      basis: {
        fixedAssetRegisterOnly: true,
        accountFilterIncludesCurrentAndFutureCodes: true,
        movementsAvailable: false,
        disposalDatesAvailable: false,
        perAssetDepreciationSourceAvailable: false,
        perAssetNetValueSourceAvailable: false,
        noMaterialCodeFromSerialNumber: true,
        noUnlinkedLedgerLineAssigned: true,
        noUnsupportedAmountsOrDiscrepanciesCalculated: true,
        noAccountingMutation: true
      }
    };
  }

  function definitionFor(reportId) {
    var definition = REPORT_BY_ID[String(reportId || '')];
    if (!definition) return null;
    return {
      id: definition.id,
      title: definition.title,
      kind: definition.kind,
      filters: definition.filters.slice(),
      filterLabels: Object.assign({}, definition.filterLabels || {}),
      columns: definition.columns.map(function (column) { return Object.assign({ defaultSelected: true }, column); }),
      groupBy: definition.groupBy,
      showColumns: definition.showColumns !== false
    };
  }

  function buildReport(reportId, options) {
    options = options || {};
    var definition = REPORT_BY_ID[String(reportId || '')];
    if (!definition) {
      return { ok: false, reportId: String(reportId || ''), title: 'État des immobilisations', errors: ['État des immobilisations inconnu.'], warnings: [], rows: [], displayAccounts: [], displayLocations: [], generatedLineCount: 0, totals: null, basis: { noAccountingMutation: true } };
    }
    var errors = [];
    var warnings = [];
    var cycleStart = String(options.cycleStart || '');
    var cycleEnd = String(options.cycleEnd || '');
    if (!isIsoDate(cycleStart) || !isIsoDate(cycleEnd) || cycleStart > cycleEnd) errors.push('Le cycle du dossier n’est pas défini correctement.');
    if (!GeneralBalanceReport || !GeneralBalanceReport.parseAccountFilter || !GeneralBalanceReport.accountMatches) errors.push('Le sélecteur de comptes n’est pas disponible.');

    var accountFilter = GeneralBalanceReport && GeneralBalanceReport.parseAccountFilter
      ? GeneralBalanceReport.parseAccountFilter(definition.filters.indexOf('accounts') === -1 ? '*' : (options.accountFilter == null ? '*' : options.accountFilter))
      : null;
    if (accountFilter && !accountFilter.valid) errors.push(accountFilter.error);
    var elementFilter = definition.filters.indexOf('elements') !== -1 ? parseCodeFilter(options.elementFilter == null ? '*' : options.elementFilter, 'Éléments') : null;
    if (elementFilter && !elementFilter.valid) errors.push(elementFilter.error);
    var locationFilter = definition.filters.indexOf('locations') !== -1 ? parseCodeFilter(options.locationFilter == null ? '*' : options.locationFilter, 'Localisations') : null;
    if (locationFilter && !locationFilter.valid) errors.push(locationFilter.error);

    var from = options.from == null ? cycleStart : String(options.from);
    var to = options.to == null ? cycleEnd : String(options.to);
    var date = options.date == null ? cycleEnd : String(options.date);
    if (definition.filters.indexOf('from') !== -1 || definition.filters.indexOf('to') !== -1) {
      if (!isIsoDate(from) || !isIsoDate(to)) errors.push('Renseignez des dates valides pour la période.');
      else if (from > to) errors.push('La date de début doit précéder ou égaler la date de fin.');
      else if (from < cycleStart || to > cycleEnd) errors.push('La période doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (definition.filters.indexOf('date') !== -1) {
      if (!isIsoDate(date)) errors.push('Indiquez une date d’arrêté valide.');
      else if (date < cycleStart || date > cycleEnd) errors.push('La date d’arrêté doit rester dans le cycle du dossier (' + cycleStart + ' — ' + cycleEnd + ').');
    }
    if (Array.isArray(options.sourceErrors) && options.sourceErrors.length) errors.push.apply(errors, options.sourceErrors.map(String));
    if (errors.length) return baseResult(definition, options, errors, warnings, accountFilter, elementFilter, locationFilter, from, to, date);

    var accounts = Array.isArray(options.accounts) ? options.accounts : [];
    var assets = Array.isArray(options.assets) ? options.assets : [];
    var locations = Array.isArray(options.locations) ? options.locations : [];
    var entries = Array.isArray(options.entries) ? options.entries : [];
    var accountsByCode = Object.create(null);
    var locationsById = Object.create(null);
    var assetsById = Object.create(null);
    var assetsByCode = Object.create(null);
    var duplicateAssetCodes = Object.create(null);
    accounts.forEach(function (account) { if (account && account.code != null) accountsByCode[String(account.code)] = account; });
    locations.forEach(function (location) { if (location && location.id) locationsById[String(location.id)] = location; });
    assets.forEach(function (asset) {
      if (!asset || typeof asset !== 'object') return;
      if (asset.id) assetsById[String(asset.id)] = asset;
      if (asset.code) {
        var normalizedAssetCode = normalizeCode(asset.code);
        if (assetsByCode[normalizedAssetCode]) duplicateAssetCodes[normalizedAssetCode] = true;
        else assetsByCode[normalizedAssetCode] = asset;
      }
    });

    function accountIncluded(asset) {
      var code = String(asset && asset.assetAccountCode || '');
      return !!code && (!accountFilter || GeneralBalanceReport.accountMatches(code, accountFilter));
    }
    function elementsIncluded(asset) {
      return !elementFilter || codeMatches(asset && asset.code, elementFilter);
    }
    function selectedAssets() {
      return assets.filter(function (asset) { return asset && accountIncluded(asset) && elementsIncluded(asset); });
    }
    function accountDetails(code) {
      var account = accountsByCode[String(code || '')];
      return { code: String(code || ''), label: account ? String(account.label || '') : '' };
    }
    function makeAssetRow(asset) {
      var account = accountDetails(asset.assetAccountCode);
      var amount = explicitAmount(asset.grossCost);
      return {
        assetId: String(asset.id || ''),
        assetCode: String(asset.code || ''),
        assetName: String(asset.name || ''),
        accountCode: account.code,
        accountLabel: account.label,
        assetType: assetTypeLabel(asset.assetType),
        status: assetStatusLabel(asset.status),
        entryDate: String(asset.acquisitionDate || ''),
        entryDateValid: isIsoDate(asset.acquisitionDate),
        commissioningDate: String(asset.commissioningDate || ''),
        depreciationStartDate: String(asset.depreciationStartDate || ''),
        accumulatedDepreciationAccountCode: String(asset.accumulatedDepreciationAccountCode || ''),
        depreciationExpenseAccountCode: String(asset.depreciationExpenseAccountCode || ''),
        unitOfProductionTotal: asset.unitOfProductionTotal == null || asset.unitOfProductionTotal === 0 ? '' : String(asset.unitOfProductionTotal),
        unitOfProductionUnit: String(asset.unitOfProductionUnit || ''),
        grossValue: amount == null ? '' : amount,
        depreciation: '',
        netValue: '',
        depreciationRate: explicitRate(asset),
        depreciationMethod: depreciationMethodLabel(asset.depreciationMethod),
        usefulLifeMonths: asset.usefulLifeMonths == null || asset.usefulLifeMonths === 0 ? '' : String(asset.usefulLifeMonths),
        residualValue: explicitAmount(asset.residualValue) == null ? '' : explicitAmount(asset.residualValue),
        locationId: locationsById[String(asset.locationId || '')] ? String(asset.locationId || '') : '',
        locationCode: locationsById[String(asset.locationId || '')] ? String(locationsById[String(asset.locationId)].code || '') : '',
        locationLabel: locationsById[String(asset.locationId || '')] ? String(locationsById[String(asset.locationId)].name || '') : '',
        description: String(asset.description || ''),
        manufacturer: String(asset.manufacturer || ''),
        model: String(asset.model || ''),
        serialNumber: String(asset.serialNumber || ''),
        vendor: String(asset.vendor || ''),
        invoiceReference: String(asset.invoiceReference || ''),
        custodian: String(asset.custodian || ''),
        warrantyEndDate: String(asset.warrantyEndDate || ''),
        lastInventoryDate: String(asset.lastInventoryDate || ''),
        notes: String(asset.notes || '')
      };
    }

    var rows = [];
    var invalidDates = 0;
    var missingGrossValues = 0;
    var missingResidualValues = 0;
    var unlocatedAssets = 0;
    var retiredAssetsWithoutExitDate = 0;
    var explicitLedgerLinks = 0;
    var unlinkedLedgerReferences = 0;
    var seenLedgerRows = Object.create(null);
    var candidates = selectedAssets();

    if (definition.kind === 'entries') {
      candidates.forEach(function (asset) {
        var entryDate = String(asset.acquisitionDate || '');
        if (!isIsoDate(entryDate)) { invalidDates += 1; return; }
        if (entryDate < from || entryDate > to) return;
        var row = makeAssetRow(asset);
        if (row.grossValue === '') missingGrossValues += 1;
        rows.push(row);
      });
      rows.sort(function (left, right) { return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) || left.entryDate.localeCompare(right.entryDate) || left.assetCode.localeCompare(right.assetCode, 'fr', { numeric: true }); });
      warnings.push('Les entrées sont sélectionnées par la date d’acquisition enregistrée. La Valeur brute reprend le coût saisi ; aucun amortissement ou solde n’est calculé.');
    } else if (definition.kind === 'card') {
      rows = candidates.map(makeAssetRow).sort(function (left, right) { return left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) || left.assetCode.localeCompare(right.assetCode, 'fr', { numeric: true }); });
      rows.forEach(function (row) {
        var sourceAsset = assetsById[row.assetId];
        if (row.grossValue === '') missingGrossValues += 1;
        if (sourceAsset && explicitAmount(sourceAsset.residualValue) == null) missingResidualValues += 1;
      });
      warnings.push('La fiche restitue les champs présents au registre. La valeur résiduelle saisie est conservée sous ce nom et n’est pas assimilée à une valeur nette comptable.');
      warnings.push('Le numéro de série / châssis reste identifié comme tel ; il n’est pas transformé en Code matériel. Aucun montant calculé n’est ajouté.');
    } else if (definition.kind === 'ledger') {
      function resolveExplicitAsset(referenceId, referenceCode) {
        var byId = referenceId ? assetsById[referenceId] || null : null;
        var byCode = referenceCode && !duplicateAssetCodes[referenceCode] ? assetsByCode[referenceCode] || null : null;
        if (referenceId && referenceCode) return byId && byCode && String(byId.id) === String(byCode.id) ? byId : null;
        return byId || byCode;
      }
      function appendLedgerRow(entry, asset, dateValue, lineIndex) {
        var entryKey = String(entry.id || [dateValue, entry.journal || '', entry.reference || ''].join('|'));
        var key = entryKey + '|' + String(asset.id || asset.code || '');
        if (seenLedgerRows[key]) return;
        seenLedgerRows[key] = true;
        explicitLedgerLinks += 1;
        rows.push({
          assetId: String(asset.id || ''), assetCode: String(asset.code || ''), assetName: String(asset.name || ''),
          accountCode: String(asset.assetAccountCode || ''), accountLabel: accountDetails(asset.assetAccountCode).label,
          journal: String(entry.journal || ''), piece: String(entry.reference || ''), date: dateValue,
          grossValue: '', depreciation: '', netValue: '', entryLineId: entryKey + ':' + lineIndex
        });
      }
      entries.forEach(function (entry) {
        if (!entry || entry.status !== 'posted' || !Array.isArray(entry.lines)) return;
        var dateValue = String(entry.date || '');
        var entryReferenceId = String(entry.fixedAssetId || '');
        var entryReferenceCode = normalizeCode(entry.fixedAssetCode || '');
        var hasEntryReference = !!(entryReferenceId || entryReferenceCode);
        var hasLineReference = entry.lines.some(function (line) { return !!(line && (line.fixedAssetId || line.fixedAssetCode)); });
        if (!isIsoDate(dateValue)) { if (hasEntryReference || hasLineReference) invalidDates += 1; return; }
        if (dateValue < from || dateValue > to) return;
        var explicitLineReferenceCount = 0;
        entry.lines.forEach(function (line, lineIndex) {
          if (!line || typeof line !== 'object') return;
          var referenceId = String(line.fixedAssetId || '');
          var referenceCode = normalizeCode(line.fixedAssetCode || '');
          if (!referenceId && !referenceCode) return;
          explicitLineReferenceCount += 1;
          var asset = resolveExplicitAsset(referenceId, referenceCode);
          if (!asset || !accountIncluded(asset) || !elementsIncluded(asset)) { unlinkedLedgerReferences += 1; return; }
          appendLedgerRow(entry, asset, dateValue, lineIndex);
        });
        if (!explicitLineReferenceCount && hasEntryReference) {
          var entryAsset = resolveExplicitAsset(entryReferenceId, entryReferenceCode);
          if (!entryAsset || !accountIncluded(entryAsset) || !elementsIncluded(entryAsset)) { unlinkedLedgerReferences += 1; return; }
          appendLedgerRow(entry, entryAsset, dateValue, 'piece');
        }
      });
      rows.sort(function (left, right) { return left.assetCode.localeCompare(right.assetCode, 'fr', { numeric: true }) || left.date.localeCompare(right.date) || left.journal.localeCompare(right.journal) || left.piece.localeCompare(right.piece); });
      warnings.push('Le grand-livre ne retient que les lignes validées portant un identifiant ou code d’immobilisation explicite. Une référence de pièce seule produit au plus une ligne par pièce ; les montants brute, nette et d’amortissement restent vides faute de ventilation par fiche vérifiable.');
      if (!explicitLedgerLinks) warnings.push('Aucune ligne validée explicitement liée à un élément immobilisé de cette sélection n’est disponible.');
      if (unlinkedLedgerReferences) warnings.push(unlinkedLedgerReferences + ' ligne(s) portant une référence explicite ambiguë, absente du registre ou exclue par les filtres ont été écartées.');
    } else if (definition.kind === 'locations') {
      candidates.forEach(function (asset) {
        var entryDate = String(asset.acquisitionDate || '');
        if (!isIsoDate(entryDate)) { invalidDates += 1; return; }
        if (entryDate > date) return;
        if (asset.status === 'retiree') retiredAssetsWithoutExitDate += 1;
        var location = locationsById[String(asset.locationId || '')] || null;
        if (locationFilter && !locationFilter.all && (!location || !codeMatches(location.code, locationFilter))) return;
        if (!location) unlocatedAssets += 1;
        var row = makeAssetRow(asset);
        if (row.grossValue === '') missingGrossValues += 1;
        rows.push(row);
      });
      rows.sort(function (left, right) {
        var leftUnlocated = left.locationId ? 0 : 1;
        var rightUnlocated = right.locationId ? 0 : 1;
        return leftUnlocated - rightUnlocated || left.locationLabel.localeCompare(right.locationLabel, 'fr') || left.locationCode.localeCompare(right.locationCode, 'fr', { numeric: true }) || left.accountCode.localeCompare(right.accountCode, 'fr', { numeric: true }) || left.assetCode.localeCompare(right.assetCode, 'fr', { numeric: true });
      });
      warnings.push('Les fiches sont rattachées uniquement par l’identifiant de localisation enregistré. Les biens sans localisation restent signalés séparément. Amortissements/VNC restent vides faute de valeurs par élément.');
    } else if (definition.kind === 'account-totals') {
      var accountGroups = Object.create(null);
      candidates.forEach(function (asset) {
        var entryDate = String(asset.acquisitionDate || '');
        if (!isIsoDate(entryDate)) { invalidDates += 1; return; }
        if (entryDate > date) return;
        if (asset.status === 'retiree') retiredAssetsWithoutExitDate += 1;
        var code = String(asset.assetAccountCode || '');
        if (!accountGroups[code]) {
          var details = accountDetails(code);
          accountGroups[code] = { accountCode: code, accountLabel: details.label, count: 0, grossValue: 0, grossValueComplete: true };
        }
        var group = accountGroups[code];
        group.count += 1;
        var gross = explicitAmount(asset.grossCost);
        if (gross == null || !Number.isSafeInteger(group.grossValue + gross)) group.grossValueComplete = false;
        else group.grossValue += gross;
      });
      rows = Object.keys(accountGroups).sort(function (left, right) { return left.localeCompare(right, 'fr', { numeric: true }); }).map(function (code) {
        var group = accountGroups[code];
        return { accountCode: code, accountLabel: group.accountLabel, count: group.count, grossValue: group.grossValueComplete ? group.grossValue : '', depreciation: '', netValue: '' };
      });
      if (rows.some(function (row) { return row.grossValue === ''; })) missingGrossValues = 1;
      warnings.push('Nombre d’éléments = nombre de fiches du registre par compte ; Valeur brute = somme des coûts d’acquisition enregistrés. Amortissement et Valeur nette ne sont ni disponibles ni calculés.');
    } else if (definition.kind === 'transfers') {
      warnings.push('Le registre ne contient pas d’historique explicite de virements internes par immobilisation ; aucune ligne ni valeur de transfert n’est inventée.');
    } else if (definition.kind === 'exits') {
      warnings.push('Aucun registre de sorties ni aucune date/valeur de cession par élément n’est disponible ; un statut « retirée » ne permet pas d’affecter une sortie à la période. Aucune ligne de sortie n’est simulée.');
    } else if (definition.kind === 'opening-discrepancies') {
      warnings.push('Les soldes d’ouverture comptables ne sont pas rapprochés fiche par fiche avec des coûts et amortissements d’ouverture. Aucun écart n’est attribué à un élément ou compte.');
    } else if (definition.kind === 'period-discrepancies') {
      warnings.push('Le registre ne fournit pas de mouvements de la période associés aux écritures validées ; aucune comparaison ni aucun écart n’est calculé.');
    } else if (definition.kind === 'entry-discrepancies') {
      warnings.push('Aucune source ne rapproche les dates et montants d’entrée du registre avec les écritures comptables. Les colonnes Montants enregistrés et Écart restent vides ; aucun écart n’est calculé.');
    } else if (definition.kind === 'exit-discrepancies') {
      warnings.push('Aucun registre de sorties et aucun rapprochement explicite avec les écritures comptables ne sont disponibles. Les colonnes Montants enregistrés et Écart restent vides ; aucune sortie n’est déduite du statut d’une fiche.');
    } else if (definition.kind === 'other-anomalies') {
      warnings.push('Les critères d’anomalie ne sont pas définis par le registre. Aucune ligne n’est qualifiée d’anormale sans règle explicite ; les écritures et anomalies restent vides.');
    }

    if (definition.kind !== 'entries' && definition.kind !== 'ledger' && definition.kind !== 'locations' && definition.kind !== 'account-totals' && definition.kind !== 'transfers' && definition.kind !== 'exits' && definition.kind !== 'opening-discrepancies' && definition.kind !== 'period-discrepancies' && definition.kind !== 'entry-discrepancies' && definition.kind !== 'exit-discrepancies' && definition.kind !== 'other-anomalies' && definition.kind !== 'card') {
      warnings.push('Aucune source métier spécifique n’est disponible pour cet état ; aucune ligne n’est générée.');
    }
    if (invalidDates) warnings.push(invalidDates + ' fiche(s) ou écriture(s) avec date absente/invalide n’ont pas pu être classées dans la période.');
    if (missingGrossValues) warnings.push('Au moins une fiche n’a pas de coût d’acquisition valide ; la valeur brute correspondante ou le cumul du compte reste vide.');
    if (missingResidualValues) warnings.push(missingResidualValues + ' fiche(s) n’ont pas de valeur résiduelle enregistrée valide ; le champ de la fiche reste vide.');
    if (unlocatedAssets) warnings.push(unlocatedAssets + ' fiche(s) sans localisation enregistrée sont conservées sous « Localisation non renseignée ».');
    if (retiredAssetsWithoutExitDate) warnings.push(retiredAssetsWithoutExitDate + ' fiche(s) marquée(s) « Retirée » restent prises en compte à la date choisie, car aucune date de sortie ne permet de savoir quand leur effet commence.');

    var report = baseResult(definition, options, [], warnings, accountFilter, elementFilter, locationFilter, from, to, date);
    report.ok = true;
    report.rows = rows;
    report.generatedLineCount = rows.length;
    report.dataAvailable = rows.length > 0;
    report.basis.cycleStart = cycleStart;
    report.basis.cycleEnd = cycleEnd;
    report.basis.selectedFrom = definition.filters.indexOf('from') !== -1 ? from : '';
    report.basis.selectedTo = definition.filters.indexOf('to') !== -1 ? to : '';
    report.basis.selectedDate = definition.filters.indexOf('date') !== -1 ? date : '';
    report.basis.registeredAssetsRead = assets.length;
    report.basis.registeredLocationsRead = locations.length;
    report.basis.postedEntriesRead = entries.length;
    report.basis.explicitLedgerLinksRead = explicitLedgerLinks;
    report.basis.noAccountingMutation = true;

    var accountCodes = Object.create(null);
    var locationCodes = Object.create(null);
    var elementCodes = Object.create(null);
    rows.forEach(function (row) {
      if (row.accountCode) accountCodes[row.accountCode] = row.accountLabel || '';
      if (row.locationId) locationCodes[row.locationId] = { code: row.locationCode || '', label: row.locationLabel || '' };
      if (row.assetCode) elementCodes[row.assetCode] = row.assetName || '';
    });
    report.displayAccounts = Object.keys(accountCodes).map(function (code) { return { code: code, label: accountCodes[code] }; }).sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });
    report.displayLocations = Object.keys(locationCodes).map(function (id) { return { id: id, code: locationCodes[id].code, label: locationCodes[id].label }; }).sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });
    report.displayElements = Object.keys(elementCodes).map(function (code) { return { code: code, label: elementCodes[code] }; }).sort(function (left, right) { return left.code.localeCompare(right.code, 'fr', { numeric: true }); });
    report.totals = null;
    return report;
  }

  return Object.freeze({
    REPORT_IDS: REPORT_IDS.slice(),
    definitions: REPORTS.map(function (definition) { return definitionFor(definition.id); }),
    definitionFor: definitionFor,
    buildReport: buildReport,
    parseCodeFilter: parseCodeFilter,
    codeMatches: codeMatches,
    isIsoDate: isIsoDate,
    explicitRate: explicitRate,
    explicitAmount: explicitAmount
  });
});
