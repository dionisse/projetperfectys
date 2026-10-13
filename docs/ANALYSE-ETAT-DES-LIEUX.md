# Analyse de l'existant — PERFECTO Nouvelle Génération (main, commit 0c6d798)

**Date :** 13 octobre 2026 · **Branche d'analyse :** `arena/fe05d145-projetperfectys`
**Périmètre :** lecture intégrale des 3 documents racine, des 2 archives (intégrité vérifiée via `SHA256SUMS.txt` : `pwa.zip` OK, `source.zip` OK), des 151 fichiers sources décompressés, des 9 captures d'écran et des scripts de build/installation.

---

## 1. Ce que contient `main`

| Fichier racine | Rôle |
|---|---|
| `PERFECTO Nouvelle Génération 0.2.0-preview.1.md` | Note de livraison du Lot 1 (13/09/2026) |
| `Lot 1 — Comptabilité générale SYSCOHADA révisé.md` | Stratégie retenue + périmètre fonctionnel du Lot 1 |
| `Validation PWA du Lot 1 — premier incrément.md` | Recette navigateur du Lot 1 (captures à l'appui) |
| `Perfecto-Next-0.2.0-preview.1-source.zip` | **Tout le code source** : 9 projets .NET 10, ~3 350 lignes (≈2 500 app + ≈500 tests), 20 tests xUnit |
| `Perfecto-Next-0.2.0-preview.1-pwa.zip` | Publication Blazor WebAssembly (wwwroot + _framework, 208 entrées) |
| `SHA256SUMS.txt` | Sommes de 12 livrables — **6 seulement sont référencés ici** ; `api.zip`, `setup.exe`, `windows-portable.zip`, `dependency-audit.txt`, `antivirus-scan.txt` **manquent au dépôt** |

Le source zip embarque en plus : `README.md`, `RELEASE_NOTES.md` (Lot 0), `LOT1_RELEASE_NOTES.md`, `docs/LOT0.md`, `docs/LOT1.md`, `docs/VALIDATION_VISUELLE.md`, `docs/LOT1_VALIDATION_PWA.md` + 9 captures, `scripts/build-release.sh`, `scripts/test-installer-wine.sh`, `installer/Perfecto.Setup.nsi`.

## 2. Architecture telle que conçue

Stratégie déclarée et **correcte** : *PWA-first à noyau partagé* — le domaine, les contrats, les calculs et les composants Razor sont communs aux hôtes PWA (Blazor WASM) et Windows (WPF + BlazorWebView), chaque hôte fournissant son adaptateur de stockage.

| Projet | Rôle réel | État constaté |
|---|---|---|
| `Perfecto.Domain` | Entités + invariants (Organization, FiscalYear, AccountingEntry/Line, AuditEvent) | Solide, testé, sans dépendance technique |
| `Perfecto.Contracts` | DTO partagés UI/API | Complets pour le Lot 1 ; **aucun `OrganizationId`** dans les DTO comptables |
| `Perfecto.Application` | `IAccountingService`, `DemoAccountingService` (mémoire), `AccountingReportBuilder`, catalogue SYSCOHADA (18 comptes, 6 journaux) | Règles métier duplicables (voir §4) |
| `Perfecto.Infrastructure` | EF Core + SQLite, `DatabaseInitializer`, outbox de synchro idempotente | Utilisé **uniquement** pour l'outbox et le seed organisation |
| `Perfecto.Shared.UI` | Layout, sidebar, thème (`perfecto.css`, 284 lignes), 10 écrans comptables + dashboard + placeholders 5 modules | Rendu propre et cohérent (captures) |
| `Perfecto.Pwa` | Hôte WASM + `IndexedDbAccountingService` + `perfecto-db.js` (IndexedDB v2, seed) | Parcours fonctionnel complet |
| `Perfecto.Windows` | Hôte WPF/BlazorWebView | Compile, mais adaptateur comptable **en mémoire** |
| `Perfecto.Api` | 3 endpoints (`health`, `workspace`, `sync/pending`) | Socle, pas de métier |
| `Perfecto.Domain.Tests` | 20 tests xUnit | Couvrent domaine + service démo + outbox SQLite |

**Fonctions réellement livrées (vérifiées dans le code, pas seulement déclarées) :** plan comptable consultable/enrichissable, 6 journaux, saisie multiligne avec contrôle d'équilibre bloquant, brouillons, validation, liste + détail de pièces, balance générale, journal des écritures, grand livre à solde progressif, 12 périodes ouvrables/clôturables avec refus de saisie, persistance IndexedDB survivant au rechargement, exclusion des brouillons des états.

## 3. Qualité : points forts

1. **Invariants métier codés au bon endroit** (domaine) : code société 2–12 caractères, devise ISO 3, cycle exercice préparation→ouvert→clôturé, ligne débit *ou* crédit strictement positif, pièce ≥ 2 lignes et équilibrée avant validation, pièce validée immuable. Messages d'erreur en français, lisibles par un comptable.
2. **Découpage en couches respecté** et contrats d'adaptation (`IAccountingService`) permettant deux hôtes sans duplication d'écrans.
3. **Calculs de reporting isolés** (`AccountingReportBuilder`) : journal chronologique, grand livre à solde courant, balance — réutilisables et testables.
4. **Outbox SQLite idempotente** déjà en place : bonne fondation pour le hors-ligne synchronisé.
5. **Discipline de livraison** : notes de lot, critères de sortie, recettes navigateur capturées, script de build reproductible, test d'installateur sous Wine isolé (`bwrap --unshare-net`), setup NSIS propre.
6. **Design system cohérent** (variables CSS, cartes KPI, tableaux responsifs, badges d'état) : le rendu des captures est crédible face à un logiciel de gestion commercial.

## 4. Défauts et risques constatés (priorisés)

| # | Constat | Preuve | Impact |
|---|---|---|---|
| 1 | **La PWA publiée ne démarre pas en hébergement statique pur.** `index.html` publié conserve le placeholder `_framework/blazor.webassembly#[.{fingerprint}].js` ; aucun fichier de ce nom n'existe (seul `blazor.webassembly.w3qd1tpl0e.js` existe). La résolution ne fonctionne qu'au travers d'un hôte ASP.NET Core (`MapStaticAssets`) ou de `dotnet run`. | `wwwroot/index.html` du pwa.zip vs listing `_framework/` + `staticwebassets.endpoints.json` | Le livrable « publication PWA réussie » n'est vrai que derrière un hôte .NET ; S3/Pages/nginx = écran vide |
| 2 | **Règles métier dupliquées en 3 endroits** : `DemoAccountingService`, `IndexedDbAccountingService`, seed JS `perfecto-db.js` (catalogue recopié à la main). Divergences déjà visibles (libellés de lignes, contrôles). | comparaison ligne à ligne | Exactement la dérive que la stratégie « noyau partagé » voulait éviter |
| 3 | **La validation contourne l'agrégat domaine** : `PostEntryAsync` clone le DTO (`with { Status = "Validée" }`) et re-vérifie l'équilibre à la main ; l'immutabilité domaine ne protège pas les chemins PWA/Windows. | `DemoAccountingService.cs`, `IndexedDbAccountingService.cs` | L'invariant « pièce validée immuable » n'est garanti que là où l'agrégat est utilisé |
| 4 | **Statuts modélisés en chaînes françaises** (`"Validée"`/`"Brouillon"`) dans les DTO et les comparaisons ; `AccountingEntryStatus.Reversed` existe mais n'est servi par aucune fonction (pas d'extourne). | `AccountingContracts.cs`, services | Fragile, non localisable, bloque lettrage/extourne/audit |
| 5 | **IndexedDB sans index ni transaction multi-store** : `getAll()` puis filtre/tri en mémoire ; écriture pièce hors transaction ; aucune migration au-delà de v2 ; ni audit ni outbox côté navigateur. | `perfecto-db.js`, `IndexedDbAccountingService.cs` | Non tenable en volume ; synchro future sans fondation |
| 6 | **Aucune authentification, aucun cloisonnement par organisation** dans les contrats comptables (pas d'`OrganizationId`), CORS `AllowAnyOrigin` en dev. | `Program.cs` API, DTO | Le multi-utilisateur annoncé devra reprendre ces fondations |
| 7 | **Windows perd toute saisie à la fermeture** : adaptateur mémoire alors que l'infrastructure SQLite existe déjà. | `App.xaml.cs` | Démo Windows trompeuse |
| 8 | **Reporting recalculé intégralement côté client** à chaque écran (O(pièces × comptes)). | services + pages | OK démo, pas en production |
| 9 | **Aucune CI** (pas de `.github/workflows`) : « 0 avertissement, 20 tests » n'est reproductible par personne, aucune garde sur les branches. | dépôt | Régression silencieuse possible |
| 10 | **Périmètre Lot 1 incomplet vs promesse** : pas d'édition de brouillon, pas de numérotation auto, `RequiresThirdParty` affiché mais **jamais contrôlé** à la saisie, pas de tiers, pas d'export/impression. | pages + services | Écart assumé dans les notes, mais c'est le cœur de la « meilleure version » |
| 11 | Bruit de démo dans le produit : date de saisie codée `2026-02-15`, compteurs fictifs du workspace (`DraftEntries: 7`). | `NewEntry.razor`, `DemoWorkspaceService.cs` | À nettoyer avant toute vraie donnée |

## 5. Contrainte d'environnement Arena (décisive pour la suite)

Vérifications faites dans le sandbox : **aucun SDK .NET installé**, et les hôtes `nuget.org` / `dotnet.microsoft.com` / `builds.dotnet.microsoft.com` sont **inaccessibles** (réponses HTTP 000), tandis que `registry.npmjs.org`, `pypi.org` et `github.com` répondent. Aucun navigateur headless n'est disponible.

Conséquences concrètes :

- **Je ne peux ni compiler, ni tester, ni exécuter le code .NET ici.** Sur la pile actuelle, je code « à l'aveugle » : la seule validation possible serait une CI GitHub Actions (les runners Microsoft ont le SDK) ou votre machine. Aucune prévisualisation vivante du travail .NET dans Arena.
- **Sur une pile TypeScript/Node, j'ai la boucle complète ici** : build, tests unitaires (vitest), serveur de dev, prévisualisation live dans votre navigateur via le proxy Arena. Les règles métier actuelles sont indépendantes de la technologie : elles se portent 1:1, tests compris.
- Les captures d'écran de recette devront être faites par vous (ou automatisées plus tard dans une CI Playwright), quel que soit le choix de pile.

## 6. Niveau réel du projet

Le projet est à un **stade de prototype avancé et honnête** : un lot 0 (socle) et un premier incrément du lot 1 (comptabilité générale) fonctionnels en PWA, un domaine sain, une discipline de livraison rare. Il n'est **pas** encore un logiciel de gestion : ni tiers, ni exercices multiples, ni auth, ni exports, ni montée en charge, et le livrable PWA publié a un défaut de démarrage (§4.1). La base est bonne ; la valeur restante est dans la profondeur métier (lots 1→5) et la robustissement (CI, tests e2e, persistance Windows, synchro).
