/**
 * Le dossier : société, référentiel, exercice, lots et grand livre.
 *
 * C'est le service que l'interface appelle. Il ne sait rien de Sage, rien du navigateur : il
 * applique des règles et tient un état persisté derrière un port de stockage.
 *
 * Toutes les mutations passent par une **file d'attente** (`#chaine`) : deux écrans qui
 * enregistreraient en parallèle produiraient deux états divergents, et la piste d'audit ne
 * correspondrait plus au grand livre.
 */

import {
  additionner,
  ErreurRegle,
  type Devise,
  ZERO,
  analyserMontant,
  formatMontant,
  XOF,
  montantDepuisChaine,
  montantVersChaine,
  type Montant
} from "./montants";
import {
  creerExercice,
  cloturerPeriode,
  formaterDateFr,
  ouvrirPeriode,
  periodeDeDate,
  periodeParNumero,
  type DateCivile,
  type Exercice
} from "./calendrier";
import { compteDepuisPlan, decouperNumero, type Compte, type CompteDuPlan } from "./comptes";
import { COMPTE_RESULTAT_EXERCICE, type Referentiel } from "./referentiels/syscohada";
import { normaliserTiers, type Tiers, type TypeTiers } from "./tiers";
import {
  CODES_SOURCE,
  inverserEcriture,
  totalLot,
  validerLot,
  type CompteResolu,
  type ContexteValidation,
  type Ecriture,
  type Journal,
  type LigneEcriture,
  type Lot,
  type NatureJournal
} from "./lots";
import { codesTaxeApplicables, formaterTaux, verifierLignesTaxees, type CodeTaxe } from "./taxes";
import { construireDeclarationTva, type DeclarationTva } from "./declaration-tva";
import {
  construireBilan,
  construireCompteDeResultat,
  type Bilan,
  type CompteDeResultat,
  type ExercicePrecedent
} from "./etats-financiers";
import {
  comptesInterrogeables,
  interrogerCompte,
  type CompteInterrogeable,
  type DemandeInterrogation,
  type InterrogationDeCompte
} from "./interrogation";
import {
  construireReleve,
  type LigneDeReleve,
  etatDeRapprochement as construireEtatDeRapprochement,
  proposerPointageAutomatique,
  verifierPointage,
  type DemandeDeReleve,
  type EtatDeRapprochement,
  type Pointage,
  type PropositionDePointage,
  type ReleveBancaire
} from "./rapprochement";
import {
  preparerCloture as preparerRapportDeCloture,
  verifierCloture,
  type LignePrevue,
  type RapportDeCloture
} from "./cloture";
import {
  codeDeLettrageSuivant,
  mouvementsALettrer,
  proposerLettrageAutomatique,
  situationsDeLettrage,
  verifierGroupeALettrer,
  type CritereDeLettrage,
  type Lettrage,
  type PropositionLettrage,
  type SituationDeLettrage
} from "./lettrage";
import {
  construireBalance,
  construireGrandLivre,
  construireJournal,
  comptePrincipalDe,
  verifierEquilibre,
  type FiltreMouvements,
  type LigneBalance,
  type LigneGrandLivre,
  type Mouvement,
  type PieceDeJournal
} from "./grand-livre";
import type { PortStockage } from "./stockage";
import { BENIN, validerIfu, type PaquetPays } from "./pays/benin";

export interface Societe {
  /** Code société : entre dans le numéro de dossier (`CR000-26`, `CG000-26`…). */
  code: string;
  raisonSociale: string;
  formeJuridique: string;
  /** IFU au Bénin ; autre identifiant fiscal ailleurs. */
  identifiantFiscal: string;
  adresse: string;
  ville: string;
  pays: string;
  telephone: string;
  courriel: string;
  regimeFiscal: string;
}

export interface EvenementAudit {
  sequence: number;
  horodate: string;
  utilisateur: string;
  action: string;
  entite: string;
  entiteIdentifiant: string;
  detail: string;
}

/** Un exercice clos, avec ce que la clôture y a produit. */
export interface ExerciceClos {
  /** L'exercice tel qu'il était au moment de la clôture : toutes ses périodes sont clôturées. */
  exercice: Exercice;
  clotureLe: string;
  cloturePar: string;
  /** Résultat porté au compte 121000, positif pour un bénéfice. */
  resultat: Montant;
  /** Lot contenant l'écriture de solde des comptes de gestion — `null` si le résultat est nul. */
  lotClotureId: string | null;
  /** Lot d'à-nouveaux de l'exercice suivant — `null` si aucun compte de bilan n'est reporté. */
  lotANouveauxId: string | null;
  totalActif: Montant;
  totalPassif: Montant;
  nombreDANouveaux: number;
}

export interface EtatDossier {
  /** Version du format d'état : une migration l'augmentera, jamais une réécriture silencieuse. */
  version: number;
  paquetPaysCode: string;
  referentielCode: string;
  societe: Societe;
  exercice: Exercice;
  comptes: Compte[];
  journaux: Journal[];
  tiers: Tiers[];
  lots: Lot[];
  /** Écritures comptabilisées, ajout-seulement. */
  mouvements: Mouvement[];
  /**
   * Marques de lettrage. Un délettrage ne retire pas la marque : il la date. L'historique d'un
   * compte de tiers reste reconstituable.
   */
  lettrages: Lettrage[];
  /**
   * Exercices clos, du plus ancien au plus récent.
   *
   * Un exercice clos ne se rouvre pas : ses mouvements, ses lots et son résultat sont figés, et la
   * colonne « N-1 » des états financiers s'appuie sur eux.
   */
  exercicesClos: ExerciceClos[];
  /** Relevés bancaires saisis, et les pointages qui les rapprochent du compte de trésorerie. */
  releves: ReleveBancaire[];
  pointages: Pointage[];
  sequencesReleves: number;
  /**
   * Codes de taxe **du dossier**, amorcés depuis le paquet pays et modifiables par l'utilisateur.
   *
   * Le paquet pays reste la référence légale, versionnée ; le dossier porte ce qui s'applique ici.
   * Un taux modifié ne réécrit rien : les écritures déjà comptabilisées gardent le calcul fait au
   * moment de leur saisie, et la modification est refusée sur un code déjà mouvementé — un changement
   * de taux passe par un nouveau code, comme dans la réalité.
   */
  codesTaxe: CodeTaxe[];
  sequencesLots: Record<string, number>;
  sequencesEcritures: Record<string, number>;
  audit: EvenementAudit[];
}

export interface ContexteDossier {
  numero: string;
  societe: Societe;
  referentiel: string;
  paquetPays: string;
  devise: string;
  exercice: number;
  periodeLabel: string;
  periodeCourante: number;
  utilisateur: string;
  stockage: string;
  derniereModification: string | null;
  comptes: number;
  journaux: number;
  tiers: number;
  lots: number;
  lotsComptabilises: number;
  mouvements: number;
  equilibre: boolean;
  /** Nombre d'exercices clos archivés dans le dossier. */
  exercicesClos: number;
}

export interface DemandeLot {
  journalCode: string;
  date: DateCivile;
  libelle: string;
  codeSource?: string;
}

export interface DemandeLigne {
  compte: string;
  libelle: string;
  /** Montant saisi en texte : l'utilisateur écrit `1 250 000` ou `1250000`. */
  debit?: string | Montant;
  credit?: string | Montant;
  /** Codes de taxe du paquet pays ; liste vide si la ligne n'est pas taxée. */
  codesTaxe?: string[];
  tiersCode?: string | null;
  echeance?: DateCivile | null;
}

export interface DemandeEcriture {
  piece: string;
  date: DateCivile;
  libelle: string;
  lignes: DemandeLigne[];
}

export interface OptionsService {
  utilisateur?: string;
  horloge?: () => Date;
  paquetPays?: PaquetPays;
}

/** Numéro de dossier à la manière de PERFECTO et des cabinets : module + société + année. */
export function numeroDeDossier(moduleCode: string, societeCode: string, exercice: number): string {
  const code = societeCode.trim().toUpperCase();
  const annee = exercice.toString().slice(-2);
  return code === "" ? `${moduleCode}-${annee}` : `${moduleCode}${code}-${annee}`;
}

export class ServiceComptable {
  readonly #stockage: PortStockage<EtatDossier>;
  readonly #horloge: () => Date;
  readonly #utilisateur: string;
  readonly #paquet: PaquetPays;
  #chaine: Promise<unknown> = Promise.resolve();

  constructor(stockage: PortStockage<EtatDossier>, options: OptionsService = {}) {
    this.#stockage = stockage;
    this.#horloge = options.horloge ?? (() => new Date());
    this.#utilisateur = options.utilisateur ?? "superviseur";
    this.#paquet = options.paquetPays ?? BENIN;
  }

  get paquetPays(): PaquetPays {
    return this.#paquet;
  }

  get referentiel(): Referentiel {
    return this.#paquet.referentiel;
  }

  /** Les codes de taxe du dossier : ceux du paquet pays, tels que l'utilisateur les a ajustés. */
  async codesTaxe(): Promise<CodeTaxe[]> {
    const etat = await this.#stockage.lire();
    return etat.codesTaxe;
  }

  /**
   * Combien de lignes tiennent à chaque compte du plan : dans le grand livre, tous exercices
   * confondus, et dans les lots encore en saisie.
   *
   * L'écran du plan s'en sert pour griser ce qui ne peut plus changer — un compte mouvementé ne change
   * pas de groupe et ne se supprime pas — au lieu de laisser l'utilisateur le découvrir par un refus.
   */
  async utilisationDesComptes(): Promise<Record<string, { mouvements: number; lots: number }>> {
    const etat = await this.#stockage.lire();
    const compte: Record<string, { mouvements: number; lots: number }> = {};
    for (const item of etat.comptes) {
      compte[item.comptePrincipal] = { mouvements: 0, lots: 0 };
    }
    const noter = (numero: string, champ: "mouvements" | "lots"): void => {
      const principal = comptePrincipalDe(numero);
      const entree = compte[principal] ?? { mouvements: 0, lots: 0 };
      entree[champ] += 1;
      compte[principal] = entree;
    };
    for (const mouvement of etat.mouvements) {
      noter(mouvement.compte, "mouvements");
    }
    for (const lot of etat.lots) {
      for (const ecriture of lot.ecritures) {
        for (const ligne of ecriture.lignes) {
          noter(ligne.compte, "lots");
        }
      }
    }
    return compte;
  }

  /**
   * Combien de fois chaque code de taxe a servi : dans le grand livre, et dans les lots encore en
   * saisie. Un écran en a besoin pour griser ce qui ne peut plus être modifié — un taux qui a servi ne
   * se réécrit pas — plutôt que de laisser l'utilisateur le découvrir par un refus.
   */
  async utilisationDesCodesTaxe(): Promise<Record<string, { mouvements: number; lots: number }>> {
    const etat = await this.#stockage.lire();
    const compte: Record<string, { mouvements: number; lots: number }> = {};
    for (const code of etat.codesTaxe) {
      compte[code.code] = { mouvements: 0, lots: 0 };
    }
    const noter = (codeDemande: string, champ: "mouvements" | "lots"): void => {
      const entree = compte[codeDemande];
      if (entree) {
        entree[champ] += 1;
      } else {
        // Un code absent du paramétrage mais présent dans une écriture : il compte quand même, pour
        // que l'écran dise la vérité sur ce qui est réutilisable.
        compte[codeDemande] = { mouvements: champ === "mouvements" ? 1 : 0, lots: champ === "lots" ? 1 : 0 };
      }
    };
    for (const mouvement of etat.mouvements) {
      for (const code of mouvement.codesTaxe) {
        noter(code, "mouvements");
      }
    }
    for (const lot of etat.lots) {
      for (const ecriture of lot.ecritures) {
        for (const ligne of ecriture.lignes) {
          for (const code of ligne.codesTaxe) {
            noter(code, "lots");
          }
        }
      }
    }
    return compte;
  }

  /** Codes de taxe applicables à une opération, d'après le paramétrage du dossier. */
  async codesTaxePour(contexte: {
    operation: "achat" | "vente";
    tiersImmatricule: boolean;
    tiersPublic: boolean;
    exportation: boolean;
  }): Promise<CodeTaxe[]> {
    const etat = await this.#stockage.lire();
    return codesTaxeApplicables(etat.codesTaxe, contexte);
  }

  /* ---------------------------------------------------------------- */
  /* Lectures                                                          */
  /* ---------------------------------------------------------------- */

  async lire(): Promise<EtatDossier> {
    return this.#stockage.lire();
  }

  async contexte(): Promise<ContexteDossier> {
    const etat = await this.#stockage.lire();
    const periodeCourante = this.#periodeCourante(etat);
    const dernier = etat.audit.at(-1);
    return {
      numero: numeroDeDossier("CG", etat.societe.code, etat.exercice.annee),
      societe: etat.societe,
      referentiel: this.#paquet.referentiel.nom,
      paquetPays: `${this.#paquet.nom} — ${this.#paquet.version}`,
      devise: this.#paquet.devise.code,
      exercice: etat.exercice.annee,
      periodeLabel: `${formaterDateFr(etat.exercice.dateDebut)} - ${formaterDateFr(etat.exercice.dateFin)}`,
      periodeCourante: periodeCourante.numero,
      utilisateur: this.#utilisateur,
      stockage: this.#stockage.mode,
      derniereModification: dernier ? `${dernier.horodate} — ${dernier.action}` : null,
      comptes: etat.comptes.length,
      journaux: etat.journaux.length,
      tiers: etat.tiers.length,
      lots: etat.lots.length,
      lotsComptabilises: etat.lots.filter((lot) => lot.etat === "comptabilise").length,
      mouvements: etat.mouvements.length,
      equilibre: verifierEquilibre(etat.mouvements).equilibre,
      exercicesClos: etat.exercicesClos.length
    };
  }

  async planComptable(recherche = ""): Promise<Compte[]> {
    const etat = await this.#stockage.lire();
    const terme = recherche.trim().toLowerCase();
    if (terme === "") {
      return [...etat.comptes];
    }
    return etat.comptes.filter(
      (compte) =>
        compte.numero.toLowerCase().includes(terme) || compte.libelle.toLowerCase().includes(terme)
    );
  }

  async journaux(): Promise<Journal[]> {
    const etat = await this.#stockage.lire();
    return [...etat.journaux];
  }

  async listeTiers(): Promise<Tiers[]> {
    const etat = await this.#stockage.lire();
    return [...etat.tiers];
  }

  async lots(filtre?: { etat?: Lot["etat"]; journalCode?: string }): Promise<Lot[]> {
    const dossier = await this.#stockage.lire();
    return dossier.lots.filter((lot) => {
      if (filtre?.etat && lot.etat !== filtre.etat) return false;
      if (filtre?.journalCode && lot.journalCode !== filtre.journalCode) return false;
      return true;
    });
  }

