# PERFECTO Nouvelle Génération

Suite de gestion modulaire (référentiel **SYSCOHADA révisé**, devise XOF) en cours de
reconstruction en « meilleure version » : noyau métier **TypeScript** partagé entre la
PWA, le futur hôte desktop et l'API.

## État du dépôt

| Contenu | Emplacement |
|---|---|
| Analyse de l'existant et défauts constatés | `docs/ANALYSE-ETAT-DES-LIEUX.md` |
| Stratégie d'implémentation, backlog, décisions | `docs/STRATEGIE-IMPLEMENTATION.md` |
| Noyau TypeScript (domaine, contrats, application) | `packages/` |
| Code .NET 10 d'origine (référence gelée, Lot 0 + Lot 1) | `legacy/dotnet-0.2.0-preview.1/` |
| Archives et notes de livraison d'origine | racine (`*.zip`, `*.md`) |
| Index de la documentation du logiciel d'origine | `docs/specs/INDEX.md` |

## Démarrer

```bash
npm install
npm test          # 38 tests vitest : domaine, noyau, états, outbox, IndexedDB
npm run typecheck # tsc --noEmit, strict
npm run dev       # PWA en prévisualisation (http://localhost:5173)
```

## Architecture du noyau TypeScript

- `packages/domain` — entités et invariants (montants exacts en `bigint`, organisation,
  exercice, pièce comptable immuable après validation, audit). Aucune dépendance technique.
- `packages/contracts` — DTO échangés UI/noyau/API : statuts typés, `organizationId`
  systématique, montants sérialisés en décimal exact.
- `packages/application` — catalogue SYSCOHADA, états (journal, grand livre, balance),
  `AccountingKernel` (une seule implémentation des règles), port `StoragePort`
  (IndexedDB / SQLite / mémoire), outbox de synchronisation idempotente.
- `packages/pwa` — coquille PWA Preact : dix écrans du Lot 1 (tableau de bord, accueil
  comptable, plan, journaux, pièces + saisie, balance, journal, grand livre, périodes),
  adaptateur `IndexedDbStorage` du `StoragePort` (testé sous fake-indexeddb), service
  worker hors ligne, manifeste installable.

Chaque règle portée cite son fichier C# d'origine en commentaire d'en-tête.

## Prochaine tranche

Fondations robustes puis tiers/auxiliaires : voir `docs/STRATEGIE-IMPLEMENTATION.md` §3.
