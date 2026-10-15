/**
 * Compte de résultat — États › Compte de résultat OHADA révisé.
 *
 * Les rubriques suivent l'ordre du modèle révisé : produits et charges d'exploitation, résultat
 * d'exploitation, financier, des activités ordinaires, hors activités ordinaires, avant impôts,
 * impôts sur les résultats, résultat net. Chaque résultat est la somme de rubriques déjà
 * présentées : rien n'est calculé dans l'écran.
 *
 * Le contrôle affiché en pied dit que le résultat présenté égale la somme algébrique des comptes de
 * gestion de la balance, et rappelle qu'il ne sera porté au compte 121000 qu'à la clôture de
 * l'exercice.
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

export function CompteDeResultatOhada() {
  const service = getService();
  const [periode, setPeriode] = useState<number | "exercice">("exercice");

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const etat = await service.lire();
      const contexte = await service.contexte();
      return {
        contexte,
        resultat: await service.compteDeResultat(periode === "exercice" ? undefined : periode),
        periodes: etat.exercice.periodes.filter((item) => item.type === "normale")
      };
    },
    [periode]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Établissement du compte de résultat…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, resultat } = donnees;
  const controleConforme = resultat.controle.ecart === 0n;

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Compte de résultat — SYSCOHADA révisé"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Exercice", resultat.exercice],
    ["Du", formaterDateFr(resultat.dateDebut), "au", formaterDateFr(resultat.dateFin)],
    ["Devise", contexte.devise],
    [],
    ["Niveau", "Rubrique", "Montant"],
    ...resultat.lignes.map((item) => [item.niveau, item.libelle, item.net]),
    [],
    ["Résultat d'exploitation", resultat.resultatExploitation],
    ["Résultat financier", resultat.resultatFinancier],
    ["Résultat des activités ordinaires", resultat.resultatActivitesOrdinaires],
    ["Résultat hors activités ordinaires", resultat.resultatHorsActivitesOrdinaires],
    ["Résultat avant impôts", resultat.resultatAvantImpots],
    ["Impôts sur les résultats", resultat.impotsSurLesResultats],
    ["Résultat net", resultat.resultatNet],
    [],
    ["Contrôle : somme des comptes de gestion", resultat.controle.attendu],
    ["Contrôle : résultat présenté", resultat.controle.presente],
    ["Contrôle : écart", resultat.controle.ecart]
  ];

  return (
    <Fenetre
      titre="Compte de résultat"
      chemin="États › Compte de résultat OHADA révisé"
      sousTitre={`Exercice ${resultat.exercice} · du ${formaterDateFr(resultat.dateDebut)} au ${formaterDateFr(
        resultat.dateFin
      )} · montants en ${contexte.devise} · ${contexte.societe.raisonSociale}`}
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
              <option value="exercice">Exercice complet</option>
              {donnees.periodes.map((item) => (
                <option key={item.numero} value={item.numero}>
                  Cumul à fin de période {item.numero} — {item.libelle}
                </option>
              ))}
            </select>
          </label>
          <ExportCsv
            tige="compte-de-resultat"
            contexte={`${contexte.societe.code}-${resultat.exercice}`}
            date={resultat.dateFin}
            lignes={lignesCsv}
          />
          <button class="bouton" type="button" onClick={() => recharger()}>
            Actualiser
          </button>
        </>
      }
    >
      <div class="bloc">
        <h2>Compte de résultat</h2>
        <div class="grille-conteneur">
          <table class="grille grille-etat">
            <thead>
              <tr>
                <th>Rubrique</th>
                <th class="align-droite" style={{ width: "12rem" }}>
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.map((item: LigneEtat) => (
                <tr class={`niveau-${item.niveau}`} key={item.code}>
                  <td>
                    {item.libelle}
                    {item.comptes.length > 0 ? (
                      <span class="note-ligne">
                        {" "}
                        · {item.comptes.length} compte{item.comptes.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </td>
                  <td class="align-droite mono">{montant(item.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Résultat net de l'exercice</th>
                <td class="align-droite mono">
                  <strong>{montant(resultat.resultatNet)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {controleConforme ? (
        <p class="retour succes" role="status">
          Contrôle conforme : le résultat présenté ({montant(resultat.controle.presente)}) égale la
          somme algébrique des comptes de gestion de la balance. Il sera porté au compte 121000 —
          Résultat de l'exercice — par la clôture, et non avant.
        </p>
      ) : (
        <div class="bloc avertissement">
          <h2>Contrôle du résultat en écart</h2>
          <p class="note">
            Somme des comptes de gestion {montant(resultat.controle.attendu)} · résultat présenté{" "}
            {montant(resultat.controle.presente)} · écart{" "}
            <strong>{montant(resultat.controle.ecart)}</strong>. Un compte de gestion n'est rattaché
            à aucune rubrique du modèle : vérifiez le groupe de ce compte dans le plan comptable.
          </p>
        </div>
      )}

      <div class="bloc">
        <h2>Détail des rubriques mouvementées</h2>
        {resultat.lignes.filter((item) => item.comptes.length > 0).length === 0 ? (
          <p class="note">Aucun compte de gestion mouvementé : le compte de résultat est néant.</p>
        ) : (
          <table class="grille">
            <thead>
              <tr>
                <th>Rubrique</th>
                <th>Compte</th>
                <th>Libellé</th>
                <th>Groupe</th>
                <th class="align-droite">Solde</th>
                <th class="align-droite">Présenté</th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.flatMap((item) =>
                item.comptes.map((compte) => (
                  <tr key={`${item.code}-${compte.numero}`}>
                    <td>{item.libelle}</td>
                    <td class="mono">{compte.numero}</td>
                    <td>{compte.libelle}</td>
                    <td class="mono">{compte.groupe}</td>
                    <td class="align-droite mono">{montant(compte.solde)}</td>
                    <td class="align-droite mono">{montant(compte.presente)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <p class="note">
        L'impôt sur les résultats n'est pas calculé ici : le montant porté sur la ligne « Impôts sur
        les résultats » est celui comptabilisé. Le minimum de perception, le taux réduit et les
        régimes spécifiques du Bénin figurent dans l'écran Structure › Codes de taxe, avec leur
        statut « à confirmer ». Le tableau des flux de trésorerie et les notes annexes ne sont pas
        produits : le plan de démarrage ne porte pas encore la classification de flux qu'ils
        exigent, et inventer une présentation serait pire que de l'annoncer absente.
      </p>
    </Fenetre>
  );
}
