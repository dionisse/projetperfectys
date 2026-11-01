# Étape 8 — Affectations et missions

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** dossiers RH (étape 3), structure organisationnelle configurable (étape 4), profil employé (étape 5), contrats et embauche (étape 6), départ (étape 7). La validation des menus de l’étape 2 reste reportée.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Gérer l’historique des rattachements professionnels des employés à une unité, une fonction, un lieu et un responsable, ainsi que des missions opérationnelles datées. Une affectation décrit la place ou le rattachement professionnel de l’employé pendant une période ; une mission décrit une activité ou un déplacement ponctuel. Ces notions restent distinctes des contrats, des congés, des dossiers comptables et des éléments de rémunération.

Les unités proviennent de la structure créée par le client dans le même dossier RH. Aucune direction, fonction, affectation, mission, dépense ou indemnité ne sera déduite automatiquement d’un nom, d’un organigramme ou d’un dossier de Comptabilité générale.

## 2. Affectations

### 2.1 Contenu d’une affectation

Chaque enregistrement d’affectation pourra inclure, selon le besoin :

- identifiant stable, `employeeId` et `dossierId` ;
- unité organisationnelle choisie dans le dossier RH courant, facultative si elle n’est pas connue ou utilisée ;
- fonction ou intitulé du poste ;
- lieu de travail ou site, selon une nomenclature que le client pourra définir ;
- responsable, s’il y en a un, lié à un employé du même dossier ;
- dates d’effet de début et de fin, avec dates inconnues possibles pendant la préparation ;
- motif ou source du changement, commentaire et pièce justificative si nécessaire ;
- état de suivi et personne ayant enregistré ou approuvé le changement.

La structure organisationnelle est libre : l’affectation référence l’unité choisie, sans imposer un parcours direction → département → section → service. La fonction reste distincte du type d’unité. Une affectation peut être préparée sans unité ou responsable si ces données ne sont pas encore définies.

### 2.2 Changements et historique

Une mutation, promotion, changement de responsable, de fonction ou de lieu donnera lieu à un nouvel enregistrement daté ou à une version conservée. Le changement ne remplacera pas l’historique antérieur. Toute correction après prise d’effet conservera l’auteur, la date de modification, la valeur précédente et la justification requise par la politique retenue.

Les unités archivées ne seront pas proposées pour une nouvelle affectation ; les affectations historiques liées à ces unités resteront consultables. Une réorganisation future ne réécrira pas les périodes passées.

Les chevauchements de dates ou les périodes manquantes pourront déclencher une alerte à examiner. Aucun chevauchement ne sera silencieusement fusionné ni utilisé pour inférer une double fonction, une promotion ou un changement de rémunération. Les règles de dates (inclusion du dernier jour, gestion des périodes inconnues) sont à confirmer.

## 3. Missions

### 3.1 Mission opérationnelle

Le registre pourra décrire une mission ponctuelle :

- objet, référence et description des résultats attendus ;
- employé ou équipe concernés, enregistrés par liens explicites dans le dossier RH ;
- demandeur, responsable de mission et approbateur, selon les rôles définis ;
- dates et lieux prévus, unité d’origine ou de destination si utile ;
- consignes, état de suivi, compte rendu et pièces justificatives ;
- dates réelles et résultat, saisis ou confirmés par une personne autorisée.

Les états pourront être configurés à partir d’étapes de gestion telles que préparation, soumise, approuvée, en cours, terminée, annulée ou refusée. Ils ne valent pas validation juridique ou financière. Les changements d’une mission et les validations ou annulations seront historisés.

Une mission d’équipe conservera le lien vers chaque participant concerné : une seule ligne agrégée ne doit pas masquer à quel employé elle s’applique. Le système ne créera pas automatiquement une affectation durable du fait d’une mission.

### 3.2 Déplacements professionnels

La prise en charge des déplacements pourra être ajoutée comme type ou parcours distinct si l’entreprise le confirme. Le formulaire pourrait alors suivre les dates, l’itinéraire ou les lieux, le motif, l’autorisation et les justificatifs. Cette fiche ne fixe pas les règles de transport, d’avance, de frais, de remboursement, de per diem, de fiscalité ou d’indemnité : aucun montant ne sera calculé, créé ou imputé automatiquement sans politique et sources validées.

