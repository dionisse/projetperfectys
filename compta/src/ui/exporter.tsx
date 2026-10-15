/**
 * Le choix du format d'export : Excel, CSV ou PDF.
 *
 * C'est une exigence du projet, pas un confort : **tout document est exportable dans les trois
 * formats, et c'est l'utilisateur qui choisit**. Les trois rendus partent de la même description du
 * document, donc des mêmes chiffres — un état qui dirait autre chose en PDF qu'en Excel ne serait
 * pas un état.
 *
 * Ce composant vit hors de `composants.tsx` à dessein : les briques partagées ne connaissent rien à
 * la comptabilité, alors qu'un export doit savoir quelle société, quel dossier et quel exercice il
 * imprime, pour qu'une feuille isolée reste identifiable.
 *
 * Excel et PDF sont chargés à la demande : leurs bibliothèques ne pèsent pas sur le démarrage de
 * l'application, seulement sur le premier export dans ce format. Le bouton dit ce qu'il fait pendant
 * ce chargement, au lieu de laisser croire qu'il ne se passe rien.
 */

import { useRef, useState } from "preact/hooks";
import type { DateCivile } from "../noyau/index";
import { getService } from "../web/noyau";
import { telechargerCsv, telechargerOctets } from "../web/telechargement";
import { documentDepuisLignes, type ChampAExporter, type DocumentAExporter } from "../web/exports/document";
import { rendreExcel } from "../web/exports/excel";
import { rendrePdf } from "../web/exports/pdf";
import { message, type CelluleCsv, type ExportCsvProps } from "./composants";

export type FormatDExport = "csv" | "excel" | "pdf";

const LIBELLE_FORMAT: Readonly<Record<FormatDExport, string>> = {
  csv: "CSV",
  excel: "Excel",
  pdf: "PDF"
};

const PIED_PAR_DEFAUT =
  "Perfectys Compta — plan SYSCOHADA révisé, paquet pays Bénin. Montants en francs CFA, arrondis au franc. " +
  "Les écritures comptabilisées sont immuables : toute correction passe par une contre-passation tracée.";

export interface ExporterProps extends ExportCsvProps {
  /** Sous-titre imprimé sous le titre : ce que l'écran montre, en une phrase. */
  sousTitre?: string | undefined;
  /**
   * Titres des sections, dans l'ordre, quand le document en compte plusieurs. À défaut, les
   * sections suivantes portent « <titre> — partie n », ce qui est lisible mais pauvre.
   */
  titresDeSection?: readonly string[] | undefined;
  /** Mention finale imprimée au pied du document. */
  pied?: string | undefined;
}

function tailleLisible(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  const ko = octets / 1024;
  if (ko < 1024) return `${ko.toFixed(ko < 10 ? 2 : 1)} ko`;
  return `${(ko / 1024).toFixed(2)} Mo`;
}

