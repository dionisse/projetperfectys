# PERFECTO — suite modulaire (prototype statique)

Prototype **sans Blazor, sans WebAssembly et sans étape de build** de la suite PERFECTO.
Il comprend un écran de connexion de démonstration, un launcher central et le module
« Comptabilité générale SYSCOHADA révisé » (Lot 1). L’application utilise des fichiers
HTML, CSS et JavaScript natifs : interface, catalogue, politique d’accès de démonstration
et couche de données. Elle se déploie telle quelle sur tout hébergeur statique, y compris
**Vercel**, sans étape de build.

## Pourquoi cette conversion ?

La version précédente s'appuyait sur une PWA Blazor publiée : runtime `_framework/`,
`js/perfecto-db.js`, service worker, artefacts `dotnet publish`. Ces fichiers
n'étaient pas présents dans le dépôt, d'où l'écran « Une erreur inattendue est
survenue » et les échecs de déploiement. Le présent prototype reproduit les parcours
du Lot 1 en HTML/CSS/JavaScript natifs, avec les mêmes règles métier et une
persistance locale. Résultat : plus de runtime à charger, plus d'artefacts à
publier, un déploiement immédiat.

Le backlog et les décisions de conception sont suivis dans [`BACKLOG.md`](BACKLOG.md).

## Démarrer l’aperçu local ou Bolt AI

Le dépôt fournit un serveur statique sans dépendance ni compilation. Dans Bolt AI, lancer `pnpm dev` (ou `npm run dev`) ; le serveur écoute sur `0.0.0.0` et utilise le port injecté par l’environnement (`PORT`), avec le port 3000 comme valeur de secours. L’entrée `/` redirige vers le prototype `modern-proto/`. Pour ouvrir la version web dans un environnement Node classique, la même commande s’applique. Aucun `build` n’est nécessaire.

## Fonctionnalités