Les missions d’intérim ou de mise à disposition restent gérées dans le contexte défini à l’étape 6 ; elles ne créent pas implicitement une relation d’emploi ou une mission interne équivalente.

## 4. Coordination avec les autres dossiers RH

- Une affectation est liée au dossier RH de l’employé et à une unité appartenant à ce même dossier.
- Une mission peut référencer une ou plusieurs affectations, mais conserve ses propres dates et son propre statut.
- Un congé ou une absence approuvée pourra être signalé comme conflit de calendrier quand l’étape 9 et les règles de calendrier seront définies ; aucun conflit ne sera résolu automatiquement.
- Le départ de l’entreprise clôt les nouvelles affectations à partir de la date confirmée, sans effacer les affectations historiques. Le traitement des missions en cours devra être explicitement décidé.
- Les contrats restent la source de référence pour la relation contractuelle et leurs dates ; une affectation ne peut prolonger ou modifier un contrat.
- Les informations pourront être partagées avec d’autres fonctions uniquement par liens explicites et permissions vérifiées, sans créer d’écriture comptable.

## 5. Droits, traçabilité et alertes

Les permissions pourront distinguer la consultation, la création, la demande, l’approbation, la modification et l’annulation d’une affectation ou d’une mission. Les listes générales n’exposeront que les détails nécessaires. Les dates, acteurs, décisions, pièces et corrections seront journalisés selon la politique du dossier.

Les contrôles de cohérence pourront avertir sur une unité archivée, un responsable hors dossier, une période qui chevauche une autre affectation ou une mission qui chevauche une absence connue. Les exceptions seront résolues par l’utilisateur habilité. Les alertes ne modifieront aucune donnée et n’inventeront aucun motif.

## 6. Décisions à valider avant réalisation

- Un employé peut-il avoir plusieurs affectations simultanées, par exemple une affectation principale et des affectations secondaires ? Comment les distinguer ?
- Quels champs doivent être obligatoires : unité, fonction, lieu, responsable, dates, motif ou document ?
- Les missions doivent-elles couvrir uniquement les opérations internes, ou aussi les déplacements professionnels ?
- Une mission concerne-t-elle généralement une personne, une équipe, ou les deux ? Qui la demande et l’approuve ?
- Quelles étapes et quels états de mission l’entreprise souhaite-t-elle gérer ?
- Comment traiter une mission en cours lors d’un départ, d’un congé ou d’un changement d’affectation ?
- Quels référentiels de lieux et de fonctions sont nécessaires, et doivent-ils être propres à chaque dossier ?
- Faut-il des alertes sur les chevauchements et quelles personnes peuvent autoriser une exception ?
- Si les déplacements sont inclus, quelles politiques validées gouvernent leurs autorisations et dépenses ?

## 7. Critères d’acceptation proposés

1. Toute affectation est liée à un employé et un dossier RH autorisés ; toute unité et tout responsable lié appartiennent au même dossier.
2. Les unités personnalisées sont utilisées sans hiérarchie fixe, et les unités archivées ne peuvent pas recevoir de nouvelle affectation.
3. Les changements d’affectation préservent les versions et dates antérieures et sont traçables.
4. Les missions sont distinctes des contrats et affectations durables ; une mission ne change ni l’emploi, ni le salaire, ni le contrat.
5. Les missions d’équipe identifient leurs participants au lieu d’attribuer indistinctement une ligne agrégée à chacun.
6. Les chevauchements et conflits avec des absences donnent lieu à des contrôles explicites sans correction automatique.
7. Aucun déplacement, indemnité, avance, remboursement, budget ou écriture comptable n’est calculé ou créé sans règle validée et source explicite.
8. Aucune affectation ou mission réelle n’est inventée pour les dossiers de test.

**Étape suivante du plan :** l’étape 9 cadrera les congés et absences. Cette fiche ne met pas en œuvre de formulaires, calculs ni intégrations.