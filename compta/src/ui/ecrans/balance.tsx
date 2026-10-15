import { useState } from "preact/hooks";
import { ZERO, additionner, type LigneBalance } from "../../noyau/index";
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

/** Balance générale, filtrable par période : le contrôle d'équilibre avant toute édition. */
export function Balance() {
  const service = getService();
  const [periode, setPeriode] = useState<number | "toutes">("toutes");
  const { donnees, erreur, recharger } = useAsync(
    () => service.balance(periode === "toutes" ? {} : { periode }),
    [periode]
  );

  const colonnes: Colonne<LigneBalance>[] = [
    { cle: "compte", titre: "Compte", largeur: "8rem", valeur: (ligne) => <span class="mono">{ligne.compte}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (ligne) => ligne.libelle },
    { cle: "classe", titre: "Classe", alignement: "centre", largeur: "5rem", valeur: (ligne) => ligne.classe },
    { cle: "groupe", titre: "Groupe", largeur: "9rem", valeur: (ligne) => <span class="mono">{ligne.groupe}</span> },
    { cle: "initial", titre: "Solde initial", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.soldeInitial) },
    { cle: "debit", titre: "Débit", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.totalDebit) },
    { cle: "credit", titre: "Crédit", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.totalCredit) },
    { cle: "solde", titre: "Solde", alignement: "droite", largeur: "10rem", valeur: (ligne) => <strong class="mono">{montant(ligne.solde)}</strong> },
    { cle: "sens", titre: "Sens", alignement: "centre", largeur: "7rem", valeur: (ligne) => (ligne.sens === "nul" ? "Soldé" : ligne.sens === "debiteur" ? "Débiteur" : "Créditeur") }
  ];

  const lignes = donnees ?? [];
  const totalDebit = additionner(...lignes.map((ligne) => ligne.totalDebit));
  const totalCredit = additionner(...lignes.map((ligne) => ligne.totalCredit));
  const totalInitial = additionner(...lignes.map((ligne) => ligne.soldeInitial));
  const equilibre = totalDebit === totalCredit;

  return (
    <Fenetre
      titre="Balance générale"
      chemin="Interrogation › Balance"
      sousTitre="Seuls les mouvements comptabilisés apparaissent : un brouillon ne modifie jamais une balance."
      actions={
        <label class="champ-court">
          Période
          <select
            value={String(periode)}
            onChange={(evenement) => {
              const valeur = (evenement.target as HTMLSelectElement).value;
              setPeriode(valeur === "toutes" ? "toutes" : Number(valeur));
            }}
          >
            <option value="toutes">Toutes</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((numero) => (
              <option key={numero} value={numero}>
                Période {numero}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Établissement de la balance…" /> : null}
      {donnees ? (
        <>
          <Grille
            colonnes={colonnes}
            lignes={donnees}
            cleDe={(ligne) => ligne.compte}
            vide={periode === "toutes" ? "Aucun mouvement comptabilisé." : "Aucun mouvement sur cette période."}
            pied={
              <tr>
                <th scope="row">{donnees.length} comptes</th>
                <td colSpan={3} />
                <td class="align-droite mono">{montant(totalInitial)}</td>
                <td class="align-droite mono">{montant(totalDebit)}</td>
                <td class="align-droite mono">{montant(totalCredit)}</td>
                <td class="align-droite mono">{montant(totalDebit - totalCredit)}</td>
                <td class="align-centre">
                  {equilibre ? <Etiquette ton="succes">Équilibrée</Etiquette> : <Etiquette ton="alerte">Déséquilibrée</Etiquette>}
                </td>
              </tr>
            }
          />
          <p class="note">
            Les comptes sans mouvement et sans solde initial ne sont pas affichés : une balance de
            {donnees.length === 0 ? " zéro" : ` ${donnees.length}`} ligne(s) doit rester lisible.
            Solde = débit − crédit, solde initial compris{totalInitial === ZERO ? "" : ` (${montant(totalInitial)} reportés)`}.
          </p>
        </>
      ) : null}
    </Fenetre>
  );
}