| Écran | Contenu |
|---|---|
| Navigation comptable | Huit menus latéraux (Fichier, Définitions, Saisie, Éditions, Déclarations, Fin d’exercice, Paramètres, Outils), sous-menus en onglets verticaux et éléments imbriqués en listes ; le module du launcher est renommé Suivi Analytique et ouvre les référentiels du dossier comptable actif. La saisie explicite, les mouvements consultables par nature/centre/journal/période et les règles par compte (obligatoire/facultatif, reliquat autorisé) sont intégrés au même dossier. |
| Fichier & interopérabilité | PERFECTO-ÉCHANGE v1 pour les écritures et PERFECTO-BALANCE v1 pour les soldes nets, avec modèles CSV/Excel, aperçu, correspondances, contrôles et point de restauration. Le pivot PERFECTO-AUXILIAIRE v1 est documenté/testé mais n’alimente aucune centralisation. Adaptateurs natifs Sage, PERFECTO historique, HYPERSOFT et ODOO à construire |
| Import FEC béninois | Import manuel contrôlé (arrêté du 23 avril 2020), aperçu et correspondances confirmées vers le plan cible, source conservée localement, doublons bloqués, brouillons annulables et écritures validées contrepassables par pièce liée ; voir [la documentation FEC](docs/fec-import-benin.md). Aucun connecteur direct au logiciel externe |
| Téléphone | Consultation limitée aux Éditions (balance, journal, grand livre) ; aucune saisie comptable ni création de dossier sur téléphone |
| Connexion (démo) | Aucun identifiant collecté ; e-mail/mot de passe et Google sont prévus, mais non actifs en démo |
| Launcher | Catalogue modulaire, recherche et filtres ; Comptabilité générale disponible ; Suivi Analytique partiel et intégré au dossier/droits de la Comptabilité générale ; Paie & RH et Ventes/Stock/Facturation partiels |
| Paie & RH (étape partielle) | Registre local de lots internes, approbation et lien vers la centralisation ; les calculs de paie et fonctions RH complètes restent à construire |
| Ventes, stock & facturation (étape partielle) | Lots locaux de ventes et d’approvisionnement, approbation et centralisation interne ; facturation, fiscalité et valorisation de stock réelles à construire |
| Centralisations internes (Comptabilité générale) | Disponible dans **Comptabilité générale → Fichier** pour les lots approuvés Paie & RH et Ventes/Stock/Facturation. Correspondances confirmées avant transfert vers le grand livre ; brouillon par défaut. Aucune imputation ou écriture analytique n’est créée. Les modules sources restent partiels et leurs calculs métier ne sont pas inventés |
| Annulation d’une centralisation | Brouillon interne supprimable sans effet comptable ; pièce validée annulée par écriture inverse traçable, sans toucher à l’originale. Paie & RH et Ventes/Stock/Facturation uniquement ; imports et logiciels tiers exclus |
| Consolidation avant résultat | Journal groupé consultable et exportable par période et journal, agrégé par compte général ; chaque ligne source conserve sa pièce, son journal, sa date, son numéro de ligne et son origine. Lecture seule : aucune écriture n’est ajoutée au grand livre |
| Consolidation après résultat | Journal groupé consultable et exportable des écritures validées, avec la même traçabilité par ligne. Lecture seule ; la détection de la pièce/date de résultat, son affectation et les écritures de clôture restent à définir |
| Recalcul du solde des comptes | Reconstitution indépendante à partir des écritures validées du cycle, comparaison à la balance calculée, contrôle des pièces et export CSV ; lecture seule, sans solde cache ni écriture modifiée |
| Réparation complète de la base | Diagnostic du dossier actif, réparation protégée du registre des périodes et des métadonnées dérivées, sauvegarde préalable ; aucune modification automatique des écritures validées |
| Organisation & accès (démo) | Profils temporaires et droits explicites par personne, module, entreprise cliente, dossier et action ; refus par défaut |
| Dossiers clients | Liste multi-dossiers ouverte depuis le module Comptabilité ; création d’entreprise, code, type comptable, référence et cycle paramétrable |
| Configuration de la Comptabilité | Paramètres comptables enregistrés par dossier ; modification réservée au Superviseur général ou à un droit `accounting.configure` explicite. La date limite, le cycle, la précision des montants et la périodicité des références sont appliqués ; les fonctions associées aux règlements, commandes, clôture automatique et états en euros restent inactives |
| Sections et comptes analytiques | Listes principales, auxiliaires et comptes configurables par dossier ; après validation, elles sont verrouillées/grisées. Les mouvements et opérations analytiques restent inactifs |
| Clés de répartition des sections | Deux grilles libres et indépendantes par dossier (sections auxiliaires sur principales ; familles de prestations par section), avec Afficher, Valider, Destination et Aperçu ; les grilles validées sont grisées. Aucune clé n’est interprétée et aucun calcul, transfert ou mouvement n’est exécuté |
| Natures analytiques | Tableau de référence par dossier selon la capture, avec noms génériques/individuels, I.O., comptes significatifs et comptes à reporter ; modification selon un droit explicite, sans imputation ni calcul analytique |
| Comptes associés aux immobilisations | Tableau des comptes de valeur brute, amortissements, dotations, cessions et reprises de subventions, configuré par dossier selon la capture ; aucune écriture générée |
| Compte de suivi des commandes et marchés accordés | Grille Rubrique/Comptes paramétrable par dossier selon la capture ; les lignes vides permettent d’ajouter des rubriques sans modifier les sept lignes de référence. Aucun achat, suivi de commande, calcul ou écriture n’est activé |
| Natures des commandes | Liste des cinq types de documents de la capture, numéros et libellés modifiables, natures ajoutables par dossier. Les commandes et écritures restent inactives |
| Comptes lettrables, pointables, à payer, à recevoir | Quatre listes libres et vides par défaut, éditables et persistées par dossier ; bouton de sélection dans le plan comptable. Aucun lettrage, pointage, règlement ni mouvement n’est lancé |
| Natures des comptes généraux | Tableau Nature/Comptes prérempli selon les captures, sauvegardé par dossier ; une ligne peut être modifiée et la liste réinitialisée. Les contrôles refusent les libellés de nature et codes répétés dans une même ligne ; le plan comptable et les écritures ne sont pas modifiés |
| Tableau de bord | Indicateurs (débit, crédit, résultat, pièces), dernières pièces, activité par journal, état des périodes |
| Plan comptable | Référentiel SYSCOHADA v2 de 1 400 codes transcrits du PDF fourni (37 pages), avec classes, sous-classes, recherche/filtres, personnalisation par dossier et ajout des comptes du dossier ; les comptes historiques sont préservés. La classe 9 est affichée en référence seule. Les numéros utilisés dans les pièces, les rattachements clients/fournisseurs/tiers divers/personnel ou les sous-comptes sont protégés, sans réécriture de l’historique |
| Fournisseurs | Répertoire local isolé par dossier : code automatique modifiable, création, modification, archivage/réactivation et suppression des fiches non référencées ; IFU/RCCM, contacts, compte général et auxiliaire individualisé ; aucune facture, aucun règlement, mouvement auxiliaire ni lettrage individuel fournisseur n’est généré. Le lettrage disponible porte uniquement sur le compte général faute d’identifiant auxiliaire ; aucune centralisation n’est générée |
| Clients | Répertoire des tiers clients de l’entreprise suivie, distinct des dossiers clients du cabinet : code `CLI` automatique/modifiable, création, modification et suppression protégée dès qu’une pièce ou un mouvement comptable référence la fiche ; aucune facture, règlement ni écriture n’est généré |
| Prestations | Catalogue local par dossier, code `PRE` non réutilisé, désignation, description, recherche, archivage et réactivation ; prix, fiscalité et facturation restent à construire |
| Débiteurs et créditeurs divers | Répertoire mixte avec type débiteur/créditeur, code `DEB`/`CRE` automatique, compte auxiliaire 47 et modification/suppression protégées |
| Personnel | Répertoire local des membres du personnel, code `PER` automatique, fonction, service, contacts et compte auxiliaire 42 ; sans salaires ni contrats |
| Localisation des immobilisations corporelles | Arborescence locale de niveaux et d’emplacements modifiables (code `LOC`, parent/enfant, adresse, responsable), réutilisable depuis les fiches immobilisées |
| Éléments immobilisés | Registre local par dossier pour les trois natures, paramètres et comptes associés ; simulation linéaire indicative, convention explicitement choisie, lecture seule sans écriture |
| Journaux | Huit journaux standards (dont Abonnements et Centralisations spécialisés), deux journaux système protégés et création illimitée de journaux par dossier ; paramètres, statuts et références automatiques |
| Saisie dans les journaux | Liste par journal avec code, intitulé, nombre de pièces, débits/crédits validés, brouillons et état de clôture de la période ; double-clic sur un journal actif pour ouvrir sa saisie |
| Opérations de caisse en temps réel | Encaissements et décaissements rapides au journal `CA`, écritures équilibrées, aperçu du solde avant/après et recalcul à partir des seules pièces validées sur les comptes de caisse `57`; brouillons exclus. Stockage local de démonstration, sans synchronisation multi-utilisateur ; transferts entre caisses et calculs de TVA exclus |
| Comptes généraux et auxiliaires | Cet écran apparaît après sélection de son enfant sous « Mouvements des comptes généraux, tiers et analytiques » ; aucune plateforme n’est affichée au bas du menu parent. Arborescence du plan, synthèse mensuelle (lignes, débits, crédits), totaux, soldes de clôture et détails par mois/exercice issus des écritures validées du cycle du dossier. Les fiches auxiliaires restent sans mouvements/soldes individuels faute d’identifiant auxiliaire dans les pièces |
| Comptes tiers | Référentiels du dossier pour fournisseurs, clients, personnel et débiteurs/créditeurs divers ; consultation des montants agrégés par compte collectif uniquement. Les mouvements et soldes individuels ne sont pas inventés : les pièces actuelles ne portent pas d’identifiant de tiers |
| Lettrage | **Saisie → Lettrage** : lettrage manuel de lignes validées et équilibrées sur un compte auxiliaire de classe 4. Les lettres sont persistées séparément, annulables avec historique, sans modifier les écritures ; faute d’identifiant auxiliaire dans les pièces, le lettrage n’est pas attribué à un fournisseur ou client individuel |
| Pointage | **Saisie → Pointage** : import générique CSV/XLSX, prévisualisation et choix/détection des colonnes, lignes de relevé conservées localement par dossier, suggestions sur montant/sens/date avec tolérance modifiable, confirmation explicite avant pointage ; aucun mouvement comptable créé ou modifié. L’original reste en IndexedDB sur l’appareil dans cette démo ; PERFECTO n’est relié ni à un compte utilisateur/organisation ni au Google Drive de l’organisation |
| Reports à nouveau | **Saisie → Reports à nouveau** : consulter, insérer, modifier, supprimer, imprimer et contrôler des reports ; lecture non destructive d’un dossier réellement enregistré pour le cycle précédent, transfert relançable compte par compte, sans écriture de journal ni écrasement des reports manuels. Les lettrages/pointages courants restent intacts ; factures, analytique et amortissements cumulés restent à vérifier selon les données disponibles. **Opérations de fin d’exercice → Passage à N+1** renvoie vers ce parcours |
| Centres d’analyse | Création, modification, archivage, réactivation et suppression protégée d’un référentiel de centres défini par l’utilisateur, isolé par dossier et à codes non réutilisables. Réservé à l’analytique : aucune écriture générale n’est générée. Les imputations et états analytiques spécialisés restent inactifs ; le cumul consultatif par centres dans Éditions → Journaux ne retient que les références explicites déjà portées par les lignes |
| Saisie d'écriture | Saisie multiligne dans le journal choisi, contrôle d'équilibre en direct, référence proposée automatiquement, brouillon ou validation |
| Pièces comptables | Liste filtrable, détail en modale, validation, modification et suppression des brouillons ; colonne **Justificatifs** pour joindre plusieurs factures, quittances, bons de commande ou autres preuves PDF/JPG/PNG à une pièce. La gestion requiert le droit distinct `entryAttachments.manage`. En mode test, fichiers en IndexedDB sur le navigateur/appareil, par dossier et numéro de pièce ; pas de sauvegarde JSON ni de transfert Google Drive. Le mode production devra connecter le stockage Drive réel. |
| Balance générale | Débit, crédit et solde par compte, contrôle d'équilibre, export CSV, impression |
| Éditions → Journaux | Catalogue de 10 états rangés en « Suivi et contrôle des pièces », « Cumuls et ventilations » et « Imputation ». « Détail des lignes saisies » propose une sélection des journaux, comptes, dates et colonnes, une mise en page, un aperçu, un export Excel/TXT et une impression après aperçu ; il lit les écritures validées sans les modifier. « Pièces modifiées après première saisie » filtre les journaux et la période de dernière modification, affiche un compteur de lignes calculé depuis les données, puis reprend le même parcours de mise en page et d’export. Les brouillons modifiés sont horodatés à partir de cette version ; aucun historique antérieur non conservé n’est reconstitué. Toutes les colonnes sont sélectionnables et les cellules sans valeur source restent vides. L’en-tête d’aperçu et d’impression identifie d’abord l’organisation titulaire de la licence, puis le dossier client. « Pièces déséquilibrées » sélectionne journaux, cycle et huit colonnes selon la capture, puis reprend le parcours de mise en page, aperçu, export Excel/TXT et impression après aperçu ; le contrôle inclut les brouillons et pièces validées, calcule l’écart débit/crédit à la précision du dossier et ne modifie pas les pièces. « Cumul des pièces saisies » sélectionne journaux et cycle, puis regroupe par journal les pièces validées, leurs lignes et leurs totaux débit/crédit ; le nombre de lignes est facultatif et le même parcours d’aperçu, d’export et d’impression est réutilisé. « Cumul par comptes individuels » sélectionne les journaux, comptes et cycle, et totalise les lignes validées par compte. « Cumul par comptes de synthèse » sélectionne les journaux, le niveau de synthèse (1 à 8) et le cycle ; le niveau N regroupe selon les N premiers chiffres du code, et les intitulés absents du référentiel restent vides. « Cumul par tiers » sélectionne les journaux, la nature (clients, fournisseurs, personnel, débiteurs ou créditeurs), les fiches et le cycle ; il totalise uniquement les mouvements validés de comptes auxiliaires portant une référence explicite associée à une fiche du dossier. Les comptes collectifs sans identifiant ne sont pas ventilés. Les colonnes des cumuls individuels, de synthèse et par tiers sont configurables et ces rapports réutilisent la mise en page, l’aperçu et l’export. « Cumul par centres analytiques » suit le même parcours en consultation seule : ses cinq colonnes sont configurables, et seules les lignes validées portant une référence explicite et non ambiguë vers un centre du dossier sont cumulées ; aucune imputation n’est créée et les lignes sans référence ne sont pas ventilées. « Cumul par devises » sélectionne les journaux et le cycle, puis totalise les pièces validées par devise avec code, intitulé, nombres de pièces/lignes et débits/crédits ; le nombre de lignes est facultatif. Le XOF reprend les montants comptabilisés ; les autres devises nécessitent un code et un montant d’origine explicites. Aucun cours ni conversion n’est appliqué ; les lignes dont le montant devise est absent, négatif ou ambigu sont exclues et signalées. « Fiche d’imputation » propose un modèle vierge imprimable/enregistrable en PDF par le navigateur, avec trois fiches A4 par page, six lignes au maximum et l’identité du titulaire puis du dossier à gauche. Les états analytiques spécialisés et toute imputation automatique restent désactivés dans la comptabilité générale |
| Éditions → Lettrage | Sous-menu organisé en « Écritures lettrées », « Anomalies sur les lettrages » et « Écritures non lettrées ». Les écrans et leurs paramètres restent provisoires jusqu’à réception des captures ; le lettrage manuel opérationnel reste dans Saisie → Lettrage |
| Éditions → Pointage et rapprochement bancaire | Sous-menu en deux groupes : écritures pointées/non pointées et justification des soldes ; relevé de banque et rapprochement bancaire. Les critères, colonnes, calculs et rendus attendent les captures ; le pointage opérationnel reste dans Saisie → Pointage |
| Éditions → Immobilisations | 17 états organisés en six groupes selon la capture : le Tableau des immobilisations, le Tableau des amortissements et les douze états complémentaires sont actifs ; les ventilations par centres de responsabilité, domaines d’activités et sources de financement restent grisées. Les états consultent les champs explicitement enregistrés ; les mouvements, rapprochements, montants et anomalies sans source ou règle explicite restent vides. Le tableau des amortissements demeure distinct de la simulation linéaire indicative |
| Éditions → Définitions et plans | 7 sous-éléments en cinq groupes. « Cadre comptable » et « Postes du bilan » sont actifs en lecture seule, avec aperçus plein écran et exports Excel/TXT. Le Cadre comptable reprend les 532 lignes de son PDF et conserve les rattachements Débit/Crédit ; son compteur de 533 inclut uniquement l’en-tête. Les Postes du Bilan reprennent 92 postes et 166 lignes du PDF « les postes du bilan.pdf » ; le filtre `*` et les colonnes Code, Comptes et Intitulé sont sélectionnés par défaut, et le compteur 167 inclut uniquement l’en-tête. Les codes, libellés, signes, lignes de comptes et l’ordre du bilan sont conservés sans affectation ni valeur ajoutée. Les autres états restent en attente de leurs spécifications ; aucune maintenance du plan comptable, des tiers ou des journaux n’est exposée. « Plan analytiques » reste inactif |
| Éditions → Comptes généraux | 11 états : la balance générale, la balance de synthèse et la balance âgée ont un parcours de sélection, mise en page et aperçu plein écran ; le grand livre ouvre la vue existante. La Balance âgée s’appuie sur un registre manuel dédié des pièces ouvertes, échéances et règlements/avances, sans réutiliser les écritures validées comme factures. Les reports, situations, historique multi-exercices et contreparties restent à préciser. L’édition analytique est désactivée |
| Éditions → Tiers | 7 états structurés ; les balances, grands livres et relevés individuels attendent les captures et l’identifiant de tiers dans les pièces. Aucun solde individuel n’est inventé |
| Éditions → Comptes en devises | 5 états structurés (balance, ouverture, situation, grand livre, écarts) ; en attente du modèle multidevise et des règles de conversion. Le seul cumul actif se trouve sous Éditions → Journaux et ne convertit aucun montant |
| Éditions → États analytiques | 7 sous-éléments visibles mais encore inactifs, à raccorder aux ventilations explicites des lignes comptables ; ils font partie du Suivi Analytique intégré, pas d’un grand livre séparé |
| Éditions → Commandes aux fournisseurs | Sous-menu conservé grisé/inactif jusqu’à la définition de son périmètre |
| Éditions → Budget | 10 états organisés entre budgets, engagements, réalisations et disponibilités ; écrans provisoires, aucun budget ou reste disponible calculé |
| Journal des écritures | Écritures validées chronologiques, filtre journal/exercice, impression |
| Grand livre | Mouvements par compte et solde progressif |
| Périodes | Périodes mensuelles couvrant le cycle défini pour le dossier (calendaire ou non), ouverture et clôture persistées |
| Données & application | Sauvegarde/restauration native JSON, point de restauration local avant modification, installation PWA |

### Éditions → Balance âgée — registre manuel et calcul

**Éditions → Comptes généraux → Balance âgée** suit les créances clients, dettes fournisseurs et avances sur salaire à partir d’un registre dédié au dossier. Une pièce ouverte conserve sa nature, son compte général, son tiers existant (Client, Fournisseur ou Personnel), sa référence, ses dates de pièce et d’échéance et son montant initial. Les règlements/avances sont saisis séparément avec une date et un montant, rattachés à une pièce. Cette source est manuelle : aucune facture, échéance ou règlement n’est reconstitué depuis les écritures validées, et ces opérations de registre ne créent ni ne modifient de ligne du grand livre.

