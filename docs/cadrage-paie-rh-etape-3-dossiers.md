# Étape 3 — Dossiers RH clients et isolation des données

**Statut :** proposition de cadrage à valider avant implémentation.  
**Dépendances :** étape 1 cadrée initialement ; la validation de l’étape 2 (menus) est reportée par l’utilisateur. Cette fiche définit uniquement le périmètre fonctionnel des dossiers et leur isolation.  
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. But

Définir comment un dossier client Paie & RH est créé, identifié, sélectionné, autorisé, fermé et relié aux données RH. Un dossier RH est un conteneur autonome ; il n’est ni un dossier comptable, ni un simple filtre d’affichage.

## 2. Identité du dossier client

Chaque dossier devra avoir un identifiant technique stable, non réutilisable et distinct de sa référence affichée. Les champs proposés sont :

- nom du client / entreprise ;
- sigle ou code client ;
- référence lisible au format **`PRH-{CODE}-{ANNÉE}`** ;
- pays du dossier, avec **Bénin proposé par défaut** ;
- exercice/cycle avec dates de début et de fin ;
- statut du dossier (actif, fermé/archivé) et dates de création/clôture ;
- coordonnées et informations administratives facultatives, selon les besoins validés.

La référence est unique dans l’organisation. L’année affichée provient de l’année de début de l’exercice, selon la convention déjà retenue dans le prototype. Le changement ultérieur du nom du client ne change pas l’identifiant technique ni les liens historiques. Un changement de code ou de cycle devra être contrôlé pour éviter une référence ambiguë ; la politique exacte de correction de référence reste à valider.

Le cycle RH et la période de paie sont deux notions distinctes : le cycle décrit le dossier ; les périodes mensuelles de paie sont créées à l’intérieur du périmètre autorisé. La durée maximale d’un cycle et le traitement d’une période qui chevauche sa borne devront être confirmés avant d’en faire une règle bloquante.

## 3. Association facultative à la Comptabilité

Le dossier RH peut rester sans association comptable. Si une association est demandée, un utilisateur autorisé choisit explicitement un dossier comptable existant dans son organisation. Le lien conserve l’identifiant stable de la destination.

- Aucun rapprochement automatique par nom, sigle, code client ou année.
- La référence comptable n’est pas fabriquée par Paie & RH.
- Le lien ne donne pas à lui seul des droits de consultation ou de saisie comptable.
- La centralisation vérifie séparément l’accès au dossier RH source et au dossier comptable destinataire.
- L’association peut être retirée ou remplacée selon des droits et une procédure tracés ; les transferts déjà réalisés conservent la destination utilisée à leur date.

Les comptes, journaux, rubriques comptables et correspondances restent configurés dans le parcours prévu, avec validation et aperçu. Aucun compte n’est déduit automatiquement du nom d’une rubrique de paie.

## 4. Isolation obligatoire des données

Toute donnée RH doit porter son dossier source ou être stockée dans un espace explicitement possédé par ce dossier. Le dossier doit être vérifié à la lecture, à l’écriture, à l’export et à la centralisation.

| Objet | Lien requis | Règle d’isolation |
|---|---|---|
| Employé | `dossierId` RH | Un employé est listé et modifiable uniquement dans son dossier, sauf accès organisationnel autorisé. |
| Contrat, avenant, recrutement, intérim, départ | employé et `dossierId` RH | Le lien employé-dossier doit être cohérent ; aucun document ne peut être réattaché en changeant simplement l’identifiant dans l’interface. |
| Unité, affectation, mission | `dossierId` RH | Historique et unités appartiennent au même dossier ; aucun rattachement implicite entre clients. |
| Congé et absence | employé et `dossierId` RH | Demande, approbation et pièces restent dans le dossier de l’employé. |
| Variables et lot de paie | `dossierId` RH et période | Un lot ne rassemble pas d’employés d’un autre dossier. |
| Bulletin, paiement, pièce justificative | employé, lot et `dossierId` RH | Les liens remontent au dossier, à la période et au lot source. |
| Transfert comptable | identifiant source RH + dossier comptable explicite | Traçabilité du dossier source et de la destination ; blocage des doublons. |

Les identifiants techniques des objets ne seront pas réutilisés dans d’autres dossiers. Les recherches, compteurs, listes et exports doivent appliquer le périmètre dossier avant d’afficher les données. Les accès organisationnels exceptionnels doivent être explicites et journalisés.

## 5. Sélection, droits et cycle de vie du dossier

- À l’ouverture du module, l’utilisateur choisit un dossier RH auquel il a accès ; le contexte actif reste affiché dans toutes les vues.
- Le changement de dossier est explicite et ne change pas le dossier actif de Comptabilité générale.
- Les actions de créer, consulter, modifier, approuver, fermer et associer à la Comptabilité sont des droits distincts.
- La fermeture/archivage interdit de nouvelles opérations selon une politique à valider, tout en conservant la consultation historique autorisée.
- La suppression physique d’un dossier contenant des employés, contrats, congés, lots ou bulletins n’est pas prévue dans le parcours normal ; toute politique de suppression et de conservation doit être validée avant production.
- Les dossiers sont isolés par organisation et par permissions dans l’architecture serveur future. Le stockage navigateur du prototype ne constitue pas une sécurité ou une synchronisation multi-utilisateur.

## 6. Données de démonstration déjà prévues

Le dossier de test `PRH-TEST-2026` contient dix identifiants d’employés fictifs rattachés explicitement à son identifiant technique. Ils ne contiennent ni rémunération ni coordonnées personnelles réelles. Les tests d’isolation vérifieront qu’ils n’apparaissent jamais dans un autre dossier RH et ne produisent aucun calcul de paie.

## 7. Critères d’acceptation de l’étape 3

1. Une création valide produit une référence PRH unique et un identifiant technique stable.
2. Le pays Bénin est proposé par défaut, mais reste visible et modifiable selon les pays supportés.
3. Dossier RH actif, cycle et statut sont visibles dans chaque vue Paie & RH.
4. Le changement de dossier RH ne modifie pas le dossier comptable actif.
5. Une association comptable n’existe qu’après sélection explicite ; aucune correspondance par nom/code/année n’est acceptée.
6. Un employé, congé, mission, lot ou bulletin d’un dossier est invisible dans un autre dossier pour un profil sans accès.
7. Chaque relation est contrôlée côté serveur en production, en plus des contrôles d’interface ; le stockage local reste identifié comme démonstration.
8. La fermeture conserve les historiques et empêche les opérations nouvelles selon une politique validée.
9. Les dix employés de test sont rattachés par identifiant à `PRH-TEST-2026`, sans créer de montants ou de bulletins.

## 8. Décisions encore ouvertes

- Quelle politique de changement du code et de la référence après création ?
- Quel cycle d’exercice RH est autorisé, et quelle durée maximale appliquer ?
- Une période de paie peut-elle chevaucher les dates du cycle, ou le chevauchement doit-il bloquer le calcul ?
- Quels rôles peuvent créer, fermer ou réassocier un dossier RH ?
- Quelles règles de conservation et de suppression doivent s’appliquer aux dossiers réels ?

**Étape suivante du plan :** l’étape 4 porte sur la structure organisationnelle configurable à l’intérieur du dossier RH. Cette fiche ne met pas encore en œuvre les écrans ni les règles de stockage de production.