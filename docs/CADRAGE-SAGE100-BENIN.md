# Cadrage — Perfectys Compta : modèle Sage 100, plan SYSCOHADA révisé, pilote Bénin

> Décisions de l'utilisateur du 15/10/2026 :
> 1. **tout vider, repartir de zéro** — aucune dette de conception héritée de PERFECTO ;
> 2. modèle de référence **Sage 100 Comptabilité** (vocabulaire et écrans français), profondeur
>    fonctionnelle appuyée sur les guides **Sage 300 General Ledger** fournis sur le Drive ;
> 3. workflow de saisie **par lots** (batchs), à la Sage ;
> 4. société de démonstration **béninoise fictive**, proposée par moi et corrigée par l'utilisateur.
>
> Le relevé des guides Sage et le paquet pays Bénin vérifié sont dans
> `docs/specs/SPEC-MODELE-SAGE-BENIN.md`. Ce fichier-ci est le **cadrage de la nouvelle
> application** : ce qu'elle est, comment elle est structurée, ce qu'elle livre dans quel ordre.

---

## 1. Ce que « repartir de zéro » veut dire ici

L'ancien code TypeScript (noyau `@perfecto/*`, PWA, moteurs d'export) est **archivé** dans
`legacy/perfecto-typescript/` et **exclu du build, des tests et du typecheck** : il ne reste que
comme pièce à conviction historique, lisible dans le dépôt et dans l'historique Git. Rien de la
nouvelle application ne l'importe.

Ce qui est repris n'est pas du code mais des **acquis de méthode**, parce qu'ils sont indépendants
du modèle d'écran :

- montants en **entiers exacts**, jamais en nombres flottants ;
- **aucune dépendance à une imprimante** pour démarrer (règle R-ORG-1 du relevé PERFECTO) ;
- **piste d'audit** ajout-seulement, attribuée et horodatée ;
- **hors ligne d'abord** (IndexedDB), l'hôte Windows viendra ensuite sur la même base ;
- **tout document exportable en PDF, Excel et CSV, au choix de l'utilisateur** (décision du
  14/10/2026, toujours en vigueur) ;
- messages utilisateur **en français**, y compris les messages d'erreur métier.

## 2. Convention de nommage

Le vocabulaire du métier est **en français dans le code** (`Lot`, `Ecriture`, `Ligne`, `Compte`,
`Journal`, `Exercice`, `Periode`, `Tiers`, `CodeTaxe`, `PaquetPays`, `Dossier`) : c'est celui des
écrans, des clients et des cabinets, et un écart entre les deux est une source permanente d'erreurs.
Les termes purement techniques restent en anglais (`storage`, `kernel` → `noyau`, `index`).
Les noms de fichiers sont en minuscules, mots français, séparés par des tirets.

## 3. Architecture

```
compta/                      nouvelle application (feuille blanche)
  src/noyau/                 métier pur, sans UI ni navigateur — testable en Node
    montants.ts              Devise, Montant (bigint), saisie, formatage, calculs exacts
    calendrier.ts            Exercice, Période, verrous, périodes d'ajustement et de clôture
    comptes.ts               Structure de comptes, segments, compte, hiérarchie, validation
    referentiels/syscohada.ts  plan SYSCOHADA révisé (classes 1 à 8, groupes d'états)
    lots.ts                  Lot, Écriture, Ligne, états, règles de validation
    taxes.ts                 Code de taxe, base, sens, calcul des lignes de taxe
    pays/benin.ts            paquet pays Bénin (versionné)
    grand-livre.ts           comptabilisation, soldes, balance, journal, compte
    tiers.ts                 fichier des tiers, lettrage
    dossier.ts               le service : société + référentiel + exercice + lots
    stockage.ts              port de stockage + implémentation en mémoire
    index.ts                 surface publique du noyau
  src/ui/                    coquille Sage 100 + écrans (Preact, sans framework lourd)
  src/web/                   point d'entrée navigateur (main.tsx, styles)
  test/                      suite du noyau et des écrans
legacy/perfecto-typescript/  ancien code archivé, exclu du build et des tests
```

Le **noyau ne connaît ni le navigateur, ni Sage, ni l'écran** : il expose des règles et des états.
La coquille et les écrans sont une couche qui peut être refaite sans toucher au métier — c'est la
leçon retenue de la refonte avortée d'octobre 2026.

## 4. Modèle de données (conçu Sage-first, pas PERFECTO-first)

### 4.1 Le compte est segmenté

Sage 300 sépare *Account Structures* (le format) et *Segment Codes* (les valeurs autorisées). Nous
faisons de même :

