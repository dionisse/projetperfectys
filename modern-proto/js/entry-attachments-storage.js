/* PERFECTO · Justificatifs de pièces en stockage navigateur pour la phase de test.
   Le mode démo conserve les blobs dans IndexedDB sur cet appareil ; aucun transfert Drive/serveur. */
(function (root) {
  'use strict';

  var DATABASE_NAME = 'perfecto-entry-attachments-demo';
  var DATABASE_VERSION = 1;
  var ATTACHMENTS_STORE = 'entry-attachments';
  var databasePromise = null;
  var MIME_BY_EXTENSION = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png'
  };

  function available() {
    return !!(root.indexedDB && typeof root.indexedDB.open === 'function');
  }

  function validateFile(file) {
    if (!file || typeof file !== 'object') return { ok: false, errors: ['Choisissez un fichier justificatif.'] };
    var name = String(file.name || '').trim();
    var match = name.match(/\.([^.]+)$/);
    var extension = match ? match[1].toLowerCase() : '';
    var expectedMime = MIME_BY_EXTENSION[extension];
    if (!expectedMime) return { ok: false, errors: ['Format refusé pour « ' + (name || 'fichier sans nom') + ' ». Utilisez PDF, JPG, JPEG ou PNG.'] };
    var mimeType = String(file.type || '').toLowerCase();
    if (mimeType && mimeType !== expectedMime && mimeType !== 'application/octet-stream' &&
        !((extension === 'jpg' || extension === 'jpeg') && (mimeType === 'image/pjpeg' || mimeType === 'image/jpg'))) {
      return { ok: false, errors: ['Le type du fichier « ' + name + ' » ne correspond pas à son extension.'] };
    }
    if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
      return { ok: false, errors: ['Le fichier « ' + name + ' » est vide ou illisible.'] };
    }
    return { ok: true, errors: [], mimeType: expectedMime };
  }

  function openDatabase() {
    if (!available()) return Promise.reject(new Error('Le stockage local des justificatifs n’est pas disponible dans ce navigateur.'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(function (resolve, reject) {
      var request;
      try { request = root.indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
      catch (error) { databasePromise = null; reject(error); return; }
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(ATTACHMENTS_STORE)) {
          var store = database.createObjectStore(ATTACHMENTS_STORE, { keyPath: 'id' });
          store.createIndex('dossierEntry', ['dossierId', 'entryId'], { unique: false });
        }
      };
      request.onsuccess = function () {
        var database = request.result;
        database.onversionchange = function () { database.close(); databasePromise = null; };
        resolve(database);
      };
      request.onerror = function () { databasePromise = null; reject(request.error || new Error('Ouverture du stockage local des justificatifs impossible.')); };
      request.onblocked = function () { databasePromise = null; reject(new Error('Le stockage des justificatifs est bloqué par un autre onglet PERFECTO.')); };
    });
    return databasePromise;
  }

  function metadata(record) {
    return {
      id: record.id,
      dossierId: record.dossierId,
      entryId: record.entryId,
      name: record.name,
      mimeType: record.mimeType,
      size: record.size,
      createdAt: record.createdAt
    };
  }

  function createId() {
    return 'ea-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function save(dossierId, entryId, file) {
    dossierId = String(dossierId || '');
    entryId = String(entryId || '');
    var validation = validateFile(file);
    if (!dossierId || !entryId) return Promise.reject(new Error('Le dossier et la pièce comptable sont obligatoires.'));
    if (!validation.ok) return Promise.reject(new Error(validation.errors.join(' ')));
    var record = {
      id: createId(),
      dossierId: dossierId,
      entryId: entryId,
      name: String(file.name).trim(),
      mimeType: validation.mimeType,
      size: Number(file.size),
      createdAt: new Date().toISOString(),
      blob: typeof file.slice === 'function' ? file.slice(0, file.size, validation.mimeType) : file
    };
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction;
        try { transaction = database.transaction(ATTACHMENTS_STORE, 'readwrite'); }
        catch (error) { reject(error); return; }
        transaction.objectStore(ATTACHMENTS_STORE).add(record);
        transaction.oncomplete = function () { resolve(metadata(record)); };
        transaction.onerror = function () { reject(transaction.error || new Error('Enregistrement local du justificatif impossible.')); };
        transaction.onabort = function () { reject(transaction.error || new Error('Enregistrement local du justificatif annulé.')); };
      });
    });
  }

  function list(dossierId, entryId) {
    dossierId = String(dossierId || '');
    entryId = String(entryId || '');
    if (!dossierId || !entryId) return Promise.resolve([]);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(ATTACHMENTS_STORE, 'readonly');
        var request = transaction.objectStore(ATTACHMENTS_STORE).index('dossierEntry').getAll([dossierId, entryId]);
        request.onsuccess = function () {
          var records = Array.isArray(request.result) ? request.result : [];
          records.sort(function (left, right) { return String(left.createdAt || '').localeCompare(String(right.createdAt || '')); });
          resolve(records);
        };
        request.onerror = function () { reject(request.error || new Error('Lecture des justificatifs locaux impossible.')); };
      });
    });
  }

  function removeAll(dossierId, entryId) {
    dossierId = String(dossierId || '');
    entryId = String(entryId || '');
    if (!dossierId || !entryId) return Promise.resolve(0);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(ATTACHMENTS_STORE, 'readwrite');
        var store = transaction.objectStore(ATTACHMENTS_STORE);
        var request = store.index('dossierEntry').getAllKeys([dossierId, entryId]);
        var count = 0;
        request.onsuccess = function () {
          (request.result || []).forEach(function (key) { store.delete(key); count += 1; });
        };
        transaction.oncomplete = function () { resolve(count); };
        transaction.onerror = function () { reject(transaction.error || new Error('Suppression locale des justificatifs impossible.')); };
        transaction.onabort = function () { reject(transaction.error || new Error('Suppression locale des justificatifs annulée.')); };
      });
    });
  }

  function remove(dossierId, entryId, attachmentId) {
    dossierId = String(dossierId || '');
    entryId = String(entryId || '');
    attachmentId = String(attachmentId || '');
    if (!dossierId || !entryId || !attachmentId) return Promise.reject(new Error('Le justificatif à retirer est incomplet.'));
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(ATTACHMENTS_STORE, 'readwrite');
        var store = transaction.objectStore(ATTACHMENTS_STORE);
        var request = store.get(attachmentId);
        var removed = false;
        request.onsuccess = function () {
          var record = request.result;
          if (!record || record.dossierId !== dossierId || record.entryId !== entryId) return;
          store.delete(attachmentId);
          removed = true;
        };
        transaction.oncomplete = function () {
          if (removed) resolve(true);
          else reject(new Error('Justificatif introuvable dans cette pièce.'));
        };
        transaction.onerror = function () { reject(transaction.error || new Error('Suppression locale du justificatif impossible.')); };
        transaction.onabort = function () { reject(transaction.error || new Error('Suppression locale du justificatif annulée.')); };
      });
    });
  }

  var api = {
    DATABASE_NAME: DATABASE_NAME,
    storageMode: 'browser-local-demo',
    available: available,
    validateFile: validateFile,
    save: save,
    list: list,
    remove: remove,
    removeAll: removeAll
  };
  root.PerfectoEntryAttachmentsStorage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
