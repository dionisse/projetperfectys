/**
 * Clôture d'exercice — Traitements › Clôture d'exercice.
 *
 * L'écran montre le rapport de préparation avant toute écriture : ce qui s'oppose à la clôture, ce
 * que les deux écritures contiendraient, ligne à ligne. La clôture est définitive — l'exercice clos
 * ne se rouvre pas — donc le bouton exige une case cochée en plus d'un rapport sans obstacle.
 */

import { useState } from "preact/hooks";
import {
  ZERO,
  formaterDateFr,
  type LignePrevue
} from "../../noyau/index";
import { getService } from "../../web/noyau";
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

function grilleDeLignes(lignes: readonly LignePrevue[], titre: string) {
  if (lignes.length === 0) {
    return <Vide>{titre} : aucune ligne.</Vide>;
  }
  return (
    <div class="grille-conteneur">
      <table class="grille">
        <thead>
          <tr>
            <th>Compte</th>
            <th>Tiers</th>
            <th>Libellé</th>
            <th class="align-droite">Débit</th>
            <th class="align-droite">Crédit</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne, index) => (
            <tr key={`${ligne.compte}-${ligne.tiersCode ?? ""}-${index}`}>
              <td class="mono">{ligne.compte}</td>
              <td class="mono">{ligne.tiersCode ?? ""}</td>
              <td>{ligne.libelle}</td>
              <td class="align-droite mono">{ligne.debit === ZERO ? "" : montant(ligne.debit)}</td>
              <td class="align-droite mono">{ligne.credit === ZERO ? "" : montant(ligne.credit)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>Total — {lignes.length} ligne{lignes.length > 1 ? "s" : ""}</th>
            <td class="align-droite mono">{montant(lignes.reduce((total, ligne) => total + ligne.debit, ZERO))}</td>
            <td class="align-droite mono">{montant(lignes.reduce((total, ligne) => total + ligne.credit, ZERO))}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ClotureExercice(props: { onMutation: () => void }) {
  const service = getService();
  const [confirmee, setConfirmee] = useState(false);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const aujourdHui = new Date().toISOString().slice(0, 10);

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      return {
        contexte,
        rapport: await service.preparerCloture(),
        exercices: await service.exercices()
      };
    },
    [revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Préparation de la clôture…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, rapport, exercices } = donnees;
  const cloturable = rapport.prete && confirmee;
  const raisonIndisponible = rapport.prete
    ? "Confirmez avoir vérifié le rapport de clôture."
    : rapport.obstacles[0] ?? "";

  const apresCloture = async (): Promise<void> => {
    try {
      const { clos, suivant } = await service.cloturerExercice();
      setConfirmee(false);
      setRevision((valeur) => valeur + 1);
      setRetour({
        ton: "succes",
        texte: `Exercice ${clos.exercice.annee} clôturé : résultat ${montant(clos.resultat)} porté au compte 121000, ${
          clos.nombreDANouveaux
        } comptes reportés. L'exercice ${suivant.annee} est ouvert du ${formaterDateFr(
          suivant.dateDebut
        )} au ${formaterDateFr(suivant.dateFin)}.`
      });
      props.onMutation();
    } catch (erreur) {
      setRetour({ ton: "erreur", texte: message(erreur) });
    }
  };

  const cloturerLesPeriodes = async (): Promise<void> => {
    try {
      for (const numero of rapport.periodesOuvertes) {
        await service.cloturerPeriode(numero);
      }
      setRetour({
        ton: "succes",
        texte: `${rapport.periodesOuvertes.length} période${
          rapport.periodesOuvertes.length > 1 ? "s" : ""
        } clôturée${rapport.periodesOuvertes.length > 1 ? "s" : ""} : ${rapport.periodesOuvertes.join(", ")}.`
      });
      setRevision((valeur) => valeur + 1);
      props.onMutation();
    } catch (erreur) {
      setRetour({ ton: "erreur", texte: message(erreur) });
    }
  };

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Préparation de la clôture"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Exercice", rapport.exercice],
    ["Date de clôture", formaterDateFr(rapport.dateCloture)],
    ["Résultat de l'exercice", rapport.resultat],
    ["Total de l'actif", rapport.totalActif],
    ["Total du passif", rapport.totalPassif],
    ["Mouvements de l'exercice", rapport.mouvementsDeLexercice],
    ["Prête", rapport.prete ? "oui" : "non"],
    [],
    ["Obstacles", ...rapport.obstacles],
    ["Avertissements", ...rapport.avertissements],
    [],
    ["Écriture de clôture", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
    ...rapport.lignesDeCloture.map((ligne) => [
      "clôture",
      ligne.compte,
      ligne.tiersCode ?? "",
      ligne.libelle,
      ligne.debit,
      ligne.credit
    ]),
    [],
    ["À-nouveaux", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
    ...rapport.lignesDANouveaux.map((ligne) => [
      "à-nouveau",
      ligne.compte,
      ligne.tiersCode ?? "",
      ligne.libelle,
      ligne.debit,
      ligne.credit
    ])
  ];

  return (
    <Fenetre
      titre="Clôture d'exercice"
      chemin="Traitements › Clôture d'exercice"
      sousTitre={`Exercice ${rapport.exercice} · ${contexte.societe.raisonSociale} · clôture au ${formaterDateFr(
        rapport.dateCloture
      )} · montants en ${contexte.devise}`}
      actions={
        <>
          <Exporter
            tige="cloture"
            contexte={`${contexte.societe.code}-${rapport.exercice}`}
            date={aujourdHui}
            lignes={lignesCsv}
          />
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
        <h2>Exercices du dossier</h2>
        <table class="grille">
          <thead>
            <tr>
              <th>Exercice</th>
              <th>Du</th>
              <th>Au</th>
              <th>État</th>
              <th class="align-droite">Résultat</th>
            </tr>
          </thead>
          <tbody>
            {exercices.map((item) => (
              <tr key={item.exercice.annee} class={item.clos ? "defaite" : undefined}>
                <td class="mono">{item.exercice.annee}</td>
                <td>{formaterDateFr(item.exercice.dateDebut)}</td>
                <td>{formaterDateFr(item.exercice.dateFin)}</td>
                <td>
                  {item.clos ? (
                    <Etiquette ton="">Clos</Etiquette>
                  ) : (
                    <Etiquette ton="info">En cours</Etiquette>
                  )}
                </td>
                <td class="align-droite mono">
                  {item.resultat === null ? "—" : montant(item.resultat)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="bloc">
        <h2>Rapport de préparation — exercice {rapport.exercice}</h2>
        <dl class="liste-definition">
          <dt>Résultat de l'exercice</dt>
          <dd class="mono">{montant(rapport.resultat)}</dd>
          <dt>Total de l'actif</dt>
          <dd class="mono">{montant(rapport.totalActif)}</dd>
          <dt>Total du passif</dt>
          <dd class="mono">{montant(rapport.totalPassif)}</dd>
          <dt>Mouvements de l'exercice</dt>
          <dd>{rapport.mouvementsDeLexercice}</dd>
          <dt>Période de clôture</dt>
          <dd>
            {rapport.periodeDeCloture
              ? `Période ${rapport.periodeDeCloture.numero} — ${rapport.periodeDeCloture.libelle}, au ${formaterDateFr(
                  rapport.periodeDeCloture.dateFin
                )}`
              : "Aucune"}
          </dd>
          <dt>Périodes encore ouvertes</dt>
          <dd>
            {rapport.periodesOuvertes.length === 0
              ? "Aucune : toutes les périodes normales et d'ajustement sont clôturées."
              : rapport.periodesOuvertes.join(", ")}
          </dd>
          <dt>Grand livre</dt>
          <dd>{rapport.equilibreGrandLivre ? "Équilibré" : "Déséquilibré"}</dd>
        </dl>

        {rapport.periodesOuvertes.length > 0 ? (
          <div class="barre-actions">
            <button class="bouton" type="button" onClick={() => void cloturerLesPeriodes()}>
              Clôturer les périodes {rapport.periodesOuvertes[0]} à {rapport.periodesOuvertes.at(-1)}
            </button>
            <span class="note">
              La période de clôture reste ouverte : elle reçoit l'écriture de clôture.
            </span>
          </div>
        ) : null}
      </div>

      {rapport.obstacles.length > 0 ? (
        <div class="bloc avertissement">
          <h2>La clôture est refusée</h2>
          <ul>
            {rapport.obstacles.map((obstacle) => (
              <li key={obstacle}>{obstacle}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p class="retour succes" role="status">
          Aucune règle ne s'oppose à la clôture de l'exercice {rapport.exercice}.
        </p>
      )}

      {rapport.avertissements.length > 0 ? (
        <div class="bloc">
          <h2>À savoir avant de clôturer</h2>
          <ul>
            {rapport.avertissements.map((avertissement) => (
              <li key={avertissement}>{avertissement}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {rapport.lotsEnAttente.length > 0 ? (
        <div class="bloc">
          <h2>Lots en attente de comptabilisation</h2>
          <table class="grille">
            <thead>
              <tr>
                <th>Lot</th>
                <th>Journal</th>
                <th>Date</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {rapport.lotsEnAttente.map((lot) => (
                <tr key={lot.numero}>
                  <td class="mono">{lot.numero}</td>
                  <td class="mono">{lot.journalCode}</td>
                  <td>{formaterDateFr(lot.date)}</td>
                  <td>{lot.etat === "ouvert" ? "En saisie" : "Prêt à comptabiliser"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div class="deux-colonnes">
        <div class="bloc">
          <h2>Écriture de clôture — solde des comptes de gestion</h2>
          <p class="note">
            Chaque compte de produit et de charge est ramené à zéro, la contrepartie étant le compte
            121000. Cette écriture serait passée au {formaterDateFr(rapport.dateCloture)}, dans la
            période de clôture.
          </p>
          {grilleDeLignes(rapport.lignesDeCloture, "Écriture de clôture")}
        </div>

        <div class="bloc">
          <h2>À-nouveaux de l'exercice {rapport.exercice + 1}</h2>
          <p class="note">
            Chaque compte de bilan dont le solde n'est pas nul est reporté, segment de tiers compris,
            au premier jour de l'exercice {rapport.exercice + 1}. Aucun compte de gestion n'est
            reporté : ils sont soldés par l'écriture de clôture.
          </p>
          {grilleDeLignes(rapport.lignesDANouveaux, "À-nouveaux")}
        </div>
      </div>

      <div class="bloc">
        <h2>Clôturer</h2>
        <label class="case-a-cocher">
          <input
            type="checkbox"
            checked={confirmee}
            onChange={(evenement) => {
              setConfirmee(evenement.currentTarget.checked);
              setRetour(null);
            }}
          />
          J'ai vérifié le rapport ci-dessus : les périodes sont clôturées, aucun lot n'est en
          attente, les deux écritures sont celles attendues.
        </label>
        <div class="barre-actions">
          <button
            class="bouton"
            type="button"
            disabled={!cloturable}
            title={
              cloturable
                ? `Clôturer l'exercice ${rapport.exercice} et ouvrir l'exercice ${rapport.exercice + 1}`
                : raisonIndisponible
            }
            onClick={() => void apresCloture()}
          >
            Clôturer l'exercice {rapport.exercice} et ouvrir {rapport.exercice + 1}
          </button>
          <Etiquette ton={rapport.prete ? (confirmee ? "succes" : "info") : "alerte"}>
            {rapport.prete
              ? confirmee
                ? "Clôture possible"
                : "Rapport à confirmer"
              : `${rapport.obstacles.length} obstacle${rapport.obstacles.length > 1 ? "s" : ""}`}
          </Etiquette>
        </div>
        <p class="note">
          Une clôture est définitive dans cette version : l'exercice clos est archivé avec toutes ses
          périodes clôturées et ne reçoit plus d'écriture, et la réouverture d'un exercice clos n'est
          pas produite. La correction d'un exercice clos passe par une écriture dans l'exercice en
          cours — c'est ce que prévoit la pratique, et ce que la piste d'audit permet de retrouver.
        </p>
      </div>
    </Fenetre>
  );
}
