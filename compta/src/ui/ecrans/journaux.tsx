import { LIBELLES_NATURE_JOURNAL, type Journal as JournalType } from "../../noyau/index";
import { getService } from "../../web/noyau";
import { ChargementEnCours, Erreur, Etiquette, Fenetre, Grille, useAsync, type Colonne } from "../composants";

/** Journaux : la subdivision du grand livre par nature d'opération, avec son préfixe de lot. */
export function Journaux() {
  const service = getService();
  const { donnees, erreur, recharger } = useAsync(() => service.journaux(), []);

  const colonnes: Colonne<JournalType>[] = [
    { cle: "code", titre: "Code", largeur: "6rem", valeur: (journal) => <span class="mono">{journal.code}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (journal) => journal.libelle },
    { cle: "nature", titre: "Nature", largeur: "14rem", valeur: (journal) => LIBELLES_NATURE_JOURNAL[journal.nature] },
    {
      cle: "contrepartie",
      titre: "Compte de contrepartie",
      largeur: "14rem",
      valeur: (journal) => (journal.compteContrepartie ? <span class="mono">{journal.compteContrepartie}</span> : "—")
    },
    { cle: "prefixe", titre: "Préfixe de lot", largeur: "10rem", valeur: (journal) => <span class="mono">{journal.prefixeLot}</span> },
    {
      cle: "etat",
      titre: "État",
      alignement: "centre",
      largeur: "7rem",
      valeur: (journal) => (journal.actif ? <Etiquette ton="succes">Actif</Etiquette> : <Etiquette>Inactif</Etiquette>)
    }
  ];

  return (
    <Fenetre
      titre="Journaux"
      chemin="Structure › Journaux"
      sousTitre="Chaque journal numérote ses propres lots. Un lot appartient toujours à un seul journal : c'est ce qui rend le journal d'édition comparable au grand livre."
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Lecture des journaux…" /> : null}
      {donnees ? (
        <Grille
          colonnes={colonnes}
          lignes={donnees}
          cleDe={(journal) => journal.code}
          pied={
            <tr>
              <th scope="row">{donnees.length} journaux</th>
              <td colSpan={5}>Équivalents des codes source et profils de journal de Sage</td>
            </tr>
          }
        />
      ) : null}
    </Fenetre>
  );
}
