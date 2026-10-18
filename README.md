# PERFECTO — suite modulaire (prototype statique)

Prototype **sans Blazor, sans WebAssembly et sans étape de build** de la suite PERFECTO.
Il comprend un écran de connexion de démonstration, un launcher central et le module
« Comptabilité générale SYSCOHADA révisé » (Lot 1). L'application tient dans trois
fichiers : `index.html`, `css/modern.css` et `js/app.js` (+ la couche de données
`js/store.js`). Elle se déploie telle quelle sur n'importe quel hébergeur statique,
y compris **Vercel**, sans configuration particulière.

## Pourquoi cette conversion ?

La version précédente s'appuyait sur une PWA Blazor publiée : runtime `_framework/`,
`js/perfecto-db.js`, service worker, artefacts `dotnet publish`. Ces fichiers
n'étaient pas présents dans le dépôt, d'où l'écran « Une erreur inattendue est
survenue » et les échecs de déploiement. Le présent prototype reproduit les parcours
du Lot 1 en HTML/CSS/JavaScript natifs, avec les mêmes règles métier et une
persistance locale. Résultat : plus de runtime à charger, plus d'artefacts à
publier, un déploiement immédiat.

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Connexion (démo) | Écran d’entrée ; aucune authentification réelle ni donnée d’identification collectée |
| Launcher | Présentation des modules annoncés ; accès à la Comptabilité générale, autres modules à venir |
| Tableau de bord | Indicateurs (débit, crédit, résultat, pièces), dernières pièces, activité par journal, état des périodes |
| Plan comptable | 18 comptes SYSCOHADA initiaux, recherche, filtres, création de compte, export CSV |
| Journaux | Six journaux (AC, VE, BQ, CA, OD, PA) avec totaux et brouillons |
| Saisie d'écriture | Saisie multiligne, contrôle d'équilibre en direct, référence auto, brouillon ou validation |
| Pièces comptables | Liste filtrable, détail en modale, validation, modification et suppression des brouillons |
| Balance générale | Débit, crédit et solde par compte, contrôle d'équilibre, export CSV, impression |
| Journal des écritures | Écritures validées chronologiques, filtre journal/exercice, impression |
| Grand livre | Mouvements par compte et solde progressif |
| Périodes | Douze mois de l'exercice, ouverture et clôture persistées |
| Données & application | Export/import JSON, réinitialisation de la démo, installation PWA |

### Règles métier appliquées

- référence de pièce unique ;
- comptes existants uniquement ;
- débit **ou** crédit par ligne, jamais les deux ;
- au moins deux lignes mouvementées ;
- équilibre obligatoire avant validation définitive ;
- une pièce validée est immuable ;
- les brouillons sont exclus des états ;
- une période clôturée refuse les nouvelles pièces et la validation des brouillons.

### Données de démonstration

18 comptes, 6 journaux, 3 pièces validées et 1 brouillon. Les mouvements validés
sont équilibrés à **2 832 000 XOF** au débit comme au crédit ; le résultat de
démonstration est de **242 000 XOF**. Tout est persisté dans `localStorage`
(clé `perfecto.lot1.v1`) et reste disponible après rechargement.

## Lancer en local

Aucune installation, aucun `npm install` :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/modern-proto/
```

Un simple double-clic sur `modern-proto/index.html` fonctionne aussi (le service worker
est alors désactivé, ce qui est sans conséquence).

## Déployer sur Vercel

1. Importer le dépôt dans Vercel.
2. Laisser le framework sur **Other** et ne renseigner aucune commande de build.
3. Régler le **Root Directory** sur `modern-proto` (configuration historique du
   projet) **ou** sur la racine du dépôt `.` : les deux fonctionnent.

C'est tout : les chemins sont relatifs, il n'y a ni `vercel.json`, ni `builds`, ni
`functions`, ni `services` — donc plus aucune source d'erreur de configuration.
`service-worker.js` accompagne l'application dans `modern-proto/`, ce qui corrige le
404 observé auparavant. À la racine, un `index.html` de redirection prend le relais
si le Root Directory est `.`.

> **Important — quota Vercel.** Quatre projets sont connectés au dépôt (`perfect`,
> `modern-proto`, `projetperfectys-modern-proto`, `projetperfectys-pwa`) et chacun
> déclenche un déploiement à chaque push. Le compte a atteint la limite de
> déploiements (« Deployment rate limited — retry in 24 hours »). Pour retrouver un
> déploiement fiable : conserver le seul projet utile (`perfect`), supprimer les
> doublons dans Vercel, puis relancer un déploiement après réinitialisation du quota.
> Le projet `perfect` a son Root Directory sur `modern-proto` : cette structure est
> donc conservée.

## Publier aussi sur GitHub Pages (optionnel)

Le dépôt contient le workflow `.github/workflows/pages.yml`. Pour l'utiliser :

1. **Settings → Pages → Source : GitHub Actions** ;
2. onglet **Actions → Deploy prototype to GitHub Pages → Run workflow**.

Le site est alors publié sur `https://dionisse.github.io/projetperfectys/`. Ce
workflow est volontairement manuel : sans Pages activé, il ne peut pas créer le site
lui-même.

## Structure

```
index.html                    redirection vers modern-proto/ (déploiement racine)
modern-proto/index.html        coquille de l'application (navigation, topbar)
modern-proto/css/modern.css    identité GOBEX (papier, encre, vert canard et or doux), responsive et imprimable
modern-proto/js/store.js       données, règles métier, calculs, import/export
modern-proto/js/app.js         routeur, vues, formulaires, interactions
modern-proto/manifest.webmanifest  métadonnées PWA
modern-proto/service-worker.js cache hors ligne (réseau d'abord, cache en secours)
modern-proto/icon-192.png      icônes de l'application
modern-proto/icon-512.png
tests/store.test.js            tests des règles métier (Node, sans dépendance)
```

## Tests

```bash
node tests/store.test.js
```

Le script vérifie les totaux de démonstration, l'unicité des références,
l'équilibre des pièces, le verrouillage des périodes, la validation des brouillons,
le grand livre, l'ajout de compte et l'export/import. La CI GitHub Actions exécute
ces tests ainsi qu'un contrôle de syntaxe et un test de service HTTP.

## Limites de cette prévisualisation

La connexion et le launcher sont des écrans de démonstration : il n'y a pas encore
d'authentification réelle ni de connexion à Google Drive. Il n'y a pas non plus de
synchronisation multi-utilisateur ; les données comptables restent locales dans le
navigateur. Les limites comptables du Lot 1 restent applicables (notamment tiers et
auxiliaires détaillés, extourne, lettrage, rapprochement bancaire, exports PDF/Excel
et états financiers SYSCOHADA complets). Le prototype valide le parcours avant la
conception du stockage partagé et de l'authentification.
