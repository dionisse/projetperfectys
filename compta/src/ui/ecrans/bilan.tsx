/**
 * Bilan — États › Bilan OHADA révisé.
 *
 * Deux colonnes, comme l'imprimé : l'actif en brut, amortissements et net ; le passif en net. Le
 * résultat de l'exercice figure au passif dans les capitaux propres — c'est ce qui rend le bilan
 * équilibré en cours d'année, avant toute clôture.
 *
 * Le contrôle d'équilibre est affiché en tête : un écart n'est jamais absorbé dans un total. Les
 * rubriques qu'aucun solde n'alimente sont annoncées, pour qu'un zéro ne se lise pas comme une
 * absence d'erreur.
 */

import { useState } from "preact/hooks";
import { formaterDateFr, type LigneEtat } from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  ExportCsv,
  Fenetre,
  montant,
  useAsync,
  type CelluleCsv
} from "../composants";

function ligne(ligneEtat: LigneEtat, colonnes: "actif" | "passif") {
  return (
    <tr class={`niveau-${ligneEtat.niveau}`} key={ligneEtat.code}>
      <td>{ligneEtat.libelle}</td>
      {colonnes === "actif" ? (
        <>
          <td class="align-droite mono">{ligneEtat.brut === 0n ? "" : montant(ligneEtat.brut)}</td>
          <td class="align-droite mono">
            {ligneEtat.amortissements === 0n ? "" : montant(ligneEtat.amortissements)}
          </td>
        </>
      ) : null}
      <td class="align-droite mono">{montant(ligneEtat.net)}</td>
    </tr>
  );
}

export function BilanOhada() {
  const service = getService();
  const [periode, setPeriode] = useState<number | "exercice">("exercice");

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const etat = await service.lire();
      const contexte = await service.contexte();
      return {
        contexte,
        bilan: await service.bilan(periode === "exercice" ? undefined : periode),
        periodes: etat.exercice.periodes.filter((item) => item.type === "normale")
      };
    },
    [periode]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Établissement du bilan…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, bilan } = donnees;
  const equilibre = bilan.ecart === 0n;

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Bilan — SYSCOHADA révisé"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Exercice", bilan.exercice],
    ["Arrêté au", formaterDateFr(bilan.dateCloture)],
    ["Devise", contexte.devise],
    [],
    ["ACTIF", "Rubrique", "Brut", "Amortissements et dépréciations", "Net"],
    ...bilan.actif.map((item) => [item.niveau, item.libelle, item.brut, item.amortissements, item.net]),
    [],
    ["PASSIF", "Rubrique", "Net"],
    ...bilan.passif.map((item) => [item.niveau, item.libelle, item.net]),
    [],
    ["Total général de l'actif (net)", bilan.totalActifNet],
    ["Total général du passif", bilan.totalPassif],
    ["Résultat de l'exercice", bilan.resultatExercice],
    ["Écart", bilan.ecart],
    [],
    ["Rubriques sans solde", bilan.groupesSansSolde.join(", ")]
  ];

  return (
    <Fenetre
      titre="Bilan"
      chemin="États › Bilan OHADA révisé"
      sousTitre={`Exercice ${bilan.exercice} · arrêté au ${formaterDateFr(bilan.dateCloture)} · montants en ${
        contexte.devise
      } · ${contexte.societe.raisonSociale}`}
      actions={
        <>
          <label class="champ-court">
            Arrêté
            <select
              value={periode === "exercice" ? "exercice" : String(periode)}
              onChange={(evenement) => {
                const valeur = evenement.currentTarget.value;
                setPeriode(valeur === "exercice" ? "exercice" : Number(valeur));
              }}
            >
              <option value="exercice">Clôture de l'exercice</option>
              {donnees.periodes.map((item) => (
                <option key={item.numero} value={item.numero}>
                  Fin de période {item.numero} — {item.libelle}
                </option>
              ))}
            </select>
          </label>
          <ExportCsv
            tige="bilan"
            contexte={`${contexte.societe.code}-${bilan.exercice}`}
            date={bilan.dateCloture}
            lignes={lignesCsv}
          />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      {equilibre ? (
        <p class="retour succes" role="status">
          Le bilan est équilibré : total de l'actif {montant(bilan.totalActifNet)} = total du passif{" "}
          {montant(bilan.totalPassif)}, résultat de l'exercice {montant(bilan.resultatExercice)} compris dans les
          capitaux propres.
        </p>
      ) : (
        <div class="bloc avertissement">
          <h2>Bilan déséquilibré</h2>
          <p class="note">
            Actif {montant(bilan.totalActifNet)} · passif {montant(bilan.totalPassif)} · écart{" "}
            <strong>{montant(bilan.ecart)}</strong>. Un bilan déséquilibré vient d'un compte dont le
            groupe ne participe à aucun état, ou d'un mouvement passé sur un compte hors bilan. Les
            comptes non présentés sont listés ci-dessous.
          </p>
        </div>
      )}

      <div class="deux-colonnes">
        <div class="bloc">
          <h2>Actif</h2>
          <div class="grille-conteneur">
            <table class="grille grille-etat">
              <thead>
                <tr>
                  <th>Rubrique</th>
                  <th class="align-droite">Brut</th>
                  <th class="align-droite">Amort. et dépréc.</th>
                  <th class="align-droite">Net</th>
                </tr>
              </thead>
              <tbody>{bilan.actif.map((item) => ligne(item, "actif"))}</tbody>
            </table>
          </div>
        </div>

        <div class="bloc">
          <h2>Passif</h2>
          <div class="grille-conteneur">
            <table class="grille grille-etat">
              <thead>
                <tr>
                  <th>Rubrique</th>
                  <th class="align-droite">Net</th>
                </tr>
              </thead>
              <tbody>{bilan.passif.map((item) => ligne(item, "passif"))}</tbody>
            </table>
          </div>
        </div>
      </div>

      {bilan.groupesSansSolde.length > 0 ? (
        <p class="note">
          Rubriques sans solde dans cet état : {bilan.groupesSansSolde.join(", ")}. Un zéro affiché
          ici signifie qu'aucun compte du plan n'a été mouvementé dans ce groupe — pas que le
          groupe est absent du modèle.
        </p>
      ) : null}

      {bilan.comptesHorsEtat.length > 0 ? (
        <div class="bloc">
          <h2>Comptes non présentés dans le bilan</h2>
          <table class="grille">
            <thead>
              <tr>
                <th>Compte</th>
                <th>Libellé</th>
                <th>Groupe</th>
                <th class="align-droite">Solde</th>
              </tr>
            </thead>
            <tbody>
              {bilan.comptesHorsEtat.map((compte) => (
                <tr key={compte.numero}>
                  <td class="mono">{compte.numero}</td>
                  <td>{compte.libelle}</td>
                  <td class="mono">{compte.groupe}</td>
                  <td class="align-droite mono">{montant(compte.solde)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p class="note">
        Présentation produite par le modèle de rubriques du noyau, dans l'ordre du SYSCOHADA révisé
        (actif immobilisé, actif circulant, trésorerie-actif ; capitaux propres, dettes stables,
        passif circulant, trésorerie-passif). La mise en page de l'imprimé officiel n'a pas été
        relevée dans l'Acte uniforme : cet état est un document de contrôle, à rapprocher du
        formulaire de dépôt avant toute communication légale. La colonne « N-1 » apparaîtra avec la
        gestion multi-exercices.
      </p>
    </Fenetre>
  );
}
