/**
 * Interrogation de compte — Interrogation › Compte et historique.
 *
 * L'écran du quotidien : un compte, ce qui s'y est passé, le **solde après chaque ligne**, et ce qui
 * reste en suspens. Le grand livre liste ; l'interrogation met en perspective.
 *
 * Trois choses y sont montrées qui ne le sont nulle part ailleurs :
 *
 * - le **solde d'ouverture de la fenêtre**, qui tient tout ce qui précède — à-nouveaux compris. Un
 *   solde progressif qui partirait de zéro ne correspondrait à rien de ce que l'utilisateur connaît ;
 * - les lignes d'un **exercice clos**, marquées comme telles : elles ne bougeront plus, et toute
 *   correction passe par l'exercice en cours ;
 * - la **comparaison d'exercices**, exercice par exercice, avec ce qui s'est reporté.
 *
 * Un compte segmenté (`401100-FOU01`) s'interroge seul : c'est la question posée quand on appelle un
 * fournisseur. Le compte principal rassemble tous les segments, et l'écran le dit.
 */

import { useState } from "preact/hooks";
import {
  ZERO,
  formaterDateFr,
  formaterSens,
  type CompteInterrogeable,
  type DateCivile,
  type InterrogationDeCompte,
  type LigneInterrogation,
  type ReportExercice
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  Vide,
  message,
  montant,
  useAsync,
  type CelluleCsv,
  type Colonne
} from "../composants";
import { Exporter } from "../exporter";

