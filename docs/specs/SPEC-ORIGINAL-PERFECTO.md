# SPEC — Logiciel d'origine PERFECTO (référence fonctionnelle)

**Source :** dossier Google Drive « Créer un Prototype de Logiciel de Comptabilité Windows »
(id `1Ozp0O40xkECqgxO5Ap4VfXOcqL6T-ZIW`, transmis le 13/10/2026), lu via le connecteur Drive.
**Méthode :** lecture intégrale des notes d'analyse (`*_findings.md`), des deux documents
maîtres (audit + cadrage maître v2), inventaire des binaires et captures.
**Statut :** référence fonctionnelle validée — ce document fait foi pour toute règle métier.

---

## 1. Identité technique de l'original

| Élément | Constat |
|---|---|
| Produit | PERFECTO, version affichée **25.0429** |
| Plateforme | Windows 32 bits, moteurs **WinDev 5.5** + composants WinDev 20 ; horodatages PE 1999–2002 |
| Paquet | `INSTALL.EXE` + `PERFECTO.WDZ` (archive native `WDZIP10`, 52 682 537 o) + `REPDISK.BMP`, `PERFECTO.ICO` |
| Installation | 29 fichiers, ~72 Mo ; ~87 Mo après extraction du module comptable |
| Stockage | Hyper File par dossier : 50 `.FIC`, 43 `.NDX`, 11 `.MMO` pour le dossier de démo `CR000-26` |
| Composants | Intégrateur `perfecto.exe`, `z.wdl`, `form.wdl` ; module comptable `CG.exe`, `cgF1.wdl`, `cgPi.wdl`, `cgTB.wdl` ; `WD553EXE/WDW/STD/PRN.DLL` |
| Sécurité d'origine | Propriétaire de licence, répertoire de dossiers, poste, utilisateur, mot de passe ; titre « Pas de licence enregistrée » |
| Santé | ClamAV : 0 infection sur 5 binaires ; audit réalisé sous Wine isolé sans réseau |

**Comportements hérités à éliminer (règles produit) :**
- R-ORG-1 : aucun démarrage ne doit dépendre d'une imprimante par défaut (l'original bloque
  dans `WD553PRN.DLL` / `hMin.PRO` / `iCréePolice`) ; aperçus et PDF natifs obligatoires.
- R-ORG-2 : pas de répertoire partagé données/exécutables hérité ; base transactionnelle
  unique, cloisonnement logique par organisation et exercice.
- R-ORG-3 : pas d'empilement MDI de fenêtres ; fenêtre principale + navigation latérale +
  listes filtrables + panneaux de détail ; raccourcis clavier documentés.
- R-ORG-4 : pas de mécanismes obsolètes (raccourci posé en VB-Script, licence par poste).

## 2. Modèle conceptuel observé (intégrateur → dossier)

- **Société** : fiche centralisée avec onglets Définition, Adresse, Contact, **IFU** ;
  code court (refus « Code société invalide » si libre non conforme) ; démo `000 / SOCIETE TEST`.
- **Dossier** = combinaison **module + société + période** ; répertoire physique
  `CR000-26` (module CR, société 000, année 26). Opérations : Insérer, Dupliquer, Supprimer,
  Positionner, Actualiser, Réindexer à l'ouverture, Ouverture, Sauvegarde, Restauration,
  Fermer ; métadonnées dernière sauvegarde / dernière modification ; mode Actif.
- **Période** : attachée au dossier (01/01/2026–31/12/2026 en démo), pas seulement à la société.
- **Référentiel** : choisi à la création du dossier via le catalogue des modules ; la société
  doit préexister (bouton `Sociétés… <F2>`).

## 3. Catalogue des modules (14 variantes + intégrateur)

