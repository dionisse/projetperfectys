# Étape 6 — Recrutement, embauche, contrats et intérim

**Statut :** proposition de cadrage à valider avant implémentation.  
**Dépendances :** dossier RH (étape 3), structure organisationnelle (étape 4), profil employé (étape 5). Les menus généraux de l’étape 2 demeurent à valider séparément.  
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Définir les parcours de recrutement et d’embauche, le registre des contrats et catégories de personnel, ainsi que le suivi des travailleurs intérimaires et des agences. Chaque dossier candidat, employé, contrat ou mission sera lié explicitement au dossier RH client concerné ; aucun rattachement ne sera déduit d’un nom ou d’un dossier de Comptabilité générale.

Cette étape cadre les données et les processus. Elle ne fixe pas les règles légales béninoises, ne détermine pas automatiquement la validité d’un contrat et ne calcule ni paie, ni indemnité, ni cotisation. Les textes officiels et décisions de l’entreprise devront être fournis et validés avant activation des règles correspondantes.

## 2. Recrutement et candidature

### 2.1 Parcours configurable

Proposition de parcours dont les libellés et étapes pourront être adaptés :

1. besoin de recrutement ouvert et autorisé ;
2. candidature reçue ;
3. examen et entretiens, si applicables ;
4. décision en attente, retenue ou non retenue ;
5. offre ou proposition transmise, acceptée, refusée ou retirée ;
6. contrôles et pièces d’entrée ;
7. embauche confirmée, avec date d’effet et création/lien vers la fiche employé.

Ces états sont des repères de gestion, pas des statuts légaux. L’entreprise déterminera les étapes requises, les rôles habilités et les pièces demandées. Une candidature ne sera pas considérée comme embauche et n’ouvrira pas à elle seule un droit à la paie.

### 2.2 Données candidat

Limiter les données à ce qui est nécessaire à l’offre et au processus : identité et coordonnées utiles, poste ou besoin concerné, dates et étapes de candidature, CV ou pièces volontairement recueillies, échanges pertinents et décision motivée selon la politique autorisée. Les évaluations de sélection seront accessibles aux seuls rôles concernés.

Une candidature non retenue ou abandonnée ne sera pas convertie en employé. Les règles de conservation, suppression ou anonymisation des candidatures devront être définies avant production ; aucun délai ne sera inventé. Les pièces candidat ne seront pas automatiquement versées au dossier employé : l’utilisateur choisira celles à conserver et vérifiera leur exactitude.

### 2.3 Passage à l’embauche

Lors d’une décision d’embauche, proposer de créer une fiche employé dans le dossier RH actif ou de lier la candidature à une fiche existante après contrôle de doublon. Confirmer explicitement le dossier RH, l’identité, la date d’entrée, la catégorie de personnel, l’unité ou l’affectation initiale si connue, et le contrat associé.

Le passage n’écrasera pas l’historique de candidature. Toute création ou association sera traçable. Les champs obligatoires, vérifications d’identité et pièces à obtenir resteront paramétrables selon les exigences validées.

## 3. Contrats et catégories de personnel

### 3.1 Registre contractuel

Un contrat sera un enregistrement lié à `employeeId` et au même `dossierId`, distinct de la fiche maître. Champs proposés, selon nécessité et validation :

- référence interne, catégorie d’emploi et intitulé du poste ;
- dates de signature, de début d’effet et, lorsqu’elle est définie, de fin ;
- statut de suivi (préparation, en attente, actif, terminé, annulé ou autre statut configuré) ;
- durée ou périodicité indiquée dans la pièce, sans interprétation juridique automatique ;
- unité, fonction, lieu et responsable associés à l’entrée ou au changement ;
- pièces contractuelles, avenants, décisions et date de dépôt ;
- source ou référence de la règle validée, si une règle de paie ou d’éligibilité dépend du contrat.

Les types et catégories (par exemple permanent, temporaire, apprenti ou autre) seront une nomenclature configurable, à valider par le client et selon les textes applicables. Les exemples ne préjugent pas des catégories légales béninoises. Un champ de catégorie ne produira pas à lui seul une conséquence légale, salariale ou sociale.

### 3.2 Historique, renouvellements et changements

Un avenant, renouvellement, changement de catégorie ou nouvelle période sera conservé comme événement ou version datée, lié au contrat concerné. La modification ne réécrira pas silencieusement les données ayant servi à une période de paie ou à un bulletin approuvé. Les changements rétroactifs déclencheront un contrôle et une correction explicite selon le processus défini.

