/* Identité visible et maintien des identifiants techniques historiques. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const root = read('index.html');
const page = read('modern-proto/index.html');
const app = read('modern-proto/js/app.js');
const manifest = JSON.parse(read('modern-proto/manifest.webmanifest'));
assert.match(root, /<title>EMRYS/);
assert.match(page, /<title>EMRYS/);
assert.match(page, /<strong>EMRYS<span class="brand-dot">/);
assert.equal(manifest.short_name, 'EMRYS');
assert.match(manifest.name, /^EMRYS/);
assert.equal((app.match(/class="suite-mark">E<span>/g) || []).length, 3);
assert.match(app, /document\.title = 'EMRYS/);
assert.match(app, /'emrys-comptabilite-' \+ S\.todayIso\(\) \+ '\.json'/);
assert.match(read('modern-proto/service-worker.js'), /const CACHE_NAME = 'emrys-static-v236'/);
assert.match(read('modern-proto/js/store.js'), /STORAGE_KEY = 'perfecto\.lot1\.v1'/);
const exchange = read('modern-proto/js/accounting-exchange.js');
assert.match(exchange, /SYSTEME_SOURCE: 'PERFECTO'/);
assert.match(exchange, /PERFECTO-ECHANGE/);
assert.match(exchange, /PERFECTO-BALANCE/);
assert.match(exchange, /PERFECTO-AUXILIAIRE/);
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512]]) {
  const image = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', file));
  assert.equal(image.readUInt32BE(16), size);
  assert.equal(image.readUInt32BE(20), size);
}
console.log('Identité EMRYS, icônes, cache et identifiants historiques — OK');
