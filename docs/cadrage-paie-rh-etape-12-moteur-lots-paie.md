# Étape 12 — Moteur de calcul et lots de paie

**Statut :** proposition de cadrage à valider avant toute réalisation ou calcul réel.
**Dépendances :** données contractuelles (étape 6), congés/absences (étape 9), rémunérations et variables (étape 10) et règles pays approuvées (étape 11). Le pilote est mensuel et béninois.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limite de l’étape

Cadrer la création d’un lot mensuel, la sélection explicite des employés et périodes, le calcul reproductible à partir de sources tracées et la présentation explicable des résultats. Le calcul utilisera uniquement des contrats, variables approuvées, événements de congé/absence qualifiés et règles pays applicables, chacun lié au même dossier RH.

Cette fiche ne spécifie aucune formule ni valeur de paie, ne valide pas le droit béninois et n’implémente pas le moteur. Les sources du Bénin et les règles fiscales, sociales, conventionnelles, de congés et de rémunération restent à vérifier et approuver selon l’étape 11. **Tant qu’une règle indispensable ou une donnée source manque, le calcul concerné est bloqué et le lot ne peut pas être présenté comme complet.**

## 2. Périmètre et dossier du lot

Chaque lot devra porter au minimum :

- identifiant stable et `dossierId` RH ;
- pays et régime/périmètre explicitement sélectionnés ;
- période mensuelle (début et fin), année, date de préparation et opérateur ;
- état de préparation, règles et versions envisagées ;
- employés retenus ou exclus, avec raison explicite ;
- événements d’entrée, avertissements, blocages et résultat de chaque exécution ;
- référence à l’étape de contrôle, approbation et clôture de l’étape 13, sans la remplacer.

La période de travail, la date de paiement et les dates limites de saisie peuvent être distinctes. Les dates de coupure et règles d’inclusion devront être définies par le client. Le système ne déplacera pas automatiquement une variable tardive vers une autre période et ne modifiera pas les données contractuelles pour les faire correspondre au lot.

Le pays proposé par défaut est le Bénin, mais il doit rester visible et confirmable au niveau du dossier/lot. Un lot n’utilise jamais des règles d’un autre pays comme solution de repli. Tout rattachement à un dossier de Comptabilité générale ou tout transfert comptable reste une opération séparée, explicite et hors de cette étape.

## 3. Sélection des employés et des entrées

La liste d’employés à examiner sera fondée sur les liens et périodes explicitement validés : `dossierId`, `employeeId`, contrat ou relation applicable, dates d’effet, statut et règles d’éligibilité approuvées. Le système ne déduit pas l’admissibilité d’un nom, d’une fonction, d’un salaire d’un autre employé ou de la seule présence dans le dossier.

Avant calcul, vérifier pour chaque personne :

- appartenance au dossier RH du lot et droits du demandeur ;
- identité, statut et catégorie renseignés selon les règles applicables ;
- contrat(s) et dates d’effet nécessaires au périmètre ;
- composantes fixes, variables de période approuvées et justificatifs exigés ;
- congés/absences approuvés et confirmés, si le pack requiert leur traitement ;
- données nécessaires aux règles du pays, sans compléter les valeurs manquantes par hypothèse.

Les éléments bruts, saisis, approuvés et calculés restent différenciés. Une donnée absente n’est ni zéro ni valeur de la période précédente. Une absence non qualifiée, un document manquant ou une variable en attente ne devient pas automatiquement une retenue, une prime ou un droit.

## 4. Applicabilité et exécution des règles

Pour chaque calcul, le moteur devrait :

1. déterminer les règles dont le périmètre correspond explicitement au pays, à la période, à la catégorie et aux données contractuelles ;
2. vérifier que chaque règle requise a un statut approuvé, une période de validité couvrant le cas et des dépendances complètes ;
3. vérifier les paramètres et sources nécessaires ;
4. exécuter les étapes définies par les règles versionnées dans l’ordre prévu, sans formule implicite ;
5. conserver les valeurs d’entrée, résultats intermédiaires, arrondis et sorties définis par ces règles ;
6. effectuer les contrôles de cohérence arithmétique autorisés et présenter les anomalies ;
7. enregistrer le résultat comme exécution identifiable, sans remplacer les données sources.

Aucun seuil, arrondi, taux, plafond, devise, ordre de calcul, base, exonération ou formule ne sera globalisé par défaut. Si les règles ne définissent pas les dépendances ou leur ordre, le système signale l’ambiguïté et bloque les résultats concernés. Les lignes invalides ne sont pas recalculées avec une valeur approchée.

## 5. Résultat explicable et reproductible

Chaque résultat devra permettre à un contrôleur autorisé de remonter aux sources et de reproduire le calcul. Pour chaque ligne, conserver et afficher, selon les permissions :

- employé et dossier RH ; période de paie et date d’exécution ;
- composante ou rubrique du catalogue ;
- entrées source (valeurs, unités, devise, dates, statut), leurs identifiants stables et pièces/références ;
- contrat, événement de congé/absence ou variable utilisé et sa version au moment du calcul ;
- identifiant et version de chaque règle applicable, source officielle et validateur ;
- bases et résultats intermédiaires prescrits par la règle, méthode et arrondi appliqués ;
- valeur finale calculée, monnaie explicitement configurée, et texte explicatif compréhensible ;
- avertissements, blocages et éventuelles corrections par rapport à une exécution antérieure.

