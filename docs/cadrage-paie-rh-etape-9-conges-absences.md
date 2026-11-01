# Étape 9 — Congés et absences

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** dossier RH (étape 3), profil employé (étape 5), contrats (étape 6), affectations et missions (étape 8). Les règles légales et conventionnelles du Bénin restent à documenter à partir des textes fournis et validés.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Tracer les demandes de congé et les absences constatées, leur calendrier, leurs justificatifs, leurs décisions et leur historique. Le catalogue prévu comprend les congés annuels, maternité, paternité, maladie, accident et d’autres types configurables. Ces catégories ne définissent pas, à elles seules, les conditions légales, le droit, le nombre de jours, la rémunération ou l’effet sur la paie.

Aucun droit acquis, solde d’ouverture, report, plafond, durée légale, jour ouvré, jour férié, décompte, retenue ou indemnité ne sera inventé. Chaque demande et absence sera liée explicitement à un employé et à son `dossierId` RH. L’étape définit les données et contrôles ; elle n’implémente pas de calcul de paie ni de calendrier réglementaire.

## 2. Distinguer demande de congé et absence

- Une **demande de congé** est une période planifiée soumise à décision. Elle peut être approuvée, refusée, retirée ou modifiée selon les droits définis.
- Une **absence constatée** décrit une absence ou interruption déjà survenue ou en cours, avec les dates et informations connues et, si requis, un justificatif.
- Une demande approuvée pourra devenir un événement de calendrier de congé, mais ne sera pas assimilée à une absence réalisée tant que les dates réelles ne sont pas confirmées selon le processus retenu.
- Une absence ne sera pas automatiquement transformée en congé payé, congé sans solde, maladie ou accident : sa qualification et son traitement exigent une validation autorisée et, si nécessaire, une règle applicable.

Les corrections, annulations et changements de statut conserveront l’historique, l’acteur, l’horodatage et le motif de modification. Une modification rétroactive d’un événement déjà transmis à une période de paie exigera un contrôle et une correction explicites, sans réécrire silencieusement un bulletin approuvé.

## 3. Catalogue de types et règles versionnées

Le client pourra créer des types de congé ou d’absence. Les catégories prévues à examiner incluent : congé annuel, maternité, paternité, maladie, accident, événement familial, congé sans solde et autres types définis par l’entreprise. Leur nom ne vaut pas règle légale.

Pour chaque type activé, un paramétrage versionné devra définir, avant tout calcul ou automatisme :

- pays, catégorie de personnel ou régime concernés ;
- objet et code interne, règles d’éligibilité et justificatifs requis ;
- unité de saisie et de décompte (jour, demi-journée, heure ou autre), calendrier et méthode de calcul ;
- modalités d’acquisition, de crédit, d’utilisation, de report et de plafond, s’il y a lieu ;
- statut de rémunération ou indemnisation, traitement social/fiscal si confirmé, et impact éventuel en paie ;
- circuit de demande et d’approbation, délais internes et rôles habilités ;
- dates d’effet, source exacte, version, validateur et jeux de tests.

Une règle sans source ou validation requise restera à l’état « à documenter » ou « à valider » et ne sera pas utilisée pour produire un solde ou un montant. Les types internes pourront être suivis sans règles de calcul ; leurs limites seront alors clairement affichées.

## 4. Demandes, décisions et calendrier

Une demande pourra contenir : employé et dossier RH, type, période prévue, unité de durée, date de soumission, commentaire limité, approbateur, statut, pièces nécessaires et historique des décisions. Les états proposés (brouillon, soumise, approuvée, refusée, retirée, annulée, clôturée) restent configurables et ne produisent pas seuls une conséquence financière.

Une demande approuvée ne modifie pas les dates du contrat ni l’affectation. Le calendrier affichera les événements par dossier et selon les permissions. Il pourra avertir d’un chevauchement avec une autre demande, une absence, une mission ou une affectation, sans supposer qu’un conflit rend automatiquement la demande invalide.

Avant tout décompte, il faudra préciser le calendrier de travail du dossier : jours travaillés et de repos, jours fériés applicables, traitement des périodes partielles et bornes de dates. Aucune journée ne sera retirée d’un solde si la méthode et les dates de référence ne sont pas définies.

## 5. Absences, justificatifs et données sensibles

Une absence pourra enregistrer les dates prévues et constatées, le type provisoire ou confirmé, la source de l’information, la personne qui l’a saisie, un commentaire opérationnel et les justificatifs strictement nécessaires. Les informations médicales seront séparées des listes générales et limitées au minimum utile ; diagnostics, comptes rendus détaillés ou documents médicaux ne seront pas affichés dans la fiche RH ordinaire.