  /**
   * Balance de l'exercice courant, sauf filtre contraire.
   *
   * « Toutes périodes » veut dire toutes les périodes **de l'exercice** : après une clôture, les
   * mouvements de l'exercice précédent ne doivent pas se mêler à ceux de l'exercice ouvert.
   */
  async balance(filtre: FiltreMouvements = {}): Promise<LigneBalance[]> {
    const etat = await this.#stockage.lire();
    return construireBalance(etat.mouvements, etat.comptes, { exercice: etat.exercice.annee, ...filtre });
  }

  async journal(filtre: FiltreMouvements = {}): Promise<PieceDeJournal[]> {
    const etat = await this.#stockage.lire();
    return construireJournal(etat.mouvements, { exercice: etat.exercice.annee, ...filtre });
  }

  /**
   * Bilan à une date donnée — par défaut la clôture de l'exercice.
   *
   * `periode` borne l'état à la fin de cette période, en cumul depuis l'ouverture de l'exercice :
   * un bilan intermédiaire n'est pas la balance d'un mois, c'est la situation à la fin du mois.
   */
  async bilan(periode?: number, exercice?: number): Promise<Bilan> {
    const etat = await this.#stockage.lire();
    const cible = this.#exerciceDemande(etat, exercice);
    const borne = periode === undefined ? null : periodeParNumero(cible, periode);
    const filtre: FiltreMouvements = borne
      ? { exercice: cible.annee, du: cible.dateDebut, au: borne.dateFin }
      : { exercice: cible.annee };
    const balance = construireBalance(etat.mouvements, etat.comptes, filtre);
    return construireBilan(balance, this.#paquet.referentiel.groupes, {
      exercice: cible.annee,
      dateCloture: borne ? borne.dateFin : cible.dateFin,
      precedent: this.#exercicePrecedent(etat, cible)
    });
  }

  /** Compte de résultat, en cumul depuis l'ouverture de l'exercice jusqu'à la période demandée. */
  async compteDeResultat(periode?: number, exercice?: number): Promise<CompteDeResultat> {
    const etat = await this.#stockage.lire();
    const cible = this.#exerciceDemande(etat, exercice);
    const borne = periode === undefined ? null : periodeParNumero(cible, periode);
    const filtre: FiltreMouvements = borne
      ? { exercice: cible.annee, du: cible.dateDebut, au: borne.dateFin }
      : { exercice: cible.annee };
    const balance = construireBalance(this.#mouvementsHorsCloture(etat), etat.comptes, filtre);
    return construireCompteDeResultat(balance, {
      exercice: cible.annee,
      dateDebut: cible.dateDebut,
      dateFin: borne ? borne.dateFin : cible.dateFin
    });
  }

  /**
   * Déclaration de TVA d'une période, recalculée depuis le grand livre et les codes de taxe du
   * paquet pays. Par défaut, la période courante.
   */
  async declarationTva(periode?: number): Promise<DeclarationTva> {
    const etat = await this.#stockage.lire();
    const numero = periode ?? this.#periodeCourante(etat).numero;
    return construireDeclarationTva(
      etat.mouvements.filter((mouvement) => mouvement.exercice === etat.exercice.annee),
      etat.comptes,
      this.#paquet,
      etat.exercice,
      numero,
      etat.codesTaxe
    );
  }

  /**
   * Interroge un compte : ce qui s'y est passé, avec le solde après chaque ligne.
   *
   * Le compte peut être demandé segmenté (`401100-FOU01`) : l'interrogation porte alors sur ce
   * segment, ce qui est la question posée quand on appelle un fournisseur. Le solde d'ouverture de la
   * fenêtre tient compte de tout ce qui précède, à-nouveaux compris — un solde progressif qui partirait
   * de zéro ne correspondrait à rien de connu.
   */
  async interrogerCompte(
    compte: string,
    filtre: Omit<DemandeInterrogation, "compte"> = {}
  ): Promise<InterrogationDeCompte> {
    const etat = await this.#stockage.lire();
    const principal = comptePrincipalDe(compte);
    const trouve = etat.comptes.find((item) => item.comptePrincipal === principal);
    if (!trouve) {
      throw new ErreurRegle(`Le compte « ${compte} » n'existe pas dans le plan du dossier.`);
    }
    // Valider l'exercice demandé, même quand le compte n'y a pas bougé : un exercice qui n'existe pas
    // doit être dit, pas rendu comme un compte vide.
    this.#exerciceDemande(etat, filtre.exercice);
    if (filtre.inclureExercicePrecedent) {
      const precedent = (filtre.exercice ?? etat.exercice.annee) - 1;
      const connu = precedent === etat.exercice.annee || etat.exercicesClos.some((clos) => clos.exercice.annee === precedent);
      if (!connu) {
        throw new ErreurRegle(
          `L'exercice ${precedent} n'existe pas dans ce dossier : la comparaison d'exercices s'arrête là. Exercices disponibles : ${[
            ...etat.exercicesClos.map((item) => item.exercice.annee),
            etat.exercice.annee
          ].join(", ")}.`
        );
      }
    }

    const bornes: Record<number, { dateDebut: DateCivile; dateFin: DateCivile }> = {
      [etat.exercice.annee]: { dateDebut: etat.exercice.dateDebut, dateFin: etat.exercice.dateFin }
    };
    for (const clos of etat.exercicesClos) {
      bornes[clos.exercice.annee] = { dateDebut: clos.exercice.dateDebut, dateFin: clos.exercice.dateFin };
    }

    return interrogerCompte(
      etat.mouvements,
      trouve,
      { compte, ...filtre },
      {
        lettrages: etat.lettrages,
        releves: etat.releves,
        pointages: etat.pointages,
        exercicesClos: etat.exercicesClos,
        exerciceCourant: etat.exercice.annee,
        bornes,
        devise: this.#paquet.devise
      }
    );
  }

  /**
   * Les comptes qui ont bougé, avec leur solde et leurs tiers : le point de départ d'une
   * interrogation, pour qui cherche un compte par son activité plutôt que par son numéro.
   */
  async comptesInterrogeables(filtre: FiltreMouvements = {}): Promise<CompteInterrogeable[]> {
    const etat = await this.#stockage.lire();
    return comptesInterrogeables(etat.mouvements, etat.comptes, {
      exercice: etat.exercice.annee,
      ...filtre
    });
  }

  async grandLivre(compte: string, filtre: FiltreMouvements = {}): Promise<LigneGrandLivre[]> {
    const etat = await this.#stockage.lire();
    filtre = { exercice: etat.exercice.annee, ...filtre };
    const resolu = this.#resoudreCompte(etat, compte);
    if (!resolu) {
      throw new ErreurRegle(`Le compte « ${compte} » n'existe pas dans le plan du dossier.`);
    }
    const trouve = etat.comptes.find((item) => item.comptePrincipal === resolu.comptePrincipal);
    if (!trouve) {
      throw new ErreurRegle(`Le compte « ${compte} » n'existe pas dans le plan du dossier.`);
    }
    return construireGrandLivre(trouve, etat.mouvements, filtre);
  }

  async pisteAudit(): Promise<EvenementAudit[]> {
    const etat = await this.#stockage.lire();
    return [...etat.audit];
  }

  /* ---------------------------------------------------------------- */
  /* Écritures                                                         */
  /* ---------------------------------------------------------------- */

  async creerLot(demande: DemandeLot): Promise<Lot> {
    return this.#muter(async (etat) => {
      const journal = etat.journaux.find((item) => item.code === demande.journalCode.toUpperCase());
      if (!journal) {
        throw new ErreurRegle(`Le journal « ${demande.journalCode} » n'existe pas dans le dossier.`);
      }
      if (!journal.actif) {
        throw new ErreurRegle(`Le journal « ${journal.code} » est inactif.`);
      }
      const codeSource = (demande.codeSource ?? "SAISIE").toUpperCase();
      if (!CODES_SOURCE.some((source) => source.code === codeSource)) {
        throw new ErreurRegle(`Code source inconnu : « ${codeSource} ».`);
      }
      periodeDeDate(etat.exercice, demande.date);
      if (!this.#periodeOuverte(etat, demande.date)) {
        throw new ErreurRegle(
          `La période du ${formaterDateFr(demande.date)} est clôturée : aucun lot ne peut y être ouvert.`
        );
      }

      const sequence = (etat.sequencesLots[journal.code] ?? 0) + 1;
      etat.sequencesLots[journal.code] = sequence;
      const lot: Lot = {
        id: `LOT-${etat.exercice.annee}-${journal.code}-${sequence}`,
        numero: `${journal.prefixeLot}${sequence.toString().padStart(4, "0")}`,
        journalCode: journal.code,
        date: demande.date,
        libelle: demande.libelle.trim(),
        codeSource,
        etat: "ouvert",
        ecritures: [],
        comptabiliseLe: null,
        comptabilisePar: null,
        contrePasseLe: null,
        origine: null
      };
      etat.lots.push(lot);
      this.#tracer(etat, "Lot créé", "Lot", lot.id, `${lot.numero} — journal ${lot.journalCode}`);
      return lot;
    });
  }

  async ajouterEcriture(lotIdentifiant: string, demande: DemandeEcriture): Promise<Ecriture> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "ouvert") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} est ${lot.etat} : seule la saisie d'un lot ouvert peut être modifiée.`
        );
      }
      if (!this.#periodeOuverte(etat, demande.date)) {
        throw new ErreurRegle(
          `La période du ${formaterDateFr(demande.date)} est clôturée : aucune écriture n'y est acceptée.`
        );
      }

      const sequence = (etat.sequencesEcritures[lot.journalCode] ?? 0) + 1;
      etat.sequencesEcritures[lot.journalCode] = sequence;
      const ecritureIdentifiant = `${lot.id}-E${sequence}`;
      const lignes = demande.lignes.map((ligne, index) =>
        this.#construireLigne(etat, ecritureIdentifiant, index + 1, ligne)
      );

      const ecriture: Ecriture = {
        id: ecritureIdentifiant,
        numero: `${lot.journalCode}-${sequence.toString().padStart(5, "0")}`,
        piece: demande.piece.trim(),
        date: demande.date,
        libelle: demande.libelle.trim(),
        etat: "brouillon",
        lignes,
        origine: null
      };

      // Contrôle immédiat : l'utilisateur voit l'erreur pendant la saisie, pas à la comptabilisation.
      validerLot(
        { ...lot, ecritures: [...lot.ecritures, ecriture] },
        this.#contexteDeValidation(etat)
      );
      verifierLignesTaxees(ecriture.lignes, etat.codesTaxe);

      lot.ecritures.push(ecriture);
      this.#tracer(etat, "Écriture ajoutée au lot", "Ecriture", ecriture.id, `${lot.numero} / ${ecriture.piece}`);
      return ecriture;
    });
  }

  async marquerPret(lotIdentifiant: string): Promise<Lot> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "ouvert") {
        throw new ErreurRegle(`Le lot ${lot.numero} n'est pas en saisie : état « ${lot.etat} ».`);
      }
      validerLot(lot, this.#contexteDeValidation(etat));
      lot.etat = "pret";
      this.#tracer(etat, "Lot marqué prêt à comptabiliser", "Lot", lot.id, lot.numero);
      return lot;
    });
  }

  async rouvrirLot(lotIdentifiant: string): Promise<Lot> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat === "comptabilise") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} est comptabilisé : on le corrige par contre-passation, jamais en le rouvrant.`
        );
      }
      lot.etat = "ouvert";
      this.#tracer(etat, "Lot remis en saisie", "Lot", lot.id, lot.numero);
      return lot;
    });
  }

  async supprimerLot(lotIdentifiant: string): Promise<void> {
    await this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "ouvert") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} ne peut pas être supprimé : état « ${lot.etat} ». Seule la contre-passation corrige un lot comptabilisé.`
        );
      }
      etat.lots = etat.lots.filter((item) => item.id !== lot.id);
      this.#tracer(etat, "Lot supprimé", "Lot", lot.id, lot.numero);
    });
  }

  /**
   * Modifie l'en-tête d'un lot encore en saisie : date, libellé, code source.
   *
   * Un lot prêt, comptabilisé ou contre-passé ne se modifie pas. La date reste soumise au contrôle
   * de période : on ne déplace pas un lot vers une période clôturée pour échapper au verrou.
   */
  async modifierLot(
    lotIdentifiant: string,
    demande: { date?: DateCivile; libelle?: string; codeSource?: string }
  ): Promise<Lot> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "ouvert") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} est ${lot.etat} : son en-tête ne se modifie plus.` +
            (lot.etat === "comptabilise" ? " Une erreur se corrige par contre-passation." : "")
        );
      }
      if (demande.date !== undefined) {
        periodeDeDate(etat.exercice, demande.date);
        if (!this.#periodeOuverte(etat, demande.date)) {
          throw new ErreurRegle(
            `La période du ${formaterDateFr(demande.date)} est clôturée : le lot ne peut pas y être déplacé.`
          );
        }
        lot.date = demande.date;
      }
      if (demande.libelle !== undefined) {
        const libelle = demande.libelle.trim();
        if (libelle === "") {
          throw new ErreurRegle("Le libellé du lot est obligatoire.");
        }
        lot.libelle = libelle;
      }
      if (demande.codeSource !== undefined) {
        const codeSource = demande.codeSource.toUpperCase();
        if (!CODES_SOURCE.some((source) => source.code === codeSource)) {
          throw new ErreurRegle(`Code source inconnu : « ${demande.codeSource} ».`);
        }
        lot.codeSource = codeSource;
      }
      this.#tracer(etat, "Lot modifié", "Lot", lot.id, lot.numero);
      return lot;
    });
  }

  /**
   * Retire une écriture en brouillon d'un lot encore en saisie.
   *
   * Une écriture comptabilisée ne se retire pas — elle appartient au grand livre. La supprimer
   * d'un lot ouvert n'est pas une correction comptable, c'est une reprise de saisie.
   */
  async supprimerEcriture(lotIdentifiant: string, ecritureIdentifiant: string): Promise<Lot> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "ouvert") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} est ${lot.etat} : aucune écriture ne peut en être retirée.`
        );
      }
      const ecriture = lot.ecritures.find((item) => item.id === ecritureIdentifiant);
      if (!ecriture) {
        throw new ErreurRegle("L'écriture demandée n'existe pas dans ce lot.");
      }
      if (ecriture.etat !== "brouillon") {
        throw new ErreurRegle(
          `L'écriture ${ecriture.piece} est ${ecriture.etat} : elle ne se retire pas du lot.`
        );
      }
      lot.ecritures = lot.ecritures.filter((item) => item.id !== ecritureIdentifiant);
      this.#tracer(
        etat,
        "Écriture retirée du lot",
        "Ecriture",
        ecriture.id,
        `${lot.numero} / ${ecriture.piece}`
      );
      return lot;
    });
  }

  /**
   * Comptabilise un lot : atomique. Toutes les écritures sont vérifiées, puis les mouvements sont
   * ajoutés au grand livre et le lot passe à l'état comptabilisé. Un échec laisse le dossier
   * exactement comme avant.
   */
  async comptabiliserLot(lotIdentifiant: string): Promise<{ lot: Lot; mouvements: Mouvement[] }> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat === "comptabilise") {
        throw new ErreurRegle(`Le lot ${lot.numero} est déjà comptabilisé.`);
      }
      if (lot.etat !== "pret") {
        throw new ErreurRegle(
          `Le lot ${lot.numero} doit être marqué « prêt à comptabiliser » avant d'être comptabilisé.`
        );
      }
      const contexte = this.#contexteDeValidation(etat);
      validerLot(lot, contexte);
      for (const ecriture of lot.ecritures) {
        verifierLignesTaxees(ecriture.lignes, etat.codesTaxe);
      }

      const horodate = this.#horloge().toISOString();
      const nouveaux: Mouvement[] = [];
      for (const ecriture of lot.ecritures) {
        const periode = periodeDeDate(etat.exercice, ecriture.date);
        for (const ligne of ecriture.lignes) {
          const resolu = contexte.compteParNumero(ligne.compte.trim().toUpperCase());
          if (!resolu) {
            throw new ErreurRegle(`Le compte « ${ligne.compte} » n'existe pas dans le plan du dossier.`);
          }
          nouveaux.push({
            lotId: lot.id,
            lotNumero: lot.numero,
            journalCode: lot.journalCode,
            ecritureId: ecriture.id,
            ecritureNumero: ecriture.numero,
            ligneId: ligne.id,
            piece: ecriture.piece,
            date: ecriture.date,
            exercice: etat.exercice.annee,
            periode: periode.numero,
            compte: resolu.numero,
            tiersCode: ligne.tiersCode ?? resolu.auxiliaire,
            libelle: ligne.libelle,
            debit: ligne.debit,
            credit: ligne.credit,
            codesTaxe: ligne.codesTaxe,
            comptabiliseLe: horodate
          });
        }
        ecriture.etat = "comptabilisee";
      }

      etat.mouvements.push(...nouveaux);
      lot.etat = "comptabilise";
      lot.comptabiliseLe = horodate;
      lot.comptabilisePar = this.#utilisateur;

      const equilibre = verifierEquilibre(nouveaux);
      this.#tracer(
        etat,
        "Lot comptabilisé",
        "Lot",
        lot.id,
        `${lot.numero} — ${nouveaux.length} mouvements, débit ${formatMontant(equilibre.totalDebit, this.#paquet.devise)}`
      );
      return { lot, mouvements: nouveaux };
    });
  }

  /**
   * Contre-passe un lot comptabilisé : crée un lot neuf, daté du jour, qui en inverse chaque
   * ligne. Le lot d'origine reste intact — l'historique est opposable.
   */
  async contrePasserLot(lotIdentifiant: string, date?: DateCivile): Promise<Lot> {
    return this.#muter(async (etat) => {
      const lot = this.#trouverLot(etat, lotIdentifiant);
      if (lot.etat !== "comptabilise") {
        throw new ErreurRegle(`Seul un lot comptabilisé se contre-passe : ${lot.numero} est « ${lot.etat} ».`);
      }
      const dateOperation = date ?? this.#horloge().toISOString().slice(0, 10);
      if (!this.#periodeOuverte(etat, dateOperation)) {
        throw new ErreurRegle(
          `La période du ${formaterDateFr(dateOperation)} est clôturée : la contre-passation est refusée.`
        );
      }

      const journal = etat.journaux.find((item) => item.code === lot.journalCode);
      if (!journal) {
        throw new ErreurRegle(`Le journal « ${lot.journalCode} » du lot ${lot.numero} n'existe plus.`);
      }
      const sequence = (etat.sequencesLots[lot.journalCode] ?? 0) + 1;
      etat.sequencesLots[lot.journalCode] = sequence;
      const nouveau: Lot = {
        id: `LOT-${etat.exercice.annee}-${lot.journalCode}-${sequence}-CP`,
        numero: `${journal.prefixeLot}${sequence.toString().padStart(4, "0")}`,
        journalCode: lot.journalCode,
        date: dateOperation,
        libelle: `Contre-passation du lot ${lot.numero}`,
        codeSource: "CONTREPASSATION",
        etat: "ouvert",
        ecritures: [],
        comptabiliseLe: null,
        comptabilisePar: null,
        contrePasseLe: null,
        origine: lot.id
      };
      lot.ecritures.forEach((ecriture, index) => {
        const sequenceEcriture = (etat.sequencesEcritures[lot.journalCode] ?? 0) + index + 1;
        etat.sequencesEcritures[lot.journalCode] = sequenceEcriture;
        nouveau.ecritures.push(
          inverserEcriture(ecriture, {
            id: `${nouveau.id}-E${index + 1}`,
            numero: `${lot.journalCode}-${sequenceEcriture.toString().padStart(5, "0")}`,
            date: dateOperation,
            piece: `CP-${ecriture.piece}`
          })
        );
        ecriture.etat = "contre-passee";
      });
      lot.etat = "contre-passe";
      lot.contrePasseLe = this.#horloge().toISOString();

      etat.lots.push(nouveau);
      this.#tracer(etat, "Lot contre-passé", "Lot", lot.id, `${lot.numero} → ${nouveau.numero}`);
      return nouveau;
    });
  }

  async ajouterTiers(demande: Omit<Tiers, "actif"> & { actif?: boolean }): Promise<Tiers> {
    return this.#muter(async (etat) => {
      const tiers = normaliserTiers({ ...demande, actif: demande.actif ?? true });
      if (etat.tiers.some((item) => item.code === tiers.code)) {
        throw new ErreurRegle(`Le tiers « ${tiers.code} » existe déjà.`);
      }
      etat.tiers.push(tiers);
      this.#tracer(etat, "Tiers créé", "Tiers", tiers.code, `${tiers.nom} (${tiers.type})`);
      return tiers;
    });
  }

  async ajouterCompte(demande: CompteDuPlan): Promise<Compte> {
    return this.#muter(async (etat) => {
      const compte = compteDepuisPlan(demande, this.#paquet.referentiel.structure);
      if (etat.comptes.some((item) => item.comptePrincipal === compte.comptePrincipal)) {
        throw new ErreurRegle(`Le compte « ${compte.comptePrincipal} » existe déjà dans le plan.`);
      }
      if (!this.#paquet.referentiel.groupes.some((groupe) => groupe.code === compte.groupe)) {
        throw new ErreurRegle(
          `Le groupe de comptes « ${compte.groupe} » n'existe pas dans le référentiel ${this.#paquet.referentiel.code}.`
        );
      }
      etat.comptes.push(compte);
      etat.comptes.sort((gauche, droite) => gauche.comptePrincipal.localeCompare(droite.comptePrincipal));
      this.#tracer(etat, "Compte ajouté au plan", "Compte", compte.comptePrincipal, compte.libelle);
      return compte;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Paramétrage du dossier : société, plan de comptes, taux            */
  /* ---------------------------------------------------------------- */

  /**
   * Modifie la société du dossier.
   *
   * Chaque champ modifié est tracé avec sa valeur d'avant : la société apparaît sur tous les états
   * exportés, et un changement de raison sociale ou d'identifiant fiscal se retrouve.
   */
  async modifierSociete(demande: Partial<Societe>): Promise<Societe> {
    return this.#muter((etat) => {
      const avant = etat.societe;
      const apres: Societe = { ...avant };
      const changements: string[] = [];

      if (demande.code !== undefined) {
        const code = demande.code.trim().toUpperCase();
        if (!/^[A-Z0-9]{1,5}$/.test(code)) {
          throw new ErreurRegle(
            `Code société invalide : « ${demande.code} ». 5 caractères maximum, lettres et chiffres — il entre dans le numéro de dossier.`
          );
        }
        apres.code = code;
      }
      if (demande.raisonSociale !== undefined) {
        const raison = demande.raisonSociale.trim();
        if (raison === "") {
          throw new ErreurRegle("La raison sociale est obligatoire : elle porte tous les états exportés.");
        }
        if (raison.length > 120) {
          throw new ErreurRegle("La raison sociale dépasse 120 caractères.");
        }
        apres.raisonSociale = raison;
      }
      if (demande.identifiantFiscal !== undefined) {
        apres.identifiantFiscal = this.#validerIdentifiantFiscal(demande.identifiantFiscal);
      }
      if (demande.formeJuridique !== undefined) {
        const forme = demande.formeJuridique.trim().toUpperCase();
        if (!this.#paquet.formesJuridiques.some((item) => item.code === forme)) {
          throw new ErreurRegle(
            `La forme juridique « ${demande.formeJuridique} » n'est pas prévue par le paquet ${this.#paquet.nom}. Formes admises : ${this.#paquet.formesJuridiques
              .map((item) => item.code)
              .join(", ")}.`
          );
        }
        apres.formeJuridique = forme;
      }
      if (demande.courriel !== undefined) {
        const courriel = demande.courriel.trim().toLowerCase();
        if (courriel !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courriel)) {
          throw new ErreurRegle(`Le courriel « ${demande.courriel} » n'a pas un format valide.`);
        }
        apres.courriel = courriel;
      }
      if (demande.pays !== undefined) {
        const pays = demande.pays.trim();
        if (pays === "") {
          throw new ErreurRegle("Le pays est obligatoire : il détermine le paquet fiscal applicable.");
        }
        apres.pays = pays;
      }
      for (const champ of ["adresse", "ville", "telephone", "regimeFiscal"] as const) {
        if (demande[champ] !== undefined) {
          apres[champ] = demande[champ]!.trim();
        }
      }

      for (const champ of Object.keys(apres) as (keyof Societe)[]) {
        if (avant[champ] !== apres[champ]) {
          changements.push(`${champ} : « ${avant[champ]} » → « ${apres[champ]} »`);
        }
      }
      if (changements.length === 0) {
        return avant;
      }

      etat.societe = apres;
      this.#tracer(etat, "Société modifiée", "Societe", apres.code, changements.join(" · "));
      return apres;
    });
  }

  /**
   * Modifie un compte du plan.
   *
   * Deux refus protègent les états déjà produits : un compte **mouvementé** ne change ni de groupe
   * (le groupe décide de la ligne du bilan où il apparaît) ni de solde initial (les à-nouveaux
   * passent par un lot, pas par le plan).
   */
  async modifierCompte(
    numero: string,
    demande: {
      libelle?: string;
      groupe?: string;
      actif?: boolean;
      autoriseSaisie?: boolean;
      exigeTiers?: boolean;
      soldeInitial?: string | Montant;
    }
  ): Promise<Compte> {
    return this.#muter((etat) => {
      const principal = comptePrincipalDe(numero);
      const compte = etat.comptes.find((item) => item.comptePrincipal === principal);
      if (!compte) {
        throw new ErreurRegle(`Le compte « ${principal} » n'existe pas dans le plan du dossier.`);
      }
      const mouvemente = etat.mouvements.some((mouvement) => comptePrincipalDe(mouvement.compte) === principal);
      const changements: string[] = [];

      if (demande.libelle !== undefined) {
        const libelle = demande.libelle.trim();
        if (libelle === "") {
          throw new ErreurRegle("Le libellé du compte est obligatoire.");
        }
        if (libelle.length > 120) {
          throw new ErreurRegle("Le libellé du compte dépasse 120 caractères.");
        }
        if (libelle !== compte.libelle) {
          changements.push(`libellé : « ${compte.libelle} » → « ${libelle} »`);
          compte.libelle = libelle;
        }
      }
      if (demande.groupe !== undefined && demande.groupe !== compte.groupe) {
        if (mouvemente) {
          throw new ErreurRegle(
            `Le compte ${principal} est mouvementé : il ne change pas de groupe. Le groupe décide de la ligne du bilan où le compte apparaît — le déplacer réécrirait des états déjà produits. Créez un autre compte, ou corrigez par une écriture.`
          );
        }
        if (!this.#paquet.referentiel.groupes.some((groupe) => groupe.code === demande.groupe)) {
          throw new ErreurRegle(
            `Le groupe de comptes « ${demande.groupe} » n'existe pas dans le référentiel ${this.#paquet.referentiel.code}.`
          );
        }
        changements.push(`groupe : ${compte.groupe} → ${demande.groupe}`);
        compte.groupe = demande.groupe;
      }
      if (demande.soldeInitial !== undefined) {
        const solde =
          typeof demande.soldeInitial === "bigint"
            ? demande.soldeInitial
            : analyserMontant(demande.soldeInitial, this.#paquet.devise);
        if (mouvemente) {
          throw new ErreurRegle(
            `Le compte ${principal} est mouvementé : son solde initial ne se modifie plus. Les à-nouveaux se saisissent par un lot, pour que le grand livre en garde la trace.`
          );
        }
        if (solde !== compte.soldeInitial) {
          changements.push(
            `solde initial : ${formatMontant(compte.soldeInitial, this.#paquet.devise)} → ${formatMontant(
              solde,
              this.#paquet.devise
            )}`
          );
          compte.soldeInitial = solde;
        }
      }
      for (const drapeau of ["actif", "autoriseSaisie", "exigeTiers"] as const) {
        if (demande[drapeau] !== undefined && demande[drapeau] !== compte[drapeau]) {
          changements.push(`${drapeau} : ${compte[drapeau] ? "oui" : "non"} → ${demande[drapeau] ? "oui" : "non"}`);
          compte[drapeau] = demande[drapeau]!;
        }
      }

      if (changements.length === 0) {
        return compte;
      }
      this.#tracer(etat, "Compte modifié", "Compte", compte.comptePrincipal, changements.join(" · "));
      return compte;
    });
  }

  /**
   * Supprime un compte du plan.
   *
   * Refusé dès que quelque chose tient à ce compte, et **toutes** les raisons sont données d'un coup :
   * un utilisateur qui retire un compte pour en découvrir une deuxième raison au prochain essai perd
   * du temps sans rien apprendre.
   */
  async supprimerCompte(numero: string): Promise<void> {
    await this.#muter((etat) => {
      const principal = comptePrincipalDe(numero);
      const compte = etat.comptes.find((item) => item.comptePrincipal === principal);
      if (!compte) {
        throw new ErreurRegle(`Le compte « ${principal} » n'existe pas dans le plan du dossier.`);
      }

      const raisons: string[] = [];
      if (etat.mouvements.some((mouvement) => comptePrincipalDe(mouvement.compte) === principal)) {
        raisons.push("il porte des mouvements : un compte mouvementé ne se supprime pas, il se désactive");
      }
      if (
        etat.lots.some((lot) =>
          lot.ecritures.some((ecriture) =>
            ecriture.lignes.some((ligne) => comptePrincipalDe(ligne.compte) === principal)
          )
        )
      ) {
        raisons.push("il figure dans un lot : retirez-le de ces écritures d'abord");
      }
      const taxes = etat.codesTaxe.filter((code) => code.compteTaxe === principal).map((code) => code.code);
      if (taxes.length > 0) {
        raisons.push(`il enregistre la taxe ${taxes.join(", ")} : changez le compte de taxe avant`);
      }
      const journaux = etat.journaux
        .filter((journal) => comptePrincipalDe(journal.compteContrepartie ?? "") === principal)
        .map((journal) => journal.code);
      if (journaux.length > 0) {
        raisons.push(`il est la contrepartie du journal ${journaux.join(", ")} : modifiez ce journal avant`);
      }
      if (principal === COMPTE_RESULTAT_EXERCICE) {
        raisons.push("il porte le résultat de l'exercice : la clôture d'exercice en a besoin");
      }
      if (raisons.length > 0) {
        throw new ErreurRegle(
          `Le compte ${principal} ne peut pas être supprimé : ${raisons.join(" ; ")}.`
        );
      }

      etat.comptes = etat.comptes.filter((item) => item.comptePrincipal !== principal);
      this.#tracer(etat, "Compte supprimé du plan", "Compte", principal, compte.libelle);
    });
  }

  /** Codes de taxe déjà utilisés par un mouvement ou par une ligne de lot. */
  #codesTaxeUtilises(etat: EtatDossier): Set<string> {
    const utilises = new Set<string>();
    for (const mouvement of etat.mouvements) {
      for (const code of mouvement.codesTaxe) {
        utilises.add(code);
      }
    }
    for (const lot of etat.lots) {
      for (const ecriture of lot.ecritures) {
        for (const ligne of ecriture.lignes) {
          for (const code of ligne.codesTaxe) {
            utilises.add(code);
          }
        }
      }
    }
    return utilises;
  }

  #validerIdentifiantFiscal(valeur: string): string {
    const propre = valeur.replace(/[\s-]/gu, "").toUpperCase();
    if (propre === "") {
      throw new ErreurRegle(
        `L'${this.#paquet.regleIdentifiantFiscal.nom} est obligatoire : sans lui, aucune déclaration n'est déposée.`
      );
    }
    if (!this.#paquet.regleIdentifiantFiscal.motif.test(propre)) {
      throw new ErreurRegle(this.#paquet.regleIdentifiantFiscal.messageErreur);
    }
    return propre;
  }

  #validerCodeTaxe(etat: EtatDossier, code: CodeTaxe): void {
    if (!/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(code.code)) {
      throw new ErreurRegle(
        `Code de taxe invalide : « ${code.code} ». 16 caractères maximum, lettres, chiffres et tirets.`
      );
    }
    if (code.libelle.trim() === "") {
      throw new ErreurRegle("Le libellé du code de taxe est obligatoire.");
    }
    if (code.referenceLegale.trim() === "") {
      throw new ErreurRegle(
        "La référence légale est obligatoire : un taux sans article n'est pas défendable devant l'administration."
      );
    }
    if (code.pointsDeBase < ZERO) {
      throw new ErreurRegle(`Le taux ${formaterTaux(code.pointsDeBase)} est négatif : un taux de taxe ne l'est pas.`);
    }
    if (code.pointsDeBase > 10000n) {
      throw new ErreurRegle(
        `Le taux ${formaterTaux(code.pointsDeBase)} dépasse 100 % : vérifiez la saisie — le taux s'exprime en points de base (18 % = 1800).`
      );
    }
    const compte = comptePrincipalDe(code.compteTaxe);
    if (!etat.comptes.some((item) => item.comptePrincipal === compte)) {
      throw new ErreurRegle(
        `Le compte de taxe « ${code.compteTaxe} » n'existe pas dans le plan du dossier : la taxe n'aurait nulle part où s'enregistrer.`
      );
    }
  }

  /** Ajoute un code de taxe au paramétrage du dossier. */
  async ajouterCodeTaxe(demande: Omit<CodeTaxe, "aVerifier"> & { aVerifier?: boolean }): Promise<CodeTaxe> {
    return this.#muter((etat) => {
      const code: CodeTaxe = {
        ...demande,
        code: demande.code.trim().toUpperCase(),
        libelle: demande.libelle.trim(),
        referenceLegale: demande.referenceLegale.trim(),
        compteTaxe: comptePrincipalDe(demande.compteTaxe),
        aVerifier: demande.aVerifier ?? false
      };
      if (etat.codesTaxe.some((item) => item.code === code.code)) {
        throw new ErreurRegle(`Le code de taxe « ${code.code} » existe déjà dans le paramétrage du dossier.`);
      }
      this.#validerCodeTaxe(etat, code);
      etat.codesTaxe.push(code);
      this.#tracer(
        etat,
        "Code de taxe ajouté",
        "CodeTaxe",
        code.code,
        `${code.libelle} — ${formaterTaux(code.pointsDeBase)}, ${code.sens}, compte ${code.compteTaxe}, ${code.referenceLegale}`
      );
      return code;
    });
  }

  /**
   * Modifie un code de taxe du dossier.
   *
   * Ce qui touche au **montant** de la taxe — le taux, la base, le sens, le compte de taxe — est
   * refusé dès que le code a servi : les écritures déjà comptabilisées ont été calculées avec
   * l'ancienne valeur, et la déclaration TVA se recalcule à partir des codes en vigueur. Un
   * changement de taux passe par un **nouveau code**, ce que fait la réalité : la TVA est passée de
   * 18 % à un autre taux par un texte, pas en réécrivant le taux précédent.
   */
  async modifierCodeTaxe(
    codeDemande: string,
    demande: Partial<Omit<CodeTaxe, "code">>
  ): Promise<CodeTaxe> {
    return this.#muter((etat) => {
      const code = etat.codesTaxe.find((item) => item.code === codeDemande.trim().toUpperCase());
      if (!code) {
        throw new ErreurRegle(`Le code de taxe « ${codeDemande} » n'existe pas dans le paramétrage du dossier.`);
      }
      const utilise = this.#codesTaxeUtilises(etat).has(code.code);
      const changements: string[] = [];
      const toucheAuMontant =
        demande.pointsDeBase !== undefined ||
        demande.base !== undefined ||
        demande.sens !== undefined ||
        demande.compteTaxe !== undefined;

      if (toucheAuMontant && utilise) {
        throw new ErreurRegle(
          `Le code ${code.code} a déjà servi dans des écritures : son taux, sa base, son sens et son compte de taxe ne se modifient pas, sinon les écritures comptabilisées et les déclarations déjà calculées ne correspondraient plus à rien. Créez un nouveau code (${code.code}-${
            code.exigibleSur === "vente" ? "V" : "A"
          }2) pour la nouvelle valeur, et laissez celui-ci à l'historique.`
        );
      }

      if (demande.libelle !== undefined) {
        const libelle = demande.libelle.trim();
        if (libelle === "") {
          throw new ErreurRegle("Le libellé du code de taxe est obligatoire.");
        }
        changements.push(`libellé : « ${code.libelle} » → « ${libelle} »`);
        code.libelle = libelle;
      }
      if (demande.referenceLegale !== undefined) {
        const reference = demande.referenceLegale.trim();
        if (reference === "") {
          throw new ErreurRegle(
            "La référence légale est obligatoire : un taux sans article n'est pas défendable devant l'administration."
          );
        }
        changements.push(`référence : « ${code.referenceLegale} » → « ${reference} »`);
        code.referenceLegale = reference;
      }
      if (demande.pointsDeBase !== undefined) {
        changements.push(`taux : ${formaterTaux(code.pointsDeBase)} → ${formaterTaux(demande.pointsDeBase)}`);
        code.pointsDeBase = demande.pointsDeBase;
        // Le paramètre n'est plus « à confirmer » : c'est l'utilisateur qui l'a fixé, et la piste
        // d'audit dit qui et quand.
        if (code.aVerifier) {
          changements.push("statut : à confirmer → fixé par l'utilisateur");
          code.aVerifier = false;
        }
      }
      if (demande.base !== undefined) {
        changements.push(`base : ${code.base} → ${demande.base}`);
        code.base = demande.base;
      }
      if (demande.sens !== undefined) {
        changements.push(`sens : ${code.sens} → ${demande.sens}`);
        code.sens = demande.sens;
      }
      if (demande.exigibleSur !== undefined) {
        changements.push(`opération : ${code.exigibleSur} → ${demande.exigibleSur}`);
        code.exigibleSur = demande.exigibleSur;
      }
      if (demande.condition !== undefined) {
        changements.push(`condition : ${code.condition} → ${demande.condition}`);
        code.condition = demande.condition;
      }
      if (demande.compteTaxe !== undefined) {
        const compte = comptePrincipalDe(demande.compteTaxe);
        changements.push(`compte de taxe : ${code.compteTaxe} → ${compte}`);
        code.compteTaxe = compte;
      }
      if (demande.aVerifier !== undefined && demande.aVerifier !== code.aVerifier) {
        changements.push(`statut : ${code.aVerifier ? "à confirmer" : "établi"} → ${demande.aVerifier ? "à confirmer" : "établi"}`);
        code.aVerifier = demande.aVerifier;
      }

      this.#validerCodeTaxe(etat, code);
      if (changements.length === 0) {
        return code;
      }
      this.#tracer(etat, "Code de taxe modifié", "CodeTaxe", code.code, changements.join(" · "));
      return code;
    });
  }

  /** Supprime un code de taxe. Refusé dès qu'il a servi : une écriture porte son code. */
  async supprimerCodeTaxe(codeDemande: string): Promise<void> {
    await this.#muter((etat) => {
      const code = etat.codesTaxe.find((item) => item.code === codeDemande.trim().toUpperCase());
      if (!code) {
        throw new ErreurRegle(`Le code de taxe « ${codeDemande} » n'existe pas dans le paramétrage du dossier.`);
      }
      if (this.#codesTaxeUtilises(etat).has(code.code)) {
        throw new ErreurRegle(
          `Le code ${code.code} figure dans des écritures : il ne se supprime pas. Un code qui ne doit plus servir se désactive en lui retirant sa condition d'application, ou se laisse à l'historique.`
        );
      }
      etat.codesTaxe = etat.codesTaxe.filter((item) => item.code !== code.code);
      this.#tracer(
        etat,
        "Code de taxe supprimé",
        "CodeTaxe",
        code.code,
        `${code.libelle} — ${formaterTaux(code.pointsDeBase)}`
      );
    });
  }

  /**
   * Reprend les taux du paquet pays, sans rien réécrire de ce qui a déjà servi.
   *
   * Utile après une mise à jour du paquet, ou pour revenir en arrière. Les codes déjà utilisés par
   * des écritures gardent la valeur du dossier — sinon les déclarations déjà calculées ne
   * correspondraient plus aux écritures. Les codes créés par l'utilisateur sont conservés.
   */
  async reprendreCodesTaxeDuPaquet(): Promise<{
    repris: string[];
    conserves: string[];
    ajoutes: string[];
    personnalises: string[];
  }> {
    return this.#muter((etat) => {
      const utilises = this.#codesTaxeUtilises(etat);
      const repris: string[] = [];
      const conserves: string[] = [];
      const ajoutes: string[] = [];

      for (const reference of this.#paquet.codesTaxe) {
        const existant = etat.codesTaxe.find((item) => item.code === reference.code);
        if (!existant) {
          etat.codesTaxe.push({ ...reference });
          ajoutes.push(reference.code);
          continue;
        }
        if (utilises.has(existant.code)) {
          if (existant.pointsDeBase !== reference.pointsDeBase) {
            conserves.push(existant.code);
          }
          continue;
        }
        if (
          existant.pointsDeBase !== reference.pointsDeBase ||
          existant.base !== reference.base ||
          existant.sens !== reference.sens ||
          existant.compteTaxe !== reference.compteTaxe ||
          existant.condition !== reference.condition ||
          existant.libelle !== reference.libelle ||
          existant.referenceLegale !== reference.referenceLegale ||
          existant.aVerifier !== reference.aVerifier
        ) {
          etat.codesTaxe = etat.codesTaxe.map((item) => (item.code === reference.code ? { ...reference } : item));
          repris.push(reference.code);
        }
      }

      const codesDuPaquet = new Set(this.#paquet.codesTaxe.map((item) => item.code));
      const personnalises = etat.codesTaxe.filter((item) => !codesDuPaquet.has(item.code)).map((item) => item.code);

      if (repris.length > 0 || ajoutes.length > 0) {
        this.#tracer(
          etat,
          "Taux repris du paquet pays",
          "CodeTaxe",
          this.#paquet.code,
          `${this.#paquet.nom} ${this.#paquet.version} — repris : ${
            repris.length > 0 ? repris.join(", ") : "aucun"
          } · ajoutés : ${ajoutes.length > 0 ? ajoutes.join(", ") : "aucun"} · conservés (déjà utilisés) : ${
            conserves.length > 0 ? conserves.join(", ") : "aucun"
          }`
        );
      }
      return { repris, conserves, ajoutes, personnalises };
    });
  }

  async cloturerPeriode(numero: number): Promise<Exercice> {
    return this.#muter(async (etat) => {
      etat.exercice = cloturerPeriode(etat.exercice, numero);
      this.#tracer(etat, "Période clôturée", "Periode", `${etat.exercice.annee}-${numero}`, `Période ${numero}`);
      return etat.exercice;
    });
  }

  async ouvrirPeriode(numero: number): Promise<Exercice> {
    return this.#muter(async (etat) => {
      etat.exercice = ouvrirPeriode(etat.exercice, numero);
      this.#tracer(etat, "Période rouverte", "Periode", `${etat.exercice.annee}-${numero}`, `Période ${numero}`);
      return etat.exercice;
    });
  }

  /* ---------------------------------------------------------------- */
  /* Lettrage des comptes de tiers                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Marques de lettrage d'un compte — en vigueur et défaites.
   *
   * Les marques défaites sont rendues elles aussi : un délettrage n'efface pas qu'une facture a été
   * rapprochée d'un règlement un jour, et pourquoi ça n'a pas tenu.
   */
  async lettrages(compte?: string): Promise<Lettrage[]> {
    const etat = await this.#stockage.lire();
    if (compte === undefined) {
      return [...etat.lettrages];
    }
    const principal = comptePrincipalDe(compte);
    return etat.lettrages.filter((lettrage) => comptePrincipalDe(lettrage.compte) === principal);
  }

  /**
   * Situation du lettrage, compte de tiers par compte de tiers.
   *
   * Deux soldes distincts : le solde comptable (ce qui est dû) et le solde non lettré (ce qui est dû
   * sans qu'aucun règlement ne l'explique). Le second est celui qu'un trésorier regarde.
   */
  async situationDuLettrage(
    options: { du?: DateCivile; au?: DateCivile } = {}
  ): Promise<SituationDeLettrage[]> {
    const etat = await this.#stockage.lire();
    return situationsDeLettrage(etat.mouvements, etat.lettrages, options);
  }

  /** Lignes d'un compte de tiers qui ne sont encore rapprochées d'aucune autre. */
  async lignesALettrer(critere: CritereDeLettrage): Promise<Mouvement[]> {
    const etat = await this.#stockage.lire();
    this.#verifierCompteDeTiers(etat, critere.compte);
    return mouvementsALettrer(etat.mouvements, etat.lettrages, critere);
  }

  /**
   * Ce que le lettrage automatique proposerait, sans rien écrire.
   *
   * La proposition précède toujours l'écriture : un lettrage automatique qu'on ne peut pas regarder
   * avant de l'appliquer n'est pas vérifiable.
   */
  async proposerLettrageAutomatique(critere: CritereDeLettrage): Promise<PropositionLettrage[]> {
    const etat = await this.#stockage.lire();
    this.#verifierCompteDeTiers(etat, critere.compte);
    return proposerLettrageAutomatique(etat.mouvements, etat.lettrages, critere);
  }

  /** Lettre un groupe de lignes choisi ligne à ligne. */
  async lettrer(demande: {
    compte: string;
    lignes: string[];
    date?: DateCivile;
  }): Promise<Lettrage> {
    return this.#muter((etat) => {
      this.#verifierCompteDeTiers(etat, demande.compte);
      const groupe = this.#resoudreLignes(etat, demande.lignes);
      return this.#lettrerDans(etat, groupe, demande.date);
    });
  }

  /**
   * Lettre automatiquement un compte de tiers : toutes les propositions sont appliquées d'un coup.
   *
   * Chaque marque créée reste visible séparément et peut être défaite.
   */
  async lettrerAutomatiquement(critere: CritereDeLettrage): Promise<Lettrage[]> {
    return this.#muter((etat) => {
      this.#verifierCompteDeTiers(etat, critere.compte);
      const propositions = proposerLettrageAutomatique(etat.mouvements, etat.lettrages, critere);
      const crees: Lettrage[] = [];
      for (const proposition of propositions) {
        const groupe = this.#resoudreLignes(etat, proposition.lignes);
        crees.push(this.#lettrerDans(etat, groupe, critere.au));
      }
      if (crees.length > 0) {
        this.#tracer(
          etat,
          "Lettrage automatique",
          "Compte",
          comptePrincipalDe(critere.compte),
          `${crees.length} marque${crees.length > 1 ? "s" : ""} créée${crees.length > 1 ? "s" : ""} : ${crees
            .map((lettrage) => lettrage.code)
            .join(", ")}`
        );
      }
      return crees;
    });
  }

  /** Délettre une marque : les lignes redeviennent à lettrer, la marque reste lisible. */
  async delettrer(code: string): Promise<Lettrage> {
    return this.#muter((etat) => {
      const lettrage = etat.lettrages.find((item) => item.code === code);
      if (!lettrage) {
        throw new ErreurRegle(`Le lettrage « ${code} » n'existe pas dans ce dossier.`);
      }
      if (lettrage.defaitLe !== null) {
        throw new ErreurRegle(`Le lettrage « ${code} » est déjà défait.`);
      }
      lettrage.defaitLe = this.#horloge().toISOString();
      this.#tracer(
        etat,
        "Lettrage défait",
        "Lettrage",
        lettrage.code,
        `${lettrage.compte}${lettrage.tiersCode ? ` · ${lettrage.tiersCode}` : ""} — ${
          lettrage.lignes.length
        } lignes, ${formatMontant(lettrage.montant, this.#paquet.devise)}`
      );
      return lettrage;
    });
  }

  // ------------------------------------------------------------------ rapprochement bancaire

  /** Les relevés bancaires du dossier, du plus récent au plus ancien. */
  async releves(): Promise<ReleveBancaire[]> {
    const etat = await this.#stockage.lire();
    return [...etat.releves].reverse();
  }

  /** Saisit un relevé bancaire. Aucune écriture n'est passée : un relevé décrit, il ne comptabilise pas. */
  async ajouterReleve(demande: DemandeDeReleve): Promise<ReleveBancaire> {
    return this.#muter((etat) => {
      const compte = etat.comptes.find((item) => item.numero === comptePrincipalDe(demande.compte));
      if (!compte) {
        throw new ErreurRegle(`Le compte « ${comptePrincipalDe(demande.compte)} » n'existe pas dans le plan du dossier.`);
      }
      const codeJournal = (demande.journalCode ?? "BQ").toUpperCase();
      if (!etat.journaux.some((item) => item.code === codeJournal)) {
        throw new ErreurRegle(`Le journal « ${codeJournal} » n'existe pas dans le dossier.`);
      }
      etat.sequencesReleves += 1;
      const releve = construireReleve(demande, {
        identifiant: `RELEVE-${compte.numero}-${etat.sequencesReleves}`,
        horodate: this.#horloge().toISOString(),
        acteur: this.#utilisateur,
        devise: this.#paquet.devise
      });
      etat.releves.push(releve);
      this.#tracer(
        etat,
        "Relevé saisi",
        "Relevé",
        releve.id,
        `${releve.libelle} — compte ${releve.compte}, ${releve.lignes.length} lignes, du ${formaterDateFr(
          releve.dateDebut
        )} au ${formaterDateFr(releve.dateFin)}`
      );
      return releve;
    });
  }

  /** Supprime un relevé. Refusé tant qu'un pointage le rattache au grand livre. */
  async supprimerReleve(releveId: string): Promise<void> {
    await this.#muter((etat) => {
      const releve = etat.releves.find((item) => item.id === releveId);
      if (!releve) {
        throw new ErreurRegle(`Le relevé « ${releveId} » n'existe pas dans le dossier.`);
      }
      const enVigueur = etat.pointages.filter(
        (pointage) => pointage.releveId === releveId && pointage.defaitLe === null
      );
      if (enVigueur.length > 0) {
        throw new ErreurRegle(
          `Le relevé « ${releve.libelle} » porte ${enVigueur.length} pointage${
            enVigueur.length > 1 ? "s" : ""
          } : dépointez avant de supprimer.`
        );
      }
      etat.releves = etat.releves.filter((item) => item.id !== releveId);
      etat.pointages = etat.pointages.filter((pointage) => pointage.releveId !== releveId);
      this.#tracer(etat, "Relevé supprimé", "Relevé", releveId, releve.libelle);
    });
  }

  /**
   * L'état de rapprochement d'un relevé.
   *
   * `conforme` dit que l'écart entre le solde comptable et le solde du relevé est entièrement composé
   * de suspens identifiés. Ce qui ne s'explique pas est montré, jamais absorbé.
   */
  async etatDeRapprochement(releveId: string): Promise<EtatDeRapprochement> {
    const etat = await this.#stockage.lire();
    const releve = etat.releves.find((item) => item.id === releveId);
    if (!releve) {
      throw new ErreurRegle(`Le relevé « ${releveId} » n'existe pas dans le dossier.`);
    }
    return construireEtatDeRapprochement(etat.mouvements, releve, etat.pointages, this.#paquet.devise);
  }

  /** Ce que le rapprochement proposerait de pointer : par référence d'abord, par montant exact ensuite. */
  async proposerPointage(releveId: string, options?: { horsPeriode?: boolean }): Promise<PropositionDePointage[]> {
    const etat = await this.#stockage.lire();
    const releve = etat.releves.find((item) => item.id === releveId);
    if (!releve) {
      throw new ErreurRegle(`Le relevé « ${releveId} » n'existe pas dans le dossier.`);
    }
    return proposerPointageAutomatique(etat.mouvements, releve, etat.pointages, {
      dansLaPlageDuReleve: options?.horsPeriode !== true
    });
  }

  /**
   * Pointe des lignes de relevé avec des mouvements du compte.
   *
   * Un pointage n'exige que l'égalité des montants : rapprocher deux montants différents masquerait
   * une écriture manquante, et c'est précisément ce que le rapprochement doit révéler.
   */
  async pointer(demande: { releveId: string; paires: { ligne: string; mouvement: string }[] }): Promise<Pointage[]> {
    if (demande.paires.length === 0) {
      throw new ErreurRegle("Aucune paire demandée : choisissez une ligne de relevé et un mouvement.");
    }
    return this.#muter((etat) => {
      const releve = etat.releves.find((item) => item.id === demande.releveId);
      if (!releve) {
        throw new ErreurRegle(`Le relevé « ${demande.releveId} » n'existe pas dans le dossier.`);
      }
      const enVigueur = etat.pointages.filter(
        (pointage) => pointage.releveId === releve.id && pointage.defaitLe === null
      );
      const lignesPointees = new Set(enVigueur.map((pointage) => pointage.ligneDeReleve));
      const mouvementsPointes = new Set(enVigueur.map((pointage) => pointage.mouvement));
      const horodate = this.#horodate();
      const crees: Pointage[] = [];

      for (const paire of demande.paires) {
        const ligne = releve.lignes.find((item) => item.id === paire.ligne);
        if (!ligne) {
          throw new ErreurRegle(`La ligne « ${paire.ligne} » n'existe pas dans le relevé « ${releve.libelle} ».`);
        }
        if (lignesPointees.has(ligne.id)) {
          throw new ErreurRegle(`La ligne « ${ligne.libelle} » est déjà pointée dans ce relevé.`);
        }
        if (mouvementsPointes.has(paire.mouvement)) {
          throw new ErreurRegle(`Le mouvement ${paire.mouvement} est déjà pointé dans ce relevé.`);
        }
        const mouvement = this.#resoudreLignes(etat, [paire.mouvement])[0]!;
        if (comptePrincipalDe(mouvement.compte) !== comptePrincipalDe(releve.compte)) {
          throw new ErreurRegle(
            `Le mouvement ${mouvement.piece} porte le compte ${comptePrincipalDe(
              mouvement.compte
            )}, pas le compte du relevé ${comptePrincipalDe(releve.compte)}.`
          );
        }
        const montant = verifierPointage(mouvement, ligne, this.#paquet.devise);
        const numero = etat.pointages.filter((pointage) => pointage.releveId === releve.id).length + 1;
        const pointage: Pointage = {
          id: `${releve.id}-P${numero}`,
          releveId: releve.id,
          ligneDeReleve: ligne.id,
          mouvement: mouvement.ligneId,
          montant,
          date: mouvement.date,
          acteur: this.#utilisateur,
          horodate,
          defaitLe: null
        };
        etat.pointages.push(pointage);
        lignesPointees.add(ligne.id);
        mouvementsPointes.add(mouvement.ligneId);
        crees.push(pointage);
      }

      this.#tracer(
        etat,
        "Pointage bancaire",
        "Relevé",
        releve.id,
        `${releve.libelle} — ${crees.length} paire${crees.length > 1 ? "s" : ""}, ${formatMontant(
          additionner(...crees.map((pointage) => pointage.montant)),
          this.#paquet.devise
        )}`
      );
      return crees;
    });
  }

  /** Applique les propositions de pointage automatique. Rien n'est écrit s'il n'y a rien à proposer. */
  async pointerAutomatiquement(
    releveId: string,
    options?: { horsPeriode?: boolean }
  ): Promise<{ pointages: Pointage[]; propositions: PropositionDePointage[] }> {
    const propositions = await this.proposerPointage(releveId, options);
    if (propositions.length === 0) {
      return { pointages: [], propositions };
    }
    const pointages = await this.pointer({
      releveId,
      paires: propositions.map((proposition) => ({
        ligne: proposition.ligneDeReleve,
        mouvement: proposition.mouvement
      }))
    });
    return { pointages, propositions };
  }

  /**
   * Dépointe. Le pointage est conservé avec sa date de défaisance : un rapprochement refait ne doit
   * pas effacer la trace de celui qui a été défait.
   */
  async depointer(pointageId: string): Promise<Pointage> {
    return this.#muter((etat) => {
      const pointage = etat.pointages.find((item) => item.id === pointageId);
      if (!pointage) {
        throw new ErreurRegle(`Le pointage « ${pointageId} » n'existe pas dans le dossier.`);
      }
      if (pointage.defaitLe !== null) {
        throw new ErreurRegle("Ce pointage est déjà défait.");
      }
      const defait: Pointage = { ...pointage, defaitLe: this.#horodate() };
      etat.pointages = etat.pointages.map((item) => (item.id === pointageId ? defait : item));
      this.#tracer(etat, "Pointage défait", "Relevé", pointage.releveId, `Pointage ${pointage.id}`);
      return defait;
    });
  }

  /** L'horodate courante, au format de la piste d'audit. */
  #horodate(): string {
    return this.#horloge().toISOString();
  }

  #verifierCompteDeTiers(etat: EtatDossier, compte: string): void {
    const principal = comptePrincipalDe(compte);
    if (!etat.comptes.some((item) => item.numero === principal)) {
      throw new ErreurRegle(`Le compte « ${principal} » n'existe pas dans le plan du dossier.`);
    }
  }

  #resoudreLignes(etat: EtatDossier, lignes: readonly string[]): Mouvement[] {
    if (lignes.length === 0) {
      throw new ErreurRegle("Aucune ligne demandée : choisissez au moins deux lignes à lettrer.");
    }
    const vus = new Set<string>();
    const groupe: Mouvement[] = [];
    for (const ligneId of lignes) {
      if (vus.has(ligneId)) {
        throw new ErreurRegle(`La ligne « ${ligneId} » est demandée deux fois.`);
      }
      vus.add(ligneId);
      const mouvement = etat.mouvements.find((item) => item.ligneId === ligneId);
      if (!mouvement) {
        throw new ErreurRegle(`La ligne « ${ligneId} » n'existe pas dans le grand livre.`);
      }
      groupe.push(mouvement);
    }
    return groupe;
  }

  /** Vérifie un groupe, l'attribue et le trace. Appelé dans une mutation déjà ouverte. */
  #lettrerDans(etat: EtatDossier, groupe: readonly Mouvement[], date?: DateCivile): Lettrage {
    const verifie = verifierGroupeALettrer(groupe, this.#paquet.devise);

    const enVigueur = etat.lettrages.filter((lettrage) => lettrage.defaitLe === null);
    for (const mouvement of groupe) {
      const deja = enVigueur.find((lettrage) => lettrage.lignes.includes(mouvement.ligneId));
      if (deja) {
        throw new ErreurRegle(
          `La ligne ${mouvement.piece} · ${mouvement.compte} du ${formaterDateFr(
            mouvement.date
          )} est déjà lettrée sous le code ${deja.code}. Délettrez-la avant de la rapprocher d'une autre ligne.`
        );
      }
    }

    const comptes = [...new Set(groupe.map((mouvement) => comptePrincipalDe(mouvement.compte)))];
    if (comptes.length > 1) {
      throw new ErreurRegle(
        `Un lettrage ne mélange pas deux comptes : ${comptes.join(" et ")} demandés. Lettrez chaque compte séparément.`
      );
    }
    const tiers = [...new Set(groupe.map((mouvement) => mouvement.tiersCode))];
    if (tiers.length > 1) {
      throw new ErreurRegle(
        `Un lettrage ne mélange pas deux tiers : ${tiers.map((code) => code ?? "sans tiers").join(" et ")}.`
      );
    }

    const horodate = this.#horloge().toISOString();
    const lettrage: Lettrage = {
      code: codeDeLettrageSuivant(etat.lettrages),
      compte: comptes[0]!,
      tiersCode: tiers[0] ?? null,
      lignes: groupe.map((mouvement) => mouvement.ligneId),
      montant: verifie.montant,
      date: date ?? (horodate.slice(0, 10) as DateCivile),
      acteur: this.#utilisateur,
      horodate,
      defaitLe: null
    };
    etat.lettrages.push(lettrage);
    this.#tracer(
      etat,
      "Lettrage",
      "Lettrage",
      lettrage.code,
      `${lettrage.compte}${lettrage.tiersCode ? ` · ${lettrage.tiersCode}` : ""} — ${
        groupe.length
      } lignes, ${formatMontant(lettrage.montant, this.#paquet.devise)}`
    );
    return lettrage;
  }

  /* ---------------------------------------------------------------- */
  /* Multi-exercices et clôture                                        */
  /* ---------------------------------------------------------------- */

  /** Exercices du dossier, clos puis courant. */
  async exercices(): Promise<{ exercice: Exercice; clos: boolean; resultat: Montant | null }[]> {
    const etat = await this.#stockage.lire();
    return [
      ...etat.exercicesClos.map((clos) => ({
        exercice: clos.exercice,
        clos: true,
        resultat: clos.resultat
      })),
      { exercice: etat.exercice, clos: false, resultat: null }
    ];
  }

  /**
   * Prépare la clôture de l'exercice courant.
   *
   * Rien n'est écrit : le rapport dit ce qui serait écrit — le solde des comptes de gestion vers le
   * compte 121000, et les à-nouveaux de l'exercice suivant — et ce qui s'y oppose.
   */
  async preparerCloture(): Promise<RapportDeCloture> {
    const etat = await this.#stockage.lire();
    return this.#rapportDeCloture(etat);
  }

  /**
   * Clôture l'exercice courant et ouvre le suivant.
   *
   * Trois effets, en une seule opération atomique : l'écriture de solde des comptes de gestion dans
   * la période de clôture, le lot d'à-nouveaux au premier jour de l'exercice suivant, et le
   * basculement du dossier sur cet exercice. L'exercice clos est archivé avec toutes ses périodes
   * clôturées : plus aucune écriture ne peut y entrer.
   *
   * Une clôture refusée ne laisse aucune trace : soit les trois effets ont lieu, soit aucun.
   */
  async cloturerExercice(): Promise<{ clos: ExerciceClos; suivant: Exercice }> {
    return this.#muter((etat) => {
      const rapport = this.#rapportDeCloture(etat);
      verifierCloture(rapport);

      const exerciceClos = etat.exercice;
      const periodeDeCloture = rapport.periodeDeCloture;
      if (!periodeDeCloture) {
        throw new ErreurRegle("L'exercice ne comporte pas de période de clôture.");
      }
      const horodate = this.#horloge().toISOString();

      const cloture = this.#poserLotDeCloture(etat, {
        journalCode: "OD",
        exercice: exerciceClos,
        periodeNumero: periodeDeCloture.numero,
        date: periodeDeCloture.dateFin,
        libelle: `Clôture de l'exercice ${exerciceClos.annee}`,
        piece: `CL-${exerciceClos.annee}-0001`,
        codeSource: "CLOTURE",
        lignes: rapport.lignesDeCloture
      });

      const suivant = creerExercice(exerciceClos.annee + 1, exerciceClos.moisDeDepart);
      const premiere = suivant.periodes[0];
      if (!premiere) {
        throw new ErreurRegle("Le nouvel exercice n'a aucune période.");
      }
      const anouveaux = this.#poserLotDeCloture(etat, {
        journalCode: "AN",
        exercice: suivant,
        periodeNumero: premiere.numero,
        date: suivant.dateDebut,
        libelle: `À-nouveaux de l'exercice ${suivant.annee}`,
        piece: `AN-${suivant.annee}-0001`,
        codeSource: "ANOUVEAU",
        lignes: rapport.lignesDANouveaux
      });

      const archive: Exercice = {
        ...exerciceClos,
        periodes: exerciceClos.periodes.map((periode) => ({ ...periode, clots: true }))
      };
      const clos: ExerciceClos = {
        exercice: archive,
        clotureLe: horodate,
        cloturePar: this.#utilisateur,
        resultat: rapport.resultat,
        lotClotureId: cloture?.lot.id ?? null,
        lotANouveauxId: anouveaux?.lot.id ?? null,
        totalActif: rapport.totalActif,
        totalPassif: rapport.totalPassif,
        nombreDANouveaux: rapport.lignesDANouveaux.length
      };
      etat.exercicesClos.push(clos);
      etat.exercice = suivant;

      this.#tracer(
        etat,
        "Exercice clôturé",
        "Exercice",
        String(exerciceClos.annee),
        `Résultat ${formatMontant(rapport.resultat, this.#paquet.devise)} porté au compte ${COMPTE_RESULTAT_EXERCICE} · ${
          rapport.lignesDeCloture.length
        } lignes de clôture · ${cloture ? `lot ${cloture.lot.numero}` : "aucune écriture de clôture nécessaire"}`
      );
      this.#tracer(
        etat,
        "À-nouveaux créés",
        "Exercice",
        String(suivant.annee),
        `${rapport.lignesDANouveaux.length} compte${
          rapport.lignesDANouveaux.length > 1 ? "s" : ""
        } reporté${rapport.lignesDANouveaux.length > 1 ? "s" : ""} · ${
          anouveaux ? `lot ${anouveaux.lot.numero} du ${formaterDateFr(suivant.dateDebut)}` : "aucun à-nouveau"
        }`
      );
      return { clos, suivant };
    });
  }

  #rapportDeCloture(etat: EtatDossier): RapportDeCloture {
    return preparerRapportDeCloture({
      exercice: etat.exercice,
      mouvements: etat.mouvements,
      comptes: etat.comptes,
      groupes: this.#paquet.referentiel.groupes,
      structure: this.#paquet.referentiel.structure,
      lots: etat.lots,
      compteDeResultat: COMPTE_RESULTAT_EXERCICE,
      devise: this.#paquet.devise,
      exercicesClos: etat.exercicesClos.map((clos) => clos.exercice.annee)
    });
  }

  /**
   * Pose un lot et son écriture, déjà comptabilisés, sans passer par la saisie.
   *
   * Réservé à la clôture : les écritures produites sont la conséquence mécanique des soldes, pas une
   * saisie. Un lot sans ligne n'est pas créé — une écriture vide n'a pas de sens.
   */
  #poserLotDeCloture(
    etat: EtatDossier,
    demande: {
      journalCode: string;
      exercice: Exercice;
      periodeNumero: number;
      date: DateCivile;
      libelle: string;
      piece: string;
      codeSource: string;
      lignes: readonly LignePrevue[];
    }
  ): { lot: Lot; mouvements: Mouvement[] } | null {
    if (demande.lignes.length === 0) {
      return null;
    }
    const journal = etat.journaux.find((item) => item.code === demande.journalCode.toUpperCase());
    if (!journal) {
      throw new ErreurRegle(
        `Le journal « ${demande.journalCode} » n'existe pas dans le dossier : la clôture ne peut pas être écrite.`
      );
    }

    const sequence = (etat.sequencesLots[journal.code] ?? 0) + 1;
    etat.sequencesLots[journal.code] = sequence;
    const sequenceEcriture = (etat.sequencesEcritures[journal.code] ?? 0) + 1;
    etat.sequencesEcritures[journal.code] = sequenceEcriture;

    const lotIdentifiant = `LOT-${demande.exercice.annee}-${journal.code}-${sequence}`;
    const ecritureIdentifiant = `${lotIdentifiant}-E1`;
    const horodate = this.#horloge().toISOString();

    const lignes: LigneEcriture[] = demande.lignes.map((prevue, index) => ({
      id: `${ecritureIdentifiant}-L${index + 1}`,
      compte: prevue.compte,
      libelle: prevue.libelle,
      debit: prevue.debit,
      credit: prevue.credit,
      codesTaxe: [],
      tiersCode: prevue.tiersCode,
      echeance: null
    }));

    const ecriture: Ecriture = {
      id: ecritureIdentifiant,
      numero: `${journal.prefixeLot}-${sequenceEcriture.toString().padStart(5, "0")}`,
      piece: demande.piece,
      date: demande.date,
      libelle: demande.libelle,
      etat: "comptabilisee",
      lignes,
      origine: null
    };
    const lot: Lot = {
      id: lotIdentifiant,
      numero: `${journal.prefixeLot}${sequence.toString().padStart(4, "0")}`,
      journalCode: journal.code,
      date: demande.date,
      libelle: demande.libelle,
      codeSource: demande.codeSource,
      etat: "comptabilise",
      ecritures: [ecriture],
      comptabiliseLe: horodate,
      comptabilisePar: this.#utilisateur,
      contrePasseLe: null,
      origine: null
    };
    etat.lots.push(lot);

    const mouvements: Mouvement[] = lignes.map((ligne) => ({
      lotId: lot.id,
      lotNumero: lot.numero,
      journalCode: lot.journalCode,
      ecritureId: ecriture.id,
      ecritureNumero: ecriture.numero,
      ligneId: ligne.id,
      piece: ecriture.piece,
      date: ecriture.date,
      exercice: demande.exercice.annee,
      periode: demande.periodeNumero,
      compte: ligne.compte,
      tiersCode: ligne.tiersCode,
      libelle: ligne.libelle,
      debit: ligne.debit,
      credit: ligne.credit,
      codesTaxe: [],
      comptabiliseLe: horodate
    }));

    // Une écriture de clôture déséquilibrée serait une faute du producteur, pas de l'utilisateur :
    // elle est refusée ici plutôt que découverte dans un état.
    const equilibre = verifierEquilibre(mouvements);
    if (!equilibre.equilibre) {
      throw new ErreurRegle(
        `Le lot ${lot.numero} produit par la clôture n'est pas équilibré : débit ${formatMontant(
          equilibre.totalDebit,
          this.#paquet.devise
        )}, crédit ${formatMontant(equilibre.totalCredit, this.#paquet.devise)}.`
      );
    }

    etat.mouvements.push(...mouvements);
    return { lot, mouvements };
  }

  /**
   * Mouvements du dossier, écritures de clôture exceptées.
   *
   * L'écriture de clôture solde les comptes de gestion vers le compte 121000 : l'inclure dans un
   * compte de résultat reviendrait à annoncer un résultat nul pour un exercice clos. Elle est la
   * conséquence du résultat, pas un élément de l'activité. Le bilan, lui, l'inclut — c'est elle qui
   * porte le résultat dans les capitaux propres d'un exercice clos.
   */
  #mouvementsHorsCloture(etat: EtatDossier): Mouvement[] {
    const lotsDeCloture = new Set(
      etat.lots.filter((lot) => lot.codeSource === "CLOTURE").map((lot) => lot.id)
    );
    if (lotsDeCloture.size === 0) {
      return etat.mouvements;
    }
    return etat.mouvements.filter((mouvement) => !lotsDeCloture.has(mouvement.lotId));
  }

  /** Résout l'exercice demandé : le courant, ou un exercice clos du dossier. */
  /**
   * Produit une sauvegarde complète du dossier, prête à être téléchargée.
   *
   * La sauvegarde porte son propre inventaire : qui l'a produite, quand, sur quel paquet pays, avec
   * combien de comptes, de mouvements et de lots. C'est ce qui permet de décider, six mois plus tard,
   * si un fichier vaut d'être restauré.
   */
  async produireSauvegarde(): Promise<SauvegardeDossier> {
    const etat = await this.#stockage.lire();
    return composerSauvegarde(etat, {
      creeeLe: this.#horloge().toISOString(),
      creeePar: this.#utilisateur,
      paquet: this.#paquet
    });
  }

  /**
   * Restaure un dossier depuis une sauvegarde.
   *
   * La restauration **remplace** tout : elle n'est pas une fusion. Une fusion silencieuse de deux
   * dossiers produirait des soldes que personne ne pourrait expliquer. Le remplacement est tracé dans
   * la piste d'audit de la sauvegarde restaurée, avec le contenu du dossier qu'il écrase — c'est la
   * seule mémoire qui reste de ce qui a été perdu.
   *
   * Une sauvegarde produite sur un autre paquet pays est refusée : ses taux et ses règles fiscales ne
   * correspondent pas à ceux que cette application applique.
   */
  async restaurerSauvegarde(brut: unknown): Promise<ResultatRestauration> {
    const { sauvegarde, etat } = verifierSauvegarde(brut, this.#paquet.devise);
    if (sauvegarde.paquetPays?.nom !== this.#paquet.nom) {
      throw new ErreurRegle(
        `Cette sauvegarde a été produite sur le paquet pays « ${String(
          sauvegarde.paquetPays?.nom ?? "inconnu"
        )} » ; ce dossier tourne sur « ${
          this.#paquet.nom
        } ». Restaurez-la dans une application configurée pour ce pays.`
      );
    }

    return this.#remplacer(async () => {
      const courant = await this.#stockage.lire();
      const avant = compterContenu(courant);
      this.#tracer(
        etat,
        "Restauration du dossier",
        "dossier",
        etat.societe.code,
        `Sauvegarde du ${sauvegarde.creeeLe} produite par ${sauvegarde.creeePar}. Dossier écrasé : ${
          avant.mouvements
        } mouvement(s), ${avant.lots} lot(s), ${avant.comptes} compte(s).`
      );
      return {
        etat,
        resultat: {
          avant,
          apres: compterContenu(etat),
          sauvegardeDu: sauvegarde.creeeLe,
          societe: etat.societe.raisonSociale,
          exercice: etat.exercice.annee
        }
      };
    });
  }

  /**
   * Écrit un état qui ne dérive pas de l'état courant.
   *
   * `#muter` relit et réécrit le même état : c'est ce qu'il faut pour une mutation, et exactement ce
   * qu'il ne faut pas pour une restauration, qui remplace l'état par un autre.
   */
  async #remplacer<Resultat>(
    operation: () => Promise<{ etat: EtatDossier; resultat: Resultat }>
  ): Promise<Resultat> {
    const execution = this.#chaine.then(async () => {
      const { etat, resultat } = await operation();
      await this.#stockage.ecrire(etat);
      return resultat;
    });
    // Une erreur ne doit pas bloquer les mutations suivantes.
    this.#chaine = execution.catch(() => undefined);
    return execution;
  }

  #exerciceDemande(etat: EtatDossier, exercice?: number): Exercice {
    if (exercice === undefined || exercice === etat.exercice.annee) {
      return etat.exercice;
    }
    const clos = etat.exercicesClos.find((item) => item.exercice.annee === exercice);
    if (!clos) {
      const disponibles = [...etat.exercicesClos.map((item) => item.exercice.annee), etat.exercice.annee];
      throw new ErreurRegle(
        `L'exercice ${exercice} n'existe pas dans ce dossier. Exercices disponibles : ${disponibles.join(", ")}.`
      );
    }
    return clos.exercice;
  }

  /**
   * Balance de l'exercice précédent, pour la colonne N-1.
   *
   * `null` quand aucun exercice n'est clos : un N-1 inventé serait une fausse comparaison.
   */
  #exercicePrecedent(etat: EtatDossier, cible: Exercice): ExercicePrecedent | null {
    const clos = etat.exercicesClos.find((item) => item.exercice.annee === cible.annee - 1);
    if (!clos) {
      return null;
    }
    return {
      exercice: clos.exercice.annee,
      dateCloture: clos.exercice.dateFin,
      balance: construireBalance(etat.mouvements, etat.comptes, { exercice: clos.exercice.annee })
    };
  }

  /* ---------------------------------------------------------------- */
  /* Internes                                                          */
  /* ---------------------------------------------------------------- */

  /** Toutes les mutations passent ici : une seule à la fois, puis persistance et renvoi. */
  async #muter<Resultat>(operation: (etat: EtatDossier) => Promise<Resultat> | Resultat): Promise<Resultat> {
    const execution = this.#chaine.then(async () => {
      const etat = await this.#stockage.lire();
      const resultat = await operation(etat);
      await this.#stockage.ecrire(etat);
      return resultat;
    });
    // Une erreur ne doit pas bloquer les mutations suivantes.
    this.#chaine = execution.catch(() => undefined);
    return execution;
  }

  #trouverLot(etat: EtatDossier, identifiant: string): Lot {
    const lot = etat.lots.find((item) => item.id === identifiant || item.numero === identifiant);
    if (!lot) {
      throw new ErreurRegle(`Le lot « ${identifiant} » n'existe pas dans ce dossier.`);
    }
    return lot;
  }

  #periodeOuverte(etat: EtatDossier, date: DateCivile): boolean {
    try {
      return !periodeDeDate(etat.exercice, date).clots;
    } catch {
      return false;
    }
  }

  #periodeCourante(etat: EtatDossier) {
    const aujourdhui = this.#horloge().toISOString().slice(0, 10);
    const trouvee = etat.exercice.periodes.find(
      (periode) => periode.type === "normale" && aujourdhui >= periode.dateDebut && aujourdhui <= periode.dateFin
    );
    return trouvee ?? etat.exercice.periodes[0] ?? periodeDeDate(etat.exercice, etat.exercice.dateDebut);
  }

  #resoudreCompte(etat: EtatDossier, numero: string): CompteResolu | null {
    const plan = new Map(etat.comptes.map((compte) => [compte.comptePrincipal, compte] as const));
    try {
      const { comptePrincipal, auxiliaire, axe } = decouperNumero(numero, this.#paquet.referentiel.structure);
      const compte = plan.get(comptePrincipal);
      if (!compte) {
        return null;
      }
      return {
        numero,
        comptePrincipal,
        auxiliaire,
        axe,
        libelle: auxiliaire ? `${compte.libelle} — ${auxiliaire}` : compte.libelle,
        classe: compte.classe,
        groupe: compte.groupe,
        exigeTiers: compte.exigeTiers,
        autoriseSaisie: compte.autoriseSaisie
      };
    } catch {
      return null;
    }
  }

  #contexteDeValidation(etat: EtatDossier): ContexteValidation {
    const tiersActifs = new Set(etat.tiers.filter((tiers) => tiers.actif).map((tiers) => tiers.code));
    return {
      compteParNumero: (numero) => this.#resoudreCompte(etat, numero),
      tiersActif: (code) => tiersActifs.has(code.trim().toUpperCase()),
      periodeOuverte: (date) => this.#periodeOuverte(etat, date)
    };
  }

  #construireLigne(
    etat: EtatDossier,
    ecritureIdentifiant: string,
    rang: number,
    demande: DemandeLigne
  ): LigneEcriture {
    const resolu = this.#resoudreCompte(etat, demande.compte);
    if (!resolu) {
      throw new ErreurRegle(`Le compte « ${demande.compte} » n'existe pas dans le plan du dossier.`);
    }
    const montant = (valeur: string | Montant | undefined): Montant => {
      if (valeur === undefined || valeur === null) return ZERO;
      return typeof valeur === "bigint" ? valeur : analyserMontant(valeur, this.#paquet.devise);
    };
    const debit = montant(demande.debit);
    const credit = montant(demande.credit);
    if (debit !== ZERO && credit !== ZERO) {
      throw new ErreurRegle(
        `Ligne ${resolu.numero} : une ligne porte soit un débit, soit un crédit, jamais les deux.`
      );
    }
    const codesTaxe = demande.codesTaxe ?? [];
    for (const codeDemande of codesTaxe) {
      if (!etat.codesTaxe.some((code) => code.code === codeDemande)) {
        throw new ErreurRegle(
          `Le code de taxe « ${codeDemande} » n'existe pas dans le paramétrage du dossier. Codes disponibles : ${etat.codesTaxe
            .map((code) => code.code)
            .join(", ")}.`
        );
      }
    }
    const tiersCode = demande.tiersCode?.trim().toUpperCase() || resolu.auxiliaire || null;
    return {
      id: `${ecritureIdentifiant}-L${rang}`,
      compte: resolu.numero,
      libelle: demande.libelle.trim(),
      debit,
      credit,
      codesTaxe,
      tiersCode,
      echeance: demande.echeance ?? null
    };
  }

  #tracer(etat: EtatDossier, action: string, entite: string, entiteIdentifiant: string, detail: string): void {
    const precedent = etat.audit.at(-1);
    etat.audit.push({
      sequence: (precedent?.sequence ?? 0) + 1,
      horodate: this.#horloge().toISOString(),
      utilisateur: this.#utilisateur,
      action,
      entite,
      entiteIdentifiant,
      detail
    });
  }
}

