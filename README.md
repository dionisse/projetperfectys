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
npm test          # 153 tests vitest : domaine, noyau, états, lettrage, justificatifs, IndexedDB, rendu PWA
npm run typecheck # tsc --noEmit, strict
npm run dev       # PWA en prévisualisation (http://localhost:5173)
```

## Architecture du noyau TypeScript

- `packages/domain` — entités et invariants (montants exacts en `bigint`, organisation,
  exercice, pièce comptable immuable après validation et contre-passable, tiers à fiche
  unique, numérotation par journal, lettrage équilibré, justificatif à empreinte
  contrôlée, audit). Aucune dépendance technique.
- `packages/contracts` — DTO échangés UI/noyau/API : statuts typés, `organizationId`
  systématique, montants sérialisés en décimal exact, libellés d'audit en français.
- `packages/application` — catalogue SYSCOHADA, états (journal, grand livre, balance,
  relevé auxiliaire par tiers lettré), `AccountingKernel` (une seule implémentation des
  règles : extourne, lettrage, justificatifs), ports `StoragePort` (IndexedDB / SQLite /
  mémoire) et `AttachmentBytesPort` (octets des justificatifs, hors de l'état comptable),
  outbox de synchronisation idempotente.
- `packages/pwa` — coquille PWA Preact : treize écrans du Lot 1 (tableau de bord, accueil
  comptable, plan, journaux et leurs séquences, tiers + relevé lettrable, pièces + saisie
  + révision d'un brouillon + extourne + justificatifs, balance, journal, grand livre,
  périodes, piste d'audit), adaptateurs `IndexedDbStorage` (`state`) et
  `IndexedDbFileStorage` (`files`) avec migration automatique des bases antérieures
  (v1 → v2), service worker hors ligne, manifeste installable.

Chaque règle portée cite son fichier C# d'origine en commentaire d'en-tête.

## Règles de gestion appliquées (tranches 2 et 3)

- **Numéro de pièce automatique** `JOURNAL-AAAA-NNNN`, séquence propre à chaque journal
  et à chaque exercice, attribué seulement quand toutes les règles sont passées : aucune
  pièce refusée ne crée de trou dans la suite.
- **Brouillon révisable, pièce validée immuable.** La révision conserve le numéro et le
  journal, horodate la modification et est tracée ; la correction d'une pièce validée
  passe par l'extourne.
- **Fichier unique des tiers.** Un même nom avec un même type ne peut pas exister deux
  fois ; un compte auxiliaire (`requiresThirdParty`) exige un tiers existant et actif sur
  chaque ligne, à la saisie comme à la validation. Les tiers ne se suppriment pas : ils
  se désactivent, et leur relevé auxiliaire reste consultable.
- **Extourne d'une pièce validée.** La contre-passation est générée par le noyau : mêmes
  comptes, mêmes tiers, débits et crédits permutés, même journal avec le numéro suivant,
  référence `EXT-<référence d'origine>` (suffixée si elle est prise), validation
  immédiate, période de la date d'extourne obligatoirement ouverte. Les deux pièces
  restent dans les livres — leur somme est nulle — et se citent mutuellement
  (`reversedByNumber` / `reversalOfNumber`). Un tiers désactivé depuis ne bloque pas la
  correction d'une écriture passée.
- **Lettrage des comptes de tiers.** Sélection de mouvements non lettrés d'un même tiers,
  contrôle d'équilibre strict (débit = crédit, au moins deux mouvements, montant non nul),
  lettres A, B, … Z, AA attribuées par tiers, délettrage possible et tracé. Le solde non
  lettré (« reste à rapprocher ou à relancer ») est affiché sur le relevé auxiliaire.
- **Justificatifs à empreinte contrôlée.** Chaque fichier rattaché à une pièce est haché
  en SHA-256 : doublon refusé, type MIME hors whitelist refusé, taille déclarée vérifiée
  contre le contenu, 15 Mo maximum. Les octets vivent dans le magasin IndexedDB `files`,
  jamais dans l'état comptable sérialisable ; le détachement supprime les deux.
- **Piste d'audit lisible** : rang monotone, acteur, action en français, entité, détails,
  horodatage — globale ou filtrée sur une pièce. Contre-passation, extourne, lettrage,
  délettrage, rattachement et détachement de justificatif y sont tracés.

## Prochaine tranche

Sorties imprimables : exports PDF/Excel/CSV du journal, du grand livre, de la balance et
d'une pièce (dernier maillon du critère d'acceptation du cadrage), puis états financiers
SYSCOHADA (bilan, compte de résultat). Voir `docs/STRATEGIE-IMPLEMENTATION.md` §3.
