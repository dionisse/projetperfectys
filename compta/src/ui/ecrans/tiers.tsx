import { useState } from "preact/hooks";
import { formaterTaux, LIBELLES_TYPE_TIERS, type Tiers as TiersType } from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  Fenetre,
  Grille,
  useAsync,
  type Colonne
} from "../composants";

/**
 * Fichier des tiers.
 *
 * Le fichier est unique et typé : un même acteur peut être client et fournisseur. La sélection
 * d'un tiers affiche les **codes de taxe réellement applicables** à une opération avec lui — c'est
 * là que le paquet pays se voit, notamment la retenue majorée de 5 % sur un tiers non immatriculé
 * à l'IFU.
 */
export function Tiers() {
  const service = getService();
  const [selection, setSelection] = useState<string | null>(null);
  const [operation, setOperation] = useState<"achat" | "vente">("achat");
  const { donnees, erreur, recharger } = useAsync(() => service.listeTiers(), []);

  const tiers = donnees?.find((item) => item.code === selection) ?? null;
  const codes = tiers
    ? service.codesTaxePour({
        operation,
        tiersImmatricule: tiers.immatricule,
        tiersPublic: tiers.type === "etat",
        exportation: false
      })
    : [];

  const colonnes: Colonne<TiersType>[] = [
    { cle: "code", titre: "Code", largeur: "6rem", valeur: (item) => <span class="mono">{item.code}</span> },
    { cle: "nom", titre: "Nom", valeur: (item) => item.nom },
    { cle: "type", titre: "Type", largeur: "12rem", valeur: (item) => LIBELLES_TYPE_TIERS[item.type] },
    {
      cle: "ifu",
      titre: service.paquetPays.regleIdentifiantFiscal.nom,
      largeur: "12rem",
      valeur: (item) => (item.identifiantFiscal ? <span class="mono">{item.identifiantFiscal}</span> : "—")
    },
    {
      cle: "immatricule",
      titre: "Immatriculé",
      alignement: "centre",
      largeur: "9rem",
      valeur: (item) =>
        item.immatricule ? <Etiquette ton="succes">Oui</Etiquette> : <Etiquette ton="alerte">Non</Etiquette>
    },
    { cle: "ville", titre: "Ville", largeur: "10rem", valeur: (item) => item.ville || "—" },
    {
      cle: "actif",
      titre: "État",
      alignement: "centre",
      largeur: "6rem",
      valeur: (item) => (item.actif ? "Actif" : "Inactif")
    }
  ];

  return (
    <Fenetre
      titre="Fichier des tiers"
      chemin="Structure › Tiers"
      sousTitre="Un compte auxiliaire exige un tiers existant et actif : sans cela, le lettrage et les relevés ne peuvent pas être établis."
      actions={
        <div class="segment-choix" role="group" aria-label="Opération retenue pour le calcul des taxes">
          <button
            type="button"
            class={operation === "achat" ? "actif" : undefined}
            aria-pressed={operation === "achat"}
            onClick={() => setOperation("achat")}
          >
            Achat
          </button>
          <button
            type="button"
            class={operation === "vente" ? "actif" : undefined}
            aria-pressed={operation === "vente"}
            onClick={() => setOperation("vente")}
          >
            Vente
          </button>
        </div>
      }
    >
      {erreur ? <Erreur message={erreur} onRetry={recharger} /> : null}
      {!donnees ? <ChargementEnCours libelle="Lecture du fichier des tiers…" /> : null}
      {donnees ? (
        <>
          <Grille
            colonnes={colonnes}
            lignes={donnees}
            cleDe={(item) => item.code}
            selection={selection}
            surSelection={(cle) => setSelection(cle)}
            vide="Aucun tiers dans ce dossier."
          />
          {tiers ? (
            <section class="bloc panneau-lateral">
              <h2>
                {tiers.nom} — codes de taxe applicables à un {operation}
              </h2>
              {codes.length === 0 ? (
                <p class="note">Aucun code de taxe ne s'applique à cette opération avec ce tiers.</p>
              ) : (
                <ul class="liste-codes">
                  {codes.map((code) => (
                    <li key={code.code}>
                      <span class="mono">{code.code}</span>
                      <span>{code.libelle}</span>
                      <span class="taux">{formaterTaux(code.pointsDeBase)}</span>
                      {code.aVerifier ? <Etiquette ton="alerte">à confirmer</Etiquette> : <Etiquette ton="succes">établi</Etiquette>}
                    </li>
                  ))}
                </ul>
              )}
              <p class="note">
                Le noyau calcule ces taxes et exige la ligne correspondante dans l'écriture ; il ne
                l'ajoute jamais en silence.
              </p>
            </section>
          ) : (
            <p class="note">Sélectionnez un tiers pour voir les codes de taxe applicables.</p>
          )}
        </>
      ) : null}
    </Fenetre>
  );
}

