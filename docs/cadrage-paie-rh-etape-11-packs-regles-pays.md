# Étape 11 — Packs de règles par pays

**Statut :** un registre de préparation local, limité aux données fictives, est implémenté ; les sources, règles, validations et toute activation restent à fournir et approuver.
**Pays pilote :** Bénin ; le dossier Paie & RH propose le Bénin par défaut, sans empêcher un choix explicite d’un autre pays lorsqu’un pack applicable sera prêt.

Le prototype permet uniquement de créer des cadres de test et des fiches candidates descriptives, toujours « en préparation » / « à documenter ». Il ne stocke aucun paramètre de calcul et ne permet ni approbation ni activation. Les données DEMO sont réservées à `PRH-TEST-2026`; le stockage local n’est pas adapté aux sources confidentielles ni à des données de production.
**Dépendances :** règles et catégories du dossier RH, contrat, rémunérations/variables (étape 10) et sources officielles fournies et validées.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Définir comment PERFECTO organisera des règles de paie par pays, domaine, catégorie de personnel et période d’effet, avec provenance, validation, tests et version immuable. Le Bénin est le premier pack à instruire. Cette étape cadre l’architecture et le processus de validation ; elle ne fournit pas de taux, plafonds, bases, formules ou interprétations juridiques et ne met pas en œuvre le moteur de calcul.

Le pilote est mensuel. L’applicabilité d’une convention collective dépend de la catégorie de l’employé, comme confirmé, mais les catégories, le secteur et les conventions précises restent à établir et valider. Le CGI béninois 2026 fourni par l’utilisateur, indiqué comme mis à jour par la loi n° 2025-22 du 8 décembre 2025, est une source à analyser ; son applicabilité aux retenues salariales et aux rubriques concernées n’est pas encore vérifiée.

Aucun pack ne sera déclaré complet ou utilisable uniquement parce qu’un document a été reçu. Chaque règle concernée exige une source précise, une interprétation validée, des dates d’effet, une personne approbatrice et des cas de référence.

## 2. Périmètre et séparation des règles

Le registre pourra organiser les règles en domaines indépendants, selon les sources et besoins confirmés :

- fiscalité des rémunérations ;
- cotisations sociales, avec distinction explicite des parts concernées ;
- assurances obligatoires ou complémentaires, si applicables ;
- composantes de rémunération, avantages, retenues et assiettes ;
- contrats, catégories et conventions collectives ;
- congés, absences et calendrier de travail ;
- départ, préavis et régularisations ;
- obligations déclaratives ou états requis.

La liste est un plan de couverture, pas l’affirmation que chaque domaine ou règle s’applique à toute entreprise. Une règle légale, conventionnelle et une politique interne seront typées séparément ; une politique de l’entreprise ne remplacera jamais une obligation de droit. L’association d’un employé à une catégorie ou convention devra être explicite et documentée, jamais inférée de son poste ou du nom de l’entreprise.

Les paramètres comptables ne font pas partie du pack pays de calcul de paie : aucun compte, écriture, dossier comptable ou correspondance ne sera créé par l’activation d’une règle. Tout transfert comptable restera explicite et soumis à son propre cadrage.

## 3. Structure d’une règle

Chaque règle active devra être décrite par un enregistrement structuré contenant, selon le domaine :

- identifiant stable, intitulé, description et domaine ;
- pays, régime, catégorie d’employé, type de contrat ou autre condition d’applicabilité ;
- période de validité légale et date de prise d’effet dans PERFECTO, distinguées si nécessaire ;
- source exacte : titre, numéro/version, autorité, article/section/page, date de publication, lien ou référence documentaire ;
- interprétation métier validée, responsable de la validation et date de validation ;
- base, formule, taux, seuil, plafond, limite, arrondi, unité, devise ou part concernée uniquement si la source et le valideur les établissent ;
- règles dépendantes, exclusions et contrôles de cohérence ;
- cas de référence et résultat attendu approuvés ;
- statut, version et historique des changements.

Les champs numériques ne seront pas préremplis avec des valeurs d’exemple. Lorsque le contenu n’est pas connu ou tranché, le champ restera absent et la règle indiquée comme bloquée. Un zéro explicite ne sera utilisé que si la source ou la politique validée en prescrit réellement un.

## 4. Versions de pack et cycle de vie

Un pack aura un identifiant de pays et de domaine, une version et un état de cycle de vie. États proposés : `à documenter`, `en préparation`, `en revue`, `validé`, `applicable`, `remplacé` ou `retiré`.

Cycle proposé :

1. enregistrer la source reçue et son origine ;
2. vérifier l’édition, l’autorité, le territoire et les dates ;
3. extraire les règles candidates sans leur attribuer d’effet automatique ;
4. documenter l’interprétation, l’applicabilité et les inconnues ;
5. valider par les responsables compétents (métier et, pour le juridique, personne qualifiée désignée) ;
6. vérifier les cas de référence et les interactions entre règles ;
7. approuver une version précise avec sa période d’application ;
8. activer seulement les règles et domaines dont la couverture est confirmée.

Une version approuvée sera immuable. Une modification crée une nouvelle version liée à la précédente, avec auteur, motif, source, dates, approbation et tests. Deux versions ne peuvent s’appliquer de façon ambiguë à la même période et au même périmètre. Les intervalles manquants ou chevauchants doivent être signalés avant activation.

Les périodes historiques conserveront la version exacte qui leur a été appliquée. Une nouvelle règle ne modifiera pas rétroactivement un lot ou bulletin approuvé. Toute reprise ou correction historique devra être explicitement demandée, autorisée, justifiée et tracée par le processus de correction.

## 5. Couverture, applicabilité et blocages

