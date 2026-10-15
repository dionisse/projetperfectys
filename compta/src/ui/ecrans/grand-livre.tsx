import { useState } from "preact/hooks";
import {
  additionner,
  type Compte,
  type DateCivile,
  type LigneGrandLivre
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  ExportCsv,
  Fenetre,
  Grille,
  montant,
  useAsync,
  type Colonne
} from "../composants";

/** Grand livre d'un compte, avec solde progressif : le contrôle ligne à ligne d'un compte. */
export function GrandLivre() {
  const service = getService();
  const [compte, setCompte] = useState("521100");
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;
  const [soumis, setSoumis] = useState("521100");
  const { donnees, erreur, recharger } = useAsync(
    async () => ({
      lignes: await service.grandLivre(soumis),
      plan: await service.planComptable()
    }),
    [soumis]
  );

  const colonnes: Colonne<LigneGrandLivre>[] = [
    { cle: "date", titre: "Date", largeur: "8rem", valeur: (ligne) => ligne.date },
    { cle: "piece", titre: "Pièce", largeur: "10rem", valeur: (ligne) => <span class="mono">{ligne.piece}</span> },
    { cle: "journal", titre: "Journal", alignement: "centre", largeur: "6rem", valeur: (ligne) => ligne.journalCode },
    { cle: "lot", titre: "Lot", largeur: "7rem", valeur: (ligne) => <span class="mono">{ligne.lotNumero}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (ligne) => ligne.libelle },
    { cle: "tiers", titre: "Tiers", largeur: "7rem", valeur: (ligne) => ligne.tiersCode ?? "—" },
    { cle: "debit", titre: "Débit", alignement: "droite", largeur: "10rem", valeur: (ligne) => (ligne.debit === 0n ? "" : montant(ligne.debit)) },
    { cle: "credit", titre: "Crédit", alignement: "droite", largeur: "10rem", valeur: (ligne) => (ligne.credit === 0n ? "" : montant(ligne.credit)) },
    { cle: "solde", titre: "Solde", alignement: "droite", largeur: "10rem", valeur: (ligne) => <strong class="mono">{montant(ligne.soldeProgressif)}</strong> },
    { cle: "sens", titre: "Sens", alignement: "centre", largeur: "7rem", valeur: (ligne) => (ligne.sens === "nul" ? "Soldé" : ligne.sens === "debiteur" ? "Débiteur" : "Créditeur") }
  ];

  const lignes = donnees?.lignes ?? [];
  const totalDebit = additionner(...lignes.map((ligne) => ligne.debit));
  const totalCredit = additionner(...lignes.map((ligne) => ligne.credit));
  const compteRetenu: Compte | null = donnees?.plan.find((item) => item.comptePrincipal === soumis.split("-")[0]) ?? null;

  return (
    <Fenetre
      titre="Grand livre"
      chemin="Interrogation › Grand livre"
      sousTitre="Tous les mouvements comptabilisés d'un compte, y compris ceux de ses comptes auxiliaires, avec le solde progressif."
      actions={
        <>
        <form
          class="recherche"
          onSubmit={(evenement) => {
            evenement.preventDefault();
            setSoumis(compte.trim());
          }}
        >
          <label for="compte-grand-livre">Compte</label>
          <input
            id="compte-grand-livre"
            list="liste-comptes"
            value={compte}
            onInput={(evenement) => setCompte((evenement.target as HTMLInputElement).value)}
          />
          <datalist id="liste-comptes">
            {(donnees?.plan ?? []).map((item) => (
              <option key={item.numero} value={item.numero}>
                {item.libelle}
              </option>
            ))}
          </datalist>
          <button class="bouton" type="submit">
            Afficher
          </button>
        </form>
        <ExportCsv
          tige="grand-livre"
          contexte={soumis}
          date={aujourdHui}
          lignes={() => [
            ["Grand livre", soumis],
            [],
            ["Date", "Pièce", "Journal", "Lot", "Tiers", "Libellé", "Débit", "Crédit", "Solde progressif", "Sens"],
            ...lignes.map((ligne) => [
              ligne.date,
              ligne.piece,
              ligne.journalCode,
              ligne.lotNumero,
              ligne.tiersCode,
              ligne.libelle,
              ligne.debit,
              ligne.credit,
              ligne.soldeProgressif,
              ligne.sens
            ]),
            [],
            ["Totaux", null, null, null, null, null, totalDebit, totalCredit, totalDebit - totalCredit, null]
          ]}
        />
        </>
      }
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Établissement du grand livre…" /> : null}
      {donnees ? (
        <>
          <p class="structure">
            {compteRetenu ? (
              <>
                Compte <span class="mono">{compteRetenu.numero}</span> — {compteRetenu.libelle} ·{" "}
                classe {compteRetenu.classe} · groupe <span class="mono">{compteRetenu.groupe}</span> ·{" "}
                {compteRetenu.exigeTiers ? (
                  <Etiquette ton="info">compte auxiliaire</Etiquette>
                ) : (
                  <Etiquette>compte général</Etiquette>
                )}
              </>
            ) : (
              <>Compte <span class="mono">{soumis}</span></>
            )}
          </p>
          <Grille
            colonnes={colonnes}
            lignes={lignes}
            cleDe={(ligne, ) => `${ligne.date}-${ligne.piece}-${ligne.libelle}`}
            vide="Aucun mouvement comptabilisé sur ce compte."
            pied={
              <tr>
                <th scope="row" colSpan={6}>
                  {lignes.length} mouvement(s)
                </th>
                <td class="align-droite mono">{montant(totalDebit)}</td>
                <td class="align-droite mono">{montant(totalCredit)}</td>
                <td class="align-droite mono">{montant(totalDebit - totalCredit)}</td>
                <td />
              </tr>
            }
          />
        </>
      ) : null}
    </Fenetre>
  );
}
