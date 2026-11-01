# Étape 7 — Débauchage et départ de l’entreprise

**Statut :** proposition de cadrage à valider avant implémentation.  
**Dépendances :** dossiers RH (étape 3), profil employé (étape 5), contrats et embauche (étape 6).  
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Sens et objectif

Dans PERFECTO, **« débauchage » désigne la sortie de l’employé de l’entreprise**, que ce soit par licenciement ou pour toute autre raison. Le terme couvre donc le processus général de départ et ne préjuge pas de son motif ni de sa qualification juridique.

L’étape vise à tracer la décision et sa date d’effet, les validations et pièces, la fermeture des accès appropriés et les éléments de clôture restant à traiter, tout en conservant l’historique de la personne, de ses contrats et de ses paies. Elle ne supprime pas la fiche employé.

Aucun préavis, indemnité, congé dû, retenue, régularisation, solde ou document légal de fin d’emploi ne sera calculé ou produit automatiquement avant validation des textes applicables, du contrat et des règles métier. Aucun lien avec un dossier comptable ne sera créé implicitement.

## 2. Départ de l’entreprise et fin de contrat

Il faut distinguer :

- **fin ou modification d’un contrat**, qui affecte un contrat précis ;
- **départ de l’entreprise**, qui clôt la relation de travail de la personne avec l’entreprise ;
- **fin d’une affectation ou d’une mission temporaire**, qui ne signifie pas nécessairement départ de l’entreprise.

Une fin de contrat ne déclenchera donc pas automatiquement le départ de l’employé. Le responsable habilité devra confirmer explicitement si la personne quitte l’entreprise, si un autre contrat ou une autre relation reste actif, et la date d’effet applicable. Les travailleurs intérimaires suivis pour une mission chez l’entreprise utilisatrice ne seront pas traités comme ses employés, sauf relation d’emploi explicitement établie.

## 3. Parcours de départ proposé

Parcours configurable, avec historique des changements et de leurs auteurs :

1. **Préparation** : signaler un départ envisagé, sans changer le statut actif de l’employé ;
2. **Motif et décision** : saisir le motif, la source de la décision, la date de décision et les approbateurs requis ;
3. **Vérification contractuelle** : identifier le ou les contrats concernés, leur période et les pièces disponibles ; relever les règles de préavis ou autres contrôles uniquement si elles ont été validées ;
4. **Date d’effet confirmée** : enregistrer séparément la date de décision, la date de notification si utile et la date effective de sortie ;
5. **Liste de clôture** : suivre les tâches et pièces en attente, leurs responsables et leur statut ;
6. **Prise d’effet** : marquer la relation d’emploi comme sortie à la date approuvée, selon les droits et règles de l’entreprise ;
7. **Clôture administrative** : contrôler les éléments en attente et archiver le dossier d’emploi conformément à la politique de conservation.

La préparation d’un départ ne désactive pas prématurément les accès et ne change pas l’éligibilité à la paie. Une décision ou date modifiée après approbation doit être tracée et confirmée par un rôle autorisé. Une annulation avant la date d’effet devra conserver l’historique de l’événement annulé plutôt que l’effacer.

## 4. Informations à enregistrer

Selon le besoin et les règles applicables :

- employé et dossier RH concernés, identifiants stables ;
- nature de l’événement : départ de l’entreprise ou fin d’un contrat seulement ;
- motif choisi dans une nomenclature configurable, avec précision complémentaire limitée ;
- dates distinctes de décision, notification, dernier jour travaillé s’il est connu, et effet ;
- contrat(s) concernés et vérification des éventuelles autres relations actives ;
- décideur, approbateurs, dates et historique des validations ;
- documents reçus, transmis ou à remettre, avec statut de vérification ;
- tâches de clôture, responsable, échéance configurée et résultat ;
- informations nécessaires au contrôle des traitements de paie, sans calcul automatique.

Les motifs pourront être configurés par l’entreprise. Des exemples comme démission, licenciement, fin de contrat, retraite, décès, transfert ou autre cause servent uniquement à illustrer la nomenclature ; ils ne déterminent ni les documents exigibles, ni un régime juridique ou une conséquence financière. Le détail du motif sera accessible uniquement aux rôles autorisés.

## 5. Clôture des accès et conservation

