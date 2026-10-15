import type { EvenementAudit } from "../../noyau/index";
import { getService } from "../../web/noyau";
import { ChargementEnCours, Erreur, Fenetre, Grille, useAsync, type Colonne } from "../composants";

/**
 * Piste d'audit : ajout-seulement, attribuée et horodatée.
 *
 * Un logiciel comptable dont on peut modifier l'historique ne vaut pas comme preuve. Cette piste
 * n'est pas un journal technique : c'est la trace opposable de ce qui a été fait, par qui, quand.
 */
export function PisteAudit() {
  const service = getService();
  const { donnees, erreur, recharger } = useAsync(() => service.pisteAudit(), []);

  const colonnes: Colonne<EvenementAudit>[] = [
    { cle: "sequence", titre: "N°", alignement: "droite", largeur: "4rem", valeur: (evenement) => evenement.sequence },
    { cle: "horodate", titre: "Horodaté", largeur: "14rem", valeur: (evenement) => new Date(evenement.horodate).toLocaleString("fr-FR") },
    { cle: "utilisateur", titre: "Utilisateur", largeur: "9rem", valeur: (evenement) => evenement.utilisateur },
    { cle: "action", titre: "Action", largeur: "20rem", valeur: (evenement) => evenement.action },
    { cle: "entite", titre: "Entité", largeur: "8rem", valeur: (evenement) => evenement.entite },
    { cle: "identifiant", titre: "Identifiant", largeur: "16rem", valeur: (evenement) => <span class="mono">{evenement.entiteIdentifiant}</span> },
    { cle: "detail", titre: "Détail", valeur: (evenement) => evenement.detail }
  ];

  return (
    <Fenetre
      titre="Piste d'audit"
      chemin="Outils › Piste d'audit"
      sousTitre="Chaque opération sur le dossier laisse une trace séquencée : rien n'est supprimé, rien n'est réécrit."
      actions={
        <button class="bouton" type="button" onClick={recharger}>
          Actualiser
        </button>
      }
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Lecture de la piste d'audit…" /> : null}
      {donnees ? (
        <Grille
          colonnes={colonnes}
          lignes={[...donnees].reverse()}
          cleDe={(evenement) => String(evenement.sequence)}
          vide="Aucun événement tracé."
          pied={
            <tr>
              <th scope="row" colSpan={7}>
                {donnees.length} événement(s) tracé(s), du plus récent au plus ancien
              </th>
            </tr>
          }
        />
      ) : null}
    </Fenetre>
  );
}
