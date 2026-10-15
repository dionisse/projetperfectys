# Perfectys Compta

Comptabilité générale **SYSCOHADA révisé**, construite sur le modèle **Sage 100 Comptabilité**,
avec le **Bénin** comme pays pilote (devise XOF, IFU, TVA 18 %).

Application web de bureau d'abord, disponible hors ligne ; l'hôte Windows installable viendra sur
la même base.

## État du dépôt

| Contenu | Emplacement |
|---|---|
| **Application** (noyau métier, interface, point d'entrée web) | `compta/` |
| Noyau : montants, calendrier, comptes, lots, taxes, grand livre, dossier | `compta/src/noyau/` |
| Référentiel SYSCOHADA révisé | `compta/src/noyau/referentiels/syscohada.ts` |
| Paquet pays Bénin (taux, IFU, calendrier déclaratif) | `compta/src/noyau/pays/benin.ts` |
| Coquille et écrans | `compta/src/ui/` |
| Tests (noyau et interface) | `compta/test/` |
| Cadrage de la refonte Sage 100 / Bénin | `docs/CADRAGE-SAGE100-BENIN.md` |
| Relevé des guides Sage et des paramètres fiscaux béninois | `docs/specs/SPEC-MODELE-SAGE-BENIN.md` |
| Documentation du logiciel d'origine PERFECTO | `docs/specs/SPEC-ORIGINAL-PERFECTO.md`, `docs/specs/INDEX.md` |
| **Ancienne application TypeScript, archivée** (non importée, hors build et hors tests) | `legacy/perfecto-typescript/` |
| Code .NET d'origine, référence gelée | `legacy/dotnet-0.2.0-preview.1/` |
| Déploiement Vercel | `vercel.json`, `docs/DEPLOIEMENT-VERCEL.md` |

## Démarrer

```bash
npm install            # installe l'espace de travail (compta)
npm test               # 218 tests : noyau en Node, interface en jsdom, exports vérifiés
npm run typecheck      # TypeScript strict, sans émission
npm run build          # build de production dans compta/dist
npm run preview:vercel # sert le build comme le ferait Vercel, sur http://localhost:5173
npm run dev            # serveur de développement Vite
```

## Ce qui fonctionne aujourd'hui

- **Coquille Sage 100** : barre de menus française (Fichier, Édition, Traitements, Structure,
  Interrogation, États, Outils, ?), barre d'état rappelant en permanence dossier, société,
  exercice, période, référentiel, devise, session, stockage et équilibre du grand livre.
- **Structure** : plan comptable segmenté et filtrable (55 comptes, 10 classes, 22 groupes
  d'états), journaux, fichier des tiers avec les codes de taxe applicables à chaque tiers, codes
  de taxe et impôts annuels du paquet pays.
- **Traitements** : **saisie des écritures en table de détail** (grille navigable au clavier,
  compte segmenté et tiers synchronisés, libellé pré-rempli depuis le plan, échéance par ligne),
  ouverture d'un lot, modification de son en-tête, marquage « prêt à comptabiliser »,
  comptabilisation atomique, remise en saisie, retrait d'une écriture en brouillon, suppression
  d'un lot non comptabilisé, **contre-passation** d'un lot comptabilisé (l'original reste intact).
- **Taxes en saisie** : l'utilisateur coche les codes de taxe applicables à l'opération — la liste
  dépend du journal, du tiers et de l'exportation — et le noyau **calcule et affiche** les lignes de
  taxe correspondantes, dans le bon sens (une retenue à la source va à l'inverse de la charge).
  Elles apparaissent dans la grille, marquées comme générées, et restent modifiables : rien n'est
  inséré en silence à la comptabilisation. L'équilibrage propose la contrepartie sur un compte
  choisi, complété du tiers quand il est connu.
- **Brouillon conservé** : une saisie entamée survit à un changement d'écran (mémoire de session,
  par lot) ; elle est effacée à l'enregistrement ou sur demande explicite.
- **Rapprochement bancaire** : un relevé se saisit tel que la banque le donne — date, référence
  (numéro de chèque, de virement, de remise), libellé, montant au sens de la banque, positif quand
  l'argent entre. L'écran confronte ce relevé au compte de trésorerie : les deux soldes, l'écart, la
  part que les suspens de la période expliquent, ce que les périodes antérieures ont laissé, et
  **ce qui reste inexpliqué**. Le pointage rapproche une ligne d'un mouvement, par référence d'abord
  puis par montant exact, et refuse deux montants différents : rapprocher un règlement partiel
  masquerait une écriture manquante, et c'est précisément ce que l'état doit révéler. Un pointage se
  défait sans effacer sa trace.
- **Clôture d'exercice** (le *Create New Year* de Sage) : un **rapport de préparation** montre avant
  toute écriture ce qui s'y oppose — périodes ouvertes, lots en attente, grand livre déséquilibré,
  soldes initiaux posés dans le plan — et le contenu ligne à ligne des deux écritures qui seraient
  passées. La clôture solde les comptes de gestion vers le compte 121000, reporte les comptes de
  bilan **segment de tiers compris** au premier jour de l'exercice suivant, ouvre cet exercice avec
  ses périodes, et archive l'exercice clos avec toutes ses périodes clôturées. Elle est définitive :
  plus aucune écriture n'entre dans un exercice clos, et chaque exercice est consultable séparément.
- **Lettrage des comptes de tiers** : situation compte par compte (solde comptable **et** solde non
  lettré, plus ancienne ligne non rapprochée), lignes à lettrer cochables, lettrage manuel d'une
  sélection, **lettrage automatique proposé avant d'être appliqué** (montants exactement égaux, un
  contre un ou un contre deux ou trois), délettrage. Une marque n'écrit aucune écriture : elle
  rapproche des lignes déjà comptabilisées. Un groupe déséquilibré est refusé, l'écart affiché, et le
  bouton grisé porte la raison. Un délettrage ne supprime pas la marque : il la date.
- **Interrogation** : balance filtrable par période, journal par pièce avec son détail, grand livre
  à solde progressif par compte (comptes auxiliaires compris), et **interrogation de compte** —
  l'écran du quotidien : un compte ou un segment de tiers (`401100-FOU01`), une fenêtre libre, le
  **solde après chaque ligne** qui part du solde réel à l'ouverture de la fenêtre (à-nouveaux
  compris, jamais de zéro inventé), les marques de **lettrage** et de **pointage bancaire** portées
  sur les lignes qu'elles concernent, les lignes d'un **exercice clos** dites figées avec le rappel
  qu'une correction passe par l'exercice en cours, l'**historique par exercice** (solde reporté,
  totaux, état clos ou en cours), la comparaison à l'exercice précédent, et ce qui reste **à lettrer
  et à pointer**. La liste des comptes qui ont bougé, avec leurs tiers, sert de point de départ.
  Export CSV de la fenêtre interrogée.
