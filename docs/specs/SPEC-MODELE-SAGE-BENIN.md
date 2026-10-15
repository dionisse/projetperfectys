# SPEC — Modèle Sage 300 General Ledger, arrimé au SYSCOHADA révisé (pays pilote : Bénin)

> **Décision du 15/10/2026 (utilisateur)** : « nous allons vider tout ceci, partir sur un modèle
> Sage comptabilité mais arrimé sur le plan SYSCOHADA Afrique de l'Ouest, pays pilote le Bénin. »
> La documentation PERFECTO déjà ingérée (`SPEC-ORIGINAL-PERFECTO.md`) reste un matériau de fond :
> elle documente la profondeur fonctionnelle attendue et le vocabulaire des clients, mais **le
> modèle de référence de la présentation et des workflows devient Sage 300**.

Ce fichier consigne deux choses, afin qu'aucune ne dépende d'une mémoire de session :

1. la **structure réelle de Sage 300 General Ledger**, relevée dans les guides fournis ;
2. le **paquet pays Bénin** (paramètres fiscaux vérifiés) et son arrimage au SYSCOHADA révisé.

---

## 1. Sources

### 1.1 Dossier Drive « Sage » (24 guides, fournis par l'utilisateur)

Dossier : `1ySTJ9buGkhXthEJsUoc10F_78fBekGzN`. Les identifiants ci-dessous sont ceux à relire,
dans l'ordre d'utilité pour ce chantier (le connecteur Drive doit être rechargé à chaque tour).

| Priorité | Document | Identifiant Drive | Taille |
|---|---|---|---|
| 1 | Sage 300 General Ledger User's Guide (2023, août 2022) | `1jSkyIw-XzNd51ydNeSbAf7NC8ySsyYSs` | 3,0 Mo |
| 2 | Sage 300 General Ledger Users Guide (autre édition) | `11MezBYtSWxDv07_NUCaIdHaQVObLUZLP` | 2,7 Mo |
| 3 | Sage 300 Financial Reporter User's Guide (états financiers) | `17AkkF_q8sWSdg2uOP1RVt_JvGeuyERyR` | 2,7 Mo |
| 4 | Sage 300 Accounts Payable (tiers fournisseurs) | `1Vr2jhCTseipQ5SX8i7S-zOGqR1C5D4gA` | 6,5 Mo |
| 5 | Sage 300 Accounts Receivable (tiers clients, lettrage) | `1kDsi8BVQPHXk8n7Z4SD0icUXTXZt9IU2` | 8,7 Mo |
| 6 | Sage 300 Bank Services (rapprochement bancaire) | `1FapJ91ZUtS9qfL70PQE864y_oQRLVwtY` | 2,3 Mo |
| 7 | Sage 300 Tax Services (taxes, codes de taxe) | `1CQNosVtrabhF3ttHRHfgT-zy3XXf6qLF` | 1,1 Mo |
| 8 | Sage 300 G/L Consolidations | `1-4fBKI7uHx8d-Z8er2NCKtxoRTFWEikz` | 1,3 Mo |
| 9 | Sage 300 Intercompany Transactions | `1stpxevi7PEMA5E9i4m4tzoKzTgC_tsX8` | 1,3 Mo |
| 10 | Sage 300 Payment Processing | `1YA3cxDYd98HjcoPJ9vorqf8wQCQYkiE6` | 1,1 Mo |
| 11 | `tutorial-fr.pdf` (tutoriel en français) | `10aM-kLkAuaHjVYpSVMzediI7iIl7Pflj` | 0,6 Mo |
| 12 | `sbr_outil_excel.pdf` (Sage Business Reporting / Excel) | `1xt-AfbyI2Y0mhFZlNDC1ZbtvMh3X5wFm` | 2,6 Mo |
| 13 | Sage 50 (manuel, 22 Mo — autre gamme, à ne consulter qu'en cas de doute de gamme) | `1h3uddIuEpB31Rr-MvTsio5d-97mMEdMT` | 22,7 Mo |
| — | Hors périmètre comptable : Order Entry, Purchase Orders, Inventory Control, Commandes fournisseurs, Gestion des stocks, CRM Integration, Malaysia Tax Report, Compatibility Guide, GetStart/GettingStarted | voir le listing du dossier | — |

**Lecture en cours** : le *General Ledger User's Guide* a été lu jusqu'au chapitre 1 (18 000
caractères extraits). Le reste (chapitres 2 à 7 + annexes A à D) est à lire par tranches ciblées,
en particulier l'**annexe A « Screen Guides »** (pages 136-236 : Accounts, Periodic Processing,
Reports, Setup, Transactions) et l'**annexe C** (pages 240-248 : menu commands, outils de saisie,
*detail entry tables*, raccourcis clavier des tables de détail, *finder criteria*).

