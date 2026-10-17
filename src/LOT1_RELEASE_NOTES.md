# PERFECTO Nouvelle Génération 0.2.0-preview.1

**Lot 1 — Comptabilité générale SYSCOHADA révisé**  
**Date :** 13 septembre 2026

## Contenu de la prévisualisation

Cette version introduit le premier parcours fonctionnel de comptabilité générale selon une stratégie PWA-first à composants partagés avec Windows.

La PWA comprend désormais le plan comptable, six journaux, la saisie multiligne, les brouillons, la validation des pièces équilibrées, la liste et le détail des pièces, la balance générale, le journal des écritures, le grand livre et l’ouverture ou la clôture des douze périodes de l’exercice 2026.

Les comptes, journaux, pièces et périodes sont persistés dans IndexedDB. Les données restent présentes après rechargement du navigateur. Les états excluent les brouillons et une période clôturée refuse les nouvelles pièces ainsi que la validation des brouillons concernés.

## Partage Windows

Les contrats, règles, calculs et composants Razor du Lot 1 sont communs à la PWA et à l’application Windows. L’hôte Windows est compilé avec les mêmes écrans à chaque incrément. Son adaptateur comptable utilise encore la mémoire pour cette prévisualisation ; le stockage SQLite comptable sera branché après stabilisation des parcours PWA.

## Vérifications

- compilation Release complète sans avertissement ni erreur ;
- vingt tests automatisés réussis ;
- publication PWA réussie ;
- publication Windows x64 autoportante réussie ;
- construction du setup Windows réussie ;
- installation et désinstallation silencieuses validées sous Wine isolé ;
- saisie et validation d’une pièce contrôlées dans un navigateur réel ;
- ajout d’un compte et persistance après rechargement validés ;
- balance, journal et grand livre contrôlés ;
- clôture de période et rejet d’une saisie contrôlés ;
- console navigateur sans erreur.

## Limites de cette prévisualisation

Les tiers et comptes auxiliaires, l’extourne, le lettrage, le rapprochement bancaire, les imports, les exports, les états financiers SYSCOHADA, l’audit complet, l’authentification, la synchronisation distante, la licence et les abonnements restent à développer.

Le setup n’est pas signé. Une signature Authenticode sera requise avant diffusion publique ou commerciale.