```
Structure : [ compte principal (6) ][ auxiliaire (5) ][ analytique (4) ]
Numéro    : 411100-CLI01-ABJ1
```

- le **segment 1** porte le compte du plan SYSCOHADA révisé ;
- le **segment 2** (facultatif) porte le tiers sur les comptes auxiliaires (411, 401, 421…) ;
- le **segment 3** (facultatif) porte l'axe analytique — c'est la voie propre vers l'analytique,
  sans reconstruire le plan.

Un compte est **général** (sans segment 2 ni 3) ou **auxiliaire**. La hiérarchie découle du plan :
`41` → `411` → `411100`, ce qui donne les totaux par rubrique dans la balance et les états.

### 4.2 Le lot est l'unité de travail

```
Lot  (batch)     : numéro, journal, date, libellé, code source, état, pièces
 ├─ Écriture     : numéro, date, pièce, libellé, tiers, lignes, état
 │   └─ Ligne    : compte segmenté, libellé, débit, crédit, code taxe, échéance, axe
```

États d'un lot : `ouvert` → `pret` (prêt à comptabiliser) → `comptabilise` → éventuellement
`contre-passe`. Règles :

- une écriture doit être **équilibrée** (total débit = total crédit) ;
- une ligne porte **soit** un débit **soit** un crédit, jamais les deux ;
- un compte **auxiliaire** exige un tiers existant et actif ;
- aucune écriture sur une **période clôturée ou verrouillée** ;
- un lot ne se comptabilise que si **toutes** ses écritures sont valides ; la comptabilisation est
  **atomique** : tout le lot passe, ou rien ne passe ;
- une écriture comptabilisée est **immuable** : on la corrige par **contre-passation**, jamais par
  modification — et la contre-passation est elle-même un lot, daté du jour, référençant l'original.

La **comptabilisation provisoire** de Sage (*provisional posting*) est prévue dans le modèle : un lot
peut être comptabilisé dans un jeu provisoire séparé, consultable dans la balance « en incluant le
provisoire », puis basculé en définitif. Livrée après le définitif.

### 4.3 Les taxes sont des codes, pas des montants saisis

À la manière de Sage *Tax Services*, un **code de taxe** décrit : taux (en **points de base**,
entier — 18 % = 1800), base (hors taxe ou toutes taxes comprises), sens (collectée, déductible,
retenue à la source), compte de taxe et compte de contrepartie. La ligne d'écriture porte le code ;
le noyau **calcule** la taxe et génère les lignes correspondantes. Aucun taux n'est écrit dans le
noyau : ils viennent du **paquet pays**.

### 4.4 Le paquet pays est versionné

```
PaquetPays { code, nom, version, devise, referentiel, planDeDemarrage,
             codesTaxe, formesJuridiques, regleIdentifiantFiscal,
             calendrierDeclaratif }
```

Le pilote est **Bénin** (`BJ`, v1) : XOF, SYSCOHADA révisé, IFU obligatoire, TVA 18 % et 0 %
export, acomptes/retenues 1 % · 3 % · 5 %, retenues sur revenus de capitaux mobiliers, taxe sport
1 ‰, minimum de perception, régimes TPS/forfait pour les petites entreprises. Les taux seront
relus dans le PDF officiel de la DGI Bénin avant d'être figés (voir `SPEC-MODELE-SAGE-BENIN.md` §4).
Un autre pays de l'UEMOA (Côte d'Ivoire, Sénégal, Togo…) sera un **autre paquet**, pas une
modification de celui-ci.

### 4.5 Le dossier

Un **dossier** = une société + un référentiel + un exercice + son contenu (comptes, journaux,
tiers, lots, pièces). La société préexiste au dossier ; le référentiel est choisi à la création et
n'est pas modifiable rétroactivement. C'est la séquence que connaissent les utilisateurs :
**société → dossier → exercice**.

## 5. Coquille et écrans, vocabulaire Sage 100

Barre de menus française, écrans denses, recherche universelle (*finder*), tables de détail
navigables au clavier, barre d'état.

| Menu | Entrées |
|---|---|
| **Fichier** | Nouveau dossier · Ouvrir · Société · Exercice · Sauvegarde · Restauration · Quitter |
| **Édition** | Rechercher… · Imprimer · Exporter (PDF, Excel, CSV) · Préférences |
| **Traitements** | Saisie des écritures · **Lots** · Comptabilisation · Contre-passation · Lettrage · Rapprochement · Écritures récurrentes · Ventilation · Clôture de période · Clôture d'exercice |
| **Structure** | Plan comptable · Journaux · Tiers · Codes de taxe · Groupes de comptes · Structures de comptes · Codes source |
| **Interrogation** | Balance · Grand livre · Journal · Compte · Historique · Situation |
| **États** | États comptables et financiers OHADA révisé (bilan, compte de résultat, TFT, TVAP) · Déclaration TVA · États de paramétrage |
| **Outils** | Piste d'audit · Import · Export de données · Paquet pays · Diagnostic |
| **?** | Aide · Raccourcis · À propos |

