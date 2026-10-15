import { useState } from "preact/hooks";
import { SYSCOHADA_REVISE, classeDuReferentiel, groupeDuReferentiel } from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  montant,
  useAsync,
  type Colonne
} from "../composants";
import type { Compte } from "../../noyau/index";

/**
 * Plan comptable.
 *
 * Le compte est **segmenté** : la tête de l'écran rappelle le format, parce qu'un utilisateur qui
 * ne voit pas la structure ne comprend pas pourquoi `401100-FOU01` et `401100` sont le même
 * compte du plan vu deux fois.
 */
export function PlanComptable() {
  const service = getService();
  const [recherche, setRecherche] = useState("");
  const { donnees, erreur, recharger } = useAsync(() => service.planComptable(recherche), [recherche]);

  const structure = SYSCOHADA_REVISE.structure;

  const colonnes: Colonne<Compte>[] = [
    { cle: "numero", titre: "Numéro", largeur: "9rem", valeur: (compte) => <span class="mono">{compte.numero}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (compte) => compte.libelle },
    {
      cle: "classe",
      titre: "Classe",
      largeur: "16rem",
      valeur: (compte) => `${compte.classe} — ${classeDuReferentiel(SYSCOHADA_REVISE, compte.classe).libelle}`
    },
    {
      cle: "groupe",
      titre: "Groupe",
      largeur: "20rem",
      valeur: (compte) => {
        const groupe = groupeDuReferentiel(SYSCOHADA_REVISE, compte.groupe);
        return `${groupe.libelle} · ${groupe.etat}`;
      }
    },
    {
      cle: "auxiliaire",
      titre: "Tiers",
      alignement: "centre",
      largeur: "6rem",
      valeur: (compte) => (compte.exigeTiers ? <Etiquette ton="info">Auxiliaire</Etiquette> : "—")
    },
    {
      cle: "saisie",
      titre: "Saisie",
      alignement: "centre",
      largeur: "6rem",
      valeur: (compte) => (compte.autoriseSaisie ? "Autorisée" : "Regroupement")
    },
    { cle: "solde", titre: "Solde initial", alignement: "droite", largeur: "10rem", valeur: (compte) => montant(compte.soldeInitial) }
  ];

  return (
    <Fenetre
      titre="Plan comptable"
      chemin={`Structure › Plan comptable · ${SYSCOHADA_REVISE.nom}`}
      sousTitre={`${SYSCOHADA_REVISE.version}.`}
      actions={
        <div class="recherche" role="search">
          <label for="recherche-compte">Rechercher</label>
          <input
            id="recherche-compte"
            type="search"
            value={recherche}
            placeholder="numéro ou libellé"
            onInput={(evenement) => setRecherche((evenement.target as HTMLInputElement).value)}
          />
        </div>
      }
    >
      <p class="structure">
        Structure de comptes <strong>{structure.code}</strong> :{" "}
        {structure.segments
          .map((segment) => `${segment.libelle} (${segment.longueur}${segment.obligatoire ? "" : ", facultatif"})`)
          .join(structure.separateur === "-" ? " · " : ` ${structure.separateur} `)}{" "}
        — exemple <span class="mono">411100-CLI01-ABJ1</span>
      </p>

      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Lecture du plan comptable…" /> : null}
      {donnees ? (
        <>
          <Grille
            colonnes={colonnes}
            lignes={donnees}
            cleDe={(compte) => compte.numero}
            vide="Aucun compte ne correspond à cette recherche."
            pied={
              <tr>
                <th scope="row">{donnees.length} comptes</th>
                <td colSpan={6}>
                  {SYSCOHADA_REVISE.classes.length} classes · {SYSCOHADA_REVISE.groupes.length} groupes
                  d'états financiers
                </td>
              </tr>
            }
          />
          <p class="note">
            Jeu de démarrage : les classes et leurs divisions sont celles du SYSCOHADA révisé ; les
            subdivisions les plus fines restent à valider sur l'annexe de l'Acte uniforme avant une
            mise en production.
          </p>
        </>
      ) : null}
    </Fenetre>
  );
}