### 1.2 Fiscalité béninoise

- DGI Bénin, *Système fiscal de référence Bénin* (tableaux de taux officiels) :
  `https://api.impots.bj/media/6172b9cbdbb2e_SYSTEME%20FISCAL%20DE%20R%C3%89F%C3%89RENCE%20BENIN-2021.pdf`
  — la source la plus proche d'un texte officiel ; à relire avant de coder un taux.
- Guides de synthèse croisés (taux identiques) : `yoon.africa/guide-pratique/fiscalite-entreprises-benin`,
  `export.agence-adocc.com` (fiche pays Bénin), `ayido.africa`, `auditiaafrica.com/actualites/37`
  (loi de finances 2026).
- Cadre comptable : **SYSCOHADA révisé**, obligatoire dans les États OHADA depuis le
  1ᵉʳ janvier 2018 ; le Bénin est État membre de l'OHADA et de l'UEMOA (devise XOF).

---

## 2. Structure de Sage 300 General Ledger

Sage 300 organise le module par **dossiers fonctionnels** ouvrant des **écrans** (un écran = une
fenêtre de saisie ou d'édition, avec tables de détail, boutons de barre d'outils et critères de
recherche « finder »). Relevé exact du guide :

### 2.1 G/L Setup (paramétrage)

| Écran Sage | Rôle |
|---|---|
| **G/L Options** | Options de traitement, dont l'onglet **Posting** (exercice courant, impression des lots avant comptabilisation, comptabilisation sur exercices antérieurs autorisée, *Allow Provisional Posting*, *Force Listing of Batches*) et l'onglet **Segments** (structure par défaut). |
| **Segment Codes** | Valeurs autorisées par segment du numéro de compte. |
| **Account Structures** | Format du numéro de compte : nombre et longueur des segments, séparateurs. |
| **Source Codes** | Codes de provenance des écritures (saisie manuelle, autres modules), avec profil d'édition. |
| **Source Journal Profiles** | Profils de tri et d'impression du détail des écritures comptabilisées, par code source. |
| **Account Groups** | Regroupement de comptes servant au reporting (bilan, résultat) et à la consolidation. |
| **Revaluation Codes** | Réévaluation des comptes en devise (multidevises). |
| **Optional Fields** | Champs optionnels (axes analytiques libres) portés par les écritures. |
| **Recurring Entries (setup)** | Modèles d'écritures récurrentes. |

Séquence d'installation imposée par le guide : activer le module (année courante + date de début de
la plus ancienne année conservée) → **G/L Options** → **Segment Codes** puis **Account Structures**
→ retenir la structure par défaut dans G/L Options → **Source Codes** et **Source Journal Profiles**
→ **Account Groups** → ajouter les comptes (**Accounts**) → saisir au minimum les cumulés
d'exercice (historique).

### 2.2 G/L Accounts (plan comptable)

- **Accounts** : fiche de compte, avec ses segments, son groupe, son état (actif/inactif), ses
  paramètres de devise, ses budgets ; « Information Stored in General Ledger Accounts ».
- **Budgets** : budgets par compte et par période.
- **Maintaining Accounts** : modification, activation/désactivation, suppression contrôlée.

### 2.3 G/L Transactions (saisie) — le cœur du modèle

- **Batches** : *Adding a New Batch*, *Editing a Batch*, *Deleting a Batch*. **La pièce n'est pas
  l'unité de travail : c'est le lot.** Un lot porte une description, un code source, un numéro, un
  état (`Ready to Post`), et regroupe plusieurs écritures.
