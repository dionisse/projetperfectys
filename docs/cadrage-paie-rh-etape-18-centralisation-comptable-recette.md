# Étape 18 — Centralisation comptable et recette intégrée

**Statut :** proposition de cadrage à valider avant réalisation ou création d’écriture.
**Dépendances :** dossier RH et lot approuvé/verrouillé, rubriques et sources tracées (étapes 3–17), dossier comptable existant, plan comptable et parcours d’écriture de la Comptabilité générale.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limite

Cadrer le transfert contrôlé d’informations de paie vers un dossier de Comptabilité générale choisi explicitement, la configuration des correspondances, l’aperçu, la confirmation, la traçabilité et la recette intégrée. La centralisation est un lien entre deux modules et leurs dossiers : elle ne fusionne pas leurs données, menus, droits ou règles métier.

Aucun lien entre dossier RH et dossier comptable n’est déduit du nom du client, d’un code, d’une année similaire ou d’une ressemblance de référence. Aucun compte, journal, tiers, axe analytique, écriture, solde, répartition ou contrepartie ne sera inventé. Une écriture n’est créée qu’après le choix explicite des dossiers, des correspondances exactes, l’aperçu et la confirmation d’un utilisateur autorisé.

Le transfert ne remplace pas les contrôles ni les parcours de la Comptabilité générale. **Toute correction d’une écriture comptabilisée reste exclusivement dans le parcours comptable existant.** Une consultation dans Paie & RH est en lecture seule.

## 2. Association explicite des dossiers

L’association sera effectuée à partir d’un dossier RH précis et d’un dossier comptable existant, sélectionné explicitement par l’utilisateur. Avant toute sauvegarde ou transfert, afficher les deux références et noms complets, périodes d’exercice disponibles, statut, entreprise déclarée et conflits éventuels pour confirmation.

Le choix est enregistré avec identifiants stables des deux dossiers, acteur, date, portée et historique. L’utilisateur peut suspendre ou remplacer une association seulement via une action autorisée et confirmée. Un changement n’altère pas les transferts historiques. Une association au niveau du client ne dispense pas de vérifier le dossier comptable cible exact pour chaque période ou opération lorsque requis.

Aucune création automatique de dossier comptable, aucun transfert automatique à partir du dossier RH actif et aucune synchronisation Google Drive ne sont sous-entendus. Le stockage navigateur, s’il est utilisé, ne constitue pas une synchronisation Drive.

## 3. Sources de transfert et déclencheur

Les sources admissibles doivent être définies et verrouillées par leur identifiant : lot et version approuvés, lignes de calcul, bulletin ou paiement documenté, selon le mode de centralisation choisi. Le lot ne sera pas transférable si son calcul est incomplet, non approuvé ou lié à des règles non validées.

L’entreprise doit décider quel événement alimente la centralisation : résultat de paie approuvé, paiement effectivement exécuté, ou autres événements établis par une procédure. Un bulletin généré ne vaut pas paiement. Un statut de paiement n’est utilisé que sur preuve vérifiée. Aucun transfert ne sera créé à partir d’un brouillon, d’une prévision ou d’une donnée sans source identifiée.

Chaque source transmise porte ses identifiants stables RH, de document et de ligne, sa période, sa version, sa devise, son statut et son montant signé ou son sens séparé. Les changements ultérieurs aux sources n’altèrent pas un transfert déjà confirmé ; ils nécessitent un traitement contrôlé et une nouvelle référence de correction selon les règles comptables.

## 4. Correspondances des comptes et dimensions comptables

Avant le transfert, l’entreprise configure et approuve les correspondances entre les catégories exactes de lignes source et les codes exacts de comptes existant dans le dossier comptable cible. Pour chaque correspondance, conserver : code de compte exact (jamais un préfixe), libellé affiché, dossier, période, type de ligne RH, sens débit/crédit, dates d’effet, validateur et source de décision.