Les comptes proposés par défaut sont `421` pour les avances sur salaire, `411 -4117 485 486 488` pour les clients et `401 -4017 408 481 482 483 484` pour les fournisseurs. Les filtres acceptent des préfixes inclus et exclus séparés par des espaces, virgules ou points-virgules. La sélection comprend une date d’arrêté, une étendue calendaire de 6 mois ou 5 ans et des colonnes cochables (compte, intitulé, tiers, total dû, avances et solde). Chaque tranche d’ancienneté est une colonne sélectionnable séparément ; aucune tranche n’est affichée par défaut. Les pièces sont agrégées par compte et tiers.

Les tranches sont déterminées par la date d’échéance : **Non échu**, **1–30**, **31–60**, **61–90** et **plus de 90 jours**. Toute échéance antérieure au début de l’étendue choisie est cumulée sous **Antérieur**. Les tranches portent sur les montants initiaux, sans déduction des règlements, et n’apparaissent dans le rapport que si l’utilisateur coche leurs colonnes respectives à l’avance. **Avances** totalise les règlements datés au plus tard à l’arrêté ; **Solde = Total dû − Avances**, même si le résultat est négatif. Les pièces postérieures à l’arrêté et les règlements ultérieurs ne sont pas inclus.

Le parcours offre mise en page, aperçu plein écran obligatoire avant impression, export Excel (`.xlsx`) ou texte tabulé (`.txt`) et impression via le navigateur, qui conserve le choix final de l’imprimante/PDF. PERFECTO ne peut pas préconfigurer la plage de pages ni la parité dans la boîte du navigateur : réglez-les là si elle les propose. Les actions de création, modification, suppression, impression et export ont des droits distincts (`agedBalance.*`). Le stockage est local à cette démo et ne constitue pas un registre comptable centralisé ou une source de production.

### Configuration de la Comptabilité — paramètres par dossier

Le sous-menu **Paramètres → Configuration de la Comptabilité** permet de conserver, dans le catalogue du dossier actif, le cadre comptable (par défaut « SYSCOHADA révisé »), le pays (« BENIN »), l’organisme spécifique (« Aucun »), les dates du cycle, la date limite de saisie, la précision des montants, la périodicité de numérotation, le délai de clôture automatique, les règles de règlement fournisseurs et autres comptes à payer, ainsi que les options « Commandes fournisseurs » et « États en euros ». Les paramètres sont isolés par entreprise cliente et inclus dans la sauvegarde JSON du dossier.

Le rôle de démonstration **Superviseur général** peut enregistrer ces valeurs dans sa propre organisation. Tout autre profil est refusé par défaut et doit recevoir explicitement l’action `accounting.configure` sur le dossier concerné. La date limite de saisie, le nombre de décimales (0 à 4), la numérotation par jour/mois/année/exercice et les limites du cycle sont contrôlés par la saisie générale. Les périodes fermées sont conservées lorsque le cycle change ; une modification qui exclurait une pièce existante est refusée sans réécrire celle-ci. Les dates préremplies proviennent donc du cycle réel déjà associé au dossier (le dossier de démonstration contient des pièces 2026), tandis que les autres valeurs initiales reprennent la capture.

Les champs de clôture automatique, règlements, commandes fournisseurs, états en euros, cadre/pays et organisme sont persistés comme paramètres mais ne déclenchent pas encore les traitements correspondants ; aucune clôture, échéance, commande ou conversion n’est générée dans ce prototype. L’accès **Données et sauvegardes locales** reste disponible séparément depuis ce sous-menu. Le stockage reste local au navigateur et les permissions côté client ne constituent pas une sécurité de production.

### Sections et comptes analytiques — paramétrage verrouillé

Le sous-menu **Paramètres → Sections et comptes analytiques** reprend les trois listes de la capture : **Sections principales**, **Sections auxiliaires** et **Comptes**. Elles sont vierges par défaut ; les valeurs saisies sont conservées une par ligne et par dossier. Le droit de démonstration `analyticalSections.configure` permet au Superviseur général (ou à un profil explicitement autorisé) de valider le paramétrage. Après validation, les listes sont affichées en gris et verrouillées pour cette étape.

Ce paramétrage ne crée aucun centre d’analyse, imputation, mouvement, écriture ou état. Il est séparé du référentiel **Définitions → Centres d’analyse** ; la comptabilité analytique et ses autres parcours demeurent inactifs dans la comptabilité générale.

### Clés de répartition des sections — deux grilles indépendantes

Le sous-menu **Paramètres → Clés de répartition des sections** présente, pour chaque dossier, une grille **Sections principales / Sections auxiliaires / Clé** et une grille distincte **Sections principales / Familles des prestations / Clé**. Elles sont vides par défaut ; une ligne commencée doit être complétée, mais la valeur de la clé reste un texte libre sans format, unité ni formule présumés. Le droit de démonstration `analyticalAllocationKeys.configure` contrôle la saisie et la validation dans le dossier concerné.

Chaque bouton **Afficher** consulte les valeurs enregistrées et **Aperçu** montre les valeurs saisies ou enregistrées en lecture seule ; **Destination** place le curseur dans le champ de destination. Ces consultations ne modifient aucune donnée. **Valider** enregistre et grise uniquement la grille concernée ; l’autre grille reste indépendante. Le paramétrage ne déclenche aucun calcul, ventilation, transfert, imputation, écriture ni état analytique. Les données sont stockées dans le navigateur avec le catalogue du dossier ; cela ne constitue pas un stockage Drive ou une sécurité de production.

### Natures analytiques — nomenclature de référence

**Paramètres → Natures analytiques** reprend le tableau de la capture : **Nom générique**, **Nom indiv.**, **I.O.**, **Comptes significatifs** et **Comptes à reporter**. Il contient les cinq natures de base, le séparateur **Analyses Diverses**, puis les six natures complémentaires visibles. Les cellules restent vides comme sur la référence, à l’exception de **Natures des flux de trésorerie** (I.O. **Oui**, comptes significatifs `5`). La ligne **Domaines d’activités** est sélectionnée à l’ouverture ; **Comptes généraux** reste désactivé.

Le droit `analyticalNatures.configure` contrôle **Modifier** et le bouton **I.O.** au niveau du dossier. **I.O.** bascule le marqueur de la ligne sélectionnée ; ce marqueur n’est pas encore appliqué aux saisies. **Modifier** permet d’éditer les champs du tableau et **Fermer** revient aux paramètres. Cette nomenclature est sauvegardée par dossier, mais n’active aucun mouvement, imputation, ventilation ou calcul analytique dans le parcours général.

### Comptes associés aux immobilisations — tableau de correspondance

**Paramètres → Comptes associés aux immobilisations** reprend les cinq correspondances visibles : `21*` → `281*`, `6812`, `811`, `799` ; `22*` → `282*`, `6813`, `812`, `799` ; `23*` → `283*`, `6813`, `812`, `799` ; `24*` → `284*`, `6813`, `812`, `799` ; `26*` → cellules d’amortissement et de dotation vides, `816`, `799`. Les colonnes sont **Compte de valeur brute**, **Compte d’amortissements**, **Dotations aux amortissements**, **Valeurs nettes de cession** et **Reprises de subventions**. Les cases vides visibles sont conservées.

La grille est enregistrée par dossier, occupe toute la largeur disponible et n’a pas de défilement interne ; les six boutons sont regroupés sous le tableau. Le droit `fixedAssetAccounts.configure` permet de modifier la ligne sélectionnée, d’ajouter une correspondance en choisissant une ligne vide en bas, de valider ou d’annuler les changements, et de réinitialiser la nomenclature (ce qui retire aussi les lignes ajoutées, après confirmation). L’ajout ne modifie pas les cinq lignes de référence ; **Comptes...** reste désactivé comme sur la capture. Cette correspondance n’est pas encore appliquée au registre des immobilisations et ne génère aucune écriture ni aucun calcul.

### Compte de suivi des commandes et marchés accordés — tableau de correspondance

**Paramètres → Compte de suivi des commandes et marchés accordés** reproduit la grille **Rubrique / Comptes** de la capture sous le titre **Comptes de suivi des marchés accordés**, avec la première ligne sélectionnée, les séparateurs pointillés, deux lignes vides et les boutons **Comptes généraux...** (désactivé), **Modifier** et **Fermer**. Les sept rubriques initiales sont :

| Rubrique | Comptes |
| --- | --- |
| Réalisation HT (achats, travaux, honoraires) | `21 22 23 24 60 -608 61 62 63` |
| TVA déductible | `445` |
| Avances aux fournisseurs | `4091 4092 4093` |
| Factures fournisseurs | `401 -4017 408 481 482 483 484` |
| Règlements | `5` |
| Retenues de garantie | `4017` |
| Autres retenues (impôts, pénalités...) | `447FO` |

La configuration est sauvegardée par dossier. Le droit `orderAccounts.configure` autorise **Modifier** ; sélectionner une ligne vide puis l’enregistrer ajoute une rubrique, sans déplacer ni réécrire les sept valeurs de référence. **Comptes généraux...** reste désactivé comme sur la capture. Cette table ne met en service ni les commandes aux fournisseurs ni le suivi opérationnel des marchés ; elle ne crée aucun achat, calcul, mouvement ou écriture comptable.

### Natures des commandes — nomenclature par dossier

**Paramètres → Natures des commandes** affiche, sous le titre de fenêtre **Natures des marchés accordés**, la liste à deux colonnes visuelles (numéro et nature) de la capture, avec les cinq lignes initiales : `1 Bon de commande`, `2 Lettre de commande`, `3 Contrat`, `4 Nature 4` et `5 Nature 5`. La première ligne est sélectionnée au chargement ; des lignes vides restent visibles dans la zone défilante. Les boutons **Modifier** et **Fermer** reprennent la capture.

Le droit `orderNatures.configure` permet de modifier le numéro et le libellé de la ligne sélectionnée, ou d’ajouter une nature en sélectionnant une ligne vide. Une nouvelle nature reçoit le prochain numéro disponible par défaut ; les numéros et libellés doivent être renseignés et le numéro doit rester unique. Les valeurs sont persistées par dossier. Il s’agit uniquement d’une nomenclature : le parcours opérationnel de commande ou d’achat, les mouvements et les écritures restent inactifs.

### Comptes lettrables, pointables, à payer et à recevoir — paramètres par dossier

**Paramètres → Comptes lettrables, pointables, à payer, à recevoir** reprend les quatre zones vides de la capture : **Comptes à payer (fournisseurs, organismes sociaux, état ...)**, **Comptes lettrables (autres que dettes ou créances)**, **Comptes à recevoir (clients, débiteurs divers ...)** et **Comptes pointables (banques)**. La première zone est surlignée à l’ouverture. Les listes acceptent du texte libre et restent vides par défaut ; **Comptes généraux...** ouvre le plan comptable pour ajouter des codes à la zone sélectionnée. **Valider** enregistre les listes par dossier ; **Annuler** restaure les dernières valeurs enregistrées. Les champs restent modifiables après sauvegarde.