/* ------------------------------------------------------------------ */
/* Dossier de démonstration : société béninoise fictive                */
/* ------------------------------------------------------------------ */

const JOURNAUX_DEMARRAGE: { code: string; libelle: string; nature: NatureJournal; contrepartie: string | null; prefixe: string }[] = [
  { code: "ACH", libelle: "Journal des achats", nature: "achats", contrepartie: null, prefixe: "ACH" },
  { code: "VTE", libelle: "Journal des ventes", nature: "ventes", contrepartie: null, prefixe: "VTE" },
  { code: "BQ", libelle: "Banque principale", nature: "banque", contrepartie: "521100", prefixe: "BQ" },
  { code: "CAI", libelle: "Caisse siège social", nature: "caisse", contrepartie: "571100", prefixe: "CAI" },
  { code: "OD", libelle: "Opérations diverses", nature: "operations-diverses", contrepartie: null, prefixe: "OD" },
  { code: "SAL", libelle: "Journal des salaires", nature: "salaires", contrepartie: null, prefixe: "SAL" },
  { code: "AN", libelle: "À-nouveaux", nature: "a-nouveaux", contrepartie: null, prefixe: "AN" }
];

/**
 * Société de démonstration proposée pour le pilote Bénin.
 * Les valeurs sont fictives et annoncées comme telles : aucune donnée réelle d'un contribuable
 * béninois n'est embarquée dans le dépôt.
 */
