# Proposition d’implémentation — Paie & RH

**Version :** proposition de cadrage · 1er novembre 2026
**Périmètre pilote :** Bénin, avec dossier RH distinct du dossier de Comptabilité générale.

## 1. Objectif

Construire un module de gestion du personnel et de paie fiable, contrôlable et extensible à plusieurs pays. Le dossier Paie & RH est le périmètre propriétaire des employés, contrats, évaluations, éléments de paie et bulletins. Chaque employé doit porter une référence explicite au dossier RH client (`dossierId`) : l’appartenance ne sera jamais déduite du nom de l’entreprise, d’un dossier comptable ou d’un code ressemblant.

Le dossier de Comptabilité générale reste indépendant. Une centralisation n’est possible qu’après association comptable explicitement choisie, correspondances de comptes validées et confirmation de l’utilisateur.

## 2. Périmètre fonctionnel

### 2.1 Organisation de l’entreprise, configurable par l’utilisateur

L’utilisateur pourra créer, modifier, archiver et ordonner les unités de son entreprise, sans structure imposée :

- directions ;
- départements ;
- sections ;
- services ;
- autres types et niveaux définis par l’utilisateur.

Chaque unité aura un identifiant, un libellé et éventuellement un code, un parent et des dates d’effet. La structure devra pouvoir évoluer sans déplacer ni réécrire l’historique d’un employé. Un employé pourra être affecté à une unité et à une fonction, avec historique des changements.

### 2.2 Profil complet de l’employé

Chaque fiche sera liée à un dossier client Paie & RH et comportera, selon les droits et la nécessité :

- identité et coordonnées ; identifiant employé unique dans le dossier ;
- état du dossier : candidat, actif, suspendu, sorti ou autre état configuré ;
- unité, fonction, responsable, lieu de travail et historique des affectations ;
- missions confiées et historique de leurs périodes, objets, lieux, responsables et états ;
- contrats, dates d’effet, catégorie d’emploi et pièces justificatives ;
- parcours professionnel, CV, formations, compétences et qualifications acquises ;
- informations bancaires nécessaires au paiement ;
- informations familiales utiles à la paie, dont le nombre d’enfants si le régime validé l’exige ;
- photo facultative et pièces jointes privées.

Les champs « autres informations utiles » seront configurables, mais soumis à une finalité, des droits d’accès et une durée de conservation : pas de collecte libre illimitée. Le nombre d’enfants sera préféré aux données nominatives détaillées des enfants, sauf nécessité légale confirmée.

### 2.3 Recrutement, embauche, intérim et débauchage (départ)

Le parcours de recrutement et d’entrée couvrira : candidature, décision, pièces reçues, contrat, affectation initiale, date d’entrée et contrôles avant la première paie.

Conformément à votre définition, **le débauchage désigne dans PERFECTO la sortie de l’employé de l’entreprise**, qu’elle résulte d’un licenciement ou de toute autre raison. Ce parcours sera distinct de l’embauche et permettra d’enregistrer la date d’effet, le motif, les validations, les documents remis, les actions de clôture et les éléments restant à traiter. Les motifs pourront inclure, selon la nomenclature retenue par l’entreprise, licenciement, démission, fin de contrat ou de mission, retraite, décès, transfert ou autre motif. Ces catégories ne déclencheront aucune conséquence légale ou financière tant que celle-ci n’aura pas été validée.

L’historique de l’employé et ses bulletins seront conservés ; sa fiche ne sera pas supprimée. Les droits et accès seront clôturés à la date appropriée. Les préavis, indemnités, congés dus, régularisations et soldes de départ ne seront calculés qu’à partir des règles du pays et du contrat validées.

Les travailleurs intérimaires auront une catégorie dédiée et des champs configurables pour l’agence ou l’employeur concerné, l’entreprise utilisatrice, la mission, le service d’affectation et les dates. Le début et la fin de mission seront historisés. Les responsabilités des parties, pièces requises et règles de paie devront être confirmées pour le pays concerné avant activation.

### 2.4 Affectations et missions

Une **affectation** décrira le rattachement de l’employé à une direction, un département, une section, un service ou une autre unité créée par l’utilisateur, ainsi qu’à une fonction, un lieu et un responsable. Elle comportera des dates d’effet et un historique : une nouvelle affectation ne remplacera pas les anciennes.

