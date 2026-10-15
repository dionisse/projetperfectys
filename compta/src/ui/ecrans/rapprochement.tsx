/**
 * Rapprochement bancaire — Traitements › Rapprochement bancaire.
 *
 * L'écran met face à face deux documents qui décrivent la même caisse sans se connaître : le compte de
 * trésorerie tel que la comptabilité le tient, et le relevé tel que la banque le donne. Il montre les
 * soldes, l'écart, et surtout **ce que l'écart ne s'explique pas** — parce qu'un rapprochement qui
 * absorbe une différence ne sert à rien.
 *
 * Le pointage n'écrit aucune écriture : il rapproche des mouvements déjà comptabilisés avec des lignes
 * déjà reçues. Quand la banque a prélevé des frais que la comptabilité n'a pas passés, le bouton de
 * pointage reste grisé et dit pourquoi : la différence se comptabilise d'abord.
 */

import { useState } from "preact/hooks";
import {
  ZERO,
  formaterDateFr,
  oppose,
  type DateCivile,
  type ElementPointe,
  type EtatDeRapprochement,
  type LigneDeReleve,
  type Mouvement,
  type Pointage,
  type PropositionDePointage,
  type ReleveBancaire
} from "../../noyau/index";
import { getService } from "../../web/noyau";
import {
  ChargementEnCours,
  Erreur,
  Etiquette,
  ExportCsv,
  Fenetre,
  Vide,
  message,
  montant,
  useAsync,
  type CelluleCsv
} from "../composants";

interface LigneDeBrouillon {
  date: string;
  reference: string;
  libelle: string;
  montant: string;
}

const ligneVide = (date: string): LigneDeBrouillon => ({ date, reference: "", libelle: "", montant: "" });