Les totaux de lignes seront cohérents avec les règles et les montants affichés. Cela signifie une cohérence interne au calcul de paie, **pas** un équilibrage comptable, une écriture en partie double ou une correspondance de comptes. Les montants calculés, les valeurs saisies et les paiements effectivement réalisés doivent rester clairement distincts.

## 6. Versions, snapshots et corrections

Chaque exécution conservera un instantané des sources utilisées : employés et identifiants, contrats, variables, événements approuvés, périodes, règles/version du pack et paramètres. Cela permettra d’expliquer le résultat même si les données de profil ou les règles changent ensuite.

Une nouvelle exécution devra être déclenchée explicitement. Elle créera une nouvelle version liée au même lot ou à une correction documentée ; elle n’écrasera pas silencieusement le résultat antérieur. Les changements de sources après calcul devront être signalés et leurs effets identifiés. Les lots approuvés ou verrouillés seront régis par les contrôles, corrections et réouvertures de l’étape 13.

Une correction rétroactive suivra un parcours autorisé et conservera le lien vers la période, le lot et les pièces d’origine. Aucune mise à jour du pack pays ne recalculera automatiquement une ancienne paie.

## 7. États de lot et anomalies

États de préparation proposés : brouillon, prêt à simuler, calculé, calcul incomplet/bloqué, transmis au contrôle, corrigé, annulé. Ils ne remplacent pas les étapes d’approbation, verrouillage et réouverture cadrées à l’étape 13.

Les anomalies devront distinguer :

- **blocage** : règle applicable absente/non validée, catégorie ou contrat manquant, données incohérentes, source obligatoire absente, règle hors période ou ambiguïté ;
- **avertissement** : contrôle de cohérence nécessitant revue sans règle automatique pour décider ;
- **information** : événement ou différence expliquée qui ne bloque pas, selon un contrôle préalablement approuvé.

Un lot avec des employés calculables et d’autres bloqués pourra montrer des résultats partiels à titre de contrôle si l’entreprise l’autorise. Il devra alors être marqué comme incomplet, exclure tout total présenté comme paie finale et empêcher toute approbation ou édition finale. L’autorisation d’un traitement partiel plutôt qu’un blocage global est à valider ; elle ne peut jamais masquer les employés exclus.

Les règles de tolérance, seuils d’écart et comparaisons inter-périodes seront configurés seulement après validation. Aucun écart inhabituel ne sera corrigé automatiquement ou pris pour une valeur erronée.

## 8. Accès et confidentialité

Créer, lancer, consulter, exporter ou corriger un lot exige des permissions définies par rôle et dossier RH. Les données bancaires, familiales, médicales ou disciplinaires ne seront révélées que si nécessaires et autorisées. Les résultats et journaux ne doivent pas exposer dans une liste générale les pièces sensibles ni les données complètes de compte bancaire.

Les acteurs, dates, paramètres de sélection, avertissements, exécutions, décisions et corrections seront journalisés. Les journaux eux-mêmes respecteront les règles d’accès et de conservation définies par le client.

## 9. Décisions à valider avant réalisation

- Quelles dates définissent l’inclusion d’un contrat et d’un événement dans le mois de paie : période de travail, date de paiement et date de coupure ?
- Le lot doit-il bloquer globalement si un employé est incomplet, ou permettre un aperçu partiel clairement non final et non approuvable ?
- Quels rôles peuvent préparer, lancer, vérifier, corriger et consulter les détails de calcul ? La séparation des rôles sera définie à l’étape 13.
- Quelles composantes de sortie et quel niveau de détail doivent être visibles par ligne et par employé ?
- Comment traiter une variable tardive, une correction après calcul ou un événement couvrant deux périodes ?
- Quels tests de référence approuvés et résultats attendus seront fournis pour chaque règle du pack béninois ?
- Quelle devise est explicitement configurée pour le dossier et quelles conversions éventuelles sont applicables, le cas échéant ?
- Quelles règles définissent les tolérances et alertes de cohérence, sans automodification ?
- Quelles données et instantanés doivent être conservés, pendant combien de temps et avec quels contrôles d’accès ?

## 10. Critères d’acceptation proposés

1. Chaque lot est attaché à un dossier RH précis, à un pays explicite et à une période mensuelle déterminée.
2. La sélection des employés et des entrées est basée sur des identifiants et des périodes source vérifiés ; les exclusions sont visibles et justifiées.
3. Une règle indispensable, une donnée ou une source absente bloque le calcul concerné ; aucune valeur n’est devinée ou reportée d’une autre période.
4. Chaque ligne calculée expose sa provenance, ses entrées, ses règles/version et les étapes prescrites, selon les permissions.
5. Une exécution est reproductible à partir d’un snapshot identifiable et une nouvelle exécution ne supprime pas l’ancienne.
6. Les lots partiels, s’ils sont autorisés, ne sont jamais présentés ou exportés comme résultats complets ou approuvés.
7. Aucun lot ou calcul ne crée un paiement, une preuve bancaire, une écriture comptable ou un rapprochement implicite.
8. Aucun résultat réel, taux, règle, donnée d’employé ou montant de test n’est inventé.

**Étape suivante du plan :** l’étape 13 cadrera les anomalies, contrôles indépendants, rôles d’approbation, verrouillage, corrections et réouvertures. La présente fiche ne lance aucun calcul réel.