/* Justificatifs des pièces : formats autorisés et stockage local isolé par dossier/pièce. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Storage = require('../modern-proto/js/entry-attachments-storage.js');

const validFiles = [
  { name: 'facture.pdf', type: 'application/pdf', size: 1200 },
  { name: 'quittance.JPG', type: 'image/jpeg', size: 800 },
  { name: 'bon-commande.jpeg', type: 'image/jpeg', size: 900 },
  { name: 'preuve.png', type: 'image/png', size: 600 },
  { name: 'photo-sans-mime.jpg', type: '', size: 200 },
  { name: 'scan.png', type: 'application/octet-stream', size: 300 }
];
validFiles.forEach(file => assert.equal(Storage.validateFile(file).ok, true, file.name + ' est accepté'));
assert.equal(Storage.validateFile({ name: 'archive.zip', type: 'application/zip', size: 50 }).ok, false);
assert.equal(Storage.validateFile({ name: 'image.png', type: 'application/pdf', size: 50 }).ok, false);
assert.equal(Storage.validateFile({ name: 'vide.pdf', type: 'application/pdf', size: 0 }).ok, false);
assert.equal(Storage.validateFile(null).ok, false);
assert.equal(Storage.storageMode, 'browser-local-demo');
assert.equal(typeof Storage.removeAll, 'function');

const app = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'index.html'), 'utf8');
const permissions = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'js', 'permissions.js'), 'utf8');
const entriesView = app.slice(app.indexOf('function viewEntries('), app.indexOf('function clearEntryAttachmentPreviewUrls(', app.indexOf('function viewEntries(')));
assert.match(entriesView, /<th scope="col">Justificatifs<\/th>/);
assert.match(entriesView, /data-action="manage-entry-attachments"/);
assert.match(entriesView, /data-id="' \+ esc\(e\.id\)/);
assert.match(app, /accept="\.pdf,\.jpg,\.jpeg,\.png,application\/pdf,image\/jpeg,image\/png" multiple/);
assert.match(app, /EntryAttachmentsStorage\.save\(context\.dossierId, context\.entryId, file\)/);
assert.match(app, /EntryAttachmentsStorage\.list\(context\.dossierId, context\.entryId\)/);
assert.match(app, /data-action="remove-entry-attachment"/);
assert.match(app, /Les fichiers sont conservés dans IndexedDB sur ce navigateur\/appareil[\s\S]*pas encore envoyés sur Google Drive/);
assert.match(index, /js\/entry-attachments-storage\.js[\s\S]*js\/app\.js/);
assert.match(permissions, /entryAttachments\.manage/);

console.log('Justificatifs : fichiers PDF/JPG/PNG multiples, rattachement dossier/pièce et stockage local de test vérifiés.');
