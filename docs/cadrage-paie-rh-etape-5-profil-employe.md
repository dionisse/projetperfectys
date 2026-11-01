# Étape 5 — Profil complet et documents employés

**Statut :** proposition de cadrage à valider avant implémentation.  
**Dépendances :** dossier RH isolé (étape 3), structure organisationnelle (étape 4), conventions de menus encore à valider (étape 2).  
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif

Définir une fiche employé complète, reliée à un dossier client Paie & RH, qui centralise les informations utiles sans confondre identité, contrat, affectation, paie, évaluation et discipline. Chaque employé conserve un identifiant technique stable et un numéro employé unique dans son dossier RH.

La fiche employé est le dossier maître de la personne ; les contrats, affectations, missions, congés, pièces, évaluations et bulletins sont des enregistrements liés et historisés, non des blocs qui écrasent l’historique du profil.

## 2. Sections de la fiche

### A. Identité et coordonnées

Champs à cadrer selon les besoins de l’entreprise et les obligations validées :

- numéro employé interne, nom et prénoms ;
- date de naissance, nationalité et coordonnées, uniquement dans la mesure nécessaire ;
- adresse, téléphone et e-mail ;
- statut de la fiche et dates d’entrée et de sortie, alimentées par les événements d’embauche et de débauchage ;
- informations d’identification officielle et dates de validité, si leur collecte est nécessaire et autorisée.

Aucune information ne sera rendue obligatoire uniquement parce qu’elle figure sur un formulaire courant : le caractère obligatoire devra être justifié pour le pays et le processus concernés.

### B. Informations familiales

- nombre d’enfants, avec date de dernière vérification et justificatif si le régime de paie le requiert ;
- autres champs familiaux uniquement s’ils sont nécessaires à une règle validée.

Par défaut, les noms, dates de naissance et documents individuels des enfants ne seront pas demandés. Toute extension exigera une justification métier/légale et un droit d’accès adapté.

### C. Informations bancaires

Les coordonnées bancaires seront conservées comme données sensibles séparées ou dans une section à permission restreinte :

- titulaire du compte ;
- banque ou établissement de paiement ;
- identifiant bancaire accepté par le pays et le moyen de paiement ;
- date de vérification et statut (à vérifier, vérifié, remplacé).

Le format exact sera adapté au pays et validé avant la mise en production. L’affichage sera masqué par défaut ; seuls les rôles habilités pourront consulter ou modifier la valeur complète. Toute modification sera auditée. Aucun compte bancaire fictif valide ne sera prérempli dans les jeux de test.

### D. Emploi, compétences et CV

Le profil pourra présenter une synthèse de l’emploi courant et des liens vers les historiques :

- fonction ou intitulé de poste ;
- unité organisationnelle, responsable et affectation active ;
- contrats et catégories d’emploi, gérés dans leurs registres dédiés ;
- expériences professionnelles, formations, diplômes, certifications et compétences ;
- CV et pièces privées, avec date de dépôt et type de document.

Les contrats et affectations restent les sources de référence de leurs périodes ; la fiche synthèse les affiche sans dupliquer ni contredire leurs données.

### E. Évaluations de performance

Chaque évaluation sera un enregistrement daté contenant : période, critères applicables, évaluateur, résultats ou appréciations, éléments factuels, commentaires, réponse éventuelle de l’employé et actions de développement convenues.

Les critères et les échelles seront configurables et validés par l’entreprise. Aucun score global automatique ni effet sur salaire, promotion ou sanction ne sera produit sans règle explicitement approuvée.

### F. Discipline

Le suivi disciplinaire sera séparé des évaluations : faits et dates, étapes de traitement, pièces, personnes autorisées, statut et observations ou réponse de l’employé.

L’application n’inférera aucune faute, sanction ou conséquence juridique à partir d’un événement saisi. Les étapes, délais, droits de réponse, validations et conservation devront être cadrés selon les sources applicables. Les éléments disciplinaires ne seront pas visibles dans les listes générales du personnel.

### G. Photo et documents

La photo est facultative. Elle sera stockée comme pièce privée, rattachée à l’employé et à son dossier RH, avec contrôle d’accès et possibilité de remplacement ou de retrait selon la politique de conservation. Aucun lien public ou CDN ouvert ne sera utilisé pour une photo réelle.

