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
npm test          # 110 tests vitest : domaine, noyau, états, IndexedDB, rendu PWA
npm run typecheck # tsc --noEmit, strict
npm run dev       # PWA en prévisualisation (http://localhost:5173)
```

## Architecture du noyau TypeScript

- `packages/domain` — entités et invariants (montants exacts en `bigint`, organisation,
  exercice, pièce comptable immuable après validation, tiers à fiche unique,
  numérotation par journal, audit). Aucune dépendance technique.
- `packages/contracts` — DTO échangés UI/noyau/API : statuts typés, `organizationId`
  systématique, montants sérialisés en décimal exact, libellés d'audit en français.
- `packages/application` — catalogue SYSCOHADA, états (journal, grand livre, balance,
  relevé auxiliaire par tiers), `AccountingKernel` (une seule implémentation des règles),
  port `StoragePort` (IndexedDB / SQLite / mémoire), outbox de synchronisation idempotente.
- `packages/pwa` — coquille PWA Preact : treize écrans du Lot 1 (tableau de bord, accueil
  comptable, plan, journaux et leurs séquences, tiers, pièces + saisie + révision d'un
  brouillon, balance, journal, grand livre, périodes, piste d'audit), adaptateur
  `IndexedDbStorage` du `StoragePort` avec migration automatique des bases antérieures,
  service worker hors ligne, manifeste installable.

Chaque règle portée cite son fichier C# d'origine en commentaire d'en-tête.

## Règles de gestion appliquées (tranche 2)

- **Numéro de pièce automatique** `JOURNAL-AAAA-NNNN`, séquence propre à chaque journal
  et à chaque exercice, attribué seulement quand toutes les règles sont passées : aucune
  pièce refusée ne crée de trou dans la suite.
- **Brouillon révisable, pièce validée immuable.** La révision conserve le numéro et le
  journal, horodate la modification et est tracée ; la correction d'une pièce validée
  passera par l'extourne (tranche 3).
- **Fichier unique des tiers.** Un même nom avec un même type ne peut pas exister deux
  fois ; un compte auxiliaire (`requiresThirdParty`) exige un tiers existant et actif sur
  chaque ligne, à la saisie comme à la validation. Les tiers ne se suppriment pas : ils
  se désactivent, et leur relevé auxiliaire reste consultable.
- **Piste d'audit lisible** : rang monotone, acteur, action en français, entité, détails,
  horodatage — globale ou filtrée sur une pièce.

## Prochaine tranche

Extourne, lettrage/rapprochement des comptes de tiers et pièces jointes à empreinte :
voir `docs/STRATEGIE-IMPLEMENTATION.md` §3.
