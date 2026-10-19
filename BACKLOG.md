# PERFECTO — Backlog évolutif

Ce document suit les décisions et les prochaines étapes du prototype natif. Les éléments de démonstration ne constituent pas une sécurité ni une intégration de production.

## État actuel

- Interface web en HTML, CSS et JavaScript natifs, sans build ; le parcours Windows reste une étape séparée.
- Lot 1 de comptabilité générale fonctionnel en stockage local navigateur.
- Référence dossier `COR-GOD2026` prise en charge ; un cycle non calendaire juillet 2026–juin 2027 est géré en 12 périodes mensuelles.
- Page multi-dossiers clients en place : la Comptabilité ouvre la liste avant le tableau de bord ; création avec nom, code, type comptable, référence et cycle, ainsi que coordonnées client facultatives (adresse, IFU, RCCM, email, téléphone).
- Navigation Comptabilité générale organisée en huit menus latéraux, sous-menus en onglets verticaux et éléments imbriqués en listes ; fonctionnalités hors périmètre visibles mais inactives.
- Sur téléphone, consultation limitée au menu Éditions (balance, journal, grand livre) ; opérations de saisie et création de dossier réservées à l’ordinateur ou à la tablette.
- Répertoire **Définitions → Clients** livré en étape partielle : fiche tierce isolée par dossier, code `CLI` automatique/modifiable, recherche, création, modification et suppression refusée si une pièce ou un mouvement la référence. Il est distinct du registre des entreprises clientes du cabinet ; facturation, règlements, lettrage et grand livre auxiliaire complet restent à construire.
- Sous-menu **Définitions → Prestations** livré en première étape : catalogue local par dossier avec code `PRE` non réutilisé, désignation, description, recherche, archivage/réactivation et suppression protégée par les références. Aucun prix, TVA, compte de produit, facture ou écriture n’est présumé ; intégration à Ventes, stock & facturation à cadrer.
- Répertoire **Définitions → Débiteurs et créditeurs divers** livré en étape partielle : un registre typé, code `DEB`/`CRE` automatique/modifiable, compte auxiliaire de famille 47, changement de type et suppression protégés par les références comptables ; les mouvements et règlements ne sont pas générés.
- Répertoire **Définitions → Personnel** livré en étape partielle : fiches locales code `PER`, coordonnées professionnelles et compte auxiliaire de famille 42, modification/suppression protégées ; aucun salaire ni contrat n’est stocké et ce registre n’est pas encore relié à Paie & RH.
- Référentiel **Définitions → Localisation des immobilisations corporelles** livré en étape partielle : arborescence libre par dossier, niveaux et champs descriptifs modifiables, parent/enfant contrôlé, codes `LOC` non réutilisés ; les fiches d’immobilisations peuvent réutiliser ces lieux.
- Registre **Définitions → Éléments immobilisés** livré en étape partielle : fiches pour les trois natures, état, suivi physique, dates/coût XOF, localisation, comptes filtrés sur le plan du dossier et paramètres modifiables ; CRUD, migrations, sauvegardes et protections par références. Une simulation linéaire en lecture seule exige le choix explicite d’une convention, ne stocke aucun résultat et ne génère aucune écriture ; méthodes dégressive/unités d’œuvre et règles métier/fiscales restent à cadrer.
- Sous-menu **Définitions → Journaux** livré : six journaux standards protégés, création sans plafond fonctionnel de journaux utilisateurs avec code/libellé/type/nature des opérations/comptes autorisés/préfixe/description/état, références séquentielles par préfixe et exercice, historique des codes, archivage par désactivation et permissions distinctes. La saisie filtre les comptes autorisés du journal et la validation recontrôle chaque compte ; `*` signifie tous les comptes, sinon les numéros exacts sont séparés par des virgules. Les journaux `AMO`, `ABO`, `CEN` et `RPE` sont réservés aux traitements internes ; les saisir ou les alimenter par import est refusé. `RAN` est retiré, avec conservation verrouillée des seules éventuelles écritures historiques. Les générateurs des quatre journaux automatiques restent à construire.
- Menu Fichier : PERFECTO-ÉCHANGE v1 (écritures) et PERFECTO-BALANCE v1 (soldes nets) proposent des imports/exports contrôlés. Le format pivot PERFECTO-AUXILIAIRE v1 est documenté/testé, mais n’est pas exposé comme import ni comme source d’une centralisation.
- Paie & RH : registre local partiel de lots internes, approbation et lien de centralisation vers la Comptabilité. Les calculs de paie et fonctions RH complètes restent à construire ; les données fictives de démonstration ne sont pas calculées légalement.
- La centralisation des salaires lit exclusivement un lot approuvé du module maison Paie & RH ; elle n’accepte aucun fichier ni logiciel tiers.
- Ventes, stock & facturation : registre local partiel de lots d’exemples internes, approbation et lien de centralisation vers la Comptabilité. Les factures réelles, la fiscalité, les règlements et la valorisation des stocks restent à construire.
- La centralisation des opérations commerciales consomme exclusivement un lot approuvé de Ventes, stock & facturation ; aucun fichier ni logiciel tiers ne l’alimente. Les lots de démonstration n’effectuent aucun calcul fiscal ou de valorisation.
- Annulation des centralisations internes Paie & RH et Ventes : les brouillons sans effet peuvent être supprimés (avec restauration locale) ; les pièces validées restent immuables et sont annulées par une écriture inverse liée à l’original. Les imports de fichiers et logiciels tiers sont exclus ; une seule annulation est permise par pièce.
- Consolidation avant résultat : journal groupé en lecture seule, sélection par période/journal, agrégation par compte et provenance consultable pour chaque mouvement source ; export CSV détaillé. Aucun calcul du résultat ni écriture nouvelle au grand livre.
- Consolidation après résultat : même journal groupé consultatif, avec provenance par ligne et export CSV. La date/pièce d’arrêté, les comptes à retenir et les règles d’affectation du résultat ne sont pas automatisés ; aucune écriture de clôture n’est générée.
- Recalcul des soldes : contrôle indépendant des écritures validées du cycle, comparaison à la balance calculée et rapport/export sans aucune mutation. PERFECTO ne stockant pas de cache de soldes, l’action n’écrase aucune valeur persistée.
- Réparation de base : diagnostic des données du dossier et réparation sécurisée des périodes/métadonnées dérivées après point local. Les anomalies de pièces ne sont pas corrigées automatiquement ; les JSON illisibles sont conservés et les écritures bloquées jusqu’à restauration ou réinitialisation explicite.
- La centralisation auxiliaire reste à construire depuis les futurs modules maison de facturation, de gestion du personnel et de mouvements tiers ; les répertoires déclaratifs Clients, Fournisseurs, Débiteurs/Créditeurs et Personnel ne sont pas des sources comptables et le parcours reste désactivé.
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
- La centralisation auxiliaire depuis les modules maison n’est pas encore active : les répertoires clients, fournisseurs, débiteurs/créditeurs et personnel ne produisent pas de mouvements auxiliaires. Les futurs flux des modules internes devront les alimenter ; le pivot `PERFECTO-AUXILIAIRE` v1 reste un modèle d’interopérabilité et ne peut pas alimenter une centralisation.
- La centralisation des salaires part de lots approuvés dans Paie & RH, les transforme en une pièce générale au journal `PA` par défaut, ajoute en brouillon, conserve la provenance et bloque les doublons. Le jeu de paie démo n’effectue aucun calcul légal.
- La centralisation commerciale part de lots approuvés produits par le module maison Ventes, stock & facturation, ajoute une pièce générale au journal `VE` par défaut et bloque les doublons ; aucun fichier tiers ne peut l’alimenter. Le lot démo ne calcule ni fiscalité ni valorisation de stock.
- L’annulation sélectionne uniquement les pièces centralisées par les modules maison Paie & RH et Ventes, stock & facturation. Un brouillon est supprimé sans toucher au lot source ; une pièce validée exige une écriture inverse équilibrée et traçable, avec motif obligatoire, sans modification/suppression de l’original. Le brouillon inverse préparé est immuable ; une correction passe par sa suppression puis une nouvelle préparation. La période cible doit être ouverte dans le cycle ; une annulation unique est liée à chaque pièce d’origine.
- L’action `centralization.cancel` est distincte de l’import de données et de la validation d’écriture ; le traitement en brouillon est recommandé, et la validation immédiate requiert séparément `entry.validate`.
- La consolidation pré-résultat v1 agrège les écritures validées du dossier actif par compte général, sur une période et un journal choisis. Chaque ligne source reste traçable (pièce, journal, date, numéro de ligne, origine externe/interne si déclarée) dans le détail et l’export CSV ; le calcul du résultat et les écritures de clôture restent hors de ce parcours.
- La consolidation post-résultat v1 reste une édition consultative des écritures validées choisies par période/journal. L’arrêté du résultat, son affectation et les écritures de clôture ne sont ni détectés, ni calculés, ni comptabilisés ; leur règle métier doit être définie avant automatisation.
- Le recalcul du solde des comptes reconstruit les mouvements validés sur tout le cycle et compare les sommes par compte au calcul de la balance générale. Il n’écrit rien dans le dossier ; les brouillons sont exclus et les données hors cycle/incohérentes sont signalées.
- La réparation de base inspecte la structure, les références, les périodes et les équilibres. Seuls le registre des périodes et l’exercice dérivé peuvent être reconstruits automatiquement, après point local ; la réparation des écritures, des comptes et des journaux reste manuelle ou par restauration vérifiée. Une base brute illisible n’est jamais écrasée silencieusement.
- Comptabilité générale et comptabilité analytique sont deux modules séparés et interopérables ; l’analytique exploite les données issues de la comptabilité générale sans y intégrer ses propres définitions analytiques.
- Sur téléphone, seul le parcours de consultation des Éditions est prévu ; l’application de saisie est destinée à l’ordinateur ou à la tablette.
- Les fonctions analytiques, dépendantes de modules futurs ou à confirmer restent inactives jusqu’à une décision explicite ; les fonctions générales non encore réalisées sont étiquetées « À construire ».
- Le registre des immobilisations conserve la méthode « À définir / à valider » par défaut. La prévisualisation linéaire est indicative, non arrondie et non comptabilisante ; ses conventions sont choisies explicitement à chaque simulation. Aucun plan comptable, mouvement ou écriture d’amortissement n’est généré avant validation des règles métier et fiscales.
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
| `centralization.cancel` | Préparer l’écriture inverse d’une centralisation interne ; validation immédiate toujours séparée |
| `accounts.create` / `accounts.edit` / `accounts.delete` | Créer, modifier ou supprimer un compte ; la suppression et la renumérotation sont refusées si des écritures, clients, fournisseurs, tiers divers, personnel ou sous-comptes le référencent |
| `suppliers.create` / `suppliers.edit` / `suppliers.archive` / `suppliers.delete` | Gérer une fiche fournisseur ; la suppression définitive est réservée aux fiches non référencées et ne libère pas son code |
| `clients.create` / `clients.edit` / `clients.delete` | Créer, modifier ou supprimer une fiche client ; le refus par défaut et les limites par dossier sont appliqués, et une fiche référencée ne peut être ni renumérotée ni supprimée |
| `otherParties.create` / `otherParties.edit` / `otherParties.delete` | Gérer une fiche débiteur/créditeur divers ; les droits sont distincts et une fiche référencée ne peut pas être requalifiée, renumérotée ni supprimée |
| `personnel.create` / `personnel.edit` / `personnel.delete` | Gérer une fiche locale du personnel ; les droits sont distincts, sans calcul de paie, et une fiche référencée ne peut pas être renumérotée ni supprimée |
| `fixedAssets.create` / `fixedAssets.edit` / `fixedAssets.delete` | Gérer les éléments immobilisés dans le dossier autorisé ; les comptes sont filtrés, et les paramètres comptables protégés si un mouvement ou une écriture référence la fiche |
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