Les autres documents pourront être classés par type, période, date d’expiration éventuelle et niveau de confidentialité. Une alerte de pièce expirée ne sera créée que si une règle de validité est définie.

## 3. Relations de données obligatoires

- Chaque fiche porte `dossierId` et le contrôle est effectué à chaque lecture et écriture.
- Le numéro employé est unique dans le dossier ; la politique de modification du numéro reste à définir, l’identifiant technique restant immuable.
- Les contrats, affectations, congés, missions et bulletins pointent vers `employeeId` et le même `dossierId`.
- Les pièces et photos pointent vers l’employé et le dossier RH ; les fichiers d’un dossier ne sont pas réutilisables implicitement dans un autre.
- Les champs de synthèse ne remplacent pas les registres d’historique.
- Le changement de nom ou de statut n’altère ni les anciens contrats ni les bulletins émis.

## 4. Interface proposée

La fiche individuelle pourra être organisée en onglets internes :

1. Synthèse ;
2. Identité et coordonnées ;
3. Contrats et parcours ;
4. Affectations et missions ;
5. Compétences et CV ;
6. Congés et absences ;
7. Évaluations ;
8. Discipline (accès restreint) ;
9. Paie et coordonnées bancaires (accès restreint) ;
10. Documents et photo.

La navigation globale et les menus de l’étape 2 restent indépendants de cette organisation interne de la fiche et seront validés séparément.

## 5. Protection des données

Les coordonnées bancaires, le nombre d’enfants, les pièces d’identité, la photo, les données médicales, l’évaluation et la discipline exigent une collecte minimale, des accès par rôle, un journal des consultations/modifications sensibles, des sauvegardes et des durées de conservation validées.

Le stockage local actuel ne convient qu’aux tests fictifs. En production, les pièces et fiches devront utiliser un stockage serveur protégé. Le profil employé ne sera jamais accessible par la seule possession du lien vers une photo ou un document.

## 6. Jeu de test

Les dix entrées génériques déjà rattachées à `PRH-TEST-2026` permettent de vérifier le lien dossier-employé et la pagination, mais ne constituent pas dix profils complets. Pour tester les champs sensibles, il faudra un jeu synthétique distinct, marqué TEST, sans données personnelles réelles, sans coordonnées bancaires utilisables et sans résultats de paie. Les photos de test pourront être des images neutres autorisées, pas des photos de personnes réelles sans accord.

## 7. Critères d’acceptation de l’étape 5

1. Toute fiche employé a un identifiant stable, un numéro unique par dossier et un `dossierId` vérifié.
2. Une fiche n’apparaît pas dans un dossier auquel son utilisateur n’a pas accès.
3. Les contrats et affectations historiques restent consultables après une modification de profil.
4. Les informations bancaires sont masquées et réservées à des droits spécifiques ; leur modification est auditée.
5. Les champs familiaux ou d’identification non nécessaires peuvent rester vides.
6. CV, photo et documents sont privés, rattachés au bon dossier et contrôlés par permission.
7. Évaluations et discipline restent deux registres séparés, avec historique et accès restreints.
8. Aucun score, sanction, résultat salarial ou donnée personnelle de test n’est inventé ou généré implicitement.

## 8. Décisions restant à cadrer

- Quels champs d’identité sont obligatoires pour une fiche employé au Bénin, et quels justificatifs sont nécessaires ?
- Quel format de numéro employé souhaite l’entreprise : numéro séquentiel par dossier ou code saisi ?
- Les informations familiales à garder se limitent-elles au nombre d’enfants, ou d’autres champs sont-ils requis par les règles validées ?
- Quels champs bancaires exacts et quels rôles sont autorisés à les consulter ?
- Quels critères/échelles d’évaluation et quelles étapes de discipline l’entreprise souhaite-t-elle ?
- Quelle politique de photo, de documents, de conservation et de suppression appliquer ?

**Étape suivante du plan :** l’étape 6 couvrira le recrutement, les contrats, les catégories de personnel et l’intérim. Cette fiche ne met pas encore en œuvre les formulaires ni le stockage de production.