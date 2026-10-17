# Lot 1 — Comptabilité générale SYSCOHADA révisé

## Stratégie de réalisation retenue

Le développement suit une stratégie **PWA-first avec noyau partagé**. Les parcours utilisateur sont conçus, testés et validés en priorité dans le navigateur, car cette boucle est plus rapide et permet de tester immédiatement le stockage hors ligne. Les règles métier, contrats, calculs et composants Razor restent néanmoins communs aux hôtes PWA et Windows. L'application Windows est compilée à chaque incrément afin d'éviter une reconstruction tardive et coûteuse.

| Approche | Avantages | Limites | Décision |
|---|---|---|---|
| PWA totalement séparée, puis réécriture Windows | Départ très rapide | Duplication des écrans et des règles, risque de divergence | Écartée |
| Windows et PWA développés en parallèle indépendamment | Contrôle simultané des deux plateformes | Vitesse réduite et maintenance doublée | Écartée |
| PWA-first avec composants et domaine partagés | Validation rapide, une seule interface, règles communes, Windows continuellement compilable | Adaptateurs de stockage distincts par plateforme | **Retenue** |

## Premier incrément livré

Le module Comptabilité générale remplace l'écran d'attente du Lot 0. Il comprend un accueil opérationnel, un plan comptable de départ, six journaux, la saisie des pièces, les brouillons, la validation, la balance, le journal des écritures, le grand livre et les douze périodes de l'exercice.

La PWA utilise IndexedDB avec une migration versionnée. Les comptes, journaux, pièces et périodes persistent après rechargement. Le service partagé applique les règles suivantes : référence unique, compte existant, débit ou crédit exclusif par ligne, équilibre obligatoire avant validation, exclusion des brouillons des états et refus de saisie sur une période clôturée.

L'hôte Windows réutilise exactement les mêmes composants Razor, contrats, calculs et règles métier. Dans ce premier incrément, son adaptateur comptable est en mémoire pour accélérer la validation de l'interface ; son branchement sur SQLite sera réalisé après stabilisation fonctionnelle de la PWA.

## Fonctions couvertes

| Domaine | État |
|---|---|
| Accueil de la comptabilité | Fonctionnel |
| Plan comptable initial et ajout de comptes | Fonctionnel |
| Journaux comptables | Fonctionnel |
| Saisie multiligne débit/crédit | Fonctionnel |
| Brouillon et validation | Fonctionnel |
| Pièces validées immuables | Contrôle de domaine fonctionnel |
| Balance générale | Fonctionnelle |
| Journal des écritures | Fonctionnel |
| Grand livre par compte | Fonctionnel |
| Ouverture et clôture mensuelles | Fonctionnelles |
| Persistance hors ligne PWA | IndexedDB fonctionnel |
| Adaptateur Windows | Composants partagés compilés ; SQLite comptable à réaliser |

## Prochains incréments du Lot 1

La suite doit ajouter les tiers et comptes auxiliaires, les numéros automatiques par journal, la modification contrôlée des brouillons, l'extourne des pièces validées, le lettrage, le rapprochement bancaire, les pièces jointes, les imports, les exports PDF/Excel, les états financiers SYSCOHADA, l'audit complet et la synchronisation multi-utilisateur.

La synchronisation cloud ne sera activée qu'après définition des bases en ligne et hors ligne, de la politique de conflits et des règles d'abonnement.
