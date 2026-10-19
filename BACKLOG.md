# PERFECTO — Backlog évolutif

Ce document suit les décisions et les prochaines étapes du prototype natif. Les éléments de démonstration ne constituent pas une sécurité ni une intégration de production.

## État actuel

- Interface web en HTML, CSS et JavaScript natifs, sans build ; le parcours Windows reste une étape séparée.
- Lot 1 de comptabilité générale fonctionnel en stockage local navigateur.
- Référence dossier `COR-GOD2026` prise en charge ; un cycle non calendaire juillet 2026–juin 2027 est géré en 12 périodes mensuelles.
- Page multi-dossiers clients en place : la Comptabilité ouvre la liste avant le tableau de bord ; création avec nom, code, type comptable, référence et cycle, ainsi que coordonnées client facultatives (adresse, IFU, RCCM, email, téléphone).
- Navigation Comptabilité générale organisée en huit menus latéraux, sous-menus en onglets verticaux et éléments imbriqués en listes ; fonctionnalités hors périmètre visibles mais inactives.
- Sur téléphone, consultation limitée au menu Éditions (balance, journal, grand livre) ; opérations de saisie et création de dossier réservées à l’ordinateur ou à la tablette.
- Menu Fichier : PERFECTO-ÉCHANGE v1 (écritures) et PERFECTO-BALANCE v1 (soldes nets) proposent des imports/exports contrôlés. Le format pivot PERFECTO-AUXILIAIRE v1 est documenté/testé, mais n’est pas exposé comme import ni comme source d’une centralisation.
- Paie & RH : registre local partiel de lots internes, approbation et lien de centralisation vers la Comptabilité. Les calculs de paie et fonctions RH complètes restent à construire ; les données fictives de démonstration ne sont pas calculées légalement.
- La centralisation des salaires lit exclusivement un lot approuvé du module maison Paie & RH ; elle n’accepte aucun fichier ni logiciel tiers.
- Ventes, stock & facturation : registre local partiel de lots d’exemples internes, approbation et lien de centralisation vers la Comptabilité. Les factures réelles, la fiscalité, les règlements et la valorisation des stocks restent à construire.
- La centralisation des opérations commerciales consomme exclusivement un lot approuvé de Ventes, stock & facturation ; aucun fichier ni logiciel tiers ne l’alimente. Les lots de démonstration n’effectuent aucun calcul fiscal ou de valorisation.
- La centralisation auxiliaire est à construire depuis les futurs modules PERFECTO de gestion des tiers et mouvements ; le parcours utilisateur reste désactivé jusqu’à leur intégration.
- Les profils natifs Sage Comptabilité, PERFECTO historique, HYPERSOFT et ODOO ne sont pas encore implémentés ; ils nécessitent des exemples anonymisés et une validation par version.
- Connexion, profils, grants et dossiers ne sont pas encore reliés à une identité réelle ou à Google Drive.

## Décisions confirmées

- Refus par défaut ; le Superviseur général administre sa propre organisation.
- Gestionnaires et employés n’héritent d’aucun droit de leur rôle.
- Les grants sont additifs : une autorisation est accordée si au moins un grant correspondant couvre l’action et son périmètre. Il n’existe pas de refus implicite qui annule un autre grant.
- Pour les actions métier, « Consulter le module » et l’action doivent figurer dans le même grant et la même portée.
- Une portée organisationnelle couvre les dossiers de l’organisation ; une portée dossier ne couvre que les identifiants de dossiers clients qu’elle désigne.
- Le code du dossier client est saisi explicitement et reste éditable ; aucune règle automatique depuis le nom de l’entreprise n’est imposée.
- L’interopérabilité repose sur un format comptable commun, utilisé dans les deux sens, avec Excel/CSV comme passerelle et des adaptateurs séparés par logiciel ; les logiciels prioritaires cités sont Sage Comptabilité, PERFECTO historique, HYPERSOFT et ODOO.
- Les formats d’échange ne remplacent pas la sauvegarde native PERFECTO. Les importations ajoutent au dossier actif après aperçu, contrôles et point de restauration ; elles ne remplacent rien par défaut.
- L’import de balance v1 concerne les soldes nets uniquement et les transforme en une pièce de reprise (journal/date choisis, brouillon par défaut) ; les balances de mouvements et le report à nouveau restent distincts.
- Les centralisations entre modules PERFECTO lisent exclusivement les données des modules maison. Les formats de fichier et adaptateurs tiers relèvent de l’interopérabilité, pas de ces transferts internes.
- La centralisation auxiliaire depuis les modules maison n’est pas encore active : elle dépend des futurs registres internes de tiers et mouvements. Le pivot `PERFECTO-AUXILIAIRE` v1 est un modèle d’interopérabilité et ne peut pas alimenter une centralisation.
- La centralisation des salaires part de lots approuvés dans Paie & RH, les transforme en une pièce générale au journal `PA` par défaut, ajoute en brouillon, conserve la provenance et bloque les doublons. Le jeu de paie démo n’effectue aucun calcul légal.
- La centralisation commerciale part de lots approuvés produits par le module maison Ventes, stock & facturation, ajoute une pièce générale au journal `VE` par défaut et bloque les doublons ; aucun fichier tiers ne peut l’alimenter. Le lot démo ne calcule ni fiscalité ni valorisation de stock.
- Comptabilité générale et comptabilité analytique sont deux modules séparés et interopérables ; l’analytique exploite les données issues de la comptabilité générale sans y intégrer ses propres définitions analytiques.
- Sur téléphone, seul le parcours de consultation des Éditions est prévu ; l’application de saisie est destinée à l’ordinateur ou à la tablette.
- Les fonctions analytiques, dépendantes de modules futurs ou à confirmer restent inactives jusqu’à une décision explicite ; les fonctions générales non encore réalisées sont étiquetées « À construire ».
- Ces règles sont utilisées pour éprouver les parcours côté client. Elles ne protègent pas les données.
- Le cloud métier doit appartenir à l’organisation ; Google Drive est le fournisseur initial envisagé. Les données métier ne doivent pas être stockées dans une base applicative sur notre serveur.