- **Journal Entry** : *Adding a Journal Entry* — saisie en table de détail (lignes débit/crédit).
- **Posting Transaction Batches** : comptabilisation **par lot**, avec option d'impression du lot
  avant comptabilisation, et **comptabilisation provisoire** (*provisional posting*) qui alimente un
  « provisional fiscal set » séparé pour tester l'effet sur le grand livre avant la comptabilisation
  définitive.
- **Recurring Entries** : génération d'un lot d'écritures récurrentes.
- **Reversing a Posted Batch or Journal Entry** : contre-passation d'un lot ou d'une écriture
  comptabilisée (notre extourne).
- **Viewing Batch Information** ; **Importing Batches** (lots importés d'autres modules/fichiers).

### 2.4 G/L Periodic Processing (clôtures)

*Period End Maintenance* · *Year End Processing* · *Consolidating Transactions* · *Clearing G/L
History* · *Allocation Batch* (ventilation) · *Batch of Recurring Entries* · **Create New Year**
(clôture des comptes de gestion vers le résultat reporté, puis bascule de l'exercice courant) ·
*Multicurrency Periodic Processes*.

Règles de calendrier relevées : année fiscale à **12 ou 13 périodes** (choix sur *Company Profile*,
Common Services) ; **deux périodes supplémentaires** fournies par le module, l'une pour les
ajustements de fin d'exercice, l'autre pour les écritures de clôture ; verrouillage/déverrouillage
des périodes sur l'écran *Calendar* de Common Services ; **impossible de comptabiliser sur un
exercice futur** ; la comptabilisation sur un exercice antérieur génère automatiquement les
écritures de clôture vers le résultat reporté ; le seul moyen de changer d'exercice courant est
*Create New Year*.

### 2.5 Interrogations

*Viewing Chart of Accounts Information* · *G/L Account History* · *Source-Currency Balances*
(multidevises) · *Looking Up Transactions Posted to G/L Accounts* · **Fiscal Set Comparison**
(comparaison de deux jeux fiscaux : variations nettes ou soldes de période).

### 2.6 Import / Export

*Importing Data to General Ledger* (comptes, lots) · *Exporting General Ledger Data* · *Creating a
GIFI Export File* (format fiscal normalisé — équivalent, pour nous, d'un format déclaratif Bénin/UEMOA).

### 2.7 G/L Reports

États du module : **Chart of Accounts**, **Trial Balance**, **Posting Journal**, **Transactions
Listing**, plus les états de paramétrage et les états analytiques. Les **états financiers**
(bilan, compte de résultat) ne sortent pas du module : ils sont produits par **Sage 300 Intelligence
Reporting** ou **Financial Reporter** (guide dédié). Conséquence pour nous : nos états financiers
SYSCOHADA/OHADA révisé sont un **producteur d'états distinct** branché sur le même noyau, pas une
vue de plus dans la liste des éditions.

### 2.8 Annexes à exploiter

- **Annexe A — Screen Guides** : navigation, aide par champ, tâches possibles, écran par écran.
  C'est la source à relire pour chaque écran à reconstruire.
- **Annexe B — Security Authorizations** : habilitations par écran (notre futur modèle de rôles).
- **Annexe C — Data Entry Tools, Tips and Shortcuts** : *Menu Commands*, outils et raccourcis de
  saisie, **Working with Detail Entry Tables**, **Keyboard Shortcuts for Detail Tables**, **Setting
  Finder Criteria**. C'est la source des comportements de grille (navigation au clavier, collage,
  insertion/suppression de lignes) et de la fenêtre de recherche universelle « finder ».

---

## 3. Concepts Sage à reprendre, et leur état dans le dépôt

| Concept Sage 300 | Ce que le dépôt contient déjà | Écart / décision |
|---|---|---|
| **Lots (batches)** : la saisie est groupée, comptabilisée par lot | `StoredEntry` = pièce individuelle ; validation pièce à pièce ; extourne par pièce | **À introduire** : un `Batch` regroupant des pièces, avec état (ouvert / prêt à comptabiliser / comptabilisé), comptabilisation en masse et listing du lot. C'est le changement de workflow le plus structurant. |
| **Account segments + structures** | Compte à code unique (`101000`), classes et types dérivés du premier caractère | **À reprendre** : numéro de compte segmenté (compte principal SYSCOHADA / auxiliaire tiers / axe), structure paramétrable et codes de segment. C'est aussi la voie propre vers l'analytique. |
| **Source codes + profils de journal** | `AccountingJournalDto` (code, type, contrepartie, actif) ; documents d'export paramétrés | **À enrichir** : chaque journal reçoit un code source et un profil d'édition/impression ; nos 8 documents d'export deviennent des profils. |
| **Account groups** | Classes et types de comptes (`accountClass`, `accountType`) | **À reprendre** : groupes de comptes servant de base aux états financiers OHADA (bilan, résultat, TFT, TVAP). |
| **Recurring entries (abonnements)** | rien | **À prévoir** (tranche ultérieure) : modèles d'écritures et génération d'un lot. |
| **Allocation batch (ventilation)** | rien | **À prévoir** : répartition d'un montant sur des comptes/axes selon une clé. |
| **Period-end / year-end, Create New Year** | `setPeriodClosed` (verrou mensuel) ; `periods` sur 12 mois | **À compléter** : périodes d'ajustement et de clôture, clôture des comptes de gestion vers le report à nouveau, création d'un exercice suivant, à-nouveaux. |
| **Provisional posting** | rien | **Décision à trancher** : équivalent fonctionnel = brouillon + balance « en incluant les brouillons ». Peut être livré plus tard. |
| **Fiscal set comparison** | rien | Utile pour comparer exercice N / N-1 dans les états. |
| **Finder (recherche universelle)** | filtres par champ dans les listes | **À reprendre** : une fenêtre de recherche réutilisable sur comptes, tiers, journaux, pièces. |
| **Detail entry tables + raccourcis clavier** | grille de saisie maison, sans navigation clavier complète | **À reprendre** : navigation au clavier dans la grille, insertion/suppression de ligne, collage. |
| **Security authorizations par écran** | rien (utilisateur unique « superviseur ») | **À prévoir** : habilitations par écran, socle des rôles. |
| **Import/export de données** | exports PDF/Excel/CSV de 8 documents (tranche 4, livré) | **À compléter** : import (comptes, lots, tiers) et export de données brutes type GIFI → format déclaratif Bénin. |
| **Rapports financiers par un producteur distinct** | `packages/exports` (moteurs) + `export-documents.ts` (documents) | Conforme : garder les états financiers OHADA comme producteur d'états branché sur le noyau. |
| **Multidevises / réévaluation** | devise unique XOF, montants décimaux exacts | Hors périmètre du pilote Bénin (XOF), mais les structures doivent rester neutres. |

Ce qui est **conservé sans réserve** (moteur, agnostique de l'écran et déjà testé — 272 tests) :
`packages/domain` (montants décimaux exacts, numérotation, tiers, lettrage/rapprochement,
justificatifs, organisation), `packages/application` (noyau, rapports, exports de documents,
catalogue), `packages/exports` (PDF, Excel, CSV), `packages/contracts`, l'adaptateur IndexedDB et la
piste d'audit. **Rien de cela n'est « vidé »** : ce qui change est la présentation, le découpage des
écrans et le workflow de saisie.

---

## 4. Paquet pays : Bénin

### 4.1 Paramètres vérifiés

| Paramètre | Valeur | Source |
|---|---|---|
| Devise | **XOF** (franc CFA, UEMOA) — sans décimale d'usage | cadre UEMOA ; déjà appliqué dans le dépôt |
| Référentiel comptable | **SYSCOHADA révisé**, obligatoire depuis le 1ᵉʳ/01/2018 (OHADA) | Acte uniforme OHADA révisé |
| Exercice fiscal | année civile 01/01 – 31/12 (sauf dérogation) | guides croisés |
| Identifiant fiscal | **IFU** (Identifiant Financier Unique) — préalable obligatoire aux déclarations | ayido.africa ; déjà modélisé (`taxIdentifier`) |
| **TVA** | taux normal **18 %** ; **0 %** exportations et opérations assimilées ; TVA due = collectée − déductible | DGI/yoon.africa |
| Retenue de TVA (LF 2026) | retenue à la source de TVA sur les **marchés publics > 50 M FCFA** (CGI art. 248 bis) | auditiaafrica |
| **IS** | **30 %** (personnes morales en général) ; **25 %** activités industrielles hors extractives et écoles privées d'enseignement | yoon.africa / ayido |
| **Minimum de perception** | **1 %** des produits encaissables (IS), 1,5 % (IBA), **3 %** BTP, **10 %** à prépondérance immobilière ; planchers **250 000 FCFA** (IS) et **500 000 FCFA** (IBA) | yoon.africa |
| **Acomptes / retenues à la source** (« AIRSI » dans l'usage) | **1 %** importations, achats commerciaux et fournitures par des personnes immatriculées à l'IFU ; **1 %** fournitures de travaux/biens/services à l'État et aux collectivités ; **3 %** prestations de services par des personnes immatriculées à l'IFU ; **5 %** autres cas | yoon.africa ; tableaux DGI |
| Retenues sur revenus de capitaux mobiliers | dividendes **7 % / 10 % / 15 %** ; intérêts **15 %** ; redevances **10 %** (personnes physiques étrangères) / **12 %** (entreprises étrangères) | agence-adocc |
| Taxe pour le développement du sport | **1 ‰** du chiffre d'affaires HT des grandes entreprises | agence-adocc ; CGI art. 293-14/15 |
| Régime des petites entreprises | **TPS** (Taxe Professionnelle Synthétique) sous 50 M FCFA de CA ; régime du forfait : **2 %** du CA pour 20 M–50 M FCFA, impôt minimum **150 000 FCFA** (CGI art. 1084-19/31) | ayido ; tableaux DGI |
| Cordon douanier (importations) | prélèvement communautaire **0,5 %** + prélèvement communautaire de solidarité **0,8 %** + redevance statistique **1 %** + TVA **18 %** sur valeur en douane ; droits de douane 0–35 % | yoon.africa |
| Intracomptabilité LF 2026 | plancher de déductibilité des charges financières intragroupe aligné sur **30 % de l'EBITDA fiscal** (CGI art. 39) ; documentation prix de transfert au-delà de **500 M FCFA** | auditiaafrica |
| Obligations déclaratives | déclarations **mensuelles** (TVA, retenues) et **trimestrielles** ; déclarations annuelles (salaires, résultats) | ayido |

**Avertissement honnête** : ces taux proviennent de guides et de tableaux DGI consultés le
15/10/2026, pas du Code général des impôts béninois lu article par article. Avant de figer un taux
dans le code, le relire dans le PDF DGI (`api.impots.bj`, section 1.2) et faire valider par
l'utilisateur. Aucun taux ne sera écrit « en dur » dans le noyau : ils appartiennent au **paquet
pays**, versionnable, comme les profils de référentiel.

### 4.2 Arrimage au SYSCOHADA révisé

Le plan SYSCOHADA révisé est commun aux États OHADA ; le Bénin n'y ajoute pas de comptes nationaux.
Ce que le paquet pays Bénin paramètre, ce sont **les comptes et les taux utilisés** :

- classe **44 — État et autres collectivités publiques** : TVA facturée (443), TVA due / crédit à
  reporter (444), TVA récupérable sur achats et sur immobilisations (445), impôts et taxes retenus
  (442, pour les retenues à la source), autres impôts et taxes à payer (446), charges à payer (448).
- classe **64 — Impôts et taxes** : impôts et taxes directs, taxes sur le chiffre d'affaires non
  récupérables, autres impôts et taxes (dont la taxe sport et la redevance statistique).
- classe **87/89 — engagements et hors bilan**, classe **11 — report à nouveau** et **12/13 —
  résultat** : nécessaires à la clôture *Create New Year* et aux états financiers.

> La numérotation exacte des subdivisions (4431, 4452, 4421…) doit être validée sur l'annexe de
> l'Acte uniforme, pas déduite. Le plan de départ du dépôt (18 comptes) est un jeu de démonstration :
> il sera remplacé par un **plan SYSCOHADA révisé complet** (classes 1 à 8, avec les subdivisions
> tierces 411/401 et les comptes d'État) comme paquet de démarrage du profil Bénin.

### 4.3 Ce que le pilote Bénin change concrètement dans l'application

1. **Profil de pays** (`Bénin`) : devise XOF, IFU obligatoire sur la fiche société, formes
   juridiques (SA, SARL, SAS, SNC, SCS, GIE, EI), calendrier fiscal (TVA mensuelle avant le 20,
   retenues mensuelles, déclarations trimestrielles et annuelles).
2. **Codes de taxe** à la manière de Sage *Tax Services* : TVA 18 %, TVA 0 % export, retenues 1 % /
   3 % / 5 %, avec le compte de taxe et le compte de contrepartie associés → la saisie d'une pièce
   calcule et lette la taxe sur les bons comptes.
3. **Plan comptable SYSCOHADA révisé complet** en paquet de démarrage, avec les comptes d'État
   béninois utilisés par les codes de taxe.
4. **États financiers OHADA révisé** (bilan, compte de résultat, TFT, TVAP) produits comme le fait
   Sage avec Financial Reporter : un producteur d'états distinct branché sur le noyau.
5. **Déclaration TVA** (état mensuel : base, TVA collectée, TVA déductible, crédit reporté, TVA due)
   — c'est le livrable qui rend le pilote Bénin utile à un cabinet, pas seulement conforme au plan.

---

## 5. Tranches proposées (ordre à valider par l'utilisateur)

| Tranche | Contenu |
|---|---|
| **A. Socle Sage** | Coquille à la Sage 300 : dossiers fonctionnels (Setup, Accounts, Transactions, Periodic Processing, Reports, Inquiry, Import/Export) + fenêtre de recherche « finder » + tables de détail navigables au clavier. Barre d'état conservée (société, exercice, période, session, stockage). |
| **B. Plan et comptes** | Plan SYSCOHADA révisé complet (paquet Bénin), numéro de compte segmenté, écran **Accounts** (fiche, groupes, états, budgets plus tard), recherche de comptes par finder. |
| **C. Lots et saisie** | **Batches** + **Journal Entry** en table de détail : ajout/édition/suppression de lot, saisie multiligne, état « prêt à comptabiliser », comptabilisation par lot, listing du lot, contre-passation. |
| **D. Tiers** | Fichier des tiers (AP/AR à la Sage), lettrage, rapprochement bancaire (Bank Services), relevés. |
| **E. Clôtures** | Period End Maintenance, Create New Year (clôture des comptes de gestion, à-nouveaux), verrous de périodes, période d'ajustement et de clôture. |
| **F. Taxes Bénin** | Codes de taxe (TVA 18 %, 0 %, retenues 1/3/5 %), calcul automatique en saisie, déclaration TVA mensuelle, export PDF/Excel/CSV. |
| **G. États financiers** | Bilan, compte de résultat, TFT, TVAP au format OHADA révisé, en producteur d'états distinct. |
| **H. Consolidation** | Accessibilité, performance des listes volumineuses, habilitations par écran, import/export de données, sauvegarde/restauration. |

---

## 6. Questions ouvertes (à trancher avec l'utilisateur)

1. **Portée du « vider tout ceci »** : présentation seule, ou aussi les données de démonstration, ou
   le noyau ? (Recommandation : garder le noyau et ses 272 tests, reconstruire la présentation.)
2. **Gamme Sage de référence** : Sage 300 GL (dossier Drive fourni) ou Sage 100 Comptabilité
   (gamme française plus proche des cabinets d'Afrique de l'Ouest) ? Les deux partagent le vocabulaire
   (plan comptable, journaux, saisie, lettrage, états), mais pas le découpage en dossiers ni les lots.
3. **Lots ou pièces** : adopter la comptabilisation par lot de Sage, ou rester à la pièce individuelle
   de PERFECTO ? Conséquence directe sur l'écran de saisie.
4. **Société de démonstration** : une société béninoise type (Cotonou, IFU, SARL) à créer pour le
   pilote — nom et IFU fictifs à convenir.
5. **Profondeur du plan comptable** : plan SYSCOHADA révisé complet (classes 1-8, plusieurs centaines
   de comptes) ou plan de cabinet réduit paramétrable ?