Le statut de départ et la révocation des accès sont deux actions liées mais distinctes. À la date applicable et selon les droits, les responsables désignés pourront révoquer les accès à PERFECTO ou demander la clôture des accès externes, par exemple aux outils de l’entreprise. Le module ne prétendra pas désactiver un compte ou un badge d’un système externe sans intégration réelle et confirmée.

La révocation ne supprimera pas la fiche ni les contrats, historiques d’affectation, événements ou bulletins. Après le départ, l’employé pourra passer en consultation restreinte ou être masqué des listes actives ; les documents et données seront conservés, anonymisés ou supprimés uniquement selon la politique et les durées validées. Les informations sensibles resteront soumises à des permissions adaptées.

## 6. Éléments de clôture à suivre, sans présumer leur résultat

La liste peut inclure des tâches configurables, par exemple : restitution de matériel, fermeture de comptes externes, remise/récupération de pièces, confirmation des éléments variables, vérification des congés ou absences, traitement du dernier bulletin et archivage. Ces exemples ne signifient pas que chaque tâche est obligatoire ni qu’un solde est dû.

Les tâches pourront avoir les états « à vérifier », « en cours », « terminé », « non applicable » ou un état défini par le client, avec responsable, justification et pièce lorsque nécessaire. Le système distinguera clairement les éléments **à vérifier**, **validés** et **calculés** ; une tâche cochée ne créera pas d’écriture comptable ni de paiement.

Le traitement du dernier salaire et des corrections éventuelles passera par le cycle de paie normal et ses contrôles. Les préavis, indemnités, congés non pris, retenues, remboursements, cotisations et soldes ne seront renseignés qu’après validation des règles applicables et d’une source de données fiable. Aucune avance ou paiement ne sera marqué comme effectué sans preuve ou saisie explicite autorisée.

## 7. Contrôles, droits et audit

- Seuls les rôles habilités peuvent initier, approuver, modifier ou annuler un départ.
- Une double approbation pourra être activée si la politique du client le requiert ; elle n’est pas présumée par défaut.
- Les dates, motifs, pièces et décisions sont historisés ; une modification après approbation laisse une trace et exige une confirmation.
- Les dates incohérentes, contrats manquants ou relations actives non examinées déclenchent des avertissements ou blocages configurés, non une correction automatique.
- La consultation et l’export des informations de départ sont limités et journalisés selon la politique définie.
- Un dossier sorti reste isolé dans son dossier RH et n’est pas visible dans un autre dossier sans autorisation explicite.

## 8. Décisions à valider avant réalisation

- Quels motifs de sortie et quels libellés l’entreprise souhaite-t-elle, sans leur attribuer d’effet juridique avant validation ?
- Qui peut initier et approuver le départ ? Une ou plusieurs validations sont-elles nécessaires selon le motif ?
- Quelles dates doivent être enregistrées dans chaque cas, et quelle date commande la fin d’accès aux systèmes de l’entreprise ?
- Comment traiter une fin de contrat lorsqu’un autre contrat ou une autre fonction reste actif ?
- Quelles tâches de clôture et quels justificatifs sont réellement requis par l’entreprise ?
- Quelles personnes ou intégrations sont responsables de révoquer les accès externes et de confirmer leur clôture ?
- Quelle politique de conservation, d’archivage et de restriction post-départ appliquer aux données et documents ?
- Quelles sources officielles et règles contractuelles valideront préavis, indemnités, congés dus, régularisations et documents de sortie ?

## 9. Critères d’acceptation proposés

1. Le parcours couvre le licenciement et toute autre cause de sortie, conformément au sens défini de « débauchage ».
2. Une fin de contrat ou de mission n’est pas assimilée automatiquement à un départ de l’entreprise.
3. Motif, décisions, dates, pièces, approbations et modifications sont historisés et accessibles selon les droits.
4. L’accès est révoqué uniquement par les personnes autorisées, au moment confirmé ; la fiche historique n’est jamais supprimée par le départ.
5. Les tâches de clôture restent des suivis explicites et ne valent pas preuve de paiement, écriture comptable ou calcul de solde.
6. Aucun préavis, indemnité, congé dû, retenue ou solde final n’est calculé sans règles vérifiées, versionnées et applicables au contrat.
7. Aucun motif, montant, statut juridique ou donnée personnelle n’est inventé pour un dossier réel ou un jeu de test.

**Étape suivante du plan :** l’étape 8 cadrera les affectations et missions. Aucun élément de cette fiche n’implémente le parcours ni les calculs de départ.