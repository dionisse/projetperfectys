# Index de la documentation du logiciel d'origine

Registre tenu à jour : chaque source reçue (extraits de conversation, poussées GitHub,
captures) est indexée ici, puis ses règles sont extraites vers une fiche de spec et
traçées jusqu'au code qui les applique.

**Mode de transmission retenu :** extraits progressifs en conversation (décision du 13/10/2026).
Rappel : un poussage GitHub par fichiers < 100 Mo reste possible à tout moment.

| # | Source | Format | Reçue le | Module concerné | Fiche de spec | Statut |
|---|---|---|---|---|---|---|
| — | *(en attente du premier extrait)* | — | — | — | — | — |

## Modèle de fiche de spec

Chaque fiche `docs/specs/SPEC-<module>.md` contient :

1. **Périmètre** : ce que le module couvre dans le logiciel d'origine ;
2. **Règles de gestion** : numérotées R1, R2… avec message d'erreur métier exact ;
3. **Écrans** : champs, contrôles, états visuels attendus ;
4. **Calculs** : formules, arrondis, totaux ;
5. **Références réglementaires** : SYSCOHADA, fiscalité, paie par pays ;
6. **Implémentation** : paquet/fichier TypeScript + tests qui couvrent chaque règle.
