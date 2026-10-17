# PERFECTO Nouvelle Génération

Prototype de suite de gestion modulaire reposant sur un **socle .NET partagé** entre une application Windows WPF/Blazor Hybrid et une PWA Blazor WebAssembly. Le premier référentiel est le **SYSCOHADA révisé**.

## État du Lot 1

Le socle du Lot 0 est complété par un premier parcours de **comptabilité générale SYSCOHADA révisé**. La PWA fournit un plan comptable, les journaux, la saisie et la validation des pièces, la balance, le journal des écritures, le grand livre et le contrôle des périodes. Les données PWA sont persistées dans IndexedDB et restent disponibles après rechargement.

Le développement est **PWA-first**, mais il ne s'agit pas d'une application jetable à réécrire ensuite : le domaine, les contrats, les calculs et les composants Razor sont partagés avec l'hôte Windows. Celui-ci reste compilé à chaque incrément.

| Projet | Rôle |
|---|---|
| `Perfecto.Domain` | Entités et invariants indépendants de toute technologie |
| `Perfecto.Application` | Contrats de cas d’usage, stockage et synchronisation |
| `Perfecto.Contracts` | Modèles échangés entre interfaces et API |
| `Perfecto.Infrastructure` | SQLite, Entity Framework Core, audit et outbox |
| `Perfecto.Shared.UI` | Navigation, thème et composants Razor communs |
| `Perfecto.Pwa` | Client PWA installable et cache hors ligne |
| `Perfecto.Windows` | Hôte WPF avec BlazorWebView et SQLite local |
| `Perfecto.Api` | API ASP.NET Core destinée à la synchronisation et au multi-utilisateur |
| `Perfecto.Domain.Tests` | Tests métier et de persistance |

## Prérequis

Le développement utilise le SDK **.NET 10.0.401** défini dans `global.json`. La construction de l’hôte WPF depuis Linux est permise par `EnableWindowsTargeting`; son exécution exige Windows x64 et le runtime Microsoft Edge WebView2 présent sur les versions Windows récentes.

## Démarrage local

```bash
export PATH="$HOME/.dotnet:$PATH"
dotnet restore Perfecto.Next.slnx
dotnet build Perfecto.Next.slnx -c Release
dotnet test tests/Perfecto.Domain.Tests/Perfecto.Domain.Tests.csproj -c Release
```

Pour lancer la PWA en développement :

```bash
dotnet run --project src/Perfecto.Pwa/Perfecto.Pwa.csproj --urls http://localhost:5173
```

Pour lancer l’API :

```bash
ASPNETCORE_ENVIRONMENT=Development \
  dotnet run --project src/Perfecto.Api/Perfecto.Api.csproj --urls http://localhost:5100
```

Les endpoints initiaux sont `GET /api/health`, `GET /api/workspace` et `GET /api/sync/pending`.

## Construction des livrables

Le script suivant compile, teste et publie les trois hôtes :

```bash
./scripts/build-release.sh
```

Les résultats sont placés dans `artifacts/` :

- `pwa/` contient la publication statique de la PWA ;
- `api/` contient l’API ;
- `windows-win-x64/` contient l’application Windows autoportante ;
- `installer/` contient le setup Windows NSIS auto-extractible.

Le setup n’est pas signé dans ce prototype. Une signature Authenticode sera nécessaire avant diffusion commerciale afin d’éviter les avertissements SmartScreen et de garantir l’origine du binaire.

## Garanties métier déjà codées

Une organisation exige un code normalisé et une devise ISO sur trois caractères. Un exercice suit le cycle préparation, ouvert, clôturé. Une ligne comptable porte exclusivement un débit ou un crédit positif. Une pièce ne peut être validée que si elle contient au moins deux lignes et si le total des débits égale le total des crédits. Une pièce validée devient immuable.

La file SQLite rejette les doublons par identifiant d’opération et conserve les commandes en attente jusqu’à leur acquittement. Ce mécanisme sert de base au futur mode hors ligne synchronisé.

## Suite du Lot 1

Les prochains incréments ajouteront les tiers, les auxiliaires, la numérotation automatique, l'extourne, le lettrage, le rapprochement bancaire, les pièces jointes, les imports, les exports et les états financiers SYSCOHADA. Le stockage comptable Windows migrera du service mémoire vers SQLite après stabilisation des parcours PWA.

Le détail du périmètre et de la stratégie est disponible dans `docs/LOT1.md`.
