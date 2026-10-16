/**
 * Tableau des flux de trésorerie — États › Tableau des flux de trésorerie.
 *
 * Un seul tableau, dans l'ordre de l'imprimé : trésorerie d'ouverture, activités opérationnelles,
 * investissement, financement par les capitaux propres, financement par les capitaux étrangers,
 * variation de la trésorerie nette, trésorerie de clôture. Les montants sont signés — positif quand
 * l'argent entre — et les codes de l'imprimé (ZA, FA… FP, ZB… ZH) sont affichés : ils permettent de
 * retrouver une ligne dans le formulaire de dépôt.
 *
 * Le contrôle de l'imprimé est repris tel quel, en tête de l'écran : la trésorerie de clôture présentée
 * doit égaler la trésorerie réelle lue dans les comptes de classe 5. Un écart est montré avec les
 * comptes qui l'expliquent, jamais absorbé.
 *
 * Pas de colonne N-1 : les flux de l'exercice précédent se calculent à partir de ses soldes
 * d'ouverture, qui sont les soldes de clôture de N-2. Le dossier ne les porte qu'après une clôture —
 * l'écran le dit au lieu d'afficher une comparaison fausse.
 */

import { useState } from "preact/hooks";
import {
  LIBELLE_DE_SECTION,
  formaterDateFr,
  type LigneDeFlux
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Fenetre,
  montant,
  useAsync,
  type CelluleCsv
} from "../composants";
import { Exporter } from "../exporter";

/** Le détail d'une ligne : les comptes qui la composent, avec leur part. */
function detail(ligne: LigneDeFlux): string {
  return ligne.comptes.map((compte) => `${compte.compte} ${montant(compte.montant)}`).join(" · ");
}

function ligneDeTableau(ligne: LigneDeFlux) {
  return (
    <tr class={`niveau-${ligne.niveau}`} key={ligne.code}>
      <td class="mono discret">{ligne.code}</td>
      <td>{ligne.libelle}</td>
      <td class="align-droite mono">{montant(ligne.montant)}</td>
      <td class="discret detail-flux">{detail(ligne)}</td>
    </tr>
  );
}

