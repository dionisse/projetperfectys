/**
 * Saisie des écritures — la table de détail.
 *
 * C'est l'écran le plus utilisé d'une comptabilité : on y passe la journée. Il suit la logique de
 * Sage — un lot ouvert, une écriture en cours, des lignes tapées au clavier — et deux aides qui ne
 * trichent jamais :
 *
 * - les lignes de taxe sont **calculées par le noyau** à partir des codes cochés, puis affichées
 *   dans la grille comme des lignes ordinaires, repérables et modifiables. Rien n'est inséré en
 *   silence à la comptabilisation : ce que le grand livre contiendra, l'utilisateur l'a vu ;
 * - l'équilibrage propose une contrepartie sur un compte **choisi**, jamais deviné.
 *
 * Tout ce que le noyau refuse est affiché tel quel : la saisie ne masque aucune règle métier.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import {
  CODES_SOURCE,
  LIBELLES_NATURE_JOURNAL,
  codesTaxeApplicables,
  ZERO,
  analyserMontant,
  composerNumero,
  decouperNumero,
  estNul,
  oppose,
  proposerLignesDeTaxe,
  totalCredit,
  totalDebit,
  type CodeTaxe,
  type DateCivile,
  type DemandeLigne,
  type Ecriture,
  type Journal,
  type Lot,
  type Montant,
  type Tiers
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  Vide,
  message,
  montant,
  useAsync,
  type Colonne
} from "../composants";

/** Une ligne en cours de saisie : du texte, pas encore des montants. */
interface LigneSaisie {
  cle: string;
  compte: string;
  libelle: string;
  debit: string;
  credit: string;
  codesTaxe: string[];
  echeance: string;
  /** Une ligne produite par la machine est marquée : l'utilisateur sait ce qu'il n'a pas tapé. */
  origine: "taxe" | "equilibre" | null;
  codeTaxe: string | null;
}

interface Retour {
  ton: "succes" | "erreur" | "info";
  texte: string;
}

const LIBELLES_ETAT: Record<Lot["etat"], string> = {
  ouvert: "En saisie",
  pret: "Prêt à comptabiliser",
  comptabilise: "Comptabilisé",
  "contre-passe": "Contre-passé"
};

const TONS_ETAT: Record<Lot["etat"], string> = {
  ouvert: "",
  pret: "info",
  comptabilise: "succes",
  "contre-passe": "alerte"
};

/** Préfixe de pièce par journal : ce que les cabinets écrivent sur la facture. */
const PREFIXES_PIECE: Record<string, string> = {
  ACH: "FA",
  VTE: "FV",
  BQ: "BQ",
  CAI: "CA",
  OD: "OD",
  SAL: "SAL",
  AN: "AN"
};

let compteurCle = 0;
function cleSuivante(): string {
  compteurCle += 1;
  return `L${compteurCle}`;
}

function ligneVide(libelle = ""): LigneSaisie {
  return {
    cle: cleSuivante(),
    compte: "",
    libelle,
    debit: "",
    credit: "",
    codesTaxe: [],
    echeance: "",
    origine: null,
    codeTaxe: null
  };
}

/**
 * Le brouillon survit à un changement d'écran.
 *
 * Un comptable qui passe vérifier un tiers dans le fichier des tiers ne doit pas retrouver sa
 * saisie effacée en revenant. Le brouillon est conservé par lot, en mémoire de session : il ne
 * quitte pas le navigateur et disparaît à la fermeture de l'onglet.
 */
const CLE_BROUILLON = "perfectys:saisie:brouillon";

interface Brouillon {
  lot: string;
  piece: string;
  date: DateCivile;
  libelle: string;
  lignes: LigneSaisie[];
  compteEquilibre: string;
  codesChoisis: string[];
}

function lireBrouillon(): Brouillon | null {
  try {
    const brut = sessionStorage.getItem(CLE_BROUILLON);
    if (!brut) {
      return null;
    }
    const lu = JSON.parse(brut) as Brouillon;
    if (typeof lu.lot !== "string" || !Array.isArray(lu.lignes)) {
      return null;
    }
    return lu;
  } catch {
    return null;
  }
}

function ecrireBrouillon(brouillon: Brouillon): void {
  try {
    sessionStorage.setItem(CLE_BROUILLON, JSON.stringify(brouillon));
  } catch {
    // Un stockage de session indisponible ne doit jamais empêcher de saisir.
  }
}

function effacerBrouillon(): void {
  try {
    sessionStorage.removeItem(CLE_BROUILLON);
  } catch {
    // Idem.
  }
}

/** Un brouillon qui ne contient qu'une ligne vierge n'est pas une saisie entamée. */
function brouillonEntame(lignes: LigneSaisie[]): boolean {
  return lignes.some(
    (ligne) => ligne.compte.trim() !== "" || ligne.debit.trim() !== "" || ligne.credit.trim() !== ""
  );
}

