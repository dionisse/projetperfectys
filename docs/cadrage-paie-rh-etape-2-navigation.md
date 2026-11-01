# Étape 2 — Navigation indépendante du module Paie & RH

**Statut :** proposition de navigation à valider avant implémentation.  
**Référence :** [Plan complet Paie & RH en 18 étapes](proposition-implementation-paie-rh.md) et [cadrage de l’étape 1](cadrage-paie-rh-etape-1.md).

## 1. Décision de conception

Paie & RH possède une navigation, un catalogue de menus, des identifiants de vues et un état de navigation qui lui sont propres. Le module ne reprend pas les menus de la Comptabilité générale ni ceux du Suivi Analytique. Il garde toutefois le même principe d’interface : dossier actif toujours visible, menus hiérarchisés, vues cohérentes, filtres, états, droits et actions traçables.

Le contexte métier de toutes les vues RH est le **dossier Paie & RH actif** (`PRH-…`). Aucune page RH ne doit déduire son contexte de `S.currentDossier()` ou du dossier comptable actif. Le dossier comptable ne devient contexte de destination que dans le parcours explicite de centralisation.

## 2. Routes et état de navigation proposés

- `#/payroll-dossiers` : répertoire pour créer, sélectionner et ouvrir les dossiers RH.
- `#/payroll?g=dashboard&i=overview` : accueil du module sur le dossier RH actif.
- `#/payroll?g=personnel&i=employees` : accès à une vue propre à Paie & RH.
- `g` désigne un groupe Paie & RH et `i` une vue de ce groupe. Ces identifiants appartiennent à un registre `PayrollNavigation` indépendant ; ils ne réutilisent ni le registre comptable ni le registre analytique.
- Les liens conservent le dossier RH actif pendant les changements de vue. Tout changement de dossier RH est une action explicite via le sélecteur dédié.

## 3. Arborescence proposée

### A. Accueil

- Tableau de bord RH
- Alertes et tâches à traiter : demandes de congé, dossiers incomplets, fins de contrat ou missions à venir — uniquement à partir de données enregistrées.

### B. Organisation

- Directions
- Départements
- Sections
- Services
- Autres unités personnalisées
- Fonctions et responsables, lorsque le vocabulaire et le modèle auront été validés

### C. Personnel

- Répertoire des employés
- Recrutement et entrées
- Contrats et avenants
- Personnel intérimaire
- Débauchages et autres départs
- CV, compétences et formations
- Évaluations de performance
- Discipline et suivi confidentiel
- Documents et photos

### D. Affectations & missions

- Affectations et historique
- Missions opérationnelles
- Déplacements professionnels, si inclus dans le périmètre
- Comptes rendus et justificatifs

### E. Temps, congés & absences

- Calendriers de travail
- Demandes de congé et d’absence
- Circuit de validation
- Soldes et historique par employé
- Congés annuels, maternité, paternité, maladie, accident et types personnalisés

Les soldes et décomptes ne seront calculés qu’avec un calendrier et des règles validés.

### F. Paie

- Éléments de rémunération et rubriques
- Variables de la période
- Préparation et calcul d’un lot
- Contrôles et anomalies
- Approbation et clôture
- Historique des lots

### G. Centralisation comptable

- Associations explicites entre dossiers RH et dossiers comptables
- Correspondances de comptes et journaux configurées par l’utilisateur
- Aperçu et contrôles avant transfert
- Historique et traçabilité des lots transmis

Cette navigation ne crée pas de lien par nom, code client ou année. Elle ne crée pas de comptes, journaux, imputations ou règles comptables. Toute correction d’une écriture transférée reste dans le parcours comptable existant.

### H. Registres

- Registre du personnel
- Registre des contrats et intérimaires
- Registre des affectations et missions
- Registre des congés et absences
- Registre des lots, bulletins et paiements
- Registre des centralisations comptables

### I. États

- Effectifs et mouvements du personnel
- Congés et absences
- État de paie par période
- Impôt sur salaire
- Cotisations sociales et assurances
- Parts employeur et coûts associés

Les états légaux seront publiés seulement après validation de leur contenu, de leurs sources et de leurs règles de calcul. Chaque état affichera sa période, son périmètre, ses filtres et la provenance des données.

### J. Éditions

- Bulletins de paie
- Contrats, attestations et documents de sortie selon modèles validés
- Registres et états imprimables
- Exports des déclarations et paiements, si les formats officiels sont confirmés

### K. Paramètres

- Pays, régimes et versions des règles
- Catégories d’employés et types de contrat
- Calendriers, rubriques et circuits de validation
- Types de congé, mission et absence
- Utilisateurs, profils et permissions

## 4. Principes d’affichage et de permissions

- Le bandeau de contexte présente le client, la référence PRH, le pays pilote et l’exercice du dossier actif.
- La barre latérale met en évidence le groupe et la vue sélectionnés ; les menus RH ne se mélangent pas aux menus comptables.
- Les registres et états sont consultables sans mutation ; les modifications passent par leur parcours métier.
- Les bulletins, informations bancaires, données médicales, évaluations et données disciplinaires ont des permissions spécifiques.
- Les actions de calcul, approbation, clôture et centralisation sont séparées par droits et historisées.
- Sur téléphone, les parcours sont adaptés à la consultation et aux validations autorisées ; la densité des registres et états reste lisible.

## 5. Critères d’acceptation de l’étape 2

1. Le répertoire RH s’ouvre sans changer le dossier comptable actif.
2. Après sélection, le dossier PRH actif est visible et conservé lors du passage d’un menu RH à l’autre.
3. Les groupes et vues proviennent d’un catalogue de navigation Paie & RH indépendant.
4. Aucun menu RH n’ouvre les menus de la Comptabilité générale ; le menu Centralisation est le seul pont de navigation vers celle-ci.
5. Le menu Centralisation exige un dossier comptable explicitement choisi et n’effectue aucun transfert avant les contrôles et la confirmation.
6. Les utilisateurs sans droit ne voient pas les menus ou actions sensibles correspondants.
7. Registres, états et éditions sont présentés comme des vues distinctes, avec sources et filtres traçables.

## 6. Hors périmètre de cette étape

Cette étape fixe l’architecture de navigation et les libellés de menu. Elle ne réalise pas encore les écrans métier, règles de congé, calculs de paie, éditions légales, écritures comptables ou permissions finales. Ces éléments sont implémentés dans les étapes correspondantes du plan de 18 étapes.