# PERFECTO — suite modulaire (prototype statique)

Prototype **sans Blazor, sans WebAssembly et sans étape de build** de la suite PERFECTO.
Il comprend un écran de connexion de démonstration, un launcher central et le module
« Comptabilité générale SYSCOHADA révisé » (Lot 1). L’application utilise des fichiers
HTML, CSS et JavaScript natifs : interface, catalogue, politique d’accès de démonstration
et couche de données. Elle se déploie telle quelle sur tout hébergeur statique, y compris
**Vercel**, sans étape de build.

## Pourquoi cette conversion ?

La version précédente s'appuyait sur une PWA Blazor publiée : runtime `_framework/`,
`js/perfecto-db.js`, service worker, artefacts `dotnet publish`. Ces fichiers
n'étaient pas présents dans le dépôt, d'où l'écran « Une erreur inattendue est
survenue » et les échecs de déploiement. Le présent prototype reproduit les parcours
du Lot 1 en HTML/CSS/JavaScript natifs, avec les mêmes règles métier et une
persistance locale. Résultat : plus de runtime à charger, plus d'artefacts à
publier, un déploiement immédiat.

Le backlog et les décisions de conception sont suivis dans [`BACKLOG.md`](BACKLOG.md).

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Navigation comptable | Huit menus latéraux (Fichier, Définitions, Saisie, Éditions, Déclarations, Fin d’exercice, Paramètres, Outils), sous-menus en onglets verticaux et éléments imbriqués en listes ; les fonctions analytiques et non réalisées restent inactives |
| Fichier & interopérabilité | Format commun PERFECTO-ÉCHANGE v1 : classeur Excel `.xlsx` multi-feuilles et CSV compatible Excel ; export du plan, des journaux et des écritures validées ; import avec aperçu, correspondance des comptes/journaux, point de restauration et ajout sans remplacement. Adaptateurs natifs Sage, PERFECTO historique, HYPERSOFT et ODOO à construire |
| Téléphone | Consultation limitée aux Éditions (balance, journal, grand livre) ; aucune saisie comptable ni création de dossier sur téléphone |
| Connexion (démo) | Aucun identifiant collecté ; e-mail/mot de passe et Google sont prévus, mais non actifs en démo |
| Launcher | Catalogue modulaire, recherche et filtres ; ouverture selon les droits du profil simulé, autres modules à venir |
| Organisation & accès (démo) | Profils temporaires et droits explicites par personne, module, entreprise cliente, dossier et action ; refus par défaut |
| Dossiers clients | Liste multi-dossiers ouverte depuis le module Comptabilité ; création d’entreprise, code, type comptable, référence et cycle paramétrable |
| Tableau de bord | Indicateurs (débit, crédit, résultat, pièces), dernières pièces, activité par journal, état des périodes |
| Plan comptable | 18 comptes SYSCOHADA initiaux, recherche, filtres, création de compte, export CSV |
| Journaux | Six journaux (AC, VE, BQ, CA, OD, PA) avec totaux et brouillons |
| Saisie d'écriture | Saisie multiligne, contrôle d'équilibre en direct, référence auto, brouillon ou validation |
| Pièces comptables | Liste filtrable, détail en modale, validation, modification et suppression des brouillons |
| Balance générale | Débit, crédit et solde par compte, contrôle d'équilibre, export CSV, impression |
| Journal des écritures | Écritures validées chronologiques, filtre journal/exercice, impression |
| Grand livre | Mouvements par compte et solde progressif |
| Périodes | Périodes mensuelles couvrant le cycle défini pour le dossier (calendaire ou non), ouverture et clôture persistées |
| Données & application | Sauvegarde/restauration native JSON, point de restauration local avant modification, installation PWA |

### Interopérabilité comptable — incrément v1

Le menu **Fichier** propose le format neutre `PERFECTO-ECHANGE` version 1 en classeur Excel `.xlsx` et en CSV UTF-8 compatible avec Excel. Le classeur réunit les feuilles Instructions, Dossier, Comptes, Journaux et Écritures. Une ligne de la feuille Écritures/du CSV représente une ligne de mouvement ; plusieurs lignes portant le même journal, date et référence sont regroupées en une pièce.

