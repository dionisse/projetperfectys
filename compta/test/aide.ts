/**
 * Aide de test : un service sur dossier de démonstration, et une saisie complète.
 *
 * Partager ce harnais évite que chaque suite réinvente la façon de poster une écriture — et donc
 * que les tests divergent sur ce qu'ils considèrent comme une saisie valide.
 */

import {
  BENIN,
  ServiceComptable,
  StockageMemoire,
  ZERO,
  analyserMontant,
  oppose,
  proposerLignesDeTaxe,
  type DateCivile,
  type DemandeLigne,
  type EtatDossier,
  type Montant,
  creerDossierDemonstration
} from "../src/noyau/index";

export const ANNEE_DEMO = 2026;

export function nouveauService(options?: {
  annee?: number;
  maintenant?: Date;
  utilisateur?: string;
}): { service: ServiceComptable; stockage: StockageMemoire<EtatDossier> } {
  const annee = options?.annee ?? ANNEE_DEMO;
  const maintenant = options?.maintenant ?? new Date(`${annee}-04-15T08:00:00.000Z`);
  const stockage = new StockageMemoire<EtatDossier>(creerDossierDemonstration({ annee }));
  const service = new ServiceComptable(stockage, {
    utilisateur: options?.utilisateur ?? "superviseur",
    horloge: () => maintenant,
    paquetPays: BENIN
  });
  return { service, stockage };
}

export const xof = (texte: string): Montant => analyserMontant(texte, BENIN.devise);

const entier = (valeur: string | Montant | undefined): Montant => (typeof valeur === "bigint" ? valeur : ZERO);

export interface LigneDeSaisie {
  compte: string;
  libelle: string;
  debit?: string;
  credit?: string;
  codesTaxe?: string[];
}

/**
 * Saisit une écriture complète — lignes de base, lignes de taxe produites par le noyau,
 * contrepartie équilibrante — puis comptabilise le lot. C'est le chemin de l'écran de saisie.
 */
export async function posterLot(
  service: ServiceComptable,
  demande: {
    journalCode: string;
    date: DateCivile;
    piece: string;
    libelle: string;
    lignes: LigneDeSaisie[];
    contrepartie: string;
    tiers?: string;
  }
): Promise<string> {
  const lot = await service.creerLot({
    journalCode: demande.journalCode,
    date: demande.date,
    libelle: demande.libelle
  });

  // Les lignes de taxe sont proposées d'après le paramétrage **du dossier** : un taux que
  // l'utilisateur a ajouté ou corrigé s'applique ici comme dans l'écran de saisie.
  const codesDuDossier = await service.codesTaxe();
  const demandes: DemandeLigne[] = [];
  for (const ligne of demande.lignes) {
    const debit = ligne.debit !== undefined ? xof(ligne.debit) : ZERO;
    const credit = ligne.credit !== undefined ? xof(ligne.credit) : ZERO;
    const codes = ligne.codesTaxe ?? [];
    const base: DemandeLigne = { compte: ligne.compte, libelle: ligne.libelle, codesTaxe: codes };
    if (debit !== ZERO) {
      base.debit = debit;
    }
    if (credit !== ZERO) {
      base.credit = credit;
    }
    demandes.push(base);
    for (const taxe of proposerLignesDeTaxe(
      { compte: ligne.compte, libelle: ligne.libelle, debit, credit, codesTaxe: codes },
      codesDuDossier
    )) {
      demandes.push({
        compte: taxe.compte,
        libelle: taxe.libelle,
        ...(taxe.sens === "debit" ? { debit: taxe.debit } : { credit: taxe.credit })
      });
    }
  }

  const totalDebit = demandes.reduce<Montant>((total, ligne) => total + entier(ligne.debit), ZERO);
  const totalCredit = demandes.reduce<Montant>((total, ligne) => total + entier(ligne.credit), ZERO);
  const ecart = totalDebit - totalCredit;
  if (ecart !== ZERO) {
    demandes.push({
      compte: demande.tiers ? `${demande.contrepartie}-${demande.tiers}` : demande.contrepartie,
      libelle: "Contrepartie",
      ...(demande.tiers ? { tiersCode: demande.tiers } : {}),
      ...(ecart > ZERO ? { credit: ecart } : { debit: oppose(ecart) })
    });
  }

  await service.ajouterEcriture(lot.id, {
    piece: demande.piece,
    date: demande.date,
    libelle: demande.libelle,
    lignes: demandes
  });
  await service.marquerPret(lot.id);
  await service.comptabiliserLot(lot.id);
  return lot.id;
}

/** Vente de marchandises taxée à 18 %, réglée par le compte du client. */
export async function posterVente(
  service: ServiceComptable,
  demande: { date: DateCivile; piece: string; montant: string; tiers?: string }
): Promise<void> {
  await posterLot(service, {
    journalCode: "VTE",
    date: demande.date,
    piece: demande.piece,
    libelle: "Vente de marchandises",
    lignes: [
      {
        compte: "701100",
        libelle: "Vente de marchandises",
        credit: demande.montant,
        codesTaxe: ["TVA-V18"]
      }
    ],
    contrepartie: "411100",
    tiers: demande.tiers ?? "CLI01"
  });
}

/** Achat de marchandises taxé à 18 % avec l'acompte de 1 % retenu au fournisseur. */
export async function posterAchat(
  service: ServiceComptable,
  demande: { date: DateCivile; piece: string; montant: string; tiers?: string }
): Promise<void> {
  await posterLot(service, {
    journalCode: "ACH",
    date: demande.date,
    piece: demande.piece,
    libelle: "Achat de marchandises",
    lignes: [
      {
        compte: "601100",
        libelle: "Achat de marchandises",
        debit: demande.montant,
        codesTaxe: ["TVA-A18", "ACHT-1"]
      }
    ],
    contrepartie: "401100",
    tiers: demande.tiers ?? "FOU01"
  });
}
