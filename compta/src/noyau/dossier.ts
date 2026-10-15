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
  ErreurRegle,
  ZERO,
  analyserMontant,
  formatMontant,
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
  type DateCivile,
  type Exercice
} from "./calendrier";
import { compteDepuisPlan, decouperNumero, type Compte, type CompteDuPlan } from "./comptes";
import type { Referentiel } from "./referentiels/syscohada";
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
import { codesTaxeApplicables, verifierLignesTaxees, type CodeTaxe } from "./taxes";
import {
  construireBalance,
  construireGrandLivre,
  construireJournal,
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

  /** Codes de taxe applicables à une opération, proposés par le paquet pays. */
  codesTaxePour(contexte: {
    operation: "achat" | "vente";
    tiersImmatricule: boolean;
    tiersPublic: boolean;
    exportation: boolean;
  }): CodeTaxe[] {
    return codesTaxeApplicables(this.#paquet.codesTaxe, contexte);
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
      equilibre: verifierEquilibre(etat.mouvements).equilibre
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

  async balance(filtre: FiltreMouvements = {}): Promise<LigneBalance[]> {
    const etat = await this.#stockage.lire();
    return construireBalance(etat.mouvements, etat.comptes, filtre);
  }

  async journal(filtre: FiltreMouvements = {}): Promise<PieceDeJournal[]> {
    const etat = await this.#stockage.lire();
    return construireJournal(etat.mouvements, filtre);
  }

  async grandLivre(compte: string, filtre: FiltreMouvements = {}): Promise<LigneGrandLivre[]> {
    const etat = await this.#stockage.lire();
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
      verifierLignesTaxees(ecriture.lignes, this.#paquet.codesTaxe);

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
        verifierLignesTaxees(ecriture.lignes, this.#paquet.codesTaxe);
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
            piece: ecriture.piece,
            date: ecriture.date,
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
      if (!this.#paquet.codesTaxe.some((code) => code.code === codeDemande)) {
        throw new ErreurRegle(
          `Le code de taxe « ${codeDemande} » n'existe pas dans le paquet pays ${this.#paquet.nom}.`
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
      piece: ecriture.piece,
      date: ecriture.date,
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

export interface EtatDossierSerialise extends Omit<EtatDossier, "mouvements" | "comptes" | "lots"> {
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
    }))
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
    }))
  };
}

export { totalLot };
export type { TypeTiers };
