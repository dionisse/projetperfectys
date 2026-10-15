# Déploiement sur Vercel — faire s'afficher le site après publication

Ce document décrit la configuration qui permet de publier la PWA PERFECTO sur Vercel et,
surtout, les raisons de chaque réglage : un site « déployé mais blanc » ne se voit pas dans
les tests fonctionnels, il vient presque toujours du build, du cache ou du service worker.

## 1. Diagnostic : pourquoi rien ne s'affichait

| Cause | Effet sur Vercel | Correctif apporté |
| --- | --- | --- |
| Aucune configuration de déploiement | Vercel détecte « Vite » et lance `vite build` **à la racine du monorepo**, où il n'y a ni `index.html` ni configuration Vite : le build échoue, rien n'est servi | `vercel.json` avec `framework: null`, commande de build et dossier de sortie explicites |
| Monorepo npm workspaces | Le dossier publié par défaut (`dist/` à la racine) n'existe pas | `outputDirectory: packages/pwa/dist` |
| Service worker à cache constant (`perfecto-next-v1`) | Un visiteur de retour garde **la coquille du déploiement précédent**, même cassée ; le nouveau build ne s'affiche jamais | Cache versionné par identifiant de déploiement, purge à l'activation |
| Service worker sans contrôle de statut | Un 404 ou une page d'erreur mis en cache devient un écran blanc **permanent** | Seules les réponses `ok` et de type `basic` sont mises en cache |
| Aucun en-tête `Cache-Control` | `sw.js` et `index.html` peuvent être servis périmés par les caches intermédiaires | `max-age=0, must-revalidate` sur la coquille, `immutable` sur les assets hachés |
| Pas de réécriture SPA | Un lien profond partagé (`/comptabilite/pieces`) renvoie 404 | Réécriture de tout chemin inconnu vers `/index.html` |
| `legacy/` et archives zip (≈ 14 Mo) téléversés | Envoi et build inutilement lourds, risque de dépassement de quota | `.vercelignore` (le dépôt passe de 150 Mo à ≈ 1 Mo envoyés) |

## 2. Ce que déclare `vercel.json`

```jsonc
{
  "framework": null,                              // pas de détection automatique
  "installCommand": "npm ci --no-audit --no-fund", // installation déterministe depuis le lockfile
  "buildCommand": "npm run build:pwa",            // script racine → espace de travail @perfecto/pwa
  "outputDirectory": "packages/pwa/dist",          // ce qui est publié
  "build": { "env": { "NODE_VERSION": "22.x" } },  // Node ≥ 20 exigé par le dépôt
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [ /* voir ci-dessous */ ]
}
```