export function Exporter(props: ExporterProps) {
  const [enCours, setEnCours] = useState<FormatDExport | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const panneau = useRef<HTMLDetailsElement>(null);

  const lignes = (): readonly (readonly CelluleCsv[])[] => props.lignes();

  /**
   * Le document, tel que l'écran le montre au moment du clic.
   *
   * La première ligne du CSV porte le titre et le contexte de l'édition : elle est reprise comme
   * titre du document et comme paramètre, plutôt que d'être imprimée comme une ligne de données.
   */
  const construireDocument = async (): Promise<DocumentAExporter> => {
    const service = getService();
    const contexte = await service.contexte();
    const societe = contexte.societe;
    const brutes = lignes();
    const premiere = brutes[0] ?? [];
    const texte = (cellule: unknown): string =>
      cellule === null || cellule === undefined ? "" : String(cellule).trim();

    const titre = texte(premiere[0]) || props.tige;
    const edition = texte(premiere[1]);
    const champs: ChampAExporter[] = edition.length > 0 ? [{ libelle: "Édition", valeur: edition }] : [];

    return documentDepuisLignes({
      titre,
      sousTitre: props.sousTitre ?? "",
      tige: props.tige,
      contexte: props.contexte,
      date: props.date,
      societe: {
        raisonSociale: societe.raisonSociale,
        formeJuridique: societe.formeJuridique,
        identifiantFiscal: societe.identifiantFiscal,
        adresse: societe.adresse,
        ville: societe.ville,
        pays: societe.pays,
        telephone: societe.telephone
      },
      dossier: contexte.numero,
      exercice: `Exercice ${contexte.exercice} (${contexte.periodeLabel})`,
      devise: contexte.devise,
      genereLe: new Date().toISOString(),
      generePar: contexte.utilisateur,
      pied: props.pied ?? PIED_PAR_DEFAUT,
      lignes: brutes.slice(1),
      champs,
      titresDeSection: props.titresDeSection
    });
  };

  const exporter = async (format: FormatDExport): Promise<void> => {
    if (panneau.current) {
      panneau.current.open = false;
    }
    if (format === "csv") {
      // Le CSV n'a besoin d'aucune bibliothèque : il part immédiatement, comme avant.
      const nom = telechargerCsv(
        { tige: props.tige, contexte: props.contexte, date: props.date },
        lignes() as readonly (readonly CelluleCsv[])[]
      );
      setRetour({ ton: "succes", texte: `Fichier CSV téléchargé : ${nom}.` });
      return;
    }

    setEnCours(format);
    setRetour(null);
    try {
      const document = await construireDocument();
      const fichier = format === "excel" ? await rendreExcel(document) : await rendrePdf(document);
      telechargerOctets(fichier.nom, fichier.octets, fichier.mime);
      setRetour({
        ton: "succes",
        texte: `Fichier ${LIBELLE_FORMAT[format]} téléchargé : ${fichier.nom} (${tailleLisible(fichier.taille)}).`
      });
    } catch (erreur) {
      setRetour({
        ton: "erreur",
        texte: `Export ${LIBELLE_FORMAT[format]} impossible : ${message(erreur)}`
      });
    } finally {
      setEnCours(null);
    }
  };

  const occupe = enCours !== null;

  return (
    <span class="choix-format">
      <details ref={panneau}>
        <summary
          class="bouton"
          title="Choisir le format du téléchargement : Excel pour retraiter, CSV pour échanger, PDF pour imprimer et archiver"
          aria-disabled={occupe}
        >
          {occupe ? `${LIBELLE_FORMAT[enCours]} en cours…` : "Exporter…"}
        </summary>
        <div class="menu-format" role="group" aria-label="Format du téléchargement">
          <button
            class="bouton"
            type="button"
            disabled={occupe}
            title="Feuille de calcul : les montants restent des nombres, avec volet figé et filtre automatique"
            onClick={() => void exporter("excel")}
          >
            Excel (.xlsx)
          </button>
          <button
            class="bouton"
            type="button"
            disabled={occupe}
            title="Texte séparé par des points-virgules, ouvert par un BOM UTF-8 : Excel en français le découpe correctement"
            onClick={() => void exporter("csv")}
          >
            CSV (.csv)
          </button>
          <button
            class="bouton"
            type="button"
            disabled={occupe}
            title="Document imprimé : A4, en-tête de société, paramètres de l'édition, pages numérotées"
            onClick={() => void exporter("pdf")}
          >
            PDF (.pdf)
          </button>
        </div>
      </details>
      {retour ? (
        <span class={`retour ${retour.ton === "succes" ? "succes" : "erreur"}`} role="status">
          {retour.texte}
        </span>
      ) : null}
    </span>
  );
}

/** La date du jour, au format civil : ce que la plupart des exports portent dans leur nom. */
export function dateDuJour(): DateCivile {
  return new Date().toISOString().slice(0, 10) as DateCivile;
}