Une **mission** sera un enregistrement distinct et pourra correspondre à une mission opérationnelle temporaire ou, si l’entreprise le souhaite, à un déplacement professionnel. Elle pourra préciser l’objet, l’employé ou l’équipe concernée, le demandeur et l’approbateur, l’unité d’origine et de destination, le lieu, les dates, le statut, les consignes et le compte rendu ou justificatifs. Les indemnités, avances et remboursements associés resteront désactivés tant que les règles et autorisations de l’entreprise et du pays ne seront pas définies. Une mission ne modifiera pas automatiquement le contrat ni la rémunération.

### 2.5 Performance, discipline et compétences

La fiche comportera des espaces distincts et traçables pour :

- objectifs et évaluations de performance : période, critères, évaluateur, éléments factuels, appréciation et plan de progrès ;
- discipline : faits datés, pièces, étapes de traitement, réponse de l’employé et statut ;
- réalisations et compétences : expérience, formations, certifications, projets ou acquis documentés.

Une note globale ne sera pas calculée automatiquement. Les critères, échelles et effets éventuels sur la rémunération ou la carrière devront être définis et validés. Les données disciplinaires et d’évaluation auront des droits plus restrictifs que les informations administratives courantes.

### 2.6 Congés et absences

Le module permettra de définir des types de congé par pays et de les adapter aux règles internes de l’entreprise. Le catalogue pourra comprendre les congés annuels, maternité, paternité, maladie, accident, événements familiaux, congé sans solde et d’autres types créés par l’utilisateur. Ces intitulés ne préjugent pas de leurs conditions légales ; leurs règles devront être confirmées pour chaque pays et leur période d’application.

Pour chaque type, le paramétrage pourra préciser, après validation : les conditions d’éligibilité, le mode de décompte, les droits et leur acquisition, la rémunération ou indemnisation, les justificatifs requis, le circuit d’approbation, les reports ou plafonds éventuels, l’effet sur la paie et les sources applicables. Aucun nombre de jours, taux, droit acquis ou effet financier ne sera supposé par défaut.

Une demande de congé conservera l’employé et son dossier RH, le type, les dates, le statut, le décideur et les pièces privées nécessaires. Les statuts pourront couvrir la préparation, la demande, l’approbation, le refus, l’annulation et la clôture. Le calendrier de travail et les jours à décompter devront être définis pour le dossier concerné ; le système ne déduira pas les jours ouvrés, fériés ou de repos sans calendrier validé.

Les parcours maternité et paternité seront identifiables séparément et pourront suivre leurs périodes et pièces propres une fois les règles validées. Le congé lié à un accident distinguera l’accident du travail d’une maladie ou d’un accident non professionnel si la règle applicable le requiert. Les informations médicales seront réduites au strict nécessaire et leur accès fortement limité ; les détails médicaux ne seront pas affichés dans les vues générales du personnel.

La paie consommera les congés approuvés comme des événements datés et tracés. La rémunération maintenue, les retenues, indemnités, remboursements d’assurance ou parts employeur ne seront calculés qu’à partir de règles vérifiées et versionnées. Une modification rétroactive d’un congé ou d’une règle devra produire un contrôle et une correction explicites, jamais une réécriture silencieuse d’un bulletin approuvé.

### 2.7 Calcul de paie par pays

Un moteur de calcul commun utilisera des **packs de règles par pays**, datés et versionnés. Le Bénin sera le pays pilote et le pays proposé par défaut à la création d’un dossier ; l’utilisateur pourra choisir un autre pays lorsque son pack sera disponible.

Pour chaque pays, les règles à configurer et valider couvriront notamment :

- éléments de rémunération et traitement des primes, avantages, absences et retenues ;
- base imposable et calcul de l’impôt sur salaire ;
- cotisations sociales et assurances ;
- parts salariales et parts employeur ;
- plafonds, seuils, exonérations, arrondis, prorata et dates d’effet ;
- états, échéances et justificatifs requis, selon les obligations confirmées.

Aucun taux, plafond, assiette ou compte comptable ne sera préchargé sans source officielle identifiable et validation métier/juridique. Chaque résultat conservera la version du pack utilisé et le détail des étapes de calcul. Une règle modifiée ne changera pas rétroactivement un bulletin approuvé.

## 3. Cycle de paie mensuel proposé