Le droit `accountControls.configure` est requis pour modifier. Cette configuration ne lance aucun lettrage, pointage, règlement, échéance, rapprochement ni mouvement ; elle n’altère pas le plan comptable et ne crée aucune écriture.

### Natures des comptes généraux — nomenclature par dossier

**Paramètres → Natures des comptes généraux** affiche une table défilante à deux colonnes (**Nature**, **Comptes**) reprenant les lignes des trois captures dans leur ordre, y compris les séparateurs pointillés et les cellules de comptes restées vides. Le passage d’une capture à l’autre est consolidé : une ligne de nature n’est pas ajoutée deux fois lorsqu’elle réapparaît dans la suite visuelle. La liste initiale est propre à chaque dossier. **Modifier** ouvre l’édition de la ligne sélectionnée ; **Initialisation** restaure la nomenclature fournie pour ce dossier, après confirmation ; **Fermer** revient aux paramètres. **Comptes généraux…** reste désactivé comme sur la capture.

Le droit de démonstration `generalAccountNatures.configure` est requis pour modifier ou initialiser. Dans cette nomenclature PERFECTO, `*` signifie « tous les comptes » et `?` remplace le chiffre situé à cette position. Ainsi, `2?9*` désigne les comptes divisionnaires à trois chiffres de la classe 2 dont le dernier chiffre est 9, ainsi que leurs subdivisions ; la ligne **dont en cours** et l’autre occurrence du motif dans **dont suivis par éléments** sont enregistrées sous les formes `2?9*` et `-2?9*`. Le tableau conserve ces motifs sans les appliquer à un calcul. Le contrôle refuse les libellés de nature répétés et les codes de compte répétés **dans une même ligne** ; un même code peut toutefois apparaître dans plusieurs natures lorsque le tableau de référence le classe ainsi. La nomenclature est sauvegardée par dossier, sans créer/modifier de compte dans le plan comptable ni toucher aux écritures. À l’ouverture, les dossiers déjà enregistrés avec `279*` et `-279*` dans les deux lignes concernées sont migrés vers `2?9*` et `-2?9*`, sans modifier les autres paramètres.

### Journaux — gestion par dossier

Le sous-menu **Définitions → Journaux** conserve six journaux usuels — Achats (`ACH`), Ventes (`VTE`), Banques (`BQ`), Caisse (`CA`), Opérations diverses (`OD`) et Paie (`PA`) — auxquels s’ajoutent deux journaux standards spécialisés : Abonnements (`ABO`) et Centralisations (`CEN`). Les deux anciens codes `AC` et `VE` sont retirés des nouvelles saisies ; les écritures existantes conservent leurs codes et références, et leurs journaux sont conservés en historique verrouillé. Il permet aussi de créer sans plafond fonctionnel des journaux propres au dossier. Chaque journal comporte un code, un libellé, un type libre (avec suggestions), une nature d’opérations (choisie parmi huit natures), les comptes autorisés, un préfixe de référence, une description d’usage et un état actif/inactif. Le champ **Comptes autorisés** accepte `*` pour tous les comptes, ou des numéros exacts de 2 à 8 chiffres commençant par une classe 1 à 8, séparés par des virgules ; les comptes indiqués sont filtrés dans la saisie d’écriture, et toute écriture est contrôlée à l’enregistrement puis à la validation. Les natures proposées sont « Opérations courantes », « Amortissements automatiques », « Abonnements », « Centralisation », « Résultat de l’exercice », « Inventaire », « Immobilisations » et « Caisse en temps réel ». Les journaux existants reçoivent par migration la nature « Opérations courantes » et l’autorisation `*`, sauf les journaux spécialisés qui conservent leur nature. Le préfixe alimente la proposition de référence. La période est réglable dans **Paramètres → Configuration de la Comptabilité** (année par défaut), avec numérotation par jour, mois, année ou exercice. Un journal inactif reste consultable et ses brouillons déjà ouverts peuvent être terminés, mais aucune nouvelle écriture ne peut lui être ajoutée.

Les codes sont uniques dans le dossier et ne sont jamais réattribués après suppression. Les huit codes intégrés (`ACH`, `VTE`, `BQ`, `CA`, `OD`, `PA`, `ABO`, `CEN`) sont verrouillés ; le code d’un journal utilisateur est verrouillé dès qu’une écriture le référence. Un journal personnalisé portant des écritures ne peut pas être supprimé : il peut être désactivé pour conserver l’historique. Les créations, modifications et suppressions ont des droits de démonstration distincts (`journals.create`, `journals.edit`, `journals.delete`) et restent refusées par défaut aux profils non autorisés.

Les noms affichés suivent la forme « Libellé (CODE) » pour tous les journaux : Achats (`ACH`), Ventes (`VTE`), Banques (`BQ`), Caisse (`CA`), Opérations diverses (`OD`), Paie (`PA`), Abonnements (`ABO`), Centralisations (`CEN`), Amortissements automatiques (`AMO`) et Résultat de la période (`RPE`). Seuls `AMO` et `RPE` demeurent gérés par le système et non modifiables ; leur saisie manuelle et leur import sont bloqués. `ABO` et `CEN` sont des journaux standards dédiés, modifiables et utilisables selon les règles générales de saisie. Leur déclassification est migrée sans réécrire les pièces historiques. L’import générique de fichiers vers `CEN` reste bloqué : il est réservé au futur transfert interne entre dossiers PERFECTO. Les traitements spécialisés décrits ci-dessous restent à développer. La centralisation interne des lots Paie & RH et Ventes vers Paie (`PA`) et Ventes (`VTE`) reste distincte du futur processus `CEN` entre dossiers. La simulation linéaire d’immobilisations reste indicative et ne produit aucune écriture.

### Opérations de caisse en temps réel — première étape

Le sous-menu **Saisie → Opérations de caisse en temps réel** propose une saisie rapide d’encaissements et de décaissements au journal `CA`. Chaque opération crée une pièce équilibrée : un encaissement débite un compte de caisse de la famille `57` et crédite le compte de contrepartie ; un décaissement inverse les deux lignes. Le compte de caisse et sa contrepartie doivent être actifs, imputables et autorisés par le journal `CA`. La référence est proposée selon la séquence du journal ; la date doit appartenir au cycle et à une période ouverte.

Les soldes des caisses sont recalculés depuis toutes les écritures validées du cycle, jusqu’à la date choisie, et les brouillons sont exclus. L’aperçu avant/après signale un solde négatif sans bloquer arbitrairement l’opération. L’enregistrement en brouillon ne modifie pas les soldes ; seule la validation explicite ajoute la pièce au grand livre, avec les droits `draft.create` et `entry.validate` contrôlés séparément. Les opérations récentes du journal `CA` peuvent être consultées depuis la liste.

Cette étape est une actualisation immédiate **dans le stockage local du navigateur** ; elle ne constitue pas une synchronisation multi-utilisateur ou serveur. Les transferts entre deux caisses doivent passer par la saisie générale afin de traiter les deux comptes. Aucun calcul automatique de TVA, facture, paiement tiers ou rapprochement n’est effectué. L’interface de saisie reste réservée à l’ordinateur ou à la tablette ; sur téléphone, seul le menu Éditions est accessible.

### Comptes généraux et auxiliaires — synthèse mensuelle

Le sous-menu **Saisie → Mouvements des comptes généraux, tiers et analytiques → Comptes généraux et auxiliaires** présente à gauche l’arborescence des classes, sous-classes et comptes, avec les fiches fournisseurs, clients, débiteurs/créditeurs divers et personnel rattachées à leur compte collectif lorsqu’elles sont disponibles. La recherche et le filtre permettent de consulter les comptes généraux ou les fiches auxiliaires séparément.

Le panneau mensuel agrège les lignes, débits et crédits des seules écritures **validées** comprises dans le cycle comptable du dossier sélectionné. Les brouillons sont exclus ; les boutons de détail affichent les lignes source sans réécrire ni modifier les pièces. Les soldes sont calculés à partir des mouvements du cycle et présentés en débit/crédit. L’état de chaque mois et le bouton **Clôture** renvoient à la gestion des périodes du dossier : aucune clôture n’est stockée par compte ou par journal.

Les fiches auxiliaires sont des données de référentiel uniquement dans ce parcours. Les lignes comptables actuelles portent un compte général mais aucun identifiant individuel de fournisseur, client, tiers divers ou membre du personnel ; par conséquent, les mouvements mensuels et soldes auxiliaires sont explicitement affichés comme non disponibles et ne sont jamais déduits artificiellement du compte collectif. La saisie analytique explicite est disponible sur les lignes générales ; sa vue de mouvements filtre par nature, centre, journal et période, sépare les reliquats « À ventiler » et exclut les brouillons.

### Spécification métier à implémenter — abonnements (`ABO`)

Les abonnements doivent couvrir les charges et, selon le même principe, les produits ; les amortissements d’immobilisations restent hors abonnement puisqu’ils peuvent être calculés à tout moment. Deux cas de charges sont décrits :

- **Charge payée d’avance** : à la réception de la facture en exercice N, débiter le compte d’attente prévu pour les charges à répartir et créditer le fournisseur ou la trésorerie. Créer ensuite une pièce d’abonnement le premier de chaque mois de N+1, au débit du compte de charge concerné et au crédit du compte d’attente, jusqu’à apurement du montant réparti.
- **Charge périodique à facturer** : enregistrer mensuellement, avant l’arrivée de la facture, le débit du compte de charge et le crédit du compte de factures non parvenues. À réception, créditer le fournisseur, solder le compte de factures non parvenues pour l’estimation de la période, puis ajuster le compte de charge au débit ou au crédit selon l’écart au montant réel. Une pièce mensuelle est recommandée, même en cas de facturation trimestrielle ou annuelle, afin de suivre le résultat mensuel. Cette méthode s’applique aussi en cours d’exercice, pas uniquement à l’inventaire.

Les comptes exacts, la gestion des montants variables, le calendrier, la suspension et les contrôles d’approbation restent à définir avant l’automatisation ; aucun compte ou montant n’est déduit implicitement.

### Spécification métier à implémenter — centralisation entre dossiers (`CEN`)

Le traitement devra sélectionner un dossier d’origine et les journaux, la période et la nature des données à transférer : reports, marchés ou écritures comptables. Si les codifications diffèrent, un tableau de passage défini dans les paramètres assurera la correspondance entre les deux comptabilités. Le transfert s’effectuera entre dossiers PERFECTO de l’organisation ; il ne se confond ni avec l’import de fichiers tiers, ni avec les centralisations internes Paie & RH/Ventes déjà dirigées vers Paie (`PA`) et Ventes (`VTE`).

