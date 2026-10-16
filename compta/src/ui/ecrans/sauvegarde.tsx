/**
 * Sauvegarde et restauration — Outils › Sauvegarde du dossier.
 *
 * Un dossier comptable hors ligne qui ne peut pas être emporté est un dossier en sursis : il suffit
 * d'un navigateur réinitialisé, d'un poste changé ou d'un stockage local purgé pour perdre un
 * exercice. Cet écran donne les deux gestes qui manquaient — **emporter** le dossier, et le
 * **remettre**.
 *
 * Deux règles d'honnêteté gouvernent l'écran :
 *
 * - la sauvegarde est **vérifiée dès le choix du fichier**, avant toute restauration : l'utilisateur
 *   voit ce qu'il s'apprête à remettre (quelle société, quel exercice, combien de mouvements), ou la
 *   raison précise du refus. Restaurer à l'aveugle un fichier trouvé sur une clé n'est pas un geste
 *   comptable ;
 * - la restauration **remplace** tout, et l'écran le dit avant, pas après. Elle est soumise à une
 *   case à cocher : avoir téléchargé une sauvegarde du dossier en cours. Ce n'est pas une formalité —
 *   c'est la seule marche arrière qui existe.
 */

import { useRef, useState } from "preact/hooks";
import {
  FORMAT_SAUVEGARDE,
  VERSION_SAUVEGARDE,
  verifierSauvegarde,
  type ContenuDossier,
  type DateCivile,
  type ResultatRestauration,
  type SauvegardeDossier
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import { nomDeFichier, telecharger } from "../../web/telechargement";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Vide,
  message,
  useAsync
} from "../composants";

const LIGNES_DE_CONTENU: { cle: keyof ContenuDossier; libelle: string }[] = [
  { cle: "comptes", libelle: "Comptes au plan" },
  { cle: "journaux", libelle: "Journaux" },
  { cle: "tiers", libelle: "Tiers" },
  { cle: "mouvements", libelle: "Mouvements comptabilisés" },
  { cle: "lots", libelle: "Lots d'écritures" },
  { cle: "lettrages", libelle: "Marques de lettrage" },
  { cle: "exercicesClos", libelle: "Exercices clos" },
  { cle: "releves", libelle: "Relevés bancaires" },
  { cle: "pointages", libelle: "Pointages de relevé" },
  { cle: "codesTaxe", libelle: "Codes de taxe" },
  { cle: "audit", libelle: "Événements d'audit" }
];

interface FichierChoisi {
  nom: string;
  taille: number;
  /** Le contenu brut du fichier : la restauration repasse par la vérification du noyau. */
  brut: unknown;
  sauvegarde: SauvegardeDossier | null;
  refus: string | null;
}