1. Ouvrir la période dans le dossier RH et vérifier les employés et contrats actifs à la date considérée.
2. Charger les congés et absences approuvés qui chevauchent la période ; vérifier leurs dates, leur statut et les règles de traitement en vigueur.
3. Recueillir les autres variables et pièces justificatives.
4. Produire un brouillon explicable, avec détail brut, bases, retenues, impôts, cotisations salariales, cotisations employeur et net à payer — uniquement pour les règles validées.
5. Afficher les anomalies et empêcher l’approbation si un contrôle bloquant échoue.
6. Faire contrôler puis approuver par des profils autorisés différents, si la politique du client l’exige.
7. Générer les bulletins et états après approbation ; enregistrer les paiements sans fabriquer de preuve bancaire.
8. Verrouiller la période. Toute correction passe par une procédure de réouverture ou de régularisation tracée.
9. Si l’association comptable existe, prévisualiser la pièce de centralisation et les correspondances, puis demander confirmation. Conserver l’identifiant du lot source pour bloquer les doublons.

## 4. Navigation indépendante et menus Paie & RH

Paie & RH aura son propre parcours de navigation, sa propre sélection de dossier RH, sa barre latérale et ses menus — indépendants de ceux de la Comptabilité générale et du Suivi Analytique. L’application pourra réutiliser les principes d’interface déjà éprouvés dans la Comptabilité (dossier actif clairement visible, menus et sous-menus cohérents, filtres, états, permissions et impressions), mais **ne réutilisera pas la navigation comptable**. L’arborescence et les critères d’acceptation détaillés sont dans [la fiche de cadrage de l’étape 2](cadrage-paie-rh-etape-2-navigation.md).

### Menus proposés

1. **Dossiers RH** — créer, sélectionner et consulter les dossiers client Paie & RH.
2. **Organisation** — directions, départements, sections, services et unités personnalisées.
3. **Personnel** — fiches employés, recrutement, contrats, intérim, départs/débauchage, CV, pièces, évaluations et discipline.
4. **Affectations & missions** — affectations datées, missions opérationnelles et déplacements si activés.
5. **Temps, congés & absences** — calendriers, demandes, approbations, congés et historiques.
6. **Paie** — éléments variables, préparation des lots, calcul, contrôles, approbation et clôture.
7. **Centralisation comptable** — association explicite du dossier comptable, correspondances de comptes, aperçu, transfert et historique des centralisations.
8. **Registres** — registres RH et de paie : employés, contrats, affectations, congés, lots, bulletins, paiements et transferts.
9. **États** — tableaux de suivi et états calculés à partir des données source et des règles validées.
10. **Éditions** — bulletins, registres et états imprimables, PDF ou exports dont les formats auront été définis.
11. **Paramètres** — pays et versions de règles, calendriers, rubriques, circuits de validation, types de congé et permissions.

Les registres conserveront les données opérationnelles Paie & RH ; les états en fourniront une lecture calculée et traçable ; les éditions permettront leur consultation ou impression. Ces vues ne créeront pas à elles seules de données métier. Le menu **Centralisation comptable** restera un parcours distinct : il n’écrira dans la Comptabilité générale qu’après sélection explicite de la destination, configuration des correspondances, aperçu et confirmation. Les corrections d’écritures comptables continueront à suivre le parcours comptable existant.

## 5. Sécurité et architecture de données

Les informations bancaires, familiales, les photos, CV, évaluations et données disciplinaires sont sensibles. En production, le stockage navigateur actuel ne suffit pas. Le module devra s’appuyer sur un stockage serveur protégé avec chiffrement en transit et au repos, contrôle d’accès par organisation, dossier, rôle et action, journal d’audit, sauvegardes testées, gestion des pièces privées et politique de conservation validée.

Les droits seront séparés : administration des dossiers, consultation RH, gestion des contrats, accès bancaire, notation, discipline, calcul, approbation et centralisation comptable. Un accès à la Comptabilité ne donnera pas automatiquement accès aux profils RH.

Les dix fiches « Employé fictif » de `PRH-TEST-2026` resteront des identifiants de test liés à ce dossier. Elles ne contiennent pas de salaire, de coordonnées bancaires ni de données personnelles réelles et ne serviront pas à produire des résultats de paie.

## 6. Plan complet d’implémentation en 18 étapes