export const SOCIETE_DEMONSTRATION_BENIN: Societe = {
  code: "000",
  raisonSociale: "BÉNIN NÉGOCE DISTRIBUTION",
  formeJuridique: "SARL",
  identifiantFiscal: "0020151234567",
  adresse: "Lot 214, quartier Ganhi, BP 1234",
  ville: "Cotonou",
  pays: "Bénin",
  telephone: "+229 21 30 45 67",
  courriel: "compta@benin-negoce.bj",
  regimeFiscal: "Réel normal — assujetti TVA 18 %"
};

export function creerDossierDemonstration(options?: {
  annee?: number;
  societe?: Partial<Societe>;
  paquetPays?: PaquetPays;
}): EtatDossier {
  const paquet = options?.paquetPays ?? BENIN;
  const annee = options?.annee ?? new Date().getUTCFullYear();
  const societe: Societe = { ...SOCIETE_DEMONSTRATION_BENIN, ...options?.societe };
  if (societe.identifiantFiscal !== "") {
    societe.identifiantFiscal = validerIfu(societe.identifiantFiscal);
  }

  const comptes = paquet.referentiel.plan.map((compte) => compteDepuisPlan(compte, paquet.referentiel.structure));
  const journaux: Journal[] = JOURNAUX_DEMARRAGE.map((journal) => ({
    code: journal.code,
    libelle: journal.libelle,
    nature: journal.nature,
    compteContrepartie: journal.contrepartie,
    prefixeLot: journal.prefixe,
    actif: true
  }));

  const tiers: Tiers[] = [
    {
      code: "CLI01",
      nom: "SUPERMARCHÉ CADJEHOUN",
      type: "client",
      identifiantFiscal: "0020181456789",
      immatricule: true,
      adresse: "Boulevard de la Marina",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "+229 21 31 22 44",
      courriel: "achats@cadjehoun-market.bj",
      actif: true
    },
    {
      code: "CLI02",
      nom: "BOUTIQUE DANTOKPA",
      type: "client",
      identifiantFiscal: "",
      immatricule: false,
      adresse: "Marché Dantokpa, niveau 2",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    },
    {
      code: "FOU01",
      nom: "GROSSISTE PORT AUTONOME",
      type: "fournisseur",
      identifiantFiscal: "0020141987654",
      immatricule: true,
      adresse: "Zone portuaire",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "+229 21 31 80 10",
      courriel: "commandes@port-grossiste.bj",
      actif: true
    },
    {
      code: "FOU02",
      nom: "TRANSPORTS NORD-BORGOU",
      type: "fournisseur",
      identifiantFiscal: "0020191122334",
      immatricule: true,
      adresse: "Route de Parakou",
      ville: "Bohicon",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    },
    {
      code: "FOU03",
      nom: "ATELIER ZOGBADJÈ (SECTEUR INFORMEL)",
      type: "fournisseur",
      identifiantFiscal: "",
      immatricule: false,
      adresse: "Zogbadjè",
      ville: "Abomey-Calavi",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    },
    {
      code: "ETAT1",
      nom: "DIRECTION GÉNÉRALE DES IMPÔTS",
      type: "etat",
      identifiantFiscal: "ETAT-DGI",
      immatricule: true,
      adresse: "Cité Financière",
      ville: "Porto-Novo",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    },
    {
      code: "CNSS1",
      nom: "CAISSE NATIONALE DE SÉCURITÉ SOCIALE",
      type: "organisme-social",
      identifiantFiscal: "",
      immatricule: true,
      adresse: "",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    },
    {
      code: "PER01",
      nom: "ASSOGBA MARIE-CLAIRE",
      type: "personnel",
      identifiantFiscal: "",
      immatricule: false,
      adresse: "Akpakpa",
      ville: "Cotonou",
      pays: "Bénin",
      telephone: "",
      courriel: "",
      actif: true
    }
  ];

  const etat: EtatDossier = {
    version: 1,
    paquetPaysCode: paquet.code,
    referentielCode: paquet.referentiel.code,
    societe,
    exercice: creerExercice(annee, 1, 12),
    comptes,
    journaux,
    tiers,
    lots: [],
    mouvements: [],
    lettrages: [],
    exercicesClos: [],
    releves: [],
    pointages: [],
    sequencesReleves: 0,
    // Copie, pas référence : modifier un taux du dossier ne doit pas toucher au paquet pays.
    codesTaxe: paquet.codesTaxe.map((code) => ({ ...code })),
    sequencesLots: {},
    sequencesEcritures: {},
    audit: []
  };

  // À-nouveaux : un dossier de démonstration sans solde initial ne montrerait aucune balance.
  const lotIdentifiant = `LOT-${annee}-AN-1`;
  const horodate = new Date(Date.UTC(annee, 0, 1, 8, 0, 0)).toISOString();
  const lignes: LigneEcriture[] = [
    ligne(lotIdentifiant, 1, "311000", "Stock de marchandises à l'ouverture", 20_000_000n, ZERO),
    ligne(lotIdentifiant, 2, "521100", "Banque — solde d'ouverture", 55_000_000n, ZERO),
    ligne(lotIdentifiant, 3, "571100", "Caisse — solde d'ouverture", 5_000_000n, ZERO),
    ligne(lotIdentifiant, 4, "101000", "Capital social", ZERO, 60_000_000n),
    ligne(lotIdentifiant, 5, "111000", "Report à nouveau créditeur", ZERO, 10_000_000n),
    ligne(lotIdentifiant, 6, "401100-FOU01", "Fournisseurs — solde à l'ouverture", ZERO, 10_000_000n, "FOU01")
  ];
  const ecriture: Ecriture = {
    id: `${lotIdentifiant}-E1`,
    numero: "AN-00001",
    piece: "AN-0001",
    date: `${annee}-01-01`,
    libelle: "À-nouveaux de l'exercice",
    etat: "comptabilisee",
    lignes,
    origine: null
  };
  const lot: Lot = {
    id: lotIdentifiant,
    numero: "AN0001",
    journalCode: "AN",
    date: `${annee}-01-01`,
    libelle: "À-nouveaux",
    codeSource: "ANOUVEAU",
    etat: "comptabilise",
    ecritures: [ecriture],
    comptabiliseLe: horodate,
    comptabilisePar: "superviseur",
    contrePasseLe: null,
    origine: null
  };
  etat.lots.push(lot);
  etat.sequencesLots.AN = 1;
  etat.sequencesEcritures.AN = 1;

  const periode = periodeDeDate(etat.exercice, ecriture.date);
  for (const item of lignes) {
    etat.mouvements.push({
      lotId: lot.id,
      lotNumero: lot.numero,
      journalCode: lot.journalCode,
      ecritureId: ecriture.id,
      ecritureNumero: ecriture.numero,
      ligneId: item.id,
      piece: ecriture.piece,
      date: ecriture.date,
      exercice: etat.exercice.annee,
      periode: periode.numero,
      compte: item.compte,
      tiersCode: item.tiersCode,
      libelle: item.libelle,
      debit: item.debit,
      credit: item.credit,
      codesTaxe: item.codesTaxe,
      comptabiliseLe: horodate
    });
  }
  // Un relevé bancaire de démonstration : celui de mars, reçu de la banque et pas encore
  // comptabilisé. C'est le point de départ ordinaire d'un rapprochement — quatre opérations que la
  // banque a enregistrées et que la comptabilité n'a pas passées. Aucun mouvement n'est ajouté ici :
  // les soldes du dossier de démonstration restent ceux des à-nouveaux.
  etat.releves.push(
    construireReleve(
      {
        compte: "521100",
        journalCode: "BQ",
        libelle: `Relevé de mars ${annee} — BOA Bénin`,
        dateDebut: `${annee}-03-01`,
        dateFin: `${annee}-03-31`,
        soldeDOuverture: "55000000",
        lignes: [
          {
            date: `${annee}-03-05`,
            libelle: "Virement SUPERMARCHÉ CADJEHOUN",
            reference: "VIR-2291",
            montant: "3500000"
          },
          {
            date: `${annee}-03-12`,
            libelle: "Chèque émis — facture FA-2026-011 FOU01",
            reference: "CHQ-118204",
            montant: "-1850000"
          },
          { date: `${annee}-03-20`, libelle: "Remise espèces guichet Cotonou", reference: "REM-0044", montant: "750000" },
          {
            date: `${annee}-03-31`,
            libelle: "Frais de tenue de compte et commissions",
            reference: "FRAIS-03",
            montant: "-18500"
          }
        ]
      },
      {
        identifiant: "RELEVE-521100-1",
        horodate,
        acteur: "superviseur",
        devise: paquet.devise
      }
    )
  );
  etat.sequencesReleves = 1;

  etat.audit.push({
    sequence: 1,
    horodate,
    utilisateur: "superviseur",
    action: "Dossier de démonstration créé",
    entite: "Dossier",
    entiteIdentifiant: numeroDeDossier("CG", societe.code, annee),
    detail: `${comptes.length} comptes, ${journaux.length} journaux, ${tiers.length} tiers, à-nouveaux comptabilisés`
  });

  return etat;
}

