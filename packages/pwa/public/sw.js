/*
 * Service worker PERFECTO : coquille hors ligne, sans jamais figer un déploiement.
 *
 * Trois règles apprises du terrain :
 *  1. la version du cache vient de l'URL d'enregistrement (`./sw.js?v=<build>`) :
 *     chaque déploiement Vercel installe un cache neuf et purge le précédent ;
 *  2. on ne met en cache qu'une réponse SAINE (2xx, même origine) : un 404 ou une
 *     page d'erreur mise en cache transformerait un incident en écran blanc permanent ;
 *  3. la navigation repart toujours du réseau quand il est disponible, et retombe sur
 *     la coquille `index.html` sinon — l'application reste utilisable hors ligne.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE = `perfecto-next-${VERSION}`;

/** Coquille minimale : de quoi afficher l'interface sans aucun réseau. */
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./perfecto-mark.png"
];

/** Une réponse digne du cache : complète, réussie, servie par ce déploiement. */
function cacheable(response) {
  return Boolean(response) && response.ok && response.type === "basic";
}

function store(request, response) {
  if (!cacheable(response)) return Promise.resolve();
  const copy = response.clone();
  return caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // Un fichier manquant ne doit pas empêcher l'installation du reste.
      .then((cache) => Promise.all(SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Toute navigation réussie rafraîchit la coquille de secours.
          void store("./index.html", response);
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("./index.html"))
        )
    );
    return;
  }

  // Ressources : les fichiers `/assets/*` sont hachés par Vite, donc immuables ;
  // le cache d'abord évite un aller-retour réseau à chaque affichage.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          void store(request, response);
          return response;
        })
    )
  );
});
