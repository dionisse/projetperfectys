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
- unité, fonction, responsable et historique des affectations ;
- contrats, dates d’effet, catégorie d’emploi et pièces justificatives ;
- parcours professionnel, CV, formations, compétences et qualifications acquises ;
- informations bancaires nécessaires au paiement ;
- informations familiales utiles à la paie, dont le nombre d’enfants si le régime validé l’exige ;
- photo facultative et pièces jointes privées.

Les champs « autres informations utiles » seront configurables, mais soumis à une finalité, des droits d’accès et une durée de conservation : pas de collecte libre illimitée. Le nombre d’enfants sera préféré aux données nominatives détaillées des enfants, sauf nécessité légale confirmée.

### 2.3 Recrutement, embauche, intérim et départ

Le parcours couvrira le recrutement et l’entrée : candidature, décision, pièces reçues, contrat, affectation, date d’entrée et contrôle des informations nécessaires avant la première paie.

Les travailleurs intérimaires seront pris en charge avec une catégorie dédiée et des champs configurables pour l’agence ou l’employeur concerné, la mission, l’entreprise utilisatrice, le service d’affectation et les dates. La responsabilité de chaque partie, les pièces à recueillir et les règles de paie devront être confirmées pour le pays concerné avant activation.

Le système prévoira aussi la sortie ou fin de mission : motif catégorisé, date d’effet, éléments à régulariser, documents remis et clôture des accès. Aucun solde de tout compte ni indemnité ne sera calculé sans règle validée.

> **Terme à confirmer :** j’interprète « règles de débauchage » comme les règles d’embauche et d’entrée du salarié. Si le terme désigne le recrutement d’une personne déjà employée par une autre entreprise, ce cas sera cadré séparément et soumis à validation juridique ; aucune règle de non-concurrence ou de débauchage ne sera inventée.

### 2.4 Performance, discipline et compétences

La fiche comportera des espaces distincts et traçables pour :

- objectifs et évaluations de performance : période, critères, évaluateur, éléments factuels, appréciation et plan de progrès ;
- discipline : faits datés, pièces, étapes de traitement, réponse de l’employé et statut ;
- réalisations et compétences : expérience, formations, certifications, projets ou acquis documentés.

Une note globale ne sera pas calculée automatiquement. Les critères, échelles et effets éventuels sur la rémunération ou la carrière devront être définis et validés. Les données disciplinaires et d’évaluation auront des droits plus restrictifs que les informations administratives courantes.

### 2.5 Calcul de paie par pays

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
2. Recueillir les variables et pièces justificatives.
3. Produire un brouillon explicable, avec détail brut, bases, retenues, impôts, cotisations salariales, cotisations employeur et net à payer — uniquement pour les règles validées.
4. Afficher les anomalies et empêcher l’approbation si un contrôle bloquant échoue.
5. Faire contrôler puis approuver par des profils autorisés différents, si la politique du client l’exige.
6. Générer les bulletins et états après approbation ; enregistrer les paiements sans fabriquer de preuve bancaire.
7. Verrouiller la période. Toute correction passe par une procédure de réouverture ou de régularisation tracée.
8. Si l’association comptable existe, prévisualiser la pièce de centralisation et les correspondances, puis demander confirmation. Conserver l’identifiant du lot source pour bloquer les doublons.

## 4. Sécurité et architecture de données

Les informations bancaires, familiales, les photos, CV, évaluations et données disciplinaires sont sensibles. En production, le stockage navigateur actuel ne suffit pas. Le module devra s’appuyer sur un stockage serveur protégé avec chiffrement en transit et au repos, contrôle d’accès par organisation, dossier, rôle et action, journal d’audit, sauvegardes testées, gestion des pièces privées et politique de conservation validée.

Les droits seront séparés : administration des dossiers, consultation RH, gestion des contrats, accès bancaire, notation, discipline, calcul, approbation et centralisation comptable. Un accès à la Comptabilité ne donnera pas automatiquement accès aux profils RH.

Les dix fiches « Employé fictif » de `PRH-TEST-2026` resteront des identifiants de test liés à ce dossier. Elles ne contiennent pas de salaire, de coordonnées bancaires ni de données personnelles réelles et ne serviront pas à produire des résultats de paie.

## 5. Feuille de route par lots et critères de validation

### Lot 0 — Cadrage pays et règles

Confirmer les catégories de salariés, conventions applicables, sources officielles, rubriques et responsabilités de validation pour le Bénin. Définir le processus d’embauche/intérim/départ et le sens attendu de « débauchage ».  
**Critère de passage :** aucun paramètre légal actif sans source, date d’effet et approbateur identifié.

### Lot 1 — Structure organisationnelle

Créer les directions, départements, sections, services et unités personnalisées ; affecter un employé à une unité avec historique.  
**Critère :** un changement d’unité ne modifie pas les périodes antérieures.

### Lot 2 — Dossier employé et documents

Créer, modifier et archiver une fiche complète, avec rattachement obligatoire au dossier RH ; gérer CV, compétences, photo facultative et pièces privées.  
**Critère :** les employés de `PRH-TEST-2026` sont visibles dans ce dossier seulement ; aucune donnée de test ne fuit vers un autre dossier.

### Lot 3 — Embauche, contrats, intérim et sortie

Implémenter les étapes et contrôles documentaires validés, les contrats datés et les missions intérimaires.  
**Critère :** un employé ne figure dans un calcul que si son contrat et son statut le rendent éligible selon les règles approuvées.

### Lot 4 — Variables et moteur pilote Bénin

Saisir les éléments de période et implémenter progressivement l’impôt, les cotisations, assurances et parts employeur à partir des règles validées. Comparer les résultats à des cas de référence approuvés.  
**Critère :** résultats reproductibles, détail vérifiable, tests de frontière et refus du calcul si une règle manque.

### Lot 5 — Contrôle, approbation et bulletins

Gérer brouillon, contrôles, approbation, verrouillage, bulletins et historiques de corrections.  
**Critère :** impossible de modifier silencieusement un lot approuvé.

### Lot 6 — Paiement, déclarations et centralisation

Ajouter les suivis de paiement et états réglementaires confirmés, puis la centralisation comptable facultative avec correspondances explicites.  
**Critère :** pas de paiement déclaré sans preuve source ; pas de centralisation sans lien, droits, aperçu et confirmation.

## 6. Décisions à confirmer avant les calculs réels

- « Débauchage » signifie-t-il ici **embauche/recrutement**, ou bien recrutement depuis un autre employeur ?
- Quelles catégories de contrat et de travailleurs intérimaires faut-il couvrir en premier ?
- Quelles conventions et sources officielles béninoises utiliser pour le pack pilote, et qui valide leurs versions ?
- Quels critères et quelle échelle de notation des performances, et qui peut consulter les informations disciplinaires ?
- Quelles informations familiales sont réellement nécessaires au calcul ?
- Quel processus d’approbation et de paiement souhaite l’entreprise ?

**Prochaine étape recommandée :** valider le cadrage du Lot 0, puis implémenter le Lot 1 et le Lot 2 avant de calculer le moindre montant de paie.
