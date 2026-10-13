# Index de la documentation du logiciel d'origine

Registre tenu à jour : chaque source est indexée ici, ses règles extraites vers une fiche
de spec, puis tracées jusqu'au code qui les applique.

**Mode de transmission retenu :** Google Drive, lu via le connecteur Drive de la
conversation (décision du 13/10/2026). Aucun lien web n'est nécessaire : le connecteur
liste, lit et télécharge directement.

## Sources

| # | Source | Type | Analysée le | Fiche |
|---|---|---|---|---|
| 1 | Dossier Drive `1Ozp0O40xkECqgxO5Ap4VfXOcqL6T-ZIW` (« Créer un Prototype de Logiciel de Comptabilité Windows », 100+ fichiers : binaires WinDev, `PERFECTO.WDZ` 52 Mo, 14 notes `*_findings.md`, ~30 captures, scripts, sources .NET à plat, 2 zips d'audit) | dossier | 13/10/2026 | `SPEC-ORIGINAL-PERFECTO.md` |
| 2 | `Audit du modèle PERFECTO et cadrage du prototype de comptabilité Windows.md` (20,6 Ko, Manus AI) | doc maître | 13/10/2026 | id. §6–7 |
| 3 | `Cadrage maître du produit de gestion PERFECTO Nouvelle Génération.md` (18,9 Ko, v2.0) | doc maître | 13/10/2026 | id. §7 |
| 4 | Notes d'exploration : visual, installer_screen, app_screen, login, dossier, society, module_selection, modules, accounting_shell, menu_capture_notes, menu_file_definitions, menu_entries_reports, menu_tools_parameters, menu_detail, journal_entry | findings | 13/10/2026 | id. §1–5 |
| 5 | `DOSSIER_AUDIT_PERFECTO.zip` (186 Ko), `CADRAGE_PRODUIT_V2.zip` (506 Ko), `architecture_cible.mmd/.png` | annexes | inventoriées, non ouvertes | à ouvrir si besoin |
| 6 | Page 2+ de l'inventaire Drive (copies à plat des sources .NET du Lot 0/1) | code dupliqué | ignoré (fait double avec `legacy/`) | — |

## Non analysé / à demander si besoin

- Contenu détaillé des deux zips d'annexes (empreintes SHA-256, rapport ClamAV,
  inventaires de fichiers, relevés techniques) — utile uniquement pour la traçabilité
  de l'audit d'origine.
- Scans éventuels sans couche texte : non OCR-isables ici ; demander une version
  textuelle le cas échéant.

## Modèle de fiche de spec

Chaque fiche `docs/specs/SPEC-<module>.md` contient :

1. **Périmètre** : ce que le module couvre dans le logiciel d'origine ;
2. **Règles de gestion** : numérotées R1, R2… avec message d'erreur métier exact ;
3. **Écrans** : champs, contrôles, états visuels attendus ;
4. **Calculs** : formules, arrondis, totaux ;
5. **Références réglementaires** : SYSCOHADA, fiscalité, paie par pays ;
6. **Implémentation** : paquet/fichier TypeScript + tests qui couvrent chaque règle.