Les étapes sont séquentielles là où elles dépendent les unes des autres. La sécurité, la traçabilité et les tests sont transversaux, puis vérifiés à nouveau lors de l’étape 18. Aucun calcul réel ne commence avant la validation des règles du pays pilote.

### Étape 1 — Cadrage métier et règles du pays pilote

Le cadrage initial est consigné dans [la fiche de l’étape 1](cadrage-paie-rh-etape-1.md). Le pilote est mensuel et les conventions seront sélectionnées selon la catégorie de l’employé. Les règles juridiques et les sources hors CGI restent à documenter et valider pour le Bénin.
**Jalon :** périmètre et choix internes identifiés ; sources officielles et responsables de validation réunis ; aucune règle légale inventée ou activée implicitement.

### Étape 2 — Navigation indépendante Paie & RH

Construire la route, la barre latérale et les menus propres à Paie & RH, sans reprendre ceux de la Comptabilité générale ou du Suivi Analytique. L’arborescence proposée, les parcours, les permissions de navigation et les critères d’acceptation sont définis dans [la fiche de l’étape 2](cadrage-paie-rh-etape-2-navigation.md).
**Jalon :** chaque menu ouvre une vue Paie & RH dans le contexte RH actif ; les permissions et retours de navigation restent dans ce module ; Centralisation comptable est un pont explicite, pas une reprise des menus comptables.

### Étape 3 — Dossiers RH et isolation

Créer, sélectionner et configurer les dossiers clients Paie & RH, leur référence PRH, pays, cycle et utilisateurs autorisés. Les identifiants, associations comptables facultatives, règles d’isolation, cycle de vie et critères d’acceptation sont détaillés dans [la fiche de cadrage de l’étape 3](cadrage-paie-rh-etape-3-dossiers.md). Chaque donnée RH sera liée à un identifiant de dossier RH.
**Jalon :** les employés, congés, lots et documents d’un dossier ne sont pas visibles dans un autre ; aucun rattachement comptable automatique.

### Étape 4 — Organisation de l’entreprise

Permettre à l’utilisateur de créer et organiser directions, départements, sections, services et unités personnalisées. Le modèle, les opérations, l’isolation et les critères de validation sont détaillés dans [la fiche de cadrage de l’étape 4](cadrage-paie-rh-etape-4-structure.md).
**Jalon :** structure modifiable et historisée, sans hiérarchie imposée ni réécriture des affectations passées.

### Étape 5 — Profil complet et documents employés

Créer les fiches reliées au dossier RH : identité, contacts, banque, informations familiales utiles, photo facultative, CV, formations, compétences, évaluations et pièces. Encadrer spécialement les champs bancaires, médicaux, familiaux et disciplinaires.
**Jalon :** droits d’accès contrôlés ; les dix fiches génériques de `PRH-TEST-2026` restent liées à ce seul dossier.

### Étape 6 — Recrutement, embauche, contrats et intérim

Gérer le recrutement et l’entrée, contrats datés, catégories d’emploi, documents et dossiers de travailleurs intérimaires/agences.
**Jalon :** un statut ou contrat détermine l’éligibilité uniquement selon des règles configurées et validées.

### Étape 7 — Débauchage et départ de l’entreprise

Gérer le licenciement et toute autre raison de sortie : motif, date d’effet, approbations, pièces, clôture des accès et éléments à régulariser. Conserver l’historique plutôt que supprimer la fiche.
**Jalon :** aucun préavis, indemnité, congé dû ou solde de départ calculé sans règles du pays et du contrat validées.

### Étape 8 — Affectations et missions

Gérer les affectations datées à une unité, fonction, lieu et responsable, ainsi que les missions opérationnelles et, si retenu, déplacements professionnels.
**Jalon :** historique consultable ; les remboursements et indemnités de mission restent inactifs tant que leurs règles ne sont pas validées.

### Étape 9 — Congés et absences

Gérer congés annuels, maternité, paternité, maladie, accident et autres types configurables : demandes, calendriers, pièces, validation, acquisition et historique.
**Jalon :** aucun droit, durée, décompte ou effet salarial présumé ; congé accident et données médicales traités selon des règles d’accès validées.

### Étape 10 — Rémunérations et variables