function ligne(
  lotIdentifiant: string,
  rang: number,
  compte: string,
  libelle: string,
  debit: Montant,
  credit: Montant,
  tiersCode: string | null = null,
  codesTaxe: string[] = []
): LigneEcriture {
  return {
    id: `${lotIdentifiant}-E1-L${rang}`,
    compte,
    libelle,
    debit,
    credit,
    codesTaxe,
    tiersCode,
    echeance: null
  };
}

/* ------------------------------------------------------------------ */
/* Sérialisation : les montants sont des bigint, JSON ne les porte pas. */
/* ------------------------------------------------------------------ */

export interface EtatDossierSerialise
  extends Omit<
    EtatDossier,
    | "mouvements"
    | "comptes"
    | "lots"
    | "lettrages"
    | "exercicesClos"
    | "releves"
    | "pointages"
    | "codesTaxe"
  > {
  codesTaxe: (Omit<CodeTaxe, "pointsDeBase"> & { pointsDeBase: string })[];
  releves: (Omit<ReleveBancaire, "soldeDOuverture" | "lignes"> & {
    soldeDOuverture: string;
    lignes: (Omit<LigneDeReleve, "montant"> & { montant: string })[];
  })[];
  pointages: (Omit<Pointage, "montant"> & { montant: string })[];
  lettrages: (Omit<Lettrage, "montant"> & { montant: string })[];
  exercicesClos: (Omit<ExerciceClos, "resultat" | "totalActif" | "totalPassif"> & {
    resultat: string;
    totalActif: string;
    totalPassif: string;
  })[];
  comptes: (Omit<Compte, "soldeInitial"> & { soldeInitial: string })[];
  lots: (Omit<Lot, "ecritures"> & {
    ecritures: (Omit<Ecriture, "lignes"> & {
      lignes: (Omit<LigneEcriture, "debit" | "credit"> & { debit: string; credit: string })[];
    })[];
  })[];
  mouvements: (Omit<Mouvement, "debit" | "credit"> & { debit: string; credit: string })[];
}

