# Étape 13 — Contrôles, approbation et clôture

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** lots et calculs explicables (étape 12), règles pays versionnées (étape 11), données sources des étapes 6 à 10. Le cycle pilote est mensuel.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Définir les contrôles du lot de paie, le traitement des anomalies, les rôles de revue et d’approbation, ainsi que le verrouillage, la correction et la réouverture avec un historique complet. Un lot ne peut être approuvé s’il est incomplet, bloqué par une donnée ou règle indispensable, ou si les contrôles requis n’ont pas été résolus.

Cette étape ne détermine pas les règles de calcul, les taux, les montants, les tolérances, les seuils de risque ou les obligations légales. Elle ne déclare pas les salaires payés, ne génère pas une preuve de paiement, et ne transmet pas d’écriture comptable. Les bulletins et le suivi des paiements seront cadrés à l’étape 14.

## 2. États du lot et transitions

Cycle proposé, à adapter par dossier et rôles autorisés :

1. **Brouillon** : période et périmètre préparés, données encore modifiables via leurs parcours sources ; aucun résultat approuvé.
2. **Calculé / à contrôler** : une exécution identifiée produit des résultats, avertissements et blocages à partir d’un snapshot.
3. **À corriger** : le contrôleur retourne le lot avec les anomalies et explications à traiter ; les corrections se font dans les registres sources.
4. **Prêt pour approbation** : tous les blocages levés, contrôles obligatoires effectués et snapshot recalculé/confirmé.
5. **Approuvé** : la personne habilitée accepte une version précise du lot après revue des totaux, détail, sources et contrôles.
6. **Verrouillé / clôturé** : le lot approuvé est figé et ne peut plus être modifié par les opérations ordinaires.
7. **Réouvert** : un rôle dédié autorise une correction exceptionnelle, avec motif, périmètre et nouvelle version ; les anciennes versions restent consultables.
8. **Annulé** : lot abandonné par une personne autorisée, avec motif et conservation de son historique.

Les transitions seront explicites et journalisées. Un recalcul après changement de source produit une nouvelle exécution, qui doit repasser les contrôles et approbations nécessaires. Il ne remplace pas la version précédemment examinée. Un lot incomplet ou partiel reste non approuvable, même si certaines lignes sont calculables.

## 3. Contrôles à réaliser

Les contrôles devront s’appuyer sur des exigences documentées, les règles pays validées et les paramètres d’entreprise explicitement configurés. Ils pourront inclure :

- complétude du dossier, de la période, du pays, des employés et des contrats ;
- validité des règles et versions applicables, et couverture des catégories concernées ;
- statut, approbation et période des variables, congés, absences et justificatifs requis ;
- absence de liens inter-dossiers non autorisés, de sources inaccessibles ou de doublons non résolus ;
- cohérence entre les entrées source, résultats par ligne, sous-totaux et totaux ;
- identification des corrections, rétroactivités, valeurs atypiques et changements depuis l’exécution précédente, uniquement selon des règles définies ;
- confirmation que l’exécution à approuver est bien celle qui a été contrôlée.

Les seuils d’écart, plages de valeurs, tolérances et comparaisons historiques ne seront pas préremplis. Un contrôle sans règle ou paramètre validé ne peut pas classer un montant comme anormal ou acceptable. Le système signale l’incohérence sans modifier, plafonner, remplacer ou supprimer une valeur.

## 4. Anomalies et résolution

Chaque anomalie devra être liée au lot, à l’employé ou à la ligne concernée, à la source et au contrôle déclenché. Les états proposés : ouverte, en cours, résolue, acceptée comme exception par un rôle autorisé, ou sans objet avec justification.

- Un **blocage** correspond à une exigence indispensable absente, invalide ou non validée ; il empêche la préparation à l’approbation.
- Un **avertissement** demande une revue et une décision documentée. Il ne peut être ignoré en silence ; la politique décidera s’il doit être résolu ou explicitement accepté.
- Une **information** explique un résultat ou un événement sans nécessiter d’action.

Corriger une donnée se fait d’abord dans son registre source (contrat, variable, congé, catégorie, règle, etc.) par son parcours autorisé. Le lot sera ensuite recalculé et ses anomalies réévaluées. Une dérogation ou une exception n’est disponible que si l’entreprise l’autorise explicitement, avec droit dédié, justification, auteur, date et portée ; elle ne peut valider une règle juridique inconnue ni un calcul bloqué par une source absente.

## 5. Rôles et séparation des tâches

