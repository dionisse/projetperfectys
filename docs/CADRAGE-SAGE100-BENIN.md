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

`compta/src/noyau/lettrage.ts` produit les marques, l'écran ne fait que les montrer. Quatre règles :

- **Un groupe lettré est équilibré sur ses imputations.** Chaque ligne du groupe porte le montant
  qui lui est imputé ; la somme des débits imputés égale la somme des crédits imputés. Un groupe d'un
  seul sens, ou dont l'écart n'est pas nul, est refusé.
- **On ne lettre pas plus qu'il n'est dû.** L'imputation d'une ligne ne peut excéder ce qui lui reste
  à lettrer, et une ligne déjà entièrement lettrée est refusée — le message cite la marque en cause
  plutôt que le montant saisi. Une ligne n'est jamais scindée : l'écriture est immuable, c'est la
  marque qui porte ses imputations (`Lettrage.portions`). Une marque **sans** ce champ se lit comme
  avant : chaque ligne y est consommée en entier, ce qui laisse valides les marques et les sauvegardes
  produites avant le lettrage partiel.
- **La proposition précède l'écriture, en trois passes déterministes.** (1) un débit contre un crédit
  de même montant ; (2) une ligne contre deux ou trois de l'autre sens dont les montants somment
  exactement (recherche bornée par `tailleMaximaleDuGroupe`, 4 par défaut) ; (3) ce qui ne tombe pas
  juste : le règlement le plus ancien est imputé sur la dette la plus ancienne, à hauteur du plus
  petit des deux restes — un **à-compte**, annoncé « Règlement partiel ». Une même facture peut
  recevoir plusieurs marques partielles. Ce qui est trouvé est affiché avant d'être appliqué ;
  l'option `partiel: false` s'en tient aux deux premières passes.
- **Un délettrage ne supprime rien.** La marque défaite reste lisible avec sa date et rend son
  imputation : l'historique d'un compte de tiers doit pouvoir être reconstitué, et un code de
  lettrage n'est jamais recyclé.

L'écran distingue deux soldes : le solde comptable (ce qui est dû) et le solde non lettré (ce qui
est dû sans qu'aucun règlement ne l'explique), avec la plus ancienne ligne non rapprochée et le
nombre de lignes entamées. Le solde non lettré somme **les restes**, pas les lignes sans marque :
après un acompte de 500 000 sur une facture de 1 170 000, ce qui reste dû est 670 000. Chaque ligne
affiche son consommé, son reste, ses marques et son état (`nonLettree`, `partielle`, `lettree`), et
l'interrogation de compte reporte le reste à lettrer ligne à ligne.

### 5.1 Ce que le producteur d'états financiers livre

`compta/src/noyau/etats-financiers.ts` décrit le bilan et le compte de résultat comme des
**données**, `compta/src/noyau/flux-tresorerie.ts` fait de même pour le tableau des flux de
trésorerie. Une rubrique porte son code, son libellé, son niveau (`detail`, `total`, `resultat`), les
groupes de comptes qui l'alimentent, son sens de présentation (`actif`, `passif`, `produit`,
`charge`, `amortissement`, `solde`) et — pour un total — l'expression qui le compose à partir de
rubriques déjà évaluées. Un flux porte en plus sa **nature de calcul** : `tresorerie` (les comptes de
classe 5 à l'ouverture ou à la clôture), `capaciteAutofinancement` (le résultat corrigé des charges
et produits calculés), `variation` (le mouvement d'un groupe entre l'ouverture et la clôture) ou
`flux` (les contreparties hors trésorerie des écritures de trésorerie, dans un sens donné). Un seul
moteur plie sur ces rubriques dans l'ordre du modèle : **aucun écran ne calcule un total**, et
publier le modèle d'un autre pays de l'UEMOA ne toucherait pas au calcul.

