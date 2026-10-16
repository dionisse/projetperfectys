/**
 * Rapprochement bancaire — Traitements › Rapprochement bancaire.
 *
 * L'écran met face à face deux documents qui décrivent la même caisse sans se connaître : le compte de
 * trésorerie tel que la comptabilité le tient, et le relevé tel que la banque le donne. Il montre les
 * soldes, l'écart, et surtout **ce que l'écart ne s'explique pas** — parce qu'un rapprochement qui
 * absorbe une différence ne sert à rien.
 *
 * Le relevé se saisit ligne à ligne, ou **s'importe du fichier que la banque donne**. Le contenant
 * varie d'une banque à l'autre — CSV, OFX/QFX, CAMT.053, classeur Excel, PDF imprimé — mais ce qu'on y
 * cherche est toujours la même chose : une date, une référence, un libellé, un montant, un solde. Les
 * trois premiers se lisent comme du texte ; le classeur et le PDF sont d'abord remis en grille de
 * cellules par `web/lecture-fichier`, puis lus par le même lecteur que le CSV. L'import suit la même
 * discipline que le pointage : le fichier est lu, ce que le lecteur a reconnu est montré — colonnes
 * mappées, opérations lues, lignes déjà vues —, et rien n'est écrit avant que l'utilisateur ait validé.
 * Un relevé d'exemple, tiré du grand livre du dossier, permet d'essayer l'import sans fichier sous la
 * main.
 *
 * Le pointage n'écrit aucune écriture : il rapproche des mouvements déjà comptabilisés avec des lignes
 * déjà reçues. Quand la banque a prélevé des frais que la comptabilité n'a pas passés, le bouton de
 * pointage reste grisé et dit pourquoi : la différence se comptabilise d'abord.
 */

import { useState } from "preact/hooks";

/** Le contenant d'un relevé d'exemple : les trois qu'une banque donne vraiment. */
type ContenantDExemple = "csv" | "xlsx" | "pdf";
import {
  FORMATS_DE_RELEVE,
  NOM_DE_FORMAT,
  ZERO,
  comptePrincipalDe,
  exempleDeReleveCsv,
  formaterDateFr,
  oppose,
  type ApercuDImportDeReleve,
  type DateCivile,
  type ElementPointe,
  type EtatDeRapprochement,
  type FormatDeReleve,
  type LigneDeGrille,
  type LigneDeReleve,
  type Mouvement,
  type Pointage,
  type PropositionDePointage,
  type ReleveBancaire
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import { estFichierBinaire, lireFichierDeReleve } from "../../web/lecture-fichier";
import { classeurDExemple, documentDExemple } from "../../web/exemple-de-releve";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Vide,
  message,
  montant,
  useAsync,
  type CelluleCsv
} from "../composants";
import { Exporter } from "../exporter";

interface LigneDeBrouillon {
  date: string;
  reference: string;
  libelle: string;
  montant: string;
}

const ligneVide = (date: string): LigneDeBrouillon => ({ date, reference: "", libelle: "", montant: "" });

