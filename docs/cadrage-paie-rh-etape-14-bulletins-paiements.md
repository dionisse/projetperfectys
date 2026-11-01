# Étape 14 — Bulletins et suivi des paiements

**Statut :** proposition de cadrage à valider avant implémentation.
**Dépendances :** lot calculé, contrôlé, approuvé et verrouillé (étapes 12–13), règles applicables et données sources validées. Le pilote est mensuel et béninois.
**Plan complet :** [Plan d’implémentation Paie & RH en 18 étapes](proposition-implementation-paie-rh.md).

## 1. Objectif et limites

Produire un bulletin de paie à partir d’une version de lot approuvée, puis suivre séparément les paiements réellement exécutés à partir des références et preuves fournies par l’utilisateur. Le bulletin est un document sensible lié à un employé, une période, un dossier RH et un lot précis.

Aucun bulletin final ne sera généré depuis un brouillon, un aperçu partiel ou un lot non approuvé. Aucun paiement ne sera déclaré effectué par le seul fait de générer un bulletin, d’approuver un lot, d’exporter un fichier, de saisir une intention de paiement ou de renseigner des coordonnées bancaires. Sans source ou preuve vérifiable, le statut restera à confirmer.

Cette étape ne détermine pas les mentions légalement obligatoires, les modèles officiels, les retenues, les rubriques, les montants ou la devise. Ces éléments exigent des règles et sources validées. Les impressions et formats d’export relèvent de l’étape 17 ; la centralisation comptable reste explicitement séparée.

## 2. Source et génération du bulletin

Chaque bulletin devra référencer :

- le dossier RH, l’employé et la période mensuelle concernés ;
- l’identifiant du lot, la version approuvée et l’exécution de calcul correspondante ;
- le snapshot des données et versions de règles utilisé pour le calcul ;
- la date de génération, l’auteur ou le processus autorisé et l’état du document ;
- un identifiant de bulletin, selon une politique de numérotation définie par l’entreprise.

Le bulletin présentera les rubriques et résultats provenant de l’exécution approuvée, avec les détails requis par les textes et règles validés. Les montants calculés seront distingués des informations descriptives et d’éventuelles sommes réellement payées. Les parts salarié et employeur seront séparées lorsqu’elles sont requises et documentées. Aucun intitulé ou rubrique ne sera classé selon son seul nom.

Les mentions légales et contractuelles, l’ordre et le libellé des rubriques, les informations d’identification, la langue, les dates et le niveau de détail devront être confirmés pour le Bénin avant de qualifier le document de bulletin final conforme. L’interface et les documents destinés au pilote seront en français, sans que cela remplace une validation des mentions requises.

Un aperçu de contrôle pourra être préparé avant émission, mais il sera clairement marqué **aperçu/non final** et ne pourra pas être confondu avec un bulletin final. Le rendu imprimable et les formats (PDF, autres formats, filigranes ou signatures éventuelles) seront cadrés à l’étape 17.

## 3. États et corrections des bulletins

États proposés : aperçu, prêt à émettre, émis, remplacé/corrigé ou annulé, selon les droits et la politique validée. Un bulletin final ne peut être émis que depuis un lot approuvé et verrouillé et après vérification des contrôles qui le concernent.

Si une erreur est détectée après émission :

- le document d’origine et son lien vers le lot restent conservés ;
- une demande de correction, sa raison et son approbateur sont tracés ;
- toute correction de données source suit d’abord le parcours autorisé, puis le processus de correction/réouverture défini à l’étape 13 ;
- une nouvelle version ou pièce rectificative est liée à l’original et porte clairement son statut ;
- l’ancien bulletin n’est ni écrasé, ni présenté silencieusement comme la version en vigueur.

La façon de signaler légalement un bulletin rectificatif ou remplacé devra être vérifiée dans les textes applicables. Le système n’inventera pas d’effet rétroactif ni de montant de régularisation.

## 4. Confidentialité et remise à l’employé

Les bulletins ne seront visibles que par les rôles autorisés et l’employé concerné, si un mécanisme d’accès employé est retenu. Une remise ou consultation devra être horodatée et auditable, sans révéler le document à un autre dossier ou employé.

Les données bancaires complètes ne seront pas affichées sur le bulletin à moins d’une exigence validée. Les exports et impressions devront masquer les informations non nécessaires et suivre les permissions de la donnée source. Le lien vers le bulletin ne constituera pas un accès public ; les documents seront stockés et transmis par un mécanisme protégé défini avant production.

Canal de remise, accusé de réception, signature, durée de conservation et accès au bulletin après le départ de l’employé restent à définir. Une simple génération ne prouve pas que l’employé l’a reçu ou consulté.

## 5. Suivi des paiements

