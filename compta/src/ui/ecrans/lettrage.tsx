/**
 * Lettrage des comptes de tiers — Traitements › Lettrage.
 *
 * Trois lectures, dans l'ordre où un comptable les enchaîne : la situation des comptes de tiers
 * (ce qui est dû, ce qui est rapproché, ce qui ne l'est pas), les lignes à lettrer du compte choisi,
 * et les marques posées — y compris celles qui ont été défaites.
 *
 * Le lettrage n'écrit aucune écriture : il rapproche des lignes déjà comptabilisées. C'est pourquoi
 * l'écran refuse de proposer un bouton « Lettrer » quand la sélection ne tombe pas juste : il affiche
 * l'écart et laisse l'utilisateur compléter sa sélection.
 */

import { useState } from "preact/hooks";
import {
  ZERO,
  formaterDateFr,
  type CritereDeLettrage,
  type DateCivile,
  type Lettrage,
  type Mouvement,
  type PropositionLettrage,
  type SituationDeLettrage
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

export function Lettrage(props: { onMutation: () => void }) {
  const service = getService();
  const [compte, setCompte] = useState("401100");
  const [tiers, setTiers] = useState<string>("tous");
  const [cochees, setCochees] = useState<string[]>([]);
  const [propositions, setPropositions] = useState<PropositionLettrage[] | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const critere: CritereDeLettrage = tiers === "tous" ? { compte } : { compte, tiersCode: tiers };

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const etat = await service.lire();
      const contexte = await service.contexte();
      const situations = await service.situationDuLettrage();
      return {
        contexte,
        situations,
        comptesDeTiers: etat.comptes.filter((item) => item.classe === "4" && item.autoriseSaisie),
        tiers: etat.tiers,
        lignes: await service.lignesALettrer(critere),
        marques: await service.lettrages(compte)
      };
    },
    [compte, tiers, revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du grand livre…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, situations, lignes, marques } = donnees;
  const tiersDuCompte = situations.filter((item) => item.compte === compte && item.tiersCode !== null);

  const cocheesResolues: Mouvement[] = lignes.filter((ligne) => cochees.includes(ligne.ligneId));
  const totalDebit = cocheesResolues.reduce((total, ligne) => total + ligne.debit, ZERO);
  const totalCredit = cocheesResolues.reduce((total, ligne) => total + ligne.credit, ZERO);
  const ecart = totalDebit - totalCredit;
  const lettrable = cocheesResolues.length >= 2 && ecart === ZERO;
  const raisonIndisponible =
    cocheesResolues.length < 2
      ? "Sélectionnez au moins deux lignes à rapprocher."
      : ecart !== ZERO
        ? `La sélection n'est pas équilibrée : écart ${montant(ecart)}. Le lettrage partiel n'est pas produit.`
        : "";

  const basculer = (ligneId: string): void => {
    setRetour(null);
    setCochees((precedent) =>
      precedent.includes(ligneId) ? precedent.filter((item) => item !== ligneId) : [...precedent, ligneId]
    );
  };

  const terminer = (texte: string): void => {
    setRetour({ ton: "succes", texte });
    setCochees([]);
    setPropositions(null);
    setRevision((valeur) => valeur + 1);
    props.onMutation();
  };

  const echouer = (erreur: unknown): void => {
    setRetour({ ton: "erreur", texte: message(erreur) });
  };

  const lettrer = async (): Promise<void> => {
    try {
      const lettrage = await service.lettrer({ compte, lignes: cochees });
      terminer(
        `Lettrage ${lettrage.code} créé : ${lettrage.lignes.length} lignes rapprochées, ${montant(
          lettrage.montant
        )}.`
      );
    } catch (erreur) {
      echouer(erreur);
    }
  };

  const proposer = async (): Promise<void> => {
    try {
      setRetour(null);
      const trouvees = await service.proposerLettrageAutomatique(critere);
      setPropositions(trouvees);
      setRetour(
        trouvees.length === 0
          ? {
              ton: "erreur",
              texte:
                "Aucun rapprochement de même montant n'a été trouvé. Le lettrage automatique ne rapproche que des montants exactement égaux : le reste se lettre à la main."
            }
          : {
              ton: "succes",
              texte: `${trouvees.length} rapprochement${trouvees.length > 1 ? "s" : ""} proposé${
                toutes(trouvees)
              }. Rien n'est encore écrit : appliquez pour créer les marques.`
            }
      );
    } catch (erreur) {
      echouer(erreur);
    }
  };

  const appliquer = async (): Promise<void> => {
    try {
      const crees = await service.lettrerAutomatiquement(critere);
      terminer(
        `${crees.length} marque${crees.length > 1 ? "s" : ""} créée${
          crees.length > 1 ? "s" : ""
        } : ${crees.map((lettrage) => `${lettrage.code} (${montant(lettrage.montant)})`).join(", ")}.`
      );
    } catch (erreur) {
      echouer(erreur);
    }
  };

  const delettrer = async (lettrage: Lettrage): Promise<void> => {
    try {
      await service.delettrer(lettrage.code);
      terminer(`Lettrage ${lettrage.code} défait : ${lettrage.lignes.length} lignes sont revenues à lettrer.`);
    } catch (erreur) {
      echouer(erreur);
    }
  };

  const colonnesSituations: Colonne<SituationDeLettrage>[] = [
    { cle: "compte", titre: "Compte", largeur: "7rem", valeur: (ligne) => <span class="mono">{ligne.compte}</span> },
    { cle: "tiers", titre: "Tiers", largeur: "7rem", valeur: (ligne) => <span class="mono">{ligne.tiersCode}</span> },
    {
      cle: "nom",
      titre: "Nom",
      valeur: (ligne) => donnees.tiers.find((item) => item.code === ligne.tiersCode)?.nom ?? ""
    },
    { cle: "debit", titre: "Total débit", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.totalDebit) },
    { cle: "credit", titre: "Total crédit", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.totalCredit) },
    {
      cle: "solde",
      titre: "Solde comptable",
      alignement: "droite",
      largeur: "11rem",
      valeur: (ligne) => <strong class="mono">{montant(ligne.solde)}</strong>
    },
    { cle: "lettre", titre: "Lettré", alignement: "droite", largeur: "10rem", valeur: (ligne) => montant(ligne.lettre) },
    {
      cle: "nonLettre",
      titre: "Non lettré",
      alignement: "droite",
      largeur: "10rem",
      valeur: (ligne) => <strong class="mono">{montant(ligne.nonLettre)}</strong>
    },
    {
      cle: "anciennete",
      titre: "Plus ancienne ligne",
      alignement: "centre",
      largeur: "11rem",
      valeur: (ligne) => (ligne.plusAncienneLigne ? formaterDateFr(ligne.plusAncienneLigne) : "—")
    }
  ];

  const lignesCsv = (): (readonly CelluleCsv[])[] => [
    ["Lettrage des comptes de tiers"],
    ["Dossier", contexte.numero],
    ["Société", contexte.societe.raisonSociale],
    ["Compte", compte, tiers === "tous" ? "Tous les tiers" : `Tiers ${tiers}`],
    [],
    ["Situation", "Compte", "Tiers", "Nom", "Total débit", "Total crédit", "Solde", "Lettré", "Non lettré", "Lignes à lettrer", "Plus ancienne ligne"],
    ...situations.map((item) => [
      "situation",
      item.compte,
      item.tiersCode ?? "",
      donnees.tiers.find((tiersItem) => tiersItem.code === item.tiersCode)?.nom ?? "",
      item.totalDebit,
      item.totalCredit,
      item.solde,
      item.lettre,
      item.nonLettre,
      item.lignesALettrer,
      item.plusAncienneLigne ?? ""
    ]),
    [],
    ["Lignes à lettrer", "Date", "Pièce", "Journal", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
    ...lignes.map((item) => [
      "à lettrer",
      item.date,
      item.piece,
      item.journalCode,
      item.compte,
      item.tiersCode ?? "",
      item.libelle,
      item.debit,
      item.credit
    ]),
    [],
    ["Marques", "Code", "Compte", "Tiers", "Montant", "Lignes", "Date", "Acteur", "État"],
    ...marques.map((item) => [
      "marque",
      item.code,
      item.compte,
      item.tiersCode ?? "",
      item.montant,
      item.lignes.length,
      item.date,
      item.acteur,
      item.defaitLe === null ? "en vigueur" : `défait le ${item.defaitLe.slice(0, 10)}`
    ])
  ];

  return (
    <Fenetre
      titre="Lettrage des comptes de tiers"
      chemin="Traitements › Lettrage"
      sousTitre={`Dossier ${contexte.numero} · ${contexte.societe.raisonSociale} · montants en ${contexte.devise}`}
      actions={
        <>
          <label class="champ-court">
            Compte
            <select
              value={compte}
              onChange={(evenement) => {
                setCompte(evenement.currentTarget.value);
                setTiers("tous");
                setCochees([]);
                setPropositions(null);
                setRetour(null);
              }}
            >
              {donnees.comptesDeTiers.map((item) => (
                <option key={item.numero} value={item.numero}>
                  {item.numero} — {item.libelle}
                </option>
              ))}
            </select>
          </label>
          <label class="champ-court">
            Tiers
            <select
              value={tiers}
              onChange={(evenement) => {
                setTiers(evenement.currentTarget.value);
                setCochees([]);
                setPropositions(null);
                setRetour(null);
              }}
            >
              <option value="tous">Tous les tiers</option>
              {tiersDuCompte.map((item) => (
                <option key={item.tiersCode} value={item.tiersCode ?? ""}>
                  {item.tiersCode} — {donnees.tiers.find((tiersItem) => tiersItem.code === item.tiersCode)?.nom ?? ""}
                </option>
              ))}
            </select>
          </label>
          <Exporter tige="lettrage" contexte={`${compte}-${tiers}`} date={aujourdHui} lignes={lignesCsv} />
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
        <h2>Situation des comptes de tiers</h2>
        <p class="note">
          Le solde comptable dit ce qui est dû ; le solde non lettré dit ce qui est dû sans qu'aucun
          règlement ne l'explique. Sélectionnez une ligne pour lettrer ce compte et ce tiers.
        </p>
        <Grille
          colonnes={colonnesSituations}
          lignes={situations}
          cleDe={(ligne) => `${ligne.compte}-${ligne.tiersCode ?? "sans-tiers"}`}
          selection={
            situations.some((item) => item.compte === compte && item.tiersCode === (tiers === "tous" ? null : tiers))
              ? `${compte}-${tiers === "tous" ? "sans-tiers" : tiers}`
              : null
          }
          surSelection={(cle) => {
            const choisie = situations.find(
              (item) => `${item.compte}-${item.tiersCode ?? "sans-tiers"}` === cle
            );
            if (!choisie) {
              return;
            }
            setCompte(choisie.compte);
            setTiers(choisie.tiersCode ?? "tous");
            setCochees([]);
            setPropositions(null);
            setRetour(null);
          }}
          vide="Aucun mouvement sur un compte de tiers : rien à lettrer."
        />
      </div>

      <div class="bloc">
        <h2>
          Lignes à lettrer — {compte}
          {tiers === "tous" ? "" : ` · ${tiers}`}
        </h2>
        {lignes.length === 0 ? (
          <Vide>
            Aucune ligne à lettrer sur ce compte : tout est déjà rapproché, ou aucun mouvement ne
            correspond au filtre.
          </Vide>
        ) : (
          <>
            <div class="grille-conteneur">
              <table class="grille grille-etat">
                <thead>
                  <tr>
                    <th class="align-centre" style={{ width: "3rem" }}>
                      <span class="illisible">Cocher</span>
                    </th>
                    <th>Date</th>
                    <th>Pièce</th>
                    <th>Journal</th>
                    <th>Compte</th>
                    <th>Tiers</th>
                    <th>Libellé</th>
                    <th class="align-droite">Débit</th>
                    <th class="align-droite">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne) => (
                    <tr key={ligne.ligneId} class={cochees.includes(ligne.ligneId) ? "selectionnee" : undefined}>
                      <td class="align-centre">
                        <input
                          type="checkbox"
                          checked={cochees.includes(ligne.ligneId)}
                          aria-label={`Lettrer la ligne ${ligne.piece} du ${formaterDateFr(ligne.date)}`}
                          onChange={() => basculer(ligne.ligneId)}
                        />
                      </td>
                      <td>{formaterDateFr(ligne.date)}</td>
                      <td class="mono">{ligne.piece}</td>
                      <td class="mono">{ligne.journalCode}</td>
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
                    <th colSpan={7}>Sélection — {cocheesResolues.length} ligne{cocheesResolues.length > 1 ? "s" : ""}</th>
                    <td class="align-droite mono">{montant(totalDebit)}</td>
                    <td class="align-droite mono">{montant(totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                disabled={!lettrable}
                title={lettrable ? "Créer une marque de lettrage sur les lignes cochées" : raisonIndisponible}
                onClick={() => void lettrer()}
              >
                Lettrer la sélection
              </button>
              <button class="bouton" type="button" onClick={() => void proposer()}>
                Proposer un lettrage automatique
              </button>
              <button
                class="bouton"
                type="button"
                disabled={propositions === null || propositions.length === 0}
                title={
                  propositions === null || propositions.length === 0
                    ? "Demandez d'abord une proposition : rien n'est écrit sans qu'elle ait été montrée."
                    : `Créer ${propositions.length} marque${propositions.length > 1 ? "s" : ""} de lettrage`
                }
                onClick={() => void appliquer()}
              >
                Appliquer les propositions
              </button>
              <button
                class="bouton"
                type="button"
                disabled={cochees.length === 0}
                title={cochees.length === 0 ? "Aucune ligne cochée" : "Vider la sélection"}
                onClick={() => {
                  setCochees([]);
                  setRetour(null);
                }}
              >
                Vider la sélection
              </button>
              <Etiquette ton={lettrable ? "succes" : cochees.length === 0 ? "" : "alerte"}>
                {cochees.length === 0
                  ? "Aucune ligne cochée"
                  : lettrable
                    ? `Lettrage possible : ${montant(totalDebit)}`
                    : `Écart ${montant(ecart)} — le lettrage partiel n'est pas produit`}
              </Etiquette>
            </div>
          </>
        )}
      </div>

      {propositions && propositions.length > 0 ? (
        <div class="bloc">
          <h2>Propositions du lettrage automatique</h2>
          <table class="grille">
            <thead>
              <tr>
                <th>Nature</th>
                <th>Pièces</th>
                <th>Lignes</th>
                <th class="align-droite">Montant</th>
                <th>Plus ancienne</th>
              </tr>
            </thead>
            <tbody>
              {propositions.map((proposition, index) => (
                <tr key={`${proposition.montant}-${index}`}>
                  <td>{proposition.nature === "exact" ? "Montant exact" : "Montants composés"}</td>
                  <td class="mono">{proposition.pieces.join(", ")}</td>
                  <td class="align-droite">{proposition.lignes.length}</td>
                  <td class="align-droite mono">{montant(proposition.montant)}</td>
                  <td>{formaterDateFr(proposition.dateLaPlusAncienne)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div class="bloc">
        <h2>Marques de lettrage — {compte}</h2>
        {marques.length === 0 ? (
          <Vide>Aucune marque sur ce compte.</Vide>
        ) : (
          <table class="grille">
            <thead>
              <tr>
                <th>Code</th>
                <th>Tiers</th>
                <th class="align-droite">Montant</th>
                <th class="align-droite">Lignes</th>
                <th>Date</th>
                <th>Acteur</th>
                <th>État</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {marques.map((lettrage) => (
                <tr key={lettrage.code} class={lettrage.defaitLe === null ? undefined : "defaite"}>
                  <td class="mono">{lettrage.code}</td>
                  <td class="mono">{lettrage.tiersCode ?? ""}</td>
                  <td class="align-droite mono">{montant(lettrage.montant)}</td>
                  <td class="align-droite">{lettrage.lignes.length}</td>
                  <td>{formaterDateFr(lettrage.date)}</td>
                  <td>{lettrage.acteur}</td>
                  <td>
                    {lettrage.defaitLe === null ? (
                      <span class="succes-texte">En vigueur</span>
                    ) : (
                      <span class="erreur-texte">Défait le {formaterDateFr(lettrage.defaitLe.slice(0, 10) as DateCivile)}</span>
                    )}
                  </td>
                  <td>
                    <button
                      class="bouton"
                      type="button"
                      disabled={lettrage.defaitLe !== null}
                      title={
                        lettrage.defaitLe !== null
                          ? "Marque déjà défaite"
                          : `Rendre les ${lettrage.lignes.length} lignes à lettrer`
                      }
                      onClick={() => void delettrer(lettrage)}
                    >
                      Délettrer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p class="note">
        Le lettrage automatique ne rapproche que des montants <strong>exactement égaux</strong> — un montant
        contre un autre, ou un montant contre deux ou trois autres. Le lettrage partiel (un règlement
        qui ne couvre qu'une partie d'une facture) n'est pas produit : il suppose un suivi des
        imputations ligne à ligne, et l'annoncer sans le faire serait pire que de ne pas l'annoncer.
        Un délettrage ne supprime pas la marque : il la date, pour que l'historique du compte reste
        reconstituable.
      </p>
    </Fenetre>
  );
}

function toutes(propositions: readonly PropositionLettrage[]): string {
  return propositions.length > 1 ? "s" : "";
}