Les contrôles explicitement requis sont les suivants : refuser un nouvel import de reports si le dossier de destination contient déjà des reports ; refuser l’ajout de mouvements lorsque le journal de destination est déjà mouvementé pour la période centralisée. L’écran de sélection, la structure du tableau de passage, le sens précis de « reports » et « marchés », ainsi que le périmètre des contrôles par nature de données restent à préciser avant codage. Aucun déplacement d’écriture n’est encore effectué par ce journal.

Le journal `RAN` — Report à Nouveau a été retiré du registre automatique et son code est réservé pour éviter sa réattribution. À la migration, il est supprimé s’il ne contient aucune écriture ; s’il porte un historique, il est conservé sous « Ancien journal RAN (historique) », inactif et verrouillé, afin de ne pas laisser d’écritures orphelines. Les paramètres et l’historique des journaux sont isolés par dossier, enregistrés dans le stockage local et inclus dans les exports/restaurations JSON.

### Référentiel fournisseurs — évolution

Le sous-menu **Définitions → Fournisseurs** gère un répertoire local propre à chaque dossier client. Une fiche comprend un code proposé automatiquement (`FOU-0001`, etc.) et modifiable, la raison sociale, les coordonnées, l’IFU, le RCCM, un compte général collectif fournisseur de classe 4, le code auxiliaire individuel composé du compte et du code fournisseur, ainsi qu’un délai indicatif de règlement. Les fiches peuvent être recherchées, modifiées, archivées puis réactivées. La suppression définitive est réservée aux fiches non référencées par les écritures ; un code attribué reste réservé dans ce dossier.

Les données et l’historique des codes sont conservés dans la base locale du dossier et inclus dans la sauvegarde JSON. Les anciennes pièces et leurs montants ne sont jamais réécrits ; une suppression est refusée dès qu’une pièce ou un mouvement historique référence la fiche. Cette étape ne génère ni facture, ni paiement, ni mouvement tiers, lettrage ou solde auxiliaire. Les fichiers PERFECTO-AUXILIAIRE restent des échanges de fichiers : **seules les opérations provenant des modules PERFECTO internes pourront alimenter une centralisation**. L’interface est masquée sur le parcours téléphone, réservé aux Éditions en lecture seule.

### Répertoire clients — étape partielle

Le sous-menu **Définitions → Clients** gère par dossier un répertoire de tiers clients pour l’entreprise suivie. Il ne s’agit pas de la liste des entreprises clientes du cabinet : cette dernière reste le registre multi-dossiers ouvert avant le tableau de bord Comptabilité. Une fiche client contient un code `CLI` proposé automatiquement à l’enregistrement et modifiable, le nom/raison sociale, les coordonnées, l’IFU/RCCM, un compte collectif client de classe 4, un code auxiliaire individuel et un délai indicatif de règlement. La liste est recherchable ; les fiches peuvent être créées, modifiées et supprimées.

Les codes attribués, y compris les anciens codes modifiés ou supprimés, restent réservés dans le dossier. La suppression, le changement de code ou de compte collectif est refusé dès qu’une pièce (brouillon ou validée) ou un mouvement comptable référence le client ; un compte général collectif ne peut pas non plus être modifié ou supprimé tant qu’un client y est rattaché. Ces fiches ne créent pas de facture, règlement, lettrage, solde auxiliaire ni écriture. Les centralisations ne sont alimentées que par les modules PERFECTO internes, pas par un fichier d’échange ou un logiciel tiers. Le répertoire est exclu du parcours téléphone, limité à la consultation des Éditions.

### Prestations — référentiel local partiel

Le sous-menu **Définitions → Prestations** permet de tenir, dans chaque dossier, un catalogue simple de prestations avec code `PRE` proposé automatiquement (modifiable et jamais réattribué), désignation, description et état actif/archivé. La liste peut être recherchée et filtrée ; une fiche peut être modifiée, archivée, réactivée ou supprimée si aucune écriture ne la référence. Les codes et les fiches sont conservés localement par dossier, migrés sans réécrire les pièces et inclus dans les sauvegardes/restaurations JSON.

Ce premier incrément est un référentiel de définition uniquement : il ne fixe aucun prix, taux de TVA ou compte de produit, ne crée pas de facture et ne génère pas d’écriture. Le rattachement opérationnel au module **Ventes, stock & facturation** reste à construire après validation des règles métier.

### Débiteurs et créditeurs divers — étape partielle

Le sous-menu **Définitions → Débiteurs et créditeurs divers** réunit dans un seul registre les tiers classés « Débiteur divers » ou « Créditeur divers ». Le code est proposé selon le type (`DEB-0001`, `CRE-0001`), modifiable, et un code déjà attribué reste réservé dans le dossier, même après suppression ou changement de type. Chaque fiche comprend le nom/raison sociale, des coordonnées facultatives, un compte auxiliaire de la famille 47 (471 dans le plan fourni) et un identifiant auxiliaire individuel. La nature peut être changée tant qu’aucune pièce ne référence la fiche ; le code proposé suit alors le nouveau type.

La suppression et le changement de type, de code ou de compte collectif sont refusés si une pièce ou un mouvement comptable référence le tiers. Les informations descriptives restent modifiables sans réécrire l’historique. Ce registre ne saisit ni créance, ni dette, ni règlement, ni lettrage et n’alimente aucune centralisation ; celle-ci reste réservée aux modules PERFECTO internes.

### Personnel — répertoire local partiel

Le sous-menu **Définitions → Personnel** gère un annuaire professionnel isolé par dossier. Une fiche reçoit un code `PER` automatique/modifiable et peut contenir nom, fonction, service, coordonnées, notes professionnelles et compte auxiliaire de la famille 42. Les fiches peuvent être recherchées, modifiées et supprimées si aucune pièce ne les référence ; les codes attribués ne sont pas réutilisés.

Cet annuaire ne stocke ni rémunération, ni pièce d’identité, ni contrat, ne calcule pas la paie et ne remplace pas le module **Paie & RH**. Les centralisations de salaires continuent à dépendre exclusivement des lots internes approuvés de ce module.

### Localisation des immobilisations corporelles — référentiel partiel

Le sous-menu **Définitions → Localisation des immobilisations corporelles** permet de créer une arborescence propre au dossier : site, bâtiment, étage, local, zone, service ou tout niveau défini par l’organisation. Chaque fiche comporte un code `LOC` proposé automatiquement (modifiable et non réutilisé), un niveau librement modifiable, une désignation, un parent éventuel, une adresse/précision, un responsable/service et des notes. L’affichage en arbre et le choix du parent rendent la hiérarchie visible et éditable ; une boucle est refusée, et un emplacement parent ne peut être supprimé tant qu’il possède des enfants.

Les fiches sont conservées dans la base locale et la sauvegarde du dossier, sans écriture comptable. Les suppressions ou changements de code et de parent sont protégés lorsqu’une immobilisation y est référencée. Le registre **Éléments immobilisés** réutilise ces emplacements pour l’affectation physique.

### Éléments immobilisés — registre partiel

Le sous-menu **Définitions → Éléments immobilisés** gère un registre isolé par dossier pour les immobilisations corporelles, incorporelles et financières. La fiche comprend un code d’inventaire `IMMO` proposé automatiquement (modifiable et jamais réattribué), une désignation et une description, l’état (en service, en cours ou retiré), les dates d’acquisition et de mise en service, le coût en XOF, une valeur résiduelle estimée, la localisation issue du référentiel ci-dessus et des informations de suivi physique (détenteur, fabricant, modèle, numéro de série, fournisseur/provenance, référence de pièce, garantie, dernier inventaire et notes).

Les comptes associés sont proposés uniquement depuis le plan réellement chargé dans le dossier : classe 2 et familles correspondant à la nature du bien, comptes 283 ou 281 pour les amortissements cumulés et comptes de dotation de famille 68 pour les actifs amortissables. La fiche peut conserver une méthode « À définir / à valider », qui est la valeur proposée par défaut afin de ne présumer aucune règle fiscale. Les méthodes linéaire, dégressive, unités d’œuvre ou non amortissable sont disponibles avec leurs paramètres de durée, date de départ, taux ou unité lorsque pertinent. Une immobilisation financière ne peut pas recevoir une méthode amortissable dans ce référentiel.

Les fiches et l’historique des codes sont isolés par dossier et inclus dans les migrations, la sauvegarde et la restauration JSON. Les références aux mouvements ou écritures empêchent la suppression et protègent les principaux paramètres comptables et d’amortissement.

Le bouton **Prévisualiser le linéaire** fournit une simulation indicative, en lecture seule, limitée aux biens linéaires en service dont les paramètres sont complets et qui couvrent le cycle actif. Avant chaque simulation, l’utilisateur choisit explicitement entre le mois civil entier dès le mois de début et le prorata journalier exact (début inclus, fin exclue) ; aucune convention n’est présélectionnée. Les montants ne sont pas arrondis aux XOF entiers et restent affichés à titre indicatif. Les fiches non simulées sont accompagnées d’un motif.

Cette simulation n’enregistre aucun résultat, ne crée aucun mouvement ou plan comptable et ne génère ni ne valide d’écriture. Les méthodes dégressives et unités d’œuvre, les arrondis à appliquer, les cessions, le rapprochement avec les pièces d’acquisition et les règles comptables/fiscales doivent encore être cadrés et validés. Elle ne constitue pas un calcul réglementaire ni une valeur nette comptable officielle. Comme les autres fonctions de saisie, ce sous-menu est réservé à l’ordinateur ou à la tablette, et non au parcours téléphone en lecture seule.

### Éditions des immobilisations — consultation sans données extrapolées

Le sous-menu **Éditions → Immobilisations** conserve 17 éléments en six groupes. Le Tableau des immobilisations, le Tableau des amortissements et les douze états complémentaires disposent chacun d’une entrée et d’un parcours distincts de sélection, mise en page, aperçu plein écran et exports. Le filtre **Comptes `*`** couvre le plan comptable actuel et futur ; les filtres d’éléments et de localisations utilisent les codes explicitement présents au registre. Les fiches, entrées, localisations, cumuls et lignes de grand-livre ne reprennent que des champs du registre ou des écritures validées portant une référence d’immobilisation explicite et non ambiguë.

Les rapprochements d’ouverture, de période, d’entrées et de sorties ne disposent pas encore de sources permettant de comparer les soldes ou mouvements : les montants enregistrés et les écarts non vérifiables restent vides. Les états d’écarts sur entrées et sorties affichent **Comptes `*`**, **Jusqu’au** (fin du cycle par défaut) et les colonnes **Date**, **Montants enregistrés**, **Écart**. **Anomalies sur les éléments immobilisés** affiche **Comptes `*`**, **Éléments `*`** et **Compte**, **Élément**, **Journal**, **Date**, **Anomalie** ; aucune ligne n’est qualifiée sans critère enregistré. Les trois ventilations analytiques par centres de responsabilité, domaines d’activités et sources de financement restent grisées. Aucun amortissement, transfert, sortie, rapprochement ou montant non sourcé n’est inventé.

### Interopérabilité comptable — incrément v1