## Prochaine étape — co-conception du catalogue d’actions comptables

Les identifiants ci-dessous sont reliés aux parcours actuels, mais leurs libellés et leurs effets restent à valider avec le métier, au fil de chaque module.

| Identifiant de démonstration | Parcours actuellement associé |
|---|---|
| `module.view` | Consulter les écrans du module dans un dossier client autorisé |
| `draft.create` | Créer un brouillon ou une écriture |
| `draft.edit` / `draft.delete` | Modifier ou supprimer un brouillon uniquement |
| `entry.validate` | Valider définitivement une pièce équilibrée |
| `accounts.create` | Ajouter un compte au plan comptable du dossier actif |
| `period.close` / `period.reopen` | Clôturer ou rouvrir une période du dossier actif |
| `data.import` / `data.export` | Importer ou exporter les données du dossier actif ; l’export couvre aussi certains états et impressions |
| `data.reset` / `data.restore` | Réinitialiser ou restaurer les données du dossier actif |

À examiner en priorité : distinguer éventuellement les exports JSON, CSV et impressions ; confirmer les droits exacts associés à la validation et à la restauration ; revoir ce catalogue quand les tiers, auxiliaires et autres parcours comptables seront développés. Les noms et regroupements pourront évoluer avec migration des données de droits.

## Avant toute mise en production ou synchronisation réelle

1. Concevoir et implémenter l’authentification e-mail/mot de passe et Google, les sessions et l’appartenance des utilisateurs aux organisations.
2. Définir la structure de fichiers dans l’espace Google Drive appartenant à l’organisation, les autorisations réelles et la stratégie de sauvegarde/restauration.
3. Appliquer les autorisations côté serveur et au niveau du stockage ; le contrôle client du prototype ne suffit pas.
4. Définir l’audit métier, les révisions, les écritures simultanées et le traitement des conflits hors ligne/en ligne.
5. Tester les migrations et restaurations sur des copies avant tout transfert de données réelles.

## Incréments fonctionnels ultérieurs

- Interopérabilité : faire valider avec un spécialiste Excel les modèles `PERFECTO-ÉCHANGE`, `PERFECTO-BALANCE` et `PERFECTO-AUXILIAIRE` et leurs règles métier ; développer les adaptateurs directs Sage Comptabilité, PERFECTO historique, HYPERSOFT et ODOO, un par version, avec des fichiers réels anonymisés et des tests de rapprochement. Les balances de mouvements et autres états restent à cadrer séparément.
- Comptabilité générale : tiers et auxiliaires détaillés, numérotation, extourne, lettrage, rapprochement bancaire, pièces jointes et états financiers SYSCOHADA complets.
- Compléter Paie & RH : dossier du personnel, contrats, règles de calcul de paie, cotisations/retenues et validations métier. Compléter Ventes, stock & facturation : articles, clients, factures, règlements, règles fiscales, retours et valorisation des stocks. Construire ensuite Gestion de courriers ; chaque centralisation comptable devra lire les données du module maison correspondant.
- Exécutable Windows : cadrage séparé après stabilisation des parcours web et des règles de stockage.

## Hors périmètre de la démo actuelle

Pas d’authentification réelle, de Google Drive, de synchronisation multi-utilisateur, de protection des données métier côté serveur ni de résolution des conflits. Les profils et grants de démonstration sont temporaires ; les dossiers clients et leurs données comptables simulés restent locaux au navigateur. Les cycles peuvent commencer et finir sur des dates personnalisées, mais sont limités à 18 mois dans cette version et sont gérés par périodes mensuelles.
