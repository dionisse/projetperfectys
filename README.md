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
npm test               # 103 tests : noyau en Node, interface en jsdom
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
- **Interrogation** : balance filtrable par période, journal par pièce avec son détail, grand livre
  à solde progressif par compte (comptes auxiliaires compris).
- **États** : **déclaration TVA mensuelle** recalculée depuis le grand livre — bases, taux, taxes,
  retenue de TVA sur marchés publics, crédit antérieur imputé, taxe nette à payer ou crédit à
  reporter — avec un **rapprochement compte par compte** entre ce que les codes de taxe produisent
  et ce que la période contient. Un écart (une taxe saisie à la main, un code oublié sur une base)
  est affiché en alerte, jamais absorbé dans un total. L'écran est un état de contrôle : il ne
  prétend pas reproduire l'imprimé officiel, dont la mise en page n'a pas été relevée dans le texte
  juridique.
- **Export CSV** : la déclaration TVA, la balance, le journal et le grand livre se téléchargent au
  format CSV (point-virgule, BOM UTF-8, fins de ligne CRLF — ce qu'Excel en français attend), dans
  ce que l'écran affiche, filtres compris. Excel et PDF suivent.
- **Outils** : piste d'audit ajout-seulement, séquencée, attribuée et horodatée ; réinitialisation
  du dossier de démonstration.
- **Hors ligne** : le dossier est persisté dans IndexedDB, montants sérialisés en chaînes.

## Ce qui est annoncé comme non implémenté

Les entrées de menu correspondant à des fonctions non livrées sont **visibles, grisées, et portent
la tranche qui les livrera** en infobulle. Elles ne sont pas cliquables : aucun lien mort, aucun
écran vide. Lettrage, rapprochement bancaire, écritures récurrentes, clôtures de période et
d'exercice, interrogation d'un compte et historique, états financiers OHADA révisé (bilan, compte
de résultat, tableau des flux, tableau de variation des activités), exports Excel et PDF,
reversement des acomptes et retenues à la source, imports, habilitations par écran, sauvegarde et
restauration.

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
4. **Aucun taux dans le noyau.** Les taxes, l'IFU, les formes juridiques et le calendrier déclaratif
   vivent dans un **paquet pays** versionné. Un autre pays de l'UEMOA sera un autre paquet.
5. **Un paramètre incertain est signalé.** Les taux relevés dans des guides et non dans le texte
   officiel portent `aVerifier: true` ; `parametresAVerifier()` les publie et l'interface les affiche
   comme « à confirmer ».
6. **Le noyau calcule les taxes mais n'invente jamais une ligne.** Une écriture dont une ligne porte
   un code de taxe doit comporter la ligne de taxe correspondante, dans le bon sens : une retenue à
   la source va à l'inverse de la charge.
7. **Dates civiles sans fuseau horaire.** Le 31/12/2026 est le même à Cotonou et à Paris.
8. **Piste d'audit ajout-seulement** : rien n'est supprimé, rien n'est réécrit.
9. **Un état fiscal est un état de contrôle.** La déclaration de TVA est recalculée depuis les
   bases taxées et les taux du paquet pays, puis confrontée au grand livre. Ce qui diffère est
   affiché : une déclaration dont le total tombe juste par compensation ne vaut rien.

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