export function Rapprochement(props: { onMutation: () => void }) {
  const service = getService();
  const [releveChoisi, setReleveChoisi] = useState<string>("");
  const [lignesCochees, setLignesCochees] = useState<string[]>([]);
  const [mouvementsCoches, setMouvementsCoches] = useState<string[]>([]);
  const [horsPeriode, setHorsPeriode] = useState(false);
  const [propositions, setPropositions] = useState<PropositionDePointage[] | null>(null);
  const [retour, setRetour] = useState<{ ton: "succes" | "erreur"; texte: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const [brouillon, setBrouillon] = useState<{
    compte: string;
    journalCode: string;
    libelle: string;
    dateDebut: string;
    dateFin: string;
    soldeDOuverture: string;
    lignes: LigneDeBrouillon[];
  } | null>(null);
  const aujourdHui = new Date().toISOString().slice(0, 10) as DateCivile;

  const { donnees, erreur, charge, recharger } = useAsync(
    async () => {
      const contexte = await service.contexte();
      const releves = await service.releves();
      const choisi = releves.find((releve) => releve.id === releveChoisi) ?? releves[0];
      if (!choisi) {
        return { contexte, releves, releve: null, etat: null, pointages: [] as Pointage[] };
      }
      const etat = await service.etatDeRapprochement(choisi.id);
      const dossier = await service.lire();
      return {
        contexte,
        releves,
        releve: choisi,
        etat,
        pointages: dossier.pointages.filter((pointage) => pointage.releveId === choisi.id)
      };
    },
    [releveChoisi, revision]
  );

  if (erreur) {
    return <Erreur message={erreur} onRetry={recharger} />;
  }
  if (charge && !donnees) {
    return <ChargementEnCours libelle="Lecture du relevé et du compte de trésorerie…" />;
  }
  if (!donnees) {
    return <ChargementEnCours libelle="Chargement du dossier…" />;
  }

  const { contexte, releves, releve, etat } = donnees;

  const terminer = (texte: string): void => {
    setRetour({ ton: "succes", texte });
    setLignesCochees([]);
    setMouvementsCoches([]);
    setPropositions(null);
    setRevision((valeur) => valeur + 1);
    props.onMutation();
  };

  const echouer = (erreurInconnue: unknown): void => {
    setRetour({ ton: "erreur", texte: message(erreurInconnue) });
  };

  const basculerLigne = (id: string): void => {
    setRetour(null);
    setLignesCochees((precedent) =>
      precedent.includes(id) ? precedent.filter((item) => item !== id) : [...precedent, id]
    );
  };

  const basculerMouvement = (ligneId: string): void => {
    setRetour(null);
    setMouvementsCoches((precedent) =>
      precedent.includes(ligneId) ? precedent.filter((item) => item !== ligneId) : [...precedent, ligneId]
    );
  };

  /* ---------------------------------------------------------------- */
  /* Pointage                                                          */
  /* ---------------------------------------------------------------- */

  const ligneChoisie = etat?.lignesNonPointees.find((ligne) => lignesCochees.includes(ligne.id)) ?? null;
  const mouvementChoisi = etat?.mouvementsNonPointes.find((item) => mouvementsCoches.includes(item.ligneId)) ?? null;
  const montantDuMouvement = (mouvement: Mouvement): bigint =>
    mouvement.debit !== ZERO ? mouvement.debit : oppose(mouvement.credit);

  const raisonIndisponible = (() => {
    if (!ligneChoisie || !mouvementChoisi) {
      return "Cochez une ligne du relevé et un mouvement du compte : le pointage rapproche une ligne d'un mouvement.";
    }
    if (lignesCochees.length > 1 || mouvementsCoches.length > 1) {
      return "Le pointage rapproche une ligne d'un seul mouvement : ne cochez qu'une ligne et qu'un mouvement.";
    }
    if (montantDuMouvement(mouvementChoisi) !== ligneChoisie.montant) {
      return `Les montants diffèrent : ${montant(montantDuMouvement(mouvementChoisi))} côté compte, ${montant(
        ligneChoisie.montant
      )} côté relevé. Comptabilisez la différence, puis pointez.`;
    }
    return "";
  })();
  const pointable = raisonIndisponible === "";

  const pointer = async (): Promise<void> => {
    if (!releve || !ligneChoisie || !mouvementChoisi) {
      return;
    }
    try {
      await service.pointer({
        releveId: releve.id,
        paires: [{ ligne: ligneChoisie.id, mouvement: mouvementChoisi.ligneId }]
      });
      terminer(
        `Pointage créé : ${ligneChoisie.libelle} (${montant(ligneChoisie.montant)}) rapproché de la pièce ${
          mouvementChoisi.piece
        } du ${formaterDateFr(mouvementChoisi.date)}.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const proposer = async (): Promise<void> => {
    if (!releve) {
      return;
    }
    try {
      setRetour(null);
      const trouvees = await service.proposerPointage(releve.id, { horsPeriode });
      setPropositions(trouvees);
      setRetour(
        trouvees.length === 0
          ? {
              ton: "erreur",
              texte:
                "Aucun pointage proposé : le rapprochement automatique ne retient que les montants exactement égaux, par référence d'abord. Ce qui reste se pointe à la main, ou se comptabilise d'abord."
            }
          : {
              ton: "succes",
              texte: `${trouvees.length} pointage${trouvees.length > 1 ? "s" : ""} proposé${
                trouvees.length > 1 ? "s" : ""
              }. Rien n'est encore écrit : vérifiez, puis appliquez.`
            }
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const appliquer = async (): Promise<void> => {
    if (!releve) {
      return;
    }
    try {
      const { pointages } = await service.pointerAutomatiquement(releve.id, { horsPeriode });
      terminer(
        pointages.length === 0
          ? "Aucun pointage appliqué : il n'y avait rien à proposer."
          : `${pointages.length} pointage${pointages.length > 1 ? "s" : ""} appliqué${
              pointages.length > 1 ? "s" : ""
            }, ${montant(pointages.reduce((total, item) => total + item.montant, ZERO))} rapproché${
              pointages.length > 1 ? "s" : ""
            }.`
      );
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const depointer = async (pointage: Pointage): Promise<void> => {
    try {
      await service.depointer(pointage.id);
      terminer(`Pointage ${pointage.id} défait : la ligne et le mouvement sont revenus à rapprocher.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  const supprimer = async (cible: ReleveBancaire): Promise<void> => {
    try {
      await service.supprimerReleve(cible.id);
      setReleveChoisi("");
      terminer(`Relevé « ${cible.libelle} » supprimé.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Saisie d'un relevé                                                */
  /* ---------------------------------------------------------------- */

  const enregistrerReleve = async (): Promise<void> => {
    if (!brouillon) {
      return;
    }
    try {
      const cree = await service.ajouterReleve({
        compte: brouillon.compte,
        journalCode: brouillon.journalCode,
        libelle: brouillon.libelle,
        dateDebut: brouillon.dateDebut as DateCivile,
        dateFin: brouillon.dateFin as DateCivile,
        soldeDOuverture: brouillon.soldeDOuverture,
        lignes: brouillon.lignes
          .filter((ligne) => ligne.montant.trim() !== "" && ligne.libelle.trim() !== "")
          .map((ligne) => ({
            date: ligne.date as DateCivile,
            libelle: ligne.libelle,
            reference: ligne.reference,
            montant: ligne.montant
          }))
      });
      setBrouillon(null);
      setReleveChoisi(cree.id);
      terminer(`Relevé « ${cree.libelle} » saisi : ${cree.lignes.length} lignes, à rapprocher du compte ${cree.compte}.`);
    } catch (erreurInconnue) {
      echouer(erreurInconnue);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Export                                                            */
  /* ---------------------------------------------------------------- */

  const lignesCsv = (): (readonly CelluleCsv[])[] => {
    if (!releve || !etat) {
      return [["Rapprochement bancaire"], ["Dossier", contexte.numero], [], ["Aucun relevé saisi."]];
    }
    return [
      ["Rapprochement bancaire"],
      ["Dossier", contexte.numero],
      ["Société", contexte.societe.raisonSociale],
      ["Relevé", releve.libelle],
      ["Compte", etat.compte, "Journal", etat.journalCode],
      ["Période", `${formaterDateFr(releve.dateDebut)} – ${formaterDateFr(releve.dateFin)}`],
      [],
      ["Solde comptable à la fin du relevé", etat.soldeComptable],
      ["Solde du relevé", etat.soldeDuReleve],
      ["Écart", etat.ecart],
      ["Expliqué par les suspens de la période", etat.ecartExplique],
      ["Suspens des périodes antérieures", etat.ecartDOuverture],
      ["Reste inexpliqué", etat.ecartRestant],
      ["Rapprochement", etat.conforme ? "conforme" : "écart non expliqué"],
      [],
      ["Ligne du relevé", "Date", "Référence", "Libellé", "Montant (sens banque)", "Pointée avec"],
      ...releve.lignes.map((ligne) => {
        const pointe = etat.pointes.find((item) => item.ligneDeReleve === ligne.id);
        return [
          ligne.id,
          ligne.date,
          ligne.reference,
          ligne.libelle,
          ligne.montant,
          pointe ? `${pointe.piece} du ${formaterDateFr(pointe.date)}` : "non pointée"
        ];
      }),
      [],
      ["Mouvement non pointé", "Date", "Pièce", "Journal", "Compte", "Tiers", "Libellé", "Débit", "Crédit"],
      ...etat.mouvementsNonPointes.map((mouvement) => [
        mouvement.ligneId,
        mouvement.date,
        mouvement.piece,
        mouvement.journalCode,
        mouvement.compte,
        mouvement.tiersCode ?? "",
        mouvement.libelle,
        mouvement.debit,
        mouvement.credit
      ]),
      [],
      ["Pointage", "Ligne du relevé", "Mouvement", "Montant", "Date", "Acteur", "État"],
      ...donnees.pointages.map((pointage) => [
        pointage.id,
        pointage.ligneDeReleve,
        pointage.mouvement,
        pointage.montant,
        pointage.date,
        pointage.acteur,
        pointage.defaitLe === null ? "en vigueur" : `défait le ${pointage.defaitLe}`
      ])
    ];
  };

  const pointagesEnVigueur = donnees.pointages.filter((pointage) => pointage.defaitLe === null);
  const pieceDe = (ligneId: string): string =>
    etat?.pointes.find((item: ElementPointe) => item.mouvement === ligneId)?.piece ?? "";

  /* ---------------------------------------------------------------- */
  /* Rendu                                                             */
  /* ---------------------------------------------------------------- */

  return (
    <Fenetre
      titre="Rapprochement bancaire"
      chemin="Traitements › Rapprochement bancaire"
      sousTitre={`Dossier ${contexte.numero} · ${contexte.societe.raisonSociale} · montants en ${contexte.devise}`}
      actions={
        <>
          <label class="champ-court">
            Relevé
            <select
              value={releve?.id ?? ""}
              disabled={releves.length === 0}
              onChange={(evenement) => {
                setReleveChoisi(evenement.currentTarget.value);
                setLignesCochees([]);
                setMouvementsCoches([]);
                setPropositions(null);
                setRetour(null);
              }}
            >
              {releves.length === 0 ? <option value="">Aucun relevé</option> : null}
              {releves.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.libelle} — {item.compte}
                </option>
              ))}
            </select>
          </label>
          <ExportCsv tige="rapprochement" contexte={releve?.compte ?? "aucun"} date={aujourdHui} lignes={lignesCsv} />
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

      {releves.length === 0 || !releve || !etat ? (
        <div class="bloc">
          <h2>Aucun relevé bancaire</h2>
          <Vide>
            Aucun relevé n'est saisi dans ce dossier. Le rapprochement confronte un relevé reçu de la
            banque au compte de trésorerie : saisissez un relevé ci-dessous, ou importez-le —
            l'import d'un fichier de relevé n'est pas encore produit.
          </Vide>
        </div>
      ) : (
        <>
          <div class="bloc">
            <h2>État de rapprochement</h2>
            <p class="note">
              Compte <span class="mono">{etat.compte}</span> · journal{" "}
              <span class="mono">{etat.journalCode}</span> · relevé du{" "}
              {formaterDateFr(releve.dateDebut)} au {formaterDateFr(releve.dateFin)}
            </p>
            <dl class="liste-definition">
              <dt>Solde comptable à la fin du relevé</dt>
              <dd class="mono">{montant(etat.soldeComptable)}</dd>
              <dt>Solde du relevé (ouverture {montant(releve.soldeDOuverture)} + {releve.lignes.length} lignes)</dt>
              <dd class="mono">{montant(etat.soldeDuReleve)}</dd>
              <dt>Écart</dt>
              <dd class="mono">
                <strong>{montant(etat.ecart)}</strong>
              </dd>
              <dt>Expliqué par les suspens de la période</dt>
              <dd class="mono">{montant(etat.ecartExplique)}</dd>
              <dt>Suspens des périodes antérieures</dt>
              <dd class="mono">{montant(etat.ecartDOuverture)}</dd>
              <dt>Reste inexpliqué</dt>
              <dd class="mono">
                <strong>{montant(etat.ecartRestant)}</strong>
              </dd>
              <dt>Pointages</dt>
              <dd>
                {etat.pointes.length} en vigueur sur {releve.lignes.length} lignes ·{" "}
                {etat.lignesNonPointees.length} ligne{etat.lignesNonPointees.length > 1 ? "s" : ""} du relevé et{" "}
                {etat.mouvementsNonPointes.length} mouvement{etat.mouvementsNonPointes.length > 1 ? "s" : ""} du
                compte restent à rapprocher
              </dd>
            </dl>
            {etat.conforme ? (
              <p>
                <Etiquette ton="succes">Rapprochement conforme</Etiquette>{" "}
                <span class="note">
                  L'écart entre les deux soldes est entièrement composé de suspens identifiés. Rien
                  n'est absorbé : chaque différence a une ligne en face.
                </span>
              </p>
            ) : (
              <p class="avertissement">
                <Etiquette ton="danger">Écart non expliqué : {montant(etat.ecartRestant)}</Etiquette>{" "}
                Une fois les suspens comptés, il reste une différence que ni le relevé ni le compte
                n'expliquent. Vérifiez le solde d'ouverture annoncé par la banque ({montant(
                  releve.soldeDOuverture
                )}) et le solde comptable à la veille du relevé ({montant(etat.soldeComptableAvantReleve)}).
              </p>
            )}
          </div>

          <div class="bloc">
            <h2>Relevé — {releve.libelle}</h2>
            <p class="note">
              Les montants sont portés au sens de la banque : positif quand l'argent entre. Côté
              compte de trésorerie, le sens est inverse — la conversion est faite au pointage.
            </p>
            <div class="grille-conteneur">
              <table class="grille grille-etat">
                <thead>
                  <tr>
                    <th class="align-centre" style={{ width: "3rem" }}>
                      <span class="illisible">Cocher</span>
                    </th>
                    <th>Date</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th class="align-droite">Entrée</th>
                    <th class="align-droite">Sortie</th>
                    <th>Pointée avec</th>
                  </tr>
                </thead>
                <tbody>
                  {releve.lignes.map((ligne: LigneDeReleve) => {
                    const pointe = etat.pointes.find((item) => item.ligneDeReleve === ligne.id);
                    return (
                      <tr
                        key={ligne.id}
                        class={lignesCochees.includes(ligne.id) ? "selectionnee" : pointe ? "niveau-total" : undefined}
                      >
                        <td class="align-centre">
                          {pointe ? (
                            <span class="pastille" title={`Pointée avec la pièce ${pointe.piece}`}>
                              ✓
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={lignesCochees.includes(ligne.id)}
                              aria-label={`Pointer la ligne ${ligne.reference || ligne.libelle} du ${formaterDateFr(
                                ligne.date
                              )}`}
                              onChange={() => basculerLigne(ligne.id)}
                            />
                          )}
                        </td>
                        <td>{formaterDateFr(ligne.date)}</td>
                        <td class="mono">{ligne.reference || "—"}</td>
                        <td>{ligne.libelle}</td>
                        <td class="align-droite mono">{ligne.montant > ZERO ? montant(ligne.montant) : ""}</td>
                        <td class="align-droite mono">{ligne.montant < ZERO ? montant(oppose(ligne.montant)) : ""}</td>
                        <td class="mono">{pointe ? `${pointe.piece} · ${formaterDateFr(pointe.date)}` : "à rapprocher"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={4}>
                      Solde d'ouverture {montant(releve.soldeDOuverture)} · {releve.lignes.length} lignes
                    </th>
                    <td class="align-droite mono" colSpan={2}>
                      Solde du relevé {montant(etat.soldeDuReleve)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div class="bloc">
            <h2>Mouvements du compte {etat.compte} à rapprocher</h2>
            {etat.mouvementsNonPointes.length === 0 ? (
              <Vide>
                Aucun mouvement du compte {etat.compte} sur la période du relevé n'attend d'être
                rapproché. Soit tout est pointé, soit les opérations de banque de la période ne sont
                pas encore comptabilisées — dans ce cas, saisissez-les d'abord.
              </Vide>
            ) : (
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
                    {etat.mouvementsNonPointes.map((mouvement) => (
                      <tr
                        key={mouvement.ligneId}
                        class={mouvementsCoches.includes(mouvement.ligneId) ? "selectionnee" : undefined}
                      >
                        <td class="align-centre">
                          <input
                            type="checkbox"
                            checked={mouvementsCoches.includes(mouvement.ligneId)}
                            aria-label={`Pointer le mouvement ${mouvement.piece} du ${formaterDateFr(mouvement.date)}`}
                            onChange={() => basculerMouvement(mouvement.ligneId)}
                          />
                        </td>
                        <td>{formaterDateFr(mouvement.date)}</td>
                        <td class="mono">{mouvement.piece}</td>
                        <td class="mono">{mouvement.journalCode}</td>
                        <td class="mono">{mouvement.compte}</td>
                        <td class="mono">{mouvement.tiersCode ?? ""}</td>
                        <td>{mouvement.libelle}</td>
                        <td class="align-droite mono">{mouvement.debit === ZERO ? "" : montant(mouvement.debit)}</td>
                        <td class="align-droite mono">{mouvement.credit === ZERO ? "" : montant(mouvement.credit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                disabled={!pointable}
                title={pointable ? "Rapprocher la ligne cochée du mouvement coché" : raisonIndisponible}
                onClick={() => void pointer()}
              >
                Pointer la sélection
              </button>
              <label class="case-a-cocher">
                <input
                  type="checkbox"
                  checked={horsPeriode}
                  onChange={(evenement) => {
                    setHorsPeriode(evenement.currentTarget.checked);
                    setPropositions(null);
                  }}
                />
                Inclure les mouvements antérieurs au relevé
              </label>
              <button class="bouton" type="button" onClick={() => void proposer()}>
                Proposer un pointage automatique
              </button>
              <button
                class="bouton"
                type="button"
                disabled={propositions === null || propositions.length === 0}
                title={
                  propositions === null || propositions.length === 0
                    ? "Demandez d'abord une proposition : rien n'est écrit sans qu'elle ait été montrée."
                    : `Créer ${propositions.length} pointage${propositions.length > 1 ? "s" : ""}`
                }
                onClick={() => void appliquer()}
              >
                Appliquer les propositions
              </button>
              <button
                class="bouton"
                type="button"
                disabled={pointagesEnVigueur.length > 0}
                title={
                  pointagesEnVigueur.length > 0
                    ? `Ce relevé porte ${pointagesEnVigueur.length} pointage${
                        pointagesEnVigueur.length > 1 ? "s" : ""
                      } : il faut d'abord dépointer.`
                    : "Supprimer ce relevé du dossier"
                }
                onClick={() => void supprimer(releve)}
              >
                Supprimer ce relevé
              </button>
            </div>

            {propositions !== null ? (
              <div class="bloc">
                <h2>Propositions de pointage</h2>
                {propositions.length === 0 ? (
                  <Vide>Rien à proposer.</Vide>
                ) : (
                  <div class="grille-conteneur">
                    <table class="grille grille-etat">
                      <thead>
                        <tr>
                          <th>Retenue sur</th>
                          <th>Ligne du relevé</th>
                          <th>Mouvement</th>
                          <th>Date</th>
                          <th class="align-droite">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {propositions.map((proposition) => {
                          const ligne = releve.lignes.find((item) => item.id === proposition.ligneDeReleve);
                          return (
                            <tr key={`${proposition.ligneDeReleve}-${proposition.mouvement}`}>
                              <td>{proposition.nature === "reference" ? "la référence" : "le montant"}</td>
                              <td>
                                <span class="mono">{ligne?.reference || "—"}</span> {ligne?.libelle ?? ""}
                              </td>
                              <td class="mono">{proposition.piece}</td>
                              <td>{formaterDateFr(proposition.date)}</td>
                              <td class="align-droite mono">{montant(proposition.montant)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div class="bloc">
            <h2>Pointages du relevé</h2>
            {donnees.pointages.length === 0 ? (
              <Vide>Aucun pointage sur ce relevé.</Vide>
            ) : (
              <div class="grille-conteneur">
                <table class="grille grille-etat">
                  <thead>
                    <tr>
                      <th>Pointage</th>
                      <th>Ligne du relevé</th>
                      <th>Pièce</th>
                      <th>Date</th>
                      <th class="align-droite">Montant</th>
                      <th>Acteur</th>
                      <th>État</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {donnees.pointages.map((pointage) => {
                      const ligne = releve.lignes.find((item) => item.id === pointage.ligneDeReleve);
                      return (
                        <tr key={pointage.id} class={pointage.defaitLe === null ? undefined : "niveau-detail"}>
                          <td class="mono">{pointage.id}</td>
                          <td>
                            <span class="mono">{ligne?.reference || "—"}</span> {ligne?.libelle ?? ""}
                          </td>
                          <td class="mono">{pieceDe(pointage.mouvement) || pointage.mouvement}</td>
                          <td>{formaterDateFr(pointage.date)}</td>
                          <td class="align-droite mono">{montant(pointage.montant)}</td>
                          <td>{pointage.acteur}</td>
                          <td>
                            {pointage.defaitLe === null ? (
                              <Etiquette ton="succes">en vigueur</Etiquette>
                            ) : (
                              <Etiquette>défait</Etiquette>
                            )}
                          </td>
                          <td>
                            <button
                              class="bouton"
                              type="button"
                              disabled={pointage.defaitLe !== null}
                              title={
                                pointage.defaitLe !== null
                                  ? "Ce pointage est déjà défait."
                                  : "Rendre la ligne et le mouvement à rapprocher"
                              }
                              onClick={() => void depointer(pointage)}
                            >
                              Dépointer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div class="bloc">
        <h2>{brouillon ? "Saisie d'un relevé" : "Saisir un relevé bancaire"}</h2>
        {brouillon === null ? (
          <>
            <p class="note">
              Un relevé se saisit ligne à ligne, tel que la banque le donne : la date, la référence
              (numéro de chèque, de virement, de remise), le libellé et le montant — positif quand
              l'argent entre, négatif quand il sort. Aucune écriture n'est passée : le relevé décrit,
              il ne comptabilise pas.
            </p>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                onClick={() =>
                  setBrouillon({
                    compte: "521100",
                    journalCode: "BQ",
                    libelle: "",
                    dateDebut: `${aujourdHui.slice(0, 8)}01`,
                    dateFin: aujourdHui,
                    soldeDOuverture: "",
                    lignes: [ligneVide(aujourdHui)]
                  })
                }
              >
                Saisir un relevé
              </button>
              <span class="indisponible" aria-disabled="true" title="L'import d'un fichier de relevé bancaire (CSV, OFX, CAMT) n'est pas produit — tranche F.">
                Importer un fichier de relevé
              </span>
            </div>
          </>
        ) : (
          <>
            <div class="deux-colonnes">
              <label class="champ-court">
                Compte de trésorerie
                <input
                  class="mono"
                  value={brouillon.compte}
                  onChange={(evenement) => setBrouillon({ ...brouillon, compte: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Journal
                <input
                  class="mono"
                  value={brouillon.journalCode}
                  onChange={(evenement) => setBrouillon({ ...brouillon, journalCode: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Libellé du relevé
                <input
                  value={brouillon.libelle}
                  placeholder="Relevé d'avril 2026 — BOA Bénin"
                  onChange={(evenement) => setBrouillon({ ...brouillon, libelle: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Solde d'ouverture (sens banque)
                <input
                  class="mono"
                  value={brouillon.soldeDOuverture}
                  placeholder="55000000"
                  onChange={(evenement) =>
                    setBrouillon({ ...brouillon, soldeDOuverture: evenement.currentTarget.value })
                  }
                />
              </label>
              <label class="champ-court">
                Du
                <input
                  type="date"
                  value={brouillon.dateDebut}
                  onChange={(evenement) => setBrouillon({ ...brouillon, dateDebut: evenement.currentTarget.value })}
                />
              </label>
              <label class="champ-court">
                Au
                <input
                  type="date"
                  value={brouillon.dateFin}
                  onChange={(evenement) => setBrouillon({ ...brouillon, dateFin: evenement.currentTarget.value })}
                />
              </label>
            </div>
            <div class="grille-conteneur">
              <table class="grille grille-etat">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Référence</th>
                    <th>Libellé</th>
                    <th class="align-droite">Montant</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {brouillon.lignes.map((ligne, index) => (
                    <tr key={`brouillon-${index}`}>
                      <td>
                        <input
                          type="date"
                          value={ligne.date}
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, date: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          class="mono"
                          value={ligne.reference}
                          placeholder="CHQ-118204"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, reference: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={ligne.libelle}
                          placeholder="Chèque émis — facture FA-2026-011"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, libelle: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          class="mono align-droite"
                          value={ligne.montant}
                          placeholder="-1850000"
                          onChange={(evenement) =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.map((item, rang) =>
                                rang === index ? { ...item, montant: evenement.currentTarget.value } : item
                              )
                            })
                          }
                        />
                      </td>
                      <td>
                        <button
                          class="bouton"
                          type="button"
                          disabled={brouillon.lignes.length === 1}
                          title={
                            brouillon.lignes.length === 1
                              ? "Un relevé porte au moins une ligne."
                              : "Retirer cette ligne du relevé en cours de saisie"
                          }
                          onClick={() =>
                            setBrouillon({
                              ...brouillon,
                              lignes: brouillon.lignes.filter((_, rang) => rang !== index)
                            })
                          }
                        >
                          Retirer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div class="barre-actions">
              <button
                class="bouton"
                type="button"
                onClick={() =>
                  setBrouillon({ ...brouillon, lignes: [...brouillon.lignes, ligneVide(brouillon.dateDebut)] })
                }
              >
                Ajouter une ligne
              </button>
              <button class="bouton" type="button" onClick={() => void enregistrerReleve()}>
                Enregistrer le relevé
              </button>
              <button class="bouton" type="button" onClick={() => setBrouillon(null)}>
                Abandonner
              </button>
            </div>
          </>
        )}
      </div>
    </Fenetre>
  );
}
