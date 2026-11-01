# Étape 1 — Cadrage métier et règles du pays pilote

**Statut :** en cours — cadrage fonctionnel amorcé, validation juridique et paramètres de calcul non terminés.  
**Pays pilote et pays par défaut :** Bénin.  
**Plan complet :** [Proposition d’implémentation Paie & RH](proposition-implementation-paie-rh.md).

## 1. But de l’étape

Définir les périmètres métier, les catégories de salariés, les sources de règles, les responsabilités de validation et les choix d’entreprise nécessaires avant de construire le moteur de paie. À cette étape, on prépare un catalogue de règles et de preuves ; on n’active aucun taux, plafond, durée légale, formule ou indemnité non validés.

## 2. Décisions fonctionnelles déjà confirmées

- Paie & RH dispose de ses **dossiers clients et menus propres**, indépendants de la Comptabilité générale.
- Le **Bénin est le pays pilote et le pays proposé par défaut** ; la conception prévoit des packs distincts et versionnés par pays.
- Chaque employé, contrat, congé, mission, lot, bulletin et document doit être rattaché à un dossier RH précis.
- Les profils employés comprennent les informations professionnelles demandées, avec protection renforcée pour les informations bancaires, familiales, médicales, les évaluations, la discipline et les photos.
- Les catégories de congés incluent au minimum annuel, maternité, paternité, maladie, accident et d’autres catégories configurables.
- Le débauchage désigne, dans le vocabulaire du projet, le **départ de l’employé de l’entreprise** pour licenciement ou toute autre raison.
- Les missions, affectations, travailleurs intérimaires, registres, états, éditions et une centralisation comptable explicite sont au périmètre du plan.
- L’association à un dossier comptable est facultative et ne sera jamais déduite du nom ou du code client.

## 3. Décisions prises pour le cadrage initial

- **Périodicité du pilote : mensuelle.** Cette décision fixe le cycle initial de travail ; elle ne remplace pas une vérification des obligations légales applicables.
- **Conventions collectives : applicabilité déterminée selon la catégorie de l’employé.** La catégorie et la convention exacte devront être documentées et juridiquement validées avant tout effet sur la paie.
- **Sources : l’utilisateur fournira les textes officiels ; le CGI est également nécessaire.** Le CGI béninois 2026 déjà référencé est conservé comme source fiscale à analyser. Les textes du travail, conventions, barèmes CNSS et règles d’assurance restent attendus.

## 4. Inventaire initial des sources

