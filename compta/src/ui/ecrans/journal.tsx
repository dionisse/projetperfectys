import { useState } from "preact/hooks";
import type { DateCivile, PieceDeJournal } from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Fenetre,
  Grille,
  montant,
  useAsync,
  type Colonne
} from "../composants";
import { Exporter } from "../exporter";

/** Journal des écritures comptabilisées, par pièce, avec le détail de la pièce sélectionnée. */
export function Journal() {
  const service = getService();
  const [journalCode, setJournalCode] = useState("");
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;
  const [selection, setSelection] = useState<string | null>(null);
  const { donnees, erreur, recharger } = useAsync(
    async () => ({
      pieces: await service.journal(journalCode === "" ? {} : { journalCode }),
      journaux: await service.journaux()
    }),
    [journalCode]
  );

  const colonnes: Colonne<PieceDeJournal>[] = [
    { cle: "date", titre: "Date", largeur: "8rem", valeur: (piece) => piece.date },
    { cle: "piece", titre: "Pièce", largeur: "10rem", valeur: (piece) => <span class="mono">{piece.piece}</span> },
    { cle: "journal", titre: "Journal", alignement: "centre", largeur: "6rem", valeur: (piece) => piece.journalCode },
    { cle: "lot", titre: "Lot", largeur: "7rem", valeur: (piece) => <span class="mono">{piece.lotNumero}</span> },
    { cle: "lignes", titre: "Lignes", alignement: "droite", largeur: "6rem", valeur: (piece) => piece.lignes.length },
    { cle: "debit", titre: "Débit", alignement: "droite", largeur: "10rem", valeur: (piece) => montant(piece.totalDebit) },
    { cle: "credit", titre: "Crédit", alignement: "droite", largeur: "10rem", valeur: (piece) => montant(piece.totalCredit) }
  ];

  const piece = donnees?.pieces.find((item) => `${item.journalCode}|${item.date}|${item.piece}` === selection) ?? null;

  const colonnesLignes: Colonne<PieceDeJournal["lignes"][number]>[] = [
    { cle: "compte", titre: "Compte", largeur: "12rem", valeur: (ligne) => <span class="mono">{ligne.compte}</span> },
    { cle: "libelle", titre: "Libellé", valeur: (ligne) => ligne.libelle },
    { cle: "tiers", titre: "Tiers", largeur: "7rem", valeur: (ligne) => ligne.tiersCode ?? "—" },
    { cle: "debit", titre: "Débit", alignement: "droite", largeur: "10rem", valeur: (ligne) => (ligne.debit === 0n ? "" : montant(ligne.debit)) },
    { cle: "credit", titre: "Crédit", alignement: "droite", largeur: "10rem", valeur: (ligne) => (ligne.credit === 0n ? "" : montant(ligne.credit)) }
  ];

  return (
    <Fenetre
      titre="Journal des écritures"
      chemin="Interrogation › Journal"
      sousTitre="Les écritures comptabilisées, regroupées par pièce, dans l'ordre chronologique puis par référence."
      actions={
        <>
        <label class="champ-court">
          Journal
          <select value={journalCode} onChange={(evenement) => setJournalCode((evenement.target as HTMLSelectElement).value)}>
            <option value="">Tous</option>
            {(donnees?.journaux ?? []).map((item) => (
              <option key={item.code} value={item.code}>
                {item.code} — {item.libelle}
              </option>
            ))}
          </select>
        </label>
        <Exporter
          tige="journal"
          contexte={journalCode === "" ? "tous-journaux" : journalCode}
          date={aujourdHui}
          lignes={() => [
            ["Journal des écritures comptabilisées", journalCode === "" ? "tous les journaux" : journalCode],
            [],
            ["Date", "Pièce", "Journal", "Lot", "N° écriture", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
            ...(donnees?.pieces ?? []).flatMap((piece) =>
              piece.lignes.map((ligne) => [
                piece.date,
                piece.piece,
                piece.journalCode,
                piece.lotNumero,
                piece.ecritureNumero,
                ligne.compte,
                ligne.tiersCode,
                ligne.libelle,
                ligne.debit,
                ligne.credit
              ])
            )
          ]}
        />
        </>
      }
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Établissement du journal…" /> : null}
      {donnees ? (
        <>
          <Grille
            colonnes={colonnes}
            lignes={donnees.pieces}
            cleDe={(item) => `${item.journalCode}|${item.date}|${item.piece}`}
            selection={selection}
            surSelection={(cle) => setSelection(cle)}
            vide="Aucune écriture comptabilisée ne correspond à ce filtre."
          />
          {piece ? (
            <section class="bloc">
              <h2>
                Pièce {piece.piece} — {piece.date} — journal {piece.journalCode} — lot {piece.lotNumero}
              </h2>
              <Grille
                colonnes={colonnesLignes}
                lignes={piece.lignes}
                cleDe={(ligne, ) => `${ligne.compte}-${ligne.libelle}`}
                pied={
                  <tr>
                    <th scope="row" colSpan={3}>
                      Totaux de la pièce
                    </th>
                    <td class="align-droite mono">{montant(piece.totalDebit)}</td>
                    <td class="align-droite mono">{montant(piece.totalCredit)}</td>
                  </tr>
                }
              />
            </section>
          ) : (
            <p class="note">Sélectionnez une pièce pour afficher ses lignes.</p>
          )}
        </>
      ) : null}
    </Fenetre>
  );
}
