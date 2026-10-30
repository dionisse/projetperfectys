/* Vérifie que le service worker ne s’active qu’après la mise en cache complète du shell. */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '..', 'modern-proto', 'service-worker.js'), 'utf8');

function loadWorker(addAll) {
  const listeners = Object.create(null);
  const calls = { skipWaiting: 0, deleted: [] };
  const cache = { addAll };
  const sandbox = {
    self: {
      location: { origin: 'https://perfecto.example' },
      addEventListener(name, handler) { listeners[name] = handler; },
      skipWaiting() { calls.skipWaiting += 1; return Promise.resolve(); },
      clients: { claim() { return Promise.resolve(); } }
    },
    caches: {
      open() { return Promise.resolve(cache); },
      delete(name) { calls.deleted.push(name); return Promise.resolve(true); },
      keys() { return Promise.resolve([]); },
      match() { return Promise.resolve(null); }
    },
    console: { error() {} },
    URL,
    fetch() { return Promise.resolve({ ok: true, clone() { return this; } }); },
    Response: { error() { return {}; } }
  };
  vm.runInNewContext(source, sandbox, { filename: 'service-worker.js' });
  return { listeners, calls };
}

function runInstall(listener) {
  let installation;
  listener({ waitUntil(promise) { installation = promise; } });
  return installation;
}

test('cache incomplet : installation rejetée et aucune activation forcée', async () => {
  const failure = new Error('ressource indisponible');
  const worker = loadWorker(() => Promise.reject(failure));
  await assert.rejects(runInstall(worker.listeners.install), /ressource indisponible/);
  assert.equal(worker.calls.skipWaiting, 0);
  assert.equal(worker.calls.deleted.length, 1, 'le cache partiel est supprimé');
});

test('cache complet : le service worker peut s’activer immédiatement', async () => {
  const worker = loadWorker(() => Promise.resolve());
  await runInstall(worker.listeners.install);
  assert.equal(worker.calls.skipWaiting, 1);
  assert.equal(worker.calls.deleted.length, 0);
});