Le menu **Fichier** propose le format neutre `PERFECTO-ECHANGE` version 1 en classeur Excel `.xlsx` et en CSV UTF-8 compatible avec Excel. Le classeur réunit les feuilles Instructions, Dossier, Comptes, Journaux et Écritures. Une ligne de la feuille Écritures/du CSV représente une ligne de mouvement ; plusieurs lignes portant le même journal, date et référence sont regroupées en une pièce.

- L’export d’échange porte sur les écritures validées du cycle actif ; les brouillons en sont exclus. Le plan comptable et les journaux peuvent être exportés séparément.
- L’import CSV ou `.xlsx` présente un aperçu avant toute modification, permet d’associer les comptes et journaux sources aux référentiels du dossier, refuse les références en doublon et crée un point de restauration local avant d’ajouter le lot. Les macros et les formules ne sont pas exécutées ; les cellules de formules dans Écritures sont refusées.
- Le mode recommandé crée des brouillons. Le mode « écritures validées » contrôle l’équilibre et les périodes ouvertes et requiert le droit de validation.
- Le lot est ajouté au dossier actif ; il ne remplace pas les données présentes. Les comptes/journaux inconnus ne sont jamais créés automatiquement.
- L’import de balance générale utilise un format distinct `PERFECTO-BALANCE` v1 (CSV ou `.xlsx`). Il accepte les soldes nets par compte — un solde débiteur ou créditeur par ligne — et exige l’égalité des totaux. Après aperçu et correspondances, il crée une seule pièce de reprise dans le journal et à la date choisis ; la balance source n’est pas enregistrée comme un état séparé et les écritures existantes ne sont pas remplacées.
- La date de balance et le dossier/exercice source sont conservés comme contexte ; la date de comptabilisation est choisie pour le dossier cible. L’ajout se fait en brouillon par défaut, avec validation facultative selon les permissions et les contrôles de période.
- Les balances de mouvements, balances auxiliaires ou états financiers ne sont pas acceptées par le modèle `PERFECTO-BALANCE`. Le report à nouveau est un parcours distinct : il lit les reports et écritures validées d’un dossier antérieur enregistré, pas un fichier de balance.
- Le format commun est la première passerelle Excel/CSV, **pas encore un import direct des formats propriétaires** de Sage Comptabilité, PERFECTO historique, HYPERSOFT ou ODOO. Ces profils seront développés par version après réception et validation de fichiers d’exemple anonymisés.
- Le JSON de **Données & application** reste une sauvegarde/restauration native PERFECTO et ne doit pas être confondu avec un fichier d’échange.
- Les mouvements auxiliaires et soldes tiers, les données analytiques et le multidevise restent hors de ce premier incrément d’interopérabilité. Le référentiel fournisseurs est distinct des imports d’écritures et ne déclenche aucune centralisation. Les données sont lues et produites dans le navigateur ; aucun fichier n’est envoyé à un serveur.

### Pointage avec relevés bancaires génériques — première étape

Dans **Saisie → Pointage**, l’utilisateur peut importer un tableau CSV UTF-8 ou un classeur Excel `.xlsx` sans supposer de banque, de version ou de format propriétaire. Pour un classeur multi-feuilles, la feuille peut être choisie ; la ligne d’en-tête et les colonnes de date, libellé, référence, débit/crédit ou montant signé sont détectées puis restent modifiables. Une prévisualisation montre les lignes exploitables et celles à contrôler avant conservation. Les fichiers jusqu’à 5 Mo et 20 000 lignes sont pris en charge dans ce premier incrément.

Le rapprochement suggère des lignes comptables validées du compte de trésorerie choisi lorsqu’un montant, son sens et une date dans la tolérance sélectionnée correspondent. Un débit du relevé est comparé à un crédit du compte bancaire et inversement. Une référence ou un libellé proche ne sert qu’à ordonner les suggestions ; les critères et limites sont affichés, et chaque proposition doit être confirmée dans une boîte de dialogue avant d’ajouter un marqueur de pointage. Les doublons actifs de ligne de relevé ou de grand livre sont refusés. Les écritures, soldes et journaux ne sont jamais créés ou modifiés.

L’original et ses lignes normalisées sont enregistrés séparément par dossier dans IndexedDB, sans téléversement vers le serveur ; l’original peut être retéléchargé depuis l’écran. **Limite importante de la démo :** IndexedDB appartient au navigateur de cet appareil, pas à un compte authentifié ni à un espace cloud organisationnel. Aucune intégration Google Drive de PERFECTO n’est active, aucune synchronisation multi-appareil n’est fournie et ces fichiers ne sont pas inclus dans la sauvegarde JSON du grand livre. Le stockage cloud partagé devra être connecté et autorisé avant de présenter ce flux comme un stockage utilisateur/organisation réel. Les formats propriétaires bancaires, l’OCR des PDF/images, l’import automatique et les écritures de rapprochement restent hors périmètre.

### Reports à nouveau — premier incrément contrôlé

Dans **Saisie → Reports à nouveau**, la liste affiche compte, date, référence, débit, crédit et libellé. Un report manuel peut être inséré, modifié ou supprimé ; « Positionner » recherche un compte/libellé, « Imprimer » lance l’impression du registre et « Réparer » exécute un contrôle sans corriger automatiquement les montants. Les dates des reports sont fixées à la veille du début du cycle cible. Le registre est persisté séparément des écritures : aucune pièce ni aucun journal `RAN` n’est créé.

Le bouton **Lire les reports de l’exercice précédent** ne propose que les dossiers réellement enregistrés du même client et du même type comptable dont le cycle se termine exactement la veille du cycle actif. La lecture source ne change pas le dossier actif et n’écrit pas dans le dossier source. Le calcul reprend les reports de ce dossier et ses seules écritures validées de bilan (classes 1 à 5) ; brouillons et comptes de résultat 6 à 8 sont exclus. Aucun compte d’équilibre n’est inventé et un transfert déséquilibré ou un compte cible absent/incompatible est bloqué.

- Les comptes de bilan sont repris au solde net. Si le compte est auxiliaire/lettrable dans le dossier cible, le calcul détaille les lignes non lettrées disponibles ; les champs tiers, référence et échéance des reports existants sont conservés. Le prototype n’a pas de registre de factures/règlements : il ne peut donc pas déterminer les factures non soldées à partir des pièces seules.
- Pour la classe 5, les mouvements pointés sont présentés en solde agrégé et les mouvements non pointés restent détaillés. Les références de lettrage/pointage du dossier source déterminent cette distinction.
- Le transfert peut être relancé : un instantané par dossier source mémorise les soldes déjà transférés. Seuls les comptes dont le solde a changé sont remplacés ; si un compte devient lettrable ou pointable après le dernier transfert, supprimez manuellement toutes ses lignes de report puis relisez l’exercice précédent pour forcer le transfert du détail, même si le solde n’a pas changé. Un solde devenu nul retire également les anciennes lignes transférées. Les lignes ajoutées ou modifiées manuellement et celles provenant d’un autre dossier ne sont pas écrasées ; elles sont signalées pour contrôle. La source est relue avant validation et tout changement impose une nouvelle vérification de l’aperçu.
- Les lettrages et pointages de l’exercice courant restent intacts pendant un retraitransfert. Les ventilations analytiques restent des affectations explicites sur les lignes générales ; aucun calcul ni transfert par clé de répartition n’est lancé dans ce parcours.
- Un contrôle indicatif compare, par compte, les coûts bruts renseignés aux fiches d’immobilisation et les reports. Le registre ne suit pas les amortissements cumulés à l’ouverture ni l’historique complet des sorties : ces soldes doivent être rapprochés des pièces et justificatifs, sans règle ni correction inventée.
- Les données et le dernier état du transfert restent locaux au navigateur de démonstration ; aucune connexion Drive ou synchronisation serveur n’est active.

### Consolidation avant résultat — première étape

Le sous-menu **Fichier → Consolidation avant résultat** présente un journal groupé en lecture seule pour le dossier actif. L’utilisateur sélectionne une période comprise dans le cycle du dossier et, au besoin, un journal source ; les pièces validées sont regroupées par compte général avec leurs totaux débit/crédit et le solde net. Les brouillons et les pièces hors période sont exclus.

- Chaque ligne agrégée expose le nombre de mouvements sources et permet de consulter leurs provenances : date, journal, référence de pièce, numéro de ligne, système/module d’origine, référence et identifiant source lorsqu’ils existent.
- L’export CSV UTF-8 reprend les mouvements source, le compte de regroupement et les métadonnées de provenance afin de conserver une traçabilité ligne par ligne.
- L’équilibre est contrôlé au niveau de chaque pièce source et de la sélection totale. Une pièce invalide ou non équilibrée bloque la présentation/export de totaux qui pourraient induire en erreur.
- Cette première étape **ne calcule pas le résultat**, ne crée ni ne valide aucune écriture et ne modifie pas le grand livre. Les règles de toute consolidation après résultat ou d’éventuels traitements de clôture restent à définir séparément.

Le prototype ne suppose pas encore de consolidation multi-sociétés, d’élimination intragroupe, de retraitement fiscal ou de conversion de devises : ces opérations nécessiteraient des règles et un périmètre métier explicites.

### Consolidation après résultat — première étape

Le sous-menu **Fichier → Consolidation après résultat** réutilise le journal groupé par compte général et le détail de provenance de la consolidation avant résultat. Il filtre les écritures validées par dates et journal, contrôle l’équilibre et propose un export CSV détaillé, sans toucher au grand livre.

Cette première version ne détecte pas automatiquement la date ou la pièce d’arrêté du résultat, ne calcule pas ni n’affecte le résultat et ne génère aucune écriture de clôture. Elle regroupe les écritures validées présentes pour la période sélectionnée ; ces règles d’étape restent à préciser avant d’automatiser un traitement post-résultat.

### Recalcul du solde des comptes — première étape

Le sous-menu **Fichier → Recalcul du solde des comptes** recalcule, à la demande, les débits, crédits et soldes par compte à partir des seules écritures validées du cycle actif. Il contrôle l’équilibre des pièces, exclut les brouillons, signale les pièces validées hors cycle ou les comptes absents du plan, puis compare les résultats au calcul actuel de la balance générale. Un export CSV et une impression sont disponibles.

Dans le prototype, les soldes ne sont pas conservés dans un cache séparé : la balance est déjà calculée à partir des écritures à chaque consultation. Le recalcul est donc un contrôle indépendant et **ne modifie ni les soldes persistés, ni les pièces, ni le grand livre**. En cas d’anomalie, la correction doit passer par le parcours comptable prévu ; ce sous-menu ne répare pas la base.

### Réparation complète de la base — première version contrôlée

Le sous-menu **Fichier → Réparation complète de la base** analyse le dossier actif : structure des comptes et journaux, références et identifiants des pièces, dates et cycles, présence des comptes/journaux référencés, montants et équilibre des écritures validées, brouillons et registre des périodes. Les pièces hors cycle, doublons et anomalies sont listés pour examen.