Le producteur d'**états financiers** est distinct du module, comme *Financial Reporter* l'est de
Sage 300 GL : même noyau, couche séparée.

### 5.0 Ce que le lettrage livre

`compta/src/noyau/lettrage.ts` produit les marques, l'écran ne fait que les montrer. Trois règles :

- **Un groupe lettré est équilibré.** La somme des débits égale la somme des crédits. Un groupe d'un
  seul sens, ou dont l'écart n'est pas nul, est refusé — le lettrage partiel (un règlement à-compte)
  n'est pas produit, parce qu'il suppose un suivi des imputations ligne à ligne.
- **La proposition précède l'écriture.** Le lettrage automatique rapproche des montants exactement
  égaux (un contre un, puis un contre deux ou trois, dans une recherche bornée et triée) ; ce qu'il
  trouve est affiché avant que l'utilisateur ne l'applique. Ce qui n'est pas rapproché reste à
  lettrer à la main, et l'écran le dit.
- **Un délettrage ne supprime rien.** La marque défaite reste lisible avec sa date : l'historique
  d'un compte de tiers doit pouvoir être reconstitué, et un code de lettrage n'est jamais recyclé.

L'écran distingue deux soldes : le solde comptable (ce qui est dû) et le solde non lettré (ce qui
est dû sans qu'aucun règlement ne l'explique), avec la plus ancienne ligne non rapprochée.

### 5.1 Ce que le producteur d'états financiers livre

`compta/src/noyau/etats-financiers.ts` décrit les états comme des **données**. Une rubrique porte
son code, son libellé, son niveau (`detail`, `total`, `resultat`), les groupes de comptes qui
l'alimentent, son sens de présentation (`actif`, `passif`, `produit`, `charge`, `amortissement`,
`solde`) et — pour un total — l'expression qui le compose à partir de rubriques déjà évaluées. Un
seul moteur plie sur ces rubriques dans l'ordre du modèle : **aucun écran ne calcule un total**, et
publier le modèle d'un autre pays de l'UEMOA ne toucherait pas au calcul.

