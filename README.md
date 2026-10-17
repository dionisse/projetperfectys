# PERFECTO — prototype statique de comptabilité générale

Prototype **sans Blazor, sans WebAssembly et sans étape de build** du module
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
# puis ouvrir http://localhost:8080
```

Un simple double-clic sur `index.html` fonctionne aussi (le service worker est
alors désactivé, ce qui est sans conséquence).

## Déployer sur Vercel

1. Importer le dépôt dans Vercel.
2. Laisser le framework sur **Other** et ne renseigner aucune commande de build.
3. Le répertoire de sortie est la racine du dépôt.

C'est tout : `index.html` est servi à la racine, les chemins sont relatifs, il n'y a
ni `vercel.json`, ni `builds`, ni `functions`, ni `services` — donc plus aucune
source d'erreur de configuration. Le fichier `service-worker.js` est lui aussi servi
depuis la racine, ce qui corrige le 404 observé auparavant.

## Structure

```
index.html               coquille de l'application (navigation, topbar)
css/modern.css           design system autonome, responsive et imprimable
js/store.js              données, règles métier, calculs, import/export
js/app.js                routeur, vues, formulaires, interactions
manifest.webmanifest     métadonnées PWA
service-worker.js        cache hors ligne (réseau d'abord, cache en secours)
icon-192.png / 512.png   icônes de l'application
tests/store.test.js      tests des règles métier (Node, sans dépendance)
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

Toujours celles du Lot 1 : pas de tiers/auxiliaires détaillés, d'extourne, de
lettrage, de rapprochement bancaire, d'imports/exports PDF ou Excel, d'états
financiers SYSCOHADA complets, d'authentification ni de synchronisation
multi-utilisateur. Les données restent sur l'appareil (un seul utilisateur par
navigateur). Ce prototype sert à valider les parcours et l'interface avant de
brancher un stockage partagé.