- Journaux système : construire les générateurs d’écritures `AMO` depuis les calculs d’immobilisations validés, `ABO` depuis un futur registre d’abonnements, `CEN` depuis les centralisations des seuls modules PERFECTO internes et `RPE` après détermination du résultat de période. Définir d’abord le routage, les règles comptables, les comptes de contrepartie, la période, l’idempotence, la validation et la traçabilité ; la simulation d’amortissement actuelle ne doit jamais servir de source de comptabilisation. Le journal `RAN` est retiré.
- Interopérabilité : faire valider avec un spécialiste Excel les modèles `PERFECTO-ÉCHANGE`, `PERFECTO-BALANCE` et `PERFECTO-AUXILIAIRE` et leurs règles métier ; développer les adaptateurs directs Sage Comptabilité, PERFECTO historique, HYPERSOFT et ODOO, un par version, avec des fichiers réels anonymisés et des tests de rapprochement. Les balances de mouvements et autres états restent à cadrer séparément.
- Immobilisations : faire valider les durées, méthodes, valeur résiduelle, règles de mise en service, dépréciations/cessions, pièces justificatives et comptes de contrepartie avant de construire les mouvements et calculs ; garder les validations fiscales explicites et testables.
- Comptabilité générale : tiers et auxiliaires détaillés, numérotation, extourne, lettrage, rapprochement bancaire, pièces jointes et états financiers SYSCOHADA complets.
- Compléter Paie & RH : dossier RH détaillé (au-delà du répertoire professionnel de Définitions), contrats, règles de calcul de paie, cotisations/retenues et validations métier. Compléter Ventes, stock & facturation : articles, clients, factures, règlements, règles fiscales, retours et valorisation des stocks. Construire ensuite Gestion de courriers ; chaque centralisation comptable devra lire les données du module maison correspondant.
- Exécutable Windows : cadrage séparé après stabilisation des parcours web et des règles de stockage.

## Hors périmètre de la démo actuelle

Pas d’authentification réelle, de Google Drive, de synchronisation multi-utilisateur, de protection des données métier côté serveur ni de résolution des conflits. Les profils et grants de démonstration sont temporaires ; les dossiers clients et leurs données comptables simulés restent locaux au navigateur. Les cycles peuvent commencer et finir sur des dates personnalisées, mais sont limités à 18 mois dans cette version et sont gérés par périodes mensuelles.
