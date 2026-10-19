# PERFECTO — Backlog évolutif

Ce document suit les décisions et les prochaines étapes du prototype natif. Les éléments de démonstration ne constituent pas une sécurité ni une intégration de production.

## État actuel

- Interface web en HTML, CSS et JavaScript natifs, sans build ; le parcours Windows reste une étape séparée.
- Lot 1 de comptabilité générale fonctionnel en stockage local navigateur.
- Référence dossier `COR-GOD2026` prise en charge ; un cycle non calendaire juillet 2026–juin 2027 est géré en 12 périodes mensuelles.
- Page multi-dossiers clients en place : la Comptabilité ouvre la liste avant le tableau de bord ; création avec nom, code, type comptable, référence et cycle, ainsi que coordonnées client facultatives (adresse, IFU, RCCM, email, téléphone).
- Navigation Comptabilité générale organisée en huit menus latéraux, sous-menus en onglets verticaux et éléments imbriqués en listes ; fonctionnalités hors périmètre visibles mais inactives.
- Sur téléphone, consultation limitée au menu Éditions (balance, journal, grand livre) ; opérations de saisie et création de dossier réservées à l’ordinateur ou à la tablette.
- Menu Fichier : PERFECTO-ÉCHANGE v1 (écritures), PERFECTO-BALANCE v1 (soldes nets) et PERFECTO-AUXILIAIRE v1 (centralisation d’un lot de pièces équilibrées) en CSV/Excel. Les imports contrôlent les correspondances et périodes, prévisualisent, sauvegardent localement, ajoutent sans remplacement et créent un brouillon par défaut.
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
- La centralisation auxiliaire v1 accepte un lot pivot de pièces complètes et équilibrées, les agrège par compte général cible en une seule pièce et exige un code auxiliaire pour les lignes de tiers ; elle ne remplace pas encore les adaptateurs natifs ni un grand livre auxiliaire intégré.
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
- Comptabilité analytique, Paie & RH, Gestion de courriers, Vente/Stock/Facturation, puis autres modules selon les besoins de l’organisation.
- Exécutable Windows : cadrage séparé après stabilisation des parcours web et des règles de stockage.

## Hors périmètre de la démo actuelle

Pas d’authentification réelle, de Google Drive, de synchronisation multi-utilisateur, de protection des données métier côté serveur ni de résolution des conflits. Les profils et grants de démonstration sont temporaires ; les dossiers clients et leurs données comptables simulés restent locaux au navigateur. Les cycles peuvent commencer et finir sur des dates personnalisées, mais sont limités à 18 mois dans cette version et sont gérés par périodes mensuelles.
