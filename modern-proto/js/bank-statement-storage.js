/* PERFECTO · Stockage de démonstration des relevés dans IndexedDB du navigateur.
   Aucun envoi au serveur. Ce stockage local n'est pas un Drive organisationnel. */
(function (root) {
  'use strict';

  var DATABASE_NAME = 'perfecto-bank-statements-demo';
  var DATABASE_VERSION = 1;
  var STATEMENTS_STORE = 'statements';
  var FILES_STORE = 'source-files';
  var databasePromise = null;

  function available() {
    return !!(root.indexedDB && typeof root.indexedDB.open === 'function');
  }

  function openDatabase() {
    if (!available()) return Promise.reject(new Error('Le stockage local de relevés n’est pas disponible dans ce navigateur.'));
    if (databasePromise) return databasePromise;
    databasePromise = new Promise(function (resolve, reject) {
      var request;
      try { request = root.indexedDB.open(DATABASE_NAME, DATABASE_VERSION); }
      catch (error) { reject(error); return; }
      request.onupgradeneeded = function () {
        var database = request.result;
        if (!database.objectStoreNames.contains(STATEMENTS_STORE)) {
          var statements = database.createObjectStore(STATEMENTS_STORE, { keyPath: 'id' });
          statements.createIndex('dossierId', 'dossierId', { unique: false });
        }
        if (!database.objectStoreNames.contains(FILES_STORE)) database.createObjectStore(FILES_STORE, { keyPath: 'id' });
      };
      request.onsuccess = function () {
        var database = request.result;
        database.onversionchange = function () { database.close(); databasePromise = null; };
        resolve(database);
      };
      request.onerror = function () { databasePromise = null; reject(request.error || new Error('Ouverture du stockage local impossible.')); };
      request.onblocked = function () { databasePromise = null; reject(new Error('Le stockage des relevés est bloqué par un autre onglet PERFECTO.')); };
    });
    return databasePromise;
  }

  function save(statement, file) {
    if (!statement || !statement.id || !statement.dossierId || !file) {
      return Promise.reject(new Error('Le relevé, son dossier et son fichier source sont obligatoires.'));
    }
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction;
        try { transaction = database.transaction([STATEMENTS_STORE, FILES_STORE], 'readwrite'); }
        catch (error) { reject(error); return; }
        transaction.objectStore(STATEMENTS_STORE).put(statement);
        transaction.objectStore(FILES_STORE).put({
          id: statement.id,
          dossierId: statement.dossierId,
          fileName: statement.fileName,
          mimeType: statement.mimeType || file.type || 'application/octet-stream',
          size: Number(statement.fileSize) || Number(file.size) || 0,
          blob: typeof file.slice === 'function' ? file.slice(0, file.size, file.type) : file
        });
        transaction.oncomplete = function () { resolve(statement); };
        transaction.onerror = function () { reject(transaction.error || new Error('Échec de l’enregistrement local du relevé.')); };
        transaction.onabort = function () { reject(transaction.error || new Error('Enregistrement local annulé ; le relevé n’a pas été ajouté.')); };
      });
    });
  }

  function list(dossierId) {
    dossierId = String(dossierId || '');
    if (!dossierId) return Promise.resolve([]);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var transaction = database.transaction(STATEMENTS_STORE, 'readonly');
        var request = transaction.objectStore(STATEMENTS_STORE).index('dossierId').getAll(dossierId);
        request.onsuccess = function () {
          var statements = Array.isArray(request.result) ? request.result : [];
          statements.sort(function (a, b) { return String(b.importedAt || '').localeCompare(String(a.importedAt || '')); });
          resolve(statements);
        };
        request.onerror = function () { reject(request.error || new Error('Lecture des relevés locaux impossible.')); };
      });
    });
  }

  function get(dossierId, statementId) {
    dossierId = String(dossierId || '');
    statementId = String(statementId || '');
    if (!dossierId || !statementId) return Promise.resolve(null);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction(STATEMENTS_STORE, 'readonly').objectStore(STATEMENTS_STORE).get(statementId);
        request.onsuccess = function () {
          var statement = request.result || null;
          resolve(statement && statement.dossierId === dossierId ? statement : null);
        };
        request.onerror = function () { reject(request.error || new Error('Lecture du relevé local impossible.')); };
      });
    });
  }

  function getFile(dossierId, statementId) {
    dossierId = String(dossierId || '');
    statementId = String(statementId || '');
    if (!dossierId || !statementId) return Promise.resolve(null);
    return openDatabase().then(function (database) {
      return new Promise(function (resolve, reject) {
        var request = database.transaction(FILES_STORE, 'readonly').objectStore(FILES_STORE).get(statementId);
        request.onsuccess = function () {
          var record = request.result || null;
          resolve(record && record.dossierId === dossierId ? record : null);
        };
        request.onerror = function () { reject(request.error || new Error('Lecture du fichier source impossible.')); };
      });
    });
  }

  var api = {
    DATABASE_NAME: DATABASE_NAME,
    storageMode: 'browser-local-demo',
    available: available,
    save: save,
    list: list,
    get: get,
    getFile: getFile
  };
  root.PerfectoBankStatementStorage = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
}(typeof window === 'object' ? window : globalThis));