export function FluxDeTresorerie() {
  const service = getService();
  const [periode, setPeriode] = useState<number | "exercice">("exercice");
  const [exercice, setExercice] = useState<number | "courant">("courant");

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const etat = await service.lire();
      const contexte = await service.contexte();
      const exercices = await service.exercices();
      return {
        contexte,
        exercices,
        tableau: await service.tableauDesFluxDeTresorerie(
          periode === "exercice" ? undefined : periode,
          exercice === "courant" ? undefined : exercice
        ),
        periodes: (
          exercice === "courant"
            ? etat.exercice
            : exercices.find((item) => item.exercice.annee === exercice)?.exercice ?? etat.exercice
        ).periodes.filter((item) => item.type === "normale")
      };
    },
    [periode, exercice]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Établissement du tableau des flux de trésorerie…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, tableau, exercices } = donnees;
  const controle = tableau.ecart === 0n;

  const lignesCsv = (): (readonly CelluleCsv[])[] => {
    const lignes: (readonly CelluleCsv[])[] = [
      ["Tableau des flux de trésorerie — SYSCOHADA révisé"],
      ["Dossier", contexte.numero],
      ["Société", contexte.societe.raisonSociale],
      ["Exercice", tableau.exercice],
      ["Du", formaterDateFr(tableau.dateDebut)],
      ["Au", formaterDateFr(tableau.dateFin)],
      ["Devise", contexte.devise],
      [],
      ["Code", "Rubrique", "Montant", "Détail"]
    ];

    let section = "";
    for (const ligne of tableau.lignes) {
      if (ligne.section !== section) {
        section = ligne.section;
        lignes.push([LIBELLE_DE_SECTION[ligne.section]]);
      }
      lignes.push([ligne.code, ligne.libelle, ligne.montant, detail(ligne)]);
    }

    lignes.push(
      [],
      ["Trésorerie nette à l'ouverture (ZA)", tableau.tresorerieOuverture],
      ["Flux des activités opérationnelles (ZB)", tableau.fluxOperationnels],
      ["Flux des activités d'investissement (ZC)", tableau.fluxInvestissement],
      ["Flux des activités de financement (ZF)", tableau.fluxFinancement],
      ["Variation de la trésorerie nette (ZG)", tableau.variationPresentee],
      ["Trésorerie nette à la clôture (ZH)", tableau.tresoreriePresentee],
      ["Trésorerie réelle à la clôture", tableau.tresorerieReelle],
      ["Écart de contrôle", tableau.ecart],
      ["Résultat net de l'exercice", tableau.resultatNet],
      ["Capacité d'autofinancement globale (FA)", tableau.capaciteAutofinancement],
      ["Écritures entre comptes de trésorerie écartées", tableau.virementsInternes],
      [],
      [
        "Comptes non couverts par le modèle",
        tableau.comptesNonCouverts.length === 0
          ? "aucun"
          : tableau.comptesNonCouverts
              .map((compte) => `${compte.compte} ${compte.groupe} ${compte.variation}`)
              .join(" ; ")
      ]
    );
    return lignes;
  };

  // Le tableau est lu d'une traite : une grande masse de l'imprimé devient une ligne de titre.
  const corps: ReturnType<typeof ligneDeTableau>[] = [];
  let sectionCourante = "";
  for (const ligne of tableau.lignes) {
    if (ligne.section !== sectionCourante) {
      sectionCourante = ligne.section;
      corps.push(
        <tr class="ligne-section" key={`section-${ligne.section}`}>
          <td colSpan={4}>{LIBELLE_DE_SECTION[ligne.section]}</td>
        </tr>
      );
    }
    corps.push(ligneDeTableau(ligne));
  }

  return (
    <Fenetre
      titre="Tableau des flux de trésorerie"
      chemin="États › Tableau des flux de trésorerie"
      sousTitre={`Exercice ${tableau.exercice} · du ${formaterDateFr(tableau.dateDebut)} au ${formaterDateFr(
        tableau.dateFin
      )} · montants en ${contexte.devise} · ${contexte.societe.raisonSociale}`}
      actions={
        <>
          {exercices.length > 1 ? (
            <label class="champ-court">
              Exercice
              <select
                value={exercice === "courant" ? "courant" : String(exercice)}
                onChange={(evenement) => {
                  const valeur = evenement.currentTarget.value;
                  setExercice(valeur === "courant" ? "courant" : Number(valeur));
                }}
              >
                <option value="courant">Exercice en cours ({contexte.exercice})</option>
                {exercices
                  .filter((item) => item.clos)
                  .map((item) => (
                    <option key={item.exercice.annee} value={item.exercice.annee}>
                      {item.exercice.annee} — clos
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <label class="champ-court">
            Arrêté
            <select
              value={periode === "exercice" ? "exercice" : String(periode)}
              onChange={(evenement) => {
                const valeur = evenement.currentTarget.value;
                setPeriode(valeur === "exercice" ? "exercice" : Number(valeur));
              }}
            >
              <option value="exercice">
                {exercices.find((item) => item.exercice.annee === tableau.exercice)?.clos
                  ? "Clôture de l'exercice"
                  : "Situation à la clôture"}
              </option>
              {donnees.periodes.map((item) => (
                <option key={item.numero} value={item.numero}>
                  Fin de période {item.numero} — {item.libelle}
                </option>
              ))}
            </select>
          </label>
          <Exporter
            tige="tableau-flux-tresorerie"
            contexte={`${contexte.societe.code}-${tableau.exercice}`}
            date={tableau.dateFin}
            lignes={lignesCsv}
          />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      {controle ? (
        <p class="retour succes" role="status">
          Le tableau se contrôle : trésorerie nette à la clôture {montant(tableau.tresoreriePresentee)} =
          trésorerie réelle lue dans les comptes de trésorerie {montant(tableau.tresorerieReelle)}. Variation de la
          période {montant(tableau.variationPresentee)}, sur une trésorerie d'ouverture de{" "}
          {montant(tableau.tresorerieOuverture)}.
        </p>
      ) : (
        <div class="bloc avertissement">
          <h2>Le tableau ne se contrôle pas</h2>
          <p class="note">
            Trésorerie présentée à la clôture {montant(tableau.tresoreriePresentee)} · trésorerie réelle{" "}
            {montant(tableau.tresorerieReelle)} · écart <strong>{montant(tableau.ecart)}</strong>. Un écart vient
            d'un mouvement de trésorerie dont la contrepartie n'entre dans aucune ligne du modèle : le compte en
            cause est listé ci-dessous, avec sa variation. Rien n'est absorbé dans une ligne
            «&nbsp;divers&nbsp;» — l'état préfère se dire incomplet.
          </p>
        </div>
      )}

      <div class="bloc">
        <h2>Tableau des flux de trésorerie</h2>
        <div class="grille-conteneur">
          <table class="grille grille-etat">
            <thead>
              <tr>
                <th>Code</th>
                <th>Rubrique</th>
                <th class="align-droite">Montant</th>
                <th>Détail des comptes</th>
              </tr>
            </thead>
            <tbody>{corps}</tbody>
          </table>
        </div>
      </div>

      <p class="note">
        Résultat net de l'exercice {montant(tableau.resultatNet)} · capacité d'autofinancement globale{" "}
        {montant(tableau.capaciteAutofinancement)}. L'activité est présentée en méthode indirecte, comme l'imprimé
        révisé : le résultat, corrigé des charges et produits calculés, puis des variations des stocks, des
        créances et du passif circulant. L'investissement et le financement sont présentés en méthode directe :
        chaque décaissement et chaque encaissement est lu dans les écritures qui touchent un compte de
        trésorerie, sans clé de répartition ni arrondi.
      </p>

      {tableau.virementsInternes > 0 ? (
        <p class="note">
          {tableau.virementsInternes} écriture{tableau.virementsInternes > 1 ? "s" : ""} entre comptes de
          trésorerie écartée{tableau.virementsInternes > 1 ? "s" : ""} : un virement de caisse à banque déplace de
          l'argent d'une poche à l'autre, ce n'est pas un flux de la période.
        </p>
      ) : null}

      {tableau.comptesNonCouverts.length > 0 ? (
        <div class="bloc">
          <h2>Comptes que le modèle ne classe pas</h2>
          <table class="grille">
            <thead>
              <tr>
                <th>Compte</th>
                <th>Libellé</th>
                <th>Groupe</th>
                <th class="align-droite">Variation</th>
              </tr>
            </thead>
            <tbody>
              {tableau.comptesNonCouverts.map((compte) => (
                <tr key={compte.compte}>
                  <td class="mono">{compte.compte}</td>
                  <td>{compte.libelle}</td>
                  <td class="mono">{compte.groupe}</td>
                  <td class="align-droite mono">{montant(compte.variation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="note">
            Ces comptes ont varié sur la période sans entrer dans une ligne de flux. C'est la cause ordinaire d'un
            écart de contrôle : rattacher le compte à un groupe présenté — ou passer le mouvement par le compte
            attendu, un compte de dividendes à payer plutôt que le résultat — le résout.
          </p>
        </div>
      ) : null}

      <p class="note">
        Pas de colonne N-1 : les flux de l'exercice précédent se calculent à partir de ses soldes d'ouverture, qui
        sont les soldes de clôture de l'exercice d'avant. Le dossier ne les porte qu'après une clôture, et une
        comparaison affichée sans eux serait fausse.
      </p>

      <p class="note">
        Présentation produite par le modèle de rubriques du noyau, dans l'ordre et avec les codes de l'imprimé du
        SYSCOHADA révisé. La mise en page officielle et le rattachement de quelques comptes — intérêts payés,
        impôt sur les plus-values de cession — relèvent d'un choix de présentation : cet état est un document de
        contrôle, à rapprocher du formulaire de dépôt avant toute communication légale.
      </p>
    </Fenetre>
  );
}
