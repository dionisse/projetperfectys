/*
 * PERFECTO · Service worker du prototype statique
 * Stratégie : réseau d'abord (contenu toujours à jour), cache en secours hors ligne.
 */

const CACHE_NAME = 'perfecto-static-v165';
const APP_SHELL = [
  './',
  './index.html',
  './assets/OHADAr-template.xlsx',
  './assets/aib-suppliers-template.xlsx',
  './assets/vat-declaration-template.xlsx',
  './assets/is-declaration-template.xlsx',
  './css/modern.css',
  './css/accounting-configuration.css',
  './css/table-design-system.css',
  './css/currency-balance-report.css',
  './css/budget-reports.css',
  './css/matching-edition-reports.css',
  './css/pointing-edition-reports.css',
  './css/fixed-asset-overview-report.css',
  './css/fixed-asset-depreciation-report.css',
  './css/fixed-asset-additional-reports.css',
  './css/financial-framework-edition.css',
  './css/balance-items-edition.css',
  './css/accounting-plan-edition.css',
  './css/definitions-plans-edition.css',
  './css/associated-items-edition.css',
  './css/vat-difference-report.css',
  './css/vat-payment-report.css',
  './css/vat-detail-report.css',
  './css/aib-suppliers-report.css',
  './css/nominative-declaration-report.css',
  './css/bic-advances-report.css',
  './css/ohada-financial-statements.css',
  './css/is-declaration.css',
  './css/iba-declaration.css',
  './js/accounting-chart.js',
  './js/account-search.js',
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
  './js/accounting-balance-report.js',
  './js/accounting-framework-edition-report.js',
  './js/accounting-balance-items.js',
  './js/balance-items-edition-report.js',
  './js/accounting-plan-edition-report.js',
  './js/accounting-associated-items.js',
  './js/account-associated-items-edition-report.js',
  './js/definitions-plans-edition-reports.js',
  './js/vat-difference-report.js',
  './js/vat-payment-report.js',
  './js/vat-payment-allocation.js',
  './js/vat-declaration-workbook.js',
  './js/vat-detail-report.js',
  './js/aib-suppliers-report.js',
  './js/nominative-declaration-report.js',
  './js/bic-advances-report.js',
  './js/ohada-financial-statements.js',
  './js/is-declaration.js',
  './js/is-tax-adjustments.js',
  './js/financial-result.js',
  './js/iba-declaration.js',
  './js/currency-balance-report.js',
  './js/currency-supplementary-reports.js',
  './js/budget-reports.js',
  './js/general-ledger-report.js',
  './js/matching-edition-reports.js',
  './js/pointing-edition-reports.js',
  './js/general-counterpart-detail-report.js',
  './js/general-counterpart-total-report.js',
  './js/multiyear-history-report.js',
  './js/account-situation-report.js',
  './js/opening-balance-report.js',
  './js/opening-balance-journal-report.js',
  './js/aged-balance-report.js',
  './js/third-party-balance-report.js',
  './js/third-party-ledger-report.js',
  './js/third-party-balance-justification-report.js',
  './js/third-party-statement-report.js',
  './js/third-party-account-situation-report.js',
  './js/third-party-nature-breakdown-report.js',
  './js/third-party-opening-balance-report.js',
  './js/fec-import.js',
  './js/bank-statement.js',
  './js/bank-statement-storage.js',
  './js/entry-attachments-storage.js',
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
  './js/fixed-asset-depreciation-report.js',
  './js/fixed-asset-overview-report.js',
  './js/fixed-asset-additional-reports.js',
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
      .catch((error) => {
        console.error('Installation annulée : le cache complet de l’application n’a pas pu être créé.', error);
        return caches.delete(CACHE_NAME).then(() => { throw error; });
      })
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