| Domaine | Sources à recueillir et examiner | État du cadrage |
|---|---|---|
| Fiscalité des salaires | CGI béninois applicable, textes modificatifs et instructions officielles sur les retenues salariales | [CGI béninois 2026 fourni par l’utilisateur](https://drive.google.com/file/d/1uCBIo5qHOm3FIeAOp0s05mFONBzLVJuK/view?usp=sharing), indiqué comme mis à jour par la loi n° 2025-22 du 8 décembre 2025 ; l’applicabilité aux retenues salariales et les rubriques précises restent à vérifier. |
| Droit du travail | Code du travail, décrets et textes d’application en vigueur | Source officielle complète et version applicable à fournir ou à identifier. |
| Conventions collectives | Convention(s) applicable(s) à l’activité, avenants et classifications | Secteur, convention et périmètre à confirmer ; aucune convention n’est présumée. |
| Protection sociale | Textes et barèmes officiels de la CNSS ou de tout régime concerné | Barèmes, assiettes, plafonds, parts et dates d’effet à documenter. |
| Assurances | Textes et décisions applicables aux assurances obligatoires ou complémentaires | Types d’assurance, responsabilités, bases et paramètres à confirmer. |
| Congés et absences | Textes officiels sur congés annuels, maternité, paternité, maladie, accident et autres absences | Durées, éligibilité, rémunération, justificatifs et traitement paie non renseignés tant qu’ils ne sont pas validés. |
| Départ / débauchage | Textes sur licenciement, démission, fin de contrat et autres motifs de sortie | Parcours fonctionnel confirmé ; délais et effets financiers à sourcer et valider. |
| Règles internes de l’entreprise | Calendrier de paie, heures et calendrier de travail, rubriques, circuit d’approbation, pièces et rôles | À définir par entreprise cliente ; ne pas assimiler à une obligation légale. |

Une recherche initiale dans les fichiers Drive consultés n’a pas fait ressortir de document sur les conventions collectives ou les barèmes CNSS. Cette absence de résultat n’établit pas que ces sources n’existent pas : elles restent à fournir ou à rechercher dans un espace documentaire approprié.

## 5. Registre des paramètres à valider

Chaque règle devra être enregistrée avec : pays, régime ou catégorie concernée, intitulé, formule ou valeur, base de calcul, responsable (salarié/employeur/organisme), limites éventuelles, date de début et de fin d’effet, source exacte, date de vérification, validateur, jeux de tests et statut (`à documenter`, `à valider`, `validée`, `retirée`).

Le registre couvrira au minimum :

- salaires, primes, avantages, heures supplémentaires, retenues et absences ;
- impôt sur salaire et assiette imposable ;
- cotisations sociales et assurances, avec distinction des parts salariales et employeur ;
- plafonds, seuils, exonérations, prorata, arrondis et échéances ;
- acquisition et décompte des congés ;
- congés maternité, paternité, maladie et accident ;
- traitement de l’intérim et fin de mission ;
- préavis, indemnités, congés dus et régularisations à la sortie ;
- pièces et états exigés par les administrations ou organismes concernés.

Aucune ligne du registre ne devient une règle de calcul tant que la source, les dates d’effet et la validation métier/juridique ne sont pas renseignées. Une formule non confirmée reste bloquée et affichée comme telle.

## 6. Points de décision de l’entreprise

Les choix ci-dessous concernent le paramétrage de l’entreprise, et non l’interprétation de la loi :

1. **Périodicité de paie** : mensuelle confirmée pour le pilote ; les autres périodicités resteront configurables si elles sont nécessaires.
2. **Convention collective** : la règle de sélection par catégorie d’employé est confirmée. Il reste à identifier les catégories, le secteur et la convention exacte à appliquer, avec source et validation compétente.
3. **Catégories à prendre en charge au démarrage** : contrats et travailleurs intérimaires à prioriser ; les autres catégories pourront être ajoutées par configuration validée.
4. **Rubriques de rémunération** : lister les rubriques effectivement utilisées par l’entreprise, leurs justificatifs et approbateurs, sans leur attribuer de traitement fiscal ou social avant validation.
5. **Calendrier de travail** : jours travaillés, repos, jours fériés et règle de décompte des absences par dossier, une fois établis.
6. **Approbation** : désigner les rôles autorisés à saisir, contrôler, approuver, verrouiller et rouvrir un lot.
7. **Départ de l’employé** : définir les étapes internes, les motifs à tracer, les personnes à informer, la restitution des biens et la désactivation des accès.
8. **Missions et affectations** : confirmer si les missions incluent les déplacements, qui approuve les missions et si des avances ou remboursements seront suivis.

## 7. Critères de sortie de l’étape 1

L’étape 1 sera considérée cadrée lorsque :

- le pays, les catégories de personnel et la périodicité initiale sont confirmés ;
- les sources officielles et conventions applicables sont identifiées avec leurs versions ;
- une personne compétente métier/juridique est désignée pour valider chaque famille de règles ;
- les choix internes sont distingués des exigences légales ;
- le registre des règles et jeux de test est prêt, sans valeurs inventées ;
- les règles encore inconnues sont listées comme blocages, et non remplacées par des hypothèses.

**Prochaine activité :** compléter l’inventaire des sources béninoises et répondre aux points encore ouverts de la section 6. L’étape 2 (navigation indépendante) peut être préparée en parallèle, mais les calculs de paie ne démarreront qu’après validation des paramètres concernés.