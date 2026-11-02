# Étape 15 — Registres RH et de paie

**Statut :** une vue locale en lecture seule, limitée aux sources synthétiques du dossier RH actif et filtrable, est ajoutée au dossier ; menus définitifs, colonnes sensibles, permissions fines, exports et conservation restent à valider.
**Dépendances :** étapes 3 à 14 ; les données des modules sources et les règles de permission doivent être définies. La validation des menus de l’étape 2 reste reportée.

La vue ne stocke pas de copie ni de modification et réinitialise ses filtres lors d’un changement de dossier. Elle n’expose que les enregistrements de test disponibles; contrats complets, bulletins, paiements et transferts réels ne sont pas fournis par le prototype. Aucun nouveau menu n’est créé.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et périmètre

Fournir des registres consultables et filtrables qui permettent de retrouver les données RH et de paie sans créer une copie concurrente des registres métier. Les listes prévues couvrent : employés, contrats, affectations, missions, congés et absences, variables, lots, bulletins, paiements et transferts comptables.

Chaque écran reste rattaché au dossier RH actif et applique les droits du rôle courant. La navigation et les noms des menus restent à confirmer dans le cadrage de l’étape 2 ; cette fiche décrit le contenu et les comportements des registres, pas leur emplacement définitif.

## 2. Principe de consultation et source de référence

Chaque registre affiche les enregistrements détenus par leur parcours métier source, par identifiant stable. Les listes et fiches de consultation sont en lecture seule, sauf action qui ouvre explicitement le parcours autorisé de création, correction, approbation ou annulation.

Ne pas dupliquer une donnée saisie uniquement pour la montrer dans plusieurs registres. Une vue peut assembler des références à des sources, mais conserve leur provenance et ne remplace pas les valeurs source. Les actions depuis une ligne doivent viser son `employeeId`, `dossierId`, identifiant de document/ligne, période et statut exacts.

Une ligne agrégée doit rester identifiée comme agrégée. Elle ne peut pas faire croire qu’elle correspond à une pièce, un employé ou une transaction unique si ses sources couvrent plusieurs éléments. Les associations vers les lots, bulletins, paiements ou transferts utilisent des identifiants stables explicites.

## 3. Colonnes et filtres

Les colonnes varient par registre et par permissions. Champs de repérage communs proposés : référence stable, dossier RH, employé ou entité liée, période/date, catégorie/type, statut, auteur ou source lorsque utile, dernière mise à jour et accès au détail autorisé.

Filtres à préciser par registre : période, statut, employé, unité, catégorie, type d’événement, règle/version, état de validation et présence d’une source ou d’une pièce. Les filtres ne changent pas les données et les résultats affichent les critères appliqués. Une recherche sur des champs sensibles ne sera autorisée que si le rôle a accès à ces champs.

Aucun filtre ou regroupement ne doit réassigner implicitement une ligne, la faire apparaître dans un autre dossier ou modifier son statut. Une absence de résultat n’est pas présentée comme un solde nul.

## 4. Registres concernés

- **Employés et contrats :** références, statut et dates, catégorie validée, sans exposer par défaut données bancaires ou pièces privées.
- **Affectations et missions :** périodes, unités et états, sans transformer une mission en affectation ou contrat.
- **Congés et absences :** demande/événement, dates, état et source ; les détails médicaux restent masqués selon les droits.
- **Variables :** rubrique, période, source et étapes de saisie/validation/calcul distinctes.
- **Lots :** période, version, statut, anomalies et résultats disponibles, sans présenter un lot incomplet comme final.
- **Bulletins et paiements :** références et statuts distincts ; génération n’équivaut pas à remise et bulletin n’équivaut pas à paiement.
- **Transferts comptables :** références source et destination, aperçu/confirmation/état, sans créer de lien ou d’écriture non confirmé.

## 5. Sécurité, audit et conservation

Chaque lecture vérifie le dossier RH et les permissions. Les accès aux données sensibles (coordonnées bancaires, pièces, informations médicales, discipline, évaluations et rémunérations détaillées) sont restreints ; les listes générales n’en affichent que ce qui est nécessaire. Les actions importantes de consultation ou d’export sont journalisées selon la politique retenue.

Les droits de consultation, correction, approbation, export et administration sont distincts. Une ligne consultable ne confère pas le droit de la modifier. Une action de correction redirige vers le parcours source et conserve son audit. La rétention, l’archivage, la pagination et la durée de conservation seront définis par le client et les règles applicables.

## 6. Décisions à valider avant réalisation

- Quels registres et vues doivent être disponibles au lancement, et à quels rôles ?
- Quelles colonnes et filtres sont réellement nécessaires pour chaque registre ?
- Quels critères de recherche sur les données sensibles sont autorisés ?
- Quelle politique d’archivage, de pagination, d’historique et de conservation appliquer ?
- Quels registres peuvent être exportés, par qui et avec quelles restrictions ? (Le format et la mise en page seront précisés à l’étape 17.)
- Quels identifiants stables ou liens vers sources afficher à l’utilisateur ?

## 7. Critères d’acceptation proposés

1. Toute ligne provient d’une source identifiée et reste liée au bon dossier RH et aux identifiants métier stables.
2. Les registres consultent les données métier sans créer de copie modifiable concurrente.
3. Les actions de modification passent par un parcours dédié, autorisé et audité.
4. Les filtres et regroupements indiquent leur périmètre et ne déplacent ni ne réattribuent des données.
5. Les agrégats ne sont pas présentés comme une pièce ou une transaction unique si leurs éléments sources sont multiples.
6. Un lot incomplet, une donnée manquante ou un paiement sans preuve n’est pas affiché comme complet, nul ou payé.
7. Les données sensibles sont masquées ou restreintes selon rôle, dossier et finalité.
8. Un utilisateur ne consulte jamais les registres d’un autre dossier sans permission explicite.

**Étape suivante :** l’étape 16 cadrera les états et tableaux de suivi dérivés des sources. Cette fiche ne crée aucun menu ni écran.