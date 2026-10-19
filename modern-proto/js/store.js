/* =========================================================================
   PERFECTO · Couche de données locale
   Aucun backend, aucun Blazor : données persistées dans localStorage.
   Règles métier du Lot 1 (plan comptable, journaux, pièces, périodes).
   ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'perfecto.lot1.v1';
  var BACKUP_STORAGE_KEY = 'perfecto.lot1.backup.v1';
  var DOSSIERS_STORAGE_KEY = 'perfecto.dossiers.v1';
  var LEGACY_FOLDERS_STORAGE_KEY = 'perfecto.folders.v1';
  var ACTIVE_DOSSIER_STORAGE_KEY = 'perfecto.activeDossier.v1';
  var LEGACY_ACTIVE_FOLDER_STORAGE_KEY = 'perfecto.activeFolder.v1';
  var CORRUPT_RECOVERY_SUFFIX = '.recovery.raw.v1';
  var DEFAULT_FOLDER_ID = 'folder-main';
  var DEFAULT_FOLDER_NAME = 'Entreprise de démonstration';
  var DEFAULT_ACCOUNTING_TYPE = 'Comptabilité révisée SYSCOHADA';
  var DEFAULT_ACCOUNTING_TYPE_CODE = 'COR';
  var EXERCICE = 2026;

  var JOURNAUX = [
    { code: 'ACH', label: 'Achats', type: 'Achat', referencePrefix: 'ACH', legacyCodes: ['AC'], legacyLabels: ['Journal des achats'] },
    { code: 'VTE', label: 'Ventes', type: 'Vente', referencePrefix: 'VTE', legacyCodes: ['VE'], legacyLabels: ['Journal des ventes'] },
    { code: 'BQ', label: 'Banques', type: 'Trésorerie', referencePrefix: 'BQ', legacyLabels: ['Journal de banque'] },
    { code: 'CA', label: 'Caisse', type: 'Trésorerie', referencePrefix: 'CA', legacyLabels: ['Journal de caisse'] },
    { code: 'OD', label: 'Opérations diverses', type: 'Divers', referencePrefix: 'OD' },
    { code: 'PA', label: 'Paie', type: 'Paie', referencePrefix: 'PA', legacyLabels: ['Journal de paie'] },
    { code: 'ABO', label: 'Abonnements', type: 'Abonnement', operationNature: 'Abonnements', referencePrefix: 'ABO', legacyLabels: ['Journal abonnements'], description: 'Journal spécialisé des abonnements de charges ou de produits. Les schémas de répartition et d’anticipation restent à construire ; aucune écriture n’est générée automatiquement.' },
    { code: 'CEN', label: 'Centralisations', type: 'Centralisation', operationNature: 'Centralisation', referencePrefix: 'CEN', legacyLabels: ['Journal des Centralisations'], description: 'Journal spécialisé des centralisations comptables entre dossiers PERFECTO. Le transfert, les tableaux de passage et les contrôles de cohérence restent à construire.' }
  ];
  var RETIRED_JOURNAL_CODES = ['RAN', 'AC', 'VE'];
  var JOURNAL_OPERATION_NATURES = [
    'Opérations courantes', 'Amortissements automatiques', 'Abonnements', 'Centralisation',
    'Résultat de l’exercice', 'Inventaire', 'Immobilisations', 'Caisse en temps réel'
  ];
  var SYSTEM_JOURNAUX = [
    { code: 'AMO', label: 'Amortissements automatiques', type: 'Automatique', operationNature: 'Amortissements automatiques', referencePrefix: 'AMO', systemKey: 'fixed-asset-depreciation', systemSource: 'PERFECTO-IMMOBILISATIONS-AMORTISSEMENT', description: 'Réservé aux opérations générées par le système d’immobilisations ; aucune saisie manuelle.' },
    { code: 'RPE', label: 'Résultat de la période', type: 'Automatique', operationNature: 'Résultat de l’exercice', referencePrefix: 'RPE', systemKey: 'period-result', systemSource: 'PERFECTO-RESULTAT-PERIODE', description: 'Réservé au traitement interne du résultat de la période ; règles et génération à construire.' }
  ];

  var ACCOUNTING_CHART = global.PerfectoAccountingChart || null;
  var ACCOUNTING_CHART_VERSION = ACCOUNTING_CHART ? ACCOUNTING_CHART.VERSION : 0;
  var JOURNAL_REGISTRY_VERSION = 5;
  var SUPPLIER_REGISTRY_VERSION = 2;
  var CLIENT_REGISTRY_VERSION = 1;
  var SERVICE_REGISTRY_VERSION = 1;
  var OTHER_PARTY_REGISTRY_VERSION = 1;
  var PERSONNEL_REGISTRY_VERSION = 1;
  var FIXED_ASSET_LOCATION_REGISTRY_VERSION = 1;
  var FIXED_ASSET_REGISTRY_VERSION = 1;
  var ANALYTICAL_CENTER_REGISTRY_VERSION = 1;
  var RECONCILIATION_REGISTRY_VERSION = 1;
  var LEGACY_COMPTES = [
    { code: '101200', label: 'Capital social', cls: 1, nature: 'Passif', aux: false },
    { code: '162100', label: 'Emprunt bancaire', cls: 1, nature: 'Passif', aux: false },
    { code: '231000', label: 'Bâtiments', cls: 2, nature: 'Actif', aux: false },
    { code: '241000', label: 'Matériel et outillage', cls: 2, nature: 'Actif', aux: false },
    { code: '244100', label: 'Matériel informatique', cls: 2, nature: 'Actif', aux: false },
    { code: '401100', label: 'Fournisseurs', cls: 4, nature: 'Passif', aux: true },
    { code: '411100', label: 'Clients', cls: 4, nature: 'Actif', aux: true },
    { code: '421000', label: 'Personnel — rémunérations dues', cls: 4, nature: 'Passif', aux: false },
    { code: '431100', label: 'Sécurité sociale', cls: 4, nature: 'Passif', aux: false },
    { code: '445100', label: 'TVA collectée', cls: 4, nature: 'Passif', aux: false },
    { code: '445200', label: 'TVA déductible', cls: 4, nature: 'Actif', aux: false },
    { code: '521100', label: 'Banque', cls: 5, nature: 'Actif', aux: false },
    { code: '571000', label: 'Caisse', cls: 5, nature: 'Actif', aux: false },
    { code: '601100', label: 'Achats de marchandises', cls: 6, nature: 'Charge', aux: false },
    { code: '622100', label: 'Locations et charges locatives', cls: 6, nature: 'Charge', aux: false },
    { code: '641000', label: 'Rémunérations du personnel', cls: 6, nature: 'Charge', aux: false },
    { code: '701000', label: 'Ventes de marchandises', cls: 7, nature: 'Produit', aux: false },
    { code: '706000', label: 'Prestations de services', cls: 7, nature: 'Produit', aux: false }
  ];

  function chartAccounts() {
    return ACCOUNTING_CHART ? ACCOUNTING_CHART.accounts() : [];
  }

  function legacyAccountRecord(account) {
    var cls = Number(account.cls || String(account.code).charAt(0));
    var subclass = String(account.code).slice(0, 2);
    return Object.assign({}, account, {
      cls: cls,
      classLabel: ACCOUNTING_CHART ? ACCOUNTING_CHART.classLabel(cls) : ('Classe ' + cls),
      subclass: subclass,
      subclassLabel: ACCOUNTING_CHART && ACCOUNTING_CHART.SUBCLASS_LABELS[subclass] || 'Compte historique',
      usage: 'Compte historique conservé pour assurer la continuité des écritures et dossiers existants.',
      active: true,
      postable: true,
      legacy: true,
      standard: false
    });
  }

  function initialAccounts(withSeedEntries) {
    var accounts = chartAccounts().map(function (account) {
      return Object.assign({}, account, { chartOriginCode: account.code });
    });
    if (withSeedEntries !== false) {
      accounts = accounts.concat(LEGACY_COMPTES.map(legacyAccountRecord));
    }
    return accounts;
  }

  function upgradeAccountingChart(data) {
    var result = { data: data, changed: false };
    if (!ACCOUNTING_CHART || !data || Number(data.accountChartVersion) >= ACCOUNTING_CHART_VERSION) return result;

    var current = Array.isArray(data.accounts) ? data.accounts : [];
    var currentByCode = Object.create(null);
    var chartByCode = Object.create(null);
    var legacyByCode = Object.create(null);
    var deletedStandardAccountCodes = Array.isArray(data.deletedStandardAccountCodes)
      ? data.deletedStandardAccountCodes.filter(function (code) { return typeof code === 'string'; })
      : [];
    var deletedStandardAccountMap = Object.create(null);
    deletedStandardAccountCodes.forEach(function (code) { deletedStandardAccountMap[code] = true; });
    current.forEach(function (account) {
      if (account && account.code != null) currentByCode[String(account.code)] = account;
    });
    LEGACY_COMPTES.forEach(function (account) { legacyByCode[account.code] = account; });

    var standard = chartAccounts().filter(function (account) {
      return !deletedStandardAccountMap[account.code];
    }).map(function (account) {
      var existing = currentByCode[account.code];
      chartByCode[account.code] = true;
      if (!existing) return account;
      var merged = Object.assign({}, account, existing);
      merged.code = account.code;
      merged.cls = account.cls;
      merged.classLabel = account.classLabel;
      merged.subclass = account.subclass;
      merged.subclassLabel = account.subclassLabel;
      merged.chartOriginCode = account.code;
      merged.usage = typeof existing.usage === 'string' && existing.usage ? existing.usage : account.usage;
      merged.postable = account.postable;
      merged.legacy = false;
      merged.standard = true;
      if (!merged.label) merged.label = account.label;
      if (!merged.nature) merged.nature = account.nature;
      if (typeof merged.active !== 'boolean') merged.active = true;
      return merged;
    });

    var carried = [];
    current.forEach(function (existing) {
      if (!existing || existing.code == null) return;
      var code = String(existing.code);
      if (chartByCode[code]) return;
      var oldDefault = legacyByCode[code];
      if (oldDefault) {
        var legacy = Object.assign({}, legacyAccountRecord(oldDefault), existing);
        legacy.code = code;
        legacy.cls = Number(existing.cls || oldDefault.cls || code.charAt(0));
        legacy.label = String(existing.label || oldDefault.label || code);
        legacy.classLabel = ACCOUNTING_CHART.classLabel(legacy.cls);
        legacy.subclass = code.slice(0, 2);
        legacy.subclassLabel = ACCOUNTING_CHART.SUBCLASS_LABELS[legacy.subclass] || 'Compte historique';
        legacy.usage = 'Compte historique conservé pour assurer la continuité des écritures et dossiers existants.';
        legacy.active = typeof existing.active === 'boolean' ? existing.active : true;
        legacy.postable = typeof existing.postable === 'boolean' ? existing.postable : true;
        legacy.legacy = true;
        legacy.standard = false;
        carried.push(legacy);
        return;
      }
      var custom = Object.assign({}, existing);
      custom.code = code;
      custom.cls = Number(custom.cls || code.charAt(0));
      custom.classLabel = custom.classLabel || ACCOUNTING_CHART.classLabel(custom.cls);
      custom.subclass = custom.subclass || code.slice(0, 2);
      custom.subclassLabel = custom.subclassLabel || ACCOUNTING_CHART.SUBCLASS_LABELS[custom.subclass] || 'Comptes personnalisés';
      custom.usage = custom.usage || 'Compte personnalisé du dossier.';
      if (typeof custom.active !== 'boolean') custom.active = true;
      if (typeof custom.postable !== 'boolean') custom.postable = true;
      custom.legacy = !!custom.legacy;
      custom.standard = false;
      carried.push(custom);
    });

    data = Object.assign({}, data, {
      accounts: standard.concat(carried).sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }),
      accountChartVersion: ACCOUNTING_CHART_VERSION,
      deletedStandardAccountCodes: deletedStandardAccountCodes
    });
    result.data = data;
    result.changed = true;
    return result;
  }

  function identificationPrefix(kind) {
    return { supplier: 'FOU', client: 'CLI', debtor: 'DEB', creditor: 'CRE', personnel: 'PER' }[String(kind || '').toLowerCase()] || '';
  }

  function identificationHistoryField(kind) {
    return String(kind) + 'CodeHistory';
  }

  function normalizeIdentificationCode(kind, value) {
    return identificationPrefix(kind) ? normalizeSupplierCode(value) : String(value || '').trim().toLocaleUpperCase();
  }

  function normalizeIdentificationHistory(kind, values) {
    var history = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var normalized = normalizeIdentificationCode(kind, value);
      if (normalized && history.indexOf(normalized) === -1) history.push(normalized);
    });
    return history;
  }

  function normalizeServiceCode(value) {
    return normalizeSupplierCode(value);
  }

  function normalizeServiceCodeHistory(values) {
    var history = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var code = normalizeServiceCode(value);
      if (code && history.indexOf(code) === -1) history.push(code);
    });
    return history;
  }

  function normalizeAnalyticalCenterCode(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
  }

  function normalizeAnalyticalCenterCodeHistory(values) {
    var history = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      var code = normalizeAnalyticalCenterCode(value);
      if (code && history.indexOf(code) === -1) history.push(code);
    });
    return history;
  }

  function normalizeMatchingGroups(values) {
    return (Array.isArray(values) ? values : []).filter(function (group) {
      return group && typeof group === 'object' && !Array.isArray(group);
    }).map(function (group) {
      var lineKeys = Array.isArray(group.lineKeys) ? group.lineKeys.map(String).filter(function (key, index, list) { return !!key && list.indexOf(key) === index; }) : [];
      return Object.assign({}, group, {
        id: String(group.id || ''),
        code: String(group.code || '').trim().toLocaleUpperCase(),
        accountCode: String(group.accountCode || ''),
        lineKeys: lineKeys,
        debit: Math.max(0, Number(group.debit) || 0),
        credit: Math.max(0, Number(group.credit) || 0),
        status: group.status === 'cancelled' ? 'cancelled' : 'active'
      });
    }).filter(function (group) { return !!group.id && !!group.code && !!group.accountCode && group.lineKeys.length >= 2; });
  }

  function normalizePointageMarks(values) {
    return (Array.isArray(values) ? values : []).filter(function (mark) {
      return mark && typeof mark === 'object' && !Array.isArray(mark);
    }).map(function (mark) {
      return Object.assign({}, mark, {
        id: String(mark.id || ''),
        code: String(mark.code || '').trim().toLocaleUpperCase(),
        lineKey: String(mark.lineKey || ''),
        entryId: String(mark.entryId || ''),
        lineIndex: Number.isInteger(Number(mark.lineIndex)) ? Number(mark.lineIndex) : -1,
        accountCode: String(mark.accountCode || ''),
        statementDate: String(mark.statementDate || ''),
        status: mark.status === 'cancelled' ? 'cancelled' : 'pointed'
      });
    }).filter(function (mark) { return !!mark.id && !!mark.lineKey && !!mark.entryId && mark.lineIndex >= 0 && !!mark.accountCode; });
  }

  function upgradeAuxiliaryRegistries(data) {
    var result = { data: data, changed: false };
    if (!data) return result;
    var suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
    var clients = Array.isArray(data.clients) ? data.clients : [];
    var otherParties = Array.isArray(data.otherParties) ? data.otherParties : [];
    var personnel = Array.isArray(data.personnel) ? data.personnel : [];
    var serviceSource = Array.isArray(data.services) ? data.services : [];
    var analyticalCenterSource = Array.isArray(data.analyticalCenters) ? data.analyticalCenters : [];
    var analyticalCenters = analyticalCenterSource.filter(function (record) { return record && typeof record === 'object' && !Array.isArray(record); })
      .map(function (record) {
        var code = normalizeAnalyticalCenterCode(record.code);
        return Object.assign({}, record, {
          id: String(record.id || 'analytical-center-legacy-' + code),
          code: code,
          name: String(record.name == null ? record.label || '' : record.name).trim(),
          description: String(record.description || '').trim(),
          active: record.active !== false
        });
      }).filter(function (record) { return !!record.code && !!record.name; });
    var services = serviceSource.filter(function (record) { return record && typeof record === 'object' && !Array.isArray(record); })
      .map(function (record) {
        var code = normalizeServiceCode(record.code);
        return Object.assign({}, record, {
          id: String(record.id || 'service-legacy-' + code),
          code: code,
          name: String(record.name == null ? record.label || '' : record.name).trim(),
          description: String(record.description || ''),
          active: record.active !== false
        });
      });
    var serviceCodeHistory = normalizeServiceCodeHistory(
      (Array.isArray(data.serviceCodeHistory) ? data.serviceCodeHistory : []).concat(services.map(function (record) { return record.code; }))
    );
    var serviceSequence = Number(data.serviceSequence);
    if (!Number.isInteger(serviceSequence) || serviceSequence < 1) serviceSequence = 1;
    serviceCodeHistory.forEach(function (code) {
      var match = /^PRE-(\d+)$/.exec(code);
      if (match) serviceSequence = Math.max(serviceSequence, Number(match[1]) + 1);
    });
    var analyticalCenterCodeHistory = normalizeAnalyticalCenterCodeHistory(
      (Array.isArray(data.analyticalCenterCodeHistory) ? data.analyticalCenterCodeHistory : []).concat(analyticalCenters.map(function (record) { return record.code; }))
    );
    var analyticalCenterSequence = Number(data.analyticalCenterSequence);
    if (!Number.isInteger(analyticalCenterSequence) || analyticalCenterSequence < 1) analyticalCenterSequence = 1;
    analyticalCenterCodeHistory.forEach(function (code) {
      var centerMatch = /^ANA-(\d+)$/.exec(code);
      if (centerMatch) analyticalCenterSequence = Math.max(analyticalCenterSequence, Number(centerMatch[1]) + 1);
    });
    var currentAnalyticalCenterVersion = Number(data.analyticalCenterRegistryVersion);
    var matchingGroups = normalizeMatchingGroups(data.matchingGroups);
    var pointageMarks = normalizePointageMarks(data.pointageMarks);
    var matchingSequence = Number(data.matchingSequence);
    var pointageSequence = Number(data.pointageSequence);
    if (!Number.isInteger(matchingSequence) || matchingSequence < 1) matchingSequence = 1;
    if (!Number.isInteger(pointageSequence) || pointageSequence < 1) pointageSequence = 1;
    matchingGroups.forEach(function (group) {
      var match = /^LET-(\d{4})-(\d+)$/.exec(group.code);
      if (match) matchingSequence = Math.max(matchingSequence, Number(match[2]) + 1);
    });
    pointageMarks.forEach(function (mark) {
      var match = /^PNT-(\d{4})-(\d+)$/.exec(String(mark.code || ''));
      if (match) pointageSequence = Math.max(pointageSequence, Number(match[2]) + 1);
    });
    var currentReconciliationVersion = Number(data.reconciliationRegistryVersion);
    var currentServiceVersion = Number(data.serviceRegistryVersion);
    var histories = {
      supplier: normalizeIdentificationHistory('supplier',
        (Array.isArray(data.supplierCodeHistory) ? data.supplierCodeHistory : []).concat(suppliers.map(function (record) { return record && record.code; }))),
      client: normalizeIdentificationHistory('client',
        (Array.isArray(data.clientCodeHistory) ? data.clientCodeHistory : []).concat(clients.map(function (record) { return record && record.code; }))),
      debtor: normalizeIdentificationHistory('debtor',
        (Array.isArray(data.debtorCodeHistory) ? data.debtorCodeHistory : []).concat(otherParties.filter(function (record) { return record && record.type === 'debtor'; }).map(function (record) { return record.code; }))),
      creditor: normalizeIdentificationHistory('creditor',
        (Array.isArray(data.creditorCodeHistory) ? data.creditorCodeHistory : []).concat(otherParties.filter(function (record) { return record && record.type === 'creditor'; }).map(function (record) { return record.code; }))),
      personnel: normalizeIdentificationHistory('personnel',
        (Array.isArray(data.personnelCodeHistory) ? data.personnelCodeHistory : []).concat(personnel.map(function (record) { return record && record.code; })))
    };
    var rawSequences = data.identificationSequences && typeof data.identificationSequences === 'object' && !Array.isArray(data.identificationSequences)
      ? data.identificationSequences : {};
    var sequences = { supplier: 1, client: 1, debtor: 1, creditor: 1, personnel: 1 };
    Object.keys(sequences).forEach(function (kind) {
      var current = Number(rawSequences[kind]);
      if (Number.isInteger(current) && current > 0) sequences[kind] = current;
      var prefix = identificationPrefix(kind) + '-';
      histories[kind].forEach(function (value) {
        var code = String(value || '').toLocaleUpperCase();
        if (code.indexOf(prefix) !== 0) return;
        var suffix = code.slice(prefix.length);
        if (/^\d+$/.test(suffix)) sequences[kind] = Math.max(sequences[kind], Number(suffix) + 1);
      });
    });
    var currentVersion = Number(data.supplierRegistryVersion);
    var currentClientVersion = Number(data.clientRegistryVersion);
    var currentOtherPartyVersion = Number(data.otherPartyRegistryVersion);
    var currentPersonnelVersion = Number(data.personnelRegistryVersion);
    var changed = !Array.isArray(data.suppliers) || !Number.isFinite(currentVersion) || currentVersion < SUPPLIER_REGISTRY_VERSION ||
      !Array.isArray(data.analyticalCenters) || !Number.isFinite(currentAnalyticalCenterVersion) || currentAnalyticalCenterVersion < ANALYTICAL_CENTER_REGISTRY_VERSION ||
      JSON.stringify(data.analyticalCenters || []) !== JSON.stringify(analyticalCenters) ||
      JSON.stringify(data.analyticalCenterCodeHistory || []) !== JSON.stringify(analyticalCenterCodeHistory) ||
      Number(data.analyticalCenterSequence) !== analyticalCenterSequence ||
      !Number.isFinite(currentReconciliationVersion) || currentReconciliationVersion < RECONCILIATION_REGISTRY_VERSION ||
      JSON.stringify(data.matchingGroups || []) !== JSON.stringify(matchingGroups) ||
      JSON.stringify(data.pointageMarks || []) !== JSON.stringify(pointageMarks) ||
      Number(data.matchingSequence) !== matchingSequence ||
      Number(data.pointageSequence) !== pointageSequence ||
      !Array.isArray(data.clients) || !Number.isFinite(currentClientVersion) || currentClientVersion < CLIENT_REGISTRY_VERSION ||
      !Array.isArray(data.otherParties) || !Number.isFinite(currentOtherPartyVersion) || currentOtherPartyVersion < OTHER_PARTY_REGISTRY_VERSION ||
      !Array.isArray(data.personnel) || !Number.isFinite(currentPersonnelVersion) || currentPersonnelVersion < PERSONNEL_REGISTRY_VERSION ||
      !Array.isArray(data.services) || !Number.isFinite(currentServiceVersion) || currentServiceVersion < SERVICE_REGISTRY_VERSION ||
      JSON.stringify(data.services || []) !== JSON.stringify(services) ||
      JSON.stringify(data.serviceCodeHistory || []) !== JSON.stringify(serviceCodeHistory) ||
      Number(data.serviceSequence) !== serviceSequence ||
      JSON.stringify(data.supplierCodeHistory || []) !== JSON.stringify(histories.supplier) ||
      JSON.stringify(data.clientCodeHistory || []) !== JSON.stringify(histories.client) ||
      JSON.stringify(data.debtorCodeHistory || []) !== JSON.stringify(histories.debtor) ||
      JSON.stringify(data.creditorCodeHistory || []) !== JSON.stringify(histories.creditor) ||
      JSON.stringify(data.personnelCodeHistory || []) !== JSON.stringify(histories.personnel) ||
      JSON.stringify(data.identificationSequences || {}) !== JSON.stringify(sequences);
    if (changed) {
      result.data = Object.assign({}, data, {
        supplierRegistryVersion: SUPPLIER_REGISTRY_VERSION,
        clientRegistryVersion: Math.max(Number.isFinite(currentClientVersion) ? currentClientVersion : 0, CLIENT_REGISTRY_VERSION),
        analyticalCenterRegistryVersion: ANALYTICAL_CENTER_REGISTRY_VERSION,
        analyticalCenters: analyticalCenters,
        analyticalCenterCodeHistory: analyticalCenterCodeHistory,
        analyticalCenterSequence: analyticalCenterSequence,
        reconciliationRegistryVersion: RECONCILIATION_REGISTRY_VERSION,
        matchingGroups: matchingGroups,
        matchingSequence: matchingSequence,
        pointageMarks: pointageMarks,
        pointageSequence: pointageSequence,
        serviceRegistryVersion: SERVICE_REGISTRY_VERSION,
        services: services,
        serviceCodeHistory: serviceCodeHistory,
        serviceSequence: serviceSequence,
        otherPartyRegistryVersion: Math.max(Number.isFinite(currentOtherPartyVersion) ? currentOtherPartyVersion : 0, OTHER_PARTY_REGISTRY_VERSION),
        personnelRegistryVersion: Math.max(Number.isFinite(currentPersonnelVersion) ? currentPersonnelVersion : 0, PERSONNEL_REGISTRY_VERSION),
        suppliers: suppliers,
        clients: clients,
        otherParties: otherParties,
        personnel: personnel,
        supplierCodeHistory: histories.supplier,
        clientCodeHistory: histories.client,
        debtorCodeHistory: histories.debtor,
        creditorCodeHistory: histories.creditor,
        personnelCodeHistory: histories.personnel,
        identificationSequences: sequences
      });
      result.changed = true;
    }
    return result;
  }

  function normalizeFixedAssetLocationCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function upgradeFixedAssetLocations(data) {
    var result = { data: data, changed: false };
    if (!data) return result;
    var locations = Array.isArray(data.fixedAssetLocations) ? data.fixedAssetLocations : [];
    var history = [];
    (Array.isArray(data.fixedAssetLocationCodeHistory) ? data.fixedAssetLocationCodeHistory : [])
      .concat(locations.map(function (record) { return record && record.code; }))
      .forEach(function (value) {
        var code = normalizeFixedAssetLocationCode(value);
        if (code && history.indexOf(code) === -1) history.push(code);
      });
    var sequence = Number(data.fixedAssetLocationSequence);
    if (!Number.isInteger(sequence) || sequence < 1) sequence = 1;
    history.forEach(function (code) {
      var match = /^LOC-(\d+)$/.exec(code);
      if (match) sequence = Math.max(sequence, Number(match[1]) + 1);
    });
    var currentVersion = Number(data.fixedAssetLocationRegistryVersion);
    var changed = !Array.isArray(data.fixedAssetLocations) || !Number.isFinite(currentVersion) || currentVersion < FIXED_ASSET_LOCATION_REGISTRY_VERSION ||
      JSON.stringify(data.fixedAssetLocationCodeHistory || []) !== JSON.stringify(history) ||
      Number(data.fixedAssetLocationSequence) !== sequence;
    if (changed) {
      result.data = Object.assign({}, data, {
        fixedAssetLocationRegistryVersion: Math.max(Number.isFinite(currentVersion) ? currentVersion : 0, FIXED_ASSET_LOCATION_REGISTRY_VERSION),
        fixedAssetLocations: locations,
        fixedAssetLocationCodeHistory: history,
        fixedAssetLocationSequence: sequence
      });
      result.changed = true;
    }
    return result;
  }

  function normalizeFixedAssetCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function upgradeFixedAssets(data) {
    var result = { data: data, changed: false };
    if (!data) return result;
    var assets = Array.isArray(data.fixedAssets) ? data.fixedAssets : [];
    var history = [];
    (Array.isArray(data.fixedAssetCodeHistory) ? data.fixedAssetCodeHistory : [])
      .concat(assets.map(function (record) { return record && record.code; }))
      .forEach(function (value) {
        var code = normalizeFixedAssetCode(value);
        if (code && history.indexOf(code) === -1) history.push(code);
      });
    var sequence = Number(data.fixedAssetSequence);
    if (!Number.isInteger(sequence) || sequence < 1) sequence = 1;
    history.forEach(function (code) {
      var match = /^IMMO-(\d+)$/.exec(code);
      if (match) sequence = Math.max(sequence, Number(match[1]) + 1);
    });
    var currentVersion = Number(data.fixedAssetRegistryVersion);
    var changed = !Array.isArray(data.fixedAssets) || !Number.isFinite(currentVersion) || currentVersion < FIXED_ASSET_REGISTRY_VERSION ||
      JSON.stringify(data.fixedAssetCodeHistory || []) !== JSON.stringify(history) || Number(data.fixedAssetSequence) !== sequence;
    if (changed) {
      result.data = Object.assign({}, data, {
        fixedAssetRegistryVersion: Math.max(Number.isFinite(currentVersion) ? currentVersion : 0, FIXED_ASSET_REGISTRY_VERSION),
        fixedAssets: assets,
        fixedAssetCodeHistory: history,
        fixedAssetSequence: sequence
      });
      result.changed = true;
    }
    return result;
  }

  function seedEntries() {
    return [
      {
        id: 'seed-1', reference: 'BQ-2026-001', journal: 'BQ', date: '2026-01-05',
        description: 'Apport en capital social', status: 'posted',
        lines: [
          { account: '521100', debit: 1500000, credit: 0 },
          { account: '101200', debit: 0, credit: 1500000 }
        ]
      },
      {
        id: 'seed-2', reference: 'ACH-2026-001', journal: 'ACH', date: '2026-01-12',
        description: 'Achat de marchandises à crédit', status: 'posted',
        lines: [
          { account: '601100', debit: 500000, credit: 0 },
          { account: '445200', debit: 90000, credit: 0 },
          { account: '401100', debit: 0, credit: 590000 }
        ]
      },
      {
        id: 'seed-3', reference: 'VTE-2026-001', journal: 'VTE', date: '2026-01-20',
        description: 'Prestations de services (exonérées de TVA)', status: 'posted',
        lines: [
          { account: '411100', debit: 742000, credit: 0 },
          { account: '706000', debit: 0, credit: 742000 }
        ]
      },
      {
        id: 'seed-4', reference: 'OD-2026-001', journal: 'OD', date: '2026-01-28',
        description: 'Loyer à régulariser — brouillon', status: 'draft',
        lines: [
          { account: '622100', debit: 150000, credit: 0 },
          { account: '401100', debit: 0, credit: 150000 }
        ]
      }
    ];
  }

  function cyclePeriods(startDate, endDate) {
    var start = String(startDate || EXERCICE + '-01-01');
    var end = String(endDate || EXERCICE + '-12-31');
    var year = Number(start.slice(0, 4));
    var month = Number(start.slice(5, 7));
    var endYear = Number(end.slice(0, 4));
    var endMonth = Number(end.slice(5, 7));
    var out = [];
    while (year < endYear || (year === endYear && month <= endMonth)) {
      out.push({ year: year, month: month, status: 'open' });
      month += 1;
      if (month > 12) { month = 1; year += 1; }
    }
    return out;
  }

  function normalizeJournalCode(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function normalizeJournalPrefix(value) {
    return String(value == null ? '' : value).trim().toLocaleUpperCase();
  }

  function normalizeStoredAuthorizedAccounts(value) {
    if (value == null || value === '*') return '*';
    var source = Array.isArray(value) ? value : String(value).split(',');
    var codes = [];
    var invalid = false;
    source.forEach(function (item) {
      var code = String(item == null ? '' : item).trim();
      if (code === '*') {
        if (source.length === 1) codes = ['*'];
        else invalid = true;
        return;
      }
      if (!/^[1-8][0-9]{1,7}$/.test(code)) { invalid = true; return; }
      if (codes.indexOf(code) === -1) codes.push(code);
    });
    if (invalid || !codes.length) return [];
    if (codes[0] === '*') return '*';
    return codes;
  }

  function standardJournalRecord(definition, existing) {
    existing = existing || {};
    var previousCode = normalizeJournalCode(existing.code == null ? definition.code : existing.code);
    var legacyCodeChanged = Array.isArray(definition.legacyCodes) && definition.legacyCodes.indexOf(previousCode) !== -1;
    var code = legacyCodeChanged ? definition.code : String(existing.code == null ? definition.code : existing.code).trim();
    var migratedFromSystem = existing.systemManaged === true || existing.origin === 'system';
    var previousLabel = String(existing.label == null ? '' : existing.label).trim();
    var legacyLabels = Array.isArray(definition.legacyLabels) ? definition.legacyLabels : [];
    var labelNeedsUpdate = !previousLabel || legacyCodeChanged || legacyLabels.indexOf(previousLabel) !== -1 || migratedFromSystem;
    var existingPrefix = normalizeJournalPrefix(existing.referencePrefix || previousCode);
    var prefixNeedsUpdate = legacyCodeChanged && (!existing.referencePrefix || existingPrefix === previousCode);
    var definitionNature = JOURNAL_OPERATION_NATURES.indexOf(definition.operationNature) !== -1
      ? definition.operationNature
      : JOURNAL_OPERATION_NATURES[0];
    return {
      code: code,
      label: String(labelNeedsUpdate ? definition.label : previousLabel).trim(),
      type: String(migratedFromSystem || existing.type == null || existing.type === '' ? definition.type : existing.type).trim(),
      operationNature: JOURNAL_OPERATION_NATURES.indexOf(existing.operationNature) !== -1 ? existing.operationNature : definitionNature,
      id: String(existing.id || 'journal-standard-' + definition.code),
      referencePrefix: normalizeJournalPrefix(prefixNeedsUpdate ? (definition.referencePrefix || definition.code) : (existing.referencePrefix || definition.referencePrefix || code)),
      authorizedAccounts: normalizeStoredAuthorizedAccounts(existing.authorizedAccounts),
      description: String(migratedFromSystem ? (definition.description || '') : (existing.description || definition.description || '')).trim(),
      active: existing.active !== false,
      origin: 'standard',
      isStandard: true,
      systemManaged: false,
      systemKey: '',
      systemSource: ''
    };
  }

  function systemJournalRecord(definition) {
    return {
      code: definition.code,
      label: definition.label,
      type: definition.type,
      operationNature: definition.operationNature,
      id: 'journal-system-' + definition.systemKey,
      referencePrefix: definition.referencePrefix,
      authorizedAccounts: '*',
      description: definition.description,
      active: true,
      origin: 'system',
      isStandard: false,
      systemManaged: true,
      systemKey: definition.systemKey,
      systemSource: definition.systemSource
    };
  }

  function retiredReportJournalRecord(existing) {
    existing = existing || {};
    return {
      code: 'RAN',
      label: 'Ancien journal RAN (historique)',
      type: 'Historique retiré',
      operationNature: '',
      id: String(existing.id || 'journal-retired-report-a-nouveau'),
      referencePrefix: normalizeJournalPrefix(existing.referencePrefix || 'RAN'),
      authorizedAccounts: '*',
      description: 'Journal automatique retiré. Conservé uniquement pour les écritures historiques ; aucune nouvelle écriture ni modification n’est autorisée.',
      active: false,
      origin: 'retired-system',
      isStandard: false,
      systemManaged: false,
      systemKey: '',
      systemSource: '',
      retired: true
    };
  }

  function retiredRenamedJournalRecord(existing, definition, legacyCode) {
    existing = existing || {};
    var oldLabel = String(existing.label == null ? '' : existing.label).trim();
    var legacyLabels = Array.isArray(definition.legacyLabels) ? definition.legacyLabels : [];
    var isExistingAlias = existing.retired === true && existing.origin === 'retired-standard' && normalizeJournalCode(existing.replacedBy) === definition.code;
    var description = isExistingAlias && String(existing.description || '').trim()
      ? String(existing.description).trim()
      : 'Code remplacé par ' + definition.code + ' ; conservé uniquement pour les écritures historiques. Aucune nouvelle écriture, modification ou suppression n’est autorisée.';
    if (!isExistingAlias && oldLabel && legacyLabels.indexOf(oldLabel) === -1) description += ' Ancien libellé : ' + oldLabel + '.';
    return {
      code: legacyCode,
      replacedBy: definition.code,
      label: 'Ancien journal ' + definition.label,
      type: 'Historique retiré',
      operationNature: JOURNAL_OPERATION_NATURES.indexOf(existing.operationNature) !== -1 ? existing.operationNature : (definition.operationNature || 'Opérations courantes'),
      id: String(existing.id || 'journal-retired-' + legacyCode.toLocaleUpperCase()),
      referencePrefix: normalizeJournalPrefix(existing.referencePrefix || legacyCode),
      authorizedAccounts: normalizeStoredAuthorizedAccounts(existing.authorizedAccounts),
      description: description,
      active: false,
      origin: 'retired-standard',
      isStandard: false,
      systemManaged: false,
      systemKey: '',
      systemSource: '',
      retired: true
    };
  }

  function userJournalRecord(record) {
    var code = String(record.code == null ? '' : record.code).trim();
    var normalized = normalizeJournalCode(code).replace(/[^A-Z0-9_-]/g, '-') || 'LEGACY';
    var migratedId = 'journal-legacy-' + normalized;
    var result = {
      code: code,
      label: String(record.label == null || record.label === '' ? code : record.label).trim(),
      type: String(record.type == null || record.type === '' ? 'Divers' : record.type).trim(),
      operationNature: JOURNAL_OPERATION_NATURES.indexOf(record.operationNature) !== -1 ? record.operationNature : 'Opérations courantes',
      id: String(record.id || migratedId),
      referencePrefix: normalizeJournalPrefix(record.referencePrefix || code),
      authorizedAccounts: normalizeStoredAuthorizedAccounts(record.authorizedAccounts),
      description: String(record.description || ''),
      active: record.active !== false,
      origin: 'user',
      isStandard: false,
      systemManaged: false,
      systemKey: '',
      systemSource: ''
    };
    if (record.createdAt) result.createdAt = record.createdAt;
    if (record.updatedAt) result.updatedAt = record.updatedAt;
    return result;
  }

  function defaultJournalRecords() {
    return JOURNAUX.map(function (definition) { return standardJournalRecord(definition); })
      .concat(SYSTEM_JOURNAUX.map(systemJournalRecord));
  }

  function legacyStandardJournalDefinition(code) {
    return JOURNAUX.find(function (definition) {
      return Array.isArray(definition.legacyCodes) && definition.legacyCodes.indexOf(code) !== -1;
    }) || null;
  }

  function upgradeJournals(data) {
    var result = { data: data, changed: false };
    if (!data) return result;
    var source = Array.isArray(data.journals) ? data.journals : [];
    var standardByCode = Object.create(null);
    var systemByCode = Object.create(null);
    JOURNAUX.forEach(function (definition) { standardByCode[normalizeJournalCode(definition.code)] = definition; });
    SYSTEM_JOURNAUX.forEach(function (definition) { systemByCode[normalizeJournalCode(definition.code)] = definition; });

    var records = [];
    var seen = Object.create(null);
    var hasHistoricalReportEntries = false;
    var historicalRenamedJournalCodes = Object.create(null);
    (Array.isArray(data.entries) ? data.entries : []).forEach(function (entryRecord) {
      if (!entryRecord) return;
      var entryJournalCode = normalizeJournalCode(entryRecord.journal);
      if (entryJournalCode === 'RAN') hasHistoricalReportEntries = true;
      if (legacyStandardJournalDefinition(entryJournalCode)) historicalRenamedJournalCodes[entryJournalCode] = true;
    });
    source.forEach(function (record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        records.push(record);
        return;
      }
      var code = String(record.code == null ? '' : record.code).trim();
      var normalized = normalizeJournalCode(code);
      if (!normalized) {
        records.push(record);
        return;
      }
      seen[normalized] = true;
      if (normalized === 'RAN') {
        if (hasHistoricalReportEntries) records.push(retiredReportJournalRecord(record));
        return;
      }
      var renamedDefinition = legacyStandardJournalDefinition(normalized);
      if (renamedDefinition) {
        if (historicalRenamedJournalCodes[normalized]) records.push(retiredRenamedJournalRecord(record, renamedDefinition, normalized));
        return;
      }
      if (systemByCode[normalized]) records.push(systemJournalRecord(systemByCode[normalized]));
      else if (standardByCode[normalized]) records.push(standardJournalRecord(standardByCode[normalized], record));
      else records.push(userJournalRecord(record));
    });

    JOURNAUX.forEach(function (definition) {
      (Array.isArray(definition.legacyCodes) ? definition.legacyCodes : []).forEach(function (legacyCode) {
        if (!historicalRenamedJournalCodes[legacyCode] || seen[legacyCode]) return;
        seen[legacyCode] = true;
        records.push(retiredRenamedJournalRecord(null, definition, legacyCode));
      });
    });

    if (hasHistoricalReportEntries && !seen.RAN) {
      seen.RAN = true;
      records.push(retiredReportJournalRecord(null));
    }

    defaultJournalRecords().forEach(function (record) {
      var normalized = normalizeJournalCode(record.code);
      if (seen[normalized]) return;
      seen[normalized] = true;
      records.push(record);
    });

    var history = [];
    (Array.isArray(data.journalCodeHistory) ? data.journalCodeHistory : [])
      .concat(source.map(function (record) { return record && record.code; }))
      .concat(records.map(function (record) { return record.code; }))
      .concat(RETIRED_JOURNAL_CODES)
      .forEach(function (value) {
        var code = normalizeJournalCode(value);
        if (code && history.indexOf(code) === -1) history.push(code);
      });
    var currentVersion = Number(data.journalRegistryVersion);
    var changed = !Array.isArray(data.journals) || !Number.isFinite(currentVersion) || currentVersion < JOURNAL_REGISTRY_VERSION ||
      JSON.stringify(data.journals || []) !== JSON.stringify(records) ||
      JSON.stringify(data.journalCodeHistory || []) !== JSON.stringify(history);
    if (changed) {
      result.data = Object.assign({}, data, {
        journalRegistryVersion: Math.max(Number.isFinite(currentVersion) ? currentVersion : 0, JOURNAL_REGISTRY_VERSION),
        journals: records,
        journalCodeHistory: history
      });
      result.changed = true;
    }
    return result;
  }

  function initialState(withSeedEntries, dossier) {
    dossier = dossier || {};
    var exerciseYear = Number(dossier.exerciseYear) || EXERCICE;
    var cycleStart = dossier.cycleStart || exerciseYear + '-01-01';
    var cycleEnd = dossier.cycleEnd || exerciseYear + '-12-31';
    return {
      version: 1,
      accountChartVersion: ACCOUNTING_CHART_VERSION,
      exercise: exerciseYear,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      accounts: initialAccounts(withSeedEntries),
      journalRegistryVersion: JOURNAL_REGISTRY_VERSION,
      journals: defaultJournalRecords(),
      journalCodeHistory: defaultJournalRecords().map(function (journal) { return normalizeJournalCode(journal.code); }).concat(RETIRED_JOURNAL_CODES),
      entries: withSeedEntries === false ? [] : seedEntries(),
      periods: cyclePeriods(cycleStart, cycleEnd),
      deletedStandardAccountCodes: [],
      supplierRegistryVersion: SUPPLIER_REGISTRY_VERSION,
      clientRegistryVersion: CLIENT_REGISTRY_VERSION,
      serviceRegistryVersion: SERVICE_REGISTRY_VERSION,
      services: [],
      serviceCodeHistory: [],
      serviceSequence: 1,
      otherPartyRegistryVersion: OTHER_PARTY_REGISTRY_VERSION,
      personnelRegistryVersion: PERSONNEL_REGISTRY_VERSION,
      fixedAssetLocationRegistryVersion: FIXED_ASSET_LOCATION_REGISTRY_VERSION,
      fixedAssetLocations: [],
      fixedAssetLocationCodeHistory: [],
      fixedAssetLocationSequence: 1,
      fixedAssetRegistryVersion: FIXED_ASSET_REGISTRY_VERSION,
      fixedAssets: [],
      fixedAssetCodeHistory: [],
      fixedAssetSequence: 1,
      analyticalCenterRegistryVersion: ANALYTICAL_CENTER_REGISTRY_VERSION,
      analyticalCenters: [],
      analyticalCenterCodeHistory: [],
      analyticalCenterSequence: 1,
      reconciliationRegistryVersion: RECONCILIATION_REGISTRY_VERSION,
      matchingGroups: [],
      matchingSequence: 1,
      pointageMarks: [],
      pointageSequence: 1,
      suppliers: [],
      clients: [],
      otherParties: [],
      personnel: [],
      supplierCodeHistory: [],
      clientCodeHistory: [],
      debtorCodeHistory: [],
      creditorCodeHistory: [],
      personnelCodeHistory: [],
      identificationSequences: { supplier: 1, client: 1, debtor: 1, creditor: 1, personnel: 1 }
    };
  }

  var state = null;
  var folderCatalog = null;
  var activeFolderId = null;
  var recoveryIssue = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function suggestedClientCode(name) {
    var words = String(name || '').trim().split(/\s+/).filter(Boolean);
    var generic = ['CABINET', 'AGENCE', 'ENTREPRISE', 'SOCIETE', 'SARL', 'SA', 'ETS', 'ETABLISSEMENTS', 'GROUPE', 'CLIENT', 'BUREAU', 'DE', 'DU', 'DES', 'LA', 'LE'];
    var useful = words.filter(function (word) { return generic.indexOf(normalizeCode(word)) === -1; });
    var source = useful[0] || words[words.length - 1] || 'DEM';
    return normalizeCode(source).slice(0, 3) || 'DEM';
  }

  function referenceFor(typeCode, clientCode, exerciseYear) {
    return normalizeCode(typeCode) + '-' + normalizeCode(clientCode) + String(exerciseYear);
  }

  function defaultDossier() {
    return {
      id: DEFAULT_FOLDER_ID,
      name: DEFAULT_FOLDER_NAME,
      clientName: DEFAULT_FOLDER_NAME,
      clientCode: 'DEM',
      accountingTypeLabel: DEFAULT_ACCOUNTING_TYPE,
      accountingTypeCode: DEFAULT_ACCOUNTING_TYPE_CODE,
      address: '',
      ifu: '',
      rccm: '',
      email: '',
      phone: '',
      exerciseYear: EXERCICE,
      cycleStart: '2026-01-01',
      cycleEnd: '2026-12-31',
      reference: 'COR-DEM2026',
      seeded: true
    };
  }

  function normalizeDossier(record, index) {
    var legacyName = String(record && (record.clientName || record.name) || (index === 0 ? DEFAULT_FOLDER_NAME : 'Dossier de démonstration')).trim();
    var exerciseYear = Number(record && (record.exerciseYear || record.cycleYear)) || EXERCICE;
    var isMain = record && record.id === DEFAULT_FOLDER_ID;
    var clientCode = normalizeCode(record && record.clientCode) || (isMain ? 'DEM' : suggestedClientCode(legacyName));
    var accountingTypeCode = normalizeCode(record && (record.accountingTypeCode || record.typeCode)) || DEFAULT_ACCOUNTING_TYPE_CODE;
    var accountingTypeLabel = String(record && (record.accountingTypeLabel || record.accountingType) || DEFAULT_ACCOUNTING_TYPE).trim();
    var cycleStart = String(record && record.cycleStart || exerciseYear + '-01-01');
    var cycleEnd = String(record && record.cycleEnd || exerciseYear + '-12-31');
    if (!parseIsoDate(cycleStart) || !parseIsoDate(cycleEnd) || cycleEnd < cycleStart) {
      cycleStart = exerciseYear + '-01-01';
      cycleEnd = exerciseYear + '-12-31';
    }
    exerciseYear = Number(cycleStart.slice(0, 4)) || exerciseYear;
    var name = legacyName || DEFAULT_FOLDER_NAME;
    return {
      id: record && typeof record.id === 'string' && record.id ? record.id : (index === 0 ? DEFAULT_FOLDER_ID : 'dossier-migrated-' + index),
      name: name,
      clientName: name,
      clientCode: clientCode,
      accountingTypeLabel: accountingTypeLabel,
      accountingTypeCode: accountingTypeCode,
      address: String(record && record.address || '').trim(),
      ifu: String(record && record.ifu || '').trim(),
      rccm: String(record && record.rccm || '').trim(),
      email: String(record && record.email || '').trim(),
      phone: String(record && record.phone || '').trim(),
      exerciseYear: exerciseYear,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      reference: String(record && record.reference || referenceFor(accountingTypeCode, clientCode, exerciseYear)),
      seeded: record && record.seeded !== false
    };
  }

  function saveFolderCatalog() {
    try {
      global.localStorage.setItem(DOSSIERS_STORAGE_KEY, JSON.stringify(folderCatalog));
      return true;
    } catch (err) {
      return false;
    }
  }

  function ensureFolderCatalog() {
    if (folderCatalog) return;
    var parsed = null;
    try {
      var raw = global.localStorage.getItem(DOSSIERS_STORAGE_KEY) || global.localStorage.getItem(LEGACY_FOLDERS_STORAGE_KEY);
      parsed = raw ? JSON.parse(raw) : null;
    } catch (err) {
      parsed = null;
    }
    if (Array.isArray(parsed)) folderCatalog = parsed.map(normalizeDossier);
    if (!folderCatalog) folderCatalog = [defaultDossier()];
    if (!folderCatalog.some(function (dossier) { return dossier.id === DEFAULT_FOLDER_ID; })) folderCatalog.unshift(defaultDossier());

    var usedReferences = {};
    folderCatalog.forEach(function (dossier, index) {
      var baseCode = dossier.clientCode;
      var suffix = index + 1;
      while (usedReferences[dossier.reference]) {
        dossier.clientCode = baseCode.slice(0, Math.max(1, 2 - String(suffix).length)) + String(suffix++);
        dossier.reference = referenceFor(dossier.accountingTypeCode, dossier.clientCode, dossier.exerciseYear);
      }
      usedReferences[dossier.reference] = true;
    });

    try {
      var selected = global.localStorage.getItem(ACTIVE_DOSSIER_STORAGE_KEY) || global.localStorage.getItem(LEGACY_ACTIVE_FOLDER_STORAGE_KEY);
      activeFolderId = folderCatalog.some(function (dossier) { return dossier.id === selected; }) ? selected : DEFAULT_FOLDER_ID;
    } catch (err) {
      activeFolderId = DEFAULT_FOLDER_ID;
    }
    if (!folderCatalog.some(function (dossier) { return dossier.id === activeFolderId; })) activeFolderId = DEFAULT_FOLDER_ID;
    saveFolderCatalog();
    try { global.localStorage.setItem(ACTIVE_DOSSIER_STORAGE_KEY, activeFolderId); } catch (err) { /* stockage indisponible */ }
  }

  function folderById(folderId) {
    ensureFolderCatalog();
    return folderCatalog.find(function (dossier) { return dossier.id === folderId; }) || null;
  }

  function dossiers() {
    ensureFolderCatalog();
    return clone(folderCatalog);
  }

  function currentDossier() {
    ensureFolderCatalog();
    return clone(folderById(activeFolderId));
  }

  function parseIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  }

  function createDossier(data) {
    ensureFolderCatalog();
    var input = data || {};
    var name = String(input.clientName || input.name || '').trim().replace(/\s+/g, ' ');
    var clientCode = normalizeCode(input.clientCode);
    var accountingTypeLabel = String(input.accountingTypeLabel || '').trim();
    var accountingTypeCode = normalizeCode(input.accountingTypeCode || 'COR');
    var cycleStart = String(input.cycleStart || '');
    var cycleEnd = String(input.cycleEnd || '');
    var startDate = parseIsoDate(cycleStart);
    var endDate = parseIsoDate(cycleEnd);
    var errors = [];
    if (!name) errors.push('Le nom de l’entreprise cliente est obligatoire.');
    if (name.length > 120) errors.push('Le nom de l’entreprise ne peut pas dépasser 120 caractères.');
    if (!accountingTypeLabel) errors.push('Le type de comptabilité est obligatoire.');
    if (accountingTypeLabel.length > 80) errors.push('Le type de comptabilité ne peut pas dépasser 80 caractères.');
    if (!/^[A-Z0-9]{2,6}$/.test(accountingTypeCode)) errors.push('Le code du type doit contenir de 2 à 6 lettres ou chiffres.');
    if (!clientCode) errors.push('Le code du dossier est obligatoire.');
    else if (!/^[A-Z0-9]{2,8}$/.test(clientCode)) errors.push('Le code du dossier doit contenir de 2 à 8 lettres ou chiffres.');
    if (!startDate || !endDate || endDate < startDate) errors.push('Le cycle comptable doit préciser des dates valides, dans l’ordre chronologique.');
    if (startDate && endDate && cyclePeriods(cycleStart, cycleEnd).length > 18) errors.push('Le cycle ne peut pas dépasser 18 mois dans cette version.');
    var exerciseYear = startDate ? startDate.getUTCFullYear() : EXERCICE;
    var reference = referenceFor(accountingTypeCode, clientCode, exerciseYear);
    if (folderCatalog.some(function (dossier) { return dossier.reference.toLocaleLowerCase() === reference.toLocaleLowerCase(); })) {
      errors.push('La référence « ' + reference + ' » existe déjà. Choisissez un autre code de dossier ou un autre exercice.');
    }
    if (errors.length) return { ok: false, errors: errors };

    var id;
    do {
      id = 'dossier-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    } while (folderCatalog.some(function (dossier) { return dossier.id === id; }));
    var dossier = {
      id: id,
      name: name,
      clientName: name,
      clientCode: clientCode,
      accountingTypeLabel: accountingTypeLabel,
      accountingTypeCode: accountingTypeCode,
      address: String(input.address || '').trim(),
      ifu: String(input.ifu || '').trim(),
      rccm: String(input.rccm || '').trim(),
      email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(),
      exerciseYear: exerciseYear,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      reference: reference,
      seeded: false
    };
    folderCatalog.push(dossier);
    if (!saveFolderCatalog()) {
      folderCatalog.pop();
      return { ok: false, errors: ['Impossible d’enregistrer le dossier dans ce navigateur.'] };
    }
    return { ok: true, errors: [], dossier: clone(dossier), folder: clone(dossier) };
  }

  function createFolder(name) {
    var cleanName = String(name == null ? '' : name).trim();
    var code = suggestedClientCode(cleanName);
    return createDossier({
      clientName: cleanName,
      clientCode: code,
      accountingTypeLabel: DEFAULT_ACCOUNTING_TYPE,
      accountingTypeCode: DEFAULT_ACCOUNTING_TYPE_CODE,
      cycleStart: EXERCICE + '-01-01',
      cycleEnd: EXERCICE + '-12-31'
    });
  }

  function currentFolderStorageKey() {
    ensureFolderCatalog();
    return activeFolderId === DEFAULT_FOLDER_ID ? STORAGE_KEY : STORAGE_KEY + '.folder.' + activeFolderId;
  }

  function currentBackupStorageKey() {
    ensureFolderCatalog();
    return activeFolderId === DEFAULT_FOLDER_ID ? BACKUP_STORAGE_KEY : BACKUP_STORAGE_KEY + '.folder.' + activeFolderId;
  }

  function currentRecoveryRawStorageKey() {
    return currentFolderStorageKey() + CORRUPT_RECOVERY_SUFFIX;
  }

  function switchFolder(folderId) {
    ensureFolderCatalog();
    if (!folderById(folderId)) return { ok: false, errors: ['Dossier client introuvable.'] };
    if (folderId === activeFolderId) return { ok: true, errors: [], dossier: currentDossier(), folder: currentDossier() };
    if (state && !recoveryIssue && !save()) return { ok: false, errors: ['Impossible d’enregistrer le dossier actif avant le changement.'] };
    activeFolderId = folderId;
    state = null;
    recoveryIssue = null;
    try { global.localStorage.setItem(ACTIVE_DOSSIER_STORAGE_KEY, activeFolderId); } catch (err) { /* la sélection restera en mémoire */ }
    return { ok: true, errors: [], dossier: currentDossier(), folder: currentDossier(), state: load() };
  }

  function hasReadableAccountingRecords(data) {
    return !!data && Array.isArray(data.accounts) && Array.isArray(data.journals) && Array.isArray(data.entries) &&
      (data.suppliers === undefined || (Array.isArray(data.suppliers) && data.suppliers.every(function (supplier) {
        return !!supplier && typeof supplier === 'object' && !Array.isArray(supplier);
      }))) &&
      (data.clients === undefined || (Array.isArray(data.clients) && data.clients.every(function (clientRecord) {
        return !!clientRecord && typeof clientRecord === 'object' && !Array.isArray(clientRecord);
      }))) &&
      (data.otherParties === undefined || (Array.isArray(data.otherParties) && data.otherParties.every(function (record) {
        return !!record && typeof record === 'object' && !Array.isArray(record);
      }))) &&
      (data.personnel === undefined || (Array.isArray(data.personnel) && data.personnel.every(function (record) {
        return !!record && typeof record === 'object' && !Array.isArray(record);
      }))) &&
      (data.services === undefined || (Array.isArray(data.services) && data.services.every(function (record) {
        return !!record && typeof record === 'object' && !Array.isArray(record);
      }))) &&
      (data.deletedStandardAccountCodes === undefined || (Array.isArray(data.deletedStandardAccountCodes) && data.deletedStandardAccountCodes.every(function (code) { return typeof code === 'string'; }))) &&
      data.accounts.every(function (account) { return !!account && typeof account === 'object' && !Array.isArray(account); }) &&
      data.journals.every(function (journal) { return !!journal && typeof journal === 'object' && !Array.isArray(journal); }) &&
      data.entries.every(function (entry) {
        return !!entry && typeof entry === 'object' && !Array.isArray(entry) && Array.isArray(entry.lines) &&
          entry.lines.every(function (line) { return !!line && typeof line === 'object' && !Array.isArray(line); });
      });
  }

  function periodRegistryNeedsRepair(periods) {
    if (!Array.isArray(periods)) return true;
    return periods.some(function (period) {
      if (!period || typeof period !== 'object' || Array.isArray(period)) return true;
      var year = Number(period.year);
      var month = Number(period.month);
      return !Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || month < 1 || month > 12 ||
        (period.status !== 'open' && period.status !== 'closed');
    });
  }

  function load() {
    if (state) return state;
    ensureFolderCatalog();
    var raw = null;
    try {
      raw = global.localStorage.getItem(currentFolderStorageKey());
      if (raw !== null) {
        var parsed = JSON.parse(raw);
        if (hasReadableAccountingRecords(parsed)) {
          state = parsed;
          var dossier = folderById(activeFolderId);
          var fallbackStart = (dossier && dossier.cycleStart) || EXERCICE + '-01-01';
          var fallbackEnd = (dossier && dossier.cycleEnd) || EXERCICE + '-12-31';
          var metadataRepairNeeded = false;
          if (!parseIsoDate(state.cycleStart) || !parseIsoDate(state.cycleEnd) || state.cycleEnd < state.cycleStart) {
            state.cycleStart = fallbackStart;
            state.cycleEnd = fallbackEnd;
            metadataRepairNeeded = true;
          }
          if (!Array.isArray(state.periods)) {
            state.periods = [];
            metadataRepairNeeded = true;
          } else if (periodRegistryNeedsRepair(state.periods)) {
            metadataRepairNeeded = true;
          }
          var inferredExercise = Number(state.cycleStart.slice(0, 4)) || Number(dossier && dossier.exerciseYear) || EXERCICE;
          if (state.exercise !== inferredExercise) metadataRepairNeeded = true;
          state.exercise = inferredExercise;
          if (metadataRepairNeeded) {
            recoveryIssue = { kind: 'metadata', raw: raw, message: 'Des métadonnées de cycle ou de périodes nécessitent une réparation contrôlée.' };
          } else {
            var periodsBefore = JSON.stringify(state.periods);
            try {
              ensurePeriodsForEntries();
            } catch (periodError) {
              recoveryIssue = { kind: 'metadata', raw: raw, message: 'Le registre des périodes ne peut pas être chargé sans réparation.' };
            }
            if (!recoveryIssue && JSON.stringify(state.periods) !== periodsBefore) {
              recoveryIssue = { kind: 'metadata', raw: raw, message: 'Des périodes manquantes ont été reconstruites en mémoire et doivent être enregistrées après contrôle.' };
            }
          }
          if (!recoveryIssue) {
            var chartUpgrade = upgradeAccountingChart(state);
            var registryUpgrade = upgradeAuxiliaryRegistries(chartUpgrade.data);
            var locationUpgrade = upgradeFixedAssetLocations(registryUpgrade.data);
            var fixedAssetUpgrade = upgradeFixedAssets(locationUpgrade.data);
            var journalUpgrade = upgradeJournals(fixedAssetUpgrade.data);
            if (chartUpgrade.changed || registryUpgrade.changed || locationUpgrade.changed || fixedAssetUpgrade.changed || journalUpgrade.changed) {
              state = journalUpgrade.data;
              // Conserver une copie restaurable avant d’enregistrer les référentiels enrichis.
              if (snapshotPreviousState(raw)) save();
            }
          }
          return state;
        }
        recoveryIssue = { kind: 'corrupt', raw: raw, message: 'Le fichier comptable stocké est illisible ou sa structure est incomplète. PERFECTO l’a conservé sans le remplacer.' };
      }
    } catch (err) {
      if (raw !== null) recoveryIssue = { kind: 'corrupt', raw: raw, message: 'Le fichier comptable stocké ne peut pas être lu. PERFECTO l’a conservé sans le remplacer.' };
    }
    var dossier = folderById(activeFolderId);
    state = initialState(!dossier || dossier.seeded !== false, dossier);
    if (!recoveryIssue) save();
    return state;
  }

  function isBackupData(data) {
    return hasReadableAccountingRecords(data) && Array.isArray(data.periods);
  }

  function writeBackupSnapshot(data) {
    try {
      if (!isBackupData(data)) return false;
      var snapshot = {
        application: 'PERFECTO',
        module: 'Comptabilité générale SYSCOHADA',
        version: 1,
        createdAt: new Date().toISOString(),
        data: clone(data)
      };
      global.localStorage.setItem(currentBackupStorageKey(), JSON.stringify(snapshot));
      return true;
    } catch (err) {
      return false;
    }
  }

  function snapshotPreviousState(raw) {
    try {
      return writeBackupSnapshot(JSON.parse(raw));
    } catch (err) {
      return false;
    }
  }

  function save() {
    if (!state || recoveryIssue) return false;
    try {
      ensureFolderCatalog();
      var storageKey = currentFolderStorageKey();
      var serialized = JSON.stringify(state);
      var previous = global.localStorage.getItem(storageKey);
      if (previous && previous !== serialized) snapshotPreviousState(previous);
      global.localStorage.setItem(storageKey, serialized);
      return true;
    } catch (err) {
      return false;
    }
  }

  function reset() {
    ensureFolderCatalog();
    if (recoveryIssue) return state;
    var dossier = folderById(activeFolderId);
    state = initialState(!dossier || dossier.seeded !== false, dossier);
    save();
    return state;
  }

  function getState() { return load(); }

  function exercise() { return Number(load().exercise) || EXERCICE; }

  /* ---------------- Référentiels ---------------- */
  function accounts() { return load().accounts; }

  function account(code) {
    return load().accounts.find(function (a) { return a.code === code; }) || null;
  }

  function journals() { return load().journals; }

  function journal(code) {
    var normalized = normalizeJournalCode(code);
    return load().journals.find(function (record) { return normalizeJournalCode(record.code) === normalized; }) || null;
  }

  function journalByIdentifier(identifier) {
    var byCode = journal(identifier);
    if (byCode) return byCode;
    return load().journals.find(function (record) { return record.id === identifier; }) || null;
  }

  function nextJournalCode() {
    var st = load();
    var reserved = Object.create(null);
    (Array.isArray(st.journalCodeHistory) ? st.journalCodeHistory : []).forEach(function (code) {
      reserved[normalizeJournalCode(code)] = true;
    });
    st.journals.forEach(function (record) { reserved[normalizeJournalCode(record.code)] = true; });
    var sequence = 1;
    var candidate;
    do {
      candidate = 'J' + String(sequence).padStart(2, '0');
      sequence += 1;
    } while (reserved[candidate]);
    return candidate;
  }

  function journalEntryCount(codeOrIdentifier) {
    var record = journalByIdentifier(codeOrIdentifier);
    if (!record) return 0;
    var normalized = normalizeJournalCode(record.code);
    return entries().filter(function (entryRecord) {
      return normalizeJournalCode(entryRecord.journal) === normalized;
    }).length;
  }

  function accountAllowedForJournalRecord(journalRecord, accountCode) {
    if (!journalRecord) return false;
    var allowed = journalRecord.authorizedAccounts;
    return allowed === '*' || (Array.isArray(allowed) && allowed.indexOf(String(accountCode == null ? '' : accountCode)) !== -1);
  }

  function journalAllowsAccount(journalCode, accountCode) {
    return accountAllowedForJournalRecord(journal(journalCode), accountCode);
  }

  function parseAuthorizedAccounts(value) {
    var raw = Array.isArray(value) ? value.join(',') : String(value == null ? '' : value);
    raw = raw.trim();
    if (raw === '*') return { ok: true, errors: [], value: '*' };
    var errors = [];
    if (raw.length > 1000) return { ok: false, errors: ['La liste des comptes autorisés ne peut pas dépasser 1 000 caractères.'], value: [] };
    if (!raw) return { ok: false, errors: ['Indiquez « * » pour tous les comptes ou saisissez des numéros séparés par des virgules.'], value: [] };
    if (raw.indexOf('*') !== -1) errors.push('Le caractère « * » doit être utilisé seul pour autoriser tous les comptes.');
    var codes = [];
    raw.split(',').forEach(function (part) {
      var code = String(part || '').trim();
      if (!code) {
        errors.push('La liste des comptes autorisés contient un élément vide. Séparez les numéros par une virgule.');
        return;
      }
      if (!/^[1-8][0-9]{1,7}$/.test(code)) {
        errors.push('Le numéro de compte « ' + code + ' » doit contenir de 2 à 8 chiffres et commencer par une classe de 1 à 8.');
        return;
      }
      if (codes.indexOf(code) === -1) codes.push(code);
    });
    return { ok: errors.length === 0, errors: errors, value: codes };
  }

  function validateJournalInput(input, existing) {
    input = input || {};
    var errors = [];
    var st = load();
    var code = normalizeJournalCode(input.code);
    var label = String(input.label == null ? '' : input.label).trim();
    var type = String(input.type == null ? '' : input.type).trim();
    var operationNature = input.operationNature == null
      ? (existing && existing.operationNature || JOURNAL_OPERATION_NATURES[0])
      : String(input.operationNature).trim();
    var authorizedInput = input.authorizedAccounts == null
      ? (existing ? existing.authorizedAccounts : '*')
      : input.authorizedAccounts;
    var authorizedValidation = parseAuthorizedAccounts(authorizedInput);
    var referencePrefix = normalizeJournalPrefix(input.referencePrefix || code);
    var description = String(input.description == null ? '' : input.description).trim();
    var reservedCodes = Array.isArray(st.journalCodeHistory) ? st.journalCodeHistory.map(normalizeJournalCode) : [];
    if (JOURNAL_OPERATION_NATURES.indexOf(operationNature) === -1) {
      errors.push('Choisissez une nature d’opérations dans la liste proposée.');
    }
    if (!authorizedValidation.ok) errors = errors.concat(authorizedValidation.errors);

    if (!/^[A-Z0-9][A-Z0-9_-]{0,7}$/.test(code)) errors.push('Le code du journal est obligatoire (8 caractères maximum : lettres, chiffres, tiret ou souligné).');
    if (!label) errors.push('Le libellé du journal est obligatoire.');
    else if (label.length > 80) errors.push('Le libellé du journal ne peut pas dépasser 80 caractères.');
    if (!type) errors.push('Le type du journal est obligatoire.');
    else if (type.length > 40) errors.push('Le type du journal ne peut pas dépasser 40 caractères.');
    if (!/^[A-Z0-9][A-Z0-9_-]{0,7}$/.test(referencePrefix)) errors.push('Le préfixe de référence est obligatoire (8 caractères maximum : lettres, chiffres, tiret ou souligné).');
    if (description.length > 240) errors.push('La description ne peut pas dépasser 240 caractères.');

    if (existing && existing.isStandard && code !== normalizeJournalCode(existing.code)) {
      errors.push('Le code d’un journal standard ne peut pas être modifié.');
    }
    if (existing && existing.systemManaged) errors.push('Un journal automatique géré par le système ne peut pas être modifié.');
    if (existing && existing.retired) errors.push('Ce journal a été retiré et ne peut plus être modifié.');

    var sameCode = journal(code);
    if (code && sameCode && (!existing || sameCode.id !== existing.id)) {
      errors.push('Ce code de journal est déjà utilisé.');
    }
    if (code && existing && code !== normalizeJournalCode(existing.code)) {
      if (existing.isStandard) {
        // Le code standard est fixe ; l’erreur correspondante est déjà signalée.
      } else if (journalEntryCount(existing.id) > 0) {
        errors.push('Le code ne peut plus changer après la première écriture du journal.');
      } else if (reservedCodes.indexOf(code) !== -1) {
        errors.push('Ce code a déjà été utilisé dans ce dossier et ne peut pas être réattribué.');
      }
    } else if (code && !existing && reservedCodes.indexOf(code) !== -1) {
      errors.push('Ce code a déjà été utilisé dans ce dossier et ne peut pas être réattribué.');
    }

    var samePrefix = st.journals.find(function (record) {
      return normalizeJournalPrefix(record.referencePrefix || record.code) === referencePrefix && (!existing || record.id !== existing.id);
    });
    if (referencePrefix && samePrefix) errors.push('Ce préfixe de référence est déjà utilisé par « ' + samePrefix.label + ' ».');

    return {
      ok: errors.length === 0,
      errors: errors,
      journal: {
        code: code,
        label: label,
        type: type,
        operationNature: operationNature,
        referencePrefix: referencePrefix,
        authorizedAccounts: authorizedValidation.value,
        description: description,
        active: input.active !== false
      }
    };
  }

  function createJournal(input) {
    var validation = validateJournalInput(input, null);
    if (!validation.ok) return validation;
    var st = load();
    var previousState = clone(st);
    var now = new Date().toISOString();
    var record = Object.assign({}, validation.journal, {
      id: 'journal-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      origin: 'user',
      isStandard: false,
      systemManaged: false,
      systemKey: '',
      systemSource: '',
      createdAt: now,
      updatedAt: now
    });
    st.journals.push(record);
    if (!Array.isArray(st.journalCodeHistory)) st.journalCodeHistory = [];
    if (st.journalCodeHistory.indexOf(record.code) === -1) st.journalCodeHistory.push(record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Création impossible : stockage local indisponible ou plein.'] };
    }
    return { ok: true, errors: [], journal: record };
  }

  function updateJournal(identifier, input) {
    var existing = journalByIdentifier(identifier);
    if (!existing) return { ok: false, errors: ['Journal introuvable.'] };
    if (existing.systemManaged) return { ok: false, errors: ['Ce journal est réservé au système et ne peut pas être modifié.'] };
    if (existing.retired) return { ok: false, errors: ['Ce journal a été retiré et ne peut plus être modifié.'] };
    var validation = validateJournalInput(input, existing);
    if (!validation.ok) return validation;
    var st = load();
    var previousState = clone(st);
    var index = st.journals.findIndex(function (record) { return record.id === existing.id; });
    var now = new Date().toISOString();
    var updated = Object.assign({}, existing, validation.journal, { updatedAt: now });
    st.journals[index] = updated;
    if (!Array.isArray(st.journalCodeHistory)) st.journalCodeHistory = [];
    if (st.journalCodeHistory.indexOf(updated.code) === -1) st.journalCodeHistory.push(updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Modification impossible : stockage local indisponible ou plein.'] };
    }
    return { ok: true, errors: [], journal: updated };
  }

  function deleteJournal(identifier) {
    var existing = journalByIdentifier(identifier);
    if (!existing) return { ok: false, errors: ['Journal introuvable.'] };
    if (existing.systemManaged || existing.isStandard) return { ok: false, errors: ['Un journal standard ou géré par le système ne peut pas être supprimé.'] };
    if (existing.retired) return { ok: false, errors: ['Ce journal historique retiré est conservé pour préserver ses écritures.'] };
    var count = journalEntryCount(existing.id);
    if (count > 0) return { ok: false, errors: ['Ce journal possède ' + count + ' écriture(s) ; archivez-le plutôt que de le supprimer.'] };
    var st = load();
    var previousState = clone(st);
    if (!writeBackupSnapshot(previousState)) {
      return { ok: false, errors: ['Suppression impossible : le point de restauration local n’a pas pu être créé. Le journal est conservé.'] };
    }
    st.journals = st.journals.filter(function (record) { return record.id !== existing.id; });
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. Le journal est conservé.'] };
    }
    return { ok: true, errors: [] };
  }

  function ensureIdentificationState(st) {
    if (!Array.isArray(st.suppliers)) st.suppliers = [];
    if (!Array.isArray(st.clients)) st.clients = [];
    if (!Array.isArray(st.otherParties)) st.otherParties = [];
    if (!Array.isArray(st.personnel)) st.personnel = [];
    ['supplier', 'client', 'debtor', 'creditor', 'personnel'].forEach(function (kind) {
      var historyField = identificationHistoryField(kind);
      if (!Array.isArray(st[historyField])) st[historyField] = [];
      var sequences = st.identificationSequences;
      if (!sequences || typeof sequences !== 'object' || Array.isArray(sequences)) sequences = st.identificationSequences = {};
      var sequence = Number(sequences[kind]);
      if (!Number.isInteger(sequence) || sequence < 1) sequences[kind] = 1;
      var prefix = identificationPrefix(kind) + '-';
      var codes = kind === 'supplier'
        ? st.suppliers.map(function (record) { return record && record.code; })
        : (kind === 'client'
          ? st.clients.map(function (record) { return record && record.code; })
          : (kind === 'personnel'
            ? st.personnel.map(function (record) { return record && record.code; })
            : st.otherParties.filter(function (record) { return record && record.type === kind; }).map(function (record) { return record.code; })));
      st[historyField].concat(codes).forEach(function (value) {
        var normalized = normalizeIdentificationCode(kind, value);
        if (normalized && st[historyField].indexOf(normalized) === -1) st[historyField].push(normalized);
        if (normalized.indexOf(prefix) !== 0) return;
        var suffix = normalized.slice(prefix.length);
        if (/^\d+$/.test(suffix)) sequences[kind] = Math.max(Number(sequences[kind]) || 1, Number(suffix) + 1);
      });
    });
    st.supplierRegistryVersion = SUPPLIER_REGISTRY_VERSION;
    st.clientRegistryVersion = CLIENT_REGISTRY_VERSION;
    st.otherPartyRegistryVersion = OTHER_PARTY_REGISTRY_VERSION;
    st.personnelRegistryVersion = PERSONNEL_REGISTRY_VERSION;
    return st;
  }

  function supplierRecordsForState(st) {
    ensureIdentificationState(st);
    return st.suppliers;
  }

  function nextIdentificationCode(kind) {
    kind = String(kind || '').toLowerCase();
    var prefix = identificationPrefix(kind);
    if (!prefix) return '';
    var st = load();
    if (recoveryIssue) return '';
    ensureIdentificationState(st);
    var sequence = Number(st.identificationSequences[kind]) || 1;
    var history = st[identificationHistoryField(kind)];
    if (kind === 'debtor' || kind === 'creditor') {
      var otherKind = kind === 'debtor' ? 'creditor' : 'debtor';
      history = history.concat(st[identificationHistoryField(otherKind)] || []);
    }
    var candidate;
    do {
      candidate = prefix + '-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while (history.indexOf(candidate) !== -1);
    return candidate;
  }

  function reserveIdentificationCode(st, kind, code) {
    kind = String(kind || '').toLowerCase();
    var prefix = identificationPrefix(kind);
    if (!prefix) return false;
    ensureIdentificationState(st);
    var normalized = normalizeIdentificationCode(kind, code);
    var history = st[identificationHistoryField(kind)];
    if (normalized && history.indexOf(normalized) === -1) history.push(normalized);
    var prefixWithDash = prefix + '-';
    if (normalized.indexOf(prefixWithDash) === 0) {
      var suffix = normalized.slice(prefixWithDash.length);
      if (/^\d+$/.test(suffix)) st.identificationSequences[kind] = Math.max(Number(st.identificationSequences[kind]) || 1, Number(suffix) + 1);
    }
    return true;
  }

  function registerIdentificationCode(kind, code) {
    kind = String(kind || '').toLowerCase();
    if (!identificationPrefix(kind)) return { ok: false, errors: ['Type d’identifiant inconnu.'] };
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Attribution bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    ensureIdentificationState(st);
    var normalized = normalizeIdentificationCode(kind, code);
    if (!normalized) return { ok: false, errors: ['Le code à attribuer est vide.'] };
    if (st[identificationHistoryField(kind)].indexOf(normalized) !== -1) {
      return { ok: false, errors: ['Ce code a déjà été attribué dans ce dossier.'] };
    }
    var previousState = clone(st);
    reserveIdentificationCode(st, kind, normalized);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Attribution impossible : stockage local indisponible ou plein.'] };
    }
    return { ok: true, errors: [], code: normalized };
  }

  function services() {
    var st = load();
    return Array.isArray(st.services) ? st.services : [];
  }

  function service(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeServiceCode(key);
    return services().find(function (record) {
      return record.id === key || normalizeServiceCode(record.code) === normalizedCode;
    }) || null;
  }

  function nextServiceCode() {
    var st = load();
    var reserved = Object.create(null);
    (Array.isArray(st.serviceCodeHistory) ? st.serviceCodeHistory : []).forEach(function (code) {
      reserved[normalizeServiceCode(code)] = true;
    });
    services().forEach(function (record) { reserved[normalizeServiceCode(record.code)] = true; });
    var sequence = Number(st.serviceSequence) || 1;
    var candidate;
    do {
      candidate = 'PRE-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while (reserved[candidate]);
    return candidate;
  }

  function reserveServiceCode(st, code) {
    if (!Array.isArray(st.serviceCodeHistory)) st.serviceCodeHistory = [];
    if (!Number.isInteger(Number(st.serviceSequence)) || Number(st.serviceSequence) < 1) st.serviceSequence = 1;
    var normalized = normalizeServiceCode(code);
    if (normalized && st.serviceCodeHistory.indexOf(normalized) === -1) st.serviceCodeHistory.push(normalized);
    var match = /^PRE-(\d+)$/.exec(normalized);
    if (match) st.serviceSequence = Math.max(Number(st.serviceSequence) || 1, Number(match[1]) + 1);
  }

  function validateServiceInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var code = normalizeServiceCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var description = String(input.description == null ? '' : input.description).trim();
    var current = excludeId ? service(excludeId) : null;
    if (!code) errors.push('Le code de la prestation est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('La désignation de la prestation est obligatoire.');
    else if (name.length > 150) errors.push('La désignation ne peut pas dépasser 150 caractères.');
    if (description.length > 1000) errors.push('La description ne peut pas dépasser 1 000 caractères.');
    if (services().some(function (record) { return record.id !== excludeId && normalizeServiceCode(record.code) === code; })) {
      errors.push('Ce code de prestation existe déjà dans le dossier.');
    }
    var st = load();
    if (Array.isArray(st.serviceCodeHistory) && st.serviceCodeHistory.indexOf(code) !== -1 && code !== normalizeServiceCode(current && current.code)) {
      errors.push('Ce code de prestation a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    }
    return {
      ok: errors.length === 0,
      errors: errors,
      value: { code: code, name: name, description: description }
    };
  }

  function createService(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextServiceCode();
    var validation = validateServiceInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'service-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (services().some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, active: true, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    st.services.push(record);
    reserveServiceCode(st, record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer la prestation dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], service: clone(record) };
  }

  function serviceReferenceCount(idOrRecord, st) {
    st = st || load();
    var record = idOrRecord && typeof idOrRecord === 'object' ? idOrRecord : service(idOrRecord);
    if (!record) return 0;
    return registryRecordReferenceCount(st, record, 'service|prestation');
  }

  function updateService(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var index = st.services.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Prestation introuvable dans le dossier actif.'] };
    var previous = st.services[index];
    var validation = validateServiceInput(input, id);
    if (!validation.ok) return validation;
    var references = serviceReferenceCount(previous, st);
    if (references && validation.value.code !== normalizeServiceCode(previous.code)) {
      return { ok: false, errors: ['Le code ne peut pas être modifié : ' + references + ' écriture(s) ou mouvement(s) font référence à cette prestation.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, {
      id: previous.id,
      active: input.active == null ? previous.active !== false : input.active !== false,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString()
    });
    st.services[index] = updated;
    reserveServiceCode(st, previous.code);
    reserveServiceCode(st, updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications de la prestation.'] };
    }
    return { ok: true, errors: [], service: clone(updated) };
  }

  function setServiceActive(id, active) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var record = services().find(function (item) { return item.id === id; });
    if (!record) return { ok: false, errors: ['Prestation introuvable dans le dossier actif.'] };
    var previousState = clone(st);
    record.active = active === true;
    record.updatedAt = new Date().toISOString();
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le changement d’état de la prestation.'] };
    }
    return { ok: true, errors: [], service: clone(record) };
  }

  function deleteService(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = st.services || [];
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Prestation introuvable dans le dossier actif.'] };
    var record = records[index];
    var references = serviceReferenceCount(record, st);
    if (references) return { ok: false, errors: ['Suppression refusée : ' + references + ' écriture(s) ou mouvement(s) historique(s) référencent cette prestation. Archivez-la pour conserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. La prestation est conservée.'] };
    }
    return { ok: true, errors: [], service: clone(record) };
  }

  function analyticalCenters() {
    var st = load();
    return Array.isArray(st.analyticalCenters) ? st.analyticalCenters : [];
  }

  function analyticalCenter(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var code = normalizeAnalyticalCenterCode(key);
    return analyticalCenters().find(function (record) { return record.id === key || record.code === code; }) || null;
  }

  function nextAnalyticalCenterCode() {
    var st = load();
    if (recoveryIssue) return '';
    var reserved = Object.create(null);
    (Array.isArray(st.analyticalCenterCodeHistory) ? st.analyticalCenterCodeHistory : []).forEach(function (code) {
      reserved[normalizeAnalyticalCenterCode(code)] = true;
    });
    analyticalCenters().forEach(function (record) { reserved[normalizeAnalyticalCenterCode(record.code)] = true; });
    var sequence = Number(st.analyticalCenterSequence) || 1;
    var candidate;
    do {
      candidate = 'ANA-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while (reserved[candidate]);
    return candidate;
  }

  function reserveAnalyticalCenterCode(st, code) {
    if (!Array.isArray(st.analyticalCenterCodeHistory)) st.analyticalCenterCodeHistory = [];
    if (!Number.isInteger(Number(st.analyticalCenterSequence)) || Number(st.analyticalCenterSequence) < 1) st.analyticalCenterSequence = 1;
    var normalized = normalizeAnalyticalCenterCode(code);
    if (normalized && st.analyticalCenterCodeHistory.indexOf(normalized) === -1) st.analyticalCenterCodeHistory.push(normalized);
    var match = /^ANA-(\d+)$/.exec(normalized);
    if (match) st.analyticalCenterSequence = Math.max(Number(st.analyticalCenterSequence) || 1, Number(match[1]) + 1);
  }

  function validateAnalyticalCenterInput(input, excludeId) {
    input = input || {};
    var code = normalizeAnalyticalCenterCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var description = String(input.description == null ? '' : input.description).trim();
    var current = excludeId ? analyticalCenter(excludeId) : null;
    var errors = [];
    if (!code) errors.push('Le code du centre analytique est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('Le nom du centre analytique est obligatoire.');
    else if (name.length > 150) errors.push('Le nom ne peut pas dépasser 150 caractères.');
    if (description.length > 500) errors.push('La description ne peut pas dépasser 500 caractères.');
    if (analyticalCenters().some(function (record) { return record.id !== excludeId && normalizeAnalyticalCenterCode(record.code) === code; })) {
      errors.push('Ce code de centre analytique existe déjà dans le dossier.');
    }
    var st = load();
    if (Array.isArray(st.analyticalCenterCodeHistory) && st.analyticalCenterCodeHistory.indexOf(code) !== -1 && code !== normalizeAnalyticalCenterCode(current && current.code)) {
      errors.push('Ce code de centre analytique a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    }
    return { ok: errors.length === 0, errors: errors, value: { code: code, name: name, description: description } };
  }

  function createAnalyticalCenter(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextAnalyticalCenterCode();
    var validation = validateAnalyticalCenterInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'analytic-center-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (analyticalCenters().some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, active: true, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    st.analyticalCenters.push(record);
    reserveAnalyticalCenterCode(st, record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le centre analytique dans le dossier actif.'] };
    }
    return { ok: true, errors: [], analyticalCenter: clone(record) };
  }

  function analyticalCenterReferenceCount(idOrRecord, st) {
    st = st || load();
    var record = idOrRecord && typeof idOrRecord === 'object' ? idOrRecord : analyticalCenter(idOrRecord);
    if (!record) return 0;
    return registryRecordReferenceCount(st, record, 'analyticalCenter|analytical_center|analyticCenter|analytic_center|analysisCenter|analysis_center');
  }

  function updateAnalyticalCenter(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var index = st.analyticalCenters.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Centre analytique introuvable dans le dossier actif.'] };
    var previous = st.analyticalCenters[index];
    var validation = validateAnalyticalCenterInput(input, id);
    if (!validation.ok) return validation;
    var references = analyticalCenterReferenceCount(previous, st);
    if (references && validation.value.code !== normalizeAnalyticalCenterCode(previous.code)) {
      return { ok: false, errors: ['Le code ne peut pas être modifié : ' + references + ' mouvement(s) analytique(s) y font référence.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, {
      id: previous.id,
      active: previous.active !== false,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString()
    });
    st.analyticalCenters[index] = updated;
    reserveAnalyticalCenterCode(st, previous.code);
    reserveAnalyticalCenterCode(st, updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications du centre analytique.'] };
    }
    return { ok: true, errors: [], analyticalCenter: clone(updated) };
  }

  function setAnalyticalCenterActive(id, active) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var record = analyticalCenters().find(function (item) { return item.id === id; });
    if (!record) return { ok: false, errors: ['Centre analytique introuvable dans le dossier actif.'] };
    var previousState = clone(st);
    record.active = active === true;
    record.updatedAt = new Date().toISOString();
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le changement d’état du centre analytique.'] };
    }
    return { ok: true, errors: [], analyticalCenter: clone(record) };
  }

  function deleteAnalyticalCenter(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = st.analyticalCenters || [];
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Centre analytique introuvable dans le dossier actif.'] };
    var record = records[index];
    var references = analyticalCenterReferenceCount(record, st);
    if (references) return { ok: false, errors: ['Suppression refusée : ' + references + ' mouvement(s) analytique(s) référencent ce centre. Archivez-le pour conserver le référentiel.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. Le centre analytique est conservé.'] };
    }
    return { ok: true, errors: [], analyticalCenter: clone(record) };
  }

  function postedAccountLine(st, accountCode, lineKey) {
    st = st || load();
    accountCode = String(accountCode || '');
    lineKey = String(lineKey || '');
    var separator = lineKey.lastIndexOf(':');
    if (separator <= 0) return null;
    var entryId = lineKey.slice(0, separator);
    var lineIndex = Number(lineKey.slice(separator + 1));
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return null;
    var record = (st.entries || []).find(function (item) {
      return item.id === entryId && item.status === 'posted' && item.date >= st.cycleStart && item.date <= st.cycleEnd;
    });
    if (!record || !Array.isArray(record.lines) || !record.lines[lineIndex] || String(record.lines[lineIndex].account) !== accountCode) return null;
    return { entry: record, line: record.lines[lineIndex], entryId: entryId, lineIndex: lineIndex, lineKey: lineKey };
  }

  function matchingGroups(accountCode) {
    var st = load();
    var records = (st.matchingGroups || []).filter(function (group) {
      return group.status !== 'cancelled' && (!accountCode || String(group.accountCode) === String(accountCode));
    });
    return clone(records);
  }

  function matchingGroup(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var record = (load().matchingGroups || []).find(function (group) { return group.id === key || group.code === key; });
    return record ? clone(record) : null;
  }

  function matchingForLine(lineKey) {
    var key = String(lineKey || '');
    var record = (load().matchingGroups || []).find(function (group) { return group.status !== 'cancelled' && group.lineKeys.indexOf(key) !== -1; });
    return record ? clone(record) : null;
  }

  function assignLetter(accountCode, lineKeys) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Lettrage bloqué : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    accountCode = String(accountCode || '');
    var accountRecord = (st.accounts || []).find(function (item) { return String(item.code) === accountCode; });
    if (!accountRecord || Number(accountRecord.cls) !== 4 || accountRecord.aux !== true || accountRecord.active === false || accountRecord.postable === false) {
      return { ok: false, errors: ['Choisissez un compte auxiliaire actif et imputable de classe 4.'] };
    }
    var keys = (Array.isArray(lineKeys) ? lineKeys : []).map(function (key) { return String(key || ''); }).filter(function (key, index, list) { return !!key && list.indexOf(key) === index; });
    if (keys.length < 2) return { ok: false, errors: ['Sélectionnez au moins deux lignes validées à lettrer.'] };
    var lines = [];
    for (var index = 0; index < keys.length; index += 1) {
      var lineRecord = postedAccountLine(st, accountCode, keys[index]);
      if (!lineRecord) return { ok: false, errors: ['Une ligne sélectionnée n’existe plus dans le compte choisi ou n’est pas validée. Actualisez la liste.'] };
      if ((st.matchingGroups || []).some(function (group) { return group.status !== 'cancelled' && group.lineKeys.indexOf(keys[index]) !== -1; })) {
        return { ok: false, errors: ['Une ligne sélectionnée est déjà lettrée. Actualisez la liste avant de recommencer.'] };
      }
      lines.push(lineRecord);
    }
    var debit = lines.reduce(function (sum, record) { return sum + (Number(record.line.debit) || 0); }, 0);
    var credit = lines.reduce(function (sum, record) { return sum + (Number(record.line.credit) || 0); }, 0);
    if (debit <= 0 || debit !== credit) {
      return { ok: false, errors: ['Le lettrage doit être équilibré : le total débit doit être strictement égal au total crédit.'] };
    }
    var previousState = clone(st);
    var sequence = Number(st.matchingSequence) || 1;
    var year = Number(st.exercise) || EXERCICE;
    var code;
    do {
      code = 'LET-' + year + '-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while ((st.matchingGroups || []).some(function (group) { return group.code === code; }));
    var timestamp = new Date().toISOString();
    var group = {
      id: 'matching-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      code: code,
      accountCode: accountCode,
      lineKeys: keys,
      debit: debit,
      credit: credit,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    st.matchingGroups.push(group);
    st.matchingSequence = sequence;
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le lettrage dans le dossier actif.'] };
    }
    return { ok: true, errors: [], matchingGroup: clone(group) };
  }

  function cancelLetter(idOrCode) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Annulation du lettrage bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var group = (st.matchingGroups || []).find(function (item) { return item.id === idOrCode || item.code === idOrCode; });
    if (!group || group.status === 'cancelled') return { ok: false, errors: ['Lettrage actif introuvable dans le dossier.'] };
    var previousState = clone(st);
    group.status = 'cancelled';
    group.cancelledAt = new Date().toISOString();
    group.updatedAt = group.cancelledAt;
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’annuler ce lettrage dans le dossier actif.'] };
    }
    return { ok: true, errors: [], matchingGroup: clone(group) };
  }

  function pointageMarks(accountCode) {
    var st = load();
    var records = (st.pointageMarks || []).filter(function (mark) {
      return mark.status !== 'cancelled' && (!accountCode || String(mark.accountCode) === String(accountCode));
    });
    return clone(records);
  }

  function pointageForLine(lineKey) {
    var key = String(lineKey || '');
    var record = (load().pointageMarks || []).find(function (mark) { return mark.status !== 'cancelled' && mark.lineKey === key; });
    return record ? clone(record) : null;
  }

  function pointEntryLine(lineKey, statementDate) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Pointage bloqué : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    lineKey = String(lineKey || '');
    var separator = lineKey.lastIndexOf(':');
    var entryId = separator > 0 ? lineKey.slice(0, separator) : '';
    var lineIndex = separator > 0 ? Number(lineKey.slice(separator + 1)) : -1;
    var entryCandidate = (st.entries || []).find(function (item) { return item.id === entryId; });
    var lineCandidate = entryCandidate && Array.isArray(entryCandidate.lines) ? entryCandidate.lines[lineIndex] : null;
    var lineRecord = lineCandidate ? postedAccountLine(st, lineCandidate.account, lineKey) : null;
    if (!lineRecord) return { ok: false, errors: ['La ligne à pointer n’existe plus ou n’est pas une écriture validée. Actualisez la liste.'] };
    var accountRecord = (st.accounts || []).find(function (item) { return String(item.code) === String(lineRecord.line.account); });
    if (!accountRecord || Number(accountRecord.cls) !== 5 || accountRecord.active === false || accountRecord.postable === false) {
      return { ok: false, errors: ['Le pointage est réservé aux comptes de trésorerie actifs et imputables de classe 5.'] };
    }
    statementDate = String(statementDate || '').trim();
    if (statementDate && !parseIsoDate(statementDate)) return { ok: false, errors: ['La date de relevé doit être une date valide au format AAAA-MM-JJ.'] };
    if ((st.pointageMarks || []).some(function (mark) { return mark.status !== 'cancelled' && mark.lineKey === lineKey; })) {
      return { ok: false, errors: ['Cette ligne est déjà pointée.'] };
    }
    var previousState = clone(st);
    var sequence = Number(st.pointageSequence) || 1;
    var year = Number(lineRecord.entry.date.slice(0, 4)) || Number(st.exercise) || EXERCICE;
    var code;
    do {
      code = 'PNT-' + year + '-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while ((st.pointageMarks || []).some(function (mark) { return mark.code === code; }));
    var timestamp = new Date().toISOString();
    var mark = {
      id: 'pointage-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      code: code,
      lineKey: lineKey,
      entryId: lineRecord.entryId,
      lineIndex: lineRecord.lineIndex,
      accountCode: String(lineRecord.line.account),
      entryDate: lineRecord.entry.date,
      reference: String(lineRecord.entry.reference || ''),
      journal: String(lineRecord.entry.journal || ''),
      statementDate: statementDate,
      status: 'pointed',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    st.pointageMarks.push(mark);
    st.pointageSequence = sequence;
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le pointage dans le dossier actif.'] };
    }
    return { ok: true, errors: [], pointageMark: clone(mark) };
  }

  function unpointEntryLine(lineKey) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Annulation du pointage bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    lineKey = String(lineKey || '');
    var mark = (st.pointageMarks || []).find(function (item) { return item.status !== 'cancelled' && item.lineKey === lineKey; });
    if (!mark) return { ok: false, errors: ['Pointage actif introuvable pour cette ligne.'] };
    var previousState = clone(st);
    mark.status = 'cancelled';
    mark.cancelledAt = new Date().toISOString();
    mark.updatedAt = mark.cancelledAt;
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’annuler ce pointage dans le dossier actif.'] };
    }
    return { ok: true, errors: [], pointageMark: clone(mark) };
  }

  function suppliers() {
    var st = load();
    return Array.isArray(st.suppliers) ? st.suppliers : [];
  }

  function supplier(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = key.toLocaleUpperCase();
    return suppliers().find(function (record) {
      return record.id === key || String(record.code || '').toLocaleUpperCase() === normalizedCode;
    }) || null;
  }

  function normalizeSupplierCode(value) {
    return String(value == null ? '' : value).trim().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase();
  }

  function supplierAccount(code) {
    var supplierRoots = ['401', '402', '404', '408', '409'];
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      var supplierControl = supplierRoots.some(function (rootCode) { return accountCode.indexOf(rootCode) === 0; });
      return accountCode === String(code) && supplierControl && Number(account.cls || accountCode.charAt(0)) === 4 &&
        account.aux === true && account.active !== false && account.postable !== false;
    }) || null;
  }

  function validateSupplierInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var code = normalizeSupplierCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var accountCode = String(input.accountCode == null ? '' : input.accountCode).trim();
    var email = String(input.email == null ? '' : input.email).trim();
    var paymentTermDays = input.paymentTermDays === '' || input.paymentTermDays == null ? 30 : Number(input.paymentTermDays);

    if (!code) errors.push('Le code fournisseur est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code fournisseur doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('La raison sociale est obligatoire.');
    else if (name.length > 150) errors.push('La raison sociale ne peut pas dépasser 150 caractères.');
    var st = load();
    var currentRecord = excludeId ? st.suppliers.find(function (record) { return record.id === excludeId; }) : null;
    if (suppliers().some(function (record) {
      return record.id !== excludeId && normalizeSupplierCode(record.code) === code;
    })) errors.push('Ce code fournisseur existe déjà dans le dossier.');
    var currentCode = currentRecord ? normalizeSupplierCode(currentRecord.code) : '';
    if (Array.isArray(st.supplierCodeHistory) && st.supplierCodeHistory.indexOf(code) !== -1 && code !== currentCode) {
      errors.push('Ce code fournisseur a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    }
    if (!supplierAccount(accountCode)) errors.push('Choisissez un compte collectif fournisseur actif de classe 4 (401, 402, 404, 408 ou 409).');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('L’adresse e-mail du fournisseur n’est pas valide.');
    if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0 || paymentTermDays > 3650) errors.push('Le délai de règlement doit être un nombre entier compris entre 0 et 3 650 jours.');

    var fields = [
      ['contactName', 'Le nom du contact', 120], ['ifu', 'Le numéro IFU', 50],
      ['rccm', 'Le numéro RCCM', 80], ['phone', 'Le téléphone', 40],
      ['address', 'L’adresse', 255], ['notes', 'La note', 1000]
    ];
    fields.forEach(function (field) {
      if (String(input[field[0]] == null ? '' : input[field[0]]).trim().length > field[2]) {
        errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
      }
    });
    if (email.length > 254) errors.push('L’adresse e-mail ne peut pas dépasser 254 caractères.');

    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        code: code,
        auxiliaryAccountCode: accountCode + '-' + code,
        name: name,
        contactName: String(input.contactName == null ? '' : input.contactName).trim(),
        ifu: String(input.ifu == null ? '' : input.ifu).trim(),
        rccm: String(input.rccm == null ? '' : input.rccm).trim(),
        email: email,
        phone: String(input.phone == null ? '' : input.phone).trim(),
        address: String(input.address == null ? '' : input.address).trim(),
        accountCode: accountCode,
        paymentTermDays: paymentTermDays,
        notes: String(input.notes == null ? '' : input.notes).trim()
      }
    };
  }

  function createSupplier(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = supplierRecordsForState(st);
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextIdentificationCode('supplier');
    var validation = validateSupplierInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do {
      id = 'supplier-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    } while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, active: true, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveIdentificationCode(st, 'supplier', record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le fournisseur dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], supplier: clone(record) };
  }

  function updateSupplier(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = supplierRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Fournisseur introuvable dans le dossier actif.'] };
    var validation = validateSupplierInput(input, id);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var previous = records[index];
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveIdentificationCode(st, 'supplier', previous.code);
    reserveIdentificationCode(st, 'supplier', updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications du fournisseur dans le stockage local.'] };
    }
    return { ok: true, errors: [], supplier: clone(updated) };
  }

  function setSupplierActive(id, active) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var record = supplierRecordsForState(st).find(function (item) { return item.id === id; });
    if (!record) return { ok: false, errors: ['Fournisseur introuvable dans le dossier actif.'] };
    var previousState = clone(st);
    record.active = active === true;
    record.updatedAt = new Date().toISOString();
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le changement d’état du fournisseur.'] };
    }
    return { ok: true, errors: [], supplier: clone(record) };
  }

  function objectReferencesSupplier(value, supplier) {
    if (!value || typeof value !== 'object') return false;
    var referenceKeys = /^(supplier|vendor|fournisseur|thirdParty|third_party|counterparty|auxiliary|aux)(?:\w*(?:id|code|account))?$/i;
    var identifiers = [supplier.id, supplier.code, supplier.auxiliaryAccountCode].filter(Boolean).map(function (item) { return String(item).toLocaleUpperCase(); });
    return Object.keys(value).some(function (key) {
      var child = value[key];
      if (referenceKeys.test(key) && identifiers.indexOf(String(child == null ? '' : child).toLocaleUpperCase()) !== -1) return true;
      return child && typeof child === 'object' && objectReferencesSupplier(child, supplier);
    });
  }

  function deleteSupplier(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = supplierRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Fournisseur introuvable dans le dossier actif.'] };
    var record = records[index];
    if (st.entries.some(function (entry) { return objectReferencesSupplier(entry, record); })) {
      return { ok: false, errors: ['Suppression refusée : une écriture ou un mouvement historique référence cette fiche. Archivez le fournisseur pour conserver la traçabilité.'] };
    }
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. La fiche est conservée.'] };
    }
    return { ok: true, errors: [], supplier: clone(record) };
  }

  function clientRecordsForState(st) {
    ensureIdentificationState(st);
    return st.clients;
  }

  function clients() {
    var st = load();
    return Array.isArray(st.clients) ? st.clients : [];
  }

  function client(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeSupplierCode(key);
    return clients().find(function (record) {
      return record.id === key || normalizeSupplierCode(record.code) === normalizedCode;
    }) || null;
  }

  function clientAccount(code) {
    var clientRoots = ['411', '412', '413', '416', '419'];
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      var clientControl = clientRoots.some(function (rootCode) { return accountCode.indexOf(rootCode) === 0; });
      return accountCode === String(code) && clientControl && Number(account.cls || accountCode.charAt(0)) === 4 &&
        account.aux === true && account.active !== false && account.postable !== false;
    }) || null;
  }

  function clientAccountReferenceCount(clientRecord, st) {
    st = st || load();
    var keys = /^(client|customer|debtor|thirdParty|third_party|counterparty|auxiliary|aux)(?:\w*(?:id|code|account))?$/i;
    var identifiers = [clientRecord.id, clientRecord.code, clientRecord.auxiliaryAccountCode]
      .filter(Boolean).map(function (value) { return String(value).toLocaleUpperCase(); });
    var auxiliaryAccountCode = String(clientRecord.auxiliaryAccountCode || '').toLocaleUpperCase();
    var accountKeys = /^(?:account|accountCode|account_code|generalAccount|general_account)$/i;
    function containsIdentifier(value) {
      if (!value || typeof value !== 'object') return identifiers.indexOf(String(value == null ? '' : value).toLocaleUpperCase()) !== -1;
      return Object.keys(value).some(function (key) { return containsIdentifier(value[key]); });
    }
    function references(value) {
      if (!value || typeof value !== 'object') return false;
      return Object.keys(value).some(function (key) {
        var child = value[key];
        var normalizedChild = String(child == null ? '' : child).toLocaleUpperCase();
        if ((keys.test(key) && containsIdentifier(child)) ||
          (auxiliaryAccountCode && accountKeys.test(key) && normalizedChild === auxiliaryAccountCode)) return true;
        return child && typeof child === 'object' && references(child);
      });
    }
    return st.entries.filter(references).length;
  }

  function clientCodeChangeCheck(idOrCode) {
    var record = client(idOrCode);
    if (!record) return { ok: false, errors: ['Client introuvable dans le dossier actif.'], referenceCount: 0 };
    var referenceCount = clientAccountReferenceCount(record, load());
    var errors = referenceCount
      ? ['Le code client et son compte collectif ne peuvent pas être modifiés : ' + referenceCount + ' pièce(s) ou mouvement(s) comptable(s) y font référence.']
      : [];
    return { ok: errors.length === 0, errors: errors, referenceCount: referenceCount };
  }

  function validateClientInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var code = normalizeSupplierCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var accountCode = String(input.accountCode == null ? '' : input.accountCode).trim();
    var email = String(input.email == null ? '' : input.email).trim();
    var paymentTermDays = input.paymentTermDays === '' || input.paymentTermDays == null ? 30 : Number(input.paymentTermDays);
    var st = load();
    var currentRecord = excludeId ? st.clients.find(function (record) { return record.id === excludeId; }) : null;
    var currentCode = currentRecord ? normalizeSupplierCode(currentRecord.code) : '';

    if (!code) errors.push('Le code client est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code client doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('Le nom ou la raison sociale du client est obligatoire.');
    else if (name.length > 150) errors.push('Le nom du client ne peut pas dépasser 150 caractères.');
    if (clients().some(function (record) { return record.id !== excludeId && normalizeSupplierCode(record.code) === code; })) {
      errors.push('Ce code client existe déjà dans le dossier.');
    }
    if (Array.isArray(st.clientCodeHistory) && st.clientCodeHistory.indexOf(code) !== -1 && code !== currentCode) {
      errors.push('Ce code client a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    }
    var retainedAccount = currentRecord && String(currentRecord.accountCode || '') === accountCode
      ? st.accounts.find(function (account) { return String(account.code) === accountCode; })
      : null;
    if (!clientAccount(accountCode) && !retainedAccount) errors.push('Choisissez un compte collectif client actif de classe 4 (411, 412, 413, 416 ou 419).');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('L’adresse e-mail du client n’est pas valide.');
    if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0 || paymentTermDays > 3650) errors.push('Le délai de règlement doit être un nombre entier compris entre 0 et 3 650 jours.');
    var fields = [
      ['contactName', 'Le nom du contact', 120], ['ifu', 'Le numéro IFU', 50],
      ['rccm', 'Le numéro RCCM', 80], ['phone', 'Le téléphone', 40],
      ['address', 'L’adresse', 255], ['notes', 'La note', 1000]
    ];
    fields.forEach(function (field) {
      if (String(input[field[0]] == null ? '' : input[field[0]]).trim().length > field[2]) {
        errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
      }
    });
    if (email.length > 254) errors.push('L’adresse e-mail ne peut pas dépasser 254 caractères.');
    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        code: code,
        auxiliaryAccountCode: accountCode + '-' + code,
        name: name,
        contactName: String(input.contactName == null ? '' : input.contactName).trim(),
        ifu: String(input.ifu == null ? '' : input.ifu).trim(),
        rccm: String(input.rccm == null ? '' : input.rccm).trim(),
        email: email,
        phone: String(input.phone == null ? '' : input.phone).trim(),
        address: String(input.address == null ? '' : input.address).trim(),
        accountCode: accountCode,
        paymentTermDays: paymentTermDays,
        notes: String(input.notes == null ? '' : input.notes).trim()
      }
    };
  }

  function createClient(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = clientRecordsForState(st);
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextIdentificationCode('client');
    var validation = validateClientInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do {
      id = 'client-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    } while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveIdentificationCode(st, 'client', record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le client dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], client: clone(record) };
  }

  function updateClient(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = clientRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Client introuvable dans le dossier actif.'] };
    var validation = validateClientInput(input, id);
    if (!validation.ok) return validation;
    var previous = records[index];
    if ((validation.value.code !== normalizeSupplierCode(previous.code) || validation.value.accountCode !== String(previous.accountCode || '')) && clientAccountReferenceCount(previous, st)) {
      return { ok: false, errors: ['Le code client et le compte collectif ne peuvent pas être modifiés : une pièce ou un mouvement comptable y fait référence. Les écritures ne seront pas réécrites.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveIdentificationCode(st, 'client', previous.code);
    reserveIdentificationCode(st, 'client', updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications du client dans le stockage local.'] };
    }
    return { ok: true, errors: [], client: clone(updated) };
  }

  function deleteClient(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = clientRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Client introuvable dans le dossier actif.'] };
    var record = records[index];
    var referenceCount = clientAccountReferenceCount(record, st);
    if (referenceCount) return { ok: false, errors: ['Suppression refusée : ' + referenceCount + ' pièce(s) ou mouvement(s) comptable(s) référence(nt) ce client. La fiche doit être conservée pour préserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. La fiche est conservée.'] };
    }
    return { ok: true, errors: [], client: clone(record) };
  }

  function otherPartyRecordsForState(st) {
    ensureIdentificationState(st);
    return st.otherParties;
  }

  function otherParties(type) {
    var records = load().otherParties || [];
    var normalizedType = String(type || '').toLowerCase();
    return normalizedType ? records.filter(function (record) { return record.type === normalizedType; }) : records;
  }

  function otherParty(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeIdentificationCode('debtor', key);
    return otherParties().find(function (record) {
      return record.id === key || normalizeIdentificationCode(record.type, record.code) === normalizedCode;
    }) || null;
  }

  function otherPartyAccount(code) {
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      return accountCode.indexOf('47') === 0 && accountCode === String(code) &&
        Number(account.cls || accountCode.charAt(0)) === 4 && account.aux === true &&
        account.active !== false && account.postable !== false;
    }) || null;
  }

  function objectReferencesRegistryRecord(value, record, aliases) {
    if (!value || typeof value !== 'object') return false;
    var referenceKeys = new RegExp('^(?:' + aliases + ')(?:\\w*(?:id|code|account))?$', 'i');
    var identifiers = [record.id, record.code, record.auxiliaryAccountCode].filter(Boolean).map(function (item) {
      return String(item).toLocaleUpperCase();
    });
    var auxiliaryAccountCode = String(record.auxiliaryAccountCode || '').toLocaleUpperCase();
    var accountKeys = /^(?:account|accountCode|account_code|generalAccount|general_account)$/i;
    function containsIdentifier(child) {
      if (!child || typeof child !== 'object') return identifiers.indexOf(String(child == null ? '' : child).toLocaleUpperCase()) !== -1;
      return Object.keys(child).some(function (key) { return containsIdentifier(child[key]); });
    }
    return Object.keys(value).some(function (key) {
      var child = value[key];
      var normalizedChild = String(child == null ? '' : child).toLocaleUpperCase();
      if ((referenceKeys.test(key) && containsIdentifier(child)) ||
        (auxiliaryAccountCode && accountKeys.test(key) && normalizedChild === auxiliaryAccountCode)) return true;
      return child && typeof child === 'object' && objectReferencesRegistryRecord(child, record, aliases);
    });
  }

  function registryRecordReferenceCount(st, record, aliases) {
    st = st || load();
    return st.entries.filter(function (entry) { return objectReferencesRegistryRecord(entry, record, aliases); }).length;
  }

  function otherPartyReferenceCount(record, st) {
    return registryRecordReferenceCount(st, record, 'otherParty|debtor|creditor|thirdParty|third_party|counterparty|auxiliary|aux');
  }

  function otherPartyIdentityChangeCheck(idOrCode) {
    var record = otherParty(idOrCode);
    if (!record) return { ok: false, errors: ['Débiteur ou créditeur divers introuvable dans le dossier actif.'], referenceCount: 0 };
    var referenceCount = otherPartyReferenceCount(record, load());
    var errors = referenceCount
      ? ['Le type, le code et le compte collectif ne peuvent pas être modifiés : ' + referenceCount + ' pièce(s) ou mouvement(s) comptable(s) y font référence.']
      : [];
    return { ok: errors.length === 0, errors: errors, referenceCount: referenceCount };
  }

  function validateOtherPartyInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var type = String(input.type || '').toLowerCase();
    var kind = type === 'creditor' ? 'creditor' : 'debtor';
    var code = normalizeIdentificationCode(kind, input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var accountCode = String(input.accountCode == null ? '' : input.accountCode).trim();
    var email = String(input.email == null ? '' : input.email).trim();
    var st = load();
    var currentRecord = excludeId ? st.otherParties.find(function (record) { return record.id === excludeId; }) : null;
    var currentCode = currentRecord ? normalizeIdentificationCode(currentRecord.type, currentRecord.code) : '';
    if (type !== 'debtor' && type !== 'creditor') errors.push('Choisissez « Débiteur » ou « Créditeur ».');
    if (!code) errors.push('Le code du tiers divers est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('Le nom ou la raison sociale est obligatoire.');
    else if (name.length > 150) errors.push('Le nom ne peut pas dépasser 150 caractères.');
    if (otherParties().some(function (record) { return record.id !== excludeId && normalizeIdentificationCode(record.type, record.code) === code; })) {
      errors.push('Ce code existe déjà dans le répertoire des débiteurs et créditeurs divers.');
    }
    var reservedOtherPartyCode = ['debtor', 'creditor'].some(function (historyKind) {
      return Array.isArray(st[identificationHistoryField(historyKind)]) && st[identificationHistoryField(historyKind)].indexOf(code) !== -1;
    });
    if (reservedOtherPartyCode && !(currentRecord && currentRecord.type === type && code === currentCode)) {
      errors.push('Ce code a déjà été attribué dans ce dossier et ne peut pas être réutilisé, quel que soit le type de tiers.');
    }
    var retainedAccount = currentRecord && String(currentRecord.accountCode || '') === accountCode
      ? st.accounts.find(function (account) { return String(account.code) === accountCode; })
      : null;
    if (!otherPartyAccount(accountCode) && !retainedAccount) errors.push('Choisissez un compte auxiliaire actif de la classe 4 et de la famille 47 (débiteurs et créditeurs divers).');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('L’adresse e-mail n’est pas valide.');
    var fields = [
      ['contactName', 'Le nom du contact', 120], ['ifu', 'Le numéro IFU', 50],
      ['rccm', 'Le numéro RCCM', 80], ['phone', 'Le téléphone', 40],
      ['address', 'L’adresse', 255], ['notes', 'La note', 1000]
    ];
    fields.forEach(function (field) {
      if (String(input[field[0]] == null ? '' : input[field[0]]).trim().length > field[2]) errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
    });
    if (email.length > 254) errors.push('L’adresse e-mail ne peut pas dépasser 254 caractères.');
    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        type: type,
        code: code,
        auxiliaryAccountCode: accountCode + '-' + code,
        name: name,
        contactName: String(input.contactName == null ? '' : input.contactName).trim(),
        ifu: String(input.ifu == null ? '' : input.ifu).trim(),
        rccm: String(input.rccm == null ? '' : input.rccm).trim(),
        email: email,
        phone: String(input.phone == null ? '' : input.phone).trim(),
        address: String(input.address == null ? '' : input.address).trim(),
        accountCode: accountCode,
        notes: String(input.notes == null ? '' : input.notes).trim()
      }
    };
  }

  function createOtherParty(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = otherPartyRecordsForState(st);
    input = Object.assign({}, input || {});
    var kind = String(input.type || '').toLowerCase() === 'creditor' ? 'creditor' : 'debtor';
    if (!String(input.code || '').trim()) input.code = nextIdentificationCode(kind);
    var validation = validateOtherPartyInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'other-party-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveIdentificationCode(st, record.type, record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le tiers dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], otherParty: clone(record) };
  }

  function updateOtherParty(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = otherPartyRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Débiteur ou créditeur divers introuvable dans le dossier actif.'] };
    var previous = records[index];
    input = Object.assign({}, input || {});
    var nextType = String(input.type || previous.type).toLowerCase();
    if (nextType !== previous.type && normalizeIdentificationCode(previous.type, input.code) === normalizeIdentificationCode(previous.type, previous.code)) {
      input.code = nextIdentificationCode(nextType);
    }
    var validation = validateOtherPartyInput(input, id);
    if (!validation.ok) return validation;
    var refCount = otherPartyReferenceCount(previous, st);
    var identityChanged = validation.value.type !== previous.type ||
      validation.value.code !== normalizeIdentificationCode(previous.type, previous.code) ||
      validation.value.accountCode !== String(previous.accountCode || '');
    if (refCount && identityChanged) return { ok: false, errors: ['Le type, le code et le compte collectif ne peuvent pas être modifiés : une pièce ou un mouvement comptable y fait référence. Les écritures ne seront pas réécrites.'] };
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveIdentificationCode(st, previous.type, previous.code);
    reserveIdentificationCode(st, updated.type, updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications du tiers dans le stockage local.'] };
    }
    return { ok: true, errors: [], otherParty: clone(updated) };
  }

  function deleteOtherParty(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = otherPartyRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Débiteur ou créditeur divers introuvable dans le dossier actif.'] };
    var record = records[index];
    var refCount = otherPartyReferenceCount(record, st);
    if (refCount) return { ok: false, errors: ['Suppression refusée : ' + refCount + ' pièce(s) ou mouvement(s) comptable(s) référence(nt) ce tiers. La fiche doit être conservée pour préserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. La fiche est conservée.'] };
    }
    return { ok: true, errors: [], otherParty: clone(record) };
  }

  function personnelRecordsForState(st) {
    ensureIdentificationState(st);
    return st.personnel;
  }

  function personnel() {
    var st = load();
    return Array.isArray(st.personnel) ? st.personnel : [];
  }

  function personnelRecord(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeIdentificationCode('personnel', key);
    return personnel().find(function (record) {
      return record.id === key || normalizeIdentificationCode('personnel', record.code) === normalizedCode;
    }) || null;
  }

  function personnelAccount(code) {
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      return accountCode.indexOf('42') === 0 && accountCode === String(code) &&
        Number(account.cls || accountCode.charAt(0)) === 4 && account.aux === true &&
        account.active !== false && account.postable !== false;
    }) || null;
  }

  function personnelReferenceCount(record, st) {
    return registryRecordReferenceCount(st, record, 'personnel|employee|staff|payrollEmployee|payroll_employee|auxiliary|aux');
  }

  function personnelIdentityChangeCheck(idOrCode) {
    var record = personnelRecord(idOrCode);
    if (!record) return { ok: false, errors: ['Membre du personnel introuvable dans le dossier actif.'], referenceCount: 0 };
    var referenceCount = personnelReferenceCount(record, load());
    var errors = referenceCount
      ? ['Le code et le compte collectif ne peuvent pas être modifiés : ' + referenceCount + ' pièce(s) ou mouvement(s) comptable(s) y font référence.']
      : [];
    return { ok: errors.length === 0, errors: errors, referenceCount: referenceCount };
  }

  function validatePersonnelInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var code = normalizeIdentificationCode('personnel', input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var accountCode = String(input.accountCode == null ? '' : input.accountCode).trim();
    var email = String(input.email == null ? '' : input.email).trim();
    var st = load();
    var currentRecord = excludeId ? st.personnel.find(function (record) { return record.id === excludeId; }) : null;
    var currentCode = currentRecord ? normalizeIdentificationCode('personnel', currentRecord.code) : '';
    if (!code) errors.push('Le code personnel est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code personnel doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('Le nom et le prénom sont obligatoires.');
    else if (name.length > 150) errors.push('Le nom ne peut pas dépasser 150 caractères.');
    if (personnel().some(function (record) { return record.id !== excludeId && normalizeIdentificationCode('personnel', record.code) === code; })) errors.push('Ce code personnel existe déjà dans le dossier.');
    if (Array.isArray(st.personnelCodeHistory) && st.personnelCodeHistory.indexOf(code) !== -1 && code !== currentCode) errors.push('Ce code personnel a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    var retainedAccount = currentRecord && String(currentRecord.accountCode || '') === accountCode
      ? st.accounts.find(function (account) { return String(account.code) === accountCode; })
      : null;
    if (!personnelAccount(accountCode) && !retainedAccount) errors.push('Choisissez un compte auxiliaire actif de la classe 4 et de la famille Personnel (42).');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('L’adresse e-mail n’est pas valide.');
    var fields = [
      ['jobTitle', 'La fonction', 120], ['department', 'Le service', 120],
      ['phone', 'Le téléphone', 40], ['address', 'L’adresse', 255], ['notes', 'La note', 1000]
    ];
    fields.forEach(function (field) {
      if (String(input[field[0]] == null ? '' : input[field[0]]).trim().length > field[2]) errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
    });
    if (email.length > 254) errors.push('L’adresse e-mail ne peut pas dépasser 254 caractères.');
    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        code: code,
        auxiliaryAccountCode: accountCode + '-' + code,
        name: name,
        jobTitle: String(input.jobTitle == null ? '' : input.jobTitle).trim(),
        department: String(input.department == null ? '' : input.department).trim(),
        email: email,
        phone: String(input.phone == null ? '' : input.phone).trim(),
        address: String(input.address == null ? '' : input.address).trim(),
        accountCode: accountCode,
        notes: String(input.notes == null ? '' : input.notes).trim()
      }
    };
  }

  function createPersonnel(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = personnelRecordsForState(st);
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextIdentificationCode('personnel');
    var validation = validatePersonnelInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'personnel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveIdentificationCode(st, 'personnel', record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer le membre du personnel dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], personnel: clone(record) };
  }

  function updatePersonnel(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = personnelRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Membre du personnel introuvable dans le dossier actif.'] };
    var validation = validatePersonnelInput(input, id);
    if (!validation.ok) return validation;
    var previous = records[index];
    if ((validation.value.code !== normalizeIdentificationCode('personnel', previous.code) || validation.value.accountCode !== String(previous.accountCode || '')) && personnelReferenceCount(previous, st)) {
      return { ok: false, errors: ['Le code et le compte collectif ne peuvent pas être modifiés : une pièce ou un mouvement comptable y fait référence. Les écritures ne seront pas réécrites.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveIdentificationCode(st, 'personnel', previous.code);
    reserveIdentificationCode(st, 'personnel', updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications du membre du personnel.'] };
    }
    return { ok: true, errors: [], personnel: clone(updated) };
  }

  function deletePersonnel(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = personnelRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Membre du personnel introuvable dans le dossier actif.'] };
    var record = records[index];
    var refCount = personnelReferenceCount(record, st);
    if (refCount) return { ok: false, errors: ['Suppression refusée : ' + refCount + ' pièce(s) ou mouvement(s) comptable(s) référence(nt) ce membre du personnel. La fiche doit être conservée pour préserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. La fiche est conservée.'] };
    }
    return { ok: true, errors: [], personnel: clone(record) };
  }

  /* ---------------- Localisations des immobilisations -------------------- */
  function fixedAssetLocationRecordsForState(st) {
    if (!Array.isArray(st.fixedAssetLocations)) st.fixedAssetLocations = [];
    if (!Array.isArray(st.fixedAssetLocationCodeHistory)) st.fixedAssetLocationCodeHistory = [];
    if (!Number.isInteger(Number(st.fixedAssetLocationSequence)) || Number(st.fixedAssetLocationSequence) < 1) st.fixedAssetLocationSequence = 1;
    return st.fixedAssetLocations;
  }

  function fixedAssetLocations() {
    var st = load();
    return Array.isArray(st.fixedAssetLocations) ? st.fixedAssetLocations : [];
  }

  function fixedAssetLocation(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeFixedAssetLocationCode(key);
    return fixedAssetLocations().find(function (record) {
      return record.id === key || normalizeFixedAssetLocationCode(record.code) === normalizedCode;
    }) || null;
  }

  function nextFixedAssetLocationCode() {
    var st = load();
    if (recoveryIssue) return '';
    var records = fixedAssetLocationRecordsForState(st);
    var history = st.fixedAssetLocationCodeHistory;
    records.forEach(function (record) {
      var code = normalizeFixedAssetLocationCode(record && record.code);
      if (code && history.indexOf(code) === -1) history.push(code);
    });
    var sequence = Number(st.fixedAssetLocationSequence) || 1;
    var candidate;
    do {
      candidate = 'LOC-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while (history.indexOf(candidate) !== -1);
    return candidate;
  }

  function reserveFixedAssetLocationCode(st, code) {
    fixedAssetLocationRecordsForState(st);
    var normalized = normalizeFixedAssetLocationCode(code);
    if (normalized && st.fixedAssetLocationCodeHistory.indexOf(normalized) === -1) st.fixedAssetLocationCodeHistory.push(normalized);
    var match = /^LOC-(\d+)$/.exec(normalized);
    if (match) st.fixedAssetLocationSequence = Math.max(Number(st.fixedAssetLocationSequence) || 1, Number(match[1]) + 1);
  }

  function fixedAssetLocationReferenceCount(record, st) {
    var fields = ['fixedAssets', 'fixedAssetItems', 'immobilisations', 'immobilizations'];
    var referenceIds = Object.create(null);
    var count = 0;
    fields.forEach(function (field) {
      (Array.isArray(st[field]) ? st[field] : []).forEach(function (asset, index) {
        if (!asset || typeof asset !== 'object') return;
        var locationId = asset.locationId || asset.fixedAssetLocationId || asset.immobilisationLocationId;
        var locationCode = asset.locationCode || asset.fixedAssetLocationCode;
        if (String(locationId || '') !== String(record.id) && normalizeFixedAssetLocationCode(locationCode) !== normalizeFixedAssetLocationCode(record.code)) return;
        var key = asset.id ? String(asset.id) : field + ':' + index;
        if (referenceIds[key]) return;
        referenceIds[key] = true;
        count += 1;
      });
    });
    return count;
  }

  function fixedAssetLocationWouldCreateCycle(id, parentId, records) {
    var cursor = String(parentId || '');
    var visited = Object.create(null);
    while (cursor) {
      if (cursor === String(id || '')) return true;
      if (visited[cursor]) return true;
      visited[cursor] = true;
      var parent = records.find(function (record) { return record.id === cursor; });
      if (!parent) return false;
      cursor = String(parent.parentId || '');
    }
    return false;
  }

  function validateFixedAssetLocationInput(input, excludeId) {
    input = input || {};
    var errors = [];
    var st = load();
    var records = fixedAssetLocationRecordsForState(st);
    var code = normalizeFixedAssetLocationCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var level = String(input.level == null ? '' : input.level).trim();
    var parentId = String(input.parentId == null ? '' : input.parentId).trim();
    var address = String(input.address == null ? '' : input.address).trim();
    var responsible = String(input.responsible == null ? '' : input.responsible).trim();
    var notes = String(input.notes == null ? '' : input.notes).trim();
    var currentRecord = excludeId ? records.find(function (record) { return record.id === excludeId; }) : null;
    var currentCode = currentRecord ? normalizeFixedAssetLocationCode(currentRecord.code) : '';

    if (!code) errors.push('Le code de localisation est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('La désignation de l’emplacement est obligatoire.');
    else if (name.length > 150) errors.push('La désignation ne peut pas dépasser 150 caractères.');
    if (!level) errors.push('Le niveau hiérarchique est obligatoire (par exemple : site, bâtiment, étage ou local).');
    else if (level.length > 80) errors.push('Le niveau hiérarchique ne peut pas dépasser 80 caractères.');
    if (records.some(function (record) { return record.id !== excludeId && normalizeFixedAssetLocationCode(record.code) === code; })) errors.push('Ce code de localisation existe déjà dans le dossier.');
    if (Array.isArray(st.fixedAssetLocationCodeHistory) && st.fixedAssetLocationCodeHistory.indexOf(code) !== -1 && code !== currentCode) errors.push('Ce code de localisation a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');
    if (parentId) {
      var parent = records.find(function (record) { return record.id === parentId; });
      if (!parent) errors.push('L’emplacement parent choisi n’existe plus dans le dossier actif.');
      else if (fixedAssetLocationWouldCreateCycle(excludeId, parentId, records)) errors.push('Cette hiérarchie créerait une boucle : un emplacement ne peut pas devenir son propre parent ou celui de l’un de ses ancêtres.');
    }
    [
      [address, 'L’adresse ou la précision de localisation', 255],
      [responsible, 'Le responsable ou service', 150],
      [notes, 'La note', 1000]
    ].forEach(function (field) {
      if (field[0].length > field[2]) errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
    });
    return {
      ok: errors.length === 0,
      errors: errors,
      value: { code: code, name: name, level: level, parentId: parentId, address: address, responsible: responsible, notes: notes }
    };
  }

  function createFixedAssetLocation(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetLocationRecordsForState(st);
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextFixedAssetLocationCode();
    var validation = validateFixedAssetLocationInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'fixed-asset-location-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveFixedAssetLocationCode(st, record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer l’emplacement dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], location: clone(record) };
  }

  function updateFixedAssetLocation(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetLocationRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Emplacement d’immobilisation introuvable dans le dossier actif.'] };
    var previous = records[index];
    var validation = validateFixedAssetLocationInput(input, id);
    if (!validation.ok) return validation;
    var referenceCount = fixedAssetLocationReferenceCount(previous, st);
    if (referenceCount && (validation.value.code !== normalizeFixedAssetLocationCode(previous.code) || validation.value.parentId !== String(previous.parentId || ''))) {
      return { ok: false, errors: ['Le code et le rattachement hiérarchique ne peuvent pas être modifiés : ' + referenceCount + ' immobilisation(s) utilisent déjà cet emplacement.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveFixedAssetLocationCode(st, previous.code);
    reserveFixedAssetLocationCode(st, updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications de l’emplacement.'] };
    }
    return { ok: true, errors: [], location: clone(updated) };
  }

  function deleteFixedAssetLocation(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetLocationRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Emplacement d’immobilisation introuvable dans le dossier actif.'] };
    var record = records[index];
    var childCount = records.filter(function (candidate) { return String(candidate.parentId || '') === String(record.id); }).length;
    if (childCount) return { ok: false, errors: ['Suppression refusée : cet emplacement possède ' + childCount + ' sous-emplacement(s). Déplacez-les ou supprimez-les d’abord.'] };
    var referenceCount = fixedAssetLocationReferenceCount(record, st);
    if (referenceCount) return { ok: false, errors: ['Suppression refusée : ' + referenceCount + ' immobilisation(s) utilisent cet emplacement. La fiche doit être conservée pour préserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. L’emplacement est conservé.'] };
    }
    return { ok: true, errors: [], location: clone(record) };
  }

  /* ---------------- Registre des éléments immobilisés -------------------- */
  function fixedAssetRecordsForState(st) {
    if (!Array.isArray(st.fixedAssets)) st.fixedAssets = [];
    if (!Array.isArray(st.fixedAssetCodeHistory)) st.fixedAssetCodeHistory = [];
    if (!Number.isInteger(Number(st.fixedAssetSequence)) || Number(st.fixedAssetSequence) < 1) st.fixedAssetSequence = 1;
    return st.fixedAssets;
  }

  function fixedAssets() {
    var st = load();
    return Array.isArray(st.fixedAssets) ? st.fixedAssets : [];
  }

  function fixedAsset(idOrCode) {
    var key = String(idOrCode == null ? '' : idOrCode);
    var normalizedCode = normalizeFixedAssetCode(key);
    return fixedAssets().find(function (record) {
      return record.id === key || normalizeFixedAssetCode(record.code) === normalizedCode;
    }) || null;
  }

  function nextFixedAssetCode() {
    var st = load();
    if (recoveryIssue) return '';
    var records = fixedAssetRecordsForState(st);
    var history = st.fixedAssetCodeHistory;
    records.forEach(function (record) {
      var code = normalizeFixedAssetCode(record && record.code);
      if (code && history.indexOf(code) === -1) history.push(code);
    });
    var sequence = Number(st.fixedAssetSequence) || 1;
    var candidate;
    do {
      candidate = 'IMMO-' + String(sequence).padStart(4, '0');
      sequence += 1;
    } while (history.indexOf(candidate) !== -1);
    return candidate;
  }

  function reserveFixedAssetCode(st, code) {
    fixedAssetRecordsForState(st);
    var normalized = normalizeFixedAssetCode(code);
    if (normalized && st.fixedAssetCodeHistory.indexOf(normalized) === -1) st.fixedAssetCodeHistory.push(normalized);
    var match = /^IMMO-(\d+)$/.exec(normalized);
    if (match) st.fixedAssetSequence = Math.max(Number(st.fixedAssetSequence) || 1, Number(match[1]) + 1);
  }

  function fixedAssetTypePrefixes(type) {
    return {
      corporelle: ['22', '23', '24'],
      incorporelle: ['20', '21'],
      financiere: ['26', '27']
    }[String(type || '')] || [];
  }

  function fixedAssetAccount(code, type) {
    var value = String(code || '');
    var prefixes = fixedAssetTypePrefixes(type);
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      var classCode = Number(account.cls || accountCode.charAt(0));
      return accountCode === value && classCode === 2 && prefixes.some(function (prefix) { return accountCode.indexOf(prefix) === 0; }) &&
        accountCode.indexOf('25') !== 0 && accountCode.indexOf('28') !== 0 && account.active !== false && account.postable !== false;
    }) || null;
  }

  function fixedAssetAccumulatedDepreciationAccount(code, type) {
    var prefix = type === 'corporelle' ? '283' : (type === 'incorporelle' ? '281' : '');
    if (!prefix) return null;
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      return accountCode === String(code || '') && accountCode.indexOf(prefix) === 0 &&
        Number(account.cls || accountCode.charAt(0)) === 2 && account.active !== false && account.postable !== false;
    }) || null;
  }

  function fixedAssetDepreciationExpenseAccount(code) {
    return load().accounts.find(function (account) {
      var accountCode = String(account.code);
      return accountCode === String(code || '') && accountCode.indexOf('68') === 0 &&
        Number(account.cls || accountCode.charAt(0)) === 6 && account.active !== false && account.postable !== false;
    }) || null;
  }

  function fixedAssetRecordsReferenceCount(record, st) {
    var fields = ['fixedAssetMovements', 'assetMovements', 'fixedAssetDepreciationRuns', 'depreciationRuns', 'fixedAssetDisposals', 'assetDisposals', 'fixedAssetEntries'];
    var seen = Object.create(null);
    var count = 0;
    function isReference(item) {
      if (!item || typeof item !== 'object') return false;
      var referenceId = item.fixedAssetId || item.assetId || item.immobilisationId;
      var referenceCode = item.fixedAssetCode || item.assetCode || item.immobilisationCode;
      return String(referenceId || '') === String(record.id) || normalizeFixedAssetCode(referenceCode) === normalizeFixedAssetCode(record.code);
    }
    fields.forEach(function (field) {
      (Array.isArray(st[field]) ? st[field] : []).forEach(function (item, index) {
        if (!isReference(item)) return;
        var key = item.id ? String(item.id) : field + ':' + index;
        if (seen[key]) return;
        seen[key] = true;
        count += 1;
      });
    });
    (Array.isArray(st.entries) ? st.entries : []).forEach(function (entryRecord) {
      (entryRecord && Array.isArray(entryRecord.lines) ? entryRecord.lines : []).forEach(function (line, index) {
        if (!isReference(line)) return;
        var key = entryRecord.id ? String(entryRecord.id) + ':' + index : 'entry:' + count;
        if (seen[key]) return;
        seen[key] = true;
        count += 1;
      });
    });
    return count;
  }

  function fixedAssetProtectedFieldsChanged(previous, next) {
    var fields = [
      'code', 'assetType', 'assetAccountCode', 'accumulatedDepreciationAccountCode', 'depreciationExpenseAccountCode',
      'acquisitionDate', 'commissioningDate', 'grossCost', 'residualValue', 'depreciationStartDate',
      'depreciationMethod', 'usefulLifeMonths', 'annualRatePercent', 'unitOfProductionTotal', 'unitOfProductionUnit'
    ];
    return fields.some(function (field) { return String(previous[field] == null ? '' : previous[field]) !== String(next[field] == null ? '' : next[field]); });
  }

  function validateFixedAssetInput(input, excludeId) {
    input = input || {};
    var st = load();
    var records = fixedAssetRecordsForState(st);
    var errors = [];
    var code = normalizeFixedAssetCode(input.code);
    var name = String(input.name == null ? '' : input.name).trim();
    var description = String(input.description == null ? '' : input.description).trim();
    var assetType = String(input.assetType == null ? '' : input.assetType).trim();
    var status = String(input.status == null ? '' : input.status).trim();
    var acquisitionDate = String(input.acquisitionDate == null ? '' : input.acquisitionDate).trim();
    var commissioningDate = String(input.commissioningDate == null ? '' : input.commissioningDate).trim();
    var depreciationStartDate = String(input.depreciationStartDate == null ? '' : input.depreciationStartDate).trim();
    var warrantyEndDate = String(input.warrantyEndDate == null ? '' : input.warrantyEndDate).trim();
    var lastInventoryDate = String(input.lastInventoryDate == null ? '' : input.lastInventoryDate).trim();
    var depreciationMethod = String(input.depreciationMethod == null ? 'a-definir' : input.depreciationMethod).trim();
    var assetAccountCode = String(input.assetAccountCode == null ? '' : input.assetAccountCode).trim();
    var accumulatedDepreciationAccountCode = String(input.accumulatedDepreciationAccountCode == null ? '' : input.accumulatedDepreciationAccountCode).trim();
    var depreciationExpenseAccountCode = String(input.depreciationExpenseAccountCode == null ? '' : input.depreciationExpenseAccountCode).trim();
    var locationId = String(input.locationId == null ? '' : input.locationId).trim();
    var currentRecord = excludeId ? records.find(function (record) { return record.id === excludeId; }) : null;
    var currentCode = currentRecord ? normalizeFixedAssetCode(currentRecord.code) : '';
    var typeOptions = ['corporelle', 'incorporelle', 'financiere'];
    var statusOptions = ['en-service', 'en-cours', 'retiree'];
    var depreciationOptions = ['a-definir', 'lineaire', 'degressif', 'unites-oeuvre', 'aucun'];

    if (!code) errors.push('Le code de l’immobilisation est obligatoire.');
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,31}$/.test(code)) errors.push('Le code doit contenir au plus 32 caractères : lettres, chiffres, point, tiret, barre oblique ou souligné.');
    if (!name) errors.push('La désignation de l’immobilisation est obligatoire.');
    else if (name.length > 150) errors.push('La désignation ne peut pas dépasser 150 caractères.');
    if (description.length > 500) errors.push('La description ne peut pas dépasser 500 caractères.');
    if (typeOptions.indexOf(assetType) === -1) errors.push('Sélectionnez une nature d’immobilisation valide.');
    if (statusOptions.indexOf(status) === -1) errors.push('Sélectionnez un état d’immobilisation valide.');
    if (depreciationOptions.indexOf(depreciationMethod) === -1) errors.push('Sélectionnez une méthode d’amortissement valide.');
    if (records.some(function (record) { return record.id !== excludeId && normalizeFixedAssetCode(record.code) === code; })) errors.push('Ce code d’immobilisation existe déjà dans le dossier.');
    if (Array.isArray(st.fixedAssetCodeHistory) && st.fixedAssetCodeHistory.indexOf(code) !== -1 && code !== currentCode) errors.push('Ce code d’immobilisation a déjà été attribué dans ce dossier et ne peut pas être réutilisé.');

    if (!parseIsoDate(acquisitionDate)) errors.push('La date d’acquisition ou de début des travaux est obligatoire et doit être une date valide.');
    if (commissioningDate && !parseIsoDate(commissioningDate)) errors.push('La date de mise en service est invalide.');
    if (warrantyEndDate && !parseIsoDate(warrantyEndDate)) errors.push('La date de fin de garantie est invalide.');
    if (lastInventoryDate && !parseIsoDate(lastInventoryDate)) errors.push('La date du dernier inventaire physique est invalide.');
    if (depreciationStartDate && !parseIsoDate(depreciationStartDate)) errors.push('La date de début d’amortissement est invalide.');
    if ((status === 'en-service' || status === 'retiree') && !commissioningDate) errors.push('Une date de mise en service est requise pour un bien en service ou retiré.');
    if (parseIsoDate(acquisitionDate) && parseIsoDate(commissioningDate) && commissioningDate < acquisitionDate) errors.push('La mise en service ne peut pas précéder l’acquisition ou le début des travaux.');
    if (parseIsoDate(depreciationStartDate) && commissioningDate && parseIsoDate(commissioningDate) && depreciationStartDate < commissioningDate) errors.push('L’amortissement ne peut pas commencer avant la mise en service.');

    var grossCost = input.grossCost === '' || input.grossCost == null ? 0 : Number(input.grossCost);
    var residualValue = input.residualValue === '' || input.residualValue == null ? 0 : Number(input.residualValue);
    if (input.grossCost === '' || input.grossCost == null) errors.push('Le coût d’acquisition en XOF est obligatoire.');
    if (!Number.isSafeInteger(grossCost) || grossCost < 0) errors.push('Le coût d’acquisition doit être un montant positif ou nul en XOF, sans décimales.');
    if (!Number.isSafeInteger(residualValue) || residualValue < 0) errors.push('La valeur résiduelle doit être un montant positif ou nul en XOF, sans décimales.');
    if (Number.isSafeInteger(grossCost) && Number.isSafeInteger(residualValue) && residualValue > grossCost) errors.push('La valeur résiduelle ne peut pas dépasser le coût d’acquisition.');
    if ((status === 'en-service' || status === 'retiree') && grossCost <= 0) errors.push('Un coût d’acquisition supérieur à zéro est requis pour un bien en service ou retiré.');

    var usefulLifeMonths = input.usefulLifeMonths === '' || input.usefulLifeMonths == null ? 0 : Number(input.usefulLifeMonths);
    var annualRatePercent = input.annualRatePercent === '' || input.annualRatePercent == null ? 0 : Number(input.annualRatePercent);
    var unitOfProductionTotal = input.unitOfProductionTotal === '' || input.unitOfProductionTotal == null ? 0 : Number(input.unitOfProductionTotal);
    var amortizable = ['lineaire', 'degressif', 'unites-oeuvre'].indexOf(depreciationMethod) !== -1;
    if (amortizable) {
      if (!Number.isInteger(usefulLifeMonths) || usefulLifeMonths < 1 || usefulLifeMonths > 1200) errors.push('La durée d’utilisation doit être comprise entre 1 et 1 200 mois.');
      if (!parseIsoDate(depreciationStartDate)) errors.push('Une date de début d’amortissement valide est requise pour une méthode amortissable.');
      if (assetType === 'financiere') errors.push('Une immobilisation financière ne peut pas recevoir un plan d’amortissement dans ce référentiel.');
      if (!fixedAssetAccumulatedDepreciationAccount(accumulatedDepreciationAccountCode, assetType)) errors.push('Choisissez un compte d’amortissement cumulé actif cohérent avec la nature du bien (281 ou 283).');
      if (!fixedAssetDepreciationExpenseAccount(depreciationExpenseAccountCode)) errors.push('Choisissez un compte actif de dotation aux amortissements de la famille 68.');
      if (depreciationMethod === 'degressif' && (!Number.isFinite(annualRatePercent) || annualRatePercent <= 0 || annualRatePercent > 100)) errors.push('Le taux annuel dégressif doit être supérieur à 0 et inférieur ou égal à 100 %.');
      if (depreciationMethod === 'unites-oeuvre') {
        if (!Number.isSafeInteger(unitOfProductionTotal) || unitOfProductionTotal <= 0) errors.push('Le nombre total d’unités d’œuvre estimé doit être un entier supérieur à zéro.');
        if (!String(input.unitOfProductionUnit || '').trim()) errors.push('Précisez l’unité d’œuvre (heures, kilomètres, unités produites…).');
      }
    }
    if (annualRatePercent && (!Number.isFinite(annualRatePercent) || annualRatePercent <= 0 || annualRatePercent > 100)) errors.push('Le taux annuel doit être supérieur à 0 et inférieur ou égal à 100 %.');

    var assetAccount = fixedAssetAccount(assetAccountCode, assetType);
    if (!assetAccount) errors.push('Choisissez un compte actif et imputable de classe 2 correspondant à la nature du bien.');
    if (locationId && !fixedAssetLocations().some(function (location) { return String(location.id) === locationId; })) errors.push('La localisation sélectionnée n’existe plus dans le dossier actif.');
    var textFields = [
      ['manufacturer', 'Le fabricant', 100], ['model', 'Le modèle', 100], ['serialNumber', 'Le numéro de série', 100],
      ['vendor', 'Le fournisseur', 150], ['invoiceReference', 'La référence de facture', 100],
      ['custodian', 'Le responsable ou détenteur', 150], ['unitOfProductionUnit', 'L’unité d’œuvre', 40], ['notes', 'La note', 1000]
    ];
    textFields.forEach(function (field) {
      if (String(input[field[0]] == null ? '' : input[field[0]]).trim().length > field[2]) errors.push(field[1] + ' ne peut pas dépasser ' + field[2] + ' caractères.');
    });
    return {
      ok: errors.length === 0,
      errors: errors,
      value: {
        code: code, name: name, description: description, assetType: assetType, status: status,
        assetAccountCode: assetAccountCode, accumulatedDepreciationAccountCode: accumulatedDepreciationAccountCode,
        depreciationExpenseAccountCode: depreciationExpenseAccountCode, locationId: locationId,
        acquisitionDate: acquisitionDate, commissioningDate: commissioningDate, depreciationStartDate: depreciationStartDate,
        grossCost: grossCost, residualValue: residualValue, depreciationMethod: depreciationMethod,
        usefulLifeMonths: usefulLifeMonths, annualRatePercent: annualRatePercent,
        unitOfProductionTotal: unitOfProductionTotal, unitOfProductionUnit: String(input.unitOfProductionUnit == null ? '' : input.unitOfProductionUnit).trim(),
        manufacturer: String(input.manufacturer == null ? '' : input.manufacturer).trim(),
        model: String(input.model == null ? '' : input.model).trim(),
        serialNumber: String(input.serialNumber == null ? '' : input.serialNumber).trim(),
        vendor: String(input.vendor == null ? '' : input.vendor).trim(),
        invoiceReference: String(input.invoiceReference == null ? '' : input.invoiceReference).trim(),
        custodian: String(input.custodian == null ? '' : input.custodian).trim(),
        warrantyEndDate: warrantyEndDate, lastInventoryDate: lastInventoryDate,
        notes: String(input.notes == null ? '' : input.notes).trim()
      }
    };
  }

  function createFixedAsset(input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetRecordsForState(st);
    input = Object.assign({}, input || {});
    if (!String(input.code || '').trim()) input.code = nextFixedAssetCode();
    var validation = validateFixedAssetInput(input);
    if (!validation.ok) return validation;
    var previousState = clone(st);
    var id;
    do { id = 'fixed-asset-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7); }
    while (records.some(function (record) { return record.id === id; }));
    var timestamp = new Date().toISOString();
    var record = Object.assign({ id: id, createdAt: timestamp, updatedAt: timestamp }, validation.value);
    records.push(record);
    reserveFixedAssetCode(st, record.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer l’immobilisation dans le stockage local de ce dossier.'] };
    }
    return { ok: true, errors: [], fixedAsset: clone(record) };
  }

  function updateFixedAsset(id, input) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Élément immobilisé introuvable dans le dossier actif.'] };
    var previous = records[index];
    var validation = validateFixedAssetInput(input, id);
    if (!validation.ok) return validation;
    var refCount = fixedAssetRecordsReferenceCount(previous, st);
    if (refCount && fixedAssetProtectedFieldsChanged(previous, validation.value)) {
      return { ok: false, errors: ['Les paramètres comptables et d’amortissement ne peuvent pas être modifiés : ' + refCount + ' mouvement(s) ou écriture(s) font référence à cet élément. Les écritures historiques ne seront pas réécrites.'] };
    }
    var previousState = clone(st);
    var updated = Object.assign({}, previous, validation.value, { id: previous.id, createdAt: previous.createdAt, updatedAt: new Date().toISOString() });
    records[index] = updated;
    reserveFixedAssetCode(st, previous.code);
    reserveFixedAssetCode(st, updated.code);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Impossible d’enregistrer les modifications de l’immobilisation.'] };
    }
    return { ok: true, errors: [], fixedAsset: clone(updated) };
  }

  function deleteFixedAsset(id) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var records = fixedAssetRecordsForState(st);
    var index = records.findIndex(function (record) { return record.id === id; });
    if (index < 0) return { ok: false, errors: ['Élément immobilisé introuvable dans le dossier actif.'] };
    var record = records[index];
    var refCount = fixedAssetRecordsReferenceCount(record, st);
    if (refCount) return { ok: false, errors: ['Suppression refusée : ' + refCount + ' mouvement(s) ou écriture(s) référence(nt) cet élément. Il doit être conservé pour préserver la traçabilité.'] };
    var previousState = clone(st);
    records.splice(index, 1);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. L’élément immobilisé est conservé.'] };
    }
    return { ok: true, errors: [], fixedAsset: clone(record) };
  }

  function entries() { return load().entries; }

  function entry(id) {
    return load().entries.find(function (e) { return e.id === id; }) || null;
  }

  function periods() { return load().periods; }

  /* ---------------- Périodes ---------------- */
  function ensureYear(year) {
    var st = load();
    for (var m = 1; m <= 12; m++) {
      var exists = st.periods.some(function (p) { return p.year === year && p.month === m; });
      if (!exists) st.periods.push({ year: year, month: m, status: 'open' });
    }
    st.periods.sort(function (a, b) { return a.year - b.year || a.month - b.month; });
  }

  function ensurePeriodsForEntries() {
    var st = load();
    st.entries.forEach(function (e) {
      var y = Number(String(e.date).slice(0, 4));
      if (y) ensureYear(y);
    });
  }

  function period(year, month) {
    var st = load();
    return st.periods.find(function (p) { return p.year === year && p.month === month; }) || null;
  }

  function periodStatus(year, month) {
    var p = period(year, month);
    return p ? p.status : 'open';
  }

  function years() {
    return [exercise()];
  }

  function setPeriod(year, month, status) {
    var st = load();
    ensureYear(year);
    var p = period(year, month);
    p.status = status;
    save();
    return p;
  }

  /* ---------------- Écritures ---------------- */
  function nextReference(journalCode, date) {
    var year = Number(String(date || '').slice(0, 4)) || EXERCICE;
    var journalRecord = journal(journalCode);
    var referencePrefix = journalRecord ? journalRecord.referencePrefix || journalRecord.code : normalizeJournalCode(journalCode);
    var prefix = referencePrefix + '-' + year + '-';
    var max = 0;
    entries().forEach(function (e) {
      if (e.reference && e.reference.indexOf(prefix) === 0) {
        var n = parseInt(e.reference.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    });
    return prefix + String(max + 1).padStart(3, '0');
  }

  function totals(lines) {
    var debit = 0;
    var credit = 0;
    (lines || []).forEach(function (l) {
      debit += Number(l.debit) || 0;
      credit += Number(l.credit) || 0;
    });
    return { debit: debit, credit: credit, balanced: debit === credit && debit > 0 };
  }

  /**
   * Valide une pièce. Renvoie { ok, errors: [], entry }.
   * Règles : référence unique, journal et comptes existants, débit XOR crédit,
   * au moins deux lignes, période ouverte, équilibre si validation définitive.
   */
  function validateEntry(payload, options) {
    var opts = options || {};
    var errors = [];
    var st = load();
    var reference = String(payload.reference || '').trim();
    var journalCode = payload.journal;
    var journalRecord = journal(journalCode);
    var date = payload.date;
    var lines = payload.lines || [];

    if (!reference) errors.push('La référence de la pièce est obligatoire.');
    if (!opts.ignoreUnique && st.entries.some(function (e) { return e.reference === reference && e.id !== payload.id; })) {
      errors.push('La référence « ' + reference + ' » existe déjà.');
    }
    if (!journalRecord) {
      errors.push('Le journal sélectionné est inconnu.');
    } else {
      journalCode = journalRecord.code;
      if (journalRecord.retired) {
        errors.push('Ce journal a été retiré ; aucune nouvelle écriture n’est autorisée.');
      }
      if (journalRecord.systemManaged && opts.systemSource !== journalRecord.systemSource) {
        errors.push('Ce journal est réservé aux écritures générées par le système ; la saisie manuelle et l’import sont interdits.');
      }
      if (!journalRecord.systemManaged && opts.systemSource) {
        errors.push('La source automatique ne correspond pas à un journal système.');
      }
      if (journalRecord.active === false && !opts.allowInactiveJournal) {
        errors.push('Ce journal est inactif et ne peut recevoir de nouvelle écriture.');
      }
    }
    if (!parseIsoDate(date)) {
      errors.push('La date de la pièce est obligatoire et doit être une date valide.');
    } else {
      var y = Number(date.slice(0, 4));
      var m = Number(date.slice(5, 7));
      if (date < st.cycleStart || date > st.cycleEnd) errors.push('La date doit se situer dans le cycle du dossier (' + st.cycleStart + ' au ' + st.cycleEnd + ').');
      if (periodStatus(y, m) === 'closed') {
        errors.push('La période ' + monthLabel(m) + ' ' + y + ' est clôturée.');
      }
    }

    var cleanLines = [];
    lines.forEach(function (line, index) {
      var debit = Number(line.debit) || 0;
      var credit = Number(line.credit) || 0;
      var acc = line.account;
      var label = 'Ligne ' + (index + 1) + ' : ';
      // Une ligne sans montant est ignorée, même si un compte y a été choisi.
      if (debit === 0 && credit === 0) return;
      var accountRecord = acc ? account(acc) : null;
      if (!acc || !accountRecord) {
        errors.push(label + 'le compte est obligatoire.');
        return;
      }
      if (journalRecord && !accountAllowedForJournalRecord(journalRecord, acc)) {
        errors.push(label + 'le compte ' + acc + ' n’est pas autorisé pour le journal « ' + journalRecord.code + ' ».');
        return;
      }
      if (accountRecord.active === false) {
        errors.push(label + 'le compte sélectionné est inactif.');
        return;
      }
      if (accountRecord.postable === false) {
        errors.push(label + 'le compte sélectionné est une rubrique de regroupement ou un indicateur non imputable.');
        return;
      }
      if (debit < 0 || credit < 0) {
        errors.push(label + 'les montants doivent être positifs.');
        return;
      }
      if (debit > 0 && credit > 0) {
        errors.push(label + 'un débit et un crédit ne peuvent pas coexister.');
        return;
      }
      cleanLines.push({ account: acc, debit: debit, credit: credit });
    });

    if (cleanLines.length < 2) {
      errors.push('Une pièce doit comporter au moins deux lignes mouvementées.');
    }

    var t = totals(cleanLines);
    if (opts.requireBalanced && !t.balanced) {
      errors.push('La pièce n’est pas équilibrée : débit ' + t.debit + ' ≠ crédit ' + t.credit + '.');
    }

    var normalizedEntry = {
      id: payload.id || null,
      reference: reference,
      journal: journalCode,
      date: date,
      description: String(payload.description || '').trim(),
      status: opts.status || 'draft',
      lines: cleanLines
    };
    if (journalRecord && journalRecord.systemManaged && opts.systemSource === journalRecord.systemSource) {
      normalizedEntry.sourceSystem = opts.systemSource;
    }
    return { ok: errors.length === 0, errors: errors, entry: normalizedEntry };
  }

  function createEntry(payload, status, options) {
    var createOptions = options || {};
    var result = validateEntry(payload, {
      requireBalanced: status === 'posted',
      status: status,
      systemSource: createOptions.systemSource
    });
    if (!result.ok) return result;

    var st = load();
    ensureYear(Number(result.entry.date.slice(0, 4)));
    var record = result.entry;
    record.id = 'e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    record.createdAt = new Date().toISOString();
    st.entries.push(record);
    save();
    return { ok: true, errors: [], entry: record };
  }

  function updateDraft(id, payload) {
    var existing = entry(id);
    if (!existing) return { ok: false, errors: ['Pièce introuvable.'] };
    if (existing.status !== 'draft') return { ok: false, errors: ['Une pièce validée ne peut plus être modifiée.'] };
    var existingJournal = journal(existing.journal);
    if (existingJournal && (existingJournal.systemManaged || existingJournal.retired)) {
      return { ok: false, errors: ['Une écriture d’un journal automatique ou retiré ne peut pas être modifiée manuellement.'] };
    }
    if (existing.sourceSystem === 'PERFECTO-ANNULATION-CENTRALISATION' && existing.sourceMetadata && existing.sourceMetadata.operation === 'centralization-reversal') {
      return { ok: false, errors: ['Une écriture inverse est immuable après sa préparation. Supprimez ce brouillon et recommencez l’annulation si une correction est nécessaire.'] };
    }
    payload.id = id;
    var currentJournal = journal(existing.journal);
    var submittedJournal = journal(payload.journal);
    var allowInactiveJournal = !!(currentJournal && submittedJournal && currentJournal.active === false && currentJournal.code === submittedJournal.code);
    var result = validateEntry(payload, { requireBalanced: false, status: 'draft', allowInactiveJournal: allowInactiveJournal });
    if (!result.ok) return result;
    var st = load();
    var idx = st.entries.findIndex(function (e) { return e.id === id; });
    st.entries[idx] = Object.assign({}, existing, result.entry, { id: id });
    save();
    return { ok: true, errors: [], entry: st.entries[idx] };
  }

  function postEntry(id) {
    var existing = entry(id);
    if (!existing) return { ok: false, errors: ['Pièce introuvable.'] };
    if (existing.status === 'posted') return { ok: false, errors: ['Cette pièce est déjà validée.'] };
    var existingJournal = journal(existing.journal);
    if (existingJournal && existingJournal.retired) {
      return { ok: false, errors: ['Validation refusée : le journal de cette écriture a été retiré.'] };
    }
    if (existingJournal && existingJournal.systemManaged && existing.sourceSystem !== existingJournal.systemSource) {
      return { ok: false, errors: ['Validation refusée : l’écriture du journal automatique ne porte pas une provenance système conforme.'] };
    }
    var unauthorizedLine = (existing.lines || []).find(function (line) {
      return !accountAllowedForJournalRecord(existingJournal, line.account);
    });
    if (unauthorizedLine) {
      return { ok: false, errors: ['Validation refusée : le compte ' + unauthorizedLine.account + ' n’est pas autorisé pour le journal « ' + (existingJournal ? existingJournal.code : existing.journal) + ' ».'] };
    }

    var st = load();
    if (existing.date < st.cycleStart || existing.date > st.cycleEnd) {
      return { ok: false, errors: ['La date doit se situer dans le cycle du dossier (' + st.cycleStart + ' au ' + st.cycleEnd + ').'] };
    }
    var year = Number(existing.date.slice(0, 4));
    var month = Number(existing.date.slice(5, 7));
    if (periodStatus(year, month) === 'closed') {
      return { ok: false, errors: ['La période ' + monthLabel(month) + ' ' + year + ' est clôturée : validation impossible.'] };
    }
    var t = totals(existing.lines);
    if (!t.balanced) {
      return { ok: false, errors: ['La pièce n’est pas équilibrée : validation impossible.'] };
    }
    existing.status = 'posted';
    existing.postedAt = new Date().toISOString();
    save();
    return { ok: true, errors: [], entry: existing };
  }

  function deleteDraft(id) {
    var existing = entry(id);
    if (!existing) return { ok: false, errors: ['Pièce introuvable.'] };
    if (existing.status !== 'draft') return { ok: false, errors: ['Seuls les brouillons peuvent être supprimés.'] };
    var existingJournal = journal(existing.journal);
    if (existingJournal && (existingJournal.systemManaged || existingJournal.retired)) {
      return { ok: false, errors: ['Ce brouillon est rattaché à un journal automatique ou retiré ; sa suppression manuelle est interdite.'] };
    }
    var st = load();
    var previousState = clone(st);
    if (!writeBackupSnapshot(previousState)) {
      return { ok: false, errors: ['Suppression impossible : le point de restauration local n’a pas pu être créé. Le brouillon est conservé.'] };
    }
    st.entries = st.entries.filter(function (e) { return e.id !== id; });
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. Le brouillon est conservé.'] };
    }
    return { ok: true, errors: [] };
  }

  function accountReferenceCounts(code, st) {
    st = st || load();
    code = String(code);
    var linkedEntries = st.entries.filter(function (entry) {
      return Array.isArray(entry.lines) && entry.lines.some(function (line) { return String(line.account) === code; });
    });
    var linkedSuppliers = (Array.isArray(st.suppliers) ? st.suppliers : []).filter(function (supplier) {
      return String(supplier.accountCode || '') === code;
    });
    var linkedClients = (Array.isArray(st.clients) ? st.clients : []).filter(function (clientRecord) {
      return String(clientRecord.accountCode || '') === code;
    });
    var linkedOtherParties = (Array.isArray(st.otherParties) ? st.otherParties : []).filter(function (record) {
      return String(record.accountCode || '') === code;
    });
    var linkedPersonnel = (Array.isArray(st.personnel) ? st.personnel : []).filter(function (record) {
      return String(record.accountCode || '') === code;
    });
    var childCodes = st.accounts.map(function (account) { return String(account.code); }).filter(function (candidate) {
      return candidate.length > code.length && candidate.indexOf(code) === 0;
    });
    return {
      entryCount: linkedEntries.length,
      draftEntryCount: linkedEntries.filter(function (entry) { return entry.status === 'draft'; }).length,
      postedEntryCount: linkedEntries.filter(function (entry) { return entry.status === 'posted'; }).length,
      supplierCount: linkedSuppliers.length,
      clientCount: linkedClients.length,
      otherPartyCount: linkedOtherParties.length,
      personnelCount: linkedPersonnel.length,
      childCodes: childCodes
    };
  }

  function accountCodeChangeCheck(code) {
    var st = load();
    var account = st.accounts.find(function (item) { return String(item.code) === String(code); });
    if (!account) return { ok: false, errors: ['Compte introuvable dans le dossier actif.'], references: null };
    var references = accountReferenceCounts(code, st);
    var errors = [];
    if (references.entryCount) errors.push('Le numéro ne peut pas être modifié : ' + references.entryCount + ' pièce(s) comptable(s) y font référence. Les écritures historiques et brouillons ne seront pas réécrits.');
    if (references.supplierCount) errors.push('Le numéro ne peut pas être modifié : ' + references.supplierCount + ' fournisseur(s) utilisent ce compte de rattachement.');
    if (references.clientCount) errors.push('Le numéro ne peut pas être modifié : ' + references.clientCount + ' client(s) utilisent ce compte de rattachement.');
    if (references.otherPartyCount) errors.push('Le numéro ne peut pas être modifié : ' + references.otherPartyCount + ' débiteur(s) ou créditeur(s) divers utilisent ce compte de rattachement.');
    if (references.personnelCount) errors.push('Le numéro ne peut pas être modifié : ' + references.personnelCount + ' membre(s) du personnel utilisent ce compte de rattachement.');
    if (references.childCodes.length) errors.push('Le numéro ne peut pas être modifié avant ses sous-comptes : ' + references.childCodes.slice(0, 5).join(', ') + (references.childCodes.length > 5 ? '…' : '') + '.');
    return { ok: errors.length === 0, errors: errors, references: references };
  }

  function accountDeleteCheck(code) {
    var st = load();
    var account = st.accounts.find(function (item) { return String(item.code) === String(code); });
    if (!account) return { ok: false, errors: ['Compte introuvable dans le dossier actif.'], references: null };
    var references = accountReferenceCounts(code, st);
    var errors = [];
    if (references.entryCount) errors.push('Suppression refusée : ' + references.entryCount + ' pièce(s) comptable(s) — brouillons ou validées — utilisent ce compte. Conservez-le dans le plan pour préserver l’historique.');
    if (references.supplierCount) errors.push('Suppression refusée : ' + references.supplierCount + ' fournisseur(s) sont rattachés à ce compte. Réaffectez-les avant la suppression.');
    if (references.clientCount) errors.push('Suppression refusée : ' + references.clientCount + ' client(s) sont rattachés à ce compte. Réaffectez-les avant la suppression.');
    if (references.otherPartyCount) errors.push('Suppression refusée : ' + references.otherPartyCount + ' débiteur(s) ou créditeur(s) divers sont rattachés à ce compte. Réaffectez-les avant la suppression.');
    if (references.personnelCount) errors.push('Suppression refusée : ' + references.personnelCount + ' membre(s) du personnel sont rattachés à ce compte. Réaffectez-les avant la suppression.');
    if (references.childCodes.length) errors.push('Suppression refusée : ce compte possède des sous-comptes (' + references.childCodes.slice(0, 5).join(', ') + (references.childCodes.length > 5 ? '…' : '') + ').');
    return { ok: errors.length === 0, errors: errors, references: references };
  }

  function validAccountCode(code) {
    return /^[1-8]\d{1,7}$/.test(String(code || ''));
  }

  function accountNatureList() { return ['Actif', 'Passif', 'Charge', 'Produit', 'SIG', 'Hors bilan']; }

  function addAccount(data) {
    data = data || {};
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Création bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var code = String(data.code || '').trim();
    var label = String(data.label || '').trim();
    var usage = String(data.usage == null ? '' : data.usage).trim();
    var errors = [];
    if (!validAccountCode(code)) errors.push('Le numéro doit comporter de 2 à 8 chiffres et commencer par une classe SYSCOHADA de 1 à 8.');
    if (!label) errors.push('Le libellé est obligatoire.');
    else if (label.length > 150) errors.push('Le libellé ne peut pas dépasser 150 caractères.');
    if (usage.length > 1000) errors.push('La nature / utilisation ne peut pas dépasser 1 000 caractères.');
    if (st.accounts.some(function (account) { return String(account.code) === code; })) errors.push('Ce numéro de compte existe déjà dans le dossier.');
    var nature = data.nature || 'Actif';
    if (accountNatureList().indexOf(nature) === -1) errors.push('La nature du compte est invalide.');
    if (errors.length) return { ok: false, errors: errors };

    var cls = Number(code.charAt(0));
    var subclass = code.slice(0, 2);
    var acc = {
      code: code,
      label: label,
      cls: cls,
      classLabel: ACCOUNTING_CHART ? ACCOUNTING_CHART.classLabel(cls) : ('Classe ' + cls),
      subclass: subclass,
      subclassLabel: ACCOUNTING_CHART && ACCOUNTING_CHART.SUBCLASS_LABELS[subclass] || 'Comptes personnalisés',
      nature: nature,
      usage: usage || 'Compte personnalisé du dossier.',
      aux: data.aux === true,
      active: true,
      postable: true,
      legacy: false,
      standard: false
    };
    var previousState = clone(st);
    st.accounts.push(acc);
    st.accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Création impossible : stockage local indisponible ou plein.'] };
    }
    return { ok: true, errors: [], account: clone(acc) };
  }

  function updateAccount(currentCode, data) {
    data = data || {};
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Modification bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var existing = st.accounts.find(function (account) { return String(account.code) === String(currentCode); });
    if (!existing) return { ok: false, errors: ['Compte introuvable dans le dossier actif.'] };
    var code = String(data.code == null ? currentCode : data.code).trim();
    var label = String(data.label == null ? '' : data.label).trim();
    var usage = String(data.usage == null ? '' : data.usage).trim();
    var nature = data.nature || existing.nature || 'Actif';
    var errors = [];
    if (!validAccountCode(code)) errors.push('Le numéro doit comporter de 2 à 8 chiffres et commencer par une classe SYSCOHADA de 1 à 8.');
    if (!label) errors.push('Le libellé est obligatoire.');
    else if (label.length > 150) errors.push('Le libellé ne peut pas dépasser 150 caractères.');
    if (usage.length > 1000) errors.push('La nature / utilisation ne peut pas dépasser 1 000 caractères.');
    if (accountNatureList().indexOf(nature) === -1) errors.push('La nature du compte est invalide.');
    if (st.accounts.some(function (account) { return account !== existing && String(account.code) === code; })) errors.push('Ce numéro de compte existe déjà dans le dossier.');

    if (code !== String(currentCode)) {
      var changeCheck = accountCodeChangeCheck(currentCode);
      if (!changeCheck.ok) errors = errors.concat(changeCheck.errors);
      var deletedCodes = Array.isArray(st.deletedStandardAccountCodes) ? st.deletedStandardAccountCodes : [];
      var reservedStandardCode = chartAccounts().some(function (account) { return account.code === code; }) && deletedCodes.indexOf(code) === -1;
      if (reservedStandardCode) errors.push('Ce numéro appartient déjà au plan de référence. Supprimez d’abord le compte d’origine s’il n’est pas utilisé, ou choisissez un numéro libre.');
    }
    if (errors.length) return { ok: false, errors: errors };

    var previousState = clone(st);
    if (code !== String(currentCode)) {
      if (existing.standard && !existing.legacy) {
        var originCode = String(existing.chartOriginCode || existing.code);
        if (!Array.isArray(st.deletedStandardAccountCodes)) st.deletedStandardAccountCodes = [];
        if (st.deletedStandardAccountCodes.indexOf(originCode) === -1) st.deletedStandardAccountCodes.push(originCode);
      }
      existing.code = code;
      existing.standard = false;
      existing.legacy = false;
      delete existing.chartOriginCode;
    }
    var cls = Number(code.charAt(0));
    var subclass = code.slice(0, 2);
    existing.cls = cls;
    existing.classLabel = ACCOUNTING_CHART ? ACCOUNTING_CHART.classLabel(cls) : ('Classe ' + cls);
    existing.subclass = subclass;
    existing.subclassLabel = ACCOUNTING_CHART && ACCOUNTING_CHART.SUBCLASS_LABELS[subclass] || 'Comptes personnalisés';
    existing.label = label;
    existing.nature = nature;
    existing.usage = usage;
    existing.aux = data.aux === true;
    st.accounts.sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); });
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Modification impossible : stockage local indisponible ou plein.'] };
    }
    return { ok: true, errors: [], account: clone(existing) };
  }

  function deleteAccount(code) {
    var st = load();
    if (recoveryIssue) return { ok: false, errors: ['Suppression bloquée : contrôlez ou restaurez d’abord la base de ce dossier.'] };
    var existing = st.accounts.find(function (account) { return String(account.code) === String(code); });
    if (!existing) return { ok: false, errors: ['Compte introuvable dans le dossier actif.'] };
    var check = accountDeleteCheck(code);
    if (!check.ok) return check;
    var previousState = clone(st);
    if (existing.standard && !existing.legacy) {
      var originCode = String(existing.chartOriginCode || existing.code);
      if (!Array.isArray(st.deletedStandardAccountCodes)) st.deletedStandardAccountCodes = [];
      if (st.deletedStandardAccountCodes.indexOf(originCode) === -1) st.deletedStandardAccountCodes.push(originCode);
    }
    st.accounts = st.accounts.filter(function (account) { return String(account.code) !== String(code); });
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Suppression impossible : stockage local indisponible ou plein. Le compte est conservé.'] };
    }
    return { ok: true, errors: [], account: clone(existing) };
  }

  /* ---------------- Calculs comptables ---------------- */
  function postedEntries() {
    var st = load();
    return st.entries.filter(function (e) {
      return e.status === 'posted' && e.date >= st.cycleStart && e.date <= st.cycleEnd;
    });
  }

  function balance() {
    var map = {};
    accounts().forEach(function (a) {
      map[a.code] = { code: a.code, label: a.label, cls: a.cls, nature: a.nature, debit: 0, credit: 0 };
    });
    postedEntries().forEach(function (e) {
      e.lines.forEach(function (l) {
        if (!map[l.account]) {
          map[l.account] = { code: l.account, label: l.account, cls: Number(String(l.account).charAt(0)), nature: '—', debit: 0, credit: 0 };
        }
        map[l.account].debit += Number(l.debit) || 0;
        map[l.account].credit += Number(l.credit) || 0;
      });
    });
    var rows = Object.keys(map).map(function (k) { return map[k]; })
      .filter(function (r) { return r.debit !== 0 || r.credit !== 0; });
    rows.sort(function (a, b) { return a.code.localeCompare(b.code); });
    return rows;
  }

  function ledger(accountCode) {
    var rows = [];
    postedEntries().forEach(function (e) {
      e.lines.forEach(function (l) {
        if (l.account !== accountCode) return;
        rows.push({
          date: e.date,
          reference: e.reference,
          journal: e.journal,
          description: e.description,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0
        });
      });
    });
    rows.sort(function (a, b) {
      return a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference);
    });
    var running = 0;
    rows.forEach(function (r) {
      running += r.debit - r.credit;
      r.balance = running;
    });
    var debit = rows.reduce(function (s, r) { return s + r.debit; }, 0);
    var credit = rows.reduce(function (s, r) { return s + r.credit; }, 0);
    return { rows: rows, debit: debit, credit: credit, balance: debit - credit };
  }

  function kpis() {
    var st = load();
    var rows = balance();
    var debit = rows.reduce(function (s, r) { return s + r.debit; }, 0);
    var credit = rows.reduce(function (s, r) { return s + r.credit; }, 0);
    var charges = 0;
    var produits = 0;
    var tresorerie = 0;
    rows.forEach(function (r) {
      if (r.cls === 6) charges += r.debit - r.credit;
      if (r.cls === 7) produits += r.credit - r.debit;
      if (r.cls === 5) tresorerie += r.debit - r.credit;
    });
    return {
      debit: debit,
      credit: credit,
      charges: charges,
      produits: produits,
      resultat: produits - charges,
      tresorerie: tresorerie,
      posted: postedEntries().length,
      drafts: st.entries.filter(function (e) { return e.status === 'draft' && e.date >= st.cycleStart && e.date <= st.cycleEnd; }).length
    };
  }

  function journalStats() {
    var st = load();
    return journals().map(function (j) {
      var list = st.entries.filter(function (e) {
        return normalizeJournalCode(e.journal) === normalizeJournalCode(j.code) && e.date >= st.cycleStart && e.date <= st.cycleEnd;
      });
      var posted = list.filter(function (e) { return e.status === 'posted'; });
      var t = { debit: 0, credit: 0 };
      posted.forEach(function (e) {
        var et = totals(e.lines);
        t.debit += et.debit;
        t.credit += et.credit;
      });
      return {
        journal: j,
        count: list.length,
        posted: posted.length,
        drafts: list.length - posted.length,
        debit: t.debit,
        credit: t.credit
      };
    });
  }

  function periodStats(year) {
    var st = load();
    if (Number(year) !== Number(st.exercise)) return [];
    var cycleMonthKeys = {};
    cyclePeriods(st.cycleStart, st.cycleEnd).forEach(function (period) { cycleMonthKeys[period.year + '-' + period.month] = true; });
    return st.periods.filter(function (p) { return !!cycleMonthKeys[p.year + '-' + p.month]; }).map(function (p) {
      var list = st.entries.filter(function (e) {
        return e.date >= st.cycleStart && e.date <= st.cycleEnd &&
          Number(e.date.slice(0, 4)) === p.year && Number(e.date.slice(5, 7)) === p.month;
      });
      var posted = list.filter(function (e) { return e.status === 'posted'; });
      var debit = posted.reduce(function (s, e) { return s + totals(e.lines).debit; }, 0);
      return { year: p.year, month: p.month, status: p.status, count: list.length, posted: posted.length, debit: debit };
    });
  }

  /* ---------------- Sauvegarde / restauration ---------------- */
  function exportJson() {
    var payload = {
      application: 'PERFECTO',
      module: 'Comptabilité générale SYSCOHADA',
      version: 1,
      dossier: currentDossier(),
      exportedAt: new Date().toISOString(),
      data: clone(load())
    };
    return JSON.stringify(payload, null, 2);
  }

  function importJson(text) {
    try {
      var parsed = JSON.parse(text);
      var data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.journals) || !Array.isArray(data.entries) || !Array.isArray(data.periods) || !hasReadableAccountingRecords(data)) {
        return { ok: false, errors: ['Fichier invalide : structure PERFECTO attendue.'] };
      }
      var previousState = clone(load());
      if (recoveryIssue) return { ok: false, errors: ['Restauration bloquée : analysez la base endommagée et préservez d’abord son contenu.'] };
      var dossier = currentDossier();
      data = clone(data);
      data.exercise = dossier.exerciseYear;
      data.cycleStart = dossier.cycleStart;
      data.cycleEnd = dossier.cycleEnd;
      var chartUpgrade = upgradeAccountingChart(data);
      var auxiliaryUpgrade = upgradeAuxiliaryRegistries(chartUpgrade.data);
      var locationUpgrade = upgradeFixedAssetLocations(auxiliaryUpgrade.data);
      var assetUpgrade = upgradeFixedAssets(locationUpgrade.data);
      data = upgradeJournals(assetUpgrade.data).data;
      state = data;
      ensurePeriodsForEntries();
      if (!save()) {
        state = previousState;
        return { ok: false, errors: ['Restauration impossible : le stockage local est indisponible ou plein. Les données du dossier sont conservées.'] };
      }
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: ['Fichier JSON illisible.'] };
    }
  }

  function previewExchangeImport(incomingEntries, mode, options) {
    var opts = options || {};
    var status = mode === 'posted' ? 'posted' : 'draft';
    var sourceSystem = String(opts.sourceSystem || '').trim().toUpperCase();
    var accountMap = opts.accountMap || {};
    var journalMap = opts.journalMap || {};
    var st = load();
    var errors = [];
    var warnings = [];
    var unmappedAccounts = [];
    var unmappedJournals = [];
    var normalizedEntries = [];
    var seenReferences = Object.create(null);
    var seenSourceIds = Object.create(null);
    var warningKeys = Object.create(null);
    var lineCount = incomingEntries && Array.isArray(incomingEntries)
      ? incomingEntries.reduce(function (total, entry) { return total + ((entry && Array.isArray(entry.lines)) ? entry.lines.length : 0); }, 0)
      : 0;
    var balancedCount = 0;

    if (!Array.isArray(incomingEntries) || !incomingEntries.length) {
      return { ok: false, errors: ['Le fichier ne contient aucune pièce à importer.'], warnings: [], entries: [], lineCount: 0, balancedCount: 0, unbalancedCount: 0, unmappedAccounts: [], unmappedJournals: [] };
    }
    if (incomingEntries.length > 10000) {
      return { ok: false, errors: ['Le lot dépasse la limite de 10 000 pièces. Importez un lot plus petit.'], warnings: [], entries: [], lineCount: 0, balancedCount: 0, unbalancedCount: 0, unmappedAccounts: [], unmappedJournals: [] };
    }

    function addUnmapped(list, code, label) {
      if (!list.some(function (item) { return item.code === code; })) list.push({ code: code, label: label || '' });
    }

    incomingEntries.forEach(function (sourceEntry, index) {
      sourceEntry = sourceEntry || {};
      var prefix = 'Pièce « ' + String(sourceEntry.reference || (index + 1)) + ' » : ';
      var reference = String(sourceEntry.reference || '').trim();
      var originalJournal = String(sourceEntry.journal || '').trim();
      var mappedJournal = Object.prototype.hasOwnProperty.call(journalMap, originalJournal)
        ? String(journalMap[originalJournal] || '').trim()
        : originalJournal;
      var sourceId = String(sourceEntry.sourceId || '').trim();
      var entrySourceSystem = String(sourceEntry.sourceSystem || sourceSystem || 'EXCEL').trim().toUpperCase();
      var sourceKey = entrySourceSystem + '\u0000' + sourceId;
      var mappedLines = [];
      var hasUnknownReference = false;

      if (!reference) errors.push(prefix + 'la référence est obligatoire.');
      if (reference) {
        if (seenReferences[reference]) errors.push(prefix + 'référence répétée dans le fichier.');
        else seenReferences[reference] = true;
        if (st.entries.some(function (entry) { return entry.reference === reference; })) errors.push(prefix + 'cette référence existe déjà dans le dossier actif.');
      }
      if (sourceId) {
        if (seenSourceIds[sourceKey]) errors.push(prefix + 'ID_SOURCE déjà utilisé par une autre pièce du fichier.');
        else seenSourceIds[sourceKey] = true;
        if (st.entries.some(function (entry) { return entry.sourceSystem === entrySourceSystem && entry.sourceId === sourceId; })) {
          errors.push(prefix + 'cet ID_SOURCE a déjà été importé depuis ' + entrySourceSystem + '.');
        }
      }

      if (!mappedJournal || !journal(mappedJournal)) {
        addUnmapped(unmappedJournals, originalJournal, sourceEntry.journalLabel);
        hasUnknownReference = true;
      } else if (normalizeJournalCode(mappedJournal) === 'CEN' && opts.internalDossierTransfer !== true) {
        errors.push(prefix + 'Le journal CEN ne peut être alimenté que par le futur transfert interne entre dossiers PERFECTO, pas par un fichier ou un logiciel tiers.');
        return;
      } else if (sourceEntry.journalLabel && journal(mappedJournal).label !== sourceEntry.journalLabel) {
        var journalWarningKey = 'journal:' + originalJournal + ':' + mappedJournal;
        if (!warningKeys[journalWarningKey]) {
          warnings.push('Le journal source « ' + originalJournal + ' — ' + sourceEntry.journalLabel + ' » sera associé à « ' + mappedJournal + ' — ' + journal(mappedJournal).label + ' ».');
          warningKeys[journalWarningKey] = true;
        }
      }

      (sourceEntry.lines || []).forEach(function (line) {
        var sourceAccount = String(line.account || '').trim();
        var mappedAccount = Object.prototype.hasOwnProperty.call(accountMap, sourceAccount)
          ? String(accountMap[sourceAccount] || '').trim()
          : sourceAccount;
        var targetAccount = account(mappedAccount);
        if (!mappedAccount || !targetAccount) {
          addUnmapped(unmappedAccounts, sourceAccount, line.accountLabel);
          hasUnknownReference = true;
          mappedLines.push(Object.assign({}, line, { account: mappedAccount || sourceAccount }));
          return;
        }
        if (line.accountLabel && targetAccount.label !== line.accountLabel) {
          var accountWarningKey = 'account:' + sourceAccount + ':' + mappedAccount;
          if (!warningKeys[accountWarningKey]) {
            warnings.push('Le compte source « ' + sourceAccount + ' — ' + line.accountLabel + ' » sera associé à « ' + mappedAccount + ' — ' + targetAccount.label + ' ».');
            warningKeys[accountWarningKey] = true;
          }
        }
        mappedLines.push(Object.assign({}, line, { account: mappedAccount }));
      });

      if (hasUnknownReference) return;
      var result = validateEntry({
        reference: reference,
        journal: mappedJournal,
        date: sourceEntry.date,
        description: sourceEntry.description,
        lines: mappedLines
      }, { ignoreUnique: true, requireBalanced: status === 'posted', status: status });
      if (!result.ok) {
        result.errors.forEach(function (message) { errors.push(prefix + message); });
        return;
      }
      var totalsForEntry = totals(result.entry.lines);
      if (totalsForEntry.balanced) balancedCount += 1;
      if (sourceEntry.sourceStatus && sourceEntry.sourceStatus !== status) {
        var statusWarningKey = 'status:' + sourceEntry.sourceStatus + ':' + status;
        if (!warningKeys[statusWarningKey]) {
          warnings.push('Le statut de source « ' + sourceEntry.sourceStatus + ' » sera importé comme ' + (status === 'posted' ? 'écriture validée' : 'brouillon') + ', selon le mode choisi.');
          warningKeys[statusWarningKey] = true;
        }
      }
      normalizedEntries.push({ entry: result.entry, original: sourceEntry, sourceSystem: entrySourceSystem, sourceId: sourceId });
    });

    unmappedAccounts.forEach(function (item) {
      errors.push('Compte source « ' + item.code + ' » sans correspondance PERFECTO.');
    });
    unmappedJournals.forEach(function (item) {
      errors.push('Journal source « ' + item.code + ' » sans correspondance PERFECTO.');
    });

    return {
      ok: errors.length === 0 && unmappedAccounts.length === 0 && unmappedJournals.length === 0 && normalizedEntries.length === incomingEntries.length,
      errors: errors,
      warnings: warnings,
      entries: normalizedEntries,
      lineCount: lineCount,
      balancedCount: balancedCount,
      unbalancedCount: Math.max(0, normalizedEntries.length - balancedCount),
      unmappedAccounts: unmappedAccounts,
      unmappedJournals: unmappedJournals
    };
  }

  function importExchange(incomingEntries, mode, options) {
    var preview = previewExchangeImport(incomingEntries, mode, options);
    if (!preview.ok) return { ok: false, errors: preview.errors, warnings: preview.warnings };

    var previousState = clone(load());
    if (!writeBackupSnapshot(previousState)) {
      return { ok: false, errors: ['Import annulé : le point de restauration local n’a pas pu être créé. Exportez d’abord une sauvegarde du dossier ou libérez de l’espace.'], warnings: preview.warnings };
    }
    var st = load();
    var now = new Date().toISOString();
    var batchId = 'exchange-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var status = mode === 'posted' ? 'posted' : 'draft';
    var imported = preview.entries.map(function (item) {
      var record = clone(item.entry);
      var original = item.original;
      record.id = 'e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
      record.createdAt = now;
      record.status = status;
      record.sourceSystem = item.sourceSystem;
      record.sourceId = item.sourceId;
      record.sourceReference = String(original.reference || '');
      record.sourceJournal = String(original.journal || '');
      record.sourceStatus = String(original.sourceStatus || '');
      if (original.sourceMetadata && typeof original.sourceMetadata === 'object') record.sourceMetadata = clone(original.sourceMetadata);
      record.importBatchId = batchId;
      record.importedAt = now;
      if (status === 'posted') record.postedAt = now;
      record.lines = record.lines.map(function (line, index) {
        var originalLine = original.lines[index] || {};
        line.sourceAccountCode = String(originalLine.account || '');
        line.sourceAccountLabel = String(originalLine.accountLabel || '');
        return line;
      });
      return record;
    });
    st.entries = st.entries.concat(imported);
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Import impossible : stockage local indisponible ou plein. Aucune écriture n’a été conservée.'], warnings: preview.warnings };
    }
    return { ok: true, errors: [], warnings: preview.warnings, importedCount: imported.length, lineCount: preview.lineCount, batchId: batchId };
  }

  function readBackupSnapshot() {
    try {
      var raw = global.localStorage.getItem(currentBackupStorageKey());
      if (!raw) return null;
      var snapshot = JSON.parse(raw);
      if (!snapshot || snapshot.application !== 'PERFECTO' || snapshot.version !== 1 || !isBackupData(snapshot.data)) return null;
      return snapshot;
    } catch (err) {
      return null;
    }
  }

  function backupInfo() {
    var snapshot = readBackupSnapshot();
    if (!snapshot) return { available: false, createdAt: null, accountCount: 0, entryCount: 0, periodCount: 0 };
    return {
      available: true,
      createdAt: snapshot.createdAt,
      accountCount: snapshot.data.accounts.length,
      entryCount: snapshot.data.entries.length,
      periodCount: snapshot.data.periods.length
    };
  }

  function readCorruptRecoveryCopy() {
    try {
      var raw = global.localStorage.getItem(currentRecoveryRawStorageKey());
      if (!raw) return null;
      var copy = JSON.parse(raw);
      if (!copy || copy.application !== 'PERFECTO' || copy.version !== 1 || typeof copy.raw !== 'string') return null;
      return copy;
    } catch (err) {
      return null;
    }
  }

  function preserveCorruptRaw() {
    if (!recoveryIssue || typeof recoveryIssue.raw !== 'string') return false;
    try {
      var copy = {
        application: 'PERFECTO',
        version: 1,
        createdAt: new Date().toISOString(),
        dossierId: activeFolderId,
        sourceKey: currentFolderStorageKey(),
        raw: recoveryIssue.raw
      };
      global.localStorage.setItem(currentRecoveryRawStorageKey(), JSON.stringify(copy));
      return true;
    } catch (err) {
      return false;
    }
  }

  function databaseStorageStatus() {
    load();
    var recoveryCopy = readCorruptRecoveryCopy();
    return {
      recoveryRequired: !!recoveryIssue,
      kind: recoveryIssue && recoveryIssue.kind || '',
      message: recoveryIssue && recoveryIssue.message || '',
      rawLength: recoveryIssue && typeof recoveryIssue.raw === 'string' ? recoveryIssue.raw.length : 0,
      recoveryCopyAvailable: !!recoveryCopy,
      recoveryCopyCreatedAt: recoveryCopy && recoveryCopy.createdAt || null,
      backupAvailable: !!readBackupSnapshot()
    };
  }

  function corruptDatabaseContents() {
    load();
    if (recoveryIssue && typeof recoveryIssue.raw === 'string') return recoveryIssue.raw;
    var recoveryCopy = readCorruptRecoveryCopy();
    return recoveryCopy ? recoveryCopy.raw : null;
  }

  function databaseRepairAnalysis() {
    load();
    if (recoveryIssue && recoveryIssue.kind === 'corrupt') {
      return {
        ok: false,
        structureValid: false,
        cycleValid: false,
        canApplySafeRepair: false,
        safeRepairNeeded: false,
        issues: [{ code: 'database-corrupt', severity: 'error', repairable: false, count: 1, examples: [], message: recoveryIssue.message }],
        summary: { accounts: 0, journals: 0, entries: 0, postedEntries: 0, draftEntries: 0, validPostedEntries: 0, periods: 0 },
        criticalCount: 1,
        warningCount: 0
      };
    }
    var engine = global.PerfectoAccountingDatabaseRepair;
    if (!engine) return { ok: false, canApplySafeRepair: false, issues: [{ severity: 'error', message: 'Le moteur de diagnostic n’est pas chargé.' }] };
    return engine.inspect(state, currentDossier());
  }

  function repairDatabase() {
    load();
    if (recoveryIssue && recoveryIssue.kind === 'corrupt') {
      return { ok: false, errors: ['La structure comptable est illisible. Restaurez un point local ou exportez les données brutes avant une réinitialisation explicite.'] };
    }
    var engine = global.PerfectoAccountingDatabaseRepair;
    if (!engine) return { ok: false, errors: ['Le moteur de réparation n’est pas chargé.'] };
    var previousState = clone(state);
    var plan = engine.repair(state, currentDossier());
    if (!plan.ok) return { ok: false, errors: plan.errors || ['Aucune réparation sûre n’est disponible.'], report: plan.report };
    var locationUpgrade = upgradeFixedAssetLocations(plan.data);
    var fixedAssetUpgrade = upgradeFixedAssets(locationUpgrade.data);
    var journalUpgrade = upgradeJournals(fixedAssetUpgrade.data);
    if (locationUpgrade.changed || fixedAssetUpgrade.changed || journalUpgrade.changed) {
      plan.data = journalUpgrade.data;
      plan.changed = true;
    }
    if (!plan.changed && !recoveryIssue) return { ok: true, changed: false, errors: [], report: plan.report };

    if (recoveryIssue) {
      if (!preserveCorruptRaw()) return { ok: false, errors: ['Copie de récupération impossible. Libérez de l’espace de stockage ou téléchargez le fichier brut avant de réparer.'] };
      try {
        global.localStorage.setItem(currentFolderStorageKey(), JSON.stringify(plan.data));
      } catch (writeError) {
        state = previousState;
        return { ok: false, errors: ['Enregistrement de la réparation impossible. La copie brute a été conservée dans le navigateur.'] };
      }
      state = plan.data;
      recoveryIssue = null;
      return { ok: true, changed: true, errors: [], report: plan.report, recoveryCopySaved: true };
    }

    if (!writeBackupSnapshot(previousState)) return { ok: false, errors: ['Réparation annulée : le point de restauration préalable n’a pas pu être créé.'] };
    state = plan.data;
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Réparation impossible : stockage local indisponible ou plein. Le dossier reste inchangé.'] };
    }
    return { ok: true, changed: true, errors: [], report: plan.report, recoveryCopySaved: false };
  }

  function reinitializeCorruptDatabase() {
    load();
    if (!recoveryIssue) return { ok: false, errors: ['Aucune base nécessitant une récupération ne doit être réinitialisée.'] };
    if (!preserveCorruptRaw()) return { ok: false, errors: ['Réinitialisation bloquée : la copie brute de récupération n’a pas pu être enregistrée. Téléchargez-la ou libérez de l’espace.'] };
    var dossier = folderById(activeFolderId);
    var replacement = initialState(!dossier || dossier.seeded !== false, dossier);
    try {
      global.localStorage.setItem(currentFolderStorageKey(), JSON.stringify(replacement));
    } catch (err) {
      return { ok: false, errors: ['Réinitialisation impossible : le stockage local est indisponible ou plein. La copie brute a été conservée.'] };
    }
    state = replacement;
    recoveryIssue = null;
    return { ok: true, errors: [], recoveryCopySaved: true };
  }

  function restoreBackup() {
    load();
    var snapshot = readBackupSnapshot();
    if (!snapshot) return { ok: false, errors: ['Aucun point de restauration local valide n’est disponible.'] };

    if (recoveryIssue) {
      if (!preserveCorruptRaw()) return { ok: false, errors: ['Restauration bloquée : la copie brute endommagée n’a pas pu être conservée. Téléchargez-la ou libérez de l’espace.'] };
      var previousState = state;
      var previousIssue = recoveryIssue;
      var recoveredChart = upgradeAccountingChart(clone(snapshot.data));
      var recoveredAuxiliary = upgradeAuxiliaryRegistries(recoveredChart.data);
      var recoveredLocations = upgradeFixedAssetLocations(recoveredAuxiliary.data);
      var recoveredAssets = upgradeFixedAssets(recoveredLocations.data);
      state = upgradeJournals(recoveredAssets.data).data;
      try {
        ensurePeriodsForEntries();
        global.localStorage.setItem(currentFolderStorageKey(), JSON.stringify(state));
      } catch (recoveryWriteError) {
        state = previousState;
        recoveryIssue = previousIssue;
        return { ok: false, errors: ['Restauration impossible : stockage local indisponible ou plein. La copie brute est conservée.'] };
      }
      recoveryIssue = null;
      return { ok: true, errors: [], restoredAt: snapshot.createdAt, preservedCorruptRaw: true };
    }

    var previousState = state ? clone(state) : null;
    var restoredChart = upgradeAccountingChart(clone(snapshot.data));
    var restoredAuxiliary = upgradeAuxiliaryRegistries(restoredChart.data);
    var restoredLocations = upgradeFixedAssetLocations(restoredAuxiliary.data);
    var restoredAssets = upgradeFixedAssets(restoredLocations.data);
    state = upgradeJournals(restoredAssets.data).data;
    ensurePeriodsForEntries();
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Restauration impossible : le stockage local est indisponible ou plein.'] };
    }
    return { ok: true, errors: [], restoredAt: snapshot.createdAt, preservedCorruptRaw: false };
  }

  /* ---------------- Utilitaires de format ---------------- */
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function monthLabel(month) { return MOIS[month - 1] || String(month); }

  var nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

  function money(value) {
    var n = Number(value) || 0;
    return nf.format(n) + '\u00A0XOF';
  }

  function amount(value) {
    return nf.format(Number(value) || 0);
  }

  function dateLabel(iso) {
    if (!iso) return '—';
    var parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    return parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  global.PerfectoStore = {
    STORAGE_KEY: STORAGE_KEY,
    EXERCICE: EXERCICE,
    dossiers: dossiers,
    currentDossier: currentDossier,
    currentStorageKey: currentFolderStorageKey,
    createDossier: createDossier,
    switchDossier: switchFolder,
    folders: dossiers,
    currentFolder: currentDossier,
    createFolder: createFolder,
    switchFolder: switchFolder,
    load: load,
    save: save,
    reset: reset,
    getState: getState,
    exercise: exercise,
    accounts: accounts,
    account: account,
    journals: journals,
    journal: journal,
    journalOperationNatures: function () { return JOURNAL_OPERATION_NATURES.slice(); },
    journalAllowsAccount: journalAllowsAccount,
    nextJournalCode: nextJournalCode,
    journalEntryCount: journalEntryCount,
    createJournal: createJournal,
    updateJournal: updateJournal,
    deleteJournal: deleteJournal,
    suppliers: suppliers,
    supplier: supplier,
    createSupplier: createSupplier,
    updateSupplier: updateSupplier,
    setSupplierActive: setSupplierActive,
    deleteSupplier: deleteSupplier,
    clients: clients,
    client: client,
    createClient: createClient,
    updateClient: updateClient,
    deleteClient: deleteClient,
    clientCodeChangeCheck: clientCodeChangeCheck,
    otherParties: otherParties,
    otherParty: otherParty,
    createOtherParty: createOtherParty,
    updateOtherParty: updateOtherParty,
    deleteOtherParty: deleteOtherParty,
    otherPartyIdentityChangeCheck: otherPartyIdentityChangeCheck,
    personnel: personnel,
    personnelRecord: personnelRecord,
    services: services,
    service: service,
    analyticalCenters: analyticalCenters,
    analyticalCenter: analyticalCenter,
    nextAnalyticalCenterCode: nextAnalyticalCenterCode,
    createAnalyticalCenter: createAnalyticalCenter,
    updateAnalyticalCenter: updateAnalyticalCenter,
    setAnalyticalCenterActive: setAnalyticalCenterActive,
    deleteAnalyticalCenter: deleteAnalyticalCenter,
    matchingGroups: matchingGroups,
    matchingGroup: matchingGroup,
    matchingForLine: matchingForLine,
    assignLetter: assignLetter,
    cancelLetter: cancelLetter,
    pointageMarks: pointageMarks,
    pointageForLine: pointageForLine,
    pointEntryLine: pointEntryLine,
    unpointEntryLine: unpointEntryLine,
    nextServiceCode: nextServiceCode,
    createService: createService,
    updateService: updateService,
    setServiceActive: setServiceActive,
    deleteService: deleteService,
    serviceReferenceCount: serviceReferenceCount,
    createPersonnel: createPersonnel,
    updatePersonnel: updatePersonnel,
    deletePersonnel: deletePersonnel,
    personnelIdentityChangeCheck: personnelIdentityChangeCheck,
    fixedAssetLocations: fixedAssetLocations,
    fixedAssetLocation: fixedAssetLocation,
    nextFixedAssetLocationCode: nextFixedAssetLocationCode,
    fixedAssets: fixedAssets,
    fixedAsset: fixedAsset,
    nextFixedAssetCode: nextFixedAssetCode,
    createFixedAsset: createFixedAsset,
    updateFixedAsset: updateFixedAsset,
    deleteFixedAsset: deleteFixedAsset,
    createFixedAssetLocation: createFixedAssetLocation,
    updateFixedAssetLocation: updateFixedAssetLocation,
    deleteFixedAssetLocation: deleteFixedAssetLocation,
    nextIdentificationCode: nextIdentificationCode,
    registerIdentificationCode: registerIdentificationCode,
    entries: entries,
    entry: entry,
    periods: periods,
    years: years,
    period: period,
    ensureYear: ensureYear,
    periodStatus: periodStatus,
    setPeriod: setPeriod,
    nextReference: nextReference,
    totals: totals,
    validateEntry: validateEntry,
    createEntry: createEntry,
    updateDraft: updateDraft,
    postEntry: postEntry,
    deleteDraft: deleteDraft,
    addAccount: addAccount,
    updateAccount: updateAccount,
    deleteAccount: deleteAccount,
    accountCodeChangeCheck: accountCodeChangeCheck,
    accountDeleteCheck: accountDeleteCheck,
    postedEntries: postedEntries,
    balance: balance,
    ledger: ledger,
    kpis: kpis,
    journalStats: journalStats,
    periodStats: periodStats,
    exportJson: exportJson,
    importJson: importJson,
    previewExchangeImport: previewExchangeImport,
    importExchange: importExchange,
    backupInfo: backupInfo,
    databaseStorageStatus: databaseStorageStatus,
    databaseRepairAnalysis: databaseRepairAnalysis,
    repairDatabase: repairDatabase,
    corruptDatabaseContents: corruptDatabaseContents,
    reinitializeCorruptDatabase: reinitializeCorruptDatabase,
    restoreBackup: restoreBackup,
    monthLabel: monthLabel,
    money: money,
    amount: amount,
    dateLabel: dateLabel,
    todayIso: todayIso
  };
})(window);
