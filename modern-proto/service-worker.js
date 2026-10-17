/*
 * Service Worker pour Perfecto PWA
 * Gère la mise en cache des ressources statiques et la mise à jour hors ligne
 */

const CACHE_NAME = 'perfecto-pwa-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/modern.css',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
];

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// Activation du service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
}