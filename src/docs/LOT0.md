# Lot 0 — Socle technique et démonstrateur partagé

## Objectif atteint

Le Lot 0 valide qu’une même interface Razor et les mêmes contrats métier peuvent alimenter une application Windows installable et une PWA. Il démontre également la création d’une base SQLite locale, la persistance d’une file de synchronisation et l’exposition d’une API ASP.NET Core.

## Fonctions livrées

Le tableau de bord affiche l’organisation de démonstration, l’exercice 2026, le profil SYSCOHADA révisé, quatre indicateurs, les cinq modules prévus et l’activité récente. La navigation ouvre un écran de cadrage propre à chaque module. Le rendu est adaptatif pour poste de travail et écran mobile.

Le domaine vérifie les invariants fondamentaux de l’organisation, de l’exercice et de la pièce comptable. La base locale contient les tables des organisations, exercices, pièces, lignes, événements d’audit et opérations de synchronisation.

## Limites assumées

Le stockage IndexedDB de la PWA, l’authentification réelle, la synchronisation avec résolution des conflits, PostgreSQL, le chiffrement applicatif et la licence commerciale ne sont pas implémentés dans ce lot. La PWA met déjà ses ressources publiées en cache ; les données affichées restent des données de démonstration.

Le binaire Windows a été compilé et publié pour `win-x64` depuis Linux. Le setup NSIS a ensuite été installé et désinstallé silencieusement avec succès dans un préfixe Wine isolé sans réseau. La validation visuelle finale et la signature de code doivent néanmoins être effectuées sur un poste Windows disposant de WebView2. Les secrets, clés de signature et données de production ne font pas partie du dépôt.

## Critères de sortie

| Critère | Résultat |
|---|---|
| Solution complète compilable | Réussi, sans avertissement |
| Tests du domaine et de SQLite | 12 tests réussis |
| Publication PWA | Réussie |
| Publication API | Réussie |
| Publication Windows autoportante | Réussie, cible Windows x64 |
| Contrôle navigateur de la PWA | Rendu et navigation validés, console sans erreur |
| Setup Windows NSIS | Généré sans avertissement ; installation et désinstallation testées |