export function Rapprochement(props: { onMutation: () => void }) {
  const service = getService();
  const [releveChoisi, setReleveChoisi] = useState<string>("");
  const [lignesCochees, setLignesCochees] = useState<string[]>([]);
  const [mouvementsCoches, setMouvementsCoches] = useState<string[]>([]);
  const [horsPeriode, setHorsPeriode] = useState(false);
  const [propositions, setPropositions] = useState<PropositionDePointage[] | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  /** Le contenant d'un exemple en cours d'écriture : écrire un classeur ou un PDF prend une seconde. */
  const [exempleEnCours, setExempleEnCours] = useState<ContenantDExemple | null>(null);
  const [revision, setRevision] = useState(0);
  const [brouillon, setBrouillon] = useState<{
    compte: string;
    journalCode: string;
    libelle: string;
    dateDebut: string;
    dateFin: string;
    soldeDOuverture: string;
    lignes: LigneDeBrouillon[];
  } | null>(null);
  const [importation, setImportation] = useState<{
    compte: string;
    journalCode: string;
    libelle: string;
    /** Vide : le format est détecté depuis le contenu et le nom du fichier. */
    format: string;
    nomFichier: string;
    /** Le contenu en texte, pour un CSV, un OFX ou un CAMT. */
    texte: string;
    /** Le contenu mis en grille, pour un classeur Excel ou un PDF. L'un des deux, jamais les deux. */
    grille: LigneDeGrille[] | null;
    /** Ce que la lecture d'un fichier binaire a à dire : feuille retenue, pages, colonnes reconnues. */
    notes: string[];
    du: string;
    au: string;
    soldeDOuverture: string;
  } | null>(null);
  const [apercu, setApercu] = useState<ApercuDImportDeReleve | null>(null);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      const releves = await service.releves();
      const choisi = releves.find((releve) => releve.id === releveChoisi) ?? releves[0];
      if (!choisi) {
        return { contexte, releves, releve: null, etat: null, pointages: [] as Pointage[] };
      }
      const etat = await service.etatDeRapprochement(choisi.id);
      const dossier = await service.lire();
      return {
        contexte,
        releves,
        releve: choisi,
        etat,
        pointages: dossier.pointages.filter((pointage) => pointage.releveId === choisi.id)
      };
    },
    [releveChoisi, revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du relevé et du compte de trésorerie…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, releves, releve, etat } = donnees;

  const terminer = (texte: string): void => {
    setRetour({ ton: "succes", texte });
    setLignesCochees([]);
    setMouvementsCoches([]);
    setPropositions(null);
    setRevision((valeur) => valeur + 1);
    props.onMutation();
  };

  const echouer = (erreurInconnue: unknown): void => {
    setRetour({ ton: "erreur", texte: message(erreurInconnue) });
  };

  const basculerLigne = (id: string): void => {
    setRetour(null);
    setLignesCochees((precedent) =>
      precedent.includes(id) ? precedent.filter((item) => item !== id) : [...precedent, id]
    );
  };

  const basculerMouvement = (ligneId: string): void => {
    setRetour(null);
    setMouvementsCoches((precedent) =>
      precedent.includes(ligneId) ? precedent.filter((item) => item !== ligneId) : [...precedent, ligneId]
    );
  };

  /* ---------------------------------------------------------------- */
  /* Pointage                                                          */
  /* ---------------------------------------------------------------- */

  const ligneChoisie = etat?.lignesNonPointees.find((ligne) => lignesCochees.includes(ligne.id)) ?? null;
  const mouvementChoisi = etat?.mouvementsNonPointes.find((item) => mouvementsCoches.includes(item.ligneId)) ?? null;
  const montantDuMouvement = (mouvement: Mouvement): bigint =>
    mouvement.debit !== ZERO ? mouvement.debit : oppose(mouvement.credit);

  const raisonIndisponible = (() => {
    if (!ligneChoisie || !mouvementChoisi) {
      return "Cochez une ligne du relevé et un mouvement du compte : le pointage rapproche une ligne d'un mouvement.";
    }
    if (lignesCochees.length > 1 || mouvementsCoches.length > 1) {
      return "Le pointage rapproche une ligne d'un seul mouvement : ne cochez qu'une ligne et qu'un mouvement.";
    }
    if (montantDuMouvement(mouvementChoisi) !== ligneChoisie.montant) {
      return `Les montants diffèrent : ${montant(montantDuMouvement(mouvementChoisi))} côté compte, ${montant(
        ligneChoisie.montant
      )} côté relevé. Comptabilisez la différence, puis pointez.`;
    }
    return "";
  })();
  const pointable = raisonIndisponible === "";

  const pointer = async (): Promise<void> => {
    if (!releve || !ligneChoisie || !mouvementChoisi) {
      return;
    }
    try {
      await service.pointer({
        releveId: releve.id,
        paires: [{ ligne: ligneChoisie.id, mouvement: mouvementChoisi.ligneId }]
      });
      terminer(
        `Pointage créé : ${ligneChoisie.libelle} (${montant(ligneChoisie.montant)}) rapproché de la pièce ${
          mouvementChoisi.piece
        } du ${formaterDateFr(mouvementChoisi.date)}.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const proposer = async (): Promise<void> => {
    if (!releve) {
      return;
    }
    try {
      setRetour(null);
      const trouvees = await service.proposerPointage(releve.id, { horsPeriode });
      setPropositions(trouvees);
      setRetour(
        trouvees.length === 0
          ? {
              ton: "erreur",
              texte:
                "Aucun pointage proposé : le rapprochement automatique ne retient que les montants exactement égaux, par référence d'abord. Ce qui reste se pointe à la main, ou se comptabilise d'abord."
            }
          : {
              ton: "succes",
              texte: `${trouvees.length} pointage${trouvees.length > 1 ? "s" : ""} proposé${
                trouvees.length > 1 ? "s" : ""
              }. Rien n'est encore écrit : vérifiez, puis appliquez.`
            }
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const appliquer = async (): Promise<void> => {
    if (!releve) {
      return;
    }
    try {
      const { pointages } = await service.pointerAutomatiquement(releve.id, { horsPeriode });
      terminer(
        pointages.length === 0
          ? "Aucun pointage appliqué : il n'y avait rien à proposer."
          : `${pointages.length} pointage${pointages.length > 1 ? "s" : ""} appliqué${
              pointages.length > 1 ? "s" : ""
            }, ${montant(pointages.reduce((total, item) => total + item.montant, ZERO))} rapproché${
              pointages.length > 1 ? "s" : ""
            }.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const depointer = async (pointage: Pointage): Promise<void> => {
    try {
      await service.depointer(pointage.id);
      terminer(`Pointage ${pointage.id} défait : la ligne et le mouvement sont revenus à rapprocher.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const supprimer = async (cible: ReleveBancaire): Promise<void> => {
    try {
      await service.supprimerReleve(cible.id);
      setReleveChoisi("");
      terminer(`Relevé « ${cible.libelle} » supprimé.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Saisie d'un relevé                                                */
  /* ---------------------------------------------------------------- */

  const enregistrerReleve = async (): Promise<void> => {
    if (!brouillon) {
      return;
    }
    try {
      const cree = await service.ajouterReleve({
        compte: brouillon.compte,
        journalCode: brouillon.journalCode,
        libelle: brouillon.libelle,
        dateDebut: brouillon.dateDebut as DateCivile,
        dateFin: brouillon.dateFin as DateCivile,
        soldeDOuverture: brouillon.soldeDOuverture,
        lignes: brouillon.lignes
          .filter((ligne) => ligne.montant.trim() !== "" && ligne.libelle.trim() !== "")
          .map((ligne) => ({
            date: ligne.date as DateCivile,
            libelle: ligne.libelle,
            reference: ligne.reference,
            montant: ligne.montant
          }))
      });
      setBrouillon(null);
      setReleveChoisi(cree.id);
      terminer(`Relevé « ${cree.libelle} » saisi : ${cree.lignes.length} lignes, à rapprocher du compte ${cree.compte}.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Import d'un relevé depuis un fichier                              */
  /* ---------------------------------------------------------------- */

  const ouvrirImport = (): void => {
    setRetour(null);
    setApercu(null);
    setImportation({
      compte: releve?.compte ?? "521100",
      journalCode: releve?.journalCode ?? "BQ",
      libelle: "",
      format: "",
      nomFichier: "",
      texte: "",
      grille: null,
      notes: [],
      du: `${aujourdHui.slice(0, 8)}01`,
      au: aujourdHui,
      soldeDOuverture: ""
    });
  };

  /**
   * Prend le fichier choisi.
   *
   * Un classeur Excel ou un PDF n'a pas de texte à coller : il est mis en grille dès le chargement, et
   * ce que le lecteur en dit est montré. Un fichier texte est chargé tel quel. Dans les deux cas rien
   * n'est lu ni écrit avant « Lire le fichier ».
   */
  const choisirFichierDeReleve = async (fichier: File | null): Promise<void> => {
    if (!fichier) {
      return;
    }
    try {
      setApercu(null);
      if (estFichierBinaire(fichier.name)) {
        const lu = await lireFichierDeReleve(fichier.name, await fichier.arrayBuffer());
        setImportation((precedent) =>
          precedent === null
            ? null
            : { ...precedent, texte: "", grille: lu.grille, notes: lu.notes, nomFichier: fichier.name, format: lu.format }
        );
        setRetour({
          ton: "succes",
          texte: `« ${fichier.name} » chargé (${fichier.size} octets) : ${lu.grille.length} ligne${
            lu.grille.length > 1 ? "s" : ""
          } mise${lu.grille.length > 1 ? "s" : ""} en grille. Cliquez sur « Lire le fichier » : rien n'est écrit avant l'aperçu.`
        });
        return;
      }
      const texte = await fichier.text();
      setImportation((precedent) =>
        precedent === null
          ? null
          : { ...precedent, texte, grille: null, notes: [], nomFichier: fichier.name, format: precedent.format }
      );
      setRetour({
        ton: "succes",
        texte: `« ${fichier.name} » chargé (${fichier.size} octets). Cliquez sur « Lire le fichier » : rien n'est écrit avant l'aperçu.`
      });
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /** Le contenu à faire lire : la grille d'un fichier binaire, ou le texte collé ou chargé. */
  const contenuDImportation = (
    etat: { texte: string; grille: LigneDeGrille[] | null; notes: string[] }
  ): { texte?: string; grille?: readonly LigneDeGrille[]; notes?: readonly string[] } =>
    etat.grille === null ? { texte: etat.texte } : { grille: etat.grille, notes: etat.notes };

  const lireFichier = async (): Promise<void> => {
    if (!importation) {
      return;
    }
    try {
      setRetour(null);
      const lu = await service.apercuDImportDeReleve({
        compte: importation.compte,
        ...contenuDImportation(importation),
        nomFichier: importation.nomFichier === "" ? null : importation.nomFichier,
        ...(importation.format === "" ? {} : { format: importation.format as FormatDeReleve })
      });
      setApercu(lu);
      // Ce que le fichier dit et que le formulaire ne savait pas encore : la période et, quand la
      // banque le porte, le solde d'ouverture. Un solde déjà saisi n'est pas écrasé.
      setImportation((precedent) =>
        precedent === null
          ? null
          : {
              ...precedent,
              du: lu.importe.dateDebut ?? precedent.du,
              au: lu.importe.dateFin ?? precedent.au,
              soldeDOuverture:
                precedent.soldeDOuverture.trim() !== "" || lu.importe.soldeDOuverture === null
                  ? precedent.soldeDOuverture
                  : lu.importe.soldeDOuverture.toString()
            }
      );
      setRetour({
        ton: "succes",
        texte: `${lu.retenues.length} opération${lu.retenues.length > 1 ? "s" : ""} à importer au format ${
          NOM_DE_FORMAT[lu.importe.format]
        }${lu.doublons.length > 0 ? `, ${lu.doublons.length} déjà vue${lu.doublons.length > 1 ? "s" : ""} écartée${
          lu.doublons.length > 1 ? "s" : ""
        }` : ""}. Rien n'est écrit : vérifiez l'aperçu, puis créez le relevé.`
      });
    } catch (erreurInconnue) {
      setApercu(null);
      echouer(erreurInconnue);
    }
  };

  /** Le dernier jour du mois d'une date, et la veille d'une date : l'exemple se cale sur le dossier. */
  const dernierJourDuMois = (date: DateCivile): DateCivile =>
    new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10) as DateCivile;
  const veille = (date: DateCivile): DateCivile =>
    new Date(new Date(`${date}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10) as DateCivile;

  /**
   * Un relevé d'exemple, construit à partir du grand livre du dossier.
   *
   * Il rend l'import essayable sans fichier sous la main : les opérations que la comptabilité connaît,
   * plus deux frais que seule la banque a passés, pour que le rapprochement ait un écart à expliquer.
   *
   * Le contenant se choisit — texte séparé, classeur, page imprimée — parce que c'est lui qui change
   * tout d'une banque à l'autre. Un classeur et un PDF sont **écrits pour de vrai** puis relus par le
   * lecteur de l'application : le chemin est le même qu'avec un fichier de banque, et il est essayable
   * sans en avoir un.
   */
  const chargerExemple = async (contenant: ContenantDExemple = "csv"): Promise<void> => {
    try {
      setRetour(null);
      setExempleEnCours(contenant);
      const compte = importation?.compte ?? releve?.compte ?? "521100";
      const etat = await service.lire();
      const duCompte = etat.mouvements.filter(
        (mouvement) =>
          comptePrincipalDe(mouvement.compte) === compte &&
          (mouvement.debit !== ZERO || mouvement.credit !== ZERO)
      );
      if (duCompte.length === 0) {
        setRetour({
          ton: "erreur",
          texte: `Le compte ${compte} n'a aucun mouvement : il n'y a rien à mettre dans un relevé d'exemple.`
        });
        return;
      }
      const dates = duCompte.map((mouvement) => mouvement.date).sort();
      const du = `${dates[dates.length - 1]!.slice(0, 7)}-01` as DateCivile;
      const au = dernierJourDuMois(du);
      let soldeDOuverture = ZERO;
      try {
        soldeDOuverture = (await service.interrogerCompte(compte, { au: veille(du) })).soldeFinal;
      } catch {
        soldeDOuverture = ZERO;
      }
      const exemple = {
        compte,
        mouvements: etat.mouvements,
        du,
        au,
        soldeDOuverture,
        // Ce que la banque a passé et que la comptabilité n'a pas encore passé.
        separees: [
          { date: au, libelle: "FRAIS DE TENUE DE COMPTE", reference: "FRAIS-EX", montant: -BigInt(15000) },
          { date: au, libelle: "COMMISSION DE VIREMENT", reference: "COMM-EX", montant: -BigInt(7500) }
        ]
      };
      const formulaire = {
        compte,
        journalCode: importation?.journalCode ?? "BQ",
        libelle: `Relevé d'exemple — ${du.slice(0, 7)}`,
        du,
        au,
        soldeDOuverture: soldeDOuverture.toString()
      };
      const periode = `${du} – ${au}, construit à partir des mouvements du compte ${compte} et de deux frais bancaires`;

      if (contenant === "csv") {
        const texte = exempleDeReleveCsv({ ...exemple, devise: service.paquetPays.devise });
        setApercu(null);
        setImportation({
          ...formulaire,
          format: "csv",
          nomFichier: `exemple-releve-${compte}-${du.slice(0, 7)}.csv`,
          texte,
          grille: null,
          notes: []
        });
        setRetour({ ton: "succes", texte: `Relevé d'exemple chargé (texte séparé) : ${periode}. Cliquez sur « Lire le fichier ».` });
        return;
      }

      const nom = `exemple-releve-${compte}-${du.slice(0, 7)}.${contenant}`;
      const octets =
        contenant === "xlsx"
          ? await classeurDExemple(exemple)
          : await documentDExemple({ ...exemple, devise: service.paquetPays.devise });
      const lu = await lireFichierDeReleve(nom, octets);
      setApercu(null);
      setImportation({ ...formulaire, format: lu.format, nomFichier: nom, texte: "", grille: lu.grille, notes: lu.notes });
      setRetour({
        ton: "succes",
        texte: `Relevé d'exemple chargé (${NOM_DE_FORMAT[lu.format]}) : ${periode}. Un vrai fichier ${
          contenant === "xlsx" ? "classeur" : "PDF"
        } a été écrit, puis relu par l'application — ${lu.grille.length} lignes mises en grille. Cliquez sur « Lire le fichier ».`
      });
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    } finally {
      setExempleEnCours(null);
    }
  };

  const creerReleveImporte = async (): Promise<void> => {
    if (!importation) {
      return;
    }
    try {
      const cree = await service.importerReleve({
        compte: importation.compte,
        ...contenuDImportation(importation),
        nomFichier: importation.nomFichier === "" ? null : importation.nomFichier,
        ...(importation.format === "" ? {} : { format: importation.format as FormatDeReleve }),
        journalCode: importation.journalCode,
        ...(importation.libelle.trim() === "" ? {} : { libelle: importation.libelle.trim() }),
        du: importation.du as DateCivile,
        au: importation.au as DateCivile,
        ...(importation.soldeDOuverture.trim() === ""
          ? {}
          : { soldeDOuverture: importation.soldeDOuverture.trim() })
      });
      setImportation(null);
      setApercu(null);
      setReleveChoisi(cree.releve.id);
      terminer(
        `Relevé « ${cree.releve.libelle} » importé au format ${NOM_DE_FORMAT[cree.importe.format]} : ${
          cree.releve.lignes.length
        } opération${cree.releve.lignes.length > 1 ? "s" : ""}${
          cree.doublons.length > 0
            ? `, ${cree.doublons.length} déjà vue${cree.doublons.length > 1 ? "s" : ""} écartée${
                cree.doublons.length > 1 ? "s" : ""
              }`
            : ""
        }. Aucune écriture n'est passée : les frais que le relevé révèle se comptabilisent, puis se pointent.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  const lignesCsv = (): (readonly CelluleCsv[])[] => {
    if (!releve || !etat) {
      return [["Rapprochement bancaire"], ["Dossier", contexte.numero], [], ["Aucun relevé saisi."]];
    }
    // Un relevé importé cite son fichier dans l'export : la provenance fait partie de l'état.
    const source = releve.source;
    const provenance: (readonly CelluleCsv[])[] = source
      ? [
          [
            "Provenance",
            `${NOM_DE_FORMAT[source.format]}${source.nomFichier ? ` — ${source.nomFichier}` : ""}`,
            "Importé le",
            source.importeLe
          ],
          ...(source.compteBancaire ? [["Compte bancaire annoncé", source.compteBancaire]] : []),
          ...(source.doublonsEcartes > 0
            ? [["Opérations déjà vues, écartées à l'import", source.doublonsEcartes]]
            : [])
        ]
      : [];
    return [
      ["Rapprochement bancaire"],
      ["Dossier", contexte.numero],
      ["Société", contexte.societe.raisonSociale],
      ["Relevé", releve.libelle],
      ...provenance,
      ["Compte", etat.compte, "Journal", etat.journalCode],
      ["Période", `${formaterDateFr(releve.dateDebut)} – ${formaterDateFr(releve.dateFin)}`],
      [],
      ["Solde comptable à la fin du relevé", etat.soldeComptable],
      ["Solde du relevé", etat.soldeDuReleve],
      ["Écart", etat.ecart],
      ["Expliqué par les suspens de la période", etat.ecartExplique],
      ["Suspens des périodes antérieures", etat.ecartDOuverture],
      ["Reste inexpliqué", etat.ecartRestant],
      ["Rapprochement", etat.conforme ? "conforme" : "écart non expliqué"],
      [],
      ["Ligne du relevé", "Date", "Référence", "Libellé", "Montant (sens banque)", "Pointée avec"],
      ...releve.lignes.map((ligne) => {
        const pointe = etat.pointes.find((item) => item.ligneDeReleve === ligne.id);
        return [
          ligne.id,
          ligne.date,
          ligne.reference,
          ligne.libelle,
          ligne.montant,
          pointe ? `${pointe.piece} du ${formaterDateFr(pointe.date)}` : "non pointée"
        ];
      }),
      [],
      ["Mouvement non pointé", "Date", "Pièce", "Journal", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
      ...etat.mouvementsNonPointes.map((mouvement) => [
        mouvement.ligneId,
        mouvement.date,
        mouvement.piece,
        mouvement.journalCode,
        mouvement.compte,
        mouvement.tiersCode ?? "",
        mouvement.libelle,
        mouvement.debit,
        mouvement.credit
      ]),
      [],
      ["Pointage", "Ligne du relevé", "Mouvement", "Montant", "Date", "Acteur", "État"],
      ...donnees.pointages.map((pointage) => [
        pointage.id,
        pointage.ligneDeReleve,
        pointage.mouvement,
        pointage.montant,
        pointage.date,
        pointage.acteur,
        pointage.defaitLe === null ? "en vigueur" : `défait le ${pointage.defaitLe}`
      ])
    ];
  };

  const pointagesEnVigueur = donnees.pointages.filter((pointage) => pointage.defaitLe === null);
  const pieceDe = (ligneId: string): string =>
    etat?.pointes.find((item: ElementPointe) => item.mouvement === ligneId)?.piece ?? "";

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  /**
   * Le même relevé d'exemple dans les trois contenants qu'une banque emploie.
   *
   * Le classeur et le PDF sont écrits pour de vrai, puis relus par le lecteur de l'application : ils
   * rendent l'import d'un fichier binaire essayable sans avoir celui de sa banque sous la main.
   */
  const titreDExemple = (contenant: ContenantDExemple, auRepos: string): string =>
    exempleEnCours === contenant
      ? contenant === "csv"
        ? "Le relevé d'exemple s'écrit…"
        : `Le fichier ${contenant === "xlsx" ? "classeur" : "PDF"} d'exemple s'écrit, puis il est relu par l'application…`
      : exempleEnCours === null
        ? auRepos
        : "Un autre relevé d'exemple est en cours d'écriture";

  const boutonsDExemple = (
    <>
      <button
        class="bouton"
        type="button"
        disabled={exempleEnCours !== null}
        title={titreDExemple("csv", "Un relevé construit à partir du grand livre du dossier, pour essayer l'import sans fichier sous la main")}
        onClick={() => void chargerExemple("csv")}
      >
        Charger un relevé d'exemple
      </button>
      <button
        class="bouton"
        type="button"
        disabled={exempleEnCours !== null}
        title={titreDExemple("xlsx", "Le même relevé d'exemple, écrit dans un vrai classeur .xlsx puis relu par l'application")}
        onClick={() => void chargerExemple("xlsx")}
      >
        Charger un exemple Excel
      </button>
      <button
        class="bouton"
        type="button"
        disabled={exempleEnCours !== null}
        title={titreDExemple("pdf", "Le même relevé d'exemple, imprimé dans un vrai PDF puis relu par l'application")}
        onClick={() => void chargerExemple("pdf")}
      >
        Charger un exemple PDF
      </button>
    </>
  );

  return (
    <Fenetre
      titre="Rapprochement bancaire"
      chemin="Traitements › Rapprochement bancaire"
      sousTitre={`Dossier ${contexte.numero} · ${contexte.societe.raisonSociale} · montants en ${contexte.devise}`}
      actions={
        <>
          <label class="champ-court">
            Relevé
            <select
              value={releve?.id ?? ""}
              disabled={releves.length === 0}
              onChange={(evenement) => {
                setReleveChoisi(evenement.currentTarget.value);
                setLignesCochees([]);
                setMouvementsCoches([]);
                setPropositions(null);
                setRetour(null);
              }}
            >
              {releves.length === 0 ? <option value="">Aucun relevé</option> : null}
              {releves.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.libelle} — {item.compte}
                </option>
              ))}
            </select>
          </label>
          <Exporter tige="rapprochement" contexte={releve?.compte ?? "aucun"} date={aujourdHui} lignes={lignesCsv} />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      {retour ? (
        <p class={`retour ${retour.ton === "succes" ? "succes" : "erreur"}`} role="status">
          {retour.texte}
        </p>
      ) : null}

      {releves.length === 0 || !releve || !etat ? (
        <div class="bloc">
          <h2>Aucun relevé bancaire</h2>
          <Vide>
            Aucun relevé n'est saisi dans ce dossier. Le rapprochement confronte un relevé reçu de la
            banque au compte de trésorerie : saisissez un relevé ci-dessous, ou importez-le —
            l'import d'un fichier de relevé n'est pas encore produit.
          </Vide>
        </div>
      ) : (
        <>
          <div class="bloc">
            <h2>État de rapprochement</h2>
            <p class="note">
              Compte <span class="mono">{etat.compte}</span> · journal{" "}
              <span class="mono">{etat.journalCode}</span> · relevé du{" "}
              {formaterDateFr(releve.dateDebut)} au {formaterDateFr(releve.dateFin)}
            </p>
            <dl class="liste-definition">
              <dt>Solde comptable à la fin du relevé</dt>
              <dd class="mono">{montant(etat.soldeComptable)}</dd>
              <dt>Solde du relevé (ouverture {montant(releve.soldeDOuverture)} + {releve.lignes.length} lignes)</dt>
              <dd class="mono">{montant(etat.soldeDuReleve)}</dd>
              <dt>Écart</dt>
              <dd class="mono">
                <strong>{montant(etat.ecart)}</strong>
              </dd>
              <dt>Expliqué par les suspens de la période</dt>
              <dd class="mono">{montant(etat.ecartExplique)}</dd>
              <dt>Suspens des périodes antérieures</dt>
              <dd class="mono">{montant(etat.ecartDOuverture)}</dd>
              <dt>Reste inexpliqué</dt>
              <dd class="mono">
                <strong>{montant(etat.ecartRestant)}</strong>
              </dd>
              <dt>Pointages</dt>
              <dd>
                {etat.pointes.length} en vigueur sur {releve.lignes.length} lignes ·{" "}
                {etat.lignesNonPointees.length} ligne{etat.lignesNonPointees.length > 1 ? "s" : ""} du relevé et{" "}
                {etat.mouvementsNonPointes.length} mouvement{etat.mouvementsNonPointes.length > 1 ? "s" : ""} du
                compte restent à rapprocher
              </dd>
            </dl>
            {etat.conforme ? (
              <p>
                <Etiquette ton="succes">Rapprochement conforme</Etiquette>{" "}
                <span class="note">
                  L'écart entre les deux soldes est entièrement composé de suspens identifiés. Rien
                  n'est absorbé : chaque différence a une ligne en face.
                </span>
              </p>
            ) : (
              <p class="avertissement">
                <Etiquette ton="danger">Écart non expliqué : {montant(etat.ecartRestant)}</Etiquette>{" "}
                Une fois les suspens comptés, il reste une différence que ni le relevé ni le compte
                n'expliquent. Vérifiez le solde d'ouverture annoncé par la banque ({montant(
                  releve.soldeDOuverture
                )}) et le solde comptable à la veille du relevé ({montant(etat.soldeComptableAvantReleve)}).
              </p>
            )}
          </div>

          <div class="bloc">
            <h2>
              Relevé — {releve.libelle}{" "}
              {releve.source ? (
                <Etiquette ton="succes">
                  importé · {NOM_DE_FORMAT[releve.source.format]}
                  {releve.source.nomFichier ? ` · ${releve.source.nomFichier}` : ""}
                </Etiquette>
              ) : (
                <Etiquette>saisi ligne à ligne</Etiquette>
              )}
            </h2>
            <p class="note">
              Les montants sont portés au sens de la banque : positif quand l'argent entre. Côté
              compte de trésorerie, le sens est inverse — la conversion est faite au pointage.
              {releve.source?.doublonsEcartes
                ? ` ${releve.source.doublonsEcartes} opération(s) déjà vue(s) dans un relevé du compte ont été écartée(s) à l'import.`
                : ""}
            </p>
            <div class="grille-conteneur">
              <table class="grille grille-etat">
                <thead>
                  <tr>
                    <th class="align-centre" style={{ width: "3rem" }}>
                      <span class="illisible">Cocher</span>
                    </th>
                    <th>Date</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th class="align-droite">Entrée</th>
                    <th class="align-droite">Sortie</th>
                    <th>Pointée avec</th>
                  </tr>
                </thead>
                <tbody>
                  {releve.lignes.map((ligne: LigneDeReleve) => {
                    const pointe = etat.pointes.find((item) => item.ligneDeReleve === ligne.id);
                    return (
                      <tr
                        key={ligne.id}
                        class={lignesCochees.includes(ligne.id) ? "selectionnee" : pointe ? "niveau-total" : undefined}
                      >
                        <td class="align-centre">
                          {pointe ? (
                            <span class="pastille" title={`Pointée avec la pièce ${pointe.piece}`}>
                              ✓
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={lignesCochees.includes(ligne.id)}
                              aria-label={`Pointer la ligne ${ligne.reference || ligne.libelle} du ${formaterDateFr(
                                ligne.date
                              )}`}
                              onChange={() => basculerLigne(ligne.id)}
                            />
                          )}
                        </td>
                        <td>{formaterDateFr(ligne.date)}</td>
                        <td class="mono">{ligne.reference || "—"}</td>
                        <td>{ligne.libelle}</td>
                        <td class="align-droite mono">{ligne.montant > ZERO ? montant(ligne.montant) : ""}</td>
                        <td class="align-droite mono">{ligne.montant < ZERO ? montant(oppose(ligne.montant)) : ""}</td>
                        <td class="mono">{pointe ? `${pointe.piece} · ${formaterDateFr(pointe.date)}` : "à rapprocher"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4}>
                      Solde d'ouverture {montant(releve.soldeDOuverture)} · {releve.lignes.length} lignes
                    </th>
                    <td class="align-droite mono" colSpan={2}>
                      Solde du relevé {montant(etat.soldeDuReleve)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="bloc">
            <h2>Mouvements du compte {etat.compte} à rapprocher</h2>
            {etat.mouvementsNonPointes.length === 0 ? (
              <Vide>
                Aucun mouvement du compte {etat.compte} sur la période du relevé n'attend d'être
                rapproché. Soit tout est pointé, soit les opérations de banque de la période ne sont
                pas encore comptabilisées — dans ce cas, saisissez-les d'abord.
              </Vide>
            ) : (
              <div class="grille-conteneur">
                <table class="grille grille-etat">
                  <thead>
                    <tr>
                      <th class="align-centre" style={{ width: "3rem" }}>
                        <span class="illisible">Cocher</span>
                      </th>
                      <th>Date</th>
                      <th>Pièce</th>
                      <th>Journal</th>
                      <th>Compte</th>
                      <th>Tiers</th>
                      <th>Libellé</th>
                      <th class="align-droite">Débit</th>
                      <th class="align-droite">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etat.mouvementsNonPointes.map((mouvement) => (
                      <tr
                        key={mouvement.ligneId}
                        class={mouvementsCoches.includes(mouvement.ligneId) ? "selectionnee" : undefined}
                      >
                        <td class="align-centre">
                          <input
                            type="checkbox"
                            checked={mouvementsCoches.includes(mouvement.ligneId)}
                            aria-label={`Pointer le mouvement ${mouvement.piece} du ${formaterDateFr(mouvement.date)}`}
                            onChange={() => basculerMouvement(mouvement.ligneId)}
                          />
                        </td>
                        <td>{formaterDateFr(mouvement.date)}</td>
                        <td class="mono">{mouvement.piece}</td>
                        <td class="mono">{mouvement.journalCode}</td>
                        <td class="mono">{mouvement.compte}</td>
                        <td class="mono">{mouvement.tiersCode ?? ""}</td>
                        <td>{mouvement.libelle}</td>
                        <td class="align-droite mono">{mouvement.debit === ZERO ? "" : montant(mouvement.debit)}</td>
                        <td class="align-droite mono">{mouvement.credit === ZERO ? "" : montant(mouvement.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                disabled={!pointable}
                title={pointable ? "Rapprocher la ligne cochée du mouvement coché" : raisonIndisponible}
                onClick={() => void pointer()}
              >
                Pointer la sélection
              </button>
              <label class="case-a-cocher">
                <input
                  type="checkbox"
                  checked={horsPeriode}
                  onChange={(evenement) => {
                    setHorsPeriode(evenement.currentTarget.checked);
                    setPropositions(null);
                  }}
                />
                Inclure les mouvements antérieurs au relevé
              </label>
              <button class="bouton" type="button" onClick={() => void proposer()}>
                Proposer un pointage automatique
              </button>
              <button
                class="bouton"
                type="button"
                disabled={propositions === null || propositions.length === 0}
                title={
                  propositions === null || propositions.length === 0
                    ? "Demandez d'abord une proposition : rien n'est écrit sans qu'elle ait été montrée."
                    : `Créer ${propositions.length} pointage${propositions.length > 1 ? "s" : ""}`
                }
                onClick={() => void appliquer()}
              >
                Appliquer les propositions
              </button>
              <button
                class="bouton"
                type="button"
                disabled={pointagesEnVigueur.length > 0}
                title={
                  pointagesEnVigueur.length > 0
                    ? `Ce relevé porte ${pointagesEnVigueur.length} pointage${
                        pointagesEnVigueur.length > 1 ? "s" : ""
                      } : il faut d'abord dépointer.`
                    : "Supprimer ce relevé du dossier"
                }
                onClick={() => void supprimer(releve)}
              >
                Supprimer ce relevé
              </button>
            </div>

            {propositions !== null ? (
              <div class="bloc">
                <h2>Propositions de pointage</h2>
                {propositions.length === 0 ? (
                  <Vide>Rien à proposer.</Vide>
                ) : (
                  <div class="grille-conteneur">
                    <table class="grille grille-etat">
                      <thead>
                        <tr>
                          <th>Retenue sur</th>
                          <th>Ligne du relevé</th>
                          <th>Mouvement</th>
                          <th>Date</th>
                          <th class="align-droite">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propositions.map((proposition) => {
                          const ligne = releve.lignes.find((item) => item.id === proposition.ligneDeReleve);
                          return (
                            <tr key={`${proposition.ligneDeReleve}-${proposition.mouvement}`}>
                              <td>{proposition.nature === "reference" ? "la référence" : "le montant"}</td>
                              <td>
                                <span class="mono">{ligne?.reference || "—"}</span> {ligne?.libelle ?? ""}
                              </td>
                              <td class="mono">{proposition.piece}</td>
                              <td>{formaterDateFr(proposition.date)}</td>
                              <td class="align-droite mono">{montant(proposition.montant)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div class="bloc">
            <h2>Pointages du relevé</h2>
            {donnees.pointages.length === 0 ? (
              <Vide>Aucun pointage sur ce relevé.</Vide>
            ) : (
              <div class="grille-conteneur">
                <table class="grille grille-etat">
                  <thead>
                    <tr>
                      <th>Pointage</th>
                      <th>Ligne du relevé</th>
                      <th>Pièce</th>
                      <th>Date</th>
                      <th class="align-droite">Montant</th>
                      <th>Acteur</th>
                      <th>État</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {donnees.pointages.map((pointage) => {
                      const ligne = releve.lignes.find((item) => item.id === pointage.ligneDeReleve);
                      return (
                        <tr key={pointage.id} class={pointage.defaitLe === null ? undefined : "niveau-detail"}>
                          <td class="mono">{pointage.id}</td>
                          <td>
                            <span class="mono">{ligne?.reference || "—"}</span> {ligne?.libelle ?? ""}
                          </td>
                          <td class="mono">{pieceDe(pointage.mouvement) || pointage.mouvement}</td>
                          <td>{formaterDateFr(pointage.date)}</td>
                          <td class="align-droite mono">{montant(pointage.montant)}</td>
                          <td>{pointage.acteur}</td>
                          <td>
                            {pointage.defaitLe === null ? (
                              <Etiquette ton="succes">en vigueur</Etiquette>
                            ) : (
                              <Etiquette>défait</Etiquette>
                            )}
                          </td>
                          <td>
                            <button
                              class="bouton"
                              type="button"
                              disabled={pointage.defaitLe !== null}
                              title={
                                pointage.defaitLe !== null
                                  ? "Ce pointage est déjà défait."
                                  : "Rendre la ligne et le mouvement à rapprocher"
                              }
                              onClick={() => void depointer(pointage)}
                            >
                              Dépointer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div class="bloc">
        <h2>{importation ? "Import d'un relevé bancaire" : "Importer un relevé bancaire"}</h2>
        {importation === null ? (
          <>
            <p class="note">
              Le relevé que la banque donne se lit tel quel, quel que soit son contenant :{" "}
              <strong>CSV</strong> (texte séparé), <strong>OFX / QFX</strong>, <strong>CAMT.053</strong>,{" "}
              <strong>classeur Excel</strong> (.xlsx) ou <strong>PDF</strong>. Le contenant change d'une
              banque à l'autre, pas ce qu'on y cherche : une date, une référence, un libellé, un montant,
              un solde. Le séparateur, la décimale, les colonnes, l'ordre des dates et le sens des
              montants sont reconnus automatiquement, et ce qui est reconnu est{" "}
              <strong>montré avant d'écrire</strong>. Les opérations déjà présentes dans un relevé du
              compte sont écartées et annoncées : importer deux fois le même fichier ne double rien.
              Comme une saisie, un import ne passe aucune écriture — les frais que le fichier révèle se
              comptabilisent ensuite, puis se pointent. Un PDF dont les chiffres sont des images — un
              relevé scanné — n'est pas deviné : il est refusé, et l'écran dit quoi faire.
            </p>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                title="Choisir un fichier, ou coller son contenu"
                onClick={ouvrirImport}
              >
                Importer un fichier de relevé
              </button>
              {boutonsDExemple}
            </div>
          </>
        ) : (
          <>
            <div class="deux-colonnes">
              <label class="champ-court">
                Compte de trésorerie
                <input
                  class="mono"
                  value={importation.compte}
                  onChange={(evenement) => {
                    const compte = evenement.currentTarget.value;
                    setApercu(null);
                    setImportation({ ...importation, compte });
                  }}
                />
              </label>
              <label class="champ-court">
                Journal
                <input
                  class="mono"
                  value={importation.journalCode}
                  onChange={(evenement) => setImportation({ ...importation, journalCode: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Format
                <select
                  value={importation.format}
                  onChange={(evenement) => {
                    setApercu(null);
                    setImportation({ ...importation, format: evenement.currentTarget.value });
                  }}
                >
                  <option value="">Détection automatique</option>
                  {FORMATS_DE_RELEVE.map((format) => (
                    <option key={format} value={format}>
                      {NOM_DE_FORMAT[format]}
                    </option>
                  ))}
                </select>
              </label>
              <label class="champ-court">
                Libellé du relevé
                <input
                  value={importation.libelle}
                  placeholder="Relevé d'avril 2026 — BOA Bénin"
                  onChange={(evenement) => setImportation({ ...importation, libelle: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Du
                <input
                  type="date"
                  value={importation.du}
                  onChange={(evenement) => setImportation({ ...importation, du: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Au
                <input
                  type="date"
                  value={importation.au}
                  onChange={(evenement) => setImportation({ ...importation, au: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Solde d'ouverture (sens banque)
                <input
                  class="mono"
                  value={importation.soldeDOuverture}
                  placeholder="Tel que la banque l'indique"
                  onChange={(evenement) =>
                    setImportation({ ...importation, soldeDOuverture: evenement.currentTarget.value })
                  }
                />
              </label>
            </div>
            <label class="champ-court">
              Fichier de relevé (.csv, .ofx, .qfx, .xml, .xlsx, .pdf)
              <input
                type="file"
                accept=".csv,.txt,.ofx,.qfx,.xml,.xlsx,.xlsm,.pdf,text/csv,application/xml,application/pdf,text/plain"
                onChange={(evenement) => void choisirFichierDeReleve(evenement.currentTarget.files?.[0] ?? null)}
              />
            </label>
            {importation.grille === null ? (
              <label class="champ-texte">
                Contenu du fichier {importation.nomFichier === "" ? "" : `— ${importation.nomFichier}`}
                <textarea
                  rows={8}
                  spellcheck={false}
                  aria-label="Contenu du fichier de relevé"
                  value={importation.texte}
                  placeholder="Choisissez un fichier ci-dessus, ou collez ici son contenu. Un relevé d'exemple est proposé pour essayer l'import, dans les trois contenants."
                  onChange={(evenement) => {
                    setApercu(null);
                    setImportation({ ...importation, texte: evenement.currentTarget.value });
                  }}
                />
              </label>
            ) : (
              <div class="champ-texte">
                <span>
                  Contenu du fichier — {importation.nomFichier} ({importation.grille.length} ligne
                  {importation.grille.length > 1 ? "s" : ""} mise{importation.grille.length > 1 ? "s" : ""} en
                  grille)
                </span>
                <p class="note">
                  Un classeur Excel ou un PDF n'a pas de texte à coller : le lecteur l'a remis en grille
                  de cellules, et c'est cette grille qui sera lue. Voici ce qu'il en dit.
                </p>
                <ul class="liste-compacte" aria-label="Ce que le lecteur dit du fichier">
                  {importation.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                disabled={importation.texte.trim() === "" && importation.grille === null}
                title={
                  importation.texte.trim() === "" && importation.grille === null
                    ? "Choisissez un fichier ou collez son contenu"
                    : "Lire le fichier et montrer ce qu'il contient, sans rien écrire"
                }
                onClick={() => void lireFichier()}
              >
                Lire le fichier
              </button>
              <button
                class="bouton primaire"
                type="button"
                disabled={apercu === null || apercu.retenues.length === 0}
                title={
                  apercu === null
                    ? "Rien n'est écrit sans que le fichier ait été lu et montré"
                    : apercu.retenues.length === 0
                      ? "Aucune opération nouvelle à importer"
                      : `Créer le relevé avec ${apercu.retenues.length} opération${
                          apercu.retenues.length > 1 ? "s" : ""
                        }`
                }
                onClick={() => void creerReleveImporte()}
              >
                Créer le relevé depuis l'import
              </button>
              <button
                class="bouton"
                type="button"
                onClick={() => {
                  setImportation(null);
                  setApercu(null);
                  setRetour(null);
                }}
              >
                Annuler l'import
              </button>
              {boutonsDExemple}
            </div>

            {apercu === null ? null : (
              <>
                <dl class="liste-definition">
                  <dt>Format reconnu</dt>
                  <dd>{NOM_DE_FORMAT[apercu.importe.format]}</dd>
                  <dt>Fichier</dt>
                  <dd class="mono">{apercu.importe.nomFichier ?? "contenu collé"}</dd>
                  {apercu.importe.compteBancaire === null ? null : (
                    <>
                      <dt>Compte annoncé</dt>
                      <dd class="mono">{apercu.importe.compteBancaire}</dd>
                    </>
                  )}
                  {apercu.importe.deviseDuFichier === null ? null : (
                    <>
                      <dt>Devise annoncée</dt>
                      <dd>{apercu.importe.deviseDuFichier}</dd>
                    </>
                  )}
                  <dt>Période lue</dt>
                  <dd>
                    {apercu.importe.dateDebut === null || apercu.importe.dateFin === null
                      ? "aucune"
                      : `${formaterDateFr(apercu.importe.dateDebut)} – ${formaterDateFr(apercu.importe.dateFin)}`}
                  </dd>
                  <dt>Solde d'ouverture déduit</dt>
                  <dd class="mono">
                    {apercu.importe.soldeDOuverture === null
                      ? "non porté par le fichier : saisissez-le"
                      : montant(apercu.importe.soldeDOuverture)}
                  </dd>
                  <dt>Solde de fin annoncé</dt>
                  <dd class="mono">
                    {apercu.importe.soldeDeFin === null ? "non porté" : montant(apercu.importe.soldeDeFin)}
                  </dd>
                  <dt>Opérations lues</dt>
                  <dd>
                    {apercu.importe.lignes.length}, dont {apercu.retenues.length} à importer
                    {apercu.doublons.length > 0 ? ` et ${apercu.doublons.length} déjà vue(s)` : ""}
                  </dd>
                  <dt>Colonnes reconnues</dt>
                  <dd>
                    {apercu.importe.correspondances.map((item) => `${item.role} ← ${item.colonne}`).join(" · ")}
                  </dd>
                </dl>

                {apercu.importe.avertissements.length === 0 ? null : (
                  <ul>
                    {apercu.importe.avertissements.map((avertissement) => (
                      <li key={avertissement} class="discret">
                        {avertissement}
                      </li>
                    ))}
                  </ul>
                )}
                {apercu.doublons.length === 0 ? null : (
                  <p class="avertissement">
                    {apercu.doublons.length} opération{apercu.doublons.length > 1 ? "s" : ""} figure
                    {apercu.doublons.length > 1 ? "nt" : ""} déjà dans un relevé du compte{" "}
                    {importation.compte} : elle{apercu.doublons.length > 1 ? "s" : ""} ne sera
                    {apercu.doublons.length > 1 ? "ont" : ""} pas reprise
                    {apercu.doublons.length > 1 ? "s" : ""}.
                  </p>
                )}

                <div class="grille-conteneur">
                  <table class="grille grille-etat">
                    <thead>
                      <tr>
                        <th>Ligne</th>
                        <th>Date</th>
                        <th>Référence</th>
                        <th>Libellé</th>
                        <th class="align-droite">Montant (sens banque)</th>
                        <th class="align-droite">Solde</th>
                        <th>Sort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {apercu.importe.lignes.map((ligne) => {
                        const doublon = apercu.doublons.some(
                          (item) => item.numero === ligne.numero && item.date === ligne.date
                        );
                        return (
                          <tr key={`apercu-${ligne.numero}`}>
                            <td class="align-droite">{ligne.numero}</td>
                            <td>{formaterDateFr(ligne.date)}</td>
                            <td class="mono">{ligne.reference}</td>
                            <td>{ligne.libelle}</td>
                            <td class="align-droite mono">{montant(ligne.montant)}</td>
                            <td class="align-droite mono">
                              {ligne.solde === null ? "" : montant(ligne.solde)}
                            </td>
                            <td>
                              {doublon ? <Etiquette ton="alerte">déjà vue</Etiquette> : <Etiquette>à importer</Etiquette>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div class="bloc">
        <h2>{brouillon ? "Saisie d'un relevé" : "Saisir un relevé bancaire"}</h2>
        {brouillon === null ? (
          <>
            <p class="note">
              Un relevé se saisit ligne à ligne, tel que la banque le donne : la date, la référence
              (numéro de chèque, de virement, de remise), le libellé et le montant — positif quand
              l'argent entre, négatif quand il sort. Aucune écriture n'est passée : le relevé décrit,
              il ne comptabilise pas.
            </p>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                onClick={() =>
                  setBrouillon({
                    compte: "521100",
                    journalCode: "BQ",
                    libelle: "",
                    dateDebut: `${aujourdHui.slice(0, 8)}01`,
                    dateFin: aujourdHui,
                    soldeDOuverture: "",
                    lignes: [ligneVide(aujourdHui)]
                  })
                }
              >
                Saisir un relevé
              </button>
              <button
                class="bouton"
                type="button"
                title="Lire un relevé CSV, OFX, CAMT.053, Excel ou PDF : l'aperçu précède l'import"
                onClick={ouvrirImport}
              >
                Importer un fichier de relevé
              </button>
            </div>
          </>
        ) : (
          <>
            <div class="deux-colonnes">
              <label class="champ-court">
                Compte de trésorerie
                <input
                  class="mono"
                  value={brouillon.compte}
                  onChange={(evenement) => setBrouillon({ ...brouillon, compte: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Journal
                <input
                  class="mono"
                  value={brouillon.journalCode}
                  onChange={(evenement) => setBrouillon({ ...brouillon, journalCode: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Libellé du relevé
                <input
                  value={brouillon.libelle}
                  placeholder="Relevé d'avril 2026 — BOA Bénin"
                  onChange={(evenement) => setBrouillon({ ...brouillon, libelle: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Solde d'ouverture (sens banque)
                <input
                  class="mono"
                  value={brouillon.soldeDOuverture}
                  placeholder="55000000"
                  onChange={(evenement) =>
                    setBrouillon({ ...brouillon, soldeDOuverture: evenement.currentTarget.value })
                  }
                />
              </label>
              <label class="champ-court">
                Du
                <input
                  type="date"
                  value={brouillon.dateDebut}
                  onChange={(evenement) => setBrouillon({ ...brouillon, dateDebut: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Au
                <input
                  type="date"
                  value={brouillon.dateFin}
                  onChange={(evenement) => setBrouillon({ ...brouillon, dateFin: evenement.currentTarget.value })}
                />
              </label>
            </div>
            <div class="grille-conteneur">
              <table class="grille grille-etat">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th class="align-droite">Montant</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {brouillon.lignes.map((ligne, index) => (
                    <tr key={`brouillon-${index}`}>
                      <td>
                        <input
                          type="date"
                          value={ligne.date}
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, date: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          class="mono"
                          value={ligne.reference}
                          placeholder="CHQ-118204"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, reference: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={ligne.libelle}
                          placeholder="Chèque émis — facture FA-2026-011"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, libelle: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          class="mono align-droite"
                          value={ligne.montant}
                          placeholder="-1850000"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, montant: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          class="bouton"
                          type="button"
                          disabled={brouillon.lignes.length === 1}
                          title={
                            brouillon.lignes.length === 1
                              ? "Un relevé porte au moins une ligne."
                              : "Retirer cette ligne du relevé en cours de saisie"
                          }
                          onClick={() =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.filter((_, rang) => rang !== index)
                            })
                          }
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                onClick={() =>
                  setBrouillon({ ...brouillon, lignes: [...brouillon.lignes, ligneVide(brouillon.dateDebut)] })
                }
              >
                Ajouter une ligne
              </button>
              <button class="bouton" type="button" onClick={() => void enregistrerReleve()}>
                Enregistrer le relevé
              </button>
              <button class="bouton" type="button" onClick={() => setBrouillon(null)}>
                Abandonner
              </button>
            </div>
          </>
        )}
      </div>
    </Fenetre>
  );
}