| Code | Application | | Code | Application |
|---|---|---|---|---|
| IN | Intégrateur PERFECTO | | CQ | Comptabilité SYSCBNL |
| CA | Assurances CIMA | | **CR** | **SYSCOHADA révisé (cible)** |
| CB | Bancaire UEMOA | | CS | S.G.I. |
| CC | Générale PARMEC | | GM | Comptabilité des matières |
| CF | SFD Microfinance | | GP | Maîtrise d'Ouvrages Déléguée |
| CG | Comptabilité France | | | |
| CI | CIPRES | | CL | Plan comptable libre |
| CO | OHADA | | | |

Attributs additionnels observés : Code-barres, Ressources Humaines, Médecine,
Factures normalisées, FEC, ITS, INV.
**Règle R-REF-1 :** les variantes sont des **profils versionnés** du noyau (plan initial,
classes, contrôles, modèles d'états, règles de clôture, taxes, formats d'export), jamais des
applications distinctes. **R-REF-2 :** un profil validé n'est jamais modifié rétroactivement
(migration explicite ou activation à un nouvel exercice).

## 4. Menus et fonctions du module comptable (CR)

- **Fichier** : exports/imports inter-logiciels, import balance générale, import OHADA non
  révisé, centralisations (auxiliaire, salaires, stocks-facturation), annulation de
  centralisation, consolidations avant/après résultat, recalcul des soldes, réparation de
  base, ouverture exercice suivant, guide, sortie.
- **Définitions** : plan de comptes généraux, fournisseurs, clients, personnel, débiteurs et
  créditeurs divers, centres de responsabilité, domaines d'activité, prestations, catégories
  de dépenses, sources de financement, comptes alternatifs, analyses, localisations et
  éléments d'immobilisation, journaux. Rubriques analytiques activées conditionnellement
  par dossier.
- **Saisies** : saisie journaux, caisse temps réel, mouvements (généraux, tiers, analytiques),
  programmation/affectation des règlements, lettrage, pointage, commandes fournisseurs,
  budgets prévisionnels, reports à nouveau et leur clôture, vérification des équilibres
  fondamentaux, amortissements automatiques, clôture périodique, déductions/réintégrations
  fiscales, charges supplétives, calcul du résultat avec états financiers, arrêt définitif.
