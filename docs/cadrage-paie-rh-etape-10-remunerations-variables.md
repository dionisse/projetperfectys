# Étape 10 — Rémunérations et variables

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** dossiers RH (étape 3), profil employé (étape 5), contrats (étape 6), affectations (étape 8), congés et absences (étape 9). Le pilote de paie est mensuel ; les règles officielles et conventionnelles restent à fournir et valider.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Définir un catalogue de composantes de rémunération et un registre de variables par employé et période, en séparant clairement **saisie**, **contrôle/validation** et **calcul**. Cette étape prépare les données d’entrée du moteur de paie ; elle ne calcule ni brut, ni net, ni impôt, cotisation, avantage imposable, retenue ou montant employeur.

Aucun taux, barème, montant, base fiscale/sociale, formule, compte comptable, devise implicite, classification légale ou valeur par défaut ne sera inventé. Les traitements légaux seront portés par les règles pays de l’étape 11 et le calcul sera cadré à l’étape 12, après validation des sources et règles concernées.

Chaque composante et chaque variable devra être rattachée explicitement au dossier RH, à l’employé et, lorsque pertinent, au contrat, à la période et à une source ou pièce. Aucun lien au dossier de Comptabilité générale ne sera inféré.

## 2. Catalogue des composantes

L’entreprise pourra définir les rubriques qu’elle utilise. Le catalogue devra séparer les champs descriptifs et de saisie des traitements de calcul qui ne seront activés qu’après validation.

Métadonnées proposées :

- code et libellé uniques dans le dossier RH ; description et état (brouillon, actif, archivé) ;
- nature choisie par l’entreprise : composante de rémunération, avantage, retenue, remboursement, autre ou type personnalisé ;
- mode de saisie attendu : montant, quantité/unité, référence à un événement ou autre mode documenté ;
- personnes, catégories et contrats éventuellement concernés, avec dates d’effet ;
- fréquence ou période de rattachement, si nécessaire ;
- pièces, source et approbation attendues ;
- référence de la règle validée, seulement lorsqu’un traitement fiscal, social ou de calcul est défini.

Les exemples de natures ne préjugent pas de la qualification juridique ou fiscale. Les libellés ne suffisent pas à classer une rubrique : une prime appelée « remboursement » ou une retenue appelée « avance » ne reçoit aucun traitement automatique par son seul nom. Les paramètres de calcul (base, taux, plafond, prorata, arrondi, imposabilité, cotisation, part salarié/employeur et dates d’effet) resteront absents ou à valider tant qu’une source et une approbation ne les justifient pas.

Le dossier pourra activer, désactiver ou archiver une rubrique. Son archivage ne supprimera pas les lignes historiques qui l’utilisent et ne la rendra pas silencieusement applicable à de nouvelles périodes.

## 3. Composantes contractuelles et montants fixes

Les termes de rémunération récurrents, lorsqu’ils existent, doivent provenir d’un contrat ou d’un avenant explicitement lié et daté. Une synthèse de rémunération pourra référencer le document et la période d’effet sans remplacer la source contractuelle.

Une composante contractuelle ne sera pas créée en se basant uniquement sur le poste, la catégorie, l’ancienneté ou la rémunération d’un autre employé. La devise, l’unité, la fréquence, le montant et la date d’effet doivent provenir de données confirmées. L’absence d’une donnée reste « manquante/à confirmer », et n’est pas transformée en zéro ni en montant hérité.

Toute modification conserve l’ancienne valeur, le document ou la source, l’auteur, la date de saisie et l’intervalle d’effet. Les changements rétroactifs ne réécrivent pas une période ou un bulletin approuvé : ils exigent un contrôle et, le cas échéant, une correction par le parcours autorisé.

## 4. Variables de période

Une variable est une donnée associée à une période de paie et à une personne, par exemple une valeur saisie, une quantité vérifiée ou un événement approuvé. Des catégories telles que prime, heure supplémentaire, avantage, retenue, absence ou remboursement sont des exemples de rubriques possibles ; elles n’établissent ni droit ni formule.

Chaque ligne de variable pourra comprendre :

- dossier RH, employé, période de rattachement et référence de contrat lorsque nécessaire ;
- rubrique du catalogue et type de donnée attendu ;
- montant et devise confirmés, ou quantité et unité définies, sans conversion implicite ;
- période d’occurrence ou date, si différente de la période de paie ;
- source (saisie autorisée, événement RH approuvé, pièce ou système source identifié) et pièce justificative si requise ;
- personne ayant saisi, date, statut de contrôle et approbateur ;
- commentaire administratif limité au nécessaire et historique des corrections.