export function Interrogation() {
  const service = getService();
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;
  const [compte, setCompte] = useState("521100");
  const [tiers, setTiers] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [exercice, setExercice] = useState("");
  const [avecPrecedent, setAvecPrecedent] = useState(false);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);

  const demande = {
    compte: compte.trim(),
    ...(tiers.trim() === "" ? {} : { tiersCode: tiers.trim().toUpperCase() }),
    ...(du === "" ? {} : { du: du as DateCivile }),
    ...(au === "" ? {} : { au: au as DateCivile }),
    ...(exercice === "" ? {} : { exercice: Number(exercice) }),
    inclureExercicePrecedent: avecPrecedent
  };

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      const interrogeables = await service.comptesInterrogeables();
      const exercices = await service.exercices();
      try {
        const interrogation = await service.interrogerCompte(demande.compte, demande);
        return { contexte, interrogeables, exercices, interrogation, echec: null as string | null };
      } catch (erreurInconnue) {
        // Un compte ou un exercice inexistant n'est pas une panne : c'est une réponse. L'écran
        // l'affiche et garde les sélecteurs utilisables, au lieu de tout remplacer par une erreur.
        return {
          contexte,
          interrogeables,
          exercices,
          interrogation: null,
          echec: message(erreurInconnue)
        };
      }
    },
    [compte, tiers, du, au, exercice, avecPrecedent, revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Interrogation du compte…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, interrogeables, exercices, interrogation, echec } = donnees;

  const lignesCsv = (): (readonly CelluleCsv[])[] => {
    if (!interrogation) {
      return [["Interrogation de compte"], ["Dossier", contexte.numero], ["Compte", compte], [], [echec ?? ""]];
    }
    return [
      ["Interrogation de compte"],
      ["Dossier", contexte.numero],
      ["Société", contexte.societe.raisonSociale],
      ["Compte", interrogation.comptePrincipal, interrogation.libelle],
      ["Tiers", interrogation.tiersCode ?? "tous les segments"],
      [
        "Fenêtre",
        interrogation.du ? formaterDateFr(interrogation.du) : "origine",
        interrogation.au ? formaterDateFr(interrogation.au) : "fin d'exercice"
      ],
      ["Exercices", interrogation.exercices.join(", ")],
      ["Solde d'ouverture", interrogation.soldeInitial, interrogation.sensInitial],
      [],
      [
        "Exercice",
        "Période",
        "Date",
        "Pièce",
        "Journal",
        "Lot",
        "Libellé",
        "Tiers",
        "Débit",
        "Crédit",
        "Solde",
        "Sens",
        "Lettrage",
        "Pointage",
        "Exercice clos"
      ],
      ["", "", "", "", "", "", "À nouveau", "", "", "", interrogation.soldeInitial, interrogation.sensInitial, "", "", ""],
      ...interrogation.lignes.map((ligne) => [
        ligne.exercice,
        ligne.periode,
        ligne.date,
        ligne.piece,
        ligne.journalCode,
        ligne.lotNumero,
        ligne.libelle,
        ligne.tiersCode ?? "",
        ligne.debit,
        ligne.credit,
        ligne.soldeProgressif,
        formaterSens(ligne.sens),
        ligne.lettrage ?? "",
        ligne.pointage ?? "",
        ligne.exerciceClos ? "oui" : "non"
      ]),
      [
        "",
        "",
        "",
        "",
        "",
        "",
        `Total — ${interrogation.lignes.length} ligne(s)`,
        "",
        interrogation.totalDebit,
        interrogation.totalCredit,
        interrogation.soldeFinal,
        formaterSens(interrogation.sensFinal),
        "",
        "",
        ""
      ],
      [],
      ["Exercice", "Du", "Au", "Total débit", "Total crédit", "Solde", "Mouvements", "État"],
      ...interrogation.reports.map((report) => [
        report.exercice,
        report.dateDebut ?? "",
        report.dateFin ?? "",
        report.totalDebit,
        report.totalCredit,
        report.solde,
        report.mouvements,
        report.clos ? "clos" : "en cours"
      ])
    ];
  };

  const colonnesLignes: Colonne<LigneInterrogation>[] = [
    { cle: "exercice", titre: "Ex.", alignement: "centre", largeur: "4rem", valeur: (ligne) => ligne.exercice },
    { cle: "periode", titre: "Pér.", alignement: "centre", largeur: "4rem", valeur: (ligne) => ligne.periode },
    { cle: "date", titre: "Date", largeur: "7rem", valeur: (ligne) => formaterDateFr(ligne.date) },
    { cle: "piece", titre: "Pièce", largeur: "8rem", valeur: (ligne) => <span class="mono">{ligne.piece}</span> },
    {
      cle: "journal",
      titre: "Journal",
      alignement: "centre",
      largeur: "5rem",
      valeur: (ligne) => <span class="mono">{ligne.journalCode}</span>
    },
    { cle: "libelle", titre: "Libellé", valeur: (ligne) => ligne.libelle },
    {
      cle: "tiers",
      titre: "Tiers",
      alignement: "centre",
      largeur: "5rem",
      valeur: (ligne) => <span class="mono">{ligne.tiersCode ?? ""}</span>
    },
    {
      cle: "debit",
      titre: "Débit",
      alignement: "droite",
      largeur: "9rem",
      valeur: (ligne) => (ligne.debit === ZERO ? "" : montant(ligne.debit))
    },
    {
      cle: "credit",
      titre: "Crédit",
      alignement: "droite",
      largeur: "9rem",
      valeur: (ligne) => (ligne.credit === ZERO ? "" : montant(ligne.credit))
    },
    {
      cle: "solde",
      titre: "Solde",
      alignement: "droite",
      largeur: "10rem",
      valeur: (ligne) => (
        <strong class="mono">
          {ligne.soldeProgressif < ZERO ? "-" : ""}
          {montant(ligne.soldeProgressif < ZERO ? -ligne.soldeProgressif : ligne.soldeProgressif)}
        </strong>
      )
    },
    {
      cle: "lettrage",
      titre: "Lettré",
      alignement: "centre",
      largeur: "5rem",
      valeur: (ligne) => (ligne.lettrage ? <span class="mono">{ligne.lettrage}</span> : "—")
    },
    {
      cle: "pointage",
      titre: "Pointé",
      alignement: "centre",
      largeur: "6rem",
      valeur: (ligne) => (ligne.pointage ? <Etiquette ton="succes">relevé</Etiquette> : "—")
    },
    {
      cle: "clos",
      titre: "Exercice clos",
      alignement: "centre",
      largeur: "6rem",
      valeur: (ligne) => (ligne.exerciceClos ? <Etiquette ton="alerte">figé</Etiquette> : "")
    }
  ];

  const colonnesReports: Colonne<ReportExercice>[] = [
    { cle: "exercice", titre: "Exercice", largeur: "6rem", valeur: (report) => <strong>{report.exercice}</strong> },
    {
      cle: "periode",
      titre: "Période",
      largeur: "14rem",
      valeur: (report) =>
        report.dateDebut && report.dateFin
          ? `${formaterDateFr(report.dateDebut)} – ${formaterDateFr(report.dateFin)}`
          : "aucun mouvement"
    },
    {
      cle: "debit",
      titre: "Total débit",
      alignement: "droite",
      largeur: "10rem",
      valeur: (report) => montant(report.totalDebit)
    },
    {
      cle: "credit",
      titre: "Total crédit",
      alignement: "droite",
      largeur: "10rem",
      valeur: (report) => montant(report.totalCredit)
    },
    {
      cle: "solde",
      titre: "Solde reporté",
      alignement: "droite",
      largeur: "11rem",
      valeur: (report) => (
        <strong class="mono">
          {report.solde < ZERO ? "-" : ""}
          {montant(report.solde < ZERO ? -report.solde : report.solde)}
        </strong>
      )
    },
    {
      cle: "mouvements",
      titre: "Mouvements",
      alignement: "centre",
      largeur: "7rem",
      valeur: (report) => report.mouvements
    },
    {
      cle: "etat",
      titre: "État",
      alignement: "centre",
      largeur: "7rem",
      valeur: (report) =>
        report.clos ? <Etiquette ton="alerte">clos</Etiquette> : <Etiquette ton="succes">en cours</Etiquette>
    }
  ];

  const interrogeable = interrogeables.find((item) => item.compte === compte.trim().split("-")[0]);
  const tiersDisponibles: string[] = interrogeable?.tiers ?? [];

  return (
    <Fenetre
      titre="Interrogation de compte"
      chemin="Interrogation › Compte et historique"
      sousTitre={`Dossier ${contexte.numero} · exercice ${contexte.exercice} · montants en ${contexte.devise}`}
      actions={
        <>
          <label class="champ-court">
            Compte
            <input
              class="mono"
              list="comptes-qui-ont-bouge"
              value={compte}
              placeholder="401100-FOU01"
              onChange={(evenement) => setCompte(evenement.currentTarget.value)}
            />
            <datalist id="comptes-qui-ont-bouge">
              {interrogeables.map((item: CompteInterrogeable) => (
                <option key={item.compte} value={item.compte}>
                  {item.libelle} — {item.mouvements} mouvement(s)
                </option>
              ))}
            </datalist>
          </label>
          <label class="champ-court">
            Tiers
            <select
              value={tiers}
              onChange={(evenement) => setTiers(evenement.currentTarget.value)}
              title={
                tiersDisponibles.length === 0
                  ? "Aucun tiers n'est vu sur ce compte pour l'exercice courant"
                  : "Restreindre l'interrogation à un tiers"
              }
            >
              <option value="">Tous les tiers</option>
              {tiersDisponibles.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label class="champ-court">
            Exercice
            <select value={exercice} onChange={(evenement) => setExercice(evenement.currentTarget.value)}>
              <option value="">En cours ({contexte.exercice})</option>
              {exercices.map((item) => (
                <option key={item.exercice.annee} value={item.exercice.annee}>
                  {item.exercice.annee}
                  {item.clos ? " — clos" : " — en cours"}
                </option>
              ))}
            </select>
          </label>
          <label class="champ-court">
            Du
            <input type="date" value={du} onChange={(evenement) => setDu(evenement.currentTarget.value)} />
          </label>
          <label class="champ-court">
            Au
            <input type="date" value={au} onChange={(evenement) => setAu(evenement.currentTarget.value)} />
          </label>
          <label class="case-a-cocher">
            <input
              type="checkbox"
              checked={avecPrecedent}
              onChange={(evenement) => setAvecPrecedent(evenement.currentTarget.checked)}
            />
            Comparer à l'exercice précédent
          </label>
          <Exporter
            tige="interrogation"
            contexte={`${compte.trim()}${tiers ? `-${tiers}` : ""}`}
            date={aujourdHui}
            lignes={lignesCsv}
            sousTitre="Ce qui s'est passé sur ce compte, et ce qui reste en suspens"
            titresDeSection={["Mouvements, avec le solde après chaque ligne", "Historique par exercice"]}
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

      {interrogation === null ? (
        <div class="bloc">
          <h2>Interrogation impossible</h2>
          <p class="avertissement">{echec}</p>
          <p class="note">
            Les comptes qui ont bougé dans l'exercice courant sont proposés dans la liste déroulante ;
            un numéro segmenté s'écrit tel quel, par exemple <span class="mono">401100-FOU01</span>.
          </p>
        </div>
      ) : (
        <>
          <div class="bloc">
            <h2>
              {interrogation.comptePrincipal} — {interrogation.libelle}
              {interrogation.tiersCode ? ` · ${interrogation.tiersCode}` : ""}
            </h2>
            <p class="note">
              Classe {interrogation.classe} · groupe <span class="mono">{interrogation.groupe}</span> · fenêtre{" "}
              {interrogation.du ? formaterDateFr(interrogation.du) : "origine du dossier"} au{" "}
              {interrogation.au ? formaterDateFr(interrogation.au) : "terme demandé"} · exercices{" "}
              {interrogation.exercices.join(", ")}
            </p>
            <dl class="liste-definition">
              <dt>Solde d'ouverture de la fenêtre</dt>
              <dd class="mono">
                {interrogation.soldeInitial < ZERO ? "-" : ""}
                {montant(
                  interrogation.soldeInitial < ZERO ? -interrogation.soldeInitial : interrogation.soldeInitial
                )}{" "}
                ({formaterSens(interrogation.sensInitial)})
              </dd>
              <dt>Mouvements de la fenêtre</dt>
              <dd>
                {interrogation.lignes.length} ligne(s) — débit {montant(interrogation.totalDebit)}, crédit{" "}
                {montant(interrogation.totalCredit)}
              </dd>
              <dt>Solde à la fin de la fenêtre</dt>
              <dd class="mono">
                <strong>
                  {interrogation.soldeFinal < ZERO ? "-" : ""}
                  {montant(interrogation.soldeFinal < ZERO ? -interrogation.soldeFinal : interrogation.soldeFinal)}
                </strong>{" "}
                ({formaterSens(interrogation.sensFinal)})
              </dd>
              <dt>Reste à lettrer</dt>
              <dd class="mono">
                {interrogation.nonLettre < ZERO ? "-" : ""}
                {montant(interrogation.nonLettre < ZERO ? -interrogation.nonLettre : interrogation.nonLettre)}
              </dd>
              <dt>Reste à pointer en banque</dt>
              <dd class="mono">
                {interrogation.nonPointe < ZERO ? "-" : ""}
                {montant(interrogation.nonPointe < ZERO ? -interrogation.nonPointe : interrogation.nonPointe)}
              </dd>
            </dl>
            {interrogation.avertissements.length > 0 ? (
              <ul class="note">
                {interrogation.avertissements.map((avertissement) => (
                  <li key={avertissement}>{avertissement}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div class="bloc">
            <h2>Mouvements, avec le solde après chaque ligne</h2>
            <Grille
              colonnes={colonnesLignes}
              lignes={interrogation.lignes}
              cleDe={(ligne) => ligne.ligneId}
              vide="Néant : aucun mouvement ne correspond à ces critères."
              pied={
                <>
                  <tr class="niveau-detail">
                    <th scope="row" colSpan={7}>
                      À nouveau — solde d'ouverture de la fenêtre
                    </th>
                    <td class="align-droite mono" />
                    <td class="align-droite mono" />
                    <td class="align-droite mono">
                      {interrogation.soldeInitial < ZERO ? "-" : ""}
                      {montant(
                        interrogation.soldeInitial < ZERO ? -interrogation.soldeInitial : interrogation.soldeInitial
                      )}
                    </td>
                    <td colSpan={3} />
                  </tr>
                  <tr class="niveau-total">
                    <th scope="row" colSpan={7}>
                      Total — {interrogation.lignes.length} ligne(s)
                    </th>
                    <td class="align-droite mono">{montant(interrogation.totalDebit)}</td>
                    <td class="align-droite mono">{montant(interrogation.totalCredit)}</td>
                    <td class="align-droite mono">
                      <strong>
                        {interrogation.soldeFinal < ZERO ? "-" : ""}
                        {montant(
                          interrogation.soldeFinal < ZERO ? -interrogation.soldeFinal : interrogation.soldeFinal
                        )}
                      </strong>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </>
              }
            />
            <p class="note">
              « Lettré » porte le code de la marque qui rapproche cette ligne ; « Pointé » dit qu'un
              relevé bancaire l'a rapprochée ; « figé » signale une ligne d'un exercice clos, qui ne
              bougera plus.
            </p>
          </div>

          <div class="bloc">
            <h2>Historique par exercice</h2>
            {interrogation.reports.length === 0 ? (
              <Vide>Aucun exercice à comparer.</Vide>
            ) : (
              <>
                <Grille colonnes={colonnesReports} lignes={interrogation.reports} cleDe={(report) => report.exercice.toString()} />
                <p class="note">
                  Le solde reporté cumule tout ce qui précède la fin de l'exercice : c'est ce que la
                  clôture reporte à l'ouverture de l'exercice suivant, compte par compte et segment de
                  tiers compris. Cochez « Comparer à l'exercice précédent » pour faire entrer l'exercice
                  précédent dans les mouvements ci-dessus.
                </p>
              </>
            )}
          </div>
        </>
      )}
    </Fenetre>
  );
}