export function serialiserEtat(etat: EtatDossier): EtatDossierSerialise {
  return {
    ...etat,
    comptes: etat.comptes.map((compte) => ({ ...compte, soldeInitial: montantVersChaine(compte.soldeInitial) })),
    lots: etat.lots.map((lot) => ({
      ...lot,
      ecritures: lot.ecritures.map((ecriture) => ({
        ...ecriture,
        lignes: ecriture.lignes.map((item) => ({
          ...item,
          debit: montantVersChaine(item.debit),
          credit: montantVersChaine(item.credit)
        }))
      }))
    })),
    mouvements: etat.mouvements.map((mouvement) => ({
      ...mouvement,
      debit: montantVersChaine(mouvement.debit),
      credit: montantVersChaine(mouvement.credit)
    })),
    lettrages: etat.lettrages.map((lettrage) => ({ ...lettrage, montant: montantVersChaine(lettrage.montant) })),
    exercicesClos: etat.exercicesClos.map((clos) => ({
      ...clos,
      resultat: montantVersChaine(clos.resultat),
      totalActif: montantVersChaine(clos.totalActif),
      totalPassif: montantVersChaine(clos.totalPassif)
    })),
    codesTaxe: etat.codesTaxe.map((code) => ({ ...code, pointsDeBase: montantVersChaine(code.pointsDeBase) })),
    releves: etat.releves.map((releve) => ({
      ...releve,
      soldeDOuverture: montantVersChaine(releve.soldeDOuverture),
      lignes: releve.lignes.map((ligne) => ({ ...ligne, montant: montantVersChaine(ligne.montant) }))
    })),
    pointages: etat.pointages.map((pointage) => ({ ...pointage, montant: montantVersChaine(pointage.montant) }))
  };
}

