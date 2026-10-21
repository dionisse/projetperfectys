# Import manuel du FEC béninois

## Portée

Cette fonction lit un **fichier FEC choisi manuellement** et propose son import dans le dossier PERFECTO actif. Elle ne se connecte pas au logiciel comptable d’origine et ne constitue pas un adaptateur Sage, PERFECTO, HYPERSOFT, ODOO ou autre.

La référence fonctionnelle est l’arrêté béninois du 23 avril 2020 transmis pour le projet. L’exemple fourni a servi à vérifier uniquement les caractéristiques structurelles (en-tête, nombre de champs, tabulations, fins de ligne et encodage), pas les valeurs ni les montants comptables. Le libellé de son champ 12 est interprété comme `MontDebit`, conformément à la correction confirmée par l’utilisateur.

## Format reconnu

- Fichier texte plat `.txt` ou `.csv`, avec en-tête sur la première ligne.
- 18 champs de base, ou 21 champs avec le complément de trésorerie. Le lecteur vérifie les intitulés et leur ordre.
- Champs 12–13 : `MontDebit` / `MontCredit`, ou variante alternative `Montant` / `sens` (`D` ou `C`).
- Tabulation ou caractère `|`; fins de lignes CR, LF ou CRLF.
- Encodage déclaré explicitement : ASCII, ISO-8859-15, EBCDIC IBM037 ou EBCDIC IBM500. Le terme EBCDIC sans numéro de page ne permet pas de deviner la variante.
- Dates au format `AAAAMMJJ`; comptes dont les trois premiers caractères sont numériques.
- Montants en caractères, virgule décimale, sans séparateur de milliers. La version actuelle prend en charge jusqu’à quatre décimales, sans arrondi silencieux, puis contrôle la précision configurée dans le dossier.
- Les signes négatifs sont reportés sur le côté débit/crédit opposé sans changer la valeur absolue. Le signe original reste dans la trace et chaque ligne concernée est signalée dans l’aperçu.

Le prototype limite chaque fichier à **1 Mo** et **50 000 lignes de données**. Ces limites d’interface ne remplacent pas les capacités requises pour un archivage organisationnel.

## Parcours et contrôles

1. Sélectionner le fichier, son encodage et, si nécessaire, son séparateur.
2. Examiner la structure, les dates, la chronologie des validations, les champs obligatoires, les comptes SYSCOHADA et l’équilibre de chaque écriture source.
3. Examiner les correspondances proposées. Une correspondance de code identique n’est qu’une suggestion ; l’utilisateur confirme l’ensemble des comptes et journaux. Aucun compte ou journal cible n’est créé automatiquement. Toute correspondance manquante ou invalide bloque l’import.
4. Confirmer que le fichier contient bien des écritures validées et n’inclut pas de centralisation ni de soldes de charges/produits. Ces exclusions ne sont pas toutes déductibles des champs ; la confirmation explicite ne remplace pas une vérification métier.
5. Importer en **brouillons par défaut**. Un import directement validé requiert le droit de validation du dossier, une période ouverte et des pièces équilibrées.

Le hash du fichier bloque sa réimportation dans le même dossier. Le fichier original, son nom, ses métadonnées de lecture et sa trace sont conservés pour téléchargement et audit dans l’historique local.

- Un lot encore en brouillon peut être annulé : ses brouillons sont retirés, mais le fichier source et l’événement d’annulation restent dans l’historique.
- Une pièce déjà validée n’est jamais supprimée par cette commande. L’utilisateur peut préparer une écriture inverse par pièce, choisir le journal, la date, le motif et le statut, puis confirmer. L’écriture inverse reprend les comptes et montants en côtés opposés et contient un lien vers la pièce FEC originale; l’original reste immuable. Une seule inversion liée est autorisée par pièce source.

## Stockage et limites de sécurité

Le prototype garde les données et le contenu source dans le stockage local du navigateur et dans les sauvegardes locales. **Ce stockage n’est pas Google Drive, n’est pas partagé entre utilisateurs et n’est pas un archivage organisationnel.** Aucune donnée n’est transmise à un serveur par ce parcours. Les droits de démonstration contrôlent l’interface, mais ne constituent pas une sécurité serveur.

Les champs auxiliaires, de lettrage, de devise et de règlement sont gardés dans la provenance source; cette version ne génère pas de tiers, de taux de change, de rapprochement ou d’écriture complémentaire. La centralisation interne des modules PERFECTO reste un parcours séparé.

## Tests

Les jeux de tests sont synthétiques et n’utilisent pas les données comptables de l’exemple fourni :

```sh
node tests/fec-import.test.js
node tests/store.test.js
node tests/accounting-navigation.test.js
```
