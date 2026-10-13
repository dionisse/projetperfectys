# Stratégie d'implémentation — comment je reprends le projet

**Date :** 13 octobre 2026 · Complément de `docs/ANALYSE-ETAT-DES-LIEUX.md`.
Ce document décrit ma méthode de travail, les options de pile technique soumises à décision, et le backlog des prochaines tranches. Rien n'est engagé avant votre arbitrage (§2).

---

## 1. Méthode de travail (valable quelle que soit la pile)

1. **Tranches verticales courtes.** Chaque incrément livre une fonction complète : règle métier + test automatisé + écran + mise à jour de la doc de lot. Jamais de « couche » isolée sans parcours utilisateur visible.
2. **Le domaine reste la source de vérité.** Toute règle (équilibre, immutabilité, période clôturée, numéro unique) vit dans une seule implémentation, testée unitairement ; les adaptateurs de stockage (IndexedDB, SQLite, API) ne contiennent **que** de la persistance, jamais de la règle. Cela corrige les duplications constatées (§4.2 et §4.3 de l'analyse).
3. **Définition de fini explicite par incrément** : tests verts, parcours vérifié dans la prévisualisation, messages métier en français, doc + notes de release mises à jour, aucune régression sur les parcours existants.
4. **Traçabilité** : chaque incrément = un commit/PR sur la branche de session, avec référence au lot concerné ; les décisions d'architecture sont écrites dans `docs/` (jamais seulement en conversation).
5. **Comptabilité d'abord, toujours SYSCOHADA révisé / XOF** : les montants restent des décimaux exacts (pas de flottants), affichage sans décimales pour XOF mais stockage à 2 décimales, politique unique définie une fois.
6. **Rien de cassé en route** : les parcours validés du Lot 1 (saisie, validation, balance, journal, grand livre, périodes) sont couverts par des tests de non-régression avant d'ajouter quoi que ce soit.

## 2. Décision à prendre : pile technique

### Option A — Poursuivre en .NET 10 / Blazor (continuité totale)
- **Garde** : WPF + BlazorWebView, setup NSIS, code existant, compétences déjà investies.
- **Perd** : aucune compilation/test/exécution possible dans ce sandbox (voir analyse §5). Je code, une CI GitHub Actions compile et teste à chaque push, vous regardez les checks et une éventuelle publication GitHub Pages. Boucle lente (minutes par essai), débogage UI impossible pour moi, prévisualisation Arena indisponible.
- **À faire immédiatement dans cette option** : corriger le défaut de publication PWA (analyse §4.1), ajouter la CI, brancher SQLite côté Windows.

### Option B — Portage TypeScript full-stack (ma recommandation)
- Monorepo `packages/` miroir de l'architecture actuelle : `domain`, `contracts`, `application`, `infrastructure`, `ui`, `pwa`, `api`. Règles métier portées 1:1 depuis `Perfecto.Domain`/`Application` avec leurs 20 tests repris et étendus (vitest). PWA Vite + service worker + IndexedDB (index et transactions cette fois). API Node + SQLite. Hôte Windows plus tard via Tauri ou Electron **en réutilisant exactement la même application web** (même promesse de noyau partagé, sans WPF).
- **Gagne** : boucle complète ici (build, tests, prévisualisation live dans votre navigateur à chaque incrément), coût d'itération quasi nul, écosystème web pour exports PDF/Excel, tableaux denses, offline.
- **Perd** : le code C# existant devient référence gelée (conservé dans `legacy/`), le setup Windows NSIS/WPF est remplacé par un installeur Tauri/Electron à recréer.
- Le volume à porter est faible (~2 500 lignes d'application) et je peux produire un équivalent fonctionnel du Lot 1, testé et prévisualisable, en quelques tranches.

### Option C — Hybride (TS pour le web maintenant, .NET gardé pour Windows plus tard)
- Deux bases de code pour les règles métier = le risque de divergence que vos propres notes écartent. Je ne la recommande que si l'hôte WPF/NSIS est une exigence commerciale à court terme.

**Ma recommandation : B**, avec `legacy/` conservé et une passerelle documentaire (chaque règle portée cite son fichier C# d'origine). Si le binaire Windows signé/NSIS est un engagement client ferme pour 2026, alors **A** et je m'organise autour de la CI.

## 3. Backlog proposé (Lot 1 → au-delà), tranches verticales

**Tranche 1 — Fondations robustes** : statuts en enum typés, `OrganizationId` partout, édition contrôlée des brouillons, numérotation automatique par journal et exercice, audit horodaté de chaque mutation, CI (build + tests) sur chaque push.
**Tranche 2 — Tiers et auxiliaires** : entité Tiers (clients/fournisseurs), comptes auxiliaires rattachés, **contrôle effectif** de `RequiresThirdParty` à la saisie, saisie assistée (recherche tiers), soldes par tiers.
**Tranche 3 — Corrections et contre-passations** : extourne automatique d'une pièce validée (usage de `Reversed`), lettrage manuel puis automatique des comptes de tiers, rapprochement bancaire avec pointage.
**Tranche 4 — Sorties imprimables** : exports PDF et Excel (balance, journal, grand livre, piece), mise en page d'impression, états financiers SYSCOHADA (bilan, compte de résultat) à partir du plan de comptes.
**Tranche 5 — Exercices et clôtures réelles** : multi-exercices, à-nouveaux, clôture annuelle avec génération des reports, journal d'ouverture.
**Tranche 6 — Compte multi-utilisateur** : authentification, rôles (saisie / validation / administration), API + synchro hors-ligne basée sur l'outbox existant, politique de conflits écrite avant codage.
**Transverses** : montée en charge (requêtes paginées/indexées au lieu de `getAll`), attachments, imports CSV bancaires, i18n des libellés techniques.

Les lots 2→5 du produit (analytique, ventes-stocks, courriers, paie) ne démarrent qu'après stabilisation du Lot 1, conformément à vos notes.

## 4. Vos 333 Mo de documentation : comment me les transmettre

GitHub **peut** les héberger : la limite est **100 Mo par fichier**, pas par dépôt ; 333 Mo répartis en fichiers < 100 Mo passent sans problème (push éventuellement lent, c'est tout). Procédure recommandée :

1. Créer une branche `docs/references` (ou un dossier `references/` sur la branche de session) et y pousser les fichiers originaux (PDF, DOCX, XLSX, images).
2. Je les analyse localement : extraction de texte PDF/DOCX/XLSX outillée ici (PyPI accessible), puis je produis un `docs/SPEC-SYNTHESE.md` indexé par module (règles de gestion, champs, écrans, calculs, références réglementaires).
3. Seule limite : les **scans sans couche texte** nécessitent de l'OCR que je ne peux pas installer ici — pour ceux-là, soit une version PDF textuelle, soit un envoi des extraits utiles en conversation.
4. À défaut de push : m'envoyer progressivement en conversation les chapitres decisifs (manuel du logiciel d'origine, plan comptable complet, règles de paie par pays) ; je les structure au fil de l'eau dans `docs/specs/`.

Dans tous les cas, je tiens à jour un registre `docs/specs/INDEX.md` (source → module → règles extraites → statut d'implémentation) pour que chaque règle du logiciel d'origine soit traçable jusqu'au code qui l'applique.

## 5. Prochain geste technique après arbitrage

- Si **B** : squelette du monorepo + portage du domaine + les 20 tests repris + prévisualisation live du parcours existant (équivalent fonctionnel du Lot 1) en première tranche, avant toute nouvelle fonction.
- Si **A** : PR de correction du publish PWA + workflow CI (build Release, tests, publication PWA en artifact Pages) + branchement SQLite de l'hôte Windows, puis Tranche 1 du backlog.

---

## 6. Décisions actées et avancement (mise à jour du 13/10/2026)

**Arbitrages reçus :** pile **TypeScript (option B)** ; priorité de la première tranche
laissée au jugement de l'agent → **fondations + cœur du Lot 1** ; documentation du
logiciel d'origine transmise par **extraits progressifs en conversation**
(registre : `docs/specs/INDEX.md`).

**Tranche 0 livrée ce jour (`packages/`) :**

- monorepo npm workspaces + `vitest` + `tsc --noEmit` strict : **35 tests verts** ;
- `@perfecto/domain` : montants exacts en `bigint` (arrondi au plus pair identique à
  `MidpointRounding.ToEven`), dates civiles typées, organisation, exercice, pièce
  comptable avec extourne préparée (`markReversed`), audit ;
- `@perfecto/contracts` : statuts typés (`draft/posted/reversed` + libellés français),
  `organizationId` sur tous les agrégats, montants DTO en décimal exact ;
- `@perfecto/application` : catalogue SYSCOHADA en source unique, états (journal, grand
  livre, balance), `AccountingKernel` où la validation repasse **toujours** par
  l'agrégat domaine (correction du défaut n°3), port `StoragePort` + adaptateur mémoire,
  outbox idempotente, jeu de démonstration unique (`createDemoState`) ;
- les 20 tests C# d'origine sont repris et étendus (audit, cloisonnement par
  organisation, immutabilité à la validation, libellés de statuts) ;
- code .NET d'origine décompressé et gelé dans `legacy/dotnet-0.2.0-preview.1/`.

**Tranche 1 livrée le 13/10/2026 :** adaptateur `IndexedDbStorage` du `StoragePort`
(base `perfecto-next`, amorçage automatique du jeu de démonstration, montants sérialisés
en décimal exact, testé sous `fake-indexeddb`) et coquille PWA Preact complète :
tableau de bord, accueil comptable, plan comptable (recherche + création), journaux,
pièces (filtres, détail, validation d'un brouillon), saisie multiligne avec contrôle
d'équilibre bloquant, balance, journal des écritures, grand livre à solde progressif et
périodes ouvrables/clôturables. Le tout servi en prévisualisation live (`npm run dev`),
hors ligne prêt via service worker. 38 tests verts, typecheck strict OK.

**Tranche 2 livrée le 13/10/2026 :** trois exigences P0 du cadrage sont désormais
appliquées par le noyau, pas seulement affichées.

1. **Numérotation automatique par journal et exercice** (`JOURNAL-AAAA-NNNN`). La
   séquence est tenue dans l'état (`entrySequences`) et le numéro n'est attribué qu'une
   fois toutes les règles passées : une pièce refusée ne consomme aucun numéro, la suite
   reste continue et sans trou (exigence de piste d'audit OHADA). L'écran annonce le
   numéro avant enregistrement (`peekEntryNumber`, lecture seule) et l'écran des journaux
   affiche le dernier numéro et le prochain de chaque journal.
2. **Édition contrôlée des brouillons.** `updateEntry` révise date, référence, libellé et
   lignes d'un brouillon en repassant par l'agrégat domaine : une pièce validée est
   refusée (« Utilisez une extourne pour la corriger »), le numéro et le journal sont
   conservés, `updatedAt` est horodaté, chaque révision est tracée. La piste d'audit est
   exposée à l'écran : page dédiée `#/comptabilite/audit` (filtres par entité) et
   chronologie dans le détail de chaque pièce. Un rang monotone (`sequence`) garantit
   l'ordre même quand deux événements tombent dans la même milliseconde.
3. **Tiers à fiche unique.** Entité `ThirdParty` typée (client, fournisseur, salarié,
   État, autre), code proposé par type (`FOU003`), unicité par code ET par
   nom + type replié (accents, casse, ponctuation) : un même tiers ne peut pas être
   créé deux fois, quel que soit le module. Le contrôle `requiresThirdParty` est
   effectif à la saisie, à la révision et à la validation : compte auxiliaire sans
   tiers = refus, tiers inconnu ou désactivé = refus, message français précisant la
   ligne en cause. Aucun tiers n'est supprimable (désactivation seulement), le type est
   verrouillé dès qu'une ligne validée l'utilise, et un relevé auxiliaire (mouvements
   validés + solde progressif) alimente la fiche tiers.

La PWA compte treize routes (tiers, piste d'audit et révision de brouillon ajoutées), le
formulaire de saisie est partagé entre création et révision, et **la migration d'une base
locale écrite par la tranche 1 est automatique** : à la lecture, les numéros manquants
sont attribués chronologiquement par la règle du domaine et les séquences reconstruites,
sans reset utilisateur. 110 tests verts (dont 17 tests de rendu réel de l'app sous jsdom,
toutes routes), typecheck strict OK, build de production OK.

**Prochaine tranche (3) :** extourne d'une pièce validée (contre-passation automatique
avec lien pièce d'origine ↔ pièce d'extourne), lettrage/rapprochement des comptes de
tiers, puis pièces jointes avec empreinte (P0 du cadrage : justificatif rattaché à la
facture fournisseur du critère d'acceptation).

**Mise à jour du 13/10/2026 (documentation d'origine) :** le dossier Google Drive
« Créer un Prototype de Logiciel de Comptabilité Windows » a été intégralement lu via le
connecteur Drive (100+ fichiers : binaires WinDev de l'original, archive `PERFECTO.WDZ`,
14 notes d'exploration, captures, et les deux documents maîtres de cadrage). La synthèse
fonctionnelle est dans `docs/specs/SPEC-ORIGINAL-PERFECTO.md` et le registre des sources
dans `docs/specs/INDEX.md`. Conséquences directes sur le backlog :

- les entités et parcours P0 du cadrage (tiers à fiche unique, pièces jointes avec
  empreinte, verrou de période indépendant, numérotation par journal) deviennent les
  tranches 2 et 3 ;
- les règles produit R-ORG-1 à R-ORG-4 (pas de dépendance imprimante, base unique,
  navigation moderne, pas de mécanismes obsolètes) sont des critères de sortie
  transverses ;
- le critère d'acceptation du prototype (parcours facture fournisseur → PDF) est adopté
  comme définition de fini du Lot 1.