Les seules réparations automatiques proposées portent sur les **métadonnées techniques** : reconstituer les mois manquants (ouverts, conformément au statut implicite actuel), fusionner les doublons de périodes sans rouvrir une période déjà clôturée et recalculer l’exercice dérivé du cycle. Un point de restauration local est créé avant toute écriture. Les comptes, journaux, pièces et montants validés restent intacts ; les anomalies comptables doivent être corrigées par le parcours normal ou par restauration d’une sauvegarde vérifiée.

Si le JSON local est illisible, PERFECTO le conserve sans l’écraser et bloque les saisies. Le sous-menu permet de télécharger la donnée brute, de restaurer un point local valide ou de réinitialiser explicitement le dossier après copie de récupération. Les données et copies de récupération restent dans le navigateur de l’utilisateur.

### Centralisation auxiliaire depuis les modules maison — à construire

Le sous-menu de centralisation auxiliaire reste **désactivé** jusqu’à l’intégration des modules PERFECTO internes qui produiront les mouvements de tiers (clients, fournisseurs, personnel et débiteurs/créditeurs divers). Lorsqu’elle sera construite, la centralisation lira ces données internes ; aucun fichier CSV/Excel ou logiciel tiers ne pourra l’alimenter.

Le format pivot `PERFECTO-AUXILIAIRE` v1 décrit un échange de mouvements auxiliaires, mais il n’est pas accepté comme source de centralisation dans l’application. Son analyse et son agrégateur sont conservés comme travaux de modèle/tests pour cadrer l’interopérabilité future, sans parcours utilisateur actif. Les adaptateurs natifs et le grand livre auxiliaire intégré restent également à construire.

### Paie & RH et centralisation des salaires — étape partielle

Les centralisations **entre modules PERFECTO** utilisent exclusivement les données des modules maison. Les formats CSV/Excel et adaptateurs tiers restent des parcours d’interopérabilité distincts.

Le module **Paie & RH** expose un registre interne de lots de paie isolé par dossier client. En démo, un lot fictif peut être créé pour une période du cycle, contrôlé puis approuvé ; il contient un journal comptable équilibré sans noms ni données personnelles.

La centralisation est **active dans Comptabilité générale → Fichier** : elle prépare une pièce du grand livre général, en brouillon par défaut. Ce traitement n’est pas analytique et ne crée aucune imputation, ventilation ni écriture analytique. Le statut partiel du module Paie & RH concerne ses fonctions RH et ses calculs métier, pas l’accès à cette opération générale.

- La centralisation consomme exclusivement un lot approuvé produit dans le module maison Paie & RH. Aucun fichier CSV/Excel ni logiciel tiers n’est accepté dans ce parcours.
- Le plan Paie & RH est comparé au plan comptable général du dossier ; les codes identiques sont seulement pré-sélectionnés. L’utilisateur examine le tableau visible et confirme explicitement les correspondances avant transfert ; toute modification réinitialise cette confirmation.
- Les débits et crédits sont agrégés séparément par compte cible et le lot crée une seule pièce dans le journal de paie `PA` par défaut.
- L’écriture est un brouillon par défaut, précédée d’un point de restauration local ; la provenance interne est conservée et un même lot ne peut pas être centralisé deux fois.
- Le registre démo n’effectue **aucun calcul de salaire, cotisation, impôt ou retenue légale**. La gestion des employés, contrats, règles de paie, validations RH et synchronisation multi-utilisateur restent à construire. Les montants présentés sont fictifs.

### Ventes, stock & facturation et centralisation des opérations — étape partielle

Le module **Ventes, stock & facturation** conserve localement, par dossier client, des lots d’opérations internes. En démo, un lot fictif regroupe une facture de vente et une réception d’approvisionnement avec leur journal comptable équilibré ; le lot doit être approuvé avant transfert.

La centralisation est **active dans Comptabilité générale → Fichier** : elle prépare une pièce du grand livre général, en brouillon par défaut. Ce traitement n’est pas analytique et ne crée aucune imputation, ventilation ni écriture analytique. Le statut partiel du module Ventes concerne ses fonctions de facturation, de fiscalité et de valorisation du stock, pas l’accès à cette opération générale.

- La centralisation lit exclusivement les lots approuvés du module maison. Aucun CSV/Excel, fichier tiers ou logiciel externe ne peut alimenter ce parcours.
- Le plan Ventes, stock & facturation est comparé au plan comptable général du dossier ; les codes identiques sont seulement pré-sélectionnés. L’utilisateur examine le tableau visible et confirme explicitement les correspondances avant transfert ; toute modification réinitialise cette confirmation.
- Les mouvements sont agrégés par compte cible dans une pièce générale unique, au journal Ventes (`VTE`) par défaut.
- Le brouillon est le mode par défaut ; la date, le journal, la référence, les permissions, l’équilibre, le point de restauration local et l’anti-doublon sont contrôlés.
- Le jeu d’exemple est fictif : **aucune facture réelle, TVA, marge, coût de revient, valorisation du stock ou règle fiscale n’est calculé**. Le cycle complet des clients, articles, tarifs, règlements, inventaires et retours reste à construire.

### Annulation d’une centralisation — première étape

Le sous-menu **Fichier → Annulation d’une centralisation** ne sélectionne que les écritures reliées aux flux internes PERFECTO de **Paie & RH** et de **Ventes, stock & facturation**. Une pièce issue d’Excel/CSV ou d’un logiciel tiers (Sage, PERFECTO historique, HYPERSOFT, ODOO, etc.) n’est pas éligible.

- Un brouillon de centralisation n’ayant pas d’effet sur le grand livre peut être supprimé avec le droit `draft.delete`. Le lot interne source reste intact et peut être retransféré ; la suppression conserve un point de restauration local.
- Une centralisation déjà validée n’est jamais modifiée ni supprimée. Son annulation crée une nouvelle pièce dont chaque débit/crédit est inversé, liée explicitement à la pièce d’origine et à son lot source ; le motif de l’annulation est obligatoire et conservé dans la provenance.
- Le droit dédié `centralization.cancel` est requis pour préparer l’écriture inverse. La validation immédiate requiert également `entry.validate` ; sinon, l’écriture inverse est créée en brouillon et prend effet seulement après validation dans les pièces comptables.
- La date de l’écriture inverse doit rester dans le cycle du dossier et une période ouverte. Si la période d’origine est clôturée, une date ouverte du cycle est proposée. Les références, comptes, équilibre, doublons et périodes sont contrôlés ; un point de restauration local précède l’ajout.
- Une seule écriture inverse est autorisée par pièce d’origine. Le brouillon inverse préparé est immuable ; s’il doit être corrigé avant validation, supprimez-le et recommencez avec un nouveau motif. Une annulation déjà préparée bloque une seconde tentative ; la pièce d’origine demeure visible et inchangée.

Cette étape est un prototype local de navigateur, pas un journal d’audit multi-utilisateur de production. Les annulations concurrentes, l’identité réelle du valideur et l’audit serveur devront être conçus avec le stockage partagé de l’organisation.

En-tête stable de la feuille `Ecritures` et du CSV : `FORMAT;VERSION;SYSTEME_SOURCE;REFERENCE_DOSSIER;EXERCICE;CODE_JOURNAL;LIBELLE_JOURNAL;DATE;REFERENCE_PIECE;LIBELLE_PIECE;CODE_COMPTE;LIBELLE_COMPTE;CLASSE_COMPTE;NATURE_COMPTE;DEBIT_XOF;CREDIT_XOF;STATUT_SOURCE;ID_SOURCE`. Les colonnes peuvent être réordonnées, mais pas supprimées ni renommées dans cette version. Les montants sont des entiers sans séparateurs ; `ID_SOURCE` est répété sur chaque ligne de la même pièce.

En-tête stable de la feuille `Balance` et du modèle CSV : `FORMAT;VERSION;SYSTEME_SOURCE;REFERENCE_DOSSIER;EXERCICE;DATE_BALANCE;REFERENCE_BALANCE;CODE_COMPTE;LIBELLE_COMPTE;SOLDE_DEBITEUR_XOF;SOLDE_CREDITEUR_XOF;ID_SOURCE`. Une ligne par compte, sans solde nul ni doublon de compte source. Les métadonnées doivent être identiques sur toutes les lignes ; `ID_SOURCE` peut être laissé vide partout ou rempli avec la même valeur.

En-tête proposé pour la feuille `Auxiliaire` et le modèle CSV d’interopérabilité (non utilisé par une centralisation active) : `FORMAT;VERSION;SYSTEME_SOURCE;REFERENCE_DOSSIER;EXERCICE;REFERENCE_LOT;CODE_JOURNAL_SOURCE;DATE_SOURCE;REFERENCE_PIECE_SOURCE;LIBELLE_PIECE_SOURCE;CODE_COMPTE_GENERAL;LIBELLE_COMPTE_GENERAL;CODE_AUXILIAIRE;LIBELLE_AUXILIAIRE;LIBELLE_MOUVEMENT;DEBIT_XOF;CREDIT_XOF;ID_SOURCE`. `REFERENCE_LOT` est identique sur tout le fichier ; `ID_SOURCE` est obligatoire et unique par ligne. Les informations auxiliaires sont fournies ensemble ou laissées vides. Saisir les codes et références comme texte pour préserver les zéros initiaux.

### Règles métier appliquées

- référence de pièce unique ;
- comptes existants uniquement ;
- débit **ou** crédit par ligne, jamais les deux ;
- au moins deux lignes mouvementées ;
- équilibre obligatoire avant validation définitive ;
- une pièce validée est immuable ;
- les brouillons sont exclus des états ;
- une période clôturée refuse les nouvelles pièces et la validation des brouillons.

### Politique d’accès de démonstration

Le refus est appliqué par défaut. Le Superviseur général administre son organisation de démonstration ; les profils gestionnaire et utilisateur/employé ne reçoivent aucun droit par leur rôle. Les droits peuvent être accordés par personne, module, organisation ou identifiant de dossier client, et action. Toute action comptable exige aussi le droit de consulter le module dans le même grant et la même portée. Plusieurs grants par module se cumulent sans transférer une action d’un dossier client à un autre.

Un dossier désigne une entreprise cliente enregistrée pour traitement. Le module Comptabilité ouvre d’abord la liste des dossiers autorisés ; l’ouverture d’une entreprise conduit ensuite à son tableau de bord. La création définit le nom du client, un code de dossier éditable, le type de comptabilité et les dates de début/fin du cycle. L’adresse, le N° IFU, le N° RCCM, l’email et le téléphone peuvent être ajoutés facultativement. La référence suit le format `CODETYPE-CODECLIENTANNÉE` : Cabinet Godwin, comptabilité révisée (`COR`), code `GOD` et exercice 2026 donnent `COR-GOD2026`. Le code est saisi explicitement et reste modifiable ; aucune règle automatique n’est imposée depuis le nom. L’unicité de la référence est vérifiée.

