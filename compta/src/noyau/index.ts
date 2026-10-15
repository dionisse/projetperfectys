/**
 * Surface publique du noyau.
 *
 * Une application comptable n'a pas besoin de voir ses entrailles : l'interface importe ce
 * fichier et rien d'autre. Tout ce qui n'y est pas exporté reste modifiable sans casser d'écran.
 */

export {
  ErreurRegle,
  SEPARATEUR_MILLIERS,
  XOF,
  ZERO,
  absolu,
  additionner,
  analyserMontant,
  appliquerTaux,
  comparer,
  diviserArrondi,
  estNegatif,
  estNul,
  estPositif,
  formatMontant,
  horsTaxeDepuisTTC,
  montantDepuisChaine,
  montantVersChaine,
  oppose,
  somme,
  soustraire,
  taxeSurTTC,
  type Devise,
  type Montant
} from "./montants";

export {
  ajouterMois,
  anneeDe,
  cloturerPeriode,
  creerExercice,
  dateCivile,
  decomposerDate,
  estBissextile,
  formaterDateFr,
  joursDuMois,
  ouvrirPeriode,
  periodeDeDate,
  periodeParNumero,
  type DateCivile,
  type Exercice,
  type Periode,
  type TypePeriode
} from "./calendrier";

export {
  LIBELLES_NATURE,
  composerNumero,
  compteAuxiliaire,
  compteDepuisPlan,
  decouperNumero,
  dependDe,
  racineDe,
  type ClasseDeCompte,
  type Compte,
  type CompteDuPlan,
  type GroupeDeComptes,
  type NatureCompte,
  type SegmentDeCompte,
  type StructureDeComptes
} from "./comptes";

export {
  CLASSES_SYSCOHADA,
  CODE_REFERENTIEL,
  COMPTE_RESULTAT_EXERCICE,
  GROUPES_SYSCOHADA,
  NOM_REFERENTIEL,
  PLAN_DEMARRAGE_SYSCOHADA,
  STRUCTURE_SYSCOHADA,
  SYSCOHADA_REVISE,
  VERSION_REFERENTIEL,
  classeDuReferentiel,
  groupeDuReferentiel,
  type Referentiel
} from "./referentiels/syscohada";

export {
  LIBELLES_TYPE_TIERS,
  normaliserTiers,
  tiersVide,
  type Tiers,
  type TypeTiers
} from "./tiers";

export {
  CODES_SOURCE,
  LIBELLES_NATURE_JOURNAL,
  inverserEcriture,
  lotComptabilisable,
  lotModifiable,
  totalCredit,
  totalDebit,
  totalLot,
  validerEcriture,
  validerLigne,
  validerLot,
  type CompteResolu,
  type ContexteValidation,
  type Ecriture,
  type EtatEcriture,
  type EtatLot,
  type Journal,
  type LigneEcriture,
  type Lot,
  type NatureJournal
} from "./lots";

export {
  calculerImpotAnnuel,
  calculerTaxe,
  codeTaxeApplicable,
  codesTaxeApplicables,
  formaterTaux,
  ligneTaxeAttendue,
  proposerLignesDeTaxe,
  verifierLignesTaxees,
  type BaseTaxe,
  type CalculTaxe,
  type CodeTaxe,
  type ConditionTaxe,
  type ImpotAnnuel,
  type LigneTaxeAttendue,
  type SensTaxe
} from "./taxes";

export {
  BENIN,
  REGLE_IFU_BENIN,
  parametresAVerifier,
  validerIfu,
  type FormeJuridique,
  type ObligationDeclarative,
  type PaquetPays,
  type RegleIdentifiantFiscal
} from "./pays/benin";

export {
  LIBELLES_SENS,
  construireBalance,
  construireGrandLivre,
  construireJournal,
  comptePrincipalDe,
  filtrerMouvements,
  sensDe,
  totauxParGroupe,
  verifierEquilibre,
  type FiltreMouvements,
  type LigneBalance,
  type LigneGrandLivre,
  type Mouvement,
  type PieceDeJournal,
  type SensSolde,
  type TotalParGroupe
} from "./grand-livre";

export {
  codesDeTva,
  construireDeclarationTva,
  obligationDeTva,
  type ControleDeDeclaration,
  type DeclarationTva,
  type LigneDeclarationTva,
  type SensLigneDeclaration
} from "./declaration-tva";

export {
  MODELE_BILAN_ACTIF,
  MODELE_BILAN_PASSIF,
  MODELE_COMPTE_RESULTAT,
  construireBilan,
  construireCompteDeResultat,
  type Bilan,
  type ColonnePrecedente,
  type CompteDeResultat,
  type DetailCompte,
  type ExercicePrecedent,
  type LigneEtat,
  type NiveauRubrique,
  type Rubrique,
  type SensPresentation
} from "./etats-financiers";
export {
  chercherCombinaison,
  codeDeLettrageSuivant,
  comparerLignesALettrer,
  lignesLettrees,
  mouvementsALettrer,
  proposerLettrageAutomatique,
  situationsDeLettrage,
  verifierGroupeALettrer,
  type CritereDeLettrage,
  type FiltreLignesALettrer,
  type Lettrage,
  type PropositionLettrage,
  type SituationDeLettrage
} from "./lettrage";

export {
  preparerCloture,
  soldesSegmentes,
  verifierCloture,
  type DemandeDePreparation,
  type LignePrevue,
  type RapportDeCloture,
  type SoldeSegment
} from "./cloture";

export {
  analyserMontantSigne,
  construireReleve,
  etatDeRapprochement,
  pointagesEnVigueur,
  proposerPointageAutomatique,
  soldeDuReleve,
  verifierPointage,
  type DemandeDeReleve,
  type ElementPointe,
  type EtatDeRapprochement,
  type LigneDeReleve,
  type Pointage,
  type PropositionDePointage,
  type ReleveBancaire
} from "./rapprochement";

export {
  comptesInterrogeables,
  formaterSens,
  interrogerCompte,
  type CompteInterrogeable,
  type ContexteInterrogation,
  type DemandeInterrogation,
  type ExerciceClosSommaire,
  type InterrogationDeCompte,
  type LigneInterrogation,
  type ReportExercice
} from "./interrogation";

export { StockageMemoire } from "./stockage";
export type { PortStockage } from "./stockage";

export {
  ServiceComptable,
  SOCIETE_DEMONSTRATION_BENIN,
  creerDossierDemonstration,
  deserialiserEtat,
  numeroDeDossier,
  serialiserEtat,
  type ContexteDossier,
  type DemandeEcriture,
  type ExerciceClos,
  type DemandeLigne,
  type DemandeLot,
  type EtatDossier,
  type EtatDossierSerialise,
  type EvenementAudit,
  type OptionsService,
  type Societe
} from "./dossier";
