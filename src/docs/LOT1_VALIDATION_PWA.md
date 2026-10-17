# Validation PWA du Lot 1 — premier incrément

## Accueil et stockage local

L’accueil de la comptabilité générale s’affiche avec le stockage local **IndexedDB disponible hors ligne**. Le profil SYSCOHADA révisé fournit initialement 18 comptes, 6 journaux, 3 pièces validées et 1 brouillon. Les mouvements validés sont équilibrés à 2 832 000 XOF au débit et au crédit.

![Accueil de la comptabilité générale](assets/lot1-accounting-home.png)

## Saisie et validation d’une pièce

Le formulaire charge les comptes et journaux depuis IndexedDB, calcule les totaux et désactive la validation tant que l’écriture n’est pas équilibrée. Une pièce `OD-2026-TEST` a été saisie avec un débit de 150 000 XOF sur le compte `601100` et un crédit de 150 000 XOF sur le compte `401100`.

Après validation, la liste conserve la pièce dans IndexedDB avec le statut **Validée** et affiche son détail. La balance est recalculée à 2 982 000 XOF au débit comme au crédit.

![Pièce validée et détail](assets/lot1-entry-posted.png)

## Plan comptable persistant

Le plan présente les comptes avec classe, nature, exigence d’auxiliaire et état. Le compte `601200 — Achats de matières premières` a été ajouté avec la nature **Charge**. La liste passe de 18 à 19 comptes. Un rechargement complet conserve ce compte, confirmant la persistance IndexedDB.

![Plan comptable après rechargement](assets/lot1-chart-of-accounts.png)

## Journal et grand livre

Le **Journal des écritures** affiche les seules pièces validées, filtre par journal et totalise 2 982 000 XOF au débit et au crédit.

![Journal des écritures](assets/lot1-journal.png)

Le **Grand livre** regroupe les mouvements par compte et calcule le solde progressif. Le compte fournisseur `401100` présente un solde créditeur de 622 000 XOF.

![Grand livre du compte fournisseur](assets/lot1-general-ledger.png)

## Périodes comptables

L’écran présente les douze mois de l’exercice 2026. La clôture de février modifie immédiatement son état et persiste dans IndexedDB. Une pièce équilibrée de 50 000 XOF datée du 15 février a ensuite été refusée avec le message métier **« La période février 2026 est clôturée. »** sans perte de saisie ni erreur technique dans la console.

![Blocage d’une pièce sur période clôturée](assets/lot1-period-locked.png)

Après le test, février a été rouvert afin de laisser la démonstration dans un état utilisable.

![Périodes remises en état ouvert](assets/lot1-periods-open.png)

## Résultat

La navigation, IndexedDB, les calculs, la validation des pièces, la balance, le journal, le grand livre et le verrouillage des périodes ont été vérifiés dans un navigateur réel. La console ne contient aucune erreur après ces opérations.
