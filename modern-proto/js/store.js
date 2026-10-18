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
  var DEFAULT_FOLDER_ID = 'folder-main';
  var DEFAULT_FOLDER_NAME = 'Entreprise de démonstration';
  var DEFAULT_ACCOUNTING_TYPE = 'Comptabilité révisée SYSCOHADA';
  var DEFAULT_ACCOUNTING_TYPE_CODE = 'COR';
  var EXERCICE = 2026;

  var JOURNAUX = [
    { code: 'AC', label: 'Journal des achats', type: 'Achat' },
    { code: 'VE', label: 'Journal des ventes', type: 'Vente' },
    { code: 'BQ', label: 'Journal de banque', type: 'Trésorerie' },
    { code: 'CA', label: 'Journal de caisse', type: 'Trésorerie' },
    { code: 'OD', label: 'Opérations diverses', type: 'Divers' },
    { code: 'PA', label: 'Journal de paie', type: 'Paie' }
  ];

  var COMPTES = [
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
        id: 'seed-2', reference: 'AC-2026-001', journal: 'AC', date: '2026-01-12',
        description: 'Achat de marchandises à crédit', status: 'posted',
        lines: [
          { account: '601100', debit: 500000, credit: 0 },
          { account: '445200', debit: 90000, credit: 0 },
          { account: '401100', debit: 0, credit: 590000 }
        ]
      },
      {
        id: 'seed-3', reference: 'VE-2026-001', journal: 'VE', date: '2026-01-20',
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

  function initialState(withSeedEntries, dossier) {
    dossier = dossier || {};
    var exerciseYear = Number(dossier.exerciseYear) || EXERCICE;
    var cycleStart = dossier.cycleStart || exerciseYear + '-01-01';
    var cycleEnd = dossier.cycleEnd || exerciseYear + '-12-31';
    return {
      version: 1,
      exercise: exerciseYear,
      cycleStart: cycleStart,
      cycleEnd: cycleEnd,
      accounts: COMPTES.map(function (a) {
        return { code: a.code, label: a.label, cls: a.cls, nature: a.nature, aux: a.aux, active: true };
      }),
      journals: JOURNAUX.slice(),
      entries: withSeedEntries === false ? [] : seedEntries(),
      periods: cyclePeriods(cycleStart, cycleEnd)
    };
  }

  var state = null;
  var folderCatalog = null;
  var activeFolderId = null;

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

  function switchFolder(folderId) {
    ensureFolderCatalog();
    if (!folderById(folderId)) return { ok: false, errors: ['Dossier client introuvable.'] };
    if (folderId === activeFolderId) return { ok: true, errors: [], dossier: currentDossier(), folder: currentDossier() };
    if (state && !save()) return { ok: false, errors: ['Impossible d’enregistrer le dossier actif avant le changement.'] };
    activeFolderId = folderId;
    state = null;
    try { global.localStorage.setItem(ACTIVE_DOSSIER_STORAGE_KEY, activeFolderId); } catch (err) { /* la sélection restera en mémoire */ }
    return { ok: true, errors: [], dossier: currentDossier(), folder: currentDossier(), state: load() };
  }

  function load() {
    if (state) return state;
    ensureFolderCatalog();
    try {
      var raw = global.localStorage.getItem(currentFolderStorageKey());
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.accounts) && Array.isArray(parsed.journals) && Array.isArray(parsed.entries)) {
          state = parsed;
          var dossier = folderById(activeFolderId);
          var fallbackStart = (dossier && dossier.cycleStart) || EXERCICE + '-01-01';
          var fallbackEnd = (dossier && dossier.cycleEnd) || EXERCICE + '-12-31';
          if (!parseIsoDate(state.cycleStart) || !parseIsoDate(state.cycleEnd) || state.cycleEnd < state.cycleStart) {
            state.cycleStart = fallbackStart;
            state.cycleEnd = fallbackEnd;
          }
          state.exercise = Number(state.cycleStart.slice(0, 4)) || Number(dossier && dossier.exerciseYear) || EXERCICE;
          ensurePeriodsForEntries();
          return state;
        }
      }
    } catch (err) {
      /* Stockage indisponible ou corrompu : le dossier repart sur son état initial. */
    }
    var dossier = folderById(activeFolderId);
    state = initialState(!dossier || dossier.seeded !== false, dossier);
    save();
    return state;
  }

  function isBackupData(data) {
    return !!data && Array.isArray(data.accounts) && Array.isArray(data.journals) &&
      Array.isArray(data.entries) && Array.isArray(data.periods);
  }

  function snapshotPreviousState(raw) {
    try {
      var previous = JSON.parse(raw);
      if (!isBackupData(previous)) return false;
      var snapshot = {
        application: 'PERFECTO',
        module: 'Comptabilité générale SYSCOHADA',
        version: 1,
        createdAt: new Date().toISOString(),
        data: previous
      };
      global.localStorage.setItem(currentBackupStorageKey(), JSON.stringify(snapshot));
      return true;
    } catch (err) {
      return false;
    }
  }

  function save() {
    if (!state) return false;
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
    return load().journals.find(function (j) { return j.code === code; }) || null;
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
    var prefix = journalCode + '-' + year + '-';
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
    var date = payload.date;
    var lines = payload.lines || [];

    if (!reference) errors.push('La référence de la pièce est obligatoire.');
    if (!opts.ignoreUnique && st.entries.some(function (e) { return e.reference === reference && e.id !== payload.id; })) {
      errors.push('La référence « ' + reference + ' » existe déjà.');
    }
    if (!journal(journalCode)) errors.push('Le journal sélectionné est inconnu.');
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
      if (!acc || !account(acc)) {
        errors.push(label + 'le compte est obligatoire.');
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

    return {
      ok: errors.length === 0,
      errors: errors,
      entry: {
        id: payload.id || null,
        reference: reference,
        journal: journalCode,
        date: date,
        description: String(payload.description || '').trim(),
        status: opts.status || 'draft',
        lines: cleanLines
      }
    };
  }

  function createEntry(payload, status) {
    var result = validateEntry(payload, {
      requireBalanced: status === 'posted',
      status: status
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
    payload.id = id;
    var result = validateEntry(payload, { requireBalanced: false, status: 'draft' });
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
    var st = load();
    st.entries = st.entries.filter(function (e) { return e.id !== id; });
    save();
    return { ok: true, errors: [] };
  }

  function addAccount(data) {
    var st = load();
    var code = String(data.code || '').trim();
    var label = String(data.label || '').trim();
    var errors = [];
    if (!/^\d{4,8}$/.test(code)) errors.push('Le code doit comporter de 4 à 8 chiffres.');
    if (!label) errors.push('Le libellé est obligatoire.');
    if (st.accounts.some(function (a) { return a.code === code; })) errors.push('Ce code de compte existe déjà.');
    var nature = data.nature || 'Actif';
    if (['Actif', 'Passif', 'Charge', 'Produit'].indexOf(nature) === -1) errors.push('La nature du compte est invalide.');
    if (errors.length) return { ok: false, errors: errors };

    var acc = {
      code: code,
      label: label,
      cls: Number(code.charAt(0)),
      nature: nature,
      aux: !!data.aux,
      active: true
    };
    st.accounts.push(acc);
    st.accounts.sort(function (a, b) { return a.code.localeCompare(b.code); });
    save();
    return { ok: true, errors: [], account: acc };
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
        return e.journal === j.code && e.date >= st.cycleStart && e.date <= st.cycleEnd;
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
      if (!data || !Array.isArray(data.accounts) || !Array.isArray(data.journals) || !Array.isArray(data.entries) || !Array.isArray(data.periods)) {
        return { ok: false, errors: ['Fichier invalide : structure PERFECTO attendue.'] };
      }
      var dossier = currentDossier();
      data.exercise = dossier.exerciseYear;
      data.cycleStart = dossier.cycleStart;
      data.cycleEnd = dossier.cycleEnd;
      state = data;
      ensurePeriodsForEntries();
      save();
      return { ok: true, errors: [] };
    } catch (err) {
      return { ok: false, errors: ['Fichier JSON illisible.'] };
    }
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

  function restoreBackup() {
    var snapshot = readBackupSnapshot();
    if (!snapshot) return { ok: false, errors: ['Aucun point de restauration local valide n’est disponible.'] };

    var previousState = state ? clone(state) : null;
    state = clone(snapshot.data);
    ensurePeriodsForEntries();
    if (!save()) {
      state = previousState;
      return { ok: false, errors: ['Restauration impossible : le stockage local est indisponible ou plein.'] };
    }
    return { ok: true, errors: [], restoredAt: snapshot.createdAt };
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
    postedEntries: postedEntries,
    balance: balance,
    ledger: ledger,
    kpis: kpis,
    journalStats: journalStats,
    periodStats: periodStats,
    exportJson: exportJson,
    importJson: importJson,
    backupInfo: backupInfo,
    restoreBackup: restoreBackup,
    monthLabel: monthLabel,
    money: money,
    amount: amount,
    dateLabel: dateLabel,
    todayIso: todayIso
  };
})(window);