Les événements provenant des congés, absences ou missions ne seront pas dupliqués sous forme d’un montant calculé. Ils pourront être référencés comme source ; leur traitement financier restera bloqué tant que la règle applicable n’est pas validée. Une quantité (par exemple heures) ne sera convertie en valeur monétaire qu’à l’étape de calcul, avec formule et paramètres sourcés.

Les variables seront associées à une période mensuelle déterminée, mais le système ne déplacera pas automatiquement une ligne à une autre période en cas de retard ou de correction. La période d’occurrence, la période de paiement et une éventuelle période de régularisation resteront distinctes si l’entreprise le requiert.

## 5. Workflow de saisie et validation

États de travail proposés : brouillon/saisie, soumis, à contrôler, approuvé, refusé, annulé ou corrigé. Les états pourront être adaptés par le client ; ils n’autorisent pas à eux seuls un calcul.

Le circuit devra permettre de :

1. saisir une rubrique et une valeur ou référence source ;
2. vérifier l’employé, le dossier, le contrat et la période ;
3. vérifier présence, format, devise/unité et justificatif requis ;
4. soumettre les données à la personne autorisée ;
5. approuver, refuser ou demander une correction avec motif ;
6. figer la version approuvée pour la préparation du calcul de période ;
7. conserver chaque correction, annulation et changement de période dans l’historique.

Le nombre de niveaux d’approbation et la séparation des rôles seront définis par l’entreprise. Les valeurs manquantes ou incohérentes seront signalées explicitement. Le système ne remplacera pas automatiquement une valeur incorrecte par zéro, ne dupliquera pas une ligne sans contrôle et ne supposera pas l’approbation du responsable.

## 6. Contrôles, audit et permissions

- Les liens `dossierId`, `employeeId`, contrat et source sont vérifiés à chaque lecture et écriture ; les relations inter-dossiers sont refusées sauf mécanisme explicitement autorisé.
- Une rubrique inactive ou hors de sa période d’effet ne peut pas être affectée à une nouvelle ligne sans exception autorisée et tracée.
- Les doublons possibles (même employé, rubrique, période et source) sont présentés pour contrôle, pas fusionnés ou supprimés automatiquement.
- Les valeurs et pièces sensibles sont accessibles uniquement aux rôles habilités ; la consultation, l’approbation et les modifications importantes sont journalisées.
- Les listes et exports distinguent les montants saisis des montants calculés, les lignes approuvées des lignes en attente et les données manquantes des zéros explicites.
- L’approbation d’une variable ne constitue pas une preuve de paiement, une écriture comptable ni une validation de son traitement fiscal/social.

## 7. Décisions à valider avant réalisation

- Quelles rubriques sont réellement utilisées par l’entreprise, avec quels codes et libellés ?
- Quelles rubriques sont fixes au contrat et lesquelles sont variables par période ? Quelles sources établissent chacune ?
- Pour chaque variable, faut-il saisir un montant, une quantité, une référence d’événement ou un autre type de donnée ? Quelle unité et quelle devise sont valides ?
- Quels justificatifs, validations et approbateurs sont requis par rubrique et catégorie de personnel ?
- Comment gérer les périodes d’occurrence différentes de la période mensuelle de paiement et les régularisations tardives ?
- Quelles règles définissent les rubriques imposables, cotisables, plafonnées, récurrentes ou exclues, avec quelles sources officielles et validations ?
- Quels rôles peuvent saisir, contrôler, approuver, consulter ou exporter les données de rémunération ?
- Quelle politique appliquer aux modifications après approbation et à la correction d’une période déjà approuvée ?
- Quelles données synthétiques et non salariales pourront servir aux tests sans être confondues avec des valeurs réelles ?

## 8. Critères d’acceptation proposés

1. Le catalogue est configurable, versionné dans le temps et séparé des règles de calcul et classifications légales.
2. Chaque rémunération fixe est reliée à une source contractuelle datée ; aucune valeur n’est copiée ou déduite d’un autre salarié.
3. Chaque variable est liée à un dossier RH, un employé, une période et une source explicite ; l’unité et la devise ne sont pas devinées.
4. Saisie, contrôle, approbation et calcul sont des étapes distinctes, avec auteur et historique.
5. Les données manquantes, doublons, statuts non approuvés et justificatifs absents sont signalés sans fabrication de valeur.
6. Aucune règle fiscale/sociale, formule, conversion, arrondi, montant calculé ou écriture comptable n’est appliqué sans validation explicite et source applicable.
7. Une correction ne modifie pas silencieusement les variables ou paies approuvées antérieurement.
8. Aucun montant salarial, prime ou autre valeur réelle n’est inventé dans les dossiers ou jeux de test.

**Étape suivante du plan :** l’étape 11 cadrera l’architecture et la validation des packs de règles par pays, en commençant par le Bénin. Cette fiche ne met pas en œuvre la saisie ni le calcul des rémunérations.