- **Éditions** : journaux (détail des lignes, pièces modifiées après 1ʳᵉ saisie, pièces
  déséquilibrées, cumuls par compte individuel/synthèse, par tiers, par centre analytique,
  par devise, fiches d'imputation vierges), comptes généraux, tiers, devises, analytique,
  budgets, lettrage, pointage, rapprochements bancaires, immobilisations, déclarations
  périodiques, états spécifiques, **tableaux financiers OHADA révisé**, définitions et plans.
- **Outils** : impression fenêtre courante (F11), calculatrice (F12). **Paramètres** : vide
  sous Wine (droit ou limite moteur) — à reconstruire depuis les autres écrans.

## 5. Journaux, saisie et plan comptable

- Journaux courants : `ACH`, `CAI`, `OD`, `SAL`, `VEN` ; techniques : `X-IMP`
  (centralisation), `Y-ABN` (abonnements), `Z-AMO` (amortissements auto), `Z-RES`
  (résultat de période). Par journal : nombre de pièces, totaux débit/crédit, pièce en
  cours, état de clôture.
- Grille de saisie : Date, Pièce, Compte, Référence, Débit, Crédit, Libellé. Détail de
  ligne : **tiers, échéance, devise, immobilisation, commande, axes analytiques**,
  document numérisé associé. Actions : chercher, remplacer, dupliquer, imprimer,
  **numéroter**, réparer, insérer, modifier, supprimer, récupérer, éditer la fiche,
  nouvelle pièce, associer un document.
- Plan comptable SYSCOHADA **hiérarchique** : code, intitulé, devise, compte bancaire
  éventuel, imputations analytiques, échéances ; opérations insertion, modification,
  suppression, **fusion**, comptes collectifs.

## 6. Entités cibles (audit §6) et couverture actuelle du noyau TS

| Entité | Invariants | Noyau TS actuel |
|---|---|---|
| Organization | identité, IFU, contacts centralisés | ✔ (`Organization`, IFU présent) |
| FiscalYear / AccountingPeriod | cycle + verrou indépendant par période | ✔ exercice + périodes ; verrou = `isClosed` |
| Account | code unique par profil, hiérarchie | ✔ plat ; **hiérarchie/fusion à ajouter** |
| ThirdParty | fiche unique typée (client, fournisseur, salarié…) | ✗ tranche 2 |
| Journal | code unique par organisation | ✔ |
| Entry / EntryLine | équilibre, immutabilité, tiers/échéance/devise/axes | ✔ base ; **tiers, échéance, devise, axes à ajouter** |
| Attachment | empreinte, MIME, stockage contrôlé | ✗ |
| Reconciliation | lettrage/rapprochement traçables | ✗ tranche 3 |
| AuditEvent | ajout seulement, horodaté, attribué | ✔ |
| PeriodLock | interdit mutations après clôture | ✔ (message métier conservé) |

## 7. Cadrage produit v2 (décisions qui nous lient)

- **Principe directeur** : une seule plateforme métier, plusieurs interfaces (Windows
  installable hors-ligne + PWA) et plusieurs déploiements ; règles comptables jamais
  recodées par canal.
- **Éditions** : Local Solo (achat, 1 user, base locale), Local Équipe (service réseau
  local), Cloud (abonnement, base isolée par client), Cloud hors ligne (cache + synchro).
  L'expiration d'abonnement ne détruit rien : passage **lecture + export** après grâce.
- **Synchro** : commandes idempotentes (id opération, appareil, user, organisation,
  horodatage local, version attendue) ; pièce validée jamais fusionnée silencieusement
  (extourne ou ajustement) ; brouillons/référentiels en version optimiste avec choix
  explicite ; **période clôturée = rejet central même pour un poste reconnecté** ;
  pièces jointes synchronisées séparément avec empreinte.
- **Modules** dans l'ordre : CG SYSCOHADA révisé → analytique → ventes-stocks-facturation
  → courriers → paie (paie après cadrage réglementaire pays).
- **Exigences non fonctionnelles** : intégrité, audit attribué/horodaté, isolation par
  organisation, résilience réseau, performance listes, sauvegarde/restauration testable,
  sécurité (transport chiffré, mots de passe hachés, rôles minimaux), accessibilité
  clavier/contrastes, impression sans imprimante, portabilité (export complet documenté).
- **MVP P0** : organisation+exercice, plan SYSCOHADA hiérarchique personnalisable,
  journaux soumis aux périodes, tiers à fiche unique, saisie multi-lignes équilibrée,
  audit complet, états journal/grand livre/balance exportables PDF/Excel.
  **P1** : pièces jointes, lettrage/délettrage tracé, rapprochement bancaire, clôture +
  reports à nouveau. **P2** : budgets/analytique, immobilisations, migration PERFECTO.
- **Critère d'acceptation du prototype** : créer société + exercice, ouvrir le journal
  Achats, saisir une facture fournisseur équilibrée avec justificatif, valider, retrouver
  les mouvements au grand livre et à la balance, exporter ces deux états en PDF ;
  interdire écriture déséquilibrée, date hors exercice, modification d'une pièce validée ;
  tracer user/heure/nature de chaque changement ; démarrer sans imprimante ni admin.

## 8. Note d'architecture (divergence assumée)

Le cadrage maître proposait A (.NET Blazor Hybrid + WASM) ou B (PWA TS + Tauri) et
recommandait A. **Décision utilisateur du 13/10/2026 : noyau TypeScript** (variante de B
étendue : noyau partagé `packages/` + futur hôte desktop Tauri/Electron), motivée par la
boucle de validation complète disponible dans l'environnement de travail Arena
(compilation, tests, prévisualisation) qu'aucun outillage .NET ne peut offrir ici.
Le principe directeur du cadrage (règles jamais recodées par canal) est respecté : le
noyau `@perfecto/*` est l'unique implémentation, les hôtes ne fournissent que des
adaptateurs `StoragePort`.
