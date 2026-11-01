# Étape 16 — États et tableaux de suivi

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** registres et sources métiers (étape 15), lots contrôlés et approuvés (étapes 12–13), bulletins et paiements sourcés (étape 14), packs de règles validés (étape 11).
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Produire des états et tableaux de suivi RH et paie à partir de sources identifiables : effectifs, contrats, congés et absences, rémunérations, impôts, cotisations, parts employeur et paiements, uniquement lorsque les données et règles applicables sont validées.

Chaque indicateur doit avoir une définition et une formule approuvées avant son affichage. Aucun solde, droit, taux, total, pourcentage, projection ou indicateur n’est fabriqué par défaut. Un champ absent, une règle inconnue ou une source incomplète s’affiche comme non disponible/à vérifier, pas comme zéro.

Ces états sont des vues de consultation. Ils ne modifient pas les dossiers source, ne remplacent pas les registres comptables et ne génèrent aucune écriture. Les menus finaux demeurent à valider selon l’étape 2.

## 2. Fiche de définition de chaque état

Avant réalisation, chaque état devra préciser :

- nom, finalité et utilisateur cible ;
- dossier RH, pays, périmètre et date/période de référence ;
- unité comptée ou total visé et règle de définition ;
- filtres, exclusions, regroupements et règles de déduplication ;
- sources de données et identifiants stables, date d’extraction et versions de règles éventuelles ;
- méthode de calcul ou agrégation, validateur, cas de référence et limites connues ;
- permissions de consultation et éventuelle sensibilité ;
- comportement en cas de valeur manquante, conflit, source non validée ou calcul bloqué.

Un état montre ses critères et filtres actifs, sa période, son horodatage de génération et les sources utilisées. Les totaux sont retraçables aux lignes constitutives. Une ligne agrégée ne sera pas reliée de manière trompeuse à une seule pièce si plusieurs sources la composent.

## 3. Familles d’états envisagées

### A. Effectifs et dossiers

Effectifs par période, statut, catégorie, unité ou lieu uniquement après définition de la population comptée : employés ayant un contrat effectif, personnes dans le dossier, intérimaires suivis ou autre catégorie distincte. Une candidature, un intérimaire chez l’entreprise utilisatrice et un employé ne seront pas confondus. Les décomptes d’effectif ne seront pas inférés sans définition et dates d’effet.

### B. Contrats, affectations et missions

Listes et échéances contractuelles ou d’affectation à partir des dates et états enregistrés. Une échéance affichée ne vaut pas constat juridique d’expiration. Aucun renouvellement, changement de statut ou effet salarial n’est généré par un rapport.

### C. Congés et absences

Demandes, événements, jours ou unités consommés et soldes uniquement selon un calendrier, des règles et des sources validés. Si l’acquisition ou le solde ne peut être vérifié, l’état affiche explicitement qu’il n’est pas calculé. Les informations médicales ne figurent pas dans les vues générales.

### D. Rémunérations et résultats de paie

Totaux et détails dérivés des exécutions identifiées. Distinguer montants saisis, approuvés, calculés, corrigés et effectivement payés. Les états d’impôt, cotisations sociales et parts employeur ne sont produits qu’avec les règles de pack correspondantes validées, leurs dates et leur périmètre. Un lot incomplet n’est pas inclus dans un total présenté comme définitif.

### E. Paiements

Suivi à partir des références et preuves enregistrées. « À payer », « transmis », « confirmé » et « payé » restent des états distincts selon la définition validée. Un montant de bulletin ne prouve pas un paiement effectif ; un paiement groupé n’est ventilé par personne que sur la base d’une allocation explicite et sourcée.

## 4. Agrégations et périodes

La période de paie du pilote est mensuelle, mais la date de période, la date de calcul et la date effective de paiement sont distinctes. Le rapport doit indiquer laquelle gouverne chaque total. Les cumuls annuels, moyennes, variations, comparaisons, taux d’évolution et projections ne seront affichés qu’après validation de leurs formules, périodes et règles d’inclusion.

Les agrégations ne combinent pas automatiquement des dossiers RH différents. Toute synthèse multi-dossier exige un périmètre explicite, une autorisation et une règle de déduplication. Les conversions de devise, prorata, arrondis et totaux multi-pays ne sont pas implicites.

Les données de Comptabilité générale, les commandes fournisseurs et budgets ne sont pas une source de réalisation de paie. Les montants réalisés proviennent des sources Paie & RH ou des mouvements effectivement comptabilisés par leur parcours propre ; aucun lien financier ou budgétaire ne sera inféré.

## 5. Permissions, confidentialité et audit

Les accès sont filtrés par dossier RH, rôle et sensibilité de l’indicateur. Les tableaux généraux ne révèlent pas de données bancaires, médicales ou disciplinaires. Les détails nominatifs de rémunération nécessitent des permissions spécifiques. Les exports éventuels obéissent aux contrôles de l’étape 17.

Journaliser l’ouverture ou l’export des états sensibles, l’utilisateur, le périmètre, la période, les filtres et la date de génération selon la politique définie. Toute consultation agrégée doit pouvoir être expliquée sans donner accès à des dossiers individuels non autorisés.

## 6. Décisions à valider avant réalisation

- Quels états sont indispensables au lancement et pour quels rôles ?
- Comment définir exactement un effectif, une présence active et un contrat en vigueur à une date donnée ?
- Quelles vues de congés/soldes sont autorisées avant validation des règles d’acquisition ?
- Quels états fiscaux et sociaux sont requis, avec quelles sources et périodes de validité ?
- Faut-il des cumuls annuels, comparaisons inter-périodes ou indicateurs de tendance ? Si oui, quelles formules ?
- Quelles consolidations multi-dossier sont autorisées, par qui et comment éviter les doubles comptages ?
- Quels rôles peuvent accéder aux détails nominatifs de rémunération ou exporter des états sensibles ?
- Quelle politique appliquer aux valeurs manquantes, résultats partiels et lots corrigés ?

## 7. Critères d’acceptation proposés

1. Chaque état a une définition, une période, un périmètre, des filtres, une source et une méthode approuvés.
2. Chaque total est retraçable aux lignes et données source, avec règles/version si un calcul en dépend.
3. Les états distinguent saisie, calcul, approbation et paiement réellement documenté.
4. Les données absentes ou non validées ne sont pas transformées en zéro ou en résultat définitif.
5. Les agrégats multi-source ou multi-employé restent correctement qualifiés et ne suggèrent pas un lien source unique.
6. Aucun taux, projection, total, solde, indicateur ou règle métier n’est inventé.
7. Les permissions et restrictions par dossier s’appliquent à chaque vue, filtre, détail et export.
8. Les états ne modifient aucune donnée source ni ne créent d’écriture comptable.

**Étape suivante :** l’étape 17 cadrera la mise en page, l’impression et les formats d’export. Cette fiche ne crée aucun rapport ou indicateur réel.