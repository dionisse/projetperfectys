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

## 4. Sécurité et architecture de données

Les informations bancaires, familiales, les photos, CV, évaluations et données disciplinaires sont sensibles. En production, le stockage navigateur actuel ne suffit pas. Le module devra s’appuyer sur un stockage serveur protégé avec chiffrement en transit et au repos, contrôle d’accès par organisation, dossier, rôle et action, journal d’audit, sauvegardes testées, gestion des pièces privées et politique de conservation validée.

Les droits seront séparés : administration des dossiers, consultation RH, gestion des contrats, accès bancaire, notation, discipline, calcul, approbation et centralisation comptable. Un accès à la Comptabilité ne donnera pas automatiquement accès aux profils RH.

Les dix fiches « Employé fictif » de `PRH-TEST-2026` resteront des identifiants de test liés à ce dossier. Elles ne contiennent pas de salaire, de coordonnées bancaires ni de données personnelles réelles et ne serviront pas à produire des résultats de paie.

## 5. Feuille de route par lots et critères de validation

### Lot 0 — Cadrage pays, règles et processus RH

Confirmer les catégories d’emploi et d’intérim, conventions applicables, sources officielles, rubriques et responsabilités de validation pour le Bénin. Définir les étapes d’embauche, de mission, d’affectation et de débauchage au sens défini ci-dessus. Le débauchage sera traité comme un départ de l’entreprise, sans cause présumée ni effet financier automatique.
**Critère de passage :** aucun paramètre légal actif sans source, date d’effet et approbateur identifié ; motifs et circuits de validation configurés avant usage.

### Lot 1 — Structure, affectations et missions

Créer les directions, départements, sections, services et unités personnalisées. Gérer les affectations datées, leur historique, les missions opérationnelles et, si demandé, les déplacements professionnels.
**Critère :** chaque affectation et mission est liée au bon dossier RH ; une nouvelle affectation ne modifie pas les périodes précédentes ; aucun remboursement ni indemnité n’est calculé sans règle approuvée.

### Lot 2 — Dossier employé et documents

Créer, modifier et archiver une fiche complète, avec rattachement obligatoire au dossier RH ; gérer CV, compétences, photo facultative, informations bancaires et familiales selon les droits, ainsi que les pièces privées et les évaluations.
**Critère :** les employés de `PRH-TEST-2026` sont visibles uniquement dans ce dossier ; les accès aux données bancaires, disciplinaires et d’évaluation sont contrôlés et audités.

### Lot 3 — Congés et absences

Créer le catalogue configurable des congés annuels, maternité, paternité, maladie, accident et autres types décidés par l’entreprise. Gérer demandes, justificatifs, approbations, calendrier et historique. Paramétrer les droits, durées et effets sur la paie uniquement après validation.
**Critère :** aucun droit, décompte de jour ou traitement salarial n’est attribué par défaut ; les demandes sont rattachées à l’employé et au dossier RH.

### Lot 4 — Embauche, contrats, intérim et débauchage

Implémenter les étapes documentaires validées, les contrats datés, les missions intérimaires et le processus de départ pour licenciement ou tout autre motif. Conserver les historiques et gérer la clôture d’accès.
**Critère :** aucun dossier employé n’est supprimé à son départ ; aucun préavis, indemnité ou solde de départ n’est calculé sans règle du pays et du contrat validée.

### Lot 5 — Variables et moteur pilote Bénin

Saisir les éléments de période, intégrer les congés approuvés et implémenter progressivement l’impôt, les cotisations, assurances et parts employeur à partir des règles validées. Comparer les résultats à des cas de référence approuvés.
**Critère :** résultats reproductibles, détail vérifiable, tests de frontière et refus du calcul si une règle manque.

### Lot 6 — Contrôle, approbation et bulletins

Gérer brouillon, contrôles, approbation, verrouillage, bulletins et historiques de corrections.
**Critère :** impossible de modifier silencieusement un lot approuvé.

### Lot 7 — Paiement, déclarations et centralisation

Ajouter les suivis de paiement et états réglementaires confirmés, puis la centralisation comptable facultative avec correspondances explicites.
**Critère :** pas de paiement déclaré sans preuve source ; pas de centralisation sans lien, droits, aperçu et confirmation.

## 6. Points de cadrage restant à valider avant les calculs réels

- Quelles catégories de contrat et de travailleurs intérimaires faut-il couvrir en premier ?
- Pour chaque type de congé, quelles conditions d’éligibilité, durées, règles d’acquisition et de décompte, pièces, validations, reports et effets sur la paie faut-il retenir ? Quelles sources béninoises confirmeront ces paramètres ?
- Pour le congé accident, quelles distinctions et pièces doivent être suivies entre accident du travail et autre accident ?
- Quelles conventions et sources officielles béninoises utiliser pour le pack pilote, et qui valide leurs versions ?
- Quels motifs de départ, étapes d’approbation et documents de sortie l’entreprise souhaite-t-elle suivre ?
- Les missions couvrent-elles les missions opérationnelles, les déplacements professionnels, ou les deux ? Qui les approuve ?
- Quels critères et quelle échelle de notation des performances, et qui peut consulter les informations disciplinaires ?
- Quelles informations familiales sont réellement nécessaires au calcul ?
- Quel processus d’approbation et de paiement souhaite l’entreprise ?

**Prochaine étape recommandée :** valider le cadrage du Lot 0, puis implémenter les lots 1 à 4 avant de calculer le moindre montant de paie. Le plan reste évolutif : les idées et besoins complémentaires pourront y être ajoutés et validés avant le démarrage des lots de calcul.