- L’export d’échange porte sur les écritures validées du cycle actif ; les brouillons en sont exclus. Le plan comptable et les journaux peuvent être exportés séparément.
- L’import CSV ou `.xlsx` présente un aperçu avant toute modification, permet d’associer les comptes et journaux sources aux référentiels du dossier, refuse les références en doublon et crée un point de restauration local avant d’ajouter le lot. Les macros et les formules ne sont pas exécutées ; les cellules de formules dans Écritures sont refusées.
- Le mode recommandé crée des brouillons. Le mode « écritures validées » contrôle l’équilibre et les périodes ouvertes et requiert le droit de validation.
- Le lot est ajouté au dossier actif ; il ne remplace pas les données présentes. Les comptes/journaux inconnus ne sont jamais créés automatiquement.
- Le format commun est la première passerelle Excel/CSV, **pas encore un import direct des formats propriétaires** de Sage Comptabilité, PERFECTO historique, HYPERSOFT ou ODOO. Ces profils seront développés par version après réception et validation de fichiers d’exemple anonymisés.
- Le JSON de **Données & application** reste une sauvegarde/restauration native PERFECTO et ne doit pas être confondu avec un fichier d’échange.
- Les tiers, les données analytiques, le multidevise, les formats propriétaires de logiciels tiers et l’import de balance restent hors de ce premier incrément. Les données sont lues et produites dans le navigateur ; aucun fichier n’est envoyé à un serveur.

En-tête stable de la feuille `Ecritures` et du CSV : `FORMAT;VERSION;SYSTEME_SOURCE;REFERENCE_DOSSIER;EXERCICE;CODE_JOURNAL;LIBELLE_JOURNAL;DATE;REFERENCE_PIECE;LIBELLE_PIECE;CODE_COMPTE;LIBELLE_COMPTE;CLASSE_COMPTE;NATURE_COMPTE;DEBIT_XOF;CREDIT_XOF;STATUT_SOURCE;ID_SOURCE`. Les colonnes peuvent être réordonnées, mais pas supprimées ni renommées dans cette version. Les montants sont des entiers sans séparateurs ; `ID_SOURCE` est répété sur chaque ligne de la même pièce.

### Règles métier appliquées

- référence de pièce unique ;
- comptes existants uniquement ;
- débit **ou** crédit par ligne, jamais les deux ;
- au moins deux lignes mouvementées ;
- équilibre obligatoire avant validation définitive ;
- une pièce validée est immuable ;
- les brouillons sont exclus des états ;
- une période clôturée refuse les nouvelles pièces et la validation des brouillons.

### Politique d’accès de démonstration

Le refus est appliqué par défaut. Le Superviseur général administre son organisation de démonstration ; les profils gestionnaire et utilisateur/employé ne reçoivent aucun droit par leur rôle. Les droits peuvent être accordés par personne, module, organisation ou identifiant de dossier client, et action. Toute action comptable exige aussi le droit de consulter le module dans le même grant et la même portée. Plusieurs grants par module se cumulent sans transférer une action d’un dossier client à un autre.

Un dossier désigne une entreprise cliente enregistrée pour traitement. Le module Comptabilité ouvre d’abord la liste des dossiers autorisés ; l’ouverture d’une entreprise conduit ensuite à son tableau de bord. La création définit le nom du client, un code de dossier éditable, le type de comptabilité et les dates de début/fin du cycle. L’adresse, le N° IFU, le N° RCCM, l’email et le téléphone peuvent être ajoutés facultativement. La référence suit le format `CODETYPE-CODECLIENTANNÉE` : Cabinet Godwin, comptabilité révisée (`COR`), code `GOD` et exercice 2026 donnent `COR-GOD2026`. Le code est saisi explicitement et reste modifiable ; aucune règle automatique n’est imposée depuis le nom. L’unicité de la référence est vérifiée.

