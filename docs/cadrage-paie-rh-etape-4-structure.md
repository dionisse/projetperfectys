# Étape 4 — Structure organisationnelle de l’entreprise

**Statut :** proposition de cadrage à valider avant implémentation.  
**Dépendance :** le modèle appartient à un dossier client Paie & RH. La validation de la navigation de l’étape 2 reste reportée ; cette fiche définit les données et les comportements métier, pas les menus définitifs.  
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif

Permettre au gestionnaire de représenter la structure réelle de l’entreprise dans chaque dossier RH, sans imposer une organisation uniforme. Le client décide quelles unités existent, leur intitulé, leur niveau et leurs relations.

## 2. Types d’unités

Le formulaire proposera des types usuels comme suggestions :

- direction ;
- département ;
- section ;
- service ;
- autre type personnalisé par l’utilisateur.

Ces types ne forment pas une hiérarchie obligatoire. Une entreprise peut créer, par exemple, un service directement sous une direction, ou définir ses propres niveaux. Le type décrit l’unité ; le parent sélectionné par l’utilisateur détermine sa place réelle dans l’arbre.

## 3. Données d’une unité

Chaque unité organisationnelle aura les propriétés proposées suivantes :

- identifiant technique stable et `dossierId` RH obligatoire ;
- nom/libellé obligatoire ;
- type (suggestion standard ou type personnalisé) ;
- unité parente facultative, sélectionnée dans le même dossier ;
- code facultatif, unique dans le dossier s’il est renseigné ;
- description et responsable facultatifs ;
- dates d’effet et statut actif/archivé ;
- position d’affichage au sein de son parent.

Le nom et le type pourront être corrigés en conservant l’identifiant historique. Les relations parent-enfant auront des dates d’effet pour que les changements d’organigramme ne réécrivent pas les affectations passées. Toute modification d’un parent ou d’une unité utilisée sera tracée.

## 4. Opérations prévues

- créer une unité avec ou sans parent ;
- ajouter un nouveau type personnalisé ;
- renommer, décrire et réordonner les unités ;
- déplacer une unité vers un autre parent du même dossier, avec date d’effet ;
- désactiver/archiver une unité sans supprimer son historique ;
- rechercher et filtrer par type, parent et statut ;
- consulter l’organigramme sous forme d’arbre et de liste.

Une unité ne pourra jamais être son propre parent ni être déplacée sous l’un de ses descendants. La suppression physique sera refusée si elle possède des sous-unités ou des affectations historiques ; l’archivage sera privilégié. Une unité archivée ne sera pas proposée pour une nouvelle affectation, mais restera visible dans l’historique.

## 5. Relations avec les employés et les missions

L’étape 4 crée le référentiel des unités ; elle ne remplace pas le registre d’affectations de l’étape 8. Les affectations relieront, par identifiant stable, un employé à une unité et à une fonction pendant une période donnée. Les missions pourront référencer une unité d’origine ou de destination.

Un changement de nom ou de parent d’une unité ne changera pas les anciens liens. Les nouveaux employés ou affectations pourront choisir uniquement une unité active appartenant au dossier RH courant.

Aucun salaire, budget, centre de coût, code comptable ou autorisation de paie ne sera créé ou déduit de la structure organisationnelle.

## 6. Isolation, droits et historique

- Les unités appartiennent à un seul dossier RH ; elles ne sont pas partagées automatiquement entre dossiers, même si ceux-ci portent le même nom de client.
- Les identifiants et parents sont vérifiés à chaque lecture et modification ; un parent d’un autre dossier est refusé.
- Les rôles autorisés peuvent consulter, créer, modifier, déplacer ou archiver selon des droits distincts.
- L’historique enregistre l’acteur, l’action, la date d’effet et les valeurs avant/après.
- Le changement de structure ne modifie pas rétroactivement les contrats, missions, affectations, lots ou bulletins.

## 7. Critères d’acceptation de l’étape 4

1. Un gestionnaire peut créer des directions, départements, sections, services et types personnalisés.
2. Aucune séquence hiérarchique fixe n’est imposée ; le gestionnaire choisit le parent.
3. Les unités et relations ne peuvent référencer que le dossier RH actif et autorisé.
4. Les cycles parent-enfant et les déplacements dans l’arbre sont bloqués.
5. Le renommage, déplacement et archivage conservent l’historique et ne réécrivent pas les données antérieures.
6. Une unité archivée ne peut pas recevoir de nouvelle affectation, mais les anciennes affectations restent consultables.
7. Les structures de dossiers RH différents restent isolées, même si le client ou l’exercice se ressemble.
8. La structure ne génère aucun compte, montant, budget ou écriture comptable.

## 8. Choix de conception proposés

- Hiérarchie libre, sans ordre obligatoire entre les types d’unité.
- Structure isolée par dossier RH ; une duplication entre exercices, si nécessaire, ferait l’objet d’une action explicite et d’un aperçu, jamais d’un partage automatique.
- Les unités utilisées sont archivées plutôt que supprimées.

Ces choix restent modifiables avant l’implémentation, notamment si l’entreprise souhaite une structure partagée entre dossiers d’exercices successifs.