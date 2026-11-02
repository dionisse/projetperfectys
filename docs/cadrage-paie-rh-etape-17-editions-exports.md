# Étape 17 — Éditions, impressions et exports

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** bulletins, registres et états (étapes 14–16), avec droits, statuts et sources validés.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Cadrer les documents imprimables et fichiers exportables : bulletins, registres RH/paie et états. Chaque sortie doit reprendre fidèlement un périmètre, des filtres et un état source autorisé, protéger les données sensibles et rester retraçable.

Cette étape ne crée pas de contenu ni de calcul métier. Un export ne valide pas une règle, ne change pas une paie, ne constitue pas une preuve de paiement et ne déclenche pas de transfert comptable. Formats, contenu et droits doivent être décidés avant réalisation. Les bulletins et paiements conservent les exigences propres à l’étape 14.

## 2. Catalogue d’éditions

Pour chaque document à imprimer/exporter, définir une spécification distincte :

- nom, finalité, utilisateur et source officielle de données ;
- statut requis : aperçu, brouillon, approuvé, final ou autre statut défini ;
- dossier RH, période, pays, filtres, tri et périmètre inclus ;
- champs, colonnes, regroupements, totaux et méthode d’agrégation ;
- format(s) autorisé(s) et dimensions/présentation ;
- données masquées ou exclues selon les rôles et la finalité ;
- en-tête, pied de page, pagination, horodatage, langue et mentions validées ;
- version du document, identifiants des sources et historique de génération ;
- éventuels filigranes, signature ou indication d’aperçu, si requis et confirmés.

Les formats peuvent être définis selon les besoins (par exemple PDF pour un bulletin et format tabulaire pour un registre), mais aucun choix ni contenu obligatoire n’est présumé dans ce cadrage. Les exigences réglementaires et les possibilités d’édition devront être validées avant sélection.

## 3. Fidélité aux filtres et aux données source

Une sortie est générée à partir d’une vue et d’un instantané identifiables. Elle doit conserver le dossier, la période, les filtres, les lignes incluses/exclues et l’horodatage. Les totaux et regroupements doivent correspondre exactement à la vue de référence et renvoyer aux données source et versions utilisées.

Aucune ligne masquée par le filtre, aucun autre dossier et aucune donnée non visible à l’utilisateur ne sera ajoutée implicitement. Les lignes agrégées restent identifiées comme agrégées ; une sortie ne doit pas attribuer un total global à une pièce, personne ou transaction unique sans allocation explicite source.

Les montants saisis, calculés, approuvés et réellement payés restent distincts dans les colonnes et libellés. Une valeur absente ne devient pas zéro à l’impression. Un lot incomplet ou un aperçu reste marqué non final ; il ne peut être présenté comme bulletin approuvé ou état définitif.

## 4. Protection des fichiers

Les droits de consultation, génération, impression, téléchargement et partage sont contrôlés séparément. Les bulletins, informations de rémunération, banques, pièces médicales, disciplinaires et évaluations nécessitent des permissions restrictives. Les coordonnées bancaires complètes et les données sensibles sont exclues ou masquées sauf exigence confirmée et droit adapté.

Les fichiers générés ne seront pas accessibles par une URL publique ou un simple lien devinable. Le stockage, la durée de disponibilité, le chiffrement, le partage avec l’employé et la révocation seront définis selon l’architecture sécurisée retenue. Le stockage local du navigateur n’est pas une synchronisation Google Drive et ne doit pas être présenté comme tel.

L’export, l’impression, le téléchargement ou la remise seront journalisés selon la sensibilité : acteur, date, dossier, document, filtres, version et destinataire/canal lorsqu’ils sont connus. La génération ne prouve pas la réception ni la lecture par un destinataire.

## 5. Mise en page et contrôles avant production

La mise en page doit rester lisible sur écran et sur papier, sans couper des montants, périodes, intitulés ou identifiants. La langue de l’interface pilote est le français. Les formats décimaux, date, devise, pagination, orientation, dimensions et présentation doivent suivre les choix validés du dossier et du document, et non une supposition cachée.

Avant téléchargement ou impression, afficher un aperçu avec le nom du document, son état, le dossier, la période, les filtres et les avertissements. Pour une édition sensible, exiger une confirmation si le périmètre est large ou contient plusieurs personnes. Les tests de rendu doivent vérifier les longues listes, pages multiples, caractères accentués, valeurs vides, valeurs longues et autorisations, sans injecter de fausses données légales ou salariales.

## 6. Décisions à valider avant réalisation

- Quels documents doivent être imprimables ou exportables en premier ?
- Quels formats sont requis pour chaque type de document et par quel organisme ou usage ?
- Quelles mentions, en-têtes, logos, signatures, filigranes ou champs sont obligatoires ou interdits ?
- Quels rôles peuvent créer, imprimer, télécharger et transmettre chaque catégorie de document ?
- Quel canal sécurisé permet la remise des bulletins aux employés, et faut-il enregistrer un accusé de réception ?
- Quelle politique de stockage, de rétention, de révocation et de partage des fichiers appliquer ?
- Les exports tabulaires doivent-ils contenir des données nominatives ou être agrégés/masqués ?
- Quel horodatage, fuseau et format de date/monnaie afficher, et selon quel paramétrage validé ?

## 7. Critères d’acceptation proposés

1. Toute édition affiche ou conserve son type, son dossier, sa période, son statut, ses filtres, sa source et sa date de génération.
2. Les fichiers reproduisent la vue autorisée et les données sources sans ligne ou champ caché ajouté.
3. Aperçu, brouillon, document approuvé et document final sont clairement différenciés.
4. Les agrégats et totaux ne créent pas de fausse relation avec une source unique.
5. Les informations sensibles sont masquées ou exclues selon le rôle et le besoin ; aucun fichier sensible n’est publiquement accessible.
6. Exporter ou imprimer ne modifie pas les sources, les statuts métier, les paiements ou les écritures comptables.
7. La mise en page est vérifiée pour plusieurs pages, caractères français, champs vides et longues valeurs.
8. Aucun format, contenu légal, montant ou donnée personnelle n’est inventé comme norme ou valeur réelle.

**Étape suivante :** l’étape 18 cadrera l’association explicite aux dossiers comptables, le transfert contrôlé et la recette intégrée. Cette fiche ne génère aucun fichier réel.
## Statut d’implémentation (2026-11-02)

Le prototype présente désormais un catalogue de disponibilité pour les bulletins, registres/états et documents de paiement. Chaque édition reste désactivée; les actions Imprimer, Télécharger et Partager sont des boutons désactivés sans gestionnaire métier. Aucun aperçu ni fichier n’est créé. Les raisons affichées indiquent les validations manquantes pour les formats, périmètres, champs, droits, sources et stockage sécurisé. Cette interface ne vaut pas validation des décisions listées plus haut et ne rend pas la fonctionnalité prête pour la production.