Pour les événements liés à un accident, la distinction entre accident du travail et autre accident ne sera activée que si les textes et le besoin métier sont validés. Les responsabilités de déclaration, délais, pièces et effets ne seront pas présumés. Les catégories maternité et paternité seront identifiables séparément, mais aucun droit ou nombre de jours ne leur sera attribué sans source officielle applicable.

Les accès seront configurés par rôle, y compris la saisie, approbation, consultation de pièces confidentielles et traitement administratif. Les consultations et modifications sensibles seront journalisées conformément à la politique de sécurité et de conservation à valider.

## 6. Soldes et historique des droits

Si l’entreprise décide de gérer un solde, celui-ci devra être explicable par des mouvements datés : acquisition ou crédit, correction justifiée, report, consommation approuvée ou expiration explicitement autorisée. Chaque mouvement devra référencer la règle versionnée ou une pièce/source et conserver son auteur, sa période et sa validation.

Aucun solde initial ne sera créé par défaut. Une reprise de solde nécessitera une source fournie, une période de référence, une méthode de conversion si requise et une validation explicite ; le solde importé restera traçable à cette source. Le solde affiché devra distinguer les éléments acquis, réservés par des demandes approuvées, utilisés, en attente et non vérifiés, seulement si ces notions et leur calcul sont définis.

Le système ne pourra pas combler automatiquement une différence de solde, transformer un solde négatif, supprimer un reliquat ou interpréter un champ vide comme zéro acquis. Tant que les règles ou sources manquent, il affichera « non calculé / à vérifier » plutôt qu’un chiffre présenté comme certain.

## 7. Lien avec la paie et les autres modules

Les événements approuvés et confirmés pourront être transmis comme données d’entrée datées au processus de paie, avec le statut, la source, le dossier RH, l’employé et la version de la règle pertinente. Leur effet restera bloqué tant que le traitement salarial, social ou fiscal de la catégorie n’est pas validé.

Une paie ne modifiera pas l’enregistrement source du congé ou de l’absence. Les corrections suivront le parcours de régularisation prévu ; aucune rétroactivité ne réécrira une paie approuvée. Il n’y aura pas de lien automatique avec un dossier comptable ni d’écriture générée par la création, l’approbation ou la consommation d’un congé.

## 8. Décisions à valider avant réalisation

- Quels calendriers de travail, jours de repos et jours fériés utiliser pour chaque dossier et catégorie de personnel ?
- Quelles règles officielles et conventionnelles s’appliquent à chaque type de congé au Bénin, selon la catégorie de l’employé ?
- Quelle unité de saisie et de décompte utiliser, et comment traiter les périodes partielles et les dates de début/fin ?
- Quels rôles peuvent demander, approuver, annuler, corriger et consulter les justificatifs ? Une validation à plusieurs niveaux est-elle nécessaire ?
- Faut-il gérer les droits acquis et soldes dans PERFECTO ? Si oui, quelle source certifiée fournir pour les soldes initiaux et l’historique antérieur ?
- Quelles pièces sont exigées pour maladie, maternité, paternité ou accident, et quelles informations médicales doivent être exclues ?
- Comment distinguer et traiter accident du travail et accident non professionnel conformément aux textes applicables ?
- Quelles règles de conservation, de confidentialité, d’archivage et de consultation appliquer aux demandes et pièces ?
- Quels événements approuvés seront transmis à la paie et selon quels délais de clôture ?

## 9. Critères d’acceptation proposés

1. Demandes de congé et absences constatées sont différenciées, reliées au bon employé et dossier RH, et historisées.
2. Les types sont configurables ; aucun droit, durée, calendrier, solde ou effet financier n’est présumé.
3. Un décompte ne peut être effectué qu’avec un calendrier, une méthode et des règles versionnées explicitement validés.
4. Les soldes ne sont justifiés que par des mouvements traçables ; les soldes initiaux proviennent d’une source validée.
5. Les validations, annulations et changements sont attribués aux rôles autorisés et audités.
6. Les informations médicales et justificatifs sensibles sont minimisés, restreints et absents des listes générales.
7. Les règles béninoises ou conventionnelles non vérifiées bloquent tout calcul correspondant et sont indiquées comme inconnues.
8. Aucun congé ne crée automatiquement de paiement, retenue, remboursement, écriture comptable ou modification de contrat.

**Étape suivante du plan :** l’étape 10 cadrera les composantes de rémunération et variables. Cette fiche ne met en œuvre aucun calcul d’absence, de droit ou de paie.