export function Saisie(props: { onMutation: () => void }) {
  const service = getService();
  const paquet = service.paquetPays;
  const structure = service.referentiel.structure;
  const devise = paquet.devise;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => ({
      journaux: await service.journaux(),
      lots: await service.lots(),
      tiers: await service.listeTiers(),
      comptes: await service.planComptable(),
      codesTaxe: await service.codesTaxe()
    }),
    []
  );

  const [journalCode, setJournalCode] = useState("ACH");
  const [lotId, setLotId] = useState<string | null>(null);
  const [dateLot, setDateLot] = useState<DateCivile>(new Date().toISOString().slice(0, 10));
  const [libelleLot, setLibelleLot] = useState("");
  const [codeSource, setCodeSource] = useState("SAISIE");

  const [piece, setPiece] = useState("");
  const [dateEcriture, setDateEcriture] = useState<DateCivile>(new Date().toISOString().slice(0, 10));
  const [libelleEcriture, setLibelleEcriture] = useState("");
  const [lignes, setLignes] = useState<LigneSaisie[]>([ligneVide()]);
  const [selection, setSelection] = useState(0);
  const [compteEquilibre, setCompteEquilibre] = useState("");
  const [codesChoisis, setCodesChoisis] = useState<string[]>([]);
  const [exportation, setExportation] = useState(false);
  const [retour, setRetour] = useState<Retour | null>(null);
  const [occupé, setOccupé] = useState(false);
  const [focusDemandé, setFocusDemandé] = useState<{ cle: string; colonne: string } | null>(null);

  const tableRef = useRef<HTMLTableElement>(null);

  const journal = donnees?.journaux.find((item) => item.code === journalCode) ?? null;
  const lotsDuJournal = (donnees?.lots ?? []).filter((lot) => lot.journalCode === journalCode);
  const lotsOuverts = lotsDuJournal.filter((lot) => lot.etat === "ouvert");
  const lotCourant = lotsDuJournal.find((lot) => lot.id === lotId) ?? null;
  const tiersActifs = (donnees?.tiers ?? []).filter((tiers) => tiers.actif);
  const comptesSaisissables = (donnees?.comptes ?? []).filter((compte) => compte.autoriseSaisie);

  /* ---------------------------------------------------------------- */
  /* Synchronisations                                                  */
  /* ---------------------------------------------------------------- */

  // Changer de journal propose le premier lot ouvert : on ne saisit jamais sans lot.
  useEffect(() => {
    if (!donnees) {
      return;
    }
    const ouverts = donnees.lots.filter((lot) => lot.journalCode === journalCode && lot.etat === "ouvert");
    setLotId((courant) => {
      const conserve = donnees.lots.find((lot) => lot.id === courant && lot.journalCode === journalCode);
      return conserve ? conserve.id : (ouverts[0]?.id ?? null);
    });
  }, [donnees, journalCode]);

  // L'en-tête suit le lot sélectionné ; un brouillon entamé sur ce lot est repris, sinon la
  // pièce en cours est réinitialisée.
  useEffect(() => {
    if (!lotCourant) {
      return;
    }
    setDateLot(lotCourant.date);
    setLibelleLot(lotCourant.libelle);
    setCodeSource(lotCourant.codeSource);
    setExportation(false);
    setSelection(0);

    const repris = lireBrouillon();
    if (repris && repris.lot === lotCourant.id && brouillonEntame(repris.lignes)) {
      setPiece(repris.piece);
      setDateEcriture(repris.date);
      setLibelleEcriture(repris.libelle);
      setLignes(repris.lignes);
      setCompteEquilibre(repris.compteEquilibre);
      setCodesChoisis(repris.codesChoisis);
      setRetour({
        ton: "info",
        texte: `Saisie en cours reprise sur le lot ${lotCourant.numero} (${repris.lignes.length} ligne${
          repris.lignes.length > 1 ? "s" : ""
        }).`
      });
      return;
    }
    setDateEcriture(lotCourant.date);
    setPiece(suggestionPiece(lotCourant));
    setLibelleEcriture(lotCourant.libelle);
    setLignes([ligneVide()]);
    setCodesChoisis([]);
    setCompteEquilibre(compteDEquilibrageAttendu(lotCourant));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotCourant?.id]);

  // Le brouillon est conservé tant qu'une saisie est entamée. Il n'est effacé qu'après un
  // enregistrement réussi ou une remise à zéro demandée : un remontage de l'écran ne doit pas
  // supprimer une saisie en cours avant de l'avoir relue.
  useEffect(() => {
    if (!lotCourant || !brouillonEntame(lignes)) {
      return;
    }
    ecrireBrouillon({
      lot: lotCourant.id,
      piece,
      date: dateEcriture,
      libelle: libelleEcriture,
      lignes,
      compteEquilibre,
      codesChoisis
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lotCourant?.id, piece, dateEcriture, libelleEcriture, lignes, compteEquilibre, codesChoisis]);

  // La ligne sélectionnée impose les codes cochés du panneau de taxe.
  useEffect(() => {
    setCodesChoisis(lignes[selection]?.codesTaxe ?? []);
  }, [selection, lignes]);

  useEffect(() => {
    if (!focusDemandé) {
      return;
    }
    const cellule = tableRef.current?.querySelector<HTMLElement>(
      `[data-cle="${focusDemandé.cle}"] [data-colonne="${focusDemandé.colonne}"]`
    );
    cellule?.focus();
    if (cellule instanceof HTMLInputElement) {
      cellule.select();
    }
    setFocusDemandé(null);
  }, [focusDemandé, lignes]);

  /* ---------------------------------------------------------------- */
  /* Lectures de la saisie                                             */
  /* ---------------------------------------------------------------- */

  function lire(texte: string): Montant | null {
    if (texte.trim() === "") {
      return ZERO;
    }
    try {
      return analyserMontant(texte, devise);
    } catch {
      return null;
    }
  }

  function auxiliaireDe(compte: string): string | null {
    try {
      return decouperNumero(compte, structure).auxiliaire;
    } catch {
      return null;
    }
  }

  function principalDe(compte: string): string {
    try {
      return decouperNumero(compte, structure).comptePrincipal;
    } catch {
      return compte.trim().toUpperCase();
    }
  }

  const totaux = lignes.reduce(
    (cumul, ligne) => {
      const debit = lire(ligne.debit);
      const credit = lire(ligne.credit);
      return {
        debit: cumul.debit + (debit ?? ZERO),
        credit: cumul.credit + (credit ?? ZERO),
        illisible: cumul.illisible || debit === null || credit === null
      };
    },
    { debit: ZERO, credit: ZERO, illisible: false }
  );
  const ecart = totaux.debit - totaux.credit;

  /** Le tiers qui porte l'opération : celui de la ligne sélectionnée, sinon le premier trouvé. */
  const tiersOperation: Tiers | null = (() => {
    const codes = [lignes[selection]?.compte, ...lignes.map((ligne) => ligne.compte)];
    for (const compte of codes) {
      const auxiliaire = compte ? auxiliaireDe(compte) : null;
      const trouve = auxiliaire ? (donnees?.tiers ?? []).find((tiers) => tiers.code === auxiliaire) : null;
      if (trouve) {
        return trouve;
      }
    }
    return null;
  })();

  const codesProposes: CodeTaxe[] =
    journal && (journal.nature === "achats" || journal.nature === "ventes")
      ? codesTaxeApplicables(donnees?.codesTaxe ?? [], {
          operation: journal.nature === "ventes" ? "vente" : "achat",
          tiersImmatricule: tiersOperation?.immatricule ?? true,
          tiersPublic: tiersOperation?.type === "etat",
          exportation
        })
      : [];

  const taxesPossibles = journal !== null && (journal.nature === "achats" || journal.nature === "ventes");

  /* ---------------------------------------------------------------- */
  /* Édition du brouillon                                              */
  /* ---------------------------------------------------------------- */

  function majLigne(cle: string, correctif: Partial<LigneSaisie>): void {
    setLignes((courant) => courant.map((ligne) => (ligne.cle === cle ? { ...ligne, ...correctif } : ligne)));
  }

  function ajouterLigne(colonne = "compte"): void {
    const nouvelle = ligneVide(libelleEcriture);
    setLignes((courant) => [...courant, nouvelle]);
    setSelection(lignes.length);
    setFocusDemandé({ cle: nouvelle.cle, colonne });
  }

  function retirerLigne(cle: string): void {
    setLignes((courant) => {
      const restant = courant.filter((ligne) => ligne.cle !== cle);
      return restant.length === 0 ? [ligneVide()] : restant;
    });
    setSelection(0);
  }

  /** Choisir un tiers réécrit le compte segmenté : le tiers se lit dans le numéro, jamais ailleurs. */
  function choisirTiers(cle: string, code: string): void {
    const ligne = lignes.find((item) => item.cle === cle);
    if (!ligne) {
      return;
    }
    const principal = principalDe(ligne.compte);
    if (principal === "") {
      setRetour({ ton: "erreur", texte: "Saisissez d'abord le compte, puis le tiers." });
      return;
    }
    majLigne(cle, { compte: code === "" ? principal : composerNumero(principal, structure, code) });
  }

  /** Le libellé d'un compte connu pré-remplit une ligne sans libellé : une saisie de moins. */
  function completerLibelle(cle: string): void {
    const ligne = lignes.find((item) => item.cle === cle);
    if (!ligne || ligne.libelle.trim() !== "") {
      return;
    }
    const principal = principalDe(ligne.compte);
    const compte = comptesSaisissables.find((item) => item.comptePrincipal === principal);
    if (compte) {
      majLigne(cle, { libelle: compte.libelle });
    }
  }

  function genererTaxes(): void {
    const ligne = lignes[selection];
    if (!ligne) {
      return;
    }
    const debit = lire(ligne.debit);
    const credit = lire(ligne.credit);
    if (debit === null || credit === null) {
      setRetour({ ton: "erreur", texte: "Le montant de la ligne sélectionnée est illisible." });
      return;
    }
    if (estNul(debit) && estNul(credit)) {
      setRetour({ ton: "erreur", texte: "Saisissez un montant sur la ligne avant de générer les taxes." });
      return;
    }
    if (codesChoisis.length === 0) {
      setLignes((courant) => courant.filter((item) => item.origine !== "taxe"));
      majLigne(ligne.cle, { codesTaxe: [] });
      setRetour({ ton: "info", texte: "Aucun code coché : les lignes de taxe ont été retirées." });
      return;
    }

    let proposees;
    try {
      proposees = proposerLignesDeTaxe(
        { compte: ligne.compte, libelle: ligne.libelle, debit, credit, codesTaxe: codesChoisis },
        paquet.codesTaxe
      );
    } catch (probleme) {
      setRetour({ ton: "erreur", texte: message(probleme) });
      return;
    }

    const nouvelles = proposees.map((item) => ({
      cle: cleSuivante(),
      compte: item.compte,
      libelle: item.libelle,
      debit: estNul(item.debit) ? "" : formatLocal(item.debit),
      credit: estNul(item.credit) ? "" : formatLocal(item.credit),
      codesTaxe: [] as string[],
      echeance: "",
      origine: "taxe" as const,
      codeTaxe: item.codeTaxe
    }));

    // Les lignes de taxe suivent les codes cochés : on remplace, on n'empile pas.
    setLignes((courant) => [
      ...courant.filter((item) => item.cle === ligne.cle || item.origine !== "taxe"),
      ...nouvelles
    ].map((item) => (item.cle === ligne.cle ? { ...item, codesTaxe: [...codesChoisis] } : item)));

    if (nouvelles.length === 0) {
      setRetour({
        ton: "info",
        texte:
          "Ces codes ne produisent aucune ligne dans cette écriture : taux nul, ou taxe constatée " +
          "par une écriture propre (la taxe pour le développement du sport, par exemple)."
      });
      return;
    }
    setRetour({
      ton: "succes",
      texte: `${nouvelles.length} ligne${nouvelles.length > 1 ? "s" : ""} de taxe générée${
        nouvelles.length > 1 ? "s" : ""
      } : ${nouvelles.map((item) => `${item.compte} ${item.debit !== "" ? "débit" : "crédit"} ${item.debit || item.credit}`).join(" · ")}.`
    });
  }

  function equilibrer(): void {
    if (totaux.illisible) {
      setRetour({ ton: "erreur", texte: "Un montant est illisible : corrigez-le avant d'équilibrer." });
      return;
    }
    if (estNul(ecart)) {
      setRetour({ ton: "info", texte: "L'écriture est déjà équilibrée." });
      return;
    }
    const compte = compteEquilibre.trim().toUpperCase();
    if (compte === "") {
      setRetour({ ton: "erreur", texte: "Indiquez le compte de contrepartie avant d'équilibrer." });
      return;
    }
    const manqueCredit = ecart > ZERO;
    const ligneEquilibre: LigneSaisie = {
      cle: cleSuivante(),
      compte,
      libelle: libelleEcriture.trim() === "" ? "Contrepartie" : libelleEcriture.trim(),
      debit: manqueCredit ? "" : formatLocal(oppose(ecart)),
      credit: manqueCredit ? formatLocal(ecart) : "",
      codesTaxe: [],
      echeance: "",
      origine: "equilibre",
      codeTaxe: null
    };
    setLignes((courant) => [...courant.filter((item) => item.origine !== "equilibre"), ligneEquilibre]);

    // Le tiers de l'opération, s'il est connu, complète le compte segmenté : une contrepartie sur
    // 401100 sans fournisseur serait refusée par le noyau.
    const principal = principalDe(compte);
    const exigeTiers = comptesSaisissables.some((item) => item.comptePrincipal === principal && item.exigeTiers);
    if (exigeTiers && tiersOperation) {
      majLigne(ligneEquilibre.cle, { compte: composerNumero(principal, structure, tiersOperation.code) });
    }

    setRetour({
      ton: exigeTiers && !tiersOperation ? "info" : "succes",
      texte:
        `Contrepartie de ${montant(ecart < ZERO ? oppose(ecart) : ecart)} portée sur ${compte}.` +
        (exigeTiers && !tiersOperation
          ? " Ce compte est un compte auxiliaire : choisissez le tiers sur la ligne générée, sinon l'enregistrement sera refusé."
          : "")
    });
  }

  function formatLocal(valeur: Montant): string {
    return valeur.toString();
  }

  /* ---------------------------------------------------------------- */
  /* Clavier                                                           */
  /* ---------------------------------------------------------------- */

  function naviguer(evenement: KeyboardEvent): void {
    const cible = evenement.target as HTMLElement | null;
    const rang = cible?.closest("tr") as HTMLElement | null;
    const cle = rang?.dataset.cle;
    const colonne = cible?.dataset.colonne;
    if (!cle || !colonne) {
      return;
    }
    const index = lignes.findIndex((ligne) => ligne.cle === cle);
    if (index < 0) {
      return;
    }

    if (evenement.key === "Enter") {
      evenement.preventDefault();
      if (evenement.ctrlKey || evenement.metaKey) {
        void enregistrerEcriture();
        return;
      }
      const suivant = index + 1;
      if (suivant < lignes.length) {
        setSelection(suivant);
        setFocusDemandé({ cle: lignes[suivant]!.cle, colonne });
      } else {
        ajouterLigne(colonne === "debit" || colonne === "credit" ? "compte" : colonne);
      }
      return;
    }
    if (evenement.key === "ArrowDown" || evenement.key === "ArrowUp") {
      const suivant = evenement.key === "ArrowDown" ? index + 1 : index - 1;
      if (suivant >= 0 && suivant < lignes.length) {
        evenement.preventDefault();
        setSelection(suivant);
        setFocusDemandé({ cle: lignes[suivant]!.cle, colonne });
      } else if (evenement.key === "ArrowDown") {
        evenement.preventDefault();
        ajouterLigne("compte");
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Appels au noyau                                                   */
  /* ---------------------------------------------------------------- */

  async function agir(operation: () => Promise<void>, succes?: string): Promise<void> {
    if (occupé) {
      return;
    }
    setOccupé(true);
    try {
      await operation();
      if (succes) {
        setRetour({ ton: "succes", texte: succes });
      }
      recharger();
      props.onMutation();
    } catch (probleme) {
      setRetour({ ton: "erreur", texte: message(probleme) });
    } finally {
      setOccupé(false);
    }
  }

  function ouvrirLot(): void {
    void agir(
      async () => {
        const libelle = libelleLot.trim() === "" ? `Lot ${journal?.code ?? journalCode}` : libelleLot.trim();
        const lot = await service.creerLot({
          journalCode,
          date: dateLot,
          libelle,
          codeSource
        });
        setLotId(lot.id);
      },
      "Lot ouvert : vous pouvez saisir."
    );
  }

  function enregistrerEnTete(): void {
    if (!lotCourant) {
      return;
    }
    void agir(
      () => service.modifierLot(lotCourant.id, { date: dateLot, libelle: libelleLot, codeSource }).then(() => undefined),
      "En-tête du lot enregistré."
    );
  }

  async function enregistrerEcriture(): Promise<void> {
    if (!lotCourant) {
      setRetour({ ton: "erreur", texte: "Ouvrez ou sélectionnez un lot avant de saisir une écriture." });
      return;
    }
    if (lotCourant.etat !== "ouvert") {
      setRetour({
        ton: "erreur",
        texte: `Le lot ${lotCourant.numero} est ${LIBELLES_ETAT[lotCourant.etat].toLowerCase()} : il ne reçoit plus de saisie.`
      });
      return;
    }

    const demandes: DemandeLigne[] = [];
    for (const [index, ligne] of lignes.entries()) {
      if (ligne.compte.trim() === "" && ligne.debit.trim() === "" && ligne.credit.trim() === "") {
        continue; // une ligne vierge n'est pas une erreur : elle est ignorée
      }
      const debit = lire(ligne.debit);
      const credit = lire(ligne.credit);
      if (debit === null || credit === null) {
        setRetour({ ton: "erreur", texte: `Ligne ${index + 1} : le montant est illisible.` });
        return;
      }
      if (estNul(debit) && estNul(credit)) {
        setRetour({ ton: "erreur", texte: `Ligne ${index + 1} : saisissez un débit ou un crédit.` });
        return;
      }
      const demande: DemandeLigne = {
        compte: ligne.compte.trim().toUpperCase(),
        libelle: ligne.libelle.trim() === "" ? libelleEcriture.trim() : ligne.libelle.trim(),
        codesTaxe: ligne.codesTaxe
      };
      if (!estNul(debit)) {
        demande.debit = debit;
      }
      if (!estNul(credit)) {
        demande.credit = credit;
      }
      const auxiliaire = auxiliaireDe(demande.compte);
      if (auxiliaire) {
        demande.tiersCode = auxiliaire;
      }
      if (ligne.echeance !== "") {
        demande.echeance = ligne.echeance as DateCivile;
      }
      demandes.push(demande);
    }

    if (demandes.length === 0) {
      setRetour({ ton: "erreur", texte: "Aucune ligne saisie : l'écriture serait vide." });
      return;
    }

    await agir(async () => {
      await service.ajouterEcriture(lotCourant.id, {
        piece: piece.trim(),
        date: dateEcriture,
        libelle: libelleEcriture.trim(),
        lignes: demandes
      });
      setLignes([ligneVide()]);
      setSelection(0);
      setCodesChoisis([]);
      effacerBrouillon();
    }, `Écriture ${piece.trim()} enregistrée dans le lot ${lotCourant.numero}.`);

    // La pièce suivante est proposée : la saisie enchaîne sans ressaisir le format.
    const lot = (await service.lots()).find((item) => item.id === lotCourant.id);
    if (lot) {
      setPiece(suggestionPiece(lot));
    }
  }

  function retirerEcriture(ecriture: Ecriture): void {
    if (!lotCourant) {
      return;
    }
    void agir(
      () => service.supprimerEcriture(lotCourant.id, ecriture.id).then(() => undefined),
      `Écriture ${ecriture.piece} retirée du lot.`
    );
  }

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Ouverture du journal et des lots…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const colonnesEcritures: Colonne<Ecriture>[] = [
    { cle: "piece", titre: "Pièce", valeur: (ecriture) => <span class="mono">{ecriture.piece}</span> },
    { cle: "numero", titre: "N° écriture", valeur: (ecriture) => <span class="mono">{ecriture.numero}</span> },
    { cle: "date", titre: "Date", valeur: (ecriture) => ecriture.date },
    { cle: "libelle", titre: "Libellé", valeur: (ecriture) => ecriture.libelle },
    {
      cle: "lignes",
      titre: "Lignes",
      alignement: "droite",
      valeur: (ecriture) => ecriture.lignes.length
    },
    {
      cle: "debit",
      titre: "Débit",
      alignement: "droite",
      valeur: (ecriture) => <span class="mono">{montant(totalDebit(ecriture.lignes))}</span>
    },
    {
      cle: "credit",
      titre: "Crédit",
      alignement: "droite",
      valeur: (ecriture) => <span class="mono">{montant(totalCredit(ecriture.lignes))}</span>
    },
    {
      cle: "taxes",
      titre: "Codes de taxe",
      valeur: (ecriture) =>
        ecriture.lignes.flatMap((ligne) => ligne.codesTaxe).length === 0
          ? "—"
          : [...new Set(ecriture.lignes.flatMap((ligne) => ligne.codesTaxe))].join(", ")
    },
    {
      cle: "etat",
      titre: "État",
      valeur: (ecriture) => <Etiquette ton={TONS_ETAT[lotCourant?.etat ?? "ouvert"]}>{ecriture.etat}</Etiquette>
    },
    {
      cle: "actions",
      titre: "",
      valeur: (ecriture) =>
        lotCourant?.etat === "ouvert" && ecriture.etat === "brouillon" ? (
          <button class="bouton petit" type="button" onClick={() => retirerEcriture(ecriture)}>
            Retirer
          </button>
        ) : (
          <span class="note-ligne">—</span>
        )
    }
  ];

  const totauxLot = lotCourant
    ? {
        debit: lotCourant.ecritures.reduce((cumul, ecriture) => cumul + totalDebit(ecriture.lignes), ZERO),
        credit: lotCourant.ecritures.reduce((cumul, ecriture) => cumul + totalCredit(ecriture.lignes), ZERO)
      }
    : null;

  const actionPrincipale =
    lotCourant?.etat === "pret"
      ? { libelle: "Comptabiliser le lot", executer: () => void agir(() => service.comptabiliserLot(lotCourant.id).then(() => undefined), `Lot ${lotCourant.numero} comptabilisé.`) }
      : { libelle: "Marquer prêt à comptabiliser", executer: () => void agir(() => service.marquerPret(lotCourant!.id).then(() => undefined), `Lot ${lotCourant!.numero} prêt à comptabiliser.`) };

  return (
    <Fenetre
      titre="Saisie des écritures"
      chemin={`Traitements › Saisie des écritures${journal ? ` › ${journal.code} ${journal.libelle}` : ""}`}
      sousTitre={
        lotCourant
          ? `Lot ${lotCourant.numero} · ${LIBELLES_ETAT[lotCourant.etat]} · ${lotCourant.ecritures.length} écriture${
              lotCourant.ecritures.length > 1 ? "s" : ""
            } · source ${lotCourant.codeSource}`
          : "Aucun lot sélectionné : ouvrez un lot, ou choisissez un lot en saisie dans la liste."
      }
      actions={
        <>
          <button class="bouton" type="button" onClick={() => recharger()} disabled={occupé}>
            Actualiser
          </button>
          {lotCourant && lotCourant.etat === "pret" ? (
            <button
              class="bouton"
              type="button"
              disabled={occupé}
              onClick={() =>
                void agir(() => service.rouvrirLot(lotCourant.id).then(() => undefined), `Lot ${lotCourant.numero} remis en saisie.`)
              }
            >
              Remettre en saisie
            </button>
          ) : null}
          {lotCourant && lotCourant.etat !== "comptabilise" && lotCourant.etat !== "contre-passe" ? (
            <button class="bouton primaire" type="button" disabled={occupé} onClick={actionPrincipale.executer}>
              {actionPrincipale.libelle}
            </button>
          ) : null}
          {lotCourant && lotCourant.etat === "ouvert" ? (
            <button
              class="bouton"
              type="button"
              disabled={occupé}
              onClick={() =>
                void agir(
                  async () => {
                    await service.supprimerLot(lotCourant.id);
                    setLotId(null);
                  },
                  `Lot ${lotCourant.numero} supprimé.`
                )
              }
            >
              Supprimer le lot
            </button>
          ) : null}
        </>
      }
    >
      {retour ? (
        <p class={`retour ${retour.ton}`} role={retour.ton === "erreur" ? "alert" : "status"}>
          {retour.texte}
        </p>
      ) : null}

      {/* ------------------------------------------------------------ */}
      {/* Lot de travail                                                */}
      {/* ------------------------------------------------------------ */}
      <div class="formulaire-ligne">
        <label>
          Journal
          <select value={journalCode} onChange={(evenement) => setJournalCode(evenement.currentTarget.value)}>
            {donnees.journaux.map((item: Journal) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lot
          <select value={lotId ?? ""} onChange={(evenement) => setLotId(evenement.currentTarget.value || null)}>
            <option value="">— aucun lot —</option>
            {lotsDuJournal.map((lot: Lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.numero} · {LIBELLES_ETAT[lot.etat]} · {lot.date}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date du lot
          <input type="date" value={dateLot} onChange={(evenement) => setDateLot(evenement.currentTarget.value as DateCivile)} />
        </label>
        <label class="large">
          Libellé du lot
          <input type="text" value={libelleLot} onInput={(evenement) => setLibelleLot(evenement.currentTarget.value)} />
        </label>
        <label>
          Code source
          <select value={codeSource} onChange={(evenement) => setCodeSource(evenement.currentTarget.value)}>
            {CODES_SOURCE.map((source) => (
              <option key={source.code} value={source.code}>
                {source.libelle}
              </option>
            ))}
          </select>
        </label>
        <div class="actions-ligne">
          <button class="bouton" type="button" disabled={occupé} onClick={ouvrirLot}>
            Ouvrir un lot
          </button>
          <button class="bouton" type="button" disabled={occupé || !lotCourant} onClick={enregistrerEnTete}>
            Enregistrer l'en-tête
          </button>
        </div>
      </div>

      {journal ? (
        <p class="note">
          Journal {journal.code} · {LIBELLES_NATURE_JOURNAL[journal.nature]} ·{" "}
          {journal.compteContrepartie
            ? `contrepartie automatique ${journal.compteContrepartie}`
            : "pas de compte de contrepartie automatique"}{" "}
          · {lotsOuverts.length} lot{lotsOuverts.length > 1 ? "s" : ""} en saisie
        </p>
      ) : null}

      {!lotCourant ? (
        <Vide>
          Sélectionnez un lot en saisie, ou ouvrez-en un. Chez Sage comme ici, on ne saisit jamais une
          pièce isolée : elle entre dans un lot, qui sera comptabilisé d'un seul mouvement.
        </Vide>
      ) : (
        <>
          <div class="deux-colonnes">
            {/* -------------------------------------------------------- */}
            {/* Écriture en cours                                         */}
            {/* -------------------------------------------------------- */}
            <div class="bloc">
              <h2>Écriture en cours — lot {lotCourant.numero}</h2>
              <div class="formulaire-ligne">
                <label>
                  Pièce
                  <input
                    type="text"
                    value={piece}
                    onInput={(evenement) => setPiece(evenement.currentTarget.value)}
                    placeholder="FA-2026-001"
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    value={dateEcriture}
                    onChange={(evenement) => setDateEcriture(evenement.currentTarget.value as DateCivile)}
                  />
                </label>
                <label class="large">
                  Libellé de l'écriture
                  <input
                    type="text"
                    value={libelleEcriture}
                    onInput={(evenement) => setLibelleEcriture(evenement.currentTarget.value)}
                  />
                </label>
              </div>

              <table class="grille grille-saisie" ref={tableRef} onKeyDown={naviguer}>
                <thead>
                  <tr>
                    <th style={{ width: "9rem" }}>Compte</th>
                    <th style={{ width: "8rem" }}>Tiers</th>
                    <th>Libellé</th>
                    <th style={{ width: "7rem" }}>Codes taxe</th>
                    <th class="align-droite" style={{ width: "8rem" }}>
                      Débit
                    </th>
                    <th class="align-droite" style={{ width: "8rem" }}>
                      Crédit
                    </th>
                    <th style={{ width: "8rem" }}>Échéance</th>
                    <th style={{ width: "2rem" }} />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne, index) => {
                    const auxiliaire = auxiliaireDe(ligne.compte);
                    const debit = lire(ligne.debit);
                    const credit = lire(ligne.credit);
                    const illisible = debit === null || credit === null;
                    return (
                      <tr
                        key={ligne.cle}
                        data-cle={ligne.cle}
                        class={`${index === selection ? "selection" : ""} ${ligne.origine ? "generee" : ""}`}
                        onFocus={() => setSelection(index)}
                      >
                        <td>
                          <input
                            data-colonne="compte"
                            class="mono"
                            list="comptes-saisissables"
                            value={ligne.compte}
                            onInput={(evenement) => majLigne(ligne.cle, { compte: evenement.currentTarget.value.toUpperCase() })}
                            onBlur={() => completerLibelle(ligne.cle)}
                            aria-label={`Compte, ligne ${index + 1}`}
                          />
                        </td>
                        <td>
                          <select
                            data-colonne="tiers"
                            value={auxiliaire ?? ""}
                            onChange={(evenement) => choisirTiers(ligne.cle, evenement.currentTarget.value)}
                            aria-label={`Tiers, ligne ${index + 1}`}
                          >
                            <option value="">—</option>
                            {tiersActifs.map((tiers: Tiers) => (
                              <option key={tiers.code} value={tiers.code}>
                                {tiers.code} — {tiers.nom}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            data-colonne="libelle"
                            value={ligne.libelle}
                            onInput={(evenement) => majLigne(ligne.cle, { libelle: evenement.currentTarget.value })}
                            aria-label={`Libellé, ligne ${index + 1}`}
                          />
                        </td>
                        <td>
                          <button
                            class="bouton petit"
                            type="button"
                            data-colonne="taxe"
                            aria-label={`Codes taxe, ligne ${index + 1}`}
                            disabled={!taxesPossibles}
                            title={
                              taxesPossibles
                                ? "Choisir les codes de taxe de cette ligne"
                                : "Les codes de taxe s'appliquent aux journaux d'achats et de ventes"
                            }
                            onClick={() => {
                              setSelection(index);
                              document.getElementById("panneau-taxe")?.scrollIntoView({ block: "nearest" });
                            }}
                          >
                            {ligne.codesTaxe.length === 0 ? "Taxe…" : ligne.codesTaxe.join(", ")}
                          </button>
                        </td>
                        <td>
                          <input
                            data-colonne="debit"
                            class={`align-droite mono ${illisible ? "illisible" : ""}`}
                            value={ligne.debit}
                            onInput={(evenement) => majLigne(ligne.cle, { debit: evenement.currentTarget.value })}
                            aria-label={`Débit, ligne ${index + 1}`}
                          />
                        </td>
                        <td>
                          <input
                            data-colonne="credit"
                            class={`align-droite mono ${illisible ? "illisible" : ""}`}
                            value={ligne.credit}
                            onInput={(evenement) => majLigne(ligne.cle, { credit: evenement.currentTarget.value })}
                            aria-label={`Crédit, ligne ${index + 1}`}
                          />
                        </td>
                        <td>
                          <input
                            data-colonne="echeance"
                            type="date"
                            value={ligne.echeance}
                            onChange={(evenement) => majLigne(ligne.cle, { echeance: evenement.currentTarget.value })}
                            aria-label={`Échéance, ligne ${index + 1}`}
                          />
                        </td>
                        <td>
                          <button
                            class="bouton petit"
                            type="button"
                            title="Retirer la ligne"
                            aria-label={`Retirer la ligne ${index + 1}`}
                            onClick={() => retirerLigne(ligne.cle)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4}>Totaux de l'écriture en cours</th>
                    <td class="align-droite mono">{montant(totaux.debit)}</td>
                    <td class="align-droite mono">{montant(totaux.credit)}</td>
                    <td colSpan={2}>
                      {totaux.illisible ? (
                        <span class="erreur-texte">montant illisible</span>
                      ) : estNul(ecart) ? (
                        <span class="succes-texte">équilibrée</span>
                      ) : (
                        <span class="erreur-texte">écart {montant(ecart)}</span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <datalist id="comptes-saisissables">
                {comptesSaisissables.map((compte) => (
                  <option key={compte.numero} value={compte.numero}>
                    {compte.libelle}
                  </option>
                ))}
              </datalist>

              <div class="formulaire-ligne">
                <div class="actions-ligne">
                  <button class="bouton" type="button" onClick={() => ajouterLigne("compte")}>
                    Nouvelle ligne
                  </button>
                  <button
                    class="bouton"
                    type="button"
                    disabled={lignes.length <= 1}
                    onClick={() => retirerLigne(lignes[selection]?.cle ?? "")}
                  >
                    Retirer la ligne
                  </button>
                </div>
                <label>
                  Compte de contrepartie
                  <input
                    type="text"
                    class="mono"
                    list="comptes-saisissables"
                    value={compteEquilibre}
                    onInput={(evenement) => setCompteEquilibre(evenement.currentTarget.value.toUpperCase())}
                  />
                </label>
                <button class="bouton" type="button" onClick={equilibrer} disabled={estNul(ecart)}>
                  Équilibrer
                </button>
                <button
                  class="bouton"
                  type="button"
                  onClick={() => {
                    setLignes([ligneVide()]);
                    setCodesChoisis([]);
                    effacerBrouillon();
                    setRetour({ ton: "info", texte: "Saisie en cours vidée." });
                  }}
                >
                  Vider la saisie
                </button>
                <button
                  class="bouton primaire"
                  type="button"
                  disabled={occupé}
                  onClick={() => void enregistrerEcriture()}
                >
                  Enregistrer l'écriture
                </button>
              </div>
              <p class="note">
                ↑ ↓ pour changer de ligne · Entrée pour passer à la ligne suivante (une ligne est
                ajoutée en bas de table) · Ctrl+Entrée pour enregistrer l'écriture · le compte peut
                être segmenté ({`401100-FOU01`}), le tiers se lit dans le numéro.
              </p>
            </div>

            {/* -------------------------------------------------------- */}
            {/* Codes de taxe                                             */}
            {/* -------------------------------------------------------- */}
            <div class="bloc" id="panneau-taxe">
              <h2>Codes de taxe — ligne {selection + 1}</h2>
              {!taxesPossibles ? (
                <p class="note">
                  Le journal {journal?.code ?? ""} n'est ni un journal d'achats ni un journal de
                  ventes : les codes de taxe du paquet pays ne s'y appliquent pas. Saisissez les
                  lignes de taxe vous-même si l'opération en comporte.
                </p>
              ) : (
                <>
                  <p class="note">
                    Opération : {journal?.nature === "ventes" ? "vente" : "achat"} ·{" "}
                    {tiersOperation
                      ? `tiers ${tiersOperation.code} ${tiersOperation.nom}${
                          tiersOperation.immatricule ? ", immatriculé à l'IFU" : ", non immatriculé à l'IFU"
                        }`
                      : "aucun tiers identifié : la retenue majorée ne peut pas être proposée"}
                  </p>
                  <label class="recherche">
                    <input
                      type="checkbox"
                      checked={exportation}
                      onChange={(evenement) => setExportation(evenement.currentTarget.checked)}
                    />
                    Opération à l'exportation
                  </label>
                  <ul class="liste-codes codes-choix">
                    {codesProposes.map((code: CodeTaxe) => (
                      <li key={code.code}>
                        <label>
                          <input
                            type="checkbox"
                            checked={codesChoisis.includes(code.code)}
                            onChange={(evenement) =>
                              setCodesChoisis((courant) =>
                                evenement.currentTarget.checked
                                  ? [...courant.filter((item) => item !== code.code), code.code]
                                  : courant.filter((item) => item !== code.code)
                              )
                            }
                          />
                          <span>
                            <strong>{code.code}</strong> — {code.libelle}
                            {code.aVerifier ? <em class="note"> · paramètre à confirmer</em> : null}
                          </span>
                        </label>
                        <span class="taux mono">{code.compteTaxe}</span>
                      </li>
                    ))}
                  </ul>
                  <div class="actions-ligne">
                    <button class="bouton primaire" type="button" onClick={genererTaxes}>
                      Générer les lignes de taxe
                    </button>
                    <button class="bouton" type="button" onClick={() => setCodesChoisis([])}>
                      Tout décocher
                    </button>
                  </div>
                  <p class="note">
                    Les lignes générées apparaissent dans la grille, marquées comme telles, et
                    restent modifiables. Le noyau n'ajoute jamais une taxe en silence : ce qui sera
                    comptabilisé est ce que vous voyez.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------------- */}
          {/* Écritures du lot                                            */}
          {/* ---------------------------------------------------------- */}
          <div class="bloc">
            <h2>
              Écritures du lot {lotCourant.numero} — {lotCourant.ecritures.length}
            </h2>
            <Grille
              colonnes={colonnesEcritures}
              lignes={lotCourant.ecritures}
              cleDe={(ecriture) => ecriture.id}
              vide="Aucune écriture dans ce lot : saisissez la première ci-dessus."
              pied={
                totauxLot ? (
                  <tr>
                    <th colSpan={5}>Totaux du lot</th>
                    <td class="align-droite mono">{montant(totauxLot.debit)}</td>
                    <td class="align-droite mono">{montant(totauxLot.credit)}</td>
                    <td colSpan={3}>
                      {estNul(totauxLot.debit - totauxLot.credit) ? "équilibré" : "déséquilibré"}
                    </td>
                  </tr>
                ) : null
              }
            />
          </div>
          <p class="note">
            Une écriture enregistrée ne se modifie plus ici : pour la corriger, retirez-la tant que
            le lot est en saisie, ou contre-passez le lot une fois comptabilisé
            (Traitements › Lots et comptabilisation).
          </p>
        </>
      )}
    </Fenetre>
  );
}

/**
 * Propose la pièce suivante du lot.
 *
 * La pièce est une référence métier (numéro de facture, de relevé…), pas un identifiant technique :
 * elle est proposée pour éviter la ressaisie du format, jamais imposée.
 */
function suggestionPiece(lot: Lot): string {
  const prefixe = PREFIXES_PIECE[lot.journalCode] ?? lot.journalCode;
  const annee = lot.date.slice(0, 4);
  const rang = (lot.ecritures.length + 1).toString().padStart(3, "0");
  return `${prefixe}-${annee}-${rang}`;
}

/**
 * Compte de contrepartie attendu, selon le journal.
 *
 * Proposé, jamais forcé : un journal de banque contrepartie en trésorerie, un journal d'achats
 * contrepartie chez le fournisseur de la première ligne.
 */
function compteDEquilibrageAttendu(lot: Lot): string {
  switch (lot.journalCode) {
    case "ACH":
      return "401100";
    case "VTE":
      return "411100";
    case "BQ":
      return "521100";
    case "CAI":
      return "571100";
    case "SAL":
      return "421000";
    default:
      return "";
  }
}
