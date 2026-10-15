import { useState } from "preact/hooks";
import {
  LIBELLES_NATURE_JOURNAL,
  totalLot,
  type DateCivile,
  type Lot
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  message,
  montant,
  useAsync,
  type Colonne
} from "../composants";

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

/**
 * Lots et comptabilisation.
 *
 * Le lot est l'unité de travail : on l'ouvre, on y saisit, on le déclare prêt, on le comptabilise
 * d'un seul mouvement. Un lot comptabilisé ne se modifie ni ne se supprime : il se **contre-passe**,
 * ce qui laisse l'original intact dans la piste d'audit.
 */
export function Lots(props: { onMutation: () => void }) {
  const service = getService();
  const [journal, setJournal] = useState("ACH");
  const [date, setDate] = useState<DateCivile>(new Date().toISOString().slice(0, 10));
  const [libelle, setLibelle] = useState("");
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur" | "info"; texte: string } | null>(null);

  const { donnees, erreur, recharger } = useAsync(
    async () => ({
      lots: await service.lots(),
      journaux: await service.journaux()
    }),
    []
  );

  async function agir(operation: () => Promise<unknown>, succes: string) {
    try {
      await operation();
      setRetour({ ton: "succes", texte: succes });
      recharger();
      props.onMutation();
    } catch (probleme) {
      setRetour({ ton: "erreur", texte: message(probleme) });
    }
  }

  const colonnes: Colonne<Lot>[] = [
    { cle: "numero", titre: "Lot", largeur: "7rem", valeur: (lot) => <span class="mono">{lot.numero}</span> },
    {
      cle: "journal",
      titre: "Journal",
      largeur: "12rem",
      valeur: (lot) => {
        const trouve = donnees?.journaux.find((item) => item.code === lot.journalCode);
        return trouve ? `${lot.journalCode} · ${LIBELLES_NATURE_JOURNAL[trouve.nature]}` : lot.journalCode;
      }
    },
    { cle: "date", titre: "Date", largeur: "8rem", valeur: (lot) => lot.date },
    { cle: "libelle", titre: "Libellé", valeur: (lot) => lot.libelle },
    { cle: "source", titre: "Source", largeur: "10rem", valeur: (lot) => <span class="mono">{lot.codeSource}</span> },
    {
      cle: "etat",
      titre: "État",
      largeur: "12rem",
      valeur: (lot) => <Etiquette ton={TONS_ETAT[lot.etat]}>{LIBELLES_ETAT[lot.etat]}</Etiquette>
    },
    { cle: "ecritures", titre: "Écritures", alignement: "droite", largeur: "7rem", valeur: (lot) => lot.ecritures.length },
    { cle: "debit", titre: "Débit", alignement: "droite", largeur: "10rem", valeur: (lot) => montant(totalLot(lot).debit) },
    { cle: "credit", titre: "Crédit", alignement: "droite", largeur: "10rem", valeur: (lot) => montant(totalLot(lot).credit) },
    {
      cle: "actions",
      titre: "Opérations",
      largeur: "22rem",
      valeur: (lot) => (
        <span class="actions-ligne">
          {lot.etat === "ouvert" ? (
            <>
              <button
                class="bouton petit"
                type="button"
                onClick={() => void agir(() => service.marquerPret(lot.id), `Lot ${lot.numero} prêt à comptabiliser.`)}
              >
                Marquer prêt
              </button>
              <button
                class="bouton petit"
                type="button"
                onClick={() =>
                  void agir(async () => {
                    await service.supprimerLot(lot.id);
                  }, `Lot ${lot.numero} supprimé.`)
                }
              >
                Supprimer
              </button>
            </>
          ) : null}
          {lot.etat === "pret" ? (
            <>
              <button
                class="bouton petit primaire"
                type="button"
                onClick={() =>
                  void agir(
                    () => service.comptabiliserLot(lot.id),
                    `Lot ${lot.numero} comptabilisé : les mouvements sont au grand livre.`
                  )
                }
              >
                Comptabiliser
              </button>
              <button
                class="bouton petit"
                type="button"
                onClick={() => void agir(() => service.rouvrirLot(lot.id), `Lot ${lot.numero} remis en saisie.`)}
              >
                Remettre en saisie
              </button>
            </>
          ) : null}
          {lot.etat === "comptabilise" ? (
            <button
              class="bouton petit"
              type="button"
              title="Crée un lot inverse daté du jour ; l'original reste intact."
              onClick={() =>
                void agir(() => service.contrePasserLot(lot.id), `Lot ${lot.numero} contre-passé : un lot inverse est ouvert.`)
              }
            >
              Contre-passer
            </button>
          ) : null}
          {lot.etat === "contre-passe" ? <span class="note-ligne">Corrigé par contre-passation</span> : null}
        </span>
      )
    }
  ];

  return (
    <Fenetre
      titre="Lots et comptabilisation"
      chemin="Traitements › Lots"
      sousTitre="Un lot se comptabilise d'un seul mouvement : toutes ses écritures sont validées, ou aucune n'est enregistrée. Un lot comptabilisé ne se supprime pas, il se contre-passe."
    >
      <form
        class="formulaire-ligne"
        onSubmit={(evenement) => {
          evenement.preventDefault();
          void agir(
            () => service.creerLot({ journalCode: journal, date, libelle: libelle || `Lot ${journal}` }),
            "Lot ouvert : il attend ses écritures."
          );
          setLibelle("");
        }}
      >
        <label>
          Journal
          <select value={journal} onChange={(evenement) => setJournal((evenement.target as HTMLSelectElement).value)}>
            {(donnees?.journaux ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.libelle}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input type="date" value={date} onChange={(evenement) => setDate((evenement.target as HTMLInputElement).value)} />
        </label>
        <label class="large">
          Libellé du lot
          <input
            type="text"
            value={libelle}
            placeholder="Achats de mars 2026"
            onInput={(evenement) => setLibelle((evenement.target as HTMLInputElement).value)}
          />
        </label>
        <button class="bouton primaire" type="submit">
          Ouvrir un lot
        </button>
      </form>

      {retour ? (
        <p class={retour.ton === "erreur" ? "retour erreur" : "retour succes"} role={retour.ton === "erreur" ? "alert" : "status"}>
          {retour.texte}
        </p>
      ) : null}

      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Lecture des lots…" /> : null}
      {donnees ? (
        <>
          <Grille
            colonnes={colonnes}
            lignes={donnees.lots}
            cleDe={(lot) => lot.id}
            vide="Aucun lot dans ce dossier."
          />
          <p class="note">
            La saisie des écritures dans un lot (table de détail navigable au clavier, lignes
            débit/crédit, codes de taxe) arrive au prochain incrément : jusque-là, un lot ouvert ne
            peut pas être comptabilisé, parce qu'un lot vide est refusé par le noyau.
          </p>
        </>
      ) : null}
    </Fenetre>
  );
}