La navigation comptable présente les huit rubriques demandées à gauche, avec les sous-menus en onglets verticaux et les éléments de niveau inférieur en listes. Une fonction disponible ouvre le parcours existant ; une fonction générale non développée porte l’état « À construire ». Le Suivi Analytique est une entrée du launcher intégrée à la Comptabilité générale : elle ouvre le référentiel analytique du dossier actif et partage ses droits. Les mouvements et états analytiques ne seront activés qu’après raccordement des ventilations explicites aux lignes comptables ; aucun calcul ou transfert n’est supposé. Sur téléphone, l’accès est limité à la consultation des éditions (balance, journal et grand livre) ; la saisie et la création de dossiers se font sur ordinateur ou tablette.

Chaque dossier a des données comptables isolées dans le navigateur. Le jeu historique principal et ses écritures sont conservés ; une migration protégée met à jour le référentiel SYSCOHADA vers 1 400 codes, actualise uniquement les valeurs standard encore inchangées, préserve les personnalisations et conserve les comptes absents du nouveau PDF comme historiques, sans modifier les écritures validées. Tout nouveau dossier démarre sans recopier les écritures historiques, avec le référentiel complet. Le moteur garde les périodes mensuelles dans les bornes du cycle et refuse les nouvelles écritures hors cycle. Les cycles non calendaires sont pris en charge ; cette version limite un cycle à 18 mois. Le registre de dossiers migre les métadonnées héritées tout en conservant les anciennes clés et données comptables. Cette simulation reste côté client : elle n’est ni une sécurité réelle ni une authentification, ne se synchronise pas avec Google Drive et ne prend pas en charge l’écriture simultanée multi-utilisateur.

### Données de démonstration

Le dossier principal conserve ses 18 comptes de démonstration historiques en plus des 1 400 comptes du référentiel fourni, 8 journaux standards (dont `ABO` et `CEN`), 2 journaux système (`AMO` et `RPE`), 3 pièces validées et 1 brouillon. Les comptes historiques restent identifiables et utilisables pour assurer la continuité ; aucune référence ni aucun montant des pièces validées n’est réécrit. Les mouvements validés restent équilibrés à **2 832 000 XOF** au débit comme au crédit ; le résultat de démonstration reste de **242 000 XOF**. Le registre des dossiers clients et chaque jeu comptable sont persistés dans `localStorage`. Chaque nouveau dossier reçoit le plan de comptes, les journaux et les périodes de son cycle, sans écritures recopiées. Les profils et leurs grants de démonstration restent temporaires et ne survivent pas au rechargement.

## Lancer en local

Aucune installation, aucun `npm install` :

```bash
python3 -m http.server 8080
# puis ouvrir http://localhost:8080/modern-proto/
```

Un simple double-clic sur `modern-proto/index.html` fonctionne aussi (le service worker
est alors désactivé, ce qui est sans conséquence).

## Déployer sur Vercel

1. Importer le dépôt dans Vercel.
2. Laisser le framework sur **Other** et ne renseigner aucune commande de build.
3. Régler le **Root Directory** sur `modern-proto` (configuration historique du
   projet) **ou** sur la racine du dépôt `.` : les deux fonctionnent.

C'est tout : les chemins sont relatifs, il n'y a ni `vercel.json`, ni `builds`, ni
`functions`, ni `services` — donc plus aucune source d'erreur de configuration.
`service-worker.js` accompagne l'application dans `modern-proto/`, ce qui corrige le
404 observé auparavant. À la racine, un `index.html` de redirection prend le relais
si le Root Directory est `.`.

> **Important — quota Vercel.** Quatre projets sont connectés au dépôt (`perfect`,
> `modern-proto`, `projetperfectys-modern-proto`, `projetperfectys-pwa`) et chacun
> déclenche un déploiement à chaque push. Le compte a atteint la limite de
> déploiements (« Deployment rate limited — retry in 24 hours »). Pour retrouver un
> déploiement fiable : conserver le seul projet utile (`perfect`), supprimer les
> doublons dans Vercel, puis relancer un déploiement après réinitialisation du quota.
> Le projet `perfect` a son Root Directory sur `modern-proto` : cette structure est
> donc conservée.

## Publier aussi sur GitHub Pages (optionnel)

Le dépôt contient le workflow `.github/workflows/pages.yml`. Pour l'utiliser :

1. **Settings → Pages → Source : GitHub Actions** ;
2. onglet **Actions → Deploy prototype to GitHub Pages → Run workflow**.

Le site est alors publié sur `https://dionisse.github.io/projetperfectys/`. Ce
workflow est volontairement manuel : sans Pages activé, il ne peut pas créer le site
lui-même.

## Structure

```
index.html                    redirection vers modern-proto/ (déploiement racine)
modern-proto/index.html        coquille de l'application (navigation, topbar)
modern-proto/css/modern.css    identité GOBEX (papier, encre, vert canard et or doux), responsive et imprimable
modern-proto/css/fixed-asset-overview-report.css mise en page responsive et impression du tableau des immobilisations
modern-proto/css/fixed-asset-depreciation-report.css mise en page du tableau des amortissements et impression responsive
modern-proto/css/fixed-asset-additional-reports.css sélection, fiches, tableaux responsives et impression des états complémentaires des immobilisations
modern-proto/css/financial-framework-edition.css style responsive, aperçu et impression de l’édition Cadre comptable
modern-proto/css/balance-items-edition.css style responsive, aperçu et impression de l’édition Postes du Bilan
modern-proto/css/accounting-plan-edition.css style responsive, sélection, aperçu et impression de l’édition Plan comptable
modern-proto/js/accounting-chart.js référentiel SYSCOHADA v2 de 1 400 codes, classes, pages PDF et compatibilité v1
modern-proto/js/accounting-plan-edition-report.js filtre et restitution en lecture seule du plan courant du dossier
modern-proto/js/accounting-framework.js transcription réutilisable du cadre SYSCOHADA révisé (532 lignes, postes Débit/Crédit)
modern-proto/js/accounting-framework-edition-report.js filtres et restitution en lecture seule du cadre comptable dans Éditions
modern-proto/js/accounting-balance-items.js transcription fidèle des 92 postes et 166 lignes du PDF source
modern-proto/js/balance-items-edition-report.js filtre par poste et restitution des lignes du PDF sans affectation ajoutée
modern-proto/js/store.js       dossiers clients, cycles, migration du plan comptable, données isolées, règles métier, calculs, import/export
modern-proto/js/modules.js     catalogue déclaratif des modules du launcher
modern-proto/js/permissions.js politique d’accès démo (refus par défaut)
modern-proto/js/accounting-navigation.js  menus, sous-menus et états d’activation du Lot 1
modern-proto/js/fixed-asset-overview-report.js lecture seule du registre d’immobilisations, filtres et colonnes sans mouvements inventés
modern-proto/js/fixed-asset-depreciation-report.js état des amortissements depuis les champs explicites du registre, sans calcul de dotation/VNC
modern-proto/js/fixed-asset-additional-reports.js douze états d’immobilisations, compte/élément/localisation, références explicites et montants/écarts non sourcés laissés vides
modern-proto/js/accounting-exchange.js lecture et export comptable CSV/XLSX ; lecteur de tableaux génériques
modern-proto/js/bank-statement.js normalisation locale des relevés et suggestions sans pointage automatique
modern-proto/js/bank-statement-storage.js stockage IndexedDB de démonstration, non connecté à Drive
modern-proto/js/account-movements.js    arborescence, filtres et agrégats des comptes généraux et auxiliaires
modern-proto/js/centralization-cancellation.js  contrôle des sources internes et construction d’écritures inverses
modern-proto/js/app.js         routeur, vues multi-dossiers, formulaires et interactions comptables
BACKLOG.md                     décisions confirmées et étapes prévues
modern-proto/manifest.webmanifest  métadonnées PWA
modern-proto/service-worker.js cache hors ligne (réseau d'abord, cache en secours)
modern-proto/icon-192.png      icônes de l'application
modern-proto/icon-512.png
tests/store.test.js            tests des règles métier (Node, sans dépendance)
tests/account-movements.test.js tests de synthèse mensuelle et de cohérence avec le grand livre
tests/workspaces.test.js       tests de migration, références, cycles et isolation des dossiers clients
tests/account-lifecycle.test.js cycle de vie des comptes, clients, fournisseurs, tiers divers et personnel
tests/confidential-accounts.test.js comptes confidentiels, masquage des écritures et isolation par dossier
tests/table-design-system.test.js style partagé des tableaux comptables et compatibilité hors ligne
tests/bank-statement.test.js lecture, mappage XOF et suggestions de relevés non comptabilisantes
tests/fixed-asset-additional-reports.test.js filtres, sources explicites et limites des douze états complémentaires
tests/fixed-asset-additional-reports-ui.test.js navigation, sélection, aperçu plein écran, exports et cache
```

## Tests

La suite complète, sans dépendances à installer :

```bash
npm test
```

Les tests couvrent les règles comptables, la transcription exhaustive des 532 lignes du cadre comptable (codes, intitulés, pages et rattachements Débit/Crédit, y compris les cases vides) et des 92 postes/166 lignes du PDF Postes du Bilan (compte rendu à 167 avec l’en-tête, sans poste ajouté), les migrations, les références et le cycle de vie sécurisé des comptes et des répertoires clients, fournisseurs, débiteurs/créditeurs divers et personnel, les codes réservés, les cycles et l’isolation des dossiers clients, le masquage des comptes confidentiels et des pièces qui les contiennent, le catalogue modulaire, la politique d’accès de démonstration (refus par défaut, organisation, actions et portée par identifiant de dossier), la hiérarchie du menu, le style partagé des tableaux, les relevés tabulaires, les tableaux des immobilisations, l’annulation des centralisations internes, le refus des écritures non persistées et l’installation du cache PWA complet. La CI GitHub Actions exécute désormais la suite complète `npm test`, en plus du contrôle de syntaxe et du test de service HTTP.

## Limites de cette prévisualisation

La connexion et le launcher sont des écrans de démonstration : il n'y a pas encore
d'authentification réelle ni de connexion à Google Drive. Un point de restauration
local conserve le dernier état comptable avant une modification, mais reste dans le
même navigateur et ne remplace pas une sauvegarde externe indépendante. Il n'y a pas non plus de
synchronisation multi-utilisateur ; les dossiers et leurs données comptables restent
locaux dans le navigateur et ne sont pas partagés entre appareils. Le premier import
CSV/XLSX de relevés conserve les fichiers dans IndexedDB local, et non dans un compte
utilisateur/organisation ou un Google Drive connecté. Les profils bancaires propriétaires,
l’OCR de PDF/images, le rapprochement entièrement automatisé, l’extourne générale,
les exports PDF/Excel et les états financiers SYSCOHADA complets restent à construire.
Le lettrage et le pointage disponibles constituent des registres séparés, sans écriture
comptable. Le prototype valide le parcours avant la
conception du stockage partagé et de l'authentification.