Le suivi du paiement est un registre distinct du bulletin et du calcul. Pour chaque paiement réellement documenté, enregistrer, selon les informations disponibles :

- le dossier RH, l’employé, la période, le bulletin ou la somme concernée ;
- le montant et la devise confirmés par la source ;
- le statut (à préparer, en attente, transmis, confirmé, partiellement réglé, rejeté, annulé ou autre statut configuré) ;
- la date effective indiquée par la preuve, le moyen ou canal si connu et sa référence source ;
- document ou preuve reçue, acteur de la saisie et date d’enregistrement ;
- corrections, échecs, retours ou écarts signalés avec leur motif et historique.

Les statuts ne seront activés qu’avec une définition claire et les preuves attendues. « Transmis » ou « en cours » ne signifie pas « payé ». « Payé » exige une source réellement fournie et vérifiée selon la procédure de l’entreprise ; les coordonnées bancaires seules ne constituent pas une preuve de transfert.

Si un paiement groupé concerne plusieurs employés, les allocations à chaque bulletin devront être explicites et étayées par la source. Un montant global ne sera pas relié arbitrairement à un employé unique ou réparti entre plusieurs bulletins. Les paiements partiels ou multiples ne seront suivis que si l’entreprise définit les règles d’allocation, de solde et de preuve ; aucune différence ne sera automatiquement qualifiée de trop-perçu ou de reliquat dû.

Ce registre de suivi ne déclenche pas le transfert bancaire, ne confirme pas une transaction via un système externe non intégré, ne crée aucune écriture comptable et ne rapproche pas les paiements avec un dossier comptable. Toute intégration ou centralisation fera l’objet d’un cadrage et d’une confirmation explicites.

## 6. Numérotation, preuve et journalisation

La politique de référence du bulletin (séquence par dossier, période ou autre) reste à décider ; aucun numéro ne sera déduit d’un identifiant comptable ou d’un dossier client ressemblant. Les références de transaction et documents de paiement devront être reproduites telles que fournies, avec leur provenance.

Journaliser la génération, l’émission, l’accès, le téléchargement ou la remise lorsqu’ils sont disponibles, les corrections, les preuves de paiement enregistrées, les changements de statut et les acteurs. Le journal ne modifie pas la preuve source et distingue l’horodatage de saisie de la date réellement mentionnée par le justificatif.

## 7. Décisions à valider avant réalisation

- Quelles mentions et rubriques sont obligatoires sur un bulletin au Bénin, et quelles sources les établissent ?
- Quel identifiant ou mode de numérotation utiliser par dossier RH et période ?
- Qui peut prévisualiser, émettre, corriger, annuler et consulter un bulletin ?
- Le salarié aura-t-il un accès direct sécurisé, et quel canal de remise/accusé de réception est souhaité ?
- Quelle politique de conservation et d’accès post-départ appliquer ?
- Quels statuts de paiement utiliser et quelle preuve autorise le statut « confirmé/payé » ?
- Les paiements partiels, multiples, groupés ou rejetés doivent-ils être suivis ? Quelle preuve permet l’allocation par employé ?
- Quel niveau de données bancaires apparaît sur le bulletin, si une mention est requise ?
- Quel document ou référence réelle est acceptable comme preuve, et qui la vérifie ?
- Quels formats, signatures, filigranes ou besoins d’impression seront spécifiés à l’étape 17 ?

## 8. Critères d’acceptation proposés

1. Un bulletin final n’est générable qu’à partir d’une version de lot approuvée et verrouillée ; les aperçus sont clairement non finaux.
2. Chaque bulletin est relié au bon dossier RH, employé, période, lot, snapshot et versions de règles.
3. Les rubriques et montants correspondent au calcul approuvé et ne peuvent être modifiés directement dans le bulletin.
4. Une correction conserve le document d’origine, sa raison, son autorisation et le lien vers sa version rectifiée.
5. L’état de paiement reste distinct de la génération et de l’approbation ; le statut payé exige une preuve ou source vérifiable.
6. Les paiements groupés ne sont attribués aux employés qu’avec une allocation explicite appuyée par la source ; aucun lien agrégé trompeur n’est créé.
7. Aucune preuve de paiement, référence de transaction, somme, mention légale ou coordonnée bancaire n’est inventée.
8. Bulletins et preuves sont protégés par dossier et rôle ; génération, consultation et corrections sont tracées.
9. Aucun paiement ou écriture comptable n’est créé ou confirmé automatiquement par ce registre.

**Étape suivante du plan :** l’étape 15 cadrera les registres RH et de paie consultables, avec traçabilité, filtres et droits. Cette fiche ne met pas en œuvre l’émission, le stockage sécurisé ou les transferts.