L’applicabilité sera déterminée à partir de données explicites du dossier RH, de l’employé, du contrat, de la catégorie et de la période ; les valeurs sources resteront consultables. Une règle ne s’appliquera pas automatiquement par défaut si la catégorie est inconnue, ni par simple similitude avec un autre dossier.

Pour chaque période de paie et catégorie, un contrôle de couverture devra indiquer :

- les domaines requis et ceux effectivement documentés ;
- les règles validées et leurs dates de validité ;
- les paramètres manquants ou en attente de source, interprétation ou approbation ;
- les données d’employé nécessaires qui restent absentes ;
- les incompatibilités ou ambiguïtés de dates, catégories ou règles dépendantes.

Toute règle indispensable manquante bloque le calcul concerné et affiche clairement la raison. Le système ne bascule pas vers une valeur d’un autre pays, une ancienne version hors validité, une moyenne, un barème usuel ou une convention supposée. Un domaine non requis ne doit pas être présenté comme applicable simplement parce qu’il existe dans le catalogue.

## 6. Sources et gouvernance

Les sources doivent être conservées avec suffisamment de références pour qu’un réviseur puisse retrouver l’article ou le passage invoqué. Le registre distinguera : texte officiel, convention collective et avenant, instruction d’organisme, décision ou validation interne. Une source secondaire ou un tableau non officiel pourra aider à l’analyse mais ne remplacera pas la source faisant autorité.

En cas de texte incomplet, de contradiction, de doute sur l’application, de modification ou de source manquante, la règle reste en revue ou bloquée. PERFECTO ne choisira pas automatiquement entre des sources contradictoires. La décision et l’autorité de validation doivent être consignées.

Les responsabilités de saisie, de revue juridique, de validation métier, d’approbation et d’activation devront être attribuées à des rôles distincts ou explicitement autorisés. Les accès, exportations et changements de règle seront journalisés. L’activation d’un pack est une opération contrôlée, séparée de sa rédaction.

## 7. Tests et préparation du moteur (étape 12)

Chaque règle destinée au calcul devra être accompagnée de cas de référence validés couvrant les résultats ordinaires, limites, changements de dates, catégories pertinentes et interactions. Les données et résultats attendus proviendront d’une source ou d’un approbateur identifié ; aucune valeur de test ne sera présentée comme règle béninoise sans validation.

Si les sources ne fournissent pas de cas numériques, des scénarios synthétiques ne pourront être utilisés qu’après validation de leurs entrées et résultats attendus par le responsable compétent. Les contrôles structurels (dates manquantes, paramètres absents, contradictions, plafond non défini) peuvent être préparés sans fabriquer de montant légal.

L’étape 12 devra enregistrer pour chaque ligne calculée le pays, les règles et versions utilisés, leurs sources, les valeurs d’entrée et les étapes de calcul, afin de permettre une reproduction et un audit. Le présent cadrage ne met pas en œuvre cette architecture ni le moteur.

## 8. Sources déjà identifiées et manquantes

- **CGI béninois 2026 fourni par l’utilisateur :** référence Drive conservée dans le cadrage de l’étape 1 ; l’applicabilité détaillée aux retenues de salaire doit être vérifiée.
- **Droit du travail béninois :** textes applicables et versions à fournir ou identifier.
- **Conventions collectives :** textes, secteur, classifications et avenants à confirmer ; leur applicabilité dépendra de la catégorie de l’employé.
- **CNSS / protection sociale :** barèmes, assiettes, plafonds, parts, exemptions et dates d’effet à fournir et vérifier.
- **Assurances :** règles, contrats ou décisions et responsabilités applicables à confirmer.
- **Règles internes :** catégories, calendrier, rubriques, circuits d’approbation et autres politiques à documenter séparément du droit.

Une source reçue doit être examinée et validée avant de transformer son contenu en règle active.

## 9. Décisions et validations à compléter

- Qui validera les interprétations métier et juridiques, et qui sera autorisé à activer chaque version ?
- Quelles catégories d’employés et conventions collectives précises s’appliquent à l’entreprise ?
- Quels textes officiels et barèmes béninois seront fournis pour le travail, la CNSS, les assurances, les congés et les départs ?
- Pour le CGI fourni, quelles rubriques et dispositions s’appliquent effectivement à la paie, à partir de quelles dates ?
- Quelle preuve de version et de validité l’entreprise exige-t-elle pour chaque source (document officiel, référence, date de consultation) ?
- Quels cas de référence ou résultats attendus seront fournis/validés pour tester chaque règle ?
- Quels domaines sont obligatoires pour le premier lancement, et quels domaines doivent demeurer bloqués tant que leurs sources manquent ?

## 10. Critères d’acceptation proposés

1. Chaque règle est liée à un pays, un domaine, un périmètre d’applicabilité et des dates d’effet explicites.
2. Toute règle active a une source précise, une interprétation approuvée, un approbateur et des cas de référence validés.
3. Les packs et règles approuvés sont immuables ; une correction crée une nouvelle version historisée.
4. Les domaines, catégories, périodes ou paramètres incomplets sont signalés et bloquent uniquement le calcul concerné, sans valeur de repli implicite.
5. Aucune règle n’est déduite du nom d’une rubrique, d’un employé, d’un compte ou d’un autre pays.
6. Les règles internes sont distinguées des textes officiels, conventions et instructions d’organismes.
7. Aucun résultat antérieur approuvé n’est modifié silencieusement lors d’une mise à jour de règle.
8. Aucun taux, montant, assiette, formule, classification, valeur de test juridique ou compte comptable n’est inventé ou activé par défaut.

**Étape suivante du plan :** l’étape 12 cadrera le moteur de calcul et les lots, uniquement sur la base de règles effectivement validées. Aucune règle légale béninoise n’est activée par cette fiche.