Règle de routage appliquée par Vercel (et reproduite par l'outil de prévisualisation) :
**un fichier existant est servi tel quel ; sinon la réécriture renvoie la coquille SPA.**
Les assets hachés (`/assets/index-XXXX.js`) ne sont donc jamais détournés vers du HTML.

En-têtes, et leur raison d'être :

| Chemin | En-tête | Pourquoi |
| --- | --- | --- |
| `/assets/(.*)` | `Cache-Control: public, max-age=31536000, immutable` | Le nom contient l'empreinte du contenu : un an de cache sans risque |
| `/sw.js` | `Cache-Control: public, max-age=0, must-revalidate` + `Service-Worker-Allowed: /` | Le navigateur doit voir immédiatement le worker d'un nouveau déploiement |
| `/index.html` | `Cache-Control: public, max-age=0, must-revalidate` | La coquille référence les assets hachés du déploiement courant |
| `/manifest.webmanifest` | `max-age=0, must-revalidate` + `Content-Type: application/manifest+json` | Type MIME exact exigé pour l'installation en application |
| `/(.*)` | `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` | Durcissement minimal, sans effet sur l'affichage |

Volontairement **absent** : `X-Frame-Options` et `Content-Security-Policy: frame-ancestors`.
Ils bloqueraient l'affichage dans un iframe d'origine différente (aperçu Arena, intégration
chez un client). À reintroduire, avec une liste d'origines, quand l'authentification existera.

## 3. Publier le site

1. Sur [vercel.com/new](https://vercel.com/new), importer le dépôt `dionisse/projetperfectys`.
2. **Root Directory** : laisser la racine du dépôt (c'est là que se trouve `vercel.json`).
3. **Framework Preset** : `Other` — la détection automatique est désactivée par la configuration.
4. Commandes et dossier de sortie : rien à saisir, `vercel.json` les impose.
5. Déployer. Chaque `git push` sur la branche suivie redéploie ; les appels de commentaires
   produisent une URL de préproduction distincte.

En ligne de commande, si le projet est déjà relié :

```bash
npm i -g vercel        # une fois
vercel                 # préproduction
vercel --prod          # production
```

## 4. Service worker : pourquoi un visiteur de retour voit la nouvelle version

`packages/pwa/src/main.tsx` enregistre le worker avec un identifiant de build :

```ts
navigator.serviceWorker.register(`./sw.js?v=${buildId}`)
```

L'identifiant vient de `VERCEL_GIT_COMMIT_SHA` (12 premiers caractères), sinon de
`VERCEL_DEPLOYMENT_ID`, sinon de l'horodatage du build local. Il est injecté à la
compilation par `define` dans `packages/pwa/vite.config.ts`.

Effets en chaîne :

1. nouvelle URL de script → le navigateur installe le worker du déploiement courant ;
2. `sw.js` lit `?v=` et nomme son cache `perfecto-next-<identifiant>` ;
3. à l'activation, tous les caches d'un autre nom sont supprimés → aucune coquille périmée ;
4. `skipWaiting()` + `clients.claim()` → la nouvelle version prend la main sans attendre
   que tous les onglets soient fermés ;
5. l'échec d'enregistrement est attrapé et journalisé : **le site s'affiche quand même**,
   le mode hors ligne est un confort, pas une condition de fonctionnement.

## 5. Vérifier un déploiement

```bash
BASE=https://votre-projet.vercel.app

# La coquille et un lien profond renvoient le même document (réécriture SPA).
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" $BASE/
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" $BASE/comptabilite/pieces

# Le worker n'est pas mis en cache et peut piloter tout le site.
curl -sSI $BASE/sw.js | grep -iE "cache-control|service-worker-allowed"

# Les assets hachés sont immuables et bien typés.
curl -sSI $BASE/assets/$(curl -sS $BASE/ | grep -o 'assets/index-[^"]*\.js' | head -1 | cut -d/ -f2) \
  | grep -iE "cache-control|content-type"
```

Attendu : `200 text/html` sur les deux premiers, `max-age=0, must-revalidate` sur `sw.js`,
`immutable` et `text/javascript` sur l'asset.

## 6. Prévisualiser localement les règles Vercel

```bash
npm run build:pwa
npm run preview:vercel      # http://localhost:5173
```

`scripts/serve-vercel-preview.mjs` lit **le vrai `vercel.json`** (dossier de sortie,
réécritures, en-têtes) et sert `packages/pwa/dist` avec la même logique que Vercel :
fichier existant d'abord, réécriture SPA ensuite, en-têtes déclarés appliqués. Ce n'est pas
une copie approximative : c'est le contrat de déploiement exécuté sur le build réel.

## 7. Garde-fous automatisés

`packages/pwa/test/deployment.test.ts` (15 assertions) échoue si :

- `vercel.json` perd `framework: null`, la commande de build ou le dossier de sortie ;
- la sortie Vite (`outDir`, `base`) diverge du dossier publié ;
- la réécriture SPA disparaît, ou un en-tête de cache réapparaît sur la coquille ;
- un en-tête de cadrage (`X-Frame-Options`, `frame-ancestors`) est ajouté ;
- **une dépendance déclarée par un espace de travail est absente du lockfile** — la panne
  classique : `npm ci` sur Vercel n'installe pas le paquet, le build échoue ;
- le service worker revient à un cache constant, ou met en cache une réponse en échec ;
- après build : une référence de `dist/index.html` pointe vers un fichier inexistant, le
  manifeste est invalide, une icône manque, ou un lien profond ne retombe pas sur la coquille.

Les vérifications portant sur `dist/` sont ignorées tant que le build n'a pas été lancé.

## 8. Ajouter une dépendance sans casser le déploiement

Vercel installe avec `npm ci`, qui refuse un lockfile désynchronisé. Toujours installer dans
l'espace de travail concerné **et committer le lockfile** :

```bash
npm install exceljs -w @perfecto/exports
git add package.json package-lock.json packages/exports/package.json
```

`npm test` vérifie ensuite que chaque dépendance déclarée figure bien dans `package-lock.json`.

## 9. Dépannage « page blanche »

| Symptôme | Cause probable | Geste |
| --- | --- | --- |
| Build Vercel en échec, log « vite: not found » ou `index.html` introuvable à la racine | Détection automatique de framework, ou `vercel.json` absent du déploiement | Vérifier que `vercel.json` est à la racine et que *Root Directory* vaut la racine |
| Build en échec sur `npm ci` (`lock file does not satisfy`) | Lockfile non committé après un ajout de dépendance | Voir §8, puis repousser |
| Site blanc pour vous seul, correct en navigation privée | Ancien service worker en cache | Le worker se remplace au déploiement suivant ; au besoin, DevTools → Application → *Unregister* |
| Assets en 404 après déploiement | `base` Vite différent de `/`, ou `outputDirectory` erroné | `base: "/"` dans `vite.config.ts`, `outputDirectory: packages/pwa/dist` |
| Les liens profonds renvoient 404 | Réécriture SPA absente | `rewrites` dans `vercel.json` |
| L'aperçu dans un iframe externe reste vide | En-tête de cadrage ajouté | Retirer `X-Frame-Options` / `frame-ancestors` (voir §2) |

## 10. Portée et suite

Ce déploiement publie la **coquille web** : le noyau comptable, les écrans et le stockage
IndexedDB tournent entièrement dans le navigateur, hors ligne, sans serveur. Il n'y a donc
aucune API à héberger pour l'instant — d'où l'absence de dossier `api/`.

Quand la synchronisation multi-postes arrivera (rôles, journal de synchronisation, API),
les fonctions serverless Vercel prendront place dans `api/` à la racine, et `vercel.json`
devra exclure ces chemins de la réécriture SPA (`"source": "/((?!api/).*)"`) pour que les
appels d'API ne reçoivent pas du HTML.
