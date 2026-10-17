# PERFECTO Nouvelle Génération 0.1.0 — Lot 0

**Date de livraison :** 13 septembre 2026  
**Référentiel initial :** SYSCOHADA révisé  
**Architecture :** .NET partagé, Blazor Hybrid Windows et Blazor WebAssembly PWA

## Contenu

Cette livraison établit le socle du futur logiciel de gestion. Elle fournit une application Windows x64 autoportante avec setup et désinstallation, une PWA installable, une API ASP.NET Core, une base SQLite locale et une interface Razor commune.

Le tableau de bord présente l’organisation de démonstration, l’exercice 2026, les indicateurs opérationnels, le statut de synchronisation et la feuille de route des modules : comptabilité générale, comptabilité analytique, ventes–stocks–facturation, courriers et paie.

## Garanties déjà implémentées

Le domaine contrôle le code société, la devise, la chronologie de l’exercice, le cycle préparation–ouverture–clôture, les lignes exclusivement débit ou crédit, l’équilibre obligatoire d’une pièce et son immutabilité après validation. La file SQLite garantit l’idempotence des opérations hors ligne par identifiant.

## Vérifications réalisées

| Vérification | Résultat |
|---|---|
| Compilation Release de neuf projets | Réussie, 0 avertissement, 0 erreur |
| Tests automatisés | 12 réussis sur 12 |
| Publication PWA | Réussie |
| Publication API | Réussie |
| Publication Windows x64 autoportante | Réussie |
| Construction du setup NSIS | Réussie, sans avertissement |
| Installation silencieuse isolée sous Wine | Réussie |
| Désinstallation silencieuse isolée sous Wine | Réussie |
| Tableau de bord dans navigateur réel | Validé |
| Route Comptabilité générale | Validée |
| Console navigateur | Aucune erreur |

## Limites connues

La PWA met en cache ses ressources publiées, mais le stockage IndexedDB des données comptables et la synchronisation réseau complète seront développés dans les prochains lots. L’authentification, PostgreSQL, les abonnements, les licences, les signatures de code et les règles de paie par pays ne font pas partie du Lot 0.

Le setup de prototype n’est pas signé. Une signature Authenticode est requise avant toute distribution publique ou commerciale.

## Suite recommandée

Le Lot 1 doit livrer une tranche verticale de comptabilité générale : plan de comptes SYSCOHADA, journaux, tiers, saisie équilibrée, validation, extourne, journal, grand livre, balance, périodes et exports.