Configurer les composantes de rémunération et recueillir les éléments variables de période avec leur source et justificatif. Distinguer saisie, validation et calcul.
**Jalon :** aucune valeur de rémunération fictive dans les dossiers réels ; absence de justificatif ou de règle signalée avant calcul.

### Étape 11 — Packs de règles par pays

Mettre en place l’architecture versionnée multi-pays et compléter en premier le pack béninois : impôt sur salaire, cotisations sociales, assurances, parts employeur, plafonds, assiettes, arrondis et dates d’effet.
**Jalon :** chaque règle active a une source officielle, une période de validité, un approbateur et des cas de référence.

### Étape 12 — Moteur de calcul et lots de paie

Calculer les éléments du lot à partir des contrats, variables, congés approuvés et pack de règles. Expliquer chaque ligne et conserver la version des sources de calcul.
**Jalon :** calcul reproductible, équilibré selon les règles définies et bloqué lorsqu’une donnée ou règle indispensable manque.

### Étape 13 — Contrôles, approbation et clôture

Mettre en place anomalies, contrôles de cohérence, rôles de validation, approbation, verrouillage, correction et réouverture tracées.
**Jalon :** aucun lot approuvé ne peut être modifié silencieusement ; toute correction conserve l’historique.

### Étape 14 — Bulletins et suivi des paiements

Générer les bulletins après approbation et suivre le statut de paiement avec les références réellement fournies par l’utilisateur.
**Jalon :** aucun bulletin final avant validation ; aucun paiement déclaré sans source ou preuve.

### Étape 15 — Registres RH et de paie

Créer les registres consultables et filtrables des employés, contrats, affectations, missions, congés, variables, lots, bulletins, paiements et transferts.
**Jalon :** chaque ligne est traçable à son dossier et à sa source ; registres en lecture seule sauf parcours métier dédié.

### Étape 16 — États et tableaux de suivi

Produire les états RH et de paie confirmés : effectifs, congés, rémunérations, impôts, cotisations et parts employeur, selon les règles validées.
**Jalon :** chaque total explique sa période, son périmètre, ses filtres et ses données source ; aucun état ne fabrique de solde.

### Étape 17 — Éditions, impressions et exports

Concevoir les éditions imprimables ou exportables : bulletins, registres et états ; les formats d’export seront définis avant réalisation.
**Jalon :** éditions cohérentes avec le filtre et l’état sélectionnés, protégées selon la sensibilité des données.

### Étape 18 — Centralisation comptable et recette intégrée

Finaliser le menu dédié à la centralisation : association explicite entre dossiers RH et comptable, correspondances validées, aperçu, confirmation, historique et prévention des doublons. Tester le parcours complet avec profils autorisés, jeux fictifs, règles validées et scénarios d’erreur.
**Jalon :** aucune écriture n’est créée sans lien choisi, correspondances, droits et confirmation ; les corrections comptables restent dans la Comptabilité générale.

## 7. Points de cadrage restant à valider avant les calculs réels

- Quelles catégories de contrat et de travailleurs intérimaires faut-il couvrir en premier ?
- Pour chaque type de congé, quelles conditions d’éligibilité, durées, règles d’acquisition et de décompte, pièces, validations, reports et effets sur la paie faut-il retenir ? Quelles sources béninoises confirmeront ces paramètres ?
- Pour le congé accident, quelles distinctions et pièces doivent être suivies entre accident du travail et autre accident ?
- Quelles conventions et sources officielles béninoises utiliser pour le pack pilote, et qui valide leurs versions ?
- Quels motifs de départ, étapes d’approbation et documents de sortie l’entreprise souhaite-t-elle suivre ?
- Les missions couvrent-elles les missions opérationnelles, les déplacements professionnels, ou les deux ? Qui les approuve ?
- Quels critères et quelle échelle de notation des performances, et qui peut consulter les informations disciplinaires ?
- Quelles informations familiales sont réellement nécessaires au calcul ?
- Quel processus d’approbation et de paiement souhaite l’entreprise ?

**Prochaine étape recommandée :** valider l’étape 1, puis avancer dans l’ordre prévu. Les menus et dossiers RH indépendants sont cadrés dès les étapes 2 et 3 ; aucun montant réel ne sera calculé avant l’étape 12, après validation des règles du Bénin à l’étape 11. Le plan reste évolutif : les idées et besoins complémentaires pourront y être ajoutés et validés avant le démarrage des lots de calcul.