| État | Rubriques du modèle | Contrôle emporté par l'état |
|---|---|---|
| **Bilan** | Actif : immobilisations incorporelles, corporelles, financières, amortissements et dépréciations, actif circulant, trésorerie-actif, chacun avec son total et le total général. Passif : capitaux propres (**résultat de l'exercice compris**), dettes stables, passif circulant, trésorerie-passif, totaux | `ecart = total de l'actif net − total du passif`, affiché en tête de l'écran ; les comptes qui ne participent à aucun état sont listés, les rubriques qu'aucun solde n'alimente sont annoncées |
| **Compte de résultat** | Produits et charges d'exploitation, financières, hors activités ordinaires, impôts sur les résultats, et les six résultats numérotés du modèle révisé | Le résultat présenté est confronté à la somme algébrique des comptes de gestion de la balance ; un écart nomme le compte en cause |

Les deux états s'établissent à la clôture de l'exercice **ou à la fin d'une période** : un arrêté
intermédiaire est cumulé depuis le 1er janvier, jamais borné au seul mois choisi.

**Ce qui n'est pas produit, et pourquoi.** Le tableau des flux de trésorerie et le tableau de
variation des activités exigent que chaque compte soit classé dans un flux : le groupe `tft` existe
dans le modèle de groupes, aucun compte du plan de démarrage ne le porte. Publier ces états sans
classification reviendrait à inventer une présentation — les entrées de menu disent donc la raison
de leur absence. La colonne « N-1 » attend la tranche G (multi-exercices). Enfin, la mise en page
des imprimés officiels n'a pas été relevée dans l'Acte uniforme relatif au droit comptable et à
l'information financière : comme la déclaration TVA, ces états sont des **documents de contrôle**,
portés `aVerifier`, à rapprocher du formulaire de dépôt avant toute communication légale.

### 5.2 Ce que la clôture d'exercice livre

`compta/src/noyau/cloture.ts` prépare, `ServiceComptable.cloturerExercice()` exécute. La préparation
est une fonction pure : elle ne touche pas au dossier, elle dit ce qui serait écrit.

**Les trois effets d'une clôture**, en une opération atomique — soit les trois ont lieu, soit aucun :

1. L'écriture de solde des comptes de gestion, dans la **période de clôture** (la période
   supplémentaire que porte déjà l'exercice) : chaque produit et chaque charge est ramené à zéro, la
   contrepartie étant le compte **121000 — Résultat de l'exercice**.
2. Le lot d'**à-nouveaux** au premier jour de l'exercice suivant : chaque compte de bilan dont le
   solde n'est pas nul est reporté, **segment de tiers compris** — reporter 401100 sans ses
   fournisseurs ferait perdre le détail que le lettrage exploite. Les engagements hors bilan
   (groupe `ENG`) ne se reportent pas : ils se ressaisissent, et le rapport le dit.
3. L'**archivage** de l'exercice clos, toutes ses périodes clôturées, et l'ouverture de l'exercice
   suivant avec ses périodes. Chaque mouvement porte désormais l'année de son exercice : aucune
   lecture ne mélange deux années, et les périodes portent le même numéro d'une année sur l'autre.

**Les obstacles**, cités dans l'ordre où il faut les corriger : des périodes normales ou
d'ajustement encore ouvertes, un lot de l'exercice en saisie ou prêt mais non comptabilisé, un grand
livre déséquilibré, un plan qui porte des soldes initiaux (ils doivent passer par un lot
d'à-nouveaux, sinon ils ne se reportent pas), une écriture de clôture ou des à-nouveaux qui ne
tombent pas juste.

**Le compte de résultat ignore l'écriture de clôture.** Elle est la conséquence du résultat, pas un
élément de l'activité : l'inclure annoncerait un résultat nul pour un exercice clos. Le bilan, lui,
l'inclut — c'est elle qui porte le résultat dans les capitaux propres d'un exercice clos, via le
groupe `RESULTAT-CLOS` distingué du groupe `CAP` pour que la ligne « Résultat de l'exercice » reste
lisible dans les deux cas.

**Ce qui n'est pas produit** : la réouverture d'un exercice clos (la correction passe par une
écriture dans l'exercice en cours), l'affectation du résultat décidée en assemblée (121000 vers
111000 ou 112000), et la consolidation de plusieurs dossiers.

### 5.3 Ce que le rapprochement bancaire livre

`compta/src/noyau/rapprochement.ts` ne produit **aucune écriture** : un relevé décrit ce que la banque
a enregistré, le pointage rapproche ce qui existe déjà des deux côtés. Ce qui doit être comptabilisé
(frais bancaires, intérêts, agios) se saisit d'abord, par un lot, puis se pointe.

**Le sens des montants.** Une ligne de relevé porte le montant **au sens de la banque** : positif
quand l'argent entre. Le compte de trésorerie, lui, est débiteur positif. Les deux sens sont inversés,
et la conversion se fait une seule fois, dans `verifierPointage` — jamais dispersée dans les écrans.

**L'état de rapprochement** ne dit pas seulement « les deux soldes diffèrent de tant » ; il décompose
l'écart en trois termes qui s'additionnent exactement :

| Terme | Ce qu'il porte |
| --- | --- |
| `ecartExplique` | Les suspens **de la période** : ce que la comptabilité a passé et que la banque n'a pas encore enregistré (un chèque émis), moins ce que la banque a enregistré et que la comptabilité n'a pas passé (des frais prélevés) |
| `ecartDOuverture` | Ce que les périodes antérieures ont laissé en suspens, net des mouvements antérieurs que ce relevé explique déjà |
| `ecartRestant` | Ce qui ne s'explique par rien. **Nul quand le rapprochement est conforme** |

`conforme` ne veut donc pas dire « les soldes sont égaux » — ils ne le sont presque jamais — mais
« toute différence a une ligne en face ». Un `ecartRestant` non nul est une anomalie, et l'écran
l'affiche en avertissement avec les deux soldes d'ouverture à vérifier.

**Le pointage automatique** retient la référence avant le montant : deux règlements du même montant le
même jour sont courants, deux règlements portant le même numéro de chèque ne le sont pas. Les
propositions sont montrées avant d'être appliquées, comme pour le lettrage. Un pointage n'accepte que
des montants **exactement égaux** ; un règlement partiel ne se pointe pas, il se comptabilise.

**Le dépointage** conserve la trace : un pointage défait garde son identifiant, son acteur et sa date
de défaisance. Un rapprochement refait ne fait pas disparaître celui qui a été défait.

**Ce qui n'est pas produit** : l'import d'un fichier de relevé (CSV, OFX, CAMT) — le relevé se saisit
ligne à ligne —, les échelles d'intérêts et les agios calculés, et le rapprochement de plusieurs
comptes bancaires en une seule opération.

## 6. Ordre de livraison

| Tranche | Livrable | Preuve | État au 15/10/2026 |
|---|---|---|---|
| **A** | Noyau : montants, calendrier, comptes segmentés, plan SYSCOHADA, lots, taxes, paquet pays Bénin, grand livre, stockage | suite de tests verte en Node | **livrée** (`e27fbe1`) |
| **B** | Coquille Sage 100 (menus, barre d'état, finder) + écrans **Structure** : plan comptable, journaux, tiers, codes de taxe | aperçu live, écrans validés par l'utilisateur | **livrée** (`77afc69`), en attente de validation |
| **C** | Écrans **Traitements** : lots, saisie des écritures en table de détail, comptabilisation, contre-passation | aperçu live + tests de parcours | **livrée**, 9 tests de parcours en jsdom |
| **D** | Écrans **Interrogation** : balance, grand livre, journal, compte, historique | aperçu live | balance, journal et grand livre **livrés** ; interrogation d'un compte et historique restants |
| **E** | Taxes Bénin en saisie + **déclaration TVA** mensuelle | tests de calcul fiscal | **livrée** : génération des lignes de taxe en saisie, déclaration recalculée et rapprochée du grand livre, export CSV. Reste le reversement des acomptes et retenues (compte 442100), qui relève d'une autre obligation |
| **F** | Lettrage, rapprochement bancaire | tests | **partiellement livrée** : lettrage des comptes de tiers — producteur `lettrage.ts`, écran, lettrage manuel et automatique (proposé avant d'être appliqué), délettrage tracé, export CSV, 21 tests — **et rapprochement bancaire** : relevés saisis ligne à ligne, producteur `rapprochement.ts`, état de rapprochement avec écart expliqué et reste inexpliqué, pointage manuel et automatique (par référence puis par montant), dépointage tracé, écran, export CSV, 13 + 3 tests. Reste le lettrage partiel d'un règlement à-compte ; l'import d'un fichier de relevé (CSV, OFX, CAMT) n'est pas produit |
| **G** | Clôtures : période, exercice, à-nouveaux, *Create New Year* | tests | **livrée** : rapport de préparation, clôture d'exercice (solde des comptes de gestion vers 121000, à-nouveaux segment de tiers compris, ouverture de l'exercice suivant, archivage de l'exercice clos), lectures par exercice, écran avec confirmation explicite, 14 tests. La réouverture d'un exercice clos n'est pas produite : la clôture est définitive, et l'écran le dit |
| **H** | États financiers OHADA révisé (producteur distinct), exports PDF/Excel/CSV de tous les documents | fichiers produits et vérifiés | **partiellement livrée** : bilan et compte de résultat OHADA révisé — producteur `etats-financiers.ts`, deux écrans, arrêté par période, **colonne N-1 dès qu'un exercice est clos**, export CSV, 18 tests. Restent le tableau des flux de trésorerie et le tableau de variation des activités (aucun compte du plan n'est classé en flux) et les exports PDF et Excel |
| **I** | Piste d'audit, habilitations par écran, import/export de données, sauvegarde/restauration, hôte Windows | tests + package installable | piste d'audit **livrée** (ajout-seulement, attribuée, horodatée) ; le reste à faire |

**Chaque tranche se termine par un écran validé par l'utilisateur sur l'aperçu live avant la
suivante** — c'est la règle posée après l'échec de la première refonte (15 écrans construits sans
maquette validée).

## 7. Société de démonstration proposée (à corriger par l'utilisateur)

| Champ | Valeur proposée |
|---|---|
| Raison sociale | **BÉNIN NÉGOCE DISTRIBUTION** |
| Forme juridique | SARL |
| IFU | `0020151234567` (fictif, au format réel à 13 chiffres — à confirmer) |
| Adresse | Lot 214, quartier Ganhi, BP 1234 |
| Ville / Pays | Cotonou / Bénin |
| Téléphone | +229 21 30 45 67 |
| Courriel | compta@benin-negoce.bj |
| Devise | XOF (franc CFA) |
| Exercice | 01/01/2026 – 31/12/2026 |
| Régime fiscal | réel normal, assujetti TVA 18 % |
| Journaux | ACH (achats), VTE (ventes), BQ (banque), CAI (caisse), OD (opérations diverses), AN (à-nouveaux), SAL (salaires) |
| Tiers | 2 clients, 3 fournisseurs (dont 1 non immatriculé à l'IFU, pour tester la retenue 5 %), 1 État (DGI Bénin), 1 personnel |