export function Sauvegarde(props: { onMutation: () => void }) {
  const service = getService();
  const entreeFichier = useRef<HTMLInputElement>(null);
  const [choisi, setChoisi] = useState<FichierChoisi | null>(null);
  const [sauve, setSauve] = useState(false);
  const [restaure, setRestaure] = useState<ResultatRestauration | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      const sauvegarde = await service.produireSauvegarde();
      return { contexte, sauvegarde };
    },
    [revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du dossier…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, sauvegarde } = donnees;

  const terminer = (texte: string): void => {
    setRetour({ ton: "succes", texte });
    setRevision((valeur) => valeur + 1);
  };

  const echouer = (erreurInconnue: unknown): void => {
    setRetour({ ton: "erreur", texte: message(erreurInconnue) });
  };

  const telechargerSauvegarde = async (): Promise<void> => {
    try {
      const contenu = JSON.stringify(sauvegarde, null, 2);
      const nom = nomDeFichier(
        "json",
        "sauvegarde",
        `${contexte.numero}-${sauvegarde.exercice}`,
        new Date().toISOString().slice(0, 10) as DateCivile
      );
      telecharger(nom, contenu, "application/json;charset=utf-8");
      setSauve(true);
      terminer(
        `Sauvegarde téléchargée : ${nom} (${(contenu.length / 1024).toFixed(1)} ko, ${
          sauvegarde.contenu.mouvements
        } mouvement(s)). Conservez-la hors du navigateur : c'est la seule copie qui survive à ce poste.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const choisirFichier = async (fichier: File | null): Promise<void> => {
    setRestaure(null);
    if (!fichier) {
      setChoisi(null);
      return;
    }
    try {
      const texte = await fichier.text();
      let brut: unknown;
      try {
        brut = JSON.parse(texte) as unknown;
      } catch (erreurInconnue) {
        setChoisi({
          nom: fichier.name,
          taille: fichier.size,
          brut: null,
          sauvegarde: null,
          refus: `Ce fichier n'est pas un JSON valide : ${message(erreurInconnue)}`
        });
        return;
      }
      // Vérifier avant de proposer la restauration : l'utilisateur doit voir ce qu'il remet, ou
      // savoir pourquoi ce n'est pas possible.
      const verifiee = verifierSauvegarde(brut, service.paquetPays.devise);
      setChoisi({
        nom: fichier.name,
        taille: fichier.size,
        brut,
        sauvegarde: verifiee.sauvegarde,
        refus: null
      });
      setRetour(null);
    } catch (erreurInconnue) {
      setChoisi({
        nom: fichier.name,
        taille: fichier.size,
        brut: null,
        sauvegarde: null,
        refus: message(erreurInconnue)
      });
    }
  };

  const restaurer = async (): Promise<void> => {
    if (!choisi) {
      return;
    }
    try {
      // Le noyau revérifie le fichier : la vérification de l'écran sert à informer, celle du noyau
      // sert à protéger.
      const resultat = await service.restaurerSauvegarde(choisi.brut);
      setRestaure(resultat);
      setChoisi(null);
      if (entreeFichier.current) {
        entreeFichier.current.value = "";
      }
      props.onMutation();
      terminer(
        `Dossier restauré : ${resultat.societe}, exercice ${resultat.exercice}, ${resultat.apres.mouvements} mouvement(s). Le dossier précédent (${resultat.avant.mouvements} mouvement(s)) a été remplacé, et le remplacement est tracé dans la piste d'audit.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  return (
    <Fenetre
      titre="Sauvegarde du dossier"
      chemin="Outils › Sauvegarde du dossier"
      sousTitre={`Dossier ${contexte.numero} · ${contexte.societe.raisonSociale} · exercice ${contexte.exercice}`}
      actions={
        <>
          <button
            class="bouton primaire"
            type="button"
            title="Télécharger un fichier JSON autosuffisant : société, exercice, paquet pays, inventaire et état complet du dossier"
            onClick={() => void telechargerSauvegarde()}
          >
            Télécharger la sauvegarde (.json)
          </button>
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

      <div class="bloc">
        <h2>Le dossier en cours</h2>
        <dl class="liste-definition">
          <dt>Société</dt>
          <dd>
            {contexte.societe.raisonSociale} ({contexte.societe.formeJuridique}) · IFU{" "}
            <span class="mono">{contexte.societe.identifiantFiscal}</span>
          </dd>
          <dt>Dossier</dt>
          <dd class="mono">
            {contexte.numero} · {contexte.referentiel} · {contexte.paquetPays}
          </dd>
          <dt>Exercice</dt>
          <dd>
            {contexte.exercice} ({contexte.periodeLabel}) · période courante {contexte.periodeCourante}
          </dd>
          <dt>Stockage</dt>
          <dd>
            {contexte.stockage} · session {contexte.utilisateur}
          </dd>
          <dt>Dernière modification</dt>
          <dd>{contexte.derniereModification ?? "aucune"}</dd>
        </dl>
        <ul class="note">
          {LIGNES_DE_CONTENU.map((ligne) => (
            <li key={ligne.cle}>
              {ligne.libelle} : <strong>{sauvegarde.contenu[ligne.cle]}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div class="bloc">
        <h2>Sauvegarder</h2>
        <p>
          La sauvegarde est un fichier JSON <strong>autosuffisant</strong> : il porte le format{" "}
          <span class="mono">{FORMAT_SAUVEGARDE}</span> en version {VERSION_SAUVEGARDE}, l'identité de
          la société, l'exercice, le paquet pays et le référentiel qui ont servi, l'inventaire de ce
          qu'il contient, et l'état complet du dossier — comptes, journaux, tiers, lots, écritures,
          lettrages, exercices clos, relevés, pointages, codes de taxe et piste d'audit.
        </p>
        <p class="note">
          Les montants y sont écrits en chaînes : ce sont des entiers exacts, et un JSON de nombres
          perdrait cette exactitude au premier passage dans un tableur. Conservez ce fichier hors du
          navigateur — sur un poste, un serveur ou une clé — car le dossier en cours, lui, ne vit que
          dans le stockage local de ce navigateur.
        </p>
        {sauve ? (
          <p class="retour succes">
            Une sauvegarde vient d'être téléchargée pour ce dossier. Toute écriture postérieure n'y
            figure pas : sauvegardez de nouveau après chaque journée de saisie.
          </p>
        ) : null}
      </div>

      <div class="bloc">
        <h2>Restaurer une sauvegarde</h2>
        <p class="avertissement">
          Restaurer <strong>remplace</strong> le dossier en cours : comptes, écritures, lettrages,
          relevés et paramètres sont écrasés par ceux de la sauvegarde. Ce n'est pas une fusion — deux
          dossiers rapprochés silencieusement donneraient des soldes que personne ne pourrait
          expliquer. Le remplacement est inscrit dans la piste d'audit de la sauvegarde restaurée, avec
          le contenu du dossier qu'il écrase.
        </p>

        <div class="barre-actions">
          <label class="champ-court">
            Fichier de sauvegarde
            <input
              ref={entreeFichier}
              type="file"
              accept=".json,application/json"
              onChange={(evenement) => void choisirFichier(evenement.currentTarget.files?.[0] ?? null)}
            />
          </label>
          <label class="case-a-cocher">
            <input type="checkbox" checked={sauve} onChange={(evenement) => setSauve(evenement.currentTarget.checked)} />
            J'ai téléchargé une sauvegarde du dossier en cours
          </label>
          <button
            class="bouton primaire"
            type="button"
            disabled={choisi?.sauvegarde == null || !sauve}
            title={
              choisi === null
                ? "Choisissez d'abord un fichier de sauvegarde"
                : choisi.sauvegarde === null
                  ? "Ce fichier n'est pas restaurable : la raison est affichée ci-dessous"
                  : !sauve
                    ? "Téléchargez d'abord une sauvegarde du dossier en cours : c'est la seule marche arrière"
                    : "Remplacer le dossier en cours par cette sauvegarde"
            }
            onClick={() => void restaurer()}
          >
            Restaurer ce fichier
          </button>
        </div>

        {choisi ? (
          choisi.sauvegarde === null ? (
            <p class="retour erreur">
              <strong>{choisi.nom}</strong> ({(choisi.taille / 1024).toFixed(1)} ko) — {choisi.refus}
            </p>
          ) : (
            <div class="note">
              <p>
                <strong>{choisi.nom}</strong> ({(choisi.taille / 1024).toFixed(1)} ko) — sauvegarde du{" "}
                {choisi.sauvegarde.creeeLe.slice(0, 10)} produite par {choisi.sauvegarde.creeePar}
              </p>
              <dl class="liste-definition">
                <dt>Société</dt>
                <dd>
                  {choisi.sauvegarde.societe.raisonSociale} ({choisi.sauvegarde.societe.formeJuridique}) · IFU{" "}
                  <span class="mono">{choisi.sauvegarde.societe.identifiantFiscal}</span>
                </dd>
                <dt>Exercice</dt>
                <dd>{choisi.sauvegarde.exercice}</dd>
                <dt>Paquet pays</dt>
                <dd>
                  {choisi.sauvegarde.paquetPays.nom} — {choisi.sauvegarde.paquetPays.version} ·{" "}
                  {choisi.sauvegarde.referentiel} · {choisi.sauvegarde.devise}
                </dd>
                <dt>Contenu</dt>
                <dd>
                  {choisi.sauvegarde.contenu.comptes} comptes, {choisi.sauvegarde.contenu.mouvements} mouvements,{" "}
                  {choisi.sauvegarde.contenu.lots} lots, {choisi.sauvegarde.contenu.lettrages} lettrages,{" "}
                  {choisi.sauvegarde.contenu.exercicesClos} exercice(s) clos, {choisi.sauvegarde.contenu.audit}{" "}
                  événements d'audit
                </dd>
              </dl>
              <p>
                Mêmes société et exercice que le dossier en cours ?{" "}
                {choisi.sauvegarde.societe.code === contexte.societe.code &&
                choisi.sauvegarde.exercice === contexte.exercice ? (
                  <Etiquette ton="succes">oui</Etiquette>
                ) : (
                  <Etiquette ton="alerte">non — vérifiez avant de remplacer</Etiquette>
                )}
              </p>
            </div>
          )
        ) : (
          <Vide>Aucun fichier choisi. Une sauvegarde vérifiée montre ici ce qu'elle contient avant d'être restaurée.</Vide>
        )}

        {restaure ? (
          <table class="grille">
            <caption>Restauration du {restaure.sauvegardeDu.slice(0, 10)}</caption>
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col">Avant</th>
                <th scope="col">Après</th>
              </tr>
            </thead>
            <tbody>
              {LIGNES_DE_CONTENU.map((ligne) => (
                <tr key={ligne.cle}>
                  <th scope="row">{ligne.libelle}</th>
                  <td class="align-droite mono">{restaure.avant[ligne.cle]}</td>
                  <td class="align-droite mono">{restaure.apres[ligne.cle]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </Fenetre>
  );
}