La navigation comptable présente les huit rubriques demandées à gauche, avec les sous-menus en onglets verticaux et les éléments de niveau inférieur en listes. Une fonction disponible ouvre le parcours existant ; une fonction générale non développée porte l’état « À construire » ; les fonctions analytiques, dépendantes d’autres modules ou à confirmer restent inactives et n’exécutent aucun traitement. La Comptabilité analytique demeure un module séparé. Sur téléphone, l’accès est limité à la consultation des éditions (balance, journal et grand livre) ; la saisie et la création de dossiers se font sur ordinateur ou tablette.

Chaque dossier a des données comptables isolées dans le navigateur. Le jeu historique principal et ses écritures sont conservés ; tout nouveau dossier démarre sans recopier ces écritures, avec le référentiel comptable initial. Le moteur garde les périodes mensuelles dans les bornes du cycle et refuse les nouvelles écritures hors cycle. Les cycles non calendaires sont pris en charge ; cette version limite un cycle à 18 mois. Le registre de dossiers migre les métadonnées héritées tout en conservant les anciennes clés et données comptables. Cette simulation reste côté client : elle n’est ni une sécurité réelle ni une authentification, ne se synchronise pas avec Google Drive et ne prend pas en charge l’écriture simultanée multi-utilisateur.

### Données de démonstration

Le dossier principal conserve les 18 comptes, 6 journaux, 3 pièces validées et 1 brouillon historiques. Les mouvements validés sont équilibrés à **2 832 000 XOF** au débit comme au crédit ; le résultat de démonstration est de **242 000 XOF**. Le registre des dossiers clients et chaque jeu comptable sont persistés dans `localStorage`. Chaque nouveau dossier reçoit le plan de comptes, les journaux et les périodes de son cycle, sans écritures recopiées. Les profils et leurs grants de démonstration restent temporaires et ne survivent pas au rechargement.

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
modern-proto/js/store.js       dossiers clients, cycles, données isolées, règles métier, calculs, import/export
modern-proto/js/modules.js     catalogue déclaratif des modules du launcher
modern-proto/js/permissions.js politique d’accès démo (refus par défaut)
modern-proto/js/accounting-navigation.js  menus, sous-menus et états d’activation du Lot 1
modern-proto/js/app.js         routeur, vues multi-dossiers, formulaires et interactions comptables
BACKLOG.md                     décisions confirmées et étapes prévues
modern-proto/manifest.webmanifest  métadonnées PWA
modern-proto/service-worker.js cache hors ligne (réseau d'abord, cache en secours)
modern-proto/icon-192.png      icônes de l'application
modern-proto/icon-512.png
tests/store.test.js            tests des règles métier (Node, sans dépendance)
tests/workspaces.test.js       tests de migration, références, cycles et isolation des dossiers clients
```

## Tests

```bash
node tests/store.test.js
node tests/workspaces.test.js
node tests/modules.test.js
node tests/permissions.test.js
node tests/accounting-navigation.test.js
```

Les tests couvrent les règles comptables, la migration, les références, les cycles et l’isolation des dossiers clients, le catalogue modulaire, la politique d’accès de démonstration (refus par défaut, organisation, actions et portée par identifiant de dossier) ainsi que la hiérarchie et les états du menu comptable. La CI GitHub Actions exécute ces scénarios ainsi qu’un contrôle de syntaxe et un test de service HTTP.

## Limites de cette prévisualisation

La connexion et le launcher sont des écrans de démonstration : il n'y a pas encore
d'authentification réelle ni de connexion à Google Drive. Un point de restauration
local conserve le dernier état comptable avant une modification, mais reste dans le
même navigateur et ne remplace pas une sauvegarde externe indépendante. Il n'y a pas non plus de
synchronisation multi-utilisateur ; les dossiers et leurs données comptables restent
locaux dans le navigateur et ne sont pas partagés entre appareils. Les limites comptables du Lot 1 restent applicables (notamment tiers et
auxiliaires détaillés, extourne, lettrage, rapprochement bancaire, exports PDF/Excel
et états financiers SYSCOHADA complets). Le prototype valide le parcours avant la
conception du stockage partagé et de l'authentification.