- **États** : **bilan OHADA révisé** (actif en brut, amortissements et net ; passif en net ;
  résultat de l'exercice porté aux capitaux propres) et **compte de résultat OHADA révisé** (les
  six résultats du modèle révisé, du résultat d'exploitation au résultat net), chacun établi à la
  clôture de l'exercice **ou à la fin d'une période** — un arrêté intermédiaire est cumulé depuis le
  1er janvier. L'équilibre du bilan est contrôlé et affiché en tête ; le compte de résultat vérifie
  que le résultat présenté égale la somme algébrique des comptes de gestion de la balance. Les deux
  écrans détaillent les comptes qui alimentent chaque rubrique, annoncent les rubriques qu'aucun
  solde n'alimente et listent les comptes qui ne participent à aucun état. Le bilan présente une
  **colonne N-1** dès qu'un exercice est clos — et dit qu'il ne peut pas la produire tant qu'aucun
  exercice ne l'est. Un exercice clos lit son résultat dans le compte 121000 ; le compte de résultat
  ignore l'écriture de clôture, qui en est la conséquence et non un élément de l'activité.
- **États** : **déclaration TVA mensuelle** recalculée depuis le grand livre — bases, taux, taxes,
  retenue de TVA sur marchés publics, crédit antérieur imputé, taxe nette à payer ou crédit à
  reporter — avec un **rapprochement compte par compte** entre ce que les codes de taxe produisent
  et ce que la période contient. Un écart (une taxe saisie à la main, un code oublié sur une base)
  est affiché en alerte, jamais absorbé dans un total. L'écran est un état de contrôle : il ne
  prétend pas reproduire l'imprimé officiel, dont la mise en page n'a pas été relevée dans le texte
  juridique.
- **Export au choix de l'utilisateur : Excel, CSV ou PDF.** Les treize écrans qui produisent un
  état portent un bouton **Exporter…** qui déplie les trois formats. Le CSV garde ses conventions de
  cabinet francophone (point-virgule, BOM UTF-8, fins de ligne CRLF — ce qu'Excel en français
  attend). L'**Excel** est une vraie feuille de calcul : un onglet par section, les montants en
  **nombres entiers** au format `#,##0` (le franc CFA n'a pas de centimes, aucun format n'en
  invente), les dates en ISO, un volet figé sous la ligne de titres, un filtre automatique, une mise
  en page A4 ajustée en largeur avec répétition des titres, et les totaux en gras. Le **PDF** est un
  document imprimé : A4, portrait ou paysage selon la largeur du tableau, en-tête de société complet
  en page 1 puis en-tête compact, paramètres de l'édition, mention finale, « Page n/N ». Les trois
  formats partent de la **même description** du document, donc des mêmes chiffres, et exportent ce
  que l'écran affiche au moment du clic, filtres compris. Excel et PDF sont chargés à la demande :
  leur poids ne pèse pas sur le démarrage, seulement sur le premier export dans ce format.
- **Outils** : piste d'audit ajout-seulement, séquencée, attribuée et horodatée ; réinitialisation
  du dossier de démonstration.
- **Hors ligne** : le dossier est persisté dans IndexedDB, montants sérialisés en chaînes.

## Ce qui est annoncé comme non implémenté

Les entrées de menu correspondant à des fonctions non livrées sont **visibles, grisées, et portent
la tranche qui les livrera** en infobulle. Elles ne sont pas cliquables : aucun lien mort, aucun
écran vide. Import d'un fichier de relevé bancaire (CSV, OFX, CAMT — le relevé se saisit ligne à
ligne en attendant), lettrage partiel d'un règlement à-compte, écritures récurrentes, **réouverture d'un exercice clos**
(la clôture est définitive dans cette version : la correction d'un exercice clos passe par une
écriture dans l'exercice en cours, et l'écran le dit), affectation du résultat décidée en assemblée
(121000 vers 111000 ou 112000), interrogation d'un compte par montant ou par lettre et appel d'une
écriture depuis une ligne d'interrogation, tableau des flux de
trésorerie et tableau de variation des activités (le plan de démarrage ne porte aucun compte classé
« flux de trésorerie » : l'entrée de menu le dit au lieu de produire un état vide),
reversement des acomptes et retenues à la source, imports, habilitations par écran, sauvegarde
et restauration.

## Décisions de conception

1. **Montants entiers exacts.** `bigint` en unités mineures de la devise. Aucun flottant : une
   comptabilité qui arrondit mal n'est pas opposable. Le XOF n'a pas de décimale, donc une saisie à
   deux décimales est refusée, pas arrondie en silence.
2. **Le lot est l'unité de travail**, comme chez Sage : on ouvre un lot, on y saisit, on le déclare
   prêt, on le comptabilise d'un seul mouvement atomique. Un lot comptabilisé ne se modifie ni ne se
   supprime : il se contre-passe.
3. **Le compte est segmenté** (compte principal · tiers · axe analytique), ce qui ouvre la voie à
   l'analytique sans reconstruire le plan. La balance regroupe les mouvements auxiliaires sur leur
   compte principal.
4. **Aucun taux dans le noyau ; les taux appartiennent au dossier.** Les taxes, l'IFU, les formes
   juridiques et le calendrier déclaratif vivent dans un **paquet pays** versionné : un autre pays de
   l'UEMOA sera un autre paquet, pas une modification de celui-ci. Le paquet **amorce** le dossier, qui
   porte ensuite ses propres valeurs, modifiables — parce qu'un taux relevé dans une publication doit
   pouvoir être remplacé par celui que le cabinet a confirmé. Une limite tient l'ensemble : **un taux
   qui a déjà servi ne se réécrit pas**, il est remplacé par un nouveau code. Les écritures
   comptabilisées et les déclarations déjà calculées ont été faites avec la valeur d'alors.
5. **Un paramètre incertain est signalé, et cesse de l'être quand l'utilisateur le fixe.** Les taux
   relevés dans des guides et non dans le texte officiel portent `aVerifier: true` ;
   `parametresAVerifier()` les publie et l'interface les affiche comme « à confirmer ». Un taux corrigé
   dans le dossier passe à « établi » : ce n'est plus une approximation, c'est une décision, et la piste
   d'audit dit qui l'a prise et quelle était la valeur avant.
6. **Le noyau calcule les taxes mais n'invente jamais une ligne.** Une écriture dont une ligne porte
   un code de taxe doit comporter la ligne de taxe correspondante, dans le bon sens : une retenue à
   la source va à l'inverse de la charge.
7. **Dates civiles sans fuseau horaire.** Le 31/12/2026 est le même à Cotonou et à Paris.
8. **Piste d'audit ajout-seulement** : rien n'est supprimé, rien n'est réécrit.
9. **Un état fiscal est un état de contrôle.** La déclaration de TVA est recalculée depuis les
   bases taxées et les taux en vigueur dans le dossier, puis confrontée au grand livre. Ce qui diffère est
   affiché : une déclaration dont le total tombe juste par compensation ne vaut rien.
10. **Un état financier est un modèle de rubriques, pas du code de mise en page.** Le bilan et le
    compte de résultat sont décrits comme des données (rubriques, groupes de comptes qui les
    alimentent, sens de présentation, niveau, formule de total), puis évalués par un seul moteur.
    Ajouter une rubrique, ou publier le modèle d'un autre pays de l'UEMOA, ne touche pas au calcul.
    Chaque état emporte son propre contrôle : écart actif/passif pour le bilan, écart entre le
    résultat présenté et la somme des comptes de gestion pour le compte de résultat.
11. **Une marque ne réécrit pas le grand livre.** Le lettrage rapproche des lignes déjà
    comptabilisées : il n'écrit aucun mouvement, ne modifie aucun solde, et se défait sans trace
    perdue. Un délettrage date la marque au lieu de la supprimer.
12. **La clôture se prépare avant de s'exécuter.** `preparerCloture` ne produit aucune écriture : il
    décrit ce qui serait écrit et cite chaque obstacle. L'écran exige en plus une confirmation
    explicite, parce qu'une clôture est définitive. Un exercice clos est archivé tel quel — ses
    mouvements portent l'année de leur exercice, et aucune lecture ne mélange deux années.
13. **Le résultat de l'exercice est au passif avant la clôture.** Un bilan arrêté en cours d'année
    n'est équilibré que parce que les comptes de gestion sont résumés dans les capitaux propres. La
    clôture remplacera ce solde par un compte 121000 mouvementé ; jusqu'alors, aucun état ne fait
    semblant qu'elle a eu lieu.
14. **Un document se décrit une fois et se rend dans trois formats.** Chaque cellule a deux faces :
    la **valeur** exacte (un montant entier, une date ISO, un code technique), que reçoivent le CSV
    et Excel pour rester calculables, et le **texte** français, que le PDF imprime. Un état qui
    dirait autre chose en PDF qu'en Excel ne serait pas un état. Les bibliothèques de rendu sont
    chargées à la demande, et les caractères que les polices PDF standard feraient disparaître
    (l'espace insécable étroite des montants, le tiret cadratin, la ligature « Œ ») sont normalisés
    explicitement plutôt que perdus en silence.

## Société de démonstration

Les données embarquées sont **fictives** : `BÉNIN NÉGOCE DISTRIBUTION`, SARL, IFU `0020151234567`,
Cotonou, exercice courant, sept journaux, huit tiers (dont un fournisseur non immatriculé à l'IFU,
pour exercer la retenue de 5 %) et un lot d'à-nouveaux comptabilisé de 80 000 000 FCFA équilibré.
Aucune donnée réelle d'un contribuable béninois n'est présente dans ce dépôt.

## Avertissement fiscal

Les taux du paquet pays Bénin proviennent de tableaux publiés par la DGI Bénin et de guides fiscaux
croisés, relevés le 15/10/2026 — **pas du Code général des impôts lu article par article**. Ils sont
utilisables en démonstration et signalés comme à confirmer. Avant toute mise en production, chaque
taux doit être revu sur le texte officiel et validé par un professionnel.