Les correspondances seront vérifiées à partir du plan de comptes cible : existence, état actif/inactif, période d’usage et autorisation. PERFECTO ne crée pas un compte manquant, n’invente pas une contrepartie et ne choisit pas un compte usuel par son libellé. Les débits et crédits restent séparés et visibles ; aucun solde net ne remplace le détail source. Aucun équilibrage artificiel par compte d’attente ou valeur d’ajustement n’est permis.

Les liens vers des tiers (employé, organisme social, banque ou autre) ne seront créés que si la source contient l’identifiant auxiliaire approprié et que le mapping est explicitement configuré. Aucun solde par tiers ne sera attribué sans identifiant auxiliaire source validé.

Les axes analytiques, si le dossier comptable les exige, nécessitent une correspondance explicite et des données d’imputation autorisées. Une unité RH, un lieu ou une mission ne devient pas automatiquement un axe ou centre de coût. Chaque axe est traité séparément selon sa règle de reliquat configurée ; un montant agrégé sans imputation fiable reste « À ventiler », le dépassement est bloqué, et aucune ventilation n’est inventée. Les axes ne modifient pas débits/crédits.

## 5. Aperçu, confirmation et écriture

Avant toute écriture, présenter un aperçu lisible contenant au minimum :

- dossier RH et dossier comptable choisis ; période et événement source ;
- lot, version, état et identifiants des lignes RH utilisées ;
- date comptable proposée, si fournie ou choisie explicitement ;
- chaque ligne d’écriture envisagée, code exact du compte, libellé, débit/crédit et devise ;
- tiers et axes uniquement lorsqu’ils sont sourcés et configurés ;
- total et contrôles de cohérence du dossier comptable, sans équilibrage automatique ;
- lignes non mappées, sources manquantes, allocations analytiques restantes, doublons possibles et erreurs bloquantes.

Aucune écriture n’est créée tant qu’une correspondance nécessaire manque, qu’un contrôle bloquant échoue ou que la confirmation explicite n’a pas été donnée par un rôle habilité. Une confirmation identifie l’aperçu exact, l’utilisateur, la date et le dossier cible.

Une fois confirmée, l’écriture est créée par le mécanisme comptable existant et reçoit son identifiant réel depuis celui-ci. Paie & RH conserve un lien de traçabilité vers cet identifiant et le statut renvoyé. Si le mécanisme comptable ne confirme pas la création, le transfert reste en attente/échec ; l’interface ne présente pas de succès supposé.

## 6. Traçabilité, agrégation et prévention des doublons

Chaque transfert utilise une clé stable dérivée des identifiants de source et de sa version, et enregistre l’état (préparé, aperçu, confirmé, créé, échec, annulé ou statut défini). Une nouvelle tentative détecte un transfert existant et ne crée pas un doublon silencieux. Toute correction ou nouvelle version source a une référence distincte et un lien vers l’opération initiale.

Si plusieurs lignes de paie sont agrégées en une ligne comptable, l’écriture conserve la liste complète et immuable des lignes sources et leur contribution, soit par lien de détail, soit par état de ventilation joint. La ligne agrégée ne doit pas être associée à une seule pièce employé ni faire croire que celle-ci en est la source unique. Le total d’agrégation doit être reproductible à partir des sources identifiées.

Pour les écritures comptables créées, le dossier comptable et la Comptabilité générale restent la source de référence du document comptable. Paie & RH affiche le transfert en lecture seule et permet de consulter ses sources et son statut. Toute modification ou contre-passation se fait dans le parcours comptable, puis le lien et l’état de transfert sont actualisés à partir de données réelles.

## 7. Recette intégrée et cas d’erreur

La recette doit couvrir, avec des jeux synthétiques autorisés et des règles validées :

- sélection explicite de dossiers, association absente, mauvaise sélection et séparation des permissions ;
- correspondance exacte de comptes, compte manquant/inactif, mapping incomplet et dates d’effet ;
- distinction débit/crédit et contrôle des identifiants de tiers ;
- dimensions analytiques configurées, reliquat « À ventiler », dépassement et absence de ventilation source ;
- lot incomplet, source modifiée après aperçu, changement de période et règles incompatibles ;
- agrégat comportant plusieurs lignes source et vérification qu’aucun lien unique trompeur n’est créé ;
- double soumission, relance après erreur, confirmation annulée et indisponibilité du mécanisme comptable ;
- statut de résultat incertain, afin de vérifier qu’aucune création ou réussite n’est annoncée sans confirmation réelle ;
- correction après comptabilisation, vérifiant que l’action s’effectue dans le parcours comptable existant.

