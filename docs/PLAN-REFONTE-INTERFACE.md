# Plan franc — refonte de l'interface PERFECTO

**Date :** 15/10/2026 · **État :** soumis à décision, aucun code d'interface ne sera écrit avant.
**Déclencheur :** constat utilisateur — « le rendu ne ressemble en rien au logiciel en lui-même ».

---

## 1. Diagnostic, sans arrangement

### 1.1 Le constat est juste

Le logiciel d'origine, tel que documenté dans `docs/specs/SPEC-ORIGINAL-PERFECTO.md` :

| Trait de PERFECTO 25.0429 (WinDev 5.5) | Ce que j'ai livré |
|---|---|
| Fenêtre titrée `CR000-26: Comptabilité générale SOCIETE TEST [01/01/2026-31/12/2026]` | Une barre latérale « PERFECTO Nouvelle Génération » sans dossier, sans société, sans période visibles |
| Barre de menus : **Fichier · Définitions · Saisies · Éditions · Paramètres · Outils** | Une navigation inventée (`/comptabilite/…`), groupes « Pilotage / Comptabilité / Éditions / Paramètres » |
| Grilles denses : Date, Pièce, Compte, Référence, Débit, Crédit, Libellé + détail de ligne (tiers, échéance, devise, immobilisation, commande, axes) | Tableaux aérés, cartes arrondies, badges, puces décoratives |
| Fiches à onglets (Définition, Adresse, Contact, IFU) | Formulaires empilés en une colonne |
| Raccourcis clavier outillés (`Sociétés… <F2>`, impression `<F11>`, calculatrice `<F12>`) | Aucun raccourci |
| Ouverture intégrateur → société → dossier → module (14 variantes) | Accès direct à un jeu de démonstration à identifiant figé |
| Barre d'état, vocabulaire métier, densité Windows | « Tableau de bord » avec KPI, `eyebrow`, héros de page : un vocabulaire de site vitrine |

Je n'ai pas reproduit le logiciel : j'ai reproduit **le style de la tentative précédente** (la PWA
.NET de Manus, dont les captures sont dans `legacy/dotnet-0.2.0-preview.1/docs/assets/`), puis je
l'ai encore éloigné vers un esthétique SaaS générique.

### 1.2 Ma responsabilité, précisément

1. **Je n'ai jamais écrit de spécification visuelle.** `docs/specs/` contient des règles métier,
   des entités, des menus — pas un écran décrit : ni titre de fenêtre, ni barre d'état, ni hauteur
   de ligne, ni palette, ni raccourcis. Faute de référence, j'ai inventé un style.
2. **Je n'ai jamais fait valider le rendu.** Quatre tranches livrées sans une seule maquette soumise
   avant d'écrire quinze écrans. Le premier retour visuel arrive maintenant : c'est tard, et c'est
   un défaut de méthode, pas un accident.
3. **J'ai optimisé ce qui se mesure facilement** (types stricts, 255 tests, exactitude décimale,
   exports) au détriment de ce qui décide de l'adhésion : la reconnaissance immédiate de son
   logiciel par celui qui l'utilise tous les jours.

### 1.3 Ce qui est solide et ne doit pas être jeté

L'interface est la seule couche qui ait été inventée. Tout ce qui suit est **agnostique de
l'écran** — aucun de ces paquets n'importe un composant, une route ou une couleur :

- `packages/domain` : montants décimaux exacts en XOF (jamais de flottant), règles SYSCOHADA
  révisé, immutabilité d'une pièce validée, extourne, verrou de période, fiche tiers unique,
  lettrage, empreintes SHA-256, identité de la société imprimée.
- `packages/application` : noyau unique (lecture/écriture sérialisées, audit ajout-seulement
  attribué et horodaté), huit éditions construites en modèle neutre.