export function deserialiserEtat(brut: EtatDossierSerialise): EtatDossier {
  return {
    ...brut,
    comptes: brut.comptes.map((compte) => ({ ...compte, soldeInitial: montantDepuisChaine(compte.soldeInitial) })),
    lots: brut.lots.map((lot) => ({
      ...lot,
      ecritures: lot.ecritures.map((ecriture) => ({
        ...ecriture,
        lignes: ecriture.lignes.map((item) => ({
          ...item,
          debit: montantDepuisChaine(item.debit),
          credit: montantDepuisChaine(item.credit)
        }))
      }))
    })),
    mouvements: brut.mouvements.map((mouvement) => ({
      ...mouvement,
      debit: montantDepuisChaine(mouvement.debit),
      credit: montantDepuisChaine(mouvement.credit)
    })),
    lettrages: brut.lettrages.map((lettrage) => ({ ...lettrage, montant: montantDepuisChaine(lettrage.montant) })),
    exercicesClos: brut.exercicesClos.map((clos) => ({
      ...clos,
      resultat: montantDepuisChaine(clos.resultat),
      totalActif: montantDepuisChaine(clos.totalActif),
      totalPassif: montantDepuisChaine(clos.totalPassif)
    })),
    // Un dossier enregistré avant ces champs les reçoit vides : relire un ancien dossier ne doit pas
    // échouer. Les codes de taxe retombent sur ceux du paquet pays, qui est la référence.
    codesTaxe: (brut.codesTaxe ?? BENIN.codesTaxe.map((code) => ({ ...code, pointsDeBase: code.pointsDeBase.toString() }))).map(
      (code) => ({ ...code, pointsDeBase: montantDepuisChaine(code.pointsDeBase) })
    ),
    releves: (brut.releves ?? []).map((releve) => ({
      ...releve,
      soldeDOuverture: montantDepuisChaine(releve.soldeDOuverture),
      lignes: releve.lignes.map((ligne) => ({ ...ligne, montant: montantDepuisChaine(ligne.montant) }))
    })),
    pointages: (brut.pointages ?? []).map((pointage) => ({ ...pointage, montant: montantDepuisChaine(pointage.montant) }))
  };
}