Les valeurs attendues des écritures d’essai proviendront de règles et correspondances validées ; aucune écriture comptable réelle, valeur de paie ou compte ne sera inventé pour la recette. Si les sources officielles ou mappings manquent, la recette se limite aux contrôles structurels et aux aperçus non comptabilisés.

## 8. Décisions à valider avant réalisation

- Quels dossiers RH et comptables seront associés, et à quelle portée (dossier, client, exercice ou période) ?
- Quel événement source déclenche la centralisation : lot approuvé, paiement prouvé ou autre procédure définie ?
- Quelles écritures, journaux, dates comptables et codes de comptes exacts sont requis, qui les valide et pour quelles périodes ?
- Les montants sont-ils transférés détaillés par employé/ligne ou agrégés ? Dans ce cas, quel état de ventilation est nécessaire à l’audit ?
- Quelles identités auxiliaires, le cas échéant, existent dans les sources et à quel tiers comptable peuvent-elles être reliées ?
- Des axes analytiques sont-ils requis ? Quelles sources explicitement mappées fournissent les imputations par axe et quelle règle gère les reliquats ?
- Quels rôles peuvent configurer les mappings, générer un aperçu, confirmer, consulter le résultat et demander une correction ?
- Comment traiter une correction ou un paiement après création de l’écriture, sans modifier directement la pièce dans Paie & RH ?
- Quels cas de référence approuvés et profils synthétiques autorisés seront utilisés pour la recette complète ?

## 9. Critères d’acceptation proposés

1. Aucun lien dossier RH/comptable n’est déduit ; chaque paire de dossiers est choisie, affichée et confirmée explicitement.
2. Aucun compte, journal, auxiliaire, axe ou montant n’est inventé ; les comptes sont rapprochés au code exact et au dossier cible.
3. Le transfert utilise des sources approuvées et identifiables, et toutes les lignes générées remontent à leurs références de pièce/ligne.
4. Débits et crédits restent distincts ; aucun ajustement ou équilibrage automatique n’est ajouté.
5. Les imputations analytiques sont explicites par axe, ne changent pas les débits/crédits, respectent les reliquats configurés, bloquent les dépassements et n’inventent pas de ventilation.
6. Les agrégats conservent toutes leurs sources sans relation trompeuse à une ligne ou pièce unique.
7. Un aperçu doit être vérifié et confirmé avant création ; les erreurs et échecs ne sont pas déclarés comme réussites.
8. Les identifiants et clés stables empêchent les doublons, et toute correction conserve le lien d’origine.
9. Après transfert, la Comptabilité générale est la source de référence ; les corrections de l’écriture passent exclusivement par le parcours comptable existant.
10. La recette n’utilise aucune donnée personnelle, règle, montant ou compte réel non autorisé et n’effectue aucune écriture réelle sans demande et confirmation explicites.

**Fin du plan :** la recette intégrée ne peut être considérée complète qu’après validation des règles et sources de paie, des mappings comptables, des droits et des tests de référence. Cette fiche ne crée aucune association ou écriture comptable.
## Statut d’implémentation (2026-11-02)

Une vue locale de disponibilité liste les prérequis de destination explicite, lot approuvé/verrouillé, mappings exacts, aperçu, autorisation et retour réel du parcours comptable. Même si une référence de dossier comptable est déjà enregistrée séparément, elle n’est pas traitée comme une confirmation pour une opération. Les actions d’aperçu et de transfert restent désactivées; aucun montant, mapping, source, transfert ou écriture n’est généré par ce panneau. Les changements d’association existants demeurent un choix explicite, et toute correction d’écriture reste dans la Comptabilité générale. La recette complète reste en attente des décisions et sources répertoriées ci-dessus.