Les permissions devront distinguer au minimum, selon le besoin : préparation du lot, saisie/correction de sources, contrôle, approbation, verrouillage, réouverture, annulation, consultation et export. Les rôles et délégations relèvent du dossier et de la politique de l’entreprise.

Une séparation entre préparateur et approbateur pourra être configurée. Si elle est exigée, une personne ne pourra pas approuver son propre lot ; toute délégation ou exception sera tracée. Le nombre d’approbateurs, l’ordre des signatures et les remplacements ne seront pas imposés avant décision du client.

Chaque approbation indiquera le lot et sa version exacte, l’approbateur, la date, l’action et les éventuelles réserves. L’approbation ne prouve ni que le paiement a eu lieu, ni que les coordonnées bancaires sont exactes, ni qu’un organisme a reçu une déclaration.

## 6. Verrouillage, correction et réouverture

À l’approbation ou au verrouillage, figer le snapshot, les résultats, les règles, les sources, les anomalies et les approbations associés. Les corrections ordinaires au lot verrouillé seront refusées.

Une réouverture nécessitera un droit spécifique et une demande tracée comprenant :

- lot et version concernés ;
- motif, source et portée de la correction ;
- personne demandant et personne autorisant ;
- date de réouverture et actions permises ;
- nouvelle exécution, contrôles et approbations ;
- lien vers les versions précédentes et explication des différences.

La réouverture ne supprimera pas l’approbation antérieure et ne réécrira pas un bulletin déjà émis. Si un recalcul est nécessaire, les effets sur les bulletins et la période seront traités par un processus explicite, avec les règles et autorisations applicables. Aucune écriture comptable ou paiement ne sera modifié par la seule réouverture du lot.

## 7. Piste d’audit et confidentialité

Journaliser de façon horodatée et attribuable : création et modification du lot, sélection de périmètre, exécutions, versions de règles, résultat des contrôles, commentaires, anomalies, décisions, exceptions, approbations, verrouillages, réouvertures, annulations et exports.

Le journal conserve l’état antérieur et nouveau, la raison et l’acteur, sans exposer inutilement les données sensibles. L’accès au journal, aux anomalies nominatives et aux détails de rémunération sera soumis aux rôles et permissions du dossier RH. La durée de conservation et les conditions d’export devront être définies par l’entreprise et les obligations applicables.

## 8. Décisions à valider avant réalisation

- Quels rôles préparent, contrôlent, approuvent, verrouillent et peuvent rouvrir un lot ?
- L’approbation doit-elle être distincte de la préparation ? Combien de validations et quelles délégations sont permises ?
- Quels contrôles sont obligatoires ou informatifs, et quelles sources définissent chaque blocage ?
- Quels écarts ou comparaisons inter-périodes doivent être signalés, avec quels seuils validés ?
- Qui peut accepter une anomalie comme exception, et quelles anomalies ne sont jamais dérogeables ?
- Le verrouillage suit-il l’approbation ou une action séparée ? Quelles conditions marquent la clôture du mois ?
- Qui peut demander et autoriser une réouverture, et comment traiter un bulletin déjà émis ?
- Quels événements/actions seront conservés dans le journal, pendant combien de temps et qui pourra l’exporter ?
- Le dossier autorise-t-il un aperçu partiel pour contrôle, ou doit-il être interdit lorsque certains employés sont bloqués ? (Aucune option partielle ne permet l’approbation.)

## 9. Critères d’acceptation proposés

1. Un lot bloqué ou incomplet ne peut pas être approuvé, verrouillé comme final ou présenté comme paie complète.
2. Chaque approbation concerne une version et un snapshot identifiables et montre les contrôles et anomalies en attente.
3. Les anomalies sont reliées à leurs sources et résolues dans les parcours métiers, avec décision et historique.
4. Une modification après calcul exige un nouveau calcul et les revues requises ; aucune valeur approuvée n’est changée silencieusement.
5. Le verrouillage empêche les changements ordinaires et une réouverture exige une permission, une justification et une nouvelle traçabilité.
6. Préparation, validation, approbation, verrouillage et réouverture respectent les rôles configurés et les règles de séparation retenues.
7. Les journaux sont attribuables, consultables uniquement par les rôles autorisés et conservent les versions antérieures.
8. L’approbation et la clôture du lot ne déclarent pas le paiement effectué et ne créent aucune écriture comptable.
9. Aucun seuil, tolérance, anomalie métier, montant ou règle d’approbation n’est inventé par défaut.

**Étape suivante du plan :** l’étape 14 cadrera les bulletins et le suivi des paiements après approbation, à partir de références et preuves fournies. Cette fiche ne met pas en œuvre l’approbation ni le verrouillage.