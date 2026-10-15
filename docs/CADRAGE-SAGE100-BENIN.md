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

## 6. Ordre de livraison

| Tranche | Livrable | Preuve |
|---|---|---|
| **A** | Noyau : montants, calendrier, comptes segmentés, plan SYSCOHADA, lots, taxes, paquet pays Bénin, grand livre, stockage | suite de tests verte en Node |
| **B** | Coquille Sage 100 (menus, barre d'état, finder) + écrans **Structure** : plan comptable, journaux, tiers | aperçu live, écrans validés par l'utilisateur |
| **C** | Écrans **Traitements** : lots, saisie des écritures en table de détail, comptabilisation, contre-passation | aperçu live + tests de parcours |
| **D** | Écrans **Interrogation** : balance, grand livre, journal, compte, historique | aperçu live |
| **E** | Taxes Bénin en saisie + **déclaration TVA** mensuelle | tests de calcul fiscal |
| **F** | Lettrage, rapprochement bancaire | tests |
| **G** | Clôtures : période, exercice, à-nouveaux, *Create New Year* | tests |
| **H** | États financiers OHADA révisé (producteur distinct), exports PDF/Excel/CSV de tous les documents | fichiers produits et vérifiés |
| **I** | Piste d'audit, habilitations par écran, import/export de données, sauvegarde/restauration, hôte Windows | tests + package installable |

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
