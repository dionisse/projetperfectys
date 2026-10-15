/**
 * Bilan — États › Bilan OHADA révisé.
 *
 * Deux masses, comme l'imprimé : l'actif en brut, amortissements et net ; le passif en net. Le
 * résultat de l'exercice figure au passif dans les capitaux propres — c'est ce qui rend le bilan
 * équilibré en cours d'année, avant toute clôture. Une fois l'exercice clos, ce même résultat vient
 * du compte 121000.
 *
 * La colonne « N-1 » n'apparaît que si un exercice est clos dans le dossier : comparer l'exercice à
 * un exercice qui n'existe pas serait une fausse comparaison.
 */

import { useState } from "preact/hooks";
import { formaterDateFr, type LigneEtat, type Montant } from "../../noyau/index";
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

function ligne(ligneEtat: LigneEtat, colonnes: "actif" | "passif", precedent?: Montant) {
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
      {precedent === undefined ? null : <td class="align-droite mono discret">{montant(precedent)}</td>}
    </tr>
  );
}

export function BilanOhada() {
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
        bilan: await service.bilan(
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
    return <ChargementEnCours libelle="Établissement du bilan…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, bilan, exercices } = donnees;
  const equilibre = bilan.ecart === 0n;
  const precedentActif = new Map((bilan.precedent?.actif ?? []).map((item) => [item.code, item.net] as const));
  const precedentPassif = new Map((bilan.precedent?.passif ?? []).map((item) => [item.code, item.net] as const));

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Bilan — SYSCOHADA révisé"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Exercice", bilan.exercice],
    ["Arrêté au", formaterDateFr(bilan.dateCloture)],
    ["Exercice précédent", bilan.precedent ? `${bilan.precedent.exercice} (clos)` : "aucun exercice clos"],
    ["Devise", contexte.devise],
    [],
    [
      "ACTIF",
      "Rubrique",
      "Brut",
      "Amortissements et dépréciations",
      "Net",
      bilan.precedent ? `Net ${bilan.precedent.exercice}` : "Net N-1"
    ],
    ...bilan.actif.map((item) => [
      item.niveau,
      item.libelle,
      item.brut,
      item.amortissements,
      item.net,
      precedentActif.get(item.code) ?? ""
    ]),
    [],
    ["PASSIF", "Rubrique", "Net", bilan.precedent ? `Net ${bilan.precedent.exercice}` : "Net N-1"],
    ...bilan.passif.map((item) => [item.niveau, item.libelle, item.net, precedentPassif.get(item.code) ?? ""]),
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
                {exercices.find((item) => item.exercice.annee === bilan.exercice)?.clos
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
                  {bilan.precedent ? <th class="align-droite">N-1 ({bilan.precedent.exercice})</th> : null}
                </tr>
              </thead>
              <tbody>
                {bilan.actif.map((item) =>
                  ligne(item, "actif", bilan.precedent ? precedentActif.get(item.code) : undefined)
                )}
              </tbody>
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
                  {bilan.precedent ? <th class="align-droite">N-1 ({bilan.precedent.exercice})</th> : null}
                </tr>
              </thead>
              <tbody>
                {bilan.passif.map((item) =>
                  ligne(item, "passif", bilan.precedent ? precedentPassif.get(item.code) : undefined)
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {bilan.precedent ? (
        <p class="note">
          Colonne N-1 : exercice {bilan.precedent.exercice}, clos le{" "}
          {formaterDateFr(bilan.precedent.dateCloture)} — actif {montant(bilan.precedent.totalActifNet)}, passif{" "}
          {montant(bilan.precedent.totalPassif)}, résultat {montant(bilan.precedent.resultatExercice)}.
        </p>
      ) : (
        <p class="note">
          Pas de colonne N-1 : aucun exercice n'est clos dans ce dossier. La comparaison n'apparaît
          qu'après une clôture, parce qu'un exercice non clos n'a pas de bilan définitif à comparer.
        </p>
      )}

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
        formulaire de dépôt avant toute communication légale.
      </p>
    </Fenetre>
  );
}