Le système pourra signaler une échéance prochaine uniquement si les dates sont renseignées et la règle d’alerte configurée. Une alerte ne signifie pas que le contrat est renouvelé ou juridiquement expiré. Les conséquences d’une fin de contrat relèvent du parcours de départ (étape 7), et non d’une clôture automatique.

### 3.3 Éligibilité à la paie

La date et le statut du contrat pourront alimenter un contrôle de préparation, mais aucun statut n’activera automatiquement une paie tant que les règles d’éligibilité ne sont pas définies et validées. Les contrôles devront rendre visibles les périodes sans contrat, les contrats en attente et les données manquantes, sans fabriquer une rémunération ou une relation contractuelle.

## 4. Travail intérimaire et agences

Créer un registre distinct des relations avec les agences et des mises à disposition, si l’entreprise confirme ce besoin. Le modèle devra pouvoir relier, sans présumer du rôle juridique des parties :

- l’agence ou le prestataire concerné et ses coordonnées professionnelles ;
- le travailleur et, si nécessaire, son dossier séparé ou sa référence chez l’agence ;
- l’entreprise utilisatrice et le dossier RH client où la mission est suivie ;
- les dates prévues et réelles, le poste ou besoin, l’unité d’accueil, le responsable et les pièces ;
- l’accord ou document de mise à disposition, son statut et les validations internes.

Il faudra décider si un intérimaire doit être représenté comme employé PERFECTO dans le dossier RH de l’entreprise utilisatrice, comme personne liée à une agence, ou selon les deux cas. Aucune duplication de fiche ne sera faite implicitement. Le lien à la paie de l’agence ou à une rémunération directe ne sera pas présumé : les parties responsables, les pièces, la facturation, les paiements et les règles applicables doivent être confirmés avant tout automatisme.

Les missions d’intérim et les missions opérationnelles internes restent des objets distincts. Une mission ne modifie pas le contrat ou la rémunération et ne déclenche aucun calcul automatique.

## 5. Documents, droits et audit

Les documents de candidature, d’embauche, contrats et avenants seront rattachés au bon dossier et à la bonne personne ou relation. Le type, les dates, le niveau de confidentialité et une date de validité éventuelle pourront être enregistrés. Les alertes d’expiration ne seront activées qu’après définition d’une règle applicable.

Les droits distingueront au minimum la consultation et la modification des candidatures, contrats et pièces confidentielles. Les actions importantes (décision, conversion en employé, changement de contrat ou de dates, accès/modification de pièces sensibles) seront journalisées selon la politique à définir. Les listes générales n’exposeront pas le contenu des documents privés.

## 6. Décisions à valider avant réalisation

- Quelles étapes de recrutement et quels rôles de décision l’entreprise souhaite-t-elle utiliser ?
- Quelles catégories de personnel et quels types de contrats faut-il gérer au Bénin, au regard des textes que vous fournirez ?
- Quelles données et pièces sont nécessaires à la candidature, à l’embauche et au suivi contractuel, et qui y accède ?
- Quelle référence de contrat employer : code saisi, séquence par dossier RH ou autre méthode ?
- Comment tracer les avenants, renouvellements, suspensions et périodes qui se chevauchent ?
- Quelle durée et quelle procédure de conservation/suppression appliquer aux candidatures non retenues ?
- Pour l’intérim, qui est l’employeur contractuel et payeur dans les cas que l’entreprise rencontre ? Le travailleur aura-t-il aussi une fiche employé dans le dossier RH utilisateur ?
- Quelles alertes d’échéance, validations et contrôles préalables à la paie l’entreprise souhaite-t-elle, et qui les approuve ?

## 7. Critères d’acceptation proposés

1. Chaque candidature, contrat et relation d’intérim est relié explicitement au bon dossier RH ; les contrôles empêchent les liens croisés non autorisés.
2. Le recrutement reste distinct de l’employé : seul un passage confirmé crée ou associe une fiche, sans perdre l’historique de candidature.
3. Les contrats et changements sont datés et historisés ; une nouvelle version ne remplace pas les données antérieures utilisées.
4. Les catégories et statuts n’entraînent aucune conséquence légale ou de paie sans règle validée.
5. Le suivi des intérimaires n’invente ni la partie employeur, ni le payeur, ni une paie ou une facture.
6. Documents privés, décisions et changements sensibles sont soumis à des permissions et à une traçabilité définies.
7. Aucun dossier candidat ou contractuel, taux, échéance légale, montant ni donnée personnelle réelle n’est inventé dans les jeux de test.

**Étape suivante du plan :** l’étape 7 cadrera le départ de l’entreprise (« débauchage » selon votre définition), sans calcul de préavis, indemnité ou solde avant validation des règles applicables.