| État | Rubriques du modèle | Contrôle emporté par l'état |
|---|---|---|
| **Bilan** | Actif : immobilisations incorporelles, corporelles, financières, amortissements et dépréciations, actif circulant, trésorerie-actif, chacun avec son total et le total général. Passif : capitaux propres (**résultat de l'exercice compris**), dettes stables, passif circulant, trésorerie-passif, totaux | `ecart = total de l'actif net − total du passif`, affiché en tête de l'écran ; les comptes qui ne participent à aucun état sont listés, les rubriques qu'aucun solde n'alimente sont annoncées |
| **Compte de résultat** | Produits et charges d'exploitation, financières, hors activités ordinaires, impôts sur les résultats, et les six résultats numérotés du modèle révisé | Le résultat présenté est confronté à la somme algébrique des comptes de gestion de la balance ; un écart nomme le compte en cause |
| **Tableau des flux de trésorerie** | Trésorerie d'ouverture (ZA) ; activité en méthode indirecte — capacité d'autofinancement globale (FA), variation de l'actif circulant hors activités ordinaires (FB), des stocks (FC), des créances (FD), du passif circulant (FE) — et son total ZB ; investissement en méthode directe, acquisitions et cessions d'immobilisations incorporelles, corporelles et financières (FF à FJ, ZC) ; financement par les capitaux propres (FK à FN, ZD) et par les capitaux étrangers (FO à FP, ZE), soit ZF ; variation de la trésorerie nette ZG et trésorerie de clôture ZH | `ecart = trésorerie présentée (ZA + ZG) − trésorerie réelle` (trésorerie actif − trésorerie passif à la clôture), c'est le contrôle que l'imprimé officiel porte lui-même en bas de page ; les comptes dont la variation n'entre dans aucune ligne sont listés avec leur montant, et les écritures entre comptes de trésorerie — virements internes — sont comptées et annoncées comme n'étant pas des flux |

Les trois états s'établissent à la clôture de l'exercice **ou à la fin d'une période** : un arrêté
intermédiaire est cumulé depuis le 1er janvier, jamais borné au seul mois choisi.

Le tableau des flux lit **la balance et les mouvements de la même fenêtre** : un tableau dont les
flux ne couvrent pas la période de ses variations ne se contrôlerait pas. Deux écarts de lecture y
sont traités explicitement. Les **à-nouveaux** — ceux d'une première ouverture comme ceux qu'écrit
une clôture — décrivent la position de départ et non un flux de la période : ils sont ajoutés aux
soldes d'ouverture et retirés des flux, sinon le capital et les dettes de l'an dernier apparaîtraient
comme de l'argent reçu cette année, et la trésorerie d'ouverture serait lue à zéro sur un premier
exercice. Les **écritures de clôture** sont écartées, comme du compte de résultat : solder les
comptes de gestion vers le résultat n'est pas un mouvement d'argent.

**Ce qui n'est pas produit, et pourquoi.** Le tableau de variation des activités reste annoncé : son
modèle n'a pas pu être arrêté sur une source officielle — l'Acte uniforme révisé porte quatre états
(bilan, compte de résultat, tableau des flux de trésorerie, notes annexes) — et le composer
reviendrait à inventer une présentation. Le tableau des flux ne porte **pas de colonne N-1** : les
flux de l'exercice précédent se calculent à partir de ses soldes d'ouverture, qui sont les soldes de
clôture de N-2, et l'écran le dit au lieu d'afficher une comparaison fausse. Enfin, la mise en page
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
des montants **exactement égaux** : contrairement au lettrage, il n'y a pas de pointage partiel. Un
règlement à-compte se lettre au compte du tiers, et la ligne de banque qui le porte se pointe pour
son montant entier — le relevé dit ce que la banque a fait, pas ce que l'entreprise doit.

**Le dépointage** conserve la trace : un pointage défait garde son identifiant, son acteur et sa date
de défaisance. Un rapprochement refait ne fait pas disparaître celui qui a été défait.

**L'import d'un fichier de relevé** (`compta/src/noyau/import-releve.ts`) lit ce que la banque donne :
**CSV**, **OFX/QFX** (SGML, balises non fermées comprises), **CAMT.053** (ISO 20022), **classeur
Excel** (.xlsx) et **PDF**. La lecture est pure, elle n'écrit rien, et quatre règles la tiennent :

- **Le fichier ne dit pas sa forme, elle est détectée et montrée.** Séparateur (`;`, `,`, tabulation),
  décimale (virgule ou point), en-têtes reconnus par vocabulaire français et anglais — ou colonnes
  déduites du contenu quand il n'y a pas d'en-tête —, montant signé ou porté sur deux colonnes
  débit/crédit, sens marqué d'une lettre D/C, dates `jj/mm/aaaa`, `aaaa-mm-jj` ou `mm/jj/aaaa` quand le
  fichier le prouve. Le mappage reconnu est rendu dans `correspondances` et affiché : l'utilisateur le
  contrôle avant d'écrire.
- **L'aperçu précède l'import**, comme la proposition précède le lettrage. `apercuDImportDeReleve` rend
  les opérations lues, les avertissements et les **doublons** — les opérations déjà présentes dans un
  relevé du même compte, reconnues à la date, la référence et le montant, jamais au libellé que les
  banques reformulent. Importer deux fois le même fichier ne double rien, et ne le cache pas.
- **Aucun arrondi silencieux.** Un montant est lu en unités exactes de la devise du dossier : « 1 170
  000,00 » en XOF est accepté, « 1 170 000,56 » est refusé. Une ligne illisible cite son numéro et
  arrête la lecture — un relevé amputé ne se rapproche pas. Une ligne qui n'est pas une opération
  (pied de fichier, total) est écartée et annoncée.
- **Ce que le fichier ne dit pas est demandé, jamais inventé.** Le compte du dossier, le journal, le
  libellé du relevé, et le solde d'ouverture quand le fichier ne le porte pas. La provenance est gardée
  sur le relevé (`source` : format, nom du fichier, compte et devise annoncés, doublons écartés) et
  tracée dans l'audit comme « Relevé importé ».

**Le contenant varie d'une banque à l'autre, pas ce qu'on y cherche.** `compta/src/web/lecture-fichier.ts`
remet un classeur Excel ou un PDF en **grille de cellules en texte**, et cette grille est lue par le
même socle que le CSV (`lireGrilleDeReleve`) : les dates d'un classeur sont rendues en ISO, ses
nombres sans exposant, et la feuille retenue est la première qui porte des dates et des montants —
les exports bancaires ouvrent volontiers sur une notice. Un PDF se lit de deux façons, et l'écran dit
laquelle a servi : **les colonnes sont repérables** — chaque cellule est rangée dans la colonne dont
elle borde l'entrée ou la sortie, ce qui tient compte des montants alignés à droite, dont l'abscisse
varie avec le nombre de chiffres — ou, quand la page ne pose qu'une ligne de texte par opération,
**les champs sont reconnus à leur forme** : première date, premier nombre comme montant, dernier comme
solde, code en référence, le reste en libellé. Ce repli est annoncé comme tel, et l'aperçu est là pour
que l'utilisateur le contrôle. Un PDF dont les chiffres sont des images — un relevé scanné — est
**refusé** : aucune reconnaissance optique de caractères, aucun montant deviné. Le lecteur PDF (pdf.js,
worker compris) et exceljs sont chargés à la demande : ils ne pèsent pas sur le premier écran.

Un **relevé d'exemple** est produit à la demande depuis le grand livre du dossier, augmenté de deux
opérations que seule la banque connaît (des frais) : l'import est essayable sans fichier sous la main,
et le rapprochement a un écart réel à expliquer. Le même exemple s'écrit dans les trois contenants —
texte séparé, vrai classeur .xlsx, vrai PDF imprimé, tous deux écrits puis **relus par l'application**
(`compta/src/web/exemple-de-releve.ts`) : le chemin parcouru est celui d'un fichier de banque.

**Ce qui n'est pas produit** : les échelles d'intérêts et les agios calculés, le rapprochement de
plusieurs comptes bancaires en une seule opération, et les formats MT940 (SWIFT) et CAMT.052/054.

### 5.4 Ce que le paramétrage modifiable livre

Trois écrans permettent de remplacer les valeurs livrées par celles du dossier réel.

**Société** (Structure › Société) : raison sociale, forme juridique choisie parmi celles du paquet
pays, code société (il entre dans le numéro de dossier), identifiant fiscal validé par la **règle du
paquet pays** — pas par une règle codée en dur, pour qu'un autre pays valide autrement — adresse,
ville, pays, téléphone, courriel, régime fiscal. Chaque champ modifié est tracé avec sa valeur d'avant.
La devise et le référentiel ne se modifient pas ici, et l'écran le dit : chaque montant du grand livre
est en XOF, et un dossier dans une autre devise est un autre dossier.

**Plan comptable** (Structure › Plan comptable) : ajout d'un compte, correction du libellé, changement
de groupe, activation, accès à la saisie, exigence d'un tiers, suppression. Une colonne « Utilisation »
dit, avant l'essai, ce qui tient à chaque compte. Deux garde-fous :

- un compte **mouvementé** ne change pas de groupe — le groupe décide de la ligne du bilan où le compte
  apparaît, et le déplacer réécrirait des états déjà produits ;
- un compte qui tient au dossier (mouvements, lots en saisie, code de taxe qui l'utilise comme compte
  de taxe, contrepartie d'un journal, compte de résultat de l'exercice) ne se supprime pas. **Toutes**
  les raisons sont données en une fois : retirer un compte pour découvrir la deuxième raison au prochain
  essai ne fait rien apprendre à personne.

**Codes de taxe et taux** (Structure › Codes de taxe) : les codes du dossier, leur origine (valeur du
paquet pays, valeur modifiée au dossier, code créé au dossier), combien de lignes les utilisent, et leur
statut. Création d'un code, correction du libellé, du taux, de la base, du sens, du compte de taxe, de
l'opération, de la condition et de la référence légale — obligatoire, parce qu'un taux sans article
n'est pas défendable. Suppression d'un code qui n'a pas servi. Reprise des valeurs du paquet pays après
une mise à jour, qui ne touche ni à ce qui a servi ni aux codes créés au dossier, et dit ce qu'elle a
repris, ajouté, conservé.

Le taux se saisit en pourcentage et se stocke en **points de base entiers** (18 → 1800, 1,5 → 150,
0,1 → 10) : aucune conversion flottante, et une saisie illisible est refusée plutôt qu'arrondie.

**Ce qui ne se modifie pas encore** : les impôts assis sur l'exercice (IS, minimum de perception, TPS,
IBA) et le calendrier déclaratif restent ceux du paquet pays — aucun écran ne les calcule encore, et
rendre modifiable un paramètre que rien n'emploie ne servirait qu'à donner l'illusion du contrôle. Ils
le deviendront avec la tranche qui les emploiera (liasse fiscale, acomptes). Les journaux, les périodes
et la structure de comptes ne se modifient pas non plus.

### 5.5 Ce que l'interrogation de compte livre

L'interrogation répond à une question que les états de synthèse ne posent pas : **que s'est-il passé
sur ce compte, et où en est-il maintenant ?**

Le producteur `compta/src/noyau/interrogation.ts` est une fonction pure : elle prend les mouvements,
le compte, un filtre et un contexte (lettrages, relevés, pointages, exercices clos, devise, bornes
d'exercices) et rend l'interrogation. Aucune marque ni pointage n'est réécrit.

Les règles retenues :

1. **Le solde progressif part du solde réel à l'ouverture de la fenêtre.** Ce qui précède — à-nouveaux
   compris — forme le solde initial. Un solde qui repartirait de zéro ne correspondrait à rien de ce
   que l'utilisateur connaît, et rendrait la ligne suivante incompréhensible.
2. **Un compte segmenté s'interroge seul.** `401100-FOU01` ne montre que ce fournisseur ; le compte
   principal `401100` rassemble tous les segments, et l'écran le dit explicitement — c'est le seul
   moyen de ne pas croire qu'on regarde un tiers alors qu'on en regarde huit.
3. **Les lignes d'un exercice clos sont marquées figées.** Elles ne bougeront plus, et le rappel que
   toute correction passe par l'exercice en cours est affiché, pas supposé connu.
4. **L'historique par exercice** donne, exercice par exercice, la période couverte, les totaux, le
   nombre de mouvements, l'état (clos ou en cours) et le **solde reporté** — ce que la clôture a
   emporté. C'est la même grandeur que celle des à-nouveaux : une interrogation et une clôture qui
   ne diraient pas le même chiffre seraient contradictoires.
5. **Comparer à l'exercice précédent refuse un exercice qui n'existe pas.** Rendre un compte vide
   serait une réponse fausse ; l'écran donne la liste des exercices disponibles.
6. **Les suspens sont montrés, pas devinés** : reste à lettrer, reste à pointer en banque. Un compte
   soldé n'est pas forcément lettré, et un compte pointé n'est pas forcément rapproché.

Ce qui n'est pas produit : l'interrogation d'un compte par **montant** ou par **lettre** (le finder
de Sage), l'appel d'une écriture depuis une ligne, et l'impression PDF.

### 5.6 Ce que les trois formats d'export livrent

L'exigence était posée dès le cadrage : **tout document est exportable en PDF, en Excel et en CSV,
et c'est l'utilisateur qui choisit**. Elle est tenue pour les treize écrans qui produisent un état :
balance, journal, grand livre, interrogation de compte, plan comptable, société, codes de taxe,
déclaration TVA, bilan, compte de résultat, état de lettrage, état de rapprochement, rapport de
clôture.

Le bouton **Exporter…** de la barre d'actions déplie les trois formats. Ce choix n'est pas une
question de confort : les trois rendus servent trois usages différents, et un cabinet les emploie
tous les trois dans la même journée.

| Format | Usage | Ce qui est garanti |
|---|---|---|
| **CSV** | Échanger, importer dans un autre logiciel | Point-virgule, BOM UTF-8, fins de ligne CRLF : Excel en français découpe correctement, et les accents survivent |
| **Excel** | Retraiter, sommer, contrôler | Les montants sont des **nombres entiers** au format `#,##0`, les dates en ISO, un **onglet par section**, volet figé sous les titres, filtre automatique, A4 ajusté en largeur avec titres répétés, totaux en gras |
| **PDF** | Imprimer, archiver, envoyer | A4, portrait ou paysage selon la largeur du tableau, en-tête de société complet en page 1 puis en-tête compact, paramètres de l'édition, mention finale, « Page n/N » |

**Une seule description, trois rendus.** Le document est décrit une fois (`documentDepuisLignes`,
dans `compta/src/web/exports/document.ts`) à partir des lignes que l'écran prépare déjà pour son
export, puis rendu par chaque moteur. Chaque cellule a deux faces : la **valeur** exacte — un montant
entier, une date ISO, un code technique — que reçoivent le CSV et Excel, et le **texte** français que
le PDF imprime. C'est ce qui empêche les trois formats de diverger : ils ne recalculent rien, ils
mettent en forme la même chose.

Trois conséquences assumées :

1. **Le franc CFA n'a pas de centimes.** Un format `#,##0.00` inventerait une subdivision qui
   n'existe pas ; le format retenu est `#,##0`.
2. **Au-delà de ce qu'un nombre JavaScript représente exactement, un montant bascule en texte** dans
   Excel, plutôt que de devenir un nombre faux. Un export qui arrondit en silence est pire qu'un
   export qui dit qu'il ne peut pas.
3. **Les polices PDF standard (Helvetica, WinAnsi) silencent les caractères hors latin1.** L'espace
   insécable étroite que `formatMontant` emploie comme séparateur de milliers, le tiret cadratin et
   la ligature « Œ » disparaîtraient du texte imprimé sans aucun avertissement : ils sont
   normalisés explicitement. Les accents français, eux, sont en latin1 et restent.

Les bibliothèques (`exceljs`, `jspdf`, `jspdf-autotable`) sont chargées **à la demande** : le paquet
principal reste à ≈ 292 ko, et les ≈ 940 ko d'Excel ou les ≈ 390 ko de PDF ne sont téléchargés
qu'au premier export dans ce format. Le bouton dit ce qu'il fait pendant la génération (« Excel en
cours… ») et le retour donne le nom du fichier et sa taille : un téléchargement silencieux laisse
croire qu'il n'a rien donné.

Les moteurs reprennent les conventions de mise en page éprouvées dans l'application précédente
(`legacy/perfecto-typescript/exports/`, archivée et hors build), vérifiées à la sonde sur les mêmes
versions de bibliothèques.

### 5.7 Ce que la sauvegarde et la restauration livrent

L'application est hors ligne : le dossier vit dans le stockage local du navigateur. Sans sauvegarde,
il est en sursis — un navigateur réinitialisé, un poste changé, un stockage purgé, et un exercice
disparaît. Outils › Sauvegarde du dossier donne les deux gestes : **emporter** le dossier, et le
**remettre**.

Le fichier est un JSON autosuffisant : format `perfectys-compta/sauvegarde`, version 1, identité de
la société, exercice, paquet pays et référentiel qui ont servi, horodatage et auteur, **inventaire
chiffré** de son contenu (comptes, journaux, tiers, mouvements, lots, lettrages, exercices clos,
relevés, pointages, codes de taxe, événements d'audit), puis l'état complet sérialisé. Une sauvegarde
retrouvée six mois plus tard dans un dossier de courriel doit dire ce qu'elle est sans qu'on ait à
l'ouvrir. Les montants y sont des **chaînes** : ce sont des entiers exacts, et un JSON de nombres
perdrait cette exactitude au premier passage dans un tableur.

Quatre refus, chacun avec sa raison :

| Refus | Pourquoi |
|---|---|
| Ce n'est pas une sauvegarde | La marque de fabrique manque : un JSON quelconque n'est pas chargé à moitié |
| La version ne correspond pas | Une sauvegarde d'une autre version n'est pas devinée |
| Le grand livre est déséquilibré | Restaurer un débit qui ne fait pas le crédit produirait des états faux sans que rien ne le signale jamais |
| Le paquet pays diffère | Les taux et les règles fiscales du fichier ne sont pas ceux que cette application applique |

La vérification est faite **deux fois** : à l'écran, dès le choix du fichier, pour informer
l'utilisateur de ce qu'il s'apprête à remettre ; puis dans le noyau, au moment d'écrire, pour
protéger le dossier. La première sert à décider, la seconde sert à garantir.

La restauration **remplace** tout, et l'écran le dit avant, pas après : ce n'est pas une fusion, parce
que deux dossiers rapprochés en silence donneraient des soldes que personne ne pourrait expliquer.
Elle est soumise à une case à cocher — avoir téléchargé une sauvegarde du dossier en cours — qui est
la seule marche arrière existante. Le remplacement est inscrit dans la piste d'audit de la sauvegarde
restaurée, avec le contenu du dossier qu'il écrase : c'est la seule mémoire qui reste de ce qui a été
perdu.

Ce qui n'est pas produit : la sauvegarde automatique périodique, la sauvegarde chiffrée, la fusion de
deux dossiers, et l'import de données depuis un fichier tiers (ECF, FEC, CSV de comptes ou de tiers).

## 6. Ordre de livraison

| Tranche | Livrable | Preuve | État au 15/10/2026 |
|---|---|---|---|
| **A** | Noyau : montants, calendrier, comptes segmentés, plan SYSCOHADA, lots, taxes, paquet pays Bénin, grand livre, stockage | suite de tests verte en Node | **livrée** (`e27fbe1`) |
| **B** | Coquille Sage 100 (menus, barre d'état, finder) + écrans **Structure** : société, plan comptable, journaux, tiers, codes de taxe | aperçu live, écrans validés par l'utilisateur | **livrée** (`77afc69`), en attente de validation ; complétée par le **paramétrage modifiable** (§5.4) : société, plan comptable et taux se corrigent dans l'application, 17 + 4 tests |
| **C** | Écrans **Traitements** : lots, saisie des écritures en table de détail, comptabilisation, contre-passation | aperçu live + tests de parcours | **livrée**, 9 tests de parcours en jsdom |
| **D** | Écrans **Interrogation** : balance, grand livre, journal, compte, historique | aperçu live | **livrée** : balance, journal, grand livre, puis **interrogation de compte** (§5.5) — producteur `interrogation.ts`, solde progressif à partir du solde réel, lecture d'un segment de tiers, marques de lettrage et de pointage sur les lignes, **reste à lettrer par ligne** et ligne entamée signalée, exercice clos signalé, historique par exercice avec solde reporté, comparaison d'exercices refusée quand l'exercice n'existe pas, liste des comptes qui ont bougé, écran avec fenêtre libre et export CSV, 8 + 3 tests. Reste l'interrogation par montant ou par lettre (le finder de Sage) et l'appel d'une écriture depuis une ligne |
| **E** | Taxes Bénin en saisie + **déclaration TVA** mensuelle | tests de calcul fiscal | **livrée** : génération des lignes de taxe en saisie, déclaration recalculée et rapprochée du grand livre, export CSV. Reste le reversement des acomptes et retenues (compte 442100), qui relève d'une autre obligation |
| **F** | Lettrage, rapprochement bancaire | tests | **livrée** : lettrage des comptes de tiers — producteur `lettrage.ts`, écran, lettrage manuel et automatique (proposé avant d'être appliqué), **lettrage partiel d'un règlement à-compte** (§5.0 : imputations ligne à ligne, reste à lettrer affiché, trois passes de proposition dont les à-comptes du plus ancien au plus récent, marques anciennes sans `portions` toujours lisibles), délettrage tracé, export en trois formats, 40 tests — **et rapprochement bancaire** : relevés saisis ligne à ligne, producteur `rapprochement.ts`, état de rapprochement avec écart expliqué et reste inexpliqué, pointage manuel et automatique (par référence puis par montant), dépointage tracé, écran, export, 13 + 5 tests — **et l'import d'un fichier de relevé** (§5.3 : producteur `import-releve.ts`, CSV/OFX/CAMT.053, détection du séparateur, de la décimale, des colonnes et de l'ordre des dates, aperçu avant écriture, doublons écartés, provenance gardée sur le relevé et tracée, relevé d'exemple produit depuis le grand livre, 33 tests) — **et l'import depuis Excel et PDF** (§5.3 :
adaptateur `web/lecture-fichier.ts`, socle commun `lireGrilleDeReleve` partagé avec le CSV, PDF lu en
colonnes ou reconnu à la forme, relevé scanné refusé, exemple écrit puis relu dans les trois
contenants, lecteurs chargés à la demande, 23 + 2 tests) |
| **G** | Clôtures : période, exercice, à-nouveaux, *Create New Year* | tests | **livrée** : rapport de préparation, clôture d'exercice (solde des comptes de gestion vers 121000, à-nouveaux segment de tiers compris, ouverture de l'exercice suivant, archivage de l'exercice clos), lectures par exercice, écran avec confirmation explicite, 14 tests. La réouverture d'un exercice clos n'est pas produite : la clôture est définitive, et l'écran le dit |
| **H** | États financiers OHADA révisé (producteur distinct), exports PDF/Excel/CSV de tous les documents | fichiers produits et vérifiés | **largement livrée** : bilan et compte de résultat OHADA révisé — producteur `etats-financiers.ts`, deux écrans, arrêté par période, **colonne N-1 dès qu'un exercice est clos**, 18 tests ; puis les **trois formats d'export** (§5.6) — description unique du document, Excel à montants numériques avec un onglet par section, PDF A4 paginé avec en-tête de société, CSV inchangé, chargement à la demande des bibliothèques, 14 tests de rendu (dont un XLSX relu par `exceljs` et un PDF dont le texte imprimé est décodé) plus 2 parcours d'écran ; puis le **tableau des flux de trésorerie** (§5.1 : producteur `flux-tresorerie.ts`, modèle `MODELE_TFT` aux codes de l'imprimé, activité en méthode indirecte à partir de la capacité d'autofinancement globale, investissement et financement en méthode directe lus dans les écritures de trésorerie, à-nouveaux traités en ouverture et non en flux, virements internes écartés et comptés, contrôle ZH contre la trésorerie réelle avec les comptes non classés listés, écran et export en trois formats, 11 + 5 tests). Reste le tableau de variation des activités, dont le modèle n'a pas de source officielle |
| **I** | Piste d'audit, habilitations par écran, import/export de données, sauvegarde/restauration, hôte Windows | tests + package installable | piste d'audit **livrée** (ajout-seulement, attribuée, horodatée) ; **sauvegarde et restauration livrées** (§5.7) — fichier JSON autosuffisant et versionné, inventaire chiffré, montants en chaînes, quatre refus motivés dont le grand livre déséquilibré et le paquet pays différent, vérification à l'écran puis dans le noyau, remplacement tracé avec le contenu écrasé, écran avec marche arrière obligatoire, 7 + 3 tests. Restent les habilitations par écran, l'import de données tiers (FEC, ECF, CSV), la sauvegarde automatique et l'hôte Windows |

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