/* ------------------------------------------------------------------ */
/* Sauvegarde et restauration du dossier                               */
/* ------------------------------------------------------------------ */

/**
 * Marque de fabrique d'une sauvegarde.
 *
 * Elle est vérifiée à la restauration : un fichier JSON qui n'est pas une sauvegarde doit être
 * refusé avec une phrase claire, pas chargé à moitié.
 */
export const FORMAT_SAUVEGARDE = "perfectys-compta/sauvegarde";

/** Version du format. Une sauvegarde d'une autre version est refusée plutôt que devinée. */
export const VERSION_SAUVEGARDE = 1;

/** Ce qu'une sauvegarde contient, en compteurs : de quoi décider avant de regarder le détail. */
export interface ContenuDossier {
  comptes: number;
  journaux: number;
  tiers: number;
  mouvements: number;
  lots: number;
  lettrages: number;
  exercicesClos: number;
  releves: number;
  pointages: number;
  codesTaxe: number;
  audit: number;
}

/**
 * Une sauvegarde complète du dossier.
 *
 * Le fichier est autosuffisant : il porte l'identité de la société, l'exercice, le paquet pays et le
 * référentiel qui ont servi, et le compte de ce qu'il contient. Une sauvegarde retrouvée dans un
 * dossier de courriel six mois plus tard doit dire ce qu'elle est sans qu'on ait à l'ouvrir.
 */
export interface SauvegardeDossier {
  format: typeof FORMAT_SAUVEGARDE;
  version: number;
  creeeLe: string;
  creeePar: string;
  paquetPays: { nom: string; version: string };
  referentiel: string;
  devise: string;
  societe: {
    code: string;
    raisonSociale: string;
    formeJuridique: string;
    identifiantFiscal: string;
    ville: string;
    pays: string;
    regimeFiscal: string;
  };
  exercice: number;
  contenu: ContenuDossier;
  etat: EtatDossierSerialise;
}

export interface SauvegardeVerifiee {
  sauvegarde: SauvegardeDossier;
  etat: EtatDossier;
}

export interface ResultatRestauration {
  avant: ContenuDossier;
  apres: ContenuDossier;
  sauvegardeDu: string;
  societe: string;
  exercice: number;
}

export function compterContenu(etat: EtatDossier): ContenuDossier {
  return {
    comptes: etat.comptes.length,
    journaux: etat.journaux.length,
    tiers: etat.tiers.length,
    mouvements: etat.mouvements.length,
    lots: etat.lots.length,
    lettrages: etat.lettrages.length,
    exercicesClos: etat.exercicesClos.length,
    releves: etat.releves.length,
    pointages: etat.pointages.length,
    codesTaxe: etat.codesTaxe.length,
    audit: etat.audit.length
  };
}

export function composerSauvegarde(
  etat: EtatDossier,
  meta: { creeeLe: string; creeePar: string; paquet: PaquetPays }
): SauvegardeDossier {
  return {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    creeeLe: meta.creeeLe,
    creeePar: meta.creeePar,
    paquetPays: { nom: meta.paquet.nom, version: meta.paquet.version },
    referentiel: meta.paquet.referentiel.nom,
    devise: meta.paquet.devise.code,
    societe: {
      code: etat.societe.code,
      raisonSociale: etat.societe.raisonSociale,
      formeJuridique: etat.societe.formeJuridique,
      identifiantFiscal: etat.societe.identifiantFiscal,
      ville: etat.societe.ville,
      pays: etat.societe.pays,
      regimeFiscal: etat.societe.regimeFiscal
    },
    exercice: etat.exercice.annee,
    contenu: compterContenu(etat),
    etat: serialiserEtat(etat)
  };
}

function texteErreur(erreur: unknown): string {
  return erreur instanceof Error ? erreur.message : String(erreur);
}

/**
 * Vérifie une sauvegarde avant de la charger.
 *
 * Quatre refus, chacun avec sa raison : ce n'est pas une sauvegarde, ce n'est pas la bonne version,
 * elle est illisible, ou elle contient un grand livre déséquilibré. Le dernier cas est le plus
 * important : restaurer un dossier dont le débit ne fait pas le crédit produirait des états faux
 * sans que rien ne le signale jamais.
 */
export function verifierSauvegarde(brut: unknown, devise: Devise = XOF): SauvegardeVerifiee {
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) {
    throw new ErreurRegle(
      "Ce fichier n'est pas une sauvegarde Perfectys Compta : il ne contient pas un objet JSON."
    );
  }
  const objet = brut as Record<string, unknown>;
  if (objet.format !== FORMAT_SAUVEGARDE) {
    throw new ErreurRegle(
      `Ce fichier n'est pas une sauvegarde Perfectys Compta : format attendu « ${FORMAT_SAUVEGARDE} », trouvé « ${String(
        objet.format ?? "aucun"
      )} ».`
    );
  }
  if (objet.version !== VERSION_SAUVEGARDE) {
    throw new ErreurRegle(
      `Cette sauvegarde est en version ${String(
        objet.version
      )} ; cette application lit la version ${VERSION_SAUVEGARDE}. Une sauvegarde d'une autre version n'est pas devinée : elle est refusée.`
    );
  }
  const etatBrut = objet.etat;
  if (etatBrut === null || typeof etatBrut !== "object") {
    throw new ErreurRegle("Cette sauvegarde ne contient pas d'état de dossier.");
  }

  let etat: EtatDossier;
  try {
    etat = deserialiserEtat(etatBrut as EtatDossierSerialise);
  } catch (erreur) {
    throw new ErreurRegle(`Cette sauvegarde est illisible : ${texteErreur(erreur)}`);
  }

  if (etat.comptes.length === 0) {
    throw new ErreurRegle("Cette sauvegarde ne contient aucun compte : ce n'est pas un dossier comptable.");
  }
  if (typeof etat.societe?.raisonSociale !== "string" || etat.societe.raisonSociale.trim() === "") {
    throw new ErreurRegle("Cette sauvegarde ne dit pas quelle société elle contient.");
  }

  const equilibre = verifierEquilibre(etat.mouvements);
  if (!equilibre.equilibre) {
    throw new ErreurRegle(
      `Cette sauvegarde contient un grand livre déséquilibré : débit ${formatMontant(
        equilibre.totalDebit,
        devise
      )}, crédit ${formatMontant(
        equilibre.totalCredit,
        devise
      )}. Elle n'est pas restaurable en l'état — un dossier déséquilibré produirait des états faux sans que rien ne le signale.`
    );
  }

  return { sauvegarde: objet as unknown as SauvegardeDossier, etat };
}

export { totalLot };
export type { TypeTiers };
