/*
 * PERFECTO · Service worker du prototype statique
 * Stratégie : réseau d'abord (contenu toujours à jour), cache en secours hors ligne.
 */

const CACHE_NAME = 'perfecto-static-v86';
const APP_SHELL = [
  './',
  './index.html',
  './css/modern.css',
  './css/accounting-configuration.css',
  './css/table-design-system.css',
  './js/accounting-chart.js',
  './js/accounting-framework.js',
  './js/store.js',
  './js/modules.js',
  './js/permissions.js',
  './js/accounting-navigation.js',
  './js/cash-operations.js',
  './js/account-movements.js',
  './vendor/fflate-0.8.2.js',
  './js/accounting-exchange.js',
  './js/journal-lines-report.js',
  './js/fec-import.js',
  './js/bank-statement.js',
  './js/bank-statement-storage.js',
  './js/accounting-consolidation.js',
  './js/accounting-bridge.js',
  './js/accounting-balance-recalculation.js',
  './js/accounting-database-repair.js',
  './js/payroll-hr.js',
  './js/payroll-centralization.js',
  './js/sales-stock-invoicing.js',
  './js/sales-centralization.js',
  './js/accounting-centralization.js',
  './js/centralization-cancellation.js',
  './js/fixed-asset-depreciation.js',
  './js/opening-balances.js',
  './js/app.js',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/service-worker.js')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