- `packages/exports` : moteurs CSV, Excel, PDF partageant le même document — le critère que tu as
  posé (« tous les documents en Excel, CSV et PDF, l'utilisateur choisit ») est **déjà tenu et
  testé**, y compris depuis l'écran.
- 255 tests automatisés, typecheck strict, déploiement Vercel, fonctionnement hors ligne.

### 1.4 Ce qui est faible dans le noyau aussi (pour être complet)

Repartir de zéro ne règlerait pas ces manques, qui sont fonctionnels et non visuels :

- Plan comptable **plat** (18 comptes) alors que l'original est **hiérarchique**, avec fusion,
  comptes collectifs, devise, imputations analytiques.
- Lignes d'écriture sans échéance, sans devise, sans axes analytiques.
- Ni lettrage automatique, ni rapprochement bancaire avec pointage.
- Ni multi-exercices, ni à-nouveaux, ni clôture annuelle, ni états financiers OHADA révisé.
- Une seule organisation, identifiant de démonstration figé ; pas de modèle société/dossier, pas de
  catalogue de profils (les 14 variantes), pas d'authentification ni de rôles, pas de sauvegarde/
  restauration, pas de synchronisation.

Autrement dit : l'interface est à refondre, le noyau est à **poursuivre**. Estimation franche de la
couverture fonctionnelle du logiciel d'origine à ce jour : de l'ordre de 30 à 40 %.

---

## 2. Ce que je propose

### 2.1 Invariant non négociable

Règle déjà écrite au cadrage v2 et respectée jusqu'ici : **les règles comptables ne sont jamais
recodées par canal**. La refonte porte donc sur `packages/pwa` (coquille, écrans, styles) et sur
l'architecture de l'information, pas sur le noyau. Un écran n'affiche que ce que le noyau garantit.

### 2.2 Méthode pour ne plus deviner le rendu

1. **Étalon documentaire.** Je relis les captures d'origine sur ton Drive (intégrateur, sélection de
   module, sociétés, menus Saisies et Éditions, grille de saisie, plan comptable, ouverture de
   dossier) et j'écris `docs/specs/SPEC-UI-ORIGINAL.md` : par écran, le titre de fenêtre, les menus
   et leurs entrées réelles, les boutons avec leurs libellés et leurs raccourcis, les colonnes de
   grille dans l'ordre avec alignement et largeur relative, les onglets, la barre d'état, les
   messages exacts. Chaque item numéroté `R-UI-n` avec la capture source.
2. **Jetons de design.** Un seul fichier de thème : palette relevée sur les captures, échelle de
   pas de 4 px, hauteur de ligne de grille, typographie, bordures, états survol/focus/actif,
   contrastes vérifiés. Plus aucune couleur décidée dans un écran.
3. **Maquette validée avant code.** Je reconstruis **un** écran — la grille de saisie journal, cœur
   du logiciel — sur l'aperçu en direct. Tu regardes, tu dis oui / non / ajuste. Rien d'autre n'est
   écrit avant cet accord.
4. **Comparaison systématique.** Pour chaque écran ensuite, la capture d'origine à côté du rendu
   neuf dans un document de revue, et une validation avant de passer au suivant.

### 2.3 Périmètre de la refonte

| Conservé | Reconstruit |
|---|---|
| `packages/domain`, `contracts`, `application`, `exports` + leurs tests | `packages/pwa/src/layout.tsx` (coquille, barre de menus, barre d'état) |
| Adaptateurs de stockage IndexedDB (course d'amorçage corrigée) | `packages/pwa/src/ui.tsx` (composants visuels) |
| Moteur d'export et barre de choix du format (logique) | `packages/pwa/src/pages/*` (tous les écrans) |
| Déploiement Vercel, service worker, routage | `packages/pwa/src/styles/*` (les deux feuilles) |
| Jeu de démonstration et noyau de tests PWA | Architecture de l'information : arborescence de menus fidèle, contexte société/dossier/exercice permanent |

### 2.4 Séquencement proposé (l'ordre reste à ta main)

- **Tranche 5 — Étalon.** `SPEC-UI-ORIGINAL.md` + jetons de design + grille de saisie journal
  reconstruite et **validée par toi** sur l'aperçu.
- **Tranche 6 — Coquille.** Fenêtre titrée du dossier, barre de menus complète (Fichier,
  Définitions, Saisies, Éditions, Paramètres, Outils) avec les entrées réelles, barre d'état
  (dossier, société, période, utilisateur, mode de stockage, état hors ligne), raccourcis clavier,
  écran d'ouverture société → dossier → exercice.
- **Tranche 7 — Saisies et définitions.** Plan comptable hiérarchique, journaux, tiers, saisie avec
  détail de ligne complet, lettrage et pointage.
- **Tranche 8 — Éditions.** Le menu Éditions tel que l'original le présente (journaux, comptes
  généraux, tiers, lettrage, rapprochements bancaires, tableaux financiers OHADA révisé), chaque
  état dans les trois formats déjà livrés.
- **Tranche 9 et suivantes.** Clôture, à-nouveaux, multi-exercices, rapprochement bancaire, états
  financiers SYSCOHADA, sauvegarde/restauration testable, authentification et rôles,
  synchronisation ; puis la consolidation (accessibilité clavier et contrastes, performance des
  listes paginées et indexées, durcissement des écrans).

---

## 3. Décisions à trancher avant que je touche au code

1. **Référence visuelle exacte** : les captures du PERFECTO d'origine, l'ergonomie d'un logiciel
   comptable professionnel que tu me nommes, ou une structure fidèle avec une exécution moderne ?
2. **Périmètre du redémarrage** : noyau conservé et interface refaite, ou tout depuis zéro ?
3. **Premier écran étalon** : saisie journal, plan comptable, ouverture société/dossier, éditions ?
4. **Densité et cible matérielle** : poste de travail dense (clavier + souris), équilibré, ou
   d'abord lisible sur tablette et téléphone ?

Aucune de ces réponses ne m'est acquise : je les attends avant d'écrire la moindre ligne
d'interface.
